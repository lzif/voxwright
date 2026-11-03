# SPDX-License-Identifier: AGPL-3.0-only
"""Export build-guide references from the Python implementation.

For a few example builds it records the exact `guide.md` text, and for every
layer image its size and a small average-colour thumbnail. Text in the images
is drawn with a different font in the TypeScript port, so images are compared
by size and thumbnail, never by pixel. Needs the vanilla assets (not committed).

Usage (from the repository root):

    PYTHONPATH=reference/src PYTHONDONTWRITEBYTECODE=1 \
        uv run --with numpy --with pillow --with nbtlib \
        python vectors/export_guide_vectors.py [--cache DIR]
"""

from __future__ import annotations

import argparse
import json
import runpy
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

from mcbuilder import guide

OUT = Path(__file__).resolve().parent
EXAMPLES = OUT.parent / "reference" / "examples"
THUMB = 16
CASES = {
    "waystone-s5": "waystones/waystone_s5.py",
    "waystone-skystead": "waystones/waystone_skystead.py",
    "homestead-well": "homestead/well.py",
    "underwater_base": "underwater_base/underwater_base.py",
}


def thumbnail(img: Image.Image) -> list[list[int]]:
    a = np.asarray(img.convert("RGB"), dtype=float)
    h, w, _ = a.shape
    ys = np.linspace(0, h, THUMB + 1).astype(int)
    xs = np.linspace(0, w, THUMB + 1).astype(int)
    rows = []
    for i in range(THUMB):
        row = []
        for j in range(THUMB):
            cell = a[ys[i] : ys[i + 1], xs[j] : xs[j + 1]]
            row.extend(int(round(v)) for v in cell.reshape(-1, 3).mean(axis=0))
        rows.append(row)
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=str(Path.home() / ".cache/mcbuilder/26.2"))
    cache = Path(ap.parse_args().cache)
    if not (cache / "client").is_dir():
        raise SystemExit(f"no client assets under {cache}: run `mcbuild assets fetch --version 26.2`")
    result = {"SPDX-License-Identifier": "AGPL-3.0-only", "thumb": THUMB, "cases": {}}
    for name, rel in CASES.items():
        path = EXAMPLES / rel
        sys.path.insert(0, str(path.parent))
        build = runpy.run_path(str(path))["BUILD"]
        sys.path.pop(0)
        for m in [m for m in sys.modules if m == "common"]:
            del sys.modules[m]
        with tempfile.TemporaryDirectory() as tmp:
            md_path = guide.write_guide(build.grid, tmp, cache, title=Path(rel).stem.replace("_", " ").title(), cover=None)
            md = md_path.read_text(encoding="utf-8")
            layers = {}
            for p in sorted(Path(tmp).glob("layer-*.png")):
                img = Image.open(p)
                layers[p.name] = {"size": list(img.size), "thumb": thumbnail(img)}
        result["cases"][name] = {"title": Path(rel).stem.replace("_", " ").title(), "markdown": md, "layers": layers}
        print(name, len(layers), "layers")
    (OUT / "guides.json").write_text(json.dumps(result) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
