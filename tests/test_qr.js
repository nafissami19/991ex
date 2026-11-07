/**
 * QR Code encoder tests (js/core/qr/qrcode.js)
 *
 * Strategy:
 *  1. Published reference vectors (ISO/IEC 18004 Annex example, "HELLO WORLD" 1-M),
 *     known generator polynomial, format and version information words.
 *  2. Table checks: alignment-pattern centres and byte-mode capacity of all
 *     160 version/EC combinations against the published tables.
 *  3. Structural invariants of produced symbols (finders, separators, timing,
 *     alignment, dark module, both format copies, both version blocks).
 *  4. An independent DECODER (written below, sharing no code with the encoder
 *     except the block-count tables, which are validated in step 2): reads format
 *     info, unmasks, reads codewords in zigzag order, de-interleaves, requires all
 *     Reed–Solomon syndromes to be zero, and parses the payload strictly.
 *     Round-trips many random strings across versions 1–11 (+ samples up to 40),
 *     all EC levels and all masks.
 *  5. Optional cross-check against OpenCV's QR decoder (skipped when Python/cv2
 *     is not available).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

import { encodeQR, qrToText, _internal as I } from '../js/core/qr/qrcode.js';

// ---------------------------------------------------------------------------
// Independent reference data
// ---------------------------------------------------------------------------

/** ISO/IEC 18004 Annex E: alignment pattern row/column coordinates. */
const ALIGNMENT_TABLE = [
  null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62],
  [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90],
  [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170],
];

/** Published byte-mode capacity (characters) per version, columns L M Q H. */
const BYTE_CAPACITY = [
  null,
  [17, 14, 11, 7], [32, 26, 20, 14], [53, 42, 32, 24], [78, 62, 46, 34], [106, 84, 60, 44],
  [134, 106, 74, 58], [154, 122, 86, 64], [192, 152, 108, 84], [230, 180, 130, 98], [271, 213, 151, 119],
  [321, 251, 177, 137], [367, 287, 203, 155], [425, 331, 241, 177], [458, 362, 258, 194], [520, 412, 292, 220],
  [586, 450, 322, 250], [644, 504, 364, 280], [718, 560, 394, 310], [792, 624, 442, 338], [858, 666, 482, 382],
  [929, 711, 509, 403], [1003, 779, 565, 439], [1091, 857, 611, 461], [1171, 911, 661, 511], [1273, 997, 715, 535],
  [1367, 1059, 751, 593], [1465, 1125, 805, 625], [1528, 1190, 868, 658], [1628, 1264, 908, 698], [1732, 1370, 982, 742],
  [1840, 1452, 1030, 790], [1952, 1538, 1112, 842], [2068, 1628, 1168, 898], [2188, 1722, 1228, 958], [2303, 1809, 1283, 983],
  [2431, 1911, 1351, 1051], [2563, 1989, 1423, 1093], [2699, 2099, 1499, 1139], [2809, 2213, 1579, 1219], [2953, 2331, 1663, 1273],
];

const LEVELS = ['L', 'M', 'Q', 'H'];

// ---------------------------------------------------------------------------
// Independent decoder
// ---------------------------------------------------------------------------

/** GF(256) multiply by shift-and-add (independent of the encoder's log tables). */
function gmul(a, b) {
  let p = 0;
  while (b) {
    if (b & 1) p ^= a;
    a <<= 1;
    if (a & 0x100) a ^= 0x11d;
    b >>>= 1;
  }
  return p;
}
function gpow(a, n) {
  let r = 1;
  for (let i = 0; i < n; i++) r = gmul(r, a);
  return r;
}

/** Remainder of a binary polynomial division (bit-serial, MSB first). */
function polyMod(value, valueBits, gen, genBits) {
  for (let i = valueBits - 1; i >= genBits - 1; i--) {
    if ((value >>> i) & 1) value ^= gen << (i - (genBits - 1));
  }
  return value;
}

/** Format word for (2-bit ec indicator, 3-bit mask), XOR mask applied. */
function refFormatWord(ecInd, mask) {
  const d = (ecInd << 3) | mask;
  return ((d << 10) | polyMod(d << 10, 15, 0b10100110111, 11)) ^ 0b101010000010010;
}
const EC_FROM_INDICATOR = { 1: 'L', 0: 'M', 3: 'Q', 2: 'H' };

function refVersionWord(v) {
  return (v << 12) | polyMod(v << 12, 18, 0b1111100100101, 13);
}

/** Build the set of function-pattern modules for a version (independent implementation). */
function functionMap(version) {
  const n = version * 4 + 17;
  const f = new Uint8Array(n * n);
  const mark = (r0, c0, h, w) => {
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) if (r >= 0 && c >= 0 && r < n && c < n) f[r * n + c] = 1;
  };
  // finders + separators + format areas
  mark(0, 0, 9, 9);
  mark(0, n - 8, 9, 8);
  mark(n - 8, 0, 8, 9);
  // timing
  mark(6, 0, 1, n);
  mark(0, 6, n, 1);
  // alignment
  const a = ALIGNMENT_TABLE[version];
  for (const r of a) {
    for (const c of a) {
      const nearFinder = (r < 9 && c < 9) || (r < 9 && c > n - 9) || (r > n - 9 && c < 9);
      if (!nearFinder) mark(r - 2, c - 2, 5, 5);
    }
  }
  if (version >= 7) {
    mark(0, n - 11, 6, 3);
    mark(n - 11, 0, 3, 6);
  }
  return f;
}

const MASKS = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (((i / 2) | 0) + ((j / 3) | 0)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i * j) % 3) + ((i + j) % 2)) % 2 === 0,
];

/**
 * Decode a symbol strictly. Throws on any deviation from a clean, valid symbol.
 * @returns {{version, ecLevel, mask, mode, bytes: Uint8Array, text: string|null}}
 */
function decodeSymbol(modules, n) {
  const at = (r, c) => modules[r * n + c];
  const version = (n - 17) / 4;
  assert.ok(Number.isInteger(version) && version >= 1 && version <= 40, 'bad size');

  // --- format information (both copies, MSB first) ---
  const coords1 = [];
  for (let c = 0; c <= 5; c++) coords1.push([8, c]); // bits 14..9
  coords1.push([8, 7], [8, 8], [7, 8]); // bits 8, 7, 6
  for (let r = 5; r >= 0; r--) coords1.push([r, 8]); // bits 5..0
  const coords2 = [];
  for (let r = n - 1; r >= n - 7; r--) coords2.push([r, 8]); // bits 14..8
  for (let c = n - 8; c <= n - 1; c++) coords2.push([8, c]); // bits 7..0
  const readWord = (coords) => coords.reduce((acc, [r, c]) => (acc << 1) | at(r, c), 0);
  const f1 = readWord(coords1);
  const f2 = readWord(coords2);
  assert.equal(f1, f2, 'format info copies differ');
  let ecLevel = null, mask = null;
  for (let e = 0; e < 4; e++) for (let m = 0; m < 8; m++) {
    if (refFormatWord(e, m) === f1) {
      ecLevel = EC_FROM_INDICATOR[e];
      mask = m;
    }
  }
  assert.ok(ecLevel !== null, 'format info is not a valid BCH codeword');
  assert.equal(at(n - 8, 8), 1, 'dark module missing');

  // --- version information ---
  if (version >= 7) {
    let vTR = 0, vBL = 0;
    for (let i = 17; i >= 0; i--) {
      vTR = (vTR << 1) | at(Math.floor(i / 3), n - 11 + (i % 3));
      vBL = (vBL << 1) | at(n - 11 + (i % 3), Math.floor(i / 3));
    }
    assert.equal(vTR, refVersionWord(version), 'top-right version info');
    assert.equal(vBL, refVersionWord(version), 'bottom-left version info');
  }

  // --- unmask & read bits in zigzag order ---
  const fmap = functionMap(version);
  const maskFn = MASKS[mask];
  const bits = [];
  let col = n - 1;
  let goingUp = true;
  while (col > 0) {
    if (col === 6) col--;
    for (let step = 0; step < n; step++) {
      const row = goingUp ? n - 1 - step : step;
      for (const c of [col, col - 1]) {
        if (fmap[row * n + c]) continue;
        bits.push(at(row, c) ^ (maskFn(row, c) ? 1 : 0));
      }
    }
    goingUp = !goingUp;
    col -= 2;
  }
  const totalCw = bits.length >> 3;
  for (let i = totalCw * 8; i < bits.length; i++) assert.equal(bits[i], 0, 'remainder bits must be 0');
  const cw = new Uint8Array(totalCw);
  for (let i = 0; i < totalCw; i++) for (let b = 0; b < 8; b++) cw[i] = (cw[i] << 1) | bits[i * 8 + b];

  // --- de-interleave ---
  const e = I.EC_INDEX[ecLevel];
  const nb = I.NUM_BLOCKS[e][version];
  const ecc = I.ECC_PER_BLOCK[e][version];
  const longCount = totalCw % nb;
  const shortData = Math.floor(totalCw / nb) - ecc;
  const blocks = [];
  for (let b = 0; b < nb; b++) blocks.push({ dataLen: shortData + (b >= nb - longCount ? 1 : 0), data: [], ec: [] });
  let p = 0;
  for (let i = 0; i < shortData + 1; i++) for (const blk of blocks) if (i < blk.dataLen) blk.data.push(cw[p++]);
  for (let i = 0; i < ecc; i++) for (const blk of blocks) blk.ec.push(cw[p++]);
  assert.equal(p, totalCw);

  // --- Reed–Solomon syndromes S_i = c(α^i), i = 0..ecc-1, must all vanish ---
  for (const blk of blocks) {
    const word = [...blk.data, ...blk.ec];
    for (let i = 0; i < ecc; i++) {
      const x = gpow(2, i);
      let s = 0;
      for (const byte of word) s = gmul(s, x) ^ byte;
      assert.equal(s, 0, `non-zero syndrome in block (v${version}-${ecLevel})`);
    }
  }

  // --- parse payload ---
  const data = blocks.flatMap((b) => b.data);
  const dbits = [];
  for (const byte of data) for (let b = 7; b >= 0; b--) dbits.push((byte >> b) & 1);
  let q = 0;
  const take = (k) => {
    assert.ok(q + k <= dbits.length, 'payload overruns data capacity');
    let v = 0;
    for (let i = 0; i < k; i++) v = (v << 1) | dbits[q++];
    return v;
  };
  const vClass = version < 10 ? 0 : version < 27 ? 1 : 2;
  const modeInd = take(4);
  let mode, bytes, text;
  if (modeInd === 0b0100) {
    mode = 'byte';
    const count = take([8, 16, 16][vClass]);
    bytes = new Uint8Array(count);
    for (let i = 0; i < count; i++) bytes[i] = take(8);
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } else if (modeInd === 0b0001) {
    mode = 'numeric';
    let count = take([10, 12, 14][vClass]);
    text = '';
    while (count > 0) {
      const k = Math.min(3, count);
      text += String(take(k * 3 + 1)).padStart(k, '0');
      count -= k;
    }
  } else if (modeInd === 0b0010) {
    mode = 'alphanumeric';
    const A = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
    let count = take([9, 11, 13][vClass]);
    text = '';
    while (count >= 2) {
      const v = take(11);
      text += A[Math.floor(v / 45)] + A[v % 45];
      count -= 2;
    }
    if (count) text += A[take(6)];
  } else {
    assert.fail(`unexpected mode indicator ${modeInd}`);
  }
  // terminator (up to 4 zeros), zero padding to a byte boundary, then EC/11 pad bytes
  const term = Math.min(4, dbits.length - q);
  assert.equal(take(term), 0, 'terminator');
  while (q % 8) assert.equal(take(1), 0, 'bit padding');
  let pad = 0xec;
  while (q < dbits.length) {
    assert.equal(take(8), pad, 'pad codeword');
    pad = pad === 0xec ? 0x11 : 0xec;
  }
  return { version, ecLevel, mask, mode, bytes, text };
}

/** Check the fixed patterns of a symbol. */
function checkStructure(qr) {
  const { size: n, modules: m, version } = qr;
  assert.equal(n, version * 4 + 17);
  assert.equal(m.length, n * n);
  assert.ok(m.every((v) => v === 0 || v === 1));
  const at = (r, c) => m[r * n + c];
  const finderAt = (r0, c0) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r, cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        let expected = 0;
        if (inside) {
          const outer = r === 0 || r === 6 || c === 0 || c === 6;
          const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          expected = outer || core ? 1 : 0;
        }
        assert.equal(at(rr, cc), expected, `finder/separator at ${rr},${cc}`);
      }
    }
  };
  finderAt(0, 0);
  finderAt(0, n - 7);
  finderAt(n - 7, 0);
  for (let i = 8; i <= n - 9; i++) {
    assert.equal(at(6, i), i % 2 === 0 ? 1 : 0, `horizontal timing ${i}`);
    assert.equal(at(i, 6), i % 2 === 0 ? 1 : 0, `vertical timing ${i}`);
  }
  assert.equal(at(n - 8, 8), 1, 'dark module');
  const a = ALIGNMENT_TABLE[version];
  for (const r of a) for (const c of a) {
    if ((r === 6 && c === 6) || (r === 6 && c === a[a.length - 1]) || (r === a[a.length - 1] && c === 6)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const ring = Math.max(Math.abs(dr), Math.abs(dc));
      assert.equal(at(r + dr, c + dc), ring === 1 ? 0 : 1, `alignment ${r},${c}`);
    }
  }
}

// Deterministic PRNG
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
const ASCII = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !"#$%&\'()*+,-./:;<=>?@[]^_{|}~';
const UNICODE = ['é', 'ß', 'π', '√', '∑', '€', '中', '文', '😀', '𝑥', 'Ω', '\n', '\u0000'];
function randomText(rand, maxBytes, unicode) {
  let s = '';
  let bytes = 0;
  const target = Math.floor(rand() * (maxBytes + 1));
  while (true) {
    const ch = unicode && rand() < 0.3 ? UNICODE[Math.floor(rand() * UNICODE.length)] : ASCII[Math.floor(rand() * ASCII.length)];
    const len = new TextEncoder().encode(ch).length;
    if (bytes + len > target) break;
    s += ch;
    bytes += len;
  }
  return s;
}

const utf8Len = (s) => new TextEncoder().encode(s).length;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Reed–Solomon and BCH primitives', () => {
  test('GF(256) tables use 0x11D', () => {
    assert.equal(I.GF_EXP[0], 1);
    assert.equal(I.GF_EXP[8], 0x1d);
    assert.equal(I.GF_EXP[255], 1);
    for (let a = 1; a < 256; a += 7) for (let b = 1; b < 256; b += 11) assert.equal(I.gfMul(a, b), gmul(a, b));
  });

  test('generator polynomial of degree 7 matches the published one', () => {
    // x^7 + α^87 x^6 + α^229 x^5 + α^146 x^4 + α^149 x^3 + α^238 x^2 + α^102 x + α^21
    const expectedExps = [87, 229, 146, 149, 238, 102, 21];
    assert.deepEqual([...I.rsGenerator(7)], expectedExps.map((e) => gpow(2, e)));
  });

  test('ISO/IEC 18004 Annex example "01234567" 1-M codewords', () => {
    const seg = I.makeSegment('01234567', 'numeric');
    const data = I.buildDataCodewords(seg, 1, 'M');
    assert.deepEqual([...data], [0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11]);
    assert.deepEqual([...I.rsRemainder(data, 10)], [0xa5, 0x24, 0xd4, 0xc1, 0xed, 0x36, 0xc7, 0x87, 0x2c, 0x55]);
  });

  test('"HELLO WORLD" 1-M codewords (well-known worked example)', () => {
    const seg = I.makeSegment('HELLO WORLD', 'alphanumeric');
    const data = I.buildDataCodewords(seg, 1, 'M');
    assert.deepEqual([...data], [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17]);
    assert.deepEqual([...I.rsRemainder(data, 10)], [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });

  test('format information words', () => {
    // Published values for mask 0
    assert.equal(I.formatBits('L', 0), 0b111011111000100);
    assert.equal(I.formatBits('M', 0), 0b101010000010010);
    assert.equal(I.formatBits('Q', 0), 0b011010101011111);
    assert.equal(I.formatBits('H', 0), 0b001011010001001);
    // All 32 are valid BCH(15,5) codewords and agree with the reference implementation
    const ind = { L: 1, M: 0, Q: 3, H: 2 };
    for (const ec of LEVELS) for (let m = 0; m < 8; m++) {
      const w = I.formatBits(ec, m);
      assert.equal(polyMod(w ^ 0x5412, 15, 0x537, 11), 0);
      assert.equal(w, refFormatWord(ind[ec], m));
    }
  });

  test('version information words', () => {
    assert.equal(I.versionBits(7), 0x07c94);
    assert.equal(I.versionBits(8), 0x085bc);
    assert.equal(I.versionBits(40), 0x28c69);
    for (let v = 7; v <= 40; v++) {
      assert.equal(polyMod(I.versionBits(v), 18, 0x1f25, 13), 0);
      assert.equal(I.versionBits(v), refVersionWord(v));
    }
  });
});

describe('Tables', () => {
  test('alignment pattern positions for all versions', () => {
    for (let v = 1; v <= 40; v++) assert.deepEqual(I.alignmentPositions(v), ALIGNMENT_TABLE[v], `v${v}`);
  });

  test('byte-mode capacity of every version / EC level matches the published table', () => {
    for (let v = 1; v <= 40; v++) {
      LEVELS.forEach((ec, i) => {
        const overhead = v <= 9 ? 2 : 3; // 4-bit mode + 8/16-bit count, rounded up to bytes
        assert.equal(I.dataCodewordCount(v, ec) - overhead, BYTE_CAPACITY[v][i], `v${v}-${ec}`);
      });
    }
  });

  test('raw codeword counts and block structure are consistent', () => {
    // Known totals of codewords for a few versions
    const totals = { 1: 26, 2: 44, 7: 196, 10: 346, 14: 581, 21: 1156, 40: 3706 };
    for (const [v, t] of Object.entries(totals)) assert.equal(I.getTemplate(+v).rawCodewords, t, `v${v}`);
    for (let v = 1; v <= 40; v++) {
      for (const ec of LEVELS) {
        const e = I.EC_INDEX[ec];
        const nb = I.NUM_BLOCKS[e][v];
        const raw = I.getTemplate(v).rawCodewords;
        // every block has a positive number of data codewords and 7..30 EC codewords
        assert.ok(Math.floor(raw / nb) - I.ECC_PER_BLOCK[e][v] > 0);
        assert.ok(I.ECC_PER_BLOCK[e][v] <= 30 && I.ECC_PER_BLOCK[e][v] >= 7);
      }
    }
    // Spot-check published block layouts: 5-Q = 2×(33,15) + 2×(34,16); 40-H = 20×(45,15) + 61×(46,16)
    const layout = (v, ec) => {
      const e = I.EC_INDEX[ec];
      const nb = I.NUM_BLOCKS[e][v], ecc = I.ECC_PER_BLOCK[e][v], raw = I.getTemplate(v).rawCodewords;
      const long = raw % nb;
      return { short: nb - long, long, shortTotal: Math.floor(raw / nb), shortData: Math.floor(raw / nb) - ecc };
    };
    assert.deepEqual(layout(5, 'Q'), { short: 2, long: 2, shortTotal: 33, shortData: 15 });
    assert.deepEqual(layout(40, 'H'), { short: 20, long: 61, shortTotal: 45, shortData: 15 });
  });
});

describe('Structure', () => {
  test('fixed patterns, format and version info are correct in many symbols', () => {
    const rand = rng(1234);
    for (let v = 1; v <= 40; v++) {
      const ec = LEVELS[v % 4];
      const qr = encodeQR(randomText(rand, Math.min(40, BYTE_CAPACITY[v][I.EC_INDEX[ec]]), true), { ecLevel: ec, version: v });
      checkStructure(qr);
      const d = decodeSymbol(qr.modules, qr.size);
      assert.equal(d.ecLevel, ec);
      assert.equal(d.mask, qr.mask);
      assert.equal(d.version, v);
    }
  });

  test('qrToText renders rows of # and .', () => {
    const qr = encodeQR('hi');
    const txt = qrToText(qr);
    const rows = txt.split('\n');
    assert.equal(rows.length, 21);
    assert.ok(rows.every((r) => /^[#.]{21}$/.test(r)));
    assert.equal(rows[0].slice(0, 8), '#######.');
    assert.equal(rows[13 + 0][8], '#'); // dark module at (4V+9, 8) = (13, 8)
  });
});

describe('Round-trip through independent decoder', () => {
  test('random strings, versions 1–11, all EC levels, all masks', () => {
    const rand = rng(42);
    let count = 0;
    for (let v = 1; v <= 11; v++) {
      for (const ec of LEVELS) {
        const cap = BYTE_CAPACITY[v][I.EC_INDEX[ec]];
        for (let mask = 0; mask < 8; mask++) {
          const text = randomText(rand, cap, mask % 2 === 1);
          const qr = encodeQR(text, { ecLevel: ec, version: v, mask });
          assert.equal(qr.mask, mask);
          const d = decodeSymbol(qr.modules, qr.size);
          assert.deepEqual([d.version, d.ecLevel, d.mask, d.mode, d.text], [v, ec, mask, 'byte', text]);
          count++;
        }
        // full capacity and automatic version/mask selection
        let full = '';
        while (utf8Len(full) < cap) full += ASCII[Math.floor(rand() * ASCII.length)];
        const qr = encodeQR(full, { ecLevel: ec, minVersion: v });
        assert.equal(qr.version, v);
        assert.equal(decodeSymbol(qr.modules, qr.size).text, full);
        count++;
      }
    }
    assert.equal(count, 11 * 4 * 9);
  });

  test('sampled large versions 12–40 at full capacity', () => {
    const rand = rng(7);
    for (let v = 12; v <= 40; v += 1) {
      const ec = LEVELS[(v * 3) % 4];
      const cap = BYTE_CAPACITY[v][I.EC_INDEX[ec]];
      let text = '';
      while (utf8Len(text) < cap) text += ASCII[Math.floor(rand() * ASCII.length)];
      const qr = encodeQR(text, { ecLevel: ec, version: v, mask: v % 8 });
      const d = decodeSymbol(qr.modules, qr.size);
      assert.equal(d.text, text, `v${v}-${ec}`);
    }
  });

  test('version 40 at every EC level (full capacity, auto mask)', () => {
    const rand = rng(40);
    for (const ec of LEVELS) {
      const cap = BYTE_CAPACITY[40][I.EC_INDEX[ec]];
      let text = '';
      while (text.length < cap) text += ASCII[Math.floor(rand() * ASCII.length)];
      const qr = encodeQR(text, { ecLevel: ec });
      assert.equal(qr.version, 40);
      assert.equal(decodeSymbol(qr.modules, qr.size).text, text);
    }
  });

  test('optional numeric / alphanumeric / auto modes', () => {
    for (const [text, mode, expectMode] of [
      ['01234567', 'numeric', 'numeric'],
      ['HELLO WORLD', 'alphanumeric', 'alphanumeric'],
      ['3141592653589793238462643383279', 'auto', 'numeric'],
      ['HTTP://EXAMPLE.COM/A-B $5*2+1%', 'auto', 'alphanumeric'],
      ['sin(30)=0.5', 'auto', 'byte'],
      ['', 'auto', 'numeric'],
    ]) {
      const qr = encodeQR(text, { ecLevel: 'M', mode });
      const d = decodeSymbol(qr.modules, qr.size);
      assert.equal(d.mode, expectMode);
      assert.equal(d.text, text);
    }
    assert.throws(() => encodeQR('abc', { mode: 'numeric' }));
    assert.throws(() => encodeQR('abc', { mode: 'alphanumeric' }));
    // Numeric capacity of 1-L is 41 digits
    assert.equal(encodeQR('1'.repeat(41), { mode: 'numeric' }).version, 1);
    assert.equal(encodeQR('1'.repeat(42), { mode: 'numeric' }).version, 2);
  });
});

describe('Mask selection', () => {
  test('penalty of simple matrices', () => {
    const n = 21;
    const dark = new Uint8Array(n * n).fill(1);
    // rule 1: 21 rows + 21 cols × (21-2); rule 2: 20×20×3; rule 4: 100% dark → 10×10
    assert.equal(I.penalty(dark, n), 42 * 19 + 1200 + 100);
    const checker = new Uint8Array(n * n).map((_, i) => ((i / n | 0) + (i % n)) % 2 === 0 ? 1 : 0);
    assert.equal(I.penalty(checker, n), 0);
    // single finder-like pattern 1011101 with 4 light modules after it, in an otherwise checkered row
    const m = checker.slice();
    const row = 10;
    const pattern = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    for (let c = 0; c < n; c++) m[row * n + c] = c < 10 ? checker[row * n + c] : pattern[c - 10];
    const pen = I.penalty(m, n);
    assert.ok(pen >= 40, `expected rule-3 penalty, got ${pen}`);
  });

  test('automatically chosen mask has the minimum penalty', () => {
    const rand = rng(99);
    for (let k = 0; k < 20; k++) {
      const v = 1 + (k % 10);
      const ec = LEVELS[k % 4];
      const text = randomText(rand, BYTE_CAPACITY[v][I.EC_INDEX[ec]], true);
      const auto = encodeQR(text, { ecLevel: ec, version: v });
      const scores = [];
      for (let mk = 0; mk < 8; mk++) {
        const q = encodeQR(text, { ecLevel: ec, version: v, mask: mk });
        scores.push(I.penalty(q.modules, q.size));
        if (mk === auto.mask) assert.deepEqual(q.modules, auto.modules);
      }
      const best = Math.min(...scores);
      assert.equal(scores[auto.mask], best);
      assert.equal(scores.indexOf(best), auto.mask, 'ties resolved to the lowest mask number');
    }
  });
});

describe('Edge cases', () => {
  test('empty string', () => {
    const qr = encodeQR('');
    assert.equal(qr.version, 1);
    assert.equal(qr.size, 21);
    assert.equal(qr.ecLevel, 'L');
    assert.equal(decodeSymbol(qr.modules, qr.size).text, '');
    for (const ec of LEVELS) assert.equal(decodeSymbol(encodeQR('', { ecLevel: ec }).modules, 21).text, '');
  });

  test('capacity boundary: version 3-L (53 bytes)', () => {
    const fits = 'a'.repeat(53);
    const over = 'a'.repeat(54);
    assert.equal(encodeQR(fits, { ecLevel: 'L' }).version, 3);
    assert.equal(encodeQR(over, { ecLevel: 'L' }).version, 4);
    assert.equal(decodeSymbol(encodeQR(fits, { version: 3 }).modules, 29).text, fits);
    assert.throws(() => encodeQR(over, { version: 3 }), /Data too long/);
    assert.throws(() => encodeQR(over, { maxVersion: 3 }), /Data too long/);
  });

  test('capacity boundary: version 11-L (321 bytes)', () => {
    const fits = 'z'.repeat(321);
    const over = 'z'.repeat(322);
    const qr = encodeQR(fits);
    assert.equal(qr.version, 11);
    assert.equal(decodeSymbol(qr.modules, qr.size).text, fits);
    assert.equal(encodeQR(over).version, 12);
    assert.throws(() => encodeQR(over, { version: 11 }), /Data too long/);
  });

  test('UTF-8 multi-byte text counts bytes, not characters', () => {
    const t1 = 'é'.repeat(8) + 'a'; // 17 bytes → fits 1-L
    const t2 = 'é'.repeat(9); // 18 bytes → needs version 2
    assert.equal(encodeQR(t1).version, 1);
    assert.equal(encodeQR(t2).version, 2);
    for (const text of ['∫₀¹ x² dx = ⅓', '日本語のテキスト', 'emoji 😀🎉 and 𝑥', 'Ω≈π√∑∞', t1, t2]) {
      const qr = encodeQR(text, { ecLevel: 'Q' });
      const d = decodeSymbol(qr.modules, qr.size);
      assert.equal(d.text, text);
      assert.deepEqual([...d.bytes], [...new TextEncoder().encode(text)]);
    }
  });

  test('Data too long', () => {
    assert.throws(() => encodeQR('x'.repeat(2954)), /Data too long/);
    assert.throws(() => encodeQR('x'.repeat(1274), { ecLevel: 'H' }), /Data too long/);
    assert.equal(encodeQR('x'.repeat(2953)).version, 40);
    assert.throws(() => encodeQR('x'.repeat(18), { maxVersion: 1 }), /Data too long/);
  });

  test('minVersion / version / option validation', () => {
    assert.equal(encodeQR('a', { minVersion: 5 }).version, 5);
    assert.equal(encodeQR('a', { version: 7 }).version, 7);
    assert.equal(encodeQR('a', { ecLevel: 'h' }).ecLevel, 'H');
    assert.throws(() => encodeQR('a', { ecLevel: 'X' }));
    assert.throws(() => encodeQR('a', { mask: 8 }));
    assert.throws(() => encodeQR('a', { version: 41 }));
    assert.throws(() => encodeQR('a', { minVersion: 5, maxVersion: 4 }));
  });

  test('deterministic output', () => {
    const a = encodeQR('determinism', { ecLevel: 'M' });
    const b = encodeQR('determinism', { ecLevel: 'M' });
    assert.deepEqual(a, b);
  });
});

describe('Performance', () => {
  test('~300-byte string at version 11 encodes well under 50 ms', () => {
    const text = 'The quick brown fox jumps over the lazy dog. '.repeat(7).slice(0, 300);
    encodeQR(text); // warm-up (template cache, JIT)
    const runs = 10;
    const t0 = performance.now();
    let qr;
    for (let i = 0; i < runs; i++) qr = encodeQR(text + i);
    const avg = (performance.now() - t0) / runs;
    assert.equal(qr.version, 11);
    assert.ok(avg < 50, `average ${avg.toFixed(2)} ms`);
  });
});

// ---------------------------------------------------------------------------
// Optional: cross-check with OpenCV's QR decoder, if available locally
// ---------------------------------------------------------------------------

const PY_DECODER = `
import sys, json
import numpy as np, cv2
syms = json.loads(sys.stdin.buffer.read().decode('utf-8'))
dets = [cv2.QRCodeDetector()]
if hasattr(cv2, 'QRCodeDetectorAruco'):
    dets.append(cv2.QRCodeDetectorAruco())
out = []
for s in syms:
    n = s['size']
    m = np.array(s['m'], dtype=np.uint8).reshape(n, n)
    res = None
    for scale in (4, 6, 8, 3, 5, 10):
        img = np.kron(np.where(m == 1, 0, 255).astype(np.uint8), np.ones((scale, scale), dtype=np.uint8))
        img = cv2.copyMakeBorder(img, 4*scale, 4*scale, 4*scale, 4*scale, cv2.BORDER_CONSTANT, value=255)
        for d in dets:
            txt, pts, _ = d.detectAndDecode(img)
            if txt:
                res = txt
                break
        if res is not None:
            break
    out.append(res)
sys.stdout.buffer.write(json.dumps(out).encode('utf-8'))
`;

function findPythonWithCv2() {
  for (const exe of ['python', 'python3', 'py']) {
    try {
      const r = spawnSync(exe, ['-I', '-c', 'import cv2, numpy'], { timeout: 20000 });
      if (r.status === 0) return exe;
    } catch {
      /* not available */
    }
  }
  return null;
}

describe('Cross-check with OpenCV (optional)', () => {
  const py = findPythonWithCv2();
  test('OpenCV decodes our symbols to the same text (versions 1–40, all EC levels)', { skip: py ? false : 'python + opencv not available' }, () => {
    const rand = rng(2024);
    const syms = [];
    for (let v = 1; v <= 40; v++) {
      const ec = LEVELS[v % 4];
      const cap = BYTE_CAPACITY[v][I.EC_INDEX[ec]];
      // ASCII only: OpenCV's handling of non-ASCII byte payloads varies by build
      let text = '';
      const target = Math.max(1, Math.floor(cap * (0.5 + rand() * 0.5)));
      while (text.length < target) text += ASCII[Math.floor(rand() * 62)];
      const qr = encodeQR(text, { ecLevel: ec, version: v });
      syms.push({ text, size: qr.size, m: Array.from(qr.modules) });
    }
    const r = spawnSync(py, ['-I', '-c', PY_DECODER], {
      input: JSON.stringify(syms.map(({ size, m }) => ({ size, m }))),
      maxBuffer: 64 * 1024 * 1024,
      timeout: 300000,
    });
    assert.equal(r.status, 0, String(r.stderr));
    const decoded = JSON.parse(r.stdout.toString('utf-8'));
    const failures = syms.map((s, i) => (decoded[i] === s.text ? null : i + 1)).filter((x) => x !== null);
    assert.deepEqual(failures, [], `versions not decoded by OpenCV: ${failures.join(', ')}`);
  });
});
