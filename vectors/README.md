<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Golden vectors

JSON exported from the Python mcbuilder, which is the oracle. The TypeScript
tests read these files; CI never needs Python. Four of the files (`quads.json`,
`scenes.json`, `renders.json`, `guides.json`) are computed from Mojang's assets,
and the tests that read them need the asset cache too: they skip without it, and
CI fetches it (see the end).

| File                                                                                                                                         | Covers                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `blocks.json`                                                                                                                                | `parse`, `canonicalize` and `suggest`, including malformed inputs and their error kind                                                                                                                                                                         |
| `rotation.json`                                                                                                                              | all four rotations: positions, points about an anchor, block-state rotation and mirroring                                                                                                                                                                      |
| `structure-nbt.json`                                                                                                                         | grids written by the real exporter in all three air modes, as the parsed structure (compared before gzip, never as compressed bytes) plus the gzipped file for read tests                                                                                      |
| `materials.json`, `shapes.json`, `geometry.json`, `build.json`, `registry.json`, `report.json`, `config.json`, `importer.json`, `clean.json` | the mcbuilder port: weighted palettes and `patches`, every shape (65 calls, errors included), geometry transforms, whole `Build` scenarios, registry validation against a fixture registry, report and config parsing, and the importer's summary and box plan |
| `diff.json`, `views.json`                                                                                                                    | `mcbuild diff` (cell diff, report text, run-id resolution) and the view list (parsing, defaults, the 36-view cap)                                                                                                                                              |
| `examples.json`                                                                                                                              | what each Python example script builds: cell count, bounds, per-block counts and a SHA-256 over every cell. Examples that use the RNG are left out, because the port uses a different PRNG                                                                     |
| `quads.json`                                                                                                                                 | 77 blockstates resolved to quads by the faithful renderer: each quad's geometry and a SHA-256 of its pixels, plus the per-face textures of the "textured cube" look                                                                                            |
| `scenes.json`                                                                                                                                | a few small scenes: which blocks occlude ambient light, inferred wall, fence, pane and bars connections, neighbour culling and per-vertex ambient occlusion                                                                                                    |
| `renders.json`                                                                                                                               | four example builds in three views: output size and a small average-colour thumbnail of the Python render, drawn without the title, label and compass                                                                                                          |
| `guides.json`                                                                                                                                | for a few example builds, the exact `guide.md` text and each layer image's size and thumbnail                                                                                                                                                                  |

Fetch the asset cache these tests need with:

```sh
node packages/mcbuilder/bin/mcbuild.ts assets fetch --version 26.2
```

Which tests need the assets: the tests for `quads.json`, `scenes.json`,
`renders.json` and `guides.json`, and the mesher test that compares the WebGL
mesher with the CPU pipeline. Without the cache they are skipped (190 tests on a
machine that has none). CI fetches the assets, keeps them between runs and runs
them; four textured-cube cases in `quads.json` stay skipped because the original
picks a texture in hash order.
