// SPDX-License-Identifier: AGPL-3.0-only

// Cell-level diff between two builds (A = old, B = new): which cells were
// added, removed or replaced, and the text report the CLI prints.

import { McbuilderError } from "./errors.ts";

/** A diff that cannot run: unknown run id, missing artifact, ... */
export class DiffError extends McbuilderError {}

export type Pos = readonly [x: number, y: number, z: number];
/** Voxel map keyed by `"x,y,z"`. */
export type VoxelMap = ReadonlyMap<string, string>;

export const voxelKey = (x: number, y: number, z: number): string => `${x},${y},${z}`;
const posOf = (key: string): Pos => key.split(",").map(Number) as unknown as Pos;

export interface VoxelDiff {
  /** In B only. */
  added: [Pos, string][];
  /** In A only. */
  removed: [Pos, string][];
  /** In both, with different blocks: position, old, new. */
  changed: [Pos, string, string][];
  /** Non-air cells in A and in B. */
  cellsA: number;
  cellsB: number;
}

export const isEmpty = (d: VoxelDiff): boolean =>
  d.added.length + d.removed.length + d.changed.length === 0;
export const total = (d: VoxelDiff): number => d.added.length + d.removed.length + d.changed.length;

const cmpPos = (a: Pos, b: Pos): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** Cell-level diff between two voxel maps, positions in sorted (x, y, z) order. */
export function diffVoxelMaps(a: VoxelMap, b: VoxelMap): VoxelDiff {
  const keys = [...new Set([...a.keys(), ...b.keys()])].map((k) => ({ key: k, pos: posOf(k) }));
  keys.sort((p, q) => cmpPos(p.pos, q.pos));
  const out: VoxelDiff = { added: [], removed: [], changed: [], cellsA: a.size, cellsB: b.size };
  for (const { key, pos } of keys) {
    const inA = a.has(key);
    const inB = b.has(key);
    if (inA && !inB) out.removed.push([pos, a.get(key) as string]);
    else if (inB && !inA) out.added.push([pos, b.get(key) as string]);
    else if (a.get(key) !== b.get(key))
      out.changed.push([pos, a.get(key) as string, b.get(key) as string]);
  }
  return out;
}

/** `"1 changed cell"` / `"4 changed cells"`. */
function n(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}

/** The human-readable diff report. */
export function formatDiff(
  diff: VoxelDiff,
  aId: string,
  bId: string,
  options: { maxEntries?: number } = {},
): string {
  const maxEntries = options.maxEntries ?? 30;
  const lines = [`diff ${aId} -> ${bId}`];
  if (isEmpty(diff)) {
    lines.push(`  no differences (${n(diff.cellsA, "cell")} in both)`);
    return lines.join("\n");
  }
  lines.push(
    `  ${n(total(diff), "changed cell")}: ${diff.added.length} added, ${diff.removed.length} removed, ${diff.changed.length} replaced (${diff.cellsA} -> ${diff.cellsB} cells)`,
  );
  const entries: [string, Pos, string, string | null][] = [
    ...diff.added.map(([pos, blk]): [string, Pos, string, string | null] => ["+", pos, blk, null]),
    ...diff.removed.map(([pos, blk]): [string, Pos, string, string | null] => [
      "-",
      pos,
      blk,
      null,
    ]),
    ...diff.changed.map(([pos, o, nw]): [string, Pos, string, string | null] => ["~", pos, o, nw]),
  ];
  const shown = Math.min(entries.length, Math.max(0, maxEntries));
  for (const [sym, pos, old, nw] of entries.slice(0, Math.max(0, maxEntries))) {
    const xyz = pos.join(", ");
    lines.push(nw === null ? `  ${sym} (${xyz}) ${old}` : `  ~ (${xyz}) ${old} -> ${nw}`);
  }
  const rest = entries.length - shown;
  if (rest) lines.push(`  ... ${n(rest, "more change")} not shown (use --max N)`);
  return lines.join("\n");
}
