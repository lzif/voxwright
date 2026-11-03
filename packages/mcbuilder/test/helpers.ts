// SPDX-License-Identifier: AGPL-3.0-only
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RotationError } from "@voxwright/core";
import { expect } from "vitest";
import {
  BuildError,
  GridBoundsError,
  type Material,
  McbuilderError,
  patches,
} from "../src/index.ts";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

export function loadVector<T>(name: string): T {
  return JSON.parse(readFileSync(`${repoRoot}vectors/${name}`, "utf8")) as T;
}

type Entry = string | [string, number];
export type MaterialSpec =
  | string
  | { palette: Entry[] }
  | { patches: { palette: Entry[]; scale?: number; salt?: string } }
  | { checker: [string, string] };

/** Build a material from the descriptors the vector exporter writes. */
export function material(d: MaterialSpec): Material {
  if (typeof d === "string") return d;
  if ("palette" in d) return d.palette;
  if ("patches" in d)
    return patches(d.patches.palette, { scale: d.patches.scale, salt: d.patches.salt });
  const [a, b] = d.checker;
  return (x, y, z) => ((((x + y + z) % 2) + 2) % 2 === 0 ? a : b);
}

/** Assert that `fn` throws the TypeScript counterpart of a Python error class. */
export function expectError(fn: () => unknown, pythonClass: string): void {
  let caught: unknown;
  try {
    fn();
  } catch (e) {
    caught = e;
  }
  expect(caught, `expected ${pythonClass}`).toBeDefined();
  switch (pythonClass) {
    case "GridBoundsError":
      expect(caught).toBeInstanceOf(GridBoundsError);
      break;
    case "BuildError":
      expect(caught).toBeInstanceOf(BuildError);
      break;
    case "McbuilderError":
      // Rotation names are checked in core, which has its own error class.
      expect(caught instanceof McbuilderError || caught instanceof RotationError).toBe(true);
      break;
    case "TypeError":
      expect(caught).toBeInstanceOf(TypeError);
      break;
    case "ValueError":
      expect((caught as Error).name).toBe("BlockStringError");
      break;
    default:
      throw new Error(`unmapped Python error ${pythonClass}`);
  }
}
