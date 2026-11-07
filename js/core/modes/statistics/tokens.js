/**
 * Token registrations for Statistics Mode (Mode 6).
 */

import { registerToken } from '../../input/tokens.js';

export const STAT_VARIABLES = [
  // Summation
  ['stat_sum_x', 'Σx'],
  ['stat_sum_x2', 'Σx²'],
  ['stat_sum_y', 'Σy'],
  ['stat_sum_y2', 'Σy²'],
  ['stat_sum_xy', 'Σxy'],
  ['stat_sum_x3', 'Σx³'],
  ['stat_sum_x2y', 'Σx²y'],
  ['stat_sum_x4', 'Σx⁴'],

  // Variable
  ['stat_mean_x', 'x̄'],
  ['stat_mean_y', 'ȳ'],
  ['stat_var_pop_x', 'σ²x'],
  ['stat_var_pop_y', 'σ²y'],
  ['stat_sd_pop_x', 'σx'],
  ['stat_sd_pop_y', 'σy'],
  ['stat_var_sample_x', 's²x'],
  ['stat_var_sample_y', 's²y'],
  ['stat_sd_sample_x', 'sx'],
  ['stat_sd_sample_y', 'sy'],
  ['stat_n', 'n'],

  // Min/Max/Quartiles
  ['stat_min_x', 'min(x)'],
  ['stat_max_x', 'max(x)'],
  ['stat_min_y', 'min(y)'],
  ['stat_max_y', 'max(y)'],
  ['stat_q1', 'Q1'],
  ['stat_med', 'Med'],
  ['stat_q3', 'Q3'],

  // Regression coefficients
  ['stat_a', 'a'],
  ['stat_b', 'b'],
  ['stat_c', 'c'],
  ['stat_r', 'r']
];

for (const [id, text] of STAT_VARIABLES) {
  registerToken(id, text, 'value', 2, { name: 'stat', statVar: id });
}
