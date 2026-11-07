/**
 * Memories that survive AC, mode changes and power off (User's Guide "Using Memory
 * Functions"): Ans, variables A–F, M, x, y. Cleared by RESET → Memory / Initialize All.
 * The fx-991EX has no PreAns.
 *
 * Mode data (matrices, vectors, statistics, spreadsheet, table functions) lives in
 * `modeData`, keyed by mode, and follows the clearing rules in docs/spec/memory.md.
 */

import { ExactValue } from './exact/ExactValue.js';
import { Rational } from './exact/Rational.js';
import { SurdForm } from './exact/SurdForm.js';
import { PiForm } from './exact/PiForm.js';
import { Decimal15 } from './number/Decimal15.js';

export const VARIABLES = ['A', 'B', 'C', 'D', 'E', 'F', 'M', 'x', 'y'];

export class Memory {
  constructor() {
    this.clear();
  }

  clear() {
    this.ans = ExactValue.fromInt(0n);
    this.preAns = ExactValue.fromInt(0n);
    this.vars = {};
    for (const v of VARIABLES) this.vars[v] = ExactValue.fromInt(0n);
    this.modeData = {};
  }

  getAns() {
    return this.ans;
  }

  getPreAns() {
    return this.preAns;
  }

  setAns(v) {
    this.preAns = this.ans;
    this.ans = v;
  }

  getVar(name) {
    return this.vars[name] ?? ExactValue.fromInt(0n);
  }

  setVar(name, v) {
    if (!VARIABLES.includes(name)) throw new Error(`Unknown variable ${name}`);
    this.vars[name] = v;
  }

  isMNonZero() {
    const m = this.vars.M;
    return m instanceof ExactValue ? !m.toDecimal15().isZero() : !!m;
  }

  toJSON() {
    const vars = {};
    for (const v of VARIABLES) vars[v] = serialize(this.vars[v]);
    return { ans: serialize(this.ans), preAns: serialize(this.preAns), vars, modeData: this.modeData };
  }

  static fromJSON(o) {
    const m = new Memory();
    if (!o) return m;
    m.ans = deserialize(o.ans) ?? m.ans;
    m.preAns = deserialize(o.preAns) ?? m.preAns;
    for (const v of VARIABLES) {
      const val = deserialize(o.vars && o.vars[v]);
      if (val) m.vars[v] = val;
    }
    m.modeData = o.modeData || {};
    return m;
  }
}

// ---------------------------------------------------------------- (de)serialisation

export function serialize(v) {
  if (!(v instanceof ExactValue)) {
    if (v && typeof v.toJSON === 'function') return { type: 'json', value: v.toJSON() };
    return null;
  }
  const d = v.toDecimal15();
  const dec = { s: d.sign, m: d.mantissa.toString(), e: d.exp };
  switch (v.type) {
    case 'rational': return { type: 'rational', n: v.value.n.toString(), d: v.value.d.toString() };
    case 'surd': return {
      type: 'surd',
      c: [v.value.constant.n.toString(), v.value.constant.d.toString()],
      t: [...v.value.terms.entries()].map(([s, c]) => [s.toString(), c.n.toString(), c.d.toString()])
    };
    case 'pi': return { type: 'pi', n: v.value.q.n.toString(), d: v.value.q.d.toString(), p: v.value.power };
    default: return { type: 'decimal', dec };
  }
}

export function deserialize(o) {
  if (!o || typeof o !== 'object') return null;
  try {
    switch (o.type) {
      case 'rational': return ExactValue.fromRational(BigInt(o.n), BigInt(o.d));
      case 'surd': {
        const sf = new SurdForm(new Rational(BigInt(o.c[0]), BigInt(o.c[1])),
          o.t.map(([s, n, d]) => ({ radicand: BigInt(s), coeff: new Rational(BigInt(n), BigInt(d)) })));
        return ExactValue.fromSurd(sf);
      }
      case 'pi': return ExactValue.fromPi(new PiForm(new Rational(BigInt(o.n), BigInt(o.d)), o.p));
      case 'decimal': {
        const d = new Decimal15(o.dec.s, BigInt(o.dec.m), o.dec.e);
        return new ExactValue('decimal', d, d);
      }
      default: return null;
    }
  } catch {
    return null;
  }
}
