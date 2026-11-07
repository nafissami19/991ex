/**
 * Pop-out LCD window. Main window broadcasts frames; the pop-out draws them and
 * sends its keyboard presses back.
 *   main -> popout: { type: 'frame', pixels, indicators, contrast, poweredOn }
 *   popout -> main: { type: 'hello' } | { type: 'key', name }
 */

import { CanvasLCD, loadLcdConfig, snapScale } from './lcd/canvas_lcd.js';
import { loadKeyLayout, bindKeyboard } from './keypad.js';

export const CHANNEL_NAME = 'fx991ex-lcd';

/** Main-window side: open (or focus) the pop-out. */
export function openPopout() {
  const w = window.open('popout.html', 'fx991ex_lcd_popout', 'width=620,height=300,resizable=yes');
  w?.focus();
  return w;
}

/** Pop-out page side. */
export async function startPopoutPage() {
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const config = await loadLcdConfig();
  const status = config.statusBar || { width: 384, height: 17 };
  const display = config.display || {};
  const frame = document.getElementById('lcdFrame');
  const statusCanvas = document.getElementById('statusCanvas');
  const mainCanvas = document.getElementById('mainCanvas');

  // Same proportions as on the faceplate (status 384x17, gap, LCD 384x126 at scale 1).
  const unitW = display.width || 384;
  const gap = Math.max(0, (display.y ?? 256) - (status.y ?? 237) - (status.height || 17));
  const unitH = (status.height || 17) + gap + (display.height || 126);
  const dotUnit = unitW / 192;

  function layout() {
    const pad = 24;
    let s = Math.min((innerWidth - pad) / unitW, (innerHeight - pad) / unitH);
    s = Math.max(0.25, snapScale(s, dotUnit));
    frame.style.setProperty('--s', s);
    frame.style.width = `${unitW * s}px`;
    statusCanvas.style.height = `${(status.height || 17) * s}px`;
    statusCanvas.style.marginBottom = `${gap * s}px`;
    mainCanvas.style.height = `${(display.height || 126) * s}px`;
    lcd?.resize();
  }

  let lcd = null;
  layout();
  lcd = new CanvasLCD(mainCanvas, statusCanvas, display);
  lcd.draw({ poweredOn: true });
  lcd.loadStatusIcons();
  window.addEventListener('resize', layout);

  channel.onmessage = (e) => {
    if (e.data?.type === 'frame') lcd.draw(e.data);
  };
  channel.postMessage({ type: 'hello' });

  try {
    const keys = await loadKeyLayout();
    bindKeyboard(keys, (name) => channel.postMessage({ type: 'key', name }));
  } catch (e) {
    console.warn('Pop-out keyboard disabled:', e);
  }
}
