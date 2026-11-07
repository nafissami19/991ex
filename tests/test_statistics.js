/**
 * Unit tests for Mode 6: Statistics (Prompt 25).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StatModel, STAT_TYPES, normalCdf } from '../js/core/modes/statistics/StatModel.js';
import { Calculator } from '../js/core/Calculator.js';

describe('Prompt 25 — Statistics Mode (Mode 6)', () => {
  describe('StatModel Mathematical Algorithms', () => {
    it('computes 1-Variable summary statistics without frequency', () => {
      const m = new StatModel();
      m.setType(STAT_TYPES.ONE_VAR);
      m.setFreq(false);
      m.setCell(0, 'x', 10);
      m.setCell(1, 'x', 20);
      m.setCell(2, 'x', 30);

      const s = m.calc1Var();
      assert.equal(s.n, 3);
      assert.equal(s.meanX, 20);
      assert.equal(s.sumX, 60);
      assert.equal(s.sumX2, 1400);
      assert.equal(s.varPopX, 200 / 3);
      assert.equal(s.sdPopX, Math.sqrt(200 / 3));
      assert.equal(s.varSampleX, 100);
      assert.equal(s.sdSampleX, 10);
      assert.equal(s.minX, 10);
      assert.equal(s.q1, 10);
      assert.equal(s.med, 20);
      assert.equal(s.q3, 30);
      assert.equal(s.maxX, 30);
    });

    it('computes 1-Variable summary statistics with frequency weighting', () => {
      const m = new StatModel();
      m.setType(STAT_TYPES.ONE_VAR);
      m.setFreq(true);
      m.setCell(0, 'x', 10);
      m.setCell(0, 'freq', 2);
      m.setCell(1, 'x', 20);
      m.setCell(1, 'freq', 3);

      const s = m.calc1Var();
      assert.equal(s.n, 5);
      assert.equal(s.sumX, 80);
      assert.equal(s.meanX, 16);
      assert.equal(s.sumX2, 1400);
      assert.equal(s.varPopX, 24);
    });

    it('computes Linear regression y=a+bx and estimators xhat, yhat', () => {
      const m = new StatModel();
      m.setType(STAT_TYPES.LINEAR);
      m.setFreq(false);
      m.setCell(0, 'x', 1); m.setCell(0, 'y', 2);
      m.setCell(1, 'x', 2); m.setCell(1, 'y', 3);
      m.setCell(2, 'x', 3); m.setCell(2, 'y', 5);

      const r = m.calcRegression();
      assert.equal(r.b, 1.5);
      assert.ok(Math.abs(r.a - 1 / 3) < 1e-10);
      assert.ok(Math.abs(r.r - 0.9819805061) < 1e-8);

      assert.ok(Math.abs(m.estimateY(4) - 6.3333333333) < 1e-9);
      assert.equal(m.estimateX(5), 3.111111111111111);
    });

    it('computes Quadratic regression y=a+bx+cx² and estimators xhat1, xhat2, yhat', () => {
      const m = new StatModel();
      m.setType(STAT_TYPES.QUADRATIC);
      m.setFreq(false);
      m.setCell(0, 'x', 0); m.setCell(0, 'y', 1);
      m.setCell(1, 'x', 1); m.setCell(1, 'y', 3);
      m.setCell(2, 'x', 2); m.setCell(2, 'y', 7);

      const r = m.calcRegression();
      assert.equal(r.a, 1);
      assert.equal(r.b, 1);
      assert.equal(r.c, 1);

      assert.equal(m.estimateY(3), 13);
      assert.equal(m.estimateX1(7), 2);
      assert.equal(m.estimateX2(7), -3);
    });

    it('computes Logarithmic regression y=a+b•ln(x)', () => {
      const m = new StatModel();
      m.setType(STAT_TYPES.LOG);
      m.setFreq(false);
      m.setCell(0, 'x', 1); m.setCell(0, 'y', 2);
      m.setCell(1, 'x', 2); m.setCell(1, 'y', 5);
      m.setCell(2, 'x', 4); m.setCell(2, 'y', 8);

      const r = m.calcRegression();
      assert.equal(r.a, 2);
      assert.equal(r.r, 1);
      assert.ok(Math.abs(m.estimateY(8) - 11) < 1e-10);
      assert.ok(Math.abs(m.estimateX(11) - 8) < 1e-10);
    });

    it('computes Exponential e regression y=a•e^(bx)', () => {
      const m = new StatModel();
      m.setType(STAT_TYPES.EXP_E);
      m.setFreq(false);
      m.setCell(0, 'x', 0); m.setCell(0, 'y', 3);
      m.setCell(1, 'x', 1); m.setCell(1, 'y', 6);
      m.setCell(2, 'x', 2); m.setCell(2, 'y', 12);

      const r = m.calcRegression();
      assert.equal(r.a, 3);
      assert.ok(Math.abs(r.b - Math.LN2) < 1e-10);
      assert.equal(r.r, 1);
      assert.ok(Math.abs(m.estimateY(3) - 24) < 1e-10);
      assert.ok(Math.abs(m.estimateX(24) - 3) < 1e-10);
    });

    it('computes Exponential ab regression y=a•b^x', () => {
      const m = new StatModel();
      m.setType(STAT_TYPES.EXP_AB);
      m.setFreq(false);
      m.setCell(0, 'x', 0); m.setCell(0, 'y', 3);
      m.setCell(1, 'x', 1); m.setCell(1, 'y', 6);
      m.setCell(2, 'x', 2); m.setCell(2, 'y', 12);

      const r = m.calcRegression();
      assert.equal(r.a, 3);
      assert.equal(r.b, 2);
      assert.equal(r.r, 1);
      assert.equal(m.estimateY(3), 24);
      assert.equal(m.estimateX(24), 3);
    });

    it('computes Power regression y=a•x^b', () => {
      const m = new StatModel();
      m.setType(STAT_TYPES.POWER);
      m.setFreq(false);
      m.setCell(0, 'x', 1); m.setCell(0, 'y', 2);
      m.setCell(1, 'x', 2); m.setCell(1, 'y', 8);
      m.setCell(2, 'x', 3); m.setCell(2, 'y', 18);

      const r = m.calcRegression();
      assert.equal(r.a, 2);
      assert.equal(r.b, 2);
      assert.equal(r.r, 1);
      assert.equal(m.estimateY(4), 32);
      assert.equal(m.estimateX(32), 4);
    });

    it('computes Inverse regression y=a+b/x', () => {
      const m = new StatModel();
      m.setType(STAT_TYPES.INVERSE);
      m.setFreq(false);
      m.setCell(0, 'x', 1); m.setCell(0, 'y', 5);
      m.setCell(1, 'x', 2); m.setCell(1, 'y', 3);
      m.setCell(2, 'x', 4); m.setCell(2, 'y', 2);

      const r = m.calcRegression();
      assert.equal(r.a, 1);
      assert.equal(r.b, 4);
      assert.equal(r.r, 1);
      assert.equal(m.estimateY(8), 1.5);
      assert.equal(m.estimateX(1.5), 8);
    });

    it('evaluates normal distribution functions P, Q, R, and standardized t', () => {
      const m = new StatModel();
      m.setType(STAT_TYPES.ONE_VAR);
      m.setCell(0, 'x', 10);
      m.setCell(1, 'x', 20);
      m.setCell(2, 'x', 30);

      assert.equal(m.normT(20), 0);
      assert.equal(m.normP(0), 0.5);
      assert.equal(m.normQ(0), 0);
      assert.equal(m.normR(0), 0.5);
      assert.ok(Math.abs(m.normP(1) - 0.841344746) < 1e-8);
    });

    it('enforces maximum row capacity per Casio User Guide', () => {
      const m = new StatModel();
      m.setType(STAT_TYPES.ONE_VAR);
      m.setFreq(false);
      assert.equal(m.maxRows(), 160);

      m.setFreq(true);
      assert.equal(m.maxRows(), 80);

      m.setType(STAT_TYPES.LINEAR);
      m.setFreq(false);
      assert.equal(m.maxRows(), 80);

      m.setFreq(true);
      assert.equal(m.maxRows(), 53);
    });
  });

  describe('Calculator Headless Statistics Execution', () => {
    it('enters Statistics mode and shows Type Selection menu', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU 6');
      const lines = calc.getScreen().lines;
      assert.equal(lines[0], '1:1-Variable');
      assert.equal(lines[1], '2:y=a+bx');
      assert.equal(lines[2], '3:y=a+bx+cx²');
      assert.equal(lines[3], '4:y=a+b•ln(x)');
    });

    it('navigates to page 2 of Type Selection menu', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU 6 DOWN');
      const lines = calc.getScreen().lines;
      assert.equal(lines[0], '1:y=a•e^(bx)');
      assert.equal(lines[1], '2:y=a•b^x');
      assert.equal(lines[2], '3:y=a•x^b');
      assert.equal(lines[3], '4:y=a+b/x');
    });

    it('enters 1-Var data and displays summary results with navigation', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU 6 1 1 0 = 2 0 = 3 0 = AC OPTN 2');
      let lines = calc.getScreen().lines;
      assert.equal(lines[0], 'x̄=20');
      assert.equal(lines[1], 'Σx=60');
      assert.equal(lines[2], 'Σx²=1400');
      assert.equal(lines[3], 'σ²x=66.66666667');

      calc.pressSequence('DOWN DOWN');
      lines = calc.getScreen().lines;
      assert.equal(lines[0], 'Σx²=1400');
      assert.equal(lines[1], 'σ²x=66.66666667');
      assert.equal(lines[2], 'σx=8.164965809');
      assert.equal(lines[3], 's²x=100');
    });

    it('inserts statistical variables into expressions on stat calculation screen', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU 6 1 1 0 = 2 0 = 3 0 = AC');
      calc.pressSequence('OPTN DOWN 2 1 + 5 =');
      const lines = calc.getScreen().lines;
      assert.equal(lines[0], 'x̄+5');
      assert.equal(lines[1], '25');
    });

    it('performs linear regression and calculates estimation 4ŷ', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU 6 2 1 = 2 = 3 = RIGHT UP UP UP 2 = 3 = 5 = AC');
      calc.pressSequence('4 OPTN DOWN 4 DOWN 1 =');
      const lines = calc.getScreen().lines;
      assert.equal(lines[0], '4ŷ');
      assert.equal(lines[1], '6.333333333');
    });

    it('deletes row with DEL in editor and updates calculations', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU 6 1 1 0 = 2 0 = 3 0 = UP UP DEL AC OPTN 2');
      const lines = calc.getScreen().lines;
      assert.equal(lines[0], 'x̄=20');
      assert.equal(lines[1], 'Σx=40');
      assert.equal(lines[2], 'Σx²=1000');
      assert.equal(lines[3], 'σ²x=100');
    });

    it('shows Math ERROR when regression domain is violated', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU 6 4 0 = 1 = RIGHT UP UP 2 = 3 = AC OPTN 3');
      const lines = calc.getScreen().lines;
      assert.equal(lines[0], 'Math ERROR');
      assert.equal(lines[1], '[AC] :Cancel');
    });
  });
});
