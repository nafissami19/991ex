/**
 * 32-bit two's complement integer arithmetic and formatting for Base-N mode.
 *
 * Range: -2147483648 <= x <= 2147483647 (0x80000000 to 0x7FFFFFFF)
 * Formats:
 *   DEC: signed decimal string (e.g. "555", "-10")
 *   HEX: 8 uppercase hex digits, zero-padded (e.g. "0000022B")
 *   BIN: 32 bits split across two 16-bit lines, 4-bit groups (e.g. "0000 0000 0000 0000\n0000 0000 0000 1000")
 *   OCT: 11 octal digits, zero-padded (e.g. "00000001053")
 */

import { CalcError, ERRORS } from '../../errors.js';

export const MIN_INT32 = -2147483648n;
export const MAX_INT32 = 2147483647n;
export const MASK32 = 0xFFFFFFFFn;

export class BaseNValue {
  constructor(val) {
    const v = BigInt(val);
    if (v < MIN_INT32 || v > MAX_INT32) {
      throw new CalcError(ERRORS.MATH);
    }
    this.value = v;
  }

  static fromUnsigned(u) {
    const bigU = BigInt(u) & MASK32;
    const signed = bigU >= 0x80000000n ? bigU - 0x100000000n : bigU;
    return new BaseNValue(signed);
  }

  get unsigned() {
    return BigInt.asUintN(32, this.value);
  }

  toDecString() {
    return this.value.toString(10);
  }

  toHexString() {
    return this.unsigned.toString(16).toUpperCase().padStart(8, '0');
  }

  toOctString() {
    return this.unsigned.toString(8).padStart(11, '0');
  }

  toBinLines() {
    const b = this.unsigned.toString(2).padStart(32, '0');
    const upper = `${b.slice(0, 4)} ${b.slice(4, 8)} ${b.slice(8, 12)} ${b.slice(12, 16)}`;
    const lower = `${b.slice(16, 20)} ${b.slice(20, 24)} ${b.slice(24, 28)} ${b.slice(28, 32)}`;
    return [upper, lower];
  }

  toBinString() {
    const [u, l] = this.toBinLines();
    return `${u}\n${l}`;
  }

  format(base) {
    switch (base) {
      case 'DEC': return this.toDecString();
      case 'HEX': return this.toHexString();
      case 'OCT': return this.toOctString();
      case 'BIN': return this.toBinString();
      default: return this.toDecString();
    }
  }

  add(other) {
    return new BaseNValue(this.value + other.value);
  }

  sub(other) {
    return new BaseNValue(this.value - other.value);
  }

  mul(other) {
    return new BaseNValue(this.value * other.value);
  }

  div(other) {
    if (other.value === 0n) throw new CalcError(ERRORS.MATH);
    return new BaseNValue(this.value / other.value);
  }

  neg() {
    return new BaseNValue(-this.value);
  }

  and(other) {
    return BaseNValue.fromUnsigned(this.unsigned & other.unsigned);
  }

  or(other) {
    return BaseNValue.fromUnsigned(this.unsigned | other.unsigned);
  }

  xor(other) {
    return BaseNValue.fromUnsigned(this.unsigned ^ other.unsigned);
  }

  xnor(other) {
    return BaseNValue.fromUnsigned(~(this.unsigned ^ other.unsigned) & MASK32);
  }

  not() {
    return BaseNValue.fromUnsigned(~this.unsigned & MASK32);
  }
}
