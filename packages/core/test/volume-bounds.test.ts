// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  type Bounds,
  CommandBuilder,
  EditError,
  Editor,
  MAX_EXTENT,
  UNSET,
  Volume,
} from "../src/index.ts";

const STONE = "minecraft:stone";
const AIR = "minecraft:air";

/** Small seeded generator (mulberry32) so a failure replays. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bounds recomputed from scratch by visiting every cell. */
function scan(v: Volume): Bounds | null {
  let min: [number, number, number] | null = null;
  let max: [number, number, number] | null = null;
  v.eachCell((x, y, z) => {
    if (min === null || max === null) {
      min = [x, y, z];
      max = [x, y, z];
      return;
    }
    min = [Math.min(min[0], x), Math.min(min[1], y), Math.min(min[2], z)];
    max = [Math.max(max[0], x), Math.max(max[1], y), Math.max(max[2], z)];
  });
  return min === null || max === null ? null : [min, max];
}

describe("Volume.placedBounds cache", () => {
  it("tracks sets, overwrites, unsets and an emptied volume", () => {
    const v = new Volume();
    expect(v.placedBounds()).toBeNull();
    v.set(5, 5, 5, STONE);
    expect(v.placedBounds()).toEqual([
      [5, 5, 5],
      [5, 5, 5],
    ]);
    v.set(-3, 7, 0, AIR);
    v.set(5, 5, 5, STONE);
    expect(v.placedBounds()).toEqual([
      [-3, 5, 0],
      [5, 7, 5],
    ]);
    // Unsetting an interior cell keeps the box; unsetting a face cell shrinks it.
    v.set(0, 6, 2, STONE);
    v.unset(0, 6, 2);
    expect(v.placedBounds()).toEqual([
      [-3, 5, 0],
      [5, 7, 5],
    ]);
    v.unset(-3, 7, 0);
    expect(v.placedBounds()).toEqual([
      [5, 5, 5],
      [5, 5, 5],
    ]);
    v.unset(5, 5, 5);
    expect(v.placedBounds()).toBeNull();
    v.set(1, 2, 3, STONE);
    expect(v.placedBounds()).toEqual([
      [1, 2, 3],
      [1, 2, 3],
    ]);
  });

  it("follows translate and setIndex(UNSET)", () => {
    const v = new Volume();
    v.set(0, 0, 0, STONE);
    v.set(4, 4, 4, STONE);
    v.translate(10, -2, 3);
    expect(v.placedBounds()).toEqual([
      [10, -2, 3],
      [14, 2, 7],
    ]);
    v.setIndex(14, 2, 7, UNSET);
    expect(v.placedBounds()).toEqual([
      [10, -2, 3],
      [10, -2, 3],
    ]);
  });

  it("equals a full recomputation after random set, unset, edit, undo and redo", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const rand = rng(seed);
      const int = (n: number): number => Math.floor(rand() * n);
      const coord = (): number => int(41) - 20;
      const blocks = [STONE, AIR, "minecraft:dirt"];
      const v = new Volume();
      const editor = new Editor(v);
      const check = (what: string): void => {
        expect(v.placedBounds(), `seed ${seed} after ${what}`).toEqual(scan(v));
      };
      for (let step = 0; step < 300; step++) {
        const r = rand();
        if (r < 0.2) {
          v.set(coord(), coord(), coord(), blocks[int(3)] as string);
          check("set");
        } else if (r < 0.35) {
          v.unset(coord(), coord(), coord());
          check("unset");
        } else if (r < 0.65) {
          const b = new CommandBuilder(v, "edit", { maxExtent: 1000 });
          const n = 1 + int(12);
          for (let i = 0; i < n; i++) {
            if (rand() < 0.4) b.unset(coord(), coord(), coord());
            else b.setBlock(coord(), coord(), coord(), blocks[int(3)] as string);
          }
          editor.run(b.finish());
          check("command");
        } else if (r < 0.85) {
          // Erase the cells on one face of the box: forces the stale path.
          const bb = v.placedBounds();
          if (bb !== null) {
            const axis = int(3);
            const side = int(2);
            const b = new CommandBuilder(v, "face", { maxExtent: 1000 });
            const plane = (bb[side] as readonly number[])[axis] as number;
            v.eachCell((x, y, z) => {
              if ([x, y, z][axis] === plane) b.unset(x, y, z);
            });
            editor.run(b.finish());
            check("face erase");
          }
        } else if (r < 0.93) {
          editor.undo();
          check("undo");
        } else if (r < 0.99) {
          editor.redo();
          check("redo");
        } else {
          v.translate(int(9) - 4, int(9) - 4, int(9) - 4);
          check("translate");
        }
      }
      while (editor.undo()) check("undo all");
      while (editor.redo()) check("redo all");
    }
  });
});

describe("CommandBuilder growth check", () => {
  it("refuses to grow past 512 and still allows growth up to it", () => {
    const v = new Volume();
    v.set(0, 0, 0, STONE);
    v.set(511, 0, 0, STONE);
    const grow = (x: number, y: number, z: number): void => {
      const b = new CommandBuilder(v, "grow");
      b.setBlock(x, y, z, STONE);
      b.finish();
    };
    expect(MAX_EXTENT).toBe(512);
    expect(() => grow(512, 0, 0)).toThrow(/513 blocks long along x.*limit is 512/);
    expect(() => grow(-1, 0, 0)).toThrow(EditError);
    expect(() => grow(0, 0, 511)).not.toThrow();
    expect(() => grow(0, 0, 512)).toThrow(/along z/);
  });

  it("agrees with a brute-force model on random edits under a small limit", () => {
    const limit = 12;
    for (const seed of [11, 12, 13, 14, 15, 16]) {
      const rand = rng(seed);
      const int = (n: number): number => Math.floor(rand() * n);
      const coord = (): number => int(17) - 8;
      const v = new Volume();
      const editor = new Editor(v);
      const model = new Map<string, [number, number, number]>();
      for (let step = 0; step < 200; step++) {
        if (rand() < 0.15) {
          if (rand() < 0.5) editor.undo();
          else editor.redo();
          model.clear();
          v.eachCell((x, y, z) => model.set(`${x},${y},${z}`, [x, y, z]));
          continue;
        }
        const b = new CommandBuilder(v, "edit", { maxExtent: limit });
        const edits: [number, number, number, boolean][] = [];
        // Mostly small clusters near the box so some pass and some fail.
        const n = 1 + int(5);
        for (let i = 0; i < n; i++) {
          const e: [number, number, number, boolean] = [coord(), coord(), coord(), rand() < 0.4];
          edits.push(e);
          if (e[3]) b.unset(e[0], e[1], e[2]);
          else b.setBlock(e[0], e[1], e[2], STONE);
        }
        // Expected: apply the edits in order to a copy of the model.
        const after = new Map(model);
        for (const [x, y, z, un] of edits) {
          const key = `${x},${y},${z}`;
          if (un) after.delete(key);
          else {
            after.set(key, [x, y, z]);
          }
        }
        // A cell set then unset (or the reverse) in one command nets out.
        const grows = [...after.keys()].some((k) => !model.has(k));
        const extent = (cells: Iterable<[number, number, number]>): number[] => {
          const lo = [Infinity, Infinity, Infinity];
          const hi = [-Infinity, -Infinity, -Infinity];
          let any = false;
          for (const c of cells) {
            any = true;
            for (let a = 0; a < 3; a++) {
              lo[a] = Math.min(lo[a] as number, c[a] as number);
              hi[a] = Math.max(hi[a] as number, c[a] as number);
            }
          }
          return any ? [0, 1, 2].map((a) => (hi[a] as number) - (lo[a] as number) + 1) : [0, 0, 0];
        };
        const was = extent(model.values());
        const will = extent(after.values());
        const refuse =
          grows &&
          [0, 1, 2].some(
            (a) => (will[a] as number) > limit && (will[a] as number) > (was[a] as number),
          );
        if (refuse) {
          expect(() => b.finish(), `seed ${seed} step ${step}`).toThrow(EditError);
        } else {
          editor.run(b.finish());
          model.clear();
          for (const [k, c] of after) model.set(k, c);
        }
        expect(v.placedBounds()).toEqual(scan(v));
      }
    }
  });
});
