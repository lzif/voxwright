# SPDX-License-Identifier: AGPL-3.0-only
"""Run the Python example scripts and record what they build.

For each example the output has the cell count, bounds, per-block counts and
a SHA-256 over every cell (`x,y,z block` lines, sorted by x, y, z). The
TypeScript ports in packages/mcbuilder/examples must reproduce all of it.

Examples that draw from `BUILD.rng()` are skipped: the TypeScript port uses a
different PRNG on purpose, so their output cannot match.

Usage (from the repository root):

    PYTHONPATH=reference/src PYTHONDONTWRITEBYTECODE=1 \
        uv run --with numpy --with pillow --with nbtlib \
        python vectors/export_examples_vectors.py [--dump DIR]

`--dump DIR` also writes every cell of every example to DIR/<name>.txt, for
finding the first difference when a port does not match.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import runpy
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent
EXAMPLES = OUT.parent / "reference" / "examples"

# name -> script path relative to reference/examples. Scripts that call
# BUILD.rng() are listed in SKIPPED instead.
SCRIPTS = {
    "underwater_base": "underwater_base/underwater_base.py",
    "storehouse": "storehouse/storehouse.py",
    "homestead-house": "homestead/house.py",
    "homestead-barn": "homestead/barn.py",
    "homestead-well": "homestead/well.py",
    "waystone-classic-ruin": "waystones/waystone_classic_ruin.py",
    "waystone-dark-ritual": "waystones/waystone_dark_ritual.py",
    "waystone-rustic-path": "waystones/waystone_rustic_path.py",
    "waystone-s5": "waystones/waystone_s5.py",
    "waystone-s5-argon": "waystones/waystone_s5_argon.py",
    "waystone-skystead": "waystones/waystone_skystead.py",
}
# Examples that draw from BUILD.rng(). The TypeScript PRNG differs on purpose,
# so which block lands in a randomly chosen cell cannot match. Positions can:
# a cell is set (or not) regardless of what the RNG picks. Each entry lists the
# blocks the RNG may place; every other block is compared exactly.
RNG_EXAMPLES = {
    "crystal_observatory": {
        "script": "crystal_observatory/crystal_observatory.py",
        "rng_blocks": [
            "minecraft:deepslate", "minecraft:cobbled_deepslate", "minecraft:tuff",
            "minecraft:stone", "minecraft:andesite", "minecraft:cobblestone",
            "minecraft:moss_block", "minecraft:grass_block", "minecraft:rooted_dirt",
            "minecraft:stone_bricks", "minecraft:mossy_stone_bricks",
            "minecraft:cracked_stone_bricks", "minecraft:polished_andesite",
            "minecraft:oxidized_cut_copper", "minecraft:weathered_cut_copper",
            "minecraft:prismarine_bricks",
        ],
    },
    "homestead-watchtower": {
        "script": "homestead/watchtower.py",
        "rng_blocks": [
            "minecraft:stone_bricks", "minecraft:mossy_stone_bricks", "minecraft:cracked_stone_bricks",
        ],
    },
}


def run_script(rel: str):
    path = EXAMPLES / rel
    sys.path.insert(0, str(path.parent))
    try:
        ns = runpy.run_path(str(path), run_name=f"example_{path.stem}")
    finally:
        sys.path.pop(0)
        for m in [m for m in sys.modules if m == "common"]:
            del sys.modules[m]
    return ns["BUILD"]


def digest(build):
    grid = build.grid
    cells = sorted([x, y, z, grid._palette[idx]] for (x, y, z), idx in grid._cells.items())
    lines = [f"{x},{y},{z} {b}" for x, y, z, b in cells]
    counts: dict[str, int] = {}
    for *_, b in cells:
        counts[b] = counts.get(b, 0) + 1
    bb = build.bounds()
    return lines, {
        "cells": len(cells),
        "non_air": grid.count_non_air(),
        "bounds": None if bb is None else [list(bb[0]), list(bb[1])],
        "overwrites": grid.overwrite_count,
        "counts": dict(sorted(counts.items())),
        "sha256": hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest(),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dump")
    args = ap.parse_args()
    out = {"SPDX-License-Identifier": "AGPL-3.0-only", "examples": {}, "rng_examples": {}}
    for name, rel in SCRIPTS.items():
        lines, d = digest(run_script(rel))
        out["examples"][name] = {"script": rel, **d}
        if name == "underwater_base":
            sys.path.insert(0, str(EXAMPLES / "underwater_base"))
            from leak_check import leaks  # noqa: E402

            found = [[list(a), list(b)] for a, b in leaks(run_script(rel))]
            out["examples"][name]["leaks"] = {"count": len(found), "first": found[:10]}
        if args.dump:
            Path(args.dump).mkdir(parents=True, exist_ok=True)
            (Path(args.dump) / f"{name}.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"{name}: {d['cells']} cells, {d['sha256'][:12]}")
    for name, spec in RNG_EXAMPLES.items():
        build = run_script(spec["script"])
        lines, d = digest(build)
        positions = [ln.split(" ", 1)[0] for ln in lines]
        fixed = {b: n for b, n in d["counts"].items() if b not in spec["rng_blocks"]}
        out["rng_examples"][name] = {
            "script": spec["script"],
            "cells": d["cells"],
            "bounds": d["bounds"],
            "overwrites": d["overwrites"],
            "rng_blocks": spec["rng_blocks"],
            "rng_cells": d["cells"] - sum(fixed.values()),
            "fixed_counts": dict(sorted(fixed.items())),
            "positions_sha256": hashlib.sha256("\n".join(positions).encode("utf-8")).hexdigest(),
        }
        print(f"{name}: {d['cells']} cells (positions {out['rng_examples'][name]['positions_sha256'][:12]})")
    (OUT / "examples.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
