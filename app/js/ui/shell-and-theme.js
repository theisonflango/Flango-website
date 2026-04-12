// Tema og shell-funktioner
import { getCurrentClerk, getCurrentAdmin, isCurrentUserAdmin, getInstitutionId } from '../domain/session-store.js?v=3.0.67';
import { getProductIconInfo, applyProductLimitsToButtons, invalidateChildLimitSnapshot } from '../domain/products-and-cart.js?v=3.0.67';
import { setupHelpModule, openHelpManually } from './help.js?v=3.0.67';
import { supabaseClient, SUPABASE_URL, SUPABASE_ANON_KEY } from '../core/config-and-supabase.js?v=3.0.67';
import { getCurrentCustomer } from '../domain/cafe-session-store.js?v=3.0.67';
import { getOrder } from '../domain/order-store.js?v=3.0.67';
import { getMyDeviceTokens, revokeDeviceToken, revokeAllDeviceTokens, clearAllDeviceUsers } from '../domain/device-trust.js?v=3.0.67';
import { logAuditEvent } from '../core/audit-events.js?v=3.0.67';
import {
    initThemeLoader,
    switchTheme as themePackSwitchTheme,
    getCurrentTheme,
    isThemePackTheme,
    ALL_VALID_THEMES
} from './theme-loader.js?v=3.0.67';
import { initMobilePayImport, injectStyles as injectMobilePayStyles } from '../domain/mobilepay-import.js?v=3.0.67';
import { updateInstitutionCache } from '../domain/institution-store.js?v=3.0.67';
import { showCustomAlert } from './sound-and-alerts.js?v=3.0.67';
import { refetchAllProducts } from '../core/data-refetch.js?v=3.0.67';
import { invalidateAllLimitCaches } from '../domain/purchase-limits.js?v=3.0.67';
import { getCafeEventSettings, saveCafeEventSettings } from '../domain/cafe-events.js?v=3.0.67';
import { openAulaImportModal } from './aula-import-modal.js?v=3.0.67';
import { openUserAdminPanel, openParentPortalAsAdmin } from './user-admin-panel.js?v=3.0.67';

const THEME_STORAGE_KEY = 'flango-ui-theme';

// Modal-stak: tilbage går altid til forrige visning
let settingsModalBackStack = [];
function settingsModalGoBack() {
    if (settingsModalBackStack.length === 0) return;
    const fn = settingsModalBackStack.pop();
    fn();
}
function settingsModalPushParent(fn) {
    settingsModalBackStack.push(fn);
}
function updateSettingsModalBackVisibility() {
    const btn = document.getElementById('settings-modal-back-btn');
    if (btn) btn.style.display = settingsModalBackStack.length > 0 ? '' : 'none';
}

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

// isCurrentUserAdmin is imported from session-store.js

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
    institutionId: null,
    sortColumn: 'in_assortment',
    sortDirection: 'desc',
    showInactiveProducts: false, // Vis deaktiverede produkter (is_enabled=false)
    // Draft state for pending changes (kun lokale ændringer, ikke gemt endnu)
    draft: new Map(), // productId -> { field: newValue, ... }
    originalValues: new Map() // productId -> { field: originalValue, ... } for at kunne sammenligne
};

// Hjælpefunktioner til draft state
function setDraftValue(productId, field, value) {
    if (!productRulesState.draft.has(productId)) {
        productRulesState.draft.set(productId, {});
    }
    productRulesState.draft.get(productId)[field] = value;
    updateApplyButtonState();
}

function getDraftValue(productId, field, fallback) {
    const draft = productRulesState.draft.get(productId);
    if (draft && field in draft) {
        return draft[field];
    }
    return fallback;
}

function setOriginalValue(productId, field, value) {
    if (!productRulesState.originalValues.has(productId)) {
        productRulesState.originalValues.set(productId, {});
    }
    productRulesState.originalValues.get(productId)[field] = value;
}

function getOriginalValue(productId, field, fallback) {
    const orig = productRulesState.originalValues.get(productId);
    if (orig && field in orig) {
        return orig[field];
    }
    return fallback;
}

function hasUnsavedChanges() {
    for (const [productId, changes] of productRulesState.draft) {
        const originals = productRulesState.originalValues.get(productId) || {};
        for (const [field, newValue] of Object.entries(changes)) {
            const originalValue = originals[field];
            if (newValue !== originalValue) {
                return true;
            }
        }
    }
    return false;
}

function clearDraftState() {
    productRulesState.draft.clear();
    productRulesState.originalValues.clear();
    updateApplyButtonState();
}

function updateApplyButtonState() {
    const applyBtn = document.getElementById('apply-sugar-policy-btn');
    if (applyBtn) {
        const hasChanges = hasUnsavedChanges();
        applyBtn.disabled = !hasChanges;
        applyBtn.style.opacity = hasChanges ? '1' : '0.5';
        applyBtn.style.cursor = hasChanges ? 'pointer' : 'not-allowed';
    }
}

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

async function saveProductDailySpecial(productId, isDailySpecial) {
    const { error } = await supabaseClient
        .from('products')
        .update({ is_daily_special: isDailySpecial })
        .eq('id', productId);
    if (error) {
        console.error('[product-rules] Error saving daily special status:', error);
    }
}

async function saveProductCoreAssortment(productId, isCoreAssortment) {
    const { error } = await supabaseClient
        .from('products')
        .update({ is_core_assortment: isCoreAssortment })
        .eq('id', productId);
    if (error) {
        console.error('[product-rules] Error saving core assortment status:', error);
    }
}

async function saveProductPrice(productId, price) {
    const { error } = await supabaseClient
        .from('products')
        .update({ price: price })
        .eq('id', productId);
    if (error) {
        console.error('[product-rules] Error saving price:', error);
    }
}

async function saveProductName(productId, name) {
    const { error } = await supabaseClient
        .from('products')
        .update({ name: name })
        .eq('id', productId);
    if (error) {
        console.error('[product-rules] Error saving name:', error);
    }
}

async function saveProductVisible(productId, isVisible) {
    const { error } = await supabaseClient
        .from('products')
        .update({ is_visible: isVisible })
        .eq('id', productId);
    if (error) {
        console.error('[product-rules] Error saving is_visible status:', error);
    }
}

async function saveProductLimit(productId, maxPerDay) {
    const institutionId = productRulesState.institutionId;
    if (!institutionId) return;

    if (maxPerDay === null || maxPerDay <= 0) {
        // Delete the limit
        await supabaseClient
            .from('product_limits')
            .delete()
            .eq('institution_id', institutionId)
            .eq('product_id', productId);
        productRulesState.productLimits.delete(productId);
    } else {
        // Upsert the limit
        const { error } = await supabaseClient
            .from('product_limits')
            .upsert({
                institution_id: institutionId,
                product_id: productId,
                max_per_day: maxPerDay
            }, { onConflict: 'institution_id,product_id' });
        if (error) {
            console.error('[product-rules] Error saving limit:', error);
        } else {
            productRulesState.productLimits.set(productId, maxPerDay);
        }
    }
}

async function deleteProduct(productId) {
    const { error } = await supabaseClient
        .from('products')
        .delete()
        .eq('id', productId);
    if (error) {
        console.error('[product-rules] Error deleting product:', error);
        return false;
    }
    return true;
}

function sortProducts(products) {
    const { sortColumn, sortDirection } = productRulesState;
    const dir = sortDirection === 'asc' ? 1 : -1;

    return [...products].sort((a, b) => {
        let aVal, bVal;
        const aLimit = productRulesState.productLimits.get(a.id) || 0;
        const bLimit = productRulesState.productLimits.get(b.id) || 0;

        switch (sortColumn) {
            case 'name':
                aVal = (a.name || '').toLowerCase();
                bVal = (b.name || '').toLowerCase();
                return dir * aVal.localeCompare(bVal, 'da');
            case 'price':
                aVal = a.price || 0;
                bVal = b.price || 0;
                return dir * (aVal - bVal);
            case 'limit':
                return dir * (aLimit - bLimit);
            case 'daily_special':
                aVal = a.is_daily_special ? 1 : 0;
                bVal = b.is_daily_special ? 1 : 0;
                return dir * (aVal - bVal);
            case 'core_assortment':
                aVal = a.is_core_assortment ? 1 : 0;
                bVal = b.is_core_assortment ? 1 : 0;
                return dir * (aVal - bVal);
            case 'in_assortment':
                aVal = a.is_visible !== false ? 1 : 0;
                bVal = b.is_visible !== false ? 1 : 0;
                return dir * (aVal - bVal);
            case 'unhealthy':
                aVal = a.unhealthy ? 1 : 0;
                bVal = b.unhealthy ? 1 : 0;
                return dir * (aVal - bVal);
            case 'active':
                aVal = a.is_enabled !== false ? 1 : 0;
                bVal = b.is_enabled !== false ? 1 : 0;
                return dir * (aVal - bVal);
            case 'created_at':
                aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
                bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
                return dir * (aVal - bVal);
            default:
                return (a.sort_order || 0) - (b.sort_order || 0);
        }
    });
}

function updateSortIndicators() {
    const headers = document.querySelectorAll('#product-rules-table .sortable-col');
    headers.forEach(th => {
        const indicator = th.querySelector('.sort-indicator');
        if (!indicator) return;
        if (th.dataset.sort === productRulesState.sortColumn) {
            indicator.textContent = productRulesState.sortDirection === 'asc' ? ' ▲' : ' ▼';
        } else {
            indicator.textContent = '';
        }
    });
}

function setupSortableHeaders() {
    const headers = document.querySelectorAll('#product-rules-table .sortable-col');
    headers.forEach(th => {
        if (th.dataset.sortBound) return;
        th.dataset.sortBound = 'true';
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (productRulesState.sortColumn === col) {
                productRulesState.sortDirection = productRulesState.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                productRulesState.sortColumn = col;
                productRulesState.sortDirection = 'asc';
            }
            updateSortIndicators();
            renderProductRulesTable();
        });
    });
}

function setupProductSearch() {
    const searchInput = document.getElementById('product-rules-search');
    if (!searchInput || searchInput.dataset.searchBound) return;
    searchInput.dataset.searchBound = 'true';
    let debounce;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => renderProductRulesTable(), 250);
    });
}

function renderProductRulesTable() {
    const tbody = document.getElementById('product-rules-tbody');
    const emptyEl = document.getElementById('product-rules-empty');
    const tableContainer = document.getElementById('product-rules-table-container');
    const unhealthyColHeader = document.getElementById('col-unhealthy');
    const subtitleEl = document.getElementById('product-overview-subtitle');

    if (!tbody) return;
    tbody.innerHTML = '';

    let products = getAllProductsForSugarPolicy();
    const totalProductCount = products.length;

    // Filter: Skjul deaktiverede produkter som default (medmindre showInactiveProducts er true)
    if (!productRulesState.showInactiveProducts) {
        products = products.filter(p => p.is_enabled !== false);
    }

    // Filter: Søg i produktnavn
    const searchInput = document.getElementById('product-rules-search');
    const searchQuery = (searchInput?.value || '').trim().toLowerCase();
    if (searchQuery) {
        products = products.filter(p => (p.name || '').toLowerCase().includes(searchQuery));
    }

    // Opdater undertitel med antal produkter
    if (subtitleEl) {
        const showing = products.length;
        subtitleEl.textContent = searchQuery
            ? `(${showing} af ${totalProductCount})`
            : `(${totalProductCount})`;
    }

    // Show/hide empty message
    if (!products || products.length === 0) {
        if (tableContainer) tableContainer.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }
    if (tableContainer) tableContainer.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';

    // Determine if Usund column should be visible
    const showUnhealthyCol = productRulesState.sugarPolicyEnabled && productRulesState.parentPortalAllowsUnhealthy;

    // Update column header visibility
    if (unhealthyColHeader) {
        unhealthyColHeader.style.display = showUnhealthyCol ? '' : 'none';
    }

    const sortedProducts = sortProducts(products);

    sortedProducts.forEach((product) => {
        const tr = document.createElement('tr');
        tr.dataset.productId = product.id;
        tr.style.borderBottom = '1px solid #eee';

        const isActive = product.is_enabled !== false;
        const isUnhealthy = product.unhealthy === true;
        const isDailySpecial = product.is_daily_special === true;
        const isCoreAssortment = product.is_core_assortment === true;
        let purchaseLimit = productRulesState.productLimits.get(product.id) || 0;
        let currentPrice = product.price || 0;

        const CB = 'border-left:1px solid rgba(0,0,0,0.08);border-right:1px solid rgba(0,0,0,0.08);'; // cell border

        // 0. Dagens sortiment (toggle for visibility in cafe - FØRST fordi det bruges dagligt)
        const isVisible = product.is_visible !== false; // Default true if undefined
        setOriginalValue(product.id, 'is_visible', isVisible);
        const tdInAssortment = document.createElement('td');
        tdInAssortment.style.cssText = 'padding: 8px; vertical-align: middle; text-align: center;' + CB;
        tdInAssortment.className = isVisible ? 'prt-assortment-on' : 'prt-assortment-off';
        const inAssortmentToggle = document.createElement('input');
        inAssortmentToggle.type = 'checkbox';
        inAssortmentToggle.checked = isVisible;
        inAssortmentToggle.style.cssText = 'width: 22px; height: 22px; cursor: pointer;';
        inAssortmentToggle.className = 'prt-assortment-checkbox';
        inAssortmentToggle.title = isVisible ? 'Vises i caféen' : 'Skjult fra caféen';
        inAssortmentToggle.addEventListener('change', () => {
            setDraftValue(product.id, 'is_visible', inAssortmentToggle.checked);
            inAssortmentToggle.title = inAssortmentToggle.checked ? 'Vises i caféen' : 'Skjult fra caféen';
            tdInAssortment.className = inAssortmentToggle.checked ? 'prt-assortment-on' : 'prt-assortment-off';
        });
        tdInAssortment.appendChild(inAssortmentToggle);
        tr.appendChild(tdInAssortment);

        // 1. Ikon (klikbar → åbner ikon-picker)
        const tdIcon = document.createElement('td');
        tdIcon.style.cssText = 'padding: 8px; vertical-align: middle; text-align: center; cursor: pointer;' + CB;
        tdIcon.title = 'Klik for at ændre ikon';
        const iconInfo = getProductIconInfo(product);
        if (iconInfo?.path) {
            tdIcon.innerHTML = `<img src="${iconInfo.path}" alt="${product.name}" style="width: 32px; height: 32px; object-fit: contain; border-radius: 4px;">`;
        } else {
            tdIcon.innerHTML = `<span style="font-size: 24px;">${product.emoji || '🛒'}</span>`;
        }
        tdIcon.addEventListener('click', async (e) => {
            e.stopPropagation();
            const { openProductIconPicker } = await import('./product-icon-picker.js?v=3.0.67');
            openProductIconPicker({
                mode: 'product',
                institutionId: productRulesState.institutionId,
                productId: product.id,
                productName: product.name || '',
                currentIcon: product.icon_url ? { url: product.icon_url, storagePath: product.icon_storage_path } : null,
                adminProfile: getCurrentAdmin(),
                onResult: async (result) => {
                    const updates = {};
                    if (result.type === 'emoji') {
                        updates.emoji = result.emoji;
                        updates.icon_url = null;
                        updates.icon_storage_path = null;
                    } else if (result.type === 'standard' || result.type === 'icon') {
                        updates.emoji = result.emoji || null;
                        updates.icon_url = null;
                        updates.icon_storage_path = null;
                    } else if (result.type === 'upload' || result.type === 'ai') {
                        updates.icon_url = result.url;
                        updates.icon_storage_path = result.storagePath || null;
                        updates.icon_updated_at = result.updatedAt || new Date().toISOString();
                        updates.emoji = null;
                    }
                    const { error } = await supabaseClient
                        .from('products')
                        .update(updates)
                        .eq('id', product.id);
                    if (error) {
                        console.error('[Produktoversigt] Fejl ved ikon-opdatering:', error);
                    } else {
                        Object.assign(product, updates);
                        renderProductRulesTable();
                    }
                },
            });
        });
        tr.appendChild(tdIcon);

        // 2. Navn (med blyant-ikon for redigering)
        const tdName = document.createElement('td');
        tdName.style.cssText = 'padding: 8px; vertical-align: middle; font-weight: 500;' + CB;

        const nameSpan = document.createElement('span');
        nameSpan.textContent = product.name || 'Produkt';

        const editNameBtn = document.createElement('button');
        editNameBtn.type = 'button';
        editNameBtn.innerHTML = '✏️';
        editNameBtn.title = 'Redigér navn';
        editNameBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:12px;padding:2px 4px;margin-left:4px;opacity:0.4;transition:opacity 0.15s;';
        editNameBtn.addEventListener('mouseenter', () => { editNameBtn.style.opacity = '1'; });
        editNameBtn.addEventListener('mouseleave', () => { editNameBtn.style.opacity = '0.4'; });

        tdName.appendChild(nameSpan);
        tdName.appendChild(editNameBtn);

        // Gem original værdi for sammenligning
        setOriginalValue(product.id, 'name', product.name || 'Produkt');

        editNameBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Don't trigger row click

            // Replace name cell with input field
            const currentName = getDraftValue(product.id, 'name', product.name || 'Produkt');
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentName;
            input.style.cssText = 'width: 100%; padding: 4px 8px; font-size: 13px; font-weight: 500; border: 2px solid #1976d2; border-radius: 4px; outline: none;';

            // Stop click events fra input fra at boble op til tdName
            input.addEventListener('click', (ev) => ev.stopPropagation());

            const applyNewName = () => {
                const newName = input.value.trim();
                if (newName) {
                    setDraftValue(product.id, 'name', newName);
                    nameSpan.textContent = newName;
                } else {
                    nameSpan.textContent = currentName;
                }
                tdName.innerHTML = '';
                tdName.appendChild(nameSpan);
            };

            input.addEventListener('blur', applyNewName);
            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') {
                    ev.preventDefault();
                    applyNewName();
                } else if (ev.key === 'Escape') {
                    tdName.innerHTML = '';
                    tdName.appendChild(nameSpan);
                }
            });

            tdName.innerHTML = '';
            tdName.appendChild(input);
            input.focus();
            input.select();
        });
        tr.appendChild(tdName);

        // 3. Pris med +/- controls
        setOriginalValue(product.id, 'price', currentPrice);
        const tdPrice = document.createElement('td');
        tdPrice.style.cssText = 'padding: 4px 8px; vertical-align: middle; text-align: center; white-space: nowrap;' + CB;
        const priceDisplay = document.createElement('span');
        priceDisplay.style.cssText = 'display: inline-block; min-width: 50px; font-weight: 500;';
        priceDisplay.textContent = currentPrice.toFixed(2);

        const minusPriceBtn = document.createElement('button');
        minusPriceBtn.textContent = '−';
        minusPriceBtn.title = 'Sænk pris med 1 kr';
        minusPriceBtn.className = 'prt-pm-btn';
        minusPriceBtn.style.cssText = 'margin-right: 4px;';
        minusPriceBtn.addEventListener('click', () => {
            if (currentPrice > 0) {
                currentPrice = Math.max(0, currentPrice - 1);
                priceDisplay.textContent = currentPrice.toFixed(2);
                setDraftValue(product.id, 'price', currentPrice);
            }
        });

        const plusPriceBtn = document.createElement('button');
        plusPriceBtn.textContent = '+';
        plusPriceBtn.title = 'Hæv pris med 1 kr';
        plusPriceBtn.className = 'prt-pm-btn';
        plusPriceBtn.style.cssText = 'margin-left: 4px;';
        plusPriceBtn.addEventListener('click', () => {
            currentPrice = currentPrice + 1;
            priceDisplay.textContent = currentPrice.toFixed(2);
            setDraftValue(product.id, 'price', currentPrice);
        });

        tdPrice.appendChild(minusPriceBtn);
        tdPrice.appendChild(priceDisplay);
        tdPrice.appendChild(plusPriceBtn);
        tr.appendChild(tdPrice);

        // 4. Købsgrænse med +/- controls
        setOriginalValue(product.id, 'limit', purchaseLimit);
        const tdLimit = document.createElement('td');
        tdLimit.style.cssText = 'padding: 4px 8px; vertical-align: middle; text-align: center; white-space: nowrap;' + CB;
        const limitDisplay = document.createElement('span');
        limitDisplay.style.cssText = 'display: inline-block; min-width: 30px; font-weight: 500; color: #1565c0;';
        limitDisplay.textContent = purchaseLimit > 0 ? purchaseLimit : '∞';

        const minusLimitBtn = document.createElement('button');
        minusLimitBtn.textContent = '−';
        minusLimitBtn.title = 'Sænk grænse med 1';
        minusLimitBtn.className = 'prt-pm-btn';
        minusLimitBtn.style.cssText = 'margin-right: 4px;';
        minusLimitBtn.addEventListener('click', () => {
            if (purchaseLimit > 0) {
                purchaseLimit = purchaseLimit - 1;
                limitDisplay.textContent = purchaseLimit > 0 ? purchaseLimit : '∞';
                setDraftValue(product.id, 'limit', purchaseLimit);
            }
        });

        const plusLimitBtn = document.createElement('button');
        plusLimitBtn.textContent = '+';
        plusLimitBtn.title = 'Hæv grænse med 1';
        plusLimitBtn.className = 'prt-pm-btn';
        plusLimitBtn.style.cssText = 'margin-left: 4px;';
        plusLimitBtn.addEventListener('click', () => {
            purchaseLimit = purchaseLimit + 1;
            limitDisplay.textContent = purchaseLimit;
            setDraftValue(product.id, 'limit', purchaseLimit);
        });

        tdLimit.appendChild(minusLimitBtn);
        tdLimit.appendChild(limitDisplay);
        tdLimit.appendChild(plusLimitBtn);
        tr.appendChild(tdLimit);

        // 5. Dagens ret (toggle)
        setOriginalValue(product.id, 'is_daily_special', isDailySpecial);
        const tdDailySpecial = document.createElement('td');
        tdDailySpecial.style.cssText = 'padding: 8px; vertical-align: middle; text-align: center;' + CB;
        const dailySpecialToggle = document.createElement('input');
        dailySpecialToggle.type = 'checkbox';
        dailySpecialToggle.checked = isDailySpecial;
        dailySpecialToggle.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
        dailySpecialToggle.title = isDailySpecial ? 'Er dagens ret' : 'Klik for at markere som dagens ret';
        dailySpecialToggle.addEventListener('change', () => {
            setDraftValue(product.id, 'is_daily_special', dailySpecialToggle.checked);
        });
        tdDailySpecial.appendChild(dailySpecialToggle);
        tr.appendChild(tdDailySpecial);

        // 6. Fast sortiment (toggle)
        setOriginalValue(product.id, 'is_core_assortment', isCoreAssortment);
        const tdCoreAssortment = document.createElement('td');
        tdCoreAssortment.style.cssText = 'padding: 8px; vertical-align: middle; text-align: center;' + CB;
        const coreAssortmentToggle = document.createElement('input');
        coreAssortmentToggle.type = 'checkbox';
        coreAssortmentToggle.checked = isCoreAssortment;
        coreAssortmentToggle.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
        coreAssortmentToggle.title = isCoreAssortment ? 'Er fast sortiment' : 'Klik for at markere som fast sortiment';
        coreAssortmentToggle.addEventListener('change', () => {
            setDraftValue(product.id, 'is_core_assortment', coreAssortmentToggle.checked);
        });
        tdCoreAssortment.appendChild(coreAssortmentToggle);
        tr.appendChild(tdCoreAssortment);

        // (Dagens sortiment er allerede tilføjet som kolonne 0 øverst)

        // 7. Usund (toggle - conditional visibility)
        setOriginalValue(product.id, 'unhealthy', isUnhealthy);
        const tdUnhealthy = document.createElement('td');
        tdUnhealthy.style.cssText = 'padding: 8px; vertical-align: middle; text-align: center;' + CB;
        tdUnhealthy.style.display = showUnhealthyCol ? '' : 'none';
        tdUnhealthy.className = 'col-unhealthy-cell';

        const unhealthyToggle = document.createElement('input');
        unhealthyToggle.type = 'checkbox';
        unhealthyToggle.checked = isUnhealthy;
        unhealthyToggle.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
        unhealthyToggle.title = isUnhealthy ? 'Markeret som usund' : 'Klik for at markere som usund';
        unhealthyToggle.addEventListener('change', () => {
            setDraftValue(product.id, 'unhealthy', unhealthyToggle.checked);
        });
        tdUnhealthy.appendChild(unhealthyToggle);
        tr.appendChild(tdUnhealthy);

        // 8. Aktiv (toggle)
        setOriginalValue(product.id, 'is_enabled', isActive);
        const tdActive = document.createElement('td');
        tdActive.style.cssText = 'padding: 8px; vertical-align: middle; text-align: center;' + CB;

        const activeToggle = document.createElement('input');
        activeToggle.type = 'checkbox';
        activeToggle.checked = isActive;
        activeToggle.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
        activeToggle.title = isActive ? 'Produktet er aktivt' : 'Produktet er deaktiveret';
        activeToggle.addEventListener('change', () => {
            setDraftValue(product.id, 'is_enabled', activeToggle.checked);
            tr.style.opacity = activeToggle.checked ? '1' : '0.5';
        });
        tdActive.appendChild(activeToggle);
        tr.appendChild(tdActive);

        // Apply inactive styling if not active
        if (!isActive) {
            tr.style.opacity = '0.5';
        }

        // 9. Slet (delete button)
        const tdDelete = document.createElement('td');
        tdDelete.style.cssText = 'padding: 8px; vertical-align: middle; text-align: center;' + CB;

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Slet produkt';
        deleteBtn.style.cssText = 'background: none; border: none; font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: background 0.2s;';
        deleteBtn.addEventListener('mouseenter', () => deleteBtn.style.background = '#ffebee');
        deleteBtn.addEventListener('mouseleave', () => deleteBtn.style.background = 'none');
        deleteBtn.addEventListener('click', async () => {
            const confirmed = await showCustomAlert(
                'Slet produkt',
                `<p>Er du sikker på, at du vil slette <strong>${product.name}</strong> permanent?</p>
                <p style="margin-top: 12px; color: #666;">Når et produkt slettes, fjernes det fra sortimentet og kan ikke længere bruges til nye køb.<br>Tidligere salg bevares fortsat i historikken og i klubbens statistik.</p>
                <p style="margin-top: 12px; background: #fff8e1; padding: 10px; border-radius: 6px; font-size: 13px;">💡 <strong>Tip:</strong> Hvis produktet kun skal fjernes midlertidigt, kan du i stedet deaktivere det ved at fjerne hakket i "Aktiv".</p>`,
                {
                    type: 'confirm',
                    okText: 'Slet',
                    cancelText: 'Fortryd',
                    focus: 'cancel'
                }
            );
            if (confirmed) {
                const success = await deleteProduct(product.id);
                if (success) {
                    tr.remove();
                    // Also remove from local products array if possible
                    const products = getAllProductsForSugarPolicy();
                    const idx = products.findIndex(p => p.id === product.id);
                    if (idx !== -1) products.splice(idx, 1);
                }
            }
        });
        // 9. Oprettet (created_at) — skal komme FØR Slet
        const tdCreated = document.createElement('td');
        tdCreated.style.cssText = 'padding: 8px; vertical-align: middle; text-align: center; font-size: 12px; color: #94a3b8; white-space: nowrap;' + CB;
        if (product.created_at) {
            const d = new Date(product.created_at);
            tdCreated.textContent = `${d.getDate()}/${d.getMonth() + 1}-${d.getFullYear().toString().slice(-2)}`;
            tdCreated.title = d.toLocaleString('da-DK');
        } else {
            tdCreated.textContent = '—';
        }
        tr.appendChild(tdCreated);

        tdDelete.appendChild(deleteBtn);
        tr.appendChild(tdDelete);

        // 10. Rediger (åbner produkt-modal)
        const tdEdit = document.createElement('td');

        // 10. Redigér
        tdEdit.style.cssText = 'padding: 8px; vertical-align: middle; text-align: center;' + CB;
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '✏️';
        editBtn.title = 'Rediger produkt';
        editBtn.style.cssText = 'background: none; border: none; font-size: 16px; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: background 0.2s;';
        editBtn.addEventListener('mouseenter', () => editBtn.style.background = '#e3f2fd');
        editBtn.addEventListener('mouseleave', () => editBtn.style.background = 'none');
        editBtn.addEventListener('click', async () => {
            // Check for unsaved changes før vi lukker
            if (hasUnsavedChanges()) {
                const result = await showCustomAlert(
                    'Ugemte ændringer',
                    `<p>Du har ændringer der ikke er gemt.</p>
                    <p style="margin-top: 12px;">Vil du gemme før du redigerer produktet?</p>`,
                    {
                        type: 'confirm',
                        okText: 'Gem først',
                        cancelText: 'Kassér ændringer',
                        showCancel: true,
                        focus: 'ok'
                    }
                );

                if (result === true) {
                    // Gem først
                    try {
                        await saveAllDraftChanges();
                    } catch (err) {
                        console.error('[product-rules] Fejl ved gemning:', err);
                        await showCustomAlert('Fejl', 'Der opstod en fejl ved gemning: ' + err.message);
                        return;
                    }
                } else if (result === false) {
                    // Kassér ændringer
                    clearDraftState();
                } else {
                    // X lukket - bliv på siden
                    return;
                }
            }

            // Luk produktoversigt-modal og åbn produkt-redigerings-modal
            const modal = document.getElementById('sugar-policy-modal');
            if (modal) modal.style.display = 'none';
            // Kald openEditProductModal via window global
            if (typeof window.__flangoOpenEditProductModal === 'function') {
                window.__flangoOpenEditProductModal(product);
            }
        });
        tdEdit.appendChild(editBtn);
        tr.appendChild(tdEdit);

        // Hele rækken er klikbar → åbner redigér modal
        tr.addEventListener('click', async (e) => {
            // Ignorer klik på interaktive elementer (knapper, checkboxes, inputs)
            const target = e.target;
            if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'SELECT' ||
                target.closest('button') || target.closest('input')) return;

            // Brug editBtn's klik-handler logik
            editBtn.click();
        });

        tbody.appendChild(tr);
    });

    // Setup sortable headers + search after render
    setupSortableHeaders();
    setupProductSearch();
    updateSortIndicators();
}

// Expose globally so product edit modal can re-render after returning
window.__flangoRenderProductRulesTable = renderProductRulesTable;

/**
 * Håndterer lukning af produktoversigt modal med check for ugemte ændringer
 * @param {Function} onClose - Callback der kaldes ved lukning
 */
async function handleProductOverviewClose(onClose) {
    if (!hasUnsavedChanges()) {
        clearDraftState();
        onClose();
        return;
    }

    // Vis dialog med 3 muligheder
    const result = await showCustomAlert(
        'Ugemte ændringer',
        `<p>Du har ændringer der ikke er gemt.</p>
        <p style="margin-top: 12px;">Hvad vil du gøre?</p>`,
        {
            type: 'confirm',
            okText: 'Gem og luk',
            cancelText: 'Kassér ændringer',
            showCancel: true,
            focus: 'ok'
        }
    );

    if (result === true) {
        // Gem og luk
        try {
            await saveAllDraftChanges();
            onClose();
        } catch (err) {
            console.error('[product-rules] Fejl ved gemning:', err);
            await showCustomAlert('Fejl', 'Der opstod en fejl ved gemning: ' + err.message);
        }
    } else if (result === false) {
        // Kassér ændringer og luk
        clearDraftState();
        onClose();
    }
    // Hvis result er undefined (X lukket), gør ingenting (bliv på siden)
}

function ensureSugarPolicyModal() {
    const modal = document.getElementById('sugar-policy-modal');
    if (!modal || modal.dataset.bindings) return;

    const closeBtn = modal.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', async () => {
            await handleProductOverviewClose(() => {
                modal.style.display = 'none';
            });
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

    // Back button – Produktoversigt åbnes fra Indstillinger (hovedmenu), så Tilbage går tilbage til Indstillinger
    const backBtn = document.getElementById('back-to-preferences-sugar-policy-btn');
    if (backBtn) {
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        newBackBtn.onclick = async () => {
            await handleProductOverviewClose(() => {
                modal.style.display = 'none';
                const backdrop = document.getElementById('settings-modal-backdrop');
                if (backdrop) backdrop.style.display = 'flex';
                openSettingsModal();
            });
        };
    }

    // Tilføj nyt produkt knap
    const addProductBtn = document.getElementById('add-product-from-rules-btn');
    if (addProductBtn) {
        const newAddBtn = addProductBtn.cloneNode(true);
        addProductBtn.parentNode.replaceChild(newAddBtn, addProductBtn);
        newAddBtn.onclick = async () => {
            await handleProductOverviewClose(() => {
                modal.style.display = 'none';
                // Åbn "Tilføj Produkt" modal
                if (typeof window.__flangoOpenEditProductModal === 'function') {
                    window.__flangoOpenEditProductModal(null); // null = nyt produkt
                }
            });
        };
    }

    // Toggle vis/skjul deaktiverede produkter
    const toggleInactiveBtn = document.getElementById('toggle-inactive-products-btn');
    if (toggleInactiveBtn) {
        const newToggleBtn = toggleInactiveBtn.cloneNode(true);
        toggleInactiveBtn.parentNode.replaceChild(newToggleBtn, toggleInactiveBtn);

        // Tæl antal deaktiverede produkter
        const allProducts = getAllProductsForSugarPolicy();
        const inactiveCount = allProducts.filter(p => p.is_enabled === false).length;

        // Opdater knap-tekst baseret på nuværende state (med antal)
        const updateToggleBtnText = () => {
            if (productRulesState.showInactiveProducts) {
                newToggleBtn.textContent = 'Skjul deaktiverede';
            } else {
                newToggleBtn.textContent = inactiveCount > 0 ? `Vis (${inactiveCount}) deaktiverede` : 'Vis deaktiverede';
            }
        };
        updateToggleBtnText();

        newToggleBtn.onclick = () => {
            productRulesState.showInactiveProducts = !productRulesState.showInactiveProducts;
            updateToggleBtnText();
            renderProductRulesTable();
        };
    }

    // Anvend ændringer knap - batch-gem alle ændringer
    const applyBtn = document.getElementById('apply-sugar-policy-btn');
    if (applyBtn) {
        const newApplyBtn = applyBtn.cloneNode(true);
        applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
        // Start disabled (ingen ændringer endnu)
        newApplyBtn.disabled = true;
        newApplyBtn.style.opacity = '0.5';
        newApplyBtn.style.cursor = 'not-allowed';

        newApplyBtn.onclick = async () => {
            if (!hasUnsavedChanges()) return;

            newApplyBtn.disabled = true;
            newApplyBtn.textContent = 'Gemmer...';

            try {
                await saveAllDraftChanges();
                // Invalider limit-caches og opdater produktvælger UI
                const selectedCustomer = typeof getCurrentCustomer === 'function' ? getCurrentCustomer() : null;
                invalidateAllLimitCaches(selectedCustomer?.id || null);
                invalidateChildLimitSnapshot();

                if (typeof window.__flangoRefreshSugarPolicy === 'function') {
                    await window.__flangoRefreshSugarPolicy();
                } else {
                    const allProducts = typeof window.__flangoGetAllProducts === 'function' ? window.__flangoGetAllProducts() : [];
                    const sugarData = typeof window.__flangoGetSugarData === 'function' ? window.__flangoGetSugarData() : null;
                    const productsEl = document.getElementById('products');
                    const currentOrder = typeof getOrder === 'function' ? getOrder() : [];
                    await applyProductLimitsToButtons(allProducts, productsEl, currentOrder, selectedCustomer?.id || null, sugarData);
                }

                newApplyBtn.textContent = '✓ Gemt!';
                newApplyBtn.style.background = '#2e7d32';
                newApplyBtn.style.opacity = '1';

                setTimeout(() => {
                    newApplyBtn.textContent = 'Anvend ændringer';
                    newApplyBtn.style.background = '#4CAF50';
                    updateApplyButtonState();
                }, 1500);
            } catch (err) {
                console.error('[product-rules] Fejl ved gemning:', err);
                newApplyBtn.textContent = 'Fejl ved gemning';
                newApplyBtn.style.background = '#f44336';
                setTimeout(() => {
                    newApplyBtn.textContent = 'Anvend ændringer';
                    newApplyBtn.style.background = '#4CAF50';
                    newApplyBtn.disabled = false;
                    newApplyBtn.style.opacity = '1';
                    newApplyBtn.style.cursor = 'pointer';
                }, 2000);
            }
        };
    }

    // Clear draft state ved åbning og initialiser knap-state
    clearDraftState();
    renderProductRulesTable();
    updateApplyButtonState();
    modal.style.display = 'flex';
}

/**
 * Gem alle draft-ændringer til databasen i én batch
 */
async function saveAllDraftChanges() {
    const products = getAllProductsForSugarPolicy();
    const errors = [];

    for (const [productId, changes] of productRulesState.draft) {
        const originals = productRulesState.originalValues.get(productId) || {};
        const product = products.find(p => p.id === productId);

        // Samle produkt-felter der skal opdateres
        const productUpdates = {};
        let hasProductUpdates = false;

        for (const [field, newValue] of Object.entries(changes)) {
            const originalValue = originals[field];
            if (newValue === originalValue) continue; // Ingen ændring

            if (field === 'limit') {
                // Limit gemmes i product_limits tabellen
                try {
                    await saveProductLimit(productId, newValue > 0 ? newValue : null);
                } catch (err) {
                    errors.push(`Grænse for ${product?.name || productId}: ${err.message}`);
                }
            } else {
                // Produkt-felter samles til én opdatering
                productUpdates[field] = newValue;
                hasProductUpdates = true;
            }
        }

        // Gem produkt-opdateringer i én query
        if (hasProductUpdates) {
            const { error } = await supabaseClient
                .from('products')
                .update(productUpdates)
                .eq('id', productId);

            if (error) {
                errors.push(`${product?.name || productId}: ${error.message}`);
            } else {
                // Opdater lokal cache
                if (product) {
                    Object.assign(product, productUpdates);
                }
            }
        }
    }

    if (errors.length > 0) {
        console.error('[product-rules] Fejl ved gemning:', errors);
        throw new Error(errors.join(', '));
    }

    // Ryd draft state efter succesfuld gemning
    clearDraftState();

    // Opdater produkter i hovedvisningen:
    // 1. Refetch fra database for at opdatere cache
    await refetchAllProducts();
    // 2. Render produkter fra cache så UI opdateres med det samme
    if (typeof window.__flangoRenderProductsFromCache === 'function') {
        await window.__flangoRenderProductsFromCache();
    }

    console.log('[product-rules] Alle ændringer gemt');
    logAuditEvent('SETTINGS_CHANGE', {
        institutionId: getInstitutionId(),
        details: { context: 'product_rules_batch_save', changed_products: productRulesState.draft.size },
    });
}

/**
 * Åbner det separate Sukkerpolitik indstillinger modal
 */
async function openSugarPolicySettingsModal() {
    const modal = document.getElementById('sugar-policy-settings-modal');
    if (!modal) return;

    const institutionId = getInstitutionId();
    if (!institutionId) {
        console.error('[sugar-policy-settings] No institution ID found');
        return;
    }

    // Load current settings from database
    const { data, error } = await supabaseClient
        .from('institutions')
        .select('sugar_policy_enabled, sugar_policy_max_unhealthy_per_day, sugar_policy_max_per_product_per_day, sugar_policy_max_unhealthy_enabled, sugar_policy_max_per_product_enabled')
        .eq('id', institutionId)
        .single();

    if (error) {
        console.error('[sugar-policy-settings] Error loading settings:', error);
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
        productRulesState.sugarPolicyEnabled = enabled;
        toggle.checked = enabled;
        maxUnhealthyInput.value = data.sugar_policy_max_unhealthy_per_day || 2;
        maxPerProductInput.value = data.sugar_policy_max_per_product_per_day || 1;
        maxUnhealthyEnabledCheckbox.checked = data.sugar_policy_max_unhealthy_enabled || false;
        maxPerProductEnabledCheckbox.checked = data.sugar_policy_max_per_product_enabled !== false;
    }

    // Opdater UI: maks-felter vises altid; greyed out når Sukkerpolitik er FRA
    const updateFieldStates = () => {
        const currentToggle = document.getElementById('sugar-policy-enabled-toggle');
        const currentMaxUnhealthyInput = document.getElementById('sugar-policy-max-unhealthy');
        const currentMaxPerProductInput = document.getElementById('sugar-policy-max-per-product');
        const currentMaxUnhealthyEnabledCheckbox = document.getElementById('sugar-policy-max-unhealthy-enabled');
        const currentMaxPerProductEnabledCheckbox = document.getElementById('sugar-policy-max-per-product-enabled');
        const currentLabel = document.getElementById('sugar-policy-enabled-label');
        const currentSettings = document.getElementById('sugar-policy-settings');

        if (!currentToggle || !currentMaxUnhealthyInput || !currentMaxPerProductInput) return;

        const mainEnabled = currentToggle.checked;
        const maxUnhealthyEnabled = currentMaxUnhealthyEnabledCheckbox?.checked;
        const maxPerProductEnabled = currentMaxPerProductEnabledCheckbox?.checked;

        if (currentLabel) currentLabel.textContent = mainEnabled ? 'Sukkerpolitik er slået TIL' : 'Sukkerpolitik er slået FRA';
        // Maks af hver usund vare/dag og Maks usunde produkter/dag vises altid; greyed out når slået FRA
        if (currentSettings) {
            currentSettings.style.display = 'block';
            currentSettings.classList.toggle('sugar-policy-settings-disabled', !mainEnabled);
        }

        if (!mainEnabled) {
            currentMaxUnhealthyInput.disabled = true;
            currentMaxPerProductInput.disabled = true;
            currentMaxUnhealthyInput.style.opacity = '0.5';
            currentMaxPerProductInput.style.opacity = '0.5';
            if (currentMaxUnhealthyEnabledCheckbox) currentMaxUnhealthyEnabledCheckbox.disabled = true;
            if (currentMaxPerProductEnabledCheckbox) currentMaxPerProductEnabledCheckbox.disabled = true;
        } else {
            if (currentMaxUnhealthyEnabledCheckbox) currentMaxUnhealthyEnabledCheckbox.disabled = false;
            if (currentMaxPerProductEnabledCheckbox) currentMaxPerProductEnabledCheckbox.disabled = false;

            currentMaxUnhealthyInput.disabled = !maxUnhealthyEnabled;
            currentMaxUnhealthyInput.style.opacity = maxUnhealthyEnabled ? '1' : '0.5';

            currentMaxPerProductInput.disabled = !maxPerProductEnabled;
            currentMaxPerProductInput.style.opacity = maxPerProductEnabled ? '1' : '0.5';
        }

        productRulesState.sugarPolicyEnabled = mainEnabled;
        sugarPolicyState.enabled = mainEnabled;
    };

    updateFieldStates();

    // Save function
    const saveSettings = async (updates) => {
        const { error } = await supabaseClient
            .from('institutions')
            .update(updates)
            .eq('id', institutionId);
        if (error) {
            console.error('[sugar-policy-settings] Error saving settings:', error);
        }
    };

    // Event listeners
    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);
    newToggle.addEventListener('change', () => {
        sugarPolicyState.enabled = newToggle.checked;
        updateFieldStates();
        saveSettings({ sugar_policy_enabled: newToggle.checked });
    });

    const newMaxUnhealthyEnabledCheckbox = maxUnhealthyEnabledCheckbox.cloneNode(true);
    maxUnhealthyEnabledCheckbox.parentNode.replaceChild(newMaxUnhealthyEnabledCheckbox, maxUnhealthyEnabledCheckbox);
    newMaxUnhealthyEnabledCheckbox.addEventListener('change', () => {
        const isEnabled = newMaxUnhealthyEnabledCheckbox.checked;
        if (isEnabled) {
            const perProductCheckbox = document.getElementById('sugar-policy-max-per-product-enabled');
            if (perProductCheckbox) {
                perProductCheckbox.checked = false;
                saveSettings({ sugar_policy_max_unhealthy_enabled: true, sugar_policy_max_per_product_enabled: false });
            }
        } else {
            saveSettings({ sugar_policy_max_unhealthy_enabled: false });
        }
        updateFieldStates();
    });

    const newMaxPerProductEnabledCheckbox = maxPerProductEnabledCheckbox.cloneNode(true);
    maxPerProductEnabledCheckbox.parentNode.replaceChild(newMaxPerProductEnabledCheckbox, maxPerProductEnabledCheckbox);
    newMaxPerProductEnabledCheckbox.addEventListener('change', () => {
        const isEnabled = newMaxPerProductEnabledCheckbox.checked;
        if (isEnabled) {
            const unhealthyCheckbox = document.getElementById('sugar-policy-max-unhealthy-enabled');
            if (unhealthyCheckbox) {
                unhealthyCheckbox.checked = false;
                saveSettings({ sugar_policy_max_per_product_enabled: true, sugar_policy_max_unhealthy_enabled: false });
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

    // Close button
    const closeBtn = modal.querySelector('.close-btn');
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.onclick = () => modal.style.display = 'none';
    }

    // Back button
    const backBtn = document.getElementById('back-to-preferences-sugar-settings-btn');
    if (backBtn) {
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        newBackBtn.onclick = () => {
            modal.style.display = 'none';
            openInstitutionPreferences();
        };
    }

    // Apply button
    const applyBtn = document.getElementById('apply-sugar-settings-btn');
    if (applyBtn) {
        const newApplyBtn = applyBtn.cloneNode(true);
        applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
        newApplyBtn.onclick = async () => {
            newApplyBtn.disabled = true;
            newApplyBtn.textContent = 'Gemmer...';

            try {
                if (typeof window.__flangoRefreshSugarPolicy === 'function') {
                    await window.__flangoRefreshSugarPolicy();
                }
                newApplyBtn.textContent = '✓ Gemt!';
                newApplyBtn.style.background = '#2e7d32';
                setTimeout(() => {
                    newApplyBtn.textContent = 'Gem indstillinger';
                    newApplyBtn.style.background = '#4CAF50';
                    newApplyBtn.disabled = false;
                }, 1500);
            } catch (err) {
                console.error('[sugar-policy-settings] Fejl:', err);
                newApplyBtn.textContent = 'Fejl';
                newApplyBtn.style.background = '#f44336';
                setTimeout(() => {
                    newApplyBtn.textContent = 'Gem indstillinger';
                    newApplyBtn.style.background = '#4CAF50';
                    newApplyBtn.disabled = false;
                }, 2000);
            }
        };
    }

    modal.style.display = 'flex';
}

/**
 * Åbner Profilbillede indstillinger modal
 */
async function openProfilePictureSettingsModal() {
    const modal = document.getElementById('profile-picture-settings-modal');
    if (!modal) return;

    const institutionId = getInstitutionId();
    if (!institutionId) return;

    // Load current settings
    const { data, error } = await supabaseClient
        .from('institutions')
        .select('profile_pictures_enabled, profile_picture_types, profile_pictures_ai_enabled, default_profile_picture_mode, default_profile_picture_url')
        .eq('id', institutionId)
        .single();

    if (error) {
        console.error('[profile-picture-settings] Fejl:', error);
        return;
    }

    const enabledToggle = document.getElementById('pp-settings-enabled-toggle');
    const enabledLabel = document.getElementById('pp-settings-enabled-label');
    const typesSection = document.getElementById('pp-settings-types');
    const uploadCb = document.getElementById('pp-type-upload');
    const cameraCb = document.getElementById('pp-type-camera');
    const libraryCb = document.getElementById('pp-type-library');
    const aiAvatarCb = document.getElementById('pp-type-ai-avatar');
    const aiWarning = document.getElementById('pp-ai-warning');

    if (data) {
        const enabled = data.profile_pictures_enabled || false;
        const types = data.profile_picture_types || ['upload', 'camera', 'library'];
        const aiEnabled = data.profile_pictures_ai_enabled || false;

        enabledToggle.checked = enabled;
        enabledLabel.textContent = enabled ? 'Profilbilleder er slået TIL' : 'Profilbilleder er slået FRA';
        typesSection.style.display = enabled ? 'block' : 'none';

        // Show/hide Aula import section
        const aulaSection = document.getElementById('pp-aula-import-section');
        if (aulaSection) aulaSection.style.display = enabled ? 'block' : 'none';

        uploadCb.checked = types.includes('upload');
        cameraCb.checked = types.includes('camera');
        libraryCb.checked = types.includes('library');
        aiAvatarCb.checked = types.includes('ai_avatar');
        aiWarning.style.display = aiAvatarCb.checked ? 'block' : 'none';
    }

    // Toggle enabled
    enabledToggle.onchange = () => {
        const on = enabledToggle.checked;
        enabledLabel.textContent = on ? 'Profilbilleder er slået TIL' : 'Profilbilleder er slået FRA';
        typesSection.style.display = on ? 'block' : 'none';
        const aulaSection = document.getElementById('pp-aula-import-section');
        if (aulaSection) aulaSection.style.display = on ? 'block' : 'none';
    };

    // AI-Avatar warning toggle
    aiAvatarCb.onchange = () => {
        aiWarning.style.display = aiAvatarCb.checked ? 'block' : 'none';
    };

    // --- Default profile picture section ---
    const defaultSection = document.getElementById('pp-default-section');
    const defaultRadios = modal.querySelectorAll('input[name="pp-default-mode"]');
    const defaultImageActions = document.getElementById('pp-default-image-actions');
    const defaultImagePreview = document.getElementById('pp-default-image-preview');
    const defaultImageChooseBtn = document.getElementById('pp-default-image-choose-btn');

    // Show/hide default section based on enabled toggle
    function updateDefaultSectionVisibility() {
        if (defaultSection) defaultSection.style.display = enabledToggle.checked ? 'block' : 'none';
    }
    updateDefaultSectionVisibility();
    const origOnChange = enabledToggle.onchange;
    enabledToggle.onchange = () => {
        origOnChange?.();
        updateDefaultSectionVisibility();
    };

    // Load saved default mode
    if (data) {
        const defaultMode = data.default_profile_picture_mode || 'initials';
        const defaultUrl = data.default_profile_picture_url;
        defaultRadios.forEach(r => { r.checked = (r.value === defaultMode); });
        if (defaultImageActions) defaultImageActions.style.display = defaultMode === 'image' ? 'block' : 'none';
        if (defaultUrl && defaultImagePreview) {
            // Show current default image preview
            supabaseClient.storage.from('profile-pictures').createSignedUrl(defaultUrl, 3600).then(({ data: sd }) => {
                if (sd?.signedUrl) {
                    defaultImagePreview.innerHTML = `<img src="${sd.signedUrl}" alt="" style="width:100%;height:100%;object-fit:cover;">`;
                }
            });
        }
    }

    // Toggle image actions visibility on radio change
    defaultRadios.forEach(r => {
        r.addEventListener('change', () => {
            if (defaultImageActions) defaultImageActions.style.display = r.value === 'image' && r.checked ? 'block' : 'none';
        });
    });

    // Choose default image button — open profile picture modal in "default" mode
    if (defaultImageChooseBtn) {
        defaultImageChooseBtn.onclick = async () => {
            const { openProfilePictureModal } = await import('./profile-picture-modal.js?v=3.0.67');
            // Use a fake user object for the default image
            const fakeUser = { id: '__default__', name: 'Standard billede', institution_id: institutionId };
            openProfilePictureModal(fakeUser, {
                onSaved: async (result) => {
                    if (result?.profile_picture_url) {
                        // Move to institution default path
                        const storagePath = result.profile_picture_url;
                        if (defaultImagePreview) {
                            const { data: sd } = await supabaseClient.storage.from('profile-pictures').createSignedUrl(storagePath, 3600);
                            if (sd?.signedUrl) {
                                defaultImagePreview.innerHTML = `<img src="${sd.signedUrl}" alt="" style="width:100%;height:100%;object-fit:cover;">`;
                            }
                        }
                        // Store URL temporarily — will be saved with "Gem indstillinger"
                        modal.dataset.pendingDefaultUrl = storagePath;
                    }
                },
                showCustomAlert: (title, msg) => alert(msg),
            });
        };
    }

    // Aula import button
    const aulaImportBtn = document.getElementById('pp-aula-import-btn');
    if (aulaImportBtn) {
        aulaImportBtn.onclick = () => {
            modal.style.display = 'none';
            openAulaImportModal();
        };
    }

    // Close + back buttons
    const closeBtn = modal.querySelector('.close-btn');
    if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };

    const backBtn = document.getElementById('back-to-preferences-pp-settings-btn');
    if (backBtn) {
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        newBackBtn.onclick = () => {
            modal.style.display = 'none';
            openInstitutionPreferences();
        };
    }

    // Save button
    const applyBtn = document.getElementById('apply-pp-settings-btn');
    if (applyBtn) {
        const newApplyBtn = applyBtn.cloneNode(true);
        applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
        newApplyBtn.onclick = async () => {
            newApplyBtn.disabled = true;
            newApplyBtn.textContent = 'Gemmer...';

            try {
                const types = [];
                if (uploadCb.checked) types.push('upload');
                if (cameraCb.checked) types.push('camera');
                if (libraryCb.checked) types.push('library');
                if (aiAvatarCb.checked) types.push('ai_avatar');

                // Get default profile picture mode
                const selectedDefault = modal.querySelector('input[name="pp-default-mode"]:checked')?.value || 'initials';
                const pendingDefaultUrl = modal.dataset.pendingDefaultUrl || data?.default_profile_picture_url || null;

                const updates = {
                    profile_pictures_enabled: enabledToggle.checked,
                    profile_picture_types: types,
                    profile_pictures_ai_enabled: aiAvatarCb.checked,
                    default_profile_picture_mode: selectedDefault,
                    default_profile_picture_url: selectedDefault === 'image' ? pendingDefaultUrl : null,
                };

                const { error: saveError } = await supabaseClient
                    .from('institutions')
                    .update(updates)
                    .eq('id', institutionId);

                if (saveError) throw saveError;

                updateInstitutionCache(institutionId, updates);

                newApplyBtn.textContent = '✓ Gemt!';
                newApplyBtn.style.background = '#2e7d32';
                setTimeout(() => {
                    newApplyBtn.textContent = 'Gem indstillinger';
                    newApplyBtn.style.background = '#4CAF50';
                    newApplyBtn.disabled = false;
                }, 1500);
            } catch (err) {
                console.error('[profile-picture-settings] Gem fejl:', err);
                newApplyBtn.textContent = 'Fejl';
                newApplyBtn.style.background = '#f44336';
                setTimeout(() => {
                    newApplyBtn.textContent = 'Gem indstillinger';
                    newApplyBtn.style.background = '#4CAF50';
                    newApplyBtn.disabled = false;
                }, 2000);
            }
        };
    }

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
        showCustomAlert('Fejl', 'Fejl ved indlæsning af indstillinger: ' + error.message);
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
            showCustomAlert('Fejl', 'Fejl ved gemning af indstillinger: ' + error.message);
        } else {
            console.log('[spending-limit] Gemt succesfuldt!');
            showCustomAlert('Succes', 'Indstillinger gemt!');
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

    const prefIcon = (name) => `Icons/webp/Function/${name}`;
    const prefRow = (icon, title, desc) => {
        const iconHtml = icon.endsWith('.webp')
            ? `<img src="${prefIcon(icon)}" alt="">`
            : `<span class="settings-item-icon-emoji">${icon}</span>`;
        return `<span class="settings-item-icon">${iconHtml}</span><span class="settings-item-text"><strong>${title}</strong><div class="settings-item-desc">${desc}</div></span>`;
    };

    // Sukkerpolitik knap (separat) – Produktoversigt er flyttet til Indstillinger
    const sugarPolicyBtn = document.createElement('button');
    sugarPolicyBtn.className = 'settings-item-btn';
    sugarPolicyBtn.innerHTML = prefRow('🍬', 'Sukkerpolitik', 'Konfigurer begrænsninger for usunde produkter.');
    sugarPolicyBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
        openSugarPolicySettingsModal();
    });

    // Beløbsgrænse knap
    const spendingLimitBtn = document.createElement('button');
    spendingLimitBtn.className = 'settings-item-btn';
    spendingLimitBtn.innerHTML = prefRow('Coin.webp', 'Beløbsgrænse', 'Konfigurer daglig forbrugsgrænse og saldogrænse.');
    spendingLimitBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
        openSpendingLimitModal();
    });

    // Forældreportalen knap
    const parentPortalBtn = document.createElement('button');
    parentPortalBtn.className = 'settings-item-btn';
    parentPortalBtn.innerHTML = prefRow('Bruger.webp', 'Forældreportalen', 'Konfigurer funktioner tilgængelige i forældreportalen.');
    parentPortalBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
        if (window.isV2Enabled && window.isV2Enabled()) {
            window.openAdminPortalV2();
        } else {
            openParentPortalSettingsModal();
        }
    });

    // MobilePay Import knap
    const mobilePayImportBtn = document.createElement('button');
    mobilePayImportBtn.className = 'settings-item-btn';
    mobilePayImportBtn.innerHTML = prefRow('Kasseapparat.webp', 'MobilePay CSV Import', 'Importér indbetalinger fra MobilePay CSV-eksport og sæt dem på børnenes saldo.');
    mobilePayImportBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
        openMobilePayImportModal();
    });

    // Betalingsmetoder knap
    const betalingsmetodeBtn = document.createElement('button');
    betalingsmetodeBtn.className = 'settings-item-btn';
    betalingsmetodeBtn.innerHTML = prefRow('Kasseapparat.webp', 'Betalingsmetoder', 'Stripe Connect, MobilePay og gebyrfordeling for forældreportalen.');
    betalingsmetodeBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
        openPaymentMethodsModal();
    });

    // Ikon-deling knap
    const iconSharingBtn = document.createElement('button');
    iconSharingBtn.className = 'settings-item-btn';
    iconSharingBtn.innerHTML = prefRow('🎨', 'Produktikoner – Deling', 'Del jeres ikoner med andre institutioner og brug andres delte ikoner.');
    iconSharingBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
        openIconSharingSettingsModal();
    });

    // Restaurant Mode knap
    const restaurantModeBtn = document.createElement('button');
    restaurantModeBtn.className = 'settings-item-btn';
    restaurantModeBtn.innerHTML = prefRow('🍽️', 'Restaurant Mode', 'Køkkenskærm, bordnumre og noter til salg.');
    restaurantModeBtn.addEventListener('click', () => {
        settingsModalPushParent(openInstitutionPreferences);
        openRestaurantModeSettingsModal();
    });

    // Profilbilleder knap
    const profilePictureBtn = document.createElement('button');
    profilePictureBtn.className = 'settings-item-btn';
    profilePictureBtn.innerHTML = prefRow('📷', 'Profilbilleder', 'Vis profilbilleder ved brugervalg i caféen.');
    profilePictureBtn.addEventListener('click', () => {
        settingsModalPushParent(openInstitutionPreferences);
        openProfilePictureSettingsModal();
    });

    // MFA / Totrinsgodkendelse knap
    const mfaSettingsBtn = document.createElement('button');
    mfaSettingsBtn.className = 'settings-item-btn';
    mfaSettingsBtn.innerHTML = prefRow('🔐', 'Totrinsgodkendelse (MFA)', 'Krav om ekstra sikkerhedskode ved login via authenticator-app.');
    mfaSettingsBtn.addEventListener('click', () => {
        settingsModalPushParent(openInstitutionPreferences);
        openMfaSettingsModal();
    });

    // Auto-sletning af inaktive brugere knap
    const autoDeleteBtn = document.createElement('button');
    autoDeleteBtn.className = 'settings-item-btn';
    autoDeleteBtn.innerHTML = prefRow('🗑️', 'Auto-sletning af inaktive', 'Slet automatisk brugere der ikke har været aktive i lang tid.');
    autoDeleteBtn.addEventListener('click', () => {
        settingsModalPushParent(openInstitutionPreferences);
        openAutoDeleteSettingsModal();
    });

    contentEl.appendChild(spendingLimitBtn);
    contentEl.appendChild(sugarPolicyBtn);
    contentEl.appendChild(restaurantModeBtn);

    // "Toolbar" item
    const toolbarBtn = document.createElement('button');
    toolbarBtn.className = 'settings-item-btn';
    toolbarBtn.innerHTML = prefRow('Gear.webp', 'Toolbar', 'Vælg hvilke funktioner der skal være tilgængelige som genveje over indkøbskurven.');
    toolbarBtn.addEventListener('click', () => {
        showToolbarSettingsView();
    });
    contentEl.appendChild(toolbarBtn);

    // "Administration" sub-menu item
    const adminSubBtn = document.createElement('button');
    adminSubBtn.className = 'settings-item-btn';
    adminSubBtn.innerHTML = prefRow('Gear.webp', 'Administration', 'Betaling, deling, sikkerhed, import m.m.');
    adminSubBtn.addEventListener('click', () => {
        showAdministrationView();
    });
    contentEl.appendChild(adminSubBtn);

    backdrop.style.display = 'flex';
    updateSettingsModalBackVisibility();
}

// DB column → toolbar button ID mapping
const TOOLBAR_MAPPING = [
    { dbCol: 'shift_timer_enabled', key: 'shift_timer', btnId: null, label: 'Bytte-Timer', desc: 'Vis bytte-timer genvej', icon: '⏱️' },
    { dbCol: 'toolbar_calculator', key: 'calculator', btnId: 'calculator-mode-toggle', label: 'Lommeregner', desc: 'Vis lommeregner genvej', icon: '🧮' },
    { dbCol: 'toolbar_kitchen', key: 'kitchen', btnId: 'kitchen-btn', label: 'Køkkenskærm', desc: 'Vis køkkenskærm genvej (kræver Restaurant Mode)', icon: '🍽️', requiresCol: 'restaurant_mode_enabled' },
    { dbCol: 'toolbar_products', key: 'products', btnId: 'toolbar-products-btn', label: 'Produktoversigt', desc: 'Vis produktoversigt genvej', icon: '🛒', adminOnly: true },
    { dbCol: 'toolbar_deposit', key: 'deposit', btnId: 'toolbar-deposit-btn', label: 'Indbetaling', desc: 'Vis indbetaling genvej', icon: '💰', adminOnly: true },
    { dbCol: 'toolbar_history', key: 'history', btnId: 'toolbar-history-btn', label: 'Historik', desc: 'Vis historik genvej', icon: '📋' },
    { dbCol: 'toolbar_help', key: 'help', btnId: 'flango-logo-button', label: 'Hjælp', desc: 'Vis hjælp genvej', icon: '❓' },
    { dbCol: 'toolbar_min_flango', key: 'min_flango', btnId: 'logged-in-user-avatar-container', label: 'Min Flango', desc: 'Vis avatar/profil genvej', icon: '👤' },
    { dbCol: 'toolbar_logout', key: 'logout', btnId: 'logout-btn', label: 'Log Ud', desc: 'Vis log ud genvej', icon: '🚪' },
    { dbCol: 'toolbar_user_panel', key: 'user_panel', btnId: 'toolbar-user-panel-btn', label: 'Brugerpanel', desc: 'Vis brugerpanel genvej', icon: '👥', adminOnly: true },
];

async function showToolbarSettingsView() {
    const backdrop = document.getElementById('settings-modal-backdrop');
    const titleEl = document.getElementById('settings-modal-title');
    const contentEl = document.getElementById('settings-modal-content');
    if (!backdrop || !titleEl || !contentEl) return;

    settingsModalPushParent(openInstitutionPreferences);
    titleEl.textContent = 'Toolbar';
    contentEl.innerHTML = '<p style="text-align:center;padding:20px;opacity:0.6;">Henter indstillinger...</p>';

    const institutionId = getInstitutionId();
    if (!institutionId) return;

    // Fetch current values from DB (include requirement columns)
    const extraCols = new Set();
    TOOLBAR_MAPPING.forEach(m => { if (m.requiresCol) extraCols.add(m.requiresCol); });
    const selectCols = [...TOOLBAR_MAPPING.map(m => m.dbCol), ...extraCols].join(', ');
    const { data, error } = await supabaseClient
        .from('institutions')
        .select(selectCols)
        .eq('id', institutionId)
        .single();

    if (error) {
        contentEl.innerHTML = '<p style="text-align:center;padding:20px;color:#ef4444;">Kunne ikke hente indstillinger.</p>';
        updateSettingsModalBackVisibility();
        return;
    }

    contentEl.innerHTML = '';

    const desc = document.createElement('p');
    desc.style.cssText = 'margin: 0 0 16px; font-size: 13px; color: var(--text-secondary, #888); padding: 0 4px;';
    desc.textContent = 'Vælg hvilke genvejsknapper der vises i toolbaren over indkøbskurven.';
    contentEl.appendChild(desc);

    TOOLBAR_MAPPING.forEach(item => {
        const requirementMet = !item.requiresCol || data[item.requiresCol] === true;
        const isOn = data[item.dbCol] !== false;
        const row = document.createElement('button');
        row.className = 'settings-item-btn';
        row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; cursor: pointer;' + (!requirementMet ? ' opacity: 0.45; pointer-events: none;' : '');
        row.innerHTML = `
            <span class="settings-item-icon"><span class="settings-item-icon-emoji">${item.icon}</span></span>
            <span class="settings-item-text" style="flex:1">
                <strong>${item.label}</strong>
                <div class="settings-item-desc">${item.desc}</div>
            </span>
            <span class="toolbar-toggle" style="font-size: 1.4rem; min-width: 36px; text-align: center;">${requirementMet ? (isOn ? '✅' : '⬜') : '⬜'}</span>
        `;
        if (requirementMet) {
            row.addEventListener('click', async (e) => {
                e.preventDefault();
                const current = data[item.dbCol] !== false;
                const newVal = !current;
                data[item.dbCol] = newVal;
                row.querySelector('.toolbar-toggle').textContent = newVal ? '✅' : '⬜';
                await supabaseClient
                    .from('institutions')
                    .update({ [item.dbCol]: newVal })
                    .eq('id', institutionId);
                applyToolbarSettings(data);
            });
        }
        contentEl.appendChild(row);
    });

    updateSettingsModalBackVisibility();
}

function applyToolbarSettings(data) {
    const isAdmin = isCurrentUserAdmin();
    TOOLBAR_MAPPING.forEach(item => {
        if (!item.btnId) return;
        const btn = document.getElementById(item.btnId);
        if (!btn) return;
        const requirementMet = !item.requiresCol || data[item.requiresCol] === true;
        const roleAllowed = !item.adminOnly || isAdmin;
        btn.style.display = (requirementMet && roleAllowed && data[item.dbCol] !== false) ? '' : 'none';
    });
}

// Apply toolbar settings on load (fetches from DB)
export async function initToolbarSettings() {
    const institutionId = getInstitutionId();
    if (!institutionId) return;
    try {
        const extraCols = new Set();
        TOOLBAR_MAPPING.forEach(m => { if (m.requiresCol) extraCols.add(m.requiresCol); });
        const selectCols = [...TOOLBAR_MAPPING.map(m => m.dbCol), ...extraCols].join(', ');
        const { data } = await supabaseClient
            .from('institutions')
            .select(selectCols)
            .eq('id', institutionId)
            .single();
        if (data) applyToolbarSettings(data);
    } catch (e) { /* ignore */ }
}

function showAdministrationView() {
    const backdrop = document.getElementById('settings-modal-backdrop');
    const titleEl = document.getElementById('settings-modal-title');
    const contentEl = document.getElementById('settings-modal-content');
    if (!backdrop || !titleEl || !contentEl) return;

    settingsModalPushParent(openInstitutionPreferences);
    titleEl.textContent = 'Administration';
    contentEl.innerHTML = '';

    const prefIcon = (name) => `Icons/webp/Function/${name}`;
    const prefRow = (icon, title, desc) => {
        const iconHtml = icon.endsWith('.webp')
            ? `<img src="${prefIcon(icon)}" alt="">`
            : `<span class="settings-item-icon-emoji">${icon}</span>`;
        return `<span class="settings-item-icon">${iconHtml}</span><span class="settings-item-text"><strong>${title}</strong><div class="settings-item-desc">${desc}</div></span>`;
    };

    const items = [
        { icon: 'Coin.webp', title: 'Indbetal penge & Rediger brugere', desc: 'Indbetal på børnenes saldo og administrer brugerlisten.', action: () => { openViaSettings('admin-user-manager-modal', () => window.__flangoOpenAdminUserManager?.('customers')); } },
        { icon: 'Bruger.webp', title: 'Forældreportal', desc: 'Forældreindsigt, forældre-liste, kode-administration og portal-preview.', action: () => { backdrop.style.display = 'none'; if (window.isV2Enabled?.()) { window.openAdminPortalV2(); } else { openParentPortalSettingsModal(); } } },
        { icon: 'Kasseapparat.webp', title: 'Betalingsmetoder', desc: 'Stripe Connect, MobilePay og gebyrfordeling for forældreportalen.', action: () => { backdrop.style.display = 'none'; openPaymentMethodsModal(); } },
        { icon: '📷', title: 'Profilbilleder', desc: 'Vis profilbilleder ved brugervalg i caféen.', action: () => { settingsModalPushParent(showAdministrationView); openProfilePictureSettingsModal(); }, keepOpen: true },
        { icon: '🎨', title: 'Produktikoner – Deling', desc: 'Del jeres ikoner med andre institutioner og brug andres delte ikoner.', action: () => { backdrop.style.display = 'none'; openIconSharingSettingsModal(); } },
        { icon: 'Kasseapparat.webp', title: 'MobilePay CSV Import', desc: 'Importér indbetalinger fra MobilePay CSV-eksport og sæt dem på børnenes saldo.', action: () => { backdrop.style.display = 'none'; openMobilePayImportModal(); } },
        { icon: 'Bruger.webp', title: 'Opret/Opdater brugere automatisk', desc: 'Masse-import af brugere fra liste.', action: () => { backdrop.style.display = 'none'; window.__flangoOpenAutoImportModal?.() || notifyToolbarUser('Auto-import er ikke klar.'); } },
    ];

    items.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'settings-item-btn';
        btn.innerHTML = prefRow(item.icon, item.title, item.desc);
        btn.addEventListener('click', () => {
            if (!item.keepOpen) backdrop.style.display = 'none';
            item.action();
        });
        contentEl.appendChild(btn);
    });

    // "Datasikkerhed" sub-menu item
    const datasikkerhedBtn = document.createElement('button');
    datasikkerhedBtn.className = 'settings-item-btn';
    datasikkerhedBtn.innerHTML = prefRow('🔐', 'Datasikkerhed', 'MFA, auto-sletning, enheder, saldoliste og nulstilling.');
    datasikkerhedBtn.addEventListener('click', () => {
        showDatasikkerhedView();
    });
    contentEl.appendChild(datasikkerhedBtn);

    updateSettingsModalBackVisibility();
}

function showDatasikkerhedView() {
    const backdrop = document.getElementById('settings-modal-backdrop');
    const titleEl = document.getElementById('settings-modal-title');
    const contentEl = document.getElementById('settings-modal-content');
    if (!backdrop || !titleEl || !contentEl) return;

    settingsModalPushParent(showAdministrationView);
    titleEl.textContent = 'Datasikkerhed';
    contentEl.innerHTML = '';

    const prefIcon = (name) => `Icons/webp/Function/${name}`;
    const prefRow = (icon, title, desc) => {
        const iconHtml = icon.endsWith('.webp')
            ? `<img src="${prefIcon(icon)}" alt="">`
            : `<span class="settings-item-icon-emoji">${icon}</span>`;
        return `<span class="settings-item-icon">${iconHtml}</span><span class="settings-item-text"><strong>${title}</strong><div class="settings-item-desc">${desc}</div></span>`;
    };

    // MFA
    const mfaBtn = document.createElement('button');
    mfaBtn.className = 'settings-item-btn';
    mfaBtn.innerHTML = prefRow('🔐', 'Totrinsgodkendelse (MFA)', 'Krav om ekstra sikkerhedskode ved login via authenticator-app.');
    mfaBtn.addEventListener('click', () => {
        settingsModalPushParent(showDatasikkerhedView);
        openMfaSettingsModal();
    });
    contentEl.appendChild(mfaBtn);

    // Auto-sletning
    const autoDeleteBtn = document.createElement('button');
    autoDeleteBtn.className = 'settings-item-btn';
    autoDeleteBtn.innerHTML = prefRow('🗑️', 'Auto-sletning af inaktive', 'Slet automatisk brugere der ikke har været aktive i lang tid.');
    autoDeleteBtn.addEventListener('click', () => {
        settingsModalPushParent(showDatasikkerhedView);
        openAutoDeleteSettingsModal();
    });
    contentEl.appendChild(autoDeleteBtn);

    // Mine enheder
    const devicesBtn = document.createElement('button');
    devicesBtn.className = 'settings-item-btn';
    devicesBtn.innerHTML = prefRow('Gear.webp', 'Mine enheder', 'Se og fjern enheder der husker din login.');
    devicesBtn.addEventListener('click', () => {
        settingsModalPushParent(showDatasikkerhedView);
        openMyDevicesView();
    });
    contentEl.appendChild(devicesBtn);

    // Saldoliste ved låsning (toggle)
    const instId = window.__flangoInstitutionId || '';
    const balanceDownloadKey = `flango_balance_download_on_lock_${instId}`;
    const balanceDownloadEnabled = localStorage.getItem(balanceDownloadKey) !== 'false';
    const toggleRow = document.createElement('button');
    toggleRow.className = 'settings-item-btn';
    toggleRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; cursor: pointer;';
    toggleRow.innerHTML = `
        <span class="settings-item-icon"><img src="${prefIcon('Print.webp')}" alt=""></span>
        <span class="settings-item-text" style="flex:1">
            <strong>Saldoliste ved låsning</strong>
            <div class="settings-item-desc">Download saldoliste automatisk når caféen låses.</div>
        </span>
        <span class="balance-download-toggle" style="font-size: 1.4rem; min-width: 36px; text-align: center;">${balanceDownloadEnabled ? '✅' : '⬜'}</span>
    `;
    toggleRow.addEventListener('click', (e) => {
        e.preventDefault();
        const current = localStorage.getItem(balanceDownloadKey) !== 'false';
        localStorage.setItem(balanceDownloadKey, !current);
        toggleRow.querySelector('.balance-download-toggle').textContent = !current ? '✅' : '⬜';
    });
    contentEl.appendChild(toggleRow);

    // Separator + Anmod om nulstilling
    const sep = document.createElement('div');
    sep.style.cssText = 'border-top: 1px solid rgba(255,255,255,0.08); margin: 8px 0;';
    contentEl.appendChild(sep);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'settings-item-btn';
    resetBtn.id = 'settings-reset-request-btn';
    resetBtn.innerHTML = `<span class="settings-item-text"><strong style="color: var(--negative, #ef4444)">Anmod om nulstilling af system</strong><div class="settings-item-desc" style="color: var(--negative, #ef4444); opacity: 0.7">Anmod om at al data i systemet nulstilles permanent.</div></span>`;
    resetBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
        openResetRequestDialog();
    });
    contentEl.appendChild(resetBtn);

    updateSettingsModalBackVisibility();
}

/**
 * Åbner Auto-sletning indstillinger modal
 */
async function openAutoDeleteSettingsModal() {
    const backdrop = document.getElementById('settings-modal-backdrop');
    const titleEl = document.getElementById('settings-modal-title');
    const contentEl = document.getElementById('settings-modal-content');
    if (!backdrop || !titleEl || !contentEl) return;

    const institutionId = getInstitutionId();
    if (!institutionId) return;

    titleEl.textContent = 'Auto-sletning af inaktive brugere';
    contentEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Indlæser...</div>';
    backdrop.style.display = 'flex';
    updateSettingsModalBackVisibility();

    const { data, error } = await supabaseClient
        .from('institutions')
        .select('auto_delete_inactive_enabled, auto_delete_inactive_months')
        .eq('id', institutionId)
        .single();

    if (error || !data) {
        contentEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #ef4444;">Kunne ikke hente indstillinger.</div>';
        return;
    }

    const enabled = data.auto_delete_inactive_enabled === true;
    const months = data.auto_delete_inactive_months || 6;

    const container = document.createElement('div');
    container.style.cssText = 'padding: 20px;';
    container.innerHTML = `
        <div style="margin-bottom: 20px;">
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin-bottom: 16px;">
                Når auto-sletning er aktiveret, slettes brugere der ikke har været aktive i den valgte periode automatisk.
                Forældre modtager en advarsel via e-mail 30 dage inden sletning.
            </p>
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 16px; background: linear-gradient(135deg, #fef3c7, #fde68a); border-radius: 12px; border: 2px solid #f59e0b;">
                <input type="checkbox" id="auto-delete-checkbox" ${enabled ? 'checked' : ''} style="width: 22px; height: 22px; cursor: pointer; accent-color: #d97706;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <strong style="color: #92400e; font-size: 16px;">Aktivér auto-sletning</strong>
                        <span id="auto-delete-status" style="padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; ${enabled ? 'background: linear-gradient(135deg, #dcfce7, #bbf7d0); color: #166534;' : 'background: linear-gradient(135deg, #fee2e2, #fecaca); color: #991b1b;'}">
                            ${enabled ? '✓ Aktiv' : '✗ Inaktiv'}
                        </span>
                    </div>
                    <div style="font-size: 13px; color: #6b7280;">Brugere der ikke har handlet eller logget ind slettes automatisk</div>
                </div>
            </label>
        </div>

        <div id="auto-delete-options" style="display: ${enabled ? 'block' : 'none'}; margin-bottom: 20px;">
            <label style="font-weight: 600; color: #374151; display: block; margin-bottom: 8px;">Inaktivitetsperiode</label>
            <div style="display: flex; gap: 10px;">
                <label style="flex: 1; display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 14px 16px; background: ${months === 6 ? 'linear-gradient(135deg, #dbeafe, #bfdbfe)' : '#f3f4f6'}; border-radius: 10px; border: 2px solid ${months === 6 ? '#3b82f6' : '#e5e7eb'}; transition: all 0.2s;">
                    <input type="radio" name="auto-delete-months" value="6" ${months === 6 ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #3b82f6;">
                    <div>
                        <strong style="color: ${months === 6 ? '#1d4ed8' : '#374151'};">6 måneder</strong>
                        <div style="font-size: 12px; color: #6b7280;">Anbefalet for aktive institutioner</div>
                    </div>
                </label>
                <label style="flex: 1; display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 14px 16px; background: ${months === 24 ? 'linear-gradient(135deg, #dbeafe, #bfdbfe)' : '#f3f4f6'}; border-radius: 10px; border: 2px solid ${months === 24 ? '#3b82f6' : '#e5e7eb'}; transition: all 0.2s;">
                    <input type="radio" name="auto-delete-months" value="24" ${months === 24 ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #3b82f6;">
                    <div>
                        <strong style="color: ${months === 24 ? '#1d4ed8' : '#374151'};">24 måneder</strong>
                        <div style="font-size: 12px; color: #6b7280;">Længere bevaringsperiode</div>
                    </div>
                </label>
            </div>
            <p style="font-size: 12px; color: #9ca3af; margin-top: 10px;">Forældre advares automatisk 30 dage inden sletning via e-mail.</p>
        </div>
    `;

    const checkbox = container.querySelector('#auto-delete-checkbox');
    const statusSpan = container.querySelector('#auto-delete-status');
    const optionsDiv = container.querySelector('#auto-delete-options');
    const radios = container.querySelectorAll('input[name="auto-delete-months"]');

    checkbox.addEventListener('change', () => {
        const on = checkbox.checked;
        optionsDiv.style.display = on ? 'block' : 'none';
        statusSpan.textContent = on ? '✓ Aktiv' : '✗ Inaktiv';
        statusSpan.style.cssText = `padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; ${on ? 'background: linear-gradient(135deg, #dcfce7, #bbf7d0); color: #166534;' : 'background: linear-gradient(135deg, #fee2e2, #fecaca); color: #991b1b;'}`;
    });

    // Radio styling update
    radios.forEach(r => r.addEventListener('change', () => {
        const val = parseInt(r.value);
        radios.forEach(r2 => {
            const label = r2.closest('label');
            const isChecked = r2.checked;
            label.style.background = isChecked ? 'linear-gradient(135deg, #dbeafe, #bfdbfe)' : '#f3f4f6';
            label.style.borderColor = isChecked ? '#3b82f6' : '#e5e7eb';
            const strong = label.querySelector('strong');
            if (strong) strong.style.color = isChecked ? '#1d4ed8' : '#374151';
        });
    }));

    // Gem-knap
    const saveBtn = document.createElement('button');
    saveBtn.className = 'settings-button settings-button-primary';
    saveBtn.textContent = 'Gem';
    saveBtn.style.cssText = 'width: 100%; padding: 14px; font-size: 16px; font-weight: 600; border-radius: 10px; cursor: pointer; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none;';
    saveBtn.addEventListener('click', async () => {
        const isEnabled = checkbox.checked;
        const selectedMonths = parseInt(container.querySelector('input[name="auto-delete-months"]:checked')?.value || '6');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Gemmer...';
        try {
            const { error: saveErr } = await supabaseClient
                .from('institutions')
                .update({
                    auto_delete_inactive_enabled: isEnabled,
                    auto_delete_inactive_months: isEnabled ? selectedMonths : null,
                })
                .eq('id', institutionId);
            if (saveErr) throw saveErr;
            saveBtn.textContent = '✓ Gemt!';
            saveBtn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
            setTimeout(() => {
                saveBtn.textContent = 'Gem';
                saveBtn.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
                saveBtn.disabled = false;
            }, 1500);
        } catch (e) {
            showAlert('Fejl ved gemning: ' + (e.message || e));
            saveBtn.textContent = 'Gem';
            saveBtn.disabled = false;
        }
    });

    container.appendChild(saveBtn);
    contentEl.innerHTML = '';
    contentEl.appendChild(container);
}

/**
 * Åbner Ikon-deling indstillinger modal
 */
async function openIconSharingSettingsModal() {
    const backdrop = document.getElementById('settings-modal-backdrop');
    const titleEl = document.getElementById('settings-modal-title');
    const contentEl = document.getElementById('settings-modal-content');
    if (!backdrop || !titleEl || !contentEl) return;

    const institutionId = getInstitutionId();
    if (!institutionId) return;

    titleEl.textContent = 'Produktikoner – Deling';
    contentEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Indlæser...</div>';
    backdrop.style.display = 'flex';
    updateSettingsModalBackVisibility();

    // Fetch current settings
    const { data: settings, error } = await supabaseClient
        .from('institutions')
        .select('icon_sharing_enabled, icon_use_shared_enabled, icon_limit')
        .eq('id', institutionId)
        .single();

    if (error || !settings) {
        contentEl.innerHTML = '<div style="color: red; padding: 20px;">Kunne ikke hente indstillinger.</div>';
        return;
    }

    contentEl.innerHTML = '';

    const group = document.createElement('div');
    group.style.cssText = 'display: flex; flex-direction: column; gap: 15px; padding: 10px 0;';

    // Description
    const desc = document.createElement('p');
    desc.style.cssText = 'color: #64748b; font-size: 13px; margin: 0;';
    desc.textContent = 'Vælg om jeres ikoner skal være tilgængelige for andre institutioner, og om I vil kunne se andres delte ikoner.';
    group.appendChild(desc);

    // Toggle 1: Share outward
    const shareRow = document.createElement('div');
    shareRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 12px; background: #f8f9fa; border-radius: 8px;';
    const shareLabel = document.createElement('div');
    shareLabel.innerHTML = '<strong>Del jeres ikoner</strong><div style="font-size: 12px; color: #64748b;">Andre institutioner kan bruge jeres ikoner</div>';
    const shareCheckbox = document.createElement('input');
    shareCheckbox.type = 'checkbox';
    shareCheckbox.checked = settings.icon_sharing_enabled;
    shareCheckbox.style.cssText = 'width: 22px; height: 22px; cursor: pointer; flex-shrink: 0;';
    shareRow.appendChild(shareLabel);
    shareRow.appendChild(shareCheckbox);
    group.appendChild(shareRow);

    // Toggle 2: Use shared
    const useRow = document.createElement('div');
    useRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 12px; background: #f8f9fa; border-radius: 8px;';
    const useLabel = document.createElement('div');
    useLabel.innerHTML = '<strong>Brug andres ikoner</strong><div style="font-size: 12px; color: #64748b;">Se og brug ikoner delt af andre institutioner</div>';
    const useCheckbox = document.createElement('input');
    useCheckbox.type = 'checkbox';
    useCheckbox.checked = settings.icon_use_shared_enabled;
    useCheckbox.style.cssText = 'width: 22px; height: 22px; cursor: pointer; flex-shrink: 0;';
    useRow.appendChild(useLabel);
    useRow.appendChild(useCheckbox);
    group.appendChild(useRow);

    contentEl.appendChild(group);

    // "Vis ikoner" button — opens the icon management modal
    const viewIconsBtn = document.createElement('button');
    viewIconsBtn.className = 'event-save-btn';
    viewIconsBtn.style.cssText = 'margin-top: 12px; width: 100%; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white; border: none;';
    viewIconsBtn.innerHTML = '🎨 Vis jeres ikoner';
    viewIconsBtn.addEventListener('click', () => {
        // Close this settings modal
        backdrop.style.display = 'none';
        // Open the icon management modal
        const iconMgmtModal = document.getElementById('icon-management-modal');
        if (iconMgmtModal) {
            iconMgmtModal.style.display = 'flex';
            // Trigger load of the icon management grid
            if (typeof window.__flangoLoadIconManagementGrid === 'function') {
                window.__flangoLoadIconManagementGrid();
            }
        }
    });
    contentEl.appendChild(viewIconsBtn);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'event-save-btn';
    saveBtn.textContent = 'Gem';
    saveBtn.style.cssText = 'margin-top: 16px; width: 100%;';
    contentEl.appendChild(saveBtn);

    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Gemmer...';

        const { error: updateError } = await supabaseClient
            .from('institutions')
            .update({
                icon_sharing_enabled: shareCheckbox.checked,
                icon_use_shared_enabled: useCheckbox.checked,
            })
            .eq('id', institutionId);

        if (updateError) {
            saveBtn.textContent = 'Fejl – prøv igen';
            saveBtn.disabled = false;
            return;
        }

        saveBtn.textContent = '✅ Gemt!';
        setTimeout(() => {
            backdrop.style.display = 'none';
        }, 800);
    });
}

/**
 * Åbner Café Event Visning indstillinger modal
 */
async function openCafeEventSettingsModal() {
    const backdrop = document.getElementById('settings-modal-backdrop');
    const titleEl = document.getElementById('settings-modal-title');
    const contentEl = document.getElementById('settings-modal-content');
    if (!backdrop || !titleEl || !contentEl) return;

    const institutionId = getInstitutionId();
    if (!institutionId) return;

    titleEl.textContent = 'Indstil hvordan kommende begivenheder vises i caféen';
    contentEl.innerHTML = '<p style="text-align: center; color: #999;">Henter indstillinger...</p>';
    backdrop.style.display = 'flex';

    const settings = await getCafeEventSettings(institutionId);

    contentEl.innerHTML = '';

    const desc = document.createElement('p');
    desc.style.cssText = 'font-size: 13px; color: #555; margin-bottom: 12px; line-height: 1.5;';
    desc.textContent = 'Når aktiveret vises kommende arrangementer som mini-kort over produktgrid i caféen. Kort vises kun for børn med matchende klassetrin.';
    contentEl.appendChild(desc);

    const group = document.createElement('div');
    group.className = 'cafe-event-settings-group';

    // Toggle: Aktiver/deaktiver
    const toggleRow = document.createElement('div');
    toggleRow.className = 'cafe-event-settings-row';
    const toggleLabel = document.createElement('label');
    toggleLabel.textContent = 'Vis arrangementer i café';
    toggleLabel.htmlFor = 'cafe-events-toggle';
    const toggleCheckbox = document.createElement('input');
    toggleCheckbox.type = 'checkbox';
    toggleCheckbox.id = 'cafe-events-toggle';
    toggleCheckbox.checked = settings.cafe_events_enabled;
    toggleCheckbox.style.cssText = 'width: 20px; height: 20px; cursor: pointer;';
    toggleRow.appendChild(toggleLabel);
    toggleRow.appendChild(toggleCheckbox);
    group.appendChild(toggleRow);

    // Status label
    const statusLabel = document.createElement('span');
    statusLabel.style.cssText = 'padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 700;';
    const updateStatus = (enabled) => {
        statusLabel.textContent = enabled ? '✓ Aktiv' : '✗ Inaktiv';
        statusLabel.style.background = enabled
            ? 'linear-gradient(135deg, #dcfce7, #bbf7d0)' : 'linear-gradient(135deg, #fee2e2, #fecaca)';
        statusLabel.style.color = enabled ? '#166534' : '#991b1b';
    };
    updateStatus(settings.cafe_events_enabled);
    toggleRow.insertBefore(statusLabel, toggleCheckbox);

    toggleCheckbox.addEventListener('change', () => updateStatus(toggleCheckbox.checked));

    // Dage frem
    const daysRow = document.createElement('div');
    daysRow.className = 'cafe-event-settings-row';
    const daysLabel = document.createElement('label');
    daysLabel.textContent = 'Vis events indenfor N dage';
    daysLabel.htmlFor = 'cafe-events-days';
    const daysInput = document.createElement('input');
    daysInput.type = 'number';
    daysInput.id = 'cafe-events-days';
    daysInput.min = '1';
    daysInput.max = '90';
    daysInput.value = settings.cafe_events_days_ahead;
    daysRow.appendChild(daysLabel);
    daysRow.appendChild(daysInput);
    group.appendChild(daysRow);

    // Toggle: Vis som produkter
    const displayRow = document.createElement('div');
    displayRow.className = 'cafe-event-settings-row';
    const displayLabel = document.createElement('label');
    displayLabel.textContent = 'Vis arrangementer på samme måde som produkter';
    displayLabel.htmlFor = 'cafe-events-display';
    const displayCheckbox = document.createElement('input');
    displayCheckbox.type = 'checkbox';
    displayCheckbox.id = 'cafe-events-display';
    displayCheckbox.checked = settings.cafe_events_as_products;
    displayCheckbox.style.cssText = 'width: 20px; height: 20px; cursor: pointer;';
    displayRow.appendChild(displayLabel);
    displayRow.appendChild(displayCheckbox);
    group.appendChild(displayRow);

    contentEl.appendChild(group);

    // Gem knap
    const saveBtn = document.createElement('button');
    saveBtn.className = 'event-save-btn';
    saveBtn.textContent = 'Gem';
    saveBtn.style.cssText = 'margin-top: 16px; width: 100%;';
    contentEl.appendChild(saveBtn);

    saveBtn.addEventListener('click', async () => {
        const enabled = toggleCheckbox.checked;
        const asProducts = displayCheckbox.checked;
        const days = Math.max(1, Math.min(90, parseInt(daysInput.value, 10) || 14));
        saveBtn.disabled = true;
        saveBtn.textContent = 'Gemmer...';

        const { error } = await saveCafeEventSettings(institutionId, {
            cafe_events_enabled: enabled,
            cafe_events_days_ahead: days,
            cafe_events_as_products: asProducts,
        });

        if (error) {
            console.error('[cafe-event-settings] Error saving:', error);
            showCustomAlert('Fejl', 'Kunne ikke gemme indstillingen. Prøv igen.');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Gem';
            return;
        }

        // Opdater global settings
        if (window.__flangoInstitutionSettings) {
            window.__flangoInstitutionSettings.cafeEventsEnabled = enabled;
            window.__flangoInstitutionSettings.cafeEventsDaysAhead = days;
            window.__flangoInstitutionSettings.cafeEventsAsProducts = asProducts;
        }

        settingsModalGoBack();
    });

    backdrop.style.display = 'flex';
    updateSettingsModalBackVisibility();
}
window.__flangoOpenCafeEventSettings = openCafeEventSettingsModal;

/**
 * Åbner Bytte-timer indstillinger modal
 */
async function openShiftTimerSettingsModal() {
    const backdrop = document.getElementById('settings-modal-backdrop');
    const titleEl = document.getElementById('settings-modal-title');
    const contentEl = document.getElementById('settings-modal-content');
    if (!backdrop || !titleEl || !contentEl) return;

    const institutionId = getInstitutionId();
    if (!institutionId) {
        console.error('[shift-timer-settings] No institution ID found');
        return;
    }

    titleEl.textContent = 'Bytte-timer Indstillinger';
    contentEl.innerHTML = '';

    // Hent nuværende værdi - kun eksplicit true viser flueben
    const currentEnabled = window.__flangoInstitutionSettings?.shiftTimerEnabled === true;

    // Opret container
    const container = document.createElement('div');
    container.style.cssText = 'padding: 20px;';
    container.innerHTML = `
        <div style="margin-bottom: 24px;">
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin-bottom: 16px;">
                Bytte-timeren giver ekspedienter mulighed for at sætte en timer eller salgstæller,
                der minder dem om at bytte vagt.
            </p>
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 16px; background: linear-gradient(135deg, #faf5ff, #f3e8ff); border-radius: 12px; border: 2px solid #d8b4fe;">
                <input type="checkbox" id="shift-timer-enabled-checkbox" ${currentEnabled ? 'checked' : ''} style="width: 22px; height: 22px; cursor: pointer; accent-color: #7c3aed;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <strong style="color: #6d28d9; font-size: 16px;">Aktivér bytte-timer</strong>
                        <span id="shift-timer-status-label" style="padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; ${currentEnabled ? 'background: linear-gradient(135deg, #dcfce7, #bbf7d0); color: #166534;' : 'background: linear-gradient(135deg, #fee2e2, #fecaca); color: #991b1b;'}">
                            ${currentEnabled ? '✓ Aktiv' : '✗ Inaktiv'}
                        </span>
                    </div>
                    <div style="font-size: 13px; color: #6b7280;">Vis bytte-timer i headeren for ekspedienter</div>
                </div>
            </label>
        </div>
        <div style="display: flex; gap: 12px;">
            <button id="shift-timer-save-btn" style="flex: 1; padding: 14px 20px; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer;">Gem</button>
        </div>
    `;
    contentEl.appendChild(container);

    // Event listeners
    const saveBtn = container.querySelector('#shift-timer-save-btn');
    const checkbox = container.querySelector('#shift-timer-enabled-checkbox');
    const statusLabel = container.querySelector('#shift-timer-status-label');

    // Opdater status label når checkbox ændres
    checkbox.addEventListener('change', () => {
        const enabled = checkbox.checked;
        if (statusLabel) {
            statusLabel.textContent = enabled ? '✓ Aktiv' : '✗ Inaktiv';
            statusLabel.style.cssText = enabled 
                ? 'padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; background: linear-gradient(135deg, #dcfce7, #bbf7d0); color: #166534;'
                : 'padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; background: linear-gradient(135deg, #fee2e2, #fecaca); color: #991b1b;';
        }
    });

    saveBtn.addEventListener('click', async () => {
        const enabled = checkbox.checked;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Gemmer...';

        try {
            const { data, error } = await supabaseClient
                .from('institutions')
                .update({ shift_timer_enabled: enabled })
                .eq('id', institutionId)
                .select('shift_timer_enabled')
                .single();

            if (error) {
                console.error('[shift-timer-settings] Error saving:', error);
                showCustomAlert('Fejl', 'Kunne ikke gemme indstillingen. Prøv igen.');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Gem';
                return;
            }

            // Opdater cache'en så næste login ikke behøver DB query
            updateInstitutionCache(institutionId, { shift_timer_enabled: enabled });

            // Opdater global setting
            if (window.__flangoInstitutionSettings) {
                window.__flangoInstitutionSettings.shiftTimerEnabled = enabled;
            }

            // Opdater shift-timer visibility
            const shiftTimerPill = document.getElementById('shift-timer-pill');
            if (shiftTimerPill) {
                shiftTimerPill.style.display = enabled ? 'inline-flex' : 'none';
            }

            // Gå tilbage til forrige visning (Diverse)
            settingsModalGoBack();
        } catch (err) {
            console.error('[shift-timer-settings] Unexpected error:', err);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Gem';
        }
    });

    backdrop.style.display = 'flex';
    updateSettingsModalBackVisibility();
}

/**
 * Åbner Restaurant Mode indstillinger modal
 */
window.__flangoOpenRestaurantModeSettings = () => openRestaurantModeSettingsModal();

// ── Settings panel hooks (used by settings-panel.js / settings-sections.js) ──
window.openSugarPolicyModal = () => openSugarPolicyModal();
window.openUserAdminPanel = () => openUserAdminPanel();
window.openParentPortalAsAdmin = () => openParentPortalAsAdmin();
window.openMobilePayImportModal = () => openMobilePayImportModal();
window.openResetRequestDialog = () => openResetRequestDialog();
window.__flangoSupabaseClient = supabaseClient;
window.__flangoDeviceTrust = { getMyDeviceTokens, revokeDeviceToken, revokeAllDeviceTokens, clearAllDeviceUsers };

async function openRestaurantModeSettingsModal() {
    const backdrop = document.getElementById('settings-modal-backdrop');
    const titleEl = document.getElementById('settings-modal-title');
    const contentEl = document.getElementById('settings-modal-content');
    if (!backdrop || !titleEl || !contentEl) return;

    const institutionId = getInstitutionId();
    if (!institutionId) return;

    titleEl.textContent = 'Restaurant Mode';
    contentEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Indlæser...</div>';
    backdrop.style.display = 'flex';
    updateSettingsModalBackVisibility();

    // Hent nuværende værdier
    const { data, error } = await supabaseClient
        .from('institutions')
        .select('restaurant_mode_enabled, restaurant_table_numbers_enabled, restaurant_table_count, restaurant_sound, restaurant_serve_sound')
        .eq('id', institutionId)
        .single();

    if (error || !data) {
        contentEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #ef4444;">Kunne ikke hente indstillinger.</div>';
        return;
    }

    const modeEnabled = data.restaurant_mode_enabled === true;
    const tableEnabled = data.restaurant_table_numbers_enabled === true;
    const tableCount = data.restaurant_table_count || 9;
    const currentSound = data.restaurant_sound || '';
    const currentServeSound = data.restaurant_serve_sound || '';

    // Lyd-valgmuligheder (genbruger café-appens eksisterende lyde)
    const soundOptions = [
        { value: '', label: 'Ingen lyd' },
        { value: 'sounds/Accept/accepter-1.mp3', label: 'Accepter 1' },
        { value: 'sounds/Accept/accepter-2.mp3', label: 'Accepter 2' },
        { value: 'sounds/Accept/accepter-3.mp3', label: 'Accepter 3' },
        { value: 'sounds/Accept/accepter-4.mp3', label: 'Accepter 4' },
        { value: 'sounds/Accept/accepter-5.mp3', label: 'Accepter 5' },
        { value: 'sounds/Accept/accepter-6.mp3', label: 'Accepter 6' },
        { value: 'sounds/Accept/accepter-7.mp3', label: 'Accepter 7' },
        { value: 'sounds/Login/Login1.mp3', label: 'Login 1' },
        { value: 'sounds/Login/Login2.mp3', label: 'Login 2' },
    ];
    const buildSoundOptionsHtml = (selected) => soundOptions.map(o =>
        `<option value="${o.value}"${o.value === selected ? ' selected' : ''}>${o.label}</option>`
    ).join('');
    const soundOptionsHtml = buildSoundOptionsHtml(currentSound);
    const serveSoundOptionsHtml = buildSoundOptionsHtml(currentServeSound);

    const deviceRmEnabled = localStorage.getItem('flango_device_restaurant_mode') === 'true';

    const container = document.createElement('div');
    container.style.cssText = 'padding: 20px;';
    container.innerHTML = `
        <div style="margin-bottom: 20px;">
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin-bottom: 16px;">
                Restaurant Mode tilføjer en køkkenskærm der viser nye ordrer i realtid.
                Efter hvert salg kan tjeneren tilføje bordnummer og besked til køkkenet.
            </p>
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 16px; background: linear-gradient(135deg, #fef3c7, #fde68a); border-radius: 12px; border: 2px solid #f59e0b;">
                <input type="checkbox" id="restaurant-mode-checkbox" ${modeEnabled ? 'checked' : ''} style="width: 22px; height: 22px; cursor: pointer; accent-color: #d97706;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <strong style="color: #92400e; font-size: 16px;">Aktivér Restaurant Mode</strong>
                        <span id="restaurant-mode-status" style="padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; ${modeEnabled ? 'background: linear-gradient(135deg, #dcfce7, #bbf7d0); color: #166534;' : 'background: linear-gradient(135deg, #fee2e2, #fecaca); color: #991b1b;'}">
                            ${modeEnabled ? '✓ Aktiv' : '✗ Inaktiv'}
                        </span>
                    </div>
                    <div style="font-size: 13px; color: #6b7280;">Gør restaurant mode tilgængelig for alle enheder på denne institution</div>
                </div>
            </label>
            <label id="restaurant-device-toggle" style="display: ${modeEnabled ? 'flex' : 'none'}; align-items: center; gap: 12px; cursor: pointer; padding: 14px 16px; background: linear-gradient(135deg, #eff6ff, #dbeafe); border-radius: 12px; border: 1.5px solid #93c5fd; margin-top: 10px;">
                <input type="checkbox" id="restaurant-device-checkbox" ${deviceRmEnabled ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: #3b82f6;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                        <strong style="color: #1e40af; font-size: 15px;">🍽️ Denne enhed er tjener</strong>
                        <span id="restaurant-device-status" style="padding: 3px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; ${deviceRmEnabled ? 'background: #dbeafe; color: #1d4ed8;' : 'background: #f1f5f9; color: #64748b;'}">
                            ${deviceRmEnabled ? '✓ Til' : '✗ Fra'}
                        </span>
                    </div>
                    <div style="font-size: 12px; color: #6b7280;">Bordvalg og køkkennote vises ved hvert køb på denne enhed</div>
                </div>
            </label>
        </div>
        <div id="restaurant-sub-settings" style="margin-bottom: 20px; ${modeEnabled ? '' : 'opacity: 0.5; pointer-events: none;'}">
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 14px 16px; background: #f9fafb; border-radius: 12px 12px ${tableEnabled ? '0 0' : '12px 12px'}; border: 1px solid #e5e7eb; margin-bottom: 0;" id="restaurant-table-label">
                <input type="checkbox" id="restaurant-table-checkbox" ${tableEnabled ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: #d97706;">
                <div style="flex: 1;">
                    <strong style="color: #374151; font-size: 15px;">Bordnumre</strong>
                    <div style="font-size: 13px; color: #6b7280;">Vis bordnummer-knapper i bekræftelsesmodalen</div>
                </div>
            </label>
            <div id="restaurant-table-count-wrap" style="padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; margin-bottom: 12px; ${tableEnabled ? '' : 'display: none;'}">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 13px; color: #6b7280; white-space: nowrap;">Antal borde:</span>
                    <input type="range" id="restaurant-table-count" min="1" max="16" value="${tableCount}" style="flex: 1; accent-color: #d97706;">
                    <span id="restaurant-table-count-display" style="font-size: 16px; font-weight: 700; color: #374151; min-width: 20px; text-align: center;">${tableCount}</span>
                </div>
            </div>
            <div style="padding: 14px 16px; background: #f9fafb; border-radius: 12px 12px 0 0; border: 1px solid #e5e7eb;">
                <div style="margin-bottom: 8px;">
                    <strong style="color: #374151; font-size: 15px;">Lyd ved ny ordre</strong>
                    <div style="font-size: 13px; color: #6b7280;">Afspilles i køkkenskærmen når der kommer en ny ordre</div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <select id="restaurant-sound-select" style="flex: 1; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; background: white;">
                        ${soundOptionsHtml}
                    </select>
                    <button id="restaurant-sound-preview" style="padding: 10px 14px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; cursor: pointer; font-size: 16px;" title="Afspil">🔊</button>
                </div>
            </div>
            <div style="padding: 14px 16px; background: #f9fafb; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
                <div style="margin-bottom: 8px;">
                    <strong style="color: #374151; font-size: 15px;">Lyd ved servering</strong>
                    <div style="font-size: 13px; color: #6b7280;">Afspilles når en ordre markeres som serveret</div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <select id="restaurant-serve-sound-select" style="flex: 1; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; background: white;">
                        ${serveSoundOptionsHtml}
                    </select>
                    <button id="restaurant-serve-sound-preview" style="padding: 10px 14px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; cursor: pointer; font-size: 16px;" title="Afspil">🔊</button>
                </div>
            </div>
        </div>
        <div style="display: flex; gap: 12px;">
            <button id="restaurant-save-btn" style="flex: 1; padding: 14px 20px; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer;">Gem</button>
        </div>
    `;
    contentEl.innerHTML = '';
    contentEl.appendChild(container);

    const modeCheckbox = container.querySelector('#restaurant-mode-checkbox');
    const statusLabel = container.querySelector('#restaurant-mode-status');
    const deviceToggle = container.querySelector('#restaurant-device-toggle');
    const deviceCheckbox = container.querySelector('#restaurant-device-checkbox');
    const deviceStatus = container.querySelector('#restaurant-device-status');
    const subSettings = container.querySelector('#restaurant-sub-settings');
    const tableCheckbox = container.querySelector('#restaurant-table-checkbox');
    const tableCountWrap = container.querySelector('#restaurant-table-count-wrap');
    const tableCountInput = container.querySelector('#restaurant-table-count');
    const tableCountDisplay = container.querySelector('#restaurant-table-count-display');
    const tableLabel = container.querySelector('#restaurant-table-label');
    const soundSelect = container.querySelector('#restaurant-sound-select');
    const previewBtn = container.querySelector('#restaurant-sound-preview');
    const serveSoundSelect = container.querySelector('#restaurant-serve-sound-select');
    const servePreviewBtn = container.querySelector('#restaurant-serve-sound-preview');
    const saveBtn = container.querySelector('#restaurant-save-btn');

    // Helper: opdater header badge + køkken-knap baseret på institution + toolbar settings
    const updateHeaderVisibility = (instOn, deviceOn) => {
        const showRm = instOn && deviceOn;
        const badge = document.getElementById('restaurant-mode-badge');
        const kitchenBtn = document.getElementById('kitchen-btn');
        if (badge) badge.style.display = showRm ? '' : 'none';
        // Kitchen button visibility is handled by applyToolbarSettings / initToolbarSettings
    };

    // Toggle sub-settings enabled/disabled
    modeCheckbox.addEventListener('change', () => {
        const on = modeCheckbox.checked;
        subSettings.style.opacity = on ? '1' : '0.5';
        subSettings.style.pointerEvents = on ? '' : 'none';
        statusLabel.textContent = on ? '✓ Aktiv' : '✗ Inaktiv';
        statusLabel.style.cssText = `padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; ${on ? 'background: linear-gradient(135deg, #dcfce7, #bbf7d0); color: #166534;' : 'background: linear-gradient(135deg, #fee2e2, #fecaca); color: #991b1b;'}`;
        // Vis/skjul per-enhed toggle
        if (deviceToggle) deviceToggle.style.display = on ? 'flex' : 'none';
    });

    // Per-enhed toggle — gemmer til localStorage med det samme
    deviceCheckbox.addEventListener('change', () => {
        const on = deviceCheckbox.checked;
        localStorage.setItem('flango_device_restaurant_mode', on ? 'true' : 'false');
        deviceStatus.textContent = on ? '✓ Til' : '✗ Fra';
        deviceStatus.style.cssText = `padding: 3px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; ${on ? 'background: #dbeafe; color: #1d4ed8;' : 'background: #f1f5f9; color: #64748b;'}`;
        updateHeaderVisibility(modeCheckbox.checked, on);
    });

    // Toggle table count slider
    tableCheckbox.addEventListener('change', () => {
        const on = tableCheckbox.checked;
        if (tableCountWrap) tableCountWrap.style.display = on ? '' : 'none';
        if (tableLabel) tableLabel.style.borderRadius = on ? '12px 12px 0 0' : '12px';
    });

    // Table count slider live update
    if (tableCountInput && tableCountDisplay) {
        tableCountInput.addEventListener('input', () => {
            tableCountDisplay.textContent = tableCountInput.value;
        });
    }

    // Preview sounds
    let previewAudio = null;
    const playPreview = (src) => {
        if (!src) return;
        if (previewAudio) { previewAudio.pause(); }
        previewAudio = new Audio(src);
        previewAudio.volume = 0.7;
        previewAudio.play().catch(() => {});
    };
    previewBtn.addEventListener('click', () => playPreview(soundSelect.value));
    servePreviewBtn.addEventListener('click', () => playPreview(serveSoundSelect.value));

    // Save
    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Gemmer...';

        const updates = {
            restaurant_mode_enabled: modeCheckbox.checked,
            restaurant_table_numbers_enabled: tableCheckbox.checked,
            restaurant_table_count: parseInt(tableCountInput?.value) || 9,
            restaurant_sound: soundSelect.value || null,
            restaurant_serve_sound: serveSoundSelect.value || null,
        };

        try {
            const { error: saveError } = await supabaseClient
                .from('institutions')
                .update(updates)
                .eq('id', institutionId);

            if (saveError) {
                showCustomAlert('Fejl', 'Kunne ikke gemme. Prøv igen.');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Gem';
                return;
            }

            // Opdater cache
            updateInstitutionCache(institutionId, updates);

            // Opdater header badge
            const badge = document.getElementById('restaurant-mode-badge');
            if (badge) badge.style.display = updates.restaurant_mode_enabled ? '' : 'none';

            // Re-apply toolbar settings with fresh DB data
            try {
                const toolbarCols = TOOLBAR_MAPPING.map(m => m.dbCol).join(', ');
                const extraCols = new Set();
                TOOLBAR_MAPPING.forEach(m => { if (m.requiresCol) extraCols.add(m.requiresCol); });
                const allCols = toolbarCols + (extraCols.size ? ', ' + [...extraCols].join(', ') : '');
                const { data: tbData } = await supabaseClient
                    .from('institutions')
                    .select(allCols)
                    .eq('id', institutionId)
                    .single();
                if (tbData) applyToolbarSettings(tbData);
            } catch (e) { console.warn('[restaurant-settings] toolbar refresh error:', e); }

            settingsModalGoBack();
        } catch (err) {
            console.error('[restaurant-settings] Error:', err);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Gem';
        }
    });

    backdrop.style.display = 'flex';
    updateSettingsModalBackVisibility();
}

/**
 * Åbner MFA / Totrinsgodkendelse indstillinger
 */
async function openMfaSettingsModal() {
    const backdrop = document.getElementById('settings-modal-backdrop');
    const titleEl = document.getElementById('settings-modal-title');
    const contentEl = document.getElementById('settings-modal-content');
    if (!backdrop || !titleEl || !contentEl) return;

    const institutionId = getInstitutionId();
    if (!institutionId) return;

    titleEl.textContent = 'Totrinsgodkendelse (MFA)';
    contentEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Indlaeser...</div>';
    backdrop.style.display = 'flex';
    updateSettingsModalBackVisibility();

    const { data, error } = await supabaseClient
        .from('institutions')
        .select('admin_mfa_policy, parent_mfa_new_device')
        .eq('id', institutionId)
        .single();

    if (error || !data) {
        contentEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #ef4444;">Kunne ikke hente indstillinger.</div>';
        return;
    }

    const currentPolicy = data.admin_mfa_policy || 'off';
    const parentMfa = data.parent_mfa_new_device === true;

    const container = document.createElement('div');
    container.style.cssText = 'padding: 20px;';
    container.innerHTML = `
        <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
            Totrinsgodkendelse (MFA) tilfojer et ekstra sikkerhedslag ved login.
            Brugeren skal indtaste en 6-cifret kode fra en authenticator-app
            (Google Authenticator, Microsoft Authenticator o.l.) ud over kodeord.
        </p>

        <div style="margin-bottom: 24px;">
            <label style="display: block; font-weight: 700; color: #1e3a5f; margin-bottom: 8px; font-size: 15px;">
                Admin-login MFA
            </label>
            <select id="mfa-admin-policy" style="width: 100%; padding: 12px 14px; border: 2px solid #d1d5db; border-radius: 10px; font-size: 15px; background: #fff; cursor: pointer;">
                <option value="off" ${currentPolicy === 'off' ? 'selected' : ''}>Fra (ingen MFA)</option>
                <option value="new_device" ${currentPolicy === 'new_device' ? 'selected' : ''}>Kun ved ny enhed</option>
                <option value="always" ${currentPolicy === 'always' ? 'selected' : ''}>Altid ved login</option>
            </select>
            <p style="font-size: 12px; color: #6b7280; margin-top: 6px;">
                "Kun ved ny enhed" kraever MFA forste gang man logger ind pa en ny browser/enhed.
                "Altid" kraever MFA ved hver ny session.
            </p>
        </div>

        <div style="margin-bottom: 24px;">
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 14px 16px; background: linear-gradient(135deg, #eff6ff, #dbeafe); border-radius: 12px; border: 1.5px solid #93c5fd;">
                <input type="checkbox" id="mfa-parent-new-device" ${parentMfa ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: #3b82f6;">
                <div style="flex: 1;">
                    <strong style="color: #1e40af; font-size: 15px;">Kraev MFA for foraeldre ved ny enhed</strong>
                    <div style="font-size: 13px; color: #6b7280; margin-top: 2px;">
                        Foraeldre skal bruge authenticator-app forste gang de logger ind pa en ny enhed i foraeldreportalen.
                    </div>
                </div>
            </label>
        </div>

        <button id="mfa-settings-save-btn" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer;">
            Gem
        </button>
    `;

    contentEl.innerHTML = '';
    contentEl.appendChild(container);

    const saveBtn = container.querySelector('#mfa-settings-save-btn');
    const policySelect = container.querySelector('#mfa-admin-policy');
    const parentCheckbox = container.querySelector('#mfa-parent-new-device');

    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Gemmer...';

        const updates = {
            admin_mfa_policy: policySelect.value,
            parent_mfa_new_device: parentCheckbox.checked,
        };

        try {
            const { error: saveError } = await supabaseClient
                .from('institutions')
                .update(updates)
                .eq('id', institutionId);

            if (saveError) {
                showCustomAlert('Fejl', 'Kunne ikke gemme MFA-indstillinger.');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Gem';
                return;
            }

            updateInstitutionCache(institutionId, updates);
            settingsModalGoBack();
        } catch (err) {
            console.error('[mfa-settings] Error:', err);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Gem';
        }
    });

    backdrop.style.display = 'flex';
    updateSettingsModalBackVisibility();
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

// Helper function to setup modal accessibility (focus trap, ESC, overlay click)
function setupModalAccessibility(modal) {
    if (!modal) return;

    // Close button
    const closeBtn = modal.querySelector('.close-btn');
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }

    // ESC key to close
    const escHandler = (e) => {
        if (e.key === 'Escape' && modal.style.display !== 'none') {
            modal.style.display = 'none';
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    // Overlay click to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Focus trap: focus first focusable element
    const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusableElements.length > 0) {
        focusableElements[0].focus();
    }
}

// Handle Stripe return from onboarding
function handleStripeReturn() {
    const hash = window.location.hash;
    if (hash === '#stripe-return' || hash === '#stripe-refresh') {
        // Clear hash to avoid reopening on refresh
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        
        // Wait a bit for app to be ready, then open Payment Methods modal
        setTimeout(() => {
            // Open Payment Methods modal directly
            openPaymentMethodsModal();
            
            // Auto-sync status after a short delay
            setTimeout(async () => {
                const institutionId = getInstitutionId();
                if (institutionId) {
                    await syncStripeStatus(institutionId);
                }
            }, 1500);
        }, 500);
    }
}

// Listen for hash changes and initial load
window.addEventListener('hashchange', handleStripeReturn);
if (window.location.hash === '#stripe-return' || window.location.hash === '#stripe-refresh') {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', handleStripeReturn);
    } else {
        // Wait a bit more for app initialization
        setTimeout(handleStripeReturn, 1000);
    }
}

async function openParentPortalSettingsModal() {
    const backdrop = document.getElementById('parent-portal-settings-modal');
    if (!backdrop) return;

    // Button handlers for 3-button menu
    const paymentMethodsBtn = document.getElementById('parent-portal-payment-methods-btn');
    const featuresBtn = document.getElementById('parent-portal-features-btn');
    const codesBtn = document.getElementById('parent-portal-codes-menu-btn');
    const backBtn = document.getElementById('back-to-preferences-parent-portal-btn');

    // Clone and replace to avoid duplicate handlers
    if (paymentMethodsBtn) {
        const newBtn = paymentMethodsBtn.cloneNode(true);
        paymentMethodsBtn.parentNode.replaceChild(newBtn, paymentMethodsBtn);
        newBtn.onclick = () => {
            backdrop.style.display = 'none';
            openPaymentMethodsModal();
        };
    }

    if (featuresBtn) {
        const newBtn = featuresBtn.cloneNode(true);
        featuresBtn.parentNode.replaceChild(newBtn, featuresBtn);
        newBtn.onclick = () => {
            backdrop.style.display = 'none';
            openParentPortalFeaturesModal();
        };
    }

    if (codesBtn) {
        const newBtn = codesBtn.cloneNode(true);
        codesBtn.parentNode.replaceChild(newBtn, codesBtn);
        newBtn.onclick = () => {
            backdrop.style.display = 'none';
            openParentPortalCodesModal();
        };
    }

    if (backBtn) {
        const newBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBtn, backBtn);
        newBtn.onclick = () => {
            backdrop.style.display = 'none';
            openInstitutionPreferences();
        };
    }

    // Close button
    const closeBtn = document.getElementById('parent-portal-settings-close');
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.onclick = () => {
            backdrop.style.display = 'none';
        };
    }

    // Close on backdrop click
    const backdropClickHandler = (e) => {
        if (e.target === backdrop) {
            backdrop.style.display = 'none';
            backdrop.removeEventListener('click', backdropClickHandler);
        }
    };
    backdrop.addEventListener('click', backdropClickHandler);

    backdrop.style.display = 'flex';
}

// Helper functions for Stripe status (global scope)
function getStripeStatusText(status) {
    const statusMap = {
        'not_configured': 'Ikke konfigureret',
        'onboarding': 'Opsætning i gang',
        'pending': 'Afventer',
        'enabled': 'Klar',
        'in_progress': 'Opsætning i gang', // Legacy support
        'ready': 'Klar' // Legacy support
    };
    return statusMap[status] || 'Ikke konfigureret';
}

function getStripeStatusClass(status) {
    const classMap = {
        'not_configured': 'badge-gray',
        'onboarding': 'badge-orange',
        'pending': 'badge-orange',
        'enabled': 'badge-green',
        'in_progress': 'badge-orange', // Legacy support
        'ready': 'badge-green' // Legacy support
    };
    return classMap[status] || 'badge-gray';
}

function getStripeOnboardingButtonText(status) {
    const textMap = {
        'not_configured': 'Start opsætning',
        'onboarding': 'Fortsæt opsætning',
        'pending': 'Fortsæt opsætning',
        'enabled': 'Opsætning fuldført',
        'in_progress': 'Fortsæt opsætning', // Legacy support
        'ready': 'Opsætning fuldført' // Legacy support
    };
    return textMap[status] || 'Start opsætning';
}

async function openPaymentMethodsModal() {
    const modal = document.getElementById('parent-portal-payment-methods-modal');
    if (!modal) return;

    const institutionId = getInstitutionId();
    if (!institutionId) {
        console.error('[payment-methods] No institution ID found');
        return;
    }

    setupModalAccessibility(modal);

    // Load current settings
    const { data, error } = await supabaseClient
        .from('institutions')
        .select('parent_portal_payment, topup_cash_enabled, topup_qr_enabled, topup_portal_enabled, topup_qr_image_url, stripe_enabled, stripe_mode, stripe_account_id, stripe_account_status, stripe_last_error, stripe_updated_at')
        .eq('id', institutionId)
        .single();

    if (error) {
        console.error('[payment-methods] Error loading settings:', error);
    }

    // Parse payment settings (new structured format or legacy format)
    let paymentSettings = {};
    if (data?.parent_portal_payment) {
        try {
            const raw = typeof data.parent_portal_payment === 'string'
                ? JSON.parse(data.parent_portal_payment)
                : data.parent_portal_payment;
            // Guard: if the DB value is a primitive (e.g. boolean true) instead of an object, ignore it
            paymentSettings = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
        } catch (e) {
            console.warn('[payment-methods] Failed to parse payment settings:', e);
        }
    }

    // Backward compatibility: map old keys to new structure
    if (!paymentSettings.stripe_connect && data?.topup_portal_enabled !== undefined) {
        paymentSettings.stripe_connect = { enabled: data.topup_portal_enabled === true };
    }
    if (!paymentSettings.mobilepay_qr && data?.topup_qr_enabled !== undefined) {
        paymentSettings.mobilepay_qr = { enabled: data.topup_qr_enabled === true };
    }
    if (!paymentSettings.cash && data?.topup_cash_enabled !== undefined) {
        paymentSettings.cash = { enabled: data.topup_cash_enabled === true };
    }

    // Global administrationsomkostning: kun én kan vælges; bestemmer prisberegning på forældreportalen
    const adminFeePayer = paymentSettings.admin_fee_payer ?? paymentSettings.stripe_connect?.fee_policy ?? paymentSettings.mobilepay_api?.fee_policy ?? 'institution';
    const instRadio = modal.querySelector('input[name="admin-fee-payer"][value="institution"]');
    const parentRadio = modal.querySelector('input[name="admin-fee-payer"][value="parent"]');
    if (instRadio) instRadio.checked = (adminFeePayer !== 'parent');
    if (parentRadio) parentRadio.checked = (adminFeePayer === 'parent');

    // Payment methods configuration
    const paymentMethods = [
        {
            id: 'stripe_connect',
            title: 'Stripe Connect',
            badges: [
                { text: 'Anbefalet', class: 'badge-green' },
                { text: 'Automatisk saldo-opdatering', class: 'badge-dark-green' }
            ],
            short: 'Med Stripe Connect kan I hurtigt komme i gang med automatisk indbetaling. Betalingen sendes direkte til institutionens bankkonto, og barnets Flango-saldo opdateres automatisk.',
            long: 'Forældre indbetaler via Flango forældreportalen eller via personlig QR-kode. Barnets saldo opdateres automatisk. Mindre administration – mere tid til nærvær.',
            more: `<strong>Administrationsomkostning</strong><br>
1,5 % + 1,80 kr pr. indbetaling <span class="fee-policy-tooltip" style="margin-left: 4px; display: inline-block;">
    <span class="fee-policy-tooltip-icon">?</span>
    <div class="fee-policy-tooltip-content">
        Eksempel på årlig administrationsomkostning:<br>
        10 indbetalinger pr. uge á 100 kr i 40 skoleuger<br>
        = ca. 1.320 kr pr. år i administrationsomkostninger<br>
        (afhænger af betalingsmetode og korttype)
    </div>
</span><br><br>
I vælger selv, hvem der betaler administrationsomkostningen:<br>
• Institutionen betaler administrationsomkostningen <span class="fee-policy-tooltip" style="margin-left: 4px; display: inline-block;">
    <span class="fee-policy-tooltip-icon">?</span>
    <div class="fee-policy-tooltip-content">
        Forældre sender: 100,00 kr<br>
        Barnets saldo: 100,00 kr<br>
        Institutionen modtager: 96,70 kr
    </div>
</span><br>
• Forældre betaler administrationsomkostningen (vises tydeligt ved betaling) <span class="fee-policy-tooltip" style="margin-left: 4px; display: inline-block;">
    <span class="fee-policy-tooltip-icon">?</span>
    <div class="fee-policy-tooltip-content">
        Forældre sender: ca. 103,35 kr<br>
        Barnets saldo: 100,00 kr<br>
        Institutionen modtager: 100,00 kr
    </div>
</span><br><br>
<strong>Oprettelse</strong><br>
Oprettelse af jeres Stripe Connect-konto sker via en enkel, selvbetjent onboarding herunder.<br>
I skal blot oplyse institutionens virksomhedsoplysninger (CVR/EAN) og udbetalingskonto som del af Stripe's lovpligtige identitetskontrol (KYC).<br><br>
<a href="${SUPABASE_URL}/storage/v1/object/public/docs/stripe-onboarding-guide.pdf" download="Flango – Stripe Onboarding Guide til Kommunale SFO'er.pdf" class="payment-method-config-btn" style="margin-top: 12px; text-decoration: none; display: inline-block; text-align: center; color: inherit;">
    📥 Download Flango Stripe Connect Onboarding Guide
</a><br><br>
<button class="payment-method-config-btn" id="config-stripe_connect-btn-more" style="margin-top: 12px;">Opret Stripe Connect Account</button>`,
            hasFeePolicy: true,
            configBtn: 'Opret Stripe Connect Account'
        },
        {
            id: 'mobilepay_api',
            title: 'MobilePay API',
            badges: [
                { text: 'Automatisk saldo-opdatering', class: 'badge-dark-green' },
                { text: 'Kræver opsætning', class: 'badge-blue' }
            ],
            short: 'Forældre indbetaler via MobilePay. Saldo opdateres automatisk.',
            long: 'Denne løsning forudsætter, at institutionen (eller kommunen) har en MobilePay API-aftale. Når en forælder indbetaler via MobilePay, registreres betalingen automatisk i Flango, og barnets saldo opdateres uden manuelt arbejde.',
            hasFeePolicy: true,
            configBtn: 'Konfigurer MobilePay API'
        },
        {
            id: 'mobilepay_csv',
            title: 'MobilePay CSV',
            badges: [{ text: 'Semi-automatisk', class: 'badge-orange' }],
            short: 'Sekretær/leder uploader en MobilePay-oversigt. Nye betalinger registreres automatisk i Flango.',
            long: 'Typisk logger skolens sekretær eller SFO-leder ind i MobilePay-portalen, downloader en oversigt over indbetalinger (CSV) og uploader den i Flango. Flango registrerer automatisk alle nye betalinger på de relevante børn. Det anbefales at gøre dette i et fast interval, som meldes ud til forældrene, fx: \'Indbetalinger opdateres hver dag inden kl. 13:00\' eller \'hver mandag inden kl. 13:00\'.',
            hasFeePolicy: false,
            configBtn: 'Åbn CSV-import'
        },
        {
            id: 'mobilepay_qr',
            title: 'MobilePay QR',
            badges: [{ text: 'Manuel', class: 'badge-orange' }],
            short: 'Forældre scanner en QR-kode. Personalet registrerer indbetalingen manuelt i Flango.',
            long: 'Denne metode forudsætter, at institutionen har en MobilePay-aftale, og at klubben er logget ind på den mobil, som modtager indbetalinger. Institutionens QR-kode vises i forældreportalen og evt. i Aula. Når forældre sender penge, skal personalet manuelt registrere indbetalingen på det enkelte barn i Flango (fx via \'Opdater saldo\' i brugerlisten).',
            hasFeePolicy: false,
            configBtn: null
        },
        {
            id: 'mobilepay_qr_screenshot',
            title: 'MobilePay QR + Screenshot',
            badges: [{ text: 'Nødløsning', class: 'badge-red' }],
            short: 'Forældre sender et skærmbillede som betalingsbevis. Personalet registrerer manuelt i Flango.',
            long: 'Denne metode er til institutioner, hvor MobilePay-aftalen administreres eksternt (fx hos skolens sekretær). Personalet kan derfor ikke se, når en forælder har indbetalt. Forældre skal sende et skærmbillede af betalingen som dokumentation til klubbens mobil, hvorefter personalet registrerer indbetalingen manuelt. Anbefales kun, hvis ingen andre løsninger er mulige.',
            hasFeePolicy: false,
            configBtn: null
        },
        {
            id: 'cash',
            title: 'Kontant',
            badges: [{ text: 'Offline', class: 'badge-gray' }],
            short: 'Personalet tager imod kontanter og registrerer indbetalingen manuelt i Flango.',
            long: 'Kontant indbetaling kræver ingen teknisk opsætning og medfører ingen transaktionsomkostninger. De fleste forældre foretrækker digitale indbetalinger, men kontant kan bruges som en alternativ eller nød-løsning for familier, der ikke ønsker digitale betalinger.',
            hasFeePolicy: false,
            configBtn: null
        }
    ];

    // Render payment methods
    const methodsList = document.getElementById('payment-methods-list');
    methodsList.innerHTML = '';

    paymentMethods.forEach(method => {
        const methodData = paymentSettings[method.id] || { enabled: false };
        // For Stripe Connect, check both parent_portal_payment and new stripe_enabled field
        let isEnabled = methodData.enabled === true;
        if (method.id === 'stripe_connect') {
            isEnabled = data?.stripe_enabled === true || methodData.enabled === true;
            // Use stripe_mode from database if available
            if (data?.stripe_mode && !methodData.mode) {
                methodData.mode = data.stripe_mode;
            }
            // Use stripe_account_status from database if available
            if (data?.stripe_account_status && !methodData.status) {
                methodData.status = data.stripe_account_status;
            }
        }

        const card = document.createElement('div');
        card.className = `payment-method-card ${isEnabled ? 'enabled' : ''}`;
        card.innerHTML = `
            <div class="payment-method-header">
                <div class="payment-method-toggle">
                    <input type="checkbox" id="payment-${method.id}-enabled" ${isEnabled ? 'checked' : ''}>
                </div>
                <div class="payment-method-info">
                    <div class="payment-method-title-row">
                        <span class="payment-method-title">${method.title}</span>
                        <div class="payment-method-badges">
                            ${method.badges.map(badge => `<span class="payment-method-badge ${badge.class}">${badge.text}</span>`).join('')}
                        </div>
                    </div>
                    <div class="payment-method-summary">${method.short}</div>
                    <div class="payment-method-details" id="details-${method.id}">${method.long}</div>
                    ${method.more ? `
                        <div class="payment-method-expand visible" data-method="${method.id}">VIS MERE</div>
                        <div class="payment-method-more" id="more-${method.id}">${method.more}</div>
                    ` : `
                        <div class="payment-method-expand" data-method="${method.id}" style="display: none;">Læs mere</div>
                        <div class="payment-method-more" id="more-${method.id}" style="display: none;"></div>
                    `}
                    ${method.id === 'stripe_connect' ? `
                        <div class="stripe-status-section" id="stripe-status-section">
                            <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px; margin-top: 12px;">
                                Stripe status:
                            </div>
                            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;">
                                <span class="payment-method-badge ${getStripeStatusClass(data?.stripe_account_status || methodData.status || 'not_configured')}" id="stripe-status-chip" data-status="${data?.stripe_account_status || methodData.status || 'not_configured'}">
                                    ${getStripeStatusText(data?.stripe_account_status || methodData.status || 'not_configured')}
                                </span>
                                ${(data?.stripe_mode || methodData.mode) ? `
                                    <span class="stripe-mode-label" id="stripe-mode-label" style="font-size: 13px; color: #666;">
                                        Mode: <strong>${(data?.stripe_mode || methodData.mode) === 'live' ? 'Live' : 'Test'}</strong>
                                    </span>
                                ` : ''}
                            </div>
                            ${data?.stripe_last_error ? `
                                <div style="font-size: 12px; color: #f44336; margin-bottom: 8px; padding: 8px; background: #ffebee; border-radius: 4px;">
                                    <strong>Fejl:</strong> ${data.stripe_last_error}
                                </div>
                            ` : ''}
                            ${data?.stripe_updated_at ? `
                                <div style="font-size: 11px; color: #999; margin-bottom: 8px;">
                                    Sidst opdateret: ${new Date(data.stripe_updated_at).toLocaleString('da-DK')}
                                </div>
                            ` : ''}
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <button class="payment-method-config-btn" id="stripe-onboarding-btn" 
                                    style="flex: 1; min-width: 150px; ${(data?.stripe_account_status || methodData.status) === 'enabled' ? 'opacity: 0.5; cursor: not-allowed;' : ''}"
                                    ${(data?.stripe_account_status || methodData.status) === 'enabled' ? 'disabled' : ''}>
                                    ${getStripeOnboardingButtonText(data?.stripe_account_status || methodData.status || 'not_configured')}
                                </button>
                                <button class="payment-method-config-btn" id="stripe-status-sync-btn" 
                                    style="flex: 1; min-width: 150px; background: #666;">
                                    Opdater status
                                </button>
                            </div>
                        </div>
                        <div class="stripe-onboarding-link-section" id="stripe-onboarding-link-section" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                            <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">
                                Stripe onboarding-link:
                            </div>
                            <div style="font-size: 12px; color: #666; margin-bottom: 12px;">
                                Linket kan udløbe – generér et nyt hvis nødvendigt.
                            </div>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
                                <button class="payment-method-config-btn" id="generate-onboarding-link-btn" 
                                    style="flex: 1; min-width: 150px;">
                                    Generér onboarding-link
                                </button>
                                <button class="payment-method-config-btn" id="copy-onboarding-link-btn" 
                                    style="flex: 1; min-width: 150px; background: #666; display: none;">
                                    Kopiér link
                                </button>
                            </div>
                            <input type="text" id="onboarding-link-input" 
                                readonly 
                                placeholder="Klik 'Generér onboarding-link' for at oprette et link"
                                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; background: #f9f9f9; display: none;">
                        </div>
                    ` : ''}
                    ${method.configBtn && method.id !== 'stripe_connect' ? `
                        <button class="payment-method-config-btn" id="config-${method.id}-btn" style="display: ${isEnabled ? 'block' : 'none'};">
                            ${method.configBtn}
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        methodsList.appendChild(card);

        // Toggle handler
        const toggle = card.querySelector(`#payment-${method.id}-enabled`);
        toggle.addEventListener('change', async () => {
            const enabled = toggle.checked;
            card.classList.toggle('enabled', enabled);
            const configBtn = card.querySelector(`#config-${method.id}-btn`);
            if (configBtn) {
                configBtn.style.display = enabled ? 'block' : 'none';
            }
            
            // For Stripe Connect, also update stripe_enabled field immediately
            if (method.id === 'stripe_connect') {
                try {
                    await supabaseClient
                        .from('institutions')
                        .update({ stripe_enabled: enabled })
                        .eq('id', institutionId);
                } catch (err) {
                    console.error('[payment-methods] Error updating stripe_enabled:', err);
                }
            }
            
            // Enable/disable fee policy radio buttons (only for non-stripe methods)
            if (method.hasFeePolicy && method.id !== 'stripe_connect') {
                const feeRadios = card.querySelectorAll(`input[name="fee-${method.id}"]`);
                feeRadios.forEach(radio => {
                    radio.disabled = !enabled;
                });
            }
            updatePaymentWarnings();
        });

        // Expand/collapse handler for "more" tekst
        const expandLink = card.querySelector('.payment-method-expand');
        const moreDetails = card.querySelector(`#more-${method.id}`);
        if (expandLink && moreDetails && method.more) {
            expandLink.addEventListener('click', () => {
                const isExpanded = moreDetails.classList.contains('expanded');
                moreDetails.classList.toggle('expanded', !isExpanded);
                expandLink.textContent = isExpanded ? 'VIS MERE' : 'VIS MINDRE';
                
                // Attach event handler to button in "more" section if it's Stripe Connect
                if (method.id === 'stripe_connect' && !isExpanded) {
                    const configBtnMore = moreDetails.querySelector(`#config-${method.id}-btn-more`);
                    if (configBtnMore && !configBtnMore.hasAttribute('data-handler-attached')) {
                        configBtnMore.setAttribute('data-handler-attached', 'true');
                        configBtnMore.addEventListener('click', async () => {
                            const currentStatus = data?.stripe_account_status || methodData.status || 'not_configured';
                            const hasMode = data?.stripe_mode || methodData.mode;
                            
                            // If not configured or no mode, open mode selection modal first
                            if (currentStatus === 'not_configured' || !hasMode) {
                                openStripeOnboardingModal(methodData, institutionId, async () => {
                                    // After mode is selected, start onboarding
                                    await startStripeOnboarding(institutionId);
                                });
                            } else {
                                // Already configured, start/continue onboarding
                                await startStripeOnboarding(institutionId);
                            }
                        });
                    }
                }
            });
        }

        // Config button handler
        if (method.configBtn) {
            // Handle button in main card (for non-Stripe methods)
            const configBtn = card.querySelector(`#config-${method.id}-btn`);
            if (configBtn) {
                configBtn.addEventListener('click', () => {
                    if (method.id === 'mobilepay_api') {
                        // TODO: Implement MobilePay API configuration
                        showCustomAlert('Info', 'MobilePay API konfiguration kommer snart.');
                    } else if (method.id === 'mobilepay_csv') {
                        // Open existing CSV import modal
                        if (typeof openMobilePayImportModal === 'function') {
                            modal.style.display = 'none';
                            openMobilePayImportModal();
                        } else {
                            showCustomAlert('Fejl', 'CSV-import funktion findes ikke.');
                        }
                    }
                });
            }
            
            // Handle button in "more" section (for Stripe Connect) - handler attached when "more" section is expanded
        }

        // Handle Stripe onboarding button (in status section)
        if (method.id === 'stripe_connect') {
            const onboardingBtn = card.querySelector('#stripe-onboarding-btn');
            if (onboardingBtn) {
                onboardingBtn.addEventListener('click', async () => {
                    const currentStatus = data?.stripe_account_status || methodData.status || 'not_configured';
                    
                    // If not configured, open mode selection modal first
                    if (currentStatus === 'not_configured') {
                        openStripeOnboardingModal(methodData, institutionId, async () => {
                            // After mode is selected, start onboarding
                            await startStripeOnboarding(institutionId);
                        });
                    } else {
                        // Already configured, start/continue onboarding
                        await startStripeOnboarding(institutionId);
                    }
                });
            }

            // Handle status sync button
            const statusSyncBtn = card.querySelector('#stripe-status-sync-btn');
            if (statusSyncBtn) {
                statusSyncBtn.addEventListener('click', async () => {
                    await syncStripeStatus(institutionId);
                });
            }

            // Handle generate onboarding link button
            const generateLinkBtn = card.querySelector('#generate-onboarding-link-btn');
            if (generateLinkBtn) {
                generateLinkBtn.addEventListener('click', async () => {
                    await generateStripeOnboardingLink(institutionId);
                });
            }

            // Handle copy link button
            const copyLinkBtn = card.querySelector('#copy-onboarding-link-btn');
            const linkInput = card.querySelector('#onboarding-link-input');
            if (copyLinkBtn && linkInput) {
                copyLinkBtn.addEventListener('click', async () => {
                    await copyToClipboard(linkInput.value);
                    showToast('Link kopieret', 'success');
                });
            }
        }
    });

    // Update warnings
    updatePaymentWarnings();

    // Save button
    const saveBtn = document.getElementById('save-payment-methods-btn');
    if (saveBtn) {
        // Remove existing listeners by cloning
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        
        newSaveBtn.addEventListener('click', async () => {
            try {
                newSaveBtn.disabled = true;
                const originalText = newSaveBtn.textContent;
                newSaveBtn.textContent = 'Gemmer...';
                
                // Load existing settings first to preserve Stripe Connect mode, status, account_id
                const { data: existingData } = await supabaseClient
                    .from('institutions')
                    .select('parent_portal_payment')
                    .eq('id', institutionId)
                    .single();

                let existingPaymentSettings = {};
                if (existingData?.parent_portal_payment) {
                    try {
                        existingPaymentSettings = typeof existingData.parent_portal_payment === 'string' 
                            ? JSON.parse(existingData.parent_portal_payment) 
                            : existingData.parent_portal_payment;
                    } catch (e) {
                        console.warn('[payment-methods] Failed to parse existing settings:', e);
                    }
                }

                const newPaymentSettings = {};
                let stripeEnabled = false;
                let stripeMode = null;

                // Global administrationsomkostning: én valg for hele institutionen, styrer prisberegning på forældreportalen
                const adminFeeEl = document.querySelector('#parent-portal-payment-methods-modal input[name="admin-fee-payer"]:checked');
                const adminFeePayer = adminFeeEl?.value === 'parent' ? 'parent' : 'institution';
                newPaymentSettings.admin_fee_payer = adminFeePayer;
                
                paymentMethods.forEach(method => {
                    const toggle = document.getElementById(`payment-${method.id}-enabled`);
                    if (toggle) {
                        const enabled = toggle.checked;
                        newPaymentSettings[method.id] = { enabled };
                        
                        // For Stripe Connect, also save to new database fields
                        if (method.id === 'stripe_connect') {
                            stripeEnabled = enabled;
                            // Get mode from existing data or default to test
                            stripeMode = data?.stripe_mode || existingPaymentSettings.stripe_connect?.mode || 'test';
                            
                            // Preserve mode, status, and account_id in JSON for backward compatibility
                            const existingStripe = existingPaymentSettings.stripe_connect || {};
                            if (existingStripe.mode) {
                                newPaymentSettings[method.id].mode = existingStripe.mode;
                            }
                            if (existingStripe.status) {
                                newPaymentSettings[method.id].status = existingStripe.status;
                            }
                            if (existingStripe.account_id) {
                                newPaymentSettings[method.id].account_id = existingStripe.account_id;
                            }
                        }
                        
                        // Fee policy er nu global (admin_fee_payer); gem også per-metode for bagudkompatibilitet med forældreportalen
                        if (method.hasFeePolicy) {
                            newPaymentSettings[method.id].fee_policy = adminFeePayer;
                        }
                    }
                });

                console.log('[payment-methods] Saving settings:', newPaymentSettings);
                console.log('[payment-methods] Stripe enabled:', stripeEnabled, 'mode:', stripeMode);
                console.log('[payment-methods] Institution ID:', institutionId);

                if (!institutionId) {
                    throw new Error('Institution ID mangler');
                }

                // Try to save to new parent_portal_payment column and Stripe fields
                let updateData = { parent_portal_payment: newPaymentSettings };
                
                // Also save Stripe fields if Stripe Connect is being configured
                if (stripeMode !== null) {
                    updateData.stripe_enabled = stripeEnabled;
                    updateData.stripe_mode = stripeMode;
                }
                let { data, error } = await supabaseClient
                    .from('institutions')
                    .update(updateData)
                    .eq('id', institutionId)
                    .select();

                // If error (column doesn't exist), fall back to old columns
                if (error && error.message && error.message.includes('parent_portal_payment')) {
                    console.warn('[payment-methods] parent_portal_payment column not found, using legacy columns');
                    
                    // Map to old column structure for backward compatibility
                    const legacyUpdate = {
                        topup_cash_enabled: newPaymentSettings.cash?.enabled === true,
                        topup_qr_enabled: newPaymentSettings.mobilepay_qr?.enabled === true,
                        topup_portal_enabled: newPaymentSettings.stripe_connect?.enabled === true
                    };
                    
                    const { data: legacyData, error: legacyError } = await supabaseClient
                        .from('institutions')
                        .update(legacyUpdate)
                        .eq('id', institutionId)
                        .select();
                    
                    if (legacyError) {
                        console.error('[payment-methods] Error saving to legacy columns:', legacyError);
                        showCustomAlert('Fejl', 'Fejl ved gemning af indstillinger. Kolonnen parent_portal_payment findes ikke. Kør migration: supabase migration up');
                        newSaveBtn.disabled = false;
                        newSaveBtn.textContent = originalText;
                        return;
                    }
                    
                    data = legacyData;
                    error = null;
                    console.log('[payment-methods] Settings saved to legacy columns:', legacyData);
                }

                if (error) {
                    console.error('[payment-methods] Error saving:', error);
                    showCustomAlert('Fejl', 'Fejl ved gemning af indstillinger: ' + (error.message || 'Ukendt fejl'));
                    newSaveBtn.disabled = false;
                    newSaveBtn.textContent = originalText;
                } else {
                    console.log('[payment-methods] Settings saved successfully:', data);
                    modal.style.display = 'none';
                    // Optionally show success feedback
                    if (typeof showCustomAlert === 'function') {
                        showCustomAlert('Indstillinger gemt', 'Betalingsmetoder er nu opdateret.');
                    }
                }
            } catch (err) {
                console.error('[payment-methods] Unexpected error:', err);
                showCustomAlert('Fejl', 'Uventet fejl ved gemning: ' + (err.message || 'Ukendt fejl'));
                newSaveBtn.disabled = false;
                newSaveBtn.textContent = 'GEM';
            }
        });
    } else {
        console.error('[payment-methods] Save button not found!');
    }

    // Back button
    const backBtn = document.getElementById('back-to-parent-portal-menu-btn');
    if (backBtn) {
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        newBackBtn.onclick = () => {
            modal.style.display = 'none';
            openParentPortalSettingsModal();
        };
    }

    modal.style.display = 'flex';
}

function updatePaymentWarnings() {
    const warningsContainer = document.getElementById('payment-methods-warnings');
    if (!warningsContainer) return;

    warningsContainer.innerHTML = '';

    const stripeEnabled = document.getElementById('payment-stripe_connect-enabled')?.checked;
    const mobilepayApiEnabled = document.getElementById('payment-mobilepay_api-enabled')?.checked;
    const csvEnabled = document.getElementById('payment-mobilepay_csv-enabled')?.checked;
    const qrEnabled = document.getElementById('payment-mobilepay_qr-enabled')?.checked;
    const qrScreenshotEnabled = document.getElementById('payment-mobilepay_qr_screenshot-enabled')?.checked;

    if (stripeEnabled && mobilepayApiEnabled) {
        const warning = document.createElement('div');
        warning.className = 'payment-warning';
        warning.textContent = 'Vælg én automatisk metode som primær for at undgå forvirring for forældre.';
        warningsContainer.appendChild(warning);
    }

    if (csvEnabled && (qrEnabled || qrScreenshotEnabled)) {
        const warning = document.createElement('div');
        warning.className = 'payment-warning';
        warning.textContent = 'Risiko for dobbeltregistrering. Brug CSV som primær og behold QR kun som nødløsning.';
        warningsContainer.appendChild(warning);
    }

    if (qrScreenshotEnabled) {
        const warning = document.createElement('div');
        warning.className = 'payment-warning';
        warning.textContent = 'Nødløsning: kan give ekstra administration.';
        warningsContainer.appendChild(warning);
    }
}

async function openParentPortalFeaturesModal() {
    const modal = document.getElementById('parent-portal-features-modal');
    if (!modal) return;

    const institutionId = getInstitutionId();
    if (!institutionId) {
        console.error('[parent-portal-features] No institution ID found');
        return;
    }

    setupModalAccessibility(modal);

    // Load current settings
    const { data, error } = await supabaseClient
        .from('institutions')
        .select('parent_portal_email_notifications, parent_portal_spending_limit, parent_portal_allergens, parent_portal_product_limit, parent_portal_sugar_policy, parent_portal_vegetarian_only, parent_portal_no_pork, institution_contact_phone, institution_contact_phone_enabled, sugar_policy_info_text, sugar_policy_info_enabled, parent_portal_daily_special, parent_portal_daily_special_price')
        .eq('id', institutionId)
        .single();

    if (error) {
        console.error('[parent-portal-features] Error loading settings:', error);
    }

    // Set checkbox values
    const emailNotifications = document.getElementById('parent-portal-email-notifications');
    const spendingLimit = document.getElementById('parent-portal-spending-limit');
    const allergens = document.getElementById('parent-portal-allergens');
    const productLimit = document.getElementById('parent-portal-product-limit');
    const sugarPolicy = document.getElementById('parent-portal-sugar-policy');
    const contactPhoneInput = document.getElementById('institution-contact-phone-input');
    const contactPhoneEnabled = document.getElementById('institution-contact-phone-enabled');
    const vegetarianOnly = document.getElementById('parent-portal-vegetarian-only');
    const noPork = document.getElementById('parent-portal-no-pork');
    const sugarPolicyInfoText = document.getElementById('sugar-policy-info-text');
    const sugarPolicyInfoEnabled = document.getElementById('sugar-policy-info-enabled');
    const sugarPolicyInfoSettings = document.getElementById('sugar-policy-info-settings');
    const dailySpecial = document.getElementById('parent-portal-daily-special');
    const dailySpecialPrice = document.getElementById('parent-portal-daily-special-price');
    const dailySpecialSettings = document.getElementById('daily-special-portal-settings');

    if (data) {
        if (emailNotifications) emailNotifications.checked = data.parent_portal_email_notifications !== false;
        if (spendingLimit) spendingLimit.checked = data.parent_portal_spending_limit !== false;
        if (allergens) allergens.checked = data.parent_portal_allergens !== false;
        if (productLimit) productLimit.checked = data.parent_portal_product_limit === true;
        if (sugarPolicy) sugarPolicy.checked = data.parent_portal_sugar_policy === true;
        if (contactPhoneInput) contactPhoneInput.value = data.institution_contact_phone || '';
        if (contactPhoneEnabled) contactPhoneEnabled.checked = data.institution_contact_phone_enabled === true;
        if (vegetarianOnly) vegetarianOnly.checked = data.parent_portal_vegetarian_only !== false;
        if (noPork) noPork.checked = data.parent_portal_no_pork !== false;
        if (sugarPolicyInfoText) sugarPolicyInfoText.value = data.sugar_policy_info_text || '';
        if (sugarPolicyInfoEnabled) sugarPolicyInfoEnabled.checked = data.sugar_policy_info_enabled !== false;
        if (dailySpecial) dailySpecial.checked = data.parent_portal_daily_special !== false;
        if (dailySpecialPrice) dailySpecialPrice.value = data.parent_portal_daily_special_price || '';
    }

    // Vis/skjul info-boks indstillinger baseret på sukkerpolitik-checkbox
    const toggleInfoSettings = () => {
        if (sugarPolicyInfoSettings) {
            sugarPolicyInfoSettings.style.display = sugarPolicy?.checked ? 'block' : 'none';
        }
    };
    toggleInfoSettings();
    if (sugarPolicy) sugarPolicy.addEventListener('change', toggleInfoSettings);

    // Vis/skjul dagens ret indstillinger baseret på produktgrænse-checkbox
    const toggleDailySpecialSettings = () => {
        if (dailySpecialSettings) {
            dailySpecialSettings.style.display = productLimit?.checked ? 'block' : 'none';
        }
    };
    toggleDailySpecialSettings();
    if (productLimit) productLimit.addEventListener('change', toggleDailySpecialSettings);

    // Save button – disabled when no changes, shows confirmation on save
    const saveBtn = document.getElementById('save-parent-portal-features-btn');
    if (saveBtn) {
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

        // Snapshot initial state for dirty-checking
        const initialState = () => ({
            emailNotifications: emailNotifications?.checked,
            spendingLimit: spendingLimit?.checked,
            allergens: allergens?.checked,
            productLimit: productLimit?.checked,
            sugarPolicy: sugarPolicy?.checked,
            contactPhone: contactPhoneInput?.value.trim() || '',
            contactPhoneEnabled: contactPhoneEnabled?.checked,
            vegetarianOnly: vegetarianOnly?.checked,
            noPork: noPork?.checked,
            sugarPolicyInfoText: sugarPolicyInfoText?.value.trim() || '',
            sugarPolicyInfoEnabled: sugarPolicyInfoEnabled?.checked,
            dailySpecial: dailySpecial?.checked,
            dailySpecialPrice: dailySpecialPrice?.value.trim() || ''
        });
        let savedState = initialState();

        const currentState = () => ({
            emailNotifications: emailNotifications?.checked,
            spendingLimit: spendingLimit?.checked,
            allergens: allergens?.checked,
            productLimit: productLimit?.checked,
            sugarPolicy: sugarPolicy?.checked,
            contactPhone: contactPhoneInput?.value.trim() || '',
            contactPhoneEnabled: contactPhoneEnabled?.checked,
            vegetarianOnly: vegetarianOnly?.checked,
            noPork: noPork?.checked,
            sugarPolicyInfoText: sugarPolicyInfoText?.value.trim() || '',
            sugarPolicyInfoEnabled: sugarPolicyInfoEnabled?.checked,
            dailySpecial: dailySpecial?.checked,
            dailySpecialPrice: dailySpecialPrice?.value.trim() || ''
        });

        const hasChanges = () => JSON.stringify(savedState) !== JSON.stringify(currentState());

        const updateSaveBtn = () => {
            const dirty = hasChanges();
            newSaveBtn.disabled = !dirty;
            newSaveBtn.style.opacity = dirty ? '1' : '0.45';
            newSaveBtn.style.cursor = dirty ? 'pointer' : 'default';
        };
        updateSaveBtn();

        // Listen for changes on all inputs
        const inputs = [emailNotifications, spendingLimit, allergens, productLimit, sugarPolicy, contactPhoneEnabled, vegetarianOnly, noPork, sugarPolicyInfoEnabled, dailySpecial];
        inputs.forEach(cb => { if (cb) cb.addEventListener('change', updateSaveBtn); });
        if (contactPhoneInput) contactPhoneInput.addEventListener('input', updateSaveBtn);
        if (sugarPolicyInfoText) sugarPolicyInfoText.addEventListener('input', updateSaveBtn);
        if (dailySpecialPrice) dailySpecialPrice.addEventListener('input', updateSaveBtn);

        newSaveBtn.addEventListener('click', async () => {
            if (!hasChanges()) return;

            newSaveBtn.disabled = true;
            newSaveBtn.textContent = 'Gemmer...';

            const updates = {
                parent_portal_email_notifications: emailNotifications?.checked !== false,
                parent_portal_spending_limit: spendingLimit?.checked !== false,
                parent_portal_allergens: allergens?.checked !== false,
                parent_portal_product_limit: productLimit?.checked === true,
                parent_portal_sugar_policy: sugarPolicy?.checked === true,
                institution_contact_phone: contactPhoneInput?.value.trim() || null,
                institution_contact_phone_enabled: contactPhoneEnabled?.checked === true,
                parent_portal_vegetarian_only: vegetarianOnly?.checked !== false,
                parent_portal_no_pork: noPork?.checked !== false,
                sugar_policy_info_text: sugarPolicyInfoText?.value.trim() || null,
                sugar_policy_info_enabled: sugarPolicyInfoEnabled?.checked !== false,
                parent_portal_daily_special: dailySpecial?.checked !== false,
                parent_portal_daily_special_price: dailySpecialPrice?.value.trim() || null
            };

            const { error } = await supabaseClient
                .from('institutions')
                .update(updates)
                .eq('id', institutionId);

            if (error) {
                console.error('[parent-portal-features] Error saving:', error);
                newSaveBtn.textContent = 'Fejl – prøv igen';
                newSaveBtn.disabled = false;
                newSaveBtn.style.opacity = '1';
                newSaveBtn.style.cursor = 'pointer';
                setTimeout(() => { newSaveBtn.textContent = 'Gem'; }, 2000);
            } else {
                savedState = currentState();
                updateSaveBtn();
                newSaveBtn.textContent = '✓ Gemt';
                setTimeout(() => { newSaveBtn.textContent = 'Gem'; }, 1500);
                if (typeof window.__flangoFetchAndRenderProducts === 'function') {
                    window.__flangoFetchAndRenderProducts();
                }
            }
        });
    }

    // Back button
    const backBtn = document.getElementById('back-to-parent-portal-menu-features-btn');
    if (backBtn) {
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        newBackBtn.onclick = () => {
            modal.style.display = 'none';
            openParentPortalSettingsModal();
        };
    }

    modal.style.display = 'flex';
}

// Start Stripe Connect onboarding
async function startStripeOnboarding(institutionId) {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session?.access_token) {
            throw new Error('Ikke logget ind');
        }

        const response = await fetch(`${SUPABASE_URL}/functions/v1/start-stripe-onboarding`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({})
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Kunne ikke starte onboarding');
        }

        if (result.onboarding_url) {
            // Open onboarding URL in new tab
            window.open(result.onboarding_url, '_blank');
            
            // Show success message
            showCustomAlert('Onboarding startet', 'Stripe onboarding er åbnet i nyt vindue. Efterfuldførelse, klik "Opdater status" for at opdatere status.');

            // Reload modal to show updated status
            setTimeout(() => {
                openPaymentMethodsModal();
            }, 1000);
        }
    } catch (err) {
        console.error('[stripe-onboarding] Error starting onboarding:', err);
        showCustomAlert('Fejl', 'Fejl ved start af onboarding: ' + (err.message || 'Ukendt fejl'));
    }
}

// Simple toast notification function
function showToast(message, type = 'success') {
    // Remove existing toast if any
    const existingToast = document.getElementById('flango-toast');
    if (existingToast) {
        existingToast.remove();
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.id = 'flango-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4caf50' : '#f44336'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    if (!document.getElementById('toast-animations')) {
        style.id = 'toast-animations';
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Copy to clipboard helper
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        } catch (e) {
            document.body.removeChild(textArea);
            return false;
        }
    }
}

// Generate Stripe onboarding link
async function generateStripeOnboardingLink(institutionId) {
    try {
        const generateBtn = document.getElementById('generate-onboarding-link-btn');
        const copyBtn = document.getElementById('copy-onboarding-link-btn');
        const linkInput = document.getElementById('onboarding-link-input');
        
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.textContent = 'Genererer...';
        }

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session?.access_token) {
            throw new Error('Ikke logget ind');
        }

        // Get current origin for return/refresh URLs
        const origin = window.location.origin;

        const response = await fetch(`${SUPABASE_URL}/functions/v1/create-stripe-onboarding-link`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
                institution_id: institutionId,
                origin: origin
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Kunne ikke generere onboarding link');
        }

        if (result.url) {
            // Show link input
            if (linkInput) {
                linkInput.value = result.url;
                linkInput.style.display = 'block';
            }
            if (copyBtn) {
                copyBtn.style.display = 'block';
            }

            // Auto copy to clipboard
            const copied = await copyToClipboard(result.url);
            if (copied) {
                showToast('Onboarding-link kopieret', 'success');
            } else {
                showToast('Link genereret (kopier manuelt)', 'success');
            }

            // Reload modal to show updated stripe_account_id if it was created
            if (result.stripe_account_id) {
                setTimeout(() => {
                    openPaymentMethodsModal();
                }, 1000);
            }
        }
    } catch (err) {
        console.error('[stripe-onboarding-link] Error:', err);
        showToast('Fejl: ' + (err.message || 'Ukendt fejl'), 'error');
    } finally {
        const generateBtn = document.getElementById('generate-onboarding-link-btn');
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generér onboarding-link';
        }
    }
}

// Sync Stripe status
async function syncStripeStatus(institutionId) {
    try {
        const syncBtn = document.getElementById('stripe-status-sync-btn');
        if (syncBtn) {
            syncBtn.disabled = true;
            syncBtn.textContent = 'Opdaterer...';
        }

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session?.access_token) {
            throw new Error('Ikke logget ind');
        }

        const response = await fetch(`${SUPABASE_URL}/functions/v1/stripe-status-sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({})
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Kunne ikke synkronisere status');
        }

        // Reload modal to show updated status
        openPaymentMethodsModal();

        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Status opdateret', `Stripe status er nu: ${getStripeStatusText(result.status)}`);
        }
    } catch (err) {
        console.error('[stripe-status-sync] Error:', err);
        showCustomAlert('Fejl', 'Fejl ved opdatering af status: ' + (err.message || 'Ukendt fejl'));
        
        const syncBtn = document.getElementById('stripe-status-sync-btn');
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.textContent = 'Opdater status';
        }
    }
}

async function openStripeOnboardingModal(currentStripeData, institutionId, onSaveCallback) {
    const modal = document.getElementById('stripe-onboarding-modal');
    if (!modal) {
        console.error('[stripe-onboarding] Modal not found');
        return;
    }

    setupModalAccessibility(modal);

    // Set current mode if exists
    const currentMode = currentStripeData?.mode || 'test';
    const modeRadios = modal.querySelectorAll('input[name="stripe-mode"]');
    modeRadios.forEach(radio => {
        radio.checked = radio.value === currentMode;
    });

    // Close button
    const closeBtn = modal.querySelector('#stripe-onboarding-close');
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }

    // Cancel button
    const cancelBtn = document.getElementById('stripe-onboarding-cancel');
    if (cancelBtn) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }

    // Save button
    const saveBtn = document.getElementById('stripe-onboarding-save');
    if (saveBtn) {
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        newSaveBtn.onclick = async () => {
            const selectedMode = modal.querySelector('input[name="stripe-mode"]:checked')?.value || 'test';
            
            try {
                newSaveBtn.disabled = true;
                newSaveBtn.textContent = 'Gemmer...';

                // Save stripe_enabled and stripe_mode to new database fields
                const { error: saveError } = await supabaseClient
                    .from('institutions')
                    .update({ 
                        stripe_enabled: true,
                        stripe_mode: selectedMode
                    })
                    .eq('id', institutionId);

                if (saveError) {
                    throw new Error('Kunne ikke gemme indstillinger: ' + saveError.message);
                }

                console.log('[stripe-onboarding] Settings saved successfully');
                modal.style.display = 'none';
                
                // Call callback to start onboarding
                if (onSaveCallback) {
                    await onSaveCallback();
                } else {
                    // Reload modal after save
                    openPaymentMethodsModal();
                }
            } catch (err) {
                console.error('[stripe-onboarding] Error:', err);
                showCustomAlert('Fejl', 'Fejl ved gemning: ' + (err.message || 'Ukendt fejl'));
                newSaveBtn.disabled = false;
                newSaveBtn.textContent = 'Start opsætning';
            }
        };
    }

    modal.style.display = 'flex';
}

function openParentPortalCodesModal() {
    const modal = document.getElementById('parent-portal-codes-modal');
    if (!modal) return;

    setupModalAccessibility(modal);

    // Admin button
    const adminBtn = document.getElementById('parent-portal-codes-admin-btn');
    if (adminBtn) {
        const newBtn = adminBtn.cloneNode(true);
        adminBtn.parentNode.replaceChild(newBtn, adminBtn);
        newBtn.onclick = () => {
            modal.style.display = 'none';
            if (typeof window.__flangoOpenParentPortalAdmin === 'function') {
                window.__flangoOpenParentPortalAdmin();
            }
        };
    }

    // Back button
    const backBtn = document.getElementById('back-to-parent-portal-menu-codes-btn');
    if (backBtn) {
        const newBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBtn, backBtn);
        newBtn.onclick = () => {
            modal.style.display = 'none';
            openParentPortalSettingsModal();
        };
    }

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
            showCustomAlert('Fejl', 'Fejl ved gemning af indstillinger');
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

    backdrop.style.display = 'flex';
    updateSettingsModalBackVisibility();
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

// ── My Devices View (settings sub-view) ──

async function openMyDevicesView() {
    const backdrop = document.getElementById('settings-modal-backdrop');
    const titleEl = document.getElementById('settings-modal-title');
    const contentEl = document.getElementById('settings-modal-content');
    if (!backdrop || !titleEl || !contentEl) return;

    backdrop.style.display = 'flex';
    titleEl.textContent = 'Mine enheder';
    contentEl.innerHTML = '<p style="text-align:center;padding:20px;opacity:0.6;">Henter enheder...</p>';

    const tokens = await getMyDeviceTokens();

    contentEl.innerHTML = '';

    if (!tokens.length) {
        contentEl.innerHTML = '<p style="text-align:center;padding:20px;opacity:0.6;">Ingen registrerede enheder.</p>';
        updateSettingsModalBackVisibility();
        return;
    }

    tokens.forEach(token => {
        const row = document.createElement('div');
        row.className = 'settings-item-btn';
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;cursor:default;';

        const lastUsed = token.last_used_at ? new Date(token.last_used_at).toLocaleDateString('da-DK') : 'Ukendt';
        const created = token.created_at ? new Date(token.created_at).toLocaleDateString('da-DK') : '';
        const expires = token.expires_at ? new Date(token.expires_at).toLocaleDateString('da-DK') : '';

        row.innerHTML = `
            <span class="settings-item-text" style="flex:1;">
                <strong>${token.device_name || 'Ukendt enhed'}</strong>
                <div style="font-size:12px;opacity:0.6;">
                    Sidst brugt: ${lastUsed} · Oprettet: ${created} · Udløber: ${expires}
                </div>
            </span>
        `;

        const revokeBtn = document.createElement('button');
        revokeBtn.textContent = 'Fjern';
        revokeBtn.style.cssText = 'padding:6px 14px;border-radius:8px;border:none;background:var(--negative,#ef4444);color:white;cursor:pointer;font-size:13px;flex-shrink:0;margin-left:10px;';
        revokeBtn.onclick = async () => {
            revokeBtn.disabled = true;
            revokeBtn.textContent = '...';
            const result = await revokeDeviceToken(token.id);
            if (result.success) {
                logAuditEvent('DEVICE_REVOKED', {
                    institutionId: getInstitutionId(),
                    details: { device_name: token.device_name, token_id: token.id },
                });
                row.remove();
                // Check if any tokens left
                if (!contentEl.querySelector('.settings-item-btn')) {
                    contentEl.innerHTML = '<p style="text-align:center;padding:20px;opacity:0.6;">Ingen registrerede enheder.</p>';
                }
            } else {
                revokeBtn.disabled = false;
                revokeBtn.textContent = 'Fjern';
            }
        };

        row.appendChild(revokeBtn);
        contentEl.appendChild(row);
    });

    // "Fjern alle" button
    if (tokens.length > 1) {
        const sep = document.createElement('div');
        sep.style.cssText = 'border-top:1px solid rgba(255,255,255,0.08);margin:8px 0;';
        contentEl.appendChild(sep);

        const revokeAllBtn = document.createElement('button');
        revokeAllBtn.className = 'settings-item-btn';
        revokeAllBtn.innerHTML = '<strong style="color:var(--negative,#ef4444)">Fjern alle enheder</strong>';
        revokeAllBtn.onclick = async () => {
            revokeAllBtn.disabled = true;
            revokeAllBtn.textContent = 'Fjerner...';
            const result = await revokeAllDeviceTokens();
            if (result.success) {
                clearAllDeviceUsers();
                contentEl.innerHTML = '<p style="text-align:center;padding:20px;opacity:0.6;">Alle enheder fjernet.</p>';
            } else {
                revokeAllBtn.disabled = false;
                revokeAllBtn.innerHTML = '<strong style="color:var(--negative,#ef4444)">Fjern alle enheder</strong>';
            }
        };
        contentEl.appendChild(revokeAllBtn);
    }

    updateSettingsModalBackVisibility();
}

export function openSettingsModal() {
    const clerkProfile = getCurrentClerk();
    const isAdmin = clerkProfile?.role === 'admin';
    const backdrop = document.getElementById('settings-modal-backdrop');
    const titleEl = document.getElementById('settings-modal-title');
    const contentEl = document.getElementById('settings-modal-content');

    if (!backdrop || !titleEl || !contentEl) return;

    if (backdrop.style.display !== 'flex') {
        settingsModalBackStack = [];
    }
    window.__flangoSettingsModalPushParent = settingsModalPushParent;

    titleEl.textContent = isAdmin ? 'Indstillinger (Admin)' : 'Indstillinger';
    contentEl.innerHTML = '';

    const ICON = (name) => `Icons/webp/Function/${name}`;

    function addItem(label, onClick, id = '', keepOpen = false, description = '', icon = '') {
        const btn = document.createElement('button');
        btn.className = 'settings-item-btn';
        if (id) btn.id = id;
        if (icon) {
            btn.innerHTML = `<span class="settings-item-icon"><img src="${ICON(icon)}" alt=""></span><span class="settings-item-text"><strong>${label}</strong>${description ? `<div class="settings-item-desc">${description}</div>` : ''}</span>`;
        } else if (description) {
            btn.innerHTML = `<strong>${label}</strong><div style="font-size: 12px; margin-top: 2px;">${description}</div>`;
        } else {
            btn.textContent = label;
        }
        btn.addEventListener('click', () => {
            backdrop.style.display = keepOpen ? 'flex' : 'none';
            onClick();
        });
        contentEl.appendChild(btn);
    }

    const openViaSettings = (modalRef, action) => {
        const modal = typeof modalRef === 'function'
            ? modalRef()
            : (typeof modalRef === 'string' ? document.getElementById(modalRef) : modalRef);
        if (modal) monitorModalForSettingsReturn(modal);
        action?.();
    };

    function createSettingsItemBtn(label, onClick, id, description, icon, closesBackdrop = true) {
        const btn = document.createElement('button');
        btn.className = 'settings-item-btn';
        if (id) btn.id = id;
        if (icon) {
            btn.innerHTML = `<span class="settings-item-icon"><img src="${ICON(icon)}" alt=""></span><span class="settings-item-text"><strong>${label}</strong>${description ? `<div class="settings-item-desc">${description}</div>` : ''}</span>`;
        } else if (description) {
            btn.innerHTML = `<strong>${label}</strong><div style="font-size: 12px; margin-top: 2px;">${description}</div>`;
        } else {
            btn.textContent = label;
        }
        btn.addEventListener('click', () => {
            if (closesBackdrop) backdrop.style.display = 'none';
            onClick();
        });
        return btn;
    }

    // ─── Diverse view ───
    function showDiverseView() {
        titleEl.textContent = 'Diverse';
        contentEl.innerHTML = '';

        contentEl.appendChild(createSettingsItemBtn('Dagens Sortiment', () => {
            if (window.__flangoOpenAssortmentModal) {
                openViaSettings('assortment-modal', () => window.__flangoOpenAssortmentModal());
            } else { notifyToolbarUser('Ikke klar.'); }
        }, '', 'Vælg hvilke produkter der vises i caféen.', 'Kurv.webp'));

        contentEl.appendChild(createSettingsItemBtn('Udseende', () => openViaSettings('theme-picker-backdrop', () => callButtonById('open-theme-picker')), '', 'Vælg tema og udseende.', 'image.webp'));

        contentEl.appendChild(createSettingsItemBtn('Ugeplan', () => {
            const instData = window.__flangoGetInstitutionById?.(getInstitutionId());
            const slug = instData?.slug || instData?.name?.toLowerCase().replace(/\s+/g, '-') || 'stampen';
            const ugeplanUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? `http://localhost:3005/${slug}`
                : `https://flango.dk/ugeplan/${slug}`;
            window.open(ugeplanUrl, '_blank');
        }, '', 'Åbn institutionens ugeplan.', 'Star.webp'));

        contentEl.appendChild(createSettingsItemBtn('Flere Indstillinger', () => {
            showFlereIndstillingerView();
        }, '', 'Historik, lyd, enheder, bytte-timer m.m.', 'Gear.webp', false));

        contentEl.appendChild(createSettingsItemBtn('Log ud', () => {
            callButtonById('logout-btn') || notifyToolbarUser('Log ud er ikke tilgængelig.');
        }, '', 'Afslut din session.', 'Logout.webp'));

        updateSettingsModalBackVisibility();
    }

    // ─── Flere Indstillinger view ───
    function showFlereIndstillingerView() {
        settingsModalPushParent(showDiverseView);
        titleEl.textContent = 'Flere Indstillinger';
        contentEl.innerHTML = '';

        contentEl.appendChild(createSettingsItemBtn('Min Flango', () => {
            window.__flangoOpenAvatarPicker?.() || notifyToolbarUser('Ikke klar.');
        }, 'settings-min-flango-status-btn', 'Skift avatar og visningsnavn.', 'Bruger.webp'));

        contentEl.appendChild(createSettingsItemBtn('Hjælp', () => openHelpManually(), 'settings-help-btn', 'Vejledning og tastaturgenveje.', 'tastaturgenveje.webp'));

        contentEl.appendChild(createSettingsItemBtn('Opdateringer', () => {
            settingsModalPushParent(showFlereIndstillingerView);
            openUpdatesModal();
        }, '', 'Tjek for opdateringer og genindlæs appen.', 'Print.webp', false));

        contentEl.appendChild(createSettingsItemBtn('🐛 Der er en fejl', () => {
            window.FLANGO_DEBUG?.showBugReportPrompt?.() || notifyToolbarUser('Ikke klar.');
        }, 'settings-bug-report-btn', 'Rapporter en fejl eller uhensigtsmæssighed.', 'Flueben.webp'));

        contentEl.appendChild(createSettingsItemBtn('Historik', () => {
            window.__flangoOpenSalesHistory?.() || notifyToolbarUser('Ikke klar.');
        }, 'settings-history-btn', 'Se salgshistorik og fortryd køb.', 'historik.webp'));

        contentEl.appendChild(createSettingsItemBtn('Lydindstillinger', () => {
            if (window.__flangoOpenSoundSettingsModal) {
                openViaSettings('sound-settings-modal', () => window.__flangoOpenSoundSettingsModal());
            } else { notifyToolbarUser('Ikke klar.'); }
        }, '', 'Indstil lyde for køb, fejl og andre handlinger.', 'Mute.webp'));

        updateSettingsModalBackVisibility();
    }

    // ─── Main menu items ───
    if (isAdmin) {
        addItem('Produktoversigt', () => openSugarPolicyModal(), '', false, 'Tilføj/Rediger Produkter & Dagens Sortiment', 'Kurv.webp');
        addItem('Brugerpanel', () => { backdrop.style.display = 'none'; openUserAdminPanel(); }, '', false, 'Samlet overblik: brugere, indbetaling, profilbilleder og statistik.', 'Bruger.webp');
        addItem('Tilmelding (Arrangementer)', () => {
            backdrop.style.display = 'none';
            window.__flangoOpenEventAdmin?.();
        }, '', false, 'Opret og administrer kommende begivenheder, tilmeldinger og betalinger.', 'Star.webp');
        addItem('Institutionens Præferencer', () => {
            settingsModalPushParent(openSettingsModal);
            openInstitutionPreferences();
        }, '', true, 'Konfigurer sukkerpolitik, beløbsgrænse, toolbar m.m.', 'Gear.webp');
    }

    addItem('Diverse', () => {
        backdrop.style.display = 'flex';
        settingsModalPushParent(openSettingsModal);
        showDiverseView();
    }, '', true, 'Dagens sortiment, historik, lyd, udseende og mere.', 'Gear2.webp');

    backdrop.style.display = 'flex';
    updateSettingsModalBackVisibility();
}

// ── Reset Request Dialog ──

async function openResetRequestDialog() {
    const institutionId = getInstitutionId();
    if (!institutionId) {
        notifyToolbarUser('Kunne ikke finde institutions-ID.');
        return;
    }

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'custom-alert-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);';

    const card = document.createElement('div');
    card.style.cssText = 'background:var(--surface-color, #1a1d27);border-radius:16px;padding:24px;max-width:420px;width:90%;color:var(--text-color, #e4e6eb);box-shadow:0 20px 60px rgba(0,0,0,0.5);';

    card.innerHTML = `
        <h2 style="margin-bottom:8px;font-size:18px;color:var(--negative, #ef4444);">Anmod om nulstilling</h2>
        <p style="font-size:13px;color:var(--text-secondary, #8b8fa3);margin-bottom:16px;line-height:1.5;">
            Ved nulstilling slettes <strong>al</strong> cafédata permanent: brugere, salg, produkter, arrangementer og statistik.
            Din admin-konto og institutionen bevares.<br><br>
            Anmodningen sendes til Flango-teamet, som behandler den manuelt.
        </p>
        <textarea id="reset-reason-input" placeholder="Beskriv kort hvorfor (valgfrit)" rows="3"
            style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border-color, #2d3040);
            background:var(--surface-sunken, #252830);color:var(--text-color, #e4e6eb);font-size:13px;
            font-family:inherit;resize:vertical;margin-bottom:16px;"></textarea>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button id="reset-cancel-btn" style="padding:10px 20px;border-radius:8px;border:none;
                background:var(--surface-sunken, #252830);color:var(--text-color, #e4e6eb);cursor:pointer;font-size:14px;">
                Annuller
            </button>
            <button id="reset-confirm-btn" style="padding:10px 20px;border-radius:8px;border:none;
                background:var(--negative, #ef4444);color:white;cursor:pointer;font-size:14px;font-weight:600;">
                Send anmodning
            </button>
        </div>
        <p id="reset-status-msg" style="font-size:12px;margin-top:12px;display:none;"></p>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    card.querySelector('#reset-cancel-btn').addEventListener('click', () => overlay.remove());

    card.querySelector('#reset-confirm-btn').addEventListener('click', async () => {
        const reason = card.querySelector('#reset-reason-input').value.trim();
        const confirmBtn = card.querySelector('#reset-confirm-btn');
        const statusMsg = card.querySelector('#reset-status-msg');

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Sender…';
        statusMsg.style.display = 'none';

        try {
            const session = await supabaseClient.auth.getSession();
            const token = session?.data?.session?.access_token;
            if (!token) throw new Error('Ikke logget ind');

            const response = await fetch(`${SUPABASE_URL}/functions/v1/request-institution-reset`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ institution_id: institutionId, reason }),
            });

            const result = await response.json();

            if (!response.ok) {
                statusMsg.style.color = 'var(--negative, #ef4444)';
                statusMsg.textContent = result.error || 'Der opstod en fejl.';
                statusMsg.style.display = 'block';
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Send anmodning';
                return;
            }

            statusMsg.style.color = 'var(--positive, #22c55e)';
            statusMsg.textContent = 'Anmodning sendt! Flango-teamet vil behandle den hurtigst muligt.';
            statusMsg.style.display = 'block';
            confirmBtn.style.display = 'none';

            setTimeout(() => overlay.remove(), 3000);
        } catch (err) {
            statusMsg.style.color = 'var(--negative, #ef4444)';
            statusMsg.textContent = 'Fejl: ' + err.message;
            statusMsg.style.display = 'block';
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Send anmodning';
        }
    });
}

export function setupSettingsModal() {
    const backdrop = document.getElementById('settings-modal-backdrop');
    const closeBtn = document.getElementById('settings-modal-close');
    const backBtn = document.getElementById('settings-modal-back-btn');

    if (!backdrop || !closeBtn) return;

    if (backBtn) {
        backBtn.addEventListener('click', () => settingsModalGoBack());
    }
    closeBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
    });

    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            backdrop.style.display = 'none';
        }
    });
}

export function setupToolbarShortcutButtons() {
    const productsBtn = document.getElementById('toolbar-products-btn');
    if (productsBtn) {
        productsBtn.onclick = (e) => {
            e.preventDefault();
            openSugarPolicyModal();
        };
    }
    const depositBtn = document.getElementById('toolbar-deposit-btn');
    if (depositBtn) {
        depositBtn.onclick = (e) => {
            e.preventDefault();
            window.__flangoOpenAdminUserManager?.('customers');
        };
    }
    const userPanelBtn = document.getElementById('toolbar-user-panel-btn');
    if (userPanelBtn) {
        userPanelBtn.onclick = (e) => {
            e.preventDefault();
            openUserAdminPanel();
        };
    }
}

export function setupToolbarGearMenu() {
    const gearBtn = document.getElementById('toolbar-gear-btn');
    if (!gearBtn) return;

    // Normal click → new settings panel (admin) or old modal (non-admin)
    // Long press 3s → old settings modal (fallback)
    let pressTimer = null;
    let didLongPress = false;

    gearBtn.addEventListener('pointerdown', (e) => {
        didLongPress = false;
        pressTimer = setTimeout(() => {
            didLongPress = true;
            openSettingsModal();
        }, 3000);
    });

    gearBtn.addEventListener('pointerup', (e) => {
        clearTimeout(pressTimer);
        if (didLongPress) return;
        e.preventDefault();
        const clerkProfile = getCurrentClerk();
        const isAdmin = clerkProfile?.role === 'admin';
        if (isAdmin && window.FlangoSettings) {
            window.FlangoSettings.open();
        } else {
            openSettingsModal();
        }
    });

    gearBtn.addEventListener('pointerleave', () => {
        clearTimeout(pressTimer);
    });
}

export function setupToolbarHistoryButton() {
    const historyBtn = document.getElementById('toolbar-history-btn');
    if (!historyBtn) return;
    historyBtn.onclick = async (event) => {
        event.preventDefault();
        try {
            const { openHistorikV3 } = await import('./historik-v3.js?v=3.0.67');
            openHistorikV3();
        } catch (err) {
            console.error('Kunne ikke åbne Historik v3:', err);
            // Fallback til v2
            try {
                const { openHistorikModal } = await import('./historik-modal.js?v=3.0.67');
                openHistorikModal();
            } catch (err2) {
                console.error('Kunne ikke åbne Historik v2:', err2);
                // Fallback til v1
                if (typeof window.__flangoOpenSalesHistory === 'function') {
                    window.__flangoOpenSalesHistory();
                } else {
                    notifyToolbarUser('Historik-funktionen er ikke klar.');
                }
            }
        }
    };
}

export function setupHelpButton() {
    const logoBtn = document.getElementById('flango-logo-button');
    if (!logoBtn) return;
    setupHelpModule(logoBtn);
}

export function showScreen(screenId) {
    const screens = [
        'screen-club-login', 'screen-locked',       // Legacy (kept for compat)
        'screen-full-login', 'screen-device-unlock', // New login states
        'screen-remember-device', 'screen-pin-locked',
        'screen-force-password',
        'screen-mfa-enroll', 'screen-mfa-challenge',
        'screen-admin-login', 'main-app',
    ];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const target = document.getElementById(screenId);
    if (target) {
        target.style.display = (screenId === 'main-app') ? 'grid' : 'flex';
    }
}
