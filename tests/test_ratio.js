import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../js/core/Calculator.js';
import { RatioApp } from '../js/core/modes/ratio/RatioApp.js';

describe('Prompt 31 — Ratio Mode (MENU C)', () => {
  it('1. Enters Ratio mode via MENU C and shows Ratio Type Selection Screen', () => {
    const calc = new Calculator();
    calc.pressSequence(['MENU', 'C']);
    const scr = calc.getScreen();
    assert.equal(scr.lines[0], 'Ratio');
    assert.equal(scr.lines[1], '1:A:B=X:D');
    assert.equal(scr.lines[2], '2:A:B=C:X');
    assert.ok(calc.app instanceof RatioApp);
    assert.equal(calc.app.phase, 'type_select');
  });

  it('2. Selects Type 1 (A:B=X:D) with key 1 and initializes coefficients to 1', () => {
    const calc = new Calculator();
    calc.pressSequence(['MENU', 'C', '1']);
    const scr = calc.getScreen();
    assert.equal(calc.app.phase, 'editor');
    assert.equal(calc.app.type, 1);
    assert.deepEqual(scr.lines, ['1:1=X:1', 'A=1']);
  });

  it('3. Selects Type 2 (A:B=C:X) with key 2 and initializes coefficients to 1', () => {
    const calc = new Calculator();
    calc.pressSequence(['MENU', 'C', '2']);
    const scr = calc.getScreen();
    assert.equal(calc.app.phase, 'editor');
    assert.equal(calc.app.type, 2);
    assert.deepEqual(scr.lines, ['1:1=1:X', 'A=1']);
  });

  it('4. Selects Type using DOWN and EXE arrows', () => {
    const calc = new Calculator();
    calc.pressSequence(['MENU', 'C', 'DOWN', 'EXE']);
    assert.equal(calc.app.type, 2);
    assert.equal(calc.app.phase, 'editor');
  });

  it('5. Solves 1:2=X:10 -> X=5 (Manual Example 1)', () => {
    const calc = new Calculator();
    calc.pressSequence(['MENU', 'C', '1', '1', 'EXE', '2', 'EXE', '1', '0', 'EXE', 'EXE']);
    const scr = calc.getScreen();
    assert.deepEqual(scr.lines, ['X=', '5']);
    assert.equal(calc.memory.getAns().toDecimal15().toString(), '5');
  });

  it('6. Solves 3:8=X:12 -> X=9/2 exact fraction (Manual Example 2)', () => {
    const calc = new Calculator();
    calc.pressSequence(['MENU', 'C', '1', '3', 'EXE', '8', 'EXE', '1', '2', 'EXE', 'EXE']);
    const scr = calc.getScreen();
    assert.deepEqual(scr.lines, ['X=', '9/2']);
  });

  it('7. Toggles exact fraction to decimal with S<=>D (9/2 <-> 4.5)', () => {
    const calc = new Calculator();
    calc.pressSequence(['MENU', 'C', '1', '3', 'EXE', '8', 'EXE', '1', '2', 'EXE', 'EXE']);
    assert.equal(calc.getScreen().lines[1], '9/2');

    calc.press('S<=>D');
    assert.equal(calc.getScreen().lines[1], '4.5');

    calc.press('S<=>D');
    assert.equal(calc.getScreen().lines[1], '9/2');
  });

  it('8. Toggles mixed fraction with SHIFT S<=>D (9/2 -> 4 1/2)', () => {
    const calc = new Calculator();
    calc.pressSequence(['MENU', 'C', '1', '3', 'EXE', '8', 'EXE', '1', '2', 'EXE', 'EXE', 'SHIFT', 'S<=>D']);
    assert.equal(calc.getScreen().lines[1], '4 1/2');
  });

  it('9. Solves Type 2: 2:3=4:X -> X=6', () => {
    const calc = new Calculator();
    calc.pressSequence(['MENU', 'C', '2', '2', 'EXE', '3', 'EXE', '4', 'EXE', 'EXE']);
    assert.deepEqual(calc.getScreen().lines, ['X=', '6']);
  });

  it('10. Solves Type 2 fraction: 2:3=5:X -> X=15/2', () => {
    const calc = new Calculator();
    calc.pressSequence(['MENU', 'C', '2', '2', 'EXE', '3', 'EXE', '5', 'EXE', 'EXE']);
    assert.deepEqual(calc.getScreen().lines, ['X=', '15/2']);
    calc.press('S<=>D');
    assert.equal(calc.getScreen().lines[1], '7.5');
  });

  it('11. Navigates between coefficient slots with LEFT and RIGHT keys', () => {
    const calc = new Calculator();
    calc.pressSequence(['MENU', 'C', '1']);
    assert.equal(calc.getScreen().lines[1], 'A=1');

    calc.press('RIGHT');
    assert.equal(calc.getScreen().lines[1], 'B=1');

    calc.press('RIGHT');
    assert.equal(calc.getScreen().lines[1], 'D=1');

    calc.press('LEFT');
    assert.equal(calc.getScreen().lines[1], 'B=1');

    calc.press('LEFT');
    assert.equal(calc.getScreen().lines[1], 'A=1');
  });

  it('12. Edits coefficient input with DEL', () => {
    const calc = new Calculator();
    calc.pressSequence(['MENU', 'C', '1']);
    calc.pressSequence(['5', '6']);
    assert.equal(calc.getScreen().lines[1], 'A=56');

    calc.press('DEL');
    assert.equal(calc.getScreen().lines[1], 'A=5');

    calc.press('EXE');
    assert.deepEqual(calc.getScreen().lines, ['5:1=X:1', 'B=1']);
  });

  it('13. Pressing AC while typing cancels input and restores previous coefficient', () => {
    const calc = new Calculator();
    calc.pressSequence(['MENU', 'C', '1', '7', 'EXE']); // A=7, now on B
    calc.pressSequence(['9', '9']);
    assert.equal(calc.getScreen().lines[1], 'B=99');

    calc.press('AC'); // Cancel typing
    assert.equal(calc.getScreen().lines[1], 'B=1');
    assert.equal(calc.getScreen().lines[0], '7:1=X:1');
  });

  it('14. Pressing AC when not typing resets all coefficients to 1 per manual', () => {
    const calc = new Calculator();
    calc.pressSequence(['MENU', 'C', '1', '3', 'EXE', '8', 'EXE', '1', '2', 'EXE']);
    assert.equal(calc.getScreen().lines[0], '3:8=X:12');

    calc.press('AC');
    assert.deepEqual(calc.getScreen().lines, ['1:1=X:1', 'A=1']);
  });

  it('15. Triggers Math ERROR when a coefficient is 0', () => {
    const calc = new Calculator();
    calc.pressSequence(['MENU', 'C', '1', '0', 'EXE', '2', 'EXE', '1', '0', 'EXE', 'EXE']);
    const scr = calc.getScreen();
    assert.equal(scr.lines[0], 'Math ERROR');
    assert.equal(scr.lines[1], '[AC] :Cancel');
    assert.equal(scr.lines[2], '[◀][▶]:Goto');
  });

  it('16. Goto from Math ERROR returns cursor to the zero coefficient', () => {
    const calc = new Calculator();
    // Set A=1, B=0, D=10
    calc.pressSequence(['MENU', 'C', '1', '1', 'EXE', '0', 'EXE', '1', '0', 'EXE', 'EXE']);
    assert.equal(calc.app.phase, 'error');

    // Press RIGHT to Goto
    calc.press('RIGHT');
    assert.equal(calc.app.phase, 'editor');
    assert.equal(calc.app.slot, 1); // Slot 1 is B
    assert.equal(calc.getScreen().lines[1], 'B=0');
  });

  it('17. Supports negative coefficients: (-3):8=X:12 -> X=-9/2', () => {
    const calc = new Calculator();
    calc.pressSequence(['MENU', 'C', '1', '(-)', '3', 'EXE', '8', 'EXE', '1', '2', 'EXE', 'EXE']);
    assert.deepEqual(calc.getScreen().lines, ['X=', '−9/2']);
  });

  it('18. Decimal output when setup is MathI/DecimalO', () => {
    const calc = new Calculator({ setup: { inputOutput: 'MathI/DecimalO' } });
    calc.pressSequence(['MENU', 'C', '1', '3', 'EXE', '8', 'EXE', '1', '2', 'EXE', 'EXE']);
    assert.deepEqual(calc.getScreen().lines, ['X=', '4.5']);
  });

  it('19. Pressing EXE on result screen returns to editor preserving values', () => {
    const calc = new Calculator();
    calc.pressSequence(['MENU', 'C', '1', '1', 'EXE', '2', 'EXE', '1', '0', 'EXE', 'EXE']);
    assert.deepEqual(calc.getScreen().lines, ['X=', '5']);

    calc.press('EXE');
    assert.deepEqual(calc.getScreen().lines, ['1:2=X:10', 'D=10']);
  });

  it('20. Stores solution to variable with STO A', () => {
    const calc = new Calculator();
    calc.pressSequence(['MENU', 'C', '1', '1', 'EXE', '2', 'EXE', '1', '0', 'EXE', 'EXE']);
    assert.equal(calc.getScreen().lines[1], '5');

    calc.pressSequence(['STO', 'A']);
    assert.equal(calc.memory.getVar('A').toDecimal15().toString(), '5');
  });

  it('21. Switches ratio expression type via OPTN 1', () => {
    const calc = new Calculator();
    calc.pressSequence(['MENU', 'C', '1', '1', 'EXE', '2', 'EXE']);
    assert.equal(calc.app.type, 1);

    calc.pressSequence(['OPTN', '1']);
    assert.equal(calc.app.phase, 'type_select');

    calc.press('2');
    assert.equal(calc.app.type, 2);
    assert.deepEqual(calc.getScreen().lines, ['1:1=1:X', 'A=1']);
  });

  it('22. Exports and imports state preserving Ratio mode', () => {
    const calc = new Calculator();
    calc.pressSequence(['MENU', 'C', '1', '3', 'EXE', '8', 'EXE']);
    const state = calc.exportState();

    const calc2 = new Calculator();
    calc2.importState(state);
    assert.equal(calc2.mode, 12);
    assert.equal(calc2.app.type, 1);
  });
});
