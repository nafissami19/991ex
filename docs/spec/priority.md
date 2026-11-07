# Specification: Calculation Priority Sequence

This document defines the exact order of operations implemented by the Casio fx-991EX ClassWiz parser and evaluator, based on pages 8–10 of the official User's Guide.

---

## 1. Official Calculation Priority Sequence Table

When an expression contains multiple operations, operations are evaluated from highest priority (Rank 1) to lowest priority (Rank 13). Operations of identical priority evaluate strictly from **left to right**.

| Rank | Category | Operations / Tokens |
| :---: | :--- | :--- |
| **1** | **Parenthetical Expressions** | Explicit parentheses `( ... )`, nested slots in templates |
| **2** | **Prefix Functions with Parentheses** | Functions with open bracket requiring argument to right: `sin(`, `cos(`, `tan(`, `sin⁻¹(`, `cos⁻¹(`, `tan⁻¹(`, `sinh(`, `cosh(`, `tanh(`, `sinh⁻¹(`, `cosh⁻¹(`, `tanh⁻¹(`, `log(`, `ln(`, $e^{\blacksquare}($, $10^{\blacksquare}($, $\sqrt{\phantom{x}}($, $\sqrt[3]{\phantom{x}}($, `Abs(`, `Rnd(`, `Int(`, `Intg(`, `Arg(`, `Conjg(`, `ReP(`, `ImP(`, `Not(`, `Neg(`, multi-argument commands `Pol(`, `Rec(`, `GCD(`, `LCM(`, `RanInt#(` |
| **3** | **Postfix Operators & Exponents** | Functions that apply immediately to the preceding value:<br>• Powers & Roots: $x^2$, $x^3$, $x^{-1}$, $x^{\blacksquare}$, $\sqrt[\blacksquare]{\phantom{x}}$<br>• Factorial: $x!$<br>• Sexagesimal unit: $^{\circ\ '\ "}$<br>• Angle qualifiers: $^{\circ}$, $^{r}$, $^{g}$<br>• Percentage: $\%$<br>• Normal dist variate: $\blacktriangleright t$<br>• Engineering suffixes: $m, \mu, n, p, f, k, M, G, T, P, E$ |
| **4** | **Fractions** | Fraction bar $\frac{a}{b}$ and mixed fraction $a\frac{b}{c}$ |
| **5** | **Prefix Sign & Base-N Qualifiers** | Unary minus sign `(-)`, Base-N base prefixes ($d, h, b, o$) |
| **6** | **Conversions & Regression Estimators** | Metric conversion operators (e.g. $cm \blacktriangleright in$), Statistics estimated values ($\hat{x}, \hat{y}, \hat{x}_1, \hat{x}_2$) |
| **7** | **Omitted Multiplication** | Multiplication with multiplication symbol left out:<br>• Before constants/variables: $2\pi$, $3A$, $2e$<br>• Before radical/function: $2\sqrt{3}$, $2\sin(30)$<br>• Before/after parentheses: $2(1+2)$, $(1+2)(3+4)$ |
| **8** | **Combinatorics & Polar Angle** | Permutations ($nPr$), Combinations ($nCr$), Complex polar coordinate angle operator ($\angle$) |
| **9** | **Vector Dot Product** | Vector dot product operator ($\bullet$) |
| **10** | **Explicit Multiplication & Division** | Explicit $\times$ and $\div$ |
| **11** | **Addition & Subtraction** | Binary $+$ and $-$ |
| **12** | **Logical AND** | Bitwise/logical `and` (Base-N mode) |
| **13** | **Logical OR, XOR, XNOR** | Bitwise/logical `or`, `xor`, `xnor` (Base-N mode) |

---

## 2. Key Parser Rules & Authentic Casio Nuances

### Rule A: Unary Minus vs Powers
Because postfix powers ($x^2$, Rank 3) outrank the unary prefix negative sign (`(-)`, Rank 5):
- `(-) 2 x² =` evaluates as $-(2^2) = -4$.
- Enclosing parentheses `( (-) 2 ) x² =` evaluates as $(-2)^2 = 4$.

### Rule B: Omitted Multiplication vs Explicit Multiplication / Division
Omitted multiplication (Rank 7) has a higher priority than explicit multiplication and division (Rank 10).
Consequently:
- `1 ÷ 2π =` is parsed as $1 \div (2 \times \pi) = \frac{1}{2\pi} \approx 0.1591549431$.
- `1 ÷ 2 × π =` is parsed as $(1 \div 2) \times \pi = \frac{\pi}{2} \approx 1.570796327$.

### Rule C: Automatic Parenthesization on Omitted Multiplication
The User's Guide explicitly states (page 8):
> If you execute a calculation that includes both division and multiplication operations in which a multiplication sign has been omitted, parentheses will be inserted automatically:
> - Immediately before an open parenthesis or after a closed parenthesis:
>   `6 ÷ 2(1 + 2)` $\rightarrow$ `6 ÷ (2(1 + 2))` $\rightarrow$ Result = **`1`** (NOT 9).
> - Immediately before a variable, constant, or radical:
>   `2 ÷ 2√2` $\rightarrow$ `2 ÷ (2√2)` $\rightarrow$ Result = $\frac{1}{\sqrt{2}} = \frac{\sqrt{2}}{2}$.

### Rule D: Implicit Parenthesis Closure
- Closing parentheses immediately before `EXE` or before a colon `:` can be omitted:
  `sin(30) + 10` can be input as `sin( 30 ) + 10` or at end of expression `sin( 30 =` $\rightarrow$ evaluates as `sin(30)`.
- However, inside expressions, omitting a closing parenthesis will cause following tokens to be incorporated into the argument:
  `sin( 30 + 15 =` evaluates as $\sin(45^\circ) \approx 0.7071067812$.

### Rule E: Power Associativity
- Consecutive powers $a^{b^c}$ evaluate in accordance with Casio template nesting:
  In MathI mode, exponents are nested slots and evaluate naturally top-down: $2^{3^2} = 2^{(3^2)} = 2^9 = 512$.
  In LineI mode, `2 ^ 3 ^ 2` behavior: *(VERIFY ON EMULATOR)*.

### Rule F: Multi-Statement Execution (`:`)
- Pressing `ALPHA X (:)` inserts a colon separator.
- Multi-statements evaluate left-to-right on consecutive presses of `EXE`.
- An intermediate result displays with the **Disp** ($\mathbf{\blacktriangleright\blacktriangleright}$ or $\mathbf{II}$) status indicator.
- Pressing `EXE` continues evaluation to the subsequent statement.

---

## 3. Items to Verify on Emulator ("VERIFY ON EMULATOR")

- [ ] **V-PRIO-01**: In LineI mode, does `6÷2(1+2)` produce `1` or `Syntax ERROR`?
- [ ] **V-PRIO-02**: Does `2^3^2` in LineI evaluate right-to-left ($2^9 = 512$) or left-to-right ($8^2 = 64$)?
- [ ] **V-PRIO-03**: What does `1 ÷ 2(3)` equal on the official emulator (`1/6` vs `1.5`)?
- [ ] **V-PRIO-04**: What is the precedence between $nPr$ / $nCr$ and explicit multiplication $\times$?
- [ ] **V-PRIO-05**: Does `(-) 2 ^ 2` equal `-4` or `4` in MathI vs LineI?
