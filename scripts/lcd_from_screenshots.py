"""
Build the LCD font, MENU icons and pixel-test references from official emulator screenshots.

Input : docs/reference/screenshots/*.png  (screenshots of the official fx-991EX emulator LCD,
        any size; the dot grid is found automatically)
Output (all git-ignored, because they are copied from Casio's screen):
        js/lcd/fonts/lcd_large.js   traced large font (+ matching glyphs for characters the
                                    screenshots don't show)
        js/lcd/fonts/lcd_icons.js   the 12 MENU icons (unselected form)
        tests/pixel/reference/*.json  official 192x63 screens for tests/pixel_reference.test.js

Run:  python scripts/lcd_from_screenshots.py
Needs: numpy, pillow.
"""

import json
import os
import re
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'docs', 'reference', 'screenshots')
STATUS_PNG = os.path.join(ROOT, 'assets', 'images', 'status_bar_1x.png')
OUT_FONT = os.path.join(ROOT, 'js', 'lcd', 'fonts', 'lcd_large.js')
OUT_ICONS = os.path.join(ROOT, 'js', 'lcd', 'fonts', 'lcd_icons.js')
OUT_REF = os.path.join(ROOT, 'tests', 'pixel', 'reference')
OLD_FONT = os.path.join(ROOT, 'js', 'lcd', 'fonts', 'large.js')

DARK = np.array([0x41, 0x45, 0x40], float)   # official dot colour
LIGHT = np.array([0xC9, 0xD5, 0xCA], float)  # official LCD background
W, H = 192, 63

# Status bar icon x-ranges in status_bar_1x.png (same table as js/lcd/canvas_lcd.js)
STATUS_ICONS = [('S', 0, 5), ('A', 8, 13), ('M', 18, 22), ('STO', 27, 36), ('Math', 40, 53),
                ('D', 57, 62), ('R', 64, 69), ('G', 71, 76), ('FIX', 82, 92), ('SCI', 95, 105),
                ('E', 110, 115), ('i', 119, 122), ('∠', 124, 130), ('Disp', 132, 138),
                ('Left', 142, 147), ('Down', 149, 155), ('Up', 156, 162), ('Right', 164, 169),
                ('Pause', 172, 180), ('Solar', 184, 191)]
# Measured: the status strip starts 7 dots left of the dot matrix and sits directly on top of it.
STATUS_DX, STATUS_DY = -7, -8

# Screens: file -> keys that produce it (key names as in js/core/keys.js) and what the screen shows.
SCREENS = {
    'menu_sel1': {'keys': 'MENU', 'cursor': False},
    'menu_page2_selC': {'keys': 'MENU LEFT', 'cursor': False, 'no_status': True},
    'setup_p1': {'keys': 'SHIFT MENU', 'cursor': False},
    'optn_calc': {'keys': 'OPTN', 'cursor': False},
    'calc_empty': {'keys': '', 'cursor': False},
    # the cursor in this screenshot is after the fraction, so ▶ was pressed after 855
    'calc_9885x3652_855_cur': {'keys': '9 8 8 5 × FRAC 3 6 5 2 DOWN 8 5 5 RIGHT', 'cursor': True},
    'calc_88554x4_58776_result': {'keys': '8 8 5 5 4 × FRAC 4 DOWN 5 8 7 7 6 =', 'cursor': False},
}

# Text visible in the screenshots: (screen, text, x of first 11-dot cell, top row of the 16-row cell,
# rows to ignore at the bottom of the cell (numerators sit on top of the fraction bar))
TEXT = [
    ('setup_p1', '1:Input/Output', 1, 1, 0), ('setup_p1', '2:Angle Unit', 1, 17, 0),
    ('setup_p1', '3:Number Format', 1, 33, 0), ('setup_p1', '4:Engineer Symbol', 1, 49, 0),
    ('optn_calc', '1:Hyperbolic Func', 1, 1, 0), ('optn_calc', '2:Angle Unit', 1, 17, 0),
    ('optn_calc', '3:Engineer Symbol', 1, 33, 0),
    ('menu_sel1', '1:Calculate', 1, 50, 0), ('menu_page2_selC', 'C:Ratio', 1, 50, 0),
    ('calc_9885x3652_855_cur', '9885×', 1, 9, 0), ('calc_9885x3652_855_cur', '3652', 58, 1, 3),
    ('calc_9885x3652_855_cur', '855', 63, 18, 0),
    ('calc_88554x4_58776_result', '88554×', 1, 9, 0), ('calc_88554x4_58776_result', '4', 91, 1, 3),
    ('calc_88554x4_58776_result', '58776', 69, 18, 0),
    ('calc_88554x4_58776_result', '14759', 136, 33, 3), ('calc_88554x4_58776_result', '2449', 141, 50, 0),
]

CELL_W, CELL_H = 11, 16   # 11-dot advance; row 0 blank, rows 1..12 above the baseline, 13..15 below


# ----------------------------------------------------------------------------- decoding

def darkness(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(float)
    d = LIGHT - DARK
    t = ((a - DARK) * d).sum(2) / (d * d).sum()
    return 1 - np.clip(t, 0, 1)


def light_box(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(float)
    m = np.abs(a - LIGHT).sum(2) < 30
    rows = np.where(m.sum(1) > m.shape[1] * 0.5)[0]
    cols = np.where(m.sum(0) > m.shape[0] * 0.4)[0]
    return cols.min(), rows.min(), cols.max() + 1, rows.max() + 1


def area_weights(npx, p, o):
    n = int((npx - o) // p)
    a = o + np.arange(n)[:, None] * p
    x = np.arange(npx)[None, :]
    w = np.clip(np.minimum(a + p, x + 1) - np.maximum(a, x), 0, None)
    return w / np.maximum(w.sum(1, keepdims=True), 1e-9)


def decode(path):
    """Screenshot -> 2-D bool array of LCD dots (grid fitted automatically)."""
    t = darkness(path)
    x0, y0, x1, y1 = light_box(path)
    s = t[y0:y1, x0:x1]
    # Vertically the screenshot is a nearest-neighbour copy: every pixel row repeats exactly one
    # dot row (some dot rows got only 1 pixel row when the screenshot was down-scaled). Fit the
    # grid so the pixel rows grouped into each dot row are as alike as possible.
    ys = np.arange(s.shape[0]) + 0.5
    best = None
    for p in np.arange(1.955, 1.990, 0.0005):
        for o in np.arange(-p, p, 0.02):
            owner = np.floor((ys - o) / p).astype(int)
            owner -= owner.min()
            cnt = np.bincount(owner).astype(float)
            sums = np.zeros((cnt.size, s.shape[1]))
            np.add.at(sums, owner, s)
            sq = np.zeros((cnt.size, s.shape[1]))
            np.add.at(sq, owner, s * s)
            var = (sq - sums * sums / np.maximum(cnt, 1)[:, None]).sum()
            if best is None or var < best[0] - 1e-9:
                best = (var, p, o)
    p, o = best[1], best[2]
    if o < 0:
        o += p
    n = int((s.shape[0] - o) // p)
    owner = np.floor((np.arange(s.shape[0]) + 0.5 - o) / p).astype(int)
    rows = np.zeros((n, s.shape[1]))
    for k in range(n):
        members = np.where(owner == k)[0]
        if len(members) == 0:
            members = [min(s.shape[0] - 1, int(np.floor(o + (k + 0.5) * p)))]
        rows[k] = s[members].mean(0)
    bx = None
    for p in np.arange(1.955, 1.985, 0.0005):          # horizontal: slightly blurred, average cells
        for o in np.arange(0, p, 0.05):
            cov = rows @ area_weights(rows.shape[1], p, o).T
            amb = np.minimum(cov, 1 - cov).sum()
            if bx is None or amb < bx[0]:
                bx = (amb, cov)
    return bx[1] > 0.5


def status_template():
    return np.asarray(Image.open(STATUS_PNG).convert('L')) < 128


def find_status(bits, sb):
    """Locate the status strip by matching the Math, D or Down icon exactly."""
    for name in ('Math', 'D', 'Down'):
        a, b = next((x0, x1) for n, x0, x1 in STATUS_ICONS if n == name)
        T = sb[:, a:b + 1]
        for y in range(bits.shape[0] - 8):
            for x in range(bits.shape[1] - T.shape[1]):
                win = bits[y:y + 8, x:x + T.shape[1]]
                if (win == T).all() and T.sum():
                    return x - a, y
    return None


def find_menu_grid(bits):
    """Fallback anchor for MENU screens without a visible status bar: the cell frame lines."""
    best = None
    for y in range(-30, bits.shape[0]):
        for x in range(-10, bits.shape[1] - 150):
            score = 0
            for c in (47, 95, 143):
                for r in range(3, 14):
                    yy, xx = y + r, x + c
                    if 0 <= yy < bits.shape[0] and 0 <= xx < bits.shape[1] and bits[yy, xx]:
                        score += 1
            if best is None or score > best[0]:
                best = (score, x, y)
    return best[1], best[2]


def to_matrix(bits, origin):
    mx, my = origin
    M = np.zeros((H, W), bool)
    for r in range(H):
        for c in range(W):
            y, x = my + r, mx + c
            if 0 <= y < bits.shape[0] and 0 <= x < bits.shape[1]:
                M[r, c] = bits[y, x]
    return M


def lit_icons(bits, sx, sy, sb):
    on = []
    for n, a, b in STATUS_ICONS:
        T = sb[:, a:b + 1]
        if not T.any():
            continue
        win = np.zeros_like(T)
        for r in range(8):
            for c in range(T.shape[1]):
                y, x = sy + r, sx + a + c
                if 0 <= y < bits.shape[0] and 0 <= x < bits.shape[1]:
                    win[r, c] = bits[y, x]
        if (win & T).sum() >= 0.8 * T.sum():
            on.append(n)
    return on


# ----------------------------------------------------------------------------- glyph design

def g(*rows, top=1):
    """Hand-made glyph in the traced style: rows start at cell row `top`."""
    cell = np.zeros((CELL_H, CELL_W), bool)
    for i, r in enumerate(rows):
        for j, ch in enumerate(r[:CELL_W]):
            cell[top + i, j] = ch == '#'
    return cell


def hflip(cell, width=10):
    out = np.zeros_like(cell)
    for c in range(width):
        out[:, width - 1 - c] = cell[:, c]
    return out


# Characters the screenshots don't show, drawn to match the traced ones
# (2-dot vertical stems, 1-dot horizontals, same serifs and proportions).
DESIGNED = {
    '0': g('...#####...', '..##...##..', '.##.....##.', '.##.....##.', '.##.....##.', '.##.....##.',
           '.##.....##.', '.##.....##.', '.##.....##.', '.##.....##.', '..##...##..', '...#####...'),
    '+': g('....##.....', '....##.....', '....##.....', '....##.....', '##########.', '##########.',
           '....##.....', '....##.....', '....##.....', '....##.....', top=2),
    '−': g('##########.', '##########.', top=6),
    '÷': g('....##.....', '....##.....', '...........', '##########.', '##########.', '...........',
           '....##.....', '....##.....', top=3),
    '=': g('##########.', '##########.', '...........', '...........', '##########.', '##########.', top=4),
    '(': g('......##...', '.....##....', '....##.....', '....##.....', '...##......', '...##......',
           '...##......', '...##......', '...##......', '...##......', '....##.....', '....##.....',
           '.....##....', '......##...'),
    '.': g('....###....', '....###....', '....###....', top=10),
    ',': g('....###....', '....###....', '....###....', '.....#.....', '....#......', top=10),
    'B': g('#######....', '.##...##...', '.##....##..', '.##....##..', '.##...##...', '.######....',
           '.##...##...', '.##....##..', '.##....##..', '.##....##..', '.##...##...', '#######....'),
    'D': g('######.....', '.##..##....', '.##...##...', '.##....##..', '.##....##..', '.##....##..',
           '.##....##..', '.##....##..', '.##....##..', '.##...##...', '.##..##....', '######.....'),
    'G': g('...#####.#.', '..##...###.', '.##.....##.', '.##......#.', '##.........', '##.........',
           '##....####.', '##......##.', '.##.....##.', '.##.....##.', '..##...###.', '...####..#.'),
    'J': g('....######.', '......##...', '......##...', '......##...', '......##...', '......##...',
           '......##...', '......##...', '......##...', '.#....##...', '.##..##....', '..####.....'),
    'K': g('####..###..', '.##....#...', '.##...#....', '.##..#.....', '.##.#......', '.####......',
           '.##.##.....', '.##..##....', '.##...##...', '.##...##...', '.##....##..', '####...###.'),
    'L': g('####.......', '.##........', '.##........', '.##........', '.##........', '.##........',
           '.##........', '.##........', '.##........', '.##......#.', '.##.....##.', '##########.'),
    'M': g('###....###.', '.##....##..', '.###..###..', '.###..###..', '.#.####.#..', '.#..##..#..',
           '.#..##..#..', '.#......#..', '.#......#..', '.#......#..', '.#......#..', '###....###.'),
    'P': g('#######....', '.##...##...', '.##....##..', '.##....##..', '.##....##..', '.##...##...',
           '.######....', '.##........', '.##........', '.##........', '.##........', '####.......'),
    'Q': g('..######...', '.##....##..', '.##....##..', '##......##.', '##......##.', '##......##.',
           '##......##.', '##......##.', '##......##.', '.##....##..', '.##....##..', '..######...',
           '.....###...', '.......##..'),
    'T': g('##########.', '#...##...#.', '....##.....', '....##.....', '....##.....', '....##.....',
           '....##.....', '....##.....', '....##.....', '....##.....', '....##.....', '..######...'),
    'V': g('####...###.', '.##.....#..', '.##.....#..', '..##...#...', '..##...#...', '..##...#...',
           '...##.#....', '...##.#....', '...##.#....', '....###....', '....###....', '.....#.....'),
    'W': g('###....###.', '.#......#..', '.#......#..', '.#..##..#..', '.#..##..#..', '.#..##..#..',
           '.#.#..#.#..', '.#.#..#.#..', '.##....##..', '.##....##..', '.#......#..', '.#......#..'),
    'X': g('####..###..', '.##....#...', '..##..#....', '..##..#....', '...###.....', '....##.....',
           '....###....', '...#.##....', '..#...##...', '..#...##...', '.#.....##..', '###..####..'),
    'Y': g('####..###..', '.##....#...', '..##..#....', '..##..#....', '...###.....', '....##.....',
           '....##.....', '....##.....', '....##.....', '....##.....', '....##.....', '..######...'),
    'Z': g('#########..', '#.....##...', '#....##....', '....##.....', '....##.....', '...##......',
           '...##......', '..##.......', '..##.......', '.##.....#..', '.##.....#..', '#########..'),
    'f': g('....####...', '...##..##..', '...##......', '.#######...', '...##......', '...##......',
           '...##......', '...##......', '...##......', '...##......', '...##......', '.######....'),
    'h': g('###........', '.##........', '.##........', '.##.###....', '.###..##...', '.##....##..',
           '.##....##..', '.##....##..', '.##....##..', '.##....##..', '.##....##..', '####..####.'),
    'j': g('.....##....', '.....##....', '...........', '...####....', '.....##....', '.....##....',
           '.....##....', '.....##....', '.....##....', '.....##....', '.....##....', '.....##....',
           '.##..##....', '..####.....'),
    'k': g('###........', '.##........', '.##........', '.##..####..', '.##...#....', '.##..#.....',
           '.##.#......', '.####......', '.##.##.....', '.##..##....', '.##...##...', '####..####.'),
    's': g('..#####.#..', '.##....##..', '.##.....#..', '..###......', '....####...', '.......##..',
           '.#.....##..', '.##....##..', '.#.#####...', top=4),
    'v': g('.####..###.', '..##....#..', '..##....#..', '..###...#..', '...##..#...', '...###.#...',
           '....###....', '....###....', '.....#.....', top=4),
    'w': g('###....###.', '.#......#..', '.#..##..#..', '.#..##..#..', '.#.#..#.#..', '.#.#..#.#..',
           '.##....##..', '.##....##..', '.#......#..', top=4),
    'x': g('.###..###..', '..##...#...', '...##.#....', '....##.....', '....##.....', '...#.##....',
           '..#...##...', '.#.....##..', '###..####..', top=4),
    'z': g('.#######...', '.#....##...', '.....##....', '....##.....', '...##......', '..##.......',
           '.##.....#..', '.##....##..', '########...', top=4),
}
DESIGNED['-'] = DESIGNED['−']
DESIGNED[')'] = hflip(DESIGNED['('], 11)


def parse_old_font(path):
    """Read js/lcd/fonts/large.js (original 11-row design) -> {char: (w, rows)}."""
    src = open(path, encoding='utf-8').read()
    out = {}
    for m in re.finditer(r"^    ('(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\"): \{ w: (\d+), rows: \[(.*?)\] \}", src, re.S | re.M):
        key = json.loads('"' + m.group(1)[1:-1].replace('\\\'', '\'').replace('"', '\\"') + '"') if m.group(1)[0] == "'" else json.loads(m.group(1))
        rows = re.findall(r"'([.#]+)'", m.group(3))
        out[key] = (int(m.group(2)), rows)
    return out


def convert_old(w, rows):
    """Original glyph (11 rows above baseline + 3 below) -> 16-row cell, centred in 11 dots."""
    src = [[c == '#' for c in r] for r in rows]
    while len(src) < 14:
        src.append([False] * len(src[0]))
    mapped = [[False] * len(src[0])] + src[0:6] + [src[5]] + src[6:11] + src[11:14]
    cell = np.zeros((CELL_H, CELL_W), bool)
    arr = np.array(mapped[:CELL_H], bool)
    if w == 0:   # combining mark: keep its column position
        cell[:, :min(CELL_W, arr.shape[1])] = arr[:, :CELL_W]
        return cell
    cols = np.where(arr.any(0))[0]
    if len(cols) == 0:
        return cell
    ink = arr[:, cols.min():cols.max() + 1]
    off = max(0, (CELL_W - ink.shape[1]) // 2)
    wcopy = min(ink.shape[1], CELL_W - off)
    cell[:, off:off + wcopy] = ink[:, :wcopy]
    return cell


# ----------------------------------------------------------------------------- main

def main():
    sb = status_template()
    os.makedirs(OUT_REF, exist_ok=True)
    mats, refs = {}, {}
    for name, spec in SCREENS.items():
        path = os.path.join(SHOTS, name + '.png')
        if not os.path.exists(path):
            print('missing screenshot', path)
            continue
        bits = decode(path)
        st = None if spec.get('no_status') else find_status(bits, sb)
        if st:
            sx, sy = st
            origin = (sx - STATUS_DX, sy - STATUS_DY)
            icons = lit_icons(bits, sx, sy, sb)
        else:
            gx, gy = find_menu_grid(bits)
            origin = (gx, gy)   # frame lines of the top icon row run from matrix row 3
            icons = None
        M = to_matrix(bits, origin)
        mats[name] = M
        refs[name] = {'name': name, 'source': os.path.relpath(path, ROOT).replace('\\', '/'),
                      'keys': spec['keys'], 'cursorVisible': spec['cursor'],
                      'indicators': icons,
                      'matrix': [''.join('#' if v else '.' for v in row) for row in M]}
        print(f'{name}: origin {origin}, icons {icons}, dark dots {int(M.sum())}')
    # page 2 is anchored by its frame lines; nudge it so its icon rows line up exactly with page 1
    if 'menu_page2_selC' in mats and 'menu_sel1' in mats:
        p1, p2 = mats['menu_sel1'], mats['menu_page2_selC']
        if not (p2[2:26] == p1[26:50]).all():
            print('WARNING: page-2 menu does not line up with page 1')
    for name, ref in refs.items():
        json.dump(ref, open(os.path.join(OUT_REF, name + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    # --- glyphs
    samples = {}
    for screen, text, x0, top, cut in TEXT:
        if screen not in mats:
            continue
        M = mats[screen]
        for k, ch in enumerate(text):
            if ch == ' ':
                continue
            cell = np.zeros((CELL_H, CELL_W), bool)
            for r in range(CELL_H - cut):
                for c in range(CELL_W):
                    y, x = top + r, x0 + CELL_W * k + c
                    if 0 <= y < H and 0 <= x < W:
                        cell[r, c] = M[y, x]
            samples.setdefault(ch, []).append(cell)
    traced = {ch: (np.mean(np.array(v, float), 0) >= 0.5) for ch, v in samples.items()}
    # mirror images of traced letters
    if 'b' in traced:
        d = hflip(traced['b'], 10)
        d[1, :] = False
        d[1, 6:9] = True   # ascender serif sits left of the stem
        DESIGNED['d'] = d
    if 'p' in traced:
        DESIGNED['q'] = hflip(traced['p'], 10)
    old = parse_old_font(OLD_FONT)
    glyphs = {}
    for ch, (w, rows) in old.items():
        glyphs[ch] = ('converted', 0 if w == 0 else CELL_W, convert_old(w, rows))
    for ch, cell in DESIGNED.items():
        glyphs[ch] = ('designed', CELL_W, cell)
    for ch, cell in traced.items():
        glyphs[ch] = ('traced', CELL_W, cell)
    glyphs[' '] = ('traced', CELL_W, np.zeros((CELL_H, CELL_W), bool))
    lines = ['// Large LCD font for the 192x63 dot-matrix LCD, traced from official emulator screenshots.',
             '// GENERATED by scripts/lcd_from_screenshots.py - do not edit, do not commit (Casio-derived).',
             "// Cells are 11 dots wide; row 0 is blank, rows 1-12 sit above the baseline, rows 13-15 below.",
             'export default {', "  name: 'large',", '  ascent: 13,', '  descent: 3,', '  lineHeight: 16,', '  glyphs: {']
    stats = {}
    for ch in sorted(glyphs, key=lambda c: ord(c[0])):
        kind, w, cell = glyphs[ch]
        stats[kind] = stats.get(kind, 0) + 1
        lines.append(f'    {json.dumps(ch, ensure_ascii=False)}: {{ w: {w}, src: {json.dumps(kind)}, rows: [')
        for r in cell:
            lines.append("      '" + ''.join('#' if v else '.' for v in r) + "',")
        lines.append('    ] },')
    lines += ['  },', '};', '']
    open(OUT_FONT, 'w', encoding='utf-8').write('\n'.join(lines))
    print('font:', stats, '->', os.path.relpath(OUT_FONT, ROOT))

    # --- MENU icons (unselected form, 48x24 cells)
    def cell(M, col, row):
        x, t = 48 * col, 2 + 24 * row
        return M[t:t + 24, x:x + 48].copy()

    def unselect(S):
        U = S.copy()
        U[0:22, 1:48] ^= True
        for (x, y) in [(1, 0), (46, 0), (47, 0), (1, 21)]:
            U[y, x] = False
        U[22, 2:47] = True
        return U

    order = ['calculate', 'complex', 'baseN', 'matrix', 'vector', 'statistics', 'distribution',
             'spreadsheet', 'table', 'equation', 'inequality', 'ratio']
    icons = {}
    if 'menu_sel1' in mats:
        p1 = mats['menu_sel1']
        icons['calculate'] = unselect(cell(p1, 0, 0))
        for i in range(1, 8):
            icons[order[i]] = cell(p1, i % 4, i // 4)
    if 'menu_page2_selC' in mats:
        p2 = mats['menu_page2_selC']
        for i in range(8, 11):
            icons[order[i]] = cell(p2, i % 4, 1)
        icons['ratio'] = unselect(cell(p2, 3, 1))
    out = ['// MENU icons traced from official emulator screenshots (unselected form, 48x24 cells).',
           '// GENERATED by scripts/lcd_from_screenshots.py - do not edit, do not commit (Casio-derived).',
           '// Each cell includes its frame: the right-edge line, the bottom line and the number badge.',
           '// The selected form is derived in systemViews.js (inverted rounded box).',
           'export default {', '  width: 48,', '  height: 24,', '  icons: {']
    for name in order:
        if name not in icons:
            continue
        out.append(f'    {name}: {{ rows: [')
        for r in icons[name]:
            out.append("      '" + ''.join('#' if v else '.' for v in r) + "',")
        out.append('    ] },')
    out += ['  },', '};', '']
    open(OUT_ICONS, 'w', encoding='utf-8').write('\n'.join(out))
    print('icons:', len(icons), '->', os.path.relpath(OUT_ICONS, ROOT))


if __name__ == '__main__':
    sys.exit(main())
