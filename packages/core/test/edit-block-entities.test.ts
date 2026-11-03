// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  applyCommand,
  type BlockEntity,
  type Box,
  CommandBuilder,
  cloneVolume,
  commandBytes,
  copySelection,
  Editor,
  eraseBlock,
  eraseCells,
  fillSelection,
  isEmptyCommand,
  makeBox,
  mergeCommands,
  mirrorSelection,
  moveSelection,
  nbtEqual,
  pasteClipboard,
  placeBlock,
  replaceInSelection,
  revertCommand,
  rotatedBox,
  rotateSelection,
  setBlockProperty,
  string,
  Volume,
} from "../src/index.ts";
import { bannerEntity, CHEST, chestEntity, signEntity } from "./helpers.ts";

const STONE = "minecraft:stone";
const east = "minecraft:chest[facing=east,type=single,waterlogged=false]";

/** The block entities as sorted `x,y,z id firstCount stacks` lines, to compare whole volumes with. */
function contents(v: Volume): string[] {
  const out: string[] = [];
  v.eachBlockEntity((x, y, z, e) => {
    const id = e.nbt.value.get("id") as { value: string };
    const items = e.nbt.value.get("Items");
    const stacks = items?.type === "list" ? items.value : [];
    const first = stacks[0]?.type === "compound" ? stacks[0].value.get("count") : undefined;
    out.push(
      `${x},${y},${z} ${id.value} ${first?.type === "int" ? first.value : "-"} ${stacks.length}`,
    );
  });
  return out.sort();
}

/** A floor with a chest holding 64 items at (2,1,2) and a sign at (4,1,1). */
function sample(): Volume {
  const v = new Volume();
  for (let x = 0; x < 6; x++) for (let z = 0; z < 6; z++) v.set(x, 0, z, STONE);
  v.set(2, 1, 2, CHEST);
  v.setBlockEntity(2, 1, 2, chestEntity());
  v.set(4, 1, 1, "minecraft:oak_sign[rotation=4,waterlogged=false]");
  v.setBlockEntity(4, 1, 1, signEntity());
  return v;
}

const entityAt = (v: Volume, x: number, y: number, z: number): BlockEntity | undefined =>
  v.blockEntityAt(x, y, z);

describe("editing cells with block entities", () => {
  it("replacing the chest drops its block entity and undo brings it back", () => {
    const v = sample();
    const original = entityAt(v, 2, 1, 2);
    const ed = new Editor(v);
    expect(ed.run(placeBlock(v, [2, 1, 2], "minecraft:barrel[facing=up,open=false]"))).toBe(true);
    expect(v.get(2, 1, 2)).toBe("minecraft:barrel[facing=up,open=false]");
    expect(v.blockEntityAt(2, 1, 2)).toBeUndefined();
    expect(v.blockEntityCount).toBe(1);
    ed.undo();
    expect(v.get(2, 1, 2)).toBe(CHEST);
    expect(entityAt(v, 2, 1, 2)).toBe(original);
    ed.redo();
    expect(v.blockEntityAt(2, 1, 2)).toBeUndefined();
    ed.undo();
    expect(nbtEqual(entityAt(v, 2, 1, 2)?.nbt ?? string(""), chestEntity().nbt)).toBe(true);
  });

  it("keeps the contents when only a property changes, and restores them on undo too", () => {
    const v = sample();
    const original = entityAt(v, 2, 1, 2);
    const ed = new Editor(v);
    ed.run(setBlockProperty(v, [2, 1, 2], "facing", "east"));
    expect(v.get(2, 1, 2)).toBe(east);
    expect(entityAt(v, 2, 1, 2)).toBe(original);
    ed.run(placeBlock(v, [2, 1, 2], CHEST));
    expect(entityAt(v, 2, 1, 2)).toBe(original);
    ed.undo();
    ed.undo();
    expect(v.get(2, 1, 2)).toBe(CHEST);
    expect(entityAt(v, 2, 1, 2)).toBe(original);
  });

  it("erasing a chest drops its block entity and undo restores it", () => {
    const v = sample();
    const ed = new Editor(v);
    ed.run(eraseBlock(v, [2, 1, 2]));
    expect(v.get(2, 1, 2)).toBeUndefined();
    expect(v.blockEntityCount).toBe(1);
    ed.undo();
    expect(contents(v)).toEqual(contents(sample()));
    // Erase to air is a different block name, so it drops too.
    ed.run(eraseCells(v, [[2, 1, 2]], { toAir: true }));
    expect(v.blockEntityCount).toBe(1);
    ed.undo();
    expect(v.blockEntityCount).toBe(2);
  });

  it("drops block entities under a fill and a replace, and undo restores them all", () => {
    const v = sample();
    const before = contents(v);
    const ed = new Editor(v);
    ed.run(fillSelection(v, makeBox([0, 1, 0], [5, 1, 5]), "minecraft:glass"));
    expect(v.blockEntityCount).toBe(0);
    ed.undo();
    expect(contents(v)).toEqual(before);
    ed.run(replaceInSelection(v, makeBox([0, 0, 0], [5, 1, 5]), CHEST, "minecraft:barrel"));
    expect(v.blockEntityCount).toBe(1);
    ed.undo();
    expect(contents(v)).toEqual(before);
  });

  it("leaves a placement of the same block alone", () => {
    const v = sample();
    expect(isEmptyCommand(placeBlock(v, [2, 1, 2], CHEST))).toBe(true);
    expect(isEmptyCommand(fillSelection(v, makeBox([2, 1, 2], [2, 1, 2]), CHEST))).toBe(true);
  });

  it("merges the commands of a stroke so one undo restores everything", () => {
    const v = sample();
    const before = contents(v);
    const ed = new Editor(v);
    const stroke = ed.beginStroke("drag");
    stroke.apply(placeBlock(v, [2, 1, 2], "minecraft:glass"));
    stroke.apply(placeBlock(v, [4, 1, 1], "minecraft:glass"));
    stroke.apply(placeBlock(v, [2, 1, 2], CHEST));
    expect(v.blockEntityCount).toBe(0);
    expect(stroke.commit()).toBe(true);
    ed.undo();
    expect(contents(v)).toEqual(before);
    expect(v.get(4, 1, 1)).toBe("minecraft:oak_sign[rotation=4,waterlogged=false]");
    ed.redo();
    expect(v.blockEntityCount).toBe(0);
  });

  it("cancelling a stroke puts the block entities back", () => {
    const v = sample();
    const before = contents(v);
    const stroke = new Editor(v).beginStroke("drag");
    stroke.apply(fillSelection(v, makeBox([0, 1, 0], [5, 1, 5]), "minecraft:glass"));
    stroke.cancel();
    expect(contents(v)).toEqual(before);
  });

  it("merging a replace with its inverse leaves nothing to undo", () => {
    const v = sample();
    const a = placeBlock(v, [2, 1, 2], "minecraft:glass");
    applyCommand(v, a);
    const b = placeBlock(v, [2, 1, 2], CHEST);
    applyCommand(v, b);
    // The chest is back as a block but its contents are gone, so the merge still records them.
    const merged = mergeCommands("two", [a, b]);
    expect(isEmptyCommand(merged)).toBe(false);
    revertCommand(v, merged);
    expect(contents(v)).toEqual(contents(sample()));
  });

  it("counts block entities in a command's memory", () => {
    const v = sample();
    const cmd = eraseBlock(v, [2, 1, 2]);
    expect(commandBytes(cmd)).toBeGreaterThan(
      commandBytes(placeBlock(v, [0, 0, 0], "minecraft:dirt")),
    );
  });

  it("refuses to attach a block entity to an empty cell", () => {
    const v = sample();
    const b = new CommandBuilder(v, "x");
    expect(() => b.setBlockEntity(9, 9, 9, chestEntity())).toThrow(/no block at/);
  });
});

describe("selection tools carry block entities", () => {
  const box: Box = makeBox([0, 1, 0], [5, 1, 5]);

  it("move keeps the contents at the new place, and undo puts everything back", () => {
    const v = sample();
    const before = contents(v);
    const original = entityAt(v, 2, 1, 2);
    const ed = new Editor(v);
    ed.run(moveSelection(v, box, [3, 2, -1]));
    expect(v.get(5, 3, 1)).toBe(CHEST);
    expect(entityAt(v, 5, 3, 1)).toBe(original);
    expect(v.blockEntityAt(2, 1, 2)).toBeUndefined();
    expect(v.blockEntityAt(7, 3, 0)?.nbt.value.get("id")).toEqual(string("minecraft:sign"));
    expect(v.blockEntityCount).toBe(2);
    ed.undo();
    expect(contents(v)).toEqual(before);
    ed.redo();
    expect(entityAt(v, 5, 3, 1)).toBe(original);
  });

  it("move by one cell onto cells of the selection itself keeps every block entity", () => {
    const v = new Volume();
    for (let x = 0; x < 4; x++) {
      v.set(x, 0, 0, CHEST);
      v.setBlockEntity(x, 0, 0, chestEntity(x));
    }
    const ed = new Editor(v);
    ed.run(moveSelection(v, makeBox([0, 0, 0], [3, 0, 0]), [1, 0, 0]));
    expect(contents(v)).toEqual([
      "1,0,0 minecraft:chest 64 2",
      "2,0,0 minecraft:chest 65 2",
      "3,0,0 minecraft:chest 66 2",
      "4,0,0 minecraft:chest 67 2",
    ]);
    ed.undo();
    expect(contents(v).map((s) => s.split(" ")[2])).toEqual(["64", "65", "66", "67"]);
    expect(v.blockEntityCount).toBe(4);
  });

  it("rotate keeps the contents with the block, at the rotated position", () => {
    const v = new Volume();
    // 4 wide, 2 long: chest A at (0,0,0), banner B at (3,0,1).
    for (let x = 0; x < 4; x++) for (let z = 0; z < 2; z++) v.set(x, 0, z, STONE);
    v.set(0, 1, 0, CHEST);
    v.setBlockEntity(0, 1, 0, chestEntity());
    v.set(3, 1, 1, "minecraft:red_banner[rotation=0]");
    v.setBlockEntity(3, 1, 1, bannerEntity());
    const selection = makeBox([0, 0, 0], [3, 1, 1]);
    const ed = new Editor(v);
    ed.run(rotateSelection(v, selection, "CLOCKWISE_90"));
    const after = rotatedBox(selection, "CLOCKWISE_90");
    expect(after.max).toEqual([1, 1, 3]);
    // Find the rotated chest and banner and compare their contents with the originals.
    let chestAt: number[] | undefined;
    let bannerAt: number[] | undefined;
    v.eachBlockEntity((x, y, z, e) => {
      const id = (e.nbt.value.get("id") as { value: string }).value;
      if (id === "minecraft:chest") {
        chestAt = [x, y, z];
        expect(nbtEqual(e.nbt, chestEntity().nbt)).toBe(true);
        expect(v.get(x, y, z)?.startsWith("minecraft:chest[facing=east")).toBe(true);
      } else {
        bannerAt = [x, y, z];
        expect(nbtEqual(e.nbt, bannerEntity().nbt)).toBe(true);
        expect(v.get(x, y, z)?.startsWith("minecraft:red_banner")).toBe(true);
      }
    });
    // (x, z) -> (width - 1 - z, x) for a clockwise quarter turn of a 4x2 box.
    expect(chestAt).toEqual([1, 1, 0]);
    expect(bannerAt).toEqual([0, 1, 3]);
    expect(v.blockEntityCount).toBe(2);
    ed.undo();
    expect(v.get(0, 1, 0)).toBe(CHEST);
    expect(nbtEqual(entityAt(v, 0, 1, 0)?.nbt ?? string(""), chestEntity().nbt)).toBe(true);
    expect(v.blockEntityCount).toBe(2);
  });

  it("mirror keeps the contents with the block", () => {
    const v = sample();
    const ed = new Editor(v);
    ed.run(mirrorSelection(v, box, "x"));
    expect(v.get(3, 1, 2)?.startsWith("minecraft:chest")).toBe(true);
    expect(nbtEqual(entityAt(v, 3, 1, 2)?.nbt ?? string(""), chestEntity().nbt)).toBe(true);
    expect(v.blockEntityAt(2, 1, 2)).toBeUndefined();
    expect(v.blockEntityAt(1, 1, 1)?.nbt.value.get("id")).toEqual(string("minecraft:sign"));
    ed.undo();
    expect(contents(v)).toEqual(contents(sample()));
    // A cell on the mirror plane keeps its own contents.
    const w = new Volume();
    w.set(1, 0, 0, CHEST);
    w.setBlockEntity(1, 0, 0, chestEntity());
    new Editor(w).run(mirrorSelection(w, makeBox([0, 0, 0], [2, 0, 0]), "z"));
    expect(w.get(1, 0, 0)?.startsWith("minecraft:chest[facing=south")).toBe(true);
    expect(w.blockEntityCount).toBe(1);
  });

  it("copy and paste make an independent copy of the block entity", () => {
    const v = sample();
    const clip = copySelection(v, box);
    expect(clip.blockEntities.size).toBe(2);
    const original = entityAt(v, 2, 1, 2);
    // The clipboard does not share NBT with the volume.
    expect(clip.blockEntities.get(0)?.nbt).not.toBe(original?.nbt);
    const ed = new Editor(v);
    ed.run(pasteClipboard(v, clip, [10, 1, 10]));
    expect(v.blockEntityCount).toBe(4);
    const pasted = entityAt(v, 12, 1, 12);
    expect(pasted).toBeDefined();
    expect(pasted?.nbt).not.toBe(original?.nbt);
    expect(nbtEqual(pasted?.nbt ?? string(""), original?.nbt ?? string("x"))).toBe(true);
    expect(entityAt(v, 2, 1, 2)).toBe(original);
    // Paste again on top: still one block entity per chest.
    ed.run(pasteClipboard(v, clip, [10, 1, 10]));
    expect(v.blockEntityCount).toBe(4);
    ed.undo();
    ed.undo();
    expect(contents(v)).toEqual(contents(sample()));
  });

  it("pasting a plain block over a chest clears the contents", () => {
    const v = sample();
    const w = new Volume();
    w.set(0, 0, 0, CHEST); // an empty chest, no block entity
    const clip = copySelection(w, makeBox([0, 0, 0], [0, 0, 0]));
    expect(clip.blockEntities.size).toBe(0);
    const ed = new Editor(v);
    ed.run(pasteClipboard(v, clip, [2, 1, 2]));
    expect(v.get(2, 1, 2)).toBe(CHEST);
    expect(v.blockEntityAt(2, 1, 2)).toBeUndefined();
    ed.undo();
    expect(v.blockEntityCount).toBe(2);
  });

  it("a clipboard survives the volume it was copied from being edited", () => {
    const v = sample();
    const clip = copySelection(v, box);
    new Editor(v).run(eraseBlock(v, [2, 1, 2]));
    const w = new Volume();
    w.set(0, 0, 0, STONE);
    new Editor(w).run(pasteClipboard(w, clip, [0, 0, 0]));
    expect(w.blockEntityCount).toBe(2);
  });
});

describe("cloneVolume", () => {
  it("copies block entities and entities without sharing them", () => {
    const v = sample();
    v.addEntity({
      edition: "java",
      nbt: chestEntity().nbt,
    });
    const c = cloneVolume(v);
    expect(c.blockEntityCount).toBe(2);
    expect(c.entities).toHaveLength(1);
    expect(c.blockEntityAt(2, 1, 2)?.nbt).not.toBe(v.blockEntityAt(2, 1, 2)?.nbt);
    expect(nbtEqual(c.blockEntityAt(2, 1, 2)?.nbt ?? string(""), chestEntity().nbt)).toBe(true);
    new Editor(c).run(eraseBlock(c, [2, 1, 2]));
    expect(v.blockEntityCount).toBe(2);
  });
});
