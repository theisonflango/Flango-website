import { showAlert, showCustomAlert, playSound } from '../ui/sound-and-alerts.js?v=3.0.81';
import { logDebugEvent } from '../core/debug-flight-recorder.js?v=3.0.81';
import { supabaseClient } from '../core/config-and-supabase.js?v=3.0.81';
import { runWithAuthRetry } from '../core/auth-retry.js?v=3.0.81';
import { OVERDRAFT_LIMIT } from '../core/constants.js?v=3.0.81';
import { setOrder, getOrder, clearOrder, getOrderTotal } from './order-store.js?v=3.0.81';
import { evaluatePurchase } from './cafe-session.js?v=3.0.81';
import {
    applyEvaluation,
    getFinancialState,
    clearCurrentCustomer,
} from './cafe-session-store.js?v=3.0.81';
import { renderOrder } from './order-ui.js?v=3.0.81';
import { getProductIconInfo, getBulkDiscountedUnitPrice, getBulkDiscountSummary } from './products-and-cart.js?v=3.0.81';
import { canChildPurchase, invalidateAllLimitCaches, getTodaysTotalSpendForChild, getChildSugarPolicySnapshot } from './purchase-limits.js?v=3.0.81';
import { getCurrentSessionAdmin, getCurrentClerk } from './session-store.js?v=3.0.81';
import { updateCustomerBalanceGlobally, refreshCustomerBalanceFromDB } from '../core/balance-manager.js?v=3.0.81';
import { escapeHtml } from '../core/escape-html.js?v=3.0.81';
import { formatKr } from '../ui/confirm-modals.js?v=3.0.81';
import { getProfilePictureUrl, resolveAvatarSource } from '../core/profile-picture-cache.js?v=3.0.81';
import { processEventItemsInCheckout } from '../ui/cafe-event-strip.js?v=3.0.81';


// ============================================================================
// HELPER FUNKTIONER FOR handleCompletePurchase (OPT-6)
// ============================================================================

// ---- Phase helpers (split fra handleCompletePurchase) ----

/**
 * Synkronisér currentOrder med order-store ved mismatch.
 * Returnerer det effektive orderSnapshot.
 */
function syncOrderSnapshot(currentOrder, setCurrentOrder) {
    const orderFromStore = typeof getOrder === 'function' ? getOrder() : [];
    const effectiveOrder = (Array.isArray(currentOrder) && currentOrder.length > 0) ? currentOrder : orderFromStore;
    const orderSnapshot = Array.isArray(effectiveOrder) ? [...effectiveOrder] : [];

    if (typeof setCurrentOrder === 'function' && (!Array.isArray(currentOrder) || currentOrder.length === 0) && orderFromStore.length > 0) {
        setCurrentOrder([...orderFromStore]);
    }
    return orderSnapshot;
}

/**
 * Allergi-check: hent policy, evaluer kurv, vis blokering/advarsel.
 * Returnerer false hvis købet skal afbrydes.
 */
async function enforceAllergyChecks(customer, orderSnapshot, allProducts) {
    let allergyPolicy = customer?.allergyPolicy;
    const isEmptyPolicy =
        !allergyPolicy ||
        (typeof allergyPolicy === 'object' && Object.keys(allergyPolicy).length === 0);

    const productIdsInOrder = orderSnapshot.map(item => item.product_id || item.productId || item.id).filter(Boolean);

    const [fetchedAllergyPolicy, productAllergenMap] = await Promise.all([
        isEmptyPolicy ? fetchAllergyPolicyForChild(customer.id, customer.institution_id) : Promise.resolve(allergyPolicy),
        fetchProductAllergensMap(productIdsInOrder)
    ]);

    if (isEmptyPolicy) {
        allergyPolicy = fetchedAllergyPolicy;
        customer.allergyPolicy = allergyPolicy;
    }

    const orderWithAllergens = enrichOrderWithAllergens(orderSnapshot, allProducts, productAllergenMap);
    const allergyResult = evaluateCartAllergy(orderWithAllergens, allergyPolicy);

    if (allergyResult.level === 'block') {
        const details = groupAllergyReasons(allergyResult.reasons);
        await showCustomAlert(
            'Køb Blokeret (Allergi)',
            `Hov, ${escapeHtml(customer.name)} må ikke købe disse varer pga. registrerede allergier:<br><br>${details}<br><br>Ret venligst kurven eller vælg andre varer.`
        );
        return false;
    }

    if (allergyResult.level === 'warn') {
        const details = groupAllergyReasons(allergyResult.reasons);
        const confirmedAllergy = await showCustomAlert(
            'Allergi-advarsel',
            `OBS: Der er registreret allergier/advarsler for ${escapeHtml(customer.name)}:<br><br>${details}<br><br>Vil du gennemføre købet alligevel?`,
            'confirm'
        );
        if (!confirmedAllergy) return false;
    }
    return true;
}

/**
 * Parallel validering af produktgrænser (canChildPurchase) med retry.
 * Returnerer false hvis købet skal afbrydes.
 */
async function validateProductLimits(customer, orderSnapshot, allProducts) {
    const childId = customer.id;

    const checkPromises = orderSnapshot.map(async (line) => {
        if (line.is_calculator_item) return { allowed: true };
        const productId = line.product_id || line.productId || line.id;
        const product = allProducts.find(p => p.id === productId);
        if (!productId) return { allowed: true };

        let lastError = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                return await canChildPurchase(
                    productId, childId, orderSnapshot,
                    customer.institution_id, product?.name, true
                );
            } catch (err) {
                lastError = err;
                const isTransientError = err?.message?.includes('network') ||
                                         err?.message?.includes('timeout') ||
                                         err?.message?.includes('fetch');
                if (attempt === 0 && isTransientError) {
                    console.warn('[canChildPurchase] Transient fejl, prøver igen:', productId, err);
                    await new Promise(resolve => setTimeout(resolve, 100));
                    continue;
                }
                throw err;
            }
        }
        throw lastError;
    });

    const results = await Promise.all(checkPromises);
    const failedCheck = results.find(result => result && result.allowed === false);
    if (failedCheck) {
        await showCustomAlert('Køb ikke tilladt',
            failedCheck.message || 'Det her køb er ikke tilladt lige nu. Tal med en voksen i caféen.');
        return false;
    }
    return true;
}

/**
 * Beregn finalTotal ud fra evaluation og legacy total. Håndterer admin gratis-køb.
 * Returnerer { finalTotal, shouldBeFreePurchase }.
 */
function calculateFinalTotal(evaluation, customer) {
    const legacyTotal = getOrderTotal();
    let finalTotal = legacyTotal;

    if (evaluation && typeof evaluation.total === 'number') {
        const diff = Math.abs(legacyTotal - evaluation.total);
        if (diff > 0.01) {
            console.log('[cafe-session] TOTAL MISMATCH:', { legacyTotal, evaluatePurchaseTotal: evaluation.total });
        }
    }

    try {
        const evalTotal = evaluation?.total;
        const evalIsValid = typeof evalTotal === 'number' && Number.isFinite(evalTotal);
        const evalIsNonNegative = evalIsValid && evalTotal >= 0;
        const evalCloseToLegacy = evalIsValid && Math.abs(evalTotal - legacyTotal) <= 0.01;
        if (evalIsValid && evalIsNonNegative && evalCloseToLegacy) {
            finalTotal = evalTotal;
        } else {
            console.log('[cafe-session] Using legacy total (fallback). Reason:', {
                evalIsValid, evalIsNonNegative, evalCloseToLegacy, legacyTotal, evaluatePurchaseTotal: evalTotal,
            });
        }
    } catch (err) {
        console.warn('[cafe-session] finalTotal selection failed, using legacy total:', err);
    }

    const isAdminCustomer = customer?.role === 'admin';
    const shouldBeFreePurchase = isAdminCustomer && customer?.purchase_free === true;
    if (shouldBeFreePurchase) {
        finalTotal = 0;
        console.log('[purchase-flow] Admin gratis-køb aktiveret - finalTotal sat til 0');
    }

    return { finalTotal, shouldBeFreePurchase };
}

/**
 * Hent institutionsindstillinger og håndhæv forbrugs- og saldogrænser.
 * Returnerer false hvis købet skal afbrydes.
 */
async function enforceInstitutionLimits(customer, finalTotal, newBalance) {
    let institutionSettings = typeof window !== 'undefined' && typeof window.__flangoGetInstitutionById === 'function'
        ? window.__flangoGetInstitutionById(customer.institution_id)
        : null;

    if (!institutionSettings) {
        const { data } = await supabaseClient
            .from('institutions')
            .select(`
                balance_limit_enabled, balance_limit_amount,
                balance_limit_exempt_admins, balance_limit_exempt_test_users,
                spending_limit_enabled, spending_limit_amount,
                spending_limit_applies_to_regular_users,
                spending_limit_applies_to_admins,
                spending_limit_applies_to_test_users
            `)
            .eq('id', customer.institution_id)
            .single();
        institutionSettings = data;
    }

    // Spending limit check
    if (institutionSettings?.spending_limit_enabled) {
        const isAdmin = customer.role === 'admin' || customer.is_admin === true;
        const isTestUser = customer.is_test_user === true;
        const isRegularUser = !isAdmin && !isTestUser;

        const appliesToUser = (isRegularUser && institutionSettings.spending_limit_applies_to_regular_users) ||
                              (isAdmin && institutionSettings.spending_limit_applies_to_admins) ||
                              (isTestUser && institutionSettings.spending_limit_applies_to_test_users);

        if (appliesToUser) {
            const spentToday = await getTodaysTotalSpendForChild(customer.id, customer.institution_id);
            const spendingLimit = institutionSettings.spending_limit_amount || 40;
            if (spentToday + finalTotal > spendingLimit) {
                const remaining = Math.max(0, spendingLimit - spentToday);
                await showCustomAlert('Køb Afvist',
                    `Du har nået din daglige forbrugsgrænse!<br>Grænse: <strong>${spendingLimit.toFixed(2)} kr.</strong><br>Brugt i dag: <strong>${spentToday.toFixed(2)} kr.</strong><br>Tilbage: <strong>${remaining.toFixed(2)} kr.</strong><br><br>Prøv igen i morgen!`);
                return false;
            }
        }
    }

    // Balance limit check
    if (institutionSettings?.balance_limit_enabled !== false) {
        const isAdmin = customer.role === 'admin' || customer.is_admin === true;
        const isTestUser = customer.is_test_user === true;
        const isExempt = (isAdmin && institutionSettings?.balance_limit_exempt_admins) ||
                         (isTestUser && institutionSettings?.balance_limit_exempt_test_users);

        if (!isExempt) {
            const balanceLimit = institutionSettings?.balance_limit_amount ?? OVERDRAFT_LIMIT;
            if (newBalance < balanceLimit) {
                const available = customer.balance - balanceLimit;
                await showCustomAlert('Køb Afvist',
                    `Der er ikke penge nok på kontoen til dette køb!<br>Du har <strong>${available.toFixed(2)} kr.</strong> tilbage, før du rammer ${balanceLimit} kr. grænsen.<br><br>Husk at bede dine forældre pænt om at overføre.`);
                return false;
            }
        }
    }

    return true;
}

/**
 * Vis bekræftelsesmodal, vedhæft event listeners, vent på brugerens svar.
 * Returnerer null hvis annulleret, ellers { selectedTableNumber, kitchenNoteText, itemExtras }.
 */
async function showConfirmationAndCollectInput(customer, orderSnapshot, finalTotal, newBalance, shouldBeFreePurchase, restaurantMode, clerkProfile) {
    logDebugEvent('confirmation_modal_building', {
        cartLength: orderSnapshot?.length,
        cartItemNames: orderSnapshot?.slice(0, 5).map(i => i.name),
        orderStoreLength: typeof getOrder === 'function' ? getOrder()?.length : 'N/A',
        finalTotal, newBalance,
    });

    const confirmationBody = buildConfirmationUI(customer, orderSnapshot, finalTotal, newBalance, shouldBeFreePurchase, restaurantMode, clerkProfile);
    logDebugEvent('confirmation_modal_showing', { bodyLength: confirmationBody?.length });

    const alertPromise = showCustomAlert('Bekræft Køb', confirmationBody, {
        type: 'confirm', okText: 'Bekræft Køb', cancelText: 'Annullér',
    });

    // Async profile picture load
    const imgStyle2 = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
    const avatarNode = document.getElementById('confirm-customer-avatar');
    if (avatarNode?.dataset.needsAsync === 'true') {
        getProfilePictureUrl(customer).then(url => {
            if (url && avatarNode.isConnected) {
                avatarNode.textContent = '';
                avatarNode.innerHTML = `<img src="${url}" alt="" style="${imgStyle2}">`;
            }
        });
    }
    const clerkAvatarNode = document.getElementById('confirm-clerk-avatar');
    if (clerkAvatarNode?.dataset.needsAsync === 'true' && clerkProfile) {
        getProfilePictureUrl(clerkProfile).then(url => {
            if (url && clerkAvatarNode.isConnected) {
                clerkAvatarNode.textContent = '';
                clerkAvatarNode.innerHTML = `<img src="${url}" alt="" style="${imgStyle2}">`;
            }
        });
    }

    // Re-attach bordknap click-handlers
    if (restaurantMode?.enabled && restaurantMode.tableNumbersEnabled) {
        document.querySelectorAll('#confirm-restaurant-section .confirm-table-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const wasSelected = btn.classList.contains('selected');
                const grid = btn.closest('.confirm-table-grid');
                if (grid) grid.querySelectorAll('.confirm-table-btn').forEach(b => b.classList.remove('selected'));
                if (!wasSelected) btn.classList.add('selected');
            });
        });
    }

    // Re-attach variant-badge + genbrug click-handlers
    if (restaurantMode?.enabled) {
        document.querySelectorAll('.confirm-item-extras').forEach(section => {
            section.querySelectorAll('.confirm-variant-badge').forEach(badge => {
                badge.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const wasSelected = badge.classList.contains('selected');
                    section.querySelectorAll('.confirm-variant-badge').forEach(b => b.classList.remove('selected'));
                    if (!wasSelected) badge.classList.add('selected');
                });
            });
        });
        document.getElementById('confirm-reuse-badge')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.target.classList.toggle('selected');
        });
    }

    const confirmed = await alertPromise;
    logDebugEvent('confirmation_modal_closed', { confirmed, cartLengthAfter: orderSnapshot?.length });
    if (!confirmed) return null;

    // Læs restaurant-info fra modal DOM
    let selectedTableNumber = null;
    let kitchenNoteText = null;
    let itemExtras = {};
    if (restaurantMode?.enabled) {
        const selectedBtn = document.querySelector('#confirm-restaurant-section .confirm-table-btn.selected');
        selectedTableNumber = selectedBtn?.dataset?.table || null;
        kitchenNoteText = document.querySelector('#confirm-kitchen-note')?.value?.trim() || null;

        document.querySelectorAll('.confirm-item-extras').forEach(section => {
            const prodId = section.dataset.productId;
            const selectedBadge = section.querySelector('.confirm-variant-badge.selected');
            const noteInput = section.querySelector('.confirm-item-note');
            itemExtras[prodId] = {
                variant: selectedBadge?.dataset?.variant || null,
                note: noteInput?.value?.trim() || null,
            };
        });

        const reuseSelected = document.getElementById('confirm-reuse-badge')?.classList.contains('selected');
        if (reuseSelected) {
            kitchenNoteText = kitchenNoteText ? `♻️ Genbrug · ${kitchenNoteText}` : '♻️ Genbrug';
        }
    }

    return { selectedTableNumber, kitchenNoteText, itemExtras };
}

/**
 * Byg cartItemsForDB array til process_sale RPC.
 */
function buildCartItemsForDB(orderSnapshot, shouldBeFreePurchase, itemExtras) {
    const itemCounts = groupOrderItems(orderSnapshot);
    return Object.values(itemCounts).map(item => {
        const effectiveUnitPrice = shouldBeFreePurchase
            ? 0
            : getBulkDiscountedUnitPrice(item, item.count, { disableDiscount: item.bulkDiscountDisabled === true });
        if (item.is_calculator_item) {
            return {
                product_id: item.quick_product_id || null,
                quantity: item.count,
                price: shouldBeFreePurchase ? 0 : item.price,
                is_refill: false,
                product_name: item.name,
                custom_price: item.price,
                custom_name: item.name,
                is_calculator_item: true,
            };
        }
        return {
            product_id: item.id,
            quantity: item.count,
            price: effectiveUnitPrice,
            is_refill: item._isRefill || false,
            product_name: item._effectiveName || item.name,
            item_variant: itemExtras[item.id]?.variant || null,
            item_note: itemExtras[item.id]?.note || null,
        };
    });
}

/**
 * Håndtér succesfuldt salg: saldoopdatering, cache-invalidering, UI-reset.
 */
async function handleSaleSuccess({
    customer, rpcData, finalTotal, newBalance, balanceUpdateNonce,
    eventItems, incrementSessionSalesCount, setCurrentOrder,
    orderList, totalPriceEl, updateSelectedUserInfo,
    refreshProductLocks, renderProductsFromCache, completePurchaseBtn,
}) {
    invalidateAllLimitCaches(customer.id);
    if (typeof incrementSessionSalesCount === 'function') incrementSessionSalesCount();
    window.dispatchEvent(new CustomEvent('flango:saleCompleted'));
    logDebugEvent('purchase_success', { customerId: customer?.id, finalTotal });
    playSound('purchase');

    const appliedBalance = Number.isFinite(newBalance) ? newBalance : customer.balance - finalTotal;

    // 1) Provisional optimistic update
    updateCustomerBalanceGlobally(customer.id, appliedBalance, -finalTotal, 'purchase-provisional', {
        status: 'provisional', nonce: balanceUpdateNonce,
    });

    // 2) Confirm against server state
    const rpcBalance = extractBalanceFromRpcData(rpcData);
    if (rpcBalance !== null) {
        updateCustomerBalanceGlobally(customer.id, rpcBalance, -finalTotal, 'purchase-confirmed-rpc', {
            status: 'confirmed', nonce: balanceUpdateNonce,
        });
        if (Math.abs(rpcBalance - appliedBalance) > 0.009) {
            console.warn('[purchase-flow] Balance mismatch (rpc vs provisional)', {
                provisional: appliedBalance, rpcBalance, nonce: balanceUpdateNonce,
            });
        }
    } else {
        const confirmedBalance = await refreshCustomerBalanceFromDB(customer.id, {
            status: 'confirmed', nonce: balanceUpdateNonce, retry: 1,
        });
        if (confirmedBalance !== null && Math.abs(confirmedBalance - appliedBalance) > 0.009) {
            console.warn('[purchase-flow] Balance mismatch after confirm', {
                provisional: appliedBalance, confirmed: confirmedBalance, nonce: balanceUpdateNonce,
            });
        } else if (confirmedBalance === null) {
            console.warn('[purchase-flow] Balance confirmation failed; UI remains on provisional', { nonce: balanceUpdateNonce });
        }
    }

    // Processér event-items EFTER normalvare-køb
    if (eventItems.length > 0) {
        logDebugEvent('purchase_event_items_after_normal', { eventCount: eventItems.length });
        await processEventItemsInCheckout(eventItems, customer);
    }

    // Ryd kurv og opdater UI
    let nextOrder = clearOrder();
    try { setOrder([...nextOrder]); } catch (err) { console.warn('[order-store] sync failed after purchase:', err); }
    if (typeof setCurrentOrder === 'function') setCurrentOrder(nextOrder);
    clearCurrentCustomer();
    renderOrder(orderList, nextOrder, totalPriceEl, updateSelectedUserInfo);
    if (typeof refreshProductLocks === 'function') await refreshProductLocks({ force: true });
    if (typeof renderProductsFromCache === 'function') renderProductsFromCache();
    setButtonLoadingState(completePurchaseBtn, 'normal');
}

// ---- End phase helpers ----

function extractBalanceFromRpcData(data) {
    if (data == null) return null;
    if (typeof data === 'number' && Number.isFinite(data)) return data;
    if (typeof data === 'string') {
        const n = Number(data.replace(',', '.'));
        return Number.isFinite(n) ? n : null;
    }
    if (Array.isArray(data) && data.length === 1) return extractBalanceFromRpcData(data[0]);
    if (typeof data === 'object') {
        const candidates = [
            'new_balance',
            'balance',
            'customer_balance',
            'updated_balance',
            'result_balance',
        ];
        for (const key of candidates) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                const val = data[key];
                if (typeof val === 'number' && Number.isFinite(val)) return val;
                if (typeof val === 'string') {
                    const n = Number(val.replace(',', '.'));
                    if (Number.isFinite(n)) return n;
                }
            }
        }
    }
    return null;
}

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
        const productId = item?.product_id || item?.productId || item?.id;
        if (productId == null) return acc;
        const key = String(productId);
        acc[key] = acc[key] || { ...item, id: productId, count: 0, bulkDiscountDisabled: false };
        const qty = Number.isFinite(item?.quantity) ? item.quantity : 1;
        acc[key].count += qty;
        if (item?._bulkDiscountDisabled === true) {
            acc[key].bulkDiscountDisabled = true;
        }
        return acc;
    }, {});
}

// ============================================================================
// CONFIRMATION UI BUILDERS (split fra buildConfirmationUI)
// ============================================================================

const IMG_STYLE = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';

function buildAvatar(user, size, inst) {
    const el = document.createElement('div');
    el.style.cssText = `width:${size}px;height:${size}px;min-width:${size}px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.28)}px;font-weight:700;box-shadow:0 4px 16px rgba(0,0,0,0.18);background:rgba(99,102,241,0.15);color:var(--text-primary,#fff);`;

    const src = resolveAvatarSource(user, inst);
    if (src.type === 'img') {
        el.innerHTML = `<img src="${src.value}" alt="" style="${IMG_STYLE}">`;
    } else if (src.type === 'async') {
        el.textContent = src.value;
        el.dataset.needsAsync = 'true';
        el.dataset.userId = user?.id;
    } else {
        el.textContent = src.value;
        if (src.value === '👤') el.style.fontSize = `${Math.round(size * 0.45)}px`;
    }
    return el;
}

function buildConfirmationHeader(customer, clerk, inst) {
    const header = document.createElement('div');
    header.className = 'confirm-modal-header';
    const peopleRow = document.createElement('div');
    peopleRow.style.cssText = 'display:flex;align-items:flex-start;justify-content:center;gap:24px;margin-bottom:8px;';

    if (clerk) {
        const clerkCol = document.createElement('div');
        clerkCol.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;flex:0 0 auto;';
        const clerkLabel = document.createElement('div');
        clerkLabel.style.cssText = 'font-size:11px;font-weight:600;color:var(--text-secondary,#64748b);text-transform:uppercase;letter-spacing:0.5px;';
        clerkLabel.textContent = 'Ekspedient';
        clerkCol.appendChild(clerkLabel);
        const clerkAvatar = buildAvatar(clerk, 180, inst);
        clerkAvatar.id = 'confirm-clerk-avatar';
        clerkCol.appendChild(clerkAvatar);
        const clerkName = document.createElement('div');
        clerkName.style.cssText = 'font-size:15px;font-weight:600;color:var(--text-primary,#334155);text-align:center;max-width:220px;word-break:break-word;';
        clerkName.textContent = clerk.name || '';
        clerkCol.appendChild(clerkName);
        peopleRow.appendChild(clerkCol);
    }

    const custCol = document.createElement('div');
    custCol.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;flex:0 0 auto;';
    const custLabel = document.createElement('div');
    custLabel.style.cssText = 'font-size:11px;font-weight:600;color:var(--text-secondary,#64748b);text-transform:uppercase;letter-spacing:0.5px;';
    custLabel.textContent = 'Kunde';
    custCol.appendChild(custLabel);

    const custAvatar = buildAvatar(customer, 180, inst);
    custAvatar.id = 'confirm-customer-avatar';
    const custAvatarWrap = document.createElement('div');
    custAvatarWrap.style.cssText = 'position:relative;display:inline-block;';
    custAvatarWrap.appendChild(custAvatar);

    const number = customer?.number ? String(customer.number) : '';
    if (number) {
        const badge = document.createElement('div');
        badge.style.cssText = 'position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);background:var(--primary-color,#1a8a6e);color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.15);';
        badge.textContent = `#${number}`;
        custAvatarWrap.appendChild(badge);
    }
    custCol.appendChild(custAvatarWrap);

    const custName = document.createElement('div');
    custName.style.cssText = 'font-size:15px;font-weight:600;color:var(--text-primary,#334155);text-align:center;max-width:220px;word-break:break-word;';
    custName.textContent = `${customer?.name || 'Ukendt'} k\u00f8ber:`;
    custCol.appendChild(custName);

    peopleRow.appendChild(custCol);
    header.appendChild(peopleRow);
    return header;
}

function buildConfirmationProducts(itemCounts, restaurantMode) {
    const container = document.createElement('div');
    container.className = 'confirm-modal-products';

    Object.values(itemCounts).forEach((item) => {
        const row = document.createElement('div');
        row.className = 'confirm-product-row';

        const iconWrap = document.createElement('span');
        iconWrap.className = 'cp-icon';
        const iconInfo = getProductIconInfo(item);
        if (iconInfo?.path) {
            const img = document.createElement('img');
            img.src = iconInfo.path;
            img.alt = item?.name || 'Produkt';
            iconWrap.appendChild(img);
        } else {
            iconWrap.textContent = item?.emoji || '\uD83D\uDED2';
        }
        row.appendChild(iconWrap);

        const info = document.createElement('div');
        info.className = 'cp-info';
        const name = document.createElement('div');
        name.className = 'cp-name';
        name.textContent = item.name || 'Ukendt';
        info.appendChild(name);
        const qty = document.createElement('div');
        qty.className = 'cp-qty';
        qty.textContent = `${item.count} stk.`;
        info.appendChild(qty);
        row.appendChild(info);

        const unitPrice = getBulkDiscountedUnitPrice(item, item.count, { disableDiscount: item.bulkDiscountDisabled === true });
        const lineTotal = unitPrice * item.count;
        const price = document.createElement('div');
        price.className = 'cp-price';
        price.textContent = formatKr(lineTotal);
        row.appendChild(price);

        container.appendChild(row);

        const summary = getBulkDiscountSummary(item, item.count, { disableDiscount: item.bulkDiscountDisabled === true });
        if (summary.discountAmount > 0) {
            const discountRow = document.createElement('div');
            discountRow.className = 'confirm-discount-row';
            const bundleLabel = summary.bundlePrice != null
                ? formatKr(summary.bundlePrice).replace(' kr', '')
                : '';
            const label = bundleLabel
                ? `\uD83C\uDFF7\uFE0F Rabat (${summary.qtyRule} for ${bundleLabel})`
                : '\uD83C\uDFF7\uFE0F Rabat';
            discountRow.textContent = `${label}: -${formatKr(summary.discountAmount)}`;
            container.appendChild(discountRow);
        }

        if (restaurantMode?.enabled) {
            const variants = item.restaurant_variants || [];
            const perItemSection = document.createElement('div');
            perItemSection.className = 'confirm-item-extras';
            perItemSection.dataset.productId = item.id;

            if (variants.length > 0) {
                const badgesWrap = document.createElement('div');
                badgesWrap.className = 'confirm-variant-badges';
                variants.forEach(v => {
                    const badge = document.createElement('button');
                    badge.type = 'button';
                    badge.className = 'confirm-variant-badge';
                    badge.textContent = v;
                    badge.dataset.variant = v;
                    badgesWrap.appendChild(badge);
                });
                perItemSection.appendChild(badgesWrap);
            }

            const noteInput = document.createElement('input');
            noteInput.type = 'text';
            noteInput.className = 'confirm-item-note';
            noteInput.dataset.productId = item.id;
            noteInput.placeholder = 'Note til dette produkt...';
            noteInput.maxLength = 100;
            perItemSection.appendChild(noteInput);

            row.insertBefore(perItemSection, price);
        }
    });

    return container;
}

function buildConfirmationSummary(customer, itemCounts, finalTotal, newBalance, isFreeAdminPurchase) {
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'confirm-modal-summary';

    if (isFreeAdminPurchase) {
        const normalTotal = Object.values(itemCounts).reduce((sum, item) => {
            const unitPrice = getBulkDiscountedUnitPrice(item, item.count, { disableDiscount: item.bulkDiscountDisabled === true });
            return sum + (unitPrice * item.count);
        }, 0);

        const freeBox = document.createElement('div');
        freeBox.className = 'admin-free-confirm-box';
        freeBox.innerHTML = '<span style="font-size: 20px;">&#x267E;</span><span>GRATIS ADMIN-K\u00D8B</span>';
        summaryDiv.appendChild(freeBox);

        const normalPriceRow = document.createElement('div');
        normalPriceRow.className = 'confirm-summary-row';
        normalPriceRow.innerHTML = `<span class="label">Normalpris</span><span class="value" style="text-decoration: line-through; color: #94a3b8;">${escapeHtml(formatKr(normalTotal))}</span>`;
        summaryDiv.appendChild(normalPriceRow);

        const balanceRow = document.createElement('div');
        balanceRow.className = 'confirm-summary-row';
        balanceRow.innerHTML = `<span class="label">Saldo (u\u00e6ndret)</span><span class="value">${escapeHtml(formatKr(customer.balance))}</span>`;
        summaryDiv.appendChild(balanceRow);
    } else {
        const totalRow = document.createElement('div');
        totalRow.className = 'confirm-summary-row total';
        totalRow.innerHTML = `<span class="label">Total</span><span class="value">${escapeHtml(formatKr(finalTotal))}</span>`;
        summaryDiv.appendChild(totalRow);

        const currentBalRow = document.createElement('div');
        currentBalRow.className = 'confirm-summary-row';
        currentBalRow.innerHTML = `<span class="label">Nuv\u00e6rende saldo</span><span class="value">${escapeHtml(formatKr(customer.balance))}</span>`;
        summaryDiv.appendChild(currentBalRow);

        const newBalClass = newBalance >= 0 ? 'positive' : 'negative';
        const newBalRow = document.createElement('div');
        newBalRow.className = 'confirm-summary-row';
        newBalRow.innerHTML = `<span class="label">Ny saldo</span><span class="value ${newBalClass}">${escapeHtml(formatKr(newBalance))}</span>`;
        summaryDiv.appendChild(newBalRow);

        if (newBalance < 0) {
            const warning = document.createElement('div');
            warning.className = 'confirm-negative-warning';
            warning.innerHTML = customer.balance < 0
                ? '<strong>Advarsel:</strong> Er du helt sikker p\u00e5, at du vil g\u00e5 endnu mere i minus?'
                : '<strong>Advarsel:</strong> Er du helt sikker p\u00e5, du vil g\u00e5 i minus?';
            summaryDiv.appendChild(warning);
        }
    }

    return summaryDiv;
}

function buildConfirmationRestaurantSection(restaurantMode) {
    const section = document.createElement('div');
    section.className = 'confirm-restaurant-section';
    section.id = 'confirm-restaurant-section';

    if (restaurantMode.tableNumbersEnabled) {
        const tableCount = Math.min(Math.max(restaurantMode.tableCount || 9, 1), 16);
        const label = document.createElement('div');
        label.className = 'confirm-restaurant-label';
        label.innerHTML = '\uD83C\uDF7D\uFE0F V\u00e6lg bord';
        section.appendChild(label);

        const grid = document.createElement('div');
        grid.className = 'confirm-table-grid';
        if (tableCount > 9) {
            const cols = Math.ceil(tableCount / 2);
            grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            grid.classList.add('confirm-table-grid-compact');
        }
        for (let i = 1; i <= tableCount; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'confirm-table-btn' + (tableCount > 9 ? ' compact' : '');
            btn.textContent = i;
            btn.dataset.table = i;
            grid.appendChild(btn);
        }
        section.appendChild(grid);
    }

    const reuseBadge = document.createElement('button');
    reuseBadge.type = 'button';
    reuseBadge.className = 'confirm-reuse-badge';
    reuseBadge.id = 'confirm-reuse-badge';
    reuseBadge.textContent = '\u267B\uFE0F Genbrug';
    reuseBadge.title = 'Mark\u00e9r at der bruges genbrugstallerkner/service';
    section.appendChild(reuseBadge);

    const noteLabel = document.createElement('div');
    noteLabel.className = 'confirm-restaurant-label';
    noteLabel.innerHTML = '\uD83D\uDCDD Kommentar til k\u00f8kken';
    section.appendChild(noteLabel);

    const note = document.createElement('textarea');
    note.className = 'confirm-kitchen-note';
    note.id = 'confirm-kitchen-note';
    note.maxLength = 200;
    note.rows = 2;
    note.placeholder = 'Valgfrit \u2014 fx "uden l\u00f8g", "allergiker" ...';
    section.appendChild(note);

    return section;
}

/**
 * Bygger bekræftelsesdialog UI — orchestrerer de 5 sektionsbyggere.
 */
function buildConfirmationUI(customer, currentOrder, finalTotal, newBalance, isFreeAdminPurchase = false, restaurantMode = null, clerk = null) {
    const itemCounts = groupOrderItems(currentOrder);
    const root = document.createElement('div');
    const inst = window.__flangoGetInstitutionById?.(customer?.institution_id);

    root.appendChild(buildConfirmationHeader(customer, clerk, inst));
    root.appendChild(buildConfirmationProducts(itemCounts, restaurantMode));
    root.appendChild(buildConfirmationSummary(customer, itemCounts, finalTotal, newBalance, isFreeAdminPurchase));
    if (restaurantMode?.enabled) {
        root.appendChild(buildConfirmationRestaurantSection(restaurantMode));
    }

    return root.innerHTML;
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

// ============================================================================
// PRODUCT ALLERGENS CACHE - undgår gentagne DB-kald (ændres sjældent)
// ============================================================================
const productAllergensCache = new Map(); // productId → allergens[]

async function fetchProductAllergensMap(productIds) {
    if (!Array.isArray(productIds) || productIds.length === 0) return {};
    const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));
    if (uniqueIds.length === 0) return {};

    // OPTIMERING: Check hvilke produkter vi allerede har cached
    const cachedResults = {};
    const uncachedIds = [];

    uniqueIds.forEach(id => {
        if (productAllergensCache.has(id)) {
            cachedResults[id] = productAllergensCache.get(id);
        } else {
            uncachedIds.push(id);
        }
    });

    // Hvis alle er cached, returner direkte (0 DB kald)
    if (uncachedIds.length === 0) {
        return cachedResults;
    }

    // Fetch kun de manglende
    const { data, error } = await supabaseClient
        .from('product_allergens')
        .select('product_id, allergen')
        .in('product_id', uncachedIds);

    if (error) {
        console.warn('[allergies] failed to load product allergens', error);
        return cachedResults; // Returner hvad vi har cached
    }

    // Byg map og cache resultaterne
    const fetchedMap = {};
    (data || []).forEach(row => {
        if (!row.product_id || !row.allergen) return;
        if (!fetchedMap[row.product_id]) fetchedMap[row.product_id] = [];
        fetchedMap[row.product_id].push(row.allergen);
    });

    // Cache alle hentede (inkl. produkter uden allergener)
    uncachedIds.forEach(id => {
        const allergens = fetchedMap[id] || [];
        productAllergensCache.set(id, allergens);
    });

    // Kombiner cached og nyhentede
    return { ...cachedResults, ...fetchedMap };
}

export async function enforceSugarPolicy({ customer, currentOrder, allProducts }) {
    // OPTIMERING: Brug memory cache først (0 DB kald)
    let institution = typeof window !== 'undefined' && typeof window.__flangoGetInstitutionById === 'function'
        ? window.__flangoGetInstitutionById(customer.institution_id)
        : null;

    // Fallback: hent fra DB kun hvis ikke i cache
    if (!institution) {
        const { data } = await supabaseClient
            .from('institutions')
            .select('sugar_policy_enabled, sugar_policy_max_unhealthy_per_day, sugar_policy_max_per_product_per_day, sugar_policy_max_unhealthy_enabled, sugar_policy_max_per_product_enabled')
            .eq('id', customer.institution_id)
            .single();
        institution = data;
    }

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
        .from('sale_items')
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
                `Hov, ${escapeHtml(customer.name)} har allerede købt <strong>${totalUnhealthyToday}</strong> usunde varer i dag.<br><br>Maks antal usunde produkter per dag: <strong>${maxUnhealthy}</strong>`
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
                    `Hov, ${escapeHtml(customer.name)} har allerede købt <strong>${escapeHtml(product?.name || 'denne vare')}</strong> ${boughtCount} gang(e) i dag.<br><br>Maks antal af hver usund vare per dag: <strong>${maxPerProduct}</strong>`
                );
                return false;
            }
        }
    }

    return true; // All checks passed
}

/**
 * Håndhæver kostpræferencer (vegetarisk, svinekød) sat af forældre.
 * Blokerer køb hvis produkter i kurven overtræder barnets kostpræferencer.
 */
export async function enforceDietaryRestrictions({ customer, currentOrder, allProducts }) {
    if (!customer?.id) return true;

    // Hent barnets dietary preferences via cached sugar policy snapshot
    let policyData;
    try {
        policyData = await getChildSugarPolicySnapshot(customer.id);
    } catch (e) {
        console.warn('[enforceDietaryRestrictions] Could not fetch policy:', e);
        return true; // Fail-open ved fejl
    }

    const policy = policyData?.policy;
    if (!policy) return true; // Ingen policy sat

    const vegetarianOnly = policy.vegetarianOnly === true;
    const noPork = policy.noPork === true;

    if (!vegetarianOnly && !noPork) return true; // Ingen kostpræferencer sat

    for (const item of currentOrder) {
        const product = allProducts.find(p => p.id === item.id);
        if (!product) continue;

        if (vegetarianOnly && product.is_vegetarian !== true) {
            await showCustomAlert(
                'Køb Blokeret',
                `Hov, ${escapeHtml(customer.name)} må kun købe vegetariske produkter.<br><br><strong>${escapeHtml(product.name)}</strong> er ikke markeret som vegetarisk.`
            );
            return false;
        }

        if (noPork && product.contains_pork === true) {
            await showCustomAlert(
                'Køb Blokeret',
                `Hov, ${escapeHtml(customer.name)} må ikke købe produkter med svinekød.<br><br><strong>${escapeHtml(product.name)}</strong> indeholder svinekød.`
            );
            return false;
        }
    }

    return true;
}

let purchaseInFlight = false;

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
    renderProductsFromCache,
}) {
    // 1. Synkronisér og validér ordre
    let orderSnapshot = syncOrderSnapshot(currentOrder, setCurrentOrder);
    logDebugEvent('purchase_flow_started', {
        customerId: customer?.id, customerName: customer?.name,
        cartLength: orderSnapshot?.length,
        cartItems: orderSnapshot?.slice(0, 5).map(i => ({ name: i.name, id: i.id, price: i.price })),
        orderStoreLength: typeof getOrder === 'function' ? getOrder()?.length : 'N/A',
    });
    if (!customer) return showAlert("Fejl: Vælg venligst en kunde!");
    if (orderSnapshot.length === 0) return showAlert("Fejl: Indkøbskurven er tom!");
    if (purchaseInFlight) {
        logDebugEvent('purchase_inflight_blocked', { customerId: customer?.id });
        return;
    }
    purchaseInFlight = true;
    try {

    // 2. Event/normal split — event-only ordrer processeres direkte
    const eventItems = orderSnapshot.filter(item => item.type === 'event');
    const normalItems = orderSnapshot.filter(item => item.type !== 'event');
    if (normalItems.length === 0 && eventItems.length > 0) {
        logDebugEvent('purchase_event_only', { eventCount: eventItems.length, customerId: customer?.id });
        await processEventItemsInCheckout(eventItems, customer);
        if (typeof updateSelectedUserInfo === 'function') updateSelectedUserInfo();
        let nextOrder = clearOrder();
        setOrder([...nextOrder]);
        if (typeof setCurrentOrder === 'function') setCurrentOrder(nextOrder);
        renderOrder(orderList, nextOrder, totalPriceEl, updateSelectedUserInfo);
        if (typeof refreshProductLocks === 'function') await refreshProductLocks({ force: true });
        if (typeof renderProductsFromCache === 'function') renderProductsFromCache();
        setButtonLoadingState(completePurchaseBtn, 'normal');
        return;
    }
    if (eventItems.length > 0) {
        orderSnapshot = normalItems;
        setOrder([...normalItems]);
    }

    // 3. Allergi-check
    const allergyOk = await enforceAllergyChecks(customer, orderSnapshot, allProducts);
    if (!allergyOk) return;

    // 4. Evaluér pris + sukker/kost-politik
    try {
        setOrder(Array.isArray(orderSnapshot) ? [...orderSnapshot] : []);
    } catch (err) {
        console.warn('[order-store] shadow sync failed:', err);
    }
    const evaluation = evaluatePurchase({
        customer, currentBalance: customer?.balance ?? null,
        orderItems: orderSnapshot, products: allProducts, maxOverdraft: OVERDRAFT_LIMIT,
    });

    const sugarOk = await enforceSugarPolicy({ customer, currentOrder: orderSnapshot, allProducts });
    if (!sugarOk) return;
    const dietaryOk = await enforceDietaryRestrictions({ customer, currentOrder: orderSnapshot, allProducts });
    if (!dietaryOk) return;

    // 5. Produktgrænser
    try {
        const limitsOk = await validateProductLimits(customer, orderSnapshot, allProducts);
        if (!limitsOk) return;
    } catch (err) {
        console.error('[canChildPurchase] Strukturel fejl ved validering – afviser køb:', err);
        await showCustomAlert('Kan ikke bekræfte regler',
            'Vi kan ikke bekræfte grænserne lige nu. Prøv igen om 5 sekunder eller tjek din forbindelse.');
        return;
    }

    // 6. Beregn total + saldo
    const { finalTotal, shouldBeFreePurchase } = calculateFinalTotal(evaluation, customer);
    applyEvaluation(evaluation);
    const finance = getFinancialState(finalTotal);
    const newBalance = Number.isFinite(finance.newBalance) ? finance.newBalance : customer.balance - finalTotal;

    // 7. Institutions-grænser (forbrug + saldo)
    const limitsOk = await enforceInstitutionLimits(customer, finalTotal, newBalance);
    if (!limitsOk) return;

    // 8. Restaurant mode
    const instData = window.__flangoGetInstitutionById?.(customer.institution_id);
    const deviceRestaurantMode = localStorage.getItem('flango_device_restaurant_mode') === 'true';
    const restaurantMode = (instData?.restaurant_mode_enabled && deviceRestaurantMode) ? {
        enabled: true,
        tableNumbersEnabled: instData.restaurant_table_numbers_enabled === true,
        tableCount: instData.restaurant_table_count || 9,
    } : null;

    // 9. Bekræftelsesmodal
    const modalResult = await showConfirmationAndCollectInput(
        customer, orderSnapshot, finalTotal, newBalance, shouldBeFreePurchase, restaurantMode, clerkProfile
    );
    if (!modalResult) return;
    const { selectedTableNumber, kitchenNoteText, itemExtras } = modalResult;

    // 10. Byg payload og kald process_sale
    setButtonLoadingState(completePurchaseBtn, 'loading');
    const cartItemsForDB = buildCartItemsForDB(orderSnapshot, shouldBeFreePurchase, itemExtras);
    const sessionAdmin = getCurrentSessionAdmin?.() || null;
    const { adminProfileId, clerkId } = resolveAdminAndClerkIds({ sessionAdmin, adminProfile, clerkProfile });

    const salePayload = {
        p_customer_id: customer.id,
        p_cart_items: cartItemsForDB,
        p_session_admin_id: sessionAdmin?.id || null,
        p_session_admin_name: sessionAdmin?.name || null,
    };
    if (adminProfileId) salePayload.p_admin_profile_id = adminProfileId;
    if (clerkId) salePayload.p_clerk_id = clerkId;
    if (restaurantMode?.enabled) salePayload.p_is_restaurant_order = true;
    if (selectedTableNumber) salePayload.p_table_number = selectedTableNumber;
    if (kitchenNoteText) salePayload.p_kitchen_note = kitchenNoteText;

    const balanceUpdateNonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const { data: rpcData, error } = await runWithAuthRetry(
        'process_sale',
        () => supabaseClient.rpc('process_sale', salePayload)
    );

    // 11. Håndtér resultat
    if (error) {
        showAlert('Database Fejl: ' + error.message);
        setButtonLoadingState(completePurchaseBtn, 'normal');
    } else {
        await handleSaleSuccess({
            customer, rpcData, finalTotal, newBalance, balanceUpdateNonce,
            eventItems, incrementSessionSalesCount, setCurrentOrder,
            orderList, totalPriceEl, updateSelectedUserInfo,
            refreshProductLocks, renderProductsFromCache, completePurchaseBtn,
        });
    }

    } finally {
        purchaseInFlight = false;
    }
}

export async function handleUndoLastSale({ setCurrentOrder, orderList, totalPriceEl, updateSelectedUserInfo } = {}) {
    const confirmed = await showCustomAlert('Fortryd Sidste Køb', 'Er du sikker på, du vil fortryde det seneste salg? Handlingen kan ikke omgøres.', 'confirm');
    if (!confirmed) return false;
    const { data, error } = await runWithAuthRetry(
        'undo_last_sale',
        () => supabaseClient.rpc('undo_last_sale')
    );
    if (error) {
        showAlert('Fejl ved fortrydelse: ' + error.message);
        return false;
    } else {
        const result = Array.isArray(data) ? data[0] : data;
        await showCustomAlert('Success!', `Salget for ${escapeHtml(result.customer_name)} på ${result.refunded_amount.toFixed(2)} kr. er blevet fortrudt.`);

        // Prefer any returned balance; fallback to DB refetch.
        const maybeBalance = extractBalanceFromRpcData(result);
        if (maybeBalance !== null) {
            updateCustomerBalanceGlobally(result.customer_id, maybeBalance, 0, 'undo-last-sale-rpc', { status: 'confirmed' });
        } else {
            await refreshCustomerBalanceFromDB(result.customer_id);
        }

        // Invalidate ALL caches and refresh order UI
        invalidateAllLimitCaches(result.customer_id);
        try { setOrder([]); } catch {}
        if (typeof setCurrentOrder === 'function') setCurrentOrder([]);
        const listEl = orderList || document.querySelector('.order-list');
        const totalEl = totalPriceEl || document.getElementById('total-price');
        const updateFn = updateSelectedUserInfo || window.updateSelectedUserInfo;
        if (listEl && totalEl) {
            renderOrder(listEl, [], totalEl, updateFn);
        }
    }
    return true;
}

export async function handleUndoPreviousSale() {
    showAlert('Avanceret fortrydelse er på vej.');
    return false;
}
