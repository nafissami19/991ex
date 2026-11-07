/**
 * CALC and SOLVE (Calculate mode).
 *
 * Both show a list of the expression's variables with their current values
 * ("A=  5"). The highlighted row can be overwritten by typing (linear input);
 * = stores the typed value and moves to the next row.
 *   CALC:  after the last row, the expression is evaluated (y=… assigns y).
 *          = or CALC on the result asks again with the same values.
 *   SOLVE: = on a row without typed input solves for that row's variable with
 *          Newton's method, starting from its current value. Result screen shows
 *          the variable and "L−R=". "Continue:[=]" appears when the preset number of
 *          iterations runs out; "Cannot Solve" when Newton's method breaks down.
 */

import { Editor } from '../input/Editor.js';
import { inputAction, applyInput } from '../input/keyInput.js';
import { parse } from '../parse/parser.js';
import { treeToText, MINUS } from '../format/display.js';
import { ResultView } from '../format/ResultView.js';
import { formatNumber } from '../format/formatNumber.js';
import { formatOptions } from '../setup.js';
import { ExactValue } from '../exact/ExactValue.js';
import { Decimal15 } from '../number/Decimal15.js';
import { CalcError, ERRORS, GOTO_ERRORS, toCalcError } from '../errors.js';
import { ROW_PITCH } from '../ui/Screen.js';
import { collectVariables, renderError } from './CalcApp.js';

const D = (s) => Decimal15.fromString(String(s));

function shortNumber(v, setup) {
  const d = v instanceof ExactValue ? v.toDecimal15() : v;
  return formatNumber(d, formatOptions(setup)).fullString.replace(/^-/, MINUS);
}

/** Shared list editor of variables. */
class VarListView {
  constructor(calc, app, vars) {
    this.calc = calc;
    this.app = app;
    this.vars = vars;
    this.sel = 0;
    this.input = null; // Editor while typing a value
    this.error = null;
    this.isOverlay = true;
  }

  commitInput() {
    if (!this.input) return true;
    try {
      const ast = parse(this.input.root, {});
      if (ast.list.length !== 1) throw new CalcError(ERRORS.SYNTAX);
      const v = this.app.makeEvaluator().run(ast.list[0]);
      if (!(v instanceof ExactValue)) throw new CalcError(ERRORS.SYNTAX);
      this.calc.memory.setVar(this.vars[this.sel], v);
      this.input = null;
      return true;
    } catch (err) {
      const e = toCalcError(err);
      this.error = { message: e.message, goto: GOTO_ERRORS.has(e.message), loc: e.loc };
      return false;
    }
  }

  onKey(ev) {
    const k = ev.key;
    if (this.error) {
      if (k === 'AC' && !ev.shift) {
        this.error = null;
        this.input = null;
      } else if ((k === 'LEFT' || k === 'RIGHT') && this.error.goto) {
        if (this.input) {
          this.input.setLocation(this.error.loc);
          this.error = null;
        }
      }
      return true;
    }
    if (k === 'AC' && !ev.shift) {
      if (this.input) this.input = null;
      else this.close();
      return true;
    }
    if (k === 'UP' || k === 'DOWN') {
      if (this.input && !this.commitInput()) return true;
      this.sel = (this.sel + (k === 'UP' ? -1 : 1) + this.vars.length) % this.vars.length;
      return true;
    }
    if ((k === 'EXE' || k === 'CALC') && !ev.shift && !ev.alpha) {
      this.onExe();
      return true;
    }
    if (k === 'DEL' && this.input) {
      this.input.del();
      return true;
    }
    if ((k === 'LEFT' || k === 'RIGHT') && this.input) {
      if (k === 'LEFT') this.input.left();
      else this.input.right();
      return true;
    }
    const action = inputAction(ev, { math: false });
    if (action) {
      if (!this.input) this.input = new Editor({ math: false });
      applyInput(this.input, action);
    }
    return true;
  }

  indicators(set) {
    if (this.vars.length > 1) {
      set.add('Up');
      set.add('Down');
    }
  }

  close() {
    this.app.inCalc = false;
    this.calc.closeAllOverlays();
  }

  renderList(scr) {
    if (this.error) {
      renderError(scr, this.error);
      return;
    }
    const name = this.vars[this.sel];
    let valText;
    if (this.input) {
      valText = treeToText(this.input.root);
      scr.math(this.input.root, {
        x: 20,
        top: 48,
        math: false,
        editor: { path: this.input.path, idx: this.input.idx, shape: 'line' },
        record: false
      });
    } else {
      valText = shortNumber(this.calc.memory.getVar(name), this.calc.setup);
      scr.text(20, 48, valText, { record: false });
    }
    scr.text(1, 48, `${name}=`, { record: false });
    this.app.renderInput(scr, false);
    scr.lines = [treeToText(this.app.editor.root), `${name}=${valText}`];
  }
}

export class CalcVarsView extends VarListView {
  constructor(calc, app, ast) {
    // Variables on the right side of "y=…" are asked for; y itself is assigned
    const stmts = ast.list;
    const asked = [];
    for (const s of stmts) {
      const node = s.type === 'eq' ? s.r : s;
      for (const v of collectVariables(node)) if (!asked.includes(v)) asked.push(v);
      if (s.type === 'eq') {
        const isSingleVar = s.l.type === 'value' && s.l.name === 'var';
        if (!isSingleVar) throw new CalcError(ERRORS.SYNTAX);
      }
    }
    super(calc, app, asked);
    this.ast = ast;
    if (!asked.length) this.compute();
  }

  onExe() {
    if (this.input) {
      if (!this.commitInput()) return;
      if (this.sel < this.vars.length - 1) {
        this.sel++;
      }
      return;
    }
    if (this.sel < this.vars.length - 1) {
      this.sel++;
      return;
    }
    this.compute();
  }

  compute() {
    this.calc.closeAllOverlays();
    const app = this.app;
    app.inCalc = true;
    app.statements = this.ast.list;
    app.stmtIndex = 0;
    app.runStatement();
  }

  render(scr) {
    this.renderList(scr);
  }
}

export class SolveVarsView extends VarListView {
  constructor(calc, app, node, vars) {
    const ordered = vars.slice();
    const xi = ordered.indexOf('x');
    if (xi > 0) {
      ordered.splice(xi, 1);
      ordered.unshift('x');
    }
    super(calc, app, ordered);
    this.node = node;
  }

  onExe() {
    if (this.input) {
      if (!this.commitInput()) return;
      if (this.sel < this.vars.length - 1) {
        this.sel++;
      }
      return;
    }
    this.solve(this.vars[this.sel]);
  }

  solve(variable) {
    const solver = new NewtonSolver(this.app, this.node, variable);
    try {
      solver.start();
    } catch (err) {
      this.error = { message: toCalcError(err).message, goto: false };
      return;
    }
    this.calc.replaceView(new SolveResultView(this.calc, this.app, this, solver));
  }

  render(scr) {
    this.renderList(scr);
  }
}

class SolveResultView {
  constructor(calc, app, varsView, solver) {
    this.calc = calc;
    this.app = app;
    this.varsView = varsView;
    this.solver = solver;
    this.isOverlay = true;
  }

  onKey(ev) {
    if (ev.key === 'AC' && !ev.shift) {
      if (this.solver.status === 'error') {
        this.calc.replaceView(this.varsView);
        return true;
      }
      this.calc.closeAllOverlays();
      return true;
    }
    if (ev.key === 'EXE' && !ev.shift) {
      if (this.solver.status === 'continue') {
        try {
          this.solver.run();
        } catch (err) {
          this.solver.status = 'error';
          this.solver.error = toCalcError(err).message;
        }
      } else {
        this.calc.replaceView(this.varsView);
      }
      return true;
    }
    return true;
  }

  render(scr) {
    const s = this.solver;
    if (s.status === 'continue') {
      scr.row(0, 'Continue:[=]');
      scr.row(2, '[AC] :Cancel');
      scr.lines = ['Continue:[=]', '[AC] :Cancel'];
      return;
    }
    if (s.status === 'error') {
      renderError(scr, { message: s.error, goto: false });
      return;
    }
    const eq = treeToText(this.app.editor.root);
    const xLine = `${s.variable}=${shortNumber(s.x, this.calc.setup)}`;
    const lrLine = `L${MINUS}R=${shortNumber(s.lr, this.calc.setup)}`;
    this.app.renderInput(scr, false);
    scr.text(1, 1 + ROW_PITCH * 2, xLine, { record: false });
    scr.text(1, 1 + ROW_PITCH * 3, lrLine, { record: false });
    scr.lines = [eq, xLine, lrLine];
  }
}

/** Newton's method on f(v) = L − R, in Decimal15. */
export class NewtonSolver {
  constructor(app, node, variable) {
    this.app = app;
    this.node = node;
    this.variable = variable;
    this.memory = app.calc.memory;
    this.status = 'running';
    this.maxIter = 30;
    this.continueCount = 0;
  }

  f(x) {
    this.memory.setVar(this.variable, new ExactValue('decimal', x, x));
    const ev = this.app.makeEvaluator();
    if (this.node.type === 'eq') {
      const l = ev.run(this.node.l).toDecimal15();
      const r = ev.run(this.node.r).toDecimal15();
      return l.sub(r);
    }
    return ev.run(this.node).toDecimal15();
  }

  /** max(|L|, |R|, 1) at x — the size the rounding error is relative to. */
  sideScale(x) {
    this.memory.setVar(this.variable, new ExactValue('decimal', x, x));
    const ev = this.app.makeEvaluator();
    let m = Decimal15.ONE;
    const parts = this.node.type === 'eq' ? [this.node.l, this.node.r] : [this.node];
    for (const p of parts) {
      const v = ev.run(p).toDecimal15().abs();
      if (v.gt(m)) m = v;
    }
    // Terms of a sum can be larger than the sides (x² and B in x²+B): include them
    const walk = (n) => {
      if (n && n.type === 'bin' && (n.op === '+' || n.op === '-')) {
        for (const t of [n.l, n.r]) {
          try {
            const v = ev.run(t).toDecimal15().abs();
            if (v.gt(m)) m = v;
          } catch { /* ignore */ }
          walk(t);
        }
      }
    };
    parts.forEach(walk);
    return m;
  }

  start() {
    this.x = this.memory.getVar(this.variable).toDecimal15();
    this.f(this.x); // errors here are real errors (e.g. Math ERROR)
    this.run();
  }

  run() {
    let x = this.x;
    for (let i = 0; i < this.maxIter; i++) {
      let fx;
      try {
        fx = this.f(x);
      } catch {
        throw new CalcError(ERRORS.CANT_SOLVE);
      }
      if (fx.isZero()) return this.done(x, fx);
      const scale = x.abs().gt(Decimal15.ONE) ? x.abs() : Decimal15.ONE;
      const h = scale.mul(D('1e-6'));
      let d;
      try {
        d = this.f(x.add(h)).sub(this.f(x.sub(h))).div(h.mul(D(2)));
      } catch {
        throw new CalcError(ERRORS.CANT_SOLVE);
      }
      if (d.isZero()) throw new CalcError(ERRORS.CANT_SOLVE);
      const step = fx.div(d);
      const nx = x.sub(step);
      if (step.abs().lte(scale.mul(D('1e-13')))) {
        let fnx;
        try {
          fnx = this.f(nx);
        } catch {
          fnx = fx;
        }
        return this.done(nx, fnx);
      }
      x = nx;
    }
    this.x = x;
    this.memory.setVar(this.variable, new ExactValue('decimal', x, x));
    this.continueCount++;
    if (this.continueCount >= 2) {
      throw new CalcError(ERRORS.CANT_SOLVE);
    }
    this.status = 'continue';
    return null;
  }

  done(x, lr) {
    // Tidy values that are integers to 14 digits (e.g. 2.00000000000001 → 2)
    if (!x.isZero() && x.sciExp >= -3) {
      try {
        const r = Decimal15.fromString(x.toFixed(Math.max(0, 13 - Math.max(0, x.sciExp))));
        const lrR = this.f(r);
        if (lrR.abs().lte(lr.abs())) {
          x = r;
          lr = lrR;
        }
      } catch {
        /* keep the unrounded solution */
      }
    }
    // L−R within 15-digit rounding noise of the sides is shown as 0 (VERIFY ON EMULATOR)
    if (!lr.isZero() && lr.abs().lte(this.sideScale(x).mul(D('1e-13')))) lr = Decimal15.ZERO;
    this.x = x;
    this.lr = lr;
    this.memory.setVar(this.variable, new ExactValue('decimal', x, x));
    this.memory.setAns(new ExactValue('decimal', x, x));
    this.status = 'done';
    return x;
  }
}
