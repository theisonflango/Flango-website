import { playSound, showAlert, showCustomAlert, openSoundSettingsModal } from '../ui/sound-and-alerts.js';
import { initializeSoundSettings } from '../core/sound-manager.js';
import { closeTopMostOverlay, suspendSettingsReturn, resumeSettingsReturn, showScreen } from '../ui/shell-and-theme.js';
import { configureHistoryModule, showTransactionsInSummary } from './history-and-reports.js';
import { setupSummaryModal, openSummaryModal, closeSummaryModal, exportToCSV } from './summary-controller.js';
import { setupLogoutFlow } from './logout-flow.js';
import { getFinancialState, setCurrentCustomer, getCurrentCustomer, clearEvaluation } from './cafe-session-store.js';
import { getOrderTotal, setOrder } from './order-store.js';
import { updateTotalPrice, renderOrder, handleOrderListClick, addToOrder, removeLastItemFromOrder, removeOneItemByName } from './order-ui.js';
import { renderProductsInModal, renderProductsGrid, createProductManagementUI, updateProductQuantityBadges } from '../ui/product-management.js';
import { supabaseClient } from '../core/config-and-supabase.js';
import {
    CUSTOM_ICON_PREFIX,
    getCustomIconPath,
    preloadChildProductLimitSnapshot,
    applyProductLimitsToButtons,
} from './products-and-cart.js';
import { showPinModal } from '../ui/user-modals.js';
import { setupAvatarPicker } from '../ui/avatar-picker.js';
import { setupKeyboardShortcuts } from '../ui/keyboard-shortcuts.js';
import { setupRuntimeUIEvents } from '../ui/runtime-ui-events.js';
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
    let currentOrder = [];
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
    const refreshProductLocks = async (options = {}) => {
        const productsEl = document.getElementById('products');
        const selectedUser = getCurrentCustomer();
        const childId = selectedUser?.id || null;

        // VIGTIGT: Opdater quantity badges først så tallene er korrekte
        updateProductQuantityBadges();

        if (options.skipSnapshotRefresh) {
            // Skip full snapshot refresh (used for remove operations)
            // Just update UI classes without refetching snapshot
            if (selectedUser) {
                await applyProductLimitsToButtons(allProducts, productsEl, currentOrder, childId);
            }
            return;
        }

        // Full refresh path (for add operations)
        await applyProductLimitsToButtons(allProducts, productsEl, currentOrder, childId);
    };
    const addToOrderWithLocks = (product, currentOrderArg, orderListArg, totalPriceArg, updateSelectedUserInfoArg, optionsArg = {}) =>
        addToOrder(product, currentOrderArg, orderListArg, totalPriceArg, updateSelectedUserInfoArg, { ...optionsArg, onOrderChanged: refreshProductLocks });

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

    function updateLoggedInUserDisplay() {
        const userDisplay = document.getElementById('logged-in-user');
        const avatarContainer = document.getElementById('logged-in-user-avatar-container');
        if (!userDisplay || !avatarContainer) return;

        const sessionAdmin = getCurrentSessionAdmin();
        const adultName = sessionAdmin?.name || '(ukendt)';
        const clerkName = clerkProfile?.name || adultName;
        userDisplay.textContent = `👤 ${clerkName}  |  🔐 ${adultName}`;

        const userId = clerkProfile.id;
        const storageKey = `${AVATAR_STORAGE_PREFIX}${userId}`;

        // OPTIMERING: Brug in-memory cache i stedet for synkron localStorage
        let savedAvatar;
        if (avatarCache.has(userId)) {
            savedAvatar = avatarCache.get(userId);
        } else {
            savedAvatar = localStorage.getItem(storageKey);
            if (!savedAvatar) {
                savedAvatar = DEFAULT_AVATAR_URL;
                localStorage.setItem(storageKey, savedAvatar);
            }
            avatarCache.set(userId, savedAvatar);
        }

        avatarContainer.innerHTML = `<img src="${savedAvatar}" alt="Valgt avatar" id="logged-in-user-avatar">`;

        const avatarImg = avatarContainer.querySelector('#logged-in-user-avatar');
        if (avatarImg) {
            avatarContainer.onclick = () => window.__flangoOpenAvatarPicker?.();
        }
    }
    updateLoggedInUserDisplay();

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
    completePurchaseBtn.addEventListener('click', () => handleCompletePurchase({
        customer: getCurrentCustomer(),
        currentOrder,
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
    }));

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
                await productAssortment.fetchAndRenderProducts();
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

        undoLastSaleBtn.addEventListener('click', () => handleUndoLastSale());

    // 6) UI-input flows
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
        showSalesHistory: () => openSummaryModal(getInstitutionId(), 'transactions'),
        settingsMinFlangoStatusBtn,
        showAlert,
    });

    // Setup summary/opsummering modal
    const institutionId = getInstitutionId();
    setupSummaryModal(institutionId);

    // Setup global function for loading transactions in summary modal
    window.__flangoLoadTransactionsInSummary = () => {
        showTransactionsInSummary();
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
    function updateAvatarStorage(userId, avatarUrl) {
        const storageKey = `${AVATAR_STORAGE_PREFIX}${userId}`;
        localStorage.setItem(storageKey, avatarUrl);
        avatarCache.set(userId, avatarUrl);
    }

    // 11) Opsæt avatar-vælgeren for alle brugere
    await setupAvatarPicker({
        clerkProfile,
        sessionStartTime,
        getSessionSalesCount: () => sessionSalesCount,
        AVATAR_STORAGE_PREFIX,
        updateLoggedInUserDisplay,
        updateAvatarStorage,
    });

    // 12) Første produkt-load
    await productAssortment.fetchAndRenderProducts();

    async function selectUser(userId) {
        // Tjek om samme bruger allerede er valgt
        const currentCustomer = getCurrentCustomer();
        if (currentCustomer && currentCustomer.id === userId) {
            // Samme bruger - luk bare modalen uden at gøre noget
            userModal.style.display = 'none';
            return;
        }

        // Ryd den gamle ordre FØR vi sætter en ny bruger.
        // Dette sikrer, at `applyProductLimitsToButtons` ikke bruger en forældet kurv.
        currentOrder = [];
        setOrder([]); // KRITISK: Sync order-store module state så getOrderTotal() returnerer 0
        clearEvaluation(); // Ryd evaluation cache så "Ny Saldo" vises korrekt
        renderOrder(orderList, currentOrder, totalPriceEl, updateSelectedUserInfo);

        const selectedUser = allUsers.find(u => u.id === userId);
        if (!selectedUser) return;

        setCurrentCustomer(selectedUser);

        // Preload dagens købs-snapshot og VENT på, at låsene er anvendt.
        await preloadChildProductLimitSnapshot(selectedUser.id);
        const productsContainer = document.getElementById('products');

        // KRITISK: Genrender produktgitter med refill-beregning for valgt barn
        await renderProductsGrid(
            allProducts,
            productsContainer,
            async (product, evt) => {
                const result = await addToOrder(product, currentOrder, orderList, totalPriceEl, updateSelectedUserInfo, { sourceEvent: evt });
                // Opdater låse efter tilføjelse til kurv
                await applyProductLimitsToButtons(allProducts, productsContainer, currentOrder, selectedUser.id);
                return result;
            },
            selectedUser // Send currentCustomer så refill kan beregnes
        );

        // Sørg for at alle knapper har et låse-overlay
        productsContainer.querySelectorAll('.product-btn').forEach(btn => {
            if (!btn.querySelector('.product-lock-overlay')) {
                const overlay = document.createElement('div');
                overlay.className = 'avatar-lock-overlay product-lock-overlay';
                btn.appendChild(overlay);
            }
        });

        // Opdater quantity badges efter produkterne er genrenderet
        updateProductQuantityBadges();

        // KRITISK: Re-initialiser drag-and-drop efter produkterne er genrenderet
        if (productAssortment?.initProductReorder) {
            productAssortment.initProductReorder();
        }

        // Tving brug af en tom kurv, da vi lige har valgt en ny bruger.
        await applyProductLimitsToButtons(allProducts, productsContainer, [], selectedUser.id);

        // Kør først UI-opdatering EFTER alle asynkrone kald er færdige.
        updateSelectedUserInfo();
        userModal.style.display = 'none';
    }

    function updateSelectedUserInfo() {
        try {
            const userInfoEl = document.getElementById('selected-user-info');
            console.log('[app-main] updateSelectedUserInfo START - element:', userInfoEl);

            if (!userInfoEl) {
                console.error('[app-main] CRITICAL: #selected-user-info element not found!');
                return;
            }

            const selectedUser = getCurrentCustomer();
            console.log('[app-main] selectedUser:', selectedUser);

            if (!selectedUser) {
                console.log('[app-main] No user selected - showing empty state');
                // Vis boks med "Ingen kunde valgt" i stedet for at skjule
                userInfoEl.innerHTML = `
                    <div class="info-box" style="grid-column: 1 / -1;">
                        <span class="info-box-label">Status</span>
                        <span class="info-box-value">Ingen kunde valgt</span>
                    </div>
                `;
                userInfoEl.style.display = 'grid';
                console.log('[app-main] Empty state HTML set, children count:', userInfoEl.children.length);
                return;
            }

            // Brug den centrale order-store til totalen
            const total = getOrderTotal();
            console.log('[app-main] Order total:', total);

            // Brug cafe-session-store til den finansielle tilstand
            const finance = getFinancialState(total);
            console.log('[app-main] Financial state:', finance);

            // Robust udregning af nuværende saldo og ny saldo
            const currentBalance = Number.isFinite(finance.balance)
                ? finance.balance
                : (Number.isFinite(selectedUser.balance) ? selectedUser.balance : 0);

            const newBalance = Number.isFinite(finance.newBalance)
                ? finance.newBalance
                : currentBalance - total;

            console.log(`[app-main] ABOUT TO SET HTML - currentBalance: ${currentBalance}, newBalance: ${newBalance}`);

            userInfoEl.innerHTML = `
                <div class="info-box">
                    <span class="info-box-label">Valgt:</span>
                    <span class="info-box-value">${selectedUser.name}</span>
                </div>
                <div class="info-box">
                    <span class="info-box-label">Nuværende Saldo:</span>
                    <span class="info-box-value">${currentBalance.toFixed(2)} kr.</span>
                </div>
                <div class="info-box">
                    <span class="info-box-label">Ny Saldo:</span>
                    <span class="info-box-value ${newBalance < 0 ? 'negative' : ''}">${newBalance.toFixed(2)} kr.</span>
                </div>
            `;
            userInfoEl.style.display = 'grid';

            console.log('[app-main] HTML SET! Children count:', userInfoEl.children.length);
            console.log('[app-main] HTML content:', userInfoEl.innerHTML.substring(0, 100) + '...');
        } catch (error) {
            console.error('[app-main] ERROR in updateSelectedUserInfo:', error);
            console.error('[app-main] Error stack:', error.stack);
        }
    }

    // Register listener for balance changes to update UI
    onBalanceChange('main-ui-updater', (event) => {
        const { userId, newBalance, delta, source } = event;

        // If this is the currently selected customer, update UI
        const currentCustomer = getCurrentCustomer();
        if (currentCustomer && currentCustomer.id === userId) {
            console.log(`[app-main] Balance changed for selected customer: ${newBalance} kr (${source})`);
            updateSelectedUserInfo();
        }
    });

    // Admin-handlinger i brugerlisten
    userModal.addEventListener('click', (event) => {
        const clickedActionIcon = event.target.closest('.action-icon');
        if (clickedActionIcon && adminFlow?.handleUserListClick) {
            adminFlow.handleUserListClick(event);
        }
    });

    window.__flangoUndoLastSale = () => handleUndoLastSale();
    window.__flangoUndoPreviousSale = () => handleUndoPreviousSale();

    // KRITISK: Initialiser selected-user-info boksen ved app start
    console.log('[app-main] startApp complete - initializing selected-user-info box');
    updateSelectedUserInfo();
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
