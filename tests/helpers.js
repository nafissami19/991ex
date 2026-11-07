/**
 * Test helpers.
 *   toks('1÷2π')        → editor root items (linear tokens, LineI style)
 *   evalText('1÷2π')    → { value, text } using the real parser + evaluator + display
 * Text notation: digits . + - × ÷ ( ) , : = ² ³ ⁻¹ ! % ° ┘ π e Ans A–F M x y
 *   (-) = negative sign, ^( = power, x√( = root, E = ×10, nPr nCr, sin( cos( … log( ln( √( ∛( Pol( Rec( Abs(
 */

import { TOKENS } from '../js/core/input/tokens.js';
import { parse } from '../js/core/parse/parser.js';
import { Evaluator } from '../js/core/eval/evaluate.js';
import { ResultView } from '../js/core/format/ResultView.js';
import { Memory } from '../js/core/memory.js';
import { defaultSetup, applySetupShorthand } from '../js/core/setup.js';
import { CONSTANT_VALUES } from '../js/core/data/constants.js';
import '../js/core/data/conversions.js';

const EXTRA = {
  '(-)': 'neg', '-': '-', '−': '-', '*': '*', '×': '*', '/': '/', '÷': '/', '^(': 'pow', 'x√(': 'xroot',
  nPr: 'nPr', nCr: 'nCr', E: 'E', π: 'pi', e: 'e', Ans: 'Ans', '°': 'dms', '┘': 'linefrac',
  A: 'var_A', B: 'var_B', C: 'var_C', D: 'var_D', F: 'var_F', M: 'var_M', x: 'var_x', y: 'var_y', Y: 'var_y', 'Ran#': 'Ran#',
  '=': '='
};

const TABLE = new Map();
for (const t of Object.values(TOKENS)) {
  if (['value', 'post', 'op'].includes(t.kind) && t.text.length === 1 && /[A-Za-z]/.test(t.text)) continue;
  if (!TABLE.has(t.text)) TABLE.set(t.text, t.id);
}
for (const [k, v] of Object.entries(EXTRA)) TABLE.set(k, v);
const KEYS = [...TABLE.keys()].sort((a, b) => b.length - a.length);

export function toks(text) {
  const items = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === ' ') {
      i++;
      continue;
    }
    const k = KEYS.find((key) => text.startsWith(key, i));
    if (!k) throw new Error(`toks: cannot read "${text.slice(i)}"`);
    items.push({ t: 'tok', id: TABLE.get(k) });
    i += k.length;
  }
  return items;
}

export function evalText(text, { setup = {}, memory = new Memory(), parseOpts = {} } = {}) {
  const s = applySetupShorthand(defaultSetup(), { inputOutput: 'MathI/MathO', ...setup });
  const ast = parse(toks(text), parseOpts);
  const ev = new Evaluator({ angle: s.angle, memory, numberFormat: s.numberFormat, constants: CONSTANT_VALUES });
  let value;
  for (const st of ast.list) {
    value = ev.run(st);
    memory.setAns(value);
  }
  const view = new ResultView(value, s, { decimalInput: ev.flags.decimalInput });
  return { value, text: view.text(), memory };
}
