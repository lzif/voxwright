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

## Converting a schematic

```sh
node scripts/convert.ts in.schem out.nbt
node scripts/convert.ts in.nbt out.schem --version 2
```

Reads Sponge `.schem` (v2 and v3) and structure-block `.nbt`, and writes
either. Block entities and entities are not carried over; the script reports
how many it dropped. It runs `.ts` files directly, which needs a Node release
with type stripping (22.18 or later).

## Status

Milestone M0 (core skeleton), as built so far:

- Repo foundations: license, editor config, workspace, TypeScript base config,
  Biome, Vitest, dependency-cruiser.
- CI workflow (not yet run on GitHub: there is no remote).
- Golden vectors for block strings, rotation and structure NBT.
- `core`: NBT reader and writer (big and little endian, gzip), block strings,
  rotation, sectioned volume, `.nbt` and `.schem` codecs, all tested.
- `convert` script.

Not done yet: files saved by real tools as fixtures, registry-validation
vectors, and everything from M1 on.

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
