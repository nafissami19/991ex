/**
 * Metric conversions (SHIFT 8 CONV) — 40 commands, NIST SP 811 (2008) factors.
 * A conversion is a postfix command with priority 6 ("5 cm▸in").
 * (VERIFY ON EMULATOR: item order and the menu text of each command.)
 */

import { registerToken } from '../input/tokens.js';
import { ExactValue } from '../exact/ExactValue.js';
import { MenuView } from '../ui/views.js';

const pair = (a, b, factor) => [[`${a}▸${b}`, (x) => x.mul(dec(factor))], [`${b}▸${a}`, (x) => x.div(dec(factor))]];

function dec(s) {
  const [ip, fp = ''] = s.split('.');
  return ExactValue.fromRational(BigInt(ip + fp), 10n ** BigInt(fp.length));
}

export const CONVERSION_GROUPS = [
  ['Length', [
    ...pair('in', 'cm', '2.54'), ...pair('ft', 'm', '0.3048'), ...pair('yd', 'm', '0.9144'),
    ...pair('mile', 'km', '1.609344'), ...pair('n mile', 'm', '1852'), ...pair('pc', 'km', '30856775814913.7')
  ]],
  ['Area', [...pair('acre', 'm²', '4046.8564224')]],
  ['Volume', [...pair('gal(US)', 'L', '3.785411784'), ...pair('gal(UK)', 'L', '4.54609')]],
  ['Mass', [...pair('oz', 'g', '28.349523125'), ...pair('lb', 'kg', '0.45359237')]],
  ['Velocity', [...pair('km/h', 'm/s', '0.277777777777778').map(([l, f], i) =>
    [l, i === 0 ? (x) => x.div(ExactValue.fromRational(18n, 5n)) : (x) => x.mul(ExactValue.fromRational(18n, 5n))])]],
  ['Pressure', [
    ...pair('atm', 'Pa', '101325'), ...pair('mmHg', 'Pa', '133.322387415'),
    ...pair('kgf/cm²', 'Pa', '98066.5'), ...pair('lbf/in²', 'kPa', '6.894757293168')
  ]],
  ['Energy', [...pair('kgf·m', 'J', '9.80665'), ['J▸cal', (x) => x.div(dec('4.1855'))], ['cal▸J', (x) => x.mul(dec('4.1855'))]]],
  ['Power', [...pair('hp', 'kW', '0.74569987158227')]],
  ['Temperature', [
    ['°F▸°C', (x) => x.sub(ExactValue.fromInt(32n)).mul(ExactValue.fromRational(5n, 9n))],
    ['°C▸°F', (x) => x.mul(ExactValue.fromRational(9n, 5n)).add(ExactValue.fromInt(32n))]
  ]]
];

export const CONVERSION_IDS = [];
let n = 0;
for (const [, list] of CONVERSION_GROUPS) {
  for (const [label, fn] of list) {
    const id = `conv_${++n}`;
    registerToken(id, label, 'post', 2, { op: 'conv', prec: 65, convert: fn });
    CONVERSION_IDS.push(id);
  }
}

export function conversionsMenu(calc, insert) {
  let idx = 0;
  const categories = CONVERSION_GROUPS.map(([name, list]) => {
    const ids = list.map(() => CONVERSION_IDS[idx++]);
    return {
      label: name,
      run: (c, parent) => c.replaceView(new MenuView(c, list.map(([label], i) => ({
        label,
        run: (cc) => {
          cc.closeAllOverlays();
          insert(ids[i]);
        }
      })), { parent }))
    };
  });
  return new MenuView(calc, categories);
}
