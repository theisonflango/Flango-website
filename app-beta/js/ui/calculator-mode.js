// js/ui/calculator-mode.js
// Lommeregner-mode for Flango Café POS
// Håndterer toggle, numpad, display, quick-products, add-to-cart

import { supabaseClient } from '../core/config-and-supabase.js?v=3.0.81';
import { getCurrentCustomer } from '../domain/cafe-session-store.js?v=3.0.81';
import { getInstitutionId } from '../domain/session-store.js?v=3.0.81';
import { getOrder, setOrder } from '../domain/order-store.js?v=3.0.81';
import { playSound, showCustomAlert } from '../ui/sound-and-alerts.js?v=3.0.81';
import { STANDARD_ICONS } from '../core/product-icon-utils.js?v=3.0.81';
import { CUSTOM_ICON_PREFIX } from '../domain/products-and-cart.js?v=3.0.81';

// ─── Emoji/ikon-vælger ────────────────────────────────────────
const EMOJI_SUGGESTIONS = [
    '🍫', '🍽️', '🍷', '🍎', '🥜', '🥪', '🍕', '🥤', '🍚', '🍣',
    '🥢', '🍞', '🥝', '🍇', '🍐', '🍉', '🍙', '🍲', '🥘', '🫘',
    '🍔', '🌶️', '🧄', '🍳', '🔥', '😋', '🍰', '♨️', '🍪',
];

// ─── State ────────────────────────────────────────────────────
const calcState = {
    active: false,
    productsCollapsed: false,
    expression: '',
    selectedQuickProduct: null,
    customName: '',
    recentEntries: [],
    quickProducts: [],
    selectedCreateEmoji: '📦',       // Valgt emoji til nyt hurtig-produkt
    selectedCreateIconUrl: null,     // Eller standard-ikon URL (null = brug emoji)
};

// ─── Public API ───────────────────────────────────────────────

/** Check if calculator mode is active */
export function isCalculatorModeActive() {
    return calcState.active;
}

/** Toggle calculator mode on/off */
export function toggleCalculatorMode(forceState) {
    const newState = typeof forceState === 'boolean' ? forceState : !calcState.active;
    calcState.active = newState;

    const body = document.body;
    const toggleBtn = document.getElementById('calculator-mode-toggle');

    if (newState) {
        // Mutual exclusion: close kitchen panel if open
        if (body.classList.contains('kitchen-mode')) {
            if (typeof window.__flangoToggleKitchenPanel === 'function') {
                window.__flangoToggleKitchenPanel(false);
            }
        }

        body.classList.add('calculator-mode');
        if (toggleBtn) {
            toggleBtn.classList.add('active');
            toggleBtn.setAttribute('aria-pressed', 'true');
        }
        calcState.expression = '';
        updateCalcDisplay();
        loadQuickProducts();
        // Positionér edge-tab når grid-transition er færdig
        scheduleTabPositioning();
    } else {
        body.classList.remove('calculator-mode', 'products-collapsed');
        calcState.productsCollapsed = false;
        if (toggleBtn) {
            toggleBtn.classList.remove('active');
            toggleBtn.setAttribute('aria-pressed', 'false');
        }
        // Nulstil tab position og opacity
        const collapseBtn = document.getElementById('calculator-products-toggle');
        if (collapseBtn) {
            collapseBtn.style.left = '';
            collapseBtn.style.opacity = '';
        }
    }
}

/** Handle keyboard input routed from keyboard-shortcuts.js */
export function handleCalculatorKeyboard(e) {
    // Stop routing if focus is in an input/select field
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        if (e.key === 'Enter' && calcState.expression !== '') {
            e.preventDefault();
            addCalculatorItemToCart();
        }
        return;
    }

    const key = e.key;

    if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        calcState.expression += key;
        updateCalcDisplay();
    } else if (key === '+') {
        e.preventDefault();
        if (calcState.expression && !calcState.expression.endsWith('+')) {
            calcState.expression += '+';
            updateCalcDisplay();
        }
    } else if (key === '.' || key === ',') {
        e.preventDefault();
        const segments = calcState.expression.split('+');
        const lastSegment = segments[segments.length - 1];
        if (!lastSegment.includes('.')) {
            calcState.expression += '.';
            updateCalcDisplay();
        }
    } else if (key === 'Backspace') {
        // Tomt display → lad Backspace falde igennem til "slet fra kurv"
        if (calcState.expression === '') return;
        e.preventDefault();
        calcState.expression = calcState.expression.slice(0, -1);
        updateCalcDisplay();
    } else if (key === 'Enter') {
        // Tomt display → lad Enter falde igennem til "Gennemfør Køb"
        if (calcState.expression === '') return;
        e.preventDefault();
        addCalculatorItemToCart();
    } else if (key === 'Escape') {
        e.preventDefault();
        toggleCalculatorMode(false);
    } else if ((key === 'c' || key === 'C') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        calcState.expression = '';
        updateCalcDisplay();
    }
}

/** Initialize calculator mode — call once after DOM is ready */
export function initCalculatorMode() {
    // Toggle button
    const toggleBtn = document.getElementById('calculator-mode-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => toggleCalculatorMode());
    }

    // Numpad clicks
    const numpad = document.querySelector('.calc-numpad');
    if (numpad) {
        numpad.addEventListener('click', (e) => {
            const btn = e.target.closest('.calc-numpad-btn');
            if (!btn) return;
            const value = btn.dataset.value;
            handleNumpadClick(value);
        });
    }

    // Add to cart button
    const addBtn = document.getElementById('calc-add-to-cart');
    if (addBtn) {
        addBtn.addEventListener('click', () => addCalculatorItemToCart());
    }

    // Quick-select dropdown
    const quickSelect = document.getElementById('calc-quick-select');
    if (quickSelect) {
        quickSelect.addEventListener('change', (e) => {
            calcState.selectedQuickProduct = e.target.value || null;
            // Clear custom name when selecting quick product
            if (e.target.value) {
                const customNameInput = document.getElementById('calc-custom-name');
                if (customNameInput) customNameInput.value = '';
                calcState.customName = '';
            }
        });
    }

    // Custom name input
    const customNameInput = document.getElementById('calc-custom-name');
    if (customNameInput) {
        customNameInput.addEventListener('input', (e) => {
            calcState.customName = e.target.value;
            // Clear quick-select when typing custom name
            if (e.target.value) {
                const quickSelect = document.getElementById('calc-quick-select');
                if (quickSelect) quickSelect.value = '';
                calcState.selectedQuickProduct = null;
            }
        });
    }

    // Quick-add button (open inline create form)
    const quickAddBtn = document.getElementById('calc-quick-add');
    if (quickAddBtn) {
        quickAddBtn.addEventListener('click', () => {
            const createForm = document.getElementById('calc-quick-create');
            if (createForm) {
                const isHidden = createForm.style.display === 'none';
                createForm.style.display = isHidden ? 'flex' : 'none';
                if (isHidden) renderEmojiPicker();
            }
        });
    }

    // Save quick product
    const quickSaveBtn = document.getElementById('calc-quick-save');
    if (quickSaveBtn) {
        quickSaveBtn.addEventListener('click', () => saveNewQuickProduct());
    }

    // Cancel quick product creation
    const quickCancelBtn = document.getElementById('calc-quick-cancel');
    if (quickCancelBtn) {
        quickCancelBtn.addEventListener('click', () => {
            const createForm = document.getElementById('calc-quick-create');
            if (createForm) createForm.style.display = 'none';
            resetCreateForm();
        });
    }

    // Collapse products button
    const collapseBtn = document.getElementById('calculator-products-toggle');
    if (collapseBtn) {
        collapseBtn.addEventListener('click', () => toggleProductsCollapse());
    }

    // Repostion edge-tab ved resize
    window.addEventListener('resize', () => {
        if (calcState.active) positionCollapseTab();
    });
}

// ─── Internal: Display ────────────────────────────────────────

function updateCalcDisplay() {
    const exprEl = document.getElementById('calc-expression');
    const resultEl = document.getElementById('calc-result');
    const addBtn = document.getElementById('calc-add-to-cart');

    if (!exprEl) return;

    if (calcState.expression === '') {
        exprEl.textContent = '0';
        if (resultEl) resultEl.textContent = '';
        if (addBtn) addBtn.disabled = true;
        return;
    }

    // Show expression with Danish comma notation
    exprEl.textContent = formatDanishExpression(calcState.expression);
    if (addBtn) addBtn.disabled = false;

    // Calculate and show result if expression contains operator
    if (calcState.expression.includes('+')) {
        const result = evaluateExpression(calcState.expression);
        if (resultEl) resultEl.textContent = `= ${formatDanishNumber(result)}`;
    } else {
        if (resultEl) resultEl.textContent = '';
    }
}

function formatDanishExpression(expr) {
    return expr.replace(/\./g, ',').replace(/\+/g, ' + ');
}

function formatDanishNumber(num) {
    return num.toFixed(2).replace('.', ',');
}

function evaluateExpression(expr) {
    // Simple addition-only evaluator — NO eval()
    const parts = expr.split('+');
    return parts.reduce((sum, part) => sum + (parseFloat(part) || 0), 0);
}

// ─── Internal: Numpad ─────────────────────────────────────────

function handleNumpadClick(value) {
    if (value === 'C') {
        calcState.expression = '';
        updateCalcDisplay();
        return;
    }

    if (value === '+') {
        if (calcState.expression && !calcState.expression.endsWith('+')) {
            calcState.expression += '+';
            updateCalcDisplay();
        }
        return;
    }

    // Numeric 0-9
    calcState.expression += value;
    updateCalcDisplay();
}

// ─── Internal: Add to Cart ────────────────────────────────────

function addCalculatorItemToCart() {
    if (calcState.expression === '') return;

    const result = evaluateExpression(calcState.expression);
    if (result <= 0) return;

    // Determine product name and emoji (priority: custom > quick-select > "Produkt")
    const name = calcState.customName.trim()
        || getQuickProductName(calcState.selectedQuickProduct)
        || 'Produkt';

    // Hent emoji/ikon fra valgt hurtig-produkt, ellers fallback til 🧮
    const selectedQP = calcState.selectedQuickProduct
        ? calcState.quickProducts.find(p => String(p.id) === String(calcState.selectedQuickProduct))
        : null;
    const emoji = selectedQP?.emoji || '🧮';

    // Create synthetic product object compatible with the order system
    const syntheticProduct = {
        id: `calc_${Date.now()}`,
        name: name,
        price: result,
        emoji: emoji,
        is_calculator_item: true,
        quick_product_id: calcState.selectedQuickProduct || null,
    };

    // Use the global addToOrder function (handles rendering + order store + sound)
    if (typeof window.__flangoAddToOrder === 'function') {
        window.__flangoAddToOrder(syntheticProduct);
    } else {
        // Fallback: add directly to order store
        const currentOrder = getOrder();
        currentOrder.push(syntheticProduct);
        setOrder([...currentOrder]);
        try { playSound('addItem'); } catch {}
    }

    // Save to recent entries
    calcState.recentEntries.unshift({
        name,
        amount: result,
        expression: calcState.expression,
        timestamp: Date.now(),
    });
    if (calcState.recentEntries.length > 5) calcState.recentEntries.pop();

    // Clear expression but KEEP selected product name
    calcState.expression = '';
    updateCalcDisplay();
    updateRecentEntries();

    // Visual success feedback
    const btn = document.getElementById('calc-add-to-cart');
    if (btn) {
        btn.classList.add('success');
        setTimeout(() => btn.classList.remove('success'), 400);
    }
}

// ─── Internal: Quick Products ─────────────────────────────────

function getQuickProductName(productId) {
    if (!productId) return null;
    const qp = calcState.quickProducts.find(p => String(p.id) === String(productId));
    if (!qp) return null;
    const emojiDisplay = getEmojiDisplay(qp.emoji);
    return `${emojiDisplay} ${qp.name || ''}`.trim() || null;
}

/** Returnerer ren emoji-tekst (uden ::icon:: prefix) */
function getEmojiDisplay(emoji) {
    if (!emoji) return '📦';
    if (emoji.startsWith(CUSTOM_ICON_PREFIX)) return ''; // Ikon, ikke emoji
    return emoji;
}

/** Returnerer ikon-URL hvis emoji bruger ::icon:: prefix */
function getIconUrl(emoji) {
    if (!emoji || !emoji.startsWith(CUSTOM_ICON_PREFIX)) return null;
    const path = emoji.slice(CUSTOM_ICON_PREFIX.length);
    // Storage paths need full bucket URL
    if (path && !path.startsWith('http')) {
        return `https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/product-icons/${path}`;
    }
    return path;
}

async function loadQuickProducts() {
    try {
        const customer = getCurrentCustomer();
        const institutionId = customer?.institution_id || getInstitutionId();
        if (!institutionId) return;

        const { data } = await supabaseClient
            .from('products')
            .select('id, name, emoji')
            .eq('institution_id', institutionId)
            .eq('is_quick_product', true)
            .eq('is_enabled', true)
            .order('name');

        calcState.quickProducts = data || [];
        renderQuickProducts();
    } catch (err) {
        console.warn('[calculator-mode] loadQuickProducts fejl:', err);
    }
}

function renderQuickProducts() {
    // Update dropdown
    const select = document.getElementById('calc-quick-select');
    if (select) {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Produkt</option>';
        calcState.quickProducts.forEach(qp => {
            const opt = document.createElement('option');
            opt.value = qp.id;
            const iconUrl = getIconUrl(qp.emoji);
            opt.textContent = iconUrl ? `🖼️ ${qp.name}` : `${qp.emoji || '📦'} ${qp.name}`;
            select.appendChild(opt);
        });
        if (currentValue) select.value = currentValue;
    }

    // Update chips
    const chipsContainer = document.getElementById('calc-quick-products');
    if (chipsContainer) {
        chipsContainer.innerHTML = '';
        calcState.quickProducts.forEach(qp => {
            const chip = document.createElement('button');
            chip.className = 'calc-quick-chip';
            chip.dataset.productId = qp.id;
            const iconUrl = getIconUrl(qp.emoji);

            // Chip content: ikon/emoji + navn + ✕ slet-knap
            const labelSpan = document.createElement('span');
            labelSpan.className = 'calc-chip-label';
            if (iconUrl) {
                labelSpan.innerHTML = `<img src="${iconUrl}" class="calc-chip-icon" alt=""> ${qp.name}`;
            } else {
                labelSpan.textContent = `${qp.emoji || '📦'} ${qp.name}`;
            }
            chip.appendChild(labelSpan);

            const deleteBtn = document.createElement('span');
            deleteBtn.className = 'calc-chip-delete';
            deleteBtn.textContent = '×';
            deleteBtn.title = 'Slet hurtig-produkt';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Forhindre chip-selection
                deleteQuickProduct(qp.id, qp.name);
            });
            chip.appendChild(deleteBtn);

            if (String(qp.id) === String(calcState.selectedQuickProduct)) {
                chip.classList.add('selected');
            }
            chip.addEventListener('click', () => {
                // Toggle selection
                if (String(calcState.selectedQuickProduct) === String(qp.id)) {
                    calcState.selectedQuickProduct = null;
                } else {
                    calcState.selectedQuickProduct = qp.id;
                }
                // Clear custom name
                const customNameInput = document.getElementById('calc-custom-name');
                if (customNameInput) customNameInput.value = '';
                calcState.customName = '';
                // Update dropdown
                const select = document.getElementById('calc-quick-select');
                if (select) select.value = calcState.selectedQuickProduct || '';
                // Update chip selection
                chipsContainer.querySelectorAll('.calc-quick-chip').forEach(c => {
                    c.classList.toggle('selected', c.dataset.productId === String(calcState.selectedQuickProduct));
                });
            });
            chipsContainer.appendChild(chip);
        });
    }
}

async function saveNewQuickProduct() {
    const nameInput = document.getElementById('calc-quick-new-name');
    const createForm = document.getElementById('calc-quick-create');

    const name = nameInput?.value?.trim();
    if (!name) return;

    // Brug standard-ikon (::icon::URL) eller emoji
    const emoji = calcState.selectedCreateIconUrl
        ? `${CUSTOM_ICON_PREFIX}${calcState.selectedCreateIconUrl}`
        : (calcState.selectedCreateEmoji || '📦');

    const customer = getCurrentCustomer();
    const institutionId = customer?.institution_id || getInstitutionId();
    if (!institutionId) return;

    try {
        const { error } = await supabaseClient
            .from('products')
            .insert({
                name,
                emoji,
                price: 0,
                is_quick_product: true,
                is_visible: false,
                is_enabled: true,
                institution_id: institutionId,
            });

        if (error) {
            console.error('[calculator-mode] saveNewQuickProduct fejl:', error);
            return;
        }

        // Clear form and hide
        if (createForm) createForm.style.display = 'none';
        resetCreateForm();

        // Reload quick products
        await loadQuickProducts();
    } catch (err) {
        console.error('[calculator-mode] saveNewQuickProduct fejl:', err);
    }
}

async function deleteQuickProduct(productId, productName) {
    const confirmed = await showCustomAlert(
        'Slet hurtig-produkt?',
        `Vil du fjerne <b>${productName || 'dette produkt'}</b> fra lommeregneren?`,
        { type: 'confirm', okText: 'Slet', cancelText: 'Annullér', focus: 'cancel' }
    );
    if (!confirmed) return;

    try {
        // Soft-delete: deaktivér produktet (det er skjult i normalt sortiment allerede)
        const { error } = await supabaseClient
            .from('products')
            .update({ is_enabled: false })
            .eq('id', productId);

        if (error) {
            console.error('[calculator-mode] deleteQuickProduct fejl:', error);
            return;
        }

        // Fjern fra valgt, hvis det var valgt
        if (String(calcState.selectedQuickProduct) === String(productId)) {
            calcState.selectedQuickProduct = null;
        }

        // Reload
        await loadQuickProducts();
    } catch (err) {
        console.error('[calculator-mode] deleteQuickProduct fejl:', err);
    }
}

function resetCreateForm() {
    const nameInput = document.getElementById('calc-quick-new-name');
    if (nameInput) nameInput.value = '';
    calcState.selectedCreateEmoji = '📦';
    calcState.selectedCreateIconUrl = null;
    updateSelectedEmojiPreview();
}

// ─── Internal: Emoji/Ikon Picker ─────────────────────────────

function renderEmojiPicker() {
    const container = document.getElementById('calc-emoji-picker');
    if (!container || container.children.length > 0) return; // Allerede renderet

    // Emoji-sektion
    EMOJI_SUGGESTIONS.forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = 'calc-emoji-option';
        btn.textContent = emoji;
        btn.type = 'button';
        btn.addEventListener('click', () => selectCreateEmoji(emoji));
        container.appendChild(btn);
    });

    // Separator
    const sep = document.createElement('div');
    sep.className = 'calc-emoji-separator';
    container.appendChild(sep);

    // Standard 3D-ikoner
    STANDARD_ICONS.forEach(icon => {
        const btn = document.createElement('button');
        btn.className = 'calc-emoji-option calc-icon-option';
        btn.type = 'button';
        btn.innerHTML = `<img src="${icon.path}" alt="${icon.label}">`;
        btn.title = icon.label;
        btn.addEventListener('click', () => selectCreateIcon(icon.path));
        container.appendChild(btn);
    });

    updateEmojiPickerSelection();
}

function selectCreateEmoji(emoji) {
    calcState.selectedCreateEmoji = emoji;
    calcState.selectedCreateIconUrl = null;
    updateSelectedEmojiPreview();
    updateEmojiPickerSelection();
}

function selectCreateIcon(iconUrl) {
    calcState.selectedCreateIconUrl = iconUrl;
    calcState.selectedCreateEmoji = null;
    updateSelectedEmojiPreview();
    updateEmojiPickerSelection();
}

function updateSelectedEmojiPreview() {
    const preview = document.getElementById('calc-create-selected-emoji');
    if (!preview) return;
    if (calcState.selectedCreateIconUrl) {
        preview.innerHTML = `<img src="${calcState.selectedCreateIconUrl}" alt="Ikon">`;
    } else {
        preview.textContent = calcState.selectedCreateEmoji || '📦';
    }
}

function updateEmojiPickerSelection() {
    const container = document.getElementById('calc-emoji-picker');
    if (!container) return;
    container.querySelectorAll('.calc-emoji-option').forEach(btn => {
        const isIcon = btn.classList.contains('calc-icon-option');
        if (isIcon) {
            const img = btn.querySelector('img');
            btn.classList.toggle('selected', img?.src === calcState.selectedCreateIconUrl);
        } else {
            btn.classList.toggle('selected', btn.textContent === calcState.selectedCreateEmoji);
        }
    });
}

// ─── Internal: Recent Entries ─────────────────────────────────

function updateRecentEntries() {
    const container = document.getElementById('calc-recent');
    if (!container) return;

    // Remove old items (keep label)
    container.querySelectorAll('.calc-recent-item').forEach(el => el.remove());

    calcState.recentEntries.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'calc-recent-item';
        item.textContent = `${entry.name} — ${formatDanishNumber(entry.amount)} DKK`;
        container.appendChild(item);
    });
}

// ─── Internal: Products Collapse ──────────────────────────────

function toggleProductsCollapse() {
    calcState.productsCollapsed = !calcState.productsCollapsed;
    document.body.classList.toggle('products-collapsed', calcState.productsCollapsed);
    // Positionér edge-tab når grid-transition er færdig
    scheduleTabPositioning();
}

/**
 * Vent på grid-transition, positionér tab, og fade den ind.
 * Bruger transitionend (præcis) med setTimeout-fallback (sikkerhed).
 */
function scheduleTabPositioning() {
    const btn = document.getElementById('calculator-products-toggle');
    if (btn) btn.style.opacity = '0';

    const mainApp = document.getElementById('main-app');
    if (!mainApp) {
        positionCollapseTab();
        return;
    }

    let handled = false;
    const done = () => {
        if (handled) return;
        handled = true;
        mainApp.removeEventListener('transitionend', onEnd);
        positionCollapseTab();
    };

    const onEnd = (e) => {
        // Kun reagér på main-app's egen transition (ikke børn)
        if (e.target === mainApp) done();
    };

    mainApp.addEventListener('transitionend', onEnd);
    // Fallback hvis transitionend ikke fyrer (fx ingen reel ændring)
    setTimeout(done, 350);
}

/** Positionér edge-tab op ad calculator-panelets venstre kant */
function positionCollapseTab() {
    const btn = document.getElementById('calculator-products-toggle');
    const panel = document.getElementById('calculator-panel');
    if (!btn || !panel) return;

    if (!calcState.active) {
        btn.style.left = '';
        btn.style.opacity = '';
        return;
    }

    if (calcState.productsCollapsed) {
        // Fixed til venstre skærmkant — CSS håndterer left:0
        btn.style.left = '';
    } else {
        // Sæt left til panelets venstre kant
        const rect = panel.getBoundingClientRect();
        btn.style.left = `${rect.left - btn.offsetWidth}px`;
    }

    // Fade knappen ind (CSS transition: opacity 80ms)
    btn.style.opacity = '';
}
