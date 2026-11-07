/**
 * Casio fx-991EX ClassWiz Degree-Minute-Second (Sexagesimal) Form
 *
 * Converts between decimal numbers and degrees, minutes, and seconds:
 *   d° m' s"
 * Format on calculator display: e.g. "2°30'0""
 */

import { Decimal15 } from '../number/Decimal15.js';

export class DMSForm {
  constructor(d = 0, m = 0, s = 0, isNegative = false) {
    this.d = Math.abs(d);
    this.m = Math.abs(m);
    this.s = Math.abs(s);
    this.isNegative = isNegative;
  }

  static fromDecimal(val) {
    let num = typeof val === 'number' ? val : (val.toNumber ? val.toNumber() : Number(val));
    if (!Number.isFinite(num)) throw new Error('Math ERROR');

    const isNegative = num < 0;
    let absVal = Math.abs(num);

    let d = Math.floor(absVal);
    let remMinutes = (absVal - d) * 60;
    let m = Math.floor(remMinutes);
    let s = (remMinutes - m) * 60;

    // Round seconds to 2 decimal places per Casio spec
    s = Math.round(s * 100) / 100;

    if (s >= 60) {
      s -= 60;
      m += 1;
    }
    if (m >= 60) {
      m -= 60;
      d += 1;
    }

    return new DMSForm(d, m, s, isNegative);
  }

  toDecimal() {
    const val = this.d + this.m / 60 + this.s / 3600;
    return this.isNegative ? -val : val;
  }

  toDecimal15() {
    return Decimal15.from(this.toDecimal());
  }

  format() {
    const sign = this.isNegative ? '-' : '';
    // If seconds is integer, show without decimal part
    const sStr = Number.isInteger(this.s) ? this.s.toString() : this.s.toFixed(2).replace(/\.?0+$/, '');
    return `${sign}${this.d}°${this.m}'${sStr}"`;
  }

  toString() {
    return this.format();
  }
}
