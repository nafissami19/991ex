/**
 * Mode 2: Complex Mode
 */
import { CalcApp, isPostfixId } from '../../apps/CalcApp.js';
import { ComplexEvaluator } from './ComplexEvaluator.js';
import { inputAction } from '../../input/keyInput.js';
import { ResultView } from '../../format/ResultView.js';
import { ExactValue } from '../../exact/ExactValue.js';
import { ComplexValue } from './ComplexValue.js';

const ZERO = () => ExactValue.fromInt(0n);

export class ComplexApp extends CalcApp {
  constructor(calc) {
    super(calc);
    this.title = 'Complex';
  }

  makeEvaluator() {
    return new ComplexEvaluator(this.evaluatorContext());
  }

  makeResultView(value, flags) {
    let v = value;
    if (this.setup.complex === 'POLAR' && v instanceof ExactValue) {
      v = new ComplexValue(v, ZERO(), 'polar');
    }
    return new ResultView(v, this.setup, { ...flags, complexMode: true });
  }

  inputActionFor(ev) {
    const overrides = {
      normal: { ENG: { tok: 'i' } },
      shift: { ENG: { tok: 'angle' } }
    };
    return inputAction(ev, { math: this.editor.math, overrides });
  }

  indicators(set) {
    super.indicators(set);
    if (this.calc.setup.complex === 'POLAR') {
      set.add('∠');
    } else {
      set.add('i');
    }
  }

  optnItems() {
    const ins = (id) => (calc) => {
      (calc || this.calc).closeAllOverlays();
      this.insertInput({ tok: id }, isPostfixId(id));
    };
    return [
      { label: 'Argument', run: ins('Arg') },
      { label: 'Conjugate', run: ins('Conjg') },
      { label: 'Real Part', run: ins('ReP') },
      { label: 'Imaginary Part', run: ins('ImP') },
      { label: '▸r∠θ', run: ins('toPolar') },
      { label: '▸a+bi', run: ins('toRect') }
    ];
  }
}
