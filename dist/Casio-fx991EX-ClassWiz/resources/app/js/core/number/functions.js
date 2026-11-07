/**
 * Casio fx-991EX ClassWiz Scientific Functions
 *
 * Implements all real functions to 15-digit accuracy using Decimal15 and
 * 40-digit BigInt internal guard arithmetic.
 * Conforms strictly to input ranges, domain limits, and exact values per docs/spec/ranges.md.
 */

import { Decimal15 } from './Decimal15.js';
import { CalcError } from '../errors.js';
import { Rational } from './Rational.js';

// Guard scale: 40 decimal digits
const GUARD_PREC = 40n;
const SCALE = 10n ** GUARD_PREC;

// Universal constants to 50 digits
const PI_STR = '3.1415926535897932384626433832795028841971693993751';
const E_STR = '2.7182818284590452353602874713526624977572470936999';
const LN10_STR = '2.3025850929940456840179914546843642076011014886287';
const LN2_STR = '0.6931471805599453094172321214581765680755001343602';

// Casio internal constants (page 15 of fx-570/991EX User's Guide)
export const CASIO_PI = new Decimal15(1, 314159265358980n, -14);
export const CASIO_E = new Decimal15(1, 271828182845904n, -14);

// Scaled constants
const PI_SCALED = BigInt(PI_STR.replace('.', '').slice(0, Number(GUARD_PREC) + 1));
const LN10_SCALED = BigInt(LN10_STR.replace('.', '').slice(0, Number(GUARD_PREC) + 1));
const LN2_SCALED = BigInt(LN2_STR.replace('.', '').slice(0, Number(GUARD_PREC) + 1));

// Angle conversion constants (DEG, RAD, GRA)
const DEG_LIMIT = Decimal15.fromString('9e9');
const RAD_LIMIT = Decimal15.fromString('157079632.7');
const GRA_LIMIT = Decimal15.fromString('1e10');
const EXP_LIMIT = Decimal15.fromString('230.2585092');

/* -------------------------------------------------------------------------- */
/* BigInt Helper Routines (40 Guard Digits)                                   */
/* -------------------------------------------------------------------------- */

/**
 * BigInt integer square root
 */
function isqrt(n) {
  if (n < 0n) throw new CalcError('Math ERROR');
  if (n === 0n) return 0n;
  const s = n.toString().length;
  let x0 = 10n ** BigInt(Math.floor((s + 1) / 2));
  let x1 = (x0 + n / x0) >> 1n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + n / x0) >> 1n;
  }
  return x0;
}

/**
 * BigInt integer cube root
 */
function icbrt(n) {
  if (n === 0n) return 0n;
  const s = n.toString().length;
  let x0 = 10n ** BigInt(Math.floor((s + 2) / 3));
  let x1 = (2n * x0 + n / (x0 * x0)) / 3n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (2n * x0 + n / (x0 * x0)) / 3n;
  }
  return x0;
}

/**
 * Convert Decimal15 to scaled BigInt (scaled by 10^40)
 */
function toScaled(dec) {
  if (dec.isZero()) return 0n;
  const power = dec.exp + Number(GUARD_PREC);
  const s = BigInt(dec.sign);
  const m = dec.mantissa;
  if (power >= 0) {
    return s * m * (10n ** BigInt(power));
  } else {
    const div = 10n ** BigInt(-power);
    return (s * m + (div / 2n)) / div;
  }
}

/**
 * Convert scaled BigInt (scaled by 10^40) back to Decimal15
 */
function fromScaled(X) {
  if (X === 0n) return Decimal15.ZERO;
  const s = X < 0n ? -1 : 1;
  const A = X < 0n ? -X : X;
  const str = A.toString();
  const L = str.length;
  let exp = L - Number(GUARD_PREC) - 15;
  let m15;
  if (L >= 16) {
    const m16 = BigInt(str.slice(0, 16));
    m15 = (m16 + 5n) / 10n;
    if (m15 >= 10n ** 15n) {
      m15 /= 10n;
      exp++;
    }
  } else {
    m15 = A * (10n ** BigInt(15 - L));
  }
  return new Decimal15(s, m15, exp);
}

/**
 * High-precision Taylor series for sin and cos
 * @param {bigint} t_scaled angle in radians scaled by SCALE, in [0, pi/2]
 */
function sinCosSeries(t_scaled) {
  const t2 = (t_scaled * t_scaled) / SCALE;

  // sin series
  let sinTerm = t_scaled;
  let sinSum = sinTerm;
  let n = 2n;
  while (sinTerm > 0n) {
    sinTerm = (sinTerm * t2) / (n * (n + 1n) * SCALE);
    if (sinTerm === 0n) break;
    if ((n / 2n) % 2n === 1n) sinSum -= sinTerm;
    else sinSum += sinTerm;
    n += 2n;
  }

  // cos series
  let cosTerm = SCALE;
  let cosSum = cosTerm;
  n = 1n;
  while (cosTerm > 0n) {
    cosTerm = (cosTerm * t2) / (n * (n + 1n) * SCALE);
    if (cosTerm === 0n) break;
    if (((n + 1n) / 2n) % 2n === 1n) cosSum -= cosTerm;
    else cosSum += cosTerm;
    n += 2n;
  }

  return { sin: sinSum, cos: cosSum };
}

/**
 * High-precision atan via half-angle reduction and Taylor series
 * @param {bigint} x_scaled value scaled by SCALE
 */
function atanScaled(x_scaled) {
  if (x_scaled === 0n) return 0n;
  let neg = false;
  if (x_scaled < 0n) {
    neg = true;
    x_scaled = -x_scaled;
  }
  let inv = false;
  if (x_scaled > SCALE) {
    inv = true;
    x_scaled = (SCALE * SCALE) / x_scaled;
  }

  // Apply half-angle formula 3 times: x' = x / (1 + sqrt(1 + x^2))
  let cur = x_scaled;
  for (let i = 0; i < 3; i++) {
    const cur2 = (cur * cur) / SCALE;
    const hyp = isqrt((SCALE + cur2) * SCALE);
    cur = (cur * SCALE) / (SCALE + hyp);
  }

  // Taylor series for small cur
  const cur2 = (cur * cur) / SCALE;
  let term = cur;
  let sum = term;
  let n = 3n;
  let sign = -1n;
  while (term > 0n) {
    term = (term * cur2) / SCALE;
    const add = term / n;
    if (add === 0n) break;
    if (sign < 0n) sum -= add;
    else sum += add;
    sign = -sign;
    n += 2n;
  }

  let res = sum * 8n; // 2^3 = 8
  if (inv) res = (PI_SCALED / 2n) - res;
  if (neg) res = -res;
  return res;
}

/**
 * High-precision natural logarithm via repeated square root reduction
 * @param {bigint} M_scaled value scaled by SCALE, M_scaled > 0
 */
function lnScaled(M_scaled) {
  if (M_scaled <= 0n) throw new CalcError('Math ERROR');

  // Take 12 square roots to bring argument very close to 1
  let z = M_scaled;
  for (let i = 0; i < 12; i++) {
    z = isqrt(z * SCALE);
  }

  // Compute ln(z) using y = (z - 1)/(z + 1)
  const num = z - SCALE;
  const den = z + SCALE;
  const y = (num * SCALE) / den;
  const y2 = (y * y) / SCALE;

  let term = y;
  let sum = term;
  let n = 3n;
  while (term > 0n) {
    term = (term * y2) / SCALE;
    const add = term / n;
    if (add === 0n) break;
    sum += add;
    n += 2n;
  }

  return 2n * sum * 4096n; // 4096 = 2^12
}

/**
 * High-precision exponential e^x via repeated squaring
 * @param {bigint} x_scaled value scaled by SCALE
 */
function expScaled(x_scaled) {
  if (x_scaled === 0n) return SCALE;
  let neg = false;
  if (x_scaled < 0n) {
    neg = true;
    x_scaled = -x_scaled;
  }

  // Halve 12 times: r = x / 4096
  const r = x_scaled / 4096n;
  let term = r;
  let sum = SCALE + term;
  let n = 2n;
  while (term > 0n) {
    term = (term * r) / (n * SCALE);
    if (term === 0n) break;
    sum += term;
    n += 1n;
  }

  // Square 12 times
  let res = sum;
  for (let i = 0; i < 12; i++) {
    res = (res * res) / SCALE;
  }

  if (neg) {
    res = (SCALE * SCALE) / res;
  }
  return res;
}

/* -------------------------------------------------------------------------- */
/* Angle Unit Normalization Helpers                                           */
/* -------------------------------------------------------------------------- */

function checkAngleInput(dec, angleUnit) {
  const absVal = dec.abs();
  if (angleUnit === 'DEG' && absVal.gte(DEG_LIMIT)) throw new CalcError('Math ERROR');
  if (angleUnit === 'RAD' && absVal.gte(RAD_LIMIT)) throw new CalcError('Math ERROR');
  if (angleUnit === 'GRA' && absVal.gte(GRA_LIMIT)) throw new CalcError('Math ERROR');
}

/* -------------------------------------------------------------------------- */
/* Public Trigonometric Functions                                             */
/* -------------------------------------------------------------------------- */

/**
 * Sine
 * @param {Decimal15|number|string} val
 * @param {'DEG'|'RAD'|'GRA'} angleUnit
 */
export function sin(val, angleUnit = 'DEG') {
  const d = Decimal15.from(val);
  checkAngleInput(d, angleUnit);
  if (d.isZero()) return Decimal15.ZERO;

  if (angleUnit === 'DEG') {
    // Exact reduction modulo 360
    let deg = Number(d.toRational().n % (360n * d.toRational().d)) / Number(d.toRational().d);
    if (deg < 0) deg += 360;

    // Special exact values
    if (deg === 0 || deg === 180 || deg === 360) return Decimal15.ZERO;
    if (deg === 30 || deg === 150) return Decimal15.fromString('0.5');
    if (deg === 90) return Decimal15.ONE;
    if (deg === 210 || deg === 330) return Decimal15.fromString('-0.5');
    if (deg === 270) return Decimal15.fromString('-1');

    // Reduce to [0, 90]
    let sign = 1;
    let normDeg = deg;
    if (deg > 180) {
      sign = -1;
      normDeg = deg - 180;
    }
    if (normDeg > 90) {
      normDeg = 180 - normDeg;
    }

    const radScaled = (BigInt(Math.round(normDeg * 1e12)) * PI_SCALED) / 180000000000000n;
    const { sin: sVal } = sinCosSeries(radScaled);
    const res = fromScaled(sVal);
    return sign < 0 ? res.neg() : res;
  }

  if (angleUnit === 'GRA') {
    let gra = Number(d.toRational().n % (400n * d.toRational().d)) / Number(d.toRational().d);
    if (gra < 0) gra += 400;

    if (gra === 0 || gra === 200 || gra === 400) return Decimal15.ZERO;
    if (gra === 100) return Decimal15.ONE;
    if (gra === 300) return Decimal15.fromString('-1');
    return sin(Decimal15.from(gra * 0.9), 'DEG');
  }

  // RAD mode
  const tScaled = toScaled(d);
  const twoPi = 2n * PI_SCALED;
  let modT = tScaled % twoPi;
  if (modT < 0n) modT += twoPi;

  let sign = 1;
  if (modT > PI_SCALED) {
    sign = -1;
    modT -= PI_SCALED;
  }
  if (modT > PI_SCALED / 2n) {
    modT = PI_SCALED - modT;
  }

  const { sin: sVal } = sinCosSeries(modT);
  const res = fromScaled(sVal);
  return sign < 0 ? res.neg() : res;
}

/**
 * Cosine
 * @param {Decimal15|number|string} val
 * @param {'DEG'|'RAD'|'GRA'} angleUnit
 */
export function cos(val, angleUnit = 'DEG') {
  const d = Decimal15.from(val);
  checkAngleInput(d, angleUnit);
  if (d.isZero()) return Decimal15.ONE;

  if (angleUnit === 'DEG') {
    let deg = Number(d.toRational().n % (360n * d.toRational().d)) / Number(d.toRational().d);
    if (deg < 0) deg += 360;

    if (deg === 0 || deg === 360) return Decimal15.ONE;
    if (deg === 60 || deg === 300) return Decimal15.fromString('0.5');
    if (deg === 90 || deg === 270) return Decimal15.ZERO;
    if (deg === 120 || deg === 240) return Decimal15.fromString('-0.5');
    if (deg === 180) return Decimal15.fromString('-1');

    return sin(Decimal15.from(90 - deg), 'DEG');
  }

  if (angleUnit === 'GRA') {
    let gra = Number(d.toRational().n % (400n * d.toRational().d)) / Number(d.toRational().d);
    if (gra < 0) gra += 400;

    if (gra === 0 || gra === 400) return Decimal15.ONE;
    if (gra === 100 || gra === 300) return Decimal15.ZERO;
    if (gra === 200) return Decimal15.fromString('-1');
    return cos(Decimal15.from(gra * 0.9), 'DEG');
  }

  // RAD mode
  const tScaled = toScaled(d);
  const twoPi = 2n * PI_SCALED;
  let modT = tScaled % twoPi;
  if (modT < 0n) modT += twoPi;

  let sign = 1;
  if (modT > PI_SCALED) {
    modT = twoPi - modT;
  }
  if (modT > PI_SCALED / 2n) {
    sign = -1;
    modT = PI_SCALED - modT;
  }

  const { cos: cVal } = sinCosSeries(modT);
  const res = fromScaled(cVal);
  return sign < 0 ? res.neg() : res;
}

/**
 * Tangent
 * @param {Decimal15|number|string} val
 * @param {'DEG'|'RAD'|'GRA'} angleUnit
 */
export function tan(val, angleUnit = 'DEG') {
  const d = Decimal15.from(val);
  checkAngleInput(d, angleUnit);
  if (d.isZero()) return Decimal15.ZERO;

  if (angleUnit === 'DEG') {
    let deg = Number(d.toRational().n % (180n * d.toRational().d)) / Number(d.toRational().d);
    if (deg < 0) deg += 180;
    if (Math.abs(deg - 90) < 1e-12) throw new CalcError('Math ERROR');
    if (deg === 0 || deg === 180) return Decimal15.ZERO;
    if (deg === 45) return Decimal15.ONE;
    if (deg === 135) return Decimal15.fromString('-1');

    const s = sin(d, 'DEG');
    const c = cos(d, 'DEG');
    return s.div(c);
  }

  if (angleUnit === 'GRA') {
    let gra = Number(d.toRational().n % (200n * d.toRational().d)) / Number(d.toRational().d);
    if (gra < 0) gra += 200;
    if (Math.abs(gra - 100) < 1e-12) throw new CalcError('Math ERROR');
    if (gra === 0 || gra === 200) return Decimal15.ZERO;
    if (gra === 50) return Decimal15.ONE;
    if (gra === 150) return Decimal15.fromString('-1');
    return tan(Decimal15.from(gra * 0.9), 'DEG');
  }

  // RAD mode
  const tScaled = toScaled(d);
  const halfPi = PI_SCALED / 2n;
  const modT = tScaled % PI_SCALED;
  const diffHalfPi = modT < 0n ? -modT - halfPi : modT - halfPi;
  if (diffHalfPi === 0n || (diffHalfPi < 0n ? -diffHalfPi : diffHalfPi) < 1000n) {
    throw new CalcError('Math ERROR');
  }

  const s = sin(d, 'RAD');
  const c = cos(d, 'RAD');
  return s.div(c);
}

/**
 * Inverse Sine
 * @param {Decimal15|number|string} val
 * @param {'DEG'|'RAD'|'GRA'} angleUnit
 */
export function asin(val, angleUnit = 'DEG') {
  const d = Decimal15.from(val);
  if (d.abs().gt(Decimal15.ONE)) throw new CalcError('Math ERROR');
  if (d.isZero()) return Decimal15.ZERO;

  // Exact endpoints
  if (d.equals(Decimal15.ONE)) {
    if (angleUnit === 'DEG') return Decimal15.fromString('90');
    if (angleUnit === 'GRA') return Decimal15.fromString('100');
    return fromScaled(PI_SCALED / 2n);
  }
  if (d.equals(Decimal15.fromString('-1'))) {
    if (angleUnit === 'DEG') return Decimal15.fromString('-90');
    if (angleUnit === 'GRA') return Decimal15.fromString('-100');
    return fromScaled(-(PI_SCALED / 2n));
  }

  // Exact half angles
  if (d.equals(Decimal15.fromString('0.5'))) {
    if (angleUnit === 'DEG') return Decimal15.fromString('30');
    if (angleUnit === 'GRA') return Decimal15.fromString('33.3333333333333');
    return fromScaled(PI_SCALED / 6n);
  }
  if (d.equals(Decimal15.fromString('-0.5'))) {
    if (angleUnit === 'DEG') return Decimal15.fromString('-30');
    if (angleUnit === 'GRA') return Decimal15.fromString('-33.3333333333333');
    return fromScaled(-(PI_SCALED / 6n));
  }

  // asin(x) = atan(x / sqrt(1 - x^2))
  const oneMinusX2 = Decimal15.ONE.sub(d.mul(d));
  const denom = sqrt(oneMinusX2);
  const ratio = d.div(denom);
  return atan(ratio, angleUnit);
}

/**
 * Inverse Cosine
 * @param {Decimal15|number|string} val
 * @param {'DEG'|'RAD'|'GRA'} angleUnit
 */
export function acos(val, angleUnit = 'DEG') {
  const d = Decimal15.from(val);
  if (d.abs().gt(Decimal15.ONE)) throw new CalcError('Math ERROR');
  if (d.equals(Decimal15.ONE)) return Decimal15.ZERO;
  if (d.isZero()) {
    if (angleUnit === 'DEG') return Decimal15.fromString('90');
    if (angleUnit === 'GRA') return Decimal15.fromString('100');
    return fromScaled(PI_SCALED / 2n);
  }
  if (d.equals(Decimal15.fromString('-1'))) {
    if (angleUnit === 'DEG') return Decimal15.fromString('180');
    if (angleUnit === 'GRA') return Decimal15.fromString('200');
    return fromScaled(PI_SCALED);
  }
  if (d.equals(Decimal15.fromString('0.5'))) {
    if (angleUnit === 'DEG') return Decimal15.fromString('60');
    if (angleUnit === 'GRA') return Decimal15.fromString('66.6666666666667');
    return fromScaled(PI_SCALED / 3n);
  }
  if (d.equals(Decimal15.fromString('-0.5'))) {
    if (angleUnit === 'DEG') return Decimal15.fromString('120');
    if (angleUnit === 'GRA') return Decimal15.fromString('133.333333333333');
    return fromScaled((2n * PI_SCALED) / 3n);
  }

  // acos(x) = pi/2 - asin(x)
  if (angleUnit === 'DEG') {
    return Decimal15.fromString('90').sub(asin(d, 'DEG'));
  }
  if (angleUnit === 'GRA') {
    return Decimal15.fromString('100').sub(asin(d, 'GRA'));
  }
  return fromScaled(PI_SCALED / 2n).sub(asin(d, 'RAD'));
}

/**
 * Inverse Tangent
 * @param {Decimal15|number|string} val
 * @param {'DEG'|'RAD'|'GRA'} angleUnit
 */
export function atan(val, angleUnit = 'DEG') {
  const d = Decimal15.from(val);
  if (d.isZero()) return Decimal15.ZERO;

  // Exact 1 and -1
  if (d.equals(Decimal15.ONE)) {
    if (angleUnit === 'DEG') return Decimal15.fromString('45');
    if (angleUnit === 'GRA') return Decimal15.fromString('50');
    return fromScaled(PI_SCALED / 4n);
  }
  if (d.equals(Decimal15.fromString('-1'))) {
    if (angleUnit === 'DEG') return Decimal15.fromString('-45');
    if (angleUnit === 'GRA') return Decimal15.fromString('-50');
    return fromScaled(-(PI_SCALED / 4n));
  }

  const xScaled = toScaled(d);
  const radScaled = atanScaled(xScaled);

  if (angleUnit === 'RAD') {
    return fromScaled(radScaled);
  }
  if (angleUnit === 'DEG') {
    // degScaled = (radScaled * 180) / PI_SCALED
    const degScaled = (radScaled * 180n * SCALE) / PI_SCALED;
    return fromScaled(degScaled);
  }
  // GRA
  const graScaled = (radScaled * 200n * SCALE) / PI_SCALED;
  return fromScaled(graScaled);
}

/* -------------------------------------------------------------------------- */
/* Hyperbolic Functions                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Hyperbolic Sine
 */
export function sinh(val) {
  const d = Decimal15.from(val);
  if (d.abs().gt(EXP_LIMIT)) throw new CalcError('Math ERROR');
  if (d.isZero()) return Decimal15.ZERO;

  // sinh(x) = (e^x - e^(-x)) / 2
  const ep = exp(d);
  const en = exp(d.neg());
  return ep.sub(en).div(Decimal15.TWO);
}

/**
 * Hyperbolic Cosine
 */
export function cosh(val) {
  const d = Decimal15.from(val);
  if (d.abs().gt(EXP_LIMIT)) throw new CalcError('Math ERROR');
  if (d.isZero()) return Decimal15.ONE;

  // cosh(x) = (e^x + e^(-x)) / 2
  const ep = exp(d);
  const en = exp(d.neg());
  return ep.add(en).div(Decimal15.TWO);
}

/**
 * Hyperbolic Tangent
 */
export function tanh(val) {
  const d = Decimal15.from(val);
  if (d.isZero()) return Decimal15.ZERO;
  if (d.gte(Decimal15.fromString('35'))) return Decimal15.ONE;
  if (d.lte(Decimal15.fromString('-35'))) return Decimal15.fromString('-1');

  // tanh(x) = (e^(2x) - 1) / (e^(2x) + 1)
  const e2x = exp(d.mul(Decimal15.TWO));
  const num = e2x.sub(Decimal15.ONE);
  const den = e2x.add(Decimal15.ONE);
  return num.div(den);
}

/**
 * Inverse Hyperbolic Sine
 */
export function asinh(val) {
  const d = Decimal15.from(val);
  if (d.isZero()) return Decimal15.ZERO;
  // asinh(x) = ln(x + sqrt(x^2 + 1))
  const x2Plus1 = d.mul(d).add(Decimal15.ONE);
  const hyp = sqrt(x2Plus1);
  return ln(d.add(hyp));
}

/**
 * Inverse Hyperbolic Cosine
 */
export function acosh(val) {
  const d = Decimal15.from(val);
  if (d.lt(Decimal15.ONE)) throw new CalcError('Math ERROR');
  if (d.equals(Decimal15.ONE)) return Decimal15.ZERO;

  // acosh(x) = ln(x + sqrt(x^2 - 1))
  const x2Minus1 = d.mul(d).sub(Decimal15.ONE);
  const hyp = sqrt(x2Minus1);
  return ln(d.add(hyp));
}

/**
 * Inverse Hyperbolic Tangent
 */
export function atanh(val) {
  const d = Decimal15.from(val);
  if (d.abs().gte(Decimal15.ONE)) throw new CalcError('Math ERROR');
  if (d.isZero()) return Decimal15.ZERO;

  // atanh(x) = 0.5 * ln((1 + x) / (1 - x))
  const num = Decimal15.ONE.add(d);
  const den = Decimal15.ONE.sub(d);
  const ratio = num.div(den);
  return ln(ratio).div(Decimal15.TWO);
}

/* -------------------------------------------------------------------------- */
/* Logarithms and Exponentials                                                */
/* -------------------------------------------------------------------------- */

/**
 * Natural Logarithm ln(x)
 */
export function ln(val) {
  const d = Decimal15.from(val);
  if (d.sign <= 0) throw new CalcError('Math ERROR');
  if (d.equals(Decimal15.ONE)) return Decimal15.ZERO;
  if (d.equals(CASIO_E)) return Decimal15.ONE;

  // Decompose d into m * 10^k where 1 <= m < 10
  // mantissa is 15 digits. exp is d.exp.
  // value = (mantissa / 10^14) * 10^(exp + 14)
  const k = BigInt(d.exp + 14);
  const mScaled = (d.mantissa * SCALE) / 100000000000000n;
  const lnM = lnScaled(mScaled);
  const total = lnM + k * LN10_SCALED;
  return fromScaled(total);
}

/**
 * Common Logarithm log10(x)
 */
export function log(val) {
  const d = Decimal15.from(val);
  if (d.sign <= 0) throw new CalcError('Math ERROR');
  if (d.equals(Decimal15.ONE)) return Decimal15.ZERO;

  // Exact powers of 10
  if (d.mantissa === 100000000000000n) {
    const k = d.exp + 14;
    return Decimal15.fromInt(k);
  }

  // log10(x) = ln(x) / ln(10)
  const lnXScaled = toScaled(ln(d));
  const resScaled = (lnXScaled * SCALE) / LN10_SCALED;
  return fromScaled(resScaled);
}

/**
 * Logarithm to specified base: log_base(val)
 */
export function logBase(base, val) {
  const b = Decimal15.from(base);
  const v = Decimal15.from(val);
  if (b.sign <= 0 || b.equals(Decimal15.ONE) || v.sign <= 0) {
    throw new CalcError('Math ERROR');
  }
  return ln(v).div(ln(b));
}

/**
 * Exponential e^x
 */
export function exp(val) {
  const d = Decimal15.from(val);
  if (d.isZero()) return Decimal15.ONE;
  if (d.gt(EXP_LIMIT)) throw new CalcError('Math ERROR');
  if (d.lt(EXP_LIMIT.neg())) return Decimal15.ZERO; // Underflow
  if (d.equals(Decimal15.ONE)) return CASIO_E;

  const xScaled = toScaled(d);
  const resScaled = expScaled(xScaled);
  return fromScaled(resScaled);
}

/**
 * Power of ten 10^x
 */
export function pow10(val) {
  const d = Decimal15.from(val);
  if (d.isZero()) return Decimal15.ONE;
  if (d.gte(Decimal15.fromString('100'))) throw new CalcError('Math ERROR');
  if (d.lt(Decimal15.fromString('-99'))) return Decimal15.ZERO; // Underflow

  // Exact integer powers
  if (d.isInteger()) {
    const k = Number(d.toString());
    if (k >= -99 && k < 100) {
      return new Decimal15(1, 100000000000000n, k - 14);
    }
  }

  // 10^x = exp(x * ln(10))
  const xScaled = toScaled(d);
  const expArg = (xScaled * LN10_SCALED) / SCALE;
  return fromScaled(expScaled(expArg));
}

/* -------------------------------------------------------------------------- */
/* Powers and Roots                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Square Root sqrt(x)
 */
export function sqrt(val) {
  const d = Decimal15.from(val);
  if (d.sign < 0) throw new CalcError('Math ERROR');
  if (d.isZero()) return Decimal15.ZERO;

  let M = d.mantissa;
  let exp = d.exp;
  const rem = ((exp % 2) + 2) % 2;
  if (rem === 1) {
    M = M * 10n;
    exp -= 1;
  }

  // Scale M by 10^40 (even power)
  const R = isqrt(M * (10n ** 40n));
  const str = R.toString();
  const L = str.length;
  const m16 = BigInt(str.slice(0, 16));
  let m15 = (m16 + 5n) / 10n;
  let resExp = -20 + exp / 2 + L - 15;
  if (m15 >= 10n ** 15n) {
    m15 /= 10n;
    resExp++;
  }
  return new Decimal15(1, m15, resExp);
}

/**
 * Cube Root cbrt(x)
 */
export function cbrt(val) {
  const d = Decimal15.from(val);
  if (d.isZero()) return Decimal15.ZERO;

  const s = d.sign;
  let M = d.mantissa;
  let exp = d.exp;
  const rem = ((exp % 3) + 3) % 3;
  if (rem === 1) {
    M = M * 10n;
    exp -= 1;
  } else if (rem === 2) {
    M = M * 100n;
    exp -= 2;
  }

  // Scale M by 10^60 (multiple of 3)
  const R = icbrt(M * (10n ** 60n));
  const str = R.toString();
  const L = str.length;
  const m16 = BigInt(str.slice(0, 16));
  let m15 = (m16 + 5n) / 10n;
  let resExp = -20 + exp / 3 + L - 15;
  if (m15 >= 10n ** 15n) {
    m15 /= 10n;
    resExp++;
  }
  return new Decimal15(s, m15, resExp);
}

/**
 * Square x^2
 */
export function sqr(val) {
  const d = Decimal15.from(val);
  if (d.abs().gte(Decimal15.fromString('1e50'))) throw new CalcError('Math ERROR');
  return d.mul(d);
}

/**
 * Cube x^3
 */
export function cube(val) {
  const d = Decimal15.from(val);
  if (d.abs().gte(Decimal15.fromString('1e33.3333333333334'))) {
    // Checked via exponent
    if (d.abs().gte(Decimal15.fromString('2.15443469003188e33'))) {
      throw new CalcError('Math ERROR');
    }
  }
  return d.mul(d).mul(d);
}

/**
 * Reciprocal x^-1
 */
export function recip(val) {
  const d = Decimal15.from(val);
  if (d.isZero()) throw new CalcError('Math ERROR');
  return Decimal15.ONE.div(d);
}

/**
 * General Power x^y
 */
export function pow(base, exponent) {
  const x = Decimal15.from(base);
  const y = Decimal15.from(exponent);

  if (x.isZero()) {
    if (y.sign <= 0) throw new CalcError('Math ERROR');
    return Decimal15.ZERO;
  }

  // y is integer
  if (y.isInteger()) {
    const n = Number(y.toString());
    if (n === 0) return Decimal15.ONE;
    if (n > 0 && n <= 1000) {
      let res = Decimal15.ONE;
      let b = x;
      let p = n;
      while (p > 0) {
        if (p % 2 === 1) res = res.mul(b);
        if (p > 1) b = b.mul(b);
        p = Math.floor(p / 2);
      }
      return res;
    }
    if (n < 0 && n >= -1000) {
      return Decimal15.ONE.div(pow(x, -n));
    }
  }

  // Negative base with rational exponent
  if (x.sign < 0) {
    let rat = null;
    try {
      rat = Rational.from(Number(y.toString()));
    } catch {
      rat = y.toRational();
    }
    if (!rat || rat.d % 2n === 0n) {
      throw new CalcError('Math ERROR');
    }
    const isOddNumerator = (rat.n < 0n ? -rat.n : rat.n) % 2n === 1n;
    const posRes = pow(x.abs(), y);
    return isOddNumerator ? posRes.neg() : posRes;
  }

  // x > 0: exp(y * ln(x))
  const logX = log(x);
  const yLogX = y.mul(logX);
  if (yLogX.gte(Decimal15.fromString('100'))) throw new CalcError('Math ERROR');
  if (yLogX.lt(Decimal15.fromString('-99'))) return Decimal15.ZERO;

  return exp(y.mul(ln(x)));
}

/**
 * Power Root x√y (i.e. y^(1/x))
 */
export function xRoot(xVal, yVal) {
  const x = Decimal15.from(xVal);
  const y = Decimal15.from(yVal);

  if (x.isZero()) throw new CalcError('Math ERROR');
  if (y.isZero()) {
    if (x.sign <= 0) throw new CalcError('Math ERROR');
    return Decimal15.ZERO;
  }

  if (x.equals(Decimal15.TWO)) return sqrt(y);
  if (x.equals(Decimal15.fromString('3'))) return cbrt(y);

  return pow(y, Decimal15.ONE.div(x));
}

/* -------------------------------------------------------------------------- */
/* Factorial and Combinatorics                                                */
/* -------------------------------------------------------------------------- */

/**
 * Factorial x!
 */
export function factorial(val) {
  const d = Decimal15.from(val);
  if (d.sign < 0 || !d.isInteger()) throw new CalcError('Math ERROR');
  const n = Number(d.toString());
  if (n > 69) throw new CalcError('Math ERROR'); // 70! >= 1e100

  if (n === 0 || n === 1) return Decimal15.ONE;
  let res = 1n;
  for (let i = 2n; i <= BigInt(n); i++) {
    res *= i;
  }
  return Decimal15.fromBigInt(res);
}

/**
 * Permutations nPr
 */
export function nPr(nVal, rVal) {
  const nD = Decimal15.from(nVal);
  const rD = Decimal15.from(rVal);
  if (!nD.isInteger() || !rD.isInteger()) throw new CalcError('Math ERROR');

  const n = nD.toBigInt();
  const r = rD.toBigInt();
  if (n < 0n || r < 0n || r > n || n >= 10000000000n) throw new CalcError('Math ERROR');

  let res = 1n;
  for (let i = 0n; i < r; i++) {
    res *= (n - i);
    if (res >= 10n ** 100n) throw new CalcError('Math ERROR');
  }
  return Decimal15.fromBigInt(res);
}

/**
 * Combinations nCr
 */
export function nCr(nVal, rVal) {
  const nD = Decimal15.from(nVal);
  const rD = Decimal15.from(rVal);
  if (!nD.isInteger() || !rD.isInteger()) throw new CalcError('Math ERROR');

  const n = nD.toBigInt();
  let r = rD.toBigInt();
  if (n < 0n || r < 0n || r > n || n >= 10000000000n) throw new CalcError('Math ERROR');

  // Symmetry optimization
  if (r > n - r) r = n - r;

  let num = 1n;
  let den = 1n;
  for (let i = 1n; i <= r; i++) {
    num *= (n - (i - 1n));
    den *= i;
  }
  const res = num / den;
  if (res >= 10n ** 100n) throw new CalcError('Math ERROR');
  return Decimal15.fromBigInt(res);
}

/* -------------------------------------------------------------------------- */
/* Number Operations: Abs, Int, Intg, Rnd, %, GCD, LCM, ÷R                    */
/* -------------------------------------------------------------------------- */

/**
 * Absolute Value
 */
export function abs(val) {
  return Decimal15.from(val).abs();
}

/**
 * Integer Truncation (towards zero)
 */
export function int(val) {
  return Decimal15.from(val).trunc();
}

/**
 * Greatest Integer (Floor)
 */
export function intg(val) {
  return Decimal15.from(val).floor();
}

/**
 * Round according to display format setting
 * @param {Decimal15|number|string} val
 * @param {{type: 'NORM'|'FIX'|'SCI', value: number}} format
 */
export function rnd(val, format = { type: 'NORM', value: 1 }) {
  const d = Decimal15.from(val);
  if (d.isZero()) return Decimal15.ZERO;

  if (format.type === 'FIX') {
    const decimals = Math.max(0, Math.min(9, format.value ?? 3));
    return Decimal15.fromString(d.toFixed(decimals));
  }

  if (format.type === 'SCI') {
    const sigDigits = Math.max(1, Math.min(10, format.value ?? 10));
    if (sigDigits === 15) return d;
    const div = 10n ** BigInt(15 - sigDigits - 1);
    const mPlusOne = d.mantissa / div;
    let rounded = (mPlusOne + 5n) / 10n;
    let exp = d.exp;
    const scaleUp = 10n ** BigInt(15 - sigDigits);
    if (rounded >= 10n ** BigInt(sigDigits)) {
      rounded /= 10n;
      exp++;
    }
    return new Decimal15(d.sign, rounded * scaleUp, exp);
  }

  // NORM 1 or NORM 2: rounds off at 11th digit of mantissa (keeps 10 digits)
  const div = 10n ** 4n; // 15 - 10 - 1 = 4
  const m11 = d.mantissa / div;
  let rounded = (m11 + 5n) / 10n;
  let exp = d.exp;
  if (rounded >= 10n ** 10n) {
    rounded /= 10n;
    exp++;
  }
  return new Decimal15(d.sign, rounded * (10n ** 5n), exp);
}

/**
 * Percentage %
 */
export function percent(val) {
  return Decimal15.from(val).div(Decimal15.fromString('100'));
}

/**
 * Greatest Common Divisor
 */
export function gcd(aVal, bVal) {
  const aD = Decimal15.from(aVal);
  const bD = Decimal15.from(bVal);
  if (!aD.isInteger() || !bD.isInteger()) throw new CalcError('Math ERROR');

  let a = aD.toBigInt();
  let b = bD.toBigInt();
  if (a < 0n) a = -a;
  if (b < 0n) b = -b;

  while (b !== 0n) {
    const t = b;
    b = a % b;
    a = t;
  }
  return Decimal15.fromBigInt(a);
}

/**
 * Least Common Multiple
 */
export function lcm(aVal, bVal) {
  const aD = Decimal15.from(aVal);
  const bD = Decimal15.from(bVal);
  if (!aD.isInteger() || !bD.isInteger()) throw new CalcError('Math ERROR');

  let a = aD.toBigInt();
  let b = bD.toBigInt();
  if (a < 0n) a = -a;
  if (b < 0n) b = -b;
  if (a === 0n || b === 0n) return Decimal15.ZERO;

  const g = gcd(aD, bD).toBigInt();
  const res = (a / g) * b;
  return Decimal15.fromBigInt(res);
}

/**
 * Integer Division with Remainder: a ÷R b
 */
export function divR(aVal, bVal) {
  const aD = Decimal15.from(aVal);
  const bD = Decimal15.from(bVal);
  if (bD.isZero()) throw new CalcError('Math ERROR');
  if (!aD.isInteger() || !bD.isInteger()) throw new CalcError('Math ERROR');

  const q = aD.div(bD).trunc();
  const r = aD.sub(q.mul(bD));
  return { q, r };
}

/* -------------------------------------------------------------------------- */
/* Coordinate Transformations: Pol & Rec                                     */
/* -------------------------------------------------------------------------- */

/**
 * Polar Conversion Pol(x, y)
 * Returns { r, theta }
 */
export function pol(xVal, yVal, angleUnit = 'DEG') {
  const x = Decimal15.from(xVal);
  const y = Decimal15.from(yVal);

  const r = sqrt(x.mul(x).add(y.mul(y)));

  let theta;
  if (x.isZero() && y.isZero()) {
    theta = Decimal15.ZERO;
  } else if (x.isZero()) {
    if (angleUnit === 'DEG') theta = y.sign > 0 ? Decimal15.fromString('90') : Decimal15.fromString('-90');
    else if (angleUnit === 'GRA') theta = y.sign > 0 ? Decimal15.fromString('100') : Decimal15.fromString('-100');
    else theta = fromScaled(y.sign > 0 ? PI_SCALED / 2n : -(PI_SCALED / 2n));
  } else if (x.sign > 0) {
    theta = atan(y.div(x), angleUnit);
  } else {
    // x < 0
    const rawAtan = atan(y.div(x), angleUnit);
    if (angleUnit === 'DEG') {
      theta = y.sign >= 0 ? rawAtan.add(Decimal15.fromString('180')) : rawAtan.sub(Decimal15.fromString('180'));
    } else if (angleUnit === 'GRA') {
      theta = y.sign >= 0 ? rawAtan.add(Decimal15.fromString('200')) : rawAtan.sub(Decimal15.fromString('200'));
    } else {
      theta = y.sign >= 0 ? rawAtan.add(fromScaled(PI_SCALED)) : rawAtan.sub(fromScaled(PI_SCALED));
    }
  }

  return { r, theta };
}

/**
 * Rectangular Conversion Rec(r, theta)
 * Returns { x, y }
 */
export function rec(rVal, thetaVal, angleUnit = 'DEG') {
  const r = Decimal15.from(rVal);
  const theta = Decimal15.from(thetaVal);

  if (r.sign < 0) throw new CalcError('Math ERROR');
  checkAngleInput(theta, angleUnit);

  const x = r.mul(cos(theta, angleUnit));
  const y = r.mul(sin(theta, angleUnit));
  return { x, y };
}

/* -------------------------------------------------------------------------- */
/* Sexagesimal: Degree-Minute-Second Conversions                              */
/* -------------------------------------------------------------------------- */

/**
 * Convert Decimal to DMS: toDMS(2.258) -> { sign, d, m, s }
 */
export function toDMS(val) {
  const d = Decimal15.from(val);
  if (d.abs().gte(Decimal15.fromString('1e7'))) throw new CalcError('Math ERROR');

  const s = d.sign;
  const absVal = d.abs();
  const deg = absVal.trunc();
  const remMin = absVal.sub(deg).mul(Decimal15.fromString('60'));
  const min = remMin.trunc();
  const sec = remMin.sub(min).mul(Decimal15.fromString('60'));

  return { sign: s, d: deg, m: min, s: sec };
}

/**
 * Convert DMS to Decimal: fromDMS(2, 15, 28.8) -> Decimal15
 */
export function fromDMS(dVal, mVal = 0, sVal = 0) {
  const d = Decimal15.from(dVal);
  const m = Decimal15.from(mVal);
  const s = Decimal15.from(sVal);

  if (m.sign < 0 || s.sign < 0) throw new CalcError('Math ERROR');
  const minPart = m.div(Decimal15.fromString('60'));
  const secPart = s.div(Decimal15.fromString('3600'));
  return d.add(minPart).add(secPart);
}

/* -------------------------------------------------------------------------- */
/* Random Functions                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Ran# - 3 decimal digits in [0.000, 0.999]
 */
export function ranHash(rng = Math.random) {
  const intVal = Math.floor(rng() * 1000);
  const str = (intVal / 1000).toFixed(3);
  return Decimal15.fromString(str);
}

/**
 * RanInt#(a, b) - Random integer in [a, b]
 */
export function ranInt(aVal, bVal, rng = Math.random) {
  const aD = Decimal15.from(aVal);
  const bD = Decimal15.from(bVal);
  if (!aD.isInteger() || !bD.isInteger()) throw new CalcError('Math ERROR');

  const a = aD.toBigInt();
  const b = bD.toBigInt();
  const TEN_BILLION = 10000000000n;
  const absA = a < 0n ? -a : a;
  const absB = b < 0n ? -b : b;

  if (a > b || absA >= TEN_BILLION || absB >= TEN_BILLION || (b - a) >= TEN_BILLION) {
    throw new CalcError('Math ERROR');
  }

  const range = Number(b - a + 1n);
  const randInt = a + BigInt(Math.floor(rng() * range));
  return Decimal15.fromBigInt(randInt);
}
