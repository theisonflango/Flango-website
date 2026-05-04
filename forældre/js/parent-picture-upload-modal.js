/**
 * parent-picture-upload-modal.js
 *
 * Forældre-upload-modal: kamera (getUserMedia) + file-input + crop + komprimering.
 * Genbruger samme komprimerings-pipeline som café-appen
 * (apps/cafe/js/core/profile-picture-utils.js): 400x400 WebP, max 50KB,
 * 7 quality-steps. EXIF strippes automatisk via canvas.toBlob().
 *
 * Aktiverer:
 *   window.PortalParentPictureUpload.open({ childId, institutionId, childName, onUploaded })
 *
 * onUploaded callback kaldes med { success, status, library_id, message }
 * når upload er færdig (typisk pending-status).
 */
(function () {
  'use strict';

  const TARGET_SIZE = 400;
  const MAX_FILE_SIZE = 50 * 1024; // 50KB
  const QUALITIES = [0.80, 0.70, 0.60, 0.50, 0.40, 0.30, 0.20];

  let activeStream = null;
  let pendingBlob = null;
  let modalEl = null;

  function processImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = TARGET_SIZE;
            canvas.height = TARGET_SIZE;

            const sourceAspect = img.width / img.height;
            let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;
            if (sourceAspect > 1) {
              sWidth = img.height;
              sx = (img.width - sWidth) / 2;
            } else if (sourceAspect < 1) {
              sHeight = img.width;
              sy = (img.height - sHeight) / 2;
            }

            ctx.clearRect(0, 0, TARGET_SIZE, TARGET_SIZE);
            ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, TARGET_SIZE, TARGET_SIZE);

            const tryCompress = (q) => new Promise((res) => {
              canvas.toBlob((b) => res(b), 'image/webp', q);
            });

            (async () => {
              for (const q of QUALITIES) {
                const blob = await tryCompress(q);
                if (blob && blob.size <= MAX_FILE_SIZE) { resolve(blob); return; }
              }
              const last = await tryCompress(QUALITIES[QUALITIES.length - 1]);
              if (last) resolve(last);
              else reject(new Error('Kunne ikke komprimere billedet'));
            })();
          } catch (err) { reject(err); }
        };
        img.onerror = () => reject(new Error('Kunne ikke læse billedet'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Kunne ikke læse filen'));
      reader.readAsDataURL(file);
    });
  }

  function captureFromVideo(video) {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const size = Math.min(video.videoWidth, video.videoHeight);
        canvas.width = TARGET_SIZE;
        canvas.height = TARGET_SIZE;
        const ctx = canvas.getContext('2d');
        const sx = (video.videoWidth - size) / 2;
        const sy = (video.videoHeight - size) / 2;
        ctx.drawImage(video, sx, sy, size, size, 0, 0, TARGET_SIZE, TARGET_SIZE);

        const tryCompress = (q) => new Promise((res) => {
          canvas.toBlob((b) => res(b), 'image/webp', q);
        });

        (async () => {
          for (const q of QUALITIES) {
            const blob = await tryCompress(q);
            if (blob && blob.size <= MAX_FILE_SIZE) { resolve(blob); return; }
          }
          const last = await tryCompress(QUALITIES[QUALITIES.length - 1]);
          if (last) resolve(last);
          else reject(new Error('Kunne ikke komprimere snapshot'));
        })();
      } catch (err) { reject(err); }
    });
  }

  function stopStream() {
    if (activeStream) {
      activeStream.getTracks().forEach((t) => t.stop());
      activeStream = null;
    }
  }

  function closeModal() {
    stopStream();
    pendingBlob = null;
    if (modalEl) {
      modalEl.remove();
      modalEl = null;
    }
  }

  function showError(msg) {
    if (!modalEl) return;
    const errBox = modalEl.querySelector('.ppum-error');
    if (errBox) {
      errBox.textContent = msg;
      errBox.style.display = '';
    }
  }

  function clearError() {
    if (!modalEl) return;
    const errBox = modalEl.querySelector('.ppum-error');
    if (errBox) errBox.style.display = 'none';
  }

  function setBusy(isBusy) {
    if (!modalEl) return;
    modalEl.querySelectorAll('button').forEach((b) => { b.disabled = isBusy; });
    const spinner = modalEl.querySelector('.ppum-spinner');
    if (spinner) spinner.style.display = isBusy ? 'inline-block' : 'none';
  }

  function showPreview(blob) {
    pendingBlob = blob;
    const preview = modalEl.querySelector('.ppum-preview');
    const placeholder = modalEl.querySelector('.ppum-placeholder');
    const submitBtn = modalEl.querySelector('.ppum-submit-btn');
    const url = URL.createObjectURL(blob);
    preview.src = url;
    preview.style.display = '';
    if (placeholder) placeholder.style.display = 'none';
    submitBtn.disabled = false;
    const sizeKb = (blob.size / 1024).toFixed(1);
    const meta = modalEl.querySelector('.ppum-meta');
    if (meta) meta.textContent = `Komprimeret til ${sizeKb} KB · 400×400 WebP`;
  }

  async function startCamera() {
    clearError();
    if (!navigator.mediaDevices?.getUserMedia) {
      showError('Kamera er ikke understøttet i denne browser. Brug "Vælg fil" i stedet.');
      return;
    }
    try {
      activeStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 800 }, height: { ideal: 800 } },
        audio: false,
      });
      const video = modalEl.querySelector('.ppum-video');
      const cameraView = modalEl.querySelector('.ppum-camera-view');
      const chooserView = modalEl.querySelector('.ppum-chooser-view');
      video.srcObject = activeStream;
      await video.play();
      chooserView.style.display = 'none';
      cameraView.style.display = '';
    } catch (err) {
      showError('Kameraet kunne ikke startes: ' + (err.message || 'ukendt fejl'));
      stopStream();
    }
  }

  async function snapPhoto() {
    clearError();
    const video = modalEl.querySelector('.ppum-video');
    if (!video || !activeStream) return;
    setBusy(true);
    try {
      const blob = await captureFromVideo(video);
      stopStream();
      modalEl.querySelector('.ppum-camera-view').style.display = 'none';
      modalEl.querySelector('.ppum-confirm-view').style.display = '';
      showPreview(blob);
    } catch (err) {
      showError('Snapshot fejlede: ' + (err.message || 'ukendt fejl'));
    } finally {
      setBusy(false);
    }
  }

  async function handleFileChoice(file) {
    clearError();
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showError('Vælg venligst en billedfil (JPEG, PNG eller WebP).');
      return;
    }
    setBusy(true);
    try {
      const blob = await processImage(file);
      modalEl.querySelector('.ppum-chooser-view').style.display = 'none';
      modalEl.querySelector('.ppum-confirm-view').style.display = '';
      showPreview(blob);
    } catch (err) {
      showError('Kunne ikke behandle billedet: ' + (err.message || 'ukendt fejl'));
    } finally {
      setBusy(false);
    }
  }

  function backToChooser() {
    stopStream();
    pendingBlob = null;
    clearError();
    modalEl.querySelector('.ppum-camera-view').style.display = 'none';
    modalEl.querySelector('.ppum-confirm-view').style.display = 'none';
    modalEl.querySelector('.ppum-chooser-view').style.display = '';
    const preview = modalEl.querySelector('.ppum-preview');
    if (preview) {
      preview.src = '';
      preview.style.display = 'none';
    }
    const placeholder = modalEl.querySelector('.ppum-placeholder');
    if (placeholder) placeholder.style.display = '';
    const submitBtn = modalEl.querySelector('.ppum-submit-btn');
    if (submitBtn) submitBtn.disabled = true;
  }

  async function submit({ institutionId, childId, onUploaded }) {
    if (!pendingBlob) return;
    clearError();
    setBusy(true);
    try {
      if (!window.PortalAPI?.uploadProfilePictureFile) {
        throw new Error('PortalAPI ikke tilgængelig');
      }
      const result = await window.PortalAPI.uploadProfilePictureFile(institutionId, childId, pendingBlob);
      closeModal();
      if (typeof onUploaded === 'function') onUploaded(result);
    } catch (err) {
      showError(err?.message || 'Upload fejlede');
      setBusy(false);
    }
  }

  function buildModal({ childName }) {
    const escName = String(childName || 'barnet')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const html = `
      <div class="ppum-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10010;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div class="ppum-box" style="background:var(--bg,#fff);border-radius:16px;max-width:480px;width:100%;max-height:92vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h2 style="margin:0;font-size:18px;font-weight:700;">Upload profilbillede</h2>
            <button class="ppum-close-btn" style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--ink-muted,#78716c);padding:4px 8px;line-height:1;">×</button>
          </div>
          <p style="margin:0 0 12px;font-size:13px;color:var(--ink-muted,#78716c);">For ${escName}</p>

          <div class="hint-box blue" style="background:#eff6ff;border:1px solid #93c5fd;border-radius:8px;padding:10px 12px;font-size:13px;color:#1e3a5f;line-height:1.5;margin-bottom:16px;">
            ℹ️ Alle uploads gennemgås af institutionen før de aktiveres som profilbillede. Du får besked når billedet er godkendt eller afvist.
          </div>

          <div class="ppum-error" style="display:none;background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:12px;"></div>

          <div class="ppum-chooser-view">
            <div style="display:flex;flex-direction:column;gap:10px;">
              <button class="ppum-camera-btn" style="display:flex;align-items:center;gap:10px;padding:14px;border:1.5px solid var(--border,#e7e5e4);border-radius:10px;background:var(--bg,#fff);font-size:15px;cursor:pointer;text-align:left;">
                <span style="font-size:24px;">📷</span>
                <div>
                  <div style="font-weight:600;">Tag et billede</div>
                  <div style="font-size:12px;color:var(--ink-muted,#78716c);">Brug kameraet på din enhed</div>
                </div>
              </button>
              <button class="ppum-file-btn" style="display:flex;align-items:center;gap:10px;padding:14px;border:1.5px solid var(--border,#e7e5e4);border-radius:10px;background:var(--bg,#fff);font-size:15px;cursor:pointer;text-align:left;">
                <span style="font-size:24px;">🖼️</span>
                <div>
                  <div style="font-weight:600;">Vælg fra galleri</div>
                  <div style="font-size:12px;color:var(--ink-muted,#78716c);">Upload en eksisterende fil</div>
                </div>
              </button>
              <input type="file" class="ppum-file-input" accept="image/*" style="display:none;">
            </div>
          </div>

          <div class="ppum-camera-view" style="display:none;">
            <video class="ppum-video" autoplay playsinline muted style="width:100%;max-width:400px;border-radius:12px;background:#000;display:block;margin:0 auto;"></video>
            <div style="display:flex;gap:10px;justify-content:center;margin-top:14px;">
              <button class="ppum-back-btn" style="padding:10px 16px;border:1px solid var(--border,#d1d5db);border-radius:8px;background:var(--bg,#fff);cursor:pointer;">Tilbage</button>
              <button class="ppum-snap-btn" style="padding:10px 20px;border:none;border-radius:8px;background:var(--flango,#F5960A);color:#fff;font-weight:600;cursor:pointer;">📸 Tag billede</button>
            </div>
          </div>

          <div class="ppum-confirm-view" style="display:none;">
            <div style="text-align:center;margin-bottom:14px;">
              <div style="display:inline-block;border-radius:50%;overflow:hidden;width:200px;height:200px;background:var(--surface-sunken,#f5f5f4);position:relative;">
                <img class="ppum-preview" style="display:none;width:100%;height:100%;object-fit:cover;">
                <div class="ppum-placeholder" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:var(--ink-muted,#78716c);">Ingen forhåndsvisning</div>
              </div>
              <div class="ppum-meta" style="font-size:12px;color:var(--ink-muted,#78716c);margin-top:8px;"></div>
            </div>
            <div style="display:flex;gap:10px;justify-content:center;">
              <button class="ppum-back-btn" style="padding:10px 16px;border:1px solid var(--border,#d1d5db);border-radius:8px;background:var(--bg,#fff);cursor:pointer;">Vælg igen</button>
              <button class="ppum-submit-btn" disabled style="padding:10px 20px;border:none;border-radius:8px;background:var(--flango,#F5960A);color:#fff;font-weight:600;cursor:pointer;">
                <span class="ppum-spinner" style="display:none;border:2px solid #fff;border-top:2px solid transparent;border-radius:50%;width:12px;height:12px;animation:ppum-spin 1s linear infinite;margin-right:6px;vertical-align:middle;"></span>
                Send til godkendelse
              </button>
            </div>
          </div>
        </div>
      </div>
      <style>
        @keyframes ppum-spin { 0% { transform: rotate(0); } 100% { transform: rotate(360deg); } }
      </style>
    `;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    return wrapper.firstElementChild;
  }

  window.PortalParentPictureUpload = {
    open({ institutionId, childId, childName, onUploaded }) {
      if (!institutionId || !childId) {
        console.error('[parent-picture-upload-modal] institutionId og childId er påkrævet');
        return;
      }
      if (modalEl) closeModal();

      modalEl = buildModal({ childName });
      document.body.appendChild(modalEl);

      modalEl.querySelector('.ppum-close-btn').addEventListener('click', closeModal);
      modalEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('ppum-backdrop')) closeModal();
      });
      modalEl.querySelector('.ppum-camera-btn').addEventListener('click', startCamera);
      modalEl.querySelector('.ppum-file-btn').addEventListener('click', () => {
        modalEl.querySelector('.ppum-file-input').click();
      });
      modalEl.querySelector('.ppum-file-input').addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) handleFileChoice(file);
      });
      modalEl.querySelectorAll('.ppum-back-btn').forEach((btn) => {
        btn.addEventListener('click', backToChooser);
      });
      modalEl.querySelector('.ppum-snap-btn').addEventListener('click', snapPhoto);
      modalEl.querySelector('.ppum-submit-btn').addEventListener('click', () => {
        submit({ institutionId, childId, onUploaded });
      });
    },
    close: closeModal,
  };
})();
