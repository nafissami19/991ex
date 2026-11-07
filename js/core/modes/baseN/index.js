/** Mode 3: Base-N. Export createApp(calc). */
import { BaseNApp } from './BaseNApp.js';

export function createApp(calc) {
  return new BaseNApp(calc);
}
