/**
 * Mode 8: Spreadsheet (Casio fx-991EX ClassWiz).
 *
 * Implements:
 * - 5 columns (A..E) × 45 rows (1..45) = 225 cells
 * - Cell cursor, 2 columns × 3 rows visible viewport, scrolling
 * - Numbers, formulas, and constant expressions
 * - Cell references: relative and absolute ($A1, A$1, $A$1)
 * - Special range commands: Min, Max, Mean, Sum
 * - OPTN menus:
 *   - Cell: Fill Formula, Fill Value, Edit Cell, Free Space,
 *           Cut & Paste, Copy & Paste, Delete All, Recalculate
 *   - Edit: $, Grab, Min(, Max(, Mean(, Sum(
 * - Setup: Auto Calc (On/Off) and Show Cell (Formula/Value)
 * - Error handling: Circular ERROR, Memory ERROR (1,700 bytes limit), Range ERROR
 * - Variable STO and RECALL
 * - Screen layout matching authentic LCD framebuffer
 */

import { Editor } from '../../input/Editor.js';
import { inputAction, applyInput } from '../../input/keyInput.js';
import { CalcError, ERRORS } from '../../errors.js';
import { treeToText } from '../../format/display.js';
import { MenuView, drawScrollBar } from '../../ui/views.js';
import { VARIABLE_KEYS } from '../../keys.js';
import { Decimal15 } from '../../number/Decimal15.js';
import { ExactValue } from '../../exact/ExactValue.js';
import {
  MAX_ROWS,
  MAX_COLS,
  TOTAL_CAPACITY_BYTES,
  MAX_FORMULA_BYTES,
  MAX_CONSTANT_BYTES,
  colToIdx,
  idxToCol,
  formatCellCoord,
  parseCellRef,
  parseRange,
  shiftFormula,
  evaluateExpression,
  calculateGridBytes,
  recalculateAll
} from './evaluator.js';

class SpreadsheetEditMenuView {
  constructor(calc, app) {
    this.calc = calc;
    this.app = app;
    this.page = 0;
    this.isOverlay = true;
    this.pages = [
      [
        { label: '$', run: () => { this.calc.closeView(); this.app.editor.insertToken('$'); } },
        { label: 'Grab', run: () => { this.calc.closeView(); this.app.phase = 'grab'; this.app.grabCursor = { col: this.app.cursor.col, row: this.app.cursor.row }; } }
      ],
      [
        { label: 'Min(', run: () => { this.calc.closeView(); this.app.editor.insertToken('Min'); } },
        { label: 'Max(', run: () => { this.calc.closeView(); this.app.editor.insertToken('Max'); } },
        { label: 'Mean(', run: () => { this.calc.closeView(); this.app.editor.insertToken('Mean'); } },
        { label: 'Sum(', run: () => { this.calc.closeView(); this.app.editor.insertToken('Sum'); } }
      ]
    ];
  }

  onKey(ev) {
    if (ev.shift || ev.alpha) return false;
    const k = ev.key;
    if (k === 'AC') {
      this.calc.closeView();
      return true;
    }
    if (k === 'DOWN') {
      this.page = (this.page + 1) % 2;
      return true;
    }
    if (k === 'UP') {
      this.page = (this.page + 1) % 2;
      return true;
    }
    const digit = /^[1-4]$/.test(k) ? Number(k) : null;
    if (digit !== null) {
      const pageItems = this.pages[this.page];
      if (digit <= pageItems.length) {
        pageItems[digit - 1].run();
      }
      return true;
    }
    return true;
  }

  indicators(set) {
    if (this.page === 0) set.add('Down');
    else set.add('Up');
  }

  render(scr) {
    const pageItems = this.pages[this.page];
    for (let i = 0; i < pageItems.length; i++) {
      scr.row(i, `${i + 1}:${pageItems[i].label}`);
    }
    drawScrollBar(scr, this.page, 2, 0);
  }
}

export class SpreadsheetApp {
  constructor(calc) {
    this.calc = calc;
    this.title = 'Spreadsheet';
    this.reset();
  }

  reset() {
    this.grid = new Map();
    this.cursor = { col: 0, row: 1 };
    this.viewCol = 0; // 0..3 (showing viewCol and viewCol + 1)
    this.viewRow = 1; // 1..43 (showing viewRow, viewRow + 1, viewRow + 2)
    this.phase = 'cell'; // 'cell' | 'edit' | 'fill_formula_form' | 'fill_formula_range' |
                         // 'fill_value_val' | 'fill_value_range' | 'free_space' | 'grab' |
                         // 'sto' | 'error'
    this.editor = new Editor({ math: false });
    this.error = null;
    this.dialogForm = '';
    this.dialogRange = 'A1:A1';
    this.dialogVal = '';
    this.pasteStandby = { active: false, cut: false, col: 0, row: 1 };
    this.grabCursor = { col: 0, row: 1 };
    this.isEditFresh = false;
  }

  onEnter() {
    this.reset();
  }

  onExit() {
    this.reset();
  }

  clearHistory() {
    this.reset();
  }

  getCell(col, row) {
    const coord = formatCellCoord(col, row);
    return this.grid.get(coord) || null;
  }

  setCell(col, row, raw, isFormula = null) {
    const coord = formatCellCoord(col, row);
    const trimmed = String(raw).trim();
    if (!trimmed) {
      this.grid.delete(coord);
      return;
    }
    const isForm = isFormula !== null ? isFormula : trimmed.startsWith('=');
    this.grid.set(coord, {
      raw: trimmed,
      isFormula: isForm,
      formula: isForm ? (trimmed.startsWith('=') ? trimmed.slice(1) : trimmed) : null,
      value: null,
      error: null
    });
  }

  deleteCell(col, row) {
    const coord = formatCellCoord(col, row);
    this.grid.delete(coord);
  }

  deleteAll() {
    this.grid.clear();
    this.cursor = { col: 0, row: 1 };
    this.viewCol = 0;
    this.viewRow = 1;
    this.calc.closeAllOverlays();
  }

  recalculate() {
    recalculateAll(this.grid);
  }

  showError(err) {
    this.error = err;
    this.phase = 'error';
    this.calc.closeAllOverlays();
  }

  updateViewport() {
    // Keep 2 columns visible: viewCol, viewCol + 1
    if (this.cursor.col < this.viewCol) {
      this.viewCol = this.cursor.col;
    } else if (this.cursor.col > this.viewCol + 1) {
      this.viewCol = this.cursor.col - 1;
    }
    this.viewCol = Math.max(0, Math.min(MAX_COLS - 2, this.viewCol));

    // Keep 3 rows visible: viewRow, viewRow + 1, viewRow + 2
    if (this.cursor.row < this.viewRow) {
      this.viewRow = this.cursor.row;
    } else if (this.cursor.row > this.viewRow + 2) {
      this.viewRow = this.cursor.row - 2;
    }
    this.viewRow = Math.max(1, Math.min(MAX_ROWS - 2, this.viewRow));
  }

  // ---------------------------------------------------------------- menus

  cellOptnItems() {
    return [
      {
        label: 'Fill Formula',
        run: () => {
          this.calc.closeAllOverlays();
          this.openFillFormula();
        }
      },
      {
        label: 'Fill Value',
        run: () => {
          this.calc.closeAllOverlays();
          this.openFillValue();
        }
      },
      {
        label: 'Edit Cell',
        run: () => {
          this.calc.closeAllOverlays();
          this.startEditing(true);
        }
      },
      {
        label: 'Free Space',
        run: () => {
          this.calc.closeAllOverlays();
          this.phase = 'free_space';
        }
      },
      // Page 2
      {
        label: 'Cut & Paste',
        run: () => {
          this.calc.closeAllOverlays();
          this.pasteStandby = {
            active: true,
            cut: true,
            col: this.cursor.col,
            row: this.cursor.row
          };
        }
      },
      {
        label: 'Copy & Paste',
        run: () => {
          this.calc.closeAllOverlays();
          this.pasteStandby = {
            active: true,
            cut: false,
            col: this.cursor.col,
            row: this.cursor.row
          };
        }
      },
      {
        label: 'Delete All',
        run: () => {
          this.deleteAll();
        }
      },
      {
        label: 'Recalculate',
        run: () => {
          this.calc.closeAllOverlays();
          try {
            this.recalculate();
          } catch (err) {
            this.showError(err);
          }
        }
      }
    ];
  }

  openFillFormula() {
    this.phase = 'fill_formula_form';
    this.dialogForm = '';
    const curCoord = formatCellCoord(this.cursor.col, this.cursor.row);
    this.dialogRange = `${curCoord}:${curCoord}`;
    this.editor.clear();
  }

  openFillValue() {
    this.phase = 'fill_value_val';
    this.dialogVal = '';
    const curCoord = formatCellCoord(this.cursor.col, this.cursor.row);
    this.dialogRange = `${curCoord}:${curCoord}`;
    this.editor.clear();
  }

  startEditing(reuseExisting = false) {
    this.phase = 'edit';
    this.editor.clear();
    const cell = this.getCell(this.cursor.col, this.cursor.row);
    if (reuseExisting && cell && cell.raw) {
      this.populateEditor(cell.raw);
      this.isEditFresh = false;
    } else {
      this.isEditFresh = true;
    }
  }

  populateEditor(text) {
    for (const ch of text) {
      if (ch === '=') this.editor.insertToken('=');
      else if (ch === '$') this.editor.insertToken('$');
      else if (ch === ':') this.editor.insertToken(':');
      else if (ch === '+') this.editor.insertToken('+');
      else if (ch === '-' || ch === '−') this.editor.insertToken('-');
      else if (ch === '*' || ch === '×') this.editor.insertToken('*');
      else if (ch === '/' || ch === '÷') this.editor.insertToken('/');
      else if (ch === '(') this.editor.insertToken('(');
      else if (ch === ')') this.editor.insertToken(')');
      else if (ch === '.') this.editor.insertToken('.');
      else if (ch >= '0' && ch <= '9') this.editor.insertToken(ch);
      else if (ch >= 'A' && ch <= 'E') this.editor.insertToken('var_' + ch);
      else this.editor.insertToken(ch);
    }
  }

  // ---------------------------------------------------------------- keys

  onKey(ev) {
    const k = ev.key;

    // Error dismissal
    if (this.phase === 'error') {
      if (k === 'AC' && !ev.shift) {
        this.error = null;
        this.phase = 'cell';
        return true;
      }
      return true;
    }

    // Free Space dismissal
    if (this.phase === 'free_space') {
      this.phase = 'cell';
      return true;
    }

    // STO variable assignment
    if (this.phase === 'sto') {
      if (k === 'AC' && !ev.shift) {
        this.phase = 'cell';
        return true;
      }
      const varName = VARIABLE_KEYS[k] || (/^[A-FMxy]$/i.test(k) ? k.toUpperCase() : null);
      if (varName) {
        const cell = this.getCell(this.cursor.col, this.cursor.row);
        const val = cell?.value ?? Decimal15.ZERO;
        this.calc.memory.setVar(varName, ExactValue.from(val));
        this.phase = 'cell';
        return true;
      }
      return true;
    }

    // Grab mode navigation and selection
    if (this.phase === 'grab') {
      if (k === 'AC' && !ev.shift) {
        this.phase = 'edit';
        return true;
      }
      if (k === 'LEFT') {
        this.grabCursor.col = Math.max(0, this.grabCursor.col - 1);
        return true;
      }
      if (k === 'RIGHT') {
        this.grabCursor.col = Math.min(MAX_COLS - 1, this.grabCursor.col + 1);
        return true;
      }
      if (k === 'UP') {
        this.grabCursor.row = Math.max(1, this.grabCursor.row - 1);
        return true;
      }
      if (k === 'DOWN') {
        this.grabCursor.row = Math.min(MAX_ROWS, this.grabCursor.row + 1);
        return true;
      }
      if (k === 'EXE' && !ev.shift) {
        const picked = formatCellCoord(this.grabCursor.col, this.grabCursor.row);
        this.populateEditor(picked);
        this.phase = 'edit';
        return true;
      }
      return true;
    }

    // Fill Formula Form phase
    if (this.phase === 'fill_formula_form') {
      if (k === 'AC' && !ev.shift) {
        this.phase = 'cell';
        return true;
      }
      if (k === 'EXE' && !ev.shift) {
        this.dialogForm = treeToText(this.editor.root).trim();
        this.phase = 'fill_formula_range';
        this.editor.clear();
        return true;
      }
      if (k === 'DOWN') {
        this.dialogForm = treeToText(this.editor.root).trim();
        this.phase = 'fill_formula_range';
        this.editor.clear();
        return true;
      }
      if (k === 'DEL' && !ev.shift) {
        this.editor.backspace();
        return true;
      }
      if (k === 'LEFT') {
        this.editor.left();
        return true;
      }
      if (k === 'RIGHT') {
        this.editor.right();
        return true;
      }
      const action = inputAction(ev, { math: false });
      if (action) {
        applyInput(this.editor, action);
        return true;
      }
      return false;
    }

    // Fill Formula Range phase
    if (this.phase === 'fill_formula_range') {
      if (k === 'AC' && !ev.shift) {
        this.phase = 'cell';
        return true;
      }
      if (k === 'UP') {
        const typed = treeToText(this.editor.root).trim();
        if (typed) this.dialogRange = typed;
        this.phase = 'fill_formula_form';
        this.editor.clear();
        this.populateEditor(this.dialogForm);
        return true;
      }
      if (k === 'DEL' && !ev.shift) {
        this.editor.backspace();
        return true;
      }
      if (k === 'LEFT') {
        this.editor.left();
        return true;
      }
      if (k === 'RIGHT') {
        this.editor.right();
        return true;
      }
      if (k === 'EXE' && !ev.shift) {
        const typedRange = treeToText(this.editor.root).trim();
        const rangeText = typedRange || this.dialogRange;
        try {
          const rng = parseRange(rangeText);
          const rawForm = this.dialogForm.startsWith('=') ? this.dialogForm : '=' + this.dialogForm;

          // Memory check: each cell takes 11 + formulaLen bytes
          const cellCount = (rng.maxCol - rng.minCol + 1) * (rng.maxRow - rng.minRow + 1);
          const formBytes = 11 + rawForm.slice(1).length;
          const currentBytes = calculateGridBytes(this.grid);
          if (currentBytes + cellCount * formBytes > TOTAL_CAPACITY_BYTES) {
            throw new CalcError(ERRORS.MEMORY);
          }

          // Top-left cell of range
          const baseCol = rng.minCol;
          const baseRow = rng.minRow;

          for (let r = rng.minRow; r <= rng.maxRow; r++) {
            for (let c = rng.minCol; c <= rng.maxCol; c++) {
              const shifted = shiftFormula(rawForm, c - baseCol, r - baseRow);
              this.setCell(c, r, shifted, true);
            }
          }

          if (this.calc.setup.autoCalc) {
            this.recalculate();
          }
          this.phase = 'cell';
          return true;
        } catch (err) {
          this.showError(err);
          return true;
        }
      }
      const action = inputAction(ev, { math: false });
      if (action) {
        applyInput(this.editor, action);
        return true;
      }
      return false;
    }

    // Fill Value Val phase
    if (this.phase === 'fill_value_val') {
      if (k === 'AC' && !ev.shift) {
        this.phase = 'cell';
        return true;
      }
      if (k === 'EXE' && !ev.shift) {
        this.dialogVal = treeToText(this.editor.root).trim();
        this.phase = 'fill_value_range';
        this.editor.clear();
        return true;
      }
      if (k === 'DOWN') {
        this.dialogVal = treeToText(this.editor.root).trim();
        this.phase = 'fill_value_range';
        this.editor.clear();
        return true;
      }
      if (k === 'DEL' && !ev.shift) {
        this.editor.backspace();
        return true;
      }
      if (k === 'LEFT') {
        this.editor.left();
        return true;
      }
      if (k === 'RIGHT') {
        this.editor.right();
        return true;
      }
      const action = inputAction(ev, { math: false });
      if (action) {
        applyInput(this.editor, action);
        return true;
      }
      return false;
    }

    // Fill Value Range phase
    if (this.phase === 'fill_value_range') {
      if (k === 'AC' && !ev.shift) {
        this.phase = 'cell';
        return true;
      }
      if (k === 'UP') {
        const typed = treeToText(this.editor.root).trim();
        if (typed) this.dialogRange = typed;
        this.phase = 'fill_value_val';
        this.editor.clear();
        this.populateEditor(this.dialogVal);
        return true;
      }
      if (k === 'DEL' && !ev.shift) {
        this.editor.backspace();
        return true;
      }
      if (k === 'LEFT') {
        this.editor.left();
        return true;
      }
      if (k === 'RIGHT') {
        this.editor.right();
        return true;
      }
      if (k === 'EXE' && !ev.shift) {
        const typedRange = treeToText(this.editor.root).trim();
        const rangeText = typedRange || this.dialogRange;
        try {
          const rng = parseRange(rangeText);
          const cellCount = (rng.maxCol - rng.minCol + 1) * (rng.maxRow - rng.minRow + 1);
          const currentBytes = calculateGridBytes(this.grid);
          if (currentBytes + cellCount * 10 > TOTAL_CAPACITY_BYTES) {
            throw new CalcError(ERRORS.MEMORY);
          }

          const baseCol = rng.minCol;
          const baseRow = rng.minRow;

          for (let r = rng.minRow; r <= rng.maxRow; r++) {
            for (let c = rng.minCol; c <= rng.maxCol; c++) {
              const shiftedExpr = shiftFormula(this.dialogVal, c - baseCol, r - baseRow);
              let computedVal = evaluateExpression(shiftedExpr, this.grid, null, new Set(), 0);
              const valStr = computedVal !== null ? computedVal.toString() : 'ERROR';
              this.setCell(c, r, valStr, false);
              const cell = this.getCell(c, r);
              if (cell) cell.value = computedVal;
            }
          }

          if (this.calc.setup.autoCalc) {
            this.recalculate();
          }
          this.phase = 'cell';
          return true;
        } catch (err) {
          this.showError(err);
          return true;
        }
      }
      const action = inputAction(ev, { math: false });
      if (action) {
        applyInput(this.editor, action);
        return true;
      }
      return false;
    }

    // Cell navigation phase
    if (this.phase === 'cell') {
      if (k === 'OPTN' && !ev.shift && !ev.alpha) {
        this.calc.pushView(new MenuView(this.calc, this.cellOptnItems(), { title: null }));
        return true;
      }

      if (k === 'LEFT') {
        this.cursor.col = Math.max(0, this.cursor.col - 1);
        this.updateViewport();
        return true;
      }
      if (k === 'RIGHT') {
        this.cursor.col = Math.min(MAX_COLS - 1, this.cursor.col + 1);
        this.updateViewport();
        return true;
      }
      if (k === 'UP') {
        this.cursor.row = Math.max(1, this.cursor.row - 1);
        this.updateViewport();
        return true;
      }
      if (k === 'DOWN') {
        this.cursor.row = Math.min(MAX_ROWS, this.cursor.row + 1);
        this.updateViewport();
        return true;
      }

      if (k === 'STO' && !ev.shift && !ev.alpha) {
        this.phase = 'sto';
        return true;
      }

      if (k === 'DEL' && !ev.shift && !ev.alpha) {
        this.deleteCell(this.cursor.col, this.cursor.row);
        if (this.calc.setup.autoCalc) {
          try {
            this.recalculate();
          } catch (err) {
            this.showError(err);
          }
        }
        return true;
      }

      if (k === 'AC' && !ev.shift) {
        if (this.pasteStandby.active) {
          this.pasteStandby.active = false;
        }
        return true;
      }

      if (k === 'EXE' && !ev.shift) {
        if (this.pasteStandby.active) {
          const srcCell = this.getCell(this.pasteStandby.col, this.pasteStandby.row);
          if (srcCell && srcCell.raw) {
            if (this.pasteStandby.cut) {
              this.setCell(this.cursor.col, this.cursor.row, srcCell.raw, srcCell.isFormula);
              this.deleteCell(this.pasteStandby.col, this.pasteStandby.row);
              this.pasteStandby.active = false;
            } else {
              const dCol = this.cursor.col - this.pasteStandby.col;
              const dRow = this.cursor.row - this.pasteStandby.row;
              const pasted = srcCell.isFormula
                ? shiftFormula(srcCell.raw, dCol, dRow)
                : srcCell.raw;
              this.setCell(this.cursor.col, this.cursor.row, pasted, srcCell.isFormula);
            }
            if (this.calc.setup.autoCalc) {
              try {
                this.recalculate();
              } catch (err) {
                this.showError(err);
              }
            }
          }
          return true;
        }
        this.startEditing(true);
        return true;
      }

      // Any typing key starts editing fresh
      this.startEditing(false);
      const action = inputAction(ev, { math: false });
      if (action) {
        applyInput(this.editor, action);
        return true;
      }
      return false;
    }

    // Cell editing phase
    if (this.phase === 'edit') {
      if (k === 'AC' && !ev.shift) {
        this.phase = 'cell';
        return true;
      }

      if (k === 'OPTN' && !ev.shift && !ev.alpha) {
        this.calc.pushView(new SpreadsheetEditMenuView(this.calc, this));
        return true;
      }

      if (k === 'DEL' && !ev.shift) {
        this.editor.backspace();
        return true;
      }

      if (k === 'LEFT') {
        this.editor.left();
        return true;
      }
      if (k === 'RIGHT') {
        this.editor.right();
        return true;
      }

      if (k === 'EXE' && !ev.shift) {
        const text = treeToText(this.editor.root).trim();
        const curCoord = formatCellCoord(this.cursor.col, this.cursor.row);

        if (!text) {
          this.deleteCell(this.cursor.col, this.cursor.row);
        } else {
          const isFormula = text.startsWith('=');
          const formulaBody = isFormula ? text.slice(1).trim() : text;

          // Check direct self reference in formula
          if (isFormula) {
            const up = text.toUpperCase();
            if (up.includes(curCoord)) {
              this.showError(new CalcError(ERRORS.CIRCULAR));
              return true;
            }
          }

          // Capacity validation
          const cellBytes = isFormula ? 11 + formulaBody.length : text.length;
          const currentTotal = calculateGridBytes(this.grid);
          if (currentTotal + cellBytes > TOTAL_CAPACITY_BYTES) {
            this.showError(new CalcError(ERRORS.MEMORY));
            return true;
          }

          try {
            if (isFormula) {
              // Try evaluating to check for cycles
              const tempVal = evaluateExpression(formulaBody, this.grid, curCoord, new Set(), 0);
              this.setCell(this.cursor.col, this.cursor.row, text, true);
              const cell = this.getCell(this.cursor.col, this.cursor.row);
              if (cell) cell.value = tempVal;
            } else {
              // Evaluate constant expression immediately using current grid state
              let computedVal = evaluateExpression(text, this.grid, null, new Set(), 0);
              const valStr = computedVal !== null ? computedVal.toString() : 'ERROR';
              this.setCell(this.cursor.col, this.cursor.row, valStr, false);
              const cell = this.getCell(this.cursor.col, this.cursor.row);
              if (cell) cell.value = computedVal;
            }
          } catch (err) {
            this.showError(err);
            return true;
          }

          if (this.calc.setup.autoCalc) {
            try {
              this.recalculate();
            } catch (err) {
              this.showError(err);
              return true;
            }
          }
        }

        // Advance cursor down
        if (this.cursor.row < MAX_ROWS) {
          this.cursor.row++;
          this.updateViewport();
        }
        this.phase = 'cell';
        return true;
      }

      const action = inputAction(ev, { math: false });
      if (action) {
        applyInput(this.editor, action);
        return true;
      }
      return false;
    }

    return false;
  }

  indicators(set) {
    if (this.phase === 'sto') {
      set.add('STO');
    }
  }

  // ---------------------------------------------------------------- render

  render(scr) {
    if (this.phase === 'error') {
      scr.row(0, this.error.message);
      scr.row(2, '[AC] :Cancel');
      scr.lines = [this.error.message, '[AC] :Cancel'];
      return;
    }

    if (this.phase === 'free_space') {
      const free = TOTAL_CAPACITY_BYTES - calculateGridBytes(this.grid);
      scr.row(0, 'Free Space');
      scr.row(1, `${free} Bytes`, { align: 'right' });
      scr.row(3, '[AC] :Cancel');
      scr.lines = ['Free Space', `${free} Bytes`];
      return;
    }

    if (this.phase === 'fill_formula_form' || this.phase === 'fill_formula_range') {
      const fText = this.phase === 'fill_formula_form'
        ? treeToText(this.editor.root)
        : this.dialogForm;
      const rEntered = this.phase === 'fill_formula_range'
        ? treeToText(this.editor.root)
        : '';
      const rText = rEntered || this.dialogRange;

      scr.row(0, 'Fill Formula');
      scr.row(1, `Form =${fText}`);
      scr.row(2, `Range:${rText}`);
      scr.lines = ['Fill Formula', `Form =${fText}`, `Range:${rText}`];
      return;
    }

    if (this.phase === 'fill_value_val' || this.phase === 'fill_value_range') {
      const vText = this.phase === 'fill_value_val'
        ? treeToText(this.editor.root)
        : this.dialogVal;
      const rEntered = this.phase === 'fill_value_range'
        ? treeToText(this.editor.root)
        : '';
      const rText = rEntered || this.dialogRange;

      scr.row(0, 'Fill Value');
      scr.row(1, `Value:${vText}`);
      scr.row(2, `Range:${rText}`);
      scr.lines = ['Fill Value', `Value:${vText}`, `Range:${rText}`];
      return;
    }

    // Grid rendering
    const col1 = idxToCol(this.viewCol);
    const col2 = idxToCol(this.viewCol + 1);
    const curCoord = formatCellCoord(this.cursor.col, this.cursor.row);

    // Framebuffer drawing
    // Top column headers
    scr.text(0, 1, '   ', { font: 'small' });
    scr.text(26, 1, `   ${col1}   `, { font: 'small' });
    scr.fb.vline(108, 0, 47);
    scr.text(110, 1, `   ${col2}   `, { font: 'small' });
    scr.fb.hline(0, 191, 10);
    scr.fb.vline(24, 0, 47);

    // 3 Visible rows
    const visibleRows = [];
    let hasAnyData = false;

    for (let i = 0; i < 3; i++) {
      const r = this.viewRow + i;
      if (r > MAX_ROWS) break;
      const y = 11 + i * 12;

      // Row separator line
      scr.fb.hline(0, 191, y + 11);

      // Row number
      const rNumStr = String(r).padStart(2, ' ');
      scr.text(2, y + 2, rNumStr, { font: 'small' });

      // Cell 1
      const cell1 = this.getCell(this.viewCol, r);
      const val1Str = this.cellDisplayString(cell1);
      if (val1Str) {
        hasAnyData = true;
        scr.text(26, y + 2, val1Str, { font: 'small', align: 'right', right: 106 });
      }

      // Cell 2
      const cell2 = this.getCell(this.viewCol + 1, r);
      const val2Str = this.cellDisplayString(cell2);
      if (val2Str) {
        hasAnyData = true;
        scr.text(110, y + 2, val2Str, { font: 'small', align: 'right', right: 190 });
      }

      // Active cursor cell highlight
      const activeCol = this.phase === 'grab' ? this.grabCursor.col : this.cursor.col;
      const activeRow = this.phase === 'grab' ? this.grabCursor.row : this.cursor.row;
      if (activeRow === r) {
        if (activeCol === this.viewCol) {
          scr.invert(25, y, 83, 11);
        } else if (activeCol === this.viewCol + 1) {
          scr.invert(109, y, 82, 11);
        }
      }

      visibleRows.push({
        r,
        val1: val1Str,
        val2: val2Str
      });
    }

    // Horizontal separator above edit bar
    scr.fb.hline(0, 191, 47);

    // Bottom edit bar content
    let editContent = '';
    if (this.phase === 'edit') {
      editContent = treeToText(this.editor.root);
    } else if (this.phase === 'grab') {
      const grabCoord = formatCellCoord(this.grabCursor.col, this.grabCursor.row);
      editContent = treeToText(this.editor.root) + grabCoord;
    } else {
      const curCell = this.getCell(this.cursor.col, this.cursor.row);
      if (curCell && curCell.raw) {
        if (this.calc.setup.showCell === 'VALUE') {
          editContent = this.cellDisplayString(curCell);
        } else {
          editContent = curCell.raw;
        }
      }
    }

    const editLine = `${curCoord}:${editContent}`;
    scr.row(3, editLine);

    // Build text lines array
    const headerLine = `   |    ${col1}   |    ${col2}   |`;
    if (!hasAnyData) {
      scr.lines = [headerLine, editLine];
    } else {
      const rowLines = visibleRows.map((v) => {
        return `${String(v.r).padStart(2, ' ')} |${v.val1.padStart(8, ' ')}|${v.val2.padStart(8, ' ')}|`;
      });
      scr.lines = [headerLine, ...rowLines, editLine];
    }
  }

  cellDisplayString(cell) {
    if (!cell) return '';
    if (cell.error) return 'ERROR';
    if (cell.value !== null && cell.value !== undefined) {
      return cell.value.toString();
    }
    if (cell.raw && !cell.isFormula) {
      return cell.raw;
    }
    return '';
  }
}

export function createApp(calc) {
  return new SpreadsheetApp(calc);
}
