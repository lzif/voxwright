// SPDX-License-Identifier: AGPL-3.0-only

// Stone watchtower: 5 x 5 shaft, belt course, corbelled crenellated parapet,
// turret roof on posts. Paste on flat ground; the foundation is y = 0.
//
// The stone is picked with the build's seeded RNG, so unlike the Python
// original (Mersenne Twister) the exact blocks differ; the structure does not.

import { Build } from "../../src/index.ts";
import { FOUNDATION, LANTERN, ROOF } from "./common.ts";

export const BUILD = new Build({ seed: 1207, views: "iso;az200_el025;top" });

const [X0, X1, Z0, Z1] = [0, 4, 0, 4];
const [CX, CZ] = [2, 2];
const TOP = 16; // last wall layer

/** Mossier near the ground, cleaner toward the top. */
function agedStone(x: number, y: number, z: number): string {
  const r = BUILD.rng(`stone ${x},${y},${z}`).random();
  const moss = 0.45 * (1 - y / TOP);
  if (r < moss) return "minecraft:mossy_stone_bricks";
  if (r < moss + 0.12) return "minecraft:cracked_stone_bricks";
  return "minecraft:stone_bricks";
}

BUILD.scope(() => {
  BUILD.box([X0 - 1, 0, Z0 - 1], [X1 + 1, 0, Z1 + 1], FOUNDATION);
  BUILD.walls([X0, 1, Z0], [X1, TOP, Z1], agedStone);
  BUILD.box([X0 + 1, 1, Z0 + 1], [X1 - 1, 1, Z1 - 1], "minecraft:spruce_planks");

  // belt course halfway up
  BUILD.walls([X0 - 1, 8, Z0 - 1], [X1 + 1, 8, Z1 + 1], "minecraft:stone_brick_slab[type=top]");

  // arrow slits, door, ladder
  for (const y of [5, 11]) {
    for (const [x, z, face] of [
      [CX, Z0, "north"],
      [CX, Z1, "south"],
      [X0, CZ, "west"],
      [X1, CZ, "east"],
    ] as const) {
      if (!(face === "south" && y === 5)) BUILD.pillar([x, y, z], 2, "minecraft:glass_pane");
    }
  }
  BUILD.set(CX, 2, Z1, "minecraft:spruce_door[facing=south,half=lower,hinge=left]");
  BUILD.set(CX, 3, Z1, "minecraft:spruce_door[facing=south,half=upper,hinge=left]");
  BUILD.line([CX, 2, Z0 + 1], [CX, TOP, Z0 + 1], "minecraft:ladder[facing=south]");

  // parapet platform, one block out on upside-down stair corbels
  const [P0X, P1X, P0Z, P1Z] = [X0 - 1, X1 + 1, Z0 - 1, Z1 + 1];
  BUILD.box([P0X, TOP + 1, P0Z], [P1X, TOP + 1, P1Z], "minecraft:polished_andesite");
  BUILD.set(CX, TOP + 1, Z0 + 1, "minecraft:spruce_trapdoor[facing=south,half=top]");
  BUILD.line([X0, TOP, P0Z], [X1, TOP, P0Z], "minecraft:stone_brick_stairs[facing=south,half=top]");
  BUILD.line([X0, TOP, P1Z], [X1, TOP, P1Z], "minecraft:stone_brick_stairs[facing=north,half=top]");
  BUILD.line([P0X, TOP, Z0], [P0X, TOP, Z1], "minecraft:stone_brick_stairs[facing=east,half=top]");
  BUILD.line([P1X, TOP, Z0], [P1X, TOP, Z1], "minecraft:stone_brick_stairs[facing=west,half=top]");
  BUILD.walls([P0X, TOP + 2, P0Z], [P1X, TOP + 2, P1Z], (x, _y, z) =>
    (x + z) % 2 === 0 ? "minecraft:stone_bricks" : "minecraft:stone_brick_wall",
  );
  for (const [x, z] of [
    [P0X, P0Z],
    [P1X, P0Z],
    [P0X, P1Z],
    [P1X, P1Z],
  ] as const) {
    BUILD.set(x, TOP + 3, z, LANTERN);
  }

  // turret roof on four posts, finial
  for (const [x, z] of [
    [X0, Z0],
    [X1, Z0],
    [X0, Z1],
    [X1, Z1],
  ] as const) {
    BUILD.pillar([x, TOP + 2, z], 2, "minecraft:spruce_fence");
  }
  BUILD.roofHip([X0 - 1, TOP + 4, Z0 - 1], [X1 + 1, TOP + 4, Z1 + 1], ROOF, {
    hip: "minecraft:deepslate_tiles",
  });
  BUILD.pillar([CX, TOP + 8, CZ], 2, "minecraft:deepslate_tile_wall");
  BUILD.set(CX, TOP + 10, CZ, "minecraft:lightning_rod[facing=up]");
});
