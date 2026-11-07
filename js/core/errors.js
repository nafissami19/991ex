/**
 * Calculator errors. `message` is exactly the text shown on the error screen.
 * `loc` (optional) is the editor location the cursor jumps to with ◀/▶.
 */

export const ERRORS = {
  MATH: 'Math ERROR',
  STACK: 'Stack ERROR',
  SYNTAX: 'Syntax ERROR',
  ARGUMENT: 'Argument ERROR',
  DIMENSION: 'Dimension ERROR',
  VARIABLE: 'Variable ERROR',
  CANT_SOLVE: 'Cannot Solve',
  CANNOT_SOLVE: 'Cannot Solve',
  RANGE: 'Range ERROR',
  TIME_OUT: 'Time Out',
  CIRCULAR: 'Circular ERROR',
  MEMORY: 'Memory ERROR',
  INSUFFICIENT_MEM: 'Memory ERROR',
  NOT_SUPPORTED: 'Not Supported'
};

const KNOWN = new Set(Object.values(ERRORS));

/** Errors that offer [◀][▶]:Goto on the error screen (the rest only offer [AC]:Cancel). */
export const GOTO_ERRORS = new Set([
  ERRORS.MATH,
  ERRORS.STACK,
  ERRORS.SYNTAX,
  ERRORS.ARGUMENT,
  ERRORS.DIMENSION,
  ERRORS.VARIABLE
]);

export class CalcError extends Error {
  constructor(message = ERRORS.MATH, details = {}) {
    if (message === "Can't Solve") message = ERRORS.CANNOT_SOLVE;
    if (message === 'Insufficient MEM') message = ERRORS.MEMORY;
    super(message);
    this.name = 'CalcError';
    this.errorType = message;
    this.details = details;
    this.loc = details.loc || null;
  }

  withLoc(loc) {
    if (!this.loc && loc) this.loc = loc;
    return this;
  }
}

/** Convert anything thrown during a calculation into a CalcError. */
export function toCalcError(err, loc = null) {
  if (err instanceof CalcError) return err.withLoc(loc);
  const msg = err && err.message ? err.message : '';
  if (msg.includes("Can't Solve") || msg.includes('Cannot Solve')) return new CalcError(ERRORS.CANNOT_SOLVE, { loc });
  if (msg.includes('Insufficient MEM') || msg.includes('Memory ERROR')) return new CalcError(ERRORS.MEMORY, { loc });
  for (const known of KNOWN) {
    if (msg.includes(known)) return new CalcError(known, { loc });
  }
  if (err instanceof RangeError) return new CalcError(ERRORS.MATH, { loc });
  return new CalcError(ERRORS.MATH, { loc, cause: msg });
}
