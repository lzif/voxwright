// SPDX-License-Identifier: AGPL-3.0-only

// Storehouse: a two-story medieval storage building, no terrain.
//
// Ground floor in mixed stone between spruce posts, jettied plaster upper
// floor, steep thick deepslate roof with dark oak trim, a front wall dormer
// with a hoist for the loft, a loading dock and a woodshed lean-to.
// Front (big doors) faces south. Paste on flat ground; the plinth is y = 0.

import { Build, Geometry, type Material, patches, shapes } from "../../src/index.ts";
import { range } from "../py.ts";

export const BUILD = new Build({ seed: 31, views: "az200_el025;az330_el030;az135_el035" });

// -- palette --------------------------------------------------------------------
const STONE = patches(
  [
    ["minecraft:stone_bricks", 4],
    ["minecraft:cobblestone", 2],
    ["minecraft:mossy_stone_bricks", 1],
    ["minecraft:cracked_stone_bricks", 1],
    ["minecraft:andesite", 1],
  ],
  { scale: 1.5, salt: "stone" },
);
const PLINTH = patches(
  [["minecraft:cobbled_deepslate", 2], ["minecraft:cobblestone", 2], "minecraft:deepslate_bricks"],
  { scale: 1.5, salt: "plinth" },
);
const PLASTER = patches([["minecraft:calcite", 5], "minecraft:diorite"], {
  scale: 2,
  salt: "plaster",
});
const ROOF = patches(
  [
    ["minecraft:deepslate_brick_stairs", 3],
    ["minecraft:cobbled_deepslate_stairs", 2],
    "minecraft:deepslate_tile_stairs",
  ],
  { scale: 2, salt: "roof" },
);
const POST = "minecraft:stripped_spruce_log[axis=y]";
const TRIM = "minecraft:dark_oak"; // + _stairs / _planks / _slab / _log ...
const LANTERN = "minecraft:lantern";
const HANGING = "minecraft:lantern[hanging=true]";

// -- dimensions -----------------------------------------------------------------
// Three depth planes per facade: posts (outer), ground infill (1 in),
// and the jettied upper floor whose posts sit 1 out from the ground posts.
const [X0, X1, Z0, Z1] = [0, 15, 0, 10]; // ground-floor post planes
const GROUND_POSTS_X = [0, 4, 11, 15];
const GROUND_POSTS_Z = [0, 5, 10];
const [UX0, UX1, UZ0, UZ1] = [X0 - 1, X1 + 1, Z0 - 1, Z1 + 1]; // upper-floor post planes
const UPPER_POSTS_X = [UX0, 4, 11, UX1];
const EAVE_Y = 11;
const [DORMER_X0, DORMER_X1] = [3, 12]; // front wall dormer roof footprint (x)

type Face = "north" | "south" | "west" | "east";
const OUT: Record<Face, readonly [number, number]> = {
  north: [0, -1],
  south: [0, 1],
  west: [-1, 0],
  east: [1, 0],
};
const INWARD: Record<Face, Face> = { north: "south", south: "north", west: "east", east: "west" };

function stair(name: string, facing: string, top = false): string {
  return `minecraft:${name}_stairs[facing=${facing},half=${top ? "top" : "bottom"}]`;
}

type EdgeTest = (
  x: number,
  y: number,
  z: number,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y0: number,
) => boolean;

/**
 * Make a stair roof read as thick: a full block under every stair. Edge cells
 * (eave row and gable verges) get dark oak planks, a two-block fascia like the
 * references; the rest gets the stair's own full block.
 */
function thicken(geo: Geometry, underEdge: EdgeTest): void {
  const [[x0, y0, z0], [x1, , z1]] = geo.bounds() as readonly [
    readonly number[],
    readonly number[],
  ] as [[number, number, number], [number, number, number]];
  const fullBlocks: Record<string, string> = {
    "minecraft:deepslate_brick": "minecraft:deepslate_bricks",
    "minecraft:deepslate_tile": "minecraft:deepslate_tiles",
    "minecraft:dark_oak": "minecraft:dark_oak_planks",
  };
  for (const [x, y, z, block] of geo.cells()) {
    if (BUILD.get(x, y - 1, z) !== null) continue;
    if (underEdge(x, y, z, x0, x1, z0, z1, y0)) {
      BUILD.set(x, y - 1, z, `${TRIM}_planks`);
    } else {
      const full = (block.split("[")[0] as string).replace("_stairs", "");
      BUILD.set(x, y - 1, z, fullBlocks[full] ?? full);
    }
  }
}

/** (x, z) cells along one facade between lo..hi on the given plane. */
function facadeCells(
  side: Face,
  planeLo: number,
  planeHi: number,
  lo: number,
  hi: number,
): [number, number][] {
  if (side === "north" || side === "south") {
    const z = side === "north" ? planeLo : planeHi;
    return range(lo, hi + 1).map((x) => [x, z]);
  }
  const x = side === "west" ? planeLo : planeHi;
  return range(lo, hi + 1).map((z) => [x, z]);
}

interface WindowOptions {
  width?: number;
  height?: number;
  glass?: string;
  shutters?: string;
  lintel?: string;
}

/** Window set into an infill plane, framed in the plane in front of it. */
function window(
  x: number,
  y: number,
  z: number,
  face: Face,
  {
    width = 1,
    height = 2,
    glass = "minecraft:glass_pane",
    shutters = "dark_oak",
    lintel,
  }: WindowOptions = {},
): void {
  const [ox, oz] = OUT[face];
  const [sx, sz] = face === "north" || face === "south" ? [1, 0] : [0, 1];
  for (let i = 0; i < width; i++) BUILD.pillar([x + i * sx, y, z + i * sz], height, glass);
  for (const i of [-1, width]) {
    BUILD.pillar(
      [x + i * sx + ox, y, z + i * sz + oz],
      height,
      `minecraft:${shutters}_trapdoor[facing=${face},half=bottom,open=true]`,
    );
  }
  if (lintel) {
    for (let i = 0; i < width; i++)
      BUILD.set(x + i * sx, y + height, z + i * sz, stair(lintel, INWARD[face], true));
  }
}

/** Planter in front of a window: dirt + plants, trapdoor front, corbel under. */
function flowerBox(
  x: number,
  y: number,
  z: number,
  face: Face,
  {
    width = 2,
    plants = ["minecraft:sweet_berry_bush[age=2]"],
  }: { width?: number; plants?: string[] } = {},
): void {
  const [ox, oz] = OUT[face];
  const [sx, sz] = face === "north" || face === "south" ? [1, 0] : [0, 1];
  for (let i = 0; i < width; i++) {
    const [cx, cz] = [x + i * sx, z + i * sz];
    BUILD.set(cx, y, cz, "minecraft:rooted_dirt");
    BUILD.set(cx, y + 1, cz, plants[i % plants.length] as string);
    BUILD.set(
      cx + ox,
      y,
      cz + oz,
      `minecraft:spruce_trapdoor[facing=${face},half=bottom,open=true]`,
    );
    BUILD.set(cx, y - 1, cz, stair("spruce", INWARD[face], true));
  }
}

/** Timber-and-plaster triangle under a ridge-x gable, in plane x = plane. */
function gableInfill(
  plane: number,
  y0: number,
  lo: number,
  hi: number,
  { kingpost = true, windowAt }: { kingpost?: boolean; windowAt?: readonly number[] } = {},
): void {
  const mid = Math.floor((lo + hi) / 2);
  let k = 0;
  while (lo + k + 1 <= hi - k - 1) {
    const a = lo + k + 1;
    const b = hi - k - 1;
    for (let z = a; z <= b; z++) {
      let block: Material;
      if (kingpost && z === mid) block = POST;
      else if (z === a || z === b) block = `${TRIM}_log[axis=z]`;
      else block = PLASTER;
      BUILD.set(plane, y0 + k, z, block);
    }
    k++;
  }
  if (windowAt) {
    const [wy, ...zs] = windowAt as [number, ...number[]];
    for (const z of zs) BUILD.set(plane, wy, z, "minecraft:glass_pane");
  }
}

BUILD.scope(() => {
  // =========================================================================
  // plinth, floor, loading dock
  // =========================================================================
  BUILD.box([X0 - 1, 0, Z0 - 1], [X1 + 1, 0, Z1 + 1], PLINTH);
  BUILD.box([X0 + 2, 0, Z0 + 2], [X1 - 2, 0, Z1 - 2], "minecraft:spruce_planks");
  BUILD.box([3, 0, Z1 + 2], [12, 0, Z1 + 3], PLINTH); // dock
  BUILD.line([5, 0, Z1 + 4], [10, 0, Z1 + 4], stair("stone_brick", "north")); // steps up

  // =========================================================================
  // ground floor: posts on the outer plane, stone infill 1 block in
  // =========================================================================
  for (const x of GROUND_POSTS_X) for (const z of [Z0, Z1]) BUILD.pillar([x, 1, z], 4, POST);
  for (const z of GROUND_POSTS_Z) for (const x of [X0, X1]) BUILD.pillar([x, 1, z], 4, POST);
  BUILD.walls([X0 + 1, 1, Z0 + 1], [X1 - 1, 4, Z1 - 1], STONE);
  // floor beam on the post plane
  BUILD.line([X0, 5, Z0], [X1, 5, Z0], "minecraft:stripped_spruce_log[axis=x]");
  BUILD.line([X0, 5, Z1], [X1, 5, Z1], "minecraft:stripped_spruce_log[axis=x]");
  BUILD.line([X0, 5, Z0 + 1], [X0, 5, Z1 - 1], "minecraft:stripped_spruce_log[axis=z]");
  BUILD.line([X1, 5, Z0 + 1], [X1, 5, Z1 - 1], "minecraft:stripped_spruce_log[axis=z]");
  // sloped stone skirt in the recesses between posts
  for (const side of ["north", "south"] as const) {
    for (const [x, z] of facadeCells(side, Z0, Z1, X0 + 1, X1 - 1)) {
      if (!GROUND_POSTS_X.includes(x)) BUILD.set(x, 1, z, stair("stone_brick", INWARD[side]));
    }
  }
  for (const side of ["west", "east"] as const) {
    for (const [x, z] of facadeCells(side, X0, X1, Z0 + 1, Z1 - 1)) {
      if (!GROUND_POSTS_Z.includes(z)) BUILD.set(x, 1, z, stair("stone_brick", INWARD[side]));
    }
  }

  // barred storage windows with stone lintels
  const barred = { glass: "minecraft:iron_bars", shutters: "spruce", lintel: "stone_brick" };
  for (const x of [2, 13]) window(x, 2, Z0 + 1, "north", barred);
  window(2, 2, Z1 - 1, "south", barred);
  window(13, 2, Z1 - 1, "south", barred);
  for (const z of [2, 8]) window(X0 + 1, 2, z, "west", barred);

  // big double doors, framed in dark oak, lanterns on fences beside them
  for (const x of [6, 9]) BUILD.pillar([x, 1, Z1], 4, "minecraft:stripped_dark_oak_log[axis=y]");
  BUILD.box([7, 1, Z1 - 1], [8, 4, Z1 - 1], "minecraft:air");
  BUILD.set(7, 1, Z1 - 1, "minecraft:spruce_door[facing=north,half=lower,hinge=left]");
  BUILD.set(7, 2, Z1 - 1, "minecraft:spruce_door[facing=north,half=upper,hinge=left]");
  BUILD.set(8, 1, Z1 - 1, "minecraft:spruce_door[facing=north,half=lower,hinge=right]");
  BUILD.set(8, 2, Z1 - 1, "minecraft:spruce_door[facing=north,half=upper,hinge=right]");
  BUILD.box([7, 3, Z1 - 1], [8, 4, Z1 - 1], "minecraft:spruce_planks");
  BUILD.line([7, 4, Z1], [8, 4, Z1], stair("dark_oak", "north", true));
  for (const x of [5, 10]) {
    BUILD.pillar([x, 1, Z1], 3, `${TRIM}_fence`);
    BUILD.set(x, 4, Z1, HANGING);
  }

  // =========================================================================
  // jetty: upper deck 1 block out, alternating corbel band underneath
  // =========================================================================
  BUILD.box([UX0, 6, UZ0], [UX1, 6, UZ1], `${TRIM}_planks`);
  const corbel = (i: number, facing: Face): string =>
    i % 2 ? stair("dark_oak", facing, true) : `${TRIM}_slab[type=top]`;
  for (const [i, [x, z]] of facadeCells("north", UZ0, UZ1, UX0, UX1).entries())
    BUILD.set(x, 5, z, corbel(i, "south"));
  for (const [i, [x, z]] of facadeCells("south", UZ0, UZ1, UX0, UX1).entries()) {
    if (!(5 <= x && x <= 10)) BUILD.set(x, 5, z, corbel(i, "north")); // doorway stays open under the dormer platform
  }
  for (const [i, [x, z]] of facadeCells("west", UX0, UX1, UZ0 + 1, UZ1 - 1).entries())
    BUILD.set(x, 5, z, corbel(i, "east"));
  for (const [i, [x, z]] of facadeCells("east", UX0, UX1, UZ0 + 1, UZ1 - 1).entries())
    BUILD.set(x, 5, z, corbel(i, "west"));

  // =========================================================================
  // upper floor: posts and plaster flush on the jettied plane; depth comes
  // from shutters, flower boxes and the corbel band, not from a recess
  // =========================================================================
  for (const x of UPPER_POSTS_X) for (const z of [UZ0, UZ1]) BUILD.pillar([x, 6, z], 5, POST);
  for (const z of [UZ0, 5, UZ1]) for (const x of [UX0, UX1]) BUILD.pillar([x, 6, z], 5, POST);
  BUILD.walls([UX0, 7, UZ0], [UX1, 9, UZ1], PLASTER);
  // sill (y=6) and plate (y=10) beams on the post plane
  for (const y of [6, 10]) {
    for (const z of [UZ0, UZ1]) {
      for (const x of range(UX0 + 1, UX1)) {
        if (!UPPER_POSTS_X.includes(x)) BUILD.set(x, y, z, "minecraft:stripped_spruce_log[axis=x]");
      }
    }
    for (const x of [UX0, UX1]) {
      for (const z of range(UZ0 + 1, UZ1)) {
        if (z !== 5) BUILD.set(x, y, z, "minecraft:stripped_spruce_log[axis=z]");
      }
    }
  }
  // rivets on the posts
  for (const x of UPPER_POSTS_X) {
    BUILD.set(x, 9, UZ1 + 1, `${TRIM}_button[face=wall,facing=south]`);
    BUILD.set(x, 9, UZ0 - 1, `${TRIM}_button[face=wall,facing=north]`);
  }

  // upper windows: shutters on the post plane, top-slab lintel, two flower boxes
  for (const x of [1, 12]) {
    window(x, 7, UZ0, "north", { width: 2 });
    window(x, 7, UZ1, "south", { width: 2 });
  }
  flowerBox(1, 6, UZ1 + 1, "south");
  flowerBox(12, 6, UZ1 + 1, "south", { plants: ["minecraft:azure_bluet", "minecraft:poppy"] });
  for (const x of [6, 9]) window(x, 7, UZ0, "north");
  for (const z of [2, 8]) {
    window(UX0, 7, z, "west");
    window(UX1, 7, z, "east");
  }

  // loft door in the dormer bay, with a gated landing for loading
  BUILD.box([7, 7, UZ1], [8, 9, UZ1], "minecraft:air");
  BUILD.line([7, 7, UZ1], [8, 7, UZ1], `${TRIM}_fence_gate[facing=south]`);
  for (const x of [6, 9])
    BUILD.pillar(
      [x, 7, UZ1 + 1],
      3,
      "minecraft:spruce_trapdoor[facing=south,half=bottom,open=true]",
    );
  BUILD.box([6, 5, UZ1], [9, 5, UZ1], stair("dark_oak", "north", true));

  // =========================================================================
  // roofs: front wall dormer, then the main roof around it
  // =========================================================================
  const main = shapes.roofGable([UX0 - 1, EAVE_Y, UZ0 - 1], [UX1 + 1, EAVE_Y, UZ1 + 1], ROOF, {
    ridge: "x",
    verge: `${TRIM}_stairs`,
    eave: `${TRIM}_stairs`,
    seed: BUILD.seed,
  });
  const dormer = shapes.roofGable([DORMER_X0, EAVE_Y, 6], [DORMER_X1, EAVE_Y, UZ1 + 1], ROOF, {
    ridge: "z",
    verge: `${TRIM}_stairs`,
    eave: `${TRIM}_stairs`,
    seed: BUILD.seed,
  });

  const dormerTop = (x: number): number => EAVE_Y + Math.min(x - DORMER_X0, DORMER_X1 - x);
  const mainTop = (z: number): number => EAVE_Y + (UZ1 + 1 - z); // height of the main roof's south slope at z

  const keepMain = new Geometry();
  for (const [x, y, z, b] of main.cells()) {
    const insideDormer = DORMER_X0 <= x && x <= DORMER_X1 && z >= 6 && y < dormerTop(x);
    if (!insideDormer) keepMain.set(x, y, z, b);
  }
  const keepDormer = new Geometry();
  for (const [x, y, z, b] of dormer.cells()) {
    if (y > mainTop(z) || z > UZ1) keepDormer.set(x, y, z, b);
  }
  const placedMain = BUILD.place(keepMain);
  const placedDormer = BUILD.place(keepDormer);

  thicken(placedMain, (x, y, _z, x0, x1, _z0, _z1, y0) => x === x0 || x === x1 || y === y0);
  thicken(placedDormer, (x, y) => x === DORMER_X0 || x === DORMER_X1 || y === EAVE_Y);

  // gable ends: timber + plaster, small window
  for (const plane of [UX0, UX1])
    gableInfill(plane, EAVE_Y, UZ0 - 1, UZ1 + 1, { windowAt: [13, 4, 6] });
  // dormer gable on the front plane, loft opening at its foot
  for (let k = 0; DORMER_X0 + k + 1 <= DORMER_X1 - k - 1; k++) {
    for (const x of range(DORMER_X0 + k + 1, DORMER_X1 - k)) {
      const edge = x === DORMER_X0 + k + 1 || x === DORMER_X1 - k - 1;
      BUILD.set(x, EAVE_Y + k, UZ1, edge ? `${TRIM}_log[axis=x]` : PLASTER);
    }
  }
  BUILD.box([7, EAVE_Y, UZ1], [8, EAVE_Y + 1, UZ1], POST);

  // ridge cap and crossed beam "horns" at both gable peaks, with hanging lanterns
  const ridgeZ = Math.floor((UZ0 - 1 + UZ1 + 1) / 2);
  const ridgeY = EAVE_Y + Math.floor((UZ1 + 1 - (UZ0 - 1)) / 2);
  BUILD.line(
    [UX0 - 1, ridgeY + 1, ridgeZ],
    [UX1 + 1, ridgeY + 1, ridgeZ],
    `${TRIM}_slab[type=bottom]`,
  );
  for (const [x, out] of [
    [UX0 - 1, -1],
    [UX1 + 1, 1],
  ] as const) {
    for (const k of [1, 2]) {
      BUILD.set(x, ridgeY + k, ridgeZ - k, stair("dark_oak", "north"));
      BUILD.set(x, ridgeY + k, ridgeZ + k, stair("dark_oak", "south"));
    }
    BUILD.set(x, ridgeY + 1, ridgeZ, `${TRIM}_planks`);
    BUILD.set(x + out, ridgeY, ridgeZ, `${TRIM}_log[axis=x]`);
    BUILD.line(
      [x + out, ridgeY - 1, ridgeZ],
      [x + out, ridgeY - 3, ridgeZ],
      "minecraft:iron_chain[axis=y]",
    );
    BUILD.set(x + out, ridgeY - 4, ridgeZ, HANGING);
  }
  // ridge vent cupola: louvred box with its own little hip roof
  const cy = ridgeY + 2;
  for (const x of [6, 9])
    for (const z of [ridgeZ - 1, ridgeZ + 1]) BUILD.pillar([x, cy, z], 2, POST);
  for (const x of [7, 8]) {
    for (const [z, face] of [
      [ridgeZ - 1, "north"],
      [ridgeZ + 1, "south"],
    ] as const) {
      BUILD.pillar(
        [x, cy, z],
        2,
        `minecraft:spruce_trapdoor[facing=${face},half=bottom,open=true]`,
      );
    }
  }
  BUILD.box([7, cy - 1, ridgeZ], [8, cy - 1, ridgeZ], `${TRIM}_planks`);
  BUILD.box([7, cy, ridgeZ], [8, cy + 1, ridgeZ], "minecraft:air");
  BUILD.roofHip([5, cy + 2, ridgeZ - 2], [10, cy + 2, ridgeZ + 2], ROOF, { hip: `${TRIM}_planks` });
  BUILD.set(7, cy + 4, ridgeZ, "minecraft:lightning_rod[facing=up]");

  // eave-corner lanterns hanging under the fascia
  for (const x of [UX0 - 1, UX1 + 1])
    for (const z of [UZ0 - 1, UZ1 + 1]) BUILD.set(x, EAVE_Y - 2, z, HANGING);

  // hoist: beam out of the dormer gable, chain, hanging barrel
  const hoistY = EAVE_Y + 3;
  BUILD.line([7, hoistY, UZ1 - 1], [7, hoistY, UZ1 + 3], "minecraft:stripped_dark_oak_log[axis=z]");
  BUILD.line([7, hoistY - 1, UZ1 + 3], [7, hoistY - 4, UZ1 + 3], "minecraft:iron_chain[axis=y]");
  BUILD.set(7, hoistY - 5, UZ1 + 3, "minecraft:barrel[facing=up]");

  // =========================================================================
  // woodshed lean-to on the east side
  // =========================================================================
  const SX = X1 + 5;
  BUILD.box([X1 + 1, 0, 1], [SX, 0, 9], PLINTH);
  for (const z of [1, 5, 9]) BUILD.pillar([SX, 1, z], 3, POST);
  BUILD.line([SX, 4, 0], [SX, 4, 10], stair("dark_oak", "west"));
  BUILD.line([SX - 1, 5, 0], [SX - 1, 5, 10], stair("dark_oak", "west"));
  BUILD.box([X1 + 2, 5, 0], [SX - 2, 5, 10], `${TRIM}_slab[type=bottom]`);
  BUILD.box(
    [X1 + 2, 1, 2],
    [SX - 1, 2, 4],
    [
      ["minecraft:oak_log[axis=z]", 2],
      "minecraft:spruce_log[axis=z]",
      "minecraft:birch_log[axis=z]",
    ],
  );
  BUILD.box([X1 + 2, 3, 2], [SX - 2, 3, 4], "minecraft:oak_log[axis=z]");
  BUILD.box([X1 + 2, 1, 6], [X1 + 3, 2, 8], "minecraft:barrel[facing=up]");
  BUILD.set(SX - 1, 1, 7, "minecraft:hay_block[axis=x]");
  BUILD.set(SX - 1, 1, 8, "minecraft:composter[level=4]");
  BUILD.set(SX, 4, 5, HANGING.replace("hanging=true", "hanging=false"));

  // =========================================================================
  // dock props: the storage touch outside
  // =========================================================================
  BUILD.box([3, 1, Z1 + 2], [4, 2, Z1 + 2], "minecraft:barrel[facing=up]");
  BUILD.set(3, 1, Z1 + 3, "minecraft:barrel[facing=south]");
  BUILD.set(5, 1, Z1 + 2, "minecraft:composter[level=7]");
  BUILD.box([11, 1, Z1 + 2], [12, 1, Z1 + 3], "minecraft:hay_block[axis=x]");
  BUILD.set(12, 2, Z1 + 2, "minecraft:hay_block[axis=z]");
  BUILD.set(10, 1, Z1 + 2, "minecraft:barrel[facing=east]");
  for (const x of [2, 13]) {
    BUILD.pillar([x, 1, Z1 + 3], 2, `${TRIM}_fence`);
    BUILD.set(x, 3, Z1 + 3, LANTERN);
  }

  // =========================================================================
  // interior: shelves, barrels, chests below; hay loft above
  // =========================================================================
  BUILD.line([3, 2, Z0 + 2], [12, 2, Z0 + 2], "minecraft:spruce_shelf[facing=south]");
  BUILD.line([3, 3, Z0 + 2], [12, 3, Z0 + 2], "minecraft:spruce_shelf[facing=south]");
  BUILD.box([X0 + 2, 1, 3], [X0 + 2, 3, 7], "minecraft:barrel[facing=east]");
  BUILD.box([X1 - 2, 1, 3], [X1 - 2, 1, 6], "minecraft:chest[facing=west]");
  BUILD.line([X1 - 2, 1, 7], [X1 - 2, 6, 7], "minecraft:ladder[facing=west]");
  BUILD.set(7, 4, 5, HANGING);
  BUILD.box([1, 7, 1], [4, 8, 3], "minecraft:hay_block[axis=y]");
  BUILD.box([11, 7, 1], [14, 7, 2], "minecraft:barrel[facing=up]");
  BUILD.set(7, 10, 5, HANGING);
});
