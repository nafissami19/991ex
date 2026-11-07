/**
 * Reusable overlay views. A view has onKey(ev) → boolean and render(screen).
 * Overlays are pushed on Calculator's view stack and popped with calc.closeView().
 *
 * Menu layout: up to 4 numbered items per page ("1:Hyperbolic Func"), numbering restarts
 * on each page, ▲/▼ change page, a scroll bar shows when there is more than one page,
 * ◀ goes back from a sub-menu, AC closes. (VERIFY ON EMULATOR: exact spacing/marker.)
 */

import { ROW_PITCH } from './Screen.js';

const DIGIT = (k) => (/^[1-9]$/.test(k) ? Number(k) : null);

export class MenuView {
  /**
   * @param calc Calculator
   * @param items [{ label, run(calc) → any, current?: boolean }]
   * @param o { perPage = 4, parent (MenuView to return to with ◀), title, columns }
   */
  constructor(calc, items, o = {}) {
    this.calc = calc;
    this.items = items || [];
    this.customPages = o.pages || null;
    this.perPage = o.perPage || (o.title ? 3 : 4);
    this.columns = o.columns || 1;
    this.title = o.title || null;
    this.parent = o.parent || null;
    this.page = 0;
    this.isOverlay = true;
    if (!this.customPages) {
      const cur = this.items.findIndex((it) => it.current);
      if (cur >= 0) this.page = Math.floor(cur / (this.perPage * this.columns));
    }
  }

  get pageSize() {
    return this.perPage * this.columns;
  }

  get pages() {
    if (this.customPages) return Math.max(1, this.customPages.length);
    return Math.max(1, Math.ceil(this.items.length / this.pageSize));
  }

  pageItems() {
    if (this.customPages) return this.customPages[this.page] || [];
    const start = this.page * this.pageSize;
    return this.items.slice(start, start + this.pageSize);
  }

  onKey(ev) {
    if (ev.shift || ev.alpha) return false;
    const k = ev.key;
    if (k === 'AC') {
      this.calc.closeAllOverlays();
      return true;
    }
    if (k === 'LEFT' && this.parent) {
      this.calc.replaceView(this.parent);
      return true;
    }
    if (k === 'DOWN') {
      this.page = (this.page + 1) % this.pages;
      return true;
    }
    if (k === 'UP') {
      this.page = (this.page - 1 + this.pages) % this.pages;
      return true;
    }
    const n = DIGIT(k);
    if (n !== null) {
      const cur = this.pageItems();
      const idx = n - 1;
      if (idx >= 0 && idx < cur.length) {
        cur[idx].run(this.calc, this);
      }
      return true;
    }
    return true; // other keys are ignored while a menu is open
  }

  indicators(set) {
    if (this.pages > 1) {
      if (this.page > 0) set.add('Up');
      if (this.page < this.pages - 1) set.add('Down');
    }
  }

  render(scr) {
    let row = 0;
    if (this.title) {
      scr.row(0, this.title);
      row = 1;
    }
    const list = this.pageItems();
    const colW = Math.floor((this.pages > 1 ? 186 : 191) / this.columns);
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      if (!it) break;
      const r = row + (this.columns === 1 ? i : Math.floor(i / this.columns));
      const c = this.columns === 1 ? 0 : i % this.columns;
      const label = `${i + 1}:${it.label}`;
      scr.text(1 + c * colW, 1 + r * ROW_PITCH, label);
      if (it.current) scr.text(184 - (this.pages > 1 ? 6 : 0), 1 + r * ROW_PITCH, '◀', { record: false });
    }
    if (this.pages > 1) drawScrollBar(scr, this.page, this.pages, row);
  }
}

export function drawScrollBar(scr, page, pages, firstRow = 0) {
  const top = firstRow * ROW_PITCH;
  const h = 63 - top;
  const x = 190;
  scr.fb.vline(x, top, 62);
  const thumbH = Math.max(4, Math.floor(h / pages));
  const y = top + Math.floor((h - thumbH) * (pages === 1 ? 0 : page / (pages - 1)));
  scr.fb.fillRect(x - 1, y, 3, thumbH, 1);
}

/** "Reset Setup Data?" style confirmation: [=]:Yes [AC]:Cancel */
export class ConfirmView {
  constructor(calc, question, onYes, o = {}) {
    this.calc = calc;
    this.question = question;
    this.onYes = onYes;
    this.isOverlay = true;
    this.o = o;
  }

  onKey(ev) {
    if (ev.key === 'EXE' && !ev.shift && !ev.alpha) {
      this.onYes(this.calc);
      return true;
    }
    if (ev.key === 'AC' && !ev.shift) {
      this.calc.closeAllOverlays();
      return true;
    }
    return true;
  }

  render(scr) {
    const lines = Array.isArray(this.question) ? this.question : [this.question];
    lines.forEach((l, i) => scr.row(i, l));
    scr.row(2, '[=]  :Yes');
    scr.row(3, '[AC] :Cancel');
  }
}

/** Full-screen message; any listed key closes it. */
export class MessageView {
  constructor(calc, lines, o = {}) {
    this.calc = calc;
    this.lines = lines;
    this.isOverlay = true;
    this.closeKeys = o.closeKeys || ['AC'];
    this.onClose = o.onClose || null;
  }

  onKey(ev) {
    if (this.closeKeys.includes(ev.key) && !ev.shift) {
      if (this.onClose) this.onClose(this.calc, ev);
      else this.calc.closeAllOverlays();
    }
    return true;
  }

  render(scr) {
    this.lines.forEach((l, i) => {
      if (l === null) return;
      if (typeof l === 'object') scr.text(l.x ?? 1, 1 + i * ROW_PITCH, l.s, l);
      else scr.row(i, l);
    });
  }
}

/** One-digit prompt such as "Fix 0~9?" — calls onDigit(n) for n in [min, max]. */
export class DigitPromptView {
  constructor(calc, prompt, min, max, onDigit, o = {}) {
    this.calc = calc;
    this.prompt = prompt;
    this.min = min;
    this.max = max;
    this.onDigit = onDigit;
    this.parent = o.parent || null;
    this.isOverlay = true;
  }

  onKey(ev) {
    if (ev.key === 'AC' && !ev.shift) {
      this.calc.closeAllOverlays();
      return true;
    }
    if (ev.key === 'LEFT' && this.parent && !ev.shift && !ev.alpha) {
      this.calc.replaceView(this.parent);
      return true;
    }
    if (/^[0-9]$/.test(ev.key) && !ev.shift && !ev.alpha) {
      const n = Number(ev.key);
      if (n >= this.min && n <= this.max) this.onDigit(n, this.calc);
    }
    return true;
  }

  render(scr) {
    scr.row(0, this.prompt);
  }
}
