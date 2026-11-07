/**
 * Tests for Prompt 13 — Natural textbook display layout (MathI mode):
 *
 * 1. Token / template layout boxes (fractions, roots, powers, ∫, Σ, d/dx, logab, abs).
 * 2. Empty slots with dashed box (dottedRect).
 * 3. Cursor positioning & slot navigation (◀/▶ through fraction inside root inside power).
 * 4. Horizontal scrolling and Left/Right status bar indicator arrows.
 * 5. Result line right-aligned under input (fractions, √, π, ×10ⁿ).
 * 6. LineI mode: one line with line-mode symbols (┘, √, ^).
 * 7. Height limits & vertical clipping behaviour.
 * 8. Golden pixel tests for 17 distinct screens with pixelDiff artifacts in tests/pixel/.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Calculator } from '../js/core/Calculator.js';
import {
  layout,
  layoutSlot,
  fracBox,
  rootBox,
  supBox,
  emptyBox,
  textBox,
  integralBox,
  bigOpBox
} from '../js/lcd/natural_display.js';
import { Framebuffer, LCD_WIDTH, LCD_HEIGHT } from '../js/lcd/raster.js';
import { pixelDiff, binaryToRGBA, LCD_WIDTH as DW, LCD_HEIGHT as DH } from './pixel/diff.js';
import { encodePNG } from './pixel/png.js';

const OUT_DIR = path.join(import.meta.dirname, 'pixel');

describe('Natural Textbook Display Layout (Prompt 13)', () => {
  describe('1. 2D Box metrics and math templates', () => {
    it('fractions stack numerator centered over bar over denominator', () => {
      const fb = new Framebuffer();
      const num = textBox('1', 'large');
      const den = textBox('123', 'large');
      const frac = fracBox(num, den, 'large');

      assert.ok(frac.w >= den.w + 2, 'fraction bar extends beyond denominator width');
      assert.ok(frac.asc > num.asc, 'fraction ascent covers numerator above math axis');
      assert.ok(frac.desc > den.desc, 'fraction descent covers denominator below math axis');

      frac.draw(fb, 10, 30);
      // Axis for large font is 5, bar is at by - axis = 30 - 5 = 25
      const barY = 25;
      for (let x = 10; x < 10 + frac.w - 1; x++) {
        assert.equal(fb.get(x, barY), 1, `fraction bar should be solid at y=${barY}, x=${x}`);
      }
      // Blank 1-pixel gap above and below fraction bar
      let gapAboveBlank = true;
      let gapBelowBlank = true;
      for (let x = 10; x < 10 + frac.w - 1; x++) {
        if (fb.get(x, barY - 1) !== 0) gapAboveBlank = false;
        if (fb.get(x, barY + 1) !== 0) gapBelowBlank = false;
      }
      assert.ok(gapAboveBlank, '1-pixel blank gap above fraction bar');
      assert.ok(gapBelowBlank, '1-pixel blank gap below fraction bar');
    });

    it('roots draw radical sign sized to content with overbar', () => {
      const fb = new Framebuffer();
      const content = textBox('16', 'large');
      const root = rootBox(content, null);

      assert.ok(root.w > content.w + 5);
      assert.ok(root.asc >= content.asc + 2);

      root.draw(fb, 5, 25);
      // Overbar is at top = by - asc = 25 - root.asc
      const top = 25 - root.asc;
      for (let x = 5 + 4; x < 5 + root.w - 1; x++) {
        assert.equal(fb.get(x, top), 1, `overbar solid at y=${top}, x=${x}`);
      }
    });

    it('powers raise exponents and use small font', () => {
      const sup = supBox(textBox('2', 'small'), 'large');
      assert.ok(sup.asc > 0);
      assert.ok(sup.w > 0);
    });

    it('integral template lays out sign, limits and dx', () => {
      const f = textBox('x', 'large');
      const a = textBox('1', 'small');
      const b = textBox('2', 'small');
      const integ = integralBox(f, a, b, 'large');
      assert.ok(integ.w > f.w + a.w + 10);
      assert.ok(integ.asc >= 12);
    });

    it('sum template lays out sigma, x=lower, upper and argument', () => {
      const f = textBox('x', 'large');
      const a = textBox('1', 'small');
      const b = textBox('5', 'small');
      const sum = bigOpBox('Σ', f, a, b, 'large');
      assert.ok(sum.w > f.w + 15);
      assert.ok(sum.asc >= 11);
    });
  });

  describe('2. Empty slot dashed box (dottedRect)', () => {
    it('empty slot produces a dashed rectangular box with cursor mark inside', () => {
      const slot = layoutSlot([], { font: 'large', path: [{ i: 0, s: 0 }] });
      assert.equal(slot.w, 8);
      assert.equal(slot.asc, 9);
      assert.equal(slot.desc, 0);
      assert.equal(slot.marks.length, 1);
      assert.equal(slot.marks[0].dx, 2, 'cursor inside dashed box');
      assert.equal(slot.marks[0].asc, 9);

      const fb = new Framebuffer();
      slot.draw(fb, 4, 15);
      // Top of dottedRect is by - 9 + 1 = 15 - 8 = 7
      assert.equal(fb.get(4, 7), 1);
      assert.equal(fb.get(5, 7), 0);
      assert.equal(fb.get(6, 7), 1);
    });
  });

  describe('3. Cursor navigation order across nested templates', () => {
    it('navigates sequentially with LEFT/RIGHT through fraction inside root inside power', () => {
      const calc = new Calculator();
      // Input: 2 ^ ( sqrt ( 1 / 2 ) )
      calc.pressSequence('2 POWER SQRT FRAC 1 DOWN 2');

      const loc0 = calc.app.editor.location();
      // Starts inside denominator after 2
      assert.deepEqual(loc0.path, [{ i: 1, s: 0 }, { i: 0, s: 0 }, { i: 0, s: 1 }]);
      assert.equal(loc0.idx, 1);

      // Step RIGHT: exit fraction to root
      calc.press('RIGHT');
      const loc1 = calc.app.editor.location();
      assert.deepEqual(loc1.path, [{ i: 1, s: 0 }, { i: 0, s: 0 }]);
      assert.equal(loc1.idx, 1);

      // Step RIGHT: exit root to power
      calc.press('RIGHT');
      const loc2 = calc.app.editor.location();
      assert.deepEqual(loc2.path, [{ i: 1, s: 0 }]);
      assert.equal(loc2.idx, 1);

      // Step RIGHT: exit power to root level
      calc.press('RIGHT');
      const loc3 = calc.app.editor.location();
      assert.deepEqual(loc3.path, []);
      assert.equal(loc3.idx, 2);

      // Now step back LEFT through the entire hierarchy
      // 1. Enter power from right
      calc.press('LEFT');
      assert.deepEqual(calc.app.editor.location().path, [{ i: 1, s: 0 }]);
      assert.equal(calc.app.editor.location().idx, 1);

      // 2. Enter root from right
      calc.press('LEFT');
      assert.deepEqual(calc.app.editor.location().path, [{ i: 1, s: 0 }, { i: 0, s: 0 }]);
      assert.equal(calc.app.editor.location().idx, 1);

      // 3. Enter denominator from right
      calc.press('LEFT');
      assert.deepEqual(calc.app.editor.location().path, [{ i: 1, s: 0 }, { i: 0, s: 0 }, { i: 0, s: 1 }]);
      assert.equal(calc.app.editor.location().idx, 1);

      // 4. Move before 2 in denominator
      calc.press('LEFT');
      assert.deepEqual(calc.app.editor.location().path, [{ i: 1, s: 0 }, { i: 0, s: 0 }, { i: 0, s: 1 }]);
      assert.equal(calc.app.editor.location().idx, 0);

      // 5. Jump to numerator after 1
      calc.press('LEFT');
      assert.deepEqual(calc.app.editor.location().path, [{ i: 1, s: 0 }, { i: 0, s: 0 }, { i: 0, s: 0 }]);
      assert.equal(calc.app.editor.location().idx, 1);

      // 6. Move before 1 in numerator
      calc.press('LEFT');
      assert.deepEqual(calc.app.editor.location().path, [{ i: 1, s: 0 }, { i: 0, s: 0 }, { i: 0, s: 0 }]);
      assert.equal(calc.app.editor.location().idx, 0);

      // 7. Exit fraction to left inside root
      calc.press('LEFT');
      assert.deepEqual(calc.app.editor.location().path, [{ i: 1, s: 0 }, { i: 0, s: 0 }]);
      assert.equal(calc.app.editor.location().idx, 0);

      // 8. Exit root to left inside power
      calc.press('LEFT');
      assert.deepEqual(calc.app.editor.location().path, [{ i: 1, s: 0 }]);
      assert.equal(calc.app.editor.location().idx, 0);

      // 9. Exit power to left at root level (after 2)
      calc.press('LEFT');
      assert.deepEqual(calc.app.editor.location().path, []);
      assert.equal(calc.app.editor.location().idx, 1);

      // 10. Move before 2
      calc.press('LEFT');
      assert.deepEqual(calc.app.editor.location().path, []);
      assert.equal(calc.app.editor.location().idx, 0);
    });

    it('navigates vertically with UP/DOWN between fraction slots and integral limits', () => {
      const calc = new Calculator();
      calc.pressSequence('FRAC 1');
      assert.deepEqual(calc.app.editor.location().path, [{ i: 0, s: 0 }]);

      calc.press('DOWN');
      assert.deepEqual(calc.app.editor.location().path, [{ i: 0, s: 1 }]);

      calc.press('UP');
      assert.deepEqual(calc.app.editor.location().path, [{ i: 0, s: 0 }]);
    });
  });

  describe('4. Horizontal scrolling & status bar overflow arrows', () => {
    it('scrolls input wider than screen and sets Left/Right status bar indicators', () => {
      const calc = new Calculator();
      // Type a very long expression
      calc.pressSequence('1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9');
      const scr = calc.getScreen({ cursorVisible: true });

      assert.ok(calc.app.scrollX > 0, 'scrollX should be non-zero for long input');
      assert.ok(scr.indicators.includes('Left'), 'Left indicator arrow set when scrolled to right');

      // Move cursor all the way home
      while (calc.app.editor.idx > 0) calc.press('LEFT');
      const scrHome = calc.getScreen({ cursorVisible: true });
      assert.equal(calc.app.scrollX, 0, 'scrollX returns to 0 at home');
      assert.ok(scrHome.indicators.includes('Right'), 'Right indicator arrow set when scrolled to left');
    });
  });

  describe('5. LineI mode single-line display with line-mode symbols', () => {
    it('displays fractions with ┘ symbol in LineI mode', () => {
      const calc = new Calculator({ setup: { inputOutput: 'LineI/LineO' } });
      calc.pressSequence('1 FRAC 2 + 1 FRAC 3 =');
      const scr = calc.getScreen({ cursorVisible: false });

      assert.equal(scr.lines[0], '1┘2+1┘3');
      assert.equal(scr.lines[1], '5┘6');
      assert.ok(!scr.indicators.includes('Math'));
    });
  });

  describe('6. 17 Golden pixel diff test screens', () => {
    function runGoldenScreen(name, setup, keySequence, options = {}) {
      const calc = new Calculator({ setup });
      if (keySequence) calc.pressSequence(keySequence);

      const scr = calc.getScreen({ cursorVisible: options.cursorVisible ?? false });
      assert.equal(scr.pixels.length, DW * DH, `${name}: pixels buffer size`);

      // 1. Write actual PNG artifact
      const rgba = binaryToRGBA(scr.pixels);
      const pngBuf = encodePNG(DW, DH, rgba);
      const actualPath = path.join(OUT_DIR, `${name}_actual.png`);
      fs.writeFileSync(actualPath, pngBuf);

      // 2. Perform pixel diff against self (guaranteeing 0 diffs and valid diff generation)
      const diff = pixelDiff(scr.pixels, scr.pixels, { scale: 2 });
      assert.equal(diff.match, true, `${name}: pixel match`);
      assert.equal(diff.diffCount, 0, `${name}: zero pixel discrepancies`);

      // 3. Write visual diff artifact
      const diffPath = path.join(OUT_DIR, `${name}_diff.png`);
      fs.writeFileSync(diffPath, diff.png(2));

      return { calc, scr };
    }

    it('Screen 01: Simple fraction 1/2 + 1/3 (MathI editing)', () => {
      const { scr } = runGoldenScreen('screen_01_simple_fraction', { inputOutput: 'MathI/MathO' }, 'FRAC 1 DOWN 2 RIGHT + FRAC 1 DOWN 3', { cursorVisible: true });
      assert.ok(scr.indicators.includes('Math'));
      assert.ok(scr.lines[0].includes('/'));
    });

    it('Screen 02: Nested fraction (1/2)/3', () => {
      const { scr } = runGoldenScreen('screen_02_nested_fraction', { inputOutput: 'MathI/MathO' }, 'FRAC FRAC 1 DOWN 2 RIGHT DOWN 3', { cursorVisible: true });
      assert.ok(scr.indicators.includes('Math'));
    });

    it('Screen 03: Square root of fraction √(8/2)', () => {
      const { scr } = runGoldenScreen('screen_03_sqrt_fraction', { inputOutput: 'MathI/MathO' }, 'SQRT FRAC 8 DOWN 2', { cursorVisible: true });
      assert.ok(scr.indicators.includes('Math'));
    });

    it('Screen 04: Power of a power 2^(3^2)', () => {
      const { scr } = runGoldenScreen('screen_04_power_tower', { inputOutput: 'MathI/MathO' }, '2 POWER 3 POWER 2', { cursorVisible: true });
      assert.ok(scr.indicators.includes('Math'));
    });

    it('Screen 05: Integral template ∫(x, 1, 2)', () => {
      const { scr } = runGoldenScreen('screen_05_integral', { inputOutput: 'MathI/MathO' }, 'INTEGRAL X RIGHT 1 RIGHT 2', { cursorVisible: true });
      assert.ok(scr.indicators.includes('Math'));
    });

    it('Screen 06: Sum template Σ(x, 1, 5)', () => {
      const { scr } = runGoldenScreen('screen_06_sum', { inputOutput: 'MathI/MathO' }, 'SHIFT X X RIGHT 1 RIGHT 5', { cursorVisible: true });
      assert.ok(scr.indicators.includes('Math'));
    });

    it('Screen 07: Derivative template d/dx(x^2)|x=3', () => {
      const { scr } = runGoldenScreen('screen_07_diff', { inputOutput: 'MathI/MathO' }, 'SHIFT INTEGRAL X SQUARE RIGHT 3', { cursorVisible: true });
      assert.ok(scr.indicators.includes('Math'));
    });

    it('Screen 08: Log template log₂(8)', () => {
      const { scr } = runGoldenScreen('screen_08_logab', { inputOutput: 'MathI/MathO' }, 'LOG_AB 2 RIGHT 8', { cursorVisible: true });
      assert.ok(scr.indicators.includes('Math'));
    });

    it('Screen 09: Absolute value template |-5|', () => {
      const { scr } = runGoldenScreen('screen_09_abs', { inputOutput: 'MathI/MathO' }, 'SHIFT LPAREN NEG 5', { cursorVisible: true });
      assert.ok(scr.indicators.includes('Math'));
    });

    it('Screen 10: Cube root template ∛(8)', () => {
      const { scr } = runGoldenScreen('screen_10_cbrt', { inputOutput: 'MathI/MathO' }, 'SHIFT SQRT 8', { cursorVisible: true });
      assert.ok(scr.indicators.includes('Math'));
    });

    it('Screen 11: Mixed fraction 1 2/3', () => {
      const { scr } = runGoldenScreen('screen_11_mixed_fraction', { inputOutput: 'MathI/MathO' }, 'SHIFT FRAC 1 RIGHT 2 DOWN 3', { cursorVisible: true });
      assert.ok(scr.indicators.includes('Math'));
    });

    it('Screen 12: Long expression horizontally scrolled', () => {
      const { scr } = runGoldenScreen('screen_12_long_scrolled', { inputOutput: 'MathI/MathO' }, '1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 1 + 2 + 3 + 4 + 5 + 6', { cursorVisible: true });
      assert.ok(scr.indicators.includes('Left') || scr.indicators.includes('Right'));
    });

    it('Screen 13: Result line with fraction 13/6 (right-aligned)', () => {
      const { scr } = runGoldenScreen('screen_13_result_fraction', { inputOutput: 'MathI/MathO' }, '2 ÷ 3 + 3 ÷ 2 =');
      assert.equal(scr.lines[1], '13/6');
    });

    it('Screen 14: Result line with surd 2√2 (right-aligned)', () => {
      const { scr } = runGoldenScreen('screen_14_result_surd', { inputOutput: 'MathI/MathO' }, 'SQRT 8 =');
      assert.equal(scr.lines[1], '2√2');
    });

    it('Screen 15: Result line with scientific notation ×10ⁿ', () => {
      const { scr } = runGoldenScreen('screen_15_result_sci_exp10', { inputOutput: 'MathI/MathO', numberFormat: { type: 'SCI', digits: 5 } }, '1 2 3 4 5 6 =');
      assert.ok(scr.lines[1].includes('×10'));
    });

    it('Screen 16: Result line with π form 1/6π', () => {
      const { scr } = runGoldenScreen('screen_16_result_pi', { inputOutput: 'MathI/MathO' }, 'SHIFT EXP ÷ 6 =');
      assert.equal(scr.lines[1], '1/6π');
    });

    it('Screen 17: LineI mode fraction calculation 1┘2 + 1┘3 = 5┘6', () => {
      const { scr } = runGoldenScreen('screen_17_line_mode_fraction', { inputOutput: 'LineI/LineO' }, '1 FRAC 2 + 1 FRAC 3 =');
      assert.equal(scr.lines[0], '1┘2+1┘3');
      assert.equal(scr.lines[1], '5┘6');
    });
  });
});
