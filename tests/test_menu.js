import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../js/core/Calculator.js';

describe('Prompt 20 — MENU screen (mode icons)', () => {
  it('opens MENU screen displaying mode icon grid and 1:Calculate', () => {
    const calc = new Calculator();
    calc.press('MENU');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines.length, 3);
    assert.ok(scr.lines[0].includes('[Calculate]'));
    assert.ok(scr.lines[0].includes('Complex'));
    assert.ok(scr.lines[1].includes('Vector'));
    assert.strictEqual(scr.lines[2], '1:Calculate');
    // Status bar indicators should be cleared on MENU screen
    assert.deepStrictEqual(scr.indicators, []);
  });

  it('navigates with RIGHT arrow wrapping across modes', () => {
    const calc = new Calculator();
    calc.press('MENU');
    calc.press('RIGHT');
    assert.strictEqual(calc.getScreen().lines[2], '2:Complex');
    calc.press('RIGHT');
    assert.strictEqual(calc.getScreen().lines[2], '3:Base-N');
    calc.press('RIGHT');
    assert.strictEqual(calc.getScreen().lines[2], '4:Matrix');
    calc.press('RIGHT');
    assert.strictEqual(calc.getScreen().lines[2], '5:Vector');
  });

  it('navigates with DOWN arrow column-wise and wraps from row 2 to row 0', () => {
    const calc = new Calculator();
    calc.press('MENU');
    // Down from Mode 1 (col 0, row 0) -> Mode 5 (col 0, row 1)
    calc.press('DOWN');
    assert.strictEqual(calc.getScreen().lines[2], '5:Vector');
    // Down from Mode 5 -> Mode 9 (col 0, row 2)
    calc.press('DOWN');
    assert.strictEqual(calc.getScreen().lines[2], '9:Table');
    // Down from Mode 9 wraps to Mode 1 (col 0, row 0)
    calc.press('DOWN');
    assert.strictEqual(calc.getScreen().lines[2], '1:Calculate');
  });

  it('navigates with UP arrow column-wise and wraps from row 0 to row 2', () => {
    const calc = new Calculator();
    calc.press('MENU');
    // Up from Mode 1 wraps to Mode 9 (col 0, row 2)
    calc.press('UP');
    assert.strictEqual(calc.getScreen().lines[2], '9:Table');
    calc.press('UP');
    assert.strictEqual(calc.getScreen().lines[2], '5:Vector');
    calc.press('UP');
    assert.strictEqual(calc.getScreen().lines[2], '1:Calculate');
  });

  it('navigates with LEFT arrow wrapping from Mode 1 to Mode 12 (Ratio)', () => {
    const calc = new Calculator();
    calc.press('MENU');
    calc.press('LEFT');
    assert.strictEqual(calc.getScreen().lines[2], 'C:Ratio');
    calc.press('LEFT');
    assert.strictEqual(calc.getScreen().lines[2], 'B:Inequality');
    calc.press('LEFT');
    assert.strictEqual(calc.getScreen().lines[2], 'A:Equation/Func');
  });

  it('scrolls the 2 visible rows when navigating to row 2', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU DOWN DOWN');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[2], '9:Table');
    // Visible rows should now be Row 1 (Vector..) and Row 2 (Table..)
    assert.ok(scr.lines[0].includes('Vector'));
    assert.ok(scr.lines[1].includes('[Table]'));
  });

  it('enters highlighted mode with EXE or =', () => {
    const calc = new Calculator();
    calc.pressSequence('MENU RIGHT =');
    assert.strictEqual(calc.mode, 2); // Complex
    assert.strictEqual(calc.views.length, 0);

    calc.pressSequence('MENU DOWN EXE');
    assert.strictEqual(calc.mode, 6); // Statistics
  });

  it('jumps directly to modes 1–9 using number keys', () => {
    for (let m = 1; m <= 9; m++) {
      const calc = new Calculator();
      calc.pressSequence(`MENU ${m}`);
      assert.strictEqual(calc.mode, m, `Expected mode ${m}`);
      assert.strictEqual(calc.views.length, 0);
    }
  });

  it('jumps directly to modes A, B, C using letter keys and calculator physical keys', () => {
    // Mode 10: Equation/Func (A / (-))
    let calc = new Calculator();
    calc.pressSequence('MENU A');
    assert.strictEqual(calc.mode, 10);

    calc = new Calculator();
    calc.pressSequence('MENU (-)');
    assert.strictEqual(calc.mode, 10);

    // Mode 11: Inequality (B / DEG)
    calc = new Calculator();
    calc.pressSequence('MENU B');
    assert.strictEqual(calc.mode, 11);

    calc = new Calculator();
    calc.pressSequence('MENU DEG');
    assert.strictEqual(calc.mode, 11);

    // Mode 12: Ratio (C / INV)
    calc = new Calculator();
    calc.pressSequence('MENU C');
    assert.strictEqual(calc.mode, 12);

    calc = new Calculator();
    calc.pressSequence('MENU INV');
    assert.strictEqual(calc.mode, 12);
  });

  it('dismisses MENU with AC key without changing mode', () => {
    const calc = new Calculator();
    calc.setMode(3); // Base-N
    calc.pressSequence('MENU RIGHT AC');
    assert.strictEqual(calc.mode, 3);
    assert.strictEqual(calc.views.length, 0);
  });

  it('toggles / closes MENU when pressing MENU again', () => {
    const calc = new Calculator();
    calc.setMode(2); // Complex
    calc.pressSequence('MENU MENU');
    assert.strictEqual(calc.mode, 2);
    assert.strictEqual(calc.views.length, 0);
  });

  it('retains Ans, variables, and independent memory M across mode changes', () => {
    const calc = new Calculator();
    calc.pressSequence('5 STO (-) 1 0 STO M_PLUS 1 + 2 =');
    assert.strictEqual(calc.memory.getAns().value.toString(), '3');
    assert.strictEqual(calc.memory.getVar('A').value.toString(), '5');
    assert.strictEqual(calc.memory.getVar('M').value.toString(), '10');

    // Change to Mode 2 (Complex)
    calc.pressSequence('MENU 2');
    assert.strictEqual(calc.mode, 2);
    assert.strictEqual(calc.memory.getAns().value.toString(), '3');
    assert.strictEqual(calc.memory.getVar('A').value.toString(), '5');
    assert.strictEqual(calc.memory.getVar('M').value.toString(), '10');
    assert.ok(calc.indicators().includes('M'));
  });

  it('renders authentic LCD pixel layout: 48x24 cells and 15px bottom bar', () => {
    const calc = new Calculator();
    calc.press('MENU');
    const scr = calc.getScreen();
    assert.strictEqual(scr.pixels.length, 192 * 63);

    // Check bottom bar background is dark (1) at y=48..62
    // Bottom bar x=0..191, y=48..62
    const pixel = (x, y) => scr.pixels[y * 192 + x];
    assert.strictEqual(pixel(0, 48), 1);
    assert.strictEqual(pixel(191, 48), 1);
    assert.strictEqual(pixel(0, 62), 1);

    // Selected cell 0 (x=0..47, y=0..23) is inverted: top-left interior (x=1, y=1) should be light (0)
    assert.strictEqual(pixel(1, 1), 0);

    // Unselected cell 1 (x=48..95, y=0..23) has dark background: interior (x=49, y=1) should be dark (1)
    assert.strictEqual(pixel(49, 1), 1);
  });
});
