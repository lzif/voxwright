<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Voxwright

Voxwright is a browser-based schematic editor for voxel builds, together with a
TypeScript port of [mcbuilder](https://github.com/lzif/mcbuilder).

## Monorepo layout

This is a private pnpm monorepo. Workspace members live under `packages/*` and
`apps/*` (neither directory exists yet).

| Path                 | Role                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `packages/core`      | Data model and algorithms. Imports nothing from other workspace members and has no DOM dependency.       |
| `packages/render`    | Rendering. May depend on `core`.                                                                         |
| `packages/mcbuilder` | TypeScript port of mcbuilder. May depend on `render` and `core`.                                         |
| `apps/web`           | The browser editor. May depend on `render` and `core`.                                                   |
| `reference/`         | Local, git-ignored clone of upstream mcbuilder, used read-only as an oracle. Never modified or imported. |

Dependencies point one way only; `.dependency-cruiser.cjs` enforces this.

## Tooling

- pnpm workspaces (`pnpm-workspace.yaml`)
- TypeScript, strict, ESM only, `verbatimModuleSyntax` (`tsconfig.base.json`)
- Biome for lint and format (`biome.jsonc`)
- Vitest with one project per workspace member (`vitest.config.ts`)
- dependency-cruiser for the dependency rules (`.dependency-cruiser.cjs`)

Scripts: `pnpm check`, `pnpm test`, `pnpm depcheck`.

## Status

Milestone M0, repo foundations: license, editor config, workspace, TypeScript
base config, Biome, Vitest and dependency-cruiser are in place. No packages or
apps have been created yet.

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
