/**
 * Casio fx-991EX ClassWiz Exact Value System
 *
 * Unifies exact forms:
 * - Rational: exact fractions (n/d, mixed fraction support, 10-digit limit)
 * - SurdForm: radicals (a√b/c, sums of surds, conjugate rationalization)
 * - PiForm: rational multiples of pi (q*pi, |x| < 10^6 limit)
 * - DMSForm: degrees-minutes-seconds sexagesimal format
 * - Decimal15: high-precision 15-digit decimal fallback
 *
 * Implements S<=>D toggle cycling, SHIFT S<=>D mixed fraction toggle,
 * and exact trigonometric tables.
 */

import { Rational } from './Rational.js';
import { SurdForm } from './SurdForm.js';
import { PiForm } from './PiForm.js';
import { DMSForm } from './DMSForm.js';
import { Decimal15 } from '../number/Decimal15.js';
import { formatNumber } from '../format/formatNumber.js';
import * as ScientificFunctions from '../number/functions.js';

export class ExactValue {
  constructor(type, value, decimal15 = null) {
    this.type = type; // 'rational' | 'surd' | 'pi' | 'dms' | 'decimal'
    this.value = value;
    this._decimal15 = decimal15;
    this.displayState = 'exact'; // 'exact' | 'decimal' | 'mixed' | 'dms'
  }

  static fromRational(n, d = 1n) {
    const r = new Rational(n, d);
    return new ExactValue('rational', r);
  }

  static fromInt(n) {
    return new ExactValue('rational', new Rational(n, 1n));
  }

  static fromSurd(surd) {
    if (surd instanceof Rational) return new ExactValue('rational', surd);
    if (surd.isRational && surd.isRational()) {
      return new ExactValue('rational', surd.toRational());
    }
    return new ExactValue('surd', surd);
  }

  static fromPi(q) {
    const piF = q instanceof PiForm ? q : new PiForm(q);
    return new ExactValue('pi', piF);
  }

  static fromDMS(d, m, s, isNeg = false) {
    const dms = d instanceof DMSForm ? d : new DMSForm(d, m, s, isNeg);
    return new ExactValue('dms', dms);
  }

  static fromDecimal(val) {
    const dec = val instanceof Decimal15 ? val : Decimal15.from(val);
    // Attempt exact rational conversion if finite and clean
    try {
      const rat = Rational.from(val);
      if (rat.canDisplayExact() && rat.d <= 100000n) {
        return new ExactValue('rational', rat, dec);
      }
    } catch (e) {
      // Fall through to decimal
    }
    return new ExactValue('decimal', dec, dec);
  }

  static sqrt(val) {
    const ev = ExactValue.from(val);
    if (ev.type === 'rational') {
      const r = ev.value;
      if (r.n < 0n) throw new Error('Math ERROR');
      const surd = SurdForm.sqrt(r);
      return ExactValue.fromSurd(surd);
    }
    if (ev.type === 'surd') {
      // Nested radicals fallback to decimal if not perfect
      const dec = ev.toDecimal15();
      return ExactValue.fromDecimal(ScientificFunctions.sqrt(dec));
    }
    const dec = ev.toDecimal15();
    return ExactValue.fromDecimal(ScientificFunctions.sqrt(dec));
  }

  static pi() {
    return new ExactValue('pi', new PiForm(1n));
  }

  // --- Exact Trigonometry ---

  static sin(angleVal, unit = 'DEG') {
    return ExactValue._trig('sin', angleVal, unit);
  }

  static cos(angleVal, unit = 'DEG') {
    return ExactValue._trig('cos', angleVal, unit);
  }

  static tan(angleVal, unit = 'DEG') {
    return ExactValue._trig('tan', angleVal, unit);
  }

  static _trig(fnName, angleVal, unit = 'DEG') {
    const numAngle = typeof angleVal === 'number'
      ? angleVal
      : (angleVal.toNumber ? angleVal.toNumber() : Number(angleVal));

    // Convert angle to degrees for table lookup
    let deg = null;
    const u = (unit || 'DEG').toUpperCase();
    if (u === 'DEG') {
      deg = numAngle;
    } else if (u === 'RAD') {
      deg = (numAngle * 180) / Math.PI;
    } else if (u === 'GRA') {
      deg = (numAngle * 180) / 200;
    }

    if (deg !== null && Number.isFinite(deg)) {
      // Normalize angle to [0, 360)
      let modDeg = ((deg % 360) + 360) % 360;
      // Round to nearest integer if within epsilon (for floating point radian conversions)
      const nearestInt = Math.round(modDeg);
      if (Math.abs(modDeg - nearestInt) < 1e-7) {
        modDeg = nearestInt % 360;
      }

      const exact = ExactValue._lookupTrigDeg(fnName, modDeg);
      if (exact !== undefined) {
        return exact;
      }
    }

    // Fallback to Decimal15 computation
    const dec = ScientificFunctions[fnName](angleVal, unit);
    return ExactValue.fromDecimal(dec);
  }

  static _lookupTrigDeg(fn, deg) {
    // Exact table for standard angles: 0, 15, 30, 45, 60, 75, 90 ...
    const sqrt2_over_2 = () => new SurdForm(0n, [{ coeff: new Rational(1n, 2n), radicand: 2n }]);
    const sqrt3_over_2 = () => new SurdForm(0n, [{ coeff: new Rational(1n, 2n), radicand: 3n }]);
    const sqrt3_over_3 = () => new SurdForm(0n, [{ coeff: new Rational(1n, 3n), radicand: 3n }]);
    const sqrt3 = () => new SurdForm(0n, [{ coeff: new Rational(1n, 1n), radicand: 3n }]);

    // 15° and 75° combinations: (sqrt(6) ± sqrt(2)) / 4
    const sin15 = () => new SurdForm(0n, [
      { coeff: new Rational(1n, 4n), radicand: 6n },
      { coeff: new Rational(-1n, 4n), radicand: 2n }
    ]);
    const cos15 = () => new SurdForm(0n, [
      { coeff: new Rational(1n, 4n), radicand: 6n },
      { coeff: new Rational(1n, 4n), radicand: 2n }
    ]);
    const tan15 = () => new SurdForm(2n, [{ coeff: new Rational(-1n, 1n), radicand: 3n }]);
    const tan75 = () => new SurdForm(2n, [{ coeff: new Rational(1n, 1n), radicand: 3n }]);

    const table = {
      0: { sin: ExactValue.fromInt(0), cos: ExactValue.fromInt(1), tan: ExactValue.fromInt(0) },
      15: { sin: ExactValue.fromSurd(sin15()), cos: ExactValue.fromSurd(cos15()), tan: ExactValue.fromSurd(tan15()) },
      30: { sin: ExactValue.fromRational(1, 2), cos: ExactValue.fromSurd(sqrt3_over_2()), tan: ExactValue.fromSurd(sqrt3_over_3()) },
      45: { sin: ExactValue.fromSurd(sqrt2_over_2()), cos: ExactValue.fromSurd(sqrt2_over_2()), tan: ExactValue.fromInt(1) },
      60: { sin: ExactValue.fromSurd(sqrt3_over_2()), cos: ExactValue.fromRational(1, 2), tan: ExactValue.fromSurd(sqrt3()) },
      75: { sin: ExactValue.fromSurd(cos15()), cos: ExactValue.fromSurd(sin15()), tan: ExactValue.fromSurd(tan75()) },
      90: { sin: ExactValue.fromInt(1), cos: ExactValue.fromInt(0), tan: null /* Math ERROR */ },
      105: { sin: ExactValue.fromSurd(cos15()), cos: ExactValue.fromSurd(sin15().neg()), tan: ExactValue.fromSurd(tan75().neg()) },
      120: { sin: ExactValue.fromSurd(sqrt3_over_2()), cos: ExactValue.fromRational(-1, 2), tan: ExactValue.fromSurd(sqrt3().neg()) },
      135: { sin: ExactValue.fromSurd(sqrt2_over_2()), cos: ExactValue.fromSurd(sqrt2_over_2().neg()), tan: ExactValue.fromInt(-1) },
      150: { sin: ExactValue.fromRational(1, 2), cos: ExactValue.fromSurd(sqrt3_over_2().neg()), tan: ExactValue.fromSurd(sqrt3_over_3().neg()) },
      165: { sin: ExactValue.fromSurd(sin15()), cos: ExactValue.fromSurd(cos15().neg()), tan: ExactValue.fromSurd(tan15().neg()) },
      180: { sin: ExactValue.fromInt(0), cos: ExactValue.fromInt(-1), tan: ExactValue.fromInt(0) },
      195: { sin: ExactValue.fromSurd(sin15().neg()), cos: ExactValue.fromSurd(cos15().neg()), tan: ExactValue.fromSurd(tan15()) },
      210: { sin: ExactValue.fromRational(-1, 2), cos: ExactValue.fromSurd(sqrt3_over_2().neg()), tan: ExactValue.fromSurd(sqrt3_over_3()) },
      225: { sin: ExactValue.fromSurd(sqrt2_over_2().neg()), cos: ExactValue.fromSurd(sqrt2_over_2().neg()), tan: ExactValue.fromInt(1) },
      240: { sin: ExactValue.fromSurd(sqrt3_over_2().neg()), cos: ExactValue.fromRational(-1, 2), tan: ExactValue.fromSurd(sqrt3()) },
      255: { sin: ExactValue.fromSurd(cos15().neg()), cos: ExactValue.fromSurd(sin15().neg()), tan: ExactValue.fromSurd(tan75()) },
      270: { sin: ExactValue.fromInt(-1), cos: ExactValue.fromInt(0), tan: null /* Math ERROR */ },
      285: { sin: ExactValue.fromSurd(cos15().neg()), cos: ExactValue.fromSurd(sin15()), tan: ExactValue.fromSurd(tan75().neg()) },
      300: { sin: ExactValue.fromSurd(sqrt3_over_2().neg()), cos: ExactValue.fromRational(1, 2), tan: ExactValue.fromSurd(sqrt3().neg()) },
      315: { sin: ExactValue.fromSurd(sqrt2_over_2().neg()), cos: ExactValue.fromSurd(sqrt2_over_2()), tan: ExactValue.fromInt(-1) },
      330: { sin: ExactValue.fromRational(-1, 2), cos: ExactValue.fromSurd(sqrt3_over_2()), tan: ExactValue.fromSurd(sqrt3_over_3().neg()) },
      345: { sin: ExactValue.fromSurd(sin15().neg()), cos: ExactValue.fromSurd(cos15()), tan: ExactValue.fromSurd(tan15().neg()) }
    };

    const entry = table[deg];
    if (entry) {
      const val = entry[fn];
      if (val === null) throw new Error('Math ERROR');
      return val;
    }
    return undefined;
  }

  // --- Arithmetic Operations ---

  add(other) {
    const o = ExactValue.from(other);
    try {
      if (this.type === 'dms' || o.type === 'dms') {
        const d1 = this.type === 'dms' ? this.value.toDecimal() : this.toNumber();
        const d2 = o.type === 'dms' ? o.value.toDecimal() : o.toNumber();
        return new ExactValue('dms', DMSForm.fromDecimal(d1 + d2));
      }
      if (this.type === 'rational' && o.type === 'rational') {
        return ExactValue.fromRational(this.value.add(o.value).n, this.value.add(o.value).d);
      }
      if ((this.type === 'surd' || this.type === 'rational') && (o.type === 'surd' || o.type === 'rational')) {
        const s1 = SurdForm.from(this.value);
        const s2 = SurdForm.from(o.value);
        const res = s1.add(s2);
        return ExactValue.fromSurd(res);
      }
      if (this.type === 'pi' && o.type === 'pi') {
        const res = this.value.add(o.value);
        return res instanceof PiForm ? ExactValue.fromPi(res) : ExactValue.fromRational(res.n, res.d);
      }
    } catch (e) {
      // Fallback
    }
    return ExactValue.fromDecimal(this.toDecimal15().add(o.toDecimal15()));
  }

  sub(other) {
    const o = ExactValue.from(other);
    try {
      if (this.type === 'dms' || o.type === 'dms') {
        const d1 = this.type === 'dms' ? this.value.toDecimal() : this.toNumber();
        const d2 = o.type === 'dms' ? o.value.toDecimal() : o.toNumber();
        return new ExactValue('dms', DMSForm.fromDecimal(d1 - d2));
      }
      if (this.type === 'rational' && o.type === 'rational') {
        return ExactValue.fromRational(this.value.sub(o.value).n, this.value.sub(o.value).d);
      }
      if ((this.type === 'surd' || this.type === 'rational') && (o.type === 'surd' || o.type === 'rational')) {
        const s1 = SurdForm.from(this.value);
        const s2 = SurdForm.from(o.value);
        const res = s1.sub(s2);
        return ExactValue.fromSurd(res);
      }
      if (this.type === 'pi' && o.type === 'pi') {
        const res = this.value.sub(o.value);
        return res instanceof PiForm ? ExactValue.fromPi(res) : ExactValue.fromRational(res.n, res.d);
      }
    } catch (e) {
      // Fallback
    }
    return ExactValue.fromDecimal(this.toDecimal15().sub(o.toDecimal15()));
  }

  mul(other) {
    const o = ExactValue.from(other);
    try {
      if (this.type === 'dms' || o.type === 'dms') {
        const d1 = this.type === 'dms' ? this.value.toDecimal() : this.toNumber();
        const d2 = o.type === 'dms' ? o.value.toDecimal() : o.toNumber();
        return new ExactValue('dms', DMSForm.fromDecimal(d1 * d2));
      }
      if (this.type === 'rational' && o.type === 'rational') {
        return ExactValue.fromRational(this.value.mul(o.value).n, this.value.mul(o.value).d);
      }
      if ((this.type === 'surd' || this.type === 'rational') && (o.type === 'surd' || o.type === 'rational')) {
        const s1 = SurdForm.from(this.value);
        const s2 = SurdForm.from(o.value);
        const res = s1.mul(s2);
        return ExactValue.fromSurd(res);
      }
      if (this.type === 'pi' && o.type === 'rational') {
        return ExactValue.fromPi(this.value.mul(o.value));
      }
      if (this.type === 'rational' && o.type === 'pi') {
        return ExactValue.fromPi(o.value.mul(this.value));
      }
    } catch (e) {
      // Fallback
    }
    return ExactValue.fromDecimal(this.toDecimal15().mul(o.toDecimal15()));
  }

  div(other) {
    const o = ExactValue.from(other);
    try {
      if (this.type === 'dms' || o.type === 'dms') {
        const d1 = this.type === 'dms' ? this.value.toDecimal() : this.toNumber();
        const d2 = o.type === 'dms' ? o.value.toDecimal() : o.toNumber();
        if (d2 === 0) throw new Error('Math ERROR');
        return new ExactValue('dms', DMSForm.fromDecimal(d1 / d2));
      }
      if (this.type === 'rational' && o.type === 'rational') {
        const res = this.value.div(o.value);
        return ExactValue.fromRational(res.n, res.d);
      }
      if ((this.type === 'surd' || this.type === 'rational') && (o.type === 'surd' || o.type === 'rational')) {
        const s1 = SurdForm.from(this.value);
        const s2 = SurdForm.from(o.value);
        const res = s1.div(s2);
        return ExactValue.fromSurd(res);
      }
      if (this.type === 'pi' && o.type === 'rational') {
        return ExactValue.fromPi(this.value.div(o.value));
      }
      if (this.type === 'rational' && o.type === 'pi') {
        if (o.value.power === 1) {
          const invQ = this.value.div(o.value.q);
          return ExactValue.fromPi(new PiForm(invQ, -1));
        }
      }
      if (this.type === 'pi' && o.type === 'pi') {
        const res = this.value.div(o.value);
        return ExactValue.fromRational(res.n, res.d);
      }
    } catch (e) {
      if (e.message.includes('Math ERROR')) throw e;
    }
    return ExactValue.fromDecimal(this.toDecimal15().div(o.toDecimal15()));
  }

  neg() {
    if (this.type === 'rational') return ExactValue.fromRational(-this.value.n, this.value.d);
    if (this.type === 'surd') return ExactValue.fromSurd(this.value.neg());
    if (this.type === 'pi') return ExactValue.fromPi(this.value.neg());
    if (this.type === 'dms') return new ExactValue('dms', new DMSForm(this.value.d, this.value.m, this.value.s, !this.value.isNegative));
    return ExactValue.fromDecimal(this.toDecimal15().neg());
  }

  toDecimal15() {
    if (this._decimal15) return this._decimal15;
    if (this.type === 'rational') this._decimal15 = this.value.toDecimal15();
    else if (this.type === 'surd') this._decimal15 = this.value.toDecimal15();
    else if (this.type === 'pi') this._decimal15 = this.value.toDecimal15();
    else if (this.type === 'dms') this._decimal15 = this.value.toDecimal15();
    else this._decimal15 = this.value;
    return this._decimal15;
  }

  toNumber() {
    return this.toDecimal15().toNumber();
  }

  isExact() {
    if (this.type === 'decimal') return false;
    if (this.type === 'rational') return this.value.canDisplayExact();
    if (this.type === 'surd') return this.value.canDisplayExact();
    if (this.type === 'pi') return this.value.canDisplayExact();
    if (this.type === 'dms') return true;
    return false;
  }

  // --- Display and S<=>D Cycling ---

  toggleSD() {
    if (this.displayState === 'exact' || this.displayState === 'mixed') {
      this.displayState = 'decimal';
    } else if (this.displayState === 'decimal') {
      if (this.isExact()) {
        this.displayState = 'exact';
      }
    }
  }

  toggleMixed() {
    if (this.type === 'rational') {
      if (this.displayState === 'mixed') {
        this.displayState = 'exact';
      } else {
        this.displayState = 'mixed';
      }
    }
  }

  toggleDMS() {
    if (this.displayState === 'dms') {
      this.displayState = 'decimal';
    } else {
      this.displayState = 'dms';
    }
  }

  formatExact(isMixed = false) {
    if (this.type === 'rational') {
      if (isMixed || this.displayState === 'mixed') {
        return this.value.toMixedString();
      }
      return this.value.toString();
    }
    if (this.type === 'surd') return this.value.formatExact();
    if (this.type === 'pi') return this.value.formatExact();
    if (this.type === 'dms') return this.value.format();
    return this.toDecimal15().toString();
  }

  formatDecimal(setupOptions = {}) {
    const dec = this.toDecimal15();
    return formatNumber(dec, {
      format: setupOptions.numberFormat,
      engOffset: setupOptions.engOffset,
      engSymbols: setupOptions.engSymbols,
      decimalMark: setupOptions.decimalMark,
      digitSeparator: setupOptions.digitSeparator
    }).fullString;
  }

  format(setupOptions = {}) {
    // If user explicitly switched to decimal, or exact form cannot be displayed:
    if (this.displayState === 'decimal' || !this.isExact() || setupOptions.mathIO === false) {
      return this.formatDecimal(setupOptions);
    }

    if (this.displayState === 'dms') {
      const dms = this.type === 'dms' ? this.value : DMSForm.fromDecimal(this.toNumber());
      return dms.format();
    }

    const isMixedPref = setupOptions.fractionType === 'MIXED';
    return this.formatExact(isMixedPref);
  }

  static from(val) {
    if (val instanceof ExactValue) return val;
    if (val instanceof Rational) return new ExactValue('rational', val);
    if (val instanceof SurdForm) return ExactValue.fromSurd(val);
    if (val instanceof PiForm) return ExactValue.fromPi(val);
    if (val instanceof DMSForm) return ExactValue.fromDMS(val);
    if (val instanceof Decimal15) return ExactValue.fromDecimal(val);
    if (typeof val === 'number') {
      if (Number.isInteger(val)) return ExactValue.fromInt(val);
      return ExactValue.fromDecimal(val);
    }
    if (typeof val === 'bigint') return ExactValue.fromInt(val);
    return ExactValue.fromInt(0);
  }
}
