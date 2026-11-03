// SPDX-License-Identifier: AGPL-3.0-only

// Vanilla structure-block `.nbt`: a gzipped root compound with
// `DataVersion`, `size`, `palette` and `blocks`. This matches what a
// structure block saves and what mcbuilder's exporter writes and its
// importer reads.

import { canonicalize, joinBlockString, parseBlockString } from "../blocks/index.ts";
import {
  type CompoundTag,
  compound,
  int,
  list,
  type NbtRoot,
  type NbtTag,
  readNbtFile,
  string,
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

export interface StructureNbtMeta {
  dataVersion: number | null;
  /** Block entities present in the file; their data is not carried over. */
  droppedBlockEntities: number;
  /** Entities present in the file; they are not carried over. */
  droppedEntities: number;
}

export interface StructureNbtRead {
  /** Blocks shifted so the smallest x, y and z of the kept blocks are 0. */
  volume: Volume;
  meta: StructureNbtMeta;
}

function stateOf(name: string, props: ReadonlyMap<string, string>): string {
  const full = name.includes(":") ? name : `minecraft:${name}`;
  return canonicalize(joinBlockString(full, props));
}

function paletteState(entry: NbtTag): string {
  const e = asCompound(entry, "palette entry");
  // Newer game versions (seen at DataVersion 5023) spell these `id` and
  // `properties`; older ones and mcbuilder use `Name` and `Properties`.
  const nameTag = child(e, "Name") ?? child(e, "id");
  if (nameTag?.type !== "string") throw new CodecError("palette entry has no Name or id");
  const props = new Map<string, string>();
  const propsTag = child(e, "Properties") ?? child(e, "properties");
  if (propsTag !== undefined) {
    for (const [k, v] of asCompound(propsTag, "Properties").value) {
      props.set(k, v.type === "string" ? v.value : String(v.value));
    }
  }
  return stateOf(nameTag.value, props);
}

/** Read a structure-block `.nbt` (gzipped or not) into a {@link Volume}. */
export async function readStructureNbt(
  bytes: Uint8Array,
  options: CodecReadOptions = {},
): Promise<StructureNbtRead> {
  let root: NbtRoot;
  try {
    root = await readNbtFile(bytes);
  } catch (e) {
    throw new CodecError(`not a readable NBT file (${e instanceof Error ? e.message : String(e)})`);
  }
  const tag = root.tag;
  let paletteTag = child(tag, "palette");
  if (paletteTag === undefined) {
    const variants = child(tag, "palettes");
    if (variants?.type === "list" && variants.value.length > 0) paletteTag = variants.value[0];
  }
  const blocksTag = child(tag, "blocks");
  if (paletteTag?.type !== "list" || blocksTag?.type !== "list") {
    throw new CodecError("not a structure .nbt (no palette/blocks)");
  }
  const states = paletteTag.value.map(paletteState);

  const kept: [number, number, number, string][] = [];
  let droppedBlockEntities = 0;
  for (const b of blocksTag.value) {
    const block = asCompound(b, "block");
    const pos = child(block, "pos");
    if (pos?.type !== "list" || pos.value.length !== 3)
      throw new CodecError("block pos must be 3 ints");
    const [x, y, z] = pos.value.map((v, i) => asNumber(v, `block pos[${i}]`)) as [
      number,
      number,
      number,
    ];
    const stateIdx = asNumber(child(block, "state"), "block state");
    const state = states[stateIdx];
    if (state === undefined) throw new CodecError(`block state ${stateIdx} is outside the palette`);
    if (child(block, "nbt") !== undefined) droppedBlockEntities++;
    const name = state.split("[", 1)[0] as string;
    if (SKIP_BLOCKS.has(name)) continue;
    if (AIR_BLOCKS.has(name)) {
      if (options.keepAir) kept.push([x, y, z, AIR]);
      continue;
    }
    kept.push([x, y, z, state]);
  }

  const volume = new Volume();
  if (kept.length > 0) {
    let mx = Number.POSITIVE_INFINITY;
    let my = mx;
    let mz = mx;
    for (const [x, y, z] of kept) {
      if (x < mx) mx = x;
      if (y < my) my = y;
      if (z < mz) mz = z;
    }
    for (const [x, y, z, s] of kept) volume.set(x - mx, y - my, z - mz, s);
  }

  const dv = child(tag, "DataVersion");
  const entities = child(tag, "entities");
  return {
    volume,
    meta: {
      dataVersion: dv === undefined ? null : asNumber(dv, "DataVersion"),
      droppedBlockEntities,
      droppedEntities: entities?.type === "list" ? entities.value.length : 0,
    },
  };
}

/**
 * How air is written, as in mcbuilder:
 * - `none`: neither unset cells nor air cells appear in `blocks`.
 * - `explicit`: only cells set to `minecraft:air` are written.
 * - `all`: every cell in the box is written; unset cells become air.
 */
export type AirMode = "none" | "explicit" | "all";

export interface WriteStructureOptions {
  dataVersion: number;
  air?: AirMode;
}

const AIR_MODES: readonly AirMode[] = ["none", "explicit", "all"];

/** Build the uncompressed structure compound (before gzip). */
export function buildStructureNbt(
  volume: Volume,
  options: WriteStructureOptions,
): { root: CompoundTag; warnings: string[] } {
  const airMode = options.air ?? "none";
  if (!AIR_MODES.includes(airMode)) {
    throw new CodecError(`air must be one of ${AIR_MODES.join(", ")}, got '${String(airMode)}'`);
  }
  const dense = volume.toDense();
  const [sx, sy, sz] = dense.size;
  if (dense.data.length === 0) throw new CodecError("build is empty — nothing to export");

  const warnings: string[] = [];
  const palette: NbtTag[] = [];
  let airIdx: number | null = null;
  dense.palette.forEach((canonical, i) => {
    const { name, props, nbt } = parseBlockString(canonical);
    if (nbt !== null) {
      warnings.push(
        `palette entry '${canonical}' carries block-entity NBT which .nbt export drops (no block_entities list is written)`,
      );
    }
    const entry = compound([["Name", string(name)]]);
    if (props.size > 0) {
      const keys = [...props.keys()].sort();
      entry.value.set("Properties", compound(keys.map((k) => [k, string(props.get(k) as string)])));
    }
    if (name === AIR) airIdx = i;
    palette.push(entry);
  });
  if (airMode === "all" && airIdx === null) {
    airIdx = palette.length;
    palette.push(compound([["Name", string(AIR)]]));
  }

  const blocks: NbtTag[] = [];
  for (let x = 0; x < sx; x++) {
    for (let y = 0; y < sy; y++) {
      for (let z = 0; z < sz; z++) {
        let idx = dense.data[(x * sy + y) * sz + z] as number;
        if (idx < 0) {
          if (airMode !== "all") continue;
          idx = airIdx as number;
        } else if (airMode === "none" && idx === airIdx) {
          continue;
        }
        blocks.push(
          compound([
            ["pos", list(TagId.Int, [int(x), int(y), int(z)])],
            ["state", int(idx)],
          ]),
        );
      }
    }
  }

  const root = compound([
    ["DataVersion", int(options.dataVersion)],
    ["size", list(TagId.Int, [int(sx), int(sy), int(sz)])],
    ["palette", list(TagId.Compound, palette)],
    ["blocks", list(TagId.Compound, blocks)],
    ["entities", list(TagId.Compound, [])],
  ]);
  return { root, warnings };
}

/** Write a {@link Volume} as a gzipped structure-block `.nbt`. */
export async function writeStructureNbt(
  volume: Volume,
  options: WriteStructureOptions,
): Promise<WriteResult> {
  const { root, warnings } = buildStructureNbt(volume, options);
  return { bytes: await writeNbtGzip({ name: "", tag: root }), warnings };
}
