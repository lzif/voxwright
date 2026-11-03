// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { Build, Rng } from "../src/index.ts";

describe("Rng", () => {
  it("repeats for the same seed and differs for another", () => {
    const seq = (s: string) =>
      Array.from(
        { length: 8 },
        (
          (r) => () =>
            r.nextUint32()
        )(new Rng(s)),
      );
    expect(seq("a")).toEqual(seq("a"));
    expect(seq("a")).not.toEqual(seq("b"));
  });

  it("is pinned, so seeded builds stay reproducible across releases", () => {
    const r = new Rng("voxwright");
    expect(Array.from({ length: 4 }, () => r.nextUint32())).toEqual([
      596595681, 1403567059, 1137806145, 1487484221,
    ]);
  });

  it("keeps values in range", () => {
    const r = new Rng("range");
    for (let i = 0; i < 2000; i++) {
      const f = r.random();
      expect(f >= 0 && f < 1).toBe(true);
      const n = r.int(-3, 4);
      expect(n >= -3 && n <= 4 && Number.isInteger(n)).toBe(true);
    }
    expect(() => r.int(3, 2)).toThrow(RangeError);
    expect(() => r.choice([])).toThrow(RangeError);
  });

  it("is roughly uniform", () => {
    const r = new Rng("uniform");
    const buckets = new Array<number>(10).fill(0);
    for (let i = 0; i < 20000; i++) (buckets[Math.floor(r.random() * 10)] as number)++;
    for (const n of buckets) expect(n).toBeGreaterThan(1700);
  });

  it("shuffles into a permutation", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const out = new Rng("s").shuffle([...items]);
    expect([...out].sort((a, b) => a - b)).toEqual(items);
    expect(out).not.toEqual(items);
  });
});

describe("Build.rng", () => {
  it("shares one stream, and namespaces are independent and repeatable", () => {
    const a = new Build({ seed: 7 });
    expect(a.rng()).toBe(a.rng());
    const first = a.rng("roof").nextUint32();
    expect(new Build({ seed: 7 }).rng("roof").nextUint32()).toBe(first);
    expect(new Build({ seed: 7 }).rng("walls").nextUint32()).not.toBe(first);
    expect(new Build({ seed: 8 }).rng("roof").nextUint32()).not.toBe(first);
  });

  it("is unpredictable without a seed", () => {
    expect(new Build().rng().nextUint32()).not.toBe(new Build().rng().nextUint32());
  });
});
