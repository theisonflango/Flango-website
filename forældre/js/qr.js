// apps/portal/js/qr.js
//
// Minimal QR-encoder — byte-mode, fejlkorrektionsniveau M, version 1–6
// (op til 106 bytes, rigeligt til et partner-link).
//
// Hvorfor egen kode og ikke et bibliotek: portalens CSP tillader ingen
// eksterne scripts, og en vendored QR-pakke ville være ~40 kB for én
// funktion. Denne fil er verificeret modul-for-modul mod segno
// (referenceimplementering) — se docs/spec-foraeldre-adgang.md.
//
// Bemærk: dette er en ENCODER. Portalen scanner ingenting og beder
// aldrig om kamera-adgang — modtageren bruger telefonens eget kamera,
// som åbner Universal Link'et.

(function () {
  'use strict';

  // ─── Galois-felt GF(256), primitivt polynomium 0x11D ───
  var EXP = new Uint8Array(512);
  var LOG = new Uint8Array(256);
  (function initGF() {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  /** Generatorpolynomium for `degree` fejlkorrektions-codewords. */
  function rsGenerator(degree) {
    var poly = [1];
    for (var d = 0; d < degree; d++) {
      var next = new Array(poly.length + 1).fill(0);
      for (var i = 0; i < poly.length; i++) {
        next[i] ^= poly[i];
        next[i + 1] ^= gfMul(poly[i], EXP[d]);
      }
      poly = next;
    }
    return poly;
  }

  function rsRemainder(data, degree) {
    var gen = rsGenerator(degree);
    var rem = new Array(degree).fill(0);
    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ rem[0];
      rem.shift();
      rem.push(0);
      for (var j = 0; j < gen.length - 1; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
    return rem;
  }

  // ─── Versionstabel for fejlkorrektionsniveau M ───
  // [datacodewords pr. blok, antal blokke, EC-codewords pr. blok]
  // Alle versioner 1–6 har ens bloklængder på niveau M, hvilket holder
  // interleavingen simpel.
  var VERSIONS = {
    1: { dataPerBlock: 16, blocks: 1, ecPerBlock: 10 },
    2: { dataPerBlock: 28, blocks: 1, ecPerBlock: 16 },
    3: { dataPerBlock: 44, blocks: 1, ecPerBlock: 26 },
    4: { dataPerBlock: 32, blocks: 2, ecPerBlock: 18 },
    5: { dataPerBlock: 43, blocks: 2, ecPerBlock: 24 },
    6: { dataPerBlock: 27, blocks: 4, ecPerBlock: 16 },
  };

  // Justeringsmønstrenes centre pr. version (version 1 har ingen).
  var ALIGNMENT = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };

  function utf8Bytes(str) {
    var out = [];
    var encoded = unescape(encodeURIComponent(str));
    for (var i = 0; i < encoded.length; i++) out.push(encoded.charCodeAt(i) & 0xff);
    return out;
  }

  function pickVersion(byteLen) {
    for (var v = 1; v <= 6; v++) {
      var spec = VERSIONS[v];
      var totalData = spec.dataPerBlock * spec.blocks;
      // 4 bits modeindikator + 8 bits tællefelt = 12 bit overhead
      if (byteLen * 8 + 12 <= totalData * 8) return v;
    }
    return null;
  }

  /** Data → interleavede codewords (data + fejlkorrektion). */
  function buildCodewords(bytes, version) {
    var spec = VERSIONS[version];
    var totalData = spec.dataPerBlock * spec.blocks;

    var bits = [];
    function push(value, len) {
      for (var i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
    }
    push(0b0100, 4);          // byte-mode
    push(bytes.length, 8);    // tællefelt (version 1–9)
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);

    // Terminator + udfyldning til hel byte
    var room = totalData * 8 - bits.length;
    push(0, Math.min(4, room));
    while (bits.length % 8 !== 0) bits.push(0);

    var data = [];
    for (var b = 0; b < bits.length; b += 8) {
      var byte = 0;
      for (var k = 0; k < 8; k++) byte = (byte << 1) | bits[b + k];
      data.push(byte);
    }
    var padBytes = [0xec, 0x11];
    for (var p = 0; data.length < totalData; p++) data.push(padBytes[p % 2]);

    // Blokdeling + fejlkorrektion pr. blok
    var dataBlocks = [];
    var ecBlocks = [];
    for (var blk = 0; blk < spec.blocks; blk++) {
      var block = data.slice(blk * spec.dataPerBlock, (blk + 1) * spec.dataPerBlock);
      dataBlocks.push(block);
      ecBlocks.push(rsRemainder(block, spec.ecPerBlock));
    }

    // Interleaving
    var out = [];
    for (var c = 0; c < spec.dataPerBlock; c++) {
      for (var d = 0; d < spec.blocks; d++) out.push(dataBlocks[d][c]);
    }
    for (var e = 0; e < spec.ecPerBlock; e++) {
      for (var f = 0; f < spec.blocks; f++) out.push(ecBlocks[f][e]);
    }
    return out;
  }

  function makeGrid(size) {
    var g = [];
    for (var i = 0; i < size; i++) g.push(new Array(size).fill(null));
    return g;
  }

  function placeFunctionPatterns(grid, version) {
    var size = grid.length;

    function finder(row, col) {
      for (var r = -1; r <= 7; r++) {
        for (var c = -1; c <= 7; c++) {
          var rr = row + r, cc = col + c;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          var inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                       (c >= 0 && c <= 6 && (r === 0 || r === 6));
          var inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          grid[rr][cc] = (inRing || inCore) ? 1 : 0;
        }
      }
    }
    finder(0, 0);
    finder(0, size - 7);
    finder(size - 7, 0);

    // Timing-mønstre
    for (var i = 8; i < size - 8; i++) {
      grid[6][i] = i % 2 === 0 ? 1 : 0;
      grid[i][6] = i % 2 === 0 ? 1 : 0;
    }

    // Justeringsmønstre (springer dem over der overlapper søgemønstrene)
    var centers = ALIGNMENT[version];
    for (var a = 0; a < centers.length; a++) {
      for (var b = 0; b < centers.length; b++) {
        var cr = centers[a], cc2 = centers[b];
        if ((cr === 6 && cc2 === 6) ||
            (cr === 6 && cc2 === size - 7) ||
            (cr === size - 7 && cc2 === 6)) continue;
        for (var dr = -2; dr <= 2; dr++) {
          for (var dc = -2; dc <= 2; dc++) {
            var m = Math.max(Math.abs(dr), Math.abs(dc));
            grid[cr + dr][cc2 + dc] = (m !== 1) ? 1 : 0;
          }
        }
      }
    }

    // Mørkt modul
    grid[size - 8][8] = 1;

    // Reservér formatinformations-felterne
    for (var f = 0; f <= 8; f++) {
      if (grid[8][f] === null) grid[8][f] = 0;
      if (grid[f][8] === null) grid[f][8] = 0;
    }
    for (var g2 = 0; g2 < 8; g2++) {
      if (grid[8][size - 1 - g2] === null) grid[8][size - 1 - g2] = 0;
      if (grid[size - 1 - g2][8] === null) grid[size - 1 - g2][8] = 0;
    }
  }

  function isFunctionModule(version, size, row, col) {
    if (row === 6 || col === 6) return true;                                  // timing
    if (row < 9 && col < 9) return true;                                      // søgemønster + format (TV)
    if (row < 9 && col >= size - 8) return true;                              // søgemønster + format (TH)
    if (row >= size - 8 && col < 9) return true;                              // søgemønster + format (BV)
    var centers = ALIGNMENT[version];
    for (var a = 0; a < centers.length; a++) {
      for (var b = 0; b < centers.length; b++) {
        var cr = centers[a], cc = centers[b];
        if ((cr === 6 && cc === 6) ||
            (cr === 6 && cc === size - 7) ||
            (cr === size - 7 && cc === 6)) continue;
        if (Math.abs(row - cr) <= 2 && Math.abs(col - cc) <= 2) return true;
      }
    }
    return false;
  }

  function placeData(grid, codewords, version) {
    var size = grid.length;
    var bitIndex = 0;
    var total = codewords.length * 8;

    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5; // kolonne 6 er timing-mønster
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var col = right - j;
          var upward = ((right + 1) & 2) === 0;
          var row = upward ? size - 1 - vert : vert;
          if (isFunctionModule(version, size, row, col)) continue;
          var bit = 0;
          if (bitIndex < total) {
            bit = (codewords[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1;
            bitIndex++;
          }
          grid[row][col] = bit;
        }
      }
    }
  }

  function maskBit(pattern, i, j) {
    switch (pattern) {
      case 0: return (i + j) % 2 === 0;
      case 1: return i % 2 === 0;
      case 2: return j % 3 === 0;
      case 3: return (i + j) % 3 === 0;
      case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
      case 5: return ((i * j) % 2) + ((i * j) % 3) === 0;
      case 6: return ((((i * j) % 2) + ((i * j) % 3)) % 2) === 0;
      default: return ((((i + j) % 2) + ((i * j) % 3)) % 2) === 0;
    }
  }

  var N3_CORE = [1, 0, 1, 1, 1, 0, 1];

  function findCore(seq, size, from) {
    for (var i = from; i + 7 <= size; i++) {
      var hit = true;
      for (var k = 0; k < 7; k++) {
        if (seq[i + k] !== N3_CORE[k]) { hit = false; break; }
      }
      if (hit) return i;
    }
    return -1;
  }

  function n3Occurrences(seq, size) {
    var count = 0;
    var idx = findCore(seq, size, 0);
    while (idx !== -1) {
      var offset = idx + 7;
      var clearBefore = true;
      for (var b = Math.max(idx - 4, 0); b < idx; b++) {
        if (seq[b]) { clearBefore = false; break; }
      }
      var clearAfter = true;
      for (var a = offset; a < Math.min(offset + 4, size); a++) {
        if (seq[a]) { clearAfter = false; break; }
      }
      if (idx === 0 || idx === size - 7 || clearBefore || clearAfter) {
        count += 40;
      } else {
        // Ikke nok lyse moduler — næste mulige match starter inde i
        // det mørke løb (mørk lys mørk MØRK mørk lys mørk).
        offset = idx + 4;
      }
      idx = findCore(seq, size, offset);
    }
    return count;
  }

  function penalty(grid) {
    var size = grid.length;
    var score = 0;

    // Regel 1: løb på 5+ ens moduler
    for (var pass = 0; pass < 2; pass++) {
      for (var a = 0; a < size; a++) {
        var run = 1;
        for (var b = 1; b < size; b++) {
          var cur = pass === 0 ? grid[a][b] : grid[b][a];
          var prev = pass === 0 ? grid[a][b - 1] : grid[b - 1][a];
          if (cur === prev) {
            run++;
          } else {
            if (run >= 5) score += 3 + (run - 5);
            run = 1;
          }
        }
        if (run >= 5) score += 3 + (run - 5);
      }
    }

    // Regel 2: 2×2-blokke i samme farve
    for (var r = 0; r < size - 1; r++) {
      for (var c = 0; c < size - 1; c++) {
        var v = grid[r][c];
        if (v === grid[r][c + 1] && v === grid[r + 1][c] && v === grid[r + 1][c + 1]) score += 3;
      }
    }

    // Regel 3: 1:1:3:1:1-mønsteret (som i søgemønstrene) med fire lyse
    // moduler på mindst én side — eller flugtende med symbolets kant.
    // ISO/IEC 18004:2015, 7.8.3.1.
    for (var d = 0; d < 2; d++) {
      for (var x = 0; x < size; x++) {
        var seq = new Array(size);
        for (var s = 0; s < size; s++) seq[s] = d === 0 ? grid[x][s] : grid[s][x];
        score += n3Occurrences(seq, size);
      }
    }

    // Regel 4: afvigelse fra 50 % mørke moduler
    var dark = 0;
    for (var i = 0; i < size; i++) for (var j = 0; j < size; j++) dark += grid[i][j];
    var percent = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(percent - 50) / 5) * 10;
    return score;
  }

  function placeFormat(grid, mask) {
    var size = grid.length;
    var data = (0b00 << 3) | mask; // 0b00 = fejlkorrektionsniveau M
    var rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >> 9) & 1) * 0x537);
    var bits = ((data << 10) | rem) ^ 0x5412;

    function bit(n) { return (bits >> n) & 1; }

    // Kopi 1: lodret strimmel ved øverste venstre søgemønster, derefter vandret.
    for (var k = 0; k <= 5; k++) grid[k][8] = bit(k);
    grid[7][8] = bit(6);
    grid[8][8] = bit(7);
    grid[8][7] = bit(8);
    for (var m = 9; m <= 14; m++) grid[8][14 - m] = bit(m);

    // Kopi 2: omvendt bit-rækkefølge — nederst til venstre (bit 14→8),
    // derefter øverst til højre (bit 7→0). Modulet (size-8, 8) er det
    // permanent mørke modul og hører ikke til formatfeltet.
    for (var q = 0; q <= 6; q++) grid[size - 1 - q][8] = bit(14 - q);
    for (var p = 0; p <= 7; p++) grid[8][size - 8 + p] = bit(7 - p);
  }

  /** Bygger QR-matricen for `text`. Returnerer et 2D-array af 0/1. */
  function matrix(text) {
    var bytes = utf8Bytes(text);
    var version = pickVersion(bytes.length);
    if (!version) throw new Error('QR: teksten er for lang (maks 106 bytes)');

    var codewords = buildCodewords(bytes, version);
    var size = 17 + 4 * version;

    var best = null;
    var bestScore = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      var grid = makeGrid(size);
      placeFunctionPatterns(grid, version);
      placeData(grid, codewords, version);
      for (var r = 0; r < size; r++) {
        for (var c = 0; c < size; c++) {
          if (!isFunctionModule(version, size, r, c) && maskBit(mask, r, c)) grid[r][c] ^= 1;
        }
      }
      placeFormat(grid, mask);
      var score = penalty(grid);
      if (score < bestScore) { bestScore = score; best = grid; }
    }
    return best;
  }

  /** QR som selvstændig SVG-streng. `quiet` er den hvide margen i moduler. */
  function svg(text, opts) {
    var options = opts || {};
    var grid = matrix(text);
    var size = grid.length;
    var quiet = options.quiet == null ? 4 : options.quiet;
    var total = size + quiet * 2;
    var dark = options.dark || '#1a1a2e';
    var light = options.light || '#ffffff';

    var path = '';
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if (grid[r][c]) path += 'M' + (c + quiet) + ' ' + (r + quiet) + 'h1v1h-1z';
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" ' +
      'shape-rendering="crispEdges" role="img" aria-label="QR-kode med dit partner-link">' +
      '<rect width="' + total + '" height="' + total + '" fill="' + light + '"/>' +
      '<path d="' + path + '" fill="' + dark + '"/></svg>';
  }

  window.flangoQR = { matrix: matrix, svg: svg };
})();
