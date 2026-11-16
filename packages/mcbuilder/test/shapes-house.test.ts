// SPDX-License-Identifier: AGPL-3.0-only

// Shapes for houses: roofs over several rectangles, dormers, chimneys, doors, windows.

import { describe, expect, it } from "vitest";
import { McbuilderError, shapes } from "../src/index.ts";

type Cell = [number, number, number, string];
type P = [number, number, number];

const sortCells = (cells: readonly (readonly [number, number, number, string])[]): Cell[] =>
  ([...cells] as Cell[]).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
const byPos = (cells: readonly (readonly [number, number, number, string])[]) =>
  new Map(cells.map((c) => [`${c[0]},${c[1]},${c[2]}`, c[3]]));
const throws = (fn: () => unknown, message: RegExp): void => {
  expect(fn).toThrow(McbuilderError);
  expect(fn).toThrow(message);
};

describe("roofUnion", () => {
  const ST = "minecraft:stone_brick_stairs";
  const W = "minecraft:white_concrete";
  const stair = (facing: string, shape?: string): string =>
    `${ST}[facing=${facing},half=bottom${shape ? `,shape=${shape}` : ""}]`;
  const CROSS: shapes.RoofPart[] = [
    { c1: [0, 0, 0], c2: [8, 0, 4], ridge: "x" },
    { c1: [2, 0, 3], c2: [6, 0, 6], ridge: "z" },
  ];

  it("gives exactly the stairs and end fill of roofGable for a single gable part", () => {
    const cases: [P, P, "x" | "z"][] = [
      [[-1, 6, -1], [11, 6, 9], "x"],
      [[0, 0, 0], [6, 0, 9], "z"],
      [[0, 2, 0], [4, 2, 3], "x"],
      [[3, 1, 3], [0, 1, 0], "z"],
    ];
    for (const [c1, c2, ridge] of cases) {
      for (const endFill of [undefined, W]) {
        const gable = shapes.roofGable(c1, c2, ST, { ridge, endFill }).cells();
        const union = shapes.roofUnion([{ c1, c2, ridge }], ST, { endFill }).cells();
        expect(sortCells(union)).toEqual(sortCells(gable));
      }
    }
  });

  it("joins a front wing to the main roof in two valleys of inner-corner stairs", () => {
    const cells = byPos(shapes.roofUnion(CROSS, ST).cells());
    expect(cells.size).toBe(55);
    // Valley bottoms on the main eave row, then one row up, either side of the wing ridge.
    expect(cells.get("2,0,4")).toBe(stair("north", "inner_right"));
    expect(cells.get("6,0,4")).toBe(stair("north", "inner_left"));
    expect(cells.get("3,1,3")).toBe(stair("north", "inner_right"));
    expect(cells.get("5,1,3")).toBe(stair("north", "inner_left"));
    // The wing ridge (odd span: faces west) runs up to the main apex row and stops.
    for (const z of [3, 4, 5, 6]) expect(cells.get(`4,2,${z}`)).toBe(stair("west"));
    expect(cells.get("4,2,2")).toBe(stair("north"));
    // Main eave cells under the wing are covered; the wing's slopes replace them.
    for (const x of [3, 4, 5]) expect(cells.has(`${x},0,4`)).toBe(false);
    expect(cells.get("3,1,4")).toBe(stair("east"));
    expect(cells.get("5,1,4")).toBe(stair("west"));
    // Wing stairs that would lie inside the main roof are left out.
    expect(cells.has("3,0,3")).toBe(false);
    expect(cells.has("4,1,3")).toBe(false);
  });

  it("fills the exposed gable ends only, not the wing end that dives into the main roof", () => {
    const plain = byPos(shapes.roofUnion(CROSS, ST).cells());
    const cells = shapes.roofUnion(CROSS, ST, { endFill: W }).cells();
    const fill = cells.filter((c) => c[3] === W).map((c) => c.slice(0, 3).join(","));
    expect(fill.sort()).toEqual(
      [
        // main roof, west and east gable ends
        "0,0,1",
        "0,0,2",
        "0,1,2",
        "0,0,3",
        "8,0,1",
        "8,0,2",
        "8,1,2",
        "8,0,3",
        // wing, south gable end only
        "3,0,6",
        "4,0,6",
        "4,1,6",
        "5,0,6",
      ].sort(),
    );
    // The fill never replaces a stair.
    for (const c of cells) if (c[3] !== W) expect(plain.get(c.slice(0, 3).join(","))).toBe(c[3]);
  });

  it("makes a hip part with outer-corner stairs and no end fill", () => {
    const cells = byPos(
      shapes
        .roofUnion([{ c1: [0, 0, 0], c2: [6, 0, 4], ridge: "hip" }], ST, { endFill: W })
        .cells(),
    );
    expect(cells.size).toBe(35);
    expect(cells.get("0,0,0")).toBe(stair("south", "outer_left"));
    expect(cells.get("6,0,0")).toBe(stair("south", "outer_right"));
    expect(cells.get("0,0,4")).toBe(stair("north", "outer_right"));
    expect(cells.get("6,0,4")).toBe(stair("north", "outer_left"));
    expect(cells.get("1,1,1")).toBe(stair("south", "outer_left"));
    expect(cells.get("0,0,2")).toBe(stair("east"));
    // The odd ridge line faces north.
    for (const x of [2, 3, 4]) expect(cells.get(`${x},2,2`)).toBe(stair("north"));
    expect([...cells.values()].includes(W)).toBe(false);
  });

  it("hips one end and gables the other with a hip part plus a gable part", () => {
    const parts: shapes.RoofPart[] = [
      { c1: [0, 0, 0], c2: [12, 0, 8], ridge: "hip" },
      { c1: [6, 0, 0], c2: [12, 0, 8], ridge: "x" },
    ];
    const cells = shapes.roofUnion(parts, ST, { endFill: W }).cells();
    const at = byPos(cells);
    expect(at.get("0,0,0")).toBe(stair("south", "outer_left"));
    expect(at.get("3,3,3")).toBe(stair("south", "outer_left"));
    expect(at.get("3,3,4")).toBe(stair("east"));
    expect(at.get("12,4,4")).toBe(stair("north"));
    const fill = cells.filter((c) => c[3] === W);
    expect(fill.length).toBe(16);
    expect(fill.every((c) => c[0] === 12)).toBe(true);
  });

  it("lets a part with a higher eave row sit on the main slope (a dormer roof)", () => {
    // Main: span 15 across z, eave row y = 0, apex row 7 at z = 7. Dormer roof: x 4..8, eave row
    // y = 4, front end at z = 11 (the main slope is at y = 3 there), ridge along z.
    const parts: shapes.RoofPart[] = [
      { c1: [0, 0, 0], c2: [12, 0, 14], ridge: "x" },
      { c1: [4, 4, 11], c2: [8, 4, 7], ridge: "z" },
    ];
    const cells = byPos(shapes.roofUnion(parts, ST, { endFill: W }).cells());
    // Main stairs below the dormer's eave row stay, also inside the dormer's footprint.
    for (const [z, y] of [
      [14, 0],
      [12, 2],
      [11, 3],
    ])
      expect(cells.get(`6,${y},${z}`)).toBe(stair("north"));
    // The dormer's ridge (odd span 5: two rows up, facing west) runs back until the main slope
    // reaches it; main stairs under the dormer roof are covered.
    expect(cells.get("6,6,11")).toBe(stair("west"));
    expect(cells.get("6,6,9")).toBe(stair("west"));
    expect(cells.has("6,4,10")).toBe(false);
    expect(cells.has("6,5,9")).toBe(false);
    // The front gable of the dormer is filled; the main roof is still whole beside it.
    expect(cells.get("5,4,11")).toBe(W);
    expect(cells.get("6,4,11")).toBe(W);
    expect(cells.get("6,5,11")).toBe(W);
    expect(cells.get("2,3,11")).toBe(stair("north"));
  });

  it("is deterministic with a weighted palette and changes with the seed", () => {
    const mix: [string, number][] = [
      [ST, 3],
      ["minecraft:cobblestone_stairs", 1],
    ];
    const a = shapes.roofUnion(CROSS, mix, { seed: 3 }).cells();
    const b = shapes.roofUnion(CROSS, mix, { seed: 3 }).cells();
    const c = shapes.roofUnion(CROSS, mix, { seed: 4 }).cells();
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(c.map((x) => x.slice(0, 3))).toEqual(a.map((x) => x.slice(0, 3)));
  });

  it("refuses bad parts and a stair with a facing", () => {
    throws(() => shapes.roofUnion([], ST), /parts must be a non-empty array/);
    throws(
      () => shapes.roofUnion([{ c1: [0, 0, 0], c2: [4, 0, 4], ridge: "y" as never }], ST),
      /part 0 ridge must be 'x', 'z' or 'hip'/,
    );
    throws(
      () => shapes.roofUnion([{ c1: [0, 0, 0], c2: [4, 0.5, 4], ridge: "x" }], ST),
      /roof_union: part 0: c2 coordinates must be ints/,
    );
    throws(
      () => shapes.roofUnion(CROSS, `${ST}[facing=east]`),
      /computes 'facing' from the geometry/,
    );
  });
});

describe("dormer and dormerRoof", () => {
  const PL = "minecraft:spruce_planks";
  const PANE_X = "minecraft:glass_pane[east=true,west=true]";

  it("builds the front wall with a window inside a 1-cell border and cheeks down a 1:1 slope", () => {
    const cells = byPos(shapes.dormer([4, 9, 10], [8, 11, 10], "south", PL).cells());
    expect(cells.size).toBe(21);
    for (const x of [5, 6, 7]) expect(cells.get(`${x},10,10`)).toBe(PANE_X);
    for (const x of [4, 8]) expect(cells.get(`${x},10,10`)).toBe(PL);
    for (const x of [4, 5, 6, 7, 8]) {
      expect(cells.get(`${x},9,10`)).toBe(PL);
      expect(cells.get(`${x},11,10`)).toBe(PL);
    }
    // Cheeks: one row shorter per cell back (north), on both outer columns.
    for (const x of [4, 8]) {
      expect(cells.get(`${x},10,9`)).toBe(PL);
      expect(cells.get(`${x},11,9`)).toBe(PL);
      expect(cells.has(`${x},9,9`)).toBe(false);
      expect(cells.get(`${x},11,8`)).toBe(PL);
      expect(cells.has(`${x},10,8`)).toBe(false);
      expect(cells.has(`${x},11,7`)).toBe(false);
    }
  });

  it("turns with facing and can leave the window open", () => {
    const cells = byPos(shapes.dormer([3, 4, 2], [3, 6, 4], "east", PL, { window: null }).cells());
    expect(cells.get("3,5,3")).toBe("minecraft:air");
    expect(cells.get("2,5,2")).toBe(PL); // cheek one cell west (behind an east-facing front)
    expect(cells.get("1,6,4")).toBe(PL);
    const glazed = byPos(shapes.dormer([3, 4, 2], [3, 6, 4], "east", PL).cells());
    expect(glazed.get("3,5,3")).toBe("minecraft:glass_pane[north=true,south=true]");
  });

  it("gives the matching roof part: one cell wider each side, flush front, back to the slope", () => {
    expect(shapes.dormerRoof([5, 9, 13], [7, 11, 13], "south")).toEqual({
      c1: [4, 12, 13],
      c2: [8, 12, 7],
      ridge: "z",
    });
    expect(shapes.dormerRoof([5, 9, 3], [7, 11, 3], "north")).toEqual({
      c1: [4, 12, 3],
      c2: [8, 12, 9],
      ridge: "z",
    });
    expect(shapes.dormerRoof([3, 4, 2], [3, 6, 6], "east")).toEqual({
      c1: [3, 7, 1],
      c2: [-4, 7, 7],
      ridge: "x",
    });
  });

  it("refuses a front wall that is not one cell thick or too small for a window", () => {
    throws(() => shapes.dormer([4, 9, 10], [8, 11, 11], "south", PL), /one wall plane/);
    throws(() => shapes.dormer([4, 9, 10], [5, 11, 10], "south", PL), /at least 3 wide and 3 tall/);
    throws(() => shapes.dormer([4, 9, 10], [8, 10, 10], "south", PL), /got 5 x 2/);
    throws(() => shapes.dormer([4, 9, 10], [8, 11, 10], "up" as never, PL), /invalid direction up/);
  });
});

describe("chimney", () => {
  const BR = "minecraft:bricks";

  it("stacks a shaft with a band, a campfire in the top row and a post cap", () => {
    const cells = shapes
      .chimney([0, 0, 0], 4, BR, {
        band: { block: "minecraft:oak_log[axis=y]", rows: [1] },
        cap: "posts",
        slab: "minecraft:stone_slab",
        post: "minecraft:stone_brick_wall",
        smoke: true,
      })
      .cells();
    expect(sortCells(cells)).toEqual([
      [0, 0, 0, BR],
      [0, 1, 0, "minecraft:oak_log[axis=y]"],
      [0, 2, 0, BR],
      [0, 3, 0, "minecraft:campfire[lit=true]"],
      [0, 4, 0, "minecraft:stone_brick_wall"],
      [0, 5, 0, "minecraft:stone_slab[type=bottom]"],
    ]);
  });

  it("covers a wider shaft with a slab lid and puts the fire in the middle", () => {
    const two = byPos(
      shapes
        .chimney([5, 1, 5], 3, BR, { size: 2, cap: "slab", slab: "minecraft:brick_slab" })
        .cells(),
    );
    expect(two.size).toBe(16);
    for (const [x, z] of [
      [5, 5],
      [6, 5],
      [5, 6],
      [6, 6],
    ])
      expect(two.get(`${x},4,${z}`)).toBe("minecraft:brick_slab[type=bottom]");
    const three = byPos(shapes.chimney([0, 0, 0], 2, BR, { size: 3, smoke: true }).cells());
    expect(three.get("1,1,1")).toBe("minecraft:campfire[lit=true]");
    expect(three.get("0,1,0")).toBe(BR);
    const posts = shapes
      .chimney([0, 0, 0], 2, BR, { size: 3, cap: "posts", slab: "minecraft:brick_slab" })
      .cells()
      .filter((c) => c[1] === 2);
    expect(posts.map((c) => `${c[0]},${c[2]}`).sort()).toEqual(["0,0", "0,2", "2,0", "2,2"]);
  });

  it("refuses a cap without a slab, a band outside the shaft and a slab with a type", () => {
    throws(() => shapes.chimney([0, 0, 0], 3, BR, { cap: "slab" }), /needs a slab material/);
    throws(() => shapes.chimney([0, 0, 0], 3, BR, { cap: "pot" as never }), /invalid cap pot/);
    throws(
      () => shapes.chimney([0, 0, 0], 3, BR, { band: { block: BR, rows: [3] } }),
      /band row 3 is outside the shaft \(rows 0\.\.2\)/,
    );
    throws(
      () =>
        shapes.chimney([0, 0, 0], 3, BR, { cap: "slab", slab: "minecraft:stone_slab[type=top]" }),
      /type/,
    );
    throws(() => shapes.chimney([0, 0, 0], 0, BR), /height must be an int >= 1/);
  });
});

describe("door", () => {
  const D = "minecraft:oak_door";
  const leaf = (facing: string, half: string, hinge: string, open = "false") =>
    `${D}[facing=${facing},half=${half},hinge=${hinge},open=${open}]`;

  it("places both halves, and a second leaf to the right with the opposite hinge", () => {
    expect(sortCells(shapes.door([0, 1, 0], "north", D).cells())).toEqual([
      [0, 1, 0, leaf("north", "lower", "left")],
      [0, 2, 0, leaf("north", "upper", "left")],
    ]);
    const double = byPos(shapes.door([0, 1, 0], "east", D, { double: true, open: true }).cells());
    expect(double.get("0,1,0")).toBe(leaf("east", "lower", "left", "true"));
    expect(double.get("0,1,1")).toBe(leaf("east", "lower", "right", "true")); // right of east = south
    const right = byPos(
      shapes.door([0, 1, 0], "south", D, { double: true, hinge: "right" }).cells(),
    );
    expect(right.get("0,2,0")).toBe(leaf("south", "upper", "right"));
    expect(right.get("-1,2,0")).toBe(leaf("south", "upper", "left")); // right of south = west
  });

  it("frames the doorway with posts and a lintel over posts and leaves", () => {
    const P = "minecraft:stripped_oak_log[axis=y]";
    const L = "minecraft:stripped_oak_log[axis=x]";
    const cells = byPos(shapes.door([3, 1, 5], "north", D, { frame: P, lintel: L }).cells());
    expect(cells.size).toBe(9);
    for (const x of [2, 4]) for (const y of [1, 2]) expect(cells.get(`${x},${y},5`)).toBe(P);
    for (const x of [2, 3, 4]) expect(cells.get(`${x},3,5`)).toBe(L);
    const lintelOnly = byPos(shapes.door([3, 1, 5], "north", D, { lintel: L }).cells());
    expect([...lintelOnly.keys()].sort()).toEqual(["3,1,5", "3,2,5", "3,3,5"]);
  });

  it("refuses a door block that carries the properties it sets", () => {
    throws(() => shapes.door([0, 0, 0], "north", `${D}[facing=east]`), /pass .* without facing/);
    throws(() => shapes.door([0, 0, 0], "north", `${D}[hinge=right]`), /without hinge/);
    throws(() => shapes.door([0, 0, 0], "north", D, { hinge: "up" as never }), /hinge must be/);
  });
});

describe("window", () => {
  const P = "minecraft:stripped_oak_log[axis=y]";
  const L = "minecraft:stripped_oak_log[axis=x]";

  it("glazes the opening with panes joined in the wall's plane", () => {
    const south = sortCells(shapes.window([2, 2, 0], [3, 3, 0], "south").cells());
    expect(south).toEqual(
      [
        [2, 2, 0],
        [2, 3, 0],
        [3, 2, 0],
        [3, 3, 0],
      ].map(([x, y, z]) => [x, y, z, "minecraft:glass_pane[east=true,west=true]"]),
    );
    const east = byPos(shapes.window([5, 2, 1], [5, 2, 3], "east").cells());
    expect(east.get("5,2,2")).toBe("minecraft:glass_pane[north=true,south=true]");
    const block = byPos(
      shapes.window([0, 0, 0], [0, 0, 0], "north", { glass: "minecraft:glass" }).cells(),
    );
    expect(block.get("0,0,0")).toBe("minecraft:glass");
    const open = byPos(shapes.window([0, 0, 0], [1, 0, 0], "north", { glass: null }).cells());
    expect(open.get("1,0,0")).toBe("minecraft:air");
  });

  it("adds frame, lintel, sill and shutters around the opening", () => {
    const cells = byPos(
      shapes
        .window([2, 2, 0], [3, 3, 0], "south", {
          frame: P,
          lintel: L,
          sill: "minecraft:spruce_stairs",
          shutters: "minecraft:spruce_trapdoor",
        })
        .cells(),
    );
    for (const x of [1, 4]) for (const y of [1, 2, 3]) expect(cells.get(`${x},${y},0`)).toBe(P);
    for (const x of [2, 3]) expect(cells.get(`${x},1,0`)).toBe(P);
    for (const x of [1, 2, 3, 4]) expect(cells.get(`${x},4,0`)).toBe(L);
    for (const x of [2, 3])
      expect(cells.get(`${x},1,1`)).toBe("minecraft:spruce_stairs[facing=north,half=top]");
    for (const x of [1, 4])
      for (const y of [2, 3])
        expect(cells.get(`${x},${y},1`)).toBe(
          "minecraft:spruce_trapdoor[facing=south,half=bottom,open=true]",
        );
    expect(cells.size).toBe(4 + 8 + 4 + 2 + 4);
  });

  it("fits trapdoor and slab sills, and keeps the properties you give", () => {
    const trap = byPos(
      shapes.window([0, 2, 0], [0, 2, 0], "west", { sill: "minecraft:oak_trapdoor" }).cells(),
    );
    expect(trap.get("-1,1,0")).toBe("minecraft:oak_trapdoor[facing=west,half=top]");
    const slab = byPos(
      shapes.window([0, 2, 0], [0, 2, 0], "north", { sill: "minecraft:oak_slab" }).cells(),
    );
    expect(slab.get("0,1,-1")).toBe("minecraft:oak_slab[type=top]");
    const given = byPos(
      shapes
        .window([0, 2, 0], [0, 2, 0], "north", { sill: "minecraft:oak_stairs[half=bottom]" })
        .cells(),
    );
    expect(given.get("0,1,-1")).toBe("minecraft:oak_stairs[facing=south,half=bottom]");
  });

  it("refuses an opening that is not flat in the wall and shutters with set properties", () => {
    throws(() => shapes.window([0, 0, 0], [1, 1, 1], "south"), /one wall plane/);
    throws(
      () =>
        shapes.window([0, 0, 0], [1, 1, 0], "south", {
          shutters: "minecraft:oak_trapdoor[open=false]",
        }),
      /without open/,
    );
  });
});

describe("stairs half", () => {
  const ST = "minecraft:stone_brick_stairs";

  it("keeps ordinary steps by default and with half 'bottom'", () => {
    const plain = shapes.stairs([0, 0, 0], "north", ST, { length: 3, width: 2 }).cells();
    const bottom = shapes
      .stairs([0, 0, 0], "north", ST, { length: 3, width: 2, half: "bottom" })
      .cells();
    expect(bottom).toEqual(plain);
    expect(plain[0]).toEqual([0, 0, 0, `${ST}[facing=north,half=bottom]`]);
  });

  it("turns the steps upside down and faces them back down the run with half 'top'", () => {
    const cells = shapes.stairs([2, 5, 0], "east", ST, { length: 3, half: "top" }).cells();
    expect(sortCells(cells)).toEqual([
      [2, 5, 0, `${ST}[facing=west,half=top]`],
      [3, 6, 0, `${ST}[facing=west,half=top]`],
      [4, 7, 0, `${ST}[facing=west,half=top]`],
    ]);
    const target = shapes.stairs([0, 0, 0], "south", ST, { target: [0, 2, 2], half: "top" });
    expect(target.cells().map((c) => c[3])).toEqual(
      Array.from({ length: 3 }, () => `${ST}[facing=north,half=top]`),
    );
    expect(shapes.stairsRun([0, 0, 0], "west", ST, { length: 1, half: "top" }).cells()).toEqual([
      [0, 0, 0, `${ST}[facing=east,half=top]`],
    ]);
  });

  it("refuses an unknown half", () => {
    throws(
      () => shapes.stairs([0, 0, 0], "north", ST, { length: 2, half: "middle" as never }),
      /half must be 'bottom' or 'top', got middle/,
    );
  });
});
