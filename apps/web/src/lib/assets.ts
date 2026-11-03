// SPDX-License-Identifier: AGPL-3.0-only

// Load the asset pack in a browser or worker. The pack is one JSON file with the
// blockstates, block models and textures (base64 PNG) the renderer needs; it is
// built from vanilla client assets by `pnpm assets` and is never committed.

import {
  type AssetSource,
  crop,
  type DecodedPack,
  fromRgba,
  type RasterImage,
} from "@voxwright/render";

import type { Pack } from "./pack-extract.ts";

export type { Pack };

async function decode(base64: string): Promise<RasterImage> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: "image/png" }));
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  }) as OffscreenCanvasRenderingContext2D;
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return fromRgba(bitmap.width, bitmap.height, new Uint8Array(data.buffer.slice(0)));
}

/** Decode every texture of a pack; animated ones also get a first-frame copy. */
async function decodeTextures(pack: Pack): Promise<{
  strips: Map<string, RasterImage>;
  firstFrames: Map<string, RasterImage>;
}> {
  const strips = new Map<string, RasterImage>();
  const entries = Object.entries(pack.textures);
  const decoded = await Promise.all(
    entries.map(async ([id, b64]) => [id, await decode(b64)] as const),
  );
  for (const [id, img] of decoded) strips.set(id, img);
  const animated = new Set(pack.animated);
  const firstFrames = new Map<string, RasterImage>();
  for (const id of animated) {
    const img = strips.get(id);
    if (img && img.height > img.width && img.height % img.width === 0)
      firstFrames.set(id, crop(img, 0, 0, img.width, img.width));
  }
  return { strips, firstFrames };
}

/** Build a synchronous asset source from a pack, decoding every texture up front. */
export async function assetsFromPack(pack: Pack): Promise<AssetSource> {
  const { strips, firstFrames } = await decodeTextures(pack);
  return {
    readJson: (path) => pack.json[path] ?? null,
    texture(id, options) {
      if (options?.firstFrameOnly === false) return strips.get(id) ?? null;
      return firstFrames.get(id) ?? strips.get(id) ?? null;
    },
  };
}

/**
 * The pack as plain data for the WebGL renderer and its mesher workers: the JSON, and every
 * texture as pixels, animated textures cropped to their first frame.
 */
export async function decodePack(pack: Pack): Promise<DecodedPack> {
  const { strips, firstFrames } = await decodeTextures(pack);
  const textures: Record<string, RasterImage> = {};
  for (const [id, img] of strips) textures[id] = firstFrames.get(id) ?? img;
  return { json: pack.json, textures };
}

/** The pack, or `null` when there is none (the page then draws flat colours). */
export async function fetchPack(url: string): Promise<Pack | null> {
  try {
    const res = await fetch(url);
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) return null;
    return (await res.json()) as Pack;
  } catch {
    return null;
  }
}
