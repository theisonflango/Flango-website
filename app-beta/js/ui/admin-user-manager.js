import {
    buildUserAdminTableRows,
    updateUserCoreFields,
    depositToUser,
    setUserBalanceDirectly,
    updateUserPin,
    updateUserBadgeLabel,
} from '../domain/users-and-admin.js';
import { parseBadgeList, formatBadgeList, renderSimpleBadgeDisplay } from '../domain/stats-and-badges.js';
import { showAlert, showCustomAlert } from './sound-and-alerts.js';
import { updateCustomerBalanceGlobally } from '../core/balance-manager.js';
import { refetchUserBalance } from '../core/data-refetch.js';
import { getCachedProfilePictureUrl, getProfilePictureUrl, invalidateProfilePictureCache } from '../core/profile-picture-cache.js';
import { removeProfilePicture } from '../core/profile-picture-utils.js';

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

    const applyUserManagerMode = () => {
        const isAdminMode = getMode() === 'admins';
        modal.dataset.roleFilter = isAdminMode ? 'admin' : 'kunde';
        if (headerTitleEl) {
            headerTitleEl.textContent = isAdminMode ? 'Rediger Admin' : 'Rediger Brugere';
        }
        if (addUserBtn) {
            addUserBtn.textContent = isAdminMode ? '➕ Tilføj Admin' : '➕ Tilføj Ny Bruger';
        }
        // Vis kun Admin Regler i admin-tilstand
        const adminRulesSection = modal.querySelector('#admin-rules-inline');
        if (adminRulesSection) {
            adminRulesSection.style.display = isAdminMode ? 'block' : 'none';
        }
    };
    applyUserManagerMode();

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

        // Load and wire up admin rules if supabaseClient is available
        if (supabaseClient && adminProfile?.institution_id) {
            const showAdminsCheckbox = modal.querySelector('#admin-rules-show-admins-inline');
            const adminsFreeCheckbox = modal.querySelector('#admin-rules-admins-free-inline');

            if (showAdminsCheckbox && adminsFreeCheckbox) {
                // Load current settings
                const { data } = await supabaseClient
                    .from('institutions')
                    .select('show_admins_in_user_list, admins_purchase_free')
                    .eq('id', adminProfile.institution_id)
                    .single();

                if (data) {
                    showAdminsCheckbox.checked = data.show_admins_in_user_list || false;
                    adminsFreeCheckbox.checked = data.admins_purchase_free || false;
                }

                // Auto-save on change
                const saveAdminRules = async () => {
                    await supabaseClient
                        .from('institutions')
                        .update({
                            show_admins_in_user_list: showAdminsCheckbox.checked,
                            admins_purchase_free: adminsFreeCheckbox.checked
                        })
                        .eq('id', adminProfile.institution_id);
                };

                // Remove old listeners and add new ones
                showAdminsCheckbox.onchange = saveAdminRules;
                adminsFreeCheckbox.onchange = saveAdminRules;
            }
        }
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

    function openAdminUserDetail(user) {
        if (!user) return;
        currentAdminUserDetail = user;
        detailModal.style.display = 'flex';
        detailModal.querySelector('#edit-user-detail-title').textContent = `Rediger ${user.name}`;
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
                assignBadgeNote.textContent = 'Du kan ikke tildele badges til dig selv. Bed en kollega om hjælp 😊';
                assignBadgeNote.style.display = 'block';
            } else {
                assignBadgeNote.style.display = 'none';
            }
        }

        // --- Profile picture section ---
        renderProfilePictureSection(user, detailModal);
    }

    function renderProfilePictureSection(user, modal) {
        // Remove any existing profile picture section
        const existing = modal.querySelector('#profile-pic-section');
        if (existing) existing.remove();

        const inst = window.__flangoGetInstitutionById?.(user.institution_id);
        if (!inst?.profile_pictures_enabled) return;

        const section = document.createElement('div');
        section.id = 'profile-pic-section';

        const isOptOut = user.profile_picture_opt_out === true;
        const hasPic = user.profile_picture_url && !isOptOut;

        // Build granular opt-out message
        const optOuts = [];
        if (user.profile_picture_opt_out_camera) optOuts.push('kamera-foto');
        if (user.profile_picture_opt_out_ai) optOuts.push('AI-avatar');
        if (user.profile_picture_opt_out_aula) optOuts.push('Aula-billede');

        if (isOptOut) {
            section.innerHTML = `<p class="profile-pic-opt-out-msg">Forælderen har fravalgt alle profilbilleder for dette barn</p>`;
        } else {
            const cachedUrl = hasPic ? getCachedProfilePictureUrl(user) : null;
            const previewHtml = cachedUrl
                ? `<img src="${cachedUrl}" alt="" class="profile-pic-detail-preview">`
                : `<span class="profile-pic-detail-placeholder">👤</span>`;

            const typeLabel = user.profile_picture_type
                ? { upload: 'Uploadet', camera: 'Kamera', library: 'Bibliotek', ai_avatar: 'AI-Avatar' }[user.profile_picture_type] || ''
                : '';

            section.innerHTML = `
                <div class="profile-pic-detail-row">
                    <span id="pp-detail-preview">${previewHtml}</span>
                    <div style="flex:1;min-width:0;overflow:hidden;">
                        <div class="pp-detail-label">Profilbillede</div>
                        ${hasPic ? `<div class="pp-detail-sublabel">${typeLabel}</div>` : `<div class="pp-detail-sublabel">Intet billede sat</div>`}
                    </div>
                    <div style="display:flex;gap:8px;flex-shrink:0;">
                        <button type="button" id="pp-change-btn" class="action-button secondary-action" style="padding:8px 14px;font-size:13px;white-space:nowrap;">
                            ${hasPic ? 'Skift' : 'Tilføj'}
                        </button>
                        ${hasPic ? `<button type="button" id="pp-remove-btn" class="action-button" style="padding:8px 14px;font-size:13px;background:var(--danger-color);white-space:nowrap;">Fjern</button>` : ''}
                    </div>
                </div>
                ${optOuts.length > 0 ? `<div style="font-size:12px;color:var(--warning-color,#f59e0b);margin-top:6px;">⚠️ Forælder har fravalgt: ${optOuts.join(', ')}</div>` : ''}`;

            // Async load preview if not cached
            if (hasPic && !cachedUrl) {
                getProfilePictureUrl(user).then(url => {
                    const previewEl = section.querySelector('#pp-detail-preview');
                    if (url && previewEl) {
                        previewEl.innerHTML = `<img src="${url}" alt="" class="profile-pic-detail-preview">`;
                    }
                });
            }
        }

        // Insert before the save button's parent form-group
        const saveBtn = modal.querySelector('#save-edit-user-btn');
        const insertTarget = saveBtn?.closest('.form-group') || saveBtn?.parentElement;
        if (insertTarget) {
            insertTarget.parentElement.insertBefore(section, insertTarget);
        } else {
            modal.querySelector('.modal-content')?.appendChild(section);
        }

        // Wire up buttons
        const changeBtn = section.querySelector('#pp-change-btn');
        const removeBtn = section.querySelector('#pp-remove-btn');

        if (changeBtn) {
            changeBtn.addEventListener('click', async () => {
                // Dynamically import and open the profile picture modal
                const { openProfilePictureModal } = await import('./profile-picture-modal.js');
                openProfilePictureModal(user, {
                    showCustomAlert: showCustomAlert,
                    onSaved: (updatedUser) => {
                        // Update local user object
                        Object.assign(user, updatedUser);
                        invalidateProfilePictureCache(user.id);
                        // Re-render this section
                        renderProfilePictureSection(user, modal);
                        // Re-render user list if available
                        if (typeof renderAdminUserListFromModule === 'function') renderAdminUserListFromModule();
                    },
                });
            });
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', async () => {
                const confirmed = await showCustomAlert({
                    title: 'Fjern profilbillede?',
                    message: `Er du sikker på du vil fjerne profilbilledet for ${user.name}?`,
                    buttons: [
                        { text: 'Annuller', value: false },
                        { text: 'Fjern', value: true, className: 'danger' },
                    ],
                });
                if (!confirmed) return;

                const result = await removeProfilePicture(user.id, user.institution_id, user.profile_picture_type);
                if (result.success) {
                    user.profile_picture_url = null;
                    user.profile_picture_type = null;
                    renderProfilePictureSection(user, modal);
                    if (typeof renderAdminUserListFromModule === 'function') renderAdminUserListFromModule();
                } else {
                    showAlert(result.error || 'Kunne ikke fjerne billedet');
                }
            });
        }
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
