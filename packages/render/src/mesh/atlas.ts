// SPDX-License-Identifier: AGPL-3.0-only

// A texture atlas built from an asset source: every requested texture packed
// into one RGBA image, so a whole chunk mesh draws with one texture. Animated
// textures are their first frame, because `AssetSource.texture` already crops
// a stacked strip to it. Pure typed-array code, so it runs in Node, a worker
// and the main thread alike.

import type { AssetSource } from "../assets.ts";
import type { RasterImage } from "../image.ts";

/** How a texture's alpha behaves, which decides the draw pass of the faces that use it. */
export const TEXTURE_OPAQUE = 0;
/** Every texel is fully opaque or fully transparent: drawn with an alpha test. */
export const TEXTURE_CUTOUT = 1;
/** A large share of the texels is partly transparent: drawn blended, back to front. */
export const TEXTURE_TRANSLUCENT = 2;
export type TextureKind = 0 | 1 | 2;

/**
 * More than this share of partly transparent texels makes a texture translucent.
 * Below it the few soft pixels are treated as cutout edges (vines, saplings).
 */
export const TRANSLUCENT_SHARE = 0.06;

export interface AtlasEntry {
  /** Top-left texel of the texture inside the atlas (the gutter lies outside it). */
  x: number;
  y: number;
  w: number;
  h: number;
  kind: TextureKind;
}

/** Everything a mesher needs to compute UVs; small enough to post to a worker. */
export interface AtlasLayout {
  width: number;
  height: number;
  entries: Record<string, AtlasEntry>;
  /** Centre of a 1x1 opaque white texel, which flat-coloured faces sample. */
  whiteU: number;
  whiteV: number;
}

export interface Atlas extends AtlasLayout {
  /** RGBA, row-major, row 0 at the top. */
  data: Uint8Array;
}

export interface AtlasOptions {
  /** Atlas width in texels (default 1024). A wider texture grows it. */
  width?: number;
  /** Texels of repeated edge around each texture, against filtering bleed (default 1). */
  gutter?: number;
}

const nextPow2 = (n: number): number => 2 ** Math.ceil(Math.log2(Math.max(1, n)));

/** Alpha class of an image. */
export function classifyTexture(img: RasterImage): TextureKind {
  if (img.channels === 3) return TEXTURE_OPAQUE;
  let partial = 0;
  let clear = 0;
  const n = img.width * img.height;
  for (let i = 0; i < n; i++) {
    const a = img.data[i * 4 + 3] as number;
    if (a === 0) clear++;
    else if (a !== 255) partial++;
  }
  if (partial / n > TRANSLUCENT_SHARE) return TEXTURE_TRANSLUCENT;
  return partial === 0 && clear === 0 ? TEXTURE_OPAQUE : TEXTURE_CUTOUT;
}

/**
 * Pack the textures `ids` (missing ones are skipped) into an atlas. The order
 * of `ids` does not matter: tiles are placed tallest first, ties by id, so the
 * same texture set always gives the same atlas.
 */
export function buildAtlas(
  ids: Iterable<string>,
  assets: AssetSource,
  options: AtlasOptions = {},
): Atlas {
  const gutter = options.gutter ?? 1;
  const found: { id: string; img: RasterImage }[] = [];
  for (const id of [...new Set(ids)].sort()) {
    const img = assets.texture(id);
    if (img !== null && img.width > 0 && img.height > 0) found.push({ id, img });
  }
  // The white texel goes first so that it lands in the corner.
  const tiles = [
    { id: "", img: whiteImage() },
    ...found.sort((a, b) => b.img.height - a.img.height || (a.id < b.id ? -1 : 1)),
  ];
  const widest = tiles.reduce((m, t) => Math.max(m, t.img.width + 2 * gutter), 0);
  const width = nextPow2(Math.max(options.width ?? 1024, widest));

  // Shelf packing: fill a row left to right, start a new one when it overflows.
  const placed: { id: string; img: RasterImage; x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const t of tiles) {
    const tw = t.img.width + 2 * gutter;
    const th = t.img.height + 2 * gutter;
    if (x + tw > width) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    placed.push({ id: t.id, img: t.img, x: x + gutter, y: y + gutter });
    x += tw;
    rowH = Math.max(rowH, th);
  }
  const height = nextPow2(y + rowH);

  const data = new Uint8Array(width * height * 4);
  const entries: Record<string, AtlasEntry> = {};
  for (const p of placed) {
    blit(data, width, p.img, p.x, p.y, gutter);
    if (p.id !== "")
      entries[p.id] = {
        x: p.x,
        y: p.y,
        w: p.img.width,
        h: p.img.height,
        kind: classifyTexture(p.img),
      };
  }
  const white = placed[0] as { x: number; y: number };
  return {
    width,
    height,
    entries,
    whiteU: (white.x + 0.5) / width,
    whiteV: (white.y + 0.5) / height,
    data,
  };
}

function whiteImage(): RasterImage {
  return { width: 1, height: 1, channels: 3, data: new Uint8Array([255, 255, 255]) };
}

/** Copy `img` to `(left, top)` and extrude its edge texels `gutter` texels outward. */
function blit(
  data: Uint8Array,
  stride: number,
  img: RasterImage,
  left: number,
  top: number,
  gutter: number,
): void {
  const c = img.channels;
  for (let dy = -gutter; dy < img.height + gutter; dy++) {
    const sy = Math.min(img.height - 1, Math.max(0, dy));
    for (let dx = -gutter; dx < img.width + gutter; dx++) {
      const sx = Math.min(img.width - 1, Math.max(0, dx));
      const s = (sy * img.width + sx) * c;
      const d = ((top + dy) * stride + left + dx) * 4;
      data[d] = img.data[s] as number;
      data[d + 1] = img.data[s + 1] as number;
      data[d + 2] = img.data[s + 2] as number;
      data[d + 3] = c === 4 ? (img.data[s + 3] as number) : 255;
    }
  }
}

/** The layout without the pixels, for posting to workers. */
export function atlasLayout(atlas: Atlas): AtlasLayout {
  const { width, height, entries, whiteU, whiteV } = atlas;
  return { width, height, entries, whiteU, whiteV };
}
