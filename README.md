<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Voxwright

Voxwright is a browser-based schematic editor for voxel builds, together with a
TypeScript port of [mcbuilder](https://github.com/lzif/mcbuilder).

## Monorepo layout

This is a private pnpm monorepo. Workspace members live under `packages/*` and
`apps/*`.

| Path                 | Role                                                                                                                                                                                                                                    | State              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `packages/core`      | NBT, block-state strings, rotation, volume, the `.nbt`, `.schem`, `.litematic` and `.mcstructure` codecs, and the editor core (commands, undo, tools, picking). Imports nothing from other workspace members and has no DOM dependency. | in place           |
| `packages/render`    | Section mesher and CPU rasterizer (DOM-free), and a three.js renderer at `@voxwright/render/webgl`. May depend on `core`.                                                                                                               | in place           |
| `packages/mcbuilder` | TypeScript port of mcbuilder and the `mcbuild` CLI. May depend on `render` and `core`.                                                                                                                                                  | ported (see PLAN)  |
| `apps/web`           | The browser viewer, editor and converter (SvelteKit, static). May depend on `render` and `core`.                                                                                                                                        | M3 in place        |
| `vectors/`           | Golden JSON exported from the Python mcbuilder, plus the exporter.                                                                                                                                                                      | in place           |
| `fixtures/`          | Schematic files shared by all tests.                                                                                                                                                                                                    | synthetic and real |
| `scripts/`           | Command-line tools, such as `convert`.                                                                                                                                                                                                  | in place           |
| `reference/`         | Local, git-ignored clone of upstream mcbuilder, used read-only as an oracle. Never modified or imported.                                                                                                                                |                    |

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
the tools ignore the hidden ones. Edits live in the page: Export writes a new
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
once with the GPU off, and once through the editor (real mouse and key events on
a `.litematic`, then the exported file is read back and compared cell by cell). `node apps/web/test/perf.ts` and
`node apps/web/scripts/measure.ts` measure a generated 256-wide build.

## Tooling

- pnpm workspaces (`pnpm-workspace.yaml`)
- TypeScript, strict, ESM only, `verbatimModuleSyntax` (`tsconfig.base.json`)
- Biome for lint and format (`biome.jsonc`)
- Vitest with one project per workspace member (`vitest.config.ts`)
- dependency-cruiser for the dependency rules (`.dependency-cruiser.cjs`)
- GitHub Actions, per path (`.github/workflows/ci.yml`)

Scripts: `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm depcheck`.

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
not ported, and `--tier` says so instead of ignoring the flag. `assets fetch` downloads the Mojang client jar and the
minecraft-data registry at your request; nothing from either is stored in this
repository.

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
states are translated by rule, so anything the rules do not cover is dropped
and listed rather than guessed. It runs `.ts` files directly, which needs a Node release
with type stripping (22.18 or later).

## Status

Milestone M0 (core skeleton), as built so far:

- Repo foundations: license, editor config, workspace, TypeScript base config,
  Biome, Vitest, dependency-cruiser.
- CI workflow (not yet run on GitHub: there is no remote).
- Golden vectors for block strings, rotation and structure NBT.
- `core`: NBT reader and writer (big and little endian, gzip), block strings,
  rotation, sectioned volume, and codecs for `.nbt`, `.schem`, `.litematic` and
  `.mcstructure`, all tested. A real build saved in three of those formats
  decodes to the same blocks in each.
- `convert` script between all four formats.

Since then: the WebGL viewer (M1), the converter page, the editor (M3, see
[PLAN.md](PLAN.md) for what was checked and what was not) and the mcbuilder port.

Not done yet: `.schem` files saved by a real tool, registry-validation vectors,
a check of an edited file in Litematica itself, autosave and the release
work (M4).

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
