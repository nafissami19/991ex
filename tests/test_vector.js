/**
 * Unit tests for Mode 5: Vector Mode (Prompt 24).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../js/core/Calculator.js';
import { VectorValue } from '../js/core/modes/vector/VectorValue.js';
import { VectorEvaluator } from '../js/core/modes/vector/VectorEvaluator.js';
import { ExactValue } from '../js/core/exact/ExactValue.js';
import { Decimal15 } from '../js/core/number/Decimal15.js';
import { CalcError, ERRORS } from '../js/core/errors.js';

describe('Prompt 24 — VectorValue Mathematical Engine', () => {
  it('constructs 2D and 3D vectors and rejects invalid dimensions', () => {
    const v2 = new VectorValue([1, 2]);
    assert.strictEqual(v2.dim, 2);
    assert.strictEqual(v2.get(0).value.n, 1n);
    assert.strictEqual(v2.get(1).value.n, 2n);

    const v3 = new VectorValue([2, -1, 2]);
    assert.strictEqual(v3.dim, 3);
    assert.strictEqual(v3.get(1).value.n, -1n);

    assert.throws(() => new VectorValue([1]), (err) => err.message === ERRORS.DIMENSION);
    assert.throws(() => new VectorValue([1, 2, 3, 4]), (err) => err.message === ERRORS.DIMENSION);
  });

  it('performs vector addition, subtraction and negation', () => {
    const a = new VectorValue([1, 2]);
    const b = new VectorValue([3, 4]);

    const sum = a.add(b);
    assert.strictEqual(sum.format(), '[ 4  6 ]');

    const diff = a.sub(b);
    assert.strictEqual(diff.format(), '[ -2  -2 ]');

    const neg = a.neg();
    assert.strictEqual(neg.format(), '[ -1  -2 ]');
  });

  it('performs scalar multiplication and division', () => {
    const a = new VectorValue([1, 2]);
    const scaled = a.mulScalar(3);
    assert.strictEqual(scaled.format(), '[ 3  6 ]');

    const div = scaled.divScalar(3);
    assert.strictEqual(div.format(), '[ 1  2 ]');

    assert.throws(() => a.divScalar(0), (err) => err.message === ERRORS.MATH);
  });

  it('calculates dot product correctly for 2D and 3D vectors', () => {
    const a2 = new VectorValue([1, 2]);
    const b2 = new VectorValue([3, 4]);
    assert.strictEqual(a2.dot(b2).value.n, 11n);

    const c3 = new VectorValue([2, -1, 2]);
    const d3 = new VectorValue([1, 2, 3]);
    assert.strictEqual(c3.dot(d3).value.n, 6n);
  });

  it('calculates cross product for 3D vectors and throws Dimension ERROR for 2D', () => {
    const c3 = new VectorValue([2, -1, 2]);
    const d3 = new VectorValue([1, 2, 3]);
    const cross = c3.cross(d3);
    assert.strictEqual(cross.dim, 3);
    assert.strictEqual(cross.get(0).value.n, -7n);
    assert.strictEqual(cross.get(1).value.n, -4n);
    assert.strictEqual(cross.get(2).value.n, 5n);

    // Cross product is perpendicular to both inputs
    assert.strictEqual(c3.dot(cross).value.n, 0n);
    assert.strictEqual(d3.dot(cross).value.n, 0n);

    // 2D cross product throws Dimension ERROR
    const a2 = new VectorValue([1, 2]);
    const b2 = new VectorValue([3, 4]);
    assert.throws(() => a2.cross(b2), (err) => err.message === ERRORS.DIMENSION);
  });

  it('calculates magnitude (Abs) and unit vector', () => {
    const c3 = new VectorValue([2, -1, 2]);
    const mag = c3.abs();
    assert.strictEqual(mag.value.n, 3n);

    const u = c3.unitVector();
    assert.strictEqual(u.get(0).value.n, 2n);
    assert.strictEqual(u.get(0).value.d, 3n);
    assert.strictEqual(u.get(1).value.n, -1n);
    assert.strictEqual(u.get(1).value.d, 3n);
    assert.strictEqual(u.get(2).value.n, 2n);
    assert.strictEqual(u.get(2).value.d, 3n);

    // Unit vector has length 1
    assert.strictEqual(u.abs().value.n, 1n);

    // Zero vector unit vector throws Math ERROR
    const zeroVec = new VectorValue([0, 0]);
    assert.throws(() => zeroVec.unitVector(), (err) => err.message === ERRORS.MATH);
  });

  it('calculates angle between vectors in DEG, RAD, and GRA', () => {
    const a = new VectorValue([1, 0]);
    const b = new VectorValue([0, 1]);

    const angDeg = a.angle(b, 'DEG');
    assert.strictEqual(angDeg.toDecimal15().toString(), '90');

    const angRad = a.angle(b, 'RAD');
    assert.ok(angRad.toDecimal15().toString().startsWith('1.570796326'));

    const angGra = a.angle(b, 'GRA');
    assert.strictEqual(angGra.toDecimal15().toString(), '100');

    // Parallel and anti-parallel vectors
    const p1 = new VectorValue([1, 2]);
    const p2 = new VectorValue([2, 4]);
    assert.strictEqual(p1.angle(p2, 'DEG').toDecimal15().toString(), '0');

    const opp = new VectorValue([-1, -2]);
    assert.strictEqual(p1.angle(opp, 'DEG').toDecimal15().toString(), '180');

    // Zero vector throws Math ERROR
    const zero = new VectorValue([0, 0]);
    assert.throws(() => a.angle(zero, 'DEG'), (err) => err.message === ERRORS.MATH);
  });

  it('serializes and deserializes cleanly through JSON', () => {
    const orig = new VectorValue([2, -1, 2]);
    const json = orig.toJSON();
    const roundtrip = VectorValue.fromJSON(json);
    assert.strictEqual(roundtrip.dim, 3);
    assert.strictEqual(roundtrip.get(0).value.n, 2n);
    assert.strictEqual(roundtrip.get(1).value.n, -1n);
    assert.strictEqual(roundtrip.get(2).value.n, 2n);
  });
});

describe('Prompt 24 — Vector Mode Calculations and UI Workflow', () => {
  it('opens Vector mode and initial define menu', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 5');
    assert.strictEqual(calc.mode, 5);
    const scr = calc.getScreen();
    assert.ok(scr.lines.some((l) => l.includes('Vector')));
  });

  it('defines 2D vector and returns to calculation screen with AC', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 5 1 2 1 = 2 = AC');
    assert.strictEqual(calc.views.length, 0);
    const vctA = calc.app.getVector('VctA');
    assert.ok(vctA instanceof VectorValue);
    assert.strictEqual(vctA.dim, 2);
    assert.strictEqual(vctA.get(0).value.n, 1n);
    assert.strictEqual(vctA.get(1).value.n, 2n);
  });

  it('performs vector addition and displays VctAns screen', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 5 1 2 1 = 2 = OPTN 1 2 2 3 = 4 = AC');
    calc.pressSequence('OPTN 3 + OPTN 4 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'VctAns');
    assert.ok(scr.lines[1].includes('4') && scr.lines[1].includes('6'));
  });

  it('scrolls elements with LEFT/RIGHT on VctAns screen', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 5 1 2 1 = 2 = OPTN 1 2 2 3 = 4 = AC');
    calc.pressSequence('OPTN 3 + OPTN 4 =');
    let scr = calc.getScreen();
    assert.strictEqual(scr.lines[3], '4');

    calc.pressSequence('RIGHT');
    scr = calc.getScreen();
    assert.strictEqual(scr.lines[3], '6');

    calc.pressSequence('LEFT');
    scr = calc.getScreen();
    assert.strictEqual(scr.lines[3], '4');
  });

  it('continues calculation with operator key from VctAns', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 5 1 2 1 = 2 = OPTN 1 2 2 3 = 4 = AC');
    calc.pressSequence('OPTN 3 + OPTN 4 =');
    calc.pressSequence('+ OPTN 3 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'VctAns');
    assert.ok(scr.lines[1].includes('5') && scr.lines[1].includes('8'));
  });

  it('copies VctAns to another vector using STO key', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 5 1 2 1 = 2 = OPTN 1 2 2 3 = 4 = AC');
    calc.pressSequence('OPTN 3 + OPTN 4 = STO C');
    const vctC = calc.app.getVector('VctC');
    assert.ok(vctC instanceof VectorValue);
    assert.strictEqual(vctC.dim, 2);
    assert.strictEqual(vctC.get(0).value.n, 4n);
    assert.strictEqual(vctC.get(1).value.n, 6n);
  });

  it('toggles vector elements between exact and decimal with S<=>D', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 5 3 3 2 = (-) 1 = 2 = AC OPTN DOWN 4 OPTN 5 ) =');
    let scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'VctAns');
    assert.ok(scr.lines[1].includes('2/3') || scr.lines[1].includes('2┘3'));

    calc.pressSequence('SD');
    scr = calc.getScreen();
    assert.ok(scr.lines[3].startsWith('0.666666'));
  });

  it('edits vector elements using OPTN 2 Edit Vector', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 5 1 2 1 = 2 = AC');
    calc.pressSequence('OPTN 2 1 9 = AC');
    const vctA = calc.app.getVector('VctA');
    assert.strictEqual(vctA.get(0).value.n, 9n);
    assert.strictEqual(vctA.get(1).value.n, 2n);
  });

  it('retains vector memories across mode changes and power off', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 5 1 2 5 = 6 = AC');
    calc.pressSequence('MENU 1'); // Switch to Calculate mode
    assert.strictEqual(calc.mode, 1);

    calc.pressSequence('MENU 5 AC'); // Return to Vector mode
    assert.strictEqual(calc.mode, 5);
    const vctA = calc.app.getVector('VctA');
    assert.strictEqual(vctA.get(0).value.n, 5n);
    assert.strictEqual(vctA.get(1).value.n, 6n);
  });

  it('throws Dimension ERROR when using undefined vectors', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 5 AC OPTN 6 + OPTN 6 =');
    const scr = calc.getScreen();
    assert.ok(scr.lines.some((l) => l.includes('Dimension ERROR')));
  });

  it('throws Dimension ERROR when adding vectors with different dimensions', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 5 1 2 1 = 2 = AC OPTN 1 3 3 1 = 2 = 3 = AC OPTN 3 + OPTN 5 =');
    const scr = calc.getScreen();
    assert.ok(scr.lines.some((l) => l.includes('Dimension ERROR')));
  });
});
