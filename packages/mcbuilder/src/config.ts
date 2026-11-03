// SPDX-License-Identifier: AGPL-3.0-only

// `mcbuild.toml` project configuration.
//
//   mc_version = "26.2"
//   max_dimensions = [256, 256, 256]
//   allowlist = ["lostqol:waystone"]  # pass validation, warn at use
//   # assets_dir defaults to ~/.cache/mcbuilder/<mc_version>/

import { parse as parseToml } from "smol-toml";
import { McbuilderError } from "./errors.ts";
import type { Dims } from "./voxels.ts";

export class ConfigError extends McbuilderError {}

export interface McbuildConfig {
  mcVersion: string;
  maxDimensions: Dims;
  allowlist: string[];
  /** Expanded, or `null` for the default location. */
  assetsDir: string | null;
}

const DEFAULT_MAX_DIMENSIONS: Dims = [256, 256, 256];

/** Python's `int(x)` for the value types TOML can hold. */
function pyInt(v: unknown): number {
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("not finite");
    return Math.trunc(v);
  }
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && /^\s*[+-]?\d+\s*$/.test(v)) return Number.parseInt(v, 10);
  throw new Error("not an integer");
}

/** Expand a leading `~` against `home`. */
export function expandUser(path: string, home: string): string {
  if (path === "~") return home;
  if (path.startsWith("~/")) return `${home.replace(/\/$/, "")}/${path.slice(2)}`;
  return path;
}

/**
 * Parse `mcbuild.toml` text. Missing keys fall back to defaults. Throws
 * {@link ConfigError} on invalid content. `home` expands `~` in `assets_dir`.
 */
export function parseConfig(
  text: string,
  options: { home?: string; source?: string } = {},
): McbuildConfig {
  const source = options.source ?? "mcbuild.toml";
  let data: Record<string, unknown>;
  try {
    data = parseToml(text) as Record<string, unknown>;
  } catch (e) {
    throw new ConfigError(`invalid TOML in ${source}: ${(e as Error).message}`);
  }

  const mcVersion = data.mc_version ?? "26.2";
  if (typeof mcVersion !== "string" || mcVersion === "") {
    throw new ConfigError("mc_version must be a non-empty string");
  }

  const rawDims = data.max_dimensions ?? [...DEFAULT_MAX_DIMENSIONS];
  let dims: number[];
  try {
    if (!Array.isArray(rawDims)) throw new Error("not a list");
    dims = rawDims.map(pyInt);
  } catch {
    throw new ConfigError(
      `max_dimensions must be a list of 3 integers, got ${JSON.stringify(rawDims)}`,
    );
  }
  if (dims.length !== 3 || dims.some((d) => d <= 0)) {
    throw new ConfigError(
      `max_dimensions must be 3 positive integers, got ${JSON.stringify(rawDims)}`,
    );
  }

  const allowlist = data.allowlist ?? [];
  if (!Array.isArray(allowlist) || !allowlist.every((a) => typeof a === "string")) {
    throw new ConfigError(`allowlist must be a list of strings, got ${JSON.stringify(allowlist)}`);
  }

  let assetsDir: string | null = null;
  if (data.assets_dir !== undefined) {
    if (typeof data.assets_dir !== "string") {
      throw new ConfigError(
        `assets_dir must be a string path, got ${JSON.stringify(data.assets_dir)}`,
      );
    }
    assetsDir =
      options.home === undefined ? data.assets_dir : expandUser(data.assets_dir, options.home);
  }

  return {
    mcVersion,
    maxDimensions: dims as unknown as Dims,
    allowlist: [...(allowlist as string[])],
    assetsDir,
  };
}

/** The effective assets directory: `assetsDir`, else `~/.cache/mcbuilder/<mc_version>/`. */
export function resolveAssetsDir(config: McbuildConfig, home: string): string {
  return config.assetsDir ?? `${home.replace(/\/$/, "")}/.cache/mcbuilder/${config.mcVersion}`;
}
