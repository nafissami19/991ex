# Specification: Keypad Layout & Mode Mappings

This document specifies the behavior of all 50 physical keys + D-Pad on the Casio fx-991EX ClassWiz calculator across different calculation modes, cross-referenced with [`assets/data/key_layout.json`](file:///c:/Users/sami6/OneDrive/Desktop/Casio%20991ex%20duplicate/assets/data/key_layout.json).

---

## 1. Key Matrix & Layout Overview

The keypad consists of 50 keys arranged in logical banks:
1. **Top System Row (Keys 0–3, 8)**: `SHIFT`, `ALPHA`, `MENU / SETUP`, `ON`, `OPTN / QR`.
2. **Directional D-Pad (Keys 4–7)**: `UP (▲)`, `DOWN (▼)`, `LEFT (◀)`, `RIGHT (▶)`.
3. **Upper Function Bank (Keys 9–23)**: `CALC`, `∫dx`, `x`, `FRAC`, `√`, `x²`, `x■`, `log■■`, `ln`, `(-)`, `° ' "`, `x⁻¹`, `sin`, `cos`, `tan`.
4. **Middle Control Bank (Keys 24–29)**: `STO`, `ENG`, `(`, `)`, `S<=>D`, `M+`.
5. **Lower Numeric & Arithmetic Matrix (Keys 30–49)**: Digits `0`–`9`, `DEL`, `AC`, `×`, `÷`, `+`, `-`, `.`, `×10ⁿ`, `Ans`, `=`.

---

## 2. Complete Key Definitions (Calculate Mode Default)

| Index | Name | Primary (Keycap) | SHIFT (Yellow) | ALPHA (Red) | Mode / Color Markings |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **0** | `SHIFT` | Activate Shift modifier | — | — | Yellow keycap |
| **1** | `ALPHA` | Activate Alpha modifier | — | — | Red keycap |
| **2** | `MENU` | Main Menu (12 modes) | `SETUP` | — | — |
| **3** | `ON` | Power On / Reset mode | — | — | Physical hardware line |
| **4** | `UP` | D-Pad Up (History / Slot) | — | — | — |
| **5** | `DOWN` | D-Pad Down (History / Slot) | — | — | — |
| **6** | `LEFT` | D-Pad Left (Cursor) | Jump template start | — | — |
| **7** | `RIGHT` | D-Pad Right (Cursor) | Jump template end | — | — |
| **8** | `OPTN` | Mode Option Menu | `QR` Code generation | — | — |
| **9** | `CALC` | Variable prompt evaluation | `SOLVE` (Newton's solver) | `=` (Equality symbol) | — |
| **10** | `INTEGRAL` | Numerical $\int_{a}^{b} f(x) dx$ | $\frac{d}{dx}$ (Derivative) | $\Sigma$ (Summation) | $\Pi$ (Product) *(VERIFY ON EMULATOR)* |
| **11** | `X` | Variable $x$ | — | `:` (Multi-statement) | — |
| **12** | `FRAC` | Fraction template $\frac{■}{■}$ | Mixed fraction $■\frac{■}{■}$ | — | — |
| **13** | `SQRT` | Square Root $\sqrt{■}$ | Cube Root $\sqrt[3]{■}$ | — | — |
| **14** | `SQUARE` | Square $x^2$ | Cube $x^3$ | — | **Base-N (Blue):** `DEC` |
| **15** | `POWER` | Power $x^■$ | Root $\sqrt[■]{■}$ | — | **Base-N (Blue):** `HEX` |
| **16** | `LOG_AB` | Logarithm with base $\log_{■} ■$ | Standard $\log_{10}(■)$ | — | **Base-N (Blue):** `BIN` |
| **17** | `LN` | Natural log $\ln(■)$ | Exponential $e^■$ | — | **Base-N (Blue):** `OCT` |
| **18** | `NEG` | Negation prefix $(-)$ | — | Variable `A` | **Base-N (Blue):** Hex `A` |
| **19** | `DEG` | Sexagesimal $^{\circ\ '\ "}$ | `FACT` (Prime factors) | Variable `B` | **Base-N (Blue):** Hex `B` |
| **20** | `INV` | Reciprocal $x^{-1}$ | — | Variable `C` | **Base-N (Blue):** Hex `C` |
| **21** | `SIN` | $\sin(■)$ | $\sin^{-1}(■)$ | Variable `D` | **Base-N (Blue):** Hex `D` |
| **22** | `COS` | $\cos(■)$ | $\cos^{-1}(■)$ | Variable `E` | **Base-N (Blue):** Hex `E` |
| **23** | `TAN` | $\tan(■)$ | $\tan^{-1}(■)$ | Variable `F` | **Base-N (Blue):** Hex `F` |
| **24** | `STO` | Store to variable | `RECALL` (Variable viewer) | — | — |
| **25** | `ENG` | Eng notation exponent shift | $\leftarrow$ (Eng shift left) | — | **Complex (Purple):** $i$ |
| **26** | `LPAREN` | Open parenthesis `(` | — | — | — |
| **27** | `RPAREN` | Close parenthesis `)` | Separator `,` | Variable `x` | — |
| **28** | `SD` | $S \Leftrightarrow D$ exact/decimal toggle | $a\frac{b}{c} \Leftrightarrow \frac{d}{c}$ | Variable `y` | — |
| **29** | `M_PLUS` | Add to memory $M+$ | Subtract memory $M-$ | Memory variable $M$ | — |
| **30** | `7` | Digit `7` | `CONST` (Constants menu) | — | — |
| **31** | `8` | Digit `8` | `CONV` (Conversions menu) | — | — |
| **32** | `9` | Digit `9` | `RESET` menu | — | — |
| **33** | `DEL` | Delete character before cursor | `INS` (Insert/Overwrite) | `UNDO` (Undo last input) | — |
| **34** | `AC` | All Clear | `OFF` (Power down) | — | — |
| **35** | `4` | Digit `4` | `MATRIX` quick menu | — | — |
| **36** | `5` | Digit `5` | `VECTOR` quick menu | — | — |
| **37** | `6` | Digit `6` | — | — | *(VERIFY ON EMULATOR if Shift 6 has sub-function)* |
| **38** | `MUL` | Multiplication $\times$ | $nPr$ (Permutation) | — | — |
| **39** | `DIV` | Division $\div$ | $nCr$ (Combination) | — | — |
| **40** | `1` | Digit `1` | `STAT` quick menu | — | — |
| **41** | `2` | Digit `2` | `CMPLX` quick menu | — | — |
| **42** | `3` | Digit `3` | `BASE` quick menu | — | — |
| **43** | `ADD` | Addition $+$ | `Pol(` (Rect to Polar) | — | — |
| **44** | `SUB` | Subtraction $-$ | `Rec(` (Polar to Rect) | `Int(` (Integer part) | *(VERIFY ON EMULATOR: Int vs Intg)* |
| **45** | `0` | Digit `0` | `Rnd` (Round to display) | — | — |
| **46** | `DOT` | Decimal point `.` | `Ran#` (Random float) | `RanInt#` (Random int) | — |
| **47** | `EXP` | Power of ten $\times 10^{\blacksquare}$ | $\pi$ | Euler's number $e$ | — |
| **48** | `ANS` | Answer memory `Ans` | `%` (Percentage) | `PreAns` (Previous Ans) | — |
| **49** | `EXE` | Execute / Equals `=` | $\approx$ (Evaluate to decimal) | — | Bottom right primary |

---

## 3. Mode-Specific Key Re-mappings

### Mode 2: Complex
- `ENG`: Primary inputs imaginary unit `i` without pressing ALPHA.
- `SHIFT ENG`: Inputs polar angle symbol `∠`.
- Unsupported functions (e.g. `nPr`, `nCr`, `GCD`, `LCM`, `Pol`, `Rec`) generate `Math ERROR` or are disabled.

### Mode 3: Base-N
- `SQUARE`: Switches active display base to `DEC`.
- `POWER`: Switches active display base to `HEX`.
- `LOG_AB`: Switches active display base to `BIN`.
- `LN`: Switches active display base to `OCT`.
- Keys `NEG`, `DEG`, `INV`, `SIN`, `COS`, `TAN`: Directly input hexadecimal digits `A`, `B`, `C`, `D`, `E`, `F` respectively without pressing `ALPHA`.
- In Base-N, decimal point `.`, fractions, powers, and scientific functions are invalid; pressing them generates `Syntax ERROR`.

### Mode 8: Spreadsheet
- `ALPHA CALC (=)`: Enters formula entry mode in cell edit box.
- `OPTN 1`: Absolute reference symbol `$`.
- `OPTN 2`: `Grab` command (arrow navigation to select referenced cell).
- `OPTN 3`: `Edit Cell`.
- `OPTN 4`: `Free Space` (display remaining memory capacity).
- `OPTN ▼`: Submenu containing `Cut & Paste`, `Copy & Paste`, `Delete All`, `Recalculate`, and range functions (`Sum`, `Mean`, `Min`, `Max`).

### Mode 4 & 5: Matrix & Vector
- Matrix/Vector calculation screen:
  - `OPTN 1`: Define Matrix / Vector.
  - `OPTN 2`: Edit Matrix / Vector.
  - `OPTN 3..6`: Select `MatA`..`MatD` or `VctA`..`VctD`.
  - `OPTN ▼ 1`: `MatAns` / `VctAns`.
  - `OPTN ▼ 2`: `Determinant` (Matrix) / `Dot Product` (Vector).
  - `OPTN ▼ 3`: `Transposition` (Matrix) / `Angle` (Vector).
  - `OPTN ▼ 4`: `Identity` (Matrix) / `Unit Vector` (Vector).

---

## 4. Cross-Check with `assets/data/key_layout.json`

Cross-checking our spec against `assets/data/key_layout.json` identified the following discrepancies:
1. **Key 33 (`DEL`)**: `key_layout.json` omits `alpha: "UNDO"`. The official guide (page 9) explicitly defines `ALPHA DEL` as `UNDO`.
2. **Key 43 & 44 (`ADD` / `SUB`)**:
   - `key_layout.json` defines Key 43 as `shift: "Pol", alpha: "Rec"`, and Key 44 as `shift: "", alpha: "Int"`.
   - On the authentic Casio 991EX chassis, `Pol(` is yellow SHIFT on `+`, and `Rec(` is yellow SHIFT on `-`.
3. **Key 39 (`DIV`)**: `key_layout.json` lists `alpha: "Pol"` on Key 39. This is incorrect (`÷` has yellow `nCr`).
4. **Key 28 (`SD`)**: `key_layout.json` defines `shift: ""`. The official manual specifies `SHIFT SD` toggles improper vs mixed fractions ($a\frac{b}{c} \Leftrightarrow \frac{d}{c}$).
5. **Key 10 (`INTEGRAL`)**: `key_layout.json` lists `alpha: "Σ"`. On fx-991EX, `Σ` is accessed via `SHIFT x` or `SHIFT INTEGRAL` depending on model variant. *(VERIFY ON EMULATOR)*.

---

## 5. Items to Verify on Emulator ("VERIFY ON EMULATOR")

- [ ] **V-KEY-01**: In Calculate mode, does `ALPHA DEL` perform Undo in both MathI and LineI modes, or MathI only?
- [ ] **V-KEY-02**: Does `SHIFT (-)` or any key trigger `GCD` / `LCM` directly, or are they only in OPTN menus?
- [ ] **V-KEY-03**: Verify the exact yellow/red print on `+`, `-`, `×`, `÷` on the 991EX emulator faceplate.
- [ ] **V-KEY-04**: Verify if `SHIFT 6` has any alternate function assigned in any mode.
