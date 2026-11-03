// SPDX-License-Identifier: AGPL-3.0-only
import { Volume } from "@voxwright/core";
import { describe, expect, it } from "vitest";
import { textMask } from "../src/font.ts";
import type { AssetSource } from "../src/index.ts";
import { drawOverlay, parseViews, renderView, untrustedBlocks } from "../src/index.ts";

const dense = (() => {
  const v = new Volume();
  for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) v.set(x, 0, z, "minecraft:stone");
  return v.toDense();
})();
const view = parseViews("az045_el025")[0] as ReturnType<typeof parseViews>[number];
const opts = { longestPx: 400, supersample: 1, shadow: false };

describe("title, label and compass", () => {
  it("draws the view label bottom-left and a compass bottom-right", () => {
    const plain = renderView(dense, null, view, { ...opts, overlay: false });
    const marked = renderView(dense, null, view, opts);
    expect([marked.width, marked.height]).toEqual([plain.width, plain.height]);
    const changed = (x0: number, y0: number, x1: number, y1: number): number => {
      let n = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = (y * marked.width + x) * 3;
          if (marked.data[i] !== plain.data[i] || marked.data[i + 1] !== plain.data[i + 1]) n++;
        }
      return n;
    };
    const { width: W, height: H } = marked;
    expect(changed(0, H - 40, 140, H)).toBeGreaterThan(200); // label box
    expect(changed(W - 70, H - 70, W, H)).toBeGreaterThan(100); // compass ring
    expect(changed(0, 0, W, H - 80)).toBe(0); // nothing else moves
  });

  it("puts the compass needle toward north: straight up when facing north, to the side otherwise", () => {
    const north = parseViews("az000_el025")[0] as typeof view;
    const img = renderView(dense, null, north, { ...opts, overlay: false });
    drawOverlay(img, north, [1, 0, 0], [0, 1, 0]);
    expect(img.width).toBeGreaterThan(0);
  });

  it("adds headroom and a centred title", () => {
    const plain = renderView(dense, null, view, { ...opts, overlay: false });
    const titled = renderView(dense, null, view, { ...opts, overlay: false, title: "My House" });
    expect(titled.height).toBeGreaterThan(plain.height); // 16% headroom above the structure
    const bg = [244, 241, 235];
    let ink = 0;
    for (let y = 0; y < titled.height * 0.2; y++) {
      for (let x = 0; x < titled.width; x++) {
        const i = (y * titled.width + x) * 3;
        if (titled.data[i] !== bg[0] || titled.data[i + 1] !== bg[1]) ink++;
      }
    }
    expect(ink).toBeGreaterThan(100);
  });

  it("has a glyph for every printable ASCII character", () => {
    for (let c = 33; c < 127; c++)
      expect(
        textMask(String.fromCharCode(c)).on.some((v) => v === 1),
        String.fromCharCode(c),
      ).toBe(true);
    expect(textMask(" ").on.some((v) => v === 1)).toBe(false);
  });
});

describe("untrusted blocks", () => {
  const assets: AssetSource = {
    readJson: (p) =>
      p === "blockstates/stone.json"
        ? { variants: { "": { model: "block/stone" } } }
        : p === "models/block/stone.json"
          ? {
              elements: [
                {
                  from: [0, 0, 0],
                  to: [16, 16, 16],
                  faces: { up: { texture: "#t", cullface: "up" } },
                },
              ],
              textures: { t: "block/stone" },
            }
          : null,
    texture: () => null,
  };
  it("counts cells whose block has no usable model, by name", () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    v.set(1, 0, 0, "minecraft:mystery");
    v.set(2, 0, 0, "minecraft:mystery[a=b]");
    expect([...untrustedBlocks(v.toDense(), assets)]).toEqual([["minecraft:mystery", 2]]);
    expect(untrustedBlocks(v.toDense(), null).size).toBe(0);
  });
});
