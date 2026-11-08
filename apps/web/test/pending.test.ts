// SPDX-License-Identifier: AGPL-3.0-only

// The pending values touch builds up before a confirm: what moves on a nudge, and the readout text.

import type { Vec3 } from "@voxwright/core";
import { describe, expect, it } from "vitest";
import {
  activeCorner,
  cornerB,
  cornersBox,
  describePending,
  isTwoPoint,
  nudgeCells,
  type Pending,
  type PendingCorner,
  pendingSize,
  shiftPending,
  withCorner,
} from "../src/lib/pending.ts";

const line = (a: Vec3, b: Vec3 | null, active: PendingCorner = "b"): Pending => ({
  kind: "line",
  a,
  b,
  active,
});
const rect = (
  a: Vec3,
  b: Vec3 | null,
  axis: 0 | 1 | 2 = 1,
  active: PendingCorner = "b",
): Pending => ({ kind: "rectangle", a, b, axis, at: 0, active });

const ctx = {
  block: "minecraft:stone",
  blockAt: (c: Vec3): string | undefined => (c[1] === 0 ? "minecraft:oak_planks" : undefined),
  clipSize: [3, 2, 4] as Vec3,
};

describe("two-point helpers", () => {
  it("B is A until the second tap, and the active corner follows `active`", () => {
    const only = line([1, 1, 1], null, "a");
    if (!isTwoPoint(only)) throw new Error("not two-point");
    expect(cornerB(only)).toEqual([1, 1, 1]);
    expect(activeCorner(only)).toEqual([1, 1, 1]);
    const both = line([1, 1, 1], [4, 1, 7], "b");
    if (!isTwoPoint(both)) throw new Error("not two-point");
    expect(activeCorner(both)).toEqual([4, 1, 7]);
    expect(activeCorner({ ...both, active: "a" })).toEqual([1, 1, 1]);
    expect(cornersBox(both)).toEqual({ min: [1, 1, 1], max: [4, 1, 7] });
    expect(cornersBox(line([4, 1, 7], [1, 1, 1]) as never)).toEqual({
      min: [1, 1, 1],
      max: [4, 1, 7],
    });
  });

  it("withCorner replaces one corner and makes it the active one", () => {
    const p = line([1, 1, 1], [4, 1, 7], "a");
    if (!isTwoPoint(p)) throw new Error("not two-point");
    expect(withCorner(p, "b", [9, 1, 9])).toMatchObject({
      a: [1, 1, 1],
      b: [9, 1, 9],
      active: "b",
    });
    expect(withCorner(p, "a", [0, 0, 0])).toMatchObject({
      a: [0, 0, 0],
      b: [4, 1, 7],
      active: "a",
    });
  });

  it("the size is the corners' box, one block when only A is set", () => {
    expect(pendingSize(line([1, 1, 1], null, "a"), null)).toEqual([1, 1, 1]);
    expect(pendingSize(line([1, 1, 1], [5, 1, 3]), null)).toEqual([5, 1, 3]);
    expect(pendingSize({ kind: "cell", tool: "place", cell: [0, 0, 0] }, null)).toEqual([1, 1, 1]);
    expect(pendingSize({ kind: "paste", at: [0, 0, 0] }, [3, 2, 4])).toEqual([3, 2, 4]);
  });
});

describe("nudgeCells and shiftPending", () => {
  it("a line or selection moves its active corner and keeps the other", () => {
    const p = line([1, 1, 1], [4, 1, 7], "b");
    expect(nudgeCells(p, 2, null)).toEqual({
      moving: [[4, 1, 7]],
      alongside: [],
      fixed: [[1, 1, 1]],
    });
    expect(shiftPending(p, 2, 1)).toMatchObject({ a: [1, 1, 1], b: [4, 1, 8], active: "b" });
    const q = line([1, 1, 1], [4, 1, 7], "a");
    expect(nudgeCells(q, 0, null)).toEqual({
      moving: [[1, 1, 1]],
      alongside: [],
      fixed: [[4, 1, 7]],
    });
    expect(shiftPending(q, 0, -1)).toMatchObject({ a: [0, 1, 1], b: [4, 1, 7], active: "a" });
  });

  it("with only A set, A moves and nothing is fixed", () => {
    const p = line([1, 1, 1], null, "a");
    expect(nudgeCells(p, 1, null)).toEqual({ moving: [[1, 1, 1]], alongside: [], fixed: [] });
    expect(shiftPending(p, 1, 1)).toMatchObject({ a: [1, 2, 1], b: null });
  });

  it("a rectangle moved along its normal moves whole, one layer", () => {
    const p = rect([1, 1, 1], [4, 1, 7], 1, "b");
    expect(nudgeCells(p, 1, null)).toEqual({
      moving: [
        [1, 1, 1],
        [4, 1, 7],
      ],
      alongside: [],
      fixed: [],
    });
    expect(shiftPending(p, 1, 1)).toMatchObject({ a: [1, 2, 1], b: [4, 2, 7] });
    expect(shiftPending(p, 1, -1)).toMatchObject({ a: [1, 0, 1], b: [4, 0, 7] });
  });

  it("a rectangle moved along another axis moves only the active corner, so it stays flat", () => {
    const p = rect([1, 1, 1], [4, 1, 7], 1, "b");
    expect(shiftPending(p, 0, 1)).toMatchObject({ a: [1, 1, 1], b: [5, 1, 7] });
    expect(shiftPending(p, 2, -1)).toMatchObject({ a: [1, 1, 1], b: [4, 1, 6] });
    const onX = rect([2, 1, 1], [2, 4, 7], 0, "b");
    expect(shiftPending(onX, 0, 1)).toMatchObject({ a: [3, 1, 1], b: [3, 4, 7] });
    expect(shiftPending(onX, 1, 1)).toMatchObject({ a: [2, 1, 1], b: [2, 5, 7] });
  });

  it("an armed cell moves", () => {
    const p: Pending = { kind: "cell", tool: "place", cell: [3, 4, 5] };
    expect(nudgeCells(p, 0, null)).toEqual({ moving: [[3, 4, 5]], alongside: [], fixed: [] });
    expect(shiftPending(p, 2, -1)).toEqual({ kind: "cell", tool: "place", cell: [3, 4, 4] });
  });

  it("a paste origin moves, and its far corner counts for the limits", () => {
    const p: Pending = { kind: "paste", at: [3, 4, 5] };
    expect(nudgeCells(p, 0, [3, 2, 4])).toEqual({
      moving: [[3, 4, 5]],
      alongside: [[5, 5, 8]],
      fixed: [],
    });
    expect(shiftPending(p, 1, 1)).toEqual({ kind: "paste", at: [3, 5, 5] });
  });

  it("does not change the value it was given", () => {
    const p = rect([1, 1, 1], [4, 1, 7]);
    const before = JSON.stringify(p);
    shiftPending(p, 1, 1);
    expect(JSON.stringify(p)).toBe(before);
  });
});

describe("describePending", () => {
  it("an armed cell: where, and the block", () => {
    expect(describePending({ kind: "cell", tool: "place", cell: [3, 1, 3] }, ctx)).toBe(
      "Place 3,1,3 stone",
    );
    expect(describePending({ kind: "cell", tool: "paint", cell: [3, 0, 3] }, ctx)).toBe(
      "Replace 3,0,3 oak_planks → stone",
    );
    expect(describePending({ kind: "cell", tool: "erase", cell: [3, 0, 3] }, ctx)).toBe(
      "Erase 3,0,3 oak_planks",
    );
    expect(describePending({ kind: "cell", tool: "erase", cell: [3, 5, 3] }, ctx)).toBe(
      "Erase 3,5,3 air",
    );
  });

  it("corners: A and B, the active one marked, and the size", () => {
    expect(describePending(line([1, 1, 1], [5, 1, 3], "b"), ctx)).toBe("A 1,1,1 ▸B 5,1,3 · 5×1×3");
    expect(describePending(line([1, 1, 1], [5, 1, 3], "a"), ctx)).toBe("▸A 1,1,1 B 5,1,3 · 5×1×3");
    expect(describePending(line([1, 1, 1], null, "a"), ctx)).toBe("▸A 1,1,1 B — · 1×1×1");
  });

  it("a paste: the origin and the size of the copied box", () => {
    expect(describePending({ kind: "paste", at: [2, 3, 4] }, ctx)).toBe("Paste at 2,3,4 · 3×2×4");
    expect(describePending({ kind: "paste", at: [2, 3, 4] }, { ...ctx, clipSize: null })).toBe(
      "Paste at 2,3,4",
    );
  });
});
