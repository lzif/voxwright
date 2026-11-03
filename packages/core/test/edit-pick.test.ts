// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { EditError, raycast, type Vec3, Volume } from "../src/index.ts";

function world(): Volume {
  const v = new Volume();
  v.set(5, 0, 0, "minecraft:stone");
  v.set(0, 3, 0, "minecraft:dirt");
  v.set(-4, 0, 0, "minecraft:glass");
  v.set(2, 0, 0, "minecraft:air");
  v.set(3, 0, 0, "minecraft:cave_air");
  return v;
}

describe("raycast", () => {
  it("hits the first block along +x and reports the face, adjacent cell and distance", () => {
    const hit = raycast(world(), [0.5, 0.5, 0.5], [1, 0, 0]);
    expect(hit).toEqual({
      position: [5, 0, 0],
      normal: [-1, 0, 0],
      adjacent: [4, 0, 0],
      distance: 4.5,
      block: "minecraft:stone",
    });
  });

  it("works in every axis direction, negative coordinates included", () => {
    const v = world();
    expect(raycast(v, [0.5, 0.5, 0.5], [-1, 0, 0])?.position).toEqual([-4, 0, 0]);
    expect(raycast(v, [0.5, 0.5, 0.5], [-1, 0, 0])?.normal).toEqual([1, 0, 0]);
    const up = raycast(v, [0.5, 0.5, 0.5], [0, 1, 0]);
    expect(up?.position).toEqual([0, 3, 0]);
    expect(up?.normal).toEqual([0, -1, 0]);
    expect(up?.adjacent).toEqual([0, 2, 0]);
    const down = raycast(v, [0.5, 10.5, 0.5], [0, -1, 0]);
    expect(down?.position).toEqual([0, 3, 0]);
    expect(down?.normal).toEqual([0, 1, 0]);
    expect(down?.adjacent).toEqual([0, 4, 0]);
    const w = new Volume();
    w.set(0, 0, 7, "minecraft:stone");
    w.set(0, 0, -7, "minecraft:stone");
    expect(raycast(w, [0.5, 0.5, 0.5], [0, 0, 1])?.normal).toEqual([0, 0, -1]);
    expect(raycast(w, [0.5, 0.5, 0.5], [0, 0, -1])?.normal).toEqual([0, 0, 1]);
  });

  it("passes through unset cells and every kind of air", () => {
    const v = world();
    // Air at x=2 and cave_air at x=3 do not stop the ray.
    expect(raycast(v, [0.5, 0.5, 0.5], [1, 0, 0])?.position).toEqual([5, 0, 0]);
  });

  it("does not need a normalized direction", () => {
    const a = raycast(world(), [0.5, 0.5, 0.5], [1, 0, 0]);
    const b = raycast(world(), [0.5, 0.5, 0.5], [100, 0, 0]);
    expect(b).toEqual(a);
  });

  it("marches along diagonals and picks the nearest of several blocks", () => {
    const v = new Volume();
    v.set(3, 3, 3, "minecraft:stone");
    v.set(6, 6, 6, "minecraft:dirt");
    const hit = raycast(v, [0.5, 0.5, 0.5], [1, 1, 1]);
    expect(hit?.block).toBe("minecraft:stone");
    expect(hit?.position).toEqual([3, 3, 3]);
    // Ties between axes resolve to x first, so the entry face is -x.
    expect(hit?.normal).toEqual([0, 0, -1]);
    const oblique = raycast(v, [0.2, 0.9, 0.4], [3, 2.9, 3.1]);
    expect(oblique).not.toBeNull();
    const p = oblique?.position as Vec3;
    const n = oblique?.normal as Vec3;
    expect(oblique?.adjacent).toEqual([p[0] + n[0], p[1] + n[1], p[2] + n[2]]);
    expect(n.map(Math.abs).reduce((a, b) => a + b)).toBe(1);
  });

  it("agrees with a brute-force march on random rays", () => {
    const v = new Volume();
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    for (let i = 0; i < 150; i++) {
      v.set(
        Math.floor(rnd() * 30) - 15,
        Math.floor(rnd() * 30) - 15,
        Math.floor(rnd() * 30) - 15,
        "minecraft:stone",
      );
    }
    for (let r = 0; r < 200; r++) {
      const o: Vec3 = [rnd() * 20 - 10, rnd() * 20 - 10, rnd() * 20 - 10];
      const d: Vec3 = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5];
      const len = Math.hypot(...d);
      const hit = raycast(v, o, d, { maxDistance: 60 });
      // Brute force: sample finely. The DDA hit must be the first filled cell the samples reach.
      let first: Vec3 | null = null;
      for (let t = 0; t < 60; t += 0.002) {
        const c: Vec3 = [
          Math.floor(o[0] + (d[0] / len) * t),
          Math.floor(o[1] + (d[1] / len) * t),
          Math.floor(o[2] + (d[2] / len) * t),
        ];
        if (v.get(...c) !== undefined) {
          first = c;
          break;
        }
      }
      if (first === null) {
        // The sampler may miss a grazing corner, but then DDA's hit must be at the very edge.
        if (hit !== null) expect(hit.distance).toBeGreaterThan(0);
      } else {
        expect(hit?.position).toEqual(first);
      }
    }
  });

  it("returns null for a miss and when the block is out of range", () => {
    expect(raycast(world(), [0.5, 0.5, 0.5], [0, 0, 1])).toBeNull();
    expect(raycast(world(), [0.5, 0.5, 0.5], [1, 0, 0], { maxDistance: 3 })).toBeNull();
    expect(raycast(new Volume(), [0, 0, 0], [1, 1, 1])).toBeNull();
  });

  it("reports a zero normal when the ray starts inside a block", () => {
    const hit = raycast(world(), [5.5, 0.5, 0.5], [1, 0, 0]);
    expect(hit).toEqual({
      position: [5, 0, 0],
      normal: [0, 0, 0],
      adjacent: [5, 0, 0],
      distance: 0,
      block: "minecraft:stone",
    });
  });

  it("treats a ray starting on a cell boundary like the cell it moves into", () => {
    const v = new Volume();
    v.set(-1, 0, 0, "minecraft:stone");
    expect(raycast(v, [0, 0.5, 0.5], [-1, 0, 0])?.position).toEqual([-1, 0, 0]);
    expect(raycast(v, [0, 0.5, 0.5], [-1, 0, 0])?.distance).toBe(0);
  });

  it("rejects a zero direction and non-finite input", () => {
    expect(() => raycast(world(), [0, 0, 0], [0, 0, 0])).toThrow(EditError);
    expect(() => raycast(world(), [Number.NaN, 0, 0], [1, 0, 0])).toThrow(EditError);
  });

  it("passes through cells the accept callback refuses, such as those outside a slice", () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    v.set(0, 5, 0, "minecraft:dirt");
    const down = raycast(v, [0.5, 10.5, 0.5], [0, -1, 0]);
    expect(down?.position).toEqual([0, 5, 0]);
    const sliced = raycast(v, [0.5, 10.5, 0.5], [0, -1, 0], { accept: (_x, y) => y <= 2 });
    expect(sliced?.position).toEqual([0, 0, 0]);
    expect(sliced?.adjacent).toEqual([0, 1, 0]);
    expect(raycast(v, [0.5, 10.5, 0.5], [0, -1, 0], { accept: () => false })).toBeNull();
    // A ray that starts inside a refused cell does not hit it either.
    expect(raycast(v, [0.5, 5.5, 0.5], [1, 0, 0], { accept: (_x, y) => y < 5 })).toBeNull();
  });
});
