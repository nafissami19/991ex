# Architecture — fx-991EX ClassWiz re-creation

Plain ES modules, no build step, no dependencies. Everything under `js/core/` and `js/lcd/` (except `canvas_lcd.js`) runs in Node with no DOM, so tests drive the calculator with key presses and read its screen.

## 1. Key press → screen

```
browser: js/keypad.js (faceplate hit boxes, PC keyboard, hold-to-repeat)
            │ key name from assets/data/key_layout.json ("SIN", "7", "EXE", …)
            ▼
js/core/Calculator.js  press(name) → resolveKey() (keys.js: aliases like '=', 'sin', 'π')
            │ SHIFT / ALPHA latch → ev = { key, shift, alpha }
            │ global keys: ON, SHIFT AC (OFF), MENU, SHIFT MENU (SETUP), SHIFT 9 (RESET), SHIFT OPTN (QR)
            ▼
top view .onKey(ev)          overlay stack (menus, prompts) on top of the current mode's app
            ▼
getScreen() → view.render(Screen) → { indicators, lines, pixels(192×63), contrast, poweredOn }
            ▼
browser: js/lcd/canvas_lcd.js draws pixels + status-bar icons (assets/images/status_bar_1x.png, local only)
```

## 2. Folders

| Path | What it does |
|---|---|
| `js/core/Calculator.js` | Owns all state: `setup`, `memory`, `mode`, per-mode apps, overlay `views`, power. `exportState()/importState()` for localStorage. |
| `js/core/keys.js` | Physical key names, test aliases, variable keys (STO/RECALL/ALPHA). |
| `js/core/setup.js` | SETUP defaults (guide's ◆ values) and `formatOptions(setup)`. |
| `js/core/memory.js` | Ans, A–F, M, x, y (ExactValue), `modeData`; (de)serialisation. No PreAns on the fx-991EX. |
| `js/core/input/tokens.js` | Every token (id, display text, bytes, parser kind) and template (slots). `registerToken()` for data-driven tokens (CONST, CONV, mode commands). |
| `js/core/input/Editor.js` | Input buffer: tree of tokens/templates + cursor path, 99-byte limit, ■ cursor at ≤10 bytes, INS, UNDO, LineI overwrite. |
| `js/core/input/keyInput.js` | Key (+SHIFT/ALPHA) → token/template for expression input; modes pass `overrides`. |
| `js/core/parse/parser.js` | Editor tree → AST, Casio priority table (13 levels), omitted multiplication, implicit `)`, multi-statements, Stack ERROR limits, error locations. |
| `js/core/eval/evaluate.js` | `Evaluator`: AST → ExactValue (rational / surd / π / decimal). Subclass or use ctx hooks (`resolveValue`, `postfix`, `call`) for mode-specific types. `PairResult` for Pol/Rec. |
| `js/core/eval/calculus.js` | ∫ (Gauss–Kronrod 7/15, adaptive, Time Out), d/dx (central difference + Richardson), Σ (exact). |
| `js/core/number/` | `Decimal15` (15-digit BCD-style decimal), `functions.js` (all real functions, guard digits). |
| `js/core/exact/` | Rational, SurdForm, PiForm, DMSForm, ExactValue. |
| `js/core/format/` | `formatNumber` (Norm/Fix/Sci/ENG/eng symbols), `display.js` (value → display tree + text), `ResultView` (which form to show + S⇔D, a b/c⇔d/c, ENG, °'", FACT toggles). |
| `js/core/errors.js` | `CalcError` with the exact error-screen text and the cursor jump location. |
| `js/core/ui/Screen.js` | Headless screen: framebuffer + `lines`. `text()`, `row()`, `math()` (natural layout), `measure()`, `invert()`. |
| `js/core/ui/views.js` | `MenuView` (numbered items, 4 per page, ▲▼ pages, ◀ back, AC close), `ConfirmView`, `MessageView`, `DigitPromptView`. |
| `js/core/apps/CalcApp.js` | Calculate mode (and base class for expression modes): edit/result/disp/error phases, history, Ans continuation, STO/RECALL, M+/M−, OPTN, CONST, CONV, CALC, SOLVE. |
| `js/core/apps/calcSolve.js` | CALC variable list and SOLVE (Newton) screens. |
| `js/core/apps/systemViews.js` | MENU icon grid, SETUP pages, Contrast, RESET. |
| `js/core/apps/QRView.js` + `js/core/qr/qrcode.js` | Our own QR encoder (versions 1–40) and the SHIFT OPTN screen. |
| `js/core/data/constants.js`, `conversions.js` | CONST (47 constants, CODATA 2010) and CONV (40 commands, NIST SP 811). |
| `js/core/modes/registry.js` | The 12 modes; each mode is `js/core/modes/<name>/index.js` exporting `createApp(calc)`. |
| `js/core/modes/` | Mode implementations: `baseN`, `complex`, `distribution`, `equation`, `inequality`, `matrix`, `ratio`, `spreadsheet`, `statistics`, `table`, `vector`. Mode 1 (Calculate) is implemented in `js/core/apps/CalcApp.js`. |
| `js/lcd/raster.js` | Framebuffer, bitmap text. `js/lcd/fonts/large.js`, `small.js`, `icons.js` are our own designs. |
| `js/lcd/layout.js` | Natural textbook layout boxes (fractions, roots, powers, ∫, Σ, d/dx, log_a b, Abs) and cursor positions. |
| `js/lcd/canvas_lcd.js`, `js/app.js`, `js/keypad.js`, `js/popout.js` | Browser layer only. |
| `sw.js`, `manifest.webmanifest` | Offline PWA. |

## 3. Writing a mode app

```js
export function createApp(calc) { return new MyApp(calc); }
class MyApp {
  constructor(calc) { this.calc = calc; }       // calc.setup, calc.memory, calc.pushView(view), calc.closeAllOverlays()
  onKey(ev) { /* ev = { key, shift, alpha }; return true when handled */ }
  render(scr) { scr.row(0, 'text'); scr.lines = [...]; }   // set scr.lines for tests
  indicators(set) { set.add('Disp'); }                    // optional
}
```
Expression-based modes extend `CalcApp` and override `makeEvaluator()`, `inputActionFor(ev)`, `optnItems()`, `makeResultView()`.

### The 12 Mode Implementations (`js/core/modes/`)

Every mode implements or instantiates an application satisfying the Calculator mode interface (`onKey`, `render`, `indicators`), delegating evaluation, numeric representations, and formatting to the shared core:

1. **Calculate** (`apps/CalcApp.js` / Mode 1): Base calculation app `CalcApp` supporting MathI/LineI, 15-digit precision, calculus integrals, derivatives, sums, CONST, CONV, CALC, SOLVE.
2. **Complex** (`modes/complex` / Mode 2): Complex arithmetic (`ComplexValue`), polar $r\angle\theta$ and rectangular $a+bi$, Arg, Conjg, ReP, ImP.
3. **Base-N** (`modes/baseN` / Mode 3): 32-bit two's complement integer arithmetic (`BaseNValue`), DEC, HEX, BIN, OCT representations, bitwise logic operations.
4. **Matrix** (`modes/matrix` / Mode 4): Matrix variables `MatA`–`MatD` up to 4×4, `MatrixEvaluator`, operations +, −, ×, Det, Trn, Identity, inverse, powers, row echelon forms.
5. **Vector** (`modes/vector` / Mode 5): Vector variables `VctA`–`VctD` (2D and 3D), dot product, cross product, Abs, Angle, UnitVector.
6. **Statistics** (`modes/statistics` / Mode 6): 1-Variable summary and 7 regression models (Linear, Quadratic, Log, Exp e, Exp ab, Power, Inverse), frequency weighting, normal distribution functions ($P, Q, R, t$), and estimators.
7. **Distribution** (`modes/distribution` / Mode 7): Normal PD, Normal CD, Inverse Normal, Binomial PD/CD, Poisson PD/CD in Variable and List modes.
8. **Spreadsheet** (`modes/spreadsheet` / Mode 8): 45-row × 5-column grid ($A1$–$E45$), formulas with relative/absolute references, range functions (`Sum`, `Mean`, `Min`, `Max`), batch fills.
9. **Table** (`modes/table` / Mode 9): Number table generator for single $f(x)$ or dual $f(x), g(x)$ functions with range parameters and interactive cell editing.
10. **Equation/Func** (`modes/equation` / Mode 10): Simultaneous linear equations (2–4 unknowns) via Gauss-Jordan elimination, polynomial root solver (degrees 2–4), exact quadratic surds, complex roots, and parabola vertex screens.
11. **Inequality** (`modes/inequality` / Mode 11): Polynomial inequalities of degrees 2–4 ($>0, <0, \ge 0, \le 0$), interval extraction and formatting.
12. **Ratio** (`modes/ratio` / Mode 12): Proportions $A:B=X:D$ and $A:B=C:X$, exact fraction and decimal evaluation.

## 4. State and clearing

- `Memory` survives AC, mode change and power off; RESET Memory / Initialize All clear it.
- A mode change creates a fresh app (history, spreadsheet, statistics data cleared). Data that must survive mode changes (matrices, vectors, table functions) goes in `calc.memory.modeData`.
- Changing Input/Output clears history and input in every app.
- `exportState()` saves setup, memory, mode and (if the app implements `toJSON`) the app's state.

## 5. Tests

`npm test` runs `node --test "tests/**/*.js"`: unit tests per module, `tests/golden.test.js` (JSON key-press cases under `tests/golden/<mode>/`), fonts/PNG/QR tests. `scripts/render_screen.mjs "keys" out.png` renders the LCD for a key sequence.
