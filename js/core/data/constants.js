/**
 * Scientific constants (SHIFT 7 CONST) — 47 constants, CODATA 2010 values as the
 * User's Guide states. Grouped into the six categories of the CONST menu.
 * (VERIFY ON EMULATOR: item order inside each category and the 15-digit internal values.)
 */

import { registerToken } from '../input/tokens.js';
import { ExactValue } from '../exact/ExactValue.js';
import { Decimal15 } from '../number/Decimal15.js';
import { MenuView } from '../ui/views.js';

export const CONSTANT_GROUPS = [
  ['Universal', [
    ['h', 'h', '6.62606957e-34'],
    ['hbar', 'ħ', '1.054571726e-34'],
    ['c0', 'c₀', '299792458'],
    ['eps0', 'ε₀', '8.85418781762039e-12'],
    ['mu0', 'μ₀', '1.25663706143592e-6'],
    ['Z0', 'Z₀', '376.730313461'],
    ['G', 'G', '6.67384e-11'],
    ['lP', 'lP', '1.616199e-35'],
    ['tP', 'tP', '5.39106e-44']
  ]],
  ['Electromagnetic', [
    ['muN', 'μN', '5.05078353e-27'],
    ['muB', 'μB', '9.27400968e-24'],
    ['e', 'e', '1.602176565e-19'],
    ['Phi0', 'Φ₀', '2.067833758e-15'],
    ['G0', 'G₀', '7.7480917346e-5'],
    ['KJ', 'KJ', '4.8359787e14'],
    ['RK', 'RK', '25812.8074434']
  ]],
  ['Atomic&Nuclear', [
    ['mp', 'mp', '1.672621777e-27'],
    ['mn', 'mn', '1.674927351e-27'],
    ['me', 'me', '9.10938291e-31'],
    ['mmu', 'mμ', '1.883531475e-28'],
    ['a0', 'a₀', '5.2917721092e-11'],
    ['alpha', 'α', '7.2973525698e-3'],
    ['re', 're', '2.8179403267e-15'],
    ['lambdaC', 'λc', '2.4263102389e-12'],
    ['gammap', 'γp', '2.675222005e8'],
    ['lambdaCp', 'λcp', '1.32140985623e-15'],
    ['lambdaCn', 'λcn', '1.3195909068e-15'],
    ['Rinf', 'R∞', '10973731.568539'],
    ['mup', 'μp', '1.410606743e-26'],
    ['mue', 'μe', '-9.2847643e-24'],
    ['mun', 'μn', '-9.6623647e-27'],
    ['mumu', 'μμ', '-4.49044807e-26'],
    ['mtau', 'mτ', '3.16747e-27']
  ]],
  ['Physico-Chem', [
    ['u', 'u', '1.660538921e-27'],
    ['F', 'F', '96485.3365'],
    ['NA', 'NA', '6.02214129e23'],
    ['k', 'k', '1.3806488e-23'],
    ['Vm', 'Vm', '2.2710953e-2'],
    ['R', 'R', '8.3144621'],
    ['c1', 'c₁', '3.74177153e-16'],
    ['c2', 'c₂', '1.438777e-2'],
    ['sigma', 'σ', '5.670373e-8']
  ]],
  ['Adopted Values', [
    ['g', 'g', '9.80665'],
    ['atm', 'atm', '101325'],
    ['RK90', 'RK-90', '25812.807'],
    ['KJ90', 'KJ-90', '4.835979e14']
  ]],
  ['Other', [
    ['t', 't', '273.15']
  ]]
];

/** token id → ExactValue */
export const CONSTANT_VALUES = {};

for (const [, list] of CONSTANT_GROUPS) {
  for (const [key, sym, value] of list) {
    const id = 'const_' + key;
    registerToken(id, sym, 'value', 2, { name: 'const' });
    const d = Decimal15.fromString(value);
    CONSTANT_VALUES[id] = new ExactValue('decimal', d, d);
  }
}

export const CONSTANT_COUNT = Object.keys(CONSTANT_VALUES).length;

/** CONST menu: categories → constants (selecting inserts the constant symbol). */
export function constantsMenu(calc, insert) {
  const categories = CONSTANT_GROUPS.map(([name, list]) => ({
    label: name,
    run: (c, parent) => c.replaceView(new MenuView(c, list.map(([key, sym]) => ({
      label: sym,
      run: (cc) => {
        cc.closeAllOverlays();
        insert('const_' + key);
      }
    })), { parent, columns: 2, perPage: 3 }))
  }));
  return new MenuView(calc, categories);
}
