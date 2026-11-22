// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { McbuilderError, normalizeBlockData, Registry } from "../src/index.ts";
import { loadVector } from "./helpers.ts";

interface Vectors {
  raw: unknown;
  normalized: Record<string, Record<string, string[]>>;
  normalized_input: unknown;
  normalized_from_mapping: Record<string, Record<string, string[]>>;
  names: string[];
  validations: { palette: string[]; allowlist: string[]; errors: unknown[]; warnings: unknown[] }[];
}

const v = loadVector<Vectors>("registry.json");

describe("registry against the Python oracle", () => {
  it("normalizes minecraft-data and already-normalized mappings", () => {
    expect(normalizeBlockData(v.raw)).toEqual(v.normalized);
    expect(normalizeBlockData(v.normalized_input)).toEqual(v.normalized_from_mapping);
    expect(() => normalizeBlockData(5)).toThrow(McbuilderError);
  });

  it("lists names sorted", () => {
    expect(new Registry(normalizeBlockData(v.raw), "test-1").names()).toEqual(v.names);
  });

  it("validates every palette to the same errors, messages and suggestions", () => {
    const reg = new Registry(normalizeBlockData(v.raw), "test-1");
    expect(v.validations.length).toBeGreaterThan(30);
    for (const c of v.validations) {
      const got = reg.validate(c.palette, c.allowlist);
      expect(got.errors, JSON.stringify(c.palette)).toEqual(c.errors);
      expect(got.warnings, JSON.stringify(c.palette)).toEqual(c.warnings);
    }
  });

  it("builds from raw data and reports a bad shape", () => {
    expect(Registry.fromData(v.raw, "x").names()).toEqual(v.names);
    expect(() => Registry.fromData(5, "x")).toThrow(/unexpected shape/);
  });
});
