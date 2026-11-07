/**
 * Golden key-press tests: every JSON file under tests/golden/ (including subfolders).
 *
 * {
 *   "name": "...",
 *   "setup": { "inputOutput": "MathI/MathO", "angle": "Deg", ... },   optional
 *   "keys": ["1", "+", "2", "="],
 *   "expect": {
 *     "result": "3",                 lines[1] (the result line in Calculate-type screens)
 *     "lines": ["1+2", "3"],         the whole text screen, exactly
 *     "line": { "index": 0, "text": "…" },  one line
 *     "contains": "x=1",             some line contains this text
 *     "error": "Math ERROR",         an error screen is shown
 *     "indicators": ["Math", "D"],   these status icons are on
 *     "notIndicators": ["M"]         these are off
 *   },
 *   "expectedFail": true, "pendingPrompt": "…"   → reported as todo
 * }
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Calculator } from '../js/core/Calculator.js';

const GOLDEN_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'golden');

function listCases(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listCases(p));
    else if (entry.name.endsWith('.json')) out.push(p);
  }
  return out;
}

describe('Golden key-press tests', () => {
  for (const file of listCases(GOLDEN_DIR)) {
    const testCase = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const rel = path.relative(GOLDEN_DIR, file);
    const opts = testCase.expectedFail ? { todo: testCase.pendingPrompt || 'expected to fail' } : {};

    it(`${rel}: ${testCase.name || ''}`, opts, () => {
      const calc = new Calculator({ setup: testCase.setup, rng: () => 0.5 });
      calc.pressSequence(testCase.keys);
      const screen = calc.getScreen();
      const e = testCase.expect || {};
      const where = `keys [${testCase.keys.join(' ')}] → lines ${JSON.stringify(screen.lines)}`;

      for (const ind of e.indicators || []) {
        assert.ok(screen.indicators.includes(ind), `indicator "${ind}" should be on; on: [${screen.indicators}] (${where})`);
      }
      for (const ind of e.notIndicators || []) {
        assert.ok(!screen.indicators.includes(ind), `indicator "${ind}" should be off (${where})`);
      }
      if (e.error) {
        assert.ok(screen.lines.some((l) => l.includes(e.error)), `expected error "${e.error}" (${where})`);
      }
      if (e.lines) assert.deepEqual(screen.lines, e.lines, where);
      if (e.line) assert.equal(screen.lines[e.line.index], e.line.text, where);
      if (e.contains) assert.ok(screen.lines.some((l) => l.includes(e.contains)), `expected "${e.contains}" (${where})`);
      if (e.result !== undefined) {
        const resultLine = screen.lines[1] !== undefined ? screen.lines[1] : screen.lines[0];
        assert.equal(resultLine, e.result, where);
      }
      if (e.poweredOn !== undefined) {
        assert.equal(screen.poweredOn, e.poweredOn, `expected poweredOn === ${e.poweredOn} (${where})`);
      }
      if (e.contrast !== undefined) {
        assert.equal(screen.contrast, e.contrast, `expected contrast === ${e.contrast} (${where})`);
      }
    });
  }
});
