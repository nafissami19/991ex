/**
 * Display trees and text.
 *
 * A display tree uses the same items as the editor, plus two display-only items:
 *   { t: 'txt', s }                       literal text
 *   { t: 'tpl', kind: 'sup', slots: [[]]} superscript (exponents in results)
 * The LCD layout engine draws trees; `treeToText` gives the one-line text used by
 * tests and screen.lines (e.g. "5/6", "2√2", "√3/2", "1.23456789×10¹⁰").
 */

import { TOKENS } from '../input/tokens.js';
import { formatNumber, toSuperscript } from './formatNumber.js';
import { Decimal15 } from '../number/Decimal15.js';
import { Rational } from '../exact/Rational.js';

export const txt = (s) => ({ t: 'txt', s: String(s) });
export const tok = (id) => ({ t: 'tok', id });
export const tpl = (kind, ...slots) => ({ t: 'tpl', kind, slots });
export const MINUS = '−';

// ---------------------------------------------------------------- tree → text

function isAtomic(items) {
  if (items.length !== 1) return false;
  const it = items[0];
  if (it.t === 'txt') return !/[+−\-×÷ ]/.test(it.s.slice(1));
  return true;
}

function wrap(items) {
  const s = treeToText(items);
  return isAtomic(items) ? s : `(${s})`;
}

const SUP_OK = /^[0-9−\-+.]*$/;

export function treeToText(items) {
  let out = '';
  for (const it of items) {
    if (it.t === 'txt') out += it.s;
    else if (it.t === 'tok') out += TOKENS[it.id] ? TOKENS[it.id].text : it.id;
    else if (it.t === 'tpl') out += templateText(it);
  }
  return out;
}

function templateText(it) {
  const s = it.slots;
  const T = (i) => treeToText(s[i]);
  switch (it.kind) {
    case 'frac': {
      const num = treeToText(s[0]);
      const den = wrap(s[1]);
      const numText = /[+−\-]/.test(num.slice(1)) ? `(${num})` : num;
      return `${numText}/${den}`;
    }
    case 'mixed': return `${T(0)} ${T(1)}/${T(2)}`;
    case 'sqrt': return `√${wrap(s[0])}`;
    case 'cbrt': return `∛${wrap(s[0])}`;
    case 'root': return `${wrap(s[0])}√${wrap(s[1])}`;
    case 'sup': {
      const e = T(0);
      return SUP_OK.test(e) ? toSuperscript(e.replace('−', '-')) : `^(${e})`;
    }
    case 'pow': {
      const e = T(0);
      return /^[0-9]+$/.test(e) ? toSuperscript(e) : `^(${e})`;
    }
    case 'pow10': return `10^(${T(0)})`;
    case 'expe': return `e^(${T(0)})`;
    case 'logab': return `log_${wrap(s[0])}(${T(1)})`;
    case 'abs': return `|${T(0)}|`;
    case 'integral': return `∫(${T(0)},${T(1)},${T(2)})`;
    case 'diff': return `d/dx(${T(0)},${T(1)})`;
    case 'sum': return `Σ(${T(0)},${T(1)},${T(2)})`;
    default: return '?';
  }
}

// ---------------------------------------------------------------- numbers

const signText = (neg) => (neg ? MINUS : '');

/** Decimal result → tree (mantissa, "×10", superscript exponent). */
export function decimalTree(dec, opts = {}) {
  const f = formatNumber(dec, {
    format: opts.numberFormat,
    engOffset: opts.engOffset ?? null,
    engSymbols: opts.engSymbols,
    decimalMark: opts.decimalMark,
    digitSeparator: opts.digitSeparator
  });
  let mant = f.mantissa !== undefined ? f.mantissa : f.fullString;
  if (f.sign < 0 && !mant.startsWith('-')) mant = '-' + mant;
  mant = mant.replace(/^-/, MINUS);
  const items = [txt(mant)];
  if (f.engSymbol) items.push(txt(f.engSymbol.replace('µ', 'μ')));
  else if (f.isExponential && f.exponent !== null && f.exponent !== undefined) {
    items.push(txt('×10'));
    items.push(tpl('sup', [txt(String(f.exponent).replace('-', MINUS))]));
  }
  return items;
}

export function bigText(n) {
  return (n < 0n ? MINUS : '') + (n < 0n ? -n : n).toString();
}

/** Rational → tree. mixed=true shows a mixed fraction when |x| > 1. */
export function rationalTree(r, mixed = false, line = false) {
  if (r.d === 1n) return [txt(bigText(r.n))];
  const neg = r.n < 0n;
  const absN = neg ? -r.n : r.n;
  if (mixed && absN > r.d) {
    const whole = absN / r.d;
    const rem = absN % r.d;
    if (line) return [txt(`${signText(neg)}${whole}┘${rem}┘${r.d}`)];
    return [tpl('mixed', [txt(signText(neg) + whole)], [txt(rem)], [txt(r.d)])];
  }
  if (line) return [txt(`${signText(neg)}${absN}┘${r.d}`)];
  const items = [];
  if (neg) items.push(txt(MINUS));
  items.push(tpl('frac', [txt(absN)], [txt(r.d)]));
  return items;
}

/** SurdForm → tree: a√b/c, (a+b√c)/d, (a√b+c√d)/e. */
export function surdTree(sf) {
  // Rational part first, then roots by descending radicand (guide: √6+2√3, (√6+√2)/4)
  const terms = [...sf.terms.entries()].sort((a, b) => (a[0] > b[0] ? -1 : a[0] < b[0] ? 1 : 0));
  const c0 = sf.constant;
  let L = c0.d;
  for (const [, c] of terms) L = Rational.lcm(L, c.d);
  const scaled = terms.map(([s, c]) => [s, c.n * (L / c.d)]);
  const k0 = c0.n * (L / c0.d);
  const num = [];
  let first = true;
  const push = (n, s) => {
    const neg = n < 0n;
    const a = neg ? -n : n;
    if (first) {
      if (neg) num.push(txt(MINUS));
    } else num.push(txt(neg ? MINUS : '+'));
    if (s === null) num.push(txt(a));
    else {
      if (a !== 1n) num.push(txt(a));
      num.push(tpl('sqrt', [txt(s)]));
    }
    first = false;
  };
  if (k0 !== 0n) push(k0, null);
  for (const [s, n] of scaled) push(n, s);
  if (L === 1n) return num;
  // Single negative term: put the sign in front of the fraction
  if (k0 === 0n && scaled.length === 1 && scaled[0][1] < 0n) {
    return [txt(MINUS), tpl('frac', num.slice(1), [txt(L)])];
  }
  return [tpl('frac', num, [txt(L)])];
}

/** PiForm → tree: π, 2π, 1/6π (fraction then π), 1/(2π). */
export function piTree(pf) {
  const q = pf.q;
  const neg = q.n < 0n;
  const a = neg ? -q.n : q.n;
  const items = [];
  if (pf.power === -1) {
    if (neg) items.push(txt(MINUS));
    const den = q.d === 1n ? [tok('pi')] : [txt(q.d), tok('pi')];
    items.push(tpl('frac', [txt(a)], den));
    return items;
  }
  if (neg) items.push(txt(MINUS));
  if (q.d === 1n) {
    if (a !== 1n) items.push(txt(a));
  } else {
    items.push(tpl('frac', [txt(a)], [txt(q.d)]));
  }
  items.push(tok('pi'));
  return items;
}

/** Sexagesimal display d°m's" from a Decimal15 value (10 display digits). */
export function dmsTree(dec) {
  const neg = dec.sign < 0;
  const v = dec.abs();
  let d = v.trunc();
  let rest = v.sub(d).mul(Decimal15.fromInt(60));
  let m = rest.trunc();
  let s = rest.sub(m).mul(Decimal15.fromInt(60));
  // Round seconds so that the whole display uses at most 10 digits
  const used = d.toBigInt().toString().length + m.toBigInt().toString().length;
  const decimals = Math.max(0, Math.min(2, 10 - used - 2));
  s = Decimal15.fromString(s.toFixed(decimals));
  if (s.gte(Decimal15.fromInt(60))) {
    s = s.sub(Decimal15.fromInt(60));
    m = m.add(Decimal15.ONE);
  }
  if (m.gte(Decimal15.fromInt(60))) {
    m = m.sub(Decimal15.fromInt(60));
    d = d.add(Decimal15.ONE);
  }
  let sText = s.toFixed(decimals);
  if (sText.includes('.')) sText = sText.replace(/\.?0+$/, '');
  return [txt(`${neg ? MINUS : ''}${d.toBigInt()}°${m.toBigInt()}'${sText}"`)];
}

/** Prime factorisation tree: 2⁵×3²×7, unfactorable remainder in parentheses. */
export function factorTree(factors, remainder) {
  const items = [];
  factors.forEach(([p, e], i) => {
    if (i > 0) items.push(txt('×'));
    items.push(txt(p));
    if (e > 1) items.push(tpl('sup', [txt(e)]));
  });
  if (remainder) {
    if (items.length) items.push(txt('×'));
    items.push(txt(`(${remainder})`));
  }
  return items;
}

export { toSuperscript };
