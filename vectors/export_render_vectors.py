# SPDX-License-Identifier: AGPL-3.0-only
"""Export rendering references from the Python faithful renderer.

Renders a few example builds in presentation mode (without the title, view
label and compass, which need fonts) and records, per view, the output size
and a small average-colour thumbnail. The TypeScript renderer is compared on
those, not on committed images. Needs the vanilla assets (never committed).

Usage (from the repository root):

    PYTHONPATH=reference/src PYTHONDONTWRITEBYTECODE=1 \
        uv run --with numpy --with pillow --with nbtlib \
        python vectors/export_render_vectors.py [--cache DIR]

DIR is the version directory, default ~/.cache/mcbuilder/26.2.
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

from mcbuilder.render import faithful
from mcbuilder.render import fast as _fast
from mcbuilder.render.views import parse_views

OUT = Path(__file__).resolve().parent
EXAMPLES = OUT.parent / "reference" / "examples"
THUMB = 24
CASES = {
    "homestead-well": "homestead/well.py",
    "waystone-skystead": "waystones/waystone_skystead.py",
    "waystone-s5": "waystones/waystone_s5.py",
    "homestead-house": "homestead/house.py",
}
VIEWS = "iso;top;az200_el025"


def thumbnail(img: Image.Image) -> list[list[int]]:
    """Area-average the image to THUMB x THUMB, rows of [r, g, b, ...]."""
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
    _fast._overlay_label_and_compass = lambda *a, **k: None  # needs fonts: not compared

    result = {"SPDX-License-Identifier": "AGPL-3.0-only", "thumb": THUMB, "views": VIEWS, "cases": {}}
    for name, rel in CASES.items():
        path = EXAMPLES / rel
        sys.path.insert(0, str(path.parent))
        build = runpy.run_path(str(path))["BUILD"]
        sys.path.pop(0)
        for m in [m for m in sys.modules if m == "common"]:
            del sys.modules[m]
        views = parse_views(VIEWS)
        with tempfile.TemporaryDirectory() as tmp:
            faithful.render(build.grid, tmp, views, cache, presentation=True, title=None)
            case = {}
            for v in views:
                img = Image.open(Path(tmp) / f"{v.label}.png")
                case[v.label] = {"size": list(img.size), "thumb": thumbnail(img)}
        result["cases"][name] = case
        print(name, {k: v["size"] for k, v in case.items()})
    (OUT / "renders.json").write_text(json.dumps(result) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
