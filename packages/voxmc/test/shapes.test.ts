// SPDX-License-Identifier: AGPL-3.0-only

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { shapes, VoxmcError } from "../src/index.ts";
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

/** `fn` throws a `VoxmcError` whose message matches `message`. */
function refuses(fn: () => unknown, message: RegExp): void {
  expect(fn).toThrow(VoxmcError);
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

describe("arch", () => {
  const OAK = "minecraft:oak_stairs";
  const SLAB = "minecraft:oak_slab";
  const BRICK = "minecraft:stone_bricks";
  type Cell = [number, number, number, string];

  const sortCells = (cells: Cell[]): Cell[] =>
    [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const stair = (facing: string): string => `${OAK}[facing=${facing},half=top]`;
  const slab = (type: string): string => `${SLAB}[type=${type}]`;
  /** The cells of `arch`, sorted so the expectations need not know the insertion order. */
  const cellsOf = (...args: Parameters<typeof shapes.arch>): Cell[] =>
    sortCells(shapes.arch(...args).cells() as Cell[]);

  describe("stepped", () => {
    it("is one upside-down stair per corner for a 3-wide span", () => {
      expect(cellsOf([0, 10, 0], 3, OAK, { axis: "x", profile: "stepped" })).toEqual([
        [0, 10, 0, stair("west")],
        [2, 10, 0, stair("east")],
      ]);
    });

    it("steps two rows up a 6-wide span and leaves the spandrel empty without fill", () => {
      expect(cellsOf([0, 10, 0], 6, OAK, { axis: "x", profile: "stepped" })).toEqual([
        [0, 10, 0, stair("west")],
        [1, 11, 0, stair("west")],
        [4, 11, 0, stair("east")],
        [5, 10, 0, stair("east")],
      ]);
    });

    it("fills the spandrel beside the upper stairs", () => {
      expect(cellsOf([0, 10, 0], 6, OAK, { axis: "x", profile: "stepped", fill: BRICK })).toEqual([
        [0, 10, 0, stair("west")],
        [0, 11, 0, BRICK],
        [1, 11, 0, stair("west")],
        [4, 11, 0, stair("east")],
        [5, 10, 0, stair("east")],
        [5, 11, 0, BRICK],
      ]);
    });

    it("honours rise 1 on a wide span", () => {
      expect(cellsOf([0, 0, 0], 8, OAK, { axis: "x", profile: "stepped", rise: 1 })).toEqual([
        [0, 0, 0, stair("west")],
        [7, 0, 0, stair("east")],
      ]);
    });

    it("runs along z, facing north then south, with the span toward +Z", () => {
      expect(cellsOf([5, 0, 5], 4, OAK, { axis: "z", profile: "stepped" })).toEqual([
        [5, 0, 5, stair("north")],
        [5, 0, 8, stair("south")],
        [5, 1, 6, stair("north")],
        [5, 1, 7, stair("south")],
      ]);
    });

    it("repeats identical layers for depth toward +Z (axis x) or +X (axis z)", () => {
      const x = cellsOf([0, 0, 0], 3, OAK, { axis: "x", profile: "stepped", depth: 2 });
      expect(x).toEqual([
        [0, 0, 0, stair("west")],
        [0, 0, 1, stair("west")],
        [2, 0, 0, stair("east")],
        [2, 0, 1, stair("east")],
      ]);
      const z = cellsOf([0, 0, 0], 3, OAK, { axis: "z", profile: "stepped", depth: 2 });
      expect(z).toEqual([
        [0, 0, 0, stair("north")],
        [0, 0, 2, stair("south")],
        [1, 0, 0, stair("north")],
        [1, 0, 2, stair("south")],
      ]);
    });

    it("refuses a rise that would cross, and a slab", () => {
      refuses(
        () => shapes.arch([0, 0, 0], 4, OAK, { axis: "x", profile: "stepped", rise: 3 }),
        /allows rise <= 2/,
      );
      refuses(
        () => shapes.arch([0, 0, 0], 6, OAK, { axis: "x", profile: "stepped", slab: SLAB }),
        /slab is not used/,
      );
    });
  });

  describe("segmental", () => {
    it("is haunch stairs under a bottom-slab crown for 4 clear, rise 2 (trixyblox f_001)", () => {
      expect(cellsOf([0, 10, 0], 4, OAK, { axis: "x", profile: "segmental", slab: SLAB })).toEqual([
        [0, 10, 0, stair("west")],
        [1, 11, 0, slab("bottom")],
        [2, 11, 0, slab("bottom")],
        [3, 10, 0, stair("east")],
      ]);
    });

    it("leaves the crown empty without a slab, and fills the spandrel", () => {
      expect(cellsOf([0, 10, 0], 4, OAK, { axis: "x", profile: "segmental", fill: BRICK })).toEqual(
        [
          [0, 10, 0, stair("west")],
          [0, 11, 0, BRICK],
          [3, 10, 0, stair("east")],
          [3, 11, 0, BRICK],
        ],
      );
    });

    it("takes a taller rise: two stair rows then a one-cell crown (5 wide, rise 3)", () => {
      expect(
        cellsOf([0, 0, 0], 5, OAK, {
          axis: "x",
          profile: "segmental",
          slab: SLAB,
          rise: 3,
          fill: BRICK,
        }),
      ).toEqual([
        [0, 0, 0, stair("west")],
        [0, 1, 0, BRICK],
        [0, 2, 0, BRICK],
        [1, 1, 0, stair("west")],
        [1, 2, 0, BRICK],
        [2, 2, 0, slab("bottom")],
        [3, 1, 0, stair("east")],
        [3, 2, 0, BRICK],
        [4, 0, 0, stair("east")],
        [4, 1, 0, BRICK],
        [4, 2, 0, BRICK],
      ]);
    });

    it("runs along z", () => {
      expect(cellsOf([2, 3, 4], 3, OAK, { axis: "z", profile: "segmental", slab: SLAB })).toEqual([
        [2, 3, 4, stair("north")],
        [2, 3, 6, stair("south")],
        [2, 4, 5, slab("bottom")],
      ]);
    });

    it("refuses a span too narrow for its rise, and a rise below 2", () => {
      refuses(
        () => shapes.arch([0, 0, 0], 2, OAK, { axis: "x", profile: "segmental" }),
        /needs width >= 3/,
      );
      refuses(
        () => shapes.arch([0, 0, 0], 6, OAK, { axis: "x", profile: "segmental", rise: 4 }),
        /needs width >= 7/,
      );
      refuses(
        () => shapes.arch([0, 0, 0], 6, OAK, { axis: "x", profile: "segmental", rise: 1 }),
        /rise must be an int >= 2/,
      );
    });
  });

  describe("pointed", () => {
    it("closes by itself on an even width: the 4, 3, 2, 1 lancet (trixyblox f_019)", () => {
      expect(cellsOf([0, 10, 0], 4, OAK, { axis: "x", profile: "pointed", slab: SLAB })).toEqual([
        [0, 10, 0, stair("west")],
        [1, 11, 0, stair("west")],
        [2, 11, 0, stair("east")],
        [3, 10, 0, stair("east")],
      ]);
    });

    it("caps an odd width with a top slab at the apex (5 wide)", () => {
      expect(
        cellsOf([0, 10, 0], 5, OAK, { axis: "x", profile: "pointed", slab: SLAB, fill: BRICK }),
      ).toEqual([
        [0, 10, 0, stair("west")],
        [0, 11, 0, BRICK],
        [1, 11, 0, stair("west")],
        [2, 11, 0, slab("top")],
        [3, 11, 0, stair("east")],
        [4, 10, 0, stair("east")],
        [4, 11, 0, BRICK],
      ]);
    });

    it("bridges a 3-wide span with a top slab", () => {
      expect(cellsOf([0, 0, 0], 3, OAK, { axis: "x", profile: "pointed", slab: SLAB })).toEqual([
        [0, 0, 0, stair("west")],
        [1, 0, 0, slab("top")],
        [2, 0, 0, stair("east")],
      ]);
    });

    it("is one pair of stairs for a 2-wide span, on z", () => {
      expect(cellsOf([0, 0, 0], 2, OAK, { axis: "z", profile: "pointed", slab: SLAB })).toEqual([
        [0, 0, 0, stair("north")],
        [0, 0, 1, stair("south")],
      ]);
    });

    it("accepts the rise it computes and refuses another, and needs a slab", () => {
      expect(
        cellsOf([0, 0, 0], 6, OAK, { axis: "x", profile: "pointed", slab: SLAB, rise: 3 }),
      ).toHaveLength(6);
      refuses(
        () =>
          shapes.arch([0, 0, 0], 6, OAK, { axis: "x", profile: "pointed", slab: SLAB, rise: 2 }),
        /closes at rise 3/,
      );
      refuses(
        () => shapes.arch([0, 0, 0], 4, OAK, { axis: "x", profile: "pointed" }),
        /requires a slab block/,
      );
    });
  });

  describe("validation", () => {
    it("refuses a stair block that carries facing", () => {
      refuses(
        () =>
          shapes.arch([0, 0, 0], 4, "minecraft:oak_stairs[facing=east]", {
            axis: "x",
            profile: "stepped",
          }),
        /computes 'facing'/,
      );
    });

    it("refuses a slab block that carries type", () => {
      refuses(
        () =>
          shapes.arch([0, 0, 0], 4, OAK, {
            axis: "x",
            profile: "segmental",
            slab: "minecraft:oak_slab[type=top]",
          }),
        /computes slab 'type'/,
      );
    });

    it("refuses bad widths, depths, axes and profiles", () => {
      const ok = { axis: "x", profile: "stepped" } as const;
      refuses(() => shapes.arch([0, 0, 0], 1, OAK, ok), /width must be an int >= 2/);
      refuses(() => shapes.arch([0, 0, 0], 2.5, OAK, ok), /width must be an int >= 2/);
      refuses(() => shapes.arch([0, 0, 0], 4, OAK, { ...ok, depth: 0 }), /depth must be an int/);
      refuses(() => shapes.arch([0, 0, 0], 4, OAK, { ...ok, axis: "y" as never }), /axis must be/);
      refuses(
        () => shapes.arch([0, 0, 0], 4, OAK, { ...ok, profile: "ogee" as never }),
        /profile must be one of/,
      );
      refuses(() => shapes.arch([0, 0] as never, 4, OAK, ok), /start must be 3 ints/);
    });
  });

  describe("determinism", () => {
    const palette = [OAK, "minecraft:birch_stairs", "minecraft:spruce_stairs"];
    const opts = { axis: "x", profile: "stepped", depth: 8 } as const;

    it("gives the same cells twice for the same seed", () => {
      const a = shapes.arch([0, 0, 0], 12, palette, { ...opts, seed: 4 }).cells();
      const b = shapes.arch([0, 0, 0], 12, palette, { ...opts, seed: 4 }).cells();
      expect(a).toEqual(b);
    });

    it("changes the picks with another seed, never the positions or facings", () => {
      const a = sortCells(
        shapes.arch([0, 0, 0], 12, palette, { ...opts, seed: 4 }).cells() as Cell[],
      );
      const b = sortCells(
        shapes.arch([0, 0, 0], 12, palette, { ...opts, seed: 5 }).cells() as Cell[],
      );
      expect(a).not.toEqual(b);
      expect(a.map((c) => c.slice(0, 3))).toEqual(b.map((c) => c.slice(0, 3)));
      const facing = (c: Cell) => c[3].match(/facing=(\w+)/)?.[1];
      expect(a.map(facing)).toEqual(b.map(facing));
    });
  });
});

describe("parapet", () => {
  const B = "minecraft:stone_bricks";
  const STAIR_B = "minecraft:stone_brick_stairs";
  type Cell = [number, number, number, string];

  const sortCells = (cells: Cell[]): Cell[] =>
    [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const cellsOf = (...args: Parameters<typeof shapes.parapet>): Cell[] =>
    sortCells(shapes.parapet(...args).cells() as Cell[]);
  const column = (x: number, y: number, z: number, n = 1): Cell[] =>
    Array.from({ length: n }, (_, i): Cell => [x, y + i, z, B]);
  /** `[x, z]` pairs to cells at `y`. */
  const at = (y: number, ...xz: [number, number][]): Cell[] => xz.map(([x, z]) => [x, y, z, B]);

  describe("straight run", () => {
    it("alternates 1:1 from both ends, merlons at the ends", () => {
      expect(cellsOf([0, 5, 0], [6, 5, 0], B)).toEqual(
        sortCells([
          ...at(5, [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]),
          ...at(6, [0, 0], [2, 0], [4, 0], [6, 0]),
        ]),
      );
    });

    it("takes the corners in any order and runs along z the same way", () => {
      const a = cellsOf([0, 5, 6], [0, 5, 0], B);
      expect(a).toEqual(
        sortCells([
          ...at(5, [0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]),
          ...at(6, [0, 0], [0, 2], [0, 4], [0, 6]),
        ]),
      );
    });

    it("uses the lower y of the two corners as the start", () => {
      expect(cellsOf([0, 9, 0], [0, 5, 0], B)).toEqual([
        [0, 5, 0, B],
        [0, 6, 0, B],
      ]);
    });

    it("is one merlon on a 1x1 footprint", () => {
      expect(cellsOf([3, 0, 3], [3, 0, 3], B)).toEqual(column(3, 0, 3, 2));
    });

    it("lays a 2:1 rhythm symmetrically, one wider crenel left in the middle", () => {
      // 8 cells: distance from the nearer end 0 1 2 3 3 2 1 0, period 3, merlon width 2
      expect(
        cellsOf([0, 0, 0], [7, 0, 0], B, { merlon: 2, crenel: 1 })
          .filter((c) => c[1] === 1)
          .map((c) => c[0]),
      ).toEqual([0, 1, 3, 4, 6, 7]);
    });

    it("widens crenels", () => {
      // 9 cells: distances 0 1 2 3 4 3 2 1 0, period 3, merlon 1: merlons at d = 0 and 3
      expect(
        cellsOf([0, 0, 0], [8, 0, 0], B, { merlon: 1, crenel: 2 })
          .filter((c) => c[1] === 1)
          .map((c) => c[0]),
      ).toEqual([0, 3, 5, 8]);
    });

    it("honours height and base", () => {
      const cells = cellsOf([0, 0, 0], [2, 0, 0], B, { height: 2, base: 2 });
      expect(cells.filter((c) => c[0] === 0).map((c) => c[1])).toEqual([0, 1, 2, 3]);
      expect(cells.filter((c) => c[0] === 1).map((c) => c[1])).toEqual([0, 1]);
      expect(cells.filter((c) => c[0] === 2).map((c) => c[1])).toEqual([0, 1, 2, 3]);
    });

    it("allows a base of 0, leaving only the merlons", () => {
      expect(cellsOf([0, 4, 0], [4, 4, 0], B, { base: 0 })).toEqual(
        sortCells(at(4, [0, 0], [2, 0], [4, 0])),
      );
    });
  });

  describe("ring", () => {
    it("runs the rhythm along each side with the corners always merlons", () => {
      // 5 x 4 footprint: top and bottom sides read M . M . M; the 2-cell side runs between corners
      const cells = cellsOf([0, 0, 0], [4, 0, 3], B);
      const base = cells.filter((c) => c[1] === 0);
      expect(base).toHaveLength(14);
      expect(cells.filter((c) => c[1] === 1)).toEqual(
        sortCells(at(1, [0, 0], [2, 0], [4, 0], [0, 3], [2, 3], [4, 3])),
      );
    });

    it("has no cell inside the ring", () => {
      const cells = cellsOf([0, 0, 0], [4, 0, 4], B);
      expect(cells.some((c) => c[0] > 0 && c[0] < 4 && c[2] > 0 && c[2] < 4)).toBe(false);
    });

    it("keeps a 2-wide footprint solid (all ring) and still pairs the corners", () => {
      const cells = cellsOf([0, 0, 0], [1, 0, 1], B);
      expect(cells.filter((c) => c[1] === 0)).toHaveLength(4);
      expect(cells.filter((c) => c[1] === 1)).toHaveLength(4);
    });
  });

  describe("corbel", () => {
    const corbelCells = cellsOf([0, 5, 0], [2, 5, 2], B, { corbel: STAIR_B });
    const stairs = corbelCells.filter((c) => c[1] === 4);
    const stair = (facing: string): string => `${STAIR_B}[facing=${facing},half=top]`;

    it("grows the ring by 1 and carries it on a ring of stairs one row down", () => {
      expect(corbelCells.filter((c) => c[1] === 5)).toHaveLength(16);
      expect(stairs).toHaveLength(16);
      for (const [x, , z] of stairs) {
        expect(Math.max(Math.abs(x - 1), Math.abs(z - 1))).toBe(2);
      }
    });

    it("sets merlons on the grown outline: corners and side middles", () => {
      expect(corbelCells.filter((c) => c[1] === 6)).toEqual(
        sortCells(at(6, [-1, -1], [1, -1], [3, -1], [-1, 1], [3, 1], [-1, 3], [1, 3], [3, 3])),
      );
    });

    it("points every stair back at the wall, upside-down, corners along X", () => {
      const byCell = new Map(stairs.map((c) => [`${c[0]},${c[2]}`, c[3]]));
      expect(byCell.get("1,-1")).toBe(stair("south"));
      expect(byCell.get("1,3")).toBe(stair("north"));
      expect(byCell.get("-1,1")).toBe(stair("east"));
      expect(byCell.get("3,1")).toBe(stair("west"));
      expect(byCell.get("-1,-1")).toBe(stair("east"));
      expect(byCell.get("3,3")).toBe(stair("west"));
    });

    it("leaves the footprint outline and inside empty", () => {
      expect(corbelCells.some((c) => c[0] >= 0 && c[0] <= 2 && c[2] >= 0 && c[2] <= 2)).toBe(false);
    });

    it("keeps other block properties on the stair", () => {
      const wet = cellsOf([0, 0, 0], [1, 0, 1], B, { corbel: `${STAIR_B}[waterlogged=true]` });
      expect(wet.find((c) => c[1] === -1)?.[3]).toBe(
        `${STAIR_B}[facing=east,half=top,waterlogged=true]`,
      );
    });
  });

  describe("validation", () => {
    it("refuses a corbel stair with facing", () => {
      refuses(
        () => shapes.parapet([0, 0, 0], [4, 0, 4], B, { corbel: `${STAIR_B}[facing=north]` }),
        /computes 'facing'/,
      );
    });

    it("refuses a corbel on a straight run", () => {
      refuses(() => shapes.parapet([0, 0, 0], [5, 0, 0], B, { corbel: STAIR_B }), /at least 2 x 2/);
      refuses(() => shapes.parapet([0, 0, 0], [0, 0, 5], B, { corbel: STAIR_B }), /at least 2 x 2/);
    });

    it("refuses bad sizes and points", () => {
      refuses(
        () => shapes.parapet([0, 0, 0], [4, 0, 4], B, { merlon: 0 }),
        /merlon must be an int >= 1/,
      );
      refuses(
        () => shapes.parapet([0, 0, 0], [4, 0, 4], B, { crenel: 0 }),
        /crenel must be an int >= 1/,
      );
      refuses(
        () => shapes.parapet([0, 0, 0], [4, 0, 4], B, { height: 0 }),
        /height must be an int >= 1/,
      );
      refuses(
        () => shapes.parapet([0, 0, 0], [4, 0, 4], B, { base: -1 }),
        /base must be an int >= 0/,
      );
      refuses(
        () => shapes.parapet([0, 0, 0], [4, 0, 4], B, { merlon: 1.5 }),
        /merlon must be an int/,
      );
      refuses(
        () => shapes.parapet([0, 0] as never, [4, 0, 4], B, {}),
        /parapet: c1 must be 3 ints/,
      );
    });
  });

  describe("determinism", () => {
    const palette = [B, "minecraft:mossy_stone_bricks", "minecraft:cracked_stone_bricks"];
    const corbel = [STAIR_B, "minecraft:mossy_stone_brick_stairs"];

    it("gives the same cells twice for the same seed", () => {
      const run = () =>
        shapes.parapet([0, 0, 0], [12, 0, 12], palette, { corbel, seed: 9, height: 2 }).cells();
      expect(run()).toEqual(run());
    });

    it("changes the picks, not the positions, with another seed", () => {
      const run = (seed: number) =>
        sortCells(
          shapes
            .parapet([0, 0, 0], [12, 0, 12], palette, { corbel, seed, height: 2 })
            .cells() as Cell[],
        );
      const [a, b] = [run(1), run(2)];
      expect(a).not.toEqual(b);
      expect(a.map((c) => c.slice(0, 3))).toEqual(b.map((c) => c.slice(0, 3)));
    });
  });
});

describe("skirtRoof", () => {
  const P = "minecraft:spruce_planks";
  const SLAB = "minecraft:spruce_slab";
  type Cell = [number, number, number, string];

  const sortCells = (cells: Cell[]): Cell[] =>
    [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const cellsOf = (...args: Parameters<typeof shapes.skirtRoof>): Cell[] =>
    sortCells(shapes.skirtRoof(...args).cells() as Cell[]);
  const slab = (type: string): string => `${SLAB}[type=${type}]`;
  const at = (y: number, ...xz: [number, number][]): Cell[] => xz.map(([x, z]) => [x, y, z, P]);
  /** The 8 cells of the ring around the origin, as [x, z]. */
  const around: [number, number][] = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];

  it("rings a 1x1 footprint with a rim and stacks the centre one terrace high (no dentil)", () => {
    expect(cellsOf([0, 4, 0], [0, 4, 0], P, { overhang: 1, courses: 1, dentil: null })).toEqual(
      sortCells([...at(4, ...around), ...at(4, [0, 0]), ...at(5, [0, 0])]),
    );
  });

  it("starts at the lower y of the two corners and takes the corners in any order", () => {
    const a = cellsOf([0, 9, 0], [2, 4, 2], P, { overhang: 1, dentil: null });
    const b = cellsOf([2, 4, 2], [0, 9, 0], P, { overhang: 1, dentil: null });
    expect(a).toEqual(b);
    expect(Math.min(...a.map((c) => c[1]))).toBe(4);
  });

  it("puts the dentil row under the rim: blocks on even distances from a corner", () => {
    // 5 x 5 skirt (3 x 3 footprint, overhang 1): ring 0 side reads D . D . D
    const cells = cellsOf([0, 5, 0], [2, 5, 2], P, { overhang: 1, courses: 1 });
    expect(
      cells.filter((c) => c[1] === 5 && (c[0] === -1 || c[0] === 3 || c[2] === -1 || c[2] === 3)),
    ).toEqual(
      sortCells(at(5, [-1, -1], [-1, 1], [-1, 3], [1, -1], [1, 3], [3, -1], [3, 1], [3, 3])),
    );
    // the rim is a full ring one row above, and the interior starts at y with the underside
    expect(
      cells.filter((c) => c[1] === 6 && (c[0] === -1 || c[0] === 3 || c[2] === -1 || c[2] === 3)),
    ).toHaveLength(16);
    expect(cells).toHaveLength(8 + 16 + 9 + 18);
  });

  it("reads block, hole, block, hole on a face of 11: 6 blocks and 5 holes (alixxa f_017)", () => {
    const cells = cellsOf([0, 0, 0], [6, 0, 6], P);
    const front = cells.filter((c) => c[1] === 0 && c[2] === -2).map((c) => c[0]);
    expect(front).toEqual([-2, 0, 2, 4, 6, 8]);
  });

  it("makes terraces half a block high with a slab", () => {
    // 3 x 3 footprint, overhang 1, courses 2, no dentil: ring 1 is level 1, the centre level 2
    const cells = cellsOf([0, 0, 0], [2, 0, 2], P, {
      overhang: 1,
      courses: 2,
      dentil: null,
      slab: SLAB,
    });
    const ring1 = cells.filter((c) => c[0] === 0 && c[2] === 0);
    expect(ring1).toEqual([
      [0, 0, 0, P],
      [0, 1, 0, slab("bottom")],
    ]);
    const centre = cells.filter((c) => c[0] === 1 && c[2] === 1);
    expect(centre).toEqual([
      [1, 0, 1, P],
      [1, 1, 1, P],
    ]);
    expect(
      cells.filter((c) => c[1] === 0 && (c[0] === -1 || c[2] === -1)).every((c) => c[3] === P),
    ).toBe(true);
  });

  it("caps a flat brim at the rim row with courses 0", () => {
    const cells = cellsOf([0, 0, 0], [2, 0, 2], P, { overhang: 1, courses: 0, dentil: null });
    expect(cells).toHaveLength(25);
    expect(new Set(cells.map((c) => c[1]))).toEqual(new Set([0]));
  });

  it("leaves the hole open for the upper stage", () => {
    const cells = cellsOf([0, 0, 0], [4, 0, 4], P, {
      overhang: 1,
      dentil: null,
      hole: [
        [1, 99, 1],
        [3, -4, 3],
      ],
    });
    expect(cells.filter((c) => c[0] >= 1 && c[0] <= 3 && c[2] >= 1 && c[2] <= 3)).toEqual([]);
    // rim ring 24 + ring 1 (the 5 x 5 outline) 16, each 1 high at level min(1, 2)=1: rim 1, ring 1 two
    expect(cells).toHaveLength(24 + 16 * 2);
  });

  it("uses the rim and dentil materials where given", () => {
    const cells = cellsOf([0, 0, 0], [2, 0, 2], P, {
      overhang: 1,
      rim: "minecraft:dark_oak_planks",
      dentil: "minecraft:oak_planks",
    });
    expect(cells.find((c) => c[0] === -1 && c[1] === 1 && c[2] === 0)?.[3]).toBe(
      "minecraft:dark_oak_planks",
    );
    expect(cells.find((c) => c[0] === -1 && c[1] === 0 && c[2] === -1)?.[3]).toBe(
      "minecraft:oak_planks",
    );
    expect(cells.find((c) => c[0] === 0 && c[1] === 0 && c[2] === 0)?.[3]).toBe(P);
  });

  describe("validation", () => {
    it("refuses a slab that carries type", () => {
      refuses(
        () =>
          shapes.skirtRoof([0, 0, 0], [4, 0, 4], P, { slab: "minecraft:spruce_slab[type=top]" }),
        /computes slab 'type'/,
      );
    });

    it("refuses bad sizes, a bad hole and a bad point", () => {
      refuses(
        () => shapes.skirtRoof([0, 0, 0], [4, 0, 4], P, { overhang: 0 }),
        /overhang must be an int >= 1/,
      );
      refuses(
        () => shapes.skirtRoof([0, 0, 0], [4, 0, 4], P, { courses: -1 }),
        /courses must be an int >= 0/,
      );
      refuses(
        () =>
          shapes.skirtRoof([0, 0, 0], [4, 0, 4], P, {
            hole: [
              [1, 0, 1],
              [5, 0, 3],
            ],
          }),
        /must lie inside the footprint/,
      );
      refuses(
        () => shapes.skirtRoof([0, 0, 0], [4, 0, 4], P, { hole: [[1, 0, 1]] as never }),
        /two corner points/,
      );
      refuses(
        () => shapes.skirtRoof([0, 0] as never, [4, 0, 4], P, {}),
        /skirt_roof: c1 must be 3 ints/,
      );
    });
  });

  describe("determinism", () => {
    const palette = [P, "minecraft:oak_planks", "minecraft:birch_planks"];
    const run = (seed: number) =>
      sortCells(
        shapes
          .skirtRoof([0, 0, 0], [8, 0, 8], palette, { seed, slab: [SLAB, "minecraft:oak_slab"] })
          .cells() as Cell[],
      );

    it("gives the same cells twice for the same seed", () => {
      expect(run(7)).toEqual(run(7));
    });

    it("changes the picks, not the positions, with another seed", () => {
      expect(run(7)).not.toEqual(run(8));
      expect(run(7).map((c) => c.slice(0, 3))).toEqual(run(8).map((c) => c.slice(0, 3)));
    });
  });
});

describe("bayWall", () => {
  const P = "minecraft:oak_log[axis=y]";
  const I = "minecraft:white_terracotta";
  const BM = "minecraft:stripped_oak_log[axis=x]";
  const S = "minecraft:stone_bricks";
  type Cell = [number, number, number, string];

  const sortCells = (cells: Cell[]): Cell[] =>
    [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const cellsOf = (...args: Parameters<typeof shapes.bayWall>): Cell[] =>
    sortCells(shapes.bayWall(...args).cells() as Cell[]);
  /** Blocks at `x` in `0..n-1`, for a layer given as a row of `[x, block]`. */
  const row = (y: number, z: number, blocks: string[]): Cell[] =>
    blocks.map((b, x): Cell => [x, y, z, b]);

  describe("plain run", () => {
    it("stands posts at both ends and every period, infill between", () => {
      // n = 7, period 3: posts at 0, 3, 6
      expect(cellsOf([0, 0, 0], [6, 0, 0], I, { period: 3, post: P })).toEqual(
        row(0, 0, [P, I, I, P, I, I, P]),
      );
    });

    it("defaults post and infill to block", () => {
      const cells = cellsOf([0, 4, 0], [4, 5, 0], S, { period: 2 });
      expect(cells).toHaveLength(10);
      expect(new Set(cells.map((c) => c[3]))).toEqual(new Set([S]));
    });

    it("leaves bays open with infill null; beam and sill cross the whole run", () => {
      // hibouk-style P S P SS P S P is [2, 3, 2]; height 4: sill, 2 post rows, beam
      const SILL = "minecraft:smooth_stone";
      const BEAM = "minecraft:stone_brick_slab";
      const cells = cellsOf([0, 1, 0], [7, 4, 0], S, {
        period: [2, 3, 2],
        infill: null,
        sill: SILL,
        beam: BEAM,
      });
      const posts = [0, 2, 5, 7];
      expect(cells).toEqual(
        sortCells([
          ...row(1, 0, Array(8).fill(SILL)),
          ...posts.flatMap((x): Cell[] => [
            [x, 2, 0, S],
            [x, 3, 0, S],
          ]),
          ...row(4, 0, Array(8).fill(BEAM)),
        ]),
      );
    });

    it("runs along z when the footprint is thin in x, corners in any order", () => {
      const cells = cellsOf([2, 3, 4], [2, 3, 0], I, { period: 2, post: P });
      expect(cells).toEqual([P, I, P, I, P].map((b, z): Cell => [2, 3, z, b]));
    });

    it("takes a 2 x 1 footprint as a run of 2 posts", () => {
      expect(cellsOf([0, 0, 0], [1, 0, 0], I, { period: 1, post: P })).toEqual(row(0, 0, [P, P]));
    });

    it("lets a beam-only wall keep one post row", () => {
      expect(cellsOf([0, 0, 0], [2, 1, 0], I, { period: 2, post: P, beam: BM })).toEqual(
        sortCells([...row(0, 0, [P, I, P]), ...row(1, 0, [BM, BM, BM])]),
      );
    });
  });

  describe("inset", () => {
    it("fills the back layer with infill and puts only the frame in front, face south", () => {
      // run x = 0..2, depth z = 0 (back) and 1 (front, south), height 3 with beam
      const cells = cellsOf([0, 0, 0], [2, 2, 1], I, {
        period: 2,
        post: P,
        beam: BM,
        inset: true,
        face: "south",
      });
      expect(cells).toEqual(
        sortCells([
          ...[0, 1, 2].flatMap((y) => row(y, 0, [I, I, I])),
          ...row(0, 1, [P, ".", P]).filter((c) => c[3] !== "."),
          ...row(1, 1, [P, ".", P]).filter((c) => c[3] !== "."),
          ...row(2, 1, [BM, BM, BM]),
        ]),
      );
    });

    it("puts the front on the low side for face north", () => {
      const cells = cellsOf([0, 0, 0], [2, 0, 1], I, {
        period: 2,
        post: P,
        inset: true,
        face: "north",
      });
      expect(cells).toEqual(sortCells([...row(0, 1, [I, I, I]), [0, 0, 0, P], [2, 0, 0, P]]));
    });

    it("runs along z for face east, front on the high x side", () => {
      const cells = cellsOf([5, 0, 0], [6, 1, 2], I, {
        period: 2,
        post: P,
        sill: BM,
        inset: true,
        face: "east",
      });
      // height 2: sill row in front (x = 6), post row above it at z = 0 and 2
      expect(cells).toEqual(
        sortCells([
          ...[0, 1].flatMap((y) => [0, 1, 2].map((z): Cell => [5, y, z, I])),
          ...[0, 1, 2].map((z): Cell => [6, 0, z, BM]),
          [6, 1, 0, P],
          [6, 1, 2, P],
        ]),
      );
    });
  });

  describe("pilaster", () => {
    it("adds a proud post cell in front of each post, not over beam or sill rows", () => {
      // run x = 0..2, z = 0 back / 1 front (south); height 4: sill, 2 post rows, beam
      const SILL = "minecraft:polished_andesite";
      const cells = cellsOf([0, 0, 0], [2, 3, 1], I, {
        period: 2,
        post: S,
        sill: SILL,
        beam: BM,
        pilaster: true,
        face: "south",
      });
      expect(cells).toEqual(
        sortCells([
          ...row(0, 0, [SILL, SILL, SILL]),
          ...row(1, 0, [S, I, S]),
          ...row(2, 0, [S, I, S]),
          ...row(3, 0, [BM, BM, BM]),
          [0, 1, 1, S],
          [2, 1, 1, S],
          [0, 2, 1, S],
          [2, 2, 1, S],
        ]),
      );
    });

    it("leaves recessed bays open with infill null", () => {
      expect(
        cellsOf([0, 0, 0], [2, 0, 1], I, {
          period: 2,
          post: S,
          infill: null,
          pilaster: true,
          face: "south",
        }),
      ).toEqual(
        sortCells([
          [0, 0, 0, S],
          [2, 0, 0, S],
          [0, 0, 1, S],
          [2, 0, 1, S],
        ]),
      );
    });
  });

  describe("validation", () => {
    const wall = (opts: Partial<Parameters<typeof shapes.bayWall>[3]>) => () =>
      shapes.bayWall([0, 0, 0], [6, 3, 0], I, { period: 3, ...opts });

    it("requires period and checks it", () => {
      refuses(() => shapes.bayWall([0, 0, 0], [6, 0, 0], I, {} as never), /period is required/);
      refuses(wall({ period: 0 }), /period must be an int >= 1/);
      refuses(wall({ period: 1.5 }), /period must be an int/);
      refuses(wall({ period: [] }), /non-empty array/);
      refuses(wall({ period: [3, 0, 3] }), /period entry must be an int >= 1/);
    });

    it("refuses a period that does not fit the run", () => {
      refuses(wall({ period: 4 }), /period 4 does not fit a run of 7 cells/);
      refuses(wall({ period: [2, 2] }), /sum to 4 but the run of 7 cells needs 6/);
    });

    it("refuses footprints of the wrong shape", () => {
      refuses(
        () => shapes.bayWall([0, 0, 0], [4, 0, 4], I, { period: 2 }),
        /must be 1 thick in x or z/,
      );
      refuses(() => shapes.bayWall([0, 0, 0], [0, 4, 0], I, { period: 1 }), /1 x 1 footprint/);
      refuses(
        () => shapes.bayWall([0, 0, 0], [6, 0, 2], I, { period: 3, inset: true, face: "south" }),
        /2 thick across the run/,
      );
      refuses(
        () => shapes.bayWall([0, 0, 0], [6, 0, 0], I, { period: 3, pilaster: true, face: "south" }),
        /2 thick across the run/,
      );
      refuses(
        () => shapes.bayWall([0, 0] as never, [6, 0, 0], I, { period: 3 }),
        /bay_wall: c1 must be 3 ints/,
      );
    });

    it("refuses bad depth options", () => {
      const deep = { period: 3, inset: true } as const;
      const two = (o: Partial<Parameters<typeof shapes.bayWall>[3]>) => () =>
        shapes.bayWall([0, 0, 0], [6, 0, 1], I, { ...deep, ...o });
      refuses(two({}), /inset needs face/);
      refuses(two({ face: "east" }), /2 thick across the run/);
      refuses(two({ face: "up" as never }), /invalid direction/);
      refuses(two({ face: "south", pilaster: true }), /cannot be combined/);
      refuses(two({ face: "south", infill: null }), /inset needs an infill/);
      refuses(wall({ face: "up" as never }), /invalid direction/);
    });

    it("refuses a height with no row left for posts", () => {
      refuses(
        () => shapes.bayWall([0, 0, 0], [6, 1, 0], I, { period: 3, beam: BM, sill: BM }),
        /leaves no row/,
      );
      refuses(
        () => shapes.bayWall([0, 0, 0], [6, 0, 0], I, { period: 3, beam: BM }),
        /leaves no row/,
      );
    });
  });

  describe("determinism", () => {
    const palette = [S, "minecraft:mossy_stone_bricks", "minecraft:cracked_stone_bricks"];

    it("gives the same cells twice for the same seed", () => {
      const run = () =>
        shapes
          .bayWall([0, 0, 0], [20, 5, 0], palette, { period: 4, beam: palette, seed: 9 })
          .cells();
      expect(run()).toEqual(run());
    });

    it("changes the picks, not the positions, with another seed", () => {
      const run = (seed: number) =>
        cellsOf([0, 0, 0], [20, 5, 0], palette, { period: 4, beam: palette, seed });
      const [a, b] = [run(1), run(2)];
      expect(a).not.toEqual(b);
      expect(a.map((c) => c.slice(0, 3))).toEqual(b.map((c) => c.slice(0, 3)));
    });
  });
});

describe("roofGable endFill and ridgeCap", () => {
  const ST = "minecraft:spruce_stairs";
  const F = "minecraft:spruce_planks";
  const LOG = "minecraft:oak_log[axis=x]";
  const POST = "minecraft:oak_log[axis=y]";
  type Cell = [number, number, number, string];

  const sortCells = (cells: Cell[]): Cell[] =>
    [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const cellsOf = (...args: Parameters<typeof shapes.roofGable>): Cell[] =>
    sortCells(shapes.roofGable(...args).cells() as Cell[]);
  /** Cells present with the option but not in the plain roof; the plain cells must survive intact. */
  const added = (
    c1: [number, number, number],
    c2: [number, number, number],
    options: Parameters<typeof shapes.roofGable>[3],
  ): Cell[] => {
    const { ridge } = options;
    const plain = cellsOf(c1, c2, ST, { ridge });
    const withOption = cellsOf(c1, c2, ST, options);
    const key = (c: Cell) => c.slice(0, 3).join(",");
    const byKey = new Map(withOption.map((c) => [key(c), c]));
    for (const c of plain) expect(byKey.get(key(c))).toEqual(c);
    const had = new Set(plain.map(key));
    return withOption.filter((c) => !had.has(key(c)));
  };
  const f = (x: number, y: number, z: number): Cell => [x, y, z, F];

  describe("without the options", () => {
    const hash = (cells: unknown): string =>
      createHash("sha1").update(JSON.stringify(cells)).digest("hex");

    it("keeps the output of the plain roof exactly (hashes taken before the options existed)", () => {
      const cells = (...a: Parameters<typeof shapes.roofGable>) => shapes.roofGable(...a).cells();
      const g1 = cells([0, 4, 0], [8, 4, 5], ST, { ridge: "x" });
      const g2 = cells([-2, 3, 1], [4, 3, 6], ST, {
        ridge: "z",
        verge: "minecraft:cobblestone_stairs",
        eave: "minecraft:stone_brick_stairs",
      });
      const g3 = cells(
        [0, 0, 0],
        [6, 0, 6],
        [
          [ST, 2],
          ["minecraft:oak_stairs", 1],
        ],
        { ridge: "x", seed: 7, verge: "minecraft:oak_stairs[half=top]" },
      );
      expect([hash(g1), g1.length]).toEqual(["b2839cdd030a9e04656915c58c37e331ef9430b5", 54]);
      expect([hash(g2), g2.length]).toEqual(["7a189f1645d7a2d49eb296d8858fd7546a6d6245", 42]);
      expect([hash(g3), g3.length]).toEqual(["edcd7e388a94e7cad4655128f2f728b7edaf5578", 49]);
    });

    it("treats undefined and null options like no options", () => {
      const plain = shapes.roofGable([0, 0, 0], [4, 0, 4], ST, { ridge: "x" }).cells();
      const nulls = shapes
        .roofGable([0, 0, 0], [4, 0, 4], ST, { ridge: "x", endFill: null, ridgeCap: null })
        .cells();
      const unset = shapes
        .roofGable([0, 0, 0], [4, 0, 4], ST, {
          ridge: "x",
          endFill: undefined,
          ridgeCap: undefined,
        })
        .cells();
      expect(nulls).toEqual(plain);
      expect(unset).toEqual(plain);
    });
  });

  describe("endFill", () => {
    it("fills the triangle under the stairs at both ends, odd span, ridge x", () => {
      // x 0..2, z 0..4: stairs at (z0,z4) row 0, (z1,z3) row 1, apex z2 row 2.
      // Row 0 fill z1..3, row 1 fill z2, at x = 0 and x = 2. None at x = 1.
      expect(added([0, 0, 0], [2, 0, 4], { ridge: "x", endFill: F })).toEqual(
        sortCells([
          ...[0, 2].flatMap((x): Cell[] => [f(x, 0, 1), f(x, 0, 2), f(x, 0, 3), f(x, 1, 2)]),
        ]),
      );
    });

    it("leaves nothing at the top for an even span, ridge x", () => {
      // z 0..3: row 0 stairs z0, z3; row 1 stairs z1, z2 adjacent. Fill row 0 z1..2 only.
      expect(added([0, 2, 0], [3, 2, 3], { ridge: "x", endFill: F })).toEqual(
        sortCells([...[0, 3].flatMap((x): Cell[] => [f(x, 2, 1), f(x, 2, 2)])]),
      );
    });

    it("works along z and sits in the base row of an elevated roof", () => {
      // x 0..4, z 0..2, base y = 7: fill at z = 0 and z = 2, x 1..3 at y7, x 2 at y8.
      expect(added([0, 7, 0], [4, 7, 2], { ridge: "z", endFill: F })).toEqual(
        sortCells([
          ...[0, 2].flatMap((z): Cell[] => [f(1, 7, z), f(2, 7, z), f(3, 7, z), f(2, 8, z)]),
        ]),
      );
    });

    it("sits in the verge columns and leaves the verge stairs as they were", () => {
      const V = "minecraft:cobblestone_stairs";
      const cells = cellsOf([0, 0, 0], [3, 0, 4], ST, { ridge: "x", verge: V, endFill: F });
      const byKey = new Map(cells.map((c) => [c.slice(0, 3).join(","), c[3]]));
      expect(byKey.get("0,0,0")).toBe(`${V}[facing=south,half=bottom]`);
      expect(byKey.get("0,0,2")).toBe(F);
      expect(byKey.get("3,1,2")).toBe(F);
      // x = 1, 2 is the open roof: no fill there
      expect(byKey.has("1,0,2")).toBe(false);
    });

    it("adds nothing for spans of 1 and 2", () => {
      expect(added([0, 0, 0], [3, 0, 0], { ridge: "x", endFill: F })).toEqual([]);
      expect(added([0, 0, 0], [3, 0, 1], { ridge: "x", endFill: F })).toEqual([]);
    });

    it("accepts any full-block material, including a palette", () => {
      const palette = [F, "minecraft:birch_planks"];
      const cells = added([0, 0, 0], [2, 0, 6], { ridge: "x", endFill: palette, seed: 1 });
      expect(cells.length).toBeGreaterThan(0);
      expect(cells.every((c) => palette.includes(c[3]))).toBe(true);
    });
  });

  describe("ridgeCap", () => {
    const SLAB = "minecraft:oak_slab[type=top]";
    /** Cells the cap adds or changes: posts are rooted in the ridge row, replacing roof cells there. */
    const changed = (
      c1: [number, number, number],
      c2: [number, number, number],
      options: Parameters<typeof shapes.roofGable>[3],
    ): Cell[] => {
      const key = (c: Cell) => c.join("|");
      const plain = new Set(cellsOf(c1, c2, ST, { ridge: options.ridge }).map(key));
      return cellsOf(c1, c2, ST, options).filter((c) => !plain.has(key(c)));
    };

    it("stands posts at both ends and every 3rd cell with a rail between, odd span", () => {
      // x 0..7 (n = 8), z 0..4: top stair row 2 at z2 (y2). Posts rooted in that row, y2..y4, at
      // x 0,3,6,7; rail at y4 (the top post row) on x 1,2,4,5. Nothing at y3 between posts.
      const out = changed([0, 0, 0], [7, 0, 4], {
        ridge: "x",
        ridgeCap: { post: POST, rail: SLAB, height: 2 },
      });
      const posts = [0, 3, 6, 7].flatMap((x): Cell[] => [
        [x, 2, 2, POST],
        [x, 3, 2, POST],
        [x, 4, 2, POST],
      ]);
      const rail = [1, 2, 4, 5].map((x): Cell => [x, 4, 2, SLAB]);
      expect(out).toEqual(sortCells([...posts, ...rail]));
    });

    it("honours every and height, with the last gap shorter", () => {
      // x 0..6, z 0..2 (apex row 1 at z1, y1), every 4, height 3: posts y1..y4 at x 0,4,6;
      // rail at y4 on x 1,2,3,5.
      const out = changed([0, 0, 0], [6, 0, 2], {
        ridge: "x",
        ridgeCap: { post: POST, rail: LOG, every: 4, height: 3 },
      });
      const posts = [0, 4, 6].flatMap((x): Cell[] =>
        [1, 2, 3, 4].map((y): Cell => [x, y, 1, POST]),
      );
      const rail = [1, 2, 3, 5].map((x): Cell => [x, 4, 1, LOG]);
      expect(out).toEqual(sortCells([...posts, ...rail]));
    });

    it("uses one column, the lower across coordinate, for an even span", () => {
      // z 0..3: top row 1 stairs at z1 and z2 (y1); cap on z1 only: posts y1..y3 at x 0,2,4, rail y3 at x 1,3.
      const out = changed([0, 0, 0], [4, 0, 3], {
        ridge: "x",
        ridgeCap: { post: POST, rail: SLAB, every: 2, height: 2 },
      });
      const posts = [0, 2, 4].flatMap((x): Cell[] => [
        [x, 1, 1, POST],
        [x, 2, 1, POST],
        [x, 3, 1, POST],
      ]);
      const rail = [1, 3].map((x): Cell => [x, 3, 1, SLAB]);
      expect(out).toEqual(sortCells([...posts, ...rail]));
    });

    it("uses x, not z, as the lower column for an even span with ridge z", () => {
      // x 2..5, z 0..2: top row 1 stairs at x3 and x4; cap on x3: posts y1..y3 at z 0,2; rail y3 at z1.
      const out = changed([2, 0, 0], [5, 0, 2], {
        ridge: "z",
        ridgeCap: { post: POST, rail: SLAB, height: 2 },
      });
      expect(out).toEqual(
        sortCells([
          [3, 1, 0, POST],
          [3, 2, 0, POST],
          [3, 3, 0, POST],
          [3, 3, 1, SLAB],
          [3, 1, 2, POST],
          [3, 2, 2, POST],
          [3, 3, 2, POST],
        ]),
      );
    });

    it("runs along z, on an elevated roof", () => {
      // x 0..2, z 0..4, ridge z, base y 5: apex x1 row 1 (y6); posts y6..y8 at z 0,3,4; rail y8 at z 1,2.
      const out = changed([0, 5, 0], [2, 5, 4], {
        ridge: "z",
        ridgeCap: { post: POST, rail: SLAB, height: 2 },
      });
      const posts = [0, 3, 4].flatMap((z): Cell[] => [
        [1, 6, z, POST],
        [1, 7, z, POST],
        [1, 8, z, POST],
      ]);
      const rail = [1, 2].map((z): Cell => [1, 8, z, SLAB]);
      expect(out).toEqual(sortCells([...posts, ...rail]));
    });

    it("leaves posts alone with rail null or omitted", () => {
      const posts = [0, 3, 4].flatMap((z): Cell[] => [
        [1, 6, z, POST],
        [1, 7, z, POST],
        [1, 8, z, POST],
      ]);
      for (const ridgeCap of [
        { post: POST, rail: null, height: 2 },
        { post: POST, height: 2 },
      ]) {
        expect(changed([0, 5, 0], [2, 5, 4], { ridge: "z", ridgeCap })).toEqual(sortCells(posts));
      }
    });

    it("makes a low fence with height 1: posts and rail share the row above the ridge", () => {
      // x 0..3, z 0..0: span 1, top row 0 (y0); posts y0..y1, rail at y1.
      const out = changed([0, 0, 0], [3, 0, 0], {
        ridge: "x",
        ridgeCap: { post: POST, rail: SLAB, every: 2, height: 1 },
      });
      expect(out).toEqual([
        [0, 0, 0, POST],
        [0, 1, 0, POST],
        [1, 1, 0, SLAB],
        [2, 0, 0, POST],
        [2, 1, 0, POST],
        [3, 0, 0, POST],
        [3, 1, 0, POST],
      ]);
    });

    it("defaults to height 1: posts one row above the ridge, rail in that row", () => {
      const out = changed([0, 0, 0], [3, 0, 2], {
        ridge: "x",
        ridgeCap: { post: POST, rail: SLAB },
      });
      // apex z1 row 1 (y1): posts y1..y2 at x 0 and 3, rail y2 at x 1, 2.
      expect(out).toEqual(
        sortCells([
          [0, 1, 1, POST],
          [0, 2, 1, POST],
          [1, 2, 1, SLAB],
          [2, 2, 1, SLAB],
          [3, 1, 1, POST],
          [3, 2, 1, POST],
        ]),
      );
    });

    it("never overshoots the gable ends: nothing outside the roof's run", () => {
      const out = changed([2, 0, 2], [9, 0, 6], {
        ridge: "x",
        ridgeCap: { post: POST, rail: SLAB, height: 2 },
      });
      expect(Math.min(...out.map((c) => c[0]))).toBe(2);
      expect(Math.max(...out.map((c) => c[0]))).toBe(9);
    });

    it("combines with endFill without overlapping it", () => {
      const both = cellsOf([0, 0, 0], [4, 0, 4], ST, {
        ridge: "x",
        endFill: F,
        ridgeCap: { post: POST, rail: SLAB, height: 2 },
      });
      const fillOnly = cellsOf([0, 0, 0], [4, 0, 4], ST, { ridge: "x", endFill: F });
      const capOnly = cellsOf([0, 0, 0], [4, 0, 4], ST, {
        ridge: "x",
        ridgeCap: { post: POST, rail: SLAB, height: 2 },
      });
      expect(both).toHaveLength(
        fillOnly.length + capOnly.length - cellsOf([0, 0, 0], [4, 0, 4], ST, { ridge: "x" }).length,
      );
    });
  });

  describe("validation", () => {
    const roof = (o: Partial<Parameters<typeof shapes.roofGable>[3]>) => () =>
      shapes.roofGable([0, 0, 0], [4, 0, 4], ST, { ridge: "x", ...o });

    it("checks ridgeCap", () => {
      refuses(roof({ ridgeCap: LOG as never }), /ridgeCap must be an object with a post/);
      refuses(roof({ ridgeCap: {} as never }), /ridgeCap must be an object with a post/);
      refuses(roof({ ridgeCap: { post: POST, every: 0 } }), /ridgeCap.every must be an int >= 1/);
      refuses(roof({ ridgeCap: { post: POST, every: 1.5 } }), /ridgeCap.every must be an int/);
      refuses(roof({ ridgeCap: { post: POST, height: 0 } }), /ridgeCap.height must be an int >= 1/);
    });

    it("still refuses a stair with facing and a bad ridge", () => {
      refuses(
        roof({ endFill: F, verge: "minecraft:oak_stairs[facing=east]" }),
        /computes 'facing'/,
      );
      refuses(roof({ ridge: "y" as never, endFill: F }), /ridge must be 'x' or 'z'/);
    });
  });

  describe("determinism", () => {
    const palette = [F, "minecraft:birch_planks", "minecraft:oak_planks"];
    const opts = (seed: number) =>
      ({
        ridge: "x",
        endFill: palette,
        ridgeCap: { post: palette, rail: palette },
        seed,
      }) as const;

    it("gives the same cells twice for the same seed", () => {
      const run = () => shapes.roofGable([0, 0, 0], [20, 0, 10], ST, opts(5)).cells();
      expect(run()).toEqual(run());
    });

    it("changes the picks, not the positions, with another seed", () => {
      const [a, b] = [1, 2].map((s) => cellsOf([0, 0, 0], [20, 0, 10], ST, opts(s)));
      expect(a).not.toEqual(b);
      expect(a?.map((c) => c.slice(0, 3))).toEqual(b?.map((c) => c.slice(0, 3)));
    });
  });
});

describe("polygon", () => {
  const S = "minecraft:stone_bricks";
  const PL = "minecraft:spruce_planks";
  type Cell = [number, number, number, string];
  type V = [number, number][];
  type Geo = ReturnType<typeof shapes.polygon>;

  const sortCells = (cells: Cell[]): Cell[] =>
    [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const cellsOf = (g: Geo): Cell[] => sortCells(g.cells() as Cell[]);
  /** `x,y,z` triples of a Geometry, sorted. */
  const keys = (g: Geo): number[][] => cellsOf(g).map((c) => [c[0], c[1], c[2]]);
  /** Plan rows at one y, top row is z = 0, `#` where a cell exists. */
  const plan = (g: Geo, y: number, w: number, d: number): string[] => {
    const set = new Set(
      cellsOf(g)
        .filter((c) => c[1] === y)
        .map((c) => `${c[0]},${c[2]}`),
    );
    return Array.from({ length: d }, (_, z) =>
      Array.from({ length: w }, (_, x) => (set.has(`${x},${z}`) ? "#" : ".")).join(""),
    );
  };
  const refuses = (fn: () => unknown, pattern: RegExp) => {
    expect(fn).toThrow(VoxmcError);
    expect(fn).toThrow(pattern);
  };

  const RECT: V = [
    [0, 0],
    [6, 0],
    [6, 4],
    [0, 4],
  ];
  const L: V = [
    [0, 0],
    [5, 0],
    [5, 2],
    [2, 2],
    [2, 4],
    [0, 4],
  ];
  const T: V = [
    [0, 0],
    [6, 0],
    [6, 1],
    [4, 1],
    [4, 4],
    [2, 4],
    [2, 1],
    [0, 1],
  ];
  const CRUCIFORM: V = [
    [2, 0],
    [4, 0],
    [4, 2],
    [6, 2],
    [6, 4],
    [4, 4],
    [4, 6],
    [2, 6],
    [2, 4],
    [0, 4],
    [0, 2],
    [2, 2],
  ];
  // Dumbbell: two wings 5 wide, a neck x 5..7 only 3 rows deep, outline 13 x 5.
  const DUMBBELL: V = [
    [0, 0],
    [4, 0],
    [4, 1],
    [8, 1],
    [8, 0],
    [12, 0],
    [12, 4],
    [8, 4],
    [8, 3],
    [4, 3],
    [4, 4],
    [0, 4],
  ];

  describe("walls (default)", () => {
    it("has the exact cell set of the L outline, corners not doubled", () => {
      // Listed in x-major order, as `keys` sorts.
      expect(keys(shapes.polygon(L, 0, 0, S))).toEqual([
        [0, 0, 0],
        [0, 0, 1],
        [0, 0, 2],
        [0, 0, 3],
        [0, 0, 4],
        [1, 0, 0],
        [1, 0, 4],
        [2, 0, 0],
        [2, 0, 2],
        [2, 0, 3],
        [2, 0, 4],
        [3, 0, 0],
        [3, 0, 2],
        [4, 0, 0],
        [4, 0, 2],
        [5, 0, 0],
        [5, 0, 1],
        [5, 0, 2],
      ]);
    });

    it("repeats the ring at every y, in either y order", () => {
      const a = shapes.polygon(L, 1, 3, S);
      const b = shapes.polygon(L, 3, 1, S);
      expect(cellsOf(a)).toEqual(cellsOf(b));
      expect(a.cells()).toHaveLength(18 * 3);
      expect(new Set(cellsOf(a).map((c) => c[1]))).toEqual(new Set([1, 2, 3]));
      expect(cellsOf(a).every((c) => c[3] === S)).toBe(true);
    });

    it("leaves the notches of a T and a cruciform empty", () => {
      expect(plan(shapes.polygon(T, 0, 0, S), 0, 7, 5)).toEqual([
        "#######",
        "###.###",
        "..#.#..",
        "..#.#..",
        "..###..",
      ]);
      expect(plan(shapes.polygon(CRUCIFORM, 0, 0, S), 0, 7, 7)).toEqual([
        "..###..",
        "..#.#..",
        "###.###",
        "#.....#",
        "###.###",
        "..#.#..",
        "..###..",
      ]);
    });

    it("traces a dumbbell back wall of stepped segments", () => {
      expect(plan(shapes.polygon(DUMBBELL, 0, 0, S), 0, 13, 5)).toEqual([
        "#####...#####",
        "#...#####...#",
        "#...........#",
        "#...#####...#",
        "#####...#####",
      ]);
    });

    it("equals walls for a plain rectangle", () => {
      const rect: V = [
        [2, 1],
        [8, 1],
        [8, 6],
        [2, 6],
      ];
      expect(cellsOf(shapes.polygon(rect, 3, 6, S))).toEqual(
        sortCells(shapes.walls([2, 3, 1], [8, 6, 6], S).cells() as Cell[]),
      );
    });

    it("equals walls with a palette and seed, whatever the vertex order or start", () => {
      const palette = [S, "minecraft:cobblestone", "minecraft:andesite"];
      const ref = sortCells(
        shapes.walls([0, 0, 0], [6, 2, 4], palette, { seed: 7 }).cells() as Cell[],
      );
      const order = (v: V) => cellsOf(shapes.polygon(v, 0, 2, palette, { seed: 7 }));
      expect(order(RECT)).toEqual(ref);
      expect(
        order([
          [6, 4],
          [6, 0],
          [0, 0],
          [0, 4],
        ]),
      ).toEqual(ref);
      expect(
        order([
          [0, 4],
          [0, 0],
          [6, 0],
          [6, 4],
        ]),
      ).toEqual(ref);
    });

    it("allows a vertex in the middle of a straight edge", () => {
      const split: V = [
        [0, 0],
        [3, 0],
        [6, 0],
        [6, 4],
        [0, 4],
      ];
      expect(cellsOf(shapes.polygon(split, 0, 0, S))).toEqual(
        cellsOf(shapes.polygon(RECT, 0, 0, S)),
      );
    });
  });

  describe("solid", () => {
    it("fills an L shape at every y", () => {
      const g = shapes.polygon(L, 0, 1, PL, { mode: "solid" });
      for (const y of [0, 1]) {
        expect(plan(g, y, 6, 5)).toEqual(["######", "######", "######", "###...", "###..."]);
      }
      expect(g.cells()).toHaveLength(2 * (6 + 6 + 6 + 3 + 3));
    });

    it("fills a T and a cruciform without filling the notches", () => {
      expect(plan(shapes.polygon(T, 0, 0, PL, { mode: "solid" }), 0, 7, 5)).toEqual([
        "#######",
        "#######",
        "..###..",
        "..###..",
        "..###..",
      ]);
      expect(plan(shapes.polygon(CRUCIFORM, 0, 0, PL, { mode: "solid" }), 0, 7, 7)).toEqual([
        "..###..",
        "..###..",
        "#######",
        "#######",
        "#######",
        "..###..",
        "..###..",
      ]);
    });

    it("fills a dumbbell through its neck and keeps the end notches open", () => {
      expect(plan(shapes.polygon(DUMBBELL, 0, 0, PL, { mode: "solid" }), 0, 13, 5)).toEqual([
        "#####...#####",
        "#############",
        "#############",
        "#############",
        "#####...#####",
      ]);
    });

    it("fills a plain rectangle completely", () => {
      expect(shapes.polygon(RECT, 0, 0, PL, { mode: "solid" }).cells()).toHaveLength(7 * 5);
    });
  });

  describe("floor", () => {
    it("is outline plus interior at the single y", () => {
      const g = shapes.polygon(L, 5, 5, PL, { mode: "floor" });
      expect(plan(g, 5, 6, 5)).toEqual(["######", "######", "######", "###...", "###..."]);
      expect(new Set(cellsOf(g).map((c) => c[1]))).toEqual(new Set([5]));
      expect(cellsOf(g).every((c) => c[3] === PL)).toBe(true);
    });

    it("matches solid at that one layer", () => {
      expect(cellsOf(shapes.polygon(T, 2, 2, PL, { mode: "floor" }))).toEqual(
        cellsOf(shapes.polygon(T, 2, 2, PL, { mode: "solid" })),
      );
    });

    it("refuses a range of more than one layer", () => {
      refuses(() => shapes.polygon(L, 0, 1, PL, { mode: "floor" }), /mode floor is one layer/);
    });
  });

  describe("validation", () => {
    const poly =
      (v: unknown, extra: Record<string, unknown> = {}) =>
      () =>
        shapes.polygon(v as V, 0, 0, S, extra);

    it("refuses fewer than 4 vertices", () => {
      refuses(
        poly([
          [0, 0],
          [3, 0],
          [3, 3],
        ]),
        /at least 4/,
      );
      refuses(poly([]), /at least 4/);
      refuses(poly("nope"), /at least 4/);
    });

    it("refuses a diagonal edge", () => {
      refuses(
        poly([
          [0, 0],
          [4, 1],
          [4, 4],
          [0, 4],
        ]),
        /edge 0 .* is diagonal/,
      );
    });

    it("refuses a loop that does not close axis-aligned", () => {
      // last (0,3) to first (0,0) is fine; here last (1,3) to first (0,0) is diagonal
      refuses(
        poly([
          [0, 0],
          [4, 0],
          [4, 3],
          [1, 3],
        ]),
        /edge 3 .* is diagonal/,
      );
      // five vertices, closing edge diagonal
      refuses(
        poly([
          [0, 0],
          [4, 0],
          [4, 3],
          [2, 3],
          [1, 2],
        ]),
        /is diagonal/,
      );
    });

    it("refuses a zero-length edge", () => {
      refuses(
        poly([
          [0, 0],
          [4, 0],
          [4, 0],
          [4, 3],
          [0, 3],
        ]),
        /edge 1 .* zero length/,
      );
      refuses(
        poly([
          [0, 0],
          [4, 0],
          [4, 3],
          [0, 3],
          [0, 0],
        ]),
        /zero length/,
      );
    });

    it("refuses edges that cross", () => {
      // bow tie of two crossing strokes
      refuses(
        poly([
          [0, 0],
          [4, 0],
          [4, 4],
          [2, 4],
          [2, -2],
          [0, -2],
        ]),
        /revisits cell/,
      );
    });

    it("refuses edges that overlap or double back", () => {
      refuses(
        poly([
          [0, 0],
          [4, 0],
          [2, 0],
          [2, 3],
        ]),
        /revisits cell/,
      );
    });

    it("refuses edges that touch", () => {
      // the first and the third vertical edge meet at one cell
      refuses(
        poly([
          [0, 0],
          [6, 0],
          [6, 4],
          [3, 4],
          [3, 0],
          [2, 0],
          [2, 4],
          [0, 4],
        ]),
        /revisits cell/,
      );
    });

    it("refuses bad vertices, y values and modes", () => {
      refuses(
        poly([
          [0, 0],
          [4, 0, 1],
          [4, 3],
          [0, 3],
        ]),
        /vertex 1 must be \[x, z\] ints/,
      );
      refuses(
        poly([
          [0, 0],
          [4.5, 0],
          [4, 3],
          [0, 3],
        ]),
        /vertex 1 must be \[x, z\] ints/,
      );
      refuses(
        poly([
          [0, 0],
          ["a", 0],
          [4, 3],
          [0, 3],
        ]),
        /vertex 1 must be/,
      );
      refuses(() => shapes.polygon(RECT, 0.5, 1, S), /y1 and y2 must be ints/);
      refuses(poly(RECT, { mode: "roof" }), /invalid mode roof/);
    });
  });

  describe("determinism", () => {
    const palette = [S, "minecraft:cobblestone", "minecraft:andesite"];
    const run = (seed: number) => shapes.polygon(DUMBBELL, 0, 2, palette, { mode: "solid", seed });

    it("gives the same cells twice for the same seed", () => {
      expect(run(3).cells()).toEqual(run(3).cells());
    });

    it("changes the picks, not the positions, with another seed", () => {
      const [a, b] = [cellsOf(run(1)), cellsOf(run(2))];
      expect(a).not.toEqual(b);
      expect(a.map((c) => c.slice(0, 3))).toEqual(b.map((c) => c.slice(0, 3)));
    });

    it("does not depend on the vertex starting point", () => {
      const rotated = [...L.slice(2), ...L.slice(0, 2)];
      expect(cellsOf(shapes.polygon(rotated, 0, 1, palette, { mode: "solid", seed: 4 }))).toEqual(
        cellsOf(shapes.polygon(L, 0, 1, palette, { mode: "solid", seed: 4 })),
      );
    });
  });
});

describe("jetty", () => {
  const D = "minecraft:oak_planks";
  const STAIR_O = "minecraft:oak_stairs";
  const BEAM = "minecraft:stripped_oak_log";
  type Cell = [number, number, number, string];

  const sortCells = (cells: Cell[]): Cell[] =>
    [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const cellsOf = (...args: Parameters<typeof shapes.jetty>): Cell[] =>
    sortCells(shapes.jetty(...args).cells() as Cell[]);
  const stair = (facing: string): string => `${STAIR_O}[facing=${facing},half=top]`;
  const row = (cells: Cell[], y: number): Cell[] => cells.filter((c) => c[1] === y);
  const keys = (cells: Cell[]): string[] => cells.map((c) => `${c[0]},${c[2]}`);

  describe("deck", () => {
    it("is a 1-wide ring around a 3 x 3 footprint, corners included, nothing on the footprint", () => {
      const cells = cellsOf([0, 5, 0], [2, 5, 2], D);
      expect(cells).toHaveLength(16);
      expect(cells.every((c) => c[1] === 5 && c[3] === D)).toBe(true);
      expect(cells.some((c) => c[0] >= 0 && c[0] <= 2 && c[2] >= 0 && c[2] <= 2)).toBe(false);
      expect(cells.map((c) => Math.max(Math.abs(c[0] - 1), Math.abs(c[2] - 1)))).toEqual(
        cells.map(() => 2),
      );
    });

    it("takes the corners in any order and uses the lower y", () => {
      expect(cellsOf([2, 9, 2], [0, 5, 0], D)).toEqual(cellsOf([0, 5, 0], [2, 5, 2], D));
    });

    it("honours overhang 2, filling each corner as a 2 x 2 square", () => {
      const cells = cellsOf([0, 0, 0], [2, 0, 2], D, { overhang: 2 });
      // 7 x 7 grown shape less the 3 x 3 footprint
      expect(cells).toHaveLength(49 - 9);
      expect(keys(cells)).toContain("-2,-2");
      expect(keys(cells)).toContain("-1,-2");
      expect(keys(cells)).toContain("4,4");
    });

    it("projects on one side only, as wide as the footprint", () => {
      const cells = cellsOf([0, 5, 0], [3, 5, 2], D, { sides: ["north"] });
      expect(keys(cells)).toEqual(["0,-1", "1,-1", "2,-1", "3,-1"]);
    });

    it("projects on south only", () => {
      const cells = cellsOf([0, 5, 0], [1, 5, 2], D, { sides: ["south"], overhang: 2 });
      expect(keys(cells)).toEqual(["0,3", "0,4", "1,3", "1,4"]);
    });

    it("projects on east only", () => {
      expect(keys(cellsOf([0, 5, 0], [2, 5, 1], D, { sides: ["east"] }))).toEqual(["3,0", "3,1"]);
    });

    it("projects on west only", () => {
      expect(keys(cellsOf([0, 5, 0], [2, 5, 1], D, { sides: ["west"] }))).toEqual(["-1,0", "-1,1"]);
    });

    it("fills a corner only where both sides project", () => {
      const both = keys(cellsOf([0, 5, 0], [2, 5, 2], D, { sides: ["north", "west"] }));
      expect(both).toEqual(
        ["-1,-1", "-1,0", "-1,1", "-1,2", "0,-1", "1,-1", "2,-1"].sort((a, b) => {
          const [ax, az] = a.split(",").map(Number) as [number, number];
          const [bx, bz] = b.split(",").map(Number) as [number, number];
          return ax - bx || az - bz;
        }),
      );
      const opposite = keys(cellsOf([0, 5, 0], [2, 5, 2], D, { sides: ["north", "south"] }));
      expect(opposite).not.toContain("-1,-1");
      expect(opposite).toHaveLength(6);
    });

    it("accepts a 1 x 1 footprint", () => {
      expect(cellsOf([4, 0, 4], [4, 0, 4], D)).toHaveLength(8);
    });
  });

  describe("brackets", () => {
    // footprint 7 x 5: x 0..6, z 0..4, every 3
    const cells = cellsOf([0, 5, 0], [6, 5, 4], D, { bracket: STAIR_O });
    const brackets = row(cells, 4);
    const at = (x: number, z: number): string | undefined =>
      brackets.find((c) => c[0] === x && c[2] === z)?.[3];

    it("stands on the ring cells next to the wall, one row under the deck", () => {
      expect(row(cells, 5)).toHaveLength(9 * 7 - 7 * 5);
      expect(keys(brackets)).toEqual(
        keys(
          sortCells(
            [
              [0, 4, -1],
              [3, 4, -1],
              [6, 4, -1],
              [0, 4, 5],
              [3, 4, 5],
              [6, 4, 5],
              [-1, 4, 0],
              [-1, 4, 4],
              [7, 4, 0],
              [7, 4, 4],
            ].map(([x, y, z]) => [x as number, y as number, z as number, ""] as Cell),
          ),
        ),
      );
    });

    it("faces each stair toward the wall, upside-down", () => {
      expect(at(3, -1)).toBe(stair("south"));
      expect(at(3, 5)).toBe(stair("north"));
      expect(at(-1, 0)).toBe(stair("east"));
      expect(at(7, 0)).toBe(stair("west"));
      expect(brackets.every((c) => c[3].includes("half=top"))).toBe(true);
    });

    it("puts a bracket at both ends of every side and leaves the diagonal corner bare", () => {
      expect(at(0, -1)).toBe(stair("south"));
      expect(at(6, -1)).toBe(stair("south"));
      expect(at(-1, -1)).toBeUndefined();
      expect(at(7, 5)).toBeUndefined();
    });

    it("reads the same from both ends and widens the gap in the middle", () => {
      // 8 cells: d = 0 1 2 3 3 2 1 0 -> brackets at 0, 3, 4, 7 with every 3
      const wide = cellsOf([0, 0, 0], [7, 0, 0], D, { bracket: STAIR_O, sides: ["north"] });
      expect(row(wide, -1).map((c) => c[0])).toEqual([0, 3, 4, 7]);
    });

    it("honours every", () => {
      const dense = cellsOf([0, 0, 0], [4, 0, 0], D, {
        bracket: STAIR_O,
        sides: ["north"],
        every: 1,
      });
      expect(row(dense, -1).map((c) => c[0])).toEqual([0, 1, 2, 3, 4]);
      const sparse = cellsOf([0, 0, 0], [8, 0, 0], D, {
        bracket: STAIR_O,
        sides: ["north"],
        every: 4,
      });
      expect(row(sparse, -1).map((c) => c[0])).toEqual([0, 4, 8]);
    });

    it("keeps brackets next to the wall when the overhang is deeper", () => {
      const deep = cellsOf([0, 0, 0], [2, 0, 0], D, {
        bracket: STAIR_O,
        sides: ["north"],
        overhang: 2,
      });
      expect(keys(row(deep, -1))).toEqual(["0,-1", "2,-1"]);
      expect(row(deep, 0)).toHaveLength(6);
    });

    it("places brackets on chosen sides only", () => {
      const south = cellsOf([0, 5, 0], [2, 5, 2], D, { bracket: STAIR_O, sides: ["south"] });
      expect(row(south, 4).map((c) => c[3])).toEqual([stair("north"), stair("north")]);
      expect(keys(row(south, 4))).toEqual(["0,3", "2,3"]);
    });

    it("leaves a null or omitted bracket out", () => {
      expect(row(cellsOf([0, 5, 0], [6, 5, 4], D, { bracket: null }), 4)).toEqual([]);
      expect(row(cellsOf([0, 5, 0], [6, 5, 4], D), 4)).toEqual([]);
    });

    it("keeps other block properties on the stair", () => {
      const wet = cellsOf([0, 5, 0], [0, 5, 0], D, {
        bracket: `${STAIR_O}[waterlogged=true]`,
        sides: ["east"],
      });
      expect(row(wet, 4)[0]?.[3]).toBe(`${STAIR_O}[facing=west,half=top,waterlogged=true]`);
    });
  });

  describe("beam", () => {
    it("runs one row under the deck along the outer edge, wrapping the corners", () => {
      const cells = cellsOf([0, 5, 0], [2, 5, 2], D, { beam: BEAM, overhang: 2 });
      const beam = row(cells, 4);
      expect(beam.every((c) => c[3] === BEAM)).toBe(true);
      // outer ring of the 7 x 7 grown shape: 24 cells
      expect(beam).toHaveLength(24);
      expect(beam.every((c) => Math.max(Math.abs(c[0] - 1), Math.abs(c[2] - 1)) === 3)).toBe(true);
    });

    it("wins over a bracket on the same cell, so overhang 1 replaces the brackets", () => {
      const cells = cellsOf([0, 5, 0], [2, 5, 2], D, { beam: BEAM, bracket: STAIR_O });
      expect(row(cells, 4)).toHaveLength(16);
      expect(row(cells, 4).every((c) => c[3] === BEAM)).toBe(true);
    });

    it("sits beside the brackets when the overhang is 2", () => {
      const cells = cellsOf([0, 5, 0], [2, 5, 0], D, {
        beam: BEAM,
        bracket: STAIR_O,
        sides: ["north"],
        overhang: 2,
      });
      const under = row(cells, 4);
      expect(under.filter((c) => c[3] === BEAM).map((c) => [c[0], c[2]])).toEqual([
        [0, -2],
        [1, -2],
        [2, -2],
      ]);
      expect(under.filter((c) => c[3] === stair("south")).map((c) => [c[0], c[2]])).toEqual([
        [0, -1],
        [2, -1],
      ]);
    });

    it("follows only the chosen sides", () => {
      const cells = cellsOf([0, 5, 0], [2, 5, 2], D, { beam: BEAM, sides: ["north"] });
      expect(keys(row(cells, 4))).toEqual(["0,-1", "1,-1", "2,-1"]);
    });
  });

  describe("validation", () => {
    it("refuses a bracket stair with facing", () => {
      refuses(
        () => shapes.jetty([0, 0, 0], [3, 0, 3], D, { bracket: `${STAIR_O}[facing=north]` }),
        /computes 'facing'/,
      );
    });

    it("refuses a bad overhang or every", () => {
      refuses(() => shapes.jetty([0, 0, 0], [3, 0, 3], D, { overhang: 0 }), /jetty: overhang/);
      refuses(() => shapes.jetty([0, 0, 0], [3, 0, 3], D, { overhang: 1.5 }), /jetty: overhang/);
      refuses(() => shapes.jetty([0, 0, 0], [3, 0, 3], D, { every: 0 }), /jetty: every/);
    });

    it("refuses bad sides", () => {
      refuses(() => shapes.jetty([0, 0, 0], [3, 0, 3], D, { sides: [] }), /jetty: sides/);
      refuses(
        () => shapes.jetty([0, 0, 0], [3, 0, 3], D, { sides: "north" as never }),
        /jetty: sides/,
      );
      refuses(
        () => shapes.jetty([0, 0, 0], [3, 0, 3], D, { sides: ["up" as never] }),
        /jetty: sides: invalid direction/,
      );
    });

    it("refuses bad corners", () => {
      refuses(() => shapes.jetty([0, 0] as never, [3, 0, 3], D), /jetty: c1 must be 3 ints/);
      refuses(() => shapes.jetty([0, 0, 0], [3, 0.5, 3], D), /jetty: c2 coordinates must be ints/);
    });
  });

  describe("determinism", () => {
    const palette = [D, "minecraft:spruce_planks", "minecraft:birch_planks"];
    const stairs = [STAIR_O, "minecraft:spruce_stairs"];

    it("gives the same cells twice for the same seed", () => {
      const run = () =>
        shapes.jetty([0, 0, 0], [12, 0, 9], palette, { bracket: stairs, seed: 9 }).cells();
      expect(run()).toEqual(run());
    });

    it("changes the picks, not the positions, with another seed", () => {
      const run = (seed: number) =>
        cellsOf([0, 0, 0], [12, 0, 9], palette, { bracket: stairs, seed });
      const [a, b] = [run(1), run(2)];
      expect(a).not.toEqual(b);
      expect(a.map((c) => c.slice(0, 3))).toEqual(b.map((c) => c.slice(0, 3)));
    });
  });
});

describe("roofGable profile", () => {
  const ST = "minecraft:spruce_stairs";
  type Cell = [number, number, number, string];
  const sortCells = (cells: Cell[]): Cell[] =>
    [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const cellsOf = (...args: Parameters<typeof shapes.roofGable>): Cell[] =>
    sortCells(shapes.roofGable(...args).cells() as Cell[]);
  const blocks = (cells: Cell[]): Set<string> => new Set(cells.map((c) => c[3]));
  const stair = (facing: string) => `minecraft:spruce_stairs[facing=${facing},half=bottom]`;
  const slab = (type: string) => `minecraft:spruce_slab[type=${type}]`;
  const P = "minecraft:spruce_planks";
  const throws = (fn: () => unknown, re: RegExp): void => {
    expect(fn).toThrow(VoxmcError);
    expect(fn).toThrow(re);
  };

  it("leaves the roof unchanged with profile straight", () => {
    for (const [c1, c2, ridge] of [
      [[0, 0, 0], [5, 0, 6], "x"],
      [[0, 2, 0], [4, 2, 7], "z"],
    ] as const) {
      expect(cellsOf(c1, c2, ST, { ridge, profile: "straight" })).toEqual(
        cellsOf(c1, c2, ST, { ridge }),
      );
    }
  });

  it("lays slab columns half a block apart, alternating bottom and top slabs", () => {
    expect(cellsOf([0, 0, 0], [0, 0, 3], ST, { ridge: "x", profile: ["slab", "slab"] })).toEqual([
      [0, 0, 0, slab("bottom")],
      [0, 0, 1, slab("top")],
      [0, 0, 2, slab("top")],
      [0, 0, 3, slab("bottom")],
    ]);
  });

  it("stacks a stair on a full block for steep columns and caps an odd span with a slab", () => {
    expect(cellsOf([0, 0, 0], [0, 0, 4], ST, { ridge: "x", profile: "steep" })).toEqual([
      [0, 0, 0, P],
      [0, 0, 4, P],
      [0, 1, 0, stair("south")],
      [0, 1, 4, stair("north")],
      [0, 2, 1, P],
      [0, 2, 3, P],
      [0, 3, 1, stair("south")],
      [0, 3, 3, stair("north")],
      [0, 4, 2, slab("bottom")],
    ]);
  });

  it("puts a stair after slabs on a whole block (concave, ridge z)", () => {
    expect(
      cellsOf([0, 5, 0], [5, 5, 0], ST, { ridge: "z", profile: ["slab", "slab", "stair"] }),
    ).toEqual([
      [0, 5, 0, slab("bottom")],
      [1, 5, 0, slab("top")],
      [2, 6, 0, "minecraft:spruce_stairs[facing=east,half=bottom]"],
      [3, 6, 0, "minecraft:spruce_stairs[facing=west,half=bottom]"],
      [4, 5, 0, slab("top")],
      [5, 5, 0, slab("bottom")],
    ]);
  });

  it("expands the named profiles to one pitch per column", () => {
    const same = (profile: Parameters<typeof shapes.roofGable>[3]["profile"], pitches: string[]) =>
      expect(cellsOf([0, 0, 0], [1, 0, 2 * pitches.length], ST, { ridge: "x", profile })).toEqual(
        cellsOf([0, 0, 0], [1, 0, 2 * pitches.length], ST, {
          ridge: "x",
          profile: pitches as ("slab" | "stair" | "steep")[],
        }),
      );
    same("concave", ["slab", "slab", "stair", "stair", "steep"]);
    same("concave", ["slab", "slab", "stair", "steep"]);
    same("concave", ["slab", "slab", "slab", "slab", "stair", "steep"]);
    same("gambrel", ["steep", "steep", "stair", "stair"]);
    same("gambrel", ["steep", "steep", "stair"]);
    same("low", ["slab", "slab", "slab"]);
    same("steep", ["steep", "steep"]);
  });

  it("derives slabs and full blocks from the stair names", () => {
    const steepOf = (stairs: string) =>
      blocks(cellsOf([0, 0, 0], [0, 0, 3], stairs, { ridge: "x", profile: "steep" }));
    expect(steepOf("minecraft:oak_stairs")).toContain("minecraft:oak_planks");
    expect(steepOf("minecraft:stone_brick_stairs")).toContain("minecraft:stone_bricks");
    expect(steepOf("minecraft:deepslate_tile_stairs")).toContain("minecraft:deepslate_tiles");
    expect(steepOf("minecraft:quartz_stairs")).toContain("minecraft:quartz_block");
    expect(steepOf("minecraft:cobbled_deepslate_stairs")).toContain("minecraft:cobbled_deepslate");
    expect(
      blocks(
        cellsOf([0, 0, 0], [0, 0, 3], "minecraft:mud_brick_stairs", { ridge: "x", profile: "low" }),
      ),
    ).toEqual(
      new Set(["minecraft:mud_brick_slab[type=bottom]", "minecraft:mud_brick_slab[type=top]"]),
    );
  });

  it("uses explicit slab and full blocks for the body, and the verge's own siblings on the ends", () => {
    const cells = cellsOf([0, 0, 0], [2, 0, 3], ST, {
      ridge: "x",
      profile: ["steep", "slab"],
      full: "minecraft:bricks",
      slab: "minecraft:brick_slab",
      verge: "minecraft:dark_oak_stairs",
    });
    const at = (x: number) => blocks(cells.filter((c) => c[0] === x));
    expect(at(1)).toEqual(
      new Set([
        "minecraft:bricks",
        stair("south"),
        stair("north"),
        "minecraft:brick_slab[type=bottom]",
      ]),
    );
    for (const x of [0, 2]) {
      expect(at(x)).toEqual(
        new Set([
          "minecraft:dark_oak_planks",
          "minecraft:dark_oak_stairs[facing=south,half=bottom]",
          "minecraft:dark_oak_stairs[facing=north,half=bottom]",
          "minecraft:dark_oak_slab[type=bottom]",
        ]),
      );
    }
  });

  it("fills the gable end under each column's lowest cell and stands ridgeCap on the top", () => {
    const cells = cellsOf([0, 0, 0], [1, 0, 4], ST, {
      ridge: "x",
      profile: "steep",
      endFill: "minecraft:white_wool",
      ridgeCap: { post: "minecraft:oak_log[axis=y]", height: 1 },
    });
    const wool = cells.filter((c) => c[3] === "minecraft:white_wool").map((c) => c.slice(0, 3));
    // Column 1 (z 1, 3) starts at row 2; the apex (z 2) slab sits at row 4.
    expect(wool).toEqual(
      [
        [0, 0, 1],
        [0, 0, 2],
        [0, 0, 3],
        [0, 1, 1],
        [0, 1, 2],
        [0, 1, 3],
        [0, 2, 2],
        [0, 3, 2],
        [1, 0, 1],
        [1, 0, 2],
        [1, 0, 3],
        [1, 1, 1],
        [1, 1, 2],
        [1, 1, 3],
        [1, 2, 2],
        [1, 3, 2],
      ].sort(
        (a, b) =>
          (a[0] as number) - (b[0] as number) ||
          (a[1] as number) - (b[1] as number) ||
          (a[2] as number) - (b[2] as number),
      ),
    );
    const posts = cells
      .filter((c) => c[3] === "minecraft:oak_log[axis=y]")
      .map((c) => c.slice(0, 3));
    // Rooted in the apex slab's row (4), replacing the slab under each post.
    expect(posts).toEqual([
      [0, 4, 2],
      [0, 5, 2],
      [1, 4, 2],
      [1, 5, 2],
    ]);
  });

  it("refuses a stair or steep column that would start half a block up", () => {
    throws(
      () => shapes.roofGable([0, 0, 0], [0, 0, 3], ST, { ridge: "x", profile: ["slab", "stair"] }),
      /even number of slab columns/,
    );
  });

  it("refuses a pitch list of the wrong length, a bad pitch and a bad profile name", () => {
    throws(
      () => shapes.roofGable([0, 0, 0], [0, 0, 5], ST, { ridge: "x", profile: ["stair"] }),
      /lists 1 pitches but the span needs 3/,
    );
    throws(
      () =>
        shapes.roofGable([0, 0, 0], [0, 0, 3], ST, {
          ridge: "x",
          profile: ["stair", "flat" as "slab"],
        }),
      /invalid pitch flat/,
    );
    throws(
      () => shapes.roofGable([0, 0, 0], [0, 0, 3], ST, { ridge: "x", profile: "dome" as "low" }),
      /invalid profile dome/,
    );
  });

  it("asks for an explicit block when the stair name has no sibling", () => {
    throws(
      () =>
        shapes.roofGable([0, 0, 0], [0, 0, 3], "minecraft:stone", { ridge: "x", profile: "low" }),
      /cannot derive a slab block from minecraft:stone; pass 'slab' explicitly/,
    );
    expect(
      blocks(
        cellsOf([0, 0, 0], [0, 0, 3], "minecraft:stone", {
          ridge: "x",
          profile: "low",
          slab: "minecraft:stone_slab",
        }),
      ),
    ).toEqual(new Set(["minecraft:stone_slab[type=bottom]", "minecraft:stone_slab[type=top]"]));
  });

  it("is deterministic with a weighted palette and changes with the seed", () => {
    const palette: [string, number][] = [
      ["minecraft:stone_brick_stairs", 1],
      ["minecraft:cobbled_deepslate_stairs", 1],
    ];
    const run = (seed: number) =>
      cellsOf([0, 0, 0], [9, 0, 8], palette, { ridge: "x", profile: "concave", seed });
    expect(run(4)).toEqual(run(4));
    expect(run(4)).not.toEqual(run(5));
  });
});

describe("bayWall postWidth", () => {
  const S = "minecraft:stone_bricks";
  const I = "minecraft:iron_bars";
  type Cell = [number, number, number, string];
  const row = (cells: Cell[], y: number) =>
    cells
      .filter((c) => c[1] === y)
      .sort((a, b) => a[0] - b[0])
      .map((c) => (c[3] === S ? "P" : "I"))
      .join("");
  const throws = (fn: () => unknown, re: RegExp): void => {
    expect(fn).toThrow(VoxmcError);
    expect(fn).toThrow(re);
  };

  it("widens every post and keeps posts on both ends", () => {
    const cells = shapes
      .bayWall([0, 0, 0], [11, 0, 0], I, { period: 5, postWidth: 2, post: S })
      .cells() as Cell[];
    expect(row(cells, 0)).toBe("PPIIIPPIIIPP");
  });

  it("takes uneven distances between post starts", () => {
    const cells = shapes
      .bayWall([0, 0, 0], [0, 0, 9], I, { period: [3, 5], postWidth: 2, post: S })
      .cells() as Cell[];
    const line = cells
      .sort((a, b) => a[2] - b[2])
      .map((c) => (c[3] === S ? "P" : "I"))
      .join("");
    expect(line).toBe("PPIPPIIIPP");
  });

  it("is the plain wall with postWidth 1", () => {
    const a = shapes.bayWall([0, 0, 0], [8, 2, 0], I, { period: 4, post: S }).cells();
    const b = shapes.bayWall([0, 0, 0], [8, 2, 0], I, { period: 4, post: S, postWidth: 1 }).cells();
    expect(b).toEqual(a);
  });

  it("widens the proud frame in inset mode", () => {
    const cells = shapes
      .bayWall([0, 0, 0], [6, 0, 1], I, {
        period: 4,
        postWidth: 3,
        post: S,
        inset: true,
        face: "south",
      })
      .cells() as Cell[];
    const front = cells.filter((c) => c[2] === 1).map((c) => c[0]);
    expect(front.sort((a, b) => a - b)).toEqual([0, 1, 2, 4, 5, 6]);
  });

  it("refuses a period that does not fit, overlapping posts and a post as wide as the run", () => {
    throws(
      () => shapes.bayWall([0, 0, 0], [10, 0, 0], I, { period: 5, postWidth: 2 }),
      /\(length - 2\) divisible by period\); use length 7 or 12/,
    );
    throws(
      () => shapes.bayWall([0, 0, 0], [9, 0, 0], I, { period: 1, postWidth: 2 }),
      /shorter than postWidth 2/,
    );
    throws(
      () => shapes.bayWall([0, 0, 0], [9, 0, 0], I, { period: [1, 7], postWidth: 2 }),
      /period entry must be an int >= 2/,
    );
    throws(
      () => shapes.bayWall([0, 0, 0], [2, 0, 0], I, { period: 1, postWidth: 3 }),
      /no room for two posts/,
    );
  });
});
