/**
 * Mode 6: Statistics Controller.
 */

import { StatModel, STAT_TYPES } from './StatModel.js';
import { StatEditorView } from './StatEditorView.js';
import { StatCalcApp } from './StatCalcApp.js';
import { StatResultView } from './StatResultView.js';
import { MenuView, MessageView } from '../../ui/views.js';
import { toCalcError } from '../../errors.js';
import './tokens.js';

export class StatApp {
  constructor(calc) {
    this.calc = calc;
    this.title = 'Statistics';
    this.model = new StatModel();
    this.model.setFreq(calc.setup.statFreq);
    this.editorView = new StatEditorView(this);
    this.calcApp = new StatCalcApp(this);
    this.modePhase = 'select_type'; // 'select_type' | 'editor' | 'calc'
    this.typeSelected = false;
  }

  showError(err) {
    const error = toCalcError(err);
    this.calc.pushView(
      new MessageView(this.calc, [error.message, null, '[AC] :Cancel'], {
        closeKeys: ['AC'],
        onClose: () => {
          this.calc.closeView();
        }
      })
    );
  }

  onEnter() {
    this.model.clear();
    this.typeSelected = false;
    this.modePhase = 'select_type';
  }

  onExit() {
    // Exiting Statistics mode deletes data
    this.model.clear();
    this.typeSelected = false;
  }

  onSetupChanged() {
    this.model.setFreq(this.calc.setup.statFreq);
    this.calcApp.onSetupChanged?.();
  }

  notify(event) {
    if (event === 'powerOff' || event === 'memoryCleared') {
      this.model.clear();
      this.typeSelected = false;
      this.modePhase = 'select_type';
    }
  }

  reset() {
    // ON key resets view/input but keeps dataset
    if (this.modePhase === 'calc') {
      this.calcApp.reset();
    } else {
      this.editorView.row = 0;
      this.editorView.col = 0;
      this.editorView.scrollRow = 0;
      this.editorView.isEditing = false;
      this.editorView.editBuffer = '';
    }
  }

  showSelectType() {
    this.modePhase = 'select_type';
  }

  showEditor() {
    this.modePhase = 'editor';
  }

  showCalcScreen() {
    this.modePhase = 'calc';
  }

  show1VarCalc() {
    try {
      const s = this.model.calc1Var();
      const items = [
        { label: 'x̄', val: s.meanX },
        { label: 'Σx', val: s.sumX },
        { label: 'Σx²', val: s.sumX2 },
        { label: 'σ²x', val: s.varPopX },
        { label: 'σx', val: s.sdPopX },
        { label: 's²x', val: s.varSampleX },
        { label: 'sx', val: s.sdSampleX },
        { label: 'n', val: s.n },
        { label: 'min(x)', val: s.minX },
        { label: 'Q1', val: s.q1 },
        { label: 'Med', val: s.med },
        { label: 'Q3', val: s.q3 },
        { label: 'max(x)', val: s.maxX }
      ];
      this.calc.pushView(
        new StatResultView(this.calc, {
          items,
          onClose: () => {
            this.calc.closeView();
            this.showCalcScreen();
          }
        })
      );
    } catch (err) {
      this.showError(err);
    }
  }

  show2VarCalc() {
    try {
      const s = this.model.calc2Var();
      const items = [
        { label: 'x̄', val: s.meanX },
        { label: 'Σx', val: s.sumX },
        { label: 'Σx²', val: s.sumX2 },
        { label: 'σ²x', val: s.varPopX },
        { label: 'σx', val: s.sdPopX },
        { label: 's²x', val: s.varSampleX },
        { label: 'sx', val: s.sdSampleX },
        { label: 'n', val: s.n },
        { label: 'ȳ', val: s.meanY },
        { label: 'Σy', val: s.sumY },
        { label: 'Σy²', val: s.sumY2 },
        { label: 'σ²y', val: s.varPopY },
        { label: 'σy', val: s.sdPopY },
        { label: 's²y', val: s.varSampleY },
        { label: 'sy', val: s.sdSampleY },
        { label: 'Σxy', val: s.sumXY },
        { label: 'Σx³', val: s.sumX3 },
        { label: 'Σx²y', val: s.sumX2Y },
        { label: 'Σx⁴', val: s.sumX4 },
        { label: 'min(x)', val: s.minX },
        { label: 'max(x)', val: s.maxX },
        { label: 'min(y)', val: s.minY },
        { label: 'max(y)', val: s.maxY }
      ];
      this.calc.pushView(
        new StatResultView(this.calc, {
          items,
          onClose: () => {
            this.calc.closeView();
            this.showCalcScreen();
          }
        })
      );
    } catch (err) {
      this.showError(err);
    }
  }

  showRegCalc() {
    try {
      const r = this.model.calcRegression();
      let items;
      if (this.model.type === STAT_TYPES.QUADRATIC) {
        items = [
          { label: 'a', val: r.a },
          { label: 'b', val: r.b },
          { label: 'c', val: r.c }
        ];
      } else {
        items = [
          { label: 'a', val: r.a },
          { label: 'b', val: r.b },
          { label: 'r', val: r.r }
        ];
      }
      this.calc.pushView(
        new StatResultView(this.calc, {
          header: r.formula,
          items,
          onClose: () => {
            this.calc.closeView();
            this.showCalcScreen();
          }
        })
      );
    } catch (err) {
      this.showError(err);
    }
  }

  selectTypeMenu() {
    const choose = (t) => () => {
      this.model.setType(t);
      this.typeSelected = true;
      this.showEditor();
      this.calc.closeAllOverlays();
    };
    return new MenuView(this.calc, [
      { label: '1-Variable', run: choose(STAT_TYPES.ONE_VAR) },
      { label: 'y=a+bx', run: choose(STAT_TYPES.LINEAR) },
      { label: 'y=a+bx+cx²', run: choose(STAT_TYPES.QUADRATIC) },
      { label: 'y=a+b•ln(x)', run: choose(STAT_TYPES.LOG) },
      { label: 'y=a•e^(bx)', run: choose(STAT_TYPES.EXP_E) },
      { label: 'y=a•b^x', run: choose(STAT_TYPES.EXP_AB) },
      { label: 'y=a•x^b', run: choose(STAT_TYPES.POWER) },
      { label: 'y=a+b/x', run: choose(STAT_TYPES.INVERSE) }
    ]);
  }

  onKey(ev) {
    if (this.modePhase === 'select_type') {
      if (!this.selectTypeView) {
        this.selectTypeView = this.selectTypeMenu();
      }
      return this.selectTypeView.onKey(ev);
    }
    if (this.modePhase === 'editor') {
      return this.editorView.onKey(ev);
    }
    if (this.modePhase === 'calc') {
      return this.calcApp.onKey(ev);
    }
    return false;
  }

  indicators(set) {
    if (this.modePhase === 'select_type') {
      if (!this.selectTypeView) this.selectTypeView = this.selectTypeMenu();
      this.selectTypeView.indicators(set);
    } else if (this.modePhase === 'editor') {
      this.editorView.indicators(set);
    } else if (this.modePhase === 'calc') {
      this.calcApp.indicators(set);
    }
  }

  render(scr) {
    if (this.modePhase === 'select_type') {
      if (!this.selectTypeView) this.selectTypeView = this.selectTypeMenu();
      this.selectTypeView.render(scr);
    } else if (this.modePhase === 'editor') {
      this.editorView.render(scr);
    } else if (this.modePhase === 'calc') {
      this.calcApp.render(scr);
    }
  }
}
