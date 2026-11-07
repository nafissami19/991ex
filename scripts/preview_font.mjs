// Renders the LCD bitmap fonts / menu icons to a PNG for visual inspection.
//   node scripts/preview_font.mjs [large|small|icons] [out.png]
//   node scripts/preview_font.mjs text "1.234567891×10" [out.png]
import { writeFileSync } from 'node:fs';
import { encodePNG } from '../tests/pixel/png.js';
import large from '../js/lcd/fonts/large.js';
import small from '../js/lcd/fonts/small.js';
import icons from '../js/lcd/fonts/icons.js';

const S = 4; // scale
const C = {
  on: [0x1a, 0x22, 0x1a],
  off: [0xc8, 0xd7, 0xc8],
  grid: [0xb4, 0xc4, 0xb4],
  outside: [0xee, 0xee, 0xee],
  gridOutside: [0xdd, 0xdd, 0xdd],
  base: [0xd0, 0x40, 0x40],
  sep: [0x80, 0x80, 0x80],
};

// Logical bitmap: per-pixel state 0=outside, 1=off, 2=on.
class Bitmap {
  constructor(w, h, fill = 1) {
    this.w = w; this.h = h;
    this.px = new Uint8Array(w * h).fill(fill);
    this.hlines = []; // [y, x0, x1, color] drawn on top (at top edge of row y)
  }
  set(x, y, v) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = v; }
  get(x, y) { return this.px[y * this.w + x]; }
  rect(x, y, w, h, v) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, v); }
  blitRows(rows, x, y, invert = false) {
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) this.set(x + i, y + j, (r[i] === '#') !== invert ? 2 : 1); });
  }
  toPNG() {
    const W = this.w * S, H = this.h * S;
    const out = new Uint8Array(W * H * 4);
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
      const v = this.get((X / S) | 0, (Y / S) | 0);
      const edge = X % S === S - 1 || Y % S === S - 1;
      const c = v === 2 ? C.on : v === 1 ? (edge ? C.grid : C.off) : (edge ? C.gridOutside : C.outside);
      const o = (Y * W + X) * 4;
      out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255;
    }
    for (const [y, x0, x1, c] of this.hlines) {
      for (let X = x0 * S; X < x1 * S; X++) {
        const o = (y * S * W + X) * 4 - W * 4; // line just above row y
        if (o < 0) continue;
        out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2];
      }
    }
    return encodePNG(W, H, out);
  }
}

function drawText(bm, font, text, x, top) {
  for (const ch of text) {
    const g = font.glyphs[ch] ?? font.glyphs['?'];
    bm.blitRows(g.rows, x, top);
    x += g.w;
  }
  return x;
}
const measure = (font, text) => [...text].reduce((s, ch) => s + (font.glyphs[ch] ?? font.glyphs['?']).w, 0);

function glyphSheet(font) {
  const chars = Object.keys(font.glyphs);
  const H = font.ascent + font.descent;
  const maxW = Math.max(...chars.map((c) => font.glyphs[c].w));
  const cols = 16, cw = maxW + 2, ch = H + 2;
  const rows = Math.ceil(chars.length / cols);
  const bm = new Bitmap(cols * cw, rows * ch, 0);
  chars.forEach((c, i) => {
    const x = (i % cols) * cw + 1, y = ((i / cols) | 0) * ch + 1;
    bm.blitRows(font.glyphs[c].rows, x, y);
    bm.hlines.push([y + font.ascent, x, x + font.glyphs[c].w, C.base]);
  });
  for (let r = 0; r < rows; r++) {
    const line = chars.slice(r * cols, r * cols + cols).join(' ');
    console.log(`row ${String(r).padStart(2)}: ${line}`);
  }
  return bm;
}

function iconSheet() {
  const names = Object.keys(icons.icons);
  const cw = 48, ch = 31, cols = 4;
  const rows = Math.ceil(names.length / cols) + 1;
  const bm = new Bitmap(cols * cw, rows * ch, 1);
  names.forEach((n, i) => {
    bm.blitRows(icons.icons[n].rows, (i % cols) * cw + 1, ((i / cols) | 0) * ch + 1);
  });
  // last row: first 4 icons shown "selected" (inverted cell)
  const y0 = (rows - 1) * ch;
  names.slice(0, 4).forEach((n, i) => {
    bm.rect(i * cw, y0, cw, ch, 2);
    bm.blitRows(icons.icons[n].rows, i * cw + 1, y0 + 1, true);
  });
  console.log(names.join(', '));
  return bm;
}

function textSample(text) {
  const sup = '12';
  const lines = [
    { font: large, text, sup },
    { font: small, text, sup: '-5' },
    { font: large, text: 'Ans×2÷√(3)=0.5π' },
    { font: small, text: 'The quick brown fox jumps 0123456789' },
  ];
  const width = Math.max(192, ...lines.map((l) => measure(l.font, l.text) + (l.sup ? measure(small, l.sup) : 0) + 4));
  const height = Math.max(63, lines.reduce((s, l) => s + l.font.lineHeight + 3, 2));
  const bm = new Bitmap(width, height, 1);
  let top = 3;
  for (const l of lines) {
    const x = drawText(bm, l.font, l.text, 1, top);
    // superscript: small-font baseline raised to ~40% of the base font's cap height
    if (l.sup) drawText(bm, small, l.sup, x, top + Math.round(l.font.ascent * 0.4) - small.ascent);
    top += l.font.lineHeight + 3;
  }
  return bm;
}

const [mode = 'large', a1, a2] = process.argv.slice(2);
let bm, out;
if (mode === 'text') { bm = textSample(a1 ?? '1.234567891×10'); out = a2 ?? 'preview_text.png'; }
else if (mode === 'icons') { bm = iconSheet(); out = a1 ?? 'preview_icons.png'; }
else if (mode === 'large' || mode === 'small') { bm = glyphSheet(mode === 'large' ? large : small); out = a1 ?? `preview_${mode}.png`; }
else { console.error('usage: preview_font.mjs [large|small|icons] [out.png] | text "string" [out.png]'); process.exit(1); }
writeFileSync(out, bm.toPNG());
console.log(`wrote ${out} (${bm.w * S}x${bm.h * S})`);
