// SPDX-License-Identifier: AGPL-3.0-only
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  blockQuads,
  buildFaceTextures,
  fallbackColor,
  type Quad,
  type Rgb,
  splitBlockstate,
} from "../src/index.ts";
import { directoryAssets } from "../src/node/index.ts";

interface QuadWant {
  points: number[][];
  normal: number[];
  cull: number[] | null;
  flat: boolean;
  image: { size: [number, number]; mode: string; sha256: string };
}
const vectors = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../vectors/quads.json", import.meta.url)), "utf8"),
) as {
  blocks: Record<
    string,
    {
      fallback_color: Rgb;
      fallback_blocks: string[];
      is_fallback: boolean;
      quads: QuadWant[];
      face_textures: Record<string, { size: [number, number]; mode: string; sha256: string }>;
      face_fallback: string[];
    }
  >;
};

// The vanilla client assets are Mojang's, so they are fetched, never committed:
//   node packages/mcbuilder/bin/mcbuild.ts assets fetch --version 26.2
// Point VOXWRIGHT_ASSETS at the `assets/minecraft` folder to use another copy.
const root =
  process.env.VOXWRIGHT_ASSETS ?? join(homedir(), ".cache/mcbuilder/26.2/client/assets/minecraft");
const have = existsSync(join(root, "blockstates"));

const near = (a: readonly number[], b: readonly number[]): void => {
  expect(a.length).toBe(b.length);
  for (const [i, v] of a.entries()) expect(Math.abs(v - (b[i] as number))).toBeLessThan(1e-9);
};

describe.skipIf(!have)("model quads against the Python renderer (vanilla assets)", () => {
  const assets = directoryAssets(root);

  for (const [canonical, want] of Object.entries(vectors.blocks)) {
    // For these, the original picks "any usable texture" from a set, in hash order, so which
    // of several textures it picks cannot be reproduced. The port takes the first in model order.
    const hashOrderDependent = ["glass_pane", "lever", "flower_pot"].some((n) =>
      canonical.includes(`minecraft:${n}`),
    );
    it.skipIf(hashOrderDependent)(`${canonical} as a textured cube`, () => {
      const fb = new Set<string>();
      const faces = buildFaceTextures(canonical, assets, fb);
      expect([...fb].sort()).toEqual(want.face_fallback);
      for (const [face, w] of Object.entries(want.face_textures)) {
        const img = faces[face as keyof typeof faces];
        expect([img.width, img.height], `${face} size`).toEqual(w.size);
        expect(img.channels === 3 ? "RGB" : "RGBA").toBe(w.mode);
        expect(createHash("sha256").update(img.data).digest("hex"), `${face} pixels`).toBe(
          w.sha256,
        );
      }
    });

    it(canonical, () => {
      const [name] = splitBlockstate(canonical);
      const fallback = new Set<string>();
      expect(fallbackColor(name)).toEqual(want.fallback_color);
      const got = blockQuads(canonical, assets, fallback);
      expect([...fallback].sort()).toEqual(want.fallback_blocks);
      expect(got.isFallback).toBe(want.is_fallback);
      const quads: Quad[] = got.quads;
      expect(quads.length).toBe(want.quads.length);
      quads.forEach((q, i) => {
        const w = want.quads?.[i] as QuadWant;
        for (const [k, p] of q.points.entries()) near(p, w.points[k] as number[]);
        near(q.normal, w.normal);
        expect(q.cull).toEqual(w.cull);
        expect(q.flat).toBe(w.flat);
        expect([q.image.width, q.image.height]).toEqual(w.image.size);
        expect(q.image.channels === 3 ? "RGB" : "RGBA").toBe(w.image.mode);
        expect(createHash("sha256").update(q.image.data).digest("hex"), `quad ${i} pixels`).toBe(
          w.image.sha256,
        );
      });
    });
  }
});

describe("model quads without assets", () => {
  it("lists the blockstates the vectors cover", () => {
    expect(Object.keys(vectors.blocks).length).toBeGreaterThan(50);
    expect(vectors.blocks["minecraft:not_a_real_block"]?.is_fallback).toBe(true);
  });
  it("splits canonical blockstates", () => {
    expect(splitBlockstate("minecraft:oak_log[axis=y]")).toEqual([
      "minecraft:oak_log",
      { axis: "y" },
    ]);
    expect(splitBlockstate("minecraft:chest[facing=west]{Items:[]}")).toEqual([
      "minecraft:chest",
      { facing: "west" },
    ]);
    expect(splitBlockstate("minecraft:stone")).toEqual(["minecraft:stone", {}]);
  });
});
