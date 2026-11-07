/**
 * Result display screen for 1-Variable Calc, 2-Variable Calc, and Regression Calc.
 */

import { formatNumber } from '../../format/formatNumber.js';
import { formatOptions } from '../../setup.js';
import { Decimal15 } from '../../number/Decimal15.js';
import { MINUS } from '../../format/display.js';
import { ROW_PITCH } from '../../ui/Screen.js';
import { drawScrollBar } from '../../ui/views.js';

function formatVal(v, setup) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  try {
    const d = Decimal15.from(v);
    const opts = formatOptions(setup);
    return formatNumber(d, {
      format: opts.numberFormat,
      engSymbols: opts.engSymbols,
      decimalMark: opts.decimalMark,
      digitSeparator: opts.digitSeparator
    }).fullString.replace(/^-/, MINUS);
  } catch {
    return String(v);
  }
}

export class StatResultView {
  /**
   * @param calc Calculator
   * @param { header?: string, items: Array<{ label: string, val: any }>, onClose?: function }
   */
  constructor(calc, { header = null, items = [], onClose = null } = {}) {
    this.calc = calc;
    this.header = header;
    this.items = items;
    this.onClose = onClose;
    this.scrollIndex = 0;
    this.isOverlay = true;
  }

  get visibleRows() {
    return this.header ? 3 : 4;
  }

  get maxScroll() {
    return Math.max(0, this.items.length - this.visibleRows);
  }

  onKey(ev) {
    if (ev.shift || ev.alpha) return false;
    const k = ev.key;

    if (k === 'AC') {
      if (this.onClose) this.onClose(this.calc);
      else this.calc.closeView();
      return true;
    }

    if (k === 'DOWN') {
      if (this.scrollIndex < this.maxScroll) {
        this.scrollIndex++;
      }
      return true;
    }

    if (k === 'UP') {
      if (this.scrollIndex > 0) {
        this.scrollIndex--;
      }
      return true;
    }

    return true; // absorb other keys while viewing results
  }

  indicators(set) {
    if (this.scrollIndex > 0) set.add('Up');
    if (this.scrollIndex < this.maxScroll) set.add('Down');
  }

  render(scr) {
    let rowIdx = 0;
    const lines = [];

    if (this.header) {
      scr.row(0, this.header);
      lines.push(this.header);
      rowIdx = 1;
    }

    const visibleCount = this.visibleRows;
    const start = this.scrollIndex;
    const end = Math.min(this.items.length, start + visibleCount);

    for (let i = start; i < end; i++) {
      const it = this.items[i];
      const valStr = formatVal(it.val, this.calc.setup);
      const rowY = 1 + rowIdx * ROW_PITCH;

      // Draw label left-aligned
      scr.text(1, rowY, `${it.label}=`, { record: false });
      // Draw value right-aligned
      scr.text(1, rowY, valStr, { align: 'right', right: this.maxScroll > 0 ? 184 : 191, record: false });

      // Record full string for screen.lines and tests
      const fullLine = `${it.label}=${valStr}`;
      scr.record(rowY, 1, fullLine);
      lines.push(fullLine);

      rowIdx++;
    }

    if (this.maxScroll > 0) {
      const pages = this.items.length - visibleCount + 1;
      drawScrollBar(scr, this.scrollIndex, pages, this.header ? 1 : 0);
    }

    scr.lines = lines;
  }
}
