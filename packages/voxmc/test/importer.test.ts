// SPDX-License-Identifier: AGPL-3.0-only
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readSchem, readStructureNbt } from "@voxwright/core";
import { afterAll, describe, expect, it } from "vitest";
import {
  Build,
  cleanProperties,
  constName,
  mergeBoxes,
  normalizeBlockData,
  planImport,
  pyFixed,
  RENAMED_BLOCKS,
  Registry,
  type Structure,
  structureFromVolume,
  summary,
  toScript,
} from "../src/index.ts";
import { loadVector } from "./helpers.ts";

interface Scenario {
  cells: [number, number, number, string][];
  dropped_block_entities: number;
  dropped_entities: number;
  summary: string[];
  summary_top3: string[];
  names: Record<string, string>;
  calls: [number, number, number, number[], number[], string][];
}

const { scenarios } = loadVector<{ scenarios: Record<string, Scenario> }>("importer.json");

function structureOf(s: Scenario): Structure {
  return {
    blocks: s.cells,
    source: "test.nbt",
    dataVersion: 4903,
    droppedBlockEntities: s.dropped_block_entities,
    droppedEntities: s.dropped_entities,
    droppedProperties: new Map(),
  };
}

describe("importer against the Python oracle", () => {
  for (const [name, s] of Object.entries(scenarios)) {
    it(`${name}: summary, constant names and box plan`, () => {
      const st = structureOf(s);
      expect(summary(st)).toEqual(s.summary);
      expect(summary(st, 3)).toEqual(s.summary_top3);
      const plan = planImport(st);
      expect(Object.fromEntries(plan.names)).toEqual(s.names);
      expect([...plan.names.keys()]).toEqual(Object.keys(s.names)); // most used first
      expect(plan.calls.map((c) => [c.y, c.z, c.x, [...c.c1], [...c.c2], c.block])).toEqual(
        s.calls,
      );
    });

    it(`${name}: the generated script rebuilds the structure exactly`, () => {
      const code = toScript(structureOf(s))
        .replace('import { Build } from "@voxwright/mcbuilder";', "")
        .replace("export const BUILD", "const BUILD");
      const build = new Function("Build", `${code}\nreturn BUILD;`)(Build) as Build;
      const got: string[] = [];
      build.grid.volume.eachCell((x, y, z, idx) => {
        got.push(`${x},${y},${z} ${build.grid.volume.palette[idx]}`);
      });
      const want = s.cells.map(([x, y, z, b]) => `${x},${y},${z} ${b}`);
      expect(got.sort()).toEqual(want.sort());
    });
  }

  it("covers an empty structure and a ten-block merge", () => {
    expect(summary({ ...structureOf(scenarios.single as Scenario), blocks: [] })).toEqual([
      "empty structure",
    ]);
    const cells = Array.from({ length: 10 }, (_, x) => [x, 0, 0] as const);
    expect(mergeBoxes(cells)).toEqual([
      [
        [0, 0, 0],
        [9, 0, 0],
      ],
    ]);
  });

  it("names constants uniquely and safely", () => {
    const taken = new Set<string>();
    expect(
      constName("minecraft:oak_stairs[facing=north,half=bottom,waterlogged=false]", taken),
    ).toBe("OAK_STAIRS_N_BOTTOM");
    expect(constName("minecraft:oak_stairs[facing=north,half=bottom]", taken)).toBe(
      "OAK_STAIRS_N_BOTTOM_2",
    );
    expect(constName("minecraft:123", taken)).toBe("B_123");
    expect(constName("minecraft:class", taken)).toBe("B_CLASS");
  });

  it("formats percentages like Python, including ties", () => {
    expect(pyFixed(0.25, 1)).toBe("0.2");
    expect(pyFixed(0.35, 1)).toBe("0.3"); // 0.35 is below the tie in binary
    expect(pyFixed(0.75, 1)).toBe("0.8");
    expect(pyFixed(12.5, 0)).toBe("12");
    expect(pyFixed(13.5, 0)).toBe("14");
    expect(pyFixed(99.96, 1)).toBe("100.0");
    expect(pyFixed(50, 1)).toBe("50.0");
  });
});

describe("cleanProperties against the Python oracle", () => {
  const v = loadVector<{
    cells: [number, number, number, string][];
    cleaned: [number, number, number, string][];
    dropped: Record<string, number>;
  }>("clean.json");
  const registry = new Registry(
    normalizeBlockData([
      {
        name: "oak_stairs",
        states: [
          { name: "facing", type: "enum", values: ["north", "south"] },
          { name: "half", type: "enum", values: ["top", "bottom"] },
        ],
      },
      {
        name: "oak_slab",
        states: [{ name: "type", type: "enum", values: ["top", "bottom", "double"] }],
      },
      { name: "stone", states: [] },
    ]),
    "t",
  );

  it("drops unknown properties and counts them the same way", () => {
    const st: Structure = {
      blocks: v.cells,
      source: "x",
      dataVersion: null,
      droppedBlockEntities: 0,
      droppedEntities: 0,
      droppedProperties: new Map(),
    };
    const out = cleanProperties(st, registry);
    expect(out.blocks).toEqual(v.cleaned);
    expect(Object.fromEntries(out.droppedProperties)).toEqual(v.dropped);
    expect(st.blocks).toEqual(v.cells); // the input is not mutated
    expect(summary(out).join("\n")).toContain(
      "dropped unknown properties (Bedrock leftovers?): oak_slab.half x1",
    );
  });
});

describe("import: specifier and renamed blocks", () => {
  const st = (blocks: [number, number, number, string][]): Structure => ({
    blocks,
    source: "old.litematic",
    dataVersion: 3105,
    droppedBlockEntities: 0,
    droppedEntities: 0,
    droppedProperties: new Map(),
  });
  const registryOf = (names: string[]) =>
    new Registry(
      normalizeBlockData(
        names.map((name) =>
          name === "iron_chain" || name === "chain"
            ? {
                name,
                states: [
                  { name: "axis", type: "enum", values: ["x", "y", "z"] },
                  { name: "waterlogged", type: "bool", values: ["true", "false"] },
                ],
              }
            : { name, states: [] },
        ),
      ),
      "t",
    );

  it("imports Build from the workspace package unless told otherwise", () => {
    const s = st([[0, 0, 0, "minecraft:stone"]]);
    expect(toScript(s)).toContain('import { Build } from "@voxwright/mcbuilder";');
    expect(toScript(s, { specifier: "voxwright" })).toContain('import { Build } from "voxwright";');
  });

  it("renames old block ids the registry no longer knows, and says so", () => {
    const old = st([
      [0, 0, 0, "minecraft:chain[axis=y,waterlogged=false]"],
      [0, 1, 0, "minecraft:chain[axis=y,waterlogged=false]"],
      [1, 0, 0, "minecraft:grass"],
      [2, 0, 0, "minecraft:grass_path"],
      [3, 0, 0, "minecraft:stone"],
    ]);
    const out = cleanProperties(
      old,
      registryOf(["iron_chain", "short_grass", "dirt_path", "stone"]),
    );
    expect(out.blocks.map((c) => c[3])).toEqual([
      "minecraft:iron_chain[axis=y,waterlogged=false]",
      "minecraft:iron_chain[axis=y,waterlogged=false]",
      "minecraft:short_grass",
      "minecraft:dirt_path",
      "minecraft:stone",
    ]);
    expect(Object.fromEntries(out.renamedBlocks ?? [])).toEqual({
      "chain -> iron_chain": 2,
      "grass -> short_grass": 1,
      "grass_path -> dirt_path": 1,
    });
    expect(summary(out)).toContain(
      "renamed to current block ids: chain -> iron_chain x2, grass -> short_grass x1, grass_path -> dirt_path x1",
    );
  });

  it("keeps an old id the registry still knows (an older target version)", () => {
    const old = st([[0, 0, 0, "minecraft:chain[axis=x,waterlogged=false]"]]);
    const out = cleanProperties(old, registryOf(["chain", "iron_chain"]));
    expect(out.blocks[0]?.[3]).toBe("minecraft:chain[axis=x,waterlogged=false]");
    expect(out.renamedBlocks).toBeUndefined();
    expect(Object.keys(RENAMED_BLOCKS)).toContain("minecraft:chain");
  });
});

describe("convert.ts -> mcbuilder importer on real .schem fixtures", () => {
  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const convertScript = join(repoRoot, "scripts/convert.ts");
  const workDir = mkdtempSync(join(tmpdir(), "voxwright-convert-import-"));
  afterAll(() => rmSync(workDir, { recursive: true, force: true }));

  it.each([
    "fixtures/real/worldedit/fantasyhouse2.schem",
    "fixtures/real/shulkr/raifox-medivial-house.schem",
    "fixtures/real/flat-v3/smp_lobby_big.schem",
  ])("converts %s to .nbt and imports back with identical blocks", async (relPath) => {
    const src = join(repoRoot, relPath);
    const outNbt = join(workDir, `${basename(relPath, ".schem")}.nbt`);
    execFileSync(process.execPath, [convertScript, src, outNbt], { stdio: "pipe" });

    const original = await readSchem(new Uint8Array(readFileSync(src)));
    const converted = await readStructureNbt(new Uint8Array(readFileSync(outNbt)));
    const structure = structureFromVolume(converted.volume, basename(outNbt), {
      dataVersion: converted.meta.dataVersion,
      droppedBlockEntities: converted.meta.droppedBlockEntities + converted.volume.blockEntityCount,
      droppedEntities: converted.meta.droppedEntities + converted.volume.entities.length,
    });
    const code = toScript(structure)
      .replace('import { Build } from "@voxwright/mcbuilder";', "")
      .replace("export const BUILD", "const BUILD");
    const rebuilt = (new Function("Build", `${code}\nreturn BUILD;`)(Build) as Build).grid.volume;

    expect(rebuilt.size).toBe(original.volume.size);
    let mismatches = 0;
    rebuilt.eachCell((x, y, z, idx) => {
      if (original.volume.get(x, y, z) !== rebuilt.palette[idx]) mismatches++;
    });
    expect(mismatches).toBe(0);
  });

  it("renames legacy 1.20 block ids when cleaning an imported flat-v3 build for 26.2", async () => {
    const src = join(repoRoot, "fixtures/real/flat-v3/smp_lobby_big.schem");
    const outNbt = join(workDir, "smp_lobby_big_rename.nbt");
    execFileSync(process.execPath, [convertScript, src, outNbt], { stdio: "pipe" });
    const converted = await readStructureNbt(new Uint8Array(readFileSync(outNbt)));
    const st = structureFromVolume(converted.volume, basename(outNbt), {
      dataVersion: converted.meta.dataVersion,
    });
    const reg = new Registry(
      normalizeBlockData([
        {
          name: "iron_chain",
          states: [
            { name: "axis", type: "enum", values: ["x", "y", "z"] },
            { name: "waterlogged", type: "bool", values: ["true", "false"] },
          ],
        },
      ]),
      "26.2",
    );
    const cleaned = cleanProperties(st, reg);
    expect(cleaned.renamedBlocks?.get("chain -> iron_chain")).toBeGreaterThan(0);
    expect(cleaned.blocks.some(([, , , b]) => b.startsWith("minecraft:iron_chain["))).toBe(true);
    expect(cleaned.blocks.some(([, , , b]) => b.startsWith("minecraft:chain["))).toBe(false);
  });
});
