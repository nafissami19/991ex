import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toks, evalText } from './helpers.js';
import { parse, STACK_LIMITS } from '../js/core/parse/parser.js';
import { CalcError } from '../js/core/errors.js';
import { Calculator } from '../js/core/Calculator.js';

const ev = (t, o) => evalText(t, o).text;
const err = (t, o) => {
  try {
    evalText(t, o);
  } catch (e) {
    assert.ok(e instanceof CalcError, `expected CalcError, got ${e}`);
    return e;
  }
  assert.fail(`expected an error for ${t}`);
};

describe('Parser & priority (Prompt 10)', () => {
  describe('priority table', () => {
    const cases = [
      ['(2+3)×4', '20'], ['sin(30)+1', '3/2'], ['5²', '25'], ['3³', '27'], ['4⁻¹', '1/4'], ['5!', '120'],
      ['50%', '1/2'], ['3!²', '36'], ['1┘2', '1/2'], ['2┘3┘4', '11/4'],
      ['(-)2²', '−4'], ['((-)2)²', '4'], ['(-)3³', '−27'],
      ['2π', '2π'], ['1÷2π', '1/(2π)'], ['1÷2×π', '1/2π'], ['6÷2(1+2)', '1'], ['1÷2(3)', '1/6'],
      ['2(3)²', '18'], ['2√(3)√(3)', '6'], ['(1+2)(3+4)', '21'], ['2sin(30)', '1'],
      ['5nPr2', '20'], ['5nCr2', '10'], ['12÷3÷2', '2'], ['12÷3×2', '8'], ['10-3-2', '5'], ['10-3+2', '9'],
      ['50%×200', '100'], ['sin(30)²', '1/4'], ['sin(30²)', '0'], ['2^(3)^(2)', '64'], ['2^(3^(2))', '512'],
      ['2×(-)3', '−6'], ['4+(-)2', '2'], ['sin(30', '1/2'], ['((1+2)×(3+4', '21'], ['sin(30:2+2', '4'],
      ['3x√(8)', '2'], ['2E3', '2000'], ['1.5E(-)3', '3/2000'], ['2(-)3'.replace('(-)', '-'), '−1']
    ];
    for (const [t, expected] of cases) {
      it(`${t} = ${expected}`, () => assert.equal(ev(t), expected));
    }
  });

  describe('multi-argument functions', () => {
    it('Pol(1,1)', () => {
      const r = evalText('Pol(1,1)');
      assert.equal(r.text, 'r=1.414213562, θ=45');
      assert.equal(r.memory.getVar('y').toNumber(), 45);
    });
    it('Rec(2,60)', () => assert.equal(ev('Rec(2,60)'), 'x=1, y=1.732050808'));
    it('Pol inside a larger expression is a Syntax ERROR', () => assert.equal(err('Pol(1,1)+1').message, 'Syntax ERROR'));
    it('log(2,8) = 3', () => assert.equal(ev('log(2,8)'), '3'));
    it('RanInt#(1,6) is an integer from 1 to 6', () => {
      for (let i = 0; i < 20; i++) {
        const n = evalText('RanInt#(1,6)').value.toNumber();
        assert.ok(Number.isInteger(n) && n >= 1 && n <= 6);
      }
    });
    it('wrong argument count is a Syntax ERROR', () => assert.equal(err('Pol(1)').message, 'Syntax ERROR'));
  });

  describe('multi-statements', () => {
    it('evaluates left to right and returns the last value', () => assert.equal(ev('1+1:2×3'), '6'));
    it('Ans updates per statement', () => assert.equal(ev('5:Ans×2'), '10'));
  });

  describe('Syntax ERROR positions', () => {
    it('2×÷3 → error at the ÷', () => {
      const e = err('2×÷3');
      assert.equal(e.message, 'Syntax ERROR');
      assert.deepEqual(e.loc, { path: [], idx: 2 });
    });
    it('5+ → error at the end', () => {
      const e = err('5+');
      assert.deepEqual(e.loc, { path: [], idx: 2 });
    });
    it('() → Syntax ERROR', () => assert.equal(err('()').message, 'Syntax ERROR'));
    it('extra ) → Syntax ERROR', () => assert.equal(err('1+2)').message, 'Syntax ERROR'));
    it('two decimal points → Syntax ERROR', () => assert.equal(err('1.2.3').message, 'Syntax ERROR'));
    it('number directly after (-)3 juxtaposition: 2(-)3 → Syntax ERROR', () => assert.equal(err('2(-)3').message, 'Syntax ERROR'));
    it('= outside CALC/SOLVE → Syntax ERROR', () => assert.equal(err('x=3').message, 'Syntax ERROR'));
  });

  describe('Stack ERROR', () => {
    it(`more than ${STACK_LIMITS.command} nested brackets → Stack ERROR`, () => {
      const t = '('.repeat(30) + '1';
      assert.equal(err(t).message, 'Stack ERROR');
    });
    it('deep pending operators → Stack ERROR', () => {
      // 1+2×3^(4+… keeps values waiting on the numeric stack
      let t = '';
      for (let i = 0; i < 12; i++) t += '1+2×(';
      t += '1';
      assert.equal(err(t).message, 'Stack ERROR');
    });
    it('long flat sums are fine', () => assert.equal(ev(Array(40).fill('1').join('+')), '40'));
  });

  describe('MathI templates through key presses', () => {
    const run = (keys) => {
      const c = new Calculator();
      c.pressSequence(keys);
      return c.getScreen().lines[1];
    };
    it('nested power template 2^(3^2) = 512', () => assert.equal(run('2 ^ 3 ^ 2 ='), '512'));
    it('power template then leave it: 2^3 RIGHT ^2 = 64', () => assert.equal(run('2 ^ 3 RIGHT ^ 2 ='), '64'));
    it('fraction template 1/2 + 1/3', () => assert.equal(run('FRAC 1 DOWN 2 RIGHT + FRAC 1 DOWN 3 ='), '5/6'));
    it('root of a fraction √(8/2) = 2', () => assert.equal(run('√ FRAC 8 DOWN 2 ='), '2'));
    it('log template log₂16 = 4', () => assert.equal(run('LOG_AB 2 RIGHT 1 6 ='), '4'));
    it('empty fraction slot → Syntax ERROR', () => {
      const c = new Calculator();
      c.pressSequence('FRAC 1 =');
      assert.equal(c.getScreen().lines[0], 'Syntax ERROR');
    });
  });

  it('parse() rejects empty input', () => {
    assert.throws(() => parse([]), CalcError);
    assert.ok(toks('1+2').length === 3);
  });
});
