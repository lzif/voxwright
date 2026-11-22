// SPDX-License-Identifier: AGPL-3.0-only

// Barn with a lean-to forge, hay-loft hoist and a ridge cupola.
// Paste on flat ground; the foundation is y = 0..1. Main door faces south.

import { Build } from "../../src/index.ts";
import { range } from "../py.ts";
import {
  BARN_WALL,
  evenPosts,
  FOUNDATION,
  gableInfill,
  HANGING_LANTERN,
  LANTERN,
  window,
} from "./common.ts";

export const BUILD = new Build({ seed: 1207, views: "iso;az200_el025;az020_el030" });

const [X0, X1, Z0, Z1] = [0, 10, 0, 8]; // wall planes
const MID = Math.floor((X0 + X1) / 2);
const POST = "minecraft:stripped_spruce_log[axis=y]";

BUILD.scope(() => {
  // -- shell: foundation, plank walls on a post frame, girt band at y = 5 ----------
  BUILD.box([X0 - 1, 0, Z0 - 1], [X1 + 1, 1, Z1 + 1], FOUNDATION);
  BUILD.box([X0, 1, Z0], [X1, 1, Z1], [["minecraft:spruce_planks", 2], "minecraft:coarse_dirt"]);
  BUILD.walls([X0, 2, Z0], [X1, 8, Z1], BARN_WALL);
  const xs = evenPosts(X0, X1);
  const zs = evenPosts(Z0, Z1);
  BUILD.line([X0, 5, Z0], [X1, 5, Z0], "minecraft:spruce_log[axis=x]");
  BUILD.line([X0, 5, Z1], [X1, 5, Z1], "minecraft:spruce_log[axis=x]");
  BUILD.line([X0, 5, Z0], [X0, 5, Z1], "minecraft:spruce_log[axis=z]");
  BUILD.line([X1, 5, Z0], [X1, 5, Z1], "minecraft:spruce_log[axis=z]");
  for (const x of xs) for (const z of [Z0, Z1]) BUILD.pillar([x, 2, z], 7, POST);
  for (const z of zs) for (const x of [X0, X1]) BUILD.pillar([x, 2, z], 7, POST);

  // -- big south door with a framed opening -----------------------------------
  BUILD.carve([MID - 1, 2, Z1], [MID + 1, 5, Z1]);
  for (const x of [MID - 2, MID + 2])
    BUILD.pillar([x, 2, Z1], 5, "minecraft:stripped_dark_oak_log[axis=y]");
  BUILD.line([MID - 2, 6, Z1], [MID + 2, 6, Z1], "minecraft:stripped_dark_oak_log[axis=x]");
  for (const x of [MID - 3, MID + 3]) {
    BUILD.pillar([x, 2, Z1 + 1], 2, "minecraft:spruce_fence");
    BUILD.set(x, 4, Z1 + 1, LANTERN);
  }
  for (const x of [X0 + 2, X1 - 2]) window(BUILD, x, 3, Z1, "south", { flowerBox: false });
  for (const z of [Z0 + 2, Z1 - 2]) window(BUILD, X0, 3, z, "west", { flowerBox: false });

  // -- roof: gable end to the south, spruce band, wooden gable ends -------------
  BUILD.roofGable([X0 - 1, 9, Z0 - 1], [X1 + 1, 9, Z1 + 1], "minecraft:dark_oak_stairs", {
    ridge: "z",
    verge: "minecraft:spruce_stairs",
    eave: "minecraft:spruce_stairs",
  });
  for (const plane of [Z0, Z1]) {
    gableInfill(BUILD, plane, "z", 9, X0 - 1, X1 + 1, {
      kingpost: false,
      fill: [["minecraft:spruce_planks", 3], "minecraft:stripped_spruce_wood"],
      edge: "minecraft:stripped_spruce_log",
    });
  }

  // hay loft door with a hoist beam, chain and barrel
  BUILD.box([MID - 1, 10, Z1], [MID + 1, 11, Z1], "minecraft:air");
  BUILD.set(MID, 10, Z1, "minecraft:hay_block[axis=x]");
  BUILD.line([MID, 13, Z1 - 1], [MID, 13, Z1 + 2], "minecraft:stripped_spruce_log[axis=z]");
  BUILD.line([MID, 12, Z1 + 2], [MID, 10, Z1 + 2], "minecraft:iron_chain[axis=y]");
  BUILD.set(MID, 9, Z1 + 2, "minecraft:barrel[facing=up]");

  // ridge cupola: the one vertical accent on a long roof
  const cz = Math.floor((Z0 + Z1) / 2);
  const ry = 15;
  for (const dx of [-1, 1])
    for (const dz of [-1, 1]) BUILD.pillar([MID + dx, ry, cz + dz], 2, POST);
  BUILD.box(
    [MID, ry, cz - 1],
    [MID, ry + 1, cz + 1],
    "minecraft:spruce_trapdoor[facing=east,half=bottom,open=true]",
  );
  BUILD.box([MID - 1, ry, cz], [MID + 1, ry + 1, cz], "minecraft:air");
  BUILD.set(MID, ry, cz, "minecraft:spruce_planks");
  BUILD.roofHip([MID - 2, ry + 2, cz - 2], [MID + 2, ry + 2, cz + 2], "minecraft:dark_oak_stairs", {
    hip: "minecraft:dark_oak_planks",
  });
  BUILD.set(MID, ry + 5, cz, "minecraft:lightning_rod[facing=up]");

  // -- interior: hay stack and storage ---------------------------------------------
  BUILD.box([X0 + 1, 2, Z0 + 1], [X0 + 3, 3, Z0 + 2], "minecraft:hay_block[axis=y]");
  for (const z of range(Z0 + 1, Z1 - 1)) {
    BUILD.set(
      X1 - 1,
      2,
      z,
      z % 2 ? "minecraft:chest[facing=west]" : "minecraft:barrel[facing=west]",
    );
  }
  BUILD.set(MID, 8, cz, HANGING_LANTERN);

  // -- lean-to forge on the east wall --------------------------------------------
  const FX = X1 + 5;
  BUILD.box([X1 + 1, 0, Z0 + 1], [FX, 1, Z1 - 1], FOUNDATION);
  BUILD.box(
    [X1 + 2, 1, Z0 + 2],
    [FX - 1, 1, Z1 - 2],
    [["minecraft:stone_bricks", 2], "minecraft:cobblestone", "minecraft:gravel"],
  );
  for (const z of [Z0 + 1, Z1 - 1]) BUILD.pillar([FX, 2, z], 2, POST);
  for (const [i, x] of range(FX, X1, -1).entries()) {
    // lean-to roof climbs toward the barn
    BUILD.line(
      [x, 4 + i, Z0 + 1],
      [x, 4 + i, Z1 - 1],
      "minecraft:dark_oak_stairs[facing=west,half=bottom]",
    );
  }
  for (const z of [Z0 + 1, Z1 - 1]) {
    BUILD.set(FX, 4, z, LANTERN);
    BUILD.set(FX, 5, z, "minecraft:dark_oak_slab[type=bottom]");
  }
  const tools = [
    "minecraft:blast_furnace[facing=east,lit=true]",
    "minecraft:anvil[facing=north]",
    "minecraft:grindstone[face=floor,facing=east]",
    "minecraft:smithing_table",
    "minecraft:lava_cauldron",
    "minecraft:stonecutter[facing=east]",
  ];
  for (const [i, block] of tools.entries()) BUILD.set(X1 + 2, 2, Z0 + 2 + i, block);
  BUILD.box([FX - 1, 2, Z0 + 2], [FX - 1, 3, Z0 + 2], "minecraft:barrel[facing=up]");
});
