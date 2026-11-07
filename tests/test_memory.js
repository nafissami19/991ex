/**
 * Unit tests for Variables, Memory, and Reset (Prompt 15).
 * Tests Memory model, STO/RCL screens, independent M+/M-, ALPHA variable insertion,
 * RESET menus (Setup Data, Memory, Initialize All), and persistence.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Memory, serialize, deserialize, VARIABLES } from '../js/core/memory.js';
import { Calculator } from '../js/core/Calculator.js';
import { ExactValue } from '../js/core/exact/ExactValue.js';
import { Rational } from '../js/core/exact/Rational.js';
import { SurdForm } from '../js/core/exact/SurdForm.js';
import { PiForm } from '../js/core/exact/PiForm.js';
import { Decimal15 } from '../js/core/number/Decimal15.js';

describe('Memory model and exact value serialization', () => {
  it('initializes all variables, ans, and preAns to 0', () => {
    const mem = new Memory();
    assert.equal(mem.getAns().toDecimal15().toString(), '0');
    assert.equal(mem.getPreAns().toDecimal15().toString(), '0');
    assert.equal(mem.isMNonZero(), false);
    for (const v of VARIABLES) {
      assert.equal(mem.getVar(v).toDecimal15().toString(), '0');
    }
  });

  it('updates Ans and shifts prior Ans to PreAns', () => {
    const mem = new Memory();
    mem.setAns(ExactValue.fromInt(42n));
    assert.equal(mem.getAns().toDecimal15().toString(), '42');
    assert.equal(mem.getPreAns().toDecimal15().toString(), '0');

    mem.setAns(ExactValue.fromInt(100n));
    assert.equal(mem.getAns().toDecimal15().toString(), '100');
    assert.equal(mem.getPreAns().toDecimal15().toString(), '42');
  });

  it('stores and retrieves all 9 variables', () => {
    const mem = new Memory();
    for (let i = 0; i < VARIABLES.length; i++) {
      const v = VARIABLES[i];
      mem.setVar(v, ExactValue.fromInt(BigInt(i + 1)));
      assert.equal(mem.getVar(v).toDecimal15().toString(), String(i + 1));
    }
  });

  it('serializes and deserializes rational exact values', () => {
    const val = ExactValue.fromRational(5n, 6n);
    const json = serialize(val);
    const roundTrip = deserialize(json);
    assert.equal(roundTrip.type, 'rational');
    assert.equal(roundTrip.value.n, 5n);
    assert.equal(roundTrip.value.d, 6n);
  });

  it('serializes and deserializes surd exact values', () => {
    // 2*sqrt(2)
    const sf = new SurdForm(new Rational(0n, 1n), [{ radicand: 2n, coeff: new Rational(2n, 1n) }]);
    const val = ExactValue.fromSurd(sf);
    const json = serialize(val);
    const roundTrip = deserialize(json);
    assert.equal(roundTrip.type, 'surd');
    assert.equal(roundTrip.toDecimal15().toString(), val.toDecimal15().toString());
  });

  it('serializes and deserializes pi exact values', () => {
    // 3/4 * pi
    const pf = new PiForm(new Rational(3n, 4n), 1);
    const val = ExactValue.fromPi(pf);
    const json = serialize(val);
    const roundTrip = deserialize(json);
    assert.equal(roundTrip.type, 'pi');
    assert.equal(roundTrip.toDecimal15().toString(), val.toDecimal15().toString());
  });

  it('serializes and deserializes decimal exact values', () => {
    const d = Decimal15.fromString('1.23456789012345');
    const val = new ExactValue('decimal', d, d);
    const json = serialize(val);
    const roundTrip = deserialize(json);
    assert.equal(roundTrip.type, 'decimal');
    assert.equal(roundTrip.toDecimal15().toString(), d.toString());
  });
});

describe('Variable assignment via STO', () => {
  it('assigns calculation result to variable A with 3+5= STO (-)', () => {
    const calc = new Calculator();
    calc.pressSequence('3 + 5 = STO (-)');
    assert.equal(calc.memory.getVar('A').toDecimal15().toString(), '8');
    const lines = calc.renderLines();
    assert.equal(lines[0], '3+5→A');
    assert.equal(lines[1], '8');
  });

  it('assigns without pressing = first: 3+5 STO (-)', () => {
    const calc = new Calculator();
    calc.pressSequence('3 + 5 STO (-)');
    assert.equal(calc.memory.getVar('A').toDecimal15().toString(), '8');
    const lines = calc.renderLines();
    assert.equal(lines[0], '3+5→A');
    assert.equal(lines[1], '8');
  });

  it('assigns Ans when pressed on empty input line', () => {
    const calc = new Calculator();
    calc.pressSequence('1 4 * 1 3 =');
    assert.equal(calc.memory.getAns().toDecimal15().toString(), '182');
    calc.press('AC');
    calc.pressSequence('STO (-)');
    assert.equal(calc.memory.getVar('A').toDecimal15().toString(), '182');
    const lines = calc.renderLines();
    assert.equal(lines[0], 'Ans→A');
    assert.equal(lines[1], '182');
  });

  it('shows STO indicator while STO is pending and clears on key', () => {
    const calc = new Calculator();
    calc.press('STO');
    assert.ok(calc.indicators().includes('STO'));
    calc.press('(-)');
    assert.ok(!calc.indicators().includes('STO'));
  });

  it('cancels STO pending when AC is pressed', () => {
    const calc = new Calculator();
    calc.press('STO');
    assert.ok(calc.indicators().includes('STO'));
    calc.press('AC');
    assert.ok(!calc.indicators().includes('STO'));
    assert.equal(calc.memory.getVar('A').toDecimal15().toString(), '0');
  });

  it('stores into all 9 variable targets', () => {
    const calc = new Calculator();
    const map = [
      ['NEG', 'A', '1'],
      ['DEG', 'B', '2'],
      ['INV', 'C', '3'],
      ['SIN', 'D', '4'],
      ['COS', 'E', '5'],
      ['TAN', 'F', '6'],
      ['M_PLUS', 'M', '7'],
      ['X', 'x', '8'],
      ['SD', 'y', '9']
    ];
    for (const [key, varName, val] of map) {
      calc.pressSequence(val + ' STO ' + key);
      assert.equal(calc.memory.getVar(varName).toDecimal15().toString(), val);
    }
  });

  it('stores into x via RPAREN key', () => {
    const calc = new Calculator();
    calc.pressSequence('9 9 STO RPAREN');
    assert.equal(calc.memory.getVar('x').toDecimal15().toString(), '99');
  });
});

describe('Independent memory M+ and M-', () => {
  it('adds calculation result to M and displays M status indicator', () => {
    const calc = new Calculator();
    assert.ok(!calc.indicators().includes('M'));
    calc.pressSequence('1 0 * 5 M_PLUS');
    assert.equal(calc.memory.getVar('M').toDecimal15().toString(), '50');
    assert.ok(calc.indicators().includes('M'));
    const lines = calc.renderLines();
    assert.equal(lines[0], '10×5');
    assert.equal(lines[1], '50');
  });

  it('subtracts from M via SHIFT M+ (M-)', () => {
    const calc = new Calculator();
    calc.pressSequence('5 0 M_PLUS');
    calc.pressSequence('1 5 SHIFT M_PLUS');
    assert.equal(calc.memory.getVar('M').toDecimal15().toString(), '35');
    assert.ok(calc.indicators().includes('M'));
    const lines = calc.renderLines();
    assert.equal(lines[0], '15');
    assert.equal(lines[1], '15');
  });

  it('turns off M indicator when M becomes 0', () => {
    const calc = new Calculator();
    calc.pressSequence('2 0 M_PLUS');
    assert.ok(calc.indicators().includes('M'));
    calc.pressSequence('2 0 SHIFT M_PLUS');
    assert.equal(calc.memory.getVar('M').toDecimal15().toString(), '0');
    assert.ok(!calc.indicators().includes('M'));
  });

  it('clears M with 0 STO M and turns off M indicator', () => {
    const calc = new Calculator();
    calc.pressSequence('1 0 0 M_PLUS');
    assert.ok(calc.indicators().includes('M'));
    calc.pressSequence('0 STO M_PLUS');
    assert.equal(calc.memory.getVar('M').toDecimal15().toString(), '0');
    assert.ok(!calc.indicators().includes('M'));
  });

  it('adds Ans to M when M+ pressed on empty input line', () => {
    const calc = new Calculator();
    calc.pressSequence('7 5 =');
    calc.press('AC');
    calc.press('M_PLUS');
    assert.equal(calc.memory.getVar('M').toDecimal15().toString(), '75');
    assert.ok(calc.indicators().includes('M'));
    const lines = calc.renderLines();
    assert.equal(lines[0], 'Ans');
    assert.equal(lines[1], '75');
  });

  it('uses variable M in an arithmetic expression via ALPHA M+', () => {
    const calc = new Calculator();
    calc.pressSequence('3 5 STO M_PLUS');
    calc.pressSequence('ALPHA M_PLUS * 2 =');
    const lines = calc.renderLines();
    assert.equal(lines[0], 'M×2');
    assert.equal(lines[1], '70');
  });
});

describe('Recall view screen (SHIFT STO / RECALL)', () => {
  it('opens variable viewer dashboard formatted in Norm 1', () => {
    const calc = new Calculator();
    calc.pressSequence('1 STO NEG');
    calc.pressSequence('2 STO DEG');
    calc.pressSequence('SHIFT STO');
    assert.equal(calc.topView.constructor.name, 'RecallView');
    const lines = calc.renderLines();
    assert.equal(lines.length, 5);
    assert.equal(lines[0], 'A=1 B=2');
    assert.equal(lines[1], 'C=0 D=0');
    assert.equal(lines[2], 'E=0 F=0');
    assert.equal(lines[3], 'M=0 x=0');
    assert.equal(lines[4], 'y=0');
  });

  it('recalls variable A when pressing (-) and pastes into input', () => {
    const calc = new Calculator();
    calc.pressSequence('4 2 STO NEG AC');
    calc.pressSequence('SHIFT STO');
    calc.press('(-)'); // variable A
    assert.equal(calc.topView.constructor.name, 'CalcApp');
    const lines = calc.renderLines();
    assert.equal(lines[0], 'A');
    calc.press('=');
    assert.equal(calc.renderLines()[1], '42');
  });

  it('closes RecallView on AC without changing expression', () => {
    const calc = new Calculator();
    calc.pressSequence('5 + SHIFT STO');
    assert.equal(calc.topView.constructor.name, 'RecallView');
    calc.press('AC');
    assert.equal(calc.topView.constructor.name, 'CalcApp');
    assert.equal(calc.renderLines()[0], '5+');
  });
});

describe('RESET menu (SHIFT 9)', () => {
  it('opens RESET menu with 3 options: Setup Data, Memory, Initialize All', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT 9');
    assert.equal(calc.topView.constructor.name, 'MenuView');
    const lines = calc.renderLines();
    assert.ok(lines.some((l) => l.includes('1:Setup Data')));
    assert.ok(lines.some((l) => l.includes('2:Memory')));
    assert.ok(lines.some((l) => l.includes('3:Initialize All')));
  });

  it('cancels RESET menu when AC is pressed', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT 9 AC');
    assert.equal(calc.topView.constructor.name, 'CalcApp');
  });

  it('RESET 1 (Setup Data) resets setup but retains variables and memory', () => {
    const calc = new Calculator();
    calc.setup.angle = 'RAD';
    calc.pressSequence('8 8 STO NEG'); // A = 88
    calc.pressSequence('1 0 M_PLUS'); // M = 10
    calc.pressSequence('SHIFT 9 1'); // Reset Setup Data confirmation
    assert.equal(calc.topView.constructor.name, 'ConfirmView');
    calc.press('EXE'); // Confirm
    assert.equal(calc.topView.constructor.name, 'MessageView');
    const msg = calc.renderLines();
    assert.ok(msg.some((l) => l.includes('Reset Setup Data')));
    calc.press('AC'); // Close message
    assert.equal(calc.topView.constructor.name, 'CalcApp');
    assert.equal(calc.setup.angle, 'DEG'); // reset to default DEG
    assert.equal(calc.memory.getVar('A').toDecimal15().toString(), '88'); // retained
    assert.equal(calc.memory.getVar('M').toDecimal15().toString(), '10'); // retained
    assert.ok(calc.indicators().includes('M'));
  });

  it('RESET 2 (Memory) clears all variables and M but retains setup', () => {
    const calc = new Calculator();
    calc.setup.angle = 'RAD';
    calc.pressSequence('5 5 STO NEG'); // A = 55
    calc.pressSequence('2 5 M_PLUS'); // M = 25
    calc.pressSequence('SHIFT 9 2'); // Clear All Memory confirmation
    assert.equal(calc.topView.constructor.name, 'ConfirmView');
    calc.press('EXE'); // Confirm
    assert.equal(calc.topView.constructor.name, 'MessageView');
    const msg = calc.renderLines();
    assert.ok(msg.some((l) => l.includes('Clear Memory')));
    calc.press('AC'); // Close message
    assert.equal(calc.topView.constructor.name, 'CalcApp');
    assert.equal(calc.setup.angle, 'RAD'); // setup retained!
    assert.equal(calc.memory.getVar('A').toDecimal15().toString(), '0'); // cleared
    assert.equal(calc.memory.getVar('M').toDecimal15().toString(), '0'); // cleared
    assert.equal(calc.memory.getAns().toDecimal15().toString(), '0'); // cleared
    assert.ok(!calc.indicators().includes('M')); // M indicator off
  });

  it('RESET 3 (Initialize All) resets setup, clears all memory, and returns to Calculate mode', () => {
    const calc = new Calculator();
    calc.setup.angle = 'RAD';
    calc.pressSequence('9 9 STO NEG');
    calc.pressSequence('1 0 M_PLUS');
    calc.pressSequence('SHIFT 9 3'); // Initialize All confirmation
    assert.equal(calc.topView.constructor.name, 'ConfirmView');
    calc.press('EXE'); // Confirm
    assert.equal(calc.topView.constructor.name, 'MessageView');
    const msg = calc.renderLines();
    assert.ok(msg.some((l) => l.includes('Reset All')));
    calc.press('AC');
    assert.equal(calc.topView.constructor.name, 'CalcApp');
    assert.equal(calc.mode, 1);
    assert.equal(calc.setup.angle, 'DEG');
    assert.equal(calc.memory.getVar('A').toDecimal15().toString(), '0');
    assert.equal(calc.memory.getVar('M').toDecimal15().toString(), '0');
    assert.ok(!calc.indicators().includes('M'));
  });

  it('cancels confirmation view when AC is pressed without applying reset', () => {
    const calc = new Calculator();
    calc.pressSequence('7 7 STO NEG');
    calc.pressSequence('SHIFT 9 2'); // Memory confirm
    calc.press('AC'); // Cancel
    assert.equal(calc.topView.constructor.name, 'CalcApp');
    assert.equal(calc.memory.getVar('A').toDecimal15().toString(), '77'); // not cleared
  });
});

describe('State export and import (localStorage persistence)', () => {
  it('restores all variables, Ans, PreAns, and M across importState', () => {
    const c1 = new Calculator();
    c1.pressSequence('1 0 ='); // Ans = 10
    c1.pressSequence('2 0 ='); // Ans = 20, PreAns = 10
    c1.pressSequence('3 0 STO NEG'); // A = 30
    c1.pressSequence('4 0 STO DEG'); // B = 40
    c1.pressSequence('5 0 M_PLUS'); // M = 50

    const exported = c1.exportState();
    const jsonStr = JSON.stringify(exported);

    const c2 = new Calculator();
    c2.importState(JSON.parse(jsonStr));

    assert.equal(c2.memory.getAns().toDecimal15().toString(), '50');
    assert.equal(c2.memory.getPreAns().toDecimal15().toString(), '40');
    assert.equal(c2.memory.getVar('A').toDecimal15().toString(), '30');
    assert.equal(c2.memory.getVar('B').toDecimal15().toString(), '40');
    assert.equal(c2.memory.getVar('M').toDecimal15().toString(), '50');
    assert.ok(c2.indicators().includes('M'));
  });

  it('restores exact surd and pi values across state import', () => {
    const c1 = new Calculator();
    c1.pressSequence('SQRT 8 = STO NEG'); // A = 2*sqrt(2)
    c1.pressSequence('SHIFT EXP / 2 = STO DEG'); // B = pi / 2

    const jsonStr = JSON.stringify(c1.exportState());
    const c2 = new Calculator();
    c2.importState(JSON.parse(jsonStr));

    assert.equal(c2.memory.getVar('A').type, 'surd');
    assert.equal(c2.memory.getVar('B').type, 'pi');

    c2.pressSequence('ALPHA NEG ^ 2 =');
    assert.equal(c2.renderLines()[1], '8');
  });

  it('retains variables across power-off (SHIFT AC) and ON', () => {
    const calc = new Calculator();
    calc.pressSequence('1 2 3 STO NEG');
    calc.pressSequence('SHIFT AC'); // Power off
    assert.equal(calc.poweredOn, false);
    calc.press('ON'); // Power on
    assert.equal(calc.poweredOn, true);
    assert.equal(calc.memory.getVar('A').toDecimal15().toString(), '123');
  });
});
