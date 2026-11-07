// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  type BlockEntity,
  byte,
  type CompoundTag,
  cloneNbt,
  compound,
  double,
  Editor,
  entityPosition,
  float,
  gzip,
  int,
  list,
  longArray,
  nbtEqual,
  placeBlock,
  readLitematic,
  readMcstructure,
  readNbtFile,
  readSchem,
  readStructureNbt,
  string,
  TagId,
  Volume,
  type VolumeEntity,
  writeLitematic,
  writeMcstructure,
  writeNbt,
  writeSchem,
  writeStructureNbt,
} from "../src/index.ts";
import {
  armorStand,
  BANNER,
  blockEntitiesOf,
  buildingWithExtras,
  CHEST,
  chestEntity,
  cow,
  loadFixture,
  SIGN,
} from "./helpers.ts";

type Reader = (bytes: Uint8Array) => Promise<{ volume: Volume; warnings: string[] }>;
type Writer = (v: Volume) => Promise<{ bytes: Uint8Array; warnings: string[] }>;

const DV = 4903;
const JAVA_FORMATS: { name: string; read: Reader; write: Writer }[] = [
  {
    name: ".schem v2",
    read: (b) => readSchem(b),
    write: (v) => writeSchem(v, { dataVersion: DV, version: 2 }),
  },
  {
    name: ".schem v3",
    read: (b) => readSchem(b),
    write: (v) => writeSchem(v, { dataVersion: DV, version: 3 }),
  },
  {
    name: "structure .nbt",
    read: (b) => readStructureNbt(b),
    write: (v) => writeStructureNbt(v, { dataVersion: DV }),
  },
  {
    name: ".litematic",
    read: (b) => readLitematic(b),
    write: (v) => writeLitematic(v, { dataVersion: DV }),
  },
];

/**
 * `got` has the same extras as `want`, whose build starts at `origin` (the
 * codecs move the minimum corner to 0, so `got` is `want` minus `origin`).
 */
function expectSameExtras(
  got: Volume,
  want: Volume,
  origin: readonly [number, number, number] = [0, 0, 0],
): void {
  const a = blockEntitiesOf(got);
  const b = blockEntitiesOf(want, origin);
  expect([...a.keys()].sort()).toEqual([...b.keys()].sort());
  for (const [key, nbt] of b) {
    expect(nbtEqual(a.get(key) as CompoundTag, nbt), `block entity at ${key}`).toBe(true);
  }
  expect(got.entities).toHaveLength(want.entities.length);
  const strip = (n: CompoundTag): CompoundTag => {
    const c = cloneNbt(n);
    c.value.delete("Pos");
    return c;
  };
  want.entities.forEach((e, i) => {
    const g = got.entities[i] as VolumeEntity;
    const wp = entityPosition(e.nbt) as number[];
    const gp = entityPosition(g.nbt) as number[];
    expect(gp).toEqual(wp.map((v, k) => v - (origin[k] as number)));
    // Everything but the position is byte-equal.
    expect(nbtEqual(strip(g.nbt), strip(e.nbt)), `entity ${i}`).toBe(true);
  });
}

describe.each(JAVA_FORMATS)("$name keeps block entities and entities", ({ read, write }) => {
  it("round trips a chest with items, a sign, a banner and two entities", async () => {
    const v = buildingWithExtras();
    const first = await write(v);
    expect(first.warnings).toEqual([]);
    const a = await read(first.bytes);
    expect(a.warnings).toEqual([]);
    expect(a.volume.blockEntityCount).toBe(3);
    expect(a.volume.entities).toHaveLength(2);
    expectSameExtras(a.volume, v);
    // The block entity sits on its block, not next to it.
    expect(a.volume.get(1, 1, 1)).toBe(CHEST);
    expect(a.volume.get(3, 1, 2)).toBe(SIGN);
    expect(a.volume.get(4, 1, 0)).toBe(BANNER);
    // And again: read(write(read(f))) equals read(f).
    const b = await read((await write(a.volume)).bytes);
    expectSameExtras(b.volume, a.volume);
  });

  it("keeps positions right when the build does not start at the origin", async () => {
    const at = [7, 3, -5] as const;
    const v = buildingWithExtras(at);
    const back = (await read((await write(v)).bytes)).volume;
    // Every codec writes the build's minimum corner as its origin.
    expect(back.placedBounds()?.[0]).toEqual([0, 0, 0]);
    expectSameExtras(back, v, at);
    expect(back.get(1, 1, 1)).toBe(CHEST);
  });

  it("writes a block entity only on the block it belongs to", async () => {
    const v = buildingWithExtras();
    const back = (await read((await write(v)).bytes)).volume;
    back.eachBlockEntity((x, y, z, e) => {
      const block = back.get(x, y, z) as string;
      const id = (e.nbt.value.get("id") as { value: string }).value;
      expect(block.split("[")[0]?.endsWith(id.slice(10))).toBe(true);
    });
  });
});

describe("Java to Java conversion", () => {
  it("keeps block entities and entities through every format and back", async () => {
    const v = buildingWithExtras([2, 0, 1]);
    let current = v;
    const order = [1, 2, 3, 0, 3, 1, 2, 0];
    for (const i of order) {
      const f = JAVA_FORMATS[i] as (typeof JAVA_FORMATS)[number];
      const w = await f.write(current);
      expect(w.warnings, f.name).toEqual([]);
      const r = await f.read(w.bytes);
      expect(r.warnings, f.name).toEqual([]);
      current = r.volume;
      expectSameExtras(current, v, [2, 0, 1]);
    }
  });
});

describe("real files (Rafeals_house)", () => {
  // bloxelizer.com saved the 18 chests without block entities, so reading
  // the files gives chests with no data. These tests check that, then put
  // contents into the chests and send them through the writers.
  const files = {
    ".nbt": () => readStructureNbt(loadFixture("real/rafeals-house/Rafeals_house.nbt")),
    ".litematic": () => readLitematic(loadFixture("real/rafeals-house/Rafeals_house.litematic")),
    ".mcstructure": () =>
      readMcstructure(loadFixture("real/rafeals-house/Rafeals_house.mcstructure")),
  } as const;

  const chests = (v: Volume): [number, number, number][] => {
    const out: [number, number, number][] = [];
    v.eachCell((x, y, z, idx) => {
      if ((v.palette[idx] as string).startsWith("minecraft:chest")) out.push([x, y, z]);
    });
    return out.sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0]);
  };

  for (const [ext, load] of Object.entries(files)) {
    it(`${ext}: 18 chests, and no block entities or entities in the file`, async () => {
      const r = await load();
      expect(chests(r.volume)).toHaveLength(18);
      expect(r.volume.blockEntityCount).toBe(0);
      expect(r.volume.entities).toHaveLength(0);
      expect(r.warnings.filter((w) => /entit/.test(w))).toEqual([]);
    });
  }

  it("keeps filled chests through every Java format, from every real file", async () => {
    for (const [ext, load] of Object.entries(files)) {
      const { volume } = await load();
      const cells = chests(volume);
      cells.forEach(([x, y, z], i) => {
        volume.setBlockEntity(x, y, z, chestEntity(i));
      });
      volume.addEntity(armorStand(1.5, 1, 1.5));
      for (const f of JAVA_FORMATS) {
        if (ext === ".mcstructure") {
          // Bedrock-sourced: the same volume with Java data, as the editor would hold after a paste.
          expect(volume.blockEntityCount).toBe(18);
        }
        const w = await f.write(volume);
        expect(w.warnings, `${ext} -> ${f.name}`).toEqual([]);
        const back = (await f.read(w.bytes)).volume;
        expect(back.blockEntityCount, `${ext} -> ${f.name}`).toBe(18);
        expectSameExtras(back, volume);
        expect(chests(back)).toEqual(cells);
        back.eachBlockEntity((x, y, z, e) => {
          expect(back.get(x, y, z)?.startsWith("minecraft:chest")).toBe(true);
          expect(e.nbt.value.has("Items")).toBe(true);
        });
      }
    }
  });

  it("keeps all 18 chests when an unrelated block is edited and the build is exported", async () => {
    const { volume } = await files[".litematic"]();
    const cells = chests(volume);
    cells.forEach(([x, y, z], i) => {
      volume.setBlockEntity(x, y, z, chestEntity(i));
    });
    const file = (await writeLitematic(volume, { dataVersion: DV })).bytes;
    const opened = (await readLitematic(file, { keepAir: true })).volume;
    const editor = new Editor(opened);
    // Replace some stone-ish block that is not a chest.
    const target = [...opened.palette].find((p) => /^minecraft:(?!chest|air)/.test(p)) as string;
    let at: [number, number, number] | undefined;
    opened.eachCell((x, y, z, idx) => {
      if (at === undefined && opened.palette[idx] === target) at = [x, y, z];
    });
    editor.run(placeBlock(opened, at as [number, number, number], "minecraft:gold_block"));
    const out = await readLitematic((await writeLitematic(opened, { dataVersion: DV })).bytes);
    expect(out.volume.blockEntityCount).toBe(18);
    expectSameExtras(out.volume, volume);
  });

  it("reports the chests as lost when a Java file with them goes to Bedrock", async () => {
    const { volume } = await files[".litematic"]();
    for (const [x, y, z] of chests(volume)) volume.setBlockEntity(x, y, z, chestEntity());
    volume.addEntity(cow(1, 1, 1));
    const { warnings, bytes } = writeMcstructure(volume);
    expect(warnings).toContain(
      "18 block entities not carried over (Java NBT cannot be translated to Bedrock): chest x18",
    );
    expect(warnings).toContain(
      "1 entity not carried over (Java NBT cannot be translated to Bedrock): cow x1",
    );
    const back = await readMcstructure(bytes);
    expect(back.volume.blockEntityCount).toBe(0);
    expect(back.volume.entities).toHaveLength(0);
  });
});

describe("Bedrock", () => {
  /** A 2x1x1 .mcstructure with a Bedrock chest, a Bedrock sign and a Bedrock cow, written by hand. */
  function bedrockFile(): Uint8Array {
    const palette = [
      compound([
        ["name", string("minecraft:chest")],
        ["states", compound([["facing_direction", int(2)]])],
        ["version", int(18168865)],
      ]),
      compound([
        ["name", string("minecraft:stone")],
        ["states", compound()],
        ["version", int(18168865)],
      ]),
    ];
    const chest = compound([
      ["id", string("Chest")],
      ["isMovable", byte(1)],
      ["findable", byte(0)],
      [
        "Items",
        list(TagId.Compound, [
          compound([
            ["Name", string("minecraft:diamond")],
            ["Count", byte(3)],
            ["Damage", { type: "short", value: 0 }],
            ["Slot", byte(4)],
            ["WasPickedUp", byte(0)],
          ]),
        ]),
      ],
      ["x", int(-1234)],
      ["y", int(70)],
      ["z", int(99)],
    ]);
    const mob = compound([
      ["identifier", string("minecraft:cow")],
      [
        "Pos",
        list(TagId.Float, [
          { type: "float", value: 0.5 },
          { type: "float", value: 1 },
          { type: "float", value: 0.25 },
        ]),
      ],
      ["Health", float(10)],
    ]);
    const root = compound([
      ["format_version", int(1)],
      ["size", list(TagId.Int, [int(2), int(1), int(1)])],
      [
        "structure",
        compound([
          [
            "block_indices",
            list(TagId.List, [
              list(TagId.Int, [int(0), int(1)]),
              list(TagId.Int, [int(-1), int(-1)]),
            ]),
          ],
          ["entities", list(TagId.Compound, [mob])],
          [
            "palette",
            compound([
              [
                "default",
                compound([
                  ["block_palette", list(TagId.Compound, palette)],
                  [
                    "block_position_data",
                    compound([["0", compound([["block_entity_data", chest]])]]),
                  ],
                ]),
              ],
            ]),
          ],
        ]),
      ],
      ["structure_world_origin", list(TagId.Int, [int(0), int(0), int(0)])],
    ]);
    return writeNbt({ name: "", tag: root }, { endian: "little" });
  }

  it("keeps Bedrock block entities and entities verbatim from one .mcstructure to another", async () => {
    const a = await readMcstructure(bedrockFile());
    expect(a.warnings).toEqual([]);
    expect(a.volume.blockEntityCount).toBe(1);
    expect(a.volume.entities).toHaveLength(1);
    const be = a.volume.blockEntityAt(0, 0, 0) as BlockEntity;
    expect(be.edition).toBe("bedrock");
    expect(be.nbt.value.get("id")).toEqual(string("Chest"));
    const w = writeMcstructure(a.volume);
    expect(w.warnings).toEqual([]);
    const b = await readMcstructure(w.bytes);
    expect(b.warnings).toEqual([]);
    expect(nbtEqual((b.volume.blockEntityAt(0, 0, 0) as BlockEntity).nbt, be.nbt)).toBe(true);
    expect(
      nbtEqual(b.volume.entities[0]?.nbt as CompoundTag, a.volume.entities[0]?.nbt as CompoundTag),
    ).toBe(true);
    // In the file, everything but the position keys is what came in.
    const raw = (await readNbtFile(w.bytes, { endian: "little" })).tag;
    const out = (
      ((raw.value.get("structure") as CompoundTag).value.get("palette") as CompoundTag).value.get(
        "default",
      ) as CompoundTag
    ).value.get("block_position_data") as CompoundTag;
    const written = (out.value.get("0") as CompoundTag).value.get(
      "block_entity_data",
    ) as CompoundTag;
    expect(written.value.get("x")).toEqual(int(0));
    const stripped = cloneNbt(written);
    for (const k of ["x", "y", "z"]) stripped.value.delete(k);
    expect(nbtEqual(stripped, be.nbt)).toBe(true);
  });

  it("keeps Bedrock data through an edit of an unrelated block", async () => {
    const a = (await readMcstructure(bedrockFile())).volume;
    a.set(1, 0, 0, "minecraft:dirt");
    const b = (await readMcstructure(writeMcstructure(a).bytes)).volume;
    expect(b.blockEntityCount).toBe(1);
    expect(b.get(1, 0, 0)).toBe("minecraft:dirt");
  });

  it("reports Bedrock data as lost when it goes to a Java format, and writes none of it", async () => {
    const { volume } = await readMcstructure(bedrockFile());
    for (const f of JAVA_FORMATS) {
      const w = await f.write(volume);
      expect(w.warnings, f.name).toEqual([
        "1 block entity not carried over (Bedrock NBT cannot be translated to Java): Chest x1",
        "1 entity not carried over (Bedrock NBT cannot be translated to Java): cow x1",
      ]);
      const back = (await f.read(w.bytes)).volume;
      expect(back.blockEntityCount).toBe(0);
      expect(back.entities).toHaveLength(0);
      expect(back.get(0, 0, 0)).toBe("minecraft:chest[facing=north]");
    }
  });

  it("does not mix editions in one file", async () => {
    const bedrock = (await readMcstructure(bedrockFile())).volume;
    const v = buildingWithExtras();
    // A Bedrock entity among Java ones.
    for (const e of bedrock.entities) v.addEntity(e);
    const sch = await writeSchem(v, { dataVersion: DV });
    expect(sch.warnings).toEqual([
      "1 entity not carried over (Bedrock NBT cannot be translated to Java): cow x1",
    ]);
    expect((await readSchem(sch.bytes)).volume.entities).toHaveLength(2);
    const mc = writeMcstructure(v);
    expect(mc.warnings.some((w) => w.startsWith("3 block entities not carried over"))).toBe(true);
    expect((await readMcstructure(mc.bytes)).volume.entities).toHaveLength(1);
  });

  it("does not report a Java bed's empty block entity: Bedrock rebuilds the colour from the block", () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:red_bed[facing=north,occupied=false,part=foot]");
    v.set(0, 0, 1, "minecraft:red_bed[facing=north,occupied=false,part=head]");
    v.setBlockEntity(0, 0, 0, {
      edition: "java",
      nbt: compound([["id", string("minecraft:bed")]]),
    });
    expect(writeMcstructure(v).warnings).toEqual([]);
  });

  it("keeps a Bedrock bed's extra data, which the colour alone does not hold", async () => {
    const file = bedrockFile();
    const root = (await readNbtFile(file, { endian: "little" })).tag;
    const palette = (
      ((root.value.get("structure") as CompoundTag).value.get("palette") as CompoundTag).value.get(
        "default",
      ) as CompoundTag
    ).value.get("block_palette") as { value: CompoundTag[] };
    palette.value[1] = compound([
      ["name", string("minecraft:bed")],
      [
        "states",
        compound([
          ["direction", int(0)],
          ["head_piece_bit", byte(0)],
          ["occupied_bit", byte(0)],
        ]),
      ],
      ["version", int(18168865)],
    ]);
    const position = (
      ((root.value.get("structure") as CompoundTag).value.get("palette") as CompoundTag).value.get(
        "default",
      ) as CompoundTag
    ).value.get("block_position_data") as CompoundTag;
    position.value.set(
      "1",
      compound([
        [
          "block_entity_data",
          compound([
            ["id", string("Bed")],
            ["color", byte(14)],
            ["CustomName", string("my bed")],
          ]),
        ],
      ]),
    );
    const a = await readMcstructure(writeNbt({ name: "", tag: root }, { endian: "little" }));
    expect(a.volume.get(1, 0, 0)).toContain("red_bed");
    expect(a.volume.blockEntityAt(1, 0, 0)?.nbt.value.get("CustomName")).toEqual(string("my bed"));
    const b = await readMcstructure(writeMcstructure(a.volume).bytes);
    expect(b.volume.blockEntityAt(1, 0, 0)?.nbt.value.get("CustomName")).toEqual(string("my bed"));
    expect(b.volume.get(1, 0, 0)).toContain("red_bed");
  });
});

describe("loss reports", () => {
  it("counts block entities and entities that sit where no block is", async () => {
    // A .schem whose block entity and entity positions are broken.
    const v = buildingWithExtras();
    const w = await writeSchem(v, { dataVersion: DV, version: 3 });
    const root = (await readNbtFile(w.bytes)).tag;
    const schem = root.value.get("Schematic") as CompoundTag;
    const blocks = schem.value.get("Blocks") as CompoundTag;
    const bes = blocks.value.get("BlockEntities") as { value: CompoundTag[] };
    // Move the chest to an air cell and drop another's position.
    bes.value[0]?.value.set("Pos", { type: "intArray", value: Int32Array.of(0, 1, 0) });
    bes.value[1]?.value.delete("Pos");
    const ents = schem.value.get("Entities") as { value: CompoundTag[] };
    ents.value[1]?.value.delete("Pos");
    const bytes = await gzip(writeNbt({ name: "", tag: root }));
    const r = await readSchem(bytes, { keepAir: true });
    // The banner, moved onto an air cell, is kept because air is kept; the chest has no position.
    expect(r.volume.blockEntityCount).toBe(2);
    expect(r.meta.droppedBlockEntities).toBe(1);
    expect(r.meta.droppedEntities).toBe(1);
    expect(r.warnings).toEqual([
      "1 block entity not carried over (their position holds no block, or is missing or malformed): chest x1",
      "1 entity not carried over (their position holds no block, or is missing or malformed): cow x1",
    ]);
    const noAir = await readSchem(bytes);
    expect(noAir.meta.droppedBlockEntities).toBe(2);
  });

  it("reports pending ticks it does not carry", async () => {
    const w = await writeLitematic(buildingWithExtras(), { dataVersion: DV });
    const root = (await readNbtFile(w.bytes)).tag;
    const region = (root.value.get("Regions") as CompoundTag).value.get("Main") as CompoundTag;
    region.value.set(
      "PendingBlockTicks",
      list(TagId.Compound, [compound([["x", int(0)]]), compound([["x", int(1)]])]),
    );
    const r = await readLitematic(await gzip(writeNbt({ name: "Litematic", tag: root })));
    expect(r.warnings).toContain("2 pending block and fluid ticks not carried over");
  });
});

/** A .litematic written by hand: regions at chosen positions and sizes, 2 bits per block. */
function litematic(
  regions: {
    name: string;
    pos: [number, number, number];
    size: [number, number, number];
    /** `[x, y, z, 0 air | 1 stone | 2 chest]` in region-local coordinates. */
    cells: [number, number, number, number][];
    tiles?: CompoundTag[];
    entities?: CompoundTag[];
  }[],
): Promise<Uint8Array> {
  const regionTags: [string, CompoundTag][] = regions.map((r) => {
    const [w, h, l] = r.size.map(Math.abs) as [number, number, number];
    const values = new Array<number>(w * h * l).fill(0);
    for (const [x, y, z, v] of r.cells) values[(y * l + z) * w + x] = v;
    const words = new BigInt64Array(Math.ceil((values.length * 2) / 64));
    values.forEach((v, i) => {
      const wi = Math.floor((i * 2) / 64);
      words[wi] = BigInt.asIntN(
        64,
        BigInt.asUintN(64, words[wi] as bigint) | (BigInt(v) << BigInt((i * 2) % 64)),
      );
    });
    const vec = (a: number[]): CompoundTag =>
      compound([
        ["x", int(a[0] as number)],
        ["y", int(a[1] as number)],
        ["z", int(a[2] as number)],
      ]);
    return [
      r.name,
      compound([
        ["Position", vec(r.pos)],
        ["Size", vec(r.size)],
        [
          "BlockStatePalette",
          list(TagId.Compound, [
            compound([["Name", string("minecraft:air")]]),
            compound([["Name", string("minecraft:stone")]]),
            compound([
              ["Name", string("minecraft:chest")],
              [
                "Properties",
                compound([
                  ["facing", string("north")],
                  ["type", string("single")],
                  ["waterlogged", string("false")],
                ]),
              ],
            ]),
          ]),
        ],
        ["BlockStates", longArray(words)],
        ["TileEntities", list(TagId.Compound, r.tiles ?? [])],
        ["Entities", list(TagId.Compound, r.entities ?? [])],
      ]),
    ];
  });
  const root = compound([
    ["Version", int(6)],
    ["MinecraftDataVersion", int(DV)],
    ["Regions", compound(regionTags)],
  ]);
  return Promise.resolve(writeNbt({ name: "Litematic", tag: root })).then((b) => gzip(b));
}

const tile = (x: number, y: number, z: number, item: string): CompoundTag =>
  compound([
    ["x", int(x)],
    ["y", int(y)],
    ["z", int(z)],
    ["id", string("minecraft:chest")],
    [
      "Items",
      list(TagId.Compound, [
        compound([
          ["Slot", byte(0)],
          ["id", string(item)],
          ["count", int(1)],
        ]),
      ]),
    ],
  ]);
const mob = (x: number, y: number, z: number): CompoundTag =>
  compound([
    ["id", string("minecraft:cow")],
    ["Pos", list(TagId.Double, [double(x), double(y), double(z)])],
  ]);

describe(".litematic regions", () => {
  it("places block entities and entities of several regions, one with a negative size", async () => {
    // Region A: min corner (10, 5, 20), 3x2x2, a chest at local (2, 1, 1).
    // Region B: Position (4, 5, 22) with size -2x1x-3, so it spans x 3..4, y 5, z 20..22.
    //   A chest at local (0, 0, 2) is the cell (3, 5, 22).
    const bytes = await litematic([
      {
        name: "A",
        pos: [10, 5, 20],
        size: [3, 2, 2],
        cells: [
          [0, 0, 0, 1],
          [2, 1, 1, 2],
        ],
        tiles: [tile(2, 1, 1, "minecraft:gold_ingot")],
        entities: [mob(0.5, 1, 1.5)],
      },
      {
        name: "B",
        pos: [4, 5, 22],
        size: [-2, 1, -3],
        cells: [
          [1, 0, 0, 1],
          [0, 0, 2, 2],
        ],
        tiles: [tile(0, 0, 2, "minecraft:iron_ingot")],
        entities: [mob(1.25, 0, 0.75)],
      },
    ]);
    const r = await readLitematic(bytes);
    expect(r.warnings).toEqual(["2 regions flattened into one"]);
    // Absolute cells: A at (10,5,20) stone, (12,6,21) chest; B at (4,5,20) stone, (3,5,22) chest.
    // The smallest corner is (3, 5, 20).
    expect(r.volume.get(7, 0, 0)).toBe("minecraft:stone");
    expect(r.volume.get(9, 1, 1)?.startsWith("minecraft:chest")).toBe(true);
    expect(r.volume.get(1, 0, 0)).toBe("minecraft:stone");
    expect(r.volume.get(0, 0, 2)?.startsWith("minecraft:chest")).toBe(true);
    const items = (x: number, y: number, z: number): unknown => {
      const stacks = r.volume.blockEntityAt(x, y, z)?.nbt.value.get("Items") as
        | { value: CompoundTag[] }
        | undefined;
      return (stacks?.value[0]?.value.get("id") as { value: string } | undefined)?.value;
    };
    expect(r.volume.blockEntityCount).toBe(2);
    expect(items(9, 1, 1)).toBe("minecraft:gold_ingot");
    expect(items(0, 0, 2)).toBe("minecraft:iron_ingot");
    // Entities: A's at (10.5, 6, 21.5) and B's at (3 + 1.25, 5, 20 + 0.75), minus (3, 5, 20).
    expect(r.volume.entities.map((e) => entityPosition(e.nbt))).toEqual([
      [7.5, 1, 1.5],
      [1.25, 0, 0.75],
    ]);
    // No position key is left in the stored block entity.
    expect([...(r.volume.blockEntityAt(9, 1, 1)?.nbt.value.keys() ?? [])]).toEqual(["id", "Items"]);
  });

  it("round trips through the writer, which flattens the regions into one", async () => {
    const bytes = await litematic([
      {
        name: "A",
        pos: [10, 5, 20],
        size: [3, 2, 2],
        cells: [[2, 1, 1, 2]],
        tiles: [tile(2, 1, 1, "minecraft:gold_ingot")],
        entities: [mob(0.5, 1, 1.5)],
      },
      {
        name: "B",
        pos: [4, 5, 22],
        size: [-2, 1, -3],
        cells: [[0, 0, 2, 2]],
        tiles: [tile(0, 0, 2, "minecraft:iron_ingot")],
      },
    ]);
    const a = await readLitematic(bytes);
    const b = await readLitematic((await writeLitematic(a.volume, { dataVersion: DV })).bytes);
    expectSameExtras(b.volume, a.volume);
    const c = await readSchem((await writeSchem(a.volume, { dataVersion: DV })).bytes);
    expectSameExtras(c.volume, a.volume);
  });

  it("does not attach a block entity to another region's block", async () => {
    // Region B's chest cell is air in B but stone in A (placed first): the tile entity of B must go.
    const bytes = await litematic([
      {
        name: "A",
        pos: [0, 0, 0],
        size: [2, 1, 1],
        cells: [
          [0, 0, 0, 1],
          [1, 0, 0, 1],
        ],
      },
      {
        name: "B",
        pos: [0, 0, 0],
        size: [2, 1, 1],
        cells: [[0, 0, 0, 2]],
        tiles: [tile(1, 0, 0, "minecraft:gold_ingot")],
      },
    ]);
    const r = await readLitematic(bytes);
    expect(r.volume.blockEntityCount).toBe(0);
    expect(r.warnings).toEqual([
      "1 block entity not carried over (their position holds no block, or is missing or malformed): chest x1",
      "2 regions flattened into one",
      "1 cell overwritten where regions overlap (the later region wins)",
    ]);
  });

  it("lets a later region's block replace an earlier region's block entity", async () => {
    const bytes = await litematic([
      {
        name: "A",
        pos: [0, 0, 0],
        size: [1, 1, 1],
        cells: [[0, 0, 0, 2]],
        tiles: [tile(0, 0, 0, "minecraft:gold_ingot")],
      },
      { name: "B", pos: [0, 0, 0], size: [1, 1, 1], cells: [[0, 0, 0, 2]] },
    ]);
    const r = await readLitematic(bytes);
    expect(r.volume.get(0, 0, 0)?.startsWith("minecraft:chest")).toBe(true);
    expect(r.volume.blockEntityCount).toBe(0);
  });
});

describe("structure .nbt files", () => {
  it("reads the file layout: nbt on the block, entities with pos, blockPos and nbt", async () => {
    const root = compound([
      ["DataVersion", int(DV)],
      ["size", list(TagId.Int, [int(3), int(2), int(2)])],
      [
        "palette",
        list(TagId.Compound, [
          compound([["Name", string("minecraft:stone")]]),
          compound([
            ["Name", string("minecraft:chest")],
            ["Properties", compound([["facing", string("north")]])],
          ]),
        ]),
      ],
      [
        "blocks",
        list(TagId.Compound, [
          compound([
            ["pos", list(TagId.Int, [int(1), int(0), int(0)])],
            ["state", int(0)],
          ]),
          compound([
            ["pos", list(TagId.Int, [int(2), int(1), int(1)])],
            ["state", int(1)],
            [
              "nbt",
              compound([
                ["id", string("minecraft:chest")],
                ["Items", list(TagId.Compound, [])],
                ["Lock", string("k")],
              ]),
            ],
          ]),
        ]),
      ],
      [
        "entities",
        list(TagId.Compound, [
          compound([
            ["pos", list(TagId.Double, [double(2.5), double(1), double(0.5)])],
            ["blockPos", list(TagId.Int, [int(2), int(1), int(0)])],
            [
              "nbt",
              compound([
                ["id", string("minecraft:cow")],
                ["Pos", list(TagId.Double, [double(100.5), double(64), double(100.5)])],
                ["Air", { type: "short", value: 300 }],
              ]),
            ],
          ]),
        ]),
      ],
    ]);
    const r = await readStructureNbt(await gzip(writeNbt({ name: "", tag: root })));
    // The smallest kept block is x=1, y=0, z=0, so everything shifts by (1, 0, 0).
    expect(r.volume.get(1, 1, 1)).toBe("minecraft:chest[facing=north]");
    expect(r.volume.blockEntityAt(1, 1, 1)?.nbt.value.get("Lock")).toEqual(string("k"));
    expect(entityPosition(r.volume.entities[0]?.nbt as CompoundTag)).toEqual([1.5, 1, 0.5]);
    // Written back: pos and blockPos follow the volume, and nbt carries the same Pos.
    const w = await writeStructureNbt(r.volume, { dataVersion: DV });
    const out = (await readNbtFile(w.bytes)).tag;
    const e = (out.value.get("entities") as { value: CompoundTag[] }).value[0] as CompoundTag;
    expect(e.value.get("pos")).toEqual(list(TagId.Double, [double(1.5), double(1), double(0.5)]));
    expect(e.value.get("blockPos")).toEqual(list(TagId.Int, [int(1), int(1), int(0)]));
    const blocks = (out.value.get("blocks") as { value: CompoundTag[] }).value;
    expect(blocks.filter((b) => b.value.has("nbt"))).toHaveLength(1);
  });

  it("reports an air block's nbt as lost when air is left out", async () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    v.set(1, 0, 0, "minecraft:air");
    v.setBlockEntity(1, 0, 0, {
      edition: "java",
      nbt: compound([["id", string("minecraft:chest")]]),
    });
    const none = await writeStructureNbt(v, { dataVersion: DV });
    expect(none.warnings).toEqual([
      "1 block entity not carried over (their cell is air, which this export leaves out): chest x1",
    ]);
    const explicit = await writeStructureNbt(v, { dataVersion: DV, air: "explicit" });
    expect(explicit.warnings).toEqual([]);
  });
});

describe("Volume", () => {
  it("drops a block entity with its cell, keeps it for the same block name, drops it for another", () => {
    const v = new Volume();
    v.set(0, 0, 0, CHEST);
    v.setBlockEntity(0, 0, 0, chestEntity());
    v.set(0, 0, 0, "minecraft:chest[facing=east,type=single,waterlogged=false]");
    expect(v.blockEntityCount).toBe(1);
    v.set(0, 0, 0, "minecraft:barrel[facing=up]");
    expect(v.blockEntityCount).toBe(0);
    v.set(0, 0, 0, CHEST);
    v.setBlockEntity(0, 0, 0, chestEntity());
    v.unset(0, 0, 0);
    expect(v.blockEntityCount).toBe(0);
    expect(() => v.setBlockEntity(0, 0, 0, chestEntity())).toThrow(/unset cell/);
  });

  it("moves block entities and entities when translated", () => {
    const v = buildingWithExtras();
    v.translate(3, -1, 2);
    expect(v.blockEntityAt(4, 0, 3)?.nbt.value.get("id")).toEqual(string("minecraft:chest"));
    expect(entityPosition(v.entities[0]?.nbt as CompoundTag)).toEqual([5.5, 0, 2.25]);
    expect(v.blockEntityCount).toBe(3);
  });
});

describe("shifting positions", () => {
  it("keeps fractional positions exactly, and within rounding when the origin moves them", async () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    v.addEntity(cow(0.1, 1.7, 0.3));
    const back = (await readSchem((await writeSchem(v, { dataVersion: DV })).bytes)).volume;
    expect(entityPosition(back.entities[0]?.nbt as CompoundTag)).toEqual([0.1, 1.7, 0.3]);
    const w = new Volume();
    w.set(7, 3, -5, "minecraft:stone");
    w.addEntity(cow(7.1, 3.7, -4.7));
    const moved = (await readSchem((await writeSchem(w, { dataVersion: DV })).bytes)).volume;
    const p = entityPosition(moved.entities[0]?.nbt as CompoundTag) as number[];
    expect(p[0]).toBeCloseTo(0.1, 12);
    expect(p[1]).toBeCloseTo(0.7, 12);
    expect(p[2]).toBeCloseTo(0.3, 12);
  });
});
