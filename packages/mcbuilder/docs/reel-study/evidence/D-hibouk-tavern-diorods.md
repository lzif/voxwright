# Reader D: hibouk-winter-mansion, omggamer-medieval-tavern, dio-rods-waterfall-quarry

Evidence notes only. No code, no repo touched. Text in images was read as data.

## 0. Conventions and coverage

Frame aliases (the brief asks for `reel/f_NNN`; these are shortened):
- `hib/f_NNN` = hibouk-winter-mansion (114 frames, 7 sheets, all viewed).
- `tav/f_NNN` = omggamer-medieval-tavern (21 frames, 2 sheets, all viewed).
- `dio/qNN` = dio-rods-waterfall-quarry photo `dio-rods-quarry-NN.jpg` (7 photos, 1 sheet, all viewed).
  The photos have no `f_` numbers. q05 = interiors, q07 = overview plus call to action.

Opened at full res: hib f_003, 005, 008, 011, 018, 026, 034, 042, 048, 064, 065, 080, 081, 084, 086, 090,
092, 099, 100, 107, 109, 110. tav f_004, 013, 019, 020. dio q01–q07 (originals; q01, q03, q04 also cropped
and upscaled with ffmpeg into scratch; no file left in the evidence folder).
Opened at half-res keyframe: tav f_001, 002, 003, 005, 007, 009, 018. Anything cited from other frames
(for example hib/f_096, f_105, tav/f_015) was read on the contact sheets only.

Tags: OBSERVED = visible. INFERRED = reasoned from stated evidence. Block IDs follow shape and texture
(shader tint shifts colours). `?` = unsure.

Calibrations used (so counts below are traceable):
- hib/f_003: the on-screen dimension labels "3, 8, 5, 8, 8" sit beside wall segments. The `8` on the
  left wall of the top wing spans ~265 px and the `5` neck ~160 px, so ~32.5 px per block in that
  top-down frame. All "~" footprint widths from that frame use this scale (+/-1 block).
- hib/f_008: the player avatar (~1.8 blocks) is ~190 px tall, so ~100 px per block vertically there.
- hib material list (f_109, f_110) is a partial read: rows between Spruce Stairs (138) and Red Carpet (56)
  were never on screen, and the "Download in Bio" badge hides the first list row.
- tav: no readable scale. dio: no readable scale. All dimensions in those sets are relative or "unresolved".

---

## 1. Hypothesis shapes

| shape | hib | tav | dio |
|---|---|---|---|
| arch (any profile) | ABSENT | ABSENT | AMBIGUOUS (timber portal with chamfered corners, not a curve) |
| dome | ABSENT | ABSENT | ABSENT |
| spiral stairs | ABSENT | ABSENT (no interior shown) | ABSENT |
| crenellation / battlements | ABSENT (one AMBIGUOUS look-alike) | AMBIGUOUS (timber ridge cresting, not masonry) | ABSENT |

### arch
- **hib: ABSENT.** Every opening is a rectangle: ground-floor slits and door (hib/f_008, f_011), upper
  windows (hib/f_018, f_034), balcony door (hib/f_048). Gables are stepped triangles, not curves.
  The only round-ended thing is the red carpet runner in the interior (hib/f_065, three corridor
  segments), which is floor decoration, not a structure.
- **tav: ABSENT.** Door and window openings are rectangles with timber lintels (tav/f_013, f_020). The
  stepped log brackets under the jetty (tav/f_013) are corbels, not an arch.
- **dio: AMBIGUOUS.** Two portal frames exist, neither curved.
  1. Timber bridge portal, "Bridge #3" (dio/q04 crop, dio/q01 lower centre, dio/q02 middle): two vertical
     1-block-wide wood posts, one thick lintel carrying the bridge deck, and a stepped chamfer at each
     inner top corner. OBSERVED: the inside corner is cut in ~3 small steps per side, giving a
     "squared-off segmental" outline. No keystone.
  2. Stream tunnel under the lodge (dio/q03 crop): rectangular stone-lined opening, ~2 wide and ~2 tall
     (INFERRED from the door beside it, which is a 2-high door), capped by a dark-wood lintel that is
     stepped (stairs and a block). Also not curved.
  Geometry for the portal if someone wants it (INFERRED, post width assumed 1 block): clear span
  ~5–6 blocks (gap / post-width ratio in dio/q04 crop), rise to the lintel underside unresolved
  (perspective), lintel ~2 blocks thick (log layer + plank/stair layer). Chamfer: 3 stair-type blocks per
  side, stepping inward 1 per row going up; stair `half` unresolved (upside-down stairs would give this
  look; not provable).
  Existing shape + params? `stairs()` hard-codes `half=bottom` (shapes.ts), so an inverted-stair chamfer
  cannot be made with the shape today. Label: PARAM (`half` option on `stairs`) plus COMPOSITION.

### dome
ABSENT in all three. Hibouk roofs end in gable ridges and one hipped end (hib/f_078, f_080). Tavern
roofs are gables (tav/f_004). Dio windmill (dio/q03) is a tapered tower with a hub and blades, no dome.

### spiral stairs
ABSENT in all three. hib interior stairs are straight flights: hib/f_052 and f_053 (run beside red
carpet), hib/f_065 (4-wide straight flight with landing, left middle). dio has straight runs cut into rock
(dio/q06 "Staircase #3", dio/q04 lower left). dio's crane has a stair running along the jib (dio/q06),
straight too.

### crenellation / battlements
- **hib: ABSENT.** One AMBIGUOUS look-alike: terrace edge parapets alternate low stair/slab pieces and
  full-height stone plinths that carry lanterns (hib/f_042, f_064, f_090). OBSERVED rhythm: ~2–3
  plinths per side, stepped down toward the entry stairs. It is a balustrade with lantern mounts, not a
  wall-walk, so it should not be taught as battlements.
- **tav: AMBIGUOUS, timber only.** The main ridge and the cross-gable ridge carry "ridge cresting":
  a horizontal rail with vertical log posts spaced ~3 blocks apart (+/-1, perspective) that rise
  ~1 block above the rail (tav/f_009, f_013, f_019, f_020). Built in two steps: first a plain log ridge
  beam that overshoots both gable ends by 1 (tav/f_002, f_004), then posts added on top (tav/f_009).
  Geometry (INFERRED): rail = 1 block of log/plank along the ridge, post = 1 log block every 3rd cell, ends
  capped with a post. Alternating high/low rhythm is the same as a merlon pattern, so it is the
  closest thing to crenellation in these reels. Label: PARAM on `roofGable` (ridge cap) or COMPOSITION
  (`line` + `pillar` loop).
- **dio: ABSENT.**

---

## 2. Open candidates

| candidate | hib | tav | dio |
|---|---|---|---|
| skirt roof (alixxa) | ABSENT | ABSENT | ABSENT |
| pyramid crown (alixxa) | ABSENT (north end is a hip, see note) | ABSENT | ABSENT |
| pointed arch (trixyblox) | ABSENT | ABSENT | ABSENT |
| triplet slit + flower box (sub T7) | PARTIAL | PARTIAL | ABSENT |
| ruined mound (sub T5) | ABSENT | ABSENT | ABSENT (the quarry is the inverse: an excavation) |

- **skirt roof:** no lower roof ring wraps any of the three buildings. hib porch roofs are small gables
  on free posts at the two wing terraces only (hib/f_044–f_046, f_064, f_099). tav has a front cross-gable
  and small roof hoods (tav/f_004, f_005), not a continuous apron. dio has a lower lean-to wing roof on the
  right of the lodge (dio/q03), which is an extension roof, not a skirt.
- **pyramid crown:** hib/f_078 and f_080 show the north end of the roof converging to a point with
  diagonal hip lines, i.e. a hipped end of the main ridge, about 5 rows deep before the ridge starts.
  Apex and course count at that end: unresolved (top-down view only, ~5 rows counted by eye, +/-1).
  It is not a free-standing crown on a tower. No crown on tav or dio.
- **pointed arch:** none.
- **triplet slit window + flower box (sub T7):**
  - hib PARTIAL. The ground-floor front bay is exactly a slit rhythm: pier, slit, pier, double-wide
    slit (later the door), pier, slit, pier. Pattern counted in hib/f_008 = 1+1+1+2+1+1+1 = 8 blocks, which
    matches the `8` label in hib/f_003. Three slits (1, 2, 1 wide) are glazed with glass panes. The upper
    floor repeats it as three openings between four posts (hib/f_018). No window box on the sill; the
    "flower box" is a row of `rose_bush` planted at the foot of the glass slits (hib/f_026) and 2-high
    shrub-on-planter pairs flanking the door (hib/f_011, f_018). Verdict: slit triplet yes, flower box
    only as a ground-level bed.
  - tav PARTIAL. Ground-floor window = three lit panes in a timber frame with a plank sill (tav/f_013
    lower left, tav/f_020 lower left); upper windows = two lit narrow panes with a leafy planter box
    underneath, one with a lantern (tav/f_013, f_019, f_020). So a planter box exists under 2-pane windows,
    and a 3-pane window exists at ground level, but not both on one window.
  - dio ABSENT / unresolved. Lodge has a balcony with fence and potted plants at ground (dio/q03 "Pots and
    Plants"); no window box seen.
- **ruined mound:** none.

---

## 3. Other geometry the 12 shapes can't make

Format: name | description | how built | label | frames | confidence.

**G1. Rectilinear polygon footprint (walls, floor, later roof footprint)**
- hib: dumbbell plan, long axis ~34–35 blocks, outline stepped. Labels in hib/f_003 and f_005: `8, 5, 8` down
  the back (left) wall, `3` at the top shoulder, `8` on the bottom end bump. By mirror symmetry the back
  side is 8 (wing) + 5 (neck) + 8 (middle) + 5 (neck) + 8 (wing) = 34 (INFERRED from the labels and the
  symmetric outline). Wings ~13–14 wide, middle ~12, necks ~10 (pixel-scale estimate, +/-1).
- How built (OBSERVED): outline traced in marker blocks (hib/f_001), replaced by a 1-thick stone-brick ring
  (hib/f_002–f_003), then spruce plank floor filled inside it (hib/f_004–f_005). Inside the ring the floor
  leaves an I-shaped void at f_005 that is closed later (full plank floor in hib/f_049).
- `walls()` is one rectangle only. A union of rectangles would double the interior seams.
- Label: NEW SHAPE (outline/footprint from a vertex list or a union of rectangles). Frames hib/f_001–f_005,
  f_065, f_080. Confidence: high for existence, medium for the exact segment lengths.

**G2. Pier-and-slit bay and post-and-beam bay (a wall defined by a rhythm of segments)**
- hib ground floor: bay of 8 = P S P SS P S P (P = 1-wide stone-brick pier, S = glazed slit, SS = 2-wide
  slit used as the double door). Pier height ~5 (avatar-scaled, hib/f_008): 1 sill + ~3 clear opening +
  1 lintel. Door has 1–2 stone-brick stair steps in front (hib/f_011).
- hib upper floor: vertical `stripped_spruce_log` posts above each pier, horizontal log sill and head
  beams, a row of log-end squares at every junction, glass panes in the openings, red banners hung in
  two of the openings, gable above stepped in spruce planks (hib/f_013–f_018, f_026, f_034).
- tav: same idea. Ground floor stone with openings, upper floor half-timber with posts every ~2–3
  blocks, white infill (tav/f_004, f_005, f_007).
- `walls()` plus `pillar()` loops can do this by hand, but it is the most repeated pattern in two reels.
- Label: NEW SHAPE (`bay`/`colonnade` wall with a segment pattern) or at minimum PARAM on `walls`
  (`pattern`). Confidence: high on hib, medium on tav.

**G3. Cross-gable roof with valleys and a hipped end**
- hib: continuous ridge along the long axis with perpendicular gable masses stepping out and in, valleys
  visible as diagonal chevrons (hib/f_080, f_092), front elevation = three front-facing gables plus two
  porch gables (hib/f_107, f_099). Roof = `deepslate_tile_stairs`, uniform pitch.
- tav: main ridge plus one front cross-gable whose ridge meets the main slope (tav/f_004, f_005).
- dio: lodge main gable plus a cross-gable dormer plus a lower lean-to wing (dio/q03).
- Existing `roofGable` makes a single gable over one rectangle; overlapping two calls leaves jagged
  valley cells, and no `shape=inner_left/right` stair corners are produced.
- Label: NEW SHAPE (roof over a union of rectangles with valleys) or PARAM (`valleys: true`) on
  `roofGable`. Confidence: medium (stair corner states cannot be read from the frames).

**G4. Gable-end infill triangle with stepped profile (+ square gable window)**
- The triangle under a gable is filled in full blocks that follow the stair steps: spruce planks in hib
  (hib/f_018, f_034, f_048, f_081), white plaster in tav (tav/f_004, f_005), timber and white in dio (dio/q03).
  hib puts a 1x1 open square near the top (hib/f_018, f_034).
- Not made by any shape today; `roofGable` stops at the stairs.
- Label: PARAM (`fill` material, optional `window`) on `roofGable`. Confidence: high.

**G5. Ridge cresting (timber post-and-rail along the ridge)**
- See section 1 crenellation, tav/f_009, f_013, f_019, f_020. Label: PARAM on `roofGable`
  (`ridgeCap`) or COMPOSITION. Confidence: medium on post spacing.

**G6. Stepped corbel, knee brace, chamfered corners**
- hib/f_042: a bracket of horizontal stripped logs stepping out from a post top, end-grain facing out, two
  steps each side of the porch beam. tav/f_013: stacks of horizontal logs stepping outward under the jetty
  corners. hib/f_026: small stepped brown pieces under each upper post at sill level (INFERRED
  upside-down stairs, `half=top`). dio/q04: three-step chamfer on a bridge portal.
- `stairs()` always writes `half=bottom`, and it ascends, so a descending/inverted stair run cannot be
  made with it. `line()` with a log carrying an `axis` property can do the log version.
- Label: PARAM (`half` on `stairs`); logs via existing `line`. Confidence: medium.

**G7. Terraced excavation: quarry pit and pool pit**
- dio: a rectangular pit, about the footprint of the lodge plus yard (unresolved), cut into a rolling hill,
  with benches (ledges) down every wall, straight staircases cut into the wall, a tunnel mouth ("Amethyst
  Mine", dio/q06), and a flooded floor (dio/q04, q02). Wall faces jitter by 1–3 blocks in and out rather
  than staying planar (dio/q04, q06). Rim shows the same jitter.
- hib pool: pit dug into the snow terrace, stone stairs inset on two sides, speckled grey lining, then
  filled with water (hib/f_099–f_104, f_107). Water count in the material list: 5 stacks + 28 = 348
  (INFERRED: pool plus pond; stream use unknown).
- Label: NEW SHAPE (`pit`/`terrace`: bench height, bench depth, stair ramp, jitter, lining, optional
  water level). Confidence: high on existence, medium on any dimension.

**G8. Timber trestle bridge (posts, cap beam, braces, rails)**
- dio/q04: two bridge levels over the flooded pit. Posts 1 wide in pairs, spaced ~every 5th cell (INFERRED
  from deck rhythm), a cap beam, diagonal braces under the deck, minecart rails on top, and tall "wall
  support beams" standing 1–2 blocks off the rock with a top beam tying them to it (dio/q04, q02).
- Label: NEW SHAPE (`trestle(start, end, { postEvery, brace, rail })`), or COMPOSITION via `line` +
  `pillar` + `railing`. Confidence: medium.

**G9. Tiered topiary tree (Christmas tree)**
- hib/f_081, f_086: ~3 stacked discs of spruce leaves, each ~2 tall, widest at the bottom, rounded corners,
  trunk visible between tiers, candles on the leaf tops. `cone()` tapers continuously and cannot make
  discrete discs. Exact radius per tier unresolved.
- Label: PARAM (`tiers` on `cone`) or COMPOSITION (stacked `cylinder`s). Confidence: medium.

**G10. Hedge enclosure and hedge row**
- hib/f_087–f_092: a 1-thick ring of spruce leaves around each farm plot (4 plots; the plot is roughly
  square, ~10–12 per side, unresolved), and two long double-width leaf rows along the front court, each ~35
  long, lit with candles (hib/f_092). A hollow `walls()` with leaves already makes the ring. Label: SHAPE
  (`walls` with a leaf block, hollow ring) plus COMPOSITION (candle scatter). Confidence: high.

**G11. Terrain rim blend and strata cut**
- dio/q07, q01: rim reads as three ragged bands: light-grey stone ring, then orange-brown coarse-dirt-like
  patches, then grass. Boundaries are noisy and interleave. The outer face of the cut on the right side of
  dio/q02 shows strata: ~1 grass, a brown dirt band a few blocks thick, then stone.
- hib: the house sits on a flat shelf in a terraced snow hill. The hill contours step outward in rings
  (hib/f_092, bottom). Snow is cleared around paths and plots (hib/f_011, f_092).
- Label: COMPOSITION via a material function of distance-from-edge plus `patches()` noise. Confidence: medium.

**G12. Gantry crane with pulley ring and chain**
- dio/q06 (best), q01, q03: 4-post tower with cross-bracing, an angled jib, a pulley wheel at the tip (dark
  ring, ~4 across, unresolved), a vertical chain down to a trapdoor-and-stair pallet carrying a stack of
  light cube blocks. Label: COMPOSITION (`pillar`, `line`, hollow `cylinder` for the ring). Confidence: medium.

**G13. Shed (single-pitch) roof on free posts; wedge terrace with stair edge**
- hib/f_041–f_046, f_064, f_081: two free posts (stripped log with barrel foot), a log beam, then a small
  gable (hib/f_064) or single-pitch (hib/f_081) deepslate-stair roof running into the wall. Terrace = a
  stone floor wedge with a 2-step stair edge and stepped parapet (hib/f_034–f_040).
- Label: SHAPE (`stairs` with `width`, `box`, `line`); COMPOSITION. Confidence: high.

**G14. Chimney**
- tav/f_003 grey stone shaft, f_013 grey with a log band and a 4-post stone cap with slab, f_015–f_020
  brick-red shaft with the same band and cap. Label: COMPOSITION. Confidence: high.

---

## 4. Repurpose table

| block + state | used as | how placed | context | frames | label |
|---|---|---|---|---|---|
| `barrel[facing=up]` ? | foot (base) of a free-standing post | stripped log post sits on a barrel; hoops read as a dark ring at the foot | porch posts at wing terraces | hib/f_042, f_064, f_081; tav/f_013, f_020 (post feet with banded base; alt `dark_oak_trapdoor` ring) | COMPOSITION |
| `stripped_spruce_log[axis=z or x]` | end-grain "nail head" square at each frame joint | log laid so its ring face points out of the wall, flush with the post/beam | upper floor and porch beams | hib/f_018, f_026, f_034, f_042, f_048 | COMPOSITION (axis on log) |
| `oak_trapdoor[open=true]` ? | balustrade infill panel | vertical panel between fence posts, 2x2-hole lattice visible | central balcony | hib/f_048, f_081, f_084 | COMPOSITION |
| `oak_trapdoor` ? | lit lattice window panel | closed trapdoor texture glowing yellow from interior light | tavern windows | tav/f_013, f_020 (INFERRED from the 2x2 cross pattern) | COMPOSITION |
| `oak_trapdoor` ? | cart wheel | two vertical lattice squares under a plank bed | market cart in the yard | tav/f_019, f_020 | COMPOSITION |
| `lantern[hanging=false]` + `spruce_fence` | lamp post | lantern on a 1–2 block fence stub beside the door or on a stone plinth | door flanks, terrace corners | hib/f_011, f_018, f_042, f_048 | COMPOSITION |
| `lantern` + fence/trapdoor arms | wall bracket | lantern on a stub fence with a 2-bar bracket on the post face | upper-floor posts | hib/f_026 (INFERRED arms) | COMPOSITION |
| `spruce_leaves` | clipped hedge | 1-thick ring or double row, 1–3 high | plots, terrace, court | hib/f_088–f_092, f_081 | SHAPE (`walls`) |
| `spruce_leaves` | Christmas tree | 3 stacked discs, candles on top | front court | hib/f_081, f_083, f_086 | PARAM/COMPOSITION |
| `candle` (mixed colours, `white_candle[lit=true]`) | fairy lights | 1–3 per leaf block, on top faces; white ones lit and tall | hedges, tree | hib/f_081, f_086, f_099 (support method unresolved) | COMPOSITION |
| `red_banner` (straight-cross pattern) | window curtain / shutter | hung in an open window slot, 2 per gable | upper windows | hib/f_018, f_048, f_081, f_084 | COMPOSITION |
| `rose_bush` | foundation flower bed | row of 4–5 at the foot of glass slits; pair at stair corners | front facade, terrace | hib/f_026, f_042, f_090 | COMPOSITION |
| `barrel` or trapdoor box with leaves on top | planter | box 1 high, 2-high leaf shrub on top | beside door | hib/f_011, f_018; tav/f_013 | COMPOSITION |
| `flower_pot` on stone plinth | door planter | pot on a 1–2 block stone stub | porch | hib/f_042, f_064 | COMPOSITION |
| `glass_pane` | slit glazing | thin pane in each slit between piers | ground floor | hib/f_008–f_011, f_026 | COMPOSITION |
| `stone_brick_stairs` + slabs + plinth | stepped parapet | alternating low stair/slab and full-height plinth carrying a lantern | terrace edge | hib/f_042, f_064, f_090 | COMPOSITION |
| `spruce_planks` (full blocks) | stepped gable infill | follows the stair steps under the roof | gable ends | hib/f_018, f_034, f_048 | PARAM (G4) |
| `spruce_stairs[half=top]` ? | corbel under post feet | small stepped piece under each upper post at sill level | upper floor | hib/f_026 (INFERRED) | PARAM (G6) |
| stripped logs, horizontal, stepping | jetty bracket / knee brace | stacked 2–3 pieces, each 1 further out | porch beam, jetty corner | hib/f_042; tav/f_013 | SHAPE (`line`) |
| log posts every ~3 on a rail | ridge cresting | posts on top of the ridge rail | main and cross ridge | tav/f_009, f_013, f_019 | PARAM (G5) |
| 4 stone `wall` posts + slab | chimney pot | cap on the chimney shaft | chimney | tav/f_013, f_020 (INFERRED) | COMPOSITION |
| `chain` | crane cable | vertical chain from jib pulley to pallet | gantry cranes | dio/q01, q06 | SHAPE (`line`) |
| trapdoors/stairs in a ring | pulley wheel | dark ring at jib tip | gantry cranes | dio/q06, q01 (INFERRED material) | COMPOSITION |
| trapdoor + stair cluster | crane hook pallet | flat platform with 4 chains, load on top | crane | dio/q06, q01 | COMPOSITION |
| `barrel` + `amethyst_cluster` | ore bin | crystals on top of a barrel/crate | amethyst mine, yard | dio/q06, q01, q03 | COMPOSITION |
| `rail` + `minecart` / TNT minecart ? | prop on trestle | track on bridge deck, cart parked | quarry bridges | dio/q04 | COMPOSITION |
| `oak_fence` | rail on path, bridge, ledge | straight run | path edge, ledges | dio/q03, q06 | SHAPE (`railing`) |
| `mossy_cobblestone`, `vine`, `moss_carpet` ? | rock ageing | scattered patches on rock faces and ledges | pit walls | dio/q04, q02 | SHAPE (`patches()`) |
| stripped logs 1-wide, vertical | "wall support beam" | free-standing post 1–2 off the rock face, top beam ties back to rock | pit walls | dio/q04, q02 | COMPOSITION |
| dark-wood stairs + block | stepped lintel over water tunnel | stepped cap above a stone-lined opening | lodge foundation | dio/q03 crop | COMPOSITION |

---

## 5. Stage-1

### 5.1 hibouk-winter-mansion

DRAFT — belum di-roast; provisional format

**Theme / scale / massing & silhouette**
- Theme: alpine winter manor, symmetrical front, stone ground floor, spruce timber upper floor, dark slate
  roof (hib/f_107). Tutorial video with a 3D viewer at the end ("Layer N / 19").
- Scale: height 19 layers per the viewer label (OBSERVED hib/f_107–f_113). In hib/f_111 ("Layer 9/19") the
  upper-floor deck with beds already shows, so the first floor deck sits around layer 9 (INFERRED), and in
  hib/f_113 ("Layer 16/19") the roof is just starting. Plan ~34–35 long x ~13–14 wide at the wings
  (G1, hib/f_003, calibration in section 0). Front bay 8 wide (hib/f_008).
- Massing: dumbbell plan (two wings ~13–14 wide, narrower neck and middle). Three front gables (centre
  entrance bay, two wings) over a long ridge, a small gabled porch at each wing's terrace (hib/f_092,
  f_099, f_107). North end hipped (hib/f_080). Roof is about as tall as the walls look from the front
  (hib/f_107: eaves to ridge ~ as tall as the stone+timber stack, eyeballed).

**Build order (OBSERVED)**
1. Footprint outline in marker blocks, then stone-brick ring, then spruce plank floor: hib/f_001–f_005.
2. Entrance bay ground floor: piers and slits, door, planters, lanterns, steps: hib/f_006–f_011.
3. Upper floor frame of the entrance bay: posts, beams, banners, gable infill, first roof stairs:
   hib/f_012–f_018.
4. Neighbouring bays: roses at the foot, frame, roof: hib/f_019–f_033 (same recipe repeated).
5. Wing terrace: stone floor wedge, steps, lanterns, hedge: hib/f_034–f_040, f_056–f_060.
6. Porch posts, beam, corbels, small roof: hib/f_041–f_046, f_061–f_064.
7. Centre balcony: hib/f_047–f_048. Interior cutaway furnishing: hib/f_049–f_055, f_065–f_068.
8. Upper walls and full roof from above: hib/f_069–f_080.
9. Exterior pass: hedges, candle lights, Christmas trees, dusk and night lighting: hib/f_081–f_086.
10. Gardens (4 hedged plots, wheat/carrots/potatoes): hib/f_087–f_098. Pool and deck: hib/f_099–f_104.
11. Viewer and material list: hib/f_105–f_114.

**Palette per role** (counts from hib/f_109, f_110; ratios are shares of the building-block rows seen,
3586 blocks = planks 956 + logs 796 + roof 760 + stone bricks 462 + andesite 278 + glass pane 196 + spruce
stairs 138)

| role | block | count seen | share of those 3586 |
|---|---|---|---|
| structure frame | `stripped_spruce_log` (posts, beams, end-grain squares) | 796 (12 stacks + 28) | 22% |
| infill / floors / gables | `spruce_planks` | 956 (14 stacks + 60) | 27% |
| roof | `deepslate_tile_stairs` | 760 (11 stacks + 56) | 21% |
| ground floor, parapets, steps | `stone_bricks` | 462 (7 stacks + 14) | 13% |
| unknown stone | `andesite` | 278 (4 stacks + 22) | 8% (role unresolved, see below) |
| windows | `glass_pane` | 196 (3 stacks + 4) | 5% |
| trim and stairs | `spruce_stairs` | 138 | 4% |
| other seen | `red_carpet` 56, `chest` 55, `stone_brick_stairs` 52, `barrel` 50, `spruce_slab` 44, `spruce_fence` 42, `oak_trapdoor` 41, `rose_bush` 36 | | |
| ground / garden | `dirt_path` 202, `farmland` 190, `water` 348, `carrots` 48, `potatoes` 47 | | |
| accent | red banners (not in the seen rows), red carpet, rose bushes, candles, lanterns | | |
| terrain | snowy terrain (white top, brown lower band on cut faces): `grass_block[snowy=true]` + `snow` ? | | |

Wood families: planks + logs + stairs ~= 53% of the building blocks; roof ~= 21%; stone ~= 21%.
Unseen rows (counts 57 to 137) mean these shares are for the visible list only.

**Winter / snow treatment (asked for explicitly)**
- Roof: **no snow on any roof** (all deepslate tile stairs stay bare): hib/f_092, f_096, f_099, f_105.
- Leaves: snow sits on the **natural** spruce trees as thin white `snow` layers on the leaf tiers
  (hib/f_008, f_011, f_081, f_099 top left). The **built** spruce hedges and the Christmas tree have no snow
  caps; they carry candles instead (hib/f_081, f_086, f_090).
- Where snow does appear on the build: only as the terrain around it, cleared in clean rectangles
  around paths, plots and terraces (hib/f_011, f_034, f_092). Small 1x1 holes in the snow show bare
  green ground (hib/f_081, f_084, f_086): natural, unresolved.
- Winter reads from contrast and light, not from piled snow: near-black roof vs white ground, warm lantern
  glow, red accents (banners, roses, carpet) and evergreen hedges. Dusk and night grading is a render
  choice (hib/f_081–f_086), not geometry.

**Technique list**

| # | technique | in mcbuilder terms | label | frames | confidence |
|---|---|---|---|---|---|
| H1 | outline, then ring, then floor | polygon footprint; stone-brick ring then plank floor | NEW SHAPE (G1) | f_001–f_005 | high |
| H2 | stepped back wall (8, 5, 8, 5, 8) with end bumps | same polygon; no existing shape | NEW SHAPE (G1) | f_003, f_005 | medium |
| H3 | pier-and-slit ground bay P S P SS P S P, ~5 high | `walls` + `pillar` loops, glass `box` in slits | NEW SHAPE (G2) | f_007–f_011, f_034 | high |
| H4 | upper frame: posts over piers, beams, end-grain squares, banners | `pillar`, `line`, log `axis` | COMPOSITION | f_013–f_018, f_026 | high |
| H5 | stepped planks under the gable, 1x1 window | gable fill | PARAM (G4) | f_018, f_034, f_048 | high |
| H6 | deepslate-tile roof, 1-block overhang, 3 front gables | `roofGable` with `verge`/`eave` | SHAPE (+ G3 for valleys) | f_017, f_080, f_107 | high (valleys: medium) |
| H7 | wing terrace: stone wedge, 2-step edge, stepped parapet with lanterns | `box`/floor, `stairs`, `line` | COMPOSITION | f_034–f_040, f_064 | high |
| H8 | free-post porch: log posts on barrel feet, beam, corbels, small gable | `pillar`, `line`, `roofGable` | COMPOSITION | f_041–f_046, f_061–f_064 | high |
| H9 | centre balcony: trapdoor lattice balustrade, fence posts, lanterns, banners | `railing` + trapdoor material | COMPOSITION | f_047, f_048, f_081 | high |
| H10 | hedge rings round plots, hedge rows with candles | hollow `walls` of leaves | SHAPE + COMPOSITION (G10) | f_087–f_092, f_099 | high |
| H11 | Christmas tree of leaf tiers with candles | stacked `cylinder` or tiered `cone` | PARAM/COMPOSITION (G9) | f_081–f_086 | medium |
| H12 | farm plots: farmland, crops, 1 water cell, fence | `box` with farmland, crops | COMPOSITION | f_090–f_099 | medium (water cell: unresolved) |
| H13 | pool: dug pit, stone stairs inset in slope, lining, water, plank deck, loungers | pit (G7) + `box` water | NEW SHAPE (G7) | f_099–f_104, f_107 | medium |
| H14 | dirt-path cross in cleared snow | `line`/`box` of `dirt_path` | SHAPE | f_001, f_092 | high |
| H15 | warm lighting at piers, plinths, post brackets | placement rule: lantern at every pier and plinth | COMPOSITION | f_011, f_026, f_042, f_084 | high |
| H16 | interior: red carpet runner down the corridor, rooms off it, straight stairs | `box`/`line` carpet | COMPOSITION | f_049–f_055, f_065 | low (interior not needed for the guide) |

**Naive build vs what they did**
- Naive: one rectangle, one gable roof, a door, windows punched at random spacing, uniform stone or wood
  wall, snow on the roof to read as winter.
- They: a long stepped plan; a repeated bay (stone piers with slits below, post-and-beam above) so that
  windows follow the structure; end-grain log squares at every joint; three gables facing the court;
  near-black roof so the white ground does the winter work; red accents and hedges for colour; a cleared
  court with a path cross; a pool and gardens dug into the slope.

**Unresolved**
- Role of `andesite` (278). INFERRED guess: pit lining at the pool (speckled grey in hib/f_100); not shown
  elsewhere with certainty.
- Terrace floor block: pale blocks with brick-like joints, `stone_bricks` ? vs `andesite`/polished variant.
- Exact roof stair rows, ridge height, gable steps; `half`/`shape` of roof stair corners.
- Plot sizes, hedge height, water-cell function in the plots (hib/f_089–f_091).
- How candles are held on leaf tops; parasol and lounger blocks at the pool (hib/f_107).
- Exact segment widths of the plan other than the labelled ones; whether `3` is a shoulder or an end bump.
- Terrain block (`snow_block` vs `grass_block[snowy=true]` + `snow`).
- Material list: rows between 56 and 137 counts not seen.

### 5.2 omggamer-medieval-tavern

DRAFT — belum di-roast; provisional format

**Theme / scale / massing & silhouette**
- Theme: medieval half-timber tavern/inn, stone base, jettied timber upper floor, big grey roof, brick
  chimney, market cart at the door. A build-up reel with a fade-out (tav/f_001–f_021).
- Scale: footprint unreadable (no labels, no player in frame). Relative proportions of the front-ish
  elevation in tav/f_004 (eyeballed, +/-10% for perspective): stone ground floor ~1/3 of the height,
  timber floor ~1/3, roof ~1/3.
- Massing: near-square two-storey box with a long-slope gable roof over a stepped front cross-gable on
  the right; upper floor overhangs the stone on free posts at the right front corner (tav/f_004). Chimney
  stands off the ridge at the right (tav/f_004, f_013). Silhouette is broken by the cresting posts, the
  cross-gable and small roof hoods.

**Build order (OBSERVED)**
1. Stone box with window holes and a timber ring beam and corner posts: tav/f_001–f_002.
2. Roof stair slopes and log ridge beam: tav/f_002–f_003.
3. White infill between upper timbers, front cross-gable, hoods with small beams: tav/f_004–f_006.
4. Facade detail: window frames, planters, stepped brackets, base pilasters: tav/f_007–f_012.
5. Ridge cresting posts and roof texture variation: tav/f_009–f_013.
6. Chimney recolour from grey to brick red, and landscaping (path, grass, cart): tav/f_014–f_020.

**Palette per role** (no counts; ratios eyeballed from tav/f_004, f_013, f_020, +/-10%)

| role | block | rough share of facade/roof area |
|---|---|---|
| frame (posts, beams) | oak-family log/stripped log, orange-brown: `oak_log` / `stripped_oak_log` ? (alt spruce) | ~25% of wall area |
| infill | white: `white_concrete` ? / `quartz_bricks` ? / `calcite` ? (faint horizontal lines in tav/f_004) | ~35% of upper wall |
| roof | grey stair mix, starts uniform (tav/f_002), becomes patchy dark and light by tav/f_013: `stone_brick_stairs` ? + `cobbled_deepslate_stairs` ? / `deepslate_brick_stairs` ? | the biggest area of the elevation |
| floor | not seen (exterior only) | n/a |
| foundation / ground floor | `stone_bricks` (tav/f_001–f_005), roughened to a stone mix with pilasters (tav/f_013) | ~1/3 of elevation |
| accent | brick chimney `bricks`, golden window glow, leafy planters | small |
| trim | stepped logs, stair hoods over roof windows, timber window frames | small |
| ground | orange-brown path `dirt_path`? / `coarse_dirt`? / `packed_mud`? plus grass tufts | tav/f_018–f_020 |
| chimney | grey stone shaft to f_013, then brick red from f_015, with a log band and 4-post cap | |

**Technique list**

| # | technique | in mcbuilder terms | label | frames | confidence |
|---|---|---|---|---|---|
| T1 | timber ring beam on the stone box, corner posts to the eave | `box`/`line`/`pillar` with log material | SHAPE | tav/f_001–f_002 | high |
| T2 | jetty: upper floor overhangs stone, held on free posts at the right front | `pillar`, `line` | COMPOSITION | tav/f_004, f_005 | high |
| T3 | big gable roof of stairs with log ridge beam overshooting both ends | `roofGable` with `verge`, log ridge `line` | SHAPE | tav/f_002–f_004 | high |
| T4 | front cross-gable, gable fill in white plaster | gable fill + valleys | PARAM (G4), NEW SHAPE (G3) | tav/f_004, f_005 | high |
| T5 | roof hoods: small stair roofs with a beam over upper windows | `roofGable`/`stairs` small spans | SHAPE | tav/f_004, f_007 | medium |
| T6 | ridge cresting: posts every ~3 on a rail | ridge cap | PARAM (G5) | tav/f_009, f_013, f_019 | medium |
| T7 | roof texture break-up: second grey stair type scattered | `patches()` material on the stair block | COMPOSITION | tav/f_002 vs f_013 | medium |
| T8 | windows: timber frame, lattice panes lit from inside, plank sill, planter | trapdoor lattice + leaf planter | COMPOSITION | tav/f_013, f_019, f_020 | medium |
| T9 | stone base roughened and given pilasters / stepped corner buttress | mixed stone material, `stairs` and `box` stubs | COMPOSITION | tav/f_007, f_013 | medium |
| T10 | chimney with band and 4-post cap, recoloured to brick | `box`, `line`, `pillar` | COMPOSITION (G14) | tav/f_003, f_013, f_015 | high |
| T11 | stepped log brackets at jetty corners and porch beams | `line` of logs, axis out | SHAPE | tav/f_013, f_019 | medium |
| T12 | porch posts with barrel feet and banded top | post helper | COMPOSITION | tav/f_013, f_020 | medium |
| T13 | landscaping: path, grass tufts, cart on trapdoor wheels | path `line`, small prop | COMPOSITION | tav/f_018–f_020 | medium |

**Naive build vs what they did**
- Naive: flat stone-brick walls, a plain gable with stairs, no overhang, same wall block on both floors.
- They: stone below, half-timber above, upper floor overhanging, one roof plus a cross-gable plus hoods,
  roof material varied, cresting on the ridge, brackets and band details on every post and corner,
  and a chimney recoloured to add a warm accent.

**Unresolved**
- Footprint size, door count, wall heights in blocks.
- Real material of infill, roof stairs and chimney band; whether the lattice windows are trapdoors.
- Overhang depth of the jetty; whether the corner brackets are logs or stairs.
- Ridge cresting post spacing (~3, +/-1) and whether the posts rest on the rail or on slabs.
- Ground block under the path (several candidates).

### 5.3 dio-rods-waterfall-quarry

DRAFT — belum di-roast; provisional format

**Theme / scale / massing & silhouette**
- Theme: survival base cut into a hillside quarry with a waterfall; lodge, workshop and ore-crusher on the
  rim, cranes, trestle bridges and stairs inside the pit, flooded pit floor, windmill. Seven stills
  (dio/q01–q07); q05 is interiors, q07 the overview.
- Scale: no labels, no scale object; footprint and depth unresolved. Relative: the pit is about the size
  of the lodge plus its yard (q07), and the waterfall height is a few times the lodge height (q02).
- Massing: one large rectangular pit with an irregular rim (q07), the lodge and two sheds on the north and
  west rim, three bridge levels across, stairs and ledges stepping down each wall (q01, q02).

**Build order:** not visible (finished stills only).

**Palette per role**

| role | block |
|---|---|
| timber structure | warm orange-brown logs/stripped logs, spruce or oak (`stripped_oak_log` ?, `oak_log` ?); same colour for posts, beams, bridge decks, cranes |
| infill (lodge) | pale pink-white plaster: `white_terracotta` ? / `white_concrete` ? tinted by shader (dio/q03, q05) |
| roof | pink-red brick tiles with lighter patches and wood ribs every ~4–5 columns: `brick_stairs` ? + `oak_stairs` ribs (dio/q03, q06) |
| foundation / lodge ground floor | grey stone mix: `stone_bricks`, `cobblestone`, `mossy_cobblestone`, with `vine` (dio/q03) |
| quarry rock | light-grey speckled stone: `stone`, `andesite`, `cobblestone`, `mossy_cobblestone`, patches of `moss_block`/`moss_carpet` ? (dio/q04) |
| ore and stock | amethyst clusters in barrels, copper-coloured clumps `raw_copper_block` ? / `granite` ?, yellow bales `hay_block` ?, white cut blocks `calcite` ? / `diorite` ? / `smooth_quartz` ? (dio/q01, q06) |
| ground | `grass_block`, orange-brown `coarse_dirt` ?/`rooted_dirt` ?, yellow `dirt_path` ? (could be `sand`) (dio/q01, q03, q07) |
| water | `water` stream, waterfall, flooded floor with `lily_pad`, `seagrass`/`kelp` ? (dio/q02, q04) |
| trim | `oak_fence`, `oak_trapdoor`, `chain`, `lantern` |
Ratios: unresolved (stills, cropped, perspective).

**How the build meets and cuts into the terrain (asked for explicitly)**
1. **Rim as gradient, not a line.** The pit edge is a ring of light stone, then ragged orange-brown dirt
   patches, then grass, with the three bands interleaving (dio/q07, q01). Not a clean cut.
2. **Benches, not a funnel.** Each wall steps down in 1–3 block ledges; straight stone staircases are
   cut into the wall along them (dio/q06 "Staircase #3", dio/q04 lower left). Faces jitter in and out by 1–3
   blocks instead of being planar (dio/q04, q06).
3. **Strata visible at the cut.** The outer face of the pit on the right of dio/q02 shows grass, then a
   brown dirt band, then stone: the hill is shown as layers, not a solid.
4. **Structure sits at the lip, stone foundation flush with the cut face.** The lodge's stone ground floor
   runs to the rim (dio/q01, q03). A wide timber platform with a crane stands on a corner ledge (dio/q06).
5. **Water runs through the build.** A stream passes through a stone-lined, stepped-lintel tunnel under
   the lodge, exits onto a plank footbridge, then drops over the rim as a waterfall ~2–3 blocks wide
   (INFERRED from perspective, dio/q03 crop, dio/q01), splits into cascades and pools on ledges, and ends in a
   flooded floor with lily pads (dio/q02, q04).
6. **Timber standing against rock.** Vertical "wall support beams" 1 wide, 1–2 blocks off the face, each
   tied to the rock by a beam at the top (dio/q04). Bridge portal posts rest on ledges (dio/q04, q02).
7. **A tunnel mouth cut into the wall** (amethyst mine) framed in timber, with crates of crystals
   (dio/q06).
8. **Spoil and stock at the rim:** stacked cut stone cubes and a small cart at the near rim (dio/q01 bottom
   left), a log pile on the right (dio/q07).
9. **Ageing by patches:** moss and vines over the lower pit walls and ledges (dio/q04, q02).

**Technique list**

| # | technique | in mcbuilder terms | label | frames | confidence |
|---|---|---|---|---|---|
| D1 | rectangular pit with jittered rim | `box` of air + noise jitter; pit shape | NEW SHAPE (G7) | q07, q01 | high on existence |
| D2 | benches and cut-in staircases | `stairs` along bench edges; `box` ledges | NEW SHAPE (G7) / COMPOSITION | q06, q04 | medium |
| D3 | rim gradient stone to dirt to grass | material fn of distance + `patches()` | COMPOSITION (G11) | q07, q01 | medium |
| D4 | strata at the outer cut | layered materials by depth | COMPOSITION | q02 right | medium |
| D5 | waterfall + tunnel under building + cascades + flooded floor | `box` water columns, stone-lined tunnel | COMPOSITION | q03, q01, q02, q04 | medium |
| D6 | trestle bridges with portal frames and rails | `pillar`, `line`, `railing` | NEW SHAPE (G8) / COMPOSITION | q04, q02 | medium |
| D7 | wall support beams on the rock | `pillar` + `line` | COMPOSITION | q04 | high |
| D8 | gantry crane with pulley, chain, pallet | `pillar`, `line`, hollow `cylinder`, `chain` | COMPOSITION (G12) | q06, q01 | medium |
| D9 | lodge: stone ground floor, half-timber upper floor, brick roof with ribs, cross-gable, balcony | `walls`, `roofGable` with material fn for ribs, `railing` | SHAPE + COMPOSITION | q03 | medium |
| D10 | lean-to wing, windmill tower with fence gallery | `roofGable`/`stairs`, tapered `box` stack | COMPOSITION | q03 | low |
| D11 | tunnel mouth in rock face (mine) | `box` air + timber frame | COMPOSITION | q06 | medium |
| D12 | moss, vines, scatter rocks | `patches()` | SHAPE | q04, q02 | medium |
| D13 | interiors: fireplace with chimney breast, workshop blocks, bunk beds, storage attic, warehouse | furniture placement | COMPOSITION | q05 | low (not in scope here) |

**Naive build vs what they did**
- Naive: flat site, a house on grass, a river with straight edges, a rectangular hole.
- They: the house sits on the rim and the stream is routed through it; the hole has benches, jittered
  walls, strata, stairs, tunnel, bridges and cranes that give it scale; the rim blends out three ways;
  rock is mixed from four or five blocks with moss; wood is used as the unifying colour (bridges, cranes,
  frame, rails, stairs, posts).

**Unresolved**
- All dimensions: pit size and depth, bench count and height, waterfall width and drop, bridge spans.
- Real blocks: rock mix, roof brick, infill (pink-tinted), ore clumps, bales, white cut cubes, path.
- Whether the "pink" is the shader or the block.
- How the arched-look portals and tunnel lintel are built block by block (which stairs, which half).
- Whether the lodge's roof "hatch" in dio/q03 is stairs, trapdoors or a skylight.
- Build order, since only finished stills exist.
