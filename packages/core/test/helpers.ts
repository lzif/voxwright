// SPDX-License-Identifier: AGPL-3.0-only
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  type BlockEntity,
  byte,
  type CompoundTag,
  compound,
  double,
  float,
  int,
  intArray,
  list,
  long,
  longArray,
  type NbtTag,
  string,
  TagId,
  Volume,
  type VolumeEntity,
} from "../src/index.ts";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

export function loadVector<T>(name: string): T {
  return JSON.parse(readFileSync(`${repoRoot}vectors/${name}`, "utf8")) as T;
}

export function loadFixture(path: string): Uint8Array {
  return new Uint8Array(readFileSync(`${repoRoot}fixtures/${path}`));
}

/** Plain-JSON view of a tag, the same shape the vector exporter writes. */
export function tagToJson(tag: NbtTag): unknown {
  switch (tag.type) {
    case "compound":
      return Object.fromEntries([...tag.value].map(([k, v]) => [k, tagToJson(v)]));
    case "list":
      return tag.value.map(tagToJson);
    case "long":
      return Number(tag.value);
    case "byteArray":
    case "intArray":
    case "longArray":
      return Array.from(tag.value as ArrayLike<number | bigint>).map(Number);
    default:
      return tag.value;
  }
}

export function fromBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

const javaBlockEntity = (...entries: [string, NbtTag][]): BlockEntity => ({
  edition: "java",
  nbt: compound(entries),
});

/** A chest holding two stacks, with one of every tag type somewhere in the data. */
export const chestEntity = (extra = 0): BlockEntity =>
  javaBlockEntity(
    ["id", string("minecraft:chest")],
    [
      "Items",
      list(TagId.Compound, [
        compound([
          ["Slot", byte(0)],
          ["id", string("minecraft:diamond")],
          ["count", int(64 + extra)],
        ]),
        compound([
          ["Slot", byte(13)],
          ["id", string("minecraft:enchanted_book")],
          ["count", int(1)],
          [
            "components",
            compound([
              ["minecraft:custom_name", string('"Fünf \u00e9"')],
              ["minecraft:damage", int(7)],
            ]),
          ],
        ]),
      ]),
    ],
    ["lock", string("")],
    ["big", long(9007199254740993n)],
    ["ratio", float(Math.fround(0.1))],
    ["precise", double(0.1)],
    ["flags", byte(1)],
    ["ints", intArray(Int32Array.of(1, -2, 3))],
    ["longs", longArray(BigInt64Array.of(1n, -2n))],
    ["empty", list(TagId.End, [])],
  );

export const signEntity = (): BlockEntity =>
  javaBlockEntity(
    ["id", string("minecraft:sign")],
    [
      "front_text",
      compound([
        [
          "messages",
          list(TagId.String, [
            string('{"text":"Hello"}'),
            string('""'),
            string('""'),
            string('{"text":"Bye"}'),
          ]),
        ],
        ["color", string("black")],
        ["has_glowing_text", byte(0)],
      ]),
    ],
    ["is_waxed", byte(0)],
  );

export const bannerEntity = (): BlockEntity =>
  javaBlockEntity(
    ["id", string("minecraft:banner")],
    [
      "patterns",
      list(TagId.Compound, [
        compound([
          ["color", string("red")],
          ["pattern", string("minecraft:stripe_top")],
        ]),
      ]),
    ],
  );

export const armorStand = (x: number, y: number, z: number): VolumeEntity => ({
  edition: "java",
  nbt: compound([
    ["id", string("minecraft:armor_stand")],
    ["Pos", list(TagId.Double, [double(x), double(y), double(z)])],
    ["UUID", intArray(Int32Array.of(1, 2, 3, 4))],
    ["Rotation", list(TagId.Float, [float(90), float(0)])],
    ["Invisible", byte(1)],
  ]),
});

export const cow = (x: number, y: number, z: number): VolumeEntity => ({
  edition: "java",
  nbt: compound([
    ["id", string("minecraft:cow")],
    ["Pos", list(TagId.Double, [double(x), double(y), double(z)])],
    ["Health", float(10)],
    ["CustomName", string('"Bessie"')],
  ]),
});

export const CHEST = "minecraft:chest[facing=north,type=single,waterlogged=false]";
export const SIGN = "minecraft:oak_sign[rotation=4,waterlogged=false]";
export const BANNER = "minecraft:red_banner[rotation=2]";

/**
 * A small build with a chest holding items, a sign with text, a banner, and
 * two entities. `at` moves the whole thing, so a file's origin handling is tested.
 */
export function buildingWithExtras(at: readonly [number, number, number] = [0, 0, 0]): Volume {
  const [ox, oy, oz] = at;
  const v = new Volume();
  for (let x = 0; x < 5; x++)
    for (let z = 0; z < 4; z++) v.set(ox + x, oy, oz + z, "minecraft:stone");
  const cells: [number, number, number, string, BlockEntity][] = [
    [1, 1, 1, CHEST, chestEntity()],
    [3, 1, 2, SIGN, signEntity()],
    [4, 1, 0, BANNER, bannerEntity()],
  ];
  for (const [x, y, z, block, be] of cells) {
    v.set(ox + x, oy + y, oz + z, block);
    v.setBlockEntity(ox + x, oy + y, oz + z, be);
  }
  v.set(ox + 2, oy + 1, oz + 2, "minecraft:oak_stairs[facing=east,half=bottom,shape=straight]");
  v.addEntity(armorStand(ox + 2.5, oy + 1, oz + 0.25));
  v.addEntity(cow(ox + 0.125, oy + 1, oz + 3.5));
  return v;
}

/** The block entities of a volume as `"x,y,z" -> compound`, positions relative to `(ox, oy, oz)`. */
export function blockEntitiesOf(
  v: Volume,
  at: readonly [number, number, number] = [0, 0, 0],
): Map<string, CompoundTag> {
  const out = new Map<string, CompoundTag>();
  v.eachBlockEntity((x, y, z, e) => out.set(`${x - at[0]},${y - at[1]},${z - at[2]}`, e.nbt));
  return out;
}
