// SPDX-License-Identifier: AGPL-3.0-only

/** NBT tag type ids as they appear on the wire. */
export const TagId = {
  End: 0,
  Byte: 1,
  Short: 2,
  Int: 3,
  Long: 4,
  Float: 5,
  Double: 6,
  ByteArray: 7,
  String: 8,
  List: 9,
  Compound: 10,
  IntArray: 11,
  LongArray: 12,
} as const;

export type TagIdValue = (typeof TagId)[keyof typeof TagId];

/**
 * A decoded NBT tag. Every tag carries its type, so values round-trip
 * without losing the distinction between byte, short, int and so on.
 * Compounds keep insertion order.
 */
export type NbtTag =
  | { type: "byte" | "short" | "int"; value: number }
  | { type: "long"; value: bigint }
  | { type: "float" | "double"; value: number }
  | { type: "byteArray"; value: Int8Array }
  | { type: "string"; value: string }
  | { type: "list"; elementType: TagIdValue; value: NbtTag[] }
  | { type: "compound"; value: Map<string, NbtTag> }
  | { type: "intArray"; value: Int32Array }
  | { type: "longArray"; value: BigInt64Array };

export type CompoundTag = Extract<NbtTag, { type: "compound" }>;
export type ListTag = Extract<NbtTag, { type: "list" }>;

/** The root of an NBT document: a named compound. */
export interface NbtRoot {
  name: string;
  tag: CompoundTag;
}

export type Endian = "big" | "little";

export class NbtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NbtError";
  }
}

const TYPE_TO_ID: Record<NbtTag["type"], TagIdValue> = {
  byte: TagId.Byte,
  short: TagId.Short,
  int: TagId.Int,
  long: TagId.Long,
  float: TagId.Float,
  double: TagId.Double,
  byteArray: TagId.ByteArray,
  string: TagId.String,
  list: TagId.List,
  compound: TagId.Compound,
  intArray: TagId.IntArray,
  longArray: TagId.LongArray,
};

export function tagId(tag: NbtTag): TagIdValue {
  return TYPE_TO_ID[tag.type];
}

// Small constructors, so callers do not spell out object literals.
export const byte = (value: number): NbtTag => ({ type: "byte", value });
export const short = (value: number): NbtTag => ({ type: "short", value });
export const int = (value: number): NbtTag => ({ type: "int", value });
export const long = (value: bigint): NbtTag => ({ type: "long", value });
export const float = (value: number): NbtTag => ({ type: "float", value });
export const double = (value: number): NbtTag => ({ type: "double", value });
export const string = (value: string): NbtTag => ({ type: "string", value });
export const byteArray = (value: Int8Array): NbtTag => ({ type: "byteArray", value });
export const intArray = (value: Int32Array): NbtTag => ({ type: "intArray", value });
export const longArray = (value: BigInt64Array): NbtTag => ({ type: "longArray", value });

export function list(elementType: TagIdValue, value: NbtTag[]): NbtTag {
  return { type: "list", elementType, value };
}

export function compound(entries: Iterable<readonly [string, NbtTag]> = []): CompoundTag {
  return { type: "compound", value: new Map(entries) };
}
