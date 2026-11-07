/**
 * Physical key names (same as the "name" field in assets/data/key_layout.json)
 * and the aliases accepted by Calculator.press()/pressSequence() in tests.
 *
 * Labels follow the fx-991EX faceplate:
 *   SHIFT functions:  OPTN→QR, CALC→SOLVE, ∫→d/dx, x→Σ, ■/□→mixed fraction, √→∛, x²→x³,
 *     x■→■√□, log■□→10■, ln→e■, (−)→log, °'"→FACT, x⁻¹→x!, sin/cos/tan→inverse, STO→RECALL,
 *     ENG→←, (→Abs, )→',', S⇔D→a b/c⇔d/c, M+→M−, 7→CONST, 8→CONV, 9→RESET, DEL→INS, AC→OFF,
 *     ×→nPr, ÷→nCr, +→Pol, −→Rec, 0→Rnd, .→Ran#, ×10ˣ→π, Ans→%, =→≈
 *   ALPHA functions:  CALC→'=', ∫→':', (−)→A, °'"→B, x⁻¹→C, sin→D, cos→E, tan→F, )→x, S⇔D→y,
 *     M+→M, DEL→UNDO, .→RanInt, ×10ˣ→e
 */

export const KEY_NAMES = [
  'SHIFT', 'ALPHA', 'MENU', 'ON', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'OPTN', 'CALC', 'INTEGRAL', 'X',
  'FRAC', 'SQRT', 'SQUARE', 'POWER', 'LOG_AB', 'LN', 'NEG', 'DEG', 'INV', 'SIN', 'COS', 'TAN',
  'STO', 'ENG', 'LPAREN', 'RPAREN', 'SD', 'M_PLUS', '7', '8', '9', 'DEL', 'AC', '4', '5', '6',
  'MUL', 'DIV', '1', '2', '3', 'ADD', 'SUB', '0', 'DOT', 'EXP', 'ANS', 'EXE'
];

const KEY_SET = new Set(KEY_NAMES);

/** Aliases that map to a single physical key (SHIFT/ALPHA must be pressed separately). */
const ALIASES = {
  '=': 'EXE', 'ENTER': 'EXE', '≈': 'EXE',
  '+': 'ADD', '-': 'SUB', '−': 'SUB', '*': 'MUL', '×': 'MUL', '/': 'DIV', '÷': 'DIV',
  '.': 'DOT', '(': 'LPAREN', ')': 'RPAREN',
  '√': 'SQRT', '√■': 'SQRT', '∛': 'SQRT',
  'x²': 'SQUARE', 'x³': 'SQUARE',
  '^': 'POWER', 'x■': 'POWER', '■√□': 'POWER',
  'log■□': 'LOG_AB', 'logab': 'LOG_AB', '10■': 'LOG_AB',
  'ln': 'LN',
  '(-)': 'NEG', '(−)': 'NEG',
  "°'\"": 'DEG', "° ' \"": 'DEG', '°': 'DEG', 'DMS': 'DEG', 'FACT': 'DEG',
  'x⁻¹': 'INV', 'x!': 'INV',
  'sin': 'SIN', 'cos': 'COS', 'tan': 'TAN', 'sin⁻¹': 'SIN', 'cos⁻¹': 'COS', 'tan⁻¹': 'TAN',
  'RECALL': 'STO', 'RCL': 'STO',
  '←': 'ENG', 'i': 'ENG',
  'S<=>D': 'SD', 'S⇔D': 'SD',
  'M+': 'M_PLUS', 'M-': 'M_PLUS', 'M−': 'M_PLUS',
  'CONST': '7', 'CONV': '8', 'RESET': '9',
  'BACKSPACE': 'DEL', 'INS': 'DEL', 'UNDO': 'DEL',
  'ESC': 'AC', 'ESCAPE': 'AC',
  'nPr': 'MUL', 'nCr': 'DIV', 'Pol': 'ADD', 'Rec': 'SUB',
  'Rnd': '0', 'Ran#': 'DOT', 'RanInt': 'DOT',
  '×10ˣ': 'EXP', '×10ⁿ': 'EXP', 'x10^x': 'EXP',
  'Ans': 'ANS',
  'SETUP': 'MENU', 'QR': 'OPTN',
  '∫': 'INTEGRAL', 'x': 'X',
  '▲': 'UP', '▼': 'DOWN', '◀': 'LEFT', '▶': 'RIGHT',
  'ARROWUP': 'UP', 'ARROWDOWN': 'DOWN', 'ARROWLEFT': 'LEFT', 'ARROWRIGHT': 'RIGHT',
  'DEC': 'SQUARE', 'HEX': 'POWER', 'BIN': 'LOG_AB', 'OCT': 'LN',
  'hexA': 'NEG', 'hexB': 'DEG', 'hexC': 'INV', 'hexD': 'SIN', 'hexE': 'COS', 'hexF': 'TAN'
};

/** Aliases that expand to a key sequence (convenience for tests). */
const SEQUENCE_ALIASES = {
  '==': ['ALPHA', 'CALC'],
  'OFF': ['SHIFT', 'AC'],
  'SOLVE': ['SHIFT', 'CALC'],
  'Abs': ['SHIFT', 'LPAREN'],
  'd/dx': ['SHIFT', 'INTEGRAL'],
  'Σ': ['SHIFT', 'X'],
  '∠': ['SHIFT', 'ENG'], 'angle': ['SHIFT', 'ENG'],
  'Arg': ['OPTN', '1'],
  'Conjg': ['OPTN', '2'],
  'ReP': ['OPTN', '3'],
  'ImP': ['OPTN', '4'],
  '▸r∠θ': ['OPTN', 'DOWN', '1'],
  '▸a+bi': ['OPTN', 'DOWN', '2'],
  'and': ['OPTN', '1'],
  'or': ['OPTN', '2'],
  'xor': ['OPTN', '3'],
  'xnor': ['OPTN', '4'],
  'Not': ['OPTN', 'DOWN', '1'],
  'Neg': ['OPTN', 'DOWN', '2'],
  'bn_d': ['OPTN', 'DOWN', 'DOWN', '1'],
  'bn_h': ['OPTN', 'DOWN', 'DOWN', '2'],
  'bn_b': ['OPTN', 'DOWN', 'DOWN', '3'],
  'bn_o': ['OPTN', 'DOWN', 'DOWN', '4'],
  'd': ['OPTN', 'DOWN', 'DOWN', '1'],
  'h': ['OPTN', 'DOWN', 'DOWN', '2'],
  'b': ['OPTN', 'DOWN', 'DOWN', '3'],
  'o': ['OPTN', 'DOWN', 'DOWN', '4'],
  'MatA': ['OPTN', '3'],
  'MatB': ['OPTN', '4'],
  'MatC': ['OPTN', '5'],
  'MatD': ['OPTN', '6'],
  'MatAns': ['OPTN', 'DOWN', '1'],
  'Det': ['OPTN', 'DOWN', '2'],
  'Trn': ['OPTN', 'DOWN', '3'],
  'Identity': ['OPTN', 'DOWN', '4'],
  'x³': ['SHIFT', 'SQUARE'],
  'VctA': ['OPTN', '3'],
  'VctB': ['OPTN', '4'],
  'VctC': ['OPTN', '5'],
  'VctD': ['OPTN', '6'],
  'VctAns': ['OPTN', 'DOWN', '1'],
  '•': ['OPTN', 'DOWN', '2'],
  'dot': ['OPTN', 'DOWN', '2'],
  'Angle': ['OPTN', 'DOWN', '3'],
  'UnitV': ['OPTN', 'DOWN', '4'],
  'UnitVector': ['OPTN', 'DOWN', '4'],
  'PreAns': ['ALPHA', 'ANS'],
  'log': ['SHIFT', 'NEG'],
  'e^': ['SHIFT', 'LN'],
  'e■': ['SHIFT', 'LN'],
  'π': ['SHIFT', 'EXP'],
  'e': ['ALPHA', 'EXP'],
  ',': ['SHIFT', 'RPAREN'],
  ':': ['ALPHA', 'INTEGRAL'],
  '$': ['OPTN', '1'],
  '%': ['SHIFT', 'ANS'],
  'A': ['ALPHA', 'NEG'], 'B': ['ALPHA', 'DEG'], 'C': ['ALPHA', 'INV'],
  'D': ['ALPHA', 'SIN'], 'E': ['ALPHA', 'COS'], 'F': ['ALPHA', 'TAN'],
  'M': ['ALPHA', 'M_PLUS'], 'y': ['ALPHA', 'SD'], 'Y': ['ALPHA', 'SD']
};

/**
 * Resolve a key name or alias to a list of physical key names.
 * Returns [] for unknown keys.
 */
export function resolveKey(name) {
  if (name === undefined || name === null) return [];
  const raw = String(name).trim();
  if (raw === '') return [];
  if (KEY_SET.has(raw)) return [raw];
  if (SEQUENCE_ALIASES[raw]) return SEQUENCE_ALIASES[raw];
  if (ALIASES[raw]) return [ALIASES[raw]];
  const up = raw.toUpperCase();
  if (KEY_SET.has(up)) return [up];
  if (ALIASES[up]) return [ALIASES[up]];
  return [];
}

/** Variable selected by a key (used after STO, RECALL, ALPHA). */
export const VARIABLE_KEYS = {
  NEG: 'A', DEG: 'B', INV: 'C', SIN: 'D', COS: 'E', TAN: 'F', M_PLUS: 'M', RPAREN: 'x', X: 'x', SD: 'y'
};

export const DIGIT_KEYS = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
