// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  byte,
  byteArray,
  compound,
  decodeMutf8,
  double,
  encodeMutf8,
  float,
  gunzip,
  gzip,
  int,
  intArray,
  isGzip,
  list,
  long,
  longArray,
  NbtError,
  type NbtRoot,
  readNbt,
  readNbtFile,
  short,
  string,
  TagId,
  writeNbt,
  writeNbtGzip,
} from "../src/index.ts";

function sample(): NbtRoot {
  return {
    name: "hello",
    tag: compound([
      ["byte", byte(-5)],
      ["short", short(-300)],
      ["int", int(123456789)],
      ["long", long(-9007199254740993n)],
      ["float", float(1.5)],
      ["double", double(Math.PI)],
      ["bytes", byteArray(Int8Array.from([1, -2, 3]))],
      ["str", string("héllo ✓ \u0000 𝄞")],
      ["ints", intArray(Int32Array.from([1, -2, 2147483647]))],
      ["longs", longArray(BigInt64Array.from([1n, -2n, 2n ** 62n]))],
      ["empty", list(TagId.End, [])],
      ["nums", list(TagId.Int, [int(1), int(2)])],
      [
        "nested",
        compound([
          ["inner", compound([["x", int(1)]])],
          ["lists", list(TagId.List, [list(TagId.Byte, [byte(1)]), list(TagId.End, [])])],
          ["comps", list(TagId.Compound, [compound([["a", int(1)]]), compound()])],
        ]),
      ],
    ]),
  };
}

describe("NBT reader and writer", () => {
  for (const endian of ["big", "little"] as const) {
    it(`round-trips every tag type (${endian} endian)`, () => {
      const root = sample();
      const bytes = writeNbt(root, { endian });
      expect(readNbt(bytes, { endian })).toEqual(root);
    });
  }

  it("uses the right byte order", () => {
    const root: NbtRoot = { name: "", tag: compound([["i", int(1)]]) };
    const big = writeNbt(root, { endian: "big" });
    const little = writeNbt(root, { endian: "little" });
    expect(Array.from(big.slice(-5, -1))).toEqual([0, 0, 0, 1]);
    expect(Array.from(little.slice(-5, -1))).toEqual([1, 0, 0, 0]);
  });

  it("keeps compound insertion order", () => {
    const root: NbtRoot = {
      name: "",
      tag: compound([
        ["z", int(1)],
        ["a", int(2)],
        ["m", int(3)],
      ]),
    };
    expect([...readNbt(writeNbt(root)).tag.value.keys()]).toEqual(["z", "a", "m"]);
  });

  it("round-trips when the input is a view into a larger buffer", () => {
    const bytes = writeNbt(sample());
    const padded = new Uint8Array(bytes.length + 7);
    padded.set(bytes, 3);
    expect(readNbt(padded.subarray(3, 3 + bytes.length))).toEqual(sample());
  });

  it("rejects a non-compound root", () => {
    expect(() => readNbt(Uint8Array.from([TagId.Int, 0, 0, 0, 0, 0, 1]))).toThrow(NbtError);
  });

  it("rejects truncated data at every length", () => {
    const bytes = writeNbt(sample());
    for (let n = 0; n < bytes.length; n++) {
      expect(() => readNbt(bytes.subarray(0, n))).toThrow(NbtError);
    }
  });

  it("rejects negative array lengths and unknown tags", () => {
    const neg = Uint8Array.from([10, 0, 0, 7, 0, 1, 97, 0xff, 0xff, 0xff, 0xff, 0]);
    expect(() => readNbt(neg)).toThrow(/negative array length/);
    const unknown = Uint8Array.from([10, 0, 0, 99, 0, 1, 97, 0]);
    expect(() => readNbt(unknown)).toThrow(/unknown tag type 99/);
  });

  it("rejects a huge declared array without allocating it", () => {
    const huge = Uint8Array.from([10, 0, 0, 11, 0, 1, 97, 0x7f, 0xff, 0xff, 0xff, 0]);
    expect(() => readNbt(huge)).toThrow(NbtError);
  });

  it("rejects absurd nesting", () => {
    const depth = 2000;
    const bytes: number[] = [10, 0, 0];
    for (let i = 0; i < depth; i++) bytes.push(10, 0, 1, 97);
    expect(() => readNbt(Uint8Array.from(bytes))).toThrow(/too deep/);
  });

  it("refuses to write a list holding the wrong element type", () => {
    const bad: NbtRoot = { name: "", tag: compound([["l", list(TagId.Int, [byte(1)])]]) };
    expect(() => writeNbt(bad)).toThrow(NbtError);
  });
});

describe("modified UTF-8", () => {
  it("encodes NUL as two bytes and astral characters as surrogate pairs", () => {
    expect(Array.from(encodeMutf8("\u0000"))).toEqual([0xc0, 0x80]);
    expect(encodeMutf8("𝄞")).toHaveLength(6);
  });

  it("round-trips arbitrary text", () => {
    for (const s of ["", "plain", "é", "日本語", "a\u0000b", "𝄞🙂", "\ud800"]) {
      expect(decodeMutf8(encodeMutf8(s))).toBe(s);
    }
  });

  it("rejects malformed sequences", () => {
    expect(() => decodeMutf8(Uint8Array.from([0xc3]))).toThrow(NbtError);
    expect(() => decodeMutf8(Uint8Array.from([0xff]))).toThrow(NbtError);
    expect(() => decodeMutf8(Uint8Array.from([0xe2, 0x28, 0xa1]))).toThrow(NbtError);
  });
});

describe("gzip", () => {
  it("round-trips bytes", async () => {
    const data = Uint8Array.from({ length: 5000 }, (_, i) => i % 7);
    const z = await gzip(data);
    expect(isGzip(z)).toBe(true);
    expect(await gunzip(z)).toEqual(data);
  });

  it("reads NBT whether or not it is compressed", async () => {
    const root = sample();
    expect(await readNbtFile(writeNbt(root))).toEqual(root);
    expect(await readNbtFile(await writeNbtGzip(root))).toEqual(root);
  });

  it("rejects corrupt gzip", async () => {
    const z = await writeNbtGzip(sample());
    await expect(readNbtFile(z.subarray(0, z.length - 12))).rejects.toThrow();
  });
});
