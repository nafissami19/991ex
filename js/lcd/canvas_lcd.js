/**
 * Canvas LCD: draws the core's 192x63 framebuffer and the 192x8 status bar.
 * Browser only. Dots are mapped onto whole device pixels, so nothing is ever blurred.
 */

export const LCD_W = 192;
export const LCD_H = 63;
export const STATUS_W = 192;
export const STATUS_H = 8;
export const DEFAULT_CONTRAST = 8;

// Icon x-ranges (inclusive) in status_bar_1x.png, measured once by script from the image.
export const STATUS_ICONS = [
  ['S', 0, 5], ['A', 8, 13], ['M', 18, 22], ['STO', 27, 36], ['Math', 40, 53],
  ['D', 57, 62], ['R', 64, 69], ['G', 71, 76], ['FIX', 82, 92], ['SCI', 95, 105],
  ['E', 110, 115], ['i', 119, 122], ['∠', 124, 130], ['Disp', 132, 138],
  ['Left', 142, 147], ['Down', 149, 155], ['Up', 156, 162], ['Right', 164, 169],
  ['Pause', 172, 180], ['Solar', 184, 191],
].map(([name, x0, x1]) => ({ name, x0, x1 }));

const FALLBACK_DISPLAY = {
  matrixWidth: LCD_W, matrixHeight: LCD_H,
  // Measured from official emulator screenshots.
  backgroundColor: '#C9D5CA', pixelOnColor: '#414540',
};

export async function loadLcdConfig(url = 'assets/data/lcd_config.json') {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (e) {
    console.warn('lcd_config.json not loaded, using defaults', e);
    return { display: FALLBACK_DISPLAY };
  }
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const n = m ? parseInt(m[1], 16) : 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
// Little-endian RGBA packed into one Uint32 (every browser we target is little-endian).
const pack = ([r, g, b]) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;

/** Dot colour for a contrast level 0..15: 8 = the configured colour, lower = fainter, higher = darker. */
export function dotColor(bg, on, contrast = DEFAULT_CONTRAST) {
  const c = Math.max(0, Math.min(15, Number.isFinite(contrast) ? contrast : DEFAULT_CONTRAST));
  if (c <= DEFAULT_CONTRAST) return mix(bg, on, 0.25 + 0.75 * (c / DEFAULT_CONTRAST));
  return mix(on, [0, 0, 0], 0.6 * (c - DEFAULT_CONTRAST) / (15 - DEFAULT_CONTRAST));
}

/**
 * Largest scale <= s whose dot size (unitPx * scale * dpr) is a whole number of device pixels,
 * if that is within `tolerance` of s; otherwise s itself.
 */
export function snapScale(s, unitPx, dpr = window.devicePixelRatio || 1, tolerance = 0.1) {
  const dot = unitPx * s * dpr;
  const whole = Math.floor(dot);
  if (whole >= 1 && whole / dot >= 1 - tolerance) return whole / (unitPx * dpr);
  return s;
}

/** Synthetic test pattern for checking the drawing path without a working core. */
export function makeTestPattern() {
  const p = new Uint8Array(LCD_W * LCD_H);
  for (let y = 0; y < LCD_H; y++) {
    for (let x = 0; x < LCD_W; x++) {
      const border = x === 0 || y === 0 || x === LCD_W - 1 || y === LCD_H - 1;
      const diag = x - 64 === y || 190 - x === y;
      const checker = x >= 4 && x < 36 && y >= 4 && y < 20 && ((x + y) & 1);
      const bars = y >= 40 && y < 58 && x >= 4 && x < 60 && x % 4 < 2;
      p[y * LCD_W + x] = border || diag || checker || bars ? 1 : 0;
    }
  }
  return p;
}

// Which source dot each device pixel falls in (rounded boundaries: integer scale when possible).
function buildMap(devicePx, dots) {
  const map = new Uint16Array(devicePx);
  for (let i = 0; i < devicePx; i++) map[i] = Math.min(dots - 1, Math.floor(((i + 0.5) * dots) / devicePx));
  return map;
}

class Surface {
  constructor(canvas, w, h) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = w;
    this.h = h;
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    const W = Math.max(this.w, Math.round(r.width * dpr) || this.w);
    const H = Math.max(this.h, Math.round(r.height * dpr) || this.h);
    if (this.canvas.width !== W || this.canvas.height !== H || !this.img) {
      this.canvas.width = W;
      this.canvas.height = H;
      this.img = this.ctx.createImageData(W, H);
      this.buf = new Uint32Array(this.img.data.buffer);
      this.colMap = buildMap(W, this.w);
      this.rowMap = buildMap(H, this.h);
    }
  }

  // intensityAt(x, y) -> 0..1 for each source dot; device rows sharing a source row are copied.
  paint(intensityAt, bgRgb, dotRgb) {
    const { buf, colMap, rowMap, canvas } = this;
    const W = canvas.width, H = canvas.height;
    const bg = pack(bgRgb);
    const full = pack(dotRgb);
    const rowCache = new Uint32Array(W);
    let lastRow = -1;
    for (let y = 0; y < H; y++) {
      const sy = rowMap[y];
      if (sy !== lastRow) {
        for (let x = 0; x < W; x++) {
          const v = intensityAt(colMap[x], sy);
          rowCache[x] = v <= 0 ? bg : v >= 1 ? full : pack(mix(bgRgb, dotRgb, v));
        }
        lastRow = sy;
      }
      buf.set(rowCache, y * W);
    }
    this.ctx.putImageData(this.img, 0, 0);
  }
}

export class CanvasLCD {
  /**
   * @param {HTMLCanvasElement} mainCanvas  192x63 dot matrix
   * @param {HTMLCanvasElement} statusCanvas 192x8 status bar (optional)
   * @param {object} display lcd_config.json "display" section
   */
  constructor(mainCanvas, statusCanvas, display = FALLBACK_DISPLAY) {
    this.bg = hexToRgb(display.backgroundColor || FALLBACK_DISPLAY.backgroundColor);
    this.on = hexToRgb(display.pixelOnColor || FALLBACK_DISPLAY.pixelOnColor);
    this.main = new Surface(mainCanvas, LCD_W, LCD_H);
    this.status = statusCanvas ? new Surface(statusCanvas, STATUS_W, STATUS_H) : null;
    this.iconMask = null; // Float32Array(192*8) darkness from status_bar_1x.png, or null
    this.iconOwner = new Int8Array(STATUS_W).fill(-1);
    STATUS_ICONS.forEach((ic, i) => { for (let x = ic.x0; x <= ic.x1; x++) this.iconOwner[x] = i; });
    this.last = null;
  }

  /** Loads the icon artwork; on failure icons are simply not drawn. */
  async loadStatusIcons(url = 'assets/images/status_bar_1x.png') {
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = STATUS_W;
      c.height = STATUS_H;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, STATUS_W, STATUS_H);
      const d = ctx.getImageData(0, 0, STATUS_W, STATUS_H).data;
      const mask = new Float32Array(STATUS_W * STATUS_H);
      for (let i = 0; i < mask.length; i++) {
        const lum = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255;
        mask[i] = Math.max(0, Math.min(1, 1 - lum)) * (d[i * 4 + 3] / 255);
      }
      this.iconMask = mask;
    } catch (e) {
      console.warn('Status bar icons unavailable (status_bar_1x.png is local-only):', e?.message || e);
      this.iconMask = null;
    }
    if (this.last) this.draw(this.last);
  }

  /** Call after the canvases' CSS size changes. */
  resize() {
    this.main.resize();
    this.status?.resize();
    if (this.last) this.draw(this.last);
  }

  /** scr: { pixels, indicators, contrast, poweredOn } (any field may be missing). */
  draw(scr = {}) {
    this.last = scr;
    const on = scr.poweredOn !== false;
    const dot = dotColor(this.bg, this.on, scr.contrast);
    const px = on && scr.pixels && scr.pixels.length >= LCD_W * LCD_H ? scr.pixels : null;
    this.main.paint(px ? (x, y) => px[y * LCD_W + x] : () => 0, this.bg, dot);

    if (!this.status) return;
    const mask = on ? this.iconMask : null;
    const active = new Uint8Array(STATUS_ICONS.length);
    if (mask && Array.isArray(scr.indicators)) {
      STATUS_ICONS.forEach((ic, i) => { if (scr.indicators.includes(ic.name)) active[i] = 1; });
    }
    const owner = this.iconOwner;
    this.status.paint(
      mask ? (x, y) => (owner[x] >= 0 && active[owner[x]] ? mask[y * STATUS_W + x] : 0) : () => 0,
      this.bg, dot,
    );
  }
}
