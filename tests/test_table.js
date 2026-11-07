import test from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../js/core/Calculator.js';
import { ROW_LIMIT, rowCount, cellText, formatCellValue, formatFullValue } from '../js/core/modes/table/cells.js';
import { ExactValue } from '../js/core/exact/ExactValue.js';
import { Decimal15 } from '../js/core/number/Decimal15.js';

function lines(calc) {
  return calc.getScreen().lines;
}

test('Prompt 28 — Table Mode (MENU 9)', async (t) => {
  await t.test('1. Table mode entry and default state', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU 9');
    assert.strictEqual(calc.mode, 9);
    assert.strictEqual(lines(calc)[0], 'f(x)=');
    const inds = calc.indicators();
    assert.ok(inds.includes('Math'));
    assert.ok(inds.includes('D'));
  });

  await t.test('2. f(x) only mode (SETUP Table = 1:f(x))', () => {
    const calc = new Calculator({ setup: { table: 'F' } });
    calc.pressSequence('MENU 9 x x² =');
    // Advances directly to Table Range screen
    const scrLines = lines(calc);
    assert.strictEqual(scrLines[0], 'Table Range');
    assert.strictEqual(scrLines[1], 'Start :1');
    assert.strictEqual(scrLines[2], 'End   :5');
    assert.strictEqual(scrLines[3], 'Step  :1');
  });

  await t.test('3. f(x) and g(x) mode (SETUP Table = 2:f(x),g(x))', () => {
    const calc = new Calculator({ setup: { table: 'FG' } });
    calc.pressSequence('MENU 9 x x² =');
    // First prompt was f(x), now on g(x)
    assert.strictEqual(lines(calc)[0], 'g(x)=');
    assert.ok(calc.indicators().includes('Up'));

    // UP returns to f(x)
    calc.press('UP');
    assert.strictEqual(lines(calc)[0], 'f(x)=x²');

    // DOWN goes back to g(x)
    calc.press('DOWN');
    assert.strictEqual(lines(calc)[0], 'g(x)=');

    // Input g(x) = 2x and submit
    calc.pressSequence('2 x =');
    assert.strictEqual(lines(calc)[0], 'Table Range');
  });

  await t.test('4. Leaving g(x) empty generates table for f(x) only', () => {
    const calc = new Calculator({ setup: { table: 'FG' } });
    calc.pressSequence('MENU 9 x x² = = = = =');
    // Generates table with 2 columns: x and f(x)
    const scrLines = lines(calc);
    assert.strictEqual(scrLines[0], 'x f(x)');
    assert.strictEqual(scrLines[1], '1 1 1');
  });

  await t.test('5. Table Range navigation with UP and DOWN', () => {
    const calc = new Calculator({ setup: { table: 'F' } });
    calc.pressSequence('MENU 9 x =');
    assert.strictEqual(lines(calc)[0], 'Table Range');

    // Down moves to End
    calc.press('DOWN');
    assert.ok(calc.indicators().includes('Up'));
    assert.ok(calc.indicators().includes('Down'));

    // Down moves to Step
    calc.press('DOWN');
    assert.ok(calc.indicators().includes('Up'));
    assert.ok(!calc.indicators().includes('Down'));

    // Up moves back to End
    calc.press('UP');
    assert.ok(calc.indicators().includes('Down'));
  });

  await t.test('6. Inputting Start, End, Step values', () => {
    const calc = new Calculator({ setup: { table: 'F' } });
    // f(x)=x, Start=-1, End=1, Step=0.5
    calc.pressSequence('MENU 9 x = (-) 1 = 1 = 0 . 5 =');
    const scrLines = lines(calc);
    assert.strictEqual(scrLines[0], 'x f(x)');
    assert.strictEqual(scrLines[1], '1 −1 −1');
    assert.strictEqual(scrLines[2], '2 −0.5 −0.5');
    assert.strictEqual(scrLines[3], '3 0 0');
  });

  await t.test('7. Row limit 45 for f(x) only', () => {
    const calc = new Calculator({ setup: { table: 'F' } });
    // Start=1, End=45, Step=1 -> 45 rows
    calc.pressSequence('MENU 9 x = 1 = 4 5 = 1 =');
    assert.strictEqual(lines(calc)[0], 'x f(x)');

    // Start=1, End=46, Step=1 -> 46 rows -> Range ERROR
    const calc2 = new Calculator({ setup: { table: 'F' } });
    calc2.pressSequence('MENU 9 x = 1 = 4 6 = 1 =');
    assert.deepEqual(lines(calc2), ['Range ERROR', '[AC] :Cancel']);
  });

  await t.test('8. Row limit 30 for two functions f(x) and g(x)', () => {
    const calc = new Calculator({ setup: { table: 'FG' } });
    // Two functions, Start=1, End=30, Step=1 -> 30 rows -> OK
    calc.pressSequence('MENU 9 x = x = 1 = 3 0 = 1 =');
    assert.strictEqual(lines(calc)[0], 'x f(x) g(x)');

    // Two functions, Start=1, End=31, Step=1 -> 31 rows -> Range ERROR
    const calc2 = new Calculator({ setup: { table: 'FG' } });
    calc2.pressSequence('MENU 9 x = x = 1 = 3 1 = 1 =');
    assert.deepEqual(lines(calc2), ['Range ERROR', '[AC] :Cancel']);
  });

  await t.test('9. Step = 0 throws Range ERROR', () => {
    const calc = new Calculator({ setup: { table: 'F' } });
    calc.pressSequence('MENU 9 x = 1 = 5 = 0 =');
    assert.deepEqual(lines(calc), ['Range ERROR', '[AC] :Cancel']);
  });

  await t.test('10. Decreasing range with positive step throws Range ERROR', () => {
    const calc = new Calculator({ setup: { table: 'F' } });
    calc.pressSequence('MENU 9 x = 5 = 1 = 1 =');
    assert.deepEqual(lines(calc), ['Range ERROR', '[AC] :Cancel']);
  });

  await t.test('11. Range ERROR recovery via AC returns to Table Range', () => {
    const calc = new Calculator({ setup: { table: 'F' } });
    calc.pressSequence('MENU 9 x = 1 = 1 0 0 = 1 =');
    assert.deepEqual(lines(calc), ['Range ERROR', '[AC] :Cancel']);

    // Press AC to dismiss error and return to Table Range
    calc.press('AC');
    assert.strictEqual(lines(calc)[0], 'Table Range');
  });

  await t.test('12. User Guide p. 28 worked example (two functions)', () => {
    // f(x) = x² + 1/2, g(x) = x² - 1/2, range -1 <= x <= 1, step 0.5
    const calc = new Calculator({ setup: { table: 'FG', inputOutput: 'MathI/MathO' } });
    calc.pressSequence('MENU 9');
    calc.pressSequence('x x² + 1 / 2 =');
    calc.pressSequence('x x² - 1 / 2 =');
    calc.pressSequence('(-) 1 = 1 = 0 . 5 =');

    const scrLines = lines(calc);
    assert.strictEqual(scrLines[0], 'x f(x) g(x)');
    // Row 1: x = -1, f(-1) = 1.5, g(-1) = 0.5
    assert.strictEqual(scrLines[1], '1 −1 1.5 0.5');
    // Row 2: x = -0.5, f(-0.5) = 0.75, g(-0.5) = -0.25
    assert.strictEqual(scrLines[2], '2 −0.5 0.75 −0.25');
    // Row 3: x = 0, f(0) = 0.5, g(0) = -0.5
    assert.strictEqual(scrLines[3], '3 0 0.5 −0.5');
    // Bottom line shows highlighted cell (x = -1)
    assert.strictEqual(scrLines[4], '−1');
  });

  await t.test('13. Table scrolling and active cell value display', () => {
    const calc = new Calculator({ setup: { table: 'F' } });
    calc.pressSequence('MENU 9 x x² = = = =');

    // Initially at row 1, col 0 (x=1)
    assert.strictEqual(lines(calc)[4], '1');

    // DOWN to row 2
    calc.press('DOWN');
    assert.strictEqual(lines(calc)[4], '2');

    // RIGHT to col 1 (f(x) column on row 2, f(2) = 4)
    calc.press('RIGHT');
    assert.strictEqual(lines(calc)[4], '4');

    // DOWN to row 3 (f(3) = 9)
    calc.press('DOWN');
    assert.strictEqual(lines(calc)[4], '9');

    // LEFT back to col 0 (x = 3)
    calc.press('LEFT');
    assert.strictEqual(lines(calc)[4], '3');
  });

  await t.test('14. Editing an x value and instant recalculation', () => {
    const calc = new Calculator({ setup: { table: 'F' } });
    calc.pressSequence('MENU 9 x x² = = = =');
    // Row 1: x = 1, f(1) = 1
    assert.strictEqual(lines(calc)[1], '1 1 1');

    // Edit x on row 1 to 10
    calc.pressSequence('1 0 =');
    assert.strictEqual(lines(calc)[1], '1 10 100');
    assert.strictEqual(lines(calc)[4], '10');

    // Variable x in calculator memory is updated
    assert.strictEqual(calc.memory.getVar('x').toDecimal15().toString(), '10');
  });

  await t.test('15. Shortcut + and - on x cell (Guide p. 28-29 tip)', () => {
    const calc = new Calculator({ setup: { table: 'F' } });
    // f(x) = 2x, Start = 1, End = 5, Step = 2
    calc.pressSequence('MENU 9 2 x = 1 = 5 = 2 =');
    // Row 1: x = 1, f(x) = 2. Row 2: x = 3, f(x) = 6.
    assert.strictEqual(lines(calc)[1], '1 1 2');
    assert.strictEqual(lines(calc)[2], '2 3 6');

    // Move to row 2
    calc.press('DOWN');
    // Press + : cell above is 1, step is 2 -> 1 + 2 = 3
    calc.press('+');
    assert.strictEqual(lines(calc)[2], '2 3 6');

    // Press - : cell above is 1, step is 2 -> 1 - 2 = -1, f(-1) = -2
    calc.press('-');
    assert.strictEqual(lines(calc)[2], '2 −1 −2');
  });

  await t.test('16. Cell errors (Math ERROR in individual cell, no crash)', () => {
    const calc = new Calculator({ setup: { table: 'F' } });
    // f(x) = 1/x, Start = 0, End = 2, Step = 1
    calc.pressSequence('MENU 9 1 / x = 0 = 2 = 1 =');
    const scrLines = lines(calc);
    // Row 1 at x = 0 has division by zero -> ERROR in cell
    assert.strictEqual(scrLines[1], '1 0 ERROR');
    // Row 2 at x = 1 is normal -> 1
    assert.strictEqual(scrLines[2], '2 1 1');
    // Row 3 at x = 2 is normal -> 0.5
    assert.strictEqual(scrLines[3], '3 2 0.5');

    // Highlighting ERROR cell shows ERROR on bottom line
    calc.press('RIGHT');
    assert.strictEqual(lines(calc)[4], 'ERROR');
  });

  await t.test('17. Cell math domain error (sqrt of negative x)', () => {
    const calc = new Calculator({ setup: { table: 'F' } });
    // f(x) = √x, Start = -1, End = 1, Step = 1
    calc.pressSequence('MENU 9 √ x = (-) 1 = 1 = 1 =');
    const scrLines = lines(calc);
    assert.strictEqual(scrLines[1], '1 −1 ERROR');
    assert.strictEqual(scrLines[2], '2 0 0');
    assert.strictEqual(scrLines[3], '3 1 1');
  });

  await t.test('18. Pressing AC in table returns to f(x) screen', () => {
    const calc = new Calculator({ setup: { table: 'F' } });
    calc.pressSequence('MENU 9 x x² = = = =');
    assert.strictEqual(lines(calc)[0], 'x f(x)');

    // Press AC to return to f(x) editor
    calc.press('AC');
    assert.strictEqual(lines(calc)[0], 'f(x)=x²');

    // Modifying f(x) and regenerating table
    calc.pressSequence('+ 1 = = = =');
    // Row 1: x=1, f(1) = 1² + 1 = 2
    assert.strictEqual(lines(calc)[1], '1 1 2');
  });

  await t.test('19. State export and import (persistence)', () => {
    const calc = new Calculator({ setup: { table: 'F' } });
    calc.pressSequence('MENU 9 x x² = 1 = 3 = 1 =');
    assert.strictEqual(lines(calc)[0], 'x f(x)');

    const state = calc.exportState();
    const calc2 = new Calculator();
    calc2.importState(state);
    assert.strictEqual(calc2.mode, 9);
    assert.strictEqual(lines(calc2)[0], 'x f(x)');
    assert.strictEqual(lines(calc2)[1], '1 1 1');
  });

  await t.test('20. Table mode modifies variable x in memory', () => {
    const calc = new Calculator({ setup: { table: 'F' } });
    // Start = 3, End = 5, Step = 1
    calc.pressSequence('MENU 9 x x² = 3 = 5 = 1 =');
    // Selected row is row 1 with x = 3
    assert.strictEqual(calc.memory.getVar('x').toDecimal15().toString(), '3');

    // Move down to row 2 with x = 4
    calc.press('DOWN');
    assert.strictEqual(calc.memory.getVar('x').toDecimal15().toString(), '4');

    // Exit to Calculate mode (MENU 1) and recall variable x
    calc.pressSequence('MENU 1 x =');
    assert.strictEqual(lines(calc)[1], '4');
  });
});
