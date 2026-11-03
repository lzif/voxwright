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

import { canonicalize } from "@voxwright/core";
import { McbuilderError } from "./errors.ts";
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
    throw new McbuilderError(
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
        throw new McbuilderError(`invalid palette weight ${String(w)} for '${e[0]}'`);
      }
      if (w < 0) throw new McbuilderError(`negative palette weight ${w} for '${e[0]}'`);
      out.push([canonicalize(e[0]), w]);
    } else {
      throw new McbuilderError(
        `invalid palette entry ${JSON.stringify(e)}: expected a block string or a (block, weight) pair`,
      );
    }
  }
  if (out.length === 0) throw new McbuilderError("material palette is empty");
  if (sum(out) <= 0) throw new McbuilderError("material palette weights sum to zero");
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
  const es = entries(palette);
  if (!(scale > 0)) throw new McbuilderError(`patches: scale must be > 0, got ${scale}`);

  const lattice = (ix: number, iy: number, iz: number): number =>
    unitHash("patches", salt, ix, iy, iz);
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
