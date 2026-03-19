/**
 * profile-picture-modal.js
 * Full-screen modal for setting a user's profile picture.
 * Sub-views: Upload, Camera, Library.
 */

import { AVATAR_URLS } from './avatar-picker.js';
import { processImageForProfilePicture, uploadProfilePicture, saveLibraryProfilePicture } from '../core/profile-picture-utils.js';
import { getProfilePictureUrl, invalidateProfilePictureCache } from '../core/profile-picture-cache.js';
import { escapeHtml } from '../core/escape-html.js';
import { supabaseClient, SUPABASE_URL } from '../core/config-and-supabase.js';
import { fetchInstitutionIconLibrary } from '../core/product-icon-utils.js';

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

    const allowedTypes = inst.profile_picture_types || ['upload', 'camera', 'library'];

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

    // Type buttons
    const typeGrid = modal.querySelector('#pp-type-grid');
    const typeConfig = [
        { key: 'upload', icon: '📁', label: 'Upload' },
        { key: 'camera', icon: '📷', label: 'Kamera' },
        { key: 'library', icon: '🎨', label: 'Bibliotek' },
        { key: 'icons', icon: '🖼️', label: 'Ikoner' },
        { key: 'ai_avatar', icon: '🤖', label: 'AI-Avatar', requiresAi: true },
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

    for (const tc of typeConfig) {
        // Icons (like library) are always available — they use the institution's icon library
        if (tc.key !== 'icons' && !allowedTypes.includes(tc.key)) continue;
        if (tc.requiresAi && !inst.profile_pictures_ai_enabled) continue;

        const btn = document.createElement('button');
        btn.className = 'profile-pic-type-btn';
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
        typeGrid.appendChild(btn);
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
                const result = await uploadProfilePicture(blob, user.institution_id, user.id, 'upload');
                URL.revokeObjectURL(previewUrl);

                if (result.success) {
                    user.profile_picture_url = `${user.institution_id}/${user.id}.webp`;
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
        const sx = (video.videoWidth - size) / 2;
        const sy = (video.videoHeight - size) / 2;
        // Flip horizontal to match mirror view
        ctx.translate(400, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, sx, sy, size, size, 0, 0, 400, 400);

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
                const result = await uploadProfilePicture(processedBlob, user.institution_id, user.id, 'camera');
                URL.revokeObjectURL(previewUrl);

                if (result.success) {
                    user.profile_picture_url = `${user.institution_id}/${user.id}.webp`;
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

        const result = await saveLibraryProfilePicture(user.id, selectedUrl);
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

    const gridHtml = icons.map((icon, i) => `
        <div class="profile-pic-library-item" data-icon-index="${i}" data-icon-url="${escapeHtml(icon.icon_url)}">
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
            saveBtn.disabled = false;
        });
    });

    saveBtn.addEventListener('click', async () => {
        if (!selectedUrl) return;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Gemmer...';

        const result = await saveLibraryProfilePicture(user.id, selectedUrl, 'icon');
        if (result.success) {
            user.profile_picture_url = selectedUrl;
            user.profile_picture_type = 'icon';
            if (onSaved) onSaved({ profile_picture_url: selectedUrl, profile_picture_type: 'icon' });
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

function renderAiAvatarView(container, user, inst, closeModal, onSaved, setStream) {
    container.innerHTML = `
        <div class="profile-pic-subview">
            <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;padding:10px;background:rgba(245,158,11,0.1);border-radius:8px;border:1px solid rgba(245,158,11,0.2);">
                Tag et foto af barnet. Fotoet sendes til OpenAI for at generere en Pixar-stil avatar. <strong>Fotoet slettes straks efter.</strong>
            </div>
            <div class="profile-pic-camera-container" id="pp-ai-camera-wrap">
                <video id="pp-ai-camera-video" class="profile-pic-camera-video" autoplay playsinline muted></video>
            </div>
            <div class="profile-pic-camera-actions">
                <button class="profile-pic-capture-btn" id="pp-ai-capture-btn" disabled></button>
            </div>
            <div id="pp-ai-status" class="profile-pic-loading" style="text-align:center;margin-top:8px;">
                <span class="profile-pic-spinner"></span> Starter kamera...
            </div>
            <div id="pp-ai-preview" style="display:none;"></div>
        </div>`;

    const video = container.querySelector('#pp-ai-camera-video');
    const captureBtn = container.querySelector('#pp-ai-capture-btn');
    const previewArea = container.querySelector('#pp-ai-preview');
    const statusEl = container.querySelector('#pp-ai-status');
    const cameraWrap = container.querySelector('#pp-ai-camera-wrap');

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

    captureBtn.addEventListener('click', () => {
        // Capture frame as JPEG (higher quality for AI reference)
        const canvas = document.createElement('canvas');
        const size = Math.min(video.videoWidth, video.videoHeight);
        canvas.width = 800;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');
        const sx = (video.videoWidth - size) / 2;
        const sy = (video.videoHeight - size) / 2;
        ctx.translate(800, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, sx, sy, size, size, 0, 0, 800, 800);

        canvas.toBlob(async (blob) => {
            if (!blob) return;

            cameraWrap.style.display = 'none';
            captureBtn.parentElement.style.display = 'none';
            previewArea.style.display = 'block';

            const photoUrl = URL.createObjectURL(blob);
            previewArea.innerHTML = `
                <div class="profile-pic-preview-container">
                    <img src="${photoUrl}" alt="Foto" class="profile-pic-preview-img" style="border-color:rgba(245,158,11,0.4);">
                    <div style="font-size:11px;color:#94a3b8;text-align:center;">Dette foto sendes til AI og slettes straks efter</div>
                    <div class="profile-pic-preview-actions">
                        <button class="profile-pic-btn profile-pic-btn-primary" id="pp-ai-generate" style="background:linear-gradient(135deg,#f59e0b,#d97706);">Generer avatar</button>
                        <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-retake">Tag nyt foto</button>
                    </div>
                </div>`;

            previewArea.querySelector('#pp-ai-generate').addEventListener('click', async () => {
                previewArea.innerHTML = `<div class="profile-pic-loading" style="padding:30px;text-align:center;">
                    <span class="profile-pic-spinner"></span>
                    <div style="margin-top:8px;font-size:13px;">Genererer avatar... (5-15 sek)</div>
                </div>`;

                try {
                    // Get auth token
                    const { data: { session } } = await supabaseClient.auth.getSession();
                    const token = session?.access_token;
                    if (!token) throw new Error('Ikke logget ind');

                    // Get admin user ID
                    const adminUserId = session?.user?.id;

                    const formData = new FormData();
                    formData.append('user_id', user.id);
                    formData.append('photo', new File([blob], 'photo.jpg', { type: 'image/jpeg' }));

                    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-profile-avatar`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'x-admin-user-id': adminUserId,
                        },
                        body: formData,
                    });

                    const result = await response.json();
                    URL.revokeObjectURL(photoUrl);

                    if (!result.success) {
                        throw new Error(result.error || 'Generering fejlede');
                    }

                    // Show generated avatar
                    const avatarUrl = result.url;
                    previewArea.innerHTML = `
                        <div class="profile-pic-preview-container">
                            <img src="${avatarUrl}" alt="AI Avatar" class="profile-pic-preview-img" style="border-color:rgba(34,197,94,0.4);">
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
                        cameraWrap.style.display = 'block';
                        captureBtn.parentElement.style.display = 'flex';
                    });

                    previewArea.querySelector('#pp-ai-cancel').addEventListener('click', closeModal);

                } catch (err) {
                    URL.revokeObjectURL(photoUrl);
                    previewArea.innerHTML = `
                        <div style="text-align:center;padding:20px;">
                            <div style="color:#f87171;margin-bottom:12px;">${escapeHtml(err.message)}</div>
                            <button class="profile-pic-btn profile-pic-btn-secondary" id="pp-ai-retry-err">Prøv igen</button>
                        </div>`;
                    previewArea.querySelector('#pp-ai-retry-err')?.addEventListener('click', () => {
                        previewArea.style.display = 'none';
                        cameraWrap.style.display = 'block';
                        captureBtn.parentElement.style.display = 'flex';
                    });
                }
            });

            previewArea.querySelector('#pp-ai-retake').addEventListener('click', () => {
                URL.revokeObjectURL(photoUrl);
                previewArea.style.display = 'none';
                cameraWrap.style.display = 'block';
                captureBtn.parentElement.style.display = 'flex';
            });
        }, 'image/jpeg', 0.9);
    });
}
