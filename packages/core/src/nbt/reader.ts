// SPDX-License-Identifier: AGPL-3.0-only
import { decodeMutf8 } from "./mutf8.ts";
import {
  type CompoundTag,
  type Endian,
  NbtError,
  type NbtRoot,
  type NbtTag,
  TagId,
  type TagIdValue,
} from "./types.ts";

/** Nesting limit, the same depth vanilla Minecraft allows. */
const MAX_DEPTH = 512;

class Cursor {
  readonly view: DataView;
  readonly bytes: Uint8Array;
  readonly little: boolean;
  pos = 0;
  constructor(bytes: Uint8Array, little: boolean) {
    this.bytes = bytes;
    this.little = little;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  need(n: number): void {
    if (n < 0 || this.pos + n > this.bytes.length) {
      throw new NbtError("unexpected end of NBT data");
    }
  }

  u8(): number {
    this.need(1);
    return this.view.getUint8(this.pos++);
  }
  i8(): number {
    this.need(1);
    return this.view.getInt8(this.pos++);
  }
  i16(): number {
    this.need(2);
    const v = this.view.getInt16(this.pos, this.little);
    this.pos += 2;
    return v;
  }
  u16(): number {
    this.need(2);
    const v = this.view.getUint16(this.pos, this.little);
    this.pos += 2;
    return v;
  }
  i32(): number {
    this.need(4);
    const v = this.view.getInt32(this.pos, this.little);
    this.pos += 4;
    return v;
  }
  i64(): bigint {
    this.need(8);
    const v = this.view.getBigInt64(this.pos, this.little);
    this.pos += 8;
    return v;
  }
  f32(): number {
    this.need(4);
    const v = this.view.getFloat32(this.pos, this.little);
    this.pos += 4;
    return v;
  }
  f64(): number {
    this.need(8);
    const v = this.view.getFloat64(this.pos, this.little);
    this.pos += 8;
    return v;
  }
  take(n: number): Uint8Array {
    this.need(n);
    const out = this.bytes.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }
  str(): string {
    return decodeMutf8(this.take(this.u16()));
  }
  length(): number {
    const n = this.i32();
    if (n < 0) throw new NbtError(`negative array length ${n}`);
    return n;
  }
}

function readPayload(c: Cursor, id: TagIdValue, depth: number): NbtTag {
  if (depth > MAX_DEPTH) throw new NbtError("NBT nesting too deep");
  switch (id) {
    case TagId.Byte:
      return { type: "byte", value: c.i8() };
    case TagId.Short:
      return { type: "short", value: c.i16() };
    case TagId.Int:
      return { type: "int", value: c.i32() };
    case TagId.Long:
      return { type: "long", value: c.i64() };
    case TagId.Float:
      return { type: "float", value: c.f32() };
    case TagId.Double:
      return { type: "double", value: c.f64() };
    case TagId.ByteArray: {
      const n = c.length();
      const raw = c.take(n);
      return { type: "byteArray", value: new Int8Array(raw.slice().buffer) };
    }
    case TagId.String:
      return { type: "string", value: c.str() };
    case TagId.List: {
      const elementType = c.u8();
      const n = c.length();
      if (!isTagId(elementType)) throw new NbtError(`unknown list element type ${elementType}`);
      if (elementType === TagId.End && n > 0) {
        throw new NbtError("non-empty list of TAG_End");
      }
      const value: NbtTag[] = [];
      for (let i = 0; i < n; i++) value.push(readPayload(c, elementType, depth + 1));
      return { type: "list", elementType, value };
    }
    case TagId.Compound: {
      const value = new Map<string, NbtTag>();
      for (;;) {
        const childId = c.u8();
        if (childId === TagId.End) break;
        if (!isTagId(childId)) throw new NbtError(`unknown tag type ${childId}`);
        const name = c.str();
        value.set(name, readPayload(c, childId, depth + 1));
      }
      return { type: "compound", value };
    }
    case TagId.IntArray: {
      const n = c.length();
      c.need(n * 4);
      const out = new Int32Array(n);
      for (let i = 0; i < n; i++) out[i] = c.i32();
      return { type: "intArray", value: out };
    }
    case TagId.LongArray: {
      const n = c.length();
      c.need(n * 8);
      const out = new BigInt64Array(n);
      for (let i = 0; i < n; i++) out[i] = c.i64();
      return { type: "longArray", value: out };
    }
    default:
      throw new NbtError(`unknown tag type ${id}`);
  }
}

function isTagId(n: number): n is TagIdValue {
  return Number.isInteger(n) && n >= 0 && n <= TagId.LongArray;
}

export interface ReadOptions {
  /** Byte order. Java Edition is big endian, Bedrock files are little endian. */
  endian?: Endian;
}

/** Decode uncompressed NBT. The root must be a named compound. */
export function readNbt(bytes: Uint8Array, options: ReadOptions = {}): NbtRoot {
  const c = new Cursor(bytes, options.endian === "little");
  const id = c.u8();
  if (id !== TagId.Compound) {
    throw new NbtError(`root tag must be a compound, found type ${id}`);
  }
  const name = c.str();
  const tag = readPayload(c, TagId.Compound, 0) as CompoundTag;
  return { name, tag };
}
