// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { BlockStringError, canonicalize, parseBlockString, suggest } from "../src/index.ts";
import { loadVector } from "./helpers.ts";

interface Vectors {
  cases: {
    input: string;
    parse: { name: string; props: Record<string, string>; nbt: string | null } | { error: string };
    canonical: { ok: string } | { error: string };
  }[];
  suggest: { name: string; candidates: string[]; n: number; result: string[] }[];
}

const vectors = loadVector<Vectors>("blocks.json");

describe("block strings against the Python oracle", () => {
  it("has vectors", () => {
    expect(vectors.cases.length).toBeGreaterThan(30);
  });

  for (const c of vectors.cases) {
    it(`parse and canonicalize ${JSON.stringify(c.input)}`, () => {
      if ("error" in c.parse) {
        expect(() => parseBlockString(c.input)).toThrow(BlockStringError);
      } else {
        const got = parseBlockString(c.input);
        expect({ name: got.name, props: Object.fromEntries(got.props), nbt: got.nbt }).toEqual(
          c.parse,
        );
      }
      if ("error" in c.canonical) {
        expect(() => canonicalize(c.input)).toThrow(BlockStringError);
      } else {
        expect(canonicalize(c.input)).toBe(c.canonical.ok);
        expect(canonicalize(c.canonical.ok)).toBe(c.canonical.ok); // idempotent
      }
    });
  }

  for (const s of vectors.suggest) {
    it(`suggest ${s.name} (n=${s.n})`, () => {
      expect(suggest(s.name, s.candidates, s.n)).toEqual(s.result);
    });
  }
});
