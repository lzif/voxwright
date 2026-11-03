# SPDX-License-Identifier: AGPL-3.0-only
"""Export golden vectors from the Python mcbuilder (the oracle).

Calls the real mcbuilder functions over a grid of inputs and writes JSON
next to this file. The TypeScript tests read that JSON. Output is
deterministic, so re-running without changing mcbuilder or this script
leaves the files byte-identical.

Usage (from the repository root):

    PYTHONPATH=reference/src PYTHONDONTWRITEBYTECODE=1 \
        uv run --with numpy --with pillow --with nbtlib \
        python vectors/export_vectors.py

Nothing here needs the asset cache or the network.
"""

from __future__ import annotations

import base64
import gzip
import itertools
import json
import tempfile
from pathlib import Path

import nbtlib

from mcbuilder import blocks, rotation
from mcbuilder.errors import McbuilderError
from mcbuilder.export_nbt import write_structure_nbt
from mcbuilder.voxels import VoxelGrid

OUT = Path(__file__).resolve().parent

DIRECTIONAL_STATES = [
    "minecraft:stone",
    "minecraft:oak_stairs[facing=north,half=bottom,shape=straight]",
    "minecraft:oak_stairs[facing=east,half=top,shape=inner_left]",
    "minecraft:oak_stairs[facing=south,half=bottom,shape=outer_right,waterlogged=true]",
    "minecraft:oak_stairs[facing=west]",
    "minecraft:oak_log[axis=x]",
    "minecraft:oak_log[axis=y]",
    "minecraft:oak_log[axis=z]",
    "minecraft:hopper[facing=down]",
    "minecraft:barrel[facing=up,open=false]",
    "minecraft:oak_sign[rotation=0]",
    "minecraft:oak_sign[rotation=5]",
    "minecraft:white_banner[rotation=15]",
    "minecraft:oak_fence[east=true,north=false,south=true,west=false]",
    "minecraft:glass_pane[east=true,north=true,south=false,west=false,waterlogged=false]",
    "minecraft:cobblestone_wall[east=low,north=tall,south=none,up=true,west=low]",
    "minecraft:vine[east=true,north=false,south=false,up=true,west=false]",
    "minecraft:crafter[orientation=north_up,crafting=false]",
    "minecraft:crafter[orientation=east_down]",
    "minecraft:crafter[orientation=up_north]",
    "minecraft:oak_door[facing=north,half=lower,hinge=left,open=true]",
    "minecraft:chest[facing=south,type=left]{Items:[{Slot:0b,id:\"minecraft:stone\"}]}",
    "minecraft:furnace[facing=east]{BurnTime:200s}",
    "minecraft:oak_slab[type=double]",
    "minecraft:lever[face=wall,facing=west,powered=true]",
]

BLOCK_INPUTS = [
    "minecraft:stone",
    "stone",
    "minecraft:oak_stairs[facing=north,half=bottom]",
    "minecraft:oak_stairs[half=bottom,facing=north]",
    "minecraft:oak_stairs[ facing = north , half = bottom ]",
    "minecraft:chest{Items:[{Slot:0b,id:\"minecraft:stone\"}]}",
    "minecraft:furnace[facing=east]{BurnTime:200s}",
    "minecraft:furnace{ZZ:1b,AA:2b}",
    "minecraft:furnace{ ZZ : 1b , AA : 2b }",
    "minecraft:furnace{}",
    "minecraft:sign{Text:\"a,b}\",Other:'x]'}",
    "minecraft:sign{Text:\"esc\\\"aped,\",A:1}",
    "minecraft:chest{Items:[{Slot:0b},{Slot:1b}],Lock:\"k\"}",
    "",
    "[facing=north]",
    "minecraft:stone[",
    "minecraft:stone[]",
    "minecraft:stone[facing]",
    "minecraft:stone[facing=]",
    "minecraft:stone[=north]",
    "minecraft:stone[facing=north,facing=south]",
    "minecraft:stone[facing=north]]",
    "minecraft:stone{a:1}[facing=north]",
    "minecraft:stone{a:1",
    "minecraft:stone{a:1}}",
    "minecraft:stone{a:1}x",
    "minecraft:stone{a:\"unterminated}",
    "minecraft:stone{a}",
    "minecraft:stone{:1}",
    "minecraft:stone{a:1,,b:2}",
    "minecraft:stone{a:[1,2}",
    "minecraft: stone",
    "mine craft:stone",
    "minecraft:stone,x",
    "minecraft:sto]ne",
]

ROTATIONS = list(rotation.ROTATIONS)


def result(fn, *args):
    try:
        return {"ok": fn(*args)}
    except (ValueError, McbuilderError) as e:
        return {"error": type(e).__name__}


def blocks_vectors() -> dict:
    cases = []
    for s in BLOCK_INPUTS:
        case = {"input": s}
        parsed = result(blocks.parse, s)
        if "ok" in parsed:
            name, props, nbt = parsed["ok"]
            case["parse"] = {"name": name, "props": props, "nbt": nbt}
        else:
            case["parse"] = parsed
        case["canonical"] = result(blocks.canonicalize, s)
        cases.append(case)
    suggest = []
    candidates = [
        "minecraft:oak_stairs",
        "minecraft:oak_slab",
        "minecraft:spruce_stairs",
        "minecraft:stone_stairs",
        "minecraft:stone",
        "minecraft:stone_bricks",
        "create:oak_stairs",
    ]
    for name, n in [("oak_stair", 3), ("minecraft:oak_stairs", 3), ("stoen", 2), ("zzzz", 3), ("stone", 0), ("stone", 10)]:
        suggest.append({"name": name, "candidates": candidates, "n": n, "result": blocks.suggest(name, candidates, n)})
    return {"cases": cases, "suggest": suggest}


def rotation_vectors() -> dict:
    positions = []
    for size in range(1, 7):
        for x, z in itertools.product(range(size), repeat=2):
            for rot in ROTATIONS:
                positions.append({"x": x, "z": z, "size": size, "rotation": rot, "result": list(rotation.rotate_position(x, z, size, rot))})
    points = []
    for (x, z), (ax, az), rot in itertools.product(
        [(0, 0), (3, 1), (-2, 5)], [(0, 0), (1, 1), (-1, 2)], ROTATIONS
    ):
        points.append({"x": x, "z": z, "ax": ax, "az": az, "rotation": rot, "result": list(rotation._rotate_point(x, z, ax, az, rot))})
    states = []
    for s in DIRECTIONAL_STATES:
        c = blocks.canonicalize(s)
        for rot in ROTATIONS:
            states.append({"input": c, "rotation": rot, "result": rotation.rotate_blockstate(c, rot)})
    mirrors = []
    for s in DIRECTIONAL_STATES:
        c = blocks.canonicalize(s)
        for axis in ("x", "z"):
            mirrors.append({"input": c, "axis": axis, "result": rotation.mirror_blockstate(c, axis)})
    invalid = [
        {"call": "rotate_position", "rotation": "SIDEWAYS", "error": result(rotation.rotate_position, 0, 0, 3, "SIDEWAYS")["error"]},
        {"call": "rotate_blockstate", "rotation": "SIDEWAYS", "error": result(rotation.rotate_blockstate, "minecraft:stone", "SIDEWAYS")["error"]},
        {"call": "mirror_blockstate", "axis": "y", "error": result(rotation.mirror_blockstate, "minecraft:stone", "y")["error"]},
    ]
    return {"rotations": ROTATIONS, "positions": positions, "points": points, "blockstates": states, "mirrors": mirrors, "invalid": invalid}


GRIDS = {
    "single": [[0, 0, 0, "minecraft:stone"]],
    "offset-negative": [[-1, 2, -3, "minecraft:stone"], [1, 2, 0, "minecraft:oak_planks"]],
    "stairs-and-props": [
        [0, 0, 0, "minecraft:oak_stairs[half=bottom,facing=north]"],
        [1, 0, 0, "minecraft:oak_stairs[facing=east,half=top]"],
        [0, 1, 2, "minecraft:stone"],
        [2, 1, 1, "minecraft:oak_log[axis=x]"],
    ],
    "overwrite": [
        [0, 0, 0, "minecraft:stone"],
        [1, 0, 0, "minecraft:dirt"],
        [0, 0, 0, "minecraft:oak_planks"],
        [1, 0, 0, "minecraft:dirt"],
    ],
    "carved-air": [
        [0, 0, 0, "minecraft:stone"],
        [2, 0, 0, "minecraft:stone"],
        [1, 0, 0, "minecraft:air"],
        [0, 3, 0, "minecraft:air"],
        [2, 2, 2, "minecraft:cobblestone"],
    ],
    "block-entity-nbt": [
        [0, 0, 0, "minecraft:chest[facing=north]{Items:[]}"],
        [1, 0, 0, "minecraft:stone"],
    ],
    "air-only": [[0, 0, 0, "minecraft:air"], [1, 1, 1, "minecraft:air"]],
    "fully-overwritten-first": [
        [0, 0, 0, "minecraft:glass"],
        [0, 0, 0, "minecraft:stone"],
        [1, 0, 0, "minecraft:dirt"],
    ],
}


def nbt_to_json(tag):
    if isinstance(tag, nbtlib.Compound):
        return {k: nbt_to_json(v) for k, v in tag.items()}
    if isinstance(tag, list):
        return [nbt_to_json(v) for v in tag]
    if isinstance(tag, nbtlib.String):
        return str(tag)
    return int(tag)


def structure_vectors() -> dict:
    cases = []
    with tempfile.TemporaryDirectory() as tmp:
        for name, placements in GRIDS.items():
            for air in ("none", "explicit", "all"):
                grid = VoxelGrid()
                for x, y, z, block in placements:
                    grid.place(x, y, z, blocks.canonicalize(block), None)
                path = Path(tmp) / "out.nbt"
                case = {
                    "name": f"{name}/{air}",
                    "placements": placements,
                    "air": air,
                    "dataVersion": 4903,
                }
                try:
                    warnings = write_structure_nbt(grid, path, data_version=4903, air=air)
                except McbuilderError as e:
                    case["error"] = type(e).__name__
                else:
                    raw = path.read_bytes()
                    root = nbtlib.File.parse(__import__("io").BytesIO(gzip.decompress(raw)))
                    case["warnings"] = warnings
                    case["parsed"] = nbt_to_json(root)
                    case["gzipBase64"] = base64.b64encode(raw).decode("ascii")
                cases.append(case)
    return {"cases": cases}


def write(name: str, data: dict) -> None:
    # JSON has no comments, so the SPDX identifier is the first key.
    data = {"SPDX-License-Identifier": "AGPL-3.0-only", **data}
    (OUT / name).write_text(json.dumps(data, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    print(f"wrote vectors/{name}")


if __name__ == "__main__":
    write("blocks.json", blocks_vectors())
    write("rotation.json", rotation_vectors())
    write("structure-nbt.json", structure_vectors())
