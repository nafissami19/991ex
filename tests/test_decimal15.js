import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Decimal15 } from '../js/core/number/Decimal15.js';
import { CalcError } from '../js/core/errors.js';
import { Rational } from '../js/core/exact/Rational.js';

describe('Decimal15 Unit Tests (60+ cases)', () => {
  describe('1. Instantiation & Factory Methods', () => {
    it('creates zero', () => {
      const z = Decimal15.ZERO;
      assert.equal(z.isZero(), true);
      assert.equal(z.sign, 0);
      assert.equal(z.mantissa, 0n);
      assert.equal(z.exp, 0);
      assert.equal(z.toString(), '0');
    });

    it('creates fromInt(1)', () => {
      const one = Decimal15.fromInt(1);
      assert.equal(one.sign, 1);
      assert.equal(one.mantissa, 100000000000000n);
      assert.equal(one.exp, -14);
      assert.equal(one.toString(), '1');
    });

    it('creates fromInt(-42)', () => {
      const n = Decimal15.fromInt(-42);
      assert.equal(n.sign, -1);
      assert.equal(n.mantissa, 420000000000000n);
      assert.equal(n.toString(), '-42');
    });

    it('creates fromBigInt(100000000000000n)', () => {
      const b = Decimal15.fromBigInt(100000000000000n);
      assert.equal(b.toString(), '100000000000000');
    });

    it('creates fromString("0.3")', () => {
      const d = Decimal15.fromString('0.3');
      assert.equal(d.sign, 1);
      assert.equal(d.mantissa, 300000000000000n);
      assert.equal(d.toString(), '0.3');
    });

    it('creates fromString("-0.005")', () => {
      const d = Decimal15.fromString('-0.005');
      assert.equal(d.sign, -1);
      assert.equal(d.mantissa, 500000000000000n);
      assert.equal(d.toString(), '-0.005');
    });

    it('creates fromString with unicode minus "−12.5"', () => {
      const d = Decimal15.fromString('−12.5');
      assert.equal(d.sign, -1);
      assert.equal(d.toString(), '-12.5');
    });

    it('creates fromString scientific notation "1.5e3"', () => {
      const d = Decimal15.fromString('1.5e3');
      assert.equal(d.toString(), '1500');
    });

    it('creates fromString negative exponent "2.5E-4"', () => {
      const d = Decimal15.fromString('2.5E-4');
      assert.equal(d.toString(), '0.00025');
    });

    it('normalizes 15 digits exactly from 20-digit string', () => {
      const d = Decimal15.fromString('1.2345678901234567890');
      // 16th digit is 6 >= 5, rounds 5 -> 6
      assert.equal(d.mantissa, 123456789012346n);
    });
  });

  describe('2. Precision & Rounding Rules', () => {
    it('0.1 + 0.2 === 0.3 exactly', () => {
      const a = Decimal15.fromString('0.1');
      const b = Decimal15.fromString('0.2');
      const c = a.add(b);
      assert.equal(c.toString(), '0.3');
      assert.equal(c.mantissa, 300000000000000n);
      assert.equal(c.eq(Decimal15.fromString('0.3')), true);
    });

    it('1 ÷ 3 × 3 internal value is 0.999999999999999', () => {
      const one = Decimal15.ONE;
      const three = Decimal15.fromInt(3);
      const third = one.div(three);
      assert.equal(third.mantissa, 333333333333333n);
      assert.equal(third.toString(), '0.333333333333333');

      const back = third.mul(three);
      assert.equal(back.mantissa, 999999999999999n);
      assert.equal(back.toString(), '0.999999999999999');
    });

    it('1 ÷ 3 × 3 display rounding produces "1"', () => {
      const back = Decimal15.ONE.div(Decimal15.fromInt(3)).mul(Decimal15.fromInt(3));
      assert.equal(back.toDisplayString(), '1');
    });

    it('round half-up: truncates when 16th digit is 4', () => {
      const d = Decimal15.fromString('1.000000000000004');
      assert.equal(d.mantissa, 100000000000000n);
    });

    it('round half-up: rounds up when 16th digit is 5', () => {
      const d = Decimal15.fromString('1.000000000000005');
      assert.equal(d.mantissa, 100000000000001n);
    });

    it('round half-up ripple carry: 0.9999999999999995 -> 1', () => {
      const d = Decimal15.fromString('0.9999999999999995');
      assert.equal(d.mantissa, 100000000000000n);
      assert.equal(d.toString(), '1');
    });
  });

  describe('3. Basic Arithmetic', () => {
    it('addition of positive integers', () => {
      const a = Decimal15.fromInt(15);
      const b = Decimal15.fromInt(27);
      assert.equal(a.add(b).toString(), '42');
    });

    it('addition with negative numbers', () => {
      const a = Decimal15.fromInt(15);
      const b = Decimal15.fromInt(-27);
      assert.equal(a.add(b).toString(), '-12');
    });

    it('subtraction resulting in zero', () => {
      const a = Decimal15.fromString('123.456');
      const b = Decimal15.fromString('123.456');
      assert.equal(a.sub(b).isZero(), true);
    });

    it('multiplication of decimals', () => {
      const a = Decimal15.fromString('1.25');
      const b = Decimal15.fromString('0.8');
      assert.equal(a.mul(b).toString(), '1');
    });

    it('multiplication with signs', () => {
      const a = Decimal15.fromInt(-5);
      const b = Decimal15.fromInt(-6);
      assert.equal(a.mul(b).toString(), '30');
    });

    it('division of integers', () => {
      const a = Decimal15.fromInt(100);
      const b = Decimal15.fromInt(4);
      assert.equal(a.div(b).toString(), '25');
    });

    it('division resulting in decimal', () => {
      const a = Decimal15.fromInt(7);
      const b = Decimal15.fromInt(2);
      assert.equal(a.div(b).toString(), '3.5');
    });

    it('division by zero throws CalcError("Math ERROR")', () => {
      assert.throws(() => {
        Decimal15.ONE.div(Decimal15.ZERO);
      }, (err) => err instanceof CalcError && err.message === 'Math ERROR');
    });

    it('zero divided by non-zero is zero', () => {
      assert.equal(Decimal15.ZERO.div(Decimal15.TEN).isZero(), true);
    });

    it('addition of widely different magnitudes (absorbs smaller)', () => {
      const huge = Decimal15.fromString('1e50');
      const tiny = Decimal15.fromString('1e-10');
      assert.equal(huge.add(tiny).toString(), huge.toString());
    });
  });

  describe('4. Exponent Limits & Underflow / Overflow', () => {
    it('supports maximum allowed value: 9.99999999999999e99', () => {
      const maxVal = Decimal15.fromString('9.99999999999999e99');
      assert.equal(maxVal.sciExp, 99);
      assert.equal(maxVal.sign, 1);
    });

    it('supports negative maximum allowed value: -9.99999999999999e99', () => {
      const minVal = Decimal15.fromString('-9.99999999999999e99');
      assert.equal(minVal.sciExp, 99);
      assert.equal(minVal.sign, -1);
    });

    it('overflow >= 1e100 throws CalcError("Math ERROR")', () => {
      assert.throws(() => {
        Decimal15.fromString('1e100');
      }, (err) => err instanceof CalcError && err.message === 'Math ERROR');
    });

    it('overflow on multiplication throws CalcError("Math ERROR")', () => {
      const a = Decimal15.fromString('1e60');
      const b = Decimal15.fromString('1e41');
      assert.throws(() => {
        a.mul(b);
      }, (err) => err instanceof CalcError && err.message === 'Math ERROR');
    });

    it('supports minimum allowed value: 1e-99', () => {
      const minSmall = Decimal15.fromString('1e-99');
      assert.equal(minSmall.sciExp, -99);
      assert.equal(minSmall.isZero(), false);
    });

    it('underflow below 1e-99 becomes 0', () => {
      const underflow = Decimal15.fromString('1e-100');
      assert.equal(underflow.isZero(), true);
    });

    it('underflow on division becomes 0', () => {
      const small = Decimal15.fromString('1e-80');
      const big = Decimal15.fromString('1e30');
      assert.equal(small.div(big).isZero(), true);
    });
  });

  describe('5. Comparisons', () => {
    it('cmp identical values returns 0', () => {
      const a = Decimal15.fromString('42.5');
      const b = Decimal15.fromString('42.500');
      assert.equal(a.cmp(b), 0);
      assert.equal(a.eq(b), true);
    });

    it('cmp positive and negative', () => {
      const a = Decimal15.fromInt(1);
      const b = Decimal15.fromInt(-1);
      assert.equal(a.cmp(b), 1);
      assert.equal(b.cmp(a), -1);
    });

    it('cmp different orders of magnitude', () => {
      const a = Decimal15.fromInt(100);
      const b = Decimal15.fromInt(99);
      assert.equal(a.cmp(b), 1);
      assert.equal(b.cmp(a), -1);
      assert.equal(a.gt(b), true);
      assert.equal(b.lt(a), true);
    });

    it('cmp negative values reversed magnitude', () => {
      const a = Decimal15.fromInt(-100);
      const b = Decimal15.fromInt(-50);
      assert.equal(a.lt(b), true);
      assert.equal(b.gt(a), true);
    });

    it('lte and gte', () => {
      const a = Decimal15.fromInt(5);
      const b = Decimal15.fromInt(5);
      assert.equal(a.lte(b), true);
      assert.equal(a.gte(b), true);
    });
  });

  describe('6. Integer Operations: isInteger, floor, trunc, frac', () => {
    it('isInteger on whole numbers returns true', () => {
      assert.equal(Decimal15.fromInt(123456).isInteger(), true);
      assert.equal(Decimal15.fromString('100.0').isInteger(), true);
      assert.equal(Decimal15.ZERO.isInteger(), true);
    });

    it('isInteger on fractions returns false', () => {
      assert.equal(Decimal15.fromString('12.34').isInteger(), false);
      assert.equal(Decimal15.fromString('0.000000000000001').isInteger(), false);
    });

    it('trunc removes fractional part towards zero', () => {
      assert.equal(Decimal15.fromString('5.9').trunc().toString(), '5');
      assert.equal(Decimal15.fromString('-5.9').trunc().toString(), '-5');
      assert.equal(Decimal15.fromString('0.7').trunc().toString(), '0');
    });

    it('floor rounds down to next integer', () => {
      assert.equal(Decimal15.fromString('5.9').floor().toString(), '5');
      assert.equal(Decimal15.fromString('-5.1').floor().toString(), '-6');
      assert.equal(Decimal15.fromString('-5.0').floor().toString(), '-5');
    });

    it('frac returns fractional remainder', () => {
      const d = Decimal15.fromString('12.345');
      assert.equal(d.frac().toString(), '0.345');
    });
  });

  describe('7. Conversions to/from Rational', () => {
    it('fromRational(1/2) is 0.5', () => {
      const r = new Rational(1n, 2n);
      const d = Decimal15.fromRational(r);
      assert.equal(d.toString(), '0.5');
    });

    it('fromRational(1/3) is 0.333333333333333', () => {
      const r = new Rational(1n, 3n);
      const d = Decimal15.fromRational(r);
      assert.equal(d.mantissa, 333333333333333n);
    });

    it('toRational() converts exact fractions', () => {
      const d = Decimal15.fromString('0.75');
      const r = d.toRational();
      assert.equal(r.toString(), '3/4');
    });

    it('toRational() on integer', () => {
      const d = Decimal15.fromInt(42);
      const r = d.toRational();
      assert.equal(r.toString(), '42');
    });
  });

  describe('8. Formatting & toFixed', () => {
    it('toFixed(2) on 3.14159 is "3.14"', () => {
      assert.equal(Decimal15.fromString('3.14159').toFixed(2), '3.14');
    });

    it('toFixed(2) on 3.146 is "3.15"', () => {
      assert.equal(Decimal15.fromString('3.146').toFixed(2), '3.15');
    });

    it('toFixed(0) on 4.6 is "5"', () => {
      assert.equal(Decimal15.fromString('4.6').toFixed(0), '5');
    });

    it('toFixed(4) pads trailing zeros', () => {
      assert.equal(Decimal15.fromString('1.5').toFixed(4), '1.5000');
    });

    it('toDisplayString() in Norm 1 formats small values', () => {
      assert.equal(Decimal15.fromString('0.001').toDisplayString({ type: 'NORM1' }), '1×10^-3');
    });

    it('toDisplayString() in Norm 2 formats 0.001 as decimal', () => {
      assert.equal(Decimal15.fromString('0.001').toDisplayString({ type: 'NORM2' }), '0.001');
    });
  });

  describe('9. Digit Access and Sign Utilities', () => {
    it('getDigit returns correct digits 0 through 14', () => {
      const d = Decimal15.fromString('123456789012345');
      assert.equal(d.getDigit(0), 1);
      assert.equal(d.getDigit(1), 2);
      assert.equal(d.getDigit(8), 9);
      assert.equal(d.getDigit(14), 5);
    });

    it('neg() flips sign and preserves zero', () => {
      const a = Decimal15.fromInt(10);
      assert.equal(a.neg().toString(), '-10');
      assert.equal(a.neg().neg().toString(), '10');
      assert.equal(Decimal15.ZERO.neg().isZero(), true);
    });

    it('abs() returns non-negative value', () => {
      assert.equal(Decimal15.fromInt(-50).abs().toString(), '50');
      assert.equal(Decimal15.fromInt(50).abs().toString(), '50');
      assert.equal(Decimal15.ZERO.abs().isZero(), true);
    });
  });

  describe('10. Edge Cases & 15-Digit Boundary Operations', () => {
    it('exact 15-digit addition', () => {
      const a = Decimal15.fromString('111111111111111');
      const b = Decimal15.fromString('222222222222222');
      assert.equal(a.add(b).toString(), '333333333333333');
    });

    it('exact 15-digit subtraction to zero', () => {
      const a = Decimal15.fromString('987654321098765');
      const b = Decimal15.fromString('987654321098765');
      assert.equal(a.sub(b).isZero(), true);
      assert.equal(a.sub(b).mantissa, 0n);
    });

    it('15-digit multiplication by 1 preserves all 15 digits', () => {
      const a = Decimal15.fromString('123456789012345');
      assert.equal(a.mul(Decimal15.ONE).mantissa, 123456789012345n);
    });

    it('15-digit division by 2 exact half', () => {
      const a = Decimal15.fromString('100000000000001');
      const res = a.div(Decimal15.fromInt(2));
      // 100000000000001 / 2 = 50000000000000.5 -> mantissa has exactly 15 digits
      assert.equal(res.mantissa, 500000000000005n);
      assert.equal(res.toString(), '50000000000000.5');
    });

    it('zero multiplication yields zero', () => {
      const a = Decimal15.fromString('123456789012345e50');
      assert.equal(a.mul(Decimal15.ZERO).isZero(), true);
    });

    it('zero addition preserves operand', () => {
      const a = Decimal15.fromString('987654321012345');
      assert.equal(a.add(Decimal15.ZERO).eq(a), true);
    });

    it('chained operations (a + b) * c / d', () => {
      const a = Decimal15.fromInt(2);
      const b = Decimal15.fromInt(4);
      const c = Decimal15.fromInt(7);
      const d = Decimal15.fromInt(3);
      // (2 + 4) * 7 / 3 = 42 / 3 = 14
      const res = a.add(b).mul(c).div(d);
      assert.equal(res.toString(), '14');
    });

    it('Decimal15.from universal factory handles all supported types', () => {
      assert.equal(Decimal15.from(42).toString(), '42');
      assert.equal(Decimal15.from('42').toString(), '42');
      assert.equal(Decimal15.from(42n).toString(), '42');
      assert.equal(Decimal15.from(new Rational(42n, 1n)).toString(), '42');
      assert.equal(Decimal15.from(Decimal15.fromInt(42)).toString(), '42');
    });

    it('boundary exponent: 1e99 multiplication by 0.1 is 1e98', () => {
      const a = Decimal15.fromString('1e99');
      const b = Decimal15.fromString('0.1');
      assert.equal(a.mul(b).sciExp, 98);
      assert.equal(a.mul(b).toString(), '1e+98');
    });

    it('boundary exponent: 1e-99 divided by 0.1 is 1e-98', () => {
      const a = Decimal15.fromString('1e-99');
      const b = Decimal15.fromString('0.1');
      assert.equal(a.div(b).sciExp, -98);
      assert.equal(a.div(b).toString(), '1e-98');
    });

    it('boundary underflow: 1e-99 multiplied by 0.09 underflows to 0', () => {
      const a = Decimal15.fromString('1e-99');
      const b = Decimal15.fromString('0.09');
      assert.equal(a.mul(b).isZero(), true);
    });

    it('rounding 15 nines: 9.999999999999995e99 overflows to Math ERROR', () => {
      assert.throws(() => {
        Decimal15.fromString('9.999999999999995e99');
      }, (err) => err instanceof CalcError && err.message === 'Math ERROR');
    });

    it('negation preserves magnitude and flips sign', () => {
      const a = Decimal15.fromString('-123.456');
      assert.equal(a.neg().toString(), '123.456');
      assert.equal(a.neg().sign, 1);
    });

    it('subtraction with negative numbers', () => {
      const a = Decimal15.fromInt(10);
      const b = Decimal15.fromInt(-5);
      assert.equal(a.sub(b).toString(), '15');
    });

    it('comparison of very close numbers at 15th digit', () => {
      const a = Decimal15.fromString('1.00000000000001');
      const b = Decimal15.fromString('1.00000000000002');
      assert.equal(a.lt(b), true);
      assert.equal(b.gt(a), true);
    });
  });
});
