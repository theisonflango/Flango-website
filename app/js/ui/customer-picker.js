// js/ui/customer-picker.js
import { buildCustomerSelectionEntryElement } from '../domain/users-and-admin.js';

export function renderCustomerListUI(options) {
    const {
        allUsers,
        searchInput,
        currentSortKey,
        balanceSortOrder,
        sortByNameBtn,
        sortByNumberBtn,
        sortByBalanceBtn,
    } = options || {};

    const userListContainer = document.getElementById('modal-user-list');
    if (!userListContainer || !searchInput || !allUsers) return;

    const searchTerm = (searchInput.value || '').toLowerCase();

    let filteredUsers = allUsers.filter((u) => u.role === 'kunde');

    if (searchTerm) {
        filteredUsers = filteredUsers.filter((user) =>
            user.name.toLowerCase().includes(searchTerm) ||
            (user.number && user.number.includes(searchTerm))
        );
    }

    if (currentSortKey === 'balance') {
        filteredUsers.sort((a, b) =>
            balanceSortOrder === 'desc' ? b.balance - a.balance : a.balance - b.balance
        );
    } else if (currentSortKey === 'number') {
        filteredUsers.sort((a, b) => (a.number || '').localeCompare(b.number || ''));
    } else {
        filteredUsers.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Opdater sorterings-knappernes "active"-state, hvis de findes
    [sortByNameBtn, sortByNumberBtn, sortByBalanceBtn]
        .filter(Boolean)
        .forEach((btn) => btn.classList.remove('active'));

    const activeSortBtnId = `sort-by-${currentSortKey}-btn`;
    const activeSortBtn = document.getElementById(activeSortBtnId);
    if (activeSortBtn) {
        activeSortBtn.classList.add('active');
    }

    userListContainer.innerHTML = '';
    if (filteredUsers.length === 0) {
        userListContainer.innerHTML = `<p style="text-align:center; padding: 20px;">Ingen brugere fundet.</p>`;
        return;
    }

    filteredUsers.forEach((user, index) => {
        const entryEl = buildCustomerSelectionEntryElement(user, index, index === 0);
        userListContainer.appendChild(entryEl);
    });
}

export function setupCustomerSearchKeyboardNavigation(userModal, searchInput) {
    if (!userModal || !searchInput) return;

    searchInput.addEventListener('keydown', (e) => {
        const highlighted = userModal.querySelector('.highlight');
        if (!highlighted) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            highlighted.click();
        } else if (e.key === 'ArrowDown') {
            const nextRow = highlighted.closest('.modal-entry')?.nextElementSibling;
            if (nextRow) {
                e.preventDefault();
                highlighted.classList.remove('highlight');
                const nextInfo = nextRow.querySelector('.modal-entry-info');
                if (nextInfo) {
                    nextInfo.classList.add('highlight');
                }
            }
        } else if (e.key === 'ArrowUp') {
            const prevRow = highlighted.closest('.modal-entry')?.previousElementSibling;
            if (prevRow) {
                e.preventDefault();
                highlighted.classList.remove('highlight');
                const prevInfo = prevRow.querySelector('.modal-entry-info');
                if (prevInfo) {
                    prevInfo.classList.add('highlight');
                }
            }
        }
    });
}

export function openCustomerSelectionModalUI(options) {
    const {
        userModal,
        searchInput,
        renderList,
        resetView,
    } = options || {};

    if (!userModal || !searchInput || typeof renderList !== 'function' || typeof resetView !== 'function') {
        return;
    }

    // Nulstil modalens tilstand (titel, knapper, søgefelt osv.)
    resetView();

    // Render den aktuelle kundeliste
    renderList();

    // Vis modal
    userModal.style.display = 'flex';

    // Giv lidt tid til layout, derefter fokus i søgefeltet
    setTimeout(() => {
        try {
            searchInput.focus();
        } catch (e) {
            // Ignorer hvis elementet ikke kan fokuseres
        }
    }, 50);
}

export function setupCustomerPickerControls(options) {
    const {
        searchInput,
        sortByNameBtn,
        sortByNumberBtn,
        sortByBalanceBtn,
        getCurrentSortKey,
        setCurrentSortKey,
        getBalanceSortOrder,
        setBalanceSortOrder,
        renderList,
    } = options || {};

    if (!renderList || typeof renderList !== 'function') return;

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderList();
        });
    }

    if (sortByNameBtn) {
        sortByNameBtn.onclick = () => {
            if (typeof setCurrentSortKey === 'function') {
                setCurrentSortKey('name');
            }
            renderList();
        };
    }

    if (sortByNumberBtn) {
        sortByNumberBtn.onclick = () => {
            if (typeof setCurrentSortKey === 'function') {
                setCurrentSortKey('number');
            }
            renderList();
        };
    }

    if (sortByBalanceBtn) {
        sortByBalanceBtn.onclick = () => {
            const currentKey = typeof getCurrentSortKey === 'function'
                ? getCurrentSortKey()
                : 'balance';
            let currentOrder = typeof getBalanceSortOrder === 'function'
                ? getBalanceSortOrder()
                : 'desc';

            if (currentKey === 'balance') {
                currentOrder = currentOrder === 'desc' ? 'asc' : 'desc';
                if (typeof setBalanceSortOrder === 'function') {
                    setBalanceSortOrder(currentOrder);
                }
            }

            if (typeof setCurrentSortKey === 'function') {
                setCurrentSortKey('balance');
            }

            renderList();
        };
    }
}
