// SPDX-License-Identifier: AGPL-3.0-only

// Underwater research base.
//
// Layout (sits on the seabed at y = 0; +X east, +Z south):
//   - central hub: glass dome r=9 with prismarine ribs, sea-lantern floor ring
//   - east tunnel (horizontal tube) to an observation pod (dome r=6)
//   - north tunnel to a moon-pool room (a water shaft through the floor)
//
// The interiors are filled with explicit air. Export with `--air explicit` so
// the paste pushes the ocean water out of the base but leaves the surrounding
// ocean alone. `leaks(BUILD)` finds air cells that touch open water (they
// would flood).

import { Build, shapes } from "../../src/index.ts";
import { pyRound, range } from "../py.ts";

export const BUILD = new Build({ seed: 42, views: ["iso", "az135_el025", "az270_el015", "top"] });

const AIR = "minecraft:air";
const WATER = "minecraft:water";
const GLASS = "minecraft:light_blue_stained_glass";
const RIB = "minecraft:prismarine_bricks";
const DARK = "minecraft:dark_prismarine";
const FLOOR = [
  [DARK, 3],
  ["minecraft:prismarine_bricks", 1],
] as const;
const HULL = [["minecraft:prismarine_bricks", 3], "minecraft:prismarine"] as const;

const HUB_R = 9;
const POD_C = [22, 1, 0] as const;
const POD_R = 6;
const [POOL_Z0, POOL_Z1] = [-14, -22]; // moon-pool room z extent (north)

/** Python's `a % m` for floats: the result takes the sign of `m`. */
function pyMod(a: number, m: number): number {
  const r = a % m;
  return r !== 0 && r < 0 !== m < 0 ? r + m : r;
}

// --- helpers the library doesn't have -------------------------------------

/** Glass with `ribs` vertical prismarine meridian ribs + base band. */
function domeShellMaterial(cx: number, cz: number, ribs = 8) {
  return (x: number, y: number, z: number): string => {
    if (y <= 2) return RIB;
    const ang = pyMod(Math.atan2(z - cz, x - cx) * (180 / Math.PI), 360 / ribs);
    const near = Math.min(ang, 360 / ribs - ang);
    // rib width in degrees shrinks toward the top so it stays ~1 block
    const rXz = Math.max(1.0, Math.hypot(x - cx, z - cz));
    return ((near * Math.PI) / 180) * rXz < 0.6 ? RIB : GLASS;
  };
}

/**
 * Horizontal tube: prismarine below the waterline and every 4th ring, glass on
 * top, air inside. `start` is the axis cell with the lowest coordinate; the
 * tube grows `length` blocks toward +axis.
 */
function tube(
  axis: "x" | "z",
  start: readonly [number, number, number],
  length: number,
  radius: number,
) {
  const [sx, cy, sz] = start;
  const along = axis === "x" ? 0 : 2;
  const shell = (x: number, y: number, z: number): string => {
    const coord = [x, y, z][along] as number;
    const origin = [sx, cy, sz][along] as number;
    const ring = pyMod(coord - origin, 4) === 0;
    return ring || y < cy ? RIB : GLASS;
  };
  return shapes.cylinder(start, radius, length, shell, { axis, hollow: true, fill: AIR });
}

BUILD.scope(() => {
  // 2. hub foundation plinth + dome shell
  BUILD.cylinder([0, 1, 0], HUB_R + 1, 1, HULL);
  BUILD.sphere([0, 1, 0], HUB_R, domeShellMaterial(0, 0), { hollow: true, dome: true });

  // 3. observation pod + its plinth
  BUILD.cylinder(POD_C, POD_R + 1, 1, HULL);
  BUILD.sphere(POD_C, POD_R, domeShellMaterial(POD_C[0], POD_C[2], 6), {
    hollow: true,
    dome: true,
  });

  // 4. moon-pool room (north): hull box + glass strip windows
  BUILD.box([-6, 1, POOL_Z1], [6, 7, POOL_Z0], HULL);
  for (const z of range(POOL_Z1 + 2, POOL_Z0, 3)) {
    BUILD.box([-6, 4, z], [-6, 5, z + 1], GLASS);
    BUILD.box([6, 4, z], [6, 5, z + 1], GLASS);
  }
  // sloped roof trim: slab ring on top
  BUILD.walls(
    [-7, 7, POOL_Z1 - 1],
    [7, 7, POOL_Z0 + 1],
    "minecraft:prismarine_brick_slab[type=bottom,waterlogged=true]",
  );

  // 5. tunnels: east from inside the hub to the pod, north from the
  //    moon-pool room's south wall (z = -14) to inside the hub (z = -7)
  const east = tube("x", [HUB_R - 2, 4, 0], POD_C[0] - POD_R - HUB_R + 5, 3);
  const north = tube("z", [0, 4, POOL_Z0], POOL_Z0 * -1 - (HUB_R - 2) + 1, 3);
  BUILD.place(east);
  BUILD.place(north);

  // 6. interiors: explicit air (displaces ocean water on paste)
  BUILD.sphere([0, 1, 0], HUB_R - 1, AIR, { dome: true });
  BUILD.sphere(POD_C, POD_R - 1, AIR, { dome: true });
  BUILD.box([-5, 2, POOL_Z1 + 1], [5, 6, POOL_Z0 - 1], AIR);
  // re-open the tunnel interiors where the domes' shells crossed them
  for (const t of [east, north]) {
    for (const [x, y, z, block] of t.cells()) if (block === AIR) BUILD.set(x, y, z, AIR);
  }

  // 7. floors (overwrite the bottom air layer), tunnel walkways
  BUILD.cylinder([0, 1, 0], HUB_R - 1, 1, FLOOR);
  BUILD.cylinder(POD_C, POD_R - 1, 1, FLOOR);
  BUILD.box(
    [HUB_R - 2, 2, -1],
    [POD_C[0] - POD_R + 2, 2, 1],
    "minecraft:dark_prismarine_slab[type=bottom]",
  );
  BUILD.box([-1, 2, POOL_Z0], [1, 2, -(HUB_R - 2)], "minecraft:dark_prismarine_slab[type=bottom]");
  BUILD.box([-5, 1, POOL_Z1 + 1], [5, 1, POOL_Z0 - 1], FLOOR);

  // 8. moon pool: 3x3 water hole through floor + seabed to open ocean
  BUILD.box([-1, -2, POOL_Z1 + 3], [1, 1, POOL_Z1 + 5], WATER);
  for (const [x, z] of [
    [-2, POOL_Z1 + 2],
    [2, POOL_Z1 + 2],
    [-2, POOL_Z1 + 6],
    [2, POOL_Z1 + 6],
  ] as const) {
    BUILD.set(x, 2, z, "minecraft:sea_lantern");
  }

  // 9. lighting: sea-lantern ring in hub floor on the rib rhythm
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    BUILD.set(pyRound(6 * Math.cos(a)), 1, pyRound(6 * Math.sin(a)), "minecraft:sea_lantern");
  }
  BUILD.set(0, 1, 0, "minecraft:sea_lantern");
  BUILD.set(POD_C[0], 1, POD_C[2], "minecraft:sea_lantern");
  // hanging lantern from the dome apex
  BUILD.line([0, 9, 0], [0, 7, 0], "minecraft:iron_chain[axis=y]");
  BUILD.set(0, 6, 0, "minecraft:lantern[hanging=true]");

  // 10. hub interior props (west half = lab, south = quarters)
  BUILD.box([-6, 2, -2], [-6, 2, 2], "minecraft:barrel[facing=up]");
  BUILD.set(-5, 2, -3, "minecraft:crafting_table");
  BUILD.set(-5, 2, 3, "minecraft:cartography_table");
  BUILD.set(-4, 2, 0, "minecraft:lectern[facing=east]");
  BUILD.set(-2, 2, 5, "minecraft:red_bed[facing=south,part=head]");
  BUILD.set(-2, 2, 4, "minecraft:red_bed[facing=south,part=foot]");
  BUILD.set(2, 2, 5, "minecraft:red_bed[facing=south,part=head]");
  BUILD.set(2, 2, 4, "minecraft:red_bed[facing=south,part=foot]");
  BUILD.set(0, 2, 6, "minecraft:chest[facing=north]");
  BUILD.set(3, 2, -4, "minecraft:brewing_stand");
  BUILD.set(4, 2, -3, "minecraft:spruce_stairs[facing=west]"); // seat

  // 11. pod: conduit on a prismarine pedestal (decorative focal point)
  BUILD.set(POD_C[0], 2, POD_C[2], "minecraft:dark_prismarine");
  BUILD.set(POD_C[0], 3, POD_C[2], "minecraft:conduit[waterlogged=false]");
});
