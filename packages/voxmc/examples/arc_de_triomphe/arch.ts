// SPDX-License-Identifier: AGPL-3.0-only

// Arc de Triomphe de l'Etoile, Paris: the monument itself.
//
// Coordinates: 1 block = 1 m, arch centre at x = 0, z = 0, +x east, +z south, y up. The ground
// surface is the block layer y = -1 (laid by the surrounding place), so the monument starts at
// y = 0. Everything stays inside x in [-14, 14], z in [-25, 25].
//
// Mass: x -11..11 (23 deep), z -22..22 (45 wide), solid up to y = 48; roof terrace surface at
// y = 49 with an iron-bar railing on the cornice edge (top y = 51).
// Vaults: the main vault runs along x through the full depth (z -7..7, springing y = 21, crown
// cell y = 28); the transverse vaults run along z through the full width (x -4..4, springing
// y = 14, crown cell y = 18). They cross, leaving four piers.
// Courses, bottom to top: plinth y 0..1 (1 out, plus a step), transverse impost y 13..14,
// main impost y 20..21, bas-relief panels y 23..29, archivolts round every arch, architrave
// y 31..32, recessed frieze with a procession relief y 33..37, cornice y 38..39 (2 out),
// attic y 40..46 with pilaster strips and 30 round shields, top cornice y 47..48.
// Sculpture groups stand on the east and west pier fronts; the Tomb of the Unknown Soldier lies
// under the centre of the main vault with its flame at the west end.
//
// Faces are described in local coordinates (u along the face, y, d outward from the wall plane),
// with u increasing to the viewer's right when looking at the face from outside.

import { type Build, type Material, patches, type Rng } from "../../src/index.ts";

const HX = 11; // half depth: x -11..11
const HZ = 22; // half width: z -22..22
const TOP = 48; // last solid layer

type Side = "east" | "west" | "north" | "south";
const INWARD: Record<Side, Side> = { east: "west", west: "east", north: "south", south: "north" };

interface Face {
  readonly name: Side;
  readonly nx: number; // outward normal
  readonly nz: number;
  readonly ux: number; // direction of increasing u
  readonly uz: number;
  readonly half: number; // distance of the wall plane from the centre
  readonly len: number; // half length of the face
  readonly main: boolean; // the main vault opens on this face (east and west)
}

const FACES: readonly Face[] = [
  { name: "east", nx: 1, nz: 0, ux: 0, uz: -1, half: HX, len: HZ, main: true },
  { name: "west", nx: -1, nz: 0, ux: 0, uz: 1, half: HX, len: HZ, main: true },
  { name: "south", nx: 0, nz: 1, ux: 1, uz: 0, half: HZ, len: HX, main: false },
  { name: "north", nx: 0, nz: -1, ux: -1, uz: 0, half: HZ, len: HX, main: false },
];

/** World cell of the face-local point (u, y, d); d = 0 is the wall plane, d > 0 outward. */
function at(f: Face, u: number, y: number, d: number): [number, number, number] {
  return [f.nx * (f.half + d) + f.ux * u, y, f.nz * (f.half + d) + f.uz * u];
}

// -- vault geometry -----------------------------------------------------------------------------
const MAIN_CY = 21; // springing level of the main vault
const MAIN_R = 7.5;
const TRANS_CY = 14; // springing level of the transverse vaults
const TRANS_R = 4.5;

const mainOpen = (z: number, y: number): boolean =>
  y >= 0 && (y <= MAIN_CY ? Math.abs(z) <= 7 : z * z + (y - MAIN_CY) ** 2 <= MAIN_R ** 2);
const transOpen = (x: number, y: number): boolean =>
  y >= 0 && (y <= TRANS_CY ? Math.abs(x) <= 4 : x * x + (y - TRANS_CY) ** 2 <= TRANS_R ** 2);
const solid = (x: number, y: number, z: number): boolean =>
  Math.abs(x) <= HX &&
  Math.abs(z) <= HZ &&
  y >= 0 &&
  y <= TOP &&
  !mainOpen(z, y) &&
  !transOpen(x, y);

// -- materials ----------------------------------------------------------------------------------
/** Pale limestone: smooth quartz and calcite in patches. */
const LIMESTONE = patches(
  [
    ["minecraft:smooth_quartz", 7],
    ["minecraft:calcite", 2],
  ],
  { scale: 2.5, salt: "arch-wall" },
);
const PEDESTAL = patches(
  [
    ["minecraft:smooth_quartz", 5],
    ["minecraft:calcite", 3],
    ["minecraft:polished_diorite", 2],
  ],
  { scale: 2, salt: "arch-pedestal" },
);
const Q = "minecraft:smooth_quartz"; // moulded courses (+ _stairs / _slab)
const PLINTH_BASE = "minecraft:polished_andesite"; // + _stairs / _slab
const PLINTH = patches(
  [
    ["minecraft:polished_andesite", 3],
    ["minecraft:smooth_stone", 3],
    ["minecraft:stone", 1],
  ],
  { scale: 2, salt: "arch-plinth" },
);
const SCULPT = patches(
  [
    ["minecraft:smooth_stone", 5],
    ["minecraft:polished_andesite", 2],
    ["minecraft:polished_diorite", 2],
  ],
  { scale: 3, salt: "arch-sculpt" },
);
const WING = patches(
  [
    ["minecraft:polished_diorite", 4],
    ["minecraft:smooth_quartz", 2],
  ],
  { scale: 3, salt: "arch-wing" },
);
const DECK = "minecraft:smooth_stone";
const AIR = "minecraft:air";

const stair = (base: string, facing: Side, top = false): string =>
  `${base}_stairs[facing=${facing},half=${top ? "top" : "bottom"}]`;
const slab = (base: string, top = false): string => `${base}_slab[type=${top ? "top" : "bottom"}]`;

// -- rings around the footprint ---------------------------------------------------------------------
interface RingCell {
  readonly x: number;
  readonly z: number;
  readonly side: Side | "corner";
}

/** The cells k blocks outside the footprint, as a closed outline. */
function ring(k: number): RingCell[] {
  const X = HX + k;
  const Z = HZ + k;
  const out: RingCell[] = [];
  for (let x = -X; x <= X; x++) {
    for (let z = -Z; z <= Z; z++) {
      const ex = Math.abs(x) === X;
      const ez = Math.abs(z) === Z;
      if (!ex && !ez) continue;
      const side: RingCell["side"] =
        ex && ez ? "corner" : ex ? (x > 0 ? "east" : "west") : z > 0 ? "south" : "north";
      out.push({ x, z, side });
    }
  }
  return out;
}

/** Is this ring cell in front of a vault opening at height y? */
function blocked(c: RingCell, y: number): boolean {
  if (c.side === "east" || c.side === "west") return mainOpen(c.z, y);
  if (c.side === "north" || c.side === "south") return transOpen(c.x, y);
  return false;
}

/** Fill one course of ring `k` at height y; `make` returns the block for a cell (or null). */
function course(
  b: Build,
  k: number,
  y: number,
  make: (c: RingCell) => Material | null,
  skipOpenings = true,
): void {
  for (const c of ring(k)) {
    if (skipOpenings && blocked(c, y)) continue;
    const m = make(c);
    if (m !== null) b.set(c.x, y, c.z, m);
  }
}

const stairCourse =
  (base: string, top: boolean) =>
  (c: RingCell): Material =>
    c.side === "corner" ? base : stair(base, INWARD[c.side], top);

// -- the mass and its vaults ---------------------------------------------------------------------

/** A coffer panel cell: which panel it belongs to, and how far it is from the panel centre. */
interface PanelCell {
  readonly key: string;
  readonly dist: number;
}

/** Is (a, y) next to the open part of a vault? `open` tells the vault's own openness. */
const nextToOpen = (open: (a: number, y: number) => boolean, a: number, y: number): boolean =>
  open(a + 1, y) || open(a - 1, y) || open(a, y + 1) || open(a, y - 1);

/**
 * Coffers of the main vault: a grid of 3 x 3 panels (4 along x, 30 degrees round the arch) with
 * one-block ribs between. Returns the panel a soffit cell belongs to, or null for ribs.
 */
function mainPanel(x: number, y: number, z: number): PanelCell | null {
  if (y < MAIN_CY || mainOpen(z, y) || !nextToOpen(mainOpen, z, y)) return null;
  if (Math.abs(x) >= 10 || Math.abs(x) % 4 === 2) return null;
  const sector = Math.atan2(y - MAIN_CY, z) / (Math.PI / 6);
  const k = Math.floor(sector);
  const frac = sector - k;
  if (frac < 0.12 || frac > 0.88) return null;
  const cx = 4 * Math.round(x / 4);
  return { key: `m${cx},${k}`, dist: Math.abs(x - cx) + Math.abs(frac - 0.5) * 4.2 };
}

/** The same for the transverse vaults: 4 along z, 60 degrees round the arch. */
function transPanel(x: number, y: number, z: number): PanelCell | null {
  const az = Math.abs(z);
  if (y < TRANS_CY || transOpen(x, y) || !nextToOpen(transOpen, x, y) || az <= 8 || az >= 21)
    return null;
  if (az % 4 === 1) return null;
  const sector = Math.atan2(y - TRANS_CY, x) / (Math.PI / 3);
  const k = Math.floor(sector);
  const frac = sector - k;
  if (frac < 0.1 || frac > 0.9) return null;
  const cz = 4 * Math.round((az - 3) / 4) + 3;
  return {
    key: `t${Math.sign(z)}${cz},${k}`,
    dist: Math.abs(az - cz) + Math.abs(frac - 0.5) * 5.2,
  };
}

function buildMass(b: Build): void {
  // pass 1: find the coffer panels and the cell nearest each panel centre (the rosette)
  const panel = new Map<string, PanelCell>();
  const centre = new Map<string, { at: string; dist: number }>();
  for (let x = -HX; x <= HX; x++) {
    for (let z = -HZ; z <= HZ; z++) {
      for (let y = MAIN_CY - 7; y <= TOP; y++) {
        if (!solid(x, y, z)) continue;
        const p = mainPanel(x, y, z) ?? transPanel(x, y, z);
        if (p === null) continue;
        const at = `${x},${y},${z}`;
        panel.set(at, p);
        const best = centre.get(p.key);
        if (best === undefined || p.dist < best.dist) centre.set(p.key, { at, dist: p.dist });
      }
    }
  }
  // pass 2: the mass, with panels recessed and a rosette in each
  for (let x = -HX; x <= HX; x++) {
    for (let z = -HZ; z <= HZ; z++) {
      for (let y = 0; y <= TOP; y++) {
        if (!solid(x, y, z)) continue;
        const at = `${x},${y},${z}`;
        const p = panel.get(at);
        if (p !== undefined) {
          if (centre.get(p.key)?.at !== at) continue; // recessed panel
          b.set(x, y, z, "minecraft:chiseled_quartz_block");
          continue;
        }
        b.set(x, y, z, LIMESTONE);
      }
    }
  }
}

// -- plinth, imposts, archivolts ---------------------------------------------------------------------

function buildBase(b: Build): void {
  course(b, 1, 0, () => PLINTH);
  course(b, 1, 1, () => PLINTH);
  course(b, 2, 0, (c) =>
    c.side === "corner" ? slab(PLINTH_BASE) : stair(PLINTH_BASE, INWARD[c.side]),
  );
}

function buildImposts(b: Build): void {
  // main impost (y 20..21) and the lesser transverse impost (y 13..14), round all four faces
  for (const y0 of [20, 13]) {
    course(b, 1, y0, stairCourse(Q, true));
    course(b, 1, y0 + 1, () => Q);
  }
  // inside the main vault: an overhanging course where the arch springs
  for (let x = -HX; x <= HX; x++) {
    b.set(x, 20, -7, stair(Q, "north", true));
    b.set(x, 20, 7, stair(Q, "south", true));
  }
  // inside the transverse vaults
  for (const sz of [-1, 1]) {
    for (let a = 8; a <= HZ; a++) {
      b.set(-4, 13, sz * a, stair(Q, "west", true));
      b.set(4, 13, sz * a, stair(Q, "east", true));
    }
  }
}

function buildArchivolts(b: Build): void {
  for (const f of FACES) {
    const [cy, r0, r1] = f.main ? [MAIN_CY, MAIN_R, 9.0] : [TRANS_CY, TRANS_R, 5.9];
    for (let u = -f.len; u <= f.len; u++) {
      for (let y = cy; y <= TOP; y++) {
        const d = Math.hypot(u, y - cy);
        if (d > r0 && d <= r1) b.set(...at(f, u, y, 1), Q);
      }
    }
    if (f.main) {
      for (let u = -1; u <= 1; u++) for (const y of [29, 30]) b.set(...at(f, u, y, 2), Q);
    }
  }
}

/** Inscription panels (names of victories and generals) on the inner walls of the main vault. */
function buildVaultInscriptions(b: Build, rng: Rng): void {
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      for (let a = 6; a <= 10; a++) {
        for (let y = 3; y <= 17; y++) {
          const text = y % 2 === 1 && y >= 5 && y <= 15 && rng.random() > 0.15;
          b.set(sx * a, y, sz * 8, text ? "minecraft:smooth_quartz" : AIR);
        }
      }
    }
  }
}

// -- entablature, attic, roof ------------------------------------------------------------------------

function buildEntablature(b: Build): void {
  // architrave
  course(b, 1, 31, () => Q);
  course(b, 1, 32, stairCourse(Q, false));
  // frieze: recess the wall, leaving a two-wide post at each corner
  for (let y = 33; y <= 37; y++) {
    for (const c of ring(0)) {
      const nearCorner = Math.abs(c.x) >= HX - 1 && Math.abs(c.z) >= HZ - 1;
      if (!nearCorner) b.set(c.x, y, c.z, AIR);
    }
  }
  // cornice: dentils, then a strongly projecting corona on upside-down stairs
  course(b, 1, 38, (c) => ((c.x + c.z) % 2 === 0 ? slab(Q, true) : null));
  course(b, 1, 39, () => Q);
  course(b, 2, 39, stairCourse(Q, true));
  course(b, 1, 40, stairCourse(Q, false));
}

const SHIELD_Y = 43; // centre row of the shields

/** Pilaster strips and shield centres (face-local u) of the attic on a face. */
function atticLayout(f: Face): { pilasters: number[]; shields: number[] } {
  const pilasters: number[] = [];
  const shields: number[] = [];
  if (f.main) {
    // pilasters at 2 + 4k, shields at 4k
    for (let k = -6; k <= 5; k++) pilasters.push(2 + 4 * k);
    for (let k = -5; k <= 5; k++) shields.push(4 * k);
  } else {
    for (const u of [-11, -10, -9, -8, -4, 0, 4, 8, 9, 10, 11]) pilasters.push(u);
    for (const u of [-6, -2, 2, 6]) shields.push(u);
  }
  return { pilasters, shields };
}

function shield(b: Build, f: Face, u: number): void {
  for (let du = -1; du <= 1; du++) {
    for (let dy = -1; dy <= 1; dy++) {
      const y = SHIELD_Y + dy;
      let block: Material;
      if (du === 0 && dy === 0) block = "minecraft:chiseled_stone_bricks";
      else if (du !== 0 && dy !== 0) block = slab("minecraft:polished_diorite", dy < 0);
      else block = "minecraft:polished_diorite";
      b.set(...at(f, u + du, y, 1), block);
    }
  }
}

function buildAttic(b: Build): void {
  for (const f of FACES) {
    const { pilasters, shields } = atticLayout(f);
    for (const u of pilasters) for (let y = 40; y <= 46; y++) b.set(...at(f, u, y, 1), Q);
    for (const u of shields) shield(b, f, u);
  }
  // corner posts are L-shaped: close the ring corners over the pilaster height
  for (const c of ring(1)) {
    if (c.side !== "corner") continue;
    for (let y = 40; y <= 46; y++) b.set(c.x, y, c.z, Q);
  }
  // top cornice
  course(b, 1, 47, stairCourse(Q, true));
  course(b, 1, 48, () => Q);
}

function buildRoof(b: Build): void {
  // terrace: the cornice outline is at ring 1, so the deck covers it as well
  for (let x = -HX; x <= HX; x++) for (let z = -HZ; z <= HZ; z++) b.set(x, TOP, z, DECK);
  const rail = new Set(ring(1).map((c) => `${c.x},${c.z}`));
  const has = (x: number, z: number): string => (rail.has(`${x},${z}`) ? "true" : "false");
  for (const c of ring(1)) {
    const state =
      `east=${has(c.x + 1, c.z)},north=${has(c.x, c.z - 1)},` +
      `south=${has(c.x, c.z + 1)},west=${has(c.x - 1, c.z)}`;
    for (const y of [TOP + 1, TOP + 2]) b.set(c.x, y, c.z, `minecraft:iron_bars[${state}]`);
  }
}

// -- relief and sculpture -----------------------------------------------------------------------

/**
 * A marching crowd in shallow relief on the plane `d`: a ledge along yBase, then figures every two
 * or three cells (a one-block body, a head, often an arm out to the side, now and then a lance).
 */
function skyline(
  b: Build,
  f: Face,
  [u0, u1]: readonly [number, number],
  [yBase, yTop]: readonly [number, number],
  d: number,
  rng: Rng,
): void {
  const put = (u: number, y: number): void => {
    if (u <= u1 && y <= yTop) b.set(...at(f, u, y, d), SCULPT);
  };
  for (let u = u0; u <= u1; u++) put(u, yBase);
  const room = yTop - yBase;
  for (let u = u0 + 1; u <= u1; u += rng.int(2, 3)) {
    const h = rng.int(2, Math.max(2, room - 1));
    for (let k = 1; k <= h; k++) put(u, yBase + k);
    put(u, yBase + h + 1); // head
    if (rng.random() < 0.25) {
      for (let k = 1; k <= room; k++) put(u + 1, yBase + k); // lance
    } else if (rng.random() < 0.6) {
      put(u + 1, yBase + h); // arm
    }
  }
}

/** The continuous procession on the frieze: the wall is recessed one block, figures stand in it. */
function buildFrieze(b: Build, rng: Rng): void {
  for (const f of FACES) {
    const span = f.main ? HZ - 2 : HX - 2;
    skyline(b, f, [-span, span], [33, 37], 0, rng);
  }
}

/** A framed bas-relief panel: a raised frame, a recessed field, a skyline of figures inside. */
function reliefPanel(
  b: Build,
  f: Face,
  [u0, u1]: readonly [number, number],
  [y0, y1]: readonly [number, number],
  rng: Rng,
): void {
  for (let u = u0; u <= u1; u++) {
    for (let y = y0; y <= y1; y++) {
      const edge = u === u0 || u === u1 || y === y0 || y === y1;
      if (edge) b.set(...at(f, u, y, 1), Q);
      else b.set(...at(f, u, y, 0), AIR);
    }
  }
  skyline(b, f, [u0 + 1, u1 - 1], [y0 + 1, y1 - 1], 0, rng);
}

const PIER_U = 16; // pier front centre, face-local

function buildPanels(b: Build, rng: Rng): void {
  for (const f of FACES) {
    if (f.main) {
      for (const s of [-1, 1])
        reliefPanel(
          b,
          f,
          [s * PIER_U - 5, s * PIER_U + 5].sort((p, q) => p - q) as [number, number],
          [23, 29],
          rng,
        );
    } else {
      reliefPanel(b, f, [-6, 6], [23, 29], rng);
    }
  }
}

/** Sprite templates, top row first. Digits: stone to that depth. a/b/c: lighter wing stone. */
const TPL = {
  stand: [".3.", "222", "222", ".2.", ".2.", "212"],
  armL: ["2..", "23.", "222", ".22", ".2.", ".2.", "212"],
  sword: ["1..", "1..", "2..", "23.", "222", ".22", ".2.", ".2.", "212"],
  kneel: [".3.", "222", "212"],
  robed: [".3.", "333", "333", "333", ".33", "333", "333"],
  genie: ["ab.....ba", "abb.3.bba", "abbb3bbba", ".bb333bb.", "..b333b..", "...232..."],
  victory: ["b.3.b", "bb2bb", ".b3b.", "..3.."],
  child: [".3.", "222"],
  staff: ["1", "1", "1", "1", "1", "1"],
} as const;
type Template = readonly string[];

const mirror = (t: Template): string[] => t.map((r) => [...r].reverse().join(""));

const GROUP_W = 9;
const GROUP_H = 12;
const GROUP_Y = 8;

class Grid {
  // row 0 is a rocky base the figures stand on
  readonly rows: string[][] = Array.from({ length: GROUP_H }, (_, r) =>
    Array(GROUP_W).fill(r === 0 ? "2" : "."),
  );
  /** Stamp a template with its bottom row `base` rows above the rock base, left edge at `col`. */
  stamp(t: Template, col: number, base: number): void {
    t.forEach((line, i) => {
      const row = this.rows[1 + base + (t.length - 1 - i)];
      if (!row) return;
      [...line].forEach((ch, j) => {
        if (ch !== "." && col + j >= 0 && col + j < GROUP_W) row[col + j] = ch;
      });
    });
  }
}

/** Fill one-cell holes between neighbouring figures, so a group reads as one mass. */
function closeGaps(g: Grid): void {
  const rows = g.rows;
  const filled = (r: number, c: number): boolean => (rows[r]?.[c] ?? ".") !== ".";
  const fill: [number, number][] = [];
  for (let r = 1; r < GROUP_H - 1; r++) {
    for (let c = 1; c < GROUP_W - 1; c++) {
      if (filled(r, c)) continue;
      if ((filled(r, c - 1) && filled(r, c + 1)) || (filled(r - 1, c) && filled(r + 1, c))) {
        fill.push([r, c]);
      }
    }
  }
  for (const [r, c] of fill) {
    const row = rows[r];
    if (row) row[c] = "1";
  }
}

/** Stand a sculpture group on a pedestal on the pier front centred at face-local `uc`. */
function buildGroup(b: Build, f: Face, uc: number, g: Grid, rng: Rng): void {
  // pedestal: footing, shaft with an inscription panel, projecting cap
  for (let u = uc - 5; u <= uc + 5; u++) {
    for (let d = 1; d <= 3; d++) {
      for (const y of [0, 1]) b.set(...at(f, u, y, d), PLINTH);
      if (d === 3) b.set(...at(f, u, 7, d), stair(Q, INWARD[f.name], true));
      else b.set(...at(f, u, 7, d), Q);
    }
  }
  for (let u = uc - 4; u <= uc + 4; u++) {
    for (let y = 2; y <= 6; y++) {
      for (let d = 1; d <= 2; d++) b.set(...at(f, u, y, d), PEDESTAL);
    }
  }
  for (let u = uc - 3; u <= uc + 3; u++) {
    for (let y = 3; y <= 5; y++) b.set(...at(f, u, y, 2), AIR);
    if ((u - uc) % 2 === 0) b.set(...at(f, u, 4, 2), "minecraft:polished_andesite");
  }
  // the figures
  closeGaps(g);
  g.rows.forEach((row, r) => {
    row.forEach((ch, c) => {
      if (ch === ".") return;
      const wing = ch >= "a";
      let depth = wing ? ch.charCodeAt(0) - 96 : Number(ch);
      if (rng.random() < 0.12)
        depth = Math.max(1, Math.min(3, depth + (rng.random() < 0.5 ? -1 : 1)));
      const u = uc - 4 + c;
      for (let d = 1; d <= depth; d++) b.set(...at(f, u, GROUP_Y + r, d), wing ? WING : SCULPT);
    });
  });
}

function groupDepart(rng: Rng): Grid {
  const g = new Grid();
  g.stamp(rng.random() < 0.5 ? TPL.armL : TPL.sword, 0, 0);
  g.stamp(TPL.stand, 3, 0);
  g.stamp(mirror(TPL.sword), 6, 0);
  g.stamp(TPL.genie, 0, 5);
  return g;
}

function groupTriomphe(rng: Rng): Grid {
  const g = new Grid();
  g.stamp(TPL.kneel, 0, 0);
  g.stamp(TPL.kneel, 6, 0);
  g.stamp(TPL.staff, rng.random() < 0.5 ? 1 : 7, 3);
  g.stamp(TPL.robed, 3, 0);
  g.stamp(TPL.victory, 2, 7);
  return g;
}

function groupResistance(rng: Rng): Grid {
  const g = new Grid();
  g.stamp(TPL.sword, 0, 0);
  g.stamp(mirror(TPL.armL), 3, 0);
  g.stamp(TPL.kneel, 6, 0);
  g.stamp(TPL.victory, 3, 6);
  if (rng.random() < 0.5) g.stamp(TPL.staff, 8, 3);
  return g;
}

function groupPaix(rng: Rng): Grid {
  const g = new Grid();
  g.stamp(TPL.child, 0, 0);
  g.stamp(TPL.robed, 3, 0);
  g.stamp(TPL.stand, 6, 0);
  g.stamp(TPL.staff, 8, 0);
  g.stamp(TPL.victory, 2, 7);
  if (rng.random() < 0.5) g.stamp(TPL.child, 1, 2);
  return g;
}

function buildGroups(b: Build, rng: Rng): void {
  const east = FACES[0] as Face;
  const west = FACES[1] as Face;
  buildGroup(b, east, PIER_U, groupDepart(rng), rng); // north pier: Le Depart de 1792
  buildGroup(b, east, -PIER_U, groupTriomphe(rng), rng); // south pier: Le Triomphe de 1810
  buildGroup(b, west, PIER_U, groupResistance(rng), rng); // south pier: La Resistance de 1814
  buildGroup(b, west, -PIER_U, groupPaix(rng), rng); // north pier: La Paix de 1815
}

/** Winged Renommees in shallow relief in the spandrels beside the crown of the main arch. */
const RENOMMEE = [
  "1111aaa",
  "..1.2aa",
  "...12aa",
  "....2aa",
  ".....2a",
  ".....2.",
  ".....2.",
  "......2",
  "......2",
];

function buildSpandrels(b: Build): void {
  for (const f of FACES) {
    if (!f.main) continue;
    for (const s of [-1, 1]) {
      RENOMMEE.forEach((line, i) => {
        const y = 30 - i;
        [...line].forEach((ch, j) => {
          if (ch === ".") return;
          const u = 4 + j;
          if (Math.hypot(u, y - MAIN_CY) <= 9.0 + 0.5 || y < MAIN_CY + 1) return;
          b.set(...at(f, s * u, y, 1), WING);
        });
      });
    }
  }
}

// -- the tomb --------------------------------------------------------------------------------------

function buildTomb(b: Build): void {
  // dark granite slab flush with the floor
  for (let x = -2; x <= 2; x++) {
    for (let z = -1; z <= 1; z++) b.set(x, -1, z, "minecraft:polished_blackstone");
  }
  // the eternal flame at the west end
  b.set(-2, 0, 0, "minecraft:campfire[lit=true,facing=east]");
  // low bronze rail round the tomb
  const rail = new Set<string>();
  for (let x = -4; x <= 4; x++) {
    for (let z = -3; z <= 3; z++) {
      if (Math.abs(x) === 4 || Math.abs(z) === 3) rail.add(`${x},${z}`);
    }
  }
  const has = (x: number, z: number): string => (rail.has(`${x},${z}`) ? "true" : "false");
  for (const key of rail) {
    const [xs, zs] = key.split(",");
    const x = Number(xs);
    const z = Number(zs);
    b.set(
      x,
      0,
      z,
      `minecraft:exposed_copper_bars[east=${has(x + 1, z)},north=${has(x, z - 1)},south=${has(x, z + 1)},west=${has(x - 1, z)}]`,
    );
  }
}

export function buildArch(build: Build): void {
  const rng: Rng = build.rng("arc-de-triomphe");
  build.scope((b) => {
    buildMass(b);
    buildVaultInscriptions(b, rng);
    buildBase(b);
    buildImposts(b);
    buildArchivolts(b);
    buildEntablature(b);
    buildAttic(b);
    buildRoof(b);
    buildFrieze(b, rng);
    buildPanels(b, rng);
    buildSpandrels(b);
    buildGroups(b, rng);
    buildTomb(b);
  });
}
