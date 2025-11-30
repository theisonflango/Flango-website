import {
    renderCustomerListUI,
    setupCustomerSearchKeyboardNavigation,
    openCustomerSelectionModalUI,
    setupCustomerPickerControls,
} from '../ui/customer-picker.js';
import { supabaseClient } from '../core/config-and-supabase.js';
import { getCurrentInstitutionId } from './users-and-admin.js';

let latestCustomerPickerUsers = null;

async function refreshCustomerPickerUsersFromDatabase() {
    try {
        const adminProfile = window.__flangoCurrentAdminProfile || null;
        const clerkProfile = window.__flangoCurrentClerkProfile || null;
        const institutionId = getCurrentInstitutionId(adminProfile, clerkProfile);

        let query = supabaseClient
            .from('users')
            .select('id, name, number, balance, role')
            .order('name', { ascending: true });

        if (institutionId) {
            query = query.eq('institution_id', institutionId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('refreshCustomerPickerUsersFromDatabase: Supabase fejl', error);
            return;
        }

        latestCustomerPickerUsers = data || null;
    } catch (err) {
        console.error('refreshCustomerPickerUsersFromDatabase: uventet fejl', err);
    }
}

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
        const allUsers = latestCustomerPickerUsers || getAllUsers();
        const currentSortKey = getCurrentSortKey();
        const balanceSortOrder = getBalanceSortOrder();
        renderCustomerListUI({
            allUsers,
            searchInput,
            currentSortKey,
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
        getBalanceSortOrder,
        setBalanceSortOrder,
        renderList: () => renderCustomerList(),
    });

    const openCustomerSelectionModal = async () => {
        // Hent friske saldoer fra databasen, så listen altid er ajour
        await refreshCustomerPickerUsersFromDatabase();

        openCustomerSelectionModalUI({
            userModal,
            searchInput,
            renderList: () => renderCustomerList(),
            resetView: resetUserModalView,
        });
        setupCustomerSearchKeyboardNavigation(userModal, searchInput);
    };

    const handleUserModalClick = (event) => {
        const clickedActionIcon = event.target.closest('.action-icon');
        if (clickedActionIcon) return;
        const clickedUserInfo = event.target.closest('.modal-entry-info');
        if (clickedUserInfo) {
            selectUser(clickedUserInfo.dataset.userId);
            userModal.style.display = 'none';
        }
    };

    userModal.addEventListener('click', handleUserModalClick);

    return {
        openCustomerSelectionModal,
        renderCustomerList,
    };
}
