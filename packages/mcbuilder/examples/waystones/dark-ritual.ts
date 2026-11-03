// SPDX-License-Identifier: AGPL-3.0-only

// Waystone variant 2: Dark Ritual (7x7x7).

import { Build, Geometry, shapes } from "../../src/index.ts";
import { baseStep, floorPattern, pillars, WAYSTONE } from "./common.ts";

const DB = "minecraft:deepslate_bricks";
const AM = "minecraft:amethyst_block";
const VIEWS = ["iso", "az000_el025", "az090_el025", "az180_el025", "az270_el025", "top"];

export const BUILD = new Build({ seed: 202, views: VIEWS });

const floor = (x: number, z: number): string => {
  if (
    [
      [0, 0],
      [0, 6],
      [6, 0],
      [6, 6],
      [3, 3],
    ].some(([a, b]) => a === x && b === z)
  )
    return AM;
  if (x === 0 || x === 6 || z === 0 || z === 6) return "minecraft:blackstone";
  return "minecraft:deepslate_tiles";
};

/**
 * Corner posts y=1..4 (blackstone) with soul lanterns at y=2 AND y=5. y=2 is the
 * base glow; y=5 is the roof-corner lanterns. The y=5 lanterns occupy the
 * canopy ring's corner cells.
 */
function cornerTotems(): Geometry {
  const g = new Geometry();
  for (const [cx, cz] of [
    [0, 0],
    [0, 6],
    [6, 0],
    [6, 6],
  ] as const) {
    for (let y = 1; y < 5; y++) g.set(cx, y, cz, "minecraft:blackstone");
    g.set(cx, 2, cz, "minecraft:soul_lantern");
    g.set(cx, 5, cz, "minecraft:soul_lantern");
  }
  return g;
}

/** Tiered roof: y=5 ring (stair eave, open corners) + plate; y=6 stepped 3x3 with a single amethyst block at the center. */
function canopy(): Geometry {
  const g = new Geometry();
  const plate = shapes.box([0, 0, 0], [4, 0, 4], "minecraft:blackstone_slab[type=bottom]");
  for (const [x, , z, b] of plate.cells()) g.set(x + 1, 5, z + 1, b);
  for (const i of [2, 3, 4]) {
    g.set(i, 5, 0, "minecraft:blackstone_stairs[facing=north,half=top]");
    g.set(i, 5, 6, "minecraft:blackstone_stairs[facing=south,half=top]");
    g.set(0, 5, i, "minecraft:blackstone_stairs[facing=west,half=top]");
    g.set(6, 5, i, "minecraft:blackstone_stairs[facing=east,half=top]");
  }
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
    g.set(kx, 5, kz, "minecraft:blackstone");
  }
  // (ring corners left open: the totem lanterns sit there at y=5)
  for (let dx = 0; dx < 3; dx++) {
    for (let dz = 0; dz < 3; dz++) {
      const [x, z] = [2 + dx, 2 + dz];
      if (dx === 1 && dz === 1) g.set(x, 6, z, AM);
      else if (dx === 1 && dz === 0)
        g.set(x, 6, z, "minecraft:blackstone_stairs[facing=south,half=bottom]");
      else if (dx === 1 && dz === 2)
        g.set(x, 6, z, "minecraft:blackstone_stairs[facing=north,half=bottom]");
      else if (dx === 0 && dz === 1)
        g.set(x, 6, z, "minecraft:blackstone_stairs[facing=east,half=bottom]");
      else if (dx === 2 && dz === 1)
        g.set(x, 6, z, "minecraft:blackstone_stairs[facing=west,half=bottom]");
      else g.set(x, 6, z, "minecraft:blackstone");
    }
  }
  return g;
}

BUILD.scope(() => {
  BUILD.place(floorPattern(floor), { at: [0, 0, 0] });
  BUILD.place(
    baseStep({ stepBlock: "minecraft:blackstone", stairBlock: "minecraft:blackstone_stairs" }),
    { at: [0, 0, 0] },
  );
  BUILD.set(3, 1, 3, AM); // amethyst glow at the pedestal's base
  BUILD.place(cornerTotems(), { at: [0, 0, 0] });
  BUILD.place(pillars({ pillarBlock: DB }), { at: [0, 0, 0] });
  // Amethyst spine: inlay plus around the pedestal, waystone, hanging crystal.
  for (const [ix, iz] of [
    [2, 3],
    [4, 3],
    [3, 2],
    [3, 4],
  ] as const)
    BUILD.set(ix, 2, iz, AM);
  BUILD.set(3, 2, 3, "minecraft:deepslate_tiles");
  BUILD.set(3, 3, 3, WAYSTONE);
  BUILD.set(3, 4, 3, AM);
  BUILD.place(canopy(), { at: [0, 0, 0] });
});
