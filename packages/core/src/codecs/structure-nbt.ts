// SPDX-License-Identifier: AGPL-3.0-only

// Vanilla structure-block `.nbt`: a gzipped root compound with
// `DataVersion`, `size`, `palette` and `blocks`. This matches what a
// structure block saves and what mcbuilder's exporter writes and its
// importer reads.
//
// A block's block entity is its `nbt` (with `id`, without a position).
// `entities` holds `{pos, blockPos, nbt}`: `pos` is three doubles relative to
// the structure's corner and `nbt` is the entity's NBT. A volume holds the
// entity as its `nbt` with `Pos` set to `pos`; `blockPos` is written back as
// the floor of `pos`, which is what the game writes.

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
import {
  AIR,
  type BlockEntity,
  entityPosition,
  positionTag,
  shiftEntity,
  Volume,
} from "../volume/index.ts";
import { BlockTally, entriesWithout, foreignLines, kindOf, POSITION_KEYS, Tally } from "./carry.ts";
import {
  asCompound,
  asNumber,
  CodecError,
  type CodecReadOptions,
  checkExtent,
  child,
  type WriteResult,
} from "./common.ts";

export interface StructureNbtMeta {
  dataVersion: number | null;
  /** Block entities in the file that could not be placed in the volume. */
  droppedBlockEntities: number;
  /** Entities in the file that could not be placed in the volume. */
  droppedEntities: number;
}

export interface StructureNbtRead {
  /**
   * Blocks, their block entities and the entities, shifted so the smallest
   * x, y and z of the kept blocks are 0.
   */
  volume: Volume;
  meta: StructureNbtMeta;
  /** What the file held that the volume does not, one line each. */
  warnings: string[];
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
  const declared = child(tag, "size");
  if (declared?.type === "list" && declared.value.length === 3) {
    checkExtent(
      declared.value.map((v, i) => asNumber(v, `size[${i}]`)) as [number, number, number],
      options,
    );
  }
  const states = paletteTag.value.map(paletteState);

  const kept: [number, number, number, string][] = [];
  const pendingBlockEntities = new Map<string, CompoundTag>();
  const lost = new Tally();
  const dropped = new BlockTally();
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
    const nbt = child(block, "nbt");
    const name = state.split("[", 1)[0] as string;
    const kind = dropped.note(name);
    const skipped = kind === "skip" || (kind === "air" && !options.keepAir);
    if (nbt !== undefined) {
      if (nbt.type === "compound" && !skipped) pendingBlockEntities.set(`${x},${y},${z}`, nbt);
      else lost.addBlockEntity(kindOf(nbt.type === "compound" ? nbt.value.get("id") : undefined));
    }
    if (kind === "skip") continue;
    if (kind === "air") {
      if (options.keepAir) kept.push([x, y, z, AIR]);
      continue;
    }
    kept.push([x, y, z, state]);
  }

  const volume = new Volume();
  let [mx, my, mz] = [0, 0, 0];
  if (kept.length > 0) {
    mx = my = mz = Number.POSITIVE_INFINITY;
    let [hx, hy, hz] = [
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ];
    for (const [x, y, z] of kept) {
      if (x < mx) mx = x;
      if (y < my) my = y;
      if (z < mz) mz = z;
      if (x > hx) hx = x;
      if (y > hy) hy = y;
      if (z > hz) hz = z;
    }
    checkExtent([hx - mx + 1, hy - my + 1, hz - mz + 1], options);
    for (const [x, y, z, s] of kept) volume.set(x - mx, y - my, z - mz, s);
  }
  for (const [key, nbt] of pendingBlockEntities) {
    const [x, y, z] = key.split(",").map(Number) as [number, number, number];
    const entity: BlockEntity = {
      edition: "java",
      nbt: compound(entriesWithout(nbt, POSITION_KEYS)),
    };
    volume.setBlockEntity(x - mx, y - my, z - mz, entity);
  }

  const entitiesTag = child(tag, "entities");
  for (const raw of entitiesTag?.type === "list" ? entitiesTag.value : []) {
    const e = raw.type === "compound" ? child(raw, "nbt") : undefined;
    if (raw.type !== "compound" || e?.type !== "compound") {
      lost.addEntity("unknown");
      continue;
    }
    const nbt = compound(e.value);
    const pos = child(raw, "pos");
    if (pos !== undefined) nbt.value.set("Pos", pos);
    if (entityPosition(nbt) === undefined) {
      lost.addEntity(kindOf(e.value.get("id")));
      continue;
    }
    volume.addEntity(shiftEntity({ edition: "java", nbt }, -mx, -my, -mz));
  }

  const dv = child(tag, "DataVersion");
  return {
    volume,
    meta: {
      dataVersion: dv === undefined ? null : asNumber(dv, "DataVersion"),
      droppedBlockEntities: lost.blockEntityCount,
      droppedEntities: lost.entityCount,
    },
    warnings: [
      ...lost.lines("their position holds no block, or is missing or malformed"),
      ...dropped.lines(),
    ],
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

  const warnings: string[] = [...foreignLines(volume, "java")];
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
  const lost = new Tally();
  const [ox, oy, oz] = dense.origin;
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
        const block = compound([
          ["pos", list(TagId.Int, [int(x), int(y), int(z)])],
          ["state", int(idx)],
        ]);
        const entity = volume.blockEntityAt(ox + x, oy + y, oz + z);
        if (entity?.edition === "java") block.value.set("nbt", entity.nbt);
        blocks.push(block);
      }
    }
  }
  // A block entity on a cell that is not written (air, in the modes that leave it out) is lost.
  volume.eachBlockEntity((x, y, z, e) => {
    if (e.edition !== "java") return;
    const key = ((x - ox) * sy + (y - oy)) * sz + (z - oz);
    const idx = dense.data[key] as number;
    if (idx < 0 ? airMode !== "all" : airMode === "none" && idx === airIdx) {
      lost.addBlockEntity(kindOf(e.nbt.value.get("id")));
    }
  });
  warnings.push(...lost.lines("their cell is air, which this export leaves out"));

  const entities: NbtTag[] = [];
  for (const e of volume.entities) {
    if (e.edition !== "java") continue;
    const moved = shiftEntity(e, -ox, -oy, -oz);
    const p = entityPosition(moved.nbt) as [number, number, number];
    entities.push(
      compound([
        ["pos", positionTag("java", p[0], p[1], p[2])],
        [
          "blockPos",
          list(TagId.Int, [int(Math.floor(p[0])), int(Math.floor(p[1])), int(Math.floor(p[2]))]),
        ],
        ["nbt", moved.nbt],
      ]),
    );
  }

  const root = compound([
    ["DataVersion", int(options.dataVersion)],
    ["size", list(TagId.Int, [int(sx), int(sy), int(sz)])],
    ["palette", list(TagId.Compound, palette)],
    ["blocks", list(TagId.Compound, blocks)],
    ["entities", list(TagId.Compound, entities)],
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
