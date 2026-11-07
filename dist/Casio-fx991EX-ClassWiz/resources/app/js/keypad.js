/**
 * Keypad input: faceplate hit boxes (pointer events), hold-to-repeat, PC keyboard shortcuts.
 * Emits key names from key_layout.json; knows nothing about the calculator itself.
 */

export const REPEAT_DELAY_MS = 500;    // hold time before auto-repeat starts
export const REPEAT_INTERVAL_MS = 100; // auto-repeat period
export const REPEAT_KEYS = new Set(['LEFT', 'RIGHT', 'UP', 'DOWN', 'DEL']);

// PC keys that always map to a calculator key (on top of key_layout.json "shortcut").
export const EXTRA_SHORTCUTS = {
  Enter: 'EXE', '=': 'EXE',
  Backspace: 'DEL', Delete: 'DEL', Del: 'DEL',
  Escape: 'AC', Esc: 'AC', c: 'AC', C: 'AC',
  ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
  Up: 'UP', Down: 'DOWN', Left: 'LEFT', Right: 'RIGHT',
  '+': 'ADD',
  '-': 'SUB', '−': 'SUB', '–': 'SUB', '—': 'SUB',
  '*': 'MUL', '×': 'MUL',
  '/': 'DIV', '÷': 'DIV',
  '^': 'POWER',
  '(': 'LPAREN', ')': 'RPAREN',
  '.': 'DOT', ',': 'DOT',
  X: 'X',
  0: '0', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
};

export async function loadKeyLayout(url = 'assets/data/key_layout.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`key_layout.json: HTTP ${res.status}`);
  return res.json();
}

/**
 * PC key -> key name. Layout shortcuts and raw emulator characters are mapped,
 * then sensible extras (numpad, symbols, aliases) fill in remaining keys.
 */
export function buildShortcutMap(layout) {
  const map = new Map();
  for (const k of layout) {
    if (k.shortcut && !map.has(k.shortcut)) map.set(k.shortcut, k.name);
    if (k.raw_char && !map.has(k.raw_char)) map.set(k.raw_char, k.name);
  }
  for (const [pc, name] of Object.entries(EXTRA_SHORTCUTS)) {
    if (!map.has(pc)) map.set(pc, name);
  }
  return map;
}

/** Calls fire() now and repeats it while held, for repeatable keys. Returns a stop function. */
export function startPress(name, fire) {
  fire(name);
  if (!REPEAT_KEYS.has(name)) return () => {};
  let interval = null;
  const delay = setTimeout(() => {
    interval = setInterval(() => fire(name), REPEAT_INTERVAL_MS);
  }, REPEAT_DELAY_MS);
  return () => {
    clearTimeout(delay);
    if (interval) clearInterval(interval);
  };
}

function isTypingTarget(el) {
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/**
 * PC keyboard handling. onKey(name) per press/repeat; onDown/onUp(name) for the pressed look.
 * Returns an unbind function.
 */
export function bindKeyboard(layout, onKey, { onDown = () => {}, onUp = () => {}, target = window } = {}) {
  const map = buildShortcutMap(layout);
  const held = new Map(); // identifier -> { name, stop }

  const release = (code) => {
    const h = held.get(code);
    if (!h) return;
    h.stop();
    held.delete(code);
    onUp(h.name);
  };
  const releaseAll = () => [...held.keys()].forEach(release);

  const down = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
    const name = map.get(e.key);
    if (!name) return;
    e.preventDefault();
    const code = e.code || e.key;
    if (e.repeat || held.has(code)) return; // we do our own repeat timing
    onDown(name);
    held.set(code, { name, stop: startPress(name, onKey) });
  };
  const up = (e) => release(e.code || e.key);

  const win = typeof window !== 'undefined' ? window : null;
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  win?.addEventListener('blur', releaseAll);
  return () => {
    releaseAll();
    target.removeEventListener('keydown', down);
    target.removeEventListener('keyup', up);
    win?.removeEventListener('blur', releaseAll);
  };
}

/** Faceplate hit boxes + keyboard. Positions are in faceplate pixels scaled by CSS var --s. */
export class Keypad {
  constructor(container, layout, onKey) {
    this.container = container;
    this.layout = layout;
    this.onKey = onKey;
    this.els = new Map(); // name -> element
    this.pointers = new Map(); // pointerId -> { el, stop }
    this.build();
    this.unbindKeyboard = bindKeyboard(layout, onKey, {
      onDown: (n) => this.els.get(n)?.classList.add('pressed'),
      onUp: (n) => this.els.get(n)?.classList.remove('pressed'),
    });
  }

  build() {
    this.container.textContent = '';
    for (const k of this.layout) {
      const el = document.createElement('div');
      el.className = 'calc-key';
      if (k.type) el.classList.add(`calc-key-${k.type}`);
      el.dataset.name = k.name;
      const { x, y, w, h } = k.rect;
      el.style.left = `calc(var(--s) * ${x}px)`;
      el.style.top = `calc(var(--s) * ${y}px)`;
      el.style.width = `calc(var(--s) * ${w}px)`;
      el.style.height = `calc(var(--s) * ${h}px)`;
      el.title = [k.primary || k.name, k.shift && `SHIFT: ${k.shift}`, k.alpha && `ALPHA: ${k.alpha}`]
        .filter(Boolean).join('  |  ');
      const label = document.createElement('span');
      label.className = 'key-label';
      label.textContent = k.primary || k.name;
      el.appendChild(label);
      el.addEventListener('pointerdown', (e) => this.pointerDown(e, el, k.name));
      this.els.set(k.name, el);
      this.container.appendChild(el);
    }
    const end = (e) => this.pointerUp(e.pointerId);
    this.container.addEventListener('pointerup', end);
    this.container.addEventListener('pointercancel', end);
    this.container.addEventListener('lostpointercapture', end);
    this.container.addEventListener('contextmenu', (e) => e.preventDefault());

    const win = typeof window !== 'undefined' ? window : null;
    this._globalEnd = end;
    win?.addEventListener('pointerup', this._globalEnd);
    win?.addEventListener('pointercancel', this._globalEnd);
    this._onBlur = () => this.releaseAll();
    win?.addEventListener('blur', this._onBlur);
  }

  pointerDown(e, el, name) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    this.pointerUp(e.pointerId);
    try { el.setPointerCapture(e.pointerId); } catch { /* capture is best-effort */ }
    el.classList.add('pressed');
    this.pointers.set(e.pointerId, { el, stop: startPress(name, this.onKey) });
  }

  pointerUp(id) {
    const p = this.pointers.get(id);
    if (!p) return;
    p.stop();
    p.el.classList.remove('pressed');
    this.pointers.delete(id);
  }

  releaseAll() {
    for (const [id, p] of this.pointers) {
      p.stop();
      p.el.classList.remove('pressed');
    }
    this.pointers.clear();
  }

  destroy() {
    this.releaseAll();
    this.unbindKeyboard?.();
    const win = typeof window !== 'undefined' ? window : null;
    if (this._globalEnd) {
      win?.removeEventListener('pointerup', this._globalEnd);
      win?.removeEventListener('pointercancel', this._globalEnd);
    }
    if (this._onBlur) {
      win?.removeEventListener('blur', this._onBlur);
    }
  }
}
