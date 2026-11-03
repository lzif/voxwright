// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  AIR,
  buildSchem,
  CodecError,
  compound,
  gzip,
  int,
  readNbtFile,
  readSchem,
  readStructureNbt,
  Volume,
  writeNbt,
  writeSchem,
  writeStructureNbt,
} from "../src/index.ts";
import { loadFixture, tagToJson } from "./helpers.ts";

interface Expected {
  files: Record<
    string,
    {
      version: 2 | 3;
      size: [number, number, number];
      offset: [number, number, number];
      dataVersion: number;
      blockEntities: number;
      cells: string[];
    }
  >;
}

const expected = JSON.parse(
  new TextDecoder().decode(loadFixture("synthetic/expected.json")),
) as Expected;

function cellsOf(v: Volume): string[] {
  const out: string[] = [];
  v.eachCell((x, y, z, idx) => {
    out.push(`${x},${y},${z} ${v.palette[idx]}`);
  });
  return out.sort();
}

describe(".schem reader against an independent encoder", () => {
  for (const [file, want] of Object.entries(expected.files)) {
    it(`reads ${file}`, async () => {
      const { volume, meta } = await readSchem(loadFixture(`synthetic/${file}`));
      expect(meta.version).toBe(want.version);
      expect([meta.width, meta.height, meta.length]).toEqual(want.size);
      expect(meta.offset).toEqual(want.offset);
      expect(meta.dataVersion).toBe(want.dataVersion);
      expect(meta.droppedBlockEntities).toBe(want.blockEntities);
      expect(cellsOf(volume)).toEqual(want.cells);
    });
  }

  it("keeps air on request", async () => {
    const { volume } = await readSchem(loadFixture("synthetic/v3-small.schem"), { keepAir: true });
    expect(volume.get(0, 2, 0)).toBe(AIR);
    expect(volume.size).toBe(4 * 3 * 5);
  });
});

describe(".schem round trips", () => {
  function build(): Volume {
    const v = new Volume();
    for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) v.set(x, 0, z, "minecraft:stone");
    v.set(1, 1, 1, "minecraft:oak_stairs[facing=east,half=top]");
    v.set(2, 2, 0, "minecraft:glass");
    return v;
  }

  for (const version of [2, 3] as const) {
    it(`writes then reads version ${version}`, async () => {
      const v = build();
      const { bytes, warnings } = await writeSchem(v, { dataVersion: 4903, version });
      expect(warnings).toEqual([]);
      const { volume, meta } = await readSchem(bytes);
      expect(meta).toMatchObject({ version, dataVersion: 4903, width: 3, height: 3, length: 3 });
      expect(cellsOf(volume)).toEqual(cellsOf(v));
    });
  }

  it("uses the layout the specification describes", async () => {
    const v2 = await readNbtFile((await writeSchem(build(), { dataVersion: 1, version: 2 })).bytes);
    expect(v2.name).toBe("Schematic");
    expect(Object.keys(tagToJson(v2.tag) as object)).toEqual(
      expect.arrayContaining(["Version", "Width", "Palette", "BlockData", "PaletteMax"]),
    );
    const v3 = await readNbtFile((await writeSchem(build(), { dataVersion: 1 })).bytes);
    expect(Object.keys(tagToJson(v3.tag) as object)).toEqual(["Schematic"]);
  });

  it("moves a volume with negative coordinates to the origin", async () => {
    const v = new Volume();
    v.set(-5, 10, -5, "minecraft:stone");
    v.set(-4, 10, -5, "minecraft:dirt");
    const { volume } = await readSchem((await writeSchem(v, { dataVersion: 1 })).bytes);
    expect(cellsOf(volume)).toEqual(["0,0,0 minecraft:stone", "1,0,0 minecraft:dirt"]);
  });

  it("writes carved air and unset cells as air, and reads them back as nothing", async () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    v.set(2, 0, 0, "minecraft:stone");
    v.set(1, 0, 0, AIR);
    const { bytes } = await writeSchem(v, { dataVersion: 1 });
    const { volume } = await readSchem(bytes);
    expect(cellsOf(volume)).toEqual(["0,0,0 minecraft:stone", "2,0,0 minecraft:stone"]);
  });

  it("needs two-byte palette ids for large palettes", async () => {
    const v = new Volume();
    for (let i = 0; i < 300; i++) v.set(i, 0, 0, `minecraft:block_${i}`);
    const { volume } = await readSchem((await writeSchem(v, { dataVersion: 1 })).bytes);
    expect(cellsOf(volume)).toEqual(cellsOf(v));
  });

  it("drops block-entity NBT with a warning", async () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:chest[facing=north]{Items:[]}");
    const { bytes, warnings } = await writeSchem(v, { dataVersion: 1 });
    expect(warnings).toHaveLength(1);
    expect((await readSchem(bytes)).volume.get(0, 0, 0)).toBe("minecraft:chest[facing=north]");
  });

  it("refuses an empty volume", () => {
    expect(() => buildSchem(new Volume(), { dataVersion: 1 })).toThrow(CodecError);
  });
});

describe(".schem and .nbt together", () => {
  it("converts .schem to .nbt and back without losing a block", async () => {
    const { volume } = await readSchem(loadFixture("synthetic/v3-small.schem"));
    const nbt = await writeStructureNbt(volume, { dataVersion: 4903 });
    const back = await readStructureNbt(nbt.bytes);
    expect(cellsOf(back.volume)).toEqual(cellsOf(volume));
  });
});

describe(".schem error handling", () => {
  it("rejects data that is not NBT", async () => {
    await expect(readSchem(Uint8Array.from([1, 2, 3, 4]))).rejects.toThrow(CodecError);
  });

  it("rejects unsupported versions and mismatched layouts", async () => {
    const v1 = writeNbt({ name: "Schematic", tag: compound([["Version", int(1)]]) });
    await expect(readSchem(v1)).rejects.toThrow(/unsupported Sponge schematic version 1/);
    const lying = writeNbt({
      name: "",
      tag: compound([["Schematic", compound([["Version", int(2)]])]]),
    });
    await expect(readSchem(lying)).rejects.toThrow(/wrong layout/);
  });

  it("rejects block data shorter than the volume, and undefined palette ids", async () => {
    const { bytes } = await writeSchem(
      (() => {
        const v = new Volume();
        v.set(0, 0, 0, "minecraft:stone");
        v.set(1, 0, 0, "minecraft:dirt");
        return v;
      })(),
      { dataVersion: 1 },
    );
    const root = await readNbtFile(bytes);
    const schem = root.tag.value.get("Schematic");
    if (schem?.type !== "compound") throw new Error("test setup");
    const blocks = schem.value.get("Blocks");
    if (blocks?.type !== "compound") throw new Error("test setup");

    blocks.value.set("Data", { type: "byteArray", value: Int8Array.from([0]) });
    await expect(readSchem(writeNbt(root))).rejects.toThrow(/fewer than 2 entries/);

    blocks.value.set("Data", { type: "byteArray", value: Int8Array.from([0, 9]) });
    await expect(readSchem(await gzip(writeNbt(root)))).rejects.toThrow(/palette id 9/);

    blocks.value.set("Data", { type: "byteArray", value: Int8Array.from([0, -1]) });
    await expect(readSchem(writeNbt(root))).rejects.toThrow(/varint/);
  });
});
