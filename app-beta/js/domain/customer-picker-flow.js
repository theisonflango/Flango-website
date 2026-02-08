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
} from '../ui/customer-picker.js';

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
            renderList: () => renderCustomerList(),
            resetView: resetUserModalView,
        });
        setupCustomerSearchKeyboardNavigation(userModal, searchInput);

        // Setup filter buttons
        setupUserFilterButtons(() => renderCustomerList());
    };

    // Pick mode: allows external callers to open the modal and get a user back
    let pickResolve = null;

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
            openCustomerSelectionModal();

            // Watch for modal close (close button, backdrop click, Escape) → resolve null
            const observer = new MutationObserver(() => {
                if (userModal.style.display === 'none' && pickResolve) {
                    const r = pickResolve;
                    pickResolve = null;
                    observer.disconnect();
                    r(null);
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
