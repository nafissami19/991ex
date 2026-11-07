/**
 * Evaluator for Complex mode: i, r∠θ, + − × ÷, integer powers, x² x³ x⁻¹, %, engineering
 * symbols, Abs, arg, Conjg, ReP, ImP. Every other function needs a real argument and gives
 * Math ERROR for a non-real one (the base Evaluator's real() check).
 */

import { Evaluator } from '../../eval/evaluate.js';
import { ExactValue } from '../../exact/ExactValue.js';
import { CalcError, ERRORS } from '../../errors.js';
import {
  ComplexValue, isComplex, parts, makeComplex, I, cadd, csub, cneg, cmul, cdiv, conj, cabs, carg, cpowInt, signEV
} from './ComplexValue.js';

const ZERO = () => ExactValue.fromInt(0n);
const ONE = () => ExactValue.fromInt(1n);

export class ComplexEvaluator extends Evaluator {
  check(v) {
    if (v instanceof ComplexValue) return makeComplex(super.check(v.re), super.check(v.im), v.formatOverride);
    return super.check(v);
  }

  evalNode(n, top) {
    if (n.type === 'post' && (n.op === 'toPolar' || n.op === 'toRect')) {
      if (!top) throw new CalcError(ERRORS.SYNTAX, { loc: n.loc });
      const val = this.eval(n.arg);
      const fmt = n.op === 'toPolar' ? 'polar' : 'rect';
      if (val instanceof ComplexValue) {
        return new ComplexValue(val.re, val.im, fmt);
      }
      if (val instanceof ExactValue) {
        if (fmt === 'polar') {
          return new ComplexValue(val, ZERO(), 'polar');
        }
        return val;
      }
      return val;
    }
    return super.evalNode(n, top);
  }

  value(n) {
    if (n.name === 'i') return I();
    return super.value(n);
  }

  unary(op, a) {
    if (op === 'neg' && isComplex(a)) return cneg(a);
    return super.unary(op, a);
  }

  binary(op, a, b, n) {
    if (op === 'angle') return this.polar(this.real(a), this.real(b));
    if (op === '^') return this.power(a, b);
    if (!isComplex(a) && !isComplex(b)) return super.binary(op, a, b, n);
    switch (op) {
      case '+': return cadd(a, b);
      case '-': return csub(a, b);
      case '*': return cmul(a, b);
      case '/': return cdiv(a, b);
      default: throw new CalcError(ERRORS.MATH);
    }
  }

  /** a^b: complex base needs an integer exponent; a complex exponent is not supported. */
  power(a, b) {
    if (isComplex(b)) throw new CalcError(ERRORS.MATH);
    if (!isComplex(a)) return this.pow(a, b);
    const d = b.toDecimal15();
    if (!d.isInteger()) throw new CalcError(ERRORS.MATH);
    const n = b.type === 'rational' ? b.value.n : d.toBigInt();
    return cpowInt(a, n, (v) => this.check(v));
  }

  /** r∠θ → a+bi, θ in the current angle unit. */
  polar(r, theta) {
    if (r.toDecimal15().sign < 0) throw new CalcError(ERRORS.MATH);
    const c = this.trig('cos', theta);
    const s = this.trig('sin', theta);
    return makeComplex(r.mul(c), r.mul(s));
  }

  postfix(op, a, n) {
    if (op === 'toPolar' || op === 'toRect') throw new CalcError(ERRORS.SYNTAX); // only at the end
    if (!isComplex(a)) return super.postfix(op, a, n);
    switch (op) {
      case 'sq': return cmul(a, a);
      case 'cube': return cmul(cmul(a, a), a);
      case 'inv': return cdiv(ONE(), a);
      case 'pct': return cdiv(a, ExactValue.fromInt(100n));
      case 'eng': {
        const e = n.tok.exp10;
        const p = ExactValue.fromRational(e >= 0 ? 10n ** BigInt(e) : 1n, e >= 0 ? 1n : 10n ** BigInt(-e));
        return cmul(a, p);
      }
      default: throw new CalcError(ERRORS.MATH);
    }
  }

  call(fn, args, n) {
    const a = args[0];
    switch (fn) {
      case 'abs': return cabs(this.num(a));
      case 'arg': return carg(this.num(a), this.angle);
      case 'conjg': return conj(this.num(a));
      case 'rep': return parts(this.num(a))[0];
      case 'imp': return parts(this.num(a))[1];
      default: return super.call(fn, args, n);
    }
  }

  num(v) {
    if (v instanceof ExactValue || v instanceof ComplexValue) return v;
    throw new CalcError(ERRORS.MATH);
  }

  // Base helpers that read toDecimal15() directly: require real arguments.
  root(index, arg) {
    return super.root(this.real(index), this.real(arg));
  }

  mixed(whole, num, den) {
    return super.mixed(this.real(whole), this.real(num), this.real(den));
  }

  dms(n) {
    for (const k of ['d', 'm', 's']) {
      if (n[k] && n[k].type === 'value' && isComplex(this.value(n[k]))) throw new CalcError(ERRORS.MATH);
    }
    return super.dms(n);
  }
}

export { signEV, ZERO };
