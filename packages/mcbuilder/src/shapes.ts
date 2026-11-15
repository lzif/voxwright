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

/**
 * `ridgeCap` of `roofGable`: a fence-like cresting along the ridge, posts
 * standing on the ridge row with a thinner rail between them near their top.
 */
export interface RidgeCapOptions {
  /** The posts, vertical (put the axis in yourself, e.g. `stripped_oak_log[axis=y]`). */
  post: Material;
  /**
   * The rail between the posts, in the top row of the posts. `null` or omitted
   * leaves the posts alone; there is no default rail material.
   */
  rail?: Material | null;
  /** A post every `every` cells from the first ridge cell, and one on the last. Default 3. */
  every?: number;
  /** Rows the posts rise above the ridge row they are rooted in. Default 1. */
  height?: number;
}

/**
 * How much one roof column rises, from the eave in: `slab` half a block (a
 * slab), `stair` one block (a stair), `steep` two blocks (a full block under a
 * stair).
 */
export type RoofPitch = "slab" | "stair" | "steep";

/** A named roof profile of `roofGable`, or one pitch per column from the eave in. */
export type RoofProfile =
  | "straight"
  | "steep"
  | "concave"
  | "gambrel"
  | "low"
  | readonly RoofPitch[];

export interface RoofGableOptions extends SeedOption {
  ridge: "x" | "z";
  verge?: Material | null;
  eave?: Material | null;
  endFill?: Material | null;
  ridgeCap?: RidgeCapOptions | null;
  /** Roof profile across the span. Default `"straight"` (one stair per column). */
  profile?: RoofProfile;
  /** Slab for `slab` columns. Default: the stair block's slab (`oak_stairs` → `oak_slab`). */
  slab?: Material;
  /** Full block under the stair of `steep` columns. Default: the stair block's full block. */
  full?: Material;
}

const halfDefault = (block: string): Record<string, string> =>
  parseBlockString(block).props.has("half") ? {} : { half: "bottom" };

const WOOD_STAIRS = new Set([
  "oak",
  "spruce",
  "birch",
  "jungle",
  "acacia",
  "dark_oak",
  "mangrove",
  "cherry",
  "bamboo",
  "crimson",
  "warped",
  "pale_oak",
]);

/**
 * The slab or full block that goes with a stair block, by vanilla naming:
 * `x_stairs` → `x_slab`; full block `x_planks` for woods, `x_bricks` /
 * `x_tiles` for brick and tile stairs, `quartz_block` / `purpur_block`, else
 * `x`. Stair properties are dropped. An unusual name the rule gets wrong is
 * caught by registry validation; pass `slab` / `full` explicitly then.
 */
function stairSibling(what: string, block: string, kind: "slab" | "full"): string {
  const { name } = parseBlockString(block);
  const m = /^(?:([a-z0-9_.-]+):)?([a-z0-9_]+)_stairs$/.exec(name);
  if (!m) {
    throw new McbuilderError(
      `${what}: cannot derive a ${kind} block from ${block}; pass '${kind}' explicitly`,
    );
  }
  const ns = m[1] ?? "minecraft";
  const base = m[2] as string;
  let out = `${base}_slab`;
  if (kind === "full") {
    if (WOOD_STAIRS.has(base)) out = `${base}_planks`;
    else if (/(brick|tile)$/.test(base)) out = `${base}s`;
    else if (base === "quartz" || base === "purpur") out = `${base}_block`;
    else out = base;
  }
  return canonicalize(`${ns}:${out}`);
}

/** One pitch per column for a named profile over `half` columns (eave first). */
function roofPitches(profile: RoofProfile, half: number): RoofPitch[] {
  if (Array.isArray(profile)) {
    if (profile.length !== half) {
      throw new McbuilderError(
        `roof_gable: profile lists ${profile.length} pitches but the span needs ${half} (one per column from the eave to the ridge)`,
      );
    }
    for (const p of profile) {
      if (p !== "slab" && p !== "stair" && p !== "steep") {
        throw new McbuilderError(
          `roof_gable: invalid pitch ${show(p)}; expected one of [slab, stair, steep]`,
        );
      }
    }
    return [...profile];
  }
  const fill = (p: RoofPitch, n: number): RoofPitch[] => Array.from({ length: n }, () => p);
  switch (profile) {
    case "straight":
      return fill("stair", half);
    case "steep":
      return fill("steep", half);
    case "low":
      return fill("slab", half);
    case "gambrel": {
      const lower = Math.ceil(half / 2);
      return [...fill("steep", lower), ...fill("stair", half - lower)];
    }
    case "concave": {
      // Flat at the eave, steeper toward the ridge: an even run of slabs (so the
      // stairs above start on a whole block), then stairs, then steep columns.
      const slabs = half >= 3 ? 2 * Math.floor(half / 3) : 0;
      const rest = half - slabs;
      const stairs = Math.ceil(rest / 2);
      return [...fill("slab", slabs), ...fill("stair", stairs), ...fill("steep", rest - stairs)];
    }
    default:
      throw new McbuilderError(
        `roof_gable: invalid profile ${show(profile)}; expected straight, steep, concave, gambrel, low or an array of pitches`,
      );
  }
}

/**
 * Gable roof of stairs over the XZ footprint of `c1`..`c2`. The lowest (eave)
 * row sits at `min(c1.y, c2.y)`. `ridge` is the axis the ridge line runs
 * along. The roof rises `ceil(span / 2)` rows; an odd span gets a single
 * ridge row. Optional trim, both stair materials without `facing`: `verge`
 * (the two gable-end columns) and `eave` (the lowest row on both slopes).
 *
 * Two more options, both opt-in: with neither given the output is exactly
 * what it was without them.
 *
 * `endFill` (a full-block material) closes the triangle the stairs leave open
 * at each gable end. At row `r` (0 = eave row, y = base + r) the stairs sit at
 * `across = lo + r` and `hi - r`, where `across` is the coordinate
 * perpendicular to the ridge and `lo`..`hi` is the span. The fill takes the
 * cells strictly between them, in both end columns (the same columns `verge`
 * uses), so it lies in the plane of the outermost roof column and never
 * overwrites a roof cell. End view (`S` stair, `F` fill), base row 0 at the
 * bottom. Span 6 (even: the top row has no cells between its stairs):
 *
 *           S S              row 2
 *         S F F S            row 1
 *       S F F F F S          row 0
 *
 * Span 7 (odd: the apex stair stands on one cell of fill):
 *
 *             S              row 3
 *           S F S            row 2
 *         S F F F S          row 1
 *       S F F F F F S        row 0
 *
 * The wall under the fill (the box the roof sits on) is not part of this
 * shape: the fill starts at the base row, so the wall top is the row below.
 * A roof that overhangs its wall puts the fill in the overhang plane, one
 * column out from the wall; size `c1`..`c2` to the wall for a flush gable.
 * There is no window or oculus option (the hib/f_018 1x1 opening is left to
 * the caller).
 *
 * `ridgeCap` adds a ridge cresting that reads like a fence on the ridge: `post`
 * blocks stand on the ridge, and a thinner `rail` runs between them near their
 * top, leaving a gap of air below the rail where the roof shows through. The
 * shape does not touch block properties: put the axis in yourself, e.g.
 * `post: "minecraft:stripped_oak_log[axis=y]"` and `rail:
 * "minecraft:oak_slab[type=top]"` (a thin rail), or an oak fence, or
 * `stripped_oak_log[axis=x]` for `ridge: "x"` (a full-block rail).
 *
 * Cells. Let `top` be the ridge column's top roof row (with the default
 * profile, row `ceil(span / 2) - 1`). The posts are rooted in that row,
 * replacing the roof cell under each post (so a post never stands on a half
 * block and floats), and rise `height` rows above it (default 1): rows
 * y + top .. y + top + height. Along the ridge, number the cells 0 .. n-1 (the run
 * `c1`..`c2`): posts on cell 0, `every`, 2 x `every` ... and always on n-1 (the
 * last gap can be shorter). The rail fills the cells BETWEEN posts in the top
 * row of the posts (y + top + height), never overshooting the end posts; below
 * it, between posts, is air. `rail: null` (or omitted) gives posts only. Side
 * view, ridge along x, n = 8, `every` 3, `height` 2 (`P` post, `=` rail, `S`
 * top stair row, `.` air, odd span; `height` 2 for the drawing):
 *
 *     P = = P = = P P     y + top + 2   (rail row = top of the posts)
 *     P . . P . . P P     y + top + 1   (gap, the roof shows through)
 *     P S S P S S P P     y + top       (posts rooted in the ridge row)
 *
 * With `height` 1 the posts and rail share the row above the ridge (a low fence). The cresting
 * stands over the ridge cells only, so it never touches the gable-end stairs
 * or `endFill`.
 *
 * Even span. There is no single apex cell: the ridge is the two cells of the top
 * stair row. The cresting stands on only one of them, the one at the lower
 * `across` coordinate (north for `ridge: "x"`, west for `ridge: "z"`), so it
 * stays one cell wide and reads as a fence. It sits half a cell off the centre
 * line. Putting posts and rail on both cells was tried in the preview and
 * rejected: it gave a 2-wide bench-like slab on 2x1 posts. This is a design
 * choice, not observed; mirror the roof's `c1`/`c2` if you want the other side.
 *
 * `profile` changes the pitch across the span (opt-in; `"straight"`, the
 * default, is the roof above, one stair per column). Each of the
 * `floor(span / 2)` columns from the eave to the ridge gets a pitch: `slab`
 * rises half a block (a bottom slab, then a top slab, alternating), `stair`
 * one block (a stair), `steep` two blocks (a full block with a stair on it).
 * Both slopes mirror each other; an odd span's apex column is a slab half a
 * block above its neighbours. Named profiles, for `n` columns:
 *
 * - `"steep"`: all steep (an A-frame);
 * - `"low"`: all slab (a lower pitch);
 * - `"gambrel"`: the lower `ceil(n / 2)` steep, the rest stair (a barn roof:
 *   steep below, flatter above);
 * - `"concave"`: an even run of `2 * floor(n / 3)` slabs at the eave, then
 *   stairs, then steep columns (half each, stairs first): flat at the eave and
 *   steeper toward the ridge, the flared roof of Japanese and "elven" builds.
 *
 * Or pass the pitches yourself, eave first, e.g. `["slab", "slab", "stair",
 * "steep"]`. A stair or steep column must start on a whole block, so the slab
 * columns before it must be even in number. End view, span 9, `"concave"`
 * (columns slab, slab, stair, steep; `b`/`t` bottom/top slab, `S` stair, `F`
 * full block, `^` the apex slab):
 *
 *               ^               row 4 (bottom slab)
 *             S   S             row 3
 *             F   F             row 2
 *           S       S           row 1
 *       b t           t b       row 0
 *
 * Slabs and full blocks follow the stair block by vanilla naming
 * (`oak_stairs` → `oak_slab` and `oak_planks`, `stone_brick_stairs` →
 * `stone_bricks`, `deepslate_tile_stairs` → `deepslate_tiles`), also for the
 * `verge` and `eave` trim; `slab` and `full` override them for the body.
 * `endFill` fills each end column up to its lowest roof cell and `ridgeCap`
 * stands on the ridge column's top cell, whatever the profile. Design
 * choices, from reference images (Pinterest "Roof Profiles for Minecraft
 * builders", a Japanese castle roof breakdown of stairs over slabs, seefro's
 * "four roof designs"), not from the reel frames: the preset ratios and the
 * slab apex.
 *
 * Evidence: endFill hib/f_018 (full planks under dark verge stairs, in the verge
 * plane, flush with the steps), tav/f_004, tav/f_005 (white infill under a slate
 * gable), NS/f_080, GV/f_023, AR/f_105; ridgeCap tav/f_020 (full-res, ridge
 * crop), tav/f_009, tav/f_013, tav/f_019: vertical stripped-log posts stand on
 * the ridge about every 3rd cell, rising about 2 above the roof; a thinner
 * horizontal rail runs between them near their top with a visible gap below it;
 * the posts end flush with or just above the rail. Design choices, not read
 * from the frames: `every` default 3 (the frames show about 3, +/-1),
 * `height` default 1 with a top-slab rail recommended (side by side with
 * tav/f_009, posts one row above the ridge and a top slab between them, leaving
 * half a block of gap, match the frame; `height` 2 read as a tall fence), the end
 * posts always present, the rail stopping at the
 * end posts (the earlier version overshot the gable ends and hung in the air),
 * the posts rooted in the ridge row (side by side with tav/f_009 the cresting
 * read as floating when the posts stood on top of a half-height ridge cell),
 * the even-span single column on the lower side, and the rail being a one-cell block (which
 * block, slab or fence or log, is yours to pick; the frames show it thinner than
 * the posts).
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
  const cap = options.ridgeCap ?? null;
  if (cap) {
    if (typeof cap !== "object" || Array.isArray(cap) || cap.post === undefined) {
      throw new McbuilderError("roof_gable: ridgeCap must be an object with a post material");
    }
  }
  const capEvery = cap ? positive("roof_gable: ridgeCap.every", cap.every ?? 3) : 0;
  const capHeight = cap ? positive("roof_gable: ridgeCap.height", cap.height ?? 1) : 0;
  const [lo, hi, runLo, runHi, faceLo, faceHi] =
    ridge === "x" ? [z1, z2, x1, x2, "south", "north"] : [x1, x2, z1, z2, "east", "west"];
  const span = (hi as number) - (lo as number) + 1;
  const half = Math.floor(span / 2);
  const geo = new Geometry();
  const xz = (across: number, run: number): [number, number] =>
    ridge === "x" ? [run, across] : [across, run];

  // Stair block for a cell: verge on the gable-end columns, eave on the eave column.
  const stairAt = (column: number, run: number, x: number, y: number, z: number): string => {
    if (verge && (run === runLo || run === runHi)) return verge(x, y, z);
    if (eave && column === 0) return eave(x, y, z);
    return body(x, y, z);
  };
  const isTrim = (column: number, run: number): boolean =>
    Boolean((verge && (run === runLo || run === runHi)) || (eave && column === 0));

  // Lowest and highest row each column (by `across`) occupies, for endFill and ridgeCap.
  const colLow = new Map<number, number>();
  const colHigh = new Map<number, number>();
  const mark = (across: number, row: number): void => {
    colLow.set(across, Math.min(colLow.get(across) ?? row, row));
    colHigh.set(across, Math.max(colHigh.get(across) ?? row, row));
  };

  const profile = options.profile ?? "straight";
  if (profile === "straight") {
    const put = (across: number, run: number, row: number, facing: string): void => {
      const [x, z] = xz(across, run);
      const y = y0 + row;
      let mat = body;
      if (verge && (run === runLo || run === runHi)) mat = verge;
      else if (eave && row === 0) mat = eave;
      const b = mat(x, y, z);
      geo.set(x, y, z, withProps(b, { facing, ...halfDefault(b) }));
    };

    for (let row = 0; row < half; row++) {
      for (let run = runLo as number; run <= (runHi as number); run++) {
        put((lo as number) + row, run, row, faceLo as string);
        put((hi as number) - row, run, row, faceHi as string);
      }
      mark((lo as number) + row, row);
      mark((hi as number) - row, row);
    }
    if (span % 2) {
      for (let run = runLo as number; run <= (runHi as number); run++)
        put((lo as number) + half, run, half, faceHi as string);
      mark((lo as number) + half, half);
    }
  } else {
    const pitches = roofPitches(profile, half);
    const slabP = options.slab === undefined ? null : new Painter(options.slab, seed);
    const fullP = options.full === undefined ? null : new Painter(options.full, seed);
    const sibling = (
      kind: "slab" | "full",
      column: number,
      run: number,
      x: number,
      y: number,
      z: number,
    ): string => {
      const own = kind === "slab" ? slabP : fullP;
      if (own && !isTrim(column, run)) return own.blockAt(x, y, z);
      return stairSibling("roof_gable", stairAt(column, run, x, y, z), kind);
    };

    // Each column's top surface, in half blocks above the base row.
    let t = 0;
    const columnCells: { row: number; kind: "slab-bottom" | "slab-top" | "stair" | "full" }[][] =
      [];
    for (const [k, p] of pitches.entries()) {
      if (p !== "slab" && t % 2) {
        throw new McbuilderError(
          `roof_gable: profile column ${k} (${p}) would start half a block up; put an even number of slab columns before a stair or steep column`,
        );
      }
      const cells: { row: number; kind: "slab-bottom" | "slab-top" | "stair" | "full" }[] = [];
      if (p === "slab") {
        t += 1;
        cells.push(
          t % 2 ? { row: (t - 1) / 2, kind: "slab-bottom" } : { row: t / 2 - 1, kind: "slab-top" },
        );
      } else if (p === "stair") {
        cells.push({ row: t / 2, kind: "stair" });
        t += 2;
      } else {
        cells.push({ row: t / 2, kind: "full" }, { row: t / 2 + 1, kind: "stair" });
        t += 4;
      }
      columnCells.push(cells);
    }

    const place = (
      column: number,
      across: number,
      run: number,
      cell: { row: number; kind: string },
      facing: string,
    ): void => {
      const [x, z] = xz(across, run);
      const y = y0 + cell.row;
      let b: string;
      if (cell.kind === "stair") {
        const s = stairAt(column, run, x, y, z);
        b = withProps(s, { facing, ...halfDefault(s) });
      } else if (cell.kind === "full") {
        b = sibling("full", column, run, x, y, z);
      } else {
        b = withProps(sibling("slab", column, run, x, y, z), {
          type: cell.kind === "slab-top" ? "top" : "bottom",
        });
      }
      geo.set(x, y, z, b);
      mark(across, cell.row);
    };

    for (const [k, cells] of columnCells.entries()) {
      for (let run = runLo as number; run <= (runHi as number); run++) {
        for (const cell of cells) {
          place(k, (lo as number) + k, run, cell, faceLo as string);
          place(k, (hi as number) - k, run, cell, faceHi as string);
        }
      }
    }
    if (span % 2) {
      // The apex column rises half a block above its neighbours, as a slab.
      const apex = t + 1;
      const cell =
        apex % 2
          ? { row: (apex - 1) / 2, kind: "slab-bottom" }
          : { row: apex / 2 - 1, kind: "slab-top" };
      for (let run = runLo as number; run <= (runHi as number); run++)
        place(half, (lo as number) + half, run, cell, faceHi as string);
    }
  }

  if (options.endFill) {
    const fill = new Painter(options.endFill, seed);
    for (let across = lo as number; across <= (hi as number); across++) {
      const low = colLow.get(across) ?? 0;
      for (let row = 0; row < low; row++) {
        for (const run of [runLo as number, runHi as number]) {
          const [x, z] = xz(across, run);
          geo.set(x, y0 + row, z, fill.blockAt(x, y0 + row, z));
        }
      }
    }
  }

  if (cap) {
    const post = new Painter(cap.post, seed);
    const rail = cap.rail ? new Painter(cap.rail, seed) : null;
    const column = (lo as number) + (span % 2 ? half : half - 1);
    const top = colHigh.get(column) ?? 0;
    const n = (runHi as number) - (runLo as number) + 1;
    const railRow = y0 + top + capHeight;
    for (let i = 0; i < n; i++) {
      const run = (runLo as number) + i;
      const isPost = i % capEvery === 0 || i === n - 1;
      const [x, z] = xz(column, run);
      if (isPost) {
        for (let y = y0 + top; y <= railRow; y++) geo.set(x, y, z, post.blockAt(x, y, z));
      } else if (rail) {
        geo.set(x, railRow, z, rail.blockAt(x, railRow, z));
      }
    }
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

// -- parapets ----------------------------------------------------------------

export interface ParapetOptions extends SeedOption {
  /** Width of each merlon along its side, in cells. Default 1. */
  merlon?: number;
  /** Width of each crenel (gap) along its side, in cells. Default 1. */
  crenel?: number;
  /** Merlon rows above the base course. Default 1. */
  height?: number;
  /** Continuous rows under the merlons, from `min y`. 0 is allowed. Default 1. */
  base?: number;
  /** Stair material (no `facing`): steps the parapet out 1 cell and carries it on upside-down stairs. */
  corbel?: Material;
}

/**
 * Crenellated parapet around the perimeter of the XZ footprint `c1`..`c2`
 * (corners inclusive, any order). It starts at `min(c1.y, c2.y)`; the other y
 * is ignored. A footprint 1 thick in X or Z (or 1x1) is a straight run (a
 * single cell) rather than a ring: the whole footprint is the "side".
 *
 * Layout. The ring (the footprint's outline, or with `corbel` the outline
 * grown by 1 cell on every side) is read side by side. On a side, count `d`
 * cells from the nearer end (the corner), starting at 0: the cell is a merlon
 * when `d % (merlon + crenel) < merlon`, else a crenel. So every side reads
 * the same from both ends, corners are always merlons, and a side whose length
 * does not fit the rhythm ends up with one wider merlon or crenel in the
 * middle (1:1 on an even side doubles the middle merlon). Rows `y` ..
 * `y + base - 1` are the base course: every ring cell. Rows above it, `height`
 * of them, hold only the merlons. Crenels are left empty above the base.
 *
 * Corbel. With `corbel` set the ring moves out 1 cell (a footprint of w x d
 * gives a ring of (w+2) x (d+2)), so the parapet overhangs the shaft whose
 * wall top outline is the footprint. A ring of stairs under the overhang
 * sits one row lower, at `y - 1`, on the same grown outline; it is the
 * caller's wall that ends at `y - 1` on the footprint outline, beside it.
 * Every corbel stair is upside-down (`half=top`) with its tall back toward the
 * footprint, so the hanging half is against the wall and the lip thins
 * outward; the corner cells face along X toward the centre. The footprint
 * outline at `y` and the inside are left empty for you (floor, walkway). The
 * `corbel` stair block must come without `facing`; a straight run cannot have
 * one (no inside to step out from), so it needs a footprint of at least 2 x 2.
 *
 * Elevation, one side of a 7-wide ring, `merlon: 1`, `crenel: 1`, `height: 1`,
 * `base: 1`, no corbel (`M` block, `.` empty; rows top first):
 *
 *   x=0 1 2 3 4 5 6
 *     M . M . M . M    y+1
 *     M M M M M M M    y
 *
 * Same with `corbel`, as a section through a 5-wide footprint (`x=0..4`) at a
 * z where both side cells are merlons. The ring is `x=-1..5`; `S` is a
 * stair (back toward the wall, `half=top`), `W` is your shaft wall, `.` is
 * empty (nothing placed):
 *
 *   x=-1 0 1 2 3 4 5
 *     M  . . . . . M   y+1
 *     M  . . . . . M   y      (your walkway at x=0..4 sits on W below)
 *     S  W . . . W S   y-1
 *
 * Defaults. `merlon` 1, `crenel` 1, `height` 1, `base` 1 are design choices:
 * the frames show 1:1 (disruptive-builds f_226, f_307, f_317, heavy-tower
 * f_007 upper ring) and about 2:1 (french-mansion f_048, heavy-tower f_005) and
 * do not resolve the unit, so none of them is an observed constant. Corner
 * merlons raised 2 courses (heavy-tower f_005, disruptive-builds f_550) are not
 * a parameter: stack a second parapet or a `pillar`. The corbel block half and
 * facing are not resolved in the frames (f_226, f_550 show a stair-like
 * stepped underside); "back toward the wall" is a choice, as is the stair
 * row at `y - 1`. Corbel flare of exactly 1 follows disruptive-builds f_550
 * (3-wide shaft, 5-wide crown) and f_317.
 */
export function parapet(
  c1: Point,
  c2: Point,
  block: Material,
  options: ParapetOptions = {},
): Geometry {
  const [[x1, y0, z1], [x2, , z2]] = corners("parapet", c1, c2);
  const merlon = positive("parapet: merlon", options.merlon ?? 1);
  const crenel = positive("parapet: crenel", options.crenel ?? 1);
  const height = positive("parapet: height", options.height ?? 1);
  const base = positive("parapet: base", options.base ?? 1, 0);
  const { seed } = options;
  const corbel =
    options.corbel === undefined ? null : stairMaterial("parapet", options.corbel, seed);
  if (corbel && (x1 === x2 || z1 === z2)) {
    throw new McbuilderError(
      "parapet: corbel needs a footprint at least 2 x 2; a straight run has no inside to step out from",
    );
  }
  const grow = corbel ? 1 : 0;
  const [rx1, rx2, rz1, rz2] = [x1 - grow, x2 + grow, z1 - grow, z2 + grow];
  const period = merlon + crenel;
  const isMerlon = (x: number, z: number): boolean => {
    const onZEdge = z === rz1 || z === rz2 || rz1 === rz2;
    const d = onZEdge ? Math.min(x - rx1, rx2 - x) : Math.min(z - rz1, rz2 - z);
    return d % period < merlon;
  };
  const p = new Painter(block, seed);
  const geo = new Geometry();
  for (let x = rx1; x <= rx2; x++) {
    for (let z = rz1; z <= rz2; z++) {
      const onRing = x === rx1 || x === rx2 || z === rz1 || z === rz2;
      if (!onRing) continue;
      for (let row = 0; row < base; row++) p.put(x, y0 + row, z);
      if (isMerlon(x, z)) for (let row = 0; row < height; row++) p.put(x, y0 + base + row, z);
      if (corbel) {
        const facing = x === rx1 ? "east" : x === rx2 ? "west" : z === rz1 ? "south" : "north";
        geo.set(x, y0 - 1, z, withProps(corbel(x, y0 - 1, z), { facing, half: "top" }));
      }
    }
  }
  return geo.concat(p.geo);
}

// -- skirt roofs -------------------------------------------------------------

export interface SkirtRoofOptions extends SeedOption {
  /** Cells the skirt projects beyond the footprint on every side. Default 2. */
  overhang?: number;
  /** Terrace courses stepping up toward the shaft, above the rim. 0 is a flat brim. Default 2. */
  courses?: number;
  /** Slab block (no `type`). When set each terrace course is half a block high instead of a full block. */
  slab?: Material;
  /** Material of the outer edge course (the rim). Default: `block`. */
  rim?: Material;
  /** Material of the dentil row under the rim; `null` leaves the row out. Default: `block`. */
  dentil?: Material | null;
  /** XZ corners (y ignored) of the upper stage's footprint, left open. Must lie inside the footprint. */
  hole?: [Point, Point];
}

/**
 * Flared skirt roof around a tower stage: a wide flat brim with a rim course
 * on its outer edge, an optional dentil row under the rim, and low terraces
 * stepping up toward the shaft that rises through it (technique 43).
 *
 * Arguments. `c1`..`c2` (any order, inclusive) is the XZ footprint of the
 * shaft the skirt sits on, that is its top outline; the skirt starts at
 * `min(c1.y, c2.y)`, the first row above that shaft. It covers the footprint
 * grown by `overhang` on every side (a 7 x 7 footprint with the default
 * overhang of 2 gives the 11 x 11 skirt of alixxa/f_015) less the optional
 * `hole`, the footprint of the upper stage. With no `hole` the footprint is
 * closed over, which is a flat-topped terraced roof.
 *
 * Layout. Count rings inward from the outer edge: ring 0 is the rim course,
 * ring 1 the next cell in, and so on up to the `hole`. Let `r` be the rim row:
 * `y` when `dentil` is null, else `y + 1`.
 * - Ring 0 holds the rim, one full block high at row `r`.
 * - With a dentil row, row `y` holds ring 0 as a dentil: counting `d` cells
 *   from the nearer end of its side, the cell is a block when `d` is even and
 *   a hole when odd, so corners are always blocks and the faces read "block,
 *   hole, block, hole" (alixxa/f_017: 5 holes on an 11-wide face). Rings
 *   beyond 0 fill row `y` as plain `block`, the underside of the brim.
 * - Ring `i >= 1` is terrace level `t = min(i, courses)`. Without `slab` it is
 *   full blocks from row `r` up to row `r + t`. With `slab` it is `t` half
 *   steps above the rim top: full blocks up to row `r + floor(t / 2)`, and a
 *   `type=bottom` slab on top, at row `r + floor(t / 2) + 1`, when `t` is odd.
 *   (Ring 0 is level 0.)
 * - Cells inside the `hole` are left empty.
 *
 * Elevation, a section through the middle of a side, footprint `x=0..6`
 * (7 wide), default options, `hole` x=1..5 (`R` rim, `D` dentil, `B` block,
 * `.` empty, the hole `[ ]` is the upper shaft, yours):
 *
 *   x=-2 -1  0 [1..5]  6  7  8
 *     .   .  B  [   ]  B  .  .   y+3
 *     .   B  B  [   ]  B  B  .   y+2
 *     R   B  B  [   ]  B  B  R   y+1
 *     D   B  B  [   ]  B  B  D   y
 *
 * Options and defaults. `overhang` 2 (alixxa/f_015, f_017: about 2 past the
 * lower shaft, about 3 past the upper). `courses` 2 (a design choice, the
 * frames read "about 2 terraces"). `slab`: none, so terraces are full blocks
 * (a choice; the frames do not resolve stair, slab or block). `rim`: `block`.
 * `dentil`: `block` (a choice; whether the real row is blocks, stairs or
 * trapdoors is unresolved, pass a trapdoor-free block material or `null`).
 * `hole`: none. There is no stair option: the stair `facing` and `half` are
 * unresolved in the frames, so none are claimed. The hip ribs, corner posts
 * and the trapdoor brackets and lanterns under the brim (f_016) are not
 * part of the shape: place them yourself. `seed` salts weighted palettes.
 *
 * Evidence: alixxa-tower f_015 (skirt from above, 11 wide, rim and terrace),
 * f_017 (finished tower, dentil row with 5 holes and the second skirt "hat"),
 * f_016 (underside).
 */
export function skirtRoof(
  c1: Point,
  c2: Point,
  block: Material,
  options: SkirtRoofOptions = {},
): Geometry {
  const [[x1, y0, z1], [x2, , z2]] = corners("skirt_roof", c1, c2);
  const overhang = positive("skirt_roof: overhang", options.overhang ?? 2);
  const courses = positive("skirt_roof: courses", options.courses ?? 2, 0);
  const { seed } = options;
  let hole: [number, number, number, number] | null = null;
  if (options.hole !== undefined) {
    if (!Array.isArray(options.hole) || options.hole.length !== 2) {
      throw new McbuilderError(
        `skirt_roof: hole must be two corner points, got ${show(options.hole)}`,
      );
    }
    const [[hx1, , hz1], [hx2, , hz2]] = corners("skirt_roof", options.hole[0], options.hole[1]);
    if (hx1 < x1 || hx2 > x2 || hz1 < z1 || hz2 > z2) {
      throw new McbuilderError(
        `skirt_roof: hole [${[hx1, hz1].join(", ")}]..[${[hx2, hz2].join(", ")}] (x, z) must lie inside the footprint [${[x1, z1].join(", ")}]..[${[x2, z2].join(", ")}]`,
      );
    }
    hole = [hx1, hx2, hz1, hz2];
  }
  const slab = options.slab ? slabMaterial("skirt_roof", options.slab, seed) : null;
  const body = new Painter(block, seed);
  const rim = options.rim ? new Painter(options.rim, seed) : body;
  const dentil = options.dentil === null ? null : new Painter(options.dentil ?? block, seed);
  const geo = new Geometry();
  const [ox1, ox2, oz1, oz2] = [x1 - overhang, x2 + overhang, z1 - overhang, z2 + overhang];
  const r = y0 + (dentil ? 1 : 0);
  for (let x = ox1; x <= ox2; x++) {
    for (let z = oz1; z <= oz2; z++) {
      if (hole && x >= hole[0] && x <= hole[1] && z >= hole[2] && z <= hole[3]) continue;
      const ring = Math.min(x - ox1, ox2 - x, z - oz1, oz2 - z);
      if (ring === 0) {
        if (dentil) {
          const onZEdge = z === oz1 || z === oz2;
          const d = onZEdge ? Math.min(x - ox1, ox2 - x) : Math.min(z - oz1, oz2 - z);
          if (d % 2 === 0) dentil.put(x, y0, z);
        }
        rim.put(x, r, z);
        continue;
      }
      if (dentil) body.put(x, y0, z);
      const level = Math.min(ring, courses);
      const full = slab ? Math.floor(level / 2) : level;
      for (let row = 0; row <= full; row++) body.put(x, r + row, z);
      if (slab && level % 2 === 1) {
        const y = r + full + 1;
        geo.set(x, y, z, withProps(slab(x, y, z), { type: "bottom" }));
      }
    }
  }
  let out = geo.concat(body.geo);
  if (rim !== body) out = out.concat(rim.geo);
  if (dentil) out = out.concat(dentil.geo);
  return out;
}

// -- bay walls ---------------------------------------------------------------

export interface BayWallOptions extends SeedOption {
  /**
   * Required. A number is the distance between post centres (posts stand at both ends and every
   * `period` cells; the run must fit it exactly). An array is the successive centre-to-centre
   * distances (its sum must equal the run length minus 1), for uneven rhythms.
   */
  period: number | readonly number[];
  /** Material of the vertical members. Default: `block`. */
  post?: Material;
  /** Material of the bays between posts; `null` leaves them open. Default: `block`. */
  infill?: Material | null;
  /** Material of a continuous top row over the whole run. Default: none. */
  beam?: Material;
  /** Material of a continuous bottom row over the whole run. Default: none. */
  sill?: Material;
  /** The frame (posts, beam, sill) stands 1 cell proud of the infill plane. Needs `face` and a 2-deep footprint. */
  inset?: boolean;
  /** The posts stand 1 cell proud of the wall face; beam, sill and bays stay flush. Needs `face` and a 2-deep footprint. */
  pilaster?: boolean;
  /** Direction the outer face looks. Required with `inset` or `pilaster`, perpendicular to the run. */
  face?: "north" | "south" | "east" | "west";
  /**
   * Width of each post along the run, in cells. Default 1. With a wider post,
   * `period` counts from one post's first cell to the next post's first cell,
   * and the last post ends on the last cell of the run.
   */
  postWidth?: number;
}

/**
 * Straight wall run of posts at a fixed rhythm with bays between them, an
 * optional top beam and bottom sill, and two opt-in depth treatments: the
 * timber-frame look (infill set behind the frame) and the pilaster look
 * (posts proud of the wall). One shape for timber frame, arcade, pier-and-slit
 * ground floor and pilaster-and-recess curtain wall (techniques 2 and 45).
 *
 * Arguments. `c1`..`c2` is the wall's footprint, corners inclusive and in any
 * order, `y` from the lower corner to the upper: its height is the number of
 * rows. Without `inset` or `pilaster` the footprint must be 1 thick in X or Z;
 * the other horizontal axis is the run, at least 2 cells long (a 1 x 1
 * footprint has no run and is refused). With `inset` or `pilaster` the
 * footprint is 2 thick, the run is the other axis, and `face` (north, south,
 * east or west, perpendicular to the run) says which of the two layers is the
 * outer one. `block` is the default material of `post` and `infill`.
 *
 * Layout. Number the run's cells 0 .. n-1 from the lower coordinate. Posts
 * stand on cells 0, `period`, 2 x `period` ... and always on n-1; a number
 * `period` that does not divide n-1 is refused (nothing is guessed about a
 * short last bay), and an array `period` lists the centre distances instead
 * (hibouk f_008's ground bay P S P SS P S P is `[2, 3, 2]`). Posts are 1 cell
 * wide, so a bay's clear width is its distance minus 1. A `beam` fills the top
 * row and a `sill` the bottom row across the whole run, over the posts; the
 * rows between them hold post and bay. They need at least 1 row between them,
 * so the height must exceed the rows used. A bay with `infill: null` is empty.
 *
 * Elevation, plain, n = 8 (run x = 0..7), `period: [2, 3, 2]`, height 5 with
 * `beam` (`=`) and `sill` (`_`), `P` post, `I` infill, `.` empty (`infill:
 * null`); rows top first:
 *
 *   x=0 1 2 3 4 5 6 7
 *     = = = = = = = =   y+4  beam
 *     P . P . . P . P   y+3
 *     P . P . . P . P   y+2
 *     P . P . . P . P   y+1
 *     _ _ _ _ _ _ _ _   y    sill
 *
 * Same with `infill` set and `period: 3` over n = 7 (x = 0..6), no beam or sill:
 *
 *   x=0 1 2 3 4 5 6
 *     P I I P I I P
 *
 * `inset: true`. A 2-deep footprint; the back layer (away from `face`) is
 * `infill` over the whole run and height, and the front layer holds only the
 * frame: posts, plus beam and sill if given. Section through a bay (`F` frame
 * in the front layer, `I` infill, `.` empty), `face: "south"`, height 4 with a
 * beam, looking along the run:
 *
 *   back front
 *    z=0   z=1
 *     I     F    y+3  beam
 *     I     .    y+2
 *     I     .    y+1
 *     I     .    y    (sill, if given, would be F)
 *
 * A post column is F at every row of the front layer. Needs an `infill`.
 *
 * `pilaster: true`. A 2-deep footprint; the back layer is the plain wall
 * (posts, bays, beam, sill as above) and the front layer adds a second post
 * cell in front of every post, over the rows the post occupies (not the beam or
 * sill rows). Section through a post column, `face: "south"`, height 4 with a
 * beam:
 *
 *   back front
 *    z=0   z=1
 *     B     .    y+3  beam, flush with the wall
 *     P     P    y+2
 *     P     P    y+1
 *     P     P    y
 *
 * `inset` and `pilaster` together are refused (one depth rule at a time).
 *
 * Options and defaults. `period` has no default; the counts must be given.
 * `post` and `infill` default to `block`; `beam`, `sill`, `inset`,
 * `pilaster` are off. `axis` of log-like blocks is not set for you: shapes do
 * not know which blocks carry an `axis`, so pass `oak_log[axis=y]` as `post`
 * and a beam with the axis of the run (`axis=x` or `axis=z`) yourself.
 * `seed` salts weighted palettes.
 *
 * Design choices (frames do not settle them): the post is 1 cell wide
 * by default (noes-starter-house f_047, hibouk f_008 show 1-wide posts);
 * `postWidth` widens every post for the 2-wide arcade piers of
 * disruptive-builds f_044; where a post meets a
 * beam or sill row, the beam or sill wins; the back layer in `inset` mode
 * runs behind posts and beam too (a continuous wall plane); a pilaster is
 * exactly 1 proud, and its beam and sill stay flush (french-mansion f_007,
 * disruptive-builds f_313 do not resolve how a cornice meets a pilaster). Not
 * covered: a lintel or frieze above the bays (disruptive-builds f_040, f_044),
 * diagonal braces, and pillar modules with plinth and ornament stacks.
 *
 * Evidence: noes-starter-house f_036 and f_047 (corner and middle posts, top
 * beam, infill added behind), arashy12-medieval-house f_045 (log posts, beams,
 * white infill), gorillo-spruce-house f_026, hibouk-winter-mansion f_008 /
 * f_011 / f_018 (pier-and-slit bay, upper floor posts), omggamer-medieval-tavern
 * f_004 (half-timber upper floor), disruptive-builds f_044, f_067 (arcade),
 * f_313 (pilasters over recessed slits), french-mansion f_007, f_068 (pilaster
 * rhythm).
 */
export function bayWall(c1: Point, c2: Point, block: Material, options: BayWallOptions): Geometry {
  const [[x1, y1, z1], [x2, y2, z2]] = corners("bay_wall", c1, c2);
  const { seed, inset = false, pilaster = false } = options;
  if (options.period === undefined) {
    throw new McbuilderError("bay_wall: period is required (a number or an array of distances)");
  }
  if (inset && pilaster) {
    throw new McbuilderError("bay_wall: inset and pilaster cannot be combined; pick one");
  }
  if (inset && options.infill === null) {
    throw new McbuilderError("bay_wall: inset needs an infill to sit behind the frame");
  }
  const sx = x2 - x1 + 1;
  const sz = z2 - z1 + 1;
  const height = y2 - y1 + 1;
  const deep = inset || pilaster;

  // Run axis and depth layers.
  let runAxis: "x" | "z";
  let frontIsHigh = false;
  if (deep) {
    if (options.face === undefined) {
      throw new McbuilderError(
        `bay_wall: ${inset ? "inset" : "pilaster"} needs face (north, south, east or west)`,
      );
    }
    const face = direction("bay_wall: face", options.face);
    const [dx] = DIRECTIONS[face] as readonly [number, number];
    runAxis = dx === 0 ? "x" : "z";
    frontIsHigh = face === "south" || face === "east";
    const depth = runAxis === "x" ? sz : sx;
    if (depth !== 2) {
      throw new McbuilderError(
        `bay_wall: with ${inset ? "inset" : "pilaster"} the footprint must be 2 thick across the run (face ${face}), got ${depth}`,
      );
    }
  } else {
    if (options.face !== undefined) direction("bay_wall: face", options.face);
    if (sx !== 1 && sz !== 1) {
      throw new McbuilderError(
        `bay_wall: footprint must be 1 thick in x or z (2 with inset or pilaster), got ${sx} x ${sz}`,
      );
    }
    if (sx === 1 && sz === 1) {
      throw new McbuilderError(
        "bay_wall: a 1 x 1 footprint has no run; it must be at least 2 long",
      );
    }
    runAxis = sx === 1 ? "z" : "x";
  }
  const run0 = runAxis === "x" ? x1 : z1;
  const n = runAxis === "x" ? sx : sz;
  if (n < 2) throw new McbuilderError(`bay_wall: the run must be at least 2 cells long, got ${n}`);

  // Post positions (each post's first cell) from `period`.
  const w = positive("bay_wall: postWidth", options.postWidth ?? 1);
  if (w >= n) {
    throw new McbuilderError(
      `bay_wall: postWidth ${w} leaves no room for two posts in a run of ${n} cells`,
    );
  }
  const posts = new Set<number>([0]);
  if (typeof options.period === "number") {
    const period = positive("bay_wall: period", options.period);
    if (period < w) {
      throw new McbuilderError(
        `bay_wall: period ${period} is shorter than postWidth ${w}; posts would overlap`,
      );
    }
    if ((n - w) % period !== 0) {
      throw new McbuilderError(
        `bay_wall: period ${period} does not fit a run of ${n} cells (posts at both ends need (length - ${w}) divisible by period); use length ${n - ((n - w) % period)} or ${n - ((n - w) % period) + period}, or give period as an array`,
      );
    }
    for (let i = period; i <= n - w; i += period) posts.add(i);
  } else {
    if (!Array.isArray(options.period) || options.period.length === 0) {
      throw new McbuilderError(
        `bay_wall: period must be an int or a non-empty array of ints, got ${show(options.period)}`,
      );
    }
    let at = 0;
    for (const d of options.period) {
      at += positive("bay_wall: period entry", d, w);
      posts.add(at);
    }
    if (at !== n - w) {
      throw new McbuilderError(
        `bay_wall: period distances sum to ${at} but the run of ${n} cells needs ${n - w}`,
      );
    }
  }

  const rowsUsed = (options.beam === undefined ? 0 : 1) + (options.sill === undefined ? 0 : 1);
  if (height <= rowsUsed) {
    throw new McbuilderError(
      `bay_wall: height ${height} leaves no row for posts and bays between the ${rowsUsed} beam / sill row${rowsUsed === 1 ? "" : "s"}`,
    );
  }

  const postP = new Painter(options.post ?? block, seed);
  const infillP = options.infill === null ? null : new Painter(options.infill ?? block, seed);
  const beamP = options.beam === undefined ? null : new Painter(options.beam, seed);
  const sillP = options.sill === undefined ? null : new Painter(options.sill, seed);
  const geo = new Geometry();

  const cell = (i: number, y: number, layer: 0 | 1, p: Painter): void => {
    // layer 0 is the wall plane (or the back); layer 1 is the front of a 2-deep footprint.
    const run = run0 + i;
    if (runAxis === "x") {
      const zBack = frontIsHigh ? z1 : z2;
      const z = deep ? zBack + (layer === 1 ? (frontIsHigh ? 1 : -1) : 0) : z1;
      geo.set(run, y, z, p.blockAt(run, y, z));
    } else {
      const xBack = frontIsHigh ? x1 : x2;
      const x = deep ? xBack + (layer === 1 ? (frontIsHigh ? 1 : -1) : 0) : x1;
      geo.set(x, y, run, p.blockAt(x, y, run));
    }
  };

  const postCells = new Set<number>();
  for (const p of posts) for (let k = 0; k < w; k++) postCells.add(p + k);
  for (let i = 0; i < n; i++) {
    const isPost = postCells.has(i);
    for (let row = 0; row < height; row++) {
      const y = y1 + row;
      const rail = row === height - 1 && beamP ? beamP : row === 0 && sillP ? sillP : null;
      // The wall plane (layer 0), or the whole footprint when it is 1 thick.
      if (inset) {
        if (infillP) cell(i, y, 0, infillP);
        const frame = rail ?? (isPost ? postP : null);
        if (frame) cell(i, y, 1, frame);
      } else {
        const body = rail ?? (isPost ? postP : infillP);
        if (body) cell(i, y, 0, body);
        if (pilaster && isPost && !rail) cell(i, y, 1, postP);
      }
    }
  }
  return geo;
}

// -- polygon -----------------------------------------------------------------

export interface PolygonOptions extends SeedOption {
  /**
   * What to build. `"walls"` (default): the outline cells only, at every y.
   * `"solid"`: outline and interior, at every y. `"floor"`: outline and interior,
   * one layer; needs `y1 === y2`.
   */
  mode?: "walls" | "solid" | "floor";
}

const POLYGON_MODES = ["walls", "solid", "floor"] as const;

/**
 * Footprint from a rectilinear outline: a closed loop of `[x, z]` vertices with
 * only axis-aligned edges, built as walls, as a solid, or as a one-layer floor.
 * It covers the stepped plans that `walls` and `floor` (one rectangle each)
 * cannot: L, T, cruciform, notched and dumbbell outlines (technique 47).
 *
 * Arguments. `vertices` is the outline in order, `[x, z]` block cells (+X east,
 * +Z south). The last vertex connects back to the first; do not repeat the
 * first. Every consecutive pair, including last to first, must share `x` or
 * `z`. Each edge covers every cell from one end vertex to the other, both end
 * cells included, so the vertex cells themselves are part of the outline and a
 * "length 8" edge is 8 cells including both corners. `y1` and `y2` are the
 * inclusive vertical range, in either order; `block` is any material spec.
 *
 * Refused (all as `polygon: ...` errors): fewer than 4 vertices, a vertex that
 * is not 2 ints, a diagonal edge (this includes a loop whose last vertex does
 * not line up with the first, so the closing edge is diagonal), a zero-length
 * edge (a repeated vertex), and an outline that visits any cell twice. That
 * last test catches edges that cross, touch, overlap or double back on each
 * other; it is a cell-level check, so two edges that run side by side on
 * neighbouring cells are fine. Consecutive collinear vertices (a vertex in the
 * middle of a straight edge) are allowed.
 *
 * Modes, plan view (x east, z south) of the L outline
 * `[[0,0],[5,0],[5,2],[2,2],[2,4],[0,4]]`; `#` outline, `+` interior, blank is empty:
 *
 *   x=0 1 2 3 4 5
 *     # # # # # #   z=0
 *     # + + + + #   z=1
 *     # + # # # #   z=2
 *     # + #         z=3
 *     # # #         z=4
 *
 * - `"walls"` (default): the `#` cells at every y from `y1` to `y2`. A corner
 *   is one cell, never doubled. A plain rectangle gives exactly the cells of
 *   `walls` for the same box.
 * - `"solid"`: `#` and `+` cells at every y.
 * - `"floor"`: `#` and `+` cells at `y1` only.
 *
 * Interior test. A cell that is not on the outline is inside when a ray from
 * its centre toward +x crosses an odd number of vertical edges (even-odd rule,
 * half-open in z so vertices count once). The outline is the polygon through
 * the vertex cells' centres, so the outline cells are always included and the
 * notches of concave plans stay empty.
 *
 * Design choices (the frames do not settle them): `walls` is the default mode
 * because the first step in the frames is the outline ring; `floor` is a single
 * layer and requires `y1 === y2` rather than silently ignoring `y2`; `floor`
 * and `solid` include the outline cells (hibouk f_004-f_005 lays the plank
 * floor inside a ring; for that look, floor a smaller outline one cell in); no
 * vertex is added or moved. Not covered: edges that are not axis-aligned,
 * outlines with holes, wall thickness above 1, and a roof over the footprint.
 *
 * Evidence: hibouk-winter-mansion f_001-f_005 (dumbbell: outline in markers,
 * stone-brick ring, plank floor inside it; labels 8, 5, 8 down the back wall),
 * arashy12-medieval-house f_001-f_002 (notched plan 7, 4, 12, 5, 3),
 * french-mansion f_007 (cruciform 21, 30, 9), noes-starter-house f_030 (L plan,
 * 9x5 house with a 5x4 porch arm). Segment lengths there are estimates; pass the
 * vertices you want.
 */
export function polygon(
  vertices: readonly (readonly [number, number])[],
  y1: number,
  y2: number,
  block: Material,
  options: PolygonOptions = {},
): Geometry {
  const { seed, mode = "walls" } = options;
  if (!isInt(y1) || !isInt(y2)) {
    throw new McbuilderError(`polygon: y1 and y2 must be ints, got ${show(y1)}, ${show(y2)}`);
  }
  if (!POLYGON_MODES.includes(mode)) {
    throw new McbuilderError(
      `polygon: invalid mode ${show(mode)}; expected one of [${POLYGON_MODES.join(", ")}]`,
    );
  }
  if (!Array.isArray(vertices) || vertices.length < 4) {
    throw new McbuilderError(
      `polygon: vertices must be an array of at least 4 [x, z] points, got ${Array.isArray(vertices) ? vertices.length : show(vertices)}`,
    );
  }
  for (const [i, v] of vertices.entries()) {
    if (!Array.isArray(v) || v.length !== 2 || !v.every(isInt)) {
      throw new McbuilderError(`polygon: vertex ${i} must be [x, z] ints, got ${show(v)}`);
    }
  }
  const yLow = Math.min(y1, y2);
  const yHigh = Math.max(y1, y2);
  if (mode === "floor" && y1 !== y2) {
    throw new McbuilderError(
      `polygon: mode floor is one layer; y1 and y2 must be equal, got ${y1}, ${y2}`,
    );
  }

  // Edges, outline cells and the visit-once check.
  const outline = new Map<string, [number, number]>();
  const verticals: { x: number; zLow: number; zHigh: number }[] = [];
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const [ax, az] = vertices[i] as readonly [number, number];
    const [bx, bz] = vertices[(i + 1) % n] as readonly [number, number];
    const label = `edge ${i} (${ax},${az}) to (${bx},${bz})`;
    if (ax !== bx && az !== bz) {
      throw new McbuilderError(`polygon: ${label} is diagonal; edges must share x or z`);
    }
    if (ax === bx && az === bz) {
      throw new McbuilderError(`polygon: ${label} has zero length (repeated vertex)`);
    }
    const dx = Math.sign(bx - ax);
    const dz = Math.sign(bz - az);
    const steps = Math.abs(bx - ax) + Math.abs(bz - az);
    // The last cell of this edge is the first cell of the next edge: visit steps cells only.
    for (let s = 0; s < steps; s++) {
      const cx = ax + dx * s;
      const cz = az + dz * s;
      const key = `${cx},${cz}`;
      if (outline.has(key)) {
        throw new McbuilderError(
          `polygon: ${label} revisits cell (${cx},${cz}); the outline must not cross, touch or overlap itself`,
        );
      }
      outline.set(key, [cx, cz]);
    }
    if (ax === bx) verticals.push({ x: ax, zLow: Math.min(az, bz), zHigh: Math.max(az, bz) });
  }

  const cells: [number, number][] = [...outline.values()];
  if (mode !== "walls") {
    // Scanline: per row, sorted x of the vertical edges crossing it (half-open in z);
    // consecutive pairs bound the inside. Pair endpoints are outline cells.
    let zMin = Number.POSITIVE_INFINITY;
    let zMax = Number.NEGATIVE_INFINITY;
    for (const [, cz] of cells) {
      zMin = Math.min(zMin, cz);
      zMax = Math.max(zMax, cz);
    }
    for (let z = zMin; z <= zMax; z++) {
      const xs = verticals
        .filter((e) => e.zLow <= z && z < e.zHigh)
        .map((e) => e.x)
        .sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = xs[k] as number; x <= (xs[k + 1] as number); x++) {
          if (!outline.has(`${x},${z}`)) cells.push([x, z]);
        }
      }
    }
  }

  const p = new Painter(block, seed);
  const top = mode === "floor" ? yLow : yHigh;
  for (const [x, z] of cells) for (let y = yLow; y <= top; y++) p.put(x, y, z);
  return p.geo;
}

// -- jetties -----------------------------------------------------------------

const JETTY_SIDES = ["north", "south", "east", "west"] as const;

export interface JettyOptions extends SeedOption {
  /** How far the deck projects past the wall line on each chosen side, in cells. Default 1. */
  overhang?: number;
  /** Sides that project, a non-empty subset of north, south, east, west. Default: all four. */
  sides?: readonly ("north" | "south" | "east" | "west")[];
  /** Stair material (no `facing`) for the upside-down brackets under the deck. Omitted or `null`: no brackets. */
  bracket?: Material | null;
  /** A bracket every `every` cells along a side, counted from both ends. Default 3. */
  every?: number;
  /** Material of an optional continuous row under the deck along the outer edge. Default: none. */
  beam?: Material;
}

/**
 * Jetty: the overhanging deck of an upper storey, projecting past the wall of
 * the storey below, on a row of upside-down stair brackets (technique 17,
 * "jetty").
 *
 * Arguments. `c1`..`c2` (corners inclusive, any order) is the XZ footprint of
 * the lower storey's top, that is the wall line the jetty projects from. The
 * deck row is `min(c1.y, c2.y)`; the other y is ignored. `block` is the deck.
 * The lower wall's top row is at `y - 1` on the footprint outline, which is
 * your wall (this shape places nothing on the footprint).
 *
 * Layout. Take the footprint's XZ rectangle and grow it on the chosen `sides`
 * by `overhang`. The deck row `y` holds `block` on every cell of that grown
 * shape that is outside the footprint: only the projecting ring. The
 * footprint cells at `y` (the floor of the upper storey) are yours, as are
 * its walls: stand them at `y + 1` on the outer outline of the deck, flush
 * with the projection. A corner where two projecting sides meet is filled as a square
 * of `overhang` x `overhang`. A corner of two sides of which one is not
 * chosen has no ring cell. Choosing `["north"]` gives a deck strip along the
 * north wall only, as wide as the footprint.
 *
 * Brackets. With `bracket` set, the row `y - 1` holds a stair on the ring cells
 * adjacent to the wall (distance 1 from the footprint, not the whole
 * overhang), on each chosen side. Number a side's cells 0 .. n-1 along the
 * wall; a stair stands on cell `i` when `min(i, n - 1 - i) % every === 0`. So
 * the rhythm reads the same from both ends, the two cells at the ends of each
 * side (the wall's corner columns) always carry a bracket, and a side that
 * does not fit the rhythm ends up with a wider gap in the middle. The diagonal
 * corner cell of the deck has no bracket of its own: the end brackets of the
 * two sides next to it hold it. Every stair is upside-down (`half=top`) and
 * faces the wall: its tall back is against the wall and the hanging half
 * stands under the deck, thinning outward.
 *
 * Beam. With `beam` set, the row `y - 1` also holds one continuous row of
 * `beam` along the outer edge of the projecting ring (the cells whose distance
 * from the footprint equals `overhang` on a chosen side), wrapping the
 * corners. It wins over a bracket on the same cell: with `overhang` 1 the outer
 * edge IS the bracket row, so the beam replaces the brackets; use `overhang`
 * 2 or more to have beam and brackets together. The shape does not know which
 * blocks carry an `axis`, so it does not set one: a log beam keeps the
 * block's default axis (vertical); use a plank or other axis-free block for
 * a clean fascia, or accept the vertical grain.
 *
 * Elevation, section through the middle of a north side (`x` fixed, looking
 * west), footprint `z=0..4`, defaults plus `bracket` (`D` deck, `S` bracket
 * stair, `W` your lower wall, `F` your upper floor, `.` empty):
 *
 *   z=-1  0  1  2  3  4  5
 *     D   F  F  F  F  F  D    y      deck row
 *     S   W  .  .  .  W  S    y - 1  (a section through a bracket column)
 *
 * Plan of the row `y - 1`, footprint `x=0..6`, `z=0..4`, `every` 3, `bracket` set
 * (`S` stair, `W` your wall top, `.` empty); the deck row above covers every
 * `.` of the ring and every `S`:
 *
 *   x=-1  0  1  2  3  4  5  6  7
 *     .   S  .  .  S  .  .  S  .    z=-1
 *     S   W  W  W  W  W  W  W  S    z=0
 *     .   W  .  .  .  .  .  W  .    z=1
 *     .   W  .  .  .  .  .  W  .    z=2
 *     .   W  .  .  .  .  .  W  .    z=3
 *     S   W  W  W  W  W  W  W  S    z=4
 *     .   S  .  .  S  .  .  S  .    z=5
 *
 * Stair facing. The stair on the north side faces south, on the south side
 * north, on the west side east and on the east side west (toward the wall).
 *
 * Options and defaults. `overhang` 1 (AR/f_034, f_049 show the deck 1 out; the
 * tavern's upper floor reads 1 out as well, tav/f_004). `sides`: all four (a
 * design choice: AR/f_034 shows a front and side, the tavern's jetty is on the
 * free front only; pass the sides you want). `bracket`: none unless given (a
 * design choice: the shape cannot guess a stair material). `every` 3 (AR,
 * "about every 3 blocks", f_049; the spacing is eyeballed). `beam`: none (a
 * choice; AR/f_049 reads the edge as 2 stacked rows of stair and slab or
 * plank, GS/f_023 as a log ring beam, tav/f_004 as a timber sill row; which
 * of these, and at which row, the frames do not settle). Not part of the
 * shape: the log-end stubs at the corners and mid-side of GS/f_023, the stack
 * of 2 or 3 stepped log brackets of tav/f_013 and hib/f_042, and the corner
 * post carried through the deck (place those yourself). `seed` salts weighted
 * palettes.
 *
 * Evidence: arashy12-medieval-house f_034 (deck over the stone wall, brackets
 * in a rhythm), f_049 (full-res crop: 2 edge layers, stairs under, about every
 * 3, corner post carried through); gorillo-spruce-house f_023 (log ring beam
 * with stubs); omggamer-medieval-tavern f_004 (upper floor over stone).
 */
export function jetty(c1: Point, c2: Point, block: Material, options: JettyOptions = {}): Geometry {
  const [[x1, y0, z1], [x2, , z2]] = corners("jetty", c1, c2);
  const overhang = positive("jetty: overhang", options.overhang ?? 1);
  const every = positive("jetty: every", options.every ?? 3);
  const { seed } = options;
  const sideArg = options.sides ?? JETTY_SIDES;
  if (!Array.isArray(sideArg) || sideArg.length === 0) {
    throw new McbuilderError(
      `jetty: sides must be a non-empty array of [${JETTY_SIDES.join(", ")}], got ${show(sideArg)}`,
    );
  }
  const sides = new Set(sideArg.map((s) => direction("jetty: sides", s)));
  const bracket =
    options.bracket === undefined || options.bracket === null
      ? null
      : stairMaterial("jetty", options.bracket, seed);
  const deck = new Painter(block, seed);
  const beam = options.beam === undefined ? null : new Painter(options.beam, seed);
  const geo = new Geometry();

  const beamCell = new Set<string>();
  for (let x = x1 - overhang; x <= x2 + overhang; x++) {
    for (let z = z1 - overhang; z <= z2 + overhang; z++) {
      const ex = x < x1 ? x1 - x : x > x2 ? x - x2 : 0;
      const ez = z < z1 ? z1 - z : z > z2 ? z - z2 : 0;
      if (ex === 0 && ez === 0) continue;
      if (ex > 0 && !sides.has(x < x1 ? "west" : "east")) continue;
      if (ez > 0 && !sides.has(z < z1 ? "north" : "south")) continue;
      deck.put(x, y0, z);
      if (beam && (ex === overhang || ez === overhang)) {
        beam.put(x, y0 - 1, z);
        beamCell.add(`${x},${z}`);
      }
    }
  }

  if (bracket) {
    const lay = (x: number, z: number, facing: string): void => {
      if (beamCell.has(`${x},${z}`)) return;
      geo.set(x, y0 - 1, z, withProps(bracket(x, y0 - 1, z), { facing, half: "top" }));
    };
    const onRhythm = (i: number, n: number): boolean => Math.min(i, n - 1 - i) % every === 0;
    const nx = x2 - x1 + 1;
    const nz = z2 - z1 + 1;
    for (let i = 0; i < nx; i++) {
      if (!onRhythm(i, nx)) continue;
      if (sides.has("north")) lay(x1 + i, z1 - 1, "south");
      if (sides.has("south")) lay(x1 + i, z2 + 1, "north");
    }
    for (let i = 0; i < nz; i++) {
      if (!onRhythm(i, nz)) continue;
      if (sides.has("west")) lay(x1 - 1, z1 + i, "east");
      if (sides.has("east")) lay(x2 + 1, z1 + i, "west");
    }
  }
  return deck.geo.concat(beam ? beam.geo : new Geometry()).concat(geo);
}
