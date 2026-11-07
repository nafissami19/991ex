/**
 * Mode 7: Distribution.
 *
 * Implements:
 *   - Type Selection Screen (Normal PD, Normal CD, Inverse Normal, Binomial PD,
 *     Binomial CD, Poisson PD, Poisson CD).
 *   - Input Method Selection (List vs Variable) for Binomial & Poisson distributions.
 *   - Parameter Entry Screens (x, σ, μ, N, p, λ, Lower, Upper, Area...) with
 *     accurate editing, full arrow navigation, and memory retention.
 *   - High-precision calculation to 10 display digits per Casio User's Guide.
 *   - Result Screen with Ans storage and STO variable assignment.
 *   - List Screen editor and List Result table (x and P columns) with 45-row capacity,
 *     insert/delete row, and out-of-range "ERROR" cells.
 *   - OPTN menus for changing type and list table editing.
 */

import { Editor } from '../../input/Editor.js';
import { inputAction, applyInput } from '../../input/keyInput.js';
import { parse } from '../../parse/parser.js';
import { Evaluator } from '../../eval/evaluate.js';
import { treeToText, MINUS } from '../../format/display.js';
import { formatNumber } from '../../format/formatNumber.js';
import { formatOptions } from '../../setup.js';
import { ExactValue } from '../../exact/ExactValue.js';
import { Decimal15 } from '../../number/Decimal15.js';
import { CalcError, ERRORS, toCalcError } from '../../errors.js';
import { ROW_PITCH } from '../../ui/Screen.js';
import { MenuView } from '../../ui/views.js';
import { VARIABLE_KEYS } from '../../keys.js';
import * as distMath from './distributionMath.js';

export const DIST_TYPES = [
  { id: 'normal_pd', name: 'Normal PD', hasList: false },
  { id: 'normal_cd', name: 'Normal CD', hasList: false },
  { id: 'inverse_normal', name: 'Inverse Normal', hasList: false },
  { id: 'binomial_pd', name: 'Binomial PD', hasList: true },
  { id: 'binomial_cd', name: 'Binomial CD', hasList: true },
  { id: 'poisson_pd', name: 'Poisson PD', hasList: true },
  { id: 'poisson_cd', name: 'Poisson CD', hasList: true }
];

export class DistributionApp {
  constructor(calc) {
    this.calc = calc;
    this.title = 'Distribution';
    this.initStoredParams();
    this.reset();
  }

  initStoredParams() {
    this.storedParams = {
      normal_pd: { x: '0', 'σ': '1', 'μ': '0' },
      normal_cd: { Lower: '0', Upper: '0', 'σ': '1', 'μ': '0' },
      inverse_normal: { Area: '0', 'σ': '1', 'μ': '0' },
      binomial_pd: { x: '0', N: '0', p: '0' },
      binomial_cd: { x: '0', N: '0', p: '0' },
      poisson_pd: { x: '0', 'λ': '0' },
      poisson_cd: { x: '0', 'λ': '0' }
    };
  }

  reset() {
    this.phase = 'type_menu'; // 'type_menu' | 'method_menu' | 'var_input' | 'var_result' | 'list_input' | 'list_var_input' | 'list_result' | 'error'
    this.typePage = 0;
    this.distType = null;
    this.paramIndex = 0;
    this.editor = new Editor({ math: false });
    this.error = null;
    this.resultVal = null;
    this.resultStr = '';
    this.stoPending = false;
    this.listData = []; // [{ x: ExactValue, p: string, pVal: Decimal15 }]
    this.listRow = 0;
    this.listCol = 0;
  }

  onEnter() {
    this.reset();
  }

  onExit() {
    this.reset();
  }

  // ------------------------------------------------------------ Parameter Specs

  getParamSpec(distId, isList = false) {
    switch (distId) {
      case 'normal_pd':
        return ['x', 'σ', 'μ'];
      case 'normal_cd':
        return ['Lower', 'Upper', 'σ', 'μ'];
      case 'inverse_normal':
        return ['Area', 'σ', 'μ'];
      case 'binomial_pd':
      case 'binomial_cd':
        return isList ? ['N', 'p'] : ['x', 'N', 'p'];
      case 'poisson_pd':
      case 'poisson_cd':
        return isList ? ['λ'] : ['x', 'λ'];
      default:
        return [];
    }
  }

  selectType(distId) {
    this.distType = distId;
    const typeObj = DIST_TYPES.find((t) => t.id === distId);
    if (typeObj && typeObj.hasList) {
      this.phase = 'method_menu';
    } else {
      this.phase = 'var_input';
      this.paramIndex = 0;
      this.editor.clear();
    }
  }

  // ------------------------------------------------------------ Evaluation

  evalInput(editor) {
    if (editor.isEmpty()) return null;
    const ast = parse(editor.root, {});
    if (!ast || !ast.list || ast.list.length === 0) return null;
    const ev = new Evaluator({ memory: this.calc.memory, angle: this.calc.setup.angle });
    return ev.run(ast.list[0]);
  }

  formatVal(val) {
    if (val instanceof ExactValue) {
      const d = val.toDecimal15();
      return formatNumber(d, formatOptions(this.calc.setup)).fullString.replace(/^-/, MINUS);
    }
    if (val instanceof Decimal15) {
      return formatNumber(val, formatOptions(this.calc.setup)).fullString.replace(/^-/, MINUS);
    }
    return String(val);
  }

  computeVarResult() {
    const params = this.storedParams[this.distType];
    const parseNum = (k) => {
      const str = String(params[k] ?? '0');
      return Decimal15.fromString(str);
    };

    let res;
    switch (this.distType) {
      case 'normal_pd':
        res = distMath.normalPD(parseNum('x'), parseNum('σ'), parseNum('μ'));
        break;
      case 'normal_cd':
        res = distMath.normalCD(parseNum('Lower'), parseNum('Upper'), parseNum('σ'), parseNum('μ'));
        break;
      case 'inverse_normal':
        res = distMath.inverseNormal(parseNum('Area'), parseNum('σ'), parseNum('μ'));
        break;
      case 'binomial_pd':
        res = distMath.binomialPD(parseNum('x'), parseNum('N'), parseNum('p'));
        break;
      case 'binomial_cd':
        res = distMath.binomialCD(parseNum('x'), parseNum('N'), parseNum('p'));
        break;
      case 'poisson_pd':
        res = distMath.poissonPD(parseNum('x'), parseNum('λ'));
        break;
      case 'poisson_cd':
        res = distMath.poissonCD(parseNum('x'), parseNum('λ'));
        break;
      default:
        throw new CalcError(ERRORS.MATH);
    }

    this.resultVal = res;
    this.resultStr = this.formatVal(res);
    this.calc.memory.setAns(new ExactValue('decimal', res, res));
    this.phase = 'var_result';
    this.stoPending = false;
  }

  computeListResult() {
    const params = this.storedParams[this.distType];
    const parseNum = (k) => Decimal15.fromString(String(params[k] ?? '0'));

    for (const item of this.listData) {
      try {
        let pRes;
        switch (this.distType) {
          case 'binomial_pd':
            pRes = distMath.binomialPD(item.x.toDecimal15(), parseNum('N'), parseNum('p'));
            break;
          case 'binomial_cd':
            pRes = distMath.binomialCD(item.x.toDecimal15(), parseNum('N'), parseNum('p'));
            break;
          case 'poisson_pd':
            pRes = distMath.poissonPD(item.x.toDecimal15(), parseNum('λ'));
            break;
          case 'poisson_cd':
            pRes = distMath.poissonCD(item.x.toDecimal15(), parseNum('λ'));
            break;
          default:
            pRes = null;
        }
        item.pVal = pRes;
        item.p = pRes ? this.formatVal(pRes) : '';
      } catch {
        item.pVal = null;
        item.p = 'ERROR';
      }
    }

    this.phase = 'list_result';
    this.listRow = 0;
    this.listCol = 0;
    this.stoPending = false;
  }

  // ------------------------------------------------------------ OPTN Menu

  openOptn() {
    if (this.phase === 'list_input' || this.phase === 'list_result') {
      const items = [
        {
          label: 'Select Type',
          run: () => {
            this.calc.closeAllOverlays();
            this.phase = 'type_menu';
            this.typePage = 0;
          }
        },
        {
          label: 'Editor',
          run: (cc, parentMenu) => {
            const subItems = [
              {
                label: 'Insert Row',
                run: () => {
                  this.calc.closeAllOverlays();
                  this.listData.splice(this.listRow, 0, { x: ExactValue.fromInt(0n), p: '' });
                }
              },
              {
                label: 'Delete All',
                run: () => {
                  this.calc.closeAllOverlays();
                  this.listData = [];
                  this.listRow = 0;
                  this.listCol = 0;
                }
              }
            ];
            cc.replaceView(new MenuView(cc, subItems, { parent: parentMenu }));
          }
        }
      ];
      this.calc.pushView(new MenuView(this.calc, items));
    } else {
      const items = [
        {
          label: 'Select Type',
          run: () => {
            this.calc.closeAllOverlays();
            this.phase = 'type_menu';
            this.typePage = 0;
          }
        }
      ];
      this.calc.pushView(new MenuView(this.calc, items));
    }
  }

  // ------------------------------------------------------------ Key Handling

  onKey(ev) {
    const k = ev.key;

    // Handle STO variable destination
    if (this.stoPending) {
      this.stoPending = false;
      const v = VARIABLE_KEYS[k] || (['A', 'B', 'C', 'D', 'E', 'F', 'M', 'x', 'y'].includes(k) ? k : null);
      if (v && !ev.shift) {
        let storeVal;
        if (this.phase === 'var_result') {
          storeVal = new ExactValue('decimal', this.resultVal, this.resultVal);
        } else if (this.phase === 'list_result' && this.listData[this.listRow]) {
          const item = this.listData[this.listRow];
          if (this.listCol === 0) storeVal = item.x;
          else if (item.pVal) storeVal = new ExactValue('decimal', item.pVal, item.pVal);
        }
        if (storeVal) {
          if (v === 'M') this.calc.memory.setM(storeVal);
          else this.calc.memory.setVar(v, storeVal);
        }
      }
      return true;
    }

    if (k === 'STO' && !ev.alpha && !ev.shift) {
      if (this.phase === 'var_result' || this.phase === 'list_result') {
        this.stoPending = true;
        return true;
      }
    }

    if (this.phase === 'error') {
      if (k === 'AC' && !ev.shift) {
        this.phase = 'var_input';
        this.error = null;
        return true;
      }
      return true;
    }

    if (k === 'OPTN' && !ev.shift && !ev.alpha) {
      this.openOptn();
      return true;
    }

    // Phase: Type Selection Menu
    if (this.phase === 'type_menu') {
      if (ev.shift || ev.alpha) return false;
      if (k === 'DOWN') {
        this.typePage = (this.typePage + 1) % 2;
        return true;
      }
      if (k === 'UP') {
        this.typePage = (this.typePage - 1 + 2) % 2;
        return true;
      }
      if (this.typePage === 0) {
        if (k === '1') { this.selectType('normal_pd'); return true; }
        if (k === '2') { this.selectType('normal_cd'); return true; }
        if (k === '3') { this.selectType('inverse_normal'); return true; }
        if (k === '4') { this.selectType('binomial_pd'); return true; }
      } else {
        if (k === '1') { this.selectType('binomial_cd'); return true; }
        if (k === '2') { this.selectType('poisson_pd'); return true; }
        if (k === '3') { this.selectType('poisson_cd'); return true; }
      }
      if (k === 'AC') {
        return true;
      }
      return false;
    }

    // Phase: Input Method Menu (1:List, 2:Variable)
    if (this.phase === 'method_menu') {
      if (ev.shift || ev.alpha) return false;
      if (k === '1') {
        this.phase = 'list_input';
        this.listRow = 0;
        this.editor.clear();
        return true;
      }
      if (k === '2') {
        this.phase = 'var_input';
        this.paramIndex = 0;
        this.editor.clear();
        return true;
      }
      if (k === 'AC' || k === 'LEFT') {
        this.phase = 'type_menu';
        return true;
      }
      return false;
    }

    // Phase: Variable Parameter Entry Screen
    if (this.phase === 'var_input') {
      const spec = this.getParamSpec(this.distType, false);

      if (k === 'AC' && !ev.shift) {
        if (!this.editor.isEmpty()) {
          this.editor.clear();
        }
        return true;
      }

      if (k === 'UP') {
        if (!this.editor.isEmpty()) {
          const v = this.evalInput(this.editor);
          if (v) this.storedParams[this.distType][spec[this.paramIndex]] = v.toDecimal15().toString();
          this.editor.clear();
        }
        this.paramIndex = (this.paramIndex - 1 + spec.length) % spec.length;
        return true;
      }

      if (k === 'DOWN') {
        if (!this.editor.isEmpty()) {
          const v = this.evalInput(this.editor);
          if (v) this.storedParams[this.distType][spec[this.paramIndex]] = v.toDecimal15().toString();
          this.editor.clear();
        }
        this.paramIndex = (this.paramIndex + 1) % spec.length;
        return true;
      }

      if (k === 'EXE' || k === '=') {
        if (!this.editor.isEmpty()) {
          try {
            const v = this.evalInput(this.editor);
            if (v) this.storedParams[this.distType][spec[this.paramIndex]] = v.toDecimal15().toString();
          } catch (err) {
            this.error = toCalcError(err);
            this.phase = 'error';
            return true;
          }
          this.editor.clear();
          if (this.paramIndex < spec.length - 1) {
            this.paramIndex++;
          }
          return true;
        }

        if (this.paramIndex < spec.length - 1) {
          this.paramIndex++;
          return true;
        }

        // On the final parameter with empty editor: perform calculation
        try {
          this.computeVarResult();
        } catch (err) {
          this.error = toCalcError(err);
          this.phase = 'error';
        }
        return true;
      }

      if (k === 'DEL' && !this.editor.isEmpty()) {
        this.editor.del();
        return true;
      }

      const action = inputAction(ev, { math: false });
      if (action) {
        applyInput(this.editor, action);
        return true;
      }
      return false;
    }

    // Phase: Variable Result Screen
    if (this.phase === 'var_result') {
      if ((k === 'EXE' || k === '=' || k === 'AC') && !ev.shift) {
        this.phase = 'var_input';
        this.editor.clear();
        return true;
      }
      return false;
    }

    // Phase: List Input Screen
    if (this.phase === 'list_input') {
      if (k === 'AC' && !ev.shift) {
        if (!this.editor.isEmpty()) {
          this.editor.clear();
        }
        return true;
      }

      if (k === 'UP') {
        if (!this.editor.isEmpty()) {
          const v = this.evalInput(this.editor);
          if (v) this.setListX(this.listRow, v);
          this.editor.clear();
        }
        if (this.listRow > 0) this.listRow--;
        return true;
      }

      if (k === 'DOWN') {
        if (!this.editor.isEmpty()) {
          const v = this.evalInput(this.editor);
          if (v) this.setListX(this.listRow, v);
          this.editor.clear();
        }
        if (this.listRow < this.listData.length) this.listRow++;
        return true;
      }

      if (k === 'EXE' || k === '=') {
        if (!this.editor.isEmpty()) {
          try {
            const v = this.evalInput(this.editor);
            if (v) this.setListX(this.listRow, v);
          } catch (err) {
            this.error = toCalcError(err);
            this.phase = 'error';
            return true;
          }
          this.editor.clear();
          this.listRow++;
          return true;
        }

        // Empty editor pressed EXE
        if (this.listData.length > 0) {
          this.phase = 'list_var_input';
          this.paramIndex = 0;
          this.editor.clear();
          return true;
        }
        return true;
      }

      if (k === 'DEL') {
        if (!this.editor.isEmpty()) {
          this.editor.del();
          return true;
        }
        if (this.listRow < this.listData.length) {
          this.listData.splice(this.listRow, 1);
          if (this.listRow >= this.listData.length && this.listRow > 0) {
            this.listRow--;
          }
          return true;
        }
        return true;
      }

      const action = inputAction(ev, { math: false });
      if (action) {
        applyInput(this.editor, action);
        return true;
      }
      return false;
    }

    // Phase: List Variable Parameter Input Screen (N, p or λ)
    if (this.phase === 'list_var_input') {
      const spec = this.getParamSpec(this.distType, true);

      if (k === 'AC' && !ev.shift) {
        if (!this.editor.isEmpty()) {
          this.editor.clear();
        } else {
          this.phase = 'list_input';
        }
        return true;
      }

      if (k === 'UP') {
        if (!this.editor.isEmpty()) {
          const v = this.evalInput(this.editor);
          if (v) this.storedParams[this.distType][spec[this.paramIndex]] = v.toDecimal15().toString();
          this.editor.clear();
        }
        this.paramIndex = (this.paramIndex - 1 + spec.length) % spec.length;
        return true;
      }

      if (k === 'DOWN') {
        if (!this.editor.isEmpty()) {
          const v = this.evalInput(this.editor);
          if (v) this.storedParams[this.distType][spec[this.paramIndex]] = v.toDecimal15().toString();
          this.editor.clear();
        }
        this.paramIndex = (this.paramIndex + 1) % spec.length;
        return true;
      }

      if (k === 'EXE' || k === '=') {
        if (!this.editor.isEmpty()) {
          try {
            const v = this.evalInput(this.editor);
            if (v) this.storedParams[this.distType][spec[this.paramIndex]] = v.toDecimal15().toString();
          } catch (err) {
            this.error = toCalcError(err);
            this.phase = 'error';
            return true;
          }
          this.editor.clear();
          if (this.paramIndex < spec.length - 1) {
            this.paramIndex++;
          }
          return true;
        }

        if (this.paramIndex < spec.length - 1) {
          this.paramIndex++;
          return true;
        }

        // Final parameter entered: compute list results
        this.computeListResult();
        return true;
      }

      if (k === 'DEL' && !this.editor.isEmpty()) {
        this.editor.del();
        return true;
      }

      const action = inputAction(ev, { math: false });
      if (action) {
        applyInput(this.editor, action);
        return true;
      }
      return false;
    }

    // Phase: List Result Table Screen
    if (this.phase === 'list_result') {
      if ((k === 'EXE' || k === '=') && !ev.shift) {
        this.phase = 'list_var_input';
        this.paramIndex = 0;
        this.editor.clear();
        return true;
      }
      if (k === 'AC' && !ev.shift) {
        this.phase = 'list_var_input';
        this.paramIndex = 0;
        this.editor.clear();
        return true;
      }
      if (k === 'LEFT') {
        this.listCol = 0;
        return true;
      }
      if (k === 'RIGHT') {
        this.listCol = 1;
        return true;
      }
      if (k === 'UP') {
        if (this.listRow > 0) this.listRow--;
        return true;
      }
      if (k === 'DOWN') {
        if (this.listRow < this.listData.length - 1) this.listRow++;
        return true;
      }

      // Any digit or sign input while on list results clears results and edits x
      const action = inputAction(ev, { math: false });
      if (action) {
        for (const item of this.listData) {
          item.p = '';
          item.pVal = null;
        }
        this.phase = 'list_input';
        this.editor.clear();
        applyInput(this.editor, action);
        return true;
      }
      return false;
    }

    return false;
  }

  setListX(row, val) {
    const evVal = val instanceof ExactValue ? val : ExactValue.fromInt(BigInt(val));
    if (row < this.listData.length) {
      this.listData[row].x = evVal;
    } else {
      this.listData.push({ x: evVal, p: '', pVal: null });
    }
  }

  // ------------------------------------------------------------ Indicators

  indicators(set) {
    if (this.phase === 'type_menu') {
      if (this.typePage === 0) set.add('Down');
      else set.add('Up');
    }
    if (this.stoPending) {
      set.add('STO');
    }
    if (this.phase === 'var_input' || this.phase === 'list_var_input') {
      const spec = this.getParamSpec(this.distType, this.phase === 'list_var_input');
      if (spec.length > 1) {
        if (this.paramIndex > 0) set.add('Up');
        if (this.paramIndex < spec.length - 1) set.add('Down');
      }
    }
    if (this.phase === 'list_input' || this.phase === 'list_result') {
      if (this.listRow > 0) set.add('Up');
      if (this.listRow < this.listData.length - 1) set.add('Down');
    }
  }

  // ------------------------------------------------------------ Rendering

  render(scr) {
    if (this.phase === 'error') {
      scr.row(0, this.error ? this.error.message : ERRORS.MATH);
      scr.row(2, '[AC] :Cancel');
      scr.lines = [this.error ? this.error.message : ERRORS.MATH, '[AC] :Cancel'];
      return;
    }

    if (this.phase === 'type_menu') {
      if (this.typePage === 0) {
        scr.row(0, '1:Normal PD');
        scr.row(1, '2:Normal CD');
        scr.row(2, '3:Inverse Normal');
        scr.row(3, '4:Binomial PD');
        scr.lines = ['1:Normal PD', '2:Normal CD', '3:Inverse Normal', '4:Binomial PD'];
      } else {
        scr.row(0, '1:Binomial CD');
        scr.row(1, '2:Poisson PD');
        scr.row(2, '3:Poisson CD');
        scr.lines = ['1:Binomial CD', '2:Poisson PD', '3:Poisson CD'];
      }
      return;
    }

    if (this.phase === 'method_menu') {
      scr.row(0, '1:List');
      scr.row(1, '2:Variable');
      scr.lines = ['1:List', '2:Variable'];
      return;
    }

    if (this.phase === 'var_input' || this.phase === 'list_var_input') {
      const isList = this.phase === 'list_var_input';
      const spec = this.getParamSpec(this.distType, isList);
      const lines = [];

      spec.forEach((name, idx) => {
        const y = 1 + idx * ROW_PITCH;
        scr.text(1, y, name);
        let valText;
        if (idx === this.paramIndex && !this.editor.isEmpty()) {
          valText = treeToText(this.editor.root);
        } else {
          valText = this.storedParams[this.distType][name] ?? '0';
        }
        scr.text(190, y, valText, { align: 'right' });
        lines.push(`${name}=${valText}`);
      });

      scr.lines = lines;
      return;
    }

    if (this.phase === 'var_result') {
      const label = this.distType === 'inverse_normal' ? 'xInv=' : 'p=';
      scr.row(0, label);
      scr.text(190, 1 + ROW_PITCH, this.resultStr, { align: 'right' });
      scr.lines = [label, this.resultStr];
      return;
    }

    if (this.phase === 'list_input') {
      const typeObj = DIST_TYPES.find((t) => t.id === this.distType);
      const title = typeObj ? typeObj.name : 'Distribution';
      scr.row(0, title);
      scr.row(1, '   |     x    |');

      const lines = [title, '   |     x    |'];
      const maxRows = Math.max(1, this.listData.length + 1);
      const startRow = Math.max(0, this.listRow - 1);

      for (let r = startRow; r < Math.min(startRow + 2, maxRows); r++) {
        const rowNum = String(r + 1).padStart(3, ' ');
        let xStr = '';
        if (r < this.listData.length) {
          xStr = this.formatVal(this.listData[r].x).padStart(10, ' ');
        }
        lines.push(`${rowNum}|${xStr}|`);
      }

      // Bottom line shows current edit or current cell value
      let curValStr = '';
      if (!this.editor.isEmpty()) {
        curValStr = treeToText(this.editor.root);
      } else if (this.listRow < this.listData.length) {
        curValStr = this.formatVal(this.listData[this.listRow].x);
      }
      scr.row(3, curValStr);
      lines.push(curValStr);

      scr.lines = lines;
      return;
    }

    if (this.phase === 'list_result') {
      const typeObj = DIST_TYPES.find((t) => t.id === this.distType);
      const title = typeObj ? typeObj.name : 'Distribution';
      scr.row(0, title);
      scr.row(1, '   |     x    |     P    |');

      const lines = [title, '   |     x    |     P    |'];
      const startRow = Math.max(0, this.listRow - 1);

      for (let r = startRow; r < Math.min(startRow + 2, this.listData.length); r++) {
        const rowNum = String(r + 1).padStart(3, ' ');
        const item = this.listData[r];
        const xStr = this.formatVal(item.x).padStart(10, ' ');
        const pStr = (item.p || '').slice(0, 10).padStart(10, ' ');
        lines.push(`${rowNum}|${xStr}|${pStr}|`);
      }

      // Bottom line: selected cell's full value
      let bottomVal = '';
      if (this.listRow < this.listData.length) {
        const item = this.listData[this.listRow];
        bottomVal = this.listCol === 0 ? this.formatVal(item.x) : item.p;
      }
      scr.row(3, bottomVal);
      lines.push(bottomVal);

      scr.lines = lines;
      return;
    }
  }
}
