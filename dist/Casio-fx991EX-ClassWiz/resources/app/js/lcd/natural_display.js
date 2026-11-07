/**
 * Natural textbook display layout engine (MathI mode):
 * Converts editor and result trees into 2D layout boxes with baselines,
 * dimensions, cursor mark positions, and raster drawing.
 *
 * A box is { w, asc, desc, draw(fb, x, baselineY), marks }.
 *   asc/desc: pixels above/below the baseline
 *   marks: cursor positions [{ key, idx, dx, dy, asc, desc, font }] relative to the box origin
 * Exponents, limits, subscripts and indices use the small font; everything else the parent font.
 */

import { TOKENS, TEMPLATES } from '../core/input/tokens.js';
import { getFont, measureText, textExtents } from './raster.js';

export const AXIS = { large: 5, small: 3 };
export const RAISE = { large: 6, small: 4 };
export const smaller = () => 'small';
export const pathKey = (path) => JSON.stringify(path || []);

export function textBox(str, font = 'large') {
  const ext = textExtents(str, font);
  return {
    w: measureText(str, font),
    asc: ext.asc,
    desc: ext.desc,
    marks: [],
    draw(fb, x, by) {
      fb.drawText(x, by, str, font);
    }
  };
}

export function emptyBox(font = 'large') {
  const f = getFont(font);
  const w = font === 'large' ? 7 : 5;
  const h = font === 'large' ? 9 : 7;
  return {
    w: w + 1,
    asc: h,
    desc: 0,
    marks: [],
    draw(fb, x, by) {
      fb.dottedRect(x, by - h + 1, w, h);
      void f;
    }
  };
}

export function hbox(boxes, gap = 0) {
  let w = 0;
  let asc = 0;
  let desc = 0;
  const xs = [];
  for (const b of boxes) {
    xs.push(w);
    w += b.w + gap;
    asc = Math.max(asc, b.asc);
    desc = Math.max(desc, b.desc);
  }
  if (boxes.length) w -= gap;
  const marks = [];
  boxes.forEach((b, i) => {
    for (const m of b.marks) marks.push({ ...m, dx: m.dx + xs[i] });
  });
  return {
    w, asc, desc, marks,
    draw(fb, x, by) {
      boxes.forEach((b, i) => b.draw(fb, x + xs[i], by));
    }
  };
}

/** Shift a box vertically (positive dy = lower, negative dy = higher). */
export function shifted(box, dy) {
  return {
    w: box.w,
    asc: Math.max(0, box.asc - dy),
    desc: Math.max(0, box.desc + dy),
    marks: box.marks.map((m) => ({ ...m, dy: m.dy + dy })),
    draw(fb, x, by) {
      box.draw(fb, x, by + dy);
    }
  };
}

/**
 * Lay out a slot (array of tokens, templates, or text items).
 * @param {Array} items
 * @param {object} o { font, path (editor path of this slot or null), math }
 */
export function layoutSlot(items, o = {}) {
  const font = o.font || 'large';
  const path = o.path || null;
  if (items.length === 0 && path) {
    if (path.length === 0) {
      // Main root expression line: clean blank line, NO dotted box!
      const cursorExt = textExtents('0', font);
      return {
        w: 0,
        asc: cursorExt.asc,
        desc: cursorExt.desc,
        marks: [{ key: pathKey(path), idx: 0, dx: 0, dy: 0, asc: cursorExt.asc, desc: 0, font }],
        draw() {}
      };
    }
    const e = emptyBox(font);
    const cursorDx = font === 'small' ? 2 : 2;
    e.marks = [{ key: pathKey(path), idx: 0, dx: cursorDx, dy: 0, asc: e.asc, desc: 0, font }];
    return e;
  }
  const boxes = [];
  const marks = [];
  let x = 0;
  let asc = textExtents('0', font).asc;
  let desc = 0;
  let inExponent = false;
  const cursorExt = textExtents('0', font);

  items.forEach((it, i) => {
    let box;
    if (it.t === 'tok') {
      const tk = TOKENS[it.id];
      const str = it.id === 'i' ? 'ⅈ' : (tk ? tk.text : it.id);
      if (o.math !== false && inExponent && tk && (tk.kind === 'digit' || tk.kind === 'neg')) {
        box = shifted(textBox(tk.kind === 'neg' ? '-' : str, smaller(font)), -RAISE[font]);
      } else {
        box = textBox(str, font);
        inExponent = !!(tk && tk.kind === 'exp10');
      }
      if (tk && tk.kind !== 'digit' && tk.kind !== 'neg' && tk.kind !== 'exp10') inExponent = false;
    } else if (it.t === 'txt') {
      box = textBox(it.s, font);
      inExponent = false;
    } else {
      box = layoutTemplate(it, font, path ? (s) => [...path, { i, s }] : null, o);
      inExponent = false;
    }
    if (path) {
      marks.push({
        key: pathKey(path),
        idx: i,
        dx: x,
        dy: 0,
        asc: Math.max(cursorExt.asc, Math.min(box.asc, cursorExt.asc)),
        desc: 0,
        font
      });
    }
    boxes.push({ box, x });
    for (const m of box.marks) marks.push({ ...m, dx: m.dx + x });
    x += box.w;
    asc = Math.max(asc, box.asc);
    desc = Math.max(desc, box.desc);
  });

  if (path) {
    marks.push({
      key: pathKey(path),
      idx: items.length,
      dx: x,
      dy: 0,
      asc: cursorExt.asc,
      desc: 0,
      font
    });
  }

  return {
    w: x, asc, desc, marks,
    draw(fb, ox, by) {
      for (const b of boxes) b.box.draw(fb, ox + b.x, by);
    }
  };
}

export function layoutTemplate(it, font, slotPath, o) {
  const S = (s, f = font) => layoutSlot(it.slots[s], { ...o, font: f, path: slotPath ? slotPath(s) : null });
  switch (it.kind) {
    case 'frac': return fracBox(S(0), S(1), font);
    case 'mixed': return hbox([S(0), fracBox(S(1), S(2), font)], 1);
    case 'sqrt': return rootBox(S(0), null);
    case 'cbrt': return rootBox(S(0), textBox('3', 'small'));
    case 'root': return rootBox(S(1), S(0, 'small'));
    case 'pow':
    case 'sup': return supBox(S(0, 'small'), font);
    case 'pow10': return hbox([textBox('10', font), supBox(S(0, 'small'), font)]);
    case 'expe': return hbox([textBox('e', font), supBox(S(0, 'small'), font)]);
    case 'logab': return hbox([textBox('log', font), shifted(S(0, 'small'), 3), textBox('(', font), S(1), textBox(')', font)]);
    case 'abs': return absBox(S(0));
    case 'integral': return integralBox(S(0), S(1, 'small'), S(2, 'small'), font);
    case 'diff': return hbox([
      fracBox(textBox('d', font), textBox('dx', font), font),
      textBox('(', font), S(0), textBox(')', font),
      barSubBox(hbox([textBox('x=', 'small'), S(1, 'small')]))
    ]);
    case 'sum': return bigOpBox('Σ', S(0), S(1, 'small'), S(2, 'small'), font);
    default: return textBox('?', font);
  }
}

export function fracBox(N, Dn, font) {
  const axis = AXIS[font] || 5;
  const w = Math.max(N.w, Dn.w) + 2;
  const numB = -axis - 2 - N.desc; // baseline offset of numerator
  const denB = -axis + 2 + Dn.asc;
  const nx = Math.floor((w - N.w) / 2);
  const dx = Math.floor((w - Dn.w) / 2);
  const marks = [
    ...N.marks.map((m) => ({ ...m, dx: m.dx + nx, dy: m.dy + numB })),
    ...Dn.marks.map((m) => ({ ...m, dx: m.dx + dx, dy: m.dy + denB }))
  ];
  return {
    w: w + 1,
    asc: -numB + N.asc,
    desc: denB + Dn.desc,
    marks,
    draw(fb, x, by) {
      N.draw(fb, x + nx, by + numB);
      fb.hline(x, x + w - 1, by - axis);
      Dn.draw(fb, x + dx, by + denB);
    }
  };
}

export function rootBox(C, index) {
  const ix = index ? Math.max(0, index.w - 2) : 0;
  const w = ix + C.w + 6;
  const asc = C.asc + 2;
  const desc = C.desc + 1;
  const marks = C.marks.map((m) => ({ ...m, dx: m.dx + ix + 5 }));
  if (index) for (const m of index.marks) marks.push({ ...m, dx: m.dx, dy: m.dy - asc + 6 });
  return {
    w,
    asc: Math.max(asc, index ? asc + 2 : asc),
    desc,
    marks,
    draw(fb, x, by) {
      const top = by - asc;
      const bottom = by + desc - 1;
      const rx = x + ix;
      fb.line(rx, bottom - 3, rx + 1, bottom - 4);
      fb.line(rx + 1, bottom - 4, rx + 2, bottom);
      fb.line(rx + 2, bottom, rx + 4, top);
      fb.hline(rx + 4, x + w - 1, top);
      C.draw(fb, rx + 5, by);
      if (index) index.draw(fb, x, by - asc + 6);
    }
  };
}

export function supBox(E, font) {
  const raise = RAISE[font] || 6;
  const b = shifted(E, -raise);
  return { ...b, w: E.w + 1, draw: b.draw };
}

export function absBox(C) {
  const marks = C.marks.map((m) => ({ ...m, dx: m.dx + 2 }));
  return {
    w: C.w + 4,
    asc: C.asc + 1,
    desc: C.desc + 1,
    marks,
    draw(fb, x, by) {
      fb.vline(x, by - C.asc - 1, by + C.desc);
      C.draw(fb, x + 2, by);
      fb.vline(x + C.w + 2, by - C.asc - 1, by + C.desc);
    }
  };
}

export function barSubBox(sub) {
  const b = shifted(sub, 3);
  return {
    w: sub.w + 2,
    asc: 11,
    desc: b.desc,
    marks: b.marks.map((m) => ({ ...m, dx: m.dx + 2 })),
    draw(fb, x, by) {
      fb.vline(x, by - 11, by + 2);
      b.draw(fb, x + 2, by);
    }
  };
}

export function integralBox(Fb, A, B, font) {
  const lim = Math.max(A.w, B.w);
  const top = Math.max(Fb.asc, 12) + B.asc - 6;
  const sign = {
    w: 6,
    asc: top,
    desc: Math.max(Fb.desc, 6),
    marks: [],
    draw(fb, x, by) {
      const y0 = by - top + 1;
      const y1 = by + Math.max(Fb.desc, 6) - 1;
      fb.vline(x + 2, y0 + 1, y1 - 1);
      fb.set(x + 3, y0);
      fb.set(x + 4, y0);
      fb.set(x + 1, y1);
      fb.set(x, y1);
    }
  };
  const limits = {
    w: lim + 1,
    asc: top,
    desc: Math.max(Fb.desc, 6),
    marks: [
      ...B.marks.map((m) => ({ ...m, dy: m.dy - top + B.asc })),
      ...A.marks.map((m) => ({ ...m, dy: m.dy + Math.max(Fb.desc, 6) }))
    ],
    draw(fb, x, by) {
      B.draw(fb, x, by - top + B.asc);
      A.draw(fb, x, by + Math.max(Fb.desc, 6));
    }
  };
  return hbox([sign, limits, Fb, textBox('dx', font)]);
}

export function bigOpBox(symbol, Fb, A, B, font) {
  const lower = hbox([textBox('x=', 'small'), A]);
  const colW = Math.max(lower.w, B.w, 7);
  const symAsc = 11;
  const col = {
    w: colW + 1,
    asc: symAsc + B.asc + 1,
    desc: lower.asc + lower.desc + 1,
    marks: [
      ...B.marks.map((m) => ({ ...m, dx: m.dx + Math.floor((colW - B.w) / 2), dy: m.dy - symAsc - 1 })),
      ...lower.marks.map((m) => ({ ...m, dx: m.dx + Math.floor((colW - lower.w) / 2), dy: m.dy + lower.asc + 1 }))
    ],
    draw(fb, x, by) {
      B.draw(fb, x + Math.floor((colW - B.w) / 2), by - symAsc - 1);
      fb.drawText(x + Math.floor((colW - 7) / 2), by, symbol, font);
      lower.draw(fb, x + Math.floor((colW - lower.w) / 2), by + lower.asc + 1);
    }
  };
  return hbox([col, textBox('(', font), Fb, textBox(')', font)]);
}

/**
 * Lay out a whole tree. Returns the box plus a `cursorAt(path, idx)` lookup.
 */
export function layout(items, o = {}) {
  const box = layoutSlot(items, { font: o.font || 'large', path: o.editor ? [] : null, math: o.math });
  const index = new Map();
  for (const m of box.marks) index.set(`${m.key}#${m.idx}`, m);
  box.cursorAt = (path, idx) => index.get(`${pathKey(path)}#${idx}`) || null;
  return box;
}

export { TEMPLATES };
