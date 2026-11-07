import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../js/core/Calculator.js';
import * as distMath from '../js/core/modes/distribution/distributionMath.js';

describe('Prompt 26 — Distribution Mode Unit Tests', () => {
  it('opens type menu on MENU 7 showing Page 1 with Down indicator', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 7');
    assert.strictEqual(calc.mode, 7);
    const scr = calc.getScreen();
    assert.deepEqual(scr.lines, ['1:Normal PD', '2:Normal CD', '3:Inverse Normal', '4:Binomial PD']);
    assert.ok(scr.indicators.includes('Down'));
  });

  it('scrolls between Page 1 and Page 2 with DOWN and UP', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 7 DOWN');
    let scr = calc.getScreen();
    assert.deepEqual(scr.lines, ['1:Binomial CD', '2:Poisson PD', '3:Poisson CD']);
    assert.ok(scr.indicators.includes('Up'));

    calc.pressSequence('UP');
    scr = calc.getScreen();
    assert.deepEqual(scr.lines, ['1:Normal PD', '2:Normal CD', '3:Inverse Normal', '4:Binomial PD']);
    assert.ok(scr.indicators.includes('Down'));
  });

  it('calculates Normal PD (Manual Ex 1: x=36, σ=2, μ=35 -> p = 0.1760326634)', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 7 1 3 6 = 2 = 3 5 = =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'p=');
    assert.strictEqual(scr.lines[1], '0.1760326634');
    assert.strictEqual(calc.memory.getAns().toDecimal15().toString(), '0.17603266338215');
  });

  it('returns to parameter input on EXE or AC from variable result', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 7 1 3 6 = 2 = 3 5 = = =');
    let scr = calc.getScreen();
    assert.ok(scr.lines.some((l) => l.includes('x=36')));
    assert.ok(scr.lines.some((l) => l.includes('σ=2')));
    assert.ok(scr.lines.some((l) => l.includes('μ=35')));

    calc.pressSequence('= AC');
    scr = calc.getScreen();
    assert.ok(scr.lines.some((l) => l.includes('x=36')));
  });

  it('stores Normal PD result to variable A with STO A', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 7 1 3 6 = 2 = 3 5 = = STO A');
    assert.strictEqual(calc.memory.getVar('A').toDecimal15().toString(), '0.17603266338215');
  });

  it('throws Math ERROR for Normal PD when σ <= 0', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 7 1 0 = 0 = 0 = =');
    const scr = calc.getScreen();
    assert.ok(scr.lines.some((l) => l.includes('Math ERROR')));
    calc.pressSequence('AC');
    assert.ok(calc.getScreen().lines.some((l) => l.includes('x=')));
  });

  it('calculates Normal CD: P(-1 ≤ X ≤ 1) = 0.6826894921', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 7 2 (-) 1 = 1 = 1 = 0 = =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'p=');
    assert.strictEqual(scr.lines[1], '0.6826894921');
  });

  it('calculates Normal CD: P(-2 ≤ X ≤ 2) = 0.9544997361', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 7 2 (-) 2 = 2 = 1 = 0 = =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'p=');
    assert.strictEqual(scr.lines[1], '0.9544997361');
  });

  it('throws Math ERROR for Normal CD when Lower > Upper', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 7 2 2 = 1 = 1 = 0 = =');
    const scr = calc.getScreen();
    assert.ok(scr.lines.some((l) => l.includes('Math ERROR')));
  });

  it('calculates Inverse Normal: Area=0.5 -> xInv=0 and Area=0.975 -> xInv=1.959963985', () => {
    let calc = new Calculator();
    calc.pressSequence('MENU 7 3 0 . 5 = 1 = 0 = =');
    let scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'xInv=');
    assert.strictEqual(scr.lines[1], '0');

    calc = new Calculator();
    calc.pressSequence('MENU 7 3 0 . 9 7 5 = 1 = 0 = =');
    scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'xInv=');
    assert.strictEqual(scr.lines[1], '1.959963985');
  });

  it('throws Math ERROR for Inverse Normal when Area <= 0 or Area >= 1', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 7 3 1 . 5 = 1 = 0 = =');
    const scr = calc.getScreen();
    assert.ok(scr.lines.some((l) => l.includes('Math ERROR')));
  });

  it('prompts 1:List / 2:Variable for Binomial PD', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 7 4');
    const scr = calc.getScreen();
    assert.deepEqual(scr.lines, ['1:List', '2:Variable']);
  });

  it('calculates Binomial PD Variable: x=10, N=15, p=0.6 -> 0.1859378448', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 7 4 2 1 0 = 1 5 = 0 . 6 = =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'p=');
    assert.strictEqual(scr.lines[1], '0.1859378448');
  });

  it('throws Math ERROR for Binomial PD Variable when x > N', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 7 4 2 6 = 5 = 0 . 5 = =');
    const scr = calc.getScreen();
    assert.ok(scr.lines.some((l) => l.includes('Math ERROR')));
  });

  it('calculates Binomial CD Variable: x=10, N=15, p=0.6 -> 0.7827222943', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 7 DOWN 1 2 1 0 = 1 5 = 0 . 6 = =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'p=');
    assert.strictEqual(scr.lines[1], '0.7827222943');
  });

  it('calculates Poisson PD Variable: x=3, λ=2 -> 0.1804470443', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 7 DOWN 2 2 3 = 2 = =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'p=');
    assert.strictEqual(scr.lines[1], '0.1804470443');
  });

  it('calculates Poisson CD Variable: x=3, λ=2 -> 0.8571234605', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 7 DOWN 3 2 3 = 2 = =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'p=');
    assert.strictEqual(scr.lines[1], '0.8571234605');
  });

  it('calculates Binomial PD List (Manual Ex 2: {10,11,12,13}, N=15, p=0.6)', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 7 4 1 1 0 = 1 1 = 1 2 = 1 3 = = 1 5 = 0 . 6 = =');
    const scr = calc.getScreen();
    assert.ok(scr.lines.some((l) => l.includes('Binomial PD')));
    assert.ok(scr.lines.some((l) => l.includes('0.1859')));
  });

  it('shows ERROR in P column for out-of-range x in List mode', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 7 4 1 2 0 = = 1 5 = 0 . 6 = =');
    const scr = calc.getScreen();
    assert.ok(scr.lines.some((l) => l.includes('ERROR')));
  });

  it('re-opens Select Type menu via OPTN 1', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 7 1 OPTN 1');
    const scr = calc.getScreen();
    assert.deepEqual(scr.lines, ['1:Normal PD', '2:Normal CD', '3:Inverse Normal', '4:Binomial PD']);
  });
});
