/**
 * Evaluator: AST → value.
 *
 * Real values are ExactValue (rational / surd / π-form / decimal). The evaluator always
 * keeps exact forms where it can; the display layer decides (from the Input/Output
 * setting) whether to show them exactly or as decimals.
 *
 * Modes with their own number types (Complex, Matrix, Vector, Base-N) subclass
 * Evaluator and override binary()/unary()/call()/value().
 */

import { ExactValue } from '../exact/ExactValue.js';
import { Rational } from '../exact/Rational.js';
import { SurdForm } from '../exact/SurdForm.js';
import { PiForm } from '../exact/PiForm.js';
import { Decimal15 } from '../number/Decimal15.js';
import * as F from '../number/functions.js';
import { CalcError, ERRORS, toCalcError } from '../errors.js';
import { integrate, differentiate, summation } from './calculus.js';

const D = (s) => Decimal15.fromString(String(s));
const ZERO = () => ExactValue.fromInt(0n);
const ONE = () => ExactValue.fromInt(1n);

export const STACK_LIMITS = { numeric: 10, command: 24 };

/** Check AST depth against the calculator's numeric (10) and command (24) stack limits. */
export function checkTreeDepth(node) {
  function walk(n, numDepth, cmdDepth) {
    if (!n || typeof n !== 'object') return;
    if (numDepth > STACK_LIMITS.numeric || cmdDepth > STACK_LIMITS.command) {
      throw new CalcError(ERRORS.STACK, { loc: n.loc });
    }
    switch (n.type) {
      case 'bin':
      case 'frac':
        walk(n.l || n.num, numDepth, cmdDepth);
        walk(n.r || n.den, numDepth + 1, cmdDepth + 1);
        break;
      case 'root':
        walk(n.index, numDepth, cmdDepth);
        walk(n.arg, numDepth + 1, cmdDepth + 1);
        break;
      case 'mixed':
        walk(n.whole, numDepth, cmdDepth);
        walk(n.num, numDepth + 1, cmdDepth + 1);
        walk(n.den, numDepth + 2, cmdDepth + 2);
        break;
      case 'paren':
        walk(n.arg, numDepth, cmdDepth + 1);
        break;
      case 'neg':
      case 'prefix':
      case 'post':
        walk(n.arg, numDepth, cmdDepth + 1);
        break;
      case 'dms':
        walk(n.d, numDepth, cmdDepth);
        if (n.m) walk(n.m, numDepth + 1, cmdDepth + 1);
        if (n.s) walk(n.s, numDepth + 2, cmdDepth + 2);
        break;
      case 'call':
        if (n.args) {
          for (let i = 0; i < n.args.length; i++) {
            walk(n.args[i], numDepth + (i > 0 ? 1 : 0), cmdDepth + 1);
          }
        }
        break;
      case 'eq':
        walk(n.l, numDepth, cmdDepth);
        walk(n.r, numDepth + 1, cmdDepth + 1);
        break;
    }
  }
  walk(node, 0, 0);
}

export class PairResult {
  /** Two labelled results, e.g. Pol → r=…, θ=… */
  constructor(labels, values) {
    this.kind = 'pair';
    this.labels = labels;
    this.values = values;
  }
}

export class Evaluator {
  /**
   * @param {object} ctx
   *   angle: 'DEG' | 'RAD' | 'GRA'
   *   memory: Memory (getVar/setVar, ans)
   *   numberFormat: { type, value }   (for Rnd)
   *   rng: () => number in [0,1)
   *   constants: { id → ExactValue }  (scientific constants)
   *   timeLimitMs: number
   */
  constructor(ctx = {}) {
    this.ctx = ctx;
    this.angle = (ctx.angle || 'DEG').toUpperCase();
    this.memory = ctx.memory;
    this.rng = ctx.rng || Math.random;
    this.local = {}; // variable overrides (∫, Σ, CALC)
    this.flags = { decimalInput: false, dms: false };
    this.cmdDepth = 0;
    this.numDepth = 0;
  }

  // ---------------------------------------------------------------- entry points

  /** Evaluate one statement node. Errors are CalcErrors carrying the error location. */
  run(node) {
    try {
      checkTreeDepth(node);
      const v = this.eval(node, true);
      return v;
    } catch (err) {
      throw toCalcError(err, node && node.loc);
    }
  }

  eval(node, top = false) {
    try {
      return this.evalNode(node, top);
    } catch (err) {
      throw toCalcError(err, node && node.loc);
    }
  }

  evalNode(n, top) {
    switch (n.type) {
      case 'num': return this.number(n);
      case 'value': return this.value(n);
      case 'paren': return this.eval(n.arg);
      case 'neg': return this.check(this.unary('neg', this.eval(n.arg)));
      case 'prefix': return this.prefix(n.fn, this.eval(n.arg), n);
      case 'bin': return this.check(this.binary(n.op, this.eval(n.l), this.eval(n.r), n));
      case 'post': return this.check(this.postfix(n.op, this.eval(n.arg), n));
      case 'frac': return this.check(this.binary('/', this.eval(n.num), this.eval(n.den), n));
      case 'mixed': return this.check(this.mixed(this.eval(n.whole), this.eval(n.num), this.eval(n.den)));
      case 'root': return this.check(this.root(this.eval(n.index), this.eval(n.arg)));
      case 'dms': return this.dms(n);
      case 'call': {
        if ((n.fn === 'Pol' || n.fn === 'Rec') && !top) throw new CalcError(ERRORS.SYNTAX, { loc: n.loc });
        if (n.fn === 'integral' || n.fn === 'diff' || n.fn === 'sum') return this.calculus(n);
        const args = n.args.map((a) => this.eval(a));
        const r = this.call(n.fn, args, n);
        return r instanceof PairResult ? r : this.check(r);
      }
      case 'eq': throw new CalcError(ERRORS.SYNTAX, { loc: n.loc });
      default: throw new CalcError(ERRORS.SYNTAX, { loc: n.loc });
    }
  }

  // ---------------------------------------------------------------- helpers

  /** Range check: |x| < 1e100 (Math ERROR), tiny values underflow to 0 in Decimal15. */
  check(v) {
    if (!(v instanceof ExactValue)) return v;
    const d = v.toDecimal15(); // throws Math ERROR when |x| ≥ 1e100
    if (v.type === 'rational' && (v.value.n.toString().length > 120 || v.value.d.toString().length > 120)) {
      return ExactValue.fromDecimal(d);
    }
    return v;
  }

  real(v) {
    if (!(v instanceof ExactValue)) throw new CalcError(ERRORS.MATH);
    return v;
  }

  dec(v) {
    return this.real(v).toDecimal15();
  }

  isInt(v) {
    if (v.type === 'rational') return v.value.d === 1n;
    return v.toDecimal15().isInteger();
  }

  rat(v) {
    // Exact rational view of v (or null)
    if (v.type === 'rational') return v.value;
    return null;
  }

  fromDec(d) {
    return ExactValue.fromDecimal(d);
  }

  number(n) {
    if (!n.decimal && n.exp === null && n.mant.length <= 15) return ExactValue.fromInt(BigInt(n.mant));
    this.flags.decimalInput = this.flags.decimalInput || n.decimal;
    const text = n.mant + (n.exp !== null ? 'e' + n.exp : '');
    let dec;
    try {
      dec = Decimal15.fromString(text);
    } catch {
      throw new CalcError(ERRORS.MATH);
    }
    // Exact decimal input becomes an exact fraction (shown as a fraction in MathO)
    const exact = exactFromDecimalString(n.mant, n.exp);
    if (exact) return this.check(exact);
    return this.check(ExactValue.fromDecimal(dec));
  }

  value(n) {
    switch (n.name) {
      case 'pi': return ExactValue.pi();
      case 'e': return new ExactValue('decimal', F.CASIO_E, F.CASIO_E);
      case 'Ans': return this.memory ? this.memory.getAns() : ZERO();
      case 'PreAns': return this.memory ? this.memory.getPreAns() : ZERO();
      case 'mat':
      case 'vct': {
        if (this.ctx.resolveValue) {
          const v = this.ctx.resolveValue(n);
          if (v !== undefined) return v;
        }
        throw new CalcError(ERRORS.DIMENSION, { loc: n.loc });
      }
      case 'var': {
        const name = n.tok.variable;
        if (this.local[name] !== undefined) return this.local[name];
        return this.memory ? this.memory.getVar(name) : ZERO();
      }
      case 'ran': {
        const k = Math.floor(this.rng() * 1000);
        return ExactValue.fromRational(BigInt(k), 1000n);
      }
      case 'const': {
        const c = this.ctx.constants && this.ctx.constants[n.id];
        if (!c) throw new CalcError(ERRORS.SYNTAX);
        return c;
      }
      default:
        if (this.ctx.resolveValue) {
          const v = this.ctx.resolveValue(n);
          if (v !== undefined) return v;
        }
        throw new CalcError(ERRORS.SYNTAX);
    }
  }

  unary(op, a) {
    if (op === 'neg') return this.real(a).neg();
    throw new CalcError(ERRORS.SYNTAX);
  }

  prefix(fn, a) {
    throw new CalcError(ERRORS.SYNTAX);
  }

  binary(op, a, b) {
    a = this.real(a);
    b = this.real(b);
    switch (op) {
      case '+': return a.add(b);
      case '-': return a.sub(b);
      case '*': return a.mul(b);
      case '/':
        if (b.toDecimal15().isZero() && (b.type !== 'rational' || b.value.isZero())) throw new CalcError(ERRORS.MATH);
        return a.div(b);
      case '^': return this.pow(a, b);
      case 'nPr': return this.fromDec(F.nPr(a.toDecimal15(), b.toDecimal15()));
      case 'nCr': return this.fromDec(F.nCr(a.toDecimal15(), b.toDecimal15()));
      default: throw new CalcError(ERRORS.SYNTAX);
    }
  }

  postfix(op, a, n) {
    a = this.real(a);
    switch (op) {
      case 'sq': return this.pow(a, ExactValue.fromInt(2n));
      case 'cube': return this.pow(a, ExactValue.fromInt(3n));
      case 'inv':
        if (a.toDecimal15().isZero()) throw new CalcError(ERRORS.MATH);
        return ONE().div(a);
      case 'fact': {
        if (!this.isInt(a)) throw new CalcError(ERRORS.MATH);
        const r = F.factorial(a.toDecimal15());
        return a.toDecimal15().lte(D(20)) ? ExactValue.fromInt(r.toBigInt()) : this.fromDec(r);
      }
      case 'pct': return a.div(ExactValue.fromInt(100n));
      case 'deg': return this.angleFrom(a, 'DEG');
      case 'rad': return this.angleFrom(a, 'RAD');
      case 'grad': return this.angleFrom(a, 'GRA');
      case 'eng': {
        const e = n.tok.exp10;
        const p = ExactValue.fromRational(e >= 0 ? 10n ** BigInt(e) : 1n, e >= 0 ? 1n : 10n ** BigInt(-e));
        return a.mul(p);
      }
      case 'conv':
        if (!n.tok.convert) throw new CalcError(ERRORS.SYNTAX);
        return n.tok.convert(a);
      default:
        if (this.ctx.postfix) {
          const v = this.ctx.postfix(op, a, n);
          if (v !== undefined) return v;
        }
        throw new CalcError(ERRORS.SYNTAX);
    }
  }

  /** Convert an angle given in `from` units to the current angle unit. */
  angleFrom(a, from) {
    const to = this.angle;
    if (from === to) return a;
    // Express as a fraction of a half turn: DEG 180, RAD π, GRA 200
    const half = (u) => (u === 'DEG' ? ExactValue.fromInt(180n) : u === 'GRA' ? ExactValue.fromInt(200n) : ExactValue.pi());
    return a.div(half(from)).mul(half(to));
  }

  mixed(whole, num, den) {
    if (den.toDecimal15().isZero()) throw new CalcError(ERRORS.MATH);
    const f = num.div(den);
    if (whole.toDecimal15().sign < 0) return whole.sub(f);
    return whole.add(f);
  }

  dms(n) {
    const d = this.eval(n.d);
    const m = n.m ? this.eval(n.m) : ZERO();
    const s = n.s ? this.eval(n.s) : ZERO();
    if (m.toDecimal15().sign < 0 || s.toDecimal15().sign < 0) throw new CalcError(ERRORS.MATH);
    this.flags.dms = true;
    let v = d.toDecimal15().sign < 0
      ? d.sub(m.div(ExactValue.fromInt(60n))).sub(s.div(ExactValue.fromInt(3600n)))
      : d.add(m.div(ExactValue.fromInt(60n))).add(s.div(ExactValue.fromInt(3600n)));
    return this.check(v);
  }

  // ---------------------------------------------------------------- powers & roots

  pow(a, b) {
    const da = a.toDecimal15();
    const rb = this.rat(b);
    if (da.isZero()) {
      if (b.toDecimal15().sign <= 0) throw new CalcError(ERRORS.MATH);
      return ZERO();
    }
    if (rb && rb.d === 1n) {
      const n = rb.n;
      if (n === 0n) return ONE();
      if (a.type === 'rational') {
        // Exact while the result stays in range
        const mag = (a.value.n < 0n ? -a.value.n : a.value.n).toString().length + a.value.d.toString().length;
        if (mag * Number(n < 0n ? -n : n) < 400) {
          const p = a.value.pow(Number(n));
          return ExactValue.fromRational(p.n, p.d);
        }
        return this.fromDec(F.pow(da, b.toDecimal15()));
      }
      if (a.type === 'surd' && n > 0n && n <= 8n) {
        try {
          return ExactValue.fromSurd(a.value.pow(Number(n)));
        } catch { /* decimal fallback */ }
      }
      const absN = n < 0n ? -n : n;
      if (absN <= 1000n) {
        // Integer power by repeated 15-digit multiplication
        let result = Decimal15.ONE;
        let base = da;
        let e = absN;
        while (e > 0n) {
          if (e & 1n) result = result.mul(base);
          e >>= 1n;
          if (e > 0n) base = base.mul(base);
        }
        if (n < 0n) result = Decimal15.ONE.div(result);
        return this.fromDec(result);
      }
      return this.fromDec(F.pow(da, b.toDecimal15()));
    }
    if (rb && a.type === 'rational') {
      const p = rb.n;
      const q = rb.d;
      // a^(p/q) with q = 2 → exact surd when a > 0
      if (q === 2n && a.value.n > 0n) {
        const base = this.pow(a, ExactValue.fromInt(p));
        if (base.type === 'rational') return this.sqrtExact(base);
      }
      if (a.value.n < 0n) {
        if (q % 2n === 0n) throw new CalcError(ERRORS.MATH);
        // Odd root of a negative base
        const absPow = this.fromDec(F.pow(da.abs(), b.toDecimal15()));
        return (p % 2n === 0n) ? absPow : absPow.neg();
      }
    }
    if (da.sign < 0) {
      throw new CalcError(ERRORS.MATH);
    }
    return this.fromDec(F.pow(da, b.toDecimal15()));
  }

  sqrtExact(a) {
    if (a.type === 'rational') {
      if (a.value.n < 0n) throw new CalcError(ERRORS.MATH);
      return ExactValue.fromSurd(SurdForm.sqrt(a.value));
    }
    const d = a.toDecimal15();
    if (d.sign < 0) throw new CalcError(ERRORS.MATH);
    return this.fromDec(F.sqrt(d));
  }

  root(index, arg) {
    const ri = this.rat(index);
    if (ri && ri.d === 1n && ri.n === 2n) return this.sqrtExact(arg);
    if (ri && ri.d === 1n && ri.n === 3n) return this.cbrt(arg);
    if (index.toDecimal15().isZero()) throw new CalcError(ERRORS.MATH);
    if (ri && arg.type === 'rational') {
      return this.pow(arg, ExactValue.fromRational(ri.d, ri.n));
    }
    return this.fromDec(F.xRoot(index.toDecimal15(), arg.toDecimal15()));
  }

  cbrt(a) {
    if (a.type === 'rational') {
      const n = intCbrt(a.value.n < 0n ? -a.value.n : a.value.n);
      const d = intCbrt(a.value.d);
      if (n !== null && d !== null) return ExactValue.fromRational(a.value.n < 0n ? -n : n, d);
    }
    return this.fromDec(F.cbrt(a.toDecimal15()));
  }

  // ---------------------------------------------------------------- trig

  /** Exact sin/cos/tan for exact multiples of 15° (or π/12, 50/3 grad). */
  trig(fn, a) {
    let deg = null;
    if (this.angle === 'DEG' && a.type === 'rational') deg = a.value;
    else if (this.angle === 'GRA' && a.type === 'rational') deg = a.value.mul(new Rational(9n, 10n));
    else if (this.angle === 'RAD') {
      if (a.type === 'pi' && a.value.power === 1) deg = a.value.q.mul(new Rational(180n, 1n));
      else if (a.type === 'rational' && a.value.isZero()) deg = new Rational(0n, 1n);
    }
    if (deg && deg.d === 1n && deg.n % 15n === 0n) {
      let m = deg.n % 360n;
      if (m < 0n) m += 360n;
      const v = ExactValue._lookupTrigDeg(fn, Number(m));
      if (v !== undefined) return v;
    }
    const d = a.toDecimal15();
    return this.fromDec(F[fn](d, this.angle));
  }

  /** Inverse trig: decimal result, shown as a π-form in Rad mode when it is a simple multiple of π. */
  inverseTrig(fn, a) {
    const r = F[fn](a.toDecimal15(), this.angle);
    if (this.angle === 'RAD') {
      const q = recognisePiMultiple(r);
      if (q) return ExactValue.fromPi(new PiForm(q));
    }
    return this.fromDec(r);
  }

  // ---------------------------------------------------------------- functions

  call(fn, args, n) {
    const a = args[0];
    switch (fn) {
      case 'sin': case 'cos': case 'tan': return this.trig(fn, this.real(a));
      case 'asin': case 'acos': case 'atan': return this.inverseTrig(fn, this.real(a));
      case 'sinh': case 'cosh': case 'tanh': case 'asinh': case 'acosh': case 'atanh':
        return this.fromDec(F[fn](this.dec(a)));
      case 'log':
        if (args.length === 2) return this.logBase(this.real(args[0]), this.real(args[1]));
        return this.log10(this.real(a));
      case 'ln': {
        const d = this.dec(a);
        if (a.type === 'decimal' && d.cmp(F.CASIO_E) === 0) return ONE();
        return this.fromDec(F.ln(d));
      }
      case 'sqrt': return this.sqrtExact(this.real(a));
      case 'cbrt': return this.cbrt(this.real(a));
      case 'pow10': return this.pow(ExactValue.fromInt(10n), this.real(a));
      case 'expe': {
        const ra = this.rat(a);
        if (ra && ra.isZero()) return ONE();
        return this.fromDec(F.exp(this.dec(a)));
      }
      case 'abs': {
        const v = this.real(a);
        return v.toDecimal15().sign < 0 ? v.neg() : v;
      }
      case 'int': return this.fromDec(F.int(this.dec(a)));
      case 'intg': return this.fromDec(F.intg(this.dec(a)));
      case 'rnd': return this.fromDec(F.rnd(this.dec(a), this.ctx.numberFormat || { type: 'NORM', value: 1 }));
      case 'ranint': {
        const lo = this.dec(args[0]);
        const hi = this.dec(args[1]);
        if (!lo.isInteger() || !hi.isInteger() || lo.gte(hi)) throw new CalcError(ERRORS.MATH);
        return this.fromDec(F.ranInt(lo, hi, this.rng));
      }
      case 'Pol': {
        const r = F.pol(this.dec(args[0]), this.dec(args[1]), this.angle);
        const rv = this.fromDec(r.r);
        const tv = this.fromDec(r.theta);
        this.assignXY(rv, tv);
        return new PairResult(['r', 'θ'], [rv, tv]);
      }
      case 'Rec': {
        const r = F.rec(this.dec(args[0]), this.dec(args[1]), this.angle);
        const xv = this.fromDec(r.x);
        const yv = this.fromDec(r.y);
        this.assignXY(xv, yv);
        return new PairResult(['x', 'y'], [xv, yv]);
      }
      default:
        if (this.ctx.call) {
          const v = this.ctx.call(fn, args, n, this);
          if (v !== undefined) return v;
        }
        throw new CalcError(ERRORS.SYNTAX);
    }
  }

  assignXY(a, b) {
    if (this.memory) {
      this.memory.setVar('x', a);
      this.memory.setVar('y', b);
    }
  }

  log10(a) {
    const ra = this.rat(a);
    if (ra && ra.n > 0n) {
      const k = exactLog(ra, 10n);
      if (k !== null) return ExactValue.fromRational(k.n, k.d);
    }
    return this.fromDec(F.log(a.toDecimal15()));
  }

  logBase(b, a) {
    const rb = this.rat(b);
    const ra = this.rat(a);
    if (rb && ra && rb.d === 1n && rb.n > 1n && ra.n > 0n) {
      const k = exactLog(ra, rb.n);
      if (k !== null) return ExactValue.fromRational(k.n, k.d);
    }
    return this.fromDec(F.logBase(b.toDecimal15(), a.toDecimal15()));
  }

  // ---------------------------------------------------------------- ∫ d/dx Σ

  calculus(n) {
    const f = n.args[0];
    const evalAt = (x) => {
      const saved = this.local.x;
      this.local.x = x;
      try {
        return this.real(this.eval(f));
      } finally {
        if (saved === undefined) delete this.local.x;
        else this.local.x = saved;
      }
    };
    const rest = n.args.slice(1).map((a) => this.real(this.eval(a)));
    const deadline = Date.now() + (this.ctx.timeLimitMs ?? 20000);
    if (n.fn === 'integral') {
      if (rest[2]) {
        const tol = rest[2].toDecimal15();
        if (tol.sign <= 0 || tol.gte(Decimal15.ONE) || tol.lt(D('1e-14'))) throw new CalcError(ERRORS.ARGUMENT, { loc: n.loc });
      }
      const tol = rest[2] ? rest[2].toDecimal15() : D('1e-5');
      return this.fromDec(integrate((x) => evalAt(x), rest[0].toDecimal15(), rest[1].toDecimal15(), tol, deadline));
    }
    if (n.fn === 'diff') {
      if (rest[1]) {
        const tol = rest[1].toDecimal15();
        if (tol.sign <= 0 || tol.gte(Decimal15.ONE) || tol.lt(D('1e-14'))) throw new CalcError(ERRORS.ARGUMENT, { loc: n.loc });
      }
      const tol = rest[1] ? rest[1].toDecimal15() : D('1e-10');
      return this.fromDec(differentiate((x) => evalAt(x), rest[0].toDecimal15(), tol, deadline));
    }
    return summation((x) => evalAt(x), rest[0], rest[1], deadline);
  }
}

// ---------------------------------------------------------------- utilities

function intCbrt(n) {
  if (n === 0n) return 0n;
  let x = BigInt(Math.round(Math.cbrt(Number(n))));
  for (const c of [x - 1n, x, x + 1n]) if (c >= 0n && c * c * c === n) return c;
  return null;
}

/** log_b(r) as an exact rational when r is a rational power of b (b integer). */
function exactLog(r, b) {
  const powOf = (v) => {
    if (v === 1n) return 0;
    let k = 0;
    while (v % b === 0n) {
      v /= b;
      k++;
    }
    return v === 1n ? k : null;
  };
  const pn = powOf(r.n);
  const pd = powOf(r.d);
  if (pn === null || pd === null) return null;
  return new Rational(BigInt(pn - pd), 1n);
}

/** Exact value of a decimal literal like 0.125 or 2.5e-3 (always a terminating fraction). */
function exactFromDecimalString(mant, exp) {
  let [ip, fp = ''] = mant.split('.');
  const digits = (ip + fp).replace(/^0+(?=\d)/, '') || '0';
  if (digits.replace(/^0+/, '').length > 15) return null;
  let e = -fp.length + (exp !== null ? parseInt(exp, 10) : 0);
  let n = BigInt(digits);
  let d = 1n;
  if (e >= 0) n *= 10n ** BigInt(e);
  else d = 10n ** BigInt(-e);
  return ExactValue.fromRational(n, d);
}

/** r = q·π for a rational q with denominator ≤ 12 (within 15-digit rounding)? */
function recognisePiMultiple(r) {
  if (r.isZero()) return null;
  const ratio = r.div(F.CASIO_PI);
  for (let den = 1n; den <= 12n; den++) {
    const scaled = ratio.mul(Decimal15.fromBigInt(den));
    const nearest = scaled.abs().add(D('0.5')).trunc();
    const diff = scaled.abs().sub(nearest).abs();
    if (diff.lt(D('1e-12')) && !nearest.isZero()) {
      const num = nearest.toBigInt() * (scaled.sign < 0 ? -1n : 1n);
      return new Rational(num, den);
    }
  }
  return null;
}
