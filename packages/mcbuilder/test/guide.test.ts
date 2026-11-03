// SPDX-License-Identifier: AGPL-3.0-only
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DenseVolume } from "@voxwright/core";
import { directoryAssets } from "@voxwright/render/node";
import { describe, expect, it } from "vitest";
import { buildGuide, itemCounts, mostCommon, shortName, stacks, titleCase } from "../src/index.ts";

interface Case {
  title: string;
  markdown: string;
  layers: Record<string, { size: [number, number]; thumb: number[][] }>;
}
const ref = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../vectors/guides.json", import.meta.url)), "utf8"),
) as {
  thumb: number;
  cases: Record<string, Case>;
};

const root =
  process.env.VOXWRIGHT_ASSETS ?? join(homedir(), ".cache/mcbuilder/26.2/client/assets/minecraft");
const have = existsSync(join(root, "blockstates"));

const BUILDS: Record<string, () => Promise<{ BUILD: { grid: { toDense(): DenseVolume } } }>> = {
  "waystone-s5": () => import("../examples/waystones/s5.ts"),
  "waystone-skystead": () => import("../examples/waystones/skystead.ts"),
  "homestead-well": () => import("../examples/homestead/well.ts"),
  underwater_base: () => import("../examples/underwater_base/underwater_base.ts"),
};

function thumbnail(c: { width: number; height: number; data: Uint8Array }, n: number): number[][] {
  const edges = (len: number): number[] =>
    Array.from({ length: n + 1 }, (_, i) => Math.trunc((i * len) / n));
  const [ys, xs] = [edges(c.height), edges(c.width)];
  return Array.from({ length: n }, (_, i) => {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      const sums = [0, 0, 0];
      let count = 0;
      for (let y = ys[i] as number; y < (ys[i + 1] as number); y++) {
        for (let x = xs[j] as number; x < (xs[j + 1] as number); x++) {
          for (let k = 0; k < 3; k++)
            (sums[k] as number) += c.data[(y * c.width + x) * 3 + k] as number;
          count++;
        }
      }
      row.push(...sums.map((s) => Math.round(s / Math.max(1, count))));
    }
    return row;
  });
}

describe("guide text helpers", () => {
  it("counts items the way the original does", () => {
    const counts = itemCounts([
      "minecraft:stone",
      "minecraft:oak_slab[type=double]",
      "minecraft:oak_slab[type=bottom]",
      "minecraft:oak_door[half=upper]",
      "minecraft:oak_door[half=lower]",
      "minecraft:red_bed[part=head]",
      "minecraft:red_bed[part=foot]",
      "minecraft:air",
      "minecraft:stone",
    ]);
    expect(Object.fromEntries(counts)).toEqual({
      "minecraft:stone": 2,
      "minecraft:oak_slab": 3,
      "minecraft:oak_door": 1,
      "minecraft:red_bed": 1,
    });
    expect(mostCommon(counts).map(([n]) => n)).toEqual([
      "minecraft:oak_slab",
      "minecraft:stone",
      "minecraft:oak_door",
      "minecraft:red_bed",
    ]);
  });

  it("formats stacks, names and titles", () => {
    expect([0, 1, 63, 64, 65, 130, 640].map(stacks)).toEqual([
      "0",
      "1",
      "63",
      "1×64",
      "1×64 + 1",
      "2×64 + 2",
      "10×64",
    ]);
    expect(shortName("minecraft:stone")).toBe("stone");
    expect(shortName("lostqol:waystone")).toBe("lostqol:waystone");
    expect(titleCase("waystone s5")).toBe("Waystone S5");
    expect(titleCase("crystal_observatory".replace("_", " "))).toBe("Crystal Observatory");
  });
});

describe.skipIf(!have)("guide against the Python implementation (vanilla assets)", () => {
  const assets = directoryAssets(root);
  for (const [name, want] of Object.entries(ref.cases)) {
    it(name, async () => {
      const { BUILD } = await (
        BUILDS[name] as () => Promise<{ BUILD: { grid: { toDense(): DenseVolume } } }>
      )();
      const guide = buildGuide(BUILD.grid.toDense(), assets, { title: want.title });
      expect(guide.markdown).toBe(want.markdown);
      expect(guide.layers.map((l) => l.name)).toEqual(Object.keys(want.layers));
      for (const layer of guide.layers) {
        const w = want.layers[layer.name] as { size: [number, number]; thumb: number[][] };
        expect([layer.image.width, layer.image.height], `${layer.name} size`).toEqual(w.size);
        const got = thumbnail(layer.image, ref.thumb);
        let total = 0;
        for (const [i, row] of got.entries())
          for (const [k, v] of row.entries())
            total += Math.abs(v - ((w.thumb[i] as number[])[k] as number));
        // Text is drawn with a different font, so allow a little difference.
        expect(total / (ref.thumb * ref.thumb * 3), `${layer.name} thumbnail`).toBeLessThan(6);
      }
    });
  }
});
