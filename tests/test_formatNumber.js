/**
 * Unit Tests for Casio fx-991EX Number Display Formatting (formatNumber.js)
 *
 * Verifies:
 * - 10-digit display rounding (internal 15-digit maintained, display rounded)
 * - Norm 1 and Norm 2 transition thresholds
 * - Fix 0-9 precision and trailing zeros
 * - Sci 0-9 scientific format (Sci 0 = 10 digits)
 * - ENG and SHIFT ENG exponent shifts
 * - Engineering Symbols (k, M, G, T, m, µ, n, p, f)
 * - Decimal mark (Dot / Comma) and Digit Separator (thousand grouping)
 * - Structured LCD output fields
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Decimal15 } from '../js/core/number/Decimal15.js';
import { formatNumber, toSuperscript } from '../js/core/format/formatNumber.js';

describe('Display Formatting (formatNumber.js)', () => {

  describe('1. Zero and Negative Zero Handling', () => {
    it('0 in Norm 1 is "0"', () => {
      const res = formatNumber(0);
      assert.strictEqual(res.fullString, '0');
      assert.strictEqual(res.sign, 0);
    });

    it('0 in Fix 3 is "0.000"', () => {
      const res = formatNumber(0, { format: { type: 'FIX', value: 3 } });
      assert.strictEqual(res.fullString, '0.000');
    });

    it('0 in Fix 0 is "0"', () => {
      const res = formatNumber(0, { format: { type: 'FIX', value: 0 } });
      assert.strictEqual(res.fullString, '0');
    });

    it('0 in Sci 4 is "0.000×10⁰"', () => {
      const res = formatNumber(0, { format: { type: 'SCI', value: 4 } });
      assert.strictEqual(res.fullString, '0.000×10⁰');
    });

    it('-0 rounds to "0" without negative sign', () => {
      const res = formatNumber(Decimal15.fromString('-1e-15'), { format: { type: 'FIX', value: 2 } });
      assert.strictEqual(res.fullString, '0.00');
      assert.strictEqual(res.sign, 0);
    });
  });

  describe('2. 10-Digit Display Rounding', () => {
    it('rounds 15-digit internal value to 10 display digits', () => {
      const res = formatNumber('1.23456789049999');
      assert.strictEqual(res.fullString, '1.23456789');
    });

    it('rounds half-up on the 11th digit when 5', () => {
      const res = formatNumber('1.23456789050000');
      assert.strictEqual(res.fullString, '1.234567891');
    });

    it('handles ripple carry: 0.99999999999 rounds to 1', () => {
      const res = formatNumber('0.999999999999999');
      assert.strictEqual(res.fullString, '1');
    });

    it('1 ÷ 3 is rounded to 10 digits "0.3333333333"', () => {
      const oneThird = Decimal15.ONE.div(Decimal15.fromString('3'));
      const res = formatNumber(oneThird);
      assert.strictEqual(res.fullString, '0.3333333333');
    });
  });

  describe('3. Norm 1 Mode (Default)', () => {
    it('standard decimal within range 0.01 <= x < 1e10', () => {
      assert.strictEqual(formatNumber('0.01').fullString, '0.01');
      assert.strictEqual(formatNumber('123.45').fullString, '123.45');
      assert.strictEqual(formatNumber('9999999999').fullString, '9999999999');
    });

    it('drops trailing zeros in Norm mode', () => {
      assert.strictEqual(formatNumber('1.5000').fullString, '1.5');
      assert.strictEqual(formatNumber('2.0000').fullString, '2');
    });

    it('switches to exponential when x < 0.01 (e.g. 0.001 -> 1×10⁻³)', () => {
      const res = formatNumber('0.001');
      assert.strictEqual(res.fullString, '1×10⁻³');
      assert.strictEqual(res.isExponential, true);
      assert.strictEqual(res.exponent, -3);
    });

    it('switches to exponential when x >= 1e10 (e.g. 12345678901 -> 1.23456789×10¹⁰)', () => {
      const res = formatNumber('12345678901');
      assert.strictEqual(res.fullString, '1.23456789×10¹⁰');
      assert.strictEqual(res.isExponential, true);
      assert.strictEqual(res.exponent, 10);
    });

    it('formats negative small number: -0.005 -> -5×10⁻³', () => {
      const res = formatNumber('-0.005');
      assert.strictEqual(res.fullString, '-5×10⁻³');
    });
  });

  describe('4. Norm 2 Mode', () => {
    const opts = { format: { type: 'NORM', value: 2 } };

    it('0.001 stays decimal in Norm 2', () => {
      assert.strictEqual(formatNumber('0.001', opts).fullString, '0.001');
    });

    it('0.000000001 stays decimal in Norm 2 (1e-9)', () => {
      assert.strictEqual(formatNumber('0.000000001', opts).fullString, '0.000000001');
    });

    it('switches to exponential when x < 1e-9 (e.g. 1e-10 -> 1×10⁻¹⁰)', () => {
      assert.strictEqual(formatNumber('1e-10', opts).fullString, '1×10⁻¹⁰');
    });

    it('switches to exponential when x >= 1e10', () => {
      assert.strictEqual(formatNumber('1e10', opts).fullString, '1×10¹⁰');
    });
  });

  describe('5. Fix 0–9 Mode', () => {
    it('Fix 3 on 1/3 displays "0.333"', () => {
      const oneThird = Decimal15.ONE.div(Decimal15.fromString('3'));
      const res = formatNumber(oneThird, { format: { type: 'FIX', value: 3 } });
      assert.strictEqual(res.fullString, '0.333');
    });

    it('Fix 3 preserves trailing zeros: 1 -> "1.000"', () => {
      const res = formatNumber(1, { format: { type: 'FIX', value: 3 } });
      assert.strictEqual(res.fullString, '1.000');
    });

    it('Fix 0 on 12.5 rounds half-up to "13"', () => {
      const res = formatNumber('12.5', { format: { type: 'FIX', value: 0 } });
      assert.strictEqual(res.fullString, '13');
    });

    it('Fix 5 on 0.1234567 rounds to "0.12346"', () => {
      const res = formatNumber('0.1234567', { format: { type: 'FIX', value: 5 } });
      assert.strictEqual(res.fullString, '0.12346');
    });

    it('switches to exponential when value exceeds 10 digits', () => {
      const res = formatNumber('12345678901', { format: { type: 'FIX', value: 2 } });
      assert.ok(res.isExponential);
      assert.ok(res.fullString.includes('×10¹⁰'));
    });
  });

  describe('6. Sci 0–9 Mode', () => {
    it('Sci 4 on 12345 displays "1.235×10⁴"', () => {
      const res = formatNumber(12345, { format: { type: 'SCI', value: 4 } });
      assert.strictEqual(res.fullString, '1.235×10⁴');
    });

    it('Sci 1 on 9.8 displays "1×10¹"', () => {
      const res = formatNumber('9.8', { format: { type: 'SCI', value: 1 } });
      assert.strictEqual(res.fullString, '1×10¹');
    });

    it('Sci 3 on 0.005 displays "5.00×10⁻³"', () => {
      const res = formatNumber('0.005', { format: { type: 'SCI', value: 3 } });
      assert.strictEqual(res.fullString, '5.00×10⁻³');
    });

    it('Sci 0 selects 10 significant digits', () => {
      const res = formatNumber('1.234567890123', { format: { type: 'SCI', value: 0 } });
      assert.strictEqual(res.fullString, '1.234567890×10⁰');
    });

    it('Sci preserves trailing zeros on integer: 1 in Sci 3 -> "1.00×10⁰"', () => {
      const res = formatNumber(1, { format: { type: 'SCI', value: 3 } });
      assert.strictEqual(res.fullString, '1.00×10⁰');
    });
  });

  describe('7. ENG and SHIFT ENG Exponent Shifts', () => {
    it('Initial ENG on 123456 displays "123.456×10³"', () => {
      const res = formatNumber(123456, { engOffset: 0 });
      assert.strictEqual(res.fullString, '123.456×10³');
      assert.strictEqual(res.exponent, 3);
    });

    it('Second ENG press (engOffset -3) displays "123456"', () => {
      const res = formatNumber(123456, { engOffset: -3 });
      assert.strictEqual(res.fullString, '123456');
      assert.strictEqual(res.exponent, 0);
    });

    it('Third ENG press (engOffset -6) displays "123456000×10⁻³"', () => {
      const res = formatNumber(123456, { engOffset: -6 });
      assert.strictEqual(res.fullString, '123456000×10⁻³');
      assert.strictEqual(res.exponent, -3);
    });

    it('SHIFT ENG (+3) moves exponent up: "0.123456×10⁶"', () => {
      const res = formatNumber(123456, { engOffset: 3 });
      assert.strictEqual(res.fullString, '0.123456×10⁶');
      assert.strictEqual(res.exponent, 6);
    });

    it('ENG handles negative numbers: -123456 -> "-123.456×10³"', () => {
      const res = formatNumber(-123456, { engOffset: 0 });
      assert.strictEqual(res.fullString, '-123.456×10³');
    });
  });

  describe('8. Engineering Symbols (Engineer Symbol: On)', () => {
    it('1024000 with symbols displays "1.024M"', () => {
      const res = formatNumber(1024000, { engOffset: 0, engSymbols: true });
      assert.strictEqual(res.fullString, '1.024M');
      assert.strictEqual(res.engSymbol, 'M');
    });

    it('500000 with symbols displays "500k"', () => {
      const res = formatNumber(500000, { engOffset: 0, engSymbols: true });
      assert.strictEqual(res.fullString, '500k');
      assert.strictEqual(res.engSymbol, 'k');
    });

    it('0.005 with symbols displays "5m"', () => {
      const res = formatNumber('0.005', { engOffset: 0, engSymbols: true });
      assert.strictEqual(res.fullString, '5m');
      assert.strictEqual(res.engSymbol, 'm');
    });

    it('0.000002 with symbols displays "2µ"', () => {
      const res = formatNumber('0.000002', { engOffset: 0, engSymbols: true });
      assert.strictEqual(res.fullString, '2µ');
      assert.strictEqual(res.engSymbol, 'µ');
    });

    it('0.000000001 with symbols displays "1n"', () => {
      const res = formatNumber('0.000000001', { engOffset: 0, engSymbols: true });
      assert.strictEqual(res.fullString, '1n');
      assert.strictEqual(res.engSymbol, 'n');
    });
  });

  describe('9. Decimal Mark and Digit Separator', () => {
    it('Decimal mark COMMA replaces dot with comma: "123,45"', () => {
      const res = formatNumber('123.45', { decimalMark: 'COMMA' });
      assert.strictEqual(res.fullString, '123,45');
    });

    it('Digit Separator on 1234567.89 formats with space separator: "1 234 567.89"', () => {
      const res = formatNumber('1234567.89', { digitSeparator: true });
      assert.strictEqual(res.fullString, '1 234 567.89');
    });

    it('Digit Separator with COMMA decimal mark: "1 234 567,89"', () => {
      const res = formatNumber('1234567.89', { digitSeparator: true, decimalMark: 'COMMA' });
      assert.strictEqual(res.fullString, '1 234 567,89');
    });

    it('Digit Separator with negative number: "-1 234 567.89"', () => {
      const res = formatNumber('-1234567.89', { digitSeparator: true });
      assert.strictEqual(res.fullString, '-1 234 567.89');
    });
  });

  describe('10. Structured Output Properties', () => {
    it('returns complete structured result for LCD rendering', () => {
      const res = formatNumber('12345678901');
      assert.strictEqual(res.mantissa, '1.23456789');
      assert.strictEqual(res.exponent, 10);
      assert.strictEqual(res.expString, '¹⁰');
      assert.strictEqual(res.engSymbol, null);
      assert.strictEqual(res.fullString, '1.23456789×10¹⁰');
      assert.strictEqual(res.isExponential, true);
      assert.strictEqual(res.sign, 1);
    });

    it('superscript mapping converts arbitrary integers', () => {
      assert.strictEqual(toSuperscript(10), '¹⁰');
      assert.strictEqual(toSuperscript(-3), '⁻³');
      assert.strictEqual(toSuperscript(98), '⁹⁸');
    });
  });

});
