// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { buildPack, mergePacks, type Pack, packPath, summarize } from "../src/lib/pack-extract.ts";
import { PackError, readPackZip } from "../src/lib/pack-zip.ts";
import { PACK_COLORS, syntheticPackZip } from "./synthetic-pack.ts";

describe("packPath", () => {
  it("keeps the paths the viewer reads, relative to assets/minecraft", () => {
    expect(packPath("assets/minecraft/blockstates/stone.json")).toBe("blockstates/stone.json");
    expect(packPath("assets/minecraft/models/block/a/b.json")).toBe("models/block/a/b.json");
    expect(packPath("assets/minecraft/textures/block/stone.png")).toBe("textures/block/stone.png");
    expect(packPath("assets/minecraft/textures/block/x.png.mcmeta")).toBe(
      "textures/block/x.png.mcmeta",
    );
    expect(packPath("assets/minecraft/textures/entity/chest/normal.png")).toBe(
      "textures/entity/chest/normal.png",
    );
    expect(packPath("assets/minecraft/textures/entity/banner/base.png")).toBe(
      "textures/entity/banner/base.png",
    );
  });

  it("accepts a folder around the pack and backslashes, and drops what is not used", () => {
    expect(packPath("MyPack/assets/minecraft/blockstates/stone.json")).toBe(
      "blockstates/stone.json",
    );
    expect(packPath("assets\\minecraft\\blockstates\\stone.json")).toBe("blockstates/stone.json");
    expect(packPath("assets/minecraft/lang/en_us.json")).toBeNull();
    expect(packPath("assets/minecraft/textures/gui/icons.png")).toBeNull();
    expect(packPath("assets/minecraft/models/item/apple.json")).toBeNull();
    expect(packPath("assets/other/blockstates/stone.json")).toBeNull();
    expect(packPath("__MACOSX/MyPack/assets/minecraft/blockstates/stone.json")).toBeNull();
    expect(packPath("xassets/minecraft/blockstates/stone.json")).toBeNull();
  });
});

describe("buildPack", () => {
  it("parses JSON, base64-encodes textures and finds the animated ones", () => {
    const enc = new TextEncoder();
    const files = new Map<string, Uint8Array>([
      ["blockstates/a.json", enc.encode('﻿{"variants":{}}')],
      ["blockstates/bad.json", enc.encode("{")],
      ["textures/block/a.png", Uint8Array.of(137, 80, 78, 71)],
      ["textures/block/anim.png", Uint8Array.of(1, 2, 3)],
      ["textures/block/anim.png.mcmeta", enc.encode('{"animation":{}}')],
      ["textures/block/still.png", Uint8Array.of(4)],
      ["textures/block/still.png.mcmeta", enc.encode('{"texture":{}}')],
      ["textures/block/orphan.png.mcmeta", enc.encode('{"animation":{}}')],
      ["textures/gui/x.png", Uint8Array.of(9)],
    ]);
    const { pack, skipped } = buildPack(files);
    expect(Object.keys(pack.json)).toEqual(["blockstates/a.json"]);
    expect(pack.json["blockstates/a.json"]).toEqual({ variants: {} });
    expect(skipped).toEqual(["blockstates/bad.json"]);
    expect(Object.keys(pack.textures).sort()).toEqual(["block/a", "block/anim", "block/still"]);
    expect(pack.textures["block/a"]).toBe(btoa("\x89PNG"));
    expect(pack.animated).toEqual(["block/anim"]);
  });

  it("encodes large textures without overflowing the call stack", () => {
    const big = new Uint8Array(300_000).fill(65);
    const { pack } = buildPack(new Map([["textures/block/big.png", big]]));
    expect(atob(pack.textures["block/big"] as string)).toBe("A".repeat(300_000));
  });
});

describe("mergePacks", () => {
  const base: Pack = {
    json: { "blockstates/a.json": 1, "blockstates/b.json": 2 },
    textures: { "block/a": "A", "block/b": "B" },
    animated: ["block/a", "block/b"],
  };
  const over: Pack = {
    json: { "blockstates/b.json": 20, "blockstates/c.json": 30 },
    textures: { "block/b": "B2", "block/c": "C" },
    animated: ["block/c"],
  };

  it("lays the second pack over the first, file by file", () => {
    const m = mergePacks(base, over) as Pack;
    expect(m.json).toEqual({
      "blockstates/a.json": 1,
      "blockstates/b.json": 20,
      "blockstates/c.json": 30,
    });
    expect(m.textures).toEqual({ "block/a": "A", "block/b": "B2", "block/c": "C" });
    // block/b was animated in the base, but the user's replacement is a plain texture.
    expect(m.animated).toEqual(["block/a", "block/c"]);
  });

  it("returns whichever side exists", () => {
    expect(mergePacks(null, null)).toBeNull();
    expect(mergePacks(base, null)).toBe(base);
    expect(mergePacks(null, over)).toBe(over);
  });
});

describe("readPackZip", () => {
  it("reads a resource pack zip made by the test", async () => {
    const { pack, skipped } = await readPackZip(syntheticPackZip());
    expect(Object.keys(pack.json).sort()).toEqual([
      "blockstates/dirt.json",
      "blockstates/stone.json",
      "models/block/dirt.json",
      "models/block/stone.json",
    ]);
    expect(Object.keys(pack.textures).sort()).toEqual([
      "block/dirt",
      "block/shimmer",
      "block/stone",
    ]);
    expect(pack.animated).toEqual(["block/shimmer"]);
    expect(skipped).toEqual(["models/block/broken.json"]);
    expect(summarize(pack)).toEqual({ blockstates: 2, models: 2, textures: 3 });
    const png = Uint8Array.from(atob(pack.textures["block/stone"] as string), (c) =>
      c.charCodeAt(0),
    );
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(PACK_COLORS.stone).toEqual([255, 0, 0]);
  });

  it("finds the assets when the zip holds a folder", async () => {
    const { pack } = await readPackZip(syntheticPackZip("MyPack/"));
    expect(Object.keys(pack.json)).toContain("blockstates/stone.json");
  });

  it("explains a file that is not a zip or has no block assets", async () => {
    await expect(readPackZip(new TextEncoder().encode("hello"))).rejects.toThrow(PackError);
    await expect(readPackZip(new TextEncoder().encode("hello"))).rejects.toThrow(/not a zip/);
    const { zipSync } = await import("fflate");
    const empty = zipSync({ "readme.txt": new TextEncoder().encode("hi") });
    await expect(readPackZip(empty)).rejects.toThrow(/assets\/minecraft/);
  });
});
