/** Mode 6: Statistics. Export createApp(calc). */
import { StatApp } from './StatApp.js';

export function createApp(calc) {
  return new StatApp(calc);
}
