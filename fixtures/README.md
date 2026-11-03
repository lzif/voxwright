<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Fixtures

Schematic files shared by all tests.

- `synthetic/` holds Sponge `.schem` files (v2 and v3) written by
  `make_synthetic.py`, an encoder that is independent of the TypeScript code.
  They are **not** saved by real tools. `synthetic/expected.json` lists the
  cells each file should decode to.

- `real/rafeals-house/` holds one build saved by a real tool
  (bloxelizer.com) in three formats: `.nbt` (DataVersion 5023), `.mcstructure`
  and `.litematic`. All three describe the same 762-block house, so once the
  M2 codecs exist they can be checked against each other.

Still needed: files saved by real tools (two or three `.schem` from
WorldEdit). Put them in a directory per tool and add tests that read them.
