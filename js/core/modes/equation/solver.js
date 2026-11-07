/**
 * Equation/Func mode solver (Simultaneous Linear Equations & Polynomials).
 */

import { Rational } from '../../exact/Rational.js';
import { SurdForm } from '../../exact/SurdForm.js';
import { ExactValue } from '../../exact/ExactValue.js';
import { ComplexValue } from '../complex/ComplexValue.js';
import { Decimal15 } from '../../number/Decimal15.js';
import { CalcError, ERRORS } from '../../errors.js';

export function toRational(v) {
  if (v instanceof Rational) return v;
  if (v instanceof ExactValue) {
    if (v.type === 'rational') return v.value;
    if (v.type === 'decimal') return Rational.from(v.value.toString());
  }
  return Rational.from(v || 0);
}

function gcd(a, b) {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y > 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

function getFactors(n) {
  const val = n < 0n ? -n : n;
  if (val === 0n) return [1n];
  const factors = [];
  for (let i = 1n; i * i <= val; i++) {
    if (val % i === 0n) {
      factors.push(i);
      if (i * i !== val) factors.push(val / i);
    }
  }
  return factors;
}

/**
 * Solve simultaneous linear equations using exact Gaussian elimination.
 * @param {Array<Array<any>>} rawCoeffs N x (N+1) coefficient matrix
 * @param {number} N Number of unknowns (2, 3, or 4)
 * @returns {{ type: 'unique'|'no_solution'|'infinite_solution', solutions?: ExactValue[] }}
 */
export function solveSimultaneous(rawCoeffs, N) {
  const M = [];
  for (let r = 0; r < N; r++) {
    const row = [];
    for (let c = 0; c <= N; c++) {
      row.push(toRational(rawCoeffs[r]?.[c] ?? 0));
    }
    M.push(row);
  }

  let pivotRow = 0;
  for (let col = 0; col < N && pivotRow < N; col++) {
    let sel = -1;
    for (let r = pivotRow; r < N; r++) {
      if (!M[r][col].isZero()) {
        sel = r;
        break;
      }
    }
    if (sel === -1) continue;

    if (sel !== pivotRow) {
      const tmp = M[pivotRow];
      M[pivotRow] = M[sel];
      M[sel] = tmp;
    }

    const p = M[pivotRow][col];
    for (let c = col; c <= N; c++) {
      M[pivotRow][c] = M[pivotRow][c].div(p);
    }

    for (let r = 0; r < N; r++) {
      if (r !== pivotRow && !M[r][col].isZero()) {
        const factor = M[r][col];
        for (let c = col; c <= N; c++) {
          M[r][c] = M[r][c].sub(factor.mul(M[pivotRow][c]));
        }
      }
    }
    pivotRow++;
  }

  // Check consistency
  for (let r = 0; r < N; r++) {
    const allZeros = M[r].slice(0, N).every((c) => c.isZero());
    if (allZeros && !M[r][N].isZero()) {
      return { type: 'no_solution' };
    }
  }

  // Check rank
  let rank = 0;
  for (let r = 0; r < N; r++) {
    if (M[r].slice(0, N).some((c) => !c.isZero())) rank++;
  }
  if (rank < N) {
    return { type: 'infinite_solution' };
  }

  const solutions = [];
  for (let r = 0; r < N; r++) {
    solutions.push(ExactValue.fromRational(M[r][N].n, M[r][N].d));
  }
  return { type: 'unique', solutions };
}

/**
 * Solve quadratic equation ax^2 + bx + c = 0.
 */
export function solveQuadratic(aRaw, bRaw, cRaw, setup) {
  const a = toRational(aRaw);
  const b = toRational(bRaw);
  const c = toRational(cRaw);

  if (a.isZero()) {
    throw new CalcError(ERRORS.MATH);
  }

  const xv = b.neg().div(a.mul(2));
  const yv = a.mul(c).mul(4).sub(b.mul(b)).div(a.mul(4));
  const minMax = a.n > 0n ? 'Min' : 'Max';

  const disc = b.mul(b).sub(a.mul(c).mul(4));
  let roots = [];
  let hasRealRoots = true;

  if (disc.isZero()) {
    const r = ExactValue.fromRational(xv.n, xv.d);
    roots = [r, r];
  } else if (disc.n > 0n) {
    const sDisc = SurdForm.sqrt(disc);
    const denom = SurdForm.from(a.mul(2));
    const r1 = SurdForm.from(b.neg()).add(sDisc).div(denom);
    const r2 = SurdForm.from(b.neg()).sub(sDisc).div(denom);
    roots = [ExactValue.fromSurd(r1), ExactValue.fromSurd(r2)];
  } else {
    if (!setup.eqComplex) {
      hasRealRoots = false;
    } else {
      const posDisc = disc.neg();
      const sDisc = SurdForm.sqrt(posDisc);
      const re = ExactValue.fromRational(xv.n, xv.d);
      const imSurd = sDisc.div(SurdForm.from(a.mul(2)));
      const im = ExactValue.fromSurd(imSurd);
      roots = [new ComplexValue(re, im), new ComplexValue(re, im.neg())];
    }
  }

  return {
    roots,
    hasRealRoots,
    vertex: {
      x: ExactValue.fromRational(xv.n, xv.d),
      y: ExactValue.fromRational(yv.n, yv.d),
      minMax
    }
  };
}

/**
 * Search for an exact rational root of a polynomial.
 * @param {Rational[]} coeffs [a_n, ..., a_0]
 * @returns {Rational|null}
 */
function findRationalRoot(coeffs) {
  let lcmD = 1n;
  for (const c of coeffs) {
    lcmD = (lcmD * c.d) / gcd(lcmD, c.d);
  }
  const intCoeffs = coeffs.map((c) => (c.n * lcmD) / c.d);
  const n = intCoeffs.length - 1;
  const lead = intCoeffs[0];
  const tail = intCoeffs[n];

  if (tail === 0n) {
    return new Rational(0n, 1n);
  }

  const pFactors = getFactors(tail);
  const qFactors = getFactors(lead);

  for (const p of pFactors) {
    for (const q of qFactors) {
      for (const sign of [1n, -1n]) {
        const r = new Rational(sign * p, q);
        let sum = new Rational(0n, 1n);
        let cur = new Rational(1n, 1n);
        for (let i = n; i >= 0; i--) {
          sum = sum.add(cur.mul(new Rational(intCoeffs[i], 1n)));
          cur = cur.mul(r);
        }
        if (sum.isZero()) {
          return r;
        }
      }
    }
  }
  return null;
}

/**
 * Synthetic division of polynomial by (x - r).
 * @param {Rational[]} coeffs
 * @param {Rational} r
 * @returns {Rational[]}
 */
function deflatePoly(coeffs, r) {
  const n = coeffs.length - 1;
  const res = [coeffs[0]];
  for (let i = 1; i < n; i++) {
    res.push(coeffs[i].add(res[i - 1].mul(r)));
  }
  return res;
}

/**
 * Numerical Durand-Kerner root finder for degree n polynomial.
 */
function durandKerner(coeffs) {
  const n = coeffs.length - 1;
  const a_n = coeffs[0];
  const p = coeffs.map((c) => c / a_n);

  function evalPoly(z) {
    let re = p[0];
    let im = 0;
    for (let i = 1; i <= n; i++) {
      const nre = re * z.re - im * z.im + p[i];
      const nim = re * z.im + im * z.re;
      re = nre;
      im = nim;
    }
    return { re, im };
  }

  const roots = [];
  const R = 0.4;
  const theta = 0.9;
  for (let i = 0; i < n; i++) {
    roots.push({
      re: Math.pow(R, i) * Math.cos(theta * i),
      im: Math.pow(R, i) * Math.sin(theta * i)
    });
  }

  for (let iter = 0; iter < 60; iter++) {
    for (let i = 0; i < n; i++) {
      const f = evalPoly(roots[i]);
      let denomRe = 1;
      let denomIm = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const diffRe = roots[i].re - roots[j].re;
        const diffIm = roots[i].im - roots[j].im;
        const nRe = denomRe * diffRe - denomIm * diffIm;
        const nIm = denomRe * diffIm + denomIm * diffRe;
        denomRe = nRe;
        denomIm = nIm;
      }
      const mag2 = denomRe * denomRe + denomIm * denomIm;
      if (mag2 === 0) continue;
      const stepRe = (f.re * denomRe + f.im * denomIm) / mag2;
      const stepIm = (f.im * denomRe - f.re * denomIm) / mag2;
      roots[i].re -= stepRe;
      roots[i].im -= stepIm;
    }
  }

  // Tidy near-zero imaginary or real parts
  for (const r of roots) {
    if (Math.abs(r.im) < 1e-9) r.im = 0;
    if (Math.abs(r.re) < 1e-9) r.re = 0;
  }
  return roots;
}

function approxNum(val) {
  if (val instanceof ComplexValue) {
    return approxNum(val.re);
  }
  if (val instanceof ExactValue) {
    return Number(val.toDecimal15().toString());
  }
  return Number(val);
}

function sortRoots(roots) {
  const real = [];
  const complex = [];
  for (const r of roots) {
    if (r instanceof ComplexValue) {
      complex.push(r);
    } else {
      real.push(r);
    }
  }

  // Real roots: descending order (largest to smallest)
  real.sort((a, b) => approxNum(b) - approxNum(a));

  // Complex roots: conjugate pairs with +im before -im, sorted by re descending
  complex.sort((a, b) => {
    const diffRe = approxNum(b.re) - approxNum(a.re);
    if (Math.abs(diffRe) > 1e-9) return diffRe;
    return approxNum(b.im) - approxNum(a.im);
  });

  return [...real, ...complex];
}

/**
 * Solve cubic equation ax^3 + bx^2 + cx + d = 0.
 */
export function solveCubic(aRaw, bRaw, cRaw, dRaw, setup) {
  const a = toRational(aRaw);
  const b = toRational(bRaw);
  const c = toRational(cRaw);
  const d = toRational(dRaw);

  if (a.isZero()) throw new CalcError(ERRORS.MATH);

  const coeffs = [a, b, c, d];
  const r1 = findRationalRoot(coeffs);
  let roots = [];

  if (r1 !== null) {
    const qCoeffs = deflatePoly(coeffs, r1);
    const qRes = solveQuadratic(qCoeffs[0], qCoeffs[1], qCoeffs[2], { eqComplex: true });
    roots = [ExactValue.fromRational(r1.n, r1.d), ...qRes.roots];
  } else {
    // Durand-Kerner fallback
    const numericCoeffs = [a, b, c, d].map((x) => Number(x.n) / Number(x.d));
    const dRoots = durandKerner(numericCoeffs);
    for (const dr of dRoots) {
      if (dr.im === 0) {
        roots.push(ExactValue.fromDecimal(Decimal15.fromString(dr.re.toFixed(10))));
      } else {
        const re = ExactValue.fromDecimal(Decimal15.fromString(dr.re.toFixed(10)));
        const im = ExactValue.fromDecimal(Decimal15.fromString(dr.im.toFixed(10)));
        roots.push(new ComplexValue(re, im));
      }
    }
  }

  // Filter if eqComplex is false
  if (!setup.eqComplex) {
    roots = roots.filter((r) => !(r instanceof ComplexValue));
  }

  roots = sortRoots(roots);
  return {
    roots,
    hasRealRoots: roots.length > 0
  };
}

/**
 * Solve quartic equation ax^4 + bx^3 + cx^2 + dx + e = 0.
 */
export function solveQuartic(aRaw, bRaw, cRaw, dRaw, eRaw, setup) {
  const a = toRational(aRaw);
  const b = toRational(bRaw);
  const c = toRational(cRaw);
  const d = toRational(dRaw);
  const e = toRational(eRaw);

  if (a.isZero()) throw new CalcError(ERRORS.MATH);

  let coeffs = [a, b, c, d, e];
  const exactRoots = [];

  // Find 1st rational root
  const r1 = findRationalRoot(coeffs);
  if (r1 !== null) {
    exactRoots.push(ExactValue.fromRational(r1.n, r1.d));
    coeffs = deflatePoly(coeffs, r1);

    // Find 2nd rational root
    const r2 = findRationalRoot(coeffs);
    if (r2 !== null) {
      exactRoots.push(ExactValue.fromRational(r2.n, r2.d));
      coeffs = deflatePoly(coeffs, r2);

      // Solve remaining quadratic
      const qRes = solveQuadratic(coeffs[0], coeffs[1], coeffs[2], { eqComplex: true });
      exactRoots.push(...qRes.roots);
    } else {
      // Solve remaining cubic
      const cRes = solveCubic(coeffs[0], coeffs[1], coeffs[2], coeffs[3], { eqComplex: true });
      exactRoots.push(...cRes.roots);
    }
  } else {
    // Durand-Kerner
    const numericCoeffs = [a, b, c, d, e].map((x) => Number(x.n) / Number(x.d));
    const dRoots = durandKerner(numericCoeffs);
    for (const dr of dRoots) {
      if (dr.im === 0) {
        exactRoots.push(ExactValue.fromDecimal(Decimal15.fromString(dr.re.toFixed(10))));
      } else {
        const re = ExactValue.fromDecimal(Decimal15.fromString(dr.re.toFixed(10)));
        const im = ExactValue.fromDecimal(Decimal15.fromString(dr.im.toFixed(10)));
        exactRoots.push(new ComplexValue(re, im));
      }
    }
  }

  let roots = exactRoots;
  if (!setup.eqComplex) {
    roots = roots.filter((r) => !(r instanceof ComplexValue));
  }

  roots = sortRoots(roots);
  return {
    roots,
    hasRealRoots: roots.length > 0
  };
}

/**
 * Master polynomial solver dispatcher.
 */
export function solvePolynomial(coeffs, degree, setup) {
  if (degree === 2) {
    return solveQuadratic(coeffs[0], coeffs[1], coeffs[2], setup);
  }
  if (degree === 3) {
    return solveCubic(coeffs[0], coeffs[1], coeffs[2], coeffs[3], setup);
  }
  if (degree === 4) {
    return solveQuartic(coeffs[0], coeffs[1], coeffs[2], coeffs[3], coeffs[4], setup);
  }
  throw new Error(`Unsupported polynomial degree: ${degree}`);
}
