import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../js/core/Calculator.js';
import { Matrix } from '../js/core/modes/matrix/Matrix.js';
import { ExactValue } from '../js/core/exact/ExactValue.js';
import { Decimal15 } from '../js/core/number/Decimal15.js';
import { CalcError, ERRORS } from '../js/core/errors.js';

describe('Prompt 23 — Matrix Mode (Mode 4)', () => {
  describe('Matrix Data Structure and Math Operations', () => {
    it('creates 1x1 to 4x4 matrices with exact values', () => {
      const m = new Matrix(2, 3);
      assert.strictEqual(m.rows, 2);
      assert.strictEqual(m.cols, 3);
      assert.strictEqual(m.get(0, 0).toDecimal15().toString(), '0');
      m.set(0, 0, ExactValue.fromInt(5n));
      assert.strictEqual(m.get(0, 0).toDecimal15().toString(), '5');

      // Invalid dimensions throw Dimension ERROR
      assert.throws(() => new Matrix(0, 2), (err) => err instanceof CalcError && err.message === ERRORS.DIMENSION);
      assert.throws(() => new Matrix(5, 2), (err) => err instanceof CalcError && err.message === ERRORS.DIMENSION);
      assert.throws(() => new Matrix(2, 5), (err) => err instanceof CalcError && err.message === ERRORS.DIMENSION);
    });

    it('performs exact matrix addition and subtraction', () => {
      const a = new Matrix(2, 2, [
        [ExactValue.fromInt(1n), ExactValue.fromInt(2n)],
        [ExactValue.fromInt(3n), ExactValue.fromInt(4n)]
      ]);
      const b = new Matrix(2, 2, [
        [ExactValue.fromInt(5n), ExactValue.fromInt(6n)],
        [ExactValue.fromInt(7n), ExactValue.fromInt(8n)]
      ]);

      const sum = a.add(b);
      assert.strictEqual(sum.get(0, 0).toDecimal15().toString(), '6');
      assert.strictEqual(sum.get(0, 1).toDecimal15().toString(), '8');
      assert.strictEqual(sum.get(1, 0).toDecimal15().toString(), '10');
      assert.strictEqual(sum.get(1, 1).toDecimal15().toString(), '12');

      const diff = b.sub(a);
      assert.strictEqual(diff.get(0, 0).toDecimal15().toString(), '4');
      assert.strictEqual(diff.get(1, 1).toDecimal15().toString(), '4');

      // Incompatible dimensions throw Dimension ERROR
      const c = new Matrix(2, 3);
      assert.throws(() => a.add(c), (err) => err.message === ERRORS.DIMENSION);
      assert.throws(() => a.sub(c), (err) => err.message === ERRORS.DIMENSION);
    });

    it('performs exact matrix multiplication', () => {
      // Worked example from User's Guide (pp. 26-27):
      // MatA = [[2, 1], [1, 1]]
      // MatB = [[2, -1], [-1, 2]]
      // MatA × MatB = [[3, 0], [1, 1]]
      const a = new Matrix(2, 2, [
        [ExactValue.fromInt(2n), ExactValue.fromInt(1n)],
        [ExactValue.fromInt(1n), ExactValue.fromInt(1n)]
      ]);
      const b = new Matrix(2, 2, [
        [ExactValue.fromInt(2n), ExactValue.fromInt(-1n)],
        [ExactValue.fromInt(-1n), ExactValue.fromInt(2n)]
      ]);

      const prod = a.mul(b);
      assert.strictEqual(prod.get(0, 0).toDecimal15().toString(), '3');
      assert.strictEqual(prod.get(0, 1).toDecimal15().toString(), '0');
      assert.strictEqual(prod.get(1, 0).toDecimal15().toString(), '1');
      assert.strictEqual(prod.get(1, 1).toDecimal15().toString(), '1');

      // Non-square product: (2×3) × (3×2) -> (2×2)
      const m1 = new Matrix(2, 3, [
        [ExactValue.fromInt(1n), ExactValue.fromInt(0n), ExactValue.fromInt(-1n)],
        [ExactValue.fromInt(0n), ExactValue.fromInt(-1n), ExactValue.fromInt(1n)]
      ]);
      const m2 = new Matrix(3, 2, [
        [ExactValue.fromInt(1n), ExactValue.fromInt(2n)],
        [ExactValue.fromInt(3n), ExactValue.fromInt(4n)],
        [ExactValue.fromInt(5n), ExactValue.fromInt(6n)]
      ]);
      const res = m1.mul(m2);
      assert.strictEqual(res.rows, 2);
      assert.strictEqual(res.cols, 2);
      assert.strictEqual(res.get(0, 0).toDecimal15().toString(), '-4'); // 1*1 + 0*3 + -1*5 = -4
      assert.strictEqual(res.get(0, 1).toDecimal15().toString(), '-4'); // 1*2 + 0*4 + -1*6 = -4

      // Incompatible dimensions throw Dimension ERROR
      assert.throws(() => m1.mul(a), (err) => err.message === ERRORS.DIMENSION);
    });

    it('performs scalar multiplication and unary negation', () => {
      const a = new Matrix(2, 2, [
        [ExactValue.fromInt(2n), ExactValue.fromInt(-3n)],
        [ExactValue.fromInt(4n), ExactValue.fromInt(0n)]
      ]);
      const scaled = a.scale(ExactValue.fromInt(3n));
      assert.strictEqual(scaled.get(0, 0).toDecimal15().toString(), '6');
      assert.strictEqual(scaled.get(0, 1).toDecimal15().toString(), '-9');
      assert.strictEqual(scaled.get(1, 0).toDecimal15().toString(), '12');

      const neg = a.neg();
      assert.strictEqual(neg.get(0, 0).toDecimal15().toString(), '-2');
      assert.strictEqual(neg.get(0, 1).toDecimal15().toString(), '3');
    });

    it('computes exact determinants up to 4x4', () => {
      // 2x2: Det([[2, 1], [1, 1]]) = 1 (User Guide Ex)
      const m2 = new Matrix(2, 2, [
        [ExactValue.fromInt(2n), ExactValue.fromInt(1n)],
        [ExactValue.fromInt(1n), ExactValue.fromInt(1n)]
      ]);
      assert.strictEqual(m2.det().toDecimal15().toString(), '1');

      // 3x3
      const m3 = new Matrix(3, 3, [
        [ExactValue.fromInt(1n), ExactValue.fromInt(2n), ExactValue.fromInt(3n)],
        [ExactValue.fromInt(0n), ExactValue.fromInt(1n), ExactValue.fromInt(4n)],
        [ExactValue.fromInt(5n), ExactValue.fromInt(6n), ExactValue.fromInt(0n)]
      ]);
      // 1*(0 - 24) - 2*(0 - 20) + 3*(0 - 5) = -24 + 40 - 15 = 1
      assert.strictEqual(m3.det().toDecimal15().toString(), '1');

      // 4x4
      const m4 = Matrix.identity(4);
      m4.set(0, 0, ExactValue.fromInt(2n));
      assert.strictEqual(m4.det().toDecimal15().toString(), '2');

      // Non-square throws Dimension ERROR
      const nonSquare = new Matrix(2, 3);
      assert.throws(() => nonSquare.det(), (err) => err.message === ERRORS.DIMENSION);
    });

    it('computes exact matrix transpose and identity', () => {
      const b = new Matrix(2, 3, [
        [ExactValue.fromInt(1n), ExactValue.fromInt(0n), ExactValue.fromInt(-1n)],
        [ExactValue.fromInt(0n), ExactValue.fromInt(-1n), ExactValue.fromInt(1n)]
      ]);
      const trn = b.transpose();
      assert.strictEqual(trn.rows, 3);
      assert.strictEqual(trn.cols, 2);
      assert.strictEqual(trn.get(0, 0).toDecimal15().toString(), '1');
      assert.strictEqual(trn.get(2, 0).toDecimal15().toString(), '-1');
      assert.strictEqual(trn.get(1, 1).toDecimal15().toString(), '-1');

      const id3 = Matrix.identity(3);
      assert.strictEqual(id3.rows, 3);
      assert.strictEqual(id3.cols, 3);
      assert.strictEqual(id3.get(0, 0).toDecimal15().toString(), '1');
      assert.strictEqual(id3.get(0, 1).toDecimal15().toString(), '0');

      assert.throws(() => Matrix.identity(5), (err) => err.message === ERRORS.ARGUMENT);
      assert.throws(() => Matrix.identity(0), (err) => err.message === ERRORS.ARGUMENT);
    });

    it('computes exact matrix inverse and powers', () => {
      // MatA = [[2, 1], [1, 1]] -> Inv = [[1, -1], [-1, 2]]
      const a = new Matrix(2, 2, [
        [ExactValue.fromInt(2n), ExactValue.fromInt(1n)],
        [ExactValue.fromInt(1n), ExactValue.fromInt(1n)]
      ]);
      const inv = a.inv();
      assert.strictEqual(inv.get(0, 0).toDecimal15().toString(), '1');
      assert.strictEqual(inv.get(0, 1).toDecimal15().toString(), '-1');
      assert.strictEqual(inv.get(1, 0).toDecimal15().toString(), '-1');
      assert.strictEqual(inv.get(1, 1).toDecimal15().toString(), '2');

      // A * A^-1 = Identity
      const id = a.mul(inv);
      assert.strictEqual(id.get(0, 0).toDecimal15().toString(), '1');
      assert.strictEqual(id.get(0, 1).toDecimal15().toString(), '0');
      assert.strictEqual(id.get(1, 0).toDecimal15().toString(), '0');
      assert.strictEqual(id.get(1, 1).toDecimal15().toString(), '1');

      // Singular matrix throws Math ERROR
      const singular = new Matrix(2, 2, [
        [ExactValue.fromInt(1n), ExactValue.fromInt(2n)],
        [ExactValue.fromInt(2n), ExactValue.fromInt(4n)]
      ]);
      assert.throws(() => singular.inv(), (err) => err.message === ERRORS.MATH);

      // Powers: x² and x³
      const a2 = a.mul(a);
      assert.strictEqual(a2.get(0, 0).toDecimal15().toString(), '5');
      assert.strictEqual(a2.get(0, 1).toDecimal15().toString(), '3');
      assert.strictEqual(a2.get(1, 0).toDecimal15().toString(), '3');
      assert.strictEqual(a2.get(1, 1).toDecimal15().toString(), '2');

      const a3 = a2.mul(a);
      assert.strictEqual(a3.get(0, 0).toDecimal15().toString(), '13');
      assert.strictEqual(a3.get(0, 1).toDecimal15().toString(), '8');
      assert.strictEqual(a3.get(1, 0).toDecimal15().toString(), '8');
      assert.strictEqual(a3.get(1, 1).toDecimal15().toString(), '5');
    });

    it('computes element-wise absolute value and row echelon forms', () => {
      const b = new Matrix(2, 3, [
        [ExactValue.fromInt(1n), ExactValue.fromInt(0n), ExactValue.fromInt(-1n)],
        [ExactValue.fromInt(0n), ExactValue.fromInt(-1n), ExactValue.fromInt(1n)]
      ]);
      const absB = b.abs();
      assert.strictEqual(absB.get(0, 2).toDecimal15().toString(), '1');
      assert.strictEqual(absB.get(1, 1).toDecimal15().toString(), '1');

      // Rref
      const rref = b.rref();
      assert.strictEqual(rref.get(0, 0).toDecimal15().toString(), '1');
      assert.strictEqual(rref.get(1, 1).toDecimal15().toString(), '1');
    });
  });

  describe('Calculator Headless Matrix Mode Execution', () => {
    it('enters Matrix mode displaying initial Define Matrix screen', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU 4');
      assert.strictEqual(calc.mode, 4);
      const scr = calc.getScreen();
      assert.ok(scr.lines.some((l) => l.includes('1:MatA')));
      assert.ok(scr.lines.some((l) => l.includes('2:MatB')));
    });

    it('defines MatA 2x2 and enters elements via Matrix Editor', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU 4 1 2 2'); // MatA, 2 rows, 2 cols
      let scr = calc.getScreen();
      assert.strictEqual(scr.lines[0], 'MatA');
      assert.strictEqual(scr.lines[3], '0'); // active cell starts at 0

      // Input 2 = 1 = 1 = 1 =
      calc.pressSequence('2 = 1 = 1 = 1 =');
      scr = calc.getScreen();
      assert.ok(scr.lines.some((l) => l.includes('[ 2  1 ]')));
      assert.ok(scr.lines.some((l) => l.includes('[ 1  1 ]')));
    });

    it('defines MatB 2x2 and computes MatA x MatB (User Guide worked example)', () => {
      const calc = new Calculator();
      // Define MatA 2x2: [[2, 1], [1, 1]]
      calc.pressSequence('MENU 4 1 2 2 2 = 1 = 1 = 1 =');
      // Define MatB 2x2: [[2, -1], [-1, 2]] via OPTN 1
      calc.pressSequence('OPTN 1 2 2 2 2 = (-) 1 = (-) 1 = 2 =');
      // Advance to calculation screen with AC
      calc.press('AC');
      // MatA × MatB
      calc.pressSequence('OPTN 3 × OPTN 4 =');
      const scr = calc.getScreen();
      // MatAns screen appears with [[3, 0], [1, 1]]
      assert.strictEqual(scr.lines[0], 'MatAns');
      assert.ok(scr.lines.some((l) => l.includes('[ 3  0 ]')));
      assert.ok(scr.lines.some((l) => l.includes('[ 1  1 ]')));
      assert.strictEqual(scr.lines[3], '3'); // cell (0, 0) value is 3
    });

    it('navigates cell cursor on MatAns screen with arrow keys', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU 4 1 2 2 2 = 1 = 1 = 1 =');
      calc.pressSequence('OPTN 1 2 2 2 2 = (-) 1 = (-) 1 = 2 =');
      calc.press('AC');
      calc.pressSequence('OPTN 3 × OPTN 4 ='); // MatAns = [[3, 0], [1, 1]]

      // Move RIGHT to cell (0, 1) -> value 0
      calc.press('RIGHT');
      let scr = calc.getScreen();
      assert.strictEqual(scr.lines[3], '0');

      // Move DOWN to cell (1, 1) -> value 1
      calc.press('DOWN');
      scr = calc.getScreen();
      assert.strictEqual(scr.lines[3], '1');
    });

    it('continues from MatAns screen with operator keys', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU 4 1 2 2 2 = 1 = 1 = 1 =');
      calc.pressSequence('OPTN 1 2 2 2 2 = (-) 1 = (-) 1 = 2 =');
      calc.press('AC');
      calc.pressSequence('OPTN 3 × OPTN 4 ='); // MatAns = [[3, 0], [1, 1]]

      // Press + to continue: switches to calculation screen with MatAns+
      calc.press('+');
      let scr = calc.getScreen();
      assert.strictEqual(scr.lines[0], 'MatAns+');

      // Add MatA: [[3, 0], [1, 1]] + [[2, 1], [1, 1]] = [[5, 1], [2, 2]]
      calc.pressSequence('OPTN 3 =');
      scr = calc.getScreen();
      assert.strictEqual(scr.lines[0], 'MatAns');
      assert.ok(scr.lines.some((l) => l.includes('[ 5  1 ]')));
      assert.ok(scr.lines.some((l) => l.includes('[ 2  2 ]')));
    });

    it('calculates scalar determinant Det(MatA)', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU 4 1 2 2 2 = 1 = 1 = 1 =');
      calc.press('AC');
      calc.pressSequence('OPTN DOWN 2 OPTN 3 ) ='); // Det(MatA)
      const scr = calc.getScreen();
      assert.strictEqual(scr.lines[1], '1');
    });

    it('calculates Identity(2) + MatA (User Guide Ex)', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU 4 1 2 2 2 = 1 = 1 = 1 =');
      calc.press('AC');
      calc.pressSequence('OPTN DOWN 4 2 ) + OPTN 3 ='); // Identity(2) + MatA
      const scr = calc.getScreen();
      assert.strictEqual(scr.lines[0], 'MatAns');
      assert.ok(scr.lines.some((l) => l.includes('[ 3  1 ]')));
      assert.ok(scr.lines.some((l) => l.includes('[ 1  2 ]')));
    });

    it('calculates matrix inverse MatA⁻¹', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU 4 1 2 2 2 = 1 = 1 = 1 =');
      calc.press('AC');
      calc.pressSequence('OPTN 3 x⁻¹ ='); // MatA^-1 = [[1, -1], [-1, 2]]
      const scr = calc.getScreen();
      assert.strictEqual(scr.lines[0], 'MatAns');
      assert.ok(scr.lines.some((l) => l.includes('[ 1  -1 ]')));
      assert.ok(scr.lines.some((l) => l.includes('[ -1  2 ]')));
    });

    it('copies MatAns to MatC using STO', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU 4 1 2 2 2 = 1 = 1 = 1 =');
      calc.press('AC');
      calc.pressSequence('OPTN 3 x² ='); // MatAns = MatA^2 = [[5, 3], [3, 2]]
      // STO C (key INV or x⁻¹)
      calc.pressSequence('STO x⁻¹');
      const scr = calc.getScreen();
      // Should now be editing MatC
      assert.strictEqual(scr.lines[0], 'MatC');
      assert.ok(scr.lines.some((l) => l.includes('[ 5  3 ]')));
      assert.ok(scr.lines.some((l) => l.includes('[ 3  2 ]')));
    });

    it('throws Dimension ERROR on incompatible matrix addition', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU 4 1 2 2 1 = 1 = 1 = 1 ='); // MatA 2x2
      calc.pressSequence('OPTN 1 2 2 3 1 = 1 = 1 = 1 = 1 = 1 ='); // MatB 2x3
      calc.press('AC');
      calc.pressSequence('OPTN 3 + OPTN 4 =');
      const scr = calc.getScreen();
      assert.ok(scr.lines.some((l) => l.includes('Dimension ERROR')));
    });

    it('throws Math ERROR on singular matrix inversion', () => {
      const calc = new Calculator();
      calc.pressSequence('MENU 4 1 2 2 1 = 2 = 2 = 4 ='); // det = 0
      calc.press('AC');
      calc.pressSequence('OPTN 3 x⁻¹ =');
      const scr = calc.getScreen();
      assert.ok(scr.lines.some((l) => l.includes('Math ERROR')));
    });
  });
});
