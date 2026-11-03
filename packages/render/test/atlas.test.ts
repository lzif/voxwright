// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  buildAtlas,
  classifyTexture,
  crop,
  fromRgba,
  type RasterImage,
  TEXTURE_CUTOUT,
  TEXTURE_OPAQUE,
  TEXTURE_TRANSLUCENT,
} from "../src/index.ts";
import { patternTexture } from "./mesh-helpers.ts";

const source = (textures: Record<string, RasterImage>) => ({
  readJson: () => null,
  texture: (id: string) => textures[id] ?? null,
});

describe("texture atlas", () => {
  const textures = {
    "block/a": patternTexture(1),
    "block/b": patternTexture(2, "cutout"),
    "block/c": patternTexture(3, "glass"),
    "entity/big": fromRgba(64, 64, new Uint8Array(64 * 64 * 4).fill(200)),
  };

  it("packs every texture at its own position with the pixels intact", () => {
    const atlas = buildAtlas(Object.keys(textures), source(textures));
    expect(Object.keys(atlas.entries).sort()).toEqual(Object.keys(textures).sort());
    for (const [id, img] of Object.entries(textures)) {
      const e = atlas.entries[id];
      expect([e?.w, e?.h]).toEqual([img.width, img.height]);
      for (let y = 0; y < img.height; y++)
        for (let x = 0; x < img.width; x++) {
          const a = (((e?.y ?? 0) + y) * atlas.width + (e?.x ?? 0) + x) * 4;
          const s = (y * img.width + x) * img.channels;
          expect(atlas.data[a]).toBe(img.data[s]);
          expect(atlas.data[a + 3]).toBe(img.channels === 4 ? img.data[s + 3] : 255);
        }
    }
  });

  it("never overlaps tiles, gutters included, and stays a power of two", () => {
    const atlas = buildAtlas(Object.keys(textures), source(textures));
    expect(Math.log2(atlas.width) % 1).toBe(0);
    expect(Math.log2(atlas.height) % 1).toBe(0);
    const owner = new Map<number, string>();
    for (const [id, e] of Object.entries(atlas.entries))
      for (let y = e.y - 1; y < e.y + e.h + 1; y++)
        for (let x = e.x - 1; x < e.x + e.w + 1; x++) {
          const k = y * atlas.width + x;
          expect(owner.get(k), `texel ${x},${y} of ${id}`).toBeUndefined();
          owner.set(k, id);
        }
  });

  it("extrudes the edge texels into the gutter", () => {
    const atlas = buildAtlas(["block/a"], source(textures));
    const e = atlas.entries["block/a"];
    const at = (x: number, y: number) => [
      ...atlas.data.subarray((y * atlas.width + x) * 4, (y * atlas.width + x) * 4 + 4),
    ];
    expect(at((e?.x ?? 0) - 1, e?.y ?? 0)).toEqual(at(e?.x ?? 0, e?.y ?? 0));
    expect(at((e?.x ?? 0) + (e?.w ?? 0), (e?.y ?? 0) + 5)).toEqual(
      at((e?.x ?? 0) + (e?.w ?? 0) - 1, (e?.y ?? 0) + 5),
    );
  });

  it("gives the same atlas for the same textures in any order, and skips missing ones", () => {
    const ids = Object.keys(textures);
    const a = buildAtlas(ids, source(textures));
    const b = buildAtlas([...ids].reverse().concat("block/missing"), source(textures));
    expect(b.entries).toEqual(a.entries);
    expect(Array.from(b.data)).toEqual(Array.from(a.data));
    expect(b.entries["block/missing"]).toBeUndefined();
  });

  it("has an opaque white texel for flat colours", () => {
    const atlas = buildAtlas(["block/a"], source(textures));
    const x = Math.floor(atlas.whiteU * atlas.width);
    const y = Math.floor(atlas.whiteV * atlas.height);
    expect([
      ...atlas.data.subarray((y * atlas.width + x) * 4, (y * atlas.width + x) * 4 + 4),
    ]).toEqual([255, 255, 255, 255]);
  });

  it("classifies by alpha: opaque, cutout, translucent", () => {
    expect(classifyTexture(textures["block/a"])).toBe(TEXTURE_OPAQUE);
    expect(classifyTexture(textures["block/b"])).toBe(TEXTURE_CUTOUT);
    expect(classifyTexture(textures["block/c"])).toBe(TEXTURE_TRANSLUCENT);
    const atlas = buildAtlas(Object.keys(textures), source(textures));
    expect(atlas.entries["block/c"]?.kind).toBe(TEXTURE_TRANSLUCENT);
  });

  it("takes the first frame of an animated strip when the source crops it", () => {
    // The asset sources crop animated strips by default; the atlas stores what they give it.
    const strip = fromRgba(
      16,
      48,
      Uint8Array.from({ length: 16 * 48 * 4 }, (_, i) => (i >> 10) * 80 + 10),
    );
    const first = crop(strip, 0, 0, 16, 16);
    const atlas = buildAtlas(["block/fire"], source({ "block/fire": first }));
    expect(atlas.entries["block/fire"]).toMatchObject({ w: 16, h: 16 });
  });
});
