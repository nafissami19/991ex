/**
 * Key → input action for expression editing (Calculate mode and every screen that
 * edits an expression). Modes can pass `overrides` to change single keys
 * (e.g. Complex: ENG → i, Base-N: sin → hex D).
 *
 * Returns one of:
 *   { tok: id }      insert a token
 *   { tpl: kind }    insert a template (MathI) — LineI uses the token form instead
 *   null             not an input key
 */

const NORMAL = {
  '0': { tok: '0' }, '1': { tok: '1' }, '2': { tok: '2' }, '3': { tok: '3' }, '4': { tok: '4' },
  '5': { tok: '5' }, '6': { tok: '6' }, '7': { tok: '7' }, '8': { tok: '8' }, '9': { tok: '9' },
  DOT: { tok: '.' }, EXP: { tok: 'E' }, ANS: { tok: 'Ans' },
  ADD: { tok: '+' }, SUB: { tok: '-' }, MUL: { tok: '*' }, DIV: { tok: '/' },
  LPAREN: { tok: '(' }, RPAREN: { tok: ')' }, NEG: { tok: 'neg' },
  DEG: { tok: 'dms' }, INV: { tok: 'inv' }, SQUARE: { tok: 'sq' },
  SIN: { tok: 'sin' }, COS: { tok: 'cos' }, TAN: { tok: 'tan' }, LN: { tok: 'ln' },
  LOG_AB: { tpl: 'logab', line: 'log' },
  FRAC: { tpl: 'frac', line: 'linefrac' },
  SQRT: { tpl: 'sqrt', line: 'sqrt' },
  POWER: { tpl: 'pow', line: 'pow' },
  INTEGRAL: { tpl: 'integral', line: 'integ' },
  X: { tok: 'var_x' }
};

const SHIFTED = {
  FRAC: { tpl: 'mixed', line: 'linefrac' },
  SQRT: { tpl: 'cbrt', line: 'cbrt' },
  SQUARE: { tok: 'cube' },
  POWER: { tpl: 'root', line: 'xroot' },
  LOG_AB: { tpl: 'pow10', line: 'pow10' },
  LN: { tpl: 'expe', line: 'expe' },
  NEG: { tok: 'log' },
  INV: { tok: 'fact' },
  SIN: { tok: 'asin' }, COS: { tok: 'acos' }, TAN: { tok: 'atan' },
  LPAREN: { tpl: 'abs', line: 'Abs' },
  RPAREN: { tok: ',' },
  MUL: { tok: 'nPr' }, DIV: { tok: 'nCr' }, ADD: { tok: 'Pol' }, SUB: { tok: 'Rec' },
  '0': { tok: 'Rnd' }, DOT: { tok: 'Ran#' }, EXP: { tok: 'pi' }, ANS: { tok: 'pct' },
  INTEGRAL: { tpl: 'diff', line: 'diff' },
  X: { tpl: 'sum', line: 'sum' }
};

const ALPHA = {
  NEG: { tok: 'var_A' }, DEG: { tok: 'var_B' }, INV: { tok: 'var_C' },
  SIN: { tok: 'var_D' }, COS: { tok: 'var_E' }, TAN: { tok: 'var_F' },
  RPAREN: { tok: 'var_x' }, SD: { tok: 'var_y' }, M_PLUS: { tok: 'var_M' }, X: { tok: 'var_x' },
  CALC: { tok: '=' }, INTEGRAL: { tok: ':' }, DOT: { tok: 'RanInt' }, EXP: { tok: 'e' },
  ANS: { tok: 'PreAns' }
};

/**
 * @param {{key, shift, alpha}} ev
 * @param {{math: boolean, overrides?: {normal?, shift?, alpha?}}} o
 */
export function inputAction(ev, o = {}) {
  const ov = o.overrides || {};
  let a;
  if (ev.shift) a = (ov.shift && ov.shift[ev.key]) !== undefined ? ov.shift[ev.key] : SHIFTED[ev.key];
  else if (ev.alpha) a = (ov.alpha && ov.alpha[ev.key]) !== undefined ? ov.alpha[ev.key] : ALPHA[ev.key];
  else a = (ov.normal && ov.normal[ev.key]) !== undefined ? ov.normal[ev.key] : NORMAL[ev.key];
  if (!a) return null;
  if (a.tpl && o.math === false) return a.line ? { tok: a.line } : null;
  return a;
}

/** Apply an input action to an editor. Returns true if something was inserted. */
export function applyInput(editor, action) {
  if (!action) return false;
  if (action.tpl) return editor.insertTemplate(action.tpl);
  if (action.tok) return editor.insertToken(action.tok);
  return false;
}

/** Keys that continue from the previous result by inserting "Ans" first. */
export const CONTINUE_KEYS = {
  normal: new Set(['ADD', 'SUB', 'MUL', 'DIV', 'SQUARE', 'INV', 'POWER']),
  shift: new Set(['SQUARE', 'INV', 'MUL', 'DIV', 'ANS'])
};

export function isContinueKey(ev, o = {}) {
  if (ev.alpha) return false;
  if (ev.shift && ev.key === 'POWER' && o.math === false) return true; // LineI xroot continues
  return ev.shift ? CONTINUE_KEYS.shift.has(ev.key) : CONTINUE_KEYS.normal.has(ev.key);
}
