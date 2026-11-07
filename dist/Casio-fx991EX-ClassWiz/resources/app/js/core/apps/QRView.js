/**
 * SHIFT OPTN (QR): our own QR code of what is on screen (plain text, no URL, no
 * network). Version 11 (61×61, 1 dot per module) or Version 3 (29×29, 2 dots per
 * module) from SETUP → QR Code. AC or SHIFT OPTN closes it.
 */

import { encodeQR } from '../qr/qrcode.js';

export class QRView {
  constructor(calc, text) {
    this.calc = calc;
    this.isOverlay = true;
    const version = calc.setup.qrVersion === 3 ? 3 : 11;
    const max = version === 3 ? 53 : 321;
    const bytes = new TextEncoder().encode(text);
    let t = text;
    if (bytes.length > max) t = new TextDecoder().decode(bytes.slice(0, max)).replace(/�$/, '');
    this.text = t;
    this.qr = encodeQR(t, { version, ecLevel: 'L' });
  }

  onKey(ev) {
    if ((ev.key === 'AC' && !ev.shift) || (ev.key === 'OPTN' && ev.shift)) this.calc.closeAllOverlays();
    return true;
  }

  render(scr) {
    const { size, modules } = this.qr;
    const scale = size <= 29 ? 2 : 1;
    const px = size * scale;
    const x0 = Math.floor((192 - px) / 2);
    const y0 = Math.floor((63 - px) / 2);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (modules[y * size + x]) scr.fb.fillRect(x0 + x * scale, y0 + y * scale, scale, scale, 1);
      }
    }
    scr.text(0, 53, '1/1', { font: 'small', align: 'right', right: 190, record: false });
    scr.lines = ['QR', this.text];
  }
}
