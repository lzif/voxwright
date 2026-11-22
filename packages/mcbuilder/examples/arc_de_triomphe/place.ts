// SPDX-License-Identifier: AGPL-3.0-only

// Place Charles de Gaulle (l'Etoile): the ground around the Arc de Triomphe, compressed to a
// 181 x 181 square. The monument is another module; this one only lays the place.
//
// Coordinates: 1 block = 1 m, arch centre at x = 0, z = 0, +x east, +z south, y up. The extent is
// x, z in [-90, 90]. Every ground surface is the block layer y = -1; things that stand on it
// (curbs, sidewalk slabs, bollards, posts, hedges, trees) start at y = 0. The zone
// x in [-14, 14], z in [-25, 25] is never built above y = -1, so the monument can go there.
//
// With r the distance from (0, 0) and theta the angle in the x-z plane (0 = +x):
//   r <  39.5          central island: pale grey setts with 12 lighter rays toward the avenues
//   39.5 <= r < 40.5   island curb (slabs); bollards at r = 38 joined by chains just inside it
//   40.5 <= r < 58.5   ring road: dark setts, no markings, curbed on both edges
//   58.5 <= r < 65.5   outer sidewalk ring: slabs a half block above the road, lamp posts
//   r >= 65.5          lawns and hedges in the wedges; plane trees
// 12 avenues leave the ring at theta = k * 30 deg, k = 0..11. theta 0 is the Champs-Elysees (road
// 21 wide, walks 8, two tree rows per side), theta 180 is the Avenue de la Grande Armee (road 17,
// walks 6, one row), the other ten are road 11, walks 4, one row. Each avenue mouth has a zebra
// crossing just outside the sidewalk ring.

import { type Build, type MaterialFn, patches, type Rng } from "../../src/index.ts";
import { lanternPost } from "../homestead/common.ts";

const HALF = 90;
const SIZE = 2 * HALF + 1;
const EPS = 1e-9;

// -- radii (blocks from the arch centre) -----------------------------------------------------
const R_ISLAND = 39.5;
const R_ISLAND_CURB = 40.5;
const R_RING_OUT = 58.5;
const R_WALK_OUT = 65.5;
const R_BOLLARD = 38;
const R_LAMP = 62;
const RAY_FROM = 12;
const RAY_HALF_WIDTH = 1.5;
const TREE_LIMIT = 86; // crown radius is at most 3.6, so crowns stay inside the extent
const CROSSING = [66, 70] as const; // zebra crossing: along the avenue axis, [from, to)
const FIRST_TREE = 70; // first avenue tree, along the avenue axis

// -- palette -------------------------------------------------------------------------------
const ISLAND = patches(
  [
    ["minecraft:andesite", 3],
    ["minecraft:polished_andesite", 3],
    ["minecraft:smooth_stone", 2],
    ["minecraft:stone", 1],
  ],
  { scale: 1.5, salt: "island" },
);
const RAY = patches([["minecraft:polished_diorite", 4], "minecraft:diorite", "minecraft:calcite"], {
  scale: 1.5,
  salt: "ray",
});
const ROAD = patches(
  [
    ["minecraft:cobbled_deepslate", 6],
    ["minecraft:deepslate_tiles", 3],
    ["minecraft:smooth_basalt", 1],
    ["minecraft:polished_deepslate", 1],
  ],
  { scale: 1.5, salt: "road" },
);
const PAVING = patches(
  [
    ["minecraft:smooth_stone", 5],
    ["minecraft:stone_bricks", 1],
    ["minecraft:polished_andesite", 1],
  ],
  { scale: 2, salt: "paving" },
);
const CURB = "minecraft:polished_andesite";
const ISLAND_CURB = "minecraft:stone_bricks";
const ZEBRA = "minecraft:white_concrete";
const GRASS = "minecraft:grass_block";
const PIT = "minecraft:coarse_dirt";
const LEAVES = "minecraft:oak_leaves[persistent=true]";
const HEDGE = "minecraft:spruce_leaves[persistent=true]";
const TRUNK = "minecraft:oak_log[axis=y]";
const BOLLARD = "minecraft:stone_brick_wall";
const BOLLARD_CAP = "minecraft:stone_brick_slab[type=bottom]";
const LAMP_POST = "minecraft:polished_blackstone_wall";
const PLANTS = [
  "minecraft:short_grass",
  "minecraft:short_grass",
  "minecraft:short_grass",
  "minecraft:dandelion",
  "minecraft:poppy",
  "minecraft:azure_bluet",
  "minecraft:oxeye_daisy",
];

/** The bottom slab matching a full block: `stone_bricks` -> `stone_brick_slab`. */
function slabOf(block: string): string {
  return `${block.replace(/bricks$/, "brick")}_slab[type=bottom]`;
}

// -- avenues -------------------------------------------------------------------------------
interface Avenue {
  cos: number;
  sin: number;
  /** Half the roadway width: road cells have |side| <= roadHalf. */
  roadHalf: number;
  /** Half the roadway plus the sidewalk: walk cells have |side| <= outerHalf. */
  outerHalf: number;
  /** Tree rows, as distances from the avenue axis (mirrored to both sides). */
  rows: readonly number[];
}

const AVENUES: readonly Avenue[] = Array.from({ length: 12 }, (_, k) => {
  const theta = (k * Math.PI) / 6;
  const [roadway, walk, rows] =
    k === 0
      ? ([20, 8, [12, 16]] as const) // Champs-Elysees
      : k === 6
        ? ([16, 6, [11]] as const) // Avenue de la Grande Armee
        : ([10, 4, [7]] as const);
  const roadHalf = roadway / 2;
  return {
    cos: Math.cos(theta),
    sin: Math.sin(theta),
    roadHalf,
    outerHalf: roadHalf + walk,
    rows,
  };
});

/** Distance of (x, z) from the avenue axis, measured along it (negative: wrong side). */
const along = (a: Avenue, x: number, z: number): number => x * a.cos + z * a.sin;
/** Signed distance of (x, z) from the avenue axis, across it. */
const side = (a: Avenue, x: number, z: number): number => -x * a.sin + z * a.cos;
/** World cell for the point `s` along and `d` across avenue `a`. */
const onAvenue = (a: Avenue, s: number, d: number): [number, number] => [
  Math.round(s * a.cos - d * a.sin),
  Math.round(s * a.sin + d * a.cos),
];

// -- ground classification -------------------------------------------------------------------
const K = {
  island: 0,
  ray: 1,
  islandCurb: 2,
  road: 3,
  zebra: 4,
  walk: 5,
  curb: 6,
  lawn: 7,
  out: 8,
} as const;

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

class Ground {
  private readonly cells = new Uint8Array(SIZE * SIZE).fill(K.out);

  at(x: number, z: number): number {
    if (Math.abs(x) > HALF || Math.abs(z) > HALF) return K.out;
    return this.cells[(z + HALF) * SIZE + (x + HALF)] ?? K.out;
  }

  private put(x: number, z: number, kind: number): void {
    this.cells[(z + HALF) * SIZE + (x + HALF)] = kind;
  }

  touches(x: number, z: number, ...kinds: number[]): boolean {
    return NEIGHBOURS.some(([dx, dz]) => kinds.includes(this.at(x + dx, z + dz)));
  }

  /** Distance to the nearest cell that is not lawn, searching up to `reach` blocks. */
  lawnClearance(x: number, z: number, reach: number): number {
    let best = reach;
    for (let dz = -reach; dz <= reach; dz++) {
      for (let dx = -reach; dx <= reach; dx++) {
        if (this.at(x + dx, z + dz) !== K.lawn) best = Math.min(best, Math.hypot(dx, dz));
      }
    }
    return best;
  }

  constructor() {
    for (let z = -HALF; z <= HALF; z++) {
      for (let x = -HALF; x <= HALF; x++) this.put(x, z, this.classify(x, z));
    }
    // Curb line: any sidewalk cell that borders the roadway.
    for (let z = -HALF; z <= HALF; z++) {
      for (let x = -HALF; x <= HALF; x++) {
        if (this.at(x, z) === K.walk && this.touches(x, z, K.road, K.zebra)) this.put(x, z, K.curb);
      }
    }
  }

  private classify(x: number, z: number): number {
    const r = Math.hypot(x, z);
    if (r < R_ISLAND) {
      const ray =
        r >= RAY_FROM &&
        AVENUES.some((a) => along(a, x, z) > 0 && Math.abs(side(a, x, z)) <= RAY_HALF_WIDTH + EPS);
      return ray ? K.ray : K.island;
    }
    if (r < R_ISLAND_CURB) return K.islandCurb;
    if (r < R_RING_OUT) return K.road;

    // Beyond the ring: avenue roadway beats avenue sidewalk beats the sidewalk ring beats lawn.
    let kind: number = r < R_WALK_OUT ? K.walk : K.lawn;
    for (const a of AVENUES) {
      const s = along(a, x, z);
      if (s <= 0) continue;
      const d = Math.abs(side(a, x, z));
      if (d <= a.roadHalf + EPS) {
        kind = s >= CROSSING[0] && s < CROSSING[1] && zebraBar(a, x, z) ? K.zebra : K.road;
        break;
      }
      if (d <= a.outerHalf + EPS) kind = K.walk;
    }
    return kind;
  }
}

/** Zebra bars run along the avenue, one block wide with one block gaps, symmetric about the axis. */
function zebraBar(a: Avenue, x: number, z: number): boolean {
  return (Math.round(side(a, x, z)) + a.roadHalf + 1) % 2 === 0;
}

// -- pieces --------------------------------------------------------------------------------

/** A sidewalk-style cell: paving underneath, a bottom slab on top so it reads half a block high. */
function slabbed(build: Build, x: number, z: number, paving: string | MaterialFn): void {
  const base = typeof paving === "string" ? paving : paving(x, -1, z);
  build.set(x, -1, z, base);
  build.set(x, 0, z, slabOf(base));
}

/** Face-connected cells from `a` to `b`, both included. */
function gridPath(a: readonly [number, number], b: readonly [number, number]): [number, number][] {
  const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
  const out: [number, number][] = [[a[0], a[1]]];
  for (let k = 1; k <= n; k++) {
    const x = Math.round(a[0] + ((b[0] - a[0]) * k) / n);
    const z = Math.round(a[1] + ((b[1] - a[1]) * k) / n);
    const last = out[out.length - 1] as [number, number];
    if (x !== last[0] && z !== last[1]) out.push([x, last[1]]);
    out.push([x, z]);
  }
  return out;
}

/** Low stone bollards around the island edge, joined by horizontal chains. */
function bollards(build: Build): void {
  const count = 48;
  const posts: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const phi = (i * 2 * Math.PI) / count;
    posts.push([Math.round(R_BOLLARD * Math.cos(phi)), Math.round(R_BOLLARD * Math.sin(phi))]);
  }
  posts.forEach(([x, z], i) => {
    const [nx, nz] = posts[(i + 1) % count] as [number, number];
    const path = gridPath([x, z], [nx, nz]);
    for (let j = 1; j < path.length - 1; j++) {
      const [cx, cz] = path[j] as [number, number];
      const next = path[j + 1] as [number, number];
      build.set(cx, 1, cz, `minecraft:iron_chain[axis=${next[0] !== cx ? "x" : "z"}]`);
    }
  });
  for (const [x, z] of posts) {
    build.pillar([x, 0, z], 2, BOLLARD);
    build.set(x, 2, z, BOLLARD_CAP);
  }
}

/** A Parisian street lamp: a dark iron post, a lantern on top. */
function lamp(build: Build, x: number, z: number): void {
  lanternPost(build, x, 0, z, { height: 4, post: LAMP_POST });
}

/** Bare earth round a tree set in a sidewalk: the trunk cell and its four sidewalk neighbours. */
function treePit(build: Build, ground: Ground, x: number, z: number): void {
  build.set(x, -1, z, PIT);
  for (const [dx, dz] of NEIGHBOURS) {
    if (ground.at(x + dx, z + dz) !== K.walk) continue;
    build.carve([x + dx, 0, z + dz], [x + dx, 0, z + dz]);
    build.set(x + dx, -1, z + dz, PIT);
  }
}

/** A Paris plane tree: straight trunk 5-7 tall, rounded crown, slightly different every time. */
function planeTree(build: Build, rng: Rng, x: number, z: number): void {
  const h = rng.int(5, 7);
  const rx = rng.uniform(3.0, 3.6);
  const ry = rng.uniform(2.4, 3.0);
  const rz = rng.uniform(3.0, 3.6);
  const cy = h + 1;
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      for (let dz = -Math.ceil(rz); dz <= Math.ceil(rz); dz++) {
        const q = (dx / rx) ** 2 + (dy / ry) ** 2 + (dz / rz) ** 2;
        if (q > 1 || (q > 0.7 && rng.random() < 0.22)) continue;
        if (build.get(x + dx, cy + dy, z + dz) === null) build.set(x + dx, cy + dy, z + dz, LEAVES);
      }
    }
  }
  build.pillar([x, 0, z], h + 2, TRUNK);
}

export function buildPlace(build: Build): void {
  const rng = build.rng("place");
  const ground = new Ground();

  build.scope(() => {
    // -- ground ---------------------------------------------------------------------------
    for (let z = -HALF; z <= HALF; z++) {
      for (let x = -HALF; x <= HALF; x++) {
        switch (ground.at(x, z)) {
          case K.island:
            build.set(x, -1, z, ISLAND);
            break;
          case K.ray:
            build.set(x, -1, z, RAY);
            break;
          case K.islandCurb:
            slabbed(build, x, z, ISLAND_CURB);
            break;
          case K.road:
            build.set(x, -1, z, ROAD);
            break;
          case K.zebra:
            build.set(x, -1, z, ZEBRA);
            break;
          case K.walk:
            slabbed(build, x, z, PAVING);
            break;
          case K.curb:
            slabbed(build, x, z, CURB);
            break;
          case K.lawn:
            build.set(x, -1, z, GRASS);
            break;
        }
      }
    }

    // -- island bollards ------------------------------------------------------------------
    bollards(build);

    // -- hedges along every sidewalk edge ------------------------------------------------------
    for (let z = -HALF; z <= HALF; z++) {
      for (let x = -HALF; x <= HALF; x++) {
        if (ground.at(x, z) === K.lawn && ground.touches(x, z, K.walk, K.curb)) {
          build.set(x, 0, z, HEDGE);
        }
      }
    }

    // -- trees and lamps along the avenues ------------------------------------------------------
    const spacing = 7;
    for (const a of AVENUES) {
      for (let s = FIRST_TREE; s < 2 * HALF; s += spacing) {
        for (const row of a.rows) {
          for (const sign of [-1, 1]) {
            const [x, z] = onAvenue(a, s, sign * row);
            if (Math.abs(x) > TREE_LIMIT || Math.abs(z) > TREE_LIMIT) continue;
            if (ground.at(x, z) !== K.walk) continue;
            treePit(build, ground, x, z);
            planeTree(build, rng, x, z);
          }
        }
      }
      // A lamp on the kerb row, halfway between two trees, every other gap.
      for (let s = FIRST_TREE + spacing / 2; s < 2 * HALF; s += 2 * spacing) {
        for (const sign of [-1, 1]) {
          const [x, z] = onAvenue(a, s, sign * (a.rows[0] as number));
          if (ground.at(x, z) === K.walk) lamp(build, x, z);
        }
      }
    }

    // -- lamps on the sidewalk ring, between the avenue mouths -----------------------------------
    const mouth = (a: Avenue): number => Math.asin((a.roadHalf + 2) / R_LAMP);
    for (let k = 0; k < 12; k++) {
      const a0 = AVENUES[k] as Avenue;
      const a1 = AVENUES[(k + 1) % 12] as Avenue;
      const lo = (k * Math.PI) / 6 + mouth(a0);
      const hi = ((k + 1) * Math.PI) / 6 - mouth(a1);
      const n = Math.round(((hi - lo) * R_LAMP) / 12);
      for (let i = 0; i < n; i++) {
        const phi = lo + ((i + 0.5) * (hi - lo)) / n;
        const x = Math.round(R_LAMP * Math.cos(phi));
        const z = Math.round(R_LAMP * Math.sin(phi));
        if (ground.at(x, z) === K.walk) lamp(build, x, z);
      }
    }

    // -- plane trees in the wedge gardens, on staggered arcs -----------------------------------
    const planted: [number, number][] = [];
    for (let ring = 0, r = 72; r < 130; ring++, r += 9) {
      const step = 9 / r;
      for (let i = 0; i * step < 2 * Math.PI; i++) {
        const phi = (i + (ring % 2) * 0.5) * step;
        const x = Math.round(r * Math.cos(phi) + rng.uniform(-1, 1));
        const z = Math.round(r * Math.sin(phi) + rng.uniform(-1, 1));
        if (Math.abs(x) > TREE_LIMIT || Math.abs(z) > TREE_LIMIT) continue;
        if (ground.at(x, z) !== K.lawn || ground.lawnClearance(x, z, 4) < 3.5) continue;
        if (planted.some(([px, pz]) => Math.hypot(px - x, pz - z) < 7)) continue;
        planted.push([x, z]);
        planeTree(build, rng, x, z);
      }
    }

    // -- grass tufts and the odd flower on the lawns -----------------------------------------
    for (let z = -HALF; z <= HALF; z++) {
      for (let x = -HALF; x <= HALF; x++) {
        if (ground.at(x, z) === K.lawn && build.get(x, 0, z) === null && rng.random() < 0.06) {
          build.set(x, 0, z, rng.choice(PLANTS));
        }
      }
    }
  });
}
