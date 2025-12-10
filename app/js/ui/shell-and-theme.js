// Tema og shell-funktioner
import { getCurrentClerk } from '../domain/session-store.js';
import { getProductIconInfo } from '../domain/products-and-cart.js';
import { setupHelpModule, openHelpManually } from './help.js';
import { supabaseClient } from '../core/config-and-supabase.js';
import { getInstitutionId } from '../domain/session-store.js';

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

async function openSugarPolicyModal() {
    const modal = document.getElementById('sugar-policy-modal');
    if (!modal) return;
    ensureSugarPolicyModal();

    const institutionId = getInstitutionId();
    if (!institutionId) {
        console.error('[sugar-policy] No institution ID found');
        return;
    }

    // Load current settings from database
    const { data, error } = await supabaseClient
        .from('institutions')
        .select('sugar_policy_enabled, sugar_policy_max_unhealthy_per_day, sugar_policy_max_per_product_per_day, sugar_policy_max_unhealthy_enabled, sugar_policy_max_per_product_enabled')
        .eq('id', institutionId)
        .single();

    if (error) {
        console.error('[sugar-policy] Error loading settings:', error);
    }

    const toggle = document.getElementById('sugar-policy-enabled-toggle');
    const label = document.getElementById('sugar-policy-enabled-label');
    const settings = document.getElementById('sugar-policy-settings');
    const maxUnhealthyInput = document.getElementById('sugar-policy-max-unhealthy');
    const maxPerProductInput = document.getElementById('sugar-policy-max-per-product');
    const maxUnhealthyEnabledCheckbox = document.getElementById('sugar-policy-max-unhealthy-enabled');
    const maxPerProductEnabledCheckbox = document.getElementById('sugar-policy-max-per-product-enabled');

    // Set values from database
    if (data) {
        const enabled = data.sugar_policy_enabled || false;
        sugarPolicyState.enabled = enabled;
        toggle.checked = enabled;
        maxUnhealthyInput.value = data.sugar_policy_max_unhealthy_per_day || 2;
        maxPerProductInput.value = data.sugar_policy_max_per_product_per_day || 1;
        maxUnhealthyEnabledCheckbox.checked = data.sugar_policy_max_unhealthy_enabled || false;
        maxPerProductEnabledCheckbox.checked = data.sugar_policy_max_per_product_enabled !== false; // default true
    }

    // Update UI - gråe ud inactive felter
    const updateFieldStates = () => {
        // Query elements fresh from DOM (after cloneNode operations)
        const currentToggle = document.getElementById('sugar-policy-enabled-toggle');
        const currentMaxUnhealthyInput = document.getElementById('sugar-policy-max-unhealthy');
        const currentMaxPerProductInput = document.getElementById('sugar-policy-max-per-product');
        const currentMaxUnhealthyEnabledCheckbox = document.getElementById('sugar-policy-max-unhealthy-enabled');
        const currentMaxPerProductEnabledCheckbox = document.getElementById('sugar-policy-max-per-product-enabled');
        const currentLabel = document.getElementById('sugar-policy-enabled-label');

        if (!currentToggle || !currentMaxUnhealthyInput || !currentMaxPerProductInput || !currentMaxUnhealthyEnabledCheckbox || !currentMaxPerProductEnabledCheckbox) return;

        const mainEnabled = currentToggle.checked;
        const maxUnhealthyEnabled = currentMaxUnhealthyEnabledCheckbox.checked;
        const maxPerProductEnabled = currentMaxPerProductEnabledCheckbox.checked;

        // Main toggle label
        if (currentLabel) currentLabel.textContent = mainEnabled ? 'Sukkerpolitik er slået TIL' : 'Sukkerpolitik er slået FRA';

        // Hvis main toggle er slået fra, gråe begge felter ud
        if (!mainEnabled) {
            currentMaxUnhealthyInput.disabled = true;
            currentMaxPerProductInput.disabled = true;
            currentMaxUnhealthyInput.style.opacity = '0.5';
            currentMaxPerProductInput.style.opacity = '0.5';
            currentMaxUnhealthyEnabledCheckbox.disabled = true;
            currentMaxPerProductEnabledCheckbox.disabled = true;
        } else {
            // Main toggle er aktiv, tjek individuelle checkboxes
            currentMaxUnhealthyEnabledCheckbox.disabled = false;
            currentMaxPerProductEnabledCheckbox.disabled = false;

            // Maks total usunde
            currentMaxUnhealthyInput.disabled = !maxUnhealthyEnabled;
            currentMaxUnhealthyInput.style.opacity = maxUnhealthyEnabled ? '1' : '0.5';

            // Maks per produkt
            currentMaxPerProductInput.disabled = !maxPerProductEnabled;
            currentMaxPerProductInput.style.opacity = maxPerProductEnabled ? '1' : '0.5';
        }
    };

    updateFieldStates();

    // Save function
    const saveSettings = async (updates) => {
        const { error } = await supabaseClient
            .from('institutions')
            .update(updates)
            .eq('id', institutionId);

        if (error) {
            console.error('[sugar-policy] Error saving settings:', error);
        }
    };

    // Event listeners (remove old ones first to avoid duplicates)
    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);

    newToggle.addEventListener('change', () => {
        sugarPolicyState.enabled = newToggle.checked;
        updateFieldStates();
        saveSettings({ sugar_policy_enabled: newToggle.checked });
    });

    // Maks total usunde checkbox
    const newMaxUnhealthyEnabledCheckbox = maxUnhealthyEnabledCheckbox.cloneNode(true);
    maxUnhealthyEnabledCheckbox.parentNode.replaceChild(newMaxUnhealthyEnabledCheckbox, maxUnhealthyEnabledCheckbox);

    newMaxUnhealthyEnabledCheckbox.addEventListener('change', () => {
        const isEnabled = newMaxUnhealthyEnabledCheckbox.checked;

        // Hvis denne aktiveres, deaktiver per-product
        if (isEnabled) {
            const perProductCheckbox = document.getElementById('sugar-policy-max-per-product-enabled');
            if (perProductCheckbox) {
                perProductCheckbox.checked = false;
                saveSettings({
                    sugar_policy_max_unhealthy_enabled: true,
                    sugar_policy_max_per_product_enabled: false
                });
            }
        } else {
            saveSettings({ sugar_policy_max_unhealthy_enabled: false });
        }

        updateFieldStates();
    });

    // Maks per produkt checkbox
    const newMaxPerProductEnabledCheckbox = maxPerProductEnabledCheckbox.cloneNode(true);
    maxPerProductEnabledCheckbox.parentNode.replaceChild(newMaxPerProductEnabledCheckbox, maxPerProductEnabledCheckbox);

    newMaxPerProductEnabledCheckbox.addEventListener('change', () => {
        const isEnabled = newMaxPerProductEnabledCheckbox.checked;

        // Hvis denne aktiveres, deaktiver total unhealthy
        if (isEnabled) {
            const unhealthyCheckbox = document.getElementById('sugar-policy-max-unhealthy-enabled');
            if (unhealthyCheckbox) {
                unhealthyCheckbox.checked = false;
                saveSettings({
                    sugar_policy_max_per_product_enabled: true,
                    sugar_policy_max_unhealthy_enabled: false
                });
            }
        } else {
            saveSettings({ sugar_policy_max_per_product_enabled: false });
        }

        updateFieldStates();
    });

    maxUnhealthyInput.addEventListener('change', () => {
        const value = parseInt(maxUnhealthyInput.value, 10);
        if (!isNaN(value) && value >= 0) {
            saveSettings({ sugar_policy_max_unhealthy_per_day: value });
        }
    });

    maxPerProductInput.addEventListener('change', () => {
        const value = parseInt(maxPerProductInput.value, 10);
        if (!isNaN(value) && value >= 0) {
            saveSettings({ sugar_policy_max_per_product_per_day: value });
        }
    });

    renderSugarPolicyProductList();
    modal.style.display = 'flex';
}

async function openSpendingLimitModal() {
    const modal = document.getElementById('spending-limit-modal');
    if (!modal) return;

    const institutionId = getInstitutionId();
    if (!institutionId) {
        console.error('[spending-limit] No institution ID found');
        return;
    }

    // Load current settings from database
    const { data, error } = await supabaseClient
        .from('institutions')
        .select(`
            spending_limit_enabled,
            spending_limit_amount,
            spending_limit_applies_to_regular_users,
            spending_limit_applies_to_admins,
            spending_limit_applies_to_test_users,
            balance_limit_enabled,
            balance_limit_amount,
            balance_limit_exempt_admins,
            balance_limit_exempt_test_users
        `)
        .eq('id', institutionId)
        .single();

    if (error) {
        console.error('[spending-limit] Error loading settings:', error);
        return;
    }

    // Spending Limit Elements
    const spendingToggle = document.getElementById('spending-limit-enabled-toggle');
    const spendingLabel = document.getElementById('spending-limit-enabled-label');
    const spendingSettings = document.getElementById('spending-limit-settings');
    const spendingAmount = document.getElementById('spending-limit-amount');
    const spendingRegularUsers = document.getElementById('spending-limit-regular-users');
    const spendingAdmins = document.getElementById('spending-limit-admins');
    const spendingTestUsers = document.getElementById('spending-limit-test-users');

    // Balance Limit Elements
    const balanceToggle = document.getElementById('balance-limit-enabled-toggle');
    const balanceLabel = document.getElementById('balance-limit-enabled-label');
    const balanceSettings = document.getElementById('balance-limit-settings');
    const balanceAmount = document.getElementById('balance-limit-amount');
    const balanceExemptAdmins = document.getElementById('balance-limit-exempt-admins');
    const balanceExemptTestUsers = document.getElementById('balance-limit-exempt-test-users');

    // Set values from database
    if (data) {
        spendingToggle.checked = data.spending_limit_enabled || false;
        spendingAmount.value = data.spending_limit_amount || 40;
        spendingRegularUsers.checked = data.spending_limit_applies_to_regular_users !== false;
        spendingAdmins.checked = data.spending_limit_applies_to_admins || false;
        spendingTestUsers.checked = data.spending_limit_applies_to_test_users || false;

        balanceToggle.checked = data.balance_limit_enabled !== false;
        balanceAmount.value = data.balance_limit_amount || -10;
        balanceExemptAdmins.checked = data.balance_limit_exempt_admins || false;
        balanceExemptTestUsers.checked = data.balance_limit_exempt_test_users || false;
    }

    // Update labels and visibility
    const updateSpendingUI = () => {
        const enabled = spendingToggle.checked;
        spendingLabel.textContent = enabled ? 'Forbrugsgrænse er slået TIL' : 'Forbrugsgrænse er slået FRA';
        spendingSettings.style.display = enabled ? 'block' : 'none';
    };

    const updateBalanceUI = () => {
        const enabled = balanceToggle.checked;
        balanceLabel.textContent = enabled ? 'Saldogrænse er slået TIL' : 'Saldogrænse er slået FRA';
        balanceSettings.style.display = enabled ? 'block' : 'none';
    };

    updateSpendingUI();
    updateBalanceUI();

    // Save function
    const saveSettings = async (updates) => {
        const { error } = await supabaseClient
            .from('institutions')
            .update(updates)
            .eq('id', institutionId);

        if (error) {
            console.error('[spending-limit] Error saving settings:', error);
        }
    };

    // Event listeners
    spendingToggle.addEventListener('change', () => {
        updateSpendingUI();
        saveSettings({ spending_limit_enabled: spendingToggle.checked });
    });

    spendingAmount.addEventListener('change', () => {
        const value = parseFloat(spendingAmount.value);
        if (!isNaN(value) && value >= 0) {
            saveSettings({ spending_limit_amount: value });
        }
    });

    spendingRegularUsers.addEventListener('change', () => {
        saveSettings({ spending_limit_applies_to_regular_users: spendingRegularUsers.checked });
    });

    spendingAdmins.addEventListener('change', () => {
        saveSettings({ spending_limit_applies_to_admins: spendingAdmins.checked });
    });

    spendingTestUsers.addEventListener('change', () => {
        saveSettings({ spending_limit_applies_to_test_users: spendingTestUsers.checked });
    });

    balanceToggle.addEventListener('change', () => {
        updateBalanceUI();
        saveSettings({ balance_limit_enabled: balanceToggle.checked });
    });

    balanceAmount.addEventListener('change', () => {
        const value = parseFloat(balanceAmount.value);
        if (!isNaN(value)) {
            saveSettings({ balance_limit_amount: value });
        }
    });

    balanceExemptAdmins.addEventListener('change', () => {
        saveSettings({ balance_limit_exempt_admins: balanceExemptAdmins.checked });
    });

    balanceExemptTestUsers.addEventListener('change', () => {
        saveSettings({ balance_limit_exempt_test_users: balanceExemptTestUsers.checked });
    });

    // Close button
    const closeBtn = modal.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }

    // Show modal
    modal.style.display = 'flex';
}

async function openInstitutionPreferences() {
    const backdrop = document.getElementById('settings-modal-backdrop');
    const titleEl = document.getElementById('settings-modal-title');
    const contentEl = document.getElementById('settings-modal-content');
    if (!backdrop || !titleEl || !contentEl) return;

    titleEl.textContent = 'Indstillinger – Institutionens Præferencer';
    contentEl.innerHTML = '';

    // Hent nuværende institutionsindstillinger
    const institutionId = getInstitutionId();
    let showAdminsInList = false;
    let adminsPurchaseFree = false;

    if (institutionId) {
        const { data, error } = await supabaseClient
            .from('institutions')
            .select('show_admins_in_user_list, admins_purchase_free')
            .eq('id', institutionId)
            .single();

        if (!error && data) {
            showAdminsInList = data.show_admins_in_user_list || false;
            adminsPurchaseFree = data.admins_purchase_free || false;
        }
    }

    // Sukkerpolitik knap
    const sugarPolicyBtn = document.createElement('button');
    sugarPolicyBtn.className = 'settings-item-btn';
    sugarPolicyBtn.innerHTML = `<strong>Sukkerpolitik</strong><div style="font-size: 12px; margin-top: 2px;">Begræns søde produkter til maks 1 pr. barn pr. dag.</div>`;
    sugarPolicyBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
        openSugarPolicyModal();
    });

    // Beløbsgrænse knap
    const spendingLimitBtn = document.createElement('button');
    spendingLimitBtn.className = 'settings-item-btn';
    spendingLimitBtn.innerHTML = `<strong>Beløbsgrænse</strong><div style="font-size: 12px; margin-top: 2px;">Konfigurer daglig forbrugsgrænse og saldogrænse.</div>`;
    spendingLimitBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
        openSpendingLimitModal();
    });

    // Forældreportalen knap
    const parentPortalBtn = document.createElement('button');
    parentPortalBtn.className = 'settings-item-btn';
    parentPortalBtn.innerHTML = `<strong>Forældreportalen</strong><div style="font-size: 12px; margin-top: 2px;">Konfigurer funktioner tilgængelige i forældreportalen.</div>`;
    parentPortalBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
        openParentPortalSettingsModal();
    });

    // Checkbox: Vis admins i bruger-liste
    const showAdminsCheckbox = document.createElement('label');
    showAdminsCheckbox.className = 'settings-checkbox-label';
    showAdminsCheckbox.style.cssText = 'display: flex; align-items: center; padding: 15px; cursor: pointer; border-bottom: 1px solid #eee;';
    showAdminsCheckbox.innerHTML = `
        <input type="checkbox" id="show-admins-checkbox" ${showAdminsInList ? 'checked' : ''} style="margin-right: 12px; cursor: pointer;">
        <div>
            <strong>Vis Admins i 'Vælg Bruger' listen</strong>
            <div style="font-size: 12px; margin-top: 2px; color: #666;">Voksne kan vælges som kunder i caféen</div>
        </div>
    `;

    const showAdminsInput = showAdminsCheckbox.querySelector('input');
    showAdminsInput.addEventListener('change', async (e) => {
        if (!institutionId) return;
        const { error } = await supabaseClient
            .from('institutions')
            .update({ show_admins_in_user_list: e.target.checked })
            .eq('id', institutionId);

        if (error) {
            console.error('[settings] Fejl ved opdatering af show_admins_in_user_list:', error);
            e.target.checked = !e.target.checked; // Revert
        }
    });

    // Checkbox: Admins skal ikke betale
    const adminsFreeCheckbox = document.createElement('label');
    adminsFreeCheckbox.className = 'settings-checkbox-label';
    adminsFreeCheckbox.style.cssText = 'display: flex; align-items: center; padding: 15px; cursor: pointer;';
    adminsFreeCheckbox.innerHTML = `
        <input type="checkbox" id="admins-free-checkbox" ${adminsPurchaseFree ? 'checked' : ''} style="margin-right: 12px; cursor: pointer;">
        <div>
            <strong>Admins skal ikke betale</strong>
            <div style="font-size: 12px; margin-top: 2px; color: #666;">Voksne køber for 0 kr (registreres stadig i historik)</div>
        </div>
    `;

    const adminsFreeInput = adminsFreeCheckbox.querySelector('input');
    adminsFreeInput.addEventListener('change', async (e) => {
        if (!institutionId) return;
        const { error } = await supabaseClient
            .from('institutions')
            .update({ admins_purchase_free: e.target.checked })
            .eq('id', institutionId);

        if (error) {
            console.error('[settings] Fejl ved opdatering af admins_purchase_free:', error);
            e.target.checked = !e.target.checked; // Revert
        }
    });

    contentEl.appendChild(sugarPolicyBtn);
    contentEl.appendChild(spendingLimitBtn);
    contentEl.appendChild(parentPortalBtn);
    contentEl.appendChild(showAdminsCheckbox);
    contentEl.appendChild(adminsFreeCheckbox);
    backdrop.style.display = 'flex';
}

async function openParentPortalSettingsModal() {
    const modal = document.getElementById('parent-portal-settings-modal');
    if (!modal) return;

    const institutionId = getInstitutionId();
    if (!institutionId) {
        console.error('[parent-portal] No institution ID found');
        return;
    }

    // Load current settings from database
    const { data, error } = await supabaseClient
        .from('institutions')
        .select(`
            parent_portal_email_notifications,
            parent_portal_spending_limit,
            parent_portal_product_limit,
            parent_portal_allergens,
            parent_portal_vegetarian_only,
            parent_portal_no_pork,
            parent_portal_no_unhealthy
        `)
        .eq('id', institutionId)
        .single();

    if (error) {
        console.error('[parent-portal] Error loading settings:', error);
    }

    // Get all checkboxes
    const emailNotifications = document.getElementById('parent-portal-email-notifications');
    const spendingLimit = document.getElementById('parent-portal-spending-limit');
    const productLimit = document.getElementById('parent-portal-product-limit');
    const allergens = document.getElementById('parent-portal-allergens');
    const vegetarianOnly = document.getElementById('parent-portal-vegetarian-only');
    const noPork = document.getElementById('parent-portal-no-pork');
    const noUnhealthy = document.getElementById('parent-portal-no-unhealthy');
    const saveBtn = document.getElementById('save-parent-portal-settings-btn');
    const codesBtn = document.getElementById('parent-portal-codes-btn-inside');

    // Set values from database (default all to true)
    if (data) {
        emailNotifications.checked = data.parent_portal_email_notifications !== false;
        spendingLimit.checked = data.parent_portal_spending_limit !== false;
        productLimit.checked = data.parent_portal_product_limit !== false;
        allergens.checked = data.parent_portal_allergens !== false;
        vegetarianOnly.checked = data.parent_portal_vegetarian_only !== false;
        noPork.checked = data.parent_portal_no_pork !== false;
        noUnhealthy.checked = data.parent_portal_no_unhealthy !== false;
    }

    // Save button handler
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    newSaveBtn.addEventListener('click', async () => {
        const updates = {
            parent_portal_email_notifications: emailNotifications.checked,
            parent_portal_spending_limit: spendingLimit.checked,
            parent_portal_product_limit: productLimit.checked,
            parent_portal_allergens: allergens.checked,
            parent_portal_vegetarian_only: vegetarianOnly.checked,
            parent_portal_no_pork: noPork.checked,
            parent_portal_no_unhealthy: noUnhealthy.checked
        };

        const { error: saveError } = await supabaseClient
            .from('institutions')
            .update(updates)
            .eq('id', institutionId);

        if (saveError) {
            console.error('[parent-portal] Error saving settings:', saveError);
            alert('Fejl ved gemning af indstillinger');
        } else {
            modal.style.display = 'none';
            // Reload products if allergens/vegetarian/pork settings changed
            if (typeof window.__flangoFetchAndRenderProducts === 'function') {
                window.__flangoFetchAndRenderProducts();
            }
        }
    });

    // Parent portal codes button handler
    const newCodesBtn = codesBtn.cloneNode(true);
    codesBtn.parentNode.replaceChild(newCodesBtn, codesBtn);

    newCodesBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        // Call existing parent portal codes function
        if (typeof window.__flangoOpenParentPortalAdmin === 'function') {
            window.__flangoOpenParentPortalAdmin();
        }
    });

    // Close button
    const closeBtn = modal.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }

    // Show modal
    modal.style.display = 'flex';
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

    addItem('Dagens Sortiment', () => {
        if (window.__flangoOpenAssortmentModal) {
            openViaSettings('assortment-modal', () => window.__flangoOpenAssortmentModal());
        } else {
            notifyToolbarUser('Indstillinger for sortiment er ikke klar. Prøv at genindlæse.');
        }
    });

    if (isAdmin) {
        addItem('Rediger Produkter', () => openViaSettings('product-modal', () => callButtonById('edit-menu-original-btn')));
    }

    addItem('Historik', () => {
        window.__flangoOpenSalesHistory?.() || notifyToolbarUser('Historik-funktionen er ikke klar.');
    }, 'settings-history-btn');

    if (isAdmin) {
        addItem('Rediger Brugere', () => openViaSettings('admin-user-manager-modal', () => window.__flangoOpenAdminUserManager?.('customers')));
    }

    addItem('Lydindstillinger', () => {
        if (window.__flangoOpenSoundSettingsModal) {
            openViaSettings('sound-settings-modal', () => window.__flangoOpenSoundSettingsModal());
        } else {
            notifyToolbarUser('Lydindstillinger kan ikke åbnes lige nu.');
        }
    });

    if (isAdmin) {
        addItem('Institutionens Præferencer', () => openInstitutionPreferences(), '', true);
        addItem("Rediger Admin (Voksen konto'er)", () => openViaSettings('admin-user-manager-modal', () => window.__flangoOpenAdminUserManager?.('admins')));
    }

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

    addItem('Udseende', () => openViaSettings('theme-picker-backdrop', () => callButtonById('open-theme-picker')));

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

export function setupToolbarHistoryButton() {
    const historyBtn = document.getElementById('toolbar-history-btn');
    if (!historyBtn) return;
    historyBtn.onclick = (event) => {
        event.preventDefault();
        if (typeof window.__flangoOpenSalesHistory === 'function') {
            window.__flangoOpenSalesHistory();
        } else {
            notifyToolbarUser('Historik-funktionen er ikke klar.');
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
