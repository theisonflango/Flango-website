// js/ui/customer-picker.js
import { buildCustomerSelectionEntryElement } from '../domain/users-and-admin.js';
import { SEARCH_DEBOUNCE_MS } from '../core/constants.js';

// Filter state - enklere: kun ét valg ad gangen
let userFilterMode = 'all'; // 'all' | 'children' | 'adults'

// Sort order state for each sortable column
let nameSortOrder = 'asc'; // 'asc' | 'desc'
let numberSortOrder = 'asc'; // 'asc' | 'desc'

// Debounce helper to reduce unnecessary renders during fast typing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function renderCustomerListUI(options) {
    const {
        allUsers,
        searchInput,
        currentSortKey,
        nameSortOrder: currentNameSortOrder,
        numberSortOrder: currentNumberSortOrder,
        balanceSortOrder,
        sortByNameBtn,
        sortByNumberBtn,
        sortByBalanceBtn,
    } = options || {};

    const userListContainer = document.getElementById('modal-user-list');
    if (!userListContainer || !searchInput || !allUsers) return;

    const searchTerm = (searchInput.value || '').toLowerCase();

    // Filtrer brugere baseret på filter mode
    let filteredUsers = allUsers;

    if (userFilterMode === 'children') {
        // Vis kun børn
        filteredUsers = filteredUsers.filter((u) => u.role === 'kunde');
    } else if (userFilterMode === 'adults') {
        // Vis kun voksne
        filteredUsers = filteredUsers.filter((u) => u.role === 'admin');
    }
    // else: userFilterMode === 'all' - vis alle brugere

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
        filteredUsers.sort((a, b) => {
            const comparison = (a.number || '').localeCompare(b.number || '');
            return currentNumberSortOrder === 'desc' ? -comparison : comparison;
        });
    } else {
        filteredUsers.sort((a, b) => {
            const comparison = a.name.localeCompare(b.name);
            return currentNameSortOrder === 'desc' ? -comparison : comparison;
        });
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

    // Use DocumentFragment for batched DOM insertion (reduces reflows)
    const fragment = document.createDocumentFragment();
    filteredUsers.forEach((user, index) => {
        const entryEl = buildCustomerSelectionEntryElement(user, index, index === 0);
        fragment.appendChild(entryEl);
    });
    userListContainer.appendChild(fragment);
}

// Global reference til keyboard handler for at undgå duplicate listeners
let currentKeyboardHandler = null;

export function setupCustomerSearchKeyboardNavigation(userModal, searchInput) {
    if (!userModal || !searchInput) return;

    // Fjern eksisterende listener hvis den findes
    if (currentKeyboardHandler) {
        searchInput.removeEventListener('keydown', currentKeyboardHandler);
    }

    // Opret ny handler
    currentKeyboardHandler = (e) => {
        // Tab-tast lukker modal (da Tab også bruges til at åbne den)
        if (e.key === 'Tab') {
            e.preventDefault();
            userModal.style.display = 'none';
            return;
        }

        const highlighted = userModal.querySelector('.highlight');
        if (!highlighted) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            highlighted.click();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const currentRow = highlighted.closest('.modal-entry');
            const nextRow = currentRow?.nextElementSibling;
            if (nextRow) {
                highlighted.classList.remove('highlight');
                const nextInfo = nextRow.querySelector('.modal-entry-info');
                if (nextInfo) {
                    nextInfo.classList.add('highlight');
                    // Scroll til synlig position hvis nødvendigt
                    nextInfo.scrollIntoView({ block: 'nearest', behavior: 'auto' });
                }
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const currentRow = highlighted.closest('.modal-entry');
            const prevRow = currentRow?.previousElementSibling;
            if (prevRow) {
                highlighted.classList.remove('highlight');
                const prevInfo = prevRow.querySelector('.modal-entry-info');
                if (prevInfo) {
                    prevInfo.classList.add('highlight');
                    // Scroll til synlig position hvis nødvendigt
                    prevInfo.scrollIntoView({ block: 'nearest', behavior: 'auto' });
                }
            }
        }
    };

    // Tilføj den nye listener
    searchInput.addEventListener('keydown', currentKeyboardHandler);
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
        getNameSortOrder,
        setNameSortOrder,
        getNumberSortOrder,
        setNumberSortOrder,
        getBalanceSortOrder,
        setBalanceSortOrder,
        renderList,
    } = options || {};

    if (!renderList || typeof renderList !== 'function') return;

    if (searchInput) {
        // Debounce search to reduce renders during fast typing
        const debouncedRender = debounce(renderList, SEARCH_DEBOUNCE_MS);
        searchInput.addEventListener('input', () => {
            debouncedRender();
        });
    }

    if (sortByNameBtn) {
        sortByNameBtn.onclick = () => {
            const currentKey = typeof getCurrentSortKey === 'function'
                ? getCurrentSortKey()
                : 'name';
            let currentOrder = typeof getNameSortOrder === 'function'
                ? getNameSortOrder()
                : 'asc';

            if (currentKey === 'name') {
                currentOrder = currentOrder === 'asc' ? 'desc' : 'asc';
                if (typeof setNameSortOrder === 'function') {
                    setNameSortOrder(currentOrder);
                }
            }

            if (typeof setCurrentSortKey === 'function') {
                setCurrentSortKey('name');
            }

            renderList();
        };
    }

    if (sortByNumberBtn) {
        sortByNumberBtn.onclick = () => {
            const currentKey = typeof getCurrentSortKey === 'function'
                ? getCurrentSortKey()
                : 'number';
            let currentOrder = typeof getNumberSortOrder === 'function'
                ? getNumberSortOrder()
                : 'asc';

            if (currentKey === 'number') {
                currentOrder = currentOrder === 'asc' ? 'desc' : 'asc';
                if (typeof setNumberSortOrder === 'function') {
                    setNumberSortOrder(currentOrder);
                }
            }

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

export function setupUserFilterButtons(renderList) {
    const filterButtonsContainer = document.getElementById('user-filter-buttons');
    const filterAllBtn = document.getElementById('filter-all-btn');
    const filterChildrenBtn = document.getElementById('filter-children-btn');
    const filterAdultsBtn = document.getElementById('filter-adults-btn');

    if (!filterButtonsContainer || !filterAllBtn || !filterChildrenBtn || !filterAdultsBtn) return;

    // Vis knapperne kun hvis admins er aktiveret i settings
    const showAdminsInList = window.__flangoInstitutionSettings?.showAdminsInUserList !== false;
    if (showAdminsInList) {
        filterButtonsContainer.style.display = 'flex';
    } else {
        filterButtonsContainer.style.display = 'none';
        return;
    }

    // Opdater active state på alle knapper
    function updateActiveButton() {
        filterAllBtn.classList.toggle('active', userFilterMode === 'all');
        filterChildrenBtn.classList.toggle('active', userFilterMode === 'children');
        filterAdultsBtn.classList.toggle('active', userFilterMode === 'adults');
    }

    // Knap 1: Vis Alle
    filterAllBtn.onclick = () => {
        userFilterMode = 'all';
        updateActiveButton();
        if (typeof renderList === 'function') {
            renderList();
        }
    };

    // Knap 2: Vis Børn
    filterChildrenBtn.onclick = () => {
        userFilterMode = 'children';
        updateActiveButton();
        if (typeof renderList === 'function') {
            renderList();
        }
    };

    // Knap 3: Vis Voksne
    filterAdultsBtn.onclick = () => {
        userFilterMode = 'adults';
        updateActiveButton();
        if (typeof renderList === 'function') {
            renderList();
        }
    };

    // Initial update
    updateActiveButton();
}

export function resetUserFilters() {
    userFilterMode = 'all';
}

// Getter and setter functions for sort order state
export function getNameSortOrder() {
    return nameSortOrder;
}

export function setNameSortOrder(order) {
    nameSortOrder = order;
}

export function getNumberSortOrder() {
    return numberSortOrder;
}

export function setNumberSortOrder(order) {
    numberSortOrder = order;
}
