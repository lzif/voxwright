// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { Volume } from "voxmc-core";
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
  // Distant corner marker + central target with adjacent exterior markers just outside the focus box.
  v.set(2 + dx, 1 + dy, 2 + dz, "minecraft:red_wool");
  v.set(2 + dx, 2 + dy, 2 + dz, "minecraft:red_wool");
  v.set(15 + dx, 1 + dy, 15 + dz, "minecraft:lapis_block");
  v.set(15 + dx, 2 + dy, 15 + dz, "minecraft:lapis_block");
  v.set(12 + dx, 1 + dy, 15 + dz, "minecraft:emerald_block");
  v.set(18 + dx, 1 + dy, 15 + dz, "minecraft:emerald_block");
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

function centerPixel(img: ReturnType<typeof renderView>): readonly [number, number, number] {
  const cx = Math.trunc(img.width / 2);
  const cy = Math.trunc(img.height / 2);
  const i = (cy * img.width + cx) * 3;
  return [img.data[i] as number, img.data[i + 1] as number, img.data[i + 2] as number];
}

describe("focused close-up views in renderView (camera framing)", () => {
  const opts = { longestPx: 256, supersample: 1, shadow: false, overlay: false };
  const isRed = (r: number, g: number, b: number) => r > 110 && g < 60 && b < 60;
  const isBlue = (r: number, g: number, b: number) => b > 110 && r < 60 && g < 80;
  const isGreen = (r: number, g: number, b: number) => g > 110 && r < 70 && b < 90;

  it("zooms onto the target while rendering surrounding blocks outside the focus box", () => {
    const dense = buildScene();
    const whole = renderView(dense, syntheticAssets, parseViews("iso")[0] as View, opts);
    const focusRadius = renderView(
      dense,
      syntheticAssets,
      parseViews("iso@15,1,15r1")[0] as View,
      opts,
    );
    const focusBox = renderView(
      dense,
      syntheticAssets,
      parseViews("iso@14,0,14:16,2,16")[0] as View,
      opts,
    );
    const focusRed = renderView(dense, syntheticAssets, parseViews("iso@2,1,2r2")[0] as View, opts);

    expect(focusRadius.data).not.toEqual(whole.data);
    // Radius and equivalent box produce identical camera framing.
    expect([focusBox.width, focusBox.height]).toEqual([focusRadius.width, focusRadius.height]);
    expect(Buffer.from(focusBox.data).equals(Buffer.from(focusRadius.data))).toBe(true);

    // Target lapis_block fills far more of the frame than in the whole build view.
    const wholeBlueFrac = countColorMatches(whole, isBlue) / (whole.width * whole.height);
    const closeBlueFrac = countColorMatches(focusBox, isBlue) / (focusBox.width * focusBox.height);
    expect(wholeBlueFrac).toBeGreaterThan(0);
    expect(closeBlueFrac).toBeGreaterThan(wholeBlueFrac * 5);

    // Blocks OUTSIDE the [14..16, 0..2, 14..16] focus box (emerald at x=12 and x=18) are still rendered!
    expect(countColorMatches(focusBox, isGreen)).toBeGreaterThan(0);
    // Distant red_wool at (2, 1, 2) naturally falls outside the zoomed viewport.
    expect(countColorMatches(focusBox, isRed)).toBe(0);

    // Focusing on the red corner zooms on red and puts blue offscreen.
    const wholeRedFrac = countColorMatches(whole, isRed) / (whole.width * whole.height);
    const closeRedFrac = countColorMatches(focusRed, isRed) / (focusRed.width * focusRed.height);
    expect(wholeRedFrac).toBeGreaterThan(0);
    expect(closeRedFrac).toBeGreaterThan(wholeRedFrac * 5);
    expect(countColorMatches(focusRed, isBlue)).toBe(0);
  });

  it("centers the frame on radius and box focus centers across all view kinds", () => {
    const v = new Volume();
    for (let x = 0; x <= 20; x++) {
      for (let z = 0; z <= 20; z++) v.set(x, 0, z, "minecraft:stone");
    }
    v.set(5, 1, 10, "minecraft:red_wool");
    v.set(15, 1, 10, "minecraft:lapis_block");
    v.set(10, 1, 10, "minecraft:emerald_block");
    const dense = v.toDense();

    // Radius focus centers on (15, 1, 10) for iso, top, az/el, and all orbit views.
    for (const spec of [
      "iso@15,1,10r1",
      "top@15,1,10r1",
      "az090_el025@15,1,10r1",
      "orbit4_el25@15,1,10r1",
    ]) {
      for (const view of parseViews(spec)) {
        const img = renderView(dense, syntheticAssets, view, opts);
        expect(isBlue(...centerPixel(img)), view.label).toBe(true);
      }
    }

    // Box focus centers on its midpoint: [5,1,10]:[15,1,10] has midpoint (10, 1, 10) (emerald_block).
    const asymTop = renderView(
      dense,
      syntheticAssets,
      parseViews("top@5,1,10:15,1,10")[0] as View,
      opts,
    );
    expect(isGreen(...centerPixel(asymTop))).toBe(true);
    // Exterior endpoints (5,1,10) and (15,1,10) are inside the box and both visible.
    expect(countColorMatches(asymTop, isRed)).toBeGreaterThan(0);
    expect(countColorMatches(asymTop, isBlue)).toBeGreaterThan(0);
  });

  it("frames world coordinates consistently regardless of dense.origin", () => {
    const base = buildScene(0, 0, 0);
    const shifted = buildScene(-5, 10, 7);
    const a = renderView(
      base,
      syntheticAssets,
      parseViews("az225_el025@15,1,15r2")[0] as View,
      opts,
    );
    const b = renderView(
      shifted,
      syntheticAssets,
      parseViews("az225_el025@10,11,22r2")[0] as View,
      opts,
    );
    expect([b.width, b.height]).toEqual([a.width, a.height]);
    expect(Buffer.from(b.data).equals(Buffer.from(a.data))).toBe(true);
  });

  it("normalizes reversed pos1:pos2 corners and frames wide out-of-bounds focus boxes without clamping", () => {
    const v = new Volume();
    for (let x = 0; x <= 20; x++) {
      for (let z = 0; z <= 20; z++) v.set(x, 0, z, "minecraft:stone");
    }
    v.set(4, 1, 10, "minecraft:red_wool");
    v.set(16, 1, 10, "minecraft:lapis_block");
    v.set(10, 1, 2, "minecraft:emerald_block");
    const dense = v.toDense();

    const reversedBox = renderView(
      dense,
      syntheticAssets,
      parseViews("iso@16,2,11:4,1,9")[0] as View,
      { ...opts, overlay: true },
    );
    const normalizedBox = renderView(
      dense,
      syntheticAssets,
      parseViews("iso@4,1,9:16,2,11")[0] as View,
      { ...opts, overlay: true },
    );
    expect([reversedBox.width, reversedBox.height]).toEqual([
      normalizedBox.width,
      normalizedBox.height,
    ]);
    expect(Buffer.from(reversedBox.data).equals(Buffer.from(normalizedBox.data))).toBe(true);
    // Surrounding emerald block at (10, 1, 2) or stone outside [4..16, 1..2, 9..11] is still rendered.
    expect(countColorMatches(normalizedBox, isRed)).toBeGreaterThan(0);
    expect(countColorMatches(normalizedBox, isBlue)).toBeGreaterThan(0);

    // Extending past the volume bounds frames the requested world box rather than clamping/cropping to the build.
    const wideBox = renderView(
      dense,
      syntheticAssets,
      parseViews("iso@-10,-5,9:16,15,11")[0] as View,
      opts,
    );
    const tightBox = renderView(
      dense,
      syntheticAssets,
      parseViews("iso@0,0,9:16,2,11")[0] as View,
      opts,
    );
    const wideBlueFrac = countColorMatches(wideBox, isBlue) / (wideBox.width * wideBox.height);
    const tightBlueFrac = countColorMatches(tightBox, isBlue) / (tightBox.width * tightBox.height);
    expect(wideBlueFrac).toBeGreaterThan(0);
    expect(tightBlueFrac).toBeGreaterThan(wideBlueFrac * 2);
  });

  it("renders focus regions outside the volume without crashing or falling back to an empty crop canvas", () => {
    const v = new Volume();
    for (let x = 0; x <= 10; x++) {
      for (let z = 0; z <= 10; z++) v.set(x, 0, z, "minecraft:stone");
    }
    v.set(10, 1, 10, "minecraft:emerald_block");
    const dense = v.toDense();

    // Near-outside focus (box [11..15, -1..3, 11..15] lies outside [0..10]): edge block at (10,1,10) is visible in margin.
    const nearOutside = renderView(
      dense,
      syntheticAssets,
      parseViews("iso@13,1,13r2")[0] as View,
      opts,
    );
    expect(Math.max(nearOutside.width, nearOutside.height)).toBe(256);
    expect(countColorMatches(nearOutside, isGreen)).toBeGreaterThan(0);

    // Far-outside focus: no crash, no 512x512 crop-emptiness special case, overlay still draws.
    const farOutside = renderView(
      dense,
      syntheticAssets,
      parseViews("iso@90,90,90:100,100,100")[0] as View,
      { ...opts, overlay: true },
    );
    expect(Math.max(farOutside.width, farOutside.height)).toBe(256);
    expect(farOutside.width).not.toBe(512);
    expect(farOutside.data[((farOutside.height - 20) * farOutside.width + 12) * 3]).not.toBe(0xf4);
  });

  it("supports tight interior framing through an open doorway without cropping surrounding walls", () => {
    const v = new Volume();
    // Enclosed 11x6x11 stone room with a roof and an open 3-wide, 3-tall south doorway (z=10, x=4..6, y=1..3).
    for (let x = 0; x <= 10; x++) {
      for (let z = 0; z <= 10; z++) {
        v.set(x, 0, z, "minecraft:stone");
        v.set(x, 5, z, "minecraft:stone");
      }
    }
    for (let y = 1; y <= 4; y++) {
      for (let x = 0; x <= 10; x++) {
        v.set(x, y, 0, "minecraft:stone");
        if (!(x >= 4 && x <= 6 && y <= 3)) v.set(x, y, 10, "minecraft:stone");
      }
      for (let z = 0; z <= 10; z++) {
        v.set(0, y, z, "minecraft:stone");
        v.set(10, y, z, "minecraft:stone");
      }
    }
    // Interior blocks inside the room + exterior markers flanking the doorway outside the focus box.
    v.set(5, 1, 5, "minecraft:emerald_block");
    v.set(5, 2, 5, "minecraft:lapis_block");
    v.set(3, 1, 10, "minecraft:red_wool");
    v.set(7, 1, 10, "minecraft:red_wool");
    const dense = v.toDense();

    const interior = renderView(
      dense,
      syntheticAssets,
      parseViews("az180_el000@4,1,4:6,2,6")[0] as View,
      opts,
    );
    const whole = renderView(dense, syntheticAssets, parseViews("az180_el000")[0] as View, opts);
    const interiorGreenFrac =
      countColorMatches(interior, isGreen) / (interior.width * interior.height);
    const wholeGreenFrac = countColorMatches(whole, isGreen) / (whole.width * whole.height);
    expect(interiorGreenFrac).toBeGreaterThan(wholeGreenFrac * 4);
    expect(countColorMatches(interior, isBlue)).toBeGreaterThan(0);
    // Exterior wall blocks flanking the doorway outside the focus box are still rendered!
    expect(countColorMatches(interior, isRed)).toBeGreaterThan(0);
  });
});
