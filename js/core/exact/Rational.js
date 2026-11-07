/**
 * Casio fx-991EX ClassWiz Rational Number Type
 * Exact fractional representation (numerator / denominator) with BigInt arithmetic,
 * reduction via Euclidean GCD, mixed fraction formatting, and display limit checks.
 */

import { Decimal15 } from '../number/Decimal15.js';

export class Rational {
  constructor(n, d = 1n) {
    if (typeof n === 'number') {
      if (!Number.isFinite(n)) throw new Error('Math ERROR');
      n = BigInt(Math.round(n));
    }
    if (typeof d === 'number') {
      if (!Number.isFinite(d)) throw new Error('Math ERROR');
      d = BigInt(Math.round(d));
    }
    if (typeof n === 'string') n = BigInt(n);
    if (typeof d === 'string') d = BigInt(d);

    if (d === 0n) throw new Error('Math ERROR');
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = Rational.gcd(n < 0n ? -n : n, d);
    this.n = n / g;
    this.d = d / g;
  }

  static gcd(a, b) {
    while (b !== 0n) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a;
  }

  static lcm(a, b) {
    if (a === 0n || b === 0n) return 0n;
    const g = Rational.gcd(a < 0n ? -a : a, b < 0n ? -b : b);
    return ((a < 0n ? -a : a) / g) * (b < 0n ? -b : b);
  }

  isZero() {
    return this.n === 0n;
  }

  isOne() {
    return this.n === 1n && this.d === 1n;
  }

  isInteger() {
    return this.d === 1n;
  }

  add(other) {
    const o = Rational.from(other);
    return new Rational(this.n * o.d + o.n * this.d, this.d * o.d);
  }

  sub(other) {
    const o = Rational.from(other);
    return new Rational(this.n * o.d - o.n * this.d, this.d * o.d);
  }

  mul(other) {
    const o = Rational.from(other);
    return new Rational(this.n * o.n, this.d * o.d);
  }

  div(other) {
    const o = Rational.from(other);
    if (o.n === 0n) throw new Error('Math ERROR');
    return new Rational(this.n * o.d, this.d * o.n);
  }

  neg() {
    return new Rational(-this.n, this.d);
  }

  abs() {
    return new Rational(this.n < 0n ? -this.n : this.n, this.d);
  }

  inv() {
    if (this.n === 0n) throw new Error('Math ERROR');
    return new Rational(this.d, this.n);
  }

  pow(exponent) {
    let exp = typeof exponent === 'bigint' ? Number(exponent) : Number(exponent);
    if (!Number.isInteger(exp)) throw new Error('Math ERROR');
    if (exp === 0) return new Rational(1n, 1n);
    if (exp < 0) {
      return this.inv().pow(-exp);
    }
    const bigExp = BigInt(exp);
    return new Rational(this.n ** bigExp, this.d ** bigExp);
  }

  cmp(other) {
    const o = Rational.from(other);
    const diff = this.n * o.d - o.n * this.d;
    if (diff > 0n) return 1;
    if (diff < 0n) return -1;
    return 0;
  }

  equals(other) {
    const o = Rational.from(other);
    return this.n === o.n && this.d === o.d;
  }

  toNumber() {
    return Number(this.n) / Number(this.d);
  }

  toDecimal15() {
    return Decimal15.fromRational(this);
  }

  /**
   * Return mixed fraction components: { sign, whole, num, den }
   */
  toMixed() {
    const sign = this.n < 0n ? -1 : 1;
    const absN = this.n < 0n ? -this.n : this.n;
    const whole = absN / this.d;
    const rem = absN % this.d;
    return {
      sign,
      whole,
      num: rem,
      den: this.d,
      isImproper: absN >= this.d && this.d !== 1n
    };
  }

  /**
   * Check Casio display limit:
   * Total digits of integer + numerator + denominator must be <= 10 digits.
   */
  digitCount(isMixed = false) {
    if (this.d === 1n) {
      const absN = this.n < 0n ? -this.n : this.n;
      return absN.toString().length;
    }
    if (isMixed) {
      const m = this.toMixed();
      const wholeLen = m.whole === 0n ? 0 : m.whole.toString().length;
      return wholeLen + m.num.toString().length + m.den.toString().length;
    }
    const absN = this.n < 0n ? -this.n : this.n;
    return absN.toString().length + this.d.toString().length;
  }

  canDisplayExact(isMixed = false) {
    if (this.d === 1n && (this.n >= 10000000000n || this.n <= -10000000000n)) {
      return false;
    }
    return this.digitCount(isMixed) <= 10;
  }

  toString() {
    if (this.d === 1n) return this.n.toString();
    return `${this.n}/${this.d}`;
  }

  toMixedString() {
    if (this.d === 1n) return this.n.toString();
    const m = this.toMixed();
    const signStr = m.sign < 0 ? '-' : '';
    if (m.whole === 0n) {
      return `${signStr}${m.num}/${m.den}`;
    }
    return `${signStr}${m.whole}⌟${m.num}/${m.den}`;
  }

  static from(val) {
    if (val instanceof Rational) return val;
    if (typeof val === 'bigint') return new Rational(val, 1n);
    if (val instanceof Decimal15) {
      return val.toRational();
    }
    if (typeof val === 'number') {
      if (Number.isInteger(val)) return new Rational(BigInt(val), 1n);
      if (!Number.isFinite(val)) throw new Error('Math ERROR');

      // Detect finite decimal representation exactly first:
      const s = val.toString();
      if (!s.includes('e') && !s.includes('E') && s.includes('.')) {
        const [intPart, fracPart] = s.split('.');
        if (fracPart.length <= 10) {
          const sign = intPart.startsWith('-') ? -1n : 1n;
          const cleanInt = intPart.replace('-', '');
          const den = 10n ** BigInt(fracPart.length);
          const num = BigInt(cleanInt) * den + BigInt(fracPart);
          return new Rational(sign * num, den);
        }
      }

      // Continued fraction approximation (convergents)
      let isNeg = val < 0;
      let x = Math.abs(val);
      let h1 = 1, h2 = 0, k1 = 0, k2 = 1;
      let b = x;
      for (let iter = 0; iter < 15; iter++) {
        let a = Math.floor(b);
        let h = a * h1 + h2;
        let k = a * k1 + k2;
        if (k > 100000) break;
        h2 = h1; h1 = h;
        k2 = k1; k1 = k;
        if (Math.abs(x - h / k) < 1e-12) break;
        if (Math.abs(b - a) < 1e-12) break;
        b = 1 / (b - a);
      }
      if (k1 > 0 && Math.abs(x - h1 / k1) < 1e-9) {
        return new Rational(BigInt(isNeg ? -h1 : h1), BigInt(k1));
      }
      return new Rational(BigInt(Math.round(val)), 1n);
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.includes('⌟')) {
        // Mixed fraction e.g. "1⌟2/3" or "-1⌟2/3"
        const parts = trimmed.split('⌟');
        const whole = BigInt(parts[0]);
        const frac = parts[1].split('/');
        const num = BigInt(frac[0]);
        const den = BigInt(frac[1]);
        const sign = whole < 0n || parts[0].startsWith('-') ? -1n : 1n;
        const absWhole = whole < 0n ? -whole : whole;
        return new Rational(sign * (absWhole * den + num), den);
      }
      if (trimmed.includes('/')) {
        const [nStr, dStr] = trimmed.split('/');
        return new Rational(BigInt(nStr), BigInt(dStr));
      }
      if (trimmed.includes('.')) {
        return Rational.from(parseFloat(trimmed));
      }
      return new Rational(BigInt(trimmed), 1n);
    }
    return new Rational(0n, 1n);
  }
}
