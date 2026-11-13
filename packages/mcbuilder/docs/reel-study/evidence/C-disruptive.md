# C-disruptive: evidence notes for reel `disruptive-builds`

Reader C. Reel: `disruptive-builds` (1280x720, 1 fps, f_001-f_583, 578 kept; f_543-f_547 black and dropped; f_542 is mostly black).
No stage-1 existed for this reel, so section 5 is included. Input only: contact sheets 01-29, half-res keyframes, ~20 full-res crops.

Conventions
- Citations: `disruptive-builds/f_064, f_071` means both frames of this reel. Later frames in the same cell share the reel name.
- OBS = OBSERVED (visible). INF = INFERRED (reason given). `~N` = approximate count with the reason.
- Shader/pack tint shifts colours, so block IDs come from shape and texture pattern. `?` = uncertain, alternatives listed.
- Ignored on purpose: the hand/item in the frame corner, the creeper and furry stickers (f_238), the narrator clips (f_008-f_014, f_021-f_023, f_570-f_583),
  the black rectangular wall and floating white objects in the background of f_501-f_583 (other test builds, not part of the shown build).
- This reel is a finished-build tour, not a build-process video: no build order is visible anywhere. Every "build order" line is INF.

## 0. Segmentation (15 builds + intro/outro)

| # | Build (descriptive name) | Frames | Notes |
|---|---|---|---|
| - | Intro / teasers | f_001-f_023 | f_001-003 snowy-slope timber lodge and f_004-007 lake village are teasers that never recur. f_015-016 teases B1, f_017-018 teases B6, f_019-020 teases B4. f_008 is an unrelated reaction clip. |
| B1 | Timber gallery bridge on a stone sluice arcade over a river cut | f_024-f_087 | exterior f_024-f_068 and f_074-f_087; walkway interior f_069-f_073; underwater/piers f_049-f_052 |
| B2 | Timber-and-stone library manor (exterior + interior library + attic) | f_088-f_141 | exterior f_088-f_098; library f_099-f_130; cobwebbed attic f_131-f_141 |
| B3 | Torii shrine garden with portal gate, pond and stone lanterns | f_142-f_206 | f_142-143 is the cut from the manor window into the garden |
| B4 | Stone castle gatehouse with mine-cart yard (curtain wall, 2 towers, mine adit) | f_207-f_319 | outside f_207-f_227 and f_302-f_319; courtyard/mine f_228-f_301 |
| B5 | Dark-wood harbour pier with boathouse and finger piers | f_320-f_365 | boats are entities (f_328-f_355) |
| B6 | Riverside pier house, light wood (kitchen/workshop/bed interior) | f_366-f_429 | exterior f_366-f_400; interior f_401-f_424 |
| B7 | Cross-shaped pond with plank cross-bridge and pavilion | f_430-f_458 | f_430-f_445 is the approach across the field |
| B8 | Stone fountain with falling-water column | f_459-f_463 | tiny, merged with B7 in stage-1 |
| B9 | Wayside shelter gazebo (4 posts, gable roof, stepped plinth) | f_464-f_472 | tiny, merged with B10 in stage-1 |
| B10 | Willow tree in a stair-ringed planter on a round plaza | f_473-f_485 | |
| B11 | Bell well (4-post roof, hanging bell, stone shaft) | f_486-f_500 | |
| B12 | Stone statue on a planter box | f_501-f_505 | tiny, merged with B13 in stage-1 |
| B13 | Market stalls (3 stalls on paved plaza) | f_506-f_526 | |
| B14 | Pillory / gallows platform with stepped timber arch | f_527-f_537 (also f_571-f_575) | |
| B15 | Small crenellated watchtower with porch hood | f_538-f_569 | interior shaft f_558-f_563 |
| - | Outro (narrator walking to stalls) | f_570-f_583 | f_571-575 re-shows B14 |

Stage-1 grouping: B1, B2, B3, B4, B5, B6 each get a full block; B7+B8, B9+B10, B11, B12+B13, B14, B15 get compact blocks.

---

(Sections 1-5 follow below; appended progressively.)

## 1. Hypothesis shapes

### 1.1 Arch: AMBIGUOUS (stepped/corbelled forms PRESENT; no curved arch of any profile)
No round, segmental or pointed arch anywhere in the reel. Three stepped forms exist, so "arch" needs a corbel option, not a curve function.

A. Stepped relieving frieze over the bridge bays (B1). OBS: `disruptive-builds/f_040, f_043, f_044, f_051`.
- Each of the 4 bays has a flat lintel course (pale `stone_brick_slab[type=top]` or a stone-brick course), see f_040.
- Above the lintel, a sawtooth/triangular band: dark notches (gaps showing the shadowed back wall) alternate with stone-brick blocks and upside-down stairs, in 2 rows, the second row offset by half a bay. It reads as a stepped-triangle (corbel) pediment over each bay. OBS f_040, f_044.
- Block per role: lintel `stone_brick_slab[type=top]`?; frieze `stone_brick_stairs[half=top]` + full `stone_bricks` + 1-block-deep gaps. INF (shapes read from shadow, no block outline visible).
- Span: bay ~2 wide (INF from pier = 1 brick wide vs bay ~2 in f_051/f_052; oblique, uncertain). Rise of the frieze ~2 rows. Thickness: wall-thick (pier faces are flush).
- Variation: none seen between the 4 bays.

B. Stepped timber arch over the pillory (B14). OBS: `disruptive-builds/f_533, f_573, f_531, f_535, f_572`.
- Two posts (stone-brick wall / fence / stone-brick wall stack). Over each post a cantilevered plank/stair block sticks 1 block outward.
- From each post the arch rises inward in about 3 steps (stair-stepped, 1 across / 1 up), meeting a flat crown ~3 blocks wide. Left/right are mirrored. OBS f_533, f_573.
- Chain + 1 fence segment hangs from the crown centre. Span between posts ~4-5 and rise ~3 rows: ~N (counted on oblique frames, uncertain).
- Block: `spruce_stairs`/`spruce_planks`?/`spruce_slab`? (alt oak). Stairs face the climb direction on the up-slope and face the opposite way on the down-slope. INF from silhouette.
- Label: NEW SHAPE `corbelArch(span, rise, step)` (a stair-stepped arch, optionally with keystone row). An existing shape cannot do it: `stairsRun` only climbs one way, `roofGable` is a solid roof.

C. Chamfered niche head (B2 interior). OBS: `disruptive-builds/f_105, f_107, f_109, f_136, f_141`.
- A 3-wide stone-brick wall niche (with a trapdoor panel as window) whose two top corners are cut by upside-down wooden stairs, under a log lintel. It is the degenerate form of a segmental arch: span 3, rise 1, two corner stairs, no crown stones.
- Block: `?_stairs[half=top]` (dark oak/spruce) at both top corners, facing in toward the opening. INF.

Verdict summary: round ABSENT, segmental ABSENT (C is only degenerate), pointed ABSENT. Gate lintels are flat (B4 f_226, f_227; pale `?` lintel course, see section 4).
Label for all three: NEW SHAPE `corbelArch` (stepped), with `rise`, `step` and `capRow` as params. A curved arch is not needed for this reel's builds.

### 1.2 Dome: ABSENT
- Fountain top (B8, `disruptive-builds/f_460, f_462, f_463`) is a rectangular translucent column of falling water around a stepped stone-brick pillar, not a dome.
- Willow canopy (B10, f_474-f_481) is an organic leaf mass, not masonry. Torii cap (B3, f_156, f_161) is a low flat-ish roof.
- Nothing else is round at the top. Verdict: ABSENT.

### 1.3 Spiral stairs: ABSENT
- All stairs are straight: mine shaft with stairs + rail f_270, f_273, f_274; ladder shafts f_233-f_235, f_244-f_246; watchtower shaft f_559, f_561 (straight corridor, no turn visible).
- Strongest frames for "no spiral": `disruptive-builds/f_270, f_273, f_559`. The tower shaft interior is dark; a turn out of frame cannot be excluded (UNRESOLVED, low risk).

### 1.4 Crenellation / battlements: PRESENT (strong). Best frames: `disruptive-builds/f_317, f_226, f_304, f_307, f_550, f_567`
Four variants. All are stone brick, plus spruce trapdoor slats.

1. Curtain-wall parapet with corbelled merlon cubes (B4 front wall): OBS f_226, f_304, f_313, f_317.
   - The wall face is a rhythm of pilasters (1 block thick, protruding) and recessed dark bays. Above each pilaster a merlon cube projects ~1 block beyond the wall face; the crenel (gap) sits above each recessed bay. OBS f_226, f_304.
   - Merlon = 1 block wide, 1 block tall above the wall top; crenel = 1 wide, i.e. merlon:crenel 1:1 (OBS f_226, f_307). Under each projecting cube sits a stair/slab corbel (INF: underside stair visible on the centre cube in f_226).
   - Blocks: merlon `stone_bricks` (pale caps `?stone_brick_slab`), corbel `stone_brick_stairs[half=top]`?, bay infill `stone_bricks` darker `?cracked_stone_bricks/deepslate?`. Between merlons under the parapet, vertical-slat panels `spruce_trapdoor[open=true]` (see section 4).
2. Wall-walk parapet on the slope (B4 west/rear wall): OBS f_305-f_309. The wall steps down with the terrain; merlon cubes alternate with a lower crenel row (f_307). Left end near the tower is ragged (f_304, f_306, f_309).
3. Tower-top crown (B4 towers, B15): OBS f_317, f_309, f_550, f_567.
   - B15 (clearest, f_550 crop): shaft front face 3 blocks wide; the top corbels out 1 block on each side (5 wide at the crown) on upside-down stairs/blocks; the front crenel pattern across the 5-wide crown is merlon-gap-merlon (2 raised merlons around 1 gap, raised 2 courses on the corners). OBS f_550; side view f_567 shows the corbel flare stepping out in 2 stages.
   - B4 towers (f_317): same corbelled flare under a merlon ring; width not resolved (oblique, ~4-5).
4. Small lookout turret merlons on the wall corners with a lit lantern (B4 f_307, f_308, f_309): 3x3 turrets with notched tops. OBS.

Geometry precise enough to implement (for the parapet shape):
- Inputs: path (line or rectangle ring) at wall-top y, `merlon` (1), `crenel` (1), `height` (1; 2 on corners), `overhang` (0|1: corbel stairs under merlons, facing outward, half=top), `fill` (trapdoor or none in the crenel recess).
- Place merlon on x%(merlon+crenel) < merlon. Corner cells are always merlons.
- Label: NEW SHAPE `parapet` (or PARAM `crenellate` on `walls`, which only handles rectangles). Terrain-following (f_305-f_309) is COMPOSITION: one call per wall segment at a different y.

## 2. Open candidates

- Skirt roof (alixxa): AMBIGUOUS, partial form only. B15 porch hood: a 3-tier stair/plank canopy hugging the tower front and wrapping both sides, `disruptive-builds/f_549, f_551, f_557, f_564` (crop of f_550). Tiers narrow upward (front ~5 / ~3 / ~1-2 blocks, INF from oblique, uncertain); it does not close into a full ring and does not crown anything. It is a half-hip lean-to against a wall. Not alixxa's skirt. Label: PARAM on `roofHip` (side-restricted / abutting a wall).
- Pyramid crown (alixxa): ABSENT. No pyramid roof anywhere. The tower crowns are flat crenellations; the torii cap (f_156, f_161) is a shallow tile cap, 1-2 courses, not a pyramid. Course count and apex: n/a, not present.
- Pointed arch (trixyblox): ABSENT (see 1.1).
- Triplet slit window + flower box (sub T7): AMBIGUOUS/PARTIAL.
  - OBS slit rows: B4 curtain wall, 3+ adjacent 1-wide x ~2-high recessed dark slits divided by pilasters, a spruce trapdoor lintel above each, stone-brick stairs at the pilaster feet: `disruptive-builds/f_313, f_314, f_315, f_227, f_226`. The slits read as 3 in a row on f_314 (full tight view), but the wall continues beyond the frame so "triplet" is not a closed group.
  - Flower box: no window flower box in this reel. Planter boxes exist but at ground level: statue planter f_503-f_505 (vertical-plank sides, flowers inside), gazebo-step planters f_469, stall pots f_517, f_519. The castle's stair feet sit where a flower box would be.
- Ruined mound (sub T5): AMBIGUOUS. A grass/dirt mound exists inside the castle courtyard carrying the mine adit (stepped dirt terraces with grass tops, walls cut around it): `disruptive-builds/f_222, f_224, f_259, f_296, f_298`. It is deliberate terrain, not a ruin. The west wall end is ragged/stepped (f_304, f_306, f_309) and might be an intentional broken wall; I cannot tell construction from damage. Not enough to call a ruined mound.

## 3. Other geometry the 12 shapes can't make

| name | description | how built | label | frames | confidence |
|---|---|---|---|---|---|
| Arcade / bay rhythm | A run alternating pier (1 wide) and bay (~2 wide) with lintel, infill and frieze. B1 arcade (4 bays), B1 timber gallery (7 posts / 6 bays), B4 curtain wall (pilaster/recess), B2 ground floor (posts + stone infill) | piers/posts at fixed period along a line, bay filled by bars/trapdoor/stone, lintel row above | NEW SHAPE `arcade` (period, pier, bay, height, lintel, infill, frieze) | disruptive-builds/f_044, f_067, f_313, f_097 | high that it recurs (4 builds); medium on exact block layout |
| Parapet with corbelled merlons | see 1.4 | cubes on stairs at wall top, tower crown flare | NEW SHAPE `parapet` | disruptive-builds/f_226, f_317, f_550 | high |
| Corbelled stepped arch / frieze | see 1.1 A, B, C | stairs half=top stepping 1 across / 1 up, mirrored | NEW SHAPE `corbelArch` | disruptive-builds/f_040, f_533, f_105 | medium |
| Half-hip porch hood | 3-tier lean-to hip abutting a wall, wraps 3 faces of the door | one `roofHip`-like ring with the wall side removed | PARAM on `roofHip` (`open: "south"` or `against`) | disruptive-builds/f_549, f_551, f_564 | medium (tier widths uncertain) |
| Irregular-footprint paving | Plazas/paths with ragged, blobby edges and mixed light-stone paving: B2 path, B3 path, B7 plaza, B9, B13 (3 stalls), B14 | `box`/`floor` with a noisy footprint mask, mixed stone/andesite/stone-brick material | PARAM on `box`/`floor` (`edge: noisy`) + `patches()` material | disruptive-builds/f_447, f_468, f_506, f_529, f_097 | high (seen in 6 builds); the edge algorithm is not recoverable |
| Hump footbridge | Stairs up 3 treads, short flat, 3 down (pond bridge) | two `stairs` runs back to back | SHAPE (2x `stairs`) | disruptive-builds/f_172, f_186, f_196, f_205 | medium (tread count ~3, oblique) |
| Cross-shaped dock/pier fingers | Plank cross/T fingers off a pier; plank cross bridge in B7 pond | `box` arms of 1-2 width | SHAPE (`box`) | disruptive-builds/f_325-f_331, f_447, f_449 | high |
| Torii gate | 2 pillars, 2 crossbeams with up-turned ends, tile cap, glowing veil inside | boxes + stairs for up-turned beam ends + cap rows | COMPOSITION (box + stairs); could become a prop shape | disruptive-builds/f_156, f_161, f_153 | medium |
| Willow canopy | Drooping leaf mass with hanging vines on a rooted trunk | leaf ellipsoid + per-column vine hang-down; stair roots | NEW SHAPE `canopy` (low priority) | disruptive-builds/f_474-f_481, f_484 | medium |
| Stair-ring planter | Ring of stone-brick stairs stepping outward around the tree base | ring path with stairs facing outward | NEW SHAPE / PARAM (`cylinder` rim) | disruptive-builds/f_484, f_485 | low (partly hidden by foliage) |
| Gable roof with stone verge on a wing | B2 wings: light plank stair rows with a stone-brick stair rim on the gable ends; B5 boathouse same | `roofGable` with `verge` | SHAPE (`roofGable` verge) | disruptive-builds/f_097, f_337, f_339 | high |
| Terrain-following wall | Curtain wall stepping down the slope in 1-block rises | wall segments at stepped y | COMPOSITION (several `walls`/`line` calls) | disruptive-builds/f_303-f_309 | medium |
| Mine rail on a stair slope | Rails running down a stair shaft | `rail[shape=ascending_*]` along a `stairs` run | BLOCKED (rail shape states not visible) | disruptive-builds/f_270, f_273 | low |

## 4. Repurpose table

Columns: block + state | used as | how placed | context | frames | label. B1..B15 refer to section 0. "Plate trick" means the recurring open-trapdoor-on-a-beam-end detail.
Colours: trapdoor wood types are read from tint under shaders, so every trapdoor/stair wood type is `?`.

| block + state | used as | how placed | context | frames | label |
|---|---|---|---|---|---|
| `?_trapdoor[open=true]` (tan, latch visible) | beam-end plate / boss ("rivet plate") on the end face of a projecting beam or roof corner | open=true, flat against the end face of the horizontal beam/stair block; one per post position | B1 gallery beam above each of 7 posts, pavilion roof corners; B9 gazebo roof corners; B11 well roof corners (INF open=true: handle faces out, panel is vertical) | disruptive-builds/f_064, f_067, f_031, f_035, f_469, f_490, f_487 | COMPOSITION |
| `?_trapdoor[open=true]` (vertical slat, no frame) | post-foot panel on the stone course; fascia band between stair/slab pieces | open=true on the outward face of the stone course at each post foot (7 in B1) | B1 walkway base; B9/B11 post feet (barrel-like ribbing); B3 pillar bases (ribbed variant) | disruptive-builds/f_067, f_040, f_470, f_491, f_156, f_158 | COMPOSITION |
| `stone_brick_stairs[half=top]` staggered with 1-deep gaps | relieving/sawtooth frieze above arcade bays (corbel) | half=top, facing outward/alternating, in 2 offset rows over each bay | B1 arcade top | disruptive-builds/f_040, f_043, f_044 | NEW SHAPE |
| `stone_brick_slab[type=top]` | bay lintel course | top half, full run over the bays | B1 arcade | disruptive-builds/f_040 | SHAPE (`box` + material) |
| `iron_bars` | sluice/portcullis grille deep in each culvert bay | centred in the bay opening, ~1 block recessed | B1 arcade, 4 bays | disruptive-builds/f_040, f_044, f_051, f_052 | COMPOSITION |
| `mossy_stone_bricks` + `vine` | aged pier base, ivy on piers | patches on lower piers; vine hanging down the face | B1 arcade | disruptive-builds/f_043, f_044, f_052 | COMPOSITION (`patches()` material) |
| `?_stairs[half=top]` (pale wood) on post top | knee brace / bracket supporting the beam, with a hanging lantern below | half=top on each side of the post below the beam, `lantern[hanging=true]` underneath | B1 walkway ceiling (inside) | disruptive-builds/f_071, f_073, f_070, f_062 | COMPOSITION |
| `?_fence` on `stone_brick_slab`/`stone_brick_stairs` | open balustrade on a knee wall | fence on top of a 1-high stone-brick base | B1 walkway edge; B2 mezzanine (wood-only) | disruptive-builds/f_070, f_071, f_037, f_112, f_115 | SHAPE (`railing`) |
| `barrel[facing=up]` | bridge-end bollard / crate | at the abutment end, stacked with chests | B1 ends | disruptive-builds/f_064, f_068, f_036, f_039 | COMPOSITION |
| `?_trapdoor[open=true]` (reddish, mauve? `crimson_trapdoor`?; alt `mangrove_trapdoor`) on a `bookshelf` | cabinet door front | stacked pairs flush on the shelf face, alternating with book rows; both sides of the aisle | B2 library walls | disruptive-builds/f_117, f_118, f_121, f_122, f_124, f_130 | COMPOSITION |
| `?_stairs[facing=*]` + `?_trapdoor[open=true]` | armchair (seat + back) | stair as seat facing the table, open trapdoor behind as the back rest | B2 library tables | disruptive-builds/f_128, f_106, f_107, f_110, f_122 | COMPOSITION |
| `?_trapdoor[open=false,half=top]` on a stripped-log/post pedestal | reading table | trapdoor over a 1-block pedestal (`stripped_?_log`? alt `barrel`) | B2 library | disruptive-builds/f_128, f_122, f_124, f_129 | COMPOSITION |
| `lectern` + `candle` | reading desk with book, candle beside | on a counter block against the wall | B2 library/attic | disruptive-builds/f_128, f_117, f_132, f_140 | COMPOSITION (near-original use) |
| `ladder` against `bookshelf` | library ladder | on the shelf face, full height | B2 walls | disruptive-builds/f_104, f_114, f_120, f_124, f_127 | COMPOSITION |
| `?_trapdoor[open=true]` (vertical slat, dark) in a stone-brick niche | window filler without glass | filling a 1-2 high niche in a 3-wide stone panel | B2 library and attic windows | disruptive-builds/f_105, f_107, f_109, f_136, f_141 | COMPOSITION |
| `?_stairs[half=top]` at the top corners of a niche | chamfer / squinch (degenerate arch) | one at each upper corner facing the opening | B2 niche | disruptive-builds/f_105, f_107, f_109 | NEW SHAPE (`corbelArch`) |
| `?_stairs` flanking a window | window seat | one stair each side of the niche, facing in | B2 attic | disruptive-builds/f_141, f_136 | COMPOSITION |
| `lantern[hanging=true]` under a small plank/slab block | ceiling pendant with a 1-block hanger | slab/plank block under the beam, lantern under it | B2 ceiling | disruptive-builds/f_101, f_122, f_123 | COMPOSITION |
| `cobweb` | neglect/decay dressing | in the corners and across the room | B2 attic | disruptive-builds/f_131-f_140 | COMPOSITION |
| `nether_portal` | glowing violet veil inside the torii gate | between the two pillars, frame hidden | B3 gate | disruptive-builds/f_144, f_153, f_162, f_163 | COMPOSITION |
| `campfire[lit=true]` (buried in the bank) | smoke/mist column rising through the bamboo | campfire set into a pit at the pond rim, nothing above it | B3 pond | disruptive-builds/f_176, f_177 (campfire visible); smoke f_145-f_148, f_172-f_184 | COMPOSITION |
| `?_wall` + `?_slab` + `lantern` | stone lantern (tōrō) | wall post on a slab base, lantern on top | B3 path edges and pond island | disruptive-builds/f_164, f_169, f_186, f_190, f_205 | COMPOSITION |
| `?_trapdoor[open=true]` (ribbed, terracotta-tinted) | pillar-base ribbing and beam-face panels on the torii | on the faces of terracotta pillars and the beam blocks | B3 gate | disruptive-builds/f_156, f_158, f_161, f_162, f_166 | COMPOSITION |
| `?_button`/dark recessed plate (`polished_blackstone_button`?) | rivet / knot detail on the top beam | single small plate centred on the beam face | B3 gate | disruptive-builds/f_161, f_156 | COMPOSITION (low confidence on block) |
| oxidized/teal tile blocks (`oxidized_cut_copper*`?; alt `dark_prismarine*`, `warped_*`) | roof tile cap of the torii | stairs/slabs/blocks rows, alternating with terracotta caps | B3 gate | disruptive-builds/f_156, f_157, f_161 | SHAPE/COMPOSITION |
| `?_stairs` + `?_planks` rows | hump footbridge across the pond | ~3 treads up, back down | B3 pond | disruptive-builds/f_172, f_173, f_186, f_196, f_205 | SHAPE (2x `stairs`) |
| `?_trapdoor[open=true]` (spruce) between merlon cubes / above bays | hoarding slat / wall shutter | open=true, vertical, hung at the top of each recessed bay | B4 curtain wall, towers | disruptive-builds/f_226, f_227, f_304, f_313-f_317 | COMPOSITION |
| `stone_brick_stairs` at pilaster feet | flared plinth / foot steps (sill-like) | facing outward at the foot of each pilaster | B4 front wall | disruptive-builds/f_313, f_314, f_315, f_316 | COMPOSITION |
| `stone_brick_stairs[half=top]` under merlon cubes | machicolation corbel | half=top, outward, under each projecting cube | B4 parapet | disruptive-builds/f_226, f_304 | NEW SHAPE (`parapet`) |
| pale blocks (`polished_andesite`?/`smooth_stone`?/`diorite`?) | gate lintel + merlon caps | lintel spans the gate opening, ~3 wide | B4 gate | disruptive-builds/f_226, f_227, f_317 | COMPOSITION |
| `?_wall` + `?_fence` + `lantern` | gate lamp post | wall stub, fence post, lantern on top | B4 gate sides | disruptive-builds/f_226, f_227 | COMPOSITION |
| `?_fence`/stone wall + `warped_planks`? (teal; alt `cyan_wool`) | flag pole and flag | pole of wall + fence; flag of ~6 blocks in a hooked shape | B4 tower | disruptive-builds/f_251, f_256, f_257, f_208, f_318 | COMPOSITION |
| `powered_rail` (gold, unpowered), `activator_rail` (red stripe) | decorative cart track loop and sidings | flat loop in the courtyard, branches to the adit; ascending rail on the stair shaft | B4 yard and adit | disruptive-builds/f_276-f_291, f_262-f_274 | COMPOSITION |
| `chest_minecart` / empty `minecart` (entities) | cargo props on the rails | on rail cells | B4 yard | disruptive-builds/f_282-f_294 ("Minecart with Chest" label f_290, f_294) | COMPOSITION |
| `furnace`/`blast_furnace`/`smoker` stack | kiln / smelter wall | 3 stacked in a stone alcove, chest + barrel beside | B4 mine hall | disruptive-builds/f_267, f_268 | COMPOSITION |
| `barrel[facing=up]` + `lantern` | side table with lamp | lantern placed on the barrel top | B4 alcove, adit | disruptive-builds/f_267, f_268, f_259, f_298 | COMPOSITION |
| `coal_ore`, `iron_ore` | ore pile as mine dressing | single blocks stacked or scattered at the yard edge and the adit | B4 yard | disruptive-builds/f_259, f_260, f_285, f_289, f_298, f_300 | COMPOSITION |
| `ladder` in a 1-wide shaft behind a door | tower shaft access | vertical ladder inside the wall, `?_door` closed at the foot | B4 towers | disruptive-builds/f_233-f_235, f_241, f_244-f_246 | COMPOSITION |
| `?_trapdoor[open=true]` + `?_stairs[half=top]` | mine-support bracket on the timber portal | angled bracket between post and lintel | B4 adit | disruptive-builds/f_262-f_264, f_269, f_270 | COMPOSITION |
| `?_trapdoor[open=true]` (dark oak, 2x2 pane) | wall panelling (wainscot) | flush on the interior walls of the boathouse booth | B5 boathouse | disruptive-builds/f_334, f_336, f_340 | COMPOSITION |
| `?_trapdoor[open=false]` flat on the deck | panelled deck tiles | closed, half=bottom, flat on the pier floor | B5 pier | disruptive-builds/f_362, f_343 (INF from panel texture on the floor) | COMPOSITION |
| `barrel[facing=up]` / stripped-log stump + `?_trapdoor` lid | pier bollards and cargo crates | on the deck edge | B5 pier | disruptive-builds/f_342-f_344, f_362-f_365 | COMPOSITION |
| `?_stairs` (stone brick) on the boathouse gable | stone shingle roof with dark-wood body | stair rows, gable ends rimmed in a second stair material | B5 boathouse | disruptive-builds/f_337, f_339, f_324 | SHAPE (`roofGable` verge) |
| `?_stairs` + log arm + `lantern` + `?_wall` | gallows-style lamp post at the pier head | vertical log, horizontal arm, lantern hanging | B5 pier | disruptive-builds/f_343, f_359 | COMPOSITION |
| `?_boat` (entity) | moored boats in the finger piers | on water cells beside the planks | B5, B6 | disruptive-builds/f_328-f_332, f_345-f_355, f_390-f_397 | COMPOSITION |
| `cauldron[level=3]` (water) | kitchen sink basin | inset in a counter run next to barrels | B6 interior | disruptive-builds/f_406, f_408 | COMPOSITION |
| `tripwire_hook` on a wall block | faucet / tap | hook mounted over the basin | B6 interior | disruptive-builds/f_406, f_408 | COMPOSITION |
| `anvil` + `lantern` | side table with lamp | lantern placed on top of the anvil | B6 interior | disruptive-builds/f_408 | COMPOSITION |
| `?decorated_pot`/`?flower_pot` (red) | mug/pot on the counter | on the counter beside the basin | B6 interior | disruptive-builds/f_406, f_408 | COMPOSITION |
| `barrel` (side-facing) | counter units | in a row under the basin and shelf | B6 interior | disruptive-builds/f_406-f_408 | COMPOSITION |
| `crafting_table`, `smithing_table`?, `grindstone`, `chest`, `blast_furnace`? | workbench counter run | in a row along a wall | B6 interior | disruptive-builds/f_409-f_412 | COMPOSITION (near-original) |
| `?_fence` grid (fence posts joined horizontally) | lattice window grille instead of glass | 1-wide and 3-high fence columns with horizontal connections | B6 interior windows | disruptive-builds/f_405-f_408, f_417, f_418 | COMPOSITION |
| `diorite_slab`?/`stone_slab`? cap on a dark log post | pier post cap | slab on top of a log post, lantern/fence beside | B6 pier | disruptive-builds/f_372-f_386, f_399 | COMPOSITION |
| `?_fence` + `lantern` on a plank stub | water lamp posts | plank stub, fence post, lantern | B6 pier | disruptive-builds/f_387-f_389, f_392-f_396 | COMPOSITION |
| `chain` hanging beside the hull | hoist/davit rope | chain from the beam to the water | B6 house corner | disruptive-builds/f_388, f_391-f_395 | COMPOSITION (what hangs at the end is unresolved) |
| `?_trapdoor[open=true]` (several, 3-wide block, upper) | hanging cabinet unit (3 wide) | above the counter, under the ceiling | B6 interior | disruptive-builds/f_406, f_407 (crop) | BLOCKED (block identity unclear) |
| `?_trapdoor[open=true]` + `?_fence` | planter boxes at the gazebo steps | planks/trapdoors as a rim around leaves/flowers | B9 | disruptive-builds/f_469 | COMPOSITION |
| `bell`? (dark, hung) + `chain` + fence/trapdoor lattice hanger | bell hanging under the well roof | chain from a trapdoor/fence frame under the ceiling | B11 | disruptive-builds/f_490, f_491, f_494, f_495, f_499 | COMPOSITION (object colour is dark grey, not gold: `bell`? alt `hopper`?/`cauldron`?) |
| `leaves` + `vine` | willow hair | leaf shell, vines hanging from the rim | B10 | disruptive-builds/f_474-f_481 | NEW SHAPE (`canopy`) |
| stairs/trapdoors around a log | tree root buttress | stairs flaring out from the trunk base | B10 | disruptive-builds/f_484 (INF: low-res, partly hidden) | COMPOSITION |
| vertical-plank sides + flowers | planter box | 1-high rim of vertical-slat blocks around flowers | B12 statue, B13 stalls | disruptive-builds/f_503-f_505, f_517, f_519 | COMPOSITION |
| `white_wool` + `moss_block`? / `green_wool`? stripes | stall awning cloth | alternating columns under a slanted stair canopy | B13 | disruptive-builds/f_517, f_519, f_506-f_526 | COMPOSITION |
| `?_bed`? or `blue_wool`/`white_wool` strip | counter cloth with wares | on top of the counter | B13 | disruptive-builds/f_516, f_519 | COMPOSITION (bed vs wool unresolved) |
| `amethyst_cluster`, `candle`, `lantern`, `flower_pot` | stall wares | on the counter | B13 | disruptive-builds/f_519, f_517 | COMPOSITION |
| `?_wall` + `?_fence` + `?_wall` stack | gallows post (3 elements) | vertical stack, stone at both ends | B14 | disruptive-builds/f_529-f_537, f_573 | COMPOSITION |
| `chain` + `?_fence` | rope and hanging bar for the prisoner | under the crown centre | B14 | disruptive-builds/f_531-f_537, f_572, f_573 | COMPOSITION |
| plank platform with `?_stairs[half=top]` feet | raised stage with a notched underside | plank top, inverted stairs at the ends | B14 | disruptive-builds/f_529, f_533, f_573 | COMPOSITION |
| armour-stand/villager figure (entity) | the prisoner | standing under the chain | B14 | disruptive-builds/f_531, f_533, f_573 | BLOCKED (not a block) |
| `?_stairs` canopy | door porch hood | 3-tier hip lean-to, hugging the front | B15 | disruptive-builds/f_549, f_551, f_557, f_564 | PARAM (`roofHip` half-hip) |
| `?` in the tower window (green item, item-frame/`lectern`?) | window dressing | 1x1 window above the porch | B15 | disruptive-builds/f_550 | BLOCKED |

Counts: ~65 rows; the strongest cross-build repurposes (appear in 3+ builds) are the open-trapdoor plate/foot panel, trapdoor slats as shutters, upside-down stairs as corbels, lantern-on-block pedestals, and barrel/chest as props.

## 5. Stage-1

### B1. Timber gallery bridge on a stone sluice arcade (disruptive-builds/f_024-f_087; teaser f_015-f_016)
DRAFT — belum di-roast; provisional format

- Theme: covered timber gallery that doubles as a bridge over a river cut; stone sluice arcade below, a gabled pavilion at each end.
- Scale (OBS counts only): 4 arcade bays (f_044, f_042); 7 gallery posts in the front row = 6 post bays (f_067 crop); 2 end pavilions one storey above the gallery deck (f_067, f_080). Length, width, height unresolved (no scale reference, oblique views). The post rhythm (~every 2-3 blocks) does not match the arcade rhythm (4 bays below 6 post bays above), so the upper and lower rhythms are independent (OBS f_067).
- Massing: long low horizontal box on a stone base; silhouette = low centre, two taller stepped-roof ends; the cut banks are terraced dirt/grass steps (f_075-f_080).
- Build order: not visible. INF: terrain cut first (terraces f_075-f_080), stone arcade, deck, posts and beams, pavilions, roofs, lanterns.
- Palette per role:
  - foundation / piers: `stone_bricks` ~70%, `mossy_stone_bricks` ~25% concentrated low on the piers (f_052, f_043), a few `cracked_stone_bricks`? INF; ivy `vine` hanging on 2 faces (f_043).
  - infill: `iron_bars` in each bay (f_040); frieze `stone_brick_stairs[half=top]` + gaps (f_040, f_044).
  - structure: posts `dark_oak_log`? (alt `spruce_log`); beams `?_planks` tan (alt `oak_slab`) with plate trapdoors; floor `?_planks` dark with a lighter path strip.
  - balustrade: `oak_fence`? on `stone_brick_stairs/slab` knee wall (f_070-f_073).
  - roof: dark-brown `?_stairs` (spruce/dark oak) pavilion roofs with overhang; centre gallery roof low, plank/slab rows (f_034).
  - accent: `?_trapdoor[open=true]` plates and slat panels; `lantern[hanging=true]` under brackets.
  - ground: `grass_block`, `dirt`, `dirt_path`? (yellow strip f_073-f_080); props `barrel`, `chest` at the ends (f_064, f_068).
- Techniques:
  1. Arcade of 4 bays, 1-wide piers, flat slab lintel, iron-bar infill. Mcbuilder: no existing shape (`box` per pier + bay). Label NEW SHAPE `arcade`. Frames f_040, f_044, f_051. Confidence high (bays), medium (bay width).
  2. Stepped sawtooth frieze above the lintel (2 offset rows of upside-down stairs and notches). NEW SHAPE `corbelArch`/frieze. f_040, f_043, f_044. Medium.
  3. Gallery post-and-beam run with 7 posts, beam plates at every post, trapdoor slat panel at each post foot. SHAPE (`pillar` x7, `line`) + COMPOSITION. f_067, f_064. High on count.
  4. Knee-wall balustrade (stone course + fence). SHAPE (`railing`) + COMPOSITION. f_070-f_073, f_037. High.
  5. Upside-down stair brackets with hanging lanterns under the beam. COMPOSITION. f_071, f_073. High.
  6. End pavilions with stepped overhanging roofs and corner plates. `roofHip`/`roofGable` over an enlarged footprint for the overhang, plates = COMPOSITION. f_064, f_065, f_031. Medium (roof tiers not countable).
  7. Weathering: mossy patches + vine, low on the stone. COMPOSITION (`patches()` material). f_043, f_052. High.
- Naive vs theirs: naive = one `box` bridge deck with 4 arches/holes, a `roofGable` and `railing`. They split stone base and timber gallery with independent rhythms, add a frieze, plates and brackets, and age the stone.
- Unresolved: arcade bay/pier widths and height; whether the frieze row is stairs only or stairs + slabs; the bridge-roof profile between the pavilions; the wood type of posts and floor.

### B2. Timber-and-stone library manor (disruptive-builds/f_088-f_141)
DRAFT — belum di-roast; provisional format

- Theme: three-storey study manor with two forward wings, a garden path with a small fountain/bench group, and a book-lined interior with attic.
- Scale (OBS only): central block 3 storeys (f_089, f_097); 2 forward wings one storey + roof (f_096, f_097); a front garden path ending in a small plinth/fountain group (f_097). Footprint unresolved (aerial views are oblique, no scale).
- Massing: central tall block with gable, symmetrical wings leaning forward, roof ridges perpendicular; silhouette = stepped pyramid of gables (f_089, f_096).
- Build order: not visible.
- Palette per role:
  - structure: `dark_oak_log` posts (vertical) every ~2-3 blocks (f_097 crop), `?_planks` horizontal beams.
  - infill: `stone_bricks` between posts, narrow dark slit windows (f_097).
  - roof: pale-plank `?_stairs` (oak?) rows with `stone_brick_stairs` rim on gable ends (f_097 crop, f_096).
  - accent: `lantern`s on posts; `?_trapdoor[open=true]` plates on beam ends (f_097 crop).
  - ground: `grass_block`, pale stone path (`?stone`/`andesite`) with ragged edge (f_097); hedge bushes of `leaves` at the wing feet.
  - interior: floor `?_planks` dark; aisle floor grey mottled (`cobblestone`? alt `stone`) f_100-f_103; bookshelf walls with trapdoor cabinet fronts; ceiling log beams with stair brackets; `lantern[hanging=true]` pendants.
- Techniques:
  1. Posts-and-stone infill facade, 3 storeys, tall slit windows. SHAPE (`walls` + `pillar` repeated) + COMPOSITION. f_089, f_097. Medium.
  2. Wing gable roofs with a stone-brick verge. SHAPE (`roofGable` verge). f_097, f_096. High.
  3. Library bookshelf walls with every second row replaced by trapdoor cabinet fronts. COMPOSITION (material function on rows). f_117, f_124, f_130. High.
  4. Table + armchair sets: trapdoor top on a pedestal, stair seat + trapdoor back. COMPOSITION. f_128, f_106, f_122. High.
  5. Chamfered niche with trapdoor window, window seats. NEW SHAPE (`corbelArch`) + COMPOSITION. f_105, f_136, f_141. Medium.
  6. Mezzanine with fence balustrade and library ladders. SHAPE (`railing`) + COMPOSITION. f_112, f_114, f_115, f_120. Medium.
  7. Aisle terminating at an enchanting table framed by shelves. COMPOSITION. f_099-f_103. High (aisle layout), low (what sits on the table: unresolved).
  8. Attic decay: cobwebs, papers on lecterns. COMPOSITION. f_131-f_140. High.
- Naive vs theirs: naive = `box` + `roofGable` with `bookshelf` walls. They add trapdoor cabinet doors in the shelves, furniture from stairs/trapdoors, mezzanine and cobweb dressing.
- Unresolved: footprint and floor heights; the cabinet trapdoor wood; what is on the enchanting table; how the wings' stair rows are arranged (roof tiers not countable); the manor floor plan.

### B3. Torii shrine garden with portal gate (disruptive-builds/f_142-f_206)
DRAFT — belum di-roast; provisional format

- Theme: Japanese-style gate shrine on a small pond island inside a jungle: terracotta torii framing a glowing violet veil, stone lanterns, a hump bridge, steps, bamboo.
- Scale: gate = 2 pillars (OBS f_153, f_156); gate height/width unresolved (no scale reference in frame). Steps: 3 treads (f_188, f_196). No other dimensions are readable.
- Massing: one slender gate + small island, path from the lower bank across a 3-tread hump bridge (f_195-f_205).
- Build order: not visible.
- Palette per role:
  - structure: `terracotta`? (alt `orange_terracotta`) for pillars and beams.
  - accent: `?_trapdoor[open=true]` ribbed panels (acacia/jungle? tinted orange), `lantern`, dark recessed plate `?_button`.
  - roof: dark teal tile (`oxidized_cut_copper_stairs/slab`? alt `dark_prismarine_*`) alternating with terracotta caps.
  - fill: `nether_portal` between the pillars.
  - ground: pale stone paving `?stone_bricks`/`polished_andesite`? (f_186-f_205), `grass_block`, `sand` rim (f_172-f_177), `gravel`/`coarse_dirt` in the pond bed, `bamboo`, lily pads, ferns.
  - steps: `spruce_stairs` / `dark_oak_planks` hump bridge (f_172, f_186).
  - decor: stone lanterns (`?_wall` + `?_slab` + `lantern`), buried `campfire` smoke.
- Techniques:
  1. Torii: 2 pillars + 2 crossbeams with up-turned ends + tile cap. Mcbuilder: `box` pillars + stairs/slab ends + `roofGable`-like cap. Label COMPOSITION (SHAPE parts). f_156, f_161, f_153. Medium.
  2. Portal veil inside the gate. COMPOSITION. f_162, f_163. High.
  3. Buried campfire for smoke. COMPOSITION. f_176, f_177. High (the campfire is visible; the intent as mist is INF).
  4. Stone lanterns. COMPOSITION. f_164, f_169, f_190. High.
  5. 3-tread hump bridge. SHAPE (2x `stairs`). f_172, f_186, f_196. Medium.
  6. Irregular pale-stone paving path. PARAM (`box`/`floor` noisy edge). f_186-f_205. High.
- Naive vs theirs: naive = a torii of plain red blocks over a path. They put a nether-portal veil inside the gate, hide a campfire for mist, mix terracotta with trapdoor ribbing, and put the gate on a pond island with a hump bridge.
- Unresolved: the exact tile-cap block; the identity of the dark socket cubes on the beam ends (`?` dispenser-like); pillar and beam sizes; whether the veil frame is obsidian (hidden).

### B4. Stone castle gatehouse with mine-cart yard (disruptive-builds/f_207-f_319; teaser f_019-f_020)
DRAFT — belum di-roast; provisional format

- Theme: small stone fortress built into a hillside: gate in a pilastered curtain wall between two crenellated towers, a flag, and inside a courtyard with a grassy mound hiding a timber mine adit, rails, minecarts and ore.
- Scale (OBS only): 2 towers (left shorter with merlon top, right taller with flagpole) f_208, f_317; front wall between them with ~3 recessed bays on each side of the gate (f_317, tight view f_313-f_315); a rear wall with 2 small corner turrets (f_307-f_309). Wall length, tower width and heights unresolved (oblique, no scale).
- Massing: gate wall facing the viewer, a U-shaped enclosure open to the courtyard, backed by a hill; silhouette = two towers flanking a lower crenellated wall, flag on the right tower (f_208-f_211).
- Build order: not visible. INF: terrain mound and rail layout, then walls, then towers.
- Palette per role:
  - structure: `stone_bricks` main (~80%), darker recess infill (`?cracked_stone_bricks`/`stone_bricks` in shade), pale caps and lintel (`?polished_andesite`/`smooth_stone`/`stone_brick_slab`).
  - accent: `spruce_trapdoor[open=true]` shutters/hoarding slats at every bay head; `stone_brick_stairs` plinths; lit `lantern`s.
  - gate: pale lintel, lamp posts (`?_wall`+`oak_fence`+`lantern`).
  - mine portal: `spruce_log` posts, `?_planks`/`?_stairs` portal lid, `?_slab` roof (f_222, f_259, f_298).
  - floor: light grey mottled `?cobblestone`/`gravel`? courtyard (f_276, f_283), grass edges.
  - props: `powered_rail`, `activator_rail`, `minecart`, `chest_minecart`, `chest`, `barrel`, `furnace`s, `coal_ore`, `iron_ore`.
  - flag: pole `?_wall`/`fence`, flag `warped_planks`? (teal).
- Techniques:
  1. Pilaster/recess rhythm on the curtain wall with trapdoor lintels and stair feet. NEW SHAPE `arcade`; label also COMPOSITION. f_313-f_315, f_226. High (rhythm), medium (exact depth).
  2. Corbelled merlon cubes (machicolation) on the parapet. NEW SHAPE `parapet`. f_226, f_304, f_317. High.
  3. Tower crown: corbel flare + merlons; corner turrets with lanterns. NEW SHAPE `parapet`. f_317, f_307-f_309. Medium.
  4. Terrain-following wall stepping down the hill with a ragged west end. COMPOSITION. f_303-f_309. Medium.
  5. Mound with timber adit and rail loop. COMPOSITION. f_222, f_259, f_296, f_283-f_291. High.
  6. Gate with pale lintel and lamp posts. COMPOSITION. f_226, f_227. High.
  7. Smelter wall, storeroom, ladder shafts. COMPOSITION. f_241-f_250, f_267, f_233. Medium.
  8. Flagpole with hooked teal flag. COMPOSITION. f_251, f_256, f_257. High.
- Naive vs theirs: naive = a plain `walls` ring with `box` towers and a flat top. They give the wall a pilaster rhythm, a machicolated parapet, and fit it to the hill; inside they make a working-looking yard instead of an empty courtyard.
- Unresolved: all dimensions; whether the west wall end is a deliberate ruin; tower widths; what the pale lintel and caps are; trapdoor wood type; the rail block states.

### B5. Dark-wood harbour pier with boathouse (disruptive-builds/f_320-f_365)
DRAFT — belum di-roast; provisional format

- Theme: dark-oak pier with a booth-like boathouse under a stone-brick-shingled gable, 2 cross/T finger piers, mooring boats, a gallows lamp post at the pier head.
- Scale (OBS): 2 finger piers (cross and T shapes) beside the main pier (f_325, f_327, f_331); 1 boathouse with a stone-shingled gable at the far end (f_333, f_337); a second wooden pavilion arch at the near end (f_321, f_359). Pier length/width unresolved.
- Massing: long narrow pier ending in the boathouse; silhouette = low deck, two small peaked structures at the ends (f_321, f_325).
- Build order: not visible.
- Palette per role:
  - structure: `dark_oak_log` posts, `dark_oak_planks` deck, `spruce_planks`? accents.
  - roof: stone-brick (`?stone_brick_stairs`) in pale grey, with a stair rim; pavilion roof dark `?_stairs` (f_321, f_337).
  - interior panelling: `?_trapdoor[open=true]` dark (f_334).
  - props: `barrel`, `chest`, `lantern`, `?oak_boat` entities.
  - ground: `water`, `sand`/`quartz-like` pale slope on the left (f_321-f_323).
- Techniques:
  1. Cross/T finger piers off the main pier. SHAPE (`box`). f_325-f_331. High.
  2. Stone-shingle gable on a dark-wood body, with a stair rim. SHAPE (`roofGable` verge). f_337, f_339. High.
  3. Trapdoor wainscot and panelled deck. COMPOSITION. f_334, f_340, f_362. Medium.
  4. Gallows-style lamp post. COMPOSITION. f_343. Medium.
  5. Moored boats on water between the fingers. COMPOSITION (entities). f_328-f_332. High.
- Naive vs theirs: naive = a plank strip and a hut. They give the pier cross fingers, boats, a stone-shingled gable, trapdoor panelling and lamp posts.
- Unresolved: pier dimensions; the second pavilion's roof; the deck pattern; what the barrels contain (irrelevant).

### B6. Riverside pier house, light wood (disruptive-builds/f_366-f_429; teaser f_017-f_018)
DRAFT — belum di-roast; provisional format

- Theme: small two-level timber house on a river peninsula with a long pier of dark log posts capped in pale slabs, a kitchen/workbench interior and a bedroom nook.
- Scale (OBS): house with 2 levels (f_377, f_400); pier with a row of capped posts along each side (f_372-f_376, f_399; the count is not readable, oblique); house gable roof of `?_stairs` (f_374, f_375). Footprint unresolved.
- Massing: compact two-storey house at the shore end, pier running out along the water; silhouette = stepped roof over a dark-log-framed light-plank box (f_366, f_376).
- Build order: not visible.
- Palette per role:
  - structure: `dark_oak_log` corner posts; walls `oak_planks`/`birch_planks` light (f_377, f_379); upper wall horizontal `?_log`.
  - roof: `?_stairs` light/dark mix, stepped (f_374, f_376).
  - floor: `oak_planks` (f_414-f_416); pier `oak_planks` with `?_slab` caps on logs.
  - accent: `lantern`, `?_trapdoor` shutters, fence grille windows.
  - ground: `grass_block`, `stone` rim.
  - interior props: see section 4 (cauldron sink, anvil, barrels, workbench run, bed).
- Techniques:
  1. Pier with log posts + slab caps + fence rail + lamp posts. SHAPE (`pillar`, `railing`) + COMPOSITION. f_372-f_386, f_399. High.
  2. Fence-lattice windows. COMPOSITION. f_405-f_408. High.
  3. Kitchen counter (barrels, cauldron sink, hook faucet, anvil lamp). COMPOSITION. f_406, f_408. High.
  4. Workbench run (crafting/smithing/grindstone/chests). COMPOSITION. f_409-f_412. High.
  5. Stepped roof with a covered side shed. `roofGable` + `box`. f_374-f_377, f_400. Medium.
  6. Hoist chain at the house corner. COMPOSITION. f_388, f_391-f_395. Low (what hangs is unresolved).
- Naive vs theirs: naive = a box house with a plank jetty. They add post caps, lamp posts, a boat winch and a lived-in interior from non-furniture blocks.
- Unresolved: dimensions; cap block; the hanging 3-wide cabinet; the chain's load.

### B7 + B8. Cross-shaped pond pavilion and stone fountain (disruptive-builds/f_430-f_458 and f_459-f_463)
DRAFT — belum di-roast; provisional format

- Theme: village-green props on an open plain, seen from a distance and then close (f_430-f_445 approach).
- B7 pond: a cross-shaped plank bridge over a pond whose four quadrants are stepped stone basins (stair-stepped bottom visible, f_447, f_449); a 4-post pavilion with a stacked small roof stands at the cross centre; stone lanterns at the quadrant corners; irregular light-stone plaza rim (f_447-f_452). Arm lengths unresolved.
- B8 fountain: stone-brick basin with lanterns at 4 corners, a stepped central pillar corbelling out in tiers, a rectangular column of falling water around it (f_460, f_462, f_463). Pillar height/width unresolved.
- Palette: B7 `?_planks` (spruce/oak?) cross deck, stripped-log posts, `?_stairs` pavilion roof, `stone_bricks`/`stone`, `water`, `?_wall`+`lantern` posts. B8 `stone_bricks`, `stone_brick_stairs/slab`, `lantern`, `water`, `glass`? (the water column's boundary looks translucent, INF).
- Techniques: plank cross over a pond (SHAPE `box`, f_447, f_449); stepped basin interior (SHAPE `stairs`, f_447); pavilion roof stacking (COMPOSITION, f_447, f_456-f_458); irregular plaza edge (PARAM noisy edge, f_447-f_452); tiered corbel pillar (COMPOSITION, f_460, f_463; low confidence).
- Naive vs theirs: a naive pond is one `box` of water; they carve a stepped cross basin and lay a cross deck with a pavilion at the junction.
- Unresolved: pond/arm dimensions; the exact water-column mechanism (water source vs glass shell); pavilion post block.

### B9 + B10. Wayside shelter gazebo and willow tree plaza (disruptive-builds/f_464-f_472 and f_473-f_485)
DRAFT — belum di-roast; provisional format

- B9: 4 dark log posts, gable roof of plank stairs with stacked ridge, plate trapdoors on the roof corners, post-foot trapdoor ribbing, hanging lanterns, 2-tread stone plinth with planter boxes at the steps, wrapped in an irregular stone path (f_464-f_472). Post spacing/roof span unresolved.
- B10: willow with a drooping oak/dark-oak leaf canopy and hanging vines, a root buttress of stairs around the trunk, a ring planter of stone-brick stairs on a round-ish stone plaza (f_473-f_485). Canopy size unresolved.
- Palette B9: `dark_oak_log` posts, `?_stairs` spruce roof, `?_trapdoor` plates, `stone_brick_stairs` steps, `lantern[hanging=true]`. B10: `dark_oak_log`/`oak_log` trunk, `?_leaves`, `vine`, `stone_brick_stairs` ring, `?_trapdoor`/`?_stairs` roots, flowers.
- Techniques: gable roof over 4 posts with overhang (SHAPE `roofGable`, f_465-f_468); plate trick (COMPOSITION, f_469); stair-ring planter (NEW SHAPE/PARAM, f_484, f_485); willow canopy (NEW SHAPE `canopy`, f_474-f_481).
- Naive vs theirs: naive = a tree from `sphere` leaves; they build a drooping canopy and a root buttress.
- Unresolved: whether the ring planter stairs face outward on every cell; canopy construction (vine count).

### B11. Bell well (disruptive-builds/f_486-f_500)
DRAFT — belum di-roast; provisional format

- 4 thick log posts with post-foot trapdoor ribbing, gable-style roof with corner plates and lanterns, a hanger frame of fences/trapdoors under the ridge with a chain and a dark bell-like object hanging over a 3-tier stone-brick plinth; the stone shaft below is lined in stone brick with a stepped rim (f_487-f_499). Palette: `dark_oak_log`/`spruce_log`?, `?_stairs`, `stone_brick_stairs`, `?_trapdoor`, `chain`, `bell`?, `lantern`.
- Techniques: plate trick and post-foot ribbing (COMPOSITION, f_490, f_491); well shaft (SHAPE `box` hollow; f_492-f_498); chain hanger (COMPOSITION, f_494, f_495).
- Naive vs theirs: a naive well is a hollow box with a roof; they hang a bell from a lattice frame and rib the posts.
- Unresolved: shaft depth/width; whether the hanging object is a bell (colour is dark, not gold).

### B12 + B13. Statue planter and market stalls (disruptive-builds/f_501-f_505 and f_506-f_526)
DRAFT — belum di-roast; provisional format

- B12: a stone-brick statue (tapering block figure on a plinth) on a vertical-plank planter box with flowers (f_503-f_505).
- B13: 3 stalls on a paved plaza with a ragged edge; wooden frames with slanted stair canopies, wool/moss stripes, counters with candles, lanterns, pots, amethyst, cloth strips (f_506-f_526; counts: 3 stalls OBS f_506, f_509, f_526; a small extra table at the lower left in f_517).
- Palette: stalls `spruce_planks`/`?_stairs`/`?_fence`/`stripped_?_log` posts, `white_wool`, `moss_block`?, `blue_wool`, `lantern`, `candle`, `flower_pot`, `amethyst_cluster`; plaza `stone_bricks`/pale stone; statue `stone_bricks`, `stone_brick_stairs`.
- Techniques: slanted canopy from upside-down/forward stairs (COMPOSITION, f_517, f_519); striped awning (COMPOSITION, f_517); planter box (COMPOSITION, f_503-f_505, f_517); irregular plaza (PARAM, f_506-f_526).
- Naive vs theirs: they dress each stall with different wares and a unique awning.
- Unresolved: whether the cloth strips are beds or wool; awning block identity; statue figure dimensions.

### B14. Pillory / gallows platform (disruptive-builds/f_527-f_537, f_571-f_575)
DRAFT — belum di-roast; provisional format

- Plank stage with a notched underside on a paved plaza; 2 posts (stone/fence/stone stacks) carrying a stepped timber arch, a chain from the crown, a hanging figure (entity) (f_529-f_537, f_573). Dimensions unresolved.
- Palette: `?_planks`, `?_stairs[half=top]` feet, `spruce_stairs`/`?_planks` arch, `?_wall`, `?_fence`, `chain`.
- Techniques: stepped arch (NEW SHAPE `corbelArch`, f_533, f_573); notched stage underside (COMPOSITION, f_529, f_533); 3-element post stack (COMPOSITION, f_529-f_537).
- Naive vs theirs: a naive gallows is one beam on two fences; they step the arch and corbel the beam ends outward.
- Unresolved: arch exact stair facings; platform width; what hangs.

### B15. Small crenellated watchtower (disruptive-builds/f_538-f_569)
DRAFT — belum di-roast; provisional format

- Shaft 3 blocks wide (f_550 crop), a door under a 3-tier plank/stair porch hood that wraps both sides (f_549, f_551, f_557, f_564), a 1x1 window with a small green object (f_550), corbelled crown 5 wide with merlons (f_550, f_567); the base has a stone plinth with corner piers, set in a coarse-dirt/gravel yard patch with a yellow path strip (f_556, f_557). Interior: a dark stone-brick shaft with a straight run of steps and a gold-framed square at the far end, identity unresolved (f_559, f_561). Height unresolved (oblique, no scale).
- Palette: `stone_bricks` shaft, `stone_brick_stairs` plinth and corbels, `spruce_stairs`/`?_planks` hood, `spruce_door`, `?_trapdoor`, `lantern`?; ground `gravel`/`coarse_dirt`, `dirt_path`.
- Techniques: corbelled merlon crown (NEW SHAPE `parapet`, f_550, f_567); half-hip porch hood (PARAM on `roofHip`, f_549-f_551, f_564); plinth with corner piers (COMPOSITION, f_556, f_557).
- Naive vs theirs: a naive tower is a `cylinder`/`box` with a flat top; they flare the crown and add a porch hood.
- Unresolved: tower height; what is in the window and the top-of-shaft frame; the interior layout beyond the first flight.

## 6. Unresolved items (cross-build)

- No dimension in this reel is scale-referenced; every footprint/height is unresolved except the counts listed per build (4 arcade bays, 7 gallery posts / 6 bays, 3 hump-bridge treads, 3 stalls, 3-wide tower shaft).
- Tint-dependent block identities: all wood types, the torii cap, the library cabinet trapdoors, the 3-wide cabinet unit in B6, the bell object in B11.
- Whether the castle's west wall end is a ruin or a stepped finish.
- Build order for every build (a tour, not a process).
- The two teaser scenes f_001-f_007 (lodge, lake village) never recur.
