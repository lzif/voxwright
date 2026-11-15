// SPDX-License-Identifier: AGPL-3.0-only
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type BlockStat,
  deltaE,
  type FaceStat,
  faceStat,
  hex,
  inFamily,
  loadTextureStats,
  nearest,
  ramp,
  runCli,
  srgbToLab,
  type TextureStats,
} from "../src/node/index.ts";

const grey = (v: number): FaceStat => {
  const lab = srgbToLab([v, v, v]);
  return { rgb: [v, v, v], lab, spread: 1, coverage: 1 };
};
const block = (f: FaceStat): BlockStat => ({ top: f, side: f, bottom: f, all: f });
const STATS: TextureStats = {
  "minecraft:black_stairs": block(grey(20)),
  "minecraft:dark_stairs": block(grey(60)),
  "minecraft:mid_stairs": block(grey(110)),
  "minecraft:light_stairs": block(grey(170)),
  "minecraft:white_stairs": block(grey(240)),
  "minecraft:mid_slab": block(grey(115)),
  "minecraft:mid_block": block(grey(108)),
  "minecraft:infested_mid_block": block(grey(108)),
  "minecraft:glass": block({ ...grey(200), coverage: 0.2 }),
};

describe("colour", () => {
  it("converts sRGB to CIELAB", () => {
    expect(srgbToLab([255, 255, 255]).L).toBeCloseTo(100, 1);
    expect(srgbToLab([0, 0, 0]).L).toBeCloseTo(0, 5);
    const mid = srgbToLab([128, 128, 128]);
    expect(mid.L).toBeCloseTo(53.59, 1);
    expect(Math.abs(mid.a) + Math.abs(mid.b)).toBeLessThan(0.01);
    const red = srgbToLab([255, 0, 0]);
    expect([red.L, red.a, red.b].map((v) => Math.round(v))).toEqual([53, 80, 67]);
  });

  it("measures distance and writes hex", () => {
    expect(deltaE({ L: 50, a: 0, b: 0 }, { L: 53, a: 4, b: 0 })).toBe(5);
    expect(hex([255, 8, 128])).toBe("#ff0880");
  });

  it("averages the opaque pixels of a face in linear light", () => {
    // 2x1 RGBA: black and white opaque, plus a transparent red pixel in a second image.
    const a = {
      width: 2,
      height: 1,
      channels: 4 as const,
      data: new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]),
    };
    const b = { width: 1, height: 1, channels: 4 as const, data: new Uint8Array([255, 0, 0, 0]) };
    const s = faceStat([a, b]);
    expect(s.coverage).toBeCloseTo(2 / 3, 3);
    // Half white in linear light is sRGB 188, not 128.
    expect(s.rgb).toEqual([188, 188, 188]);
    expect(s.spread).toBeCloseTo(50, 0);
    expect(faceStat([b]).coverage).toBe(0);
  });
});

describe("families, nearest and ramp", () => {
  it("sorts blocks into families", () => {
    expect(
      inFamily("minecraft:mid_stairs", STATS["minecraft:mid_stairs"] as BlockStat, "stairs"),
    ).toBe(true);
    expect(inFamily("minecraft:mid_slab", STATS["minecraft:mid_slab"] as BlockStat, "slab")).toBe(
      true,
    );
    expect(inFamily("minecraft:mid_block", STATS["minecraft:mid_block"] as BlockStat, "full")).toBe(
      true,
    );
    expect(
      inFamily("minecraft:mid_stairs", STATS["minecraft:mid_stairs"] as BlockStat, "full"),
    ).toBe(false);
    expect(inFamily("minecraft:glass", STATS["minecraft:glass"] as BlockStat, "full")).toBe(false);
  });

  it("finds the closest blocks, leaving out see-through faces and look-alike duplicates", () => {
    const target = srgbToLab([110, 110, 110]);
    expect(nearest(STATS, target, { limit: 3 }).map((m) => m.name)).toEqual([
      "minecraft:mid_stairs",
      "minecraft:mid_block",
      "minecraft:mid_slab",
    ]);
    expect(nearest(STATS, target, { family: "full" }).map((m) => m.name)).toEqual([
      "minecraft:mid_block",
    ]);
    expect(
      nearest(STATS, srgbToLab([200, 200, 200]), { limit: 9 }).map((m) => m.name),
    ).not.toContain("minecraft:glass");
  });

  it("steps evenly from one block to another within a family", () => {
    expect(
      ramp(STATS, "minecraft:black_stairs", "minecraft:white_stairs", 5, { family: "stairs" }).map(
        (m) => m.name,
      ),
    ).toEqual([
      "minecraft:black_stairs",
      "minecraft:dark_stairs",
      "minecraft:mid_stairs",
      "minecraft:light_stairs",
      "minecraft:white_stairs",
    ]);
    // Never the same block twice, even when the steps outnumber the blocks.
    const many = ramp(STATS, "minecraft:black_stairs", "minecraft:white_stairs", 7, {
      family: "stairs",
    });
    expect(new Set(many.map((m) => m.name)).size).toBe(many.length);
    expect(() => ramp(STATS, "minecraft:nope", "minecraft:white_stairs", 3)).toThrow(
      /no texture statistics/,
    );
    expect(() => ramp(STATS, "minecraft:black_stairs", "minecraft:white_stairs", 1)).toThrow(
      /steps/,
    );
  });
});

describe("mcbuild palette", () => {
  const base = fileURLToPath(new URL("./.tmp/", import.meta.url));
  let root = "";
  let home = "";
  beforeAll(async () => {
    await mkdir(base, { recursive: true });
    root = await mkdtemp(join(base, "palette-"));
    home = join(root, "home");
    const v = join(home, ".cache/mcbuilder/26.2");
    await mkdir(join(v, "client/assets/minecraft/textures"), { recursive: true });
    await writeFile(join(v, "minecraft-data.json"), JSON.stringify({ blocks: {} }));
    await writeFile(join(v, "texture-stats.json"), JSON.stringify({ format: 1, blocks: STATS }));
  });
  afterAll(() => rm(root, { recursive: true, force: true }));
  const run = async (args: string[]) => {
    const out: string[] = [];
    const err: string[] = [];
    const code = await runCli(args, {
      out: (l) => out.push(l),
      err: (l) => err.push(l),
      cwd: root,
      home,
    });
    return { code, out, err };
  };

  it("reads the cached statistics", async () => {
    const stats = await loadTextureStats(join(home, ".cache/mcbuilder/26.2"));
    expect(Object.keys(stats)).toHaveLength(Object.keys(STATS).length);
  });

  it("prints a ramp, the nearest blocks and one block's faces", async () => {
    const r = await run([
      "palette",
      "ramp",
      "black_stairs",
      "white_stairs",
      "--steps",
      "3",
      "--family",
      "stairs",
      "--offline",
    ]);
    expect(r.code).toBe(0);
    expect(r.out.map((l) => l.split(/\s+/)[0])).toEqual([
      "black_stairs",
      "mid_stairs",
      "white_stairs",
    ]);
    const n = await run(["palette", "near", "mid_stairs", "--limit", "2", "--offline"]);
    expect(n.out.map((l) => l.split(/\s+/)[0])).toEqual(["mid_stairs", "mid_block"]);
    const s = await run(["palette", "show", "minecraft:mid_slab", "--offline"]);
    expect(s.out[0]).toBe("minecraft:mid_slab");
    expect(s.out).toHaveLength(5);
  });

  it("explains bad arguments", async () => {
    expect((await run(["palette", "blend"])).err.join("\n")).toMatch(
      /expected `near`, `ramp` or `show`/,
    );
    expect((await run(["palette", "near", "nope_block", "--offline"])).err.join("\n")).toMatch(
      /unknown block nope_block/,
    );
    expect(
      (await run(["palette", "near", "mid_stairs", "--family", "roof", "--offline"])).err.join(
        "\n",
      ),
    ).toMatch(/--family must be one of/);
    expect((await run(["palette", "ramp", "black_stairs", "--offline"])).err.join("\n")).toMatch(
      /give two blocks/,
    );
  });
});
