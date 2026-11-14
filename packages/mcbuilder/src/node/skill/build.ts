// SPDX-License-Identifier: AGPL-3.0-only

// `voxwright-cli build <recipe> --out <path>`: run a recipe headlessly,
// validate its blocks, export the schematic and print a summary.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { AirMode, SchemVersion, WriteResult } from "@voxwright/core";
import { DATA_VERSIONS } from "../../dataversion.ts";
import type { ValidationError, ValidationWarning } from "../../registry.ts";
import type { HttpGet } from "../assets.ts";
import { CliError, findConfig } from "../cli.ts";
import {
  exists,
  loadScript,
  locateInRecipe,
  placedAt,
  ScriptError,
  scanDeterminism,
} from "../script.ts";

export { locateInRecipe };

import {
  type Box,
  boxOf,
  cacheRoot,
  DEFAULT_MC_VERSION,
  fmtBox,
  fmtPalette,
  fmtSize,
  type PaletteEntry,
  PROG,
  paletteOf,
  sizeOf,
  usageError,
  type Vec3,
} from "./common.ts";
import { encode, FORMATS, type Format, formatOfPath, isFormat } from "./formats.ts";
import { SkillCliError, type SkillIo } from "./io.ts";
import { findRegistry } from "./registry.ts";

export const BUILD_USAGE = `Usage: ${PROG} build <recipe> --out <path> [options]

Run a recipe (an ES module that exports a Build as BUILD), validate its blocks
against the block registry of the Minecraft version, and write the schematic.

Options:
  --out <path>          file to write; repeat it to write several formats at once
  --format <f>          ${FORMATS.join(" | ")}
                        (default: the extension of --out; with --format an --out
                        that has no extension gets one)
  --mc-version <v>      Minecraft version for the registry and the DataVersion
                        (default ${DEFAULT_MC_VERSION}; known: ${Object.keys(DATA_VERSIONS).join(", ")})
  --data-version <n>    DataVersion to write, for a version the CLI does not know
  --registry <file>     block registry JSON to validate against, instead of the
                        cache in ~/.cache/mcbuilder/<v>/minecraft-data.json
  --offline             never download the registry; a build without a registry
                        is exported unvalidated, with a warning
  --allow <block>       accept this block name even if the registry lacks it
                        (modded blocks); repeatable. A mcbuild.toml next to the
                        recipe can set mc_version and allowlist instead
  --schem-version <n>   Sponge schematic version to write: 2 or 3 (default 3)
  --air <mode>          .nbt only: none | explicit | all (default none)
  --name <text>         .litematic only: the schematic's name
  --author <text>       .litematic only: the schematic's author
  --json                print the summary as one JSON document
  -h, --help            show this help

Exit codes: 0 written, 1 the recipe, validation or export failed (nothing is
written), 2 usage error.`;

export interface BuildOutput {
  path: string;
  format: Format;
  bytes: number;
  /** What this format could not carry. */
  warnings: string[];
}

/** What `build` reports, as text or as `--json`. */
export interface BuildSummary {
  ok: boolean;
  recipe: string;
  /** Size of the non-air bounding box, X, Y, Z. */
  size: Vec3;
  bounds: Box | null;
  /** Non-air cells. */
  blocks: number;
  /** Distinct non-air block states. */
  blockStates: number;
  palette: PaletteEntry[];
  mcVersion: string;
  dataVersion: number | null;
  validation: {
    /** The registry's Minecraft version, or `null` when validation was skipped. */
    registry: string | null;
    /** The registry file. */
    source: string | null;
    /** Why validation was skipped. */
    skipped: string | null;
    errors: (ValidationError & { at?: string })[];
    warnings: ValidationWarning[];
  };
  /** Every warning of the run, in the order found. */
  warnings: string[];
  outputs: BuildOutput[];
}

interface Target {
  path: string;
  format: Format;
}

const LEGACY =
  "'.schematic' is the legacy format from before Minecraft 1.13 and cannot be written; use .schem";

/** Work out the file and format of every `--out`. */
export function resolveTargets(
  outs: readonly string[],
  format: string | undefined,
  cwd: string,
): Target[] {
  if (outs.length === 0) throw usageError("build: --out <path> is required");
  if (format !== undefined && !isFormat(format)) {
    throw usageError(`--format must be one of ${FORMATS.join(", ")}, got '${format}'`);
  }
  if (format !== undefined && outs.length > 1) {
    throw usageError(
      "--format cannot be combined with several --out; give each --out its extension instead",
    );
  }
  const targets: Target[] = [];
  for (const out of outs) {
    if (out === "") throw usageError("--out must not be empty");
    const ext = extname(out).toLowerCase();
    if (ext === ".schematic") throw usageError(LEGACY);
    const byExt = formatOfPath(out);
    let path = resolve(cwd, out);
    let chosen: Format;
    if (format !== undefined) {
      if (byExt !== null && byExt !== format) {
        throw usageError(`--out ${out} has the extension of ${byExt}, but --format is ${format}`);
      }
      chosen = format;
      if (ext === "") path = `${path}.${format}`;
    } else if (byExt !== null) {
      chosen = byExt;
    } else {
      throw usageError(
        `cannot tell the format of --out ${out}: use a .schem, .litematic, .nbt or .mcstructure extension, or pass --format`,
      );
    }
    if (targets.some((t) => t.path === path)) throw usageError(`--out ${out} is given twice`);
    targets.push({ path, format: chosen });
  }
  return targets;
}

const fmtError = (e: ValidationError & { at?: string }): string =>
  `${e.message}${e.at === undefined ? "" : ` (at ${e.at})`}${
    e.suggestions.length > 0 ? ` (did you mean ${e.suggestions.join(" or ")}?)` : ""
  }`;

function printSummary(s: BuildSummary, io: SkillIo): void {
  const v = s.validation;
  io.out(`build: ${s.ok ? "OK" : "FAILED"}`);
  io.out(`recipe: ${s.recipe}`);
  io.out(`size: ${fmtSize(s.size)} (X×Y×Z)`);
  io.out(`bounds: ${fmtBox(s.bounds)}`);
  io.out(`blocks: ${s.blocks}`);
  io.out(`block states: ${s.blockStates}`);
  io.out(
    `minecraft: ${s.mcVersion}${s.dataVersion === null ? "" : ` (DataVersion ${s.dataVersion})`}`,
  );
  io.out(
    v.registry === null
      ? "validation: skipped"
      : `validation: ${v.registry} registry, ${v.errors.length} ${v.errors.length === 1 ? "error" : "errors"}`,
  );
  io.out("palette:");
  for (const line of fmtPalette(s.palette)) io.out(line);
  if (v.errors.length > 0) {
    io.out("errors:");
    for (const e of v.errors) io.out(`  - ${fmtError(e)}`);
  }
  if (s.warnings.length > 0) {
    io.out("warnings:");
    for (const w of s.warnings) io.out(`  - ${w}`);
  }
  if (s.outputs.length > 0) {
    io.out("wrote:");
    for (const o of s.outputs) io.out(`  ${o.path} (${o.format}, ${o.bytes} bytes)`);
  } else {
    io.out("nothing was written");
  }
}

function parseDataVersion(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value))
    throw usageError(`--data-version must be a whole number, got '${value}'`);
  return Number(value);
}

async function resolveDataVersionFor(
  mcVersion: string,
  override: number | undefined,
  home: string,
): Promise<number> {
  if (override !== undefined) return override;
  // The client jar's version.json, when `mcbuild assets fetch` left one, is authoritative.
  const versionJson = join(cacheRoot(home), mcVersion, "version.json");
  if (await exists(versionJson)) {
    try {
      const wv = (JSON.parse(await readFile(versionJson, "utf8")) as { world_version?: unknown })
        .world_version;
      if (typeof wv === "number" && Number.isInteger(wv)) return wv;
    } catch {}
  }
  const known = Object.hasOwn(DATA_VERSIONS, mcVersion) ? DATA_VERSIONS[mcVersion] : undefined;
  if (known === undefined) {
    throw new SkillCliError(
      `unknown DataVersion for Minecraft '${mcVersion}' (known versions: ${Object.keys(DATA_VERSIONS).join(", ")}); pass --data-version <n>`,
      2,
    );
  }
  return known;
}

/** Run `build` with the arguments after the subcommand. */
export async function cmdBuild(
  args: string[],
  io: SkillIo,
  deps: { get?: HttpGet } = {},
): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      out: { type: "string", multiple: true },
      format: { type: "string" },
      "mc-version": { type: "string" },
      "data-version": { type: "string" },
      registry: { type: "string" },
      offline: { type: "boolean" },
      allow: { type: "string", multiple: true },
      "schem-version": { type: "string" },
      air: { type: "string" },
      name: { type: "string" },
      author: { type: "string" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    for (const line of BUILD_USAGE.split("\n")) io.out(line);
    return 0;
  }
  if (positionals.length !== 1) {
    throw usageError(`build takes exactly one recipe, got ${positionals.length}`);
  }
  const targets = resolveTargets(values.out ?? [], values.format, io.cwd);
  const schemVersion = Number(values["schem-version"] ?? "3");
  if (schemVersion !== 2 && schemVersion !== 3) {
    throw usageError(`--schem-version must be 2 or 3, got '${values["schem-version"]}'`);
  }
  const air = values.air ?? "none";
  if (!["none", "explicit", "all"].includes(air)) {
    throw usageError(`--air must be none, explicit or all, got '${air}'`);
  }
  const dataVersionOverride = parseDataVersion(values["data-version"]);
  const json = values.json === true;
  const recipe = resolve(io.cwd, positionals[0] as string);
  // A `mcbuild.toml` next to the recipe (or above it) gives the version and the allowlist, as it
  // does for `check` and `run`; the command line wins over it.
  let config: Awaited<ReturnType<typeof findConfig>>;
  try {
    config = await findConfig(dirname(recipe), io.home);
  } catch (e) {
    if (e instanceof CliError) throw new SkillCliError(e.message);
    throw e;
  }
  const mcVersion = values["mc-version"] ?? config?.mcVersion ?? DEFAULT_MC_VERSION;
  if (mcVersion === "") throw usageError("--mc-version must not be empty");

  try {
    const summary = await runBuild({
      recipe,
      targets,
      mcVersion,
      dataVersionOverride,
      registryFile: values.registry,
      offline: values.offline === true,
      allow: [...(config?.allowlist ?? []), ...(values.allow ?? [])],
      schemVersion,
      air: air as AirMode,
      name: values.name,
      author: values.author,
      io,
      get: deps.get,
    });
    if (json) io.out(JSON.stringify(summary, null, 2));
    else printSummary(summary, io);
    return summary.ok ? 0 : 1;
  } catch (e) {
    // With --json a failed build is still one JSON document on stdout.
    if (json && e instanceof SkillCliError && e.exitCode === 1) {
      io.out(JSON.stringify({ ok: false, recipe, error: e.message }, null, 2));
      return 1;
    }
    throw e;
  }
}

interface BuildRequest {
  recipe: string;
  targets: Target[];
  mcVersion: string;
  dataVersionOverride: number | undefined;
  registryFile: string | undefined;
  offline: boolean;
  allow: string[];
  schemVersion: SchemVersion;
  air: AirMode;
  name: string | undefined;
  author: string | undefined;
  io: SkillIo;
  get: HttpGet | undefined;
}

async function runBuild(req: BuildRequest): Promise<BuildSummary> {
  let build: Awaited<ReturnType<typeof loadScript>>;
  try {
    build = await loadScript(req.recipe);
  } catch (e) {
    if (!(e instanceof ScriptError)) throw e;
    throw new SkillCliError(e.message);
  }
  const volume = build.grid.volume;
  const palette = paletteOf(volume);
  const blocks = palette.reduce((n, p) => n + p.count, 0);
  if (blocks === 0) {
    throw new SkillCliError(
      `${basename(req.recipe)} placed no blocks: place them inside BUILD.scope(() => { ... })`,
    );
  }
  const bounds = boxOf(volume.bounds());
  const warnings = scanDeterminism(await readFile(req.recipe, "utf8"), basename(req.recipe));

  const found = await findRegistry({
    mcVersion: req.mcVersion,
    offline: req.offline,
    cwd: req.io.cwd,
    home: req.io.home,
    ...(req.registryFile === undefined ? {} : { file: req.registryFile }),
    ...(req.get === undefined ? {} : { get: req.get }),
  });
  // Where the script first placed a block, for the errors and warnings about it.
  const at = (block: string): { at?: string } => {
    const where = placedAt(build.grid, block, req.recipe);
    return where === null ? {} : { at: where };
  };
  let errors: (ValidationError & { at?: string })[] = [];
  let registryWarnings: ValidationWarning[] = [];
  if (found.registry === null) {
    warnings.push(
      `validation skipped: ${found.skipped}; block names and block states were not checked`,
    );
  } else {
    const result = found.registry.validate(
      palette.map((p) => p.state),
      req.allow,
    );
    // The registry's advice names mcbuild's config file; this CLI takes the allowlist as a flag.
    errors = result.errors.map((e) => ({
      ...e,
      ...at(e.block),
      message: e.message.replace(
        "add it to `allowlist` in mcbuild.toml",
        `pass --allow ${e.block.replace(/[[{].*$/s, "")}`,
      ),
    }));
    registryWarnings = result.warnings;
    warnings.push(...registryWarnings.map((w) => w.message));
  }

  const summary: BuildSummary = {
    ok: errors.length === 0,
    recipe: req.recipe,
    size: sizeOf(bounds),
    bounds,
    blocks,
    blockStates: palette.length,
    palette,
    mcVersion: req.mcVersion,
    dataVersion: null,
    validation: {
      registry: found.registry?.version ?? null,
      source: found.source,
      skipped: found.skipped,
      errors,
      warnings: registryWarnings,
    },
    warnings,
    outputs: [],
  };
  if (!summary.ok) return summary;

  const dataVersion = await resolveDataVersionFor(
    req.mcVersion,
    req.dataVersionOverride,
    req.io.home,
  );
  summary.dataVersion = dataVersion;

  // Encode everything before writing anything: a failed format leaves no partial set of files.
  const encoded: { target: Target; result: WriteResult }[] = [];
  for (const target of req.targets) {
    try {
      const result = await encode(volume, target.format, {
        dataVersion,
        schemVersion: req.schemVersion,
        air: req.air,
        // A litematic shows its name in Litematica's list: default to the recipe's file name.
        name: req.name ?? basename(req.recipe, extname(req.recipe)),
        ...(req.author === undefined ? {} : { author: req.author }),
      });
      encoded.push({ target, result });
    } catch (e) {
      throw new SkillCliError(
        `could not write ${target.format}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  for (const { target, result } of encoded) {
    await mkdir(dirname(target.path), { recursive: true });
    await writeFile(target.path, result.bytes);
    summary.outputs.push({
      path: target.path,
      format: target.format,
      bytes: result.bytes.byteLength,
      warnings: result.warnings,
    });
    warnings.push(...result.warnings.map((w) => `${basename(target.path)}: ${w}`));
  }
  return summary;
}
