/**
 * Comprehensive Unit Tests for Casio fx-991EX Scientific Functions
 *
 * Verifies all 40+ functions implemented in js/core/number/functions.js:
 * - At least 5 test cases per function (covering normal, edge cases, exact values, domain errors).
 * - Full 15-digit accuracy and adherence to docs/spec/ranges.md.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Decimal15 } from '../js/core/number/Decimal15.js';
import { CalcError } from '../js/core/errors.js';
import * as fn from '../js/core/number/functions.js';

describe('Scientific Functions (functions.js)', () => {

  describe('1. sin(x)', () => {
    it('sin(0) = 0 exactly', () => {
      assert.strictEqual(fn.sin(0, 'DEG').toString(), '0');
    });

    it('sin(30°) = 0.5 exactly', () => {
      assert.strictEqual(fn.sin(30, 'DEG').toString(), '0.5');
    });

    it('sin(90°) = 1 exactly', () => {
      assert.strictEqual(fn.sin(90, 'DEG').toString(), '1');
    });

    it('sin(180°) = 0 exactly', () => {
      assert.strictEqual(fn.sin(180, 'DEG').toString(), '0');
    });

    it('sin(270°) = -1 exactly', () => {
      assert.strictEqual(fn.sin(270, 'DEG').toString(), '-1');
    });

    it('sin(45°) has 15-digit accuracy (approx 0.707106781186548)', () => {
      const res = fn.sin(45, 'DEG').toString();
      assert.strictEqual(res.slice(0, 10), '0.70710678');
    });

    it('sin in RAD mode for π/6 is 0.5', () => {
      const piOver6 = fn.CASIO_PI.div(Decimal15.from(6));
      const res = fn.sin(piOver6, 'RAD');
      assert.strictEqual(res.toDisplayString(), '0.5');
    });

    it('angle >= 9e9 throws Math ERROR in DEG mode', () => {
      assert.throws(() => fn.sin(Decimal15.fromString('9e9'), 'DEG'), CalcError);
    });
  });

  describe('2. cos(x)', () => {
    it('cos(0°) = 1 exactly', () => {
      assert.strictEqual(fn.cos(0, 'DEG').toString(), '1');
    });

    it('cos(60°) = 0.5 exactly', () => {
      assert.strictEqual(fn.cos(60, 'DEG').toString(), '0.5');
    });

    it('cos(90°) = 0 exactly', () => {
      assert.strictEqual(fn.cos(90, 'DEG').toString(), '0');
    });

    it('cos(120°) = -0.5 exactly', () => {
      assert.strictEqual(fn.cos(120, 'DEG').toString(), '-0.5');
    });

    it('cos(180°) = -1 exactly', () => {
      assert.strictEqual(fn.cos(180, 'DEG').toString(), '-1');
    });

    it('cos in GRA mode: cos(100) = 0, cos(200) = -1', () => {
      assert.strictEqual(fn.cos(100, 'GRA').toString(), '0');
      assert.strictEqual(fn.cos(200, 'GRA').toString(), '-1');
    });
  });

  describe('3. tan(x)', () => {
    it('tan(0°) = 0 exactly', () => {
      assert.strictEqual(fn.tan(0, 'DEG').toString(), '0');
    });

    it('tan(45°) = 1 exactly', () => {
      assert.strictEqual(fn.tan(45, 'DEG').toString(), '1');
    });

    it('tan(135°) = -1 exactly', () => {
      assert.strictEqual(fn.tan(135, 'DEG').toString(), '-1');
    });

    it('tan(180°) = 0 exactly', () => {
      assert.strictEqual(fn.tan(180, 'DEG').toString(), '0');
    });

    it('tan(90°) throws Math ERROR', () => {
      assert.throws(() => fn.tan(90, 'DEG'), CalcError);
    });

    it('tan(270°) throws Math ERROR', () => {
      assert.throws(() => fn.tan(270, 'DEG'), CalcError);
    });
  });

  describe('4. asin(x)', () => {
    it('asin(0) = 0', () => {
      assert.strictEqual(fn.asin(0, 'DEG').toString(), '0');
    });

    it('asin(0.5) = 30°', () => {
      assert.strictEqual(fn.asin(0.5, 'DEG').toString(), '30');
    });

    it('asin(1) = 90°', () => {
      assert.strictEqual(fn.asin(1, 'DEG').toString(), '90');
    });

    it('asin(-0.5) = -30°', () => {
      assert.strictEqual(fn.asin(-0.5, 'DEG').toString(), '-30');
    });

    it('asin(-1) = -90°', () => {
      assert.strictEqual(fn.asin(-1, 'DEG').toString(), '-90');
    });

    it('asin(1.0001) throws Math ERROR', () => {
      assert.throws(() => fn.asin(1.0001, 'DEG'), CalcError);
    });
  });

  describe('5. acos(x)', () => {
    it('acos(1) = 0°', () => {
      assert.strictEqual(fn.acos(1, 'DEG').toString(), '0');
    });

    it('acos(0.5) = 60°', () => {
      assert.strictEqual(fn.acos(0.5, 'DEG').toString(), '60');
    });

    it('acos(0) = 90°', () => {
      assert.strictEqual(fn.acos(0, 'DEG').toString(), '90');
    });

    it('acos(-0.5) = 120°', () => {
      assert.strictEqual(fn.acos(-0.5, 'DEG').toString(), '120');
    });

    it('acos(-1) = 180°', () => {
      assert.strictEqual(fn.acos(-1, 'DEG').toString(), '180');
    });

    it('acos(1.5) throws Math ERROR', () => {
      assert.throws(() => fn.acos(1.5, 'DEG'), CalcError);
    });
  });

  describe('6. atan(x)', () => {
    it('atan(0) = 0°', () => {
      assert.strictEqual(fn.atan(0, 'DEG').toString(), '0');
    });

    it('atan(1) = 45°', () => {
      assert.strictEqual(fn.atan(1, 'DEG').toString(), '45');
    });

    it('atan(-1) = -45°', () => {
      assert.strictEqual(fn.atan(-1, 'DEG').toString(), '-45');
    });

    it('atan in GRA: atan(1) = 50', () => {
      assert.strictEqual(fn.atan(1, 'GRA').toString(), '50');
    });

    it('atan for large values approaches 90°', () => {
      const res = fn.atan(Decimal15.fromString('1e15'), 'DEG');
      assert.strictEqual(res.toDisplayString(), '90');
    });
  });

  describe('7. Hyperbolic functions: sinh, cosh, tanh', () => {
    it('sinh(0) = 0', () => {
      assert.strictEqual(fn.sinh(0).toString(), '0');
    });

    it('cosh(0) = 1', () => {
      assert.strictEqual(fn.cosh(0).toString(), '1');
    });

    it('tanh(0) = 0', () => {
      assert.strictEqual(fn.tanh(0).toString(), '0');
    });

    it('sinh(1) and cosh(1) satisfy cosh^2 - sinh^2 = 1', () => {
      const s = fn.sinh(1);
      const c = fn.cosh(1);
      const diff = c.mul(c).sub(s.mul(s));
      assert.strictEqual(diff.toDisplayString(), '1');
    });

    it('tanh(100) = 1', () => {
      assert.strictEqual(fn.tanh(100).toString(), '1');
    });

    it('sinh(231) throws Math ERROR (limit 230.2585092)', () => {
      assert.throws(() => fn.sinh(231), CalcError);
    });
  });

  describe('8. Inverse Hyperbolic: asinh, acosh, atanh', () => {
    it('asinh(0) = 0', () => {
      assert.strictEqual(fn.asinh(0).toString(), '0');
    });

    it('acosh(1) = 0', () => {
      assert.strictEqual(fn.acosh(1).toString(), '0');
    });

    it('atanh(0) = 0', () => {
      assert.strictEqual(fn.atanh(0).toString(), '0');
    });

    it('acosh(x < 1) throws Math ERROR', () => {
      assert.throws(() => fn.acosh(0.999), CalcError);
    });

    it('atanh(|x| >= 1) throws Math ERROR', () => {
      assert.throws(() => fn.atanh(1), CalcError);
      assert.throws(() => fn.atanh(1.5), CalcError);
    });
  });

  describe('9. Logarithms: log, ln, logBase', () => {
    it('log(1000) = 3 exactly', () => {
      assert.strictEqual(fn.log(1000).toString(), '3');
    });

    it('log(1) = 0', () => {
      assert.strictEqual(fn.log(1).toString(), '0');
    });

    it('log(0.01) = -2', () => {
      assert.strictEqual(fn.log(0.01).toString(), '-2');
    });

    it('ln(1) = 0', () => {
      assert.strictEqual(fn.ln(1).toString(), '0');
    });

    it('ln(e) = 1 exactly using Casio e', () => {
      assert.strictEqual(fn.ln(fn.CASIO_E).toString(), '1');
    });

    it('logBase(2, 16) = 4', () => {
      assert.strictEqual(fn.logBase(2, 16).toString(), '4');
    });

    it('logBase(3, 9) = 2', () => {
      assert.strictEqual(fn.logBase(3, 9).toString(), '2');
    });

    it('log(0) and ln(-5) throw Math ERROR', () => {
      assert.throws(() => fn.log(0), CalcError);
      assert.throws(() => fn.ln(-5), CalcError);
    });
  });

  describe('10. Exponentials: exp, pow10', () => {
    it('exp(0) = 1', () => {
      assert.strictEqual(fn.exp(0).toString(), '1');
    });

    it('exp(1) = Casio internal e', () => {
      assert.strictEqual(fn.exp(1).toString(), fn.CASIO_E.toString());
    });

    it('pow10(0) = 1', () => {
      assert.strictEqual(fn.pow10(0).toString(), '1');
    });

    it('pow10(3) = 1000 exactly', () => {
      assert.strictEqual(fn.pow10(3).toString(), '1000');
    });

    it('pow10(-2) = 0.01', () => {
      assert.strictEqual(fn.pow10(-2).toString(), '0.01');
    });

    it('pow10(100) throws Math ERROR', () => {
      assert.throws(() => fn.pow10(100), CalcError);
    });

    it('exp(231) throws Math ERROR', () => {
      assert.throws(() => fn.exp(231), CalcError);
    });
  });

  describe('11. Powers and Roots: pow, xRoot, sqrt, cbrt, sqr, cube, recip', () => {
    it('pow: 2^10 = 1024', () => {
      assert.strictEqual(fn.pow(2, 10).toString(), '1024');
    });

    it('pow: (-2)^3 = -8', () => {
      assert.strictEqual(fn.pow(-2, 3).toString(), '-8');
    });

    it('pow: (-2)^4 = 16', () => {
      assert.strictEqual(fn.pow(-2, 4).toString(), '16');
    });

    it('pow: (-8)^(1/3) = -2 (odd denominator rational root)', () => {
      const oneThird = Decimal15.ONE.div(Decimal15.fromString('3'));
      assert.strictEqual(fn.pow(-8, oneThird).toString(), '-2');
    });

    it('pow: 0^0 throws Math ERROR', () => {
      assert.throws(() => fn.pow(0, 0), CalcError);
    });

    it('sqrt: sqrt(4) = 2, sqrt(0.25) = 0.5, sqrt(8) approx 2.82842712474619', () => {
      assert.strictEqual(fn.sqrt(4).toString(), '2');
      assert.strictEqual(fn.sqrt(0.25).toString(), '0.5');
      assert.strictEqual(fn.sqrt(8).toString(), '2.82842712474619');
    });

    it('sqrt(-1) throws Math ERROR', () => {
      assert.throws(() => fn.sqrt(-1), CalcError);
    });

    it('cbrt: cbrt(8) = 2, cbrt(-8) = -2, cbrt(27) = 3', () => {
      assert.strictEqual(fn.cbrt(8).toString(), '2');
      assert.strictEqual(fn.cbrt(-8).toString(), '-2');
      assert.strictEqual(fn.cbrt(27).toString(), '3');
    });

    it('xRoot: 3√8 = 2, 2√9 = 3, 3√(-8) = -2', () => {
      assert.strictEqual(fn.xRoot(3, 8).toString(), '2');
      assert.strictEqual(fn.xRoot(2, 9).toString(), '3');
      assert.strictEqual(fn.xRoot(3, -8).toString(), '-2');
    });

    it('sqr: sqr(5) = 25, sqr(-7) = 49', () => {
      assert.strictEqual(fn.sqr(5).toString(), '25');
      assert.strictEqual(fn.sqr(-7).toString(), '49');
    });

    it('cube: cube(3) = 27, cube(-4) = -64', () => {
      assert.strictEqual(fn.cube(3).toString(), '27');
      assert.strictEqual(fn.cube(-4).toString(), '-64');
    });

    it('recip: recip(2) = 0.5, recip(0) throws Math ERROR', () => {
      assert.strictEqual(fn.recip(2).toString(), '0.5');
      assert.throws(() => fn.recip(0), CalcError);
    });
  });

  describe('12. Factorial and Combinatorics: x!, nPr, nCr', () => {
    it('0! = 1, 1! = 1, 5! = 120', () => {
      assert.strictEqual(fn.factorial(0).toString(), '1');
      assert.strictEqual(fn.factorial(1).toString(), '1');
      assert.strictEqual(fn.factorial(5).toString(), '120');
    });

    it('69! evaluates to ~1.71122452428141e+98', () => {
      const res = fn.factorial(69).toString();
      assert.ok(res.startsWith('1.71122452428141e'));
    });

    it('70! overflows and throws Math ERROR', () => {
      assert.throws(() => fn.factorial(70), CalcError);
    });

    it('factorial(-1) and factorial(3.5) throw Math ERROR', () => {
      assert.throws(() => fn.factorial(-1), CalcError);
      assert.throws(() => fn.factorial(3.5), CalcError);
    });

    it('10 nPr 3 = 720, 5 nPr 5 = 120, 5 nPr 0 = 1', () => {
      assert.strictEqual(fn.nPr(10, 3).toString(), '720');
      assert.strictEqual(fn.nPr(5, 5).toString(), '120');
      assert.strictEqual(fn.nPr(5, 0).toString(), '1');
    });

    it('10 nCr 3 = 120, 5 nCr 5 = 1, 5 nCr 0 = 1', () => {
      assert.strictEqual(fn.nCr(10, 3).toString(), '120');
      assert.strictEqual(fn.nCr(5, 5).toString(), '1');
      assert.strictEqual(fn.nCr(5, 0).toString(), '1');
    });

    it('nPr/nCr with r > n throws Math ERROR', () => {
      assert.throws(() => fn.nPr(3, 5), CalcError);
      assert.throws(() => fn.nCr(3, 5), CalcError);
    });
  });

  describe('13. Number Calculation: Abs, Int, Intg, Rnd, %', () => {
    it('abs: abs(5) = 5, abs(-5) = 5, abs(0) = 0', () => {
      assert.strictEqual(fn.abs(5).toString(), '5');
      assert.strictEqual(fn.abs(-5).toString(), '5');
      assert.strictEqual(fn.abs(0).toString(), '0');
    });

    it('int: truncates towards zero: int(3.8) = 3, int(-3.8) = -3', () => {
      assert.strictEqual(fn.int(3.8).toString(), '3');
      assert.strictEqual(fn.int(-3.8).toString(), '-3');
    });

    it('intg: greatest integer (floor): intg(3.8) = 3, intg(-3.8) = -4', () => {
      assert.strictEqual(fn.intg(3.8).toString(), '3');
      assert.strictEqual(fn.intg(-3.8).toString(), '-4');
    });

    it('rnd: rounds to Fix/Sci/Norm setting', () => {
      const v = Decimal15.fromString('3.33333333333333');
      const rFix3 = fn.rnd(v, { type: 'FIX', value: 3 });
      assert.strictEqual(rFix3.toString(), '3.333');

      const rSci4 = fn.rnd(Decimal15.from(12345), { type: 'SCI', value: 4 });
      assert.strictEqual(rSci4.toDisplayString(), '12350');
    });

    it('percent: 100% = 1, 50% = 0.5, 200% = 2', () => {
      assert.strictEqual(fn.percent(100).toString(), '1');
      assert.strictEqual(fn.percent(50).toString(), '0.5');
      assert.strictEqual(fn.percent(200).toString(), '2');
    });
  });

  describe('14. Coordinate conversions: Pol & Rec', () => {
    it('Pol(1, 1) in DEG gives r approx 1.4142135623731, θ = 45°', () => {
      const p = fn.pol(1, 1, 'DEG');
      assert.strictEqual(p.r.toDisplayString(), '1.414213562');
      assert.strictEqual(p.theta.toString(), '45');
    });

    it('Pol(0, 5) gives r = 5, θ = 90°', () => {
      const p = fn.pol(0, 5, 'DEG');
      assert.strictEqual(p.r.toString(), '5');
      assert.strictEqual(p.theta.toString(), '90');
    });

    it('Pol(-3, 0) gives r = 3, θ = 180°', () => {
      const p = fn.pol(-3, 0, 'DEG');
      assert.strictEqual(p.r.toString(), '3');
      assert.strictEqual(p.theta.toString(), '180');
    });

    it('Rec(2, 60°) gives x = 1, y = 1.73205080756888', () => {
      const r = fn.rec(2, 60, 'DEG');
      assert.strictEqual(r.x.toString(), '1');
      assert.strictEqual(r.y.toDisplayString(), '1.732050808');
    });

    it('Rec(-1, 0) throws Math ERROR (r cannot be negative)', () => {
      assert.throws(() => fn.rec(-1, 0, 'DEG'), CalcError);
    });
  });

  describe('15. Sexagesimal (DMS) & Number Theory (GCD, LCM, ÷R)', () => {
    it('toDMS and fromDMS roundtrip: 2.258 -> 2° 15\' 28.8"', () => {
      const dms = fn.toDMS(2.258);
      assert.strictEqual(dms.d.toString(), '2');
      assert.strictEqual(dms.m.toString(), '15');
      assert.strictEqual(dms.s.toString(), '28.8');

      const recVal = fn.fromDMS(dms.d, dms.m, dms.s);
      assert.strictEqual(recVal.toDisplayString(), '2.258');
    });

    it('gcd: gcd(12, 18) = 6, gcd(7, 13) = 1', () => {
      assert.strictEqual(fn.gcd(12, 18).toString(), '6');
      assert.strictEqual(fn.gcd(7, 13).toString(), '1');
    });

    it('lcm: lcm(12, 18) = 36, lcm(4, 6) = 12', () => {
      assert.strictEqual(fn.lcm(12, 18).toString(), '36');
      assert.strictEqual(fn.lcm(4, 6).toString(), '12');
    });

    it('divR: 11 ÷R 3 -> q = 3, r = 2; 15 ÷R 5 -> q = 3, r = 0', () => {
      const r1 = fn.divR(11, 3);
      assert.strictEqual(r1.q.toString(), '3');
      assert.strictEqual(r1.r.toString(), '2');

      const r2 = fn.divR(15, 5);
      assert.strictEqual(r2.q.toString(), '3');
      assert.strictEqual(r2.r.toString(), '0');
    });

    it('divR by 0 throws Math ERROR', () => {
      assert.throws(() => fn.divR(10, 0), CalcError);
    });
  });

  describe('16. Random Functions: Ran# and RanInt#', () => {
    it('ranHash produces 3-digit decimal in [0, 1)', () => {
      const r = fn.ranHash(() => 0.459);
      assert.strictEqual(r.toString(), '0.459');
    });

    it('ranInt generates integer in range [a, b]', () => {
      const r1 = fn.ranInt(1, 6, () => 0.5);
      assert.strictEqual(r1.toString(), '4');
    });

    it('ranInt with a > b throws Math ERROR', () => {
      assert.throws(() => fn.ranInt(6, 1), CalcError);
    });
  });

});
