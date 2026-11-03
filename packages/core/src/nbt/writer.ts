// SPDX-License-Identifier: AGPL-3.0-only
import { encodeMutf8 } from "./mutf8.ts";
import { type Endian, NbtError, type NbtRoot, type NbtTag, TagId, tagId } from "./types.ts";

class Sink {
  private buf = new Uint8Array(256);
  private view = new DataView(this.buf.buffer);
  len = 0;
  readonly little: boolean;
  constructor(little: boolean) {
    this.little = little;
  }

  private grow(n: number): void {
    if (this.len + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
    this.view = new DataView(next.buffer);
  }

  u8(v: number): void {
    this.grow(1);
    this.view.setUint8(this.len++, v);
  }
  i8(v: number): void {
    this.grow(1);
    this.view.setInt8(this.len++, v);
  }
  i16(v: number): void {
    this.grow(2);
    this.view.setInt16(this.len, v, this.little);
    this.len += 2;
  }
  u16(v: number): void {
    this.grow(2);
    this.view.setUint16(this.len, v, this.little);
    this.len += 2;
  }
  i32(v: number): void {
    this.grow(4);
    this.view.setInt32(this.len, v, this.little);
    this.len += 4;
  }
  i64(v: bigint): void {
    this.grow(8);
    this.view.setBigInt64(this.len, v, this.little);
    this.len += 8;
  }
  f32(v: number): void {
    this.grow(4);
    this.view.setFloat32(this.len, v, this.little);
    this.len += 4;
  }
  f64(v: number): void {
    this.grow(8);
    this.view.setFloat64(this.len, v, this.little);
    this.len += 8;
  }
  raw(b: Uint8Array): void {
    this.grow(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }
  str(s: string): void {
    const b = encodeMutf8(s);
    if (b.length > 0xffff) throw new NbtError("string too long for NBT");
    this.u16(b.length);
    this.raw(b);
  }
  bytes(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

function writePayload(s: Sink, tag: NbtTag): void {
  switch (tag.type) {
    case "byte":
      s.i8(tag.value);
      return;
    case "short":
      s.i16(tag.value);
      return;
    case "int":
      s.i32(tag.value);
      return;
    case "long":
      s.i64(tag.value);
      return;
    case "float":
      s.f32(tag.value);
      return;
    case "double":
      s.f64(tag.value);
      return;
    case "byteArray":
      s.i32(tag.value.length);
      s.raw(new Uint8Array(tag.value.buffer, tag.value.byteOffset, tag.value.byteLength));
      return;
    case "string":
      s.str(tag.value);
      return;
    case "list":
      s.u8(tag.elementType);
      s.i32(tag.value.length);
      for (const el of tag.value) {
        if (tagId(el) !== tag.elementType) {
          throw new NbtError(`list of type ${tag.elementType} holds a ${el.type} tag`);
        }
        writePayload(s, el);
      }
      return;
    case "compound":
      for (const [name, child] of tag.value) {
        s.u8(tagId(child));
        s.str(name);
        writePayload(s, child);
      }
      s.u8(TagId.End);
      return;
    case "intArray":
      s.i32(tag.value.length);
      for (const v of tag.value) s.i32(v);
      return;
    case "longArray":
      s.i32(tag.value.length);
      for (const v of tag.value) s.i64(v);
      return;
  }
}

export interface WriteOptions {
  endian?: Endian;
}

/** Encode a named compound as uncompressed NBT. */
export function writeNbt(root: NbtRoot, options: WriteOptions = {}): Uint8Array {
  const s = new Sink(options.endian === "little");
  s.u8(TagId.Compound);
  s.str(root.name);
  writePayload(s, root.tag);
  return s.bytes();
}
