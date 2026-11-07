/**
 * Parser: editor tree (tokens + templates) → expression tree (AST).
 *
 * Calculation priority (User's Guide "Calculation Priority Sequence"), highest first:
 *  1 parentheses                     → primary
 *  2 functions with "(" (sin( …)     → primary
 *  3 postfix: x² x³ x⁻¹ x! °'" ° r g % t, engineering symbols, powers, roots   (bp 90)
 *  4 fractions (LineI ┘)                                                       (bp 80)
 *  5 (−) sign, Base-N symbols d h b o                                          (bp 70)
 *  6 metric conversions, statistics estimates x̂ ŷ                              (bp 65)
 *  7 multiplication with the sign omitted                                      (bp 60)
 *  8 nPr nCr ∠                                                                 (bp 50)
 *  9 dot product •                                                             (bp 45)
 * 10 × ÷                                                                       (bp 40)
 * 11 + −                                                                       (bp 30)
 * 12 and                                                                       (bp 20)
 * 13 or xor xnor                                                               (bp 10)
 * Equal priority evaluates left to right.
 *
 * AST nodes are plain objects: { type, ..., loc } where loc is the editor location
 * ({ path, idx }) used for the error cursor jump.
 */

import { TOKENS } from '../input/tokens.js';
import { CalcError, ERRORS } from '../errors.js';

const BP = { POSTFIX: 90, FRAC: 80, SIGN: 70, CONV: 65, IMPLICIT: 60 };
export const STACK_LIMITS = { numeric: 10, command: 24 };

/** Argument counts accepted by each function (min, max). */
const ARITY = {
  Pol: [2, 2], Rec: [2, 2], ranint: [2, 2], log: [1, 2], integral: [3, 4], diff: [2, 3], sum: [3, 3],
  angle: [2, 2], ssMin: [1, 1], ssMax: [1, 1], ssMean: [1, 1], ssSum: [1, 1]
};

/** Template kinds that act as a value (prefix templates). */
const VALUE_TEMPLATES = new Set(['frac', 'mixed', 'sqrt', 'cbrt', 'root', 'pow10', 'expe', 'logab', 'abs', 'integral', 'diff', 'sum']);

// ------------------------------------------------------------------ lexer

function lexSlot(items, path) {
  const out = [];
  let i = 0;
  const locAt = (idx) => ({ path, idx });
  while (i < items.length) {
    const it = items[i];
    if (it.t === 'tpl') {
      out.push({ k: 'tpl', item: it, index: i, loc: locAt(i), path });
      i++;
      continue;
    }
    const tok = TOKENS[it.id];
    if (!tok) throw new CalcError(ERRORS.SYNTAX, { loc: locAt(i) });
    if (tok.kind === 'digit' || tok.kind === 'dot' || tok.kind === 'exp10') {
      const start = i;
      let mant = '';
      let exp = null;
      let dots = 0;
      let hex = false;
      while (i < items.length && items[i].t === 'tok') {
        const k = TOKENS[items[i].id];
        if (k.kind === 'digit') {
          if (exp !== null) exp += k.text;
          else mant += k.text;
          if (k.hex) hex = true;
          i++;
        } else if (k.kind === 'dot') {
          if (exp !== null) throw new CalcError(ERRORS.SYNTAX, { loc: locAt(i) });
          dots++;
          if (dots > 1) throw new CalcError(ERRORS.SYNTAX, { loc: locAt(i) });
          mant += '.';
          i++;
        } else if (k.kind === 'exp10') {
          if (exp !== null) throw new CalcError(ERRORS.SYNTAX, { loc: locAt(i) });
          exp = '';
          i++;
          if (i < items.length && items[i].t === 'tok' && TOKENS[items[i].id].kind === 'neg') {
            exp = '-';
            i++;
          }
        } else break;
      }
      if (exp !== null && (exp === '' || exp === '-')) throw new CalcError(ERRORS.SYNTAX, { loc: locAt(i) });
      if (mant === '.') throw new CalcError(ERRORS.SYNTAX, { loc: locAt(start) });
      if (mant === '') mant = '1';
      out.push({ k: 'num', mant, exp, decimal: dots > 0 || exp !== null, hex, loc: locAt(start), path });
      continue;
    }
    out.push({ k: tok.kind, tok, id: it.id, loc: locAt(i), path, index: i });
    i++;
  }
  out.push({ k: 'eof', loc: locAt(items.length), path });
  return out;
}

// ------------------------------------------------------------------ parser

export class Parser {
  /**
   * @param {Array} root editor root slot
   * @param {object} opts { baseN: boolean, allowEquals: boolean }
   */
  constructor(root, opts = {}) {
    this.root = root;
    this.opts = opts;
    this.depth = { numeric: 0, command: 0 };
  }

  /** Parse the whole input. Returns { type: 'statements', list: [stmt...] }. */
  parse() {
    const lx = new Stream(lexSlot(this.root, []));
    const list = [];
    if (lx.peek().k === 'eof') throw new CalcError(ERRORS.SYNTAX, { loc: lx.peek().loc });
    for (;;) {
      list.push(this.statement(lx));
      const t = lx.peek();
      if (t.k === 'colon') {
        lx.next();
        if (lx.peek().k === 'eof') break; // trailing colon allowed
        continue;
      }
      if (t.k === 'eof') break;
      throw new CalcError(ERRORS.SYNTAX, { loc: t.loc });
    }
    return { type: 'statements', list };
  }

  /** Parse a single slot as one complete expression (template slots). */
  parseSlot(items, path, { allowEmpty = false } = {}) {
    const lx = new Stream(lexSlot(items, path));
    if (lx.peek().k === 'eof') {
      if (allowEmpty) return null;
      throw new CalcError(ERRORS.SYNTAX, { loc: lx.peek().loc });
    }
    this.push('command');
    const e = this.expr(lx, 0);
    this.pop('command');
    const t = lx.peek();
    if (t.k !== 'eof') throw new CalcError(ERRORS.SYNTAX, { loc: t.loc });
    return e;
  }

  statement(lx) {
    const left = this.expr(lx, 0);
    if (lx.peek().k === 'eq') {
      const eqTok = lx.next();
      if (!this.opts.allowEquals) throw new CalcError(ERRORS.SYNTAX, { loc: eqTok.loc });
      const right = this.expr(lx, 0);
      return { type: 'eq', l: left, r: right, loc: eqTok.loc };
    }
    return left;
  }

  push(kind) {
    this.depth[kind]++;
    if (this.depth[kind] > STACK_LIMITS[kind]) throw new CalcError(ERRORS.STACK);
  }

  pop(kind) {
    this.depth[kind]--;
  }

  /** Pratt loop. */
  expr(lx, rbp) {
    let left = this.nud(lx);
    for (;;) {
      const t = lx.peek();
      const lbp = this.lbp(t);
      if (lbp <= rbp) break;
      left = this.led(lx, left, t);
    }
    return left;
  }

  canStartValue(t) {
    switch (t.k) {
      case 'num': case 'value': case 'open': case 'func': return true;
      case 'prefix': return true;
      case 'tpl': return VALUE_TEMPLATES.has(t.item.kind);
      default: return false;
    }
  }

  lbp(t) {
    switch (t.k) {
      case 'op': return t.tok.prec;
      case 'post': return t.tok.prec || BP.POSTFIX;
      case 'pow': case 'xroot': return BP.POSTFIX;
      case 'linefrac': return BP.FRAC;
      case 'tpl': return t.item.kind === 'pow' ? BP.POSTFIX : BP.IMPLICIT;
      default: return this.canStartValue(t) ? BP.IMPLICIT : 0;
    }
  }

  nud(lx) {
    const t = lx.next();
    switch (t.k) {
      case 'num':
        if (t.hex && !this.opts.baseN) throw new CalcError(ERRORS.SYNTAX, { loc: t.loc });
        return { type: 'num', mant: t.mant, exp: t.exp, decimal: t.decimal, loc: t.loc };
      case 'value':
        return { type: 'value', name: t.tok.name, id: t.id, tok: t.tok, loc: t.loc };
      case 'neg': {
        this.push('command');
        const arg = this.expr(lx, BP.SIGN);
        this.pop('command');
        return { type: 'neg', arg, loc: t.loc };
      }
      case 'prefix': {
        const arg = this.expr(lx, BP.SIGN);
        return { type: 'prefix', fn: t.tok.fn, arg, loc: t.loc };
      }
      case 'open': {
        this.push('command');
        const inner = this.expr(lx, 0);
        this.pop('command');
        this.closeParen(lx);
        return { type: 'paren', arg: inner, loc: t.loc };
      }
      case 'func': {
        this.push('command');
        const args = this.argList(lx, t);
        this.pop('command');
        return { type: 'call', fn: t.tok.fn, args, loc: t.loc };
      }
      case 'tpl':
        if (!VALUE_TEMPLATES.has(t.item.kind)) throw new CalcError(ERRORS.SYNTAX, { loc: t.loc });
        return this.template(t);
      default:
        throw new CalcError(ERRORS.SYNTAX, { loc: t.loc });
    }
  }

  led(lx, left, t) {
    switch (t.k) {
      case 'op': {
        lx.next();
        this.push('numeric');
        this.push('command');
        const right = this.expr(lx, t.tok.prec);
        this.pop('command');
        this.pop('numeric');
        return { type: 'bin', op: t.tok.op, l: left, r: right, loc: t.loc };
      }
      case 'post':
        lx.next();
        if (t.tok.op === 'dms') return this.dms(lx, left, t);
        return { type: 'post', op: t.tok.op, tok: t.tok, id: t.id, arg: left, loc: t.loc };
      case 'pow': {
        lx.next();
        this.push('numeric');
        this.push('command');
        const exp = this.expr(lx, 0);
        this.closeParen(lx);
        this.pop('command');
        this.pop('numeric');
        return { type: 'bin', op: '^', l: left, r: exp, loc: t.loc };
      }
      case 'xroot': {
        lx.next();
        this.push('numeric');
        this.push('command');
        const rad = this.expr(lx, 0);
        this.closeParen(lx);
        this.pop('command');
        this.pop('numeric');
        return { type: 'root', index: left, arg: rad, loc: t.loc };
      }
      case 'linefrac': {
        lx.next();
        this.push('numeric');
        const den = this.expr(lx, BP.FRAC);
        if (lx.peek().k === 'linefrac') {
          lx.next();
          const den2 = this.expr(lx, BP.FRAC);
          this.pop('numeric');
          return { type: 'mixed', whole: left, num: den, den: den2, loc: t.loc };
        }
        this.pop('numeric');
        return { type: 'frac', num: left, den, loc: t.loc };
      }
      case 'tpl':
        if (t.item.kind === 'pow') {
          lx.next();
          const exp = this.parseSlot(t.item.slots[0], [...t.path, { i: t.index, s: 0 }]);
          return { type: 'bin', op: '^', l: left, r: exp, loc: t.loc, tpl: true };
        }
      // falls through: a value template after a value is an omitted multiplication
      default: {
        if (!this.canStartValue(t)) throw new CalcError(ERRORS.SYNTAX, { loc: t.loc });
        this.push('numeric');
        this.push('command');
        const right = this.expr(lx, BP.IMPLICIT);
        this.pop('command');
        this.pop('numeric');
        return { type: 'bin', op: '*', implicit: true, l: left, r: right, loc: t.loc };
      }
    }
  }

  /** Closing bracket; may be omitted at the end of the input or before ':'. */
  closeParen(lx) {
    const t = lx.peek();
    if (t.k === 'close') {
      lx.next();
      return;
    }
    if (t.k === 'eof' || t.k === 'colon' || t.k === 'eq') return;
    throw new CalcError(ERRORS.SYNTAX, { loc: t.loc });
  }

  argList(lx, fnTok) {
    const args = [];
    if (lx.peek().k === 'close') throw new CalcError(ERRORS.SYNTAX, { loc: lx.peek().loc });
    args.push(this.expr(lx, 0));
    while (lx.peek().k === 'comma') {
      lx.next();
      args.push(this.expr(lx, 0));
    }
    this.closeParen(lx);
    const ar = ARITY[fnTok.tok.fn] || [1, 1];
    if (args.length < ar[0] || args.length > ar[1]) throw new CalcError(ERRORS.SYNTAX, { loc: fnTok.loc });
    return args;
  }

  /** d°m°s° — the °'" key after each part. */
  dms(lx, left, t) {
    const node = { type: 'dms', d: left, m: null, s: null, loc: t.loc };
    for (const part of ['m', 's']) {
      const a = lx.peek();
      const b = lx.peekAt(1);
      if ((a.k === 'num' || a.k === 'value') && b.k === 'post' && b.tok.op === 'dms') {
        lx.next();
        lx.next();
        node[part] = a.k === 'num'
          ? { type: 'num', mant: a.mant, exp: a.exp, decimal: a.decimal, loc: a.loc }
          : { type: 'value', name: a.tok.name, id: a.id, tok: a.tok, loc: a.loc };
      } else break;
    }
    return node;
  }

  template(t) {
    const it = t.item;
    const base = [...t.path];
    const slotPath = (s) => [...base, { i: t.index, s }];
    this.push('command');
    const p = (s, opts) => this.parseSlot(it.slots[s], slotPath(s), opts);
    let node;
    switch (it.kind) {
      case 'frac': node = { type: 'frac', num: p(0), den: p(1) }; break;
      case 'mixed': node = { type: 'mixed', whole: p(0), num: p(1), den: p(2) }; break;
      case 'sqrt': node = { type: 'call', fn: 'sqrt', args: [p(0)] }; break;
      case 'cbrt': node = { type: 'call', fn: 'cbrt', args: [p(0)] }; break;
      case 'root': node = { type: 'root', index: p(0), arg: p(1) }; break;
      case 'pow10': node = { type: 'call', fn: 'pow10', args: [p(0)] }; break;
      case 'expe': node = { type: 'call', fn: 'expe', args: [p(0)] }; break;
      case 'logab': node = { type: 'call', fn: 'log', args: [p(0), p(1)] }; break;
      case 'abs': node = { type: 'call', fn: 'abs', args: [p(0)] }; break;
      case 'integral': node = { type: 'call', fn: 'integral', args: [p(0), p(1), p(2)] }; break;
      case 'diff': node = { type: 'call', fn: 'diff', args: [p(0), p(1)] }; break;
      case 'sum': node = { type: 'call', fn: 'sum', args: [p(0), p(1), p(2)] }; break;
      default: throw new CalcError(ERRORS.SYNTAX, { loc: t.loc });
    }
    this.pop('command');
    node.loc = t.loc;
    node.template = true;
    return node;
  }
}

class Stream {
  constructor(list) {
    this.list = list;
    this.pos = 0;
  }
  peek() {
    return this.list[this.pos];
  }
  peekAt(n) {
    return this.list[Math.min(this.pos + n, this.list.length - 1)];
  }
  next() {
    const t = this.list[this.pos];
    if (this.pos < this.list.length - 1) this.pos++;
    return t;
  }
}

/** Convenience: parse an editor root. */
export function parse(root, opts) {
  return new Parser(root, opts).parse();
}

/** True if the AST contains a node matching pred. */
export function astSome(node, pred) {
  if (!node || typeof node !== 'object') return false;
  if (pred(node)) return true;
  for (const key of ['arg', 'l', 'r', 'num', 'den', 'whole', 'd', 'm', 's', 'index']) {
    if (node[key] && astSome(node[key], pred)) return true;
  }
  if (node.args) for (const a of node.args) if (astSome(a, pred)) return true;
  if (node.list) for (const a of node.list) if (astSome(a, pred)) return true;
  return false;
}
