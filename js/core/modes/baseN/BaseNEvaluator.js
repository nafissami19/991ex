/**
 * Evaluator for Base-N mode.
 * Evaluates expressions over 32-bit two's complement integers.
 */

import { Evaluator } from '../../eval/evaluate.js';
import { CalcError, ERRORS, toCalcError } from '../../errors.js';
import { BaseNValue, MIN_INT32, MAX_INT32, MASK32 } from './BaseNValue.js';

export class BaseNEvaluator extends Evaluator {
  constructor(ctx = {}) {
    super(ctx);
    this.currentBase = ctx.base || 'DEC';
  }

  evalNode(n, top) {
    if (n.type === 'prefix') {
      const baseMap = { bn_d: 'DEC', bn_h: 'HEX', bn_b: 'BIN', bn_o: 'OCT' };
      const overrideBase = baseMap[n.fn];
      if (overrideBase) {
        const prevBase = this.currentBase;
        this.currentBase = overrideBase;
        try {
          return this.eval(n.arg);
        } finally {
          this.currentBase = prevBase;
        }
      }
    }
    return super.evalNode(n, top);
  }

  number(n) {
    if (n.decimal || n.exp !== null) {
      throw new CalcError(ERRORS.SYNTAX, { loc: n.loc });
    }
    const mant = n.mant;
    const base = this.currentBase;

    const validDigits = {
      DEC: /^[0-9]+$/,
      HEX: /^[0-9A-Fa-f]+$/,
      BIN: /^[01]+$/,
      OCT: /^[0-7]+$/
    };
    if (!validDigits[base] || !validDigits[base].test(mant)) {
      throw new CalcError(ERRORS.SYNTAX, { loc: n.loc });
    }

    try {
      if (base === 'DEC') {
        const raw = BigInt(mant);
        if (raw > MAX_INT32) {
          if (raw === 2147483648n) {
            return { _rawDecimal2147483648: true };
          }
          throw new CalcError(ERRORS.MATH, { loc: n.loc });
        }
        return new BaseNValue(raw);
      } else {
        const raw = BigInt(`0${base === 'HEX' ? 'x' : base === 'BIN' ? 'b' : 'o'}${mant}`);
        if (raw > MASK32) {
          throw new CalcError(ERRORS.MATH, { loc: n.loc });
        }
        return BaseNValue.fromUnsigned(raw);
      }
    } catch (err) {
      if (err instanceof CalcError) throw err;
      throw new CalcError(ERRORS.SYNTAX, { loc: n.loc });
    }
  }

  value(n) {
    if (n.tok && n.tok.name === 'Ans') {
      const ans = this.memory.getAns();
      if (ans instanceof BaseNValue) return ans;
      if (typeof ans === 'bigint') return new BaseNValue(ans);
      if (typeof ans === 'number' && Number.isInteger(ans)) return new BaseNValue(BigInt(ans));
      if (ans && typeof ans.toDecimal15 === 'function') {
        try {
          const d = ans.toDecimal15();
          if (d.isInteger()) {
            return new BaseNValue(BigInt(d.toString()));
          }
        } catch {}
      }
      return new BaseNValue(0n);
    }
    throw new CalcError(ERRORS.SYNTAX, { loc: n.loc });
  }

  unary(op, a, n) {
    if (op === 'neg') {
      if (a && a._rawDecimal2147483648) {
        return new BaseNValue(MIN_INT32);
      }
      if (a instanceof BaseNValue) {
        return a.neg();
      }
    }
    throw new CalcError(ERRORS.SYNTAX, { loc: n?.loc });
  }

  binary(op, a, b, n) {
    if (a && a._rawDecimal2147483648) throw new CalcError(ERRORS.MATH, { loc: n?.loc });
    if (b && b._rawDecimal2147483648) throw new CalcError(ERRORS.MATH, { loc: n?.loc });

    if (!(a instanceof BaseNValue) || !(b instanceof BaseNValue)) {
      throw new CalcError(ERRORS.SYNTAX, { loc: n?.loc });
    }

    switch (op) {
      case '+': return a.add(b);
      case '-': return a.sub(b);
      case '*': return a.mul(b);
      case '/': return a.div(b);
      case 'and': return a.and(b);
      case 'or': return a.or(b);
      case 'xor': return a.xor(b);
      case 'xnor': return a.xnor(b);
      default:
        throw new CalcError(ERRORS.SYNTAX, { loc: n?.loc });
    }
  }

  call(fn, args, n) {
    if (fn === 'not') {
      if (args.length !== 1) throw new CalcError(ERRORS.SYNTAX, { loc: n?.loc });
      const a = args[0];
      if (a && a._rawDecimal2147483648) throw new CalcError(ERRORS.MATH, { loc: n?.loc });
      if (!(a instanceof BaseNValue)) throw new CalcError(ERRORS.SYNTAX, { loc: n?.loc });
      return a.not();
    }
    if (fn === 'negb') {
      if (args.length !== 1) throw new CalcError(ERRORS.SYNTAX, { loc: n?.loc });
      const a = args[0];
      if (a && a._rawDecimal2147483648) throw new CalcError(ERRORS.MATH, { loc: n?.loc });
      if (!(a instanceof BaseNValue)) throw new CalcError(ERRORS.SYNTAX, { loc: n?.loc });
      return a.neg();
    }
    throw new CalcError(ERRORS.SYNTAX, { loc: n?.loc });
  }

  postfix(op, a, n) {
    throw new CalcError(ERRORS.SYNTAX, { loc: n?.loc });
  }

  mixed(w, num, den, n) {
    throw new CalcError(ERRORS.SYNTAX, { loc: n?.loc });
  }

  root(idx, arg, n) {
    throw new CalcError(ERRORS.SYNTAX, { loc: n?.loc });
  }

  calculus(n) {
    throw new CalcError(ERRORS.SYNTAX, { loc: n?.loc });
  }
}
