/**
 * Mode 10: Equation/Func Mode (Simultaneous Linear Equations & Polynomials)
 */

import { Editor } from '../../input/Editor.js';
import { inputAction, applyInput } from '../../input/keyInput.js';
import { parse } from '../../parse/parser.js';
import { Evaluator } from '../../eval/evaluate.js';
import { ResultView } from '../../format/ResultView.js';
import { treeToText } from '../../format/display.js';
import { renderError } from '../../apps/CalcApp.js';
import { CalcError, ERRORS, toCalcError } from '../../errors.js';
import { VARIABLE_KEYS } from '../../keys.js';
import { ExactValue } from '../../exact/ExactValue.js';
import { ComplexValue } from '../complex/ComplexValue.js';
import { MenuView } from '../../ui/views.js';
import { ROW_PITCH } from '../../ui/Screen.js';
import { solveSimultaneous, solvePolynomial } from './solver.js';

function formatCoeff(v, setup) {
  if (v instanceof ExactValue) {
    return treeToText(new ResultView(v, setup).tree());
  }
  return String(v);
}

export class EquationApp {
  constructor(calc) {
    this.calc = calc;
    this.title = 'Equation/Func';
    this.reset();
  }

  reset() {
    this.phase = 'type_select';
    this.modeType = null; // 'simul' | 'poly'
    this.numUnknowns = 2;
    this.degree = 2;
    this.coeffs = null;
    this.curRow = 0;
    this.curCol = 0;
    this.editor = null;
    this.solutionItems = [];
    this.solutionIndex = 0;
    this.stoPending = false;
    this.message = null;
    this.error = null;

    this.typeMenu = new MenuView(
      this.calc,
      [
        { label: 'Simul Equation', run: () => this.selectType('simul') },
        { label: 'Polynomial', run: () => this.selectType('poly') }
      ],
      { title: 'Equation/Func' }
    );
  }

  onEnter() {
    this.reset();
  }

  selectType(type) {
    if (type === 'simul') {
      this.phase = 'unknowns_select';
    } else {
      this.phase = 'degree_select';
    }
  }

  initSimul(n) {
    this.modeType = 'simul';
    this.numUnknowns = n;
    this.coeffs = Array.from({ length: n }, () =>
      Array.from({ length: n + 1 }, () => ExactValue.fromInt(0n))
    );
    this.curRow = 0;
    this.curCol = 0;
    this.editor = null;
    this.phase = 'coef_editor';
  }

  initPoly(deg) {
    this.modeType = 'poly';
    this.degree = deg;
    this.coeffs = Array.from({ length: deg + 1 }, () => ExactValue.fromInt(0n));
    this.curCol = 0;
    this.editor = null;
    this.phase = 'coef_editor';
  }

  showError(err) {
    const e = toCalcError(err);
    this.error = { message: e.message, loc: e.loc, goto: false };
    this.phase = 'error';
  }

  commitEditor() {
    if (!this.editor || this.editor.isEmpty()) {
      this.editor = null;
      return true;
    }
    try {
      const ast = parse(this.editor.root, {});
      const ev = new Evaluator({ memory: this.calc.memory, angle: this.calc.setup.angle });
      const val = ev.run(ast.list[0]);
      this.editor = null;
      if (this.modeType === 'simul') {
        this.coeffs[this.curRow][this.curCol] = val;
      } else {
        this.coeffs[this.curCol] = val;
      }
      return true;
    } catch (err) {
      this.showError(toCalcError(err));
      return false;
    }
  }

  solve() {
    if (this.modeType === 'simul') {
      const res = solveSimultaneous(this.coeffs, this.numUnknowns);
      if (res.type === 'no_solution') {
        this.phase = 'message';
        this.message = 'No Solution';
        return;
      }
      if (res.type === 'infinite_solution') {
        this.phase = 'message';
        this.message = 'Infinite Solution';
        return;
      }
      const varNames = ['x', 'y', 'z', 't'];
      this.solutionItems = res.solutions.map((val, idx) => ({
        type: 'simul',
        name: varNames[idx],
        val,
        resultView: new ResultView(val, this.calc.setup)
      }));
      this.solutionIndex = 0;
      this.phase = 'solution';
      return;
    }

    if (this.modeType === 'poly') {
      try {
        const res = solvePolynomial(this.coeffs, this.degree, this.calc.setup);
        const items = [];
        if (!res.hasRealRoots) {
          if (this.degree === 2) {
            items.push({ type: 'no_real_roots' });
          } else {
            this.phase = 'message';
            this.message = 'No Real Roots';
            return;
          }
        } else {
          res.roots.forEach((val, idx) => {
            items.push({
              type: 'root',
              name: `x${idx + 1}`,
              val,
              resultView: new ResultView(val, this.calc.setup, {
                complexMode: val instanceof ComplexValue
              })
            });
          });
        }

        if (this.degree === 2 && res.vertex) {
          items.push({
            type: 'vertex_x',
            minMax: res.vertex.minMax,
            val: res.vertex.x,
            resultView: new ResultView(res.vertex.x, this.calc.setup)
          });
          items.push({
            type: 'vertex_y',
            minMax: res.vertex.minMax,
            val: res.vertex.y,
            resultView: new ResultView(res.vertex.y, this.calc.setup)
          });
        }

        this.solutionItems = items;
        this.solutionIndex = 0;
        this.phase = 'solution';
      } catch (err) {
        this.showError(toCalcError(err));
      }
    }
  }

  onKey(ev) {
    const k = ev.key;

    if (this.phase === 'error') {
      if (k === 'AC' && !ev.shift) {
        this.phase = 'coef_editor';
        return true;
      }
      return true;
    }

    if (this.phase === 'message') {
      if ((k === 'AC' || k === 'EXE' || k === '=') && !ev.shift) {
        this.phase = 'coef_editor';
        return true;
      }
      return true;
    }

    if (this.phase === 'type_select') {
      if (k === '1' && !ev.shift && !ev.alpha) {
        this.selectType('simul');
        return true;
      }
      if (k === '2' && !ev.shift && !ev.alpha) {
        this.selectType('poly');
        return true;
      }
      if (k === 'AC' && !ev.shift) {
        if (this.coeffs) {
          this.phase = 'coef_editor';
        }
        return true;
      }
      return this.typeMenu.onKey(ev);
    }

    if (this.phase === 'unknowns_select') {
      if ((k === '2' || k === '3' || k === '4') && !ev.shift && !ev.alpha) {
        this.initSimul(Number(k));
        return true;
      }
      if ((k === 'LEFT' || k === 'AC') && !ev.shift) {
        this.phase = 'type_select';
        return true;
      }
      return true;
    }

    if (this.phase === 'degree_select') {
      if ((k === '2' || k === '3' || k === '4') && !ev.shift && !ev.alpha) {
        this.initPoly(Number(k));
        return true;
      }
      if ((k === 'LEFT' || k === 'AC') && !ev.shift) {
        this.phase = 'type_select';
        return true;
      }
      return true;
    }

    if (this.phase === 'solution') {
      return this.onSolutionKey(ev);
    }

    if (this.phase === 'coef_editor') {
      return this.onEditorKey(ev);
    }

    return false;
  }

  onEditorKey(ev) {
    const k = ev.key;

    if (k === 'AC' && !ev.shift) {
      if (this.editor) {
        this.editor.clear();
      } else {
        if (this.modeType === 'simul') {
          for (let r = 0; r < this.numUnknowns; r++) {
            for (let c = 0; c <= this.numUnknowns; c++) {
              this.coeffs[r][c] = ExactValue.fromInt(0n);
            }
          }
          this.curRow = 0;
          this.curCol = 0;
        } else {
          for (let c = 0; c <= this.degree; c++) {
            this.coeffs[c] = ExactValue.fromInt(0n);
          }
          this.curCol = 0;
        }
      }
      return true;
    }

    if (k === 'OPTN' && !ev.shift && !ev.alpha) {
      this.phase = 'type_select';
      return true;
    }

    if (k === 'LEFT' && !ev.shift && !ev.alpha) {
      if (this.editor && !this.editor.isEmpty()) {
        if (this.editor.horizontal('left')) return true;
      }
      this.commitEditor();
      if (this.modeType === 'simul') {
        this.curCol--;
        if (this.curCol < 0) {
          this.curCol = this.numUnknowns;
          this.curRow = (this.curRow - 1 + this.numUnknowns) % this.numUnknowns;
        }
      } else {
        this.curCol = Math.max(0, this.curCol - 1);
      }
      return true;
    }

    if (k === 'RIGHT' && !ev.shift && !ev.alpha) {
      if (this.editor && !this.editor.isEmpty()) {
        if (this.editor.horizontal('right')) return true;
      }
      this.commitEditor();
      if (this.modeType === 'simul') {
        this.curCol++;
        if (this.curCol > this.numUnknowns) {
          this.curCol = 0;
          this.curRow = (this.curRow + 1) % this.numUnknowns;
        }
      } else {
        this.curCol = Math.min(this.degree, this.curCol + 1);
      }
      return true;
    }

    if (k === 'UP' && !ev.shift && !ev.alpha) {
      this.commitEditor();
      if (this.modeType === 'simul') {
        this.curRow = (this.curRow - 1 + this.numUnknowns) % this.numUnknowns;
      } else {
        this.curCol = Math.max(0, this.curCol - 1);
      }
      return true;
    }

    if (k === 'DOWN' && !ev.shift && !ev.alpha) {
      this.commitEditor();
      if (this.modeType === 'simul') {
        this.curRow = (this.curRow + 1) % this.numUnknowns;
      } else {
        this.curCol = Math.min(this.degree, this.curCol + 1);
      }
      return true;
    }

    if ((k === 'EXE' || k === '=') && !ev.shift) {
      const hadInput = this.editor && !this.editor.isEmpty();
      const ok = this.commitEditor();
      if (!ok) return true;

      if (this.modeType === 'simul') {
        const isLastCell =
          this.curRow === this.numUnknowns - 1 && this.curCol === this.numUnknowns;
        if (isLastCell) {
          if (!hadInput) {
            this.solve();
          }
        } else {
          this.curCol++;
          if (this.curCol > this.numUnknowns) {
            this.curCol = 0;
            this.curRow++;
          }
        }
      } else {
        const isLastCell = this.curCol === this.degree;
        if (isLastCell) {
          if (!hadInput) {
            this.solve();
          }
        } else {
          this.curCol++;
        }
      }
      return true;
    }

    const action = inputAction(ev, { math: true });
    if (action) {
      if (!this.editor) this.editor = new Editor({ math: true });
      applyInput(this.editor, action);
      return true;
    }

    return false;
  }

  onSolutionKey(ev) {
    const k = ev.key;
    const item = this.solutionItems[this.solutionIndex];

    if (k === 'STO' && !ev.alpha) {
      this.stoPending = true;
      return true;
    }

    if (this.stoPending && !ev.shift && !ev.alpha) {
      this.stoPending = false;
      const v = VARIABLE_KEYS[k] || (k.length === 1 && 'ABCDEFxyM'.includes(k) ? k : null);
      if (v && item?.val) {
        this.calc.memory.setVar(v, item.val);
        this.calc.memory.setAns(item.val);
      }
      return true;
    }

    if (k === 'M_PLUS' && !ev.alpha) {
      if (item?.val) {
        if (ev.shift) {
          this.calc.memory.addM(item.val.neg ? item.val.neg() : item.val);
        } else {
          this.calc.memory.addM(item.val);
        }
      }
      return true;
    }

    if (k === 'OPTN' && !ev.shift && !ev.alpha) {
      this.phase = 'type_select';
      return true;
    }

    if (k === 'AC' && !ev.shift) {
      this.stoPending = false;
      this.phase = 'coef_editor';
      return true;
    }

    if ((k === 'EXE' || k === '=') && !ev.shift) {
      this.stoPending = false;
      if (this.solutionIndex < this.solutionItems.length - 1) {
        this.solutionIndex++;
      } else {
        this.phase = 'coef_editor';
      }
      return true;
    }

    if (k === 'DOWN' && !ev.shift && !ev.alpha) {
      this.stoPending = false;
      if (this.solutionIndex < this.solutionItems.length - 1) {
        this.solutionIndex++;
      }
      return true;
    }

    if (k === 'UP' && !ev.shift && !ev.alpha) {
      this.stoPending = false;
      if (this.solutionIndex > 0) {
        this.solutionIndex--;
      }
      return true;
    }

    if (k === 'SD' && !ev.shift && !ev.alpha) {
      if (item?.resultView) {
        item.resultView.toggleSD();
      }
      return true;
    }

    return false;
  }

  indicators(set) {
    if (this.phase === 'solution') {
      if (this.calc.setup.inputOutput.startsWith('MathI')) {
        set.add('Math');
      }
      set.add(this.calc.setup.angle === 'RAD' ? 'R' : this.calc.setup.angle === 'GRA' ? 'G' : 'D');
      if (this.solutionIndex > 0) {
        set.add('Up');
      }
      if (this.solutionIndex < this.solutionItems.length - 1) {
        set.add('Down');
      }
      if (this.stoPending) {
        set.add('STO');
      }
      const item = this.solutionItems[this.solutionIndex];
      if (item?.val instanceof ComplexValue) {
        if (this.calc.setup.complex === 'POLAR') {
          set.add('∠');
        } else {
          set.add('i');
        }
      }
    } else if (this.phase === 'coef_editor') {
      if (this.calc.setup.inputOutput.startsWith('MathI')) {
        set.add('Math');
      }
      set.add(this.calc.setup.angle === 'RAD' ? 'R' : this.calc.setup.angle === 'GRA' ? 'G' : 'D');
    }
  }

  render(scr) {
    if (this.phase === 'error') {
      renderError(scr, this.error);
      return;
    }
    if (this.phase === 'message') {
      scr.row(0, this.message);
      scr.row(2, '[AC] :Cancel');
      scr.lines = [this.message, '[AC] :Cancel'];
      return;
    }
    if (this.phase === 'type_select') {
      this.typeMenu.render(scr);
      return;
    }
    if (this.phase === 'unknowns_select') {
      scr.row(0, 'Simul Equation');
      scr.row(1, 'Unknowns?');
      scr.row(2, 'Select 2~4');
      scr.lines = ['Simul Equation', 'Unknowns?', 'Select 2~4'];
      return;
    }
    if (this.phase === 'degree_select') {
      scr.row(0, 'Polynomial');
      scr.row(1, 'Degree?');
      scr.row(2, 'Select 2~4');
      scr.lines = ['Polynomial', 'Degree?', 'Select 2~4'];
      return;
    }
    if (this.phase === 'coef_editor') {
      this.renderEditor(scr);
      return;
    }
    if (this.phase === 'solution') {
      this.renderSolution(scr);
      return;
    }
  }

  renderEditor(scr) {
    let header = '';
    let label = '';
    const letters = ['a', 'b', 'c', 'd', 'e'];

    if (this.modeType === 'simul') {
      const headers = {
        2: 'anx+bny=cn',
        3: 'anx+bny+cnz=dn',
        4: 'anx+bny+cnz+dnt=en'
      };
      header = headers[this.numUnknowns] || '';
      label = `${letters[this.curCol]}${this.curRow + 1}=`;
    } else {
      const headers = {
        2: 'ax²+bx+c=0',
        3: 'ax³+bx²+cx+d=0',
        4: 'ax⁴+bx³+cx²+dx+e=0'
      };
      header = headers[this.degree] || '';
      label = `${letters[this.curCol]}=`;
    }

    let valText = '';
    if (this.editor && !this.editor.isEmpty()) {
      valText = treeToText(this.editor.root);
      scr.row(0, header);
      const labelW = scr.text(1, 1 + ROW_PITCH, label);
      scr.math(this.editor.root, {
        x: 1 + labelW + 2,
        top: 1 + ROW_PITCH,
        editor: {
          path: this.editor.path,
          idx: this.editor.idx,
          shape: this.editor.cursorShape()
        }
      });
      scr.lines = [header, `${label}${valText}`];
    } else {
      const curVal =
        this.modeType === 'simul'
          ? this.coeffs[this.curRow][this.curCol]
          : this.coeffs[this.curCol];
      valText = formatCoeff(curVal, this.calc.setup);
      scr.row(0, header);
      scr.text(1, 1 + ROW_PITCH, `${label}${valText}`);
      scr.lines = [header, `${label}${valText}`];
    }
  }

  renderSolution(scr) {
    const item = this.solutionItems[this.solutionIndex];
    if (!item) return;

    if (item.type === 'no_real_roots') {
      scr.row(0, 'No Real Roots');
      scr.lines = ['No Real Roots'];
      return;
    }

    let header = '';
    let label = '';
    if (item.type === 'simul') {
      label = `${item.name}=`;
    } else if (item.type === 'root') {
      label = `${item.name}=`;
    } else if (item.type === 'vertex_x') {
      header = item.minMax === 'Min' ? 'x-Value of Min' : 'x-Value of Max';
      label = 'x=';
    } else if (item.type === 'vertex_y') {
      header = item.minMax === 'Min' ? 'y-Value of Min' : 'y-Value of Max';
      label = 'y=';
    }

    const rv = item.resultView;
    const tree = rv.tree();
    const resultText = treeToText(tree);

    if (header) {
      scr.row(0, header);
      scr.text(1, 1 + ROW_PITCH, label);
      const box = scr.measure(tree);
      const baseline = 62 - box.desc;
      const x = Math.max(1, 190 - box.w);
      scr.math(tree, { x, baseline, record: false });
      scr.lines = [header, resultText];
    } else {
      scr.text(1, 1, label);
      const box = scr.measure(tree);
      const baseline = 62 - box.desc;
      const x = Math.max(1, 190 - box.w);
      scr.math(tree, { x, baseline, record: false });
      scr.lines = [label, resultText];
    }
  }
}
