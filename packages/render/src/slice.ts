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
