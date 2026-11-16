// SPDX-License-Identifier: AGPL-3.0-only
import { Volume } from "@voxwright/core";
import { describe, expect, it } from "vitest";
import { type AssetSource, createCanvas, parseViews, renderView, type View } from "../src/index.ts";

const SOLID_FACES = Object.fromEntries(
  ["down", "up", "north", "south", "west", "east"].map((f) => [f, { texture: "#t", cullface: f }]),
);

const syntheticAssets: AssetSource = {
  readJson(path) {
    for (const name of ["stone", "red_wool", "lapis_block"]) {
      if (path === `blockstates/${name}.json`) {
        return { variants: { "": { model: `block/${name}` } } };
      }
      if (path === `models/block/${name}.json`) {
        return {
          textures: { t: `block/${name}` },
          elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces: SOLID_FACES }],
        };
      }
    }
    return null;
  },
  texture(id) {
    const colors: Record<string, readonly [number, number, number]> = {
      "block/stone": [130, 130, 130],
      "block/red_wool": [210, 40, 40],
      "block/lapis_block": [35, 75, 210],
    };
    const rgb = colors[id];
    if (!rgb) return null;
    const c = createCanvas(16, 16, rgb);
    return { width: c.width, height: c.height, channels: 3, data: c.data };
  },
};

function buildScene(dx = 0, dy = 0, dz = 0) {
  const v = new Volume();
  for (let x = 0; x <= 20; x++) {
    for (let z = 0; z <= 20; z++) v.set(x + dx, dy, z + dz, "minecraft:stone");
  }
  // Two distinct markers at opposite corners of the platform.
  v.set(2 + dx, 1 + dy, 2 + dz, "minecraft:red_wool");
  v.set(2 + dx, 2 + dy, 2 + dz, "minecraft:red_wool");
  v.set(18 + dx, 1 + dy, 18 + dz, "minecraft:lapis_block");
  v.set(18 + dx, 2 + dy, 18 + dz, "minecraft:lapis_block");
  return v.toDense();
}

function countColorMatches(
  img: ReturnType<typeof renderView>,
  predicate: (r: number, g: number, b: number) => boolean,
): number {
  let n = 0;
  for (let i = 0; i < img.width * img.height; i++) {
    const r = img.data[i * 3] as number;
    const g = img.data[i * 3 + 1] as number;
    const b = img.data[i * 3 + 2] as number;
    if (predicate(r, g, b)) n++;
  }
  return n;
}

describe("focused close-up views in renderView", () => {
  const opts = { longestPx: 256, supersample: 1, shadow: false, overlay: false };
  const isRed = (r: number, g: number, b: number) => r > 110 && g < 60 && b < 60;
  const isBlue = (r: number, g: number, b: number) => b > 110 && r < 60 && g < 80;

  it("zooms onto the target sub-region and excludes distant features", () => {
    const dense = buildScene();
    const whole = renderView(dense, syntheticAssets, parseViews("iso")[0] as View, opts);
    const focusBlue = renderView(
      dense,
      syntheticAssets,
      parseViews("iso@18,1,18r2")[0] as View,
      opts,
    );
    const focusRed = renderView(dense, syntheticAssets, parseViews("iso@2,1,2r2")[0] as View, opts);

    expect(focusBlue.data).not.toEqual(whole.data);
    // In the close-up on lapis_block, blue pixels dominate relative to the whole-build view and red is gone.
    const wholeBlueFrac = countColorMatches(whole, isBlue) / (whole.width * whole.height);
    const closeBlueFrac =
      countColorMatches(focusBlue, isBlue) / (focusBlue.width * focusBlue.height);
    expect(wholeBlueFrac).toBeGreaterThan(0);
    expect(closeBlueFrac).toBeGreaterThan(wholeBlueFrac * 5);
    expect(countColorMatches(focusBlue, isRed)).toBe(0);

    // And vice-versa for the red wool focus.
    const wholeRedFrac = countColorMatches(whole, isRed) / (whole.width * whole.height);
    const closeRedFrac = countColorMatches(focusRed, isRed) / (focusRed.width * focusRed.height);
    expect(wholeRedFrac).toBeGreaterThan(0);
    expect(closeRedFrac).toBeGreaterThan(wholeRedFrac * 5);
    expect(countColorMatches(focusRed, isBlue)).toBe(0);
  });

  it("frames world coordinates consistently regardless of dense.origin", () => {
    const base = buildScene(0, 0, 0);
    const shifted = buildScene(-5, 10, 7);
    const a = renderView(
      base,
      syntheticAssets,
      parseViews("az225_el025@18,1,18r2")[0] as View,
      opts,
    );
    const b = renderView(
      shifted,
      syntheticAssets,
      parseViews("az225_el025@13,11,25r2")[0] as View,
      opts,
    );
    expect([b.width, b.height]).toEqual([a.width, a.height]);
    expect(Buffer.from(b.data).equals(Buffer.from(a.data))).toBe(true);
  });

  it("renders a blank canvas with overlay when a focus box holds no blocks", () => {
    const dense = buildScene();
    const empty = renderView(dense, syntheticAssets, parseViews("iso@99,99,99r3")[0] as View, {
      ...opts,
      overlay: true,
    });
    expect([empty.width, empty.height]).toEqual([512, 512]);
    // Bottom-left overlay badge (y around 480..497) was drawn over the 0xf4f1eb background.
    expect(empty.data[(490 * 512 + 12) * 3]).not.toBe(0xf4);
  });
});
