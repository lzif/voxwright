<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Voxwright

Voxwright is a programmatic Minecraft build engine and an Agent Skill. An AI agent writes a
short TypeScript recipe; Voxwright runs it headlessly, validates every block against the block
registry of the Minecraft version, and exports `.schem`, `.litematic`, `.nbt` or `.mcstructure`.
A browser 3D viewer and editor lets you inspect what the agent built and fix details by hand
before the build goes into your world.

The engine is a TypeScript port of [mcbuilder](https://github.com/lzif/mcbuilder).

Not affiliated with Mojang or Microsoft.

## Quickstart

Install the skill into your agent (Claude Code, Cursor, Codex or any other agent that loads Agent
Skills):

```sh
npx skills install lzif/voxwright
```

Restart or reload the agent so it finds the skill. That is the whole setup: the skill runs on
Node 22.18 or later, with no dependencies to install and nothing to build.

Then ask for a build:

```text
Use voxwright to build a small medieval watchtower with a crenellated top, about 7 blocks wide.
Export it as a .litematic and open the preview.
```

```text
Make a 30x30 patch of hilly terrain with a pond and a few oak trees, as a WorldEdit schematic.
```

```text
Here is my-base.schem. Tell me what blocks it uses and how big it is, then show it to me in 3D.
```

```text
The roof is too flat. Make it steeper, switch the planks to dark oak, and export for Bedrock too.
```

The agent writes a recipe, runs it, reads the validation summary, fixes what the validator
rejects, and hands you the file. When you ask for a preview it starts a local server and gives you
an address: the page shows the build in 3D, and a refresh shows the next version.

## What the skill does

| Step    | Command                                     | Result                                                                                                                     |
| ------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Build   | `voxwright-cli build <recipe> --out <file>` | Runs the recipe, validates block names and block states, writes the schematic                                              |
| Inspect | `voxwright-cli inspect <schematic>`         | Format, DataVersion, size, block count, palette, block entities, entities                                                  |
| Preview | `voxwright-cli preview <schematic>`         | Serves the 3D viewer and editor on localhost with the file open (`view` is an alias; also takes a run directory or run id) |

`voxwright-cli` stands for `node skills/voxwright/scripts/voxwright-cli.mjs` (in an installed
skill, `scripts/voxwright-cli.mjs` of the skill directory): a single committed file, bundled from
`packages/mcbuilder` and `packages/core`, so the installed skill needs no `node_modules`.
Validation uses a version-pinned block registry (default Minecraft 26.2, or `mc_version` and
`allowlist` from an `mcbuild.toml` next to the recipe), downloaded on first use into
`~/.cache/mcbuilder/`. An unknown block, an unknown property or an illegal value stops the build
with a did-you-mean message and the recipe position `(at file:line:col)`, and nothing is written.

### Export formats

| Format         | Loads in                                                  |
| -------------- | --------------------------------------------------------- |
| `.schem`       | WorldEdit, FastAsyncWorldEdit (Sponge schematic v3 or v2) |
| `.litematic`   | Litematica                                                |
| `.nbt`         | Vanilla structure blocks, `/place template`, data packs   |
| `.mcstructure` | Bedrock Edition structure blocks                          |

One run can write several: `--out tower.schem --out tower.litematic`. Java block states are
translated to Bedrock by rule, and whatever a format cannot carry is listed in the summary
instead of being dropped silently.

### A recipe

```ts
import { Build, patches } from "voxwright";

export const BUILD = new Build({ seed: 7 });

const STONE = patches([["minecraft:stone_bricks", 4], "minecraft:mossy_stone_bricks"], {
  scale: 3,
});

BUILD.scope(() => {
  BUILD.box([0, 0, 0], [8, 0, 6], "minecraft:cobblestone");
  BUILD.walls([0, 1, 0], [8, 4, 6], STONE);
  BUILD.carve([4, 1, 6], [4, 2, 6]); // doorway
  BUILD.roofGable([-1, 5, -1], [9, 5, 7], "minecraft:spruce_stairs", { ridge: "x" });
});
```

```sh
node skills/voxwright/scripts/voxwright-cli.mjs build house.ts --out out/house.schem --out out/house.litematic
node skills/voxwright/scripts/voxwright-cli.mjs inspect out/house.schem
node skills/voxwright/scripts/voxwright-cli.mjs preview out/house.litematic
```

A recipe is plain code: loops, functions, seeded randomness, reusable parts placed with rotation.
The same seed always gives the same build. What the agent reads to write one:

- [SKILL.md](skills/voxwright/SKILL.md): the workflow and the command line.
- [references/builder-api.md](skills/voxwright/references/builder-api.md): every method, option and default.
- [references/block-states.md](skills/voxwright/references/block-states.md): block ids, properties, rotation and
  per-format caveats.
- [references/recipe-examples.md](skills/voxwright/references/recipe-examples.md): three complete recipes.
- [packages/mcbuilder/docs/build-patterns.md](packages/mcbuilder/docs/build-patterns.md): building
  techniques, for results that look designed.

All of this works without an agent too. The same command line is on npm:

```sh
npm install -g @voxwright/mcbuild     # or: npx @voxwright/mcbuild <command>
mcbuild init house.ts
mcbuild build house.ts --out house.schem
mcbuild preview house.schem
```

## The browser 3D preview and editor

`apps/web` is the human-in-the-loop half of the workflow: the place where a person looks at a
generated build, checks block placement and block states, fixes what the agent got wrong, and
exports the result. `voxwright-cli preview <file>` opens it with the build loaded (the page
accepts a same-origin `?open=` link). It also works on its own, for any schematic, at
https://luki.is-a.dev/voxwright/.

It is a static SvelteKit site: open a `.nbt`, `.schem`, `.litematic` or
`.mcstructure`, turn it by dragging or fly through it with W A S D, limit it to a
range of layers, and convert it to any of the four formats with a loss report.
Everything runs in your browser; nothing is uploaded.

With a mouse and keyboard the page is also an editor, for the quick fix: open a
generated build, click the wrong block, change it, export. The toolbar above the picture
has Place, Replace (turn the clicked block into the chosen one), Erase, Pick (an
eyedropper), Line, Rectangle (filled or hollow) and Select (a box); with a
selection you can fill it, replace one block with another inside it, copy and
paste it, move it, rotate it 90 degrees or mirror it. A block palette beside the
picture lists the blocks of the texture pack and of the open build, with search
and free typing, and a block-state panel changes properties (facing, half,
waterlogged, ...) of the block you last pointed at. Undo and redo are Ctrl+Z,
Ctrl+Shift+Z (or Ctrl+Y) and the two buttons; a mouse drag is one undo step.
Shortcuts are in the tooltips. The page starts in View, where the mouse only looks
around; with a tool chosen, a plain left click uses the tool, Alt+drag turns the
view, Shift+drag or the right button moves it sideways and the wheel zooms. Tools
work in the Orbit camera, not in Fly. While layers are limited with the slicer,
the mouse tools pick and place only in the visible ones; selection actions (fill,
replace, move, rotate, mirror) act on the whole box, hidden layers included. Edits live in the page: Export writes a new
file (the one you opened is never changed), and the page asks before you leave or
open another file with unexported edits. A browser
without WebGL2 keeps the page a viewer. On a phone or a narrow window the page
switches to a touch layout with the same editor (the offset cursor, the nudge pad,
sheets for blocks, block state and selection, an Undo toast, a quick-start card;
see the [user guide](docs/user-guide.md), section 5, and
[docs/mobile-editor-plan.md](docs/mobile-editor-plan.md)). Drawing uses WebGL2
(`@voxwright/render/webgl`: our own section mesher in a pool of workers, drawn
with three.js); without WebGL2 the page falls back to a software rasterizer in a
worker.

```sh
node packages/mcbuilder/bin/mcbuild.ts assets fetch --version 26.2   # vanilla assets, once
pnpm --filter @voxwright/web assets    # bundle blockstates, models and textures into a local pack
pnpm --filter @voxwright/web dev       # or: build, then serve apps/web/build from any file host
```

The texture pack is built on your machine from Mojang's assets and is
git-ignored; without it the page still works and draws flat colours.
`node apps/web/test/e2e.ts` drives the built site in Chrome: once with WebGL2,
once with the GPU off, once through the editor (real mouse and key events on a
`.litematic`, then the exported file is read back and compared cell by cell), and
once for the release work (footer, autosave, your own resource pack, accessibility
with axe-core, a phone-sized window). `node apps/web/test/touch-e2e.ts` drives the
mobile touch editor in a 390 x 844 touch-emulated viewport (gestures, placement,
selection, block state, the camera, quality, and polish with axe-core on the whole
page); CI runs it after `e2e.ts`, on the same build.
`node apps/web/test/preview-e2e.ts` starts `voxwright-cli preview` on a real schematic and checks
that the page opens it from the link, with WebGL2 and without. Build the site first. `node apps/web/test/perf.ts` and
`node apps/web/scripts/measure.ts` measure a generated 256-wide build.

Guides: the [user guide](docs/user-guide.md) for people using the app, and the
[self-hosting guide](docs/self-hosting.md) for people deploying their own copy.

## Monorepo layout

This is a pnpm monorepo. Workspace members live under `packages/*` and `apps/*` and are marked
`private` in their `package.json`; the command line is published to npm as `@voxwright/mcbuild`
(see Tooling below). The GitHub repository itself is public, and the skill is installed straight
from it.

| Path                 | Role                                                                                                                                                                                                                                                                                                                                             | State               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| `skills/voxwright/`  | The Agent Skill, and all that `npx skills install` copies: `SKILL.md` (when to use the skill, the workflow, the command line), `references/` (the recipe API, block-state rules, complete examples) and `scripts/voxwright-cli.mjs`, the skill CLI as one committed bundle (`pnpm build:skill` regenerates it and CI checks that it is current). | in place            |
| `scripts/`           | Development tools: `build-skill.ts` (the bundler of the skill CLI), `convert` and others.                                                                                                                                                                                                                                                        | in place            |
| `packages/mcbuilder` | The build engine: the TypeScript port of mcbuilder (`Build`, shapes, materials, registry validation), and the source of the `mcbuild` command line (`src/node/`). May depend on `render` and `core`.                                                                                                                                             | in place (see PLAN) |
| `packages/core`      | NBT, block-state strings, rotation, volume, the `.nbt`, `.schem`, `.litematic` and `.mcstructure` codecs, and the editor core (commands, undo, tools, picking). Imports nothing from other workspace members and has no DOM dependency.                                                                                                          | in place            |
| `packages/render`    | Section mesher and CPU rasterizer (DOM-free), and a three.js renderer at `@voxwright/render/webgl`. May depend on `core`.                                                                                                                                                                                                                        | in place            |
| `apps/web`           | The browser 3D viewer, editor and converter (SvelteKit, static): the companion for previewing and refining builds. May depend on `render` and `core`.                                                                                                                                                                                            | M4 built            |
| `vectors/`           | Golden JSON exported from the Python mcbuilder, plus the exporter.                                                                                                                                                                                                                                                                               | in place            |
| `fixtures/`          | Schematic files shared by all tests.                                                                                                                                                                                                                                                                                                             | synthetic and real  |
| `reference/`         | Local, git-ignored clone of upstream mcbuilder, used read-only as an oracle. Never modified or imported.                                                                                                                                                                                                                                         |                     |

Dependencies point one way only; `.dependency-cruiser.cjs` enforces this.

`npx skills install` copies only `skills/voxwright/` (about 570 kB). The engine source, the
larger example recipes and the design notes stay in the repository; the skill links to them.

## Live site and credits

The web app is published at https://lzif.github.io/voxwright/ by `.github/workflows/pages.yml`
(GitHub redirects that address to https://luki.is-a.dev/voxwright/, the custom domain of the
account's Pages site).

Its built-in pack is vanilla Minecraft 26.3: block states, block models and textures, which belong
to Mojang. The workflow takes them from
[InventivetalentDev/minecraft-assets](https://github.com/InventivetalentDev/minecraft-assets/tree/26.3)
(the files behind [mcasset.cloud](https://mcasset.cloud/)) when the site is built; they are not
committed here. Visitors can lay their own pack over it.

## Tooling

- pnpm workspaces (`pnpm-workspace.yaml`)
- TypeScript, strict, ESM only, `verbatimModuleSyntax` (`tsconfig.base.json`)
- Biome for lint and format (`biome.jsonc`)
- Vitest with one project per workspace member (`vitest.config.ts`)
- dependency-cruiser for the dependency rules (`.dependency-cruiser.cjs`)
- GitHub Actions, per path (`.github/workflows/ci.yml`)

- esbuild for the skill bundle (`scripts/build-skill.ts`)

Scripts: `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm test:touch`, `pnpm depcheck`,
`pnpm build:skill` (regenerate `skills/voxwright/scripts/voxwright-cli.mjs` after changing `packages/mcbuilder` or
`packages/core`; `node scripts/build-skill.ts --check` fails when it is stale), `pnpm run licenses`
(licences of the production dependencies of `apps/web`; write `run`, because plain
`pnpm licenses` is pnpm's own command and fails).

The command line is also the npm package `@voxwright/mcbuild`, which is the skill's bundle under
another name (npm refuses the unscoped name `mcbuild` as too similar to `mc-build`). `pnpm pack:npm` assembles it in `dist/npm/mcbuild/`.
To release: set the version in the root `package.json`, run `pnpm build:skill`, commit, and push
a tag `v<version>`; `.github/workflows/npm.yml` publishes it with the `NPM_TOKEN` secret.

## The `mcbuild` command

One command line serves every use. `mcbuild` on npm, `voxwright-cli.mjs` in the skill and
`packages/mcbuilder/bin/mcbuild.ts` in the workspace are the same program with the same commands:
`build`, `inspect` and `preview` (or `view`, above), and the commands ported from the Python tool,
which work with numbered run directories:

```sh
mcbuild init house.ts
mcbuild check house.ts
mcbuild run house.ts                     # dist/run-001/: report.json + house.nbt
mcbuild run house.ts --preview --guide   # also PNG views and a build guide
mcbuild view 1                           # open run-001's schematic in the 3D viewer
mcbuild import build.litematic -o build.ts
mcbuild diff 1 2                         # cells added, removed, replaced + comparison PNG
mcbuild assets fetch --version 26.2      # block registry + vanilla client assets
```

A script exports a `Build` as `BUILD`. The block registry of the version is downloaded into
`~/.cache/mcbuilder/` when first needed; `--offline` keeps a command off the network. `run --preview` writes faithful PNG
previews and `run --guide` a build guide; the fast and trusted preview tiers are not ported, and
`--tier` says so instead of ignoring the flag. `diff` also writes a side-by-side comparison PNG
(`diff-<run-a>-<run-b>.png`) when both runs share a preview view, and `view` is an alias for
`preview` (accepting a schematic file, a run directory, or a run id).

The PNG previews draw with Minecraft's own block states, models and textures. They are downloaded
when first needed (`run --preview`, unless `--offline`) or with `assets fetch`, into
`~/.cache/mcbuilder/<version>/client/`, from
[InventivetalentDev/minecraft-assets](https://github.com/InventivetalentDev/minecraft-assets) (the
files behind [mcasset.cloud](https://mcasset.cloud/)). `assets fetch --from mojang` extracts the
same files from the client jar on Mojang's servers instead. Nothing from either is stored in this
repository or in the npm package.

## Converting a schematic

```sh
node scripts/convert.ts in.schem out.nbt
node scripts/convert.ts in.nbt out.litematic
node scripts/convert.ts in.litematic out.schem --version 2
node scripts/convert.ts in.mcstructure out.nbt
```

Reads and writes Sponge `.schem` (v2 and v3), structure-block `.nbt`,
Litematica `.litematic` and Bedrock `.mcstructure`, chosen by extension. It
prints a loss report. Block entities (chest contents, signs, banners) and
entities are carried between the three Java formats, and kept as they are from
one `.mcstructure` to another; between Java and Bedrock they are not
translated, so they are listed with a count and kind instead. Bedrock block
states are translated by rule: a property the rules do not cover is dropped and
listed rather than guessed. Block names are written as they are apart from two
renames, so an unknown or renamed Bedrock block name passes through without a
report line. The report also lists blocks left out on purpose (`structure_void`,
`structure_block`, `jigsaw`), `cave_air` and `void_air` turned into air, `.schem`
metadata and biomes that are not carried, and a `.litematic` with several regions
(flattened into one; cells where regions overlap are overwritten). A build more
than 512 blocks along an axis is refused, and so is a legacy `.schematic`: re-save
it as `.schem`. A `.schem` keeps its `Offset` and a `.litematic` its name, author and
description when converted to the same format. It runs `.ts` files directly, which
needs a Node release with type stripping (22.18 or later).

## Status

Built:

- Repo foundations: license, editor config, workspace, TypeScript base config,
  Biome, Vitest, dependency-cruiser.
- CI on GitHub (`.github/workflows/ci.yml`), passing on `main`.
- Golden vectors from the Python mcbuilder for the core, the mcbuilder port and
  the renderer (see [vectors/README.md](vectors/README.md)).
- `core`: NBT reader and writer (big and little endian, gzip), block strings,
  rotation, sectioned volume, and codecs for `.nbt`, `.schem`, `.litematic` and
  `.mcstructure`, all tested. A real build saved in three of those formats
  decodes to the same blocks in each, once the Java default properties that
  Bedrock leaves out (such as `waterlogged=false`) are set aside.
- `convert` script between all four formats.
- The Agent Skill in `skills/voxwright/`: `SKILL.md`, the references, and the skill CLI (`build`, `inspect`,
  `preview` / `view`) as a committed zero-dependency bundle, with the web app opening a build from a
  `?open=` link.
- The WebGL viewer (M1), the converter page (M2), the editor (M3), the release
  work (M4: autosave, your own resource pack, the site footer with a source link,
  an accessibility pass, a dependency licence check, and the user and
  self-hosting guides), and the mcbuilder port (M5).

See [PLAN.md](PLAN.md) for what was checked and what was not, and for the places
where the code differs from the v1 spec and what was decided about each.

Not done yet:

- For Bedrock export, the translation rules cover the common build blocks (stairs, slabs, doors,
  trapdoors, beds, pillars, fences, panes, walls, torches, lanterns, leaves and blocks with
  `facing`), not every block in the game. The summary lists each dropped property.
- Block-entity data (chest contents, sign text) and entities cannot be written from a recipe.
- `.schem` files saved by a real tool, and a run on a real phone (the touch editor
  has only been driven by emulated touch so far; `docs/phone-test-checklist.md`
  lists what to try). Luki checked an edited export in Litematica and smooth
  navigation on a real GPU by hand on 2026-11-11; no GPU numbers were recorded.
- The 0.1.0 release: the 0.1.0 version bump and tag (`@voxwright/mcbuild` is on npm at 0.0.3).
- Deferred, not in 0.1.0: the parts catalog (the spec names it, nothing defines it, so it needs a
  definition first) and the fast and trusted preview tiers.
- From the mcbuilder port: archiving the Python repository.

## License

AGPL-3.0-only. See [LICENSE](LICENSE).

Parts of this repository are derived from [mcbuilder](https://github.com/lzif/mcbuilder),
which is MIT-licensed. [NOTICE](NOTICE) names those parts and carries the MIT
license text.
