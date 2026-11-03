<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Voxwright

Voxwright is a browser-based schematic editor for voxel builds, together with a
TypeScript port of [mcbuilder](https://github.com/lzif/mcbuilder).

## Monorepo layout

This is a private pnpm monorepo. Workspace members live under `packages/*` and
`apps/*`.

| Path                 | Role                                                                                                                                                   | State              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| `packages/core`      | NBT, block-state strings, rotation, volume and the `.nbt` and `.schem` codecs. Imports nothing from other workspace members and has no DOM dependency. | M0 pieces in place |
| `packages/render`    | Rendering. May depend on `core`.                                                                                                                       | not started        |
| `packages/mcbuilder` | TypeScript port of mcbuilder. May depend on `render` and `core`.                                                                                       | not started        |
| `apps/web`           | The browser editor. May depend on `render` and `core`.                                                                                                 | not started        |
| `vectors/`           | Golden JSON exported from the Python mcbuilder, plus the exporter.                                                                                     | in place           |
| `fixtures/`          | Schematic files shared by all tests.                                                                                                                   | synthetic only     |
| `scripts/`           | Command-line tools, such as `convert`.                                                                                                                 | in place           |
| `reference/`         | Local, git-ignored clone of upstream mcbuilder, used read-only as an oracle. Never modified or imported.                                               |                    |

Dependencies point one way only; `.dependency-cruiser.cjs` enforces this.

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
```

A script exports a `Build` as `BUILD`. Previews, `diff` and `guide` need the
renderer and are not ported yet; `run --preview` says so instead of ignoring
the flag. `assets fetch` downloads the Mojang client jar and the
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
prints a loss report: block entities and entities are not carried over, and
Bedrock block states are translated by rule, so anything the rules do not
cover is dropped and listed rather than guessed. It runs `.ts` files directly, which needs a Node release
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

Not done yet: `.schem` files saved by a real tool, registry-validation vectors,
the viewer, the editor, the converter page and the mcbuilder port.

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
