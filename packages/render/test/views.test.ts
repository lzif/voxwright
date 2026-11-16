// SPDX-License-Identifier: AGPL-3.0-only
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  defaultViews,
  focusBounds,
  MAX_VIEWS,
  parseViews,
  resolveViews,
  type View,
  ViewError,
  withCount,
} from "../src/index.ts";

type Dump = { azimuth: number; elevation: number; label: string }[];
type Result = { ok: Dump } | { error: string };

const v = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../vectors/views.json", import.meta.url)), "utf8"),
) as {
  max_views: number;
  defaults: Dump;
  parsed: Record<string, Result>;
  resolved: Record<string, Dump>;
  with_count: Record<string, Result>;
};

function check(fn: () => View[], want: Result, what: string): void {
  if ("error" in want) {
    // Python raises ViewError for bad specs and ValueError for a non-positive count.
    expect(fn, what).toThrow(want.error === "ViewError" ? ViewError : RangeError);
  } else {
    expect(fn(), what).toEqual(want.ok);
  }
}

describe("views against the Python oracle", () => {
  it("has the same cap and defaults", () => {
    expect(MAX_VIEWS).toBe(v.max_views);
    expect(defaultViews()).toEqual(v.defaults);
  });

  for (const [spec, want] of Object.entries(v.parsed)) {
    it(`parses ${JSON.stringify(spec)}`, () => check(() => parseViews(spec), want, spec));
  }

  it("resolves every spec shape", () => {
    expect(resolveViews(null)).toEqual(v.resolved.none);
    expect(resolveViews("iso;top")).toEqual(v.resolved.string);
    expect(resolveViews(["iso", "az045_el025;top"])).toEqual(v.resolved["list-of-strings"]);
    expect(resolveViews(parseViews("iso;top"))).toEqual(v.resolved["list-of-views"]);
    expect(resolveViews([])).toEqual(v.resolved["empty-list"]);
  });

  for (const [n, want] of Object.entries(v.with_count)) {
    it(`appends an orbit of ${n}`, () =>
      check(() => withCount(parseViews("iso"), Number(n)), want, n));
  }

  it("names the offending token in its message", () => {
    expect(() => parseViews("az045_el025;bogus")).toThrow(/malformed view token 'bogus'/);
    expect(() => parseViews("az360_el25")).toThrow(/azimuth 360\.0 out of range \[0, 360\)/);
  });

  it("parses valid close-up focus suffixes and preserves unfocused views", () => {
    const plain = parseViews("iso")[0] as View;
    expect("focus" in plain).toBe(false);

    expect(parseViews("iso@15,6,22r5")).toEqual([
      {
        azimuth: 45,
        elevation: 35,
        label: "iso@15,6,22r5",
        focus: { center: [15, 6, 22], radius: 5 },
      },
    ]);
    expect(parseViews("top@10,6,12r8")).toEqual([
      {
        azimuth: 0,
        elevation: 90,
        label: "top@10,6,12r8",
        focus: { center: [10, 6, 12], radius: 8 },
      },
    ]);
    expect(parseViews("az225_el025@28,7,18r4")).toEqual([
      {
        azimuth: 225,
        elevation: 25,
        label: "az225_el025@28,7,18r4",
        focus: { center: [28, 7, 18], radius: 4 },
      },
    ]);
    expect(parseViews("az:45_el:5@-3,-0,-12r02")).toEqual([
      {
        azimuth: 45,
        elevation: 5,
        label: "az045_el005@-3,0,-12r2",
        focus: { center: [-3, 0, -12], radius: 2 },
      },
    ]);
    expect(parseViews("orbit4_el25@18,5,23r5")).toEqual([
      {
        azimuth: 0,
        elevation: 25,
        label: "az000_el025@18,5,23r5",
        focus: { center: [18, 5, 23], radius: 5 },
      },
      {
        azimuth: 90,
        elevation: 25,
        label: "az090_el025@18,5,23r5",
        focus: { center: [18, 5, 23], radius: 5 },
      },
      {
        azimuth: 180,
        elevation: 25,
        label: "az180_el025@18,5,23r5",
        focus: { center: [18, 5, 23], radius: 5 },
      },
      {
        azimuth: 270,
        elevation: 25,
        label: "az270_el025@18,5,23r5",
        focus: { center: [18, 5, 23], radius: 5 },
      },
    ]);
    expect(resolveViews(["iso", "az225_el025@1,2,3r4"])).toEqual([
      { azimuth: 45, elevation: 35, label: "iso" },
      {
        azimuth: 225,
        elevation: 25,
        label: "az225_el025@1,2,3r4",
        focus: { center: [1, 2, 3], radius: 4 },
      },
    ]);
    expect(resolveViews(["iso", { azimuth: 90, elevation: 25, label: "custom" }])).toEqual([
      { azimuth: 45, elevation: 35, label: "iso" },
      { azimuth: 90, elevation: 25, label: "custom" },
    ]);
  });

  it("rejects malformed focus suffixes with ViewError naming the token", () => {
    for (const bad of [
      "iso@",
      "@1,2,3r4",
      "@1,2,3:4,5,6",
      "iso@1,2r4",
      "iso@1,2,3",
      "iso@1,2,3r",
      "iso@1,2,3r0",
      "iso@1,2,3r-2",
      "iso@1.5,2,3r4",
      "iso@1,2,3r4.5",
      "iso@1,2,3r4@5,6,7r8",
      "iso@1, 2, 3r4",
      "iso@1,2,3x4",
      "iso@1,2,3:",
      "iso@:4,5,6",
      "iso@1,2:4,5,6",
      "iso@1,2,3:4,5",
      "iso@1,2,3:4,5,6,7",
      "iso@1,2,3:4,5,6:7,8,9",
      "iso@1,2,3::4,5,6",
      "iso@1.5,2,3:4,5,6",
      "iso@1,2,3:4,5,6.5",
      "iso@1, 2, 3:4,5,6",
      "iso@1,2,3:4,5,6r2",
      "iso@1,2,3r2:4,5,6",
      "iso@a,b,c:d,e,f",
      "iso@1,2,3:4,5,6@7,8,9",
      "iso@99999999999999999999,2,3:4,5,6",
      "bogus@1,2,3r4",
      "bogus@1,2,3:4,5,6",
      "az360_el25@1,2,3r4",
      "az360_el25@1,2,3:4,5,6",
      "orbit37_el25@1,2,3r4",
      "orbit37_el25@1,2,3:4,5,6",
    ]) {
      expect(() => parseViews(bad), bad).toThrow(ViewError);
      if (bad !== "orbit37_el25@1,2,3r4" && bad !== "orbit37_el25@1,2,3:4,5,6") {
        expect(() => parseViews(bad), bad).toThrow(bad);
      }
    }
  });

  it("parses valid pos1:pos2 box focus suffixes, normalizes reversed corners, and computes bounds", () => {
    expect(parseViews("iso@10,4,18:22,10,28")).toEqual([
      {
        azimuth: 45,
        elevation: 35,
        label: "iso@10,4,18:22,10,28",
        focus: { min: [10, 4, 18], max: [22, 10, 28] },
      },
    ]);
    // Reversed and mixed-order corners normalize to min/max per axis.
    expect(parseViews("iso@22,10,28:10,4,18")).toEqual([
      {
        azimuth: 45,
        elevation: 35,
        label: "iso@10,4,18:22,10,28",
        focus: { min: [10, 4, 18], max: [22, 10, 28] },
      },
    ]);
    expect(parseViews("az:135_el:25@22,-0,28:10,10,-4")).toEqual([
      {
        azimuth: 135,
        elevation: 25,
        label: "az135_el025@10,0,-4:22,10,28",
        focus: { min: [10, 0, -4], max: [22, 10, 28] },
      },
    ]);
    // Single-cell inclusive box.
    expect(parseViews("top@5,5,5:5,5,5")).toEqual([
      {
        azimuth: 0,
        elevation: 90,
        label: "top@5,5,5:5,5,5",
        focus: { min: [5, 5, 5], max: [5, 5, 5] },
      },
    ]);
    // Orbit expansion clones box focus to every generated view.
    expect(parseViews("orbit4_el25@14,3,22:22,7,24")).toEqual([
      {
        azimuth: 0,
        elevation: 25,
        label: "az000_el025@14,3,22:22,7,24",
        focus: { min: [14, 3, 22], max: [22, 7, 24] },
      },
      {
        azimuth: 90,
        elevation: 25,
        label: "az090_el025@14,3,22:22,7,24",
        focus: { min: [14, 3, 22], max: [22, 7, 24] },
      },
      {
        azimuth: 180,
        elevation: 25,
        label: "az180_el025@14,3,22:22,7,24",
        focus: { min: [14, 3, 22], max: [22, 7, 24] },
      },
      {
        azimuth: 270,
        elevation: 25,
        label: "az270_el025@14,3,22:22,7,24",
        focus: { min: [14, 3, 22], max: [22, 7, 24] },
      },
    ]);
    // Both focus forms map to inclusive [min, max] bounds.
    expect(focusBounds({ center: [15, 6, 22], radius: 5 })).toEqual([
      [10, 1, 17],
      [20, 11, 27],
    ]);
    expect(focusBounds({ min: [22, 10, 28], max: [10, 4, 18] })).toEqual([
      [10, 4, 18],
      [22, 10, 28],
    ]);
  });
});
