import test from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../js/core/Calculator.js';
import { Decimal15 } from '../js/core/number/Decimal15.js';
import { shiftFormula, parseRange, parseCellRef } from '../js/core/modes/spreadsheet/evaluator.js';

function lines(calc) {
  calc.render();
  return calc.screen.lines;
}

test('Spreadsheet evaluator: reference parsing and shifting', () => {
  const p1 = parseCellRef('A1');
  assert.deepEqual(p1, { col: 0, row: 1, absCol: false, absRow: false });

  const p2 = parseCellRef('$B$12');
  assert.deepEqual(p2, { col: 1, row: 12, absCol: true, absRow: true });

  const p3 = parseCellRef('C$4');
  assert.deepEqual(p3, { col: 2, row: 4, absCol: false, absRow: true });

  const p4 = parseCellRef('$E45');
  assert.deepEqual(p4, { col: 4, row: 45, absCol: true, absRow: false });

  assert.equal(parseCellRef('F1'), null);
  assert.equal(parseCellRef('A46'), null);
  assert.equal(parseCellRef('A0'), null);

  // Range parsing
  const rng = parseRange('A1:B3');
  assert.equal(rng.minCol, 0);
  assert.equal(rng.maxCol, 1);
  assert.equal(rng.minRow, 1);
  assert.equal(rng.maxRow, 3);

  // Shifting relative and absolute references
  // =A1 + $B$1 + C$2 + $D3 copied 1 col right, 2 rows down
  const shifted = shiftFormula('=A1+$B$1+C$2+$D3', 1, 2);
  assert.equal(shifted, '=B3+$B$1+D$2+$D5');

  // Out-of-bounds shift
  const oob = shiftFormula('=A1', -1, 0);
  assert.equal(oob, '=?1');
});

test('Spreadsheet mode entry and initial screen', () => {
  const calc = new Calculator();
  calc.pressSequence('MENU 8');
  assert.equal(calc.mode, 8);
  assert.deepEqual(lines(calc), [
    '   |    A   |    B   |',
    'A1:'
  ]);
});

test('Spreadsheet Ex 1: Input constants and formula (manual page 34)', () => {
  const calc = new Calculator();
  calc.pressSequence('MENU 8');

  // A1: 7 × 5 = (35, cursor moves to A2)
  calc.pressSequence('7 * 5 =');
  const scr1 = lines(calc);
  assert.ok(scr1.some(l => l.includes('35')));
  assert.ok(scr1[scr1.length - 1].startsWith('A2:'));

  // A2: 7 × 6 = (42, cursor moves to A3)
  calc.pressSequence('7 * 6 =');
  const scr2 = lines(calc);
  assert.ok(scr2.some(l => l.includes('42')));
  assert.ok(scr2[scr2.length - 1].startsWith('A3:'));

  // A3: A2 + 7 = (49, cursor moves to A4)
  calc.pressSequence('A 2 + 7 =');
  const scr3 = lines(calc);
  assert.ok(scr3.some(l => l.includes('49')));
  assert.ok(scr3[scr3.length - 1].startsWith('A4:'));

  // Move to B1 and input =A1+7
  calc.pressSequence('RIGHT UP UP UP');
  assert.ok(lines(calc)[lines(calc).length - 1].startsWith('B1:'));
  calc.pressSequence('== A 1 + 7 =');

  // Inspect B1
  calc.pressSequence('UP');
  assert.equal(lines(calc)[lines(calc).length - 1], 'B1:=A1+7');
  // Check B1 evaluated value is 42 (35 + 7)
  assert.ok(lines(calc).some(l => l.includes('42')));
});

test('Spreadsheet Ex 2: Input formula with Grab command (manual page 35)', () => {
  const calc = new Calculator();
  calc.pressSequence('MENU 8');
  // Setup A2 with 42
  calc.pressSequence('DOWN 4 2 =');

  // Move cursor to B2: UP RIGHT
  calc.pressSequence('UP RIGHT');
  // In B2, use Grab to reference A2: = OPTN 2 (Grab) LEFT EXE + 7 EXE
  calc.pressSequence('== OPTN 2 LEFT = + 7 =');
  calc.pressSequence('UP');
  assert.equal(lines(calc)[lines(calc).length - 1], 'B2:=A2+7');
  assert.ok(lines(calc).some(l => l.includes('49')));
});

test('Spreadsheet Ex 3: Range function Sum(A1:A3) (manual page 36)', () => {
  const calc = new Calculator();
  calc.pressSequence('MENU 8');
  // A1=35, A2=42, A3=49
  calc.pressSequence('3 5 = 4 2 = 4 9 =');
  // Now on A4, input =Sum(A1:A3) via OPTN DOWN 4
  calc.pressSequence('== OPTN DOWN 4 A 1 : A 3 ) =');
  calc.pressSequence('UP');
  assert.equal(lines(calc)[lines(calc).length - 1], 'A4:=Sum(A1:A3)');
  // Sum = 35 + 42 + 49 = 126
  assert.ok(lines(calc).some(l => l.includes('126')));
});

test('Spreadsheet Range functions: Mean, Min, Max', () => {
  const calc = new Calculator();
  calc.pressSequence('MENU 8');
  // A1=10, A2=20, A3=30
  calc.pressSequence('1 0 = 2 0 = 3 0 =');

  // A4: =Mean(A1:A3) -> 20 via OPTN DOWN 3
  calc.pressSequence('== OPTN DOWN 3 A 1 : A 3 ) =');
  calc.pressSequence('UP');
  assert.ok(lines(calc).some(l => l.includes('20')));

  // A5: =Min(A1:A3) -> 10 via OPTN DOWN 1
  calc.pressSequence('DOWN == OPTN DOWN 1 A 1 : A 3 ) =');
  calc.pressSequence('UP');
  assert.ok(lines(calc).some(l => l.includes('10')));

  // A6: =Max(A1:A3) -> 30 via OPTN DOWN 2
  calc.pressSequence('DOWN == OPTN DOWN 2 A 1 : A 3 ) =');
  calc.pressSequence('UP');
  assert.ok(lines(calc).some(l => l.includes('30')));
});

test('Spreadsheet Ex 4: Fill Formula batch input (manual page 37)', () => {
  const calc = new Calculator();
  calc.pressSequence('MENU 8');
  // A1=35, A2=42, A3=49
  calc.pressSequence('3 5 = 4 2 = 4 9 =');

  // Move to B1
  calc.pressSequence('RIGHT UP UP UP');
  assert.ok(lines(calc)[lines(calc).length - 1].startsWith('B1:'));

  // OPTN 1 (Fill Formula), Form: 2A1-3, Range: B1:B3
  calc.pressSequence('OPTN 1 2 A 1 - 3 = B 1 : B 3 =');

  // Check B1 = 2*35 - 3 = 67
  assert.ok(lines(calc).some(l => l.includes('67')));

  // Check B2 = 2*42 - 3 = 81
  calc.pressSequence('DOWN');
  assert.ok(lines(calc).some(l => l.includes('81')));

  // Check B3 = 2*49 - 3 = 95
  calc.pressSequence('DOWN');
  assert.ok(lines(calc).some(l => l.includes('95')));
});

test('Spreadsheet Ex 5: Fill Value batch input (manual page 37)', () => {
  const calc = new Calculator();
  calc.pressSequence('MENU 8');
  // B1=67, B2=81, B3=95
  calc.pressSequence('RIGHT 6 7 = 8 1 = 9 5 =');

  // Move to C1
  calc.pressSequence('RIGHT UP UP UP');
  assert.ok(lines(calc)[lines(calc).length - 1].startsWith('C1:'));

  // OPTN 2 (Fill Value), Value: B1*3, Range: C1:C3
  calc.pressSequence('OPTN 2 B 1 * 3 = C 1 : C 3 =');

  // Check C1 = 67 * 3 = 201
  assert.ok(lines(calc).some(l => l.includes('201')));
  // Check C2 = 81 * 3 = 243
  calc.pressSequence('DOWN');
  assert.ok(lines(calc).some(l => l.includes('243')));
  // Check C3 = 95 * 3 = 285
  calc.pressSequence('DOWN');
  assert.ok(lines(calc).some(l => l.includes('285')));
});

test('Spreadsheet Copy & Paste with relative and absolute references', () => {
  const calc = new Calculator();
  calc.pressSequence('MENU 8');
  // A1 = 10
  calc.pressSequence('1 0 =');

  // B1 = =$A$1 + A1
  calc.pressSequence('RIGHT UP == $ A $ 1 + A 1 =');

  // Copy B1 -> paste into C2
  calc.pressSequence('UP OPTN DOWN 2'); // Copy & Paste standby
  calc.pressSequence('RIGHT DOWN = AC'); // Move to C2, paste, cancel standby

  // In C2, =$A$1 stayed absolute, A1 shifted to B2
  assert.equal(lines(calc)[lines(calc).length - 1], 'C2:=$A$1+B2');
});

test('Spreadsheet Cut & Paste clears source and preserves exact formula', () => {
  const calc = new Calculator();
  calc.pressSequence('MENU 8');
  // A1 = =B1+5
  calc.pressSequence('== B 1 + 5 = UP');
  assert.equal(lines(calc)[lines(calc).length - 1], 'A1:=B1+5');

  // Cut & Paste to A3
  calc.pressSequence('OPTN DOWN 1 DOWN DOWN =');
  assert.equal(lines(calc)[lines(calc).length - 1], 'A3:=B1+5');

  // Check source A1 is cleared
  calc.pressSequence('UP UP');
  assert.equal(lines(calc)[lines(calc).length - 1], 'A1:');
});

test('Spreadsheet DEL clears single cell, Delete All clears grid', () => {
  const calc = new Calculator();
  calc.pressSequence('MENU 8');
  calc.pressSequence('1 2 3 =');
  assert.ok(lines(calc).some(l => l.includes('123')));

  // Move back to A1 and DEL
  calc.pressSequence('UP DEL');
  assert.ok(!lines(calc).some(l => l.includes('123')));

  // Add data to A1 and B2, then Delete All
  calc.pressSequence('5 5 = RIGHT 9 9 =');
  assert.ok(lines(calc).some(l => l.includes('99')));
  calc.pressSequence('OPTN DOWN 3');
  assert.deepEqual(lines(calc), [
    '   |    A   |    B   |',
    'A1:'
  ]);
});

test('Spreadsheet Free Space display via OPTN 4', () => {
  const calc = new Calculator();
  calc.pressSequence('MENU 8');
  calc.pressSequence('OPTN 4');
  assert.deepEqual(lines(calc), [
    'Free Space',
    '1700 Bytes'
  ]);
  calc.pressSequence('AC');
  assert.ok(lines(calc)[0].includes('A'));
});

test('Spreadsheet Auto Calc Off and manual Recalculate', () => {
  const calc = new Calculator();
  calc.pressSequence('MENU 8');
  // Set Auto Calc Off: SHIFT MENU DOWN 4 1 2
  calc.pressSequence('SHIFT MENU DOWN 4 1 2');

  // A1 = 10
  calc.pressSequence('1 0 =');
  // B1 = =A1*2 (initially 20)
  calc.pressSequence('RIGHT UP == A 1 * 2 = UP');
  assert.ok(lines(calc).some(l => l.includes('20')));

  // Now change A1 to 50
  calc.pressSequence('LEFT 5 0 =');

  // Check B1: with Auto Calc OFF, B1 has not recalculated yet
  calc.pressSequence('RIGHT UP');
  assert.ok(lines(calc).some(l => l.includes('20')));

  // Manually Recalculate: OPTN DOWN 4
  calc.pressSequence('OPTN DOWN 4');
  // Now B1 has recomputed to 100
  assert.ok(lines(calc).some(l => l.includes('100')));
});

test('Spreadsheet Show Cell: Formula vs Value', () => {
  const calc = new Calculator();
  calc.pressSequence('MENU 8');
  calc.pressSequence('== 2 + 3 = UP');
  // Default Show Cell: Formula -> edit bar shows '=2+3'
  assert.equal(lines(calc)[lines(calc).length - 1], 'A1:=2+3');

  // Change Show Cell to Value: SHIFT MENU DOWN 4 2 2
  calc.pressSequence('SHIFT MENU DOWN 4 2 2');
  assert.equal(lines(calc)[lines(calc).length - 1], 'A1:5');

  // Change back to Formula: SHIFT MENU DOWN 4 2 1
  calc.pressSequence('SHIFT MENU DOWN 4 2 1');
  assert.equal(lines(calc)[lines(calc).length - 1], 'A1:=2+3');
});

test('Spreadsheet Circular ERROR on self and indirect reference cycles', () => {
  const calc = new Calculator();
  calc.pressSequence('MENU 8');

  // Direct cycle: A1 = =A1+1
  calc.pressSequence('== A 1 + 1 =');
  assert.deepEqual(lines(calc), ['Circular ERROR', '[AC] :Cancel']);
  calc.pressSequence('AC');
  assert.equal(lines(calc)[lines(calc).length - 1], 'A1:');

  // Indirect cycle: A1 = =B1, B1 = =A1
  calc.pressSequence('== B 1 =');
  calc.pressSequence('RIGHT UP == A 1 =');
  assert.deepEqual(lines(calc), ['Circular ERROR', '[AC] :Cancel']);
});

test('Spreadsheet Memory ERROR on capacity limit', () => {
  const calc = new Calculator();
  calc.pressSequence('MENU 8');
  // Fill entire grid A1:E45 (225 cells) with formulas exceeding 1700 bytes
  calc.pressSequence('OPTN 1 2 x² = A 1 : E 4 5 =');
  assert.deepEqual(lines(calc), ['Memory ERROR', '[AC] :Cancel']);
  calc.pressSequence('AC');
  assert.equal(lines(calc)[lines(calc).length - 1], 'A1:');
});

test('Spreadsheet STO assigns cell value to memory variable', () => {
  const calc = new Calculator();
  calc.pressSequence('MENU 8');
  calc.pressSequence('7 * 5 = UP');
  // Assign A1 (35) to variable A: STO A
  calc.pressSequence('STO A');
  assert.equal(calc.memory.getVar('A').toDecimal15().toString(), '35');
});

test('Spreadsheet navigation across all 5 columns and 45 rows with scrolling', () => {
  const calc = new Calculator();
  calc.pressSequence('MENU 8');

  // Move right to column E
  calc.pressSequence('RIGHT RIGHT RIGHT RIGHT');
  assert.ok(lines(calc)[lines(calc).length - 1].startsWith('E1:'));
  // Moving right again stays at E
  calc.pressSequence('RIGHT');
  assert.ok(lines(calc)[lines(calc).length - 1].startsWith('E1:'));

  // Move left back to A
  calc.pressSequence('LEFT LEFT LEFT LEFT');
  assert.ok(lines(calc)[lines(calc).length - 1].startsWith('A1:'));

  // Move down to row 45
  for (let i = 0; i < 44; i++) calc.pressSequence('DOWN');
  assert.ok(lines(calc)[lines(calc).length - 1].startsWith('A45:'));
  // Down at 45 stays at 45
  calc.pressSequence('DOWN');
  assert.ok(lines(calc)[lines(calc).length - 1].startsWith('A45:'));
});
