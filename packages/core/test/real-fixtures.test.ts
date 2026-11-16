// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  AIR,
  LEGACY_SCHEMATIC_MESSAGE,
  readLitematic,
  readSchem,
  readStructureNbt,
  type Volume,
  writeLitematic,
  writeSchem,
  writeStructureNbt,
} from "../src/index.ts";
import { loadFixture } from "./helpers.ts";

function expectSameCells(actual: Volume, expected: Volume): void {
  expect(actual.size).toBe(expected.size);
  let mismatches = 0;
  actual.eachCell((x, y, z, idx) => {
    if (expected.get(x, y, z) !== actual.palette[idx]) mismatches++;
  });
  expect(mismatches).toBe(0);
}

// Rafeals_house was saved by a real tool (bloxelizer.com) in three formats.
// The .nbt uses DataVersion 5023, whose palette entries are spelled
// `id` and `properties`.
describe("Rafeals_house.nbt (saved by a real tool)", () => {
  const file = () => loadFixture("real/rafeals-house/Rafeals_house.nbt");

  it("reads every block", async () => {
    const { volume, meta } = await readStructureNbt(file());
    expect(meta).toEqual({ dataVersion: 5023, droppedBlockEntities: 0, droppedEntities: 0 });
    expect(volume.size).toBe(762);
    expect(volume.countNonAir()).toBe(762);
    const [min, max] = volume.bounds() ?? [];
    expect(min).toEqual([0, 0, 0]);
    expect(max).toEqual([13, 7, 13]);
  });

  it("reads block states with their properties", async () => {
    const { volume } = await readStructureNbt(file());
    expect(volume.palette).toContain("minecraft:barrel[facing=down,open=false]");
    expect(volume.palette).toContain("minecraft:black_bed[facing=north,occupied=false,part=head]");
    expect(volume.palette).not.toContain(AIR);
  });
});

describe("WorldEdit fantasyhouse2.schem (Sponge v3)", () => {
  const file = () => loadFixture("real/worldedit/fantasyhouse2.schem");

  it("reads blocks, 2-byte palette varints, block entities, entities and offset", async () => {
    const { volume, meta, warnings } = await readSchem(file());
    expect(meta).toEqual({
      version: 3,
      dataVersion: 5023,
      offset: [-18, -13, -32],
      width: 44,
      height: 39,
      length: 34,
      droppedBlockEntities: 0,
      droppedEntities: 0,
    });
    expect(volume.size).toBe(22953);
    expect(volume.countNonAir()).toBe(22953);
    expect(volume.palette).toHaveLength(342);
    expect(volume.blockEntityCount).toBe(93);
    expect(volume.entities).toHaveLength(41);
    expect(volume.bounds()).toEqual([
      [0, 0, 0],
      [43, 35, 33],
    ]);
    expect(warnings).toEqual(["Metadata not carried over (Date, WorldEdit)"]);

    const entityIds = new Set(volume.entities.map((e) => e.nbt.value.get("id")?.value));
    expect(entityIds).toEqual(
      new Set([
        "minecraft:painting",
        "minecraft:cushion",
        "minecraft:spruce_boat",
        "minecraft:cod",
        "minecraft:armor_stand",
        "minecraft:item_frame",
      ]),
    );
  });

  it("keeps air across the full declared volume when requested", async () => {
    const { volume } = await readSchem(file(), { keepAir: true });
    expect(volume.size).toBe(44 * 39 * 34);
    expect(volume.countNonAir()).toBe(22953);
  });

  it("round-trips through .schem (v2/v3), .nbt and .litematic without losing blocks or entities", async () => {
    const { volume, meta } = await readSchem(file());
    const dv = meta.dataVersion as number;

    for (const version of [2, 3] as const) {
      const written = await writeSchem(volume, { dataVersion: dv, version, offset: meta.offset });
      expect(written.warnings).toEqual([]);
      const back = await readSchem(written.bytes);
      expect(back.meta).toMatchObject({ version, dataVersion: dv, offset: meta.offset });
      expectSameCells(back.volume, volume);
      expect(back.volume.blockEntityCount).toBe(93);
      expect(back.volume.entities).toHaveLength(41);
    }

    const nbt = await writeStructureNbt(volume, { dataVersion: dv });
    expect(nbt.warnings).toEqual([]);
    const nbtBack = await readStructureNbt(nbt.bytes);
    expectSameCells(nbtBack.volume, volume);
    expect(nbtBack.volume.blockEntityCount).toBe(93);
    expect(nbtBack.volume.entities).toHaveLength(41);

    const lit = await writeLitematic(volume, { dataVersion: dv });
    expect(lit.warnings).toEqual([]);
    const litBack = await readLitematic(lit.bytes);
    expectSameCells(litBack.volume, volume);
    expect(litBack.volume.blockEntityCount).toBe(93);
    expect(litBack.volume.entities).toHaveLength(41);
  });
});

describe("Shulkr Sponge v3 .schem fixtures", () => {
  const cases = [
    {
      file: "real/shulkr/castelo-medieval.schem",
      width: 29,
      height: 39,
      length: 27,
      blocks: 4895,
      states: 143,
      blockEntities: 6,
    },
    {
      file: "real/shulkr/raifox-medivial-house.schem",
      width: 14,
      height: 20,
      length: 15,
      blocks: 1595,
      states: 146,
      blockEntities: 138,
    },
    {
      file: "real/shulkr/simple-survival-mansion.schem",
      width: 25,
      height: 26,
      length: 47,
      blocks: 6218,
      states: 277,
      blockEntities: 77,
    },
  ];

  it.each(cases)(
    "reads $file ($blocks blocks, $blockEntities block entities)",
    async ({ file, width, height, length, blocks, states, blockEntities }) => {
      const { volume, meta, warnings } = await readSchem(loadFixture(file));
      expect(meta).toEqual({
        version: 3,
        dataVersion: 5023,
        offset: [0, 0, 0],
        width,
        height,
        length,
        droppedBlockEntities: 0,
        droppedEntities: 0,
      });
      expect(volume.size).toBe(blocks);
      expect(volume.countNonAir()).toBe(blocks);
      expect(volume.palette).toHaveLength(states);
      expect(volume.blockEntityCount).toBe(blockEntities);
      expect(volume.entities).toHaveLength(0);
      expect(warnings).toEqual([
        "Metadata not carried over (Name, Author, Description, Date, Software)",
      ]);
    },
  );
});

describe("Flat Sponge v2 layout stamped Version 3 (.schem)", () => {
  const cases = [
    {
      file: "real/flat-v3/smp_lobby_big.schem",
      width: 81,
      height: 24,
      length: 81,
      blocks: 18295,
      states: 41,
      max: [80, 13, 80] as [number, number, number],
    },
    {
      file: "real/flat-v3/smp_lobby_center_dense.schem",
      width: 101,
      height: 38,
      length: 101,
      blocks: 33882,
      states: 88,
      max: [100, 25, 100] as [number, number, number],
    },
    {
      file: "real/flat-v3/smp_lobby_medieval.schem",
      width: 101,
      height: 32,
      length: 101,
      blocks: 31699,
      states: 40,
      max: [100, 24, 100] as [number, number, number],
    },
  ];

  it.each(cases)(
    "reads $file ($blocks blocks) and warns about the layout mismatch",
    async ({ file, width, height, length, blocks, states, max }) => {
      const { volume, meta, warnings } = await readSchem(loadFixture(file));
      expect(meta).toEqual({
        version: 3,
        dataVersion: 3465,
        offset: [0, 0, 0],
        width,
        height,
        length,
        droppedBlockEntities: 0,
        droppedEntities: 0,
      });
      expect(volume.size).toBe(blocks);
      expect(volume.countNonAir()).toBe(blocks);
      expect(volume.palette).toHaveLength(states);
      expect(volume.bounds()).toEqual([[0, 0, 0], max]);
      expect(warnings).toEqual(["Version is 3, but layout is Sponge v2 (read using v2 layout)"]);
    },
  );

  it("re-writes a flat-v3 build into standard Sponge v3 cleanly", async () => {
    const orig = await readSchem(loadFixture("real/flat-v3/smp_lobby_big.schem"));
    const written = await writeSchem(orig.volume, {
      dataVersion: orig.meta.dataVersion as number,
    });
    expect(written.warnings).toEqual([]);
    const back = await readSchem(written.bytes);
    expect(back.warnings).toEqual([]);
    expectSameCells(back.volume, orig.volume);
  });
});

describe("Legacy pre-1.13 .schematic fixture", () => {
  it("refuses storageroom-medieval.schematic with guidance to re-save as .schem", async () => {
    await expect(
      readSchem(loadFixture("real/legacy/storageroom-medieval.schematic")),
    ).rejects.toThrow(LEGACY_SCHEMATIC_MESSAGE);
  });
});
