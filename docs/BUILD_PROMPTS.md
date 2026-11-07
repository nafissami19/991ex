# fx-991EX ClassWiz Re-creation — Full Build Prompt Pack

This file is a step-by-step pathway for building a calculator that **behaves, looks and responds like the Casio fx-991EX ClassWiz**, written from scratch (no Casio ROM).

It is written for an AI coding agent (Antigravity, ChatGPT/Codex, Claude Code, Cursor…). Paste **one prompt at a time**, in order. Do not move on until that prompt's **"Done when"** list is true.

> Personal-use project. The faceplate, fonts and key layout in `assets/` came from Casio's emulator. Keep the GitHub repo **private** and never upload those files or any Casio ROM.

---

## How to use this pack

1. At the start of **every new chat/session** with your AI tool, paste **Prompt 0 (Master Context)** first.
2. Then paste the next numbered prompt you haven't finished.
3. When the agent says it's done, check the **"Done when"** list yourself (open the app, press the keys).
4. Open the official emulator next to your app and press the same keys. If anything is different, use the **Fix prompt template** at the bottom.
5. After each prompt, tick it in `docs/STATUS.md` (Prompt 1 creates it) and commit.

**The secret to "exact":** the official emulator is your answer key. Every behaviour is decided by "what does the official emulator show for these exact key presses?" — not by what the AI thinks is mathematically nice.

---

## Part 1 — How the real fx-991EX works (background the agent needs)

**Hardware**
- CPU: LAPIS (OKI) nX-U8/100, 8-bit/16-bit. The real firmware does all maths in **decimal (BCD)**, not binary floating point. That's why it never shows `0.30000000000000004`.
- Screen: **192 × 63 dot-matrix LCD** plus a separate **status-bar row of fixed icons** above it (S, A, M, STO, RCL, STAT, CMPLX, MAT, VCT, D/R/G, FIX, SCI, Math, ▲, ▼, Disp, etc.).
- Keypad: about 50 keys in a matrix (KI/KO rows/columns). Every key has up to 3 meanings: normal, **SHIFT** (yellow label), **ALPHA** (red label).
- Power: solar + battery, ON key, SHIFT+AC = OFF, auto power-off after a period of no use.

**Numbers**
- Internal: **15 significant digits** in decimal, exponent range about 10⁻⁹⁹ to 10⁹⁹.
- Display: **10 digits** of mantissa, 2-digit exponent. Internal value rounded for display only.
- Overflow beyond the range → **Math ERROR**.

**Display modes (SETUP → Input/Output)**
- **MathI/MathO**: natural textbook input (real fractions, roots, powers) and exact output (fractions, √ forms, π forms).
- **MathI/DecimalO**: natural input, decimal output.
- **LineI/LineO** and **LineI/DecimalO**: one-line input like an old calculator.

**Exact results**
- Rational results show as fractions (improper `d/c` or mixed `a b/c`, set in SETUP).
- Some irrational results show in **√ form** (e.g. `2√2`) or **π form** (e.g. `π/3`), but only inside strict ranges listed in the User's Guide. Outside them it falls back to decimal.
- **S⇔D** toggles exact ⇄ decimal. SHIFT S⇔D style conversions switch between mixed/improper fractions.

**Expression handling**
- The input is a list of **tokens** (each function, digit, operator is one token, taking 1–2 bytes). The input has a maximum size.
- The calculator uses a fixed **calculation priority table** (in the User's Guide). It includes rules for "multiplication with the sign left out" like `2π` and `2(3+4)`, and for `(−)2²` = −4.
- Closing brackets can be left out at the end of the expression.
- Errors (Math, Syntax, Stack, Argument, Dimension, Variable, Can't Solve, Range, Insufficient MEM, Time Out, Circular…) show an error screen. ◀/▶ jumps the cursor to where the error is.

**Modes (MENU)** — 1 Calculate, 2 Complex, 3 Base-N, 4 Matrix, 5 Vector, 6 Statistics, 7 Distribution, 8 Spreadsheet, 9 Table, A Equation/Func, B Inequality, C Ratio.

**Memory** — Ans, PreAns, variables A, B, C, D, E, F, x, y, M (M+ / M−), matrices MatA–MatD, vectors VctA–VctD, spreadsheet cells, stat data. RESET (SHIFT 9): Setup / Memory / Initialize All.

**Where the real truth is**
- *fx-570EX / fx-991EX User's Guide* PDF (free from Casio's support website). This is your **spec**.
- The official emulator in `C:\Users\sami6\OneDrive\Desktop\fx-570EX_991EX Emulator` (and its `EmulatorUsersGuide.pdf`). This is your **answer key**.

---

## Part 2 — The prompts

---

### Prompt 0 — Master Context (paste at the start of EVERY session)

```
You are working on my personal project: a web-based re-creation of the Casio fx-991EX ClassWiz scientific calculator.
Project folder: C:\Users\sami6\OneDrive\Desktop\Casio 991ex duplicate

GOAL: Behave, look and respond like the real fx-991EX, key press for key press: the same screens, the same results, the same rounding, the same error messages, the same menus. The official Casio emulator (C:\Users\sami6\OneDrive\Desktop\fx-570EX_991EX Emulator) is the answer key. The official fx-570EX/991EX User's Guide (saved in docs/reference/) is the written spec.

HARD RULES:
1. No Casio ROM, no decrypting or patching Casio files, no cracking activation. We write every line of logic ourselves.
2. Never commit assets/fonts, assets/images/faceplate*.png, or any Casio-derived file. The repo stays private.
3. Plain HTML + CSS + JavaScript ES modules. No framework. No build step needed to run it (a tiny static server is fine).
4. All maths uses our own decimal number type (15 significant digits), never raw JS floating point for results.
5. The calculator logic (engine, parser, modes, screen layout) must run in Node with NO browser, so tests can drive it with key presses. The browser layer only draws pixels and sends key presses.
6. Every feature gets tests. Run `npm test` before saying you're done, and paste the summary.
7. Don't rewrite working parts unless the prompt asks. Keep changes focused on the current prompt.
8. When the User's Guide and the official emulator disagree, the official emulator wins. When you are not sure what the real calculator does, STOP and ask me to check it on the official emulator. Do not guess.
9. Read docs/STATUS.md and docs/ARCHITECTURE.md first (when they exist). Update STATUS.md at the end of each prompt.

Existing structure (may change as we go):
- index.html, popout.html, css/calculator.css
- js/app.js (startup), js/keypad.js (key handling), js/popout.js
- js/engine/math_engine.js, js/engine/state.js, js/engine/modes/mode_*.js (one per mode)
- js/lcd/dot_matrix.js (LCD pixels), js/lcd/natural_display.js (textbook layout)
- assets/data/key_layout.json (every key: rectangle on faceplate, key code, normal/SHIFT/ALPHA meaning, PC keyboard shortcut)
- assets/data/lcd_config.json (screen position, 192x63 matrix, scale, colours)
- tests/

Before writing code for any prompt: give me a short plan (files you'll touch, approach, risks). Then do it. At the end: list what changed, test results, and anything you were unsure about.
```

---

### PHASE A — Foundation

---

### Prompt 1 — Audit the existing code and write the roadmap

```
Read the whole project without changing any code.

1. Run the existing tests (node tests/test_math_engine.js) and report the result.
2. Open index.html in a browser (start a simple static server) and try these: 1+2=, 1÷2+1÷3=, √8=, sin 30=, MENU, SHIFT MENU. Report what works and what doesn't.
3. Write docs/ARCHITECTURE.md: what each file does, how a key press flows from the faceplate to the screen, where state lives, how modes are switched.
4. Write docs/STATUS.md with a checklist of every prompt in docs/BUILD_PROMPTS.md (Prompt 1 to the last). Mark each as Not started / Partial / Done based on what already exists, with one line on why.
5. List the 10 biggest problems that stop this from behaving exactly like the real fx-991EX (for example: uses JS floating point, no byte-limited input buffer, no real error screens, etc.).

Done when: ARCHITECTURE.md and STATUS.md exist and are accurate, and no code has changed.
```

---

### Prompt 2 — Project setup: tests, server, git hygiene

```
Set up the project so it's easy to run and test.

1. Create package.json ("type": "module") with scripts:
   - "start": a zero-dependency static server (write a small scripts/serve.js using Node's http module, port 5173)
   - "test": node --test tests/
2. Convert tests/test_math_engine.js to node:test format (keep all 14 checks passing).
3. Create .gitignore that excludes: node_modules, assets/fonts/, assets/images/faceplate*.png, assets/images/status_bar_*.png, assets/images/indicators/, assets/images/*screenshot*.png, docs/reference/*.pdf, *.rom, *.bin, *.hex, .env.
4. Create docs/reference/README.md telling me to put the official User's Guide PDF there (it will not be committed).
5. Create .claude/launch.json (or the equivalent for this tool) so the dev server can be started by name.
6. Add a README.md (short: what it is, how to run, how to test, "personal project, not affiliated with Casio").

Done when: `npm start` serves the app at http://localhost:5173, `npm test` passes, and `git status` shows none of the Casio asset files.
```

---

### Prompt 3 — Write the spec from the User's Guide

```
I have put the official fx-570EX/fx-991EX User's Guide PDF in docs/reference/. Read it fully and write our own summary spec files in docs/spec/ (our own words and tables, not copied paragraphs):

- docs/spec/keys.md — every key: normal, SHIFT and ALPHA functions, in each mode where it changes. Cross-check with assets/data/key_layout.json and list any differences.
- docs/spec/setup.md — every SETUP menu page, every item, every option, the default, and what each one changes.
- docs/spec/priority.md — the full Calculation Priority Sequence table, including omitted multiplication, (−), fractions, prefix functions, postfix functions (x², x⁻¹, !, %, °'"), nPr/nCr, ∠, ×÷, +−, logic operators for Base-N.
- docs/spec/ranges.md — calculation range, number of digits, input byte limit, stack limits, the √-form and π-form display ranges, the input range and accuracy for every function (sin, ln, x!, nPr, Pol, Rec, ∫, d/dx, Σ, etc.).
- docs/spec/errors.md — every error message, what causes it, and what the screen shows.
- docs/spec/modes.md — for each of the 12 modes: entry screens, sub-menus, input screens, result screens, OPTN menu contents, key behaviour.
- docs/spec/constants.md — the scientific constants list (number, symbol, name, value as stated in the guide) and the unit conversion list (number, from→to, formula).
- docs/spec/memory.md — every variable and memory, what clears it (AC, mode change, RESET, power off), and what survives.

Mark anything the guide is unclear about with "VERIFY ON EMULATOR".

Done when: all 8 files exist and cover every section of the guide. Show me the list of "VERIFY ON EMULATOR" items so I can check them.
```

---

### Prompt 4 — Headless key-press test harness (the "golden test" system)

```
Build a test system that drives the calculator with key presses and checks what the screen shows. This is how we prove it matches the real one.

1. Create js/core/Calculator.js: one class that owns all state (setup, memory, current mode, screen). It must run in Node with no DOM. API:
   - press(keyName)  e.g. press('SHIFT'), press('7'), press('EXE')  — names from key_layout.json
   - pressSequence('1 + 2 =') or an array of key names
   - getScreen() → { indicators: [...], lines: [...text lines as shown...], pixels: Uint8Array(192*63) }
   - reset()
2. Rewire js/app.js and js/keypad.js so the browser just calls Calculator.press() and draws getScreen().pixels.
3. Create tests/golden/ with JSON files in this format:
   { "name": "...", "setup": {"inputOutput":"MathI/MathO","angle":"Deg"}, "keys": ["1","÷","2","+","1","÷","3","="], "expect": {"result": "5/6", "indicators": ["Math"]} }
   and tests/golden.test.js that runs every file.
4. Add a text form of the screen (getScreen().lines) so tests can compare text before we have pixel fonts.
5. Add docs/GOLDEN_TESTS.md explaining how I record a new case: press keys on the official emulator, write what it shows into a JSON file.

Seed it with the first golden cases from Part 3 of BUILD_PROMPTS.md (mark the ones that fail as "expected-fail" for now, don't delete them).

Done when: npm test runs the golden tests, and the browser app still works through the new Calculator class.
```

---

### PHASE B — The number engine (this decides whether results are "exact")

---

### Prompt 5 — 15-digit decimal number type

```
Create js/core/number/Decimal15.js, our own decimal floating-point type that works like the real calculator's BCD arithmetic.

Representation: sign, BigInt mantissa, integer exponent (base 10). Keep 15 significant digits after every operation, with the rounding rule from docs/spec/ranges.md (round half up on the 16th digit unless the spec says otherwise). Exponent range per spec; anything outside → throw CalcError('Math ERROR'). Underflow below the smallest value → 0 (check the spec).

Needed: fromString, fromInt, add, sub, mul, div, neg, abs, cmp, isZero, isInteger, floor, trunc, frac, toFixed digits, toString (full 15 digits), digit access, and conversion to/from our existing Rational.

Rules:
- No JS Number anywhere in the arithmetic.
- 0.1 + 0.2 must equal exactly 0.3.
- 1 ÷ 3 × 3 must equal 1 after display rounding (check the internal value too, and record what it is).
- Division by zero → Math ERROR.

Write at least 60 unit tests, including edge cases at 15 digits and at the exponent limits.

Done when: all tests pass and the old math_engine uses Decimal15 for basic arithmetic.
```

---

### Prompt 6 — Scientific functions to full 15-digit accuracy

```
Implement every real function in js/core/number/functions.js using Decimal15. Compute inside with extra guard digits (for example 25–30 digits using BigInt) and round to 15 at the end so the last displayed digit is right.

Functions: sin cos tan asin acos atan (Deg/Rad/Gra), sinh cosh tanh asinh acosh atanh, log (base 10), ln, log_a(b), e^x, 10^x, x^y, x√y, √, ∛, x², x³, x⁻¹, x!, nPr, nCr, Abs, Int, Intg, Rnd (uses current display format), %, Pol(x,y), Rec(r,θ), degree-minute-second conversion, GCD, LCM, ÷R (quotient and remainder), Ran#, RanInt#(a,b).

For each one, use the input ranges and error rules from docs/spec/ranges.md:
- Out of range → Math ERROR.
- sin/cos/tan with huge angles: follow the guide's input limit.
- tan(90°) → Math ERROR.
- x! only for integers 0 ≤ x ≤ 69 (70! overflows → Math ERROR).
- (−8)^(1/3) and x√ with negative bases: follow the guide exactly.
- Special exact values must be exact: sin 30° = 0.5 exactly, cos 60° = 0.5, tan 45° = 1, ln(e) = 1, log(1000) = 3.

Tests: at least 5 values per function, compared with the official emulator (I will give you values for any you're unsure about — list them).

Done when: all function tests pass and every function is reachable from the engine.
```

---

### Prompt 7 — Display formatting (Norm/Fix/Sci/Eng)

```
Create js/core/format/formatNumber.js that turns a Decimal15 into exactly the text and layout the calculator shows.

Cover:
- Rounding the 15-digit value to 10 displayed digits (the display is rounded, the stored value is not).
- Norm 1 and Norm 2: when to switch to ×10ⁿ form (see docs/spec/setup.md). Default Norm 1.
- Fix 0–9: fixed decimal places, still switches to ×10ⁿ when too big.
- Sci 0–9 (Sci 0 means 10 digits): always mantissa ×10ⁿ.
- ENG and SHIFT ENG (←ENG): move the exponent to a multiple of 3, left and right, as many times as pressed.
- Engineering Symbols setting (k, M, G, T, m, μ, n, p, f): display and input.
- Decimal mark (dot / comma) and digit separator (on / off) settings.
- Trailing zeros dropped in Norm, kept in Fix/Sci.
- Negative numbers, −0 shown as 0.
- The ×10ⁿ part is drawn as a smaller raised exponent (return a structured result, not just a string, so the screen can draw it).
- Rnd( rounds the stored value to the current display format.

Golden tests: add at least 30 cases (e.g. 1÷3 in Norm1, Fix 3, Sci 4; 12345678901; 0.001 in Norm 1 vs Norm 2; 123456 ENG ENG ←ENG).

Done when: the result line in Calculate mode uses this formatter and all formatting tests pass.
```

---

### Prompt 8 — Exact results: fractions, √ forms, π forms, S⇔D

```
Create js/core/exact/ — the exact-value system used in MathI/MathO.

1. ExactValue types: Rational (BigInt n/d), SurdForm (a√b/c and sums of two surds, as the guide allows), PiForm (aπ/b), plus a fallback Decimal15.
2. Every operation tries to keep exact form, and only drops to decimal when the result leaves the ranges in docs/spec/ranges.md (fraction digit limits, √ coefficient limits, π-form limits).
3. Simplify: 6/8 → 3/4, √8 → 2√2, √12/2 → √3, 1/√2 → √2/2 (rationalise the denominator like the real one does).
4. Trig special angles in Deg/Rad give exact results where the real calculator does (sin 60 → √3/2, cos(π/3) → 1/2).
5. S⇔D toggles the current result between exact and decimal. Pressing it again goes back.
6. Mixed vs improper fractions: follow the SETUP "Fraction Result" option, and the SHIFT key conversion (a b/c ⇔ d/c).
7. Degree-minute-second results (°'" key) and their display.
8. Decide when the answer is shown as a fraction vs decimal using the same rules the calculator uses (e.g. decimals typed in, like 0.5+1/3, follow the guide).

Golden tests: at least 40 cases, including ones where the real calculator gives a decimal instead of exact form.

Done when: Calculate mode shows exact answers like the real one and S⇔D works.
```

---

### PHASE C — Input, parsing, errors

---

### Prompt 9 — Token input buffer and key mapping

```
Rebuild the input system to work like the real calculator's input buffer.

1. js/core/input/tokens.js: a table of every token the calculator can put in an expression (digits, ., ×10ˣ, operators, every function, variables, constants, templates such as fraction, mixed fraction, √, x√, xʸ, log_a b, ∫, d/dx, Σ, Π, Abs, and so on). Each token has: id, display text/glyph, byte size, and whether it opens a bracket.
2. Templates (fraction, root, power, log_a b, ∫, d/dx, Σ) are tree nodes with slots. The buffer is a tree, and the cursor is a position inside it.
3. Input limit: enforce the byte limit from docs/spec/ranges.md. When close to full, the cursor changes shape like the real one (check the guide). Over the limit, input is refused.
4. Key mapping: build js/core/input/keymap.js from assets/data/key_layout.json. For each key: what it does normally, after SHIFT, after ALPHA, after STO, after RCL, and in each mode. SHIFT and ALPHA indicators turn on, and switch off after one key.
5. DEL deletes the token before the cursor. SHIFT DEL = INS if the guide lists it (check). AC clears the input. Deleting inside an empty template removes it the way the real one does.
6. Pressing a template key with the cursor after a number/bracket wraps it the way the real calculator does (e.g. typing 2 then x² gives 2², typing 1 2 then the fraction key: check what the real one does in MathI and record it).
7. LineI mode: the same tokens shown as a single line (e.g. 1┘2 for fractions), as the guide shows.

Golden tests: input-editing cases (insert in the middle, delete, templates, cursor moves, byte limit).

Done when: every key on the faceplate inserts the right token in Calculate mode, and editing tests pass.
```

---

### Prompt 10 — Parser with Casio's priority rules

```
Write js/core/parse/parser.js that turns the token tree into an expression tree, following docs/spec/priority.md exactly.

Must handle:
- The full priority table, including omitted multiplication (2π, 2A, 2(3+4), 2sin30, (1+2)(3+4)).
- (−) is a prefix with lower priority than x²: (−)2² = −4.
- Postfix operators: x², x³, x⁻¹, x!, %, °, r, g, °'".
- Closing brackets may be left off at the end (and in the middle where the guide allows).
- Functions that take several arguments separated by commas (Pol, Rec, RanInt#, log_a, GCD, LCM, ∫, d/dx, Σ).
- Multi-statements joined with ':'.
- Assignment for STO (→A).
- Syntax ERROR with the exact position for the cursor jump (◀/▶ after the error).

Check these against the official emulator and add as golden tests: 1÷2π, 2^3^2, −2², 2√3√3, 3!², 50%×200, sin 30², 1÷2(3), 2(3)², 6÷2(1+2).

Done when: the parser passes all priority tests and is used by Calculate mode.
```

---

### Prompt 11 — Evaluator, errors and error screens

```
Write js/core/eval/evaluate.js and js/core/errors.js.

1. Evaluate the expression tree with exact values when MathO is on, decimal otherwise.
2. Errors: Math ERROR, Syntax ERROR, Stack ERROR, Argument ERROR, Dimension ERROR, Variable ERROR, Can't Solve, Insufficient MEM, Range ERROR, Time Out, Circular ERROR — with the causes from docs/spec/errors.md.
3. Stack ERROR: copy the real calculator's number and command stack limits (from the guide) by checking the depth of the expression tree.
4. Error screen: the exact layout and text the official emulator shows. AC returns to an empty input, ◀ or ▶ returns to the input with the cursor at the error position.
5. Every result sets Ans (and shifts the old Ans to PreAns if this calculator has PreAns: check docs/spec/memory.md).

Golden tests: at least one case for every error type, plus the screens after AC and after ◀.

Done when: every error type can be produced from key presses and its screen matches the official emulator.
```

---

### PHASE D — The screen (pixel-perfect)

---

### Prompt 12 — LCD engine and fonts

```
Rebuild js/lcd/ into a pixel-accurate LCD.

1. Framebuffer: 192 × 63 pixels (1 = dark), plus a separate status bar with fixed indicator icons. Draw it to a canvas, scaled up without blur (image-rendering: pixelated), with the colours from lcd_config.json.
2. Fonts: make our own bitmap fonts as data files (js/lcd/fonts/large.js and small.js). Each glyph = width + rows of bits. Cover digits, letters, every math symbol, every function name, menu text and mode icons.
   To match the real ones, I will take screenshots of the official emulator screen at 1× zoom. Write scripts/trace_glyphs.py that reads a screenshot and a "what text is here" description and cuts out each glyph's pixels into the font file. Explain to me exactly which screenshots you need.
3. Text drawing functions: drawText(x, y, text, font), invert (for highlighted menu items), clear, scroll arrows.
4. Status bar: turn indicators on/off from the calculator state (SHIFT, ALPHA, M, STO, RCL, STAT, CMPLX, MAT, VCT, angle unit, FIX, SCI, Math, ▲, ▼, Disp, etc.).
5. Contrast setting changes the dark pixel colour.
6. Add a test helper that compares our pixels with a screenshot and outputs a diff image (tests/pixel/).

Done when: the start screen and "1+2=3" look pixel-identical to the official emulator (show me the diff image).
```

---

### Prompt 13 — Natural textbook display layout

```
Rewrite js/lcd/natural_display.js as a 2D layout engine for MathI mode.

1. Each token/template becomes a box with width, height and baseline. Fractions stack numerator over a bar over denominator; roots draw the √ sign sized to the content; powers raise and use the small font where the real one does; ∫, Σ, d/dx, log_a b draw like the real screen.
2. Empty slots show the small dashed box the real calculator shows.
3. Cursor: blinking vertical bar at the right height inside the current slot. Arrow keys move through slots in exactly the order the real one does (test ◀ ▶ through a fraction inside a root inside a power).
4. Horizontal scrolling when the input is wider than the screen, with the ◀/▶ arrows in the status bar.
5. Result line: right-aligned under the input, also drawn with this layout engine (fractions, √, π, ×10ⁿ).
6. LineI mode: one line of text with the line-mode symbols.
7. When the expression is too tall, follow what the real one does (check the guide's limit on nesting and height).

Golden pixel tests: at least 15 screens (simple fraction, nested fraction, √ of fraction, power of a power, ∫ template, long expression scrolled, result with ×10ⁿ).

Done when: the pixel diff tests pass for all 15 screens.
```

---

### PHASE E — Calculate mode, menus, memory

---

### Prompt 14 — Calculate mode: full screen behaviour

```
Make Calculate mode behave exactly like the real one.

1. Press = : show result. Pressing a digit after a result starts a new calculation. Pressing an operator after a result starts with "Ans" (check exactly which keys do this).
2. ◀/▶ after a result goes back to editing the input.
3. History (replay): ▲ / ▼ step through past calculations with input and result, as the real one shows. What clears history (AC? mode change? off?) per docs/spec/memory.md.
4. Multi-statements with ':' — each part shows in turn with the "Disp" indicator, = moves to the next.
5. Ans and PreAns in expressions.
6. When the result is too long, the result line scrolls the way the real one does.
7. The calculator remembers the last input after OFF/ON where the real one does (check).

Done when: 25 golden tests of normal daily use pass, including history and continuation.
```

---

### Prompt 15 — Variables and memory

```
Implement docs/spec/memory.md fully.

- STO then a variable key stores Ans or the result into A–F, x, y, M (shows the "→A" screen the real one shows).
- RCL screen: show it exactly like the official emulator (on the EX it shows the variable list: check).
- ALPHA + variable key inserts the variable into the expression.
- M+ / M− (and SHIFT M+ = M−) add the result to M, with the M indicator on when M ≠ 0.
- RESET menu (SHIFT 9): 1 Setup Data, 2 Memory, 3 Initialize All, with the confirmation screens.
- Save all state to localStorage so it survives page reload, the way the real calculator keeps memory when switched off.

Done when: golden tests for STO/RCL/M+/RESET pass.
```

---

### Prompt 16 — SETUP menu

```
Rebuild the SETUP menu (SHIFT MENU) exactly like the official emulator.

- Every page, every item, the same numbering, the same text, ▲/▼ to change page, the number keys to pick.
- Every option from docs/spec/setup.md (Input/Output, Angle Unit, Number Format with Fix/Sci digit choice and Norm 1/2, Engineer Symbol, Fraction Result, Complex, Statistics frequency, Spreadsheet, Equation/Func, Table, Decimal Mark, Digit Separator, Multiline Font, Contrast, Language, Auto Power Off, QR Code, and any others the guide lists).
- Highlighted current option, as the real one shows.
- Changing a setting takes effect immediately and changes the status bar.
- AC/SHIFT AC behaviour inside the menu.

Done when: you can step through every SETUP screen and each one is pixel-identical to the official emulator (I will check screenshots).
```

---

### Prompt 17 — OPTN, CONST, CONV, FACT, ENG

```
1. OPTN menu in Calculate mode: every page and item (hyperbolic functions, angle unit symbols, engineering symbols, numerical calculation and anything else the guide lists).
2. CONST (scientific constants): the full list from docs/spec/constants.md, grouped and paged like the real one, inserting the constant symbol into the expression. Values must match the official emulator exactly to 10 displayed digits (check each one).
3. CONV (unit conversions): the full list, inserting the conversion command, with the right priority.
4. FACT: prime factorisation of the last result, following the guide's limits (how big a number, how factors that are too big are shown).
5. ENG / ←ENG (done in Prompt 7: just check they work from the keys).

Done when: every OPTN/CONST/CONV screen and result matches the official emulator.
```

---

### Prompt 18 — CALC and SOLVE

```
1. CALC: enter an expression with variables, press CALC, the calculator asks for each variable value in turn with the real prompt screen ("A=" etc.), then shows the result. Pressing CALC again re-uses the values. Works with equations too ("y=…").
2. SOLVE (SHIFT CALC): solve an equation for a variable using Newton's method (with the same starting value rules as the guide). Show the result screen with the variable value and "L−R=" exactly as the real one. "Can't Solve" when it doesn't converge. Let the user change the starting value.
3. If the result screen differs for an expression without "=", follow the guide.

Done when: 15 golden tests for CALC and SOLVE pass, including Can't Solve.
```

---

### Prompt 19 — Integrals, derivatives, sums, products

```
1. ∫ (definite integral): use Gauss–Kronrod (the guide says which method; follow it) to 15 digits. Time Out when it doesn't finish, like the real one. Results must match the official emulator to all 10 displayed digits.
2. d/dx: numeric derivative at a point, with the same method and errors as the real one.
3. Σ (and Π if the 991EX has it: check the guide): integer start/end, limits from the guide.
4. Templates draw correctly (Prompt 13) and LineI forms work.
5. Run long calculations without freezing the browser (split into chunks or use a Web Worker), and show the busy state the real calculator shows.

Done when: 20 golden tests pass, including Time Out and errors.
```

---

### PHASE F — The other 11 modes (one prompt each)

For every mode prompt below, the agent must follow `docs/spec/modes.md` and match the official emulator **screen by screen**: entry menu, editors, results, OPTN menu, and what AC / MENU / mode change do.

---

### Prompt 20 — MENU screen (mode icons)

```
Rebuild the MENU screen: the 12 mode icons in the real grid layout, the selected one highlighted, arrow key movement (with wrap-around like the real one), number keys 1–9 and letter keys for A, B, C to jump straight to a mode, = to enter. Draw the icons as our own pixel data matched to the official emulator. Changing mode clears what the real one clears.

Done when: the MENU screen and moving around it look identical to the official emulator.
```

---

### Prompt 21 — Complex mode

```
Complex mode (MENU 2): i input, a+bi and r∠θ output (setting + OPTN conversion), Arg, Conjg, ReP, ImP, ▸r∠θ, ▸a+bi, the "i" and "∠" indicators, exact forms where the real one gives them, all four operations, powers with integer exponents (follow the guide), errors for unsupported functions. Use Decimal15 for both parts.

Done when: 25 golden tests pass.
```

---

### Prompt 22 — Base-N mode

```
Base-N mode (MENU 3): DEC/HEX/BIN/OCT keys, 32-bit two's complement, range per base, A–F input in HEX, logic operations (and, or, xor, xnor, Not, Neg) from OPTN, the base prefix shown on screen, binary results split across lines like the real one, Math ERROR on overflow, integer-only rules.

Done when: 25 golden tests pass.
```

---

### Prompt 23 — Matrix mode

```
Matrix mode (MENU 4): MatA–MatD up to 4×4, define dimension screens, matrix editor (cell cursor, scrolling, editing a cell), MatAns, operations: + − ×, scalar ×, determinant, transpose, inverse (x⁻¹), x², x³, identity, row echelon / reduced row echelon (if the guide lists them), Abs. Dimension ERROR rules. The result matrix screen and how to scroll it, exactly like the real one.

Done when: 25 golden tests pass.
```

---

### Prompt 24 — Vector mode

```
Vector mode (MENU 5): VctA–VctD with 2 or 3 elements, editor, VctAns, + − ×, dot product, cross product, Abs (length), angle between vectors, unit vector — whatever the guide lists. Dimension ERROR rules. Same screen layouts as the real one.

Done when: 20 golden tests pass.
```

---

### Prompt 25 — Statistics mode

```
Statistics mode (MENU 6):
1. Type menu: 1-Variable, y=a+bx, y=a+bx+cx², y=a+b·ln x, y=a·e^bx, y=a·b^x, y=a·x^b, y=a+b/x.
2. Stat editor: columns x, (y), (Freq when the setting is on), row limits from the guide, cell editing, insert/delete rows (OPTN), the row number display.
3. OPTN: 1-Variable calc, Regression calc, data, sum, var, min/max, regression coefficients, x̂, ŷ, and everything else listed.
4. Result screens with every value (n, x̄, Σx, Σx², σx, sx, min, Q1, Med, Q3, max, a, b, c, r…), using the real layout and scrolling.
5. Accuracy: all to 10 displayed digits like the official emulator.

Done when: 30 golden tests pass, at least 3 for each regression type.
```

---

### Prompt 26 — Distribution mode

```
Distribution mode (MENU 7): Normal PD, Normal CD, Inverse Normal, Binomial PD, Binomial CD, Poisson PD, Poisson CD. List vs Variable input, the parameter entry screens (x, σ, μ, N, p, λ, Lower, Upper, Area…), result screens, the list result table when using List. Accuracy to 10 digits, input limits and errors per the guide.

Done when: 25 golden tests pass.
```

---

### Prompt 27 — Spreadsheet mode

```
Spreadsheet mode (MENU 8): 5 columns × 45 rows (check the guide), cell cursor and scrolling, the edit line at the bottom, numbers and formulas (= with cell references, relative/absolute $ references), Fill Formula and Fill Value (OPTN), Min/Max/Mean/Sum over ranges, Auto Calc on/off setting and Recalculate, Circular ERROR, memory limit (Insufficient MEM). Screen layout identical to the real one.

Done when: 25 golden tests pass.
```

---

### Prompt 28 — Table mode

```
Table mode (MENU 9): f(x) only or f(x) and g(x) (SETUP), enter the functions, Start/End/Step screens, row limit per the guide (different for one vs two functions), the table screen with column headers, scrolling, editing an x value and recalculating, errors shown in cells the way the real one does.

Done when: 20 golden tests pass.
```

---

### Prompt 29 — Equation/Func mode

```
Equation/Func mode (MENU A):
1. Simultaneous equations with 2, 3, 4 unknowns: coefficient editor, solutions screen (x=, y=, z=, t=), "No Solution" and "Infinite Solution" screens.
2. Polynomials of degree 2, 3, 4: coefficient editor, real and complex roots (when Complex setting allows), exact forms for quadratics where the real one shows them, and for degree 2 the extra screens the 991EX shows (x and y of the vertex, check the guide).
3. Display order of roots and how to step through them (▼/▲ or =), exactly like the real one.

Done when: 30 golden tests pass.
```

---

### Prompt 30 — Inequality mode

```
Inequality mode (MENU B): degree 2, 3, 4; the four inequality types (>0, <0, ≥0, ≤0); coefficient editor; solution screens like "x<1, 2<x", "All Real Numbers", "No Solution", exact forms where the real one shows them.

Done when: 20 golden tests pass.
```

---

### Prompt 31 — Ratio mode

```
Ratio mode (MENU C): A:B=X:D and A:B=C:X, input screens, result screen, exact/decimal results, errors (e.g. zero values) per the guide.

Done when: 10 golden tests pass.
```

---

### PHASE G — The whole device

---

### Prompt 32 — Power, start-up, contrast, auto power off

```
- ON key turns on and shows the screen the real one shows after power on.
- SHIFT AC turns off (screen blank). Any key except ON does nothing while off.
- Auto power off after the time set in SETUP (or the guide's default), counting from the last key press.
- Contrast setting screen and its effect.
- What is kept and lost when turning off and on (docs/spec/memory.md).
- First start after "Initialize All" shows the same screens as a brand-new calculator.

Done when: golden tests for power and reset pass.
```

---

### Prompt 33 — QR code (optional)

```
SHIFT OPTN on the real one makes a QR code. Make our own version: draw a QR code (write our own small QR encoder, no network) that contains the current expression and result in a simple text format, shown on the LCD in the same place and size. This is optional and must not contact any Casio server.

Done when: the QR shows and a phone camera can read it.
```

---

### Prompt 34 — Faceplate, keyboard, touch, pop-out, offline

```
1. Faceplate: keys react to mouse and touch, with a pressed look, using the rectangles in key_layout.json. Hold-to-repeat for arrow keys and DEL, timing like the real one.
2. PC keyboard: the shortcuts in key_layout.json (and sensible extras: digits, + − * /, Enter = =, Backspace = DEL, Esc = AC, arrows).
3. Scale the whole calculator to fit any window size without blurring the LCD.
4. Pop-out window (popout.html) mirrors the same Calculator state.
5. Make it work offline as an installable web app (manifest + service worker), with its own app icon (not Casio's).
6. Optional key log panel that shows what keys were pressed (useful for golden tests).

Done when: it works with mouse, touch and keyboard, scales cleanly, and works with the network turned off.
```

---

### PHASE H — Matching the real one exactly

---

### Prompt 35 — Fidelity sweep, mode by mode

```
Do a full side-by-side comparison against the official emulator, one mode at a time.

For the mode I name: list every screen and every key in every screen (from docs/spec/modes.md and keys.md). Make a checklist in docs/fidelity/<mode>.md with a key sequence for each item. I will run each sequence on the official emulator and paste what I see (or a screenshot). Then fix every difference, add each one as a golden test, and mark it done.

Start with: Calculate. (Next sessions: SETUP, Complex, Base-N, Matrix, Vector, Statistics, Distribution, Spreadsheet, Table, Equation, Inequality, Ratio.)

Done when: every item in the mode's checklist matches and is a golden test.
```

---

### Prompt 36 — Accuracy stress test

```
Write scripts/stress.js that creates 2,000 random expressions (mixing all functions, nesting, exact and decimal) and writes them as key sequences to tests/stress/cases.json.

I will run a batch of these on the official emulator and fill in the results (start with 100). Then compare: list every case where our displayed result differs, group them by cause (rounding, function accuracy, exact form choice, priority, error type), fix the causes, and add them to the golden tests.

Done when: the first 100 match 100%, then repeat with the next batch.
```

---

### Prompt 37 — Performance and code health

```
1. Profile: any key press must update the screen in under 16 ms (except long calculations like ∫, which run in the background).
2. Remove dead code, the old math_engine parts we replaced, and duplicate logic between modes.
3. Make sure every mode uses the shared Calculator core, number type, formatter, input buffer and layout engine.
4. Update docs/ARCHITECTURE.md to match the final code.
5. All tests pass: unit, golden and pixel.

Done when: tests pass, there's no unused code, and ARCHITECTURE.md is current.
```

---

### Prompt 38 — Final check

```
Do a final review:
1. Go through docs/STATUS.md: every prompt marked Done with its golden tests.
2. List anything still different from the official emulator, with the key presses to see it.
3. Check the git history: no Casio fonts, faceplate, bitmaps, ROM or PDF were ever committed. If they were, tell me (don't rewrite history without asking).
4. Write docs/KNOWN_DIFFERENCES.md.

Done when: STATUS.md is all Done and KNOWN_DIFFERENCES.md is written.
```

---

## Fix prompt template (use this whenever something is different)

```
Mismatch with the official emulator.

Mode: <mode>
Setup: <e.g. MathI/MathO, Deg, Norm1>
Keys pressed: <exact key sequence, e.g. SHIFT  sin  0 . 5  =>
Official emulator shows: <exact text, or attach screenshot>
Our app shows: <exact text, or attach screenshot>

1. Add this as a failing golden test first.
2. Find the cause (say which file and why).
3. Fix it without breaking other golden tests.
4. Run npm test and show the summary.
```

## Session-start template (when coming back after a break)

```
(Paste Prompt 0 first.)

We are continuing. Read docs/STATUS.md and docs/ARCHITECTURE.md, run npm test, and tell me:
1. Which prompt we are on and what's left in it.
2. Which tests fail right now.
Then continue with Prompt <number>.
```

---

## Part 3 — First golden test cases (check each on the official emulator first)

Setup for all, unless stated: MathI/MathO, Deg, Norm 1, defaults. **These are what I expect. Confirm each one on the official emulator before trusting it, and correct the expected value if it differs.**

| # | Keys | Expected |
|---|------|----------|
| 1 | `1 ÷ 2 + 1 ÷ 3 =` (with the fraction key) | `5/6` |
| 2 | then `S⇔D` | `0.8333333333` |
| 3 | `√ 8 =` | `2√2` |
| 4 | `sin 30 =` | `1/2` |
| 5 | `sin 60 =` | `√3/2` |
| 6 | `π =` then `S⇔D` | `π` then `3.141592654` |
| 7 | `0.1 + 0.2 =` | `3/10` (S⇔D → `0.3`) |
| 8 | `(−) 2 x² =` | `−4` |
| 9 | `123456789 × 9 =` | `1111111101` |
| 10 | `12345678901 =` | `1.23456789×10¹⁰` |
| 11 | `0.001 =` Norm 1 / Norm 2 | `1×10⁻³` / `0.001` |
| 12 | `1 ÷ 3 × 3 =` | `1` |
| 13 | `69 x! =` | `1.711224524×10⁹⁸` |
| 14 | `70 x! =` | `Math ERROR` |
| 15 | `1 ÷ 0 =` | `Math ERROR` |
| 16 | `tan 90 =` | `Math ERROR` |
| 17 | `2016 = SHIFT FACT` | `2⁵×3²×7` |
| 18 | `log 1000 =` | `3` |
| 19 | `ln e =` (ALPHA e or e key) | `1` |
| 20 | `2 ^ 10 =` | `1024` |
| 21 | `1 ÷ 2π =` | check: Casio treats `2π` as one unit → `1/(2π)` |
| 22 | `6 ÷ 2(1+2) =` | check on emulator |
| 23 | `Pol(1,1) =` | `r=1.414213562, θ=45` |
| 24 | `10 nCr 3 =` | `120` |
| 25 | `10 nPr 3 =` | `720` |

---

## Part 4 — Progress checklist

- [x] 1 Audit & roadmap
- [x] 2 Project setup
- [x] 3 Spec from User's Guide
- [x] 4 Golden test harness
- [x] 5 Decimal15 number type
- [x] 6 Scientific functions
- [x] 7 Display formatting
- [x] 8 Exact results
- [x] 9 Input buffer & key mapping
- [x] 10 Parser & priority
- [x] 11 Evaluator & errors
- [x] 12 LCD engine & fonts
- [x] 13 Natural display layout
- [x] 14 Calculate mode
- [x] 15 Variables & memory
- [x] 16 SETUP menu
- [x] 17 OPTN / CONST / CONV / FACT
- [x] 18 CALC & SOLVE
- [x] 19 ∫ d/dx Σ Π
- [x] 20 MENU screen
- [x] 21 Complex
- [x] 22 Base-N
- [x] 23 Matrix
- [x] 24 Vector
- [x] 25 Statistics
- [x] 26 Distribution
- [x] 27 Spreadsheet
- [x] 28 Table
- [x] 29 Equation/Func
- [x] 30 Inequality
- [x] 31 Ratio
- [x] 32 Power & reset
- [x] 33 QR code (optional)
- [x] 34 Faceplate, keyboard, offline
- [x] 35 Fidelity sweep (per mode)
- [x] 36 Accuracy stress test
- [x] 37 Performance & cleanup
- [x] 38 Final check

**Order matters:** Phases A–C (prompts 1–11) are the foundation. If the number engine and parser are wrong, every mode will be wrong. Don't skip ahead to the modes.
