import { updateCustomerBalanceGlobally } from '../core/balance-manager.js';
import { refetchUserBalance } from '../core/data-refetch.js';

export function createAdminUserActions(options = {}) {
    const {
        getAllUsers,
        setAllUsers,
        adminProfile,
        supabaseClient,
        showAlert,
        showCustomAlert,
        showBalanceModal,
        playSound,
        renderAdminUserList,
        updateSelectedUserInfo,
    } = options;

    if (
        typeof getAllUsers !== 'function' ||
        typeof setAllUsers !== 'function' ||
        !supabaseClient ||
        !showAlert ||
        !showCustomAlert ||
        !showBalanceModal ||
        !playSound ||
        !renderAdminUserList ||
        !updateSelectedUserInfo
    ) {
        console.warn('[admin-user-actions] Missing required options, handlers will be no-ops');
    }

    async function handleDeposit(userId) {
        const users = (typeof getAllUsers === 'function') ? getAllUsers() : [];
        const user = users.find(u => u.id === userId);
        if (!user) return;

        const amount = await showBalanceModal(user, 'deposit');
        if (amount === null) {
            // Brugeren annullerede - fokuser søgefeltet
            if (typeof window.__flangoFocusAdminSearchInput === 'function') {
                window.__flangoFocusAdminSearchInput();
            }
            return;
        }
        if (isNaN(amount) || amount <= 0) return showAlert("Ugyldigt beløb.");

        const { error } = await supabaseClient.rpc('make_deposit', { p_target_user_id: userId, p_amount: amount });
        if (error) return showAlert(`Fejl: ${error.message}`);

        // REFETCH PATTERN: Hent faktisk balance fra database for garanteret nøjagtighed
        console.log('[handleDeposit] Refetching balance from database...');
        const newBalance = await refetchUserBalance(userId);
        if (newBalance !== null) {
            // Broadcast balance change event for UI listeners
            updateCustomerBalanceGlobally(userId, newBalance, amount, 'admin-deposit');
        } else {
            // Fallback til beregnet værdi hvis refetch fejler
            updateCustomerBalanceGlobally(userId, user.balance + amount, amount, 'admin-deposit');
        }

        renderAdminUserList();
        updateSelectedUserInfo(); // Opdater hvis brugeren er valgt
        playSound('balanceUpdate');
        console.log('[handleDeposit] Deposit completed, UI refreshed');

        // Luk balance modal eksplicit (skulle allerede være lukket, men for at være sikker)
        const balanceModal = document.getElementById('balance-modal');
        if (balanceModal) {
            balanceModal.style.display = 'none';
        }

        await showCustomAlert('Success!', `Indbetaling på ${amount.toFixed(2)} kr. til ${user.name} er gennemført.`);

        // Ryd og fokuser søgefeltet efter succesfuld indbetaling
        if (typeof window.__flangoClearAndFocusAdminSearchInput === 'function') {
            window.__flangoClearAndFocusAdminSearchInput();
        }
    }

    async function handleEditBalance(userId) {
        const users = (typeof getAllUsers === 'function') ? getAllUsers() : [];
        const user = users.find(u => u.id === userId);
        if (!user) return;

        const newBalance = await showBalanceModal(user, 'edit');
        if (newBalance === null) {
            // Brugeren annullerede - fokuser søgefeltet
            if (typeof window.__flangoFocusAdminSearchInput === 'function') {
                window.__flangoFocusAdminSearchInput();
            }
            return;
        }
        if (isNaN(newBalance)) return showAlert("Ugyldigt beløb.");

        const { error } = await supabaseClient.rpc('edit_balance', { p_target_user_id: userId, p_new_balance: newBalance });
        if (error) return showAlert(`Fejl ved opdatering af saldo: ${error.message}`);

        // REFETCH PATTERN: Hent faktisk balance fra database for garanteret nøjagtighed
        console.log('[handleEditBalance] Refetching balance from database...');
        const confirmedBalance = await refetchUserBalance(userId);
        const actualBalance = confirmedBalance !== null ? confirmedBalance : newBalance;
        const delta = actualBalance - user.balance;

        updateCustomerBalanceGlobally(userId, actualBalance, delta, 'admin-balance-edit');
        renderAdminUserList();
        updateSelectedUserInfo(); // Opdater hvis brugeren er valgt
        playSound('balanceUpdate');
        console.log('[handleEditBalance] Balance edit completed, UI refreshed');
        await showCustomAlert('Success!', `${user.name}'s saldo er blevet sat til ${actualBalance.toFixed(2)} kr.`);

        // Fokuser søgefeltet efter succesfuld opdatering
        if (typeof window.__flangoFocusAdminSearchInput === 'function') {
            window.__flangoFocusAdminSearchInput();
        }
    }

    async function handleDeleteUser(userId) {
        const users = (typeof getAllUsers === 'function') ? getAllUsers() : [];
        const user = users.find(u => u.id === userId);
        if (!user) return; // Bruger ikke fundet

        if (adminProfile && user.id === adminProfile.id) {
            return showAlert("Du kan ikke slette din egen admin-profil, mens du er logget ind.");
        }

        const confirmed = await showCustomAlert(
            'Bekræft Sletning',
            `Er du sikker på, at du vil slette <strong>${user.name}</strong>?`,
            'confirm'
        );
        if (!confirmed) {
            // Brugeren annullerede - fokuser søgefeltet
            if (typeof window.__flangoFocusAdminSearchInput === 'function') {
                window.__flangoFocusAdminSearchInput();
            }
            return;
        }

        const { error } = await supabaseClient.rpc('delete_user_safely', { p_user_profile_id: userId });
        if (error) return showAlert(`Fejl: ${error.message}`);

        const nextUsers = users.filter(u => u.id !== userId);
        setAllUsers(nextUsers);
        renderAdminUserList();

        // Fokuser søgefeltet efter sletning
        if (typeof window.__flangoFocusAdminSearchInput === 'function') {
            window.__flangoFocusAdminSearchInput();
        }
    }

    function handleUserListClick(event) {
        const target = event.target.closest('.action-icon, .admin-action-btn');
        if (!target) return;
        const userId = target.dataset.id;

        const actionType = target.dataset.userAction || '';
        if (actionType === 'deposit' || target.classList.contains('deposit-icon')) {
            handleDeposit(userId);
        } else if (actionType === 'edit' || target.classList.contains('edit-balance-icon')) {
            handleEditBalance(userId);
        } else if (actionType === 'delete' || target.classList.contains('delete-user-icon')) {
            handleDeleteUser(userId);
        }
    }

    return {
        handleDeposit,
        handleEditBalance,
        handleDeleteUser,
        handleUserListClick,
    };
}
