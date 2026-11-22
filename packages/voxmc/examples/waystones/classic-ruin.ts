// SPDX-License-Identifier: AGPL-3.0-only

// Waystone variant 1: Classic Ruin (7x7x7).

import { Build, Geometry, shapes } from "../../src/index.ts";
import { baseStep, cornerLanterns, floorPattern, pedestal } from "./common.ts";

const SB = "minecraft:stone_bricks";
const MSB = "minecraft:mossy_stone_bricks";
const AND = "minecraft:polished_andesite";
const VIEWS = ["iso", "az000_el025", "az090_el025", "az180_el025", "az270_el025", "top"];

export const BUILD = new Build({ seed: 101, views: VIEWS });

/** Organic moss scatter across all quadrants (~1/6 of cells). */
const mossy = (x: number, z: number): string => ((x * 5 + z * 3 + x * z) % 6 === 0 ? MSB : SB);

/** 3x3 second base tier at y=2: stair-tread edges, andesite center. */
function tier2(): Geometry {
  const g = new Geometry();
  for (let dx = 0; dx < 3; dx++) {
    for (let dz = 0; dz < 3; dz++) {
      const [x, z] = [2 + dx, 2 + dz];
      if (dx === 1 && dz === 1)
        g.set(x, 2, z, AND); // pedestal base / deliberate andesite accent
      else if (dx === 1 && dz === 0)
        g.set(x, 2, z, "minecraft:stone_brick_stairs[facing=south,half=bottom]");
      else if (dx === 1 && dz === 2)
        g.set(x, 2, z, "minecraft:stone_brick_stairs[facing=north,half=bottom]");
      else if (dx === 0 && dz === 1)
        g.set(x, 2, z, "minecraft:stone_brick_stairs[facing=east,half=bottom]");
      else if (dx === 2 && dz === 1)
        g.set(x, 2, z, "minecraft:stone_brick_stairs[facing=west,half=bottom]");
      else g.set(x, 2, z, mossy(x + 7, z + 3));
    }
  }
  return g;
}

/** Four pillars at (1,1),(1,5),(5,1),(5,5), y=2..4, moss on each. */
function mossyPillars(): Geometry {
  const g = new Geometry();
  for (const [px, pz] of [
    [1, 1],
    [1, 5],
    [5, 1],
    [5, 5],
  ] as const) {
    for (let y = 2; y < 5; y++) g.set(px, y, pz, (px + pz + y) % 3 === 0 ? MSB : SB);
  }
  return g;
}

/** Eave stair that keeps its shape but goes mossy along the roof rim. */
function rimStair(x: number, z: number, facing: string): string {
  return (x * 2 + z * 3) % 5 === 0
    ? `minecraft:mossy_stone_brick_stairs[facing=${facing},half=top]`
    : `minecraft:stone_brick_stairs[facing=${facing},half=top]`;
}

/** Canopy at y=5 (slab plate + stair eave with mossy rim), stepped cap at y=6. */
function canopyGeo(): Geometry {
  const g = new Geometry();
  const plate = shapes.box([0, 0, 0], [4, 0, 4], "minecraft:stone_brick_slab[type=bottom]");
  for (const [x, , z, b] of plate.cells()) g.set(x + 1, 5, z + 1, b);
  for (const i of [2, 3, 4]) {
    g.set(i, 5, 0, rimStair(i, 0, "north"));
    g.set(i, 5, 6, rimStair(i, 6, "south"));
    g.set(0, 5, i, rimStair(0, i, "west"));
    g.set(6, 5, i, rimStair(6, i, "east"));
  }
  for (const [cx, cz] of [
    [0, 0],
    [0, 6],
    [6, 0],
    [6, 6],
  ] as const)
    g.set(cx, 5, cz, cx === cz ? MSB : SB);
  for (const [kx, kz] of [
    [1, 0],
    [5, 0],
    [1, 6],
    [5, 6],
    [0, 1],
    [0, 5],
    [6, 1],
    [6, 5],
  ] as const) {
    g.set(kx, 5, kz, mossy(kx + 11, kz + 5));
  }
  // y=6: stepped pyramid cap: full corners+center, stair shoulders, mossy flecks
  const shoulders: Record<string, string> = {
    "1,0": "south",
    "1,2": "north",
    "0,1": "east",
    "2,1": "west",
  };
  for (let dx = 0; dx < 3; dx++) {
    for (let dz = 0; dz < 3; dz++) {
      const [x, z] = [2 + dx, 2 + dz];
      const facing = shoulders[`${dx},${dz}`];
      if (dx === 1 && dz === 1) g.set(x, 6, z, SB);
      else if (facing !== undefined) {
        const stair =
          (x + z) % 3 === 0 ? "minecraft:mossy_stone_brick_stairs" : "minecraft:stone_brick_stairs";
        g.set(x, 6, z, `${stair}[facing=${facing},half=bottom]`);
      } else g.set(x, 6, z, (x === 2 && z === 4) || (x === 4 && z === 2) ? MSB : SB);
    }
  }
  return g;
}

BUILD.scope(() => {
  BUILD.place(
    floorPattern((x, z) => mossy(x, z)),
    { at: [0, 0, 0] },
  );
  BUILD.place(baseStep({ stepBlock: SB, stairBlock: "minecraft:stone_brick_stairs" }), {
    at: [0, 0, 0],
  });
  BUILD.place(tier2(), { at: [0, 0, 0] });
  BUILD.place(cornerLanterns({ postBlock: SB, lanternBlock: "minecraft:lantern" }), {
    at: [0, 0, 0],
  });
  BUILD.place(mossyPillars(), { at: [0, 0, 0] });
  // Stepped, pronounced pedestal: andesite inlay (y=1) + andesite base (y=2,
  // via tier2 center), waystone, hanging lantern.
  BUILD.set(3, 1, 3, AND);
  BUILD.place(pedestal({ pedestalBlock: AND, hangBlock: "minecraft:lantern" }), { at: [0, 0, 0] });
  BUILD.place(canopyGeo(), { at: [0, 0, 0] });
  const chains = shapes.pillar([0, 0, 0], 2, "minecraft:iron_chain[axis=y]");
  for (const [cx, cz] of [
    [2, 1],
    [4, 1],
    [2, 5],
    [4, 5],
  ] as const) {
    BUILD.place(chains, { at: [cx, 3, cz] });
    BUILD.set(cx, 2, cz, "minecraft:lantern[hanging=true]");
  }
});
