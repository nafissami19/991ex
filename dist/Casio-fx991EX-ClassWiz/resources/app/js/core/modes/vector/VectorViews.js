/**
 * Vector mode screens:
 *   - DimensionPromptView (select 2 or 3 dimensions)
 *   - VectorEditorView (interactive vector grid editor)
 *   - VectorOptnMenuView (ClassWiz authentic 2-page OPTN menu)
 */
import { MenuView, drawScrollBar } from '../../ui/views.js';
import { ROW_PITCH } from '../../ui/Screen.js';
import { VectorValue } from './VectorValue.js';
import { ExactValue } from '../../exact/ExactValue.js';
import { Rational } from '../../exact/Rational.js';
import { Decimal15 } from '../../number/Decimal15.js';
import { CalcError, ERRORS } from '../../errors.js';

export class DimensionPromptView {
  constructor(calc, app, varName) {
    this.calc = calc;
    this.app = app;
    this.varName = varName;
    this.isOverlay = true;
  }

  onKey(ev) {
    if (ev.shift || ev.alpha) return false;
    const k = ev.key;
    if (k === 'AC') {
      this.calc.closeAllOverlays();
      return true;
    }
    if (k === 'LEFT') {
      this.calc.closeView();
      return true;
    }
    if (k === '2' || k === '3') {
      const dim = Number(k);
      const vec = new VectorValue(Array(dim).fill(0).map(() => ExactValue.fromInt(0n)));
      this.app.setVector(this.varName, vec);
      this.calc.replaceView(new VectorEditorView(this.calc, this.app, this.varName, dim, vec));
      return true;
    }
    return true;
  }

  render(scr) {
    scr.row(0, this.varName);
    scr.row(1, 'Dimension?');
    scr.row(2, '2~3');
    scr.lines = [this.varName, 'Dimension?', '2~3'];
  }
}

export class VectorEditorView {
  constructor(calc, app, varName, dim, vector) {
    this.calc = calc;
    this.app = app;
    this.varName = varName;
    this.dim = dim;
    this.vector = vector ? vector.clone() : new VectorValue(Array(dim).fill(0).map(() => ExactValue.fromInt(0n)));
    this.curIdx = 0;
    this.editBuf = '';
    this.stoPending = false;
    this.isOverlay = true;
  }

  evaluateEditBuf(buf) {
    const trimmed = buf.trim();
    if (!trimmed) return ExactValue.fromInt(0n);
    if (/^-?\d+$/.test(trimmed)) {
      return ExactValue.fromInt(BigInt(trimmed));
    }
    if (/^-?\d+\.\d*$/.test(trimmed) || /^-?\.\d+$/.test(trimmed)) {
      return ExactValue.fromDecimal(Decimal15.fromString(trimmed));
    }
    const fracMatch = trimmed.match(/^(-?\d+)\s*\/\s*(\d+)$/);
    if (fracMatch) {
      const n = BigInt(fracMatch[1]);
      const d = BigInt(fracMatch[2]);
      if (d === 0n) throw new CalcError(ERRORS.MATH);
      return ExactValue.fromRational(n, d);
    }
    return ExactValue.fromDecimal(Decimal15.fromString(trimmed));
  }

  commitEditBuf() {
    if (this.editBuf.length > 0) {
      try {
        const val = this.evaluateEditBuf(this.editBuf);
        this.vector.set(this.curIdx, val);
        this.app.setVector(this.varName, this.vector);
      } catch (err) {
        // syntax or math error in input
      }
      this.editBuf = '';
    }
  }

  onKey(ev) {
    const k = ev.key;

    if (this.stoPending) {
      this.stoPending = false;
      let dest = null;
      if (k === 'A' || k === 'NEG' || k === '(-)') dest = 'VctA';
      else if (k === 'B' || k === 'DEG') dest = 'VctB';
      else if (k === 'C' || k === 'INV' || k === 'x⁻¹') dest = 'VctC';
      else if (k === 'D' || k === 'SIN' || k === 'sin') dest = 'VctD';
      if (dest) {
        this.commitEditBuf();
        this.app.setVector(dest, this.vector.clone());
        this.varName = dest;
        return true;
      }
      return true;
    }

    if (k === 'OPTN' && !ev.shift && !ev.alpha) {
      this.commitEditBuf();
      this.calc.pushView(new VectorOptnMenuView(this.calc, this.app));
      return true;
    }

    if (k === 'STO' && !ev.shift && !ev.alpha) {
      this.stoPending = true;
      return true;
    }

    if (k === 'AC' && !ev.shift) {
      if (this.editBuf.length > 0) {
        this.editBuf = '';
        return true;
      }
      this.app.setVector(this.varName, this.vector);
      this.calc.closeAllOverlays();
      return true;
    }

    if ((k === 'EXE' || k === '=') && !ev.shift) {
      this.commitEditBuf();
      if (this.curIdx < this.dim - 1) {
        this.curIdx++;
      }
      this.app.setVector(this.varName, this.vector);
      return true;
    }

    if (k === 'LEFT' && !ev.shift && !ev.alpha) {
      this.commitEditBuf();
      this.curIdx = Math.max(0, this.curIdx - 1);
      return true;
    }

    if (k === 'RIGHT' && !ev.shift && !ev.alpha) {
      this.commitEditBuf();
      this.curIdx = Math.min(this.dim - 1, this.curIdx + 1);
      return true;
    }

    if (k === 'DEL' && !ev.shift && !ev.alpha) {
      if (this.editBuf.length > 0) {
        this.editBuf = this.editBuf.slice(0, -1);
      }
      return true;
    }

    if (!ev.shift && !ev.alpha) {
      if (/^[0-9]$/.test(k)) {
        this.editBuf += k;
        return true;
      }
      if (k === 'DOT' || k === '.') {
        if (!this.editBuf.includes('.')) this.editBuf += '.';
        return true;
      }
      if (k === 'NEG' || k === '(-)') {
        if (this.editBuf === '') this.editBuf = '-';
        else if (!this.editBuf.startsWith('-')) this.editBuf = '-' + this.editBuf;
        return true;
      }
      if (k === 'DIV' || k === '/') {
        this.editBuf += '/';
        return true;
      }
    }

    return true;
  }

  render(scr) {
    scr.row(0, this.varName);

    // Format horizontal elements
    const els = this.vector.elements.map((e) => this.vector.formatElement(e));
    const gridText = `[ ${els.join('  ')} ]`;
    scr.text(4, 1 + ROW_PITCH, gridText);

    // Active bottom line value
    const curValStr = this.vector.formatElement(this.vector.elements[this.curIdx]);
    const bottomText = this.editBuf.length > 0 ? this.editBuf : curValStr;
    scr.text(4, 1 + 3 * ROW_PITCH, bottomText);

    scr.lines = [this.varName, gridText, '', bottomText];
  }
}

export class VectorOptnMenuView {
  constructor(calc, app) {
    this.calc = calc;
    this.app = app;
    this.page = 0;
    this.isOverlay = true;
  }

  onKey(ev) {
    if (ev.shift || ev.alpha) return false;
    const k = ev.key;

    if (k === 'AC') {
      this.calc.closeAllOverlays();
      return true;
    }

    if (k === 'DOWN') {
      this.page = (this.page + 1) % 2;
      return true;
    }

    if (k === 'UP') {
      this.page = (this.page + 1) % 2;
      return true;
    }

    if (this.page === 0) {
      if (k === '1') {
        this.openDefineMenu();
        return true;
      }
      if (k === '2') {
        this.openEditMenu();
        return true;
      }
      if (k === '3') {
        this.calc.closeAllOverlays();
        this.app.insertInput({ tok: 'VctA' });
        return true;
      }
      if (k === '4') {
        this.calc.closeAllOverlays();
        this.app.insertInput({ tok: 'VctB' });
        return true;
      }
      if (k === '5') {
        this.calc.closeAllOverlays();
        this.app.insertInput({ tok: 'VctC' });
        return true;
      }
      if (k === '6') {
        this.calc.closeAllOverlays();
        this.app.insertInput({ tok: 'VctD' });
        return true;
      }
    } else {
      if (k === '1') {
        this.calc.closeAllOverlays();
        this.app.insertInput({ tok: 'VctAns' });
        return true;
      }
      if (k === '2') {
        this.calc.closeAllOverlays();
        this.app.insertInput({ tok: 'dot' });
        return true;
      }
      if (k === '3') {
        this.calc.closeAllOverlays();
        this.app.insertInput({ tok: 'Angle' });
        return true;
      }
      if (k === '4') {
        this.calc.closeAllOverlays();
        this.app.insertInput({ tok: 'UnitV' });
        return true;
      }
    }

    return true;
  }

  openDefineMenu() {
    const items = ['VctA', 'VctB', 'VctC', 'VctD'].map((name) => ({
      label: name,
      run: (c) => {
        c.replaceView(new DimensionPromptView(c, this.app, name));
      }
    }));
    this.calc.replaceView(new MenuView(this.calc, items, { parent: this }));
  }

  openEditMenu() {
    const items = ['VctA', 'VctB', 'VctC', 'VctD'].map((name) => ({
      label: name,
      run: (c) => {
        const v = this.app.getVector(name);
        if (v && v instanceof VectorValue) {
          c.replaceView(new VectorEditorView(c, this.app, name, v.dim, v));
        } else {
          c.replaceView(new DimensionPromptView(c, this.app, name));
        }
      }
    }));
    this.calc.replaceView(new MenuView(this.calc, items, { parent: this }));
  }

  indicators(set) {
    if (this.page === 0) set.add('Down');
    else set.add('Up');
  }

  render(scr) {
    if (this.page === 0) {
      scr.row(0, '1:Define Vector');
      scr.row(1, '2:Edit Vector');
      scr.row(2, '3:VctA');
      scr.row(3, '4:VctB');
      drawScrollBar(scr, 0, 2);
    } else {
      scr.row(0, '1:VctAns');
      scr.row(1, '2:Dot Product');
      scr.row(2, '3:Angle');
      scr.row(3, '4:Unit Vector');
      drawScrollBar(scr, 1, 2);
    }
  }
}
