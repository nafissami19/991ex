/**
 * Unit tests for Mode 3: Base-N Mode (MENU 3).
 *
 * Verifies:
 * - BaseNValue: 32-bit two's complement integer arithmetic & bitwise logic
 * - BaseNEvaluator: multi-base number evaluation, base prefixes d, h, b, o
 * - BaseNApp: base switching keys, hex keys A–F, result conversions, OPTN menu
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../js/core/Calculator.js';
import { BaseNValue, MIN_INT32, MAX_INT32, MASK32 } from '../js/core/modes/baseN/BaseNValue.js';
import { BaseNEvaluator } from '../js/core/modes/baseN/BaseNEvaluator.js';
import { parse } from '../js/core/parse/parser.js';

describe('BaseNValue', () => {
  it('constructs within 32-bit signed range', () => {
    const v1 = new BaseNValue(0n);
    assert.equal(v1.value, 0n);
    const v2 = new BaseNValue(MAX_INT32);
    assert.equal(v2.value, 2147483647n);
    const v3 = new BaseNValue(MIN_INT32);
    assert.equal(v3.value, -2147483648n);
  });

  it('throws Math ERROR on overflow during construction', () => {
    assert.throws(() => new BaseNValue(MAX_INT32 + 1n), /Math ERROR/);
    assert.throws(() => new BaseNValue(MIN_INT32 - 1n), /Math ERROR/);
  });

  it('formats correctly across all 4 bases for positive value (555)', () => {
    const v = new BaseNValue(555n);
    assert.equal(v.toDecString(), '555');
    assert.equal(v.toHexString(), '0000022B');
    assert.equal(v.toOctString(), '00000001053');
    assert.deepEqual(v.toBinLines(), ['0000 0000 0000 0000', '0000 0010 0010 1011']);
  });

  it('formats correctly across all 4 bases for negative value (-1)', () => {
    const v = new BaseNValue(-1n);
    assert.equal(v.toDecString(), '-1');
    assert.equal(v.toHexString(), 'FFFFFFFF');
    assert.equal(v.toOctString(), '37777777777');
    assert.deepEqual(v.toBinLines(), ['1111 1111 1111 1111', '1111 1111 1111 1111']);
  });

  it('formats zero correctly across all 4 bases', () => {
    const v = new BaseNValue(0n);
    assert.equal(v.toDecString(), '0');
    assert.equal(v.toHexString(), '00000000');
    assert.equal(v.toOctString(), '00000000000');
    assert.deepEqual(v.toBinLines(), ['0000 0000 0000 0000', '0000 0000 0000 0000']);
  });

  it('performs basic arithmetic (+, -, *, /) with truncation towards zero', () => {
    const a = new BaseNValue(7n);
    const b = new BaseNValue(2n);
    assert.equal(a.add(b).value, 9n);
    assert.equal(a.sub(b).value, 5n);
    assert.equal(a.mul(b).value, 14n);
    assert.equal(a.div(b).value, 3n); // integer truncation 7/2 = 3

    const negA = new BaseNValue(-7n);
    assert.equal(negA.div(b).value, -3n); // -7/2 = -3
  });

  it('throws Math ERROR on division by zero', () => {
    const a = new BaseNValue(10n);
    const zero = new BaseNValue(0n);
    assert.throws(() => a.div(zero), /Math ERROR/);
  });

  it('throws Math ERROR on overflow in +, -, *, /', () => {
    const max = new BaseNValue(MAX_INT32);
    const one = new BaseNValue(1n);
    assert.throws(() => max.add(one), /Math ERROR/);

    const min = new BaseNValue(MIN_INT32);
    assert.throws(() => min.sub(one), /Math ERROR/);

    const negOne = new BaseNValue(-1n);
    assert.throws(() => min.div(negOne), /Math ERROR/); // -2147483648 / -1 = 2147483648
    assert.throws(() => min.neg(), /Math ERROR/);
  });

  it('performs bitwise logic (and, or, xor, xnor, not)', () => {
    // 1010_2 = 10, 1100_2 = 12
    const v10 = new BaseNValue(10n);
    const v12 = new BaseNValue(12n);

    // 10 & 12 = 8 (1000_2)
    assert.equal(v10.and(v12).value, 8n);
    assert.equal(v10.and(v12).toBinLines()[1], '0000 0000 0000 1000');

    // 10 | 12 = 14 (1110_2)
    assert.equal(v10.or(v12).value, 14n);

    // 10 ^ 12 = 6 (0110_2)
    assert.equal(v10.xor(v12).value, 6n);

    // xnor(10, 12) = not(6) = -7
    assert.equal(v10.xnor(v12).value, -7n);

    // not(10) = -11 (FFFFFFF5)
    assert.equal(v10.not().value, -11n);
    assert.equal(v10.not().toHexString(), 'FFFFFFF5');
    assert.equal(v10.not().toBinLines()[1], '1111 1111 1111 0101');
  });
});

describe('BaseNEvaluator', () => {
  it('evaluates base prefixes d, h, b, o', () => {
    // d10 + h10 + b10 + o10 = 10 + 16 + 2 + 8 = 36
    const ast = parse([
      { t: 'tok', id: 'bn_d' }, { t: 'tok', id: '1' }, { t: 'tok', id: '0' },
      { t: 'tok', id: '+' },
      { t: 'tok', id: 'bn_h' }, { t: 'tok', id: '1' }, { t: 'tok', id: '0' },
      { t: 'tok', id: '+' },
      { t: 'tok', id: 'bn_b' }, { t: 'tok', id: '1' }, { t: 'tok', id: '0' },
      { t: 'tok', id: '+' },
      { t: 'tok', id: 'bn_o' }, { t: 'tok', id: '1' }, { t: 'tok', id: '0' }
    ], { baseN: true });

    const ev = new BaseNEvaluator({ base: 'DEC' });
    const res = ev.run(ast.list[0]);
    assert.equal(res.value, 36n);
  });

  it('rejects digits invalid for the base with Syntax ERROR', () => {
    const evDec = new BaseNEvaluator({ base: 'DEC' });
    // In DEC mode, hex digit A is syntax error
    const astDec = parse([{ t: 'tok', id: 'hexA' }], { baseN: true });
    assert.throws(() => evDec.run(astDec.list[0]), /Syntax ERROR/);

    const evBin = new BaseNEvaluator({ base: 'BIN' });
    // In BIN mode, digit 2 is syntax error
    const astBin = parse([{ t: 'tok', id: '2' }], { baseN: true });
    assert.throws(() => evBin.run(astBin.list[0]), /Syntax ERROR/);

    const evOct = new BaseNEvaluator({ base: 'OCT' });
    // In OCT mode, digit 8 is syntax error
    const astOct = parse([{ t: 'tok', id: '8' }], { baseN: true });
    assert.throws(() => evOct.run(astOct.list[0]), /Syntax ERROR/);
  });

  it('evaluates Not() and Neg() functions', () => {
    const ev = new BaseNEvaluator({ base: 'BIN' });
    const astNot = parse([{ t: 'tok', id: 'Not' }, { t: 'tok', id: '1' }, { t: 'tok', id: '0' }, { t: 'tok', id: '1' }, { t: 'tok', id: '0' }, { t: 'tok', id: ')' }], { baseN: true });
    const resNot = ev.run(astNot.list[0]);
    assert.equal(resNot.value, -11n);

    const astNeg = parse([{ t: 'tok', id: 'Neg' }, { t: 'tok', id: '1' }, { t: 'tok', id: '0' }, { t: 'tok', id: '1' }, { t: 'tok', id: '0' }, { t: 'tok', id: ')' }], { baseN: true });
    const resNeg = ev.run(astNeg.list[0]);
    assert.equal(resNeg.value, -10n);
  });
});

describe('BaseNApp via Calculator', () => {
  it('enters Base-N mode via MENU 3 with default base DEC and initial 0', () => {
    const c = new Calculator();
    c.pressSequence('MENU 3');
    const scr = c.getScreen();
    assert.equal(c.mode, 3);
    assert.ok(scr.lines.some((l) => l.includes('Dec')));
    assert.equal(scr.lines[1], '0');
  });

  it('switches base using physical keys DEC(x²), HEX(x■), BIN(log■□), OCT(ln)', () => {
    const c = new Calculator();
    c.pressSequence('MENU 3');
    assert.equal(c.app.base, 'DEC');

    c.press('HEX');
    assert.equal(c.app.base, 'HEX');
    assert.equal(c.getScreen().lines[1], '00000000');

    c.press('BIN');
    assert.equal(c.app.base, 'BIN');
    assert.deepEqual(c.getScreen().lines.slice(1), ['0000 0000 0000 0000', '0000 0000 0000 0000']);

    c.press('OCT');
    assert.equal(c.app.base, 'OCT');
    assert.equal(c.getScreen().lines[1], '00000000000');

    c.press('DEC');
    assert.equal(c.app.base, 'DEC');
    assert.equal(c.getScreen().lines[1], '0');
  });

  it('converts displayed result to another base upon pressing base keys', () => {
    const c = new Calculator();
    c.pressSequence('MENU 3 1 5 * 3 7 =');
    assert.equal(c.getScreen().lines[1], '555');

    c.press('HEX');
    assert.equal(c.getScreen().lines[1], '0000022B');

    c.press('BIN');
    assert.deepEqual(c.getScreen().lines.slice(1), ['0000 0000 0000 0000', '0000 0010 0010 1011']);

    c.press('OCT');
    assert.equal(c.getScreen().lines[1], '00000001053');

    c.press('DEC');
    assert.equal(c.getScreen().lines[1], '555');
  });

  it('supports direct input of hex digits A–F without pressing ALPHA', () => {
    const c = new Calculator();
    c.pressSequence('MENU 3 HEX NEG + DEG =');
    // NEG is A (10), DEG is B (11) -> 10 + 11 = 21 = 0x15
    assert.equal(c.getScreen().lines[1], '00000015');
  });

  it('throws Syntax ERROR on decimal point . or fraction in Base-N', () => {
    const c = new Calculator();
    c.pressSequence('MENU 3 1 . 5 =');
    assert.ok(c.getScreen().lines.some((l) => l.includes('Syntax ERROR')));

    c.pressSequence('AC 1 FRAC 2 =');
    assert.ok(c.getScreen().lines.some((l) => l.includes('Syntax ERROR')));
  });
});
