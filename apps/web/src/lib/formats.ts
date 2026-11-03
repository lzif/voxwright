// SPDX-License-Identifier: AGPL-3.0-only

// Read and write every supported schematic format, with a loss report.

import {
  readLitematic,
  readMcstructure,
  readSchem,
  readStructureNbt,
  type Volume,
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

export interface Opened {
  volume: Volume;
  dataVersion: number | null;
  /** What the source format carried that was not read, one line each. */
  loss: string[];
}

const dropped = (be: number, e: number): string[] => [
  ...(be > 0 ? [`${be} block entities were not carried over`] : []),
  ...(e > 0 ? [`${e} entities were not carried over`] : []),
];

/** Decode a file by its extension. Air is kept so a conversion can write it back. */
export async function openFile(bytes: Uint8Array, name: string): Promise<Opened> {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  switch (ext) {
    case ".nbt": {
      const r = await readStructureNbt(bytes, { keepAir: true });
      return {
        volume: r.volume,
        dataVersion: r.meta.dataVersion,
        loss: dropped(r.meta.droppedBlockEntities, r.meta.droppedEntities),
      };
    }
    case ".schem": {
      const r = await readSchem(bytes, { keepAir: true });
      return {
        volume: r.volume,
        dataVersion: r.meta.dataVersion,
        loss: dropped(r.meta.droppedBlockEntities, r.meta.droppedEntities),
      };
    }
    case ".litematic": {
      const r = await readLitematic(bytes, { keepAir: true });
      return {
        volume: r.volume,
        dataVersion: r.meta.dataVersion,
        loss: dropped(r.meta.droppedBlockEntities, r.meta.droppedEntities),
      };
    }
    case ".mcstructure": {
      const r = await readMcstructure(bytes, { keepAir: true });
      return {
        volume: r.volume,
        dataVersion: null,
        loss: [...dropped(r.meta.droppedBlockEntities, r.meta.droppedEntities), ...r.warnings],
      };
    }
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
): Promise<{ bytes: Uint8Array; warnings: string[] }> {
  const dv = dataVersion ?? DEFAULT_DATA_VERSION;
  switch (format) {
    case "nbt":
      return writeStructureNbt(volume, { dataVersion: dv });
    case "schem":
      return writeSchem(volume, { dataVersion: dv, version: 3 });
    case "schem2":
      return writeSchem(volume, { dataVersion: dv, version: 2 });
    case "litematic":
      return writeLitematic(volume, { dataVersion: dv });
    case "mcstructure":
      return writeMcstructure(volume);
  }
}
