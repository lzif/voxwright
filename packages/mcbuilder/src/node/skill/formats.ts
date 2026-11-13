// SPDX-License-Identifier: AGPL-3.0-only

// The four schematic formats the skill CLI reads and writes, chosen by name or
// by file extension. Reading and writing follow scripts/convert.ts.

import { extname } from "node:path";
import {
  type AirMode,
  readLitematic,
  readMcstructure,
  readSchem,
  readStructureNbt,
  type SchemVersion,
  type Volume,
  type WriteResult,
  writeLitematic,
  writeMcstructure,
  writeSchem,
  writeStructureNbt,
} from "@voxwright/core";

export const FORMATS = ["schem", "litematic", "nbt", "mcstructure"] as const;
export type Format = (typeof FORMATS)[number];

export const isFormat = (s: string): s is Format => (FORMATS as readonly string[]).includes(s);

/** The format a path's extension names (case-insensitive), or `null`. */
export function formatOfPath(path: string): Format | null {
  const ext = extname(path).toLowerCase().slice(1);
  return isFormat(ext) ? ext : null;
}

export interface EncodeOptions {
  dataVersion: number;
  schemVersion: SchemVersion;
  air: AirMode;
  name?: string;
  author?: string;
}

/** Encode a volume. Bedrock `.mcstructure` carries no DataVersion. */
export async function encode(
  volume: Volume,
  format: Format,
  options: EncodeOptions,
): Promise<WriteResult> {
  switch (format) {
    case "schem":
      return writeSchem(volume, {
        dataVersion: options.dataVersion,
        version: options.schemVersion,
      });
    case "litematic":
      return writeLitematic(volume, {
        dataVersion: options.dataVersion,
        ...(options.name === undefined ? {} : { name: options.name }),
        ...(options.author === undefined ? {} : { author: options.author }),
      });
    case "nbt":
      return writeStructureNbt(volume, { dataVersion: options.dataVersion, air: options.air });
    case "mcstructure":
      return writeMcstructure(volume);
  }
}

export interface Decoded {
  format: Format;
  /** The format's own version number (Sponge 2/3, litematic version, mcstructure format_version), or `null`. */
  formatVersion: number | null;
  dataVersion: number | null;
  volume: Volume;
  /** Format-specific header fields. */
  metadata: Record<string, unknown>;
  /** Block entities and entities in the file, including any the reader could not place. */
  blockEntities: number;
  entities: number;
  warnings: string[];
}

/** Decode a file's bytes. Air cells are kept so the extent matches the file's region. */
export async function decode(bytes: Uint8Array, format: Format): Promise<Decoded> {
  const keepAir = true;
  switch (format) {
    case "schem": {
      const r = await readSchem(bytes, { keepAir });
      const m = r.meta;
      return {
        format,
        formatVersion: m.version,
        dataVersion: m.dataVersion,
        volume: r.volume,
        metadata: { offset: m.offset, size: [m.width, m.height, m.length] },
        blockEntities: r.volume.blockEntityCount + m.droppedBlockEntities,
        entities: r.volume.entities.length + m.droppedEntities,
        warnings: r.warnings,
      };
    }
    case "litematic": {
      const r = await readLitematic(bytes, { keepAir });
      const m = r.meta;
      return {
        format,
        formatVersion: m.version,
        dataVersion: m.dataVersion,
        volume: r.volume,
        metadata: {
          name: m.name,
          author: m.author,
          description: m.description,
          regions: m.regionCount,
        },
        blockEntities: r.volume.blockEntityCount + m.droppedBlockEntities,
        entities: r.volume.entities.length + m.droppedEntities,
        warnings: r.warnings,
      };
    }
    case "nbt": {
      const r = await readStructureNbt(bytes, { keepAir });
      const m = r.meta;
      return {
        format,
        formatVersion: null,
        dataVersion: m.dataVersion,
        volume: r.volume,
        metadata: {},
        blockEntities: r.volume.blockEntityCount + m.droppedBlockEntities,
        entities: r.volume.entities.length + m.droppedEntities,
        warnings: r.warnings,
      };
    }
    case "mcstructure": {
      const r = await readMcstructure(bytes, { keepAir });
      const m = r.meta;
      return {
        format,
        formatVersion: m.formatVersion,
        dataVersion: null,
        volume: r.volume,
        metadata: { size: m.size },
        blockEntities: r.volume.blockEntityCount + m.droppedBlockEntities,
        entities: r.volume.entities.length + m.droppedEntities,
        warnings: r.warnings,
      };
    }
  }
}
