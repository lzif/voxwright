// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  AIR,
  CodecError,
  compound,
  gzip,
  int,
  readLitematic,
  readNbtFile,
  readStructureNbt,
  Volume,
  writeLitematic,
  writeNbt,
} from "../src/index.ts";
import { loadFixture } from "./helpers.ts";

function cellsOf(v: Volume): string[] {
  const out: string[] = [];
  v.eachCell((x, y, z, idx) => {
    out.push(`${x},${y},${z} ${v.palette[idx]}`);
  });
  return out.sort();
}

describe(".litematic", () => {
  it("reads the real file to the same blocks as the real .nbt of the same build", async () => {
    const lm = await readLitematic(loadFixture("real/rafeals-house/Rafeals_house.litematic"));
    const nbt = await readStructureNbt(loadFixture("real/rafeals-house/Rafeals_house.nbt"));
    expect(lm.meta).toMatchObject({ version: 7, dataVersion: 5023, regionCount: 1 });
    expect(lm.volume.size).toBe(762);
    expect(cellsOf(lm.volume)).toEqual(cellsOf(nbt.volume));
  });

  it("round-trips a volume", async () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    v.set(3, 1, 2, "minecraft:oak_stairs[facing=north,half=bottom]");
    v.set(1, 2, 4, "minecraft:glass");
    const { bytes, warnings } = await writeLitematic(v, { dataVersion: 4903 });
    expect(warnings).toEqual([]);
    const back = await readLitematic(bytes);
    expect(back.meta).toMatchObject({ version: 6, dataVersion: 4903, regionCount: 1 });
    expect(cellsOf(back.volume)).toEqual(cellsOf(v));
  });

  it("round-trips a palette that needs more than two bits and straddles longs", async () => {
    const v = new Volume();
    for (let i = 0; i < 70; i++)
      v.set(i % 7, Math.floor(i / 7) % 5, Math.floor(i / 35), `minecraft:block_${i}`);
    const back = await readLitematic((await writeLitematic(v, { dataVersion: 1 })).bytes);
    expect(cellsOf(back.volume)).toEqual(cellsOf(v));
  });

  it("puts air at palette index 0 and keeps carved air on request", async () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    v.set(1, 0, 0, AIR);
    v.set(2, 0, 0, "minecraft:stone");
    const { bytes } = await writeLitematic(v, { dataVersion: 1 });
    const root = (await readNbtFile(bytes)).tag;
    const region = (
      (root.value.get("Regions") as { value: Map<string, unknown> }).value.get("Main") as {
        value: Map<string, { value: { value: Map<string, { value: string }> }[] }>;
      }
    ).value;
    expect(region.get("BlockStatePalette")?.value[0]?.value.get("Name")?.value).toBe(AIR);
    const kept = await readLitematic(bytes, { keepAir: true });
    expect(kept.volume.get(1, 0, 0)).toBe(AIR);
    expect((await readLitematic(bytes)).volume.get(1, 0, 0)).toBeUndefined();
  });

  it("writes reproducible bytes", async () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    const a = await writeLitematic(v, { dataVersion: 1 });
    const b = await writeLitematic(v, { dataVersion: 1 });
    expect(a.bytes).toEqual(b.bytes);
  });

  it("drops block-entity NBT with a warning", async () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:chest[facing=north]{Items:[]}");
    const { bytes, warnings } = await writeLitematic(v, { dataVersion: 1 });
    expect(warnings).toHaveLength(1);
    expect((await readLitematic(bytes)).volume.get(0, 0, 0)).toBe("minecraft:chest[facing=north]");
  });

  it("rejects bad input", async () => {
    await expect(readLitematic(Uint8Array.from([1, 2, 3]))).rejects.toThrow(CodecError);
    const wrong = writeNbt({ name: "", tag: compound([["Version", int(2)]]) });
    await expect(readLitematic(await gzip(wrong))).rejects.toThrow(
      /unsupported litematic version 2/,
    );
    await expect(
      readLitematic(writeNbt({ name: "", tag: compound([["Version", int(6)]]) })),
    ).rejects.toThrow(CodecError);
    expect(() => new Volume().toDense()).not.toThrow();
  });
});
