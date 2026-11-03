// SPDX-License-Identifier: AGPL-3.0-only

// Sponge Schematic (`.schem`), versions 2 and 3.
//
// Version 2: the root compound (named "Schematic") holds Version,
// DataVersion, Width/Height/Length, Offset, Palette, BlockData, ...
// Version 3: the root holds one compound, "Schematic", and the block data
// lives in its "Blocks" compound (Palette, Data, BlockEntities).
// Block index = (y * Length + z) * Width + x, with block data as varints.

import { canonicalize } from "../blocks/index.ts";
import {
  byteArray,
  type CompoundTag,
  compound,
  int,
  intArray,
  list,
  type NbtTag,
  readNbtFile,
  short,
  TagId,
  writeNbtGzip,
} from "../nbt/index.ts";
import { AIR, Volume } from "../volume/index.ts";
import {
  AIR_BLOCKS,
  asCompound,
  asNumber,
  CodecError,
  type CodecReadOptions,
  child,
  SKIP_BLOCKS,
  type WriteResult,
} from "./common.ts";

export type SchemVersion = 2 | 3;

export interface SchemMeta {
  version: SchemVersion;
  dataVersion: number | null;
  /** The file's `Offset`: where its origin sits relative to the paste point. */
  offset: [number, number, number];
  width: number;
  height: number;
  length: number;
  droppedBlockEntities: number;
  droppedEntities: number;
}

export interface SchemRead {
  /** Cells at `(0..width-1, 0..height-1, 0..length-1)`; air is dropped unless `keepAir`. */
  volume: Volume;
  meta: SchemMeta;
}

function readVarint(data: Uint8Array, pos: number): [value: number, next: number] {
  let value = 0;
  let shift = 0;
  let p = pos;
  for (;;) {
    const b = data[p++];
    if (b === undefined) throw new CodecError("BlockData ends inside a varint");
    value += (b & 0x7f) * 2 ** shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
    if (shift > 35) throw new CodecError("BlockData varint is too long");
  }
  return [value, p];
}

function writeVarint(out: number[], value: number): void {
  let v = value;
  while (v >= 0x80) {
    out.push((v % 0x80) | 0x80);
    v = Math.floor(v / 0x80);
  }
  out.push(v);
}

function dimension(tag: CompoundTag, name: string): number {
  // Stored as an unsigned short.
  return asNumber(child(tag, name), name) & 0xffff;
}

function readOffset(tag: CompoundTag): [number, number, number] {
  const t = child(tag, "Offset");
  if (t?.type === "intArray" && t.value.length === 3) {
    return [t.value[0] as number, t.value[1] as number, t.value[2] as number];
  }
  return [0, 0, 0];
}

function countList(tag: NbtTag | undefined): number {
  return tag?.type === "list" ? tag.value.length : 0;
}

/** Read a Sponge `.schem` (version 2 or 3, gzipped or not) into a {@link Volume}. */
export async function readSchem(
  bytes: Uint8Array,
  options: CodecReadOptions = {},
): Promise<SchemRead> {
  let top: CompoundTag;
  try {
    top = (await readNbtFile(bytes)).tag;
  } catch (e) {
    throw new CodecError(`not a readable NBT file (${e instanceof Error ? e.message : String(e)})`);
  }

  const nested = child(top, "Schematic");
  const isV3 = nested?.type === "compound";
  const schem = isV3 ? nested : top;
  const version = asNumber(child(schem, "Version"), "Version");
  if (version !== 2 && version !== 3) {
    throw new CodecError(`unsupported Sponge schematic version ${version} (expected 2 or 3)`);
  }
  if ((version === 3) !== isV3) {
    throw new CodecError(`Sponge schematic version ${version} has the wrong layout`);
  }

  const width = dimension(schem, "Width");
  const height = dimension(schem, "Height");
  const length = dimension(schem, "Length");

  let paletteTag: NbtTag | undefined;
  let dataTag: NbtTag | undefined;
  let blockEntities: NbtTag | undefined;
  if (version === 3) {
    const blocks = asCompound(child(schem, "Blocks"), "Blocks");
    paletteTag = child(blocks, "Palette");
    dataTag = child(blocks, "Data");
    blockEntities = child(blocks, "BlockEntities");
  } else {
    paletteTag = child(schem, "Palette");
    dataTag = child(schem, "BlockData");
    blockEntities = child(schem, "BlockEntities");
  }
  const palette = asCompound(paletteTag, "Palette");
  if (dataTag?.type !== "byteArray") throw new CodecError("block data must be a byte array");
  const data = new Uint8Array(
    dataTag.value.buffer,
    dataTag.value.byteOffset,
    dataTag.value.byteLength,
  );

  const states = new Map<number, string>();
  for (const [key, value] of palette.value) {
    const id = asNumber(value, `palette id for ${key}`);
    let canonical: string;
    try {
      canonical = canonicalize(key);
    } catch (e) {
      throw new CodecError(
        `bad palette entry '${key}': ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    states.set(id, canonical.includes(":") ? canonical : `minecraft:${canonical}`);
  }

  const total = width * height * length;
  if (total > 0x7fffffff)
    throw new CodecError(`schematic ${width}x${height}x${length} is too large`);
  // One varint is at least one byte, so a short array cannot cover the volume.
  if (data.length < total) {
    throw new CodecError(
      `block data holds fewer than ${total} entries for ${width}x${height}x${length}`,
    );
  }

  const volume = new Volume();
  let pos = 0;
  for (let i = 0; i < total; i++) {
    let id: number;
    [id, pos] = readVarint(data, pos);
    const state = states.get(id);
    if (state === undefined)
      throw new CodecError(`block data uses palette id ${id} which is not defined`);
    const name = state.split("[", 1)[0] as string;
    if (SKIP_BLOCKS.has(name)) continue;
    if (AIR_BLOCKS.has(name)) {
      if (!options.keepAir) continue;
    }
    const x = i % width;
    const z = Math.floor(i / width) % length;
    const y = Math.floor(i / (width * length));
    volume.set(x, y, z, AIR_BLOCKS.has(name) ? AIR : state);
  }

  const dv = child(schem, "DataVersion");
  return {
    volume,
    meta: {
      version,
      dataVersion: dv === undefined ? null : asNumber(dv, "DataVersion"),
      offset: readOffset(schem),
      width,
      height,
      length,
      droppedBlockEntities: countList(blockEntities),
      droppedEntities: countList(child(schem, "Entities")),
    },
  };
}

export interface WriteSchemOptions {
  dataVersion: number;
  /** Sponge schematic version. Default 3. */
  version?: SchemVersion;
  /** Written as the file's `Offset`. Default `[0, 0, 0]`. */
  offset?: readonly [number, number, number];
}

/**
 * Build the schematic compound. The box is the volume's placed bounds,
 * moved to the origin; unset cells are written as air.
 */
export function buildSchem(
  volume: Volume,
  options: WriteSchemOptions,
): { root: CompoundTag; warnings: string[] } {
  const version = options.version ?? 3;
  if (version !== 2 && version !== 3)
    throw new CodecError(`unsupported version ${String(version)}`);
  const dense = volume.toDense();
  const [width, height, length] = dense.size;
  if (dense.data.length === 0) throw new CodecError("build is empty — nothing to export");
  for (const [axis, n] of [
    ["Width", width],
    ["Height", height],
    ["Length", length],
  ] as const) {
    if (n > 0xffff) throw new CodecError(`${axis} ${n} does not fit in an unsigned short`);
  }

  const warnings: string[] = [];
  const ids = new Map<string, number>();
  const paletteTag = compound();
  const idOf = (state: string): number => {
    let id = ids.get(state);
    if (id === undefined) {
      id = ids.size;
      ids.set(state, id);
      paletteTag.value.set(state, int(id));
    }
    return id;
  };

  const out: number[] = [];
  const warned = new Set<string>();
  for (let y = 0; y < height; y++) {
    for (let z = 0; z < length; z++) {
      for (let x = 0; x < width; x++) {
        const idx = dense.data[(x * height + y) * length + z] as number;
        let state = idx < 0 ? AIR : (dense.palette[idx] as string);
        const brace = state.indexOf("{");
        if (brace !== -1) {
          if (!warned.has(state)) {
            warned.add(state);
            warnings.push(
              `palette entry '${state}' carries block-entity NBT which .schem export drops (no block entities are written)`,
            );
          }
          state = state.slice(0, brace);
        }
        writeVarint(out, idOf(state));
      }
    }
  }

  const blockData = byteArray(new Int8Array(Uint8Array.from(out).buffer));
  const offset = options.offset ?? [0, 0, 0];
  const body: [string, NbtTag][] = [
    ["Version", int(version)],
    ["DataVersion", int(options.dataVersion)],
    ["Width", short(width)],
    ["Height", short(height)],
    ["Length", short(length)],
    ["Offset", intArray(Int32Array.from(offset))],
  ];
  if (version === 2) {
    body.push(
      ["PaletteMax", int(ids.size)],
      ["Palette", paletteTag],
      ["BlockData", blockData],
      ["BlockEntities", list(TagId.Compound, [])],
    );
    return { root: compound(body), warnings };
  }
  body.push([
    "Blocks",
    compound([
      ["Palette", paletteTag],
      ["Data", blockData],
      ["BlockEntities", list(TagId.Compound, [])],
    ]),
  ]);
  return { root: compound([["Schematic", compound(body)]]), warnings };
}

/** Write a {@link Volume} as a gzipped Sponge `.schem`. */
export async function writeSchem(volume: Volume, options: WriteSchemOptions): Promise<WriteResult> {
  const { root, warnings } = buildSchem(volume, options);
  // Version 2 files name their root compound "Schematic"; version 3 files name it "".
  const name = (options.version ?? 3) === 2 ? "Schematic" : "";
  return { bytes: await writeNbtGzip({ name, tag: root }), warnings };
}
