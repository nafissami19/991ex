/**
 * Token table for the expression input buffer.
 *
 * Every key press inserts either a token (an atom of the expression) or a
 * template (a 2-D structure with slots, MathI only). The parser works on these
 * ids, never on display text.
 *
 * Token fields:
 *   id     unique id stored in the buffer
 *   text   display text (MathI and LineI)
 *   bytes  input-buffer cost (the input holds MAX_INPUT_BYTES)
 *   kind   parser class:
 *          digit | dot | exp10 | op | neg | post | value | func | prefix | open | close |
 *          comma | colon | eq | linefrac | pow | xroot
 * Extra fields depend on kind (op: prec/op, func: fn/args, value: name, post: op).
 *
 * Byte sizes are our best estimate (VERIFY ON EMULATOR): 1 byte for most tokens,
 * 2 bytes for two-byte commands.
 */

export const MAX_INPUT_BYTES = 99;
export const INPUT_WARNING_BYTES = 10;

export const TOKENS = {};

function def(id, text, kind, bytes = 1, extra = {}) {
  TOKENS[id] = { id, text, kind, bytes, ...extra };
}

// Digits, decimal point, ×10ˣ
for (let d = 0; d <= 9; d++) def(String(d), String(d), 'digit', 1, { value: d });
for (const h of ['A', 'B', 'C', 'D', 'E', 'F']) def('hex' + h, h, 'digit', 1, { value: 10 + 'ABCDEF'.indexOf(h), hex: true });
def('.', '.', 'dot');
def('$', '$', 'prefix', 1);
def('E', '×10', 'exp10');

// Binary operators (prec: higher binds tighter)
def('+', '+', 'op', 1, { op: '+', prec: 30 });
def('-', '−', 'op', 1, { op: '-', prec: 30 });
def('*', '×', 'op', 1, { op: '*', prec: 40 });
def('/', '÷', 'op', 1, { op: '/', prec: 40 });
def('dot', '•', 'op', 1, { op: 'dot', prec: 45 });
def('nPr', 'P', 'op', 1, { op: 'nPr', prec: 50 });
def('nCr', 'C', 'op', 1, { op: 'nCr', prec: 50 });
def('angle', '∠', 'op', 1, { op: 'angle', prec: 50 });
def('and', ' and ', 'op', 2, { op: 'and', prec: 20 });
def('or', ' or ', 'op', 2, { op: 'or', prec: 10 });
def('xor', ' xor ', 'op', 2, { op: 'xor', prec: 10 });
def('xnor', ' xnor ', 'op', 2, { op: 'xnor', prec: 10 });

// Prefix sign (−) and Base-N prefixes
def('neg', '-', 'neg');
def('bn_d', 'd', 'prefix', 1, { fn: 'bn_d' });
def('bn_h', 'h', 'prefix', 1, { fn: 'bn_h' });
def('bn_b', 'b', 'prefix', 1, { fn: 'bn_b' });
def('bn_o', 'o', 'prefix', 1, { fn: 'bn_o' });

// Postfix functions (priority 3 unless prec given)
def('sq', '²', 'post', 1, { op: 'sq' });
def('cube', '³', 'post', 1, { op: 'cube' });
def('inv', '⁻¹', 'post', 1, { op: 'inv' });
def('fact', '!', 'post', 1, { op: 'fact' });
def('pct', '%', 'post', 1, { op: 'pct' });
def('dms', '°', 'post', 1, { op: 'dms' });
def('deg', '°', 'post', 1, { op: 'deg' });
def('rad', 'r', 'post', 1, { op: 'rad' });
def('grad', 'g', 'post', 1, { op: 'grad' });
def('tnorm', '▸t', 'post', 2, { op: 'tnorm' });
def('toPolar', '▸r∠θ', 'post', 2, { op: 'toPolar', prec: 5 });
def('toRect', '▸a+bi', 'post', 2, { op: 'toRect', prec: 5 });
// Engineering symbols
export const ENG_SYMBOL_EXP = { m: -3, 'μ': -6, n: -9, p: -12, f: -15, k: 3, M: 6, G: 9, T: 12, P: 15, E: 18 };
for (const [s, e] of Object.entries(ENG_SYMBOL_EXP)) def('eng_' + s, s, 'post', 1, { op: 'eng', exp10: e });
// Statistics estimators (priority 6)
def('xhat', 'x̂', 'post', 2, { op: 'xhat', prec: 65 });
def('xhat1', 'x̂₁', 'post', 2, { op: 'xhat1', prec: 65 });
def('xhat2', 'x̂₂', 'post', 2, { op: 'xhat2', prec: 65 });
def('yhat', 'ŷ', 'post', 2, { op: 'yhat', prec: 65 });

// Values (constants, variables, memories)
def('pi', 'π', 'value', 1, { name: 'pi' });
def('e', 'e', 'value', 1, { name: 'e' });
def('i', 'i', 'value', 1, { name: 'i' });
def('Ans', 'Ans', 'value', 1, { name: 'Ans' });
def('PreAns', 'PreAns', 'value', 2, { name: 'PreAns' });
for (const v of ['A', 'B', 'C', 'D', 'E', 'F', 'M', 'x', 'y']) def('var_' + v, v, 'value', 1, { name: 'var', variable: v });
def('Ran#', 'Ran#', 'value', 2, { name: 'ran' });
for (const m of ['A', 'B', 'C', 'D', 'Ans']) {
  def('Mat' + m, 'Mat' + m, 'value', 2, { name: 'mat', ref: 'Mat' + m });
  def('Vct' + m, 'Vct' + m, 'value', 2, { name: 'vct', ref: 'Vct' + m });
}

// Prefix functions that open a bracket: text includes "("
function fn(id, text, name, bytes = 1, extra = {}) {
  def(id, text, 'func', bytes, { fn: name, ...extra });
}
fn('sin', 'sin(', 'sin');
fn('cos', 'cos(', 'cos');
fn('tan', 'tan(', 'tan');
fn('asin', 'sin⁻¹(', 'asin', 2);
fn('acos', 'cos⁻¹(', 'acos', 2);
fn('atan', 'tan⁻¹(', 'atan', 2);
fn('sinh', 'sinh(', 'sinh', 2);
fn('cosh', 'cosh(', 'cosh', 2);
fn('tanh', 'tanh(', 'tanh', 2);
fn('asinh', 'sinh⁻¹(', 'asinh', 2);
fn('acosh', 'cosh⁻¹(', 'acosh', 2);
fn('atanh', 'tanh⁻¹(', 'atanh', 2);
fn('log', 'log(', 'log');
fn('ln', 'ln(', 'ln');
fn('Pol', 'Pol(', 'Pol', 2);
fn('Rec', 'Rec(', 'Rec', 2);
fn('Abs', 'Abs(', 'abs', 2);
fn('Int', 'Int(', 'int', 2);
fn('Intg', 'Intg(', 'intg', 2);
fn('Rnd', 'Rnd(', 'rnd', 2);
fn('RanInt', 'RanInt#(', 'ranint', 2);
// LineI forms of the MathI templates
fn('sqrt', '√(', 'sqrt');
fn('cbrt', '∛(', 'cbrt', 2);
fn('expe', 'e^(', 'expe', 2);
fn('pow10', '10^(', 'pow10', 2);
fn('integ', '∫(', 'integral', 2);
fn('diff', 'd/dx(', 'diff', 2);
fn('sum', 'Σ(', 'sum', 2);
// Mode-specific commands
fn('Arg', 'Arg(', 'arg', 2);
fn('Conjg', 'Conjg(', 'conjg', 2);
fn('ReP', 'ReP(', 'rep', 2);
fn('ImP', 'ImP(', 'imp', 2);
fn('Det', 'Det(', 'det', 2);
fn('Trn', 'Trn(', 'trn', 2);
fn('Identity', 'Identity(', 'identity', 2);
fn('Ref', 'Ref(', 'ref', 2);
fn('Rref', 'Rref(', 'rref', 2);
fn('Angle', 'Angle(', 'angle', 2);
fn('UnitV', 'UnitV(', 'unitv', 2);
fn('Not', 'Not(', 'not', 2);
fn('Neg', 'Neg(', 'negb', 2);
fn('Pdist', 'P(', 'normP', 2);
fn('Qdist', 'Q(', 'normQ', 2);
fn('Rdist', 'R(', 'normR', 2);
fn('Min', 'Min(', 'ssMin', 2);
fn('Max', 'Max(', 'ssMax', 2);
fn('Mean', 'Mean(', 'ssMean', 2);
fn('Sum', 'Sum(', 'ssSum', 2);

// Brackets and separators
def('(', '(', 'open');
def(')', ')', 'close');
def(',', ',', 'comma');
def(':', ':', 'colon');
def('=', '=', 'eq');
def('linefrac', '┘', 'linefrac');
def('pow', '^(', 'pow');
def('xroot', 'x√(', 'xroot', 2);

/**
 * Templates (MathI only). `slots` lists slot names in cursor (input) order.
 * `postfix` templates apply to the value on their left (x■).
 */
export const TEMPLATES = {
  frac: { slots: ['num', 'den'], bytes: 2 },
  mixed: { slots: ['whole', 'num', 'den'], bytes: 3 },
  sqrt: { slots: ['arg'], bytes: 2 },
  cbrt: { slots: ['arg'], bytes: 2 },
  root: { slots: ['index', 'arg'], bytes: 2 },
  pow: { slots: ['exp'], bytes: 2, postfix: true },
  pow10: { slots: ['exp'], bytes: 2 },
  expe: { slots: ['exp'], bytes: 2 },
  logab: { slots: ['base', 'arg'], bytes: 2 },
  abs: { slots: ['arg'], bytes: 2 },
  integral: { slots: ['f', 'a', 'b'], bytes: 3 },
  diff: { slots: ['f', 'a'], bytes: 3 },
  sum: { slots: ['f', 'a', 'b'], bytes: 3 }
};

/** Input text of a token id (falls back to the id itself). */
export function tokenText(id) {
  return TOKENS[id] ? TOKENS[id].text : id;
}

/** Register extra value/post tokens at runtime (constants, conversions, stat variables). */
export function registerToken(id, text, kind, bytes = 2, extra = {}) {
  if (!TOKENS[id]) def(id, text, kind, bytes, extra);
  return TOKENS[id];
}
