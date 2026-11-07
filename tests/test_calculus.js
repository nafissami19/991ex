import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Calculator } from '../js/core/Calculator.js';
import { MINUS } from '../js/core/format/display.js';

describe('Prompt 19 — Definite Integration (∫)', () => {
  it('evaluates polynomial integral in MathI mode: ∫_0^2 (x³ - 2x + 1) dx = 2', () => {
    const calc = new Calculator({ setup: { inputOutput: 'MathI/MathO' } });
    calc.pressSequence('INTEGRAL x ^ 3 RIGHT - 2 x + 1 RIGHT 0 RIGHT 2 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '2');
  });

  it('evaluates official manual example in MathI mode: ∫_1^e ln(x) dx = 1', () => {
    const calc = new Calculator({ setup: { inputOutput: 'MathI/MathO' } });
    calc.pressSequence('INTEGRAL ln x ) RIGHT 1 RIGHT e =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '1');
  });

  it('evaluates trig integral in Radian mode: ∫_0^π sin(x) dx = 2', () => {
    const calc = new Calculator({ setup: { inputOutput: 'MathI/MathO', angle: 'RAD' } });
    calc.pressSequence('INTEGRAL sin x ) RIGHT 0 RIGHT π =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '2');
  });

  it('evaluates reciprocal integral: ∫_1^2 1/x dx = ln(2) ≈ 0.6931471806', () => {
    const calc = new Calculator({ setup: { inputOutput: 'MathI/MathO' } });
    calc.pressSequence('INTEGRAL 1 ÷ x RIGHT 1 RIGHT 2 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '0.6931471806');
  });

  it('evaluates integral with reversed limits: ∫_2^0 (x³ - 2x + 1) dx = -2', () => {
    const calc = new Calculator({ setup: { inputOutput: 'MathI/MathO' } });
    calc.pressSequence('INTEGRAL x ^ 3 RIGHT - 2 x + 1 RIGHT 2 RIGHT 0 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], `${MINUS}2`);
  });

  it('evaluates integral with equal limits: ∫_5^5 sin(x) dx = 0', () => {
    const calc = new Calculator({ setup: { inputOutput: 'MathI/MathO', angle: 'RAD' } });
    calc.pressSequence('INTEGRAL sin x ) RIGHT 5 RIGHT 5 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '0');
  });

  it('evaluates LineI mode integral syntax: ∫(ln(x), 1, e) = 1', () => {
    const calc = new Calculator({ setup: { inputOutput: 'LineI/LineO' } });
    calc.press('INTEGRAL');
    calc.pressSequence('ln x ) , 1 , e ) =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], '∫(ln(x),1,e)');
    assert.strictEqual(scr.lines[1], '1');
  });

  it('evaluates LineI mode integral with custom tolerance: ∫(x², 0, 1, 1×10⁻⁴)', () => {
    const calc = new Calculator({ setup: { inputOutput: 'LineI/LineO' } });
    calc.press('INTEGRAL');
    calc.pressSequence('x x² , 0 , 1 , 1 ×10ⁿ (-) 4 ) =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '0.3333333333');
  });

  it('throws Math ERROR on singularity within integration interval: ∫_-1^1 1/x² dx', () => {
    const calc = new Calculator({ setup: { inputOutput: 'MathI/MathO' } });
    calc.pressSequence('INTEGRAL 1 ÷ x x² RIGHT (-) 1 RIGHT 1 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'Math ERROR');
  });

  it('throws Argument ERROR when tolerance is less than 1×10⁻¹⁴', () => {
    const calc = new Calculator({ setup: { inputOutput: 'LineI/LineO' } });
    calc.press('INTEGRAL');
    calc.pressSequence('x , 0 , 1 , 1 ×10ⁿ (-) 1 5 ) =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'Argument ERROR');
  });

  it('throws Time Out on non-converging oscillating integral', () => {
    const calc = new Calculator({ setup: { inputOutput: 'LineI/LineO' } });
    calc.press('INTEGRAL');
    calc.pressSequence('sin 1 ÷ x ) , 1 ×10ⁿ (-) 1 0 , 1 , 1 ×10ⁿ (-) 1 4 ) =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'Time Out');
    assert.strictEqual(scr.lines[1], '[AC] :Cancel');
  });
});

describe('Prompt 19 — Numerical Differentiation (d/dx)', () => {
  it('evaluates official manual example in MathI mode: d/dx(sin(x))|_{x=π/2} = 0 (Radian)', () => {
    const calc = new Calculator({ setup: { inputOutput: 'MathI/MathO', angle: 'RAD' } });
    calc.pressSequence('d/dx sin x ) RIGHT π ÷ 2 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '0');
  });

  it('evaluates polynomial derivative: d/dx(x³ - 5x)|_{x=2} = 7', () => {
    const calc = new Calculator({ setup: { inputOutput: 'MathI/MathO' } });
    calc.pressSequence('d/dx x ^ 3 RIGHT - 5 x RIGHT 2 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '7');
  });

  it('evaluates exponential derivative: d/dx(e^x)|_{x=0} = 1', () => {
    const calc = new Calculator({ setup: { inputOutput: 'MathI/MathO' } });
    calc.pressSequence('d/dx e^ x RIGHT RIGHT 0 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '1');
  });

  it('evaluates derivative at inflection point: d/dx(x³)|_{x=0} = 0', () => {
    const calc = new Calculator({ setup: { inputOutput: 'MathI/MathO' } });
    calc.pressSequence('d/dx x ^ 3 RIGHT RIGHT 0 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '0');
  });

  it('evaluates LineI mode derivative syntax: d/dx(sin(x), π/2) = 0', () => {
    const calc = new Calculator({ setup: { inputOutput: 'LineI/LineO', angle: 'RAD' } });
    calc.pressSequence('d/dx sin x ) , π ÷ 2 ) =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '0');
  });

  it('evaluates LineI mode derivative with custom tolerance: d/dx(x², 2, 1×10⁻⁶) = 4', () => {
    const calc = new Calculator({ setup: { inputOutput: 'LineI/LineO' } });
    calc.pressSequence('d/dx x x² , 2 , 1 ×10ⁿ (-) 6 ) =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '4');
  });

  it('throws Math ERROR when derivative point is undefined: d/dx(1/x)|_{x=0}', () => {
    const calc = new Calculator({ setup: { inputOutput: 'MathI/MathO' } });
    calc.pressSequence('d/dx 1 ÷ x RIGHT 0 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'Math ERROR');
  });

  it('throws Argument ERROR when derivative tolerance is less than 1×10⁻¹⁴', () => {
    const calc = new Calculator({ setup: { inputOutput: 'LineI/LineO' } });
    calc.pressSequence('d/dx x x² , 2 , 1 ×10ⁿ (-) 1 5 ) =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'Argument ERROR');
  });
});

describe('Prompt 19 — Summation (Σ)', () => {
  it('evaluates official manual example in MathI mode: Σ_{x=1}^5 (x + 1) = 20', () => {
    const calc = new Calculator({ setup: { inputOutput: 'MathI/MathO' } });
    calc.pressSequence('Σ x + 1 RIGHT 1 RIGHT 5 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '20');
  });

  it('evaluates sum of squares: Σ_{x=1}^{10} x² = 385', () => {
    const calc = new Calculator({ setup: { inputOutput: 'MathI/MathO' } });
    calc.pressSequence('Σ x x² RIGHT 1 RIGHT 1 0 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '385');
  });

  it('evaluates sum with negative start limit: Σ_{x=-3}^3 x = 0', () => {
    const calc = new Calculator({ setup: { inputOutput: 'MathI/MathO' } });
    calc.pressSequence('Σ x RIGHT (-) 3 RIGHT 3 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '0');
  });

  it('evaluates sum with equal start and end: Σ_{x=4}^4 (2x) = 8', () => {
    const calc = new Calculator({ setup: { inputOutput: 'MathI/MathO' } });
    calc.pressSequence('Σ 2 x RIGHT 4 RIGHT 4 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '8');
  });

  it('evaluates LineI mode summation syntax: Σ(x+1, 1, 5) = 20', () => {
    const calc = new Calculator({ setup: { inputOutput: 'LineI/LineO' } });
    calc.pressSequence('Σ x + 1 , 1 , 5 ) =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'Σ(x+1,1,5)');
    assert.strictEqual(scr.lines[1], '20');
  });

  it('throws Math ERROR when start limit is greater than end limit: Σ_{x=5}^1 x', () => {
    const calc = new Calculator({ setup: { inputOutput: 'MathI/MathO' } });
    calc.pressSequence('Σ x RIGHT 5 RIGHT 1 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'Math ERROR');
  });

  it('throws Math ERROR when limit is not an integer: Σ_{x=1.5}^5 x', () => {
    const calc = new Calculator({ setup: { inputOutput: 'LineI/LineO' } });
    calc.pressSequence('Σ x , 1 . 5 , 5 ) =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'Math ERROR');
  });

  it('throws Math ERROR when limit is outside 10^10 range', () => {
    const calc = new Calculator({ setup: { inputOutput: 'LineI/LineO' } });
    calc.pressSequence('Σ x , 1 , 1 ×10ⁿ 1 0 ) =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'Math ERROR');
  });
});

describe('Prompt 19 — Busy State & Status Indicators', () => {
  it('displays Pause indicator when calculator is marked busy', () => {
    const calc = new Calculator();
    assert.ok(!calc.indicators().includes('Pause'));
    calc.busy = true;
    assert.ok(calc.indicators().includes('Pause'));
    calc.busy = false;
    assert.ok(!calc.indicators().includes('Pause'));
  });
});
