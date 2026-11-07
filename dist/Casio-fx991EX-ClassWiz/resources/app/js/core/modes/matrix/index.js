/**
 * Mode 4: Matrix. Export createApp(calc).
 */
import { CalcApp } from '../../apps/CalcApp.js';
import { Matrix } from './Matrix.js';
import { MatrixEvaluator } from './MatrixEvaluator.js';
import { MatrixOptnView } from './MatrixViews.js';
import { CalcError, ERRORS } from '../../errors.js';
import { ExactValue } from '../../exact/ExactValue.js';
import { Decimal15 } from '../../number/Decimal15.js';
import { formatNumber } from '../../format/formatNumber.js';
import { ROW_PITCH } from '../../ui/Screen.js';

export class MatrixApp extends CalcApp {
  constructor(calc) {
    super(calc);
    this.title = 'Matrix';
  }

  reset() {
    super.reset();
    this.matrixPhase = 'edit'; // 'edit' | 'define' | 'select_edit' | 'dim_rows' | 'dim_cols' | 'editor' | 'result_matrix'
    this.targetName = 'MatA';
    this.dimRows = 0;
    this.dimCols = 0;
    this.currentMatrix = null;
    this.currentMatrixName = 'MatA';
    this.isReadOnlyEditor = false;
    this.cellRow = 0;
    this.cellCol = 0;
    this.scrollRow = 0;
    this.scrollCol = 0;
    this.cellInputStr = '';
    this.stoPending = false;
    this.sdDecimal = false;
  }

  onEnter() {
    this.reset();
    this.matrixPhase = 'define';
  }

  evaluatorContext() {
    const ctx = super.evaluatorContext();
    ctx.getMatrix = (ref) => this.getMatrix(ref);
    return ctx;
  }

  makeEvaluator() {
    return new MatrixEvaluator(this.evaluatorContext());
  }

  getMatrix(ref) {
    const md = this.calc.memory.modeData.matrix;
    if (!md) return null;
    let m = md[ref];
    if (m && !(m instanceof Matrix) && m.type === 'matrix') {
      m = Matrix.fromJSON(m);
      md[ref] = m;
    }
    return m;
  }

  setMatrix(name, matrix) {
    if (!this.calc.memory.modeData.matrix) {
      this.calc.memory.modeData.matrix = {};
    }
    this.calc.memory.modeData.matrix[name] = matrix;
  }

  openOptn() {
    this.calc.pushView(new MatrixOptnView(this.calc, this));
  }

  openEditor(name, matrix, readOnly = false) {
    this.matrixPhase = readOnly ? 'result_matrix' : 'editor';
    this.currentMatrixName = name;
    this.currentMatrix = matrix;
    this.isReadOnlyEditor = readOnly;
    this.cellRow = 0;
    this.cellCol = 0;
    this.scrollRow = 0;
    this.scrollCol = 0;
    this.cellInputStr = '';
    this.stoPending = false;
    this.sdDecimal = false;
  }

  runStatement() {
    const node = this.statements[this.stmtIndex];
    const ev = this.makeEvaluator();
    let value;
    try {
      value = this.evaluateStatement(ev, node);
    } catch (err) {
      this.showError(err);
      return;
    }
    if (value instanceof Matrix) {
      this.setMatrix('MatAns', value);
      this.lastValue = value;
      this.openEditor('MatAns', value, true);
      return;
    }
    this.matrixPhase = 'edit';
    super.runStatement();
  }

  indicators(set) {
    super.indicators(set);
    if (this.stoPending) set.add('STO');
    if (this.matrixPhase === 'editor' || this.matrixPhase === 'result_matrix') {
      if (this.scrollRow > 0) set.add('Up');
      if (this.currentMatrix && this.scrollRow + 2 < this.currentMatrix.rows) set.add('Down');
      if (this.scrollCol > 0) set.add('Left');
      if (this.currentMatrix && this.scrollCol + 2 < this.currentMatrix.cols) set.add('Right');
    }
  }

  onKey(ev) {
    const k = ev.key;

    // Handle error phase first
    if (this.phase === 'error') {
      const handled = this.onErrorKey(ev);
      if (this.phase !== 'error') this.matrixPhase = 'edit';
      return handled;
    }

    // 1. Define Matrix Dialog phase
    if (this.matrixPhase === 'define') {
      if (k === 'AC' && !ev.shift) {
        this.matrixPhase = 'edit';
        return true;
      }
      const map = { '1': 'MatA', '2': 'MatB', '3': 'MatC', '4': 'MatD' };
      const name = map[k];
      if (name && !ev.shift && !ev.alpha) {
        this.targetName = name;
        this.matrixPhase = 'dim_rows';
        return true;
      }
      return true;
    }

    // 2. Select Edit Matrix phase
    if (this.matrixPhase === 'select_edit') {
      if (k === 'AC' && !ev.shift) {
        this.matrixPhase = 'edit';
        return true;
      }
      const map = { '1': 'MatA', '2': 'MatB', '3': 'MatC', '4': 'MatD' };
      const name = map[k];
      if (name && !ev.shift && !ev.alpha) {
        const mat = this.getMatrix(name);
        if (!mat || !mat.rows || !mat.cols) {
          this.matrixPhase = 'edit';
          this.showError(new CalcError(ERRORS.DIMENSION));
          return true;
        }
        this.openEditor(name, mat, false);
        return true;
      }
      return true;
    }

    // 3. Dimension prompts: Rows
    if (this.matrixPhase === 'dim_rows') {
      if (k === 'AC' && !ev.shift) {
        this.matrixPhase = 'edit';
        return true;
      }
      const d = Number(k);
      if (d >= 1 && d <= 4 && !ev.shift && !ev.alpha) {
        this.dimRows = d;
        this.matrixPhase = 'dim_cols';
        return true;
      }
      return true;
    }

    // 4. Dimension prompts: Cols
    if (this.matrixPhase === 'dim_cols') {
      if (k === 'AC' && !ev.shift) {
        this.matrixPhase = 'edit';
        return true;
      }
      const d = Number(k);
      if (d >= 1 && d <= 4 && !ev.shift && !ev.alpha) {
        this.dimCols = d;
        const matrix = new Matrix(this.dimRows, this.dimCols);
        this.setMatrix(this.targetName, matrix);
        this.openEditor(this.targetName, matrix, false);
        return true;
      }
      return true;
    }

    // 5. Matrix Editor or MatAns result screen
    if (this.matrixPhase === 'editor' || this.matrixPhase === 'result_matrix') {
      if (k === 'OPTN' && !ev.shift && !ev.alpha) {
        this.commitCellInput();
        this.openOptn();
        return true;
      }

      // STO copy
      if (this.stoPending) {
        this.stoPending = false;
        if (k === 'AC') return true;
        const targetMap = {
          NEG: 'MatA', A: 'MatA', '(-)': 'MatA',
          DEG: 'MatB', B: 'MatB', "°'\"": 'MatB',
          INV: 'MatC', C: 'MatC', 'x⁻¹': 'MatC',
          SIN: 'MatD', D: 'MatD', sin: 'MatD'
        };
        const dest = targetMap[k];
        if (dest) {
          const copy = this.currentMatrix.clone();
          this.setMatrix(dest, copy);
          this.openEditor(dest, copy, false);
          return true;
        }
        return true;
      }

      if (k === 'STO' && !ev.shift && !ev.alpha) {
        this.commitCellInput();
        this.stoPending = true;
        return true;
      }

      // MatAns continuation operators
      if (this.matrixPhase === 'result_matrix') {
        const continueOps = {
          ADD: '+', '+': '+',
          SUB: '-', '-': '-',
          MUL: '*', '*': '*', '×': '*',
          DIV: '/', '/': '/', '÷': '/',
          SQUARE: ev.shift ? 'cube' : 'sq',
          'x²': ev.shift ? 'cube' : 'sq',
          'x³': 'cube',
          INV: 'inv', 'x⁻¹': 'inv'
        };
        if (continueOps[k] !== undefined) {
          this.matrixPhase = 'edit';
          this.reset();
          this.insertInput({ tok: 'MatAns' });
          const op = continueOps[k];
          if (op === 'sq' || op === 'cube' || op === 'inv') {
            this.insertInput({ tok: op }, true);
          } else {
            this.insertInput({ tok: op });
          }
          return true;
        }
      }

      if (k === 'AC' && !ev.shift) {
        if (this.cellInputStr.length > 0) {
          this.cellInputStr = '';
          return true;
        }
        this.matrixPhase = 'edit';
        this.editor.clear();
        this.phase = 'edit';
        return true;
      }

      // S<=>D toggle
      if (k === 'SD' && !ev.shift && !ev.alpha) {
        this.sdDecimal = !this.sdDecimal;
        return true;
      }

      // Arrow navigation
      if (k === 'RIGHT' && !ev.shift && !ev.alpha) {
        this.commitCellInput();
        this.cellCol = Math.min(this.currentMatrix.cols - 1, this.cellCol + 1);
        this.adjustScroll();
        return true;
      }
      if (k === 'LEFT' && !ev.shift && !ev.alpha) {
        this.commitCellInput();
        this.cellCol = Math.max(0, this.cellCol - 1);
        this.adjustScroll();
        return true;
      }
      if (k === 'DOWN' && !ev.shift && !ev.alpha) {
        this.commitCellInput();
        this.cellRow = Math.min(this.currentMatrix.rows - 1, this.cellRow + 1);
        this.adjustScroll();
        return true;
      }
      if (k === 'UP' && !ev.shift && !ev.alpha) {
        this.commitCellInput();
        this.cellRow = Math.max(0, this.cellRow - 1);
        this.adjustScroll();
        return true;
      }

      // Cell input (if not readOnly)
      if (!this.isReadOnlyEditor) {
        if (/^[0-9]$/.test(k) && !ev.shift && !ev.alpha) {
          this.cellInputStr += k;
          return true;
        }
        if (k === 'DOT' && !ev.shift && !ev.alpha) {
          if (!this.cellInputStr.includes('.')) this.cellInputStr += '.';
          return true;
        }
        if ((k === 'FRAC' || k === 'DIV' || k === '/') && !ev.shift && !ev.alpha) {
          if (!this.cellInputStr.includes('┘') && !this.cellInputStr.includes('/')) {
            this.cellInputStr += '┘';
          }
          return true;
        }
        if (k === 'NEG' && !ev.shift && !ev.alpha) {
          if (this.cellInputStr === '') this.cellInputStr = '-';
          return true;
        }
        if (k === 'DEL' && !ev.shift) {
          if (this.cellInputStr.length > 0) this.cellInputStr = this.cellInputStr.slice(0, -1);
          return true;
        }
        if ((k === 'EXE' || k === '=') && !ev.shift) {
          this.commitCellInput();
          this.cellCol++;
          if (this.cellCol >= this.currentMatrix.cols) {
            this.cellCol = 0;
            this.cellRow++;
          }
          if (this.cellRow >= this.currentMatrix.rows) {
            this.cellRow = 0;
          }
          this.adjustScroll();
          return true;
        }
      }

      return true;
    }

    // 6. Normal Calculation Screen
    return super.onKey(ev);
  }

  commitCellInput() {
    if (this.cellInputStr.length > 0 && this.currentMatrix) {
      try {
        const s = this.cellInputStr.trim();
        let val;
        if (s === '-' || s === '') {
          val = ExactValue.fromInt(0n);
        } else {
          const fracMatch = s.match(/^(-?\d+)\s*[\/┘]\s*(\d+)$/);
          if (fracMatch) {
            const n = BigInt(fracMatch[1]);
            const d = BigInt(fracMatch[2]);
            if (d === 0n) throw new CalcError(ERRORS.MATH);
            val = ExactValue.fromRational(n, d);
          } else if (s.includes('.')) {
            val = ExactValue.fromDecimal15(Decimal15.fromString(s));
          } else {
            val = ExactValue.fromInt(BigInt(s));
          }
        }
        this.currentMatrix.set(this.cellRow, this.cellCol, val);
      } catch {}
      this.cellInputStr = '';
    }
  }

  adjustScroll() {
    if (this.cellRow < this.scrollRow) this.scrollRow = this.cellRow;
    if (this.cellRow >= this.scrollRow + 2) this.scrollRow = this.cellRow - 1;
    if (this.cellCol < this.scrollCol) this.scrollCol = this.cellCol;
    if (this.cellCol >= this.scrollCol + 2) this.scrollCol = this.cellCol - 1;
  }

  formatCell(val, decimal = false) {
    if (!val) return '0';
    if (decimal) {
      return formatNumber(val.toDecimal15(), { format: this.calc.setup.numberFormat }).fullString;
    }
    if (val.type === 'rational') {
      if (val.value.d === 1n) return val.value.n.toString();
      return `${val.value.n}┘${val.value.d}`;
    }
    return formatNumber(val.toDecimal15(), { format: this.calc.setup.numberFormat }).fullString;
  }

  render(scr) {
    if (this.phase === 'error') {
      super.render(scr);
      return;
    }

    if (this.matrixPhase === 'define' || this.matrixPhase === 'select_edit') {
      scr.text(1, 1, '1:MatA');
      scr.text(96, 1, '2:MatB');
      scr.text(1, 1 + ROW_PITCH, '3:MatC');
      scr.text(96, 1 + ROW_PITCH, '4:MatD');
      scr.lines = [
        '1:MatA    2:MatB',
        '3:MatC    4:MatD'
      ];
      return;
    }

    if (this.matrixPhase === 'dim_rows') {
      scr.row(0, this.targetName);
      scr.row(1, 'Rows?  1~4');
      scr.lines = [this.targetName, 'Rows?  1~4'];
      return;
    }

    if (this.matrixPhase === 'dim_cols') {
      scr.row(0, this.targetName);
      scr.row(1, 'Cols?  1~4');
      scr.lines = [this.targetName, 'Cols?  1~4'];
      return;
    }

    if (this.matrixPhase === 'editor' || this.matrixPhase === 'result_matrix') {
      const curVal = this.currentMatrix ? this.currentMatrix.get(this.cellRow, this.cellCol) : null;
      const bottomVal = this.cellInputStr.length > 0 ? this.cellInputStr : this.formatCell(curVal, this.sdDecimal);

      scr.text(1, 1, this.currentMatrixName);

      if (this.currentMatrix) {
        // Left bracket
        scr.fb.vline(10, 13, 45);
        scr.fb.hline(10, 13, 14);
        scr.fb.hline(10, 45, 14);

        // Right bracket
        scr.fb.vline(181, 13, 45);
        scr.fb.hline(177, 13, 181);
        scr.fb.hline(177, 45, 181);

        const visRows = Math.min(2, this.currentMatrix.rows - this.scrollRow);
        const visCols = Math.min(2, this.currentMatrix.cols - this.scrollCol);

        for (let vr = 0; vr < visRows; vr++) {
          const r = this.scrollRow + vr;
          const y = 15 + vr * 16;
          for (let vc = 0; vc < visCols; vc++) {
            const c = this.scrollCol + vc;
            const x = 16 + vc * 82;
            const s = this.formatCell(this.currentMatrix.get(r, c), false);
            scr.text(x, y, s);
            if (r === this.cellRow && c === this.cellCol) {
              scr.fb.invertRect(x - 2, y - 1, 80, 14);
            }
          }
        }

        const rowLines = [];
        for (let r = 0; r < this.currentMatrix.rows; r++) {
          const parts = [];
          for (let c = 0; c < this.currentMatrix.cols; c++) {
            parts.push(this.formatCell(this.currentMatrix.get(r, c), false));
          }
          rowLines.push(`[ ${parts.join('  ')} ]`);
        }

        scr.text(190, 48, bottomVal, { align: 'right' });

        scr.lines = [
          this.currentMatrixName,
          ...rowLines,
          bottomVal
        ];
      }
      return;
    }

    // Default: Calculation screen
    super.render(scr);
  }
}

export function createApp(calc) {
  return new MatrixApp(calc);
}
export { Matrix } from './Matrix.js';
