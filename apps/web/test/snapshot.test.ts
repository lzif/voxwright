// SPDX-License-Identifier: AGPL-3.0-only
import {
  type CompoundTag,
  compound,
  double,
  int,
  list,
  nbtEqual,
  string,
  TagId,
  UNSET,
  Volume,
} from "@voxwright/core";
import { describe, expect, it } from "vitest";
import {
  isSnapshot,
  restoreSnapshot,
  SnapshotError,
  type SnapshotMeta,
  takeSnapshot,
} from "../src/lib/snapshot.ts";

const meta: SnapshotMeta = {
  name: "house.litematic",
  dataVersion: 4903,
  loss: ["a loss line"],
  edits: 3,
};

function cells(v: Volume): string[] {
  const out: string[] = [];
  v.eachCell((x, y, z, idx) => out.push(`${x},${y},${z}=${v.palette[idx]}`));
  return out.sort();
}

function sample(): Volume {
  const v = new Volume();
  v.set(0, 0, 0, "minecraft:stone");
  v.set(-17, 33, 5, "minecraft:oak_stairs[facing=north,half=bottom]");
  v.set(40, -2, -40, "minecraft:air"); // carved air is a value, not "unset"
  v.set(1, 0, 0, "minecraft:chest[facing=east]");
  v.set(2, 0, 0, "minecraft:stone");
  v.unset(2, 0, 0); // the palette keeps it; the cell is unset again
  const chest: CompoundTag = compound([
    ["id", string("minecraft:chest")],
    [
      "Items",
      list(TagId.Compound, [
        compound([
          ["Slot", int(0)],
          ["id", string("minecraft:apple")],
        ]),
      ]),
    ],
  ]);
  v.setBlockEntity(1, 0, 0, { edition: "java", nbt: chest });
  v.set(3, 0, 0, "minecraft:bed[facing=north]");
  v.setBlockEntity(3, 0, 0, { edition: "bedrock", nbt: compound([["color", int(5)]]) });
  v.addEntity({
    edition: "java",
    nbt: compound([
      ["id", string("minecraft:armor_stand")],
      ["Pos", list(TagId.Double, [double(1.5), double(0), double(2.5)])],
    ]),
  });
  return v;
}

describe("snapshots", () => {
  it("round-trips cells, air, unset cells, block entities and entities", () => {
    const v = sample();
    const snap = takeSnapshot(v, meta);
    const copy = structuredClone(snap); // what IndexedDB does
    const back = restoreSnapshot(copy);
    expect(cells(back)).toEqual(cells(v));
    expect(back.palette).toEqual(v.palette);
    expect(back.size).toBe(v.size);
    expect(back.indexAt(2, 0, 0)).toBe(UNSET);
    expect(back.get(40, -2, -40)).toBe("minecraft:air");
    expect(back.blockEntityCount).toBe(2);
    const a = back.blockEntityAt(1, 0, 0);
    expect(a?.edition).toBe("java");
    expect(nbtEqual(a?.nbt as CompoundTag, v.blockEntityAt(1, 0, 0)?.nbt as CompoundTag)).toBe(
      true,
    );
    expect(back.blockEntityAt(3, 0, 0)?.edition).toBe("bedrock");
    expect(back.entities).toHaveLength(1);
    expect(nbtEqual(back.entities[0]?.nbt as CompoundTag, v.entities[0]?.nbt as CompoundTag)).toBe(
      true,
    );
  });

  it("is a copy: later edits to the volume do not change it", () => {
    const v = sample();
    const snap = takeSnapshot(v, meta);
    v.set(0, 0, 0, "minecraft:glass");
    expect(restoreSnapshot(snap).get(0, 0, 0)).toBe("minecraft:stone");
  });

  it("records what the restore prompt shows", () => {
    const snap = takeSnapshot(sample(), { ...meta, savedAt: 1234 });
    expect(snap).toMatchObject({
      name: "house.litematic",
      savedAt: 1234,
      edits: 3,
      dataVersion: 4903,
    });
    expect(snap.loss).toEqual(["a loss line"]);
    expect(isSnapshot(snap)).toBe(true);
  });

  it("keeps what the opened file carried, and is still valid without it", () => {
    const carry = { schemOffset: [1, 2, 3] as [number, number, number] };
    const snap = takeSnapshot(sample(), { ...meta, carry });
    expect(snap.carry).toEqual(carry);
    expect(snap.carry).not.toBe(carry);
    const none = takeSnapshot(sample(), meta);
    expect(none.carry).toBeUndefined();
    expect(isSnapshot(none)).toBe(true);
  });

  it("uses wide sections once the palette no longer fits 16 bits", () => {
    const v = new Volume();
    for (let i = 0; i < 70_000; i++) v.intern(`minecraft:b${i}`);
    v.setIndex(1, 2, 3, 69_999);
    v.setIndex(0, 0, 0, 0);
    const snap = takeSnapshot(v, meta);
    expect(snap.sections[0]?.cells).toBeInstanceOf(Int32Array);
    const back = restoreSnapshot(structuredClone(snap));
    expect(back.get(1, 2, 3)).toBe("minecraft:b69999");
    expect(back.size).toBe(2);
  });

  it("handles an empty volume", () => {
    const back = restoreSnapshot(takeSnapshot(new Volume(), meta));
    expect(back.size).toBe(0);
  });

  it("rejects data that is not a snapshot or is inconsistent", () => {
    expect(isSnapshot(null)).toBe(false);
    expect(isSnapshot({ format: 2 })).toBe(false);
    const snap = takeSnapshot(sample(), meta);
    const bad = structuredClone(snap);
    bad.palette = ["minecraft:stone"];
    expect(() => restoreSnapshot(bad)).toThrow(SnapshotError);
    const short = structuredClone(snap);
    (short.sections[0] as { cells: Uint16Array }).cells = new Uint16Array(10);
    expect(() => restoreSnapshot(short)).toThrow(/damaged/);
  });
});
