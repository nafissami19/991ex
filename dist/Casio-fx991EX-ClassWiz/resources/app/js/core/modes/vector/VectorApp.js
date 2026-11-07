/**
 * Mode 5: Vector Mode
 */
import { CalcApp, isPostfixId } from '../../apps/CalcApp.js';
import { VectorEvaluator } from './VectorEvaluator.js';
import { VectorValue } from './VectorValue.js';
import { DimensionPromptView, VectorEditorView, VectorOptnMenuView } from './VectorViews.js';
import { MenuView } from '../../ui/views.js';
import { ROW_PITCH } from '../../ui/Screen.js';
import { isContinueKey } from '../../input/keyInput.js';

export class VectorApp extends CalcApp {
  constructor(calc) {
    super(calc);
    this.title = 'Vector';
    if (!this.calc.memory.modeData.vector) {
      this.calc.memory.modeData.vector = {
        VctA: null,
        VctB: null,
        VctC: null,
        VctD: null,
        VctAns: null
      };
    }
    this.vectorResult = null;
    this.vctAnsIdx = 0;
    this.vectorDecimalMode = false;
  }

  getVector(name) {
    return this.calc.memory.modeData.vector?.[name] || null;
  }

  setVector(name, vec) {
    if (!this.calc.memory.modeData.vector) this.calc.memory.modeData.vector = {};
    this.calc.memory.modeData.vector[name] = vec;
  }

  reset() {
    super.reset();
    this.vectorResult = null;
    this.vctAnsIdx = 0;
    this.vectorDecimalMode = false;
  }

  onEnter() {
    this.reset();
    this.phase = 'init_define';
  }

  evaluatorContext() {
    const ctx = super.evaluatorContext();
    ctx.getVector = (ref) => this.getVector(ref);
    return ctx;
  }

  makeEvaluator() {
    return new VectorEvaluator(this.evaluatorContext());
  }

  openOptn() {
    this.calc.pushView(new VectorOptnMenuView(this.calc, this));
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

    if (value instanceof VectorValue) {
      this.setVector('VctAns', value);
      this.vectorResult = value;
      this.vctAnsIdx = 0;
      this.phase = 'vector_result';
      this.lastValue = value;
      this.pushHistory();
      return;
    }

    super.runStatement();
  }

  pushHistory() {
    if (this.phase === 'vector_result') {
      this.history.push({
        root: this.editor.snapshot().root,
        vectorResult: this.vectorResult,
        suffix: this.suffix
      });
      return;
    }
    super.pushHistory();
  }

  onKey(ev) {
    const k = ev.key;

    if (this.phase === 'init_define') {
      if (k === 'AC') {
        this.phase = 'edit';
        return true;
      }
      if (k === '1' || k === '2' || k === '3' || k === '4') {
        const name = ['VctA', 'VctB', 'VctC', 'VctD'][Number(k) - 1];
        this.phase = 'edit';
        this.calc.pushView(new DimensionPromptView(this.calc, this, name));
        return true;
      }
      this.phase = 'edit';
      return this.onKey(ev);
    }

    if (this.phase === 'vector_result') {
      if (this.stoPending) {
        this.stoPending = false;
        let dest = null;
        if (k === 'A' || k === 'NEG' || k === '(-)') dest = 'VctA';
        else if (k === 'B' || k === 'DEG') dest = 'VctB';
        else if (k === 'C' || k === 'INV' || k === 'x⁻¹') dest = 'VctC';
        else if (k === 'D' || k === 'SIN' || k === 'sin') dest = 'VctD';
        if (dest) {
          this.setVector(dest, this.vectorResult.clone());
          this.calc.pushView(new VectorEditorView(this.calc, this, dest, this.vectorResult.dim, this.vectorResult));
          return true;
        }
        return true;
      }

      if (k === 'STO') {
        this.stoPending = true;
        return true;
      }

      if (k === 'AC' && !ev.shift) {
        this.reset();
        return true;
      }

      if (k === 'LEFT' && !ev.shift && !ev.alpha) {
        this.vctAnsIdx = Math.max(0, this.vctAnsIdx - 1);
        return true;
      }

      if (k === 'RIGHT' && !ev.shift && !ev.alpha) {
        this.vctAnsIdx = Math.min(this.vectorResult.dim - 1, this.vctAnsIdx + 1);
        return true;
      }

      if (k === 'SD' || k === 'S<=>D' || k === 'S⇔D') {
        this.vectorDecimalMode = !this.vectorDecimalMode;
        return true;
      }

      // Continuation with operator
      if (isContinueKey(ev, { math: this.editor.math }) || k === 'dot' || k === '•') {
        const action = this.inputActionFor(ev);
        this.reset();
        this.insertInput({ tok: 'VctAns' });
        if (action) {
          this.insertInput(action, true);
        } else if (k === 'dot' || k === '•') {
          this.insertInput({ tok: 'dot' });
        }
        return true;
      }

      // Fresh calculation
      if (/^[0-9]$/.test(k) || k === 'OPTN' || k === 'LPAREN' || k === '(') {
        this.reset();
        return this.onKey(ev);
      }
    }

    return super.onKey(ev);
  }

  render(scr) {
    if (this.phase === 'init_define') {
      scr.row(0, 'Vector');
      scr.row(1, '1:VctA   2:VctB');
      scr.row(2, '3:VctC   4:VctD');
      scr.lines = ['Vector', '1:VctA   2:VctB', '3:VctC   4:VctD'];
      return;
    }

    if (this.phase === 'vector_result') {
      scr.row(0, 'VctAns');

      // Grid of vector elements
      const els = this.vectorResult.elements.map((e) =>
        this.vectorResult.formatElement(e, { decimal: this.vectorDecimalMode })
      );
      const gridText = `[ ${els.join('  ')} ]`;
      scr.text(4, 1 + ROW_PITCH, gridText);

      // Selected element full value
      const bottomText = this.vectorResult.formatElement(this.vectorResult.elements[this.vctAnsIdx], {
        decimal: this.vectorDecimalMode
      });
      scr.text(4, 1 + 3 * ROW_PITCH, bottomText);

      scr.lines = ['VctAns', gridText, '', bottomText];
      return;
    }

    super.render(scr);
  }
}
