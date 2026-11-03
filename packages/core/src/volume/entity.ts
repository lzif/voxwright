// SPDX-License-Identifier: AGPL-3.0-only

// Block entities and entities carried by a Volume. Both are raw NBT that the
// editor never looks inside: they are stored as read and written back as
// stored. The `edition` says which game's NBT dialect the compound is in, so
// a Java chest is never written into a Bedrock file or the other way round.
//
// Block entity: the compound without its position (the position is the map
// key). Java: `id` and the block entity's data, as in a world's chunk.
// Bedrock: the `block_entity_data` compound.
//
// Entity: the compound with its `Pos` list (three doubles for Java, three
// floats for Bedrock) in volume coordinates, the same ones the cells use.

import { type CompoundTag, type NbtTag, TagId } from "../nbt/index.ts";

/** Which game's NBT a stored compound is in. */
export type Edition = "java" | "bedrock";

export interface BlockEntity {
  readonly edition: Edition;
  readonly nbt: CompoundTag;
}

export interface VolumeEntity {
  readonly edition: Edition;
  readonly nbt: CompoundTag;
}

/** The part of a block string that names the block: before any `[` or `{`. */
export function blockIdOf(block: string): string {
  const a = block.indexOf("[");
  const b = block.indexOf("{");
  const end = a === -1 ? b : b === -1 ? a : Math.min(a, b);
  return end === -1 ? block : block.slice(0, end);
}

/** The `Pos` of an entity as three numbers, or `undefined` if it has none in the expected form. */
export function entityPosition(nbt: CompoundTag): [number, number, number] | undefined {
  const pos = nbt.value.get("Pos");
  if (pos?.type !== "list" || pos.value.length !== 3) return undefined;
  const out: number[] = [];
  for (const v of pos.value) {
    if (v.type !== "double" && v.type !== "float") return undefined;
    out.push(v.value);
  }
  return out as [number, number, number];
}

/** A `Pos` list tag of three doubles (Java) or floats (Bedrock). */
export function positionTag(edition: Edition, x: number, y: number, z: number): NbtTag {
  const num = (v: number): NbtTag =>
    edition === "java" ? { type: "double", value: v } : { type: "float", value: Math.fround(v) };
  return {
    type: "list",
    elementType: edition === "java" ? TagId.Double : TagId.Float,
    value: [num(x), num(y), num(z)],
  };
}

/**
 * A copy of the entity with `Pos` moved by `(dx, dy, dz)`. The list keeps
 * its element type. An entity without a usable `Pos` is returned as is.
 */
export function shiftEntity(e: VolumeEntity, dx: number, dy: number, dz: number): VolumeEntity {
  const pos = e.nbt.value.get("Pos");
  if (pos?.type !== "list" || pos.value.length !== 3 || (dx === 0 && dy === 0 && dz === 0)) {
    return e;
  }
  const d = [dx, dy, dz];
  const moved: NbtTag[] = pos.value.map((v, i) => {
    const delta = d[i] as number;
    if (v.type === "double") return { type: "double", value: v.value + delta };
    if (v.type === "float") return { type: "float", value: Math.fround(v.value + delta) };
    return v;
  });
  const value = new Map(e.nbt.value);
  value.set("Pos", { type: "list", elementType: pos.elementType, value: moved });
  return { edition: e.edition, nbt: { type: "compound", value } };
}
