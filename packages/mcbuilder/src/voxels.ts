// SPDX-License-Identifier: AGPL-3.0-only

// The voxel grid behind a Build: a sparse `Volume` with a per-axis dimension
// guard. Coordinates may be negative; each axis accepts
// `-maxDim <= c < maxDim`. An explicit `minecraft:air` is a real value
// (carved air), distinct from a cell that was never set.

import { AIR, type DenseVolume, Volume } from "@voxwright/core";
import { GridBoundsError } from "./errors.ts";

export type Dims = readonly [number, number, number];

export class VoxelGrid {
  readonly volume = new Volume();
  readonly maxDims: Dims;
  private overwrites = 0;
  /**
   * The call stack of the first placement of each block state, so that a validation error can
   * name the script line that placed the block. One capture per distinct state.
   */
  readonly firstPlaced = new Map<string, Error>();

  constructor(maxDims: Dims = [256, 256, 256]) {
    if (maxDims.length !== 3 || maxDims.some((d) => !Number.isInteger(d) || d <= 0)) {
      throw new RangeError(`max_dims must be 3 positive ints, got [${maxDims.join(", ")}]`);
    }
    this.maxDims = [...maxDims] as unknown as Dims;
  }

  /** Cells where a real block was replaced by a different real block. */
  get overwriteCount(): number {
    return this.overwrites;
  }

  checkBounds(x: number, y: number, z: number): void {
    const axes = ["x", "y", "z"] as const;
    [x, y, z].forEach((value, i) => {
      const allowed = this.maxDims[i] as number;
      if (!(-allowed <= value && value < allowed)) {
        throw new GridBoundsError(
          `axis ${axes[i]}: coordinate ${value} out of bounds (allowed -${allowed}..${allowed - 1} for max dimension ${allowed})`,
        );
      }
    });
  }

  /** Place a canonical block string. Last write wins. */
  place(x: number, y: number, z: number, canonical: string): void {
    for (const v of [x, y, z]) {
      if (typeof v !== "number" || !Number.isInteger(v)) {
        throw new TypeError(`voxel coordinates must be ints, got ${String(v)}`);
      }
    }
    this.checkBounds(x, y, z);
    const old = this.volume.get(x, y, z);
    if (old !== undefined && old !== canonical && old !== AIR && canonical !== AIR) {
      // A real block replaced by a different real block.
      this.overwrites++;
    }
    if (canonical !== AIR && !this.firstPlaced.has(canonical)) {
      const limit = Error.stackTraceLimit;
      Error.stackTraceLimit = 40;
      this.firstPlaced.set(canonical, new Error("first placement"));
      Error.stackTraceLimit = limit;
    }
    this.volume.set(x, y, z, canonical);
  }

  /** Make a cell unset. */
  unset(x: number, y: number, z: number): void {
    this.volume.unset(x, y, z);
  }

  /** Move every placed cell. */
  shift(dx: number, dy: number, dz: number): void {
    this.volume.translate(dx, dy, dz);
  }

  /** Inclusive bounding box over non-air cells, or `null`. */
  bounds(): ReturnType<Volume["bounds"]> {
    return this.volume.bounds();
  }

  /** The placed region as a dense array (see `Volume.toDense`). */
  toDense(): DenseVolume {
    return this.volume.toDense();
  }

  /** A new grid with only the cells inside the box `c1`..`c2`. */
  crop(c1: Dims, c2: Dims): VoxelGrid {
    const lo = [0, 1, 2].map((i) => Math.min(c1[i] as number, c2[i] as number));
    const hi = [0, 1, 2].map((i) => Math.max(c1[i] as number, c2[i] as number));
    const out = new VoxelGrid(this.maxDims);
    this.volume.eachCell((x, y, z, idx) => {
      if (
        x >= (lo[0] as number) &&
        x <= (hi[0] as number) &&
        y >= (lo[1] as number) &&
        y <= (hi[1] as number) &&
        z >= (lo[2] as number) &&
        z <= (hi[2] as number)
      ) {
        out.place(x, y, z, this.volume.palette[idx] as string);
      }
    });
    return out;
  }
}
