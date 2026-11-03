# SPDX-License-Identifier: AGPL-3.0-only
"""Export model-to-quads vectors from the Python faithful renderer.

For a battery of blockstates, resolves the real quads from the vanilla client
assets and records each quad's geometry (points, normal, cull, flat) and a
SHA-256 of its pixels. The assets are Mojang's and are never copied into the
repository: only these derived numbers are committed.

Usage (from the repository root, with assets fetched by `mcbuild assets fetch`):

    PYTHONPATH=reference/src PYTHONDONTWRITEBYTECODE=1 \
        uv run --with numpy --with pillow --with nbtlib \
        python vectors/export_quads_vectors.py [--assets DIR]

DIR is the `assets/minecraft` folder; the default is
~/.cache/mcbuilder/26.2/client/assets/minecraft.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from mcbuilder.render import faithful
from mcbuilder.render import fast as _fast

OUT = Path(__file__).resolve().parent

BLOCKS = [
    "minecraft:stone",
    "minecraft:oak_log[axis=y]", "minecraft:oak_log[axis=x]", "minecraft:oak_log[axis=z]",
    "minecraft:oak_planks", "minecraft:glass", "minecraft:bookshelf", "minecraft:barrel[facing=up,open=false]",
    "minecraft:barrel[facing=east,open=true]",
    "minecraft:oak_stairs[facing=north,half=bottom,shape=straight]",
    "minecraft:oak_stairs[facing=east,half=bottom,shape=straight]",
    "minecraft:oak_stairs[facing=south,half=top,shape=straight]",
    "minecraft:oak_stairs[facing=west,half=top,shape=inner_left]",
    "minecraft:oak_stairs[facing=north,half=bottom,shape=outer_right]",
    "minecraft:oak_stairs",
    "minecraft:stone_brick_stairs[facing=south,half=top,shape=inner_right]",
    "minecraft:oak_slab[type=bottom]", "minecraft:oak_slab[type=top]", "minecraft:oak_slab[type=double]",
    "minecraft:glass_pane[east=true,north=true,south=false,west=false]",
    "minecraft:glass_pane",
    "minecraft:oak_fence[east=true,north=false,south=true,west=false]",
    "minecraft:oak_fence_gate[facing=north,open=false,in_wall=false]",
    "minecraft:oak_fence_gate[facing=east,open=true,in_wall=true]",
    "minecraft:cobblestone_wall[east=low,north=tall,south=none,up=true,west=low]",
    "minecraft:cobblestone_wall[east=false,north=false,south=false,up=true,west=false]",
    "minecraft:lantern[hanging=true]", "minecraft:lantern", "minecraft:soul_lantern[hanging=false]",
    "minecraft:iron_chain[axis=y]", "minecraft:iron_chain[axis=x]",
    "minecraft:oak_door[facing=north,half=lower,hinge=left,open=false]",
    "minecraft:oak_door[facing=east,half=upper,hinge=right,open=true]",
    "minecraft:oak_trapdoor[facing=north,half=bottom,open=false]",
    "minecraft:oak_trapdoor[facing=south,half=top,open=true]",
    "minecraft:grass_block[snowy=false]", "minecraft:oak_leaves[distance=1,persistent=true]",
    "minecraft:short_grass", "minecraft:fern", "minecraft:torch", "minecraft:wall_torch[facing=east]",
    "minecraft:lever[face=wall,facing=east,powered=true]", "minecraft:oak_button[face=floor,facing=north,powered=false]",
    "minecraft:ladder[facing=west]", "minecraft:vine[east=true,north=false,south=false,up=true,west=false]",
    "minecraft:white_carpet", "minecraft:cauldron", "minecraft:hopper[facing=down]",
    "minecraft:end_rod[facing=up]", "minecraft:lightning_rod[facing=south]", "minecraft:campfire[facing=north,lit=true]",
    "minecraft:oak_sign[rotation=4]", "minecraft:oak_pressure_plate", "minecraft:flower_pot",
    "minecraft:amethyst_cluster[facing=up]", "minecraft:sea_lantern", "minecraft:dark_prismarine_slab[type=bottom]",
    "minecraft:bed", "minecraft:chest[facing=west]", "minecraft:not_a_real_block",
    "minecraft:spruce_shelf[facing=south]",
    "minecraft:water", "minecraft:lava", "minecraft:chest[facing=north]", "minecraft:chest[facing=east,type=left]",
    "minecraft:chest[facing=south]", "minecraft:trapped_chest[facing=west]", "minecraft:ender_chest[facing=north]",
    "minecraft:copper_chest[facing=south]", "minecraft:waxed_oxidized_copper_chest[facing=east]",
    "minecraft:red_banner[rotation=0]", "minecraft:blue_banner[rotation=5]", "minecraft:white_banner[rotation=15]",
    "minecraft:black_wall_banner[facing=east]", "minecraft:light_blue_wall_banner[facing=north]",
    "minecraft:unknown_banner[rotation=0]", "minecraft:pale_moss_carpet[bottom=true,east=none,north=none,south=none,west=none]",
]


class Json(dict):
    pass


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--assets", default=str(Path.home() / ".cache/mcbuilder/26.2/client/assets/minecraft"))
    args = ap.parse_args()
    root = Path(args.assets)
    if not (root / "blockstates").is_dir():
        raise SystemExit(f"no blockstates under {root}: run `mcbuild assets fetch --version 26.2`")
    tex_cache: dict = {}
    out = {"SPDX-License-Identifier": "AGPL-3.0-only", "blocks": {}}
    for canonical in BLOCKS:
        name, props = _fast._split_blockstate(canonical)
        fb: set = set()
        color = _fast._fallback_color(name)
        quads, is_fallback = faithful.resolve_block_quads(canonical, root, tex_cache, fb)
        entry = {"fallback_color": list(color), "fallback_blocks": sorted(fb), "is_fallback": bool(is_fallback)}
        if False:
            pass
        else:
            entry["quads"] = [
                {
                    "points": [list(p) for p in pts],
                    "normal": list(normal),
                    "cull": None if cull is None else list(cull),
                    "flat": bool(flat),
                    "image": {
                        "size": list(img.size),
                        "mode": img.mode,
                        "sha256": hashlib.sha256(img.tobytes()).hexdigest(),
                    },
                }
                for pts, normal, img, cull, flat in quads
            ]
        fb2: set = set()
        faces = _fast._build_face_textures(canonical, root, fb2)
        entry["face_textures"] = {
            face: {"size": list(img.size), "mode": img.mode, "sha256": hashlib.sha256(img.tobytes()).hexdigest()}
            for face, img in faces.items()
        }
        entry["face_fallback"] = sorted(fb2)
        out["blocks"][canonical] = entry
    (OUT / "quads.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
    n = sum(len(e["quads"] or []) for e in out["blocks"].values())
    print(f"wrote vectors/quads.json: {len(BLOCKS)} blockstates, {n} quads")


if __name__ == "__main__":
    main()
