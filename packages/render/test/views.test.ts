// SPDX-License-Identifier: AGPL-3.0-only
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  defaultViews,
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
});
