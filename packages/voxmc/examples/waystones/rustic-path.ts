// SPDX-License-Identifier: AGPL-3.0-only

// Waystone variant 3: Rustic Path (7x7x7).

import { Build, Geometry, shapes } from "../../src/index.ts";
import { baseStep, cornerLanterns, floorPattern, pillars, WAYSTONE } from "./common.ts";

const SP = "minecraft:spruce_planks";
const VIEWS = ["iso", "az000_el025", "az090_el025", "az180_el025", "az270_el025", "top"];

export const BUILD = new Build({ seed: 303, views: VIEWS });

const floor = (x: number, z: number): string =>
  x === 0 || x === 6 || z === 0 || z === 6 ? SP : "minecraft:cobblestone";

/**
 * Continuous trapdoor skirting at y=4 under the eave: full perimeter. Top-half
 * panels read as one dark soffit band from every angle.
 */
function trapdoorBand(): Geometry {
  const g = new Geometry();
  for (let x = 0; x < 7; x++) {
    for (let z = 0; z < 7; z++) {
      if (x === 0 || x === 6 || z === 0 || z === 6) {
        const facing = x === 0 ? "west" : x === 6 ? "east" : z === 0 ? "north" : "south";
        g.set(x, 4, z, `minecraft:spruce_trapdoor[facing=${facing},half=top,open=false]`);
      }
    }
  }
  return g;
}

/** Stepped pyramid roof: y=5 7x7 (stair eave + plank field), y=6 3x3 stepped cap with stair shoulders and a plank crown. */
function canopy(): Geometry {
  const g = new Geometry();
  const field = shapes.box([0, 0, 0], [4, 0, 4], SP);
  for (const [x, , z, b] of field.cells()) g.set(x + 1, 5, z + 1, b);
  for (let i = 1; i < 6; i++) {
    g.set(i, 5, 0, "minecraft:spruce_stairs[facing=south,half=bottom]");
    g.set(i, 5, 6, "minecraft:spruce_stairs[facing=north,half=bottom]");
    g.set(0, 5, i, "minecraft:spruce_stairs[facing=east,half=bottom]");
    g.set(6, 5, i, "minecraft:spruce_stairs[facing=west,half=bottom]");
  }
  for (const [cx, cz] of [
    [0, 0],
    [0, 6],
    [6, 0],
    [6, 6],
  ] as const)
    g.set(cx, 5, cz, SP);
  for (let dx = 0; dx < 3; dx++) {
    for (let dz = 0; dz < 3; dz++) {
      const [x, z] = [2 + dx, 2 + dz];
      if (dx === 1 && dz === 1) g.set(x, 6, z, SP);
      else if (dx === 1 && dz === 0)
        g.set(x, 6, z, "minecraft:spruce_stairs[facing=south,half=bottom]");
      else if (dx === 1 && dz === 2)
        g.set(x, 6, z, "minecraft:spruce_stairs[facing=north,half=bottom]");
      else if (dx === 0 && dz === 1)
        g.set(x, 6, z, "minecraft:spruce_stairs[facing=east,half=bottom]");
      else if (dx === 2 && dz === 1)
        g.set(x, 6, z, "minecraft:spruce_stairs[facing=west,half=bottom]");
      else g.set(x, 6, z, SP);
    }
  }
  return g;
}

BUILD.scope(() => {
  BUILD.place(floorPattern(floor), { at: [0, 0, 0] });
  BUILD.place(
    baseStep({
      stepBlock: "minecraft:cobblestone",
      stairBlock: "minecraft:cobblestone_stairs",
      centerBlock: "minecraft:cobblestone_slab[type=top]",
    }),
    { at: [0, 0, 0] },
  );
  BUILD.place(cornerLanterns({ postBlock: SP, lanternBlock: "minecraft:lantern" }), {
    at: [0, 0, 0],
  });
  BUILD.place(pillars({ pillarBlock: SP }), { at: [0, 0, 0] });
  BUILD.place(trapdoorBand(), { at: [0, 0, 0] });
  // Short pedestal + framed, lit centerpiece: cobble base, waystone, hanging
  // lantern on a chain from the canopy.
  BUILD.set(3, 1, 3, "minecraft:cobblestone");
  BUILD.set(3, 2, 3, WAYSTONE);
  BUILD.set(3, 3, 3, "minecraft:lantern[hanging=true]");
  BUILD.set(3, 4, 3, "minecraft:iron_chain[axis=y]");
  BUILD.place(canopy(), { at: [0, 0, 0] });
});
