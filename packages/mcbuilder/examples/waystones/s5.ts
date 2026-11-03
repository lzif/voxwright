// SPDX-License-Identifier: AGPL-3.0-only

// Waystone variant 5: Classic Ruin (5x5x5).
//
// A compact 5x5x5 waystone using the classic_ruin palette: stone bricks, mossy
// stone bricks, cracked stone bricks, chiseled stone bricks, polished
// andesite, iron chains, lanterns.
//
// Layout:
//   y=4 : hanging lantern at (2,4,2)
//   y=3 : lostqol:waystone at (2,3,2)
//   y=2 : pedestal (center)
//   y=1 : stepped base (3x3 center + inward-facing stair edges)
//   y=0 : floor (5x5 with material variation, sits on top of terrain)

import { Build } from "../../src/index.ts";

const STONE_BRICK = "minecraft:stone_bricks";
const MOSSY_SB = "minecraft:mossy_stone_bricks";
const CRACKED_SB = "minecraft:cracked_stone_bricks";
const CHISELED_SB = "minecraft:chiseled_stone_bricks";
const POLISHED_AND = "minecraft:polished_andesite";
const IRON_CHAIN = "minecraft:iron_chain[axis=y]";
const LANTERN = "minecraft:lantern";
const WAYSTONE = "lostqol:waystone";

const VIEWS = ["iso", "az000_el025", "az090_el025", "az180_el025", "az270_el025", "top"];

export const BUILD = new Build({ seed: 201, views: VIEWS });

BUILD.scope(() => {
  // Floor y=0: 5x5 with material variation and trim
  for (let x = 0; x < 5; x++) {
    for (let z = 0; z < 5; z++) {
      let block: string;
      if ((x === 0 || x === 4) && (z === 0 || z === 4))
        block = CHISELED_SB; // corner accents
      else if (x === 0 || x === 4 || z === 0 || z === 4)
        block = CRACKED_SB; // border trim
      else if (x === 2 && z === 2)
        block = POLISHED_AND; // center cross in andesite
      else if (x === 2 && (z === 1 || z === 3)) block = POLISHED_AND;
      else if (z === 2 && (x === 1 || x === 3)) block = POLISHED_AND;
      // The original also had "mossy edge accent" branches for (1,0), (3,0),
      // (0,1) and (0,3); the border trim above always matched those cells
      // first, so they never ran and are left out.
      else block = STONE_BRICK;
      BUILD.set(x, 0, z, block);
    }
  }

  // Stepped base y=1: 3x3 center + stair edges facing inward
  for (let x = 1; x < 4; x++) for (let z = 1; z < 4; z++) BUILD.set(x, 1, z, STONE_BRICK);
  for (let x = 1; x < 4; x++)
    BUILD.set(x, 1, 1, "minecraft:stone_brick_stairs[facing=south,half=bottom]");
  for (let x = 1; x < 4; x++)
    BUILD.set(x, 1, 3, "minecraft:stone_brick_stairs[facing=north,half=bottom]");
  for (let z = 1; z < 4; z++)
    BUILD.set(1, 1, z, "minecraft:stone_brick_stairs[facing=east,half=bottom]");
  for (let z = 1; z < 4; z++)
    BUILD.set(3, 1, z, "minecraft:stone_brick_stairs[facing=west,half=bottom]");
  // Corner accents on the step
  BUILD.set(1, 1, 1, CHISELED_SB);
  BUILD.set(3, 1, 1, CHISELED_SB);
  BUILD.set(1, 1, 3, CHISELED_SB);
  BUILD.set(3, 1, 3, CHISELED_SB);

  // Pedestal y=2: center column with variation
  BUILD.set(2, 2, 2, POLISHED_AND);
  BUILD.set(3, 2, 2, CHISELED_SB);
  BUILD.set(1, 2, 2, CHISELED_SB);
  BUILD.set(2, 2, 3, MOSSY_SB);
  BUILD.set(2, 2, 1, CRACKED_SB);
  BUILD.set(3, 2, 3, MOSSY_SB);
  BUILD.set(3, 2, 1, CRACKED_SB);
  BUILD.set(1, 2, 3, CRACKED_SB);
  BUILD.set(1, 2, 1, MOSSY_SB);

  BUILD.set(2, 3, 2, WAYSTONE);
  BUILD.set(2, 4, 2, LANTERN);

  // Iron chains around the pedestal area
  for (const [cx, cz] of [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
  ] as const) {
    for (let y = 3; y < 5; y++) BUILD.set(cx, y, cz, IRON_CHAIN);
  }
});
