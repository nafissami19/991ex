import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../js/core/Calculator.js';

describe('Prompt 29 — Equation/Func mode', () => {
  describe('1. Mode Entry and Selection Screens', () => {
    it('enters Equation/Func mode via MENU A displaying type menu', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU A');
      assert.strictEqual(calc.mode, 10);
      const scr = calc.getScreen();
      assert.ok(scr.lines.some((l) => l.includes('Equation/Func')));
      assert.ok(scr.lines.some((l) => l.includes('1:Simul Equation')));
      assert.ok(scr.lines.some((l) => l.includes('2:Polynomial')));
    });

    it('enters Equation/Func mode via MENU (-) shortcut', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU (-) ');
      assert.strictEqual(calc.mode, 10);
      assert.ok(calc.getScreen().lines.some((l) => l.includes('Equation/Func')));
    });

    it('displays Unknowns? prompt when selecting 1:Simul Equation', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU A 1');
      const scr = calc.getScreen();
      assert.deepStrictEqual(scr.lines, ['Simul Equation', 'Unknowns?', 'Select 2~4']);
    });

    it('displays Degree? prompt when selecting 2:Polynomial', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU A 2');
      const scr = calc.getScreen();
      assert.deepStrictEqual(scr.lines, ['Polynomial', 'Degree?', 'Select 2~4']);
    });

    it('navigates back to type menu from prompts using LEFT or AC', () => {
      const c1 = new Calculator();
      c1.pressSequence('MENU A 1 LEFT');
      assert.ok(c1.getScreen().lines.some((l) => l.includes('1:Simul Equation')));

      const c2 = new Calculator();
      c2.pressSequence('MENU A 2 AC');
      assert.ok(c2.getScreen().lines.some((l) => l.includes('2:Polynomial')));
    });
  });

  describe('2. Simultaneous Linear Equations: 2 Unknowns', () => {
    it('solves manual example: x+2y=3, 2x+3y=4 -> x=-1, y=2', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU A 1 2 1 = 2 = 3 = 2 = 3 = 4 = =');
      const scrX = calc.getScreen();
      assert.deepStrictEqual(scrX.lines, ['x=', '−1']);
      assert.ok(scrX.indicators.includes('Down'));

      calc.press('DOWN');
      const scrY = calc.getScreen();
      assert.deepStrictEqual(scrY.lines, ['y=', '2']);
      assert.ok(scrY.indicators.includes('Up'));
    });

    it('navigates through solutions using UP and EXE', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU A 1 2 1 = 2 = 3 = 2 = 3 = 4 = =');
      assert.strictEqual(calc.getScreen().lines[0], 'x=');

      // EXE advances to next solution
      calc.press('=');
      assert.strictEqual(calc.getScreen().lines[0], 'y=');

      // UP goes back to previous solution
      calc.press('UP');
      assert.strictEqual(calc.getScreen().lines[0], 'x=');

      // EXE on last solution returns to coefficient editor
      calc.press('=');
      assert.strictEqual(calc.getScreen().lines[0], 'y=');
      calc.press('=');
      assert.ok(calc.getScreen().lines.some((l) => l.includes('anx+bny=cn')));
    });

    it('returns to coefficient editor on AC press from any solution screen', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU A 1 2 1 = 2 = 3 = 2 = 3 = 4 = = AC');
      assert.ok(calc.getScreen().lines.some((l) => l.includes('anx+bny=cn')));
    });

    it('clears all coefficients to zero when AC is pressed in editor', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU A 1 2 1 = 2 = 3 = 2 = 3 = 4 = AC');
      assert.ok(calc.getScreen().lines.some((l) => l.includes('a1=0')));
    });

    it('solves 2-unknown system with fractional solutions and supports S<=>D', () => {
      // 2x + 4y = 5, 3x - y = 1 => x = 9/14, y = 13/14
      const calc = new Calculator();
      calc.pressSequence('MENU A 1 2 2 = 4 = 5 = 3 = (-) 1 = 1 = =');
      const scr = calc.getScreen();
      assert.deepStrictEqual(scr.lines, ['x=', '9/14']);

      calc.press('SD');
      assert.ok(calc.getScreen().lines[1].startsWith('0.64285714'));

      calc.press('SD');
      assert.strictEqual(calc.getScreen().lines[1], '9/14');
    });

    it('displays No Solution screen for inconsistent 2-unknown system', () => {
      // x + y = 1, x + y = 2
      const calc = new Calculator();
      calc.pressSequence('MENU A 1 2 1 = 1 = 1 = 1 = 1 = 2 = =');
      assert.ok(calc.getScreen().lines.some((l) => l.includes('No Solution')));

      // Pressing AC returns to editor
      calc.press('AC');
      assert.ok(calc.getScreen().lines.some((l) => l.includes('anx+bny=cn')));
    });

    it('displays Infinite Solution screen for dependent 2-unknown system', () => {
      // x + y = 1, 2x + 2y = 2
      const calc = new Calculator();
      calc.pressSequence('MENU A 1 2 1 = 1 = 1 = 2 = 2 = 2 = =');
      assert.ok(calc.getScreen().lines.some((l) => l.includes('Infinite Solution')));

      // Pressing = returns to editor
      calc.press('=');
      assert.ok(calc.getScreen().lines.some((l) => l.includes('anx+bny=cn')));
    });

    it('assigns solution to variable with STO', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU A 1 2 1 = 2 = 3 = 2 = 3 = 4 = = STO (-) MENU 1 ALPHA (-) =');
      assert.strictEqual(calc.getScreen().lines[1], '−1');
    });
  });

  describe('3. Simultaneous Linear Equations: 3 and 4 Unknowns', () => {
    it('solves 3-unknown system: x+y+z=6, 2y+5z=-4, 2x+5y-z=27 -> x=5, y=3, z=-2', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU A 1 3 1 = 1 = 1 = 6 = 0 = 2 = 5 = (-) 4 = 2 = 5 = (-) 1 = 2 7 = =');
      assert.deepStrictEqual(calc.getScreen().lines, ['x=', '5']);

      calc.press('DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['y=', '3']);

      calc.press('DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['z=', '−2']);
    });

    it('displays No Solution and Infinite Solution for 3-unknown systems', () => {
      // Inconsistent
      const c1 = new Calculator();
      c1.pressSequence('MENU A 1 3 1 = 1 = 1 = 1 = 1 = 1 = 1 = 2 = 2 = 1 = 1 = 3 = =');
      assert.ok(c1.getScreen().lines.some((l) => l.includes('No Solution')));

      // Dependent
      const c2 = new Calculator();
      c2.pressSequence('MENU A 1 3 1 = 1 = 1 = 1 = 2 = 2 = 2 = 2 = 3 = 3 = 3 = 3 = =');
      assert.ok(c2.getScreen().lines.some((l) => l.includes('Infinite Solution')));
    });

    it('solves 4-unknown system: x=1, y=2, z=3, t=4', () => {
      const calc = new Calculator();
      calc.pressSequence(
        'MENU A 1 4 1 = 1 = 1 = 1 = 1 0 = 1 = 2 = 3 = 4 = 3 0 = 1 = (-) 1 = 1 = (-) 1 = (-) 2 = 2 = 1 = (-) 1 = 3 = 1 3 = ='
      );
      assert.deepStrictEqual(calc.getScreen().lines, ['x=', '1']);

      calc.press('DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['y=', '2']);

      calc.press('DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['z=', '3']);

      calc.press('DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['t=', '4']);
    });
  });

  describe('4. Polynomial Mode: Degree 2 (Quadratics)', () => {
    it('solves manual example x²+2x-2=0 with exact surd roots and vertex screens', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU A 2 2 1 = 2 = (-) 2 = =');

      // Root 1
      assert.deepStrictEqual(calc.getScreen().lines, ['x1=', '−1+√3']);
      assert.ok(calc.getScreen().indicators.includes('Down'));

      // Root 2
      calc.press('DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['x2=', '−1−√3']);

      // Vertex x (Local Minimum)
      calc.press('DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['x-Value of Min', '−1']);

      // Vertex y (Local Minimum)
      calc.press('DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['y-Value of Min', '−3']);

      // S<=>D works on root 1
      calc.pressSequence('UP UP UP SD');
      assert.ok(calc.getScreen().lines[1].startsWith('0.7320508'));
    });

    it('displays x-Value of Max and y-Value of Max when a < 0', () => {
      // -x² + 4x - 3 = 0 -> vertex maximum at (2, 1)
      const calc = new Calculator();
      calc.pressSequence('MENU A 2 2 (-) 1 = 4 = (-) 3 = = DOWN DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['x-Value of Max', '2']);

      calc.press('DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['y-Value of Max', '1']);
    });

    it('handles quadratic repeated root (discriminant = 0)', () => {
      // x² - 6x + 9 = 0 -> x1 = 3, x2 = 3
      const calc = new Calculator();
      calc.pressSequence('MENU A 2 2 1 = (-) 6 = 9 = =');
      assert.deepStrictEqual(calc.getScreen().lines, ['x1=', '3']);

      calc.press('DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['x2=', '3']);

      calc.press('DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['x-Value of Min', '3']);

      calc.press('DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['y-Value of Min', '0']);
    });

    it('solves complex roots when eqComplex is On (default)', () => {
      // x² + 2x + 5 = 0 -> x1 = -1+2i, x2 = -1-2i
      const calc = new Calculator();
      calc.pressSequence('MENU A 2 2 1 = 2 = 5 = =');
      assert.deepStrictEqual(calc.getScreen().lines, ['x1=', '−1+2i']);
      assert.ok(calc.getScreen().indicators.includes('i'));

      calc.press('DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['x2=', '−1−2i']);
      assert.ok(calc.getScreen().indicators.includes('i'));
    });

    it('displays No Real Roots and still shows vertex when eqComplex is Off', () => {
      const calc = new Calculator({ setup: { eqComplex: false } });
      calc.pressSequence('MENU A 2 2 1 = 2 = 5 = =');
      assert.deepStrictEqual(calc.getScreen().lines, ['No Real Roots']);

      calc.press('DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['x-Value of Min', '−1']);

      calc.press('DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['y-Value of Min', '4']);
    });

    it('throws Math ERROR when leading coefficient a = 0', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU A 2 2 0 = 2 = 3 = =');
      assert.ok(calc.getScreen().lines.some((l) => l.includes('Math ERROR')));

      calc.press('AC');
      assert.ok(calc.getScreen().lines.some((l) => l.includes('ax²+bx+c=0')));
    });
  });

  describe('5. Polynomial Mode: Degree 3 and 4', () => {
    it('solves cubic equation with 3 real roots: (x-1)(x-2)(x-3) = 0 -> 3, 2, 1', () => {
      // x³ - 6x² + 11x - 6 = 0
      const calc = new Calculator();
      calc.pressSequence('MENU A 2 3 1 = (-) 6 = 1 1 = (-) 6 = =');
      assert.deepStrictEqual(calc.getScreen().lines, ['x1=', '3']);

      calc.press('DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['x2=', '2']);

      calc.press('DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['x3=', '1']);
    });

    it('solves cubic with 1 real root and 2 complex roots: x³-1=0', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU A 2 3 1 = 0 = 0 = (-) 1 = =');
      assert.deepStrictEqual(calc.getScreen().lines, ['x1=', '1']);

      calc.press('DOWN');
      assert.ok(calc.getScreen().lines[0].includes('x2='));
      assert.ok(calc.getScreen().indicators.includes('i'));
    });

    it('solves quartic equation with 4 roots: x⁴ - 5x² + 4 = 0 -> 2, 1, -1, -2', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU A 2 4 1 = 0 = (-) 5 = 0 = 4 = =');
      assert.deepStrictEqual(calc.getScreen().lines, ['x1=', '2']);

      calc.press('DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['x2=', '1']);

      calc.press('DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['x3=', '−1']);

      calc.press('DOWN');
      assert.deepStrictEqual(calc.getScreen().lines, ['x4=', '−2']);
    });
  });

  describe('6. OPTN Key and Type Switching', () => {
    it('switches calculation type via OPTN key resetting coefficients to 0', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU A 1 2 1 = 2 = 3 = 2 = 3 = 4 = =');
      assert.deepStrictEqual(calc.getScreen().lines, ['x=', '−1']);

      // Switch to Polynomial Degree 2
      calc.pressSequence('OPTN 2 2');
      assert.ok(calc.getScreen().lines.some((l) => l.includes('ax²+bx+c=0')));
      assert.ok(calc.getScreen().lines.some((l) => l.includes('a=0')));
    });
  });
});
