# Golden Key-Press Testing Guide

This document explains how to record and verify golden test cases directly from the official Casio fx-570EX/991EX emulator (`C:\Users\sami6\OneDrive\Desktop\fx-570EX_991EX Emulator`).

---

## 1. What is a Golden Test?

A golden test simulates a sequence of exact physical key presses against the headless `Calculator` core and asserts that the resulting LCD display (indicators, text lines, and pixel buffers) matches the official emulator answer key.

Golden tests run in Node.js without any browser or DOM dependencies via:
```bash
npm test
```

---

## 2. File Format & Directory Structure

All golden test files are stored in `tests/golden/` as individual JSON files:

```json
{
  "name": "Descriptive test title",
  "setup": {
    "inputOutput": "MathI/MathO",
    "angle": "Deg"
  },
  "keys": ["1", "÷", "2", "+", "1", "÷", "3", "="],
  "expect": {
    "result": "5/6",
    "indicators": ["Math", "D"]
  }
}
```

### JSON Schema Reference
- **`name`** *(string, required)*: Clear title indicating the operation being tested.
- **`setup`** *(object, optional)*: Initial SETUP configuration before keys are pressed:
  - `inputOutput`: `"MathI/MathO"` | `"MathI/DecimalO"` | `"LineI/LineO"` | `"LineI/DecimalO"` (default: `"MathI/MathO"`).
  - `angle`: `"Deg"` | `"Rad"` | `"Gra"` (default: `"Deg"`).
  - `numberFormat`: `{"type": "NORM1"}` | `{"type": "FIX", "digits": 3}` | `{"type": "SCI", "digits": 5}`.
  - `fraction`: `"IMPROPER"` | `"MIXED"`.
- **`keys`** *(array of strings, required)*: Key sequence in chronological order. Accepts:
  - Standard key names from `assets/data/key_layout.json` (e.g. `"SHIFT"`, `"ALPHA"`, `"MENU"`, `"EXE"`, `"DEL"`, `"AC"`, `"FRAC"`, `"SQRT"`, `"SQUARE"`, `"POWER"`).
  - Primary faceplate symbols (e.g. `"+"`, `"-"`, `"×"`, `"÷"`, `"1"`, `"2"`, `"√"`, `"x²"`, `"="`, `"S<=>D"`, `"(-)"`, `"°"`).
- **`expect`** *(object, required)*:
  - `result`: Exact expected string in the result line (e.g. `"5/6"`, `"2√2"`, `"0.5"`).
  - `indicators`: Array of indicator strings that must be active (e.g. `["Math"]`, `["D"]`, `["S"]`, `["FIX"]`).
  - `error`: Expected error message if the calculation results in an error (e.g. `"Math ERROR"`, `"Syntax ERROR"`).
- **`expectedFail`** *(boolean, optional)*: Set to `true` when documenting a known behavior from the emulator whose feature prompt has not yet been implemented. In `node:test`, these are marked with `{ todo: pendingPrompt }` to track progress without breaking CI.
- **`pendingPrompt`** *(string, optional)*: The roadmap prompt scheduled to resolve this behavior (e.g. `"Prompt 8 (Exact results)"`).

---

## 3. How to Record a New Golden Case (Step-by-Step)

1. **Open the Official Emulator**:
   Launch `fx-570EX_991EX Emulator.exe` from `C:\Users\sami6\OneDrive\Desktop\fx-570EX_991EX Emulator`.
2. **Set Initial State**:
   Press `SHIFT 9 (RESET) 3 (Initialize All) = (Yes) AC` to ensure clean initial conditions.
   Configure any custom settings in `SHIFT MENU (SETUP)` if required by the test.
3. **Execute the Key Sequence**:
   Type the exact key sequence on the official emulator keypad.
4. **Observe the LCD**:
   - Record the active status icons at the top (e.g. `Math`, `D`, `FIX`).
   - Record the exact characters, exponents, fractions, and surds on the result line.
5. **Create the Golden JSON**:
   Save a new `.json` file in `tests/golden/` (e.g. `tests/golden/case_26_my_test.json`).
6. **Verify with `npm test`**:
   Run `npm test`. If the feature is already implemented, the test should pass (`✔`). If it represents future work, set `"expectedFail": true` and tag it with `"pendingPrompt"`.
