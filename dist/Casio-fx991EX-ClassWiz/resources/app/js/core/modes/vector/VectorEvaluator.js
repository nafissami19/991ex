/**
 * Evaluator for Vector mode: VctA..VctD, VctAns, + − × (cross), dot (•), scalar * / , Abs, Angle, UnitVector.
 */
import { Evaluator } from '../../eval/evaluate.js';
import { ExactValue } from '../../exact/ExactValue.js';
import { CalcError, ERRORS } from '../../errors.js';
import { VectorValue } from './VectorValue.js';

export class VectorEvaluator extends Evaluator {
  check(v) {
    if (v instanceof VectorValue) return v;
    return super.check(v);
  }

  value(n) {
    if (n.name === 'vct') {
      const ref = n.tok?.ref || n.id;
      const v = this.ctx.getVector ? this.ctx.getVector(ref) : null;
      if (!v || !(v instanceof VectorValue)) {
        throw new CalcError(ERRORS.DIMENSION, { loc: n.loc });
      }
      return v;
    }
    return super.value(n);
  }

  unary(op, a) {
    if (op === 'neg' && a instanceof VectorValue) return a.neg();
    return super.unary(op, a);
  }

  binary(op, a, b, n) {
    const aIsVec = a instanceof VectorValue;
    const bIsVec = b instanceof VectorValue;

    if (op === 'dot') {
      if (aIsVec && bIsVec) return a.dot(b);
      throw new CalcError(ERRORS.DIMENSION, { loc: n?.loc });
    }

    if (aIsVec || bIsVec) {
      switch (op) {
        case '+':
          if (aIsVec && bIsVec) return a.add(b);
          throw new CalcError(ERRORS.DIMENSION, { loc: n?.loc });
        case '-':
          if (aIsVec && bIsVec) return a.sub(b);
          throw new CalcError(ERRORS.DIMENSION, { loc: n?.loc });
        case '*':
          if (aIsVec && bIsVec) return a.cross(b); // Vector cross product
          if (aIsVec) return a.mulScalar(b);
          if (bIsVec) return b.mulScalar(a);
          throw new CalcError(ERRORS.DIMENSION, { loc: n?.loc });
        case '/':
          if (aIsVec && !bIsVec) return a.divScalar(b);
          throw new CalcError(ERRORS.DIMENSION, { loc: n?.loc });
        default:
          throw new CalcError(ERRORS.DIMENSION, { loc: n?.loc });
      }
    }

    return super.binary(op, a, b, n);
  }

  call(fn, args, n) {
    const anyVec = args.some((a) => a instanceof VectorValue);

    switch (fn) {
      case 'abs':
        if (args[0] instanceof VectorValue) return args[0].abs();
        break;
      case 'angle':
        if (args[0] instanceof VectorValue && args[1] instanceof VectorValue) {
          return args[0].angle(args[1], this.angle);
        }
        throw new CalcError(ERRORS.DIMENSION, { loc: n?.loc });
      case 'unitv':
        if (args[0] instanceof VectorValue) {
          return args[0].unitVector();
        }
        throw new CalcError(ERRORS.DIMENSION, { loc: n?.loc });
      default:
        if (anyVec) throw new CalcError(ERRORS.MATH, { loc: n?.loc });
        break;
    }

    return super.call(fn, args, n);
  }
}
