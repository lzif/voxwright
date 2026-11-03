// SPDX-License-Identifier: AGPL-3.0-only
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { leaks } from "../examples/underwater_base/leak-check.ts";
import type { Build } from "../src/index.ts";
import { loadVector } from "./helpers.ts";

interface Expected {
  script: string;
  cells: number;
  non_air: number;
  bounds: [number[], number[]] | null;
  overwrites: number;
  counts: Record<string, number>;
  sha256: string;
  leaks?: { count: number; first: number[][][] };
}

const { examples, skipped } = loadVector<{
  examples: Record<string, Expected>;
  skipped: Record<string, string>;
}>("examples.json");

/** Each example name maps to its TypeScript port. Ports are added as they are finished. */
const PORTS: Record<string, () => Promise<{ BUILD: Build }>> = {
  "homestead-well": () => import("../examples/homestead/well.ts"),
  "homestead-house": () => import("../examples/homestead/house.ts"),
  "homestead-barn": () => import("../examples/homestead/barn.ts"),
  "waystone-classic-ruin": () => import("../examples/waystones/classic-ruin.ts"),
  "waystone-dark-ritual": () => import("../examples/waystones/dark-ritual.ts"),
  "waystone-rustic-path": () => import("../examples/waystones/rustic-path.ts"),
  "waystone-s5": () => import("../examples/waystones/s5.ts"),
  "waystone-s5-argon": () => import("../examples/waystones/s5-argon.ts"),
  "waystone-skystead": () => import("../examples/waystones/skystead.ts"),
  storehouse: () => import("../examples/storehouse/storehouse.ts"),
  underwater_base: () => import("../examples/underwater_base/underwater_base.ts"),
};

function digest(build: Build) {
  const v = build.grid.volume;
  const cells: [number, number, number, string][] = [];
  v.eachCell((x, y, z, idx) => {
    cells.push([x, y, z, v.palette[idx] as string]);
  });
  cells.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const lines = cells.map(([x, y, z, b]) => `${x},${y},${z} ${b}`);
  const counts: Record<string, number> = {};
  for (const [, , , b] of cells) counts[b] = (counts[b] ?? 0) + 1;
  return { lines, counts };
}

describe("example scripts against the Python oracle", () => {
  for (const [name, want] of Object.entries(examples)) {
    const port = PORTS[name];
    (port ? it : it.todo)(`${name} rebuilds identically (${want.script})`, async () => {
      const { BUILD } = await (port as () => Promise<{ BUILD: Build }>)();
      const got = digest(BUILD);
      expect(got.lines.length).toBe(want.cells);
      expect(got.counts).toEqual(want.counts);
      expect(BUILD.bounds()).toEqual(want.bounds);
      expect(BUILD.grid.overwriteCount).toBe(want.overwrites);
      expect(createHash("sha256").update(got.lines.join("\n")).digest("hex")).toBe(want.sha256);
    });
  }

  it("finds the same leaks in the underwater base", async () => {
    const want = (examples.underwater_base as Expected).leaks as NonNullable<Expected["leaks"]>;
    const { BUILD } = await import("../examples/underwater_base/underwater_base.ts");
    const found = leaks(BUILD);
    expect(found.length).toBe(want.count);
    expect(found.slice(0, 10)).toEqual(want.first);
  });

  it("lists the examples left out because they use the RNG", () => {
    expect(Object.keys(skipped).sort()).toEqual(["crystal_observatory", "homestead-watchtower"]);
  });
});

describe("examples that use the RNG (no exact oracle)", () => {
  it("homestead-watchtower has the original's structure; only the stone variants differ", async () => {
    const { BUILD } = await import("../examples/homestead/watchtower.ts");
    const got = digest(BUILD);
    const stone = [
      "minecraft:stone_bricks",
      "minecraft:mossy_stone_bricks",
      "minecraft:cracked_stone_bricks",
    ];
    const pick = (keep: boolean) =>
      Object.entries(got.counts).filter(([k]) => stone.includes(k) === keep);
    // From the Python run: bounds, 510 blocks, 252 of them stone-brick variants
    // (49 mossy, 33 cracked, 170 plain). The PRNG differs, so only the sum is fixed.
    expect(BUILD.bounds()).toEqual([
      [-1, 0, -1],
      [5, 26, 5],
    ]);
    expect(got.lines.length).toBe(510);
    expect(pick(true).reduce((n, [, v]) => n + v, 0)).toBe(252);
    const mossy = got.counts["minecraft:mossy_stone_bricks"] ?? 0;
    const cracked = got.counts["minecraft:cracked_stone_bricks"] ?? 0;
    expect(mossy).toBeGreaterThan(25);
    expect(mossy).toBeLessThan(80);
    expect(cracked).toBeGreaterThan(15);
    expect(cracked).toBeLessThan(55);
    // Everything that is not stone comes out identical to the original.
    expect(Object.fromEntries(pick(false))).toMatchObject({
      "minecraft:spruce_planks": 9,
      "minecraft:lantern": 4,
    });
  });
});
