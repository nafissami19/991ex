/** Mode 7: Distribution. Export createApp(calc). */
import { DistributionApp } from './DistributionApp.js';

export function createApp(calc) {
  return new DistributionApp(calc);
}
