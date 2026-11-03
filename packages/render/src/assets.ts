// SPDX-License-Identifier: AGPL-3.0-only

import type { RasterImage } from "./image.ts";

/**
 * Where model data comes from. Paths are relative to `assets/minecraft`
 * (`blockstates/oak_stairs.json`, `models/block/stone.json`, a texture as
 * `block/stone`). Synchronous on purpose: a browser source preloads what it
 * needs, a Node source reads files.
 */
export interface AssetSource {
  /** Parsed JSON, or `null` when missing or unreadable. */
  readJson(path: string): unknown;
  /**
   * A texture by id such as `block/stone`, or `null` when missing. By default
   * an animated texture is cropped to its first frame, which is what model UVs
   * address; pass `{ firstFrameOnly: false }` for the whole strip.
   */
  texture(id: string, options?: { firstFrameOnly?: boolean }): RasterImage | null;
}
