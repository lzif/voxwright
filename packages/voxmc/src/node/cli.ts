// SPDX-License-Identifier: AGPL-3.0-only

// The `voxmc` command line.
//
//   voxmc init [path] [--force]
//   voxmc check <script> [--config file] [--offline]
//   voxmc run <script> [--out dir] [--air none|explicit|all] [--config file]
//                [--preview] [--guide] [--views 'iso;top'] [--count N] [--focus x0,y0,z0:x1,y1,z1]
//   voxmc import <file> [-o out.ts|out.mjs] [--force] [--keep-air] [--raw] [--config file]
//   voxmc diff [<run-a> <run-b>] [--out dir] [--max N]
//   voxmc assets fetch --version V [--from mcasset|mojang] [--cache-dir dir] [--force]
//
// A builder script is a TypeScript (or JavaScript) module that exports a
// `Build` as `BUILD`.

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import {
  type AirMode,
  type DenseVolume,
  readLitematic,
  readMcstructure,
  readSchem,
  readStructureNbt,
  writeStructureNbt,
} from "voxmc-core";
import {
  focusBounds,
  renderView,
  resolveViews,
  untrustedBlocks,
  type View,
  ViewError,
  withCount,
} from "voxmc-render";
import { directoryAssets, encodePng } from "voxmc-render/node";
import { parseConfig, type VoxmcConfig } from "../config.ts";
import { ExportError, resolveDataVersion } from "../dataversion.ts";
import { DiffError, formatDiff } from "../diff.ts";
import { VoxmcError } from "../errors.ts";
import { buildGuide, titleCase } from "../guide.ts";
import { cleanProperties, structureFromVolume, summary, toScript } from "../importer.ts";
import { Registry, RegistryError } from "../registry.ts";
import { buildReport, reportToJson, viewEntry } from "../report.ts";
import {
  ASSET_SOURCES,
  AssetError,
  type AssetSource,
  assetVersionCandidates,
  defaultCacheRoot,
  fetchAssets,
  fetchClientAssets,
  fetchRegistry,
  findAssetVersionDir,
  type HttpGet,
} from "./assets.ts";
import { comparisonImage, diffRunDirs, listCleanRuns, resolveRunDir } from "./diff.ts";
import {
  type BlockStat,
  type Face,
  type Family,
  hex,
  loadTextureStats,
  type Match,
  nearest,
  ramp,
} from "./palette.ts";
import {
  blockCounts,
  dimensions,
  exists,
  loadScript,
  placedAt,
  scanDeterminism,
} from "./script.ts";
import { OLD_CONFIG_NAMES, oldConfigMessage } from "./skill/tombstones.ts";

/** Replaced by `true` when the bundle is built (scripts/build-skill.ts). */
declare const __VOXMC_BUNDLED__: boolean | undefined;
const BUNDLED = typeof __VOXMC_BUNDLED__ !== "undefined" && __VOXMC_BUNDLED__ === true;

export class CliError extends Error {}

export interface Io {
  out: (line: string) => void;
  err: (line: string) => void;
  cwd?: string;
  home?: string;
}

export const HOUSE_TEMPLATE = `// house.ts: starter build written by \`voxmc init\`.
//
// Loop:  voxmc check house.ts   ->   voxmc run house.ts
// Change numbers, run again.
import { Build, patches } from "voxmc-engine";

export const BUILD = new Build({ seed: 1, views: "iso;az225_el025;top" });

const WALL = patches([["minecraft:oak_planks", 3], "minecraft:stripped_oak_wood"], { scale: 3 });

BUILD.scope(() => {
  // 7 x 5 footprint: cobblestone floor, plank walls 3 high
  BUILD.box([0, 0, 0], [6, 0, 4], "minecraft:cobblestone");
  BUILD.walls([0, 1, 0], [6, 3, 4], WALL);
  for (const [x, z] of [[0, 0], [6, 0], [0, 4], [6, 4]] as const) {
    BUILD.pillar([x, 1, z], 3, "minecraft:oak_log[axis=y]");
  }

  // door (north wall) and a window (south wall)
  BUILD.set(3, 1, 0, "minecraft:oak_door[facing=north,half=lower,hinge=left]");
  BUILD.set(3, 2, 0, "minecraft:oak_door[facing=north,half=upper,hinge=left]");
  BUILD.box([2, 2, 4], [4, 2, 4], "minecraft:glass_pane");

  // gable roof with a 1-block overhang; shapes return what they placed,
  // so the chimney can be sized from the roof's real peak
  const roof = BUILD.roofGable([-1, 4, -1], [7, 4, 5], "minecraft:spruce_stairs", {
    ridge: "x",
    verge: "minecraft:dark_oak_stairs",
  });
  const peak = roof.bounds()?.[1][1] ?? 4;
  BUILD.box([5, 1, 3], [5, peak + 1, 3], "minecraft:cobblestone");
});
`;

/** The nearest `voxmc.toml` at or above `startDir`, parsed; `null` when there is none. */
export async function findConfig(startDir: string, home: string): Promise<VoxmcConfig | null> {
  let dir = resolve(startDir);
  for (;;) {
    const candidate = join(dir, "voxmc.toml");
    if (await exists(candidate)) {
      try {
        return parseConfig(await readFile(candidate, "utf8"), { home, source: candidate });
      } catch (e) {
        throw new CliError(`invalid voxmc.toml: ${(e as Error).message}`);
      }
    }
    // A tombstone: an old config file is an error, not something to skip over.
    for (const old of OLD_CONFIG_NAMES) {
      if (await exists(join(dir, old))) throw new CliError(oldConfigMessage(join(dir, old)));
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

async function resolveConfig(
  scriptPath: string,
  explicit: string | undefined,
  home: string,
): Promise<VoxmcConfig> {
  if (explicit) {
    if (!(await exists(explicit))) throw new CliError(`config not found: ${explicit}`);
    try {
      return parseConfig(await readFile(explicit, "utf8"), { home, source: explicit });
    } catch (e) {
      throw new CliError(`invalid config ${explicit}: ${(e as Error).message}`);
    }
  }
  return (await findConfig(dirname(resolve(scriptPath)), home)) ?? parseConfig("", { home });
}

/** How a command may reach the network for what its cache lacks. */
interface Net {
  offline: boolean;
  get: HttpGet | undefined;
  out: (line: string) => void;
}

async function loadRegistry(cfg: VoxmcConfig, home: string, net: Net): Promise<Registry> {
  const candidates = assetVersionCandidates(cfg.assetsDir, cfg.mcVersion, home);
  let versionDir = await findAssetVersionDir(
    cfg.assetsDir,
    cfg.mcVersion,
    home,
    "minecraft-data.json",
  );
  // The default cache fills itself; a directory the configuration names is the user's to fill.
  if (versionDir === null && cfg.assetsDir === null && !net.offline) {
    net.out(`downloading the block registry for ${cfg.mcVersion} (once)`);
    try {
      await fetchRegistry(cfg.mcVersion, defaultCacheRoot(home), {
        ...(net.get ? { get: net.get } : {}),
      });
      versionDir = await findAssetVersionDir(
        cfg.assetsDir,
        cfg.mcVersion,
        home,
        "minecraft-data.json",
      );
    } catch (e) {
      if (!(e instanceof AssetError)) throw e;
      throw new CliError(
        `could not download the block registry for version '${cfg.mcVersion}': ${e.message}`,
      );
    }
  }
  if (versionDir === null) {
    const tried = candidates.map((d) => join(d, "minecraft-data.json")).join(" or ");
    throw new CliError(
      new RegistryError(
        `block registry for version '${cfg.mcVersion}' not found at ${tried} — run \`voxmc assets fetch --version ${cfg.mcVersion}\` first.`,
      ).message,
    );
  }
  const path = join(versionDir, "minecraft-data.json");
  try {
    return Registry.fromData(JSON.parse(await readFile(path, "utf8")), cfg.mcVersion);
  } catch (e) {
    throw new CliError(`could not read registry file ${path}: ${(e as Error).message}`);
  }
}

/** `"x0,y0,z0:x1,y1,z1"` gives two corners. */
function parseFocus(spec: string): [[number, number, number], [number, number, number]] {
  const bad = (): never => {
    throw new CliError(`--focus must look like x0,y0,z0:x1,y1,z1, got '${spec}'`);
  };
  const parts = spec.split(":");
  if (parts.length !== 2) return bad();
  const corner = (t: string): [number, number, number] => {
    const v = t.split(",").map((n) => (/^\s*-?\d+\s*$/.test(n) ? Number(n) : Number.NaN));
    if (v.length !== 3 || v.some(Number.isNaN)) return bad();
    return v as [number, number, number];
  };
  return [corner(parts[0] as string), corner(parts[1] as string)];
}

/** Non-air world-space inclusive `[min, max]` bounds of `dense`, or `null` when empty. */
function nonAirBounds(
  dense: DenseVolume,
): readonly [readonly [number, number, number], readonly [number, number, number]] | null {
  const air = dense.palette.indexOf("minecraft:air");
  const [sx, sy, sz] = dense.size;
  const [ox, oy, oz] = dense.origin;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let x = 0; x < sx; x++) {
    for (let y = 0; y < sy; y++) {
      for (let z = 0; z < sz; z++) {
        const v = dense.data[(x * sy + y) * sz + z] as number;
        if (v < 0 || v >= dense.palette.length || v === air) continue;
        const wx = ox + x;
        const wy = oy + y;
        const wz = oz + z;
        if (wx < minX) minX = wx;
        if (wy < minY) minY = wy;
        if (wz < minZ) minZ = wz;
        if (wx > maxX) maxX = wx;
        if (wy > maxY) maxY = wy;
        if (wz > maxZ) maxZ = wz;
      }
    }
  }
  return minX === Infinity
    ? null
    : [
        [minX, minY, minZ],
        [maxX, maxY, maxZ],
      ];
}

/** `--views` and `--count` beat the script's views, which beat the default set. Max 36. */
function resolveCliViews(
  spec: string | undefined,
  count: string | undefined,
  scripted: readonly string[] | null,
): View[] {
  try {
    let views = spec
      ? resolveViews(spec)
      : scripted && scripted.length > 0
        ? resolveViews(scripted)
        : resolveViews(null);
    if (count) views = withCount(views, Number(count));
    if (views.length === 0) throw new CliError("no views configured");
    return views;
  } catch (e) {
    if (e instanceof ViewError || e instanceof RangeError)
      throw new CliError(`invalid views: ${e.message}`);
    throw e;
  }
}

interface Issue {
  message?: string;
  at?: string;
  suggestions?: string[];
  [k: string]: unknown;
}

function fmtIssue(issue: Issue): string {
  let msg = String(issue.message ?? JSON.stringify(issue));
  if (issue.at) msg += ` (at ${issue.at})`;
  const sugs = issue.suggestions ?? [];
  if (sugs.length > 0) msg += ` — did you mean ${sugs.join(" or ")}?`;
  return msg;
}

async function loadAndValidate(script: string, config: string | undefined, home: string, net: Net) {
  const cfg = await resolveConfig(script, config, home);
  const build = await loadScript(script, { maxDimensions: cfg.maxDimensions });
  const detWarnings = scanDeterminism(await readFile(script, "utf8"), basename(script));
  const registry = await loadRegistry(cfg, home, net);
  const dense = build.grid.toDense();
  const { errors, warnings } = registry.validate(dense.palette, cfg.allowlist);
  // As the Python tool does: name the script line that first placed the block.
  const located = <T extends { block: string }>(issue: T): T & { at?: string } => {
    const at = placedAt(build.grid, issue.block, script);
    return at === null ? issue : { ...issue, at };
  };
  return {
    build,
    cfg,
    dense,
    errors: errors.map(located) as unknown as Issue[],
    warnings: [
      ...warnings.map(located),
      ...detWarnings.map((message) => ({ message })),
    ] as unknown as Issue[],
  };
}

async function nextRunDir(out: string): Promise<string> {
  await mkdir(out, { recursive: true });
  let n = 1;
  while (await exists(join(out, `run-${String(n).padStart(3, "0")}`))) n++;
  const dir = join(out, `run-${String(n).padStart(3, "0")}`);
  await mkdir(dir);
  return dir;
}

async function cmdCheck(args: string[], io: Required<Io>, get?: HttpGet): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { config: { type: "string" }, offline: { type: "boolean" } },
  });
  const [script] = positionals;
  if (script === undefined) throw new CliError("check: give a script");
  const ctx = await loadAndValidate(script, values.config, io.home, {
    offline: values.offline ?? false,
    get,
    out: io.out,
  });
  const blocks = ctx.build.grid.volume.countNonAir();
  io.out(
    `${basename(script)} — ${ctx.errors.length === 0 ? "OK" : "FAILED"} (${blocks} blocks, ${ctx.dense.palette.length} types, ${ctx.errors.length} errors, ${ctx.warnings.length} warnings)`,
  );
  for (const e of ctx.errors) io.out(`  error: ${fmtIssue(e)}`);
  for (const w of ctx.warnings) io.out(`  warning: ${fmtIssue(w)}`);
  return ctx.errors.length > 0 ? 1 : 0;
}

async function cmdRun(args: string[], io: Required<Io>, get?: HttpGet): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      config: { type: "string" },
      out: { type: "string", default: "dist" },
      air: { type: "string", default: "none" },
      preview: { type: "boolean" },
      tier: { type: "string", default: "faithful" },
      focus: { type: "string" },
      views: { type: "string" },
      count: { type: "string" },
      guide: { type: "boolean" },
      offline: { type: "boolean" },
    },
  });
  const [script] = positionals;
  if (script === undefined) throw new CliError("run: give a script");
  if (values.tier !== "faithful") {
    if (["fast", "trusted", "all"].includes(values.tier as string)) {
      throw new CliError(
        `--tier ${values.tier} is not ported yet; only faithful previews exist (the default)`,
      );
    }
    throw new CliError(`--tier must be faithful, fast, trusted or all, got '${values.tier}'`);
  }
  const air = values.air as AirMode;
  if (!["none", "explicit", "all"].includes(air))
    throw new CliError("--air must be none, explicit or all");

  const ctx = await loadAndValidate(script, values.config, io.home, {
    offline: values.offline ?? false,
    get,
    out: io.out,
  });
  const runDir = await nextRunDir(resolve(io.cwd, values.out as string));
  const stem = basename(script, extname(script));
  const warnings = [...ctx.warnings];
  let focus: [[number, number, number], [number, number, number]] | null = null;
  if (values.focus) focus = parseFocus(values.focus);
  const viewList = values.preview
    ? resolveCliViews(values.views, values.count, ctx.build.viewsConfig)
    : [];

  const artifacts: Record<string, unknown>[] = [];
  if (ctx.errors.length === 0) {
    const candidates = assetVersionCandidates(ctx.cfg.assetsDir, ctx.cfg.mcVersion, io.home).map(
      (dir) => join(dir, "version.json"),
    );
    let versionJson: unknown;
    for (const vj of candidates) {
      if (await exists(vj)) {
        versionJson = JSON.parse(await readFile(vj, "utf8"));
        break;
      }
    }
    let dataVersion: number;
    try {
      dataVersion = resolveDataVersion(ctx.cfg.mcVersion, versionJson);
    } catch (e) {
      if (e instanceof ExportError) throw new CliError(e.message);
      throw e;
    }
    let result: Awaited<ReturnType<typeof writeStructureNbt>>;
    try {
      result = await writeStructureNbt(ctx.build.grid.volume, { dataVersion, air });
    } catch (e) {
      throw new CliError(e instanceof Error ? e.message : String(e));
    }
    await writeFile(join(runDir, `${stem}.nbt`), result.bytes);
    warnings.push(...result.warnings.map((message) => ({ message })));
    artifacts.push({ file: `${stem}.nbt`, format: "nbt", data_version: dataVersion });
  }

  // Previews: the faithful tier, drawn from the whole build or the --focus box.
  const blockstatesMarker = join("client", "assets", "minecraft", "blockstates");
  const viewEntries: ReturnType<typeof viewEntry>[] = [];
  if (values.preview && ctx.errors.length === 0) {
    let versionDir = await findAssetVersionDir(
      ctx.cfg.assetsDir,
      ctx.cfg.mcVersion,
      io.home,
      blockstatesMarker,
    );
    let why = "";
    // The default cache fills itself on the first preview. A directory the configuration names
    // is the user's to fill.
    if (versionDir === null && ctx.cfg.assetsDir === null && !values.offline) {
      io.out(
        `downloading the vanilla assets for ${ctx.cfg.mcVersion} (once, for the previews; --offline skips this)`,
      );
      try {
        await fetchClientAssets(ctx.cfg.mcVersion, defaultCacheRoot(io.home), {
          ...(get ? { get } : {}),
        });
        versionDir = await findAssetVersionDir(
          ctx.cfg.assetsDir,
          ctx.cfg.mcVersion,
          io.home,
          blockstatesMarker,
        );
      } catch (e) {
        if (!(e instanceof AssetError)) throw e;
        why = ` (download failed: ${e.message})`;
      }
    }
    if (versionDir === null) {
      warnings.push({
        message: `faithful preview: vanilla client assets not found — all blocks rendered as fallback cubes${why}`,
      });
    }
    const grid = focus === null ? ctx.build.grid : ctx.build.grid.crop(focus[0], focus[1]);
    if (focus !== null && grid.volume.countNonAir() === 0)
      throw new CliError(`--focus ${values.focus}: no blocks inside that box`);
    const dense = grid.toDense();
    const assets =
      versionDir === null
        ? null
        : directoryAssets(join(versionDir, "client", "assets", "minecraft"));
    for (const [name, n] of untrustedBlocks(dense, assets)) {
      warnings.push({
        message: `faithful preview: ${n} \`${name}\` rendered as magenta fallback cube — orientation not verified`,
      });
    }
    const dir = join(runDir, "previews_faithful");
    await mkdir(dir, { recursive: true });
    const buildBounds = viewList.some((v) => v.focus) ? nonAirBounds(dense) : null;
    for (const view of viewList) {
      if (view.focus) {
        const [[fx0, fy0, fz0], [fx1, fy1, fz1]] = focusBounds(view.focus);
        if (
          buildBounds === null ||
          fx1 < buildBounds[0][0] ||
          fx0 > buildBounds[1][0] ||
          fy1 < buildBounds[0][1] ||
          fy0 > buildBounds[1][1] ||
          fz1 < buildBounds[0][2] ||
          fz0 > buildBounds[1][2]
        ) {
          warnings.push({
            message: `faithful preview: view \`${view.label}\` focus region lies outside the build`,
          });
        }
      }
      const file = `${view.label}.png`;
      await writeFile(
        join(dir, file),
        encodePng(renderView(dense, assets, view, { title: titleCase(stem.replaceAll("_", " ")) })),
      );
      viewEntries.push(
        viewEntry({
          file: `previews_faithful/${file}`,
          view,
          directionsUntrusted: false,
          directionsTrusted: true,
        }),
      );
    }
  }

  // Build guide: one plan per layer plus a material list, only for a clean build.
  if (values.guide && ctx.errors.length === 0) {
    const versionDir = await findAssetVersionDir(
      ctx.cfg.assetsDir,
      ctx.cfg.mcVersion,
      io.home,
      blockstatesMarker,
    );
    const assets =
      versionDir === null
        ? null
        : directoryAssets(join(versionDir, "client", "assets", "minecraft"));
    const grid = focus === null ? ctx.build.grid : ctx.build.grid.crop(focus[0], focus[1]);
    let cover: string | null = null;
    if (values.preview && viewEntries.length > 0) {
      const picked =
        viewEntries.find((v) => v.label === "iso") ??
        viewEntries.find((v) => !v.focus && v.label !== "top") ??
        viewEntries.find((v) => v.label !== "top") ??
        viewEntries[0];
      if (picked && (await exists(join(runDir, picked.file)))) {
        cover = `../${picked.file}`;
      }
    }
    const guide = buildGuide(grid.toDense(), assets, {
      title: titleCase(stem.replaceAll("_", " ")),
      cover,
    });
    const dir = join(runDir, "guide");
    await mkdir(dir, { recursive: true });
    for (const layer of guide.layers)
      await writeFile(join(dir, layer.name), encodePng(layer.image));
    await writeFile(join(dir, "guide.md"), guide.markdown, "utf8");
    artifacts.push({ file: "guide/guide.md", format: "guide" });
  }

  const placed = ctx.build.grid.volume.placedBounds();
  const report = buildReport({
    errors: ctx.errors,
    warnings,
    blockCounts: blockCounts(ctx.dense),
    dimensions: dimensions(ctx.build, ctx.dense),
    views: viewEntries,
    runDir,
    artifacts,
    overwrittenPlacements: ctx.build.grid.overwriteCount,
    origin: placed === null ? [0, 0, 0] : [...placed[0]],
  });
  await writeFile(join(runDir, "report.json"), reportToJson(report), "utf8");

  const dims = dimensions(ctx.build, ctx.dense);
  let line = `  ${ctx.build.grid.volume.countNonAir()} blocks, ${ctx.dense.palette.length} types, dims ${dims.join("x")} — ${ctx.errors.length} errors, ${warnings.length} warnings`;
  if (ctx.build.grid.overwriteCount)
    line += `, ${ctx.build.grid.overwriteCount} placements overwritten`;
  io.out(`run dir: ${runDir}`);
  io.out(line);
  if (viewEntries.length > 0) {
    io.out(`  faithful previews: ${viewEntries.length} in previews_faithful/`);
  }
  for (const a of artifacts) {
    if (a.format === "guide") io.out(`  guide: ${a.file}`);
    else io.out(`  artifact: ${a.file} (${a.format}, DataVersion ${a.data_version})`);
  }
  for (const e of ctx.errors) io.out(`  error: ${fmtIssue(e)}`);
  for (const w of warnings) io.out(`  warning: ${fmtIssue(w)}`);
  return ctx.errors.length > 0 ? 1 : 0;
}

/** File extensions `import` may write: the module types a recipe can be. */
const RECIPE_EXTENSIONS = [".ts", ".mts", ".mjs", ".js"];

async function cmdImport(args: string[], io: Required<Io>): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      output: { type: "string", short: "o" },
      force: { type: "boolean" },
      "keep-air": { type: "boolean" },
      raw: { type: "boolean" },
      config: { type: "string" },
    },
  });
  const [file] = positionals;
  if (file === undefined) throw new CliError("import: give a file");
  if (!(await exists(file))) throw new CliError(`no such file: ${file}`);
  // The script is plain JavaScript and valid TypeScript: `.ts` where this Node can run
  // TypeScript, `.mjs` where it cannot, unless `-o` names the file.
  const stem = file.slice(0, file.length - extname(file).length);
  const canRunTs = Boolean((process.features as { typescript?: unknown }).typescript);
  const out = values.output ?? `${stem}.${canRunTs ? "ts" : "mjs"}`;
  if (!RECIPE_EXTENSIONS.includes(extname(out).toLowerCase()))
    throw new CliError(
      `import writes a recipe: -o must end in ${RECIPE_EXTENSIONS.join(", ")} (got '${out}')`,
    );
  if ((await exists(out)) && !values.force)
    throw new CliError(`refusing to overwrite ${out} (use --force)`);

  const bytes = new Uint8Array(await readFile(file));
  const keepAir = values["keep-air"] ?? false;
  let read: {
    volume: import("voxmc-core").Volume;
    dataVersion: number | null;
    be: number;
    e: number;
  };
  try {
    switch (extname(file).toLowerCase()) {
      case ".nbt": {
        const r = await readStructureNbt(bytes, { keepAir });
        read = {
          volume: r.volume,
          dataVersion: r.meta.dataVersion,
          be: r.meta.droppedBlockEntities + r.volume.blockEntityCount,
          e: r.meta.droppedEntities + r.volume.entities.length,
        };
        break;
      }
      case ".schem": {
        const r = await readSchem(bytes, { keepAir });
        read = {
          volume: r.volume,
          dataVersion: r.meta.dataVersion,
          be: r.meta.droppedBlockEntities + r.volume.blockEntityCount,
          e: r.meta.droppedEntities + r.volume.entities.length,
        };
        break;
      }
      case ".litematic": {
        const r = await readLitematic(bytes, { keepAir });
        read = {
          volume: r.volume,
          dataVersion: r.meta.dataVersion,
          be: r.meta.droppedBlockEntities + r.volume.blockEntityCount,
          e: r.meta.droppedEntities + r.volume.entities.length,
        };
        break;
      }
      case ".mcstructure": {
        const r = await readMcstructure(bytes, { keepAir });
        for (const w of r.warnings) io.err(`warning: ${w}`);
        read = {
          volume: r.volume,
          dataVersion: null,
          be: r.meta.droppedBlockEntities + r.volume.blockEntityCount,
          e: r.meta.droppedEntities + r.volume.entities.length,
        };
        break;
      }
      default:
        throw new CliError(
          `unsupported file type '${extname(file)}' (expected .nbt, .schem, .litematic or .mcstructure)`,
        );
    }
  } catch (e) {
    if (e instanceof CliError) throw e;
    throw new CliError(e instanceof Error ? e.message : String(e));
  }
  let structure = structureFromVolume(read.volume, basename(file), {
    dataVersion: read.dataVersion,
    droppedBlockEntities: read.be,
    droppedEntities: read.e,
  });
  if (!values.raw) {
    try {
      const registry = await loadRegistry(
        await resolveConfig(resolve(file), values.config, io.home),
        io.home,
        // Cleaning the properties is optional: it uses a registry that is there, and fetches none.
        { offline: true, get: undefined, out: io.out },
      );
      structure = cleanProperties(structure, registry);
    } catch (e) {
      io.err(
        `warning: properties not cleaned and renamed blocks not updated (${(e as Error).message})`,
      );
    }
  }
  await mkdir(dirname(resolve(out)), { recursive: true });
  // As in `init`: the published command line answers to "voxmc"; inside the workspace only
  // the package name resolves.
  const specifier = BUNDLED ? "voxmc" : "voxmc-engine";
  await writeFile(out, toScript(structure, { specifier }), "utf8");
  io.out(`wrote ${out}`);
  for (const line of summary(structure, 10)) io.out(line ? `  ${line}` : "");
  return 0;
}

/** `--max -1` reads as a negative number, as in Python's argparse, not as a flag. */
function glueNegativeNumbers(args: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    const next = args[i + 1];
    if (a.startsWith("--") && !a.includes("=") && next !== undefined && /^-\d+$/.test(next)) {
      out.push(`${a}=${next}`);
      i++;
    } else out.push(a);
  }
  return out;
}

async function cmdDiff(args: string[], io: Required<Io>): Promise<number> {
  const { values, positionals } = parseArgs({
    args: glueNegativeNumbers(args),
    allowPositionals: true,
    options: { out: { type: "string", default: "dist/" }, max: { type: "string", default: "30" } },
  });
  if (positionals.length !== 0 && positionals.length !== 2)
    throw new CliError("diff: give two run ids");
  const runsDir = resolve(io.cwd, values.out as string);
  if (!(await stat(runsDir).catch(() => null))?.isDirectory())
    throw new CliError(`runs directory not found: ${runsDir}`);
  const max = Number(values.max);
  if (!Number.isInteger(max) || max < 0)
    throw new CliError(`invalid --max: ${values.max} (must be >= 0)`);
  let aDir: string;
  let bDir: string;
  if (positionals.length === 0) {
    const clean = await listCleanRuns(runsDir);
    if (clean.length < 2) {
      throw new CliError(
        `diff: found ${clean.length} clean run${clean.length === 1 ? "" : "s"} in ${runsDir} (need at least 2, or pass two run ids)`,
      );
    }
    const lastTwo = clean.slice(-2) as [string, string];
    [aDir, bDir] = lastTwo;
  } else {
    const [runA, runB] = positionals as [string, string];
    aDir = await resolveRunDir(runsDir, runA);
    bDir = await resolveRunDir(runsDir, runB);
  }
  const [aId, bId] = [basename(aDir), basename(bDir)];
  const diff = await diffRunDirs(aDir, bDir);
  io.out(formatDiff(diff, aId, bId, { maxEntries: max }));
  const imgPath = join(runsDir, `diff-${aId}-${bId}.png`);
  const made = await comparisonImage(aDir, bDir, diff, imgPath, { aId, bId });
  if (made !== null) {
    io.out(`  comparison: ${made}`);
  } else {
    io.out("  comparison: no shared preview view — image skipped");
  }
  return diff.added.length + diff.removed.length + diff.changed.length === 0 ? 0 : 1;
}

async function cmdInit(args: string[], io: Required<Io>): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { force: { type: "boolean" } },
  });
  const raw = positionals[0] ?? "house.ts";
  const target = raw.endsWith(sep) || raw.endsWith("/") ? join(raw, "house.ts") : raw;
  const abs = resolve(io.cwd, target);
  if ((await stat(abs).catch(() => null))?.isDirectory())
    throw new CliError(`not a file: ${target}`);
  if ((await exists(abs)) && !values.force) {
    throw new CliError(
      `refusing to overwrite existing file: ${target} (pass --force to overwrite)`,
    );
  }
  await mkdir(dirname(abs), { recursive: true });
  // The published command line answers to "voxmc" (the name the documentation uses); inside
  // the workspace only the package name resolves.
  const template = BUNDLED ? HOUSE_TEMPLATE.replace('"voxmc-engine"', '"voxmc"') : HOUSE_TEMPLATE;
  await writeFile(abs, template, "utf8");
  io.out(`wrote ${target}`);
  io.out(`next: voxmc check ${target}`);
  io.out(`then: voxmc run ${target}`);
  return 0;
}

async function cmdAssets(
  args: string[],
  io: Required<Io>,
  get?: Parameters<typeof fetchAssets>[2] extends infer O
    ? O extends { get?: infer G }
      ? G
      : never
    : never,
): Promise<number> {
  const [sub, ...rest] = args;
  if (sub !== "fetch") throw new CliError("assets: expected `fetch`");
  const { values } = parseArgs({
    args: rest,
    options: {
      version: { type: "string" },
      "cache-dir": { type: "string" },
      force: { type: "boolean" },
      from: { type: "string", default: "mcasset" },
    },
  });
  if (!values.version) throw new CliError("assets fetch: --version is required");
  if (!ASSET_SOURCES.includes(values.from as AssetSource))
    throw new CliError("assets fetch: --from must be mcasset or mojang");
  const cacheDir = values["cache-dir"]
    ? resolve(io.cwd, values["cache-dir"].replace(/^~(?=$|\/)/, io.home))
    : defaultCacheRoot(io.home);
  try {
    const dest = await fetchAssets(values.version, cacheDir, {
      force: values.force ?? false,
      source: values.from as AssetSource,
      ...(get ? { get } : {}),
    });
    io.out(
      `fetched ${values.version} -> ${dest} (registry + vanilla client assets: textures, models, blockstates)`,
    );
  } catch (e) {
    if (e instanceof AssetError) throw new CliError(`assets fetch failed: ${e.message}`);
    throw e;
  }
  return 0;
}

const FAMILIES: readonly Family[] = ["stairs", "slab", "full", "any"];
const FACES: readonly Face[] = ["all", "top", "side", "bottom"];

async function cmdPalette(args: string[], io: Required<Io>, get?: HttpGet): Promise<number> {
  const [sub, ...rest] = args;
  if (sub !== "near" && sub !== "ramp" && sub !== "show") {
    throw new CliError("palette: expected `near`, `ramp` or `show`");
  }
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      family: { type: "string" },
      face: { type: "string", default: "all" },
      limit: { type: "string", default: "10" },
      steps: { type: "string", default: "5" },
      version: { type: "string" },
      config: { type: "string" },
      refresh: { type: "boolean" },
      offline: { type: "boolean" },
    },
  });
  const face = values.face as Face;
  if (!FACES.includes(face))
    throw new CliError(`palette: --face must be one of ${FACES.join(", ")}`);
  if (values.family !== undefined && !FAMILIES.includes(values.family as Family)) {
    throw new CliError(`palette: --family must be one of ${FAMILIES.join(", ")}`);
  }
  const cfg = await resolveConfig(join(io.cwd, "palette"), values.config, io.home);
  const version = values.version ?? cfg.mcVersion;
  const texturesMarker = join("client", "assets", "minecraft", "textures");
  let versionDir = await findAssetVersionDir(cfg.assetsDir, version, io.home, texturesMarker);
  if (versionDir === null) {
    if (cfg.assetsDir !== null || values.offline) {
      const tried = assetVersionCandidates(cfg.assetsDir, version, io.home).join(" or ");
      throw new CliError(
        `palette: no client assets for ${version} in ${tried}; run \`voxmc assets fetch --version ${version}\``,
      );
    }
    io.out(`downloading the vanilla assets for ${version} (once)`);
    await fetchClientAssets(version, defaultCacheRoot(io.home), { ...(get ? { get } : {}) });
    versionDir = await findAssetVersionDir(cfg.assetsDir, version, io.home, texturesMarker);
    if (versionDir === null) {
      throw new CliError(
        `palette: no client assets for ${version} in ${join(defaultCacheRoot(io.home), version)}; run \`voxmc assets fetch --version ${version}\``,
      );
    }
  }
  let regDir = await findAssetVersionDir(cfg.assetsDir, version, io.home, "minecraft-data.json");
  if (regDir === null) {
    await loadRegistry({ ...cfg, mcVersion: version }, io.home, {
      offline: values.offline ?? false,
      get,
      out: io.out,
    });
    regDir = await findAssetVersionDir(cfg.assetsDir, version, io.home, "minecraft-data.json");
  }
  const stats = await loadTextureStats(versionDir, {
    refresh: values.refresh ?? false,
    ...(regDir ? { registryFile: join(regDir, "minecraft-data.json") } : {}),
  });
  const full = (name: string): string => (name.includes(":") ? name : `minecraft:${name}`);
  const statOf = (name: string): BlockStat => {
    const s = stats[full(name)];
    if (!s)
      throw new CliError(`palette: unknown block ${name} (no texture statistics for ${version})`);
    return s;
  };
  const count = (v: string, what: string, min: number): number => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < min)
      throw new CliError(`palette: ${what} must be an int >= ${min}, got ${v}`);
    return n;
  };
  const line = (m: Match): string =>
    `${m.name.replace(/^minecraft:/, "").padEnd(36)} ${hex(m.face.rgb)}  L ${m.face.lab.L.toFixed(1).padStart(5)}  a ${m.face.lab.a.toFixed(1).padStart(6)}  b ${m.face.lab.b.toFixed(1).padStart(6)}  spread ${m.face.spread.toFixed(1).padStart(4)}  dE ${m.deltaE.toFixed(1).padStart(5)}`;

  if (sub === "show") {
    if (positionals.length === 0) throw new CliError("palette show: give one or more blocks");
    for (const name of positionals) {
      const s = statOf(name);
      io.out(full(name));
      for (const f of FACES) {
        const st = s[f];
        io.out(
          `  ${f.padEnd(6)} ${hex(st.rgb)}  L ${st.lab.L.toFixed(1)}  a ${st.lab.a.toFixed(1)}  b ${st.lab.b.toFixed(1)}  spread ${st.spread.toFixed(1)}  coverage ${st.coverage}`,
        );
      }
    }
    return 0;
  }
  if (sub === "near") {
    if (positionals.length !== 1) throw new CliError("palette near: give one block");
    const target = statOf(positionals[0] as string)[face].lab;
    const family = (values.family ?? "any") as Family;
    for (const m of nearest(stats, target, {
      family,
      face,
      limit: count(values.limit, "--limit", 1),
    })) {
      io.out(line(m));
    }
    return 0;
  }
  if (positionals.length !== 2)
    throw new CliError("palette ramp: give two blocks, the first and last stop");
  const [from, to] = positionals as [string, string];
  statOf(from);
  statOf(to);
  const family = (values.family ?? "any") as Family;
  for (const m of ramp(stats, full(from), full(to), count(values.steps, "--steps", 2), {
    family,
    face,
  })) {
    io.out(line(m));
  }
  return 0;
}

/** The commands of this module; the command line in `skill/main.ts` hands them over by name. */
export const RUN_COMMANDS: readonly string[] = [
  "init",
  "check",
  "run",
  "import",
  "diff",
  "assets",
  "palette",
];

/** One line of syntax per command, without the program name. */
export const RUN_SYNTAX = `init [path] [--force]
check <script> [--config file] [--offline]
run <script> [--out dir] [--air none|explicit|all] [--config file]
    [--preview] [--guide] [--views 'iso;top'] [--count N] [--focus x0,y0,z0:x1,y1,z1]
    [--offline] (views accept optional @x1,y1,z1:x2,y2,z2 or @x,y,zr<radius> close-up focus)
import <file> [-o out.ts|out.mjs] [--force] [--keep-air] [--raw]
diff [<run-a> <run-b>] [--out dir] [--max N]
assets fetch --version V [--from mcasset|mojang] [--cache-dir dir] [--force]
palette near <block> [--family stairs|slab|full|any] [--face all|top|side|bottom] [--limit N]
palette ramp <from> <to> [--steps N] [--family F] [--face F]
palette show <block>... [--version V] [--refresh] [--offline]`;

const isHelpFlag = (a: string): boolean => a === "--help" || a === "-h";

/** The syntax lines of one command, with the program name. */
function syntaxOf(command: string): string[] {
  // Every line of the command (a command with subcommands has several), each
  // with its indented continuation lines.
  const out: string[] = [];
  let inside = false;
  for (const l of RUN_SYNTAX.split("\n")) {
    if (l.startsWith(`${command} `)) {
      out.push(`${out.length === 0 ? "Usage:" : "      "} voxmc ${l}`);
      inside = true;
    } else if (inside && l.startsWith(" ")) {
      out.push(`         ${l.trimStart()}`);
    } else {
      inside = false;
    }
  }
  return out;
}

const USAGE = `voxmc: validate and export agent-built Minecraft structures.

${RUN_SYNTAX.split("\n")
  .map((l) => (l.startsWith(" ") ? `          ${l}` : `  voxmc ${l}`))
  .join("\n")}`;

/** Run the CLI. Returns the exit code; never calls `process.exit`. */
export async function runCli(
  argv: string[],
  io: Partial<Io> = {},
  deps: { get?: HttpGet } = {},
): Promise<number> {
  const full: Required<Io> = {
    out: io.out ?? ((l) => console.log(l)),
    err: io.err ?? ((l) => console.error(l)),
    cwd: io.cwd ?? process.cwd(),
    home: io.home ?? homedir(),
  };
  const [command, ...rest] = argv;
  try {
    if (command !== undefined && RUN_COMMANDS.includes(command) && rest.some(isHelpFlag)) {
      for (const line of syntaxOf(command)) full.out(line);
      return 0;
    }
    switch (command) {
      case "init":
        return await cmdInit(rest, full);
      case "check":
        return await cmdCheck(rest, full, deps.get);
      case "run":
        return await cmdRun(rest, full, deps.get);
      case "import":
        return await cmdImport(rest, full);
      case "assets":
        return await cmdAssets(rest, full, deps.get);
      case undefined:
      case "-h":
      case "--help":
        full.out(USAGE);
        return command === undefined ? 2 : 0;
      case "diff":
        return await cmdDiff(rest, full);
      case "palette":
        return await cmdPalette(rest, full, deps.get);
      default:
        full.err(`voxmc: unknown command '${command}'\n${USAGE}`);
        return 2;
    }
  } catch (e) {
    if (e instanceof CliError || e instanceof DiffError || e instanceof VoxmcError) {
      full.err(`voxmc: ${e.message}`);
      return 1;
    }
    if (e instanceof TypeError && /Unknown option|argument/.test(e.message)) {
      full.err(`voxmc: ${e.message}`);
      return 2;
    }
    throw e;
  }
}
