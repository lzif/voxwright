# SPDX-License-Identifier: AGPL-3.0-only
"""Export golden vectors for the mcbuilder port: materials, shapes and builds.

Calls the real Python functions over a grid of inputs and writes JSON next to
this file. Callables cannot be serialized, so materials are written as small
descriptors that both languages build the same way:

    "minecraft:stone"                             one block
    {"palette": [block | [block, weight], ...]}   weighted palette
    {"patches": {"palette": [...], "scale": n, "salt": s}}
    {"checker": [a, b]}                           a where (x + y + z) is even, else b

Seeded builds that use the RNG are not covered: the TypeScript port uses a
different PRNG on purpose.

Usage (from the repository root):

    PYTHONPATH=reference/src PYTHONDONTWRITEBYTECODE=1 \
        uv run --with numpy --with pillow --with nbtlib \
        python vectors/export_mcbuilder_vectors.py
"""

from __future__ import annotations

import json
from pathlib import Path

from mcbuilder import shapes
from mcbuilder.build import Build, BuildError
from mcbuilder.errors import McbuilderError
from mcbuilder.geometry import Geometry
from mcbuilder.materials import _unit_hash, patches, resolve_material
from mcbuilder.voxels import GridBoundsError

OUT = Path(__file__).resolve().parent

STONE = "minecraft:stone"
STAIRS = "minecraft:oak_stairs"


def material(d):
    if isinstance(d, str):
        return d
    if "palette" in d:
        return [tuple(e) if isinstance(e, list) else e for e in d["palette"]]
    if "patches" in d:
        p = d["patches"]
        return patches(
            [tuple(e) if isinstance(e, list) else e for e in p["palette"]],
            scale=p.get("scale", 4.0),
            salt=p.get("salt", ""),
        )
    if "checker" in d:
        a, b = d["checker"]
        return lambda x, y, z: a if (x + y + z) % 2 == 0 else b
    raise ValueError(d)


def error_name(e: Exception) -> str:
    for cls in (GridBoundsError, BuildError, McbuilderError, TypeError, ValueError):
        if isinstance(e, cls):
            return cls.__name__
    return type(e).__name__


def run(fn):
    try:
        return {"ok": fn()}
    except Exception as e:  # noqa: BLE001 - recorded as a vector
        return {"error": error_name(e)}


def cells(geo: Geometry):
    return [list(c) for c in geo.cells()]


# --------------------------------------------------------------------------- materials

PALETTES = {
    "two": {"palette": [STONE, ["minecraft:mossy_stone_bricks", 0.4]]},
    "three": {"palette": [["minecraft:a", 3], "minecraft:b", ["minecraft:c", 0.5], ["minecraft:d[x=1,y=2]", 0]]},
    "props": {"palette": ["minecraft:oak_stairs[half=bottom,facing=north]", "minecraft:oak_stairs[facing=south]"]},
}


def materials_vectors():
    seeds = [None, 0, 7, "abc", -3]
    coords = [(x, y, z) for x in (-2, 0, 5) for y in (0, 3) for z in (-1, 0, 4)]
    hashes = [
        {"key": list(k), "result": _unit_hash(*k)}
        for k in [(None, 0, 0, 0), (7, 1, 2, 3), ("abc", -1, -2, -3), ("patches", "", 0, 0, 0), ("patches", "salt", -4, 5, 6)]
    ]
    picks = []
    for name, spec in PALETTES.items():
        for seed in seeds:
            for x, y, z in coords:
                picks.append(
                    {"palette": name, "seed": seed, "at": [x, y, z], "result": resolve_material(material(spec), x, y, z, seed)}
                )
    plain = [
        {"spec": "minecraft:oak_stairs[half=bottom,facing=north]", "result": resolve_material("minecraft:oak_stairs[half=bottom,facing=north]", 0, 0, 0)},
        {"spec": {"checker": [STONE, "dirt"]}, "at": [1, 0, 0], "result": resolve_material(material({"checker": [STONE, "dirt"]}), 1, 0, 0)},
        {"spec": {"checker": [STONE, "dirt"]}, "at": [-1, 0, 0], "result": resolve_material(material({"checker": [STONE, "dirt"]}), -1, 0, 0)},
    ]
    patch_cases = []
    for p in (
        {"palette": [["minecraft:stone_bricks", 3], "minecraft:mossy_stone_bricks"], "scale": 3},
        {"palette": [["minecraft:stone_bricks", 3], "minecraft:mossy_stone_bricks"], "scale": 4, "salt": "x"},
        {"palette": ["minecraft:a", "minecraft:b", "minecraft:c"], "scale": 2.5, "salt": "q"},
    ):
        fn = material({"patches": p})
        patch_cases.append(
            {
                "patches": p,
                "grid": [[x, y, z, fn(x, y, z)] for x in range(-3, 6) for y in (0, 1) for z in range(-2, 5)],
            }
        )
    errors = []
    for name, spec in {
        "empty": [],
        "negative": [[STONE, -1]],
        "zero-sum": [[STONE, 0]],
        "bad-entry": [5],
        "bad-weight": [[STONE, "x"]],
        "malformed-block": ["minecraft:stone["],
    }.items():
        errors.append({"name": name, "spec": spec, **run(lambda s=spec: resolve_material([tuple(e) if isinstance(e, list) else e for e in s], 0, 0, 0, 1))})
    errors.append({"name": "patches-scale-zero", **run(lambda: patches(["a"], scale=0))})
    return {"hashes": hashes, "palettes": PALETTES, "picks": picks, "plain": plain, "patches": patch_cases, "errors": errors}


# --------------------------------------------------------------------------- shapes

def call(fn, args, kwargs):
    kwargs = dict(kwargs)
    for k in ("fill", "verge", "eave", "hip", "cap"):
        if k in kwargs and kwargs[k] is not None:
            kwargs[k] = material(kwargs[k])
    args = [material(a) if isinstance(a, (dict,)) else a for a in args]
    args = [tuple(a) if isinstance(a, list) and len(a) == 3 and all(isinstance(v, int) for v in a) else a for a in args]
    for k in ("target",):
        if k in kwargs:
            kwargs[k] = tuple(kwargs[k])
    return getattr(shapes, fn)(*args, **kwargs)


SHAPE_CASES = [
    # box and walls
    ("box", [[0, 0, 0], [2, 1, 3], STONE], {}),
    ("box", [[3, 2, 1], [0, 0, 0], STONE], {}),
    ("box", [[-1, -1, -1], [1, 1, 1], {"palette": [STONE, "minecraft:dirt"]}], {"seed": 5}),
    ("box", [[0, 0, 0], [3, 0, 3], {"checker": [STONE, "minecraft:dirt"]}], {}),
    ("box", [[0, 0, 0], [3, 3, 3], {"patches": {"palette": [["minecraft:stone_bricks", 3], "minecraft:mossy_stone_bricks"], "scale": 3}}], {}),
    ("box", [[0, 0, 0], [0, 0, 0], "minecraft:oak_log[axis=x]"], {}),
    ("walls", [[0, 0, 0], [4, 2, 3], STONE], {}),
    ("walls", [[0, 0, 0], [1, 1, 1], STONE], {}),
    ("walls", [[2, 0, 2], [0, 3, 0], {"palette": [STONE, "minecraft:dirt"]}], {"seed": 1}),
    ("pillar", [[1, 2, 3], 4, STONE], {}),
    ("pillar", [[0, 0, 0], 1, STONE], {}),
    # lines
    ("line", [[0, 0, 0], [5, 0, 0], STONE], {}),
    ("line", [[0, 0, 0], [5, 3, 2], STONE], {}),
    ("line", [[5, 3, 2], [0, 0, 0], STONE], {}),
    ("line", [[0, 0, 0], [0, 0, 0], STONE], {}),
    ("line", [[0, 0, 0], [7, 7, 7], STONE], {}),
    ("line", [[-3, 2, 1], [4, -2, -5], STONE], {}),
    ("line", [[0, 0, 0], [1, 6, 1], STONE], {}),
    ("line", [[0, 0, 0], [3, 8, 5], {"palette": [STONE, "minecraft:dirt"]}], {"seed": 2}),
    # stairs
    ("stairs", [[0, 0, 0], "north", STAIRS], {"length": 4}),
    ("stairs", [[0, 0, 0], "east", STAIRS], {"length": 3, "width": 2}),
    ("stairs", [[2, 1, 2], "south", STAIRS], {"target": [2, 4, 5]}),
    ("stairs", [[2, 1, 2], "West", "minecraft:oak_stairs[waterlogged=true]"], {"length": 2, "width": 3}),
    ("stairs", [[0, 0, 0], "north", {"palette": ["minecraft:oak_stairs", "minecraft:spruce_stairs"]}], {"length": 5, "seed": 3}),
    # cylinders
    ("cylinder", [[0, 0, 0], 3, 4, STONE], {}),
    ("cylinder", [[0, 0, 0], 1, 1, STONE], {}),
    ("cylinder", [[1, 2, 3], 4, 3, STONE], {"hollow": True}),
    ("cylinder", [[0, 0, 0], 4, 2, STONE], {"hollow": True, "fill": "minecraft:air"}),
    ("cylinder", [[0, 0, 0], 3, 5, STONE], {"axis": "x"}),
    ("cylinder", [[0, 0, 0], 3, 5, STONE], {"axis": "z", "hollow": True}),
    ("cylinder", [[0, 0, 0], 2, 3, {"palette": [STONE, "minecraft:dirt"]}], {"seed": 4}),
    # spheres
    ("sphere", [[0, 0, 0], 3, STONE], {}),
    ("sphere", [[0, 0, 0], 1, STONE], {}),
    ("sphere", [[2, 2, 2], 4, STONE], {"hollow": True}),
    ("sphere", [[0, 0, 0], 5, STONE], {"hollow": True, "thickness": 2}),
    ("sphere", [[0, 0, 0], 4, STONE], {"dome": True, "hollow": True, "fill": "minecraft:air"}),
    ("sphere", [[0, 0, 0], 3, STONE], {"hollow": True, "thickness": 9}),
    # cones
    ("cone", [[0, 0, 0], 4, 6, STONE], {}),
    ("cone", [[0, 0, 0], 3, 3, STONE], {"hollow": True}),
    ("cone", [[1, 1, 1], 5, 9, STONE], {"hollow": True}),
    ("cone", [[0, 0, 0], 1, 1, STONE], {}),
    ("cone", [[0, 0, 0], 2, 7, STONE], {}),
    # gable roofs
    ("roof_gable", [[0, 0, 0], [6, 0, 4], STAIRS], {"ridge": "x"}),
    ("roof_gable", [[0, 0, 0], [6, 0, 5], STAIRS], {"ridge": "x"}),
    ("roof_gable", [[0, 0, 0], [4, 0, 6], STAIRS], {"ridge": "z"}),
    ("roof_gable", [[0, 2, 0], [5, 2, 5], STAIRS], {"ridge": "z"}),
    ("roof_gable", [[0, 0, 0], [6, 0, 4], STAIRS], {"ridge": "x", "verge": "minecraft:spruce_stairs", "eave": "minecraft:birch_stairs"}),
    ("roof_gable", [[0, 0, 0], [3, 0, 3], "minecraft:oak_stairs[half=top]"], {"ridge": "x"}),
    # hip roofs
    ("roof_hip", [[0, 0, 0], [6, 0, 6], STAIRS], {"hip": "minecraft:oak_planks"}),
    ("roof_hip", [[0, 0, 0], [8, 0, 4], STAIRS], {"hip": "minecraft:oak_planks"}),
    ("roof_hip", [[0, 0, 0], [5, 0, 5], STAIRS], {"hip": "minecraft:oak_planks", "cap": "minecraft:gold_block"}),
    ("roof_hip", [[0, 0, 0], [2, 0, 6], STAIRS], {"hip": "minecraft:oak_planks"}),
    # errors
    ("box", [[0, 0], [1, 1, 1], STONE], {}),
    ("box", [[0, 0, 0.5], [1, 1, 1], STONE], {}),
    ("pillar", [[0, 0, 0], 0, STONE], {}),
    ("stairs", [[0, 0, 0], "up", STAIRS], {"length": 2}),
    ("stairs", [[0, 0, 0], "north", STAIRS], {}),
    ("stairs", [[0, 0, 0], "north", STAIRS], {"length": 2, "target": [0, 1, -1]}),
    ("stairs", [[0, 0, 0], "north", STAIRS], {"target": [1, 1, 1]}),
    ("stairs", [[0, 0, 0], "north", "minecraft:oak_stairs[facing=east]"], {"length": 2}),
    ("stairs", [[0, 0, 0], "north", STAIRS], {"length": 2, "width": 0}),
    ("cylinder", [[0, 0, 0], 0, 3, STONE], {}),
    ("cylinder", [[0, 0, 0], 2, 3, STONE], {"axis": "w"}),
    ("sphere", [[0, 0, 0], 2, STONE], {"thickness": 0}),
    ("cone", [[0, 0, 0], 2, 0, STONE], {}),
    ("roof_gable", [[0, 0, 0], [3, 0, 3], STAIRS], {"ridge": "y"}),
    ("roof_gable", [[0, 0, 0], [3, 0, 3], "minecraft:oak_stairs[facing=north]"], {"ridge": "x"}),
    ("roof_hip", [[0, 0, 0], [3, 0, 3], "minecraft:oak_stairs[facing=north]"], {"hip": STONE}),
]


def shapes_vectors():
    out = []
    for fn, args, kwargs in SHAPE_CASES:
        r = run(lambda fn=fn, a=args, k=kwargs: cells(call(fn, a, k)))
        entry = {"fn": fn, "args": args, "kwargs": kwargs}
        if "ok" in r:
            entry["cells"] = r["ok"]
        else:
            entry["error"] = r["error"]
        out.append(entry)
    return {"cases": out}


# --------------------------------------------------------------------------- geometry and build

def geometry_vectors():
    base = shapes.stairs((0, 0, 0), "north", STAIRS, length=3)
    base = base + shapes.box((0, 0, 0), (1, 0, 1), "minecraft:oak_log[axis=x]")
    base = base + shapes.line((2, 0, 0), (2, 0, 3), "minecraft:oak_fence[north=true,south=false]")
    cases = {"base": cells(base), "shift": cells(base.shift(3, -1, 2))}
    for rot in ("NONE", "CLOCKWISE_90", "CLOCKWISE_180", "COUNTERCLOCKWISE_90"):
        cases[f"rotate-{rot}"] = cells(base.rotate(rot))
        cases[f"rotate-anchor-{rot}"] = cells(base.rotate(rot, anchor=(1, 0, 2)))
    cases["mirror-x"] = cells(base.mirror("x"))
    cases["mirror-z"] = cells(base.mirror("z"))
    cases["carve"] = cells(base.carve((1, 0, 0), (0, 5, 5)))
    cases["bounds"] = [list(b) for b in base.bounds()]
    errors = {
        "rotate-bad": run(lambda: cells(base.rotate("SIDEWAYS"))),
        "mirror-bad": run(lambda: cells(base.mirror("y"))),
        "shift-float": run(lambda: cells(base.shift(1.5, 0, 0))),
    }
    return {"base": [list(c) for c in base.cells()], "cases": cases, "errors": errors}


def make_build(op_seed, dims):
    return Build(seed=op_seed, max_dimensions=tuple(dims))


def apply(b: Build, op: dict):
    kind = op["op"]
    if kind == "set":
        b.set(*op["at"], material(op["block"]))
    elif kind == "carve":
        b.carve(tuple(op["c1"]), tuple(op["c2"]))
    elif kind == "recenter":
        b.recenter()
    elif kind == "shape":
        geo = call(op["fn"], op["args"], op.get("kwargs", {}))
        b.place(geo, at=tuple(op.get("at", (0, 0, 0))), rotation=op.get("rotation", "NONE"))
    elif kind == "method":
        args = op["args"]
        kwargs = dict(op.get("kwargs", {}))
        for k in ("fill", "verge", "eave", "hip", "cap"):
            if k in kwargs and kwargs[k] is not None:
                kwargs[k] = material(kwargs[k])
        args = [material(a) if isinstance(a, dict) else (tuple(a) if isinstance(a, list) and len(a) == 3 and all(isinstance(v, int) for v in a) else a) for a in args]
        getattr(b, op["fn"])(*args, **kwargs)
    else:
        raise ValueError(kind)


def dump(b: Build, probes):
    grid = b.grid
    arr, palette, _ = grid.to_dense()
    cell_list = sorted([x, y, z, grid._palette[idx]] for (x, y, z), idx in grid._cells.items())
    bb = b.bounds()
    return {
        "cells": cell_list,
        "bounds": None if bb is None else [list(bb[0]), list(bb[1])],
        "overwrites": grid.overwrite_count,
        "dense": {"shape": list(arr.shape), "palette": palette, "data": [int(v) for v in arr.flat]},
        "counts": {p: b.count(p) for p in probes},
        "finds": {p: [list(c) for c in b.find(p)] for p in probes},
        "gets": {f"{x},{y},{z}": b.get(x, y, z) for (x, y, z) in [(0, 0, 0), (1, 0, 0), (0, 1, 0), (5, 5, 5)]},
    }


BUILD_SCENARIOS = {
    "house": {
        "seed": 7,
        "ops": [
            {"op": "method", "fn": "box", "args": [[0, 0, 0], [8, 0, 6], "minecraft:cobblestone"]},
            {"op": "method", "fn": "walls", "args": [[0, 1, 0], [8, 4, 6], {"palette": ["minecraft:oak_planks", ["minecraft:birch_planks", 0.3]]}]},
            {"op": "method", "fn": "roof_gable", "args": [[-1, 5, -1], [9, 5, 7], "minecraft:spruce_stairs"], "kwargs": {"ridge": "x"}},
            {"op": "carve", "c1": [3, 1, 0], "c2": [4, 2, 0]},
            {"op": "set", "at": [3, 1, 0], "block": "minecraft:oak_door[half=lower,facing=north]"},
            {"op": "set", "at": [3, 1, 0], "block": "minecraft:air"},
            {"op": "set", "at": [-4, 2, 0], "block": "minecraft:air"},
        ],
        "probes": ["minecraft:cobblestone", "minecraft:oak_planks", "minecraft:spruce_stairs[facing=north,half=bottom]"],
    },
    "overwrites": {
        "seed": None,
        "ops": [
            {"op": "set", "at": [0, 0, 0], "block": "minecraft:stone"},
            {"op": "set", "at": [0, 0, 0], "block": "minecraft:stone"},
            {"op": "set", "at": [0, 0, 0], "block": "minecraft:dirt"},
            {"op": "set", "at": [0, 0, 0], "block": "minecraft:air"},
            {"op": "set", "at": [0, 0, 0], "block": "minecraft:glass"},
            {"op": "set", "at": [1, 0, 0], "block": "minecraft:air"},
            {"op": "set", "at": [1, 0, 0], "block": "minecraft:glass"},
        ],
        "probes": ["minecraft:stone", "minecraft:glass", "minecraft:air"],
    },
    "placed-rotated": {
        "seed": 3,
        "ops": [
            {"op": "shape", "fn": "stairs", "args": [[0, 0, 0], "north", STAIRS], "kwargs": {"length": 4}, "at": [10, 0, 10], "rotation": "CLOCKWISE_90"},
            {"op": "shape", "fn": "stairs", "args": [[0, 0, 0], "north", STAIRS], "kwargs": {"length": 4}, "at": [-10, 2, 4], "rotation": "COUNTERCLOCKWISE_90"},
            {"op": "shape", "fn": "line", "args": [[0, 0, 0], [0, 0, 5], "minecraft:oak_fence[north=true,south=true]"], "at": [0, 0, 0], "rotation": "CLOCKWISE_180"},
            {"op": "shape", "fn": "pillar", "args": [[0, 0, 0], 3, "minecraft:oak_log[axis=y]"], "at": [5, 5, 5], "rotation": "CLOCKWISE_90"},
        ],
        "probes": ["minecraft:oak_log[axis=y]"],
    },
    "recenter": {
        "seed": None,
        "ops": [
            {"op": "method", "fn": "box", "args": [[3, 1, 5], [8, 2, 9], "minecraft:stone"]},
            {"op": "method", "fn": "sphere", "args": [[20, 5, 20], 3, "minecraft:dirt"]},
            {"op": "recenter"},
        ],
        "probes": ["minecraft:stone", "minecraft:dirt"],
    },
    "recenter-odd": {
        "seed": None,
        "ops": [
            {"op": "method", "fn": "box", "args": [[-3, 0, 1], [-1, 1, 2], "minecraft:stone"]},
            {"op": "recenter"},
        ],
        "probes": ["minecraft:stone"],
    },
    "shapes": {
        "seed": 11,
        "ops": [
            {"op": "method", "fn": "cylinder", "args": [[0, 0, 0], 3, 5, {"palette": ["minecraft:stone", "minecraft:andesite"]}], "kwargs": {"hollow": True, "fill": "minecraft:air"}},
            {"op": "method", "fn": "sphere", "args": [[10, 0, 0], 4, "minecraft:glass"], "kwargs": {"dome": True, "hollow": True}},
            {"op": "method", "fn": "cone", "args": [[-10, 0, 0], 4, 6, "minecraft:red_wool"]},
            {"op": "method", "fn": "roof_hip", "args": [[0, 10, 0], [6, 10, 6], "minecraft:oak_stairs"], "kwargs": {"hip": "minecraft:oak_planks"}},
            {"op": "method", "fn": "stairs", "args": [[0, 0, 12], "east", "minecraft:stone_stairs"], "kwargs": {"length": 5, "width": 2}},
            {"op": "method", "fn": "line", "args": [[0, 0, -8], [9, 6, -3], "minecraft:iron_bars"]},
            {"op": "method", "fn": "pillar", "args": [[2, 0, 2], 4, {"patches": {"palette": ["minecraft:stone", "minecraft:mossy_cobblestone"], "scale": 2}}]},
        ],
        "probes": ["minecraft:glass", "minecraft:red_wool", "minecraft:oak_planks"],
    },
}


def build_vectors():
    out = {}
    for name, sc in BUILD_SCENARIOS.items():
        b = make_build(sc["seed"], (256, 256, 256))
        with b:
            for op in sc["ops"]:
                apply(b, op)
        out[name] = {"seed": sc["seed"], "ops": sc["ops"], "result": dump(b, sc["probes"])}

    errors = {}
    b = Build(seed=1)
    errors["outside-scope-set"] = run(lambda: b.set(0, 0, 0, "minecraft:stone"))
    errors["outside-scope-box"] = run(lambda: b.box((0, 0, 0), (1, 1, 1), "minecraft:stone"))
    small = Build(max_dimensions=(4, 4, 4))
    with small:
        errors["bounds-high"] = run(lambda: small.set(4, 0, 0, "minecraft:stone"))
        errors["bounds-low"] = run(lambda: small.set(0, -4, 0, "minecraft:stone"))
        errors["bounds-ok-low"] = run(lambda: small.set(-4, -4, -4, "minecraft:stone"))
        errors["bounds-shape"] = run(lambda: small.box((0, 0, 0), (9, 0, 0), "minecraft:stone"))
        errors["place-bad-rotation"] = run(lambda: small.place(shapes.box((0, 0, 0), (0, 0, 0), "minecraft:stone"), rotation="SIDEWAYS"))
        errors["place-not-geometry"] = run(lambda: small.place("nope"))
        errors["carve-float"] = run(lambda: small.carve((0, 0, 0.5), (1, 1, 1)))
        errors["place-bad-at"] = run(lambda: small.place(shapes.box((0, 0, 0), (0, 0, 0), "minecraft:stone"), at=(0, 0)))
    return {"scenarios": out, "errors": errors}


def write(name: str, data: dict) -> None:
    data = {"SPDX-License-Identifier": "AGPL-3.0-only", **data}
    (OUT / name).write_text(json.dumps(data, indent=1) + "\n", encoding="utf-8")
    print(f"wrote vectors/{name}")


if __name__ == "__main__":
    write("materials.json", materials_vectors())
    write("shapes.json", shapes_vectors())
    write("geometry.json", geometry_vectors())
    write("build.json", build_vectors())
