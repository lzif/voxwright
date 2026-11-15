// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  AIR,
  bedrockToJava,
  CodecError,
  type CompoundTag,
  canonicalize,
  javaToBedrock,
  type ListTag,
  parseBlockString,
  readLitematic,
  readMcstructure,
  readNbt,
  readStructureNbt,
  TagId,
  tagId,
  Volume,
  writeMcstructure,
} from "../src/index.ts";
import { loadFixture } from "./helpers.ts";

/**
 * Java properties that Bedrock has no state for and that equal the Java
 * default, so a block without them means the same thing.
 */
const JAVA_DEFAULTS = new Map([
  ["waterlogged", "false"],
  ["lit", "false"],
  ["powered", "false"],
  ["type", "single"],
  ["side_chain", "unconnected"],
]);

function normalize(state: string): string {
  const { name, props } = parseBlockString(state);
  for (const [k, v] of [...props]) if (JAVA_DEFAULTS.get(k) === v) props.delete(k);
  return canonicalize(
    props.size === 0 ? name : `${name}[${[...props].map(([k, v]) => `${k}=${v}`).join(",")}]`,
  );
}

function cellsOf(v: Volume, norm = false): string[] {
  const out: string[] = [];
  v.eachCell((x, y, z, idx) => {
    const s = v.palette[idx] as string;
    out.push(`${x},${y},${z} ${norm ? normalize(s) : s}`);
  });
  return out.sort();
}

describe(".mcstructure", () => {
  it("reads the real file to the same blocks as the real .nbt of the same build", async () => {
    const mc = await readMcstructure(loadFixture("real/rafeals-house/Rafeals_house.mcstructure"));
    const nbt = await readStructureNbt(loadFixture("real/rafeals-house/Rafeals_house.nbt"));
    expect(mc.meta).toMatchObject({
      size: [14, 8, 14],
      droppedEntities: 0,
      droppedBlockEntities: 0,
    });
    expect(mc.volume.size).toBe(762);
    expect(cellsOf(mc.volume, true)).toEqual(cellsOf(nbt.volume, true));
    expect(mc.warnings).toEqual([]);
  });

  it("agrees with the real .litematic too", async () => {
    const mc = await readMcstructure(loadFixture("real/rafeals-house/Rafeals_house.mcstructure"));
    const lm = await readLitematic(loadFixture("real/rafeals-house/Rafeals_house.litematic"));
    expect(cellsOf(mc.volume, true)).toEqual(cellsOf(lm.volume, true));
  });

  it("round-trips the real build through Bedrock and back", async () => {
    const nbt = await readStructureNbt(loadFixture("real/rafeals-house/Rafeals_house.nbt"));
    const { bytes, warnings } = writeMcstructure(nbt.volume);
    expect(warnings).toEqual([]);
    const back = await readMcstructure(bytes);
    expect(back.warnings).toEqual([]);
    expect(cellsOf(back.volume, true)).toEqual(cellsOf(nbt.volume, true));
  });

  it("keeps carved air and waterlogging", async () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    v.set(1, 0, 0, AIR);
    v.set(
      2,
      0,
      0,
      "minecraft:oak_stairs[facing=north,half=bottom,shape=straight,waterlogged=true]",
    );
    const { bytes } = writeMcstructure(v);
    const kept = await readMcstructure(bytes, { keepAir: true });
    expect(kept.volume.get(1, 0, 0)).toBe(AIR);
    expect(kept.volume.get(2, 0, 0)).toBe(
      "minecraft:oak_stairs[facing=north,half=bottom,shape=straight,waterlogged=true]",
    );
    expect((await readMcstructure(bytes)).volume.get(1, 0, 0)).toBeUndefined();
  });

  it("round-trips beds with their colour", async () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:red_bed[facing=east,occupied=false,part=foot]");
    v.set(1, 0, 0, "minecraft:red_bed[facing=east,occupied=false,part=head]");
    v.set(0, 0, 2, "minecraft:light_blue_bed[facing=south,occupied=false,part=foot]");
    const back = await readMcstructure(writeMcstructure(v).bytes);
    expect(cellsOf(back.volume)).toEqual(cellsOf(v));
  });

  it("reports what it cannot express instead of guessing", async () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:oak_sapling[stage=1]");
    const { bytes, warnings } = writeMcstructure(v);
    expect(warnings).toEqual(["oak_sapling: dropped Java property stage=1"]);
    expect((await readMcstructure(bytes)).volume.get(0, 0, 0)).toBe("minecraft:oak_sapling");
    const r = bedrockToJava("minecraft:oak_sapling", new Map([["age_bit", 1]]));
    expect(r.warnings).toEqual(["oak_sapling: dropped Bedrock state age_bit=1"]);
  });

  it("translates stairs, slabs and doors both ways", () => {
    const cases: [string, string][] = [
      ["minecraft:oak_stairs[facing=south,half=top,shape=inner_left]", "oak_stairs"],
      ["minecraft:oak_slab[type=top]", "oak_slab"],
      ["minecraft:oak_slab[type=double]", "oak_double_slab"],
      ["minecraft:iron_door[facing=east,half=upper,hinge=right,open=true]", "iron_door"],
      [
        "minecraft:cobblestone_wall[east=low,north=tall,south=none,up=true,west=low]",
        "cobblestone_wall",
      ],
    ];
    for (const [java, bedrockName] of cases) {
      const b = javaToBedrock(java);
      expect(b.block.name).toBe(`minecraft:${bedrockName}`);
      const states = new Map([...b.block.states].map(([k, v]) => [k, v.value]));
      expect(bedrockToJava(b.block.name, states).state).toBe(canonicalize(java));
    }
  });

  it("translates a stair that leaves out its default properties", () => {
    // What a build script places: no `shape`, sometimes no `half`.
    const states = (java: string) =>
      new Map([...javaToBedrock(java).block.states].map(([k, v]) => [k, v.value]));
    const full = "minecraft:spruce_stairs[facing=west,half=top,shape=straight]";
    expect(states("minecraft:spruce_stairs[facing=west,half=top]")).toEqual(states(full));
    expect(javaToBedrock("minecraft:spruce_stairs[facing=west,half=top]").warnings).toEqual([]);
    expect(states("minecraft:spruce_stairs[facing=north]")).toEqual(
      states("minecraft:spruce_stairs[facing=north,half=bottom,shape=straight]"),
    );
    expect(
      states("minecraft:spruce_stairs[facing=north]").has("minecraft:cardinal_direction"),
    ).toBe(false);
  });

  it("translates trapdoors, leaves, lanterns and torches both ways", () => {
    const states = (java: string) =>
      Object.fromEntries([...javaToBedrock(java).block.states].map(([k, v]) => [k, v.value]));
    expect(states("minecraft:spruce_trapdoor[facing=west,half=top,open=true]")).toEqual({
      direction: 1,
      upside_down_bit: 1,
      open_bit: 1,
    });
    expect(states("minecraft:oak_leaves[persistent=true]")).toEqual({
      persistent_bit: 1,
      update_bit: 0,
    });
    expect(states("minecraft:lantern[hanging=true]")).toEqual({ hanging: 1 });
    // Bedrock has one torch block and names the side it is attached to.
    const torch = javaToBedrock("minecraft:wall_torch[facing=south]");
    expect(torch.block.name).toBe("minecraft:torch");
    expect(torch.block.states.get("torch_facing_direction")?.value).toBe("north");
    expect(states("minecraft:soul_torch")).toEqual({ torch_facing_direction: "top" });

    for (const java of [
      "minecraft:spruce_trapdoor[facing=west,half=top,open=true]",
      "minecraft:iron_trapdoor[facing=north,half=bottom,open=false]",
      "minecraft:oak_leaves[persistent=true]",
      "minecraft:soul_lantern[hanging=true]",
      "minecraft:lantern[hanging=false]",
      "minecraft:wall_torch[facing=east]",
      "minecraft:soul_wall_torch[facing=north]",
      "minecraft:torch",
    ]) {
      const b = javaToBedrock(java);
      expect(b.warnings, java).toEqual([]);
      const back = new Map([...b.block.states].map(([k, v]) => [k, v.value]));
      expect(bedrockToJava(b.block.name, back).state, java).toBe(canonicalize(java));
    }
  });

  it("writes minecraft:connection_* as NBT TAG_Byte (1) and keeps minecraft:corner", async () => {
    const fence = "minecraft:oak_fence[east=true,north=false,south=true,west=false]";
    const pane = "minecraft:glass_pane[east=false,north=true,south=false,west=true]";
    const stairs = "minecraft:oak_stairs[facing=north,half=bottom,shape=outer_right]";

    const fenceBedrock = javaToBedrock(fence);
    expect(fenceBedrock.warnings).toEqual([]);
    expect(fenceBedrock.block.states.get("minecraft:connection_east")).toEqual({
      kind: "byte",
      value: 1,
    });
    expect(fenceBedrock.block.states.get("minecraft:connection_north")).toEqual({
      kind: "byte",
      value: 0,
    });
    expect(fenceBedrock.block.states.get("minecraft:connection_south")).toEqual({
      kind: "byte",
      value: 1,
    });
    expect(fenceBedrock.block.states.get("minecraft:connection_west")).toEqual({
      kind: "byte",
      value: 0,
    });

    const stairsBedrock = javaToBedrock(stairs);
    expect(stairsBedrock.warnings).toEqual([]);
    expect(stairsBedrock.block.states.get("minecraft:corner")).toEqual({
      kind: "string",
      value: "outer_right",
    });

    const v = new Volume();
    v.set(0, 0, 0, fence);
    v.set(1, 0, 0, pane);
    v.set(2, 0, 0, stairs);
    const { bytes, warnings } = writeMcstructure(v);
    expect(warnings).toEqual([]);

    const root = readNbt(bytes, { endian: "little" }).tag;
    const structure = root.value.get("structure") as CompoundTag;
    const paletteRoot = structure.value.get("palette") as CompoundTag;
    const def = paletteRoot.value.get("default") as CompoundTag;
    const palette = def.value.get("block_palette") as ListTag;

    let seenConnections = 0;
    for (const rawEntry of palette.value) {
      const entry = rawEntry as CompoundTag;
      const states = entry.value.get("states") as CompoundTag;
      for (const [key, tag] of states.value) {
        if (key.startsWith("minecraft:connection_")) {
          expect(tag.type, key).toBe("byte");
          expect(tagId(tag), key).toBe(TagId.Byte);
          seenConnections++;
        }
      }
    }
    expect(seenConnections).toBe(8);

    // Also verify the raw little-endian NBT wire tag byte (0x01 = TAG_Byte) before key length + name.
    const keyBytes = Buffer.from("minecraft:connection_east", "utf8");
    const rawBuf = Buffer.from(bytes);
    const keyOffset = rawBuf.indexOf(keyBytes);
    expect(keyOffset).toBeGreaterThanOrEqual(3);
    expect(rawBuf[keyOffset - 3]).toBe(TagId.Byte);
    expect(rawBuf.readUInt16LE(keyOffset - 2)).toBe(keyBytes.length);

    const back = await readMcstructure(bytes);
    expect(back.warnings).toEqual([]);
    expect(cellsOf(back.volume)).toEqual(cellsOf(v));
  });

  it("translates lightning_rod variants and end_rod across all 6 facings and powered states", async () => {
    const dirs = ["down", "up", "north", "south", "west", "east"] as const;
    const v = new Volume();
    let x = 0;

    for (let i = 0; i < dirs.length; i++) {
      const dir = dirs[i] as string;
      const endRod = `minecraft:end_rod[facing=${dir}]`;
      const endRes = javaToBedrock(endRod);
      expect(endRes.warnings, endRod).toEqual([]);
      expect(endRes.block.states.get("facing_direction")).toEqual({ kind: "int", value: i });
      const endBack = bedrockToJava(
        endRes.block.name,
        new Map([...endRes.block.states].map(([k, val]) => [k, val.value])),
      );
      expect(endBack.warnings, endRod).toEqual([]);
      expect(endBack.state).toBe(canonicalize(endRod));
      v.set(x++, 0, 0, endRod);

      for (const block of ["minecraft:lightning_rod", "minecraft:waxed_exposed_lightning_rod"]) {
        for (const powered of ["false", "true"]) {
          const rod = `${block}[facing=${dir},powered=${powered}]`;
          const res = javaToBedrock(rod);
          expect(res.warnings, rod).toEqual([]);
          expect(res.block.states.get("facing_direction")).toEqual({ kind: "int", value: i });
          expect(res.block.states.get("powered_bit")).toEqual({
            kind: "byte",
            value: powered === "true" ? 1 : 0,
          });
          const back = bedrockToJava(
            res.block.name,
            new Map([...res.block.states].map(([k, val]) => [k, val.value])),
          );
          expect(back.warnings, rod).toEqual([]);
          expect(back.state).toBe(canonicalize(rod));
          v.set(x++, 0, 0, rod);
        }
      }
    }

    // Other copper variants and waterlogging also match and round-trip cleanly.
    const extraRods = [
      "minecraft:exposed_lightning_rod[facing=up,powered=false]",
      "minecraft:waxed_oxidized_lightning_rod[facing=north,powered=true,waterlogged=true]",
    ];
    for (const rod of extraRods) v.set(x++, 0, 0, rod);

    const { bytes, warnings } = writeMcstructure(v);
    expect(warnings).toEqual([]);
    const readBack = await readMcstructure(bytes);
    expect(readBack.warnings).toEqual([]);
    expect(cellsOf(readBack.volume)).toEqual(cellsOf(v));

    // Unhandled properties on lightning_rod still emit warnings.
    expect(javaToBedrock("minecraft:lightning_rod[facing=up,extra=1]").warnings).toEqual([
      "lightning_rod: dropped Java property extra=1",
    ]);
  });

  it("translates campfire and soul_campfire including lit, extinguished, and signal_fire", async () => {
    // Omitted lit defaults to lit=true (extinguished=0); omitted facing defaults to north.
    const bare = javaToBedrock("minecraft:campfire");
    expect(bare.warnings).toEqual([]);
    expect(bare.block.states.get("minecraft:cardinal_direction")).toEqual({
      kind: "string",
      value: "north",
    });
    expect(bare.block.states.get("extinguished")).toEqual({ kind: "byte", value: 0 });

    const unlitDefaultFacing = javaToBedrock("minecraft:campfire[lit=false]");
    expect(unlitDefaultFacing.warnings).toEqual([]);
    expect(unlitDefaultFacing.block.states.get("minecraft:cardinal_direction")).toEqual({
      kind: "string",
      value: "north",
    });
    expect(unlitDefaultFacing.block.states.get("extinguished")).toEqual({
      kind: "byte",
      value: 1,
    });

    // signal_fire=false is dropped cleanly; signal_fire=true warns; invalid facing warns.
    const quietSignal = javaToBedrock("minecraft:campfire[facing=west,lit=true,signal_fire=false]");
    expect(quietSignal.warnings).toEqual([]);
    expect(quietSignal.block.states.get("minecraft:cardinal_direction")).toEqual({
      kind: "string",
      value: "west",
    });
    expect(quietSignal.block.states.get("extinguished")).toEqual({ kind: "byte", value: 0 });

    const loudSignal = javaToBedrock("minecraft:campfire[facing=south,lit=false,signal_fire=true]");
    expect(loudSignal.warnings).toEqual(["campfire: dropped Java property signal_fire=true"]);
    expect(loudSignal.block.states.get("minecraft:cardinal_direction")).toEqual({
      kind: "string",
      value: "south",
    });
    expect(loudSignal.block.states.get("extinguished")).toEqual({ kind: "byte", value: 1 });

    const soulLoud = javaToBedrock(
      "minecraft:soul_campfire[facing=east,lit=true,signal_fire=true]",
    );
    expect(soulLoud.warnings).toEqual(["soul_campfire: dropped Java property signal_fire=true"]);

    const badFacing = javaToBedrock("minecraft:campfire[facing=up,lit=true]");
    expect(badFacing.warnings).toEqual(["campfire: facing=up has no Bedrock cardinal_direction"]);
    expect(badFacing.block.states.has("minecraft:cardinal_direction")).toBe(false);
    expect(badFacing.block.states.get("extinguished")).toEqual({ kind: "byte", value: 0 });

    // Round-trip lit and unlit campfires & soul_campfires through .mcstructure.
    const v = new Volume();
    const cases = [
      ["minecraft:campfire[facing=north,lit=true]", "minecraft:campfire[facing=north,lit=true]"],
      ["minecraft:campfire[facing=east,lit=false]", "minecraft:campfire[facing=east,lit=false]"],
      [
        "minecraft:campfire[facing=south,lit=true,signal_fire=false]",
        "minecraft:campfire[facing=south,lit=true]",
      ],
      [
        "minecraft:campfire[facing=west,lit=false,waterlogged=true]",
        "minecraft:campfire[facing=west,lit=false,waterlogged=true]",
      ],
      [
        "minecraft:soul_campfire[facing=north,lit=true,signal_fire=false]",
        "minecraft:soul_campfire[facing=north,lit=true]",
      ],
      [
        "minecraft:soul_campfire[facing=east,lit=false]",
        "minecraft:soul_campfire[facing=east,lit=false]",
      ],
    ] as const;

    cases.forEach(([input], idx) => {
      v.set(idx, 0, 0, input);
    });
    const { bytes, warnings } = writeMcstructure(v);
    expect(warnings).toEqual([]);
    const readBack = await readMcstructure(bytes);
    expect(readBack.warnings).toEqual([]);
    cases.forEach(([, expected], idx) => {
      expect(readBack.volume.get(idx, 0, 0)).toBe(expected);
    });
  });

  it("translates bell across all 4 attachments, 4 directions, and powered states", async () => {
    const attachments = [
      ["floor", "standing"],
      ["ceiling", "hanging"],
      ["single_wall", "side"],
      ["double_wall", "multiple"],
    ] as const;
    const directions = [
      ["south", 0],
      ["west", 1],
      ["north", 2],
      ["east", 3],
    ] as const;

    // Defaults when omitted: attachment=floor, facing=north, powered=false.
    const bare = javaToBedrock("minecraft:bell");
    expect(bare.warnings).toEqual([]);
    expect(bare.block.states.get("attachment")).toEqual({ kind: "string", value: "standing" });
    expect(bare.block.states.get("direction")).toEqual({ kind: "int", value: 2 });
    expect(bare.block.states.get("toggle_bit")).toEqual({ kind: "byte", value: 0 });
    expect(bare.block.states.has("minecraft:cardinal_direction")).toBe(false);
    expect(bare.block.states.has("powered_bit")).toBe(false);

    const v = new Volume();
    let x = 0;
    for (const [javaAtt, bedrockAtt] of attachments) {
      for (const [facing, dirIdx] of directions) {
        for (const powered of ["false", "true"]) {
          const java = `minecraft:bell[attachment=${javaAtt},facing=${facing},powered=${powered}]`;
          const res = javaToBedrock(java);
          expect(res.warnings, java).toEqual([]);
          expect(res.block.states.get("attachment")).toEqual({
            kind: "string",
            value: bedrockAtt,
          });
          expect(res.block.states.get("direction")).toEqual({ kind: "int", value: dirIdx });
          expect(res.block.states.get("toggle_bit")).toEqual({
            kind: "byte",
            value: powered === "true" ? 1 : 0,
          });
          expect(res.block.states.has("minecraft:cardinal_direction")).toBe(false);
          expect(res.block.states.has("powered_bit")).toBe(false);

          const back = bedrockToJava(
            res.block.name,
            new Map([...res.block.states].map(([k, val]) => [k, val.value])),
          );
          expect(back.warnings, java).toEqual([]);
          expect(back.state).toBe(canonicalize(java));

          v.set(x++, 0, 0, java);
        }
      }
    }

    const { bytes, warnings } = writeMcstructure(v);
    expect(warnings).toEqual([]);
    const readBack = await readMcstructure(bytes);
    expect(readBack.warnings).toEqual([]);
    expect(cellsOf(readBack.volume)).toEqual(cellsOf(v));

    // Warnings for invalid bell attachment / facing, and dropped Bedrock states.
    const badAtt = javaToBedrock("minecraft:bell[attachment=wall,facing=east,powered=false]");
    expect(badAtt.warnings).toEqual(["bell: unknown attachment=wall"]);
    expect(badAtt.block.states.get("attachment")).toEqual({ kind: "string", value: "standing" });
    expect(badAtt.block.states.get("direction")).toEqual({ kind: "int", value: 3 });

    const badDir = javaToBedrock("minecraft:bell[attachment=ceiling,facing=up,powered=true]");
    expect(badDir.warnings).toEqual(["bell: facing=up has no Bedrock direction"]);
    expect(badDir.block.states.get("attachment")).toEqual({ kind: "string", value: "hanging" });
    expect(badDir.block.states.get("direction")).toEqual({ kind: "int", value: 2 });
    expect(badDir.block.states.get("toggle_bit")).toEqual({ kind: "byte", value: 1 });

    const extraBedrock = bedrockToJava(
      "minecraft:bell",
      new Map<string, number | string>([
        ["attachment", "side"],
        ["direction", 1],
        ["toggle_bit", 1],
        ["extra_bit", 1],
      ]),
    );
    expect(extraBedrock.state).toBe(
      "minecraft:bell[attachment=single_wall,facing=west,powered=true]",
    );
    expect(extraBedrock.warnings).toEqual(["bell: dropped Bedrock state extra_bit=1"]);
  });

  it("rejects files that are not structures", async () => {
    await expect(readMcstructure(Uint8Array.from([1, 2, 3]))).rejects.toThrow(CodecError);
    expect(() => writeMcstructure(new Volume())).toThrow(CodecError);
  });
});
