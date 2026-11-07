// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  AIR,
  byteArray,
  type CompoundTag,
  carriedOffset,
  compound,
  int,
  list,
  longArray,
  type NbtTag,
  readLitematic,
  readMcstructure,
  readNbtFile,
  readSchem,
  readStructureNbt,
  string,
  TagId,
  Volume,
  type WriteResult,
  writeLitematic,
  writeMcstructure,
  writeNbtGzip,
  writeSchem,
  writeStructureNbt,
} from "../src/index.ts";
import { loadFixture } from "./helpers.ts";

interface Codec {
  name: string;
  write: (v: Volume) => Promise<WriteResult> | WriteResult;
  read: (b: Uint8Array, keepAir: boolean) => Promise<{ volume: Volume; warnings: string[] }>;
}

const CODECS: Codec[] = [
  {
    name: ".schem",
    write: (v) => writeSchem(v, { dataVersion: 1 }),
    read: (b, keepAir) => readSchem(b, { keepAir }),
  },
  {
    name: ".nbt",
    write: (v) => writeStructureNbt(v, { dataVersion: 1, air: "explicit" }),
    read: (b, keepAir) => readStructureNbt(b, { keepAir }),
  },
  {
    name: ".litematic",
    write: (v) => writeLitematic(v, { dataVersion: 1 }),
    read: (b, keepAir) => readLitematic(b, { keepAir }),
  },
  {
    name: ".mcstructure",
    write: (v) => writeMcstructure(v),
    read: (b, keepAir) => readMcstructure(b, { keepAir }),
  },
];

describe("blocks dropped or rewritten on read are reported", () => {
  const build = (): Volume => {
    const v = new Volume();
    const cells: [string, number][] = [
      ["minecraft:stone", 2],
      ["minecraft:structure_void", 2],
      ["minecraft:jigsaw", 1],
      ["minecraft:cave_air", 3],
      ["minecraft:void_air", 1],
      [AIR, 2],
    ];
    let x = 0;
    for (const [state, n] of cells) for (let i = 0; i < n; i++) v.set(x++, 0, 0, state);
    return v;
  };

  for (const codec of CODECS) {
    for (const keepAir of [false, true]) {
      it(`${codec.name}, keepAir=${keepAir}`, async () => {
        const bytes = (await codec.write(build())).bytes;
        const r = await codec.read(bytes, keepAir);
        expect(r.warnings).toEqual([
          "3 blocks not carried over (editor leftovers that are not part of a build): structure_void x2, jigsaw x1",
          "4 blocks turned into air (cave_air and void_air are not kept): cave_air x3, void_air x1",
        ]);
        // Whatever is reported is really gone or plain air.
        for (const name of ["structure_void", "jigsaw", "cave_air", "void_air"]) {
          expect(r.volume.palette.some((p) => p.includes(name))).toBe(false);
        }
        expect(r.volume.get(0, 0, 0)).toBe("minecraft:stone");
      });
    }
  }

  it("says nothing about a build without them", async () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    v.set(1, 0, 0, AIR);
    for (const codec of CODECS) {
      const r = await codec.read((await codec.write(v)).bytes, true);
      expect(r.warnings, codec.name).toEqual([]);
    }
  });

  it("counts a single block in the singular", async () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    v.set(1, 0, 0, "minecraft:jigsaw");
    const r = await readSchem((await writeSchem(v, { dataVersion: 1 })).bytes);
    expect(r.warnings).toEqual([
      "1 block not carried over (editor leftovers that are not part of a build): jigsaw x1",
    ]);
  });
});

describe(".schem Metadata and biomes", () => {
  async function withExtras(version: 2 | 3, extras: [string, NbtTag][]): Promise<Uint8Array> {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    const written = await readNbtFile((await writeSchem(v, { dataVersion: 1, version })).bytes);
    const body: CompoundTag =
      version === 3 ? (written.tag.value.get("Schematic") as CompoundTag) : written.tag;
    for (const [k, t] of extras) body.value.set(k, t);
    return writeNbtGzip(written);
  }
  const metadata = compound([
    ["Name", string("Castle")],
    ["Author", string("someone")],
  ]);

  it("reports v3 Metadata and Biomes", async () => {
    const bytes = await withExtras(3, [
      ["Metadata", metadata],
      [
        "Biomes",
        compound([
          ["Palette", compound()],
          ["Data", byteArray(new Int8Array(1))],
        ]),
      ],
    ]);
    expect((await readSchem(bytes)).warnings).toEqual([
      "Metadata not carried over (Name, Author)",
      "biomes not carried over (a volume holds no biomes)",
    ]);
  });

  it("reports v2 Metadata and BiomeData", async () => {
    const bytes = await withExtras(2, [
      ["Metadata", metadata],
      ["BiomePalette", compound()],
      ["BiomeData", byteArray(new Int8Array(1))],
    ]);
    expect((await readSchem(bytes)).warnings).toEqual([
      "Metadata not carried over (Name, Author)",
      "biomes not carried over (a volume holds no biomes)",
    ]);
  });

  it("ignores an empty Metadata compound", async () => {
    const bytes = await withExtras(3, [["Metadata", compound()]]);
    expect((await readSchem(bytes)).warnings).toEqual([]);
  });
});

describe("Bedrock names that are not translated", () => {
  const build = (): Volume => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    v.set(1, 0, 0, "minecraft:made_up_block");
    v.set(2, 0, 0, "minecraft:made_up_block");
    v.set(3, 0, 0, "minecraft:other_made_up");
    return v;
  };

  it("reports each name with a count when the caller knows the Java names", async () => {
    const bytes = writeMcstructure(build()).bytes;
    const r = await readMcstructure(bytes, { knownBlocks: new Set(["minecraft:stone"]) });
    expect(r.warnings).toEqual([
      "3 blocks not translated, kept as is (the name is not a known Java block): minecraft:made_up_block x2, minecraft:other_made_up x1",
    ]);
    // Kept as they are, never turned into air.
    expect(r.volume.get(1, 0, 0)).toBe("minecraft:made_up_block");
    expect(r.volume.get(3, 0, 0)).toBe("minecraft:other_made_up");
    expect(r.volume.size).toBe(4);
  });

  it("reports nothing without a list of known names, and nothing for known ones", async () => {
    const bytes = writeMcstructure(build()).bytes;
    expect((await readMcstructure(bytes)).warnings).toEqual([]);
    const all = new Set(["minecraft:stone", "minecraft:made_up_block", "minecraft:other_made_up"]);
    expect((await readMcstructure(bytes, { knownBlocks: all })).warnings).toEqual([]);
  });
});

describe("multi-region .litematic", () => {
  const vec = (x: number, y: number, z: number): NbtTag =>
    compound([
      ["x", int(x)],
      ["y", int(y)],
      ["z", int(z)],
    ]);
  /** A region whose every cell is stone; at most 32 cells. */
  const region = (pos: [number, number, number], size: [number, number, number]): NbtTag =>
    compound([
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
  const file = (regions: [string, NbtTag][]): Promise<Uint8Array> =>
    writeNbtGzip({
      name: "Litematic",
      tag: compound([
        ["Version", int(6)],
        ["MinecraftDataVersion", int(4903)],
        ["Regions", compound(regions)],
      ]),
    });

  it("says how many regions were flattened", async () => {
    const r = await readLitematic(
      await file([
        ["A", region([0, 0, 0], [2, 1, 1])],
        ["B", region([5, 0, 0], [2, 1, 1])],
        ["C", region([0, 5, 0], [1, 1, 1])],
      ]),
    );
    expect(r.warnings).toEqual(["3 regions flattened into one"]);
    expect(r.volume.size).toBe(5);
  });

  it("counts the cells that overlapping regions overwrite", async () => {
    const r = await readLitematic(
      await file([
        ["A", region([0, 0, 0], [2, 2, 1])],
        ["B", region([1, 1, 0], [2, 1, 1])],
      ]),
    );
    // B's cell (1,1,0) lies on A's.
    expect(r.warnings).toEqual([
      "2 regions flattened into one",
      "1 cell overwritten where regions overlap (the later region wins)",
    ]);
    const more = await readLitematic(
      await file([
        ["A", region([0, 0, 0], [2, 2, 1])],
        ["B", region([0, 0, 0], [2, 2, 1])],
      ]),
    );
    expect(more.warnings).toContain(
      "4 cells overwritten where regions overlap (the later region wins)",
    );
  });

  it("says nothing for a single region", async () => {
    const r = await readLitematic(await file([["Main", region([0, 0, 0], [2, 2, 1])]]));
    expect(r.warnings).toEqual([]);
  });
});

describe("data kept instead of dropped", () => {
  it("reads the .litematic name, author and description and writes them back", async () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    const first = await readLitematic(
      (
        await writeLitematic(v, {
          dataVersion: 1,
          name: "Castle",
          author: "Luki",
          description: "A keep",
        })
      ).bytes,
    );
    expect(first.meta).toMatchObject({ name: "Castle", author: "Luki", description: "A keep" });
    const { name, author, description } = first.meta;
    const again = await readLitematic(
      (
        await writeLitematic(first.volume, {
          dataVersion: 1,
          name: name as string,
          author: author as string,
          description: description as string,
        })
      ).bytes,
    );
    expect(again.meta).toMatchObject({ name: "Castle", author: "Luki", description: "A keep" });
  });

  it("gives null for a .litematic without Metadata", async () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    const root = await readNbtFile((await writeLitematic(v, { dataVersion: 1 })).bytes);
    root.tag.value.delete("Metadata");
    const r = await readLitematic(await writeNbtGzip(root));
    expect(r.meta).toMatchObject({ name: null, author: null, description: null });
  });

  it("reads the real .litematic's Metadata", async () => {
    const r = await readLitematic(loadFixture("real/rafeals-house/Rafeals_house.litematic"));
    expect(r.meta).toMatchObject({
      name: "schematelizer",
      author: "Generated by @bloxelizer.com",
      description: "",
    });
  });

  it("writes the .schem Offset that was read, relative to the volume's corner", async () => {
    const v = new Volume();
    v.set(0, 0, 0, AIR);
    v.set(1, 0, 0, "minecraft:stone");
    v.set(2, 0, 0, "minecraft:stone");
    const src = await readSchem(
      (await writeSchem(v, { dataVersion: 1, offset: [10, -2, 4] })).bytes,
    );
    expect(src.meta.offset).toEqual([10, -2, 4]);

    // With air kept the volume starts at the file's own origin: the offset comes back as it was.
    const kept = await readSchem(
      (await writeSchem(v, { dataVersion: 1, offset: [10, -2, 4] })).bytes,
      { keepAir: true },
    );
    expect(carriedOffset(kept.volume, kept.meta.offset)).toEqual([10, -2, 4]);
    const sameBack = await readSchem(
      (
        await writeSchem(kept.volume, {
          dataVersion: 1,
          offset: carriedOffset(kept.volume, kept.meta.offset),
        })
      ).bytes,
    );
    expect(sameBack.meta.offset).toEqual([10, -2, 4]);

    // With air dropped the written file starts one block later, so the offset moves by that block.
    expect(carriedOffset(src.volume, src.meta.offset)).toEqual([11, -2, 4]);
    const cropped = await readSchem(
      (
        await writeSchem(src.volume, {
          dataVersion: 1,
          offset: carriedOffset(src.volume, src.meta.offset),
        })
      ).bytes,
    );
    expect(cropped.meta.offset).toEqual([11, -2, 4]);
    expect(cropped.meta.width).toBe(2);
  });

  it("carriedOffset of an empty volume is the offset itself", () => {
    expect(carriedOffset(new Volume(), [1, 2, 3])).toEqual([1, 2, 3]);
  });
});
