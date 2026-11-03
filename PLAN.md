<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# voxwright: monorepo plan (PLAN.md)

Nov 2, 2026 · @Luki Zainur

voxwright is one AGPL-3.0 pnpm monorepo holding a browser schematic editor and a TypeScript port of mcbuilder; M0 scaffolds `core` and the first two codecs, and the mcbuilder port comes last so the editor is not delayed.

## Decisions

Everything below is settled except the SPDX variant (see Open items).

| Topic                | Choice                                                           | Note                                                                                                               |
| -------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Name                 | voxwright                                                        | Unclaimed on npm and no Minecraft-related GitHub repo shares it in a name search; domain and trademark not checked |
| License              | AGPL-3.0 for every package, one root `LICENSE`                   | A hosted modified copy must publish its source                                                                     |
| Repository           | One pnpm monorepo, `lzif/voxwright`                              | Shared code changes land in every consumer at once                                                                 |
| Renderer             | `Renderer` interface; our own mesher on the GPU with three.js    | Decided for M1 (spec option B), not deepslate; the CPU rasterizer stays as the fallback without WebGL2             |
| mcbuilder renderers  | Faithful tier first; fast and trusted only if the CLI needs them | Faithful is the default tier since mcbuilder 0.2.0                                                                 |
| RNG                  | A new portable PRNG in the TypeScript port (sfc32 suggested)     | Python's `random.Random` cannot be reproduced bit for bit, so seeded builds will differ from Python                |
| Language and runtime | TypeScript, strict, ESM only; Node 25 locally, current LTS in CI | Node 25 runs `.ts` files directly                                                                                  |
| Tooling              | pnpm, Biome (lint and format), Vitest, dependency-cruiser        |                                                                                                                    |
| Contributions        | DCO sign-off; commit and PR text say what changed and why        | Relicensing later needs every contributor's consent                                                                |

## Repository layout

One workspace under a single AGPL-3.0 `LICENSE`; each package is written as if it could be published alone, under the `@voxwright/*` npm scope.

```text
/
  packages/
    core/        Volume, NBT, codecs, block registry, rotation, quads
    render/      Renderer interface, section mesher, WebGL, Canvas 2D
    mcbuilder/   CLI for agent-built structures, ported from Python
  apps/
    web/         SvelteKit viewer, editor, converter
  fixtures/      schematics saved by real tools, shared by all tests
  vectors/       golden JSON exported from the Python mcbuilder
  PLAN.md        this plan
  LICENSE        AGPL-3.0 for everything
```

- Dependencies point one way: `apps/web` and `mcbuilder` use `render` and `core`, `render` uses `core`, and `core` imports nothing from the others and has no DOM dependency. dependency-cruiser enforces it in CI.
- Every file carries an SPDX header.
- CI runs per path (`pnpm --filter`), so a docs change does not rebuild the app; browser tests run in CI only.
- A package can be split into its own repository later with `git filter-repo`.

## M0 tasks

Each task becomes one GitHub issue under milestone M0, in this order.

- [x] Repo foundations: AGPL-3.0 `LICENSE`, README, `.editorconfig`, pnpm workspace, `tsconfig.base.json` (strict, ESM, `verbatimModuleSyntax`), Biome, Vitest workspace, dependency-cruiser rules
- [x] CI: GitHub Actions per path with a pnpm cache, on Node LTS and Node 25
- [x] `vectors/`: an export script that runs the Python mcbuilder on input grids and writes JSON (see Golden vectors)
- [x] `core/nbt`: reader and writer, big and little endian, gzip through `CompressionStream`
- [x] `core/blocks`: block-state parsing and canonical strings compatible with mcbuilder
- [x] `core/rotation`: port of `rotation.py`, passing the vectors
- [x] `core/volume`: 16x16x16 sections, interned palette, a `toDense()` adapter for renderers
- [x] Codec `.nbt`: read and write with round-trip tests (references: `export_nbt.py` and the reader in `importer.py`)
- [x] Codec `.schem` (Sponge v2 and v3): read and write with round-trip tests
- [x] A `convert in.schem out.nbt` script

**Exit criteria:** the vectors pass, the round-trip suite is green, CI is green, and `convert` turns a real `.schem` into a `.nbt` that mcbuilder's importer reads back.

## Golden vectors

The Python mcbuilder is the oracle: a script calls its real functions over a grid of inputs and writes JSON into `vectors/`, and the TypeScript tests read that JSON. The vectors are generated, not copied from the old test assertions, so they can cover more inputs than the old tests did.

- **Rotation:** all four rotations, position transform and block-state transform (`facing`, `axis` and the rest).
- **Blocks:** block-state parsing and canonical strings.
- **Registry validation:** against a small fixture registry, not the full asset cache.
- **Structure NBT:** compared as parsed structure before gzip, never as compressed bytes.

Generating them needs `mcbuild assets fetch --version 26.2` on a machine with network access. The JSON is committed, so CI never needs Python or the asset cache.

## mcbuilder port

The port starts from the merged `main` (mcbuilder 0.2.0, about 8,400 lines of Python and 453 test functions). Modules are ported in this order, each against its vectors or tests.

| Step | Python module (lines)                           | Note                                                                                                                       |
| ---- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1    | `voxels` (239), `geometry` (162)                | Dense numpy grid becomes typed arrays, with an adapter to `Volume`                                                         |
| 2    | `shapes` (467)                                  | box, walls, pillar, line, stairs, cylinder, sphere, cone, roof\_gable, roof\_hip; each is also a `Build` method, generated |
| 3    | `build` (312)                                   | The `Build` class, `rng()` namespaces, bounds errors                                                                       |
| 4    | `materials` (136)                               | `patches()`; SHA-256 based, so it stays portable                                                                           |
| 5    | `report` (92), `config` (110)                   | `report.json` and `mcbuild.toml` (needs a TOML parser)                                                                     |
| 6    | `importer` (296)                                | `.nbt` to builder script; the generated script becomes TypeScript                                                          |
| 7    | `diff` (362), `guide` (280)                     | numpy and Pillow move to typed arrays and Canvas 2D                                                                        |
| 8    | `render/faithful` (2,071), `render/views` (176) | Blockstate to model to quads goes to `core`; drawing goes to `render`                                                      |
| 9    | `cli` (1,012)                                   | Commands: check, run, diff, import, init, assets                                                                           |
| 10   | `assets` (291)                                  | Unzips the client jar and fetches the minecraft-data block registry                                                        |
| 11   | `examples/`                                     | Port every script; they are the end-to-end tests                                                                           |

**Status:** steps 1 to 6 are ported in `packages/mcbuilder` and pass vectors exported from the Python oracle (`vectors/*.json`). Step 6 covers the importer's summary, constant naming, box merging and a TypeScript script writer; reading the `.nbt` itself is `core`'s codec. Also done: the `mcbuild` CLI minus previews (`init`, `check`, `run`, `import`, `assets fetch`, in `packages/mcbuilder/src/node`) and step 10 (assets), checked against a fake network and once against the real one. Step 11, the examples: all 13 scripts are ported to `packages/mcbuilder/examples`. Eleven rebuild identically to the Python output (same cells, same bounds, same SHA-256 over every cell; `vectors/examples.json`). `homestead/watchtower` and `crystal_observatory` use the RNG: every position and every block the RNG does not place matches the Python output exactly, and only the RNG-picked blocks differ. `diff` (step 7) is ported without its comparison image, which needs rendered previews: the cell diff, the report text, run-id resolution and `.nbt` run loading match the Python oracle, and `mcbuild diff` works. Step 8 is under way in `packages/render`, checked against the Python renderer with vanilla assets fetched at run time: `views`; the blockstate-to-model-to-quads stage plus chest, banner, fluid and fallback-cube quads (77 blockstates, 916 quads: geometry within 1e-9, identical pixels); and the grid logic (which blocks occlude, wall and fence connection inference, neighbour culling, per-vertex ambient occlusion: 5 scenes, 1,745 quads, all equal). The rasterizer and previews are in too: `mcbuild run --preview` writes faithful PNGs (`--views`, `--count`, `--focus`). On four builds in three views each, they match the Python renderer's output size and stay within a mean absolute difference of about 0.75/255 (about 1% of pixels differ by more than 8, mostly edges); `vectors/renders.json` holds thumbnails of the Python renders for the test. `guide` (step 7) is ported: `guide.md` is byte-identical to the Python output for four builds (including the 13-layer underwater base), and the layer images have identical sizes with close thumbnails; `mcbuild run --guide` writes them. Text is drawn with a small original bitmap font, so no font file or native dependency is needed. The title, view label and compass overlay is ported too, and `run --preview` warns about blocks drawn as magenta fallback cubes, as the original does. The fast and trusted preview tiers are deliberately not ported, per the Decisions table ("Faithful tier first; fast and trusted only if the CLI needs them"): the CLI works without them and `--tier` says so. **M5 is complete apart from those two optional tiers.**

## Port gotchas

- **RNG:** `Build(seed=...)` uses Python's Mersenne Twister with SHA-512 string seeding. The port uses a new PRNG, so seeded builds differ from Python; the vectors only cover paths that do not use the RNG.
- **Scripts:** builder scripts are Python today. After the port they are TypeScript, so every script in `examples/` must be ported.
- **numpy and Pillow:** numpy becomes typed arrays with small helpers; Pillow becomes Canvas 2D through `@napi-rs/canvas`, behind a `PreviewSurface` interface. Its documentation lists Linux arm64 prebuilts; that is not yet tried on the development machine.
- **Determinism:** `cli.py` re-executes itself with `PYTHONHASHSEED=0`. Node needs no such step, but any iteration order that affects output must be explicit.
- **Assets:** fetching the client jar needs zip extraction (a small dependency such as fflate) and the PrismarineJS minecraft-data block registry.
- **Test baseline at the PR #5 merge:** 506 pass, 26 are skipped because they need the real asset cache, and 1 (`test_inferred_fence_renders_connected_not_fallback`) fails without the cache because it lacks the `needs_real_assets` marker.

## Milestones

Full definitions and exit criteria live in the [v1 spec](https://claude.ai/artifact/GRd8qFWt6qZD7AyDE3ZPU5); this is the order.

1. **M0, core skeleton:** monorepo, `core`, `.nbt` and `.schem` codecs, golden vectors.
2. **M1, viewer:** SvelteKit shell, asset fetch script, quads in `core`, the renderer spike and its go/no-go, orbit, fly and slicer.
3. **M2, remaining formats:** `.litematic` and `.mcstructure`, loss report, converter page. (Codecs and the loss report are done in `core` and `scripts/convert.ts`; the converter page is not.)
4. **M3, editor:** tools, undo and redo, block-state panel, export.
5. **M4, release:** autosave, accessibility, docs, self-hosting guide, 0.1.0.
6. **M5, mcbuilder port:** the table above, then archive the Python repository with a pointer.

## M1 status

**Status:** the viewer runs on WebGL2. `packages/render/src/mesh` is the DOM-free part: a section mesher (one 16x16x16 section plus a one-cell border from its neighbours becomes positions, atlas UVs, a per-vertex colour that carries tint, face shade and ambient occlusion, and indices, in an opaque, a cutout and a translucent bucket), a texture atlas builder (animated textures are their first frame), and a scheduler that feeds a pool of workers and keeps a slow worker from overwriting a newer mesh. It reuses the existing quad pipeline, so models, multipart, chests, banners, fluids, wall and fence connections, neighbour culling and ambient occlusion are the same code the CPU renderer runs; unknown blocks are the magenta fallback cube. `@voxwright/render/webgl` is the browser entry point (three.js, the `Renderer` interface, orbit and fly cameras, clip-plane slicing with re-meshed cut layers, highlight boxes); `.dependency-cruiser.cjs` keeps three.js and the DOM out of everything else, so the `mcbuild` CLI never reaches them. `apps/web` uses it, with an orbit and fly toggle and the layer slicer, and falls back to the CPU renderer when WebGL2 is missing; convert and the loss report are unchanged. `apps/web/test/e2e.ts` drives both paths in Chromium on the Rafeals_house fixture.

**Measurements** on the 256 x 64 x 256 synthetic build (`apps/web/scripts/synthetic.ts`: hills, lakes, trees and houses; 2,043,386 cells, 22 palette entries, 711 sections with blocks; generated on the fly, not committed). Machine: 4 vCPU Firecracker VM, Chromium 154, headless, **no GPU: WebGL ran on SwiftShader** (software Vulkan), so the frame rates below are a floor, not a GPU result. Reproduce with `node apps/web/test/perf.ts` (browser) and `node apps/web/scripts/measure.ts` (Node).

| What                                                  | Result                                                                                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Parse the `.schem` (0.12 MB gzipped)                  | 408 ms in the page (483 ms in Node); it runs on the main thread, so the page is busy that long                                                                                 |
| Mesh one section, median and p95 (3 workers, in page) | 0.7 ms and 6.3 ms (Node, one thread: 0.5 ms and 1.8 to 2.4 ms); slowest 33 ms                                                                                                  |
| Whole build meshed, 634,143 quads, 1,130 draw calls   | 1.1 s from `setVolume` until every mesh is swapped in                                                                                                                          |
| Time to first full frame                              | 1.1 s after the volume is set, 1.6 s from choosing the file (parse included)                                                                                                   |
| Frame rate orbiting the whole build, 1.27 M triangles | 7 fps on SwiftShader (median frame 117 ms, p95 200 ms); the `render` call itself takes 4.4 ms of main-thread time (p95 6.3 ms)                                                 |
| Frame rate orbiting close up, 0.63 M triangles        | 7 fps on SwiftShader; software vertex work scales with triangles (about 5 M triangles per second)                                                                              |
| Re-mesh after editing one block                       | 0.1 to 5 ms in the worker; 1.3 to 2 ms end to end in one thread, 10 ms where a block touches eight sections; 130 ms until it is on screen here, which is one SwiftShader frame |
| Slice moved through the build (re-meshes one layer)   | 0.9 s for the first move, 0.3 to 0.4 s after; the clip planes show the cut at once                                                                                             |

**Exit criterion (a 256-wide build opens and navigates smoothly):** the open path meets it, with the build on screen about 1.6 s after the file is chosen. Smooth navigation is not shown: the only renderer available here is software, which draws 1.27 M triangles at 7 fps. On a GPU that load is small and the main-thread cost per frame is 4.4 ms, but that is an expectation, not a measurement; run `perf.ts` on a machine with a GPU before calling M1 closed. Known limits: there is no greedy meshing or level of detail, so triangle count grows with surface area; translucent faces are ordered by section, not by face; textures are sampled without mipmaps; banner cloth keeps two transparent corner texels the CPU renderer fills; reading the file still happens on the main thread.

## M3 status

**Status:** the editor works in `apps/web`, on the WebGL path. **Loading an edited file in Litematica itself is not verified** (Litematica is not available on the development machine); that part of the exit criterion needs Luki. The spec's other half, that rotate and mirror reproduce the golden rotation vectors, is covered by the core tests that existed before this milestone.

**What is there.** The editor core (`Editor`, `Stroke`, `History`, `DirtyTracker`, the tools, `raycast`) was committed earlier; M3 wires it into the page. `apps/web/src/lib/editor-session.svelte.ts` holds the open volume's `Editor`, the chosen tool, block and selection, and turns mouse and keyboard into core commands; after every change `editor.dirty.take()` goes to `renderer.markDirty`. The panels are Svelte components in `apps/web/src/lib/components` (toolbar, block palette, block-state panel, selection panel); the pure parts (tool list and shortcuts, palette search, ray helpers) are in `lib/editing.ts`.

- **Tools:** place, replace (turns the clicked block into the chosen one), erase, eyedropper, line, rectangle (filled or hollow), box select, fill, replace A with B inside the selection, copy, paste, move (by typed offsets), rotate 90 degrees either way, mirror east-west or north-south. Erase writes air, so the build keeps its size.
- **Input scheme:** the page starts in View, where the mouse only looks around as before. With a tool chosen, a plain left click or drag uses the tool, Alt+drag turns the view, Shift+drag or the right button moves it sideways, the wheel zooms. Tools work in the Orbit camera only; Fly is unchanged. A drag with Place, Replace or Erase is one undo step and stays on the surface it began on; line and rectangle show a ghost box while dragging and are one command on release. Keys: V view, P place, B replace, X erase, I eyedropper, L line, R rectangle, M select, F fill, `[` and `]` rotate, Ctrl+C and Ctrl+V, Esc cancels or deselects, Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y for history. None of the single keys is a fly key. Keys are ignored while typing in a text field (the palette search, the property and coordinate fields). Shortcuts are in the tooltips and the interaction is explained in the page's help text.
- **Picking:** core's `raycast` along the camera ray. The renderer gained `rayFromClient(x, y)` (a pure `pickRay` in `controls.ts`, checked against three.js's own camera) and, for tests, `clientFromWorld`. Core's `raycast` gained an optional `accept(x, y, z)` callback; the page uses it so that cells outside the layer slice are passed through, and it refuses to place a block outside the slice. The ray is first clipped to the volume's bounds, so a miss costs nothing.
- **Palette:** block ids from the pack's blockstates (`blockstates/<name>.json` in `pack.json`) and the open volume's own block states, searchable by words; without a pack only the volume's blocks are listed. Any block can be typed, with properties.
- **Block-state panel:** `blockProperties` for the block last pointed at (it stays when the pointer moves to the panel). Booleans are a drop-down; other values are an input with the suggestions as a datalist, so any value can be typed; a new property can be added.
- **Export:** converting now encodes the page's current volume, through core's codecs and the loss report, on the main thread (the worker's copy of the file is only used by the software renderer). The file opened is never written; the download is a new file, named `<name>-edited.<ext>` once there are edits.
- **Unsaved edits:** `beforeunload` asks while there are edits that were neither exported nor undone, and opening another file asks first. This is slightly narrower than "history is not empty": exporting counts as saving.
- **Viewer only:** the software renderer (no WebGL2) and devices whose only pointer is a touch screen (`any-pointer: coarse` with no `fine`) get no editor; the page says so.

**Renderer fix found on the way:** `highlight()` did not ask for a frame to be drawn, so outlines appeared only when something else redrew. It does now.

**How it was verified.** `pnpm test`: 39 files, 628 passed and 190 skipped (before M3: 38 files, 605 passed; new are the `accept` option, `pickRay` against three.js, and 20 tests for the shortcuts, the palette and the ray helpers). `pnpm check` has no errors (its warnings are the Biome blind spot for names used only in Svelte templates), `pnpm typecheck`, `pnpm depcheck` and `pnpm --filter @voxwright/web build` pass. `node apps/web/test/e2e.ts` passes 159 checks in Chromium on SwiftShader: the existing GPU and software-renderer runs, and a new editor run (`apps/web/test/editor-suite.ts`) that opens `fixtures/real/rafeals-house/Rafeals_house.litematic` and, with real mouse and keyboard events, places a block, replaces one, sets `facing` and `waterlogged` in the panel, erases one, drags a line of 14 blocks as one undo step, undoes and redoes with the keys and the buttons, picks a block with the eyedropper, draws a line, a filled rectangle and a hollow one, selects a box by dragging, fills it, replaces the most common block everywhere, rotates (`]`), mirrors and moves the house, copies and pastes by click, and checks that picking stops at the layer slice. After each step the page's volume is compared with the previous one cell by cell (so the editor is checked against plain arithmetic, not against itself). It exports `.litematic`, reads the file back in Node with core's codec and checks that exactly the 18 edited cells differ from the original at the first export, that the final export equals the edited volume, that size, position and DataVersion are kept, and that the source file is byte for byte unchanged. The WebGL picture is shown to change after the edit, return after undo and change again after redo. Where a step needs the result of a rotation or mirror on block states, the expected value comes from core's tools applied to a copy of the cells.

**Not done, or not verified.**

- Litematica has not opened an exported file. The codec round-trips in our tests and the exported region keeps its size and position, which is as far as this machine can check.
- Block entities are still dropped on reading (the loss report says so), so replacing or moving a chest does not carry its contents; the editor does not edit them.
- No editing in Fly mode, with the software renderer or on touch. Mirror is east-west and north-south only (core has no vertical mirror), and a selection is a box: it is dragged between two blocks, or typed in, since a drag cannot choose cells in empty air.
- Move takes typed offsets or the two up and down buttons; there is no drag-to-move. Selection actions work on hidden layers too if the box reaches them.
- Export runs on the main thread, so a very large build pauses the page while it is encoded. Edits past 512 blocks on an axis are refused by core.
- The palette lists names only (no block icons) and does not know which property values are legal for a block; core cannot tell either, so values other than booleans are suggestions.
- Hover outlines were checked in screenshots, not by an automated test of the drawn pixels; the editor run checks that the picture changes with the edit.
- Autosave is M4.

## Open items

- [x] Create the repository `lzif/voxwright` so the scaffold can start (created **private**; make it public when ready)
- [x] Choose `AGPL-3.0-only` or `AGPL-3.0-or-later` for the SPDX headers, before M0 (`AGPL-3.0-only`)
- [ ] Before M2, send fixtures saved by real tools: two or three `.schem` from WorldEdit (`.nbt`, `.litematic` and `.mcstructure` of one build are in `fixtures/real/`, saved by bloxelizer.com, not Litematica or Bedrock)
- [ ] Reserve the `@voxwright` npm organization and check the domain and trademark
- [ ] Pick the open source Bedrock to Java block-mapping table and confirm its license is AGPL-compatible (needed by M2)

Sources: the [v1 spec](https://claude.ai/artifact/GRd8qFWt6qZD7AyDE3ZPU5) and the [mcbuilder repository](https://github.com/lzif/mcbuilder) at the PR #5 merge.
