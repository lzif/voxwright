// SPDX-License-Identifier: AGPL-3.0-only

// Where the skill CLI gets its block registry: a file given on the command
// line, the cache `mcbuild assets fetch` fills, or a registry-only download
// into that cache. Without one the build is still exported, unvalidated.

import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Registry } from "../../registry.ts";
import { AssetError, fetchRegistry, type HttpGet } from "../assets.ts";
import { exists } from "../script.ts";
import { cacheRoot } from "./common.ts";
import { SkillCliError } from "./io.ts";

export interface RegistryLookup {
  /** `null` when no registry could be had; `skipped` then says why. */
  registry: Registry | null;
  /** The file the registry was read from. */
  source: string | null;
  skipped: string | null;
  /** True when this run downloaded the registry. */
  downloaded: boolean;
}

export interface RegistryRequest {
  mcVersion: string;
  /** `--registry`: a normalized registry (or minecraft-data `blocks.json`) file. */
  file?: string;
  offline: boolean;
  cwd: string;
  home: string;
  /** Network access; tests replace it. */
  get?: HttpGet;
}

async function read(path: string, version: string): Promise<Registry> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    throw new SkillCliError(`could not read the block registry ${path}: ${(e as Error).message}`);
  }
  try {
    return Registry.fromData(raw, version);
  } catch (e) {
    throw new SkillCliError(`${path}: ${(e as Error).message}`);
  }
}

export async function findRegistry(req: RegistryRequest): Promise<RegistryLookup> {
  if (req.file !== undefined) {
    const path = resolve(req.cwd, req.file);
    if (!(await exists(path))) throw new SkillCliError(`--registry: no such file: ${path}`, 2);
    return {
      registry: await read(path, req.mcVersion),
      source: path,
      skipped: null,
      downloaded: false,
    };
  }
  const root = cacheRoot(req.home);
  const cached = join(root, req.mcVersion, "minecraft-data.json");
  if (await exists(cached)) {
    return {
      registry: await read(cached, req.mcVersion),
      source: cached,
      skipped: null,
      downloaded: false,
    };
  }
  if (req.offline) {
    return {
      registry: null,
      source: null,
      skipped: `no block registry for ${req.mcVersion} at ${cached} and --offline is set`,
      downloaded: false,
    };
  }
  try {
    const path = await fetchRegistry(
      req.mcVersion,
      root,
      req.get === undefined ? {} : { get: req.get },
    );
    return {
      registry: await read(path, req.mcVersion),
      source: path,
      skipped: null,
      downloaded: true,
    };
  } catch (e) {
    if (!(e instanceof AssetError)) throw e;
    return {
      registry: null,
      source: null,
      skipped: `the block registry for ${req.mcVersion} could not be downloaded (${e.message})`,
      downloaded: false,
    };
  }
}
