#!/usr/bin/env node
/**
 * Render the LCD after a key sequence to a PNG.
 *   node scripts/render_screen.mjs "1 + 2 =" out.png [scale] [setupJSON]
 * Scale defaults to 4. The status bar is drawn as text above the LCD is NOT included —
 * only the 192×63 dot matrix (what pixel tests compare).
 */

import fs from 'node:fs';
import { Calculator } from '../js/core/Calculator.js';
import { encodePNG } from '../tests/pixel/png.js';

const [keys = '', out = 'screen.png', scaleArg = '4', setupArg] = process.argv.slice(2);
const scale = Math.max(1, parseInt(scaleArg, 10) || 4);
const calc = new Calculator({ setup: setupArg ? JSON.parse(setupArg) : undefined, rng: () => 0.5 });
calc.pressSequence(keys);
const scr = calc.getScreen({ cursorVisible: true });
const W = 192 * scale;
const H = 63 * scale;
const rgba = new Uint8Array(W * H * 4);
const BG = [0xd6, 0xdd, 0xd0];
const FG = [0x20, 0x26, 0x24];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const on = scr.pixels[Math.floor(y / scale) * 192 + Math.floor(x / scale)];
    const c = on ? FG : BG;
    const grid = scale >= 4 && (x % scale === scale - 1 || y % scale === scale - 1);
    const i = (y * W + x) * 4;
    rgba[i] = grid ? c[0] * 0.92 : c[0];
    rgba[i + 1] = grid ? c[1] * 0.92 : c[1];
    rgba[i + 2] = grid ? c[2] * 0.92 : c[2];
    rgba[i + 3] = 255;
  }
}
fs.writeFileSync(out, encodePNG(W, H, rgba));
console.log(`${out}  indicators=[${scr.indicators.join(' ')}]  lines=${JSON.stringify(scr.lines)}`);
