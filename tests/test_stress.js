/**
 * tests/test_stress.js
 *
 * Unit tests for Prompt 36 — Accuracy stress test.
 * Verifies:
 *   1. PRNG determinism and repeatability
 *   2. Generator generates exactly 2,000 cases with full category coverage
 *   3. First batch of 100 cases match 100% with zero unhandled exceptions
 *   4. Classification of difference types
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mulberry32,
  generate2000Cases,
  runCase,
  classifyDiff
} from '../scripts/stress.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CASES_FILE = path.join(__dirname, 'stress', 'cases.json');

describe('Prompt 36 — Accuracy Stress Test Harness', () => {
  it('mulberry32 PRNG produces deterministic sequences', () => {
    const rng1 = mulberry32(12345);
    const rng2 = mulberry32(12345);
    for (let i = 0; i < 20; i++) {
      assert.equal(rng1(), rng2());
    }
  });

  it('generate2000Cases generates exactly 2,000 cases with diverse categories', () => {
    const cases = generate2000Cases(42);
    assert.equal(cases.length, 2000);

    const categories = new Set(cases.map((c) => c.category));
    assert.ok(categories.has('arithmetic'));
    assert.ok(categories.has('fractions'));
    assert.ok(categories.has('powers_and_roots'));
    assert.ok(categories.has('trigonometry'));
    assert.ok(categories.has('hyperbolic'));
    assert.ok(categories.has('logarithms_and_exponentials'));
    assert.ok(categories.has('combinatorics_and_factorials'));
    assert.ok(categories.has('absolute_and_percentage'));
    assert.ok(categories.has('constants_and_scientific'));
    assert.ok(categories.has('nested_composite'));
    assert.ok(categories.has('error_boundaries'));
    assert.equal(categories.size, 11);
  });

  it('tests/stress/cases.json exists and contains 2,000 valid cases', () => {
    assert.ok(fs.existsSync(CASES_FILE), 'cases.json should exist');
    const cases = JSON.parse(fs.readFileSync(CASES_FILE, 'utf-8'));
    assert.equal(cases.length, 2000);

    for (let i = 0; i < 100; i++) {
      const c = cases[i];
      assert.ok(c.id > 0);
      assert.ok(Array.isArray(c.keys));
      assert.ok(c.keys.length > 0);
      assert.equal(c.keys[c.keys.length - 1], '=');
      assert.ok(c.setup);
      assert.ok(c.expression);
      assert.ok(c.expected !== undefined);
      assert.ok(c.actual !== undefined);
    }
  });

  it('evaluates the first batch of 100 cases with 100% agreement', () => {
    const cases = JSON.parse(fs.readFileSync(CASES_FILE, 'utf-8'));
    const batch1 = cases.slice(0, 100);

    let passCount = 0;
    const failures = [];

    for (const c of batch1) {
      const res = runCase(c);
      const diffType = classifyDiff(c.expected, res.actual);
      if (diffType === 'pass') {
        passCount++;
      } else {
        failures.push({
          id: c.id,
          name: c.name,
          diffType,
          expected: c.expected,
          actual: res.actual,
          lines: res.lines
        });
      }
    }

    assert.equal(failures.length, 0, `Expected 0 failures in first 100 cases, got ${failures.length}: ${JSON.stringify(failures, null, 2)}`);
    assert.equal(passCount, 100);
  });

  it('classifyDiff correctly categorizes discrepancies', () => {
    assert.equal(classifyDiff('3.141592654', '3.141592654'), 'pass');
    assert.equal(classifyDiff('Math ERROR', 'Math ERROR'), 'pass');
    assert.equal(classifyDiff('Math ERROR', '3.14'), 'error_type');
    assert.equal(classifyDiff('3.14', 'Syntax ERROR'), 'error_type');
    assert.equal(classifyDiff('1/2', '0.5'), 'exact_form_choice');
    assert.equal(classifyDiff('√2', '1.414213562'), 'exact_form_choice');
    assert.equal(classifyDiff('0.1234567891', '0.1234567892'), 'rounding');
    assert.equal(classifyDiff('1.000000000', '1.000001000'), 'function_accuracy');
  });
});
