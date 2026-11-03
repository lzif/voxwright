# SPDX-License-Identifier: AGPL-3.0-only
"""Export grid-level rendering vectors from the Python faithful renderer.

For a few small scenes it records, per palette entry, whether the block
occludes ambient light; per wall, fence, pane and bars cell, the inferred
connections and props; and, for every quad of every cell, whether a neighbour
culls it and its per-vertex ambient-occlusion levels. Needs the vanilla assets
(never committed): see export_quads_vectors.py.

Usage (from the repository root):

    PYTHONPATH=reference/src PYTHONDONTWRITEBYTECODE=1 \
        uv run --with numpy --with pillow --with nbtlib \
        python vectors/export_scene_vectors.py [--assets DIR]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from mcbuilder import shapes
from mcbuilder.build import Build
from mcbuilder.render import faithful
from mcbuilder.render import fast as _fast

OUT = Path(__file__).resolve().parent

S = "minecraft:stone"


def scenes():
    out = {}

    b = Build()
    with b:
        b.line((0, 0, 0), (6, 0, 0), "minecraft:cobblestone_wall")
        b.set(3, 0, 0, "minecraft:mossy_cobblestone_wall")
        b.set(7, 0, 0, "minecraft:iron_bars")
        b.set(8, 0, 0, "minecraft:oak_fence_gate[facing=north,open=false,in_wall=false]")
        b.set(3, 1, 0, S)  # stone on top of one wall: tall arms
        b.set(0, 0, 1, S)  # solid side neighbour
        b.set(5, 1, 0, "minecraft:oak_slab[type=bottom]")  # partial block above: not solid
        b.line((0, 0, 3), (0, 0, 5), "minecraft:stone_brick_wall[up=false]")
        b.set(0, 0, 4, "minecraft:stone_brick_wall[east=tall,up=true]")
        b.set(4, 0, 4, "minecraft:andesite_wall")
        b.set(4, 0, 5, "minecraft:glass_pane")
    out["walls"] = b

    b = Build()
    with b:
        b.line((0, 0, 0), (4, 0, 0), "minecraft:oak_fence")
        b.set(5, 0, 0, "minecraft:oak_fence_gate[facing=east,open=false,in_wall=false]")
        b.set(0, 0, 1, "minecraft:spruce_fence")
        b.set(2, 0, 1, S)
        b.set(2, 0, -1, "minecraft:nether_brick_fence")
        b.line((0, 0, 4), (3, 0, 4), "minecraft:glass_pane")
        b.set(4, 0, 4, "minecraft:red_stained_glass_pane")
        b.set(2, 0, 5, "minecraft:iron_bars")
        b.set(2, 0, 6, "minecraft:cobblestone_wall")
        b.set(1, 0, 5, "minecraft:oak_fence[east=false]")
        b.set(5, 0, 4, "minecraft:glass")
    out["fences"] = b

    b = Build()
    with b:
        b.box((0, 0, 0), (4, 0, 4), S)
        b.sphere((2, 2, 2), 2, "minecraft:oak_leaves[persistent=true]", hollow=True)
        b.set(2, 1, 2, "minecraft:oak_stairs[facing=east,half=bottom,shape=straight]")
        b.set(0, 1, 0, "minecraft:oak_slab[type=top]")
        b.set(4, 1, 4, "minecraft:lantern[hanging=false]")
        b.set(4, 1, 0, "minecraft:ice")
        b.set(4, 2, 0, "minecraft:slime_block")
        b.set(0, 1, 4, "minecraft:honey_block")
        b.set(2, 4, 2, "minecraft:glass")
        b.set(1, 1, 3, "minecraft:white_carpet")
        b.set(3, 1, 3, "minecraft:cauldron")
    out["ao"] = b

    b = Build()
    with b:
        b.box((0, 0, 0), (2, 2, 2), "minecraft:glass")
        b.box((4, 0, 0), (6, 1, 2), "minecraft:red_stained_glass")
        b.set(5, 1, 1, "minecraft:blue_stained_glass")
        b.box((0, 0, 4), (2, 1, 6), "minecraft:water")
        b.set(1, 1, 5, "minecraft:glass")
        b.box((4, 0, 4), (6, 1, 6), "minecraft:ice")
        b.set(5, 2, 5, "minecraft:lava")
    out["translucent"] = b

    b = Build()
    with b:
        b.box((0, 0, 0), (6, 0, 4), S)
        b.set(1, 1, 1, "minecraft:chest[facing=north]")
        b.set(2, 1, 1, S)
        b.set(4, 1, 1, "minecraft:red_banner[rotation=4]")
        b.set(5, 1, 3, "minecraft:white_wall_banner[facing=south]")
        b.set(3, 1, 3, "minecraft:ender_chest[facing=east]")
        b.set(6, 1, 1, "minecraft:water")
    out["entities"] = b
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--assets", default=str(Path.home() / ".cache/mcbuilder/26.2/client/assets/minecraft"))
    root = Path(ap.parse_args().assets)
    if not (root / "blockstates").is_dir():
        raise SystemExit(f"no blockstates under {root}: run `mcbuild assets fetch --version 26.2`")

    result = {"SPDX-License-Identifier": "AGPL-3.0-only", "scenes": {}}
    for name, build in scenes().items():
        arr, palette, _ = build.grid.to_dense()
        arr = np.asarray(arr, dtype=np.int32)
        tex_cache: dict = {}
        wall_connect = faithful._build_wall_connect(arr, palette, root, tex_cache)
        connector_connect = faithful._build_connector_connect(arr, palette, root, tex_cache)
        occ_idx = [faithful._block_occludes_ao(b, root, tex_cache) for b in palette]
        occ_padded = np.zeros(tuple(n + 2 for n in arr.shape), dtype=bool)
        valid = arr >= 0
        occ_padded[1:-1, 1:-1, 1:-1][valid] = np.array(occ_idx, dtype=bool)[arr[valid]]

        key = lambda p: f"{p[0]},{p[1]},{p[2]}"  # noqa: E731
        cells = {}
        quad_cache: dict = {}
        for x, y, z in sorted(tuple(int(v) for v in c) for c in np.argwhere(arr >= 0)):
            block = palette[int(arr[x, y, z])]
            if block == "minecraft:air":
                continue
            bname = _fast._split_blockstate(block)[0]
            inferred = None
            if faithful._is_wall_block(bname, root):
                inferred = faithful._infer_wall_props(block, x, y, z, arr, palette, wall_connect)
            elif faithful._is_horiz_connector_block(bname):
                inferred = faithful._infer_connector_props(block, x, y, z, connector_connect)
            eff = block
            if inferred:
                _, explicit = _fast._split_blockstate(block)
                merged = dict(inferred)
                merged.update(explicit)
                eff = bname + "[" + ",".join(f"{k}={v}" for k, v in sorted(merged.items())) + "]"
            if eff not in quad_cache:
                quad_cache[eff] = faithful.resolve_block_quads(eff, root, tex_cache, set())
            quads, is_fb = quad_cache[eff]
            per_quad = []
            for pts, normal, _img, cull, flat in quads:
                culled = faithful._quad_culled_by_neighbor(cull, x, y, z, arr, palette, bname, occ_padded)
                if flat:
                    ao = None
                else:
                    # The renderer moves points into world space and back out, so do the same.
                    wpts = [(px + x, py + y, pz + z) for px, py, pz in pts]
                    vl = np.asarray(wpts, dtype=float) - (x, y, z)
                    ao = [int(v) for v in faithful._quad_ao_levels(vl, faithful._snap_normal(normal), (x, y, z), occ_padded)]
                per_quad.append({"culled": bool(culled), "ao": ao})
            cells[f"{x},{y},{z}"] = {"effective": eff, "fallback": bool(is_fb), "quads": per_quad}

        result["scenes"][name] = {
            "size": list(arr.shape),
            "palette": palette,
            "data": [int(v) for v in arr.flat],
            "occludes": occ_idx,
            "walls": {key(k): v for k, v in sorted(wall_connect.items())},
            "connectors": {key(k): v for k, v in sorted(connector_connect.items())},
            "cells": cells,
        }
        print(f"{name}: {len(cells)} cells, {sum(len(c['quads']) for c in cells.values())} quads")
    (OUT / "scenes.json").write_text(json.dumps(result, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
