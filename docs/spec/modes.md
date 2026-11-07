# Specification: The 12 Calculation Modes

This document specifies the screens, editors, OPTN menus, key behaviors, and workflows for each of the 12 modes on the Casio fx-991EX ClassWiz, derived from the official User's Guide.

---

## 1. Mode 1: Calculate
- **Entry**: `MENU 1`.
- **Primary Screen**: Natural 2D textbook expression entry line at top, right-aligned result line at bottom.
- **OPTN Menu**:
  - Page 1: `1: Hyperbolic Func` (`sinh`, `cosh`, `tanh`, `sinh⁻¹`, `cosh⁻¹`, `tanh⁻¹`), `2: Angle Unit` ($^\circ, ^r, ^g$), `3: Engineer Symbol` (11 engineering symbols), `4: Number Calculation` (`Abs`, `Int`, `Intg`, `Rnd`).
  - Page 2: `1: Simplification`, `2: GCD / LCM`. *(VERIFY ON EMULATOR)*.
- **Key Behaviors**:
  - `EXE`: Evaluates expression, stores result into `Ans`, shifts old `Ans` to `PreAns`.
  - Continuous calculation: Pressing an operator (`+`, `-`, `×`, `÷`, `x²`, etc.) immediately after an answer inserts `Ans` automatically.
  - `S<=>D`: Toggles current result between exact (fractions, surds, $\pi$) and decimal forms.
  - `SHIFT FACT`: Prime factorizes integer result up to 10 digits.

---

## 2. Mode 2: Complex
- **Entry**: `MENU 2`. Status indicator: `i`.
- **Primary Screen**: Top expression entry with complex support ($i$, $\angle$).
- **Key Mappings**:
  - `ENG`: Inputs imaginary unit $i$.
  - `SHIFT ENG`: Inputs polar angle symbol $\angle$.
- **OPTN Menu**:
  - `1: Argument` (`Arg(`)
  - `2: Conjugate` (`Conjg(`)
  - `3: Real Part` (`ReP(`)
  - `4: Imaginary Part` (`ImP(`)
  - `▼ 1: ▸r∠θ` (Convert output to polar form)
  - `▼ 2: ▸a+bi` (Convert output to rectangular form)

---

## 3. Mode 3: Base-N
- **Entry**: `MENU 3`. Initial default: `DEC`.
- **Screen**: Top shows input expression. Bottom shows 32-bit value prefixed by base: `[Dec]`, `[Hex]`, `[Bin]`, `[Oct]`.
- **Base Switching Keys**:
  - `x²`: `DEC` (Decimal: $-2147483648$ to $2147483647$)
  - `x■`: `HEX` (Hexadecimal: `00000000` to `FFFFFFFF`)
  - `log■■`: `BIN` (Binary: 32 bits, split into two 16-bit blocks separated by space)
  - `ln`: `OCT` (Octal: 11 digits)
- **Hex Digit Keys**: `(-)` $\rightarrow A$, `° ' "` $\rightarrow B$, `x⁻¹` $\rightarrow C$, `sin` $\rightarrow D$, `cos` $\rightarrow E$, `tan` $\rightarrow F$.
- **OPTN Menu**:
  - Page 1: `1: and`, `2: or`, `3: xor`, `4: xnor`
  - Page 2: `1: Not`, `2: Neg`
  - Page 3: Base override prefixes `1: d`, `2: h`, `3: b`, `4: o`

---

## 4. Mode 4: Matrix
- **Entry**: `MENU 4`.
- **Initial Screen**: Matrix definition dialog: `MatA` (1), `MatB` (2), `MatC` (3), `MatD` (4).
- **Dimension Screen**: Select rows (1–4), select columns (1–4).
- **Matrix Editor**: Matrix grid with row/column cursor and edit line at bottom.
- **OPTN Menu (Calculation Screen)**:
  - `1: Define Matrix`
  - `2: Edit Matrix`
  - `3: MatA`, `4: MatB`, `5: MatC`, `6: MatD`
  - `▼ 1: MatAns`
  - `▼ 2: Determinant` (`Det(`)
  - `▼ 3: Transposition` (`Trn(`)
  - `▼ 4: Identity` (`Identity(`)

---

## 5. Mode 5: Vector
- **Entry**: `MENU 5`.
- **Initial Screen**: Vector definition dialog: `VctA` (1), `VctB` (2), `VctC` (3), `VctD` (4).
- **Dimension Screen**: Select dimension: 2 or 3.
- **Vector Editor**: Horizontal bracketed vector grid with element cursor.
- **OPTN Menu (Calculation Screen)**:
  - `1: Define Vector`
  - `2: Edit Vector`
  - `3: VctA`, `4: VctB`, `5: VctC`, `6: VctD`
  - `▼ 1: VctAns`
  - `▼ 2: Dot Product` (`•`)
  - `▼ 3: Angle` (`Angle(`)
  - `▼ 4: Unit Vector` (`UnitVector(`)

---

## 6. Mode 6: Statistics
- **Entry**: `MENU 6`.
- **Type Selection Screen**:
  - `1: 1-Variable`
  - `2: y=a+bx` (Linear)
  - `3: y=a+bx+cx²` (Quadratic)
  - `4: y=a+b·ln(x)` (Logarithmic)
  - `▼ 1: y=a·e^(bx)` (e-exponential)
  - `▼ 2: y=a·b^x` (ab-exponential)
  - `▼ 3: y=a·x^b` (Power)
  - `▼ 4: y=a+b/x` (Inverse)
- **Editor Screen**: Tabular spreadsheet with columns $x$, $(y)$, and optionally $(Freq)$ (if Setup Statistics is On). Max rows: 160 (1 col), 80 (2 cols), 53 (3 cols).
- **OPTN Menu**:
  - From Editor: `1: Select Type`, `2: Editor` (Insert Row, Delete All), `3: 1-Var / 2-Var Calc`, `4: Regression Calc`.
  - From Stat Calc: `1: Select Type`, `2: Data` (return to editor), `3: Variable / Regression`.

---

## 7. Mode 7: Distribution
- **Entry**: `MENU 7`.
- **Distribution Type Screen**:
  - `1: Normal PD`
  - `2: Normal CD`
  - `3: Inverse Normal`
  - `4: Binomial PD`
  - `▼ 1: Binomial CD`
  - `▼ 2: Poisson PD`
  - `▼ 3: Poisson CD`
- **Input Method**: `1: List` (table of multiple $x$ values) or `2: Variable` (single parameters).
- **Result**: Displays calculated probability ($p$ or $P$) to 6 significant digits.

---

## 8. Mode 8: Spreadsheet
- **Entry**: `MENU 8`.
- **Grid Layout**: 45 rows $\times$ 5 columns ($A1$ to $E45$). Total capacity: 1,700 bytes.
- **Navigation**: Arrow keys move cell cursor.
- **Edit Bar**: Bottom line shows cell contents. Formulas begin with `=`.
- **OPTN Menu**:
  - Page 1: `1: $` (Absolute reference), `2: Grab` (cursor cell selector), `3: Edit Cell`, `4: Free Space`.
  - Page 2: `1: Cut & Paste`, `2: Copy & Paste`, `3: Delete All`, `4: Recalculate`.
  - Commands inside formulas: `Sum(`, `Mean(`, `Min(`, `Max(`.

---

## 9. Mode 9: Table
- **Entry**: `MENU 9`.
- **Input Screen**: Prompts for $f(x)=$. If Setup Table is set to $f(x), g(x)$, prompts for $g(x)=$.
- **Table Range Screen**:
  - `Start`: Default 1.
  - `End`: Default 5.
  - `Step`: Default 1.
- **Table Screen**: 3 columns ($x$, $f(x)$, $g(x)$). Max rows: 45 ($f(x)$ only) or 30 ($f(x), g(x)$).

---

## 10. Mode 10: Equation/Func
- **Entry**: `MENU 10` (or `MENU A`).
- **Equation Type Selection Screen**:
  - `1: Simul Equation` $\rightarrow$ Unknowns dialog: `2`, `3`, or `4`.
  - `2: Polynomial` $\rightarrow$ Degree dialog: `2`, `3`, or `4`.
- **Coefficient Editor**: Matrix of coefficient cells $(a, b, c, d)$.
- **Solution Screens**:
  - Pressing `EXE` advances through roots ($x_1=$, $x_2=$, etc.).
  - For quadratic equations: additionally displays vertex coordinates ($x$-coordinate and $y$-coordinate of local minimum/maximum).
  - Special screens: `No Solution`, `Infinite Solution`.

---

## 11. Mode 11: Inequality
- **Entry**: `MENU 11` (or `MENU B`).
- **Degree Selection**: Degree 2, 3, or 4.
- **Type Selection**: 4 inequality types:
  - `1: ax² + bx + c > 0`
  - `2: ax² + bx + c < 0`
  - `3: ax² + bx + c ≥ 0`
  - `4: ax² + bx + c ≤ 0`
- **Result Screens**: Formatted solution intervals (e.g. `x < -3, 1 < x`, `All Real Numbers`, `No Solution`).

---

## 12. Mode 12: Ratio
- **Entry**: `MENU 12` (or `MENU C`).
- **Ratio Type Selection Screen**:
  - `1: A : B = X : D`
  - `2: A : B = C : X`
- **Input Screen**: Prompts for $A, B$, and $C$ (or $D$).
- **Result**: Displays calculated $X$ value. Zero coefficients produce `Math ERROR`.

---

## 13. Items to Verify on Emulator ("VERIFY ON EMULATOR")

- [ ] **V-MOD-01**: Exact layout and highlighted cursor style in Spreadsheet cell editor.
- [ ] **V-MOD-02**: Does exiting Statistics mode automatically delete all table rows, or only when changing calculation type?
- [ ] **V-MOD-03**: Does Equation mode display vertex coordinates for degree 3 or degree 4 polynomials?
- [ ] **V-MOD-04**: Exact wording and casing on the "No Solution" and "Infinite Solution" screens.
