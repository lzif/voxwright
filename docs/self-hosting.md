<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# voxwright: self-hosting guide

This guide is for people who build and serve their own copy of the voxwright web app (`apps/web`). For using the app, see [user-guide.md](user-guide.md).

The app is a static site. It has no server code, and files that visitors open are read in their browser and never sent to your server. You build it once and put the output folder on any file host.

## Contents

1. [Requirements](#1-requirements)
2. [Install](#2-install)
3. [Game assets: textures and models](#3-game-assets-textures-and-models)
4. [Build](#4-build)
5. [Serving the site](#5-serving-the-site)
6. [The footer and the source link](#6-the-footer-and-the-source-link)
7. [License obligations (AGPL-3.0)](#7-license-obligations-agpl-30)
8. [Mojang's assets on a public site: an open question](#8-mojangs-assets-on-a-public-site-an-open-question)
9. [All the commands](#9-all-the-commands)

## 1. Requirements

| What    | Version                                                                                                                                                             | Where it comes from                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Node.js | 22.18 or later. Vite needs 20.19 or 22.12+, SvelteKit needs 22.17+, and the asset scripts run `.ts` files directly, which needs a Node with type stripping (22.18+) | `README.md` (convert section), `engines` of `vite` and `@sveltejs/kit` in `apps/web/node_modules`                   |
| pnpm    | 12.16.1                                                                                                                                                             | `packageManager` and `devEngines.packageManager` in the root `package.json` (`devEngines` has `onFail: "download"`) |
| git     | Optional. Used at build time to read the commit for the footer link.                                                                                                | `apps/web/vite.config.ts`                                                                                           |
| Network | Needed once, to download the game assets (section 3) and the packages.                                                                                              |                                                                                                                     |

The project develops on Node 25 and its CI runs the current LTS and Node 25 (`PLAN.md`, `.github/workflows/ci.yml`).

The root `package.json` and `apps/web/package.json` have no `engines` field of their own.

## 2. Install

```sh
git clone <the repository you are hosting from> voxwright
cd voxwright
pnpm install --frozen-lockfile
```

`--frozen-lockfile` is what the project's CI uses (`.github/workflows/ci.yml`).

## 3. Game assets: textures and models

The viewer draws blocks from Minecraft's block states, models and textures. These belong to Mojang. **They are not in this repository.** A fresh clone has no texture pack, and the site then still works but draws every block as a flat colour.

You make the pack in two steps, on your own machine.

### Step 1: download the assets

```sh
node packages/mcbuilder/bin/mcbuild.ts assets fetch --version 26.2
```

This is the `mcbuild` command (`packages/mcbuilder`). It downloads, for the version you name:

- the Minecraft client jar from Mojang's servers (found through `piston-meta.mojang.com`), and extracts the block textures, block models, block states and entity textures from it;
- the block registry from the PrismarineJS `minecraft-data` repository on GitHub.

Both go to `~/.cache/mcbuilder/<version>/` (the client files under `client/`). Options: `--cache-dir <dir>` to use another folder, and `--force` to download again. A file that is already there is skipped. (`packages/mcbuilder/src/node/assets.ts`, `packages/mcbuilder/src/node/cli.ts`)

### Step 2: bundle them into one file

```sh
pnpm --filter @voxwright/web assets
```

This runs `apps/web/scripts/build-pack.ts`. It reads `~/.cache/mcbuilder/26.2/client/assets/minecraft` and writes **`apps/web/static/pack/pack.json`**.

The pack holds the block states, the block models, the block textures (as base64 PNG) and the chest and banner entity textures. Nothing else from the jar is used. In this checkout the file is about 2.2 MB.

To use another version or folder, call the script directly:

```sh
node apps/web/scripts/build-pack.ts --from <dir>/<version>/client/assets/minecraft --out <path>
```

`--from` defaults to the 26.2 folder above and `--out` defaults to `apps/web/static/pack/pack.json`. If there are no block states under `--from`, the script stops and tells you to run `assets fetch` first.

`apps/web/static/pack/` is git-ignored (`.gitignore`), so the pack is never committed by accident. The pack does not record which Minecraft version it was made from.

### How the site finds the pack

When the page starts, it requests `pack/pack.json` relative to its own address (`apps/web/src/lib/assets.ts`, `fetchPack`). It treats the pack as missing, and draws flat colours, if the request fails, is not a success, or the response's `Content-Type` does not contain `json`.

Visitors can also bring their own pack or a client jar in the page (the **Textures** section, `apps/web/src/lib/user-pack.ts`). That file is read inside their browser, never uploaded, and kept in their browser's IndexedDB. It is laid over the site's pack, or used alone if the site has none. See the user guide, section 7.

## 4. Build

```sh
pnpm --filter @voxwright/web build
```

This runs `vite build` in `apps/web`. The output is the folder **`apps/web/build/`**:

```text
apps/web/build/
  index.html          the page (the app has one route and is prerendered)
  200.html            the fallback page the static adapter writes
  _app/               scripts, styles, version.json
    immutable/        hashed files, including the two web workers (workers/)
  pack/pack.json      the texture pack, if you made one before building
```

Make the pack (section 3) **before** you build: the build copies `static/` into the output.

The adapter is `@sveltejs/adapter-static` with `fallback: "200.html"`, set in the `sveltekit()` call in `apps/web/vite.config.ts`. There is no `svelte.config.js` in `apps/web`. Server rendering is off and prerendering is on (`apps/web/src/routes/+layout.ts`). `paths.relative` is on, so asset links in `index.html` are relative (`./_app/...`). `paths.base` comes from the `VOXWRIGHT_BASE_PATH` build variable (section 5); unset, it is empty and the build is for the root of a host. `200.html` is the one file that cannot use relative links, because a host may serve it at any address; with no base path its links start with `/_app/`.

To look at the result locally:

```sh
pnpm --filter @voxwright/web preview
```

## 5. Serving the site

Copy the contents of `apps/web/build/` to any static host: a web server's document root, an object store with a website option, a static hosting service. There is nothing to run on the server.

What the host needs to do:

- **Serve `index.html` at the address of the site.** The app has a single page, so no rewrite rules are needed.
- **Send correct content types.** Scripts (`.js`, including the workers under `_app/immutable/workers/`) must be served as JavaScript, and `pack/pack.json` as JSON (`application/json`). A script served with a wrong type may be refused by the browser; a pack served as `text/html` is treated as missing, which is what many hosts return for an unknown path.
- **Serve everything from one origin.** The page starts two kinds of web worker from files in `_app/immutable/workers/` next to it: a worker for the software renderer and a pool of mesh workers.
- **Compress if you can.** `pack/pack.json` is about 2.2 MB of base64 text.

What it does not need:

- **No special headers.** The code does not use `SharedArrayBuffer` and does not require cross-origin isolation, so no `Cross-Origin-Opener-Policy` or `Cross-Origin-Embedder-Policy` header is needed. The project's own browser tests serve the build with a plain static server that sets only `Content-Type`.
- **No server-side processing and no upload endpoint.**

### Hosting under a sub-path

To serve the site at `https://example.org/tools/voxwright/`:

1. Build with the sub-path in `VOXWRIGHT_BASE_PATH`:

   ```sh
   VOXWRIGHT_BASE_PATH=/tools/voxwright pnpm --filter @voxwright/web build
   ```

   The value must start with `/` and must not end with `/`, spaces, `?` or `#`. An invalid value stops the build with an error that names the variable. Unset or empty means the root of the host.
2. Copy the contents of `apps/web/build/` into the `tools/voxwright` folder of your host, so that `index.html` is served at `/tools/voxwright/`. Use the address with the trailing slash, so that relative links resolve inside the folder.
3. If your host serves a fallback page for unknown addresses, use the `200.html` from the same build. Its links start with `/tools/voxwright/`.

`index.html` uses relative links and finds `pack/pack.json` relative to its own address. `200.html`, the fallback page the static adapter writes, can be served at any address, so it cannot use relative links and uses the base path instead. A build made without `VOXWRIGHT_BASE_PATH` is for the site root: its `200.html` links start with `/_app/`, so that file is only right at the root. Build for the sub-path you serve it at; the same build cannot be moved between paths.

What has been checked: the build output (`200.html` carries the base path, `index.html` stays relative, and a value with a trailing slash stops the build). Not checked: opening the site in a browser under a sub-path. No test covers it.

The browser needs WebGL2 for the full viewer and editor. Without it the page falls back to a software renderer that can view and convert but not edit.

## 6. The footer and the source link

Every page has a footer: the name and version, the license, and a link to the source. `apps/web/build-info-config.ts` computes the link when you build, and `vite.config.ts` bakes the values into the page. Set the environment variables when you run the build:

| Variable                | Meaning                                                                                                                     | Default                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `VOXWRIGHT_SOURCE_URL`  | The repository holding the source of the site you are serving. Must be an `http` or `https` URL.                            | `https://github.com/lzif/voxwright`                                          |
| `VOXWRIGHT_COMMIT`      | The commit the site is built from. 4 to 64 characters from `0-9 a-z A-Z . _ -`.                                             | `git rev-parse HEAD`, if the folder is a git checkout; otherwise none        |
| `VOXWRIGHT_SOURCE_LINK` | The full link to show, for hosts whose commit pages are not `<repository>/tree/<commit>`. Must be an `http` or `https` URL. | `<source url>/tree/<commit>`, or just the source URL when no commit is known |

An invalid value stops the build with an error that names the variable.

The footer reads: "voxwright [version] is free software under the GNU Affero General Public License, version 3 only. Source code of this version (`<short commit>`)." and, on a second line, "Not affiliated with Mojang or Microsoft." The version is left out while `apps/web/package.json` says `0.0.0`.

If you do not set `VOXWRIGHT_COMMIT`, the build reads the commit from git, and it checks `git status --porcelain`. When the tree has uncommitted changes, the footer adds "with local changes". When you set `VOXWRIGHT_COMMIT` yourself, the build takes it as accurate and does not add that note.

Example for a fork:

```sh
VOXWRIGHT_SOURCE_URL=https://github.com/you/voxwright pnpm --filter @voxwright/web build
```

Example when building from an archive with no `.git` folder:

```sh
VOXWRIGHT_SOURCE_URL=https://github.com/you/voxwright \
VOXWRIGHT_COMMIT=0123abc4567def \
pnpm --filter @voxwright/web build
```

## 7. License obligations (AGPL-3.0)

voxwright is licensed under the GNU Affero General Public License, version 3 only (`LICENSE`). This section says what the license text and the project's code say. It is not legal advice; read `LICENSE` for the exact terms.

- Section 13 of the license, "Remote Network Interaction", says: if you modify the program, your modified version must prominently offer all users interacting with it remotely through a computer network an opportunity to receive the Corresponding Source of your version, by providing access to it from a network server at no charge.
- The project reads this as a visible link, for a modified copy, to the source of **your** version (comment in `apps/web/src/lib/build-info.ts`).

How the project helps you do that:

- The footer always carries a link to the source of the version that is running. When the build read the commit from git, it also says if the working tree had local changes; when you set `VOXWRIGHT_COMMIT` yourself, it does not (section 6).
- For a modified copy, point it at your own repository with `VOXWRIGHT_SOURCE_URL` (and `VOXWRIGHT_COMMIT` or `VOXWRIGHT_SOURCE_LINK`), as in section 6.
- Commit and publish your changes first. If you build from an uncommitted tree, the footer link names a commit that does not contain your changes, and the footer says "with local changes".
- The footer link is the app's only offer of the source. Removing it from a modified copy removes that offer.
- Source, script, document and workflow files carry `SPDX-License-Identifier: AGPL-3.0-only` headers.

`pnpm run licenses` (or `node scripts/licenses.ts`; plain `pnpm licenses` is pnpm's own command and fails) lists the production dependencies of `apps/web` with the license each declares and fails if one is not on the project's AGPL-compatible allowlist. It reads `node_modules` only. It covers `apps/web` only, and the project's CI does not run it.

The built site does not carry the notices of its MIT-licensed dependencies (three.js, Svelte, fflate and others); the project does not add them yet (see `PLAN.md`). The MIT license asks for its notice to travel with copies, so if you serve a build, add them yourself.

## 8. Mojang's assets on a public site: an open question

Minecraft's textures, models and block states belong to Mojang. **They are not covered by this project's license.** The AGPL applies to voxwright's own code. This repository holds none of Mojang's files, and the project's code does not grant you any right to them.

What the code does today:

- `mcbuild assets fetch` downloads the client jar from Mojang's servers to the machine where you run it, at your request. Nothing from it is stored in the repository.
- `pnpm --filter @voxwright/web assets` turns the extracted files into `apps/web/static/pack/pack.json`, which is git-ignored.
- If `pack.json` exists when you build, the build copies it to `apps/web/build/pack/pack.json`, and your site then sends it to every visitor.
- If it does not exist, the site serves no Mojang files. It still opens, shows, edits and converts schematics, drawing blocks as flat colours.
- Visitors can load their own resource pack or client jar in the page. It is read in their browser, not sent to your server, and stored in their browser.
- The footer says "Not affiliated with Mojang or Microsoft."

**Whether a public site may serve Mojang's textures and models is an open question. The project has not decided it, and this guide does not decide it or give legal advice.** If you host a copy for the public, check Mojang's terms yourself. The two options the code supports:

1. Build without a pack. Visitors get flat colours, or they load their own pack or jar.
2. Build with a pack you made from assets you are entitled to serve.

## 9. All the commands

| Step                 | Command                                                                     | Taken from                                                      |
| -------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Install              | `pnpm install --frozen-lockfile`                                            | `.github/workflows/ci.yml`                                      |
| Download assets      | `node packages/mcbuilder/bin/mcbuild.ts assets fetch --version 26.2`        | `README.md`, `.github/workflows/ci.yml`                         |
| Bundle the pack      | `pnpm --filter @voxwright/web assets`                                       | `apps/web/package.json` (`assets` script), `README.md`          |
| Build                | `pnpm --filter @voxwright/web build`                                        | `apps/web/package.json` (`build` script), `PLAN.md` (M3 status) |
| Build with a link    | `VOXWRIGHT_SOURCE_URL=<your repository> pnpm --filter @voxwright/web build` | `apps/web/vite.config.ts`, `apps/web/build-info-config.ts`      |
| Build for a sub-path | `VOXWRIGHT_BASE_PATH=/sub/path pnpm --filter @voxwright/web build`          | `apps/web/vite.config.ts`                                       |
| Look at it locally   | `pnpm --filter @voxwright/web preview`                                      | `apps/web/package.json` (`preview` script)                      |
| Deploy               | Copy `apps/web/build/` to a static host                                     | `README.md` ("serve `apps/web/build` from any file host")       |
