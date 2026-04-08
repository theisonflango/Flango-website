import { showAlert, showCustomAlert, playSound } from '../ui/sound-and-alerts.js?v=3.0.63';
import { setupCustomerSearchKeyboardNavigation } from '../ui/customer-picker.js?v=3.0.63';
import { showAddUserModal, showBalanceModal } from '../ui/user-modals.js?v=3.0.63';
import { createAdminUserActions } from '../ui/admin-user-actions.js?v=3.0.63';
import { setupAdminUserManagerFromModule } from '../ui/admin-user-manager.js?v=3.0.63';
import { setupEventAdminModule } from '../ui/event-admin.js?v=3.0.63';
import { createParentPortalAdminUI } from '../ui/parent-portal-admin.js?v=3.0.63';
import { mergeUsersWithParentNotifications } from './users-and-admin.js?v=3.0.63';
import { runWithAuthRetry } from '../core/auth-retry.js?v=3.0.63';
import { logAuditEvent } from '../core/audit-events.js?v=3.0.63';

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

    // Hent institution settings (shift_timer_enabled)
    let shiftTimerEnabled = false;

    // OPTIMERING: Brug memory cache først (0 DB kald)
    let institutionData = typeof window !== 'undefined' && typeof window.__flangoGetInstitutionById === 'function'
        ? window.__flangoGetInstitutionById(institutionId)
        : null;

    const needsDbFetch = !institutionData || !('shift_timer_enabled' in institutionData);

    if (needsDbFetch) {
        try {
            const { data: dbData, error: institutionError } = await supabaseClient
                .from('institutions')
                .select('shift_timer_enabled')
                .eq('id', institutionId)
                .single();

            if (!institutionError && dbData) {
                institutionData = dbData;
            } else {
                console.warn('[admin-flow] Kunne ikke hente institution settings:', institutionError);
            }
        } catch (err) {
            console.warn('[admin-flow] Fejl ved hentning af institution settings, bruger defaults:', err);
        }
    }

    if (institutionData) {
        if (institutionData.shift_timer_enabled !== undefined) {
            shiftTimerEnabled = institutionData.shift_timer_enabled === true;
        }
    }

    // Gem settings globalt (per-admin settings er nu på users tabellen)
    window.__flangoInstitutionSettings = {
        showAdminsInUserList: true, // Backward compat — per-admin show_in_user_list bruges nu
        adminsPurchaseFree: false, // Backward compat — per-admin purchase_free bruges nu
        shiftTimerEnabled: shiftTimerEnabled
    };

    const buildUsersQuery = () => {
        // Hent altid alle brugere (både børn og admins) — filtrering sker i customer-picker
        // baseret på per-admin show_in_user_list felt
        return supabaseClient
            .from('users')
            .select('*, last_parent_login_at, parent_pin_is_custom')
            .eq('institution_id', institutionId)
            .order('name');
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

        // Audit: log brugeroprettelse
        logAuditEvent('USER_CREATED', {
            institutionId: adminProfile.institution_id,
            adminUserId: session.user.id,
            targetUserId: newUser?.id,
            details: { name: userData.name, role: userData.role },
        });

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
        setupEventAdminModule({
            adminProfile,
            supabaseClient,
            getAllUsers,
            institutionId: adminProfile.institution_id,
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
