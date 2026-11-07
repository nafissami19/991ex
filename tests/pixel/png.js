// Minimal PNG encoder/decoder (pure Node, node:zlib only).
// encodePNG(width, height, rgba) -> Buffer (8-bit RGBA, filter 0)
// decodePNG(buffer) -> { width, height, rgba }  (non-interlaced; gray/GA/RGB/RGBA/palette)
import { deflateSync, inflateSync } from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

export function encodePNG(width, height, rgba) {
  if (rgba.length !== width * height * 4) throw new Error('encodePNG: rgba length mismatch');
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

export function decodePNG(buf) {
  buf = Buffer.from(buf);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIG)) throw new Error('decodePNG: not a PNG');
  let pos = 8;
  let width = 0, height = 0, depth = 0, ctype = 0, interlace = 0;
  let palette = null, trns = null;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      ctype = data[9];
      interlace = data[12];
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  if (!(ctype in CHANNELS)) throw new Error(`decodePNG: unsupported color type ${ctype}`);
  if (interlace) throw new Error('decodePNG: interlaced PNG not supported');
  if (depth === 16) throw new Error('decodePNG: 16-bit not supported');
  if (depth < 8 && ctype !== 0 && ctype !== 3) throw new Error('decodePNG: bad bit depth');

  const ch = CHANNELS[ctype];
  const bitsPP = ch * depth;
  const bpp = Math.max(1, bitsPP >> 3); // bytes per pixel for filtering
  const stride = Math.ceil((width * bitsPP) / 8);
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length < (stride + 1) * height) throw new Error('decodePNG: truncated image data');

  // Unfilter
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const r = raw[src + x];
      const a = x >= bpp ? px[dst + x - bpp] : 0;
      const b = y > 0 ? px[dst - stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[dst - stride + x - bpp] : 0;
      let v;
      switch (ft) {
        case 0: v = r; break;
        case 1: v = r + a; break;
        case 2: v = r + b; break;
        case 3: v = r + ((a + b) >> 1); break;
        case 4: v = r + paeth(a, b, c); break;
        default: throw new Error(`decodePNG: bad filter ${ft}`);
      }
      px[dst + x] = v & 0xff;
    }
  }

  // Expand to RGBA
  const out = new Uint8Array(width * height * 4);
  const maxv = (1 << depth) - 1;
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (depth < 8) {
        const bit = x * depth;
        const v = (px[row + (bit >> 3)] >> (8 - depth - (bit & 7))) & maxv;
        if (ctype === 3) {
          out[o] = palette[v * 3]; out[o + 1] = palette[v * 3 + 1]; out[o + 2] = palette[v * 3 + 2];
          out[o + 3] = trns && v < trns.length ? trns[v] : 255;
        } else {
          const g = Math.round((v * 255) / maxv);
          out[o] = out[o + 1] = out[o + 2] = g;
          out[o + 3] = trns && trns.length >= 2 && trns.readUInt16BE(0) === v ? 0 : 255;
        }
        continue;
      }
      const i = row + x * ch;
      switch (ctype) {
        case 0: {
          const g = px[i];
          out[o] = out[o + 1] = out[o + 2] = g;
          out[o + 3] = trns && trns.length >= 2 && trns.readUInt16BE(0) === g ? 0 : 255;
          break;
        }
        case 2:
          out[o] = px[i]; out[o + 1] = px[i + 1]; out[o + 2] = px[i + 2];
          out[o + 3] = trns && trns.length >= 6 &&
            trns.readUInt16BE(0) === px[i] && trns.readUInt16BE(2) === px[i + 1] &&
            trns.readUInt16BE(4) === px[i + 2] ? 0 : 255;
          break;
        case 3: {
          const v = px[i];
          out[o] = palette[v * 3]; out[o + 1] = palette[v * 3 + 1]; out[o + 2] = palette[v * 3 + 2];
          out[o + 3] = trns && v < trns.length ? trns[v] : 255;
          break;
        }
        case 4:
          out[o] = out[o + 1] = out[o + 2] = px[i];
          out[o + 3] = px[i + 1];
          break;
        case 6:
          out[o] = px[i]; out[o + 1] = px[i + 1]; out[o + 2] = px[i + 2]; out[o + 3] = px[i + 3];
          break;
      }
    }
  }
  return { width, height, rgba: out };
}
