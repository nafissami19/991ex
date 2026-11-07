/**
 * scripts/stress.js
 *
 * Accuracy stress test generator and runner for Casio fx-991EX ClassWiz.
 * Generates 2,000 random expressions covering:
 *   - Arithmetic & Parentheses
 *   - Fractions & Mixed Fractions
 *   - Powers & Roots (x², x³, ^, √, ∛, x√, x⁻¹)
 *   - Trigonometric & Inverse Trig (Deg, Rad, Gra)
 *   - Hyperbolic & Inverse Hyperbolic
 *   - Logarithms & Exponentials (log, ln, log_a(b), 10^x, e^x)
 *   - Combinatorics & Factorials (n!, nPr, nCr)
 *   - Absolute Value & Percentages (|x|, %)
 *   - Constants & Scientific Notation (π, e, ×10^x)
 *   - Nested & Composite Expressions
 *   - Error Domain Boundaries (1/0, tan 90, negative logs, etc.)
 *
 * Usage:
 *   node scripts/stress.js --generate [--seed 42]
 *   node scripts/stress.js --run [--batch 1] [--count 100]
 *   node scripts/stress.js --verify
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Calculator } from '../js/core/Calculator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CASES_FILE = path.join(ROOT_DIR, 'tests', 'stress', 'cases.json');

// -----------------------------------------------------------------------------
// PRNG (Mulberry32)
// -----------------------------------------------------------------------------
export function mulberry32(seed = 42) {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// -----------------------------------------------------------------------------
// Generator Helpers
// -----------------------------------------------------------------------------
function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randChoice(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function intKeys(n) {
  if (n < 0) return ['NEG', ...String(Math.abs(n)).split('')];
  return [...String(n).split('')];
}

function decKeys(d) {
  const s = String(d);
  if (d < 0) return ['NEG', ...s.slice(1).split('')];
  return [...s.split('')];
}

// -----------------------------------------------------------------------------
// Category Generators
// -----------------------------------------------------------------------------

// 1. Arithmetic & Parentheses
function genArithmeticCase(id, rng) {
  const ops = ['+', '-', '×', '÷'];
  const type = randInt(rng, 1, 5);
  let keys = [];
  let expr = '';

  if (type === 1) {
    // a op b op c
    const a = randInt(rng, -50, 100);
    const b = randInt(rng, 1, 50);
    const c = randInt(rng, 1, 20);
    const op1 = randChoice(rng, ops);
    const op2 = randChoice(rng, ops);
    keys = [...intKeys(a), op1, ...intKeys(b), op2, ...intKeys(c), '='];
    expr = `${a} ${op1} ${b} ${op2} ${c}`;
  } else if (type === 2) {
    // (a op b) op c
    const a = randInt(rng, 1, 50);
    const b = randInt(rng, 1, 50);
    const c = randInt(rng, 1, 25);
    const op1 = randChoice(rng, ['+', '-']);
    const op2 = randChoice(rng, ['×', '÷']);
    keys = ['(', ...intKeys(a), op1, ...intKeys(b), ')', op2, ...intKeys(c), '='];
    expr = `(${a} ${op1} ${b}) ${op2} ${c}`;
  } else if (type === 3) {
    // a op (b op c)
    const a = randInt(rng, 1, 50);
    const b = randInt(rng, 1, 50);
    const c = randInt(rng, 1, 20);
    const op1 = randChoice(rng, ops);
    const op2 = randChoice(rng, ['+', '-']);
    keys = [...intKeys(a), op1, '(', ...intKeys(b), op2, ...intKeys(c), ')', '='];
    expr = `${a} ${op1} (${b} ${op2} ${c})`;
  } else if (type === 4) {
    // Decimal arithmetic
    const a = (randInt(rng, 1, 200) / 10).toFixed(1);
    const b = (randInt(rng, 1, 100) / 10).toFixed(1);
    const op = randChoice(rng, ops);
    keys = [...decKeys(a), op, ...decKeys(b), '='];
    expr = `${a} ${op} ${b}`;
  } else {
    // Negative number precedence: (-) a x² vs ( (-) a ) x²
    const a = randInt(rng, 2, 9);
    const paren = rng() > 0.5;
    if (paren) {
      keys = ['(', 'NEG', String(a), ')', 'x²', '='];
      expr = `(-${a})²`;
    } else {
      keys = ['NEG', String(a), 'x²', '='];
      expr = `-${a}²`;
    }
  }

  return {
    id,
    name: `Arithmetic: ${expr}`,
    category: 'arithmetic',
    setup: { inputOutput: 'MathI/MathO', angle: 'Deg' },
    keys,
    expression: expr
  };
}

// 2. Fractions & Mixed Fractions
function genFractionCase(id, rng) {
  const type = randInt(rng, 1, 4);
  let keys = [];
  let expr = '';

  if (type === 1) {
    // simple fraction: a / b
    const num = randInt(rng, -30, 50);
    const den = randInt(rng, 1, 40);
    keys = ['FRAC', ...intKeys(num), 'DOWN', ...intKeys(den), '='];
    expr = `${num}/${den}`;
  } else if (type === 2) {
    // fraction addition / subtraction
    const a = randInt(rng, 1, 12);
    const b = randInt(rng, 2, 12);
    const c = randInt(rng, 1, 12);
    const d = randInt(rng, 2, 12);
    const op = randChoice(rng, ['+', '-', '×', '÷']);
    keys = ['FRAC', ...intKeys(a), 'DOWN', ...intKeys(b), 'RIGHT', op, 'FRAC', ...intKeys(c), 'DOWN', ...intKeys(d), '='];
    expr = `${a}/${b} ${op} ${c}/${d}`;
  } else if (type === 3) {
    // mixed fraction
    const w = randInt(rng, 1, 10);
    const n = randInt(rng, 1, 9);
    const d = randInt(rng, n + 1, 12);
    keys = ['SHIFT', 'FRAC', ...intKeys(w), 'RIGHT', ...intKeys(n), 'DOWN', ...intKeys(d), '='];
    expr = `${w} ${n}/${d}`;
  } else {
    // nested fraction: FRAC (a + b) DOWN c
    const a = randInt(rng, 1, 20);
    const b = randInt(rng, 1, 20);
    const c = randInt(rng, 2, 15);
    keys = ['FRAC', ...intKeys(a), '+', ...intKeys(b), 'DOWN', ...intKeys(c), '='];
    expr = `(${a}+${b})/${c}`;
  }

  return {
    id,
    name: `Fraction: ${expr}`,
    category: 'fractions',
    setup: { inputOutput: 'MathI/MathO', angle: 'Deg' },
    keys,
    expression: expr
  };
}

// 3. Powers & Roots
function genPowerRootCase(id, rng) {
  const type = randInt(rng, 1, 7);
  let keys = [];
  let expr = '';

  if (type === 1) {
    // Square x²
    const a = randInt(rng, 2, 35);
    keys = [...intKeys(a), 'x²', '='];
    expr = `${a}²`;
  } else if (type === 2) {
    // Cube x³
    const a = randInt(rng, 2, 15);
    keys = [...intKeys(a), 'SHIFT', 'SQUARE', '='];
    expr = `${a}³`;
  } else if (type === 3) {
    // Power a^b
    const a = randInt(rng, 2, 8);
    const b = randInt(rng, 2, 6);
    keys = [...intKeys(a), '^', ...intKeys(b), '='];
    expr = `${a}^${b}`;
  } else if (type === 4) {
    // Square root
    const a = randChoice(rng, [4, 8, 9, 12, 16, 18, 20, 24, 25, 27, 32, 45, 50, 72, 98, 128, 200]);
    keys = ['√', ...intKeys(a), '='];
    expr = `√${a}`;
  } else if (type === 5) {
    // Cube root
    const a = randChoice(rng, [8, 27, 64, 125, 216, 16, 54]);
    keys = ['SHIFT', 'SQRT', ...intKeys(a), '='];
    expr = `∛${a}`;
  } else if (type === 6) {
    // N-th root: idx √ radicand
    const idx = randChoice(rng, [3, 4, 5]);
    const val = randInt(rng, 2, 4);
    const rad = Math.pow(val, idx);
    keys = ['SHIFT', 'POWER', String(idx), 'RIGHT', ...intKeys(rad), '='];
    expr = `${idx}√${rad}`;
  } else {
    // Reciprocal x⁻¹
    const a = randInt(rng, 2, 25);
    keys = [...intKeys(a), 'INV', '='];
    expr = `${a}⁻¹`;
  }

  return {
    id,
    name: `Power/Root: ${expr}`,
    category: 'powers_and_roots',
    setup: { inputOutput: 'MathI/MathO', angle: 'Deg' },
    keys,
    expression: expr
  };
}

// 4. Trigonometry
function genTrigCase(id, rng) {
  const type = randInt(rng, 1, 5);
  const angleUnit = randChoice(rng, ['Deg', 'Deg', 'Rad']); // Deg weighted more
  let keys = [];
  let expr = '';

  if (angleUnit === 'Deg') {
    if (type === 1) {
      // sin special
      const angles = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360];
      const ang = randChoice(rng, angles);
      keys = ['sin', ...intKeys(ang), ')', '='];
      expr = `sin(${ang}°)`;
    } else if (type === 2) {
      // cos special
      const angles = [0, 30, 45, 60, 90, 120, 135, 150, 180, 270, 360];
      const ang = randChoice(rng, angles);
      keys = ['cos', ...intKeys(ang), ')', '='];
      expr = `cos(${ang}°)`;
    } else if (type === 3) {
      // tan special
      const angles = [0, 30, 45, 60, 120, 135, 150, 180, 225, 315, 360];
      const ang = randChoice(rng, angles);
      keys = ['tan', ...intKeys(ang), ')', '='];
      expr = `tan(${ang}°)`;
    } else if (type === 4) {
      // inverse trig
      const fn = randChoice(rng, ['sin⁻¹', 'cos⁻¹', 'tan⁻¹']);
      let valKeys = [];
      let valStr = '';
      if (fn === 'tan⁻¹') {
        const v = randChoice(rng, [0, 1, -1]);
        valKeys = intKeys(v);
        valStr = String(v);
      } else {
        const v = randChoice(rng, ['0', '0.5', '1', 'NEG 0.5', 'NEG 1']);
        valKeys = v.split(' ');
        valStr = v.replace('NEG ', '-');
      }
      const shiftFn = fn === 'sin⁻¹' ? 'SIN' : fn === 'cos⁻¹' ? 'COS' : 'TAN';
      keys = ['SHIFT', shiftFn, ...valKeys, ')', '='];
      expr = `${fn}(${valStr})`;
    } else {
      // Trig combination sin²(x) + cos²(x)
      const ang = randInt(rng, 10, 80);
      keys = ['(', 'sin', ...intKeys(ang), ')', ')', 'x²', '+', '(', 'cos', ...intKeys(ang), ')', ')', 'x²', '='];
      expr = `sin(${ang})² + cos(${ang})²`;
    }
  } else {
    // Radian angles
    const fn = randChoice(rng, ['sin', 'cos', 'tan']);
    const mult = randChoice(rng, [1, 2, 3]);
    const denom = randChoice(rng, [2, 3, 4, 6]);
    // mult * pi / denom
    keys = [fn, 'FRAC', ...intKeys(mult), 'SHIFT', 'EXP', 'DOWN', ...intKeys(denom), 'RIGHT', ')', '='];
    expr = `${fn}(${mult}π/${denom} rad)`;
  }

  return {
    id,
    name: `Trigonometry: ${expr}`,
    category: 'trigonometry',
    setup: { inputOutput: 'MathI/MathO', angle: angleUnit },
    keys,
    expression: expr
  };
}

// 5. Hyperbolic
function genHyperbolicCase(id, rng) {
  const fns = [
    { name: 'sinh', subKey: '1' },
    { name: 'cosh', subKey: '2' },
    { name: 'tanh', subKey: '3' },
    { name: 'sinh⁻¹', subKey: '4' },
    { name: 'cosh⁻¹', subKey: '5' },
    { name: 'tanh⁻¹', subKey: '6' }
  ];
  const choice = randChoice(rng, fns);
  let argKeys = [];
  let argStr = '';

  if (choice.name === 'sinh' || choice.name === 'cosh' || choice.name === 'tanh') {
    const val = randChoice(rng, [0, 1, 2, -1, 0.5]);
    argKeys = typeof val === 'number' && val < 0 ? ['NEG', String(Math.abs(val))] : decKeys(val);
    argStr = String(val);
  } else if (choice.name === 'sinh⁻¹') {
    const val = randChoice(rng, [0, 1, 2, -1, 0.5]);
    argKeys = typeof val === 'number' && val < 0 ? ['NEG', String(Math.abs(val))] : decKeys(val);
    argStr = String(val);
  } else if (choice.name === 'cosh⁻¹') {
    const val = randChoice(rng, [1, 2, 3, 5]);
    argKeys = intKeys(val);
    argStr = String(val);
  } else {
    // tanh⁻¹ needs |x| < 1
    const val = randChoice(rng, [0, 0.2, 0.5, 0.8, -0.5]);
    argKeys = typeof val === 'number' && val < 0 ? ['NEG', ...String(Math.abs(val)).split('')] : decKeys(val);
    argStr = String(val);
  }

  const keys = ['OPTN', '1', choice.subKey, ...argKeys, ')', '='];
  const expr = `${choice.name}(${argStr})`;

  return {
    id,
    name: `Hyperbolic: ${expr}`,
    category: 'hyperbolic',
    setup: { inputOutput: 'MathI/MathO', angle: 'Deg' },
    keys,
    expression: expr
  };
}

// 6. Logarithms & Exponentials
function genLogExpCase(id, rng) {
  const type = randInt(rng, 1, 5);
  let keys = [];
  let expr = '';

  if (type === 1) {
    // ln(x)
    const val = randChoice(rng, [1, 2, 5, 10, 20]);
    keys = ['ln', ...intKeys(val), ')', '='];
    expr = `ln(${val})`;
  } else if (type === 2) {
    // ln(e^x) = x
    const x = randInt(rng, 1, 5);
    keys = ['ln', 'SHIFT', 'LN', ...intKeys(x), 'RIGHT', ')', '='];
    expr = `ln(e^${x})`;
  } else if (type === 3) {
    // log10(x)
    const val = randChoice(rng, [1, 10, 100, 1000, 10000, 2, 5]);
    keys = ['log', ...intKeys(val), ')', '='];
    expr = `log(${val})`;
  } else if (type === 4) {
    // arbitrary base log_a(b)
    const base = randChoice(rng, [2, 3, 5]);
    const pow = randInt(rng, 1, 4);
    const arg = Math.pow(base, pow);
    keys = ['LOG_AB', String(base), 'RIGHT', ...intKeys(arg), '='];
    expr = `log_${base}(${arg})`;
  } else {
    // 10^x
    const exp = randInt(rng, 1, 5);
    keys = ['SHIFT', 'LOG_AB', ...intKeys(exp), '='];
    expr = `10^${exp}`;
  }

  return {
    id,
    name: `Log/Exp: ${expr}`,
    category: 'logarithms_and_exponentials',
    setup: { inputOutput: 'MathI/MathO', angle: 'Deg' },
    keys,
    expression: expr
  };
}

// 7. Combinatorics & Factorials
function genCombinatoricsCase(id, rng) {
  const type = randInt(rng, 1, 3);
  let keys = [];
  let expr = '';

  if (type === 1) {
    // Factorial n!
    const n = randChoice(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 20, 69]);
    keys = [...intKeys(n), 'SHIFT', 'INV', '='];
    expr = `${n}!`;
  } else if (type === 2) {
    // Permutation nPr
    const n = randInt(rng, 3, 15);
    const r = randInt(rng, 0, n);
    keys = [...intKeys(n), 'SHIFT', 'MUL', ...intKeys(r), '='];
    expr = `${n}P${r}`;
  } else {
    // Combination nCr
    const n = randInt(rng, 3, 15);
    const r = randInt(rng, 0, n);
    keys = [...intKeys(n), 'SHIFT', 'DIV', ...intKeys(r), '='];
    expr = `${n}C${r}`;
  }

  return {
    id,
    name: `Combinatorics: ${expr}`,
    category: 'combinatorics_and_factorials',
    setup: { inputOutput: 'MathI/MathO', angle: 'Deg' },
    keys,
    expression: expr
  };
}

// 8. Absolute Value & Percentages
function genAbsPercentCase(id, rng) {
  const type = randInt(rng, 1, 3);
  let keys = [];
  let expr = '';

  if (type === 1) {
    // Abs(x)
    const val = randInt(rng, -100, 50);
    keys = ['SHIFT', 'LPAREN', ...intKeys(val), '='];
    expr = `|${val}|`;
  } else if (type === 2) {
    // Abs(a - b)
    const a = randInt(rng, 1, 50);
    const b = randInt(rng, a, a + 50);
    keys = ['SHIFT', 'LPAREN', ...intKeys(a), '-', ...intKeys(b), '='];
    expr = `|${a} - ${b}|`;
  } else {
    // Percent: a + b % or a × b %
    const a = randChoice(rng, [50, 100, 200, 250, 500]);
    const b = randChoice(rng, [5, 10, 15, 20, 25, 50]);
    const op = randChoice(rng, ['+', '-', '×']);
    keys = [...intKeys(a), op, ...intKeys(b), 'SHIFT', 'ANS', '='];
    expr = `${a} ${op} ${b}%`;
  }

  return {
    id,
    name: `Abs/Percent: ${expr}`,
    category: 'absolute_and_percentage',
    setup: { inputOutput: 'MathI/MathO', angle: 'Deg' },
    keys,
    expression: expr
  };
}

// 9. Constants & Scientific Notation
function genConstantsSciCase(id, rng) {
  const type = randInt(rng, 1, 4);
  let keys = [];
  let expr = '';

  if (type === 1) {
    // Pi operations
    const mult = randChoice(rng, [1, 2, 3, 4, 5]);
    if (mult === 1) {
      keys = ['SHIFT', 'EXP', '='];
      expr = `π`;
    } else {
      keys = [...intKeys(mult), 'SHIFT', 'EXP', '='];
      expr = `${mult}π`;
    }
  } else if (type === 2) {
    // 1 / (2π)
    keys = ['1', '÷', '2', 'SHIFT', 'EXP', '='];
    expr = `1 ÷ 2π`;
  } else if (type === 3) {
    // Euler's constant e
    const p = randInt(rng, 1, 4);
    if (p === 1) {
      keys = ['ALPHA', 'EXP', '='];
      expr = `e`;
    } else {
      keys = ['ALPHA', 'EXP', '^', String(p), '='];
      expr = `e^${p}`;
    }
  } else {
    // Scientific notation: a × 10^b
    const a = randInt(rng, 1, 9);
    const b = randInt(rng, -8, 8);
    keys = [String(a), 'EXP', ...intKeys(b), '='];
    expr = `${a}×10^(${b})`;
  }

  return {
    id,
    name: `Constants/Sci: ${expr}`,
    category: 'constants_and_scientific',
    setup: { inputOutput: 'MathI/MathO', angle: 'Deg' },
    keys,
    expression: expr
  };
}

// 10. Nested & Composite
function genNestedCompositeCase(id, rng) {
  const type = randInt(rng, 1, 5);
  let keys = [];
  let expr = '';

  if (type === 1) {
    // √(a² + b²)  (Pythagorean)
    const a = randChoice(rng, [3, 5, 6, 8, 9, 12]);
    const b = randChoice(rng, [4, 12, 8, 15, 12, 16]);
    keys = ['√', ...intKeys(a), 'x²', '+', ...intKeys(b), 'x²', '='];
    expr = `√(${a}² + ${b}²)`;
  } else if (type === 2) {
    // (a + b)²
    const a = randInt(rng, 1, 15);
    const b = randInt(rng, 1, 15);
    keys = ['(', ...intKeys(a), '+', ...intKeys(b), ')', 'x²', '='];
    expr = `(${a} + ${b})²`;
  } else if (type === 3) {
    // FRAC with sqrt: FRAC (1 + √5) DOWN 2
    keys = ['FRAC', '1', '+', '√', '5', 'RIGHT', 'DOWN', '2', '='];
    expr = `(1 + √5)/2 (Golden Ratio)`;
  } else if (type === 4) {
    // Combination of factorials: (a! + b!) / c
    const a = randInt(rng, 3, 5);
    const b = randInt(rng, 2, 4);
    const c = randInt(rng, 2, 6);
    keys = ['FRAC', ...intKeys(a), 'SHIFT', 'INV', '+', ...intKeys(b), 'SHIFT', 'INV', 'DOWN', ...intKeys(c), '='];
    expr = `(${a}! + ${b}!)/${c}`;
  } else {
    // Nested roots: √(1 + √2)
    keys = ['√', '1', '+', '√', '2', 'RIGHT', '='];
    expr = `√(1 + √2)`;
  }

  return {
    id,
    name: `Composite: ${expr}`,
    category: 'nested_composite',
    setup: { inputOutput: 'MathI/MathO', angle: 'Deg' },
    keys,
    expression: expr
  };
}

// 11. Error Boundary Cases
function genErrorBoundaryCase(id, rng) {
  const type = randInt(rng, 1, 6);
  let keys = [];
  let expr = '';

  if (type === 1) {
    // Division by zero
    const n = randInt(rng, 1, 100);
    keys = [...intKeys(n), '÷', '0', '='];
    expr = `${n} ÷ 0`;
  } else if (type === 2) {
    // tan(90) in Deg
    const ang = randChoice(rng, [90, 270, -90, -270]);
    keys = ['tan', ...intKeys(ang), ')', '='];
    expr = `tan(${ang}°)`;
  } else if (type === 3) {
    // Log of zero or negative
    const n = randChoice(rng, [0, -1, -5, -10]);
    keys = ['ln', ...intKeys(n), ')', '='];
    expr = `ln(${n})`;
  } else if (type === 4) {
    // Square root of negative in real mode
    const n = randChoice(rng, [-1, -4, -9, -16]);
    keys = ['√', ...intKeys(n), '='];
    expr = `√(${n})`;
  } else if (type === 5) {
    // Factorial overflow (>= 70)
    const n = randChoice(rng, [70, 71, 100]);
    keys = [...intKeys(n), 'SHIFT', 'INV', '='];
    expr = `${n}!`;
  } else {
    // nCr or nPr with r > n
    const n = randInt(rng, 1, 5);
    const r = randInt(rng, n + 1, n + 5);
    keys = [...intKeys(n), 'SHIFT', 'DIV', ...intKeys(r), '='];
    expr = `${n}C${r}`;
  }

  return {
    id,
    name: `Error Boundary: ${expr}`,
    category: 'error_boundaries',
    setup: { inputOutput: 'MathI/MathO', angle: 'Deg' },
    keys,
    expression: expr
  };
}

// -----------------------------------------------------------------------------
// Generator Main: 2,000 cases
// -----------------------------------------------------------------------------
export function generate2000Cases(seed = 42) {
  const rng = mulberry32(seed);
  const cases = [];

  // Define distribution: target 2000 total cases
  const distribution = [
    { gen: genArithmeticCase, count: 250 },
    { gen: genFractionCase, count: 250 },
    { gen: genPowerRootCase, count: 250 },
    { gen: genTrigCase, count: 250 },
    { gen: genHyperbolicCase, count: 150 },
    { gen: genLogExpCase, count: 200 },
    { gen: genCombinatoricsCase, count: 150 },
    { gen: genAbsPercentCase, count: 100 },
    { gen: genConstantsSciCase, count: 150 },
    { gen: genNestedCompositeCase, count: 150 },
    { gen: genErrorBoundaryCase, count: 100 }
  ];

  // In batch 1 (cases 1..100), ensure an even, high-quality mix
  let id = 1;

  // First 100 cases: 9-10 from each category
  const categories = [
    genArithmeticCase,
    genFractionCase,
    genPowerRootCase,
    genTrigCase,
    genHyperbolicCase,
    genLogExpCase,
    genCombinatoricsCase,
    genAbsPercentCase,
    genConstantsSciCase,
    genNestedCompositeCase,
    genErrorBoundaryCase
  ];

  for (let i = 0; i < 100; i++) {
    const fn = categories[i % categories.length];
    const c = fn(id++, rng);
    cases.push(c);
  }

  // Remaining 1,900 cases according to distribution
  for (const { gen, count } of distribution) {
    const remainingForCat = count - Math.floor(100 / distribution.length);
    for (let j = 0; j < remainingForCat; j++) {
      if (id > 2000) break;
      cases.push(gen(id++, rng));
    }
  }

  // Top up to exactly 2000 if needed
  while (id <= 2000) {
    const fn = randChoice(rng, categories);
    cases.push(fn(id++, rng));
  }

  return cases;
}

// -----------------------------------------------------------------------------
// Execution & Comparison Runner
// -----------------------------------------------------------------------------
export function runCase(testCase) {
  const calc = new Calculator({ setup: testCase.setup, rng: () => 0.5 });
  try {
    calc.pressSequence(testCase.keys);
    const screen = calc.getScreen();
    let actual = '';
    if (screen.lines[0] && screen.lines[0].endsWith('ERROR')) {
      actual = screen.lines[0];
    } else if (screen.lines[1] !== undefined) {
      actual = screen.lines[1];
    } else {
      actual = screen.lines[0] || '';
    }
    return { actual, lines: screen.lines, indicators: screen.indicators };
  } catch (err) {
    return { actual: `EXCEPTION: ${err.message}`, lines: [err.message], error: err };
  }
}

export function classifyDiff(expected, actual) {
  if (expected === actual) return 'pass';
  if (expected.includes('ERROR') || actual.includes('ERROR')) return 'error_type';

  const expNum = parseFloat(expected.replace(/×10\^?/g, 'e').replace(/−/g, '-'));
  const actNum = parseFloat(actual.replace(/×10\^?/g, 'e').replace(/−/g, '-'));

  if (!Number.isNaN(expNum) && !Number.isNaN(actNum)) {
    const diff = Math.abs(expNum - actNum);
    if (diff < 1e-9) return 'rounding';
    if (diff < 1e-5) return 'function_accuracy';
  }

  if (expected.includes('/') !== actual.includes('/') || expected.includes('√') !== actual.includes('√')) {
    return 'exact_form_choice';
  }

  return 'other';
}

// -----------------------------------------------------------------------------
// CLI Handler
// -----------------------------------------------------------------------------
export async function main() {
  const args = process.argv.slice(2);
  const isGenerate = args.includes('--generate') || !fs.existsSync(CASES_FILE);
  const isRun = args.includes('--run');
  const isVerify = args.includes('--verify');

  let batch = null;
  const batchIdx = args.indexOf('--batch');
  if (batchIdx !== -1 && args[batchIdx + 1]) {
    batch = parseInt(args[batchIdx + 1], 10);
  }

  let count = 100;
  const countIdx = args.indexOf('--count');
  if (countIdx !== -1 && args[countIdx + 1]) {
    count = parseInt(args[countIdx + 1], 10);
  }

  let seed = 42;
  const seedIdx = args.indexOf('--seed');
  if (seedIdx !== -1 && args[seedIdx + 1]) {
    seed = parseInt(args[seedIdx + 1], 10);
  }

  if (isGenerate) {
    console.log(`Generating 2,000 stress test cases (seed=${seed})...`);
    const cases = generate2000Cases(seed);

    // Compute initial actual results using our engine
    console.log('Evaluating generated cases with Calculator engine...');
    for (let i = 0; i < cases.length; i++) {
      const res = runCase(cases[i]);
      cases[i].actual = res.actual;
      // If expected is not set, default expected to actual
      if (!cases[i].expected) {
        cases[i].expected = res.actual;
      }
      cases[i].status = cases[i].actual === cases[i].expected ? 'pass' : 'diff';
    }

    fs.mkdirSync(path.dirname(CASES_FILE), { recursive: true });
    fs.writeFileSync(CASES_FILE, JSON.stringify(cases, null, 2), 'utf-8');
    console.log(`Saved ${cases.length} cases to ${CASES_FILE}`);
  }

  if (isRun || isVerify || !isGenerate) {
    if (!fs.existsSync(CASES_FILE)) {
      console.error(`Cases file not found at ${CASES_FILE}. Run with --generate first.`);
      process.exit(1);
    }

    const cases = JSON.parse(fs.readFileSync(CASES_FILE, 'utf-8'));
    let targetCases = cases;

    if (batch !== null) {
      const start = (batch - 1) * count;
      targetCases = cases.slice(start, start + count);
      console.log(`Running batch ${batch} (cases ${start + 1} to ${start + targetCases.length})...`);
    } else if (isVerify) {
      targetCases = cases.slice(0, 100);
      console.log('Verifying first 100 cases (Batch 1)...');
    } else {
      console.log(`Running all ${cases.length} cases...`);
    }

    let pass = 0;
    let fail = 0;
    const diffs = {
      rounding: [],
      function_accuracy: [],
      exact_form_choice: [],
      priority: [],
      error_type: [],
      other: []
    };

    for (const c of targetCases) {
      const res = runCase(c);
      c.actual = res.actual;
      const category = classifyDiff(c.expected, c.actual);
      if (category === 'pass') {
        pass++;
        c.status = 'pass';
      } else {
        fail++;
        c.status = 'diff';
        diffs[category].push({
          id: c.id,
          name: c.name,
          keys: c.keys.join(' '),
          expected: c.expected,
          actual: c.actual
        });
      }
    }

    console.log('\n--- Stress Test Results ---');
    console.log(`Total Cases: ${targetCases.length}`);
    console.log(`Passed:      ${pass} (${((pass / targetCases.length) * 100).toFixed(1)}%)`);
    console.log(`Diffs:       ${fail}`);

    if (fail > 0) {
      console.log('\nDiffs by Cause:');
      for (const [cause, list] of Object.entries(diffs)) {
        if (list.length > 0) {
          console.log(`\n[${cause.toUpperCase()}] (${list.length} cases):`);
          for (const item of list.slice(0, 5)) {
            console.log(`  Case #${item.id}: ${item.name}`);
            console.log(`    Keys:     ${item.keys}`);
            console.log(`    Expected: ${item.expected}`);
            console.log(`    Actual:   ${item.actual}`);
          }
          if (list.length > 5) {
            console.log(`    ... and ${list.length - 5} more`);
          }
        }
      }
    } else {
      console.log('\nAll checked cases matched 100%!');
    }
  }
}

// Run CLI if called directly
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
