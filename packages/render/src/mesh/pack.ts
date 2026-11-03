// SPDX-License-Identifier: AGPL-3.0-only

// An asset pack after decoding: the model JSON plus each texture as raw
// pixels. It is plain data, so a page can decode a pack once and post it to
// every mesher worker instead of making each one decode the PNGs again.

import type { AssetSource } from "../assets.ts";
import type { RasterImage } from "../image.ts";

export interface DecodedPack {
  /** Blockstate and model JSON, keyed by path under `assets/minecraft` (`blockstates/stone.json`). */
  json: Record<string, unknown>;
  /** Textures keyed by id (`block/stone`). Animated ones are already their first frame. */
  textures: Record<string, RasterImage>;
}

export interface PackSource extends AssetSource {
  /** Every texture id in the pack. */
  textureIds(): string[];
}

/** A synchronous asset source over a decoded pack. */
export function sourceFromDecoded(pack: DecodedPack): PackSource {
  return {
    readJson: (path) => pack.json[path] ?? null,
    texture: (id) => pack.textures[id] ?? null,
    textureIds: () => Object.keys(pack.textures),
  };
}
