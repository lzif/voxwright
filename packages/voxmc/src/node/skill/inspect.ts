// SPDX-License-Identifier: AGPL-3.0-only

// `voxwright-cli inspect <schematic>`: what a schematic file holds.

import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { LEGACY_SCHEMATIC_MESSAGE } from "@voxwright/core";
import { exists } from "../script.ts";
import {
  type Box,
  boxOf,
  fmtBox,
  fmtPalette,
  fmtSize,
  type PaletteEntry,
  PROG,
  paletteOf,
  releaseOf,
  sizeOf,
  usageError,
  type Vec3,
} from "./common.ts";
import { decode, type Format, formatOfPath } from "./formats.ts";
import { SkillCliError, type SkillIo } from "./io.ts";

export const INSPECT_USAGE = `Usage: ${PROG} inspect <schematic> [--json]

Print what a .schem, .litematic, .nbt or .mcstructure file holds: format,
DataVersion, size, block count, palette, block entities, entities and anything
the reader could not carry.

Options:
  --json        print the report as one JSON document
  -h, --help    show this help`;

/** What `inspect` reports, as text or as `--json`. */
export interface InspectReport {
  file: string;
  format: Format;
  /** Sponge version, litematic version or mcstructure format_version; `null` for `.nbt`. */
  formatVersion: number | null;
  dataVersion: number | null;
  /** The Minecraft release of `dataVersion`, when the CLI knows it. */
  mcVersion: string | null;
  /** Size of the file's region, air included, X, Y, Z. */
  size: Vec3;
  /** Bounding box of the non-air blocks, in the file's coordinates. */
  bounds: Box | null;
  blocks: number;
  blockStates: number;
  blockEntities: number;
  entities: number;
  metadata: Record<string, unknown>;
  palette: PaletteEntry[];
  warnings: string[];
}

const fmtValue = (v: unknown): string =>
  Array.isArray(v) ? v.join(",") : v === null || v === undefined || v === "" ? "none" : String(v);

/** Run `inspect` with the arguments after the subcommand. */
export async function cmdInspect(args: string[], io: SkillIo): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { json: { type: "boolean" }, help: { type: "boolean", short: "h" } },
  });
  if (values.help) {
    for (const line of INSPECT_USAGE.split("\n")) io.out(line);
    return 0;
  }
  if (positionals.length !== 1) {
    throw usageError(`inspect takes exactly one file, got ${positionals.length}`);
  }
  const file = resolve(io.cwd, positionals[0] as string);
  if (extname(file).toLowerCase() === ".schematic") throw usageError(LEGACY_SCHEMATIC_MESSAGE);
  const format = formatOfPath(file);
  if (format === null) {
    throw usageError(
      `cannot inspect '${positionals[0]}': expected a .schem, .litematic, .nbt or .mcstructure file`,
    );
  }
  if (!(await exists(file))) throw new SkillCliError(`no such file: ${file}`);
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await readFile(file));
  } catch (e) {
    throw new SkillCliError(`could not read ${file}: ${(e as Error).message}`);
  }
  let decoded: Awaited<ReturnType<typeof decode>>;
  try {
    decoded = await decode(bytes, format);
  } catch (e) {
    throw new SkillCliError(`${file} is not a readable ${format} file: ${(e as Error).message}`);
  }

  const palette = paletteOf(decoded.volume);
  const report: InspectReport = {
    file,
    format,
    formatVersion: decoded.formatVersion,
    dataVersion: decoded.dataVersion,
    mcVersion: decoded.dataVersion === null ? null : releaseOf(decoded.dataVersion),
    size: sizeOf(boxOf(decoded.volume.placedBounds())),
    bounds: boxOf(decoded.volume.bounds()),
    blocks: palette.reduce((n, p) => n + p.count, 0),
    blockStates: palette.length,
    blockEntities: decoded.blockEntities,
    entities: decoded.entities,
    metadata: decoded.metadata,
    palette,
    warnings: decoded.warnings,
  };

  if (values.json) {
    io.out(JSON.stringify(report, null, 2));
    return 0;
  }
  io.out(`file: ${report.file}`);
  io.out(
    `format: ${report.format}${report.formatVersion === null ? "" : ` (version ${report.formatVersion})`}`,
  );
  io.out(
    report.dataVersion === null
      ? "minecraft: Bedrock (no DataVersion)"
      : `minecraft: DataVersion ${report.dataVersion}${report.mcVersion === null ? "" : ` (${report.mcVersion})`}`,
  );
  io.out(`size: ${fmtSize(report.size)} (X×Y×Z)`);
  io.out(`bounds: ${fmtBox(report.bounds)}`);
  io.out(`blocks: ${report.blocks}`);
  io.out(`block states: ${report.blockStates}`);
  io.out(`block entities: ${report.blockEntities}`);
  io.out(`entities: ${report.entities}`);
  const meta = Object.entries(report.metadata);
  if (meta.length > 0) {
    io.out("metadata:");
    for (const [k, v] of meta) io.out(`  ${k}: ${fmtValue(v)}`);
  }
  io.out("palette:");
  for (const line of fmtPalette(report.palette)) io.out(line);
  if (report.warnings.length > 0) {
    io.out("warnings:");
    for (const w of report.warnings) io.out(`  - ${w}`);
  }
  return 0;
}
