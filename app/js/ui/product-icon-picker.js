/**
 * product-icon-picker.js — Fullscreen Product Icon Picker
 *
 * Redesigned as a fullscreen, pedagogical modal with:
 * - Large source cards with descriptions (top zone)
 * - Dynamic content zone that adapts to selection
 * - Numbered AI steps with progressive disclosure
 * - Live preview box
 * - Friendly loading messages during AI generation
 *
 * API unchanged:
 *   openProductIconPicker({
 *     mode: 'product' | 'library',
 *     institutionId, productId, productName,
 *     currentIcon, editingIcon, adminProfile,
 *     showCustomAlert, playSound, onResult
 *   })
 */

import {
    STANDARD_ICONS,
    uploadProductIcon,
    fetchInstitutionIconLibrary,
    fetchSharedIconLibrary,
    fetchIconSharingSettings,
    processImageForUpload,
    takeProductPhoto,
} from '../core/product-icon-utils.js?v=3.0.66';
import { getProductIconInfo, CUSTOM_ICON_PREFIX } from '../domain/products-and-cart.js?v=3.0.66';
import { supabaseClient } from '../core/config-and-supabase.js?v=3.0.66';
import { escapeHtml } from '../core/escape-html.js?v=3.0.66';

// ─── Prompt templates ───
const STYLE_CLAY = `A single centered food product icon in soft 3D clay style. Rounded puffy shapes, smooth matte clay texture, subtle soft shadows on the object only. Pastel color palette, gentle highlights, no harsh edges. Friendly, playful, child-safe aesthetic like premium mobile app UI icons. Skeuomorphic but simplified - Apple-like simplicity with minimal detail. No text, no labels, no table, no background elements. The object floats on a perfectly transparent background. Clean crisp edges suitable for UI overlay.`;
const STYLE_PIXAR = `A single centered food product icon in Pixar-style 3D rendering. Glossy, smooth surfaces with vibrant saturated colors. Soft rounded shapes, subtle specular highlights, gentle ambient occlusion shadows on the object only. Friendly, appealing, child-safe aesthetic. Clean and simple - minimal detail, maximum charm. No text, no labels, no background elements. The object floats on a perfectly transparent background with clean crisp edges suitable for UI overlay.`;
const STYLE_PORTRAIT_CLAY = `3D clay-animated style rendering. Rounded puffy shapes, smooth matte clay texture, pastel color palette, gentle highlights, no harsh edges. Friendly, playful, child-safe aesthetic. Characters should look like high-quality clay figurines with warm, expressive faces.`;
const STYLE_PORTRAIT_PIXAR = `Pixar/Dreamworks-style 3D animated rendering. Glossy, smooth surfaces with vibrant saturated colors. Soft rounded shapes, subtle specular highlights. Friendly, appealing, child-safe aesthetic with maximum charm. Characters should look like they belong in a Pixar feature film.`;

const EMOJI_SUGGESTIONS = [
    { emoji: '🍫', name: 'Chokolade' },
    { emoji: '🍽️', name: 'Tallerken' },
    { emoji: '🍷', name: 'Glas' },
    { emoji: '🍎', name: 'Æble' },
    { emoji: '🥜', name: 'Nødder' },
    { emoji: '🥪', name: 'Sandwich' },
    { emoji: '🍕', name: 'Pizza' },
    { emoji: '🥤', name: 'Sodavand' },
    { emoji: '🍚', name: 'Ris' },
    { emoji: '🍣', name: 'Sushi' },
    { emoji: '🥢', name: 'Spisepinde' },
    { emoji: '🍞', name: 'Brød' },
    { emoji: '🥝', name: 'Kiwi' },
    { emoji: '🍇', name: 'Vindruer' },
    { emoji: '🍐', name: 'Pære' },
    { emoji: '🍉', name: 'Vandmelon' },
    { emoji: '🍙', name: 'Risbolle' },
    { emoji: '🍲', name: 'Gryde' },
    { emoji: '🥘', name: 'Pande' },
    { emoji: '🫘', name: 'Bønner' },
    { emoji: '🍔', name: 'Burger' },
    { emoji: '🌶️', name: 'Chili' },
    { emoji: '🧄', name: 'Hvidløg' },
    { emoji: '🍳', name: 'Stegepande' },
    { emoji: '🔥', name: 'Ild' },
    { emoji: '😋', name: 'Lækkert' },
    { emoji: '🍰', name: 'Kage' },
    { emoji: '♨️', name: 'Varmt' },
    { emoji: '🍪', name: 'Småkage' },
];

const PHOTO_MODE_DESCS = {
    reference: '📷 AI\'en ser kun maden på fotoet og laver et helt nyt ikon fra bunden.',
    motiv: '🖼️ AI\'en genskaber hele kompositionen (mad, tallerkener, personer) i valgt stil.',
    portrait: '🍽️ AI\'en laver en animeret figur af kokken der præsenterer/holder retten.',
};

const LOADING_MESSAGES = [
    '🪄 AI\'en tegner dit ikon...',
    '🎨 Vælger de bedste farver...',
    '✨ Tilføjer de sidste detaljer...',
    '🖌️ Næsten klar...',
];

// ─── Source cards config ───
// Label for institution source is set dynamically in buildSources()
const ALL_SOURCES = [
    { key: 'institution', emoji: '🏠', label: '', desc: 'Fra jeres ikonbibliotek', productOnly: true },
    { key: 'standard', emoji: '📁', label: 'Standard', desc: 'Flangos 3D-ikoner', productOnly: true },
    { key: 'emoji', emoji: '😀', label: 'Emoji', desc: 'Vælg en emoji som ikon', productOnly: true },
    { key: 'shared', emoji: '🌐', label: 'Fra andre', desc: 'Delte ikoner fra andre institutioner', productOnly: true },
    { key: 'ai', emoji: '🪄', label: 'AI Ikon', desc: 'Lad AI\'en tegne et ikon for dig', productOnly: false },
    { key: 'camera', emoji: '📸', label: 'Kamera', desc: 'Tag foto af maden med kameraet', productOnly: false },
    { key: 'upload', emoji: '📤', label: 'Upload', desc: 'Upload eget billede som ikon', productOnly: false },
];

/**
 * @param {Object} config
 */
export function openProductIconPicker(config) {
    const {
        mode = 'product',
        institutionId,
        productId,
        productName = '',
        currentIcon,
        editingIcon,
        adminProfile,
        showCustomAlert,
        playSound,
        defaultSource,
        onResult,
    } = config;

    const isProductMode = mode === 'product';
    const isEditMode = !!editingIcon;

    // ─── Helpers ───
    function enableModeSection(el) {
        if (!el) return;
        el.classList.remove('pip-disabled');
        const h = el.querySelector('#pip-mode-hint');
        if (h) h.style.display = 'none';
    }
    function disableModeSection(el) {
        if (!el) return;
        el.classList.add('pip-disabled');
        const h = el.querySelector('#pip-mode-hint');
        if (h) h.style.display = '';
    }

    // ─── State ───
    let activeSource = isEditMode ? 'ai' : (defaultSource || (isProductMode ? 'institution' : 'ai'));
    let selectedStyle = 'pixar';
    let selectedPhotoMode = 'reference';
    let aiPhotoFile = null;
    let aiResultUrl = null;
    let uploadedFile = null;
    let cameraCapturedFile = null;
    let selectedIconPath = null;
    let previewHtml = null; // preserved across tab switches
    let pickingReferenceForAi = false; // true when selecting an icon to use as AI photo ref
    let searchQuery = ''; // search across all select sources
    let cachedAllSelectIcons = null; // cached combined list for search
    let selectedEmoji = null;
    let sharedIconsLoaded = false;
    let advancedOpen = false;
    let stylePromptEdited = false;
    let photoPromptEdited = false;

    // ─── Set institution name on source label ───
    const instName = localStorage.getItem('flango_institution_name') || 'Jeres';
    const instSource = ALL_SOURCES.find(s => s.key === 'institution');
    if (instSource) instSource.label = `${instName}s ikoner`;

    // ─── Two main categories ───
    const SELECT_SOURCES = ALL_SOURCES.filter(s => ['institution', 'standard', 'emoji', 'shared'].includes(s.key));
    const CREATE_SOURCES = ALL_SOURCES.filter(s => ['ai', 'camera', 'upload'].includes(s.key));

    // Determine initial category
    const isCreateCategory = ['upload', 'camera', 'ai'].includes(activeSource);
    let activeCategory = isEditMode ? 'create' : (isCreateCategory ? 'create' : (isProductMode ? 'select' : 'create'));

    // ─── Build DOM ───
    const overlay = document.createElement('div');
    overlay.className = 'pip-overlay';

    const container = document.createElement('div');
    container.className = 'pip-fullscreen';

    const headerTitle = isEditMode ? 'Redigér ikon med AI' : (isProductMode ? 'Produktikon' : 'Opret nyt ikon');

    container.innerHTML = `
        <div class="pip-header">
            <button type="button" class="pip-back-btn" id="pip-header-back" aria-label="Tilbage">← Tilbage</button>
            ${isProductMode && !isEditMode ? `
            <button type="button" class="pip-header-tab ${activeCategory === 'select' ? 'active' : ''}" data-cat="select">📁 Vælg ikon</button>
            <button type="button" class="pip-header-tab ${activeCategory === 'create' ? 'active' : ''}" data-cat="create">🪄 Opret ikon</button>
            ` : `<h2>${headerTitle}</h2>`}
        </div>

        ${isEditMode && editingIcon ? `
        <div class="pip-edit-preview">
            <img src="${editingIcon.icon_url}" alt="${escapeHtml(editingIcon.name)}">
            <div class="pip-edit-name">${escapeHtml(editingIcon.name)}</div>
        </div>` : ''}

        <div class="pip-source-zone" id="pip-source-zone"></div>

        <div class="pip-content-zone" id="pip-content"></div>

        <div class="pip-footer">
            <button type="button" class="pip-manage-library-btn" style="margin-right:auto;padding:10px 20px;border:1px solid rgba(255,255,255,0.2);border-radius:10px;background:rgba(255,255,255,0.1);color:#e2e8f0;cursor:pointer;font-size:14px;font-weight:600" title="Administrer Ikoner">📂 Administrer Ikoner</button>
            ${!isProductMode || isEditMode
                ? `<input type="text" class="pip-name-input" placeholder="Ikon-navn" value="${escapeHtml(editingIcon?.name || productName || '')}">`
                : '<div class="pip-footer-spacer"></div>'}
            <button type="button" class="pip-cancel-btn">Annuller</button>
            <button type="button" class="pip-save-btn" disabled>${isProductMode ? 'Vælg' : 'Gem ikon'}</button>
        </div>
    `;

    overlay.appendChild(container);
    document.body.appendChild(overlay);

    // ─── Refs ───
    const contentZone = container.querySelector('#pip-content');
    const sourceZone = container.querySelector('#pip-source-zone');
    const saveBtn = container.querySelector('.pip-save-btn');
    let previewBox = null; // created dynamically in renderSourceZone

    // ─── Close ───
    const close = () => overlay.remove();
    container.querySelector('.pip-cancel-btn').addEventListener('click', close);
    container.querySelector('#pip-header-back')?.addEventListener('click', close);

    // ─── Administrer Ikoner ───
    container.querySelector('.pip-manage-library-btn')?.addEventListener('click', () => {
        // Save config so we can reopen the picker when returning from library
        const savedConfig = { ...config };
        close();
        if (typeof window.__flangoOpenIconLibrary === 'function') {
            window.__flangoOpenIconLibrary(() => {
                openProductIconPicker(savedConfig);
            });
        }
    });

    // ─── Header category tab switching ───
    function updateHeaderTabs() {
        container.querySelectorAll('.pip-header-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.cat === activeCategory);
        });
    }

    container.querySelectorAll('.pip-header-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            activeCategory = tab.dataset.cat;
            const newSources = activeCategory === 'select' ? SELECT_SOURCES : CREATE_SOURCES;
            activeSource = newSources[0].key;
            searchQuery = '';
            updateHeaderTabs();
            renderSourceZone();
            renderContent();
            updateSaveEnabled();
        });
    });

    // ─── Render source zone (category tabs + sub-sources) ───
    function renderSourceZone() {
        if (isEditMode) {
            sourceZone.style.display = 'none';
            return;
        }

        const sources = activeCategory === 'select' ? SELECT_SOURCES : CREATE_SOURCES;

        sourceZone.innerHTML = `
            <div class="pip-subsource-row">
                <div class="pip-source-cards">
                    ${sources.map(s => `
                        <button type="button" class="pip-source-card ${s.key === activeSource ? 'active' : ''}" data-source="${s.key}">
                            <span class="pip-source-emoji">${s.emoji}</span>
                            <span class="pip-source-label">${s.label}</span>
                            <span class="pip-source-desc">${s.desc}</span>
                        </button>
                    `).join('')}
                </div>
                <div class="pip-preview-box">
                    <span class="pip-preview-placeholder">❓</span>
                    <div class="pip-preview-label">Intet valgt</div>
                    <button type="button" class="pip-preview-clear" style="display:none" title="Fjern valgt ikon">✕</button>
                </div>
            </div>
        `;

        previewBox = sourceZone.querySelector('.pip-preview-box');
        const clearBtn = previewBox.querySelector('.pip-preview-clear');

        // Restore preview from previous state, or show current icon
        if (previewHtml) {
            previewBox.innerHTML = previewHtml + '<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>';
        } else if (currentIcon?.url) {
            previewHtml = `<img src="${currentIcon.url}"><div class="pip-preview-label">Nuværende ikon</div>`;
            previewBox.innerHTML = previewHtml + '<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>';
        }

        // Clear button handler
        previewBox.querySelector('.pip-preview-clear')?.addEventListener('click', (e) => {
            e.stopPropagation();
            clearPreview();
        });

        // Sub-source card switching (click to select, click again to deselect)
        sourceZone.querySelectorAll('.pip-source-card').forEach(card => {
            card.addEventListener('click', () => {
                if (activeSource === card.dataset.source) {
                    // Deselect — show all
                    activeSource = null;
                    sourceZone.querySelectorAll('.pip-source-card').forEach(c => c.classList.remove('active'));
                } else {
                    activeSource = card.dataset.source;
                    sourceZone.querySelectorAll('.pip-source-card').forEach(c => c.classList.toggle('active', c.dataset.source === activeSource));
                    if (activeSource === 'shared' && !sharedIconsLoaded) {
                        sharedIconsLoaded = true;
                    }
                }
                renderContent();
                updateSaveEnabled();
            });
        });
    }

    // ─── Show all select sources combined (with optional search filter) ───
    async function renderAllSelect(section) {
        // Build combined icon list (cached after first build)
        if (!cachedAllSelectIcons) {
            cachedAllSelectIcons = [];

            // Institution icons
            try {
                const instIcons = await fetchInstitutionIconLibrary(institutionId);
                instIcons.forEach(ic => cachedAllSelectIcons.push({
                    label: ic.name, path: ic.icon_url, source: instName, imgSrc: ic.icon_url, tags: ic.tags || ''
                }));
            } catch (e) { /* ignore */ }

            // Standard icons
            STANDARD_ICONS.forEach(ic => cachedAllSelectIcons.push({
                label: ic.label, path: ic.path, source: 'Standard', imgSrc: ic.path
            }));

            // Emojis
            EMOJI_SUGGESTIONS.forEach(({ emoji, name }) => cachedAllSelectIcons.push({
                label: name, path: null, source: 'Emoji', emoji
            }));

            // Shared icons
            try {
                const settings = await fetchIconSharingSettings(institutionId);
                if (settings.icon_use_shared_enabled) {
                    const shared = await fetchSharedIconLibrary(institutionId);
                    shared.forEach(ic => cachedAllSelectIcons.push({
                        label: ic.name, path: ic.icon_url, source: 'Delt', imgSrc: ic.icon_url, tags: ic.tags || ''
                    }));
                }
            } catch (e) { /* ignore */ }
        }

        // Filter
        const results = searchQuery
            ? cachedAllSelectIcons.filter(ic => ic.label.toLowerCase().includes(searchQuery) || ic.source.toLowerCase().includes(searchQuery) || (ic.tags || '').toLowerCase().includes(searchQuery))
            : cachedAllSelectIcons;

        if (results.length === 0) {
            section.innerHTML = searchQuery
                ? `<div class="pip-empty-state">Ingen ikoner matcher "${escapeHtml(searchQuery)}"</div>`
                : '<div class="pip-empty-state">Ingen ikoner fundet</div>';
            return;
        }

        if (searchQuery) {
            const heading = document.createElement('div');
            heading.style.cssText = 'font-size:13px;color:#64748b;margin-bottom:12px;';
            heading.textContent = `${results.length} resultat${results.length === 1 ? '' : 'er'}`;
            section.appendChild(heading);
        }

        const grid = document.createElement('div');
        grid.className = 'pip-icon-grid';
        results.forEach(ic => {
            const opt = document.createElement('div');
            opt.className = `pip-icon-option ${selectedIconPath === ic.path ? 'selected' : ''}`;
            if (ic.emoji) {
                opt.innerHTML = `<span style="font-size:40px">${ic.emoji}</span><span>${ic.source}</span>`;
                opt.addEventListener('click', () => {
                    if (pickingReferenceForAi && ic.path) { handleReferencePickComplete(ic.path); return; }
                    selectedEmoji = ic.emoji;
                    selectedIconPath = null;
                    previewHtml = `<span style="font-size:48px">${ic.emoji}</span><div class="pip-preview-label">Emoji</div>`;
                    if (previewBox) previewBox.innerHTML = previewHtml + '<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>';
                    previewBox?.querySelector('.pip-preview-clear')?.addEventListener('click', clearPreview);
                    updateSaveEnabled();
                });
            } else {
                opt.dataset.path = ic.path;
                opt.innerHTML = `<img src="${ic.imgSrc}" alt="${ic.label}"><span>${ic.label}<br><small style="color:#64748b">${ic.source}</small></span>`;
                opt.addEventListener('click', () => {
                    if (pickingReferenceForAi) { handleReferencePickComplete(ic.path); return; }
                    selectedIconPath = ic.path;
                    selectedEmoji = null;
                    grid.querySelectorAll('.pip-icon-option').forEach(o => o.classList.toggle('selected', o.dataset.path === ic.path));
                    updatePreview(ic.imgSrc, ic.label);
                    updateSaveEnabled();
                });
            }
            grid.appendChild(opt);
        });
        section.appendChild(grid);
    }

    // ─── Handle icon selected while picking reference for AI ───
    async function handleReferencePickComplete(iconUrl) {
        pickingReferenceForAi = false;
        // Fetch icon and use as AI photo reference
        try {
            const r = await fetch(iconUrl);
            const blob = await r.blob();
            const file = new File([blob], 'ref.webp', { type: blob.type || 'image/webp' });
            const processed = await processImageForUpload(file);
            // Switch back to AI
            activeCategory = 'create';
            activeSource = 'ai';
            renderSourceZone();
            renderContent();
            // Inject photo after AI renders
            setTimeout(() => showAiPhotoPreview(processed), 50);
        } catch (err) {
            console.error('[referencePickComplete]', err);
            pickingReferenceForAi = false;
        }
    }

    // ─── Preview update ───
    function updatePreview(src, label) {
        if (!previewBox) return;
        if (src) {
            previewHtml = `<img src="${src}">` + (label ? `<div class="pip-preview-label">${label}</div>` : '');
            previewBox.innerHTML = previewHtml + '<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>';
            // Re-wire clear button
            previewBox.querySelector('.pip-preview-clear')?.addEventListener('click', clearPreview);
        } else {
            clearPreview();
        }
        previewBox.classList.remove('generating');
    }

    function clearPreview() {
        previewHtml = null;
        selectedIconPath = null;
        selectedEmoji = null;
        aiResultUrl = null;
        if (previewBox) {
            previewBox.innerHTML = '<span class="pip-preview-placeholder">❓</span><div class="pip-preview-label">Intet valgt</div>';
        }
        updateSaveEnabled();
    }

    function setPreviewGenerating() {
        if (!previewBox) return;
        previewBox.innerHTML = `<span class="pip-preview-placeholder">🪄</span><div class="pip-preview-label">Genererer...</div>`;
        previewBox.classList.add('generating');
    }

    // ─── Save enabled ───
    function updateSaveEnabled() {
        let enabled = false;
        if (activeSource === null) enabled = !!(selectedIconPath || selectedEmoji);
        else if (activeSource === 'standard') enabled = !!selectedIconPath;
        else if (activeSource === 'emoji') enabled = !!selectedEmoji;
        else if (activeSource === 'institution' || activeSource === 'shared') enabled = !!selectedIconPath;
        else if (activeSource === 'upload') enabled = !!uploadedFile;
        else if (activeSource === 'camera') enabled = !!cameraCapturedFile;
        else if (activeSource === 'ai') enabled = !!aiResultUrl;
        saveBtn.disabled = !enabled;
    }

    // ─── Save handler ───
    saveBtn.addEventListener('click', async () => {
        if (activeSource === null) {
            // All-view: determine type from what was selected
            if (selectedEmoji) { onResult({ type: 'emoji', emoji: selectedEmoji }); close(); }
            else if (selectedIconPath) { onResult({ type: 'icon', emoji: `${CUSTOM_ICON_PREFIX}${selectedIconPath}`, url: selectedIconPath }); close(); }
            return;
        }
        if (activeSource === 'standard') {
            if (selectedIconPath) onResult({ type: 'standard', emoji: `${CUSTOM_ICON_PREFIX}${selectedIconPath}`, url: selectedIconPath });
            close();
        } else if (activeSource === 'emoji') {
            if (selectedEmoji) onResult({ type: 'emoji', emoji: selectedEmoji });
            close();
        } else if (activeSource === 'institution' || activeSource === 'shared') {
            if (selectedIconPath) onResult({ type: 'icon', emoji: `${CUSTOM_ICON_PREFIX}${selectedIconPath}`, url: selectedIconPath });
            close();
        } else if (activeSource === 'upload' || activeSource === 'camera') {
            const file = activeSource === 'upload' ? uploadedFile : cameraCapturedFile;
            if (!file) return;
            saveBtn.disabled = true;
            saveBtn.textContent = 'Gemmer...';
            try {
                const adminUserId = adminProfile?.user_id;
                if (!adminUserId) throw new Error('Admin bruger ID ikke fundet');
                const processed = await processImageForUpload(file);
                const id = productId || crypto.randomUUID();
                const pFile = new File([processed], `${id}.webp`, { type: 'image/webp' });
                const result = await uploadProductIcon(pFile, institutionId, id, adminUserId);
                if (result.success) {
                    playSound?.('success');
                    onResult({ type: 'upload', url: result.icon_signed_url || result.icon_url, storagePath: result.icon_storage_path, updatedAt: result.icon_updated_at });
                    close();
                } else throw new Error(result.error || 'Upload fejlede');
            } catch (err) {
                console.error('[pip save]', err);
                showCustomAlert?.('Fejl', err.message);
                saveBtn.textContent = isProductMode ? 'Vælg' : 'Gem ikon';
                updateSaveEnabled();
            }
        } else if (activeSource === 'ai') {
            if (aiResultUrl) {
                onResult({ type: 'ai', url: aiResultUrl, metadata: { style: selectedStyle, photoMode: selectedPhotoMode } });
                close();
            }
        }
    });

    // ─── Render content zone ───
    function renderContent() {
        contentZone.innerHTML = '';

        // Show banner when picking reference for AI
        if (pickingReferenceForAi) {
            const banner = document.createElement('div');
            banner.style.cssText = 'padding:10px 16px;background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);border-radius:10px;margin-bottom:14px;display:flex;align-items:center;gap:10px;font-size:13px;color:#c4b5fd;';
            banner.innerHTML = `<span style="font-size:20px">🖼️</span> <span>Vælg et ikon som foto-reference til AI — klik på det ikon du vil bruge</span>
                <button type="button" style="margin-left:auto;background:none;border:1px solid rgba(124,58,237,0.4);border-radius:6px;color:#a78bfa;padding:4px 12px;cursor:pointer;font-size:12px;font-weight:600;" id="pip-cancel-pick">Annuller</button>`;
            contentZone.appendChild(banner);
            banner.querySelector('#pip-cancel-pick').addEventListener('click', () => {
                pickingReferenceForAi = false;
                activeCategory = 'create';
                activeSource = 'ai';
                renderSourceZone();
                renderContent();
            });
        }

        // Search field (only in select category)
        if (activeCategory === 'select') {
            const searchRow = document.createElement('div');
            searchRow.className = 'pip-search-row';
            searchRow.innerHTML = `<input type="text" class="pip-search-input" id="pip-search" placeholder="🔍 Søg ${activeSource ? 'i ' + (SELECT_SOURCES.find(s => s.key === activeSource)?.label || '') : 'i alle ikoner'}..." value="${escapeHtml(searchQuery)}" autocomplete="off"><button type="button" class="pip-search-clear" id="pip-search-clear" ${searchQuery ? '' : 'style="display:none"'}>✕</button>`;
            contentZone.appendChild(searchRow);

            let searchDebounce = null;
            const searchInput = searchRow.querySelector('#pip-search');
            const searchClear = searchRow.querySelector('#pip-search-clear');

            searchInput.addEventListener('input', () => {
                clearTimeout(searchDebounce);
                searchClear.style.display = searchInput.value ? '' : 'none';
                searchDebounce = setTimeout(() => {
                    searchQuery = searchInput.value.trim().toLowerCase();
                    renderContentBody();
                }, 250);
            });

            searchClear.addEventListener('click', () => {
                searchQuery = '';
                searchInput.value = '';
                searchClear.style.display = 'none';
                searchInput.focus();
                renderContentBody();
            });

            searchInput.focus();
        }

        renderContentBody();
    }

    function renderContentBody() {
        // Remove previous body (keep banners + search)
        const oldBody = contentZone.querySelector('.pip-content-section');
        if (oldBody) oldBody.remove();

        const section = document.createElement('div');
        section.className = 'pip-content-section';

        if (activeCategory === 'select' && activeSource === null) {
            // No source selected — show all sources combined (or filtered by search)
            renderAllSelect(section);
        } else {
            switch (activeSource) {
                case 'standard': renderStandard(section); break;
                case 'emoji': renderEmoji(section); break;
                case 'institution': renderInstitution(section); break;
                case 'shared': renderShared(section); break;
                case 'upload': renderUpload(section); break;
                case 'camera': renderCamera(section); break;
                case 'ai': renderAI(section); break;
            }
        }

        contentZone.appendChild(section);
    }

    // ═══════════════════════════════════════
    // STANDARD TAB
    // ═══════════════════════════════════════
    function renderStandard(el) {
        const grid = document.createElement('div');
        grid.className = 'pip-icon-grid';
        const filtered = searchQuery
            ? STANDARD_ICONS.filter(ic => ic.label.toLowerCase().includes(searchQuery))
            : STANDARD_ICONS;
        if (filtered.length === 0) {
            el.innerHTML = `<div class="pip-empty-state">Ingen standard-ikoner matcher "${escapeHtml(searchQuery)}"</div>`;
            return;
        }
        filtered.forEach(icon => {
            const opt = document.createElement('div');
            opt.className = `pip-icon-option ${selectedIconPath === icon.path ? 'selected' : ''}`;
            opt.dataset.path = icon.path;
            opt.innerHTML = `<img src="${icon.path}" alt="${icon.label}"><span>${icon.label}</span>`;
            opt.addEventListener('click', () => {
                if (pickingReferenceForAi) { handleReferencePickComplete(icon.path); return; }
                selectedIconPath = icon.path;
                selectedEmoji = null;
                el.querySelectorAll('.pip-icon-option').forEach(o => o.classList.toggle('selected', o.dataset.path === icon.path));
                updatePreview(icon.path, icon.label);
                updateSaveEnabled();
            });
            grid.appendChild(opt);
        });
        el.appendChild(grid);
    }

    function renderEmoji(el) {
        const filtered = searchQuery
            ? EMOJI_SUGGESTIONS.filter(e => e.name.toLowerCase().includes(searchQuery) || e.emoji.includes(searchQuery))
            : EMOJI_SUGGESTIONS;

        el.innerHTML = `
            <div style="margin-bottom:16px">
                <div style="font-size:14px;font-weight:600;margin-bottom:8px">Vælg en emoji</div>
                <div style="font-size:12px;color:#64748b;margin-bottom:12px">Klik på en emoji nedenfor, eller skriv din egen i feltet</div>
            </div>
            <input type="text" class="pip-name-input" id="pip-emoji-input" placeholder="Indtast emoji her..." value="${selectedEmoji || ''}" style="width:100%;max-width:300px;font-size:24px;text-align:center;margin-bottom:16px">
            <div class="pip-icon-grid" id="pip-emoji-grid"></div>
        `;

        if (filtered.length === 0) {
            el.querySelector('#pip-emoji-grid').innerHTML = `<div class="pip-empty-state">Ingen emojis matcher "${escapeHtml(searchQuery)}"</div>`;
        }

        const input = el.querySelector('#pip-emoji-input');
        const grid = el.querySelector('#pip-emoji-grid');

        filtered.forEach(({ emoji, name }) => {
            const opt = document.createElement('div');
            opt.className = 'pip-icon-option';
            opt.innerHTML = `<span style="font-size:36px">${emoji}</span><span>${name}</span>`;
            opt.addEventListener('click', () => {
                selectedEmoji = emoji;
                selectedIconPath = null;
                input.value = emoji;
                previewHtml = `<span style="font-size:48px">${emoji}</span><div class="pip-preview-label">${name}</div>`;
                if (previewBox) previewBox.innerHTML = previewHtml + '<button type="button" class="pip-preview-clear" title="Fjern valgt ikon">✕</button>';
                previewBox?.querySelector('.pip-preview-clear')?.addEventListener('click', clearPreview);
                updateSaveEnabled();
            });
            grid.appendChild(opt);
        });

        input.addEventListener('input', () => {
            selectedEmoji = input.value || null;
            selectedIconPath = null;
            if (selectedEmoji) {
                previewHtml = `<span style="font-size:48px">${selectedEmoji}</span><div class="pip-preview-label">Emoji</div>`;
                if (previewBox) previewBox.innerHTML = previewHtml;
            }
            updateSaveEnabled();
        });
    }

    // ═══════════════════════════════════════
    // INSTITUTION / SHARED TABS
    // ═══════════════════════════════════════
    function renderInstitution(el) {
        el.innerHTML = '<div class="pip-empty-state">Indlæser...</div>';
        loadIconGrid(el, () => fetchInstitutionIconLibrary(institutionId), 'Ingen egne ikoner endnu — upload eller generer via AI.');
    }

    function renderShared(el) {
        el.innerHTML = '<div class="pip-empty-state">Indlæser...</div>';
        loadSharedIcons(el);
    }

    async function loadSharedIcons(el) {
        if (!el) el = contentZone.querySelector('.pip-content-section');
        if (!el) return;
        const settings = await fetchIconSharingSettings(institutionId);
        if (!settings.icon_use_shared_enabled) {
            el.innerHTML = '<div class="pip-empty-state">Brug af delte ikoner er ikke aktiveret. Slå det til under Institutionsindstillinger.</div>';
            return;
        }
        loadIconGrid(el, () => fetchSharedIconLibrary(institutionId), 'Ingen delte ikoner tilgængelige endnu.');
    }

    async function loadIconGrid(el, fetchFn, emptyMsg) {
        let icons = await fetchFn();
        el.innerHTML = '';
        // Apply search filter
        if (searchQuery) {
            console.log('[loadIconGrid] Searching for:', searchQuery, 'in', icons.length, 'icons. Sample tags:', icons.slice(0, 3).map(i => i.name + ':' + (i.tags || 'none')));
            icons = icons.filter(ic => ic.name.toLowerCase().includes(searchQuery) || (ic.tags || '').toLowerCase().includes(searchQuery));
            console.log('[loadIconGrid] After filter:', icons.length, 'matches');
        }
        if (icons.length === 0) {
            el.innerHTML = searchQuery
                ? `<div class="pip-empty-state">Ingen ikoner matcher "${escapeHtml(searchQuery)}"</div>`
                : `<div class="pip-empty-state">${emptyMsg}</div>`;
            return;
        }
        const grid = document.createElement('div');
        grid.className = 'pip-icon-grid';
        icons.forEach(icon => {
            const opt = document.createElement('div');
            opt.className = `pip-icon-option ${selectedIconPath === icon.icon_url ? 'selected' : ''}`;
            opt.dataset.path = icon.icon_url;
            const tag = icon.source === 'uploaded' ? '📤' : '🪄';
            opt.innerHTML = `<img src="${icon.icon_url}" alt="${icon.name}"><span>${tag} ${icon.name}</span>`;
            opt.addEventListener('click', () => {
                if (pickingReferenceForAi) { handleReferencePickComplete(icon.icon_url); return; }
                selectedIconPath = icon.icon_url;
                selectedEmoji = null;
                grid.querySelectorAll('.pip-icon-option').forEach(o => o.classList.toggle('selected', o.dataset.path === icon.icon_url));
                updatePreview(icon.icon_url, icon.name);
                updateSaveEnabled();
            });
            grid.appendChild(opt);
        });
        el.appendChild(grid);
    }

    // ═══════════════════════════════════════
    // UPLOAD TAB
    // ═══════════════════════════════════════
    function renderUpload(el) {
        el.innerHTML = `
            <div class="pip-dropzone" id="pip-upload-drop">
                <div class="pip-dropzone-icon">📤</div>
                <div class="pip-dropzone-title">Træk et billede hertil</div>
                <div class="pip-dropzone-desc">eller klik for at vælge fra din enhed<br><small>WebP, PNG, JPEG — konverteres automatisk</small></div>
                <input type="file" accept=".webp,.png,.jpg,.jpeg,image/webp,image/png,image/jpeg" style="display:none">
            </div>
            <div class="pip-upload-preview" id="pip-upload-preview" style="display:none">
                <img id="pip-upload-img">
                <div style="margin-top:10px"><button type="button" class="pip-btn-secondary" id="pip-upload-remove">✕ Fjern billede</button></div>
            </div>
            <label class="pip-bg-removal">
                <input type="checkbox" id="pip-remove-bg">
                <div>
                    <div class="pip-bg-removal-label">Forsøg at fjerne baggrund</div>
                    <div class="pip-bg-removal-desc">Virker bedst på billeder med ensfarvet baggrund (fx hvid)</div>
                </div>
            </label>`;

        const drop = el.querySelector('#pip-upload-drop');
        const fileInput = el.querySelector('input[type=file]');
        const preview = el.querySelector('#pip-upload-preview');
        const previewImg = el.querySelector('#pip-upload-img');
        const removeBtn = el.querySelector('#pip-upload-remove');

        drop.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ''; });
        drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
        drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('dragover'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
        removeBtn.addEventListener('click', () => { uploadedFile = null; preview.style.display = 'none'; drop.style.display = ''; updatePreview(null); updateSaveEnabled(); });

        async function handleFile(file) {
            try {
                uploadedFile = await processImageForUpload(file);
                previewImg.src = URL.createObjectURL(uploadedFile);
                preview.style.display = '';
                drop.style.display = 'none';
                updatePreview(previewImg.src, 'Uploadet billede');
                updateSaveEnabled();
            } catch (err) { console.error('[upload]', err); }
        }
    }

    // ═══════════════════════════════════════
    // CAMERA TAB
    // ═══════════════════════════════════════
    function renderCamera(el) {
        el.innerHTML = `
            <div class="pip-camera-trigger" id="pip-cam-trigger">
                <div class="pip-dropzone-icon">📸</div>
                <div class="pip-dropzone-title">Klik for at tage billede</div>
                <div class="pip-dropzone-desc">Billedet konverteres automatisk til ikon-format</div>
            </div>
            <div class="pip-camera-preview" id="pip-cam-preview" style="display:none">
                <img id="pip-cam-img">
                <div class="pip-camera-actions">
                    <button type="button" class="pip-btn-primary" id="pip-cam-use">Brug som ikon</button>
                    <button type="button" class="pip-btn-ai-ref" id="pip-cam-ai">Brug som AI-reference</button>
                    <button type="button" class="pip-btn-secondary" id="pip-cam-retake">🔄 Tag nyt</button>
                </div>
            </div>`;

        const trigger = el.querySelector('#pip-cam-trigger');
        const preview = el.querySelector('#pip-cam-preview');
        const img = el.querySelector('#pip-cam-img');

        const capture = async () => {
            try {
                const file = await takeProductPhoto({ showCustomAlert });
                if (file) {
                    cameraCapturedFile = file;
                    img.src = URL.createObjectURL(file);
                    preview.style.display = '';
                    trigger.style.display = 'none';
                    updatePreview(img.src, 'Foto');
                    updateSaveEnabled();
                }
            } catch (err) { console.error('[camera]', err); }
        };

        trigger.addEventListener('click', capture);
        el.querySelector('#pip-cam-retake').addEventListener('click', () => {
            cameraCapturedFile = null; preview.style.display = 'none'; trigger.style.display = ''; updatePreview(null); updateSaveEnabled(); capture();
        });
        el.querySelector('#pip-cam-use').addEventListener('click', () => {
            if (cameraCapturedFile) { uploadedFile = cameraCapturedFile; activeSource = 'camera'; updateSaveEnabled(); }
        });
        el.querySelector('#pip-cam-ai').addEventListener('click', () => {
            if (!cameraCapturedFile) return;
            const file = cameraCapturedFile;
            activeSource = 'ai';
            sourceCards.forEach(c => c.classList.toggle('active', c.dataset.source === 'ai'));
            renderContent();
            // Inject photo after AI tab renders
            setTimeout(() => showAiPhotoPreview(file), 50);
        });
    }

    // ═══════════════════════════════════════
    // AI TAB
    // ═══════════════════════════════════════
    function renderAI(el) {
        const nameVal = escapeHtml(productName || editingIcon?.name || '');

        el.innerHTML = `
            <!-- Step 1: Product name -->
            <div class="pip-ai-step" id="pip-ai-step1">
                <div class="pip-ai-step-header">
                    <span class="pip-step-badge">1</span>
                    <span class="pip-step-label">Hvad skal ikonet forestille?</span>
                    <span style="font-size:11px;color:#64748b;background:rgba(255,255,255,0.06);padding:2px 10px;border-radius:8px;margin-left:4px">valgfrit hvis du bruger foto</span>
                </div>
                <div class="pip-step-hint">Skriv navnet på produktet — eller upload et foto i trin ③</div>
                <div style="margin-left:38px">
                    <input type="text" class="pip-name-input" id="pip-ai-name" placeholder="fx Pasta med kødsovs" maxlength="100" value="${nameVal}" style="width:100%;max-width:500px">
                </div>
            </div>

            <!-- Step 2: Style -->
            <div class="pip-ai-step" id="pip-ai-step2">
                <div class="pip-ai-step-header">
                    <span class="pip-step-badge">2</span>
                    <span class="pip-step-label">Vælg stil</span>
                </div>
                <div class="pip-step-hint">Bestemmer hvordan ikonet kommer til at se ud</div>
                <div class="pip-style-cards">
                    <button type="button" class="pip-style-card active" data-style="pixar">
                        <span class="pip-card-emoji">🎬</span>
                        <div class="pip-card-label">Pixar</div>
                        <div class="pip-card-desc">Blankt look med klare farver og glans</div>
                    </button>
                    <button type="button" class="pip-style-card" data-style="clay">
                        <span class="pip-card-emoji">🏺</span>
                        <div class="pip-card-label">Clay</div>
                        <div class="pip-card-desc">Blødt 3D med runde former og pastelfarver</div>
                    </button>
                    <button type="button" class="pip-style-card" data-style="custom">
                        <span class="pip-card-emoji">✍️</span>
                        <div class="pip-card-label">Fri prompt</div>
                        <div class="pip-card-desc">Du skriver selv hvad AI'en skal tegne</div>
                    </button>
                </div>
            </div>

            <!-- Custom prompt (only when "Fri prompt" selected) -->
            <div class="pip-custom-prompt-section" id="pip-custom-section" style="display:none">
                <textarea id="pip-custom-prompt" placeholder="Beskriv præcis hvad du vil have — fx 'A golden crispy croissant floating in space with sparkles'" maxlength="500"></textarea>
                <div class="pip-custom-prompt-hint">Prompten sendes direkte til AI — ingen automatisk stil tilføjes</div>
            </div>

            <!-- Step 3: Photo reference -->
            <div class="pip-ai-step" id="pip-ai-step3">
                <div class="pip-ai-step-header">
                    <span class="pip-step-badge">3</span>
                    <span class="pip-step-label">Foto-reference</span>
                    <span style="font-size:11px;color:#64748b;background:rgba(255,255,255,0.06);padding:2px 10px;border-radius:8px;margin-left:4px">valgfrit</span>
                </div>
                <div class="pip-step-hint">Upload et foto af maden — så kan AI'en bruge det som inspiration</div>
                <div class="pip-photo-actions" id="pip-photo-actions">
                    <button type="button" class="pip-photo-btn" id="pip-photo-camera">
                        <span class="pip-btn-icon">📸</span> Tag foto
                    </button>
                    ${isProductMode ? `<button type="button" class="pip-photo-btn" id="pip-photo-pick"><span class="pip-btn-icon">📁</span> Vælg ikon</button>` : ''}
                    <button type="button" class="pip-photo-btn" id="pip-photo-file">
                        <span class="pip-btn-icon">📁</span> Vælg fil
                        <input type="file" accept="image/*" style="display:none">
                    </button>
                </div>
                <div class="pip-photo-preview" id="pip-photo-preview" style="display:none">
                    <img id="pip-photo-img">
                    <div>
                        <div style="font-size:12px;font-weight:600;margin-bottom:4px">Foto valgt</div>
                        <button type="button" class="pip-photo-remove-btn" id="pip-photo-remove">✕ Fjern foto</button>
                    </div>
                </div>
            </div>

            <!-- Step 4: Photo mode (always visible, dimmed without photo) -->
            <div class="pip-ai-step pip-mode-section ${aiPhotoFile ? '' : 'pip-disabled'}" id="pip-mode-section">
                <div class="pip-ai-step-header">
                    <span class="pip-step-badge">4</span>
                    <span class="pip-step-label">Foto-tilstand</span>
                    <span class="pip-mode-hint" id="pip-mode-hint" ${aiPhotoFile ? 'style="display:none"' : ''} style="font-size:11px;color:#64748b;background:rgba(255,255,255,0.06);padding:2px 10px;border-radius:8px;margin-left:4px">upload foto i trin ③ først</span>
                </div>
                <div class="pip-step-hint">Bestemmer hvordan AI'en bruger dit foto</div>
                <div class="pip-mode-cards" style="margin-left:38px">
                    <button type="button" class="pip-mode-card active" data-mode="reference">
                        <span class="pip-card-emoji">📷</span>
                        <div class="pip-card-label">Reference</div>
                        <div class="pip-card-desc">Identificer maden og lav nyt ikon</div>
                    </button>
                    <button type="button" class="pip-mode-card" data-mode="motiv">
                        <span class="pip-card-emoji">🖼️</span>
                        <div class="pip-card-label">Motiv</div>
                        <div class="pip-card-desc">Genskab hele kompositionen</div>
                    </button>
                    <button type="button" class="pip-mode-card" data-mode="portrait">
                        <span class="pip-card-emoji">🍽️</span>
                        <div class="pip-card-label">Mad Portræt</div>
                        <div class="pip-card-desc">Kokken præsenterer maden</div>
                    </button>
                </div>
                <div class="pip-mode-desc-text" id="pip-mode-desc">${PHOTO_MODE_DESCS.reference}</div>
            </div>

            <!-- Advanced prompts -->
            <details class="pip-advanced-details" id="pip-advanced">
                <summary>Avanceret — redigér prompts</summary>
                <div style="margin-top:8px">
                    <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px">Stil-prompt</label>
                    <textarea class="pip-prompt-area" id="pip-style-prompt"></textarea>
                </div>
                <div style="margin-top:12px">
                    <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px">Foto-tilstand prompt</label>
                    <textarea class="pip-prompt-area" id="pip-photo-prompt"></textarea>
                </div>
                <button type="button" class="pip-reset-prompt-btn" id="pip-reset-prompts">↺ Nulstil prompts</button>
            </details>

            <!-- Generate -->
            <button type="button" class="pip-generate-btn" id="pip-generate">🪄 Generér ikon</button>

            <!-- Loading -->
            <div class="pip-generate-loading" id="pip-loading" style="display:none">
                <div class="pip-loading-spinner">🪄</div>
                <div class="pip-loading-message" id="pip-loading-msg">${LOADING_MESSAGES[0]}</div>
            </div>

            <!-- Result -->
            <div class="pip-ai-result" id="pip-result" style="display:none">
                <img id="pip-result-img">
                <div class="pip-result-label" id="pip-result-label"></div>
                <div class="pip-result-actions">
                    <button type="button" class="pip-btn-secondary" id="pip-retry">🔄 Prøv igen</button>
                </div>
            </div>
        `;

        setupAiHandlers(el);
    }

    // ─── AI event handlers ───
    function setupAiHandlers(el) {
        const nameInput = el.querySelector('#pip-ai-name');
        const styleCards = el.querySelectorAll('.pip-style-card');
        const customSection = el.querySelector('#pip-custom-section');
        const customPrompt = el.querySelector('#pip-custom-prompt');
        const step1 = el.querySelector('#pip-ai-step1');
        const photoActions = el.querySelector('#pip-photo-actions');
        const photoPreview = el.querySelector('#pip-photo-preview');
        const photoImg = el.querySelector('#pip-photo-img');
        const photoRemove = el.querySelector('#pip-photo-remove');
        const photoFileBtn = el.querySelector('#pip-photo-file');
        const photoFileInput = photoFileBtn?.querySelector('input');
        const photoCameraBtn = el.querySelector('#pip-photo-camera');
        const modeSection = el.querySelector('#pip-mode-section');
        const modeCards = el.querySelectorAll('.pip-mode-card');
        const modeDesc = el.querySelector('#pip-mode-desc');
        const generateBtn = el.querySelector('#pip-generate');
        const loadingEl = el.querySelector('#pip-loading');
        const loadingMsg = el.querySelector('#pip-loading-msg');
        const resultEl = el.querySelector('#pip-result');
        const resultImg = el.querySelector('#pip-result-img');
        const resultLabel = el.querySelector('#pip-result-label');
        const retryBtn = el.querySelector('#pip-retry');
        const advDetails = el.querySelector('#pip-advanced');
        const stylePromptEl = el.querySelector('#pip-style-prompt');
        const photoPromptEl = el.querySelector('#pip-photo-prompt');
        const resetPromptsBtn = el.querySelector('#pip-reset-prompts');

        // Style selection
        styleCards.forEach(card => {
            card.addEventListener('click', () => {
                selectedStyle = card.dataset.style;
                styleCards.forEach(c => c.classList.toggle('active', c === card));
                const isCustom = selectedStyle === 'custom';
                customSection.style.display = isCustom ? 'block' : 'none';
                step1.style.display = isCustom ? 'none' : 'block';
                if (modeSection) {
                    const disabled = isCustom || !aiPhotoFile;
                    modeSection.classList.toggle('pip-disabled', disabled);
                    const h = modeSection.querySelector('#pip-mode-hint');
                    if (h) h.style.display = disabled ? '' : 'none';
                }
                updateAdvancedPrompts();
            });
        });

        // Photo reference
        photoFileBtn?.addEventListener('click', () => photoFileInput?.click());
        photoFileInput?.addEventListener('change', e => { if (e.target.files[0]) handleAiPhoto(e.target.files[0]); e.target.value = ''; });

        // "Vælg ikon" as photo reference — navigate to select tab, pick icon, come back
        const photoPickBtn = el.querySelector('#pip-photo-pick');
        photoPickBtn?.addEventListener('click', () => {
            pickingReferenceForAi = true;
            activeCategory = 'select';
            activeSource = SELECT_SOURCES[0].key;
            renderSourceZone();
            renderContent();
        });
        photoCameraBtn?.addEventListener('click', async () => {
            try {
                const file = await takeProductPhoto({ showCustomAlert });
                if (file) handleAiPhoto(file);
            } catch (err) { console.error('[aiPhotoCamera]', err); }
        });
        photoRemove?.addEventListener('click', removePhoto);

        async function handleAiPhoto(file) {
            try {
                aiPhotoFile = await processImageForUpload(file);
                showAiPhotoPreviewInSection(aiPhotoFile);
            } catch (err) { console.error('[aiPhoto]', err); }
        }

        function showAiPhotoPreviewInSection(file) {
            photoImg.src = URL.createObjectURL(file);
            photoPreview.style.display = 'flex';
            photoActions.style.display = 'none';
            if (selectedStyle !== 'custom') enableModeSection(modeSection);
            updateAdvancedPrompts();
        }

        function removePhoto() {
            aiPhotoFile = null;
            photoPreview.style.display = 'none';
            photoActions.style.display = 'flex';
            disableModeSection(modeSection);
            updateAdvancedPrompts();
        }

        // Photo modes
        modeCards.forEach(card => {
            card.addEventListener('click', () => {
                selectedPhotoMode = card.dataset.mode;
                modeCards.forEach(c => c.classList.toggle('active', c === card));
                modeDesc.textContent = PHOTO_MODE_DESCS[selectedPhotoMode] || '';
                updateAdvancedPrompts();
            });
        });

        // Advanced prompts
        function buildStylePrompt() {
            if (selectedStyle === 'custom') return '';
            const isPerson = selectedPhotoMode === 'portrait' && !!aiPhotoFile;
            if (isPerson) return selectedStyle === 'pixar' ? STYLE_PORTRAIT_PIXAR : STYLE_PORTRAIT_CLAY;
            return selectedStyle === 'pixar' ? STYLE_PIXAR : STYLE_CLAY;
        }

        function buildPhotoModePrompt() {
            const name = nameInput?.value?.trim() || '';
            if (selectedStyle === 'custom') return '';
            if (!aiPhotoFile) return `The food item is: ${name}\nInclude a bowl, plate, cup, or container only if the food needs one.`;
            if (selectedPhotoMode === 'portrait') {
                const s = selectedStyle === 'clay' ? 'clay-animated' : 'Pixar/Dreamworks-style animated';
                return `Transform into ${s} version. Person (cook/chef) proudly presenting food. Preserve features. Include food prominently.${name ? ` Dish: ${name}` : ''}`;
            }
            if (selectedPhotoMode === 'motiv') {
                const r = selectedStyle === 'pixar' ? 'glossy Pixar' : 'Flango clay';
                return `Recreate composition from photo as 3D icon. Keep food arrangement, render in ${r} style. If people appear, include as stylized characters.${name ? ` Product: ${name}` : ''}`;
            }
            const sn = selectedStyle === 'pixar' ? 'Pixar-style' : 'clay-style';
            return `Use photo only to identify food. Create fresh ${sn} icon. Ignore background/angle. Include container only if needed.${name ? ` Product: ${name}` : ''}`;
        }

        function updateAdvancedPrompts() {
            if (!advDetails?.open) return;
            if (!stylePromptEdited && stylePromptEl) stylePromptEl.value = buildStylePrompt();
            if (!photoPromptEdited && photoPromptEl) photoPromptEl.value = buildPhotoModePrompt();
        }

        advDetails?.addEventListener('toggle', () => {
            if (advDetails.open) { stylePromptEdited = false; photoPromptEdited = false; updateAdvancedPrompts(); }
        });
        stylePromptEl?.addEventListener('input', () => { stylePromptEdited = true; });
        photoPromptEl?.addEventListener('input', () => { photoPromptEdited = true; });
        resetPromptsBtn?.addEventListener('click', () => { stylePromptEdited = false; photoPromptEdited = false; updateAdvancedPrompts(); });
        nameInput?.addEventListener('input', updateAdvancedPrompts);

        // ─── Generate ───
        let isGenerating = false;
        let loadingInterval = null;

        async function handleGenerate() {
            if (isGenerating) return;
            const isCustom = selectedStyle === 'custom';
            const name = nameInput?.value?.trim() || '';
            const customText = customPrompt?.value?.trim() || '';
            const hasPhoto = !!aiPhotoFile;

            if (isCustom && !customText) { showCustomAlert?.('Manglende prompt', 'Skriv en prompt i tekstfeltet'); return; }
            if (!isCustom && !name && !hasPhoto) { showCustomAlert?.('Manglende input', 'Skriv et produktnavn eller upload et foto'); return; }

            isGenerating = true;
            generateBtn.style.display = 'none';
            resultEl.style.display = 'none';
            loadingEl.style.display = 'block';
            setPreviewGenerating();
            aiResultUrl = null;

            // Rotate loading messages
            let msgIdx = 0;
            loadingMsg.textContent = LOADING_MESSAGES[0];
            loadingInterval = setInterval(() => {
                msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
                loadingMsg.textContent = LOADING_MESSAGES[msgIdx];
            }, 3000);

            try {
                const adminUserId = adminProfile?.user_id;
                if (!adminUserId) throw new Error('Admin bruger ID ikke fundet');
                const { data: { session } } = await supabaseClient.auth.getSession();
                const accessToken = session?.access_token || '';
                const supabaseUrl = supabaseClient.supabaseUrl || supabaseClient.rest?.url?.replace('/rest/v1', '') || '';

                const useAdvPrompt = advDetails?.open && (stylePromptEdited || photoPromptEdited);
                const combinedPrompt = useAdvPrompt ? ((stylePromptEl?.value?.trim() || '') + '\n\n' + (photoPromptEl?.value?.trim() || '')).trim() : '';

                const headers = { 'Authorization': `Bearer ${accessToken}`, 'x-admin-user-id': adminUserId };
                let body;

                if (hasPhoto && !isCustom && !useAdvPrompt) {
                    body = new FormData();
                    if (isProductMode && productId) body.append('product_id', productId);
                    else { body.append('institution_id', institutionId); body.append('save_to_library_only', 'true'); }
                    body.append('product_name', name);
                    body.append(isProductMode ? 'reference_image' : 'photo', aiPhotoFile, 'photo.webp');
                    body.append('style', selectedStyle);
                    body.append('photo_mode', selectedPhotoMode);
                } else if (hasPhoto) {
                    body = new FormData();
                    if (isProductMode && productId) body.append('product_id', productId);
                    else { body.append('institution_id', institutionId); body.append('save_to_library_only', 'true'); }
                    body.append('product_name', name);
                    body.append(isProductMode ? 'reference_image' : 'photo', aiPhotoFile, 'photo.webp');
                    body.append('prompt_mode', 'custom');
                    body.append('custom_prompt', useAdvPrompt ? combinedPrompt : customText);
                } else {
                    headers['Content-Type'] = 'application/json';
                    const j = { product_name: name, style: isCustom ? 'custom' : selectedStyle };
                    if (isProductMode && productId) j.product_id = productId;
                    else { j.institution_id = institutionId; j.save_to_library_only = true; }
                    if (isCustom || useAdvPrompt) { j.prompt_mode = 'custom'; j.custom_prompt = useAdvPrompt ? combinedPrompt : (customText || name); }
                    body = JSON.stringify(j);
                }

                const res = await (await fetch(`${supabaseUrl}/functions/v1/generate-product-icon`, { method: 'POST', headers, body })).json();
                if (!res.success) throw new Error(res.error || 'Generering fejlede');

                aiResultUrl = res.library_icon_url || res.icon_signed_url || res.icon_url;
                resultImg.src = aiResultUrl;
                resultEl.style.display = 'block';
                const labels = [];
                if (res.style) labels.push(res.style === 'clay' ? '🏺 Clay' : res.style === 'pixar' ? '🎬 Pixar' : '✍️ Fri prompt');
                if (res.mode) {
                    const m = { 'photo-reference':'📷 Reference','photo-motiv':'🖼️ Motiv','photo-avatar':'👤 Avatar','photo-portrait':'🍽️ Mad Portræt','text':'✏️ Tekst','custom-photo':'🎨 Fri prompt','custom-text':'🎨 Fri prompt' };
                    labels.push(m[res.mode] || res.mode);
                }
                resultLabel.textContent = labels.join(' · ');
                updatePreview(aiResultUrl, labels.join(' · '));
                updateSaveEnabled();
                playSound?.('success');

                if (isProductMode && productId) {
                    onResult({ type: 'ai', url: res.icon_signed_url || res.icon_url, storagePath: res.icon_storage_path, updatedAt: res.icon_updated_at, metadata: { style: selectedStyle, photoMode: selectedPhotoMode } });
                }
            } catch (err) {
                console.error('[AI Generate]', err);
                showCustomAlert?.('AI Fejl', err.message || 'Generering fejlede');
                playSound?.('error');
                generateBtn.style.display = 'block';
            } finally {
                clearInterval(loadingInterval);
                loadingEl.style.display = 'none';
                if (!aiResultUrl) generateBtn.style.display = 'block';
                isGenerating = false;
            }
        }

        generateBtn?.addEventListener('click', handleGenerate);
        retryBtn?.addEventListener('click', () => { resultEl.style.display = 'none'; generateBtn.style.display = 'block'; handleGenerate(); });

        // If editing existing icon, pre-load as reference
        if (isEditMode && editingIcon) {
            selectedPhotoMode = 'portrait';
            modeCards.forEach(c => c.classList.toggle('active', c.dataset.mode === 'portrait'));
            modeDesc.textContent = PHOTO_MODE_DESCS.portrait;
            // Hide photo remove and actions
            photoRemove.style.display = 'none';
            photoActions.style.display = 'none';
            photoImg.src = editingIcon.icon_url;
            photoPreview.style.display = 'flex';
            enableModeSection(modeSection);
            fetch(editingIcon.icon_url).then(r => r.blob()).then(blob => {
                aiPhotoFile = new File([blob], 'ref.webp', { type: 'image/webp' });
                updateAdvancedPrompts();
            }).catch(err => console.error('[fetchEditIcon]', err));
        }
    }

    // ─── Shared: inject photo into AI tab from camera tab ───
    function showAiPhotoPreview(file) {
        aiPhotoFile = file;
        const photoPreview = contentZone.querySelector('#pip-photo-preview');
        const photoImg = contentZone.querySelector('#pip-photo-img');
        const photoActions = contentZone.querySelector('#pip-photo-actions');
        const modeSection = contentZone.querySelector('#pip-mode-section');
        if (photoImg) photoImg.src = URL.createObjectURL(file);
        if (photoPreview) photoPreview.style.display = 'flex';
        if (photoActions) photoActions.style.display = 'none';
        if (modeSection && selectedStyle !== 'custom') enableModeSection(modeSection);
    }

    // ─── Initial render ───
    renderSourceZone();
    renderContent();
}
