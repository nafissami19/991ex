/**
 * Mode 3: Base-N Mode (MENU 3)
 *
 * 32-bit two's complement arithmetic across DEC, HEX, BIN, and OCT.
 * Base switching keys: x² (DEC), x■ (HEX), log■□ (BIN), ln (OCT).
 * Direct hex digits A–F: (-), °'", x⁻¹, sin, cos, tan.
 */

import { CalcApp, renderError } from '../../apps/CalcApp.js';
import { BaseNEvaluator } from './BaseNEvaluator.js';
import { BaseNValue } from './BaseNValue.js';
import { inputAction } from '../../input/keyInput.js';
import { CalcError, ERRORS } from '../../errors.js';
import { MenuView } from '../../ui/views.js';

const BASE_LABELS = {
  DEC: 'Dec',
  HEX: 'Hex',
  BIN: 'Bin',
  OCT: 'Oct'
};

export class BaseNApp extends CalcApp {
  constructor(calc) {
    super(calc);
    this.title = 'Base-N';
    this.base = 'DEC';
    this.lastBaseNValue = new BaseNValue(0n);
  }

  get baseLabel() {
    return BASE_LABELS[this.base] || 'Dec';
  }

  reset() {
    super.reset();
    this.base = this.base || 'DEC';
    this.lastBaseNValue = new BaseNValue(0n);
  }

  setBase(newBase) {
    if (!BASE_LABELS[newBase]) return;
    this.base = newBase;
    if (this.phase === 'result') {
      this.editor.clear();
      this.pushHistory();
    }
  }

  makeEvaluator() {
    return new BaseNEvaluator({
      ...this.evaluatorContext(),
      base: this.base
    });
  }

  parseOptions() {
    return { baseN: true };
  }

  evaluateStatement(ev, node) {
    const val = ev.run(node);
    this.lastBaseNValue = val;
    return val;
  }

  inputActionFor(ev) {
    const k = ev.key;
    if (!ev.shift) {
      if (k === 'hexA') return { tok: 'hexA' };
      if (k === 'hexB') return { tok: 'hexB' };
      if (k === 'hexC') return { tok: 'hexC' };
      if (k === 'hexD') return { tok: 'hexD' };
      if (k === 'hexE') return { tok: 'hexE' };
      if (k === 'hexF') return { tok: 'hexF' };

      if (k === 'DEG') return { tok: 'hexB' };
      if (k === 'INV') return { tok: 'hexC' };
      if (k === 'SIN') return { tok: 'hexD' };
      if (k === 'COS') return { tok: 'hexE' };
      if (k === 'TAN') return { tok: 'hexF' };

      if (k === 'NEG') {
        const lastTok = this.editor.root[this.editor.root.length - 1];
        if (this.base === 'HEX' || (lastTok && lastTok.id === 'bn_h')) {
          return { tok: 'hexA' };
        }
        return { tok: 'neg' };
      }
    }
    return inputAction(ev, { math: false });
  }

  onKey(ev) {
    const k = ev.key;

    if (this.phase === 'error') return this.onErrorKey(ev);

    // Base switching keys
    if (!ev.shift && !ev.alpha) {
      if (k === 'SQUARE') {
        this.setBase('DEC');
        return true;
      }
      if (k === 'POWER') {
        this.setBase('HEX');
        return true;
      }
      if (k === 'LOG_AB') {
        this.setBase('BIN');
        return true;
      }
      if (k === 'LN') {
        this.setBase('OCT');
        return true;
      }
    }

    // Invalid keys in Base-N produce Syntax ERROR
    if (k === 'DOT' || k === 'FRAC' || k === 'SQRT' || (!ev.shift && !ev.alpha && (k === 'INTEGRAL' || k === 'CALC'))) {
      this.showError(new CalcError(ERRORS.SYNTAX));
      return true;
    }

    return super.onKey(ev);
  }

  optnItems() {
    const ins = (id) => (calc) => {
      (calc || this.calc).closeAllOverlays();
      const isBinOp = ['and', 'or', 'xor', 'xnor'].includes(id);
      this.insertInput({ tok: id }, isBinOp);
    };
    return {
      pages: [
        [
          { label: 'and', run: ins('and') },
          { label: 'or', run: ins('or') },
          { label: 'xor', run: ins('xor') },
          { label: 'xnor', run: ins('xnor') }
        ],
        [
          { label: 'Not', run: ins('Not') },
          { label: 'Neg', run: ins('Neg') }
        ],
        [
          { label: 'd', run: ins('bn_d') },
          { label: 'h', run: ins('bn_h') },
          { label: 'b', run: ins('bn_b') },
          { label: 'o', run: ins('bn_o') }
        ]
      ]
    };
  }

  openOptn() {
    const optn = this.optnItems();
    if (optn && optn.pages) {
      this.calc.pushView(new MenuView(this.calc, [], { pages: optn.pages }));
    } else {
      super.openOptn();
    }
  }

  render(scr) {
    if (this.phase === 'error') {
      renderError(scr, this.error);
      return;
    }

    const val = this.lastBaseNValue || new BaseNValue(0n);
    const inputStr = this.inputText();

    if (this.base === 'BIN') {
      const [upper, lower] = val.toBinLines();

      // Screen drawing
      scr.text(1, 1, this.baseLabel);
      if (inputStr) {
        scr.text(1, 14, inputStr);
      }
      scr.text(1, 28, upper, { align: 'right' });
      scr.text(1, 42, lower, { align: 'right' });

      scr.lines = [inputStr || this.baseLabel, upper, lower];
    } else {
      const valStr = val.format(this.base);

      // Screen drawing
      scr.text(1, 1, this.baseLabel);
      if (inputStr) {
        scr.text(30, 1, inputStr);
      }
      scr.text(1, 40, valStr, { align: 'right' });

      scr.lines = [inputStr || this.baseLabel, valStr];
    }
  }
}
