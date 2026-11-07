// Validates the LCD bitmap font + menu icon data (js/lcd/fonts/*).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import large from '../js/lcd/fonts/large.js';
import small from '../js/lcd/fonts/small.js';
import icons from '../js/lcd/fonts/icons.js';

const ASCII = Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCharCode(0x20 + i));
const SYMBOLS = [...'×÷−±·•∠π√∛∫ΣΠ°′″←→↑↓⇔⇒≈≤≥≠∞θσμλαβγδεηνρτφχψωΩΔħÅ▶◀▲▼■□┘ⅈ…¯ˆ⁻'];
const REQUIRED = [...ASCII, ...SYMBOLS];
const DIGITS = [...'0123456789'];
const CAPS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

const FONTS = [
  [large, { ascent: 11, descent: 3, digitW: 8 }],
  [small, { ascent: 7, descent: 2, digitW: 6 }],
];

const inkRows = (g) => g.rows.map((r, i) => (r.includes('#') ? i : -1)).filter((i) => i >= 0);

for (const [font, spec] of FONTS) {
  test(`${font.name}: metrics`, () => {
    assert.equal(font.ascent, spec.ascent);
    assert.equal(font.descent, spec.descent);
    assert.ok(font.lineHeight >= font.ascent + font.descent);
  });

  test(`${font.name}: every glyph is well-formed`, () => {
    const H = font.ascent + font.descent;
    for (const [ch, g] of Object.entries(font.glyphs)) {
      assert.equal([...ch].length, 1, `key ${JSON.stringify(ch)} must be one character`);
      if (ch === '\u0304' || ch === '\u0302') {
        assert.equal(g.w, 0, `${ch}: combining character should have w = 0`);
        assert.equal(g.rows.length, H, `${ch}: rows.length`);
        continue;
      }
      assert.ok(Number.isInteger(g.w) && g.w > 0, `${ch}: bad w`);
      assert.equal(g.rows.length, H, `${ch}: rows.length`);
      for (const r of g.rows) {
        assert.equal(r.length, g.w, `${ch}: row length != w`);
        assert.match(r, /^[.#]*$/, `${ch}: illegal character in row`);
      }
    }
  });

  test(`${font.name}: all required characters present`, () => {
    const missing = REQUIRED.filter((c) => !font.glyphs[c]);
    assert.deepEqual(missing, []);
  });

  test(`${font.name}: tabular digits with a trailing blank column`, () => {
    for (const d of DIGITS) {
      const g = font.glyphs[d];
      assert.equal(g.w, spec.digitW, `digit ${d} width`);
      assert.ok(g.rows.every((r) => r[r.length - 1] === '.'), `digit ${d} needs a blank right column`);
    }
  });

  test(`${font.name}: digits and capitals sit on the baseline, cap height = ascent`, () => {
    for (const c of [...DIGITS, ...CAPS]) {
      const rows = inkRows(font.glyphs[c]);
      assert.equal(rows[0], 0, `${c} should start on row 0`);
      assert.equal(rows[rows.length - 1], font.ascent - 1, `${c} should end on the baseline row`);
    }
  });

  test(`${font.name}: descenders go below the baseline`, () => {
    for (const c of 'gjpqy') {
      const rows = inkRows(font.glyphs[c]);
      assert.ok(rows[rows.length - 1] >= font.ascent, `${c} needs a descender`);
    }
  });

  test(`${font.name}: misc symbol rules`, () => {
    assert.equal(font.glyphs['−'].w, font.glyphs['+'].w, 'minus same width as plus');
    assert.ok(font.glyphs['-'].w <= font.glyphs['−'].w, 'hyphen not wider than minus');
    assert.ok(font.glyphs[' '].rows.every((r) => !r.includes('#')), 'space is blank');
    assert.ok(font.glyphs['.'].w < spec.digitW, 'narrow point');
  });
}

test('icons: 12 icons of exactly 48x24', () => {
  const names = ['calculate', 'complex', 'baseN', 'matrix', 'vector', 'statistics',
    'distribution', 'spreadsheet', 'table', 'equation', 'inequality', 'ratio'];
  assert.equal(icons.width, 48);
  assert.equal(icons.height, 24);
  assert.deepEqual(Object.keys(icons.icons).sort(), [...names].sort());
  for (const n of names) {
    const { rows } = icons.icons[n];
    assert.equal(rows.length, 24, `${n}: height`);
    for (const r of rows) {
      assert.equal(r.length, 48, `${n}: width`);
      assert.match(r, /^[.#]+$/, `${n}: illegal character`);
    }
    assert.ok(rows.join('').includes('#'), `${n}: has ink`);
  }
});
