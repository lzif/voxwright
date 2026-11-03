// SPDX-License-Identifier: AGPL-3.0-only

// Axis-aligned selection boxes. Both corners are inclusive.

import type { Vec3, Volume } from "../volume/index.ts";

export interface Box {
  readonly min: Vec3;
  readonly max: Vec3;
}

/** The box spanning two corners given in any order. */
export function makeBox(a: Vec3, b: Vec3): Box {
  return {
    min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
    max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
  };
}

/** Edge lengths in cells. */
export function boxSize(box: Box): Vec3 {
  return [box.max[0] - box.min[0] + 1, box.max[1] - box.min[1] + 1, box.max[2] - box.min[2] + 1];
}

export function boxCellCount(box: Box): number {
  const [w, h, l] = boxSize(box);
  return w * h * l;
}

export function boxContains(box: Box, x: number, y: number, z: number): boolean {
  return (
    x >= box.min[0] &&
    x <= box.max[0] &&
    y >= box.min[1] &&
    y <= box.max[1] &&
    z >= box.min[2] &&
    z <= box.max[2]
  );
}

/** Visit every coordinate in the box, x slowest and z fastest. */
export function eachPosInBox(box: Box, fn: (x: number, y: number, z: number) => void): void {
  for (let x = box.min[0]; x <= box.max[0]; x++) {
    for (let y = box.min[1]; y <= box.max[1]; y++) {
      for (let z = box.min[2]; z <= box.max[2]; z++) fn(x, y, z);
    }
  }
}

/**
 * Visit the set cells inside the box (air included, unset cells skipped).
 * Order is not specified. The cheaper of "walk the box" and "walk the
 * volume" is chosen, so a huge box over a sparse volume stays fast.
 */
export function eachCellInBox(
  volume: Volume,
  box: Box,
  fn: (x: number, y: number, z: number, paletteIndex: number) => void,
): void {
  if (boxCellCount(box) <= volume.size * 8 + 4096) {
    eachPosInBox(box, (x, y, z) => {
      const idx = volume.indexAt(x, y, z);
      if (idx >= 0) fn(x, y, z, idx);
    });
    return;
  }
  // Collect first so `fn` may edit the volume.
  const hits: number[] = [];
  volume.eachCell((x, y, z, idx) => {
    if (boxContains(box, x, y, z)) hits.push(x, y, z, idx);
  });
  for (let i = 0; i < hits.length; i += 4) {
    fn(hits[i] as number, hits[i + 1] as number, hits[i + 2] as number, hits[i + 3] as number);
  }
}
