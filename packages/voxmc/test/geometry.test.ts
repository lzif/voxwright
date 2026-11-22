// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { type Cell, Geometry } from "../src/index.ts";
import { expectError, loadVector } from "./helpers.ts";

interface Vectors {
  base: Cell[];
  cases: Record<string, unknown>;
  errors: Record<string, { error: string }>;
}

const v = loadVector<Vectors>("geometry.json");

function base(): Geometry {
  return Geometry.fromCells(v.base.map((c) => [...c] as unknown as Cell));
}

describe("geometry against the Python oracle", () => {
  it("shifts", () => {
    expect(base().shift(3, -1, 2).cells()).toEqual(v.cases.shift);
  });

  for (const rot of ["NONE", "CLOCKWISE_90", "CLOCKWISE_180", "COUNTERCLOCKWISE_90"] as const) {
    it(`rotates ${rot}, about the origin and about an anchor`, () => {
      expect(base().rotate(rot).cells()).toEqual(v.cases[`rotate-${rot}`]);
      expect(base().rotate(rot, [1, 0, 2]).cells()).toEqual(v.cases[`rotate-anchor-${rot}`]);
    });
  }

  it("mirrors", () => {
    expect(base().mirror("x").cells()).toEqual(v.cases["mirror-x"]);
    expect(base().mirror("z").cells()).toEqual(v.cases["mirror-z"]);
  });

  it("carves and reports bounds", () => {
    expect(base().carve([1, 0, 0], [0, 5, 5]).cells()).toEqual(v.cases.carve);
    expect(base().bounds()).toEqual(v.cases.bounds);
  });

  it("never mutates the original, and concatenation keeps order", () => {
    const g = base();
    g.shift(1, 1, 1);
    g.rotate("CLOCKWISE_90");
    expect(g.cells()).toEqual(v.base);
    const two = g.concat(g.shift(10, 0, 0));
    expect(two.length).toBe(2 * g.length);
    expect(new Geometry().bounds()).toBeNull();
  });

  it("rejects bad arguments", () => {
    expectError(
      () => base().rotate("SIDEWAYS" as never),
      (v.errors["rotate-bad"] as { error: string }).error,
    );
    expectError(
      () => base().mirror("y" as never),
      (v.errors["mirror-bad"] as { error: string }).error,
    );
    expectError(
      () => base().shift(1.5, 0, 0),
      (v.errors["shift-float"] as { error: string }).error,
    );
  });
});
