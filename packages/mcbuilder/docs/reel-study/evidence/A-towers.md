# Reader A: towers, arches, roofs, pillar frames

Reels read: alixxa-tower (17 frames), trixyblox-ruined-temple (47), gothic-castle (15), heavy-tower (19),
niitty-wizard-tower (26), tall-mansion (12), japanese-house (68), pillar-wall-design (4 images).
No section 5 (these reels have stage-1 notes elsewhere).

Reading depth, so the confidence tags below can be trusted:
- Deep (full-res crops, many zooms): alixxa-tower, trixyblox-ruined-temple, pillar-wall-design, heavy-tower (f_004/005/007/010/013), niitty (f_010/019/021).
- Sheet-level only (contact sheet, no full-res crop): gothic-castle, tall-mansion, japanese-house, trixyblox f_023-f_047. Claims from these are marked "sheet-level" and are low confidence.
- Colour is shifted by shaders in alixxa (pink-lilac haze), trixyblox (grey) and niitty (dusk), so block IDs are by texture and shape, with `?`.
- Pixel-to-block calibration (used for every INFERRED size below): in alixxa/f_008 the arrow label reads "15" beside the first shaft and the three slits on the 7-wide face sit at a pitch of exactly 2 blocks (slit, pier, slit, pier, slit). That gives ~19 px per block on the right-hand face and ~14 px on the left-hand face, ~19 px vertically, at native 1080x1920, camera zoom unchanged through the reel. Every alixxa width/height below is derived from that and is good to about +/-1 block, not exact.

---

## 1. Hypothesis shapes

### 1.1 Arch (incl. pointed): PRESENT, six distinct profiles

Verdict PRESENT. Strongest frames: trixyblox/f_001, trixyblox/f_007, trixyblox/f_021, trixyblox/f_019 (lancet), heavy-tower/f_013 + f_005, niitty/f_021, pillar-wall-design/115564_3_ck17.

Profiles seen (each is built from stairs and slabs; none is a smooth curve):

**A. Stepped segmental head, 4-wide, 1 block rise (trixyblox f_001, f_002; same head reused on windows f_008-f_010).**
OBSERVED in trixyblox/f_001 (crop at 2x): two 1-block jambs, then per side one stair piece, then a 2-wide bar on top.
- Clear opening between jambs: 4 blocks. Total width incl. jambs: 6.
- Per side, at spring line (top of jamb): a stair that reads as a "Γ" in elevation: full height on the jamb side, only the upper half on the opening side. That is `stairs[half=top]` with facing toward the opening: left side `facing=east`, right side `facing=west`. (INFERRED from the Γ silhouette: top half full width, bottom half only the jamb-side half.)
- Crown: 2 blocks wide, half a block thick, sitting one cell above the stairs, in the lower half of that cell: `slab[type=bottom]` x2. Its top edge is 1.5 blocks above the jamb top.
- Underside steps in half-block units: row, row+0.5, row+1.0, i.e. a 3-step chamfer, flat 2-wide soffit.
- Profile name: segmental / depressed, NOT pointed. Rise 1 block over a span of 4 (rise:span 1:4).
- Same head in f_002 on a smaller inner portal between two tall stone-brick piers (piers 2 wide, jambs of smooth block 1 wide in front of them).
- Block: smooth pale stone for the arch (`calcite ?`, `quartz_block ?`, `diorite ?`, `smooth_stone ?`; it is beige-white with fine grain), piers `stone_bricks` (light) in f_002.

**B. Lancet / pointed window head, 4 wide (trixyblox f_019 end window, f_020, f_021, f_018).**
OBSERVED in a 3x crop of trixyblox/f_019: glass 4 blocks wide; the outline of the glass in half-block rows from the shoulder upward is 4, 3, 2, 1 blocks wide, each row half a block tall. Each row narrows by half a block per side.
- Rise from shoulder to apex: 3 half-rows = 1.5 blocks; half-span 2 blocks. Apex is 1 block wide, flat.
- Slope 1:1 (45 degree stair steps). This is the only truly pointed (two-sided, apex) profile in trixyblox.
- INFERRED construction: half-block steps mean stairs/slabs frame the opening and the (full-block) glass shows behind them. Glass reads as `white_stained_glass ?` / `glass ?` panes with a lead-line grid (grid lines at block centres).

**C. Nave rib vault, large pointed/four-centred arch, white stair ribs (trixyblox f_004-f_007, f_021, f_022, f_023).**
OBSERVED in f_007 and f_021: the interior arch is formed by pale stairs and slabs rising from the pier capital.
- Lower part: stair diagonal at about 1:1 (each rib step is one stair going up and in).
- Upper part: flatter; stair/slab pairs (about 1:2) leading to a 2-4 wide slab/stair crown at the apex.
- A single longitudinal ridge rib runs along the apex (a vertical white column of blocks in elevation, f_021/f_022), crossed by transverse rib arches. So: pointed-to-flat "ribbed" arch, not an equilateral pointed one.
- Piers: clusters of 5 slim pale shafts per side (f_005: 5 columns receding in depth, i.e. about 5 ribs visible), capitals with a carved band (`chiseled_*` / stairs + slabs), brick buttress block 2-3 wide outside (dark `stone_bricks ?` / `deepslate_bricks ?` in f_003-f_007).
- Roof above the vault: dark slate stair roof, 45 degree (1 block up per block in), apex a single block (f_004). Dark-oak purlins between rib and slate (f_021/f_022).
- Span and rise: UNRESOLVED (perspective, no scale in frame).

**D. Corbelled stepped portal head (trixyblox f_018, f_019, f_020).**
OBSERVED: west portal is stone-brick (`stone_bricks ?`) jambs 2 wide, then 2 steps of upside-down stairs per side stepping inward, then a keystone bar 3 bricks wide by 2 rows tall on top, inside a flat entablature (modillion cornice). Reads as a corbel arch (stepped, flat-topped), not pointed. Width ~7 clear is INFERRED only from brick count and is low confidence.

**E. Machicolation arcade of small pointed openings (heavy-tower f_004, f_005, f_006, f_013).**
OBSERVED in f_004/f_005 crops: the top of the square shaft overhangs by about 1-2 blocks on corbel steps; on each face 4 dark openings separated by 5 one-block piers, each opening pointed (stair step per side so the head narrows to a point). The piers carry stair corbels, so the whole arcade is a frieze of pointed arches over a corbel course. Overhang depth, opening width (looks 2 at base, 1 at apex) and height (looks 4-5): sizes UNRESOLVED.

**F. Pointed window/opening in a tower (niitty f_019, f_020, f_021).**
OBSERVED: tall narrow openings with a small stepped pointed head, one opening per tower face under the crown; widths 1-2, height 4+. Stair-stepped, single step per side. Detailed profile UNRESOLVED (small in frame).

**G. Pointed-oval ("vesica") bay (pillar-wall-design 115564_3_ck17).**
OBSERVED: each bay opening is a tall pointed oval: about 3 blocks wide at mid-height, narrowing to about 2 near top and bottom through three stair-step flares on each pillar flank (see section 3.1). Sculk fills it. Same silhouette exists in the other 3 images but is hidden by the backdrop.

Label for arch: NEW SHAPE (parameterised arch: span, rise, profile = segmental | lancet | rib, thickness, stair/slab block per role). Existing shapes cannot make it: `stairs` only climbs in one direction, `roofGable` is a straight gable, `sphere`/`cylinder` give no stepped half-block profile. A pointed head can be a PARAM of the same shape (`profile: "lancet"`).

Implementable spec for the lancet (B), from the frames:
```
span S (clear, here 4); rows k = 0..(S/2 - 1)+... half-block rows
row k (counting up from shoulder) clear width = S - k, k = 0..S-1   (4,3,2,1)
each row = 0.5 block tall; left edge = stair half=top? facing inward,
           right edge mirror; apex row = single block (slab or stair)
```
Row-by-row ownership (INFERRED): the left/right cells of each row are `stairs[half=bottom|top]` alternating so successive rows move in by 0.5 and up by 0.5. Exact half/facing sequence: UNRESOLVED (only the glass outline is clean, the stairs are hidden behind it).

### 1.2 Dome: ABSENT

No hemispherical or domed roof in any of my reels. Nearest things, none a dome:
- trixyblox/f_011-f_013: apse is a polygonal (about 7-sided) drum with a stepped conical stair roof (1 block step per ring). Not a dome.
- heavy-tower/f_008-f_012: concave stone cone spires (cone, not dome).
- alixxa/f_017: stepped pyramid crown (section 2.2).
- gothic-castle (sheet-level): spired pyramids.
Existing `sphere({dome:true})` was not needed by anything here.

### 1.3 Spiral stairs: ABSENT (not shown)

No interior stairwell shown in any of my reels (only trixyblox nave interior f_019-f_026 and japanese-house interiors f_028-f_045 from above). Only straight/arched stair elements: niitty arched stair bridges (f_011-f_021), straight entrance stairs (alixxa f_005, f_010; japanese f_027-f_035). Absence is "not filmed", not proof the builds have none.

### 1.4 Crenellation / battlements: PRESENT

Verdict PRESENT. Strongest frames: heavy-tower/f_005, heavy-tower/f_007, heavy-tower/f_013, trixyblox/f_017, alixxa/f_016 (weak).

- heavy-tower/f_005, f_006: parapet on the corbelled arcade (E above). OBSERVED: a row of merlons, 3-4 bricks wide each, separated by 1-brick crenels, one block above the arcade, with a taller stepped corner block at the front corner (f_005: the corner merlon rises about 2 blocks above the rest). Merlon height over crenel floor about 1 block. Exact merlon:crenel count per face UNRESOLVED.
- heavy-tower/f_007: a second, smaller crenellated ring on the round upper tower (merlons alternate with 1-block crenels on all sides), over a corbel course of stair/slab dentils (a small-scale "teeth" frieze).
- trixyblox/f_017: small crenellated parapet on the west stage, merlons of uneven height (ruin weathering), above an open colonnade of 4 thin wall-posts with stair brackets. OBSERVED merlon tops at three different heights.
- alixxa/f_016: the flared head of the second stage has an alternating tall/short top edge (a merlon pattern, about 1 block merlons) over pillars. Low confidence: seen at 2x only, partly hidden.
Pattern: `merlon, crenel, merlon, ...` with the corner always a merlon; parapet is 1 block high over a 1-block-overhanging corbel course.

Label: NEW SHAPE or PARAM. Needs a loop around a rectangle perimeter that alternates solid and gap and stops/starts at corners, which `walls` + `box` cannot do without a function material `(x,y,z) => ...`. A function material on top of `walls` (`(x+z)%2` gate) could do it, so PARAM on `walls` (`crenel: {merlon:1..3, gap:1}`) or a small NEW SHAPE `parapet`. I propose NEW SHAPE `battlement(c1,c2,block,{merlon,crenel,height,corner})` because corner handling is the usual failure.

---

## 2. Open candidates

### 2.1 Skirt roof (alixxa): PRESENT, two instances

Two skirt-type roofs, same design:
- Lower skirt: alixxa/f_015 (first visible), f_016, f_017. Sits on top of the 15-high first stage (f_008: arrow label "15"), around the base of the second stage.
- Upper hat: alixxa/f_017, on top of the flared head of the second stage, carrying the pyramid crown (section 2.2).
Frames that show it best: alixxa/f_015 (lower skirt from above, 4x crop of region x340-740 y850-990), alixxa/f_017 (hat, 4x crop of x320-760 y470-620), alixxa/f_016 (underside lanterns).

Dimensions (all INFERRED from the calibration above):
- Lower skirt width about 11 blocks. It overhangs the 7x7 first stage by about 2 blocks each side and the 5-wide second stage shaft (width ratio 0.76 of the first stage, so 5) by about 3 each side.
- Upper hat width about 12 (11.5 on the narrow face, 12.1 on the broad face; 11-13). It sits over the flared head (about 7 wide). Overhang about 2-3.
- The first stage is 7x7 (f_002 overlay shows "7" and "7" on the foundation; slit pitch confirms 7 wide). First-stage height 15 (f_008 label). Second stage label "18" (alixxa/f_014, arrow beside the new shaft; what it measures is not fully clear, likely the second stage height).

Profile, course by course (OBSERVED in the 4x crops; heights are approximate):
1. Eave/rim course: a continuous ring of full plank blocks, front face about 1 block high, flush at the corners. Top face visible as a wide light band (f_017 crop).
2. Dentil row directly under the rim: every second block of the ring is missing. Pitch 2 blocks, so the face reads "block, hole, block, hole" with dark recess squares. OBSERVED in f_017 (5 dark squares on the broad face, 11 wide ring, blocks at the corner positions) and in f_015 underside. The row is 1 block high.
3. Upper surface: from the rim a low stepped hip rises toward the shaft in about 2 terraces. Pieces on the terraces show about 2 plank-board lines on their front faces (half-block high) and sit in a staggered, diagonal checker. OBSERVED. Reading: `slab[type=bottom]` or `stairs[half=bottom]` pieces. Which of the two, and their `facing`, UNRESOLVED (they are viewed from one side only and at 14-19 px per block).
4. Total thickness at the shaft about 2-3 blocks; the roof is much shallower than a normal hip (rise about 2 blocks over a run of 3), so it reads as a flat skirt/brim.
Course count: UNRESOLVED. A reading of "about 3 courses (rim, dentil, 1-2 terrace rows)" is INFERRED from relative heights; do not rely on it.

Corner treatment: OBSERVED square, no diagonal hip rib, no corner post or extra trim; the rim ring just turns the corner. The terrace pieces are staggered, so each corner shows a stepped diagonal.
Eave trim: the dentil row (item 2). No separate eave stairs/slabs seen, no verge/trim course.
What it rests on: OBSERVED in f_015 below the rim: stone (stone-brick) wall top of the first stage with piers, plus oak trapdoor corbel brackets and `lantern[hanging=true]` hanging from the brim at the four corners and over window openings (alixxa/f_016 shows lanterns under the brim at corners and mid-face). The balcony railing ring seen in f_011/f_013 on top of the first stage is gone in f_015 (replaced by the skirt).
Colour/blocks: golden-brown planks `oak_planks ?` / `oak_slab` / `oak_stairs` (could be `birch ?`/`acacia ?` under the shader; the ground plank floor in f_002 is the same colour).
Label: NEW SHAPE (`skirtRoof(c1,c2,{overhang,rim,dentil,terraces})`). Cannot be made by `roofHip` (it steps inward one row per block from the full footprint, with no flat brim and no dentil row). Partial PARAM route: `roofHip({flat: true, dentil: true})`, but the rim and the dentil row are different concepts than a hip, so NEW SHAPE is cleaner. Confidence: medium for the overall form, low for stair/slab specifics and for the course count.

### 2.2 Pyramid crown (alixxa): visible features and unresolved list

Frames: alixxa/f_017 (only frame with the crown; 4x crops of x320-760 y470-620, 8x of x420-620 y300-440, and the spire at 8x nearest-neighbour). It is not in f_016 or earlier.
OBSERVED:
- Sits on the upper hat (section 2.1). Total stack above the hat's rim: a stepped pyramid, then a thin post.
- Four stepped tiers are visible above the rim top, plus the post. Each tier insets from the one below; silhouette widths (INFERRED, from projected width / 33.6 px per block-diagonal) are about 4.5, 3.5, 2.3 and 1.1 blocks from lowest to top tier. Non-integer values and a pitch of about 1 block per tier suggest half-block insets via stairs, or a width read taken on a diagonal; this is UNRESOLVED.
- Tiers are about 2.5-3 blocks tall each (INFERRED from 52-57 px at 4x vs 19 px/block native vertical). Top tier is a 1x1 column about 3 blocks tall.
- Lower tiers carry a checker of recesses: dark squares (open cells) alternate with plank blocks, staggered between courses (4x crop). Reads as full blocks alternating with missing cells or with half-blocks.
- Apex: a thin 1x1 post about 4-5 blocks tall, 0.26 of the width of the 1x1 column below it. That ratio matches a fence post (4/16 block wide), so `oak_fence ?` stack; a wall or `lightning_rod` is not plank-coloured, so ruled out. Post length about 4-5 blocks (INFERRED from 89 px native vs 19 px/block).
- Rough total: pyramid about 12-13 blocks tall plus about 4-5 of post (INFERRED, +/- 2).
UNRESOLVED (do not guess):
- exact course count of the pyramid, per-tier height in courses, tier inset sequence;
- whether each tier is full blocks, stairs, or slabs, and the `facing`/`half` of any stairs;
- whether the recessed cells are missing blocks or half-blocks;
- the 3D plan of the pyramid (square? offset?), because the only frame is one oblique view;
- exact apex block and post length.
Label: BLOCKED for exact geometry. Closest existing: `roofHip` gives a pyramid at 1 block up per 1 block in; this crown is steeper (about 2.5-3 blocks up per 1 block in) and has a checker texture, so a PARAM (`rise` = courses per ring, `checker: true`) on `roofHip` plus a `spire` cap (fence post stack) is the proposal, but it is not something the frames can confirm.

### 2.3 Pointed arch (trixyblox): see 1.1

PRESENT. Three trixyblox profiles are pointed or stepped: lancet end window (B), nave rib vault (C), segmental window/portal head (A). The only strictly pointed two-sided profile is the lancet (4,3,2,1 half-rows, 1:1). Parent label: NEW SHAPE arch.

### 2.4 Triplet slit window + flower box ("sub T7"): PRESENT in alixxa; paired variant in heavy-tower

- alixxa/f_008 (5x crop of x400-700 y960-1160) and f_010 (5x crop of x400-700 y1050-1310). OBSERVED: on the 7-wide first-stage face, three 1-wide slit openings at columns 1, 3 and 5 (0-indexed), with 1-wide stone piers between (cols 0, 2, 4, 6): rhythm `P S P S P S P`. Slit height about 3-4 blocks.
- Each slit has a stone-brick wall post (`stone_brick_wall`) down its centre as a mullion (f_010). Above each slit an open oak trapdoor awning (a flat top piece plus a front face piece, about 1 block out). Below, a row of trapdoor-fronted boxes projecting about 1 block, topped with flowers and vines (cyan/blue flowers, green leaves, hanging vine) spanning the whole 3-slit width (about 5-6 blocks).
- The same arrangement repeats on the second stage above, and on a lower pair of slits (f_010 left, lower window: two slits with awnings, no box).
- heavy-tower/f_013: windows come in pairs (two 1-wide slits side by side, with 2 rows at two heights), no awning or box. Looks like a 2-slit variant.
Label: COMPOSITION (a fixed window module: slit x3, mullion walls, trapdoor awning, flower-box row), could be a helper `windowTriplet(wall, ...)` later. Individual blocks are in the repurpose table.

### 2.5 Ruined mound ("sub T5")

- trixyblox/f_035, f_036 (sheet-level): the church stands on a stepped mound shown with coloured overlay terraces (blue, then red), at least 4 terraces visible in f_036; f_037: the final mound is grass terraces with orange dirt path edges, about 4 tiers, hill slopes covered in grass. OBSERVED at sheet level.
- trixyblox/f_031-f_034 (sheet-level): the ruin itself is shown with orange-brown brick patches replacing grey walls, ivy/moss streaks, missing roof sections.
- alixxa/f_001-f_005 (5x crop of f_005 x190-890 y1000-1500): not ruined, but a terraced mound foundation: concentric terraces about 3 tiers wide, patched with grass, rust-brown dirt (`coarse_dirt ?`/`podzol ?`) and grey cobble flecks, tiles of stone-brick path leading to the 7x7 plank-floor platform; stone-brick stairs and low walls at the corner, lanterns on wall posts. Useful as a "mound foundation" comparison, not as a ruin.
Label: COMPOSITION (terrain noise via `patches()` plus terraced boxes). No new geometry shape needed. Confidence: medium-low (sheet-level for trixyblox).

---

## 3. Other geometry the 12 shapes can't make

Format: name | description | how built | label | frames | confidence.

### 3.1 Pillar + wall frame module (Luki's 4 images)

All 4 images use the same geometry, only the palette changes. Source files: `pillar-wall-design/115561_0_vzlr.jpg` (teal copper), `115562_1_l24q.jpg` (bamboo/moss), `115563_2_iazw.jpg` (warm wood / grey brick), `115564_3_ck17.jpg` (pale oak / sculk). Images are 1206 x about 1100.

Overall size (INFERRED): the chiseled copper block in 115561 is about 107 px wide, so the frame is about 11 blocks wide and about 10 blocks tall (+/-1).
Layout (OBSERVED): 3 pillars (left, centre, right) and 2 bays, symmetrical left-right. Bay clear width about 3 blocks at mid-height (310 px), narrowing to about 2 near the top and bottom. The shaft is 1 block wide; the plinth and capital are wider (wings 1 block out each side). End pillars are identical to the centre one; outer wings are 1 block.
Pillar vertical stack, bottom to top (OBSERVED in 2x crops of 115564 and 115561, mirrored top to bottom; heights approximate):
1. Plinth, 1 block wide: 2 stacked slabs/steps (about 1 block total).
2. Plinth wings, 3 blocks wide (pillar + 1 each side): 2 slab layers (about 1 block).
3. Flank stair buttress on each side, 3 steps rising toward the shaft (stairs facing the shaft). This is what narrows the bay at the bottom to about 2 blocks.
4. "3-slot panel" block (a framed block with 3 vertical slots), about 1 block.
5. Ornament block, framed (chiseled copper in 115561; 2x2 window pattern in 115562/115563; 3-slot with a small brown nub in 115564), about 1 block; flank tabs on each side.
6. Moulding band: 2 stacked thin pieces (slabs/stairs) with side tabs sticking out on each side (open trapdoors ?), about 0.7 block.
7. Plain shaft: smooth stripped log/block, about 2.5-3 blocks.
8. Mirror image upward: moulding band, ornament block, 3-slot panel, flank stairs stepping outward at the top, wings, cap slabs.
Top lintel: a continuous 1-block band across all bays at the capital level, notched above each bay (the stair steps continue as a notch).
Bay footstone: a small floor plate at the base of each bay between the flank stairs (closed trapdoor / grate flat on the floor). Bay keystone: a chiseled block at top-centre and bottom-centre of each bay (115561: piglin-face chiseled blackstone; 115562: chiseled stone bricks ?).
Label: NEW SHAPE (`pillarFrame(origin, {bays, bayWidth, height, roles})`) or COMPOSITION with a role table; the geometry is the same for all 4 palettes, so a palette-by-role parameter is the natural interface. Confidence: layout high, block IDs and exact heights medium-low.

Palette per role, per design:

| role | 115561 teal | 115562 bamboo | 115563 warm wood | 115564 pale |
|---|---|---|---|---|
| shaft | `oxidized_copper` (waxed) | `stripped_bamboo_block` ? | stripped log ? (`oak`/`acacia`/`jungle` ambiguous, warm gold-brown) | `stripped_pale_oak_log` ? |
| moulding bands, plinth, capital | `oxidized_cut_copper` + `_stairs` + `_slab` | `bamboo_planks` / `bamboo_stairs` / `bamboo_slab` | `<wood>_planks` / stairs / slabs (darker brown) | `pale_oak_planks` / stairs / slabs |
| ornament block | `oxidized_chiseled_copper` | `bamboo_trapdoor[open=true]` ? (2x2 windows) | `<wood>_trapdoor[open=true]` ? (2x2 windows, orange) | `pale_oak_*` ? (3-slot + nub) |
| 3-slot panel | `oxidized_copper_trapdoor` ? | `bamboo_*` ? | `<wood>_*` ? with 3 stud dots | `pale_oak_*` ? with latch nub |
| bay floor plate | `oxidized_copper_grate` (holes) | `bamboo_trapdoor[half=bottom]` ? | striped plank piece ? (`<wood>_trapdoor` or slab) | pale trapdoor ? |
| backdrop wall | `polished_blackstone_bricks` + `cracked_polished_blackstone_bricks` | `mossy_cobblestone` / `stone_bricks` / `mossy_stone_bricks` with `moss_block` lower half | `stone_bricks` + `cracked_stone_bricks` + `andesite ?`/`tuff_bricks ?` mix | `sculk` |
| bay keystone | `chiseled_polished_blackstone` | `chiseled_stone_bricks` ? | small orange trapdoor piece ? | pale block ? |
| accent / ground | none | `moss_block` (green), vines on the stone | none | grey-white capital accent band (stone-brick slab ?) |

Hue notes: 115561 is clearly the `copper` family (waxed oxidised), 115562 clearly `bamboo` and `moss`, 115564 clearly `pale_oak` (1.21.4) with `sculk`; 115563 is a warm brown wood I cannot pin to one species. "3-slot panel" and "2x2 window" blocks are best matched by wooden/copper trapdoors, but several could also be `*_fence_gate`/`chiseled_*`, so every ID in those two rows is `?`.

### 3.2 Rib vault nave (trixyblox)

White stair-and-slab rib arches with a longitudinal ridge rib, clustered pier shafts (5 per side), slate gable roof above. Built per bay as arch (1.1 profile C) plus roof. NEW SHAPE (arch family, see 1.1) plus `roofGable` for the slate. Frames: trixyblox f_004-f_007, f_021-f_023. Confidence medium for form, low for dimensions.

### 3.3 Polygonal apse with stepped conical roof (trixyblox)

OBSERVED in trixyblox/f_011-f_013 (and 1100x993 crop of f_013): about 7-sided apse; facets divided by pilasters (1 brick wide) with tall lancet windows in the facets; roof is a stepped pyramid/cone of dark stairs, 1 block step per ring, the top ring a flat 3-4 block platform; pinnacle spikes on the pilaster tops (stacked wall + stair + slab). Facet count and radius UNRESOLVED. Label: NEW SHAPE (`prism(n-sided)` + polygonal hip roof). `cone`/`roofHip` give only round or 4-sided. Confidence: medium.

### 3.4 Concave stone cone spire with turrets (heavy-tower)

OBSERVED in heavy-tower/f_008-f_012: the upper tower is round, ribbed with vertical pilasters; a conical spire of grey stone and dark slate in a concave profile (steeper at the top), with small matching spirelets on the shoulder (f_011-f_012, f_016-f_019). Each ring steps in by 1 block, vertical run per ring shortens toward the top. Label: PARAM on `cone` (`profile: "concave"`), medium confidence; the two-tone (slate/stone) split is a material function of height and angle (COMPOSITION).

### 3.5 Machicolated corbel frieze (heavy-tower)

See 1.1 profile E and 1.4. Label: NEW SHAPE (corbelled crown ring: corbel course, pointed openings, parapet) or two PARAMs (`arch`, `battlement`). Frames heavy-tower/f_004, f_005, f_006, f_013. Confidence: medium.

### 3.6 Crown with horned corner pinnacles (niitty)

OBSERVED in niitty/f_019 and f_021 (900x1100 crops): square top; each corner is a pillar that curves outward then up (concave horn), tipping in a pinnacle 1 block wide topped by an `iron_chain` finial; each face rises to a central pointed gable between two corner horns. The whole crown reads as a pointed "crown". Wall material `tuff_bricks ?` (alt `deepslate_bricks`, `mossy_stone_bricks`). Label: NEW SHAPE (`crownTop`); hard to express as parameters of an existing shape. Confidence: medium for form, low for exact stair/slab steps.

### 3.7 Inverted corbel "stalactite" base (niitty)

OBSERVED in niitty/f_001-f_008: the floating tower has an inverted stepped taper at the bottom, corbelled inward in steps, ending in downward fangs at the corners; the lowest parts are chains. Label: PARAM (`cone({invert: true})`) or NEW SHAPE; the corner fangs are separate pillars. Confidence: medium-low.

### 3.8 Stacked glass discs ("energy beam") (niitty)

OBSERVED in niitty/f_006-f_008: a column of translucent purple discs shrinking downward from the tower underside, spaced about 1-2 blocks apart, with an amethyst-like cluster at the top. Label: SHAPE (stack of `cylinder` discs with decreasing radius; `cylinder` height 1) plus COMPOSITION. Confidence: medium.

### 3.9 Arched stair bridge (niitty)

OBSERVED in niitty/f_009, f_011-f_017, f_021: a bridge between towers as a shallow arch of stairs/slabs with hanging chains and small stairs at each end. Label: NEW SHAPE (arc/parabola `bridge`), or PARAM on `stairsRun` (`curve`). Rise/span UNRESOLVED. Confidence: medium.

### 3.10 Stepped gable (tall-mansion, sheet-level)

tall-mansion/f_010, f_011: a stone-brick gable wall edge stepped 1 block per course on a diagonal (corbie-stepped, built from full blocks). Label: SHAPE (`roofGable` with a `step: true` verge) or PARAM; sheet-level, low confidence.

### 3.11 Rose window / circular tracery (gothic-castle, sheet-level)

gothic-castle/f_011, f_012, f_013: a ring-shaped round window with radial tracery on the bell tower; the ring is a flat circle outline with spokes. Label: SHAPE (`cylinder` with axis and hollow, height 1, plus spokes as `line`) but needs checking. BLOCKED at sheet level: no full-res crop was read.

### 3.12 Courtyard stake-out lines (japanese-house)

japanese-house/f_009-f_024: before construction the footprint is marked on the grass with 1-block lines of white blocks, in nested loops (outer 53 x 47, inner 40, gate bumps), plus numbers 33, 53, 40, 47 overlaid on f_004-f_008. Which number maps to which edge is UNRESOLVED. Label: COMPOSITION (outline-first workflow; `Build.floor` outline helper would do it). Confidence: medium. Not geometry of the final build.

---

## 4. Repurpose table (blocks used against their original function)

| block + state | used as | how placed | context | frames | label |
|---|---|---|---|---|---|
| `oak_trapdoor[open=true]` ? (wood species uncertain) | window awning / canopy over a slit | 1 block out above each slit, flat top piece plus front face piece, facing outward | alixxa first and second stage windows | alixxa/f_010, f_016, f_017 | COMPOSITION |
| trapdoor row (`oak_trapdoor[open=true]` ?) | flower-box front | row 1 block out below the slits, one per slit and between them, planted on top | alixxa window boxes | alixxa/f_010 | COMPOSITION (sub T7) |
| flowers (cornflower/blue orchid ?) + `vine`/leaf cover | planter contents | on top of the trapdoor boxes | same | alixxa/f_010 | COMPOSITION |
| `stone_brick_wall` | window mullion | single post centred in each 1-wide slit | alixxa windows | alixxa/f_010 | COMPOSITION |
| `stone_brick_wall` + `lantern` | corner lamp post | wall post at the platform/stair corners with a lantern on top | alixxa foundation | alixxa/f_005, f_010 | COMPOSITION |
| `lantern[hanging=true]` | eave light under the brim | hanging at the corners and over openings under a trapdoor corbel | alixxa skirt roof | alixxa/f_016, f_017 | COMPOSITION |
| plank blocks with every second one missing | dentil / corbel row under the brim | one course, pitch 2 | alixxa skirt roof and hat | alixxa/f_015, f_017 | PARAM (dentil on skirt roof) |
| `oak_fence` ? stacked | spire / finial | 1x1 post on a 1x1 column, about 4-5 blocks | alixxa crown | alixxa/f_017 | PARAM (cap on roof) |
| fence rail (`oak_fence` ? / `birch_fence` ?) | balcony balustrade on the first-stage top | ring around the second-stage base | alixxa f_011-f_013 | alixxa/f_011, f_013 | COMPOSITION |
| trapdoor row ? | door pediment/canopy | flat piece just above the door lintel | alixxa door | alixxa/f_010 | COMPOSITION |
| `stairs[half=top]` (stone/pale) | arch haunch/corbel | facing the opening, one per side at the spring line | trixyblox arch heads | trixyblox/f_001, f_002, f_008-f_010 | NEW SHAPE (arch) |
| `slab[type=bottom]` x2 | arch crown | one cell above the haunch stairs, bottom half | same | trixyblox/f_001 | NEW SHAPE (arch) |
| stairs + slabs, white | vault ribs | rising diagonal inside the nave | trixyblox nave | trixyblox/f_004, f_007, f_021, f_022 | NEW SHAPE |
| upside-down stairs alternating with small wall posts, dark recess strip between | modillion / corbel-table cornice | one band under the eave, 3 rows | trixyblox west gable and nave | trixyblox/f_018, f_019 | COMPOSITION |
| `oak_trapdoor` (orange-brown) | rake dentils along a gable | one on each stair step of a stepped gable edge | trixyblox gables | trixyblox/f_018 (top), f_019 | COMPOSITION |
| wall posts with stair/slab caps stacked | pinnacle / finial on buttress heads | 2-3 blocks tall at the top of piers | trixyblox exterior | trixyblox/f_008, f_009, f_013 | COMPOSITION |
| `stone_brick_wall` posts in a row | belfry louvre colonnade | thin posts under a crenellated parapet | trixyblox bell tower | trixyblox/f_011-f_014, f_017 | COMPOSITION |
| white `glass`/`white_stained_glass` (+ panes) | tall lancet windows | full-height inside stair-framed openings | trixyblox nave | trixyblox/f_008-f_010, f_019 | COMPOSITION |
| dark-oak trapdoors/doors ? | wall panels / pews / benches | boxed panels against the wall, rows facing the altar | trixyblox interior | trixyblox/f_022, f_023 | COMPOSITION, low (IDs unresolved) |
| `iron_chain` + wood frame + `candle`/torch ? | chandelier | hung from the vault | trixyblox nave | trixyblox/f_022, f_023 | COMPOSITION, low |
| `vine`, `moss_block`, brick patches | ruin weathering | across walls and roof | trixyblox ruin | trixyblox/f_031-f_036 | COMPOSITION |
| stairs as corbels around a square shaft | machicolation overhang | 1-2 steps outward below the parapet | heavy-tower crown | heavy-tower/f_004, f_005 | NEW SHAPE |
| slab ledge on top of a shaft | flat roof cap | 1 block overhang | heavy-tower first stage | heavy-tower/f_004 | COMPOSITION |
| speckled patches of different stone in the wall | weathered wall texture | noise over the shaft | heavy-tower shaft | heavy-tower/f_004, f_005, f_013 | COMPOSITION (`patches()`) |
| `iron_chain[axis=y]` | pinnacle finial, hanging chains under bridge | single chain on 1x1 tip, chains hanging below | niitty crown and bridges | niitty/f_011-f_021 | COMPOSITION |
| purple `stained_glass` discs | energy beam | stacked discs shrinking downward | niitty | niitty/f_006-f_008 | SHAPE (`cylinder` stack) |
| `chiseled_tuff` ? / `chiseled_tuff_bricks` ? | frieze band, Greek-key | one course, repeated key motif | niitty wall closeup | niitty/f_010 | COMPOSITION |
| `tuff` ? | plain contrasting block in the wall | irregular patches | niitty wall closeup | niitty/f_010 | COMPOSITION |
| timber posts + diagonal braces (red-brown wood) | half-timber facade | vertical posts, diagonals | tall-mansion tower | tall-mansion/f_006-f_012 (sheet-level) | COMPOSITION, low |
| stone blocks stepped on a diagonal | stepped gable edge | 1 block per course | tall-mansion | tall-mansion/f_010, f_011 (sheet-level) | SHAPE/PARAM, low |
| white lines of blocks on grass | footprint stake-out | nested outline loops | japanese-house plan | japanese-house/f_009-f_024 | COMPOSITION |
| white wall with dark tile cap and a red stripe | courtyard enclosure | long run, tile cap overhanging | japanese-house | japanese-house/f_015, f_016, f_063 (sheet-level) | COMPOSITION |
| red/orange small blocks on a white railing | terrace lanterns | at intervals on the rail | japanese-house terrace | japanese-house/f_027-f_035 (sheet-level, ID unknown) | COMPOSITION, low |
| closed trapdoor / grate lying flat | bay floor plate | `half=bottom`, `open=false`, at the base of each bay | pillar designs | pillar-wall-design all 4 | COMPOSITION |
| open trapdoor flush on the pillar face | ornament/ribbed panels and side tabs | `open=true` against the shaft | pillar designs | pillar-wall-design all 4 | COMPOSITION, IDs `?` |
| stairs stacked as flank buttress | pillar flare that narrows the bay | 3 steps each side at base and capital | pillar designs | pillar-wall-design all 4 | NEW SHAPE (pillarFrame) |
| `sculk` / `moss_block` / `polished_blackstone_bricks` | backdrop wall fill | full wall behind the pillars | pillar designs | pillar-wall-design 115561, 115562, 115564 | COMPOSITION |
| `chiseled_polished_blackstone` | bay keystone and footstone | top-centre and bottom-centre of each bay | pillar design 115561 | pillar-wall-design 115561 | COMPOSITION |

---

## Unresolved list (for the coordinator)

1. alixxa skirt roof: course count; stair vs slab; facing/half of the terrace pieces; whether the dentil row is blocks, stairs or trapdoors.
2. alixxa pyramid crown: course count per tier; stair/block per tier; insets (1 or 0.5 per ring); the 3D plan; exact post length.
3. trixyblox nave arch: span and rise in blocks; bay spacing; the block IDs of the ribs (white stairs vs `quartz`/`calcite`).
4. trixyblox lancet window: the stair `half`/`facing` ownership per row (only the glass outline is clean).
5. heavy-tower machicolation: opening width/height, overhang depth, merlon:crenel counts.
6. niitty crown: stair/slab step sequence of the horns; the glowing orb on the tower (f_023-f_025) is unidentified.
7. pillar frames: exact block heights; IDs of the "3-slot" and "2x2 window" blocks; species of the 115563 wood; whether the pillar shaft is 1 deep or more (front view only).
8. gothic-castle, tall-mansion, japanese-house: read at contact-sheet level only; all claims about them are low confidence.
9. japanese-house plan numbers 33/53/40/47: edge mapping unknown.
