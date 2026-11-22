<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Fixtures

Schematic files shared by all tests.

- `synthetic/` holds Sponge `.schem` files (v2 and v3) written by
  `make_synthetic.py`, an encoder that is independent of the TypeScript code.
  They are **not** saved by real tools. `synthetic/expected.json` lists the
  cells each file should decode to.

- `real/rafeals-house/` holds one build saved by a real tool
  (bloxelizer.com) in three formats: `.nbt` (DataVersion 5023), `.mcstructure`
  and `.litematic`. All three describe the same 762-block house, and
  `packages/core/test/litematic.test.ts` and `mcstructure.test.ts` check the
  other two against the `.nbt`.

- `real/worldedit/` holds `fantasyhouse2.schem`, a Sponge v3 schematic saved by
  WorldEdit 7.4.6 (`enginehub:fabric`, DataVersion 5023; 22,953 blocks, 342
  block states, 93 block entities, 41 entities, non-zero `Offset`).

- `real/shulkr/` holds three Sponge v3 builds exported by Shulkr (DataVersion
  5023): `castelo-medieval.schem` (4,895 blocks, 6 block entities),
  `raifox-medivial-house.schem` (1,595 blocks, 138 block entities) and
  `simple-survival-mansion.schem` (6,218 blocks, 77 block entities).

- `real/flat-v3/` holds three real-world `.schem` files (`smp_lobby_big.schem`,
  `smp_lobby_center_dense.schem`, `smp_lobby_medieval.schem`, DataVersion 3465)
  that declare `Version: 3` while writing Sponge v2's flat layout (top-level
  `Palette` and `BlockData` without `Schematic`/`Blocks`). `readSchem` accepts
  this layout with a warning.

- `real/legacy/` holds `storageroom-medieval.schematic` (pre-1.13 MCEdit
  `Materials: "Alpha"` format), used to verify legacy `.schematic` rejection.

`packages/core/test/real-fixtures.test.ts`, `convert.test.ts` and
`packages/voxmc/test/importer.test.ts` read and convert these fixtures.
