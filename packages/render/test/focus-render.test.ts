// SPDX-License-Identifier: AGPL-3.0-only
import { Volume } from "@voxwright/core";
import { describe, expect, it } from "vitest";
import { type AssetSource, createCanvas, parseViews, renderView, type View } from "../src/index.ts";

const SOLID_FACES = Object.fromEntries(
  ["down", "up", "north", "south", "west", "east"].map((f) => [f, { texture: "#t", cullface: f }]),
);

const syntheticAssets: AssetSource = {
  readJson(path) {
    for (const name of ["stone", "red_wool", "lapis_block", "emerald_block"]) {
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
      "block/emerald_block": [40, 200, 80],
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
  const isGreen = (r: number, g: number, b: number) => g > 110 && r < 70 && b < 90;

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

  it("frames the full asymmetric pos1:pos2 box, excludes outside blocks, and clamps to volume bounds", () => {
    const v = new Volume();
    for (let x = 0; x <= 24; x++) {
      for (let z = 0; z <= 20; z++) v.set(x, 0, z, "minecraft:stone");
    }
    // Elongated span from x=4 to x=18 (15 blocks long, 3 wide, 2 tall) with distinct ends.
    for (let x = 5; x <= 17; x++) v.set(x, 1, 10, "minecraft:stone");
    v.set(4, 1, 10, "minecraft:red_wool");
    v.set(4, 2, 10, "minecraft:red_wool");
    v.set(18, 1, 10, "minecraft:lapis_block");
    v.set(18, 2, 10, "minecraft:lapis_block");
    // Exterior emerald markers well outside the selected box.
    v.set(2, 1, 2, "minecraft:emerald_block");
    v.set(22, 1, 18, "minecraft:emerald_block");
    const dense = v.toDense();

    const whole = renderView(dense, syntheticAssets, parseViews("iso")[0] as View, opts);
    const boxView = renderView(
      dense,
      syntheticAssets,
      parseViews("iso@4,1,9:18,2,11")[0] as View,
      opts,
    );
    const reversedBox = renderView(
      dense,
      syntheticAssets,
      parseViews("iso@18,2,11:4,1,9")[0] as View,
      { ...opts, overlay: true },
    );
    const boxWithOverlay = renderView(
      dense,
      syntheticAssets,
      parseViews("iso@4,1,9:18,2,11")[0] as View,
      { ...opts, overlay: true },
    );

    // Both end markers inside the full 15-block span are present and zoomed relative to whole build.
    const wholeRedFrac = countColorMatches(whole, isRed) / (whole.width * whole.height);
    const wholeBlueFrac = countColorMatches(whole, isBlue) / (whole.width * whole.height);
    const boxRedFrac = countColorMatches(boxView, isRed) / (boxView.width * boxView.height);
    const boxBlueFrac = countColorMatches(boxView, isBlue) / (boxView.width * boxView.height);
    expect(boxRedFrac).toBeGreaterThan(wholeRedFrac * 2);
    expect(boxBlueFrac).toBeGreaterThan(wholeBlueFrac * 2);
    // Exterior blocks outside the box are completely excluded.
    expect(countColorMatches(boxView, isGreen)).toBe(0);
    // Reversed corners normalize and produce an identical render including the overlay label.
    expect([reversedBox.width, reversedBox.height]).toEqual([
      boxWithOverlay.width,
      boxWithOverlay.height,
    ]);
    expect(Buffer.from(reversedBox.data).equals(Buffer.from(boxWithOverlay.data))).toBe(true);

    // Extending past the volume bounds clamps cleanly to the volume and matches the clamped box.
    const clamped = renderView(
      dense,
      syntheticAssets,
      parseViews("iso@-10,-5,9:18,15,11")[0] as View,
      opts,
    );
    const exactFullY = renderView(
      dense,
      syntheticAssets,
      parseViews("iso@0,0,9:18,2,11")[0] as View,
      opts,
    );
    expect([clamped.width, clamped.height]).toEqual([exactFullY.width, exactFullY.height]);
    expect(Buffer.from(clamped.data).equals(Buffer.from(exactFullY.data))).toBe(true);

    // A box wholly outside the volume bounds renders a blank canvas with overlay without crashing.
    const outside = renderView(
      dense,
      syntheticAssets,
      parseViews("iso@90,90,90:100,100,100")[0] as View,
      { ...opts, overlay: true },
    );
    expect([outside.width, outside.height]).toEqual([512, 512]);
    expect(outside.data[(490 * 512 + 12) * 3]).not.toBe(0xf4);
  });
});
