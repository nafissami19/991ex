/**
 * Mathematical model and dataset storage for Mode 6: Statistics.
 */

import { CalcError, ERRORS } from '../../errors.js';
import { Decimal15 } from '../../number/Decimal15.js';

export const STAT_TYPES = {
  ONE_VAR: 1,
  LINEAR: 2,
  QUADRATIC: 3,
  LOG: 4,
  EXP_E: 5,
  EXP_AB: 6,
  POWER: 7,
  INVERSE: 8
};

export const TYPE_NAMES = {
  1: '1-Variable',
  2: 'y=a+bx',
  3: 'y=a+bx+cx²',
  4: 'y=a+b•ln(x)',
  5: 'y=a•e^(bx)',
  6: 'y=a•b^x',
  7: 'y=a•x^b',
  8: 'y=a+b/x'
};

/**
 * Standard Normal Cumulative Distribution Function Φ(x).
 * Accurate to > 15 decimal digits.
 */
export function normalCdf(x) {
  if (x === 0) return 0.5;
  const z = x / Math.SQRT2;
  const absZ = Math.abs(z);

  if (absZ > 9) {
    return x > 0 ? 1 : 0;
  }

  let erf;
  if (absZ < 2.5) {
    // Taylor series around 0
    let sum = 0, term = absZ, n = 0, z2 = absZ * absZ;
    while (n < 120) {
      sum += term;
      n++;
      term = -term * z2 * (2 * n - 1) / (n * (2 * n + 1));
      if (Math.abs(term) < 1e-18) break;
    }
    erf = (2 / Math.sqrt(Math.PI)) * sum;
  } else {
    // Continued fraction for erfc
    let a0 = 0, b0 = 1, a1 = 1, b1 = absZ;
    for (let n = 1; n <= 80; n++) {
      const c = n / 2;
      const a2 = absZ * a1 + c * a0;
      const b2 = absZ * b1 + c * b0;
      a0 = a1 / b2; b0 = b1 / b2;
      a1 = a2 / b2; b1 = 1;
      if (Math.abs(a1 - a0) < 1e-18) break;
    }
    const erfc = (Math.exp(-absZ * absZ) / Math.sqrt(Math.PI)) * a1;
    erf = 1 - erfc;
  }

  return 0.5 * (1 + (x < 0 ? -erf : erf));
}

function clean(v) {
  if (v === null || v === undefined) return v;
  if (Math.abs(v) < 1e-12) return 0;
  const r = Math.round(v);
  if (Math.abs(v - r) < 1e-12) return r;
  return v;
}

export class StatModel {
  constructor() {
    this.type = STAT_TYPES.ONE_VAR;
    this.freqEnabled = false;
    this.rows = []; // [{ x: number, y: number, freq: number }]
  }

  setType(t) {
    const wasPaired = this.isPaired();
    this.type = t;
    const nowPaired = this.isPaired();
    if (wasPaired !== nowPaired) {
      this.clear();
    }
  }

  setFreq(enabled) {
    if (this.freqEnabled !== enabled) {
      this.freqEnabled = enabled;
      this.clear();
    }
  }

  isPaired() {
    return this.type >= STAT_TYPES.LINEAR;
  }

  maxRows() {
    if (!this.isPaired()) {
      return this.freqEnabled ? 80 : 160;
    } else {
      return this.freqEnabled ? 53 : 80;
    }
  }

  clear() {
    this.rows = [];
  }

  rowCount() {
    return this.rows.length;
  }

  insertRow(index, row) {
    if (this.rows.length >= this.maxRows()) {
      throw new CalcError(ERRORS.MEMORY);
    }
    const r = {
      x: row.x !== undefined ? Number(row.x) : 0,
      y: row.y !== undefined ? Number(row.y) : 0,
      freq: row.freq !== undefined ? Number(row.freq) : 1
    };
    if (index >= 0 && index <= this.rows.length) {
      this.rows.splice(index, 0, r);
    } else {
      this.rows.push(r);
    }
  }

  deleteRow(index) {
    if (index >= 0 && index < this.rows.length) {
      this.rows.splice(index, 1);
    }
  }

  setCell(rowIdx, colName, value) {
    const val = Number(value);
    if (!Number.isFinite(val)) throw new CalcError(ERRORS.MATH);

    while (this.rows.length <= rowIdx) {
      if (this.rows.length >= this.maxRows()) {
        throw new CalcError(ERRORS.MEMORY);
      }
      this.rows.push({ x: 0, y: 0, freq: 1 });
    }

    if (colName === 'x') this.rows[rowIdx].x = val;
    else if (colName === 'y') this.rows[rowIdx].y = val;
    else if (colName === 'freq') {
      if (val < 0) throw new CalcError(ERRORS.MATH);
      this.rows[rowIdx].freq = val;
    }
  }

  // ---------------------------------------------------------------- Calculations

  getActiveRows() {
    return this.rows.filter(r => (this.freqEnabled ? r.freq > 0 : true));
  }

  calc1Var() {
    const rows = this.getActiveRows();
    if (rows.length === 0) throw new CalcError(ERRORS.MATH);

    let n = 0;
    let sumX = 0;
    let sumX2 = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    const expanded = [];

    for (const r of rows) {
      const f = this.freqEnabled ? r.freq : 1;
      if (f <= 0) continue;
      n += f;
      sumX += f * r.x;
      sumX2 += f * r.x * r.x;
      if (r.x < minX) minX = r.x;
      if (r.x > maxX) maxX = r.x;
      for (let i = 0; i < f; i++) expanded.push(r.x);
    }

    if (n === 0) throw new CalcError(ERRORS.MATH);

    const meanX = sumX / n;
    const ssX = Math.max(0, sumX2 - (sumX * sumX) / n);
    const varPopX = ssX / n;
    const sdPopX = Math.sqrt(varPopX);

    let varSampleX = null;
    let sdSampleX = null;
    if (n >= 2) {
      varSampleX = ssX / (n - 1);
      sdSampleX = Math.sqrt(varSampleX);
    }

    // Quartiles
    expanded.sort((a, b) => a - b);
    let med, q1, q3;
    const totalN = expanded.length;
    const half = Math.floor(totalN / 2);

    if (totalN % 2 === 1) {
      med = expanded[half];
    } else {
      med = (expanded[half - 1] + expanded[half]) / 2;
    }

    const lowerHalf = expanded.slice(0, half);
    const upperHalf = totalN % 2 === 1 ? expanded.slice(half + 1) : expanded.slice(half);

    function medianOf(arr) {
      if (arr.length === 0) return 0;
      const m = Math.floor(arr.length / 2);
      return arr.length % 2 === 1 ? arr[m] : (arr[m - 1] + arr[m]) / 2;
    }

    q1 = medianOf(lowerHalf);
    q3 = medianOf(upperHalf);

    return {
      n,
      meanX,
      sumX,
      sumX2,
      varPopX,
      sdPopX,
      varSampleX,
      sdSampleX,
      minX,
      q1,
      med,
      q3,
      maxX
    };
  }

  calc2Var() {
    const rows = this.getActiveRows();
    if (rows.length === 0) throw new CalcError(ERRORS.MATH);

    let n = 0;
    let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
    let sumY = 0, sumY2 = 0;
    let sumXY = 0, sumX2Y = 0;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const r of rows) {
      const f = this.freqEnabled ? r.freq : 1;
      if (f <= 0) continue;
      const x = r.x;
      const y = r.y;
      n += f;
      sumX += f * x;
      sumX2 += f * x * x;
      sumX3 += f * x * x * x;
      sumX4 += f * x * x * x * x;
      sumY += f * y;
      sumY2 += f * y * y;
      sumXY += f * x * y;
      sumX2Y += f * x * x * y;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    if (n === 0) throw new CalcError(ERRORS.MATH);

    const meanX = sumX / n;
    const ssX = Math.max(0, sumX2 - (sumX * sumX) / n);
    const varPopX = ssX / n;
    const sdPopX = Math.sqrt(varPopX);
    const varSampleX = n >= 2 ? ssX / (n - 1) : null;
    const sdSampleX = varSampleX !== null ? Math.sqrt(varSampleX) : null;

    const meanY = sumY / n;
    const ssY = Math.max(0, sumY2 - (sumY * sumY) / n);
    const varPopY = ssY / n;
    const sdPopY = Math.sqrt(varPopY);
    const varSampleY = n >= 2 ? ssY / (n - 1) : null;
    const sdSampleY = varSampleY !== null ? Math.sqrt(varSampleY) : null;

    return {
      n,
      meanX,
      sumX,
      sumX2,
      varPopX,
      sdPopX,
      varSampleX,
      sdSampleX,
      minX,
      maxX,
      meanY,
      sumY,
      sumY2,
      varPopY,
      sdPopY,
      varSampleY,
      sdSampleY,
      minY,
      maxY,
      sumXY,
      sumX3,
      sumX2Y,
      sumX4
    };
  }

  // ---------------------------------------------------------------- Regressions

  calcRegression() {
    const type = this.type;
    const rows = this.getActiveRows();
    if (rows.length === 0) throw new CalcError(ERRORS.MATH);

    switch (type) {
      case STAT_TYPES.LINEAR: {
        const v = this.calc2Var();
        const ssXX = v.sumX2 - (v.sumX * v.sumX) / v.n;
        const ssYY = v.sumY2 - (v.sumY * v.sumY) / v.n;
        const ssXY = v.sumXY - (v.sumX * v.sumY) / v.n;
        if (ssXX === 0) throw new CalcError(ERRORS.MATH);
        const b = ssXY / ssXX;
        const a = (v.sumY - b * v.sumX) / v.n;
        const rDenom = Math.sqrt(ssXX * ssYY);
        const r = rDenom !== 0 ? ssXY / rDenom : 1;
        return { formula: 'y=a+bx', a: clean(a), b: clean(b), r: clean(r) };
      }

      case STAT_TYPES.QUADRATIC: {
        const v = this.calc2Var();
        const m = [
          [v.n, v.sumX, v.sumX2],
          [v.sumX, v.sumX2, v.sumX3],
          [v.sumX2, v.sumX3, v.sumX4]
        ];
        const k = [v.sumY, v.sumXY, v.sumX2Y];
        const det3 = (a) =>
          a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
          a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
          a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
        const d = det3(m);
        if (Math.abs(d) < 1e-30) throw new CalcError(ERRORS.MATH);
        const rep = (col) => m.map((row, i) => row.map((val, j) => (j === col ? k[i] : val)));
        const a = det3(rep(0)) / d;
        const b = det3(rep(1)) / d;
        const c = det3(rep(2)) / d;
        return { formula: 'y=a+bx+cx²', a: clean(a), b: clean(b), c: clean(c) };
      }

      case STAT_TYPES.LOG: {
        // Transform X = ln(x), Y = y. (x > 0 required)
        let n = 0, sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumXY = 0;
        for (const r of rows) {
          if (r.x <= 0) throw new CalcError(ERRORS.MATH);
          const f = this.freqEnabled ? r.freq : 1;
          const X = Math.log(r.x);
          const Y = r.y;
          n += f;
          sumX += f * X; sumY += f * Y;
          sumX2 += f * X * X; sumY2 += f * Y * Y;
          sumXY += f * X * Y;
        }
        const ssXX = sumX2 - (sumX * sumX) / n;
        const ssYY = sumY2 - (sumY * sumY) / n;
        const ssXY = sumXY - (sumX * sumY) / n;
        if (ssXX === 0) throw new CalcError(ERRORS.MATH);
        const b = ssXY / ssXX;
        const a = (sumY - b * sumX) / n;
        const rDenom = Math.sqrt(ssXX * ssYY);
        const r = rDenom !== 0 ? ssXY / rDenom : 1;
        return { formula: 'y=a+b•ln(x)', a: clean(a), b: clean(b), r: clean(r) };
      }

      case STAT_TYPES.EXP_E: {
        // Transform X = x, Y = ln(y). (y > 0 required)
        let n = 0, sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumXY = 0;
        for (const r of rows) {
          if (r.y <= 0) throw new CalcError(ERRORS.MATH);
          const f = this.freqEnabled ? r.freq : 1;
          const X = r.x;
          const Y = Math.log(r.y);
          n += f;
          sumX += f * X; sumY += f * Y;
          sumX2 += f * X * X; sumY2 += f * Y * Y;
          sumXY += f * X * Y;
        }
        const ssXX = sumX2 - (sumX * sumX) / n;
        const ssYY = sumY2 - (sumY * sumY) / n;
        const ssXY = sumXY - (sumX * sumY) / n;
        if (ssXX === 0) throw new CalcError(ERRORS.MATH);
        const B = ssXY / ssXX;
        const A = (sumY - B * sumX) / n;
        const a = Math.exp(A);
        const b = B;
        const rDenom = Math.sqrt(ssXX * ssYY);
        const r = rDenom !== 0 ? ssXY / rDenom : 1;
        return { formula: 'y=a•e^(bx)', a: clean(a), b: clean(b), r: clean(r) };
      }

      case STAT_TYPES.EXP_AB: {
        // Transform X = x, Y = ln(y). (y > 0 required)
        let n = 0, sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumXY = 0;
        for (const r of rows) {
          if (r.y <= 0) throw new CalcError(ERRORS.MATH);
          const f = this.freqEnabled ? r.freq : 1;
          const X = r.x;
          const Y = Math.log(r.y);
          n += f;
          sumX += f * X; sumY += f * Y;
          sumX2 += f * X * X; sumY2 += f * Y * Y;
          sumXY += f * X * Y;
        }
        const ssXX = sumX2 - (sumX * sumX) / n;
        const ssYY = sumY2 - (sumY * sumY) / n;
        const ssXY = sumXY - (sumX * sumY) / n;
        if (ssXX === 0) throw new CalcError(ERRORS.MATH);
        const B = ssXY / ssXX;
        const A = (sumY - B * sumX) / n;
        const a = Math.exp(A);
        const b = Math.exp(B);
        const rDenom = Math.sqrt(ssXX * ssYY);
        const r = rDenom !== 0 ? ssXY / rDenom : 1;
        return { formula: 'y=a•b^x', a: clean(a), b: clean(b), r: clean(r) };
      }

      case STAT_TYPES.POWER: {
        // Transform X = ln(x), Y = ln(y). (x > 0, y > 0 required)
        let n = 0, sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumXY = 0;
        for (const r of rows) {
          if (r.x <= 0 || r.y <= 0) throw new CalcError(ERRORS.MATH);
          const f = this.freqEnabled ? r.freq : 1;
          const X = Math.log(r.x);
          const Y = Math.log(r.y);
          n += f;
          sumX += f * X; sumY += f * Y;
          sumX2 += f * X * X; sumY2 += f * Y * Y;
          sumXY += f * X * Y;
        }
        const ssXX = sumX2 - (sumX * sumX) / n;
        const ssYY = sumY2 - (sumY * sumY) / n;
        const ssXY = sumXY - (sumX * sumY) / n;
        if (ssXX === 0) throw new CalcError(ERRORS.MATH);
        const B = ssXY / ssXX;
        const A = (sumY - B * sumX) / n;
        const a = Math.exp(A);
        const b = B;
        const rDenom = Math.sqrt(ssXX * ssYY);
        const r = rDenom !== 0 ? ssXY / rDenom : 1;
        return { formula: 'y=a•x^b', a: clean(a), b: clean(b), r: clean(r) };
      }

      case STAT_TYPES.INVERSE: {
        // Transform X = 1/x, Y = y. (x != 0 required)
        let n = 0, sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumXY = 0;
        for (const r of rows) {
          if (r.x === 0) throw new CalcError(ERRORS.MATH);
          const f = this.freqEnabled ? r.freq : 1;
          const X = 1 / r.x;
          const Y = r.y;
          n += f;
          sumX += f * X; sumY += f * Y;
          sumX2 += f * X * X; sumY2 += f * Y * Y;
          sumXY += f * X * Y;
        }
        const ssXX = sumX2 - (sumX * sumX) / n;
        const ssYY = sumY2 - (sumY * sumY) / n;
        const ssXY = sumXY - (sumX * sumY) / n;
        if (ssXX === 0) throw new CalcError(ERRORS.MATH);
        const b = ssXY / ssXX;
        const a = (sumY - b * sumX) / n;
        const rDenom = Math.sqrt(ssXX * ssYY);
        const r = rDenom !== 0 ? ssXY / rDenom : 1;
        return { formula: 'y=a+b/x', a: clean(a), b: clean(b), r: clean(r) };
      }

      default:
        throw new CalcError(ERRORS.SYNTAX);
    }
  }

  // ---------------------------------------------------------------- Estimators

  estimateY(x) {
    const reg = this.calcRegression();
    switch (this.type) {
      case STAT_TYPES.LINEAR:
        return reg.a + reg.b * x;
      case STAT_TYPES.QUADRATIC:
        return reg.a + reg.b * x + reg.c * x * x;
      case STAT_TYPES.LOG:
        if (x <= 0) throw new CalcError(ERRORS.MATH);
        return reg.a + reg.b * Math.log(x);
      case STAT_TYPES.EXP_E:
        return reg.a * Math.exp(reg.b * x);
      case STAT_TYPES.EXP_AB:
        if (reg.b <= 0) throw new CalcError(ERRORS.MATH);
        return reg.a * Math.pow(reg.b, x);
      case STAT_TYPES.POWER:
        if (x <= 0) throw new CalcError(ERRORS.MATH);
        return reg.a * Math.pow(x, reg.b);
      case STAT_TYPES.INVERSE:
        if (x === 0) throw new CalcError(ERRORS.MATH);
        return reg.a + reg.b / x;
      default:
        throw new CalcError(ERRORS.SYNTAX);
    }
  }

  estimateX(y) {
    const reg = this.calcRegression();
    switch (this.type) {
      case STAT_TYPES.LINEAR:
        if (reg.b === 0) throw new CalcError(ERRORS.MATH);
        return (y - reg.a) / reg.b;
      case STAT_TYPES.LOG:
        if (reg.b === 0) throw new CalcError(ERRORS.MATH);
        return Math.exp((y - reg.a) / reg.b);
      case STAT_TYPES.EXP_E:
        if (y <= 0 || reg.a <= 0 || reg.b === 0) throw new CalcError(ERRORS.MATH);
        return Math.log(y / reg.a) / reg.b;
      case STAT_TYPES.EXP_AB:
        if (y <= 0 || reg.a <= 0 || reg.b <= 0 || reg.b === 1) throw new CalcError(ERRORS.MATH);
        return Math.log(y / reg.a) / Math.log(reg.b);
      case STAT_TYPES.POWER:
        if (y <= 0 || reg.a <= 0 || reg.b === 0) throw new CalcError(ERRORS.MATH);
        return Math.exp(Math.log(y / reg.a) / reg.b);
      case STAT_TYPES.INVERSE:
        if (y - reg.a === 0) throw new CalcError(ERRORS.MATH);
        return reg.b / (y - reg.a);
      default:
        throw new CalcError(ERRORS.SYNTAX);
    }
  }

  estimateX1(y) {
    if (this.type !== STAT_TYPES.QUADRATIC) throw new CalcError(ERRORS.SYNTAX);
    const reg = this.calcRegression();
    const D = reg.b * reg.b - 4 * reg.c * (reg.a - y);
    if (D < 0) throw new CalcError(ERRORS.MATH);
    if (reg.c === 0) {
      if (reg.b === 0) throw new CalcError(ERRORS.MATH);
      return (y - reg.a) / reg.b;
    }
    return (-reg.b + Math.sqrt(D)) / (2 * reg.c);
  }

  estimateX2(y) {
    if (this.type !== STAT_TYPES.QUADRATIC) throw new CalcError(ERRORS.SYNTAX);
    const reg = this.calcRegression();
    const D = reg.b * reg.b - 4 * reg.c * (reg.a - y);
    if (D < 0) throw new CalcError(ERRORS.MATH);
    if (reg.c === 0) {
      if (reg.b === 0) throw new CalcError(ERRORS.MATH);
      return (y - reg.a) / reg.b;
    }
    return (-reg.b - Math.sqrt(D)) / (2 * reg.c);
  }

  // ---------------------------------------------------------------- Normal Distribution

  normT(x) {
    const s = this.calc1Var();
    if (s.sdPopX === 0) throw new CalcError(ERRORS.MATH);
    return (x - s.meanX) / s.sdPopX;
  }

  normP(t) {
    return normalCdf(t);
  }

  normQ(t) {
    return normalCdf(t) - 0.5;
  }

  normR(t) {
    return 1 - normalCdf(t);
  }
}
