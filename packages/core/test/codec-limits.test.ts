// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  AIR,
  byteArray,
  CodecError,
  compound,
  int,
  LEGACY_SCHEMATIC_MESSAGE,
  list,
  longArray,
  MAX_EXTENT,
  type NbtTag,
  readLitematic,
  readMcstructure,
  readSchem,
  readStructureNbt,
  short,
  string,
  TagId,
  Volume,
  writeLitematic,
  writeMcstructure,
  writeNbt,
  writeNbtGzip,
  writeSchem,
  writeStructureNbt,
} from "../src/index.ts";

const TOO_BIG = /this build is 601 x 40 x 30; the limit is 512 blocks per axis/;

const vec = (x: number, y: number, z: number): NbtTag =>
  compound([
    ["x", int(x)],
    ["y", int(y)],
    ["z", int(z)],
  ]);

/** A bare schematic that claims a size but holds no block data at all. */
async function sizedSchem(version: 2 | 3, w: number, h: number, l: number): Promise<Uint8Array> {
  const body: [string, NbtTag][] = [
    ["Version", int(version)],
    ["DataVersion", int(4903)],
    ["Width", short(w)],
    ["Height", short(h)],
    ["Length", short(l)],
  ];
  const palette = compound([["minecraft:stone", int(0)]]);
  const data = byteArray(new Int8Array(0));
  if (version === 2) {
    body.push(["Palette", palette], ["BlockData", data]);
    return writeNbtGzip({ name: "Schematic", tag: compound(body) });
  }
  body.push([
    "Blocks",
    compound([
      ["Palette", palette],
      ["Data", data],
    ]),
  ]);
  return writeNbtGzip({ name: "", tag: compound([["Schematic", compound(body)]]) });
}

/** A region of 2-bit air/stone cells, every cell stone; only for regions of at most 32 cells. */
function stoneRegion(pos: [number, number, number], size: [number, number, number]): NbtTag {
  return compound([
    ["Position", vec(...pos)],
    ["Size", vec(...size)],
    [
      "BlockStatePalette",
      list(TagId.Compound, [
        compound([["Name", string("minecraft:air")]]),
        compound([["Name", string("minecraft:stone")]]),
      ]),
    ],
    ["BlockStates", longArray(BigInt64Array.of(0x5555555555555555n))],
  ]);
}

async function litematicOf(regions: [string, NbtTag][]): Promise<Uint8Array> {
  return writeNbtGzip({
    name: "Litematic",
    tag: compound([
      ["Version", int(6)],
      ["MinecraftDataVersion", int(4903)],
      ["Regions", compound(regions)],
    ]),
  });
}

describe("512 blocks per axis at load", () => {
  it("shares the editor's constant", () => {
    expect(MAX_EXTENT).toBe(512);
  });

  it.each([2, 3] as const)(
    "refuses a .schem v%i that is too big, before reading cells",
    async (v) => {
      const bytes = await sizedSchem(v, 601, 40, 30);
      await expect(readSchem(bytes)).rejects.toThrow(TOO_BIG);
      await expect(readSchem(bytes)).rejects.toBeInstanceOf(CodecError);
      // Raising the limit gets past the size check, to the (empty) block data.
      await expect(readSchem(bytes, { maxExtent: 1000 })).rejects.toThrow(/block data holds fewer/);
    },
  );

  it("names the axis that is too big in any position", async () => {
    await expect(readSchem(await sizedSchem(3, 3, 513, 2))).rejects.toThrow(
      "this build is 3 x 513 x 2; the limit is 512 blocks per axis",
    );
    await expect(readSchem(await sizedSchem(2, 2, 3, 65535))).rejects.toThrow(
      "this build is 2 x 3 x 65535; the limit is 512 blocks per axis",
    );
  });

  it("accepts exactly 512 on every codec", async () => {
    // One long line per codec keeps the dense arrays small.
    const line = (axis: 0 | 1 | 2): Volume => {
      const v = new Volume();
      const end: [number, number, number] = [0, 0, 0];
      end[axis] = 511;
      v.set(0, 0, 0, "minecraft:stone");
      v.set(end[0], end[1], end[2], "minecraft:stone");
      return v;
    };
    const nbt = await readStructureNbt(
      (await writeStructureNbt(line(2), { dataVersion: 1 })).bytes,
    );
    expect(nbt.volume.size).toBe(2);
    const lm = await readLitematic((await writeLitematic(line(1), { dataVersion: 1 })).bytes);
    expect(lm.volume.size).toBe(2);
    const schem = await readSchem((await writeSchem(line(0), { dataVersion: 1 })).bytes);
    expect(schem.volume.get(511, 0, 0)).toBe("minecraft:stone");
    const mc = await readMcstructure(writeMcstructure(line(0)).bytes);
    expect(mc.volume.size).toBe(2);
  });

  it("refuses a .nbt by its declared size and by where its blocks are", async () => {
    const root = (size: number[], blocks: NbtTag[]) =>
      writeNbtGzip({
        name: "",
        tag: compound([
          ["DataVersion", int(1)],
          ["size", list(TagId.Int, size.map(int))],
          ["palette", list(TagId.Compound, [compound([["Name", string("minecraft:stone")]])])],
          ["blocks", list(TagId.Compound, blocks)],
        ]),
      });
    const block = (x: number) =>
      compound([
        ["pos", list(TagId.Int, [int(x), int(0), int(0)])],
        ["state", int(0)],
      ]);
    await expect(readStructureNbt(await root([601, 40, 30], []))).rejects.toThrow(TOO_BIG);
    // A file whose `size` lies is caught by the blocks it holds.
    await expect(readStructureNbt(await root([2, 2, 2], [block(0), block(600)]))).rejects.toThrow(
      "this build is 601 x 1 x 1; the limit is 512 blocks per axis",
    );
    await expect(
      readStructureNbt(await root([601, 40, 30], []), { maxExtent: 700 }),
    ).resolves.toBeDefined();
  });

  it("refuses a .mcstructure before looking at its blocks", async () => {
    const bytes = writeNbt(
      {
        name: "",
        tag: compound([["size", list(TagId.Int, [int(601), int(40), int(30)])]]),
      },
      { endian: "little" },
    );
    await expect(readMcstructure(bytes)).rejects.toThrow(TOO_BIG);
  });

  it("refuses a .litematic by the box that holds all its regions", async () => {
    const single = await litematicOf([["Main", stoneRegion([0, 0, 0], [601, 40, 30])]]);
    await expect(readLitematic(single)).rejects.toThrow(TOO_BIG);
    // Each region is small; together they span 601 blocks along x.
    const apart = await litematicOf([
      ["A", stoneRegion([0, 0, 0], [2, 2, 2])],
      ["B", stoneRegion([599, 0, 0], [2, 2, 2])],
    ]);
    await expect(readLitematic(apart)).rejects.toThrow(
      "this build is 601 x 2 x 2; the limit is 512 blocks per axis",
    );
    // Overlapping regions are checked on the flattened bounds, not the sum of their sizes.
    const near = await litematicOf([
      ["A", stoneRegion([0, 0, 0], [4, 2, 2])],
      ["B", stoneRegion([2, 0, 0], [4, 2, 2])],
    ]);
    const r = await readLitematic(near);
    expect(r.volume.size).toBe(2 * 2 * 6);
    // A negative size grows backwards from Position and counts the same.
    const backwards = await litematicOf([["A", stoneRegion([600, 0, 0], [-601, 1, 1])]]);
    await expect(readLitematic(backwards)).rejects.toThrow(
      "this build is 601 x 1 x 1; the limit is 512 blocks per axis",
    );
  });

  it("lets a reader raise the limit", async () => {
    const wide = await litematicOf([["Main", stoneRegion([0, 0, 0], [600, 1, 1])]]);
    await expect(readLitematic(wide)).rejects.toThrow(/limit is 512/);
    await expect(readLitematic(wide, { maxExtent: 600 })).rejects.toThrow(/BlockStates holds/);
  });
});

describe("legacy .schematic", () => {
  /** What MCEdit and old WorldEdit wrote: numeric block IDs. */
  const legacy = (withMaterials: boolean) =>
    writeNbtGzip({
      name: "Schematic",
      tag: compound([
        ["Width", short(2)],
        ["Height", short(1)],
        ["Length", short(2)],
        ...(withMaterials ? ([["Materials", string("Alpha")]] as [string, NbtTag][]) : []),
        ["Blocks", byteArray(Int8Array.of(1, 1, 4, 0))],
        ["Data", byteArray(Int8Array.of(0, 0, 0, 0))],
      ]),
    });

  it.each([true, false])(
    "is refused with advice to re-save as .schem (Materials: %s)",
    async (m) => {
      const bytes = await legacy(m);
      await expect(readSchem(bytes)).rejects.toThrow(LEGACY_SCHEMATIC_MESSAGE);
      await expect(readSchem(bytes)).rejects.toThrow(
        /legacy .*pre-1\.13.*not supported.*re-save it as \.schem/,
      );
    },
  );

  it("does not catch a Sponge file or other files", async () => {
    const v = new Volume();
    v.set(0, 0, 0, AIR);
    v.set(1, 0, 0, "minecraft:stone");
    for (const version of [2, 3] as const) {
      const r = await readSchem((await writeSchem(v, { dataVersion: 1, version })).bytes);
      expect(r.volume.get(1, 0, 0)).toBe("minecraft:stone");
    }
    const empty = await writeNbtGzip({ name: "", tag: compound() });
    await expect(readSchem(empty)).rejects.toThrow("Version is missing");
  });
});
