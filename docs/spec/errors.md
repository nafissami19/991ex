# Specification: Errors, Causes & Error Screens

This document defines all error messages, triggering conditions, screen layouts, and recovery operations on the Casio fx-991EX ClassWiz, based on pages 37–40 of the official User's Guide.

---

## 1. Error Screen Display Format

When any calculation error occurs, the calculator halts calculation, retains the faulty expression in the input buffer, and presents a standardized two-line error display:

```
┌──────────────────────────────────────────────┐
│ Math ERROR                                   │
│ [Cancel] : [AC]                              │
│ [Goto]   : [◀] [▶]                           │
└──────────────────────────────────────────────┘
```

### Screen Key Actions
1. **`AC` Key**:
   - Dismisses the error screen.
   - Clears the erroneous expression from the active input line.
   - Returns to an empty input screen ready for new input.
2. **`◀` (Left) or `▶` (Right) Key**:
   - Dismisses the error screen.
   - Restores the input expression.
   - **Positions the blinking cursor directly at or immediately following the offending token** so the user can edit and correct it.
3. **`SHIFT OPTN (QR)`**:
   - Generates an authentic on-screen QR code pointing to Casio's web manual URL for that specific error code.

*(Note: In certain errors such as `Cannot Solve`, only `[Cancel] : [AC]` or `Continue : [=]` is displayed; see below).*

---

## 2. Complete Error Catalog

### 1. `Math ERROR`
- **Causes**:
  - Division by zero ($1 \div 0$, $\tan(90^\circ)$, $\frac{1}{0}$).
  - Calculation intermediate or final result exceeds $|x| \ge 1 \times 10^{100}$.
  - Function argument outside permitted domain (e.g. $\sqrt{-4}$ in real mode, $\ln(0)$, $\sin^{-1}(1.5)$, $70!$, $nPr$ with $r > n$).
  - Illegal matrix operations (e.g. inversion of singular matrix $\det = 0$).
  - Zero value passed as coefficient in Ratio mode.
- **Screen Options**: `[Cancel] : [AC]`, `[Goto] : [◀] [▶]`.

### 2. `Stack ERROR`
- **Causes**:
  - Capacity of the numeric stack (10 levels) or command stack (24 levels) exceeded by excessively nested parentheses or operations.
  - Matrix/Vector stack capacity exceeded in composite operations.
- **Screen Options**: `[Cancel] : [AC]`, `[Goto] : [◀] [▶]`.

### 3. `Syntax ERROR`
- **Causes**:
  - Improper expression syntax (e.g. `++`, `1×+2`, unmatched operators, trailing open operators before `=`).
  - Misplaced punctuation, invalid comma placement, or incomplete templates.
  - Attempting to use fractional or negative numbers where integers are required.
- **Screen Options**: `[Cancel] : [AC]`, `[Goto] : [◀] [▶]`. Cursor jumps to exact syntax violation.

### 4. `Argument ERROR`
- **Causes**:
  - Improper argument supplied to built-in commands (e.g. improper tolerance specified for numerical integration, dimension out of 1–4 range in `Identity(n)`).
- **Screen Options**: `[Cancel] : [AC]`, `[Goto] : [◀] [▶]`.

### 5. `Dimension ERROR` (Matrix & Vector Modes)
- **Causes**:
  - Attempting to use a matrix or vector variable without first defining its dimensions.
  - Performing operations with incompatible dimensions:
    - Addition/Subtraction: matrices must have identical dimensions ($m \times n$).
    - Multiplication: columns of first matrix must equal rows of second matrix ($m \times k$ with $k \times n$).
    - Inversion/Determinant: matrix must be square ($n \times n$).
    - Vector cross product: vectors must be 3-dimensional.
- **Screen Options**: `[Cancel] : [AC]`, `[Goto] : [◀] [▶]`.

### 6. `Variable ERROR` (SOLVE Feature)
- **Causes**:
  - Executing `SOLVE` (`SHIFT CALC`) on an expression that contains no variables (e.g. `2 + 3 = 0`).
- **Screen Options**: `[Cancel] : [AC]`, `[Goto] : [◀] [▶]`.

### 7. `Cannot Solve` (SOLVE Feature)
- **Causes**:
  - Newton's method solver fails to converge after maximum iterations from the given starting point.
- **Screen Options**:
  - Shows `Cannot Solve`.
  - Prompts: `Continue:[=]` or `[Cancel]:[AC]`.
  - Pressing `=` re-runs convergence iterations; pressing `AC` cancels.

### 8. `Range ERROR`
- **Causes**:
  - Table Mode: The combination of `Start`, `End`, and `Step` produces more rows than allowable capacity ($> 45$ rows for $f(x)$ or $> 30$ rows for $f(x), g(x)$).
  - Spreadsheet Mode: A batch input range specifies cells outside `A1:E45` or uses invalid range syntax.
- **Screen Options**: `[Cancel] : [AC]`.

### 9. `Time Out`
- **Causes**:
  - Numerical integration ($\int$) or numerical derivative ($\frac{d}{dx}$) exceeds calculation time limit before convergence criterion is reached.
- **Screen Options**: `[Cancel] : [AC]`.

### 10. `Circular ERROR` (Spreadsheet Mode)
- **Causes**:
  - Circular formula dependency between spreadsheet cells (e.g. cell `A1` containing `=A1+1` or circular cycle `A1 -> B1 -> A1`).
- **Screen Options**: `[Cancel] : [AC]`.

### 11. `Memory ERROR` (Spreadsheet Mode)
- **Causes**:
  - Total spreadsheet capacity exceeds 1,700 bytes.
  - Long chain of consecutive cell references (e.g. `A2` references `A1`, `A3` references `A2`...).
- **Screen Options**: `[Cancel] : [AC]`.

### 12. `Not Supported (Version 3)` (QR Code Feature)
- **Causes**:
  - Pressing `SHIFT OPTN (QR)` in a mode that does not support QR Version 3 when Setup QR Code is set to Version 3.
- **Screen Options**: Press `AC` to return.

---

## 3. Items to Verify on Emulator ("VERIFY ON EMULATOR")

- [ ] **V-ERR-01**: Exact layout and pixel font used for the Error Screen header and prompt lines.
- [ ] **V-ERR-02**: Does pressing `▶` jump to the start or end of the offending token on `Syntax ERROR`?
- [ ] **V-ERR-03**: Does pressing `SHIFT AC (OFF)` work while an error screen is being displayed?
- [ ] **V-ERR-04**: In Spreadsheet mode, does an individual cell show `ERROR` inline, or does it trigger a full-screen modal error?
