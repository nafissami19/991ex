/**
 * System screens: MENU (mode icons), SETUP, RESET, Contrast.
 */

import ORIGINAL_ICONS from '../../lcd/fonts/icons.js';
import { MenuView, ConfirmView, MessageView, DigitPromptView } from '../ui/views.js';
import { MODES } from '../modes/registry.js';
import { defaultSetup } from '../setup.js';
import { ROW_PITCH } from '../ui/Screen.js';

// MENU icons traced from the official emulator (local-only, scripts/lcd_from_screenshots.py).
// Traced cells include their frame and number badge; the original icons are plain 48x24 pictures.
let TRACED_ICONS = null;
try {
  TRACED_ICONS = (await import('../../lcd/fonts/lcd_icons.js')).default;
} catch {
  TRACED_ICONS = null;
}
const ICONS = TRACED_ICONS || ORIGINAL_ICONS;

// Pre-parse icon bitmaps
for (const icon of Object.values(ICONS.icons)) {
  if (!icon.bits) icon.bits = icon.rows.map((r) => [...r].map((c) => (c === '#' ? 1 : 0)));
}

/**
 * Selected cell, as on the official screen: everything above the bottom line is inverted inside a
 * rounded box (so the dark number badge becomes a light notch with a dark digit) and the bottom
 * line disappears.
 */
function drawSelectedCell(fb, x, y) {
  fb.hline(x + 2, x + 46, y + 22, 0);
  fb.invertRect(x + 1, y, 47, 22);
  for (const [dx, dy] of [[1, 0], [46, 0], [47, 0], [1, 21]]) fb.set(x + dx, y + dy, 0);
}

const LETTER_KEYS = {
  NEG: 10, A: 10, a: 10,
  DEG: 11, B: 11, b: 11,
  INV: 12, C: 12, c: 12
}; // A, B, C (red letters)

// ------------------------------------------------------------------ MENU

/**
 * 12 icons in a 4-column grid (cells 48×24, two rows visible). Arrows move the
 * highlight (wrapping), 1–9 / A B C jump straight to a mode, = enters.
 */
export class MainMenuView {
  constructor(calc) {
    this.calc = calc;
    this.isOverlay = true;
    this.isMainMenu = true;
    this.sel = Math.max(0, MODES.findIndex((m) => m.id === calc.mode));
    const row = Math.floor(this.sel / 4);
    this.topRow = Math.min(1, Math.max(0, row <= 1 ? 0 : 1));
  }

  select(i) {
    this.sel = (i + MODES.length) % MODES.length;
    const row = Math.floor(this.sel / 4);
    if (row < this.topRow) this.topRow = row;
    if (row > this.topRow + 1) this.topRow = row - 1;
  }

  onKey(ev) {
    const k = ev.key;
    if (k === 'RIGHT') this.select(this.sel + 1);
    else if (k === 'LEFT') this.select(this.sel - 1);
    else if (k === 'DOWN') this.select(this.sel + 4 >= MODES.length ? this.sel % 4 : this.sel + 4);
    else if (k === 'UP') this.select(this.sel - 4 < 0 ? (this.sel % 4) + 8 : this.sel - 4);
    else if ((k === 'EXE' || k === '=') && !ev.shift) this.calc.setMode(MODES[this.sel].id);
    else if (/^[1-9]$/.test(k) && !ev.shift) this.calc.setMode(MODES[Number(k) - 1].id);
    else if (LETTER_KEYS[k] && !ev.shift) this.calc.setMode(MODES[LETTER_KEYS[k] - 1].id);
    else if ((k === 'AC' || k === 'MENU') && !ev.shift) this.calc.closeAllOverlays();
    return true;
  }

  indicators(set) {
    set.clear();
    if (this.topRow === 0) set.add('Down');
    else set.add('Up');
  }

  render(scr) {
    scr.fb.clear();
    const lines = [];
    for (let r = 0; r < 2; r++) {
      const rowIdx = this.topRow + r;
      const names = [];
      for (let c = 0; c < 4; c++) {
        const i = rowIdx * 4 + c;
        const m = MODES[i];
        if (!m) continue;
        const x = c * 48;
        const y = TRACED_ICONS ? 2 + r * 24 : r * 24;
        const icon = ICONS.icons[m.icon];
        if (icon) scr.fb.blitBits(icon.bits, x, y);
        if (i === this.sel) {
          if (TRACED_ICONS) drawSelectedCell(scr.fb, x, y);
          else scr.fb.invertRect(x, y, 48, 24);
        }
        names.push(i === this.sel ? `[${m.name}]` : m.name);
      }
      lines.push(names.join(' '));
    }

    // Bottom line: normal dark text on light LCD background
    const selected = MODES[this.sel];
    scr.fb.drawTextTop(1, 50, `${selected.key}:${selected.name}`, 'large');
    lines.push(`${selected.key}:${selected.name}`);
    scr.lines = lines;
  }
}

// ------------------------------------------------------------------ SETUP

export function setupMenu(calc) {
  const s = calc.setup;
  const choose = (options, apply) => (c, parent) => c.replaceView(new MenuView(c, options.map(([label, value]) => ({
    label,
    current: value.current,
    run: (cc) => {
      apply(value.v, cc);
      cc.closeAllOverlays();
      cc.setupChanged();
    }
  })), { parent }));
  const opt = (label, v, cur) => [label, { v, current: cur }];

  const ioItems = ['MathI/MathO', 'MathI/DecimalO', 'LineI/LineO', 'LineI/DecimalO'].map((io) => opt(io, io, s.inputOutput === io));
  const items = [
    { label: 'Input/Output', run: choose(ioItems, (v, c) => c.setInputOutput(v)) },
    { label: 'Angle Unit', run: choose([opt('Degree', 'DEG', s.angle === 'DEG'), opt('Radian', 'RAD', s.angle === 'RAD'), opt('Gradian', 'GRA', s.angle === 'GRA')], (v, c) => { c.setup.angle = v; }) },
    {
      label: 'Number Format',
      run: (c, parent) => c.replaceView(new MenuView(c, [
        { label: 'Fix', current: s.numberFormat.type === 'FIX', run: (cc, p2) => cc.replaceView(new DigitPromptView(cc, 'Fix 0~9?', 0, 9, (n, c3) => { c3.setup.numberFormat = { type: 'FIX', value: n }; c3.closeAllOverlays(); c3.setupChanged(); }, { parent: p2 })) },
        { label: 'Sci', current: s.numberFormat.type === 'SCI', run: (cc, p2) => cc.replaceView(new DigitPromptView(cc, 'Sci 0~9?', 0, 9, (n, c3) => { c3.setup.numberFormat = { type: 'SCI', value: n }; c3.closeAllOverlays(); c3.setupChanged(); }, { parent: p2 })) },
        { label: 'Norm', current: s.numberFormat.type === 'NORM', run: (cc, p2) => cc.replaceView(new DigitPromptView(cc, 'Norm 1~2?', 1, 2, (n, c3) => { c3.setup.numberFormat = { type: 'NORM', value: n }; c3.closeAllOverlays(); c3.setupChanged(); }, { parent: p2 })) }
      ], { parent }))
    },
    { label: 'Engineer Symbol', run: choose([opt('On', true, s.engSymbol), opt('Off', false, !s.engSymbol)], (v, c) => { c.setup.engSymbol = v; }) },
    { label: 'Fraction Result', run: choose([opt('ab/c', 'MIXED', s.fraction === 'MIXED'), opt('d/c', 'IMPROPER', s.fraction === 'IMPROPER')], (v, c) => { c.setup.fraction = v; }) },
    { label: 'Complex', run: choose([opt('a+bi', 'RECT', s.complex === 'RECT'), opt('r∠θ', 'POLAR', s.complex === 'POLAR')], (v, c) => { c.setup.complex = v; }) },
    { label: 'Statistics', run: choose([opt('On', true, s.statFreq), opt('Off', false, !s.statFreq)], (v, c) => { if (c.setup.statFreq !== v) { c.setup.statFreq = v; c.notifyMode('statFreqChanged'); } }) },
    {
      label: 'Spreadsheet',
      run: (c, parent) => c.replaceView(new MenuView(c, [
        { label: 'Auto Calc', run: choose([opt('On', true, s.autoCalc), opt('Off', false, !s.autoCalc)], (v, c3) => { c3.setup.autoCalc = v; }) },
        { label: 'Show Cell', run: choose([opt('Formula', 'FORMULA', s.showCell === 'FORMULA'), opt('Value', 'VALUE', s.showCell === 'VALUE')], (v, c3) => { c3.setup.showCell = v; }) }
      ], { parent }))
    },
    { label: 'Equation/Func', run: choose([opt('On', true, s.eqComplex), opt('Off', false, !s.eqComplex)], (v, c) => { c.setup.eqComplex = v; }) },
    { label: 'Table', run: choose([opt('f(x)', 'F', s.table === 'F'), opt('f(x),g(x)', 'FG', s.table === 'FG')], (v, c) => { c.setup.table = v; }) },
    { label: 'Decimal Mark', run: choose([opt('Dot', 'DOT', s.decimalMark === 'DOT'), opt('Comma', 'COMMA', s.decimalMark === 'COMMA')], (v, c) => { c.setup.decimalMark = v; }) },
    { label: 'Digit Separator', run: choose([opt('On', true, s.digitSeparator), opt('Off', false, !s.digitSeparator)], (v, c) => { c.setup.digitSeparator = v; }) },
    { label: 'MultiLine Font', run: choose([opt('Normal Font', 'NORMAL', s.multiLineFont === 'NORMAL'), opt('Small Font', 'SMALL', s.multiLineFont === 'SMALL')], (v, c) => { c.setup.multiLineFont = v; }) },
    { label: 'QR Code', run: choose([opt('Version 3', 3, s.qrVersion === 3), opt('Version 11', 11, s.qrVersion === 11)], (v, c) => { c.setup.qrVersion = v; }) },
    { label: 'Contrast', run: (c) => c.replaceView(new ContrastView(c)) },
    {
      label: 'Auto Power Off',
      run: choose([opt('10 Min.', 10, s.autoPowerOff === 10), opt('60 Min.', 60, s.autoPowerOff === 60)], (v, c) => { c.setup.autoPowerOff = v; })
    }
  ];
  return new MenuView(calc, items);
}

/** Contrast: ◀ lighter, ▶ darker, AC/EXE closes. */
export class ContrastView {
  constructor(calc) {
    this.calc = calc;
    this.isOverlay = true;
  }

  onKey(ev) {
    const s = this.calc.setup;
    if (ev.key === 'LEFT') s.contrast = Math.max(0, s.contrast - 1);
    else if (ev.key === 'RIGHT') s.contrast = Math.min(15, s.contrast + 1);
    else if ((ev.key === 'AC' || ev.key === 'EXE') && !ev.shift) this.calc.closeAllOverlays();
    return true;
  }

  render(scr) {
    scr.row(0, 'Contrast');
    scr.text(1, 1 + ROW_PITCH * 1, 'LIGHT', { font: 'small' });
    scr.text(0, 1 + ROW_PITCH * 1, 'DARK', { font: 'small', align: 'right', right: 190 });
    const x0 = 20;
    const w = 150;
    const y = 1 + ROW_PITCH * 2;
    scr.fb.hline(x0, x0 + w, y + 4);
    const pos = x0 + Math.round((w * this.calc.setup.contrast) / 15);
    scr.fb.fillRect(pos - 2, y, 5, 9, 1);
    scr.text(1, 1 + ROW_PITCH * 3, '[◀]   [▶]', { font: 'small' });
    scr.lines = ['Contrast', `LIGHT ${this.calc.setup.contrast} DARK`];
  }
}

// ------------------------------------------------------------------ RESET

export function resetMenu(calc) {
  const confirm = (question, action, done) => (c) => c.replaceView(new ConfirmView(c, question, (cc) => {
    action(cc);
    cc.replaceView(new MessageView(cc, [done, null, 'Press [AC] Key'], {
      onClose: (c3) => c3.closeAllOverlays()
    }));
  }));
  return new MenuView(calc, [
    { label: 'Setup Data', run: confirm('Reset Setup Data?', (c) => c.resetSetup(), 'Reset Setup Data') },
    { label: 'Memory', run: confirm('Clear All Memory?', (c) => c.resetMemory(), 'Clear Memory') },
    { label: 'Initialize All', run: confirm('Initialize All?', (c) => c.initializeAll(), 'Reset All') }
  ]);
}

export { defaultSetup };
