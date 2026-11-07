/**
 * Headless screen: a 192×63 framebuffer plus the text form of what is shown
 * (`lines`, used by tests and the key-log panel). Views draw through this API.
 */

import { Framebuffer, LCD_WIDTH, LCD_HEIGHT, measureText, getFont } from '../../lcd/raster.js';
import { layout } from '../../lcd/layout.js';

export const ROW_PITCH = 16; // menu / LineI rows (4 rows of large text)
export const SMALL_ROW_PITCH = 10;

export class Screen {
  constructor() {
    this.fb = new Framebuffer();
    this.lines = [];
    this.cursorVisible = true;
    this.textItems = [];
  }

  clear() {
    this.fb.clear();
    this.lines = [];
    this.textItems = [];
  }

  get pixels() {
    return this.fb.pixels;
  }

  /** Record a text line for tests (y = vertical position for ordering). */
  record(y, x, s) {
    this.textItems.push({ y, x, s });
  }

  /** Lines grouped by row, top to bottom. Views may also set `lines` directly. */
  finalizeLines() {
    if (this.lines.length) return this.lines;
    const rows = [];
    const items = [...this.textItems].sort((a, b) => a.y - b.y || a.x - b.x);
    for (const it of items) {
      const last = rows[rows.length - 1];
      if (last && Math.abs(last.y - it.y) < 4) last.s += (last.s && it.s ? ' ' : '') + it.s;
      else rows.push({ y: it.y, s: it.s });
    }
    this.lines = rows.map((r) => r.s);
    return this.lines;
  }

  /**
   * Draw text with its top edge at y.
   * opts: font ('large'|'small'), align ('left'|'right'|'center'), invert (highlight bar),
   *       width (for center/right), record (default true)
   */
  text(x, y, str, opts = {}) {
    const font = opts.font || 'large';
    str = String(str);
    const w = measureText(str, font);
    let dx = x;
    if (opts.align === 'right') dx = (opts.right ?? LCD_WIDTH - 1) - w;
    else if (opts.align === 'center') dx = x + Math.floor(((opts.width ?? LCD_WIDTH) - w) / 2);
    this.fb.drawTextTop(dx, y, str, font);
    if (opts.invert) {
      const f = getFont(font);
      this.fb.invertRect(opts.invertX ?? 0, y - 1, opts.invertW ?? LCD_WIDTH, f.ascent + 2 + (opts.extraH ?? 0));
    }
    if (opts.record !== false) this.record(y, dx, str);
    return w;
  }

  /** Text on menu row r (0–3). */
  row(r, str, opts = {}) {
    return this.text(opts.x ?? 1, 1 + r * ROW_PITCH, str, opts);
  }

  /**
   * Draw a math tree (editor items or result tree).
   * opts: x, top (or baseline), align 'left'|'right', editor {path, idx, shape}, scrollX,
   *       font, record (text), math (false for LineI)
   * Returns the layout box (w, asc, desc, cursor position).
   */
  math(items, opts = {}) {
    const box = layout(items, { font: opts.font || 'large', editor: !!opts.editor, math: opts.math });
    const baseline = opts.baseline ?? (opts.top ?? 1) + box.asc;
    let x = opts.x ?? 1;
    if (opts.align === 'right') x = (opts.right ?? LCD_WIDTH - 2) - box.w;
    x -= opts.scrollX || 0;
    box.draw(this.fb, x, baseline);
    box.originX = x;
    box.baseline = baseline;
    if (opts.editor) {
      const m = box.cursorAt(opts.editor.path, opts.editor.idx);
      box.cursor = m ? { x: x + m.dx, y: baseline + m.dy, asc: m.asc, font: m.font } : null;
      if (box.cursor && this.cursorVisible) this.drawCursor(box.cursor, opts.editor.shape);
    }
    if (opts.text !== undefined && opts.record !== false) this.record(baseline - box.asc, x, opts.text);
    return box;
  }

  /** Layout without drawing: { w, asc, desc, cursorAt(path, idx) }. */
  measure(items, opts = {}) {
    return layout(items, { font: opts.font || 'large', editor: !!opts.editor, math: opts.math });
  }

  drawCursor(c, shape = 'line') {
    const h = c.asc || (c.font === 'small' ? 8 : 12);
    const top = c.y - h + 1;
    if (shape === 'block') this.fb.fillRect(c.x, top, 5, h, 1);
    else if (shape === 'overwrite') this.fb.hline(c.x, c.x + 6, c.y + 1);
    else this.fb.vline(c.x, top, c.y);
  }

  /** Highlight (invert) a rectangle. */
  invert(x, y, w, h) {
    this.fb.invertRect(x, y, w, h);
  }

  drawArrow(x, y, dir, font = 'small') {
    return this.fb.drawArrow(x, y, dir, font);
  }

  scrollArrows(flags, font = 'small') {
    this.fb.scrollArrows(flags, font);
  }
}

export { LCD_WIDTH, LCD_HEIGHT, measureText };
