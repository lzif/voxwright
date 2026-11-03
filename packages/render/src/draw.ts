// SPDX-License-Identifier: AGPL-3.0-only

// Small drawing helpers on an opaque RGB canvas.

import type { RasterImage } from "./image.ts";
import type { Canvas } from "./rasterize.ts";

export type Rgb3 = readonly [number, number, number];

export function createCanvas(width: number, height: number, rgb: Rgb3): Canvas {
  const data = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) data.set(rgb, i * 3);
  return { width, height, data };
}

function set(c: Canvas, x: number, y: number, rgb: Rgb3): void {
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
  c.data.set(rgb, (y * c.width + x) * 3);
}

/** Straight line with 1 pixel width. */
export function drawLine(
  c: Canvas,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgb: Rgb3,
): void {
  let [x, y] = [Math.round(x0), Math.round(y0)];
  const [ex, ey] = [Math.round(x1), Math.round(y1)];
  const dx = Math.abs(ex - x);
  const dy = -Math.abs(ey - y);
  const sx = x < ex ? 1 : -1;
  const sy = y < ey ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    set(c, x, y, rgb);
    if (x === ex && y === ey) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Filled rectangle with an optional 1 pixel outline (corners inclusive). */
export function drawRect(
  c: Canvas,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  fill: Rgb3,
  outline?: Rgb3,
): void {
  const [lx, hx] = [Math.round(Math.min(x0, x1)), Math.round(Math.max(x0, x1))];
  const [ly, hy] = [Math.round(Math.min(y0, y1)), Math.round(Math.max(y0, y1))];
  for (let y = ly; y <= hy; y++) for (let x = lx; x <= hx; x++) set(c, x, y, fill);
  if (outline) {
    for (let x = lx; x <= hx; x++) {
      set(c, x, ly, outline);
      set(c, x, hy, outline);
    }
    for (let y = ly; y <= hy; y++) {
      set(c, lx, y, outline);
      set(c, hx, y, outline);
    }
  }
}

/** Filled convex polygon by pixel centres, with an optional outline. */
export function drawPolygon(
  c: Canvas,
  pts: readonly (readonly [number, number])[],
  fill: Rgb3,
  outline?: Rgb3,
): void {
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const yc = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i] as [number, number];
      const [x2, y2] = pts[(i + 1) % pts.length] as [number, number];
      if ((y1 <= yc && y2 > yc) || (y2 <= yc && y1 > yc))
        xs.push(x1 + ((yc - y1) / (y2 - y1)) * (x2 - x1));
    }
    if (xs.length < 2) continue;
    const [a, b] = [Math.min(...xs), Math.max(...xs)];
    for (let x = Math.round(a); x <= Math.round(b); x++) set(c, x, y, fill);
  }
  if (outline)
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i] as [number, number];
      const [x2, y2] = pts[(i + 1) % pts.length] as [number, number];
      drawLine(c, x1, y1, x2, y2, outline);
    }
}

/** Filled ellipse inscribed in the box, with an optional outline. */
export function drawEllipse(
  c: Canvas,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  fill: Rgb3,
  outline?: Rgb3,
): void {
  const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
  const [rx, ry] = [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2];
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const [nx, ny] = [(x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry];
      const d = nx * nx + ny * ny;
      if (d <= 1) set(c, x, y, outline && d > 0.6 ? outline : fill);
    }
  }
}

/** Nearest-neighbour resize, sampling at pixel centres as Pillow does. */
export function resizeNearest(img: RasterImage, w: number, h: number): RasterImage {
  const data = new Uint8Array(w * h * img.channels);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(img.height - 1, Math.floor(((y + 0.5) * img.height) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.width - 1, Math.floor(((x + 0.5) * img.width) / w));
      for (let k = 0; k < img.channels; k++)
        data[(y * w + x) * img.channels + k] = img.data[
          (sy * img.width + sx) * img.channels + k
        ] as number;
    }
  }
  return { width: w, height: h, channels: img.channels, data };
}

/** Copy an image onto the canvas, dropping alpha. */
export function pasteRgb(c: Canvas, img: RasterImage, left: number, top: number): void {
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * img.channels;
      set(c, left + x, top + y, [
        img.data[i] as number,
        img.data[i + 1] as number,
        img.data[i + 2] as number,
      ]);
    }
  }
}

/** `Image.blend(img, solid(bg), alpha)` as Pillow computes it (truncating). */
export function blendToward(img: RasterImage, bg: Rgb3, alpha: number): RasterImage {
  const data = new Uint8Array(img.data);
  for (let i = 0; i < img.width * img.height; i++) {
    for (let k = 0; k < 3; k++) {
      const a = data[i * img.channels + k] as number;
      data[i * img.channels + k] = Math.trunc(a + alpha * ((bg[k] as number) - a));
    }
  }
  return { ...img, data };
}
