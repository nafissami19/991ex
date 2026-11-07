/**
 * 2D or 3D mathematical vector with exact element arithmetic.
 */
import { ExactValue } from '../../exact/ExactValue.js';
import { Rational } from '../../exact/Rational.js';
import { Decimal15 } from '../../number/Decimal15.js';
import { acos } from '../../number/functions.js';
import { CalcError, ERRORS } from '../../errors.js';
import { serialize, deserialize } from '../../memory.js';

export class VectorValue {
  /**
   * @param {Array<ExactValue|number|string|Decimal15>} elements - 2 or 3 elements
   */
  constructor(elements) {
    if (!Array.isArray(elements) || (elements.length !== 2 && elements.length !== 3)) {
      throw new CalcError(ERRORS.DIMENSION);
    }
    this.elements = elements.map((e) => {
      if (e instanceof ExactValue) return e;
      if (typeof e === 'number' || typeof e === 'bigint') return ExactValue.fromInt(BigInt(e));
      if (typeof e === 'string') {
        const trimmed = e.trim();
        const frac = trimmed.match(/^(-?\d+)\s*\/\s*(\d+)$/);
        if (frac) return ExactValue.fromRational(BigInt(frac[1]), BigInt(frac[2]));
        return ExactValue.fromDecimal(Decimal15.fromString(trimmed));
      }
      if (e instanceof Decimal15) return ExactValue.fromDecimal(e);
      return ExactValue.from(e);
    });
    this.dim = this.elements.length;
  }

  get(i) {
    return this.elements[i];
  }

  set(i, val) {
    this.elements[i] = val instanceof ExactValue ? val : ExactValue.from(val);
  }

  clone() {
    return new VectorValue(this.elements.map((e) => (e.clone ? e.clone() : e)));
  }

  add(other) {
    if (!(other instanceof VectorValue) || this.dim !== other.dim) {
      throw new CalcError(ERRORS.DIMENSION);
    }
    return new VectorValue(this.elements.map((e, i) => e.add(other.elements[i])));
  }

  sub(other) {
    if (!(other instanceof VectorValue) || this.dim !== other.dim) {
      throw new CalcError(ERRORS.DIMENSION);
    }
    return new VectorValue(this.elements.map((e, i) => e.sub(other.elements[i])));
  }

  neg() {
    return new VectorValue(this.elements.map((e) => e.neg()));
  }

  mulScalar(s) {
    const ev = s instanceof ExactValue ? s : ExactValue.from(s);
    return new VectorValue(this.elements.map((e) => e.mul(ev)));
  }

  divScalar(s) {
    const ev = s instanceof ExactValue ? s : ExactValue.from(s);
    if (ev.toDecimal15().isZero()) {
      throw new CalcError(ERRORS.MATH);
    }
    return new VectorValue(this.elements.map((e) => e.div(ev)));
  }

  dot(other) {
    if (!(other instanceof VectorValue) || this.dim !== other.dim) {
      throw new CalcError(ERRORS.DIMENSION);
    }
    let sum = this.elements[0].mul(other.elements[0]);
    for (let i = 1; i < this.dim; i++) {
      sum = sum.add(this.elements[i].mul(other.elements[i]));
    }
    return sum;
  }

  cross(other) {
    if (!(other instanceof VectorValue) || this.dim !== 3 || other.dim !== 3) {
      throw new CalcError(ERRORS.DIMENSION);
    }
    const u = this.elements;
    const v = other.elements;
    const w0 = u[1].mul(v[2]).sub(u[2].mul(v[1]));
    const w1 = u[2].mul(v[0]).sub(u[0].mul(v[2]));
    const w2 = u[0].mul(v[1]).sub(u[1].mul(v[0]));
    return new VectorValue([w0, w1, w2]);
  }

  normSq() {
    let sum = this.elements[0].mul(this.elements[0]);
    for (let i = 1; i < this.dim; i++) {
      sum = sum.add(this.elements[i].mul(this.elements[i]));
    }
    return sum;
  }

  abs() {
    const sq = this.normSq();
    return ExactValue.sqrt(sq);
  }

  unitVector() {
    const mag = this.abs();
    if (mag.toDecimal15().isZero()) {
      throw new CalcError(ERRORS.MATH);
    }
    return this.divScalar(mag);
  }

  angle(other, angleUnit = 'DEG') {
    if (!(other instanceof VectorValue) || this.dim !== other.dim) {
      throw new CalcError(ERRORS.DIMENSION);
    }
    const dot = this.dot(other);
    const m1 = this.abs();
    const m2 = other.abs();
    if (m1.toDecimal15().isZero() || m2.toDecimal15().isZero()) {
      throw new CalcError(ERRORS.MATH);
    }
    const denom = m1.mul(m2);
    let cosDec = dot.toDecimal15().div(denom.toDecimal15());
    if (cosDec.gt(Decimal15.ONE)) cosDec = Decimal15.ONE;
    if (cosDec.lt(Decimal15.fromString('-1'))) cosDec = Decimal15.fromString('-1');
    const angleDec = acos(cosDec, angleUnit);
    return ExactValue.fromDecimal(angleDec);
  }

  formatElement(e, opts = {}) {
    if (e instanceof ExactValue) {
      if (opts.decimal) return e.toDecimal15().toString();
      if (e.type === 'rational') {
        const r = e.value;
        if (r.d === 1n) return r.n.toString();
        return `${r.n}┘${r.d}`;
      }
      if (e.type === 'surd') {
        return e.value.format ? e.value.format() : e.toDecimal15().toString();
      }
      return e.toDecimal15().toString();
    }
    return String(e);
  }

  format(opts = {}) {
    const els = this.elements.map((e) => this.formatElement(e, opts));
    return `[ ${els.join('  ')} ]`;
  }

  toJSON() {
    return {
      dim: this.dim,
      elements: this.elements.map((e) => serialize(e))
    };
  }

  static fromJSON(o) {
    if (!o || !o.dim || !Array.isArray(o.elements)) return null;
    const elements = o.elements.map((e) => deserialize(e) || ExactValue.fromInt(0n));
    return new VectorValue(elements);
  }
}
