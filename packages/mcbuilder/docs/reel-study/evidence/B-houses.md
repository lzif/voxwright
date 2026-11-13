# Frame reader B: houses

Reels: french-mansion (FM), arashy12-medieval-house (AR), gorillo-spruce-house (GS), gorillo-survival-house (GV), noes-starter-house (NS).
Section 5 omitted on purpose (these reels have stage-1 notes elsewhere).
Frames are cited as `reel/f_NNN` (the short reel codes above are used in the text; "f_NNN" without a code means the reel under discussion). OBSERVED = visible. INFERRED = reasoned, basis stated.
Method: all ~34 sheets viewed; ~45 keyframes or full-res crops opened.
Shader notes: NS tints oak orange; FM tints shadows strongly blue (blue faces in FM are shadow, not blocks).
Block-ID confidence: stone_bricks and oak/spruce planks, logs, stairs, slabs are solid. The dark brick in AR/GV is `deepslate_bricks ?` or `polished_blackstone_bricks ?`. The white mottled infill in AR/GV is `calcite ?` (alternatives: `white_concrete_powder`, `diorite`). The cream FM facade is `?` (smooth_sandstone / quartz_block / cut_sandstone).

---
## 1. Hypothesis shapes

### 1.1 arch: PRESENT (stepped round and pointed; no keystone seen)
Strongest frames: FM/f_044 (crop), FM/f_068 (crop), FM/f_023 (crop), AR/f_082 (crop), AR/f_139-f_140.

**A. Stepped round/segmental opening heads, FM (OBSERVED; span unresolved)**
- FM/f_044, top-down on the cream facade wall under construction. Three tall openings, each with a chamfered head: two 1-block steps (1 across, 1 up) at each upper corner, then a flat top. Profile = stepped segmental ("corner-cut") arch, rise 2. The narrow middle opening has the same 2-step profile on a smaller span.
- Span in blocks: unresolved (foreshortened top-down view; not guessed).
- No keystone, no voussoir ring, no contrast block on the head. The facade block itself forms the arch (negative space cut into the wall).
- FM/f_068 crop (full-res 150,1500): the grand-stair undercroft is a stone-brick hood with a stepped-top opening (1 to 3 steps visible). The central entrance door above (FM/f_068 crop 360,1000) is a narrow tall opening with 1-step chamfered upper corners (a minimum "round" head), span `~3` (blurry).
- FM/f_023 crop: stone-brick arcade on the podium, 3 bays between square piers. The lintel edge dips between piers in steps, i.e. a very flat stepped segmental arch with the piers as springers (INFERRED from the stepped edge). Span per bay unresolved.

**B. Pointed rib, AR (OBSERVED)**
- AR/f_139-f_140: a free-standing loop of dark bricks above the belvedere roof. Legs rise nearly vertical, then lean inward ~1 block per course to a flat apex 2 blocks wide (f_139: the top course is 2 bricks side by side). Profile = steep pointed (lancet).
- Overall span and rise unresolved; the rise is clearly greater than half the span.
- Not a door or window opening: it is a decorative rib; two such ribs frame the pyramid spire (AR/f_141-f_145).

**C. Ogee/pointed dormer hoods over window bays, AR (OBSERVED; counts unresolved)**
- AR/f_075-f_090 (crops f_078, f_082). Dark-brick stair outlines in two humps above each pair of upper windows: steps climb ~1:1 from a flared outer foot, steepen near the top, and end in a flat cap about 3 wide with a 1x2 hole beneath. A shared valley sits between the humps.
- Blocks: stairs plus full dark bricks (`deepslate_brick_stairs ?`).
- Step counts unresolved (compression, shader).

Parameters implied: `profile` in {stepped-round, segmental, pointed}; `chamferSteps` (FM: 2); `span`; `rise`; cut-into-wall (FM) versus free-standing rib (AR).
Label: NEW SHAPE `archOpening(c1, c2, profile, rise)`. A hollow `box` cannot cut a stepped head, and `stairs()` only climbs 1:1 in one direction.
Confidence: A medium (profile clear, dimensions unreadable); B medium; C low.

### 1.2 dome: ABSENT
- No dome in the 5 reels. Nearest forms: a pyramid cap on a white belfry/chimney shaft (FM/f_071 crop), stepped pyramid spires (AR/f_141-f_144), a concave bell silhouette of the AR spire (AR/f_153), and circular fountain basins (FM/f_101, f_118; discs, not domes).
- FM roofs are mansards of dark stairs (FM/f_064-f_070), not domes.

### 1.3 spiral stairs: ABSENT
- FM: straight double-flight grand stair in the entrance hall (FM/f_033-f_034 from above); straight outer stone stair with landing and undercroft (FM/f_068 crop).
- GS: L/switchback interior stair (GS/f_024 crop); straight exterior run along the wall (GS/f_063-f_079, f_066).
- NS, GV, AR: none seen.

### 1.4 crenellation / battlements: PRESENT (FM only)
- FM/f_048 (crop 350,500): parapet of the entrance pavilion roof = alternating raised blocks. Four merlons visible; each ~2 blocks wide with ~1-block gaps (ratio INFERRED from one perspective view, `~2:1`).
- FM/f_049-f_051 and f_055-f_063: the same notched parapet repeats around the terrace edges of the lower roof.
- FM/f_007 (crop): in the plan overlay the wall outline shows 4 small notches along the top edge, consistent with merlons. The side walls zig-zag in 1-block bumps (pilasters, see 3.8).
- Block: same cream block as the facade, one cap course above the cornice. No machicolations.
- Parameters: `merlon`, `gap`, `height=1`, `offset`.
- Label: PARAM on `walls`/`box` (`crenel: {merlon:2, gap:1}`) or small NEW SHAPE `battlements(line, merlon, gap)`. COMPOSITION fallback: one `box`/`line` per merlon.
- Confidence: medium.
- None in AR, GS, GV, NS. The M-shaped stair outlines in AR/f_078 are hoods, not crenellation.

---
## 2. Open candidates

- **skirt roof (alixxa)**: AMBIGUOUS, a weak echo in AR. AR/f_137-f_138: a 1-block overhanging ring of dark stairs around the belvedere deck below the spire, planks inside (square collar roof). FM/f_071 crop: small dark pyramid cap on a white shaft, no skirt. Not strong evidence.
- **pyramid crown (alixxa)**:
  - AR/f_141-f_144: stepped plank pyramid inside four dark-brick corner ribs. Plank course count unresolved (my estimates from different blurred frames range `~4` to `~9`; do not use). Apex = dark-brick stack, `~3` high (f_141 crop), topped by a thin pin `~3-4` tall, segmented, orange/oak-coloured (`lightning_rod ?` or `oak_fence ?`).
  - FM/f_071 crop (full-res 300,560): dark pyramid cap, `~3` courses (centre taller than flanks), then a white pin `~3` high.
  - Exact course count and apex block: unresolved in both.
- **pointed arch (trixyblox)**: AR/f_139-f_140, see 1.1-B; AR/f_075-f_090 hoods, see 1.1-C.
- **triplet slit window + flower box (sub T7)**:
  - Slits in groups: PRESENT in AR. AR/f_049 crop (full-res): two 1-wide x 3-tall slits per white panel on the side face, each with an oak vertical bar and crossbars (`oak_trapdoor[open=true]` stack `?` or `ladder ?`). AR/f_059-f_062 and f_078-f_082: front panels show 3 slits per panel (small tiles, `~3`). Layout: slits 1 white block apart, hanging from the top frame beam. Matches the candidate (AR/f_062 crop shows a single 1x3-4 slit with a trapdoor/ladder stack to one side).
  - Flower box: AR absent. NS PRESENT (best): NS/f_064-f_078, crop f_066: a trough of 3 trapdoor-like boards plus 2 end boards under the window, leaf blocks as the bush (`spruce_trapdoor[open=true]` x5 `?`, `oak_leaves[persistent=true]` / `azalea_leaves ?`). GS PRESENT as flower sill: GS/f_066 crop = 3 `flower_pot`s with white flowers on a ledge with a lantern between. GV PRESENT: GV/f_055 crop = potted daisy plus zombie head on a `stone_brick_slab[type=top]` sill.
  - Verdict: slits PRESENT (AR); flower box PRESENT (NS, GS, GV). No reel combines triplet slits with a flower box in one window.
- **ruined mound (sub T5)**: ABSENT in these reels.

---
## 3. Other geometry the 12 shapes can't make

| # | name | description | how built (as seen) | label | frames | conf |
|---|------|-------------|---------------------|-------|--------|------|
| 3.1 | timber-frame wall (frame + inset infill) | corner and intermediate posts, top and bottom beams, infill panel set ~1 block inside the frame plane | NS: floor, then pillars (f_032-f_036), then lintels (f_041-f_046), then infill placed behind (f_047-f_054). AR: log posts + beams + white infill (f_039-f_050). GS/GV: log posts with planks or calcite between | NEW SHAPE `timberFrame(c1,c2, postEvery, post, beam, infill, inset)`. `walls` gives only a solid skin. | NS/f_036, f_046-f_054; AR/f_045-f_050; GS/f_026-f_038; GV/f_008-f_020 | high (concept), medium (spacing; NS 9-wall shows corner + middle posts, f_036) |
| 3.2 | jetty / overhanging upper floor with corbels | upper deck projects 1 block beyond the lower wall; edge built from stacked slab/stair rows; upside-down stairs under the overhang at intervals | AR/f_034-f_038 deck projects over the stone wall, brackets in a regular rhythm. AR/f_049 crop: edge = 2 layers of oak stairs/slabs, brackets every ~3 blocks, corner post carried through. GS/f_023-f_025: log ring beam with log-end stubs out at corners and mid-side | NEW SHAPE `jetty(c1,c2, out=1, edge, corbel, every)`. COMPOSITION fallback: `box` + `line(stairs[half=top])`. | AR/f_034-f_038, f_049, f_062; GS/f_023-f_025, f_024 crop | high |
| 3.3 | gable end wall (triangular infill) | triangular wall under the verge stairs, different material from the roof; stairs climb 1:1; flat 2-3 wide cap | NS/f_079-f_094: plank gable (stepped), cobble stairs verge both slopes. GV/f_023-f_027, f_035 crop: calcite gable, dark stair verge, log-cap corners. AR/f_104-f_113: steep A gable, dark verge | PARAM on `roofGable`: `endWall: Material` (fills the triangle) + `capBlocks`. `verge` exists; the fill does not. | NS/f_080-f_094; GV/f_023-f_027, f_035; AR/f_105-f_113 | high |
| 3.4 | dormer with pediment | small projecting gable window above the eave; paired pilasters; stepped cream pediment with spire finial | FM/f_074 crop and f_090 crop: 2 pilasters, 3-step pediment crown, spire pin at apex, dentil row beneath | NEW SHAPE `dormer(c, width, pediment)`. COMPOSITION fallback: `box` + `roofGable`. | FM/f_074, f_090, f_077-f_079 | medium |
| 3.5 | crenellated parapet | see 1.4 | alternating raised blocks on a 1-course cap | PARAM `crenel` on `walls`/`box` | FM/f_048, f_049, f_055-f_063 | medium |
| 3.6 | chimney stack with fire/smoke | pillar on the roof or against a wall, campfire on top, optional collar | GS/f_070 crop: calcite column + campfire in an open box of 3 trapdoors, smoke. NS/f_115-f_120: pillar + campfire, smoke trail. AR/f_124-f_127: 3x3 stone shaft with hollow flue + plank collar ring; AR/f_146-f_152: red-brick column on a side wall, campfire flame at f_152. GV/f_055-f_057: stone pillar + barrel/trapdoor box + fire. FM/f_071 crop: white shaft with 3-course dark pyramid cap + pin | COMPOSITION (`pillar` + `set` campfire[lit=true]); optional NEW SHAPE `chimney(base,h,collar)` | as listed | medium |
| 3.7 | pergola / porch awning | rows of slabs with gaps on posts, hanging lantern, over a plank deck | NS/f_121-f_137: deck + fence first (f_055-f_058), awning rows (f_122-f_132; glow in rows is shader/burning-light effect), 2 corner posts (f_135-f_137), lantern (f_137) | COMPOSITION (`line` rows of `oak_slab`, `pillar`s). Needs a material with gaps (air). | NS/f_121-f_137, f_137 crop | medium |
| 3.8 | pilaster / engaged-column rhythm (wall-depth layering) | facade zig-zags in 1-block projections; columns with base and capital 1 block proud of the wall | FM/f_007 crop: bumps along 30-long sides; FM/f_068 crop: fluted shafts, wider capital and base; FM/f_074 crop | PARAM on `walls`: `pilasters: {every, depth, width}` | FM/f_007, f_068, f_074 | medium |
| 3.9 | stepped pyramid spire with ribs | square plank stair-pyramid inside 4 dark corner ribs, finial pin | AR/f_139-f_145, f_153 | `roofHip` handles the pyramid (SHAPE); ribs + finial = PARAM `finial`, `ribs` | AR/f_141-f_145 | low (courses unresolved) |
| 3.10 | outer staircase | straight stair run along the wall, spruce stairs, plank side strip | GS/f_063-f_079, f_066 crop (left of frame) | SHAPE (`stairs` with `width`), `railing` optional | GS/f_066 | medium |
| 3.11 | recessed window reveal | glass set ~1 block behind the frame; shutters on the reveal; sill proud | GS/f_066 crop: pane flanked by 2 stacked trapdoors each side; NS/f_066 crop: frame proud, infill inset; AR/f_049 crop: slit recessed | COMPOSITION rule (the `inset` parameter in 3.1) | GS/f_066; NS/f_066, f_071; AR/f_049, f_062 | medium |
| 3.12 | ogee hood / kicked eave | see 1.1-C | dark stair arcs over bays, flared feet | BLOCKED (shape not pinned) | AR/f_075-f_090 | low |
| 3.13 | podium stair with undercroft | stone flights flanking a hooded arched opening, landing in front of the entrance | FM/f_068 crop (full-res 150,1500) | NEW SHAPE or COMPOSITION (`stairs` + `archOpening`) | FM/f_068, f_048, f_050 | low |
| 3.14 | formal garden (parterre, fountain, hedge maze) | outside house scope; noted only | FM/f_096-f_126: path grid, circular fountain (f_101), leaf-block hedge maze (f_120-f_126), fence rail (f_089-f_090) | COMPOSITION (`cylinder`, `box`, `patches`) | FM/f_096-f_126 | high (what it is), n/a (dimensions) |

Already covered by the 12 shapes: wall skins (`walls`), gable roofs (`roofGable` with verge/eave), hip roofs and pyramid caps (`roofHip`), stair runs, railings, posts (`pillar`), fountain basins (`cylinder`).

---
## 4. Repurpose table

| block + state | used as | how placed | context | frames | label |
|---|---|---|---|---|---|
| `oak_stairs[half=top]` | jetty corbel / bracket | 1 block under the deck edge, step toward the wall, every ~3 blocks; larger stack at corner post | AR upper-storey overhang | AR/f_035-f_038, f_049 crop, f_062 crop | COMPOSITION (inside NEW SHAPE 3.2) |
| `oak_slab[type=top]` + planks | layered jetty fascia | 2 stacked edge rows, slab row above the bracket row | AR | AR/f_049 crop | COMPOSITION |
| `oak_trapdoor[open=true]` stack (or `ladder ?`) | slit-window mullion/shutter | 3-4 stacked in a 1-wide slit, one side; rungs read as crossbars | AR front and side panels | AR/f_049 crop, f_062 crop | COMPOSITION |
| `oak_trapdoor[open=true]` x4 | shutters | 2 stacked on each side of a glass pane, each side 1 wide x 2 tall | GS windows | GS/f_066 crop | COMPOSITION |
| `flower_pot` (white flowers; `potted_oxeye_daisy / azure_bluet / lily_of_the_valley ?`) | window-sill planter | on a ledge, 3 pots per window with a lantern between | GS sills | GS/f_066 crop | COMPOSITION |
| `lantern[hanging=true]` | beam-end light | hung under the protruding log beam stub beside the post | GS corners | GS/f_024 crop, f_066 crop | COMPOSITION |
| `lantern` standing | sill lamp | between the pots | GS | GS/f_066 crop | COMPOSITION |
| `lantern[hanging=true]` | pergola light | under the awning beam | NS | NS/f_137 | COMPOSITION |
| `oak_log[axis=x or z]` (end grain showing) | projecting beam stub / outrigger | at corners and mid-side, 1 block out from the beam ring | GS | GS/f_023-f_025, f_024 crop | COMPOSITION |
| `oak_log[axis=y]` end-grain | corner cap block | ring texture visible on top of posts and deck corners | GS, NS, AR, GV | GS/f_024 crop; NS/f_078 crop; AR/f_062 crop; GV/f_035 crop | COMPOSITION |
| doubled log columns | thick corner post | 2 logs side by side at each corner | AR | AR/f_039-f_042, f_062 crop | COMPOSITION |
| `barrel[facing=up]` | porch corner block | banded block with lid circle + dot on top, at the front deck corners | NS | NS/f_055 crop, f_013-f_023 | COMPOSITION |
| `barrel` (sideways) | foundation course | row at ground level along the wall base (dark bands repeat); INFERRED from banding | NS | NS/f_047-f_054, f_059 | COMPOSITION |
| `barrel` | temporary corner marker | at each corner/turn of the outline before the real build | NS | NS/f_011-f_012 | COMPOSITION |
| `spruce_trapdoor[open=true]` x5 | flower-box trough | 3 as front board, 2 as ends, under the window; leaves inside | NS | NS/f_064-f_078, f_066 crop | COMPOSITION |
| `oak_leaves[persistent=true]` / `azalea_leaves ?` | bush in the planter | fills the trough, bulges above | NS | NS/f_062-f_078 | COMPOSITION |
| `oak_trapdoor[open=true]` x3 sides + `campfire[lit=true]` | chimney / smoke stack | trapdoors stand around a campfire on a calcite pillar, front open | GS | GS/f_070 crop | COMPOSITION |
| `campfire[lit=true]` | smoke source | atop a stone/brick pillar on the roof | NS, AR, GV | NS/f_117-f_120; AR/f_152; GV/f_057 | COMPOSITION |
| `oak_fence` | porch railing | 2 rows on 3 sides of the deck | NS | NS/f_056-f_058 | SHAPE (`railing`) |
| `oak_fence`/trapdoor frame | belvedere open frame | 4 posts, fence balcony between | AR | AR/f_129-f_134 | COMPOSITION |
| `oak_slab` rows with gaps | pergola rafters | slabs across posts, spaced 1 apart | NS | NS/f_122-f_137 | COMPOSITION |
| `stone_brick_slab[type=top]` | window sill | under the window, 3-wide ledge | GV | GV/f_055 crop | COMPOSITION |
| `stone_brick_slab` row | string course between storeys | continuous ledge at the floor line | GV | GV/f_021-f_022, f_053-f_055 | COMPOSITION |
| `zombie_head` | sill decoration | next to a flower pot | GV | GV/f_055 crop | COMPOSITION |
| `calcite ?` with a 1x1 gap | slit/oculus window | one block removed in the gable infill | GV | GV/f_035 crop | COMPOSITION |
| `spruce_trapdoor` closed | loft hatch | in the plank floor opening | GV | GV/f_028-f_030 | COMPOSITION |
| inverted stairs/trapdoors `?` | cornice dentils | alternating small blocks along the cornice below the roof edge; block not identified (INFERRED) | FM | FM/f_074 crop, f_090 crop | COMPOSITION |
| cream stair/slab stack | dormer pediment | 3-step triangle above the dormer opening | FM | FM/f_074 crop | COMPOSITION |
| `quartz_pillar ?` + inverted stair/slab | column (shaft, capital, base) | wider top and bottom courses, 1 block proud of the wall (INFERRED) | FM | FM/f_068 crop | COMPOSITION |
| `oak_leaves` | hedge wall / maze | solid leaf walls in a pattern | FM gardens | FM/f_120-f_126 | COMPOSITION |
| leaf columns | cypress/topiary along the fence line | tall single columns (INFERRED) | FM | FM/f_105-f_113 | COMPOSITION |
| stairs as sofa, slab + candle as table, carpet as rug | interior furniture | red-brown stairs in a corner, low slab table, patterned carpet (INFERRED from shapes) | FM interior | FM/f_130-f_131 | COMPOSITION |
| white stairs/slab + trapdoor | bathroom fixtures | low confidence | FM interior | FM/f_133-f_134 | COMPOSITION |
| `deepslate_brick_stairs ?` | verge, hood, free-standing rib | stair steps 1:1 with a flat cap | AR, GV | AR/f_082 crop; GV/f_035 crop | SHAPE (`roofGable` verge) |
| `lightning_rod ?` / `oak_fence ?` | spire finial pin | single column atop the dark stack, ~3-4 high | AR | AR/f_141 crop | COMPOSITION (block unresolved) |

---
## Step sequences (tutorial reels, for any shape)

**NS (noes-starter-house)**: plan overlay labels 9 / 5 / 9 / 5 at NS/f_001-f_004 (OBSERVED).
1. L-shaped outline of orange planks with grey corner markers: top edge 9, left edge 5, right edge 9, bottom edge 5. Layout INFERRED from the filled footprint in f_030: a 9x5 house rectangle plus a 5x4 arm at the bottom right, which becomes the porch (the walls enclose only the upper rectangle; f_036-f_046, f_055).
2. Barrels replace the corner markers (f_011-f_012); banded foundation edge (f_013-f_023).
3. Floor fill, row by row (f_024-f_031).
4. Corner pillars one at a time (f_032-f_036), then posts and lintels (f_037-f_046). Post height ~3 (perspective; count not readable).
5. Infill panels, window, door (f_047-f_054).
6. Porch fence (f_055-f_058).
7. Window flower box (f_059-f_078).
8. Gable end stairs (f_079-f_094), then roof from the eave up (f_095-f_104), top-down rows (f_105-f_114).
9. Chimney and campfire smoke (f_115-f_120).
10. Pergola, 2 posts, lantern (f_121-f_137).

**AR (arashy12-medieval-house)**: plan overlay labels 7 (left), 4 (top notch), 12 (right), 5 and 3 (bottom) at AR/f_001-f_002 (OBSERVED; irregular notched footprint).
1. Stone-brick outline, plank floor (f_003-f_005).
2. Ground walls with 1x3 pane windows (f_006-f_023).
3. Overhanging deck for the upper storey (f_030-f_036), brackets (f_035-f_038).
4. Doubled corner posts, frames, white infill, slits (f_038-f_054).
5. Second deck (f_055-f_058); third-storey frame (f_059-f_072).
6. Dark stair hoods (f_075-f_090); two-tone plank roof (f_091-f_103).
7. Steep A-gable front (f_104-f_113); twin wings (f_114-f_123).
8. Chimney shaft and belvedere (f_124-f_138); ribs and spire (f_139-f_145); brick chimney (f_146-f_152).

**GS (gorillo-spruce-house)**: plan overlay labels 9 and 9 at GS/f_001-f_002 (OBSERVED; 9x9 square INFERRED from the 4-sided outline).
1. Outline, floor fill (f_001-f_004).
2. Low stone course, pale stone walls, log corner posts (f_005-f_014).
3. Ring beam with stub ends (f_023-f_025).
4. Upper storey set back inside the ring (f_026-f_038).
5. Asymmetric spruce stair roof (f_039-f_062).
6. Outer stair, shutters, flower sill (f_063-f_067).
7. Chimney (f_068-f_070), path (f_071-f_074).

**GV (gorillo-survival-house)**: no dimension overlay.
1. Long outline with bumps, plank floor (f_001-f_007).
2. Posts, lower wall, white upper panel (f_008-f_022).
3. Dark stair gable (f_023-f_027), loft floor with hatch (f_028-f_030).
4. Spruce roof, L with valley (f_031-f_045).
5. Front details: chests, barrels, crops (f_046-f_054); chimney (f_055-f_057).

**FM (french-mansion)**: overlay labels 21 / 30 / 9 / 21 / 9 / 30 / 21 along the cruciform outline (FM/f_007 crop; labels OBSERVED, geometry INFERRED).
1. Plan with notched/pilaster edge (f_007); podium interiors from above (f_019-f_026).
2. Plaza floor (f_027-f_030); entrance pavilion (f_031-f_034).
3. Upper floors and terrace parapets (f_035-f_063).
4. Mansard roof (f_064-f_070); pedimented dormers (f_071-f_079).
5. Gardens (f_080-f_126); interiors (f_127-f_134).

---
## Unresolved
- Arch spans and rises (all). Only the chamfer step count (FM: 2) and the AR rib apex width (2) are readable.
- Exact block ID of the dark brick (AR/GV), the white infill (AR/GV), the cream FM block, and the AR apex pin.
- Whether the AR slit windows contain ladders or trapdoors.
- Wall heights and post counts in NS (perspective).
- FM merlon:gap ratio beyond `~2:1` from one view.
- NS foundation course: barrels or banded logs (banding visible; block not provable).
- AR pyramid spire course count (estimates inconsistent across blurred frames).
