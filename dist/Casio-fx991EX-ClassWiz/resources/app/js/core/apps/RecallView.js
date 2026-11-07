/**
 * SHIFT STO (RECALL): shows A–F, M, x, y (values always in Norm 1). Pressing a variable
 * key inserts that variable into the expression; AC closes.
 * (VERIFY ON EMULATOR: exact layout, and whether the key inserts the name or the value.)
 */

import { VARIABLES } from '../memory.js';
import { VARIABLE_KEYS } from '../keys.js';
import { formatNumber } from '../format/formatNumber.js';
import { MINUS } from '../format/display.js';

export class RecallView {
  constructor(calc, onPick) {
    this.calc = calc;
    this.onPick = onPick;
    this.isOverlay = true;
  }

  onKey(ev) {
    if (ev.key === 'AC' && !ev.shift) {
      this.calc.closeAllOverlays();
      return true;
    }
    const v = VARIABLE_KEYS[ev.key];
    if (v && !ev.shift) {
      this.calc.closeAllOverlays();
      this.onPick(v);
    }
    return true;
  }

  render(scr) {
    const order = VARIABLES; // A B C D E F M x y
    const rows = ['', '', '', '', ''];
    order.forEach((name, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const d = this.calc.memory.getVar(name).toDecimal15();
      const s = formatNumber(d, { format: { type: 'NORM', value: 1 } }).fullString.replace(/^-/, MINUS);
      scr.text(1 + col * 96, 1 + row * 12, `${name}=${s}`, { font: 'small' });
      if (col === 0) rows[row] = `${name}=${s}`;
      else rows[row] += ` ${name}=${s}`;
    });
    scr.lines = rows;
  }
}
