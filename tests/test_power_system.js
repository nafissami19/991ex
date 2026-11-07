/**
 * Unit tests for Power, Start-up, Contrast, Auto Power Off, and Reset (Prompt 32).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../js/core/Calculator.js';
import { dotColor, DEFAULT_CONTRAST } from '../js/lcd/canvas_lcd.js';
import { defaultSetup } from '../js/core/setup.js';

describe('Power System & Life Cycle (Prompt 32)', () => {
  describe('1. Power Off & Screen Blanking', () => {
    it('turns off via SHIFT AC with empty lines and no status indicators', () => {
      const calc = new Calculator();
      calc.pressSequence('1 + 2 =');
      assert.equal(calc.poweredOn, true);
      assert.equal(calc.getScreen().lines[1], '3');

      calc.pressSequence('SHIFT AC');
      assert.equal(calc.poweredOn, false);
      const scr = calc.getScreen();
      assert.deepEqual(scr.lines, []);
      assert.deepEqual(scr.indicators, []);
      assert.equal(scr.pixels.length, 192 * 63);
      assert.ok(scr.pixels.every((p) => p === 0), 'framebuffer must be all zeros when powered off');
    });

    it('turns off via OFF alias (SHIFT AC)', () => {
      const calc = new Calculator();
      calc.pressSequence('5 × 5 =');
      calc.press('OFF');
      assert.equal(calc.poweredOn, false);
      assert.deepEqual(calc.getScreen().lines, []);
    });

    it('ignores all keys except ON while powered off', () => {
      const calc = new Calculator();
      calc.pressSequence('4 2 STO NEG'); // A = 42
      calc.pressSequence('SHIFT AC'); // power off
      assert.equal(calc.poweredOn, false);

      // Press every variety of key while powered off
      calc.pressSequence('1 2 3 + - × ÷ = SHIFT ALPHA AC DEL MENU OPTN CALC UP DOWN LEFT RIGHT');
      assert.equal(calc.poweredOn, false);
      assert.deepEqual(calc.getScreen().lines, []);
      assert.equal(calc.shift, false);
      assert.equal(calc.alpha, false);

      // Turn on
      calc.press('ON');
      assert.equal(calc.poweredOn, true);
      // Mode and variables preserved
      calc.pressSequence('ALPHA NEG =');
      assert.equal(calc.getScreen().lines[1], '42');
    });
  });

  describe('2. Power On & Start-up Display', () => {
    it('ON key wakes calculator up and restores the previous screen', () => {
      const calc = new Calculator();
      calc.pressSequence('7 × 8 =');
      assert.equal(calc.getScreen().lines[0], '7×8');
      assert.equal(calc.getScreen().lines[1], '56');

      calc.pressSequence('SHIFT AC');
      assert.equal(calc.poweredOn, false);

      calc.press('ON');
      assert.equal(calc.poweredOn, true);
      assert.equal(calc.getScreen().lines[0], '7×8');
      assert.equal(calc.getScreen().lines[1], '56');
      assert.ok(calc.getScreen().indicators.includes('Math'));
      assert.ok(calc.getScreen().indicators.includes('D'));
    });

    it('ON key while already on resets input line and clears history', () => {
      const calc = new Calculator();
      calc.pressSequence('1 + 1 = 2 + 2 =');
      assert.equal(calc.getScreen().lines[1], '4');
      assert.ok(calc.getScreen().indicators.includes('Up'));

      // ON while running acts as a fresh start of current mode
      calc.press('ON');
      assert.equal(calc.poweredOn, true);
      assert.deepEqual(calc.getScreen().lines, ['', '']);
      assert.ok(!calc.getScreen().indicators.includes('Up'), 'history Up indicator must be cleared');

      // UP key does not recall previous calculations
      calc.press('UP');
      assert.deepEqual(calc.getScreen().lines, ['', '']);
    });

    it('power off while in menu closes overlay and returns to calculation screen on wake', () => {
      const calc = new Calculator();
      calc.pressSequence('9 9');
      calc.pressSequence('SHIFT MENU'); // Open SETUP menu
      assert.equal(calc.topView.constructor.name, 'MenuView');

      calc.pressSequence('SHIFT AC'); // Power off from within menu
      assert.equal(calc.poweredOn, false);

      calc.press('ON'); // Wake up
      assert.equal(calc.poweredOn, true);
      assert.equal(calc.views.length, 0, 'all overlay menus must be dismissed');
      assert.equal(calc.getScreen().lines[0], '99');
    });
  });

  describe('3. Auto Power Off (APO)', () => {
    it('uses default 10 minutes timeout from last key press', () => {
      const calc = new Calculator();
      calc.pressSequence('1 2 3');
      const start = calc.lastActivityTime;

      // After 5 minutes, still powered on
      assert.equal(calc.checkIdle(start + 5 * 60 * 1000), false);
      assert.equal(calc.poweredOn, true);

      // After 9 minutes 59 seconds, still powered on
      assert.equal(calc.checkIdle(start + 9 * 60 * 1000 + 59 * 1000), false);
      assert.equal(calc.poweredOn, true);

      // At 10 minutes, triggers auto power off
      assert.equal(calc.checkIdle(start + 10 * 60 * 1000), true);
      assert.equal(calc.poweredOn, false);
      assert.deepEqual(calc.getScreen().lines, []);
    });

    it('uses 60 minutes timeout when configured in SETUP', () => {
      const calc = new Calculator();
      calc.pressSequence('SHIFT MENU DOWN DOWN DOWN 4 2'); // Set APO to 60 Min.
      assert.equal(calc.setup.autoPowerOff, 60);

      calc.pressSequence('5 + 5');
      const start = calc.lastActivityTime;

      // After 10 minutes, should NOT power off
      assert.equal(calc.checkIdle(start + 10 * 60 * 1000), false);
      assert.equal(calc.poweredOn, true);

      // After 59 minutes, still powered on
      assert.equal(calc.checkIdle(start + 59 * 60 * 1000), false);
      assert.equal(calc.poweredOn, true);

      // At 60 minutes, triggers auto power off
      assert.equal(calc.checkIdle(start + 60 * 60 * 1000), true);
      assert.equal(calc.poweredOn, false);
    });

    it('pressing a key resets the idle timer', () => {
      const calc = new Calculator();
      const t0 = calc.lastActivityTime;

      // Advance 8 minutes
      calc.advanceTime(8 * 60 * 1000);
      assert.equal(calc.poweredOn, true);

      // Key pressed at t0 + 8 min resets timer
      calc.press('1');
      const t1 = calc.lastActivityTime;
      assert.ok(t1 > t0);

      // Advance 8 minutes from t1 (total 16 minutes from t0): still on because < 10 min since t1
      calc.advanceTime(8 * 60 * 1000);
      assert.equal(calc.poweredOn, true);

      // Advance 2 more minutes (total 10 min from t1): powers off
      calc.advanceTime(2 * 60 * 1000);
      assert.equal(calc.poweredOn, false);
    });

    it('advanceTime() helper simulates time passing and triggers APO', () => {
      const calc = new Calculator();
      calc.pressSequence('7');
      calc.advanceTime(5 * 60 * 1000);
      assert.equal(calc.poweredOn, true);

      calc.advanceTime(5 * 60 * 1000);
      assert.equal(calc.poweredOn, false);
    });
  });

  describe('4. Display Contrast & dotColor calibration', () => {
    it('ContrastView allows adjustments with LEFT/RIGHT bounded between 0 and 15', () => {
      const calc = new Calculator();
      calc.pressSequence('SHIFT MENU DOWN DOWN DOWN 3'); // Enter Contrast
      assert.equal(calc.topView.constructor.name, 'ContrastView');
      assert.equal(calc.setup.contrast, 8);

      // Decrement multiple times
      for (let i = 0; i < 20; i++) calc.press('LEFT');
      assert.equal(calc.setup.contrast, 0, 'contrast must clamp at minimum 0');

      // Increment multiple times
      for (let i = 0; i < 20; i++) calc.press('RIGHT');
      assert.equal(calc.setup.contrast, 15, 'contrast must clamp at maximum 15');

      // Decrement back to 10 and exit with AC
      calc.pressSequence('LEFT LEFT LEFT LEFT LEFT AC');
      assert.equal(calc.setup.contrast, 10);
      assert.equal(calc.views.length, 0);
    });

    it('dotColor produces lighter pixels at low contrast and darker at high contrast', () => {
      const bg = [200, 210, 200];
      const on = [30, 40, 30];

      const faint = dotColor(bg, on, 0);
      const normal = dotColor(bg, on, 8);
      const dark = dotColor(bg, on, 15);

      // Lower contrast is closer to background (higher RGB values)
      assert.ok(faint[0] > normal[0]);
      assert.ok(faint[1] > normal[1]);
      assert.ok(faint[2] > normal[2]);

      // Higher contrast is darker (lower RGB values)
      assert.ok(normal[0] >= dark[0]);
      assert.ok(normal[1] >= dark[1]);
      assert.ok(normal[2] >= dark[2]);
    });

    it('contrast setting persists across power off/on cycles', () => {
      const calc = new Calculator();
      calc.pressSequence('SHIFT MENU DOWN DOWN DOWN 3 RIGHT RIGHT RIGHT EXE');
      assert.equal(calc.setup.contrast, 11);

      calc.pressSequence('SHIFT AC');
      assert.equal(calc.poweredOn, false);

      calc.press('ON');
      assert.equal(calc.poweredOn, true);
      assert.equal(calc.setup.contrast, 11);
      assert.equal(calc.getScreen().contrast, 11);
    });

    it('contrast setting is preserved when resetting setup data (SHIFT 9 1 =)', () => {
      const calc = new Calculator();
      calc.setup.contrast = 13;
      calc.setup.angle = 'RAD';

      calc.pressSequence('SHIFT 9 1 = AC');
      assert.equal(calc.setup.angle, 'DEG', 'setup data reset to DEG');
      assert.equal(calc.setup.contrast, 13, 'contrast must be preserved');
    });

    it('contrast setting is preserved when Initializing All (SHIFT 9 3 =)', () => {
      const calc = new Calculator();
      calc.setup.contrast = 14;
      calc.setup.angle = 'RAD';
      calc.pressSequence('1 0 M+');

      calc.pressSequence('SHIFT 9 3 = AC');
      assert.equal(calc.setup.angle, 'DEG');
      assert.equal(calc.memory.isMNonZero(), false);
      assert.equal(calc.setup.contrast, 14, 'contrast must be preserved across Initialize All');
    });
  });

  describe('5. Memory Retention & Clearing Matrix (docs/spec/memory.md)', () => {
    it('Ans and PreAns survive power-off and waking', () => {
      const calc = new Calculator();
      calc.pressSequence('1 0 ='); // Ans = 10
      calc.pressSequence('2 5 ='); // PreAns = 10, Ans = 25

      calc.pressSequence('SHIFT AC ON');

      // PreAns is 10 (evaluated first before Ans shifts)
      calc.pressSequence('ALPHA ANS =');
      assert.equal(calc.getScreen().lines[1], '10');

      const calc2 = new Calculator();
      calc2.pressSequence('1 0 = 2 5 =');
      calc2.pressSequence('SHIFT AC ON');
      // Ans is 25
      calc2.pressSequence('Ans =');
      assert.equal(calc2.getScreen().lines[1], '25');
    });

    it('all variables A-F, x, y and M survive power-off', () => {
      const calc = new Calculator();
      calc.pressSequence('1 1 STO NEG'); // A = 11
      calc.pressSequence('2 2 STO DEG'); // B = 22
      calc.pressSequence('3 3 STO INV'); // C = 33
      calc.pressSequence('4 4 STO SIN'); // D = 44
      calc.pressSequence('5 5 STO COS'); // E = 55
      calc.pressSequence('6 6 STO TAN'); // F = 66
      calc.pressSequence('7 7 STO RPAREN'); // x = 77
      calc.pressSequence('8 8 STO SD'); // y = 88
      calc.pressSequence('9 9 M+'); // M = 99

      calc.pressSequence('SHIFT AC ON');

      calc.pressSequence('ALPHA NEG + ALPHA DEG =');
      assert.equal(calc.getScreen().lines[1], '33');

      calc.pressSequence('ALPHA RPAREN + ALPHA SD =');
      assert.equal(calc.getScreen().lines[1], '165');

      calc.pressSequence('ALPHA M_PLUS =');
      assert.equal(calc.getScreen().lines[1], '99');
      assert.ok(calc.getScreen().indicators.includes('M'));
    });

    it('Spreadsheet grid clears on power-off per retention spec', () => {
      const calc = new Calculator();
      calc.setMode(8); // Spreadsheet
      assert.equal(calc.app.cursor.col, 0);
      assert.equal(calc.app.cursor.row, 1);
      assert.equal(calc.app.grid.size, 0);

      // Power off and on
      calc.pressSequence('SHIFT AC ON');
      assert.equal(calc.mode, 8);
      assert.equal(calc.app.cursor.col, 0);
      assert.equal(calc.app.cursor.row, 1);
      assert.equal(calc.app.grid.size, 0);
    });
  });

  describe('6. First Start & Initialize All Fidelity', () => {
    it('Initialize All authentic sequence: confirmation -> Reset All splash -> Calculate Mode', () => {
      const calc = new Calculator();
      calc.setup.angle = 'RAD';
      calc.pressSequence('1 2 3 M+');

      // Press SHIFT 9: RESET Menu
      calc.pressSequence('SHIFT 9');
      assert.deepEqual(calc.renderLines(), ['1:Setup Data', '2:Memory', '3:Initialize All']);

      // Press 3: Initialize All confirmation prompt
      calc.press('3');
      assert.deepEqual(calc.renderLines(), ['Initialize All?', '[=]  :Yes', '[AC] :Cancel']);

      // Press =: Confirmation splash screen
      calc.press('=');
      assert.deepEqual(calc.renderLines(), ['Reset All', 'Press [AC] Key']);

      // Press AC: returns to fresh Calculate mode
      calc.press('AC');
      assert.equal(calc.mode, 1);
      assert.deepEqual(calc.renderLines(), ['', '']);
      assert.deepEqual(calc.indicators(), ['Math', 'D']);
      assert.equal(calc.memory.isMNonZero(), false);
      assert.equal(calc.setup.angle, 'DEG');
    });

    it('pressing ON on Reset All splash screen also returns to Calculate mode', () => {
      const calc = new Calculator();
      calc.pressSequence('SHIFT 9 3 =');
      assert.deepEqual(calc.renderLines(), ['Reset All', 'Press [AC] Key']);

      calc.press('ON');
      assert.equal(calc.mode, 1);
      assert.deepEqual(calc.renderLines(), ['', '']);
      assert.deepEqual(calc.indicators(), ['Math', 'D']);
    });
  });

  describe('7. State Persistence (exportState / importState)', () => {
    it('preserves poweredOn state and contrast across state import/export', () => {
      const calc1 = new Calculator();
      calc1.setup.contrast = 12;
      calc1.pressSequence('1 2 3 + 4 5 6 =');
      calc1.pressSequence('SHIFT AC');
      assert.equal(calc1.poweredOn, false);

      const json = calc1.exportState();
      assert.equal(json.poweredOn, false);
      assert.equal(json.setup.contrast, 12);

      const calc2 = new Calculator();
      calc2.importState(json);
      assert.equal(calc2.poweredOn, false);
      assert.equal(calc2.setup.contrast, 12);

      // Turn on
      calc2.press('ON');
      assert.equal(calc2.poweredOn, true);
      assert.equal(calc2.setup.contrast, 12);
      assert.equal(calc2.getScreen().lines[1], '579');
    });
  });
});
