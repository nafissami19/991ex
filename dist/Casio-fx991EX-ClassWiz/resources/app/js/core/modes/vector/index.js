/** Mode 5: Vector. Export createApp(calc). */
import { VectorApp } from './VectorApp.js';

export function createApp(calc) {
  return new VectorApp(calc);
}
export { VectorApp } from './VectorApp.js';
export { VectorValue } from './VectorValue.js';
export { VectorEvaluator } from './VectorEvaluator.js';
