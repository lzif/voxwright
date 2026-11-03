// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  Build,
  cleanProperties,
  constName,
  mergeBoxes,
  normalizeBlockData,
  planImport,
  pyFixed,
  Registry,
  type Structure,
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
