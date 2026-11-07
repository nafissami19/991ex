/**
 * Casio fx-991EX ClassWiz 15-Digit Decimal Floating-Point Type
 *
 * Implements authentic BCD-style decimal arithmetic using BigInt.
 * - Always maintains 15 significant decimal digits.
 * - Round-half-up on the 16th digit.
 * - Range: 1e-99 to 9.99999999999999e99 or 0.
 * - Overflow (>= 1e100) -> throws CalcError('Math ERROR').
 * - Underflow (< 1e-99) -> returns Decimal15.ZERO.
 * - Zero JS binary floating-point Number operations.
 */

import { CalcError } from '../errors.js';
import { Rational } from './Rational.js';

export class Decimal15 {
  /**
   * Internal constructor
   * @param {number} sign 1, -1, or 0
   * @param {bigint} mantissa 15-digit BigInt (10^14 <= mantissa < 10^15), or 0n
   * @param {number} exp integer exponent (value = sign * mantissa * 10^exp)
   */
  constructor(sign, mantissa, exp) {
    this.sign = sign === 0 ? 0 : sign > 0 ? 1 : -1;
    this.mantissa = BigInt(mantissa);
    this.exp = Number(exp);

    if (this.sign === 0 || this.mantissa === 0n) {
      this.sign = 0;
      this.mantissa = 0n;
      this.exp = 0;
    }
  }

  static get ZERO() {
    return new Decimal15(0, 0n, 0);
  }

  static get ONE() {
    return new Decimal15(1, 100000000000000n, -14);
  }

  static get TWO() {
    return new Decimal15(1, 200000000000000n, -14);
  }

  static get TEN() {
    return new Decimal15(1, 100000000000000n, -13);
  }

  /**
   * Scientific exponent of the leading digit: value = m * 10^sciExp (1 <= m < 10)
   */
  get sciExp() {
    if (this.sign === 0) return 0;
    return this.exp + 14;
  }

  /**
   * Normalize an unnormalized positive BigInt M and exponent E to 15 digits
   */
  static _normalize(sign, M, E) {
    if (sign === 0 || M === 0n) {
      return Decimal15.ZERO;
    }

    const s = M.toString();
    const len = s.length;

    if (len > 15) {
      const k = len - 15;
      const divisor = 10n ** BigInt(k);
      const rem = M % divisor;
      let truncated = M / divisor;

      // 16th digit for round-half-up
      const guardDivisor = 10n ** BigInt(k - 1);
      const guardDigit = rem / guardDivisor;

      if (guardDigit >= 5n) {
        truncated += 1n;
      }

      E += k;

      // Check if rounding caused ripple overflow (e.g. 999..99 + 1 = 1000..00)
      if (truncated >= 10n ** 15n) {
        truncated /= 10n;
        E += 1;
      }
      M = truncated;
    } else if (len < 15) {
      const k = 15 - len;
      M *= 10n ** BigInt(k);
      E -= k;
    }

    // Check exponent limits: range is 10^-99 to 9.99999999999999 * 10^99
    const sciExp = E + 14;
    if (sciExp >= 100) {
      throw new CalcError('Math ERROR');
    }
    if (sciExp < -99) {
      return Decimal15.ZERO;
    }

    return new Decimal15(sign, M, E);
  }

  /**
   * Parse from integer or BigInt
   */
  static fromInt(val) {
    const b = BigInt(val);
    if (b === 0n) return Decimal15.ZERO;
    const sign = b > 0n ? 1 : -1;
    const M = b > 0n ? b : -b;
    return Decimal15._normalize(sign, M, 0);
  }

  static fromBigInt(val) {
    return Decimal15.fromInt(val);
  }

  /**
   * Parse from string e.g. "0.3", "-12.345", "1.23e10", "1e-99", "0"
   */
  static fromString(rawStr) {
    if (!rawStr || typeof rawStr !== 'string') return Decimal15.ZERO;

    let s = rawStr.trim();
    if (s === '' || s === '0' || s === '+0' || s === '-0' || s === '0.0') {
      return Decimal15.ZERO;
    }

    // Replace unicode minus
    s = s.replace(/−/g, '-');

    let sign = 1;
    if (s.startsWith('-')) {
      sign = -1;
      s = s.slice(1).trim();
    } else if (s.startsWith('+')) {
      s = s.slice(1).trim();
    }

    // Check exponential notation
    let expPart = 0;
    const eIdx = s.search(/[eE]/);
    if (eIdx !== -1) {
      const eStr = s.slice(eIdx + 1);
      expPart = parseInt(eStr, 10);
      if (isNaN(expPart)) throw new CalcError('Syntax ERROR');
      s = s.slice(0, eIdx);
    }

    // Split integer and fraction parts
    const dotIdx = s.indexOf('.');
    let intStr = s;
    let fracStr = '';

    if (dotIdx !== -1) {
      intStr = s.slice(0, dotIdx);
      fracStr = s.slice(dotIdx + 1);
    }

    // Strip leading zeros
    const combined = (intStr + fracStr).replace(/^0+/, '');
    if (combined === '') {
      return Decimal15.ZERO;
    }

    const M = BigInt(combined);
    const decimalPlaces = fracStr.length;
    const E = expPart - decimalPlaces;

    return Decimal15._normalize(sign, M, E);
  }

  /**
   * Universal factory
   */
  static from(val) {
    if (val instanceof Decimal15) return val;
    if (typeof val === 'bigint') return Decimal15.fromInt(val);
    if (typeof val === 'number') {
      if (!Number.isFinite(val)) throw new CalcError('Math ERROR');
      return Decimal15.fromString(val.toString());
    }
    if (typeof val === 'string') return Decimal15.fromString(val);
    if (val instanceof Rational) return Decimal15.fromRational(val);
    return Decimal15.ZERO;
  }

  /**
   * Conversion from Rational
   */
  static fromRational(r) {
    if (!r || r.n === 0n) return Decimal15.ZERO;
    const dNum = Decimal15.fromInt(r.n);
    const dDen = Decimal15.fromInt(r.d);
    return dNum.div(dDen);
  }

  /**
   * Conversion to Rational
   */
  toRational() {
    if (this.sign === 0) return new Rational(0n, 1n);

    let n = BigInt(this.sign) * this.mantissa;
    let d = 1n;

    if (this.exp >= 0) {
      n *= 10n ** BigInt(this.exp);
    } else {
      d = 10n ** BigInt(-this.exp);
    }

    return new Rational(n, d);
  }

  isZero() {
    return this.sign === 0;
  }

  neg() {
    if (this.sign === 0) return Decimal15.ZERO;
    return new Decimal15(-this.sign, this.mantissa, this.exp);
  }

  abs() {
    if (this.sign === 0) return Decimal15.ZERO;
    return new Decimal15(1, this.mantissa, this.exp);
  }

  /**
   * Comparison
   * Returns -1 if this < other, 0 if this === other, 1 if this > other
   */
  cmp(other) {
    const o = Decimal15.from(other);

    if (this.sign !== o.sign) {
      return this.sign > o.sign ? 1 : -1;
    }
    if (this.sign === 0) {
      return 0;
    }

    const sciA = this.sciExp;
    const sciB = o.sciExp;

    if (sciA !== sciB) {
      return this.sign > 0 ? (sciA > sciB ? 1 : -1) : (sciA > sciB ? -1 : 1);
    }

    if (this.mantissa === o.mantissa) {
      return 0;
    }

    if (this.sign > 0) {
      return this.mantissa > o.mantissa ? 1 : -1;
    } else {
      return this.mantissa > o.mantissa ? -1 : 1;
    }
  }

  eq(other) { return this.cmp(other) === 0; }
  equals(other) { return this.eq(other); }
  lt(other) { return this.cmp(other) < 0; }
  lte(other) { return this.cmp(other) <= 0; }
  gt(other) { return this.cmp(other) > 0; }
  gte(other) { return this.cmp(other) >= 0; }

  /**
   * Addition
   */
  add(other) {
    const o = Decimal15.from(other);
    if (this.isZero()) return o;
    if (o.isZero()) return this;

    const diff = this.exp - o.exp;

    // If one is > 35 orders of magnitude smaller, it cannot affect 15 digits + guard
    if (diff > 35) return this;
    if (diff < -35) return o;

    let mA = this.mantissa;
    let mB = o.mantissa;
    let baseExp = 0;

    if (diff >= 0) {
      mA *= 10n ** BigInt(diff);
      baseExp = o.exp;
    } else {
      mB *= 10n ** BigInt(-diff);
      baseExp = this.exp;
    }

    const signedSum = BigInt(this.sign) * mA + BigInt(o.sign) * mB;
    if (signedSum === 0n) return Decimal15.ZERO;

    const resSign = signedSum > 0n ? 1 : -1;
    const resM = signedSum > 0n ? signedSum : -signedSum;

    return Decimal15._normalize(resSign, resM, baseExp);
  }

  /**
   * Subtraction
   */
  sub(other) {
    const o = Decimal15.from(other);
    return this.add(o.neg());
  }

  /**
   * Multiplication
   */
  mul(other) {
    const o = Decimal15.from(other);
    if (this.isZero() || o.isZero()) return Decimal15.ZERO;

    const resSign = this.sign * o.sign;
    const resM = this.mantissa * o.mantissa;
    const resExp = this.exp + o.exp;

    return Decimal15._normalize(resSign, resM, resExp);
  }

  /**
   * Division
   */
  div(other) {
    const o = Decimal15.from(other);
    if (o.isZero()) {
      throw new CalcError('Math ERROR');
    }
    if (this.isZero()) {
      return Decimal15.ZERO;
    }

    const resSign = this.sign * o.sign;

    // Scale dividend by 10^20 to provide guard digits for accurate round-half-up
    const GUARD_SHIFT = 20n;
    const scaledDividend = this.mantissa * (10n ** GUARD_SHIFT);
    const quotient = scaledDividend / o.mantissa;
    const resExp = this.exp - o.exp - Number(GUARD_SHIFT);

    return Decimal15._normalize(resSign, quotient, resExp);
  }

  /**
   * Check if integer
   */
  isInteger() {
    if (this.isZero()) return true;
    if (this.exp >= 0) return true;
    if (-this.exp >= 15) return false;

    const fracMod = 10n ** BigInt(-this.exp);
    return this.mantissa % fracMod === 0n;
  }

  toBigInt() {
    if (!this.isInteger()) throw new CalcError('Math ERROR');
    if (this.isZero()) return 0n;
    const rat = this.toRational();
    return rat.n / rat.d;
  }

  toNumber() {
    if (this.isZero()) return 0;
    return Number(this.toString());
  }

  /**
   * Truncate towards zero
   */
  trunc() {
    if (this.isZero() || this.isInteger()) return this;
    if (this.sciExp < 0) return Decimal15.ZERO;

    const k = BigInt(-this.exp);
    const divisor = 10n ** k;
    const intPart = (this.mantissa / divisor) * divisor;

    return Decimal15._normalize(this.sign, intPart, this.exp);
  }

  /**
   * Floor (largest integer <= this)
   */
  floor() {
    if (this.isZero() || this.isInteger()) return this;
    const tr = this.trunc();
    if (this.sign < 0) {
      return tr.sub(Decimal15.ONE);
    }
    return tr;
  }

  /**
   * Fractional part (this - trunc(this))
   */
  frac() {
    return this.sub(this.trunc());
  }

  /**
   * Digit access: get digit 0..14 (0 = most significant digit)
   */
  getDigit(idx) {
    if (this.isZero() || idx < 0 || idx > 14) return 0;
    const s = this.mantissa.toString();
    return parseInt(s[idx], 10);
  }

  /**
   * Format with fixed decimal places
   */
  toFixed(digits = 0) {
    if (this.isZero()) {
      return digits > 0 ? '0.' + '0'.repeat(digits) : '0';
    }

    // Align to specified decimal places
    const targetExp = -digits;
    const currentExp = this.exp;
    const diff = currentExp - targetExp;

    let scaledM = this.mantissa;
    if (diff >= 0) {
      scaledM *= 10n ** BigInt(diff);
    } else {
      // Need rounding
      const dropCount = -diff;
      const divisor = 10n ** BigInt(dropCount);
      const rem = scaledM % divisor;
      scaledM = scaledM / divisor;

      const guardDivisor = 10n ** BigInt(dropCount - 1);
      const guard = rem / guardDivisor;
      if (guard >= 5n) {
        scaledM += 1n;
      }
    }

    let signStr = this.sign < 0 ? '-' : '';
    let str = scaledM.toString();

    if (digits === 0) {
      return signStr + (str || '0');
    }

    if (str.length <= digits) {
      str = '0'.repeat(digits - str.length + 1) + str;
    }

    const intPart = str.slice(0, str.length - digits);
    const fracPart = str.slice(str.length - digits);
    return signStr + intPart + '.' + fracPart;
  }

  /**
   * Full 15-digit representation
   */
  toString() {
    if (this.isZero()) return '0';

    const s = this.mantissa.toString(); // 15 digits
    const sci = this.sciExp;

    // Use standard decimal format for reasonable exponents (-9 to 14)
    if (sci >= -9 && sci < 15) {
      const signStr = this.sign < 0 ? '-' : '';
      if (sci < 0) {
        const leadingZeros = -sci - 1;
        let frac = '0'.repeat(leadingZeros) + s;
        // Strip trailing zeros
        frac = frac.replace(/0+$/, '');
        return signStr + '0.' + frac;
      } else {
        const intLen = sci + 1;
        const intPart = s.slice(0, intLen);
        let fracPart = s.slice(intLen).replace(/0+$/, '');
        return signStr + intPart + (fracPart.length > 0 ? '.' + fracPart : '');
      }
    }

    // Scientific notation
    const signStr = this.sign < 0 ? '-' : '';
    const lead = s[0];
    let rest = s.slice(1).replace(/0+$/, '');
    const expStr = (sci >= 0 ? '+' : '') + sci;
    return signStr + lead + (rest.length > 0 ? '.' + rest : '') + 'e' + expStr;
  }

  /**
   * Display rounding: round 15-digit mantissa to 10 display digits
   */
  toDisplayString(format = { type: 'NORM1' }) {
    if (this.isZero()) return '0';

    // Round 15 digits to 10 digits
    // 10th digit with round-half-up on 11th digit
    const s = this.mantissa.toString();
    const lead10 = BigInt(s.slice(0, 10));
    const rem5 = BigInt(s.slice(10));

    let rounded10 = lead10;
    if (rem5 >= 50000n) {
      rounded10 += 1n;
    }

    let sci = this.sciExp;
    if (rounded10 >= 10000000000n) { // 10^10
      rounded10 /= 10n;
      sci += 1;
    }

    let signStr = this.sign < 0 ? '-' : '';
    let tenStr = rounded10.toString(); // 10 digits

    // Format Norm 1 vs Norm 2
    const normMode = format.type === 'NORM2' ? 2 : 1;
    const expThresholdMin = normMode === 2 ? -9 : -2;

    if (sci >= expThresholdMin && sci < 10) {
      if (sci < 0) {
        const leadingZeros = -sci - 1;
        let frac = '0'.repeat(leadingZeros) + tenStr;
        frac = frac.replace(/0+$/, '');
        return signStr + '0.' + (frac || '0');
      } else {
        const intLen = sci + 1;
        const intPart = tenStr.slice(0, intLen);
        let fracPart = tenStr.slice(intLen).replace(/0+$/, '');
        return signStr + intPart + (fracPart.length > 0 ? '.' + fracPart : '');
      }
    }

    // Exponential display: mantissa * 10^sci
    const lead = tenStr[0];
    let rest = tenStr.slice(1).replace(/0+$/, '');
    return signStr + lead + (rest.length > 0 ? '.' + rest : '') + '×10^' + sci;
  }
}
