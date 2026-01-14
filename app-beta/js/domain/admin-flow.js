import { showAlert, showCustomAlert, playSound } from '../ui/sound-and-alerts.js';
import { setupCustomerSearchKeyboardNavigation } from '../ui/customer-picker.js';
import { showAddUserModal, showBalanceModal } from '../ui/user-modals.js';
import { createAdminUserActions } from '../ui/admin-user-actions.js';
import { setupAdminUserManagerFromModule } from '../ui/admin-user-manager.js';
import { createParentPortalAdminUI } from '../ui/parent-portal-admin.js';
import { mergeUsersWithParentNotifications } from './users-and-admin.js';
import { runWithAuthRetry } from '../core/auth-retry.js';

export async function loadUsersAndNotifications({
    adminProfile,
    supabaseClient,
    setAllUsers,
    selectUserBtn,
    openCustomerSelectionModal,
    userModal,
    searchUserInput,
}) {
    console.log('Ekspedient eller admin logget ind. Henter alle brugere og notifikationer...');
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) adminPanel.style.display = 'block';

    const institutionId = adminProfile.institution_id;

    // Tjek om admins skal vises i bruger-listen (med fejlhåndtering)
    let showAdminsInList = true; // Default: vis ALLE brugere (backward compatible)
    let adminsPurchaseFree = false;
    let shiftTimerEnabled = false; // Default: bytte-timer er IKKE aktiveret (skal aktiveres manuelt)

    // OPTIMERING: Brug memory cache først (0 DB kald)
    let institutionData = typeof window !== 'undefined' && typeof window.__flangoGetInstitutionById === 'function'
        ? window.__flangoGetInstitutionById(institutionId)
        : null;

    // Hvis cache mangler shift_timer_enabled, hent fra DB (cache kan være forældet)
    const needsDbFetch = !institutionData || !('shift_timer_enabled' in institutionData);
    
    if (needsDbFetch) {
        try {
            const { data: dbData, error: institutionError } = await supabaseClient
                .from('institutions')
                .select('show_admins_in_user_list, admins_purchase_free, shift_timer_enabled')
                .eq('id', institutionId)
                .single();

            if (!institutionError && dbData) {
                institutionData = dbData;
            } else {
                console.warn('[admin-flow] Kunne ikke hente institution settings (måske migration ikke kørt endnu):', institutionError);
            }
        } catch (err) {
            console.warn('[admin-flow] Fejl ved hentning af institution settings, bruger defaults:', err);
        }
    }

    // Anvend settings fra cache eller DB
    if (institutionData) {
        if (typeof institutionData.show_admins_in_user_list === 'boolean') {
            showAdminsInList = institutionData.show_admins_in_user_list;
        }
        if (typeof institutionData.admins_purchase_free === 'boolean') {
            adminsPurchaseFree = institutionData.admins_purchase_free;
        }
        // Håndter shift_timer_enabled: både boolean true/false og null (behandles som false)
        if (institutionData.shift_timer_enabled !== undefined) {
            shiftTimerEnabled = institutionData.shift_timer_enabled === true;
        }
    }

    // Gem settings globalt så de kan bruges i purchase flow og shift-timer
    window.__flangoInstitutionSettings = {
        showAdminsInUserList: showAdminsInList,
        adminsPurchaseFree: adminsPurchaseFree,
        shiftTimerEnabled: shiftTimerEnabled
    };

    const buildUsersQuery = () => {
        // Byg bruger-query baseret på settings
        let usersQuery = supabaseClient
            .from('users')
            .select('*, last_parent_login_at, parent_pin_is_custom')
            .eq('institution_id', institutionId);

        // Hvis admins IKKE skal vises, filtrer kun til børn/kunder
        // VIGTIGT: Kun filtrer hvis settings eksplicit er sat til false
        if (showAdminsInList === false) {
            usersQuery = usersQuery.eq('role', 'kunde');
            console.log('[admin-flow] Filtrerer bruger-liste til kun kunder (role = kunde)');
        } else {
            console.log('[admin-flow] Viser alle brugere i bruger-liste');
        }

        return usersQuery.order('name');
    };

    const buildNotificationsQuery = () => supabaseClient
        .from('parent_notifications')
        .select('user_id, notify_at_zero, notify_at_ten')
        .eq('institution_id', institutionId);

    const [usersResponse, notificationsResponse] = await Promise.all([
        runWithAuthRetry('loadUsers', buildUsersQuery),
        runWithAuthRetry('loadParentNotifications', buildNotificationsQuery)
    ]);

    const { data: usersData, error: usersError } = usersResponse;
    const { data: parentNotifications, error: notifError } = notificationsResponse;

    if (usersError) {
        showAlert('Fejl ved hentning af brugerliste: ' + usersError.message);
        return;
    }
    if (notifError) {
        console.warn('Kunne ikke hente notifikationsindstillinger:', notifError);
    }

    const allUsers = mergeUsersWithParentNotifications(usersData, parentNotifications);
    setAllUsers(allUsers);

    console.log('Brugerliste og notifikationer hentet og kombineret:', allUsers);

    if (selectUserBtn) {
        selectUserBtn.style.display = 'block';
        selectUserBtn.onclick = () => openCustomerSelectionModal();
    }

    setupCustomerSearchKeyboardNavigation(userModal, searchUserInput);
}

export function setupAdminFlow({
    adminProfile,
    clerkProfile,
    supabaseClient,
    getAllUsers,
    setAllUsers,
    renderSelectedUserInfo,
    getCurrentSortKey,
    setCurrentSortKey,
    getBalanceSortOrder,
    setBalanceSortOrder,
}) {
    let adminManagerMode = 'customers';
    const getAdminManagerMode = () => adminManagerMode;
    const setAdminManagerMode = (value) => {
        adminManagerMode = value;
    };

    const renderAdminUserList = () => {
        if (typeof window.__flangoRenderAdminUserList === 'function') {
            window.__flangoRenderAdminUserList();
        }
    };

    async function handleAddUser() {
        const isAdminMode = adminManagerMode === 'admins';
        const userData = await showAddUserModal({
            preferredRole: isAdminMode ? 'admin' : 'kunde',
            lockRole: isAdminMode,
            titleOverride: isAdminMode ? 'Tilføj Admin' : null
        });
        const reopenAdminManager = () => window.__flangoOpenAdminUserManager?.(adminManagerMode);

        if (!userData) {
            reopenAdminManager();
            return;
        }

        const {
            data: { session },
        } = await supabaseClient.auth.getSession();
        if (!session) return showAlert("Fejl: Du er ikke logget ind.");

        const { data: newUser, error } = await supabaseClient.functions.invoke(
            "create-user",
            {
                body: userData,
                headers: { "x-admin-user-id": session.user.id },
            }
        );

        if (error) {
            let errorMessage = error.message || "Ukendt fejl.";
            try {
                if (error.context && typeof error.context.json === "function") {
                    const errorBody = await error.context.json();
                    if (errorBody && errorBody.error) {
                        errorMessage = errorBody.error;
                    }
                }
            } catch (e) {
                // Ignorer parsing-fejl
            }
            reopenAdminManager();
            return showAlert(`Fejl ved oprettelse: ${errorMessage}`);
        }

        const allUsers = getAllUsers();
        allUsers.push(newUser);
        renderAdminUserList();
        reopenAdminManager();

        await showCustomAlert(
            "Bruger oprettet",
            `Brugeren '<strong>${userData.name}</strong>' er blevet oprettet.`
        );
    }

    const {
        handleDeposit,
        handleEditBalance,
        handleDeleteUser,
        handleUserListClick,
    } = createAdminUserActions({
        getAllUsers,
        setAllUsers,
        adminProfile,
        supabaseClient,
        showAlert,
        showCustomAlert,
        showBalanceModal,
        playSound,
        renderAdminUserList,
        updateSelectedUserInfo: renderSelectedUserInfo,
    });

    const parentPortalAdminUI = createParentPortalAdminUI({
        clerkProfile,
        adminProfile,
        supabaseClient,
        showAlert,
        showCustomAlert,
        getAllUsers,
    });

    if (clerkProfile.role === 'admin') {
        setupAdminUserManagerFromModule({
            allUsers: getAllUsers(),
            getAllUsers,
            clerkProfile,
            supabaseClient,
            adminProfile,
            getCurrentSortKey,
            setCurrentSortKey,
            getBalanceSortOrder,
            setBalanceSortOrder,
            onAddUserClick: handleAddUser,
            onUserListClick: handleUserListClick,
            getAdminManagerMode,
            setAdminManagerMode,
        });
    }

    return {
        handleUserListClick,
        handleDeposit,
        handleEditBalance,
        handleDeleteUser,
        parentPortalAdminUI,
        getAdminManagerMode,
        setAdminManagerMode,
    };
}
