# Specification: Variables, Memories & Retention Rules

This document specifies the behavior of all memory stores on the Casio fx-991EX ClassWiz, including variables, answer buffers, independent memory, array stores, and their retention policies across power and reset cycles, based on pages 12–15 of the official User's Guide.

---

## 1. Memory Catalog

### 1. Answer Memory (`Ans`)
- Automatically updated with the final numeric/exact result of any completed expression upon pressing `EXE`.
- In multi-statement calculations (`:`), `Ans` updates with each intermediate statement result.
- Recalled via key `Ans` (`Key 48`).
- Typing an arithmetic operator (`+`, `-`, `×`, `÷`, `x²`, etc.) immediately after an evaluation automatically inserts `Ans` at the beginning of the new expression.

### 2. Previous Answer Memory (`PreAns`)
- When a new calculation updates `Ans`, the prior contents of `Ans` are automatically shifted into `PreAns`.
- Recalled via `ALPHA ANS (PreAns)`.
- If an expression uses both `Ans` and `PreAns`, `PreAns` refers to the answer from two calculations ago.

### 3. Independent Memory (`M`)
- A dedicated accumulator variable.
- Operations:
  - `M+`: Adds the evaluated result of the current expression to `M`.
  - `SHIFT M+ (M-)`: Subtracts the evaluated result of the current expression from `M`.
  - `0 STO M`: Clears `M` to zero.
- **`M` Status Indicator**: Appears at the top of the LCD whenever $M \neq 0$. If $M = 0$, the indicator turns off.
- Can be used as a standard variable in expressions via `ALPHA M+ (M)`.

### 4. General Variables (`A, B, C, D, E, F, x, y`)
- 8 standard single-letter numeric variables: `A`, `B`, `C`, `D`, `E`, `F`, `x`, `y`.
- Assigned via `STO` followed by the variable key (e.g. `3 + 5 STO (-) (A)` stores `8` into `A`).
- The screen briefly displays an assignment confirmation:
  ```
  3+5
            8
  8→A
  ```
- Recalled in expressions via `ALPHA + [Variable Key]`.
- Specialized assignments:
  - `Pol(x, y)`: Stores radius $r$ in variable `x` and angle $\theta$ in variable `y`.
  - `Rec(r, θ)`: Stores coordinate $x$ in variable `x` and coordinate $y$ in variable `y`.
  - Table mode: Evaluation automatically modifies variable `x`.

### 5. Variable Viewer Screen (`SHIFT STO (RECALL)`)
- Pressing `SHIFT STO (RECALL)` displays a full-screen dashboard listing current values of all 9 variables:
  ```
  A=0             B=0
  C=0             D=0
  E=0             F=0
  M=0             x=0
  y=0
  ```
- Values on this screen are always rendered in `Norm 1` number format.
- Pressing a variable key while on this screen recalls its value to the calculation line. Pressing `AC` exits without recalling.

### 6. Mode-Specific Memories
- **Matrix Memories**: `MatA`, `MatB`, `MatC`, `MatD`, `MatAns` (up to 4×4 each).
- **Vector Memories**: `VctA`, `VctB`, `VctC`, `VctD`, `VctAns` (2 or 3 elements each).
- **Spreadsheet Memory**: 45 rows $\times$ 5 columns ($A1$ to $E45$, max 1,700 bytes).
- **Statistics Memory**: Tabular rows (up to 160 values).
- **Table Memory**: Formulas $f(x)$ and $g(x)$, and range parameters.
- **Calculation History Buffer**: Rolling memory of past input expressions and results navigable via `▲` and `▼`.

---

## 2. Retention & Clearing Matrix

| Memory Item | `AC` Key | Mode Change | `ON` Key | Power Off (`SHIFT AC` / APO) | `RESET 1` (Setup Data) | `RESET 2` (Memory) | `RESET 3` (Initialize All) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Ans** | Retained | Retained | Retained | Retained | Retained | **Cleared** (0) | **Cleared** (0) |
| **PreAns** | Retained | Retained | Retained | Retained | Retained | **Cleared** (0) | **Cleared** (0) |
| **Variables (A–F, x, y)** | Retained | Retained | Retained | Retained | Retained | **Cleared** (0) | **Cleared** (0) |
| **Independent Memory M** | Retained | Retained | Retained | Retained | Retained | **Cleared** (0) | **Cleared** (0) |
| **Calculation History** | Retained | **Cleared** | **Cleared** | Retained *(VERIFY)* | **Cleared** | **Cleared** | **Cleared** |
| **Matrices (MatA–D, MatAns)**| Retained | Retained | Retained | Retained | Retained | **Cleared** | **Cleared** |
| **Vectors (VctA–D, VctAns)** | Retained | Retained | Retained | Retained | Retained | **Cleared** | **Cleared** |
| **Spreadsheet Grid** | Retained | **Cleared** | **Cleared** | **Cleared** | Retained | **Cleared** | **Cleared** |
| **Statistics Data Rows** | Retained | **Cleared** | Retained | Retained | Retained | **Cleared** | **Cleared** |
| **Table Functions f(x), g(x)**| Retained | Retained | Retained | Retained | Retained | **Cleared** | **Cleared** |
| **SETUP Settings** | Retained | Retained | Retained | Retained | **Reset Defaults** | Retained | **Reset Defaults** |
| **Contrast Setting** | Retained | Retained | Retained | Retained | Retained | Retained | **Retained** |

---

## 3. RESET Menus (`SHIFT 9 (RESET)`)

Pressing `SHIFT 9 (RESET)` opens the initialization menu:
```
1: Setup Data
2: Memory
3: Initialize All
```
- Selecting `1 (Setup Data)` prompts:
  `Reset Setup Data? [=] : Yes  [AC] : Cancel`
- Selecting `2 (Memory)` prompts:
  `Clear All Memory? [=] : Yes  [AC] : Cancel`
- Selecting `3 (Initialize All)` prompts:
  `Initialize All?   [=] : Yes  [AC] : Cancel`
- After pressing `=`, an authentic confirmation splash screen appears:
  `Reset All` / `Press [AC] Key`

---

## 4. Items to Verify on Emulator ("VERIFY ON EMULATOR")

- [ ] **V-MEM-01**: Does Calculation History persist across power-off (`SHIFT AC` then `ON`)?
- [ ] **V-MEM-02**: Exact text and layout of the assignment confirmation screen after `STO A`.
- [ ] **V-MEM-03**: In `SHIFT STO (RECALL)`, what is the grid layout and does it scroll if more variables exist?
- [ ] **V-MEM-04**: What happens to `PreAns` immediately following `Initialize All` or `Reset Memory`?
