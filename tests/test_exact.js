/**
 * Casio fx-991EX ClassWiz Exact Value System Tests (Prompt 8)
 *
 * Covers:
 * - Rational fractions, reduction, mixed fractions, digit limits
 * - SurdForm: square factor extraction, denominator rationalization, linear combinations, bounds
 * - PiForm: arithmetic, formatting, 10^6 range limits
 * - DMSForm: sexagesimal conversion, arithmetic, formatting
 * - ExactValue: special trig values in Deg/Rad, S<=>D state machine, MathI/DecimalO
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { Rational } from '../js/core/exact/Rational.js';
import { SurdForm } from '../js/core/exact/SurdForm.js';
import { PiForm } from '../js/core/exact/PiForm.js';
import { DMSForm } from '../js/core/exact/DMSForm.js';
import { ExactValue } from '../js/core/exact/ExactValue.js';
import { Calculator } from '../js/core/Calculator.js';

describe('Exact Value System (Prompt 8)', () => {

  describe('1. Rational Fractions & Mixed Forms', () => {
    test('reduces 6/8 to lowest terms 3/4', () => {
      const r = new Rational(6n, 8n);
      assert.equal(r.toString(), '3/4');
    });

    test('adds 1/2 + 1/3 = 5/6', () => {
      const r = new Rational(1, 2).add(new Rational(1, 3));
      assert.equal(r.toString(), '5/6');
    });

    test('subtracts 3/4 - 1/8 = 5/8', () => {
      const r = new Rational(3, 4).sub(new Rational(1, 8));
      assert.equal(r.toString(), '5/8');
    });

    test('multiplies 2/3 * 9/4 = 3/2', () => {
      const r = new Rational(2, 3).mul(new Rational(9, 4));
      assert.equal(r.toString(), '3/2');
    });

    test('divides 3/5 / 2/7 = 21/10', () => {
      const r = new Rational(3, 5).div(new Rational(2, 7));
      assert.equal(r.toString(), '21/10');
    });

    test('power (2/3)^3 = 8/27', () => {
      const r = new Rational(2, 3).pow(3);
      assert.equal(r.toString(), '8/27');
    });

    test('division by zero throws Math ERROR', () => {
      assert.throws(() => new Rational(1, 0), /Math ERROR/);
      assert.throws(() => new Rational(1, 2).div(new Rational(0, 1)), /Math ERROR/);
    });

    test('converts improper fraction 7/2 to mixed 3⌟1/2', () => {
      const r = new Rational(7, 2);
      assert.equal(r.toMixedString(), '3⌟1/2');
    });

    test('converts negative improper fraction -11/4 to -2⌟3/4', () => {
      const r = new Rational(-11, 4);
      assert.equal(r.toMixedString(), '-2⌟3/4');
    });

    test('parses mixed fraction string "3⌟1/2" as 7/2', () => {
      const r = Rational.from('3⌟1/2');
      assert.equal(r.toString(), '7/2');
    });

    test('total digits limit: fraction with <= 10 digits can display exact', () => {
      const r = new Rational(12345, 67890);
      assert.equal(r.canDisplayExact(), true);
    });

    test('total digits limit: fraction exceeding 10 digits drops canDisplayExact', () => {
      const r = new Rational(12345678901n, 2n);
      assert.equal(r.canDisplayExact(), false);
    });
  });

  describe('2. SurdForm & Radical Simplifications', () => {
    test('simplifies sqrt(8) -> 2√2', () => {
      const s = SurdForm.sqrt(8);
      assert.equal(s.formatExact(), '2√2');
    });

    test('simplifies sqrt(12)/2 -> √3', () => {
      const s = SurdForm.sqrt(12).div(2);
      assert.equal(s.formatExact(), '√3');
    });

    test('simplifies sqrt(18) -> 3√2', () => {
      assert.equal(SurdForm.sqrt(18).formatExact(), '3√2');
    });

    test('simplifies sqrt(75) -> 5√3', () => {
      assert.equal(SurdForm.sqrt(75).formatExact(), '5√3');
    });

    test('simplifies sqrt(200) -> 10√2', () => {
      assert.equal(SurdForm.sqrt(200).formatExact(), '10√2');
    });

    test('perfect square sqrt(4) simplifies to pure rational 2', () => {
      const s = SurdForm.sqrt(4);
      assert.equal(s.isRational(), true);
      assert.equal(s.formatExact(), '2');
    });

    test('sqrt(0) simplifies to 0', () => {
      assert.equal(SurdForm.sqrt(0).formatExact(), '0');
    });

    test('rational fraction radical sqrt(3/4) -> √3/2', () => {
      const s = SurdForm.sqrt(new Rational(3, 4));
      assert.equal(s.formatExact(), '√3/2');
    });

    test('rational fraction radical sqrt(1/2) -> √2/2', () => {
      const s = SurdForm.sqrt(new Rational(1, 2));
      assert.equal(s.formatExact(), '√2/2');
    });

    test('negative radicand sqrt(-4) throws Math ERROR', () => {
      assert.throws(() => SurdForm.sqrt(-4), /Math ERROR/);
    });
  });

  describe('3. Denominator Rationalization', () => {
    test('rationalizes 1/sqrt(2) -> √2/2', () => {
      const s = SurdForm.sqrt(2).inv();
      assert.equal(s.formatExact(), '√2/2');
    });

    test('rationalizes 6/sqrt(3) -> 2√3', () => {
      const s = new SurdForm(6).div(SurdForm.sqrt(3));
      assert.equal(s.formatExact(), '2√3');
    });

    test('conjugate rationalization 1/(1+sqrt(2)) -> -1+√2', () => {
      const base = new SurdForm(1).add(SurdForm.sqrt(2));
      const inv = base.inv();
      assert.equal(inv.formatExact(), '-1+√2');
    });

    test('conjugate rationalization 1/(2-sqrt(3)) -> 2+√3', () => {
      const base = new SurdForm(2).sub(SurdForm.sqrt(3));
      const inv = base.inv();
      assert.equal(inv.formatExact(), '2+√3');
    });

    test('conjugate rationalization 1/(sqrt(3)+sqrt(2)) -> √3-√2', () => {
      const base = SurdForm.sqrt(3).add(SurdForm.sqrt(2));
      const inv = base.inv();
      assert.equal(inv.formatExact(), '√3-√2');
    });
  });

  describe('4. Surd Arithmetic & Bounds', () => {
    test('adds like radicals: sqrt(2) + sqrt(8) = 3√2', () => {
      const sum = SurdForm.sqrt(2).add(SurdForm.sqrt(8));
      assert.equal(sum.formatExact(), '3√2');
    });

    test('exact cancellation: sqrt(8) - 2√2 = 0', () => {
      const diff = SurdForm.sqrt(8).sub(SurdForm.sqrt(2).mul(2));
      assert.equal(diff.isZero(), true);
      assert.equal(diff.formatExact(), '0');
    });

    test('expands power: (1 + sqrt(2))^2 = 3+2√2', () => {
      const base = new SurdForm(1).add(SurdForm.sqrt(2));
      const pow2 = base.pow(2);
      assert.equal(pow2.formatExact(), '3+2√2');
    });

    test('product of conjugates: (sqrt(3)+sqrt(2))*(sqrt(3)-sqrt(2)) = 1', () => {
      const a = SurdForm.sqrt(3).add(SurdForm.sqrt(2));
      const b = SurdForm.sqrt(3).sub(SurdForm.sqrt(2));
      const prod = a.mul(b);
      assert.equal(prod.isRational(), true);
      assert.equal(prod.formatExact(), '1');
    });

    test('golden ratio representation: (1+sqrt(5))/2', () => {
      const s = new SurdForm(1).add(SurdForm.sqrt(5)).div(2);
      assert.equal(s.formatExact(), '(1+√5)/2');
    });

    test('sin 75 surd representation: (sqrt(6)+sqrt(2))/4', () => {
      const s = SurdForm.sqrt(6).add(SurdForm.sqrt(2)).div(4);
      assert.equal(s.formatExact(), '(√6+√2)/4');
    });

    test('more than 2 surd terms cannot display exact (drops to decimal)', () => {
      const s = SurdForm.sqrt(2).add(SurdForm.sqrt(3)).add(SurdForm.sqrt(5));
      assert.equal(s.canDisplayExact(), false);
    });

    test('radicand >= 1000 cannot display exact', () => {
      const s = SurdForm.sqrt(1001);
      assert.equal(s.canDisplayExact(), false);
    });
  });

  describe('5. PiForm & Limits', () => {
    test('pi display format is "π"', () => {
      assert.equal(new PiForm(1n).formatExact(), 'π');
    });

    test('negative pi display format is "-π"', () => {
      assert.equal(new PiForm(-1n).formatExact(), '-π');
    });

    test('integer multiple 2pi display format is "2π"', () => {
      assert.equal(new PiForm(2n).formatExact(), '2π');
    });

    test('fractional pi/6 display format is "1/6π"', () => {
      assert.equal(new PiForm(new Rational(1, 6)).formatExact(), '1/6π');
    });

    test('fractional 2/3pi display format is "2/3π"', () => {
      assert.equal(new PiForm(new Rational(2, 3)).formatExact(), '2/3π');
    });

    test('adds pi + 2pi = 3pi', () => {
      const p1 = new PiForm(1n);
      const p2 = new PiForm(2n);
      assert.equal(p1.add(p2).formatExact(), '3π');
    });

    test('cancels pi in division: (2pi) / (3pi) = 2/3', () => {
      const p1 = new PiForm(2n);
      const p2 = new PiForm(3n);
      const res = p1.div(p2);
      assert.equal(res instanceof Rational, true);
      assert.equal(res.toString(), '2/3');
    });

    test('pi-form with |x| >= 10^6 cannot display exact', () => {
      const largePi = new PiForm(1000000n);
      assert.equal(largePi.canDisplayExact(), false);
    });
  });

  describe('6. Special Trigonometric Angles (Deg and Rad)', () => {
    test('sin(30°) = 1/2', () => {
      assert.equal(ExactValue.sin(30, 'DEG').format(), '1/2');
    });

    test('sin(45°) = √2/2', () => {
      assert.equal(ExactValue.sin(45, 'DEG').format(), '√2/2');
    });

    test('sin(60°) = √3/2', () => {
      assert.equal(ExactValue.sin(60, 'DEG').format(), '√3/2');
    });

    test('cos(60°) = 1/2', () => {
      assert.equal(ExactValue.cos(60, 'DEG').format(), '1/2');
    });

    test('cos(45°) = √2/2', () => {
      assert.equal(ExactValue.cos(45, 'DEG').format(), '√2/2');
    });

    test('cos(30°) = √3/2', () => {
      assert.equal(ExactValue.cos(30, 'DEG').format(), '√3/2');
    });

    test('tan(30°) = √3/3', () => {
      assert.equal(ExactValue.tan(30, 'DEG').format(), '√3/3');
    });

    test('tan(45°) = 1', () => {
      assert.equal(ExactValue.tan(45, 'DEG').format(), '1');
    });

    test('tan(60°) = √3', () => {
      assert.equal(ExactValue.tan(60, 'DEG').format(), '√3');
    });

    test('tan(90°) throws Math ERROR', () => {
      assert.throws(() => ExactValue.tan(90, 'DEG'), /Math ERROR/);
    });

    test('sin(15°) = (√6-√2)/4', () => {
      assert.equal(ExactValue.sin(15, 'DEG').format(), '(√6-√2)/4');
    });

    test('cos(15°) = (√6+√2)/4', () => {
      assert.equal(ExactValue.cos(15, 'DEG').format(), '(√6+√2)/4');
    });

    test('tan(15°) = 2-√3', () => {
      assert.equal(ExactValue.tan(15, 'DEG').format(), '2-√3');
    });

    test('periodicity: sin(390°) = 1/2', () => {
      assert.equal(ExactValue.sin(390, 'DEG').format(), '1/2');
    });

    test('negative angle: sin(-60°) = -√3/2', () => {
      assert.equal(ExactValue.sin(-60, 'DEG').format(), '-√3/2');
    });

    test('radian angle: sin(π/6) = 1/2', () => {
      assert.equal(ExactValue.sin(Math.PI / 6, 'RAD').format(), '1/2');
    });

    test('radian angle: cos(π/3) = 1/2', () => {
      assert.equal(ExactValue.cos(Math.PI / 3, 'RAD').format(), '1/2');
    });
  });

  describe('7. Degree-Minute-Second (Sexagesimal) DMSForm', () => {
    test('converts decimal 2.5 to sexagesimal 2°30\'0"', () => {
      const dms = DMSForm.fromDecimal(2.5);
      assert.equal(dms.format(), '2°30\'0"');
    });

    test('converts sexagesimal 2°30\'0" back to decimal 2.5', () => {
      const dms = new DMSForm(2, 30, 0);
      assert.equal(dms.toDecimal(), 2.5);
    });

    test('adds sexagesimal: 2°20\'30" + 0°9\'30" = 2°30\'0"', () => {
      const d1 = new DMSForm(2, 20, 30);
      const d2 = new DMSForm(0, 9, 30);
      const sum = DMSForm.fromDecimal(d1.toDecimal() + d2.toDecimal());
      assert.equal(sum.format(), '2°30\'0"');
    });

    test('handles negative sexagesimal: -2.5 -> -2°30\'0"', () => {
      const dms = DMSForm.fromDecimal(-2.5);
      assert.equal(dms.format(), '-2°30\'0"');
    });
  });

  describe('8. S<=>D Toggling and Display Rules', () => {
    test('S<=>D toggles fraction to decimal and back', () => {
      const ev = ExactValue.fromRational(5, 6);
      assert.equal(ev.format(), '5/6');
      ev.toggleSD();
      assert.equal(ev.format(), '0.8333333333');
      ev.toggleSD();
      assert.equal(ev.format(), '5/6');
    });

    test('S<=>D toggles surd 2√2 to decimal and back', () => {
      const ev = ExactValue.sqrt(8);
      assert.equal(ev.format(), '2√2');
      ev.toggleSD();
      assert.equal(ev.format(), '2.828427125');
      ev.toggleSD();
      assert.equal(ev.format(), '2√2');
    });

    test('S<=>D toggles pi to decimal and back', () => {
      const ev = ExactValue.pi();
      assert.equal(ev.format(), 'π');
      ev.toggleSD();
      assert.equal(ev.format(), '3.141592654');
      ev.toggleSD();
      assert.equal(ev.format(), 'π');
    });

    test('SHIFT S<=>D toggles improper fraction 7/2 to mixed 3⌟1/2', () => {
      const ev = ExactValue.fromRational(7, 2);
      assert.equal(ev.format(), '7/2');
      ev.toggleMixed();
      assert.equal(ev.format(), '3⌟1/2');
      ev.toggleMixed();
      assert.equal(ev.format(), '7/2');
    });

    test('SETUP fractionType MIXED defaults to mixed fraction output', () => {
      const ev = ExactValue.fromRational(7, 2);
      assert.equal(ev.format({ fractionType: 'MIXED' }), '3⌟1/2');
    });

    test('MathI/DecimalO defaults to decimal output, S<=>D recovers exact', () => {
      const calc = new Calculator({ setup: { inputOutput: 'MathI/DecimalO' } });
      calc.pressSequence(['1', '÷', '2', '+', '1', '÷', '3', '=']);
      assert.equal(calc.getScreen().lines[1], '0.8333333333');
      calc.press('S<=>D');
      assert.equal(calc.getScreen().lines[1], '5/6');
    });

    test('finite decimal addition 0.1 + 0.2 displays as exact fraction 3/10', () => {
      const calc = new Calculator({ setup: { inputOutput: 'MathI/MathO' } });
      calc.pressSequence(['0', '.', '1', '+', '0', '.', '2', '=']);
      assert.equal(calc.getScreen().lines[1], '3/10');
    });

    test('DEG key converts calculation result between sexagesimal and decimal', () => {
      const calc = new Calculator();
      calc.pressSequence(['5', '÷', '2', '=']);
      assert.equal(calc.getScreen().lines[1], '5/2');
      calc.press('°');
      assert.equal(calc.getScreen().lines[1], '2°30\'0"');
      calc.press('°');
      assert.equal(calc.getScreen().lines[1], '2.5');
    });
  });

});
