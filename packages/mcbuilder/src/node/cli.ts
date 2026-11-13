// SPDX-License-Identifier: AGPL-3.0-only

// The `mcbuild` command line.
//
//   mcbuild init [path] [--force]
//   mcbuild check <script> [--config file]
//   mcbuild run <script> [--out dir] [--air none|explicit|all] [--config file]
//                [--preview] [--guide] [--views 'iso;top'] [--count N] [--focus x0,y0,z0:x1,y1,z1]
//   mcbuild import <file> [-o out] [--force] [--keep-air] [--raw] [--config file]
//   mcbuild diff <run-a> <run-b> [--out dir] [--max N]
//   mcbuild assets fetch --version V [--cache-dir dir] [--force]
//
// A builder script is a TypeScript (or JavaScript) module that exports a
// `Build` as `BUILD`. `diff` does not write its comparison image yet.

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import {
  type AirMode,
  readLitematic,
  readMcstructure,
  readSchem,
  readStructureNbt,
  writeStructureNbt,
} from "@voxwright/core";
import {
  renderView,
  resolveViews,
  untrustedBlocks,
  type View,
  ViewError,
  withCount,
} from "@voxwright/render";
import { directoryAssets, encodePng } from "@voxwright/render/node";
import { type McbuildConfig, parseConfig, resolveAssetsDir } from "../config.ts";
import { ExportError, resolveDataVersion } from "../dataversion.ts";
import { DiffError, formatDiff } from "../diff.ts";
import { McbuilderError } from "../errors.ts";
import { buildGuide, titleCase } from "../guide.ts";
import { cleanProperties, structureFromVolume, summary, toScript } from "../importer.ts";
import { Registry, RegistryError } from "../registry.ts";
import { buildReport, reportToJson, viewEntry } from "../report.ts";
import { AssetError, fetchAssets, type HttpGet } from "./assets.ts";
import { diffRunDirs, resolveRunDir } from "./diff.ts";
import { blockCounts, dimensions, exists, loadScript, scanDeterminism } from "./script.ts";

export class CliError extends Error {}

export interface Io {
  out: (line: string) => void;
  err: (line: string) => void;
  cwd?: string;
  home?: string;
}

const defaultCacheRoot = (home: string): string => join(home, ".cache", "mcbuilder");

export const HOUSE_TEMPLATE = `// house.ts: starter build written by \`mcbuild init\`.
//
// Loop:  mcbuild check house.ts   ->   mcbuild run house.ts
// Change numbers, run again.
import { Build, patches } from "@voxwright/mcbuilder";

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

async function findConfig(startDir: string, home: string): Promise<McbuildConfig | null> {
  let dir = resolve(startDir);
  for (;;) {
    const candidate = join(dir, "mcbuild.toml");
    if (await exists(candidate)) {
      try {
        return parseConfig(await readFile(candidate, "utf8"), { home, source: candidate });
      } catch (e) {
        throw new CliError(`invalid mcbuild.toml: ${(e as Error).message}`);
      }
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
): Promise<McbuildConfig> {
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

function cacheRoot(cfg: McbuildConfig, home: string): string {
  return cfg.assetsDir ?? defaultCacheRoot(home);
}

async function loadRegistry(cfg: McbuildConfig, home: string): Promise<Registry> {
  const path = join(cacheRoot(cfg, home), cfg.mcVersion, "minecraft-data.json");
  if (!(await exists(path))) {
    throw new CliError(
      new RegistryError(
        `block registry for version '${cfg.mcVersion}' not found at ${path} — run \`mcbuild assets fetch --version ${cfg.mcVersion}\` first.`,
      ).message,
    );
  }
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

async function loadAndValidate(script: string, config: string | undefined, home: string) {
  const build = await loadScript(script);
  const cfg = await resolveConfig(script, config, home);
  const detWarnings = scanDeterminism(await readFile(script, "utf8"), basename(script));
  const registry = await loadRegistry(cfg, home);
  const dense = build.grid.toDense();
  const { errors, warnings } = registry.validate(dense.palette, cfg.allowlist);
  return {
    build,
    cfg,
    dense,
    errors: errors as unknown as Issue[],
    warnings: [...warnings, ...detWarnings.map((message) => ({ message }))] as unknown as Issue[],
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

async function cmdCheck(args: string[], io: Required<Io>): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { config: { type: "string" } },
  });
  const [script] = positionals;
  if (script === undefined) throw new CliError("check: give a script");
  const ctx = await loadAndValidate(script, values.config, io.home);
  const blocks = ctx.build.grid.volume.countNonAir();
  io.out(
    `${basename(script)} — ${ctx.errors.length === 0 ? "OK" : "FAILED"} (${blocks} blocks, ${ctx.dense.palette.length} types, ${ctx.errors.length} errors, ${ctx.warnings.length} warnings)`,
  );
  for (const e of ctx.errors) io.out(`  error: ${fmtIssue(e)}`);
  for (const w of ctx.warnings) io.out(`  warning: ${fmtIssue(w)}`);
  return ctx.errors.length > 0 ? 1 : 0;
}

async function cmdRun(args: string[], io: Required<Io>): Promise<number> {
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

  const ctx = await loadAndValidate(script, values.config, io.home);
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
    // `resolveAssetsDir` is already the version directory (`<cache>/<ver>/` by
    // default, as `assets fetch` lays it out; as given for an explicit
    // `assets_dir`, like the Python CLI). An explicit `assets_dir` that is the
    // unversioned cache root also works: `<assets_dir>/<ver>/version.json`.
    const versionDir = resolveAssetsDir(ctx.cfg, io.home).replace(/[\\/]+$/, "");
    const candidates = [join(versionDir, "version.json")];
    if (ctx.cfg.assetsDir) candidates.push(join(versionDir, ctx.cfg.mcVersion, "version.json"));
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
  const viewEntries: ReturnType<typeof viewEntry>[] = [];
  if (values.preview && ctx.errors.length === 0) {
    const root = join(
      ctx.cfg.assetsDir ?? defaultCacheRoot(io.home),
      ctx.cfg.mcVersion,
      "client",
      "assets",
      "minecraft",
    );
    const haveAssets = await exists(join(root, "blockstates"));
    if (!haveAssets) {
      warnings.push({
        message:
          "faithful preview: vanilla client assets not found — all blocks rendered as fallback cubes",
      });
    }
    const grid = focus === null ? ctx.build.grid : ctx.build.grid.crop(focus[0], focus[1]);
    if (focus !== null && grid.volume.countNonAir() === 0)
      throw new CliError(`--focus ${values.focus}: no blocks inside that box`);
    const dense = grid.toDense();
    const assets = haveAssets ? directoryAssets(root) : null;
    for (const [name, n] of untrustedBlocks(dense, assets)) {
      warnings.push({
        message: `faithful preview: ${n} \`${name}\` rendered as magenta fallback cube — orientation not verified`,
      });
    }
    const dir = join(runDir, "previews_faithful");
    await mkdir(dir, { recursive: true });
    for (const view of viewList) {
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
    const root = join(
      ctx.cfg.assetsDir ?? defaultCacheRoot(io.home),
      ctx.cfg.mcVersion,
      "client",
      "assets",
      "minecraft",
    );
    const haveAssets = await exists(join(root, "blockstates"));
    const grid = focus === null ? ctx.build.grid : ctx.build.grid.crop(focus[0], focus[1]);
    const iso = join(runDir, "previews_faithful", "iso.png");
    const guide = buildGuide(grid.toDense(), haveAssets ? directoryAssets(root) : null, {
      title: titleCase(stem.replaceAll("_", " ")),
      cover: (await exists(iso)) ? "../previews_faithful/iso.png" : null,
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
  const out = values.output ?? `${file.slice(0, file.length - extname(file).length)}.ts`;
  if ((await exists(out)) && !values.force)
    throw new CliError(`refusing to overwrite ${out} (use --force)`);

  const bytes = new Uint8Array(await readFile(file));
  const keepAir = values["keep-air"] ?? false;
  let read: {
    volume: import("@voxwright/core").Volume;
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
      );
      structure = cleanProperties(structure, registry);
    } catch (e) {
      io.err(`warning: properties not cleaned (${(e as Error).message})`);
    }
  }
  await mkdir(dirname(resolve(out)), { recursive: true });
  await writeFile(out, toScript(structure), "utf8");
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
  const [runA, runB] = positionals;
  if (runA === undefined || runB === undefined || positionals.length !== 2)
    throw new CliError("diff: give two run ids");
  const runsDir = resolve(io.cwd, values.out as string);
  if (!(await stat(runsDir).catch(() => null))?.isDirectory())
    throw new CliError(`runs directory not found: ${runsDir}`);
  const max = Number(values.max);
  if (!Number.isInteger(max) || max < 0)
    throw new CliError(`invalid --max: ${values.max} (must be >= 0)`);
  const aDir = await resolveRunDir(runsDir, runA);
  const bDir = await resolveRunDir(runsDir, runB);
  const diff = await diffRunDirs(aDir, bDir);
  io.out(formatDiff(diff, basename(aDir), basename(bDir), { maxEntries: max }));
  io.out("  comparison: image not ported yet");
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
  await writeFile(abs, HOUSE_TEMPLATE, "utf8");
  io.out(`wrote ${target}`);
  io.out(`next: mcbuild check ${target}`);
  io.out(`then: mcbuild run ${target}`);
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
    },
  });
  if (!values.version) throw new CliError("assets fetch: --version is required");
  const cacheDir = values["cache-dir"]
    ? resolve(io.cwd, values["cache-dir"].replace(/^~(?=$|\/)/, io.home))
    : defaultCacheRoot(io.home);
  try {
    const dest = await fetchAssets(values.version, cacheDir, {
      force: values.force ?? false,
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

const USAGE = `mcbuild: validate and export agent-built Minecraft structures.

  mcbuild init [path] [--force]
  mcbuild check <script> [--config file]
  mcbuild run <script> [--out dir] [--air none|explicit|all] [--config file]\n                [--preview] [--guide] [--views 'iso;top'] [--count N] [--focus x0,y0,z0:x1,y1,z1]
  mcbuild import <file> [-o out] [--force] [--keep-air] [--raw]
  mcbuild diff <run-a> <run-b> [--out dir] [--max N]
  mcbuild assets fetch --version V [--cache-dir dir] [--force]

mcbuild diff does not write its comparison image yet (not ported).`;

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
    switch (command) {
      case "init":
        return await cmdInit(rest, full);
      case "check":
        return await cmdCheck(rest, full);
      case "run":
        return await cmdRun(rest, full);
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
      default:
        full.err(`mcbuild: unknown command '${command}'\n${USAGE}`);
        return 2;
    }
  } catch (e) {
    if (e instanceof CliError || e instanceof DiffError || e instanceof McbuilderError) {
      full.err(`mcbuild: ${e.message}`);
      return 1;
    }
    if (e instanceof TypeError && /Unknown option|argument/.test(e.message)) {
      full.err(`mcbuild: ${e.message}`);
      return 2;
    }
    throw e;
  }
}
