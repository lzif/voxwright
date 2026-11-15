// SPDX-License-Identifier: AGPL-3.0-only

// Texture statistics for palettes and gradients: the mean colour of each
// block's faces, read from the vanilla client assets in the cache, and two
// questions answered from them: which blocks look like this one, and which
// blocks step evenly from one colour to another.
//
// Colours are compared in CIELAB (D65), where a distance of about 2 is the
// smallest difference people notice and L is lightness from 0 to 100. A face's
// colour is the mean of its opaque pixels in linear light, so a texture with
// bright and dark specks averages the way it reads from a distance. `spread`
// is the standard deviation of the pixels' lightness: high for busy textures
// (cobblestone), low for flat ones (concrete).

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { buildFaceTextures, type RasterImage } from "@voxwright/render";
import { directoryAssets } from "@voxwright/render/node";

export interface Lab {
  L: number;
  a: number;
  b: number;
}

export interface FaceStat {
  /** Mean colour of the opaque pixels, sRGB 0..255. */
  rgb: [number, number, number];
  lab: Lab;
  /** Standard deviation of the opaque pixels' lightness (L). */
  spread: number;
  /** Share of the face's pixels that are opaque (alpha >= 128), 0..1. */
  coverage: number;
}

export interface BlockStat {
  top: FaceStat;
  side: FaceStat;
  bottom: FaceStat;
  /** Top and the four sides together, as a block reads on a roof or a wall. */
  all: FaceStat;
}

export type TextureStats = Record<string, BlockStat>;
export type Face = "top" | "side" | "bottom" | "all";
export type Family = "stairs" | "slab" | "full" | "any";

const srgbToLinear = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const linearToSrgb = (v: number): number => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, c)) * 255);
};

function linearToLab(r: number, g: number, b: number): Lab {
  // D65 white point.
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number): number =>
    t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t) / 116 + 16 / 116;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** CIELAB of an sRGB colour (0..255 per channel). */
export function srgbToLab(rgb: readonly [number, number, number]): Lab {
  return linearToLab(srgbToLinear(rgb[0]), srgbToLinear(rgb[1]), srgbToLinear(rgb[2]));
}

/** CIE76 colour difference: the straight distance in CIELAB. */
export function deltaE(p: Lab, q: Lab): number {
  return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
}

/** Statistics of the opaque pixels of one or more face images, pooled. */
export function faceStat(images: readonly RasterImage[]): FaceStat {
  let n = 0;
  let total = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  const ls: number[] = [];
  for (const img of images) {
    const px = img.width * img.height;
    total += px;
    for (let i = 0; i < px; i++) {
      const o = i * img.channels;
      if (img.channels === 4 && (img.data[o + 3] as number) < 128) continue;
      const lr = srgbToLinear(img.data[o] as number);
      const lg = srgbToLinear(img.data[o + 1] as number);
      const lb = srgbToLinear(img.data[o + 2] as number);
      r += lr;
      g += lg;
      b += lb;
      ls.push(linearToLab(lr, lg, lb).L);
      n++;
    }
  }
  if (n === 0) return { rgb: [0, 0, 0], lab: { L: 0, a: 0, b: 0 }, spread: 0, coverage: 0 };
  const mean = linearToLab(r / n, g / n, b / n);
  const meanL = ls.reduce((s, v) => s + v, 0) / n;
  const spread = Math.sqrt(ls.reduce((s, v) => s + (v - meanL) ** 2, 0) / n);
  const round = (v: number, d = 2): number => Math.round(v * 10 ** d) / 10 ** d;
  return {
    rgb: [linearToSrgb(r / n), linearToSrgb(g / n), linearToSrgb(b / n)],
    lab: { L: round(mean.L), a: round(mean.a), b: round(mean.b) },
    spread: round(spread),
    coverage: round(n / total, 3),
  };
}

/**
 * Statistics for each block, from the textures its default block state's model
 * uses (biome tints applied as the renderer applies them). Blocks whose model
 * the renderer cannot resolve get its fallback colour, like in the previews.
 */
export function computeTextureStats(assetsRoot: string, blocks: readonly string[]): TextureStats {
  const assets = directoryAssets(assetsRoot);
  const out: TextureStats = {};
  for (const name of blocks) {
    if (name === "minecraft:air" || name.endsWith(":cave_air") || name.endsWith(":void_air"))
      continue;
    const t = buildFaceTextures(name, assets);
    const sides = [t.north, t.south, t.east, t.west];
    out[name] = {
      top: faceStat([t.up]),
      side: faceStat(sides),
      bottom: faceStat([t.down]),
      all: faceStat([t.up, ...sides]),
    };
  }
  return out;
}

const STATS_FORMAT = 1;

/**
 * Statistics for every block of a version, computed once and kept next to the
 * assets in the cache (`<cache>/<version>/texture-stats.json`).
 */
export async function loadTextureStats(
  versionDir: string,
  options: { refresh?: boolean } = {},
): Promise<TextureStats> {
  const file = join(versionDir, "texture-stats.json");
  if (!options.refresh && existsSync(file)) {
    const cached = JSON.parse(await readFile(file, "utf8")) as {
      format?: number;
      blocks?: TextureStats;
    };
    if (cached.format === STATS_FORMAT && cached.blocks) return cached.blocks;
  }
  const assetsRoot = join(versionDir, "client", "assets", "minecraft");
  if (!existsSync(join(assetsRoot, "textures"))) {
    throw new Error(`no client assets in ${assetsRoot}`);
  }
  const registry = JSON.parse(await readFile(join(versionDir, "minecraft-data.json"), "utf8")) as {
    blocks: Record<string, unknown>;
  };
  const stats = computeTextureStats(assetsRoot, Object.keys(registry.blocks).sort());
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify({ format: STATS_FORMAT, blocks: stats })}\n`);
  return stats;
}

// Blocks that are not full cubes even when every face texture is opaque.
const NOT_FULL =
  /_(stairs|slab|wall|fence|fence_gate|pane|bars|door|trapdoor|button|pressure_plate|carpet|sign|hanging_sign|banner|bed|candle|torch|rail|sapling|head|skull|pot|lantern|chain|rod|grate|bulb|vent|shelf)$|^minecraft:(glass|tinted_glass|ice|slime_block|honey_block|scaffolding|ladder|vine|cobweb|snow|chest|ender_chest|trapped_chest|anvil|chipped_anvil|damaged_anvil|lectern|enchanting_table|cake|composter|cauldron|hopper|brewing_stand|bell|campfire|soul_campfire|grindstone|stonecutter|daylight_detector|conduit|beacon|end_portal_frame|dragon_egg|lightning_rod)$/;

// Blocks that look exactly like another block (same textures): left out of matches.
const DUPLICATE = /^minecraft:(infested_|waxed_|petrified_oak_slab$)/;

/** Whether a block belongs to a family, judged by its name (and coverage for full cubes). */
export function inFamily(name: string, stat: BlockStat, family: Family): boolean {
  switch (family) {
    case "any":
      return true;
    case "stairs":
      return name.endsWith("_stairs");
    case "slab":
      return name.endsWith("_slab");
    case "full":
      return (
        !NOT_FULL.test(name) &&
        stat.top.coverage === 1 &&
        stat.side.coverage === 1 &&
        stat.bottom.coverage === 1
      );
  }
}

export interface Match {
  name: string;
  deltaE: number;
  face: FaceStat;
}

/** The blocks of a family closest in colour to `target`, nearest first. */
export function nearest(
  stats: TextureStats,
  target: Lab,
  options: { family?: Family; face?: Face; limit?: number; exclude?: ReadonlySet<string> } = {},
): Match[] {
  const { family = "any", face = "all", limit = 10, exclude } = options;
  const out: Match[] = [];
  for (const [name, stat] of Object.entries(stats)) {
    if (exclude?.has(name) || DUPLICATE.test(name) || !inFamily(name, stat, family)) continue;
    const f = stat[face];
    if (f.coverage < 0.5) continue;
    out.push({ name, deltaE: deltaE(f.lab, target), face: f });
  }
  out.sort((p, q) => p.deltaE - q.deltaE || (p.name < q.name ? -1 : 1));
  return out.slice(0, limit);
}

/**
 * `steps` blocks of a family stepping from `from` to `to`: the colour line
 * between the two is cut into even steps and each step takes the nearest block
 * not used yet. The endpoints are the given blocks themselves when they belong
 * to the family.
 */
export function ramp(
  stats: TextureStats,
  from: string,
  to: string,
  steps: number,
  options: { family?: Family; face?: Face } = {},
): Match[] {
  const { family = "any", face = "all" } = options;
  const a = stats[from];
  const b = stats[to];
  if (!a) throw new Error(`no texture statistics for ${from}`);
  if (!b) throw new Error(`no texture statistics for ${to}`);
  if (!Number.isInteger(steps) || steps < 2)
    throw new Error(`steps must be an int >= 2, got ${steps}`);
  const pa = a[face].lab;
  const pb = b[face].lab;
  const used = new Set<string>();
  const out: Match[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const target = {
      L: pa.L + (pb.L - pa.L) * t,
      a: pa.a + (pb.a - pa.a) * t,
      b: pa.b + (pb.b - pa.b) * t,
    };
    const end = i === 0 ? from : i === steps - 1 ? to : null;
    if (end && inFamily(end, stats[end] as BlockStat, family) && !used.has(end)) {
      const f = (stats[end] as BlockStat)[face];
      out.push({ name: end, deltaE: deltaE(f.lab, target), face: f });
      used.add(end);
      continue;
    }
    const [best] = nearest(stats, target, { family, face, limit: 1, exclude: used });
    if (!best) break;
    out.push(best);
    used.add(best.name);
  }
  return out;
}

/** `#rrggbb` of an sRGB colour. */
export function hex(rgb: readonly [number, number, number]): string {
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
