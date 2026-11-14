// SPDX-License-Identifier: AGPL-3.0-only
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { type View, ViewError } from "@voxwright/render";
import { describe, expect, it } from "vitest";
import {
  Build,
  BuildError,
  type Geometry,
  McbuilderError,
  type Point,
  Registry,
  shapes,
} from "../src/index.ts";
import { expectError, loadVector, type MaterialSpec, material } from "./helpers.ts";
import { call } from "./shapes.test.ts";

type Op =
  | { op: "set"; at: Point; block: MaterialSpec }
  | { op: "carve"; c1: Point; c2: Point }
  | { op: "recenter" }
  | {
      op: "shape";
      fn: string;
      args: unknown[];
      kwargs?: Record<string, unknown>;
      at?: Point;
      rotation?: string;
    }
  | { op: "method"; fn: string; args: unknown[]; kwargs?: Record<string, unknown> };

interface Result {
  cells: [number, number, number, string][];
  bounds: [Point, Point] | null;
  overwrites: number;
  dense: { shape: number[]; palette: string[]; data: number[] };
  counts: Record<string, number>;
  finds: Record<string, Point[]>;
  gets: Record<string, string | null>;
}

const v = loadVector<{
  scenarios: Record<string, { seed: number | null; ops: Op[]; result: Result }>;
  errors: Record<string, { error: string }>;
}>("build.json");

const camel = (s: string) => s.replace(/_(\w)/g, (_, c: string) => c.toUpperCase());
const MATERIAL_KWARGS = ["fill", "verge", "eave", "hip", "cap"];

function apply(b: Build, op: Op): void {
  switch (op.op) {
    case "set":
      b.set(...op.at, material(op.block));
      return;
    case "carve":
      b.carve(op.c1, op.c2);
      return;
    case "recenter":
      b.recenter();
      return;
    case "shape":
      b.place(call(op.fn, op.args, op.kwargs ?? {}) as Geometry, {
        at: op.at,
        rotation: op.rotation as never,
      });
      return;
    case "method": {
      const args = op.args.map((x) =>
        typeof x === "object" && x !== null && !Array.isArray(x) ? material(x as MaterialSpec) : x,
      );
      const opts: Record<string, unknown> = { ...op.kwargs };
      for (const k of MATERIAL_KWARGS) {
        if (opts[k] !== undefined && opts[k] !== null) opts[k] = material(opts[k] as MaterialSpec);
      }
      (b as unknown as Record<string, (...a: unknown[]) => unknown>)[camel(op.fn)]?.(...args, opts);
    }
  }
}

describe("Build against the Python oracle", () => {
  for (const [name, sc] of Object.entries(v.scenarios)) {
    it(`scenario ${name}`, () => {
      const b = new Build({ seed: sc.seed });
      b.scope(() => {
        for (const op of sc.ops) apply(b, op);
      });
      const want = sc.result;

      const cells: Result["cells"] = [];
      b.grid.volume.eachCell((x, y, z, idx) => {
        cells.push([x, y, z, b.grid.volume.palette[idx] as string]);
      });
      cells.sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);
      expect(cells).toEqual(want.cells);
      expect(b.bounds()).toEqual(want.bounds);
      expect(b.grid.overwriteCount).toBe(want.overwrites);

      const dense = b.grid.toDense();
      expect({ shape: dense.size, palette: dense.palette, data: Array.from(dense.data) }).toEqual(
        want.dense,
      );

      for (const probe of Object.keys(want.counts)) {
        expect(b.count(probe), `count ${probe}`).toBe(want.counts[probe]);
        expect(b.find(probe), `find ${probe}`).toEqual(want.finds[probe]);
      }
      for (const [k, expected] of Object.entries(want.gets)) {
        const [x, y, z] = k.split(",").map(Number) as unknown as Point;
        expect(b.get(x, y, z), `get ${k}`).toBe(expected);
      }
    });
  }

  it("fails the same way outside a scope and out of bounds", () => {
    const e = v.errors;
    const b = new Build({ seed: 1 });
    expectError(
      () => b.set(0, 0, 0, "minecraft:stone"),
      (e["outside-scope-set"] as { error: string }).error,
    );
    expectError(
      () => b.box([0, 0, 0], [1, 1, 1], "minecraft:stone"),
      (e["outside-scope-box"] as { error: string }).error,
    );

    const small = new Build({ maxDimensions: [4, 4, 4] });
    small.scope(() => {
      expectError(
        () => small.set(4, 0, 0, "minecraft:stone"),
        (e["bounds-high"] as { error: string }).error,
      );
      expect(() => small.set(0, -4, 0, "minecraft:stone")).not.toThrow();
      expect(() => small.set(-4, -4, -4, "minecraft:stone")).not.toThrow();
      expectError(
        () => small.box([0, 0, 0], [9, 0, 0], "minecraft:stone"),
        (e["bounds-shape"] as { error: string }).error,
      );
      const g = shapes.box([0, 0, 0], [0, 0, 0], "minecraft:stone");
      expectError(
        () => small.place(g, { rotation: "SIDEWAYS" as never }),
        (e["place-bad-rotation"] as { error: string }).error,
      );
      expectError(
        () => small.place("nope" as never),
        (e["place-not-geometry"] as { error: string }).error,
      );
      expectError(
        () => small.carve([0, 0, 0.5], [1, 1, 1]),
        (e["carve-float"] as { error: string }).error,
      );
      expectError(
        () => small.place(g, { at: [0, 0] as never }),
        (e["place-bad-at"] as { error: string }).error,
      );
    });
  });

  it("nests scopes and closes them even when the body throws", () => {
    const b = new Build();
    expect(() =>
      b.scope(() => {
        b.scope(() => b.set(0, 0, 0, "minecraft:stone"));
        b.set(1, 0, 0, "minecraft:stone");
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(() => b.set(2, 0, 0, "minecraft:stone")).toThrow(/inside/);
    expect(b.get(1, 0, 0)).toBe("minecraft:stone");
  });
});

// Python `Build.floor` and the `tests/test_parts.py` cases that go through a Build.
describe("Build floor, stairsRun and railing", () => {
  const STAIR = "minecraft:oak_stairs";
  const FENCE = "minecraft:oak_fence";

  /** Every placed cell of `b`, sorted by position. */
  const placed = (b: Build): [number, number, number, string][] => {
    const out: [number, number, number, string][] = [];
    b.grid.volume.eachCell((x, y, z, idx) => {
      out.push([x, y, z, b.grid.volume.palette[idx] as string]);
    });
    return out.sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);
  };

  describe("floor", () => {
    it("is a slab one thick at the lower y, whatever order the corners come in", () => {
      const lower = [1, 3, 0] as const;
      const upper = [5, 7, 4] as const;
      const expected: [number, number, number, string][] = [];
      for (let x = 1; x <= 5; x++)
        for (let z = 0; z <= 4; z++) expected.push([x, 3, z, "minecraft:oak_planks"]);

      for (const [c1, c2] of [
        [lower, upper],
        [upper, lower],
        [
          [5, 3, 0],
          [1, 7, 4],
        ],
        [
          [1, 7, 4],
          [5, 3, 0],
        ],
      ] as const) {
        const b = new Build();
        const geo = b.scope(() => b.floor(c1, c2, "minecraft:oak_planks"));
        expect(placed(b), `${c1} ${c2}`).toEqual(expected);
        expect(geo.cells().length).toBe(25);
        expect(geo.bounds()).toEqual([
          [1, 3, 0],
          [5, 3, 4],
        ]);
        expect(b.bounds()).toEqual(geo.bounds());
      }
    });

    it("is one cell when both corners are the same", () => {
      const b = new Build();
      b.scope(() => b.floor([2, 5, 2], [2, 5, 2], "minecraft:stone"));
      expect(placed(b)).toEqual([[2, 5, 2, "minecraft:stone"]]);
    });

    it("resolves a palette with the Build seed, like a box one block high", () => {
      const palette = [
        "minecraft:oak_planks",
        "minecraft:birch_planks",
        "minecraft:spruce_planks",
        "minecraft:jungle_planks",
      ];
      const floor = (seed: number) => {
        const b = new Build({ seed });
        b.scope(() => b.floor([0, 2, 0], [7, 9, 7], palette));
        return placed(b);
      };
      const box = new Build({ seed: 5 });
      box.scope(() => box.box([0, 2, 0], [7, 2, 7], palette));
      expect(floor(5)).toEqual(placed(box));
      expect(floor(5)).toEqual(
        shapes
          .box([0, 2, 0], [7, 2, 7], palette, { seed: 5 })
          .cells()
          .sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]),
      );
      expect(floor(6)).not.toEqual(floor(5));
    });

    it("needs a scope and three-int corners", () => {
      const b = new Build();
      expect(() => b.floor([0, 0, 0], [1, 0, 1], "minecraft:stone")).toThrow(/inside/);
      b.scope(() => {
        expect(() => b.floor([0, 0] as never, [1, 0, 1], "minecraft:stone")).toThrow(
          McbuilderError,
        );
        expect(() => b.floor([0, 0, 0], [1, 0, 0.5], "minecraft:stone")).toThrow(McbuilderError);
      });
      expect(b.bounds()).toBeNull();
    });
  });

  describe("stairsRun", () => {
    it("places the run and returns it in absolute coordinates, top step on the target", () => {
      const b = new Build();
      const geo = b.scope(() =>
        b.stairsRun([10, 20, 30], "south", STAIR, { target: [10, 22, 32] }),
      );
      const stair = "minecraft:oak_stairs[facing=south,half=bottom]";
      expect(geo.cells()).toEqual([
        [10, 20, 30, stair],
        [10, 21, 31, stair],
        [10, 22, 32, stair],
      ]);
      expect(geo.bounds()).toEqual([
        [10, 20, 30],
        [10, 22, 32],
      ]);
      expect(placed(b)).toEqual(geo.cells());
    });

    it("gives the same build for the length form and the target form, as stairs does", () => {
      const run = (place: (b: Build) => unknown) => {
        const b = new Build();
        b.scope(() => place(b));
        return placed(b);
      };
      const byLength = run((b) => b.stairsRun([0, 0, 5], "north", STAIR, { length: 3, width: 2 }));
      expect(byLength).toEqual(
        run((b) => b.stairs([0, 0, 5], "north", STAIR, { length: 3, width: 2 })),
      );
      expect(
        run((b) => b.stairsRun([0, 0, 5], "north", STAIR, { target: [0, 2, 3], width: 2 })),
      ).toEqual(byLength);
      expect(byLength.length).toBe(6);
    });

    it("refuses a block with facing and places nothing", () => {
      const b = new Build();
      b.scope(() => {
        expect(() =>
          b.stairsRun([0, 0, 0], "north", "minecraft:oak_stairs[facing=east]", { length: 2 }),
        ).toThrow(McbuilderError);
      });
      expect(b.bounds()).toBeNull();
    });

    it("resolves a palette with the Build seed, like stairs", () => {
      const palette = ["minecraft:oak_stairs", "minecraft:spruce_stairs", "minecraft:birch_stairs"];
      const a = new Build({ seed: 4 });
      const c = new Build({ seed: 4 });
      a.scope(() => a.stairsRun([0, 0, 0], "east", palette, { length: 12 }));
      c.scope(() => c.stairs([0, 0, 0], "east", palette, { length: 12 }));
      expect(placed(a)).toEqual(placed(c));
    });
  });

  describe("railing", () => {
    it("runs along x", () => {
      const b = new Build();
      const geo = b.scope(() => b.railing([0, 64, 0], [4, 64, 0], FENCE));
      const expected = [0, 1, 2, 3, 4].map((x) => [x, 64, 0, FENCE]);
      expect(geo.cells()).toEqual(expected);
      expect(placed(b)).toEqual(expected);
    });

    it("runs along z with the end before the start", () => {
      const b = new Build();
      const geo = b.scope(() => b.railing([2, 64, 5], [2, 64, 2], FENCE));
      const expected = [2, 3, 4, 5].map((z) => [2, 64, z, FENCE]);
      expect(placed(b)).toEqual(expected);
      expect(geo.cells().sort((p, q) => p[2] - q[2])).toEqual(expected);
    });

    it("is one cell when start equals end", () => {
      const b = new Build();
      const geo = b.scope(() => b.railing([1, 1, 1], [1, 1, 1], FENCE));
      expect(geo.cells()).toEqual([[1, 1, 1, FENCE]]);
      expect(placed(b)).toEqual([[1, 1, 1, FENCE]]);
    });

    it("places the same cells as Build.line on the same endpoints, seed included", () => {
      const palette = [FENCE, "minecraft:birch_fence", "minecraft:spruce_fence"];
      for (const [p1, p2] of [
        [
          [0, 64, 0],
          [9, 64, 0],
        ],
        [
          [3, 10, 8],
          [3, 10, -2],
        ],
      ] as const) {
        const r = new Build({ seed: 2 });
        const l = new Build({ seed: 2 });
        r.scope(() => r.railing(p1, p2, palette));
        l.scope(() => l.line(p1, p2, palette));
        expect(placed(r)).toEqual(placed(l));
      }
    });

    it("names a y mismatch or a diagonal and places nothing", () => {
      const b = new Build();
      b.scope(() => {
        expect(() => b.railing([0, 64, 0], [4, 65, 0], FENCE)).toThrow(/same y level/);
        expect(() => b.railing([0, 64, 0], [4, 64, 3], FENCE)).toThrow(/axis-aligned/);
        expect(() => b.railing([0, 64, 0], [4, 64, 3], FENCE)).toThrow(McbuilderError);
      });
      expect(b.bounds()).toBeNull();
    });
  });

  it("composes a hut corner from pillar, stairsRun, railing and floor", () => {
    const b = new Build();
    b.scope(() => {
      b.pillar([0, 0, 0], 4, "minecraft:oak_log[axis=y]");
      b.stairsRun([0, 0, 5], "north", "minecraft:stone_brick_stairs", { length: 3, width: 2 });
      b.railing([0, 4, -1], [2, 4, -1], FENCE);
      // The corners differ in y; the slab sits at the lower one.
      b.floor([2, 0, 1], [4, 2, 3], "minecraft:spruce_planks");
    });

    for (let i = 0; i < 4; i++) expect(b.get(0, i, 0)).toBe("minecraft:oak_log[axis=y]");
    const stair = "minecraft:stone_brick_stairs[facing=north,half=bottom]";
    for (let i = 0; i < 3; i++) for (let w = 0; w < 2; w++) expect(b.get(w, i, 5 - i)).toBe(stair);
    for (let x = 0; x < 3; x++) expect(b.get(x, 4, -1)).toBe(FENCE);
    for (let x = 2; x <= 4; x++)
      for (let z = 1; z <= 3; z++) {
        expect(b.get(x, 0, z)).toBe("minecraft:spruce_planks");
        expect(b.get(x, 1, z)).toBeNull();
      }

    // Nothing else got placed: 4 logs + 6 stairs + 3 fences + a 3 x 3 slab.
    expect(placed(b).length).toBe(4 + 6 + 3 + 9);
  });
});

describe("Build.validate and Build.render", () => {
  it("validates placed blocks against a Registry and honours the allowlist", () => {
    const reg = new Registry({ "minecraft:stone": { properties: {} } }, "test");
    const b = new Build({ seed: 1 });
    b.scope(() => {
      b.set(0, 0, 0, "minecraft:stone");
      b.set(1, 0, 0, "minecraft:nope_block");
      b.set(2, 0, 0, "create:brass_casing");
    });
    const res = b.validate(reg, ["create:brass_casing"]);
    expect(res.errors.some((e) => e.block.includes("nope_block"))).toBe(true);
    expect(res.errors.some((e) => e.block.includes("minecraft:stone"))).toBe(false);
    expect(res.warnings.some((w) => w.block === "create:brass_casing")).toBe(true);
  });

  it("renders views to PNGs with precedence, region cropping and determinism", () => {
    const dir = mkdtempSync(join(tmpdir(), "voxwright-build-render-"));
    try {
      const b = new Build({ seed: 7, views: ["top"] });
      b.scope(() => {
        b.walls([10, 5, -8], [12, 7, -6], "minecraft:stone");
        b.set(11, 6, -7, "minecraft:air");
      });

      // Explicit argument beats script config.
      const p1 = b.render(join(dir, "r1"), ["top", "iso"], { assetsDir: null });
      expect(p1.map((p) => basename(p))).toEqual(["top.png", "iso.png"]);

      // Determinism: same build + same views => byte-identical PNGs.
      const p2 = b.render(join(dir, "r2"), ["top", "iso"], { assetsDir: null });
      for (let i = 0; i < p1.length; i++) {
        expect(readFileSync(p1[i] as string).equals(readFileSync(p2[i] as string))).toBe(true);
      }

      // Script config beats default 9-view set; also test options-object overload and region/presentation.
      const p3 = b.render(join(dir, "r3"), {
        assetsDir: null,
        region: [
          [10, 5, -8],
          [11, 6, -7],
        ],
        presentation: false,
      });
      expect(p3.map((p) => basename(p))).toEqual(["top.png"]);

      // Colon-style orbit view spec.
      const bColon = new Build({ seed: 3, views: ["orbit:4_el:25", "top"] });
      bColon.scope(() => bColon.set(0, 0, 0, "minecraft:stone"));
      const pColon = bColon.render(join(dir, "colon"), { assetsDir: null });
      expect(pColon.length).toBe(5);
      expect(basename(pColon[0] as string)).toBe("az000_el025.png");
      expect(basename(pColon.at(-1) as string)).toBe("top.png");

      // Enforces 36-view cap and rejects invalid or unported tiers.
      const manyViews: View[] = Array.from({ length: 40 }, (_, i) => ({
        azimuth: i % 360,
        elevation: 25,
        label: `v${i}`,
      }));
      expect(() => b.render(join(dir, "cap"), manyViews, { assetsDir: null })).toThrow(ViewError);
      expect(() => b.render(join(dir, "tier1"), { tier: "bogus" as never })).toThrow(BuildError);
      expect(() => b.render(join(dir, "tier2"), { tier: "fast" })).toThrow(BuildError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
