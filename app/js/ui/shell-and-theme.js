// Tema og shell-funktioner
import { getCurrentClerk } from '../domain/session-store.js';
import { getProductIconInfo } from '../domain/products-and-cart.js';
import { setupHelpModule, openHelpManually } from './help.js';
import { supabaseClient } from '../core/config-and-supabase.js';
import { getInstitutionId } from '../domain/session-store.js';
import {
    initThemeLoader,
    switchTheme as themePackSwitchTheme,
    getCurrentTheme,
    isThemePackTheme,
    ALL_VALID_THEMES
} from './theme-loader.js';
import { initMobilePayImport, injectStyles as injectMobilePayStyles } from '../domain/mobilepay-import.js';

const THEME_STORAGE_KEY = 'flango-ui-theme';
const sugarPolicyState = {
    enabled: false,
    limitedProductIds: new Set(),
};

const VALID_THEMES = ALL_VALID_THEMES;

function setFlangoTheme(themeName) {
    if (!VALID_THEMES.includes(themeName)) {
        themeName = 'default';
    }

    // For theme-pack themes (like flango-unstoppable), use the theme loader
    // which will reload the page to swap CSS files
    const currentTheme = getCurrentTheme();
    if (isThemePackTheme(themeName) || isThemePackTheme(currentTheme)) {
        themePackSwitchTheme(themeName);
        return; // Page will reload for theme-pack themes
    }

    // For non-theme-pack themes (default, pastel-pop, pos-pro)
    document.body.dataset.theme = themeName;
    localStorage.setItem(THEME_STORAGE_KEY, themeName);

    // Update all theme radio buttons
    VALID_THEMES.forEach(theme => {
        const radio = document.getElementById(`theme-${theme}`);
        if (radio) {
            radio.checked = themeName === theme;
        }
    });
}

export function initFlangoTheme() {
    // Use the theme loader which handles both regular themes and theme-packs
    initThemeLoader();

    // Update radio buttons to match current theme
    const currentTheme = getCurrentTheme();
    VALID_THEMES.forEach(theme => {
        const radio = document.getElementById(`theme-${theme}`);
        if (radio) {
            radio.checked = currentTheme === theme;
        }
    });
}

export function setupThemePickerUI() {
    const openThemePickerBtn = document.getElementById('open-theme-picker');
    const themePickerBackdrop = document.getElementById('theme-picker-backdrop');
    const themePickerCloseBtn = document.getElementById('theme-picker-close');

    if (!openThemePickerBtn || !themePickerBackdrop || !themePickerCloseBtn) {
        console.warn('Tema-picker elementer ikke fundet i DOM');
        return;
    }

    openThemePickerBtn.addEventListener('click', () => {
        const currentThemeValue = getCurrentTheme();
        // Update all theme radios
        VALID_THEMES.forEach(theme => {
            const radio = document.getElementById(`theme-${theme}`);
            if (radio) {
                radio.checked = currentThemeValue === theme;
            }
        });

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

    // Set up listeners for all theme radios
    VALID_THEMES.forEach(theme => {
        const radio = document.getElementById(`theme-${theme}`);
        if (radio) {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    setFlangoTheme(theme);
                }
            });
        }
    });
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

// State for product rules modal
let productRulesState = {
    sugarPolicyEnabled: false,
    parentPortalAllowsUnhealthy: true, // Om forældreportal tillader at bruge usund-funktionen
    productLimits: new Map(), // productId -> max_per_day
    institutionId: null
};

async function fetchProductLimits(institutionId) {
    if (!institutionId) return new Map();
    try {
        const { data, error } = await supabaseClient
            .from('product_limits')
            .select('product_id, max_per_day')
            .eq('institution_id', institutionId);
        if (error) {
            console.warn('[product-rules] fetchProductLimits error:', error?.message);
            return new Map();
        }
        const map = new Map();
        (data || []).forEach(row => map.set(row.product_id, row.max_per_day));
        return map;
    } catch (err) {
        console.warn('[product-rules] fetchProductLimits unexpected error:', err);
        return new Map();
    }
}

async function saveProductUnhealthy(productId, isUnhealthy) {
    const { error } = await supabaseClient
        .from('products')
        .update({ unhealthy: isUnhealthy })
        .eq('id', productId);
    if (error) {
        console.error('[product-rules] Error saving unhealthy status:', error);
    }
}

async function saveProductActive(productId, isActive) {
    const { error } = await supabaseClient
        .from('products')
        .update({ is_enabled: isActive })
        .eq('id', productId);
    if (error) {
        console.error('[product-rules] Error saving active status:', error);
    }
}

function renderProductRulesTable() {
    const tbody = document.getElementById('product-rules-tbody');
    const emptyEl = document.getElementById('product-rules-empty');
    const tableContainer = document.getElementById('product-rules-table-container');
    const unhealthyColHeader = document.getElementById('col-unhealthy');

    if (!tbody) return;
    tbody.innerHTML = '';

    const products = getAllProductsForSugarPolicy();

    // Show/hide empty message
    if (!products || products.length === 0) {
        if (tableContainer) tableContainer.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }
    if (tableContainer) tableContainer.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';

    // Determine if Usund column should be visible
    // Hide if: sugar policy is OFF OR parent portal doesn't allow it
    const showUnhealthyCol = productRulesState.sugarPolicyEnabled && productRulesState.parentPortalAllowsUnhealthy;

    // Update column header visibility
    if (unhealthyColHeader) {
        unhealthyColHeader.style.display = showUnhealthyCol ? '' : 'none';
    }

    const sortedProducts = [...products].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    sortedProducts.forEach((product) => {
        const tr = document.createElement('tr');
        tr.dataset.productId = product.id;
        tr.style.borderBottom = '1px solid #eee';

        const isActive = product.is_enabled !== false;
        const isUnhealthy = product.unhealthy === true;
        const hasRefill = product.refill_enabled === true;
        const purchaseLimit = productRulesState.productLimits.get(product.id);

        // 1. Ikon
        const tdIcon = document.createElement('td');
        tdIcon.style.cssText = 'padding: 8px; vertical-align: middle;';
        const iconInfo = getProductIconInfo(product);
        if (iconInfo?.path) {
            tdIcon.innerHTML = `<img src="${iconInfo.path}" alt="${product.name}" style="width: 32px; height: 32px; object-fit: contain; border-radius: 4px;">`;
        } else {
            tdIcon.innerHTML = `<span style="font-size: 24px;">${product.emoji || '🛒'}</span>`;
        }
        tr.appendChild(tdIcon);

        // 2. Navn
        const tdName = document.createElement('td');
        tdName.style.cssText = 'padding: 8px; vertical-align: middle; font-weight: 500;';
        tdName.textContent = product.name || 'Produkt';
        tr.appendChild(tdName);

        // 3. Pris
        const tdPrice = document.createElement('td');
        tdPrice.style.cssText = 'padding: 8px; vertical-align: middle; text-align: right;';
        tdPrice.textContent = product.price ? `${product.price.toFixed(2)} kr.` : '-';
        tr.appendChild(tdPrice);

        // 4. Genopfyldning (refill status - readonly indicator)
        const tdRefill = document.createElement('td');
        tdRefill.style.cssText = 'padding: 8px; vertical-align: middle; text-align: center;';
        if (hasRefill) {
            const refillPrice = product.refill_price != null ? `${product.refill_price} kr.` : 'Gratis';
            tdRefill.innerHTML = `<span style="color: #2e7d32; font-size: 12px;" title="Refill pris: ${refillPrice}">✅ ${refillPrice}</span>`;
        } else {
            tdRefill.innerHTML = `<span style="color: #999; font-size: 12px;">—</span>`;
        }
        tr.appendChild(tdRefill);

        // 5. Købsgrænse (readonly indicator)
        const tdLimit = document.createElement('td');
        tdLimit.style.cssText = 'padding: 8px; vertical-align: middle; text-align: center;';
        if (purchaseLimit != null && purchaseLimit > 0) {
            tdLimit.innerHTML = `<span style="color: #1565c0; font-weight: 500;">${purchaseLimit}/dag</span>`;
        } else {
            tdLimit.innerHTML = `<span style="color: #999; font-size: 12px;">∞</span>`;
        }
        tr.appendChild(tdLimit);

        // 6. Usund (toggle - conditional visibility)
        const tdUnhealthy = document.createElement('td');
        tdUnhealthy.style.cssText = 'padding: 8px; vertical-align: middle; text-align: center;';
        tdUnhealthy.style.display = showUnhealthyCol ? '' : 'none';
        tdUnhealthy.className = 'col-unhealthy-cell';

        const unhealthyToggle = document.createElement('input');
        unhealthyToggle.type = 'checkbox';
        unhealthyToggle.checked = isUnhealthy;
        unhealthyToggle.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
        unhealthyToggle.title = isUnhealthy ? 'Markeret som usund' : 'Klik for at markere som usund';
        unhealthyToggle.addEventListener('change', async () => {
            await saveProductUnhealthy(product.id, unhealthyToggle.checked);
            // Update local product state
            product.unhealthy = unhealthyToggle.checked;
        });
        tdUnhealthy.appendChild(unhealthyToggle);
        tr.appendChild(tdUnhealthy);

        // 7. Aktiv (toggle)
        const tdActive = document.createElement('td');
        tdActive.style.cssText = 'padding: 8px; vertical-align: middle; text-align: center;';

        const activeToggle = document.createElement('input');
        activeToggle.type = 'checkbox';
        activeToggle.checked = isActive;
        activeToggle.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
        activeToggle.title = isActive ? 'Produktet er aktivt' : 'Produktet er deaktiveret';
        activeToggle.addEventListener('change', async () => {
            await saveProductActive(product.id, activeToggle.checked);
            // Update local product state
            product.is_enabled = activeToggle.checked;
            // Update row styling
            tr.style.opacity = activeToggle.checked ? '1' : '0.5';
        });
        tdActive.appendChild(activeToggle);
        tr.appendChild(tdActive);

        // Apply inactive styling if not active
        if (!isActive) {
            tr.style.opacity = '0.5';
        }

        // 8. Rediger (edit button)
        const tdEdit = document.createElement('td');
        tdEdit.style.cssText = 'padding: 8px; vertical-align: middle; text-align: center;';

        const editBtn = document.createElement('button');
        editBtn.innerHTML = '✍️';
        editBtn.title = 'Rediger produkt';
        editBtn.style.cssText = 'background: none; border: none; font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: background 0.2s;';
        editBtn.addEventListener('mouseenter', () => editBtn.style.background = '#f0f0f0');
        editBtn.addEventListener('mouseleave', () => editBtn.style.background = 'none');
        editBtn.addEventListener('click', () => {
            // Close current modal and open edit product modal
            const modal = document.getElementById('sugar-policy-modal');
            if (modal) modal.style.display = 'none';
            // Trigger product edit via global function if available
            if (typeof window.__flangoEditProduct === 'function') {
                window.__flangoEditProduct(product.id);
            } else {
                console.warn('[product-rules] __flangoEditProduct function not available');
            }
        });
        tdEdit.appendChild(editBtn);
        tr.appendChild(tdEdit);

        tbody.appendChild(tr);
    });
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
        console.error('[product-rules] No institution ID found');
        return;
    }

    // Load current settings from database (including parent portal settings)
    const { data, error } = await supabaseClient
        .from('institutions')
        .select('sugar_policy_enabled, sugar_policy_max_unhealthy_per_day, sugar_policy_max_per_product_per_day, sugar_policy_max_unhealthy_enabled, sugar_policy_max_per_product_enabled, parent_portal_no_unhealthy')
        .eq('id', institutionId)
        .single();

    if (error) {
        console.error('[product-rules] Error loading settings:', error);
    }

    // Fetch product limits
    productRulesState.institutionId = institutionId;
    productRulesState.productLimits = await fetchProductLimits(institutionId);

    // Check parent portal setting for unhealthy products
    // If parent_portal_no_unhealthy is enabled, it means parents can opt out of unhealthy products
    // So we should still show the column for admins to mark products as unhealthy
    productRulesState.parentPortalAllowsUnhealthy = true; // Always allow admins to set this

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
        productRulesState.sugarPolicyEnabled = enabled;
        toggle.checked = enabled;
        maxUnhealthyInput.value = data.sugar_policy_max_unhealthy_per_day || 2;
        maxPerProductInput.value = data.sugar_policy_max_per_product_per_day || 1;
        maxUnhealthyEnabledCheckbox.checked = data.sugar_policy_max_unhealthy_enabled || false;
        maxPerProductEnabledCheckbox.checked = data.sugar_policy_max_per_product_enabled !== false; // default true

        // Show/hide sugar policy settings section
        if (settings) {
            settings.style.display = enabled ? 'block' : 'none';
        }
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
        const currentSettings = document.getElementById('sugar-policy-settings');

        if (!currentToggle || !currentMaxUnhealthyInput || !currentMaxPerProductInput || !currentMaxUnhealthyEnabledCheckbox || !currentMaxPerProductEnabledCheckbox) return;

        const mainEnabled = currentToggle.checked;
        const maxUnhealthyEnabled = currentMaxUnhealthyEnabledCheckbox.checked;
        const maxPerProductEnabled = currentMaxPerProductEnabledCheckbox.checked;

        // Main toggle label
        if (currentLabel) currentLabel.textContent = mainEnabled ? 'Sukkerpolitik er slået TIL' : 'Sukkerpolitik er slået FRA';

        // Show/hide settings section
        if (currentSettings) {
            currentSettings.style.display = mainEnabled ? 'block' : 'none';
        }

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

        // Update product rules state and re-render table
        productRulesState.sugarPolicyEnabled = mainEnabled;
        renderProductRulesTable();
    };

    updateFieldStates();

    // Save function
    const saveSettings = async (updates) => {
        const { error } = await supabaseClient
            .from('institutions')
            .update(updates)
            .eq('id', institutionId);

        if (error) {
            console.error('[product-rules] Error saving settings:', error);
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

    // Back button
    const backBtn = document.getElementById('back-to-preferences-sugar-policy-btn');
    if (backBtn) {
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        newBackBtn.onclick = () => {
            modal.style.display = 'none';
            openInstitutionPreferences();
        };
    }

    // Anvend ændringer knap - genindlæser sukkerpolitik for valgt bruger
    const applyBtn = document.getElementById('apply-sugar-policy-btn');
    if (applyBtn) {
        const newApplyBtn = applyBtn.cloneNode(true);
        applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
        newApplyBtn.onclick = async () => {
            newApplyBtn.disabled = true;
            newApplyBtn.textContent = 'Anvender...';

            try {
                if (typeof window.__flangoRefreshSugarPolicy === 'function') {
                    const success = await window.__flangoRefreshSugarPolicy();
                    if (success) {
                        newApplyBtn.textContent = '✓ Anvendt!';
                        newApplyBtn.style.background = '#2e7d32';
                        setTimeout(() => {
                            newApplyBtn.textContent = 'Anvend ændringer';
                            newApplyBtn.style.background = '#4CAF50';
                            newApplyBtn.disabled = false;
                        }, 2000);
                    } else {
                        newApplyBtn.textContent = 'Ingen bruger valgt';
                        newApplyBtn.style.background = '#ff9800';
                        setTimeout(() => {
                            newApplyBtn.textContent = 'Anvend ændringer';
                            newApplyBtn.style.background = '#4CAF50';
                            newApplyBtn.disabled = false;
                        }, 2000);
                    }
                } else {
                    console.warn('[sugar-policy] __flangoRefreshSugarPolicy ikke tilgængelig');
                    newApplyBtn.textContent = 'Fejl';
                    newApplyBtn.style.background = '#f44336';
                    setTimeout(() => {
                        newApplyBtn.textContent = 'Anvend ændringer';
                        newApplyBtn.style.background = '#4CAF50';
                        newApplyBtn.disabled = false;
                    }, 2000);
                }
            } catch (err) {
                console.error('[sugar-policy] Fejl ved anvendelse:', err);
                newApplyBtn.textContent = 'Fejl';
                newApplyBtn.style.background = '#f44336';
                setTimeout(() => {
                    newApplyBtn.textContent = 'Anvend ændringer';
                    newApplyBtn.style.background = '#4CAF50';
                    newApplyBtn.disabled = false;
                }, 2000);
            }
        };
    }

    renderProductRulesTable();
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
        alert('Fejl ved indlæsning af indstillinger: ' + error.message);
        return;
    }

    console.log('[spending-limit] Loadede indstillinger fra database:', data);

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

    // Store database values for later use
    const dbValues = data ? {
        spendingEnabled: data.spending_limit_enabled || false,
        spendingAmount: data.spending_limit_amount || 40,
        spendingRegularUsers: data.spending_limit_applies_to_regular_users !== false,
        spendingAdmins: data.spending_limit_applies_to_admins || false,
        spendingTestUsers: data.spending_limit_applies_to_test_users || false,
        balanceEnabled: data.balance_limit_enabled !== false,
        balanceAmount: data.balance_limit_amount || -10,
        balanceExemptAdmins: data.balance_limit_exempt_admins || false,
        balanceExemptTestUsers: data.balance_limit_exempt_test_users || false
    } : null;

    // Update labels and visibility
    const updateSpendingUI = () => {
        const currentToggle = document.getElementById('spending-limit-enabled-toggle');
        const currentLabel = document.getElementById('spending-limit-enabled-label');
        const currentSettings = document.getElementById('spending-limit-settings');
        if (!currentToggle || !currentLabel || !currentSettings) return;

        const enabled = currentToggle.checked;
        currentLabel.textContent = enabled ? 'Forbrugsgrænse er slået TIL' : 'Forbrugsgrænse er slået FRA';
        currentSettings.style.display = enabled ? 'block' : 'none';
    };

    const updateBalanceUI = () => {
        const currentToggle = document.getElementById('balance-limit-enabled-toggle');
        const currentLabel = document.getElementById('balance-limit-enabled-label');
        const currentSettings = document.getElementById('balance-limit-settings');
        if (!currentToggle || !currentLabel || !currentSettings) return;

        const enabled = currentToggle.checked;
        currentLabel.textContent = enabled ? 'Saldogrænse er slået TIL' : 'Saldogrænse er slået FRA';
        currentSettings.style.display = enabled ? 'block' : 'none';
    };

    // UI toggle listeners (only for showing/hiding sections)
    const newSpendingToggle = spendingToggle.cloneNode(true);
    spendingToggle.parentNode.replaceChild(newSpendingToggle, spendingToggle);

    const newBalanceToggle = balanceToggle.cloneNode(true);
    balanceToggle.parentNode.replaceChild(newBalanceToggle, balanceToggle);

    // Set values from database AFTER cloning
    if (dbValues) {
        console.log('[spending-limit] Sætter værdier fra database:', dbValues);

        newSpendingToggle.checked = dbValues.spendingEnabled;
        document.getElementById('spending-limit-amount').value = dbValues.spendingAmount;
        document.getElementById('spending-limit-regular-users').checked = dbValues.spendingRegularUsers;
        document.getElementById('spending-limit-admins').checked = dbValues.spendingAdmins;
        document.getElementById('spending-limit-test-users').checked = dbValues.spendingTestUsers;

        newBalanceToggle.checked = dbValues.balanceEnabled;
        document.getElementById('balance-limit-amount').value = dbValues.balanceAmount;
        document.getElementById('balance-limit-exempt-admins').checked = dbValues.balanceExemptAdmins;
        document.getElementById('balance-limit-exempt-test-users').checked = dbValues.balanceExemptTestUsers;

        console.log('[spending-limit] Værdier sat - spending toggle checked:', newSpendingToggle.checked);
        console.log('[spending-limit] Værdier sat - balance amount:', document.getElementById('balance-limit-amount').value);
    }

    updateSpendingUI();
    updateBalanceUI();

    newSpendingToggle.addEventListener('change', () => {
        updateSpendingUI();
    });

    newBalanceToggle.addEventListener('change', () => {
        updateBalanceUI();
    });

    // Save button handler
    const saveBtn = document.getElementById('save-spending-limit-btn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    newSaveBtn.addEventListener('click', async () => {
        console.log('[spending-limit] Gem knap klikket');

        // Query fresh elements from DOM (after cloneNode operations)
        const currentSpendingToggle = document.getElementById('spending-limit-enabled-toggle');
        const currentSpendingAmount = document.getElementById('spending-limit-amount');
        const currentSpendingRegularUsers = document.getElementById('spending-limit-regular-users');
        const currentSpendingAdmins = document.getElementById('spending-limit-admins');
        const currentSpendingTestUsers = document.getElementById('spending-limit-test-users');
        const currentBalanceToggle = document.getElementById('balance-limit-enabled-toggle');
        const currentBalanceAmount = document.getElementById('balance-limit-amount');
        const currentBalanceExemptAdmins = document.getElementById('balance-limit-exempt-admins');
        const currentBalanceExemptTestUsers = document.getElementById('balance-limit-exempt-test-users');

        const updates = {
            spending_limit_enabled: currentSpendingToggle.checked,
            spending_limit_amount: parseFloat(currentSpendingAmount.value) || 40,
            spending_limit_applies_to_regular_users: currentSpendingRegularUsers.checked,
            spending_limit_applies_to_admins: currentSpendingAdmins.checked,
            spending_limit_applies_to_test_users: currentSpendingTestUsers.checked,
            balance_limit_enabled: currentBalanceToggle.checked,
            balance_limit_amount: parseFloat(currentBalanceAmount.value) || -10,
            balance_limit_exempt_admins: currentBalanceExemptAdmins.checked,
            balance_limit_exempt_test_users: currentBalanceExemptTestUsers.checked
        };

        console.log('[spending-limit] Gemmer indstillinger:', updates);
        console.log('[spending-limit] Institution ID:', institutionId);

        const { data, error, count, status, statusText } = await supabaseClient
            .from('institutions')
            .update(updates)
            .eq('id', institutionId);

        console.log('[spending-limit] Update response:', { data, error, count, status, statusText });

        if (error) {
            console.error('[spending-limit] Error saving settings:', error);
            alert('Fejl ved gemning af indstillinger: ' + error.message);
        } else {
            console.log('[spending-limit] Gemt succesfuldt!');
            alert('Indstillinger gemt!');
            modal.style.display = 'none';
        }
    });

    // Back button
    const backBtn = document.getElementById('back-to-preferences-spending-limit-btn');
    if (backBtn) {
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        newBackBtn.onclick = () => {
            modal.style.display = 'none';
            openInstitutionPreferences();
        };
    }

    // Close button
    const closeBtn = modal.querySelector('.close-btn');
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.onclick = () => {
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

    // Regler for produkter knap (tidligere Sukkerpolitik)
    const sugarPolicyBtn = document.createElement('button');
    sugarPolicyBtn.className = 'settings-item-btn';
    sugarPolicyBtn.innerHTML = `<strong>Regler for produkter</strong><div style="font-size: 12px; margin-top: 2px;">Administrer sukkerpolitik, købsgrænser og produktindstillinger.</div>`;
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

    // Opdateringer knap
    const updatesBtn = document.createElement('button');
    updatesBtn.className = 'settings-item-btn';
    updatesBtn.innerHTML = `<strong>Opdateringer</strong><div style="font-size: 12px; margin-top: 2px;">Tjek for opdateringer og genindlæs appen.</div>`;
    updatesBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
        openUpdatesModal();
    });

    // Rediger Admin (Voksen konto'er) knap
    const editAdminsBtn = document.createElement('button');
    editAdminsBtn.className = 'settings-item-btn';
    editAdminsBtn.innerHTML = `<strong>Rediger Admin (Voksen konto'er)</strong><div style="font-size: 12px; margin-top: 2px;">Administrer voksne/admin-brugere for caféen.</div>`;
    editAdminsBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
        window.__flangoOpenAdminUserManager?.('admins');
    });

    // MobilePay Import knap
    const mobilePayImportBtn = document.createElement('button');
    mobilePayImportBtn.className = 'settings-item-btn';
    mobilePayImportBtn.innerHTML = `<strong>MobilePay CSV Import</strong><div style="font-size: 12px; margin-top: 2px;">Importér indbetalinger fra MobilePay CSV-eksport og sæt dem på børnenes saldo.</div>`;
    mobilePayImportBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
        openMobilePayImportModal();
    });

    contentEl.appendChild(sugarPolicyBtn);
    contentEl.appendChild(spendingLimitBtn);
    contentEl.appendChild(parentPortalBtn);
    contentEl.appendChild(editAdminsBtn);
    contentEl.appendChild(mobilePayImportBtn);
    contentEl.appendChild(updatesBtn);
    backdrop.style.display = 'flex';
}

/**
 * Åbner MobilePay CSV Import modal
 */
function openMobilePayImportModal() {
    // Inject styles hvis ikke allerede gjort
    injectMobilePayStyles();

    const institutionId = getInstitutionId();
    if (!institutionId) {
        console.error('[mobilepay-import] No institution ID found');
        return;
    }

    // Brug settings modal til at vise import UI
    const backdrop = document.getElementById('settings-modal-backdrop');
    const titleEl = document.getElementById('settings-modal-title');
    const contentEl = document.getElementById('settings-modal-content');

    if (!backdrop || !titleEl || !contentEl) return;

    titleEl.textContent = 'MobilePay CSV Import';
    contentEl.innerHTML = '';

    // Opret container til import controller
    const importContainer = document.createElement('div');
    importContainer.id = 'mobilepay-import-container';
    importContainer.style.cssText = 'min-height: 400px; max-height: 70vh; overflow-y: auto;';
    contentEl.appendChild(importContainer);

    // Initialiser import controller
    initMobilePayImport('mobilepay-import-container', institutionId);

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
            parent_portal_allergens,
            parent_portal_product_limit,
            parent_portal_sugar_policy,
            topup_cash_enabled,
            topup_qr_enabled,
            topup_portal_enabled,
            topup_qr_image_url
        `)
        .eq('id', institutionId)
        .single();

    if (error) {
        console.error('[parent-portal] Error loading settings:', error);
    }

    // Get implemented feature checkboxes (4 active features)
    const emailNotifications = document.getElementById('parent-portal-email-notifications');
    const spendingLimit = document.getElementById('parent-portal-spending-limit');
    const allergens = document.getElementById('parent-portal-allergens');
    const productLimit = document.getElementById('parent-portal-product-limit');
    const sugarPolicy = document.getElementById('parent-portal-sugar-policy');
    const saveBtn = document.getElementById('save-parent-portal-settings-btn');
    const codesBtn = document.getElementById('parent-portal-codes-btn-inside');

    // Topup/payment method elements
    const topupCash = document.getElementById('topup-cash-enabled');
    const topupQr = document.getElementById('topup-qr-enabled');
    const topupPortal = document.getElementById('topup-portal-enabled');
    const topupQrImageSection = document.getElementById('topup-qr-image-section');
    const topupQrImageUrl = document.getElementById('topup-qr-image-url');
    const topupQrImageFile = document.getElementById('topup-qr-image-file');
    const topupQrImagePreview = document.getElementById('topup-qr-image-preview');

    // Set values from database (default all to true for parent portal features, false for topup)
    if (data) {
        emailNotifications.checked = data.parent_portal_email_notifications !== false;
        spendingLimit.checked = data.parent_portal_spending_limit !== false;
        allergens.checked = data.parent_portal_allergens !== false;
        productLimit.checked = data.parent_portal_product_limit === true; // Default to false
        if (sugarPolicy) sugarPolicy.checked = data.parent_portal_sugar_policy === true; // Default false

        // Topup settings (default to false - institution must explicitly enable)
        topupCash.checked = data.topup_cash_enabled === true;
        topupQr.checked = data.topup_qr_enabled === true;
        topupPortal.checked = data.topup_portal_enabled === true;

        // QR image URL
        if (data.topup_qr_image_url) {
            topupQrImageUrl.value = data.topup_qr_image_url;
            topupQrImagePreview.src = data.topup_qr_image_url;
            topupQrImagePreview.style.display = 'block';
        }

        // Show/hide QR image section based on checkbox
        topupQrImageSection.style.display = topupQr.checked ? 'block' : 'none';
    }

    // Toggle QR image section when checkbox changes
    topupQr.addEventListener('change', () => {
        topupQrImageSection.style.display = topupQr.checked ? 'block' : 'none';
    });

    // Handle file upload for QR image
    topupQrImageFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Convert to base64 data URL for preview and storage
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result;
            topupQrImageUrl.value = dataUrl;
            topupQrImagePreview.src = dataUrl;
            topupQrImagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    });

    // Update preview when URL is manually entered
    topupQrImageUrl.addEventListener('input', () => {
        const url = topupQrImageUrl.value.trim();
        if (url) {
            topupQrImagePreview.src = url;
            topupQrImagePreview.style.display = 'block';
        } else {
            topupQrImagePreview.style.display = 'none';
        }
    });

    // Save button handler
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    newSaveBtn.addEventListener('click', async () => {
        // Core parent portal settings (4 implemented features + sugar policy)
        const coreUpdates = {
            parent_portal_email_notifications: emailNotifications.checked,
            parent_portal_spending_limit: spendingLimit.checked,
            parent_portal_allergens: allergens.checked,
            parent_portal_product_limit: productLimit.checked,
            parent_portal_sugar_policy: sugarPolicy ? sugarPolicy.checked : false
        };

        // Topup/payment method settings (may not exist in older databases)
        const topupUpdates = {
            topup_cash_enabled: topupCash.checked,
            topup_qr_enabled: topupQr.checked,
            topup_portal_enabled: topupPortal.checked,
            topup_qr_image_url: topupQr.checked ? topupQrImageUrl.value.trim() : null
        };

        // Try saving all settings first
        let { error: saveError } = await supabaseClient
            .from('institutions')
            .update({ ...coreUpdates, ...topupUpdates })
            .eq('id', institutionId);

        // If error (likely missing topup columns), try saving just core settings
        if (saveError) {
            console.warn('[parent-portal] Full save failed, trying core settings only:', saveError.message);
            const { error: coreError } = await supabaseClient
                .from('institutions')
                .update(coreUpdates)
                .eq('id', institutionId);

            if (coreError) {
                console.error('[parent-portal] Error saving settings:', coreError);
                alert('Fejl ved gemning af indstillinger');
                return;
            } else {
                // Core saved, but topup columns missing
                alert('Indstillinger gemt!\n\nBemærk: Optanknings-indstillinger kræver database-opdatering.\nKontakt support eller kør SQL-migrering.');
            }
        }

        modal.style.display = 'none';
        // Reload products if allergens/vegetarian/pork settings changed
        if (typeof window.__flangoFetchAndRenderProducts === 'function') {
            window.__flangoFetchAndRenderProducts();
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

    // Back button
    const backBtn = document.getElementById('back-to-preferences-parent-portal-btn');
    if (backBtn) {
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        newBackBtn.onclick = () => {
            modal.style.display = 'none';
            openInstitutionPreferences();
        };
    }

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

async function openAdminRulesModal() {
    const modal = document.getElementById('admin-rules-modal');
    if (!modal) return;

    const institutionId = getInstitutionId();
    if (!institutionId) {
        console.error('[admin-rules] No institution ID found');
        return;
    }

    // Load current settings from database
    const { data, error } = await supabaseClient
        .from('institutions')
        .select('show_admins_in_user_list, admins_purchase_free')
        .eq('id', institutionId)
        .single();

    if (error) {
        console.error('[admin-rules] Error loading settings:', error);
    }

    // Get checkboxes
    const showAdminsCheckbox = document.getElementById('admin-rules-show-admins-checkbox');
    const adminsFreeCheckbox = document.getElementById('admin-rules-admins-free-checkbox');
    const saveBtn = document.getElementById('save-admin-rules-btn');

    // Set values from database (default to false)
    if (data) {
        showAdminsCheckbox.checked = data.show_admins_in_user_list || false;
        adminsFreeCheckbox.checked = data.admins_purchase_free || false;
    }

    // Save button handler - clone to remove old listeners
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    newSaveBtn.addEventListener('click', async () => {
        const updates = {
            show_admins_in_user_list: showAdminsCheckbox.checked,
            admins_purchase_free: adminsFreeCheckbox.checked
        };

        const { error: saveError } = await supabaseClient
            .from('institutions')
            .update(updates)
            .eq('id', institutionId);

        if (saveError) {
            console.error('[admin-rules] Error saving settings:', saveError);
            alert('Fejl ved gemning af indstillinger');
        } else {
            modal.style.display = 'none';
        }
    });

    // Back button
    const backBtn = document.getElementById('back-to-preferences-admin-rules-btn');
    if (backBtn) {
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        newBackBtn.onclick = () => {
            modal.style.display = 'none';
            openInstitutionPreferences();
        };
    }

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

function openUpdatesModal() {
    // Brug settings modal backdrop til at vise version info
    const backdrop = document.getElementById('settings-modal-backdrop');
    const titleEl = document.getElementById('settings-modal-title');
    const contentEl = document.getElementById('settings-modal-content');

    if (!backdrop || !titleEl || !contentEl) return;

    titleEl.textContent = 'Opdateringer';
    contentEl.innerHTML = '';

    // Brug version-check module til at hente info
    const versionCheck = window.__flangoVersionCheck;
    if (versionCheck && typeof versionCheck.createVersionInfoPanel === 'function') {
        const versionPanel = versionCheck.createVersionInfoPanel();
        contentEl.appendChild(versionPanel);
    } else {
        // Fallback hvis version-check ikke er loaded
        const fallbackInfo = document.createElement('div');
        fallbackInfo.innerHTML = `
            <p style="margin-bottom: 12px;">Version check er ikke tilgængelig.</p>
            <button class="version-refresh-btn" onclick="window.location.reload(true)">Genindlæs app</button>
        `;
        contentEl.appendChild(fallbackInfo);
    }

    // Tilføj tilbage-knap
    const backBtn = document.createElement('button');
    backBtn.className = 'settings-item-btn';
    backBtn.style.marginTop = '16px';
    backBtn.innerHTML = '← Tilbage til Institutionens Præferencer';
    backBtn.addEventListener('click', () => {
        openInstitutionPreferences();
    });
    contentEl.appendChild(backBtn);

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
