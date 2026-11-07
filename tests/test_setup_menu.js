/**
 * Unit tests for SETUP Menu (Prompt 16).
 * Tests all 4 pages, 16 options, submenus, prompts, status indicators,
 * arrow pagination, back navigation, AC dismissal, and contrast adjustments.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../js/core/Calculator.js';

describe('SETUP Menu Structure and Pagination', () => {
  it('opens SETUP menu on SHIFT MENU with Page 1 items and scroll bar (no ▼ icon)', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU');
    assert.equal(calc.topView.constructor.name, 'MenuView');
    const lines = calc.renderLines();
    assert.deepEqual(lines, [
      '1:Input/Output',
      '2:Angle Unit',
      '3:Number Format',
      '4:Engineer Symbol'
    ]);
    const inds = calc.indicators();
    assert.ok(!inds.includes('Down')); // official: scroll bar, no ▲▼ icon
    assert.ok(!inds.includes('Up')); // official: scroll bar, no ▲▼ icon
  });

  it('scrolls to Page 2 (scroll bar, no ▲▼ icons)', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU DOWN');
    const lines = calc.renderLines();
    assert.deepEqual(lines, [
      '1:Fraction Result',
      '2:Complex',
      '3:Statistics',
      '4:Spreadsheet'
    ]);
    const inds = calc.indicators();
    assert.ok(!inds.includes('Down')); // official: scroll bar, no ▲▼ icon
    assert.ok(!inds.includes('Up')); // official: scroll bar, no ▲▼ icon
  });

  it('scrolls to Page 3 (scroll bar, no ▲▼ icons)', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU DOWN DOWN');
    const lines = calc.renderLines();
    assert.deepEqual(lines, [
      '1:Equation/Func',
      '2:Table',
      '3:Decimal Mark',
      '4:Digit Separator'
    ]);
    const inds = calc.indicators();
    assert.ok(!inds.includes('Down')); // official: scroll bar, no ▲▼ icon
    assert.ok(!inds.includes('Up')); // official: scroll bar, no ▲▼ icon
  });

  it('scrolls to Page 4 (scroll bar, no ▲ icon)', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU DOWN DOWN DOWN');
    const lines = calc.renderLines();
    assert.deepEqual(lines, [
      '1:MultiLine Font',
      '2:QR Code',
      '3:Contrast',
      '4:Auto Power Off'
    ]);
    const inds = calc.indicators();
    assert.ok(!inds.includes('Up')); // official: scroll bar, no ▲▼ icon
    assert.ok(!inds.includes('Down')); // official: scroll bar, no ▲▼ icon
  });

  it('wraps from Page 4 to Page 1 when DOWN is pressed', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU DOWN DOWN DOWN DOWN');
    const lines = calc.renderLines();
    assert.equal(lines[0], '1:Input/Output');
    assert.ok(!calc.indicators().includes('Down')); // official: scroll bar, no ▲▼ icon
    assert.ok(!calc.indicators().includes('Up')); // official: scroll bar, no ▲▼ icon
  });

  it('wraps from Page 1 to Page 4 when UP is pressed', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU UP');
    const lines = calc.renderLines();
    assert.equal(lines[0], '1:MultiLine Font');
    assert.ok(!calc.indicators().includes('Up')); // official: scroll bar, no ▲▼ icon
    assert.ok(!calc.indicators().includes('Down')); // official: scroll bar, no ▲▼ icon
  });

  it('closes SETUP menu with AC key', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU AC');
    assert.equal(calc.topView.constructor.name, 'CalcApp');
  });
});

describe('Page 1 Submenus & Option Execution', () => {
  it('1: Input/Output - changes to LineI/LineO and turns Math indicator off', () => {
    const calc = new Calculator();
    assert.ok(calc.indicators().includes('Math'));
    calc.pressSequence('SHIFT MENU 1'); // open Input/Output submenu
    const subLines = calc.renderLines();
    assert.deepEqual(subLines, [
      '1:MathI/MathO',
      '2:MathI/DecimalO',
      '3:LineI/LineO',
      '4:LineI/DecimalO'
    ]);
    calc.press('3'); // select LineI/LineO
    assert.equal(calc.topView.constructor.name, 'CalcApp');
    assert.equal(calc.setup.inputOutput, 'LineI/LineO');
    assert.ok(!calc.indicators().includes('Math'));

    // Output formatted with ┘ symbol
    calc.pressSequence('1 / 2 =');
    assert.equal(calc.renderLines()[1], '1┘2');
  });

  it('1: Input/Output - changes to MathI/DecimalO', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU 1 2');
    assert.equal(calc.setup.inputOutput, 'MathI/DecimalO');
    assert.ok(calc.indicators().includes('Math'));
    calc.pressSequence('1 / 2 =');
    assert.equal(calc.renderLines()[1], '0.5');
  });

  it('2: Angle Unit - sets Radian and Gradian updating status indicators', () => {
    const calc = new Calculator();
    assert.ok(calc.indicators().includes('D'));
    calc.pressSequence('SHIFT MENU 2'); // Angle Unit submenu
    assert.deepEqual(calc.renderLines(), [
      '1:Degree',
      '2:Radian',
      '3:Gradian'
    ]);
    calc.press('2'); // select Radian
    assert.equal(calc.setup.angle, 'RAD');
    assert.ok(calc.indicators().includes('R'));
    assert.ok(!calc.indicators().includes('D'));

    calc.pressSequence('SHIFT MENU 2 3'); // select Gradian
    assert.equal(calc.setup.angle, 'GRA');
    assert.ok(calc.indicators().includes('G'));
    assert.ok(!calc.indicators().includes('R'));

    calc.pressSequence('SHIFT MENU 2 1'); // back to Degree
    assert.equal(calc.setup.angle, 'DEG');
    assert.ok(calc.indicators().includes('D'));
  });

  it('3: Number Format - Fix 0~9 sets FIX indicator and rounds decimals', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU 3'); // Number Format
    assert.deepEqual(calc.renderLines(), ['1:Fix', '2:Sci', '3:Norm']);
    calc.press('1'); // Fix
    assert.equal(calc.renderLines()[0], 'Fix 0~9?');
    calc.press('3'); // Fix 3
    assert.equal(calc.setup.numberFormat.type, 'FIX');
    assert.equal(calc.setup.numberFormat.value, 3);
    assert.ok(calc.indicators().includes('FIX'));

    calc.pressSequence('1 / 7 = S<=>D');
    assert.equal(calc.renderLines()[1], '0.143');
  });

  it('3: Number Format - Sci 0~9 sets SCI indicator', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU 3 2'); // Sci
    assert.equal(calc.renderLines()[0], 'Sci 0~9?');
    calc.press('5'); // Sci 5
    assert.equal(calc.setup.numberFormat.type, 'SCI');
    assert.equal(calc.setup.numberFormat.value, 5);
    assert.ok(calc.indicators().includes('SCI'));
    assert.ok(!calc.indicators().includes('FIX'));

    calc.pressSequence('1 / 7 = S<=>D');
    assert.ok(calc.renderLines()[1].startsWith('1.4286'));
  });

  it('3: Number Format - Norm 1~2 clears FIX and SCI indicators', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU 3 1 3'); // set Fix 3
    assert.ok(calc.indicators().includes('FIX'));
    calc.pressSequence('SHIFT MENU 3 3 1'); // set Norm 1
    assert.equal(calc.setup.numberFormat.type, 'NORM');
    assert.equal(calc.setup.numberFormat.value, 1);
    assert.ok(!calc.indicators().includes('FIX'));
    assert.ok(!calc.indicators().includes('SCI'));
  });

  it('4: Engineer Symbol - On turns on E indicator, Off turns off', () => {
    const calc = new Calculator();
    assert.ok(!calc.indicators().includes('E'));
    calc.pressSequence('SHIFT MENU 4'); // Engineer Symbol
    assert.deepEqual(calc.renderLines(), ['1:On', '2:Off']);
    calc.press('1'); // On
    assert.equal(calc.setup.engSymbol, true);
    assert.ok(calc.indicators().includes('E'));

    calc.pressSequence('SHIFT MENU 4 2'); // Off
    assert.equal(calc.setup.engSymbol, false);
    assert.ok(!calc.indicators().includes('E'));
  });
});

describe('Page 2 Submenus & Option Execution', () => {
  it('1: Fraction Result - ab/c outputs mixed fractions', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU DOWN 1'); // Fraction Result
    assert.deepEqual(calc.renderLines(), ['1:ab/c', '2:d/c']);
    calc.press('1'); // ab/c
    assert.equal(calc.setup.fraction, 'MIXED');
    calc.pressSequence('5 / 3 =');
    assert.equal(calc.renderLines()[1], '1 2/3');

    calc.pressSequence('SHIFT MENU DOWN 1 2'); // d/c
    assert.equal(calc.setup.fraction, 'IMPROPER');
    calc.pressSequence('5 / 3 =');
    assert.equal(calc.renderLines()[1], '5/3');
  });

  it('2: Complex - a+bi and r∠θ modes', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU DOWN 2'); // Complex
    assert.deepEqual(calc.renderLines(), ['1:a+bi', '2:r∠θ']);
    calc.press('2'); // polar
    assert.equal(calc.setup.complex, 'POLAR');
    calc.pressSequence('SHIFT MENU DOWN 2 1'); // rectangular
    assert.equal(calc.setup.complex, 'RECT');
  });

  it('3: Statistics - Freq On/Off', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU DOWN 3'); // Statistics
    assert.deepEqual(calc.renderLines(), ['1:On', '2:Off']);
    calc.press('1'); // On
    assert.equal(calc.setup.statFreq, true);
    calc.pressSequence('SHIFT MENU DOWN 3 2'); // Off
    assert.equal(calc.setup.statFreq, false);
  });

  it('4: Spreadsheet - Auto Calc and Show Cell submenus', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU DOWN 4'); // Spreadsheet
    assert.deepEqual(calc.renderLines(), ['1:Auto Calc', '2:Show Cell']);

    // Auto Calc -> Off
    calc.press('1');
    assert.deepEqual(calc.renderLines(), ['1:On', '2:Off']);
    calc.press('2'); // Off
    assert.equal(calc.setup.autoCalc, false);

    // Show Cell -> Value
    calc.pressSequence('SHIFT MENU DOWN 4 2');
    assert.deepEqual(calc.renderLines(), ['1:Formula', '2:Value']);
    calc.press('2'); // Value
    assert.equal(calc.setup.showCell, 'VALUE');
  });
});

describe('Page 3 Submenus & Option Execution', () => {
  it('1: Equation/Func - Complex roots On/Off', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU DOWN DOWN 1'); // Equation/Func
    assert.deepEqual(calc.renderLines(), ['1:On', '2:Off']);
    calc.press('2'); // Off
    assert.equal(calc.setup.eqComplex, false);
    calc.pressSequence('SHIFT MENU DOWN DOWN 1 1'); // On
    assert.equal(calc.setup.eqComplex, true);
  });

  it('2: Table - f(x) or f(x),g(x)', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU DOWN DOWN 2'); // Table
    assert.deepEqual(calc.renderLines(), ['1:f(x)', '2:f(x),g(x)']);
    calc.press('1'); // f(x)
    assert.equal(calc.setup.table, 'F');
    calc.pressSequence('SHIFT MENU DOWN DOWN 2 2'); // f(x),g(x)
    assert.equal(calc.setup.table, 'FG');
  });

  it('3: Decimal Mark - Dot vs Comma', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU DOWN DOWN 3'); // Decimal Mark
    assert.deepEqual(calc.renderLines(), ['1:Dot', '2:Comma']);
    calc.press('2'); // Comma
    assert.equal(calc.setup.decimalMark, 'COMMA');

    calc.pressSequence('1 / 2 = S<=>D');
    assert.equal(calc.renderLines()[1], '0,5');

    calc.pressSequence('SHIFT MENU DOWN DOWN 3 1'); // Dot
    assert.equal(calc.setup.decimalMark, 'DOT');
    calc.pressSequence('1 / 2 = S<=>D');
    assert.equal(calc.renderLines()[1], '0.5');
  });

  it('4: Digit Separator - On vs Off', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU DOWN DOWN 4'); // Digit Separator
    assert.deepEqual(calc.renderLines(), ['1:On', '2:Off']);
    calc.press('1'); // On
    assert.equal(calc.setup.digitSeparator, true);

    calc.pressSequence('1 0 0 0 0 0 0 =');
    assert.equal(calc.renderLines()[1], '1 000 000');

    calc.pressSequence('SHIFT MENU DOWN DOWN 4 2'); // Off
    assert.equal(calc.setup.digitSeparator, false);
    calc.pressSequence('1 0 0 0 0 0 0 =');
    assert.equal(calc.renderLines()[1], '1000000');
  });
});

describe('Page 4 Submenus & Option Execution', () => {
  it('1: MultiLine Font - Normal Font vs Small Font', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU DOWN DOWN DOWN 1'); // MultiLine Font
    assert.deepEqual(calc.renderLines(), ['1:Normal Font', '2:Small Font']);
    calc.press('2'); // Small Font
    assert.equal(calc.setup.multiLineFont, 'SMALL');
    calc.pressSequence('SHIFT MENU DOWN DOWN DOWN 1 1'); // Normal Font
    assert.equal(calc.setup.multiLineFont, 'NORMAL');
  });

  it('2: QR Code - Version 3 vs Version 11', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU DOWN DOWN DOWN 2'); // QR Code
    assert.deepEqual(calc.renderLines(), ['1:Version 3', '2:Version 11']);
    calc.press('1'); // Version 3
    assert.equal(calc.setup.qrVersion, 3);
    calc.pressSequence('SHIFT MENU DOWN DOWN DOWN 2 2'); // Version 11
    assert.equal(calc.setup.qrVersion, 11);
  });

  it('3: Contrast - adjustments with LEFT/RIGHT and EXE/AC dismissal', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU DOWN DOWN DOWN 3'); // Contrast view
    assert.equal(calc.topView.constructor.name, 'ContrastView');
    assert.equal(calc.setup.contrast, 8);
    assert.deepEqual(calc.renderLines(), ['Contrast', 'LIGHT 8 DARK']);

    calc.pressSequence('RIGHT RIGHT'); // contrast -> 10
    assert.equal(calc.setup.contrast, 10);
    assert.deepEqual(calc.renderLines(), ['Contrast', 'LIGHT 10 DARK']);

    calc.pressSequence('LEFT LEFT LEFT'); // contrast -> 7
    assert.equal(calc.setup.contrast, 7);

    calc.press('EXE'); // close contrast view
    assert.equal(calc.topView.constructor.name, 'CalcApp');
    assert.equal(calc.setup.contrast, 7);
  });

  it('4: Auto Power Off - 10 Min. vs 60 Min.', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU DOWN DOWN DOWN 4'); // Auto Power Off
    assert.deepEqual(calc.renderLines(), ['1:10 Min.', '2:60 Min.']);
    calc.press('2'); // 60 Min.
    assert.equal(calc.setup.autoPowerOff, 60);
    calc.pressSequence('SHIFT MENU DOWN DOWN DOWN 4 1'); // 10 Min.
    assert.equal(calc.setup.autoPowerOff, 10);
  });
});

describe('Submenu Navigation & Interruption', () => {
  it('navigates back to parent menu via LEFT key', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU 2'); // Angle Unit submenu
    assert.equal(calc.renderLines()[0], '1:Degree');
    calc.press('LEFT'); // back to main setup
    assert.equal(calc.renderLines()[0], '1:Input/Output');
  });

  it('navigates back from DigitPromptView to Number Format via LEFT key', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU 3 1'); // Fix 0~9? prompt
    assert.equal(calc.renderLines()[0], 'Fix 0~9?');
    calc.press('LEFT'); // back to Number Format menu
    assert.equal(calc.renderLines()[0], '1:Fix');
    calc.press('LEFT'); // back to main setup
    assert.equal(calc.renderLines()[0], '1:Input/Output');
  });

  it('dismisses submenu immediately via AC key', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU 2 AC');
    assert.equal(calc.topView.constructor.name, 'CalcApp');
  });

  it('powers off calculator from inside menu via SHIFT AC', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU SHIFT AC');
    assert.equal(calc.poweredOn, false);
    calc.press('ON');
    assert.equal(calc.poweredOn, true);
    assert.equal(calc.topView.constructor.name, 'CalcApp');
  });
});
