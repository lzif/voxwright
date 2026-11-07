// SPDX-License-Identifier: AGPL-3.0-only

// Sponge Schematic (`.schem`), versions 2 and 3.
//
// Version 2: the root compound (named "Schematic") holds Version,
// DataVersion, Width/Height/Length, Offset, Palette, BlockData, ...
// Version 3: the root holds one compound, "Schematic", and the block data
// lives in its "Blocks" compound (Palette, Data, BlockEntities).
// Block index = (y * Length + z) * Width + x, with block data as varints.
//
// Block entities: v2 lists `{Id, Pos, ...data}` with the data flattened next
// to the id; v3 lists `{Id, Pos, Data}`. Entities are `{Id, Pos, ...}` in the
// same two layouts, `Pos` being three doubles. Positions are in the same
// coordinates as the blocks. A volume holds them as `{id, ...data}` and
// `{id, Pos, ...data}` (see `volume/entity.ts`).

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
import { AIR, entityPosition, shiftEntity, Volume, type VolumeEntity } from "../volume/index.ts";
import {
  attachBlockEntity,
  BlockTally,
  entriesWithout,
  foreignLines,
  kindOf,
  POSITION_KEYS,
  Tally,
} from "./carry.ts";
import {
  asCompound,
  asNumber,
  CodecError,
  type CodecReadOptions,
  checkExtent,
  child,
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
  /** Block entities in the file that could not be placed in the volume. */
  droppedBlockEntities: number;
  /** Entities in the file that could not be placed in the volume. */
  droppedEntities: number;
}

export interface SchemRead {
  /**
   * Cells at `(0..width-1, 0..height-1, 0..length-1)`, with their block
   * entities and the entities; air is dropped unless `keepAir`.
   */
  volume: Volume;
  meta: SchemMeta;
  /** What the file held that the volume does not, one line each. */
  warnings: string[];
}

/** The error for a legacy `.schematic`; also what `scripts/convert.ts` says for that extension. */
export const LEGACY_SCHEMATIC_MESSAGE =
  "this is a legacy .schematic file (the pre-1.13 MCEdit format with numeric block IDs), which is not supported; re-save it as .schem (for example with WorldEdit in Minecraft 1.13 or later) and open that";

/** Whether a root compound is a legacy MCEdit `.schematic`: `Blocks`/`Data` byte arrays or `Materials`, and no Sponge layout. */
function isLegacySchematic(top: CompoundTag): boolean {
  if (child(top, "Version") !== undefined || child(top, "Palette") !== undefined) return false;
  if (child(top, "Schematic")?.type === "compound") return false;
  return child(top, "Materials")?.type === "string" || child(top, "Blocks")?.type === "byteArray";
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

function compoundList(tag: NbtTag | undefined): NbtTag[] {
  return tag?.type === "list" ? tag.value : [];
}

/**
 * The compound a volume holds for a file entry: `id` first (from `Id`), then
 * `head`, then the entries of `rest` that are not in `skip`.
 */
function canonical(
  id: NbtTag | undefined,
  head: [string, NbtTag][],
  rest: Iterable<[string, NbtTag]>,
  skip: ReadonlySet<string>,
): CompoundTag {
  const out = compound();
  if (id?.type === "string") out.value.set("id", id);
  for (const [k, v] of head) out.value.set(k, v);
  for (const [k, v] of rest)
    if (!skip.has(k) && !(k === "id" && id?.type === "string")) out.value.set(k, v);
  return out;
}

function readBlockEntities(
  volume: Volume,
  list: NbtTag[],
  version: SchemVersion,
  lost: Tally,
): void {
  for (const raw of list) {
    if (raw.type !== "compound") {
      lost.addBlockEntity("unknown");
      continue;
    }
    const idTag = child(raw, "Id") ?? child(raw, "id");
    const pos = child(raw, "Pos");
    if (pos?.type !== "intArray" || pos.value.length !== 3) {
      lost.addBlockEntity(kindOf(idTag));
      continue;
    }
    const data = child(raw, "Data");
    const rest: [string, NbtTag][] =
      version === 2
        ? [...raw.value]
        : [
            ...entriesWithout(raw, new Set(["Id", "id", "Pos", "Data"])),
            ...(data?.type === "compound" ? [...data.value] : []),
          ];
    const skip = new Set([...POSITION_KEYS, ...(version === 2 ? ["Id", "Pos"] : [])]);
    const nbt = canonical(idTag, [], rest, skip);
    const [x, y, z] = [pos.value[0], pos.value[1], pos.value[2]] as [number, number, number];
    attachBlockEntity(volume, x, y, z, { edition: "java", nbt }, lost, kindOf(idTag));
  }
}

function readEntities(volume: Volume, list: NbtTag[], version: SchemVersion, lost: Tally): void {
  for (const raw of list) {
    if (raw.type !== "compound") {
      lost.addEntity("unknown");
      continue;
    }
    const idTag = child(raw, "Id") ?? child(raw, "id");
    const pos = child(raw, "Pos");
    const data = child(raw, "Data");
    const rest: [string, NbtTag][] =
      version === 2
        ? [...raw.value]
        : [
            ...entriesWithout(raw, new Set(["Id", "id", "Pos", "Data"])),
            ...(data?.type === "compound" ? [...data.value] : []),
          ];
    const nbt = canonical(
      idTag,
      pos === undefined ? [] : [["Pos", pos]],
      rest,
      new Set(["Id", "Pos"]),
    );
    if (entityPosition(nbt) === undefined) {
      lost.addEntity(kindOf(idTag));
      continue;
    }
    volume.addEntity({ edition: "java", nbt });
  }
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

  if (isLegacySchematic(top)) throw new CodecError(LEGACY_SCHEMATIC_MESSAGE);

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
  checkExtent([width, height, length], options);

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
  const dropped = new BlockTally();
  let pos = 0;
  for (let i = 0; i < total; i++) {
    let id: number;
    [id, pos] = readVarint(data, pos);
    const state = states.get(id);
    if (state === undefined)
      throw new CodecError(`block data uses palette id ${id} which is not defined`);
    const name = state.split("[", 1)[0] as string;
    const kind = dropped.note(name);
    if (kind === "skip" || (kind === "air" && !options.keepAir)) continue;
    const x = i % width;
    const z = Math.floor(i / width) % length;
    const y = Math.floor(i / (width * length));
    volume.set(x, y, z, kind === "air" ? AIR : state);
  }

  const lost = new Tally();
  readBlockEntities(volume, compoundList(blockEntities), version, lost);
  readEntities(volume, compoundList(child(schem, "Entities")), version, lost);

  const warnings = [...lost.lines("their position holds no block, or is missing or malformed")];
  warnings.push(...dropped.lines());
  const metadata = child(schem, "Metadata");
  if (metadata?.type === "compound" && metadata.value.size > 0) {
    warnings.push(`Metadata not carried over (${[...metadata.value.keys()].join(", ")})`);
  }
  // v3 keeps biomes in a "Biomes" compound; v2 in "BiomeData" with a "BiomePalette".
  if (child(schem, version === 3 ? "Biomes" : "BiomeData") !== undefined) {
    warnings.push("biomes not carried over (a volume holds no biomes)");
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
      droppedBlockEntities: lost.blockEntityCount,
      droppedEntities: lost.entityCount,
    },
    warnings,
  };
}

/**
 * The `Offset` to write for a volume read from a file whose `Offset` was
 * `offset` (`SchemMeta.offset`). A writer starts the file at the volume's
 * placed corner, which moves where the file's origin sits, so that corner is
 * added; a volume read with its air kept starts at 0 and gets `offset` back.
 */
export function carriedOffset(
  volume: Volume,
  offset: readonly [number, number, number],
): [number, number, number] {
  const bounds = volume.placedBounds();
  const corner = bounds === null ? [0, 0, 0] : bounds[0];
  return [offset[0] + corner[0], offset[1] + corner[1], offset[2] + corner[2]];
}

export interface WriteSchemOptions {
  dataVersion: number;
  /** Sponge schematic version. Default 3. */
  version?: SchemVersion;
  /** Written as the file's `Offset`. Default `[0, 0, 0]`. */
  offset?: readonly [number, number, number];
}

/** Java block entities as file entries, in y, z, x order, positions relative to `origin`. */
function writeBlockEntities(
  volume: Volume,
  origin: readonly [number, number, number],
  version: SchemVersion,
): NbtTag[] {
  const found: { x: number; y: number; z: number; nbt: CompoundTag }[] = [];
  volume.eachBlockEntity((x, y, z, e) => {
    if (e.edition === "java")
      found.push({ x: x - origin[0], y: y - origin[1], z: z - origin[2], nbt: e.nbt });
  });
  found.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
  return found.map(({ x, y, z, nbt }) => {
    const out = compound();
    const id = nbt.value.get("id");
    if (id !== undefined) out.value.set("Id", id);
    out.value.set("Pos", intArray(Int32Array.of(x, y, z)));
    const rest = entriesWithout(nbt, new Set(["id"]));
    if (version === 2) for (const [k, v] of rest) out.value.set(k, v);
    else out.value.set("Data", compound(rest));
    return out;
  });
}

/** Java entities as file entries, `Pos` relative to `origin`. */
function writeEntities(
  volume: Volume,
  origin: readonly [number, number, number],
  version: SchemVersion,
): NbtTag[] {
  return volume.entities
    .filter((e): e is VolumeEntity => e.edition === "java")
    .map((e) => {
      const { nbt } = shiftEntity(e, -origin[0], -origin[1], -origin[2]);
      const out = compound();
      const id = nbt.value.get("id");
      if (id !== undefined) out.value.set("Id", id);
      out.value.set("Pos", nbt.value.get("Pos") as NbtTag);
      const rest = entriesWithout(nbt, new Set(["id", "Pos"]));
      if (version === 2) for (const [k, v] of rest) out.value.set(k, v);
      else out.value.set("Data", compound(rest));
      return out;
    });
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

  const warnings: string[] = [...foreignLines(volume, "java")];
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

  const blockEntities = writeBlockEntities(volume, dense.origin, version);
  const entities = writeEntities(volume, dense.origin, version);
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
      ["BlockEntities", list(TagId.Compound, blockEntities)],
    );
    if (entities.length > 0) body.push(["Entities", list(TagId.Compound, entities)]);
    return { root: compound(body), warnings };
  }
  body.push([
    "Blocks",
    compound([
      ["Palette", paletteTag],
      ["Data", blockData],
      ["BlockEntities", list(TagId.Compound, blockEntities)],
    ]),
  ]);
  if (entities.length > 0) body.push(["Entities", list(TagId.Compound, entities)]);
  return { root: compound([["Schematic", compound(body)]]), warnings };
}

/** Write a {@link Volume} as a gzipped Sponge `.schem`. */
export async function writeSchem(volume: Volume, options: WriteSchemOptions): Promise<WriteResult> {
  const { root, warnings } = buildSchem(volume, options);
  // Version 2 files name their root compound "Schematic"; version 3 files name it "".
  const name = (options.version ?? 3) === 2 ? "Schematic" : "";
  return { bytes: await writeNbtGzip({ name, tag: root }), warnings };
}
