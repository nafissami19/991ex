# Casio fx-991EX ClassWiz Web Re-creation

A personal-use, pixel-accurate, key-for-key web simulation of the Casio fx-991EX ClassWiz scientific calculator.

> [!NOTE]
> **Disclaimer:** This is a personal educational project. It is not affiliated with, endorsed by, or connected to Casio Computer Co., Ltd. in any way. No proprietary Casio ROMs, decompiled firmware, or copyrighted assets are distributed with this repository.

---

## Features (Target & In-Progress)

- **1:1 Calculation Parity**: Follows the Casio Calculation Priority Sequence, authentic 15-digit decimal BCD precision, and exact forms ($\sqrt{\phantom{x}}$, $\pi$, fractions, mixed fractions).
- **Headless Node-first Architecture**: Core mathematical logic, parsing, and screen state execute independently in Node.js for automated golden testing.
- **Natural Textbook Display**: 192×63 monochrome dot-matrix LCD simulation with status bar indicators and detached pop-out window support.
- **Modes**: 12 operational modes matching the fx-991EX ClassWiz hardware.

---

## Quick Start

### Prerequisites
- Node.js (v18+ recommended)

### Run the Dev Server
Start the zero-dependency local static server on port 5173:
```bash
npm start
```
Then open your browser at [http://localhost:5173](http://localhost:5173).

### Run the Test Suite
Execute the test suite using Node's native test runner:
```bash
npm test
```

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — System architecture, file breakdown, and key event pipeline.
- [`docs/STATUS.md`](docs/STATUS.md) — Progress checklist tracking each prompt from the build pack.
- [`docs/reference/`](docs/reference/) — Location for reference manuals (excluded from git).
