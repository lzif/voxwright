# SHAPE-MAPPING: guide techniques mapped to mcbuilder shapes

DRAFT, 2026-11-13. Not roasted, not locked. Maps every technique in `docs/build-patterns.md` (T1–T41, plus the draft T43–T47 and the draft sub-entries) to the mcbuilder shape layer. Sources: `/data/workspace/minecraft-reels/work/mapping-draft.md` (M-rows, verdicts, shape priority) and `/data/workspace/minecraft-reels/work/guide-draft-index.md`. Nothing here changes a shape; the three planned shapes are marked "planned, not implemented".

Labels: SHAPE = an existing shape makes it (box, walls, pillar, line, stairs, stairsRun, railing, cylinder, sphere with dome, cone, roofGable, roofHip, plus `Build.floor`). NEW SHAPE = needs a shape that does not exist. PARAM = an option on an existing shape. COMPOSITION = built by combining existing shapes and `set()` calls, no new geometry. BLOCKED = geometry unresolved in the frames.

Evidence column: `L<n>` is the line of the technique heading in `docs/build-patterns.md`, then frames as `reel/f_NNN` (reel aliases as in mapping-draft.md: alixxa, trixy, heavy, FM, AR, GS, NS, DB, hib, tav, dio, jp, tall, pillar). Where no frame is pinned the cell says so.

Not shapes: dome and spiral stairs. The frames show none (every reader reported them ABSENT), so no shape is proposed; `sphere` already has a `dome` option.

| technique | label | evidence (guide line + frame) | shape / notes |
|---|---|---|---|
| T1 Material variation | COMPOSITION | L288; tav/f_013, dio/q04, DB/f_043 | Material function / `patches()` noise over `walls` and `box`; no geometry |
| T2 Skeleton-first framing | COMPOSITION | L347; AR/f_049 (jetty), hib/f_018 (end-grain joints), GS/f_024 | `pillar` + `line` + `stairs[half=top]` via `set()`. Jetty (M17) and timber frame (M11) are candidate NEW SHAPEs in mapping-draft ranks 7 and 1, not planned here |
| T3 Horizontal breaks | PARAM | L422; FM/f_068, FM/f_007 | Pilaster rhythm as an option on `walls` (M15), not implemented; bands are `line` |
| T4 Silhouette discipline | SHAPE | L452; hib/f_080 (cross-gable), AR/f_105, alixxa/f_017 | `roofGable`, `roofHip`, `pillar`; gable end-fill is a PARAM (M24); crane is composition (M45, dio/q06) |
| T5 Ground connection | COMPOSITION | L600; alixxa/f_001, hib/f_092, DB/f_303 | `box`, `stairs`, `patches()`, hedges as leaf `box` |
| T5 sub: Ruined-mound terrain base (draft) | COMPOSITION | L696; alixxa/f_001, alixxa/f_005 | `patches()` plus terraced `box`; built vs natural terrain unresolvable (M53, low confidence) |
| T6 Lighting rhythm | COMPOSITION | L716; hib/f_026, hib/f_011 | Lantern placement rule (M63): `set()` on a rhythm |
| T7 Detail & props | COMPOSITION | L768; AR/f_049, NS/f_066, GS/f_066 | Trapdoor and pot `set()` calls; `railing` for rails and parapet runs |
| T7 sub: Triplet slit windows + flower box (draft) | COMPOSITION | L1002; alixxa/f_010, alixxa/f_008 | Fixed window module (M06, M07), helper `windowTriplet` possible later. Pareidolia lint question OPEN |
| T8 Siting | COMPOSITION | L1027; FM/f_101, FM/f_120, hib/f_090 | `cylinder` basins, `box`, `patches()` (M62) |
| T9 Diorama composition | COMPOSITION | L1126; dio/q07, dio/q02 | Terrain anchor is composition; pit/excavation NEW SHAPE is below the line (M54) |
| T10 Theme anchors | COMPOSITION | L1155; hib/f_086, hib/f_099 | Tiered tree is a `cone` `tiers` PARAM below the line (M60); snow staging is composition (M58) |
| T11 Stage the arrival | COMPOSITION | L1192; tav/f_020 (cart); stylized renders, no frame | `line`, `pillar`, props via `set()` |
| T12 Pergola shade structures | COMPOSITION | L1249; NS/f_122, NS/f_137 | Slab rows with gaps on `pillar`s (M52) |
| T13 Tall-narrow stacking discipline | COMPOSITION | L1275; alixxa/f_017 (scope gap, 7×7) | Discipline rule, no geometry |
| T14 Working openings | COMPOSITION | L1310; DB/f_044 (dam) | Slots in `walls`, iron bars via `set()` |
| T15 Stair-block masonry arches | NEW SHAPE (planned, not implemented) | L1327; trixy/f_001, FM/f_044, DB/f_040 | `arch`, stepped profile; `stairs` forces `half=bottom` so it cannot cut a head (M01) |
| T15 sub: Arch profiles (draft) | NEW SHAPE (planned, not implemented) | L1344; trixy/f_001 (segmental), trixy/f_019 (lancet), AR/f_139 (rib) | `arch` with `profile` = stepped, segmental, lancet (M01–M03); ogee BLOCKED (M05, AR/f_075–f_090); rib vault M04 flagged, not covered |
| T16 Bamboo screens | COMPOSITION | L1374; DB/f_142–f_206 (torii garden, no single frame pinned) | Bamboo columns via `line`/`set()` |
| T17 Bridge anatomy | SHAPE | L1391; DB/f_447, niitty/f_011 | `box`, `stairsRun`, `railing`; hump bridge is 2× `stairs` (M42); arched stair bridge is a NEW SHAPE below the line (M41) |
| T18 Custom trees | COMPOSITION | L1407; DB/f_474, DB/f_481 | `sphere` and `cylinder` blobs, vines via `set()` (M61) |
| T19 Hoist grammar | COMPOSITION | L1433; no frame pinned (DB well, B11 f_486–f_500) | `pillar`, `line`, chain |
| T20 Boat mooring | COMPOSITION | L1456; DB/f_325, DB/f_372 | Pier kit (M51); boats are entities |
| T21 Activity ledges | COMPOSITION | L1471; DB/f_328 | `box`, `line` |
| T22 Under-deck dressing | COMPOSITION | L1486; DB/f_372 | `pillar` piles, fence bracing |
| T23 Market stall module | COMPOSITION | L1499; DB/f_517, DB/f_519 | Stall frame and awning via `pillar`, `line`, wool (M71) |
| T24 Repeat-with-variation expansion | COMPOSITION | L1514; meta-technique, no frame | Workflow rule |
| T25 Open belfry crown | COMPOSITION | L1533; no frame pinned in mapping-draft | `pillar`, `roofHip`, bell block |
| T26 Mansard roof with dormers | COMPOSITION | L1553; FM/f_064, FM/f_074 | `roofHip` and `stairs`; dormer with pediment is a NEW SHAPE below the line (M29); `roofHip` forces `half=bottom` |
| T27 Central pedimented pavilion + grand stair | COMPOSITION | L1585; FM/f_068, FM/f_048 | `stairs` with width, `box`, `roofGable`; undercroft arch would use `arch` |
| T28 Hedge maze garden | COMPOSITION | L1619; FM/f_120, FM/f_126 | Leaf `box`/`line` pattern |
| T29 White balustrade boundary + gate piers | SHAPE | L1648; FM/f_089, FM/f_090 | `railing`, `pillar` |
| T30 Indoor orangery | COMPOSITION | L1676; FM/f_132 | `box` planters, `patches()` |
| T31 Outline-first layout | COMPOSITION | L1704; FM/f_002, jp/f_009 | `Build.floor` outline helper (M48) |
| T32 Machicolation gallery band | COMPOSITION | L1747; heavy/f_004, heavy/f_006, heavy/f_013 | Composition of `arch` (M03) + corbel flare (M35) + `parapet` (M34); mapping-draft M36 |
| T32 sub: Merlon/crenel rhythm + corbel flare (draft) | NEW SHAPE (planned, not implemented) | L1777; heavy/f_005, heavy/f_007, FM/f_048 | `parapet`: ring or line, `merlon`/`crenel` params, corner rule, `overhang` option (M34, M35). `walls` + `box` cannot alternate with correct corners |
| T33 Stepped tower staging | COMPOSITION | L1806; heavy/f_014, heavy/f_016 | `box` stages + `cone`/`roofHip` crown |
| T34 Stepped dark spire with accent + finial | PARAM | L1838; heavy/f_011, heavy/f_016 | Concave `cone` profile PARAM (M32), below the line |
| T35 Paired slit window grid | COMPOSITION | L1880; heavy/f_013, heavy/f_007 | `walls` with a `set()` grid |
| T36 East-Asian tiled roof grammar | COMPOSITION | L1915; jp/f_019, jp/f_049 | `roofHip` + `stairs` bands |
| T37 Roofed compound wall + gatehouse pavilion | COMPOSITION | L1944; jp/f_015, jp/f_063 | `walls` + cap (M20) |
| T38 Vermillion pavilion pair | COMPOSITION | L1967; jp/f_053, jp/f_066 | Palette choice, no geometry |
| T39 Tile-and-sand courtyard grid | COMPOSITION | L1995; jp/f_027 | `Build.floor`, `box`, `patches()` |
| T40 Porch as mini stepped-gable pavilion | COMPOSITION | L2020; tall/f_004, tall/f_012 | `pillar`, `roofGable`, `stairs` |
| T41 Stepped east-face profile | SHAPE | L2057; tall/f_010 | `box`/`stairs` stepped wall (sheet-level evidence, low) |
| T42: reserved (rose window failed the smoke test), never used | BLOCKED | none; rose window M10, gothic/f_011 (sheet-level) | No shape; number never reused |
| C2 stepped gable: BLOCKED | BLOCKED | no guide entry; tall/f_010, tall/f_011 (M30, sheet-level) | Tower-roof geometry unresolved; do not write or implement |
| T43 Mid-tower skirt roof as stage separator (draft) | NEW SHAPE (planned, not implemented) | L2081; alixxa/f_015, alixxa/f_016, alixxa/f_017 | `skirtRoof` (M21): rim, dentil row, low terraced hip. Not buildable until course count, stair vs slab and facing are known; `roofHip` cannot (no flat brim, no dentil) |
| T44 Steep stepped pyramid crown (draft, provisional) | BLOCKED | L2133; alixxa/f_017 (one oblique frame) | Exact geometry unresolved (M22); `roofHip` PARAM `rise` + spire cap proposed but unconfirmed; smoke test required |
| T45 Stacked pier-and-post bay (draft) | COMPOSITION | L2174; hib/f_008, hib/f_018, hib/f_107 | Same family as the `bayWall` shape ranked 1 in mapping-draft (M11–M13); not planned here |
| T46 Ridge cresting (draft) | PARAM | L2210; tav/f_009, tav/f_013, tav/f_020 | `ridgeCap` on `roofGable` (M26), single reel, low priority |
| T47 Benched excavation pit (draft) | COMPOSITION | L2243; dio/q07, dio/q04 | Pit/terraced excavation NEW SHAPE is below the line (M54, M55); no dimensions resolved |

## Consistency

- Every technique in the guide draft has a row: T1–T41, T43–T47, and the four draft sub-entries (T5 mound, T7 triplet, T15 arch profiles, T32 merlon rhythm), each directly after its parent.
- T42 is unused anywhere in the guide; its row records the reservation. C2 stepped gable has a row and is BLOCKED.
- The three planned new shapes are `arch` (T15 and its profiles sub-entry), `parapet` (T32 sub-entry) and `skirtRoof` (T43). None is implemented by this document.
- Guide line numbers are for `docs/build-patterns.md` in this package as of the draft commit.
