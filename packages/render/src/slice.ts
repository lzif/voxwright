// SPDX-License-Identifier: AGPL-3.0-only

import type { DenseVolume } from "@voxwright/core";

/**
 * A copy of `dense` with every cell outside the inclusive layer range
 * `yMin..yMax` (dense-array y, 0 at the bottom) made unset. Cells outside the
 * range then behave as air for culling and ambient occlusion, so the cut face
 * is drawn.
 */
export function sliceDense(dense: DenseVolume, yMin: number, yMax: number): DenseVolume {
  const [sx, sy, sz] = dense.size;
  const data = new Int32Array(dense.data);
  for (let x = 0; x < sx; x++) {
    for (let y = 0; y < sy; y++) {
      if (y >= yMin && y <= yMax) continue;
      for (let z = 0; z < sz; z++) data[(x * sy + y) * sz + z] = -1;
    }
  }
  return { ...dense, data };
}

/**
 * A dense sub-volume covering the inclusive world-space box `c1`..`c2`
 * (corners in any order, relative to `dense.origin`). Cells outside the box are
 * excluded so boundary faces behave as exposed faces for culling and ambient
 * occlusion.
 */
export function cropDense(
  dense: DenseVolume,
  c1: readonly [number, number, number],
  c2: readonly [number, number, number],
): DenseVolume {
  const [sx, sy, sz] = dense.size;
  const [ox, oy, oz] = dense.origin;
  const lx0 = Math.max(0, Math.min(c1[0], c2[0]) - ox);
  const lx1 = Math.min(sx - 1, Math.max(c1[0], c2[0]) - ox);
  const ly0 = Math.max(0, Math.min(c1[1], c2[1]) - oy);
  const ly1 = Math.min(sy - 1, Math.max(c1[1], c2[1]) - oy);
  const lz0 = Math.max(0, Math.min(c1[2], c2[2]) - oz);
  const lz1 = Math.min(sz - 1, Math.max(c1[2], c2[2]) - oz);
  if (lx0 > lx1 || ly0 > ly1 || lz0 > lz1) {
    return {
      size: [0, 0, 0],
      origin: [ox, oy, oz],
      data: new Int32Array(0),
      palette: dense.palette,
    };
  }
  const nx = lx1 - lx0 + 1;
  const ny = ly1 - ly0 + 1;
  const nz = lz1 - lz0 + 1;
  const data = new Int32Array(nx * ny * nz);
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) {
      const src = ((lx0 + x) * sy + (ly0 + y)) * sz + lz0;
      const dst = (x * ny + y) * nz;
      for (let z = 0; z < nz; z++) data[dst + z] = dense.data[src + z] as number;
    }
  }
  return {
    size: [nx, ny, nz],
    origin: [ox + lx0, oy + ly0, oz + lz0],
    data,
    palette: dense.palette,
  };
}
