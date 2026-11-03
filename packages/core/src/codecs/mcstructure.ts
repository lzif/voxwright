// SPDX-License-Identifier: AGPL-3.0-only

// Bedrock `.mcstructure`: uncompressed little-endian NBT.
//
// Root: format_version, size [x, y, z], structure_world_origin and a
// structure compound holding `block_indices` (two layers; the second holds
// water for waterlogged blocks), `entities` and `palette.default` with
// `block_palette` and `block_position_data`. Cell index is
// `(x * sizeY + y) * sizeZ + z`; -1 means "no block here".
//
// Block states are translated to and from Java by the rules in
// `bedrock.ts`. What the rules cannot express is reported in `warnings`.

import { canonicalize, parseBlockString } from "../blocks/index.ts";
import {
  byte as byteTag,
  type CompoundTag,
  compound,
  int,
  list,
  type NbtRoot,
  type NbtTag,
  readNbtFile,
  string,
  TagId,
  writeNbt,
} from "../nbt/index.ts";
import { AIR, Volume } from "../volume/index.ts";
import { type BedrockScalar, type BedrockValue, bedrockToJava, javaToBedrock } from "./bedrock.ts";
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

/** Bedrock block-state version written into palette entries (as written by current game versions). */
const BLOCK_VERSION = 18168865;

export interface McstructureMeta {
  formatVersion: number | null;
  size: [number, number, number];
  droppedBlockEntities: number;
  droppedEntities: number;
}

export interface McstructureRead {
  /** Blocks translated to Java, shifted so the smallest kept coordinate is 0. */
  volume: Volume;
  meta: McstructureMeta;
  /** What could not be translated, one line each, without repeats. */
  warnings: string[];
}

function scalar(tag: NbtTag): BedrockScalar {
  if (tag.type === "string") return tag.value;
  if (tag.type === "byte" || tag.type === "short" || tag.type === "int") return tag.value;
  if (tag.type === "long") return Number(tag.value);
  throw new CodecError(`unexpected ${tag.type} tag in block states`);
}

/** Read a `.mcstructure` into a {@link Volume} of Java block states. */
export async function readMcstructure(
  bytes: Uint8Array,
  options: CodecReadOptions = {},
): Promise<McstructureRead> {
  let root: CompoundTag;
  try {
    root = (await readNbtFile(bytes, { endian: "little" })).tag;
  } catch (e) {
    throw new CodecError(`not a readable NBT file (${e instanceof Error ? e.message : String(e)})`);
  }
  const sizeTag = child(root, "size");
  if (sizeTag?.type !== "list" || sizeTag.value.length !== 3) {
    throw new CodecError("not a .mcstructure (no size)");
  }
  const [sx, sy, sz] = sizeTag.value.map((v, i) => asNumber(v, `size[${i}]`)) as [
    number,
    number,
    number,
  ];
  const structure = asCompound(child(root, "structure"), "structure");
  const indicesTag = child(structure, "block_indices");
  const paletteRoot = child(asCompound(child(structure, "palette"), "palette"), "default");
  if (indicesTag?.type !== "list" || indicesTag.value.length === 0) {
    throw new CodecError("not a .mcstructure (no block_indices)");
  }
  // The format documents lists of ints; some tools write int arrays instead.
  const layers = indicesTag.value.map((l): number[] => {
    if (l.type === "intArray") return Array.from(l.value);
    if (l.type === "list") return l.value.map((v) => asNumber(v, "block index"));
    throw new CodecError("block_indices layers must be lists");
  });
  const palContainer = asCompound(paletteRoot, "palette.default");
  const paletteList = child(palContainer, "block_palette");
  if (paletteList?.type !== "list") throw new CodecError("no block_palette");
  const total = sx * sy * sz;
  if (total < 0 || total > 0x7fffffff) throw new CodecError(`invalid size ${sx}x${sy}x${sz}`);
  const main = layers[0] as number[];
  if (main.length !== total) {
    throw new CodecError(`block_indices holds ${main.length} entries for ${sx}x${sy}x${sz}`);
  }

  // Block entities keyed by cell index.
  const positionData = child(palContainer, "block_position_data");
  const bedColor = new Map<number, number>();
  let droppedBlockEntities = 0;
  if (positionData?.type === "compound") {
    for (const [key, entry] of positionData.value) {
      const be = entry.type === "compound" ? child(entry, "block_entity_data") : undefined;
      if (be?.type !== "compound") continue;
      const idTag = child(be, "id");
      const color = child(be, "color");
      if (idTag?.type === "string" && idTag.value === "Bed" && color !== undefined) {
        bedColor.set(Number(key), asNumber(color, "bed color"));
      } else {
        droppedBlockEntities++;
      }
    }
  }

  const warnings = new Set<string>();
  const entries = paletteList.value.map((e) => {
    const c = asCompound(e, "palette entry");
    const name = child(c, "name");
    if (name?.type !== "string") throw new CodecError("palette entry has no name");
    const states = new Map<string, BedrockScalar>();
    const st = child(c, "states");
    if (st?.type === "compound") for (const [k, v] of st.value) states.set(k, scalar(v));
    return { name: name.value, states };
  });
  const translated = new Map<string, string>(); // palette index (+ colour) -> Java state
  const javaOf = (idx: number, color: number | undefined): string => {
    const key = `${idx}/${color ?? ""}`;
    let state = translated.get(key);
    if (state === undefined) {
      const e = entries[idx];
      if (e === undefined) throw new CodecError(`block index ${idx} is outside the palette`);
      const r = bedrockToJava(e.name, e.states, color === undefined ? {} : { bedColor: color });
      for (const w of r.warnings) warnings.add(w);
      state = r.state;
      translated.set(key, state);
    }
    return state;
  };

  const water = new Set<number>();
  entries.forEach((e, i) => {
    if (e.name === "minecraft:water" || e.name === "minecraft:flowing_water") water.add(i);
  });
  const second = layers[1];

  const kept: [number, number, number, string][] = [];
  let i = 0;
  for (let x = 0; x < sx; x++) {
    for (let y = 0; y < sy; y++) {
      for (let z = 0; z < sz; z++, i++) {
        const idx = main[i] as number;
        if (idx < 0) continue;
        let state = javaOf(idx, bedColor.get(i));
        const base = state.split("[", 1)[0] as string;
        if (SKIP_BLOCKS.has(base)) continue;
        if (AIR_BLOCKS.has(base)) {
          if (options.keepAir) kept.push([x, y, z, AIR]);
          continue;
        }
        const layer2 = second?.[i];
        if (layer2 !== undefined && water.has(layer2)) {
          const parsed = parseBlockString(state);
          parsed.props.set("waterlogged", "true");
          state = canonicalize(
            `${parsed.name}[${[...parsed.props].map(([k, v]) => `${k}=${v}`).join(",")}]`,
          );
        }
        kept.push([x, y, z, state]);
      }
    }
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
  const entities = child(structure, "entities");
  const fv = child(root, "format_version");
  return {
    volume,
    meta: {
      formatVersion: fv === undefined ? null : asNumber(fv, "format_version"),
      size: [sx, sy, sz],
      droppedBlockEntities,
      droppedEntities: entities?.type === "list" ? entities.value.length : 0,
    },
    warnings: [...warnings],
  };
}

function valueTag(v: BedrockValue): NbtTag {
  if (v.kind === "byte") return byteTag(v.value);
  if (v.kind === "int") return int(v.value);
  return string(v.value);
}

/** Build the structure compound (before writing). */
export function buildMcstructure(volume: Volume): { root: NbtRoot; warnings: string[] } {
  const dense = volume.toDense();
  const [sx, sy, sz] = dense.size;
  if (dense.data.length === 0) throw new CodecError("build is empty — nothing to export");

  const warnings = new Set<string>();
  const palette: NbtTag[] = [];
  const index = new Map<string, number>();
  const intern = (name: string, states: Map<string, BedrockValue>): number => {
    const keys = [...states.keys()].sort();
    const sig = name + JSON.stringify(keys.map((k) => [k, states.get(k)]));
    let at = index.get(sig);
    if (at === undefined) {
      at = palette.length;
      index.set(sig, at);
      palette.push(
        compound([
          ["name", string(name)],
          [
            "states",
            compound(keys.map((k) => [k, valueTag(states.get(k) as BedrockValue)] as const)),
          ],
          ["version", int(BLOCK_VERSION)],
        ]),
      );
    }
    return at;
  };

  const perPalette = dense.palette.map((canonical) => {
    const brace = canonical.indexOf("{");
    let state = canonical;
    if (brace !== -1) {
      warnings.add(
        `palette entry '${canonical}' carries block-entity NBT which .mcstructure export drops`,
      );
      state = canonical.slice(0, brace);
    }
    const r = javaToBedrock(state);
    for (const w of r.warnings) warnings.add(w);
    return r;
  });
  const mapped = perPalette.map((r) => intern(r.block.name, r.block.states));
  const waterIdx = perPalette.some((r) => r.waterlogged)
    ? intern("minecraft:water", new Map([["liquid_depth", { kind: "int", value: 0 }]]))
    : -1;

  const main: NbtTag[] = [];
  const layer2: NbtTag[] = [];
  const positionData = compound();
  let i = 0;
  for (let x = 0; x < sx; x++) {
    for (let y = 0; y < sy; y++) {
      for (let z = 0; z < sz; z++, i++) {
        const v = dense.data[i] as number;
        main.push(int(v < 0 ? -1 : (mapped[v] as number)));
        const r = v < 0 ? undefined : perPalette[v];
        layer2.push(int(r?.waterlogged ? waterIdx : -1));
        if (r?.bedColor !== undefined) {
          positionData.value.set(
            String(i),
            compound([
              [
                "block_entity_data",
                compound([
                  ["color", byteTag(r.bedColor)],
                  ["id", string("Bed")],
                  ["x", int(x)],
                  ["y", int(y)],
                  ["z", int(z)],
                ]),
              ],
            ]),
          );
        }
      }
    }
  }

  const root = compound([
    ["format_version", int(1)],
    ["size", list(TagId.Int, [int(sx), int(sy), int(sz)])],
    [
      "structure",
      compound([
        ["block_indices", list(TagId.List, [list(TagId.Int, main), list(TagId.Int, layer2)])],
        ["entities", list(TagId.Compound, [])],
        [
          "palette",
          compound([
            [
              "default",
              compound([
                ["block_palette", list(TagId.Compound, palette)],
                ["block_position_data", positionData],
              ]),
            ],
          ]),
        ],
      ]),
    ],
    ["structure_world_origin", list(TagId.Int, [int(0), int(0), int(0)])],
  ]);
  return { root: { name: "", tag: root }, warnings: [...warnings] };
}

/** Write a {@link Volume} as a `.mcstructure` (uncompressed, little endian). */
export function writeMcstructure(volume: Volume): WriteResult {
  const { root, warnings } = buildMcstructure(volume);
  return { bytes: writeNbt(root, { endian: "little" }), warnings };
}
