---
name: voxwright
description: Design and generate Minecraft builds programmatically and export them as schematics. Use when asked to build, generate, design or change a Minecraft structure, house, castle, tower, terrain or any other 3D voxel build, or to create, inspect or preview .schem (WorldEdit, Sponge), .litematic (Litematica), .nbt (structure block) or .mcstructure (Bedrock) files.
---

<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# Voxwright

Build Minecraft structures by writing a short TypeScript recipe and running it with the bundled
command line. The CLI runs the recipe headlessly, checks every block against the block registry
of the Minecraft version, and writes `.schem`, `.litematic`, `.nbt` or `.mcstructure`. A browser
viewer and editor lets the user look at the result in 3D and fix details by hand.

## Setup

- `<skill-dir>` below is the directory that holds this file. Use its absolute path.
- The CLI is one file, `<skill-dir>/scripts/voxwright-cli.mjs`. It needs Node 22.18 or later and
  nothing else: do not run `npm install`, do not build anything, do not reinstall the skill.
- Write recipes and outputs in the user's project (for example `minecraft-builds/<name>/`), never
  inside `<skill-dir>`.

## Workflow

1. **Plan the build.** Settle the footprint, the height and a palette of 4 to 8 blocks before
   writing code. For anything beyond a simple box, read the build-patterns guide for techniques
   (depth, palettes, roof shapes, detailing). It is online, not part of the installed skill:
   https://github.com/lzif/voxwright/blob/main/packages/mcbuilder/docs/build-patterns.md
2. **Write the recipe**, an ES module that exports a `Build`:

   ```ts
   import { Build } from "voxwright";

   export const BUILD = new Build({ seed: 7 });

   BUILD.scope(() => {
     BUILD.box([0, 0, 0], [8, 0, 6], "minecraft:cobblestone");
     BUILD.walls([0, 1, 0], [8, 4, 6], "minecraft:oak_planks");
     BUILD.roofGable([-1, 5, -1], [9, 5, 7], "minecraft:spruce_stairs", { ridge: "x" });
   });
   ```

   Start from the closest example in [references/recipe-examples.md](references/recipe-examples.md).
   Look up every call you are not sure of in [references/builder-api.md](references/builder-api.md)
   instead of guessing: the API is small and a call that is not listed there does not exist.
3. **Build it:**

   ```sh
   node <skill-dir>/scripts/voxwright-cli.mjs build house.ts --out out/house.schem
   ```

4. **Read the summary** (see below). If it says `build: FAILED`, fix the recipe and run again.
   Check that the size, the block count and the palette are what you intended.
5. **Report** to the user: the file path, the size, the block count, and any warnings.
6. **Preview** when the user wants to see or edit the build (see [Preview](#preview)).

Change the recipe and run `build` again to iterate; it overwrites its outputs.

## Recipe rules

- `+X` is east, `+Y` is up, `+Z` is south. Coordinates are integers, corners are inclusive.
- Every placement goes inside `BUILD.scope(() => { ... })`.
- Import only from `"voxwright"` and from your own files by relative path.
- Blocks are full ids with the `minecraft:` namespace, with properties where the look depends on
  them: `minecraft:oak_stairs[facing=east,half=top]`. The engine places exactly what you write: it
  does not connect fences, panes or walls and does not pick stair corners. Rules, value sets and a
  lookup command for any block are in [references/block-states.md](references/block-states.md).
- Leaves need `persistent=true`. Doors, beds and tall plants need both halves.
- Use `BUILD.rng("name")` for randomness, never `Math.random()`.
- The last write to a cell wins: place masses first, then openings (`carve`), then details.

## Commands

### build

```sh
node <skill-dir>/scripts/voxwright-cli.mjs build <recipe> --out <path> [options]
```

| Option                 | Meaning                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `--out <path>`         | File to write. Repeat it to write several formats in one run.                                                           |
| `--format <f>`         | `schem`, `litematic`, `nbt` or `mcstructure`. Default: the extension of `--out`.                                        |
| `--mc-version <v>`     | Minecraft version (default `26.2`, or `mc_version` from an `mcbuild.toml` next to the recipe; also `26.1`, `1.21.11`, `1.21.4`, `1.21.1`). |
| `--json`               | Print the summary as one JSON document.                                                                                 |
| `--offline`            | Do not download the block registry.                                                                                     |
| `--allow <block>`      | Accept a modded block name (or set `allowlist` in an `mcbuild.toml` next to the recipe). Repeatable.                    |
| `--name`, `--author`   | `.litematic` metadata.                                                                                                  |
| `--schem-version 2\|3` | Sponge schematic version (default 3).                                                                                   |
| `--air <mode>`         | `.nbt` only: `none` (default), `explicit` or `all`.                                                                     |

Pick the format from what the user will load it with: `.schem` for WorldEdit and
FastAsyncWorldEdit, `.litematic` for Litematica, `.nbt` for vanilla structure blocks,
`.mcstructure` for Bedrock Edition. When the user has not said, ask or write `.schem` and
`.litematic` together:

```sh
node <skill-dir>/scripts/voxwright-cli.mjs build house.ts --out out/house.schem --out out/house.litematic
```

The summary:

```text
build: OK
recipe: /home/me/minecraft-builds/house/house.ts
size: 11×10×9 (X×Y×Z)
bounds: -1,0,-1 to 9,9,7
blocks: 274
block states: 4
minecraft: 26.2 (DataVersion 4903)
validation: 26.2 registry, 0 errors
palette:
  112 minecraft:oak_planks
   63 minecraft:cobblestone
   55 minecraft:spruce_stairs[facing=north,half=bottom]
   44 minecraft:spruce_stairs[facing=south,half=bottom]
wrote:
  /home/me/minecraft-builds/house/out/house.schem (schem, 287 bytes)
```

- Exit code 0: written. Exit code 1: the recipe threw, validation failed or the export failed,
  and **nothing was written**. Exit code 2: wrong command line.
- `errors:` lists unknown blocks (with did-you-mean names), unknown properties and illegal values
  (with the legal ones), each ending with the recipe position that placed the block
  `(at file:line:col)`. Fix every one; do not work around the validator.
- `warnings:` lists things that did not stop the build: what a format could not carry (always
  read these for `.mcstructure`), non-deterministic code, or
  `validation skipped: ...` when no registry was available. A build with skipped validation is
  unchecked: say so in your report.
- A recipe that throws is reported as one line with its position, for example
  `error in house.ts: placements must be inside build.scope(...) (at house.ts:12:9)`.
- The first `build` for a Minecraft version downloads its block registry (about 120 kB) into
  `~/.cache/mcbuilder/`. Without network access the build is still exported, unvalidated.

### inspect

```sh
node <skill-dir>/scripts/voxwright-cli.mjs inspect <schematic> [--json]
```

Prints what a `.schem`, `.litematic`, `.nbt` or `.mcstructure` file holds: format and version,
DataVersion, size, block count, block entities, entities, metadata and the palette with counts.
Use it to check a file you wrote, or to understand a schematic the user gives you.

### preview (or view)

```sh
node <skill-dir>/scripts/voxwright-cli.mjs preview <schematic-or-run> [--port <n>] [--no-open]
```

Starts a local server with the 3D viewer and editor and the schematic open in it (`view` is an
alias, and the target may also be a `run` directory or run id such as `preview 1`), prints
`Preview URL: http://127.0.0.1:4173/...`, and opens that address in the default browser.

- The command runs until it is stopped. Start it in the background, read the `Preview URL` line
  from its output and give that address to the user.
- Pass `--no-open` when there is no desktop browser to open (a remote or headless machine).
- The file is read again on every page load: after another `build`, tell the user to refresh.
- In the page the user can turn and fly through the build, limit it to a range of layers, click
  a block to see and change its state, place and erase blocks, and export the edited build in any
  of the four formats. Edits live in the browser: if the user changed the build there, ask for
  the exported file before continuing, and `inspect` it.
- The viewer comes from the published site through a caching proxy on localhost (first use needs
  network access), or from a local build of `apps/web` when the skill runs inside a clone of the
  repository that has one.
  The schematic is served from this machine either way and is not uploaded.

### run --preview (PNG views)

```sh
node <skill-dir>/scripts/voxwright-cli.mjs run <recipe> --preview [--views 'iso;top'] [--out <dir>]
```

Writes `<dir>/run-NNN/previews_faithful/<view>.png` (default `dist/`), drawn with the game's
textures, next to a `report.json` and an `.nbt`. Open the PNGs to check the look of a build
yourself before reporting, when you can read images. Views, separated by semicolons: `iso`,
`top`, `az<ddd>_el<dd>` (for example `az225_el025`), `orbit<n>_el<dd>`. The first preview
downloads the game's block models and textures (about 25 MB, into `~/.cache/mcbuilder/`); without
network access blocks are drawn as plain cubes.

## References

- [references/builder-api.md](references/builder-api.md): every method, option and default of the
  recipe API, coordinates, materials, `Geometry`, rotation, errors, and what does not exist.
- [references/block-states.md](references/block-states.md): block id and property rules, the
  properties that matter for builds, rotation and mirroring, versions, per-format caveats.
- [references/recipe-examples.md](references/recipe-examples.md): three complete recipes (a
  tower, terrain with a pond, a symmetric pavilion) and a pre-run checklist.
- [build-patterns.md](https://github.com/lzif/voxwright/blob/main/packages/mcbuilder/docs/build-patterns.md):
  design techniques for builds that look good. Online, not part of the installed skill.
- [examples](https://github.com/lzif/voxwright/tree/main/packages/mcbuilder/examples): larger
  recipes. Online; inside a clone of the repository they run with the same `build` command.
