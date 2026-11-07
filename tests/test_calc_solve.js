import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Calculator } from '../js/core/Calculator.js';
import { CalcVarsView, SolveVarsView } from '../js/core/apps/calcSolve.js';
import { MINUS } from '../js/core/format/display.js';

describe('Prompt 18 — CALC Feature', () => {
  it('opens CALC prompt screen showing expression on top and variable prompt on bottom', () => {
    const calc = new Calculator();
    // 3 A + B
    calc.pressSequence('3 A + B CALC');
    assert(calc.topView instanceof CalcVarsView);
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], '3A+B');
    assert.strictEqual(scr.lines[1], 'A=0');
    assert.ok(scr.indicators.includes('Up'));
    assert.ok(scr.indicators.includes('Down'));
  });

  it('prompts each variable in turn and computes result (3A+B with A=5, B=10 -> 25)', () => {
    const calc = new Calculator();
    // 3 A + B CALC 5 = 10 = =
    calc.pressSequence('3 A + B CALC');
    assert.strictEqual(calc.getScreen().lines[1], 'A=0');

    calc.pressSequence('5 =');
    assert.strictEqual(calc.getScreen().lines[1], 'B=0');

    calc.pressSequence('1 0 =');
    assert.strictEqual(calc.getScreen().lines[1], 'B=10');

    calc.pressSequence('=');
    assert.strictEqual(calc.views.length, 0); // Overlay closed, back to app
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], '3A+B');
    assert.strictEqual(scr.lines[1], '25');
    assert.strictEqual(calc.memory.getVar('A').toDecimal15().toString(), '5');
    assert.strictEqual(calc.memory.getVar('B').toDecimal15().toString(), '10');
    assert.strictEqual(calc.memory.getAns().toDecimal15().toString(), '25');
  });

  it('re-uses stored values when CALC is pressed on result screen', () => {
    const calc = new Calculator();
    calc.pressSequence('3 A + B CALC 5 = 1 0 = =');
    assert.strictEqual(calc.getScreen().lines[1], '25');

    // Press CALC again: prompts A with stored value 5
    calc.pressSequence('CALC');
    assert(calc.topView instanceof CalcVarsView);
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], '3A+B');
    assert.strictEqual(scr.lines[1], 'A=5');

    // Press = without typing: keeps 5, moves to B
    calc.pressSequence('=');
    assert.strictEqual(calc.getScreen().lines[1], 'B=10');

    // Press = without typing: keeps 10 and computes 25
    calc.pressSequence('=');
    assert.strictEqual(calc.views.length, 0);
    assert.strictEqual(calc.getScreen().lines[1], '25');
  });

  it('re-uses stored values when EXE is pressed on CALC result screen', () => {
    const calc = new Calculator();
    calc.pressSequence('3 A + B CALC 5 = 1 0 = =');
    assert.strictEqual(calc.getScreen().lines[1], '25');

    // Press EXE on result screen: restarts CALC
    calc.pressSequence('=');
    assert(calc.topView instanceof CalcVarsView);
    assert.strictEqual(calc.getScreen().lines[1], 'A=5');
  });

  it('works with equations assigning to LHS variable (Y = 2X + 1)', () => {
    const calc = new Calculator();
    calc.pressSequence('Y == 2 x + 1 CALC');
    assert(calc.topView instanceof CalcVarsView);
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'y=2x+1');
    assert.strictEqual(scr.lines[1], 'x=0');

    // Input 3 for x
    calc.pressSequence('3 = =');
    assert.strictEqual(calc.views.length, 0);
    const scrRes = calc.getScreen();
    assert.strictEqual(scrRes.lines[0], 'y=2x+1');
    assert.strictEqual(scrRes.lines[1], '7');
    assert.strictEqual(calc.memory.getVar('y').toDecimal15().toString(), '7');
    assert.strictEqual(calc.memory.getAns().toDecimal15().toString(), '7');
  });

  it('handles multi-statements by prompting variables once then stepping through (A+B : A-B)', () => {
    const calc = new Calculator();
    calc.pressSequence('A + B : A - B CALC');
    assert(calc.topView instanceof CalcVarsView);

    // Enter A = 10, B = 4
    calc.pressSequence('1 0 = 4 = =');
    assert.strictEqual(calc.views.length, 0);

    // First statement: 10 + 4 = 14 with Disp indicator
    const scr1 = calc.getScreen();
    assert.strictEqual(scr1.lines[0], 'A+B');
    assert.strictEqual(scr1.lines[1], '14');
    assert.ok(scr1.indicators.includes('Disp'));

    // Second statement: 10 - 4 = 6 without Disp indicator
    calc.pressSequence('=');
    const scr2 = calc.getScreen();
    assert.strictEqual(scr2.lines[0], `A${MINUS}B`);
    assert.strictEqual(scr2.lines[1], '6');
    assert.ok(!scr2.indicators.includes('Disp'));
  });

  it('immediately evaluates expressions without variables on CALC (2+3 -> 5)', () => {
    const calc = new Calculator();
    calc.pressSequence('2 + 3 CALC');
    assert.strictEqual(calc.views.length, 0);
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], '2+3');
    assert.strictEqual(scr.lines[1], '5');
  });

  it('allows editing values with DEL and handles syntax errors in variable editor', () => {
    const calc = new Calculator();
    calc.pressSequence('A + 1 CALC');
    calc.pressSequence('1 2 3 DEL DEL'); // leaves 1
    calc.pressSequence('= =');
    assert.strictEqual(calc.getScreen().lines[1], '2');
  });

  it('cancels CALC on AC key', () => {
    const calc = new Calculator();
    calc.pressSequence('A + 1 CALC AC');
    assert.strictEqual(calc.views.length, 0);
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'A+1');
  });

  it('throws Syntax ERROR for equation with non-variable on LHS in CALC', () => {
    const calc = new Calculator();
    calc.pressSequence('2 x == 4 CALC');
    assert.strictEqual(calc.views.length, 0);
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'Syntax ERROR');
  });
});

describe('Prompt 18 — SOLVE Feature', () => {
  it('opens SOLVE prompt screen with equation and initial variable value', () => {
    const calc = new Calculator();
    calc.pressSequence('2 x - 6 == 0 SHIFT CALC');
    assert(calc.topView instanceof SolveVarsView);
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], `2x${MINUS}6=0`);
    assert.strictEqual(scr.lines[1], 'x=0');
  });

  it('solves linear equation 2x - 6 = 0 for x -> x = 3, L-R = 0', () => {
    const calc = new Calculator();
    calc.pressSequence('2 x - 6 == 0 SHIFT CALC =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], `2x${MINUS}6=0`);
    assert.strictEqual(scr.lines[1], 'x=3');
    assert.strictEqual(scr.lines[2], `L${MINUS}R=0`);
    assert.strictEqual(calc.memory.getVar('x').toDecimal15().toString(), '3');
    assert.strictEqual(calc.memory.getAns().toDecimal15().toString(), '3');
  });

  it('solves quadratic equation x² - 4 = 0 finding positive root from initial x = 1', () => {
    const calc = new Calculator();
    calc.pressSequence('x x² - 4 == 0 SHIFT CALC 1 = =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], `x²${MINUS}4=0`);
    assert.strictEqual(scr.lines[1], 'x=2');
    assert.strictEqual(scr.lines[2], `L${MINUS}R=0`);
  });

  it('solves quadratic equation x² - 4 = 0 finding negative root from initial x = -1', () => {
    const calc = new Calculator();
    calc.pressSequence('x x² - 4 == 0 SHIFT CALC (-) 1 = =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], `x²${MINUS}4=0`);
    assert.strictEqual(scr.lines[1], `x=${MINUS}2`);
    assert.strictEqual(scr.lines[2], `L${MINUS}R=0`);
  });

  it('solves two-variable equation x² + B = 0 with B = -2 from guide page 20', () => {
    const calc = new Calculator();
    // x² + B = 0, initial x = 1, B = -2, solved for x
    calc.pressSequence('x x² + B == 0 SHIFT CALC');
    assert.strictEqual(calc.getScreen().lines[1], 'x=0');

    calc.pressSequence('1 =');
    assert.strictEqual(calc.getScreen().lines[1], 'B=0');

    calc.pressSequence('(-) 2 =');
    assert.strictEqual(calc.getScreen().lines[1], `B=${MINUS}2`);

    // Press UP to select x to solve for, then EXE
    calc.pressSequence('UP =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'x²+B=0');
    assert.strictEqual(scr.lines[1], 'x=1.414213562');
    assert.strictEqual(scr.lines[2], `L${MINUS}R=0`);
  });

  it('treats expression without equals sign as expr = 0 (x² - 9 treated as x² - 9 = 0)', () => {
    const calc = new Calculator();
    calc.pressSequence('x x² - 9 SHIFT CALC 1 = =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], `x²${MINUS}9`);
    assert.strictEqual(scr.lines[1], 'x=3');
    assert.strictEqual(scr.lines[2], `L${MINUS}R=0`);
  });

  it('returns to prompt screen when EXE is pressed on result screen to allow changing starting value', () => {
    const calc = new Calculator();
    calc.pressSequence('x x² - 4 == 0 SHIFT CALC 1 = =');
    assert.strictEqual(calc.getScreen().lines[1], 'x=2');

    // Press EXE to return to prompt screen
    calc.pressSequence('=');
    assert(calc.topView instanceof SolveVarsView);
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], `x²${MINUS}4=0`);
    assert.strictEqual(scr.lines[1], 'x=2');

    // Change starting value to -1 and re-solve
    calc.pressSequence('(-) 1 = =');
    const scr2 = calc.getScreen();
    assert.strictEqual(scr2.lines[1], `x=${MINUS}2`);
  });

  it('exits SOLVE and returns to Calculate mode on AC key from result screen', () => {
    const calc = new Calculator();
    calc.pressSequence('2 x - 6 == 0 SHIFT CALC = AC');
    assert.strictEqual(calc.views.length, 0);
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], `2x${MINUS}6=0`);
  });

  it('throws Variable ERROR when equation contains no variables (1+2=3)', () => {
    const calc = new Calculator();
    calc.pressSequence('1 + 2 == 3 SHIFT CALC');
    assert.strictEqual(calc.views.length, 0);
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'Variable ERROR');
    assert.strictEqual(scr.lines[1], '[AC] :Cancel');
    assert.strictEqual(scr.lines[2], '[◀][▶]:Goto');
  });

  it('throws Syntax ERROR when SOLVE is called on multi-statement', () => {
    const calc = new Calculator();
    calc.pressSequence('x == 1 : x + 2 SHIFT CALC');
    assert.strictEqual(calc.views.length, 0);
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'Syntax ERROR');
  });

  it('displays Cannot Solve for non-converging equation (x² + 1 = 0)', () => {
    const calc = new Calculator();
    calc.pressSequence('x x² + 1 == 0 SHIFT CALC = =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'Cannot Solve');
    assert.strictEqual(scr.lines[1], '[AC] :Cancel');
  });
});
