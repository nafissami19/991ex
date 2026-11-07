/**
 * QR Code (Model 2) encoder — ISO/IEC 18004.
 *
 * Self-contained, dependency-free, runs in Node and the browser.
 *
 *   encodeQR(text, { ecLevel, minVersion, maxVersion, version, mask, mode })
 *     -> { version, size, ecLevel, mask, modules: Uint8Array(size*size) }  (1 = dark, row-major)
 *
 * Supported: versions 1–40, EC levels L/M/Q/H, byte mode (UTF-8) by default.
 * Optional `mode`: 'byte' (default) | 'numeric' | 'alphanumeric' | 'auto'
 * ('auto' picks numeric/alphanumeric when the whole text allows it, else byte).
 */

// ---------------------------------------------------------------------------
// GF(256) arithmetic, primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D)
// ---------------------------------------------------------------------------

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

const generatorCache = new Map();

/**
 * Generator polynomial g(x) = (x - α^0)(x - α^1)…(x - α^(n-1)).
 * Returned as coefficients of x^(n-1)…x^0 (the leading 1 for x^n is implicit).
 */
function rsGenerator(degree) {
  let g = generatorCache.get(degree);
  if (g) return g;
  // poly[i] is coefficient of x^(len-1-i); start with "1"
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const root = GF_EXP[i];
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]; // * x
      next[j + 1] ^= gfMul(poly[j], root); // * α^i  (subtraction == addition)
    }
    poly = next;
  }
  g = Uint8Array.from(poly.slice(1));
  generatorCache.set(degree, g);
  return g;
}

/** Remainder of data(x)·x^n divided by g(x): the n EC codewords. */
function rsRemainder(data, degree) {
  const gen = rsGenerator(degree);
  const rem = new Uint8Array(degree);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[degree - 1] = 0;
    if (factor !== 0) {
      const lf = GF_LOG[factor];
      for (let j = 0; j < degree; j++) {
        if (gen[j] !== 0) rem[j] ^= GF_EXP[lf + GF_LOG[gen[j]]];
      }
    }
  }
  return rem;
}

// ---------------------------------------------------------------------------
// Tables (ISO/IEC 18004 Table 9): EC codewords per block and number of blocks
// indexed [ecIndex][version], ecIndex: L=0, M=1, Q=2, H=3.
// ---------------------------------------------------------------------------

const EC_INDEX = { L: 0, M: 1, Q: 2, H: 3 };
/** 2-bit EC level indicator used in format information. */
const EC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

const ECC_PER_BLOCK = [
  // L
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  // M
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  // Q
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  // H
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];

const NUM_BLOCKS = [
  // L
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  // M
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  // Q
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  // H
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

/** Alignment pattern centre coordinates (same list for rows and columns). */
function alignmentPositions(version) {
  if (version === 1) return [];
  const size = version * 4 + 17;
  const count = Math.floor(version / 7) + 2;
  // Evenly spaced from the last position back to 6, step is even.
  const step = version === 32 ? 26 : Math.ceil((size - 13) / (count - 1) / 2) * 2;
  const result = [6];
  for (let pos = size - 7, i = 0; i < count - 1; i++, pos -= step) result.splice(1, 0, pos);
  return result;
}

// ---------------------------------------------------------------------------
// BCH codes for format and version information
// ---------------------------------------------------------------------------

/** 15-bit format information word (already XOR-masked with 0x5412). */
function formatBits(ecLevel, mask) {
  const data = (EC_FORMAT_BITS[ecLevel] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | (rem & 0x3ff)) ^ 0x5412;
}

/** 18-bit version information word (versions ≥ 7). */
function versionBits(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | (rem & 0xfff);
}

// ---------------------------------------------------------------------------
// Function-pattern template per version
// ---------------------------------------------------------------------------

const templateCache = new Map();

function getTemplate(version) {
  let t = templateCache.get(version);
  if (t) return t;
  const size = version * 4 + 17;
  const base = new Uint8Array(size * size); // values of function modules
  const isFn = new Uint8Array(size * size); // 1 = function module (not data)
  const set = (r, c, dark) => {
    base[r * size + c] = dark ? 1 : 0;
    isFn[r * size + c] = 1;
  };

  // Finder patterns + separators
  const finder = (r0, c0) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr, c = c0 + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const ring = Math.max(Math.abs(dr - 3), Math.abs(dc - 3)); // 0..4
        set(r, c, ring !== 2 && ring !== 4);
      }
    }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const pos = alignmentPositions(version);
  const last = pos.length - 1;
  for (let i = 0; i <= last; i++) {
    for (let j = 0; j <= last; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      const rc = pos[i], cc = pos[j];
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          set(rc + dr, cc + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
        }
      }
    }
  }

  // Reserve format information areas (filled per mask) + dark module
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      set(8, i, 0);
      set(i, 8, 0);
    }
  }
  for (let i = 0; i < 8; i++) {
    set(8, size - 1 - i, 0);
    set(size - 1 - i, 8, 0);
  }
  set(size - 8, 8, 1); // dark module

  // Version information
  if (version >= 7) {
    const vb = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = (vb >>> i) & 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(b, a, bit); // top-right block: 6 rows × 3 columns
      set(a, b, bit); // bottom-left block: 3 rows × 6 columns
    }
  }

  // Data module placement order (zigzag, two columns at a time, right to left)
  const order = [];
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip vertical timing column
    for (let k = 0; k < size; k++) {
      const r = upward ? size - 1 - k : k;
      for (let d = 0; d < 2; d++) {
        const c = right - d;
        const idx = r * size + c;
        if (!isFn[idx]) order.push(idx);
      }
    }
    upward = !upward;
  }

  t = { version, size, base, isFn, order: Int32Array.from(order), rawCodewords: order.length >>> 3 };
  templateCache.set(version, t);
  return t;
}

/** Number of data codewords available for a version / EC level. */
function dataCodewordCount(version, ecLevel) {
  const e = EC_INDEX[ecLevel];
  return getTemplate(version).rawCodewords - ECC_PER_BLOCK[e][version] * NUM_BLOCKS[e][version];
}

// ---------------------------------------------------------------------------
// Data encoding
// ---------------------------------------------------------------------------

const ALNUM_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

function utf8Bytes(text) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
  // Fallback (very old environments)
  const out = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return Uint8Array.from(out);
}

class BitBuffer {
  constructor() {
    this.bits = [];
  }
  put(value, length) {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
  get length() {
    return this.bits.length;
  }
}

const MODES = {
  numeric: { indicator: 0b0001, countBits: [10, 12, 14] },
  alphanumeric: { indicator: 0b0010, countBits: [9, 11, 13] },
  byte: { indicator: 0b0100, countBits: [8, 16, 16] },
};

function countBitsFor(mode, version) {
  const idx = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  return MODES[mode].countBits[idx];
}

/** Build a single segment: { mode, count, dataBits(BitBuffer) }. */
function makeSegment(text, mode) {
  if (mode === 'auto') {
    if (/^[0-9]*$/.test(text)) mode = 'numeric';
    else if ([...text].every((ch) => ALNUM_CHARS.includes(ch))) mode = 'alphanumeric';
    else mode = 'byte';
  }
  const bb = new BitBuffer();
  let count;
  if (mode === 'numeric') {
    if (!/^[0-9]*$/.test(text)) throw new Error('Text not encodable in numeric mode');
    count = text.length;
    for (let i = 0; i < text.length; i += 3) {
      const chunk = text.substr(i, 3);
      bb.put(parseInt(chunk, 10), chunk.length * 3 + 1);
    }
  } else if (mode === 'alphanumeric') {
    count = text.length;
    const vals = [];
    for (const ch of text) {
      const v = ALNUM_CHARS.indexOf(ch);
      if (v < 0) throw new Error('Text not encodable in alphanumeric mode');
      vals.push(v);
    }
    for (let i = 0; i + 1 < vals.length; i += 2) bb.put(vals[i] * 45 + vals[i + 1], 11);
    if (vals.length % 2) bb.put(vals[vals.length - 1], 6);
  } else if (mode === 'byte') {
    const bytes = utf8Bytes(text);
    count = bytes.length;
    for (const b of bytes) bb.put(b, 8);
  } else {
    throw new Error(`Unknown mode: ${mode}`);
  }
  return { mode, count, dataBits: bb.bits };
}

/** Total bits for the segment at a given version, or Infinity if count overflows. */
function segmentBitLength(seg, version) {
  const cb = countBitsFor(seg.mode, version);
  if (seg.count >= 1 << cb) return Infinity;
  return 4 + cb + seg.dataBits.length;
}

/** Produce the final data codeword sequence (with terminator & padding). */
function buildDataCodewords(seg, version, ecLevel) {
  const capacityBits = dataCodewordCount(version, ecLevel) * 8;
  const bb = new BitBuffer();
  bb.put(MODES[seg.mode].indicator, 4);
  bb.put(seg.count, countBitsFor(seg.mode, version));
  for (const b of seg.dataBits) bb.bits.push(b);
  // Terminator (up to 4 zero bits), then pad to byte boundary
  bb.put(0, Math.min(4, capacityBits - bb.length));
  bb.put(0, (8 - (bb.length % 8)) % 8);
  const out = new Uint8Array(capacityBits / 8);
  const nBytes = bb.length >>> 3;
  for (let i = 0; i < nBytes; i++) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bb.bits[i * 8 + j];
    out[i] = v;
  }
  for (let i = nBytes, pad = 0xec; i < out.length; i++, pad ^= 0xec ^ 0x11) out[i] = pad;
  return out;
}

/** Split data into blocks, compute EC, and interleave into the final codeword stream. */
function addEcAndInterleave(data, version, ecLevel) {
  const e = EC_INDEX[ecLevel];
  const numBlocks = NUM_BLOCKS[e][version];
  const eccLen = ECC_PER_BLOCK[e][version];
  const raw = getTemplate(version).rawCodewords;
  const numLong = raw % numBlocks;
  const numShort = numBlocks - numLong;
  const shortLen = Math.floor(raw / numBlocks) - eccLen; // data codewords in a short block

  const dataBlocks = [];
  const eccBlocks = [];
  let k = 0;
  for (let i = 0; i < numBlocks; i++) {
    const len = shortLen + (i < numShort ? 0 : 1);
    const blk = data.subarray(k, k + len);
    k += len;
    dataBlocks.push(blk);
    eccBlocks.push(rsRemainder(blk, eccLen));
  }
  if (k !== data.length) throw new Error('Internal error: block split mismatch');

  const result = new Uint8Array(raw);
  let p = 0;
  for (let i = 0; i <= shortLen; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i < dataBlocks[b].length) result[p++] = dataBlocks[b][i];
    }
  }
  for (let i = 0; i < eccLen; i++) {
    for (let b = 0; b < numBlocks; b++) result[p++] = eccBlocks[b][i];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Masking & penalty
// ---------------------------------------------------------------------------

const MASK_FUNCS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function drawFormat(modules, size, ecLevel, mask) {
  const bits = formatBits(ecLevel, mask);
  const bit = (i) => (bits >>> i) & 1;
  // Copy 1 around the top-left finder
  for (let i = 0; i <= 5; i++) modules[i * size + 8] = bit(i);
  modules[7 * size + 8] = bit(6);
  modules[8 * size + 8] = bit(7);
  modules[8 * size + 7] = bit(8);
  for (let i = 9; i < 15; i++) modules[8 * size + (14 - i)] = bit(i);
  // Copy 2: row 8 at the right (bits 0..7), column 8 at the bottom (bits 8..14)
  for (let i = 0; i < 8; i++) modules[8 * size + (size - 1 - i)] = bit(i);
  for (let i = 8; i < 15; i++) modules[(size - 15 + i) * size + 8] = bit(i);
  modules[(size - 8) * size + 8] = 1; // dark module
}

/** Penalty score per ISO/IEC 18004 §7.8.3 (N1=3, N2=3, N3=40, N4=10). */
function penalty(m, size) {
  let score = 0;
  let dark = 0;

  // Rule 1 (runs ≥ 5) and Rule 3 (1:1:3:1:1 finder-like pattern with 4 light modules) on rows and columns
  for (let pass = 0; pass < 2; pass++) {
    const at = pass === 0 ? (a, b) => m[a * size + b] : (a, b) => m[b * size + a];
    for (let a = 0; a < size; a++) {
      let runColor = -1;
      let runLen = 0;
      for (let b = 0; b < size; b++) {
        const v = at(a, b);
        if (pass === 0) dark += v;
        if (v === runColor) runLen++;
        else {
          if (runLen >= 5) score += runLen - 2;
          runColor = v;
          runLen = 1;
        }
        // Finder-like core 1 0 1 1 1 0 1 ending at b
        if (
          b >= 6 &&
          v === 1 &&
          at(a, b - 1) === 0 &&
          at(a, b - 2) === 1 &&
          at(a, b - 3) === 1 &&
          at(a, b - 4) === 1 &&
          at(a, b - 5) === 0 &&
          at(a, b - 6) === 1
        ) {
          const start = b - 6;
          let lightBefore = true;
          for (let k = start - 4; k < start; k++) if (k >= 0 && at(a, k) !== 0) lightBefore = false;
          let lightAfter = true;
          for (let k = b + 1; k <= b + 4; k++) if (k < size && at(a, k) !== 0) lightAfter = false;
          if (lightBefore || lightAfter) score += 40;
        }
      }
      if (runLen >= 5) score += runLen - 2;
    }
  }

  // Rule 2: 2×2 blocks of one colour
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r * size + c];
      if (v === m[r * size + c + 1] && v === m[(r + 1) * size + c] && v === m[(r + 1) * size + c + 1]) score += 3;
    }
  }

  // Rule 4: proportion of dark modules, 10 points per full 5% deviation from 50%
  const total = size * size;
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
  return score;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encode text as a QR Code symbol.
 * @param {string} text
 * @param {{ecLevel?: 'L'|'M'|'Q'|'H', minVersion?: number, maxVersion?: number,
 *          version?: number|null, mask?: number|null, mode?: 'byte'|'numeric'|'alphanumeric'|'auto'}} [opts]
 * @returns {{version:number, size:number, ecLevel:string, mask:number, modules:Uint8Array}}
 */
export function encodeQR(
  text,
  { ecLevel = 'L', minVersion = 1, maxVersion = 40, version = null, mask = null, mode = 'byte' } = {},
) {
  text = String(text ?? '');
  ecLevel = String(ecLevel).toUpperCase();
  if (!(ecLevel in EC_INDEX)) throw new Error(`Invalid EC level: ${ecLevel}`);
  if (mask !== null && mask !== undefined && !(Number.isInteger(mask) && mask >= 0 && mask <= 7)) {
    throw new Error(`Invalid mask: ${mask}`);
  }

  const seg = makeSegment(text, mode);
  const fits = (v) => segmentBitLength(seg, v) <= dataCodewordCount(v, ecLevel) * 8;

  let ver;
  if (version !== null && version !== undefined) {
    if (!(Number.isInteger(version) && version >= 1 && version <= 40)) throw new Error(`Invalid version: ${version}`);
    if (!fits(version)) throw new Error('Data too long');
    ver = version;
  } else {
    if (!(Number.isInteger(minVersion) && Number.isInteger(maxVersion) && 1 <= minVersion && minVersion <= maxVersion && maxVersion <= 40)) {
      throw new Error(`Invalid version range: ${minVersion}..${maxVersion}`);
    }
    for (let v = minVersion; v <= maxVersion; v++) {
      if (fits(v)) {
        ver = v;
        break;
      }
    }
    if (ver === undefined) throw new Error('Data too long');
  }

  const tpl = getTemplate(ver);
  const { size, order } = tpl;
  const codewords = addEcAndInterleave(buildDataCodewords(seg, ver, ecLevel), ver, ecLevel);

  // Unmasked matrix: function patterns + data bits (remainder bits stay 0)
  const unmasked = tpl.base.slice();
  const nBits = codewords.length * 8;
  for (let i = 0; i < nBits; i++) {
    unmasked[order[i]] = (codewords[i >>> 3] >>> (7 - (i & 7))) & 1;
  }

  const build = (mk) => {
    const out = unmasked.slice();
    const fn = MASK_FUNCS[mk];
    for (let i = 0; i < order.length; i++) {
      const idx = order[i];
      const r = (idx / size) | 0;
      const c = idx - r * size;
      if (fn(r, c)) out[idx] ^= 1;
    }
    drawFormat(out, size, ecLevel, mk);
    return out;
  };

  let bestMask = mask;
  let modules;
  if (bestMask === null || bestMask === undefined) {
    let bestScore = Infinity;
    for (let mk = 0; mk < 8; mk++) {
      const cand = build(mk);
      const s = penalty(cand, size);
      if (s < bestScore) {
        bestScore = s;
        bestMask = mk;
        modules = cand;
      }
    }
  } else {
    modules = build(bestMask);
  }

  return { version: ver, size, ecLevel, mask: bestMask, modules };
}

/** Render a symbol as rows of '#' (dark) and '.' (light), for debugging. */
export function qrToText(qr) {
  const rows = [];
  for (let r = 0; r < qr.size; r++) {
    let s = '';
    for (let c = 0; c < qr.size; c++) s += qr.modules[r * qr.size + c] ? '#' : '.';
    rows.push(s);
  }
  return rows.join('\n');
}

/** Internals exposed for tests. Not part of the stable API. */
export const _internal = {
  GF_EXP,
  GF_LOG,
  gfMul,
  rsGenerator,
  rsRemainder,
  formatBits,
  versionBits,
  alignmentPositions,
  dataCodewordCount,
  getTemplate,
  penalty,
  ECC_PER_BLOCK,
  NUM_BLOCKS,
  EC_INDEX,
  makeSegment,
  buildDataCodewords,
  addEcAndInterleave,
};
