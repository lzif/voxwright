// SPDX-License-Identifier: AGPL-3.0-only

// Litematica `.litematic` (gzipped NBT, versions 5 to 7).
//
// Root: Version, MinecraftDataVersion, Metadata and Regions. Each region has
// Position, Size, a BlockStatePalette and BlockStates, a bit-packed long
// array. Palette indices are stored back to back (a value may straddle two
// longs), `max(2, ceil(log2(palette size)))` bits each, in the order
// `y * |sizeX| * |sizeZ| + z * |sizeX| + x`. A negative size on an axis means
// the region extends backwards from its Position.
//
// Each region also has `TileEntities` (the block entity's NBT with `x`, `y`,
// `z` relative to the region's lowest corner) and `Entities` (the entity's
// NBT with `Pos`, three doubles relative to the same corner). A volume holds
// block entities without `x`, `y`, `z` and entities with `Pos` in volume
// coordinates. Regions are flattened into one volume at their positions.

import { canonicalize, joinBlockString } from "../blocks/index.ts";
import {
  type CompoundTag,
  compound,
  int,
  list,
  long,
  longArray,
  type NbtTag,
  readNbtFile,
  string,
  TagId,
  writeNbtGzip,
} from "../nbt/index.ts";
import { AIR, entityPosition, shiftEntity, Volume, type VolumeEntity } from "../volume/index.ts";
import { entriesWithout, foreignLines, kindOf, POSITION_KEYS, Tally } from "./carry.ts";
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

export interface LitematicMeta {
  version: number;
  dataVersion: number | null;
  regionCount: number;
  /** Block entities in the file that could not be placed in the volume. */
  droppedBlockEntities: number;
  /** Entities in the file that could not be placed in the volume. */
  droppedEntities: number;
}

export interface LitematicRead {
  /**
   * All regions placed at their positions, with their block entities and
   * entities, then shifted so the smallest kept coordinate is 0.
   */
  volume: Volume;
  meta: LitematicMeta;
  /** What the file held that the volume does not, one line each. */
  warnings: string[];
}

function bitsFor(paletteSize: number): number {
  return Math.max(2, 32 - Math.clz32(Math.max(paletteSize - 1, 1)));
}

/** Read `count` packed values. */
function unpack(words: BigInt64Array, bits: number, count: number): Int32Array {
  const needed = Math.ceil((count * bits) / 64);
  if (words.length < needed) {
    throw new CodecError(`BlockStates holds ${words.length} longs; ${needed} are needed`);
  }
  const mask = (1n << BigInt(bits)) - 1n;
  const out = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    const start = i * bits;
    const wi = Math.floor(start / 64);
    const off = BigInt(start % 64);
    let v = BigInt.asUintN(64, words[wi] as bigint) >> off;
    if (off + BigInt(bits) > 64n) {
      v |= BigInt.asUintN(64, words[wi + 1] as bigint) << (64n - off);
    }
    out[i] = Number(v & mask);
  }
  return out;
}

function pack(values: Int32Array, bits: number): BigInt64Array {
  const words = new BigInt64Array(Math.ceil((values.length * bits) / 64));
  const mask = (1n << BigInt(bits)) - 1n;
  for (let i = 0; i < values.length; i++) {
    const v = BigInt(values[i] as number) & mask;
    const start = i * bits;
    const wi = Math.floor(start / 64);
    const off = BigInt(start % 64);
    words[wi] = BigInt.asIntN(64, BigInt.asUintN(64, words[wi] as bigint) | (v << off));
    if (off + BigInt(bits) > 64n) {
      words[wi + 1] = BigInt.asIntN(
        64,
        BigInt.asUintN(64, words[wi + 1] as bigint) | (v >> (64n - off)),
      );
    }
  }
  return words;
}

function xyz(tag: NbtTag | undefined, what: string): [number, number, number] {
  const c = asCompound(tag, what);
  return [
    asNumber(child(c, "x"), `${what}.x`),
    asNumber(child(c, "y"), `${what}.y`),
    asNumber(child(c, "z"), `${what}.z`),
  ];
}

function paletteState(entry: NbtTag): string {
  const e = asCompound(entry, "palette entry");
  const nameTag = child(e, "Name") ?? child(e, "id");
  if (nameTag?.type !== "string") throw new CodecError("palette entry has no Name");
  const props = new Map<string, string>();
  const p = child(e, "Properties") ?? child(e, "properties");
  if (p !== undefined) {
    for (const [k, v] of asCompound(p, "Properties").value) {
      props.set(k, v.type === "string" ? v.value : String(v.value));
    }
  }
  return canonicalize(joinBlockString(nameTag.value, props));
}

interface RegionRead {
  blocks: [number, number, number, string][];
  blockEntities: { pos: [number, number, number]; nbt: CompoundTag }[];
  /** Entities with `Pos` still relative to the region, and the region's lowest corner. */
  entities: VolumeEntity[];
  min: [number, number, number];
}

/** Read a `.litematic` (gzipped or not) into a {@link Volume}. */
export async function readLitematic(
  bytes: Uint8Array,
  options: CodecReadOptions = {},
): Promise<LitematicRead> {
  let root: CompoundTag;
  try {
    root = (await readNbtFile(bytes)).tag;
  } catch (e) {
    throw new CodecError(`not a readable NBT file (${e instanceof Error ? e.message : String(e)})`);
  }
  const version = asNumber(child(root, "Version"), "Version");
  if (version < 5 || version > 7) {
    throw new CodecError(`unsupported litematic version ${version} (expected 5 to 7)`);
  }
  const regions = asCompound(child(root, "Regions"), "Regions");

  const lost = new Tally();
  const warnings: string[] = [];
  let ticks = 0;
  const read: RegionRead[] = [];
  for (const [name, regionTag] of regions.value) {
    const region = asCompound(regionTag, `region ${name}`);
    const pos = xyz(child(region, "Position"), "Position");
    const size = xyz(child(region, "Size"), "Size");
    const abs = size.map(Math.abs) as [number, number, number];
    // A negative size grows backwards from Position.
    const min = pos.map((p, i) => p + Math.min(0, (size[i] as number) + 1)) as [
      number,
      number,
      number,
    ];
    const total = abs[0] * abs[1] * abs[2];
    const tileEntities = child(region, "TileEntities");
    const entities = child(region, "Entities");
    for (const key of ["PendingBlockTicks", "PendingFluidTicks"]) {
      const t = child(region, key);
      if (t?.type === "list") ticks += t.value.length;
    }
    if (total === 0) {
      // Nothing can sit in an empty region.
      for (const t of tileEntities?.type === "list" ? tileEntities.value : []) {
        lost.addBlockEntity(t.type === "compound" ? kindOf(child(t, "id")) : "unknown");
      }
      for (const t of entities?.type === "list" ? entities.value : []) {
        lost.addEntity(t.type === "compound" ? kindOf(child(t, "id")) : "unknown");
      }
      continue;
    }
    if (total > 0x7fffffff) throw new CodecError(`region ${name} is too large`);

    const paletteTag = child(region, "BlockStatePalette");
    if (paletteTag?.type !== "list")
      throw new CodecError(`region ${name} has no BlockStatePalette`);
    const palette = paletteTag.value.map(paletteState);
    const statesTag = child(region, "BlockStates");
    if (statesTag?.type !== "longArray") throw new CodecError(`region ${name} has no BlockStates`);
    const idx = unpack(statesTag.value, bitsFor(palette.length), total);

    const [w, , l] = abs;
    /** The block kept at a cell of this region, or `undefined` for air that is dropped and editor leftovers. */
    const kept = (i: number): string | undefined => {
      const state = palette[idx[i] as number];
      if (state === undefined)
        throw new CodecError(`region ${name} uses palette index ${idx[i]} outside its palette`);
      const base = state.split("[", 1)[0] as string;
      if (SKIP_BLOCKS.has(base)) return undefined;
      const isAir = AIR_BLOCKS.has(base);
      if (isAir && !options.keepAir) return undefined;
      return isAir ? AIR : state;
    };
    const r: RegionRead = { blocks: [], blockEntities: [], entities: [], min };
    for (let i = 0; i < total; i++) {
      const state = kept(i);
      if (state === undefined) continue;
      const x = i % w;
      const z = Math.floor(i / w) % l;
      const y = Math.floor(i / (w * l));
      r.blocks.push([min[0] + x, min[1] + y, min[2] + z, state]);
    }

    for (const t of tileEntities?.type === "list" ? tileEntities.value : []) {
      if (t.type !== "compound") {
        lost.addBlockEntity("unknown");
        continue;
      }
      const kind = kindOf(child(t, "id"));
      const rel = [child(t, "x"), child(t, "y"), child(t, "z")].map((v) =>
        v !== undefined && (v.type === "int" || v.type === "short" || v.type === "byte")
          ? v.value
          : Number.NaN,
      ) as [number, number, number];
      const inside = rel.every((v, i) => Number.isInteger(v) && v >= 0 && v < (abs[i] as number));
      if (!inside || kept((rel[1] * l + rel[2]) * w + rel[0]) === undefined) {
        lost.addBlockEntity(kind);
        continue;
      }
      r.blockEntities.push({
        pos: [min[0] + rel[0], min[1] + rel[1], min[2] + rel[2]],
        nbt: compound(entriesWithout(t, POSITION_KEYS)),
      });
    }

    for (const t of entities?.type === "list" ? entities.value : []) {
      if (t.type !== "compound" || entityPosition(t) === undefined) {
        lost.addEntity(t.type === "compound" ? kindOf(child(t, "id")) : "unknown");
        continue;
      }
      // `Pos` is relative to the region's lowest corner.
      r.entities.push({ edition: "java", nbt: t });
    }
    read.push(r);
  }

  const volume = new Volume();
  let [mx, my, mz] = [0, 0, 0];
  if (read.some((r) => r.blocks.length > 0)) {
    mx = my = mz = Number.POSITIVE_INFINITY;
    for (const r of read) {
      for (const [x, y, z] of r.blocks) {
        if (x < mx) mx = x;
        if (y < my) my = y;
        if (z < mz) mz = z;
      }
    }
  }
  // Later regions are placed over earlier ones, block entities included.
  for (const r of read) {
    for (const [x, y, z, s] of r.blocks) {
      volume.set(x - mx, y - my, z - mz, s);
      volume.deleteBlockEntity(x - mx, y - my, z - mz);
    }
    for (const { pos, nbt } of r.blockEntities) {
      volume.setBlockEntity(pos[0] - mx, pos[1] - my, pos[2] - mz, { edition: "java", nbt });
    }
    for (const e of r.entities) {
      volume.addEntity(shiftEntity(e, r.min[0] - mx, r.min[1] - my, r.min[2] - mz));
    }
  }

  warnings.push(...lost.lines("their position holds no block, or is missing or malformed"));
  if (ticks > 0) warnings.push(`${ticks} pending block and fluid ticks not carried over`);
  const dv = child(root, "MinecraftDataVersion");
  return {
    volume,
    meta: {
      version,
      dataVersion: dv === undefined ? null : asNumber(dv, "MinecraftDataVersion"),
      regionCount: regions.value.size,
      droppedBlockEntities: lost.blockEntityCount,
      droppedEntities: lost.entityCount,
    },
    warnings,
  };
}

export interface WriteLitematicOptions {
  dataVersion: number;
  /** Shown in Litematica. Default `"voxwright"`. */
  name?: string;
  author?: string;
  description?: string;
  /** Written as both creation and modification time, in ms since the epoch. Default 0, so output is reproducible. */
  time?: number;
}

/** Build the litematic compound: one region, "Main", at the origin. */
export function buildLitematic(
  volume: Volume,
  options: WriteLitematicOptions,
): { root: CompoundTag; warnings: string[] } {
  const dense = volume.toDense();
  const [w, h, l] = dense.size;
  if (dense.data.length === 0) throw new CodecError("build is empty — nothing to export");

  const warnings: string[] = [...foreignLines(volume, "java")];
  // Litematica expects air at palette index 0.
  const states: string[] = [AIR];
  const remap = new Int32Array(dense.palette.length);
  dense.palette.forEach((p, i) => {
    const brace = p.indexOf("{");
    let state = p;
    if (brace !== -1) {
      warnings.push(
        `palette entry '${p}' carries block-entity NBT which .litematic export drops (no tile entities are written)`,
      );
      state = p.slice(0, brace);
    }
    if (state === AIR) {
      remap[i] = 0;
      return;
    }
    let at = states.indexOf(state);
    if (at === -1) {
      states.push(state);
      at = states.length - 1;
    }
    remap[i] = at;
  });

  const total = w * h * l;
  const values = new Int32Array(total); // unset cells are air (0)
  let blocks = 0;
  for (let y = 0; y < h; y++) {
    for (let z = 0; z < l; z++) {
      for (let x = 0; x < w; x++) {
        const v = dense.data[(x * h + y) * l + z] as number;
        if (v < 0) continue;
        const idx = remap[v] as number;
        values[(y * l + z) * w + x] = idx;
        if (idx !== 0) blocks++;
      }
    }
  }

  const palette = states.map((s) => {
    const bracket = s.indexOf("[");
    const entry = compound([["Name", string(bracket === -1 ? s : s.slice(0, bracket))]]);
    if (bracket !== -1) {
      const props = compound();
      for (const item of s.slice(bracket + 1, -1).split(",")) {
        const eq = item.indexOf("=");
        props.value.set(item.slice(0, eq), string(item.slice(eq + 1)));
      }
      entry.value.set("Properties", props);
    }
    return entry;
  });

  const vec = (a: number, b: number, c: number): NbtTag =>
    compound([
      ["x", int(a)],
      ["y", int(b)],
      ["z", int(c)],
    ]);
  const [ox, oy, oz] = dense.origin;
  const tileEntities: { x: number; y: number; z: number; nbt: CompoundTag }[] = [];
  volume.eachBlockEntity((x, y, z, e) => {
    if (e.edition === "java") {
      tileEntities.push({ x: x - ox, y: y - oy, z: z - oz, nbt: e.nbt });
    }
  });
  tileEntities.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
  const tiles = tileEntities.map(({ x, y, z, nbt }) =>
    compound([["x", int(x)], ["y", int(y)], ["z", int(z)], ...entriesWithout(nbt, POSITION_KEYS)]),
  );
  const mobs = volume.entities
    .filter((e) => e.edition === "java")
    .map((e) => shiftEntity(e, -ox, -oy, -oz).nbt);
  const time = BigInt(options.time ?? 0);
  const region = compound([
    ["Position", vec(0, 0, 0)],
    ["Size", vec(w, h, l)],
    ["BlockStatePalette", list(TagId.Compound, palette)],
    ["BlockStates", longArray(pack(values, bitsFor(palette.length)))],
    ["TileEntities", list(TagId.Compound, tiles)],
    ["Entities", list(TagId.Compound, mobs)],
    ["PendingBlockTicks", list(TagId.Compound, [])],
    ["PendingFluidTicks", list(TagId.Compound, [])],
  ]);
  const root = compound([
    ["Version", int(6)],
    ["MinecraftDataVersion", int(options.dataVersion)],
    [
      "Metadata",
      compound([
        ["Name", string(options.name ?? "voxwright")],
        ["Author", string(options.author ?? "")],
        ["Description", string(options.description ?? "")],
        ["RegionCount", int(1)],
        ["TimeCreated", long(time)],
        ["TimeModified", long(time)],
        ["TotalBlocks", int(blocks)],
        ["TotalVolume", int(total)],
        ["EnclosingSize", vec(w, h, l)],
      ]),
    ],
    ["Regions", compound([["Main", region]])],
  ]);
  return { root, warnings };
}

/** Write a {@link Volume} as a gzipped `.litematic`. */
export async function writeLitematic(
  volume: Volume,
  options: WriteLitematicOptions,
): Promise<WriteResult> {
  const { root, warnings } = buildLitematic(volume, options);
  return { bytes: await writeNbtGzip({ name: "Litematic", tag: root }), warnings };
}
