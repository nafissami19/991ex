/** Mode 2: Complex. Export createApp(calc). */
import { ComplexApp } from './ComplexApp.js';

export function createApp(calc) {
  return new ComplexApp(calc);
}
