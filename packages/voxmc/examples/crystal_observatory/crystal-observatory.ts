// SPDX-License-Identifier: AGPL-3.0-only

// Floating crystal observatory.
//
// - Floating sky island: tapered craggy stone/deepslate underbelly with exposed
//   amethyst geode heart, hanging stalactites and crystal clusters, moss/stone
//   terraced top, plus two detached floating crystal-rock satellite islets.
// - Large crystal formations: multi-block angled amethyst + stained-glass
//   crystal spires bursting from the island rim and underside.
// - Observatory: cylindrical stone and deepslate tower with overhanging
//   cornice, small interior (glowing crystal orrery, star-chart lectern,
//   bookshelves, ladder to dome deck), cantilevered south viewing deck, and an
//   oxidized-copper hemisphere dome with an open shutter slit and a giant
//   refracting telescope.
//
// Block variety comes from the build's seeded RNG, so the exact stone and
// copper picks differ from the Python original; every position is identical.

import { Build, Geometry, shapes } from "../../src/index.ts";
import { pyRound, range } from "../py.ts";

const VIEWS = [
  "iso",
  "az045_el025",
  "az135_el025",
  "az225_el025",
  "az315_el025",
  "az180_el015",
  "top",
];

export const BUILD = new Build({ seed: 42, views: VIEWS });
const rng = BUILD.rng();

type Choices = readonly (readonly [string, number])[];

/** Weighted random pick using the build's RNG. */
function mottled(choices: Choices): string {
  const r = rng.random();
  let acc = 0;
  for (const [block, weight] of choices) {
    acc += weight;
    if (r <= acc) return block;
  }
  return (choices[choices.length - 1] as readonly [string, number])[0];
}

const ROCK_DARK: Choices = [
  ["minecraft:deepslate", 0.45],
  ["minecraft:cobbled_deepslate", 0.35],
  ["minecraft:tuff", 0.2],
];
const ROCK_MID: Choices = [
  ["minecraft:stone", 0.45],
  ["minecraft:andesite", 0.3],
  ["minecraft:cobblestone", 0.15],
  ["minecraft:tuff", 0.1],
];
const TOP_TURF: Choices = [
  ["minecraft:moss_block", 0.58],
  ["minecraft:grass_block", 0.28],
  ["minecraft:rooted_dirt", 0.14],
];
const WALL_PALETTE: Choices = [
  ["minecraft:stone_bricks", 0.5],
  ["minecraft:mossy_stone_bricks", 0.2],
  ["minecraft:cracked_stone_bricks", 0.15],
  ["minecraft:polished_andesite", 0.15],
];
const DOME_PALETTE: Choices = [
  ["minecraft:oxidized_cut_copper", 0.55],
  ["minecraft:weathered_cut_copper", 0.3],
  ["minecraft:prismarine_bricks", 0.15],
];

/** Reusable Geometry datablock for detached floating sky islets. */
function makeFloatingIslet(): Geometry {
  const g = new Geometry();
  for (let dx = -2; dx < 3; dx++) {
    for (let dy = -3; dy < 2; dy++) {
      for (let dz = -2; dz < 3; dz++) {
        // Tapered inverted mini-cone
        const maxR = dy >= 0 ? 2.1 : dy === -1 ? 1.5 : dy === -2 ? 0.9 : 0.4;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d <= maxR) {
          if (dy === 1) g.set(dx, dy, dz, d < 1.5 ? "minecraft:moss_block" : "minecraft:stone");
          else if (dy === 0)
            g.set(dx, dy, dz, (dx + dz) % 2 === 0 ? "minecraft:stone" : "minecraft:andesite");
          else g.set(dx, dy, dz, "minecraft:cobbled_deepslate");
        }
      }
    }
  }
  // Crystal spire sprouting out of the islet
  for (let cy = 1; cy < 5; cy++)
    g.set(0, cy, 0, cy < 4 ? "minecraft:amethyst_block" : "minecraft:purple_stained_glass");
  g.set(1, 2, 0, "minecraft:amethyst_block");
  g.set(0, 2, 1, "minecraft:purple_stained_glass");
  g.set(0, 5, 0, "minecraft:amethyst_cluster[facing=up]");
  g.set(0, -4, 0, "minecraft:amethyst_cluster[facing=down]");
  return g;
}

/** Place a dense, face-connected 3D crystal spire along a vector. */
function drawCrystalSpire(
  base: readonly [number, number, number],
  direction: readonly [number, number, number],
  length: number,
  baseRadius: number,
): void {
  const [bx, by, bz] = base;
  const norm = Math.sqrt(direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2);
  const [dx, dy, dz] = [direction[0] / norm, direction[1] / norm, direction[2] / norm];
  // Half-step sampling guarantees 6-connected voxel continuity (no floating diagonal orphans)
  const substeps = length * 2;
  let lastPos: [number, number, number] = [bx, by, bz];
  for (let s = 0; s <= substeps; s++) {
    const t = s / Math.max(1, substeps);
    const distAlong = t * length;
    const cx = bx + dx * distAlong;
    const cy = by + dy * distAlong;
    const cz = bz + dz * distAlong;
    lastPos = [pyRound(cx), pyRound(cy), pyRound(cz)];
    const r = Math.max(0.55, baseRadius * (1.0 - 0.72 * t));
    const ir = Math.ceil(r);
    for (let ox = -ir; ox <= ir; ox++) {
      for (let oy = -ir; oy <= ir; oy++) {
        for (let oz = -ir; oz <= ir; oz++) {
          // Octahedral + spherical blend for faceted crystal look
          const dEuclid = Math.sqrt(ox * ox + oy * oy + oz * oz);
          const dOct = (Math.abs(ox) + Math.abs(oy) + Math.abs(oz)) * 0.72;
          const dist = 0.6 * dEuclid + 0.4 * dOct;
          if (dist <= r) {
            const [px, py, pz] = [pyRound(cx + ox), pyRound(cy + oy), pyRound(cz + oz)];
            let blk: string;
            if (dist < r * 0.42 && t < 0.7)
              blk = s % 5 === 0 ? "minecraft:sea_lantern" : "minecraft:budding_amethyst";
            else if (t > 0.8) blk = "minecraft:magenta_stained_glass";
            else if (t > 0.5 && (px + py + pz) % 2 === 0) blk = "minecraft:purple_stained_glass";
            else blk = "minecraft:amethyst_block";
            BUILD.set(px, py, pz, blk);
          }
        }
      }
    }
  }
  // Faceted crystal cluster directly attached to the final voxel
  const [tx, ty, tz] = lastPos;
  if (dy >= 0) BUILD.set(tx, ty + 1, tz, "minecraft:amethyst_cluster[facing=up]");
  else BUILD.set(tx, ty - 1, tz, "minecraft:amethyst_cluster[facing=down]");
}

const ISLET_GEO = makeFloatingIslet();

BUILD.scope(() => {
  // =========================================================================
  // 1. FLOATING ISLAND (center=(0, 14, 0), y=3..14)
  // =========================================================================
  for (let y = 3; y < 15; y++) {
    const t = (y - 3) / 11.0; // 0 at bottom tip, 1 at top surface
    const baseR = 0.9 + t ** 0.72 * 9.6;
    const ir = Math.ceil(baseR + 2);
    for (let x = -ir; x <= ir; x++) {
      for (let z = -ir; z <= ir; z++) {
        const angle = Math.atan2(z, x);
        const lobe =
          1.0 +
          0.14 * Math.sin(angle * 3 + 0.7) +
          0.1 * Math.cos(angle * 5 - 0.4) +
          0.06 * Math.sin(y * 1.3 + x * 0.5);
        const rEff = baseR * lobe;
        const dist = Math.sqrt(x * x + (z * 0.92) ** 2);
        if (dist <= rEff) {
          if (y === 14) {
            BUILD.set(x, y, z, dist > rEff - 1.3 ? mottled(ROCK_MID) : mottled(TOP_TURF));
          } else if (y >= 11) {
            BUILD.set(x, y, z, mottled(ROCK_MID));
          } else if (dist < 2.0 && y <= 7) {
            BUILD.set(x, y, z, "minecraft:amethyst_block");
          } else {
            BUILD.set(x, y, z, mottled(ROCK_DARK));
          }
        }
      }
    }
  }

  // Craggy stone & deepslate stalactites dripping from the island underside
  const stalactites = [
    [0, 3, 0, 3, "minecraft:amethyst_block"],
    [-3, 6, -2, 3, "minecraft:cobbled_deepslate_wall"],
    [4, 7, 2, 3, "minecraft:cobbled_deepslate_wall"],
    [-5, 9, 3, 2, "minecraft:tuff_wall"],
    [3, 7, -4, 3, "minecraft:cobbled_deepslate_wall"],
    [-2, 5, 2, 3, "minecraft:amethyst_block"],
    [2, 5, -2, 2, "minecraft:amethyst_block"],
  ] as const;
  for (const [sx, sy, sz, h, blk] of stalactites) {
    BUILD.pillar([sx, sy - h, sz], h, blk);
    if (blk === "minecraft:amethyst_block")
      BUILD.set(sx, sy - h - 1, sz, "minecraft:amethyst_cluster[facing=down]");
  }

  // Hanging chains with soul lanterns under the rim
  for (const [cx, cy, cz] of [
    [-6, 10, 4],
    [6, 10, 4],
    [0, 9, 7],
    [-6, 10, -5],
  ] as const) {
    BUILD.pillar([cx, cy - 2, cz], 2, "minecraft:iron_chain[axis=y]");
    BUILD.set(cx, cy - 3, cz, "minecraft:soul_lantern[hanging=true]");
  }

  // =========================================================================
  // 2. LARGE CRYSTAL FORMATIONS + FLOATING SATELLITE ISLETS
  // =========================================================================
  // West primary crystal formation (sweeping up and out)
  drawCrystalSpire([-6, 12, -1], [-0.65, 0.85, -0.15], 11, 2.1);
  drawCrystalSpire([-7, 12, 2], [-0.75, 0.68, 0.25], 8, 1.3);
  // East-Northeast crystal formation (counterbalancing spire cluster)
  drawCrystalSpire([6, 12, -2], [0.68, 0.82, -0.25], 10, 2.0);
  drawCrystalSpire([6, 12, 2], [0.78, 0.62, 0.25], 7, 1.3);
  // North-Northwest dorsal crystal formation (frames the observatory from behind)
  drawCrystalSpire([-2, 13, -7], [-0.25, 0.82, -0.65], 9, 1.8);
  // Underbelly central crystal root spike (pointing straight down into the void)
  drawCrystalSpire([0, 5, 0], [0.0, -1.0, 0.0], 5, 1.6);
  // Surface crystal buds around the island rim
  for (const [bx, bz] of [
    [-5, 5],
    [5, 5],
    [-7, -3],
    [7, 0],
    [3, -7],
  ] as const) {
    BUILD.set(bx, 15, bz, "minecraft:amethyst_cluster[facing=up]");
  }
  // Two detached floating satellite islets positioned in clear sky across views
  BUILD.place(ISLET_GEO, { at: [-15, 9, 4] });
  BUILD.place(ISLET_GEO, { at: [15, 11, -4] });

  // =========================================================================
  // 3. OBSERVATORY TOWER + SMALL INTERIOR (center=(0, y, -1), radius=5.2)
  // =========================================================================
  const [towerCx, towerCz] = [0, -1];
  const towerR = 5.2;

  // Plinth & inlaid floor at y=15
  for (const x of range(-6, 7)) {
    for (const z of range(-7, 6)) {
      const d = Math.sqrt((x - towerCx) ** 2 + (z - towerCz) ** 2);
      if (d <= towerR + 0.6) {
        if (d <= towerR - 1.0) {
          if ((x === towerCx || z === towerCz) && d < 3.8)
            BUILD.set(x, 15, z, "minecraft:chiseled_stone_bricks");
          else if (d < 1.6) BUILD.set(x, 15, z, "minecraft:amethyst_block");
          else BUILD.set(x, 15, z, "minecraft:spruce_planks");
        } else {
          BUILD.set(x, 15, z, "minecraft:deepslate_bricks");
        }
      }
    }
  }

  // Cylindrical walls y=16..22
  for (const y of range(16, 23)) {
    for (const x of range(-6, 7)) {
      for (const z of range(-7, 6)) {
        const [dx, dz] = [x - towerCx, z - towerCz];
        const d = Math.sqrt(dx * dx + dz * dz);
        if (towerR - 0.85 <= d && d <= towerR + 0.35) {
          if (y === 16) BUILD.set(x, y, z, "minecraft:deepslate_bricks");
          else if (y === 19) BUILD.set(x, y, z, "minecraft:chiseled_stone_bricks");
          else if (y === 22) BUILD.set(x, y, z, "minecraft:polished_deepslate");
          else BUILD.set(x, y, z, mottled(WALL_PALETTE));
        } else if (d < towerR - 0.85) {
          BUILD.carve([x, y, z], [x, y, z]);
        }
      }
    }
  }

  // Exterior dark deepslate buttress ribs + cornice lanterns
  const ribOffsets = [
    [-5, 0],
    [5, 0],
    [0, -5],
    [-4, -4],
    [4, -4],
    [-4, 4],
    [4, 4],
  ] as const;
  const ribPillar = shapes.pillar([0, 0, 0], 6, "minecraft:deepslate_tile_wall");
  for (const [rx, rz] of ribOffsets) {
    const [px, pz] = [towerCx + rx, towerCz + rz];
    BUILD.set(px, 15, pz, "minecraft:polished_deepslate");
    BUILD.set(px, 16, pz, "minecraft:chiseled_deepslate");
    BUILD.place(ribPillar, { at: [px, 17, pz] });
    BUILD.set(px, 22, pz, "minecraft:polished_deepslate");
    BUILD.set(px, 23, pz, "minecraft:lantern");
  }

  // Overhanging cornice trim at y=22 along cardinal walls
  for (const i of [-2, -1, 0, 1, 2]) {
    BUILD.set(i, 22, -7, "minecraft:deepslate_brick_stairs[facing=south,half=top]");
    if (Math.abs(i) === 2)
      BUILD.set(i, 22, 5, "minecraft:deepslate_brick_stairs[facing=north,half=top]");
    BUILD.set(-6, 22, towerCz + i, "minecraft:deepslate_brick_stairs[facing=east,half=top]");
    BUILD.set(6, 22, towerCz + i, "minecraft:deepslate_brick_stairs[facing=west,half=top]");
  }

  // Tall arched stained-glass windows on East, West, North
  for (const [wx, wz] of [
    [-5, -1],
    [5, -1],
    [0, -6],
  ] as const) {
    for (const wy of [17, 18, 20, 21]) BUILD.set(wx, wy, wz, "minecraft:purple_stained_glass");
  }

  // Grand South entrance archway opening onto the viewing deck
  BUILD.carve([-1, 16, 3], [1, 19, 5]);
  BUILD.set(-1, 19, 4, "minecraft:deepslate_brick_stairs[facing=west,half=top]");
  BUILD.set(1, 19, 4, "minecraft:deepslate_brick_stairs[facing=east,half=top]");
  BUILD.set(0, 20, 4, "minecraft:sea_lantern");
  BUILD.set(-1, 20, 4, "minecraft:chiseled_deepslate");
  BUILD.set(1, 20, 4, "minecraft:chiseled_deepslate");

  // Small interior details (y=16..19), visible through the grand archway
  BUILD.set(0, 16, -1, "minecraft:chiseled_deepslate");
  BUILD.set(0, 17, -1, "minecraft:sea_lantern");
  BUILD.set(0, 18, -1, "minecraft:amethyst_cluster[facing=up]");
  // Bookshelves & star-chart lectern along north interior wall
  for (const bx of [-2, -1, 1, 2]) {
    BUILD.set(bx, 16, -4, "minecraft:bookshelf");
    BUILD.set(bx, 17, -4, "minecraft:bookshelf");
  }
  BUILD.set(0, 16, -4, "minecraft:lectern[facing=south]");
  BUILD.set(0, 17, -4, "minecraft:lantern");
  BUILD.set(-3, 16, -2, "minecraft:cartography_table");
  BUILD.set(3, 16, -2, "minecraft:barrel[facing=up]");
  BUILD.set(3, 17, -2, "minecraft:lantern");
  // Ladder up to upper dome gallery on west inside wall
  for (const ly of range(16, 23)) BUILD.set(-4, ly, -1, "minecraft:ladder[facing=east]");

  // Upper observation platform floor at y=22 (with hatch opening & central light well)
  for (const x of range(-4, 5)) {
    for (const z of range(-5, 4)) {
      const d = Math.sqrt((x - towerCx) ** 2 + (z - towerCz) ** 2);
      if (d <= towerR - 0.8) BUILD.set(x, 22, z, "minecraft:spruce_slab[type=top]");
    }
  }
  BUILD.carve([-4, 22, -1], [-3, 22, -1]);
  BUILD.carve([-1, 22, -2], [1, 22, 0]);

  // =========================================================================
  // 4. VIEWING DECK / BALCONY (south side, z=4..9, y=15)
  // =========================================================================
  for (const x of range(-4, 5)) {
    for (const z of range(4, 10)) {
      if (Math.abs(x) === 4 && z === 9) continue;
      if (x === -4 || x === 4 || z === 9) BUILD.set(x, 15, z, "minecraft:deepslate_bricks");
      else if (x === 0 && 5 <= z && z <= 8) BUILD.set(x, 15, z, "minecraft:chiseled_stone_bricks");
      else BUILD.set(x, 15, z, "minecraft:spruce_planks");
    }
  }
  // Corbel supports underneath the viewing deck
  for (const sx of [-3, 0, 3]) {
    BUILD.set(sx, 14, 7, "minecraft:deepslate_brick_stairs[facing=north,half=top]");
    BUILD.set(sx, 14, 8, "minecraft:deepslate_brick_slab[type=top]");
    BUILD.set(sx, 13, 6, "minecraft:deepslate_brick_stairs[facing=north,half=top]");
  }
  // Viewing deck parapet railing & corner lanterns
  BUILD.line([-3, 16, 9], [3, 16, 9], "minecraft:deepslate_brick_wall");
  BUILD.line([-4, 16, 5], [-4, 16, 8], "minecraft:deepslate_brick_wall");
  BUILD.line([4, 16, 5], [4, 16, 8], "minecraft:deepslate_brick_wall");
  for (const [lx, lz] of [
    [-3, 9],
    [3, 9],
    [-4, 5],
    [4, 5],
  ] as const) {
    BUILD.set(lx, 16, lz, "minecraft:polished_deepslate");
    BUILD.set(lx, 17, lz, "minecraft:lantern");
  }
  // Brass/copper spotting scope on the viewing deck
  BUILD.set(2, 16, 7, "minecraft:deepslate_brick_wall");
  BUILD.set(2, 17, 7, "minecraft:cut_copper_slab[type=bottom]");
  BUILD.set(2, 17, 8, "minecraft:end_rod[facing=south]");
  // Exterior entry stairs from the west terrace up to the viewing deck
  BUILD.stairs([-6, 14, 6], "east", "minecraft:deepslate_brick_stairs", { length: 2, width: 2 });

  // =========================================================================
  // 5. TELESCOPE DOME + GIANT REFRACTING TELESCOPE (y=23..30)
  // =========================================================================
  const domeR = 5.35;
  for (const dy of range(0, 7)) {
    const y = 23 + dy;
    for (const x of range(-6, 7)) {
      for (const z of range(-7, 6)) {
        const [dx, dz] = [x - towerCx, z - towerCz];
        const d3 = Math.sqrt(dx * dx + (dy * 1.05) ** 2 + dz * dz);
        if (domeR - 0.95 <= d3 && d3 <= domeR + 0.25) {
          // Open observatory slit facing south (dz >= 0, x in -1..1)
          if (dz >= 0 && -1 <= dx && dx <= 1 && dy >= 1) continue;
          // Framed copper shutter ribs along the slit edges and meridian
          if (dz >= 0 && Math.abs(dx) === 2 && dy >= 1)
            BUILD.set(x, y, z, "minecraft:waxed_copper_block");
          else if (dx === 0 || dz === 0) BUILD.set(x, y, z, "minecraft:cut_copper");
          else BUILD.set(x, y, z, mottled(DOME_PALETTE));
        }
      }
    }
  }
  // Dome finial spire at the zenith
  BUILD.set(towerCx, 29, towerCz, "minecraft:polished_deepslate");
  BUILD.set(towerCx, 30, towerCz, "minecraft:deepslate_brick_wall");
  BUILD.set(towerCx, 31, towerCz, "minecraft:amethyst_cluster[facing=up]");

  // Giant refracting telescope mount + angled barrel emerging from the dome slit
  BUILD.box([-1, 23, -1], [1, 24, -1], "minecraft:polished_deepslate");
  BUILD.set(-1, 25, 0, "minecraft:polished_deepslate_wall");
  BUILD.set(1, 25, 0, "minecraft:polished_deepslate_wall");
  // Telescope tube: steps diagonally upward and southward from (0, 24, -1) to (0, 31, 6)
  for (let step = 0; step < 8; step++) {
    const ty = 24 + step;
    const tz = -1 + step;
    const tubeBlk =
      step === 0 || step === 3 || step === 6
        ? "minecraft:deepslate_tiles"
        : "minecraft:copper_block";
    BUILD.set(0, ty, tz, tubeBlk);
    BUILD.set(0, ty + 1, tz, "minecraft:cut_copper_stairs[facing=north,half=bottom]");
    if (step > 0) BUILD.set(0, ty - 1, tz, "minecraft:cut_copper_stairs[facing=south,half=top]");
    // Side cheek reinforcements along the lower barrel
    if (step === 1 || step === 2 || step === 4) {
      BUILD.set(-1, ty, tz, "minecraft:dark_oak_trapdoor[facing=west,half=bottom,open=true]");
      BUILD.set(1, ty, tz, "minecraft:dark_oak_trapdoor[facing=east,half=bottom,open=true]");
    }
  }
  // Flared objective lens hood + glowing crystal lens at the front aperture
  BUILD.set(0, 31, 7, "minecraft:sea_lantern");
  BUILD.set(-1, 31, 6, "minecraft:deepslate_tile_wall");
  BUILD.set(1, 31, 6, "minecraft:deepslate_tile_wall");
  BUILD.set(0, 32, 7, "minecraft:purple_stained_glass");
  BUILD.set(0, 30, 7, "minecraft:purple_stained_glass");
  BUILD.set(-1, 31, 7, "minecraft:purple_stained_glass");
  BUILD.set(1, 31, 7, "minecraft:purple_stained_glass");
  BUILD.set(0, 31, 8, "minecraft:amethyst_cluster[facing=south]");
  // Eyepiece at the bottom-north end of the telescope
  BUILD.set(0, 23, -2, "minecraft:end_rod[facing=north]");
});
