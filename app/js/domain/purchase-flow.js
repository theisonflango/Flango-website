import { showAlert, showCustomAlert, playSound } from '../ui/sound-and-alerts.js';
import { supabaseClient } from '../core/config-and-supabase.js';
import { setOrder, getOrder, clearOrder, getOrderTotal } from './order-store.js';
import { evaluatePurchase } from './cafe-session.js';
import {
    applyEvaluation,
    getFinancialState,
    setCustomerBalance,
    clearCurrentCustomer,
} from './cafe-session-store.js';
import { renderOrder } from './order-ui.js';
import { getProductIconInfo } from './products-and-cart.js';
import { getCurrentSessionAdmin } from './session-store.js';

export async function enforceSugarPolicy({ customer, currentOrder, allProducts }) {
    const unhealthyItemsInCart = currentOrder.filter(item => {
        const product = allProducts.find(p => p.id === item.id);
        return product && product.unhealthy === true;
    });

    if (unhealthyItemsInCart.length > 0) {
        const { data: policyCheck, error: policyError } = await supabaseClient.functions.invoke('check-sugar-policy', {
            body: { user_id: customer.id },
        });

        if (policyError) {
            showAlert(`Fejl ved tjek af sukkerpolitik: ${policyError.message}`);
            return false;
        }

        const boughtIds = new Set(policyCheck.boughtUnhealthyProductIds || []);
        const firstViolation = unhealthyItemsInCart.find(item => boughtIds.has(item.id));

        if (firstViolation) {
            await showCustomAlert(
                'Køb Blokeret',
                `Hov, ${customer.name} har allerede købt <strong>${firstViolation.name}</strong> i dag.<br><br>Du kan kun købe én af hver slags usund vare pr. dag.`
            );
            return false;
        }
    }
    return true;
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
}) {
    if (!customer) return showAlert("Fejl: Vælg venligst en kunde!");
    if (currentOrder.length === 0) return showAlert("Fejl: Indkøbskurven er tom!");
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
            maxOverdraft: -10,
        };
        evaluation = evaluatePurchase(purchaseInput);
        console.log('[cafe-session] evaluatePurchase result:', evaluation);
    }

    const sugarOk = await enforceSugarPolicy({ customer, currentOrder, allProducts });
    if (!sugarOk) return;

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

    applyEvaluation(evaluation);
    const finance = getFinancialState(finalTotal);
    const newBalance = Number.isFinite(finance.newBalance) ? finance.newBalance : customer.balance - finalTotal;
    const overdraftBreached = !!finance.overdraftBreached;
    const availableUntilLimit = Number.isFinite(finance.availableUntilLimit)
        ? finance.availableUntilLimit
        : customer.balance + 10;

    if (overdraftBreached) {
        const errorMessage = `Der er ikke penge nok på kontoen til dette køb!<br>Du har <strong>${availableUntilLimit.toFixed(2)} kr.</strong> tilbage, før du rammer -10 kr. grænsen.<br><br>Husk at bede dine forældre pænt om at overføre.`;
        return showCustomAlert('Køb Afvist', errorMessage);
    }
    let negativeBalanceWarning = '';
    if (newBalance < 0) {
        if (customer.balance < 0) {
            negativeBalanceWarning = `<p style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 8px; margin-top: 15px; border: 1px solid #f5c6cb;"><strong>Advarsel:</strong> Er du helt sikker på, at du vil gå endnu mere i minus?</p>`;
        } else {
            negativeBalanceWarning = `<p style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 8px; margin-top: 15px; border: 1px solid #f5c6cb;"><strong>Advarsel:</strong> Er du helt sikker på, du vil gå i minus?</p>`;
        }
    }
    const itemCounts = currentOrder.reduce((acc, item) => {
        acc[item.id] = acc[item.id] || { ...item, count: 0 };
        acc[item.id].count++;
        return acc;
    }, {});
    const itemsSummary = Object.values(itemCounts).map(item => {
        const iconInfo = getProductIconInfo(item);
        const visual = iconInfo
            ? `<img src="${iconInfo.path}" alt="${item.name}" class="confirm-product-icon">`
            : `<span class="confirm-product-emoji">${item.emoji || '❓'}</span>`;
        return `<div class="confirm-product-line">${visual}<span>${item.count} x ${item.name}</span></div>`;
    }).join('');
    const confirmationBody = `<strong>${customer.name}</strong> køber:<br>${itemsSummary}<br>for <strong>${finalTotal.toFixed(2)} kr.</strong><hr style="margin: 15px 0; border: 1px solid #eee;">${customer.name} har <strong>${newBalance.toFixed(2)} kr.</strong> tilbage.${negativeBalanceWarning}`;
    const confirmed = await showCustomAlert('Bekræft Køb', confirmationBody, 'confirm');
    if (!confirmed) return;
    if (completePurchaseBtn) {
        completePurchaseBtn.disabled = true;
        completePurchaseBtn.textContent = 'Behandler...';
    }
    const cartItemsForDB = Object.values(itemCounts).map(item => ({ product_id: item.id, quantity: item.count, price: item.price }));
    const operatorProfileId =
        (window.__flangoCurrentClerkProfile && window.__flangoCurrentClerkProfile.id) ||
        (window.__flangoCurrentAdminProfile && window.__flangoCurrentAdminProfile.id) ||
        clerkProfile?.id ||
        adminProfile?.id ||
        null;
    const sessionAdmin = getCurrentSessionAdmin?.() || null;
    const salePayload = {
        p_customer_id: customer.id,
        p_cart_items: cartItemsForDB,
        p_session_admin_id: sessionAdmin?.id || null,
        p_session_admin_name: sessionAdmin?.name || null,
    };
    if (operatorProfileId) {
        salePayload.p_admin_profile_id = operatorProfileId;
    }
    const { error } = await supabaseClient.rpc('process_sale', salePayload);
    if (error) {
        showAlert('Database Fejl: ' + error.message);
        if (completePurchaseBtn) {
            completePurchaseBtn.disabled = false;
            completePurchaseBtn.textContent = 'Gennemfør Køb';
        }
    } else {
        if (typeof incrementSessionSalesCount === 'function') {
            incrementSessionSalesCount();
        }
        playSound('purchase');
        const appliedBalance = Number.isFinite(newBalance) ? newBalance : customer.balance - finalTotal;
        customer.balance = appliedBalance;
        setCustomerBalance(appliedBalance);
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
        const selectedUserInfo = document.getElementById('selected-user-info');
        if (selectedUserInfo) selectedUserInfo.style.display = 'none';
        if (completePurchaseBtn) {
            completePurchaseBtn.disabled = false;
            completePurchaseBtn.textContent = 'Gennemfør Køb';
        }
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
        location.reload();
    }
}

export function handleUndoPreviousSale() {
    showAlert('Avanceret fortrydelse er på vej.');
}
