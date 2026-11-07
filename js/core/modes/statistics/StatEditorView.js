/**
 * Tabular data editor for Mode 6: Statistics.
 */

import { MenuView } from '../../ui/views.js';
import { CalcError, ERRORS } from '../../errors.js';
import { formatNumber } from '../../format/formatNumber.js';
import { formatOptions } from '../../setup.js';
import { Decimal15 } from '../../number/Decimal15.js';
import { MINUS } from '../../format/display.js';
import { ROW_PITCH } from '../../ui/Screen.js';

function shortCellStr(val, setup) {
  if (val === undefined || val === null) return '';
  try {
    const d = Decimal15.from(val);
    const opts = formatOptions(setup);
    return formatNumber(d, {
      format: opts.numberFormat,
      engSymbols: opts.engSymbols,
      decimalMark: opts.decimalMark,
      digitSeparator: opts.digitSeparator
    }).fullString.replace(/^-/, MINUS);
  } catch {
    return String(val);
  }
}

export class StatEditorView {
  constructor(app) {
    this.app = app;
    this.calc = app.calc;
    this.model = app.model;
    this.row = 0; // 0-indexed row
    this.col = 0; // 0-indexed column
    this.scrollRow = 0; // top visible row
    this.isEditing = false;
    this.editBuffer = '';
  }

  get columns() {
    if (!this.model.isPaired()) {
      return this.model.freqEnabled ? ['x', 'Freq'] : ['x'];
    } else {
      return this.model.freqEnabled ? ['x', 'y', 'Freq'] : ['x', 'y'];
    }
  }

  colKey(colIdx = this.col) {
    const cols = this.columns;
    const c = cols[colIdx];
    return c === 'Freq' ? 'freq' : c;
  }

  activeCellValue() {
    if (this.row < this.model.rows.length) {
      const r = this.model.rows[this.row];
      const k = this.colKey();
      return r[k];
    }
    return this.colKey() === 'freq' ? 1 : 0;
  }

  commitEdit() {
    if (!this.isEditing) return;
    const text = this.editBuffer.trim();
    this.isEditing = false;
    this.editBuffer = '';
    if (text === '') return;

    // Handle expressions or negative numbers e.g. -2 or 3/2
    let num;
    try {
      num = Number(text.replace(/−/g, '-'));
      if (!Number.isFinite(num)) throw new Error();
    } catch {
      throw new CalcError(ERRORS.SYNTAX);
    }

    this.model.setCell(this.row, this.colKey(), num);
  }

  ensureVisible() {
    const cols = this.columns;
    if (this.col >= cols.length) this.col = cols.length - 1;
    if (this.col < 0) this.col = 0;

    const maxRow = this.model.rowCount();
    if (this.row > maxRow) this.row = maxRow;
    if (this.row < 0) this.row = 0;

    if (this.row <= 1) {
      this.scrollRow = 0;
    } else if (this.row < this.scrollRow) {
      this.scrollRow = this.row;
    } else if (this.row >= this.scrollRow + 2) {
      this.scrollRow = this.row - 1;
    }
  }

  optnMenu() {
    const isPaired = this.model.isPaired();
    if (!isPaired) {
      return new MenuView(this.calc, [
        {
          label: 'Select Type',
          run: () => {
            this.calc.closeAllOverlays();
            this.app.showSelectType();
          }
        },
        {
          label: 'Editor',
          run: () => {
            this.calc.replaceView(this.editorSubmenu());
          }
        },
        {
          label: '1-Variable Calc',
          run: () => {
            this.calc.closeAllOverlays();
            this.app.show1VarCalc();
          }
        }
      ]);
    } else {
      return new MenuView(this.calc, [
        {
          label: 'Select Type',
          run: () => {
            this.calc.closeAllOverlays();
            this.app.showSelectType();
          }
        },
        {
          label: 'Editor',
          run: () => {
            this.calc.replaceView(this.editorSubmenu());
          }
        },
        {
          label: '2-Variable Calc',
          run: () => {
            this.calc.closeAllOverlays();
            this.app.show2VarCalc();
          }
        },
        {
          label: 'Regression Calc',
          run: () => {
            this.calc.closeAllOverlays();
            this.app.showRegCalc();
          }
        }
      ]);
    }
  }

  editorSubmenu() {
    return new MenuView(
      this.calc,
      [
        {
          label: 'Insert Row',
          run: () => {
            this.calc.closeAllOverlays();
            this.model.insertRow(this.row, { x: 0, y: 0, freq: 1 });
            this.ensureVisible();
          }
        },
        {
          label: 'Delete All',
          run: () => {
            this.calc.closeAllOverlays();
            this.model.clear();
            this.row = 0;
            this.col = 0;
            this.scrollRow = 0;
          }
        }
      ],
      { parent: this.optnMenu() }
    );
  }

  onKey(ev) {
    const k = ev.key;

    if (k === 'OPTN' && !ev.shift && !ev.alpha) {
      this.commitEdit();
      this.calc.pushView(this.optnMenu());
      return true;
    }

    if (k === 'AC' && !ev.shift) {
      if (this.isEditing) {
        this.isEditing = false;
        this.editBuffer = '';
      } else {
        // Pressing AC in editor switches to statistical calculation screen
        this.app.showCalcScreen();
      }
      return true;
    }

    if (k === 'EXE' && !ev.shift) {
      if (this.isEditing) {
        this.commitEdit();
      } else {
        // If on empty trailing row, initialize it
        if (this.row >= this.model.rowCount()) {
          this.model.setCell(this.row, this.colKey(), this.activeCellValue());
        }
      }
      if (this.row < this.model.maxRows() - 1) {
        this.row++;
      }
      this.ensureVisible();
      return true;
    }

    if (k === 'UP') {
      this.commitEdit();
      if (this.row > 0) this.row--;
      else this.row = this.model.rowCount();
      this.ensureVisible();
      return true;
    }

    if (k === 'DOWN') {
      this.commitEdit();
      if (this.row < this.model.rowCount()) this.row++;
      else this.row = 0;
      this.ensureVisible();
      return true;
    }

    if (k === 'LEFT') {
      this.commitEdit();
      if (this.col > 0) this.col--;
      this.ensureVisible();
      return true;
    }

    if (k === 'RIGHT') {
      this.commitEdit();
      if (this.col < this.columns.length - 1) this.col++;
      this.ensureVisible();
      return true;
    }

    if (k === 'DEL' && !ev.shift) {
      if (this.isEditing) {
        this.editBuffer = this.editBuffer.slice(0, -1);
        if (this.editBuffer.length === 0) this.isEditing = false;
      } else {
        // DEL deletes the entire row
        this.model.deleteRow(this.row);
        if (this.row >= this.model.rowCount() && this.row > 0) {
          this.row--;
        }
        this.ensureVisible();
      }
      return true;
    }

    // Digit / decimal / minus input
    let char = null;
    if (/^[0-9]$/.test(k)) char = k;
    else if (k === 'DOT' || k === '.') char = '.';
    else if (k === 'NEG' || k === 'SUB' || k === '-') char = '-';
    else if (k === 'EXP') char = 'e';

    if (char !== null) {
      if (!this.isEditing) {
        this.isEditing = true;
        this.editBuffer = char;
      } else {
        this.editBuffer += char;
      }
      return true;
    }

    return false;
  }

  indicators(set) {
    if (this.scrollRow > 0) set.add('Up');
    if (this.scrollRow + 2 < this.model.rowCount()) set.add('Down');
  }

  render(scr) {
    this.ensureVisible();
    const cols = this.columns;
    const numCols = cols.length;

    // Header dimensions
    const rowNumW = 20;
    const availW = 191 - rowNumW;
    const colW = Math.floor(availW / numCols);

    // Draw header row 0 (y = 0..14)
    scr.text(1, 1, '   ', { record: false });
    for (let c = 0; c < numCols; c++) {
      const colX = rowNumW + c * colW;
      const title = cols[c];
      scr.text(colX + Math.floor((colW - title.length * 8) / 2), 1, title, { record: false });
    }

    // Header divider lines
    scr.fb.hline(0, 191, 14);
    scr.fb.vline(rowNumW, 0, 46);
    for (let c = 1; c < numCols; c++) {
      scr.fb.vline(rowNumW + c * colW, 0, 46);
    }
    scr.fb.hline(0, 191, 46);

    const lines = [];
    const headerStr = cols.join('    ');
    lines.push(headerStr);
    scr.record(1, 1, headerStr);

    // Visible data rows (2 rows: row 0, row 1)
    for (let rIdx = 0; rIdx < 2; rIdx++) {
      const dataRow = this.scrollRow + rIdx;
      const y = 16 + rIdx * 15;
      const displayRowNum = dataRow + 1;

      // Draw row number
      scr.text(2, y, String(displayRowNum), { record: false });

      const rowData = dataRow < this.model.rows.length ? this.model.rows[dataRow] : null;
      const rowParts = [`${displayRowNum}:`];

      for (let c = 0; c < numCols; c++) {
        const key = cols[c] === 'Freq' ? 'freq' : cols[c];
        const val = rowData ? rowData[key] : (dataRow === this.row && c === this.col ? '' : '');
        const valStr = val !== '' && val !== undefined ? shortCellStr(val, this.calc.setup) : '';
        const colRight = rowNumW + (c + 1) * colW - 2;

        scr.text(rowNumW + c * colW + 2, y, valStr, { align: 'right', right: colRight, record: false });
        if (valStr) rowParts.push(valStr);

        // Invert cell cursor if active
        if (dataRow === this.row && c === this.col) {
          scr.fb.invertRect(rowNumW + c * colW + 1, y - 1, colW - 1, 15);
        }
      }

      const rowLine = rowParts.join(' ');
      scr.record(y, 1, rowLine);
      lines.push(rowLine);
    }

    // Bottom line (y = 48): active cell edit or value
    const bottomVal = this.isEditing ? this.editBuffer : shortCellStr(this.activeCellValue(), this.calc.setup);
    scr.text(1, 48, bottomVal, { record: false });
    scr.record(48, 1, bottomVal);
    lines.push(bottomVal);

    scr.lines = lines;
  }
}
