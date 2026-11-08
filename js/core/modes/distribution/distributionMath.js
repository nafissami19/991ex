/**
 * High-precision mathematical functions for Distribution mode (MENU 7).
 *
 * Implements:
 *   - Normal PD: f(x; σ, μ)
 *   - Normal CD: P(Lower ≤ X ≤ Upper; σ, μ)
 *   - Inverse Normal: xInv = μ + σ * Φ⁻¹(Area)
 *   - Binomial PD: P(X = x; N, p)
 *   - Binomial CD: P(X ≤ x; N, p)
 *   - Poisson PD: P(X = x; λ)
 *   - Poisson CD: P(X ≤ x; λ)
 *
 * All functions return 15-digit internal precision Decimal15 objects,
 * adhering to Casio fx-991EX ClassWiz specifications and limits.
 */

import { Decimal15 } from '../../number/Decimal15.js';
import { CalcError, ERRORS } from '../../errors.js';
import { nCr, CASIO_PI, exp, sqrt } from '../../number/functions.js';

const SQRT_2PI = 2.506628274631000502415765284811;
const SQRT_2 = 1.4142135623730950488016887242097;
const SQRT_PI = 1.7724538509055160272981674833411;

/**
 * High-precision error function erf(x).
 * Uses the non-cancelling series:
 * erf(x) = (2 / √π) * exp(-x²) * ∑_{n=0}^∞ [ (2x²)^n / (1 · 3 · 5 ··· (2n+1)) ]
 * All series terms are strictly positive, eliminating catastrophic cancellation.
 */
export function erf(x) {
  if (x === 0) return 0;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  if (ax > 8.0) return sign * 1.0;

  let term = ax;
  let sum = term;
  const x2 = 2.0 * ax * ax;
  let denom = 1;
  for (let n = 1; n < 120; n++) {
    denom += 2;
    term *= x2 / denom;
    sum += term;
    if (term < 1e-19 * sum) break;
  }
  const res = sign * (2.0 / SQRT_PI) * Math.exp(-ax * ax) * sum;
  return Math.max(-1.0, Math.min(1.0, res));
}

/**
 * Standard Normal Cumulative Distribution Function Φ(z).
 */
export function phi(z) {
  if (z >= 8.0) return 1.0;
  if (z <= -8.0) return 0.0;
  return 0.5 * (1.0 + erf(z / SQRT_2));
}

/**
 * Acklam's algorithm for Inverse Normal CDF Φ⁻¹(p) with Halley's cubic refinement step.
 * Returns standard normal quantile z such that Φ(z) = p for 0 < p < 1.
 */
export function invNormAcklam(p) {
  if (p <= 0.0 || p >= 1.0) {
    throw new CalcError(ERRORS.MATH);
  }

  const a = [
    -3.969683028665376e+01,
     2.209460984245205e+02,
    -2.759285104469687e+02,
     1.383577518672690e+02,
    -3.066479806614716e+01,
     2.506628277459239e+00
  ];
  const b = [
    -5.447609879822406e+01,
     1.615858368580409e+02,
    -1.556989798598866e+02,
     6.680131188771972e+01,
    -1.328068155288572e+01
  ];
  const c = [
    -7.784894002430293e-03,
    -3.223964580411365e-01,
    -2.400758277161838e+00,
    -2.549732539343734e+00,
     4.374664141464968e+00,
     2.938163982698783e+00
  ];
  const d = [
     7.784695709041462e-03,
     3.224671290700398e-01,
     2.445134137142996e+00,
     3.754408661907416e+00
  ];

  const p_low = 0.02425;
  const p_high = 1.0 - p_low;
  let x;

  if (p < p_low) {
    const q = Math.sqrt(-2.0 * Math.log(p));
    x = (((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
        ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1.0);
  } else if (p <= p_high) {
    const q = p - 0.5;
    const r = q * q;
    x = (((((a[0]*r + a[1])*r + a[2])*r + a[3])*r + a[4])*r + a[5]) * q /
        (((((b[0]*r + b[1])*r + b[2])*r + b[3])*r + b[4])*r + 1.0);
  } else {
    const q = Math.sqrt(-2.0 * Math.log(1.0 - p));
    x = -(((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
         ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1.0);
  }

  // Halley's refinement step: cubic convergence to machine precision
  const currentPhi = phi(x);
  const err = currentPhi - p;
  const u = err * SQRT_2PI * Math.exp(0.5 * x * x);
  x = x - u / (1.0 + 0.5 * x * u);

  return x;
}

/**
 * Normal Probability Density: f(x; σ, μ)
 * f(x) = (1 / (σ √(2π))) * exp( -(x - μ)² / (2σ²) )
 */
export function normalPD(xVal, sigmaVal, muVal) {
  const x = Decimal15.from(xVal).toNumber();
  const sigma = Decimal15.from(sigmaVal).toNumber();
  const mu = Decimal15.from(muVal).toNumber();

  if (sigma <= 0 || !Number.isFinite(sigma) || !Number.isFinite(x) || !Number.isFinite(mu)) {
    throw new CalcError(ERRORS.MATH);
  }

  const z = (x - mu) / sigma;
  if (Math.abs(z) >= 39.0) {
    return Decimal15.ZERO;
  }

  const pdf = Math.exp(-0.5 * z * z) / (sigma * SQRT_2PI);
  return Decimal15.fromString(pdf.toPrecision(15));
}

/**
 * Normal Cumulative Distribution: P(Lower ≤ X ≤ Upper; σ, μ)
 */
export function normalCD(lowerVal, upperVal, sigmaVal, muVal) {
  const lower = Decimal15.from(lowerVal).toNumber();
  const upper = Decimal15.from(upperVal).toNumber();
  const sigma = Decimal15.from(sigmaVal).toNumber();
  const mu = Decimal15.from(muVal).toNumber();

  if (sigma <= 0 || !Number.isFinite(sigma) || !Number.isFinite(lower) || !Number.isFinite(upper) || !Number.isFinite(mu)) {
    throw new CalcError(ERRORS.MATH);
  }

  if (lower > upper) {
    throw new CalcError(ERRORS.MATH);
  }

  if (lower === upper) {
    return Decimal15.ZERO;
  }

  const z1 = (lower - mu) / sigma;
  const z2 = (upper - mu) / sigma;

  const p1 = phi(z1);
  const p2 = phi(z2);
  let diff = p2 - p1;
  if (diff < 0) diff = 0;
  if (diff > 1) diff = 1;

  return Decimal15.fromString(diff.toPrecision(15));
}

/**
 * Inverse Normal: xInv = μ + σ * Φ⁻¹(Area)
 */
export function inverseNormal(areaVal, sigmaVal, muVal) {
  const area = Decimal15.from(areaVal).toNumber();
  const sigma = Decimal15.from(sigmaVal).toNumber();
  const mu = Decimal15.from(muVal).toNumber();

  if (sigma <= 0 || !Number.isFinite(sigma) || !Number.isFinite(mu) || !Number.isFinite(area)) {
    throw new CalcError(ERRORS.MATH);
  }

  if (area <= 0.0 || area >= 1.0) {
    throw new CalcError(ERRORS.MATH);
  }

  const z = invNormAcklam(area);
  const xInv = mu + sigma * z;
  return Decimal15.fromString(xInv.toPrecision(15));
}

function logGamma(z) {
  const p = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109583111912, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = p[0];
  for (let i = 1; i < p.length; i++) x += p[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function logFactorial(n) {
  return n <= 1 ? 0 : logGamma(n + 1);
}

function logCombination(n, k) {
  if (k <= 0 || k >= n) return 0;
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

/**
 * Binomial Probability Density: P(X = x; N, p)
 */
export function binomialPD(xVal, nVal, pVal) {
  const xD = Decimal15.from(xVal);
  const nD = Decimal15.from(nVal);
  const pD = Decimal15.from(pVal);

  const x = xD.toNumber();
  const N = nD.toNumber();
  const p = pD.toNumber();

  if (!Number.isInteger(x) || !Number.isInteger(N) || N < 0 || N > 9999 || p < 0 || p > 1) {
    throw new CalcError(ERRORS.MATH);
  }

  if (x < 0 || x > N) {
    throw new CalcError(ERRORS.MATH);
  }

  if (p === 0) {
    return x === 0 ? Decimal15.ONE : Decimal15.ZERO;
  }
  if (p === 1) {
    return x === N ? Decimal15.ONE : Decimal15.ZERO;
  }

  const q = 1.0 - p;
  const logP = logCombination(N, x) + x * Math.log(p) + (N - x) * Math.log(q);
  if (logP < -700) {
    return Decimal15.ZERO;
  }

  const res = Math.exp(logP);
  return Decimal15.fromString(res.toPrecision(15));
}

/**
 * Binomial Cumulative Distribution: P(X ≤ x; N, p)
 */
export function binomialCD(xVal, nVal, pVal) {
  const xD = Decimal15.from(xVal);
  const nD = Decimal15.from(nVal);
  const pD = Decimal15.from(pVal);

  const x = xD.toNumber();
  const N = nD.toNumber();
  const p = pD.toNumber();

  if (!Number.isInteger(x) || !Number.isInteger(N) || N < 0 || N > 9999 || p < 0 || p > 1) {
    throw new CalcError(ERRORS.MATH);
  }

  if (x < 0) {
    return Decimal15.ZERO;
  }
  if (x >= N) {
    return Decimal15.ONE;
  }

  if (p === 0) {
    return Decimal15.ONE;
  }
  if (p === 1) {
    return x === N ? Decimal15.ONE : Decimal15.ZERO;
  }

  const q = 1.0 - p;
  const mean = N * p;

  if (x <= mean) {
    const logP = logCombination(N, x) + x * Math.log(p) + (N - x) * Math.log(q);
    let cur = logP < -700 ? 0 : Math.exp(logP);
    let sum = cur;
    for (let k = x; k >= 1; k--) {
      cur = cur * (k / (N - k + 1)) * (q / p);
      sum += cur;
      if (cur < 1e-19 * sum) break;
    }
    if (sum > 1.0) sum = 1.0;
    return Decimal15.fromString(sum.toPrecision(15));
  } else {
    const logP = logCombination(N, x + 1) + (x + 1) * Math.log(p) + (N - x - 1) * Math.log(q);
    let cur = logP < -700 ? 0 : Math.exp(logP);
    let sum = cur;
    for (let k = x + 1; k < N; k++) {
      cur = cur * ((N - k) / (k + 1)) * (p / q);
      sum += cur;
      if (cur < 1e-19 * sum) break;
    }
    let res = 1.0 - sum;
    if (res < 0) res = 0;
    if (res > 1.0) res = 1.0;
    return Decimal15.fromString(res.toPrecision(15));
  }
}

/**
 * Poisson Probability Density: P(X = x; λ)
 */
export function poissonPD(xVal, lambdaVal) {
  const xD = Decimal15.from(xVal);
  const lamD = Decimal15.from(lambdaVal);

  const x = xD.toNumber();
  const lam = lamD.toNumber();

  if (!Number.isInteger(x) || x < 0 || lam <= 0 || !Number.isFinite(lam)) {
    throw new CalcError(ERRORS.MATH);
  }

  const logP = x * Math.log(lam) - lam - logFactorial(x);
  if (logP < -700) {
    return Decimal15.ZERO;
  }

  const res = Math.exp(logP);
  return Decimal15.fromString(res.toPrecision(15));
}

/**
 * Poisson Cumulative Distribution: P(X ≤ x; λ)
 */
export function poissonCD(xVal, lambdaVal) {
  const xD = Decimal15.from(xVal);
  const lamD = Decimal15.from(lambdaVal);

  const x = xD.toNumber();
  const lam = lamD.toNumber();

  if (!Number.isInteger(x) || x < 0 || lam <= 0 || !Number.isFinite(lam)) {
    throw new CalcError(ERRORS.MATH);
  }

  if (x <= Math.floor(lam)) {
    const logP = x * Math.log(lam) - lam - logFactorial(x);
    let cur = logP < -700 ? 0 : Math.exp(logP);
    let sum = cur;
    for (let k = x; k >= 1; k--) {
      cur = cur * (k / lam);
      sum += cur;
      if (cur < 1e-19 * sum) break;
    }
    if (sum > 1.0) sum = 1.0;
    return Decimal15.fromString(sum.toPrecision(15));
  } else {
    const logP = (x + 1) * Math.log(lam) - lam - logFactorial(x + 1);
    let cur = logP < -700 ? 0 : Math.exp(logP);
    let sum = cur;
    for (let k = x + 1; ; k++) {
      cur = cur * (lam / (k + 1));
      sum += cur;
      if (cur < 1e-19 * sum || k > x + 1000) break;
    }
    let res = 1.0 - sum;
    if (res < 0) res = 0;
    if (res > 1.0) res = 1.0;
    return Decimal15.fromString(res.toPrecision(15));
  }
}
