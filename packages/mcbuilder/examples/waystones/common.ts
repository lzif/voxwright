// SPDX-License-Identifier: AGPL-3.0-only

// Shared Geometry factories for the 7x7x7 waystone variants.
//
// LOSTQOL:WAYSTONE CONTRACT
// The center block `lostqol:waystone` is a custom namespaced block. It is not
// part of vanilla Minecraft: it exists only so the LostQoL plugin can replace
// it at .nbt import time. mcbuilder treats it as pass-through: the block is on
// this directory's `mcbuild.toml` allowlist, so validation emits one allowlist
// warning instead of an error, and the block string is written into the
// exported .nbt verbatim. mcbuilder never resolves, models or previews it.
//
// All factories return pure `Geometry` datablocks (relative coords, place
// nothing); stamp them with `BUILD.place(geo, { at: [0, 0, 0] })`.

import { Geometry, shapes } from "../../src/index.ts";
import { range } from "../py.ts";

export const WAYSTONE = "lostqol:waystone";
const PILLARS = [
  [1, 1],
  [1, 5],
  [5, 1],
  [5, 5],
] as const;
const CORNERS = [
  [0, 0],
  [0, 6],
  [6, 0],
  [6, 6],
] as const;

/** 7x7 floor at y=0; `fn(x, z)` gives a canonical block string. */
export function floorPattern(fn: (x: number, z: number) => string): Geometry {
  const g = new Geometry();
  for (const x of range(7)) for (const z of range(7)) g.set(x, 0, z, fn(x, z));
  return g;
}

/**
 * 5x5 stepped base at y=1 (x,z 1..5): full 3x3 center, stair edges. The 12 edge
 * cells are bottom-half stairs facing inward (toward the 3x3 center = uphill);
 * the 4 corners are full `stepBlock`.
 */
export function baseStep(opts: {
  stepBlock: string;
  stairBlock: string;
  centerBlock?: string;
}): Geometry {
  const { stepBlock, stairBlock } = opts;
  const g = new Geometry();
  const fill = opts.centerBlock ?? stepBlock;
  for (let x = 2; x < 5; x++) for (let z = 2; z < 5; z++) g.set(x, 1, z, fill);
  for (let i = 2; i < 5; i++) {
    g.set(i, 1, 1, `${stairBlock}[facing=south,half=bottom]`);
    g.set(i, 1, 5, `${stairBlock}[facing=north,half=bottom]`);
    g.set(1, 1, i, `${stairBlock}[facing=east,half=bottom]`);
    g.set(5, 1, i, `${stairBlock}[facing=west,half=bottom]`);
  }
  for (const [cx, cz] of [
    [1, 1],
    [1, 5],
    [5, 1],
    [5, 5],
  ] as const)
    g.set(cx, 1, cz, stepBlock);
  return g;
}

function at(dx: number, dy: number, dz: number, block: string): Geometry {
  const g = new Geometry();
  g.set(dx, dy, dz, block);
  return g;
}

/** `block` with `key=value` set, replacing any existing value, never duplicating a prop. */
function setProp(block: string, key: string, value: string): string {
  const open = block.indexOf("[");
  const head = open === -1 ? block : block.slice(0, open);
  const props = new Map<string, string>();
  if (open !== -1) {
    for (const raw of block
      .slice(open + 1)
      .replace(/\]+$/, "")
      .split(",")) {
      const item = raw.trim();
      if (item === "") continue;
      const eq = item.indexOf("=");
      props.set(
        (eq === -1 ? item : item.slice(0, eq)).trim(),
        eq === -1 ? "" : item.slice(eq + 1).trim(),
      );
    }
  }
  props.set(key, value);
  return `${head}[${[...props.keys()]
    .sort()
    .map((k) => `${k}=${props.get(k)}`)
    .join(",")}]`;
}

/** Set `hanging=` on a lantern block; sea_lantern takes no props. */
function hanging(block: string, value: string): string {
  return block.split("[")[0] === "minecraft:sea_lantern" ? block : setProp(block, "hanging", value);
}

/** Corner posts at (0/6,1,0/6) with lanterns above at y=2. */
export function cornerLanterns(opts: { postBlock: string; lanternBlock: string }): Geometry {
  const lantern = hanging(opts.lanternBlock, "false");
  let g = new Geometry();
  for (const [cx, cz] of CORNERS) {
    g = g.concat(shapes.pillar([cx, 1, cz], 1, opts.postBlock));
    g = g.concat(at(cx, 2, cz, lantern));
  }
  return g;
}

/** Four pillars at (1,1),(1,5),(5,1),(5,5), y=2..4. */
export function pillars(opts: { pillarBlock: string }): Geometry {
  let g = new Geometry();
  for (const [px, pz] of PILLARS) g = g.concat(shapes.pillar([px, 2, pz], 3, opts.pillarBlock));
  return g;
}

/** Center stack: pedestal y=2, lostqol:waystone y=3, hanging light y=4. */
export function pedestal(opts: { pedestalBlock: string; hangBlock: string }): Geometry {
  const hb = hanging(opts.hangBlock, "true");
  return at(3, 2, 3, opts.pedestalBlock)
    .concat(at(3, 3, 3, WAYSTONE))
    .concat(at(3, 4, 3, hb));
}

/**
 * Flat canopy: y=5 inner 5x5 plate, outer stair eave, y=6 3x3 cap. The 12
 * middle-edge cells of the 7x7 outer ring are top-half stairs facing outward;
 * the 4 true corners are full `cornerBlock`. The 8 ring cells adjacent to the
 * corners are also `cornerBlock` so the canopy reads as one solid 7x7 plate.
 */
export function canopy(opts: {
  plateSlab: string;
  eaveStair: string;
  cornerBlock: string;
  capBlock: string;
}): Geometry {
  const plate = shapes.box([0, 0, 0], [4, 0, 4], opts.plateSlab);
  const ring = new Geometry();
  for (const i of [2, 3, 4]) {
    ring.set(i, 0, 0, `${opts.eaveStair}[facing=north,half=top]`);
    ring.set(i, 0, 6, `${opts.eaveStair}[facing=south,half=top]`);
    ring.set(0, 0, i, `${opts.eaveStair}[facing=west,half=top]`);
    ring.set(6, 0, i, `${opts.eaveStair}[facing=east,half=top]`);
  }
  for (const [cx, cz] of CORNERS) ring.set(cx, 0, cz, opts.cornerBlock);
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
    ring.set(kx, 0, kz, opts.cornerBlock);
  }
  const cap = shapes.box([0, 0, 0], [2, 0, 2], opts.capBlock);
  return plate
    .shift(1, 5, 1)
    .concat(ring.shift(0, 5, 0))
    .concat(cap.shift(2, 6, 2));
}
