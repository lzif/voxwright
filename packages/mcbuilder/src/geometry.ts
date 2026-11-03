// SPDX-License-Identifier: AGPL-3.0-only

// Geometry: a reusable set of block placements that is not in a build yet.
// Every shape returns one. Stamp it into a build with `build.place(geo, ...)`
// as often as you like; the geometry itself never changes. Transforms and
// `concat` return new geometries.

import { mirrorBlockstate, type Rotation, rotateBlockstate, rotatePoint } from "@voxwright/core";
import { type Material, resolveMaterial } from "./materials.ts";

export type Cell = readonly [x: number, y: number, z: number, block: string];
export type Point = readonly [x: number, y: number, z: number];

export function checkInts(what: string, ...values: number[]): void {
  for (const v of values) {
    if (typeof v !== "number" || !Number.isInteger(v)) {
      throw new TypeError(`${what} must be ints, got ${String(v)}`);
    }
  }
}

export class Geometry {
  private cellList: Cell[] = [];

  /** Add one block (any material spec) at `(dx, dy, dz)`. */
  set(dx: number, dy: number, dz: number, block: Material): void {
    checkInts("geometry coordinates", dx, dy, dz);
    this.cellList.push([dx, dy, dz, resolveMaterial(block, dx, dy, dz)]);
  }

  /** Combine two geometries; later cells win on overlap when stamped. */
  concat(other: Geometry): Geometry {
    const out = new Geometry();
    out.cellList = [...this.cellList, ...other.cellList];
    return out;
  }

  /** Translate every cell. Block states are untouched. */
  shift(dx: number, dy: number, dz: number): Geometry {
    checkInts("shift offsets", dx, dy, dz);
    const out = new Geometry();
    out.cellList = this.cellList.map(([x, y, z, b]) => [x + dx, y + dy, z + dz, b] as const);
    return out;
  }

  /**
   * Rotate every cell about `anchor`, clockwise viewed from above. Block
   * states rotate too, so a rotated stair assembly keeps pointing the right way.
   */
  rotate(rotation: Rotation = "CLOCKWISE_90", anchor: Point = [0, 0, 0]): Geometry {
    const [ax, , az] = anchor;
    checkInts("rotate: anchor coordinates", ...anchor);
    const out = new Geometry();
    for (const [x, y, z, b] of this.cellList) {
      const [rx, rz] = rotatePoint(x, z, ax, az, rotation);
      out.cellList.push([rx, y, rz, rotateBlockstate(b, rotation)]);
    }
    return out;
  }

  /** Mirror across the `axis` plane through the origin (`x` maps x to -x, `z` maps z to -z). */
  mirror(axis: "x" | "z" = "x"): Geometry {
    if (axis !== "x" && axis !== "z") {
      throw new TypeError(`mirror: axis must be 'x' or 'z', got ${String(axis)}`);
    }
    const out = new Geometry();
    for (const [x, y, z, b] of this.cellList) {
      out.cellList.push(
        axis === "x"
          ? [0 - x, y, z, mirrorBlockstate(b, axis)] // 0 - v, not -v: zero stays +0
          : [x, y, 0 - z, mirrorBlockstate(b, axis)],
      );
    }
    return out;
  }

  /** Remove every cell in the inclusive relative box `c1`..`c2`. Corners may be in any order. */
  carve(c1: Point, c2: Point): Geometry {
    checkInts("carve: corner coordinates", ...c1, ...c2);
    const [lx, hx] = [Math.min(c1[0], c2[0]), Math.max(c1[0], c2[0])];
    const [ly, hy] = [Math.min(c1[1], c2[1]), Math.max(c1[1], c2[1])];
    const [lz, hz] = [Math.min(c1[2], c2[2]), Math.max(c1[2], c2[2])];
    const out = new Geometry();
    out.cellList = this.cellList.filter(
      ([x, y, z]) => !(lx <= x && x <= hx && ly <= y && y <= hy && lz <= z && z <= hz),
    );
    return out;
  }

  /** The relative placements, in the order they were added. */
  cells(): Cell[] {
    return [...this.cellList];
  }

  get length(): number {
    return this.cellList.length;
  }

  /** Inclusive relative bounding box, or `null` when empty. */
  bounds(): readonly [Point, Point] | null {
    if (this.cellList.length === 0) return null;
    let [x0, y0, z0] = this.cellList[0] as Cell;
    let [x1, y1, z1] = [x0, y0, z0];
    for (const [x, y, z] of this.cellList) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (z < z0) z0 = z;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
      if (z > z1) z1 = z;
    }
    return [
      [x0, y0, z0],
      [x1, y1, z1],
    ];
  }

  /** @internal Used by `Build.place`; cells are already resolved. */
  static fromCells(cells: Cell[]): Geometry {
    const g = new Geometry();
    g.cellList = cells;
    return g;
  }
}
