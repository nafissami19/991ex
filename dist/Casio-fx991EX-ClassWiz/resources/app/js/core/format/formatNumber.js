/**
 * Casio fx-991EX ClassWiz Number Display Formatter
 *
 * Implements 10-digit display rounding, Norm 1, Norm 2, Fix 0-9, Sci 0-9,
 * ENG / Shift ENG shifts, Engineering Symbols, Decimal Mark, and Digit Separators.
 *
 * Conforms to pages 6-8 and 13 of the User's Guide.
 */

import { Decimal15 } from '../number/Decimal15.js';

export const SUPERSCRIPT_MAP = {
  '-': '\u207B',
  '+': '\u207A',
  '0': '\u2070',
  '1': '\u00B9',
  '2': '\u00B2',
  '3': '\u00B3',
  '4': '\u2074',
  '5': '\u2075',
  '6': '\u2076',
  '7': '\u2077',
  '8': '\u2078',
  '9': '\u2079'
};

export const ENG_SYMBOLS = {
  18: 'E',   // Exa
  15: 'P',   // Peta
  12: 'T',   // Tera
  9: 'G',    // Giga
  6: 'M',    // Mega
  3: 'k',    // kilo
  '-3': 'm', // milli
  '-6': 'µ', // micro
  '-9': 'n', // nano
  '-12': 'p',// pico
  '-15': 'f' // femto
};

/**
 * Convert number or string of digits to unicode superscript characters
 */
export function toSuperscript(num) {
  return String(num)
    .split('')
    .map(ch => SUPERSCRIPT_MAP[ch] || ch)
    .join('');
}

/**
 * Format a Decimal15 into structured Casio display layout
 *
 * @param {Decimal15|number|string} val
 * @param {Object} options
 * @param {Object} [options.format={type: 'NORM', value: 1}]
 * @param {number|null} [options.engOffset=null] Multiple-of-3 exponent shift (null = not in ENG mode)
 * @param {boolean} [options.engSymbols=false] Whether engineering symbols (k, M, m, etc.) are active
 * @param {'DOT'|'COMMA'} [options.decimalMark='DOT'] Decimal separator mark
 * @param {boolean} [options.digitSeparator=false] Thousand separator active
 * @returns {{
 *   mantissa: string,
 *   exponent: number|null,
 *   expString: string,
 *   engSymbol: string|null,
 *   fullString: string,
 *   isExponential: boolean,
 *   sign: number
 * }}
 */
export function formatNumber(val, options = {}) {
  const d = Decimal15.from(val);
  const format = options.format || { type: 'NORM', value: 1 };
  const engOffset = options.engOffset ?? null;
  const engSymbols = Boolean(options.engSymbols);
  const decimalMark = options.decimalMark === 'COMMA' ? ',' : '.';
  const digitSeparator = Boolean(options.digitSeparator);

  // 1. Zero handling
  if (d.isZero()) {
    return formatZero(format, engOffset, engSymbols, decimalMark);
  }

  const sign = d.sign;
  const signStr = sign < 0 ? '-' : '';

  // 2. Extract 10-digit rounded mantissa and base-10 scientific exponent
  // Value = sign * (m10 / 10^9) * 10^sciExp
  let { m10, sciExp } = get10DigitRounded(d);

  // Check if rounding caused underflow to 0
  if (m10 === 0n) {
    return formatZero(format, engOffset, engSymbols, decimalMark);
  }

  // 3. ENG Mode (overrides standard display formatting when engOffset is active)
  if (engOffset !== null) {
    return formatENG(signStr, m10, sciExp, engOffset, engSymbols, decimalMark, digitSeparator);
  }

  // 4. Standard Formats: NORM, FIX, SCI
  const formatType = (format.type || 'NORM').toUpperCase();
  const formatVal = format.value ?? 1;

  if (formatType === 'SCI') {
    return formatSCI(signStr, m10, sciExp, formatVal, decimalMark, digitSeparator);
  }

  if (formatType === 'FIX') {
    return formatFIX(d, signStr, m10, sciExp, formatVal, decimalMark, digitSeparator);
  }

  // Default: NORM 1 or NORM 2
  return formatNORM(signStr, m10, sciExp, formatVal, decimalMark, digitSeparator);
}

/* -------------------------------------------------------------------------- */
/* Helper Routines                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Rounds internal 15-digit mantissa to 10 display digits (round half-up on 11th digit)
 */
function get10DigitRounded(d) {
  const M = d.mantissa;
  // Mantissa has 15 digits.
  // First 10 digits: M / 10^5. 11th digit: (M / 10^4) % 10.
  const m11 = M / 10000n;
  let m10 = (m11 + 5n) / 10n;
  let sciExp = d.sciExp;

  // Ripple carry check: if m10 >= 10^10, divide by 10 and bump sciExp
  if (m10 >= 10000000000n) {
    m10 /= 10n;
    sciExp++;
  }

  return { m10, sciExp };
}

/**
 * Zero formatting helper
 */
function formatZero(format, engOffset, engSymbols, decimalMark) {
  const formatType = (format?.type || 'NORM').toUpperCase();
  const formatVal = format?.value ?? 1;

  let mantissa = '0';
  let exponent = null;
  let expString = '';
  let isExponential = false;
  let engSymbol = null;

  if (engOffset !== null) {
    exponent = engOffset;
    if (engSymbols && ENG_SYMBOLS[exponent]) {
      engSymbol = ENG_SYMBOLS[exponent];
    } else if (exponent !== 0) {
      expString = toSuperscript(exponent);
      isExponential = true;
    }
  } else if (formatType === 'FIX') {
    const decimals = Math.max(0, Math.min(9, formatVal));
    if (decimals > 0) {
      mantissa = '0' + decimalMark + '0'.repeat(decimals);
    }
  } else if (formatType === 'SCI') {
    const sigDigits = formatVal === 0 ? 10 : Math.max(1, Math.min(10, formatVal));
    if (sigDigits > 1) {
      mantissa = '0' + decimalMark + '0'.repeat(sigDigits - 1);
    }
    exponent = 0;
    expString = toSuperscript(0);
    isExponential = true;
  }

  let fullString = mantissa;
  if (engSymbol) {
    fullString += engSymbol;
  } else if (isExponential) {
    fullString += '×10' + expString;
  }

  return {
    mantissa,
    exponent,
    expString,
    engSymbol,
    fullString,
    isExponential,
    sign: 0
  };
}

/**
 * Format in Scientific Notation (SCI n)
 */
function formatSCI(signStr, m10, sciExp, formatVal, decimalMark, digitSeparator) {
  // formatVal: 1..9, or 0 (which means 10)
  const sigDigits = formatVal === 0 ? 10 : Math.max(1, Math.min(10, formatVal));

  // Extract sigDigits with rounding half-up
  const str10 = m10.toString();
  let mSig;
  let exp = sciExp;

  if (sigDigits === 10) {
    mSig = str10;
  } else {
    const div = 10n ** BigInt(10 - sigDigits - 1);
    const mDrop = m10 / div;
    let rounded = (mDrop + 5n) / 10n;
    if (rounded >= 10n ** BigInt(sigDigits)) {
      rounded /= 10n;
      exp++;
    }
    mSig = rounded.toString();
  }

  // Construct mantissa: 1 digit before decimal point, remaining after
  let mantissa = mSig[0];
  if (mSig.length > 1) {
    mantissa += decimalMark + mSig.slice(1);
  }

  const expString = toSuperscript(exp);
  const fullString = `${signStr}${mantissa}×10${expString}`;

  return {
    mantissa: `${signStr}${mantissa}`,
    exponent: exp,
    expString,
    engSymbol: null,
    fullString,
    isExponential: true,
    sign: signStr ? -1 : 1
  };
}

/**
 * Format in Fixed Notation (FIX n)
 */
function formatFIX(d, signStr, m10, sciExp, formatVal, decimalMark, digitSeparator) {
  const decimals = Math.max(0, Math.min(9, formatVal));

  // If the number is too large to display as fixed (integer part > 10 digits),
  // Casio automatically switches to SCI mode
  if (sciExp >= 10) {
    return formatSCI(signStr, m10, sciExp, decimals === 0 ? 1 : decimals + 1, decimalMark, digitSeparator);
  }

  // Use Decimal15 toFixed method
  let fixStr = d.toFixed(decimals);
  if (fixStr.startsWith('-')) fixStr = fixStr.slice(1);

  if (decimalMark !== '.') {
    fixStr = fixStr.replace('.', decimalMark);
  }
  if (digitSeparator) {
    fixStr = applyDigitSeparator(fixStr, decimalMark);
  }

  // If result is zero after rounding to specified decimal places, drop negative sign
  const isZeroVal = fixStr.replace(/[.,\s]/g, '').replace(/0/g, '') === '';
  const effectiveSignStr = isZeroVal ? '' : signStr;

  const fullString = `${effectiveSignStr}${fixStr}`;
  return {
    mantissa: fullString,
    exponent: null,
    expString: '',
    engSymbol: null,
    fullString,
    isExponential: false,
    sign: isZeroVal ? 0 : (signStr ? -1 : 1)
  };
}

/**
 * Format in Normal Notation (NORM 1 or NORM 2)
 */
function formatNORM(signStr, m10, sciExp, formatVal, decimalMark, digitSeparator) {
  const normType = formatVal === 2 ? 2 : 1;
  const isExponential = normType === 1
    ? (sciExp < -2 || sciExp >= 10)
    : (sciExp < -9 || sciExp >= 10);

  if (isExponential) {
    // Exponential format
    const str10 = m10.toString();
    let fracPart = str10.slice(1).replace(/0+$/, '');
    let mantissa = str10[0];
    if (fracPart.length > 0) {
      mantissa += decimalMark + fracPart;
    }

    const expString = toSuperscript(sciExp);
    const fullString = `${signStr}${mantissa}×10${expString}`;

    return {
      mantissa: `${signStr}${mantissa}`,
      exponent: sciExp,
      expString,
      engSymbol: null,
      fullString,
      isExponential: true,
      sign: signStr ? -1 : 1
    };
  }

  // Decimal format
  const str10 = m10.toString();
  let decStr;

  if (sciExp >= 0) {
    // Number >= 1
    const intLen = sciExp + 1;
    if (intLen >= str10.length) {
      decStr = str10 + '0'.repeat(intLen - str10.length);
    } else {
      const intPart = str10.slice(0, intLen);
      let fracPart = str10.slice(intLen).replace(/0+$/, '');
      decStr = fracPart.length > 0 ? `${intPart}${decimalMark}${fracPart}` : intPart;
    }
  } else {
    // Number < 1 (sciExp < 0)
    const leadingZeros = -sciExp - 1;
    let fracPart = ('0'.repeat(leadingZeros) + str10).replace(/0+$/, '');
    decStr = `0${decimalMark}${fracPart}`;
  }

  if (digitSeparator) {
    decStr = applyDigitSeparator(decStr, decimalMark);
  }

  const fullString = `${signStr}${decStr}`;
  return {
    mantissa: fullString,
    exponent: null,
    expString: '',
    engSymbol: null,
    fullString,
    isExponential: false,
    sign: signStr ? -1 : 1
  };
}

/**
 * Format in Engineering Notation (ENG / Shift ENG)
 */
function formatENG(signStr, m10, sciExp, engOffset, engSymbols, decimalMark, digitSeparator) {
  // Base exponent is multiple of 3 <= sciExp
  const baseEngExp = Math.floor(sciExp / 3) * 3;
  const targetExp = baseEngExp + engOffset;
  const shift = sciExp - targetExp; // power of 10 to shift mantissa by

  const str10 = m10.toString();
  let mantissa;

  if (shift >= 0) {
    const intLen = shift + 1;
    if (intLen >= str10.length) {
      mantissa = str10 + '0'.repeat(intLen - str10.length);
    } else {
      const intPart = str10.slice(0, intLen);
      let fracPart = str10.slice(intLen).replace(/0+$/, '');
      mantissa = fracPart.length > 0 ? `${intPart}${decimalMark}${fracPart}` : intPart;
    }
  } else {
    const leadingZeros = -shift - 1;
    let fracPart = ('0'.repeat(leadingZeros) + str10).replace(/0+$/, '');
    mantissa = `0${decimalMark}${fracPart}`;
  }

  if (digitSeparator) {
    mantissa = applyDigitSeparator(mantissa, decimalMark);
  }

  // Check engineering symbol
  let engSymbol = null;
  let expString = '';
  let fullString = '';

  if (engSymbols && ENG_SYMBOLS[targetExp]) {
    engSymbol = ENG_SYMBOLS[targetExp];
    fullString = `${signStr}${mantissa}${engSymbol}`;
  } else if (targetExp === 0) {
    fullString = `${signStr}${mantissa}`;
  } else {
    expString = toSuperscript(targetExp);
    fullString = `${signStr}${mantissa}×10${expString}`;
  }

  return {
    mantissa: `${signStr}${mantissa}`,
    exponent: targetExp,
    expString,
    engSymbol,
    fullString,
    isExponential: targetExp !== 0 && !engSymbol,
    sign: signStr ? -1 : 1
  };
}

/**
 * Apply 3-digit thousands separator to integer portion
 */
function applyDigitSeparator(str, decimalMark) {
  const parts = str.split(decimalMark);
  const intPart = parts[0];
  const isNeg = intPart.startsWith('-');
  const rawInt = isNeg ? intPart.slice(1) : intPart;

  let res = '';
  for (let i = 0; i < rawInt.length; i++) {
    if (i > 0 && (rawInt.length - i) % 3 === 0) {
      res += ' ';
    }
    res += rawInt[i];
  }

  const formattedInt = (isNeg ? '-' : '') + res;
  return parts.length > 1 ? `${formattedInt}${decimalMark}${parts[1]}` : formattedInt;
}
