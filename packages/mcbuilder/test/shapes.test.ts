// SPDX-License-Identifier: AGPL-3.0-only

import { createHash } from "node:crypto";
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
    it("is one upside-down stair per corner for a 3-wide span (T15)", () => {
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

    it("bridges a 3-wide span with a top slab (T15)", () => {
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
    it("lays a rail with posts at both ends and every 3rd cell, odd span", () => {
      // x 0..6, z 0..4: apex row 2 at z2, rail y3 for x -1..7, posts y4 at idx 0,3,6,8.
      const out = added([0, 0, 0], [6, 0, 4], {
        ridge: "x",
        ridgeCap: { rail: LOG, post: POST },
      });
      const rail: Cell[] = Array.from({ length: 9 }, (_, i): Cell => [i - 1, 3, 2, LOG]);
      const posts: Cell[] = [-1, 2, 5, 7].map((x): Cell => [x, 4, 2, POST]);
      expect(out).toEqual(sortCells([...rail, ...posts]));
    });

    it("covers both cells of an even span, ridge x", () => {
      // z 0..3: top row 1 stairs at z1 and z2; rail y2 on both; overshoot 0, every 2.
      const out = added([0, 0, 0], [4, 0, 3], {
        ridge: "x",
        ridgeCap: { rail: LOG, post: POST, every: 2, overshoot: 0 },
      });
      const rail = [0, 1, 2, 3, 4].flatMap((x) => [1, 2].map((z): Cell => [x, 2, z, LOG]));
      const posts = [0, 2, 4].flatMap((x) => [1, 2].map((z): Cell => [x, 3, z, POST]));
      expect(out).toEqual(sortCells([...rail, ...posts]));
    });

    it("runs along z, defaults post to the rail, adds the last post when the gap is short", () => {
      // x 0..2, z 0..4, ridge z: apex x1 row 1; rail y1+1 = 2; z -1..5 (7 cells); posts idx 0,3,6.
      const out = added([0, 0, 0], [2, 0, 4], { ridge: "z", ridgeCap: { rail: POST } });
      const rail = Array.from({ length: 7 }, (_, i): Cell => [1, 2, i - 1, POST]);
      const posts = [-1, 2, 5].map((z): Cell => [1, 3, z, POST]);
      expect(out).toEqual(sortCells([...rail, ...posts]));
    });

    it("leaves the rail bare with post null", () => {
      const out = added([0, 0, 0], [3, 0, 2], {
        ridge: "x",
        ridgeCap: { rail: LOG, post: null, overshoot: 0 },
      });
      expect(out).toEqual([0, 1, 2, 3].map((x): Cell => [x, 2, 1, LOG]));
    });

    it("places the same posts for a 1-wide roof (span 1)", () => {
      const out = added([0, 0, 0], [2, 0, 0], {
        ridge: "x",
        ridgeCap: { rail: LOG, post: POST, overshoot: 0 },
      });
      expect(out).toEqual(
        sortCells([
          ...[0, 1, 2].map((x): Cell => [x, 1, 0, LOG]),
          ...[0, 2].map((x): Cell => [x, 2, 0, POST]),
        ]),
      );
    });

    it("combines with endFill without overlapping it", () => {
      const both = cellsOf([0, 0, 0], [4, 0, 4], ST, {
        ridge: "x",
        endFill: F,
        ridgeCap: { rail: LOG },
      });
      const fillOnly = cellsOf([0, 0, 0], [4, 0, 4], ST, { ridge: "x", endFill: F });
      const capOnly = cellsOf([0, 0, 0], [4, 0, 4], ST, { ridge: "x", ridgeCap: { rail: LOG } });
      expect(both).toHaveLength(
        fillOnly.length + capOnly.length - cellsOf([0, 0, 0], [4, 0, 4], ST, { ridge: "x" }).length,
      );
    });
  });

  describe("validation", () => {
    const roof = (o: Partial<Parameters<typeof shapes.roofGable>[3]>) => () =>
      shapes.roofGable([0, 0, 0], [4, 0, 4], ST, { ridge: "x", ...o });

    it("checks ridgeCap", () => {
      refuses(roof({ ridgeCap: LOG as never }), /ridgeCap must be an object with a rail/);
      refuses(roof({ ridgeCap: {} as never }), /ridgeCap must be an object with a rail/);
      refuses(roof({ ridgeCap: { rail: LOG, every: 0 } }), /ridgeCap.every must be an int >= 1/);
      refuses(roof({ ridgeCap: { rail: LOG, every: 1.5 } }), /ridgeCap.every must be an int/);
      refuses(
        roof({ ridgeCap: { rail: LOG, overshoot: -1 } }),
        /ridgeCap.overshoot must be an int >= 0/,
      );
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
        ridgeCap: { rail: palette, post: palette },
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
    expect(fn).toThrow(McbuilderError);
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
