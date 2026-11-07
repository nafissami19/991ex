/**
 * Performance and Key-Press Latency Benchmark Tests (Prompt 37).
 *
 * Verifies that key presses across all 12 calculator modes process and render
 * well under the 16 ms budget (60 FPS responsiveness).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Calculator } from '../js/core/Calculator.js';

describe('Prompt 37 — Performance and Key Latency', () => {
  const modesBenchmark = [
    { name: 'Mode 1: Calculate', keys: '1 + 2 * 3 = sin 3 0 ) = FRAC 1 DOWN 2 RIGHT + 3 = SQRT 8 RIGHT =' },
    { name: 'Mode 2: Complex', keys: 'MENU 2 1 + 2 ENG + 3 - 4 ENG =' },
    { name: 'Mode 3: Base-N', keys: 'MENU 3 HEX 1 A + B = DEC 1 0 0 =' },
    { name: 'Mode 4: Matrix', keys: 'MENU 4 1 2 2 1 = 2 = 3 = 4 = AC OPTN 3 =' },
    { name: 'Mode 5: Vector', keys: 'MENU 5 1 2 1 = 2 = AC OPTN 3 =' },
    { name: 'Mode 6: Statistics', keys: 'MENU 6 1 1 = 2 = 3 = AC OPTN 2 DOWN DOWN' },
    { name: 'Mode 7: Distribution', keys: 'MENU 7 1 1 = 1 = 0 = =' },
    { name: 'Mode 8: Spreadsheet', keys: 'MENU 8 1 = 2 = 3 = UP UP =' },
    { name: 'Mode 9: Table', keys: 'MENU 9 X SQUARE = = = =' },
    { name: 'Mode 10: Equation/Func', keys: 'MENU A 1 2 1 = 2 = 3 = 2 = 3 = 4 = = DOWN' },
    { name: 'Mode 11: Inequality', keys: 'MENU B 2 1 1 = NEG 3 = 2 = =' },
    { name: 'Mode 12: Ratio', keys: 'MENU C 1 1 = 2 = 3 = =' }
  ];

  it('updates screen within 16 ms for every key press across all 12 modes', () => {
    let totalTime = 0;
    let totalKeys = 0;
    let maxLatency = 0;

    for (const b of modesBenchmark) {
      const calc = new Calculator();
      const keys = b.keys.split(' ');
      for (const k of keys) {
        const start = performance.now();
        calc.press(k);
        calc.render();
        const duration = performance.now() - start;

        if (duration > maxLatency) {
          maxLatency = duration;
        }
        totalTime += duration;
        totalKeys++;

        assert.ok(
          duration < 16,
          `Key "${k}" in "${b.name}" took ${duration.toFixed(2)} ms (> 16 ms threshold)`
        );
      }
    }

    const avgLatency = totalTime / totalKeys;
    assert.ok(avgLatency < 2, `Average latency ${avgLatency.toFixed(2)} ms should be < 2 ms`);
  });
});
