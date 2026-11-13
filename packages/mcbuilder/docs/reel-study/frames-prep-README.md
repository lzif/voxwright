# work/ : prepared frames for the Minecraft reels

- `keyframes/<reel>/f_NNN.jpg`: half-resolution copies (ffmpeg `-q:v 4`) of the kept frames. NNN is the original 1-based frame number (1 fps, f_001 = first second). `keyframes/dio-rods-waterfall-quarry/` and `keyframes/pillar-wall-design/` hold all 7 and 4 photos, half-res, original names, unfiltered.
- `sheets/<reel>-NN.jpg`: numbered contact sheets of the kept frames (frame number burned into each tile, DejaVu Sans Bold via `drawtext`). Portrait reels: 6 columns, 240x427 tiles, 18 per sheet. Landscape (`disruptive-builds`): 4 columns, 360x202 tiles, 20 per sheet. Photo sets: 4 cols x 360 (dio rods), 2 cols x 600 (pillar), one sheet each.
- `index.json`: per reel the source dims, total frames, kept frame numbers, dropped frames with reason (black/uniform/dup), and each sheet with the frames it contains. Photo sets are under `photo_sets`.
- `cache/sigs.json`, `cache/select.json`: intermediate 32x32 RGB signatures and the keep/drop decisions (safe to delete; `run_all.sh` rebuilds them).

How the filtering works (`tools/sigs.py`, `tools/select.py`): each frame is reduced by ffmpeg to a 32x32 RGB thumbnail. RGB, not gray, because an orange floor and green grass have the same luminance and a gray signature drops real build steps. A frame is dropped as:
- black: mean luminance < 12 (disruptive-builds f_543-547, noes-starter-house f_145-157);
- uniform: luminance std-dev < 4 (none triggered);
- dup: compared with the last KEPT frame, mean abs diff < 3 (of 255) AND fewer than 4 thumbnail pixels changed by >= 16 in any channel. The second test keeps small local changes (one wall added in a static shot) that barely move the mean.

Thresholds are deliberately conservative ("when in doubt, keep"): at 1 fps nearly every frame differs, so 1488 of 1513 frames (98%) are kept. Looser values (`--dup 6 --pix 40 --npix 16` in `run_all.sh`) keep 1405 of 1513 (93%) but lose small build steps, e.g. alixxa-tower keeps only f_001/007/012/015/017 and drops the f_004 wall and f_005 stair steps.

Regenerate (about 80 s), from `/data/workspace/minecraft-reels`:

    ./tools/run_all.sh
