<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Golden vectors

JSON exported from the Python mcbuilder, which is the oracle. The TypeScript
tests read these files; CI never needs Python. Four of the files (`quads.json`,
`scenes.json`, `renders.json`, `guides.json`) are computed from Mojang's assets,
and the tests that read them need the asset cache too: they skip without it, and
CI fetches it (see the end).

| File                                                                                                                                         | Covers                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `blocks.json`                                                                                                                                | `parse`, `canonicalize` and `suggest`, including malformed inputs and their error kind                                                                                                                                                                                                                   |
| `rotation.json`                                                                                                                              | all four rotations: positions, points about an anchor, block-state rotation and mirroring                                                                                                                                                                                                                |
| `structure-nbt.json`                                                                                                                         | grids written by the real exporter in all three air modes, as the parsed structure (compared before gzip, never as compressed bytes) plus the gzipped file for read tests                                                                                                                                |
| `materials.json`, `shapes.json`, `geometry.json`, `build.json`, `registry.json`, `report.json`, `config.json`, `importer.json`, `clean.json` | the mcbuilder port: weighted palettes and `patches`, every shape (65 calls, errors included), geometry transforms, whole `Build` scenarios, registry validation against a fixture registry, report and config parsing, and the importer's summary and box plan. Written by `export_mcbuilder_vectors.py` |
| `diff.json`, `views.json`                                                                                                                    | `mcbuild diff` (cell diff, report text, run-id resolution) and the view list (parsing, defaults, the 36-view cap). Written by `export_mcbuilder_vectors.py`                                                                                                                                              |
| `examples.json`                                                                                                                              | what each Python example script builds: cell count, bounds, per-block counts and a SHA-256 over every cell. Written by `export_examples_vectors.py`. Examples that use the RNG are left out, because the port uses a different PRNG                                                                      |
| `quads.json`                                                                                                                                 | 77 blockstates resolved to quads by the faithful renderer: each quad's geometry and a SHA-256 of its pixels, plus the per-face textures of the "textured cube" look. Written by `export_quads_vectors.py`                                                                                                |
| `scenes.json`                                                                                                                                | a few small scenes: which blocks occlude ambient light, inferred wall, fence, pane and bars connections, neighbour culling and per-vertex ambient occlusion. Written by `export_scene_vectors.py`                                                                                                        |
| `renders.json`                                                                                                                               | four example builds in three views: output size and a small average-colour thumbnail of the Python render, drawn without the title, label and compass. Written by `export_render_vectors.py`                                                                                                             |
| `guides.json`                                                                                                                                | for a few example builds, the exact `guide.md` text and each layer image's size and thumbnail. Written by `export_guide_vectors.py`                                                                                                                                                                      |

Regenerate from the repository root (needs `reference/`, a checkout of
mcbuilder at the PR #5 merge):

```sh
PYTHONPATH=reference/src PYTHONDONTWRITEBYTECODE=1 \
  uv run --with numpy --with pillow --with nbtlib \
  python vectors/export_vectors.py
python vectors/export_mcbuilder_vectors.py
python vectors/export_examples_vectors.py
```

Those three need no network and no asset cache. The output is deterministic.
The four renderer exporters read Mojang's client assets, which are never
committed, so fetch them first and run each with the same `PYTHONPATH` and `uv`
prefix as above:

```sh
node packages/mcbuilder/bin/mcbuild.ts assets fetch --version 26.2
python vectors/export_quads_vectors.py    # --assets DIR
python vectors/export_scene_vectors.py    # --assets DIR
python vectors/export_render_vectors.py   # --cache DIR
python vectors/export_guide_vectors.py    # --cache DIR
```

The default for `--assets` is `~/.cache/mcbuilder/26.2/client/assets/minecraft`
and for `--cache` it is `~/.cache/mcbuilder/26.2`.

Which tests need the assets: the tests for `quads.json`, `scenes.json`,
`renders.json` and `guides.json`, and the mesher test that compares the WebGL
mesher with the CPU pipeline. Without the cache they are skipped (190 tests on a
machine that has none). CI fetches the assets, keeps them between runs and runs
them; four textured-cube cases in `quads.json` stay skipped because the original
picks a texture in hash order.
