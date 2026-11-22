// SPDX-License-Identifier: AGPL-3.0-only

// Material specs: how a shape decides which block goes in each cell.
//
// Anywhere a block is accepted you may pass a material spec:
//
// - "minecraft:stone_bricks": one block everywhere.
// - ["minecraft:stone_bricks", ["minecraft:mossy_stone_bricks", 0.4]]: a
//   weighted palette. Bare strings weigh 1. Each cell is picked by a stable
//   hash of (seed, x, y, z), so a cell resolves the same way regardless of
//   call order.
// - patches(): the same palette picked by smooth noise, so variants form
//   clusters instead of speckle.
// - any function (x, y, z) => string.

import { canonicalize } from "voxmc-core";
import { VoxmcError } from "./errors.ts";
import { sha256 } from "./sha256.ts";

export type MaterialFn = (x: number, y: number, z: number) => string;
export type MaterialEntry = string | readonly [block: string, weight: number];
export type Material = string | readonly MaterialEntry[] | MaterialFn;
/** The seed salting palette hashes. `null` means no seed. */
export type Seed = number | string | null | undefined;

type Entries = [block: string, weight: number][];

/** Python's `str()` for the key parts used in hashes. */
function pyStr(v: unknown): string {
  if (v === null || v === undefined) return "None";
  return String(v);
}

function entries(spec: unknown): Entries {
  if (!Array.isArray(spec)) {
    throw new VoxmcError(
      `invalid material spec ${JSON.stringify(spec)}: expected a block string, a sequence of block strings / (block, weight) pairs, or a callable (x, y, z) -> str`,
    );
  }
  const out: Entries = [];
  for (const e of spec as unknown[]) {
    if (typeof e === "string") {
      out.push([canonicalize(e), 1]);
    } else if (Array.isArray(e) && e.length === 2 && typeof e[0] === "string") {
      const w = e[1];
      if (typeof w !== "number" || Number.isNaN(w)) {
        throw new VoxmcError(`invalid palette weight ${String(w)} for '${e[0]}'`);
      }
      if (w < 0) throw new VoxmcError(`negative palette weight ${w} for '${e[0]}'`);
      out.push([canonicalize(e[0]), w]);
    } else {
      throw new VoxmcError(
        `invalid palette entry ${JSON.stringify(e)}: expected a block string or a (block, weight) pair`,
      );
    }
  }
  if (out.length === 0) throw new VoxmcError("material palette is empty");
  if (sum(out) <= 0) throw new VoxmcError("material palette weights sum to zero");
  return out;
}

const sum = (es: Entries): number => es.reduce((acc, [, w]) => acc + w, 0);

/** Stable hash of `key` mapped to [0, 1), the same as the Python implementation. */
export function unitHash(...key: unknown[]): number {
  const bytes = sha256(new TextEncoder().encode(key.map(pyStr).join("\u0000")));
  let n = 0n;
  for (let i = 0; i < 8; i++) n = (n << 8n) | BigInt(bytes[i] as number);
  return Number(n) / 2 ** 64;
}

/** Weighted pick with `r` in [0, 1). */
function pick(es: Entries, r: number): string {
  const target = r * sum(es);
  let acc = 0;
  for (const [block, w] of es) {
    acc += w;
    if (target < acc) return block;
  }
  return (es[es.length - 1] as [string, number])[0];
}

/** Resolve `spec` to a canonical block string for cell `(x, y, z)`. */
export function resolveMaterial(
  spec: Material,
  x: number,
  y: number,
  z: number,
  seed?: Seed,
): string {
  if (typeof spec === "string") return canonicalize(spec);
  if (typeof spec === "function") return canonicalize(spec(x, y, z));
  return pick(entries(spec), unitHash(seed, x, y, z));
}

export interface PatchesOptions {
  /** Rough patch size in blocks. Default 4. */
  scale?: number;
  /** Change this to get a different layout from the same palette. */
  salt?: string;
  /** Optional seed salting the patch noise lattice. */
  seed?: Seed;
}

/**
 * A palette picked by smooth 3D value noise: variants form patches. Weights
 * mean "share of the area", approximately.
 */
export function patches(
  palette: readonly MaterialEntry[],
  options: PatchesOptions = {},
): MaterialFn {
  const scale = options.scale ?? 4;
  const salt = options.salt ?? "";
  const hasSeed = options.seed !== undefined && options.seed !== null;
  const seed = options.seed;
  const es = entries(palette);
  if (!(scale > 0)) throw new VoxmcError(`patches: scale must be > 0, got ${scale}`);

  const lattice = (ix: number, iy: number, iz: number): number =>
    hasSeed ? unitHash("patches", salt, ix, iy, iz, seed) : unitHash("patches", salt, ix, iy, iz);
  const smooth = (t: number): number => t * t * (3 - 2 * t);

  const noise = (x: number, y: number, z: number): number => {
    const fx = x / scale;
    const fy = y / scale;
    const fz = z / scale;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const iz = Math.floor(fz);
    const tx = smooth(fx - ix);
    const ty = smooth(fy - iy);
    const tz = smooth(fz - iz);
    let v = 0;
    for (const [dx, wx] of [
      [0, 1 - tx],
      [1, tx],
    ] as const) {
      for (const [dy, wy] of [
        [0, 1 - ty],
        [1, ty],
      ] as const) {
        for (const [dz, wz] of [
          [0, 1 - tz],
          [1, tz],
        ] as const) {
          v += wx * wy * wz * lattice(ix + dx, iy + dy, iz + dz);
        }
      }
    }
    return v;
  };

  // Trilinear-blended uniform noise piles up around 0.5; a smoothstep pushes
  // it back toward uniform so weights roughly hold.
  const equalize = (value: number): number => {
    const v = Math.min(1, Math.max(0, (value - 0.5) * 1.7 + 0.5));
    return Math.min(0.999999, smooth(v));
  };

  return (x, y, z) => pick(es, equalize(noise(x, y, z)));
}

export interface GradientOptions {
  /** The axis the gradient runs along. Default `"y"`. */
  axis?: "x" | "y" | "z";
  /** Coordinate (on `axis`) where the first stop sits. */
  from: number;
  /** Coordinate (on `axis`) where the last stop sits. */
  to: number;
  /**
   * How far neighbouring stops mix, 0..1. 0 gives hard bands; 1 (the default)
   * blends each stop into the next over the whole step, cell by cell, so the
   * change reads as a gradient instead of stripes.
   */
  blend?: number;
  /** Change this to get a different mix from the same stops. */
  salt?: string;
}

/**
 * Stops picked by position along one axis: the first stop at `from`, the last
 * at `to`, the others evenly between, and cells between two stops mixed by a
 * stable hash so the change is gradual. Positions past either end take the end
 * stop. A stop may be any material spec (a block, a palette, `patches()` ...);
 * a palette stop resolves without a seed. Use it for a roof that darkens toward
 * the eave or a wall that lightens upward; `voxmc palette ramp` suggests
 * stops that step evenly in colour.
 */
export function gradient(stops: readonly Material[], options: GradientOptions): MaterialFn {
  const { axis = "y", from, to, blend = 1, salt = "" } = options;
  if (!Array.isArray(stops) || stops.length === 0) {
    throw new VoxmcError("gradient: give at least one stop");
  }
  if (axis !== "x" && axis !== "y" && axis !== "z") {
    throw new VoxmcError(`gradient: axis must be 'x', 'y' or 'z', got ${String(axis)}`);
  }
  if (
    typeof from !== "number" ||
    typeof to !== "number" ||
    !Number.isFinite(from) ||
    !Number.isFinite(to)
  ) {
    throw new VoxmcError(
      `gradient: from and to must be numbers, got ${String(from)}, ${String(to)}`,
    );
  }
  if (!(blend >= 0 && blend <= 1)) {
    throw new VoxmcError(`gradient: blend must be between 0 and 1, got ${String(blend)}`);
  }
  const n = stops.length;
  return (x, y, z) => {
    const c = axis === "x" ? x : axis === "y" ? y : z;
    const t = from === to ? 0 : Math.min(1, Math.max(0, (c - from) / (to - from)));
    const f = t * (n - 1);
    let i = Math.min(n - 1, Math.floor(f));
    const frac = f - i;
    if (i < n - 1) {
      // Probability of the next stop: a ramp centred on the halfway point, `blend` wide.
      const p =
        blend === 0 ? (frac >= 0.5 ? 1 : 0) : Math.min(1, Math.max(0, (frac - 0.5) / blend + 0.5));
      if (unitHash("gradient", salt, x, y, z) < p) i += 1;
    }
    return resolveMaterial(stops[i] as Material, x, y, z);
  };
}
