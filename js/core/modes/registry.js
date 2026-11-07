/**
 * The 12 calculation modes in MENU order. Each mode lives in its own folder
 * (js/core/modes/<name>/index.js) and exports createApp(calc).
 *
 * An app implements: onKey(ev) → boolean, render(screen), and optionally
 * onEnter(), onExit(), reset(), indicators(set), clearHistory(), notify(event),
 * onSetupChanged(), toJSON()/fromJSON().
 */

import { CalcApp } from '../apps/CalcApp.js';
import * as complex from './complex/index.js';
import * as baseN from './baseN/index.js';
import * as matrix from './matrix/index.js';
import * as vector from './vector/index.js';
import * as statistics from './statistics/index.js';
import * as distribution from './distribution/index.js';
import * as spreadsheet from './spreadsheet/index.js';
import * as table from './table/index.js';
import * as equation from './equation/index.js';
import * as inequality from './inequality/index.js';
import * as ratio from './ratio/index.js';

export const MODES = [
  { id: 1, key: '1', name: 'Calculate', icon: 'calculate', create: (c) => new CalcApp(c) },
  { id: 2, key: '2', name: 'Complex', icon: 'complex', create: complex.createApp },
  { id: 3, key: '3', name: 'Base-N', icon: 'baseN', create: baseN.createApp },
  { id: 4, key: '4', name: 'Matrix', icon: 'matrix', create: matrix.createApp },
  { id: 5, key: '5', name: 'Vector', icon: 'vector', create: vector.createApp },
  { id: 6, key: '6', name: 'Statistics', icon: 'statistics', create: statistics.createApp },
  { id: 7, key: '7', name: 'Distribution', icon: 'distribution', create: distribution.createApp },
  { id: 8, key: '8', name: 'Spreadsheet', icon: 'spreadsheet', create: spreadsheet.createApp },
  { id: 9, key: '9', name: 'Table', icon: 'table', create: table.createApp },
  { id: 10, key: 'A', name: 'Equation/Func', icon: 'equation', create: equation.createApp },
  { id: 11, key: 'B', name: 'Inequality', icon: 'inequality', create: inequality.createApp },
  { id: 12, key: 'C', name: 'Ratio', icon: 'ratio', create: ratio.createApp }
];

export function modeById(id) {
  return MODES.find((m) => m.id === id) || MODES[0];
}
