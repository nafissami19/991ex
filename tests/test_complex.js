import test from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../js/core/Calculator.js';
import { ComplexValue, makeComplex, I, cadd, csub, cmul, cdiv, cabs, carg, cpowInt, conj } from '../js/core/modes/complex/ComplexValue.js';
import { ExactValue } from '../js/core/exact/ExactValue.js';

function lines(calc) {
  calc.render();
  return calc.screen.lines;
}

test('ComplexValue arithmetic & exact forms', () => {
  const z1 = makeComplex(ExactValue.fromInt(1n), ExactValue.fromInt(1n)); // 1 + i
  const z2 = makeComplex(ExactValue.fromInt(2n), ExactValue.fromInt(-3n)); // 2 - 3i

  // Add: (1+i) + (2-3i) = 3 - 2i
  const sum = cadd(z1, z2);
  assert.equal(sum.re.toDecimal15().toString(), '3');
  assert.equal(sum.im.toDecimal15().toString(), '-2');

  // Sub: (1+i) - (2-3i) = -1 + 4i
  const diff = csub(z1, z2);
  assert.equal(diff.re.toDecimal15().toString(), '-1');
  assert.equal(diff.im.toDecimal15().toString(), '4');

  // Mul: (2+3i) * (1+i) = -1 + 5i
  const z3 = makeComplex(ExactValue.fromInt(2n), ExactValue.fromInt(3n));
  const prod = cmul(z3, z1);
  assert.equal(prod.re.toDecimal15().toString(), '-1');
  assert.equal(prod.im.toDecimal15().toString(), '5');

  // Div: (2+3i) / (1+i) = (5 + i)/2 = 2.5 + 0.5i
  const quot = cdiv(z3, z1);
  assert.equal(quot.re.toDecimal15().toString(), '2.5');
  assert.equal(quot.im.toDecimal15().toString(), '0.5');

  // Powers: (1+i)^4 = -4
  const p4 = cpowInt(z1, 4n);
  assert.equal(p4.toDecimal15().toString(), '-4');

  // Conjugate
  const c = conj(z3);
  assert.equal(c.re.toDecimal15().toString(), '2');
  assert.equal(c.im.toDecimal15().toString(), '-3');

  // Abs: |1+i| = √2
  const a = cabs(z1);
  assert.equal(a.type, 'surd');
  assert.equal(a.value.terms.get(2n).toString(), '1');

  // Arg: Arg(1+i) = 45 in DEG, π/4 in RAD
  const argDeg = carg(z1, 'DEG');
  assert.equal(argDeg.toDecimal15().toString(), '45');
  const argRad = carg(z1, 'RAD');
  assert.equal(argRad.type, 'pi');
  assert.equal(argRad.value.q.toString(), '1/4');
});

test('Complex mode entry and indicators', () => {
  const calc = new Calculator();
  calc.pressSequence(['MENU', '2']);
  assert.equal(calc.mode, 2);
  assert.ok(calc.indicators().includes('i'));

  // Switch setup to r∠θ
  calc.pressSequence(['SHIFT', 'MENU', 'DOWN', '2', '2']); // SETUP -> Complex -> r∠θ
  assert.ok(calc.indicators().includes('∠'));
  assert.ok(!calc.indicators().includes('i'));

  // Switch back to a+bi
  calc.pressSequence(['SHIFT', 'MENU', 'DOWN', '2', '1']);
  assert.ok(calc.indicators().includes('i'));
  assert.ok(!calc.indicators().includes('∠'));
});

test('Complex mode basic calculation and i input', () => {
  const calc = new Calculator();
  calc.pressSequence(['MENU', '2']);

  // 1 + i via ENG
  calc.pressSequence(['1', '+', 'ENG', 'EXE']);
  assert.equal(lines(calc)[1].trim(), '1+i');

  // Ans^2 = 2i
  calc.pressSequence(['x²', 'EXE']);
  assert.equal(lines(calc)[1].trim(), '2i');
});

test('Manual Example 1: (1+i)⁴ + (1-i)² = -4-2i', () => {
  const calc = new Calculator();
  calc.pressSequence(['MENU', '2']);
  calc.pressSequence(['(', '1', '+', 'ENG', ')', '^', '4', 'RIGHT', '+', '(', '1', '-', 'ENG', ')', 'x²', 'EXE']);
  assert.equal(lines(calc)[1].trim(), '−4−2i');
});

test('Manual Example 2: 2∠45 = √2 + √2i (Deg, a+bi)', () => {
  const calc = new Calculator();
  calc.pressSequence(['MENU', '2']);
  calc.pressSequence(['2', 'SHIFT', 'ENG', '4', '5', 'EXE']);
  assert.equal(lines(calc)[1].trim(), '√2+√2i');
});

test('Manual Example 3: √2 + √2i = 2∠45 (Deg, r∠θ)', () => {
  const calc = new Calculator();
  calc.pressSequence(['MENU', '2']);
  calc.pressSequence(['SHIFT', 'MENU', 'DOWN', '2', '2']); // Set r∠θ
  calc.pressSequence(['SQRT', '2', 'RIGHT', '+', 'SQRT', '2', 'RIGHT', 'ENG', 'EXE']);
  assert.equal(lines(calc)[1].trim(), '2∠45');
});

test('Manual Example 4: Conjg(2+3i) = 2-3i', () => {
  const calc = new Calculator();
  calc.pressSequence(['MENU', '2']);
  calc.pressSequence(['OPTN', '2', '2', '+', '3', 'ENG', ')', 'EXE']);
  assert.equal(lines(calc)[1].trim(), '2−3i');
});

test('Manual Example 5: Abs(1+i) = √2, Arg(1+i) = 45', () => {
  const calc = new Calculator();
  calc.pressSequence(['MENU', '2']);
  calc.pressSequence(['SHIFT', '(', '1', '+', 'ENG', 'EXE']); // Abs(1+i)
  assert.equal(lines(calc)[1].trim(), '√2');

  calc.pressSequence(['OPTN', '1', '1', '+', 'ENG', ')', 'EXE']); // Arg(1+i)
  assert.equal(lines(calc)[1].trim(), '45');
});

test('Manual Example 6: ReP(2+3i) = 2, ImP(2+3i) = 3', () => {
  const calc = new Calculator();
  calc.pressSequence(['MENU', '2']);
  calc.pressSequence(['OPTN', '3', '2', '+', '3', 'ENG', ')', 'EXE']);
  assert.equal(lines(calc)[1].trim(), '2');

  calc.pressSequence(['OPTN', '4', '2', '+', '3', 'ENG', ')', 'EXE']);
  assert.equal(lines(calc)[1].trim(), '3');
});

test('Manual Example 7 & 8: ▸r∠θ and ▸a+bi conversions', () => {
  const calc = new Calculator();
  calc.pressSequence(['MENU', '2']);

  // 2 + 3i ▸r∠θ EXE
  calc.pressSequence(['2', '+', '3', 'ENG', 'OPTN', 'DOWN', '1', 'EXE']);
  assert.ok(lines(calc)[1].includes('∠'));
  assert.ok(lines(calc)[1].startsWith('3.605551275'));

  // 2∠45 ▸a+bi EXE
  calc.pressSequence(['2', 'SHIFT', 'ENG', '4', '5', 'OPTN', 'DOWN', '2', 'EXE']);
  assert.equal(lines(calc)[1].trim(), '√2+√2i');
});

test('S<=>D toggles exact surds to decimal form', () => {
  const calc = new Calculator();
  calc.pressSequence(['MENU', '2']);
  calc.pressSequence(['SQRT', '2', 'RIGHT', '+', 'SQRT', '2', 'RIGHT', 'ENG', 'EXE']);
  assert.equal(lines(calc)[1].trim(), '√2+√2i');

  calc.pressSequence(['SD']);
  assert.equal(lines(calc)[1].trim(), '1.414213562+1.414213562i');

  calc.pressSequence(['SD']);
  assert.equal(lines(calc)[1].trim(), '√2+√2i');
});

test('Errors on unsupported functions on complex numbers', () => {
  const calc = new Calculator();
  calc.pressSequence(['MENU', '2']);

  // sin(i) -> Math ERROR
  calc.pressSequence(['SIN', 'ENG', ')', 'EXE']);
  assert.equal(lines(calc)[0], 'Math ERROR');

  calc.pressSequence(['AC']);
  // ln(i) -> Math ERROR
  calc.pressSequence(['LN', 'ENG', ')', 'EXE']);
  assert.equal(lines(calc)[0], 'Math ERROR');

  calc.pressSequence(['AC']);
  // (1+i)^0.5 -> Math ERROR
  calc.pressSequence(['(', '1', '+', 'ENG', ')', '^', '0', '.', '5', 'EXE']);
  assert.equal(lines(calc)[0], 'Math ERROR');
});
