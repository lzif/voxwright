// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { McbuilderError, shapes } from "../src/index.ts";
import { expectError, loadVector, type MaterialSpec, material } from "./helpers.ts";

interface Case {
  fn: string;
  args: unknown[];
  kwargs: Record<string, unknown>;
  cells?: [number, number, number, string][];
  error?: string;
}

const MATERIAL_KWARGS = ["fill", "verge", "eave", "hip", "cap"];
const FUNCTIONS: Record<string, (...a: never[]) => ReturnType<typeof shapes.box>> = {
  box: shapes.box as never,
  walls: shapes.walls as never,
  pillar: shapes.pillar as never,
  line: shapes.line as never,
  stairs: shapes.stairs as never,
  cylinder: shapes.cylinder as never,
  sphere: shapes.sphere as never,
  cone: shapes.cone as never,
  roof_gable: shapes.roofGable as never,
  roof_hip: shapes.roofHip as never,
};

/** Rebuild a vector call: material descriptors become materials; kwargs become the options object. */
export function call(fn: string, args: unknown[], kwargs: Record<string, unknown>) {
  const a = args.map((x) =>
    typeof x === "object" && x !== null && !Array.isArray(x) ? material(x as MaterialSpec) : x,
  );
  const opts: Record<string, unknown> = { ...kwargs };
  for (const k of MATERIAL_KWARGS) {
    if (opts[k] !== undefined && opts[k] !== null) opts[k] = material(opts[k] as MaterialSpec);
  }
  return (FUNCTIONS[fn] as (...x: unknown[]) => ReturnType<typeof shapes.box>)(...a, opts);
}

const { cases } = loadVector<{ cases: Case[] }>("shapes.json");

describe("shapes against the Python oracle", () => {
  it("has vectors", () => {
    expect(cases.length).toBeGreaterThan(55);
  });

  for (const [i, c] of cases.entries()) {
    const label = `${c.fn} #${i} ${JSON.stringify(c.kwargs).slice(0, 50)}`;
    if (c.error !== undefined) {
      it(`${label} fails`, () => {
        expectError(() => call(c.fn, c.args, c.kwargs), c.error as string);
      });
    } else {
      it(`${label} gives the same ${c.cells?.length} cells in the same order`, () => {
        expect(call(c.fn, c.args, c.kwargs).cells()).toEqual(c.cells);
      });
    }
  }
});

// The cases below port the rest of the Python `tests/test_parts.py`. The stairs facing
// directions, width, invalid direction, length/target exclusivity and the target top step
// are already covered by the vector cases above.

const STAIR = "minecraft:oak_stairs";
const FENCE = "minecraft:oak_fence";

/** `fn` throws a `McbuilderError` whose message matches `message`. */
function refuses(fn: () => unknown, message: RegExp): void {
  expect(fn).toThrow(McbuilderError);
  expect(fn).toThrow(message);
}

describe("stairsRun", () => {
  it("is stairs under the Python script-port name", () => {
    for (const dir of ["north", "south", "east", "west"]) {
      const withLength = { length: 4, width: 2 };
      expect(shapes.stairsRun([1, 2, 3], dir, STAIR, withLength).cells()).toEqual(
        shapes.stairs([1, 2, 3], dir, STAIR, withLength).cells(),
      );
    }
    expect(shapes.stairsRun([1, 2, 3], "east", STAIR, { target: [4, 5, 3] }).cells()).toEqual(
      shapes.stairs([1, 2, 3], "east", STAIR, { target: [4, 5, 3] }).cells(),
    );
  });

  it("refuses a block with facing, where Python overrides it", () => {
    // Python turns `facing=east` into the ascent direction; this port refuses it.
    refuses(
      () =>
        shapes.stairsRun([0, 0, 0], "north", "minecraft:oak_stairs[waterlogged=true,facing=east]", {
          length: 2,
        }),
      /computes 'facing'/,
    );
    // Without facing, other properties survive next to the computed ones.
    const cells = shapes.stairsRun([0, 0, 0], "north", "minecraft:oak_stairs[waterlogged=true]", {
      length: 2,
    });
    expect(cells.cells()).toEqual([
      [0, 0, 0, "minecraft:oak_stairs[facing=north,half=bottom,waterlogged=true]"],
      [0, 1, -1, "minecraft:oak_stairs[facing=north,half=bottom,waterlogged=true]"],
    ]);
  });

  it("passes NBT through withProps untouched", () => {
    expect(
      shapes.stairsRun([0, 0, 0], "east", 'minecraft:chest{CustomName:"x"}', { length: 1 }).cells(),
    ).toEqual([[0, 0, 0, 'minecraft:chest[facing=east,half=bottom]{CustomName:"x"}']]);
  });

  it("rejects a length of zero", () => {
    refuses(() => shapes.stairsRun([0, 0, 0], "north", STAIR, { length: 0 }), /length/);
  });

  it("gives the same cells for a target as for the length that reaches it", () => {
    const cases: [string, [number, number, number]][] = [
      ["east", [3, 3, 0]],
      ["west", [-4, 4, 5]],
      ["south", [2, 2, 7]],
      ["north", [-1, 6, -6]],
    ];
    for (const [dir, target] of cases) {
      const [dx, dz] = shapes.DIRECTIONS[dir] as readonly [number, number];
      const rise = target[1];
      const start: [number, number, number] = [target[0] - rise * dx, 0, target[2] - rise * dz];
      const byLength = shapes.stairsRun(start, dir, STAIR, { length: rise + 1 });
      const byTarget = shapes.stairsRun(start, dir, STAIR, { target });
      expect(byTarget.cells(), dir).toEqual(byLength.cells());
      expect(byTarget.cells().at(-1)?.slice(0, 3), dir).toEqual(target);
    }
  });

  it("treats a target equal to the start as a one-step run", () => {
    expect(shapes.stairsRun([5, 5, 5], "east", STAIR, { target: [5, 5, 5] }).cells()).toEqual([
      [5, 5, 5, "minecraft:oak_stairs[facing=east,half=bottom]"],
    ]);
  });

  it("refuses an unreachable or malformed target", () => {
    const diagonal = /1:1 diagonal/;
    // rise differs from horizontal travel
    refuses(() => shapes.stairsRun([0, 0, 0], "east", STAIR, { target: [3, 2, 0] }), diagonal);
    // perpendicular offset
    refuses(() => shapes.stairsRun([0, 0, 0], "east", STAIR, { target: [3, 3, 1] }), diagonal);
    // below the start
    refuses(() => shapes.stairsRun([0, 5, 0], "north", STAIR, { target: [0, 4, -1] }), diagonal);
    // travel away from the direction
    refuses(() => shapes.stairsRun([0, 0, 0], "east", STAIR, { target: [-2, 2, 0] }), diagonal);
    // not three ints
    refuses(
      () => shapes.stairsRun([0, 0, 0], "east", STAIR, { target: [1, 2] as never }),
      /target must be 3 ints/,
    );
  });
});

describe("railing", () => {
  it("runs along x, inclusive, the same cells as line", () => {
    const run = shapes.railing([0, 64, 0], [4, 64, 0], FENCE);
    expect(run.cells()).toEqual([0, 1, 2, 3, 4].map((x) => [x, 64, 0, FENCE]));
    expect(run.cells()).toEqual(shapes.line([0, 64, 0], [4, 64, 0], FENCE).cells());
  });

  it("runs along z with the end before the start", () => {
    const run = shapes.railing([2, 64, 5], [2, 64, 2], FENCE);
    expect(run.cells().sort((a, b) => a[2] - b[2])).toEqual(
      [2, 3, 4, 5].map((z) => [2, 64, z, FENCE]),
    );
    expect(run.cells()).toEqual(shapes.line([2, 64, 5], [2, 64, 2], FENCE).cells());
  });

  it("is one cell when start equals end", () => {
    const run = shapes.railing([1, 1, 1], [1, 1, 1], FENCE);
    expect(run.cells()).toEqual([[1, 1, 1, FENCE]]);
    expect(run.cells()).toEqual(shapes.line([1, 1, 1], [1, 1, 1], FENCE).cells());
  });

  it("salts a palette with the seed it is given, like line", () => {
    const palette = [FENCE, "minecraft:birch_fence", "minecraft:spruce_fence"];
    const run = shapes.railing([0, 3, 0], [11, 3, 0], palette, { seed: 3 });
    expect(run.cells()).toEqual(shapes.line([0, 3, 0], [11, 3, 0], palette, { seed: 3 }).cells());
  });

  it("names a y mismatch", () => {
    refuses(() => shapes.railing([0, 64, 0], [4, 65, 0], FENCE), /same y level/);
  });

  it("names a diagonal", () => {
    refuses(() => shapes.railing([0, 64, 0], [4, 64, 3], FENCE), /axis-aligned/);
  });

  it("checks both points are three ints", () => {
    refuses(() => shapes.railing([0, 64] as never, [4, 64, 0], FENCE), /start must be 3 ints/);
    refuses(() => shapes.railing([0, 64, 0], [4, 64, 0.5], FENCE), /end coordinates must be ints/);
  });
});
