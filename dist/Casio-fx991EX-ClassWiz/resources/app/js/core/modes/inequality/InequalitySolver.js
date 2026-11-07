/**
 * Casio fx-991EX ClassWiz Inequality Solver
 *
 * Solves polynomial inequalities of degree 2, 3, and 4:
 *   Type 1: P(x) > 0
 *   Type 2: P(x) < 0
 *   Type 3: P(x) ≥ 0
 *   Type 4: P(x) ≤ 0
 *
 * Displays exact results (fractions, surds) in MathI/MathO where the real calculator
 * does, and decimal results via S<=>D or in Line/Decimal settings.
 */

import { Rational } from '../../exact/Rational.js';
import { SurdForm, extractSquare } from '../../exact/SurdForm.js';
import { Decimal15 } from '../../number/Decimal15.js';
import { formatNumber } from '../../format/formatNumber.js';
import { formatOptions } from '../../setup.js';
import { CalcError, ERRORS } from '../../errors.js';
import { surdTree, rationalTree, treeToText, txt, MINUS } from '../../format/display.js';

function isBigIntSquare(n) {
  if (n < 0n) return false;
  if (n === 0n || n === 1n) return true;
  let x0 = n / 2n;
  if (x0 === 0n) return true;
  let x1 = (x0 + n / x0) / 2n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + n / x0) / 2n;
  }
  return x0 * x0 === n;
}

function bigIntSqrt(n) {
  if (n === 0n) return 0n;
  if (n === 1n) return 1n;
  let x0 = n / 2n;
  if (x0 === 0n) return 1n;
  let x1 = (x0 + n / x0) / 2n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + n / x0) / 2n;
  }
  return x0;
}

/** Convert raw coefficient to Rational */
export function toRationalCoeff(v) {
  if (v instanceof Rational) return v;
  if (typeof v === 'bigint') return new Rational(v, 1n);
  if (v instanceof Decimal15) return v.toRational();
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new CalcError(ERRORS.MATH);
    return Rational.from(v);
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return new Rational(0n, 1n);
    if (s.includes('/')) {
      const [num, den] = s.split('/');
      return new Rational(BigInt(num), BigInt(den));
    }
    const n = Number(s);
    if (!Number.isFinite(n)) throw new CalcError(ERRORS.MATH);
    return Rational.from(n);
  }
  return new Rational(0n, 1n);
}

/** Root item structure holding exact value, decimal value, and helper methods */
export class RootItem {
  constructor(exact, numVal) {
    this.exact = exact; // Rational | SurdForm | number
    this.numVal = numVal !== undefined ? numVal : (
      exact instanceof Rational || exact instanceof SurdForm
        ? exact.toDecimal15().toNumber()
        : Number(exact)
    );
  }

  toExactTree() {
    if (this.exact instanceof Rational) {
      if (this.exact.d === 1n) {
        const s = this.exact.n < 0n ? `${MINUS}${-this.exact.n}` : `${this.exact.n}`;
        return [txt(s)];
      }
      return rationalTree(this.exact, false, false);
    }
    if (this.exact instanceof SurdForm) {
      return surdTree(this.exact);
    }
    const dec = Decimal15.from(this.numVal);
    const s = formatNumber(dec, { format: { type: 'NORM', value: 1 } }).fullString.replace(/^-/, MINUS);
    return [txt(s)];
  }

  toExactText() {
    if (this.exact instanceof Rational) {
      if (this.exact.d === 1n) {
        return this.exact.n < 0n ? `${MINUS}${-this.exact.n}` : `${this.exact.n}`;
      }
      const s = treeToText(rationalTree(this.exact, false, false));
      return s.replace(/^-/, MINUS);
    }
    if (this.exact instanceof SurdForm) {
      return treeToText(surdTree(this.exact));
    }
    const dec = Decimal15.from(this.numVal);
    return formatNumber(dec, { format: { type: 'NORM', value: 1 } }).fullString.replace(/^-/, MINUS);
  }

  toDecimalText(setup) {
    const dec = Decimal15.from(this.numVal);
    return formatNumber(dec, formatOptions(setup)).fullString.replace(/^-/, MINUS);
  }
}

/**
 * Solve a quadratic polynomial: a*x^2 + b*x + c = 0
 * Returns array of RootItems (sorted)
 */
function solveQuadratic(a, b, c) {
  if (a.isZero()) throw new CalcError(ERRORS.MATH);

  // D = b^2 - 4ac
  const b2 = b.mul(b);
  const ac4 = a.mul(c).mul(new Rational(4n, 1n));
  const D = b2.sub(ac4);

  if (D.n < 0n) {
    // No real roots
    return [];
  }

  if (D.isZero()) {
    // Single root with multiplicity 2
    const r = b.neg().div(a.mul(new Rational(2n, 1n)));
    return [new RootItem(r), new RootItem(r)];
  }

  // D > 0
  if (isBigIntSquare(D.n) && isBigIntSquare(D.d)) {
    // Rational square root
    const sqrtD = new Rational(bigIntSqrt(D.n), bigIntSqrt(D.d));
    const twoA = a.mul(new Rational(2n, 1n));
    const r1 = b.neg().sub(sqrtD).div(twoA);
    const r2 = b.neg().add(sqrtD).div(twoA);
    const items = [new RootItem(r1), new RootItem(r2)];
    items.sort((x, y) => x.numVal - y.numVal);
    return items;
  }

  // Surd square root
  // D = N / D.d = (N * D.d) / (D.d)^2
  const N = D.n * D.d;
  const [k, m] = extractSquare(N); // N = k^2 * m
  // sqrt(D) = (k / D.d) * sqrt(m)
  const twoA = a.mul(new Rational(2n, 1n));
  const c0 = b.neg().div(twoA);
  const coeffRad = new Rational(k, D.d).div(twoA.abs()); // positive coefficient for sqrt(m)

  const sf1 = new SurdForm(c0, [{ radicand: m, coeff: coeffRad.neg() }]);
  const sf2 = new SurdForm(c0, [{ radicand: m, coeff: coeffRad }]);

  const root1 = new RootItem(sf1);
  const root2 = new RootItem(sf2);
  const items = [root1, root2];
  items.sort((x, y) => x.numVal - y.numVal);
  return items;
}

/**
 * Solve a cubic polynomial: a*x^3 + b*x^2 + c*x + d = 0
 * Returns array of real RootItems (sorted)
 */
function solveCubic(a, b, c, d) {
  if (a.isZero()) throw new CalcError(ERRORS.MATH);

  // If d is zero, x = 0 is a rational root
  if (d.isZero()) {
    const quadRoots = solveQuadratic(a, b, c);
    const zeroRoot = new RootItem(new Rational(0n, 1n));
    const all = [zeroRoot, ...quadRoots];
    all.sort((x, y) => x.numVal - y.numVal);
    return all;
  }

  // Search for rational roots using Rational Root Theorem
  // Bring a, b, c, d to common integer coefficients
  let L = a.d;
  L = Rational.lcm(L, b.d);
  L = Rational.lcm(L, c.d);
  L = Rational.lcm(L, d.d);

  const A = a.n * (L / a.d);
  const B = b.n * (L / b.d);
  const C = c.n * (L / c.d);
  const D = d.n * (L / d.d);

  function getDivisors(n) {
    const absN = n < 0n ? -n : n;
    const divs = [];
    for (let i = 1n; i * i <= absN; i++) {
      if (absN % i === 0n) {
        divs.push(i);
        if (i * i !== absN) divs.push(absN / i);
      }
    }
    return divs;
  }

  const pDivs = getDivisors(D);
  const qDivs = getDivisors(A);

  let rationalRoot = null;
  for (const q of qDivs) {
    for (const p of pDivs) {
      for (const sign of [1n, -1n]) {
        const pSigned = sign * p;
        // Check A*(p/q)^3 + B*(p/q)^2 + C*(p/q) + D == 0
        // Multiply by q^3: A*p^3 + B*p^2*q + C*p*q^2 + D*q^3 == 0
        const val = A * pSigned * pSigned * pSigned +
                    B * pSigned * pSigned * q +
                    C * pSigned * q * q +
                    D * q * q * q;
        if (val === 0n) {
          rationalRoot = new Rational(pSigned, q);
          break;
        }
      }
      if (rationalRoot) break;
    }
    if (rationalRoot) break;
  }

  if (rationalRoot) {
    // Synthetic division of (a*x^3 + b*x^2 + c*x + d) by (x - r)
    // Quotient is A_q*x^2 + B_q*x + C_q
    const A_q = a;
    const B_q = b.add(A_q.mul(rationalRoot));
    const C_q = c.add(B_q.mul(rationalRoot));

    const quadRoots = solveQuadratic(A_q, B_q, C_q);
    const all = [new RootItem(rationalRoot), ...quadRoots];
    all.sort((x, y) => x.numVal - y.numVal);
    return all;
  }

  // No rational roots: find real roots numerically
  return solvePolynomialNumerical([d.toNumber(), c.toNumber(), b.toNumber(), a.toNumber()]);
}

/**
 * Solve a quartic polynomial: a*x^4 + b*x^3 + c*x^2 + d*x + e = 0
 * Returns array of real RootItems (sorted)
 */
function solveQuartic(a, b, c, d, e) {
  if (a.isZero()) throw new CalcError(ERRORS.MATH);

  // If e is zero, x = 0 is a rational root
  if (e.isZero()) {
    const cubicRoots = solveCubic(a, b, c, d);
    const zeroRoot = new RootItem(new Rational(0n, 1n));
    const all = [zeroRoot, ...cubicRoots];
    all.sort((x, y) => x.numVal - y.numVal);
    return all;
  }

  // Biquadratic case: b == 0 and d == 0: a*u^2 + c*u + e = 0 with u = x^2
  if (b.isZero() && d.isZero()) {
    const quadRoots = solveQuadratic(a, c, e);
    const roots = [];
    for (const r of quadRoots) {
      if (r.numVal < -1e-12) continue; // no real roots
      if (Math.abs(r.numVal) < 1e-12) {
        roots.push(new RootItem(new Rational(0n, 1n)));
        continue;
      }
      // r.numVal > 0
      if (r.exact instanceof Rational && isBigIntSquare(r.exact.n) && isBigIntSquare(r.exact.d)) {
        const sq = new Rational(bigIntSqrt(r.exact.n), bigIntSqrt(r.exact.d));
        roots.push(new RootItem(sq.neg()));
        roots.push(new RootItem(sq));
      } else if (r.exact instanceof Rational) {
        const N = r.exact.n * r.exact.d;
        const [k, m] = extractSquare(N);
        const coeffRad = new Rational(k, r.exact.d);
        const sfPos = new SurdForm(0n, [{ radicand: m, coeff: coeffRad }]);
        const sfNeg = new SurdForm(0n, [{ radicand: m, coeff: coeffRad.neg() }]);
        roots.push(new RootItem(sfNeg));
        roots.push(new RootItem(sfPos));
      } else {
        const s = Math.sqrt(r.numVal);
        roots.push(new RootItem(null, -s));
        roots.push(new RootItem(null, s));
      }
    }
    roots.sort((x, y) => x.numVal - y.numVal);
    return roots;
  }

  // Rational Root Theorem search
  let L = a.d;
  L = Rational.lcm(L, b.d);
  L = Rational.lcm(L, c.d);
  L = Rational.lcm(L, d.d);
  L = Rational.lcm(L, e.d);

  const A = a.n * (L / a.d);
  const B = b.n * (L / b.d);
  const C = c.n * (L / c.d);
  const D = d.n * (L / d.d);
  const E = e.n * (L / e.d);

  function getDivisors(n) {
    const absN = n < 0n ? -n : n;
    const divs = [];
    for (let i = 1n; i * i <= absN; i++) {
      if (absN % i === 0n) {
        divs.push(i);
        if (i * i !== absN) divs.push(absN / i);
      }
    }
    return divs;
  }

  const pDivs = getDivisors(E);
  const qDivs = getDivisors(A);

  let rationalRoot = null;
  for (const q of qDivs) {
    for (const p of pDivs) {
      for (const sign of [1n, -1n]) {
        const pSigned = sign * p;
        const val = A * (pSigned ** 4n) +
                    B * (pSigned ** 3n) * q +
                    C * (pSigned ** 2n) * (q ** 2n) +
                    D * pSigned * (q ** 3n) +
                    E * (q ** 4n);
        if (val === 0n) {
          rationalRoot = new Rational(pSigned, q);
          break;
        }
      }
      if (rationalRoot) break;
    }
    if (rationalRoot) break;
  }

  if (rationalRoot) {
    // Synthetic division of quartic by (x - r) to get cubic
    const A_c = a;
    const B_c = b.add(A_c.mul(rationalRoot));
    const C_c = c.add(B_c.mul(rationalRoot));
    const D_c = d.add(C_c.mul(rationalRoot));

    const cubicRoots = solveCubic(A_c, B_c, C_c, D_c);
    const all = [new RootItem(rationalRoot), ...cubicRoots];
    all.sort((x, y) => x.numVal - y.numVal);
    return all;
  }

  // Numerical solve
  return solvePolynomialNumerical([e.toNumber(), d.toNumber(), c.toNumber(), b.toNumber(), a.toNumber()]);
}

/** Numerical polynomial root finding using companion matrix / bisection */
function solvePolynomialNumerical(coeffs) {
  // coeffs: [c0, c1, ..., cn] where cn != 0
  const n = coeffs.length - 1;
  const a_n = coeffs[n];
  const monic = coeffs.slice(0, n).map(c => c / a_n);

  // Evaluate polynomial P(x)
  const evalP = (x) => {
    let res = coeffs[n];
    for (let i = n - 1; i >= 0; i--) {
      res = res * x + coeffs[i];
    }
    return res;
  };

  // Evaluate derivative P'(x)
  const evalDeriv = (x) => {
    let res = n * coeffs[n];
    for (let i = n - 1; i >= 1; i--) {
      res = res * x + i * coeffs[i];
    }
    return res;
  };

  // Find bound on real roots (Cauchy bound)
  let maxCoeff = 0;
  for (let i = 0; i < n; i++) {
    maxCoeff = Math.max(maxCoeff, Math.abs(monic[i]));
  }
  const bound = 1 + maxCoeff;

  // Find critical points (roots of derivative)
  let criticalPoints = [];
  if (n === 2) {
    criticalPoints = [-coeffs[1] / (2 * coeffs[2])];
  } else if (n === 3) {
    // derivative is quadratic
    const aD = new Rational(Math.round(3 * coeffs[3] * 1e6), 1000000n);
    const bD = new Rational(Math.round(2 * coeffs[2] * 1e6), 1000000n);
    const cD = new Rational(Math.round(coeffs[1] * 1e6), 1000000n);
    try {
      const qRoots = solveQuadratic(aD, bD, cD);
      criticalPoints = qRoots.map(r => r.numVal);
    } catch {
      criticalPoints = [];
    }
  } else if (n === 4) {
    // derivative is cubic
    const aD = new Rational(Math.round(4 * coeffs[4] * 1e6), 1000000n);
    const bD = new Rational(Math.round(3 * coeffs[3] * 1e6), 1000000n);
    const cD = new Rational(Math.round(2 * coeffs[2] * 1e6), 1000000n);
    const dD = new Rational(Math.round(coeffs[1] * 1e6), 1000000n);
    try {
      const cRoots = solveCubic(aD, bD, cD, dD);
      criticalPoints = cRoots.map(r => r.numVal);
    } catch {
      criticalPoints = [];
    }
  }

  // Filter and sort critical points in [-bound, bound]
  const validCP = [-bound, ...criticalPoints.filter(cp => cp > -bound && cp < bound).sort((x, y) => x - y), bound];

  // In each monotonic interval [x0, x1], check for root
  const roots = [];
  for (let i = 0; i < validCP.length - 1; i++) {
    let x0 = validCP[i];
    let x1 = validCP[i + 1];
    let y0 = evalP(x0);
    let y1 = evalP(x1);

    if (Math.abs(y0) < 1e-12) {
      if (!roots.some(r => Math.abs(r - x0) < 1e-6)) roots.push(x0);
    }
    if (Math.abs(y1) < 1e-12) {
      if (!roots.some(r => Math.abs(r - x1) < 1e-6)) roots.push(x1);
    }

    if (y0 * y1 < 0) {
      // Root exists in (x0, x1) by IVT
      // Bisection to isolate
      let a = x0, b = x1;
      for (let step = 0; step < 60; step++) {
        const mid = (a + b) / 2;
        const ym = evalP(mid);
        if (Math.abs(ym) < 1e-15 || (b - a) < 1e-15) {
          a = mid;
          break;
        }
        if (y0 * ym < 0) {
          b = mid;
        } else {
          a = mid;
          y0 = ym;
        }
      }
      // Refine with Newton-Raphson
      let r = a;
      for (let step = 0; step < 10; step++) {
        const f = evalP(r);
        const df = evalDeriv(r);
        if (Math.abs(df) < 1e-14) break;
        const next = r - f / df;
        if (Math.abs(next - r) < 1e-15) break;
        r = next;
      }
      if (!roots.some(existing => Math.abs(existing - r) < 1e-6)) {
        roots.push(r);
      }
    }
  }

  roots.sort((a, b) => a - b);
  return roots.map(r => new RootItem(null, r));
}

/**
 * Solve polynomial inequality:
 * degree: 2 | 3 | 4
 * type: 1 (>0) | 2 (<0) | 3 (≥0) | 4 (≤0)
 * rawCoeffs: array of raw values [a, b, c, ...]
 * setup: calculator setup object
 */
export function solvePolynomialInequality(degree, type, rawCoeffs, setup) {
  const coeffs = rawCoeffs.slice(0, degree + 1).map(toRationalCoeff);
  const a = coeffs[0];

  if (a.isZero()) {
    throw new CalcError(ERRORS.MATH);
  }

  // Find all real roots
  let allRoots = [];
  if (degree === 2) {
    allRoots = solveQuadratic(coeffs[0], coeffs[1], coeffs[2]);
  } else if (degree === 3) {
    allRoots = solveCubic(coeffs[0], coeffs[1], coeffs[2], coeffs[3]);
  } else if (degree === 4) {
    allRoots = solveQuartic(coeffs[0], coeffs[1], coeffs[2], coeffs[3], coeffs[4]);
  }

  // Deduplicate roots for interval partitioning
  const uniqueRoots = [];
  for (const r of allRoots) {
    const existing = uniqueRoots.find(u => Math.abs(u.numVal - r.numVal) < 1e-9);
    if (!existing) {
      uniqueRoots.push(r);
    }
  }
  uniqueRoots.sort((x, y) => x.numVal - y.numVal);

  const k = uniqueRoots.length;

  // Evaluate polynomial at any real number x
  function evalPoly(x) {
    let sum = coeffs[0].toNumber();
    for (let i = 1; i <= degree; i++) {
      sum = sum * x + coeffs[i].toNumber();
    }
    return sum;
  }

  function satisfies(val) {
    if (type === 1) return val > 0;
    if (type === 2) return val < 0;
    if (type === 3) return val >= 0;
    if (type === 4) return val <= 0;
    return false;
  }

  // Test regions:
  // Intervals: I_0 = (-inf, r_0), I_1 = (r_0, r_1), ..., I_k = (r_{k-1}, inf)
  // Boundary points: r_0, r_1, ..., r_{k-1}
  if (k === 0) {
    // No real roots: sign of P(x) is constant everywhere
    const sample = evalPoly(0);
    if (satisfies(sample)) {
      return {
        special: 'ALL',
        text: 'All Real Numbers',
        decimalText: 'All Real Numbers',
        tree: [txt('All Real Numbers')],
        decimalTree: [txt('All Real Numbers')]
      };
    }
    return {
      special: 'NONE',
      text: 'No Solution',
      decimalText: 'No Solution',
      tree: [txt('No Solution')],
      decimalTree: [txt('No Solution')]
    };
  }

  const intSatisfies = [];
  for (let j = 0; j <= k; j++) {
    let testX;
    if (j === 0) testX = uniqueRoots[0].numVal - 1;
    else if (j === k) testX = uniqueRoots[k - 1].numVal + 1;
    else testX = (uniqueRoots[j - 1].numVal + uniqueRoots[j].numVal) / 2;
    intSatisfies.push(satisfies(evalPoly(testX)));
  }

  const ptSatisfies = [];
  for (let i = 0; i < k; i++) {
    // At root, P(r_i) = 0
    ptSatisfies.push(satisfies(0));
  }

  // Check if ALL regions and points are satisfied
  if (intSatisfies.every(Boolean) && ptSatisfies.every(Boolean)) {
    return {
      special: 'ALL',
      text: 'All Real Numbers',
      decimalText: 'All Real Numbers',
      tree: [txt('All Real Numbers')],
      decimalTree: [txt('All Real Numbers')]
    };
  }

  // Check if NO regions or points are satisfied
  if (intSatisfies.every(b => !b) && ptSatisfies.every(b => !b)) {
    return {
      special: 'NONE',
      text: 'No Solution',
      decimalText: 'No Solution',
      tree: [txt('No Solution')],
      decimalTree: [txt('No Solution')]
    };
  }

  // Extract connected components of satisfied subset
  // Regions: [I_0, pt_0, I_1, pt_1, ..., I_k]
  const components = [];
  let inComponent = false;
  let compStart = null; // { type: 'inf' | 'open' | 'closed', rootIdx }
  let lastSatisfied = null;

  // Step through sequence: 0: I_0, 1: pt_0, 2: I_1, 3: pt_1, ..., 2k: I_k
  const totalSteps = 2 * k + 1;
  for (let step = 0; step < totalSteps; step++) {
    const isInterval = (step % 2 === 0);
    const idx = Math.floor(step / 2);
    const sat = isInterval ? intSatisfies[idx] : ptSatisfies[idx];

    if (sat) {
      if (!inComponent) {
        inComponent = true;
        if (isInterval && idx === 0) {
          compStart = { type: 'inf' };
        } else if (isInterval) {
          compStart = { type: 'open', rootIdx: idx - 1 };
        } else {
          compStart = { type: 'closed', rootIdx: idx };
        }
      }
      lastSatisfied = { isInterval, idx };
    } else {
      if (inComponent) {
        // Close component ending at lastSatisfied
        components.push(buildComponent(compStart, lastSatisfied, uniqueRoots));
        inComponent = false;
        compStart = null;
      }
    }
  }

  if (inComponent) {
    components.push(buildComponent(compStart, lastSatisfied, uniqueRoots));
  }

  // Format components
  const sym = (type === 1 || type === 2) ? '<' : '≤';

  function formatCompText(comp, isDecimal) {
    const getRoot = (idx) => isDecimal ? uniqueRoots[idx].toDecimalText(setup) : uniqueRoots[idx].toExactText();

    if (comp.kind === 'point') {
      return `x=${getRoot(comp.rootIdx)}`;
    }
    if (comp.kind === 'ray_left') {
      return `x${comp.closed ? '≤' : '<'}${getRoot(comp.rootIdx)}`;
    }
    if (comp.kind === 'ray_right') {
      return `${getRoot(comp.rootIdx)}${comp.closed ? '≤' : '<'}x`;
    }
    if (comp.kind === 'bounded') {
      const leftSym = comp.closedLeft ? '≤' : '<';
      const rightSym = comp.closedRight ? '≤' : '<';
      return `${getRoot(comp.leftIdx)}${leftSym}x${rightSym}${getRoot(comp.rightIdx)}`;
    }
    return '';
  }

  function formatCompTree(comp, isDecimal) {
    const getRootTree = (idx) => isDecimal ? [txt(uniqueRoots[idx].toDecimalText(setup))] : uniqueRoots[idx].toExactTree();

    if (comp.kind === 'point') {
      return [txt('x='), ...getRootTree(comp.rootIdx)];
    }
    if (comp.kind === 'ray_left') {
      return [txt(`x${comp.closed ? '≤' : '<'}`), ...getRootTree(comp.rootIdx)];
    }
    if (comp.kind === 'ray_right') {
      return [...getRootTree(comp.rootIdx), txt(`${comp.closed ? '≤' : '<'}x`)];
    }
    if (comp.kind === 'bounded') {
      const leftSym = comp.closedLeft ? '≤' : '<';
      const rightSym = comp.closedRight ? '≤' : '<';
      return [
        ...getRootTree(comp.leftIdx),
        txt(`${leftSym}x${rightSym}`),
        ...getRootTree(comp.rightIdx)
      ];
    }
    return [];
  }

  const exactText = components.map(c => formatCompText(c, false)).join(', ');
  const decimalText = components.map(c => formatCompText(c, true)).join(', ');

  const exactTree = [];
  components.forEach((c, i) => {
    if (i > 0) exactTree.push(txt(', '));
    exactTree.push(...formatCompTree(c, false));
  });

  const decimalTree = [];
  components.forEach((c, i) => {
    if (i > 0) decimalTree.push(txt(', '));
    decimalTree.push(...formatCompTree(c, true));
  });

  return {
    special: 'INTERVALS',
    text: exactText,
    decimalText: decimalText,
    tree: exactTree,
    decimalTree: decimalTree,
    components
  };
}

function buildComponent(start, end, uniqueRoots) {
  if (start.type === 'inf') {
    if (end.isInterval && end.idx === uniqueRoots.length) {
      return { kind: 'all' };
    }
    if (end.isInterval) {
      return { kind: 'ray_left', closed: false, rootIdx: end.idx };
    }
    return { kind: 'ray_left', closed: true, rootIdx: end.idx };
  }

  if (end.isInterval && end.idx === uniqueRoots.length) {
    return {
      kind: 'ray_right',
      closed: start.type === 'closed',
      rootIdx: start.rootIdx
    };
  }

  if (start.type === 'closed' && !end.isInterval && start.rootIdx === end.idx) {
    return { kind: 'point', rootIdx: start.rootIdx };
  }

  const leftIdx = start.rootIdx;
  const rightIdx = end.isInterval ? end.idx : end.idx;
  return {
    kind: 'bounded',
    leftIdx,
    rightIdx,
    closedLeft: start.type === 'closed',
    closedRight: !end.isInterval
  };
}
