import os
import shutil
import struct
import json
import pefile
from PIL import Image
import io

REF_DIR = r"C:\Program Files (x86)\CASIO\ClassWiz Emulator Subscription\fx-570EX_991EX Emulator"
FONTS_DIR = r"C:\Windows\Fonts"

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(BASE_DIR, "assets")
IMAGES_DIR = os.path.join(ASSETS_DIR, "images")
FONTS_DEST = os.path.join(ASSETS_DIR, "fonts")
DATA_DIR = os.path.join(ASSETS_DIR, "data")

os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(FONTS_DEST, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

def dib_to_image(raw_dib):
    """Convert raw DIB bytes from RT_BITMAP to PIL Image."""
    bih_size = struct.unpack('<I', raw_dib[:4])[0]
    width, height, planes, bpp = struct.unpack('<iiHH', raw_dib[4:16])
    colors = 0
    if bpp <= 8:
        clr_used = struct.unpack('<I', raw_dib[32:36])[0]
        colors = clr_used if clr_used > 0 else (1 << bpp)
    palette_size = colors * 4
    offset = 14 + bih_size + palette_size
    file_size = 14 + len(raw_dib)
    bfh = struct.pack('<2sIHHI', b'BM', file_size, 0, 0, offset)
    bmp_bytes = bfh + raw_dib
    return Image.open(io.BytesIO(bmp_bytes))

def extract_faceplate():
    dll_path = os.path.join(REF_DIR, "CLASSWIZ_P2.dll")
    print(f"Reading faceplate from {dll_path}...")
    pe = pefile.PE(dll_path)
    for rtype in pe.DIRECTORY_ENTRY_RESOURCE.entries:
        if rtype.struct.Id == pefile.RESOURCE_TYPE['RT_BITMAP']:
            for rname in rtype.directory.entries:
                if rname.struct.Id == 103:
                    for lang in rname.directory.entries:
                        data = pe.get_data(lang.data.struct.OffsetToData, lang.data.struct.Size)
                        img = dib_to_image(data)
                        out_path = os.path.join(IMAGES_DIR, "faceplate.png")
                        img.save(out_path, "PNG")
                        print(f"Saved faceplate: {out_path} ({img.size[0]}x{img.size[1]})")
                        return

def extract_status_bars_and_icons():
    exe_path = os.path.join(REF_DIR, "fx-570EX_991EX Emulator.exe")
    print(f"Reading bitmaps and icons from {exe_path}...")
    pe = pefile.PE(exe_path)
    
    # Save status bars:
    # 140 = 192x8 (1x)
    # 139 = 384x17 (2x)
    # 136 = 576x24 (3x)
    # 135 = 192x63 LCD background
    targets = {
        140: "status_bar_1x.png",
        139: "status_bar_2x.png",
        136: "status_bar_3x.png",
        135: "lcd_background.png"
    }
    
    for rtype in pe.DIRECTORY_ENTRY_RESOURCE.entries:
        if rtype.struct.Id == pefile.RESOURCE_TYPE['RT_BITMAP']:
            for rname in rtype.directory.entries:
                if rname.struct.Id in targets:
                    for lang in rname.directory.entries:
                        data = pe.get_data(lang.data.struct.OffsetToData, lang.data.struct.Size)
                        img = dib_to_image(data)
                        out_name = targets[rname.struct.Id]
                        out_path = os.path.join(IMAGES_DIR, out_name)
                        img.save(out_path, "PNG")
                        print(f"Saved {out_name}: {out_path} ({img.size[0]}x{img.size[1]})")

        elif rtype.struct.Id == pefile.RESOURCE_TYPE['RT_ICON']:
            for rname in rtype.directory.entries:
                if rname.struct.Id == 13:
                    for lang in rname.directory.entries:
                        data = pe.get_data(lang.data.struct.OffsetToData, lang.data.struct.Size)
                        if data[:4] == b'\x89PNG':
                            out_path = os.path.join(IMAGES_DIR, "icon_app.png")
                            with open(out_path, 'wb') as f:
                                f.write(data)
                            print(f"Saved app icon: {out_path}")

def copy_fonts():
    fonts = ["CASIO ClassWiz.ttf", "CASIO ClassWiz Fr.ttf"]
    for font in fonts:
        src = os.path.join(FONTS_DIR, font)
        if os.path.exists(src):
            dst = os.path.join(FONTS_DEST, font)
            shutil.copy2(src, dst)
            print(f"Copied font {font} to {dst}")
        else:
            print(f"Warning: Font {src} not found!")

def extract_key_layout():
    dll_path = os.path.join(REF_DIR, "CLASSWIZ_P2.dll")
    pe = pefile.PE(dll_path)
    
    def get_wstr(addr):
        rva = addr - 0x10000000
        data = pe.get_data(rva, 64)
        end = 0
        for i in range(0, len(data), 2):
            if data[i:i+2] == b'\x00\x00':
                end = i
                break
        return data[:end].decode('utf-16le', errors='ignore')

    # Full details for each of the 50 keys, including faceplate silkscreen labels:
    # Primary label (on key), Shift label (gold/yellow above key), Alpha label (red/magenta above key)
    key_labels = {
        0: {"name": "SHIFT", "type": "function", "primary": "SHIFT", "shift": "", "alpha": "", "keychar": "q"},
        1: {"name": "ALPHA", "type": "function", "primary": "ALPHA", "shift": "", "alpha": "", "keychar": "Q"},
        2: {"name": "MENU", "type": "function", "primary": "MENU", "shift": "SETUP", "alpha": "", "keychar": "w"},
        3: {"name": "ON", "type": "power", "primary": "ON", "shift": "", "alpha": "", "keychar": "W"},
        4: {"name": "UP", "type": "dpad", "primary": "▲", "shift": "", "alpha": "", "keychar": "ArrowUp"},
        5: {"name": "DOWN", "type": "dpad", "primary": "▼", "shift": "", "alpha": "", "keychar": "ArrowDown"},
        6: {"name": "LEFT", "type": "dpad", "primary": "◀", "shift": "", "alpha": "", "keychar": "ArrowLeft"},
        7: {"name": "RIGHT", "type": "dpad", "primary": "▶", "shift": "", "alpha": "", "keychar": "ArrowRight"},
        8: {"name": "OPTN", "type": "function", "primary": "OPTN", "shift": "QR", "alpha": "", "keychar": "t"},
        9: {"name": "CALC", "type": "function", "primary": "CALC", "shift": "SOLVE", "alpha": "=", "keychar": "r"},
        10: {"name": "INTEGRAL", "type": "function", "primary": "∫dx", "shift": "d/dx", "alpha": "Σ", "keychar": "y"},
        11: {"name": "X", "type": "function", "primary": "x", "shift": "", "alpha": ":", "keychar": "["},
        12: {"name": "FRAC", "type": "function", "primary": "a b/c", "shift": "d/c", "alpha": "", "keychar": "a"},
        13: {"name": "SQRT", "type": "function", "primary": "√", "shift": "3√", "alpha": "", "keychar": "s"},
        14: {"name": "SQUARE", "type": "function", "primary": "x²", "shift": "x³", "alpha": "", "keychar": "d"},
        15: {"name": "POWER", "type": "function", "primary": "x■", "shift": "■√", "alpha": "", "keychar": "^"},
        16: {"name": "LOG_AB", "type": "function", "primary": "log■■", "shift": "log", "alpha": "", "keychar": "i"},
        17: {"name": "LN", "type": "function", "primary": "ln", "shift": "e■", "alpha": "", "keychar": "h"},
        18: {"name": "NEG", "type": "function", "primary": "(-)", "shift": "", "alpha": "A", "keychar": "z"},
        19: {"name": "DEG", "type": "function", "primary": "° ' \"", "shift": "FACT", "alpha": "B", "keychar": "x"},
        20: {"name": "INV", "type": "function", "primary": "x⁻¹", "shift": "", "alpha": "C", "keychar": "u"},
        21: {"name": "SIN", "type": "function", "primary": "sin", "shift": "sin⁻¹", "alpha": "D", "keychar": "j"},
        22: {"name": "COS", "type": "function", "primary": "cos", "shift": "cos⁻¹", "alpha": "E", "keychar": "k"},
        23: {"name": "TAN", "type": "function", "primary": "tan", "shift": "tan⁻¹", "alpha": "F", "keychar": "l"},
        24: {"name": "STO", "type": "function", "primary": "STO", "shift": "RECALL", "alpha": "", "keychar": "J"},
        25: {"name": "ENG", "type": "function", "primary": "ENG", "shift": "←", "alpha": "", "keychar": "b"},
        26: {"name": "LPAREN", "type": "function", "primary": "(", "shift": "", "alpha": "", "keychar": "("},
        27: {"name": "RPAREN", "type": "function", "primary": ")", "shift": ",", "alpha": "x", "keychar": ")"},
        28: {"name": "SD", "type": "function", "primary": "S<=>D", "shift": "", "alpha": "y", "keychar": "n"},
        29: {"name": "M_PLUS", "type": "function", "primary": "M+", "shift": "M-", "alpha": "M", "keychar": "m"},
        30: {"name": "7", "type": "digit", "primary": "7", "shift": "CONST", "alpha": "", "keychar": "7"},
        31: {"name": "8", "type": "digit", "primary": "8", "shift": "CONV", "alpha": "", "keychar": "8"},
        32: {"name": "9", "type": "digit", "primary": "9", "shift": "RESET", "alpha": "", "keychar": "9"},
        33: {"name": "DEL", "type": "edit", "primary": "DEL", "shift": "INS", "alpha": "", "keychar": "Backspace"},
        34: {"name": "AC", "type": "edit", "primary": "AC", "shift": "OFF", "alpha": "", "keychar": "Escape"},
        35: {"name": "4", "type": "digit", "primary": "4", "shift": "MATRIX", "alpha": "", "keychar": "4"},
        36: {"name": "5", "type": "digit", "primary": "5", "shift": "VECTOR", "alpha": "", "keychar": "5"},
        37: {"name": "6", "type": "digit", "primary": "6", "shift": "", "alpha": "", "keychar": "6"},
        38: {"name": "MUL", "type": "operator", "primary": "×", "shift": "nPr", "alpha": "", "keychar": "*"},
        39: {"name": "DIV", "type": "operator", "primary": "÷", "shift": "nCr", "alpha": "Pol", "keychar": "/"},
        40: {"name": "1", "type": "digit", "primary": "1", "shift": "STAT", "alpha": "", "keychar": "1"},
        41: {"name": "2", "type": "digit", "primary": "2", "shift": "CMPLX", "alpha": "", "keychar": "2"},
        42: {"name": "3", "type": "digit", "primary": "3", "shift": "BASE", "alpha": "", "keychar": "3"},
        43: {"name": "ADD", "type": "operator", "primary": "+", "shift": "Pol", "alpha": "Rec", "keychar": "+"},
        44: {"name": "SUB", "type": "operator", "primary": "-", "shift": "", "alpha": "Int", "keychar": "-"},
        45: {"name": "0", "type": "digit", "primary": "0", "shift": "Rnd", "alpha": "", "keychar": "0"},
        46: {"name": "DOT", "type": "digit", "primary": ".", "shift": "Ran#", "alpha": "RanInt", "keychar": "."},
        47: {"name": "EXP", "type": "digit", "primary": "×10ⁿ", "shift": "π", "alpha": "e", "keychar": "k"},
        48: {"name": "ANS", "type": "digit", "primary": "Ans", "shift": "%", "alpha": "PreAns", "keychar": "m"},
        49: {"name": "EXE", "type": "action", "primary": "=", "shift": "≈", "alpha": "", "keychar": "Enter"}
    }

    keys = []
    for i in range(50):
        chunk = pe.get_data(0x4010 + i * 36, 36)
        d = struct.unpack('<9I', chunk)
        raw_id = get_wstr(d[8])
        ch = chr(d[7]) if 32 <= d[7] < 127 else str(d[7])
        
        info = key_labels.get(i, {})
        key_data = {
            "index": i,
            "raw_id": raw_id,
            "name": info.get("name", raw_id),
            "type": info.get("type", "normal"),
            "code": [d[0], d[1]],
            "rect": {
                "x": d[2],
                "y": d[3],
                "w": d[4],
                "h": d[5]
            },
            "raw_keychar": d[7],
            "raw_char": ch,
            "shortcut": info.get("keychar", ch),
            "primary": info.get("primary", ""),
            "shift": info.get("shift", ""),
            "alpha": info.get("alpha", "")
        }
        keys.append(key_data)

    out_path = os.path.join(DATA_DIR, "key_layout.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(keys, f, indent=2, ensure_ascii=False)
    print(f"Saved key layout ({len(keys)} keys): {out_path}")

def extract_lcd_config():
    config = {
        "faceplate": {
            "width": 644,
            "height": 1250,
            "cushionColor": "#ABABAB",
            "keyFrameColor": "#FF00FF"
        },
        "display": {
            "x": 130,
            "y": 256,
            "width": 384,
            "height": 126,
            "matrixWidth": 192,
            "matrixHeight": 63,
            "scale": 2,
            "backgroundColor": "#D6E3D6",
            "pixelOnColor": "#1A221A",
            "pixelOffColor": "#C8D7C8"
        },
        "statusBar": {
            "x": 130,
            "y": 237,
            "width": 384,
            "height": 17,
            "height1x": 8,
            "width1x": 192
        },
        "modes": [
            {"id": 1, "name": "Calculate", "label": "1: Calculate", "code": "1"},
            {"id": 2, "name": "Complex", "label": "2: Complex", "code": "2"},
            {"id": 3, "name": "Base-N", "label": "3: Base-N", "code": "3"},
            {"id": 4, "name": "Matrix", "label": "4: Matrix", "code": "4"},
            {"id": 5, "name": "Vector", "label": "5: Vector", "code": "5"},
            {"id": 6, "name": "Statistics", "label": "6: Statistics", "code": "6"},
            {"id": 7, "name": "Distribution", "label": "7: Distribution", "code": "7"},
            {"id": 8, "name": "Spreadsheet", "label": "8: Spreadsheet", "code": "8"},
            {"id": 9, "name": "Table", "label": "9: Table", "code": "9"},
            {"id": 10, "name": "Equation/Func", "label": "A: Equation/Func", "code": "A"},
            {"id": 11, "name": "Inequality", "label": "B: Inequality", "code": "B"},
            {"id": 12, "name": "Ratio", "label": "C: Ratio", "code": "C"}
        ]
    }
    out_path = os.path.join(DATA_DIR, "lcd_config.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    print(f"Saved LCD configuration: {out_path}")

if __name__ == "__main__":
    print("=== Extracting Casio fx-570EX / fx-991EX Assets ===")
    extract_faceplate()
    extract_status_bars_and_icons()
    copy_fonts()
    extract_key_layout()
    extract_lcd_config()
    print("=== Asset Extraction Complete ===")
