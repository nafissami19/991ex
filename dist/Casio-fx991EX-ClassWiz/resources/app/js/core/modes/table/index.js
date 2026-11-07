/** Mode 9: Table. Export createApp(calc). */
import { Editor } from '../../input/Editor.js';
import { inputAction, applyInput } from '../../input/keyInput.js';
import { parse } from '../../parse/parser.js';
import { Evaluator } from '../../eval/evaluate.js';
import { ResultView } from '../../format/ResultView.js';
import { treeToText } from '../../format/display.js';
import { CalcError, ERRORS } from '../../errors.js';
import { ExactValue } from '../../exact/ExactValue.js';
import { rowCount, ROW_LIMIT, formatCellValue, formatFullValue } from './cells.js';
import { isMathInput } from '../../setup.js';
import { measureText } from '../../../lcd/raster.js';

export class TableApp {
  constructor(calc) {
    this.calc = calc;
    this.title = 'Table';
    this.reset();
  }

  reset() {
    this.phase = 'fx'; // 'fx' | 'gx' | 'range' | 'table' | 'error'
    const math = isMathInput(this.calc.setup);
    this.editorF = new Editor({ math });
    this.editorG = new Editor({ math });
    this.rangeEditors = [
      new Editor({ math: false }),
      new Editor({ math: false }),
      new Editor({ math: false })
    ];
    this.rangeField = 0; // 0: Start, 1: End, 2: Step
    this.startVal = ExactValue.fromInt(1n);
    this.endVal = ExactValue.fromInt(5n);
    this.stepVal = ExactValue.fromInt(1n);
    this.hasGx = false;
    this.astF = null;
    this.astG = null;
    this.rows = [];
    this.selectedRow = 0;
    this.selectedCol = 0; // 0: x, 1: f(x), 2: g(x)
    this.topRow = 0;
    this.editingCell = false;
    this.cellEditor = null;
    this.error = null;
  }

  onEnter() {
    this.reset();
  }

  onExit() {
    this.editingCell = false;
  }

  onSetupChanged() {
    if (this.calc.setup.table === 'F' && this.hasGx) {
      this.hasGx = false;
      this.editorG.clear();
      this.astG = null;
    }
    const math = isMathInput(this.calc.setup);
    if (this.editorF.math !== math) {
      this.reset();
    }
  }

  notify(event, data) {
    if (event === 'inputOutputChanged') {
      this.reset();
    }
  }

  clearHistory() {}

  showError(err, prevPhase) {
    const msg = (err && err.message) || String(err);
    this.error = { message: msg, prevPhase: prevPhase || this.phase };
    this.phase = 'error';
  }

  enterRange() {
    this.phase = 'range';
    this.rangeField = 0;
    for (const ed of this.rangeEditors) ed.clear();
  }

  formatRangeVal(val) {
    if (val instanceof ExactValue) return val.toDecimal15().toString();
    return String(val);
  }

  commitRangeField(field) {
    const ed = this.rangeEditors[field];
    if (ed.isEmpty()) return;
    try {
      const ast = parse(ed.root, {});
      const ev = new Evaluator({
        memory: this.calc.memory,
        angle: this.calc.setup.angle,
        numberFormat: this.calc.setup.numberFormat,
        rng: this.calc.rng,
        constants: this.calc.constants
      });
      const val = ev.run(ast.list[0]);
      if (val instanceof ExactValue) {
        if (field === 0) this.startVal = val;
        else if (field === 1) this.endVal = val;
        else if (field === 2) this.stepVal = val;
      }
    } catch (err) {
      this.showError(err, 'range');
    } finally {
      ed.clear();
    }
  }

  generateTable() {
    try {
      const limit = (!this.hasGx || this.calc.setup.table === 'F') ? ROW_LIMIT.F : ROW_LIMIT.FG;
      const count = rowCount(this.startVal, this.endVal, this.stepVal, limit);
      this.rows = [];
      const ev = new Evaluator({
        memory: this.calc.memory,
        angle: this.calc.setup.angle,
        numberFormat: this.calc.setup.numberFormat,
        rng: this.calc.rng,
        constants: this.calc.constants
      });

      let curX = this.startVal;
      for (let i = 0; i < count; i++) {
        ev.local.x = curX;
        let fVal = 'ERROR';
        try {
          fVal = ev.run(this.astF.list[0]);
        } catch {
          fVal = 'ERROR';
        }

        let gVal = 'ERROR';
        if (this.hasGx && this.astG) {
          try {
            gVal = ev.run(this.astG.list[0]);
          } catch {
            gVal = 'ERROR';
          }
        }

        this.rows.push({
          x: curX,
          f: fVal,
          g: this.hasGx ? gVal : undefined
        });

        if (i < count - 1) {
          curX = curX.add(this.stepVal);
        }
      }

      this.selectedRow = 0;
      this.selectedCol = 0;
      this.topRow = 0;
      this.editingCell = false;
      this.phase = 'table';
      if (this.rows.length > 0) {
        this.calc.memory.setVar('x', this.rows[0].x);
      }
    } catch (err) {
      this.showError(err, 'range');
    }
  }

  updateRowX(rowIdx, newX) {
    if (!this.rows[rowIdx]) return;
    this.rows[rowIdx].x = newX;
    const ev = new Evaluator({
      memory: this.calc.memory,
      angle: this.calc.setup.angle,
      numberFormat: this.calc.setup.numberFormat,
      rng: this.calc.rng,
      constants: this.calc.constants
    });
    ev.local.x = newX;
    try {
      this.rows[rowIdx].f = ev.run(this.astF.list[0]);
    } catch {
      this.rows[rowIdx].f = 'ERROR';
    }
    if (this.hasGx && this.astG) {
      try {
        this.rows[rowIdx].g = ev.run(this.astG.list[0]);
      } catch {
        this.rows[rowIdx].g = 'ERROR';
      }
    }
    this.calc.memory.setVar('x', newX);
  }

  onKey(ev) {
    const k = ev.key;

    if (this.phase === 'error') {
      if (k === 'AC' && !ev.shift) {
        if (this.error && this.error.prevPhase === 'range') {
          this.phase = 'range';
        } else {
          this.phase = (this.error && this.error.prevPhase) || 'fx';
        }
        return true;
      }
      return true;
    }

    if (this.phase === 'fx') {
      if (k === 'AC' && !ev.shift) {
        this.editorF.clear();
        return true;
      }
      if (k === 'EXE' || k === '=') {
        if (this.editorF.isEmpty()) {
          this.showError(new CalcError(ERRORS.SYNTAX), 'fx');
          return true;
        }
        try {
          this.astF = parse(this.editorF.root, {});
        } catch (err) {
          this.showError(err, 'fx');
          return true;
        }
        if (this.calc.setup.table === 'FG') {
          this.phase = 'gx';
        } else {
          this.hasGx = false;
          this.enterRange();
        }
        return true;
      }
      if (k === 'DOWN' && !ev.shift && !ev.alpha) {
        if (this.calc.setup.table === 'FG') {
          try {
            if (!this.editorF.isEmpty()) this.astF = parse(this.editorF.root, {});
          } catch {}
          this.phase = 'gx';
          return true;
        }
      }
      const action = inputAction(ev, { math: this.editorF.math });
      if (action) {
        applyInput(this.editorF, action);
        return true;
      }
      return false;
    }

    if (this.phase === 'gx') {
      if (k === 'AC' && !ev.shift) {
        this.editorG.clear();
        return true;
      }
      if (k === 'UP' && !ev.shift && !ev.alpha) {
        this.phase = 'fx';
        return true;
      }
      if (k === 'EXE' || k === '=') {
        if (this.editorG.isEmpty()) {
          this.hasGx = false;
          this.astG = null;
        } else {
          try {
            this.astG = parse(this.editorG.root, {});
            this.hasGx = true;
          } catch (err) {
            this.showError(err, 'gx');
            return true;
          }
        }
        this.enterRange();
        return true;
      }
      const action = inputAction(ev, { math: this.editorG.math });
      if (action) {
        applyInput(this.editorG, action);
        return true;
      }
      return false;
    }

    if (this.phase === 'range') {
      if (k === 'AC' && !ev.shift) {
        if (this.rangeEditors[this.rangeField].isEmpty()) {
          this.phase = (this.calc.setup.table === 'FG') ? 'gx' : 'fx';
        } else {
          this.rangeEditors[this.rangeField].clear();
        }
        return true;
      }
      if (k === 'UP' && !ev.shift && !ev.alpha) {
        this.commitRangeField(this.rangeField);
        this.rangeField = (this.rangeField - 1 + 3) % 3;
        return true;
      }
      if (k === 'DOWN' && !ev.shift && !ev.alpha) {
        this.commitRangeField(this.rangeField);
        this.rangeField = (this.rangeField + 1) % 3;
        return true;
      }
      if (k === 'EXE' || k === '=') {
        this.commitRangeField(this.rangeField);
        if (this.rangeField === 0) {
          this.rangeField = 1;
        } else if (this.rangeField === 1) {
          this.rangeField = 2;
        } else if (this.rangeField === 2) {
          this.generateTable();
        }
        return true;
      }
      const action = inputAction(ev, { math: false });
      if (action) {
        applyInput(this.rangeEditors[this.rangeField], action);
        return true;
      }
      return false;
    }

    if (this.phase === 'table') {
      if (this.editingCell) {
        if (k === 'AC' && !ev.shift) {
          this.editingCell = false;
          return true;
        }
        if (k === 'EXE' || k === '=') {
          if (!this.cellEditor.isEmpty()) {
            try {
              const ast = parse(this.cellEditor.root, {});
              const ev = new Evaluator({
                memory: this.calc.memory,
                angle: this.calc.setup.angle,
                numberFormat: this.calc.setup.numberFormat,
                rng: this.calc.rng,
                constants: this.calc.constants
              });
              const newX = ev.run(ast.list[0]);
              this.updateRowX(this.selectedRow, newX);
            } catch {}
          }
          this.editingCell = false;
          return true;
        }
        const action = inputAction(ev, { math: false });
        if (action) {
          applyInput(this.cellEditor, action);
          return true;
        }
        return true;
      }

      if (k === 'AC' && !ev.shift) {
        this.phase = 'fx';
        return true;
      }
      if (k === 'DOWN') {
        if (this.selectedRow < this.rows.length - 1) {
          this.selectedRow++;
          if (this.selectedRow >= this.topRow + 3) {
            this.topRow = this.selectedRow - 2;
          }
          this.calc.memory.setVar('x', this.rows[this.selectedRow].x);
        }
        return true;
      }
      if (k === 'UP') {
        if (this.selectedRow > 0) {
          this.selectedRow--;
          if (this.selectedRow < this.topRow) {
            this.topRow = this.selectedRow;
          }
          this.calc.memory.setVar('x', this.rows[this.selectedRow].x);
        }
        return true;
      }
      if (k === 'RIGHT') {
        const maxCol = this.hasGx ? 2 : 1;
        if (this.selectedCol < maxCol) this.selectedCol++;
        return true;
      }
      if (k === 'LEFT') {
        if (this.selectedCol > 0) this.selectedCol--;
        return true;
      }
      if (this.selectedCol === 0) {
        if (k === 'ADD' && !ev.shift) {
          if (this.selectedRow > 0) {
            const aboveX = this.rows[this.selectedRow - 1].x;
            const newX = aboveX.add(this.stepVal);
            this.updateRowX(this.selectedRow, newX);
            return true;
          }
        }
        if ((k === 'SUB' || k === '-') && !ev.shift) {
          if (this.selectedRow > 0) {
            const aboveX = this.rows[this.selectedRow - 1].x;
            const newX = aboveX.sub(this.stepVal);
            this.updateRowX(this.selectedRow, newX);
            return true;
          }
        }
        const act = inputAction(ev, { math: false });
        if (act) {
          this.editingCell = true;
          this.cellEditor = new Editor({ math: false });
          applyInput(this.cellEditor, act);
          return true;
        }
      }
      return false;
    }

    return false;
  }

  indicators(set) {
    if (this.phase === 'gx') {
      set.add('Up');
    } else if (this.phase === 'range') {
      if (this.rangeField > 0) set.add('Up');
      if (this.rangeField < 2) set.add('Down');
    } else if (this.phase === 'table' && this.rows && this.rows.length > 0) {
      if (this.selectedRow > 0) set.add('Up');
      if (this.selectedRow < this.rows.length - 1) set.add('Down');
      if (this.selectedCol > 0) set.add('Left');
      const maxCol = this.hasGx ? 2 : 1;
      if (this.selectedCol < maxCol) set.add('Right');
    }
  }

  render(scr) {
    if (this.phase === 'error') {
      scr.row(0, this.error.message);
      scr.row(2, '[AC] :Cancel');
      scr.lines = [this.error.message, '[AC] :Cancel'];
      return;
    }

    if (this.phase === 'fx') {
      scr.text(1, 1, 'f(x)=');
      const pW = measureText('f(x)=', 'large');
      if (!this.editorF.isEmpty()) {
        scr.math(this.editorF.root, {
          x: pW + 2,
          top: 1,
          editor: { path: this.editorF.path, idx: this.editorF.idx, shape: this.editorF.cursorShape() },
          math: this.editorF.math
        });
      }
      scr.lines = ['f(x)=' + (this.editorF.isEmpty() ? '' : treeToText(this.editorF.root))];
      return;
    }

    if (this.phase === 'gx') {
      scr.text(1, 1, 'g(x)=');
      const pW = measureText('g(x)=', 'large');
      if (!this.editorG.isEmpty()) {
        scr.math(this.editorG.root, {
          x: pW + 2,
          top: 1,
          editor: { path: this.editorG.path, idx: this.editorG.idx, shape: this.editorG.cursorShape() },
          math: this.editorG.math
        });
      }
      scr.lines = ['g(x)=' + (this.editorG.isEmpty() ? '' : treeToText(this.editorG.root))];
      return;
    }

    if (this.phase === 'range') {
      scr.row(0, 'Table Range');
      const sText = this.rangeField === 0 && !this.rangeEditors[0].isEmpty()
        ? treeToText(this.rangeEditors[0].root)
        : this.formatRangeVal(this.startVal);
      const eText = this.rangeField === 1 && !this.rangeEditors[1].isEmpty()
        ? treeToText(this.rangeEditors[1].root)
        : this.formatRangeVal(this.endVal);
      const stText = this.rangeField === 2 && !this.rangeEditors[2].isEmpty()
        ? treeToText(this.rangeEditors[2].root)
        : this.formatRangeVal(this.stepVal);

      scr.row(1, 'Start :' + sText, { invert: this.rangeField === 0, invertW: 190 });
      scr.row(2, 'End   :' + eText, { invert: this.rangeField === 1, invertW: 190 });
      scr.row(3, 'Step  :' + stText, { invert: this.rangeField === 2, invertW: 190 });
      scr.lines = [
        'Table Range',
        'Start :' + sText,
        'End   :' + eText,
        'Step  :' + stText
      ];
      return;
    }

    if (this.phase === 'table') {
      this.renderTable(scr);
    }
  }

  renderTable(scr) {
    const isTwo = this.hasGx;
    const header = isTwo ? 'x f(x) g(x)' : 'x f(x)';
    scr.text(isTwo ? 45 : 60, 1, 'x', { font: 'small', record: false });
    scr.text(isTwo ? 100 : 145, 1, 'f(x)', { font: 'small', record: false });
    if (isTwo) {
      scr.text(160, 1, 'g(x)', { font: 'small', record: false });
    }
    scr.fb.hline(0, 191, 10);

    const divX1 = isTwo ? 22 : 24;
    const divX2 = isTwo ? 78 : 108;
    const divX3 = isTwo ? 134 : null;
    scr.fb.vline(divX1, 0, 47);
    scr.fb.vline(divX2, 0, 47);
    if (divX3 !== null) scr.fb.vline(divX3, 0, 47);

    const visibleCount = Math.min(3, this.rows.length - this.topRow);
    const visibleLines = [];

    const colWidthX = isTwo ? 54 : 82;
    const colWidthF = isTwo ? 54 : 82;
    const colWidthG = isTwo ? 54 : 0;

    for (let i = 0; i < visibleCount; i++) {
      const rIdx = this.topRow + i;
      const row = this.rows[rIdx];
      const y = 12 + i * 12;

      const numStr = String(rIdx + 1);
      const xStr = formatCellValue(row.x, this.calc.setup, colWidthX);
      const fStr = formatCellValue(row.f, this.calc.setup, colWidthF);
      const gStr = isTwo ? formatCellValue(row.g, this.calc.setup, colWidthG) : '';

      scr.text(1, y, numStr, { font: 'small', record: false });
      scr.text(divX1 + 2, y, xStr, { font: 'small', record: false });
      scr.text(divX2 + 2, y, fStr, { font: 'small', record: false });
      if (isTwo && divX3 !== null) {
        scr.text(divX3 + 2, y, gStr, { font: 'small', record: false });
      }

      if (rIdx === this.selectedRow) {
        let hX = 0, hW = 0;
        if (this.selectedCol === 0) {
          hX = divX1 + 1;
          hW = (divX2 - divX1) - 1;
        } else if (this.selectedCol === 1) {
          hX = divX2 + 1;
          hW = ((divX3 || 192) - divX2) - 1;
        } else if (this.selectedCol === 2 && isTwo) {
          hX = divX3 + 1;
          hW = 191 - divX3;
        }
        scr.fb.invertRect(hX, y - 1, hW, 11);
      }

      const lineStr = isTwo
        ? `${rIdx + 1} ${xStr} ${fStr} ${gStr}`
        : `${rIdx + 1} ${xStr} ${fStr}`;
      visibleLines.push(lineStr);
    }

    scr.fb.hline(0, 191, 47);

    let bottomText = '';
    const currentRow = this.rows[this.selectedRow];
    if (this.editingCell) {
      bottomText = treeToText(this.cellEditor.root);
      scr.text(1, 49, bottomText, { font: 'large', record: false });
    } else if (currentRow) {
      const cellVal = this.selectedCol === 0 ? currentRow.x : (this.selectedCol === 1 ? currentRow.f : currentRow.g);
      bottomText = formatFullValue(cellVal, this.calc.setup);
      if (cellVal === 'ERROR' || typeof cellVal === 'string') {
        scr.text(1, 49, bottomText, { font: 'large', record: false });
      } else if (cellVal instanceof ExactValue) {
        const rv = new ResultView(cellVal, this.calc.setup);
        scr.math(rv.tree(), { baseline: 59, align: 'right', right: 190, record: false });
      }
    }

    scr.lines = [header, ...visibleLines, bottomText];
  }

  toJSON() {
    return {
      phase: this.phase,
      editorF: this.editorF.snapshot(),
      editorG: this.editorG.snapshot(),
      startVal: this.startVal ? this.startVal.toJSON?.() || this.startVal : null,
      endVal: this.endVal ? this.endVal.toJSON?.() || this.endVal : null,
      stepVal: this.stepVal ? this.stepVal.toJSON?.() || this.stepVal : null,
      hasGx: this.hasGx,
      rangeField: this.rangeField,
      selectedRow: this.selectedRow,
      selectedCol: this.selectedCol,
      topRow: this.topRow
    };
  }

  fromJSON(o) {
    if (!o) return;
    this.phase = o.phase || 'fx';
    if (o.editorF) this.editorF.restore(o.editorF);
    if (o.editorG) this.editorG.restore(o.editorG);
    if (o.startVal) this.startVal = ExactValue.fromJSON ? ExactValue.fromJSON(o.startVal) : o.startVal;
    if (o.endVal) this.endVal = ExactValue.fromJSON ? ExactValue.fromJSON(o.endVal) : o.endVal;
    if (o.stepVal) this.stepVal = ExactValue.fromJSON ? ExactValue.fromJSON(o.stepVal) : o.stepVal;
    this.hasGx = !!o.hasGx;
    this.rangeField = o.rangeField || 0;
    this.selectedRow = o.selectedRow || 0;
    this.selectedCol = o.selectedCol || 0;
    this.topRow = o.topRow || 0;
    if (this.phase === 'table') {
      try {
        this.astF = parse(this.editorF.root, {});
        if (this.hasGx && !this.editorG.isEmpty()) this.astG = parse(this.editorG.root, {});
        this.generateTable();
      } catch {}
    }
  }
}

export function createApp(calc) {
  return new TableApp(calc);
}
