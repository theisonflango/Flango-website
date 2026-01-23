import { playSound, showAlert, showCustomAlert, openSoundSettingsModal } from '../ui/sound-and-alerts.js';
import { initializeSoundSettings } from '../core/sound-manager.js';
import { initDebugRecorder, logDebugEvent } from '../core/debug-flight-recorder.js';
import { closeTopMostOverlay, suspendSettingsReturn, resumeSettingsReturn, showScreen } from '../ui/shell-and-theme.js';
import { getCurrentTheme } from '../ui/theme-loader.js';
import { configureHistoryModule, showTransactionsInSummary, showOverviewInSummary, resetSharedHistoryControls } from './history-and-reports.js';
import { setupSummaryModal, openSummaryModal, closeSummaryModal, exportToCSV } from './summary-controller.js';
import { setupLogoutFlow } from './logout-flow.js';
import { getFinancialState, setCurrentCustomer, getCurrentCustomer, clearEvaluation, getSelectionToken, clearCurrentCustomer } from './cafe-session-store.js';
import { getOrderTotal, setOrder, getOrder } from './order-store.js';
import { updateLoggedInUserDisplay, updateAvatarStorage, updateSelectedUserInfo } from './app-ui-updates.js';
import { updateTotalPrice, renderOrder, handleOrderListClick, addToOrder, removeLastItemFromOrder, removeOneItemByName } from './order-ui.js';
import { renderProductsInModal, renderProductsGrid, createProductManagementUI, updateProductQuantityBadges } from '../ui/product-management.js';
import { supabaseClient } from '../core/config-and-supabase.js';
import {
    CUSTOM_ICON_PREFIX,
    getCustomIconPath,
    preloadChildProductLimitSnapshot,
    applyProductLimitsToButtons,
} from './products-and-cart.js';
import { getChildSugarPolicySnapshot, getInstitutionSugarPolicy, getCachedCheckSugarPolicy, getUnhealthySnapshotFromSalesCache } from './purchase-limits.js';
import { showPinModal } from '../ui/user-modals.js';
import { setupAvatarPicker } from '../ui/avatar-picker.js';
import { setupKeyboardShortcuts } from '../ui/keyboard-shortcuts.js';
import { setupRuntimeUIEvents } from '../ui/runtime-ui-events.js';
// VIGTIGT: shift-timer importeres FØR clerk-login-modal for at sætte window.__flangoOpenShiftTimer
import { initShiftTimer } from './shift-timer.js';
import { setupClerkLoginButton } from '../ui/clerk-login-modal.js';
import {
    handleCompletePurchase,
    handleUndoLastSale,
    handleUndoPreviousSale,
} from './purchase-flow.js';
import { onBalanceChange } from '../core/balance-manager.js';
import { setupCustomerPickerFlow } from './customer-picker-flow.js';
import { setupAdminFlow, loadUsersAndNotifications } from './admin-flow.js';
import { setupProductAssortmentFlow } from './product-assortment-flow.js';
import { isAuthAdminUser, openDbHistoryModal } from '../ui/db-history.js';
import {
    setCurrentAdmin,
    getCurrentAdmin,
    setCurrentClerk,
    getCurrentClerk,
    getCurrentSessionAdmin,
    setInstitutionId,
    getInstitutionId,
    markAppStarted,
    setSessionStartTime,
    getSessionStartTime,
} from './session-store.js';

export async function startApp() {
    const adminProfile = getCurrentAdmin();
    const clerkProfile = getCurrentClerk();

    // Værn mod dobbelt initialisering
    if (!adminProfile || !clerkProfile) return;
    // 1) Basis state for session og app
    const AVATAR_STORAGE_PREFIX = 'flango-avatar-';
    const DEFAULT_AVATAR_URL = 'Icons/webp/Avatar/Ekspedient-default2.webp';

    // OPTIMERING: In-memory cache for localStorage avatar access (20-40ms per UI update)
    const avatarCache = new Map();

    let allUsers = [];
    window.__flangoAllUsers = allUsers; // Expose for balance-manager
    configureHistoryModule({ getAllUsers: () => allUsers });
    let allProducts = [];
    window.__flangoGetAllProducts = () => allProducts;
    window.__flangoSetAllProducts = (next) => {
        allProducts = next;
        console.log(`[app-main] setAllProducts called: ${next.length} products`);
    };
    let currentOrder = [];
    let currentSugarData = null; // Sukkerpolitik data for valgt barn { policy, snapshot }
    window.__flangoGetSugarData = () => currentSugarData;

    // Funktion til at genindlæse sukkerpolitik fra databasen og opdatere produkt-låsning
    window.__flangoRefreshSugarPolicy = async () => {
        const selectedUser = getCurrentCustomer();
        if (!selectedUser) {
            console.log('[__flangoRefreshSugarPolicy] Ingen bruger valgt');
            return false;
        }

        console.log('[__flangoRefreshSugarPolicy] Genindlæser sukkerpolitik for:', selectedUser.id);

        try {
            // Hent både forældre- og institutions-sukkerpolitik parallelt
            const [parentSugarData, institutionSugarData] = await Promise.all([
                getChildSugarPolicySnapshot(selectedUser.id),
                getInstitutionSugarPolicy(selectedUser.institution_id),
            ]);

            console.log('[__flangoRefreshSugarPolicy] parentSugarData:', parentSugarData);
            console.log('[__flangoRefreshSugarPolicy] institutionSugarData:', institutionSugarData);

            // Hent snapshot hvis institutions-policy er aktiv men forældre-policy ikke er
            // OPTIMERING: Byg snapshot ud fra sales-cache (undgår Edge Function kald),
            // fallback til cached check-sugar-policy hvis nødvendigt.
            let snapshot = parentSugarData.snapshot;
            if (!parentSugarData.policy && institutionSugarData.policy && !snapshot) {
                try {
                    const fromSales = await getUnhealthySnapshotFromSalesCache(
                        selectedUser.id,
                        selectedUser.institution_id,
                        allProducts
                    );
                    if (fromSales) {
                        snapshot = fromSales;
                    } else {
                        const checkResult = await getCachedCheckSugarPolicy(selectedUser.id, {
                            blockUnhealthy: false,
                            maxUnhealthyPerDay: institutionSugarData.policy.maxUnhealthyPerDay,
                            maxUnhealthyPerProductPerDay: institutionSugarData.policy.maxUnhealthyPerProductPerDay,
                        });
                        snapshot = {
                            unhealthyTotal: checkResult?.totalUnhealthyToday ?? 0,
                            unhealthyPerProduct: checkResult?.countByProductId ?? {},
                        };
                    }
                } catch (err) {
                    console.error('[__flangoRefreshSugarPolicy] Fejl ved hentning af snapshot:', err);
                }
            }

            // Opdater currentSugarData
            currentSugarData = {
                policy: parentSugarData.policy || institutionSugarData.policy,
                snapshot: snapshot,
                parentPolicy: parentSugarData.policy,
                institutionPolicy: institutionSugarData.policy,
            };
            console.log('[__flangoRefreshSugarPolicy] currentSugarData opdateret:', currentSugarData);

            // Opdater produkt-låsning
            const productsEl = document.getElementById('products');
            await applyProductLimitsToButtons(allProducts, productsEl, currentOrder, selectedUser.id, currentSugarData);

            console.log('[__flangoRefreshSugarPolicy] Produkt-låsning opdateret');
            return true;
        } catch (err) {
            console.error('[__flangoRefreshSugarPolicy] Fejl:', err);
            return false;
        }
    };

    let currentSortKey = 'name';
    let balanceSortOrder = 'desc';
    // Statistik for den nuværende session
    let sessionStartTimeValue = getSessionStartTime();
    if (!sessionStartTimeValue) {
        sessionStartTimeValue = Date.now();
        setSessionStartTime(sessionStartTimeValue);
    }
    const sessionStartTime = new Date(sessionStartTimeValue);
    let sessionSalesCount = 0;

    console.log('Starter applikationen...');

    // 1.5) Initialiser debug flight recorder FØRST (før alt andet)
    initDebugRecorder();
    logDebugEvent('app_started', {
        adminId: adminProfile?.id,
        adminName: adminProfile?.name,
        clerkId: clerkProfile?.id,
        clerkName: clerkProfile?.name,
    });

    // 2) Initialiser lydindstillinger fra localStorage (før lyde afspilles)
    initializeSoundSettings();

    // 3) Vis café-UI
    document.getElementById('main-app').style.display = 'grid';

    // Sæt standardlyde, hvis de ikke allerede er sat (robust tjek)
    const addEl = document.getElementById('audio-add-item');
    if (addEl && !addEl.src) addEl.src = 'sounds/Add%20Item/Add1.mp3';

    const remEl = document.getElementById('audio-remove-item');
    if (remEl && !remEl.src) remEl.src = 'sounds/Delete%20Item/Slet.mp3';

    const purEl = document.getElementById('audio-purchase');
    if (purEl && !purEl.src) purEl.src = 'sounds/Accept/accepter-1.mp3';

    const errEl = document.getElementById('audio-error');
    if (errEl && !errEl.src) errEl.src = 'sounds/Error/Fejl1.mp3';

    // 3) DOM-elementer der er tilgængelige efter login
    const selectUserBtn = document.getElementById('select-customer-main-btn');
    const userModal = document.getElementById('user-modal');
    const userModalCloseBtn = userModal.querySelector('.close-btn');
    const userModalControls = userModal.querySelector('.modal-controls');
    const userModalAdminControls = userModal.querySelector('#admin-controls-modal');
    const userModalTitle = document.getElementById('user-modal-title');
    const userModalStaticHeader = userModal.querySelector('.static-header');
    const productsContainer = document.getElementById('products');
    const orderList = document.getElementById('order-list');
    const totalPriceEl = document.getElementById('total-price');
    const completePurchaseBtn = document.getElementById('complete-purchase');
    const undoLastSaleBtn = document.getElementById('undo-last-sale-btn');
    const salesHistoryBtn = document.getElementById('sales-history-btn');
    const settingsHistoryBtn = document.getElementById('settings-history-btn');
    const settingsMinFlangoStatusBtn = document.getElementById('settings-min-flango-status-btn');
    const settingsLogoutBtn = document.getElementById('settings-logout-btn');
    const assortmentModal = document.getElementById('assortment-modal');
    const assortmentModalCloseBtn = assortmentModal
        ? assortmentModal.querySelector('.close-btn')
        : null;
    const soundSettingsModal = document.getElementById('sound-settings-modal');
    const soundSettingsModalCloseBtn = soundSettingsModal
        ? soundSettingsModal.querySelector('.close-btn')
        : null;
    const logoutBtn = document.getElementById('logout-btn');

    const searchUserInput = document.getElementById('search-user-input');
    const sortByNameBtn = document.getElementById('sort-by-name-btn');
    const sortByNumberBtn = document.getElementById('sort-by-number-btn');
    const sortByBalanceBtn = document.getElementById('sort-by-balance-btn');
    const productModal = document.getElementById('product-modal');
    const productModalCloseBtn = productModal.querySelector('.close-btn');
    const editMenuOriginalBtn = document.getElementById('edit-menu-original-btn');
    const modalProductList = document.getElementById('modal-product-list');
    const addProductBtn = document.getElementById('add-btn-modal');
    const editUserDetailModal = document.getElementById('edit-user-detail-modal');
    const assignBadgeModal = document.getElementById('assign-badge-modal');
    // DEBOUNCE: Undgå multiple refreshes ved hurtige ændringer
    let refreshDebounceTimer = null;
    let refreshPending = null;
    let refreshPendingResolve = null;
    const REFRESH_DEBOUNCE_MS = 50; // 50ms debounce window

    const refreshProductLocks = async (options = {}) => {
        const productsEl = document.getElementById('products');
        const selectedUser = getCurrentCustomer();
        const childId = selectedUser?.id || null;

        // Race protection: avoid applying lock UI for a user that is no longer selected
        const tokenAtStart = typeof getSelectionToken === 'function' ? getSelectionToken() : null;
        const childIdAtStart = childId != null ? String(childId) : null;

        // VIGTIGT: Opdater quantity badges først så tallene er korrekte (instant, ingen debounce)
        updateProductQuantityBadges();

        // MUST-RUN path: allow callers (purchase/undo/user-select) to force an immediate refresh
        const force = options?.force === true;

        // Track the latest requested options within the debounce window
        // If any caller requests a full refresh, we must do a full refresh (stronger wins).
        refreshProductLocks._latestOptions = refreshProductLocks._latestOptions || {};
        const prev = refreshProductLocks._latestOptions;
        refreshProductLocks._latestOptions = {
            ...prev,
            ...options,
            // If any call does NOT skip snapshot refresh, then don't skip.
            skipSnapshotRefresh: (prev.skipSnapshotRefresh === true) && (options.skipSnapshotRefresh === true),
        };

        const runNow = async () => {
            // Abort if selection changed since this refresh was requested.
            if (tokenAtStart !== null && typeof getSelectionToken === 'function') {
                const tokenNow = getSelectionToken();
                if (tokenNow !== tokenAtStart) return;
            }

            // Extra guard on user id (if token is unavailable or not trusted somewhere)
            const selectedNow = getCurrentCustomer();
            const childIdNow = selectedNow?.id != null ? String(selectedNow.id) : null;
            if (childIdAtStart !== childIdNow) return;

            const effectiveOptions = refreshProductLocks._latestOptions || {};

            if (effectiveOptions.skipSnapshotRefresh) {
                if (selectedNow) {
                    await applyProductLimitsToButtons(allProducts, productsEl, currentOrder, selectedNow.id, currentSugarData);
                }
            } else {
                await applyProductLimitsToButtons(allProducts, productsEl, currentOrder, selectedNow?.id || null, currentSugarData);
            }
        };

        if (force) {
            if (refreshDebounceTimer) {
                clearTimeout(refreshDebounceTimer);
                refreshDebounceTimer = null;
            }
            try {
                await runNow();
            } finally {
                refreshProductLocks._latestOptions = null;
                if (refreshPending) {
                    refreshPending = null;
                    refreshPendingResolve?.();
                    refreshPendingResolve = null;
                }
            }
            return;
        }

        // If we're already waiting, just reschedule the timer and return the same promise.
        if (refreshPending) {
            if (refreshDebounceTimer) {
                clearTimeout(refreshDebounceTimer);
            }
            refreshDebounceTimer = setTimeout(async () => {
                refreshDebounceTimer = null;
                try {
                    await runNow();
                } finally {
                    refreshProductLocks._latestOptions = null;
                    refreshPending = null;
                    refreshPendingResolve?.();
                    refreshPendingResolve = null;
                }
            }, REFRESH_DEBOUNCE_MS);
            return refreshPending;
        }

        refreshPending = new Promise((resolve) => {
            refreshPendingResolve = resolve;
        });

        refreshDebounceTimer = setTimeout(async () => {
            refreshDebounceTimer = null;
            try {
                await runNow();
            } finally {
                refreshProductLocks._latestOptions = null;
                refreshPending = null;
                refreshPendingResolve?.();
                refreshPendingResolve = null;
            }
        }, REFRESH_DEBOUNCE_MS);

        return refreshPending;
    };
    const addToOrderWithLocks = async (product, currentOrderArg, orderListArg, totalPriceArg, updateSelectedUserInfoArg, optionsArg = {}) => {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/061553fc-00e4-4d47-b4a3-265f30951c0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app-main.js:337',message:'addToOrderWithLocks: before addToOrder',data:{localCurrentOrderLength:currentOrder?.length,argCurrentOrderLength:currentOrderArg?.length,orderStoreLength:typeof getOrder === 'function' ? getOrder()?.length : 'N/A',productName:product?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'fix-1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        const result = await addToOrder(product, currentOrderArg, orderListArg, totalPriceArg, updateSelectedUserInfoArg, { ...optionsArg, onOrderChanged: refreshProductLocks });
        // KRITISK FIX: Opdater lokal currentOrder variabel efter addToOrder for at undgå synkroniseringsfejl
        // Læs fra order-store for at sikre vi har den seneste state
        const updatedOrder = typeof getOrder === 'function' ? getOrder() : currentOrderArg;
        if (updatedOrder.length > 0) {
            currentOrder = [...updatedOrder];
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/061553fc-00e4-4d47-b4a3-265f30951c0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app-main.js:342',message:'addToOrderWithLocks: updated local currentOrder from order-store',data:{oldLength:currentOrderArg?.length,newLength:updatedOrder.length,orderStoreLength:updatedOrder.length},timestamp:Date.now(),sessionId:'debug-session',runId:'fix-1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
        }
        return result;
    };

    const resetUserModalView = () => {
        delete userModal.dataset.mode;
        if (userModalControls) userModalControls.style.display = '';
        if (userModalAdminControls) userModalAdminControls.style.display = '';
        if (userModalTitle) userModalTitle.textContent = 'Vælg en kunde';
        if (sortByBalanceBtn) sortByBalanceBtn.style.display = '';
        if (userModalStaticHeader) userModalStaticHeader.style.display = '';
        if (searchUserInput) searchUserInput.value = '';
    };
    resetUserModalView();

    console.log('Admin-profil:', adminProfile);

    // Update logged-in user display (refactored to app-ui-updates.js)
    updateLoggedInUserDisplay(clerkProfile, avatarCache, { AVATAR_STORAGE_PREFIX, DEFAULT_AVATAR_URL });

    // 3.5) DB-Historik button (superadmin only)
    const dbHistoryBtn = document.getElementById('toolbar-db-history-btn');
    function updateDbHistoryButtonVisibility() {
        if (dbHistoryBtn) {
            const isAuthAdmin = isAuthAdminUser();
            dbHistoryBtn.style.display = isAuthAdmin ? 'flex' : 'none';
        }
    }
    updateDbHistoryButtonVisibility();
    if (dbHistoryBtn) {
        dbHistoryBtn.addEventListener('click', () => {
            openDbHistoryModal();
        });
    }

    // 4) Basis event wiring (logout + modal luk)
    setupLogoutFlow({
        clerkProfile,
        sessionStartTime,
        getSessionSalesCount: () => sessionSalesCount,
        logoutBtn,
        settingsLogoutBtn,
    });

    userModalCloseBtn.addEventListener('click', () => {
        userModal.style.display = 'none';
        resetUserModalView();
    });
    orderList.addEventListener('click', (event) => {
        handleOrderListClick(
            event,
            currentOrder,
            () => renderOrder(orderList, currentOrder, totalPriceEl, updateSelectedUserInfo),
            refreshProductLocks
        );
    });

    // Mini-receipt chip remove buttons (mobile)
    totalPriceEl.addEventListener('click', (event) => {
        const removeBtn = event.target.closest('.order-chip-remove');
        if (!removeBtn) return;

        // Get product name from parent chip
        const chip = removeBtn.closest('.order-chip');
        if (!chip) return;

        const productName = chip.dataset.productName;
        if (!productName) {
            console.warn('[app-main] No product name found on chip');
            return;
        }

        // Remove one item with this name from cart
        // VIGTIGT: Send currentOrder med så den lokale variabel bliver opdateret
        removeOneItemByName(
            productName,
            currentOrder,
            orderList,
            totalPriceEl,
            updateSelectedUserInfo,
            refreshProductLocks
        );
    });

    // Købshåndtering
    if (completePurchaseBtn._flangoPurchaseHandler) {
        completePurchaseBtn.removeEventListener('click', completePurchaseBtn._flangoPurchaseHandler);
    }
    const purchaseHandler = async () => {
        // KRITISK FIX: Læs fra order-store i stedet for lokal variabel for at undgå synkroniseringsfejl
        // Hvis lokal currentOrder er tom men order-store har varer, brug order-store
        const orderFromStore = typeof getOrder === 'function' ? getOrder() : [];
        const effectiveOrder = (currentOrder?.length > 0) ? currentOrder : orderFromStore;
        
        // Opdater lokal variabel hvis den var tom men order-store har varer
        if (currentOrder?.length === 0 && orderFromStore.length > 0) {
            currentOrder = [...orderFromStore];
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/061553fc-00e4-4d47-b4a3-265f30951c0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app-main.js:429',message:'Fixed sync: updated local currentOrder from order-store',data:{localWasEmpty:true,orderStoreLength:orderFromStore.length,effectiveOrderLength:effectiveOrder.length},timestamp:Date.now(),sessionId:'debug-session',runId:'fix-1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
        }
        
        // Flight recorder: log purchase button click
        logDebugEvent('purchase_btn_clicked', {
            customerId: getCurrentCustomer()?.id,
            customerName: getCurrentCustomer()?.name,
            cartLength: effectiveOrder?.length,
            cartItems: effectiveOrder?.slice(0, 5).map(i => ({ name: i.name, id: i.id })),
            btnDisabled: completePurchaseBtn?.disabled,
        });
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/061553fc-00e4-4d47-b4a3-265f30951c0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app-main.js:433',message:'purchaseHandler: before handleCompletePurchase',data:{localCurrentOrderLength:currentOrder?.length,orderStoreLength:orderFromStore.length,effectiveOrderLength:effectiveOrder.length},timestamp:Date.now(),sessionId:'debug-session',runId:'fix-1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        await handleCompletePurchase({
            customer: getCurrentCustomer(),
            currentOrder: effectiveOrder,
            setCurrentOrder: (next) => { currentOrder = next; },
            allProducts,
            updateSelectedUserInfo,
            orderList,
            totalPriceEl,
            clerkProfile,
            adminProfile,
            incrementSessionSalesCount: () => { sessionSalesCount++; },
            completePurchaseBtn,
            refreshProductLocks,
            renderProductsFromCache: () => productAssortment.renderFromCache(),
        });
        // MUST-RUN: After any purchase attempt, force refresh so locks can't be dropped by debounce.
        await refreshProductLocks({ force: true });
    };
    completePurchaseBtn._flangoPurchaseHandler = purchaseHandler;
    completePurchaseBtn.addEventListener('click', purchaseHandler);

    // 5) Produktstyring
    createProductManagementUI({
        getAllProducts: () => allProducts,
        setAllProducts: (next) => { allProducts = next; },
        adminProfile,
        supabaseClient,
        productModal,
        productModalCloseBtn,
        modalProductList,
        addProductBtn,
        suspendSettingsReturn,
        resumeSettingsReturn,
        showAlert,
        showCustomAlert,
        playSound,
            CUSTOM_ICON_PREFIX,
            getCustomIconPath,
            renderProductsInModal,
            renderProductsGrid,
            fetchAndRenderProducts: async () => {
                // KRITISK FIX: Brug renderFromCache i stedet for fetchAndRenderProducts
                // Dette sikrer at produkter vises med det samme efter oprettelse/redigering
                // fordi refetchAllProducts() allerede har opdateret cache'en
                await productAssortment.renderFromCache();
                // Sørg for at alle knapper har et låse-overlay, så CSS kan virke
                productsContainer.querySelectorAll('.product-btn').forEach(btn => {
                    if (!btn.querySelector('.product-lock-overlay')) {
                        const overlay = document.createElement('div');
                        overlay.className = 'product-lock-overlay';
                        btn.appendChild(overlay);
                    }
                });
            },
        });

        undoLastSaleBtn.addEventListener('click', async () => {
            const ok = await handleUndoLastSale({
                setCurrentOrder: (next) => { currentOrder = next; },
                orderList,
                totalPriceEl,
                updateSelectedUserInfo,
            });
            if (ok) {
                // MUST-RUN: Ensure locks are refreshed after DB write.
                await refreshProductLocks({ force: true });
            }
        });

    // 6) Keyboard usage tip tracking
    const { initKeyboardUsageTip } = await import('../ui/keyboard-usage-tip.js');
    initKeyboardUsageTip({
        productsContainer,
        selectUserButton: selectUserBtn,
        completePurchaseButton: completePurchaseBtn,
    });

    // 7) UI-input flows
    setupKeyboardShortcuts({
        getAllProducts: () => allProducts,
        getCurrentOrder: () => currentOrder,
        setCurrentOrder: (next) => { currentOrder = next; },
        orderListElement: orderList,
        totalPriceElement: totalPriceEl,
        updateSelectedUserInfo,
        selectUserButton: selectUserBtn,
        completePurchaseButton: completePurchaseBtn,
        addToOrder: addToOrderWithLocks,
        removeLastItemFromOrder,
        closeTopMostOverlay,
        onOrderChanged: refreshProductLocks,
    });

    const getAllUsers = () => allUsers;
    const setAllUsers = (next) => {
        allUsers = next;
        window.__flangoAllUsers = next; // Keep window property in sync
        console.log(`[app-main] setAllUsers called: ${next.length} users, window.__flangoAllUsers.length=${window.__flangoAllUsers.length}`);
    };
    // Expose setter globally for data-refetch module
    window.__flangoSetAllUsers = setAllUsers;
    window.__flangoGetAllUsers = getAllUsers;

    // 7) Kundevælger
    const customerPicker = setupCustomerPickerFlow({
        getAllUsers,
        getCurrentSortKey: () => currentSortKey,
        setCurrentSortKey: (value) => { currentSortKey = value; },
        getBalanceSortOrder: () => balanceSortOrder,
        setBalanceSortOrder: (value) => { balanceSortOrder = value; },
        selectUser,
        userModal,
        searchInput: searchUserInput,
        sortByNameBtn,
        sortByNumberBtn,
        sortByBalanceBtn,
        resetUserModalView,
    });

    // 8) Første data-load for brugere
    await loadUsersAndNotifications({
        adminProfile,
        supabaseClient,
        setAllUsers,
        selectUserBtn,
        openCustomerSelectionModal: () => customerPicker.openCustomerSelectionModal(),
        userModal,
        searchUserInput,
    });

    // 3.5) Initialiser bytte-timer (shift timer) EFTER indstillinger er loadet
    const sessionBanner = document.getElementById('user-session-banner');
    if (sessionBanner) {
        initShiftTimer(sessionBanner);
    }

    // Make selected-user-info box clickable to open customer selection
    const selectedUserInfoBox = document.getElementById('selected-user-info');
    if (selectedUserInfoBox) {
        selectedUserInfoBox.addEventListener('click', () => {
            customerPicker.openCustomerSelectionModal();
        });
    }

    // 9) Admin- og sortimentflows
    const adminFlow = setupAdminFlow({
        adminProfile,
        clerkProfile,
        supabaseClient,
        getAllUsers,
        setAllUsers,
        renderSelectedUserInfo: updateSelectedUserInfo,
        getCurrentSortKey: () => currentSortKey,
        setCurrentSortKey: (value) => { currentSortKey = value; },
        getBalanceSortOrder: () => balanceSortOrder,
        setBalanceSortOrder: (value) => { balanceSortOrder = value; },
    });

    const productAssortment = setupProductAssortmentFlow({
        adminProfile,
        supabaseClient,
        showAlert,
        getAllProducts: () => allProducts,
        setAllProducts: (next) => { allProducts = next; },
        getCurrentOrder: () => currentOrder,
        productsContainer,
        orderList,
        totalPriceEl,
        updateSelectedUserInfo,
        renderProductsGrid,
        renderProductsInModal,
        modalProductList,
        assortmentModal,
        parentPortalAdminUI: adminFlow?.parentPortalAdminUI,
        addToOrder: addToOrderWithLocks,
    });

    // Eksponér renderFromCache til window så andre moduler kan opdatere produkt-visningen
    window.__flangoRenderProductsFromCache = () => productAssortment.renderFromCache();

    // 10) UI-events og helpers
    setupRuntimeUIEvents({
        salesHistoryBtn,
        settingsHistoryBtn,
        assortmentModal,
        assortmentModalCloseBtn,
        soundSettingsModal,
        soundSettingsModalCloseBtn,
        editMenuOriginalBtn,
        productModal,
        modalProductList,
        getAllProducts: () => allProducts,
        renderProductsInModal,
        openSoundSettingsModal,
        showSalesHistory: () => openSummaryModal(getInstitutionId()),
        settingsMinFlangoStatusBtn,
        showAlert,
    });

    // Setup summary/opsummering modal
    const institutionId = getInstitutionId();
    setupSummaryModal(institutionId, { getAllUsers });

    // Setup global functions for loading views in summary modal
    window.__flangoLoadTransactionsInSummary = () => {
        showTransactionsInSummary();
    };
    window.__flangoLoadOverviewInSummary = () => {
        showOverviewInSummary();
    };
    window.__flangoResetSharedHistoryControls = () => {
        resetSharedHistoryControls();
    };

    // Setup close button for summary modal
    const summaryModal = document.getElementById('summary-modal');
    if (summaryModal) {
        const summaryCloseBtn = summaryModal.querySelector('.close-btn');
        if (summaryCloseBtn) {
            summaryCloseBtn.addEventListener('click', closeSummaryModal);
        }
        // Close on outside click
        summaryModal.addEventListener('click', (event) => {
            if (event.target === summaryModal) {
                closeSummaryModal();
            }
        });

        // Setup export button
        const exportCSVBtn = document.getElementById('summary-export-csv');
        if (exportCSVBtn) {
            exportCSVBtn.addEventListener('click', exportToCSV);
        }
    }

    // Global function to open summary modal
    window.__flangoOpenSummary = () => {
        openSummaryModal(institutionId);
    };

    // Setup summary button in history modal
    const summaryBtnInHistory = document.getElementById('toolbar-summary-btn');
    if (summaryBtnInHistory) {
        summaryBtnInHistory.addEventListener('click', () => {
            openSummaryModal(institutionId);
        });
    }

    // Helper til at opdatere avatar (både localStorage og cache)
    // Helper til at opdatere avatar (både localStorage og cache) - refactored to app-ui-updates.js
    const updateAvatarStorageWrapper = (userId, avatarUrl) => {
        updateAvatarStorage(userId, avatarUrl, avatarCache, AVATAR_STORAGE_PREFIX);
    };

    // 11) Opsæt avatar-vælgeren for alle brugere
    await setupAvatarPicker({
        clerkProfile,
        sessionStartTime,
        getSessionSalesCount: () => sessionSalesCount,
        AVATAR_STORAGE_PREFIX,
        updateLoggedInUserDisplay: () => updateLoggedInUserDisplay(clerkProfile, avatarCache, { AVATAR_STORAGE_PREFIX, DEFAULT_AVATAR_URL }),
        updateAvatarStorage: updateAvatarStorageWrapper,
    });

    // 12) Første produkt-load
    await productAssortment.fetchAndRenderProducts();

    async function selectUser(userId) {
        // Flight recorder: log user selection
        const prevCustomer = getCurrentCustomer();
        logDebugEvent('user_select_started', {
            newUserId: userId,
            prevUserId: prevCustomer?.id,
            prevUserName: prevCustomer?.name,
            cartLengthBefore: currentOrder?.length,
            cartItemsBefore: currentOrder?.slice(0, 3).map(i => i.name),
        });
        // Tjek om samme bruger allerede er valgt
        const currentCustomer = getCurrentCustomer();
        if (currentCustomer && currentCustomer.id === userId) {
            // Samme bruger - luk bare modalen uden at gøre noget
            userModal.style.display = 'none';
            return;
        }

        // Ryd den gamle ordre og sukkerpolitik FØR vi sætter en ny bruger.
        // Dette sikrer, at `applyProductLimitsToButtons` ikke bruger forældede data.
        currentOrder = [];
        currentSugarData = null;
        setOrder([]); // KRITISK: Sync order-store module state så getOrderTotal() returnerer 0
        logDebugEvent('cart_cleared_on_user_switch', { newUserId: userId });
        clearEvaluation(); // Ryd evaluation cache så "Ny Saldo" vises korrekt
        renderOrder(orderList, currentOrder, totalPriceEl, updateSelectedUserInfo);

        const selectedUser = allUsers.find(u => u.id === userId);
        if (!selectedUser) return;

        setCurrentCustomer(selectedUser);
        const token = getSelectionToken(); // Capture token for race protection

        // Preload dagens købs-snapshot og sukkerpolitik parallelt (både forældre og institution)
        console.log('[selectUser] Henter sukkerpolitik for barn:', selectedUser.id, 'institution:', selectedUser.institution_id);
        const [_, parentSugarData, institutionSugarData] = await Promise.all([
            preloadChildProductLimitSnapshot(selectedUser.id),
            getChildSugarPolicySnapshot(selectedUser.id),
            getInstitutionSugarPolicy(selectedUser.institution_id),
        ]);

        // Guard: If user switched during async load, discard stale data
        if (getSelectionToken() !== token) {
            console.log('[selectUser] User switched during async load, discarding stale data');
            return;
        }

        // Hvis vi har institutions-policy men ikke forældre-policy, hent snapshot separat
        let snapshot = parentSugarData.snapshot;
        // OPTIMERING: Byg snapshot ud fra sales-cache (undgår Edge Function kald),
        // fallback til cached check-sugar-policy hvis nødvendigt.
        if (!parentSugarData.policy && institutionSugarData.policy && !snapshot) {
            console.log('[selectUser] Henter snapshot for institutions-sukkerpolitik...');
            try {
                const fromSales = await getUnhealthySnapshotFromSalesCache(
                    selectedUser.id,
                    selectedUser.institution_id,
                    allProducts
                );
                if (fromSales) {
                    snapshot = fromSales;
                } else {
                    const checkResult = await getCachedCheckSugarPolicy(selectedUser.id, {
                        blockUnhealthy: false,
                        maxUnhealthyPerDay: institutionSugarData.policy.maxUnhealthyPerDay,
                        maxUnhealthyPerProductPerDay: institutionSugarData.policy.maxUnhealthyPerProductPerDay,
                    });
                    snapshot = {
                        unhealthyTotal: checkResult?.totalUnhealthyToday ?? 0,
                        unhealthyPerProduct: checkResult?.countByProductId ?? {},
                    };
                }
                console.log('[selectUser] Institutions-snapshot hentet:', snapshot);
            } catch (err) {
                console.error('[selectUser] Fejl ved hentning af institutions-snapshot:', err);
            }
        }

        // Guard: If user switched during snapshot fetch, discard stale data
        if (getSelectionToken() !== token) {
            console.log('[selectUser] User switched during snapshot fetch, discarding stale data');
            return;
        }

        // Kombiner forældre- og institutions-sukkerpolitik
        // Forældre-policy har højere prioritet (mere restriktiv)
        currentSugarData = {
            policy: parentSugarData.policy || institutionSugarData.policy,
            snapshot: snapshot,
            parentPolicy: parentSugarData.policy,
            institutionPolicy: institutionSugarData.policy,
        };
        console.log('[selectUser] currentSugarData sat til:', currentSugarData);

        // KRITISK: Anvend produktlåsning (inkl. sukkerpolitik) EFTER vi har hentet data
        console.log('[selectUser] Kalder refreshProductLocks...');
        await refreshProductLocks({ force: true });
        console.log('[selectUser] refreshProductLocks færdig');

        // Guard: If user switched during lock refresh, skip remaining updates
        if (getSelectionToken() !== token) {
            console.log('[selectUser] User switched during lock refresh, skipping remaining updates');
            return;
        }

        // KRITISK: Genrender produktgitter for at vise refill-status (grøn knap, timer, refill-pris)
        // OPTIMERING: Brug renderFromCache (0 DB kald) i stedet for fetchAndRenderProducts
        console.log('[selectUser] Genrenderer produkter for refill-visning...');
        await productAssortment.renderFromCache();
        console.log('[selectUser] Produkter genrenderet');

        // Guard: If user switched during render, skip remaining updates
        if (getSelectionToken() !== token) {
            console.log('[selectUser] User switched during render, skipping remaining updates');
            return;
        }

        // Opdater quantity badges efter produkterne er genrenderet
        updateProductQuantityBadges();

        // Guard: Final check before UI update
        if (getSelectionToken() !== token) {
            console.log('[selectUser] User switched before UI update, skipping');
            return;
        }

        // Kør UI-opdatering EFTER alle asynkrone kald er færdige.
        updateSelectedUserInfo();
        userModal.style.display = 'none';
    }

    // updateSelectedUserInfo moved to app-ui-updates.js
    // Expose updateSelectedUserInfo on window for use in other modules
    window.updateSelectedUserInfo = updateSelectedUserInfo;

    // Register listener for balance changes to update UI
    onBalanceChange('main-ui-updater', (event) => {
        const { userId, newBalance, delta, source } = event;

        // If this is the currently selected customer, update UI
        const currentCustomer = getCurrentCustomer();
        if (currentCustomer && currentCustomer.id === userId) {
            console.log(`[app-main] Balance changed for selected customer: ${newBalance} kr (${source})`);
            // KRITISK: Brug requestAnimationFrame for at sikre DOM er klar til opdatering
            // Dette løser timing-issues hvor state er opdateret men UI ikke reflekterer det
            requestAnimationFrame(() => {
                updateSelectedUserInfo();
            });
        }
    });

    // Update DB-Historik button visibility when admin/clerk changes
    updateDbHistoryButtonVisibility();

    // Admin-handlinger i brugerlisten
    userModal.addEventListener('click', (event) => {
        const clickedActionIcon = event.target.closest('.action-icon');
        if (clickedActionIcon && adminFlow?.handleUserListClick) {
            adminFlow.handleUserListClick(event);
        }
    });

    window.__flangoUndoLastSale = async () => {
        const ok = await handleUndoLastSale({
            setCurrentOrder: (next) => { currentOrder = next; },
            orderList,
            totalPriceEl,
            updateSelectedUserInfo,
        });
        if (ok) {
            await refreshProductLocks({ force: true });
        }
        return ok;
    };
    window.__flangoUndoPreviousSale = async () => {
        const ok = await handleUndoPreviousSale();
        if (ok) {
            await refreshProductLocks({ force: true });
        }
        return ok;
    };

    // KRITISK: Initialiser selected-user-info boksen ved app start
    console.log('[app-main] startApp complete - initializing selected-user-info box');
    updateSelectedUserInfo();

    // Expose deselect user function globally
    window.__flangoDeselectUser = async () => {
        // Clear customer and evaluation
        clearCurrentCustomer();
        clearEvaluation();
        
        // Clear order
        currentOrder = [];
        setOrder([]);
        renderOrder(orderList, currentOrder, totalPriceEl, updateSelectedUserInfo);
        
        // Clear sugar data
        currentSugarData = null;
        
        // Refresh product locks (remove locks when no user selected)
        await refreshProductLocks({ force: true });
        
        // Update UI
        updateSelectedUserInfo();
    };
}



export async function setupAdminLoginScreen(adminProfile) {
    setCurrentAdmin(adminProfile);
    setInstitutionId(adminProfile.institution_id);
    window.__flangoCurrentAdminProfile = adminProfile;
    showScreen('screen-admin-login');
    const adminWelcomeText = document.getElementById('admin-welcome-text');
    const continueBtn = document.getElementById('continue-as-admin-btn');
    if (adminWelcomeText) {
        adminWelcomeText.textContent = `Caféen er åbnet af ${adminProfile.name}`;
    }
    if (continueBtn && adminProfile?.name) {
        continueBtn.textContent = `Fortsæt som ${adminProfile.name}`;
        continueBtn.style.display = '';
        continueBtn.disabled = false;
    } else if (continueBtn) {
        continueBtn.style.display = 'none';
        continueBtn.disabled = true;
    }

    // Knap: Log ud & Lås Café
    document.getElementById('lock-cafe-btn').onclick = async () => {
        await supabaseClient.auth.signOut();
        location.reload();
    };

    // Knap: Fortsæt som Admin
    if (continueBtn) {
        continueBtn.onclick = () => {
            setCurrentClerk(adminProfile);
            markAppStarted();
            setSessionStartTime(Date.now());
            // Set admin flag for keyboard shortcuts
            window.currentUserIsAdmin = adminProfile?.role === 'admin';
            showScreen('main-app');
            startApp(); // Admin er også ekspedient
        };
    }

    setupClerkLoginButton({
        adminProfile,
        supabaseClient,
        showAlert,
        showCustomAlert,
        showPinModal,
        showScreen,
        onClerkLoggedIn: (clerk) => {
            setCurrentClerk(clerk);
            markAppStarted();
            setSessionStartTime(Date.now());
            // Set admin flag for keyboard shortcuts
            window.currentUserIsAdmin = clerk?.role === 'admin';
            showScreen('main-app');
            startApp();
        },
    });
}
