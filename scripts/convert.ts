// SPDX-License-Identifier: AGPL-3.0-only

// Convert a schematic between formats.
//
//   node scripts/convert.ts in.schem out.nbt
//   node scripts/convert.ts in.nbt out.litematic
//   node scripts/convert.ts in.litematic out.schem [--version 2|3]
//
// Formats are chosen by file extension: `.schem` (Sponge v2 and v3),
// structure-block `.nbt`, `.litematic` and Bedrock `.mcstructure`. Block
// entities and entities are not carried over, and Bedrock translation is
// rule based; the script prints a loss report of everything it dropped.

import { readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { parseArgs } from "node:util";
import {
  type AirMode,
  readLitematic,
  readMcstructure,
  readSchem,
  readStructureNbt,
  type SchemVersion,
  type Volume,
  writeLitematic,
  writeMcstructure,
  writeSchem,
  writeStructureNbt,
} from "../packages/core/src/index.ts";

/** DataVersion for Minecraft 26.2, used when the input file does not carry one. */
const DEFAULT_DATA_VERSION = 4903;

const FORMATS = [".schem", ".nbt", ".litematic", ".mcstructure"] as const;
type Format = (typeof FORMATS)[number];

const USAGE = `usage: node scripts/convert.ts <input> <output>
       formats: ${FORMATS.join(" ")} (chosen by extension)
       [--version 2|3]            Sponge version to write (default 3)
       [--air none|explicit|all]  how .nbt output treats air (default none)
       [--data-version N]         override the DataVersion written`;

function fail(message: string): never {
  console.error(`convert: ${message}`);
  process.exit(1);
}

interface Loaded {
  volume: Volume;
  dataVersion: number | null;
  /** Everything the source format carried that this conversion drops. */
  loss: string[];
}

async function load(format: Format, bytes: Uint8Array, keepAir: boolean): Promise<Loaded> {
  const counts = (be: number, e: number): string[] => [
    ...(be > 0 ? [`${be} block entities were not carried over`] : []),
    ...(e > 0 ? [`${e} entities were not carried over`] : []),
  ];
  switch (format) {
    case ".schem": {
      const r = await readSchem(bytes, { keepAir });
      return {
        volume: r.volume,
        dataVersion: r.meta.dataVersion,
        loss: counts(r.meta.droppedBlockEntities, r.meta.droppedEntities),
      };
    }
    case ".nbt": {
      const r = await readStructureNbt(bytes, { keepAir });
      return {
        volume: r.volume,
        dataVersion: r.meta.dataVersion,
        loss: counts(r.meta.droppedBlockEntities, r.meta.droppedEntities),
      };
    }
    case ".litematic": {
      const r = await readLitematic(bytes, { keepAir });
      return {
        volume: r.volume,
        dataVersion: r.meta.dataVersion,
        loss: counts(r.meta.droppedBlockEntities, r.meta.droppedEntities),
      };
    }
    case ".mcstructure": {
      const r = await readMcstructure(bytes, { keepAir });
      return {
        volume: r.volume,
        dataVersion: null,
        loss: [...counts(r.meta.droppedBlockEntities, r.meta.droppedEntities), ...r.warnings],
      };
    }
  }
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      version: { type: "string" },
      air: { type: "string" },
      "data-version": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }
  const [input, output] = positionals;
  if (input === undefined || output === undefined || positionals.length !== 2) {
    console.error(USAGE);
    process.exit(2);
  }

  const inExt = extname(input).toLowerCase();
  const outExt = extname(output).toLowerCase();
  if (!FORMATS.includes(inExt as Format)) fail(`unsupported input format '${inExt}'`);
  if (!FORMATS.includes(outExt as Format)) fail(`unsupported output format '${outExt}'`);

  const version = values.version === undefined ? 3 : Number(values.version);
  if (version !== 2 && version !== 3) fail(`--version must be 2 or 3, got '${values.version}'`);
  const air = (values.air ?? "none") as AirMode;
  if (!["none", "explicit", "all"].includes(air)) fail("--air must be none, explicit or all");
  const override = values["data-version"] === undefined ? null : Number(values["data-version"]);
  if (override !== null && !Number.isInteger(override)) fail("--data-version must be an integer");

  const bytes = new Uint8Array(await readFile(input));
  // Carved air has to survive a conversion into a format that can express it.
  const keepAir = outExt !== ".nbt" || air !== "none";
  const { volume, dataVersion, loss } = await load(inExt as Format, bytes, keepAir);

  if (volume.size === 0) fail(`${input} contains no blocks`);
  const dv = override ?? dataVersion ?? DEFAULT_DATA_VERSION;

  let result: { bytes: Uint8Array; warnings: string[] };
  switch (outExt as Format) {
    case ".nbt":
      result = await writeStructureNbt(volume, { dataVersion: dv, air });
      break;
    case ".schem":
      result = await writeSchem(volume, { dataVersion: dv, version: version as SchemVersion });
      break;
    case ".litematic":
      result = await writeLitematic(volume, { dataVersion: dv });
      break;
    case ".mcstructure":
      result = writeMcstructure(volume);
      break;
  }

  await writeFile(output, result.bytes);
  const report = [...new Set([...loss, ...result.warnings])];
  for (const line of report) console.error(`loss: ${line}`);
  console.log(
    `${input} -> ${output}: ${volume.countNonAir()} blocks, ${volume.palette.length} palette entries, DataVersion ${dv}; ${report.length} loss report ${report.length === 1 ? "entry" : "entries"}`,
  );
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
