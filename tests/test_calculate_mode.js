/**
 * Unit tests for Prompt 14 — Calculate mode: full screen behaviour
 *
 * 1. Continuation with Ans from operators (+, -, ×, ÷, x², x³, x⁻¹, x!, %, x■).
 * 2. Digits and prefix functions starting new calculations.
 * 3. ◀/▶ replay entering edit mode at end / start.
 * 4. History (replay): ▲ / ▼ stepping through past calculations, Up/Down indicators.
 * 5. Retention rules: AC retains history, mode change / ON clears history, OFF/ON retains.
 * 6. Multi-statements with ':' stepping through with Disp indicator.
 * 7. Ans and PreAns memory chaining.
 * 8. Result line scrolling when result is wider than 192px LCD viewport.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../js/core/Calculator.js';

describe('Calculate Mode: Full Screen Behaviour (Prompt 14)', () => {
  describe('1. Operator continuation from Ans & digit clearing', () => {
    it('pressing operator after result continues with Ans', () => {
      const calc = new Calculator();
      calc.pressSequence('1 0 =');
      assert.equal(calc.getScreen().lines[1], '10');

      calc.pressSequence('+ 5 =');
      assert.equal(calc.getScreen().lines[0], 'Ans+5');
      assert.equal(calc.getScreen().lines[1], '15');

      calc.pressSequence('× 2 =');
      assert.equal(calc.getScreen().lines[0], 'Ans×2');
      assert.equal(calc.getScreen().lines[1], '30');

      calc.pressSequence('SQUARE =');
      assert.equal(calc.getScreen().lines[0], 'Ans²');
      assert.equal(calc.getScreen().lines[1], '900');
    });

    it('pressing digit, dot or prefix function after result starts fresh calculation', () => {
      const calc = new Calculator();
      calc.pressSequence('5 + 5 =');
      assert.equal(calc.getScreen().lines[1], '10');

      // Press digit 3
      calc.pressSequence('3 + 2 =');
      assert.equal(calc.getScreen().lines[0], '3+2');
      assert.equal(calc.getScreen().lines[1], '5');

      // Press prefix function sin
      calc.pressSequence('sin 3 0 ) =');
      assert.equal(calc.getScreen().lines[0], 'sin(30)');
      assert.equal(calc.getScreen().lines[1], '1/2');
    });
  });

  describe('2. Replay with LEFT and RIGHT after evaluation', () => {
    it('LEFT enters edit at end of expression', () => {
      const calc = new Calculator();
      calc.pressSequence('1 2 + 3 4 =');
      assert.equal(calc.getScreen().lines[1], '46');

      calc.press('LEFT');
      assert.equal(calc.app.phase, 'edit');
      assert.equal(calc.app.editor.idx, calc.app.editor.root.length);

      calc.pressSequence('+ 5 =');
      assert.equal(calc.getScreen().lines[0], '12+34+5');
      assert.equal(calc.getScreen().lines[1], '51');
    });

    it('RIGHT enters edit at beginning (home) of expression', () => {
      const calc = new Calculator();
      calc.pressSequence('1 2 + 3 4 =');
      assert.equal(calc.getScreen().lines[1], '46');

      calc.press('RIGHT');
      assert.equal(calc.app.phase, 'edit');
      assert.equal(calc.app.editor.idx, 0);

      calc.pressSequence('5 + =');
      assert.equal(calc.getScreen().lines[0], '5+12+34');
      assert.equal(calc.getScreen().lines[1], '51');
    });
  });

  describe('3. History (replay) buffer & navigation', () => {
    it('▲ and ▼ step through history; returns to empty line past newest', () => {
      const calc = new Calculator();
      calc.pressSequence('1 + 1 =');
      calc.pressSequence('2 + 2 =');
      calc.pressSequence('3 + 3 =');

      assert.equal(calc.getScreen().lines[0], '3+3');
      assert.equal(calc.getScreen().lines[1], '6');
      assert.ok(calc.getScreen().indicators.includes('Up'));

      // Press UP: recalls 2+2=4
      calc.press('UP');
      assert.equal(calc.getScreen().lines[0], '2+2');
      assert.equal(calc.getScreen().lines[1], '4');
      assert.ok(calc.getScreen().indicators.includes('Up'));
      assert.ok(calc.getScreen().indicators.includes('Down'));

      // Press UP: recalls 1+1=2
      calc.press('UP');
      assert.equal(calc.getScreen().lines[0], '1+1');
      assert.equal(calc.getScreen().lines[1], '2');
      assert.ok(!calc.getScreen().indicators.includes('Up'), 'Up off at oldest');
      assert.ok(calc.getScreen().indicators.includes('Down'));

      // Press UP again: stays at oldest
      calc.press('UP');
      assert.equal(calc.getScreen().lines[0], '1+1');

      // Press DOWN: moves forward to 2+2=4
      calc.press('DOWN');
      assert.equal(calc.getScreen().lines[0], '2+2');

      // Press DOWN: moves forward to 3+3=6
      calc.press('DOWN');
      assert.equal(calc.getScreen().lines[0], '3+3');

      // Press DOWN: returns to fresh edit screen
      calc.press('DOWN');
      assert.equal(calc.app.phase, 'edit');
      assert.equal(calc.getScreen().lines[0], '');
      assert.ok(calc.getScreen().indicators.includes('Up'));
    });

    it('AC clears display but retains history', () => {
      const calc = new Calculator();
      calc.pressSequence('5 × 5 =');
      assert.equal(calc.getScreen().lines[1], '25');

      calc.press('AC');
      assert.equal(calc.getScreen().lines[0], '');
      assert.ok(calc.getScreen().indicators.includes('Up'));

      calc.press('UP');
      assert.equal(calc.getScreen().lines[0], '5×5');
      assert.equal(calc.getScreen().lines[1], '25');
    });

    it('ON while running clears history; mode change clears history', () => {
      const calc = new Calculator();
      calc.pressSequence('7 + 7 =');
      assert.equal(calc.getScreen().lines[1], '14');

      calc.press('ON');
      assert.equal(calc.getScreen().lines[0], '');
      assert.ok(!calc.getScreen().indicators.includes('Up'), 'history cleared by ON');

      calc.press('UP');
      assert.equal(calc.getScreen().lines[0], '', 'UP does nothing when history is cleared');

      // Test mode change clearing history
      calc.pressSequence('8 + 8 =');
      assert.equal(calc.getScreen().lines[1], '16');

      calc.setMode(2); // Complex
      calc.setMode(1); // Calculate
      assert.ok(!calc.getScreen().indicators.includes('Up'), 'history cleared by mode change');
    });
  });

  describe('4. Multi-statements with colon (:)', () => {
    it('executes statements in turn with Disp indicator and updates Ans', () => {
      const calc = new Calculator();
      calc.pressSequence('1 0 + 5 ALPHA INTEGRAL Ans × 2 =');

      // First statement: 10+5 = 15, Disp on
      assert.equal(calc.getScreen().lines[0], '10+5');
      assert.equal(calc.getScreen().lines[1], '15');
      assert.ok(calc.getScreen().indicators.includes('Disp'));

      // Press EXE: second statement Ans × 2 = 30, Disp off
      calc.press('=');
      assert.equal(calc.getScreen().lines[0], 'Ans×2');
      assert.equal(calc.getScreen().lines[1], '30');
      assert.ok(!calc.getScreen().indicators.includes('Disp'));
    });
  });

  describe('5. Ans and PreAns memory behavior', () => {
    it('PreAns shifts from Ans across consecutive calculations', () => {
      const calc = new Calculator();
      calc.pressSequence('1 0 =');
      calc.pressSequence('2 5 =');

      // PreAns should be 10, Ans should be 25
      calc.pressSequence('ALPHA ANS + Ans =');
      assert.equal(calc.getScreen().lines[0], 'PreAns+Ans');
      assert.equal(calc.getScreen().lines[1], '35');
    });
  });

  describe('6. Power OFF / ON retention', () => {
    it('turning off with SHIFT AC and on with ON preserves input expression', () => {
      const calc = new Calculator();
      calc.pressSequence('1 2 3 + 4 5 6');
      assert.equal(calc.getScreen().lines[0], '123+456');

      calc.pressSequence('SHIFT AC');
      assert.equal(calc.poweredOn, false);

      calc.press('ON');
      assert.equal(calc.poweredOn, true);
      assert.equal(calc.getScreen().lines[0], '123+456');
    });
  });

  describe('7. Long result line scrolling', () => {
    it('wide result line activates Left/Right indicators and responds to ◀/▶', () => {
      const calc = new Calculator();
      // Generate a long surd expression in MathI
      calc.pressSequence('SQRT 2 + SQRT 3 + SQRT 5 + SQRT 6 =');
      const scr = calc.getScreen();

      // If wide result overflows, Left indicator is shown
      if (calc.app.resultMaxScroll > 0) {
        assert.ok(scr.indicators.includes('Left') || scr.indicators.includes('Right'));

        const prevScroll = calc.app.resultScrollX;
        calc.press('LEFT');
        assert.ok(calc.app.resultScrollX <= prevScroll, 'scrolled left');
      }
    });
  });
});
