/**
 * Evaluator for Mode 4: Matrix.
 * Handles matrix variables (MatA–MatD, MatAns), operations (+ − ×, scalar ×, x⁻¹, x², x³),
 * Det, Trn, Identity, Ref, Rref, Abs.
 */

import { Evaluator } from '../../eval/evaluate.js';
import { ExactValue } from '../../exact/ExactValue.js';
import { CalcError, ERRORS } from '../../errors.js';
import { Matrix } from './Matrix.js';

export class MatrixEvaluator extends Evaluator {
  check(v) {
    if (v instanceof Matrix) {
      for (let r = 0; r < v.rows; r++) {
        for (let c = 0; c < v.cols; c++) {
          v.data[r][c] = super.check(v.data[r][c]);
        }
      }
      return v;
    }
    return super.check(v);
  }

  value(n) {
    if (n.name === 'mat') {
      const ref = n.ref || n.id || n.tok?.ref;
      const mat = this.ctx.getMatrix?.(ref);
      if (!mat || !mat.rows || !mat.cols) {
        throw new CalcError(ERRORS.DIMENSION, { loc: n.loc });
      }
      return mat.clone();
    }
    return super.value(n);
  }

  unary(op, a, n) {
    if (op === 'neg' && a instanceof Matrix) {
      return a.neg();
    }
    return super.unary(op, a, n);
  }

  binary(op, a, b, n) {
    const isMatA = a instanceof Matrix;
    const isMatB = b instanceof Matrix;
    if (isMatA || isMatB) {
      if (op === '+') {
        if (!isMatA || !isMatB) throw new CalcError(ERRORS.DIMENSION, { loc: n?.loc });
        return a.add(b);
      }
      if (op === '-') {
        if (!isMatA || !isMatB) throw new CalcError(ERRORS.DIMENSION, { loc: n?.loc });
        return a.sub(b);
      }
      if (op === '*') {
        if (isMatA && isMatB) return a.mul(b);
        if (isMatA && (b instanceof ExactValue)) return a.scale(b);
        if (isMatB && (a instanceof ExactValue)) return b.scale(a);
        throw new CalcError(ERRORS.DIMENSION, { loc: n?.loc });
      }
      if (op === '/') {
        if (isMatA && !isMatB && (b instanceof ExactValue)) return a.divScalar(b);
        throw new CalcError(ERRORS.DIMENSION, { loc: n?.loc });
      }
      if (op === '^') {
        throw new CalcError(ERRORS.DIMENSION, { loc: n?.loc });
      }
      throw new CalcError(ERRORS.DIMENSION, { loc: n?.loc });
    }
    return super.binary(op, a, b, n);
  }

  postfix(op, a, n) {
    if (a instanceof Matrix) {
      if (op === 'inv') {
        return a.inv();
      }
      if (op === 'sq') {
        return a.mul(a);
      }
      if (op === 'cube') {
        return a.mul(a).mul(a);
      }
      throw new CalcError(ERRORS.MATH, { loc: n?.loc });
    }
    return super.postfix(op, a, n);
  }

  call(fn, args, n) {
    if (fn === 'det') {
      if (args.length !== 1) throw new CalcError(ERRORS.SYNTAX, { loc: n?.loc });
      const m = args[0];
      if (!(m instanceof Matrix)) throw new CalcError(ERRORS.DIMENSION, { loc: n?.loc });
      return m.det();
    }
    if (fn === 'trn') {
      if (args.length !== 1) throw new CalcError(ERRORS.SYNTAX, { loc: n?.loc });
      const m = args[0];
      if (!(m instanceof Matrix)) throw new CalcError(ERRORS.DIMENSION, { loc: n?.loc });
      return m.transpose();
    }
    if (fn === 'identity') {
      if (args.length !== 1) throw new CalcError(ERRORS.SYNTAX, { loc: n?.loc });
      const v = args[0];
      let num;
      if (v instanceof ExactValue) {
        const d = v.toDecimal15();
        if (!d.isInteger()) throw new CalcError(ERRORS.ARGUMENT, { loc: n?.loc });
        num = Number(d.toBigInt());
      } else if (typeof v === 'number') {
        num = v;
      } else {
        throw new CalcError(ERRORS.ARGUMENT, { loc: n?.loc });
      }
      if (num < 1 || num > 4) throw new CalcError(ERRORS.ARGUMENT, { loc: n?.loc });
      return Matrix.identity(num);
    }
    if (fn === 'ref') {
      if (args.length !== 1) throw new CalcError(ERRORS.SYNTAX, { loc: n?.loc });
      const m = args[0];
      if (!(m instanceof Matrix)) throw new CalcError(ERRORS.DIMENSION, { loc: n?.loc });
      return m.ref();
    }
    if (fn === 'rref') {
      if (args.length !== 1) throw new CalcError(ERRORS.SYNTAX, { loc: n?.loc });
      const m = args[0];
      if (!(m instanceof Matrix)) throw new CalcError(ERRORS.DIMENSION, { loc: n?.loc });
      return m.rref();
    }
    if (fn === 'abs') {
      if (args.length !== 1) throw new CalcError(ERRORS.SYNTAX, { loc: n?.loc });
      const arg = args[0];
      if (arg instanceof Matrix) {
        return arg.abs();
      }
      return super.call(fn, args, n);
    }
    if (args.some((a) => a instanceof Matrix)) {
      throw new CalcError(ERRORS.MATH, { loc: n?.loc });
    }
    return super.call(fn, args, n);
  }
}
