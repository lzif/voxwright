// SPDX-License-Identifier: AGPL-3.0-only
import { readLitematic, readSchem, Volume, writeLitematic, writeSchem } from "@voxwright/core";
import { describe, expect, it } from "vitest";
import { LEGACY_SCHEMATIC_MESSAGE, openFile, saveAs } from "../src/lib/formats.ts";

function build(): Volume {
  const v = new Volume();
  v.set(0, 0, 0, "minecraft:stone");
  v.set(2, 1, 1, "minecraft:oak_planks");
  return v;
}

describe("openFile", () => {
  it("names the legacy .schematic format and says what to do", async () => {
    for (const name of ["old.schematic", "OLD.SCHEMATIC"]) {
      const err = await openFile(new Uint8Array([1, 2, 3]), name).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe(LEGACY_SCHEMATIC_MESSAGE);
    }
    expect(LEGACY_SCHEMATIC_MESSAGE).toMatch(/legacy/);
    expect(LEGACY_SCHEMATIC_MESSAGE).toMatch(/not supported/);
    expect(LEGACY_SCHEMATIC_MESSAGE).toMatch(/\.schem\b/);
    expect(LEGACY_SCHEMATIC_MESSAGE).toMatch(/WorldEdit/);
  });

  it("still gives the generic message for other unknown types", async () => {
    await expect(openFile(new Uint8Array(4), "a.txt")).rejects.toThrow(
      /unsupported file type '.txt'/,
    );
  });
});

describe("what a format carries to itself", () => {
  it("keeps a litematic's name, author and description on .litematic to .litematic", async () => {
    const src = await writeLitematic(build(), {
      dataVersion: 4903,
      name: "Tower",
      author: "Ada",
      description: "A tall one",
    });
    const opened = await openFile(src.bytes, "tower.litematic");
    const out = await saveAs(opened.volume, "litematic", opened.dataVersion, opened.carry);
    const back = await readLitematic(out.bytes);
    expect(back.meta.name).toBe("Tower");
    expect(back.meta.author).toBe("Ada");
    expect(back.meta.description).toBe("A tall one");
  });

  it("does not invent litematic metadata for other sources", async () => {
    const src = await writeSchem(build(), { dataVersion: 4903, version: 3 });
    const opened = await openFile(src.bytes, "a.schem");
    const out = await saveAs(opened.volume, "litematic", opened.dataVersion, opened.carry);
    const back = await readLitematic(out.bytes);
    const plain = await writeLitematic(build(), { dataVersion: 4903 });
    expect(back.meta.name).toBe((await readLitematic(plain.bytes)).meta.name);
    expect(back.meta.author).toBe((await readLitematic(plain.bytes)).meta.author);
  });

  it("keeps a .schem's Offset on .schem to .schem, in both versions", async () => {
    for (const version of [2, 3] as const) {
      const src = await writeSchem(build(), { dataVersion: 4903, version, offset: [3, -4, 5] });
      const opened = await openFile(src.bytes, "a.schem");
      expect(opened.carry?.schemOffset).toEqual([3, -4, 5]);
      for (const target of ["schem", "schem2"] as const) {
        const out = await saveAs(opened.volume, target, opened.dataVersion, opened.carry);
        expect((await readSchem(out.bytes)).meta.offset).toEqual([3, -4, 5]);
      }
    }
  });

  it("gives a .schem the plain offset when the source was another format", async () => {
    const src = await writeLitematic(build(), { dataVersion: 4903, name: "Tower" });
    const opened = await openFile(src.bytes, "a.litematic");
    expect(opened.carry?.schemOffset).toBeUndefined();
    const out = await saveAs(opened.volume, "schem", opened.dataVersion, opened.carry);
    expect((await readSchem(out.bytes)).meta.offset).toEqual([0, 0, 0]);
  });

  it("writes without carried data when none is given", async () => {
    const out = await saveAs(build(), "schem", null);
    expect((await readSchem(out.bytes)).meta.offset).toEqual([0, 0, 0]);
  });
});
