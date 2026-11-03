// SPDX-License-Identifier: AGPL-3.0-only

// Waystone variant 4: Skystead (7x7x7).

import { Build, Geometry } from "../../src/index.ts";
import { baseStep, canopy, cornerLanterns, floorPattern, pedestal, pillars } from "./common.ts";

const QB = "minecraft:quartz_block";
const PR = "minecraft:prismarine_bricks";
const VIEWS = ["iso", "az000_el025", "az090_el025", "az180_el025", "az270_el025", "top"];

export const BUILD = new Build({ seed: 404, views: VIEWS });

const floor = (x: number, z: number): string => {
  if (2 <= x && x <= 4 && 2 <= z && z <= 4) return QB;
  if (x === 0 || x === 6 || z === 0 || z === 6) return QB;
  return PR;
};

/** Sea lanterns glowing under the roof eave, mid-point of each side. */
function eaveLanterns(): Geometry {
  const g = new Geometry();
  for (const [x, z] of [
    [3, 0],
    [3, 6],
    [0, 3],
    [6, 3],
  ] as const)
    g.set(x, 4, z, "minecraft:sea_lantern");
  return g;
}

/** Continuous prismarine band at y=2 along the platform edges, between the quartz pillars. */
function baseTrim(): Geometry {
  const g = new Geometry();
  for (const i of [2, 3, 4]) {
    g.set(i, 2, 1, PR);
    g.set(i, 2, 5, PR);
    g.set(1, 2, i, PR);
    g.set(5, 2, i, PR);
  }
  return g;
}

BUILD.scope(() => {
  BUILD.place(floorPattern(floor), { at: [0, 0, 0] });
  BUILD.place(baseStep({ stepBlock: QB, stairBlock: "minecraft:quartz_stairs" }), {
    at: [0, 0, 0],
  });
  BUILD.place(cornerLanterns({ postBlock: QB, lanternBlock: "minecraft:sea_lantern" }), {
    at: [0, 0, 0],
  });
  BUILD.place(pillars({ pillarBlock: QB }), { at: [0, 0, 0] });
  BUILD.place(baseTrim(), { at: [0, 0, 0] });
  BUILD.place(eaveLanterns(), { at: [0, 0, 0] });
  BUILD.place(pedestal({ pedestalBlock: PR, hangBlock: "minecraft:sea_lantern" }), {
    at: [0, 0, 0],
  });
  BUILD.place(
    canopy({
      plateSlab: "minecraft:quartz_slab[type=bottom]",
      eaveStair: "minecraft:prismarine_stairs",
      cornerBlock: QB,
      capBlock: PR,
    }),
    { at: [0, 0, 0] },
  );
  // Overwrite y=6 cap: prismarine ring around quartz center (design top view).
  for (let dx = 0; dx < 3; dx++) {
    for (let dz = 0; dz < 3; dz++) BUILD.set(2 + dx, 6, 2 + dz, dx === 1 && dz === 1 ? QB : PR);
  }
});
