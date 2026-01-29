import {
    loadParentPortalTemplateFromDatabase as loadParentPortalTemplateFromDatabaseHelper,
    saveParentPortalTemplateToDatabase as saveParentPortalTemplateToDatabaseHelper,
    renderParentPortalMessageFromTemplate,
    buildParentPortalAdminTableRows,
} from '../domain/parent-portal.js';

let parentPortalMessageTemplate = `
Kære forældre

Vi bruger nu Flango som cafésystem i klubben.
Her er jeres login-oplysninger til forældre-portalen:

• Barn: {{child_name}}
• Kode: {{pin}}

Sådan logger I ind:
1. Gå til: https://flango.dk/forældre
2. Vælg jeres klub/SFO i listen
3. Skriv barnets navn og koden ovenfor

I forældre-portalen kan I se saldo og café-historik.

Venlig hilsen
{{admin_name}}
`.trim();

let parentPortalAdminModal = null;
let parentPortalReauthModal = null;
let parentPortalSortKey = 'name';
let parentPortalSortDirection = 'asc';

export function createParentPortalAdminUI(options = {}) {
    const {
        clerkProfile,
        adminProfile,
        supabaseClient,
        showAlert,
        showCustomAlert,
        getAllUsers,
    } = options;

    async function loadParentPortalTemplateFromDatabase() {
        parentPortalMessageTemplate =
            (await loadParentPortalTemplateFromDatabaseHelper(
                parentPortalMessageTemplate,
                adminProfile,
                clerkProfile
            )) || parentPortalMessageTemplate;
    }

    async function saveParentPortalTemplateToDatabase() {
        await saveParentPortalTemplateToDatabaseHelper(
            parentPortalMessageTemplate,
            adminProfile,
            clerkProfile
        );
    }

    function renderParentPortalMessage(childName, pin) {
        const templateToUse = parentPortalMessageTemplate || '';
        return renderParentPortalMessageFromTemplate(templateToUse, childName, pin);
    }

    function setupParentPortalSettings(assortmentSettings) {
        if (!assortmentSettings) return;
        const parentPortalSection = assortmentSettings.querySelector('#parent-portal-settings-section');
        if (!parentPortalSection) return;

        const isAdmin = (clerkProfile?.role || '').toLowerCase() === 'admin';
        parentPortalSection.style.display = isAdmin ? 'block' : 'none';

        const openBtn = parentPortalSection.querySelector('#open-parent-portal-admin');
        const previewBtn = parentPortalSection.querySelector('#preview-parent-portal-message-btn');
        const copyBtn = parentPortalSection.querySelector('#copy-parent-portal-message-btn');
        const childNameInput = parentPortalSection.querySelector('#parent-portal-child-name');
        const pinInput = parentPortalSection.querySelector('#parent-portal-pin');

        if (openBtn) {
            openBtn.onclick = () => confirmAndOpenParentPortalAdminModal();
        }

        const setPreview = () => {
            const childName = childNameInput?.value || 'Barn';
            const pin = pinInput?.value || '1234';
            const previewMsg = renderParentPortalMessage(childName, pin);
            const previewArea = parentPortalSection.querySelector('#parent-portal-preview');
            if (previewArea) previewArea.innerHTML = previewMsg.replace(/\n/g, '<br>');
        };
        if (previewBtn) {
            previewBtn.onclick = () => setPreview();
        }
        if (copyBtn) {
            copyBtn.onclick = () => {
                const childName = childNameInput?.value || 'Barn';
                const pin = pinInput?.value || '1234';
                const text = renderParentPortalMessage(childName, pin);
                navigator.clipboard.writeText(text).then(
                    () => showCustomAlert?.('Kopieret', 'Beskeden er kopieret.'),
                    () => showAlert?.('Kunne ikke kopiere.')
                );
            };
        }
        setPreview();
    }

    function ensureParentPortalReauthModal() {
        if (parentPortalReauthModal) return parentPortalReauthModal;
        parentPortalReauthModal = document.getElementById('parent-portal-reauth-modal');

        if (!parentPortalReauthModal) {
            parentPortalReauthModal = document.createElement('div');
            parentPortalReauthModal.id = 'parent-portal-reauth-modal';
            parentPortalReauthModal.className = 'modal';
            parentPortalReauthModal.innerHTML = `
                <div class="modal-content" style="max-width: 400px;">
                    <button class="close-btn">&times;</button>
                    <h2>Bekræft adgang</h2>
                    <p>Dette område indeholder forældrekoder og følsomme oplysninger. Indtast din admin-kode for at fortsætte.</p>
                    <form id="reauth-form" style="margin-top: 12px;">
                        <input type="password" id="reauth-password-input" placeholder="Din admin-adgangskode" required style="width: 100%; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: flex-end; gap: 8px;">
                            <button type="button" class="cancel-btn">Annuller</button>
                            <button type="submit" class="confirm-btn">Lås op</button>
                        </div>
                        <p id="reauth-error" class="error-message" style="display: none; margin-top: 8px; text-align: right;"></p>
                    </form>
                </div>
            `;
            document.body.appendChild(parentPortalReauthModal);
        }

        const closeBtn = parentPortalReauthModal?.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.onclick = () => parentPortalReauthModal.style.display = 'none';
        }
        const form = parentPortalReauthModal.querySelector('#reauth-form');
        const passwordInput = parentPortalReauthModal.querySelector('#reauth-password-input');
        const errorEl = parentPortalReauthModal.querySelector('#reauth-error');
        const close = () => parentPortalReauthModal.style.display = 'none';
        parentPortalReauthModal.querySelector('.close-btn').onclick = close;
        const cancelBtn = parentPortalReauthModal.querySelector('.cancel-btn');
        if (cancelBtn) cancelBtn.onclick = close;

        if (form && passwordInput) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                if (errorEl) errorEl.style.display = 'none';
                const password = passwordInput.value;
                if (!password) return;

                const { error } = await supabaseClient.auth.signInWithPassword({
                    email: adminProfile.email,
                    password: password,
                });

                if (error) {
                    if (errorEl) {
                        errorEl.textContent = 'Forkert kode, prøv igen.';
                        errorEl.style.display = 'block';
                    }
                } else {
                    passwordInput.value = '';
                    close();
                    openParentPortalAdminModal();
                }
            };
        }

        return parentPortalReauthModal;
    }

    function confirmAndOpenParentPortalAdminModal() {
        const reauthModal = ensureParentPortalReauthModal();
        if (reauthModal) {
            reauthModal.style.display = 'flex';
        } else {
            openParentPortalAdminModal();
        }
    }

    function ensureParentPortalAdminModal() {
        if (parentPortalAdminModal) return parentPortalAdminModal;

        parentPortalAdminModal = document.createElement('div');
        parentPortalAdminModal.id = 'parent-portal-admin-modal';
        parentPortalAdminModal.className = 'modal';
        parentPortalAdminModal.innerHTML = `
            <div class="modal-content">
                <button class="close-btn" id="parent-portal-admin-close">&times;</button>
                <h2>Forældre Portal koder</h2>
                <p>
                    Her kan du som admin oprette nye forældre-koder til børn,
                    så deres forældre kan logge ind på forældre-portalen.
                </p>
                <div id="parent-portal-admin-error" class="error-message" style="display:none; margin-top:8px;"></div>
                <div style="margin-top:12px;">
                    <button id="edit-parent-portal-template-btn">
                        Rediger standard besked
                    </button>
                    <div id="parent-portal-template-editor" style="display:none; margin-top:8px;">
                        <label for="parent-portal-template-textarea" class="section-subtitle">
                            Standardbesked til Aula
                        </label>
                        <textarea
                            id="parent-portal-template-textarea"
                            rows="10"
                            style="width:100%; font-family: inherit; font-size: 14px;"
                        ></textarea>
                        <p style="font-size: 12px; opacity:0.8; margin-top:4px;">
                            Du kan bruge <code>{{child_name}}</code> og <code>{{pin}}</code> som pladsholdere.
                        </p>
                        <div style="display: flex; gap: 8px; margin-top: 8px;">
                            <button id="parent-portal-template-save-btn">Gem besked</button>
                            <button type="button" id="parent-portal-template-cancel-btn" class="cancel-btn">Annuller</button>
                        </div>
                    </div>
                </div>
                <div style="margin-top: 12px;">
                    <input
                        type="text"
                        id="parent-portal-search-input"
                        placeholder="Søg efter barn."
                        style="width:100%; padding: 8px; font-size: 16px; border-radius: 8px; border: 1px solid #ccc;"
                    >
                </div>
                <div class="table-wrapper" style="max-height:600px; overflow:auto; margin-top:12px;">
                    <table class="simple-table" id="parent-portal-admin-table">
                        <thead>
                            <tr>
                                <th data-sort-key="name" style="cursor: pointer;">Barn</th>
                                <th data-sort-key="has_pin" style="cursor: pointer;">Har Kode</th>
                                <th data-sort-key="last_login" style="cursor: pointer;">Har været logget ind</th>
                                <th data-sort-key="is_custom" style="cursor: pointer;">Personlig Kode</th>
                                <th data-sort-key="notification" style="cursor: pointer;">Lav Saldo Notifikation</th>
                                <th>Handlinger</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        `;
        document.body.appendChild(parentPortalAdminModal);

        // Let tabellen fremstå mere skema-agtig med tydelige rækker/felter, inkl. vertikale linjer
        const styleEl = document.createElement('style');
        styleEl.textContent = `
            #parent-portal-admin-modal .table-wrapper {
                border: 1px solid rgba(0, 0, 0, 0.08);
                border-radius: 8px;
                background: #ffffff;
            }
            #parent-portal-admin-modal .simple-table {
                border-collapse: collapse;
                width: 100%;
            }
            #parent-portal-admin-modal .simple-table th,
            #parent-portal-admin-modal .simple-table td {
                padding: 6px 8px;
                border-right: 1px solid rgba(0, 0, 0, 0.06);
            }
            #parent-portal-admin-modal .simple-table th:last-child,
            #parent-portal-admin-modal .simple-table td:last-child {
                border-right: none;
            }
            #parent-portal-admin-modal .simple-table tbody tr {
                border-bottom: 1px solid rgba(0, 0, 0, 0.06);
            }
        `;
        parentPortalAdminModal.appendChild(styleEl);

        // Sørg for at alerts kan ligge ovenpå
        parentPortalAdminModal.style.zIndex = '10';

        const closeBtn = parentPortalAdminModal.querySelector('#parent-portal-admin-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                parentPortalAdminModal.style.display = 'none';
            });
        }

        parentPortalAdminModal.addEventListener('click', (e) => {
            if (e.target === parentPortalAdminModal) {
                parentPortalAdminModal.style.display = 'none';
            }
        });

        const editTemplateBtn = parentPortalAdminModal.querySelector('#edit-parent-portal-template-btn');
        const templateEditor = parentPortalAdminModal.querySelector('#parent-portal-template-editor');
        const templateTextarea = parentPortalAdminModal.querySelector('#parent-portal-template-textarea');
        const saveTemplateBtn = parentPortalAdminModal.querySelector('#parent-portal-template-save-btn');
        const cancelTemplateBtn = parentPortalAdminModal.querySelector('#parent-portal-template-cancel-btn');

        if (templateTextarea) {
            templateTextarea.value = parentPortalMessageTemplate;
        }

        if (editTemplateBtn && templateEditor && templateTextarea && saveTemplateBtn && cancelTemplateBtn) {
            editTemplateBtn.addEventListener('click', () => {
                templateEditor.style.display = 'block';
            });

            saveTemplateBtn.addEventListener('click', async () => {
                parentPortalMessageTemplate = templateTextarea.value;
                await saveParentPortalTemplateToDatabase();
                templateEditor.style.display = 'none';
            });

            cancelTemplateBtn.addEventListener('click', () => {
                templateTextarea.value = parentPortalMessageTemplate;
                templateEditor.style.display = 'none';
            });
        }

        // Søgning
        const searchInput = parentPortalAdminModal.querySelector('#parent-portal-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                renderParentPortalAdminTable();
            });
        }

        // Klik på tabel-headers til sortering
        const thead = parentPortalAdminModal.querySelector('#parent-portal-admin-table thead');
        if (thead) {
            thead.addEventListener('click', (e) => {
                const th = e.target.closest('th[data-sort-key]');
                if (!th) return;

                const newSortKey = th.dataset.sortKey;
                if (parentPortalSortKey === newSortKey) {
                    parentPortalSortDirection = parentPortalSortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    parentPortalSortKey = newSortKey;
                    parentPortalSortDirection = 'asc';
                }
                renderParentPortalAdminTable();
            });
        }

        return parentPortalAdminModal;
    }

    async function openParentPortalAdminModal() {
        const modal = ensureParentPortalAdminModal();
        modal.style.display = 'flex';

        await loadParentPortalTemplateFromDatabase();

        const templateTextarea = document.querySelector('#parent-portal-template-textarea');
        if (templateTextarea) {
            templateTextarea.value = parentPortalMessageTemplate;
        }

        renderParentPortalAdminTable();
    }

    function renderParentPortalAdminTable() {
        const tbody = document.querySelector('#parent-portal-admin-table tbody');
        if (!tbody) return;

        const searchInput = document.getElementById('parent-portal-search-input');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

        tbody.innerHTML = '';

        const allUsers = typeof getAllUsers === 'function' ? getAllUsers() || [] : [];
        if (!Array.isArray(allUsers) || allUsers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">Ingen brugere fundet.</td></tr>';
            return;
        }

        let children = allUsers.filter(u => u.role === 'kunde');

        // Filter på navn ud fra søgning
        if (searchTerm) {
            children = children.filter(child =>
                child.name.toLowerCase().includes(searchTerm)
            );
        }

        // Sorter efter valgt kolonne
        children.sort((a, b) => {
            let valA, valB;
            switch (parentPortalSortKey) {
                case 'has_pin':
                    valA = a.parent_pin_hash ? 1 : 0;
                    valB = b.parent_pin_hash ? 1 : 0;
                    break;
                case 'last_login':
                    valA = a.last_parent_login_at ? new Date(a.last_parent_login_at).getTime() : 0;
                    valB = b.last_parent_login_at ? new Date(b.last_parent_login_at).getTime() : 0;
                    break;
                case 'is_custom':
                    valA = a.parent_pin_is_custom ? 1 : 0;
                    valB = b.parent_pin_is_custom ? 1 : 0;
                    break;
                case 'notification': {
                    const getNotifValue = (notif) => {
                        if (!notif) return 0;
                        if (notif.notify_at_zero && notif.notify_at_ten) return 3;
                        if (notif.notify_at_ten) return 2;
                        if (notif.notify_at_zero) return 1;
                        return 0;
                    };
                    valA = getNotifValue(a._parentNotification);
                    valB = getNotifValue(b._parentNotification);
                    break;
                }
                case 'name':
                default:
                    valA = (a.name || '').toLowerCase();
                    valB = (b.name || '').toLowerCase();
                    break;
            }

            if (valA < valB) return parentPortalSortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return parentPortalSortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        // Opdater header-styles for aktiv sortering
        const table = tbody.closest('table');
        if (table) {
            const allTh = table.querySelectorAll('thead th[data-sort-key]');
            allTh.forEach(th => {
                th.classList.remove('active-sort-asc', 'active-sort-desc');
                if (th.dataset.sortKey === parentPortalSortKey) {
                    th.classList.add(parentPortalSortDirection === 'asc' ? 'active-sort-asc' : 'active-sort-desc');
                }
            });
        }

        if (children.length === 0) {
            if (searchTerm) {
                tbody.innerHTML = '<tr><td colspan="6">Ingen børn matcher din søgning.</td></tr>';
            } else {
                tbody.innerHTML = '<tr><td colspan="6">Ingen børn fundet.</td></tr>';
            }
            return;
        }

        const rowsHtml = buildParentPortalAdminTableRows(children);
        tbody.innerHTML = rowsHtml;

        const rowButtons = tbody.querySelectorAll('tr button');
        rowButtons.forEach((btn, index) => {
            const child = children[index];
            if (child) {
                btn.addEventListener('click', () => handleResetParentPinFromSettings(child));
            }
        });
    }

    function showConfirmNewParentPin(child, hasExistingPin) {
        const modal = ensureParentPortalAdminModal();
        if (!modal) return Promise.resolve(false);

        const existing = modal.querySelector('#parent-portal-confirm-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'parent-portal-confirm-overlay';
        overlay.style.position = 'absolute';
        overlay.style.inset = '0';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.background = 'rgba(0, 0, 0, 0.45)';
        overlay.style.zIndex = '998';

        const card = document.createElement('div');
        card.style.background = '#fff';
        card.style.borderRadius = '16px';
        card.style.padding = '20px';
        card.style.maxWidth = '480px';
        card.style.width = '90%';
        card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
        card.style.textAlign = 'left';
        card.style.lineHeight = '1.5';

        const mainText = hasExistingPin
            ? `
                Du er ved at oprette en ny forældre-kode til <strong>${child.name}</strong>.<br><br>
                Den tidligere kode vil ikke længere virke, og forældrene skal bruge den nye kode fremover.
              `
            : `
                Du er ved at oprette den første forældre-kode til <strong>${child.name}</strong>.
              `;

        card.innerHTML = `
            <h2 style="margin-top:0; margin-bottom:8px;">Ny forældre-kode</h2>
            <p style="margin:0 0 8px 0;">${mainText}</p>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
                <button type="button" class="cancel-btn" id="pp-confirm-cancel-btn">Annuller</button>
                <button type="button" class="confirm-btn" id="pp-confirm-ok-btn">OK</button>
            </div>
        `;

        overlay.appendChild(card);
        modal.appendChild(overlay);

        return new Promise((resolve) => {
            const cleanup = (value) => {
                overlay.remove();
                resolve(value);
            };

            const cancelBtn = card.querySelector('#pp-confirm-cancel-btn');
            const okBtn = card.querySelector('#pp-confirm-ok-btn');

            if (cancelBtn) {
                cancelBtn.onclick = () => cleanup(false);
            }
            if (okBtn) {
                okBtn.onclick = () => cleanup(true);
            }

            // Klik udenfor kortet lukker også som "Annuller"
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup(false);
                }
            });
        });
    }

    function showNewParentPinOverlay(child, newPin, messageText) {
        const modal = ensureParentPortalAdminModal();
        if (!modal) return;

        // Fjern tidligere overlay hvis det findes
        const existing = modal.querySelector('#parent-portal-new-pin-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'parent-portal-new-pin-overlay';
        overlay.style.position = 'absolute';
        overlay.style.inset = '0';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.background = 'rgba(0, 0, 0, 0.45)';
        overlay.style.zIndex = '999';

        const card = document.createElement('div');
        card.style.background = '#fff';
        card.style.borderRadius = '16px';
        card.style.padding = '20px';
        card.style.maxWidth = '480px';
        card.style.width = '90%';
        card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
        card.style.textAlign = 'left';
        card.style.lineHeight = '1.5';
        card.innerHTML = `
            <h2 style="margin-top:0; margin-bottom:8px;">Ny forældre-kode oprettet</h2>
            <p style="margin:0 0 4px 0;">Ny forældre-kode til <strong>${child.name}</strong>:</p>
            <div style="font-size:24px; font-weight:700; margin:8px 0;">${newPin}</div>
            <div style="white-space:pre-wrap; padding:8px; border-radius:8px; background:#f7f7f7; font-family:inherit; font-size:14px; margin-top:4px; margin-bottom: 12px;">${messageText}</div>
            <div style="display:flex; gap:8px; margin-top:4px; margin-bottom: 12px;">
                <button type="button" class="confirm-btn" style="flex:1;" id="pp-copy-code-btn">Kopiér kode</button>
                <button type="button" class="confirm-btn" style="flex:2;" id="pp-copy-aula-btn">Kopiér Aula-besked</button>
            </div>
            <div style="display:flex; justify-content:flex-end;">
                <button type="button" class="cancel-btn" id="pp-new-pin-ok-btn">OK</button>
            </div>
        `;

        overlay.appendChild(card);
        modal.appendChild(overlay);

        const copyCodeBtn = card.querySelector('#pp-copy-code-btn');
        const copyAulaBtn = card.querySelector('#pp-copy-aula-btn');
        const okBtn = card.querySelector('#pp-new-pin-ok-btn');

        if (copyCodeBtn) {
            copyCodeBtn.onclick = async () => {
                const originalText = copyCodeBtn.textContent;
                try {
                    await navigator.clipboard.writeText(newPin);
                    copyCodeBtn.textContent = 'Kopieret!';
                } catch {
                    copyCodeBtn.textContent = 'Kunne ikke kopiere';
                }
                setTimeout(() => {
                    copyCodeBtn.textContent = originalText;
                }, 1500);
            };
        }

        if (copyAulaBtn) {
            copyAulaBtn.onclick = async () => {
                const originalText = copyAulaBtn.textContent;
                try {
                    await navigator.clipboard.writeText(messageText);
                    copyAulaBtn.textContent = 'Kopieret!';
                } catch {
                    copyAulaBtn.textContent = 'Kunne ikke kopiere';
                }
                setTimeout(() => {
                    copyAulaBtn.textContent = originalText;
                }, 1500);
            };
        }

        if (okBtn) {
            okBtn.onclick = () => {
                overlay.remove();
            };
        }
    }

    async function handleResetParentPinFromSettings(child) {
        if (!child || !child.id) return;

        const hasExistingPin = child.parent_pin_hash;
        const confirmed = await showConfirmNewParentPin(child, !!hasExistingPin);
        if (!confirmed) return;

        const newPin = String(Math.floor(100000 + Math.random() * 900000)); // 6-cifret kode

        try {
            const { data: invokeData, error: invokeError } = await supabaseClient.functions.invoke('update-parent-pin', {
                body: {
                    child_id: child.id,
                    new_pin: newPin,
                    source: 'admin',
                },
            });

            if (invokeError || !invokeData || invokeData.success !== true) {
                console.error('Fejl ved update-parent-pin (settings):', invokeError, invokeData);
                const errorDetails = invokeData?.details || invokeData?.error || invokeError?.message || 'Ukendt fejl';
                console.error('Fejl detaljer:', errorDetails);
                showAlert?.(`Kunne ikke opdatere forældre-koden: ${errorDetails}. Prøv igen, eller kontakt udvikleren.`);
                return;
            }

            // Opdater lokale data for UI, så tabellen straks afspejler, at barnet har en kode
            child.__lastParentPin = newPin;
            child.parent_pin_is_custom = false;
            child.parent_pin_hash = 'temp_hash_for_ui';
            renderParentPortalAdminTable();

            const messageText = renderParentPortalMessage(child.name, newPin);
            showNewParentPinOverlay(child, newPin, messageText);
        } catch (e) {
            console.error('Uventet fejl ved update-parent-pin:', e);
            showAlert?.('Der skete en uventet fejl ved opdatering af forældre-koden.');
        }
    }

    window.__flangoOpenParentPortalAdmin = () => confirmAndOpenParentPortalAdminModal();
    window.ensureParentPortalReauthModal = ensureParentPortalReauthModal;
    window.ensureParentPortalAdminModal = ensureParentPortalAdminModal;

    return {
        setupParentPortalSettings,
    };
}
