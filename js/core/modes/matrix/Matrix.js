/**
 * Matrix representation for Mode 4: Matrix.
 * Elements are ExactValue instances (preserving fractions, surds, decimals).
 */

import { ExactValue } from '../../exact/ExactValue.js';
import { CalcError, ERRORS } from '../../errors.js';
import { serialize, deserialize } from '../../memory.js';

export class Matrix {
  /**
   * @param {number} rows 1..4
   * @param {number} cols 1..4
   * @param {Array<Array<ExactValue>>} [data]
   */
  constructor(rows, cols, data = null) {
    if (rows < 1 || rows > 4 || cols < 1 || cols > 4) {
      throw new CalcError(ERRORS.DIMENSION);
    }
    this.rows = rows;
    this.cols = cols;
    if (data) {
      this.data = data.map((row) =>
        row.map((v) => (v instanceof ExactValue ? v : ExactValue.fromInt(BigInt(v ?? 0))))
      );
    } else {
      this.data = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ExactValue.fromInt(0n))
      );
    }
  }

  get(r, c) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) {
      throw new CalcError(ERRORS.ARGUMENT);
    }
    return this.data[r][c];
  }

  set(r, c, val) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) {
      throw new CalcError(ERRORS.ARGUMENT);
    }
    this.data[r][c] = val instanceof ExactValue ? val : ExactValue.fromInt(BigInt(val));
  }

  clone() {
    const next = new Matrix(this.rows, this.cols);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        next.data[r][c] = this.data[r][c];
      }
    }
    return next;
  }

  // +
  add(other) {
    if (!(other instanceof Matrix) || this.rows !== other.rows || this.cols !== other.cols) {
      throw new CalcError(ERRORS.DIMENSION);
    }
    const res = new Matrix(this.rows, this.cols);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        res.data[r][c] = this.data[r][c].add(other.data[r][c]);
      }
    }
    return res;
  }

  // -
  sub(other) {
    if (!(other instanceof Matrix) || this.rows !== other.rows || this.cols !== other.cols) {
      throw new CalcError(ERRORS.DIMENSION);
    }
    const res = new Matrix(this.rows, this.cols);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        res.data[r][c] = this.data[r][c].sub(other.data[r][c]);
      }
    }
    return res;
  }

  // Unary -
  neg() {
    const res = new Matrix(this.rows, this.cols);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        res.data[r][c] = this.data[r][c].neg();
      }
    }
    return res;
  }

  // Matrix * Matrix or Matrix * Scalar
  mul(other) {
    if (other instanceof Matrix) {
      if (this.cols !== other.rows) {
        throw new CalcError(ERRORS.DIMENSION);
      }
      const res = new Matrix(this.rows, other.cols);
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < other.cols; c++) {
          let sum = ExactValue.fromInt(0n);
          for (let k = 0; k < this.cols; k++) {
            sum = sum.add(this.data[r][k].mul(other.data[k][c]));
          }
          res.data[r][c] = sum;
        }
      }
      return res;
    }
    if (other instanceof ExactValue) {
      return this.scale(other);
    }
    throw new CalcError(ERRORS.DIMENSION);
  }

  scale(scalar) {
    const s = scalar instanceof ExactValue ? scalar : ExactValue.fromInt(BigInt(scalar));
    const res = new Matrix(this.rows, this.cols);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        res.data[r][c] = this.data[r][c].mul(s);
      }
    }
    return res;
  }

  divScalar(scalar) {
    const s = scalar instanceof ExactValue ? scalar : ExactValue.fromInt(BigInt(scalar));
    if (s.toDecimal15().isZero()) {
      throw new CalcError(ERRORS.MATH);
    }
    const res = new Matrix(this.rows, this.cols);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        res.data[r][c] = this.data[r][c].div(s);
      }
    }
    return res;
  }

  // Determinant
  det() {
    if (this.rows !== this.cols) {
      throw new CalcError(ERRORS.DIMENSION);
    }
    return computeDet(this.data, this.rows);
  }

  // Transpose
  transpose() {
    const res = new Matrix(this.cols, this.rows);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        res.data[c][r] = this.data[r][c];
      }
    }
    return res;
  }

  // Identity matrix
  static identity(n) {
    if (typeof n !== 'number' || n < 1 || n > 4 || !Number.isInteger(n)) {
      throw new CalcError(ERRORS.ARGUMENT);
    }
    const res = new Matrix(n, n);
    for (let i = 0; i < n; i++) {
      res.data[i][i] = ExactValue.fromInt(1n);
    }
    return res;
  }

  // Inverse (x⁻¹)
  inv() {
    if (this.rows !== this.cols) {
      throw new CalcError(ERRORS.DIMENSION);
    }
    const d = this.det();
    if (d.toDecimal15().isZero()) {
      throw new CalcError(ERRORS.MATH);
    }
    const n = this.rows;
    if (n === 1) {
      const res = new Matrix(1, 1);
      res.data[0][0] = ExactValue.fromInt(1n).div(this.data[0][0]);
      return res;
    }
    const adj = new Matrix(n, n);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const minor = minorMatrix(this.data, r, c);
        const sign = ((r + c) % 2 === 0) ? 1n : -1n;
        const minorDet = computeDet(minor, n - 1);
        const cofactor = (sign === 1n) ? minorDet : minorDet.neg();
        // Adjugate is transpose of cofactors: adj[c][r] = cofactor
        adj.data[c][r] = cofactor;
      }
    }
    const res = new Matrix(n, n);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        res.data[r][c] = adj.data[r][c].div(d);
      }
    }
    return res;
  }

  // Absolute value of elements
  abs() {
    const res = new Matrix(this.rows, this.cols);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const val = this.data[r][c];
        res.data[r][c] = val.toDecimal15().sign < 0 ? val.neg() : val;
      }
    }
    return res;
  }

  // Row Echelon Form
  ref() {
    return computeRef(this, false);
  }

  // Reduced Row Echelon Form
  rref() {
    return computeRef(this, true);
  }

  toJSON() {
    return {
      type: 'matrix',
      rows: this.rows,
      cols: this.cols,
      data: this.data.map((row) => row.map((v) => serialize(v)))
    };
  }

  static fromJSON(obj) {
    if (!obj || !obj.rows || !obj.cols || !obj.data) return null;
    const m = new Matrix(obj.rows, obj.cols);
    for (let r = 0; r < obj.rows; r++) {
      for (let c = 0; c < obj.cols; c++) {
        m.data[r][c] = deserialize(obj.data[r][c]) || ExactValue.fromInt(0n);
      }
    }
    return m;
  }
}

// ---------------------------------------------------------------- helpers

function computeDet(m, n) {
  if (n === 1) return m[0][0];
  if (n === 2) {
    return m[0][0].mul(m[1][1]).sub(m[0][1].mul(m[1][0]));
  }
  if (n === 3) {
    const a = m[0][0].mul(m[1][1].mul(m[2][2]).sub(m[1][2].mul(m[2][1])));
    const b = m[0][1].mul(m[1][0].mul(m[2][2]).sub(m[1][2].mul(m[2][0])));
    const c = m[0][2].mul(m[1][0].mul(m[2][1]).sub(m[1][1].mul(m[2][0])));
    return a.sub(b).add(c);
  }
  if (n === 4) {
    let total = ExactValue.fromInt(0n);
    for (let c = 0; c < 4; c++) {
      const sub = minorMatrix(m, 0, c);
      const subDet = computeDet(sub, 3);
      const term = m[0][c].mul(subDet);
      if (c % 2 === 0) total = total.add(term);
      else total = total.sub(term);
    }
    return total;
  }
  throw new CalcError(ERRORS.DIMENSION);
}

function minorMatrix(m, skipR, skipC) {
  const res = [];
  for (let r = 0; r < m.length; r++) {
    if (r === skipR) continue;
    const row = [];
    for (let c = 0; c < m[r].length; c++) {
      if (c === skipC) continue;
      row.push(m[r][c]);
    }
    res.push(row);
  }
  return res;
}

function computeRef(matrix, reduced = false) {
  const res = matrix.clone();
  const rows = res.rows;
  const cols = res.cols;
  let pivotRow = 0;
  for (let c = 0; c < cols && pivotRow < rows; c++) {
    let sel = -1;
    for (let r = pivotRow; r < rows; r++) {
      if (!res.data[r][c].toDecimal15().isZero()) {
        sel = r;
        break;
      }
    }
    if (sel === -1) continue;
    if (sel !== pivotRow) {
      const tmp = res.data[pivotRow];
      res.data[pivotRow] = res.data[sel];
      res.data[sel] = tmp;
    }
    const pivotVal = res.data[pivotRow][c];
    for (let j = c; j < cols; j++) {
      res.data[pivotRow][j] = res.data[pivotRow][j].div(pivotVal);
    }
    const startR = reduced ? 0 : pivotRow + 1;
    for (let r = startR; r < rows; r++) {
      if (r === pivotRow) continue;
      const factor = res.data[r][c];
      if (!factor.toDecimal15().isZero()) {
        for (let j = c; j < cols; j++) {
          res.data[r][j] = res.data[r][j].sub(factor.mul(res.data[pivotRow][j]));
        }
      }
    }
    pivotRow++;
  }
  return res;
}
