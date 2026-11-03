// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { AIR, UNSET, Volume, VolumeError } from "../src/index.ts";

describe("Volume", () => {
  it("reads back what was set, across sections and negative coordinates", () => {
    const v = new Volume();
    const cells: [number, number, number, string][] = [
      [0, 0, 0, "minecraft:stone"],
      [15, 15, 15, "minecraft:dirt"],
      [16, 16, 16, "minecraft:stone"],
      [-1, -1, -1, "minecraft:glass"],
      [-17, 40, 300, "minecraft:dirt"],
    ];
    for (const [x, y, z, b] of cells) v.set(x, y, z, b);
    for (const [x, y, z, b] of cells) expect(v.get(x, y, z)).toBe(b);
    expect(v.get(1, 1, 1)).toBeUndefined();
    expect(v.indexAt(1, 1, 1)).toBe(UNSET);
    expect(v.size).toBe(5);
    expect(v.palette).toEqual(["minecraft:stone", "minecraft:dirt", "minecraft:glass"]);
  });

  it("lets the last write win without double counting", () => {
    const v = new Volume();
    v.set(2, 2, 2, "minecraft:stone");
    v.set(2, 2, 2, "minecraft:dirt");
    expect(v.get(2, 2, 2)).toBe("minecraft:dirt");
    expect(v.size).toBe(1);
  });

  it("rejects coordinates that are not 32-bit integers", () => {
    const v = new Volume();
    expect(() => v.set(0.5, 0, 0, "minecraft:stone")).toThrow(VolumeError);
    expect(() => v.set(0, Number.NaN, 0, "minecraft:stone")).toThrow(VolumeError);
    expect(() => v.set(0, 0, 2 ** 40, "minecraft:stone")).toThrow(VolumeError);
  });

  it("keeps air out of bounds() but inside placedBounds()", () => {
    const v = new Volume();
    v.set(1, 1, 1, "minecraft:stone");
    v.set(5, 0, 0, AIR);
    expect(v.bounds()).toEqual([
      [1, 1, 1],
      [1, 1, 1],
    ]);
    expect(v.placedBounds()).toEqual([
      [1, 0, 0],
      [5, 1, 1],
    ]);
    expect(v.countNonAir()).toBe(1);
    expect(new Volume().bounds()).toBeNull();
  });

  it("makes an empty dense volume", () => {
    const d = new Volume().toDense();
    expect(d.size).toEqual([0, 0, 0]);
    expect(d.data).toHaveLength(0);
  });

  it("densifies x-major with unset cells and compacts the palette", () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:glass"); // overwritten below, leaves no references
    v.set(0, 0, 0, "minecraft:stone");
    v.set(1, 0, 2, "minecraft:dirt");
    const d = v.toDense();
    expect(d.size).toEqual([2, 1, 3]);
    expect(d.origin).toEqual([0, 0, 0]);
    expect(d.palette).toEqual(["minecraft:stone", "minecraft:dirt"]);
    expect(Array.from(d.data)).toEqual([0, -1, -1, -1, -1, 1]);
  });

  it("offsets dense data by the bounding-box minimum", () => {
    const v = new Volume();
    v.set(-2, 3, 5, "minecraft:stone");
    v.set(0, 4, 6, "minecraft:stone");
    const d = v.toDense();
    expect(d.origin).toEqual([-2, 3, 5]);
    expect(d.size).toEqual([3, 2, 2]);
    expect(d.data[0]).toBe(0);
    expect(d.data[(2 * 2 + 1) * 2 + 1]).toBe(0);
  });

  it("unsets cells and keeps counts right", () => {
    const v = new Volume();
    v.set(1, 2, 3, "minecraft:stone");
    v.set(20, 2, 3, "minecraft:dirt");
    expect(v.unset(1, 2, 3)).toBe(true);
    expect(v.unset(1, 2, 3)).toBe(false);
    expect(v.unset(99, 99, 99)).toBe(false);
    expect(v.get(1, 2, 3)).toBeUndefined();
    expect(v.size).toBe(1);
    expect(v.bounds()).toEqual([
      [20, 2, 3],
      [20, 2, 3],
    ]);
  });

  it("translates every cell and keeps the palette", () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    v.set(15, 15, 15, "minecraft:dirt");
    v.translate(-1, 1, 17);
    expect(v.get(-1, 1, 17)).toBe("minecraft:stone");
    expect(v.get(14, 16, 32)).toBe("minecraft:dirt");
    expect(v.get(0, 0, 0)).toBeUndefined();
    expect(v.size).toBe(2);
    expect(v.palette).toEqual(["minecraft:stone", "minecraft:dirt"]);
  });
});
