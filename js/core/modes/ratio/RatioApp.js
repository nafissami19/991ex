/**
 * Mode 12: Ratio Mode (MENU C)
 *
 * Implements proportion solving per Casio fx-991EX ClassWiz User's Guide (p. 31):
 * - Type 1: A : B = X : D  =>  X = (A * D) / B
 * - Type 2: A : B = C : X  =>  X = (B * C) / A
 *
 * Flow:
 * 1. Ratio Type Selection Screen (1: A:B=X:D, 2: A:B=C:X)
 * 2. Coefficient Editor Screen: prompts for known coefficients (A, B, and D or C).
 *    All coefficients default to 1. Pressing AC resets all coefficients to 1.
 * 3. Solution Screen: displays calculated X value.
 *    Supports exact fraction (MathO) and decimal (DecimalO) forms, S<=>D toggle,
 *    mixed fraction toggle, and STO assignment to variables.
 * 4. Zero coefficient validation: Math ERROR occurs if any coefficient is 0 when calculating.
 *    Supports Goto ([◀][▶]) returning to the zero coefficient.
 */

import { ExactValue } from '../../exact/ExactValue.js';
import { ResultView } from '../../format/ResultView.js';
import { treeToText } from '../../format/display.js';
import { Editor } from '../../input/Editor.js';
import { inputAction, applyInput } from '../../input/keyInput.js';
import { parse } from '../../parse/parser.js';
import { Evaluator } from '../../eval/evaluate.js';
import { CalcError, ERRORS, toCalcError } from '../../errors.js';
import { ROW_PITCH } from '../../ui/Screen.js';
import { renderError } from '../../apps/CalcApp.js';
import { VARIABLE_KEYS } from '../../keys.js';
import { isMathInput } from '../../setup.js';
import { MenuView } from '../../ui/views.js';

function formatCoeff(ev, setup) {
  if (!ev) return '1';
  try {
    const rv = new ResultView(ev, setup);
    return treeToText(rv.tree());
  } catch {
    return '1';
  }
}

export class RatioApp {
  constructor(calc) {
    this.calc = calc;
    this.title = 'Ratio';
    this.reset();
  }

  reset() {
    this.phase = 'type_select'; // 'type_select' | 'editor' | 'result' | 'error'
    this.type = 1; // 1: A:B=X:D, 2: A:B=C:X
    this.menuSel = 0; // 0 for type 1, 1 for type 2
    this.coefficients = {
      A: ExactValue.fromInt(1n),
      B: ExactValue.fromInt(1n),
      C: ExactValue.fromInt(1n),
      D: ExactValue.fromInt(1n)
    };
    this.slot = 0; // 0, 1, 2 index within currentVars
    this.input = null; // Editor instance while typing
    this.result = null; // ResultView
    this.resultVal = null; // ExactValue
    this.error = null; // { message, goto, slot }
    this.stoPending = false;
  }

  onEnter() {
    this.reset();
  }

  onExit() {
    this.input = null;
    this.error = null;
    this.stoPending = false;
  }

  onSetupChanged() {
    if (this.phase === 'result' && this.resultVal) {
      this.result = new ResultView(this.resultVal, this.calc.setup);
    }
  }

  resetCoefficients() {
    this.coefficients = {
      A: ExactValue.fromInt(1n),
      B: ExactValue.fromInt(1n),
      C: ExactValue.fromInt(1n),
      D: ExactValue.fromInt(1n)
    };
    this.slot = 0;
    this.input = null;
  }

  get currentVars() {
    return this.type === 1 ? ['A', 'B', 'D'] : ['A', 'B', 'C'];
  }

  get currentVarName() {
    return this.currentVars[this.slot];
  }

  selectType(type) {
    this.type = type;
    this.resetCoefficients();
    this.phase = 'editor';
  }

  showError(err, slot = 0) {
    const e = toCalcError(err);
    this.error = { message: e.message, goto: true, slot };
    this.phase = 'error';
  }

  // ------------------------------------------------------------ key handling

  onKey(ev) {
    const k = ev.key;

    // Handle variable storage when STO is pending
    if (this.stoPending) {
      this.stoPending = false;
      const v = VARIABLE_KEYS[k] || (['A', 'B', 'C', 'D', 'E', 'F', 'M', 'x', 'y'].includes(k) ? k : null);
      if (v && this.resultVal && !ev.shift) {
        this.calc.memory.setVar(v, this.resultVal);
      }
      return true;
    }

    if (this.phase === 'type_select') {
      return this.onKeyTypeSelect(ev);
    }

    if (this.phase === 'error') {
      return this.onKeyError(ev);
    }

    if (this.phase === 'result') {
      return this.onKeyResult(ev);
    }

    if (this.phase === 'editor') {
      return this.onKeyEditor(ev);
    }

    return false;
  }

  onKeyTypeSelect(ev) {
    const k = ev.key;
    if (ev.shift || ev.alpha) return false;

    if (k === '1') {
      this.selectType(1);
      return true;
    }
    if (k === '2') {
      this.selectType(2);
      return true;
    }
    if (k === 'DOWN') {
      this.menuSel = 1;
      return true;
    }
    if (k === 'UP') {
      this.menuSel = 0;
      return true;
    }
    if (k === 'EXE') {
      this.selectType(this.menuSel === 0 ? 1 : 2);
      return true;
    }
    if (k === 'AC') {
      return true;
    }
    return true;
  }

  onKeyError(ev) {
    const k = ev.key;
    if (k === 'AC' && !ev.shift) {
      this.phase = 'editor';
      this.error = null;
      return true;
    }
    if ((k === 'LEFT' || k === 'RIGHT') && !ev.shift && !ev.alpha) {
      this.phase = 'editor';
      if (this.error?.goto) {
        this.slot = this.error.slot;
      }
      this.error = null;
      return true;
    }
    return true;
  }

  onKeyResult(ev) {
    const k = ev.key;

    // STO variable storage
    if (k === 'STO' && !ev.alpha) {
      this.stoPending = true;
      return true;
    }

    // Result display toggles: S<=>D, mixed fraction, ENG, DMS
    const rv = this.result;
    if (rv) {
      if (k === 'SD' && !ev.alpha) {
        if (ev.shift) rv.toggleMixed();
        else rv.toggleSD();
        return true;
      }
      if (k === 'ENG' && !ev.alpha) {
        rv.eng(ev.shift ? 1 : -1);
        return true;
      }
      if (k === 'DEG' && !ev.alpha) {
        if (ev.shift) rv.toggleFactor();
        else rv.toggleDMS();
        return true;
      }
    }

    // Return to Coefficient Editor
    if (k === 'EXE' || k === 'AC' || k === 'LEFT' || k === 'RIGHT' || k === 'UP' || k === 'DOWN') {
      this.phase = 'editor';
      return true;
    }

    // OPTN menu
    if (k === 'OPTN' && !ev.shift && !ev.alpha) {
      this.openOptn();
      return true;
    }

    return true;
  }

  commitInput() {
    if (!this.input) return true;
    try {
      const ast = parse(this.input.root, {});
      if (!ast.list || ast.list.length === 0) {
        this.input = null;
        return true;
      }
      const ev = new Evaluator({ memory: this.calc.memory, angle: this.calc.setup.angle });
      const val = ev.run(ast.list[0]);
      if (!(val instanceof ExactValue)) {
        throw new CalcError(ERRORS.SYNTAX);
      }
      this.coefficients[this.currentVarName] = val;
      this.input = null;
      return true;
    } catch (err) {
      this.showError(err, this.slot);
      return false;
    }
  }

  onKeyEditor(ev) {
    const k = ev.key;

    // OPTN menu
    if (k === 'OPTN' && !ev.shift && !ev.alpha) {
      if (this.input && !this.commitInput()) return true;
      this.openOptn();
      return true;
    }

    // AC key handling
    if (k === 'AC' && !ev.shift) {
      if (this.input) {
        // Cancel active input editing, keep previous coefficient
        this.input = null;
      } else {
        // Per User's Guide: Pressing AC resets all coefficients to one
        this.resetCoefficients();
      }
      return true;
    }

    // DEL key handling
    if (k === 'DEL' && !ev.shift && !ev.alpha) {
      if (this.input) {
        this.input.del();
        if (this.input.isEmpty()) {
          this.input = null;
        }
      }
      return true;
    }

    // Navigation keys
    if (k === 'LEFT' || k === 'RIGHT') {
      if (this.input) {
        if (k === 'LEFT') this.input.left();
        else this.input.right();
      } else {
        if (k === 'LEFT') {
          this.slot = (this.slot - 1 + 3) % 3;
        } else {
          this.slot = (this.slot + 1) % 3;
        }
      }
      return true;
    }

    if (k === 'UP' || k === 'DOWN') {
      if (this.input && !this.commitInput()) return true;
      if (k === 'UP') {
        this.slot = (this.slot - 1 + 3) % 3;
      } else {
        this.slot = (this.slot + 1) % 3;
      }
      return true;
    }

    // EXE (or =) key
    if (k === 'EXE' && !ev.shift && !ev.alpha) {
      if (this.input) {
        if (!this.commitInput()) return true;
        if (this.slot < 2) {
          this.slot++;
        }
        return true;
      }
      // Input is null
      if (this.slot < 2) {
        this.slot++;
        return true;
      }
      // On slot 2 with no active input, execute calculation
      this.calculate();
      return true;
    }

    // Linear number and expression input
    const action = inputAction(ev, { math: false });
    if (action) {
      if (!this.input) {
        this.input = new Editor({ math: false });
      }
      applyInput(this.input, action);
      return true;
    }

    return false;
  }

  // ------------------------------------------------------------ calculation

  calculate() {
    const vars = this.currentVars;

    // Zero coefficient check: triggers Math ERROR per Casio User's Guide
    for (let i = 0; i < vars.length; i++) {
      const v = this.coefficients[vars[i]];
      if (v.toDecimal15().isZero()) {
        this.showError(new CalcError(ERRORS.MATH), i);
        return;
      }
    }

    try {
      let X;
      const { A, B, C, D } = this.coefficients;
      if (this.type === 1) {
        // A : B = X : D  =>  X = (A * D) / B
        X = A.mul(D).div(B);
      } else {
        // A : B = C : X  =>  X = (B * C) / A
        X = B.mul(C).div(A);
      }

      this.resultVal = X;
      this.calc.memory.setAns(X);
      this.result = new ResultView(X, this.calc.setup);
      this.phase = 'result';
    } catch (err) {
      this.showError(err, this.slot);
    }
  }

  openOptn() {
    const items = [
      {
        label: 'Select Type',
        run: () => {
          this.calc.closeAllOverlays();
          this.phase = 'type_select';
          this.menuSel = this.type - 1;
        }
      }
    ];
    this.calc.pushView(new MenuView(this.calc, items));
  }

  // ------------------------------------------------------------ indicators

  indicators(set) {
    if (isMathInput(this.calc.setup)) {
      set.add('Math');
    }
    const ang = this.calc.setup.angle;
    set.add(ang === 'Rad' ? 'R' : ang === 'Gra' ? 'G' : 'D');

    if (this.calc.setup.fix !== null) set.add('FIX');
    if (this.calc.setup.sci !== null) set.add('SCI');
    if (this.calc.setup.engSymbol) set.add('E');
    if (!this.calc.memory.getVar('M').toDecimal15().isZero()) set.add('M');
    if (this.stoPending) set.add('STO');

    if (this.phase === 'editor') {
      set.add('Left');
      set.add('Right');
    }
  }

  // ------------------------------------------------------------ rendering

  render(scr) {
    if (this.phase === 'type_select') {
      scr.row(0, 'Ratio');
      scr.row(1, '1:A:B=X:D');
      scr.row(2, '2:A:B=C:X');
      if (this.menuSel === 0) {
        scr.text(184, 1 + ROW_PITCH, '◀', { record: false });
      } else {
        scr.text(184, 1 + 2 * ROW_PITCH, '◀', { record: false });
      }
      scr.lines = ['Ratio', '1:A:B=X:D', '2:A:B=C:X'];
      return;
    }

    if (this.phase === 'error') {
      renderError(scr, this.error);
      return;
    }

    if (this.phase === 'result') {
      const resTree = this.result.tree();
      const resStr = treeToText(resTree);
      scr.text(1, 1, 'X=');
      scr.math(resTree, { top: 32, align: 'right', right: 190, math: isMathInput(this.calc.setup) });
      scr.lines = ['X=', resStr];
      return;
    }

    if (this.phase === 'editor') {
      this.renderEditor(scr);
    }
  }

  renderEditor(scr) {
    const setup = this.calc.setup;
    const a = formatCoeff(this.coefficients.A, setup);
    const b = formatCoeff(this.coefficients.B, setup);
    const c = formatCoeff(this.coefficients.C, setup);
    const d = formatCoeff(this.coefficients.D, setup);

    // Format top line proportion string
    let propStr;
    if (this.type === 1) {
      propStr = `${a}:${b}=X:${d}`;
    } else {
      propStr = `${a}:${b}=${c}:X`;
    }
    scr.row(0, propStr);

    // Format bottom line prompt string
    const curVar = this.currentVarName;
    let valStr;
    if (this.input) {
      valStr = treeToText(this.input.root);
    } else {
      valStr = formatCoeff(this.coefficients[curVar], setup);
    }
    const promptLine = `${curVar}=${valStr}`;
    scr.row(3, promptLine);

    scr.lines = [propStr, promptLine];
  }

  // ------------------------------------------------------------ serialization

  toJSON() {
    return {
      type: this.type,
      phase: this.phase,
      slot: this.slot,
      coefficients: {
        A: this.coefficients.A.toJSON ? this.coefficients.A.toJSON() : this.coefficients.A.toString(),
        B: this.coefficients.B.toJSON ? this.coefficients.B.toJSON() : this.coefficients.B.toString(),
        C: this.coefficients.C.toJSON ? this.coefficients.C.toJSON() : this.coefficients.C.toString(),
        D: this.coefficients.D.toJSON ? this.coefficients.D.toJSON() : this.coefficients.D.toString()
      }
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.type) this.type = data.type;
    if (data.slot !== undefined) this.slot = data.slot;
    if (data.phase) this.phase = data.phase;
  }
}
