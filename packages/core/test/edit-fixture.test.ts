// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  cloneVolume,
  Editor,
  placeBlock,
  readLitematic,
  rotateSelection,
  setBlockProperty,
  type Volume,
  writeLitematic,
} from "../src/index.ts";
import { loadFixture } from "./helpers.ts";

// A real file saved by bloxelizer.com: edit one block, export through the
// .litematic codec, read it back, and check that only that block changed.

function cells(v: Volume): Map<string, string> {
  const out = new Map<string, string>();
  v.eachCell((x, y, z, i) => out.set(`${x},${y},${z}`, v.palette[i] as string));
  return out;
}

const file = () => loadFixture("real/rafeals-house/Rafeals_house.litematic");

async function exportAndRead(v: Volume, dataVersion: number): Promise<Volume> {
  const { bytes } = await writeLitematic(v, { dataVersion });
  return (await readLitematic(bytes, { keepAir: true })).volume;
}

describe("editing a real .litematic", () => {
  it("changes exactly one block through an export and re-read", async () => {
    const { volume: source, meta } = await readLitematic(file(), { keepAir: true });
    const original = cells(source);
    const dataVersion = meta.dataVersion ?? 0;
    expect(original.size).toBeGreaterThan(700);

    // Any block away from the edge of the region, so the bounds stay put.
    const [pos, old] = [...original].find(([k, b]) => {
      const [x, y, z] = k.split(",").map(Number) as [number, number, number];
      return b !== "minecraft:air" && x > 0 && y > 0 && z > 0 && x < 31 && y < 15 && z < 31;
    }) as [string, string];
    const at = pos.split(",").map(Number) as [number, number, number];

    const editor = new Editor(cloneVolume(source));
    expect(editor.run(placeBlock(editor.volume, at, "minecraft:gold_block"))).toBe(true);
    // The loaded volume is not the one that was edited.
    expect(cells(source)).toEqual(original);

    const back = await exportAndRead(editor.volume, dataVersion);
    const after = cells(back);
    expect(after.size).toBe(original.size);
    const changed = [...after].filter(([k, b]) => original.get(k) !== b).map(([k]) => k);
    expect(changed).toEqual([pos]);
    expect(after.get(pos)).toBe("minecraft:gold_block");
    expect(old).not.toBe("minecraft:gold_block");

    // Undo and the next export matches the original file's contents again.
    editor.undo();
    expect(cells(await exportAndRead(editor.volume, dataVersion))).toEqual(original);
  });

  it("changes exactly one block when only a property is edited", async () => {
    const { volume: source, meta } = await readLitematic(file(), { keepAir: true });
    const original = cells(source);
    const [pos, old] = [...original].find(([, b]) => b.includes("facing=north")) as [
      string,
      string,
    ];
    const at = pos.split(",").map(Number) as [number, number, number];
    const editor = new Editor(cloneVolume(source));
    editor.run(setBlockProperty(editor.volume, at, "facing", "south"));
    const after = cells(await exportAndRead(editor.volume, meta.dataVersion ?? 0));
    const changed = [...after].filter(([k, b]) => original.get(k) !== b);
    expect(changed).toEqual([[pos, old.replace("facing=north", "facing=south")]]);
  });

  it("survives a rotate-and-back round trip of the whole build", async () => {
    const { volume: source, meta } = await readLitematic(file(), { keepAir: true });
    const original = cells(source);
    const bounds = source.placedBounds() as NonNullable<ReturnType<Volume["placedBounds"]>>;
    const box = { min: bounds[0], max: bounds[1] };
    const editor = new Editor(cloneVolume(source));
    editor.run(rotateSelection(editor.volume, box, "CLOCKWISE_90"));
    expect(cells(editor.volume)).not.toEqual(original);
    editor.undo();
    expect(cells(await exportAndRead(editor.volume, meta.dataVersion ?? 0))).toEqual(original);
    expect(editor.history.redoCount).toBe(1);
  });
});
