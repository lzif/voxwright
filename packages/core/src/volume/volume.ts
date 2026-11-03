// SPDX-License-Identifier: AGPL-3.0-only

// A sparse block volume stored as 16x16x16 sections with an interned
// palette. Cells are addressed by integer world coordinates, which may be
// negative. Cells that were never set read as unset; an explicit
// `minecraft:air` is a real value (carved air), distinct from unset.

export const AIR = "minecraft:air";

/** Dense-array value for cells that were never set. */
export const UNSET = -1;

const SECTION_BITS = 4;
const SECTION_SIZE = 1 << SECTION_BITS;
const SECTION_MASK = SECTION_SIZE - 1;
const SECTION_VOLUME = SECTION_SIZE ** 3;

export type Vec3 = readonly [x: number, y: number, z: number];
export type Bounds = readonly [min: Vec3, max: Vec3];

/** Palette-index data for one 16x16x16 chunk of space. */
class Section {
  readonly data = new Int32Array(SECTION_VOLUME).fill(UNSET);
  count = 0;
}

/**
 * The placed region as an array of palette indices.
 *
 * `data[(i * size[1] + j) * size[2] + k]` is the cell at
 * `(origin[0] + i, origin[1] + j, origin[2] + k)`, so x is the slowest
 * axis and z the fastest. Cells never set read as {@link UNSET}. `palette`
 * is aligned with the values and holds only entries that some cell uses.
 */
export interface DenseVolume {
  size: Vec3;
  origin: Vec3;
  data: Int32Array;
  palette: string[];
}

export class VolumeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VolumeError";
  }
}

function checkCoord(axis: string, v: number): void {
  if (!Number.isSafeInteger(v) || Math.abs(v) > 0x7fffffff) {
    throw new VolumeError(`axis ${axis}: coordinate ${v} is not a 32-bit integer`);
  }
}

const sectionKey = (sx: number, sy: number, sz: number): string => `${sx},${sy},${sz}`;
const cellIndex = (x: number, y: number, z: number): number =>
  ((y & SECTION_MASK) << 8) | ((z & SECTION_MASK) << 4) | (x & SECTION_MASK);

export class Volume {
  private readonly sections = new Map<string, { sx: number; sy: number; sz: number; s: Section }>();
  private readonly paletteList: string[] = [];
  private readonly paletteIndex = new Map<string, number>();
  private cellCount = 0;

  /** The interned palette, in the order blocks were first set. */
  get palette(): readonly string[] {
    return this.paletteList;
  }

  /** Number of cells that have been set, air included. */
  get size(): number {
    return this.cellCount;
  }

  /** Add `block` to the palette if needed and return its index. */
  intern(block: string): number {
    let idx = this.paletteIndex.get(block);
    if (idx === undefined) {
      idx = this.paletteList.length;
      this.paletteList.push(block);
      this.paletteIndex.set(block, idx);
    }
    return idx;
  }

  /** Set a cell. The last write wins. `block` should be a canonical block string. */
  set(x: number, y: number, z: number, block: string): void {
    checkCoord("x", x);
    checkCoord("y", y);
    checkCoord("z", z);
    const idx = this.intern(block);
    const sx = x >> SECTION_BITS;
    const sy = y >> SECTION_BITS;
    const sz = z >> SECTION_BITS;
    const key = sectionKey(sx, sy, sz);
    let entry = this.sections.get(key);
    if (entry === undefined) {
      entry = { sx, sy, sz, s: new Section() };
      this.sections.set(key, entry);
    }
    const i = cellIndex(x, y, z);
    if (entry.s.data[i] === UNSET) {
      entry.s.count++;
      this.cellCount++;
    }
    entry.s.data[i] = idx;
  }

  /** Palette index at a cell, or {@link UNSET}. */
  indexAt(x: number, y: number, z: number): number {
    const entry = this.sections.get(
      sectionKey(x >> SECTION_BITS, y >> SECTION_BITS, z >> SECTION_BITS),
    );
    return entry === undefined ? UNSET : (entry.s.data[cellIndex(x, y, z)] as number);
  }

  /** Block string at a cell, or `undefined` when it was never set. */
  get(x: number, y: number, z: number): string | undefined {
    const idx = this.indexAt(x, y, z);
    return idx === UNSET ? undefined : this.paletteList[idx];
  }

  /** Visit every set cell. Order is by section, not by coordinate. */
  eachCell(fn: (x: number, y: number, z: number, paletteIndex: number) => void): void {
    for (const { sx, sy, sz, s } of this.sections.values()) {
      if (s.count === 0) continue;
      for (let i = 0; i < SECTION_VOLUME; i++) {
        const idx = s.data[i] as number;
        if (idx === UNSET) continue;
        fn(
          (sx << SECTION_BITS) | (i & SECTION_MASK),
          (sy << SECTION_BITS) | (i >> 8),
          (sz << SECTION_BITS) | ((i >> 4) & SECTION_MASK),
          idx,
        );
      }
    }
  }

  private boundsWhere(include: (paletteIndex: number) => boolean): Bounds | null {
    let min: [number, number, number] | null = null;
    let max: [number, number, number] | null = null;
    this.eachCell((x, y, z, idx) => {
      if (!include(idx)) return;
      if (min === null || max === null) {
        min = [x, y, z];
        max = [x, y, z];
        return;
      }
      if (x < min[0]) min[0] = x;
      if (y < min[1]) min[1] = y;
      if (z < min[2]) min[2] = z;
      if (x > max[0]) max[0] = x;
      if (y > max[1]) max[1] = y;
      if (z > max[2]) max[2] = z;
    });
    return min === null || max === null ? null : [min, max];
  }

  /** Inclusive bounding box over every set cell, air included, or `null` when empty. */
  placedBounds(): Bounds | null {
    return this.boundsWhere(() => true);
  }

  /** Inclusive bounding box over non-air cells, or `null` when there are none. */
  bounds(): Bounds | null {
    return this.boundsWhere((idx) => this.paletteList[idx] !== AIR);
  }

  /** Number of set cells whose block is not `minecraft:air`. */
  countNonAir(): number {
    let n = 0;
    this.eachCell((_x, _y, _z, idx) => {
      if (this.paletteList[idx] !== AIR) n++;
    });
    return n;
  }

  /**
   * Materialize the placed region (see {@link placedBounds}) as a dense
   * array. The palette is compacted to the entries some cell references, in
   * their original order. An empty volume gives a 0x0x0 array.
   */
  toDense(): DenseVolume {
    const bb = this.placedBounds();
    if (bb === null) {
      return { size: [0, 0, 0], origin: [0, 0, 0], data: new Int32Array(0), palette: [] };
    }
    const [min, max] = bb;
    const sx = max[0] - min[0] + 1;
    const sy = max[1] - min[1] + 1;
    const sz = max[2] - min[2] + 1;
    const total = sx * sy * sz;
    if (total > 0x7fffffff)
      throw new VolumeError(`volume ${sx}x${sy}x${sz} is too large to densify`);
    const data = new Int32Array(total).fill(UNSET);
    const used = new Uint8Array(this.paletteList.length);
    this.eachCell((x, y, z, idx) => {
      data[((x - min[0]) * sy + (y - min[1])) * sz + (z - min[2])] = idx;
      used[idx] = 1;
    });
    const remap = new Int32Array(this.paletteList.length).fill(UNSET);
    const palette: string[] = [];
    for (let i = 0; i < used.length; i++) {
      if (used[i]) {
        remap[i] = palette.length;
        palette.push(this.paletteList[i] as string);
      }
    }
    if (palette.length !== this.paletteList.length) {
      for (let i = 0; i < data.length; i++) {
        const v = data[i] as number;
        if (v !== UNSET) data[i] = remap[v] as number;
      }
    }
    return { size: [sx, sy, sz], origin: min, data, palette };
  }
}
