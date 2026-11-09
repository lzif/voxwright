// SPDX-License-Identifier: AGPL-3.0-only
import { Volume } from "@voxwright/core";
import { describe, expect, it } from "vitest";
import { parseViews, renderView } from "../src/index.ts";

const dense = (() => {
  const v = new Volume();
  for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) v.set(x, 0, z, "minecraft:stone");
  return v.toDense();
})();
const view = parseViews("az045_el025")[0] as ReturnType<typeof parseViews>[number];
const opts = { longestPx: 120, supersample: 1, shadow: false, overlay: false };

const pixel = (img: ReturnType<typeof renderView>, x: number, y: number): number[] =>
  Array.from(img.data.slice((y * img.width + x) * 3, (y * img.width + x) * 3 + 3));

describe("the background option of renderView", () => {
  it("is the presentation background (0xf4f1eb) unless one is given", () => {
    const img = renderView(dense, null, view, opts);
    expect(pixel(img, 0, 0)).toEqual([0xf4, 0xf1, 0xeb]);
  });

  it("fills the picture around the build with the colour given as 0xRRGGBB", () => {
    const img = renderView(dense, null, view, { ...opts, background: 0x313233 });
    expect(pixel(img, 0, 0)).toEqual([0x31, 0x32, 0x33]);
    expect(pixel(img, img.width - 1, img.height - 1)).toEqual([0x31, 0x32, 0x33]);
  });

  it("does not change the build itself: only the pixels that were background change", () => {
    const light = renderView(dense, null, view, opts);
    const dark = renderView(dense, null, view, { ...opts, background: 0x313233 });
    expect([dark.width, dark.height]).toEqual([light.width, light.height]);
    const bg = [0xf4, 0xf1, 0xeb];
    for (let i = 0; i < light.width * light.height; i++) {
      const l = Array.from(light.data.slice(i * 3, i * 3 + 3));
      if (l[0] !== bg[0] || l[1] !== bg[1] || l[2] !== bg[2])
        expect(Array.from(dark.data.slice(i * 3, i * 3 + 3))).toEqual(l);
    }
  });
});
