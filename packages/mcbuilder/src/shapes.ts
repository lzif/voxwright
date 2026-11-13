// SPDX-License-Identifier: AGPL-3.0-only

// Shapes: functions that compute block placements and return a Geometry.
//
// Every function here is pure: it returns a Geometry and places nothing. Use
// one directly, or through the `Build` method of the same name which places
// the geometry and returns it.
//
// Conventions shared by every shape:
// - +X east, +Y up, +Z south. Corners are inclusive and may be in any order.
// - `block` accepts any material spec.
// - Shapes that imply a direction (stairs, roofs) compute `facing`
//   themselves; pass the stair block without `facing`.
// - `seed` salts weighted-palette picks. `Build` passes its own seed.

import { canonicalize, joinBlockString, parseBlockString } from "@voxwright/core";
import { McbuilderError } from "./errors.ts";
import { Geometry, type Point } from "./geometry.ts";
import { type Material, type MaterialFn, resolveMaterial, type Seed } from "./materials.ts";

/** Horizontal unit step `[dx, dz]` per direction word. */
export const DIRECTIONS: Readonly<Record<string, readonly [number, number]>> = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0],
};

export interface SeedOption {
  seed?: Seed;
}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const show = (v: unknown): string => (Array.isArray(v) ? `[${v.join(", ")}]` : String(v));

function point(what: string, p: unknown): Point {
  if (!Array.isArray(p) || p.length !== 3)
    throw new McbuilderError(`${what} must be 3 ints, got ${show(p)}`);
  if (!p.every(isInt)) throw new McbuilderError(`${what} coordinates must be ints, got ${show(p)}`);
  return p as unknown as Point;
}

function corners(what: string, c1: Point, c2: Point): [Point, Point] {
  const [x1, y1, z1] = point(`${what}: c1`, c1);
  const [x2, y2, z2] = point(`${what}: c2`, c2);
  return [
    [Math.min(x1, x2), Math.min(y1, y2), Math.min(z1, z2)],
    [Math.max(x1, x2), Math.max(y1, y2), Math.max(z1, z2)],
  ];
}

function positive(what: string, v: unknown, minimum = 1): number {
  if (!isInt(v) || v < minimum)
    throw new McbuilderError(`${what} must be an int >= ${minimum}, got ${show(v)}`);
  return v;
}

function direction(what: string, d: string): string {
  const key = String(d).toLowerCase();
  if (!Object.hasOwn(DIRECTIONS, key)) {
    throw new McbuilderError(
      `${what}: invalid direction ${d}; expected one of [${Object.keys(DIRECTIONS).sort().join(", ")}]`,
    );
  }
  return key;
}

/** `block` with `extra` properties merged in (extra wins). */
function withProps(block: string, extra: Record<string, string>): string {
  const { name, props, nbt } = parseBlockString(block);
  const merged = new Map(props);
  for (const [k, v] of Object.entries(extra)) merged.set(k, v);
  return canonicalize(joinBlockString(name, merged, nbt ?? ""));
}

/** Resolves a material spec per cell into a Geometry. */
class Painter {
  readonly geo = new Geometry();
  private readonly plain: string | null;
  private readonly block: Material;
  private readonly seed: Seed;
  constructor(block: Material, seed: Seed) {
    this.block = block;
    this.seed = seed;
    this.plain = typeof block === "string" ? canonicalize(block) : null;
  }

  blockAt(x: number, y: number, z: number): string {
    return this.plain || resolveMaterial(this.block, x, y, z, this.seed);
  }

  put(x: number, y: number, z: number, extra?: Record<string, string>): void {
    const b = this.blockAt(x, y, z);
    this.geo.set(x, y, z, extra ? withProps(b, extra) : b);
  }
}

/** Per-cell stair block resolver that refuses a caller-given facing. */
function stairMaterial(what: string, block: Material, seed: Seed): MaterialFn {
  const at: MaterialFn = (x, y, z) => {
    const b = resolveMaterial(block, x, y, z, seed);
    if (parseBlockString(b).props.has("facing")) {
      throw new McbuilderError(
        `${what} computes 'facing' from the geometry; pass the stair block without a facing property`,
      );
    }
    return b;
  };
  at(0, 0, 0); // fail fast on a plain string with facing
  return at;
}

// -- boxes and lines ---------------------------------------------------------

/** Solid box between corners `c1` and `c2` (inclusive). */
export function box(c1: Point, c2: Point, block: Material, { seed }: SeedOption = {}): Geometry {
  const [[x1, y1, z1], [x2, y2, z2]] = corners("box", c1, c2);
  const p = new Painter(block, seed);
  for (let x = x1; x <= x2; x++)
    for (let y = y1; y <= y2; y++) for (let z = z1; z <= z2; z++) p.put(x, y, z);
  return p.geo;
}

/** The four vertical walls of the box `c1`..`c2`; no floor, no ceiling. */
export function walls(c1: Point, c2: Point, block: Material, { seed }: SeedOption = {}): Geometry {
  const [[x1, y1, z1], [x2, y2, z2]] = corners("walls", c1, c2);
  const p = new Painter(block, seed);
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      for (let z = z1; z <= z2; z++) {
        if (x === x1 || x === x2 || z === z1 || z === z2) p.put(x, y, z);
      }
    }
  }
  return p.geo;
}

/** Vertical column of `height` blocks going up from `base`. */
export function pillar(
  base: Point,
  height: number,
  block: Material,
  { seed }: SeedOption = {},
): Geometry {
  const [x, y, z] = point("pillar: base", base);
  const h = positive("pillar: height", height);
  return box([x, y, z], [x, y + h - 1, z], block, { seed });
}

const roundHalfUp = (v: number): number => Math.floor(v + 0.5);

/**
 * Straight line from `p1` to `p2` (inclusive), any direction. Face-connected:
 * consecutive cells always share a face, so steep diagonals never leave
 * blocks touching only at an edge or corner.
 */
export function line(p1: Point, p2: Point, block: Material, { seed }: SeedOption = {}): Geometry {
  const a = point("line: p1", p1);
  const b = point("line: p2", p2);
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
  const n = Math.max(Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2]));
  const pts: [number, number, number][] = [];
  for (let k = 0; k <= n; k++) {
    pts.push(
      [0, 1, 2].map((i) =>
        n ? roundHalfUp((a[i] as number) + ((d[i] as number) * k) / n) : (a[i] as number),
      ) as [number, number, number],
    );
  }
  const cells: [number, number, number][] = [pts[0] as [number, number, number]];
  for (const nxt of pts.slice(1)) {
    const cur = [...(cells[cells.length - 1] as [number, number, number])];
    while (cur[0] !== nxt[0] || cur[1] !== nxt[1] || cur[2] !== nxt[2]) {
      for (let i = 0; i < 3; i++) {
        if (cur[i] !== nxt[i]) {
          (cur[i] as number) += (nxt[i] as number) > (cur[i] as number) ? 1 : -1;
          break;
        }
      }
      cells.push([cur[0] as number, cur[1] as number, cur[2] as number]);
    }
  }
  const p = new Painter(block, seed);
  for (const [x, y, z] of cells) p.put(x, y, z);
  return p.geo;
}

export interface StairsOptions extends SeedOption {
  length?: number;
  target?: Point;
  width?: number;
}

/**
 * Straight staircase climbing toward `direction`. Step `i` sits `i` blocks
 * toward `direction` and `i` blocks up. Give exactly one of `length` (number
 * of steps) or `target` (the cell the top step must occupy, on the 1:1
 * diagonal from `start`; `target` equal to `start` is a one-step run).
 * `width` extends the run sideways toward +X or +Z.
 *
 * Facing rule (the canonical statement; `stairsRun` refers here): each step
 * gets `facing=<direction>`, the ascent direction, and `half=bottom`, so the
 * tall back sits uphill. The shape computes `facing`, so pass the stair
 * block without it: a block that already carries `facing` is refused with
 * `McbuilderError`, never overridden. Other properties and NBT on `block`
 * are kept.
 */
export function stairs(
  start: Point,
  dir: string,
  block: Material,
  options: StairsOptions = {},
): Geometry {
  const [sx, sy, sz] = point("stairs: start", start);
  const key = direction("stairs", dir);
  const [dx, dz] = DIRECTIONS[key] as readonly [number, number];
  let length = options.length;
  if ((length === undefined) === (options.target === undefined)) {
    throw new McbuilderError("stairs: give exactly one of length or target");
  }
  if (options.target !== undefined) {
    const [tx, ty, tz] = point("stairs: target", options.target);
    const rise = ty - sy;
    const along = dx * (tx - sx) + dz * (tz - sz);
    const across = dz * (tx - sx) - dx * (tz - sz);
    if (rise < 0 || along !== rise || across !== 0) {
      throw new McbuilderError(
        `stairs: target [${options.target.join(", ")}] is not on the 1:1 diagonal from [${start.join(", ")}] climbing ${key}`,
      );
    }
    length = rise + 1;
  }
  const len = positive("stairs: length", length);
  const width = positive("stairs: width", options.width ?? 1);
  const [px, pz] = dx ? [0, 1] : [1, 0];
  const stair = stairMaterial("stairs", block, options.seed);
  const geo = new Geometry();
  for (let i = 0; i < len; i++) {
    for (let w = 0; w < width; w++) {
      const x = sx + i * dx + w * px;
      const y = sy + i;
      const z = sz + i * dz + w * pz;
      geo.set(x, y, z, withProps(stair(x, y, z), { facing: key, half: "bottom" }));
    }
  }
  return geo;
}

/**
 * Script-port alias of `stairs`: the port of Python `part.stairs_run` and
 * `parts.stairs_run`, so a Python script calling `stairs_run` keeps the same
 * method name. Behaviour is identical to `stairs`, which is canonical; see
 * its doc comment for the facing rule. As in `stairs`, `length`, `target` and
 * `width` go in the options object instead of being positional.
 *
 * Divergence from Python: given a block that already has `facing`, Python
 * overrides it with the ascent direction, while this port refuses it with
 * `McbuilderError`. The refusal is intentional, as in `stairs` and
 * `roofGable`.
 */
export function stairsRun(
  start: Point,
  dir: string,
  block: Material,
  options: StairsOptions = {},
): Geometry {
  return stairs(start, dir, block, options);
}

/**
 * Straight horizontal run from `start` to `end` (inclusive), in either
 * direction. Port of Python `part.railing` and `parts.railing`. The run must
 * be axis-aligned: `start` and `end` share the same y, and share x or z.
 * Anything else throws `McbuilderError` naming the problem. The cells are
 * those of `line` on the same endpoints.
 *
 * Meant for fences and walls. The structure stores the bare block (for
 * example `minecraft:oak_fence`): the game resolves fence and wall
 * connections at paste time, so they are not saved in the build. A preview
 * that does not infer them draws fence posts without arms; the faithful
 * preview infers them itself.
 */
export function railing(
  start: Point,
  end: Point,
  block: Material,
  { seed }: SeedOption = {},
): Geometry {
  const [x1, y1, z1] = point("railing: start", start);
  const [x2, y2, z2] = point("railing: end", end);
  if (y1 !== y2) {
    throw new McbuilderError(
      `railing: start and end must share the same y level (got y=${y1} and y=${y2})`,
    );
  }
  if (x1 !== x2 && z1 !== z2) {
    throw new McbuilderError(
      `railing: run must be axis-aligned (x or z constant); got start=${show(start)} end=${show(end)}`,
    );
  }
  return line(start, end, block, { seed });
}

// -- round shapes ------------------------------------------------------------

export interface CylinderOptions extends SeedOption {
  axis?: "x" | "y" | "z";
  hollow?: boolean;
  fill?: Material | null;
}

/**
 * Cylinder of `radius` whose axis starts at `center`. `axis: "y"` grows
 * `height` blocks up; `"x"` / `"z"` lie on their side and grow toward +X / +Z.
 * `hollow` keeps a 1-block shell; `fill` fills the hollow interior.
 */
export function cylinder(
  center: Point,
  radius: number,
  height: number,
  block: Material,
  options: CylinderOptions = {},
): Geometry {
  const [cx, cy, cz] = point("cylinder: center", center);
  const r = positive("cylinder: radius", radius);
  const hgt = positive("cylinder: height", height);
  const axis = options.axis ?? "y";
  if (axis !== "x" && axis !== "y" && axis !== "z") {
    throw new McbuilderError(`cylinder: axis must be 'x', 'y' or 'z', got ${String(axis)}`);
  }
  const shell = new Painter(block, options.seed);
  const inner = options.fill ? new Painter(options.fill, options.seed) : null;
  const r2 = r * r;
  const in2 = (r - 1) ** 2;
  for (let h = 0; h < hgt; h++) {
    for (let a = -r; a <= r; a++) {
      for (let b = -r; b <= r; b++) {
        const d2 = a * a + b * b;
        if (d2 > r2) continue;
        const pos: Point =
          axis === "y"
            ? [cx + a, cy + h, cz + b]
            : axis === "x"
              ? [cx + h, cy + a, cz + b]
              : [cx + a, cy + b, cz + h];
        if (options.hollow && d2 <= in2) {
          if (inner) inner.put(...pos);
        } else {
          shell.put(...pos);
        }
      }
    }
  }
  return inner ? inner.geo.concat(shell.geo) : shell.geo;
}

export interface SphereOptions extends SeedOption {
  hollow?: boolean;
  thickness?: number;
  dome?: boolean;
  fill?: Material | null;
}

/**
 * Sphere of `radius` around `center`. `dome` keeps only the upper half
 * (`y >= center.y`). `hollow` keeps a shell `thickness` thick; `fill` fills
 * the hollow interior.
 */
export function sphere(
  center: Point,
  radius: number,
  block: Material,
  options: SphereOptions = {},
): Geometry {
  const [cx, cy, cz] = point("sphere: center", center);
  const r = positive("sphere: radius", radius);
  const thickness = positive("sphere: thickness", options.thickness ?? 1);
  const shell = new Painter(block, options.seed);
  const inner = options.fill ? new Painter(options.fill, options.seed) : null;
  const r2 = r * r;
  const in2 = Math.max(0, r - thickness) ** 2;
  for (let x = cx - r; x <= cx + r; x++) {
    for (let y = options.dome ? cy : cy - r; y <= cy + r; y++) {
      for (let z = cz - r; z <= cz + r; z++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
        if (d2 > r2) continue;
        if (options.hollow && d2 <= in2) {
          if (inner) inner.put(x, y, z);
        } else {
          shell.put(x, y, z);
        }
      }
    }
  }
  return inner ? inner.geo.concat(shell.geo) : shell.geo;
}

export interface ConeOptions extends SeedOption {
  hollow?: boolean;
}

/** Upright cone: base disc of `radius` at `center`, tip `height - 1` above. */
export function cone(
  center: Point,
  radius: number,
  height: number,
  block: Material,
  options: ConeOptions = {},
): Geometry {
  const [cx, cy, cz] = point("cone: center", center);
  const rad = positive("cone: radius", radius);
  const hgt = positive("cone: height", height);
  const p = new Painter(block, options.seed);
  for (let i = 0; i < hgt; i++) {
    const r = (rad * (hgt - i)) / hgt;
    const ri = Math.ceil(r);
    for (let x = cx - ri; x <= cx + ri; x++) {
      for (let z = cz - ri; z <= cz + ri; z++) {
        const d2 = (x - cx) ** 2 + (z - cz) ** 2;
        if (d2 > r * r) continue;
        const interior = d2 <= Math.max(0, r - 1) ** 2;
        if (options.hollow && interior && !(r < 1 && d2 === 0)) continue;
        p.put(x, cy + i, z);
      }
    }
  }
  return p.geo;
}

// -- roofs -------------------------------------------------------------------

export interface RoofGableOptions extends SeedOption {
  ridge: "x" | "z";
  verge?: Material | null;
  eave?: Material | null;
}

const halfDefault = (block: string): Record<string, string> =>
  parseBlockString(block).props.has("half") ? {} : { half: "bottom" };

/**
 * Gable roof of stairs over the XZ footprint of `c1`..`c2`. The lowest (eave)
 * row sits at `min(c1.y, c2.y)`. `ridge` is the axis the ridge line runs
 * along. The roof rises `ceil(span / 2)` rows; an odd span gets a single
 * ridge row. Optional trim, both stair materials without `facing`: `verge`
 * (the two gable-end columns) and `eave` (the lowest row on both slopes).
 */
export function roofGable(
  c1: Point,
  c2: Point,
  block: Material,
  options: RoofGableOptions,
): Geometry {
  const { ridge, seed } = options;
  if (ridge !== "x" && ridge !== "z") {
    throw new McbuilderError(`roof_gable: ridge must be 'x' or 'z', got ${String(ridge)}`);
  }
  const [[x1, y0, z1], [x2, , z2]] = corners("roof_gable", c1, c2);
  const body = stairMaterial("roof_gable", block, seed);
  const verge = options.verge ? stairMaterial("roof_gable", options.verge, seed) : null;
  const eave = options.eave ? stairMaterial("roof_gable", options.eave, seed) : null;
  const [lo, hi, runLo, runHi, faceLo, faceHi] =
    ridge === "x" ? [z1, z2, x1, x2, "south", "north"] : [x1, x2, z1, z2, "east", "west"];
  const span = (hi as number) - (lo as number) + 1;
  const geo = new Geometry();

  const put = (across: number, run: number, row: number, facing: string): void => {
    const [x, z] = ridge === "x" ? [run, across] : [across, run];
    const y = y0 + row;
    let mat = body;
    if (verge && (run === runLo || run === runHi)) mat = verge;
    else if (eave && row === 0) mat = eave;
    const b = mat(x, y, z);
    geo.set(x, y, z, withProps(b, { facing, ...halfDefault(b) }));
  };

  for (let row = 0; row < Math.floor(span / 2); row++) {
    for (let run = runLo as number; run <= (runHi as number); run++) {
      put((lo as number) + row, run, row, faceLo as string);
      put((hi as number) - row, run, row, faceHi as string);
    }
  }
  if (span % 2) {
    const row = Math.floor(span / 2);
    for (let run = runLo as number; run <= (runHi as number); run++)
      put((lo as number) + row, run, row, faceHi as string);
  }
  return geo;
}

export interface RoofHipOptions extends SeedOption {
  hip: Material;
  cap?: Material | null;
}

/**
 * Hip roof: all four sides slope up, one row per block inward. `block` is the
 * stair material (no `facing`) for the slopes; `hip` is the full block used
 * on the diagonal hip lines. The top ring that collapses to a line or a
 * single cell is filled with `cap` (default: `hip`).
 */
export function roofHip(c1: Point, c2: Point, block: Material, options: RoofHipOptions): Geometry {
  const [[x1, y0, z1], [x2, , z2]] = corners("roof_hip", c1, c2);
  const stair = stairMaterial("roof_hip", block, options.seed);
  const hipP = new Painter(options.hip, options.seed);
  const capP = new Painter(options.cap ?? options.hip, options.seed);
  const geo = new Geometry();
  let k = 0;
  while (x1 + k <= x2 - k && z1 + k <= z2 - k) {
    const [a, b, c, d, y] = [x1 + k, x2 - k, z1 + k, z2 - k, y0 + k];
    if (a === b || c === d) {
      for (let x = a; x <= b; x++) for (let z = c; z <= d; z++) capP.put(x, y, z);
      break;
    }
    for (let x = a + 1; x < b; x++) {
      geo.set(x, y, c, withProps(stair(x, y, c), { facing: "south", half: "bottom" }));
      geo.set(x, y, d, withProps(stair(x, y, d), { facing: "north", half: "bottom" }));
    }
    for (let z = c + 1; z < d; z++) {
      geo.set(a, y, z, withProps(stair(a, y, z), { facing: "east", half: "bottom" }));
      geo.set(b, y, z, withProps(stair(b, y, z), { facing: "west", half: "bottom" }));
    }
    for (const [x, z] of [
      [a, c],
      [b, c],
      [a, d],
      [b, d],
    ] as const)
      hipP.put(x, y, z);
    k++;
  }
  return geo.concat(hipP.geo).concat(capP.geo);
}

// -- arches ------------------------------------------------------------------

/** Per-cell slab block resolver that refuses a caller-given `type`. */
function slabMaterial(what: string, block: Material, seed: Seed): MaterialFn {
  const at: MaterialFn = (x, y, z) => {
    const b = resolveMaterial(block, x, y, z, seed);
    if (parseBlockString(b).props.has("type")) {
      throw new McbuilderError(
        `${what} computes slab 'type' from the geometry; pass the slab block without a type property`,
      );
    }
    return b;
  };
  at(0, 0, 0); // fail fast on a plain string with type
  return at;
}

const ARCH_PROFILES = ["stepped", "segmental", "pointed"] as const;

export interface ArchOptions extends SeedOption {
  /** The axis the span runs along. */
  axis: "x" | "z";
  profile: (typeof ARCH_PROFILES)[number];
  /** Rows the head occupies, from `start.y` up. Default and limits depend on `profile`. */
  rise?: number;
  /** Slab block (no `type`): the `segmental` crown, and the `pointed` apex cap. Required for `pointed`. */
  slab?: Material;
  /** Solid blocks for the masonry cells of the head outside the curve (the spandrel). */
  fill?: Material | null;
  /** Thickness through the wall, toward +X or +Z (the axis that is not `axis`). Default 1. */
  depth?: number;
}

/**
 * Arch head built from upside-down stairs (and, for `segmental`, slabs). It
 * is the head only: it never places anything in the opening below the curve
 * (the intrados), so carve the opening yourself and keep the jambs under it.
 *
 * Arguments. `start` is the cell at the left end of the span on the springing
 * row, the lowest row of the head: the head sits directly on top of the
 * opening, so `start.y` is the first row above the opening. The span covers
 * `width` cells from `start` along `axis`, increasing (`axis: "x"` runs east,
 * `axis: "z"` runs south); the head only occupies those columns, in rows
 * `start.y` .. `start.y + rise - 1`. Jambs, if any, are the caller's, one cell
 * outside each end. `block` is the stair material, without `facing`: the
 * shape computes it and refuses a block that carries one.
 *
 * Stair rule (all three profiles): every stair is upside-down (`half=top`)
 * and its hanging half sits on the jamb side, so the slanted underside opens
 * toward the span centre. A stair in the left half gets `facing=west` (axis
 * `x`) or `facing=north` (axis `z`), a stair in the right half the opposite.
 * Seen from the front it reads as a gamma: the top half spans the whole cell,
 * the lower half only the jamb-side half. One stair per row per side, stepping
 * one cell inward and one cell up (45 degrees), which gives clear widths that
 * shrink by one block per half-row: the "3 step chamfer" row, row+0.5,
 * row+1.0 of trixyblox/f_001.
 *
 * Profiles. Let `w = width` and `rows = rise`. Row `i` (0 = springing) has
 * its stairs in columns `i` and `w-1-i`; columns outside them are the
 * spandrel (`fill`, left empty when `fill` is null); columns between them
 * are the opening and stay empty.
 *
 * - `stepped`: a staircase of `rise` stairs per corner, then a flat soffit:
 *   the row above the head (your lintel) closes the span. `rise` defaults to
 *   `min(2, floor(w / 2))` and is limited to `floor(w / 2)`; any `w >= 2`.
 *   Evidence: T15 (build-patterns.md, "Stair-block masonry arches": 3-wide is
 *   one stair at each spring point, 2-wide is two stairs meeting at the
 *   centre, which is `rise: 1`), french-mansion/f_044 and f_068 (two steps per
 *   corner, rise 2), disruptive-builds/f_105 (3-wide niche: one stair per
 *   upper corner, rise 1), disruptive-builds/f_533 (stepped timber arch),
 *   dio-rods q04 (three-step chamfer; use `rise: 3`). The default 2 is a
 *   choice made from f_044 and f_068 for any `w >= 4`, not an observation of
 *   spans: the frames do not resolve any span in blocks.
 * - `pointed`: the same staircase continued until the two sides meet, so
 *   `rise = floor(w / 2)` is fixed by the width (passing another value throws;
 *   use `stepped` for a flat-topped one). Any `w >= 2`. Clear width per
 *   half-row above the shoulder: w-1, w-2, ... 1, a 1-wide apex half a block
 *   tall, so w=4 is the "4, 3, 2, 1" lancet of trixyblox/f_019 (outline of
 *   the window glass, from a 4x crop, grid lines at block centres), where the
 *   4 is the opening below the head. Even widths close by themselves: the
 *   last two stairs meet in the middle. An odd width leaves one open apex cell
 *   (column `floor(w / 2)`, top row); `slab` fills it with a `type=top` slab,
 *   which closes the head with a flat soffit half a block below the top of
 *   the head (w=3 is T15's 3-wide recipe: a stair at each spring point, then
 *   the span bridged across the top). `slab` is required for `pointed` (the
 *   spec asks for it) but an even width has no cell for it: it is accepted
 *   and unused there. Whether `slab` should do more on `pointed` is an open
 *   question; the frames show the 4,3,2,1 outline from stairs alone. A flat
 *   2-wide apex, as in arashy12/f_139-140, is the `segmental` profile with a
 *   larger `rise`; the steep legs of that rib (rise > w / 2) are not made.
 * - `segmental`: the staircase for `rise - 1` rows, then a crown row of
 *   bottom slabs across the remaining middle columns (`i` .. `w-1-i` in the
 *   top row `i = rise - 1`). `rise` defaults to 2: one row of haunch stairs
 *   and one crown row, as in trixyblox/f_001 (4-wide, "Gamma" stairs at the
 *   spring line, two bottom slabs above, soffit steps row, row+0.5,
 *   row+1.0). Needs `w >= 2 * rise - 1` (3 for the default); a narrower
 *   span throws, use `stepped` or `pointed`. Without `slab` the crown cells
 *   are left empty. Same head reused on windows in trixyblox/f_008-f_010,
 *   where it stands one block proud of the wall face: put the arch on the
 *   layer in front of the wall, as T15 says, not in the wall itself. The
 *   slab is `type=bottom`: the top half of each crown cell stays open.
 *
 * Options. `axis` and `profile` are required. `rise`: see above. `slab`: a
 * slab material without `type` (the shape sets `type=bottom` for the
 * segmental crown and `type=top` for the pointed apex cap); required for
 * `pointed`, optional for `segmental` (default none: the crown stays empty),
 * refused for `stepped`. `fill`: default null. `depth`: layers through
 * the wall toward +X (axis `z`) or +Z (axis `x`), default 1, identical
 * layers. `seed` salts weighted palettes.
 *
 * Facing and defaults: the jamb-side hanging half is read from the frames
 * (trixyblox/f_001: upper half of the cell full, lower half only on the jamb
 * side). T15 says the stairs face "inward / down-slope toward the center",
 * which in Minecraft's own `facing` terms would hang the half on the centre
 * side; the frames and this shape do the opposite. `rise` defaults are design
 * choices, as is `depth`.
 *
 * Elevation, `axis: "x"`, start at x=0 (`Sw`/`Se` = upside-down stair whose
 * hanging half is on the west/east side, `==` bottom slab, `##` fill, `..`
 * opening; rows listed top first, the opening below is carved by the caller):
 *
 *   pointed, width 4 (rise 2)       segmental, width 4 (rise 2, f_001)
 *     x=0  1  2  3                    x=0  1  2  3
 *     ## Sw Se ##   y+1               ## == == ##   y+1
 *     Sw .. .. Se   y                 Sw .. .. Se   y
 *
 *   stepped, width 6 (rise 2)       stepped, width 3 (rise 1, T15)
 *     x=0  1  2  3  4  5              x=0  1  2
 *     ## Sw .. .. Se ##   y+1         Sw .. Se   y
 *     Sw .. .. .. .. Se   y
 *
 *   pointed, width 5 (rise 2)       pointed, width 3 (rise 1, T15)
 *     x=0  1  2  3  4                 x=0  1  2
 *     ## Sw St Se ##   y+1            Sw St Se   y
 *     Sw .. .. .. Se   y
 *
 * (`St` is the `slab` with `type=top`; `Sw`/`Se` are placed over the first and
 * last column of their row, as in the grids above.)
 */
export function arch(start: Point, width: number, block: Material, options: ArchOptions): Geometry {
  const [sx, sy, sz] = point("arch: start", start);
  const w = positive("arch: width", width, 2);
  const { axis, profile, seed } = options;
  if (axis !== "x" && axis !== "z") {
    throw new McbuilderError(`arch: axis must be 'x' or 'z', got ${String(axis)}`);
  }
  if (!ARCH_PROFILES.includes(profile)) {
    throw new McbuilderError(
      `arch: profile must be one of [${ARCH_PROFILES.join(", ")}], got ${String(profile)}`,
    );
  }
  const depth = positive("arch: depth", options.depth ?? 1);
  const half = Math.floor(w / 2);

  let rise: number;
  if (profile === "segmental") {
    rise = positive("arch: rise", options.rise ?? 2, 2);
    if (w < 2 * rise - 1) {
      throw new McbuilderError(
        `arch: segmental with rise ${rise} needs width >= ${2 * rise - 1}, got ${w}; use 'stepped' or 'pointed' for a narrower span`,
      );
    }
  } else if (profile === "pointed") {
    rise = half;
    if (options.rise !== undefined && options.rise !== rise) {
      throw new McbuilderError(
        `arch: pointed closes at rise ${rise} for width ${w} (floor(width / 2)); got rise ${show(options.rise)}, use 'stepped' for a flat-topped staircase`,
      );
    }
  } else {
    rise = positive("arch: rise", options.rise ?? Math.min(2, half));
    if (rise > half) {
      throw new McbuilderError(
        `arch: stepped with width ${w} allows rise <= ${half}, got ${rise}; the two sides would cross`,
      );
    }
  }
  if (profile === "stepped" && options.slab !== undefined) {
    throw new McbuilderError("arch: slab is not used by the 'stepped' profile");
  }
  if (profile === "pointed" && options.slab === undefined) {
    throw new McbuilderError("arch: the 'pointed' profile requires a slab block");
  }

  const stair = stairMaterial("arch", block, seed);
  const slab = options.slab ? slabMaterial("arch", options.slab, seed) : null;
  const spandrel = options.fill ? new Painter(options.fill, seed) : null;
  const geo = new Geometry();
  // odd pointed widths leave one open cell at the apex; a top slab closes it
  const apexCap = profile === "pointed" && w % 2 === 1 ? slab : null;
  const [leftFacing, rightFacing] = axis === "x" ? ["west", "east"] : ["north", "south"];

  const cell = (col: number, row: number, layer: number): Point =>
    axis === "x" ? [sx + col, sy + row, sz + layer] : [sx + layer, sy + row, sz + col];

  for (let layer = 0; layer < depth; layer++) {
    for (let row = 0; row < rise; row++) {
      const crown = profile === "segmental" && row === rise - 1;
      for (let col = 0; col < w; col++) {
        const [x, y, z] = cell(col, row, layer);
        if (col < row || col > w - 1 - row) {
          spandrel?.put(x, y, z);
        } else if (crown) {
          if (slab) geo.set(x, y, z, withProps(slab(x, y, z), { type: "bottom" }));
        } else if (apexCap && row === rise - 1 && col === half) {
          geo.set(x, y, z, withProps(apexCap(x, y, z), { type: "top" }));
        } else if (col === row || col === w - 1 - row) {
          const facing = col === row ? leftFacing : rightFacing;
          geo.set(x, y, z, withProps(stair(x, y, z), { facing: facing as string, half: "top" }));
        }
      }
    }
  }
  return spandrel ? spandrel.geo.concat(geo) : geo;
}
