// SPDX-License-Identifier: AGPL-3.0-only

// Waystone variant: Sunken Reliquary Ruin (5x5x5, Argon edition).

import { Build } from "../../src/index.ts";

const SB = "minecraft:stone_bricks";
const MSB = "minecraft:mossy_stone_bricks";
const CSB = "minecraft:cracked_stone_bricks";
const CHSB = "minecraft:chiseled_stone_bricks";
const COB = "minecraft:cobblestone";
const MCOB = "minecraft:mossy_cobblestone";
const AND = "minecraft:polished_andesite";
const LODE = "minecraft:lodestone";
const WAYSTONE = "lostqol:waystone";
const VIEWS = ["iso", "az000_el025", "az090_el025", "az180_el025", "az270_el025", "top"];

export const BUILD = new Build({ seed: 404, views: VIEWS });

const CORNERS = [
  [0, 0],
  [4, 0],
  [0, 4],
  [4, 4],
] as const;
const INNER = [
  [1, 1],
  [3, 1],
  [1, 3],
  [3, 3],
] as const;
const SLAB_MOSS = "minecraft:mossy_stone_brick_slab[type=bottom]";
const SLAB = "minecraft:stone_brick_slab[type=bottom]";
const EDGE_SLABS = [
  [1, 0, SLAB_MOSS],
  [0, 1, SLAB_MOSS],
  [3, 0, SLAB],
  [4, 1, SLAB],
  [1, 4, SLAB],
  [0, 3, SLAB_MOSS],
  [3, 4, SLAB_MOSS],
  [4, 3, SLAB],
] as const;

BUILD.scope(() => {
  // y=0: 5x5 weathered ruin foundation on terrain (nothing below y=0)
  for (let x = 0; x < 5; x++) {
    for (let z = 0; z < 5; z++) {
      let b: string;
      if (x === 2 && z === 2) b = CHSB;
      else if (x === 2 || z === 2)
        b = AND; // smooth worn processional cross
      else if ((x === 0 && z === 0) || (x === 0 && z === 4)) b = MCOB;
      else if ((x === 4 && z === 0) || (x === 4 && z === 4)) b = COB;
      else if ((x * 3 + z * 5) % 3 === 0) b = MSB;
      else if ((x + z) % 2 === 0) b = CSB;
      else b = SB;
      BUILD.set(x, 0, z, b);
    }
  }

  // y=1: stepped plinth, 4 cardinal entrance steps & corner posts
  BUILD.set(2, 1, 2, AND);
  BUILD.set(2, 1, 1, SB);
  BUILD.set(2, 1, 3, MSB);
  BUILD.set(1, 1, 2, MSB);
  BUILD.set(3, 1, 2, CSB);
  for (const [ix, iz] of INNER) BUILD.set(ix, 1, iz, SB);
  BUILD.set(2, 1, 0, "minecraft:stone_brick_stairs[facing=south,half=bottom]");
  BUILD.set(2, 1, 4, "minecraft:mossy_stone_brick_stairs[facing=north,half=bottom]");
  BUILD.set(0, 1, 2, "minecraft:mossy_stone_brick_stairs[facing=east,half=bottom]");
  BUILD.set(4, 1, 2, "minecraft:stone_brick_stairs[facing=west,half=bottom]");
  for (const [cx, cz] of CORNERS) BUILD.set(cx, 1, cz, CHSB);
  for (const [wx, wz, wblock] of EDGE_SLABS) BUILD.set(wx, 1, wz, wblock);

  // y=2: lodestone pedestal, upper altar stairs, pillars & lanterns
  BUILD.set(2, 2, 2, LODE);
  BUILD.set(2, 2, 1, "minecraft:polished_andesite_stairs[facing=south,half=bottom]");
  BUILD.set(2, 2, 3, "minecraft:polished_andesite_stairs[facing=north,half=bottom]");
  BUILD.set(1, 2, 2, "minecraft:polished_andesite_stairs[facing=east,half=bottom]");
  BUILD.set(3, 2, 2, "minecraft:polished_andesite_stairs[facing=west,half=bottom]");
  BUILD.set(1, 2, 1, MSB);
  BUILD.set(3, 2, 1, SB);
  BUILD.set(1, 2, 3, CSB);
  BUILD.set(3, 2, 3, MSB);
  for (const [cx, cz] of CORNERS) BUILD.set(cx, 2, cz, "minecraft:lantern[hanging=false]");

  // y=3: lostqol:waystone at (2,3,2), pillar capitals & hanging lanterns
  BUILD.set(2, 3, 2, WAYSTONE);
  for (const [ix, iz] of INNER) BUILD.set(ix, 3, iz, CHSB);
  for (const [lx, lz] of [
    [2, 0],
    [2, 4],
    [0, 2],
    [4, 2],
  ] as const)
    BUILD.set(lx, 3, lz, "minecraft:lantern[hanging=true]");

  // y=4: stepped overhanging canopy (notched corners + pyramid crown)
  BUILD.set(2, 4, 2, LODE);
  BUILD.set(2, 4, 1, "minecraft:stone_brick_stairs[facing=south,half=bottom]");
  BUILD.set(2, 4, 3, "minecraft:mossy_stone_brick_stairs[facing=north,half=bottom]");
  BUILD.set(1, 4, 2, "minecraft:mossy_stone_brick_stairs[facing=east,half=bottom]");
  BUILD.set(3, 4, 2, "minecraft:stone_brick_stairs[facing=west,half=bottom]");
  BUILD.set(
    1,
    4,
    1,
    "minecraft:mossy_stone_brick_stairs[facing=south,half=bottom,shape=outer_left]",
  );
  BUILD.set(3, 4, 1, "minecraft:stone_brick_stairs[facing=south,half=bottom,shape=outer_right]");
  BUILD.set(1, 4, 3, "minecraft:stone_brick_stairs[facing=north,half=bottom,shape=outer_right]");
  BUILD.set(
    3,
    4,
    3,
    "minecraft:mossy_stone_brick_stairs[facing=north,half=bottom,shape=outer_left]",
  );
  // 4 cardinal portal arch keystones (supporting the hanging lanterns at y=3)
  BUILD.set(2, 4, 0, "minecraft:polished_andesite_slab[type=bottom]");
  BUILD.set(2, 4, 4, "minecraft:polished_andesite_slab[type=bottom]");
  BUILD.set(0, 4, 2, "minecraft:polished_andesite_slab[type=bottom]");
  BUILD.set(4, 4, 2, "minecraft:polished_andesite_slab[type=bottom]");
  // 8 outer overhanging eave slabs (corners left notched open over the y=2 lanterns)
  for (const [ex, ez, eblock] of EDGE_SLABS) BUILD.set(ex, 4, ez, eblock);
});
