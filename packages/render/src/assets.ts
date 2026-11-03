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
   * A texture by id such as `block/stone`, or `null` when missing. Animated
   * textures are already cropped to their first frame.
   */
  texture(id: string): RasterImage | null;
}
