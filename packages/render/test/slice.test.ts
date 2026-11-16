// SPDX-License-Identifier: AGPL-3.0-only
import { Volume } from "@voxwright/core";
import { describe, expect, it } from "vitest";
import { sliceDense } from "../src/index.ts";

describe("sliceDense", () => {
  const v = new Volume();
  for (let y = 0; y < 4; y++) v.set(0, y, 0, y % 2 ? "minecraft:dirt" : "minecraft:stone");
  const dense = v.toDense();

  it("unsets cells outside the layer range and leaves the original alone", () => {
    const cut = sliceDense(dense, 1, 2);
    expect(Array.from(cut.data)).toEqual(
      [-1, 0 + 1, 0, -1].map((_, i) => (i === 1 || i === 2 ? (dense.data[i] as number) : -1)),
    );
    expect(Array.from(dense.data).every((x) => x >= 0)).toBe(true);
    expect(cut.palette).toBe(dense.palette);
  });

  it("keeps everything for a full range, and nothing for an empty one", () => {
    expect(Array.from(sliceDense(dense, 0, 3).data)).toEqual(Array.from(dense.data));
    expect(Array.from(sliceDense(dense, 5, 9).data).every((x) => x === -1)).toBe(true);
  });
});
