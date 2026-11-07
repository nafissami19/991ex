import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Framebuffer, LCD_WIDTH, LCD_HEIGHT } from '../js/lcd/raster.js';
import { pixelDiff, binaryToRGBA, LCD_WIDTH as DW, LCD_HEIGHT as DH } from './pixel/diff.js';
import { encodePNG, decodePNG } from './pixel/png.js';
import { Calculator } from '../js/core/Calculator.js';

describe('Pixel & LCD Engine (Prompt 12)', () => {
  describe('1. Framebuffer operations', () => {
    it('sets and gets individual pixels', () => {
      const fb = new Framebuffer();
      assert.equal(fb.get(10, 20), 0);
      fb.set(10, 20, 1);
      assert.equal(fb.get(10, 20), 1);
      fb.set(10, 20, 0);
      assert.equal(fb.get(10, 20), 0);
    });

    it('fillRect and invertRect', () => {
      const fb = new Framebuffer();
      fb.fillRect(5, 5, 10, 10, 1);
      assert.equal(fb.get(5, 5), 1);
      assert.equal(fb.get(14, 14), 1);
      assert.equal(fb.get(15, 15), 0);

      fb.invertRect(5, 5, 5, 5);
      assert.equal(fb.get(5, 5), 0);
      assert.equal(fb.get(9, 9), 0);
      assert.equal(fb.get(10, 10), 1);
    });

    it('draws directional arrows and scroll indicators', () => {
      const fb = new Framebuffer();
      fb.drawArrow(10, 10, 'up');
      assert.ok(fb.pixels.some((p) => p === 1));

      const fb2 = new Framebuffer();
      fb2.scrollArrows({ up: true, down: true });
      assert.ok(fb2.get(188, 3) === 1);
    });

    it('dottedRect draws dotted pattern', () => {
      const fb = new Framebuffer();
      fb.dottedRect(2, 2, 6, 6);
      assert.equal(fb.get(2, 2), 1);
      assert.equal(fb.get(3, 2), 0);
      assert.equal(fb.get(4, 2), 1);
    });
  });

  describe('2. Pixel diffing and image comparison', () => {
    it('reports perfect match for identical pixel buffers', () => {
      const a = new Uint8Array(DW * DH);
      a[100] = 1;
      const b = new Uint8Array(a);
      const res = pixelDiff(a, b);
      assert.equal(res.match, true);
      assert.equal(res.diffCount, 0);
    });

    it('identifies discrepancies and encodes visual diff PNG', () => {
      const a = new Uint8Array(DW * DH);
      const b = new Uint8Array(DW * DH);
      a[50] = 1; // added
      b[60] = 1; // missing

      const res = pixelDiff(a, b, { scale: 2 });
      assert.equal(res.match, false);
      assert.equal(res.diffCount, 2);

      const pngBuf = res.png(2);
      assert.ok(pngBuf instanceof Buffer);
      const decoded = decodePNG(pngBuf);
      assert.equal(decoded.width, DW * 2);
      assert.equal(decoded.height, DH * 2);
    });
  });

  describe('3. Emulator screen rendering & diff artifacts', () => {
    const OUT_DIR = path.join(import.meta.dirname, 'pixel');

    it('renders start screen to 192x63 pixel-accurate output', () => {
      const calc = new Calculator();
      const scr = calc.getScreen({ cursorVisible: true });
      assert.equal(scr.pixels.length, DW * DH);
      assert.ok(scr.indicators.includes('Math'));
      assert.ok(scr.indicators.includes('D'));

      // Save start screen image
      const rgba = binaryToRGBA(scr.pixels);
      const pngBuf = encodePNG(DW, DH, rgba);
      fs.writeFileSync(path.join(OUT_DIR, 'start_screen_actual.png'), pngBuf);

      // Comparison with the official screen: tests/pixel_reference.test.js (calc_empty)
    });

    it('renders "1+2=3" calculation screen to pixel-accurate output', () => {
      const calc = new Calculator();
      calc.pressSequence('1 + 2 =');
      const scr = calc.getScreen({ cursorVisible: false });

      // Save 1+2=3 screen image
      const rgba = binaryToRGBA(scr.pixels);
      const pngBuf = encodePNG(DW, DH, rgba);
      fs.writeFileSync(path.join(OUT_DIR, 'one_plus_two_actual.png'), pngBuf);

      // Top line contains "1+2" at row 1..12
      // Result line contains "3" at bottom right
      assert.equal(scr.lines[0], '1+2');
      assert.equal(scr.lines[1], '3');

      // Comparison with official screens: tests/pixel_reference.test.js
    });
  });
});
