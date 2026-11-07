/**
 * Expression input buffer: a tree of tokens and templates with a cursor.
 *
 * A slot is an array of items:
 *   { t: 'tok', id }                         token from tokens.js
 *   { t: 'tpl', kind, slots: [[...], ...] }  template (MathI only), slot order = cursor order
 * The cursor is { path: [{ i, s }, ...], idx }: starting at the root slot, each path step
 * enters item i, slot s. idx is the position inside the innermost slot.
 */

import { TOKENS, TEMPLATES, MAX_INPUT_BYTES, INPUT_WARNING_BYTES } from './tokens.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

export class Editor {
  constructor({ math = true, maxBytes = MAX_INPUT_BYTES } = {}) {
    this.math = math;
    this.maxBytes = maxBytes;
    this.root = [];
    this.path = [];
    this.idx = 0;
    this.overwrite = false; // LineI overwrite mode (SHIFT DEL)
    this.insWrap = false; // MathI INS: next template takes the term right of the cursor
    this.undoState = null;
  }

  // ---------- state ----------

  clear() {
    this.root = [];
    this.path = [];
    this.idx = 0;
    this.insWrap = false;
    this.undoState = null;
  }

  isEmpty() {
    return this.root.length === 0;
  }

  snapshot() {
    return { root: clone(this.root), path: clone(this.path), idx: this.idx };
  }

  restore(snap) {
    this.root = clone(snap.root);
    this.path = clone(snap.path || []);
    this.idx = snap.idx ?? this.root.length;
    this.insWrap = false;
  }

  setItems(items, cursorAtEnd = true) {
    this.root = clone(items);
    this.path = [];
    this.idx = cursorAtEnd ? this.root.length : 0;
    this.insWrap = false;
  }

  _saveUndo() {
    if (this.math) this.undoState = this.snapshot();
  }

  /** ALPHA DEL (MathI): undo the last edit; pressing again redoes it. */
  undo() {
    if (!this.math || !this.undoState) return false;
    const current = this.snapshot();
    this.restore(this.undoState);
    this.undoState = current;
    return true;
  }

  // ---------- navigation helpers ----------

  slotAt(path) {
    let list = this.root;
    for (const step of path) list = list[step.i].slots[step.s];
    return list;
  }

  get slot() {
    return this.slotAt(this.path);
  }

  /** The template item that owns path step k. */
  templateAt(k) {
    return this.slotAt(this.path.slice(0, k))[this.path[k].i];
  }

  static itemBytes(item) {
    if (item.t === 'tok') return TOKENS[item.id] ? TOKENS[item.id].bytes : 1;
    if (item.t === 'tpl') {
      let b = TEMPLATES[item.kind] ? TEMPLATES[item.kind].bytes : 2;
      for (const s of item.slots) for (const it of s) b += Editor.itemBytes(it);
      return b;
    }
    return 0;
  }

  bytes() {
    let b = 0;
    for (const it of this.root) b += Editor.itemBytes(it);
    return b;
  }

  remainingBytes() {
    return this.maxBytes - this.bytes();
  }

  /** 'line' normally, 'block' when 10 bytes or less remain, 'overwrite' in LineI overwrite mode. */
  cursorShape() {
    if (this.remainingBytes() <= INPUT_WARNING_BYTES) return 'block';
    if (!this.math && this.overwrite) return 'overwrite';
    return 'line';
  }

  // ---------- editing ----------

  insertToken(id) {
    if (!TOKENS[id]) throw new Error(`Unknown token ${id}`);
    const item = { t: 'tok', id };
    const slot = this.slot;
    const replacing = !this.math && this.overwrite && this.idx < slot.length;
    const cost = TOKENS[id].bytes - (replacing ? Editor.itemBytes(slot[this.idx]) : 0);
    if (this.bytes() + cost > this.maxBytes) return false;
    this._saveUndo();
    if (replacing) slot[this.idx] = item;
    else slot.splice(this.idx, 0, item);
    this.idx++;
    this.insWrap = false;
    return true;
  }

  insertTokens(ids) {
    for (const id of ids) if (!this.insertToken(id)) return false;
    return true;
  }

  insertTemplate(kind) {
    const def = TEMPLATES[kind];
    if (!def) throw new Error(`Unknown template ${kind}`);
    if (this.bytes() + def.bytes > this.maxBytes) return false;
    this._saveUndo();
    const tpl = { t: 'tpl', kind, slots: def.slots.map(() => []) };
    const slot = this.slot;

    if (this.insWrap && !def.postfix) {
      this.insWrap = false;
      const n = this._termLengthRight(slot, this.idx);
      const arg = slot.splice(this.idx, n);
      const argSlot = { frac: 0, mixed: 0, root: 1, logab: 1 }[kind] ?? 0;
      tpl.slots[argSlot] = arg;
      slot.splice(this.idx, 0, tpl);
      const empty = tpl.slots.findIndex((s) => s.length === 0);
      if (empty >= 0) {
        this.path.push({ i: this.idx, s: empty });
        this.idx = 0;
      } else {
        this.idx++;
      }
      return true;
    }

    this.insWrap = false;
    slot.splice(this.idx, 0, tpl);
    this.path.push({ i: this.idx, s: 0 });
    this.idx = 0;
    return true;
  }

  /** Number of items forming the term that starts at slot[idx] (for INS wrapping). */
  _termLengthRight(slot, idx) {
    const first = slot[idx];
    if (!first) return 0;
    if (first.t === 'tpl') return 1;
    const tok = TOKENS[first.id];
    if (tok.kind === 'digit' || tok.kind === 'dot') {
      let n = 0;
      while (idx + n < slot.length) {
        const it = slot[idx + n];
        if (it.t !== 'tok') break;
        const k = TOKENS[it.id].kind;
        if (k === 'digit' || k === 'dot' || k === 'exp10') n++;
        else if (k === 'neg' && n > 0 && TOKENS[slot[idx + n - 1].id].kind === 'exp10') n++;
        else break;
      }
      return n;
    }
    if (tok.kind === 'open' || tok.kind === 'func') {
      let depth = 0;
      for (let n = 0; idx + n < slot.length; n++) {
        const it = slot[idx + n];
        if (it.t !== 'tok') continue;
        const k = TOKENS[it.id].kind;
        if (k === 'open' || k === 'func' || k === 'pow' || k === 'xroot') depth++;
        else if (k === 'close') {
          depth--;
          if (depth === 0) return n + 1;
        }
      }
      return slot.length - idx;
    }
    if (tok.kind === 'value') return 1;
    return 0;
  }

  /** SHIFT DEL: MathI → wrap next template around the term; LineI → toggle overwrite. */
  toggleIns() {
    if (this.math) this.insWrap = !this.insWrap;
    else this.overwrite = !this.overwrite;
  }

  del() {
    const slot = this.slot;
    if (!this.math && this.overwrite && this.idx < slot.length) {
      this._saveUndo();
      slot.splice(this.idx, 1);
      return true;
    }
    if (this.idx > 0) {
      this._saveUndo();
      slot.splice(this.idx - 1, 1);
      this.idx--;
      return true;
    }
    if (this.path.length === 0) return false;
    // At the start of a slot
    const k = this.path.length - 1;
    const step = this.path[k];
    const tpl = this.templateAt(k);
    const parentSlot = this.slotAt(this.path.slice(0, k));
    const others = tpl.slots.filter((s, j) => j !== step.s);
    if (tpl.slots.every((s) => s.length === 0)) {
      this._saveUndo();
      parentSlot.splice(step.i, 1);
      this.path.pop();
      this.idx = step.i;
      return true;
    }
    if (step.s === 0 && others.every((s) => s.length === 0)) {
      // Remove the template, keep the contents of its first slot
      this._saveUndo();
      const contents = tpl.slots[0];
      parentSlot.splice(step.i, 1, ...contents);
      this.path.pop();
      this.idx = step.i;
      return true;
    }
    return false;
  }

  // ---------- cursor movement ----------

  right() {
    const slot = this.slot;
    if (this.idx < slot.length) {
      const item = slot[this.idx];
      if (item.t === 'tpl') {
        this.path.push({ i: this.idx, s: 0 });
        this.idx = 0;
      } else {
        this.idx++;
      }
      return;
    }
    if (this.path.length === 0) {
      this.idx = 0; // wrap to the start
      return;
    }
    const k = this.path.length - 1;
    const step = this.path[k];
    const tpl = this.templateAt(k);
    if (step.s + 1 < tpl.slots.length) {
      step.s++;
      this.idx = 0;
    } else {
      this.path.pop();
      this.idx = step.i + 1;
    }
  }

  left() {
    const slot = this.slot;
    if (this.idx > 0) {
      const item = slot[this.idx - 1];
      if (item.t === 'tpl') {
        const s = item.slots.length - 1;
        this.path.push({ i: this.idx - 1, s });
        this.idx = item.slots[s].length;
      } else {
        this.idx--;
      }
      return;
    }
    if (this.path.length === 0) {
      this.idx = this.root.length; // wrap to the end
      return;
    }
    const k = this.path.length - 1;
    const step = this.path[k];
    if (step.s > 0) {
      step.s--;
      this.idx = this.slot.length;
    } else {
      this.path.pop();
      this.idx = step.i;
    }
  }

  /** Jump out of the innermost template (to the right or left). */
  exitTemplate(toRight = true) {
    if (this.path.length === 0) {
      this.idx = toRight ? this.root.length : 0;
      return;
    }
    const step = this.path.pop();
    this.idx = toRight ? step.i + 1 : step.i;
  }

  home() {
    this.path = [];
    this.idx = 0;
  }

  end() {
    this.path = [];
    this.idx = this.root.length;
  }

  /** Vertical move between slots. Returns false when no template allows it. */
  vertical(dir) {
    const MOVES = {
      frac: { up: { 1: 0 }, down: { 0: 1 } },
      mixed: { up: { 2: 1 }, down: { 0: 2, 1: 2 } },
      integral: { up: { 0: 2, 1: 0 }, down: { 0: 1, 2: 0 } },
      sum: { up: { 0: 2, 1: 0 }, down: { 0: 1, 2: 0 } }
    };
    for (let k = this.path.length - 1; k >= 0; k--) {
      const tpl = this.templateAt(k);
      const table = MOVES[tpl.kind];
      if (!table) continue;
      const target = table[dir][this.path[k].s];
      if (target === undefined) continue;
      this.path = this.path.slice(0, k + 1);
      this.path[k].s = target;
      this.idx = Math.min(this.idx, this.slot.length);
      return true;
    }
    return false;
  }

  /** Cursor location object (for error positions). */
  location() {
    return { path: clone(this.path), idx: this.idx };
  }

  setLocation(loc) {
    if (!loc) {
      this.end();
      return;
    }
    try {
      this.path = clone(loc.path || []);
      const slot = this.slotAt(this.path);
      this.idx = Math.max(0, Math.min(loc.idx ?? slot.length, slot.length));
    } catch {
      this.end();
    }
  }

  toJSON() {
    return { math: this.math, root: this.root, path: this.path, idx: this.idx, overwrite: this.overwrite };
  }

  static fromJSON(o) {
    const e = new Editor({ math: o.math !== false });
    e.root = o.root || [];
    e.path = o.path || [];
    e.idx = o.idx ?? e.root.length;
    e.overwrite = !!o.overwrite;
    try {
      e.slotAt(e.path);
    } catch {
      e.end();
    }
    return e;
  }
}
