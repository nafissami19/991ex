/**
 * Mode 11: Inequality Mode
 *
 * Implements polynomial inequalities of degree 2, 3, and 4 per fx-991EX User's Guide (pp. 29–31):
 * - Degree selection dialog: 2~4
 * - Type selection menu: 1 (>0), 2 (<0), 3 (≥0), 4 (≤0)
 * - Coefficient Editor with column navigation, editing, and AC reset to 0
 * - Solution screens: intervals, "All Real Numbers", "No Solution", exact forms, S<=>D toggle
 * - Error handling: a = 0 triggers Math ERROR with Goto / Cancel
 * - OPTN: 1: Polynomial resets coefficients and prompts for degree
 */

import { MenuView } from '../../ui/views.js';
import { renderError } from '../../apps/CalcApp.js';
import { CalcError, ERRORS, GOTO_ERRORS, toCalcError } from '../../errors.js';
import { isMathInput } from '../../setup.js';
import { ROW_PITCH, LCD_WIDTH } from '../../ui/Screen.js';
import { solvePolynomialInequality, toRationalCoeff } from './InequalitySolver.js';
import { treeToText, txt, MINUS } from '../../format/display.js';

const FORMULAS = {
  2: [
    'ax²+bx+c>0',
    'ax²+bx+c<0',
    'ax²+bx+c≥0',
    'ax²+bx+c≤0'
  ],
  3: [
    'ax³+bx²+cx+d>0',
    'ax³+bx²+cx+d<0',
    'ax³+bx²+cx+d≥0',
    'ax³+bx²+cx+d≤0'
  ],
  4: [
    'ax⁴+bx³+cx²+dx+e>0',
    'ax⁴+bx³+cx²+dx+e<0',
    'ax⁴+bx³+cx²+dx+e≥0',
    'ax⁴+bx³+cx²+dx+e≤0'
  ]
};

const COL_NAMES = ['a', 'b', 'c', 'd', 'e'];

export class InequalityApp {
  constructor(calc) {
    this.calc = calc;
    this.title = 'Inequality';
    this.reset();
  }

  reset() {
    this.phase = 'degree_select'; // 'degree_select' | 'type_select' | 'coefficient_edit' | 'solution' | 'error'
    this.degree = 2;
    this.type = 1; // 1: >0, 2: <0, 3: ≥0, 4: ≤0
    this.coeffs = ['0', '0', '0'];
    this.col = 0;
    this.inputBuffer = '';
    this.solution = null;
    this.displayMode = 'exact'; // 'exact' | 'decimal'
    this.scrollX = 0;
    this.maxScrollX = 0;
    this.error = null;
  }

  onEnter() {
    this.reset();
  }

  onExit() {
    this.reset();
  }

  onSetupChanged() {
    if (this.phase === 'solution' && this.solution) {
      if (!isMathInput(this.calc.setup) || !this.calc.setup.inputOutput.endsWith('MathO')) {
        this.displayMode = 'decimal';
      }
    }
  }

  openDegreeSelect(fromOptn = false) {
    this.phase = 'degree_select';
    this.coeffs = new Array(this.degree + 1).fill('0');
    this.inputBuffer = '';
    this.solution = null;
  }

  headerText() {
    return FORMULAS[this.degree][this.type - 1];
  }

  currentSolutionText() {
    if (!this.solution) return '';
    if (this.displayMode === 'decimal' || !isMathInput(this.calc.setup) || !this.calc.setup.inputOutput.endsWith('MathO')) {
      return this.solution.decimalText;
    }
    return this.solution.text;
  }

  commitInput() {
    if (this.inputBuffer !== '') {
      let val = this.inputBuffer.trim();
      if (val === '-' || val === MINUS) val = '-1';
      this.coeffs[this.col] = val;
      this.inputBuffer = '';
    }
  }

  solve() {
    try {
      this.commitInput();
      const aVal = toRationalCoeff(this.coeffs[0]);
      if (aVal.isZero()) {
        throw new CalcError(ERRORS.MATH);
      }
      this.solution = solvePolynomialInequality(this.degree, this.type, this.coeffs, this.calc.setup);
      this.phase = 'solution';
      this.scrollX = 0;
      this.maxScrollX = 0;
      this.displayMode = isMathInput(this.calc.setup) && this.calc.setup.inputOutput.endsWith('MathO')
        ? 'exact'
        : 'decimal';
    } catch (err) {
      const e = toCalcError(err);
      this.error = { message: e.message, goto: GOTO_ERRORS.has(e.message), loc: e.loc };
      this.phase = 'error';
    }
  }

  optnItems() {
    return [
      {
        label: 'Polynomial',
        run: (calc) => {
          calc.closeAllOverlays();
          this.openDegreeSelect(true);
        }
      }
    ];
  }

  indicators(set) {
    if (this.phase === 'solution' && this.solution) {
      if (this.scrollX > 0) set.add('Left');
      if (this.scrollX < this.maxScrollX) set.add('Right');
    }
  }

  onKey(ev) {
    const k = ev.key;

    // Handle Error screen
    if (this.phase === 'error') {
      if (k === 'AC' && !ev.shift) {
        this.phase = 'coefficient_edit';
        this.col = 0;
        this.error = null;
        return true;
      }
      if ((k === 'LEFT' || k === 'RIGHT') && !ev.shift && !ev.alpha) {
        this.phase = 'coefficient_edit';
        this.col = 0;
        this.error = null;
        return true;
      }
      return true;
    }

    // Degree select screen
    if (this.phase === 'degree_select') {
      if (/^[2-4]$/.test(k) && !ev.shift && !ev.alpha) {
        this.degree = Number(k);
        this.coeffs = new Array(this.degree + 1).fill('0');
        this.col = 0;
        this.inputBuffer = '';
        this.phase = 'type_select';
        return true;
      }
      if (k === 'AC' && !ev.shift) {
        // Keep prompt
        return true;
      }
      return true;
    }

    // Type select screen
    if (this.phase === 'type_select') {
      if (/^[1-4]$/.test(k) && !ev.shift && !ev.alpha) {
        this.type = Number(k);
        this.phase = 'coefficient_edit';
        this.col = 0;
        this.inputBuffer = '';
        return true;
      }
      if ((k === 'AC' || k === 'LEFT') && !ev.shift && !ev.alpha) {
        this.phase = 'degree_select';
        return true;
      }
      return true;
    }

    // Solution screen
    if (this.phase === 'solution') {
      if (k === 'AC' || (k === 'EXE' && !ev.shift)) {
        // Return to coefficient editor with coefficients preserved
        this.phase = 'coefficient_edit';
        this.inputBuffer = '';
        return true;
      }
      if (k === 'SD' && !ev.shift) {
        this.displayMode = this.displayMode === 'exact' ? 'decimal' : 'exact';
        this.scrollX = 0;
        return true;
      }
      if (k === 'LEFT' && !ev.shift && !ev.alpha) {
        this.scrollX = Math.max(0, this.scrollX - 24);
        return true;
      }
      if (k === 'RIGHT' && !ev.shift && !ev.alpha) {
        this.scrollX = Math.min(this.maxScrollX, this.scrollX + 24);
        return true;
      }
      if (k === 'OPTN' && !ev.shift && !ev.alpha) {
        this.calc.pushView(new MenuView(this.calc, this.optnItems()));
        return true;
      }
      return true;
    }

    // Coefficient Editor screen
    if (this.phase === 'coefficient_edit') {
      if (k === 'OPTN' && !ev.shift && !ev.alpha) {
        this.calc.pushView(new MenuView(this.calc, this.optnItems()));
        return true;
      }

      if (k === 'AC' && !ev.shift) {
        // Clear all coefficients to 0
        this.coeffs = new Array(this.degree + 1).fill('0');
        this.col = 0;
        this.inputBuffer = '';
        return true;
      }

      if (/^[0-9]$/.test(k) && !ev.shift && !ev.alpha) {
        this.inputBuffer += k;
        return true;
      }

      if (k === '.' && !ev.shift && !ev.alpha) {
        if (!this.inputBuffer.includes('.')) {
          this.inputBuffer += this.inputBuffer.length === 0 ? '0.' : '.';
        }
        return true;
      }

      if ((k === 'NEG' || k === '(-)') && !ev.alpha) {
        if (this.inputBuffer.startsWith('-')) {
          this.inputBuffer = this.inputBuffer.slice(1);
        } else {
          this.inputBuffer = '-' + this.inputBuffer;
        }
        return true;
      }

      if (k === 'DEL' && !ev.shift && !ev.alpha) {
        if (this.inputBuffer.length > 0) {
          this.inputBuffer = this.inputBuffer.slice(0, -1);
        }
        return true;
      }

      if (k === 'LEFT' && !ev.shift && !ev.alpha) {
        this.commitInput();
        if (this.col > 0) this.col--;
        return true;
      }

      if (k === 'RIGHT' && !ev.shift && !ev.alpha) {
        this.commitInput();
        if (this.col < this.degree) this.col++;
        return true;
      }

      if (k === 'EXE' && !ev.shift) {
        if (this.inputBuffer !== '') {
          this.commitInput();
          if (this.col < this.degree) {
            this.col++;
          }
          return true;
        }
        // When no uncommitted typing:
        if (this.col === this.degree) {
          this.solve();
          return true;
        }
        this.col++;
        return true;
      }
    }

    return false;
  }

  render(scr) {
    if (this.phase === 'error') {
      renderError(scr, this.error);
      return;
    }

    if (this.phase === 'degree_select') {
      scr.row(0, 'Inequality');
      scr.row(1, 'Polynomial');
      scr.row(2, 'Degree? 2~4');
      scr.lines = ['Inequality', 'Polynomial', 'Degree? 2~4'];
      return;
    }

    if (this.phase === 'type_select') {
      const items = FORMULAS[this.degree];
      items.forEach((item, i) => {
        scr.text(1, 1 + i * 15, `${i + 1}:${item}`, { font: 'small' });
      });
      scr.lines = items.map((item, i) => `${i + 1}:${item}`);
      return;
    }

    if (this.phase === 'coefficient_edit') {
      const header = this.headerText();
      scr.text(1, 1, header, { font: 'small' });

      // Table layout
      const count = this.degree + 1;
      const colW = Math.floor(190 / count);
      const startY = 16;

      for (let i = 0; i < count; i++) {
        const x = 1 + i * colW;
        const name = COL_NAMES[i];
        const valStr = this.coeffs[i].replace(/^-/, MINUS);

        scr.text(x + 4, startY, name, { font: 'small' });
        const valW = scr.text(x + 4, startY + 12, valStr, { font: 'large' });

        if (i === this.col) {
          // Highlight active cell
          scr.invert(x + 2, startY + 11, colW - 4, 15);
        }
      }

      // Input line at bottom
      const currentName = COL_NAMES[this.col];
      const editingText = this.inputBuffer !== ''
        ? this.inputBuffer.replace(/^-/, MINUS)
        : this.coeffs[this.col].replace(/^-/, MINUS);

      scr.text(1, 48, `${currentName}= ${editingText}`, { font: 'large' });
      scr.lines = [header, this.coeffs.map((c, i) => `${COL_NAMES[i]}=${c}`).join(' '), `${currentName}=${editingText}`];
      return;
    }

    if (this.phase === 'solution') {
      const header = this.headerText();
      scr.text(1, 1, header, { font: 'small' });

      const isDec = this.displayMode === 'decimal' || !isMathInput(this.calc.setup) || !this.calc.setup.inputOutput.endsWith('MathO');
      const solText = isDec ? this.solution.decimalText : this.solution.text;

      if (this.solution.special === 'ALL' || this.solution.special === 'NONE') {
        scr.text(1, 24, solText, { font: 'large' });
        scr.lines = [header, solText];
        this.maxScrollX = 0;
        return;
      }

      const tree = isDec ? this.solution.decimalTree : this.solution.tree;
      const box = scr.measure(tree, { font: 'large', math: isMathInput(this.calc.setup) });
      const viewW = 188;
      this.maxScrollX = Math.max(0, box.w - viewW);

      scr.math(tree, {
        top: 22,
        scrollX: this.scrollX,
        record: true,
        text: solText,
        math: isMathInput(this.calc.setup)
      });

      if (this.scrollX > 0) scr.drawArrow(1, 28, 'left');
      if (this.scrollX < this.maxScrollX) scr.drawArrow(186, 28, 'right');

      scr.lines = [header, solText];
    }
  }
}
