// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { patches, resolveMaterial, sha256, unitHash } from "../src/index.ts";
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
});
