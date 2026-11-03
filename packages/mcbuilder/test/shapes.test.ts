// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { shapes } from "../src/index.ts";
import { expectError, loadVector, type MaterialSpec, material } from "./helpers.ts";

interface Case {
  fn: string;
  args: unknown[];
  kwargs: Record<string, unknown>;
  cells?: [number, number, number, string][];
  error?: string;
}

const MATERIAL_KWARGS = ["fill", "verge", "eave", "hip", "cap"];
const FUNCTIONS: Record<string, (...a: never[]) => ReturnType<typeof shapes.box>> = {
  box: shapes.box as never,
  walls: shapes.walls as never,
  pillar: shapes.pillar as never,
  line: shapes.line as never,
  stairs: shapes.stairs as never,
  cylinder: shapes.cylinder as never,
  sphere: shapes.sphere as never,
  cone: shapes.cone as never,
  roof_gable: shapes.roofGable as never,
  roof_hip: shapes.roofHip as never,
};

/** Rebuild a vector call: material descriptors become materials; kwargs become the options object. */
export function call(fn: string, args: unknown[], kwargs: Record<string, unknown>) {
  const a = args.map((x) =>
    typeof x === "object" && x !== null && !Array.isArray(x) ? material(x as MaterialSpec) : x,
  );
  const opts: Record<string, unknown> = { ...kwargs };
  for (const k of MATERIAL_KWARGS) {
    if (opts[k] !== undefined && opts[k] !== null) opts[k] = material(opts[k] as MaterialSpec);
  }
  return (FUNCTIONS[fn] as (...x: unknown[]) => ReturnType<typeof shapes.box>)(...a, opts);
}

const { cases } = loadVector<{ cases: Case[] }>("shapes.json");

describe("shapes against the Python oracle", () => {
  it("has vectors", () => {
    expect(cases.length).toBeGreaterThan(55);
  });

  for (const [i, c] of cases.entries()) {
    const label = `${c.fn} #${i} ${JSON.stringify(c.kwargs).slice(0, 50)}`;
    if (c.error !== undefined) {
      it(`${label} fails`, () => {
        expectError(() => call(c.fn, c.args, c.kwargs), c.error as string);
      });
    } else {
      it(`${label} gives the same ${c.cells?.length} cells in the same order`, () => {
        expect(call(c.fn, c.args, c.kwargs).cells()).toEqual(c.cells);
      });
    }
  }
});
