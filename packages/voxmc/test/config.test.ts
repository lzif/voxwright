// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { ConfigError, expandUser, parseConfig, resolveAssetsDir } from "../src/index.ts";
import { loadVector } from "./helpers.ts";

interface Case {
  text: string;
  ok?: {
    mc_version: string;
    max_dimensions: number[];
    allowlist: string[];
    assets_dir: string | null;
  };
  error?: string;
}

const { cases } = loadVector<{ cases: Record<string, Case> }>("config.json");
const HOME = "/home/test";

describe("config against the Python oracle", () => {
  for (const [name, c] of Object.entries(cases)) {
    it(name, () => {
      if (c.error !== undefined) {
        expect(() => parseConfig(c.text, { home: HOME })).toThrow(ConfigError);
        return;
      }
      const got = parseConfig(c.text, { home: HOME });
      expect({
        mc_version: got.mcVersion,
        max_dimensions: [...got.maxDimensions],
        allowlist: got.allowlist,
        assets_dir: got.assetsDir,
      }).toEqual(c.ok);
    });
  }

  it("expands ~ and resolves the default assets directory", () => {
    expect(expandUser("~", "/h")).toBe("/h");
    expect(expandUser("~/x/y", "/h/")).toBe("/h/x/y");
    expect(expandUser("/abs", "/h")).toBe("/abs");
    expect(expandUser("~other", "/h")).toBe("~other");
    const cfg = parseConfig("");
    expect(resolveAssetsDir(cfg, "/h")).toBe("/h/.cache/mcbuilder/26.2");
    expect(resolveAssetsDir(parseConfig('assets_dir = "/elsewhere"'), "/h")).toBe("/elsewhere");
  });
});
