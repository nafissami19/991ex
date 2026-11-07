/**
 * Casio fx-991EX ClassWiz Pi Form
 *
 * Represents exact multiples of pi:
 *   P = q * pi^power
 * where q is a Rational number and power is 1 (multiplied) or -1 (divided).
 *
 * Enforces Casio rules:
 * - Pi-form display range: |x| < 10^6
 * - Display format: "π", "2π", "1/6π", "-3/4π", "1/(2π)"
 * - Arithmetic combinations with other PiForms and Rationals
 */

import { Rational } from './Rational.js';
import { Decimal15 } from '../number/Decimal15.js';
import { CASIO_PI } from '../number/functions.js';

export class PiForm {
  constructor(q = 1n, power = 1) {
    this.q = q instanceof Rational ? q : Rational.from(q);
    this.power = power; // 1 for q*pi, -1 for q/pi
  }

  isZero() {
    return this.q.isZero();
  }

  add(other) {
    if (other instanceof PiForm) {
      if (this.power === other.power) {
        const sumQ = this.q.add(other.q);
        if (sumQ.isZero()) return new Rational(0n, 1n);
        return new PiForm(sumQ, this.power);
      }
      throw new Error('Cannot combine pi and 1/pi symbolically');
    }
    const r = Rational.from(other);
    if (r.isZero()) return this;
    throw new Error('Cannot combine pi with non-pi term symbolically');
  }

  sub(other) {
    if (other instanceof PiForm) {
      if (this.power === other.power) {
        const diffQ = this.q.sub(other.q);
        if (diffQ.isZero()) return new Rational(0n, 1n);
        return new PiForm(diffQ, this.power);
      }
      throw new Error('Cannot combine pi and 1/pi symbolically');
    }
    const r = Rational.from(other);
    if (r.isZero()) return this;
    throw new Error('Cannot combine pi with non-pi term symbolically');
  }

  mul(other) {
    if (other instanceof PiForm) {
      if (this.power === 1 && other.power === -1) {
        return this.q.mul(other.q);
      }
      if (this.power === -1 && other.power === 1) {
        return this.q.mul(other.q);
      }
      throw new Error('pi^2 cannot be represented in standard pi-form');
    }
    const r = Rational.from(other);
    if (r.isZero()) return new Rational(0n, 1n);
    return new PiForm(this.q.mul(r), this.power);
  }

  div(other) {
    if (other instanceof PiForm) {
      if (this.power === other.power) {
        // (q1 * pi) / (q2 * pi) = q1 / q2 (Rational!)
        return this.q.div(other.q);
      }
      throw new Error('pi^2 cannot be represented in standard pi-form');
    }
    const r = Rational.from(other);
    if (r.isZero()) throw new Error('Math ERROR');
    return new PiForm(this.q.div(r), this.power);
  }

  neg() {
    return new PiForm(this.q.neg(), this.power);
  }

  canDisplayExact() {
    // Casio limit: |x| < 10^6
    const approx = Math.abs(this.toNumber());
    if (approx >= 1e6 || approx <= 1e-6) return false;
    return this.q.canDisplayExact();
  }

  toNumber() {
    const qNum = this.q.toNumber();
    return this.power === 1 ? qNum * Math.PI : qNum / Math.PI;
  }

  formatExact() {
    if (this.q.isZero()) return '0';

    if (this.power === -1) {
      if (this.q.n === 1n && this.q.d === 1n) return '1/π';
      if (this.q.n === -1n && this.q.d === 1n) return '-1/π';
      if (this.q.d === 1n) return `${this.q.n}/π`;
      if (this.q.n === 1n) return `1/(${this.q.d}π)`;
      if (this.q.n === -1n) return `-1/(${this.q.d}π)`;
      return `${this.q.n}/(${this.q.d}π)`;
    }

    if (this.q.n === 1n && this.q.d === 1n) return 'π';
    if (this.q.n === -1n && this.q.d === 1n) return '-π';

    if (this.q.d === 1n) {
      return `${this.q.n}π`;
    }

    if (this.q.n === 1n) {
      return `1/${this.q.d}π`;
    }
    if (this.q.n === -1n) {
      return `-1/${this.q.d}π`;
    }

    return `${this.q.n}/${this.q.d}π`;
  }

  toDecimal15() {
    const decQ = this.q.toDecimal15();
    return this.power === 1 ? decQ.mul(CASIO_PI) : decQ.div(CASIO_PI);
  }

  static from(val) {
    if (val instanceof PiForm) return val;
    return new PiForm(val);
  }
}
