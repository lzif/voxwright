// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { Build, type Geometry, type Point, shapes } from "../src/index.ts";
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
