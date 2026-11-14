// SPDX-License-Identifier: AGPL-3.0-only

// Small pieces the skill CLI subcommands share: names, palettes, bounds and
// how each of them is printed.

import { join } from "node:path";
import { AIR, compareCodePoints, type Volume } from "@voxwright/core";
import { DATA_VERSIONS } from "../../dataversion.ts";
import { SkillCliError } from "./io.ts";

/**
 * The name in usage and error text. The npm package installs the same bundle as `mcbuild`
 * (scripts/pack-npm.ts), so the text follows the name the program was started under.
 */
export const PROG = /(^|[\\/])mcbuild(\.mjs|\.ts)?$/.test(process.argv[1] ?? "")
  ? "mcbuild"
  : "voxwright-cli";
/** Replaced by the repository version when the bundle is built (scripts/build-skill.ts). */
declare const __VOXWRIGHT_VERSION__: string | undefined;
export const VERSION = typeof __VOXWRIGHT_VERSION__ === "string" ? __VOXWRIGHT_VERSION__ : "dev";
export const DEFAULT_MC_VERSION = "26.2";

export type Vec3 = [number, number, number];

export interface PaletteEntry {
  state: string;
  count: number;
}

/** Non-air block states and their cell counts, most used first, then by name. */
export function paletteOf(volume: Volume): PaletteEntry[] {
  const counts = new Map<string, number>();
  volume.eachCell((_x, _y, _z, idx) => {
    const state = volume.palette[idx] as string;
    if (state !== AIR) counts.set(state, (counts.get(state) ?? 0) + 1);
  });
  return [...counts]
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count || compareCodePoints(a.state, b.state));
}

export interface Box {
  min: Vec3;
  max: Vec3;
}

export const boxOf = (b: readonly [readonly number[], readonly number[]] | null): Box | null =>
  b === null ? null : { min: [...b[0]] as Vec3, max: [...b[1]] as Vec3 };

export const sizeOf = (b: Box | null): Vec3 =>
  b === null
    ? [0, 0, 0]
    : [b.max[0] - b.min[0] + 1, b.max[1] - b.min[1] + 1, b.max[2] - b.min[2] + 1];

export const fmtSize = (s: Vec3): string => s.join("×");
export const fmtBox = (b: Box | null): string =>
  b === null ? "none" : `${b.min.join(",")} to ${b.max.join(",")}`;

/** Palette lines, counts right-aligned. */
export function fmtPalette(palette: readonly PaletteEntry[]): string[] {
  const w = Math.max(0, ...palette.map((p) => String(p.count).length));
  return palette.map((p) => `  ${String(p.count).padStart(w)} ${p.state}`);
}

/** The release a DataVersion belongs to, when it is one the CLI knows. */
export function releaseOf(dataVersion: number): string | null {
  for (const [release, dv] of Object.entries(DATA_VERSIONS)) if (dv === dataVersion) return release;
  return null;
}

/** `~/.cache/mcbuilder`: the cache `mcbuild assets fetch` fills. */
export const cacheRoot = (home: string): string => join(home, ".cache", "mcbuilder");

export const usageError = (message: string): SkillCliError => new SkillCliError(message, 2);
