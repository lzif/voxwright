# SPDX-License-Identifier: AGPL-3.0-only
"""Write synthetic Sponge `.schem` fixtures with an encoder independent of the TypeScript one.

These are NOT files saved by real tools (WorldEdit, FAWE, ...). They follow
the Sponge Schematic v2 and v3 specifications through nbtlib, so they test
the TypeScript reader against a second implementation. Replace or extend
them with real-tool files as those become available.

Usage (from the repository root):

    PYTHONDONTWRITEBYTECODE=1 uv run --with nbtlib python fixtures/make_synthetic.py
"""

from __future__ import annotations

import gzip
import io
import json
from pathlib import Path

from nbtlib import ByteArray, Compound, File, Int, IntArray, List, Short, String

OUT = Path(__file__).resolve().parent / "synthetic"
DATA_VERSION = 4903
AIR = "minecraft:air"


def small_grid() -> dict[tuple[int, int, int], str]:
    """A 4 x 3 x 5 box: a floor, a stair, a log, a chest and a hole of air."""
    cells: dict[tuple[int, int, int], str] = {}
    for x in range(4):
        for z in range(5):
            cells[(x, 0, z)] = "minecraft:stone"
    cells[(1, 1, 1)] = "minecraft:oak_stairs[facing=north,half=bottom,shape=straight]"
    cells[(2, 1, 1)] = "minecraft:oak_log[axis=x]"
    cells[(3, 2, 4)] = "minecraft:chest[facing=east,type=single,waterlogged=false]"
    cells[(0, 1, 4)] = "minecraft:oak_fence[east=false,north=true,south=false,waterlogged=false,west=false]"
    return cells


def varint_grid() -> dict[tuple[int, int, int], str]:
    """200 distinct blocks, so palette ids need two-byte varints."""
    cells = {}
    for i in range(200):
        cells[(i % 10, (i // 10) % 5, i // 50)] = f"minecraft:block_{i}"
    return cells


def varint(n: int) -> bytes:
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        if n:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)


def encode(cells, version: int, offset=(0, 0, 0)):
    w = max(x for x, _, _ in cells) + 1
    h = max(y for _, y, _ in cells) + 1
    l = max(z for _, _, z in cells) + 1
    palette: dict[str, int] = {}
    data = bytearray()
    for y in range(h):
        for z in range(l):
            for x in range(w):
                state = cells.get((x, y, z), AIR)
                if state not in palette:
                    palette[state] = len(palette)
                data += varint(palette[state])
    pal = Compound({k: Int(v) for k, v in palette.items()})
    block_entities = List[Compound](
        [
            Compound({"Pos": IntArray(list(p)), "Id": String("minecraft:chest")})
            for p, s in cells.items()
            if s.startswith("minecraft:chest")
        ]
    )
    # nbtlib ByteArray stores signed bytes.
    signed = ByteArray([b - 256 if b > 127 else b for b in data])
    common = {
        "Version": Int(version),
        "DataVersion": Int(DATA_VERSION),
        "Width": Short(w),
        "Height": Short(h),
        "Length": Short(l),
        "Offset": IntArray(list(offset)),
        "Metadata": Compound({"Name": String("synthetic")}),
    }
    if version == 2:
        root = Compound(
            {
                **common,
                "PaletteMax": Int(len(palette)),
                "Palette": pal,
                "BlockData": signed,
                "BlockEntities": block_entities,
            }
        )
        name = "Schematic"
    else:
        root = Compound(
            {
                "Schematic": Compound(
                    {
                        **common,
                        "Blocks": Compound({"Palette": pal, "Data": signed, "BlockEntities": block_entities}),
                    }
                )
            }
        )
        name = ""
    buf = io.BytesIO()
    File(root, root_name=name).write(buf)
    return gzip.compress(buf.getvalue(), mtime=0), (w, h, l)


def main() -> None:
    expected = {"SPDX-License-Identifier": "AGPL-3.0-only", "files": {}}
    for label, grid in (("small", small_grid()), ("varint", varint_grid())):
        for version in (2, 3):
            offset = (-1, 0, 2) if label == "small" else (0, 0, 0)
            raw, (w, h, l) = encode(grid, version, offset)
            name = f"v{version}-{label}.schem"
            (OUT / name).write_bytes(raw)
            expected["files"][name] = {
                "version": version,
                "size": [w, h, l],
                "offset": list(offset),
                "dataVersion": DATA_VERSION,
                "blockEntities": sum(1 for s in grid.values() if s.startswith("minecraft:chest")),
                "cells": sorted(f"{x},{y},{z} {s}" for (x, y, z), s in grid.items()),
            }
    (OUT / "expected.json").write_text(json.dumps(expected, indent=2) + "\n", encoding="utf-8")
    print("wrote", ", ".join(sorted(p.name for p in OUT.iterdir())))


if __name__ == "__main__":
    main()
