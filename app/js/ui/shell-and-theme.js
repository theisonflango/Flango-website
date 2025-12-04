// Tema og shell-funktioner
import { getCurrentClerk } from '../domain/session-store.js';
import { getProductIconInfo } from '../domain/products-and-cart.js';
import { setupHelpModule, openHelpManually } from './help.js';

const THEME_STORAGE_KEY = 'flango-ui-theme';
const sugarPolicyState = {
    enabled: false,
    limitedProductIds: new Set(),
};

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

function getAllProductsForSugarPolicy() {
    const getter = typeof window.__flangoGetAllProducts === 'function'
        ? window.__flangoGetAllProducts
        : null;
    const products = getter ? getter() : [];
    return Array.isArray(products) ? products : [];
}

function syncSugarPolicyEnabledLabel() {
    const label = document.getElementById('sugar-policy-enabled-label');
    if (!label) return;
    label.textContent = sugarPolicyState.enabled ? 'Sukkerpolitik er slået TIL' : 'Sukkerpolitik er slået FRA';
}

function renderSugarPolicyProductList() {
    const listEl = document.getElementById('sugar-policy-product-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const products = getAllProductsForSugarPolicy();
    if (!products || products.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'Ingen produkter fundet. Tilføj eller indlæs produkter under “Rediger Menu”.';
        listEl.appendChild(empty);
        return;
    }

    const sortedProducts = [...products].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    sortedProducts.forEach((product) => {
        const row = document.createElement('div');
        row.className = 'modal-entry';
        row.dataset.productId = product.id;

        const info = document.createElement('div');
        info.className = 'modal-entry-info';

        const iconInfo = getProductIconInfo(product);
        if (iconInfo?.path) {
            const icon = document.createElement('img');
            icon.src = iconInfo.path;
            icon.alt = iconInfo.alt || product.name || 'Produkt';
            icon.className = `product-icon-small${iconInfo.className || ''}`;
            info.appendChild(icon);
        } else {
            const fallback = document.createElement('span');
            fallback.textContent = product.emoji || '🛒';
            fallback.className = 'product-icon-small';
            info.appendChild(fallback);
        }

        const text = document.createElement('div');
        text.innerHTML = `<strong>${product.name || 'Produkt'}</strong>${product.price ? ` – ${product.price} kr.` : ''}`;
        info.appendChild(text);

        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.className = 'sugar-product-toggle';
        toggle.dataset.productId = product.id;
        toggle.checked = sugarPolicyState.limitedProductIds.has(String(product.id));

        row.appendChild(info);
        row.appendChild(toggle);
        listEl.appendChild(row);
    });

    if (!listEl.dataset.bindings) {
        listEl.addEventListener('change', (evt) => {
            if (evt.target.matches('.sugar-product-toggle')) {
                const productId = evt.target.dataset.productId;
                if (!productId) return;
                if (evt.target.checked) {
                    sugarPolicyState.limitedProductIds.add(String(productId));
                } else {
                    sugarPolicyState.limitedProductIds.delete(String(productId));
                }
                // Fremtidig persistens til Supabase/institution-settings kan placeres her.
            }
        });
        listEl.dataset.bindings = 'true';
    }
}

function ensureSugarPolicyModal() {
    const modal = document.getElementById('sugar-policy-modal');
    if (!modal || modal.dataset.bindings) return;

    const closeBtn = modal.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    modal.dataset.bindings = 'true';
}

function openSugarPolicyModal() {
    const modal = document.getElementById('sugar-policy-modal');
    if (!modal) return;
    ensureSugarPolicyModal();

    const toggle = document.getElementById('sugar-policy-enabled-toggle');
    if (toggle && !toggle.dataset.bound) {
        toggle.addEventListener('change', () => {
            sugarPolicyState.enabled = toggle.checked;
            syncSugarPolicyEnabledLabel();
            // Fremtidig persistens til Supabase/institution-settings kan placeres her.
        });
        toggle.dataset.bound = 'true';
    }
    if (toggle) {
        toggle.checked = sugarPolicyState.enabled;
    }
    syncSugarPolicyEnabledLabel();
    renderSugarPolicyProductList();
    modal.style.display = 'flex';
}

function openInstitutionPreferences() {
    const backdrop = document.getElementById('settings-modal-backdrop');
    const titleEl = document.getElementById('settings-modal-title');
    const contentEl = document.getElementById('settings-modal-content');
    if (!backdrop || !titleEl || !contentEl) return;

    titleEl.textContent = 'Indstillinger – Institutionens Præferencer';
    contentEl.innerHTML = '';

    const sugarPolicyBtn = document.createElement('button');
    sugarPolicyBtn.className = 'settings-item-btn';
    sugarPolicyBtn.innerHTML = `<strong>Sukkerpolitik</strong><div style="font-size: 12px; margin-top: 2px;">Begræns søde produkter til maks 1 pr. barn pr. dag.</div>`;
    sugarPolicyBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
        openSugarPolicyModal();
    });

    contentEl.appendChild(sugarPolicyBtn);
    backdrop.style.display = 'flex';
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

    function addItem(label, onClick, id = '', keepOpen = false) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.className = 'settings-item-btn';
        if (id) btn.id = id;
        btn.addEventListener('click', () => {
            backdrop.style.display = keepOpen ? 'flex' : 'none';
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
        addItem('Institutionens Præferencer', () => openInstitutionPreferences(), '', true);
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
