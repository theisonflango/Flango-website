// portal-image.js
// =====================================================================
// Fælles billed-kodning for portalens billed-flows (profilbillede-upload og
// AI-avatar). ÉN kilde — begge modaler havde før hver sin kopi af den samme
// canvas→blob-kode, og en fejl i den ene kunne derfor ikke ses i den anden.
//
// ⚠️ RODÅRSAG den her løser (fundet 2026-07-25 på iPhone):
// `canvas.toBlob(cb, 'image/webp')` er IKKE understøttet i alle WebViews.
// iOS/WKWebView falder LYDLØST tilbage til PNG — samme kald, andet resultat,
// ingen fejl. Konsekvenser vi målte i prod:
//   * PNG er 5-10× større end webp → ryger tæt på (eller over) upload-grænsen.
//   * Serverens ansigts-kontrol accepterer kun webp/jpeg → PNG blev afvist med
//     "Vi kunne ikke bekræfte billedet", så AI-avatar var umulig fra iPhone,
//     mens den virkede fint på desktop.
//   * Filer blev gemt som .webp med contentType webp, men var i virkeligheden
//     PNG (verificeret på magic bytes i Storage).
//
// Derfor: vi GÆTTER ikke på formatet — vi verificerer hvad browseren faktisk
// producerede (blob.type) og falder tilbage til JPEG, som alle browsere kan
// kode, og som serveren også accepterer. Kalderen får det ægte format at vide
// (extFor/typen), så filnavn og contentType kan følge virkeligheden.
(function () {
  'use strict';

  var DEFAULT_QUALITIES = [0.85, 0.7, 0.55, 0.4];
  var DEFAULT_TARGET = 300 * 1024;

  function toBlob(canvas, type, quality) {
    return new Promise(function (resolve) {
      try {
        canvas.toBlob(function (b) { resolve(b || null); }, type, quality);
      } catch (_) {
        resolve(null);
      }
    });
  }

  /**
   * Kod et canvas til den mindste acceptable fil.
   * Garanterer at resultatets type ER image/webp eller image/jpeg — aldrig PNG.
   * @returns {Promise<Blob|null>}
   */
  function encode(canvas, qualities, targetBytes) {
    var qs = qualities && qualities.length ? qualities : DEFAULT_QUALITIES;
    var target = targetBytes || DEFAULT_TARGET;

    // Probe: bed om webp og se hvad vi FAKTISK fik.
    return toBlob(canvas, 'image/webp', qs[0]).then(function (first) {
      var webpOk = !!first && first.type === 'image/webp';
      if (webpOk && first.size <= target) return first;

      var type = webpOk ? 'image/webp' : 'image/jpeg';
      var i = webpOk ? 1 : 0; // webp-probe på qs[0] er allerede brugt
      if (i >= qs.length) i = qs.length - 1;

      function step(idx) {
        return toBlob(canvas, type, qs[idx]).then(function (b) {
          if (!b) return webpOk ? first : null;
          if (b.size <= target || idx >= qs.length - 1) return b;
          return step(idx + 1);
        });
      }
      return step(i);
    });
  }

  /** Filendelse der matcher blobbens FAKTISKE type (så navnet ikke lyver). */
  function extFor(blob) {
    return blob && blob.type === 'image/jpeg' ? 'jpg' : 'webp';
  }

  /** Center-beskåret kvadratisk canvas fra et <img> eller <video>. */
  function squareCanvas(source, dim) {
    var canvas = document.createElement('canvas');
    canvas.width = dim; canvas.height = dim;
    var ctx = canvas.getContext('2d');
    var iw = source.naturalWidth || source.width || source.videoWidth;
    var ih = source.naturalHeight || source.height || source.videoHeight;
    var side = Math.min(iw, ih);
    ctx.drawImage(source, (iw - side) / 2, (ih - side) / 2, side, side, 0, 0, dim, dim);
    return canvas;
  }

  /** Læs en valgt fil → kvadratisk, komprimeret blob (EXIF strippes af canvas). */
  function processFile(file, maxDim, qualities, targetBytes) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var dim = Math.min(maxDim, Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
        encode(squareCanvas(img, dim || maxDim), qualities, targetBytes).then(resolve, reject);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Kunne ikke læse billedet.'));
      };
      img.src = url;
    });
  }

  /** Kører vi i den native app (Capacitor) frem for i en browser? */
  function isNative() {
    try {
      return location.protocol === 'capacitor:' ||
        !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    } catch (_) { return false; }
  }

  /**
   * Kan vi bruge live-kamera (getUserMedia) her?
   * iOS' WKWebView eksponerer IKKE navigator.mediaDevices på capacitor://-origin,
   * så den native app skal bruge systemkameraet via <input capture> i stedet.
   */
  function canUseLiveCamera() {
    return !isNative() && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  window.PortalImage = {
    encode: encode,
    extFor: extFor,
    squareCanvas: squareCanvas,
    processFile: processFile,
    isNative: isNative,
    canUseLiveCamera: canUseLiveCamera,
  };
})();
