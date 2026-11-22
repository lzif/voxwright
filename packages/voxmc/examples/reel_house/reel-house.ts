// SPDX-License-Identifier: AGPL-3.0-only

// Reel house: the medieval tavern of the reel study (omggamer, tav/f_001-f_021), rebuilt from
// the frame readings.
//
// A stone ground floor with timber corner posts and a ring beam, a jettied half-timber upper
// floor with white infill, one roof over the main block and a front cross-gable on the right
// (`roofUnion`, the valleys where they meet), ridge cresting on both ridges, a brick chimney
// with a log band and a four-post cap, framed doors and windows with sills, shutters and window
// boxes, and a porch under the cross-gable on two posts with barrel feet. The front faces south.
// Paste on flat ground: the grass is y = -1, the plinth y = 0.
//
// Frames are read from the notes, not measured: the footprint is a choice (the reel shows no
// scale), the proportions follow tav/f_004 (stone, timber and roof about a third of the height
// each), and the roof follows the side-by-side finding of 2026-11-15 (straight profile, a
// gradient from deepslate tile at the eave to stone brick at the ridge).

import { Build, gradient, patches, shapes } from "../../src/index.ts";

export const BUILD = new Build({ seed: 23, views: "az200_el025;az135_el030;az320_el030" });
const SEED = 23;

// -- palette --------------------------------------------------------------------
const STONE = patches(
  [
    ["minecraft:stone_bricks", 5],
    ["minecraft:cobblestone", 2],
    ["minecraft:andesite", 1],
    ["minecraft:mossy_stone_bricks", 1],
  ],
  { scale: 1.5, salt: "stone" },
);
const PLINTH = patches(
  [["minecraft:cobbled_deepslate", 2], "minecraft:cobblestone", "minecraft:stone"],
  { scale: 1.5, salt: "plinth" },
);
const WHITE = patches([["minecraft:calcite", 3], "minecraft:white_concrete"], {
  scale: 2,
  salt: "infill",
});
const LOG = "minecraft:stripped_oak_log";
const POST = `${LOG}[axis=y]`;
const LOG_X = `${LOG}[axis=x]`;
const LOG_Z = `${LOG}[axis=z]`;
const ROOF = gradient(
  [
    "minecraft:deepslate_tile_stairs",
    "minecraft:deepslate_brick_stairs",
    "minecraft:cobbled_deepslate_stairs",
    "minecraft:stone_brick_stairs",
  ],
  { axis: "y", from: 12, to: 18, salt: "roof" },
);

// -- the plan ---------------------------------------------------------------------
// Ground floor x 0..14, z 0..10, walls y 1..4, ring beam y 5. Upper floor x 0..14, z 0..11 (the
// south side juts out one cell), walls y 6..11. Cross-gable wing x 9..13, z 11..14 over the porch.
const [X0, X1, Z0, Z1] = [0, 14, 0, 10];
const UZ1 = Z1 + 1;
const [WX0, WX1, WZ1] = [9, 13, 14];
const EAVE = 12;

BUILD.scope(() => {
  // -- ground and plinth -----------------------------------------------------------
  BUILD.box([-4, -1, -4], [18, -1, 21], "minecraft:grass_block");
  BUILD.box([10, -1, 15], [12, -1, 21], "minecraft:dirt_path");
  BUILD.place(shapes.box([X0 - 1, 0, Z0 - 1], [X1 + 1, 0, Z1 + 1], PLINTH, { seed: SEED }));
  BUILD.place(shapes.box([WX0, 0, Z1 + 1], [WX1, 0, WZ1], PLINTH, { seed: SEED })); // porch floor

  // -- ground floor: stone box, timber corner posts, ring beam -------------------
  BUILD.place(shapes.walls([X0, 1, Z0], [X1, 4, Z1], STONE, { seed: SEED }));
  for (const x of [X0, X1]) for (const z of [Z0, Z1]) BUILD.pillar([x, 1, z], 4, POST);
  BUILD.line([X0, 5, Z0], [X1, 5, Z0], LOG_X);
  BUILD.line([X0, 5, Z1], [X1, 5, Z1], LOG_X);
  BUILD.line([X0, 5, Z0 + 1], [X0, 5, Z1 - 1], LOG_Z);
  BUILD.line([X1, 5, Z0 + 1], [X1, 5, Z1 - 1], LOG_Z);
  // Stone pilasters under the jetty, each with an upside-down stair as its capital.
  for (const x of [X0, 5, X1]) {
    BUILD.pillar([x, 1, UZ1], 3, "minecraft:stone_bricks");
    BUILD.set(x, 4, UZ1, "minecraft:stone_brick_stairs[facing=north,half=top]");
  }

  // Openings in the stone: framed windows with plank sills and a framed door under the porch.
  const stoneWindow = { frame: POST, lintel: LOG_X, sill: "minecraft:spruce_slab" };
  BUILD.place(shapes.window([2, 2, Z1], [3, 3, Z1], "south", stoneWindow));
  BUILD.place(shapes.window([7, 2, Z1], [7, 3, Z1], "south", stoneWindow));
  BUILD.place(shapes.window([3, 2, Z0], [4, 3, Z0], "north", stoneWindow));
  BUILD.place(shapes.window([10, 2, Z0], [11, 3, Z0], "north", stoneWindow));
  BUILD.place(shapes.window([X0, 2, 4], [X0, 3, 6], "west", { ...stoneWindow, lintel: LOG_Z }));
  BUILD.place(shapes.window([X1, 2, 4], [X1, 3, 6], "east", { ...stoneWindow, lintel: LOG_Z }));
  BUILD.place(
    shapes.door([11, 1, Z1], "north", "minecraft:spruce_door", { frame: POST, lintel: LOG_X }),
  );

  // -- jetty and upper floor (half-timber with white infill) -----------------------
  BUILD.place(
    shapes.jetty([X0, 5, Z0], [X1, 5, Z1], "minecraft:spruce_planks", {
      sides: ["south"],
    }),
  );
  const frame = { post: POST, sill: LOG_X, beam: LOG_X };
  BUILD.place(
    shapes.bayWall([X0, 6, UZ1], [X1, 11, UZ1], WHITE, { ...frame, period: [3, 3, 2, 3, 3] }),
  );
  BUILD.place(
    shapes.bayWall([X0, 6, Z0], [X1, 11, Z0], WHITE, { ...frame, period: [3, 3, 2, 3, 3] }),
  );
  const side = { post: POST, sill: LOG_Z, beam: LOG_Z, period: [3, 3, 2, 3] };
  BUILD.place(shapes.bayWall([X0, 6, Z0], [X0, 11, UZ1], WHITE, side));
  BUILD.place(shapes.bayWall([X1, 6, Z0], [X1, 11, UZ1], WHITE, side));

  // Upper windows: two narrow lit panes in a bay, a log lintel, a window box under them.
  const upper = { lintel: LOG_X };
  for (const x0 of [1, 4]) {
    BUILD.place(shapes.window([x0, 7, UZ1], [x0 + 1, 8, UZ1], "south", upper));
    BUILD.place(shapes.windowBox([x0, 6, UZ1 + 1], [x0 + 1, 6, UZ1 + 1], "south"));
  }
  for (const x0 of [4, 9]) BUILD.place(shapes.window([x0, 7, Z0], [x0 + 1, 8, Z0], "north", upper));
  BUILD.place(shapes.window([X0, 7, 4], [X0, 8, 5], "west", { lintel: LOG_Z }));
  BUILD.place(shapes.window([X1, 7, 4], [X1, 8, 5], "east", { lintel: LOG_Z }));

  // -- the cross-gable wing over the porch -----------------------------------------------
  BUILD.box([WX0, 5, UZ1 + 1], [WX1, 5, WZ1], "minecraft:spruce_planks"); // porch ceiling
  BUILD.place(shapes.bayWall([WX0, 6, WZ1], [WX1, 11, WZ1], WHITE, { ...frame, period: 4 }));
  const wingSide = { post: POST, sill: LOG_Z, beam: LOG_Z, period: 3 };
  BUILD.place(shapes.bayWall([WX0, 6, UZ1], [WX0, 11, WZ1], WHITE, wingSide));
  BUILD.place(shapes.bayWall([WX1, 6, UZ1], [WX1, 11, WZ1], WHITE, wingSide));
  BUILD.place(shapes.window([10, 7, WZ1], [12, 8, WZ1], "south", { lintel: LOG_X }));
  BUILD.place(shapes.windowBox([10, 6, WZ1 + 1], [12, 6, WZ1 + 1], "south"));
  // A small hood over the wing window: stairs rising to the wall.
  for (let x = WX0; x <= WX1; x++)
    BUILD.set(x, 10, WZ1 + 1, "minecraft:spruce_stairs[facing=north,half=bottom]");
  // Porch posts on barrel feet, with knee braces under the wing's front beam.
  for (const x of [WX0, WX1]) {
    BUILD.set(x, 1, WZ1, "minecraft:barrel[facing=up]");
    BUILD.pillar([x, 2, WZ1], 3, POST);
  }
  BUILD.set(WX0 + 1, 4, WZ1, "minecraft:spruce_stairs[facing=west,half=top]");
  BUILD.set(WX1 - 1, 4, WZ1, "minecraft:spruce_stairs[facing=east,half=top]");
  BUILD.line([WX0, 4, UZ1 + 1], [WX0, 4, WZ1 - 1], LOG_Z);
  BUILD.line([WX1, 4, UZ1 + 1], [WX1, 4, WZ1 - 1], LOG_Z);

  // -- one roof: main gable along x, flush gable ends, and the cross-gable -----------
  BUILD.place(
    shapes.roofUnion(
      [
        { c1: [X0, EAVE, Z0 - 1], c2: [X1, EAVE, UZ1 + 1], ridge: "x" },
        { c1: [WX0 - 1, EAVE, 8], c2: [WX1 + 1, EAVE, WZ1], ridge: "z" },
      ],
      ROOF,
      { endFill: WHITE, seed: SEED },
    ),
  );
  // Gable windows high in the white fill.
  BUILD.place(shapes.window([X0, 14, 5], [X0, 15, 6], "west", { lintel: LOG_Z }));
  BUILD.place(shapes.window([X1, 14, 5], [X1, 15, 6], "east", { lintel: LOG_Z }));
  BUILD.place(shapes.window([11, 13, WZ1], [11, 13, WZ1], "south"));

  // Ridge cresting: posts rooted in the ridge row, a top-slab rail between them. The
  // main span is even, so the cresting stands on the north one of the two ridge rows (as the
  // `ridgeCap` of roofGable does); the wing ridge runs from the main slope to its gable.
  const RAIL = "minecraft:spruce_slab[type=top]";
  const ridgeY = EAVE + 6;
  for (let x = X0; x <= X1; x++) {
    const post = x % 3 === 0 || x === X1;
    if (post) BUILD.pillar([x, ridgeY, 5], 2, POST);
    else BUILD.set(x, ridgeY + 1, 5, RAIL);
  }
  const wingRidgeY = EAVE + 3;
  for (let z = 10; z <= WZ1; z++) {
    const post = z === 10 || z === 12 || z === WZ1;
    if (post) BUILD.pillar([11, wingRidgeY, z], 2, POST);
    else BUILD.set(11, wingRidgeY + 1, z, RAIL);
  }

  // -- chimney off the ridge on the right: brick, a log band, a four-post cap, smoke ---
  BUILD.place(
    shapes.chimney([11, 6, 2], 16, "minecraft:bricks", {
      size: 2,
      band: { block: LOG_X, rows: [13] },
      cap: "posts",
      slab: "minecraft:stone_brick_slab",
      post: "minecraft:stone_brick_wall",
      smoke: true,
    }),
  );

  // -- lights and garden ------------------------------------------------------------
  for (const x of [3, 8]) BUILD.set(x, 4, UZ1, "minecraft:lantern[hanging=true]");
  BUILD.set(11, 4, 12, "minecraft:lantern[hanging=true]");
  BUILD.pillar([WX0 - 1, 0, WZ1 + 2], 2, "minecraft:spruce_fence"); // lamp post by the path
  BUILD.set(WX0 - 1, 2, WZ1 + 2, "minecraft:lantern[hanging=false]");
  const rng = BUILD.rng("grass");
  for (let i = 0; i < 70; i++) {
    const x = rng.int(-4, 18);
    const z = rng.int(-4, 21);
    const nearHouse = x >= X0 - 2 && x <= X1 + 2 && z >= Z0 - 2 && z <= WZ1 + 2;
    const onPath = x >= 9 && x <= 13 && z >= 15;
    if (nearHouse || onPath) continue;
    BUILD.set(x, 0, z, rng.random() < 0.8 ? "minecraft:short_grass" : "minecraft:poppy");
  }
});
