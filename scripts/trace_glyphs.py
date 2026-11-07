#!/usr/bin/env python3
"""
trace_glyphs.py — Extracts 1-bit LCD bitmap glyphs from official Casio emulator screenshots.

Usage:
  python scripts/trace_glyphs.py --image screenshot.png --text "0123456789" --font large --output glyphs.json
  python scripts/trace_glyphs.py --list-needed-screenshots

Screenshots Needed from Official Emulator (1x zoom):
1. Normal (Large) Font:
   - Digits & Operators: "0123456789+-x/=().,"
   - Lowercase & Uppercase letters: "abcdefghijklmnopqrstuvwxyz", "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
   - Math Symbols: "pi, sqrt, cbrt, integral, sum, degree, prime"
   - Special Characters: "Ans, Rec, Pol, log, ln, sin, cos, tan"
2. Small Font (superscripts, fractions, table headers):
   - Digits & Exponents: "0123456789+-()x"
   - Variable letters: "A, B, C, D, E, F, M, x, y"
3. Menu Glyphs & Arrows:
   - Directional arrows: "▲, ▼, ◀, ▶"
   - Box templates: dashed empty box
"""

import argparse
import sys
import os
import json
from PIL import Image

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

FONTS = {
    'large': {'ascent': 11, 'descent': 3, 'height': 14},
    'small': {'ascent': 7, 'descent': 2, 'height': 9}
}

def list_needed_screenshots():
    print("""
======================================================================
Official Casio Emulator Screenshots Needed for 1:1 Glyph Verification
======================================================================

Capture each screenshot at 1x scale (or 2x with nearest-neighbor scaling):

1. Digits & Arithmetic Line (Large Font):
   - Input line: "0 1 2 3 4 5 6 7 8 9 + - * / = . , : ( )"
   - Verifies: tabular digit widths (8px width with 1px trailing spacing), operators.

2. Upper & Lowercase Alphabet (Large Font):
   - Input line: "A B C D E F M x y" (Variables)
   - Function names: "sin cos tan ln log Pol Rec"

3. Math Symbols & Radicals (Large Font):
   - "pi" (SHIFT x10^x), "e" (ALPHA x10^x)
   - Root symbol: "sqrt( )", cube root, x-root
   - Integral: "integral( )", Summation: "Sigma( )"
   - Sexagesimal: degrees, minutes, seconds symbols "° ' \\""

4. Small Font (Templates & Superscripts):
   - Exponent slot: "2^34567890" (inspect small digits)
   - Fraction numerator and denominator
   - Matrix editor table header / small letters

5. Arrows & Status Annunciators:
   - Menu scroll arrows: Up (▲), Down (▼), Left (◀), Right (▶)
   - Cursor shapes: 1px vertical line, 10-byte warning block (■)
""")

def extract_glyphs_from_image(image_path, text, font_name='large', threshold=128, crop_box=None):
    if not os.path.exists(image_path):
        print(f"Error: image file '{image_path}' not found.", file=sys.stderr)
        return None

    img = Image.open(image_path).convert('L')
    if crop_box:
        img = img.crop(crop_box)

    w, h = img.size
    font_spec = FONTS.get(font_name, FONTS['large'])
    target_h = font_spec['height']

    # Binarize: 1 = dark pixel, 0 = background
    pixels = []
    for y in range(h):
        row = [1 if img.getpixel((x, y)) < threshold else 0 for x in range(w)]
        pixels.append(row)

    # Vertical projection to locate ink columns
    col_has_ink = [any(pixels[y][x] == 1 for y in range(h)) for x in range(w)]

    # Group ink columns into candidate glyphs
    glyphs_cols = []
    in_glyph = False
    start_x = 0
    for x in range(w):
        if col_has_ink[x] and not in_glyph:
            in_glyph = True
            start_x = x
        elif not col_has_ink[x] and in_glyph:
            in_glyph = False
            glyphs_cols.append((start_x, x))
    if in_glyph:
        glyphs_cols.append((start_x, w))

    result = {}
    chars = list(text)
    if len(chars) != len(glyphs_cols):
        print(f"Warning: Expected {len(chars)} glyphs from text, but detected {len(glyphs_cols)} ink clusters.", file=sys.stderr)

    for i, ch in enumerate(chars):
        if i >= len(glyphs_cols):
            break
        gx0, gx1 = glyphs_cols[i]
        gw = (gx1 - gx0) + 1  # include 1 trailing spacing column
        rows = []
        for y in range(min(h, target_h)):
            row_str = "".join('#' if pixels[y][x] == 1 else '.' for x in range(gx0, gx1)) + '.'
            rows.append(row_str)
        # Pad rows to font height if needed
        while len(rows) < target_h:
            rows.append('.' * (len(rows[0]) if rows else gw))

        result[ch] = {
            'w': len(rows[0]) if rows else gw,
            'rows': rows
        }

    return result

def format_js_glyph_table(glyphs_dict, font_name='large'):
    lines = [f"// Extracted glyphs for font '{font_name}'"]
    for ch, data in glyphs_dict.items():
        ch_label = ch if ch != "'" and ch != "\\" else f"\\{ch}"
        lines.append(f"  '{ch_label}': {{ w: {data['w']}, rows: [")
        for r in data['rows']:
            lines.append(f"    '{r}',")
        lines.append("  ] },")
    return "\n".join(lines)

def main():
    parser = argparse.ArgumentParser(description="Trace and extract bitmap glyphs from Casio emulator screenshots")
    parser.add_argument('--image', type=str, help="Path to emulator screenshot PNG")
    parser.add_argument('--text', type=str, help="Expected text contained in the screenshot")
    parser.add_argument('--font', choices=['large', 'small'], default='large', help="Font size (large or small)")
    parser.add_argument('--output', type=str, help="Output JSON or JS file path")
    parser.add_argument('--threshold', type=int, default=128, help="Brightness threshold for ink (0-255)")
    parser.add_argument('--list-needed-screenshots', action='store_true', help="List exact screenshots required")

    args = parser.parse_args()

    if args.list_needed_screenshots or len(sys.argv) == 1:
        list_needed_screenshots()
        return

    if not args.image or not args.text:
        parser.error("--image and --text are required unless --list-needed-screenshots is passed.")

    glyphs = extract_glyphs_from_image(args.image, args.text, font_name=args.font, threshold=args.threshold)
    if glyphs:
        js_code = format_js_glyph_table(glyphs, args.font)
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                if args.output.endswith('.json'):
                    json.dump(glyphs, f, indent=2)
                else:
                    f.write(js_code)
            print(f"Saved {len(glyphs)} glyphs to {args.output}")
        else:
            print(js_code)

if __name__ == '__main__':
    main()
