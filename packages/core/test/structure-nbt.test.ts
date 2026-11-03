// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  AIR,
  type AirMode,
  buildStructureNbt,
  CodecError,
  canonicalize,
  compound,
  int,
  readNbtFile,
  readStructureNbt,
  Volume,
  writeNbt,
  writeStructureNbt,
} from "../src/index.ts";
import { fromBase64, loadVector, tagToJson } from "./helpers.ts";

interface Case {
  name: string;
  placements: [number, number, number, string][];
  air: AirMode;
  dataVersion: number;
  error?: string;
  warnings?: string[];
  parsed?: unknown;
  gzipBase64?: string;
}

const { cases } = loadVector<{ cases: Case[] }>("structure-nbt.json");

function volumeOf(placements: Case["placements"]): Volume {
  const v = new Volume();
  // The oracle canonicalizes every block before placing it.
  for (const [x, y, z, b] of placements) v.set(x, y, z, canonicalize(b));
  return v;
}

interface Parsed {
  palette: { Name: string; Properties?: Record<string, string> }[];
  blocks: { pos: [number, number, number]; state: number }[];
}

/** What reading the oracle's file should give: non-air blocks (all with keepAir), at the origin. */
function expectedCells(parsed: Parsed, keepAir: boolean): string[] {
  const cells = parsed.blocks
    .map((b) => {
      const e = parsed.palette[b.state] as Parsed["palette"][number];
      const props = new Map(Object.entries(e.Properties ?? {}));
      return { pos: b.pos, state: canonicalize(joinForTest(e.Name, props)) };
    })
    .filter((c) => keepAir || c.state !== AIR);
  if (cells.length === 0) return [];
  const min = [0, 1, 2].map((i) => Math.min(...cells.map((c) => c.pos[i] as number)));
  return cells
    .map(
      (c) =>
        `${c.pos[0] - (min[0] as number)},${c.pos[1] - (min[1] as number)},${c.pos[2] - (min[2] as number)} ${c.state}`,
    )
    .sort();
}

function joinForTest(name: string, props: Map<string, string>): string {
  if (props.size === 0) return name;
  return `${name}[${[...props].map(([k, v]) => `${k}=${v}`).join(",")}]`;
}

function cellsOf(v: Volume): string[] {
  const out: string[] = [];
  v.eachCell((x, y, z, idx) => {
    out.push(`${x},${y},${z} ${v.palette[idx]}`);
  });
  return out.sort();
}

describe("structure .nbt against the Python oracle", () => {
  it("has vectors", () => {
    expect(cases.length).toBeGreaterThanOrEqual(24);
  });

  for (const c of cases) {
    it(`writes ${c.name} as the same parsed structure`, () => {
      const v = volumeOf(c.placements);
      const { root, warnings } = buildStructureNbt(v, { dataVersion: c.dataVersion, air: c.air });
      expect(tagToJson(root)).toEqual(c.parsed);
      expect(warnings).toEqual(c.warnings);
    });

    it(`writes ${c.name} to bytes that read back identically`, async () => {
      const v = volumeOf(c.placements);
      const { bytes } = await writeStructureNbt(v, { dataVersion: c.dataVersion, air: c.air });
      const reread = await readNbtFile(bytes);
      expect(tagToJson(reread.tag)).toEqual(c.parsed);
      expect(reread.name).toBe("");
    });

    it(`reads the file the oracle wrote for ${c.name}`, async () => {
      const file = fromBase64(c.gzipBase64 as string);
      for (const keepAir of [false, true]) {
        const { volume, meta } = await readStructureNbt(file, { keepAir });
        expect(meta.dataVersion).toBe(c.dataVersion);
        expect(cellsOf(volume)).toEqual(expectedCells(c.parsed as Parsed, keepAir));
      }
    });
  }

  it("raises the oracle's error on an empty volume", () => {
    expect(() => buildStructureNbt(new Volume(), { dataVersion: 1 })).toThrow(CodecError);
  });
});

describe("structure .nbt round trips", () => {
  it("returns the same blocks, shifted to the origin", async () => {
    const v = new Volume();
    v.set(-3, 10, 4, "minecraft:stone");
    v.set(-2, 10, 4, "minecraft:oak_stairs[facing=north,half=bottom]");
    v.set(0, 12, 7, "minecraft:glass");
    const { bytes } = await writeStructureNbt(v, { dataVersion: 4903 });
    const { volume, meta } = await readStructureNbt(bytes);
    expect(meta).toEqual({ dataVersion: 4903, droppedBlockEntities: 0, droppedEntities: 0 });
    expect(volume.get(0, 0, 0)).toBe("minecraft:stone");
    expect(volume.get(1, 0, 0)).toBe("minecraft:oak_stairs[facing=north,half=bottom]");
    expect(volume.get(3, 2, 3)).toBe("minecraft:glass");
    expect(volume.size).toBe(3);
  });

  for (const air of ["explicit", "all"] as const) {
    it(`keeps carved air when asked (air=${air})`, async () => {
      const v = new Volume();
      v.set(0, 0, 0, "minecraft:stone");
      v.set(1, 0, 0, AIR);
      v.set(2, 0, 0, "minecraft:stone");
      const { bytes } = await writeStructureNbt(v, { dataVersion: 1, air });
      const kept = await readStructureNbt(bytes, { keepAir: true });
      expect(kept.volume.get(1, 0, 0)).toBe(AIR);
      const dropped = await readStructureNbt(bytes);
      expect(dropped.volume.get(1, 0, 0)).toBeUndefined();
    });
  }

  it("drops block-entity NBT with a warning", async () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:chest[facing=north]{Items:[]}");
    const { bytes, warnings } = await writeStructureNbt(v, { dataVersion: 1 });
    expect(warnings).toHaveLength(1);
    expect((await readStructureNbt(bytes)).volume.get(0, 0, 0)).toBe(
      "minecraft:chest[facing=north]",
    );
  });

  it("rejects files that are not structures", async () => {
    await expect(readStructureNbt(Uint8Array.from([1, 2, 3]))).rejects.toThrow(CodecError);
    const other = writeNbt({ name: "", tag: compound([["x", int(1)]]) });
    await expect(readStructureNbt(other)).rejects.toThrow(/no palette\/blocks/);
  });
});
