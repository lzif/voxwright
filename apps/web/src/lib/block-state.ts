// SPDX-License-Identifier: AGPL-3.0-only

// How the touch block-state sheet draws each property of a block, and which property "Rotate block"
// turns. Core's `blockProperties` knows the value sets of well-known properties only as
// suggestions (it has no block registry), so the classification here goes by what it returns:
// two exact values `true` / `false` make a switch, a known set of words makes chips, a run of
// numbers makes chips (few values) or a stepper (many, or no known range), and everything else is
// free text. No DOM, so it runs under Vitest.

import type { BlockProperty } from "@voxwright/core";

/** A numeric property with this many values or fewer is drawn as chips; more get a stepper. */
export const NUMERIC_CHIPS_MAX = 8;

/** How one property is drawn on touch. */
export type PropertyControl =
  /** A switch: `on` is the current value. */
  | { kind: "boolean"; on: boolean }
  /** One chip per value, the current one pressed. */
  | { kind: "enum"; values: readonly string[] }
  /** Numbers: chips when there are at most `NUMERIC_CHIPS_MAX` known values, else a stepper. */
  | {
      kind: "numeric";
      /** Lowest value. Known from the suggestions; 0 when none are known. */
      min: number;
      /** Highest value, or `null` when the range is not known (the stepper then has no upper end). */
      max: number | null;
      /** The values to draw as chips, or `null` for a stepper. */
      chips: readonly string[] | null;
    }
  /** No suggestions and not a number: shown as text, edited under "Other…". */
  | { kind: "free" };

const WHOLE = /^\d+$/;

/** Decide how a property is drawn. */
export function classifyProperty(p: BlockProperty): PropertyControl {
  const options = p.options;
  if (p.exact && options !== null && options.length === 2) {
    return { kind: "boolean", on: p.value === "true" };
  }
  if (options !== null && options.length > 1) {
    if (options.every((o) => WHOLE.test(o))) {
      const nums = options.map(Number);
      return {
        kind: "numeric",
        min: Math.min(...nums),
        max: Math.max(...nums),
        chips: options.length <= NUMERIC_CHIPS_MAX ? options : null,
      };
    }
    return { kind: "enum", values: options };
  }
  // No suggestions: a plain whole number (level, age, distance, ...) can still be stepped.
  if (WHOLE.test(p.value)) return { kind: "numeric", min: 0, max: null, chips: null };
  return { kind: "free" };
}

/** The value a stepper moves to, or `null` when the step would leave the range. */
export function stepNumeric(
  control: Extract<PropertyControl, { kind: "numeric" }>,
  current: string,
  by: 1 | -1,
): string | null {
  if (!WHOLE.test(current)) return null;
  const next = Number(current) + by;
  if (next < control.min || (control.max !== null && next > control.max)) return null;
  return String(next);
}

// -- Rotate block ----------------------------------------------------------------------------------

/** The horizontal directions in the order a clockwise turn (seen from above) visits them. */
export const FACING_CYCLE = ["north", "east", "south", "west"] as const;
/** The axes in the order "Rotate block" visits them. */
export const AXIS_CYCLE = ["x", "y", "z"] as const;

/** One property change that turns the block. */
export interface RotationStep {
  key: "facing" | "axis";
  value: string;
}

/** The next value after `current` in `cycle`, skipping values `allowed` refuses; `null` if none is left. */
function nextInCycle(
  cycle: readonly string[],
  current: string,
  allowed: (v: string) => boolean,
): string | null {
  const at = cycle.indexOf(current);
  if (at < 0) return null;
  for (let i = 1; i < cycle.length; i++) {
    const v = cycle[(at + i) % cycle.length] as string;
    if (allowed(v)) return v;
  }
  return null;
}

/**
 * The change one press of "Rotate block" makes, or `null` when the block cannot be rotated.
 *
 * A block with `facing` turns clockwise north, east, south, west, north. Only the horizontal
 * values are in the cycle: a block whose facing is `up` or `down` does not rotate, and such values
 * are never chosen. When the suggestions for the property are an exact list the cycle skips the
 * directions that list does not contain (core has no registry, so for the well-known facing sets
 * this means all four). A block with `axis` and no horizontal `facing` goes x, y, z, x.
 */
export function rotationStep(props: readonly BlockProperty[]): RotationStep | null {
  const facing = props.find((p) => p.key === "facing");
  if (facing !== undefined) {
    const known = facing.options;
    const next = nextInCycle(
      FACING_CYCLE,
      facing.value,
      (v) => known === null || known.includes(v),
    );
    if (next !== null) return { key: "facing", value: next };
  }
  const axis = props.find((p) => p.key === "axis");
  if (axis !== undefined) {
    const known = axis.options;
    const next = nextInCycle(AXIS_CYCLE, axis.value, (v) => known === null || known.includes(v));
    if (next !== null) return { key: "axis", value: next };
  }
  return null;
}
