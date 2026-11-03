// SPDX-License-Identifier: AGPL-3.0-only

// Convert a schematic between formats.
//
//   node scripts/convert.ts in.schem out.nbt
//   node scripts/convert.ts in.nbt out.schem [--version 2|3] [--air none|explicit|all]
//
// Formats are chosen by file extension. Reads `.schem` (Sponge v2 and v3)
// and structure-block `.nbt`; writes either. Block entities and entities
// are not carried over, and the script says how many were dropped.

import { readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { parseArgs } from "node:util";
import {
  type AirMode,
  readSchem,
  readStructureNbt,
  type SchemVersion,
  type Volume,
  writeSchem,
  writeStructureNbt,
} from "../packages/core/src/index.ts";

/** DataVersion for Minecraft 26.2, used when the input file does not carry one. */
const DEFAULT_DATA_VERSION = 4903;

const USAGE = `usage: node scripts/convert.ts <input.(schem|nbt)> <output.(schem|nbt)>
       [--version 2|3]         Sponge version to write (default 3)
       [--air none|explicit|all]  how .nbt output treats air (default none)
       [--data-version N]      override the DataVersion written`;

function fail(message: string): never {
  console.error(`convert: ${message}`);
  process.exit(1);
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
  if (inExt !== ".schem" && inExt !== ".nbt") fail(`unsupported input format '${inExt}'`);
  if (outExt !== ".schem" && outExt !== ".nbt") fail(`unsupported output format '${outExt}'`);

  const version = values.version === undefined ? 3 : Number(values.version);
  if (version !== 2 && version !== 3) fail(`--version must be 2 or 3, got '${values.version}'`);
  const air = (values.air ?? "none") as AirMode;
  if (!["none", "explicit", "all"].includes(air)) fail(`--air must be none, explicit or all`);
  const override = values["data-version"] === undefined ? null : Number(values["data-version"]);
  if (override !== null && !Number.isInteger(override)) fail("--data-version must be an integer");

  const bytes = new Uint8Array(await readFile(input));
  // Carved air has to survive a conversion into a format that can express it.
  const keepAir = outExt === ".schem" || air !== "none";

  let volume: Volume;
  let dataVersion: number | null;
  let dropped: string[];
  if (inExt === ".schem") {
    const r = await readSchem(bytes, { keepAir });
    volume = r.volume;
    dataVersion = r.meta.dataVersion;
    dropped = [
      `${r.meta.droppedBlockEntities} block entities`,
      `${r.meta.droppedEntities} entities`,
    ];
  } else {
    const r = await readStructureNbt(bytes, { keepAir });
    volume = r.volume;
    dataVersion = r.meta.dataVersion;
    dropped = [
      `${r.meta.droppedBlockEntities} block entities`,
      `${r.meta.droppedEntities} entities`,
    ];
  }

  if (volume.size === 0) fail(`${input} contains no blocks`);
  const dv = override ?? dataVersion ?? DEFAULT_DATA_VERSION;

  const result =
    outExt === ".nbt"
      ? await writeStructureNbt(volume, { dataVersion: dv, air })
      : await writeSchem(volume, { dataVersion: dv, version: version as SchemVersion });

  await writeFile(output, result.bytes);
  for (const w of result.warnings) console.error(`warning: ${w}`);
  console.log(
    `${input} -> ${output}: ${volume.countNonAir()} blocks, ${volume.palette.length} palette entries, DataVersion ${dv}; dropped ${dropped.join(", ")}`,
  );
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
