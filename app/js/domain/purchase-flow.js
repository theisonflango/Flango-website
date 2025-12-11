import { showAlert, showCustomAlert, playSound } from '../ui/sound-and-alerts.js';
import { supabaseClient } from '../core/config-and-supabase.js';
import { OVERDRAFT_LIMIT } from '../core/constants.js';
import { setOrder, getOrder, clearOrder, getOrderTotal } from './order-store.js';
import { evaluatePurchase } from './cafe-session.js';
import {
    applyEvaluation,
    getFinancialState,
    clearCurrentCustomer,
} from './cafe-session-store.js';
import { renderOrder } from './order-ui.js';
import { getProductIconInfo } from './products-and-cart.js';
import { canChildPurchase, invalidateTodaysSalesCache } from './purchase-limits.js';
import { getCurrentSessionAdmin, getCurrentClerk } from './session-store.js';
import { updateCustomerBalanceGlobally, refreshCustomerBalanceFromDB } from '../core/balance-manager.js';

// ============================================================================
// HELPER FUNKTIONER FOR handleCompletePurchase (OPT-6)
// ============================================================================

/**
 * Beriger ordrelinjer med allergeninformation
 * @param {Array} order - Ordre linjer
 * @param {Array} allProducts - Alle produkter
 * @param {Object} productAllergenMap - Map af produkt ID til allergener
 * @returns {Array} Ordre med allergen info
 */
function enrichOrderWithAllergens(order, allProducts, productAllergenMap) {
    return order.map(item => {
        const productId = item.product_id || item.productId || item.id;
        const product = allProducts.find(p => p.id === productId);

        let srcAllergens = product ? product.allergens : null;
        let allergens = [];

        if (Array.isArray(srcAllergens)) {
            allergens = srcAllergens;
        } else if (typeof srcAllergens === 'string' && srcAllergens.trim().length > 0) {
            allergens = srcAllergens.split(',').map(a => a.trim()).filter(Boolean);
        } else if (srcAllergens && typeof srcAllergens === 'object') {
            allergens = Object.keys(srcAllergens).filter(key => !!srcAllergens[key]);
        } else if (productAllergenMap[productId]) {
            allergens = productAllergenMap[productId];
        }

        return { ...item, allergens };
    });
}

/**
 * Grupperer ordre items efter produkt ID og tæller antal
 * @param {Array} order - Ordre linjer
 * @returns {Object} Map af produkt ID til item med count
 */
function groupOrderItems(order) {
    return order.reduce((acc, item) => {
        acc[item.id] = acc[item.id] || { ...item, count: 0 };
        acc[item.id].count++;
        return acc;
    }, {});
}

/**
 * Bygger bekræftelsesdialog UI
 * @param {Object} customer - Kunde
 * @param {Array} currentOrder - Ordre
 * @param {number} finalTotal - Totalt beløb
 * @param {number} newBalance - Ny balance
 * @returns {string} HTML string til bekræftelsesdialog
 */
function buildConfirmationUI(customer, currentOrder, finalTotal, newBalance) {
    // Grupper items efter produkt ID
    const itemCounts = groupOrderItems(currentOrder);

    // Byg produkt liste
    const itemsSummary = Object.values(itemCounts).map(item => {
        const iconInfo = getProductIconInfo(item);
        const visual = iconInfo
            ? `<img src="${iconInfo.path}" alt="${item.name}" class="confirm-product-icon">`
            : `<span class="confirm-product-emoji">${item.emoji || '❓'}</span>`;
        return `<div class="confirm-product-line">${visual}<span>${item.count} x ${item.name}</span></div>`;
    }).join('');

    // Byg negativ balance advarsel hvis relevant
    let negativeBalanceWarning = '';
    if (newBalance < 0) {
        if (customer.balance < 0) {
            negativeBalanceWarning = `<p style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 8px; margin-top: 15px; border: 1px solid #f5c6cb;"><strong>Advarsel:</strong> Er du helt sikker på, at du vil gå endnu mere i minus?</p>`;
        } else {
            negativeBalanceWarning = `<p style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 8px; margin-top: 15px; border: 1px solid #f5c6cb;"><strong>Advarsel:</strong> Er du helt sikker på, du vil gå i minus?</p>`;
        }
    }

    return `<strong>${customer.name}</strong> køber:<br>${itemsSummary}<br>for <strong>${finalTotal.toFixed(2)} kr.</strong><hr style="margin: 15px 0; border: 1px solid #eee;">${customer.name} har <strong>${newBalance.toFixed(2)} kr.</strong> tilbage.${negativeBalanceWarning}`;
}

/**
 * Sætter knap state (loading eller normal)
 * @param {HTMLElement} btn - Button element
 * @param {string} state - 'loading' eller 'normal'
 */
function setButtonLoadingState(btn, state) {
    if (!btn) return;
    if (state === 'loading') {
        btn.disabled = true;
        btn.textContent = 'Behandler...';
    } else {
        btn.disabled = false;
        btn.textContent = 'Gennemfør Køb';
    }
}

/**
 * Resolver admin og clerk IDs til database payload
 * @param {Object} options - { sessionAdmin, adminProfile, clerkProfile }
 * @returns {Object} - { adminProfileId, clerkId, sessionAdmin }
 */
function resolveAdminAndClerkIds({ sessionAdmin, adminProfile, clerkProfile }) {
    const adminProfileResolved = sessionAdmin
        || (typeof getCurrentAdmin === 'function' ? getCurrentAdmin() : null)
        || adminProfile
        || null;

    const adminProfileId = adminProfileResolved?.id
        || adminProfileResolved?.user_id
        || adminProfileResolved?.uuid
        || adminProfileResolved?.institution_user_id
        || null;

    const clerk = typeof getCurrentClerk === 'function' ? getCurrentClerk() : clerkProfile;
    const clerkId = clerk?.id
        || clerk?.user_id
        || clerk?.uuid
        || clerk?.institution_user_id
        || null;

    return { adminProfileId, clerkId, sessionAdmin };
}

// ============================================================================

function evaluateCartAllergy(cartItems, allergyPolicyByKey) {
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
        return { level: 'none', reasons: [] };
    }
    const reasons = [];
    cartItems.forEach(item => {
        const product = item || {};
        const productName = product.name || 'Ukendt vare';
        const productAllergens = Array.isArray(product.allergens) ? product.allergens : [];
        productAllergens.forEach(allergenKey => {
            const policy = allergyPolicyByKey[allergenKey];
            if (!policy || policy === 'allow') return;
            reasons.push({ allergen: allergenKey, policy, productName });
        });
    });
    if (reasons.some(r => r.policy === 'block')) return { level: 'block', reasons };
    if (reasons.some(r => r.policy === 'warn')) return { level: 'warn', reasons };
    return { level: 'none', reasons };
}

function prettyAllergenName(key) {
    switch (key) {
        case 'peanuts': return 'jordnødder';
        case 'tree_nuts': return 'trænødder';
        case 'milk': return 'mælk';
        case 'egg': return 'æg';
        case 'gluten': return 'gluten';
        case 'fish': return 'fisk';
        case 'shellfish': return 'skaldyr';
        case 'sesame': return 'sesam';
        case 'soy': return 'soja';
        default: return key;
    }
}


function groupAllergyReasons(reasons) {
    const map = new Map();
    reasons.forEach(r => {
        const name = prettyAllergenName(r.allergen);
        if (!map.has(name)) map.set(name, new Set());
        map.get(name).add(r.productName);
    });
    return Array.from(map.entries()).map(([allergen, products]) =>
        `• ${allergen}: ${Array.from(products).join(', ')}`
    ).join('<br>');
}

// Hent allergipolitik fra Supabase for et barn
async function fetchAllergyPolicyForChild(childId, institutionId) {
    if (!childId) {
        console.warn('[allergies] fetchAllergyPolicyForChild called without childId');
        return {};
    }

    console.log('[allergies] fetchAllergyPolicyForChild → start', { childId, institutionId });

    try {
        let query = supabaseClient
            .from('child_allergen_settings')
            .select('allergen, policy')
            .eq('child_id', childId);

        if (institutionId) {
            query = query.eq('institution_id', institutionId);
        }

        const { data, error } = await query;

        console.log('[allergies] fetchAllergyPolicyForChild → raw result', { data, error });

        if (error) {
            console.warn('[allergies] failed to load allergy policy from Supabase', error);
            return {};
        }

        const policy = {};
        (data || []).forEach(row => {
            if (!row || !row.allergen) return;
            const key = row.allergen;
            const value = row.policy || 'allow';
            policy[key] = value;
        });

        console.log('[allergies] loaded policy for child', childId, policy);
        return policy;
    } catch (err) {
        console.warn('[allergies] unexpected error while loading allergy policy', err);
        return {};
    }
}

async function fetchProductAllergensMap(productIds) {
    if (!Array.isArray(productIds) || productIds.length === 0) return {};
    const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));
    if (uniqueIds.length === 0) return {};
    const { data, error } = await supabaseClient
        .from('product_allergens')
        .select('product_id, allergen')
        .in('product_id', uniqueIds);
    if (error) {
        console.warn('[allergies] failed to load product allergens', error);
        return {};
    }
    const map = {};
    (data || []).forEach(row => {
        if (!row.product_id || !row.allergen) return;
        if (!map[row.product_id]) map[row.product_id] = [];
        map[row.product_id].push(row.allergen);
    });
    return map;
}

export async function enforceSugarPolicy({ customer, currentOrder, allProducts }) {
    // Load institution sugar policy settings
    const { data: institution } = await supabaseClient
        .from('institutions')
        .select('sugar_policy_enabled, sugar_policy_max_unhealthy_per_day, sugar_policy_max_per_product_per_day, sugar_policy_max_unhealthy_enabled, sugar_policy_max_per_product_enabled')
        .eq('id', customer.institution_id)
        .single();

    if (!institution?.sugar_policy_enabled) {
        return true; // Policy not enabled, allow purchase
    }

    // Get unhealthy items in current cart
    const unhealthyItemsInCart = currentOrder.filter(item => {
        const product = allProducts.find(p => p.id === item.id);
        return product && product.unhealthy === true;
    });

    if (unhealthyItemsInCart.length === 0) {
        return true; // No unhealthy items, allow purchase
    }

    const maxUnhealthyEnabled = institution.sugar_policy_max_unhealthy_enabled || false;
    const maxPerProductEnabled = institution.sugar_policy_max_per_product_enabled !== false; // default true

    // Hvis ingen af begrænsningerne er aktiveret, tillad køb
    if (!maxUnhealthyEnabled && !maxPerProductEnabled) {
        return true;
    }

    // Query today's purchases for this customer
    const today = new Date().toISOString().split('T')[0];
    const { data: todaySales } = await supabaseClient
        .from('sales_items')
        .select(`
            product_id,
            quantity,
            sales!inner(customer_id, created_at)
        `)
        .eq('sales.customer_id', customer.id)
        .gte('sales.created_at', `${today}T00:00:00`)
        .lte('sales.created_at', `${today}T23:59:59`);

    // Filter to only unhealthy products
    const unhealthyProductIds = new Set(allProducts.filter(p => p.unhealthy).map(p => p.id));
    const boughtUnhealthy = (todaySales || []).filter(item => unhealthyProductIds.has(item.product_id));

    // Check total unhealthy limit (kun hvis enabled)
    if (maxUnhealthyEnabled) {
        const totalUnhealthyToday = boughtUnhealthy.reduce((sum, item) => sum + (item.quantity || 1), 0);
        const totalUnhealthyInCart = unhealthyItemsInCart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        const maxUnhealthy = institution.sugar_policy_max_unhealthy_per_day || 2;

        if (totalUnhealthyToday + totalUnhealthyInCart > maxUnhealthy) {
            await showCustomAlert(
                'Køb Blokeret',
                `Hov, ${customer.name} har allerede købt <strong>${totalUnhealthyToday}</strong> usunde varer i dag.<br><br>Maks antal usunde produkter per dag: <strong>${maxUnhealthy}</strong>`
            );
            return false;
        }
    }

    // Check per-product limit (kun hvis enabled)
    if (maxPerProductEnabled) {
        const maxPerProduct = institution.sugar_policy_max_per_product_per_day || 1;
        const boughtByProductId = {};
        boughtUnhealthy.forEach(item => {
            const id = item.product_id;
            boughtByProductId[id] = (boughtByProductId[id] || 0) + (item.quantity || 1);
        });

        for (const cartItem of unhealthyItemsInCart) {
            const productId = cartItem.id;
            const boughtCount = boughtByProductId[productId] || 0;
            const cartCount = cartItem.quantity || 1;

            if (boughtCount + cartCount > maxPerProduct) {
                const product = allProducts.find(p => p.id === productId);
                await showCustomAlert(
                    'Køb Blokeret',
                    `Hov, ${customer.name} har allerede købt <strong>${product?.name || 'denne vare'}</strong> ${boughtCount} gang(e) i dag.<br><br>Maks antal af hver usund vare per dag: <strong>${maxPerProduct}</strong>`
                );
                return false;
            }
        }
    }

    return true; // All checks passed
}

export async function handleCompletePurchase({
    customer,
    currentOrder,
    setCurrentOrder,
    allProducts,
    updateSelectedUserInfo,
    orderList,
    totalPriceEl,
    clerkProfile,
    adminProfile,
    incrementSessionSalesCount,
    completePurchaseBtn,
    refreshProductLocks,
}) {
    if (!customer) return showAlert("Fejl: Vælg venligst en kunde!");
    if (currentOrder.length === 0) return showAlert("Fejl: Indkøbskurven er tom!");
    // === ALLERGI-CHECK ===
    let allergyPolicy = customer?.allergyPolicy;

    // Hvis der ikke er nogen politik endnu, eller det bare er et tomt objekt, henter vi fra Supabase
    const isEmptyPolicy =
        !allergyPolicy ||
        (typeof allergyPolicy === 'object' && Object.keys(allergyPolicy).length === 0);

    // OPTIMERING: Parallelize allergi-checks for 100-200ms speedup
    const productIdsInOrder = currentOrder.map(item => item.product_id || item.productId || item.id).filter(Boolean);

    const [fetchedAllergyPolicy, productAllergenMap] = await Promise.all([
        isEmptyPolicy ? fetchAllergyPolicyForChild(customer.id, customer.institution_id) : Promise.resolve(allergyPolicy),
        fetchProductAllergensMap(productIdsInOrder)
    ]);

    if (isEmptyPolicy) {
        allergyPolicy = fetchedAllergyPolicy;
        customer.allergyPolicy = allergyPolicy;
    }

    console.log('[allergies] effective allergyPolicy for', customer.name, allergyPolicy);

    // OPTIMERING: Brug helper funktion til at berige ordrelinjer med allergener
    const orderWithAllergens = enrichOrderWithAllergens(currentOrder, allProducts, productAllergenMap);

    console.log('[allergies] policy for', customer.name, allergyPolicy);
    console.log('[allergies] orderWithAllergens', orderWithAllergens);

    const allergyResult = evaluateCartAllergy(orderWithAllergens, allergyPolicy);
    console.log('[allergies] evaluation result', allergyResult);

    if (allergyResult.level === 'block') {
        const details = groupAllergyReasons(allergyResult.reasons);
        await showCustomAlert(
            'Køb Blokeret (Allergi)',
            `Hov, ${customer.name} må ikke købe disse varer pga. registrerede allergier:<br><br>${details}<br><br>Ret venligst kurven eller vælg andre varer.`
        );
        return;
    }

    if (allergyResult.level === 'warn') {
        const details = groupAllergyReasons(allergyResult.reasons);
        const confirmedAllergy = await showCustomAlert(
            'Allergi-advarsel',
            `OBS: Der er registreret allergier/advarsler for ${customer.name}:<br><br>${details}<br><br>Vil du gennemføre købet alligevel?`,
            'confirm'
        );
        if (!confirmedAllergy) {
            return;
        }
    }
    // === SLUT ALLERGI-CHECK ===
    let evaluation = null;
    try {
        setOrder(currentOrder);
        const shadowOrder = getOrder();
        console.log('[order-store] shadow sync:', {
            currentOrderLength: currentOrder.length,
            shadowOrderLength: Array.isArray(shadowOrder) ? shadowOrder.length : 'n/a',
        });
    } catch (err) {
        console.warn('[order-store] shadow sync failed:', err);
    }
    {
        const purchaseInput = {
            customer,
            currentBalance: customer?.balance ?? null,
            orderItems: currentOrder,
            products: allProducts,
            maxOverdraft: OVERDRAFT_LIMIT,
        };
        evaluation = evaluatePurchase(purchaseInput);
        console.log('[cafe-session] evaluatePurchase result:', evaluation);
    }

    const sugarOk = await enforceSugarPolicy({ customer, currentOrder, allProducts });
    if (!sugarOk) return;

    try {
        const childId = customer.id;

        // Parallel validation checks for all items (much faster than sequential)
        const checkPromises = currentOrder.map(async (line) => {
            const productId = line.product_id || line.productId || line.id;
            const product = allProducts.find(p => p.id === productId);
            if (!productId) return { allowed: true };

            return await canChildPurchase(
                productId,
                childId,
                currentOrder,
                customer.institution_id,
                product?.name,
                true // final checkout: undgå dobbelt-tælling af kurven
            );
        });

        const results = await Promise.all(checkPromises);

        // Check if any validation failed
        const failedCheck = results.find(result => result && result.allowed === false);
        if (failedCheck) {
            const message = failedCheck.message || 'Det her køb er ikke tilladt lige nu. Tal med en voksen i caféen.';
            await showCustomAlert('Køb ikke tilladt', message);
            return;
        }
    } catch (err) {
        console.warn('[canChildPurchase] Uventet fejl, tillader køb som fallback:', err);
    }

    const legacyTotal = getOrderTotal();
    if (evaluation && typeof evaluation.total === 'number') {
        try {
            const diff = Math.abs(legacyTotal - evaluation.total);
            if (diff > 0.01) {
                console.log('[cafe-session] TOTAL MISMATCH:', {
                    legacyTotal,
                    evaluatePurchaseTotal: evaluation.total,
                });
            }
        } catch (err) {
            console.warn('[cafe-session] total comparison failed:', err);
        }
    }
    let finalTotal = legacyTotal;
    try {
        const evalTotal = evaluation?.total;
        const evalIsValid = typeof evalTotal === 'number' && Number.isFinite(evalTotal);
        const evalIsNonNegative = evalIsValid && evalTotal >= 0;
        const evalCloseToLegacy = evalIsValid && Math.abs(evalTotal - legacyTotal) <= 0.01;
        if (evalIsValid && evalIsNonNegative && evalCloseToLegacy) {
            finalTotal = evalTotal;
        } else {
            console.log('[cafe-session] Using legacy total (fallback). Reason:', {
                evalIsValid,
                evalIsNonNegative,
                evalCloseToLegacy,
                legacyTotal,
                evaluatePurchaseTotal: evalTotal,
            });
        }
    } catch (err) {
        console.warn('[cafe-session] finalTotal selection failed, using legacy total:', err);
    }

    // Tjek om dette er et gratis admin-køb (SKAL ske før finansiel evaluering)
    const isAdminCustomer = customer?.role === 'admin';
    const adminsPurchaseFree = window.__flangoInstitutionSettings?.adminsPurchaseFree || false;
    const shouldBeFreePurchase = isAdminCustomer && adminsPurchaseFree;

    // Hvis admin skal købe gratis, sæt finalTotal til 0
    if (shouldBeFreePurchase) {
        finalTotal = 0;
        console.log('[purchase-flow] Admin gratis-køb aktiveret - finalTotal sat til 0');
    }

    applyEvaluation(evaluation);
    const finance = getFinancialState(finalTotal);
    const newBalance = Number.isFinite(finance.newBalance) ? finance.newBalance : customer.balance - finalTotal;

    // Load institution policy settings
    const { data: institutionSettings } = await supabaseClient
        .from('institutions')
        .select(`
            balance_limit_enabled,
            balance_limit_amount,
            balance_limit_exempt_admins,
            balance_limit_exempt_test_users,
            spending_limit_enabled,
            spending_limit_amount,
            spending_limit_applies_to_regular_users,
            spending_limit_applies_to_admins,
            spending_limit_applies_to_test_users
        `)
        .eq('id', customer.institution_id)
        .single();

    // === SPENDING LIMIT CHECK ===
    if (institutionSettings?.spending_limit_enabled) {
        const isAdmin = customer.role === 'admin' || customer.is_admin === true;
        const isTestUser = customer.is_test_user === true;
        const isRegularUser = !isAdmin && !isTestUser;

        const appliesToUser = (isRegularUser && institutionSettings.spending_limit_applies_to_regular_users) ||
                              (isAdmin && institutionSettings.spending_limit_applies_to_admins) ||
                              (isTestUser && institutionSettings.spending_limit_applies_to_test_users);

        if (appliesToUser) {
            const today = new Date().toISOString().split('T')[0];
            const { data: todayPurchases } = await supabaseClient
                .from('sales')
                .select('total_price')
                .eq('customer_id', customer.id)
                .gte('created_at', `${today}T00:00:00`)
                .lte('created_at', `${today}T23:59:59`);

            const spentToday = (todayPurchases || []).reduce((sum, sale) => sum + (sale.total_price || 0), 0);
            const spendingLimit = institutionSettings.spending_limit_amount || 40;
            const wouldSpend = spentToday + finalTotal;

            if (wouldSpend > spendingLimit) {
                const remaining = Math.max(0, spendingLimit - spentToday);
                const errorMessage = `Du har nået din daglige forbrugsgrænse!<br>Grænse: <strong>${spendingLimit.toFixed(2)} kr.</strong><br>Brugt i dag: <strong>${spentToday.toFixed(2)} kr.</strong><br>Tilbage: <strong>${remaining.toFixed(2)} kr.</strong><br><br>Prøv igen i morgen!`;
                return showCustomAlert('Køb Afvist', errorMessage);
            }
        }
    }

    // === BALANCE LIMIT CHECK ===
    if (institutionSettings?.balance_limit_enabled !== false) {
        const isAdmin = customer.role === 'admin' || customer.is_admin === true;
        const isTestUser = customer.is_test_user === true;
        const isExempt = (isAdmin && institutionSettings?.balance_limit_exempt_admins) ||
                         (isTestUser && institutionSettings?.balance_limit_exempt_test_users);

        if (!isExempt) {
            const balanceLimit = institutionSettings?.balance_limit_amount ?? OVERDRAFT_LIMIT;
            if (newBalance < balanceLimit) {
                const available = customer.balance - balanceLimit;
                const errorMessage = `Der er ikke penge nok på kontoen til dette køb!<br>Du har <strong>${available.toFixed(2)} kr.</strong> tilbage, før du rammer ${balanceLimit} kr. grænsen.<br><br>Husk at bede dine forældre pænt om at overføre.`;
                return showCustomAlert('Køb Afvist', errorMessage);
            }
        }
    }

    // OPTIMERING: Brug helper funktion til at bygge bekræftelsesdialog
    const confirmationBody = buildConfirmationUI(customer, currentOrder, finalTotal, newBalance);
    const confirmed = await showCustomAlert('Bekræft Køb', confirmationBody, 'confirm');
    if (!confirmed) return;

    // OPTIMERING: Brug helper funktion til at sætte knap state
    setButtonLoadingState(completePurchaseBtn, 'loading');

    // Grupper items til database payload (bruger shouldBeFreePurchase fra tidligere)
    const itemCounts = groupOrderItems(currentOrder);
    const cartItemsForDB = Object.values(itemCounts).map(item => ({
        product_id: item.id,
        quantity: item.count,
        // Hvis admin skal købe gratis, sæt pris til 0. Ellers brug effektiv pris eller normal pris.
        price: shouldBeFreePurchase ? 0 : (item._effectivePrice ?? item.price),
        is_refill: item._isRefill || false, // Marker hvis det er et refill-køb
        product_name: item._effectiveName || item.name // Gem effektivt navn (fx "Saft Refill")
    }));

    // OPTIMERING: Brug helper funktion til at resolve admin og clerk IDs
    const sessionAdmin = getCurrentSessionAdmin?.() || null;
    const { adminProfileId, clerkId } = resolveAdminAndClerkIds({
        sessionAdmin,
        adminProfile,
        clerkProfile
    });
    const salePayload = {
        p_customer_id: customer.id,
        p_cart_items: cartItemsForDB,
        p_session_admin_id: sessionAdmin?.id || null,
        p_session_admin_name: sessionAdmin?.name || null,
    };
    if (adminProfileId) {
        salePayload.p_admin_profile_id = adminProfileId;
    }
    if (clerkId) {
        salePayload.p_clerk_id = clerkId;
    }
    const { error } = await supabaseClient.rpc('process_sale', salePayload);
    if (error) {
        showAlert('Database Fejl: ' + error.message);
        setButtonLoadingState(completePurchaseBtn, 'normal');
    } else {
        // Purchase successful - invalidate cache to ensure fresh data
        invalidateTodaysSalesCache();

        if (typeof incrementSessionSalesCount === 'function') {
            incrementSessionSalesCount();
        }
        playSound('purchase');
        const appliedBalance = Number.isFinite(newBalance) ? newBalance : customer.balance - finalTotal;
        updateCustomerBalanceGlobally(customer.id, appliedBalance, -finalTotal, 'purchase');
        let nextOrder = clearOrder();
        try {
            setOrder(nextOrder);
        } catch (err) {
            console.warn('[order-store] sync failed after currentOrder mutation:', err);
        }
        if (typeof setCurrentOrder === 'function') {
            setCurrentOrder(nextOrder);
        }
        clearCurrentCustomer();
        renderOrder(orderList, nextOrder, totalPriceEl, updateSelectedUserInfo);
        if (typeof refreshProductLocks === 'function') {
            refreshProductLocks();
        }
        const selectedUserInfo = document.getElementById('selected-user-info');
        if (selectedUserInfo) selectedUserInfo.style.display = 'none';
        setButtonLoadingState(completePurchaseBtn, 'normal');
    }
}

export async function handleUndoLastSale() {
    const confirmed = await showCustomAlert('Fortryd Sidste Køb', 'Er du sikker på, du vil fortryde det seneste salg? Handlingen kan ikke omgøres.', 'confirm');
    if (!confirmed) return;
    const { data, error } = await supabaseClient.rpc('undo_last_sale');
    if (error) {
        showAlert('Fejl ved fortrydelse: ' + error.message);
    } else {
        const result = data[0];
        await showCustomAlert('Success!', `Salget for ${result.customer_name} på ${result.refunded_amount.toFixed(2)} kr. er blevet fortrudt.`);

        // Refresh balance from DB instead of full reload
        await refreshCustomerBalanceFromDB(result.customer_id);

        // Invalidate today's sales cache and refresh order UI
        invalidateTodaysSalesCache();
        if (typeof setCurrentOrder === 'function') {
            setCurrentOrder([]);
        }
        const orderList = document.querySelector('.order-list');
        const totalPriceEl = document.getElementById('total-price');
        const updateSelectedUserInfo = window.updateSelectedUserInfo;
        if (orderList && totalPriceEl) {
            renderOrder(orderList, [], totalPriceEl, updateSelectedUserInfo);
        }
    }
}

export function handleUndoPreviousSale() {
    showAlert('Avanceret fortrydelse er på vej.');
}
