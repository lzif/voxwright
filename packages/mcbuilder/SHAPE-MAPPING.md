# SHAPE-MAPPING: guide techniques mapped to mcbuilder shapes

Updated 2026-11-13. Maps every technique in `docs/build-patterns.md` (T1–T41, T43–T52, and every sub-entry) to the mcbuilder shape layer. Status: T1–T52 and all sub-entries are locked (T1–T47 and their sub-entries after Luki roasted the 2026-11-13 drafts; T48–T52 and the 14 disruptive-builds wave 2 sub-entries locked 2026-11-13 without roast at Luki's request). Sources: `/data/workspace/minecraft-reels/work/mapping-draft.md` (M-rows, verdicts, shape priority), `/data/workspace/minecraft-reels/work/guide-draft-index.md`, `/data/workspace/minecraft-reels/work/evidence/C-disruptive.md` and `/data/workspace/minecraft-reels/work/block-repurposing.md`. Nothing here changes a shape. The `arch` shape is implemented (commit 664edf7, tests in 8a6744b); `parapet` (668049a) and `skirtRoof` (c73fccc) are implemented too.

Labels: SHAPE = an existing shape makes it (box, walls, pillar, line, stairs, stairsRun, railing, cylinder, sphere with dome, cone, roofGable, roofHip, arch, plus `Build.floor`). NEW SHAPE = needs a shape that does not exist. PARAM = an option on an existing shape. COMPOSITION = built by combining existing shapes and `set()` calls, no new geometry. BLOCKED = geometry unresolved in the frames.

Evidence column: `L<n>` is the line of the technique heading in `docs/build-patterns.md`, then frames as `reel/f_NNN` (reel aliases as in mapping-draft.md: alixxa, trixy, heavy, FM, AR, GS, NS, DB, hib, tav, dio, jp, tall, pillar). Where no frame is pinned the cell says so.

Not shapes: dome and spiral stairs. The frames show none (every reader reported them ABSENT), so no shape is proposed; `sphere` already has a `dome` option.

| technique | label | evidence (guide line + frame) | shape / notes |
|---|---|---|---|
| T1 Material variation | COMPOSITION | L288; tav/f_013, dio/q04, DB/f_043 | Material function / `patches()` noise over `walls` and `box`; no geometry |
| T2 Skeleton-first framing | COMPOSITION | L347; AR/f_049 (jetty), hib/f_018 (end-grain joints), GS/f_024 | `pillar` + `line` + `stairs[half=top]` via `set()`. Jetty (M17) and timber frame (M11) are candidate NEW SHAPEs in mapping-draft ranks 7 and 1, not planned here |
| T3 Horizontal breaks | PARAM | L422; FM/f_068, FM/f_007 | Pilaster rhythm as an option on `walls` (M15), not implemented; bands are `line` |
| T4 Silhouette discipline | SHAPE | L452; hib/f_080 (cross-gable), AR/f_105, alixxa/f_017 | `roofGable`, `roofHip`, `pillar`; gable end-fill is a PARAM (M24); crane is composition (M45, dio/q06) |
| T5 Ground connection | COMPOSITION | L600; alixxa/f_001, hib/f_092, DB/f_303 | `box`, `stairs`, `patches()`, hedges as leaf `box` |
| T5 sub: Ruined-mound terrain base | COMPOSITION | L696; alixxa/f_001, alixxa/f_005 | `patches()` plus terraced `box`; built vs natural terrain unresolvable (M53, low confidence) |
| T5 sub: Ragged-edged plaza paving | PARAM (not implemented) | L715; DB/f_474, DB/f_447, DB/f_506 | `edge: noisy` option on `box` / `Build.floor` plus `patches()` material; seen on seven builds, the edge algorithm is not recoverable from the frames (C-disruptive section 3) |
| T6 Lighting rhythm | COMPOSITION | L737; hib/f_026, hib/f_011 | Lantern placement rule (M63): `set()` on a rhythm |
| T6 sub: Lamp-post forms | COMPOSITION | L788; DB/f_227 (gate post), DB/f_343 (arm post) | `pillar` stub + `set()` lantern; arm post adds a `line` arm and a hanging lantern |
| T7 Detail & props | COMPOSITION | L802; AR/f_049, NS/f_066, GS/f_066 | Trapdoor and pot `set()` calls; `railing` for rails and parapet runs |
| T7 sub: Triplet slit windows + flower box | COMPOSITION | L1036; alixxa/f_010, alixxa/f_008 | Fixed window module (M06, M07), helper `windowTriplet` possible later. Pareidolia lint question OPEN |
| T7 sub: Fence-lattice window | COMPOSITION | L1060; DB/f_406, DB/f_405 | Fence columns joined by `set()`; no geometry. Audit lints not run on it |
| T7 sub: Covered gallery crown with end pavilions | COMPOSITION | L1074; DB/f_067, DB/f_071, DB/f_064 | 7 `pillar`s + `line` beams + `railing` knee wall + `roofGable`/`roofHip` end pavilions; trapdoor plates per T50 |
| T7 sub: Posted stair-hood | COMPOSITION | L1097; DB/f_549, DB/f_550 | `stairs` rows + slim `pillar`s on stone piers; hood and post count unresolved |
| T7 sub: Furniture and counters from repurposed blocks | COMPOSITION | L1107; DB/f_128, DB/f_406, DB/f_267 | `set()` of stairs, trapdoors, barrels, cauldron, furnaces; block-repurposing rows TD09, ST08. The 3-wide cabinet unit is BLOCKED (block unidentified) |
| T7 sub: Attic neglect dressing | COMPOSITION | L1127; DB/f_136, DB/f_131 | `set()` cobwebs; no geometry |
| T8 Siting | COMPOSITION | L1137; FM/f_101, FM/f_120, hib/f_090 | `cylinder` basins, `box`, `patches()` (M62) |
| T9 Diorama composition | COMPOSITION | L1236; dio/q07, dio/q02 | Terrain anchor is composition; pit/excavation NEW SHAPE is below the line (M54) |
| T9 sub: Accessible verticals, working alcove | COMPOSITION | L1264; DB/f_233, DB/f_245, DB/f_267 | `line` ladder in a 1-wide shaft + door `set()`; furnace stack via `set()`. Mine rail on a stair slope is BLOCKED (rail shape states not visible, DB/f_270, f_273) |
| T10 Theme anchors | COMPOSITION | L1283; hib/f_086, hib/f_099 | Tiered tree is a `cone` `tiers` PARAM below the line (M60); snow staging is composition (M58) |
| T11 Stage the arrival | COMPOSITION | L1320; tav/f_020 (cart); stylized renders, no frame | `line`, `pillar`, props via `set()` |
| T12 Pergola shade structures | COMPOSITION | L1377; NS/f_122, NS/f_137 | Slab rows with gaps on `pillar`s (M52) |
| T13 Tall-narrow stacking discipline | COMPOSITION | L1403; alixxa/f_017 (scope gap, 7×7) | Discipline rule, no geometry |
| T14 Working openings | COMPOSITION | L1438; DB/f_044 (dam) | Slots in `walls`, iron bars via `set()` |
| T15 Stair-block masonry arches | SHAPE (`arch`, implemented in 664edf7) | L1455; trixy/f_001, FM/f_044, DB/f_040 | `arch` with the `stepped` profile; the head only, the opening and jambs are the caller's. `stairs` forces `half=bottom` so it could not cut a head (M01) |
| T15 sub: Arch profiles | SHAPE (`arch`, implemented in 664edf7) | L1472; trixy/f_001 (segmental), trixy/f_019 (lancet), AR/f_139 (rib) | `arch` with `profile` = stepped, segmental, pointed (M01–M03); the AR/f_139 rib with steep legs is not made; ogee BLOCKED (M05, AR/f_075–f_090); rib vault M04 flagged, not covered |
| T15 sub: Corbelled stepped forms | NEW SHAPE (frieze A, not planned); SHAPE (niche B) | L1501; DB/f_040, DB/f_043 (frieze), DB/f_105, DB/f_136 (niche) | A: sawtooth relieving frieze over arcade bays, no shape (block-repurposing ST02, C-disruptive M12). B: `arch` `stepped`, `rise: 1`, which its docstring already cites at DB/f_105. C is T51 |
| T16 Bamboo screens | COMPOSITION | L1526; DB/f_142–f_206 (torii garden, no single frame pinned) | Bamboo columns via `line`/`set()` |
| T17 Bridge anatomy | SHAPE | L1543; DB/f_447, niitty/f_011 | `box`, `stairsRun`, `railing`; hump bridge is 2× `stairs` (M42); arched stair bridge is a NEW SHAPE below the line (M41) |
| T17 sub: Hump footbridge | SHAPE | L1558; DB/f_186, DB/f_196, DB/f_172 | Two `stairs`/`stairsRun` flights back to back with a short flat deck (M42); 3 treads counted on the approach |
| T18 Custom trees | COMPOSITION | L1570; DB/f_474, DB/f_481 | `sphere` and `cylinder` blobs, vines via `set()` (M61) |
| T19 Hoist grammar | COMPOSITION | L1596; no frame pinned (DB well, B11 f_486–f_500) | `pillar`, `line`, chain |
| T19 sub: Roofed hoist | COMPOSITION | L1618; DB/f_490, DB/f_487 | 4 `pillar`s + `roofGable` + chain `line` + hanger lattice via `set()`; hung object unresolved |
| T20 Boat mooring | COMPOSITION | L1635; DB/f_325, DB/f_372 | Pier kit (M51); boats are entities |
| T21 Activity ledges | COMPOSITION | L1650; DB/f_328 | `box`, `line` |
| T22 Under-deck dressing | COMPOSITION | L1665; DB/f_372 | `pillar` piles, fence bracing |
| T23 Market stall module | COMPOSITION | L1678; DB/f_517, DB/f_519 | Stall frame and awning via `pillar`, `line`, wool (M71) |
| T24 Repeat-with-variation expansion | COMPOSITION | L1693; meta-technique, no frame | Workflow rule |
| T25 Open belfry crown | COMPOSITION | L1712; no frame pinned in mapping-draft | `pillar`, `roofHip`, bell block |
| T25 sub: Crenellated corbel crown over a belfry | NEW SHAPE (implemented, 668049a) | L1731; DB/f_550, DB/f_549, DB/f_567 | `parapet` ring with the `corbel` option (3-wide shaft to 5-wide crown); corners raised 2 courses is not a parameter (use `height` or a second call); open belfry opening is `set()`. Same planned shape as the T32 sub-entry |
| T26 Mansard roof with dormers | COMPOSITION | L1749; FM/f_064, FM/f_074 | `roofHip` and `stairs`; dormer with pediment is a NEW SHAPE below the line (M29); `roofHip` forces `half=bottom` |
| T27 Central pedimented pavilion + grand stair | COMPOSITION | L1781; FM/f_068, FM/f_048 | `stairs` with width, `box`, `roofGable`; undercroft arch would use `arch` |
| T28 Hedge maze garden | COMPOSITION | L1815; FM/f_120, FM/f_126 | Leaf `box`/`line` pattern |
| T29 White balustrade boundary + gate piers | SHAPE | L1844; FM/f_089, FM/f_090 | `railing`, `pillar` |
| T30 Indoor orangery | COMPOSITION | L1872; FM/f_132 | `box` planters, `patches()` |
| T31 Outline-first layout | COMPOSITION | L1900; FM/f_002, jp/f_009 | `Build.floor` outline helper (M48) |
| T32 Machicolation gallery band | COMPOSITION | L1943; heavy/f_004, heavy/f_006, heavy/f_013 | Composition of `arch` (M03) + corbel flare (M35) + `parapet` (M34, implemented, 668049a); mapping-draft M36 |
| T32 sub: Merlon/crenel rhythm + corbel flare | NEW SHAPE (implemented, 668049a) | L1973; heavy/f_005, heavy/f_007, FM/f_048 | `parapet`: ring or line, `merlon`/`crenel`/`height`/`base` params, corner rule, `corbel` stair option that steps the ring out 1 (M34, M35). `walls` + `box` cannot alternate with correct corners |
| T32 sub: More merlon/crenel data points | NEW SHAPE (implemented, 668049a) | L2001; DB/f_226, DB/f_307, DB/f_317, DB/f_550 | Data for the `parapet` `merlon`/`crenel` defaults (1:1 on the wall, about 2:1 on the tower crown); no new shape (M34, M35) |
| T33 Stepped tower staging | COMPOSITION | L2013; heavy/f_014, heavy/f_016 | `box` stages + `cone`/`roofHip` crown |
| T34 Stepped dark spire with accent + finial | PARAM | L2045; heavy/f_011, heavy/f_016 | Concave `cone` profile PARAM (M32), below the line |
| T35 Paired slit window grid | COMPOSITION | L2087; heavy/f_013, heavy/f_007 | `walls` with a `set()` grid |
| T36 East-Asian tiled roof grammar | COMPOSITION | L2122; jp/f_019, jp/f_049 | `roofHip` + `stairs` bands |
| T37 Roofed compound wall + gatehouse pavilion | COMPOSITION | L2151; jp/f_015, jp/f_063 | `walls` + cap (M20) |
| T38 Vermillion pavilion pair | COMPOSITION | L2174; jp/f_053, jp/f_066 | Palette choice, no geometry |
| T39 Tile-and-sand courtyard grid | COMPOSITION | L2202; jp/f_027 | `Build.floor`, `box`, `patches()` |
| T40 Porch as mini stepped-gable pavilion | COMPOSITION | L2227; tall/f_004, tall/f_012 | `pillar`, `roofGable`, `stairs` |
| T41 Stepped east-face profile | SHAPE | L2264; tall/f_010 | `box`/`stairs` stepped wall (sheet-level evidence, low) |
| T42: reserved (rose window failed the smoke test), never used | BLOCKED | none; rose window M10, gothic/f_011 (sheet-level) | No shape; number never reused |
| C2 stepped gable: BLOCKED | BLOCKED | no guide entry; tall/f_010, tall/f_011 (M30, sheet-level) | Tower-roof geometry unresolved; do not write or implement |
| T43 Mid-tower skirt roof as stage separator | NEW SHAPE (implemented, c73fccc) | L2288; alixxa/f_015, alixxa/f_016, alixxa/f_017 | `skirtRoof` (M21): rim, dentil row, low terraced hip. Course count (`courses`) and block vs slab terraces (`slab`) are parameters with design-choice defaults, not observed values; no stair option, facing is unresolved; `roofHip` cannot (no flat brim, no dentil) |
| T44 Steep stepped pyramid crown (provisional) | BLOCKED | L2340; alixxa/f_017 (one oblique frame) | Exact geometry unresolved (M22); `roofHip` PARAM `rise` + spire cap proposed but unconfirmed; smoke test required |
| T45 Stacked pier-and-post bay | COMPOSITION | L2381; hib/f_008, hib/f_018, hib/f_107 | Same family as the `bayWall` shape ranked 1 in mapping-draft (M11–M13); not planned here |
| T45 sub: Independent upper rhythm over an arcade | COMPOSITION | L2416; DB/f_067, DB/f_040 | Pier + bay loop for the 4-bay arcade, a separate post loop for the 7 gallery posts; the `arcade` NEW SHAPE of C-disruptive section 3 is not planned here |
| T46 Ridge cresting | PARAM | L2429; tav/f_009, tav/f_013, tav/f_020 | `ridgeCap` on `roofGable` (M26), single reel, low priority |
| T47 Benched excavation pit | COMPOSITION | L2462; dio/q07, dio/q04 | Pit/terraced excavation NEW SHAPE is below the line (M54, M55); no dimensions resolved |
| T48 Curtain wall in phase | COMPOSITION | L2499; DB/f_226, DB/f_227, DB/f_313, DB/f_317 | `walls` + `set()` for pilasters and bays (the `walls` pilaster PARAM is M15, not implemented), trapdoor hoarding via `set()`, merlons via `parapet` (implemented, 668049a); gate = `box` lintel + iron bars |
| T49 Torii gate with portal veil | COMPOSITION | L2537; DB/f_153, DB/f_156, DB/f_162 | `box` pillars and beams, `stairs`/`box` cap rows, `nether_portal` via `set()`; could become a prop shape (C-disruptive section 3). No dimensions resolved |
| T50 Trapdoor hardware on timber | COMPOSITION | L2576; DB/f_067, DB/f_469, DB/f_490, DB/f_156 | Trapdoor `set()` with `open`; states are inferred from the latch (TD05, TD06); no geometry |
| T51 Raised stage with a stepped timber arch | COMPOSITION | L2609; DB/f_533, DB/f_573 | `box` stage + inverted-`stairs` ends + `pillar` posts; the stepped head can use `arch` `stepped` (its docstring cites DB/f_533), the 1-block overhangs and flat crown are `set()`. The hanging figure is an entity, BLOCKED as geometry |
| T52 Abstract figure statue on a planter base | COMPOSITION | L2640; DB/f_503, DB/f_504, DB/f_505 | `box` figure from mixed stone-brick variants + planter `box`; all dimensions unresolved |

## Consistency

- Every technique in the guide has a row: T1–T41, T43–T52, and all 18 sub-entries (T5 mound, T7 triplet, T15 arch profiles, T32 merlon rhythm, plus the 14 disruptive-builds wave 2 sub-entries), each directly after its parent. All techniques and sub-entries are locked.
- T42 is unused anywhere in the guide; its row records the reservation. C2 stepped gable has a row and is BLOCKED.
- `arch` is implemented (commit 664edf7, tests in 8a6744b): the T15, T15 arch-profiles and T15 corbelled-forms (niche) rows use it, and T51 may. `parapet` (668049a; T32 sub-entry, and the T25 and T32 data sub-entries that reuse it) and `skirtRoof` (c73fccc; T43) are implemented. `examples/reel_keep/reel-keep.ts` uses all three.
- Guide line numbers (`L<n>`) are for `docs/build-patterns.md` in this package after the disruptive-builds wave 2 edit.
