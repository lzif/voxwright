// SPDX-License-Identifier: AGPL-3.0-only

// The Gilded Hearth: a half-timbered tavern with a verdigris copper roof.
//
// Massing: a long main hall (ridge east-west) with a cross-gabled entrance bay to the south and
// a cross-gabled back-bar bay to the north, a lower kitchen wing to the east, two porches on
// posts either side of the entrance, and a tapered stone chimney on the west gable. Three
// materials carry it: oxidized copper for the roof, white plaster and stone for the walls, and
// dark oak for every beam, post and trim line. Warm light comes from lanterns, torches and the
// hearth. The ground is part of the build (grass, a path, hedges, three trees).
//
// Coordinates: +x east, +z south, the front door faces south at x = 9. Ground blocks are y = -1,
// the foundation is y = 0..1, the ground-floor floor is y = 1, walls y = 2..5, the upper floor is
// y = 6, upper walls y = 7..10, the main ridge is y = 17.
//
//   voxmc check examples/tavern/tavern.ts
//   voxmc run   examples/tavern/tavern.ts --preview --guide

import { Build, type Material, patches } from "../../src/index.ts";
import {
  BRICK,
  FOUNDATION,
  gableInfill,
  HANGING_LANTERN,
  lanternPost,
  PLASTER,
  STONE_BASE,
  TIMBER,
  window,
} from "../homestead/common.ts";
import { range } from "../py.ts";

export const BUILD = new Build({ seed: 5521, views: "iso;az200_el025;az120_el030;top" });

// -- palette -------------------------------------------------------------------------------
const ROOF = "minecraft:waxed_oxidized_cut_copper_stairs";
const ROOF_SLAB = "minecraft:waxed_oxidized_cut_copper_slab[type=bottom]";
const TRIM = "minecraft:dark_oak_stairs";
const BEAM = "minecraft:stripped_dark_oak_log";
const CEILING = "minecraft:dark_oak_planks";
const FLOOR: Material = patches(
  [
    ["minecraft:spruce_planks", 4],
    ["minecraft:dark_oak_planks", 1],
    ["minecraft:oak_planks", 1],
  ],
  { scale: 2, salt: "tavern-floor" },
);
const GRASS = "minecraft:grass_block";
const PATH: Material = patches(
  [
    ["minecraft:dirt_path", 6],
    ["minecraft:coarse_dirt", 1],
    ["minecraft:cobblestone", 1],
  ],
  { scale: 1.6, salt: "path" },
);
const HEDGE = "minecraft:oak_leaves[persistent=true]";
const STEP = "minecraft:stone_brick_stairs[facing=north,half=bottom]";

const OPPOSITE: Record<string, string> = {
  north: "south",
  south: "north",
  east: "west",
  west: "east",
};
const stair = (facing: string, half = "bottom"): string =>
  `minecraft:spruce_stairs[facing=${facing},half=${half}]`;
/** An armchair; `looking` is the way the sitter faces, so the tall back is on the other side. */
const chair = (x: number, y: number, z: number, looking: string): void =>
  BUILD.set(x, y, z, stair(OPPOSITE[looking] as string));
/** A small table: fence leg, slab top, candle. */
function table(x: number, z: number, candle = true): void {
  BUILD.set(x, 2, z, "minecraft:spruce_fence");
  BUILD.set(x, 3, z, "minecraft:spruce_slab[type=bottom]");
  if (candle) BUILD.set(x, 4, z, "minecraft:candle[candles=2,lit=true]");
}

type Side = "north" | "south" | "east" | "west";

/** Upper-floor timber frame y = 7..10: posts, sill (7), plate (10), plaster between. */
function frame(
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  xs: number[],
  zs: number[],
  skip?: Side,
): void {
  const sides: Record<Side, [number, number][]> = {
    north: range(x0, x1 + 1).map((x) => [x, z0]),
    south: range(x0, x1 + 1).map((x) => [x, z1]),
    west: range(z0, z1 + 1).map((z) => [x0, z]),
    east: range(z0, z1 + 1).map((z) => [x1, z]),
  };
  for (const [side, cells] of Object.entries(sides) as [Side, [number, number][]][]) {
    if (side === skip) continue;
    const run = side === "north" || side === "south" ? "x" : "z";
    for (const [x, z] of cells) {
      if (run === "x" ? xs.includes(x) : zs.includes(z)) {
        BUILD.pillar([x, 7, z], 4, `${TIMBER}[axis=y]`);
      } else {
        BUILD.set(x, 7, z, `${TIMBER}[axis=${run}]`);
        BUILD.box([x, 8, z], [x, 9, z], PLASTER);
        BUILD.set(x, 10, z, `${TIMBER}[axis=${run}]`);
      }
    }
  }
}

/** The dark-oak ring beam under an upper floor, around a box of walls. */
function ringBeam(x0: number, x1: number, z0: number, z1: number): void {
  BUILD.line([x0, 6, z0], [x1, 6, z0], `${TIMBER}[axis=x]`);
  BUILD.line([x0, 6, z1], [x1, 6, z1], `${TIMBER}[axis=x]`);
  BUILD.line([x0, 6, z0], [x0, 6, z1], `${TIMBER}[axis=z]`);
  BUILD.line([x1, 6, z0], [x1, 6, z1], `${TIMBER}[axis=z]`);
}

/** A small copper-tipped finial: a fence post and a lightning rod. */
function finial(x: number, y: number, z: number): void {
  BUILD.set(x, y, z, "minecraft:dark_oak_fence");
  BUILD.set(x, y + 1, z, "minecraft:lightning_rod[facing=up]");
}

function tree(x: number, z: number, h: number): void {
  BUILD.pillar([x, 0, z], h, "minecraft:oak_log[axis=y]");
  BUILD.sphere([x, h + 1, z], 3, HEDGE);
  BUILD.sphere([x + 2, h, z + 1], 2, HEDGE);
}

BUILD.scope(() => {
  // -- ground, path, flowers, trees ------------------------------------------------------
  BUILD.box([-9, -1, -9], [35, -1, 27], GRASS);
  BUILD.box([8, -1, 20], [10, -1, 27], PATH);
  BUILD.box([6, -1, 25], [12, -1, 26], PATH);
  for (const [x, z] of [
    [-8, -4],
    [-5, 14],
    [3, 23],
    [15, 24],
    [27, 18],
    [31, 6],
    [-7, 9],
    [33, -2],
    [22, -6],
    [-3, -7],
  ] as const) {
    BUILD.set(x, 0, z, (x * 7 + z * 3) % 4 === 0 ? "minecraft:poppy" : "minecraft:dandelion");
  }
  tree(-6, 18, 4);
  tree(31, 15, 5);
  tree(30, -4, 4);

  // -- foundation, floors, steps, hedges ---------------------------------------------------
  BUILD.box([-1, 0, 1], [19, 1, 14], FOUNDATION); // main hall and the two porch decks
  BUILD.box([5, 0, 13], [13, 1, 18], FOUNDATION); // entrance bay
  BUILD.box([5, 0, -4], [13, 1, 2], FOUNDATION); // back-bar bay
  BUILD.box([18, 0, 2], [26, 1, 12], FOUNDATION); // kitchen wing
  BUILD.box([0, 1, 2], [18, 1, 12], FLOOR);
  BUILD.box([6, 1, 13], [12, 1, 17], FLOOR);
  BUILD.box([6, 1, -3], [12, 1, 1], FLOOR);
  BUILD.box([19, 1, 3], [25, 1, 11], "minecraft:smooth_stone");
  BUILD.box([7, 0, 19], [11, 0, 19], STEP);
  BUILD.box([1, 0, 15], [5, 0, 15], STEP);
  BUILD.box([13, 0, 15], [17, 0, 15], STEP);
  BUILD.box([20, 0, 13], [24, 0, 13], STEP);
  BUILD.box([-2, 0, 2], [-2, 1, 14], HEDGE);
  BUILD.box([-2, 0, 15], [0, 1, 15], HEDGE);
  BUILD.box([6, 0, 15], [6, 1, 19], HEDGE);
  BUILD.box([12, 0, 15], [12, 1, 19], HEDGE);
  BUILD.box([27, 0, 3], [27, 1, 13], HEDGE);

  // -- ground-floor walls ----------------------------------------------------------------------
  BUILD.walls([0, 2, 2], [18, 5, 12], STONE_BASE);
  BUILD.walls([6, 2, 12], [12, 5, 17], STONE_BASE);
  BUILD.walls([6, 2, -3], [12, 5, 2], STONE_BASE);
  BUILD.walls([19, 2, 3], [25, 5, 11], STONE_BASE);
  for (const [x, z] of [
    [0, 2],
    [18, 2],
    [0, 12],
    [18, 12],
    [6, 17],
    [12, 17],
    [6, -3],
    [12, -3],
  ] as const) {
    BUILD.pillar([x, 2, z], 4, `${TIMBER}[axis=y]`);
  }
  for (const [x, z] of [
    [19, 3],
    [25, 3],
    [19, 11],
    [25, 11],
  ] as const) {
    BUILD.pillar([x, 2, z], 5, `${TIMBER}[axis=y]`);
  }
  BUILD.box([25, 6, 4], [25, 6, 10], STONE_BASE); // east wing wall up to the roof

  // -- ceilings / upper floors and the ring beams -------------------------------------------------
  BUILD.box([0, 6, 2], [18, 6, 12], CEILING);
  BUILD.box([6, 6, 13], [12, 6, 17], CEILING);
  BUILD.box([6, 6, -3], [12, 6, 1], CEILING);
  ringBeam(0, 18, 2, 12);
  ringBeam(6, 12, 12, 17);
  ringBeam(6, 12, -3, 2);
  for (const z of [5, 9]) BUILD.line([1, 5, z], [17, 5, z], `${BEAM}[axis=x]`);
  for (const x of [6, 12]) BUILD.line([x, 5, 3], [x, 5, 11], `${BEAM}[axis=z]`);
  BUILD.carve([14, 6, 11], [15, 6, 11]); // stairwell

  // -- upper floor timber frames ---------------------------------------------------------------------
  frame(0, 18, 2, 12, [0, 6, 12, 18], [2, 7, 12]);
  frame(6, 12, 12, 17, [6, 12], [12, 17], "north");
  frame(6, 12, -3, 2, [6, 12], [-3, 2], "south");
  for (const x of [6, 12]) {
    BUILD.line([x, 10, 3], [x, 10, 11], `${TIMBER}[axis=z]`); // tie beams
    BUILD.set(x, 9, 7, HANGING_LANTERN);
  }

  // -- roofs: bays first so the main roof overwrites where they meet ---------------------------------------
  BUILD.roofGable([5, 11, 9], [13, 11, 18], ROOF, { ridge: "z", verge: TRIM, eave: TRIM });
  BUILD.roofGable([5, 11, -4], [13, 11, 5], ROOF, { ridge: "z", verge: TRIM, eave: TRIM });
  BUILD.roofGable([-1, 11, 1], [19, 11, 13], ROOF, { ridge: "x", verge: TRIM, eave: TRIM });
  BUILD.roofGable([18, 6, 2], [26, 6, 12], ROOF, { ridge: "z", verge: TRIM, eave: TRIM });
  for (const plane of [0, 18]) gableInfill(BUILD, plane, "x", 11, 1, 13, { windowAt: [13, 7] });
  gableInfill(BUILD, 17, "z", 11, 5, 13, { windowAt: [13, 9] });
  gableInfill(BUILD, -3, "z", 11, 5, 13, { windowAt: [13, 9] });
  for (const plane of [3, 11]) gableInfill(BUILD, plane, "z", 6, 18, 26, { kingpost: false });
  BUILD.line([-1, 18, 7], [19, 18, 7], ROOF_SLAB);
  BUILD.line([9, 16, -4], [9, 16, 5], ROOF_SLAB);
  BUILD.line([9, 16, 9], [9, 16, 18], ROOF_SLAB);
  BUILD.line([22, 11, 2], [22, 11, 12], ROOF_SLAB);
  finial(-1, 19, 7);
  finial(19, 19, 7);
  finial(9, 17, 18);
  finial(9, 17, -4);
  finial(22, 12, 12);
  finial(22, 12, 2);

  // -- porches on posts, one either side of the entrance ----------------------------------------------------
  for (const [x0, x1] of [
    [1, 5],
    [13, 17],
  ] as const) {
    for (let x = x0; x <= x1; x++) {
      BUILD.set(x, 5, 13, `${ROOF}[facing=north,half=bottom]`);
      BUILD.set(x, 4, 14, `${ROOF}[facing=north,half=bottom]`);
    }
    BUILD.line([x0, 4, 13], [x1, 4, 13], "minecraft:dark_oak_planks");
    for (const x of [x0, (x0 + x1) / 2, x1])
      BUILD.pillar([x, 2, 14], 2, "minecraft:dark_oak_fence");
    for (const x of [x0 + 1, x1 - 1]) BUILD.set(x, 3, 14, HANGING_LANTERN);
  }

  // -- entrance bay: door, torches, sign ------------------------------------------------------------------------
  BUILD.set(9, 2, 17, "minecraft:spruce_door[facing=south,half=lower,hinge=left]");
  BUILD.set(9, 3, 17, "minecraft:spruce_door[facing=south,half=upper,hinge=left]");
  BUILD.set(8, 3, 18, "minecraft:wall_torch[facing=south]");
  BUILD.set(10, 3, 18, "minecraft:wall_torch[facing=south]");
  for (const x of [7, 11]) lanternPost(BUILD, x, 2, 19, { height: 2 });
  BUILD.set(5, 5, 15, "minecraft:dark_oak_fence");
  BUILD.set(4, 5, 15, "minecraft:dark_oak_fence");
  BUILD.set(
    4,
    4,
    15,
    'minecraft:dark_oak_hanging_sign[attached=false,rotation=0]{front_text:{messages:["The Gilded","Hearth","",""]}}',
  );
  window(BUILD, 6, 8, 15, "west", { shutters: false, flowerBox: false });
  window(BUILD, 12, 8, 15, "east", { shutters: false, flowerBox: false });
  for (const x of [8, 9, 10])
    window(BUILD, x, 8, 17, "south", { shutters: false, flowerBox: false });
  window(BUILD, 9, 8, -3, "north", { shutters: false });

  // -- main hall windows ------------------------------------------------------------------------------------------
  for (const x of [3, 15]) {
    window(BUILD, x, 3, 12, "south");
    window(BUILD, x, 3, 2, "north");
    window(BUILD, x, 8, 12, "south", { shutters: false });
    window(BUILD, x, 8, 2, "north", { shutters: false });
  }
  for (const z of [4, 10]) {
    window(BUILD, 0, 3, z, "west");
    window(BUILD, 0, 8, z, "west", { shutters: false });
  }
  BUILD.set(22, 2, 11, "minecraft:spruce_door[facing=south,half=lower,hinge=left]");
  BUILD.set(22, 3, 11, "minecraft:spruce_door[facing=south,half=upper,hinge=left]");
  for (const x of [20, 24]) window(BUILD, x, 3, 11, "south");
  window(BUILD, 25, 3, 7, "east");
  window(BUILD, 22, 3, 3, "north");

  // -- chimney (west gable): tapered, hearth through the wall ----------------------------------------------------------
  BUILD.box([-3, 0, 6], [-1, 12, 8], BRICK);
  BUILD.box([-4, 12, 5], [-1, 12, 9], "minecraft:stone_brick_slab[type=bottom]"); // ledge
  BUILD.box([-2, 13, 6], [-1, 19, 7], BRICK);
  BUILD.box([-3, 20, 5], [-1, 20, 8], "minecraft:stone_brick_slab[type=bottom]");
  BUILD.carve([0, 2, 6], [-1, 3, 8]); // opening through the wall
  BUILD.carve([-1, 4, 7], [-1, 20, 7]); // flue
  BUILD.set(-1, 2, 7, "minecraft:campfire[lit=true,facing=east]");
  BUILD.set(-1, 2, 6, "minecraft:stone_bricks");
  BUILD.set(-1, 2, 8, "minecraft:stone_bricks");
  BUILD.box([0, 4, 6], [0, 4, 8], "minecraft:stone_brick_stairs[facing=east,half=top]");
  BUILD.box([1, 2, 6], [1, 2, 8], "minecraft:stone_brick_slab[type=bottom]");
  BUILD.set(1, 3, 6, "minecraft:candle[candles=3,lit=true]");
  BUILD.set(1, 3, 8, "minecraft:potted_red_tulip");

  // -- taproom: arches, bar and back-bar --------------------------------------------------------------------------------------
  BUILD.carve([8, 2, 12], [10, 4, 12]); // arch into the entrance bay
  BUILD.box([7, 5, 12], [11, 5, 12], CEILING);
  BUILD.carve([7, 2, 2], [11, 4, 2]); // arch into the back-bar bay
  BUILD.box([6, 5, 2], [12, 5, 2], CEILING);
  BUILD.line([5, 2, 4], [13, 2, 4], "minecraft:dark_oak_planks"); // bar front
  BUILD.line([5, 3, 4], [13, 3, 4], "minecraft:dark_oak_slab[type=bottom]");
  BUILD.line([5, 2, 3], [5, 3, 3], "minecraft:dark_oak_planks");
  BUILD.line([13, 2, 3], [13, 3, 3], "minecraft:dark_oak_planks");
  for (const x of range(7, 12)) {
    const odd = x % 2 === 1;
    BUILD.set(x, 2, -2, "minecraft:barrel[facing=south]");
    BUILD.set(x, 3, -2, odd ? "minecraft:chiseled_bookshelf[facing=south]" : "minecraft:bookshelf");
    BUILD.set(x, 4, -2, odd ? "minecraft:bookshelf" : "minecraft:chiseled_bookshelf[facing=south]");
  }
  for (const z of [-1, 0, 1]) {
    BUILD.set(7, 2, z, "minecraft:barrel[facing=east]");
    BUILD.set(11, 2, z, "minecraft:barrel[facing=west]");
    BUILD.set(7, 3, z, "minecraft:bookshelf");
    BUILD.set(11, 3, z, "minecraft:bookshelf");
  }
  BUILD.set(9, 5, 0, "minecraft:iron_chain[axis=y]");
  BUILD.set(9, 4, 0, "minecraft:lantern[hanging=true]");
  BUILD.set(8, 3, 3, "minecraft:jukebox");
  BUILD.set(10, 3, 3, "minecraft:cake[bites=1]");
  BUILD.set(6, 2, 3, "minecraft:cauldron");
  BUILD.set(12, 2, 3, "minecraft:composter");
  BUILD.set(7, 3, 3, "minecraft:potted_azalea_bush");
  BUILD.set(11, 3, 3, "minecraft:brewing_stand");
  BUILD.set(5, 4, 4, "minecraft:candle[candles=3,lit=true]");
  BUILD.set(13, 4, 4, "minecraft:candle[candles=2,lit=true]");
  BUILD.set(9, 4, 4, "minecraft:potted_red_tulip");
  for (const x of [6, 8, 10, 12]) chair(x, 2, 5, "north"); // bar stools
  for (const x of [1, 2, 3, 4, 14, 15, 16, 17]) {
    BUILD.set(x, 2, 3, "minecraft:barrel[facing=south]");
    BUILD.set(
      x,
      3,
      3,
      x % 2 === 0 ? "minecraft:bookshelf" : "minecraft:chiseled_bookshelf[facing=south]",
    );
  }

  // -- taproom: hearth seating, tables, rugs, lights -----------------------------------------------------------------------------
  BUILD.box([2, 2, 5], [4, 2, 9], "minecraft:red_carpet"); // hearth rug
  chair(5, 2, 6, "west");
  chair(5, 2, 8, "west");
  BUILD.set(3, 2, 7, "minecraft:spruce_slab[type=bottom]");
  BUILD.set(3, 3, 7, "minecraft:candle[candles=1,lit=true]");
  BUILD.set(2, 2, 10, "minecraft:potted_oak_sapling");
  for (const z of [5, 7, 9]) table(15, z, z !== 7); // long table, east
  BUILD.line([15, 3, 5], [15, 3, 9], "minecraft:spruce_slab[type=bottom]");
  for (const z of [6, 8]) {
    chair(14, 2, z, "east");
    chair(16, 2, z, "west");
  }
  table(3, 10);
  chair(2, 2, 10, "east");
  chair(4, 2, 10, "west");
  chair(3, 2, 11, "north");
  table(7, 10);
  chair(6, 2, 10, "east");
  chair(7, 2, 11, "north");
  BUILD.box([9, 2, 5], [9, 2, 11], "minecraft:red_carpet"); // runner from the bay arch
  BUILD.set(13, 2, 10, "minecraft:barrel[facing=up]");
  BUILD.set(17, 2, 10, "minecraft:hay_block[axis=y]");
  BUILD.set(17, 2, 4, "minecraft:potted_azalea_bush");
  BUILD.set(9, 5, 7, "minecraft:iron_chain[axis=y]"); // chandelier
  BUILD.set(9, 4, 7, "minecraft:lantern[hanging=true]");
  for (const [x, z] of [
    [6, 5],
    [12, 5],
    [6, 9],
    [12, 9],
  ] as const) {
    BUILD.set(x, 4, z, HANGING_LANTERN);
  }
  // stairs up along the south wall, east end
  for (let i = 0; i < 5; i++) BUILD.set(12 + i, 2 + i, 11, stair("east"));
  for (const x of [12, 13, 14, 15]) BUILD.set(x, 2, 11, "minecraft:barrel[facing=north]");
  BUILD.set(17, 2, 11, "minecraft:chest[facing=west]");

  // -- entrance bay interior ---------------------------------------------------------------------------------------------------------
  BUILD.box([7, 2, 14], [11, 2, 16], "minecraft:red_carpet");
  BUILD.set(7, 2, 13, "minecraft:barrel[facing=south]");
  BUILD.set(11, 2, 13, "minecraft:barrel[facing=south]");
  BUILD.set(7, 3, 13, "minecraft:potted_oak_sapling");
  BUILD.set(11, 3, 13, "minecraft:potted_red_tulip");
  BUILD.set(7, 4, 14, HANGING_LANTERN);
  BUILD.set(11, 4, 14, HANGING_LANTERN);

  // -- kitchen wing ------------------------------------------------------------------------------------------------------------------------
  BUILD.carve([18, 2, 7], [18, 3, 7]);
  BUILD.set(18, 2, 7, "minecraft:spruce_door[facing=west,half=lower,hinge=left]");
  BUILD.set(18, 3, 7, "minecraft:spruce_door[facing=west,half=upper,hinge=left]");
  BUILD.set(20, 2, 4, "minecraft:furnace[facing=south,lit=true]");
  BUILD.set(21, 2, 4, "minecraft:smoker[facing=south,lit=true]");
  BUILD.set(22, 2, 4, "minecraft:blast_furnace[facing=south,lit=true]");
  BUILD.set(23, 2, 4, "minecraft:crafting_table");
  BUILD.set(24, 2, 4, "minecraft:cauldron");
  BUILD.line([20, 3, 4], [24, 3, 4], "minecraft:spruce_slab[type=bottom]");
  for (const z of [5, 6, 8, 9, 10]) BUILD.set(24, 2, z, "minecraft:barrel[facing=west]");
  BUILD.set(24, 3, 9, "minecraft:hay_block[axis=y]");
  table(21, 8);
  chair(20, 2, 8, "east");
  chair(22, 2, 8, "west");

  // -- upper floor: two guest rooms, a reading nook and a sleeping nook ------------------------------------------------------------------
  BUILD.box([9, 7, 3], [9, 10, 11], "minecraft:spruce_planks"); // partition
  BUILD.carve([9, 7, 7], [9, 8, 7]);
  BUILD.set(9, 7, 7, "minecraft:spruce_door[facing=east,half=lower,hinge=left]");
  BUILD.set(9, 8, 7, "minecraft:spruce_door[facing=east,half=upper,hinge=left]");
  for (const [x, color] of [
    [2, "red"],
    [6, "orange"],
    [11, "blue"],
    [15, "green"],
  ] as const) {
    BUILD.set(x, 7, 3, `minecraft:${color}_bed[facing=north,part=head]`);
    BUILD.set(x, 7, 4, `minecraft:${color}_bed[facing=north,part=foot]`);
  }
  for (const x of [4, 13]) BUILD.set(x, 7, 3, "minecraft:barrel[facing=south]");
  BUILD.box([5, 7, 11], [7, 8, 11], "minecraft:bookshelf");
  BUILD.set(1, 7, 8, "minecraft:chest[facing=east]");
  BUILD.set(1, 8, 8, "minecraft:potted_azalea_bush");
  BUILD.box([2, 7, 6], [4, 7, 8], "minecraft:red_carpet");
  BUILD.box([11, 7, 6], [14, 7, 8], "minecraft:blue_carpet");
  BUILD.set(17, 7, 5, "minecraft:lectern[facing=west]");
  BUILD.set(17, 7, 7, "minecraft:enchanting_table");
  BUILD.carve([8, 7, 12], [10, 8, 12]); // reading nook in the entrance bay
  BUILD.set(8, 7, 13, stair("south"));
  BUILD.set(10, 7, 14, "minecraft:spruce_slab[type=bottom]");
  BUILD.box([7, 7, 16], [11, 8, 16], "minecraft:bookshelf");
  BUILD.set(9, 9, 15, HANGING_LANTERN);
  BUILD.carve([8, 7, 2], [10, 8, 2]); // sleeping nook in the back-bar bay
  BUILD.set(9, 7, -2, "minecraft:white_bed[facing=north,part=head]");
  BUILD.set(9, 7, -1, "minecraft:white_bed[facing=north,part=foot]");
  BUILD.set(8, 7, -2, "minecraft:barrel[facing=south]");
  BUILD.set(10, 7, -2, "minecraft:barrel[facing=south]");
  BUILD.set(9, 9, 0, HANGING_LANTERN);
});
