/**
 * Pixel tests against the OFFICIAL emulator screen.
 *
 * tests/pixel/reference/*.json are made by scripts/lcd_from_screenshots.py from screenshots of the
 * official fx-991EX emulator (docs/reference/screenshots/). They are local-only (Casio-derived),
 * so this test is skipped when they are missing. Our output is never compared with itself.
 *
 * On a mismatch, tests/pixel/out/<name>.png shows official | ours | diff
 * (red = dark only in ours, blue = dark only in the official screen).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Calculator } from '../js/core/Calculator.js';
import { TRACED_FONT } from '../js/lcd/raster.js';
import { encodePNG } from './pixel/png.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REF_DIR = path.join(HERE, 'pixel', 'reference');
const OUT_DIR = path.join(HERE, 'pixel', 'out');
const W = 192;
const H = 63;
const STATUS_NAMES = ['S', 'A', 'M', 'STO', 'Math', 'D', 'R', 'G', 'FIX', 'SCI', 'E', 'i', '∠', 'Disp',
  'Left', 'Down', 'Up', 'Right', 'Pause'];

// Rows that differ on purpose. Keep this list short and explain every entry.
const KNOWN_DIFF_ROWS = {
  // Our OPTN menu has a 4th item ("Number Calculation": Abs, Int, Intg, Rnd); the official screen
  // shows 3 items. Int/Intg are only reachable from there, so it stays until that is decided.
  optn_calc: [49, 63],
};

// Single dots that are blur in the screenshots, not layout: the same glyph or icon decodes slightly
// differently in two official screenshots (e.g. icons 5-8 differ by exactly these 8 dots between
// menu_sel1 and menu_page2_selC). Font and icons take the majority, so a few dots stay unmatched.
const SCREENSHOT_NOISE = {
  menu_page2_selC: 8,
  setup_p1: 4,
  calc_88554x4_58776_result: 1,
};

const refs = fs.existsSync(REF_DIR)
  ? fs.readdirSync(REF_DIR).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(REF_DIR, f), 'utf8')))
  : [];

function writeReport(name, want, got) {
  const S = 3;
  const gap = 4;
  const PW = (W * 3 + gap * 2) * S;
  const PH = H * S;
  const rgba = new Uint8Array(PW * PH * 4);
  const put = (x, y, [r, g, b]) => {
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const o = ((y * S + j) * PW + (x * S + i)) * 4;
        rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
      }
    }
  };
  const BG = [0xc9, 0xd5, 0xca];
  const ON = [0x41, 0x45, 0x40];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W * 3 + gap * 2; x++) put(x, y, [40, 40, 40]);
    for (let x = 0; x < W; x++) {
      const a = want[y * W + x];
      const b = got[y * W + x];
      put(x, y, a ? ON : BG);
      put(W + gap + x, y, b ? ON : BG);
      put(2 * (W + gap) + x, y, a && b ? ON : a ? [40, 80, 220] : b ? [220, 40, 40] : BG);
    }
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), encodePNG(PW, PH, rgba));
}

describe('LCD matches the official emulator screenshots', { skip: refs.length === 0 || !TRACED_FONT }, () => {
  for (const ref of refs) {
    it(`${ref.name} (${ref.keys || 'no keys'})`, () => {
      const calc = new Calculator();
      if (ref.keys) calc.pressSequence(ref.keys);
      const scr = calc.getScreen({ cursorVisible: ref.cursorVisible });
      const want = new Uint8Array(W * H);
      ref.matrix.forEach((row, y) => [...row].forEach((c, x) => { want[y * W + x] = c === '#' ? 1 : 0; }));
      const got = scr.pixels;
      const [skipFrom, skipTo] = KNOWN_DIFF_ROWS[ref.name] || [H, H];
      let wrong = 0;
      for (let y = 0; y < H; y++) {
        if (y >= skipFrom && y < skipTo) continue;
        for (let x = 0; x < W; x++) if (want[y * W + x] !== got[y * W + x]) wrong++;
      }
      const allowed = SCREENSHOT_NOISE[ref.name] || 0;
      if (wrong) writeReport(ref.name, want, got);
      assert.ok(wrong <= allowed,
        `${wrong} dots differ from the official screen (allowed ${allowed}); see tests/pixel/out/${ref.name}.png`);
      if (ref.indicators) {
        const ours = (scr.indicators || []).filter((n) => STATUS_NAMES.includes(n)).sort();
        assert.deepEqual(ours, [...ref.indicators].sort(), 'status bar icons');
      }
    });
  }
});
