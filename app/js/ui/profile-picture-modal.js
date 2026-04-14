/**
 * profile-picture-modal.js
 * Full-screen modal for setting a user's profile picture.
 * Sub-views: Upload, Camera, Library.
 */

import { AVATAR_URLS } from './avatar-picker.js?v=3.0.78';
import { processImageForProfilePicture, uploadProfilePicture, saveLibraryProfilePicture, fetchUserProfilePictures } from '../core/profile-picture-utils.js?v=3.0.78';
import { getProfilePictureUrl, invalidateProfilePictureCache } from '../core/profile-picture-cache.js?v=3.0.78';
import { escapeHtml } from '../core/escape-html.js?v=3.0.78';
import { supabaseClient, SUPABASE_URL } from '../core/config-and-supabase.js?v=3.0.78';
import { fetchInstitutionIconLibrary } from '../core/product-icon-utils.js?v=3.0.78';

/**
 * Open the profile picture modal for a given user.
 * @param {Object} user - The user object (must have id, name, number, institution_id, profile_picture_url, profile_picture_type)
 * @param {Object} options
 * @param {Function} options.onSaved - Called with updated user fields after successful save
 * @param {Function} [options.showCustomAlert] - Alert function
 */
export async function openProfilePictureModal(user, options = {}) {
    const { onSaved, showCustomAlert } = options;
    const inst = window.__flangoGetInstitutionById?.(user.institution_id);
    if (!inst) return;

    let allowedTypes = inst.profile_picture_types || ['upload', 'camera', 'library'];

    // On/off styres af institutions-felter (profile_picture_types array + ai_provider_* booleans).
    // Lås-enforcement sker server-side via DB trigger (enforce_feature_locks_institutions).

    // Build overlay
    const overlay = document.createElement('div');
    overlay.className = 'profile-pic-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'profile-pic-modal';

    // Header
    const numberStr = user.number ? ` (${user.number})` : '';
    modal.innerHTML = `
        <div class="profile-pic-modal-header">
            <h3>Profilbillede — ${escapeHtml(user.name)}${numberStr}</h3>
            <button class="profile-pic-modal-close">&times;</button>
        </div>
        <div id="pp-current-section"></div>
        <hr class="profile-pic-divider">
        <div class="profile-pic-type-label">Vælg type:</div>
        <div class="profile-pic-type-grid" id="pp-type-grid"></div>
        <div id="pp-subview"></div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close handlers
    const close = () => {
        stopCamera();
        overlay.remove();
    };
    modal.querySelector('.profile-pic-modal-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    // Current picture section
    const currentSection = modal.querySelector('#pp-current-section');
    await renderCurrentPicture(currentSection, user);

    // Permission status line
    const permSection = document.createElement('div');
    permSection.style.cssText = 'padding:8px 16px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;color:#94a3b8;';
    permSection.innerHTML = `<span style="font-weight:600;margin-right:4px;">Tilladelser:</span>`;

    const permItems = [
        { label: 'Upload/Aula', optOut: user.profile_picture_opt_out_aula },
        { label: 'Kamera', optOut: user.profile_picture_opt_out_camera },
        { label: 'AI-Avatar', optOut: user.profile_picture_opt_out_ai || !inst.profile_pictures_ai_enabled },
    ];
    for (const p of permItems) {
        const span = document.createElement('span');
        span.style.cssText = `padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;${p.optOut ? 'background:rgba(239,68,68,0.15);color:#ef4444;' : 'background:rgba(34,197,94,0.15);color:#22c55e;'}`;
        span.textContent = `${p.optOut ? '❌' : '✅'} ${p.label}`;
        permSection.appendChild(span);
    }
    modal.querySelector('#pp-current-section').after(permSection);

    // Type buttons
    const typeGrid = modal.querySelector('#pp-type-grid');
    const typeConfig = [
        { key: 'upload', icon: '📁', label: 'Upload', optOutField: 'profile_picture_opt_out_aula' },
        { key: 'camera', icon: '📷', label: 'Kamera', optOutField: 'profile_picture_opt_out_camera' },
        { key: 'library', icon: '🎨', label: 'Bibliotek' },
        { key: 'icons', icon: '🖼️', label: 'Ikoner' },
        { key: 'ai_avatar', icon: '🤖', label: 'AI-Avatar', requiresAi: true, optOutField: 'profile_picture_opt_out_ai' },
    ];

    const subview = modal.querySelector('#pp-subview');
    let activeType = null;
    let cameraStream = null;

    function stopCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(t => t.stop());
            cameraStream = null;
        }
    }

    let preSelectDone = false;
    const preSelectType = options.preSelectType || null;
    const referenceImageUrl = options.referenceImageUrl || null;

    for (const tc of typeConfig) {
        // Skip types not enabled by institution (except icons which always show, and ai_avatar which uses its own flag)
        if (tc.key !== 'icons' && tc.key !== 'ai_avatar' && !allowedTypes.includes(tc.key)) continue;
        if (tc.requiresAi && !inst.profile_pictures_ai_enabled) {
            // Show as disabled with explanation
            const btn = document.createElement('button');
            btn.className = 'profile-pic-type-btn pp-type-disabled';
            btn.innerHTML = `<span class="type-icon">${tc.icon}</span>${tc.label}<div class="pp-type-disabled-reason">Ikke aktiveret</div>`;
            btn.style.cssText = 'opacity:0.4;pointer-events:none;position:relative;';
            typeGrid.appendChild(btn);
            continue;
        }

        // Check parent opt-out
        const isOptedOut = tc.optOutField && user[tc.optOutField];

        const btn = document.createElement('button');
        btn.className = 'profile-pic-type-btn' + (isOptedOut ? ' pp-type-disabled' : '');

        if (isOptedOut) {
            btn.innerHTML = `<span class="type-icon">${tc.icon}</span>${tc.label}<div class="pp-type-disabled-reason">Fravalgt af forælder</div>`;
            btn.style.cssText = 'opacity:0.4;pointer-events:none;position:relative;';
        } else {
            btn.innerHTML = `<span class="type-icon">${tc.icon}</span>${tc.label}`;
            btn.addEventListener('click', () => {
                stopCamera();
                typeGrid.querySelectorAll('.profile-pic-type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeType = tc.key;

                if (tc.key === 'upload') renderUploadView(subview, user, inst, close, onSaved);
                else if (tc.key === 'camera') renderCameraView(subview, user, inst, close, onSaved, (s) => { cameraStream = s; });
                else if (tc.key === 'library') renderLibraryView(subview, user, close, onSaved);
                else if (tc.key === 'icons') renderIconLibraryView(subview, user, close, onSaved);
                else if (tc.key === 'ai_avatar') renderAiAvatarView(subview, user, inst, close, onSaved, (s) => { cameraStream = s; });
            });
        }
        typeGrid.appendChild(btn);

        // Auto-select pre-selected type
        if (!preSelectDone && preSelectType && tc.key === preSelectType && !isOptedOut) {
            preSelectDone = true;
            setTimeout(() => btn.click(), 100);
        }
    }

    // If AI avatar was pre-selected with a reference image, pass URL for renderAiAvatarView to fetch
    if (preSelectType === 'ai_avatar' && referenceImageUrl) {
        window.__ppAiReferenceUrl = referenceImageUrl;
    }
}

// === Current Picture Section ===

async function renderCurrentPicture(container, user) {
    const hasPic = user.profile_picture_url && !user.profile_picture_opt_out;
    if (!hasPic) {
        container.innerHTML = `
            <div class="profile-pic-current">
                <span class="profile-pic-current-placeholder">📷</span>
                <div class="profile-pic-current-info">Intet profilbillede sat</div>
            </div>`;
        return;
    }

    const typeLabel = { upload: 'Uploadet billede', camera: 'Kamera-foto', library: 'Avatar fra bibliotek', icon: 'Ikon fra bibliotek', ai_avatar: 'AI-Avatar' }[user.profile_picture_type] || '';

    container.innerHTML = `
        <div class="profile-pic-current">
            <span class="profile-pic-current-placeholder" id="pp-current-img-wrap">⏳</span>
            <div class="profile-pic-current-info">
                <strong>${escapeHtml(user.name)}</strong> har: ${typeLabel}
            </div>
        </div>`;

    // Load image async
    const url = await getProfilePictureUrl(user);
    const wrap = container.querySelector('#pp-current-img-wrap');
    if (url && wrap) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = '';
        img.className = 'profile-pic-current-img';
        wrap.replaceWith(img);
    }
}

// === Upload Sub-view ===

function renderUploadView(container, user, inst, closeModal, onSaved) {
    container.innerHTML = `
        <div class="profile-pic-subview">
            <div class="profile-pic-upload-area" id="pp-upload-dropzone">
                <span class="upload-icon">📁</span>
                <span class="upload-text">Klik for at vælge billede</span>
                <input type="file" accept="image/*" id="pp-upload-input" style="display:none;">
            </div>
            <div id="pp-upload-preview" style="display:none;"></div>
        </div>`;

    const dropzone = container.querySelector('#pp-upload-dropzone');
    const fileInput = container.querySelector('#pp-upload-input');
    const previewArea = container.querySelector('#pp-upload-preview');

    dropzone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        dropzone.style.display = 'none';
        previewArea.style.display = 'block';
        previewArea.innerHTML = `<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Behandler billede...</div>`;

        try {
            const blob = await processImageForProfilePicture(file);
            const previewUrl = URL.createObjectURL(blob);

            previewArea.innerHTML = `
                <div class="profile-pic-preview-container">
                    <img src="${previewUrl}" alt="Preview" class="profile-pic-preview-img">
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-upload-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-upload-retry">Vælg andet</button>
                    </div>
                </div>`;

            previewArea.querySelector('#pp-upload-save').addEventListener('click', async () => {
                previewArea.innerHTML = `<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Uploader...</div>`;
                const result = await uploadProfilePicture(blob, user.institution_id, user.id, 'upload', user.name);
                URL.revokeObjectURL(previewUrl);

                if (result.success) {
                    user.profile_picture_url = result.storagePath || `${user.institution_id}/${user.id}.webp`;
                    user.profile_picture_type = 'upload';
                    if (onSaved) onSaved({ profile_picture_url: user.profile_picture_url, profile_picture_type: 'upload' });
                    closeModal();
                } else {
                    previewArea.innerHTML = `<div style="color:#f87171;text-align:center;">${escapeHtml(result.error || 'Upload fejlede')}</div>`;
                }
            });

            previewArea.querySelector('#pp-upload-retry').addEventListener('click', () => {
                URL.revokeObjectURL(previewUrl);
                previewArea.style.display = 'none';
                dropzone.style.display = 'flex';
                fileInput.value = '';
            });
        } catch (err) {
            previewArea.innerHTML = `<div style="color:#f87171;text-align:center;">Fejl: ${escapeHtml(err.message)}</div>`;
        }
    });
}

// === Camera Sub-view ===

function renderCameraView(container, user, inst, closeModal, onSaved, setStream) {
    container.innerHTML = `
        <div class="profile-pic-subview">
            <div class="profile-pic-camera-container" id="pp-camera-wrap">
                <video id="pp-camera-video" class="profile-pic-camera-video" autoplay playsinline muted></video>
            </div>
            <div class="profile-pic-camera-actions">
                <button class="profile-pic-capture-btn" id="pp-capture-btn" disabled></button>
            </div>
            <div id="pp-camera-preview" style="display:none;"></div>
            <div id="pp-camera-status" class="profile-pic-loading" style="text-align:center;margin-top:8px;">
                <span class="profile-pic-spinner"></span> Starter kamera...
            </div>
        </div>`;

    const video = container.querySelector('#pp-camera-video');
    const captureBtn = container.querySelector('#pp-capture-btn');
    const previewArea = container.querySelector('#pp-camera-preview');
    const statusEl = container.querySelector('#pp-camera-status');
    const cameraWrap = container.querySelector('#pp-camera-wrap');

    // Try front camera first (for face photos)
    navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 800 }, height: { ideal: 800 } }
    }).then(stream => {
        setStream(stream);
        video.srcObject = stream;
        captureBtn.disabled = false;
        statusEl.style.display = 'none';
    }).catch(err => {
        statusEl.innerHTML = `<span style="color:#f87171;">Kunne ikke starte kamera: ${escapeHtml(err.message)}</span>`;
        captureBtn.style.display = 'none';
    });

    captureBtn.addEventListener('click', async () => {
        // Capture frame
        const canvas = document.createElement('canvas');
        const size = Math.min(video.videoWidth, video.videoHeight);
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');

        // Center-crop from video (mirrored)
        // 1.3x zoom crop for closer framing
        const cropSize = Math.round(size / 1.3);
        const sx = (video.videoWidth - cropSize) / 2;
        const sy = (video.videoHeight - cropSize) / 2;
        // Flip horizontal to match mirror view
        ctx.translate(400, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, 400, 400);

        canvas.toBlob(async (blob) => {
            if (!blob) return;

            // Stop camera and show preview
            cameraWrap.style.display = 'none';
            captureBtn.parentElement.style.display = 'none';
            previewArea.style.display = 'block';

            const processedBlob = await processImageForProfilePicture(new File([blob], 'camera.jpg', { type: 'image/jpeg' }));
            const previewUrl = URL.createObjectURL(processedBlob);

            previewArea.innerHTML = `
                <div class="profile-pic-preview-container">
                    <img src="${previewUrl}" alt="Preview" class="profile-pic-preview-img">
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-camera-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-camera-retry">Tag nyt foto</button>
                    </div>
                </div>`;

            previewArea.querySelector('#pp-camera-save').addEventListener('click', async () => {
                previewArea.innerHTML = `<div class="profile-pic-loading"><span class="profile-pic-spinner"></span> Uploader...</div>`;
                const result = await uploadProfilePicture(processedBlob, user.institution_id, user.id, 'camera', user.name);
                URL.revokeObjectURL(previewUrl);

                if (result.success) {
                    user.profile_picture_url = result.storagePath || `${user.institution_id}/${user.id}.webp`;
                    user.profile_picture_type = 'camera';
                    if (onSaved) onSaved({ profile_picture_url: user.profile_picture_url, profile_picture_type: 'camera' });
                    closeModal();
                } else {
                    previewArea.innerHTML = `<div style="color:#f87171;text-align:center;">${escapeHtml(result.error || 'Upload fejlede')}</div>`;
                }
            });

            previewArea.querySelector('#pp-camera-retry').addEventListener('click', () => {
                URL.revokeObjectURL(previewUrl);
                previewArea.style.display = 'none';
                cameraWrap.style.display = 'block';
                captureBtn.parentElement.style.display = 'flex';
            });
        }, 'image/jpeg', 0.9);
    });
}

// === Library Sub-view ===

function renderLibraryView(container, user, closeModal, onSaved) {
    let selectedUrl = null;

    const gridHtml = AVATAR_URLS.map((url, i) => `
        <div class="profile-pic-library-item" data-avatar-index="${i}" data-avatar-url="${url}">
            <img src="${url}" alt="Avatar ${i + 1}" loading="lazy">
        </div>
    `).join('');

    container.innerHTML = `
        <div class="profile-pic-subview">
            <div class="profile-pic-library-scroll"><div class="profile-pic-library-grid">${gridHtml}</div></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
                <button class="profile-pic-btn profile-pic-btn-primary" id="pp-library-save" disabled>Gem</button>
            </div>
        </div>`;

    const saveBtn = container.querySelector('#pp-library-save');
    const items = container.querySelectorAll('.profile-pic-library-item');

    items.forEach(item => {
        item.addEventListener('click', () => {
            items.forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            selectedUrl = item.dataset.avatarUrl;
            saveBtn.disabled = false;
        });
    });

    saveBtn.addEventListener('click', async () => {
        if (!selectedUrl) return;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Gemmer...';

        const result = await saveLibraryProfilePicture(user.id, selectedUrl, 'library', { institutionId: user.institution_id, userName: user.name });
        if (result.success) {
            user.profile_picture_url = selectedUrl;
            user.profile_picture_type = 'library';
            if (onSaved) onSaved({ profile_picture_url: selectedUrl, profile_picture_type: 'library' });
            closeModal();
        } else {
            saveBtn.textContent = 'Gem';
            saveBtn.disabled = false;
            const errEl = document.createElement('div');
            errEl.style.cssText = 'color:#f87171;text-align:center;margin-top:8px;font-size:12px;';
            errEl.textContent = result.error || 'Kunne ikke gemme';
            container.querySelector('.profile-pic-subview').appendChild(errEl);
        }
    });
}

// === Icon Library Sub-view ===

async function renderIconLibraryView(container, user, closeModal, onSaved) {
    container.innerHTML = `
        <div class="profile-pic-subview">
            <div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">Henter ikoner...</div>
        </div>`;

    const icons = await fetchInstitutionIconLibrary(user.institution_id);

    if (!icons || icons.length === 0) {
        container.innerHTML = `
            <div class="profile-pic-subview">
                <div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">
                    Ingen ikoner i biblioteket endnu.<br>Tilføj ikoner via Ikonbiblioteket i admin.
                </div>
            </div>`;
        return;
    }

    let selectedUrl = null;
    let selectedSource = null;

    const gridHtml = icons.map((icon, i) => `
        <div class="profile-pic-library-item" data-icon-index="${i}" data-icon-url="${escapeHtml(icon.icon_url)}" data-icon-source="${escapeHtml(icon.source || 'uploaded')}">
            <img src="${escapeHtml(icon.icon_url)}" alt="${escapeHtml(icon.name || '')}" loading="lazy">
            ${icon.name ? `<div style="font-size:10px;color:#6B6860;margin-top:4px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${escapeHtml(icon.name)}</div>` : ''}
        </div>
    `).join('');

    container.innerHTML = `
        <div class="profile-pic-subview">
            <div class="profile-pic-library-scroll"><div class="profile-pic-library-grid">${gridHtml}</div></div>
            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
                <button class="profile-pic-btn profile-pic-btn-primary" id="pp-icon-save" disabled>Gem</button>
            </div>
        </div>`;

    const saveBtn = container.querySelector('#pp-icon-save');
    const items = container.querySelectorAll('.profile-pic-library-item');

    items.forEach(item => {
        item.addEventListener('click', () => {
            items.forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            selectedUrl = item.dataset.iconUrl;
            selectedSource = item.dataset.iconSource;
            saveBtn.disabled = false;
        });
    });

    saveBtn.addEventListener('click', async () => {
        if (!selectedUrl) return;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Gemmer...';

        const iconType = selectedSource === 'ai_generated' ? 'ai_avatar' : 'icon';
        const result = await saveLibraryProfilePicture(user.id, selectedUrl, iconType, { institutionId: user.institution_id, userName: user.name });
        if (result.success) {
            user.profile_picture_url = selectedUrl;
            user.profile_picture_type = iconType;
            if (onSaved) onSaved({ profile_picture_url: selectedUrl, profile_picture_type: iconType });
            closeModal();
        } else {
            saveBtn.textContent = 'Gem';
            saveBtn.disabled = false;
            const errEl = document.createElement('div');
            errEl.style.cssText = 'color:#f87171;text-align:center;margin-top:8px;font-size:12px;';
            errEl.textContent = result.error || 'Kunne ikke gemme';
            container.querySelector('.profile-pic-subview').appendChild(errEl);
        }
    });
}

// === AI-Avatar Sub-view ===

// AI Avatar prompt presets
const AI_AVATAR_BG = 'Plain warm beige background (#F5EDE0), smooth and uniform with no gradients or patterns.';
const AI_AVATAR_HAT_PROMPT = `IMPORTANT: The person MUST be wearing a tall white classic chef's toque (traditional puffed chef hat, tall and cylindrical with pleats). The hat has a thin headband with a small orange fruit logo (an orange/tangerine). The chef hat must be prominent, clearly visible on top of the head, and take up significant space in the image. Do NOT skip the hat.`;
const AI_AVATAR_HAT_PATH = 'Icons/webp/Function/Flango-Kokkehue.webp';
const AI_AVATAR_HERO_PROMPT = `The person is depicted as a superhero. They wear a vibrant superhero cape and suit with the Flango orange fruit logo on the chest. Heroic confident pose, dynamic lighting with subtle glow effects. The costume colors should complement the person's features. Keep the face highly recognizable.`;

const AI_AVATAR_AGE = 'CRITICAL: Preserve the exact age of the person — this is a child. Do NOT age them up or make them look older. Keep youthful proportions: rounder face, larger eyes relative to face, softer features. The result must look like a child, not a teenager or adult.';

const AI_AVATAR_PRESETS = [
    {
        key: 'pixar',
        label: '🎬 Pixar',
        prompt: `Create a Pixar-style 3D animated portrait based on the person in the photo. Closely match their actual facial structure, face shape, nose, jawline, hair color, hair style, eye color, eye shape, eyebrows, and skin tone. The character should be clearly recognizable as the same person. ${AI_AVATAR_AGE} Use soft studio lighting, subtle subsurface scattering on skin. Head-and-shoulders framing. ${AI_AVATAR_BG}`,
        fluxPrompt: `Transform into a Pixar-style 3D animated character. Match features closely. ${AI_AVATAR_AGE} Soft studio lighting. ${AI_AVATAR_BG}`,
    },
    {
        key: 'clay',
        label: '🏺 Clay-figur',
        prompt: `Create a 3D clay-animated portrait based on the person in the photo. Closely match their actual facial structure, face shape, hair color, hair style, eye color, skin tone, and expression. Rounded puffy shapes, smooth matte clay texture with visible soft material quality. The figurine should be clearly recognizable as the same person. ${AI_AVATAR_AGE} Head-and-shoulders framing. ${AI_AVATAR_BG}`,
        fluxPrompt: `Transform into a 3D clay figurine. Rounded puffy shapes, smooth matte clay texture. Match features closely. ${AI_AVATAR_AGE} ${AI_AVATAR_BG}`,
    },
    {
        key: 'cartoon',
        label: '✏️ Tegneserie',
        prompt: `Create a cartoon-style portrait based on the person in the photo. Closely match their actual face shape, hair color, hair style, eye color, skin tone, and distinguishing features. Use clean outlines, vibrant but natural colors. The character should be clearly recognizable as the same person, not a generic cartoon. ${AI_AVATAR_AGE} Head-and-shoulders framing. ${AI_AVATAR_BG}`,
        fluxPrompt: `Transform into a cartoon character. Clean outlines, vibrant colors. Match features closely, not a generic cartoon. ${AI_AVATAR_AGE} ${AI_AVATAR_BG}`,
    },
    {
        key: 'realistic',
        label: '🎨 Illustration',
        prompt: `Create a semi-realistic digital illustration portrait based on the person in the photo. Closely match their actual facial proportions, face shape, hair color, hair style, eye color, skin tone, and expression. Soft painterly brush strokes, warm lighting, slightly stylized but highly recognizable. ${AI_AVATAR_AGE} Head-and-shoulders framing. ${AI_AVATAR_BG}`,
        fluxPrompt: `Transform into a semi-realistic digital illustration. Soft painterly style, warm lighting. Match features closely. ${AI_AVATAR_AGE} ${AI_AVATAR_BG}`,
    },
];

function renderAiAvatarView(container, user, inst, closeModal, onSaved, setStream) {
    let selectedPreset = AI_AVATAR_PRESETS[0];
    let advancedOpen = false;
    let customPrompt = selectedPreset.prompt;
    let customFluxPrompt = selectedPreset.fluxPrompt || '';
    let viewingProvider = 'openai'; // which prompt is shown in textarea
    let referenceBlob = window.__ppAiReferenceBlob || null;
    let hatEnabled = false;
    let heroEnabled = false;
    const pendingReferenceUrl = window.__ppAiReferenceUrl || null;

    // Clear global references after pickup
    delete window.__ppAiReferenceBlob;
    delete window.__ppAiReferenceUrl;

    container.innerHTML = `
        <div class="profile-pic-subview">
            <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;padding:10px;background:rgba(245,158,11,0.1);border-radius:8px;border:1px solid rgba(245,158,11,0.2);">
                Vælg et referencebillede. Billedet sendes til OpenAI for at generere en avatar. <strong>Billedet slettes straks efter.</strong>
            </div>

            <div style="font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:6px;">Vælg referencebillede</div>
            <div id="pp-ai-methods" style="display:flex;gap:8px;margin-bottom:12px;">
                <button type="button" id="pp-ai-method-camera" style="flex:1;padding:10px 8px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);border-radius:10px;cursor:pointer;text-align:center;transition:all 0.15s;">
                    <div style="font-size:20px;margin-bottom:2px;">📷</div>
                    <div style="font-size:11px;font-weight:600;color:#e2e8f0;">Kamera</div>
                </button>
                <button type="button" id="pp-ai-method-upload" style="flex:1;padding:10px 8px;border:2px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);border-radius:10px;cursor:pointer;text-align:center;transition:all 0.15s;">
                    <div style="font-size:20px;margin-bottom:2px;">📤</div>
                    <div style="font-size:11px;font-weight:600;color:#e2e8f0;">Upload</div>
                </button>
            </div>
            <div id="pp-ai-source-grid" style="display:flex;gap:10px;overflow-x:auto;padding:4px;">
                <div style="color:#94a3b8;font-size:11px;padding:16px;">Henter billeder...</div>
            </div>

            <div id="pp-ai-camera-section" style="display:none;">
                <div class="profile-pic-camera-container" id="pp-ai-camera-wrap">
                    <video id="pp-ai-camera-video" class="profile-pic-camera-video" autoplay playsinline muted></video>
                </div>
                <div class="profile-pic-camera-actions">
                    <button class="profile-pic-capture-btn" id="pp-ai-capture-btn" disabled></button>
                </div>
                <div id="pp-ai-cam-status" class="profile-pic-loading" style="text-align:center;margin-top:8px;">
                    <span class="profile-pic-spinner"></span> Starter kamera...
                </div>
            </div>

            <div id="pp-ai-preview" style="display:none;"></div>

            <div id="pp-ai-options" style="display:none;">
                <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:16px 0 12px;">
                <div style="margin-bottom:12px;">
                    <div style="font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:6px;">Vælg stil</div>
                    <div id="pp-ai-presets" style="display:flex;gap:6px;flex-wrap:wrap;">
                        ${AI_AVATAR_PRESETS.map(p => `
                            <button type="button" class="pp-ai-preset-btn" data-preset="${p.key}" style="padding:6px 12px;border:2px solid ${p.key === selectedPreset.key ? '#f59e0b' : 'rgba(255,255,255,0.1)'};background:${p.key === selectedPreset.key ? 'rgba(245,158,11,0.1)' : 'transparent'};border-radius:8px;cursor:pointer;font-size:11px;font-weight:600;color:${p.key === selectedPreset.key ? '#f59e0b' : '#94a3b8'};transition:all 0.15s;">${p.label}</button>
                        `).join('')}
                    </div>
                </div>

                <div style="margin-bottom:12px;">
                    <label id="pp-ai-hat-toggle" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 12px;border:2px solid rgba(255,255,255,0.1);border-radius:8px;transition:all 0.15s;">
                        <input type="checkbox" id="pp-ai-hat-checkbox" style="width:16px;height:16px;accent-color:#f59e0b;">
                        <img src="${AI_AVATAR_HAT_PATH}" alt="" style="width:28px;height:28px;object-fit:contain;">
                        <div>
                            <div style="font-size:12px;font-weight:600;color:#e2e8f0;">Ekspedient Stil</div>
                            <div style="font-size:10px;color:#94a3b8;">Tilføj Flango-kokkehue</div>
                        </div>
                    </label>
                    <label id="pp-ai-hero-toggle" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 12px;border:2px solid rgba(255,255,255,0.1);border-radius:8px;transition:all 0.15s;margin-top:6px;">
                        <input type="checkbox" id="pp-ai-hero-checkbox" style="width:16px;height:16px;accent-color:#8b5cf6;">
                        <div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:22px;">🦸</div>
                        <div>
                            <div style="font-size:12px;font-weight:600;color:#e2e8f0;">Super Hero</div>
                            <div style="font-size:10px;color:#a78bfa;">Kun for legendariske ekspedienter</div>
                        </div>
                    </label>
                </div>

                <div id="pp-ai-advanced-section">
                    <button type="button" id="pp-ai-advanced-toggle" style="background:none;border:none;color:#94a3b8;font-size:12px;cursor:pointer;padding:4px 0;">
                        <span id="pp-ai-adv-arrow" style="display:inline-block;transition:transform 0.2s;">▶</span> Avanceret — redigér prompt
                    </button>
                    <div id="pp-ai-prompt-section" style="display:none;margin-top:8px;">
                        <div style="display:flex;gap:4px;margin-bottom:6px;">
                            <button type="button" class="pp-ai-provider-tab" data-provider="openai" style="flex:1;padding:5px 8px;border:1px solid rgba(16,185,129,0.4);background:rgba(16,185,129,0.1);border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;color:#10b981;">OpenAI</button>
                            <button type="button" class="pp-ai-provider-tab" data-provider="flux" style="flex:1;padding:5px 8px;border:1px solid rgba(255,255,255,0.1);background:transparent;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;color:#94a3b8;">FLUX</button>
                        </div>
                        <textarea id="pp-ai-prompt-textarea" style="width:100%;min-height:80px;padding:8px 12px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:12px;font-family:inherit;resize:vertical;box-sizing:border-box;background:rgba(255,255,255,0.04);color:inherit;">${escapeHtml(selectedPreset.prompt)}</textarea>
                        <button type="button" id="pp-ai-reset-prompt" style="background:none;border:none;color:#1a8a6e;font-size:11px;cursor:pointer;padding:2px 0;margin-top:4px;">↺ Nulstil til preset</button>
                    </div>
                </div>
            </div>

            <input type="file" id="pp-ai-file-input" accept="image/*" style="display:none;">
        </div>`;

    // --- Shared elements ---
    const previewArea = container.querySelector('#pp-ai-preview');
    const optionsSection = container.querySelector('#pp-ai-options');
    const cameraSection = container.querySelector('#pp-ai-camera-section');
    const sourceGrid = container.querySelector('#pp-ai-source-grid');
    const fileInput = container.querySelector('#pp-ai-file-input');
    const methodsRow = container.querySelector('#pp-ai-methods');

    // --- Method buttons (camera + upload) ---
    container.querySelector('#pp-ai-method-camera')?.addEventListener('click', openCamera);
    container.querySelector('#pp-ai-method-upload')?.addEventListener('click', () => fileInput.click());

    // --- Preset selection ---
    const presetBtns = container.querySelectorAll('.pp-ai-preset-btn');
    const promptTextarea = container.querySelector('#pp-ai-prompt-textarea');

    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = AI_AVATAR_PRESETS.find(p => p.key === btn.dataset.preset);
            if (!preset) return;
            selectedPreset = preset;
            customPrompt = preset.prompt;
            customFluxPrompt = preset.fluxPrompt || '';
            promptEdited = false;
            if (promptTextarea) promptTextarea.value = viewingProvider === 'flux' ? customFluxPrompt : customPrompt;
            presetBtns.forEach(b => {
                const isActive = b.dataset.preset === preset.key;
                b.style.borderColor = isActive ? '#f59e0b' : 'rgba(255,255,255,0.1)';
                b.style.background = isActive ? 'rgba(245,158,11,0.1)' : 'transparent';
                b.style.color = isActive ? '#f59e0b' : '#94a3b8';
            });
        });
    });

    // --- Advanced toggle ---
    const advToggle = container.querySelector('#pp-ai-advanced-toggle');
    const advArrow = container.querySelector('#pp-ai-adv-arrow');
    const promptSection = container.querySelector('#pp-ai-prompt-section');
    const resetBtn = container.querySelector('#pp-ai-reset-prompt');

    advToggle?.addEventListener('click', () => {
        advancedOpen = !advancedOpen;
        if (advArrow) advArrow.style.transform = advancedOpen ? 'rotate(90deg)' : '';
        if (promptSection) promptSection.style.display = advancedOpen ? 'block' : 'none';
    });
    let promptEdited = false;
    promptTextarea?.addEventListener('input', () => {
        if (viewingProvider === 'flux') {
            customFluxPrompt = promptTextarea.value;
        } else {
            customPrompt = promptTextarea.value;
        }
        promptEdited = true;
    });
    resetBtn?.addEventListener('click', () => {
        customPrompt = selectedPreset.prompt;
        customFluxPrompt = selectedPreset.fluxPrompt || '';
        promptEdited = false;
        if (promptTextarea) promptTextarea.value = viewingProvider === 'flux' ? customFluxPrompt : customPrompt;
    });

    // --- Provider tabs (switch prompt view) ---
    const providerTabs = container.querySelectorAll('.pp-ai-provider-tab');
    providerTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            viewingProvider = tab.dataset.provider;
            providerTabs.forEach(t => {
                const isActive = t.dataset.provider === viewingProvider;
                const color = t.dataset.provider === 'flux' ? '#6366f1' : '#10b981';
                t.style.borderColor = isActive ? `${color}66` : 'rgba(255,255,255,0.1)';
                t.style.background = isActive ? `${color}1a` : 'transparent';
                t.style.color = isActive ? color : '#94a3b8';
            });
            if (promptTextarea) {
                promptTextarea.value = viewingProvider === 'flux' ? customFluxPrompt : customPrompt;
            }
        });
    });

    // --- Hat toggle ---
    const hatCheckbox = container.querySelector('#pp-ai-hat-checkbox');
    const hatToggle = container.querySelector('#pp-ai-hat-toggle');
    hatCheckbox?.addEventListener('change', () => {
        hatEnabled = hatCheckbox.checked;
        if (hatToggle) {
            hatToggle.style.borderColor = hatEnabled ? '#f59e0b' : 'rgba(255,255,255,0.1)';
            hatToggle.style.background = hatEnabled ? 'rgba(245,158,11,0.08)' : 'transparent';
        }
    });

    // --- Hero toggle ---
    const heroCheckbox = container.querySelector('#pp-ai-hero-checkbox');
    const heroToggle = container.querySelector('#pp-ai-hero-toggle');
    heroCheckbox?.addEventListener('change', () => {
        heroEnabled = heroCheckbox.checked;
        if (heroToggle) {
            heroToggle.style.borderColor = heroEnabled ? '#8b5cf6' : 'rgba(255,255,255,0.1)';
            heroToggle.style.background = heroEnabled ? 'rgba(139,92,246,0.08)' : 'transparent';
        }
    });

    // --- Show reference preview + generate button ---
    function showReferencePreview(blob, label) {
        referenceBlob = blob;
        cameraSection.style.display = 'none';
        sourceGrid.style.display = 'none';
        if (methodsRow) methodsRow.style.display = 'none';
        previewArea.style.display = 'block';
        optionsSection.style.display = 'block';

        const photoUrl = URL.createObjectURL(blob);

        // Check institution DB fields for provider availability
        const showOpenAI = inst.ai_provider_openai !== false; // default true
        const showFlux = !!inst.ai_provider_flux; // default false

        const providerButtons = [];
        if (showOpenAI) providerButtons.push(`<button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-generate-openai" style="background:linear-gradient(135deg,#10b981,#059669);flex:1;">Generer (OpenAI)</button>`);
        if (showFlux) providerButtons.push(`<button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-generate-flux" style="background:linear-gradient(135deg,#6366f1,#4f46e5);flex:1;">Generer (FLUX)</button>`);

        previewArea.innerHTML = `
            <div class="profile-pic-preview-container">
                <img src="${photoUrl}" alt="Reference" class="profile-pic-preview-img" style="border-color:rgba(245,158,11,0.4);">
                <div style="font-size:11px;color:#94a3b8;text-align:center;">${escapeHtml(label)}</div>
                <div class="profile-pic-preview-actions" style="flex-direction:column;gap:8px;">
                    <div style="display:flex;gap:8px;width:100%;">
                        ${providerButtons.join('\n                        ')}
                    </div>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-change-ref" style="width:100%;">Skift billede</button>
                </div>
            </div>`;

        if (showOpenAI) previewArea.querySelector('#pp-ai-generate-openai').addEventListener('click', () => generateAvatar(blob, photoUrl, 'openai'));
        if (showFlux) previewArea.querySelector('#pp-ai-generate-flux').addEventListener('click', () => generateAvatar(blob, photoUrl, 'flux'));
        previewArea.querySelector('#pp-ai-change-ref').addEventListener('click', () => {
            URL.revokeObjectURL(photoUrl);
            referenceBlob = null;
            previewArea.style.display = 'none';
            optionsSection.style.display = 'none';
            sourceGrid.style.display = 'flex';
            if (methodsRow) methodsRow.style.display = 'flex';
        });
    }

    // --- Generate avatar (shared for all sources) ---
    async function generateAvatar(blob, photoUrl, provider = 'openai') {
        const providerLabel = provider === 'flux' ? 'FLUX' : 'OpenAI';
        const timeHint = provider === 'flux' ? '10-30 sek' : '5-15 sek';
        previewArea.innerHTML = `<div class="profile-pic-loading" style="padding:30px;text-align:center;">
            <span class="profile-pic-spinner"></span>
            <div style="margin-top:8px;font-size:13px;">Genererer avatar via ${providerLabel}... (${timeHint})</div>
        </div>`;

        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('Ikke logget ind');
            const adminUserId = session?.user?.id;

            // Build prompt: use the correct prompt for the chosen provider
            let basePrompt = provider === 'flux' ? (customFluxPrompt || selectedPreset.fluxPrompt || '') : (customPrompt || '');
            let finalPrompt = basePrompt;
            if (hatEnabled) {
                finalPrompt += '\n' + AI_AVATAR_HAT_PROMPT;
            }
            if (heroEnabled) {
                finalPrompt += '\n' + AI_AVATAR_HERO_PROMPT;
            }

            const formData = new FormData();
            formData.append('user_id', user.id);
            formData.append('user_name', user.name || '');
            formData.append('photo', new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
            if (finalPrompt) formData.append('custom_prompt', finalPrompt);
            formData.append('ai_style', selectedPreset.key);
            formData.append('ai_provider', provider);
            if (promptEdited) formData.append('prompt_edited', 'true');

            // Send hat reference image if enabled
            if (hatEnabled) {
                try {
                    const hatResp = await fetch(AI_AVATAR_HAT_PATH);
                    const hatBlob = await hatResp.blob();
                    formData.append('hat_image', new File([hatBlob], 'hat.png', { type: 'image/png' }));
                } catch (e) {
                    console.warn('Could not load hat image:', e);
                }
            }

            const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-profile-avatar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'x-admin-user-id': adminUserId },
                body: formData,
            });

            const result = await response.json();
            if (photoUrl) URL.revokeObjectURL(photoUrl);

            if (!result.success) throw new Error(result.error || 'Generering fejlede');

            previewArea.innerHTML = `
                <div class="profile-pic-preview-container">
                    <img src="${result.url}" alt="AI Avatar" class="profile-pic-preview-img" style="border-color:rgba(34,197,94,0.4);">
                    <div style="font-size:12px;color:#22c55e;text-align:center;font-weight:600;">Avatar genereret!</div>
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-save">Gem</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-retry">Prøv igen</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-cancel">Annuller</button>
                    </div>
                </div>`;

            previewArea.querySelector('#pp-ai-save').addEventListener('click', () => {
                user.profile_picture_url = result.storage_path;
                user.profile_picture_type = 'ai_avatar';
                invalidateProfilePictureCache(user.id);
                if (onSaved) onSaved({ profile_picture_url: result.storage_path, profile_picture_type: 'ai_avatar' });
                closeModal();
            });
            previewArea.querySelector('#pp-ai-retry').addEventListener('click', () => {
                previewArea.style.display = 'none';
                optionsSection.style.display = 'none';
                sourceGrid.style.display = 'flex';
            });
            previewArea.querySelector('#pp-ai-cancel').addEventListener('click', closeModal);

        } catch (err) {
            if (photoUrl) URL.revokeObjectURL(photoUrl);
            previewArea.innerHTML = `
                <div style="text-align:center;padding:20px;">
                    <div style="color:#f87171;margin-bottom:12px;">${escapeHtml(err.message)}</div>
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-retry-err">Prøv igen</button>
                </div>`;
            previewArea.querySelector('#pp-ai-retry-err')?.addEventListener('click', () => {
                previewArea.style.display = 'none';
                optionsSection.style.display = 'none';
                sourceGrid.style.display = 'flex';
            });
        }
    }

    // --- Camera flow ---
    function openCamera() {
        sourceGrid.style.display = 'none';
        if (methodsRow) methodsRow.style.display = 'none';
        cameraSection.style.display = 'block';
        const video = container.querySelector('#pp-ai-camera-video');
        const captureBtn = container.querySelector('#pp-ai-capture-btn');
        const statusEl = container.querySelector('#pp-ai-cam-status');

        navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 800 }, height: { ideal: 800 } }
        }).then(stream => {
            setStream(stream);
            video.srcObject = stream;
            captureBtn.disabled = false;
            statusEl.style.display = 'none';
        }).catch(err => {
            statusEl.innerHTML = `<span style="color:#f87171;">Kunne ikke starte kamera: ${escapeHtml(err.message)}</span>`;
            captureBtn.style.display = 'none';
        });

        captureBtn.onclick = () => {
            const canvas = document.createElement('canvas');
            const size = Math.min(video.videoWidth, video.videoHeight);
            canvas.width = 800; canvas.height = 800;
            const ctx = canvas.getContext('2d');
            // 1.3x zoom crop for closer framing
            const cropSize = Math.round(size / 1.3);
            const sx = (video.videoWidth - cropSize) / 2;
            const sy = (video.videoHeight - cropSize) / 2;
            ctx.translate(800, 0); ctx.scale(-1, 1);
            ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, 800, 800);
            canvas.toBlob((blob) => {
                if (!blob) return;
                showReferencePreview(blob, 'Kamera-foto sendes til AI og slettes straks efter');
            }, 'image/jpeg', 0.9);
        };
    }

    // --- Upload flow ---
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        fileInput.value = '';
        try {
            const processed = await processImageForProfilePicture(file);
            showReferencePreview(processed, 'Uploadet billede sendes til AI og slettes straks efter');
        } catch (err) {
            previewArea.style.display = 'block';
            previewArea.innerHTML = `<div style="color:#f87171;text-align:center;padding:12px;">${escapeHtml(err.message)}</div>`;
        }
    });

    // If reference was pre-injected from lightbox, show preview with generate button immediately
    if (referenceBlob) {
        showReferencePreview(referenceBlob, 'Referencebillede fra bibliotek');
    } else if (pendingReferenceUrl) {
        fetch(pendingReferenceUrl).then(r => r.blob()).then(blob => {
            if (blob) {
                referenceBlob = blob;
                showReferencePreview(blob, 'Referencebillede fra bibliotek');
            }
        }).catch(err => console.warn('[ai-avatar] Kunne ikke hente reference:', err));
    }

    // --- Build source grid with library thumbnails + camera + upload ---
    fetchUserProfilePictures(user.id, user).then(async (entries) => {
        if (!sourceGrid) return;

        // Generate signed URLs for storage-based entries
        const urlMap = new Map();
        const storageEntries = entries.filter(e => e.storage_path && !e.storage_path.startsWith('http') && e.picture_type !== 'library' && e.picture_type !== 'icon');
        if (storageEntries.length > 0) {
            const paths = storageEntries.map(e => e.storage_path);
            const { data: signedData } = await supabaseClient.storage.from('profile-pictures').createSignedUrls(paths, 3600);
            if (signedData) {
                signedData.forEach((item, i) => { if (item.signedUrl) urlMap.set(storageEntries[i].id, item.signedUrl); });
            }
        }

        // Build thumbnails HTML
        const thumbsHtml = entries.map((entry, i) => {
            const url = urlMap.get(entry.id) || entry.storage_path;
            return `<div data-lib-index="${i}" style="flex:0 0 auto;width:64px;text-align:center;cursor:pointer;" title="Brug som reference">
                <img src="${url}" alt="" style="display:block;width:56px;height:56px;max-width:56px;max-height:56px;border-radius:50%;object-fit:cover;border:2px solid transparent;margin:0 auto;transition:border-color 0.2s;">
                <div style="font-size:9px;color:#94a3b8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${entry.picture_type === 'ai_avatar' ? 'AI' : (entry.picture_type || '')}</div>
            </div>`;
        }).join('');

        if (thumbsHtml) {
            sourceGrid.innerHTML = thumbsHtml;
        } else {
            sourceGrid.innerHTML = `<div style="color:#94a3b8;font-size:11px;padding:8px;">Ingen eksisterende billeder. Brug kamera eller upload ovenfor.</div>`;
        }

        // Library thumbnail click → fetch blob → show preview
        sourceGrid.querySelectorAll('[data-lib-index]').forEach(thumb => {
            thumb.addEventListener('click', async () => {
                const idx = parseInt(thumb.dataset.libIndex);
                const entry = entries[idx];
                if (!entry) return;

                // Show loading state
                thumb.querySelector('img').style.borderColor = '#f59e0b';
                try {
                    const url = urlMap.get(entry.id) || entry.storage_path;
                    const resp = await fetch(url);
                    const blob = await resp.blob();
                    sourceGrid.style.display = 'none';
                    showReferencePreview(blob, 'Eksisterende billede sendes til AI og slettes straks efter');
                } catch (err) {
                    thumb.querySelector('img').style.borderColor = '#f87171';
                    setTimeout(() => { thumb.querySelector('img').style.borderColor = 'transparent'; }, 1500);
                }
            });
        });

    });
}
