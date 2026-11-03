// SPDX-License-Identifier: AGPL-3.0-only

// The summary the page shows about an open file: its size, block counts and
// what its format could not carry.

import { AIR, type Volume } from "@voxwright/core";
import type { Info } from "./protocol.ts";

/** Size, non-air block counts (most used first) and the loss report of an opened volume. */
export function describeVolume(
  name: string,
  volume: Volume,
  dataVersion: number | null,
  loss: string[],
): Info {
  const counts = new Map<string, number>();
  const palette = volume.palette;
  const perIndex = new Float64Array(palette.length);
  volume.eachCell((_x, _y, _z, idx) => {
    perIndex[idx] = (perIndex[idx] as number) + 1;
  });
  palette.forEach((b, i) => {
    if (b === AIR || perIndex[i] === 0) return;
    const base = b.split("[", 1)[0] as string;
    counts.set(base, (counts.get(base) ?? 0) + (perIndex[i] as number));
  });
  const bb = volume.placedBounds();
  const size: [number, number, number] = bb
    ? [bb[1][0] - bb[0][0] + 1, bb[1][1] - bb[0][1] + 1, bb[1][2] - bb[0][2] + 1]
    : [0, 0, 0];
  return {
    name,
    size,
    origin: bb ? [bb[0][0], bb[0][1], bb[0][2]] : [0, 0, 0],
    blocks: [...counts.values()].reduce((a, b) => a + b, 0),
    dataVersion,
    counts: [...counts].sort((a, b) => b[1] - a[1]),
    loss,
  };
}
