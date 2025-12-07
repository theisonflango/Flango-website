import { playSound, showAlert, showCustomAlert, openSoundSettingsModal } from '../ui/sound-and-alerts.js';
import { closeTopMostOverlay, suspendSettingsReturn, resumeSettingsReturn, showScreen } from '../ui/shell-and-theme.js';
import { configureHistoryModule, showSalesHistory } from './history-and-reports.js';
import { setupLogoutFlow } from './logout-flow.js';
import { getFinancialState, setCurrentCustomer, getCurrentCustomer } from './cafe-session-store.js';
import { getOrderTotal } from './order-store.js';
import { updateTotalPrice, renderOrder, handleOrderListClick, addToOrder, removeLastItemFromOrder } from './order-ui.js';
import { renderProductsInModal, renderProductsGrid, createProductManagementUI } from '../ui/product-management.js';
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
    let allUsers = [];
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

    // 2) Vis café-UI
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
    const refreshProductLocks = async () => {
        const productsEl = document.getElementById('products');
        const selectedUser = getCurrentCustomer();
        const childId = selectedUser?.id || null;
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
        userDisplay.textContent = `Ekspedient: ${clerkName}   •   Voksen ansvarlig: ${adultName}`;

        const storageKey = `${AVATAR_STORAGE_PREFIX}${clerkProfile.id}`;
        let savedAvatar = localStorage.getItem(storageKey);
        if (!savedAvatar) {
            savedAvatar = DEFAULT_AVATAR_URL;
            localStorage.setItem(storageKey, savedAvatar);
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
        setAllUsers: (next) => { allUsers = next; },
        selectUserBtn,
        openCustomerSelectionModal: () => customerPicker.openCustomerSelectionModal(),
        userModal,
        searchUserInput,
    });

    // 9) Admin- og sortimentflows
    const adminFlow = setupAdminFlow({
        adminProfile,
        clerkProfile,
        supabaseClient,
        getAllUsers,
        setAllUsers: (next) => { allUsers = next; },
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
        showSalesHistory,
        settingsMinFlangoStatusBtn,
        showAlert,
    });

    // 11) Opsæt avatar-vælgeren for alle brugere
    await setupAvatarPicker({
        clerkProfile,
        sessionStartTime,
        getSessionSalesCount: () => sessionSalesCount,
        AVATAR_STORAGE_PREFIX,
        updateLoggedInUserDisplay,
    });

    // 12) Første produkt-load
    await productAssortment.fetchAndRenderProducts();

    async function selectUser(userId) {
        // Ryd den gamle ordre FØR vi sætter en ny bruger.
        // Dette sikrer, at `applyProductLimitsToButtons` ikke bruger en forældet kurv.
        currentOrder = [];
        renderOrder(orderList, currentOrder, totalPriceEl, updateSelectedUserInfo);

        const selectedUser = allUsers.find(u => u.id === userId);
        if (!selectedUser) return;

        setCurrentCustomer(selectedUser);

        // Preload dagens købs-snapshot og VENT på, at låsene er anvendt.
        await preloadChildProductLimitSnapshot(selectedUser.id);
        const productsContainer = document.getElementById('products');
        // Tving brug af en tom kurv, da vi lige har valgt en ny bruger.
        await applyProductLimitsToButtons(allProducts, productsContainer, [], selectedUser.id);
 
        // Kør først UI-opdatering EFTER alle asynkrone kald er færdige.
        updateSelectedUserInfo(); 
        userModal.style.display = 'none';
    }

    function updateSelectedUserInfo() {
        const userInfoEl = document.getElementById('selected-user-info');
        const selectedUser = getCurrentCustomer();
        if (!userInfoEl) return;

        if (!selectedUser) {
            userInfoEl.style.display = 'none';
            return;
        }

        // Brug den centrale order-store til totalen
        const total = getOrderTotal();

        // Brug cafe-session-store til den finansielle tilstand
        const finance = getFinancialState(total);

        // Robust udregning af nuværende saldo og ny saldo
        const currentBalance = Number.isFinite(finance.balance)
            ? finance.balance
            : (Number.isFinite(selectedUser.balance) ? selectedUser.balance : 0);

        const newBalance = Number.isFinite(finance.newBalance)
            ? finance.newBalance
            : currentBalance - total;

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
    }

    // Admin-handlinger i brugerlisten
    userModal.addEventListener('click', (event) => {
        const clickedActionIcon = event.target.closest('.action-icon');
        if (clickedActionIcon && adminFlow?.handleUserListClick) {
            adminFlow.handleUserListClick(event);
        }
    });

    window.__flangoUndoLastSale = () => handleUndoLastSale();
    window.__flangoUndoPreviousSale = () => handleUndoPreviousSale();
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
            showScreen('main-app');
            startApp();
        },
    });
}
