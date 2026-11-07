/**
 * Table mode helpers: row count from Start/End/Step and the cell text that fits a column.
 */

import { Decimal15 } from '../../number/Decimal15.js';
import { formatNumber } from '../../format/formatNumber.js';
import { decimalTree, treeToText } from '../../format/display.js';
import { CalcError, ERRORS } from '../../errors.js';
import { layout } from '../../../lcd/layout.js';
import { formatOptions } from '../../setup.js';
import { ResultView } from '../../format/ResultView.js';
import { ExactValue } from '../../exact/ExactValue.js';

export const ROW_LIMIT = { F: 45, FG: 30 };

const TOLERANCE = Decimal15.fromString('1e-9');
const HALF = Decimal15.fromString('0.5');

/**
 * Number of rows for Start/End/Step (ExactValues): floor((End−Start)/Step)+1.
 * Range ERROR when Step is 0, the count is below 1 or above `limit`.
 */
export function rowCount(start, end, step, limit) {
  if (step.toDecimal15().isZero()) throw new CalcError(ERRORS.RANGE);
  const q = end.sub(start).div(step).toDecimal15();
  if (q.abs().cmp(Decimal15.fromInt(1000)) > 0) throw new CalcError(ERRORS.RANGE);
  // (End−Start)/Step within rounding noise of an integer counts as that integer
  const nearest = q.add(HALF).floor();
  const k = q.sub(nearest).abs().cmp(TOLERANCE) <= 0 ? nearest : q.floor();
  const n = Number(k.toBigInt()) + 1;
  if (n < 1 || n > limit) throw new CalcError(ERRORS.RANGE);
  return n;
}

const width = (tree) => layout(tree, { font: 'small' }).w;

/**
 * Display tree for a cell value (Decimal15) that fits `maxW` pixels in the small font.
 * Uses the SETUP number format first, then fewer digits, then fewer significant digits
 * in ×10ⁿ form. (VERIFY ON EMULATOR: the real abbreviation rule.)
 */
export function cellTree(dec, fmt, maxW) {
  let tree = decimalTree(dec, fmt);
  if (width(tree) <= maxW) return tree;
  const nf = fmt.numberFormat;
  if (nf.type === 'FIX' || nf.type === 'SCI') {
    const min = nf.type === 'FIX' ? 0 : 1;
    for (let d = nf.value - 1; d >= min; d--) {
      tree = decimalTree(dec, { ...fmt, numberFormat: { type: nf.type, value: d } });
      if (width(tree) <= maxW) return tree;
    }
  }
  const norm = { ...fmt, numberFormat: nf.type === 'NORM' ? nf : { type: 'NORM', value: 1 } };
  for (let k = 9; k >= 1; k--) {
    const f = formatNumber(dec, { format: { type: 'SCI', value: k } });
    if (f.exponent !== null && f.exponent !== undefined) {
      const rounded = Decimal15.fromString(`${f.mantissa.replace('−', '-')}e${f.exponent}`);
      tree = decimalTree(rounded, norm);
      if (width(tree) <= maxW) return tree;
    }
    tree = decimalTree(dec, { ...fmt, numberFormat: { type: 'SCI', value: k } });
    if (width(tree) <= maxW) return tree;
  }
  return tree;
}

export function cellText(dec, fmt, maxW = 54) {
  return treeToText(cellTree(dec, fmt, maxW));
}

export function formatCellValue(val, setup, maxW = 54) {
  if (val === 'ERROR' || val === null || val === undefined) return 'ERROR';
  try {
    const dec = val instanceof ExactValue ? val.toDecimal15() : (val instanceof Decimal15 ? val : Decimal15.fromString(String(val)));
    return cellText(dec, formatOptions(setup), maxW);
  } catch {
    return 'ERROR';
  }
}

export function formatFullValue(val, setup) {
  if (val === 'ERROR' || val === null || val === undefined) return 'ERROR';
  try {
    if (val instanceof ExactValue) {
      return new ResultView(val, setup).text();
    }
    return String(val);
  } catch {
    return 'ERROR';
  }
}
