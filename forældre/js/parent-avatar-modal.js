// parent-avatar-modal.js
// =====================================================================
// Forældre-flow til AI-avatar (3 trin): foto → info → generér → resultat.
//
// window.PortalParentAvatar.open({ institutionId, childId, childName,
//   promptText, rate, exampleUrl, onSubmitted })
//
// Kontrakt (docs/parkerede-opgaver.md, Theis 2026-07-24):
//   * Klienten sender KUN fotoet til serveren. Ingen stil-/prompt-input.
//   * Prompten VISES (fra serveren) men er FAST-LÅST — transparens uden
//     injection-flade.
//   * Server håndhæver flag, samtykke, rate-cap (5/30 dage) og ét-ansigt.
//     Kildefotoet gemmes aldrig. Genereringen tæller (afvist/slettet tæller med).
//   * Resultatet sendes til personale-godkendelse (pending); det bliver først
//     aktivt profilbillede når personalet godkender.
//   * Stilen er "3D-animation" — aldrig varemærket "Pixar" i UI.
(function () {
  'use strict';

  var MAX_SRC_DIM = 640;       // kildefoto ned til 640px længste side
  var SRC_QUALITY = [0.85, 0.7, 0.55, 0.4];
  var SRC_TARGET_BYTES = 300 * 1024;  // < face-guard/edge 1 MB-grænse
  var OUT_DIM = 512;           // gemt avatar 512×512 webp
  var OUT_TARGET_BYTES = 150 * 1024;  // < bucket-policy 300 KB

  var els = {};        // DOM-referencer
  var stream = null;   // aktiv kamera-stream
  var opts = null;     // åbnings-parametre
  var sourceBlob = null;   // komprimeret kildefoto (webp)
  var generatedB64 = null; // seneste genererede avatar (base64 png)
  var rate = null;         // { used, limit, next_release }
  var busy = false;

  function styleOnce() {
    if (document.getElementById('pav-style')) return;
    var s = document.createElement('style');
    s.id = 'pav-style';
    s.textContent =
      '.pav-overlay{position:fixed;inset:0;background:rgba(20,16,10,.62);z-index:10050;display:flex;align-items:center;justify-content:center;padding:16px}' +
      '.pav-card{background:#fff;color:#241c12;width:100%;max-width:440px;max-height:92vh;overflow:auto;border-radius:20px;box-shadow:0 18px 60px rgba(0,0,0,.35);padding:22px 20px 20px}' +
      '.pav-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}' +
      '.pav-title{font-size:19px;font-weight:800;margin:0}' +
      '.pav-x{border:none;background:#f0ece4;color:#57503f;width:34px;height:34px;border-radius:50%;font-size:18px;cursor:pointer;line-height:1}' +
      '.pav-view{display:none}.pav-view.on{display:block}' +
      '.pav-p{font-size:14px;line-height:1.5;color:#4a4436;margin:0 0 12px}' +
      '.pav-btn{display:block;width:100%;border:none;border-radius:13px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;margin-top:10px}' +
      '.pav-btn.primary{background:#f0820e;color:#fff}' +
      '.pav-btn.primary:disabled{background:#e6d8c4;color:#9a8f79;cursor:not-allowed}' +
      '.pav-btn.ghost{background:#f2eee7;color:#3d382a}' +
      '.pav-btn.danger{background:#fff;color:#b23b2e;border:1.5px solid #e7c4bf}' +
      '.pav-file{display:none}' +
      '.pav-video,.pav-canvas{width:100%;border-radius:14px;background:#000;display:block}' +
      '.pav-preview{width:190px;height:190px;border-radius:50%;object-fit:cover;display:block;margin:6px auto 4px;border:3px solid #f0820e;background:#f3efe8}' +
      '.pav-example{width:150px;height:150px;border-radius:16px;object-fit:cover;display:block;margin:0 auto 6px;border:2px solid #eadfce;background:#f3efe8}' +
      '.pav-example-cap{text-align:center;font-size:12px;color:#8a8069;margin:0 0 14px}' +
      '.pav-info{background:#faf6ef;border:1px solid #eee2cf;border-radius:13px;padding:12px 13px;margin:12px 0}' +
      '.pav-info h4{margin:0 0 6px;font-size:13px;font-weight:800;color:#6b5e3f;text-transform:uppercase;letter-spacing:.03em}' +
      '.pav-info ul{margin:0;padding-left:18px}.pav-info li{font-size:13px;line-height:1.5;color:#4a4436;margin-bottom:3px}' +
      '.pav-prompt{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;line-height:1.45;color:#5a5140;white-space:pre-wrap;background:#f4f0e8;border:1px solid #e6ddcb;border-radius:10px;padding:10px;max-height:132px;overflow:auto;margin:4px 0 0}' +
      '.pav-lock{display:inline-block;font-size:11px;font-weight:700;color:#8a7c58;background:#f0e8d6;border-radius:8px;padding:2px 8px;margin-bottom:4px}' +
      '.pav-counter{text-align:center;font-size:14px;font-weight:700;color:#3d382a;margin:8px 0 2px}' +
      '.pav-counter small{display:block;font-weight:500;color:#8a8069;font-size:12px;margin-top:2px}' +
      '.pav-spin{width:44px;height:44px;border:4px solid #eadfce;border-top-color:#f0820e;border-radius:50%;margin:26px auto 14px;animation:pav-rot 1s linear infinite}' +
      '@keyframes pav-rot{to{transform:rotate(360deg)}}' +
      '.pav-err{background:#fdf2f0;border:1px solid #f0cdc6;color:#a5372b;border-radius:11px;padding:10px 12px;font-size:13px;line-height:1.45;margin:10px 0 0;display:none}' +
      '.pav-center{text-align:center}';
    document.head.appendChild(s);
  }

  function stopCamera() {
    if (stream) { try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (_) {} stream = null; }
  }

  function show(view) {
    ['photo', 'camera', 'info', 'gen', 'result'].forEach(function (v) {
      if (els[v]) els[v].classList.toggle('on', v === view);
    });
    if (view !== 'camera') stopCamera();
  }

  function setErr(msg) {
    if (!els.err) return;
    if (msg) { els.err.textContent = msg; els.err.style.display = 'block'; }
    else { els.err.style.display = 'none'; els.err.textContent = ''; }
  }

  // ── Billedbehandling ────────────────────────────────────────────────
  function blobFromCanvas(canvas, qualities, targetBytes) {
    return new Promise(function (resolve) {
      var i = 0;
      function attempt() {
        canvas.toBlob(function (blob) {
          if (!blob) { resolve(null); return; }
          if (blob.size <= targetBytes || i >= qualities.length - 1) { resolve(blob); return; }
          i++; attempt();
        }, 'image/webp', qualities[i]);
      }
      attempt();
    });
  }

  function drawCoverSquare(img, dim) {
    var canvas = document.createElement('canvas');
    canvas.width = dim; canvas.height = dim;
    var ctx = canvas.getContext('2d');
    var iw = img.width || img.videoWidth, ih = img.height || img.videoHeight;
    var side = Math.min(iw, ih);
    var sx = (iw - side) / 2, sy = (ih - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, dim, dim);
    return canvas;
  }

  function processFile(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var dim = Math.min(MAX_SRC_DIM, Math.max(img.width, img.height));
        var canvas = drawCoverSquare(img, Math.min(dim, MAX_SRC_DIM));
        blobFromCanvas(canvas, SRC_QUALITY, SRC_TARGET_BYTES).then(resolve, reject);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Kunne ikke læse billedet.')); };
      img.src = url;
    });
  }

  function b64ToWebpBlob(b64, mime) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var canvas = drawCoverSquare(img, OUT_DIM);
        blobFromCanvas(canvas, [0.85, 0.7, 0.55], OUT_TARGET_BYTES).then(resolve, reject);
      };
      img.onerror = function () { reject(new Error('Kunne ikke behandle avataren.')); };
      img.src = 'data:' + (mime || 'image/png') + ';base64,' + b64;
    });
  }

  // ── Trin-overgange ──────────────────────────────────────────────────
  function toPreview(blob) {
    sourceBlob = blob;
    setErr('');
    els.previewImg.src = URL.createObjectURL(blob);
    show('photo');
    els.photoActions.style.display = 'block';
    els.chooser.style.display = 'none';
  }

  function renderCounter(container) {
    if (!rate) { container.textContent = ''; return; }
    var left = Math.max(0, rate.limit - rate.used);
    var txt = rate.used + ' af ' + rate.limit + ' brugt de sidste 30 dage';
    container.innerHTML = '';
    var b = document.createElement('div'); b.textContent = txt; container.appendChild(b);
    var small = document.createElement('small');
    if (left <= 0 && rate.next_release) {
      small.textContent = 'Du kan lave en ny avatar fra ' + formatDate(rate.next_release) + '.';
    } else {
      small.textContent = left + ' tilbage.';
    }
    container.appendChild(small);
  }

  function formatDate(iso) {
    try { return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'long' }); }
    catch (_) { return iso; }
  }

  function refreshInfoAvailability() {
    var exhausted = rate && rate.used >= rate.limit;
    els.genBtn.disabled = !!exhausted;
    els.genBtn.textContent = exhausted ? 'Grænsen er nået' : 'Generér avatar';
  }

  // ── Generering ──────────────────────────────────────────────────────
  function doGenerate() {
    if (busy || !sourceBlob) return;
    busy = true; setErr(''); show('gen');
    window.PortalAPI.generateAvatar(opts.childId, sourceBlob).then(function (res) {
      if (res && res.rate) { rate = res.rate; }
      if (res && res.success && res.image_base64) {
        generatedB64 = res.image_base64;
        els.resultImg.src = 'data:image/' + (res.format || 'png') + ';base64,' + res.image_base64;
        renderCounter(els.resultCounter);
        show('result');
      } else {
        // Fejl (rate/face/moderation) — vis besked, gå tilbage til et brugbart trin.
        var msg = (res && res.error) || 'Genereringen fejlede. Prøv igen.';
        var code = res && res.code;
        if (code === 'face_check_failed') { show('photo'); els.chooser.style.display = 'block'; els.photoActions.style.display = 'none'; }
        else { refreshInfoAvailability(); renderCounter(els.infoCounter); show('info'); }
        setErr(msg);
      }
    }).catch(function (e) {
      refreshInfoAvailability(); renderCounter(els.infoCounter); show('info');
      setErr((e && e.message) || 'Genereringen fejlede. Prøv igen.');
    }).then(function () { busy = false; });
  }

  function doSubmit() {
    if (busy || !generatedB64) return;
    busy = true; setErr(''); els.submitBtn.disabled = true; els.submitBtn.textContent = 'Sender…';
    b64ToWebpBlob(generatedB64, 'image/png').then(function (webp) {
      if (!webp) throw new Error('Kunne ikke behandle avataren.');
      return window.PortalAPI.submitGeneratedAvatar(opts.institutionId, opts.childId, webp);
    }).then(function (result) {
      var ok = result && (result.success === true || result.status === 'pending' || result.library_id);
      if (ok) {
        if (typeof opts.onSubmitted === 'function') opts.onSubmitted();
        close();
      } else {
        throw new Error((result && result.error) || 'Kunne ikke sende avataren.');
      }
    }).catch(function (e) {
      setErr((e && e.message) || 'Kunne ikke sende avataren til godkendelse.');
    }).then(function () {
      busy = false; els.submitBtn.disabled = false; els.submitBtn.textContent = 'Send til godkendelse';
    });
  }

  // ── Kamera ──────────────────────────────────────────────────────────
  function startCamera() {
    setErr('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErr('Kameraet er ikke tilgængeligt. Vælg et billede fra galleriet i stedet.');
      return;
    }
    show('camera');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }, audio: false })
      .then(function (s) { stream = s; els.video.srcObject = s; els.video.play(); })
      .catch(function () { show('photo'); setErr('Kunne ikke åbne kameraet. Giv adgang, eller vælg fra galleriet.'); });
  }

  function snap() {
    if (!els.video.videoWidth) return;
    var canvas = drawCoverSquare(els.video, MAX_SRC_DIM);
    stopCamera();
    blobFromCanvas(canvas, SRC_QUALITY, SRC_TARGET_BYTES).then(function (blob) {
      if (blob) toPreview(blob); else setErr('Kunne ikke tage billedet. Prøv igen.');
    });
  }

  // ── Build + open/close ──────────────────────────────────────────────
  function buildModal() {
    styleOnce();
    var overlay = document.createElement('div');
    overlay.className = 'pav-overlay';
    overlay.innerHTML =
      '<div class="pav-card" role="dialog" aria-modal="true" aria-label="Lav AI-avatar">' +
        '<div class="pav-head"><h3 class="pav-title">Lav en AI-avatar</h3>' +
          '<button class="pav-x" data-pav="close" aria-label="Luk">×</button></div>' +
        '<div class="pav-err" data-pav="err"></div>' +

        // Trin 1a: vælg kilde
        '<div class="pav-view" data-pav="photo">' +
          '<div data-pav="chooser">' +
            '<p class="pav-p">Tag et klart portræt af dit barn — kun barnet selv på billedet. Fotoet sendes til AI\'en, men <b>gemmes ikke</b>.</p>' +
            '<button class="pav-btn primary" data-pav="camera-open">📷 Tag et billede</button>' +
            '<button class="pav-btn ghost" data-pav="file-open">🖼️ Vælg fra galleri</button>' +
            '<input type="file" accept="image/*" class="pav-file" data-pav="file">' +
          '</div>' +
          '<div data-pav="photo-actions" style="display:none">' +
            '<img class="pav-preview" data-pav="preview" alt="Valgt foto">' +
            '<button class="pav-btn primary" data-pav="to-info">Fortsæt</button>' +
            '<button class="pav-btn ghost" data-pav="retake">Vælg et andet</button>' +
          '</div>' +
        '</div>' +

        // Trin 1b: kamera
        '<div class="pav-view" data-pav="camera">' +
          '<video class="pav-video" data-pav="video" playsinline muted></video>' +
          '<button class="pav-btn primary" data-pav="snap">Tag billede</button>' +
          '<button class="pav-btn ghost" data-pav="cam-cancel">Annullér</button>' +
        '</div>' +

        // Trin 2: info + eksempel + låst prompt + tæller
        '<div class="pav-view" data-pav="info">' +
          '<img class="pav-example" data-pav="example" alt="Eksempel på en AI-avatar">' +
          '<p class="pav-example-cap">Sådan kan en avatar se ud (3D-animationsstil).</p>' +
          '<div class="pav-info"><h4>Sådan bruges dit foto</h4><ul>' +
            '<li>Billedet sendes til Microsoft Azure i EU for at lave avataren.</li>' +
            '<li>Kildefotoet <b>gemmes ikke</b> — kun den færdige avatar.</li>' +
            '<li>Personalet skal <b>godkende</b> avataren, før den kan bruges.</li>' +
            '<li>AI\'en beholder dit barns alder og udseende — ingen forskønnelse.</li>' +
          '</ul></div>' +
          '<span class="pav-lock">🔒 Fast instruktion — kan ikke ændres</span>' +
          '<div class="pav-prompt" data-pav="prompt"></div>' +
          '<div class="pav-counter" data-pav="info-counter"></div>' +
          '<button class="pav-btn primary" data-pav="generate">Generér avatar</button>' +
          '<button class="pav-btn ghost" data-pav="info-back">Tilbage</button>' +
        '</div>' +

        // Trin 3: genererer
        '<div class="pav-view pav-center" data-pav="gen">' +
          '<div class="pav-spin"></div>' +
          '<p class="pav-p pav-center">Genererer avataren … det tager typisk 10–20 sekunder.</p>' +
        '</div>' +

        // Trin 4: resultat
        '<div class="pav-view" data-pav="result">' +
          '<img class="pav-preview" data-pav="result-img" alt="Genereret avatar">' +
          '<div class="pav-counter" data-pav="result-counter"></div>' +
          '<button class="pav-btn primary" data-pav="submit">Send til godkendelse</button>' +
          '<button class="pav-btn danger" data-pav="discard">Slet — prøv igen</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    var q = function (n) { return overlay.querySelector('[data-pav="' + n + '"]'); };
    els = {
      overlay: overlay, err: q('err'),
      photo: q('photo'), chooser: q('chooser'), photoActions: q('photo-actions'),
      previewImg: q('preview'), file: q('file'),
      camera: q('camera'), video: q('video'),
      info: q('info'), example: q('example'), prompt: q('prompt'),
      infoCounter: q('info-counter'), genBtn: q('generate'),
      gen: q('gen'),
      result: q('result'), resultImg: q('result-img'), resultCounter: q('result-counter'),
      submitBtn: q('submit'),
    };

    // Bindinger
    q('close').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    q('camera-open').addEventListener('click', startCamera);
    q('file-open').addEventListener('click', function () { els.file.click(); });
    els.file.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      setErr('');
      processFile(f).then(toPreview).catch(function (err) { setErr((err && err.message) || 'Kunne ikke læse billedet.'); });
      els.file.value = '';
    });
    q('snap').addEventListener('click', snap);
    q('cam-cancel').addEventListener('click', function () { show('photo'); els.chooser.style.display = 'block'; els.photoActions.style.display = 'none'; });
    q('retake').addEventListener('click', function () { els.chooser.style.display = 'block'; els.photoActions.style.display = 'none'; setErr(''); });
    q('to-info').addEventListener('click', function () { setErr(''); renderCounter(els.infoCounter); refreshInfoAvailability(); show('info'); });
    q('info-back').addEventListener('click', function () { show('photo'); els.chooser.style.display = 'none'; els.photoActions.style.display = 'block'; });
    els.genBtn.addEventListener('click', doGenerate);
    els.submitBtn.addEventListener('click', doSubmit);
    q('discard').addEventListener('click', function () {
      generatedB64 = null; setErr(''); renderCounter(els.infoCounter); refreshInfoAvailability(); show('info');
    });
  }

  function open(o) {
    opts = o || {};
    if (!opts.institutionId || !opts.childId) { console.warn('[PortalParentAvatar] mangler institutionId/childId'); return; }
    sourceBlob = null; generatedB64 = null; busy = false;
    rate = opts.rate || null;
    buildModal();
    els.prompt.textContent = opts.promptText || '';
    els.example.src = opts.exampleUrl || 'assets/avatar-example.webp';
    els.example.onerror = function () { els.example.style.display = 'none'; };
    show('photo');
    els.chooser.style.display = 'block';
    els.photoActions.style.display = 'none';
  }

  function close() {
    stopCamera();
    if (els.overlay && els.overlay.parentNode) els.overlay.parentNode.removeChild(els.overlay);
    els = {}; opts = null; sourceBlob = null; generatedB64 = null; busy = false;
  }

  window.PortalParentAvatar = { open: open, close: close };
})();
