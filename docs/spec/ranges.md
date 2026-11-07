# Specification: Calculation Ranges, Limits & Domain Constraints

This document specifies internal precision, display ranges, input buffer limits, stack capacities, and input ranges for all mathematical functions on the Casio fx-991EX ClassWiz, based on pages 8 and 40–43 of the User's Guide.

---

## 1. Number Precision & Capacities

- **Internal Representation**: 15 decimal digits (BCD-equivalent fixed/floating decimal).
- **Exponent Range**: $10^{-99}$ to $10^{99}$.
- **Magnitude Domain**:
  $$\pm 1 \times 10^{-99} \le |x| \le \pm 9.999999999 \times 10^{99} \quad \text{or} \quad x = 0$$
- **Underflow**: Values with magnitude $|x| < 1 \times 10^{-99}$ underflow to $0$.
- **Overflow**: Values with magnitude $|x| \ge 1 \times 10^{100}$ trigger **`Math ERROR`**.
- **Display Resolution**: 10 mantissa digits with a 2-digit exponent.
- **Single Calculation Precision**: In general, $\pm 1$ at the 10th displayed digit. For exponential display, $\pm 1$ at the least significant digit.
- **Display Rounding**: The internal 15-digit value is rounded to 10 display digits (round half up at the 11th digit).

---

## 2. Input Buffer & Stack Limits

- **Input Buffer Capacity**: 99 bytes (or tokens).
- **Buffer Warning**: The cursor transforms into a solid black block ($\blacksquare$) when $\le 10$ bytes remain in the input buffer.
- **Buffer Overflow**: Further key input is rejected with an audible lock or ignored once the buffer capacity is reached.
- **Numeric Stack**: 10 levels of nested operands/parentheses. Exceeding triggers **`Stack ERROR`**.
- **Command Stack**: 24 levels of nested operations. Exceeding triggers **`Stack ERROR`**.
- **Matrix / Vector Stack**: Nested matrix/vector operations limit: *(VERIFY ON EMULATOR)*.

---

## 3. Exact Display Form Limits (MathI/MathO)

### $\pi$-Form Display Range
- An exact multiple of $\pi$ (e.g. $\frac{a}{b}\pi$) is displayed in $\pi$-form only if $|x| < 10^6$.
- If $|x| \ge 10^6$ or if internal calculation error breaks symbolic identification, the output falls back to decimal representation.

### $\sqrt{\phantom{x}}$-Form (Surd) Display Limits
- Surds are simplified and displayed in forms such as $a\sqrt{b}$, $\frac{a\sqrt{b}}{c}$, or $\sqrt{a} \pm \sqrt{b}$.
- Maximum integer under the radical: $\sqrt{b}$ where $b < 1000$ *(VERIFY ON EMULATOR for exact coefficient ceiling)*.
- If coefficients exceed allowable display width or calculation falls outside the algebraic pattern, the calculator displays a decimal approximation.

### Fraction Display Limits
- Total number of digits in the integer, numerator, and denominator combined (including fraction separators) must be **$\le 10$ digits**.
- If a fraction requires $> 10$ digits to display, it is displayed as a decimal.

---

## 4. Function Calculation Input Ranges & Errors

| Function | Angle Unit / Parameters | Allowable Input Range | Error on Violation |
| :--- | :--- | :--- | :--- |
| $\sin x, \cos x$ | Degree | $0 \le \|x\| < 9 \times 10^9$ | `Math ERROR` |
| | Radian | $0 \le \|x\| < 157079632.7$ | `Math ERROR` |
| | Gradian | $0 \le \|x\| < 1 \times 10^{10}$ | `Math ERROR` |
| $\tan x$ | Degree | Same as $\sin x$, except $\|x\| = (2n-1) \times 90^\circ$ | `Math ERROR` |
| | Radian | Same as $\sin x$, except $\|x\| = (2n-1) \times \frac{\pi}{2}$ | `Math ERROR` |
| | Gradian | Same as $\sin x$, except $\|x\| = (2n-1) \times 100$ | `Math ERROR` |
| $\sin^{-1} x, \cos^{-1} x$ | — | $0 \le \|x\| \le 1$ | `Math ERROR` |
| $\tan^{-1} x$ | — | $0 \le \|x\| \le 9.999999999 \times 10^{99}$ | — |
| $\sinh x, \cosh x$ | — | $0 \le \|x\| \le 230.2585092$ | `Math ERROR` |
| $\sinh^{-1} x$ | — | $0 \le \|x\| \le 4.999999999 \times 10^{99}$ | — |
| $\cosh^{-1} x$ | — | $1 \le x \le 4.999999999 \times 10^{99}$ | `Math ERROR` |
| $\tanh x$ | — | $0 \le \|x\| \le 9.999999999 \times 10^{99}$ | — |
| $\tanh^{-1} x$ | — | $0 \le \|x\| \le 9.999999999 \times 10^{-1}$ | `Math ERROR` |
| $\log x, \ln x$ | — | $0 < x \le 9.999999999 \times 10^{99}$ ($x \le 0 \rightarrow$ Error) | `Math ERROR` |
| $10^x$ | — | $-9.999999999 \times 10^{99} \le x \le 99.99999999$ | `Math ERROR` |
| $e^x$ | — | $-9.999999999 \times 10^{99} \le x \le 230.2585092$ | `Math ERROR` |
| $\sqrt{x}$ | — | $0 \le x < 1 \times 10^{100}$ ($x < 0 \rightarrow$ Error in Real mode) | `Math ERROR` |
| $x^2$ | — | $\|x\| < 1 \times 10^{50}$ | `Math ERROR` |
| $x^{-1}$ | — | $\|x\| < 1 \times 10^{100}, x \neq 0$ | `Math ERROR` |
| $\sqrt[3]{x}$ | — | $\|x\| < 1 \times 10^{100}$ | — |
| $x!$ | Integer | $0 \le x \le 69$ ($70! \approx 1.198 \times 10^{100} \rightarrow$ Error) | `Math ERROR` |
| $nPr$ | Integers | $0 \le n < 1 \times 10^{10}, 0 \le r \le n$, $1 \le \frac{n!}{(n-r)!} < 1 \times 10^{100}$ | `Math ERROR` |
| $nCr$ | Integers | $0 \le n < 1 \times 10^{10}, 0 \le r \le n$, $1 \le \frac{n!}{r!(n-r)!} < 1 \times 10^{100}$ | `Math ERROR` |
| $Pol(x, y)$ | — | $\|x\|, \|y\| \le 9.999999999 \times 10^{99}$, $\sqrt{x^2+y^2} \le 9.999999999 \times 10^{99}$ | `Math ERROR` |
| $Rec(r, \theta)$ | — | $0 \le r \le 9.999999999 \times 10^{99}$; $\theta$ subject to $\sin x$ angle range | `Math ERROR` |
| $^{\circ\ '\ "}$ | — | $\|a\|, b, c < 1 \times 10^{100}, 0 \le b, c$. Seconds error $\pm 1$ at 2nd dec. | `Math ERROR` |
| Dec $\leftrightarrow$ Sexagesimal | — | $0^\circ 0' 0'' \le \|x\| \le 9999999^\circ 59' 59''$ | — |
| $x^y$ | $x > 0$ | $-1 \times 10^{100} < y \log x < 100$ | `Math ERROR` |
| | $x = 0$ | $y > 0$ ($0^0 \rightarrow$ Error) | `Math ERROR` |
| | $x < 0$ | $y = n$ or $y = \frac{m}{2n+1}$ ($m, n \in \mathbb{Z}$), $-10^{100} < y \log \|x\| < 100$ | `Math ERROR` |
| $\sqrt[x]{y}$ | $y > 0$ | $x \neq 0, -1 \times 10^{100} < \frac{1}{x} \log y < 100$ | `Math ERROR` |
| | $y = 0$ | $x > 0$ | `Math ERROR` |
| | $y < 0$ | $x = 2n+1$ or $x = \frac{2n+1}{m}$ ($m \neq 0$), $-10^{100} < \frac{1}{x} \log \|y\| < 100$ | `Math ERROR` |
| $RanInt\#(a, b)$ | Integers | $a < b$, $\|a\|, \|b\| < 1 \times 10^{10}$, $b - a < 1 \times 10^{10}$ | `Math ERROR` |
| Numerical $\int$ | Gauss-Kronrod | Default tolerance $tol = 1 \times 10^{-5}$ ($1 \times 10^{-14} \le tol$). Radian required for trig. | `Time Out` / `Math ERROR` |
| Numerical $\frac{d}{dx}$ | Central diff | Default tolerance $tol = 1 \times 10^{-10}$. | `Math ERROR` |
| Summation $\Sigma$ | Integers | $-1 \times 10^{10} < a \le b < 1 \times 10^{10}$ | `Math ERROR` |

---

## 5. Items to Verify on Emulator ("VERIFY ON EMULATOR")

- [ ] **V-RNG-01**: Exact byte cost per template (Fraction, Square root, Power, Definite integral).
- [ ] **V-RNG-02**: What is the highest value of $b$ for which $\sqrt{b}$ simplifies to $a\sqrt{c}$?
- [ ] **V-RNG-03**: Verify the exact stack depth limit triggering `Stack ERROR` (e.g. 10 open parens).
- [ ] **V-RNG-04**: What happens when $RanInt\#(5, 5)$ is evaluated ($a = b$)?
