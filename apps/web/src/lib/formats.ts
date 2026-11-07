// SPDX-License-Identifier: AGPL-3.0-only

// Read and write every supported schematic format, with a loss report.

import {
  carriedOffset,
  readLitematic,
  readMcstructure,
  readSchem,
  readStructureNbt,
  type Volume,
  type WriteLitematicOptions,
  writeLitematic,
  writeMcstructure,
  writeSchem,
  writeStructureNbt,
} from "@voxwright/core";

export const FORMATS = [
  { id: "nbt", label: "Structure block (.nbt)", ext: ".nbt" },
  { id: "schem", label: "Sponge (.schem, v3)", ext: ".schem" },
  { id: "schem2", label: "Sponge (.schem, v2)", ext: ".schem" },
  { id: "litematic", label: "Litematica (.litematic)", ext: ".litematic" },
  { id: "mcstructure", label: "Bedrock (.mcstructure)", ext: ".mcstructure" },
] as const;
export type FormatId = (typeof FORMATS)[number]["id"];

/** The DataVersion written when the source carries none (Minecraft 26.2). */
export const DEFAULT_DATA_VERSION = 4903;

/**
 * What the source file carried that its own format can write back: a `.schem`'s `Offset` and a
 * `.litematic`'s name, author and description. Only an export to the same format uses it.
 */
export interface Carried {
  schemOffset?: [number, number, number];
  litematic?: Pick<WriteLitematicOptions, "name" | "author" | "description">;
}

export interface Opened {
  volume: Volume;
  dataVersion: number | null;
  /** What the source file held that could not be read into the volume, one line each. */
  loss: string[];
  carry?: Carried;
}

/** What a `.schematic` file gets: the pre-1.13 format has block ids and data values, not block states. */
export const LEGACY_SCHEMATIC_MESSAGE =
  "'.schematic' is the legacy format from before Minecraft 1.13 and is not supported. Re-save the build as .schem (for example with WorldEdit in Minecraft 1.13 or later) and open that file.";

/** Decode a file by its extension. Air is kept so a conversion can write it back. */
export async function openFile(bytes: Uint8Array, name: string): Promise<Opened> {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  switch (ext) {
    case ".nbt": {
      const r = await readStructureNbt(bytes, { keepAir: true });
      return {
        volume: r.volume,
        dataVersion: r.meta.dataVersion,
        loss: r.warnings,
      };
    }
    case ".schem": {
      const r = await readSchem(bytes, { keepAir: true });
      return {
        volume: r.volume,
        dataVersion: r.meta.dataVersion,
        loss: r.warnings,
        carry: { schemOffset: [...r.meta.offset] },
      };
    }
    case ".litematic": {
      const r = await readLitematic(bytes, { keepAir: true });
      const { name: title, author, description } = r.meta;
      return {
        volume: r.volume,
        dataVersion: r.meta.dataVersion,
        loss: r.warnings,
        carry: {
          litematic: {
            ...(title === null ? {} : { name: title }),
            ...(author === null ? {} : { author }),
            ...(description === null ? {} : { description }),
          },
        },
      };
    }
    case ".mcstructure": {
      const r = await readMcstructure(bytes, { keepAir: true });
      return {
        volume: r.volume,
        dataVersion: null,
        loss: r.warnings,
      };
    }
    case ".schematic":
      throw new Error(LEGACY_SCHEMATIC_MESSAGE);
    default:
      throw new Error(
        `unsupported file type '${ext}' (expected .nbt, .schem, .litematic or .mcstructure)`,
      );
  }
}

/** Encode a volume; the warnings are the loss report for this conversion. */
export async function saveAs(
  volume: Volume,
  format: FormatId,
  dataVersion: number | null,
  carry?: Carried,
): Promise<{ bytes: Uint8Array; warnings: string[] }> {
  const dv = dataVersion ?? DEFAULT_DATA_VERSION;
  switch (format) {
    case "nbt":
      return writeStructureNbt(volume, { dataVersion: dv });
    case "schem":
    case "schem2":
      return writeSchem(volume, {
        dataVersion: dv,
        version: format === "schem" ? 3 : 2,
        ...(carry?.schemOffset === undefined
          ? {}
          : { offset: carriedOffset(volume, carry.schemOffset) }),
      });
    case "litematic":
      return writeLitematic(volume, { dataVersion: dv, ...carry?.litematic });
    case "mcstructure":
      return writeMcstructure(volume);
  }
}
