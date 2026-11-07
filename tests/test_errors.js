import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ERRORS, GOTO_ERRORS, CalcError, toCalcError } from '../js/core/errors.js';
import { STACK_LIMITS, checkTreeDepth, Evaluator } from '../js/core/eval/evaluate.js';
import { Calculator } from '../js/core/Calculator.js';
import { parse } from '../js/core/parse/parser.js';
import { Editor } from '../js/core/input/Editor.js';
import { ExactValue } from '../js/core/exact/ExactValue.js';

describe('Calculator Errors and Error Screens (Prompt 11)', () => {
  describe('1. Error definitions and aliases', () => {
    it('defines all required error types', () => {
      assert.equal(ERRORS.MATH, 'Math ERROR');
      assert.equal(ERRORS.STACK, 'Stack ERROR');
      assert.equal(ERRORS.SYNTAX, 'Syntax ERROR');
      assert.equal(ERRORS.ARGUMENT, 'Argument ERROR');
      assert.equal(ERRORS.DIMENSION, 'Dimension ERROR');
      assert.equal(ERRORS.VARIABLE, 'Variable ERROR');
      assert.equal(ERRORS.CANT_SOLVE, 'Cannot Solve');
      assert.equal(ERRORS.CANNOT_SOLVE, 'Cannot Solve');
      assert.equal(ERRORS.RANGE, 'Range ERROR');
      assert.equal(ERRORS.TIME_OUT, 'Time Out');
      assert.equal(ERRORS.CIRCULAR, 'Circular ERROR');
      assert.equal(ERRORS.MEMORY, 'Memory ERROR');
      assert.equal(ERRORS.INSUFFICIENT_MEM, 'Memory ERROR');
    });

    it('GOTO_ERRORS contains only errors that offer Goto [◀][▶]', () => {
      assert.ok(GOTO_ERRORS.has(ERRORS.MATH));
      assert.ok(GOTO_ERRORS.has(ERRORS.STACK));
      assert.ok(GOTO_ERRORS.has(ERRORS.SYNTAX));
      assert.ok(GOTO_ERRORS.has(ERRORS.ARGUMENT));
      assert.ok(GOTO_ERRORS.has(ERRORS.DIMENSION));
      assert.ok(GOTO_ERRORS.has(ERRORS.VARIABLE));

      assert.ok(!GOTO_ERRORS.has(ERRORS.CANT_SOLVE));
      assert.ok(!GOTO_ERRORS.has(ERRORS.RANGE));
      assert.ok(!GOTO_ERRORS.has(ERRORS.TIME_OUT));
      assert.ok(!GOTO_ERRORS.has(ERRORS.CIRCULAR));
      assert.ok(!GOTO_ERRORS.has(ERRORS.MEMORY));
    });

    it('CalcError normalizes aliases', () => {
      const e1 = new CalcError("Can't Solve");
      assert.equal(e1.message, 'Cannot Solve');
      const e2 = new CalcError('Insufficient MEM');
      assert.equal(e2.message, 'Memory ERROR');
    });

    it('toCalcError maps known messages and keeps location', () => {
      const loc = { path: [], idx: 5 };
      const e1 = toCalcError(new Error('Syntax ERROR'), loc);
      assert.equal(e1.message, 'Syntax ERROR');
      assert.deepEqual(e1.loc, loc);

      const e2 = toCalcError(new RangeError('overflow'), loc);
      assert.equal(e2.message, 'Math ERROR');
      assert.deepEqual(e2.loc, loc);

      const e3 = toCalcError(new Error("Can't Solve"), loc);
      assert.equal(e3.message, 'Cannot Solve');

      const e4 = toCalcError(new Error('Insufficient MEM'), loc);
      assert.equal(e4.message, 'Memory ERROR');
    });
  });

  describe('2. Stack depth checks', () => {
    it(`enforces command stack limit (${STACK_LIMITS.command}) and numeric limit (${STACK_LIMITS.numeric})`, () => {
      const ed = new Editor({ math: false });
      for (let i = 0; i < 26; i++) ed.insertToken('(');
      ed.insertToken('1');
      assert.throws(() => parse(ed.root, {}), (err) => err instanceof CalcError && err.message === 'Stack ERROR');
    });

    it('checkTreeDepth catches deeply nested operations', () => {
      // Build a tree with > 10 nested right-hand operations: 1 + (1 + (1 + ...))
      let node = { type: 'num', mant: '1', decimal: false, exp: null };
      for (let i = 0; i < 12; i++) {
        node = { type: 'bin', op: '+', l: { type: 'num', mant: '1', decimal: false, exp: null }, r: node, loc: { path: [], idx: i } };
      }
      assert.throws(() => checkTreeDepth(node), (err) => err instanceof CalcError && err.message === 'Stack ERROR');
    });
  });

  describe('3. Evaluator error triggers', () => {
    it('throws Argument ERROR on invalid integral tolerance (tol <= 0 or tol >= 1)', () => {
      const c = new Calculator({ setup: { inputOutput: 'LineI/LineO' } });
      c.pressSequence('∫ sin 1 ÷ X ) , 0 . 0 0 0 1 , 1 , (-) 1 ) =');
      assert.deepEqual(c.getScreen().lines, ['Argument ERROR', '[AC] :Cancel', '[◀][▶]:Goto']);
    });

    it('throws Time Out on non-converging integral exceeding iteration limit', () => {
      const c = new Calculator({ setup: { inputOutput: 'LineI/LineO' } });
      c.pressSequence('∫ sin 1 ÷ X ) , 1 ×10ⁿ (-) 1 0 , 1 , 1 ×10ⁿ (-) 1 4 ) =');
      assert.deepEqual(c.getScreen().lines, ['Time Out', '[AC] :Cancel']);
    });

    it('throws Dimension ERROR on undefined matrix', () => {
      const c = new Calculator();
      c.pressSequence('MENU 4 AC OPTN 3 + OPTN 4 =');
      assert.deepEqual(c.getScreen().lines, ['Dimension ERROR', '[AC] :Cancel', '[◀][▶]:Goto']);
    });

    it('throws Variable ERROR on SOLVE with no variable', () => {
      const c = new Calculator();
      c.pressSequence('1 + 2 == 3 SHIFT CALC');
      assert.deepEqual(c.getScreen().lines, ['Variable ERROR', '[AC] :Cancel', '[◀][▶]:Goto']);
    });

    it('throws Cannot Solve on SOLVE equation with no real root', () => {
      const c = new Calculator();
      c.pressSequence('x x² + 1 == 0 SHIFT CALC = =');
      assert.deepEqual(c.getScreen().lines, ['Cannot Solve', '[AC] :Cancel']);
    });

    it('throws Range ERROR in Table mode when row count exceeds limit', () => {
      const c = new Calculator();
      c.pressSequence('MENU 9 x = = 1 0 0 = = =');
      assert.deepEqual(c.getScreen().lines, ['Range ERROR', '[AC] :Cancel']);
    });

    it('throws Circular ERROR in Spreadsheet mode on circular formula dependency', () => {
      const c = new Calculator();
      c.pressSequence('MENU 8 == A 1 + 1 =');
      assert.deepEqual(c.getScreen().lines, ['Circular ERROR', '[AC] :Cancel']);
    });

    it('throws Memory ERROR in Spreadsheet mode when memory capacity exceeded', () => {
      const c = new Calculator();
      c.pressSequence('MENU 8 OPTN 1 2 x² = A 1 : E 4 5 =');
      assert.deepEqual(c.getScreen().lines, ['Memory ERROR', '[AC] :Cancel']);
    });
  });

  describe('4. Error screen navigation (AC and ◀/▶)', () => {
    it('AC clears input and resets to blank input screen', () => {
      const c = new Calculator();
      c.pressSequence('1 ÷ 0 =');
      assert.equal(c.getScreen().lines[0], 'Math ERROR');
      c.press('AC');
      assert.deepEqual(c.getScreen().lines, ['', '']);
      assert.equal(c.app.phase, 'edit');
    });

    it('◀ restores input expression and positions cursor at error location', () => {
      const c = new Calculator();
      c.pressSequence('1 + × 2 =');
      assert.equal(c.getScreen().lines[0], 'Syntax ERROR');
      c.press('LEFT');
      assert.equal(c.app.phase, 'edit');
      assert.equal(c.getScreen().lines[0], '1+×2');
      assert.equal(c.app.editor.idx, 2); // positioned at the '×' token
    });

    it('non-goto errors ignore ◀/▶ and only respond to AC', () => {
      const c = new Calculator();
      c.pressSequence('x x² + 1 == 0 SHIFT CALC = =');
      assert.equal(c.getScreen().lines[0], 'Cannot Solve');
      c.press('LEFT');
      assert.equal(c.getScreen().lines[0], 'Cannot Solve'); // unchanged
      c.press('AC');
      assert.notEqual(c.getScreen().lines[0], 'Cannot Solve');
    });
  });

  describe('5. Ans and PreAns tracking', () => {
    it('shifts Ans into PreAns upon each completed calculation', () => {
      const c = new Calculator();
      assert.equal(c.memory.getAns().toDecimal15().toString(), '0');
      assert.equal(c.memory.getPreAns().toDecimal15().toString(), '0');

      c.pressSequence('7 × 8 =');
      assert.equal(c.memory.getAns().toDecimal15().toString(), '56');
      assert.equal(c.memory.getPreAns().toDecimal15().toString(), '0');

      c.pressSequence('1 0 + 2 =');
      assert.equal(c.memory.getAns().toDecimal15().toString(), '12');
      assert.equal(c.memory.getPreAns().toDecimal15().toString(), '56');

      c.pressSequence('Ans + 4 =');
      assert.equal(c.memory.getAns().toDecimal15().toString(), '16');
      assert.equal(c.memory.getPreAns().toDecimal15().toString(), '12');
    });

    it('Memory.clear() resets Ans and PreAns to 0', () => {
      const c = new Calculator();
      c.pressSequence('1 + 2 =');
      c.memory.clear();
      assert.equal(c.memory.getAns().toDecimal15().toString(), '0');
      assert.equal(c.memory.getPreAns().toDecimal15().toString(), '0');
    });
  });
});
