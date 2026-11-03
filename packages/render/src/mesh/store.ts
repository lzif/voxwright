// SPDX-License-Identifier: AGPL-3.0-only

// Reading a volume the way the mesher wants it: a section plus a one-cell
// border, as one flat array of palette indices. `paddedFromVolume` does it
// straight from a `Volume`; `SectionStore` keeps a copy of every section so a
// whole build can be fed to the mesher without a map lookup per cell.

import { AIR, UNSET, type Volume } from "@voxwright/core";
import { PADDED, PADDED_VOLUME, paddedIndex, parseSectionKey, sectionKey } from "./section.ts";

const SECTION_SIZE = 16;
const SECTION_VOLUME = SECTION_SIZE ** 3;

/** The padded block around section `(sx, sy, sz)`, read cell by cell from the volume. */
export function paddedFromVolume(
  volume: Volume,
  sx: number,
  sy: number,
  sz: number,
  out: Int32Array = new Int32Array(PADDED_VOLUME),
): Int32Array {
  const ox = sx * SECTION_SIZE - 1;
  const oy = sy * SECTION_SIZE - 1;
  const oz = sz * SECTION_SIZE - 1;
  for (let x = 0; x < PADDED; x++)
    for (let y = 0; y < PADDED; y++)
      for (let z = 0; z < PADDED; z++)
        out[paddedIndex(x, y, z)] = volume.indexAt(ox + x, oy + y, oz + z);
  return out;
}

interface Stored {
  /** Palette indices, `(x * 16 + y) * 16 + z` with local coordinates. */
  data: Int32Array;
  /** Cells that are set and not air. */
  blocks: number;
}

/** A snapshot of a volume's sections, refreshed section by section as the volume is edited. */
export class SectionStore {
  private readonly sections = new Map<string, Stored>();
  private readonly volume: Volume;
  private lo: [number, number, number] | null = null;
  private hi: [number, number, number] | null = null;

  constructor(volume: Volume) {
    this.volume = volume;
    this.rebuild();
  }

  /** Read every section again (a new volume, or a bulk edit). */
  rebuild(): void {
    this.sections.clear();
    this.lo = null;
    this.hi = null;
    let lx = Number.POSITIVE_INFINITY;
    let ly = Number.POSITIVE_INFINITY;
    let lz = Number.POSITIVE_INFINITY;
    let hx = Number.NEGATIVE_INFINITY;
    let hy = Number.NEGATIVE_INFINITY;
    let hz = Number.NEGATIVE_INFINITY;
    const air = this.airIndices();
    let cur: Stored | null = null;
    let cx = Number.NaN;
    let cy = Number.NaN;
    let cz = Number.NaN;
    this.volume.eachCell((x, y, z, idx) => {
      const sx = x >> 4;
      const sy = y >> 4;
      const sz = z >> 4;
      if (cur === null || sx !== cx || sy !== cy || sz !== cz) {
        const key = sectionKey(sx, sy, sz);
        let s = this.sections.get(key);
        if (s === undefined) {
          s = { data: new Int32Array(SECTION_VOLUME).fill(UNSET), blocks: 0 };
          this.sections.set(key, s);
        }
        cur = s;
        cx = sx;
        cy = sy;
        cz = sz;
      }
      cur.data[((x & 15) * 16 + (y & 15)) * 16 + (z & 15)] = idx;
      if (air.has(idx)) return;
      cur.blocks++;
      if (x < lx) lx = x;
      if (y < ly) ly = y;
      if (z < lz) lz = z;
      if (x > hx) hx = x;
      if (y > hy) hy = y;
      if (z > hz) hz = z;
    });
    if (hx >= lx) {
      this.lo = [lx, ly, lz];
      this.hi = [hx, hy, hz];
    }
  }

  /** Inclusive corners of the non-air blocks as they were when the store was built, or `null`. */
  bounds(): { min: [number, number, number]; max: [number, number, number] } | null {
    return this.lo === null || this.hi === null ? null : { min: [...this.lo], max: [...this.hi] };
  }

  private airIndices(): Set<number> {
    const air = new Set<number>();
    this.volume.palette.forEach((b, i) => {
      if (b === AIR) air.add(i);
    });
    return air;
  }

  /**
   * Read one section again from the volume, after cells in it changed. A
   * section that no longer holds any cell is dropped. Returns whether it exists.
   */
  refresh(key: string): boolean {
    const [sx, sy, sz] = parseSectionKey(key);
    const air = this.airIndices();
    const data = new Int32Array(SECTION_VOLUME).fill(UNSET);
    let set = 0;
    let blocks = 0;
    for (let x = 0; x < SECTION_SIZE; x++)
      for (let y = 0; y < SECTION_SIZE; y++)
        for (let z = 0; z < SECTION_SIZE; z++) {
          const idx = this.volume.indexAt(sx * 16 + x, sy * 16 + y, sz * 16 + z);
          if (idx === UNSET) continue;
          data[(x * 16 + y) * 16 + z] = idx;
          set++;
          if (!air.has(idx)) blocks++;
        }
    if (set === 0) {
      this.sections.delete(key);
      return false;
    }
    this.sections.set(key, { data, blocks });
    return true;
  }

  has(key: string): boolean {
    return this.sections.has(key);
  }

  /** Keys of every section that holds at least one block that is not air. */
  keys(): string[] {
    const out: string[] = [];
    for (const [k, s] of this.sections) if (s.blocks > 0) out.push(k);
    return out;
  }

  /** Whether the section holds a block that is not air (an all-air section has nothing to mesh). */
  hasBlocks(key: string): boolean {
    return (this.sections.get(key)?.blocks ?? 0) > 0;
  }

  /** The padded block around a section, filled from this store. */
  padded(
    sx: number,
    sy: number,
    sz: number,
    out: Int32Array = new Int32Array(PADDED_VOLUME),
  ): Int32Array {
    out.fill(UNSET);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const s = this.sections.get(sectionKey(sx + dx, sy + dy, sz + dz));
          if (s === undefined) continue;
          // Padded coordinate p holds local l = p - 1 of the section d away: that is l + 16 d.
          const x0 = dx < 0 ? 0 : dx > 0 ? PADDED - 1 : 1;
          const x1 = dx < 0 ? 0 : dx > 0 ? PADDED - 1 : PADDED - 2;
          const y0 = dy < 0 ? 0 : dy > 0 ? PADDED - 1 : 1;
          const y1 = dy < 0 ? 0 : dy > 0 ? PADDED - 1 : PADDED - 2;
          const z0 = dz < 0 ? 0 : dz > 0 ? PADDED - 1 : 1;
          const z1 = dz < 0 ? 0 : dz > 0 ? PADDED - 1 : PADDED - 2;
          for (let x = x0; x <= x1; x++) {
            const lx = x - 1 - dx * 16;
            for (let y = y0; y <= y1; y++) {
              const ly = y - 1 - dy * 16;
              const base = (lx * 16 + ly) * 16 - 1 - dz * 16;
              for (let z = z0; z <= z1; z++) out[paddedIndex(x, y, z)] = s.data[base + z] as number;
            }
          }
        }
    return out;
  }
}
