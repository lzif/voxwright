// SPDX-License-Identifier: AGPL-3.0-only
import { Volume } from "@voxwright/core";
import { describe, expect, it } from "vitest";
import { cropDense, sliceDense } from "../src/index.ts";

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

describe("cropDense", () => {
  it("crops in world coordinates using dense.origin and returns an empty volume when disjoint", () => {
    const v = new Volume();
    for (let x = -2; x <= 2; x++) {
      for (let z = 10; z <= 14; z++)
        v.set(x, 4, z, x === 0 && z === 12 ? "minecraft:gold_block" : "minecraft:stone");
    }
    const dense = v.toDense();
    expect(dense.origin).toEqual([-2, 4, 10]);

    const sub = cropDense(dense, [1, 4, 13], [-1, 4, 11]);
    expect(sub.size).toEqual([3, 1, 3]);
    expect(sub.origin).toEqual([-1, 4, 11]);
    const centerIdx = sub.data[(1 * 1 + 0) * 3 + 1] as number;
    expect(sub.palette[centerIdx]).toBe("minecraft:gold_block");

    const empty = cropDense(dense, [50, 50, 50], [55, 55, 55]);
    expect(empty.size).toEqual([0, 0, 0]);
    expect(empty.data.length).toBe(0);
  });
});
