/**
 * UI views for Mode 4: Matrix.
 * - MatrixOptnView: authentic 2-page ClassWiz OPTN menu
 */

import { ROW_PITCH } from '../../ui/Screen.js';
import { drawScrollBar } from '../../ui/views.js';

export class MatrixOptnView {
  constructor(calc, app) {
    this.calc = calc;
    this.app = app;
    this.page = 0; // 0 = page 1, 1 = page 2
    this.isOverlay = true;
  }

  indicators(set) {
    if (this.page === 0) set.add('Down');
    else set.add('Up');
  }

  onKey(ev) {
    if (ev.shift || ev.alpha) return false;
    const k = ev.key;
    if (k === 'AC') {
      this.calc.closeAllOverlays();
      return true;
    }
    if (k === 'DOWN') {
      this.page = 1;
      return true;
    }
    if (k === 'UP') {
      this.page = 0;
      return true;
    }

    if (this.page === 0) {
      if (k === '1') {
        this.calc.closeAllOverlays();
        this.app.matrixPhase = 'define';
        return true;
      }
      if (k === '2') {
        this.calc.closeAllOverlays();
        this.app.matrixPhase = 'select_edit';
        return true;
      }
      if (k === '3') { this.insertTok('MatA'); return true; }
      if (k === '4') { this.insertTok('MatB'); return true; }
      if (k === '5') { this.insertTok('MatC'); return true; }
      if (k === '6') { this.insertTok('MatD'); return true; }
    } else {
      if (k === '1') { this.insertTok('MatAns'); return true; }
      if (k === '2') { this.insertTok('Det'); return true; }
      if (k === '3') { this.insertTok('Trn'); return true; }
      if (k === '4') { this.insertTok('Identity'); return true; }
    }
    return true;
  }

  insertTok(id) {
    this.calc.closeAllOverlays();
    this.app.matrixPhase = 'edit';
    this.app.insertInput({ tok: id });
  }

  render(scr) {
    if (this.page === 0) {
      scr.row(0, '1:Define Matrix');
      scr.row(1, '2:Edit Matrix');
      scr.text(1, 1 + 2 * ROW_PITCH, '3:MatA');
      scr.text(96, 1 + 2 * ROW_PITCH, '4:MatB');
      scr.text(1, 1 + 3 * ROW_PITCH, '5:MatC');
      scr.text(96, 1 + 3 * ROW_PITCH, '6:MatD');
      scr.lines = [
        '1:Define Matrix',
        '2:Edit Matrix',
        '3:MatA    4:MatB',
        '5:MatC    6:MatD'
      ];
    } else {
      scr.row(0, '1:MatAns');
      scr.row(1, '2:Determinant');
      scr.row(2, '3:Transposition');
      scr.row(3, '4:Identity');
      scr.lines = [
        '1:MatAns',
        '2:Determinant',
        '3:Transposition',
        '4:Identity'
      ];
    }
    drawScrollBar(scr, this.page, 2, 0);
  }
}
