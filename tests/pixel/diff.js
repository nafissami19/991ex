/**
 * Pixel diff utility for LCD verification.
 * Compares 192×63 monochrome framebuffers or rendered RGBA images and outputs visual diffs.
 */

import fs from 'node:fs';
import { encodePNG, decodePNG } from './png.js';

export const LCD_WIDTH = 192;
export const LCD_HEIGHT = 63;

const PALETTE = {
  matchOn: [0x1a, 0x22, 0x1a, 0xff],    // Dark pixel match (#1A221A)
  matchOff: [0xd6, 0xe3, 0xd6, 0xff],   // Background match (#D6E3D6)
  added: [0xff, 0x00, 0x33, 0xff],      // Extra pixel in actual (Red)
  missing: [0x00, 0x66, 0xff, 0xff]     // Missing pixel in actual (Blue)
};

/** Convert 192×63 binary array (1=on, 0=off) or RGBA buffer into a binary Uint8Array(192*63). */
export function toBinaryPixels(src, width = LCD_WIDTH, height = LCD_HEIGHT, threshold = 128) {
  if (src instanceof Uint8Array && src.length === width * height) {
    return src;
  }
  const binary = new Uint8Array(width * height);
  if (src.length === width * height * 4) {
    for (let i = 0; i < width * height; i++) {
      const o = i * 4;
      const lum = (src[o] * 299 + src[o + 1] * 587 + src[o + 2] * 114) / 1000;
      binary[i] = lum < threshold ? 1 : 0;
    }
    return binary;
  }
  throw new Error(`toBinaryPixels: unsupported buffer size ${src.length}`);
}

/**
 * Compare two sets of pixels.
 * Returns { match: boolean, diffCount, total, diffRGBA, diffPNG(scale) }.
 */
export function pixelDiff(actual, expected, options = {}) {
  const width = options.width || LCD_WIDTH;
  const height = options.height || LCD_HEIGHT;
  const scale = options.scale || 1;

  const aBin = toBinaryPixels(actual, width, height, options.threshold);
  const eBin = toBinaryPixels(expected, width, height, options.threshold);

  let diffCount = 0;
  const diffRGBA = new Uint8Array(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const a = aBin[i];
    const e = eBin[i];
    const o = i * 4;
    let color;

    if (a === e) {
      color = a ? PALETTE.matchOn : PALETTE.matchOff;
    } else {
      diffCount++;
      color = a ? PALETTE.added : PALETTE.missing;
    }

    diffRGBA[o] = color[0];
    diffRGBA[o + 1] = color[1];
    diffRGBA[o + 2] = color[2];
    diffRGBA[o + 3] = color[3];
  }

  const makePNG = (s = scale) => {
    if (s <= 1) return encodePNG(width, height, diffRGBA);
    const scaledW = width * s;
    const scaledH = height * s;
    const scaledRGBA = new Uint8Array(scaledW * scaledH * 4);
    for (let y = 0; y < scaledH; y++) {
      const sy = Math.floor(y / s);
      for (let x = 0; x < scaledW; x++) {
        const sx = Math.floor(x / s);
        const srcIdx = (sy * width + sx) * 4;
        const dstIdx = (y * scaledW + x) * 4;
        scaledRGBA[dstIdx] = diffRGBA[srcIdx];
        scaledRGBA[dstIdx + 1] = diffRGBA[srcIdx + 1];
        scaledRGBA[dstIdx + 2] = diffRGBA[srcIdx + 2];
        scaledRGBA[dstIdx + 3] = diffRGBA[srcIdx + 3];
      }
    }
    return encodePNG(scaledW, scaledH, scaledRGBA);
  };

  return {
    match: diffCount === 0,
    diffCount,
    total: width * height,
    diffRGBA,
    png: makePNG
  };
}

/** Compare two PNG files on disk or buffers and write diff image if different. */
export function comparePNGFiles(actualPath, expectedPath, diffOutputPath, options = {}) {
  const actualBuf = fs.readFileSync(actualPath);
  const expectedBuf = fs.readFileSync(expectedPath);
  const act = decodePNG(actualBuf);
  const exp = decodePNG(expectedBuf);

  if (act.width !== exp.width || act.height !== exp.height) {
    throw new Error(`Dimension mismatch: actual ${act.width}×${act.height} vs expected ${exp.width}×${exp.height}`);
  }

  const res = pixelDiff(act.rgba, exp.rgba, { width: act.width, height: act.height, ...options });
  if (diffOutputPath) {
    fs.writeFileSync(diffOutputPath, res.png(options.scale || 4));
  }
  return res;
}

/** Render a 192×63 binary array into an LCD-colored RGBA buffer. */
export function binaryToRGBA(bin, width = LCD_WIDTH, height = LCD_HEIGHT) {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const on = bin[i];
    const o = i * 4;
    const col = on ? PALETTE.matchOn : PALETTE.matchOff;
    rgba[o] = col[0];
    rgba[o + 1] = col[1];
    rgba[o + 2] = col[2];
    rgba[o + 3] = col[3];
  }
  return rgba;
}
