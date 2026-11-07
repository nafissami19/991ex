# Specification: SETUP Menu & Global Configuration

This document specifies the complete hierarchy, options, defaults, and behavioral effects of the `SETUP` menu (`SHIFT MENU`), extracted from pages 6–8 of the official Casio fx-570EX/991EX User's Guide.

---

## 1. Access & Navigation

- **Entry**: Press `SHIFT MENU (SETUP)`.
- **Pagination**: Use `▼` and `▲` to scroll across setup pages.
- **Selection**: Press the number key corresponding to the desired menu item.
- **Submenu Back**: When viewing a submenu, press `◀` to return to the parent setup page.
- **Exit**: Press `AC` to dismiss the SETUP menu without making further changes.

---

## 2. Complete SETUP Menu Structure

### Page 1

#### 1: Input/Output
Controls input presentation and output representation.
- **`1: MathI/MathO`** (Initial Default ◆)
  - Input: 2D Natural Textbook display (fractions, radicals, exponents, templates).
  - Output: Exact mathematical forms (proper/improper fractions, $\sqrt{\phantom{x}}$ surds, $\pi$ multiples).
  - Indicator: `Math` indicator turns **ON**.
- **`2: MathI/DecimalO`**
  - Input: 2D Natural Textbook display.
  - Output: Automatically converted to decimal numbers. Pressing `S<=>D` toggles back to exact form where available.
  - Indicator: `Math` indicator turns **ON**.
- **`3: LineI/LineO`**
  - Input: Single-line linear input (fractions input with `┘`, e.g. `2┘3`).
  - Output: Linear fraction or decimal.
  - Indicator: `Math` indicator turns **OFF**.
- **`4: LineI/DecimalO`**
  - Input: Single-line linear input.
  - Output: Decimal representation.
  - Indicator: `Math` indicator turns **OFF**.

#### 2: Angle Unit
Specifies the angle unit for trigonometric, polar, and coordinate conversions.
- **`1: Degree`** (Initial Default ◆) — Status indicator: `D`.
- **`2: Radian`** — Status indicator: `R`.
- **`3: Gradian`** — Status indicator: `G`.

#### 3: Number Format
Specifies the precision and notation for displayed results.
- **`1: Fix`**: Prompts for digits `0` to `9`. Fixes the number of decimal places shown. Rounds off to the chosen decimal place. Status indicator: `FIX`.
- **`2: Sci`**: Prompts for significant digits `0` to `9` (entering `0` selects 10 significant digits). Mantissa is displayed with specified digits $\times 10^n$. Status indicator: `SCI`.
- **`3: Norm`**: Prompts for option `1` or `2`:
  - **`1: Norm 1`** (Initial Default ◆): Switches to exponential notation $\times 10^n$ when $|x| < 10^{-2}$ or $|x| \ge 10^{10}$.
  - **`2: Norm 2`**: Switches to exponential notation $\times 10^n$ when $|x| < 10^{-9}$ or $|x| \ge 10^{10}$.

#### 4: Engineer Symbol
- **`1: On`**: Automatically replaces powers of 10 in multiples of 3 with engineering suffix symbols ($m, \mu, n, p, f, k, M, G, T, P, E$). Status indicator: `E`.
- **`2: Off`** (Initial Default ◆): Standard numeric exponent display.

---

### Page 2

#### 1: Fraction Result
Specifies default display form for fractional results.
- **`1: ab/c`**: Mixed fraction format (e.g. $1\frac{1}{2}$).
- **`2: d/c`** (Initial Default ◆): Improper fraction format (e.g. $\frac{3}{2}$).

#### 2: Complex
Specifies output coordinate form in Complex mode and complex roots in Equation mode.
- **`1: a+bi`** (Initial Default ◆): Rectangular coordinate format. Status indicator: `i`.
- **`2: r∠θ`**: Polar coordinate format. Status indicator: `∠`.

#### 3: Statistics
- **`1: On`**: Adds a `Freq` (frequency) column to the Statistics Mode editor table.
- **`2: Off`** (Initial Default ◆): Only displays data columns ($x$, or $x$ and $y$).

#### 4: Spreadsheet
- **`1: Auto Calc`**:
  - `1: On` (Default ◆): Automatically recomputes all formulas upon any cell modification.
  - `2: Off`: Disables automatic recalculation; recalculation must be manually invoked via `OPTN ▼ (Recalculate)`.
- **`2: Show Cell`**:
  - `1: Formula` (Default ◆): The edit bar shows the raw formula string (e.g. `=A1+2`).
  - `2: Value`: The edit bar displays the evaluated numeric result of the formula.

---

### Page 3

#### 1: Equation/Func
- **`1: On`** (Initial Default ◆): Enables calculation and display of complex roots in polynomial equations.
- **`2: Off`**: Restricts polynomial equation solutions to real numbers only.

#### 2: Table
- **`1: f(x)`**: Table mode generates values for one function $f(x)$ only. Maximum capacity: 45 rows.
- **`2: f(x),g(x)`** (Initial Default ◆): Table mode prompts for two functions $f(x)$ and $g(x)$. Maximum capacity: 30 rows.

#### 3: Decimal Mark
- **`1: Dot`** (Initial Default ◆): Uses period `.` as decimal separator in outputs. Multi-item argument separator is `,`.
- **`2: Comma`**: Uses comma `,` as decimal separator in outputs. Multi-item argument separator becomes semicolon `;`.

#### 4: Digit Separator
- **`1: On`**: Inserts 3-digit thousand separation marks in displayed outputs.
- **`2: Off`** (Initial Default ◆): No thousand separators displayed.

---

### Page 4

#### 1: MultiLine Font
Specifies display font size when `LineI/LineO` or `LineI/DecimalO` is active.
- **`1: Normal Font`** (Initial Default ◆): Up to 4 lines of linear text displayed.
- **`2: Small Font`**: Up to 6 lines of linear text displayed.

#### 2: QR Code
Specifies QR code format generated upon pressing `SHIFT OPTN (QR)`.
- **`1: Version 3`**: Compact QR code; supported in limited modes.
- **`2: Version 11`** (Initial Default ◆): Larger high-density QR code supporting all modes.

#### 3: Contrast
Displays the interactive LCD contrast calibration screen:
- Shows a horizontal contrast gauge (values 0 to 15, default 8).
- `◀`: Decrements contrast (lighter).
- `▶`: Increments contrast (darker).
- `AC` or `EXE`: Saves setting and exits to previous screen.

#### 4: Auto Power Off (APO) *(VERIFY ON EMULATOR)*
- Options: `1: 10 Min` (Default), `2: 60 Min` *(VERIFY ON EMULATOR if present on Page 4 or in hardware config)*.

---

## 3. Setup Reset & Persistence

- **Setup Reset**: `SHIFT 9 (RESET) 1 (Setup Data) = (Yes)` restores all settings above to initial defaults (◆) **except Contrast**, which is retained.
- **Full Reset**: `SHIFT 9 (RESET) 3 (Initialize All) = (Yes)` resets all setup data and clears all memories, tables, matrices, and spreadsheet grids.
- **Power Off Persistence**: All SETUP configuration settings persist when the calculator is powered off (`SHIFT AC`) or enters Auto Power Off.

---

## 4. Items to Verify on Emulator ("VERIFY ON EMULATOR")

- [ ] **V-SET-01**: Check if Page 4 contains `3: Contrast` and `4: Auto Power Off`, or if Contrast is alone on Page 4.
- [ ] **V-SET-02**: Verify whether changing `Input/Output` from `MathI` to `LineI` while an expression is being typed clears the current input buffer or converts it.
- [ ] **V-SET-03**: Verify exact character used for `Digit Separator` when enabled (space vs subtle apostrophe/tick).
- [ ] **V-SET-04**: When `Decimal Mark: Comma` is selected, verify how coordinates in `Pol(` or matrix elements display their separators.
