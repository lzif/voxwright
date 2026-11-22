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

const { examples } = loadVector<{ examples: Record<string, Expected> }>("examples.json");

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
});

interface RngExpected {
  script: string;
  cells: number;
  bounds: [number[], number[]];
  rng_blocks: string[];
  rng_cells: number;
  fixed_counts: Record<string, number>;
  positions_sha256: string;
}

const rngExamples = loadVector<{ rng_examples: Record<string, RngExpected> }>(
  "examples.json",
).rng_examples;

const RNG_PORTS: Record<string, () => Promise<{ BUILD: Build }>> = {
  "homestead-watchtower": () => import("../examples/homestead/watchtower.ts"),
  crystal_observatory: () => import("../examples/crystal_observatory/crystal-observatory.ts"),
};

// These scripts pick blocks with the build's RNG, and the TypeScript PRNG differs
// from Python's on purpose. A cell is set whatever the RNG picks, so every
// position must match, and so must every block the RNG never places.
describe("examples that use the RNG", () => {
  for (const [name, want] of Object.entries(rngExamples)) {
    it(`${name}: same cells, same bounds, same non-random blocks (${want.script})`, async () => {
      const port = RNG_PORTS[name] as () => Promise<{ BUILD: Build }>;
      const { BUILD } = await port();
      const got = digest(BUILD);
      expect(got.lines.length).toBe(want.cells);
      expect(BUILD.bounds()).toEqual(want.bounds);
      const positions = got.lines.map((l) => l.split(" ", 1)[0]).join("\n");
      expect(createHash("sha256").update(positions).digest("hex")).toBe(want.positions_sha256);

      const random = new Set(want.rng_blocks);
      const fixed = Object.fromEntries(Object.entries(got.counts).filter(([b]) => !random.has(b)));
      expect(fixed).toEqual(want.fixed_counts);
      const randomCells = Object.entries(got.counts)
        .filter(([b]) => random.has(b))
        .reduce((n, [, c]) => n + c, 0);
      expect(randomCells).toBe(want.rng_cells);
    });
  }

  it("is not accidentally identical to the Python RNG's picks", async () => {
    // If the PRNGs ever matched bit for bit this suite could be tightened to an exact digest.
    const { BUILD } = await import("../examples/crystal_observatory/crystal-observatory.ts");
    expect(digest(BUILD).counts["minecraft:moss_block"]).toBeGreaterThan(0);
  });
});
