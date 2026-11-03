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

/** Encode an RGB canvas as a PNG. */
export function encodePng(canvas: { width: number; height: number; data: Uint8Array }): Uint8Array {
  const png = new PNG({ width: canvas.width, height: canvas.height });
  for (let i = 0; i < canvas.width * canvas.height; i++) {
    png.data[i * 4] = canvas.data[i * 3] as number;
    png.data[i * 4 + 1] = canvas.data[i * 3 + 1] as number;
    png.data[i * 4 + 2] = canvas.data[i * 3 + 2] as number;
    png.data[i * 4 + 3] = 255;
  }
  return new Uint8Array(PNG.sync.write(png));
}

/** Decode a PNG to an RGB canvas (alpha dropped). */
export function decodePng(bytes: Uint8Array): { width: number; height: number; data: Uint8Array } {
  const png = PNG.sync.read(Buffer.from(bytes));
  const data = new Uint8Array(png.width * png.height * 3);
  for (let i = 0; i < png.width * png.height; i++) {
    data[i * 3] = png.data[i * 4] as number;
    data[i * 3 + 1] = png.data[i * 4 + 1] as number;
    data[i * 3 + 2] = png.data[i * 4 + 2] as number;
  }
  return { width: png.width, height: png.height, data };
}
