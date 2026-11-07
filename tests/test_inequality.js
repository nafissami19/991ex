import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../js/core/Calculator.js';
import { solvePolynomialInequality, toRationalCoeff } from '../js/core/modes/inequality/InequalitySolver.js';
import { Rational } from '../js/core/exact/Rational.js';

describe('Inequality Mode Unit Tests', () => {
  const normSetup = { numberFormat: { type: 'NORM', value: 1 }, inputOutput: 'MathI/MathO' };

  it('toRationalCoeff handles numbers, strings, fractions, bigints', () => {
    assert.equal(toRationalCoeff(5).n, 5n);
    assert.equal(toRationalCoeff(-3n).n, -3n);
    assert.equal(toRationalCoeff('0.5').n, 1n);
    assert.equal(toRationalCoeff('0.5').d, 2n);
    assert.equal(toRationalCoeff('3/4').n, 3n);
    assert.equal(toRationalCoeff('3/4').d, 4n);
    assert.equal(toRationalCoeff(new Rational(2n, 5n)).n, 2n);
  });

  describe('InequalitySolver - Degree 2', () => {
    it('solves standard quadratic (x-1)(x-2) < 0 -> 1 < x < 2', () => {
      const res = solvePolynomialInequality(2, 2, [1, -3, 2], normSetup);
      assert.equal(res.text, '1<x<2');
    });

    it('solves standard quadratic (x-1)(x-2) > 0 -> x < 1, 2 < x', () => {
      const res = solvePolynomialInequality(2, 1, [1, -3, 2], normSetup);
      assert.equal(res.text, 'x<1, 2<x');
    });

    it('solves quadratic with negative leading coefficient -x^2 + 9 > 0 -> -3 < x < 3', () => {
      const res = solvePolynomialInequality(2, 1, [-1, 0, 9], normSetup);
      assert.equal(res.text, '−3<x<3');
    });

    it('solves quadratic with negative leading coefficient -x^2 + 9 <= 0 -> x <= -3, 3 <= x', () => {
      const res = solvePolynomialInequality(2, 4, [-1, 0, 9], normSetup);
      assert.equal(res.text, 'x≤−3, 3≤x');
    });

    it('detects All Real Numbers for x^2 + 1 > 0', () => {
      const res = solvePolynomialInequality(2, 1, [1, 0, 1], normSetup);
      assert.equal(res.special, 'ALL');
      assert.equal(res.text, 'All Real Numbers');
    });

    it('detects No Solution for x^2 + 1 <= 0', () => {
      const res = solvePolynomialInequality(2, 4, [1, 0, 1], normSetup);
      assert.equal(res.special, 'NONE');
      assert.equal(res.text, 'No Solution');
    });

    it('handles single point solution (x-5)^2 <= 0 -> x = 5', () => {
      const res = solvePolynomialInequality(2, 4, [1, -10, 25], normSetup);
      assert.equal(res.text, 'x=5');
    });

    it('handles exact surd roots for x^2 - 2 < 0 -> -√2 < x < √2', () => {
      const res = solvePolynomialInequality(2, 2, [1, 0, -2], normSetup);
      assert.equal(res.text, '−√2<x<√2');
    });

    it('throws Math ERROR when a = 0', () => {
      assert.throws(() => solvePolynomialInequality(2, 1, [0, 2, 3], normSetup), /Math ERROR/);
    });
  });

  describe('InequalitySolver - Degree 3', () => {
    it('solves x(x-1)(x+1) > 0 -> -1 < x < 0, 1 < x', () => {
      const res = solvePolynomialInequality(3, 1, [1, 0, -1, 0], normSetup);
      assert.equal(res.text, '−1<x<0, 1<x');
    });

    it('solves x(x-1)(x+1) <= 0 -> x <= -1, 0 <= x <= 1', () => {
      const res = solvePolynomialInequality(3, 4, [1, 0, -1, 0], normSetup);
      assert.equal(res.text, 'x≤−1, 0≤x≤1');
    });

    it('solves User Guide cubic: 3x^3 + 3x^2 - x > 0', () => {
      const res = solvePolynomialInequality(3, 1, [3, 3, -1, 0], normSetup);
      assert.equal(res.text, '(−3−√21)/6<x<0, (−3+√21)/6<x');
    });

    it('solves single real root cubic x^3 - 27 >= 0 -> 3 <= x', () => {
      const res = solvePolynomialInequality(3, 3, [1, 0, 0, -27], normSetup);
      assert.equal(res.text, '3≤x');
    });
  });

  describe('InequalitySolver - Degree 4', () => {
    it('solves biquadratic (x^2 - 1)(x^2 - 4) < 0 -> -2 < x < -1, 1 < x < 2', () => {
      // x^4 - 5x^2 + 4 < 0
      const res = solvePolynomialInequality(4, 2, [1, 0, -5, 0, 4], normSetup);
      assert.equal(res.text, '−2<x<−1, 1<x<2');
    });

    it('solves biquadratic (x^2 - 1)(x^2 - 4) >= 0 -> x <= -2, -1 <= x <= 1, 2 <= x', () => {
      const res = solvePolynomialInequality(4, 3, [1, 0, -5, 0, 4], normSetup);
      assert.equal(res.text, 'x≤−2, −1≤x≤1, 2≤x');
    });

    it('detects All Real Numbers for x^4 + 2x^2 + 5 > 0', () => {
      const res = solvePolynomialInequality(4, 1, [1, 0, 2, 0, 5], normSetup);
      assert.equal(res.special, 'ALL');
      assert.equal(res.text, 'All Real Numbers');
    });

    it('detects No Solution for x^4 + 2x^2 + 5 <= 0', () => {
      const res = solvePolynomialInequality(4, 4, [1, 0, 2, 0, 5], normSetup);
      assert.equal(res.special, 'NONE');
      assert.equal(res.text, 'No Solution');
    });
  });

  describe('InequalityApp State Machine & Interactions', () => {
    it('navigates through degree select, type select, and solves', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU B');
      assert.deepEqual(calc.getScreen().lines, ['Inequality', 'Polynomial', 'Degree? 2~4']);

      calc.press('2');
      assert.ok(calc.getScreen().lines.some(l => l.includes('1:ax²+bx+c>0')));

      calc.press('2'); // select ax^2+bx+c < 0
      assert.ok(calc.getScreen().lines[0].includes('ax²+bx+c<0'));

      calc.pressSequence('1 = 2 = (-) 3 = =');
      assert.equal(calc.getScreen().lines[1], '−3<x<1');
    });

    it('toggles exact and decimal forms with SD key', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU B 2 2 1 = 2 = (-) 2 = =');
      assert.equal(calc.getScreen().lines[1], '−1−√3<x<−1+√3');

      calc.press('SD');
      assert.ok(calc.getScreen().lines[1].includes('<x<'));
      assert.ok(calc.getScreen().lines[1].includes('.'));

      calc.press('SD');
      assert.equal(calc.getScreen().lines[1], '−1−√3<x<−1+√3');
    });

    it('AC on solution returns to editor, second AC clears all to 0', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU B 2 2 1 = 2 = (-) 3 = =');
      calc.press('AC');
      assert.ok(calc.getScreen().lines[1].includes('a=1 b=2 c=-3'));

      calc.press('AC');
      assert.ok(calc.getScreen().lines[1].includes('a=0 b=0 c=0'));
    });

    it('OPTN 1 re-prompts for degree and clears coefficients', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU B 2 2 1 = 2 = (-) 3 = = OPTN 1');
      assert.deepEqual(calc.getScreen().lines, ['Inequality', 'Polynomial', 'Degree? 2~4']);
    });

    it('shows Math ERROR when leading coefficient a = 0', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU B 2 1 0 = 5 = 6 = =');
      assert.ok(calc.getScreen().lines.some(l => l.includes('Math ERROR')));

      calc.press('AC');
      assert.ok(calc.getScreen().lines[0].includes('ax²+bx+c>0'));
    });
  });
});
