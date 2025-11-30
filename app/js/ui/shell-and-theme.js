// Tema og shell-funktioner
import { getCurrentClerk } from '../domain/session-store.js';
import { setupHelpModule, openHelpManually } from './help.js';

const THEME_STORAGE_KEY = 'flango-ui-theme';

function setFlangoTheme(themeName) {
    if (themeName !== 'default' && themeName !== 'pastel-pop') {
        themeName = 'default';
    }

    document.body.dataset.theme = themeName;
    localStorage.setItem(THEME_STORAGE_KEY, themeName);

    const defaultRadio = document.getElementById('theme-default');
    const pastelRadio = document.getElementById('theme-pastel-pop');
    if (defaultRadio && pastelRadio) {
        defaultRadio.checked = themeName === 'default';
        pastelRadio.checked = themeName === 'pastel-pop';
    }
}

export function initFlangoTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'default' || savedTheme === 'pastel-pop') {
        setFlangoTheme(savedTheme);
    } else {
        setFlangoTheme('default');
    }
}

export function setupThemePickerUI() {
    const openThemePickerBtn = document.getElementById('open-theme-picker');
    const themePickerBackdrop = document.getElementById('theme-picker-backdrop');
    const themePickerCloseBtn = document.getElementById('theme-picker-close');
    const themeDefaultRadio = document.getElementById('theme-default');
    const themePastelRadio = document.getElementById('theme-pastel-pop');

    if (!openThemePickerBtn || !themePickerBackdrop || !themePickerCloseBtn) {
        console.warn('Tema-picker elementer ikke fundet i DOM');
        return;
    }

    openThemePickerBtn.addEventListener('click', () => {
        const currentTheme = document.body.dataset.theme || 'default';
        if (themeDefaultRadio && themePastelRadio) {
            themeDefaultRadio.checked = currentTheme === 'default';
            themePastelRadio.checked = currentTheme === 'pastel-pop';
        }

        themePickerBackdrop.style.display = 'flex';
    });

    themePickerCloseBtn.addEventListener('click', () => {
        themePickerBackdrop.style.display = 'none';
    });

    themePickerBackdrop.addEventListener('click', (event) => {
        if (event.target === themePickerBackdrop) {
            themePickerBackdrop.style.display = 'none';
        }
    });

    if (themeDefaultRadio) {
        themeDefaultRadio.addEventListener('change', () => {
            if (themeDefaultRadio.checked) {
                setFlangoTheme('default');
            }
        });
    }

    if (themePastelRadio) {
        themePastelRadio.addEventListener('change', () => {
            if (themePastelRadio.checked) {
                setFlangoTheme('pastel-pop');
            }
        });
    }
}

function isCurrentUserAdmin() {
    if (typeof window.currentUserIsAdmin === 'boolean') {
        return window.currentUserIsAdmin;
    }
    const role = (window.__flangoCurrentClerkRole || '').toLowerCase();
    return role === 'admin';
}

function notifyToolbarUser(message) {
    const alertFn = typeof window.__flangoShowAlert === 'function'
        ? window.__flangoShowAlert
        : ((msg) => {
            if (typeof window.alert === 'function') {
                window.alert(msg);
            } else {
                console.warn(msg);
            }
        });
    alertFn(message);
}

function callButtonById(id) {
    const btn = document.getElementById(id);
    if (btn) {
        btn.click();
        return true;
    }
    console.warn('Mangler knap:', id);
    return false;
}

export function closeTopMostOverlay() {
    const overlaySelectors = ['.modal', '#settings-modal-backdrop', '#theme-picker-backdrop'];
    const overlays = overlaySelectors.flatMap(sel => Array.from(document.querySelectorAll(sel)));
    const visibleOverlays = overlays.filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
    });
    if (visibleOverlays.length === 0) return false;
    visibleOverlays.sort((a, b) => {
        const zA = parseInt(window.getComputedStyle(a).zIndex || '0', 10);
        const zB = parseInt(window.getComputedStyle(b).zIndex || '0', 10);
        return zB - zA;
    });
    const topOverlay = visibleOverlays[0];
    const closeBtn = topOverlay.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.click();
    } else {
        topOverlay.style.display = 'none';
    }
    return true;
}

const settingsReturnObservers = new WeakMap();

function monitorModalForSettingsReturn(modal) {
    if (!modal) return;
    const existing = settingsReturnObservers.get(modal);
    if (existing) existing.disconnect();
    const observer = new MutationObserver(() => {
        const isHidden = window.getComputedStyle(modal).display === 'none';
        if (isHidden) {
            observer.disconnect();
            settingsReturnObservers.delete(modal);
            setTimeout(() => openSettingsModal(), 75);
        }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
    settingsReturnObservers.set(modal, observer);
}

export function suspendSettingsReturn(modal) {
    if (!modal) return;
    const observer = settingsReturnObservers.get(modal);
    if (observer) {
        observer.disconnect();
        settingsReturnObservers.delete(modal);
    }
}

export function resumeSettingsReturn(modal) {
    monitorModalForSettingsReturn(modal);
}

export function openSettingsModal() {
    // Hent den aktive brugerprofil fra session-store for at få den korrekte rolle.
    const clerkProfile = getCurrentClerk();
    const isAdmin = clerkProfile?.role === 'admin';
    const backdrop = document.getElementById('settings-modal-backdrop');
    const titleEl = document.getElementById('settings-modal-title');
    const contentEl = document.getElementById('settings-modal-content');

    if (!backdrop || !titleEl || !contentEl) return;

    titleEl.textContent = isAdmin ? 'Indstillinger (Admin)' : 'Indstillinger';
    contentEl.innerHTML = '';

    function addItem(label, onClick, id = '') {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.className = 'settings-item-btn';
        if (id) btn.id = id;
        btn.addEventListener('click', () => {
            backdrop.style.display = 'none';
            onClick();
        });
        contentEl.appendChild(btn);
    }

    const openViaSettings = (modalRef, action) => {
        const modal = typeof modalRef === 'function'
            ? modalRef()
            : (typeof modalRef === 'string'
                ? document.getElementById(modalRef)
                : modalRef);
        if (modal) monitorModalForSettingsReturn(modal);
        action?.();
    };

    if (isAdmin) {
        addItem('Rediger Menu', () => openViaSettings('product-modal', () => callButtonById('edit-menu-original-btn')));
        addItem('Rediger Brugere', () => openViaSettings('admin-user-manager-modal', () => window.__flangoOpenAdminUserManager?.('customers')));
        addItem("Rediger Admin (Voksen konto'er)", () => openViaSettings('admin-user-manager-modal', () => window.__flangoOpenAdminUserManager?.('admins')));
    }

    addItem('Dagens Sortiment', () => {
        if (window.__flangoOpenAssortmentModal) {
            openViaSettings('assortment-modal', () => window.__flangoOpenAssortmentModal());
        } else {
            notifyToolbarUser('Indstillinger for sortiment er ikke klar. Prøv at genindlæse.');
        }
    });

    if (isAdmin) {
        addItem('Forældre Portal Koder', () => {
            const reauthModal = typeof ensureParentPortalReauthModal === 'function'
                ? ensureParentPortalReauthModal()
                : document.getElementById('parent-portal-reauth-modal');
            const adminModal = typeof ensureParentPortalAdminModal === 'function'
                ? ensureParentPortalAdminModal()
                : document.getElementById('parent-portal-admin-modal');
            [reauthModal, adminModal].forEach(modal => modal && monitorModalForSettingsReturn(modal));
            window.__flangoOpenParentPortalAdmin?.();
        });
    }

    addItem('Lydindstillinger', () => {
        if (window.__flangoOpenSoundSettingsModal) {
            openViaSettings('sound-settings-modal', () => window.__flangoOpenSoundSettingsModal());
        } else {
            notifyToolbarUser('Lydindstillinger kan ikke åbnes lige nu.');
        }
    });
    addItem('Udseende', () => openViaSettings('theme-picker-backdrop', () => callButtonById('open-theme-picker')));

    addItem('Historik', () => {
        window.__flangoOpenSalesHistory?.() || notifyToolbarUser('Historik-funktionen er ikke klar.');
    }, 'settings-history-btn');
    addItem('Fortryd sidste salg', () => {
        window.__flangoUndoLastSale?.() || notifyToolbarUser('Fortryd-funktionen er ikke klar.');
    }, 'settings-undo-last-sale-btn');
    addItem('Fortryd tidligere salg', () => {
        if (typeof window.__flangoUndoPreviousSale === 'function') {
            window.__flangoUndoPreviousSale();
        } else {
            notifyToolbarUser('Avanceret fortrydelse er på vej.');
        }
    }, 'settings-undo-previous-sale-btn');
    addItem('Min Flango', () => {
        window.__flangoOpenAvatarPicker?.() || notifyToolbarUser('Status-visningen er ikke klar.');
    }, 'settings-min-flango-status-btn');
    addItem('Hjælp', () => {
        openHelpManually();
    }, 'settings-help-btn');
    addItem('Log ud', () => {
        callButtonById('logout-btn') || notifyToolbarUser('Log ud-knappen er ikke tilgængelig.');
    }, 'settings-logout-btn');

    backdrop.style.display = 'flex';
}

export function setupSettingsModal() {
    const backdrop = document.getElementById('settings-modal-backdrop');
    const closeBtn = document.getElementById('settings-modal-close');

    if (!backdrop || !closeBtn) return;

    closeBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
    });

    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            backdrop.style.display = 'none';
        }
    });
}

export function setupToolbarGearMenu() {
    const gearBtn = document.getElementById('toolbar-gear-btn');
    if (!gearBtn) return;

    gearBtn.onclick = (event) => {
        event.preventDefault();
        const settingsBtn = document.getElementById('open-settings-btn');
        if (settingsBtn) {
            settingsBtn.click();
        } else {
            openSettingsModal();
        }
    };
}

export function setupHelpButton() {
    const logoBtn = document.getElementById('flango-logo-button');
    if (!logoBtn) return;
    setupHelpModule(logoBtn);
}

export function showScreen(screenId) {
    const screens = ['screen-club-login', 'screen-locked', 'screen-admin-login', 'main-app'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const target = document.getElementById(screenId);
    if (target) {
        target.style.display = (screenId === 'main-app') ? 'grid' : 'flex';
    }
}
