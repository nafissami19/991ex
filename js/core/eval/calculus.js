/**
 * Numerical calculus in Decimal15 arithmetic.
 *  - integrate: adaptive Gauss–Kronrod (7/15 points), as the User's Guide names.
 *  - differentiate: central differences with Richardson extrapolation.
 *  - summation: exact Σ over integers.
 * f(x) receives an ExactValue and returns an ExactValue.
 */

import { ExactValue } from '../exact/ExactValue.js';
import { Decimal15 } from '../number/Decimal15.js';
import { CalcError, ERRORS } from '../errors.js';

const D = (s) => Decimal15.fromString(String(s));

// QUADPACK qk15 nodes/weights (abscissae in [0,1], symmetric)
const XGK = ['0.991455371120812639', '0.949107912342758525', '0.864864423359769073', '0.741531185599394440',
  '0.586087235467691130', '0.405845151377397167', '0.207784955007898468', '0'].map(D);
const WGK = ['0.022935322010529225', '0.063092092629978553', '0.104790010322250184', '0.140653259715525919',
  '0.169004726639267903', '0.190350578064785410', '0.204432940075298892', '0.209482141084727828'].map(D);
const WG = ['0.129484966168869693', '0.279705391489276668', '0.381830050505118945', '0.417959183673469388'].map(D);

const MAX_INTERVALS = 400;

function dv(x) {
  return new ExactValue('decimal', x, x);
}

function gk15(f, a, b) {
  const c = a.add(b).div(D(2));
  const h = b.sub(a).div(D(2));
  const fc = f(dv(c)).toDecimal15();
  let k = fc.mul(WGK[7]);
  let g = fc.mul(WG[3]);
  for (let j = 0; j < 7; j++) {
    const dx = h.mul(XGK[j]);
    const f1 = f(dv(c.sub(dx))).toDecimal15();
    const f2 = f(dv(c.add(dx))).toDecimal15();
    const s = f1.add(f2);
    k = k.add(s.mul(WGK[j]));
    if (j % 2 === 1) g = g.add(s.mul(WG[(j - 1) / 2]));
  }
  const K = k.mul(h);
  const G = g.mul(h);
  return { value: K, err: K.sub(G).abs() };
}

export function integrate(f, a, b, tol = D('1e-5'), deadline = Infinity) {
  if (a.eq(b)) return Decimal15.ZERO;
  if (a.gt(b)) return integrate(f, b, a, tol, deadline).neg();
  let intervals = [{ a, b, ...gk15(f, a, b) }];
  for (let iter = 0; ; iter++) {
    let total = Decimal15.ZERO;
    let err = Decimal15.ZERO;
    for (const it of intervals) {
      total = total.add(it.value);
      err = err.add(it.err);
    }
    const scale = total.abs().gt(Decimal15.ONE) ? total.abs() : Decimal15.ONE;
    // |K−G| overestimates the 15-point error; aim for ~10 correct digits with the default tol
    const goal = tol.mul(D('1e-4'));
    const floor = D('1e-14');
    if (err.lte((goal.gt(floor) ? goal : floor).mul(scale))) {
      return snap(total, scale);
    }
    if (intervals.length >= MAX_INTERVALS || Date.now() > deadline) throw new CalcError(ERRORS.TIME_OUT);
    // Bisect the interval with the largest error estimate
    let worst = 0;
    for (let i = 1; i < intervals.length; i++) if (intervals[i].err.gt(intervals[worst].err)) worst = i;
    const w = intervals[worst];
    const m = w.a.add(w.b).div(D(2));
    if (m.eq(w.a) || m.eq(w.b)) throw new CalcError(ERRORS.TIME_OUT);
    intervals.splice(worst, 1, { a: w.a, b: m, ...gk15(f, w.a, m) }, { a: m, b: w.b, ...gk15(f, m, w.b) });
  }
}

export function differentiate(f, a, tol = D('1e-10'), deadline = Infinity) {
  const scale = a.abs().gt(Decimal15.ONE) ? a.abs() : Decimal15.ONE;
  let h = scale.mul(D('0.0625'));
  const table = [];
  let prevBest = null;
  for (let i = 0; i < 9; i++) {
    const fp = f(dv(a.add(h))).toDecimal15();
    const fm = f(dv(a.sub(h))).toDecimal15();
    let row = [fp.sub(fm).div(h.mul(D(2)))];
    let p4 = D(4);
    for (let j = 1; j <= i; j++) {
      const r = row[j - 1].add(row[j - 1].sub(table[i - 1][j - 1]).div(p4.sub(Decimal15.ONE)));
      row.push(r);
      p4 = p4.mul(D(4));
    }
    table.push(row);
    const best = row[row.length - 1];
    if (prevBest !== null) {
      const diff = best.sub(prevBest).abs();
      const mag = best.abs().gt(Decimal15.ONE) ? best.abs() : Decimal15.ONE;
      if (diff.lte(tol.mul(mag))) return snap(best, mag);
    }
    prevBest = best;
    if (Date.now() > deadline) throw new CalcError(ERRORS.TIME_OUT);
    h = h.div(D(2));
  }
  throw new CalcError(ERRORS.MATH);
}

function snap(v, mag) {
  if (v.abs().lt(D('1e-11').mul(mag))) return Decimal15.ZERO;
  const nearest = v.abs().add(D('0.5')).trunc();
  const diff = v.abs().sub(nearest).abs();
  if (diff.lt(D('1e-12'))) {
    return v.sign < 0 ? nearest.neg() : nearest;
  }
  return v;
}

export function summation(f, a, b, deadline = Infinity) {
  const lo = a.toDecimal15();
  const hi = b.toDecimal15();
  if (!lo.isInteger() || !hi.isInteger() || lo.gt(hi)) throw new CalcError(ERRORS.MATH);
  const lim = D('1e10');
  if (lo.abs().gte(lim) || hi.abs().gte(lim)) throw new CalcError(ERRORS.MATH);
  let sum = ExactValue.fromInt(0n);
  const end = hi.toBigInt();
  for (let k = lo.toBigInt(), n = 0; k <= end; k++, n++) {
    sum = sum.add(f(ExactValue.fromInt(k)));
    if (n % 256 === 255 && Date.now() > deadline) throw new CalcError(ERRORS.TIME_OUT);
  }
  return sum;
}
