<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Voxwright

Voxwright is a browser-based schematic editor for voxel builds, together with a
TypeScript port of [mcbuilder](https://github.com/lzif/mcbuilder).

Not affiliated with Mojang or Microsoft.

## Monorepo layout

This is a private pnpm monorepo. Workspace members live under `packages/*` and
`apps/*`.

| Path                 | Role                                                                                                                                                                                                                                    | State                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `packages/core`      | NBT, block-state strings, rotation, volume, the `.nbt`, `.schem`, `.litematic` and `.mcstructure` codecs, and the editor core (commands, undo, tools, picking). Imports nothing from other workspace members and has no DOM dependency. | in place                 |
| `packages/render`    | Section mesher and CPU rasterizer (DOM-free), and a three.js renderer at `@voxwright/render/webgl`. May depend on `core`.                                                                                                               | in place                 |
| `packages/mcbuilder` | TypeScript port of mcbuilder and the `mcbuild` CLI. May depend on `render` and `core`.                                                                                                                                                  | partly ported (see PLAN) |
| `apps/web`           | The browser viewer, editor and converter (SvelteKit, static). May depend on `render` and `core`.                                                                                                                                        | M4 built                 |
| `vectors/`           | Golden JSON exported from the Python mcbuilder, plus the exporter.                                                                                                                                                                      | in place                 |
| `fixtures/`          | Schematic files shared by all tests.                                                                                                                                                                                                    | synthetic and real       |
| `scripts/`           | Command-line tools, such as `convert`.                                                                                                                                                                                                  | in place                 |
| `reference/`         | Local, git-ignored clone of upstream mcbuilder, used read-only as an oracle. Never modified or imported.                                                                                                                                |                          |

Dependencies point one way only; `.dependency-cruiser.cjs` enforces this.

## The web app

`apps/web` is a static SvelteKit site: open a `.nbt`, `.schem`, `.litematic` or
`.mcstructure`, turn it by dragging or fly through it with W A S D, limit it to a
range of layers, and convert it to any of the four formats with a loss report.
Everything runs in your browser; nothing is uploaded.

With a mouse and keyboard the page is also an editor, for the quick fix: open a
build, click the wrong block, change it, export. The toolbar above the picture
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
open another file with unexported edits. A touch-only device, or a browser
without WebGL2, keeps the page a viewer. Drawing uses WebGL2
(`@voxwright/render/webgl`: our own section mesher in a pool of workers, drawn
with three.js); without WebGL2 the page falls back to a software rasterizer in a
worker.

```sh
node packages/mcbuilder/bin/mcbuild.ts assets fetch --version 26.2   # Mojang's assets, once
pnpm --filter @voxwright/web assets    # bundle blockstates, models and textures into a local pack
pnpm --filter @voxwright/web dev       # or: build, then serve apps/web/build from any file host
```

The texture pack is built on your machine from Mojang's assets and is
git-ignored; without it the page still works and draws flat colours.
`node apps/web/test/e2e.ts` drives the built site in Chrome: once with WebGL2,
once with the GPU off, once through the editor (real mouse and key events on a
`.litematic`, then the exported file is read back and compared cell by cell), and
once for the release work (footer, autosave, your own resource pack, accessibility
with axe-core, a phone-sized window). Build the site first. `node apps/web/test/perf.ts` and
`node apps/web/scripts/measure.ts` measure a generated 256-wide build.

Guides: the [user guide](docs/user-guide.md) for people using the app, and the
[self-hosting guide](docs/self-hosting.md) for people deploying their own copy.

## Tooling

- pnpm workspaces (`pnpm-workspace.yaml`)
- TypeScript, strict, ESM only, `verbatimModuleSyntax` (`tsconfig.base.json`)
- Biome for lint and format (`biome.jsonc`)
- Vitest with one project per workspace member (`vitest.config.ts`)
- dependency-cruiser for the dependency rules (`.dependency-cruiser.cjs`)
- GitHub Actions, per path (`.github/workflows/ci.yml`)

Scripts: `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm depcheck`, `pnpm run licenses`
(licences of the production dependencies of `apps/web`; write `run`, because plain
`pnpm licenses` is pnpm's own command and fails).

## The `mcbuild` command

```sh
node packages/mcbuilder/bin/mcbuild.ts assets fetch --version 26.2   # registry + client assets
node packages/mcbuilder/bin/mcbuild.ts init house.ts
node packages/mcbuilder/bin/mcbuild.ts check house.ts
node packages/mcbuilder/bin/mcbuild.ts run house.ts                  # report.json + house.nbt
node packages/mcbuilder/bin/mcbuild.ts import build.litematic -o build.ts
node packages/mcbuilder/bin/mcbuild.ts diff 1 2                       # cells added, removed, replaced
```

A script exports a `Build` as `BUILD`. `run --preview` writes faithful PNG
previews and `run --guide` a build guide; the fast and trusted preview tiers are
not ported, and `--tier` says so instead of ignoring the flag. `diff` does not
write its comparison image yet, and there is no `view` command. `assets fetch`
downloads the Mojang client jar and the minecraft-data registry at your request;
nothing from either is stored in this repository.

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
- CI on GitHub (`.github/workflows/ci.yml`). It has run, and the last pushed
  commit failed its `repo` job at `pnpm run check`, a formatting error. The fix is
  not pushed yet.
- Golden vectors from the Python mcbuilder for the core, the mcbuilder port and
  the renderer (see [vectors/README.md](vectors/README.md)).
- `core`: NBT reader and writer (big and little endian, gzip), block strings,
  rotation, sectioned volume, and codecs for `.nbt`, `.schem`, `.litematic` and
  `.mcstructure`, all tested. A real build saved in three of those formats
  decodes to the same blocks in each, once the Java default properties that
  Bedrock leaves out (such as `waterlogged=false`) are set aside.
- `convert` script between all four formats.
- The WebGL viewer (M1), the converter page (M2), the editor (M3), the release
  work (M4: autosave, your own resource pack, the site footer with a source link,
  an accessibility pass, a dependency licence check, and the user and
  self-hosting guides), and most of the mcbuilder port (M5).

See [PLAN.md](PLAN.md) for what was checked and what was not, and for the places
where the code differs from the v1 spec and what was decided about each.

Not done yet:

- `.schem` files saved by a real tool, a check of an edited file in Litematica
  itself, and a run on a real GPU and a real phone.
- The 0.1.0 release: the version bump, tag and npm publish.
- Deferred, not in 0.1.0: `mcbuild view` (after 0.1.0) and the parts catalog (the
  spec names it, nothing defines it, so it needs a definition first).
- From the mcbuilder port: error positions (`at file:line`), the `diff` comparison
  image, `Build.validate` and `Build.render`, user documentation and example
  `mcbuild.toml` files, and archiving the Python repository.

## License

AGPL-3.0-only. See [LICENSE](LICENSE).

Parts of this repository are derived from [mcbuilder](https://github.com/lzif/mcbuilder),
which is MIT-licensed. [NOTICE](NOTICE) names those parts and carries the MIT
license text.
