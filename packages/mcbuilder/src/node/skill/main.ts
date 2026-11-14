// SPDX-License-Identifier: AGPL-3.0-only

// The command line: `mcbuild` on npm, `skills/voxwright/scripts/voxwright-cli.mjs` in the skill.
// `build`, `inspect` and `preview` live here; `init`, `check`, `run`, `import`, `diff` and
// `assets` are the commands of `../cli.ts`, reached through the same program.
//
// This module is two things at once. Run as a program it is the command line.
// Imported, it is the library a recipe uses: the CLI maps the bare specifiers
// `voxwright`, `@voxwright/mcbuilder` and `@voxwright/core` to this very
// module, so a recipe gets the same `Build` class the CLI checks with
// `instanceof`, from any directory and without `node_modules`.
//
// For that to work the module must finish evaluating before a recipe is
// imported: no top-level await here, and the CLI starts only when this file is
// the process entry point.

import { realpathSync } from "node:fs";
import * as nodeModule from "node:module";
import { homedir } from "node:os";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import { McbuilderError } from "../../errors.ts";
import type { HttpGet } from "../assets.ts";
import { RUN_COMMANDS, RUN_SYNTAX, runCli } from "../cli.ts";
import { BUILD_USAGE, cmdBuild } from "./build.ts";
import { PROG, VERSION } from "./common.ts";
import { cmdInspect, INSPECT_USAGE } from "./inspect.ts";
import { SkillCliError, type SkillIo } from "./io.ts";
import { cmdPreview, PREVIEW_USAGE } from "./preview.ts";

// The library facade: everything a recipe may import from "voxwright".
export * from "@voxwright/core";
export * from "../../index.ts";

/** Replaced by `true` when the bundle is built (scripts/build-skill.ts). */
declare const __VOXWRIGHT_BUNDLED__: boolean | undefined;
const BUNDLED = typeof __VOXWRIGHT_BUNDLED__ !== "undefined" && __VOXWRIGHT_BUNDLED__ === true;

export const USAGE = `Usage: ${PROG} <command> [options]

Commands:
  build <recipe> --out <path>   run a recipe, validate it and write a schematic
  inspect <schematic>           print what a schematic file holds
  preview <schematic>           serve the 3D viewer and editor with the file open

  ${PROG} <command> --help      options of one of the three commands above
  ${PROG} --version

Run directories, PNG previews and import:
  init      write a starter recipe
  check     validate a recipe without writing anything
  run       write a numbered run directory: report.json, the .nbt, and with
            --preview PNG views, with --guide a build guide
  import    turn a schematic into a recipe
  diff      compare two run directories
  assets    download the block registry and the client assets the PNG views need

${RUN_SYNTAX.split("\n")
  .map((l) => (l.startsWith(" ") ? `    ${l.trimStart()}` : `  ${PROG} ${l}`))
  .join("\n")}

A recipe is an ES module (.ts, .mts, .mjs, .js) that exports a Build:

  import { Build } from "voxwright";
  export const BUILD = new Build({ seed: 1 });
  BUILD.scope(() => {
    BUILD.box([0, 0, 0], [4, 0, 4], "minecraft:stone_bricks");
  });

Formats: .schem, .litematic, .nbt, .mcstructure.
Exit codes: 0 success, 1 failure, 2 usage error.`;

const MIN_NODE = "22.18";

/** One line saying why this Node cannot run the CLI, or `null`. */
export function nodeProblem(recipe?: string): string | null {
  const found = `found ${process.version}`;
  if (typeof (nodeModule as { registerHooks?: unknown }).registerHooks !== "function") {
    return `Node ${MIN_NODE} or later is required (${found})`;
  }
  const ts =
    recipe !== undefined && [".ts", ".mts", ".cts"].includes(extname(recipe).toLowerCase());
  if (ts && !(process.features as { typescript?: unknown }).typescript) {
    return `TypeScript recipes need Node ${MIN_NODE} or later (${found}); upgrade Node or write the recipe as .mjs`;
  }
  return null;
}

/** The source entry points of the engine, as a recipe inside the repository may import them. */
const ENGINE_SOURCE = /\/packages\/(?:mcbuilder|core)\/src\/index\.ts(?:\?.*)?$/;

let aliased = false;

/** Make `voxwright` (and the workspace package names) resolve to this module. */
function installAlias(): void {
  if (aliased) return;
  aliased = true;
  // From source the engine's own files import `@voxwright/core` and must keep getting the package.
  const names = new Set(
    BUNDLED
      ? ["voxwright", "@voxwright/mcbuilder", "@voxwright/core"]
      : ["voxwright", "@voxwright/mcbuilder"],
  );
  const self = import.meta.url;
  nodeModule.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (names.has(specifier)) return { url: self, shortCircuit: true };
      const resolved = nextResolve(specifier, context);
      // The repository's own examples import the engine by path (`../../src/index.ts`). In the
      // bundle that source is a second copy of the engine (and needs `node_modules`), so it is
      // this module too.
      if (BUNDLED && ENGINE_SOURCE.test(resolved.url)) return { url: self, shortCircuit: true };
      return resolved;
    },
  });
}

/** Run the CLI. `argv` is everything after the program name. Returns the exit code. */
export async function runSkillCli(
  argv: string[],
  io: Partial<SkillIo> = {},
  deps: { get?: HttpGet } = {},
): Promise<number> {
  const full: SkillIo = {
    out: io.out ?? ((l) => console.log(l)),
    err: io.err ?? ((l) => console.error(l)),
    cwd: io.cwd ?? process.cwd(),
    home: io.home ?? homedir(),
    env: io.env ?? process.env,
  };
  const [command, ...rest] = argv;
  const usageOf: Record<string, string> = {
    build: BUILD_USAGE,
    inspect: INSPECT_USAGE,
    preview: PREVIEW_USAGE,
  };
  try {
    if (command !== undefined && RUN_COMMANDS.includes(command)) {
      return await runCli(argv, full, deps);
    }
    switch (command) {
      case "build":
        return await cmdBuild(rest, full, deps);
      case "inspect":
        return await cmdInspect(rest, full);
      case "preview":
        return await cmdPreview(rest, full);
      case "-h":
      case "--help":
      case "help":
        for (const line of USAGE.split("\n")) full.out(line);
        return 0;
      case "-V":
      case "--version":
        full.out(`${PROG} ${VERSION}`);
        return 0;
      case undefined:
        for (const line of USAGE.split("\n")) full.err(line);
        return 2;
      default:
        full.err(`${PROG}: unknown command '${command}'`);
        for (const line of USAGE.split("\n")) full.err(line);
        return 2;
    }
  } catch (e) {
    if (e instanceof SkillCliError) {
      full.err(`${PROG}: ${e.message}`);
      if (e.exitCode === 2 && command !== undefined && usageOf[command] !== undefined) {
        full.err(`Run '${PROG} ${command} --help' for the options.`);
      }
      return e.exitCode;
    }
    // `parseArgs` reports an unknown or malformed option as a TypeError with one of these codes.
    const code = (e as { code?: unknown } | null)?.code;
    if (typeof code === "string" && code.startsWith("ERR_PARSE_ARGS_")) {
      // Node appends advice about `--` that does not apply here: keep the first sentence.
      full.err(`${PROG}: ${(e as Error).message.split(". ")[0]?.replace(/\.$/, "")}`);
      if (command !== undefined && usageOf[command] !== undefined) {
        full.err(`Run '${PROG} ${command} --help' for the options.`);
      }
      return 2;
    }
    if (e instanceof McbuilderError) {
      full.err(`${PROG}: ${e.message}`);
      return 1;
    }
    throw e;
  }
}

function isEntryPoint(): boolean {
  const script = process.argv[1];
  if (script === undefined) return false;
  try {
    return realpathSync(script) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

/** The program: check Node, install the alias, run the command line, set the exit code. */
export function main(argv: string[] = process.argv.slice(2)): void {
  const problem = nodeProblem(
    ["build", "check", "run"].includes(argv[0] ?? "")
      ? argv.find((a, i) => i > 0 && !a.startsWith("-"))
      : undefined,
  );
  if (problem !== null) {
    console.error(`${PROG}: ${problem}`);
    process.exitCode = 1;
  } else {
    installAlias();
    runSkillCli(argv).then(
      (code) => {
        process.exitCode = code;
      },
      (e: unknown) => {
        console.error(e);
        process.exitCode = 1;
      },
    );
  }
}

if (isEntryPoint()) main();
