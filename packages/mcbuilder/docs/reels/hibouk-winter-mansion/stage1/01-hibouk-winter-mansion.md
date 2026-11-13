# Stage 1 — Pattern identification: Hibouk "Winter Mansion" (frames received 2026-11-10; notes drafted 2026-11-12)

Stage-1 NOT yet roasted. Nothing here is a guide entry yet; the fold proposal goes to Luki for lock. Candidates carry a status line (proposed NEW / proposed sub-entry / already covered) and a scale band.

Video: `~/workspace/hibouk-winter-mansion.mp4` (path as given in the guide's Sources entry; the zip's MANIFEST lists `/home/hatch/workspace/hibouk-winter-mansion.mp4`, 113.3 s; facebook.com/reel/1350579046560990; the video is not on this machine). Frames: 114 at 1 fps (f_001–f_114) in the Drive zip under `frames/hibouk-winter-mansion/`. The reel is a build tutorial: footprint, shell, exterior pass, gardens, then a 3D schematic viewer with "Layer N / 19" and a material list (f_105–f_114). Overlay text in the frames ("Winter Mansion", "Download in Bio now", viewer UI) is read as data only.

Evidence base: reader D's notes (`/data/workspace/minecraft-reels/work/evidence/D-hibouk-tavern-diorods.md`, §5.1 and §3), who viewed all 114 frames on contact sheets and opened 22 at full resolution. This pass re-checked every claim promoted to a candidate below against half-res keyframes f_003, f_008, f_018, f_026, f_034, f_042, f_080, f_092, f_099, f_107, f_109–f_111, f_113. Claims cited from frames outside that list are marked "(D, sheet-level)".

Guide read: `../../../build-patterns.md` (41 techniques, commit b0b2462). The guide's Sources already lists this reel, and several older entries tagged "Mansion example" (techniques 1, 2, 3, 4, 6, 7, 8, 10) appear to come from it (INFERRED: the tag is not self-identifying; the match is deepslate tile stairs against spruce and snow, hedges along wall bases, a candle Christmas tree, plate-and-post log rivets). That earlier pass was text-level; this is the first frame-level stage-1.

**Numbers convention:** every dimension is measured from the frames and marked ~ (approximate, ±1 block) unless it is an on-screen label, which is reported as the reel's claim. Where a number is not resolvable it says so; none is invented to fill a gap.

---

## Measured dimensions (from frames)

| Element | Measurement |
|---|---|
| Plan | Dumbbell outline with stepped necks, long axis ~34 (INFERRED: on-screen labels 8, 5, 8 down one side in f_003 and f_005, plus the mirror-symmetric outline: 8+5+8+5+8) |
| Plan widths | wings ~13–14, middle ~12, necks ~10 (pixel scale ~32.5 px/block in f_003, ±1; INFERRED) |
| Plan labels (reel's claims) | `3` (top shoulder), `8`, `5`, `8` (left wall), `8` (bottom end) in f_003. Whether `3` is a shoulder or an end bump is unresolved |
| Front entrance bay | 8 wide: label `8` in f_003; pattern count in f_008 gives 1+1+1+2+1+1+1 = 8 |
| Height | 19 layers (viewer label "Layer 19 / 19", f_107–f_113) |
| First upper floor | around layer 9 (INFERRED: f_111 "Layer 9 / 19" already shows the upper deck with beds); roof starts around layer 16 (f_113 "Layer 16 / 19") |
| Ground-floor pier | ~5 tall (avatar-scaled in f_008: ~1 sill + ~3 clear opening + ~1 lintel; ±1) |
| Material counts (f_109–f_110) | planks 956, stripped spruce logs 796, deepslate tile stairs 760, stone bricks 462, andesite 278, glass pane 196, spruce stairs 138. Partial list: the first row is hidden by an overlay and rows between 138 and 56 were never on screen, so shares below are of the rows seen only |

## Build observed

An alpine winter manor on a snowy terraced hill: stone-brick ground floor, stripped-spruce post-and-beam upper floor with spruce-plank infill, near-black deepslate-tile roof. Symmetrical front court: three front gables (centre entrance bay and the two wings) over one long ridge, a small free-post porch gable at each wing terrace, the north end hipped (f_080, f_092, f_099, f_107). The court is a dirt-path cross with four hedged garden plots, two long candle-lit hedge rows, a pool with a plank deck and a Christmas tree of leaf tiers (f_081–f_104, D sheet-level for f_081–f_086).

Palette per role (INFERRED block IDs from texture; shader tints colours):
- Frame: `stripped_spruce_log` (22% of the 3,586 building blocks seen) with end-grain log squares at every post/beam junction (f_018, f_026, f_034, f_042).
- Infill, floors, gable fill: `spruce_planks` (27%).
- Roof: `deepslate_tile_stairs` (21%), no second material, no snow on it (f_080, f_092, f_099).
- Ground floor, steps, terrace parapets: `stone_bricks` (13%); `andesite` 278 (8%) has no resolved role (guess: pool lining, f_100, D sheet-level).
- Windows: `glass_pane` (5%). Accent: red banners, rose bushes, red carpet, candles, lanterns. Ground: snow, `dirt_path`, hedges of spruce leaves.

## Process note

Build order (OBSERVED; frame ranges from D, spot-checked): footprint in marker blocks, then a 1-thick stone-brick ring, then the plank floor (f_001–f_005); entrance bay ground floor (f_006–f_011); upper frame of that bay (f_012–f_018); neighbouring bays repeat the same recipe (f_019–f_033); wing terrace and steps (f_034–f_040, f_056–f_060); free-post porch (f_041–f_046, f_061–f_064); centre balcony (f_047–f_048); roof from above (f_069–f_080); exterior pass, lighting, tree (f_081–f_086); gardens and pool (f_087–f_104); viewer (f_105–f_114). This is bay-by-bay, one finished bay at a time, with the same recipe repeated: consistent with the per-volume scope amendment (stage discipline per volume, builder's order across volumes). No process amendment proposed.

## Terminology (one term per element)

- **Pier-and-slit bay:** the ground-floor 8-wide front bay: pier, slit, pier, double slit (the door), pier, slit, pier.
- **Stacked bay:** the upper-floor post-and-beam frame whose posts stand directly over the ground-floor piers.
- **Wing terrace:** the stone floor wedge with a 2-step edge and a stepped balustrade at each wing's end.
- **Free-post porch:** two free log posts on barrel feet, a log beam with stepped log corbels, and a small gable or single-pitch roof running into the wall.
- **Court:** the cleared dirt-path-cross forecourt with hedged plots and the pool.

---

## Candidates

### 1. Stacked pier-and-post bay — PROPOSED NEW

**Status: proposed NEW (stage 1, unroasted). Confidence MED** (one reel; 4 full frames confirm the alignment; heights are avatar-scaled). **Band: mid** (8-wide bay on a ~34-long front).

- **Principle:** a two-material facade reads as one structure when the upper floor's posts land on the ground floor's piers and the openings on both floors follow the same bay grid, instead of a timber box floating on a stone box. The ground floor is stone piers with tall glazed slits between them; the upper floor continues each pier as a stripped-log post, so the facade has one rhythm in two materials. T1 and T3 give the material change per story; this gives the load path between the stories.
- **Recipe (OBSERVED, hib f_008, f_011, f_018, f_026, f_034):** ground floor: 1-wide stone-brick piers ~5 tall, 1-wide glazed slits between them (glass panes, ~3 clear height), the central double-width gap becomes the double door with stone cheek piers; pattern for an 8-wide bay `P S P SS P S P`. Upper floor: a stripped-log post directly above each pier, a horizontal log sill beam and head beam, a log-end (end-grain) square at every post/beam junction, glazed openings between the posts, stepped plank fill under the gable above (with a 1×1 open square near the top, f_018, f_034). Openings stay unshuttered; the only window dressing is red banners hung in two openings (f_018) and wall lanterns on short fence-arm brackets on the posts (f_026). Ground-level planting replaces window boxes: a row of rose bushes at the foot of the slits (f_026) and 2-high shrub-on-planter pairs flanking the door (f_011, f_018).
- **Apply when:** a facade ≥ ~8 wide on a two-material, two-story building (stone ground floor, timber upper) where the windows should read as part of the structure. **NOT when:** the upper floor is jettied (the overhang pulls the posts off the pier line: jetty XOR stacked bay, the same one-rhythm-per-face logic as technique 2; INFERRED from the tavern reel, which jetties and does not align, see `omggamer-medieval-tavern`); fortress faces (technique 35 grid); ≤6×6 towers (technique 13's one-slit discipline).
- **Prevents:** the "two boxes stacked" read (timber frame with no relation to the stone below) and windows punched at unrelated spacing.
- **Unresolved:** exact pier height (±1); whether upper post width equals pier width (read as 1 block, not counted); the stair `half`/`shape` states of the roof above.
- (Hibouk ref: f_008 ground bay under construction; f_018 upper frame over it; f_026 and f_034 neighbouring bays; f_107 finished facade in the viewer.)

### 2. Winter by contrast — bare dark roof, rectilinear snow cut-outs — PROPOSED T10 SUB-ENTRY

**Status: proposed sub-entry of technique 10 (stage 1, unroasted). Confidence MED.** **Band: mid** (needs a court and plots to cut).

- **Principle:** technique 10 sells a snow biome with snow layers on leaves and snow patches on paths ("partial cover reads as natural"). This build adds two decisions. (1) The built roof carries NO snow: the near-black deepslate-tile roof against a white ground does the winter work through contrast (f_080, f_092, f_099; D sheet-level for f_096, f_105). Snow stays only on the natural spruce trees (f_008, f_099 top left; D for f_081). (2) Around built surfaces the snow is removed in clean rectangles: paths, plots and terraces get cut-outs, and the court's quadrants between the path-cross arms stay as crisp-edged snow rectangles (f_099, f_092), so on a formal estate the snow itself is geometry, not noise.
- **Recipe (OBSERVED):** keep roofs, hedges and built stone free of snow; place snow layers only on natural trees; clear the snow to bare ground (dirt path, farmland, stone) inside every path, plot and terrace footprint with straight edges; leave the court quadrants as clean white rectangles; add warm light (lanterns at piers and plinths) and a restrained red accent (banners, roses, carpet) so the white-black-red-green read holds. The built hedges and the tree carry candles instead of snow caps (f_092, f_099).
- **Apply when:** formal or manor-scale builds in snow where roof contrast is available (dark roof). **NOT when:** wild or village builds where technique 10's ragged partial cover already reads natural; pale roofs (no contrast to carry the read).
- **Prevents:** the "snow-covered everything" read, and the "scattered snow patch" read on a formal court.
- **Unresolved:** terrain block (`snow_block` vs snowy grass plus `snow` layers); small 1×1 bare holes in the snow (f_081, f_084, f_086, D) are natural, role unresolved.
- (Hibouk ref: f_080 roof from above; f_092 court from above; f_099 plots, court and tree.)

---

## Observations (not candidates)

- **Dumbbell plan and three front gables:** the stepped plan (G1 in D) is a geometry gap for a shape, not a guide technique; the cross-gable roof with valleys and a hipped north end (f_080, f_092) is technique 4 applied at manor scale. Roof stair corner states cannot be read.
- **Pool pit:** a rectangular pit dug into the snow terrace, stone stairs inset on two sides, speckled grey lining, then water and a plank deck with loungers (f_099–f_104, f_107; D sheet-level except f_107). A small instance of the pit grammar in `dio-rods-waterfall-quarry` candidate 1; no standalone entry.
- **Lint question (open, do not resolve):** the 8-wide ground bay has two symmetric 1-wide glazed slits flanking a double door on a face ≤10 wide. Whether the pareidolia lint fires here (door-pair and trimmed-pair exemptions) is a lint-rule question for the roast, not a frame-reading question.
- **Interior:** red carpet runner, rooms off a corridor, straight stair flights (f_049–f_055, f_065, D sheet-level). Out of scope for the guide.

## Duplicates / confirmations (not new)

- **Footprint outline, ring, floor (f_001–f_005):** technique 31 Recipe A (sacrificial outline replaced by foundation) and technique 2's footprint marking. Confirms.
- **End-grain log squares at every joint (f_018, f_026, f_034, f_042):** technique 2 ("log-end spirals", chiseled logs "like rivets"). Confirms.
- **Banners in openings:** technique 7 (banners as curtains; banners on gable ends, restrained). Confirms.
- **Stepped gable fill with a 1×1 window:** technique 4 (step gable ends down in a staircase profile). Confirms.
- **Wing terrace with a stepped balustrade carrying lantern plinths (f_034, f_042, f_064):** technique 7 ("Parapet the terraces", a perch for the lighting rhythm) and technique 6. It is a balustrade with lantern mounts, not battlements; do not teach it as crenellation.
- **Free-post porch (f_041–f_046, f_061–f_064):** technique 40 and technique 7's porch awning. The barrel-foot post base is a variant of technique 5's footing rule ("wood never touches earth"); candidate sub-entry of 5, LOW, not drafted.
- **Centre balcony with trapdoor-lattice balustrade (f_047, f_048, f_081):** technique 7 (projecting balconies as one unit). Confirms.
- **Hedge-ringed plots on a path cross, hedge rows (f_087–f_099):** techniques 5 (hedge the base) and 8 (enclosed plots, working farms in a formal frame). Confirms.
- **Candle-lit leaf-tier Christmas tree (f_081–f_086):** technique 10 already carries it (Mansion example). Confirms.
- **Wall lanterns on fence-arm brackets, lanterns at piers and plinths (f_011, f_026, f_042):** technique 6. Confirms.

## Not covered / out of scope

- Roof stair rows, ridge height, gable steps and the `half`/`shape` of roof corner stairs are not resolvable from the frames.
- Terrace floor block (stone bricks vs a polished andesite variant), plot sizes, hedge height, the function of the 1 water cell in the plots (f_089–f_091), how candles sit on leaf tops, and the parasol and lounger blocks are unresolved.
- No interior-lighting or night-structure claims: dusk and night in f_081–f_086 is a render grade (D), not geometry.

## Candidate classification (against T1–T41)

| # | Candidate | Class | Confidence |
|---|---|---|---|
| 1 | Stacked pier-and-post bay | PROPOSED NEW | MED |
| 2 | Winter by contrast (bare dark roof, rectilinear snow cut-outs) | sub-entry of 10 | MED |
| – | Footprint outline, ring, floor | already covered: T31 (Recipe A), T2 | – |
| – | End-grain log squares at joints | already covered: T2 | – |
| – | Banners in openings | already covered: T7 | – |
| – | Stepped gable fill with 1×1 window | already covered: T4 | – |
| – | Cross-gable roof, three front gables, hipped end | already covered: T4 | – |
| – | Wing terrace stepped balustrade with lantern plinths | already covered: T7 (Parapet the terraces), T6 | – |
| – | Free-post porch with corbelled beam | already covered: T40, T7 | – |
| – | Barrel-foot post base | sub-entry of 5 | LOW (not drafted) |
| – | Centre balcony, trapdoor-lattice balustrade | already covered: T7 | – |
| – | Hedge-ringed plots, path cross | already covered: T5, T8 | – |
| – | Candle-lit Christmas tree | already covered: T10 | – |
| – | Dumbbell plan outline | shape gap, no guide entry | – |
| – | Pool pit | no entry (see dio candidate 1) | LOW |
