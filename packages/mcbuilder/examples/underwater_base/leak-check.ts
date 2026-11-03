// SPDX-License-Identifier: AGPL-3.0-only

// Find air cells that would let the ocean in.
//
// An underwater base exported with `--air explicit` replaces water only where
// the script placed `minecraft:air`. Any air cell that touches a cell the
// script never placed (which stays ocean water after pasting) floods.

import type { Build } from "../../src/index.ts";

const AIR = "minecraft:air";
const NEIGHBOURS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

type Cell = readonly [number, number, number];

/** `[airCell, openNeighbour]` pairs, sorted. */
export function leaks(build: Build): [Cell, Cell][] {
  const v = build.grid.volume;
  const out: [Cell, Cell][] = [];
  v.eachCell((x, y, z, idx) => {
    if (v.palette[idx] !== AIR) return;
    for (const [dx, dy, dz] of NEIGHBOURS) {
      if (v.get(x + dx, y + dy, z + dz) === undefined)
        out.push([
          [x, y, z],
          [x + dx, y + dy, z + dz],
        ]);
    }
  });
  const cmp = (a: Cell, b: Cell): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  return out.sort((a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1]));
}
