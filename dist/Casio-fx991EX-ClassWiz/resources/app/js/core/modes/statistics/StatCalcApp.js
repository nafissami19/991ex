/**
 * Statistical calculation screen (entered by pressing AC from Statistics Editor).
 */

import { CalcApp, isPostfixId } from '../../apps/CalcApp.js';
import { ExactValue } from '../../exact/ExactValue.js';
import { Decimal15 } from '../../number/Decimal15.js';
import { CalcError, ERRORS } from '../../errors.js';
import { MenuView } from '../../ui/views.js';
import { STAT_TYPES } from './StatModel.js';
import './tokens.js';

export class StatCalcApp extends CalcApp {
  constructor(app) {
    super(app.calc);
    this.statApp = app;
    this.title = 'Statistics';
  }

  get model() {
    return this.statApp.model;
  }

  evaluatorContext() {
    const ctx = super.evaluatorContext();
    const model = this.model;

    ctx.resolveValue = (n) => {
      const id = n.id;
      if (id === 'stat_mean_x') {
        const s = model.calc1Var();
        return ExactValue.fromDecimal(Decimal15.from(s.meanX));
      }
      if (id === 'stat_sum_x') {
        const s = model.calc1Var();
        return ExactValue.fromDecimal(Decimal15.from(s.sumX));
      }
      if (id === 'stat_sum_x2') {
        const s = model.calc1Var();
        return ExactValue.fromDecimal(Decimal15.from(s.sumX2));
      }
      if (id === 'stat_var_pop_x') {
        const s = model.calc1Var();
        return ExactValue.fromDecimal(Decimal15.from(s.varPopX));
      }
      if (id === 'stat_sd_pop_x') {
        const s = model.calc1Var();
        return ExactValue.fromDecimal(Decimal15.from(s.sdPopX));
      }
      if (id === 'stat_var_sample_x') {
        const s = model.calc1Var();
        if (s.varSampleX === null) throw new CalcError(ERRORS.MATH);
        return ExactValue.fromDecimal(Decimal15.from(s.varSampleX));
      }
      if (id === 'stat_sd_sample_x') {
        const s = model.calc1Var();
        if (s.sdSampleX === null) throw new CalcError(ERRORS.MATH);
        return ExactValue.fromDecimal(Decimal15.from(s.sdSampleX));
      }
      if (id === 'stat_n') {
        const s = model.calc1Var();
        return ExactValue.fromInt(BigInt(s.n));
      }
      if (id === 'stat_min_x') {
        const s = model.calc1Var();
        return ExactValue.fromDecimal(Decimal15.from(s.minX));
      }
      if (id === 'stat_max_x') {
        const s = model.calc1Var();
        return ExactValue.fromDecimal(Decimal15.from(s.maxX));
      }
      if (id === 'stat_q1') {
        const s = model.calc1Var();
        return ExactValue.fromDecimal(Decimal15.from(s.q1));
      }
      if (id === 'stat_med') {
        const s = model.calc1Var();
        return ExactValue.fromDecimal(Decimal15.from(s.med));
      }
      if (id === 'stat_q3') {
        const s = model.calc1Var();
        return ExactValue.fromDecimal(Decimal15.from(s.q3));
      }

      // Paired variables
      if (id === 'stat_mean_y') {
        const s = model.calc2Var();
        return ExactValue.fromDecimal(Decimal15.from(s.meanY));
      }
      if (id === 'stat_sum_y') {
        const s = model.calc2Var();
        return ExactValue.fromDecimal(Decimal15.from(s.sumY));
      }
      if (id === 'stat_sum_y2') {
        const s = model.calc2Var();
        return ExactValue.fromDecimal(Decimal15.from(s.sumY2));
      }
      if (id === 'stat_var_pop_y') {
        const s = model.calc2Var();
        return ExactValue.fromDecimal(Decimal15.from(s.varPopY));
      }
      if (id === 'stat_sd_pop_y') {
        const s = model.calc2Var();
        return ExactValue.fromDecimal(Decimal15.from(s.sdPopY));
      }
      if (id === 'stat_var_sample_y') {
        const s = model.calc2Var();
        if (s.varSampleY === null) throw new CalcError(ERRORS.MATH);
        return ExactValue.fromDecimal(Decimal15.from(s.varSampleY));
      }
      if (id === 'stat_sd_sample_y') {
        const s = model.calc2Var();
        if (s.sdSampleY === null) throw new CalcError(ERRORS.MATH);
        return ExactValue.fromDecimal(Decimal15.from(s.sdSampleY));
      }
      if (id === 'stat_min_y') {
        const s = model.calc2Var();
        return ExactValue.fromDecimal(Decimal15.from(s.minY));
      }
      if (id === 'stat_max_y') {
        const s = model.calc2Var();
        return ExactValue.fromDecimal(Decimal15.from(s.maxY));
      }
      if (id === 'stat_sum_xy') {
        const s = model.calc2Var();
        return ExactValue.fromDecimal(Decimal15.from(s.sumXY));
      }
      if (id === 'stat_sum_x3') {
        const s = model.calc2Var();
        return ExactValue.fromDecimal(Decimal15.from(s.sumX3));
      }
      if (id === 'stat_sum_x2y') {
        const s = model.calc2Var();
        return ExactValue.fromDecimal(Decimal15.from(s.sumX2Y));
      }
      if (id === 'stat_sum_x4') {
        const s = model.calc2Var();
        return ExactValue.fromDecimal(Decimal15.from(s.sumX4));
      }

      // Regression coefficients
      if (id === 'stat_a') {
        const r = model.calcRegression();
        return ExactValue.fromDecimal(Decimal15.from(r.a));
      }
      if (id === 'stat_b') {
        const r = model.calcRegression();
        return ExactValue.fromDecimal(Decimal15.from(r.b));
      }
      if (id === 'stat_c') {
        const r = model.calcRegression();
        return ExactValue.fromDecimal(Decimal15.from(r.c));
      }
      if (id === 'stat_r') {
        const r = model.calcRegression();
        return ExactValue.fromDecimal(Decimal15.from(r.r));
      }

      return undefined;
    };

    ctx.postfix = (op, a, n) => {
      const num = a.toDecimal15().toNumber();
      if (op === 'yhat') {
        const y = model.estimateY(num);
        return ExactValue.fromDecimal(Decimal15.from(y));
      }
      if (op === 'xhat') {
        const x = model.estimateX(num);
        return ExactValue.fromDecimal(Decimal15.from(x));
      }
      if (op === 'xhat1') {
        const x = model.estimateX1(num);
        return ExactValue.fromDecimal(Decimal15.from(x));
      }
      if (op === 'xhat2') {
        const x = model.estimateX2(num);
        return ExactValue.fromDecimal(Decimal15.from(x));
      }
      if (op === 'tnorm') {
        const t = model.normT(num);
        return ExactValue.fromDecimal(Decimal15.from(t));
      }
      return undefined;
    };

    ctx.call = (fn, args, n, ev) => {
      if (fn === 'normP') {
        const t = args[0].toDecimal15().toNumber();
        return ExactValue.fromDecimal(Decimal15.from(model.normP(t)));
      }
      if (fn === 'normQ') {
        const t = args[0].toDecimal15().toNumber();
        return ExactValue.fromDecimal(Decimal15.from(model.normQ(t)));
      }
      if (fn === 'normR') {
        const t = args[0].toDecimal15().toNumber();
        return ExactValue.fromDecimal(Decimal15.from(model.normR(t)));
      }
      return undefined;
    };

    return ctx;
  }

  // ---------------------------------------------------------------- OPTN Menu

  openOptn() {
    this.calc.pushView(this.optnMenu());
  }

  optnMenu() {
    const isPaired = this.model.isPaired();
    if (!isPaired) {
      return new MenuView(this.calc, null, {
        pages: [
          [
            {
              label: 'Select Type',
              run: () => {
                this.calc.closeAllOverlays();
                this.statApp.showSelectType();
              }
            },
            {
              label: '1-Variable Calc',
              run: () => {
                this.calc.closeAllOverlays();
                this.statApp.show1VarCalc();
              }
            },
            {
              label: 'Data',
              run: () => {
                this.calc.closeAllOverlays();
                this.statApp.showEditor();
              }
            }
          ],
          [
            {
              label: 'Summation',
              run: (calc, menu) => {
                this.calc.replaceView(this.summationMenu(menu));
              }
            },
            {
              label: 'Variable',
              run: (calc, menu) => {
                this.calc.replaceView(this.variableMenu(menu));
              }
            },
            {
              label: 'Min/Max',
              run: (calc, menu) => {
                this.calc.replaceView(this.minMaxMenu(menu));
              }
            },
            {
              label: 'Norm Dist',
              run: (calc, menu) => {
                this.calc.replaceView(this.normDistMenu(menu));
              }
            }
          ]
        ]
      });
    } else {
      return new MenuView(this.calc, null, {
        pages: [
          [
            {
              label: 'Select Type',
              run: () => {
                this.calc.closeAllOverlays();
                this.statApp.showSelectType();
              }
            },
            {
              label: '2-Variable Calc',
              run: () => {
                this.calc.closeAllOverlays();
                this.statApp.show2VarCalc();
              }
            },
            {
              label: 'Regression Calc',
              run: () => {
                this.calc.closeAllOverlays();
                this.statApp.showRegCalc();
              }
            },
            {
              label: 'Data',
              run: () => {
                this.calc.closeAllOverlays();
                this.statApp.showEditor();
              }
            }
          ],
          [
            {
              label: 'Summation',
              run: (calc, menu) => {
                this.calc.replaceView(this.summationMenu(menu));
              }
            },
            {
              label: 'Variable',
              run: (calc, menu) => {
                this.calc.replaceView(this.variableMenu(menu));
              }
            },
            {
              label: 'Min/Max',
              run: (calc, menu) => {
                this.calc.replaceView(this.minMaxMenu(menu));
              }
            },
            {
              label: 'Regression',
              run: (calc, menu) => {
                this.calc.replaceView(this.regressionMenu(menu));
              }
            }
          ]
        ]
      });
    }
  }

  summationMenu(parent) {
    const ins = (id) => () => {
      this.calc.closeAllOverlays();
      this.insertInput({ tok: id }, false);
    };
    if (!this.model.isPaired()) {
      return new MenuView(
        this.calc,
        [
          { label: 'Σx', run: ins('stat_sum_x') },
          { label: 'Σx²', run: ins('stat_sum_x2') }
        ],
        { parent }
      );
    } else {
      return new MenuView(this.calc, null, {
        pages: [
          [
            { label: 'Σx', run: ins('stat_sum_x') },
            { label: 'Σx²', run: ins('stat_sum_x2') },
            { label: 'Σy', run: ins('stat_sum_y') },
            { label: 'Σy²', run: ins('stat_sum_y2') }
          ],
          [
            { label: 'Σxy', run: ins('stat_sum_xy') },
            { label: 'Σx³', run: ins('stat_sum_x3') },
            { label: 'Σx²y', run: ins('stat_sum_x2y') },
            { label: 'Σx⁴', run: ins('stat_sum_x4') }
          ]
        ],
        parent
      });
    }
  }

  variableMenu(parent) {
    const ins = (id) => () => {
      this.calc.closeAllOverlays();
      this.insertInput({ tok: id }, false);
    };
    if (!this.model.isPaired()) {
      return new MenuView(this.calc, null, {
        pages: [
          [
            { label: 'x̄', run: ins('stat_mean_x') },
            { label: 'σ²x', run: ins('stat_var_pop_x') },
            { label: 'σx', run: ins('stat_sd_pop_x') },
            { label: 's²x', run: ins('stat_var_sample_x') }
          ],
          [
            { label: 'sx', run: ins('stat_sd_sample_x') },
            { label: 'n', run: ins('stat_n') }
          ]
        ],
        parent
      });
    } else {
      return new MenuView(this.calc, null, {
        pages: [
          [
            { label: 'x̄', run: ins('stat_mean_x') },
            { label: 'σ²x', run: ins('stat_var_pop_x') },
            { label: 'σx', run: ins('stat_sd_pop_x') },
            { label: 's²x', run: ins('stat_var_sample_x') }
          ],
          [
            { label: 'sx', run: ins('stat_sd_sample_x') },
            { label: 'n', run: ins('stat_n') },
            { label: 'ȳ', run: ins('stat_mean_y') },
            { label: 'σ²y', run: ins('stat_var_pop_y') }
          ],
          [
            { label: 'σy', run: ins('stat_sd_pop_y') },
            { label: 's²y', run: ins('stat_var_sample_y') },
            { label: 'sy', run: ins('stat_sd_sample_y') }
          ]
        ],
        parent
      });
    }
  }

  minMaxMenu(parent) {
    const ins = (id) => () => {
      this.calc.closeAllOverlays();
      this.insertInput({ tok: id }, false);
    };
    if (!this.model.isPaired()) {
      return new MenuView(this.calc, null, {
        pages: [
          [
            { label: 'min(x)', run: ins('stat_min_x') },
            { label: 'Q1', run: ins('stat_q1') },
            { label: 'Med', run: ins('stat_med') },
            { label: 'Q3', run: ins('stat_q3') }
          ],
          [
            { label: 'max(x)', run: ins('stat_max_x') }
          ]
        ],
        parent
      });
    } else {
      return new MenuView(
        this.calc,
        [
          { label: 'min(x)', run: ins('stat_min_x') },
          { label: 'max(x)', run: ins('stat_max_x') },
          { label: 'min(y)', run: ins('stat_min_y') },
          { label: 'max(y)', run: ins('stat_max_y') }
        ],
        { parent }
      );
    }
  }

  normDistMenu(parent) {
    const ins = (id, post = false) => () => {
      this.calc.closeAllOverlays();
      this.insertInput({ tok: id }, post);
    };
    return new MenuView(
      this.calc,
      [
        { label: 'P(', run: ins('Pdist') },
        { label: 'Q(', run: ins('Qdist') },
        { label: 'R(', run: ins('Rdist') },
        { label: '▸t', run: ins('tnorm', true) }
      ],
      { parent }
    );
  }

  regressionMenu(parent) {
    const ins = (id, post = false) => () => {
      this.calc.closeAllOverlays();
      this.insertInput({ tok: id }, post);
    };
    if (this.model.type === STAT_TYPES.QUADRATIC) {
      return new MenuView(this.calc, null, {
        pages: [
          [
            { label: 'a', run: ins('stat_a') },
            { label: 'b', run: ins('stat_b') },
            { label: 'c', run: ins('stat_c') },
            { label: 'x̂₁', run: ins('xhat1', true) }
          ],
          [
            { label: 'x̂₂', run: ins('xhat2', true) },
            { label: 'ŷ', run: ins('yhat', true) }
          ]
        ],
        parent
      });
    } else {
      return new MenuView(this.calc, null, {
        pages: [
          [
            { label: 'a', run: ins('stat_a') },
            { label: 'b', run: ins('stat_b') },
            { label: 'r', run: ins('stat_r') },
            { label: 'x̂', run: ins('xhat', true) }
          ],
          [
            { label: 'ŷ', run: ins('yhat', true) }
          ]
        ],
        parent
      });
    }
  }
}
