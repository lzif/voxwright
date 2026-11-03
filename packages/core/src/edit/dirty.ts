// SPDX-License-Identifier: AGPL-3.0-only

// Dirty-section tracking for the renderer. A section is marked when a cell in
// it changes, and so are its neighbours when the cell sits on a section
// border: a face, an edge or a corner neighbour, because culling and ambient
// occlusion read the blocks around a cell.

import type { Vec3 } from "../volume/index.ts";
import { type Command, forEachChange } from "./command.ts";

/** The key for a section, `"sx,sy,sz"` (section coordinates, not block coordinates). */
export const sectionKey = (sx: number, sy: number, sz: number): string => `${sx},${sy},${sz}`;

export function parseSectionKey(key: string): Vec3 {
  const parts = key.split(",").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n))) {
    throw new Error(`malformed section key '${key}'`);
  }
  return [parts[0] as number, parts[1] as number, parts[2] as number];
}

function offsets(local: number): readonly number[] {
  if (local === 0) return [0, -1];
  if (local === 15) return [0, 1];
  return [0];
}

/** Add the section holding block `(x, y, z)` and any bordering sections to `into`. */
export function markBlockDirty(into: Set<string>, x: number, y: number, z: number): void {
  const sx = x >> 4;
  const sy = y >> 4;
  const sz = z >> 4;
  for (const dx of offsets(x & 15)) {
    for (const dy of offsets(y & 15)) {
      for (const dz of offsets(z & 15)) into.add(sectionKey(sx + dx, sy + dy, sz + dz));
    }
  }
}

/** Section keys a command dirties, border neighbours included. */
export function dirtySectionKeys(command: Command, into: Set<string> = new Set()): Set<string> {
  forEachChange(command, (x, y, z) => markBlockDirty(into, x, y, z));
  return into;
}

/** Accumulates dirty section keys until the renderer takes them. */
export class DirtyTracker {
  private keys = new Set<string>();

  get size(): number {
    return this.keys.size;
  }

  has(key: string): boolean {
    return this.keys.has(key);
  }

  markCommand(command: Command): void {
    dirtySectionKeys(command, this.keys);
  }

  markSection(sx: number, sy: number, sz: number): void {
    this.keys.add(sectionKey(sx, sy, sz));
  }

  /** Return the dirty keys and start empty. */
  take(): string[] {
    const out = [...this.keys];
    this.keys = new Set();
    return out;
  }
}
