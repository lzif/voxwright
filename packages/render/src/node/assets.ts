// SPDX-License-Identifier: AGPL-3.0-only

// Read vanilla client assets from a directory on disk (the `assets/minecraft`
// folder that `mcbuild assets fetch` extracts).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import type { AssetSource } from "../assets.ts";
import { crop, fromRgba, type RasterImage } from "../image.ts";

export function directoryAssets(root: string): AssetSource {
  const textures = new Map<string, RasterImage | null>();
  return {
    readJson(path) {
      try {
        return JSON.parse(readFileSync(join(root, path), "utf8"));
      } catch {
        return null;
      }
    },
    texture(id) {
      if (textures.has(id)) return textures.get(id) as RasterImage | null;
      let img: RasterImage | null = null;
      try {
        const png = PNG.sync.read(readFileSync(join(root, "textures", `${id}.png`)));
        img = fromRgba(png.width, png.height, new Uint8Array(png.data));
        // Animated textures: keep the first frame. Model UVs map onto a single
        // frame, not the whole vertically stacked strip.
        const meta = join(root, "textures", `${id}.png.mcmeta`);
        if (existsSync(meta)) {
          try {
            const m = JSON.parse(readFileSync(meta, "utf8")) as { animation?: unknown };
            if (
              typeof m.animation === "object" &&
              m.animation !== null &&
              img.height > img.width &&
              img.height % img.width === 0
            ) {
              img = crop(img, 0, 0, img.width, img.width);
            }
          } catch {}
        }
      } catch {
        img = null;
      }
      textures.set(id, img);
      return img;
    },
  };
}
