<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Golden vectors

JSON exported from the Python mcbuilder, which is the oracle. The TypeScript
tests read these files; CI never needs Python or the asset cache.

| File                                                                                                                           | Covers                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `blocks.json`                                                                                                                  | `parse`, `canonicalize` and `suggest`, including malformed inputs and their error kind                                                                                                                                                                                                                   |
| `rotation.json`                                                                                                                | all four rotations: positions, points about an anchor, block-state rotation and mirroring                                                                                                                                                                                                                |
| `materials.json`, `shapes.json`, `geometry.json`, `build.json`, `registry.json`, `report.json`, `config.json`, `importer.json`, `clean.json` | the mcbuilder port: weighted palettes and `patches`, every shape (65 calls, errors included), geometry transforms, whole `Build` scenarios, registry validation against a fixture registry, report and config parsing, and the importer's summary and box plan. Written by `export_mcbuilder_vectors.py` |
| `structure-nbt.json`                                                                                                           | grids written by the real exporter in all three air modes, as the parsed structure (compared before gzip, never as compressed bytes) plus the gzipped file for read tests                                                                                                                                |

Regenerate from the repository root (needs `reference/`, a checkout of
mcbuilder at the PR #5 merge):

```sh
PYTHONPATH=reference/src PYTHONDONTWRITEBYTECODE=1 \
  uv run --with numpy --with pillow --with nbtlib \
  python vectors/export_vectors.py
python vectors/export_mcbuilder_vectors.py
```

The output is deterministic. Nothing here uses the RNG, the asset cache or the
network.
