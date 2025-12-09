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

    const handleUserModalClick = async (event) => {
        const clickedActionIcon = event.target.closest('.action-icon');
        if (clickedActionIcon) return;
        const clickedUserInfo = event.target.closest('.modal-entry-info');
        if (clickedUserInfo) {
            await selectUser(clickedUserInfo.dataset.userId);
            userModal.style.display = 'none';
        }
    };

    userModal.addEventListener('click', handleUserModalClick);

    return {
        openCustomerSelectionModal,
        renderCustomerList,
    };
}
