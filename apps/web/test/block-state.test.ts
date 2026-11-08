// SPDX-License-Identifier: AGPL-3.0-only

// How the touch block-state sheet classifies the properties core suggests values for, the numeric
// stepper, and the facing / axis cycle behind "Rotate block".

import { type BlockProperty, blockProperties } from "@voxwright/core";
import { describe, expect, it } from "vitest";
import {
  classifyProperty,
  NUMERIC_CHIPS_MAX,
  type PropertyControl,
  rotationStep,
  stepNumeric,
} from "../src/lib/block-state.ts";

const prop = (
  key: string,
  value: string,
  options: string[] | null,
  exact = false,
): BlockProperty => ({
  key,
  value,
  options,
  exact,
});
/** The classification of one property of a real block string, through core's own suggestions. */
const of = (state: string, key: string): PropertyControl => {
  const p = blockProperties(state).find((q) => q.key === key);
  if (p === undefined) throw new Error(`no ${key} in ${state}`);
  return classifyProperty(p);
};

describe("classifyProperty", () => {
  it("makes a switch of every exact true / false", () => {
    expect(of("minecraft:oak_door[open=true]", "open")).toEqual({ kind: "boolean", on: true });
    expect(of("minecraft:oak_door[open=false]", "open")).toEqual({ kind: "boolean", on: false });
    expect(of("minecraft:oak_stairs[waterlogged=false]", "waterlogged")).toEqual({
      kind: "boolean",
      on: false,
    });
    expect(of("minecraft:lever[powered=true]", "powered")).toEqual({ kind: "boolean", on: true });
    // Any property name: it is the values that decide.
    expect(of("minecraft:thing[anything=true]", "anything")).toEqual({ kind: "boolean", on: true });
  });

  it("makes chips of the words core suggests", () => {
    expect(of("minecraft:oak_stairs[facing=north]", "facing")).toEqual({
      kind: "enum",
      values: ["north", "east", "south", "west"],
    });
    expect(of("minecraft:oak_stairs[half=top]", "half")).toEqual({
      kind: "enum",
      values: ["top", "bottom"],
    });
    expect(of("minecraft:oak_door[half=upper]", "half")).toEqual({
      kind: "enum",
      values: ["upper", "lower"],
    });
    expect(of("minecraft:oak_log[axis=y]", "axis")).toEqual({
      kind: "enum",
      values: ["x", "y", "z"],
    });
    expect(of("minecraft:oak_slab[type=bottom]", "type")).toEqual({
      kind: "enum",
      values: ["top", "bottom", "double"],
    });
    const shape = of("minecraft:oak_stairs[shape=straight]", "shape");
    expect(shape.kind).toBe("enum");
    expect(shape.kind === "enum" && shape.values).toHaveLength(5);
  });

  it("offers all six faces for a block that faces up or down", () => {
    expect(of("minecraft:hopper[facing=down]", "facing")).toEqual({
      kind: "enum",
      values: ["north", "east", "south", "west", "up", "down"],
    });
  });

  it("makes a stepper of a long numeric range", () => {
    expect(of("minecraft:oak_sign[rotation=3]", "rotation")).toEqual({
      kind: "numeric",
      min: 0,
      max: 15,
      chips: null,
    });
    expect(of("minecraft:redstone_wire[power=7]", "power")).toEqual({
      kind: "numeric",
      min: 0,
      max: 15,
      chips: null,
    });
  });

  it("makes chips of a numeric range of eight values or fewer", () => {
    const eight = Array.from({ length: NUMERIC_CHIPS_MAX }, (_, i) => String(i));
    expect(classifyProperty(prop("age", "3", eight))).toEqual({
      kind: "numeric",
      min: 0,
      max: 7,
      chips: eight,
    });
    const nine = [...eight, "8"];
    expect(classifyProperty(prop("age", "3", nine))).toEqual({
      kind: "numeric",
      min: 0,
      max: 8,
      chips: null,
    });
    expect(classifyProperty(prop("layers", "2", ["1", "2", "3"]))).toEqual({
      kind: "numeric",
      min: 1,
      max: 3,
      chips: ["1", "2", "3"],
    });
  });

  it("steps a whole number whose range is not known, from 0 with no top", () => {
    expect(of("minecraft:composter[level=3]", "level")).toEqual({
      kind: "numeric",
      min: 0,
      max: null,
      chips: null,
    });
    expect(of("minecraft:wheat[age=5]", "age")).toEqual({
      kind: "numeric",
      min: 0,
      max: null,
      chips: null,
    });
  });

  it("leaves everything else as free text", () => {
    expect(of("minecraft:thing[color=blue]", "color")).toEqual({ kind: "free" });
    expect(of("minecraft:thing[facing=sideways]", "facing")).toEqual({ kind: "free" });
    expect(classifyProperty(prop("note", "", null))).toEqual({ kind: "free" });
  });

  it("does not make chips of a single suggestion", () => {
    expect(classifyProperty(prop("x", "a", ["a"]))).toEqual({ kind: "free" });
  });
});

describe("stepNumeric", () => {
  const stepper = { kind: "numeric", min: 0, max: 15, chips: null } as const;
  it("moves by one inside the range", () => {
    expect(stepNumeric(stepper, "3", 1)).toBe("4");
    expect(stepNumeric(stepper, "3", -1)).toBe("2");
    expect(stepNumeric(stepper, "9", 1)).toBe("10");
  });
  it("stops at both ends", () => {
    expect(stepNumeric(stepper, "0", -1)).toBeNull();
    expect(stepNumeric(stepper, "15", 1)).toBeNull();
    expect(stepNumeric({ ...stepper, min: 1, max: 3 }, "1", -1)).toBeNull();
  });
  it("has no top when the range is not known, and still no minus", () => {
    const open = { kind: "numeric", min: 0, max: null, chips: null } as const;
    expect(stepNumeric(open, "40", 1)).toBe("41");
    expect(stepNumeric(open, "0", -1)).toBeNull();
  });
  it("refuses a value that is not a number", () => {
    expect(stepNumeric(stepper, "x", 1)).toBeNull();
  });
});

describe("rotationStep", () => {
  const props = (state: string): BlockProperty[] => blockProperties(state);

  it("turns facing clockwise: north, east, south, west, north", () => {
    const seen: string[] = [];
    let facing = "north";
    for (let i = 0; i < 5; i++) {
      const step = rotationStep(props(`minecraft:oak_stairs[facing=${facing},half=bottom]`));
      expect(step?.key).toBe("facing");
      facing = step?.value ?? "";
      seen.push(facing);
    }
    expect(seen).toEqual(["east", "south", "west", "north", "east"]);
  });

  it("turns axis x, y, z, x", () => {
    const seen: string[] = [];
    let axis = "x";
    for (let i = 0; i < 4; i++) {
      const step = rotationStep(props(`minecraft:oak_log[axis=${axis}]`));
      expect(step?.key).toBe("axis");
      axis = step?.value ?? "";
      seen.push(axis);
    }
    expect(seen).toEqual(["y", "z", "x", "y"]);
  });

  it("leaves up and down out of the cycle: such a block does not rotate", () => {
    expect(rotationStep(props("minecraft:observer[facing=up]"))).toBeNull();
    expect(rotationStep(props("minecraft:hopper[facing=down]"))).toBeNull();
  });

  it("skips directions the suggested set does not contain", () => {
    // A block whose known facing values lack south: east goes straight to west.
    const restricted = [prop("facing", "east", ["north", "east", "west"])];
    expect(rotationStep(restricted)).toEqual({ key: "facing", value: "west" });
    // Only the current value is allowed: nothing to turn to.
    expect(rotationStep([prop("facing", "north", ["north"])])).toBeNull();
  });

  it("prefers facing over axis and falls back to axis when facing cannot turn", () => {
    expect(
      rotationStep([prop("axis", "y", ["x", "y", "z"]), prop("facing", "north", null)]),
    ).toEqual({
      key: "facing",
      value: "east",
    });
    expect(rotationStep([prop("facing", "up", null), prop("axis", "z", ["x", "y", "z"])])).toEqual({
      key: "axis",
      value: "x",
    });
  });

  it("is null for a block with neither, or with no properties", () => {
    expect(rotationStep(props("minecraft:stone"))).toBeNull();
    expect(rotationStep(props("minecraft:oak_door[open=true,powered=false]"))).toBeNull();
  });
});
