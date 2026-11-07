/**
 * Complex numbers for Complex mode: real and imaginary parts are ExactValue, so exact
 * forms (fractions, surds, π) survive where the arithmetic allows; anything else falls
 * back to 15-digit decimals inside ExactValue.
 *
 * A value with a zero imaginary part is always returned as a plain ExactValue
 * (see `makeComplex`), so real results keep working everywhere else.
 */

import { ExactValue } from '../../exact/ExactValue.js';
import { Rational } from '../../exact/Rational.js';
import { SurdForm } from '../../exact/SurdForm.js';
import { PiForm } from '../../exact/PiForm.js';
import { Decimal15 } from '../../number/Decimal15.js';
import * as F from '../../number/functions.js';
import { CalcError, ERRORS } from '../../errors.js';

const ZERO = () => ExactValue.fromInt(0n);
const ONE = () => ExactValue.fromInt(1n);
const D = (s) => Decimal15.fromString(String(s));

/** Decimal parts smaller than this fraction of the other part are rounding noise. */
const NOISE = D('1e-13');

export class ComplexValue {
  constructor(re, im, formatOverride = null) {
    this.kind = 'complex';
    this.re = re;
    this.im = im;
    this.formatOverride = formatOverride; // 'rect' | 'polar' | null
  }

  /** Code outside Complex mode that expects a real number sees the real part. */
  toDecimal15() {
    return this.re.toDecimal15();
  }

  toString() {
    const p = (v) => v.toDecimal15().toString();
    const im = this.im.toDecimal15();
    return `${p(this.re)}${im.sign < 0 ? '-' : '+'}${im.abs().toString()}i`;
  }

  toJSON() {
    return {
      complex: true,
      re: this.re.toDecimal15().toString(),
      im: this.im.toDecimal15().toString(),
      formatOverride: this.formatOverride
    };
  }
}

export const isComplex = (v) => v instanceof ComplexValue;

export function isZeroEV(v) {
  if (!v) return true;
  if (v.type === 'rational') return v.value.isZero();
  return v.toDecimal15().isZero();
}

export function isOneEV(v) {
  if (!v) return false;
  if (v.type === 'rational') return v.value.n === 1n && v.value.d === 1n;
  return v.toDecimal15().eq(Decimal15.ONE);
}

export const signEV = (v) => v.toDecimal15().sign;

/** [re, im] of a real or complex value. */
export function parts(v) {
  if (v instanceof ComplexValue) return [v.re, v.im];
  if (v instanceof ExactValue) return [v, ZERO()];
  throw new CalcError(ERRORS.MATH);
}

/** Build a value from parts: drop decimal noise, real when the imaginary part is 0 (unless formatOverride). */
export function makeComplex(re, im, formatOverride = null) {
  re = denoise(re, im);
  im = denoise(im, re);
  if (isZeroEV(im) && !formatOverride) return re;
  return new ComplexValue(re, im, formatOverride);
}

function denoise(v, other) {
  if (v.type !== 'decimal' || isZeroEV(v) || isZeroEV(other)) return v;
  const a = v.toDecimal15().abs();
  const b = other.toDecimal15().abs();
  return a.lt(b.mul(NOISE)) ? ZERO() : v;
}

export const I = () => new ComplexValue(ZERO(), ONE());

// ---------------------------------------------------------------- arithmetic

export function cadd(x, y) {
  const [a, b] = parts(x);
  const [c, d] = parts(y);
  return makeComplex(a.add(c), b.add(d));
}

export function csub(x, y) {
  const [a, b] = parts(x);
  const [c, d] = parts(y);
  return makeComplex(a.sub(c), b.sub(d));
}

export function cneg(x) {
  const [a, b] = parts(x);
  return makeComplex(a.neg(), b.neg());
}

export function cmul(x, y) {
  const [a, b] = parts(x);
  const [c, d] = parts(y);
  if (isZeroEV(b)) return makeComplex(a.mul(c), a.mul(d));
  if (isZeroEV(d)) return makeComplex(a.mul(c), b.mul(c));
  return makeComplex(a.mul(c).sub(b.mul(d)), a.mul(d).add(b.mul(c)));
}

export function cdiv(x, y) {
  const [a, b] = parts(x);
  const [c, d] = parts(y);
  const cz = isZeroEV(c);
  const dz = isZeroEV(d);
  if (cz && dz) throw new CalcError(ERRORS.MATH);
  if (dz) return makeComplex(a.div(c), b.div(c));
  if (cz) return makeComplex(b.div(d), a.neg().div(d));
  const den = c.mul(c).add(d.mul(d));
  if (isZeroEV(den)) throw new CalcError(ERRORS.MATH);
  return makeComplex(a.mul(c).add(b.mul(d)).div(den), b.mul(c).sub(a.mul(d)).div(den));
}

export function conj(x) {
  const [a, b] = parts(x);
  return makeComplex(a, b.neg());
}

/** |z| — exact √ when a²+b² is rational. */
export function cabs(x) {
  const [a, b] = parts(x);
  if (isZeroEV(b)) return signEV(a) < 0 ? a.neg() : a;
  if (isZeroEV(a)) return signEV(b) < 0 ? b.neg() : b;
  const s = a.mul(a).add(b.mul(b));
  if (s.type === 'rational') return ExactValue.fromSurd(SurdForm.sqrt(s.value));
  return ExactValue.fromDecimal(F.sqrt(s.toDecimal15()));
}

const HALF_TURN = { DEG: () => ExactValue.fromInt(180n), GRA: () => ExactValue.fromInt(200n), RAD: () => ExactValue.pi() };

/** arg z in the angle unit, −half turn < θ ≤ half turn. Exact for multiples of 15°. */
export function carg(x, unit) {
  const [a, b] = parts(x);
  const half = HALF_TURN[unit] || HALF_TURN.DEG;
  if (isZeroEV(b)) return signEV(a) < 0 ? half() : ZERO();
  if (isZeroEV(a)) {
    const q = half().div(ExactValue.fromInt(2n));
    return signEV(b) < 0 ? q.neg() : q;
  }
  const t = F.pol(a.toDecimal15(), b.toDecimal15(), unit).theta;
  return snapAngle(t, unit);
}

/** A decimal angle that is a multiple of 15° (π/12, 50/3 grad) to 12 digits becomes exact. */
export function snapAngle(t, unit) {
  const step = unit === 'RAD' ? F.CASIO_PI.div(Decimal15.fromInt(12)) : unit === 'GRA' ? D(50).div(D(3)) : D(15);
  const q = t.div(step);
  const k = q.abs().add(D('0.5')).trunc();
  const diff = q.abs().sub(k).abs();
  if (diff.lt(D('1e-11'))) {
    const n = k.toBigInt() * (q.sign < 0 ? -1n : 1n);
    if (n === 0n) return ZERO();
    if (unit === 'RAD') return ExactValue.fromPi(new PiForm(new Rational(n, 12n)));
    if (unit === 'GRA') return ExactValue.fromRational(n * 50n, 3n);
    return ExactValue.fromInt(n * 15n);
  }
  return ExactValue.fromDecimal(t);
}

/**
 * z^n for an integer n (|n| < 1e10, User's Guide). Exact by repeated squaring for small n,
 * through polar form for large n.
 */
export function cpowInt(x, n, check = (v) => v) {
  if (n <= -10000000000n || n >= 10000000000n) throw new CalcError(ERRORS.MATH);
  const [a, b] = parts(x);
  if (isZeroEV(a) && isZeroEV(b)) {
    if (n <= 0n) throw new CalcError(ERRORS.MATH);
    return ZERO();
  }
  if (n === 0n) return ONE();
  const absN = n < 0n ? -n : n;
  let r;
  if (absN <= 1024n) {
    r = ONE();
    let base = x;
    let e = absN;
    while (e > 0n) {
      if (e & 1n) r = check(cmul(r, base));
      e >>= 1n;
      if (e > 0n) base = check(cmul(base, base));
    }
  } else {
    // r^n ∠ nθ, angle reduced in degrees
    const mod = cabs(x).toDecimal15();
    const theta = F.pol(a.toDecimal15(), b.toDecimal15(), 'DEG').theta;
    const R = F.pow(mod, Decimal15.fromBigInt(absN));
    let t = theta.mul(Decimal15.fromBigInt(absN));
    const turns = t.div(D(360)).trunc();
    t = t.sub(turns.mul(D(360)));
    r = check(makeComplex(
      ExactValue.fromDecimal(R.mul(F.cos(t, 'DEG'))),
      ExactValue.fromDecimal(R.mul(F.sin(t, 'DEG')))
    ));
  }
  return n < 0n ? cdiv(ONE(), r) : r;
}
