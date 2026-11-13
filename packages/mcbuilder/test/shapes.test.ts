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
