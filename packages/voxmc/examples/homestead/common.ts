// SPDX-License-Identifier: AGPL-3.0-only

// Shared palette and building pieces for the homestead structures.
//
// Every helper takes the `Build` to place into as its first argument and
// works in that build's coordinates. All four structures sit on y = 0 with no
// terrain, so each `.nbt` pastes cleanly onto any flat ground.

import { type Build, type Material, patches } from "../../src/index.ts";
import { pyRound, range } from "../py.ts";

// -- palette -------------------------------------------------------------------
export const STONE_BASE = patches(
  [
    ["minecraft:stone_bricks", 5],
    ["minecraft:cracked_stone_bricks", 1],
    ["minecraft:mossy_stone_bricks", 2],
    ["minecraft:andesite", 1],
  ],
  { scale: 2.5, salt: "stone" },
);
export const FOUNDATION = patches(
  [
    ["minecraft:cobblestone", 4],
    ["minecraft:mossy_cobblestone", 2],
    ["minecraft:stone", 1],
  ],
  { scale: 2, salt: "foundation" },
);
export const PLASTER: Material = [
  ["minecraft:calcite", 5],
  ["minecraft:smooth_quartz", 1],
  ["minecraft:white_concrete_powder", 1],
];
export const PLANK_FLOOR: Material = [
  ["minecraft:spruce_planks", 3],
  ["minecraft:oak_planks", 1],
];
export const BRICK: Material = [
  ["minecraft:bricks", 5],
  ["minecraft:mud_bricks", 1],
  ["minecraft:stone_bricks", 1],
];
export const BARN_WALL = patches(
  [
    ["minecraft:spruce_planks", 5],
    ["minecraft:stripped_spruce_wood", 1],
    ["minecraft:dark_oak_planks", 1],
  ],
  { scale: 2, salt: "barn" },
);
export const TIMBER = "minecraft:dark_oak_log";
export const ROOF = "minecraft:deepslate_tile_stairs";
export const ROOF_EAVE = "minecraft:deepslate_brick_stairs";
export const VERGE = "minecraft:dark_oak_stairs";
export const LANTERN = "minecraft:lantern";
export const HANGING_LANTERN = "minecraft:lantern[hanging=true]";

type Face = "north" | "south" | "east" | "west";
const OUT: Record<Face, readonly [number, number]> = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0],
};

/** Post positions from `a` to `b` (both included), about `gap` apart. */
export function evenPosts(a: number, b: number, gap = 3.5): number[] {
  const n = Math.max(1, pyRound((b - a) / gap));
  return [...new Set(range(n + 1).map((i) => a + pyRound(((b - a) * i) / n)))].sort(
    (p, q) => p - q,
  );
}

/** Glass-pane window in a wall; `face` is the outward direction. */
export function window(
  build: Build,
  x: number,
  y: number,
  z: number,
  face: Face,
  {
    tall = 2,
    shutters = true,
    flowerBox = true,
  }: { tall?: number; shutters?: boolean; flowerBox?: boolean } = {},
): void {
  const [ox, oz] = OUT[face];
  const [sx, sz] = face === "north" || face === "south" ? [1, 0] : [0, 1];
  build.line([x, y, z], [x, y + tall - 1, z], "minecraft:glass_pane");
  if (shutters) {
    for (const s of [-1, 1]) {
      build.line(
        [x + ox + s * sx, y, z + oz + s * sz],
        [x + ox + s * sx, y + tall - 1, z + oz + s * sz],
        `minecraft:spruce_trapdoor[facing=${face},half=bottom,open=true]`,
      );
    }
  }
  if (flowerBox) {
    // greenery resting on a top-half trapdoor ledge
    build.set(x + ox, y - 1, z + oz, "minecraft:flowering_azalea_leaves[persistent=true]");
    if (build.get(x + ox, y - 2, z + oz) === null) {
      build.set(
        x + ox,
        y - 2,
        z + oz,
        `minecraft:spruce_trapdoor[facing=${face},half=top,open=false]`,
      );
    }
  }
}

/**
 * Fill the triangle under a gable roof. `axis: "x"`: the gable end lies in the
 * plane `x = plane` and spans `z = lo..hi` (the roof's footprint across the
 * ridge); `"z"` likewise. Timber along the slopes, an optional king post,
 * `fill` in between.
 */
export function gableInfill(
  build: Build,
  plane: number,
  axis: "x" | "z",
  y0: number,
  lo: number,
  hi: number,
  {
    kingpost = true,
    windowAt,
    fill = PLASTER,
    edge = TIMBER,
  }: {
    kingpost?: boolean;
    windowAt?: readonly [number, number];
    fill?: Material;
    edge?: string;
  } = {},
): void {
  const across = axis === "x" ? "z" : "x";
  const mid = Math.floor((lo + hi) / 2);
  const at = (w: number, y: number): [number, number, number] =>
    axis === "x" ? [plane, y, w] : [w, y, plane];
  let k = 0;
  while (lo + k + 1 <= hi - k - 1) {
    const a = lo + k + 1;
    const b = hi - k - 1;
    for (let w = a; w <= b; w++) {
      let block: Material;
      if (kingpost && w === mid) block = `${edge}[axis=y]`;
      else if (w === a || w === b) block = `${edge}[axis=${across}]`;
      else block = fill;
      build.set(...at(w, y0 + k), block);
    }
    k++;
  }
  if (windowAt) {
    const [wy, ww] = windowAt;
    for (const w of [ww - 1, ww + 1]) build.set(...at(w, wy), "minecraft:glass_pane");
  }
}

/**
 * 3-wide gabled dormer on the north slope of a `ridge: "x"` roof. `eaveZ` and
 * `eaveY` locate the main roof's north eave row; the dormer front sits two
 * rows up the slope and its little roof runs back to the main ridge.
 */
export function dormer(build: Build, x0: number, eaveZ: number, eaveY: number): void {
  const fz = eaveZ + 2;
  const fy = eaveY + 2;
  for (let x = x0; x < x0 + 3; x++) {
    for (let y = fy; y < fy + 3; y++) {
      if (x !== x0 + 1) build.set(x, y, fz, `${TIMBER}[axis=y]`);
      else if (y < fy + 2) build.set(x, y, fz, "minecraft:glass_pane");
      else build.set(x, y, fz, `${TIMBER}[axis=x]`);
    }
  }
  for (const x of [x0, x0 + 2]) {
    for (const k of [1, 2]) build.box([x, fy + k, fz + k], [x, fy + 2, fz + k], PLASTER);
  }
  build.roofGable([x0 - 1, fy + 3, fz - 1], [x0 + 3, fy + 3, fz + 4], ROOF, {
    ridge: "z",
    verge: VERGE,
  });
  build.set(x0 + 1, fy + 3, fz, PLASTER);
}

/** A post `height` tall standing on `y` with a lantern on top. */
export function lanternPost(
  build: Build,
  x: number,
  y: number,
  z: number,
  { height = 2, post = "minecraft:spruce_fence" }: { height?: number; post?: string } = {},
): void {
  build.pillar([x, y, z], height, post);
  build.set(x, y + height, z, LANTERN);
}
