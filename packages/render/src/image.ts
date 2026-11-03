// SPDX-License-Identifier: AGPL-3.0-only

// A minimal 8-bit raster image and the operations the model renderer needs.
// Semantics follow Pillow's, which the original used: crops outside the image
// are zero-filled, channel scaling truncates, alpha is never scaled.

export interface RasterImage {
  width: number;
  height: number;
  /** 3 for RGB, 4 for RGBA. */
  channels: 3 | 4;
  /** Row-major, `channels` bytes per pixel. */
  data: Uint8Array;
}

export function newImage(
  width: number,
  height: number,
  rgb: readonly [number, number, number],
): RasterImage {
  const data = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) data.set(rgb, i * 3);
  return { width, height, channels: 3, data };
}

/** Build an image from RGBA bytes; opaque images are narrowed to RGB, as Pillow's `convert` does here. */
export function fromRgba(width: number, height: number, rgba: Uint8Array): RasterImage {
  let opaque = true;
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] !== 255) {
      opaque = false;
      break;
    }
  }
  if (!opaque) return { width, height, channels: 4, data: rgba };
  const data = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    data[i * 3] = rgba[i * 4] as number;
    data[i * 3 + 1] = rgba[i * 4 + 1] as number;
    data[i * 3 + 2] = rgba[i * 4 + 2] as number;
  }
  return { width, height, channels: 3, data };
}

/** `img.crop((left, top, right, bottom))`; pixels outside the source are zero. */
export function crop(
  img: RasterImage,
  left: number,
  top: number,
  right: number,
  bottom: number,
): RasterImage {
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  const c = img.channels;
  const data = new Uint8Array(width * height * c);
  for (let y = 0; y < height; y++) {
    const sy = top + y;
    if (sy < 0 || sy >= img.height) continue;
    for (let x = 0; x < width; x++) {
      const sx = left + x;
      if (sx < 0 || sx >= img.width) continue;
      const s = (sy * img.width + sx) * c;
      const d = (y * width + x) * c;
      for (let k = 0; k < c; k++) data[d + k] = img.data[s + k] as number;
    }
  }
  return { width, height, channels: c, data };
}

function remap(
  img: RasterImage,
  width: number,
  height: number,
  from: (x: number, y: number) => [number, number],
): RasterImage {
  const c = img.channels;
  const data = new Uint8Array(width * height * c);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [sx, sy] = from(x, y);
      const s = (sy * img.width + sx) * c;
      const d = (y * width + x) * c;
      for (let k = 0; k < c; k++) data[d + k] = img.data[s + k] as number;
    }
  }
  return { width, height, channels: c, data };
}

export const flipLeftRight = (img: RasterImage): RasterImage =>
  remap(img, img.width, img.height, (x, y) => [img.width - 1 - x, y]);
export const flipTopBottom = (img: RasterImage): RasterImage =>
  remap(img, img.width, img.height, (x, y) => [x, img.height - 1 - y]);
/** Pillow's `Transpose.ROTATE_90`: counter-clockwise. */
export const rotate90Ccw = (img: RasterImage): RasterImage =>
  remap(img, img.height, img.width, (x, y) => [img.width - 1 - y, x]);
/** Pillow's `Transpose.ROTATE_270`: clockwise. */
export const rotate90Cw = (img: RasterImage): RasterImage =>
  remap(img, img.height, img.width, (x, y) => [y, img.height - 1 - x]);
export const rotate180 = (img: RasterImage): RasterImage =>
  remap(img, img.width, img.height, (x, y) => [img.width - 1 - x, img.height - 1 - y]);

/** Scale the colour channels by per-channel factors, truncating, never touching alpha. */
function scaleChannels(img: RasterImage, factors: readonly [number, number, number]): RasterImage {
  const c = img.channels;
  const data = new Uint8Array(img.data);
  for (let i = 0; i < img.width * img.height; i++) {
    for (let k = 0; k < 3; k++) {
      data[i * c + k] = Math.min(
        255,
        Math.trunc((img.data[i * c + k] as number) * (factors[k] as number)),
      );
    }
  }
  return { ...img, data };
}

/** Darken by `factor` (RGB only). A factor of 1 or more returns the image itself. */
export function shade(img: RasterImage, factor: number): RasterImage {
  return factor >= 1.0 ? img : scaleChannels(img, [factor, factor, factor]);
}

/** Multiply RGB by `rgb / 255`; alpha untouched. Returns a new image. */
export function tint(img: RasterImage, rgb: readonly [number, number, number]): RasterImage {
  return scaleChannels(img, [rgb[0] / 255.0, rgb[1] / 255.0, rgb[2] / 255.0]);
}

export const copyImage = (img: RasterImage): RasterImage => ({
  ...img,
  data: new Uint8Array(img.data),
});

/** Pixel as `[r, g, b, a]` (alpha 255 for RGB images). */
export function getPixel(img: RasterImage, x: number, y: number): [number, number, number, number] {
  const i = (y * img.width + x) * img.channels;
  return [
    img.data[i] as number,
    img.data[i + 1] as number,
    img.data[i + 2] as number,
    img.channels === 4 ? (img.data[i + 3] as number) : 255,
  ];
}

export function setPixel(
  img: RasterImage,
  x: number,
  y: number,
  rgba: readonly [number, number, number, number],
): void {
  const i = (y * img.width + x) * img.channels;
  img.data[i] = rgba[0];
  img.data[i + 1] = rgba[1];
  img.data[i + 2] = rgba[2];
  if (img.channels === 4) img.data[i + 3] = rgba[3];
}

/** Paste `src` into `dst` at `(left, top)` without blending, converting modes as Pillow does. */
export function paste(dst: RasterImage, src: RasterImage, left: number, top: number): void {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const dx = left + x;
      const dy = top + y;
      if (dx < 0 || dy < 0 || dx >= dst.width || dy >= dst.height) continue;
      setPixel(dst, dx, dy, getPixel(src, x, y));
    }
  }
}

/** Multiply RGB by `k / 255` with integer floor (`v * k // 255`); alpha untouched. */
export function tintRgb(img: RasterImage, rgb: readonly [number, number, number]): RasterImage {
  const c = img.channels;
  const data = new Uint8Array(img.data);
  for (let i = 0; i < img.width * img.height; i++) {
    for (let k = 0; k < 3; k++)
      data[i * c + k] = Math.floor(((img.data[i * c + k] as number) * (rgb[k] as number)) / 255);
  }
  return { ...img, data };
}

/** A solid RGBA image. */
export function solidRgba(
  width: number,
  height: number,
  rgba: readonly [number, number, number, number],
): RasterImage {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set(rgba, i * 4);
  return { width, height, channels: 4, data };
}
