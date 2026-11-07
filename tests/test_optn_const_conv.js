import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Calculator } from '../js/core/Calculator.js';
import { MenuView } from '../js/core/ui/views.js';

describe('Prompt 17 — OPTN Menu in Calculate Mode', () => {
  it('opens OPTN menu with 4 items on Page 1', () => {
    const calc = new Calculator();
    calc.pressSequence('OPTN');
    assert(calc.topView instanceof MenuView);
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], '1:Hyperbolic Func');
    assert.strictEqual(scr.lines[1], '2:Angle Unit');
    assert.strictEqual(scr.lines[2], '3:Engineer Symbol');
    assert.strictEqual(scr.lines[3], '4:Number Calculation');
  });

  it('navigates to Hyperbolic Func submenu, inserts sinh, and closes overlay', () => {
    const calc = new Calculator();
    calc.pressSequence('OPTN 1');
    assert(calc.topView instanceof MenuView);
    // Leaf item selection closes menu and inserts token
    calc.pressSequence('1');
    assert.strictEqual(calc.views.length, 0);
    calc.pressSequence('0 ) =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'sinh(0)');
    assert.strictEqual(scr.lines[1], '0');
  });

  it('navigates to Angle Unit submenu and inserts degree symbol', () => {
    const calc = new Calculator({ setup: { angle: 'RAD' } });
    calc.pressSequence('1 8 0 OPTN 2 1 =');
    assert.strictEqual(calc.views.length, 0);
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], '180°');
    assert.strictEqual(scr.lines[1], 'π');
  });

  it('navigates to Engineer Symbol submenu and inserts k symbol', () => {
    const calc = new Calculator();
    calc.pressSequence('5 0 0 OPTN 3 6 =');
    assert.strictEqual(calc.views.length, 0);
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], '500k');
    assert.strictEqual(scr.lines[1], '500000');
  });

  it('navigates to Number Calculation: Abs', () => {
    const calc = new Calculator();
    calc.pressSequence('OPTN 4 1 (-) 5 =');
    assert.strictEqual(calc.views.length, 0);
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '5');
  });

  it('navigates to Number Calculation: Int', () => {
    const calc = new Calculator();
    calc.pressSequence('OPTN 4 2 3 . 8 ) =');
    assert.strictEqual(calc.views.length, 0);
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'Int(3.8)');
    assert.strictEqual(scr.lines[1], '3');

    calc.pressSequence('AC OPTN 4 2 (-) 3 . 8 ) =');
    const scr2 = calc.getScreen();
    assert.strictEqual(scr2.lines[1], '−3');
  });

  it('navigates to Number Calculation: Intg (floor)', () => {
    const calc = new Calculator();
    calc.pressSequence('OPTN 4 3 3 . 8 ) =');
    assert.strictEqual(calc.views.length, 0);
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'Intg(3.8)');
    assert.strictEqual(scr.lines[1], '3');

    calc.pressSequence('AC OPTN 4 3 (-) 3 . 8 ) =');
    const scr2 = calc.getScreen();
    assert.strictEqual(scr2.lines[1], '−4');
  });

  it('navigates to Number Calculation: Rnd in Fix 3', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT MENU 3 1 3'); // Number Format -> Fix 3
    calc.pressSequence('OPTN 4 4 1 0 ÷ 3 ) × 3 = SD');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '9.999');
  });

  it('LEFT key navigates back from OPTN submenus to parent menu', () => {
    const calc = new Calculator();
    calc.pressSequence('OPTN 1');
    assert(calc.topView instanceof MenuView);
    calc.pressSequence('LEFT');
    assert(calc.topView instanceof MenuView);
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], '1:Hyperbolic Func');
  });

  it('AC key dismisses OPTN menu immediately', () => {
    const calc = new Calculator();
    calc.pressSequence('1 2 3 OPTN AC');
    assert.strictEqual(calc.views.length, 0);
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], '123');
  });
});

describe('Prompt 17 — Scientific Constants (SHIFT 7 CONST)', () => {
  it('opens CONST menu with categories and pagination indicators', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT 7');
    assert(calc.topView instanceof MenuView);
    const scr1 = calc.getScreen();
    assert.strictEqual(scr1.lines[0], '1:Universal');
    assert.strictEqual(scr1.lines[1], '2:Electromagnetic');
    assert.strictEqual(scr1.lines[2], '3:Atomic&Nuclear');
    assert.strictEqual(scr1.lines[3], '4:Physico-Chem');
    assert(calc.indicators().includes('Down'));
    assert(!calc.indicators().includes('Up'));

    calc.pressSequence('DOWN');
    const scr2 = calc.getScreen();
    assert.strictEqual(scr2.lines[0], '1:Adopted Values');
    assert.strictEqual(scr2.lines[1], '2:Other');
    assert(!calc.indicators().includes('Down'));
    assert(calc.indicators().includes('Up'));
  });

  it('inserts and evaluates speed of light c0', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT 7 1 3 =');
    assert.strictEqual(calc.views.length, 0);
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'c₀');
    assert.strictEqual(scr.lines[1], '299792458');
  });

  it('inserts and evaluates standard gravity g', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT 7 DOWN 1 1 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'g');
    assert.strictEqual(scr.lines[1], '9.80665');
  });

  it('inserts and evaluates Planck constant h', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT 7 1 1 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'h');
    assert.strictEqual(scr.lines[1], '6.62606957×10⁻³⁴');
  });

  it('inserts and evaluates Avogadro constant NA', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT 7 4 3 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'NA');
    assert.strictEqual(scr.lines[1], '6.02214129×10²³');
  });

  it('performs arithmetic with constants: 2 c₀', () => {
    const calc = new Calculator();
    calc.pressSequence('2 SHIFT 7 1 3 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], '2c₀');
    assert.strictEqual(scr.lines[1], '599584916');
  });

  it('performs power on constant: c₀²', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT 7 1 3 x² =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'c₀²');
    assert.strictEqual(scr.lines[1], '8.987551787×10¹⁶');
  });
});

describe('Prompt 17 — Metric Conversions (SHIFT 8 CONV)', () => {
  it('opens CONV menu with 9 categories across 3 pages', () => {
    const calc = new Calculator();
    calc.pressSequence('SHIFT 8');
    assert(calc.topView instanceof MenuView);
    const scr1 = calc.getScreen();
    assert.strictEqual(scr1.lines[0], '1:Length');
    assert.strictEqual(scr1.lines[1], '2:Area');
    assert.strictEqual(scr1.lines[2], '3:Volume');
    assert.strictEqual(scr1.lines[3], '4:Mass');
    assert(calc.indicators().includes('Down'));
    assert(!calc.indicators().includes('Up'));

    calc.pressSequence('DOWN');
    const scr2 = calc.getScreen();
    assert.strictEqual(scr2.lines[0], '1:Velocity');
    assert.strictEqual(scr2.lines[1], '2:Pressure');
    assert.strictEqual(scr2.lines[2], '3:Energy');
    assert.strictEqual(scr2.lines[3], '4:Power');
    assert(calc.indicators().includes('Down'));
    assert(calc.indicators().includes('Up'));

    calc.pressSequence('DOWN');
    const scr3 = calc.getScreen();
    assert.strictEqual(scr3.lines[0], '1:Temperature');
    assert(!calc.indicators().includes('Down'));
    assert(calc.indicators().includes('Up'));
  });

  it('converts 5 cm into inches (fraction in MathI/MathO and decimal via S<=>D)', () => {
    const calc = new Calculator();
    calc.pressSequence('5 SHIFT 8 1 2 =');
    const scr1 = calc.getScreen();
    assert.strictEqual(scr1.lines[0], '5cm▸in');
    assert.strictEqual(scr1.lines[1], '250/127');

    calc.pressSequence('SD');
    const scr2 = calc.getScreen();
    assert.strictEqual(scr2.lines[1], '1.968503937');
  });

  it('converts velocity 36 km/h into m/s', () => {
    const calc = new Calculator();
    calc.pressSequence('3 6 SHIFT 8 DOWN 1 1 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], '36km/h▸m/s');
    assert.strictEqual(scr.lines[1], '10');
  });

  it('converts pressure 1 atm into Pa', () => {
    const calc = new Calculator();
    calc.pressSequence('1 SHIFT 8 DOWN 2 1 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], '1atm▸Pa');
    assert.strictEqual(scr.lines[1], '101325');
  });

  it('converts temperature: freezing point 32 °F to °C', () => {
    const calc = new Calculator();
    calc.pressSequence('3 2 SHIFT 8 DOWN DOWN 1 1 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], '32°F▸°C');
    assert.strictEqual(scr.lines[1], '0');
  });

  it('converts negative temperature: -40 °F to °C', () => {
    const calc = new Calculator();
    calc.pressSequence('(-) 4 0 SHIFT 8 DOWN DOWN 1 1 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], '-40°F▸°C');
    assert.strictEqual(scr.lines[1], '−40');
  });

  it('converts temperature: boiling point 100 °C to °F', () => {
    const calc = new Calculator();
    calc.pressSequence('1 0 0 SHIFT 8 DOWN DOWN 1 2 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], '100°C▸°F');
    assert.strictEqual(scr.lines[1], '212');
  });

  it('binds conversion command with Rank 6 priority before addition', () => {
    const calc = new Calculator();
    calc.pressSequence('1 0 + 5 SHIFT 8 1 2 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], '10+5cm▸in');
    assert.strictEqual(scr.lines[1], '1520/127');
  });

  it('conversion command on empty line prepends Ans automatically', () => {
    const calc = new Calculator();
    calc.pressSequence('5 = AC SHIFT 8 1 2 =');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], 'Anscm▸in');
    assert.strictEqual(scr.lines[1], '250/127');
  });
});

describe('Prompt 17 — Prime Factorization (SHIFT °\'" FACT)', () => {
  it('factors 1014 into 2×3×13²', () => {
    const calc = new Calculator();
    calc.pressSequence('1 0 1 4 = SHIFT DEG');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[0], '1014');
    assert.strictEqual(scr.lines[1], '2×3×13²');
  });

  it('unfactors back to 1014 on SHIFT FACT', () => {
    const calc = new Calculator();
    calc.pressSequence('1 0 1 4 = SHIFT DEG SHIFT DEG');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '1014');
  });

  it('unfactors back to 1014 on EXE', () => {
    const calc = new Calculator();
    calc.pressSequence('1 0 1 4 = SHIFT DEG EXE');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '1014');
  });

  it('displays prime numbers <= 3 digits as themselves', () => {
    const calc = new Calculator();
    calc.pressSequence('1 3 = SHIFT DEG');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '13');
  });

  it('encloses single factor >= 1,018,081 in parentheses', () => {
    const calc = new Calculator();
    calc.pressSequence('1 0 1 8 0 8 1 = SHIFT DEG');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '(1018081)');
  });

  it('encloses composite with two > 3-digit prime factors in parentheses', () => {
    const calc = new Calculator();
    // 1009 * 1013 = 1022117
    calc.pressSequence('1 0 2 2 1 1 7 = SHIFT DEG');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '(1022117)');
  });

  it('factors small primes and encloses the unfactorable part in parentheses', () => {
    const calc = new Calculator();
    // 2 * 1022117 = 2044234
    calc.pressSequence('2 0 4 4 2 3 4 = SHIFT DEG');
    const scr = calc.getScreen();
    assert.strictEqual(scr.lines[1], '2×(1022117)');
  });

  it('ignores SHIFT FACT on non-positive or non-integer values', () => {
    const calc = new Calculator();
    calc.pressSequence('(-) 5 = SHIFT DEG');
    assert.strictEqual(calc.getScreen().lines[1], '−5');

    calc.pressSequence('AC 0 = SHIFT DEG');
    assert.strictEqual(calc.getScreen().lines[1], '0');

    calc.pressSequence('AC 1 = SHIFT DEG');
    assert.strictEqual(calc.getScreen().lines[1], '1');
  });
});

describe('Prompt 17 — ENG and ←ENG Notation Stepping', () => {
  it('steps exponents down by 3 on ENG and up by 3 on SHIFT ENG', () => {
    const calc = new Calculator();
    calc.pressSequence('1 2 3 4 =');
    assert.strictEqual(calc.getScreen().lines[1], '1234');

    calc.pressSequence('ENG');
    assert.strictEqual(calc.getScreen().lines[1], '1.234×10³');

    calc.pressSequence('ENG');
    assert.strictEqual(calc.getScreen().lines[1], '1234');

    calc.pressSequence('ENG');
    assert.strictEqual(calc.getScreen().lines[1], '1234000×10⁻³');

    calc.pressSequence('SHIFT ENG');
    assert.strictEqual(calc.getScreen().lines[1], '1234');

    calc.pressSequence('SHIFT ENG');
    assert.strictEqual(calc.getScreen().lines[1], '1.234×10³');

    calc.pressSequence('SHIFT ENG');
    assert.strictEqual(calc.getScreen().lines[1], '0.001234×10⁶');
  });
});
