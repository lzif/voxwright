// SPDX-License-Identifier: AGPL-3.0-only

// Loading a builder script and the facts both command lines report about it.
// Shared by `mcbuild` (cli.ts) and the skill CLI (skill/); kept free of the
// renderer so the skill bundle does not pull it in.

import { stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Build } from "../build.ts";
import { McbuilderError } from "../errors.ts";
import type { VoxelGrid } from "../voxels.ts";

/** A builder script that is missing, throws while loading, or exports no `Build`. */
export class ScriptError extends McbuilderError {
  /** What the script threw, when it threw. */
  readonly thrown: unknown;

  constructor(message: string, thrown?: unknown) {
    super(message);
    this.thrown = thrown;
  }
}

export const exists = (p: string): Promise<boolean> =>
  stat(p).then(
    () => true,
    () => false,
  );

/** Import a builder script and return its exported `BUILD` (or default export). */
export async function loadScript(path: string): Promise<Build> {
  const abs = resolve(path);
  if (!(await exists(abs))) throw new ScriptError(`no such script: ${path}`);
  let mod: Record<string, unknown>;
  try {
    mod = (await import(`${pathToFileURL(abs).href}?t=${Date.now()}`)) as Record<string, unknown>;
  } catch (e) {
    const where = locateInRecipe(e, abs);
    const at = where === null ? "" : ` (at ${where})`;
    throw new ScriptError(
      `error in ${basename(path)}: ${e instanceof Error ? e.message : String(e)}${at}`,
      e,
    );
  }
  const build = mod.BUILD ?? mod.default;
  if (!(build instanceof Build)) {
    throw new ScriptError(
      `${basename(path)} must export a Build as BUILD (export const BUILD = new Build(...))`,
    );
  }
  return build;
}

/** Warn on raw randomness: `Build({ seed })` is the one source (`build.rng()`). */
export function scanDeterminism(source: string, filename: string): string[] {
  const hint = "use BUILD.rng() (from new Build({ seed })) for deterministic randomness";
  const checks: [RegExp, string][] = [
    [/\bMath\.random\s*\(/, "uses 'Math.random'"],
    [/\bDate\.now\s*\(|\bnew\s+Date\s*\(/, "uses the current time"],
    [/\bcrypto\.(randomUUID|getRandomValues|randomInt|randomBytes)\b/, "uses 'crypto' randomness"],
  ];
  const out: string[] = [];
  for (const [re, what] of checks) if (re.test(source)) out.push(`${filename}: ${what} — ${hint}`);
  return out;
}

type Dense = ReturnType<Build["grid"]["toDense"]>;

/** Non-air block state -> number of cells, from a dense volume. */
export function blockCounts(dense: Dense): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const v of dense.data) {
    if (v < 0) continue;
    const name = dense.palette[v] as string;
    if (name === "minecraft:air") continue;
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
}

/** Size of the non-air bounding box, or of the dense volume when nothing solid was placed. */
export function dimensions(build: Build, dense: Dense): [number, number, number] {
  const b = build.grid.bounds();
  if (b === null) return [...dense.size] as [number, number, number];
  return [b[1][0] - b[0][0] + 1, b[1][1] - b[0][1] + 1, b[1][2] - b[0][2] + 1];
}

/** `file:line:column` inside the recipe where `thrown` came from, if its stack says so. */
export function locateInRecipe(thrown: unknown, recipe: string): string | null {
  const stack = thrown instanceof Error ? (thrown.stack ?? "") : "";
  for (const prefix of [pathToFileURL(recipe).href, recipe]) {
    let from = 0;
    for (;;) {
      const at = stack.indexOf(prefix, from);
      if (at === -1) break;
      const m = /^(?:\?[^\s:)]*)?:(\d+)(?::(\d+))?/.exec(stack.slice(at + prefix.length));
      if (m) return `${basename(recipe)}:${m[1]}${m[2] === undefined ? "" : `:${m[2]}`}`;
      from = at + prefix.length;
    }
  }
  return null;
}

/** The script line that first placed `block`, as `file:line:column`, or `null`. */
export function placedAt(grid: VoxelGrid, block: string, recipe: string): string | null {
  const first = grid.firstPlaced.get(block);
  return first === undefined ? null : locateInRecipe(first, resolve(recipe));
}
