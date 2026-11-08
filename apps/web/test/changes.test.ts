// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { describeChange, makeChange, TOAST_MS } from "../src/lib/changes.ts";

describe("describeChange", () => {
  it("says what happened and how many blocks, with the right plural", () => {
    expect(describeChange("place", 12)).toBe("Placed 12 blocks");
    expect(describeChange("place", 1)).toBe("Placed 1 block");
    expect(describeChange("erase", 1)).toBe("Erased 1 block");
    expect(describeChange("fill", 27)).toBe("Filled 27 blocks");
    expect(describeChange("replace block", 3)).toBe("Replaced 3 blocks");
    expect(describeChange("replace", 4)).toBe("Replaced 4 blocks");
  });

  it("words the shape tools, the selection actions and a state change", () => {
    expect(describeChange("line", 5)).toBe("Drew a line of 5 blocks");
    expect(describeChange("rectangle", 12)).toBe("Drew a rectangle of 12 blocks");
    expect(describeChange("hollow rectangle", 10)).toBe("Drew a hollow rectangle of 10 blocks");
    expect(describeChange("box", 8)).toBe("Filled 8 blocks");
    expect(describeChange("paste", 14)).toBe("Pasted 14 blocks");
    expect(describeChange("move", 9)).toBe("Moved 9 blocks");
    expect(describeChange("rotate CLOCKWISE_90", 9)).toBe("Rotated 9 blocks");
    expect(describeChange("mirror x", 9)).toBe("Mirrored 9 blocks");
    expect(describeChange("set facing=north", 1)).toBe("Set facing=north on 1 block");
  });

  it("falls back to Changed for a label it does not know", () => {
    expect(describeChange("something new", 2)).toBe("Changed 2 blocks");
  });

  it("never prints a negative or fractional count", () => {
    expect(describeChange("place", -3)).toBe("Placed 0 blocks");
    expect(describeChange("place", 2.6)).toBe("Placed 3 blocks");
  });
});

describe("makeChange", () => {
  it("carries the id, the label, the count and the sentence", () => {
    expect(makeChange(7, "place", 12)).toEqual({
      id: 7,
      label: "place",
      count: 12,
      text: "Placed 12 blocks",
    });
  });

  it("counts at least one block, because an entry in the history changed something", () => {
    expect(makeChange(1, "paste", 0)).toMatchObject({ count: 1, text: "Pasted 1 block" });
  });
});

describe("TOAST_MS", () => {
  it("is about four seconds", () => {
    expect(TOAST_MS).toBe(4000);
  });
});
