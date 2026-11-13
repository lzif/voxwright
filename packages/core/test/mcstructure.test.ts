// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  AIR,
  bedrockToJava,
  CodecError,
  canonicalize,
  javaToBedrock,
  parseBlockString,
  readLitematic,
  readMcstructure,
  readStructureNbt,
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

  it("rejects files that are not structures", async () => {
    await expect(readMcstructure(Uint8Array.from([1, 2, 3]))).rejects.toThrow(CodecError);
    expect(() => writeMcstructure(new Volume())).toThrow(CodecError);
  });
});
