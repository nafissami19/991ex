// Round-trip / format coverage for tests/pixel/png.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync, crc32 } from 'node:zlib';
import { encodePNG, decodePNG } from './pixel/png.js';

function chunk(type, data) {
  const head = Buffer.alloc(4); head.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([head, td, crc]);
}

// Build a PNG from packed scanlines (without filter bytes), filtering row y with filters[y % n].
function buildPNG({ w, h, depth, ctype, lines, bpp, plte, trns, filters = [0] }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = depth; ihdr[9] = ctype;
  const out = [];
  lines.forEach((line, y) => {
    const prev = y ? lines[y - 1] : Buffer.alloc(line.length);
    const ft = filters[y % filters.length];
    const f = Buffer.alloc(line.length);
    for (let x = 0; x < line.length; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let p = 0;
      if (ft === 1) p = a;
      else if (ft === 2) p = b;
      else if (ft === 3) p = (a + b) >> 1;
      else if (ft === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      f[x] = (line[x] - p) & 0xff;
    }
    out.push(Buffer.from([ft]), f);
  });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    ...(plte ? [chunk('PLTE', plte)] : []),
    ...(trns ? [chunk('tRNS', trns)] : []),
    chunk('IDAT', deflateSync(Buffer.concat(out))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const px = (img, x, y) => [...img.rgba.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];

test('png: RGBA encode/decode round trip', () => {
  const w = 7, h = 5, rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < rgba.length; i++) rgba[i] = (i * 37) & 0xff;
  const img = decodePNG(encodePNG(w, h, rgba));
  assert.equal(img.width, w); assert.equal(img.height, h);
  assert.deepEqual([...img.rgba], [...rgba]);
});

test('png: 8-bit RGB with all five filter types', () => {
  const w = 6, h = 10;
  const lines = Array.from({ length: h }, (_, y) => Buffer.from(Array.from({ length: w * 3 }, (_, i) => (i * 29 + y * 71) & 0xff)));
  const img = decodePNG(buildPNG({ w, h, depth: 8, ctype: 2, lines, bpp: 3, filters: [0, 1, 2, 3, 4] }));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    assert.deepEqual(px(img, x, y), [lines[y][x * 3], lines[y][x * 3 + 1], lines[y][x * 3 + 2], 255]);
  }
});

test('png: 8-bit gray and gray+alpha', () => {
  const g = decodePNG(buildPNG({ w: 3, h: 2, depth: 8, ctype: 0, bpp: 1, filters: [4, 3],
    lines: [Buffer.from([0, 128, 255]), Buffer.from([10, 20, 30])] }));
  assert.deepEqual(px(g, 1, 0), [128, 128, 128, 255]);
  assert.deepEqual(px(g, 2, 1), [30, 30, 30, 255]);
  const ga = decodePNG(buildPNG({ w: 2, h: 1, depth: 8, ctype: 4, bpp: 2, filters: [1],
    lines: [Buffer.from([50, 200, 60, 0])] }));
  assert.deepEqual(px(ga, 0, 0), [50, 50, 50, 200]);
  assert.deepEqual(px(ga, 1, 0), [60, 60, 60, 0]);
});

test('png: 1-bit gray (dot-matrix style)', () => {
  // 10 px wide -> 2 bytes per line
  const img = decodePNG(buildPNG({ w: 10, h: 2, depth: 1, ctype: 0, bpp: 1, filters: [0, 2],
    lines: [Buffer.from([0b10110000, 0b01000000]), Buffer.from([0b00000001, 0b10000000])] }));
  const bits = (y) => Array.from({ length: 10 }, (_, x) => (px(img, x, y)[0] ? 1 : 0)).join('');
  assert.equal(bits(0), '1011000001');
  assert.equal(bits(1), '0000000110');
});

test('png: palette at 2, 4 and 8 bits with tRNS', () => {
  const plte = Buffer.from([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
  const trns = Buffer.from([0, 255, 128]);
  const p2 = decodePNG(buildPNG({ w: 4, h: 1, depth: 2, ctype: 3, bpp: 1, plte, trns, lines: [Buffer.from([0b00011011])] }));
  assert.deepEqual(px(p2, 0, 0), [0, 0, 0, 0]);
  assert.deepEqual(px(p2, 1, 0), [255, 0, 0, 255]);
  assert.deepEqual(px(p2, 2, 0), [0, 255, 0, 128]);
  assert.deepEqual(px(p2, 3, 0), [0, 0, 255, 255]);
  const p4 = decodePNG(buildPNG({ w: 3, h: 1, depth: 4, ctype: 3, bpp: 1, plte, lines: [Buffer.from([0x21, 0x30])] }));
  assert.deepEqual([px(p4, 0, 0), px(p4, 1, 0), px(p4, 2, 0)], [[0, 255, 0, 255], [255, 0, 0, 255], [0, 0, 255, 255]]);
  const p8 = decodePNG(buildPNG({ w: 2, h: 2, depth: 8, ctype: 3, bpp: 1, plte, filters: [1, 4], lines: [Buffer.from([1, 2]), Buffer.from([3, 0])] }));
  assert.deepEqual(px(p8, 1, 1), [0, 0, 0, 255]);
  assert.deepEqual(px(p8, 0, 1), [0, 0, 255, 255]);
});
