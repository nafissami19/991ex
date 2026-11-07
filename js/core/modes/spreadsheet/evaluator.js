/**
 * Spreadsheet mode formula evaluator and grid engine for Casio fx-991EX.
 *
 * Implements:
 * - Cell references: relative and absolute ($A1, A$1, $A$1)
 * - Formula shifting during Copy & Paste and Fill Formula
 * - Range functions: Sum, Mean, Min, Max
 * - Arithmetic, omitted multiplication, math functions via Decimal15
 * - Circular dependency detection (Circular ERROR)
 * - Reference chain depth limit (Memory ERROR)
 * - 1,700-byte capacity enforcement (Memory ERROR)
 */

import { Decimal15 } from '../../number/Decimal15.js';
import * as fn from '../../number/functions.js';
import { CalcError, ERRORS } from '../../errors.js';

export const MAX_ROWS = 45;
export const MAX_COLS = 5; // A..E
export const TOTAL_CAPACITY_BYTES = 1700;
export const MAX_FORMULA_BYTES = 49;
export const MAX_CONSTANT_BYTES = 10;
export const FORMULA_OVERHEAD_BYTES = 11;
export const MAX_CHAIN_DEPTH = 30;

export function colToIdx(col) {
  if (typeof col === 'number') return col;
  const c = String(col).trim().toUpperCase();
  const idx = c.charCodeAt(0) - 65;
  return idx >= 0 && idx < MAX_COLS ? idx : -1;
}

export function idxToCol(idx) {
  return String.fromCharCode(65 + idx);
}

export function formatCellCoord(col, row) {
  return `${idxToCol(colToIdx(col))}${row}`;
}

/**
 * Parse a single cell reference string such as "$A$1", "A1", "$B3", "C$4".
 * Returns { col: 0..4, row: 1..45, absCol: boolean, absRow: boolean } or null.
 */
export function parseCellRef(ref) {
  const m = String(ref).trim().match(/^(\$?)([A-Ea-e])(\$?)([1-9][0-9]?)$/);
  if (!m) return null;
  const col = colToIdx(m[2]);
  const row = parseInt(m[4], 10);
  if (col < 0 || col >= MAX_COLS || row < 1 || row > MAX_ROWS) return null;
  return {
    col,
    row,
    absCol: m[1] === '$',
    absRow: m[3] === '$'
  };
}

/**
 * Parse a range string such as "A1:B3", "A1 : A1".
 * Returns { startCol, startRow, endCol, endRow, minCol, maxCol, minRow, maxRow }
 * Throws Range ERROR if invalid.
 */
export function parseRange(rangeStr) {
  const parts = String(rangeStr).split(':');
  if (parts.length !== 2) throw new CalcError(ERRORS.RANGE);
  const p1 = parseCellRef(parts[0]);
  const p2 = parseCellRef(parts[1]);
  if (!p1 || !p2) throw new CalcError(ERRORS.RANGE);

  return {
    startCol: p1.col,
    startRow: p1.row,
    endCol: p2.col,
    endRow: p2.row,
    minCol: Math.min(p1.col, p2.col),
    maxCol: Math.max(p1.col, p2.col),
    minRow: Math.min(p1.row, p2.row),
    maxRow: Math.max(p1.row, p2.row)
  };
}

/**
 * Shift cell references in a formula by dCol and dRow.
 * Absolute references ($) remain untouched.
 * Out-of-bounds references become '?'.
 */
export function shiftFormula(formula, dCol, dRow) {
  if (!formula) return '';
  // Match cell references: optional $, A-E, optional $, 1-45
  // We avoid matching function names like Max/Min/Sum/Mean
  return formula.replace(/(\$?)([A-Ea-e])(\$?)([1-9][0-9]?)/g, (match, dolCol, colChar, dolRow, rowStr, offset, full) => {
    // Check if preceded by a letter (e.g. within a word like SIN)
    if (offset > 0 && /[a-zA-Z_]/.test(full[offset - 1])) {
      return match;
    }
    const cIdx = colToIdx(colChar);
    const rIdx = parseInt(rowStr, 10);
    const absCol = dolCol === '$';
    const absRow = dolRow === '$';

    const newCol = absCol ? cIdx : cIdx + dCol;
    const newRow = absRow ? rIdx : rIdx + dRow;

    const colPart = newCol >= 0 && newCol < MAX_COLS ? (absCol ? '$' : '') + idxToCol(newCol) : '?';
    const rowPart = newRow >= 1 && newRow <= MAX_ROWS ? (absRow ? '$' : '') + newRow : '?';

    return `${colPart}${rowPart}`;
  });
}

/**
 * Tokenize a formula or expression string for evaluation.
 */
export function tokenize(str) {
  const tokens = [];
  let s = str.trim();
  if (s.startsWith('=')) s = s.slice(1).trim();

  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Numbers: 123, 1.23, 1e5
    if (/[0-9.]/.test(ch)) {
      let num = '';
      let hasDot = false;
      while (i < s.length && (/[0-9]/.test(s[i]) || (s[i] === '.' && !hasDot))) {
        if (s[i] === '.') hasDot = true;
        num += s[i++];
      }
      if (i < s.length && (s[i] === 'e' || s[i] === 'E')) {
        let exp = s[i++];
        if (i < s.length && (s[i] === '+' || s[i] === '-')) exp += s[i++];
        while (i < s.length && /[0-9]/.test(s[i])) exp += s[i++];
        num += exp;
      }
      tokens.push({ type: 'num', value: num });
      continue;
    }

    // Range functions: Sum(, Mean(, Min(, Max(
    const rangeMatch = s.slice(i).match(/^(Sum|Mean|Min|Max)\s*\(/i);
    if (rangeMatch) {
      tokens.push({ type: 'range_fn', value: rangeMatch[1].toUpperCase() });
      i += rangeMatch[0].length;
      continue;
    }

    // Math functions: sin(, cos(, tan(, sqrt(, etc.
    const mathMatch = s.slice(i).match(/^(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|ln|log|abs|int|rnd|sqrt|cbrt)\s*\(/i);
    if (mathMatch) {
      tokens.push({ type: 'math_fn', value: mathMatch[1].toLowerCase() });
      i += mathMatch[0].length;
      continue;
    }

    // Special glyph functions like √(, ∛(
    if (s.slice(i).startsWith('√(') || s.slice(i).startsWith('√')) {
      tokens.push({ type: 'math_fn', value: 'sqrt' });
      i += s.slice(i).startsWith('√(') ? 2 : 1;
      continue;
    }
    if (s.slice(i).startsWith('∛(') || s.slice(i).startsWith('∛')) {
      tokens.push({ type: 'math_fn', value: 'cbrt' });
      i += s.slice(i).startsWith('∛(') ? 2 : 1;
      continue;
    }

    // Cell references: ($)A..E($)1..45
    const cellMatch = s.slice(i).match(/^(\$?)([A-Ea-e])(\$?)([1-9][0-9]?)/);
    if (cellMatch) {
      const col = colToIdx(cellMatch[2]);
      const row = parseInt(cellMatch[4], 10);
      if (col >= 0 && col < MAX_COLS && row >= 1 && row <= MAX_ROWS) {
        tokens.push({
          type: 'cell',
          col,
          row,
          absCol: cellMatch[1] === '$',
          absRow: cellMatch[3] === '$',
          coord: formatCellCoord(col, row)
        });
        i += cellMatch[0].length;
        continue;
      }
    }

    // Invalid cell reference like ?1 or A?
    if (s[i] === '?' || (s[i] === '$' && i + 1 < s.length && s[i + 1] === '?')) {
      tokens.push({ type: 'error_ref' });
      i += (s[i] === '$' ? 2 : 1);
      while (i < s.length && /[0-9?]/.test(s[i])) i++;
      continue;
    }

    // Postfix square x², cube x³, inv x⁻¹, pct %
    if (ch === '²' || s.slice(i, i + 2) === 'x²') {
      tokens.push({ type: 'sq' });
      i += (ch === '²' ? 1 : 2);
      continue;
    }
    if (ch === '³' || s.slice(i, i + 2) === 'x³') {
      tokens.push({ type: 'cube' });
      i += (ch === '³' ? 1 : 2);
      continue;
    }
    if (ch === '⁻' && s[i + 1] === '¹') {
      tokens.push({ type: 'inv' });
      i += 2;
      continue;
    }
    if (ch === '%') {
      tokens.push({ type: 'pct' });
      i++;
      continue;
    }

    // Operators and separators
    if (ch === '+' || ch === '-' || ch === '−') {
      tokens.push({ type: 'add_sub', value: (ch === '+' ? '+' : '-') });
      i++;
      continue;
    }
    if (ch === '*' || ch === '×') {
      tokens.push({ type: 'mul_div', value: '*' });
      i++;
      continue;
    }
    if (ch === '/' || ch === '÷') {
      tokens.push({ type: 'mul_div', value: '/' });
      i++;
      continue;
    }
    if (ch === '^') {
      tokens.push({ type: 'pow' });
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }
    if (ch === ':') {
      tokens.push({ type: 'colon' });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma' });
      i++;
      continue;
    }

    // Fallback: single character token
    tokens.push({ type: 'unknown', value: ch });
    i++;
  }

  return tokens;
}

/**
 * Evaluate an expression string within the spreadsheet context.
 *
 * @param {string} expr - formula or constant expression
 * @param {Map<string, { formula: string|null, value: Decimal15|null, raw: string, isConstant: boolean }>} grid
 * @param {string} currentCoord - e.g. "A1"
 * @param {Set<string>} callStack - for circular dependency detection
 * @param {number} depth - recursion depth
 */
export function evaluateExpression(expr, grid, currentCoord = null, callStack = new Set(), depth = 0) {
  if (depth > MAX_CHAIN_DEPTH) {
    throw new CalcError(ERRORS.MEMORY);
  }

  if (currentCoord) {
    if (callStack.has(currentCoord)) {
      throw new CalcError(ERRORS.CIRCULAR);
    }
    callStack.add(currentCoord);
  }

  try {
    const tokens = tokenize(expr);
    if (tokens.length === 0) return Decimal15.ZERO;

    let pos = 0;

    function peek() {
      return tokens[pos] || null;
    }

    function next() {
      return tokens[pos++] || null;
    }

    function match(type, val = null) {
      const t = peek();
      if (!t) return false;
      if (t.type !== type) return false;
      if (val !== null && t.value !== val) return false;
      pos++;
      return true;
    }

    // Grammar:
    // parseExpr: parseAddSub
    // parseAddSub: parseMulDiv ('+' | '-') parseMulDiv ...
    // parseMulDiv: parseImplicit ('*' | '/') parseImplicit ...
    // parseImplicit: parsePow (parsePow)* (omitted multiplication)
    // parsePow: parsePostfix ('^' parsePow)?
    // parsePostfix: parsePrimary ('²' | '³' | '⁻¹' | '%')*
    // parsePrimary: num | cell | range_fn | math_fn | '(' expr ')' | '-' primary

    function parseExpr() {
      return parseAddSub();
    }

    function parseAddSub() {
      let left = parseMulDiv();
      while (true) {
        const t = peek();
        if (t && t.type === 'add_sub') {
          next();
          const right = parseMulDiv();
          if (left === null || right === null) return null;
          left = t.value === '+' ? left.add(right) : left.sub(right);
        } else {
          break;
        }
      }
      return left;
    }

    function parseMulDiv() {
      let left = parseImplicit();
      while (true) {
        const t = peek();
        if (t && t.type === 'mul_div') {
          next();
          const right = parseImplicit();
          if (left === null || right === null) return null;
          if (t.value === '*') {
            left = left.mul(right);
          } else {
            if (right.isZero()) throw new CalcError(ERRORS.MATH);
            left = left.div(right);
          }
        } else {
          break;
        }
      }
      return left;
    }

    function canStartPrimary(t) {
      if (!t) return false;
      return t.type === 'num' || t.type === 'cell' || t.type === 'range_fn' ||
             t.type === 'math_fn' || t.type === 'lparen' || t.type === 'add_sub' ||
             t.type === 'error_ref';
    }

    function parseImplicit() {
      let left = parsePow();
      while (true) {
        const t = peek();
        // Omitted multiplication if next token can start a primary and is not '+' / '-'
        if (canStartPrimary(t) && t.type !== 'add_sub') {
          const right = parsePow();
          if (left === null || right === null) return null;
          left = left.mul(right);
        } else {
          break;
        }
      }
      return left;
    }

    function parsePow() {
      let base = parsePostfix();
      const t = peek();
      if (t && t.type === 'pow') {
        next();
        const exponent = parsePow(); // right-associative
        if (base === null || exponent === null) return null;
        base = fn.pow(base, exponent);
      }
      return base;
    }

    function parsePostfix() {
      let val = parsePrimary();
      while (true) {
        const t = peek();
        if (!t) break;
        if (t.type === 'sq') {
          next();
          if (val !== null) val = fn.sqr(val);
        } else if (t.type === 'cube') {
          next();
          if (val !== null) val = fn.cube(val);
        } else if (t.type === 'inv') {
          next();
          if (val !== null) {
            if (val.isZero()) throw new CalcError(ERRORS.MATH);
            val = fn.recip(val);
          }
        } else if (t.type === 'pct') {
          next();
          if (val !== null) val = fn.percent(val);
        } else {
          break;
        }
      }
      return val;
    }

    function parsePrimary() {
      const t = peek();
      if (!t) throw new CalcError(ERRORS.SYNTAX);

      // Unary minus/plus
      if (t.type === 'add_sub') {
        next();
        const operand = parsePostfix();
        if (operand === null) return null;
        return t.value === '-' ? operand.neg() : operand;
      }

      // Number literal
      if (t.type === 'num') {
        next();
        try {
          return Decimal15.fromString(t.value);
        } catch {
          throw new CalcError(ERRORS.SYNTAX);
        }
      }

      // Cell reference
      if (t.type === 'cell') {
        next();
        const coord = t.coord;
        // Check for self or circular reference
        if (callStack.has(coord)) {
          throw new CalcError(ERRORS.CIRCULAR);
        }
        return getCellValue(grid, coord, callStack, depth + 1);
      }

      // Invalid reference (e.g. out-of-bounds shifted ref '?')
      if (t.type === 'error_ref') {
        next();
        return null; // Cell evaluates to ERROR
      }

      // Parentheses
      if (t.type === 'lparen') {
        next();
        const val = parseExpr();
        match('rparen'); // optional closure per Casio rules
        return val;
      }

      // Math functions
      if (t.type === 'math_fn') {
        const fnName = t.value;
        next();
        const arg = parseExpr();
        match('rparen');
        if (arg === null) return null;
        switch (fnName) {
          case 'sin': return fn.sin(arg);
          case 'cos': return fn.cos(arg);
          case 'tan': return fn.tan(arg);
          case 'asin': return fn.asin(arg);
          case 'acos': return fn.acos(arg);
          case 'atan': return fn.atan(arg);
          case 'sinh': return fn.sinh(arg);
          case 'cosh': return fn.cosh(arg);
          case 'tanh': return fn.tanh(arg);
          case 'sqrt': return fn.sqrt(arg);
          case 'cbrt': return fn.cbrt(arg);
          case 'ln': return fn.ln(arg);
          case 'log': return fn.log(arg);
          case 'abs': return fn.abs(arg);
          case 'int': return fn.int(arg);
          case 'rnd': return fn.rnd(arg);
          default: throw new CalcError(ERRORS.SYNTAX);
        }
      }

      // Range functions: Sum(A1:A3), Mean(A1:A3), Min(A1:A3), Max(A1:A3)
      if (t.type === 'range_fn') {
        const rangeFnName = t.value;
        next();
        const startToken = next();
        if (!startToken || startToken.type !== 'cell') throw new CalcError(ERRORS.SYNTAX);
        if (!match('colon')) throw new CalcError(ERRORS.SYNTAX);
        const endToken = next();
        if (!endToken || endToken.type !== 'cell') throw new CalcError(ERRORS.SYNTAX);
        match('rparen');

        return evaluateRangeFn(rangeFnName, startToken, endToken, grid, callStack, depth + 1);
      }

      throw new CalcError(ERRORS.SYNTAX);
    }

    const result = parseExpr();
    return result;
  } finally {
    if (currentCoord) callStack.delete(currentCoord);
  }
}

/**
 * Get the value of a cell from the grid, evaluating formula if necessary.
 */
export function getCellValue(grid, coord, callStack = new Set(), depth = 0) {
  const cell = grid.get(coord);
  if (!cell || cell.raw === undefined || cell.raw === null || cell.raw === '') {
    return Decimal15.ZERO;
  }

  if (cell.value !== undefined && cell.value !== null) {
    return cell.value;
  }

  if (cell.formula) {
    const val = evaluateExpression(cell.formula, grid, coord, callStack, depth);
    cell.value = val;
    return val;
  }

  // Constant expression
  const val = evaluateExpression(cell.raw, grid, coord, callStack, depth);
  cell.value = val;
  return val;
}

/**
 * Evaluate Range function over start and end cell tokens.
 */
function evaluateRangeFn(name, t1, t2, grid, callStack, depth) {
  const minCol = Math.min(t1.col, t2.col);
  const maxCol = Math.max(t1.col, t2.col);
  const minRow = Math.min(t1.row, t2.row);
  const maxRow = Math.max(t1.row, t2.row);

  const values = [];
  let sum = Decimal15.ZERO;
  let count = 0;

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const coord = formatCellCoord(c, r);
      if (callStack.has(coord)) {
        throw new CalcError(ERRORS.CIRCULAR);
      }
      const val = getCellValue(grid, coord, callStack, depth);
      if (val !== null) {
        values.push(val);
        sum = sum.add(val);
        const cell = grid.get(coord);
        if (cell && cell.raw !== '' && cell.raw !== undefined && cell.raw !== null) {
          count++;
        }
      }
    }
  }

  if (name === 'SUM') return sum;

  if (values.length === 0) return Decimal15.ZERO;

  if (name === 'MEAN') {
    const divisor = count > 0 ? Decimal15.fromInt(count) : Decimal15.fromInt(values.length);
    if (divisor.isZero()) return Decimal15.ZERO;
    return sum.div(divisor);
  }

  if (name === 'MIN') {
    let min = values[0];
    for (let i = 1; i < values.length; i++) {
      if (values[i].cmp(min) < 0) min = values[i];
    }
    return min;
  }

  if (name === 'MAX') {
    let max = values[0];
    for (let i = 1; i < values.length; i++) {
      if (values[i].cmp(max) > 0) max = values[i];
    }
    return max;
  }

  throw new CalcError(ERRORS.SYNTAX);
}

/**
 * Calculate total byte capacity used by the grid.
 */
export function calculateGridBytes(grid) {
  let bytes = 0;
  for (const [coord, cell] of grid.entries()) {
    if (!cell || !cell.raw) continue;
    if (cell.isFormula || cell.raw.startsWith('=')) {
      const formStr = cell.raw.startsWith('=') ? cell.raw.slice(1) : cell.raw;
      bytes += FORMULA_OVERHEAD_BYTES + formStr.length;
    } else {
      bytes += cell.raw.length;
    }
  }
  return bytes;
}

/**
 * Recalculate all formulas in the spreadsheet grid.
 */
export function recalculateAll(grid) {
  // Clear cached values for formula cells
  for (const cell of grid.values()) {
    if (cell && cell.isFormula) {
      cell.value = null;
      cell.error = null;
    }
  }

  // Evaluate each formula
  for (const [coord, cell] of grid.entries()) {
    if (cell && cell.isFormula && cell.raw) {
      try {
        const val = evaluateExpression(cell.raw, grid, coord, new Set(), 0);
        cell.value = val;
        cell.error = null;
      } catch (err) {
        if (err.message === ERRORS.CIRCULAR || err.message === ERRORS.MEMORY) {
          throw err;
        }
        cell.value = null;
        cell.error = err;
      }
    }
  }
}
