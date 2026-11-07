/**
 * Casio fx-991EX ClassWiz Surd / Radical Form
 *
 * Represents exact expressions in the radical vector space over Q:
 *   S = c0 + sum_i (ci * sqrt(si))
 * where c0, ci are Rational, and si are distinct square-free integers > 1.
 *
 * Automatically handles:
 * - Square factor extraction: sqrt(8) -> 2*sqrt(2), sqrt(12) -> 2*sqrt(3)
 * - Denominator rationalization: 1/sqrt(2) -> sqrt(2)/2, 6/sqrt(3) -> 2*sqrt(3)
 * - Conjugate division: 1/(1+sqrt(2)) -> -1+sqrt(2)
 * - Casio display limit checks (<= 2 terms, si < 1000, display digit limits)
 */

import { Rational } from './Rational.js';
import { Decimal15 } from '../number/Decimal15.js';
import * as ScientificFunctions from '../number/functions.js';

/**
 * Extract largest square factor from an integer N:
 * returns [k, m] such that N = k^2 * m and m is square-free.
 */
export function extractSquare(n) {
  let N = typeof n === 'bigint' ? n : BigInt(n);
  if (N <= 0n) throw new Error('Math ERROR');
  if (N === 1n) return [1n, 1n];

  let k = 1n;
  let m = N;

  // Factor out squares of 2
  while (m % 4n === 0n) {
    k *= 2n;
    m /= 4n;
  }
  // Factor out squares of odd integers
  let d = 3n;
  while (d * d <= m) {
    const d2 = d * d;
    while (m % d2 === 0n) {
      k *= d;
      m /= d2;
    }
    d += 2n;
  }

  return [k, m];
}

export class SurdForm {
  /**
   * @param {Rational|number|bigint} constant - rational constant term
   * @param {Map<bigint, Rational>|Array<{coeff: Rational, radicand: bigint}>} terms - radical terms
   */
  constructor(constant = 0n, terms = []) {
    this.constant = constant instanceof Rational ? constant : Rational.from(constant);
    this.terms = new Map(); // Map<bigint, Rational> (square-free radicand -> rational coeff)

    if (terms instanceof Map) {
      for (const [s, c] of terms.entries()) {
        this._addTerm(s, c);
      }
    } else if (Array.isArray(terms)) {
      for (const t of terms) {
        this._addTerm(t.radicand, t.coeff);
      }
    }
  }

  _addTerm(radicand, coeff) {
    const c = coeff instanceof Rational ? coeff : Rational.from(coeff);
    if (c.isZero()) return;

    let s = typeof radicand === 'bigint' ? radicand : BigInt(radicand);
    if (s <= 0n) throw new Error('Math ERROR');
    if (s === 1n) {
      this.constant = this.constant.add(c);
      return;
    }

    const [k, m] = extractSquare(s);
    const effectiveCoeff = c.mul(new Rational(k, 1n));
    if (m === 1n) {
      this.constant = this.constant.add(effectiveCoeff);
      return;
    }

    const existing = this.terms.get(m);
    if (existing) {
      const updated = existing.add(effectiveCoeff);
      if (updated.isZero()) {
        this.terms.delete(m);
      } else {
        this.terms.set(m, updated);
      }
    } else {
      this.terms.set(m, effectiveCoeff);
    }
  }

  /**
   * Factory: create square root of a rational value n/d:
   * sqrt(n/d) = sqrt(n*d) / d
   */
  static sqrt(val) {
    const r = Rational.from(val);
    if (r.n < 0n) throw new Error('Math ERROR');
    if (r.n === 0n) return new SurdForm(0n);

    // sqrt(n/d) = sqrt(n*d) / d
    const prod = r.n * r.d;
    const [k, m] = extractSquare(prod);
    const coeff = new Rational(k, r.d);

    if (m === 1n) {
      return new SurdForm(coeff);
    }
    return new SurdForm(0n, [{ coeff, radicand: m }]);
  }

  isRational() {
    return this.terms.size === 0;
  }

  toRational() {
    if (!this.isRational()) return null;
    return this.constant;
  }

  isZero() {
    return this.constant.isZero() && this.terms.size === 0;
  }

  add(other) {
    const o = SurdForm.from(other);
    const res = new SurdForm(this.constant.add(o.constant), this.terms);
    for (const [s, c] of o.terms.entries()) {
      res._addTerm(s, c);
    }
    return res;
  }

  sub(other) {
    const o = SurdForm.from(other);
    const res = new SurdForm(this.constant.sub(o.constant), this.terms);
    for (const [s, c] of o.terms.entries()) {
      res._addTerm(s, c.neg());
    }
    return res;
  }

  neg() {
    const res = new SurdForm(this.constant.neg());
    for (const [s, c] of this.terms.entries()) {
      res.terms.set(s, c.neg());
    }
    return res;
  }

  mul(other) {
    const o = SurdForm.from(other);
    let res = new SurdForm(0n);

    // Convert this to terms list including constant
    const thisTerms = [];
    if (!this.constant.isZero()) thisTerms.push({ coeff: this.constant, radicand: 1n });
    for (const [s, c] of this.terms.entries()) thisTerms.push({ coeff: c, radicand: s });

    const oTerms = [];
    if (!o.constant.isZero()) oTerms.push({ coeff: o.constant, radicand: 1n });
    for (const [s, c] of o.terms.entries()) oTerms.push({ coeff: c, radicand: s });

    for (const t1 of thisTerms) {
      for (const t2 of oTerms) {
        const prodCoeff = t1.coeff.mul(t2.coeff);
        const prodRad = t1.radicand * t2.radicand;
        const [k, m] = extractSquare(prodRad);
        const finalCoeff = prodCoeff.mul(new Rational(k, 1n));
        if (m === 1n) {
          res.constant = res.constant.add(finalCoeff);
        } else {
          res._addTerm(m, finalCoeff);
        }
      }
    }
    return res;
  }

  inv() {
    if (this.isZero()) throw new Error('Math ERROR');

    // Case 1: Pure rational c0
    if (this.isRational()) {
      return new SurdForm(this.constant.inv());
    }

    // Case 2: Single radical term c1 * sqrt(s1)
    if (this.constant.isZero() && this.terms.size === 1) {
      const [s1, c1] = this.terms.entries().next().value;
      // 1 / (c1 * sqrt(s1)) = sqrt(s1) / (c1 * s1)
      const denom = c1.mul(new Rational(s1, 1n));
      const newCoeff = denom.inv();
      return new SurdForm(0n, [{ coeff: newCoeff, radicand: s1 }]);
    }

    // Case 3: Two terms: either c0 + c1*sqrt(s1) or c1*sqrt(s1) + c2*sqrt(s2)
    if (!this.constant.isZero() && this.terms.size === 1) {
      // 1 / (a + b*sqrt(c)) = (a - b*sqrt(c)) / (a^2 - b^2*c)
      const a = this.constant;
      const [c, b] = this.terms.entries().next().value;
      const norm = a.mul(a).sub(b.mul(b).mul(new Rational(c, 1n)));
      if (norm.isZero()) throw new Error('Math ERROR');
      const conjugate = new SurdForm(a, [{ coeff: b.neg(), radicand: c }]);
      return conjugate.div(new SurdForm(norm));
    }

    if (this.constant.isZero() && this.terms.size === 2) {
      // 1 / (a*sqrt(b) + c*sqrt(d)) = (a*sqrt(b) - c*sqrt(d)) / (a^2*b - c^2*d)
      const entries = Array.from(this.terms.entries());
      const [b, a] = entries[0];
      const [d, c] = entries[1];
      const norm = a.mul(a).mul(new Rational(b, 1n)).sub(c.mul(c).mul(new Rational(d, 1n)));
      if (norm.isZero()) throw new Error('Math ERROR');
      const conjugate = new SurdForm(0n, [
        { coeff: a, radicand: b },
        { coeff: c.neg(), radicand: d }
      ]);
      return conjugate.div(new SurdForm(norm));
    }

    // More than 2 terms: rationalization beyond Casio display capacity
    throw new Error('Radical too complex for exact rationalization');
  }

  div(other) {
    const o = SurdForm.from(other);
    if (o.isRational()) {
      const invConst = o.constant.inv();
      return this.mul(new SurdForm(invConst));
    }
    return this.mul(o.inv());
  }

  pow(exponent) {
    let exp = typeof exponent === 'bigint' ? Number(exponent) : Number(exponent);
    if (!Number.isInteger(exp)) throw new Error('Math ERROR');
    if (exp === 0) return new SurdForm(1n);
    if (exp < 0) return this.inv().pow(-exp);

    let res = new SurdForm(1n);
    let base = this;
    while (exp > 0) {
      if (exp % 2 === 1) res = res.mul(base);
      if (exp > 1) base = base.mul(base);
      exp = Math.floor(exp / 2);
    }
    return res;
  }

  /**
   * Verify whether the surd conforms to Casio fx-991EX display limits:
   * 1. Total terms <= 2
   * 2. Square-free radicand si < 1000
   * 3. Display width / digit count <= 10 digits
   */
  canDisplayExact() {
    const totalTerms = (this.constant.isZero() ? 0 : 1) + this.terms.size;
    if (totalTerms > 2) return false;

    for (const [s, c] of this.terms.entries()) {
      if (s >= 1000n) return false;
      if (!c.canDisplayExact()) return false;
    }
    if (!this.constant.isZero() && !this.constant.canDisplayExact()) {
      return false;
    }

    const str = this.formatExact();
    return str.length <= 14;
  }

  formatExact() {
    if (this.isRational()) {
      return this.constant.toString();
    }

    // Case 1: Single radical term: a*sqrt(b)/c
    if (this.constant.isZero() && this.terms.size === 1) {
      const [s, c] = this.terms.entries().next().value;
      const num = c.n;
      const den = c.d;
      const absN = num < 0n ? -num : num;
      const signStr = num < 0n ? '-' : '';

      let coeffStr = '';
      if (absN === 1n) {
        coeffStr = '';
      } else {
        coeffStr = absN.toString();
      }

      if (den === 1n) {
        return `${signStr}${coeffStr}√${s}`;
      } else {
        return `${signStr}${coeffStr}√${s}/${den}`;
      }
    }

    // Case 2: Rational constant + 1 radical term: c0 + c1*sqrt(s1)
    if (!this.constant.isZero() && this.terms.size === 1) {
      const a = this.constant;
      const [s, b] = this.terms.entries().next().value;

      const lcmDen = Rational.lcm(a.d, b.d);
      const scaledA = a.n * (lcmDen / a.d);
      const scaledB = b.n * (lcmDen / b.d);

      const aStr = scaledA.toString();
      const bSign = scaledB < 0n ? '-' : '+';
      const absB = scaledB < 0n ? -scaledB : scaledB;
      const bCoeffStr = absB === 1n ? '' : absB.toString();
      const surdPart = `${bSign}${bCoeffStr}√${s}`;

      if (lcmDen === 1n) {
        return `${aStr}${surdPart}`;
      } else {
        return `(${aStr}${surdPart})/${lcmDen}`;
      }
    }

    // Case 3: Two radical terms: a*sqrt(b) + c*sqrt(d)
    if (this.constant.isZero() && this.terms.size === 2) {
      const entries = Array.from(this.terms.entries());
      const [s1, c1] = entries[0];
      const [s2, c2] = entries[1];

      const lcmDen = Rational.lcm(c1.d, c2.d);
      const scaled1 = c1.n * (lcmDen / c1.d);
      const scaled2 = c2.n * (lcmDen / c2.d);

      // Order by larger radicand first if positive
      const term1Sign = scaled1 < 0n ? '-' : '';
      const abs1 = scaled1 < 0n ? -scaled1 : scaled1;
      const coeff1Str = abs1 === 1n ? '' : abs1.toString();

      const term2Sign = scaled2 < 0n ? '-' : '+';
      const abs2 = scaled2 < 0n ? -scaled2 : scaled2;
      const coeff2Str = abs2 === 1n ? '' : abs2.toString();

      const numStr = `${term1Sign}${coeff1Str}√${s1}${term2Sign}${coeff2Str}√${s2}`;
      if (lcmDen === 1n) {
        return numStr;
      } else {
        return `(${numStr})/${lcmDen}`;
      }
    }

    return this.toDecimal15().toString();
  }

  toDecimal15() {
    let sum = this.constant.toDecimal15();
    for (const [s, c] of this.terms.entries()) {
      const decC = c.toDecimal15();
      const decSqrt = ScientificFunctions.sqrt(Decimal15.fromInt(s));
      sum = sum.add(decC.mul(decSqrt));
    }
    return sum;
  }

  static from(val) {
    if (val instanceof SurdForm) return val;
    if (val instanceof Rational) return new SurdForm(val);
    if (typeof val === 'bigint' || typeof val === 'number') {
      return new SurdForm(Rational.from(val));
    }
    return new SurdForm(0n);
  }
}
