// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { buildReport, reportToJson, viewEntry } from "../src/index.ts";
import { loadVector } from "./helpers.ts";

const v = loadVector<Record<string, unknown>>("report.json");
const view = { azimuth: 135, elevation: 25, label: "az135_el025" };

describe("report against the Python oracle", () => {
  it("builds view entries", () => {
    expect(viewEntry({ file: "az135_el025.png", view })).toEqual(v.view_entry);
    expect(
      viewEntry({ file: "a.png", view, directionsUntrusted: false, directionsTrusted: true }),
    ).toEqual(v.view_entry_trusted);
  });

  it("builds full and minimal reports", () => {
    const full = buildReport({
      errors: [{ block: "x", message: "m", suggestions: ["y"] }],
      warnings: [{ block: "w", message: "careful" }],
      blockCounts: { "minecraft:stone": 12, "minecraft:dirt": 3 },
      dimensions: [4, 5, 6],
      views: [viewEntry({ file: "a.png", view })],
      runDir: "dist/run-003",
      artifacts: [{ kind: "nbt", path: "build.nbt" }],
      overwrittenPlacements: 4,
      origin: [-1, 0, 2],
    });
    expect(full).toEqual(v.full);
    expect(
      buildReport({
        errors: [],
        warnings: [],
        blockCounts: {},
        dimensions: null,
        views: [],
        runDir: "dist/run-001",
      }),
    ).toEqual(v.minimal);
  });

  it("copies its inputs", () => {
    const errors = [{ block: "x" }];
    const r = buildReport({
      errors,
      warnings: [],
      blockCounts: {},
      dimensions: null,
      views: [],
      runDir: "d",
    });
    (r.errors[0] as Record<string, unknown>).block = "changed";
    expect(errors[0]?.block).toBe("x");
  });

  it("writes indented, ASCII-only JSON with a trailing newline", () => {
    const text = reportToJson(
      buildReport({
        errors: [{ message: "café \u{1f600}" }],
        warnings: [],
        blockCounts: {},
        dimensions: null,
        views: [],
        runDir: "d",
      }),
    );
    expect(text.endsWith("}\n")).toBe(true);
    expect(text).toContain('  "errors": [');
    expect(text).toContain("caf\\u00e9 \\ud83d\\ude00");
    expect([...text].every((c) => (c.codePointAt(0) as number) < 128)).toBe(true);
    expect(JSON.parse(text).errors[0].message).toBe("café \u{1f600}");
  });
});
