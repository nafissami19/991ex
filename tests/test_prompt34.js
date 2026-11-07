import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadKeyLayout,
  buildShortcutMap,
  startPress,
  bindKeyboard,
  Keypad,
  REPEAT_KEYS,
  REPEAT_DELAY_MS,
  REPEAT_INTERVAL_MS,
  EXTRA_SHORTCUTS,
} from '../js/keypad.js';
import { snapScale, LCD_W, LCD_H } from '../js/lcd/canvas_lcd.js';
import { CHANNEL_NAME } from '../js/popout.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

describe('Prompt 34: Key Layout and Faceplate', () => {
  const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/key_layout.json'), 'utf8'));

  test('key_layout.json contains 50 keys with valid dimensions and categories', () => {
    assert.equal(layout.length, 50, 'Must have exactly 50 physical keys');
    const names = new Set();
    for (const k of layout) {
      assert.ok(k.name, 'Key must have a name');
      assert.ok(!names.has(k.name), `Duplicate key name: ${k.name}`);
      names.add(k.name);

      assert.ok(k.rect, `Key ${k.name} must have a rect`);
      assert.ok(k.rect.w > 0 && k.rect.h > 0, `Key ${k.name} rect must have positive size`);
      assert.ok(k.rect.x >= 0 && k.rect.y >= 0, `Key ${k.name} rect must have non-negative coordinates`);
      assert.ok(k.rect.x + k.rect.w <= 644, `Key ${k.name} must fit horizontally on faceplate`);
      assert.ok(k.rect.y + k.rect.h <= 1250, `Key ${k.name} must fit vertically on faceplate`);
    }
  });

  test('All D-Pad and repeatable keys exist in layout', () => {
    const names = new Set(layout.map((k) => k.name));
    for (const rep of REPEAT_KEYS) {
      assert.ok(names.has(rep), `Repeatable key ${rep} must exist in key layout`);
    }
    assert.deepEqual(
      [...REPEAT_KEYS].sort(),
      ['DEL', 'DOWN', 'LEFT', 'RIGHT', 'UP'].sort()
    );
  });
});

describe('Prompt 34: PC Keyboard Shortcuts & Sensible Extras', () => {
  const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/key_layout.json'), 'utf8'));
  const map = buildShortcutMap(layout);

  test('Digits 0-9 map directly to calculator numbers', () => {
    for (let i = 0; i <= 9; i++) {
      assert.equal(map.get(String(i)), String(i));
    }
  });

  test('Enter and = map to EXE', () => {
    assert.equal(map.get('Enter'), 'EXE');
    assert.equal(map.get('='), 'EXE');
  });

  test('Escape, Esc, c, C map to AC', () => {
    assert.equal(map.get('Escape'), 'AC');
    assert.equal(map.get('Esc'), 'AC');
    assert.equal(map.get('c'), 'AC');
    assert.equal(map.get('C'), 'AC');
  });

  test('Backspace, Delete, Del map to DEL', () => {
    assert.equal(map.get('Backspace'), 'DEL');
    assert.equal(map.get('Delete'), 'DEL');
    assert.equal(map.get('Del'), 'DEL');
  });

  test('Arrow keys and direction aliases map to D-Pad keys', () => {
    assert.equal(map.get('ArrowUp'), 'UP');
    assert.equal(map.get('Up'), 'UP');
    assert.equal(map.get('ArrowDown'), 'DOWN');
    assert.equal(map.get('Down'), 'DOWN');
    assert.equal(map.get('ArrowLeft'), 'LEFT');
    assert.equal(map.get('Left'), 'LEFT');
    assert.equal(map.get('ArrowRight'), 'RIGHT');
    assert.equal(map.get('Right'), 'RIGHT');
  });

  test('Arithmetic operators and Unicode variants (+ − * /)', () => {
    assert.equal(map.get('+'), 'ADD');
    assert.equal(map.get('-'), 'SUB');
    assert.equal(map.get('−'), 'SUB'); // U+2212
    assert.equal(map.get('–'), 'SUB'); // en-dash
    assert.equal(map.get('—'), 'SUB'); // em-dash
    assert.equal(map.get('*'), 'MUL');
    assert.equal(map.get('×'), 'MUL'); // U+00D7
    assert.equal(map.get('/'), 'DIV');
    assert.equal(map.get('÷'), 'DIV'); // U+00F7
    assert.equal(map.get('^'), 'POWER');
  });

  test('Parentheses and decimal separators', () => {
    assert.equal(map.get('('), 'LPAREN');
    assert.equal(map.get(')'), 'RPAREN');
    assert.equal(map.get('.'), 'DOT');
    assert.equal(map.get(','), 'DOT');
  });

  test('Variable X shortcuts', () => {
    assert.equal(map.get('X'), 'X');
    assert.equal(map.get('['), 'X');
  });

  test('Emulator raw shortcuts (e.g. q for SHIFT, Q for ALPHA, w for MENU)', () => {
    assert.equal(map.get('q'), 'SHIFT');
    assert.equal(map.get('Q'), 'ALPHA');
    assert.equal(map.get('w'), 'MENU');
    assert.equal(map.get('s'), 'SQRT');
    assert.equal(map.get('j'), 'SIN');
    assert.equal(map.get('k'), 'COS');
    assert.equal(map.get('l'), 'TAN');
  });
});

describe('Prompt 34: Hold-to-Repeat Timing', () => {
  test('Non-repeatable keys fire once immediately and do not repeat', async () => {
    const fired = [];
    const stop = startPress('5', (k) => fired.push(k));
    assert.deepEqual(fired, ['5']);

    // Wait past repeat delay
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.deepEqual(fired, ['5'], 'Non-repeatable keys must never repeat');
    stop();
  });

  test('Repeatable keys fire immediately, wait 500ms delay, and repeat every 100ms', async () => {
    const fired = [];
    const stop = startPress('LEFT', (k) => fired.push(k));
    assert.equal(fired.length, 1, 'Initial press at t=0');

    // At 400ms (< 500ms delay), still only 1 press
    await new Promise((resolve) => setTimeout(resolve, 380));
    assert.equal(fired.length, 1, 'No repeat before 500ms delay');

    // Wait until ~650ms (500ms initial repeat + 600ms next repeat)
    await new Promise((resolve) => setTimeout(resolve, 280));
    assert.ok(fired.length >= 2, `Expected >= 2 repeats by ~660ms, got ${fired.length}`);

    // Wait until ~850ms
    await new Promise((resolve) => setTimeout(resolve, 200));
    const countBeforeStop = fired.length;
    assert.ok(countBeforeStop >= 3, `Expected >= 3 repeats by ~860ms, got ${countBeforeStop}`);

    stop();

    // After stop, no more fires occur
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(fired.length, countBeforeStop, 'No fires should occur after stop');
  });

  test('DEL key repeats while held', async () => {
    const fired = [];
    const stop = startPress('DEL', (k) => fired.push(k));
    assert.equal(fired.length, 1);
    await new Promise((resolve) => setTimeout(resolve, 650));
    assert.ok(fired.length >= 2, 'DEL must repeat when held');
    stop();
  });
});

describe('Prompt 34: Keyboard Event Listener & Input Shielding', () => {
  const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/key_layout.json'), 'utf8'));

  class MockTarget {
    constructor() {
      this.listeners = new Map();
    }
    addEventListener(event, fn) {
      if (!this.listeners.has(event)) this.listeners.set(event, []);
      this.listeners.get(event).push(fn);
    }
    removeEventListener(event, fn) {
      const list = this.listeners.get(event) || [];
      this.listeners.set(event, list.filter((f) => f !== fn));
    }
    dispatch(event, e) {
      for (const fn of this.listeners.get(event) || []) fn(e);
    }
  }

  test('bindKeyboard handles keydown and keyup with visual callbacks', () => {
    const target = new MockTarget();
    const pressed = [];
    const downed = [];
    const upped = [];

    const unbind = bindKeyboard(layout, (k) => pressed.push(k), {
      onDown: (k) => downed.push(k),
      onUp: (k) => upped.push(k),
      target,
    });

    let defaultPrevented = false;
    const evDown = {
      key: 'Enter',
      code: 'Enter',
      target: {},
      preventDefault: () => { defaultPrevented = true; },
    };
    target.dispatch('keydown', evDown);

    assert.ok(defaultPrevented, 'Mapped keys must call preventDefault');
    assert.deepEqual(pressed, ['EXE']);
    assert.deepEqual(downed, ['EXE']);
    assert.deepEqual(upped, []);

    target.dispatch('keyup', { code: 'Enter', key: 'Enter' });
    assert.deepEqual(upped, ['EXE']);

    unbind();
  });

  test('bindKeyboard ignores modifiers (ctrl, meta, alt) and input form fields', () => {
    const target = new MockTarget();
    const pressed = [];
    const unbind = bindKeyboard(layout, (k) => pressed.push(k), { target });

    // Ctrl+C should not press AC
    target.dispatch('keydown', { key: 'c', code: 'KeyC', ctrlKey: true, preventDefault: () => {} });
    assert.equal(pressed.length, 0);

    // Alt+Enter should not press EXE
    target.dispatch('keydown', { key: 'Enter', code: 'Enter', altKey: true, preventDefault: () => {} });
    assert.equal(pressed.length, 0);

    // Meta+1 should not press 1
    target.dispatch('keydown', { key: '1', code: 'Digit1', metaKey: true, preventDefault: () => {} });
    assert.equal(pressed.length, 0);

    // Typing inside an <input> should not press calculator keys
    target.dispatch('keydown', {
      key: '7',
      code: 'Digit7',
      target: { tagName: 'INPUT' },
      preventDefault: () => {},
    });
    assert.equal(pressed.length, 0);

    unbind();
  });
});

describe('Prompt 34: Keypad DOM and Touch/Pointer Lifecycle', () => {
  const layout = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/key_layout.json'), 'utf8'));

  function createMockElement() {
    const classes = new Set();
    const listeners = new Map();
    const style = {};
    let _className = '';
    return {
      get className() { return _className; },
      set className(v) {
        _className = v;
        for (const part of (v || '').split(/\s+/)) if (part) classes.add(part);
      },
      classList: {
        add: (c) => { classes.add(c); _className = [...classes].join(' '); },
        remove: (c) => { classes.delete(c); _className = [...classes].join(' '); },
        has: (c) => classes.has(c),
        contains: (c) => classes.has(c),
      },
      style,
      dataset: {},
      children: [],
      appendChild(child) { this.children.push(child); },
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      removeEventListener(type, fn) {
        const list = listeners.get(type) || [];
        listeners.set(type, list.filter((f) => f !== fn));
      },
      dispatchEvent(type, ev) {
        for (const fn of listeners.get(type) || []) fn(ev);
      },
      setPointerCapture() {},
    };
  }

  // Setup minimal document mock for Keypad.build
  const originalDoc = globalThis.document;
  const originalWindow = globalThis.window;

  test('Keypad instantiates 50 interactive key elements with correct classes and styles', () => {
    globalThis.document = {
      createElement: () => createMockElement(),
    };
    const winListeners = new Map();
    globalThis.window = {
      addEventListener: (type, fn) => {
        if (!winListeners.has(type)) winListeners.set(type, []);
        winListeners.get(type).push(fn);
      },
      removeEventListener: (type, fn) => {
        const list = winListeners.get(type) || [];
        winListeners.set(type, list.filter((f) => f !== fn));
      },
    };

    const container = createMockElement();
    const pressedKeys = [];
    const keypad = new Keypad(container, layout, (k) => pressedKeys.push(k));

    assert.equal(keypad.els.size, 50, 'All 50 keys must have element wrappers');
    assert.equal(container.children.length, 50, 'Container must have 50 children');

    const upKey = keypad.els.get('UP');
    assert.ok(upKey.classList.contains('calc-key'), 'Key must have calc-key class');
    assert.ok(upKey.classList.contains('calc-key-dpad'), 'D-Pad key must have calc-key-dpad class');
    assert.ok(upKey.style.left.includes('298px'), 'UP x position must match rect');
    assert.ok(upKey.style.top.includes('478px'), 'UP y position must match rect');

    // Simulate pointerdown
    upKey.dispatchEvent('pointerdown', { pointerId: 1, button: 0, preventDefault() {} });
    assert.ok(upKey.classList.contains('pressed'), 'Key must receive pressed class on pointerdown');
    assert.deepEqual(pressedKeys, ['UP']);

    // Simulate pointerup
    keypad.pointerUp(1);
    assert.ok(!upKey.classList.contains('pressed'), 'Key must lose pressed class on pointerup');

    // Multi-touch test: Pointer 1 on SHIFT, Pointer 2 on SIN
    const shiftKey = keypad.els.get('SHIFT');
    const sinKey = keypad.els.get('SIN');
    shiftKey.dispatchEvent('pointerdown', { pointerId: 10, button: 0, preventDefault() {} });
    sinKey.dispatchEvent('pointerdown', { pointerId: 11, button: 0, preventDefault() {} });

    assert.ok(shiftKey.classList.contains('pressed'));
    assert.ok(sinKey.classList.contains('pressed'));

    keypad.releaseAll();
    assert.ok(!shiftKey.classList.contains('pressed'));
    assert.ok(!sinKey.classList.contains('pressed'));

    keypad.destroy();

    globalThis.document = originalDoc;
    globalThis.window = originalWindow;
  });
});

describe('Prompt 34: Display Scaling Without Blurring', () => {
  test('snapScale aligns dot unit to whole device pixels when within tolerance', () => {
    // unitPx = 2 (each dot is 2px at scale 1.0)
    // dpr = 2
    // If s = 1.03, dot = 2 * 1.03 * 2 = 4.12 device pixels
    // whole = 4 -> whole / dot = 4 / 4.12 = 0.9708 >= 0.90 tolerance
    // Snapped s = 4 / (2 * 2) = 1.00
    const snapped = snapScale(1.03, 2, 2, 0.1);
    assert.equal(snapped, 1.0, 'Scale should snap to integer dot device pixels');
  });

  test('snapScale preserves scale when outside tolerance', () => {
    // If s = 0.65, unitPx = 2, dpr = 1
    // dot = 1.3 -> whole = 1 -> whole / dot = 1 / 1.3 = 0.769 < 0.90
    // Returns original scale 0.65
    const unsnapped = snapScale(0.65, 2, 1, 0.1);
    assert.equal(unsnapped, 0.65, 'Scale should not snap when distance is outside tolerance');
  });
});

describe('Prompt 34: Pop-out LCD Window Communication', () => {
  test('Pop-out uses standard BroadcastChannel name', () => {
    assert.equal(CHANNEL_NAME, 'fx991ex-lcd');
  });

  test('popout.html exists with proper styling and script import', () => {
    const popoutHtml = fs.readFileSync(path.join(ROOT, 'popout.html'), 'utf8');
    assert.ok(popoutHtml.includes('fx-991EX LCD (pop-out)'), 'Must have proper title');
    assert.ok(popoutHtml.includes('manifest.webmanifest'), 'Must reference manifest');
    assert.ok(popoutHtml.includes('startPopoutPage'), 'Must invoke startPopoutPage');
    assert.ok(popoutHtml.includes('image-rendering: pixelated'), 'Must use crisp pixelated rendering');
  });
});

describe('Prompt 34: Offline Web App (Manifest & Service Worker)', () => {
  test('manifest.webmanifest is valid PWA metadata', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
    assert.equal(manifest.display, 'standalone');
    assert.ok(manifest.name && manifest.short_name);
    assert.ok(manifest.start_url);
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);

    const has192 = manifest.icons.some((i) => i.sizes.includes('192'));
    const has512 = manifest.icons.some((i) => i.sizes.includes('512'));
    const hasMaskable = manifest.icons.some((i) => i.purpose === 'maskable');
    assert.ok(has192, 'Manifest must include 192x192 icon');
    assert.ok(has512, 'Manifest must include 512x512 icon');
    assert.ok(hasMaskable, 'Manifest must include maskable icon');
  });

  test('App icons exist and are valid PNG files', () => {
    const icon192 = path.join(ROOT, 'assets/icons/icon-192.png');
    const icon512 = path.join(ROOT, 'assets/icons/icon-512.png');
    assert.ok(fs.existsSync(icon192), 'icon-192.png must exist');
    assert.ok(fs.existsSync(icon512), 'icon-512.png must exist');
    assert.ok(fs.statSync(icon192).size > 500, 'icon-192.png must be non-empty');
    assert.ok(fs.statSync(icon512).size > 500, 'icon-512.png must be non-empty');
  });

  test('All files listed in sw.js SHELL array exist on disk for 100% offline support', () => {
    const swContent = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const match = swContent.match(/const SHELL = \[([\s\S]*?)\];/);
    assert.ok(match, 'sw.js must contain SHELL array');

    const urls = match[1]
      .split('\n')
      .map((line) => line.trim().replace(/^['"]|['"],?$/g, ''))
      .filter((line) => line && !line.startsWith('//') && line !== './');

    assert.ok(urls.length >= 50, `SHELL should contain comprehensive file set, found ${urls.length}`);

    const missing = [];
    for (const file of urls) {
      const fullPath = path.join(ROOT, file);
      if (!fs.existsSync(fullPath)) {
        missing.push(file);
      }
    }
    assert.deepEqual(missing, [], 'No SHELL files should be missing from disk');
  });
});
