// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { gradient, patches, resolveMaterial, sha256, unitHash } from "../src/index.ts";
import { expectError, loadVector, type MaterialSpec, material } from "./helpers.ts";

interface Vectors {
  hashes: { key: unknown[]; result: number }[];
  palettes: Record<string, MaterialSpec>;
  picks: {
    palette: string;
    seed: number | string | null;
    at: [number, number, number];
    result: string;
  }[];
  plain: { spec: MaterialSpec; at?: [number, number, number]; result: string }[];
  patches: {
    patches: { palette: (string | [string, number])[]; scale?: number; salt?: string };
    grid: [number, number, number, string][];
  }[];
  errors: { name: string; spec?: unknown[]; error: string }[];
}

const v = loadVector<Vectors>("materials.json");

describe("sha256", () => {
  const hex = (s: string) =>
    Array.from(sha256(new TextEncoder().encode(s)), (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );

  it("matches the published test vectors", () => {
    expect(hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
    // Crosses the 55/56-byte padding boundary and several blocks.
    expect(hex("a".repeat(55))).toBe(
      "9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318",
    );
    expect(hex("a".repeat(1000))).toBe(
      "41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3",
    );
  });
});

describe("materials against the Python oracle", () => {
  it("hashes keys to the same unit floats", () => {
    expect(v.hashes.length).toBeGreaterThan(3);
    for (const h of v.hashes) expect(unitHash(...h.key)).toBe(h.result);
  });

  it("picks from weighted palettes the same way", () => {
    expect(v.picks.length).toBeGreaterThan(200);
    for (const p of v.picks) {
      const spec = material(v.palettes[p.palette] as MaterialSpec);
      expect(resolveMaterial(spec, ...p.at, p.seed), JSON.stringify(p)).toBe(p.result);
    }
  });

  it("resolves plain strings and functions", () => {
    for (const p of v.plain) {
      expect(resolveMaterial(material(p.spec), ...(p.at ?? [0, 0, 0]))).toBe(p.result);
    }
  });

  it("picks patches the same way", () => {
    for (const c of v.patches) {
      const fn = patches(c.patches.palette, { scale: c.patches.scale, salt: c.patches.salt });
      for (const [x, y, z, want] of c.grid) expect(fn(x, y, z), `${x},${y},${z}`).toBe(want);
    }
  });

  it("rejects bad specs the way Python does", () => {
    for (const e of v.errors) {
      if (e.name === "patches-scale-zero") {
        expectError(() => patches(["a"], { scale: 0 }), e.error);
      } else {
        const spec = e.spec as (string | [string, number])[];
        expectError(() => resolveMaterial(spec, 0, 0, 0, 1), e.error);
      }
    }
  });

  it("treats a missing seed like Python's None", () => {
    const spec = ["minecraft:a", "minecraft:b"];
    expect(resolveMaterial(spec, 1, 2, 3)).toBe(resolveMaterial(spec, 1, 2, 3, null));
  });

  it("supports an optional patches() seed while keeping unseeded calls identical", () => {
    const palette = ["minecraft:stone", "minecraft:andesite", "minecraft:cobblestone"];
    const base = patches(palette, { scale: 2, salt: "wall" });
    const withUndef = patches(palette, { scale: 2, salt: "wall", seed: undefined });
    const withNull = patches(palette, { scale: 2, salt: "wall", seed: null });
    const withSeed0 = patches(palette, { scale: 2, salt: "wall", seed: 0 });
    const withSeed0Again = patches(palette, { scale: 2, salt: "wall", seed: 0 });
    const withSeed1 = patches(palette, { scale: 2, salt: "wall", seed: 1 });
    const withSeedStr = patches(palette, { scale: 2, salt: "wall", seed: "alpha" });

    const sample = (fn: (x: number, y: number, z: number) => string) => {
      const out: string[] = [];
      for (let x = 0; x < 12; x += 2) {
        for (let z = 0; z < 12; z += 2) out.push(fn(x, 0, z));
      }
      return out;
    };

    const unseeded = sample(base);
    expect(sample(withUndef)).toEqual(unseeded);
    expect(sample(withNull)).toEqual(unseeded);
    expect(sample(withSeed0)).toEqual(sample(withSeed0Again));
    expect(sample(withSeed0)).not.toEqual(unseeded);
    expect(sample(withSeed0)).not.toEqual(sample(withSeed1));
    expect(sample(withSeed1)).not.toEqual(sample(withSeedStr));
  });
});

describe("gradient", () => {
  const A = "minecraft:black_concrete";
  const B = "minecraft:gray_concrete";
  const C = "minecraft:white_concrete";

  it("puts the first stop at from and the last at to, and clamps past the ends", () => {
    const g = gradient([A, B, C], { from: 0, to: 10 });
    expect(g(0, 0, 0)).toBe(A);
    expect(g(3, -5, 7)).toBe(A);
    expect(g(0, 10, 0)).toBe(C);
    expect(g(0, 99, 0)).toBe(C);
    // Halfway sits on the middle stop exactly.
    expect(g(4, 5, 1)).toBe(B);
  });

  it("makes hard bands with blend 0 and mixes cells with blend 1", () => {
    const hard = gradient([A, C], { from: 0, to: 10, blend: 0 });
    expect([4, 5, 6].map((y) => hard(0, y, 0))).toEqual([A, C, C]);
    const soft = gradient([A, C], { from: 0, to: 10 });
    // Around the middle both stops appear; near the ends only one.
    const row = (y: number) => new Set(Array.from({ length: 40 }, (_, x) => soft(x, y, 0)));
    expect(row(5)).toEqual(new Set([A, C]));
    expect(row(0)).toEqual(new Set([A]));
    const share = (y: number) =>
      Array.from({ length: 400 }, (_, x) => soft(x, y, 0)).filter((b) => b === C).length;
    expect(share(3)).toBeLessThan(share(7));
  });

  it("runs along x or z, and resolves palette and function stops", () => {
    const gx = gradient([A, C], { axis: "x", from: 0, to: 1, blend: 0 });
    expect([gx(0, 9, 9), gx(1, 9, 9)]).toEqual([A, C]);
    const gz = gradient([A, (x: number) => (x % 2 ? B : C)], {
      axis: "z",
      from: 0,
      to: 1,
      blend: 0,
    });
    expect([gz(0, 0, 1), gz(1, 0, 1)]).toEqual([C, B]);
    const gp = gradient([[A, [B, 0]]], { from: 0, to: 1 });
    expect(gp(5, 5, 5)).toBe(A);
  });

  it("is stable per cell and changes with the salt", () => {
    const g1 = gradient([A, B, C], { from: 0, to: 20 });
    const g2 = gradient([A, B, C], { from: 0, to: 20, salt: "other" });
    const cells = Array.from({ length: 200 }, (_, i) => [i % 13, i % 20, i] as const);
    expect(cells.map(([x, y, z]) => g1(x, y, z))).toEqual(cells.map(([x, y, z]) => g1(x, y, z)));
    expect(cells.map(([x, y, z]) => g1(x, y, z))).not.toEqual(
      cells.map(([x, y, z]) => g2(x, y, z)),
    );
  });

  it("refuses bad options", () => {
    expect(() => gradient([], { from: 0, to: 1 })).toThrow(/at least one stop/);
    expect(() => gradient([A], { from: 0, to: 1, axis: "w" as "x" })).toThrow(/axis must be/);
    expect(() => gradient([A], { from: Number.NaN, to: 1 })).toThrow(/from and to must be numbers/);
    expect(() => gradient([A], { from: 0, to: 1, blend: 2 })).toThrow(
      /blend must be between 0 and 1/,
    );
  });
});
