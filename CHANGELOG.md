# Changelog

## 0.0.4 (unreleased)

**Breaking: the project is renamed to voxmc.** Everything that carried the old project names now
says `voxmc`. There are no aliases, no fallbacks and no migration, except the two error messages
described under "Tombstones".

The project moved to a new repository, `lzif/voxmc`, started from the renamed tree with no history.
The old repository, `lzif/voxwright`, keeps its history as an archive and is made private after
0.0.4 is published.

### What changed

| Surface                                  | Before (0.0.3)                                                                                                                                                    | Now                                                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Repository                               | `github.com/lzif/voxwright`                                                                                                                                       | `github.com/lzif/voxmc`                                                                                 |
| Web app                                  | `https://luki.is-a.dev/voxwright/`                                                                                                                                | `https://luki.is-a.dev/voxmc/`                                                                          |
| npm package                              | `voxmc` (command `mcbuild`, file `mcbuild.mjs`)                                                                                                                   | `voxmc` (command `voxmc`, file `voxmc.mjs`)                                                             |
| Command line                             | `mcbuild`, or `voxwright-cli.mjs` inside the skill                                                                                                                | `voxmc`                                                                                                 |
| Recipe import                            | `"voxwright"`, `"@voxwright/mcbuilder"`, `"@voxwright/core"`                                                                                                      | `"voxmc"`                                                                                               |
| Config file                              | `mcbuild.toml`                                                                                                                                                    | `voxmc.toml`                                                                                            |
| Cache                                    | `~/.cache/mcbuilder/<version>/` (assets), `~/.cache/voxwright/web/` (preview)                                                                                     | `~/.cache/voxmc/<version>/`, `~/.cache/voxmc/web/`                                                      |
| Environment variables                    | `VOXWRIGHT_ASSETS`, `VOXWRIGHT_WEB`, `VOXWRIGHT_BASE_PATH`, `VOXWRIGHT_COMMIT`, `VOXWRIGHT_SOURCE_LINK`, `VOXWRIGHT_SOURCE_URL`                                   | `VOXMC_ASSETS`, `VOXMC_WEB`, `VOXMC_BASE_PATH`, `VOXMC_COMMIT`, `VOXMC_SOURCE_LINK`, `VOXMC_SOURCE_URL` |
| Build defines                            | `__VOXWRIGHT_BUNDLED__`, `__VOXWRIGHT_VERSION__`, `__VOXWRIGHT_COMMIT__`, `__VOXWRIGHT_MODIFIED__`, `__VOXWRIGHT_SOURCE_LINK__`, `__VOXWRIGHT_SOURCE_URL__`       | `__VOXMC_*__`, the same six                                                                             |
| Error and config types                   | `McbuilderError`, `McbuildConfig`                                                                                                                                 | `VoxmcError`, `VoxmcConfig`                                                                             |
| Workspace packages (private)             | `@voxwright/core`, `@voxwright/render`, `@voxwright/mcbuilder`, `@voxwright/web`                                                                                  | `voxmc-core`, `voxmc-render`, `voxmc-engine`, `voxmc-web`                                               |
| User agent of asset and preview requests | `voxwright-mcbuilder`, `voxwright-cli preview`                                                                                                                    | `voxmc`, `voxmc preview`                                                                                |
| Preview cache response header            | `x-voxwright-cache`                                                                                                                                               | `x-voxmc-cache`                                                                                         |
| Browser test hook                        | `window.__voxwright`                                                                                                                                              | `window.__voxmc`                                                                                        |
| IndexedDB database                       | `voxwright`                                                                                                                                                       | `voxmc`                                                                                                 |
| localStorage keys                        | `voxwright.*` (layout, lefthanded, cursoroffset, touchintro, haptics, twofingerundo, threefingerredo, confirmplace, twist, quality, recentblocks, favoriteblocks) | `voxmc.*`, same names after the dot                                                                     |
| Litematica default name                  | `voxwright`                                                                                                                                                       | `voxmc`                                                                                                 |
| Skill                                    | `skills/voxwright/`, with the CLI bundled inside it (`scripts/voxwright-cli.mjs`)                                                                                 | `skills/voxmc/`, markdown only; it installs the CLI from npm                                            |

### Browser storage is not migrated

The web app now reads and writes only the `voxmc` IndexedDB database and `voxmc.*` keys. Nothing is
copied from the old ones and the old ones are not read. Autosaved work and the imported resource
pack stored by 0.0.3 stay in the browser under the old names, orphaned, and the app starts empty.
Export any work you want to keep, and re-import your resource pack, before you upgrade.

### Tombstones (removed at 0.1.0)

A tombstone resolves nothing; it turns a silent or confusing failure into an error that says what
happened. Both are removed at 0.1.0.

- A recipe that imports an old specifier fails with an error that names the rename and the new
  import, `import { ... } from "voxmc"`.
- An old config file (`mcbuild.toml`) found where `voxmc.toml` is looked up fails with an error that
  tells you to rename it. Without this the file would be ignored and the Minecraft version would
  fall back to the default.

### Output changes

Only these changes reach the bytes or text the tool writes; the same recipe produces the same blocks
otherwise.

- `.litematic` files written without an explicit name are named `voxmc` instead of `voxwright`. The
  other formats are unchanged.
- The registry's "unknown block" advice now says `allowlist` in `voxmc.toml`.

### The skill and the CLI

The skill is markdown only: `SKILL.md` and its references. It no longer carries a bundled CLI.
It tells the agent to use `voxmc` when it is installed and `npx voxmc` otherwise, with no version
pinned, and says it was written against 0.0.4. `scripts/pack-npm.ts` builds the single file
`voxmc.mjs` from the package sources; nothing generated is committed.

### Older installs: the web app path

After the move, `https://luki.is-a.dev/voxwright/` answers 404 and there is no redirect. A 0.0.3
install of the command line fetches the preview's web app from that address, so `preview` stops
working until you point it at the new one. Set the variable it reads, or pass the same address with
its `--web` option:

    VOXWRIGHT_WEB=https://luki.is-a.dev/voxmc/ mcbuild preview house.schem

Upgrading to 0.0.4 removes the need for it.
