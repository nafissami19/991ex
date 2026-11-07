// Generates our own app icons (assets/icons/icon-192.png, icon-512.png). No dependencies.
// Original artwork: a generic calculator glyph on a full-bleed background (safe for maskable).
// Run: node scripts/make_icons.js

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'icons');
const SS = 4; // supersampling per axis

const C = {
  bg: [28, 42, 51], body: [226, 230, 234], lcd: [178, 204, 170], ink: [32, 44, 32],
  key: [62, 70, 80], keyTop: [96, 106, 118], accent: [235, 132, 45],
};

// Shapes in unit coordinates (0..1). Later shapes paint over earlier ones.
function shapes() {
  const s = [];
  const rr = (x, y, w, h, r, color) => s.push({ x, y, w, h, r, color });
  rr(0, 0, 1, 1, 0, C.bg);
  rr(0.24, 0.12, 0.52, 0.76, 0.06, C.body);           // body
  rr(0.29, 0.17, 0.42, 0.17, 0.02, C.lcd);            // screen
  // "1+2" in a 3x5 dot font on the screen
  const font = {
    1: ['010', '110', '010', '010', '111'],
    '+': ['000', '010', '111', '010', '000'],
    2: ['111', '001', '111', '100', '111'],
  };
  const dot = 0.021;
  let cx = 0.45;
  for (const ch of '1+2') {
    font[ch].forEach((row, j) => [...row].forEach((b, i) => {
      if (b === '1') rr(cx + i * dot, 0.205 + j * dot, dot * 0.92, dot * 0.92, 0, C.ink);
    }));
    cx += dot * 4;
  }
  // 4x4 keys; top row lighter, bottom-right accent
  const kx = 0.295, ky = 0.40, kw = 0.085, kh = 0.085, gx = 0.0267, gy = 0.03;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const color = r === 3 && c === 3 ? C.accent : r === 0 ? C.keyTop : C.key;
      rr(kx + c * (kw + gx), ky + r * (kh + gy), kw, kh, 0.018, color);
    }
  }
  return s;
}

function inside(sh, u, v) {
  if (u < sh.x || v < sh.y || u > sh.x + sh.w || v > sh.y + sh.h) return false;
  if (!sh.r) return true;
  const dx = Math.max(sh.x + sh.r - u, 0, u - (sh.x + sh.w - sh.r));
  const dy = Math.max(sh.y + sh.r - v, 0, v - (sh.y + sh.h - sh.r));
  return dx * dx + dy * dy <= sh.r * sh.r;
}

function render(n) {
  const list = shapes();
  const rgba = Buffer.alloc(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / n, v = (y + (sy + 0.5) / SS) / n;
          let col = C.bg;
          for (const sh of list) if (inside(sh, u, v)) col = sh.color;
          acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2];
        }
      }
      const i = (y * n + x) * 4;
      rgba[i] = Math.round(acc[0] / (SS * SS));
      rgba[i + 1] = Math.round(acc[1] / (SS * SS));
      rgba[i + 2] = Math.round(acc[2] / (SS * SS));
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(n, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0);
  ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(n * (n * 4 + 1));
  for (let y = 0; y < n; y++) rgba.copy(raw, y * (n * 4 + 1) + 1, y * n * 4, (y + 1) * n * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const n of [192, 512]) {
  const file = path.join(OUT_DIR, `icon-${n}.png`);
  fs.writeFileSync(file, encodePng(n, render(n)));
  console.log('wrote', path.relative(process.cwd(), file));
}
