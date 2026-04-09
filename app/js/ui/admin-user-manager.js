import {
    buildUserAdminTableRows,
    updateUserCoreFields,
    depositToUser,
    setUserBalanceDirectly,
    updateUserPin,
    updateUserBadgeLabel,
} from '../domain/users-and-admin.js?v=3.0.65';
import { parseBadgeList, formatBadgeList, renderSimpleBadgeDisplay } from '../domain/stats-and-badges.js?v=3.0.65';
import { showAlert, showCustomAlert } from './sound-and-alerts.js?v=3.0.65';
import { updateCustomerBalanceGlobally } from '../core/balance-manager.js?v=3.0.65';
import { refetchUserBalance } from '../core/data-refetch.js?v=3.0.65';
import { getCachedProfilePictureUrl, getProfilePictureUrl, invalidateProfilePictureCache, batchPreWarmProfilePictures } from '../core/profile-picture-cache.js?v=3.0.65';
import { removeProfilePicture, fetchUserProfilePictures, applyProfilePicture } from '../core/profile-picture-utils.js?v=3.0.65';
import { supabaseClient } from '../core/config-and-supabase.js?v=3.0.65';

function extractBalanceFromRpcData(data) {
    if (data == null) return null;
    if (typeof data === 'number' && Number.isFinite(data)) return data;
    if (typeof data === 'string') {
        const n = Number(data.replace(',', '.'));
        return Number.isFinite(n) ? n : null;
    }
    if (Array.isArray(data) && data.length === 1) return extractBalanceFromRpcData(data[0]);
    if (typeof data === 'object') {
        const candidates = ['new_balance', 'balance', 'customer_balance', 'updated_balance', 'result_balance'];
        for (const key of candidates) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                const v = data[key];
                if (typeof v === 'number' && Number.isFinite(v)) return v;
                if (typeof v === 'string') {
                    const n = Number(v.replace(',', '.'));
                    if (Number.isFinite(n)) return n;
                }
            }
        }
    }
    return null;
}

export function setupAdminUserManagerFromModule(config = {}) {
    const {
        allUsers,
        getAllUsers,
        clerkProfile,
        supabaseClient,
        adminProfile,
        getCurrentSortKey = () => 'name',
        setCurrentSortKey = () => {},
        getBalanceSortOrder = () => 'desc',
        setBalanceSortOrder = () => {},
        onAddUserClick = () => {},
        onUserListClick = () => {},
        getAdminManagerMode,
        setAdminManagerMode,
    } = config;

    if (!Array.isArray(allUsers) || !clerkProfile) {
        return;
    }

    let adminUserFilteredList = [];
    let adminUserSelectionIndex = 0;
    let adminManagerMode = 'customers';
    let localMode = 'customers';
    const getUsersSource = () => {
        if (typeof getAllUsers === 'function') {
            return getAllUsers() || [];
        }
        return allUsers || [];
    };
    const getMode = () => {
        if (typeof getAdminManagerMode === 'function') {
            return getAdminManagerMode();
        }
        return localMode;
    };
    const setMode = (mode) => {
        if (typeof setAdminManagerMode === 'function') {
            setAdminManagerMode(mode);
        }
        localMode = mode;
        adminManagerMode = mode;
    };
    let currentAdminUserDetail = null;

    const readSortKey = () => (typeof getCurrentSortKey === 'function' ? getCurrentSortKey() : 'name');
    const writeSortKey = (value) => {
        if (typeof setCurrentSortKey === 'function') {
            setCurrentSortKey(value);
        }
    };
    const readBalanceOrder = () => (typeof getBalanceSortOrder === 'function' ? getBalanceSortOrder() : 'desc');
    const writeBalanceOrder = (value) => {
        if (typeof setBalanceSortOrder === 'function') {
            setBalanceSortOrder(value);
        }
    };

    const modal = document.getElementById('admin-user-manager-modal');
    if (!modal) return;
    modal.classList.add('admin-mode');
    const closeBtn = modal.querySelector('.close-btn');
    const headerTitleEl = modal.querySelector('.modal-header h2');
    const searchInput = modal.querySelector('#admin-search-user-input');
    const sortName = modal.querySelector('#admin-sort-by-name-btn');
    const sortNumber = modal.querySelector('#admin-sort-by-number-btn');
    const sortGrade = modal.querySelector('#admin-sort-by-grade-btn');
    const sortBalance = modal.querySelector('#admin-sort-by-balance-btn');
    const addUserBtn = modal.querySelector('#add-user-btn-modal');
    const userListContainer = modal.querySelector('#admin-modal-user-list');
    const detailModal = document.getElementById('edit-user-detail-modal');
    const detailCloseBtn = detailModal?.querySelector('.close-btn');
    const editUserNameInput = detailModal?.querySelector('#edit-user-name-input');
    const editUserNumberInput = detailModal?.querySelector('#edit-user-number-input');
    const editUserDepositInput = detailModal?.querySelector('#edit-user-deposit-input');
    const editUserBalanceInput = detailModal?.querySelector('#edit-user-balance-input');
    const editUserPinInput = detailModal?.querySelector('#edit-user-pin-input');
    const editUserGradeLevelSelect = detailModal?.querySelector('#edit-user-grade-level');
    const editUserBalanceDisplay = detailModal?.querySelector('#edit-user-balance-display');
    const presetButtons = detailModal ? detailModal.querySelectorAll('.preset-btn') : [];
    const assignBadgeBtn = detailModal?.querySelector('#assign-badge-btn');
    const currentBadgeLabel = detailModal?.querySelector('#current-badge-label');
    const editUserBadgeDisplay = detailModal?.querySelector('#edit-user-badge-display');
    const assignBadgeNote = detailModal?.querySelector('#assign-badge-note');
    const saveEditUserBtn = detailModal?.querySelector('#save-edit-user-btn');
    const deleteEditUserBtn = detailModal?.querySelector('#delete-edit-user-btn');
    const badgeModal = document.getElementById('assign-badge-modal');
    const badgeTitle = badgeModal?.querySelector('#assign-badge-title');
    const badgeCloseBtn = badgeModal?.querySelector('.close-btn');
    const badgeOptions = badgeModal ? badgeModal.querySelectorAll('.badge-option') : [];

    if (!modal || !userListContainer || !searchInput || !detailModal || !badgeModal) return;

    closeBtn.onclick = () => (modal.style.display = 'none');
    searchInput.oninput = () => {
        adminUserSelectionIndex = 0;
        renderAdminUserListFromModule();
    };
    sortName.onclick = () => {
        writeSortKey('name');
        adminUserSelectionIndex = 0;
        renderAdminUserListFromModule();
    };
    sortNumber.onclick = () => {
        writeSortKey('number');
        adminUserSelectionIndex = 0;
        renderAdminUserListFromModule();
    };
    if (sortGrade) {
        sortGrade.onclick = () => {
            writeSortKey('grade');
            adminUserSelectionIndex = 0;
            renderAdminUserListFromModule();
        };
    }
    sortBalance.onclick = () => {
        if (readSortKey() === 'balance') {
            writeBalanceOrder(readBalanceOrder() === 'desc' ? 'asc' : 'desc');
        }
        writeSortKey('balance');
        adminUserSelectionIndex = 0;
        renderAdminUserListFromModule();
    };
    addUserBtn.onclick = onAddUserClick;

    modal.addEventListener('click', (e) => {
        const actionTarget = e.target.closest('.action-icon, .admin-action-btn');
        if (actionTarget) {
            if (typeof onUserListClick === 'function') {
                onUserListClick(e);
            }
            return;
        }
        const infoTarget = e.target.closest('.modal-entry-info');
        if (infoTarget && !e.target.closest('.admin-action-column')) {
            const idx = parseInt(infoTarget.dataset.index, 10);
            if (!isNaN(idx)) {
                adminUserSelectionIndex = idx;
                openAdminUserDetail(adminUserFilteredList[idx]);
            }
        }
    });

    userListContainer.addEventListener('mousemove', (e) => {
        const info = e.target.closest('.modal-entry-info');
        if (info) {
            const idx = parseInt(info.dataset.index, 10);
            if (!isNaN(idx) && idx !== adminUserSelectionIndex) {
                adminUserSelectionIndex = idx;
                updateAdminUserHighlight();
            }
        }
    });

    // ── Toggle tabs (Børn / Admins) ──
    const toggleCustomersBtn = modal.querySelector('#admin-toggle-customers');
    const toggleAdminsBtn = modal.querySelector('#admin-toggle-admins');

    const applyUserManagerMode = () => {
        const isAdminMode = getMode() === 'admins';
        modal.dataset.roleFilter = isAdminMode ? 'admin' : 'kunde';
        if (addUserBtn) {
            addUserBtn.textContent = isAdminMode ? '➕ Tilføj Admin' : '➕ Tilføj Ny Bruger';
        }
        // Auto-import knap kun for børn
        const autoImportBtn = modal.querySelector('#auto-import-open-btn');
        if (autoImportBtn) autoImportBtn.style.display = isAdminMode ? 'none' : '';
        // Klasse-kolonne kun for børn
        const gradeHeader = modal.querySelector('#admin-sort-by-grade-btn');
        if (gradeHeader) gradeHeader.style.display = isAdminMode ? 'none' : '';
        // Toggle-knapper aktiv-state
        if (toggleCustomersBtn && toggleAdminsBtn) {
            toggleCustomersBtn.classList.toggle('active', !isAdminMode);
            toggleAdminsBtn.classList.toggle('active', isAdminMode);
        }
    };
    applyUserManagerMode();

    if (toggleCustomersBtn) {
        toggleCustomersBtn.onclick = () => {
            if (getMode() === 'customers') return;
            setMode('customers');
            applyUserManagerMode();
            if (searchInput) { searchInput.value = ''; adminUserSelectionIndex = 0; }
            renderAdminUserListFromModule();
        };
    }
    if (toggleAdminsBtn) {
        toggleAdminsBtn.onclick = () => {
            if (getMode() === 'admins') return;
            setMode('admins');
            applyUserManagerMode();
            if (searchInput) { searchInput.value = ''; adminUserSelectionIndex = 0; }
            renderAdminUserListFromModule();
        };
    }

    // Direct edit: open detail modal for a specific user without showing the list
    // Optional focusField: 'name' | 'number' | 'balance' | 'grade' — focuses that input after open
    window.__flangoOpenEditUser = (user, focusField) => {
        if (!user) return;
        currentAdminUserDetail = user;
        openAdminUserDetail(user);
        if (focusField) {
            const fieldMap = {
                name: '#edit-user-name-input',
                number: '#edit-user-number-input',
                balance: '#edit-user-balance-input',
                grade: '#edit-user-grade-level',
                badge: '#assign-badge-btn',
            };
            const selector = fieldMap[focusField];
            if (selector) {
                // Open the accordion section containing the field, then focus
                setTimeout(() => {
                    const el = detailModal.querySelector(selector);
                    if (!el) return;
                    // Find and open the parent accordion section
                    const section = el.closest('.eu-section');
                    if (section) {
                        const header = section.querySelector('.eu-section-header');
                        if (header && !header.classList.contains('active')) {
                            header.click();
                        }
                    }
                    setTimeout(() => { el.focus(); el.select?.(); }, 100);
                }, 150);
            }
        }
    };

    window.__flangoOpenAdminUserManager = async (mode = adminManagerMode) => {
        const normalizedMode = mode === 'admins' ? 'admins' : 'customers';
        const switchingModes = normalizedMode !== adminManagerMode;
        setMode(normalizedMode);
        applyUserManagerMode();
        if (switchingModes && searchInput) {
            searchInput.value = '';
            adminUserSelectionIndex = 0;
        }
        renderAdminUserListFromModule();
        modal.style.display = 'flex';
        setTimeout(() => searchInput.focus(), 50);
    };

    const handleAdminKeydown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            moveAdminUserSelection(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            moveAdminUserSelection(-1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            // ENTER trigger deposit action
            const selectedUser = adminUserFilteredList[adminUserSelectionIndex];
            if (selectedUser && typeof onUserListClick === 'function') {
                const syntheticTarget = document.createElement('button');
                syntheticTarget.dataset.userAction = 'deposit';
                syntheticTarget.dataset.id = selectedUser.id;
                syntheticTarget.classList.add('admin-action-btn');

                // Override closest method on the DOM element itself
                syntheticTarget.closest = function(selector) {
                    if (selector === '.action-icon, .admin-action-btn' ||
                        selector === '.admin-action-btn' ||
                        selector === '.action-icon') {
                        return syntheticTarget;
                    }
                    return null;
                };

                // Create synthetic event
                const syntheticEvent = {
                    target: syntheticTarget,
                    currentTarget: syntheticTarget,
                    preventDefault: () => {},
                    stopPropagation: () => {}
                };

                onUserListClick(syntheticEvent);
            }
        }
    };
    searchInput.addEventListener('keydown', handleAdminKeydown);

    presetButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            editUserDepositInput.value = btn.dataset.amount || '';
            editUserDepositInput.focus();
        });
    });

    assignBadgeBtn.addEventListener('click', () => {
        if (!currentAdminUserDetail || assignBadgeBtn.disabled) return;
        if (currentAdminUserDetail.id === clerkProfile.id) {
            showAlert('Du kan ikke tildele badges til dig selv. Bed en kollega om at gøre det.');
            return;
        }
        badgeTitle.textContent = `Hvilket badge vil du tildele ${currentAdminUserDetail.name}?`;
        badgeModal.style.display = 'flex';
    });
    badgeCloseBtn.onclick = () => (badgeModal.style.display = 'none');
    badgeOptions.forEach((btn) => {
        btn.addEventListener('click', async () => {
            if (!currentAdminUserDetail) return;
            const badge = btn.dataset.badge;
            const confirm = await showCustomAlert(
                'Tildel Badge',
                `Vil du tildele badge <strong>${badge}</strong> til ${currentAdminUserDetail.name}?`,
                'confirm',
            );
            if (!confirm) return;
            handleAssignBadge(badge);
        });
    });

    detailCloseBtn.onclick = () => {
        detailModal.style.display = 'none';
        currentAdminUserDetail = null;
        // Fokuser søgefeltet når detail modal lukkes
        setTimeout(() => searchInput.focus(), 100);
    };

    saveEditUserBtn.onclick = () => handleSaveAdminUserDetail();

    if (deleteEditUserBtn) {
        deleteEditUserBtn.onclick = () => {
            if (!currentAdminUserDetail) return;
            // Luk detail modal først
            detailModal.style.display = 'none';
            // Trigger delete handling via onUserListClick med synthetic event
            const syntheticTarget = document.createElement('button');
            syntheticTarget.dataset.userAction = 'delete';
            syntheticTarget.dataset.id = currentAdminUserDetail.id;
            syntheticTarget.classList.add('admin-action-btn');
            const syntheticEvent = { target: syntheticTarget, closest: (sel) => syntheticTarget };
            if (typeof onUserListClick === 'function') {
                onUserListClick(syntheticEvent);
            }
            currentAdminUserDetail = null;
        };
    }

    function moveAdminUserSelection(delta) {
        if (adminUserFilteredList.length === 0) return;
        adminUserSelectionIndex = Math.min(
            adminUserFilteredList.length - 1,
            Math.max(0, adminUserSelectionIndex + delta),
        );
        updateAdminUserHighlight();
    }

    function updateAdminUserHighlight() {
        const entries = modal.querySelectorAll('.modal-entry-info');
        entries.forEach((entry) => {
            const idx = parseInt(entry.dataset.index, 10);
            entry.classList.toggle('highlight', idx === adminUserSelectionIndex);
        });
    }

    function setupEditUserAccordion(modal) {
        const sections = modal.querySelectorAll('.eu-section');
        sections.forEach(section => {
            const header = section.querySelector('.eu-section-header');
            if (!header) return;
            // Prevent stacking listeners on repeated opens — clone to remove old handlers
            const freshHeader = header.cloneNode(true);
            header.parentNode.replaceChild(freshHeader, header);
            freshHeader.addEventListener('click', (e) => {
                e.preventDefault();
                const isActive = freshHeader.classList.contains('active');
                // Close all sections
                sections.forEach(s => {
                    s.querySelector('.eu-section-header')?.classList.remove('active');
                    s.querySelector('.eu-section-content')?.classList.remove('active');
                });
                // Toggle this one
                if (!isActive) {
                    freshHeader.classList.add('active');
                    section.querySelector('.eu-section-content')?.classList.add('active');
                }
            });
        });
    }

    function openAdminUserDetail(user) {
        if (!user) return;
        currentAdminUserDetail = user;
        const isAdmin = user.role === 'admin';
        detailModal.style.display = 'flex';
        detailModal.querySelector('#edit-user-detail-title').textContent = isAdmin ? `Rediger Admin: ${user.name}` : `Rediger ${user.name}`;

        const editForm = detailModal.querySelector('.edit-user-form');

        // Clean up previous admin sections
        const adminArea = detailModal.querySelector('#eu-admin-account-area');
        if (adminArea) adminArea.innerHTML = '';
        editForm.querySelectorAll('.admin-account-section').forEach(el => el.remove());

        // Brugernummer og klasse kun for børn
        const numberGroup = editUserNumberInput?.closest('.form-group');
        const gradeGroup = editUserGradeLevelSelect?.closest('.form-group');
        if (numberGroup) numberGroup.style.display = isAdmin ? 'none' : '';
        if (gradeGroup) gradeGroup.style.display = isAdmin ? 'none' : '';

        editUserNameInput.value = user.name || '';
        editUserNumberInput.value = user.number || '';
        if (editUserGradeLevelSelect) {
            editUserGradeLevelSelect.value = user.grade_level != null ? String(user.grade_level) : '';
        }
        editUserDepositInput.value = '';
        editUserBalanceInput.value = '';
        editUserPinInput.value = '';
        const badgeList = parseBadgeList(user.badge_label);
        currentBadgeLabel.textContent = badgeList.length ? badgeList.join(', ') : 'Ingen badge';
        if (editUserBadgeDisplay) {
            editUserBadgeDisplay.innerHTML = renderSimpleBadgeDisplay(badgeList, {
                emptyMessage: 'Ingen badges',
                rowClass: 'compact',
                itemClass: 'compact',
                emptyClass: 'small',
                removable: true,
            });
            editUserBadgeDisplay.querySelectorAll('.badge-remove-btn').forEach((btn) => {
                btn.onclick = () => handleRemoveUserBadge(btn.dataset.badge);
            });
        }
        editUserBalanceDisplay.textContent = `Nuværende saldo: ${user.balance.toFixed(2)} kr.`;

        const isSelf = user.id === clerkProfile.id;
        assignBadgeBtn.disabled = isSelf;
        if (assignBadgeNote) {
            if (isSelf) {
                assignBadgeNote.textContent = 'Du kan ikke tildele badges til dig selv. Bed en kollega om hjælp.';
                assignBadgeNote.style.display = 'block';
            } else {
                assignBadgeNote.style.display = 'none';
            }
        }

        // --- Admin-specifikke sektioner ---
        if (isAdmin && adminArea) {
            renderAdminAccountSection(user, adminArea, isSelf);
        }

        // --- Profile picture section ---
        renderProfilePictureSection(user, detailModal);

        // --- Close all sections (clean state) ---
        detailModal.querySelectorAll('.eu-section-header').forEach(h => h.classList.remove('active'));
        detailModal.querySelectorAll('.eu-section-content').forEach(c => c.classList.remove('active'));

        // --- Setup accordion ---
        setupEditUserAccordion(detailModal);
    }

    function renderAdminAccountSection(user, editForm, isSelf) {
        const section = document.createElement('div');
        section.className = 'admin-account-section';
        section.style.cssText = 'border: 1px solid rgba(99,102,241,0.2); border-radius: 12px; padding: 14px; margin-bottom: 14px; background: linear-gradient(135deg, rgba(99,102,241,0.06), rgba(255,255,255,0.02));';

        const sectionTitle = document.createElement('div');
        sectionTitle.style.cssText = 'font-weight: 700; font-size: 14px; margin-bottom: 12px; color: var(--text-primary, #fff);';
        sectionTitle.textContent = 'Admin Konto';
        section.appendChild(sectionTitle);

        // Email
        const emailGroup = document.createElement('div');
        emailGroup.className = 'form-group';
        emailGroup.innerHTML = `
            <label>Email</label>
            <div style="display:flex;gap:8px;align-items:center;">
                <input type="email" id="admin-email-input" value="${user.email || ''}" placeholder="admin@email.dk" style="flex:1;" autocomplete="off">
                <button type="button" id="admin-save-email-btn" class="action-button secondary-action" style="padding:8px 14px;font-size:13px;white-space:nowrap;">Gem email</button>
            </div>
            <div id="admin-email-status" style="font-size:12px;margin-top:4px;display:none;"></div>
        `;
        section.appendChild(emailGroup);

        // Password
        const pwGroup = document.createElement('div');
        pwGroup.className = 'form-group';
        pwGroup.innerHTML = `
            <label>Skift adgangskode</label>
            ${!isSelf ? `<input type="password" id="admin-current-pw-input" placeholder="Nuværende adgangskode (påkrævet)" autocomplete="off" style="margin-bottom:6px;">` : ''}
            <input type="password" id="admin-new-pw-input" placeholder="Ny adgangskode (min. 10 tegn)" autocomplete="new-password">
            <input type="password" id="admin-confirm-pw-input" placeholder="Gentag ny adgangskode" autocomplete="new-password" style="margin-top:6px;">
            <div style="display:flex;gap:8px;margin-top:8px;">
                <button type="button" id="admin-save-pw-btn" class="action-button secondary-action" style="padding:8px 14px;font-size:13px;">Gem adgangskode</button>
            </div>
            <div id="admin-pw-status" style="font-size:12px;margin-top:4px;display:none;"></div>
        `;
        section.appendChild(pwGroup);

        // Per-admin toggles
        const togglesGroup = document.createElement('div');
        togglesGroup.className = 'form-group';
        togglesGroup.style.cssText = 'margin-top:10px;';
        togglesGroup.innerHTML = `
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:8px;">
                <input type="checkbox" id="admin-toggle-show-in-list" ${user.show_in_user_list !== false ? 'checked' : ''} style="cursor:pointer;width:18px;height:18px;">
                <div>
                    <strong>Vis i 'Vælg Bruger' listen</strong>
                    <div style="font-size:11px;opacity:0.6;">Denne admin kan vælges som kunde i caféen</div>
                </div>
            </label>
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                <input type="checkbox" id="admin-toggle-purchase-free" ${user.purchase_free ? 'checked' : ''} style="cursor:pointer;width:18px;height:18px;">
                <div>
                    <strong>Skal ikke betale</strong>
                    <div style="font-size:11px;opacity:0.6;">Køber for 0 kr (registreres stadig i historik)</div>
                </div>
            </label>
        `;
        section.appendChild(togglesGroup);

        // Indsæt i admin-account-area (accordion brugerdata-sektion)
        editForm.appendChild(section);

        // Wire up email save
        const saveEmailBtn = section.querySelector('#admin-save-email-btn');
        const emailInput = section.querySelector('#admin-email-input');
        const emailStatus = section.querySelector('#admin-email-status');
        saveEmailBtn.onclick = async () => {
            const newEmail = emailInput.value.trim();
            if (!newEmail || newEmail === user.email) {
                showStatus(emailStatus, 'Ingen ændring.', 'orange');
                return;
            }
            saveEmailBtn.disabled = true;
            saveEmailBtn.textContent = 'Gemmer...';
            try {
                // Brug altid Edge Function (admin API) — auth.updateUser kræver AAL2 ved MFA
                const { data, error: fnErr } = await supabaseClient.functions.invoke('update-admin-account', {
                    body: { target_user_id: user.id, new_email: newEmail },
                });
                if (fnErr) {
                    let msg = fnErr.message;
                    try { const b = await fnErr.context?.json(); if (b?.error) msg = b.error; } catch {}
                    throw new Error(msg);
                }
                if (data?.error) throw new Error(data.error);
                user.email = newEmail;
                showStatus(emailStatus, 'Email opdateret.', 'green');
            } catch (e) {
                showStatus(emailStatus, e.message || 'Fejl ved opdatering.', 'red');
            } finally {
                saveEmailBtn.disabled = false;
                saveEmailBtn.textContent = 'Gem email';
            }
        };

        // Wire up password save
        const savePwBtn = section.querySelector('#admin-save-pw-btn');
        const currentPwInput = section.querySelector('#admin-current-pw-input');
        const newPwInput = section.querySelector('#admin-new-pw-input');
        const confirmPwInput = section.querySelector('#admin-confirm-pw-input');
        const pwStatus = section.querySelector('#admin-pw-status');
        savePwBtn.onclick = async () => {
            const newPw = newPwInput.value;
            const confirmPw = confirmPwInput.value;
            const currentPw = currentPwInput?.value || '';

            // Validering
            if (newPw.length < 10) {
                showStatus(pwStatus, 'Adgangskoden skal være mindst 10 tegn.', 'red');
                return;
            }
            if (!/[a-zA-ZæøåÆØÅ]/.test(newPw) || !/\d/.test(newPw)) {
                showStatus(pwStatus, 'Adgangskoden skal indeholde både bogstaver og tal.', 'red');
                return;
            }
            if (newPw !== confirmPw) {
                showStatus(pwStatus, 'Adgangskoderne er ikke ens.', 'red');
                confirmPwInput.value = '';
                confirmPwInput.focus();
                return;
            }
            if (!isSelf && !currentPw) {
                showStatus(pwStatus, 'Du skal angive den nuværende adgangskode.', 'red');
                return;
            }

            savePwBtn.disabled = true;
            savePwBtn.textContent = 'Gemmer...';
            try {
                // Brug altid Edge Function (admin API) — auth.updateUser kræver AAL2 ved MFA
                const body = { target_user_id: user.id, new_password: newPw };
                if (!isSelf && currentPw) body.current_password_of_target = currentPw;
                const { data, error: fnErr } = await supabaseClient.functions.invoke('update-admin-account', {
                    body,
                });
                if (fnErr) {
                    let msg = fnErr.message;
                    try { const b = await fnErr.context?.json(); if (b?.error) msg = b.error; } catch {}
                    throw new Error(msg);
                }
                if (data?.error) throw new Error(data.error);
                newPwInput.value = '';
                confirmPwInput.value = '';
                if (currentPwInput) currentPwInput.value = '';
                showStatus(pwStatus, 'Adgangskode opdateret.', 'green');
            } catch (e) {
                showStatus(pwStatus, e.message || 'Fejl ved opdatering.', 'red');
            } finally {
                savePwBtn.disabled = false;
                savePwBtn.textContent = 'Gem adgangskode';
            }
        };

        // Wire up per-admin toggles (auto-save)
        const showInListCheckbox = section.querySelector('#admin-toggle-show-in-list');
        const purchaseFreeCheckbox = section.querySelector('#admin-toggle-purchase-free');
        const saveToggle = async () => {
            await supabaseClient
                .from('users')
                .update({
                    show_in_user_list: showInListCheckbox.checked,
                    purchase_free: purchaseFreeCheckbox.checked,
                })
                .eq('id', user.id);
            user.show_in_user_list = showInListCheckbox.checked;
            user.purchase_free = purchaseFreeCheckbox.checked;
        };
        showInListCheckbox.onchange = saveToggle;
        purchaseFreeCheckbox.onchange = saveToggle;
    }

    function showStatus(el, message, color) {
        if (!el) return;
        el.textContent = message;
        el.style.display = 'block';
        el.style.color = color === 'green' ? 'var(--success-color, #22c55e)' : color === 'red' ? 'var(--danger-color, #ef4444)' : 'var(--warning-color, #f59e0b)';
        setTimeout(() => { el.style.display = 'none'; }, 5000);
    }

    // State for pending profile picture selection (used by handleSaveAdminUserDetail)
    // null = no change, { entry } = select this, 'clear' = deselect all
    let pendingProfilePicture = undefined; // undefined = no change pending

    const TYPE_LABELS = { upload: 'Upload', camera: 'Kamera', library: 'Bibliotek', icon: 'Ikon', ai_avatar: 'AI' };

    function renderProfilePictureSection(user, modal) {
        // Remove any existing profile picture section
        const existing = modal.querySelector('#profile-pic-section');
        if (existing) existing.remove();
        // Clear accordion profile content area
        const profileContent = modal.querySelector('#eu-profile-content');
        if (profileContent) profileContent.innerHTML = '';

        const inst = window.__flangoGetInstitutionById?.(user.institution_id);
        if (!inst?.profile_pictures_enabled) return;

        const section = document.createElement('div');
        section.id = 'profile-pic-section';

        const isOptOut = user.profile_picture_opt_out === true;

        if (isOptOut) {
            section.innerHTML = `<p class="profile-pic-opt-out-msg">Forælderen har fravalgt alle profilbilleder for dette barn</p>`;
            insertSection(section, modal);
            return;
        }

        section.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:flex-end;margin-bottom:8px;">
                <button type="button" id="pp-add-btn" class="action-button secondary-action" style="padding:6px 12px;font-size:12px;">+ Tilføj nyt</button>
            </div>
            <div style="position:relative;">
                <button type="button" id="pp-nav-left" class="pp-carousel-nav pp-carousel-left" style="display:none;">‹</button>
                <div id="pp-grid-container" class="pp-carousel-track">
                    <div style="color:#94a3b8;font-size:12px;padding:16px;">Henter billeder...</div>
                </div>
                <button type="button" id="pp-nav-right" class="pp-carousel-nav pp-carousel-right" style="display:none;">›</button>
            </div>`;

        insertSection(section, modal);

        // Wire add button
        section.querySelector('#pp-add-btn')?.addEventListener('click', async () => {
            const { openProfilePictureModal } = await import('./profile-picture-modal.js?v=3.0.65');
            openProfilePictureModal(user, {
                showCustomAlert,
                onSaved: (updatedUser) => {
                    Object.assign(user, updatedUser);
                    invalidateProfilePictureCache(user.id);
                    pendingProfilePicture = undefined;
                    renderProfilePictureSection(user, modal);
                    if (typeof renderAdminUserListFromModule === 'function') renderAdminUserListFromModule();
                },
            });
        });

        // Fetch library entries and render grid
        fetchUserProfilePictures(user.id, user).then(async (entries) => {
            const gridContainer = section.querySelector('#pp-grid-container');
            if (!gridContainer) return;

            if (entries.length === 0) {
                gridContainer.innerHTML = `<div style="color:#94a3b8;font-size:12px;padding:12px;">Ingen billeder endnu. Tryk "+ Tilføj" for at oprette.</div>`;
                return;
            }

            // Generate signed URLs for storage-based entries
            const urlMap = new Map();
            const storageEntries = entries.filter(e => e.storage_path && !e.storage_path.startsWith('http') && e.picture_type !== 'library' && e.picture_type !== 'icon');
            if (storageEntries.length > 0) {
                const paths = storageEntries.map(e => e.storage_path);
                const { data: signedData } = await supabaseClient.storage
                    .from('profile-pictures')
                    .createSignedUrls(paths, 3600);
                if (signedData) {
                    signedData.forEach((item, i) => {
                        if (item.signedUrl) urlMap.set(storageEntries[i].id, item.signedUrl);
                    });
                }
            }

            // Determine which entry is currently selected
            const activeEntry = entries.find(e => e.is_active);

            // Reset pending state when re-rendering
            pendingProfilePicture = undefined;

            gridContainer.innerHTML = entries.map((entry, i) => {
                const isActive = entry.is_active;
                const url = urlMap.get(entry.id) || entry.storage_path;
                const label = entry.ai_style
                    ? `AI-${entry.ai_style.charAt(0).toUpperCase() + entry.ai_style.slice(1)}`
                    : (TYPE_LABELS[entry.picture_type] || '');
                return `
                    <div data-entry-index="${i}" data-selected="${isActive}" class="pp-carousel-item">
                        <img src="${url}" alt="" class="pp-carousel-img" style="border-color:${isActive ? '#22c55e' : 'transparent'};">
                        <div class="pp-carousel-label">${label}</div>
                    </div>`;
            }).join('');

            // Setup carousel navigation
            setupCarouselNav(section, gridContainer);

            // Click handlers for toggle selection
            gridContainer.querySelectorAll('[data-entry-index]').forEach(thumb => {
                thumb.addEventListener('click', () => {
                    const idx = parseInt(thumb.dataset.entryIndex);
                    const entry = entries[idx];
                    if (!entry) return;

                    const isCurrentlySelected = thumb.dataset.selected === 'true';

                    // Clear all selections
                    gridContainer.querySelectorAll('[data-entry-index]').forEach(el => {
                        el.dataset.selected = 'false';
                        el.querySelector('img').style.borderColor = 'transparent';
                    });

                    if (isCurrentlySelected) {
                        // Toggle off — deselect
                        pendingProfilePicture = 'clear';
                    } else {
                        // Select this one
                        thumb.dataset.selected = 'true';
                        thumb.querySelector('img').style.borderColor = '#22c55e';
                        pendingProfilePicture = entry;
                    }
                });
            });
        });
    }

    function insertSection(section, modal) {
        // Insert into accordion profile content area
        const profileContent = modal.querySelector('#eu-profile-content');
        if (profileContent) {
            profileContent.appendChild(section);
            return;
        }
        // Fallback
        const saveBtn = modal.querySelector('#save-edit-user-btn');
        const insertTarget = saveBtn?.closest('.form-group') || saveBtn?.parentElement;
        if (insertTarget) {
            insertTarget.parentElement.insertBefore(section, insertTarget);
        } else {
            modal.querySelector('.modal-content')?.appendChild(section);
        }
    }

    function setupCarouselNav(section, track) {
        const leftBtn = section.querySelector('#pp-nav-left');
        const rightBtn = section.querySelector('#pp-nav-right');
        if (!leftBtn || !rightBtn || !track) return;

        const updateNavVisibility = () => {
            const canScroll = track.scrollWidth > track.clientWidth;
            leftBtn.style.display = canScroll && track.scrollLeft > 4 ? '' : 'none';
            rightBtn.style.display = canScroll && track.scrollLeft < track.scrollWidth - track.clientWidth - 4 ? '' : 'none';
        };

        const scrollAmount = 150;
        leftBtn.addEventListener('click', () => {
            track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        });
        rightBtn.addEventListener('click', () => {
            track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        });

        track.addEventListener('scroll', updateNavVisibility);
        // Initial check after images load
        setTimeout(updateNavVisibility, 100);
        setTimeout(updateNavVisibility, 500);
    }

    async function handleSaveAdminUserDetail() {
        if (!currentAdminUserDetail) return;
        const user = currentAdminUserDetail;
        const nameVal = editUserNameInput.value.trim();
        const numberVal = editUserNumberInput.value.trim();
        const depositVal = parseFloat((editUserDepositInput.value || '').replace(',', '.'));
        const newBalanceVal = editUserBalanceInput.value.trim();
        const pinVal = editUserPinInput.value.trim();
        const gradeLevelVal = editUserGradeLevelSelect ? editUserGradeLevelSelect.value : '';
        const parsedGradeLevel = gradeLevelVal !== '' ? parseInt(gradeLevelVal, 10) : null;
        const updates = {};
        if (nameVal && nameVal !== user.name) updates.name = nameVal;
        if (numberVal !== (user.number || '')) updates.number = numberVal || null;
        if (parsedGradeLevel !== (user.grade_level ?? null)) updates.grade_level = parsedGradeLevel;

        if (Object.keys(updates).length > 0) {
            const { data, error } = await updateUserCoreFields(user.id, updates);
            if (error) return showAlert(`Fejl ved opdatering: ${error.message}`);
            Object.assign(user, data);
        }

        if (!isNaN(depositVal) && depositVal > 0) {
            const { data: rpcData, error } = await depositToUser(user.id, depositVal);
            if (error) return showAlert(`Fejl ved indbetaling: ${error.message}`);

            // MIN DB calls: Brug balance fra RPC hvis den findes, ellers fallback til refetch.
            const rpcBalance = extractBalanceFromRpcData(rpcData);
            if (rpcBalance !== null) {
                updateCustomerBalanceGlobally(user.id, rpcBalance, depositVal, 'admin-manager-deposit-rpc');
            } else {
                const newBalance = await refetchUserBalance(user.id);
                if (newBalance !== null) {
                    updateCustomerBalanceGlobally(user.id, newBalance, depositVal, 'admin-manager-deposit');
                } else {
                    updateCustomerBalanceGlobally(user.id, user.balance + depositVal, depositVal, 'admin-manager-deposit');
                }
            }
            // Opdater UI med lille forsinkelse for at sikre alle state-opdateringer er anvendt
            if (typeof window.updateSelectedUserInfo === 'function') {
                requestAnimationFrame(() => {
                    window.updateSelectedUserInfo();
                });
            }
        }

        if (newBalanceVal) {
            const parsedBalance = parseFloat(newBalanceVal.replace(',', '.'));
            if (isNaN(parsedBalance)) {
                return showAlert('Ugyldig ny saldo.');
            }
            const { data: rpcData, error } = await setUserBalanceDirectly(user.id, parsedBalance);
            if (error) return showAlert(`Fejl ved opdatering af saldo: ${error.message}`);
            const rpcBalance = extractBalanceFromRpcData(rpcData);
            const actualBalance = rpcBalance !== null ? rpcBalance : parsedBalance;
            const delta = actualBalance - user.balance;
            updateCustomerBalanceGlobally(user.id, actualBalance, delta, 'admin-manager-set-balance');
        }

        if (pinVal) {
            if (!/^[0-9]{4}$/.test(pinVal)) {
                return showAlert('PIN skal bestå af 4 cifre.');
            }
            const { error } = await updateUserPin(user.id, pinVal);
            if (error) return showAlert(`Fejl ved opdatering af PIN: ${error.message}`);
        }

        // Save profile picture change if pending
        if (pendingProfilePicture !== undefined) {
            const entry = pendingProfilePicture === 'clear' ? null : pendingProfilePicture;
            const ppResult = await applyProfilePicture(user.id, entry);
            if (ppResult.success) {
                if (entry) {
                    user.profile_picture_url = entry.storage_path;
                    user.profile_picture_type = entry.picture_type;
                } else {
                    user.profile_picture_url = null;
                    user.profile_picture_type = null;
                }
                invalidateProfilePictureCache(user.id);
            }
            pendingProfilePicture = undefined;
        }

        editUserDepositInput.value = '';
        editUserBalanceInput.value = '';
        editUserPinInput.value = '';
        detailModal.style.display = 'none';
        currentAdminUserDetail = null;
        renderAdminUserListFromModule();
        showCustomAlert('Bruger opdateret', `${user.name} er opdateret.`);
        // Fokuser søgefeltet efter opdatering
        setTimeout(() => searchInput.focus(), 100);
    }

    async function handleAssignBadge(badge) {
        if (!badge || !currentAdminUserDetail) return;
        if (currentAdminUserDetail.id === clerkProfile.id) {
            return showAlert('Du kan ikke tildele badges til dig selv. Bed en kollega om at gøre det.');
        }
        const badges = parseBadgeList(currentAdminUserDetail.badge_label);
        if (!badges.includes(badge)) {
            badges.push(badge);
        }
        const newValue = formatBadgeList(badges);
        const { error } = await updateUserBadgeLabel(currentAdminUserDetail.id, newValue);
        if (error) {
            showAlert(`Fejl ved tildeling af badge: ${error.message}`);
            return;
        }
        currentAdminUserDetail.badge_label = newValue;
        const globalUser = getUsersSource().find((u) => u.id === currentAdminUserDetail.id);
        if (globalUser) globalUser.badge_label = newValue;
        if (clerkProfile && clerkProfile.id === currentAdminUserDetail.id) {
            clerkProfile.badge_label = newValue;
        }
        currentBadgeLabel.textContent = badges.join(', ');
        badgeModal.style.display = 'none';
        showCustomAlert('Badge tildelt', `${currentAdminUserDetail.name} har fået badgen "${badge}".`);
        openAdminUserDetail(currentAdminUserDetail);
    }

    async function handleRemoveUserBadge(badge) {
        if (!badge || !currentAdminUserDetail) return;
        const confirm = await showCustomAlert(
            'Fjern badge',
            `Sikker på du vil fjerne badge "<strong>${badge}</strong>" for ${currentAdminUserDetail.name}?`,
            'confirm',
        );
        if (!confirm) return;
        const badges = parseBadgeList(currentAdminUserDetail.badge_label).filter((b) => b !== badge);
        const newValue = formatBadgeList(badges);
        const { error } = await updateUserBadgeLabel(currentAdminUserDetail.id, newValue);
        if (error) {
            showAlert(`Fejl ved fjernelse af badge: ${error.message}`);
            return;
        }
        currentAdminUserDetail.badge_label = newValue;
        const globalUser = getUsersSource().find((u) => u.id === currentAdminUserDetail.id);
        if (globalUser) globalUser.badge_label = newValue;
        if (clerkProfile && clerkProfile.id === currentAdminUserDetail.id) {
            clerkProfile.badge_label = newValue;
        }
        showCustomAlert('Badge fjernet', `${currentAdminUserDetail.name} har fået fjernet badgen "${badge}".`);
        openAdminUserDetail(currentAdminUserDetail);
    }

    function renderAdminUserListFromModule() {
        const modalEl = document.getElementById('admin-user-manager-modal');
        if (!modalEl) return;
        const userList = modalEl.querySelector('#admin-modal-user-list');
        const searchField = modalEl.querySelector('#admin-search-user-input');
        const searchTerm = (searchField?.value || '').toLowerCase();
        const roleFilter = modalEl.dataset.roleFilter || 'kunde';

        const sortButtons = [
            modalEl.querySelector('#admin-sort-by-name-btn'),
            modalEl.querySelector('#admin-sort-by-number-btn'),
            modalEl.querySelector('#admin-sort-by-grade-btn'),
            modalEl.querySelector('#admin-sort-by-balance-btn'),
        ].filter(Boolean);

        const sourceUsers = getUsersSource();
        let filteredUsers = sourceUsers.filter((user) => user.role === roleFilter);
        if (searchTerm) {
            filteredUsers = filteredUsers.filter(
                (user) =>
                    user.name.toLowerCase().includes(searchTerm) ||
                    (user.number && user.number.includes(searchTerm)),
            );
        }

        const sortKey = readSortKey();
        const balanceOrder = readBalanceOrder();
        if (sortKey === 'balance') {
            filteredUsers.sort((a, b) => (balanceOrder === 'desc' ? b.balance - a.balance : a.balance - b.balance));
        } else if (sortKey === 'grade') {
            filteredUsers.sort((a, b) => {
                const ga = a.grade_level != null ? a.grade_level : 999;
                const gb = b.grade_level != null ? b.grade_level : 999;
                return ga - gb || a.name.localeCompare(b.name);
            });
        } else if (sortKey === 'number') {
            filteredUsers.sort((a, b) => (a.number || '').localeCompare(b.number || ''));
        } else {
            filteredUsers.sort((a, b) => a.name.localeCompare(b.name));
        }

        sortButtons.forEach((btn) => btn.classList.remove('active'));
        const activeSortBtn = modalEl.querySelector(`#admin-sort-by-${sortKey}-btn`);
        if (activeSortBtn) activeSortBtn.classList.add('active');

        adminUserFilteredList = filteredUsers;
        if (adminUserSelectionIndex >= filteredUsers.length) {
            adminUserSelectionIndex = Math.max(0, filteredUsers.length - 1);
        }
        if (filteredUsers.length === 0) {
            const emptyLabel = roleFilter === 'admin' ? 'Ingen admin-brugere fundet.' : 'Ingen brugere fundet.';
            userList.innerHTML = `<p style="text-align:center; padding: 20px;">${emptyLabel}</p>`;
            return;
        }
    userList.innerHTML = buildUserAdminTableRows(filteredUsers, adminUserSelectionIndex);

    // Pre-warm profile picture URLs then re-render with images
    const usersWithPics = filteredUsers.filter(u => u.profile_picture_url && !u.profile_picture_opt_out && !getCachedProfilePictureUrl(u));
    if (usersWithPics.length > 0) {
        batchPreWarmProfilePictures(usersWithPics).then(() => {
            userList.innerHTML = buildUserAdminTableRows(filteredUsers, adminUserSelectionIndex);
        }).catch(() => {});
    }
}

window.__flangoRenderAdminUserList = () => renderAdminUserListFromModule();

window.__flangoFocusAdminSearchInput = () => {
    if (searchInput) {
        setTimeout(() => {
            try {
                searchInput.focus();
            } catch (e) {
                // Ignorer hvis elementet ikke kan fokuseres
            }
        }, 100);
    }
};

window.__flangoClearAndFocusAdminSearchInput = () => {
    if (searchInput) {
        searchInput.value = '';
        adminUserSelectionIndex = 0;
        renderAdminUserListFromModule();
        setTimeout(() => {
            try {
                searchInput.focus();
            } catch (e) {
                // Ignorer hvis elementet ikke kan fokuseres
            }
        }, 100);
    }
};
}
