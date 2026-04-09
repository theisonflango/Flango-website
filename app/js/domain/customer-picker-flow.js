import {
    renderCustomerListUI,
    setupCustomerSearchKeyboardNavigation,
    openCustomerSelectionModalUI,
    setupCustomerPickerControls,
    setupUserFilterButtons,
    resetUserFilters,
    getNameSortOrder,
    setNameSortOrder,
    getNumberSortOrder,
    setNumberSortOrder,
} from '../ui/customer-picker.js?v=3.0.65';

export function setupCustomerPickerFlow({
    getAllUsers,
    getCurrentSortKey,
    setCurrentSortKey,
    getBalanceSortOrder,
    setBalanceSortOrder,
    selectUser,
    userModal,
    searchInput,
    sortByNameBtn,
    sortByNumberBtn,
    sortByBalanceBtn,
    resetUserModalView,
}) {
    const renderCustomerList = () => {
        const allUsers = getAllUsers(); // Use in-memory data directly
        const currentSortKey = getCurrentSortKey();
        const nameSortOrder = getNameSortOrder();
        const numberSortOrder = getNumberSortOrder();
        const balanceSortOrder = getBalanceSortOrder();
        renderCustomerListUI({
            allUsers,
            searchInput,
            currentSortKey,
            nameSortOrder,
            numberSortOrder,
            balanceSortOrder,
            sortByNameBtn,
            sortByNumberBtn,
            sortByBalanceBtn,
        });
    };

    setupCustomerPickerControls({
        searchInput,
        sortByNameBtn,
        sortByNumberBtn,
        sortByBalanceBtn,
        getCurrentSortKey,
        setCurrentSortKey,
        getNameSortOrder,
        setNameSortOrder,
        getNumberSortOrder,
        setNumberSortOrder,
        getBalanceSortOrder,
        setBalanceSortOrder,
        renderList: () => renderCustomerList(),
    });

    const openCustomerSelectionModal = () => {
        // Reset filters til default når modal åbnes
        resetUserFilters();

        // Use in-memory data - no database fetch needed
        openCustomerSelectionModalUI({
            userModal,
            searchInput,
            allUsers: getAllUsers(),
            renderList: () => renderCustomerList(),
            resetView: resetUserModalView,
        });
        setupCustomerSearchKeyboardNavigation(userModal, searchInput);

        // Setup filter buttons
        setupUserFilterButtons(() => renderCustomerList());
    };

    // Pick mode: allows external callers to open the modal and get a user back
    let pickResolve = null;
    const userListContainer = document.getElementById('modal-user-list');

    const handleUserModalClick = async (event) => {
        const clickedActionIcon = event.target.closest('.action-icon');
        if (clickedActionIcon) return;
        const clickedUserInfo = event.target.closest('.modal-entry-info');
        if (clickedUserInfo) {
            const userId = clickedUserInfo.dataset.userId;

            // Pick mode — resolve promise with user object, no café side effects
            if (pickResolve) {
                const allUsers = getAllUsers();
                const user = allUsers.find(u => u.id === userId);
                userModal.style.display = 'none';
                const resolve = pickResolve;
                pickResolve = null;
                resolve(user || null);
                return;
            }

            // Safety: if modal is in pick mode but pickResolve was lost, don't selectUser
            if (userModal.dataset.pickMode === 'true') {
                userModal.style.display = 'none';
                delete userModal.dataset.pickMode;
                return;
            }

            // Normal café mode
            await selectUser(userId);
            userModal.style.display = 'none';
        }
    };

    userModal.addEventListener('click', handleUserModalClick);

    // Expose pick mode hook — opens customer picker and returns selected user (or null)
    window.__flangoPickUser = () => {
        return new Promise((resolve) => {
            pickResolve = resolve;
            userModal.dataset.pickMode = 'true';
            openCustomerSelectionModal();

            // Direct click handler on userListContainer — fires BEFORE the delegated
            // handler on userModal and uses stopPropagation to prevent café-mode selectUser.
            // This mirrors the proven pattern from clerk-login-modal.js.
            const handlePickClick = (evt) => {
                const target = evt.target.closest('.modal-entry-info');
                if (!target) return;

                evt.stopPropagation(); // Prevent handleUserModalClick on userModal

                const userId = target.dataset.userId;
                const allUsers = getAllUsers();
                const user = allUsers.find(u => u.id === userId);

                userModal.style.display = 'none';
                cleanupPick();
                resolve(user || null);
            };

            const cleanupPick = () => {
                pickResolve = null;
                delete userModal.dataset.pickMode;
                if (userListContainer) {
                    userListContainer.removeEventListener('click', handlePickClick);
                }
                observer.disconnect();
            };

            if (userListContainer) {
                userListContainer.addEventListener('click', handlePickClick);
            }

            // Watch for modal close (close button, backdrop click, Escape) → resolve null
            const observer = new MutationObserver(() => {
                if (userModal.style.display === 'none' && pickResolve) {
                    cleanupPick();
                    resolve(null);
                }
            });
            observer.observe(userModal, { attributes: true, attributeFilter: ['style'] });
        });
    };

    return {
        openCustomerSelectionModal,
        renderCustomerList,
    };
}
