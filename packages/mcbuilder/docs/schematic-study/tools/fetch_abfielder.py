# SPDX-License-Identifier: AGPL-3.0-only
"""Download free schematics from abfielder.com with headed Camoufox (see ../README.md).

usage: ~/.venvs/browser/bin/python -I fetch_abfielder.py <out-dir> <product-id>...

Each product goes into its own directory, with the page metadata in meta.json.
Needs the camoufox-browser skill (Camoufox + Playwright, headed under Xvfb).
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.expanduser("~/.agents/skills/camoufox-browser/scripts"))
from common import ensure_display
OUT = sys.argv[1]
ids = sys.argv[2:]
xvfb = ensure_display()
try:
    from camoufox.sync_api import Camoufox
    with Camoufox(headless=False) as browser:
        ctx = browser.new_context(viewport={"width": 1280, "height": 900}, accept_downloads=True)
        page = ctx.new_page()
        for pid in ids:
            url = f"https://abfielder.com/Products/ProductDetails.php?id={pid}"
            try:
                page.goto(url, timeout=60000)
                page.wait_for_timeout(4000)
                text = page.evaluate("document.body.innerText")
                title = page.title()
                m = re.search(r"Minecraft Schematic (.*) by (.*) \| abfielder", title)
                name, author = (m.group(1), m.group(2)) if m else (title, "?")
                dims = re.search(r"BUILD DIMENSIONS\s*\n(.*)\n(.*)total blocks", text)
                about = re.search(r"ABOUT THIS DOWNLOAD\s*\n(.*?)\n(BUILD DIMENSIONS|TAGS)", text, re.S)
                tags = re.search(r"TAGS\s*\n(.*?)\nThe Abfielder Store", text, re.S)
                free = "\nFree\n" in text
                slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40] + f"-{pid}"
                d = os.path.join(OUT, slug)
                os.makedirs(d, exist_ok=True)
                links = page.query_selector_all("a:text-is('Download')")
                meta = dict(id=pid, url=url, name=name, author=author, free=free,
                            dims=dims.group(1).strip() if dims else None,
                            total_blocks=dims.group(2).strip() if dims else None,
                            about=about.group(1).strip()[:1200] if about else None,
                            tags=[t for t in tags.group(1).split("\n") if t.strip()] if tags else [],
                            files=[])
                if not free or not links:
                    print("SKIP (not free / no link)", pid, name); 
                    json.dump(meta, open(os.path.join(d, "meta.json"), "w"), indent=2); continue
                with page.expect_download(timeout=90000) as dl:
                    links[0].evaluate("e => e.click()")
                download = dl.value
                fn = download.suggested_filename
                path = os.path.join(d, fn)
                download.save_as(path)
                meta["files"].append(fn)
                json.dump(meta, open(os.path.join(d, "meta.json"), "w"), indent=2)
                print("OK", pid, name, "by", author, meta["dims"], meta["total_blocks"], fn, os.path.getsize(path))
            except Exception as e:
                print("ERR", pid, repr(e)[:300])
finally:
    if xvfb is not None:
        xvfb.terminate()
