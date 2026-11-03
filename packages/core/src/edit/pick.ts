// SPDX-License-Identifier: AGPL-3.0-only

// Voxel picking: Amanatides-Woo DDA over a Volume, independent of any
// renderer. Cell (i, j, k) occupies [i, i+1) x [j, j+1) x [k, k+1).

import { AIR_BLOCKS } from "../codecs/common.ts";
import type { Vec3, Volume } from "../volume/index.ts";
import { EditError } from "./command.ts";

export interface RayHit {
  /** The block that was hit. */
  position: Vec3;
  /** Outward normal of the face the ray entered through. Zero when the ray starts inside the block. */
  normal: Vec3;
  /** The cell next to the hit face, where a new block goes. Equals `position` when the normal is zero. */
  adjacent: Vec3;
  /** Distance along the (normalized) ray to the face. */
  distance: number;
  /** The block string at `position`. */
  block: string;
}

export interface RaycastOptions {
  /** Give up past this distance. Default 256. */
  maxDistance?: number;
  /**
   * Cells for which this returns false are passed through as if empty, so a
   * view that hides part of the volume (a layer slice) can keep the ray from
   * hitting what is not shown.
   */
  accept?: (x: number, y: number, z: number) => boolean;
}

/**
 * March a ray and return the first non-air block it enters, or `null`.
 * `direction` need not be normalized. Unset cells and air (`air`,
 * `cave_air`, `void_air`) are passed through.
 */
export function raycast(
  volume: Volume,
  origin: Vec3,
  direction: Vec3,
  options: RaycastOptions = {},
): RayHit | null {
  const maxDistance = options.maxDistance ?? 256;
  if (![...origin, ...direction].every(Number.isFinite)) {
    throw new EditError("ray origin and direction must be finite");
  }
  const len = Math.hypot(direction[0], direction[1], direction[2]);
  if (len === 0) throw new EditError("ray direction must not be zero");
  const dx = direction[0] / len;
  const dy = direction[1] / len;
  const dz = direction[2] / len;

  let x = Math.floor(origin[0]);
  let y = Math.floor(origin[1]);
  let z = Math.floor(origin[2]);

  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;
  const tDeltaX = dx === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dx);
  const tDeltaY = dy === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dy);
  const tDeltaZ = dz === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dz);
  let tMaxX =
    dx === 0 ? Number.POSITIVE_INFINITY : (dx > 0 ? x + 1 - origin[0] : origin[0] - x) * tDeltaX;
  let tMaxY =
    dy === 0 ? Number.POSITIVE_INFINITY : (dy > 0 ? y + 1 - origin[1] : origin[1] - y) * tDeltaY;
  let tMaxZ =
    dz === 0 ? Number.POSITIVE_INFINITY : (dz > 0 ? z + 1 - origin[2] : origin[2] - z) * tDeltaZ;

  const accept = options.accept;
  const solid = (cx: number, cy: number, cz: number): string | null => {
    if (accept !== undefined && !accept(cx, cy, cz)) return null;
    const block = volume.get(cx, cy, cz);
    return block === undefined || AIR_BLOCKS.has(block) ? null : block;
  };

  const start = solid(x, y, z);
  if (start !== null) {
    return {
      position: [x, y, z],
      normal: [0, 0, 0],
      adjacent: [x, y, z],
      distance: 0,
      block: start,
    };
  }

  for (;;) {
    let t: number;
    let normal: Vec3;
    if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
      t = tMaxX;
      x += stepX;
      tMaxX += tDeltaX;
      normal = [0 - stepX, 0, 0];
    } else if (tMaxY <= tMaxZ) {
      t = tMaxY;
      y += stepY;
      tMaxY += tDeltaY;
      normal = [0, 0 - stepY, 0];
    } else {
      t = tMaxZ;
      z += stepZ;
      tMaxZ += tDeltaZ;
      normal = [0, 0, 0 - stepZ];
    }
    if (t > maxDistance) return null;
    const block = solid(x, y, z);
    if (block !== null) {
      return {
        position: [x, y, z],
        normal,
        adjacent: [x + normal[0], y + normal[1], z + normal[2]],
        distance: t,
        block,
      };
    }
  }
}
