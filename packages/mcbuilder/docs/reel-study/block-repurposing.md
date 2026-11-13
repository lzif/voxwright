# Block repurposing catalogue

DRAFT, frame-side only. T-numbers are assigned after Luki's T1–T41 guide lands. Not roasted.

Date: 2026-11-12

## Why this exists

Builders in these reels constantly use a block against its original function: a trapdoor is a shutter or a rivet plate, upside-down stairs are a corbel, a wall post is a mullion, a barrel is a post foot, a cauldron is a sink. An agent that only knows what a block is "for" will never place these. This file is the catalogue: every repurpose the four readers reported, merged across reels, grouped by block family. The companion file `mapping-draft.md` holds the technique rows; the `(Mnn)` in the context column points to the matching row there.

## Conventions

- Reel aliases, frame format and confidence wording are the same as in `mapping-draft.md`: `alixxa`, `trixy`, `heavy`, `niitty`, `tall`, `jp`, `pillar` (4 still images, by file stem), `FM`, `AR`, `GS`, `GV`, `NS`, `DB` (disruptive-builds, builds B1-B15), `hib`, `tav`, `dio` (photos `dio/q01`-`q07`, no f_ numbers).
- Block IDs and `?` are copied from the readers. "Wood species `?`" means the shader tint hides the species. No ID was added.
- Frames: at most 3 per row, the strongest. Hyphen = range the reader cited.
- `open=true` on a trapdoor is OBSERVED only where noted; in DB it is mostly INFERRED from the visible latch and vertical panel.
- Label as in the reader brief. Near-original uses (lectern with a book, workbench run, plain fence railings) are listed only where a reader flagged them.
- No composter, lever or confirmed item frame was reported by any reader. The one unidentified window item is listed under "Redstone and misc". Nothing was invented to fill those families.
- A row ID (TD01, ST01, ...) is a working ID for cross-reference, not a technique number.

## Trapdoor

| ID | block + state | used as | how placed (facing / half / open / position) | context | frames | reels | label |
|---|---|---|---|---|---|---|---|
| TD01 | `oak_trapdoor[open=true]` ? (species ?) | window awning over a slit; trapdoor row over a door lintel | 1 block out above each slit: a flat top piece plus a front-face piece, facing outward | alixxa first and second stage windows and door (M06) | alixxa/f_010, alixxa/f_016, alixxa/f_017 | alixxa | COMPOSITION (sub T7) |
| TD02 | `spruce_trapdoor[open=true]` x5 (NS); `oak_trapdoor[open=true]` ? (alixxa); `?_trapdoor[open=true]` + `?_fence` (DB) | flower-box / planter trough | NS: 3 as front board, 2 as end boards under the window, leaves inside. alixxa: a row 1 block out below the slits, flowers and vine on top. DB: rim around leaves and flowers at gazebo steps. hib, tav: barrel or trapdoor box 1 high with a 2-high leaf shrub beside the door | window sills, door flanks, gazebo steps (M07, M71) | alixxa/f_010, NS/f_066, DB/f_469 | alixxa, NS, DB, hib (f_011, f_018), tav (f_013) | COMPOSITION (sub T7 for window boxes) |
| TD03 | `oak_trapdoor[open=true]` stack, or `ladder ?` | slit-window mullion / shutter | 3-4 stacked in a 1-wide slit, one side; the rungs read as crossbars | AR front and side panels (M06) | AR/f_049, AR/f_062 | AR | COMPOSITION |
| TD04 | `oak_trapdoor[open=true]` x4 | window shutters | 2 stacked on each side of a glass pane, each side 1 wide x 2 tall | GS windows (M08) | GS/f_066 | GS | COMPOSITION |
| TD05 | `?_trapdoor[open=true]` (tan, latch visible) | beam-end plate / "rivet plate" | `open=true` (INF), flat against the end face of a projecting beam or roof corner, one per post position | B1 gallery beams above 7 posts, pavilion roof corners; B9 gazebo; B11 well (M65) | DB/f_064, DB/f_067, DB/f_469 | DB | COMPOSITION |
| TD06 | `?_trapdoor[open=true]` (vertical slat, no frame; ribbed on the torii) | post-foot panel on the stone course; ribbing on pillar bases and beam faces | `open=true` on the outward face of the stone course at each post foot (7 in B1) | B1 walkway base; B9, B11 post feet; B3 torii (M65, M68) | DB/f_067, DB/f_470, DB/f_156 | DB | COMPOSITION |
| TD07 | `?_trapdoor[open=true]` (spruce) | hoarding slat / wall shutter | `open=true`, vertical, hung at the top of each recessed bay and between merlon cubes | B4 curtain wall and towers (M37) | DB/f_226, DB/f_304, DB/f_313 | DB | COMPOSITION |
| TD08 | `?_trapdoor[open=true]` (reddish; `crimson_trapdoor ?`, alt `mangrove_trapdoor`) on a `bookshelf` | cabinet door front | stacked pairs flush on the shelf face, alternating with book rows, both sides of the aisle | B2 library walls (M73) | DB/f_117, DB/f_121, DB/f_130 | DB | COMPOSITION |
| TD09 | `?_trapdoor[open=true]` behind a stair; `?_trapdoor[open=false,half=top]` on a pedestal | armchair back; reading-table top | open trapdoor behind a seat stair as back rest; closed top-half trapdoor on a 1-block pedestal (`stripped_?_log ?`, alt `barrel`) | B2 library tables (M74) | DB/f_128, DB/f_106, DB/f_122 | DB | COMPOSITION |
| TD10 | `?_trapdoor[open=true]` (vertical slat, dark) in a stone-brick niche; tav `oak_trapdoor ?` lit lattice | glassless window fill | fills a 1-2 high niche in a 3-wide stone panel; tav: closed trapdoor texture glowing yellow (INF from the 2x2 cross pattern) | B2 library and attic windows; tav windows (M09) | DB/f_105, DB/f_136, tav/f_013 | DB, tav (INF) | COMPOSITION |
| TD11 | `oak_trapdoor[open=true]` ? | balustrade infill panel | vertical panel between fence posts, 2x2-hole lattice visible | hib central balcony (M70) | hib/f_048, hib/f_081, hib/f_084 | hib | COMPOSITION |
| TD12 | `?_trapdoor[open=true]` (dark oak, 2x2 pane); `?_trapdoor[open=false]` flat | interior wainscot; deck tiles | flush on interior walls; closed, `half=bottom`, flat on the pier floor (INF from panel texture) | B5 boathouse and pier (M76) | DB/f_334, DB/f_340, DB/f_362 | DB | COMPOSITION |
| TD13 | closed trapdoor / grate lying flat; open trapdoor flush on the shaft | bay floor plate; ornament panels and side tabs | closed `half=bottom` at the base of each bay; `open=true` against the pillar shaft (IDs `?`) | pillar frames (M14) | pillar/115561_0_vzlr, pillar/115564_3_ck17 | pillar | COMPOSITION |
| TD14 | `oak_trapdoor` (orange-brown) | rake dentils along a stepped gable | one on each stair step of the gable edge | trixy gables (M30 related) | trixy/f_018, trixy/f_019 | trixy | COMPOSITION |
| TD15 | `oak_trapdoor` ? | corbel bracket under the skirt rim | under the rim, with `lantern[hanging=true]` beside | alixxa skirt roof (M21) | alixxa/f_015, alixxa/f_016 | alixxa | COMPOSITION |
| TD16 | `spruce_trapdoor` closed | loft hatch | in the opening of the plank floor | GV loft (M78) | GV/f_028, GV/f_030 | GV | COMPOSITION |
| TD17 | `oak_trapdoor ?` | cart wheel | two vertical lattice squares under a plank bed | tav market cart | tav/f_019, tav/f_020 | tav | COMPOSITION |
| TD18 | trapdoors / stairs in a ring; trapdoor + stair cluster | crane pulley wheel; hook pallet | dark ring at the jib tip (INF material); flat platform with 4 chains, load on top | dio gantry cranes (M45) | dio/q06, dio/q01 | dio | COMPOSITION |
| TD19 | dark-oak trapdoors / doors ? | wall panels, pews, benches | boxed panels against the wall; rows facing the altar | trixy interior (M78) | trixy/f_022, trixy/f_023 | trixy | COMPOSITION, low (IDs unresolved) |
| TD20 | `?_trapdoor[open=true]` (several, 3-wide block, upper) | hanging cabinet unit | above the counter under the ceiling | DB B6 interior (M75) | DB/f_406, DB/f_407 | DB | BLOCKED (block identity unclear) |

## Stairs

`stairs[half=top]` is the single most-used repurpose. Most halves below are INFERRED from the silhouette (only AR is stated as observed by B).

| ID | block + state | used as | how placed (facing / half / open / position) | context | frames | reels | label |
|---|---|---|---|---|---|---|---|
| ST01 | `stairs[half=top]` (stone / pale); `?_stairs[half=top]` (dark oak / spruce); dio dark-wood stairs + block | arch haunch, chamfer, stepped lintel | one per side at the spring line facing the opening (trixy: left `facing=east`, right `facing=west`, INF); upside-down stairs at the two upper corners stepping 1 across / 1 up (FM chamfer 2 steps, DB niche); dio portal 3 per side with `half` unresolved | arch heads, portals, niches (M01, M02) | trixy/f_001, FM/f_044, DB/f_105 | trixy, FM, DB, dio (q04, q03) | NEW SHAPE (arch) |
| ST02 | `stone_brick_stairs[half=top]` staggered with 1-deep gaps | relieving sawtooth frieze above bays | `half=top`, facing outward or alternating, in 2 rows offset by half a bay over each bay | DB B1 arcade top (M12) | DB/f_040, DB/f_043, DB/f_044 | DB | NEW SHAPE |
| ST03 | `oak_stairs[half=top]`; hib `spruce_stairs[half=top] ?` | jetty bracket / corbel | 1 block under the deck edge, step toward the wall, every ~3 blocks; a larger stack at the corner post; hib: small stepped piece under each upper post at sill level (INF) | AR upper-storey overhang; hib upper posts (M17) | AR/f_035, AR/f_049, hib/f_026 | AR, hib (INF) | COMPOSITION inside NEW SHAPE jetty |
| ST04 | `stone_brick_stairs[half=top]`; stairs as corbels | machicolation corbel and crown flare | `half=top`, outward, under each projecting merlon cube; 1-2 steps outward around a square shaft below the parapet | DB B4 parapet, B15 crown; heavy crown (M35) | DB/f_226, DB/f_550, heavy/f_004 | DB, heavy | NEW SHAPE (parapet) |
| ST05 | `?_stairs[half=top]` (pale wood) | knee brace under a beam, with a hanging lantern | `half=top` on each side of the post below the beam | DB B1 walkway ceiling (M65) | DB/f_071, DB/f_073, DB/f_062 | DB | COMPOSITION |
| ST06 | `?_trapdoor[open=true]` + `?_stairs[half=top]` | mine-support bracket | angled bracket between post and lintel | DB B4 adit portal (M72) | DB/f_262, DB/f_264, DB/f_269 | DB | COMPOSITION |
| ST07 | `stone_brick_stairs` facing outward | flared plinth / foot steps | at the foot of each pilaster | DB B4 front wall (M12, M37) | DB/f_313, DB/f_315, DB/f_316 | DB | COMPOSITION |
| ST08 | `?_stairs[facing=*]`; FM red-brown stairs | armchair seat, window seat, sofa | seat facing the table with an open trapdoor behind; one stair each side of a niche facing in; FM sofa in a corner (INF) | DB B2 library and attic; FM interior (M74) | DB/f_128, DB/f_141, FM/f_130 | DB, FM (INF) | COMPOSITION |
| ST09 | `stone_brick_stairs` ring; stairs and trapdoors around a log | ring planter; tree-root buttress | ring path with stairs facing outward; stairs flaring from the trunk base (INF, low resolution) | DB B10 (M61) | DB/f_484, DB/f_485 | DB | NEW SHAPE / PARAM, low |
| ST10 | `?_stairs` canopy | stall canopy; porch hood | slanted canopy of upside-down or forward stairs; 3-tier hip lean-to hugging the tower front | DB B13 stalls, B15 tower (M71, M23) | DB/f_517, DB/f_549, DB/f_551 | DB | COMPOSITION / PARAM (`roofHip`) |
| ST11 | plank platform with `?_stairs[half=top]` feet | raised stage with a notched underside | plank top, inverted stairs at the ends | DB B14 (M46) | DB/f_529, DB/f_533, DB/f_573 | DB | COMPOSITION |
| ST12 | stairs + slabs, white; stairs stacked as flank buttress | vault ribs; pillar flare | rising diagonal inside the nave; 3 steps each side at base and capital, narrowing the bay | trixy nave; pillar frames (M04, M14) | trixy/f_004, trixy/f_021, pillar/115561_0_vzlr | trixy, pillar | NEW SHAPE |
| ST13 | upside-down stairs alternating with small wall posts, dark recess strip between; FM inverted stairs / trapdoors ? | modillion / corbel-table cornice; cornice dentils | one band under the eave, 3 rows; FM alternating small blocks (block not identified, INF) | trixy west gable and nave; FM cornice (M16) | trixy/f_018, trixy/f_019, FM/f_074 | trixy, FM (INF) | COMPOSITION |
| ST14 | `stone_brick_stairs` + slabs + plinth | stepped parapet carrying lanterns | alternating low stair / slab and full-height plinth carrying a lantern | hib terrace edge (M50) | hib/f_042, hib/f_064, hib/f_090 | hib | COMPOSITION |
| ST15 | cream stair / slab stack | dormer pediment | 3-step triangle above the dormer opening | FM (M29) | FM/f_074 | FM | COMPOSITION |
| ST16 | `quartz_pillar ?` + inverted stair / slab | column shaft, capital, base | wider top and bottom courses, 1 block proud of the wall (INF) | FM (M15) | FM/f_068 | FM | COMPOSITION |

## Slab

| ID | block + state | used as | how placed (facing / half / open / position) | context | frames | reels | label |
|---|---|---|---|---|---|---|---|
| SL01 | `slab[type=bottom]` x2 | arch crown | one cell above the haunch stairs, in the bottom half of the cell | trixy portal and window heads (M02) | trixy/f_001 | trixy | NEW SHAPE (arch) |
| SL02 | `stone_brick_slab[type=top]` | bay lintel course | top half, full run over the bays | DB B1 arcade (M12) | DB/f_040 | DB | SHAPE (`box` + material) |
| SL03 | `stone_brick_slab[type=top]`; `stone_brick_slab` row | window sill; string course | under the window as a 3-wide ledge; continuous ledge at the floor line | GV facade (M16) | GV/f_055, GV/f_021, GV/f_053 | GV | COMPOSITION |
| SL04 | `oak_slab` rows with gaps | pergola rafters | slabs across posts, spaced 1 apart | NS porch (M52) | NS/f_122, NS/f_132 | NS | COMPOSITION |
| SL05 | `diorite_slab ?` / `stone_slab ?` | post cap on a dark log post | on top of the log post, lantern or fence beside | DB B6 pier (M51) | DB/f_372, DB/f_386, DB/f_399 | DB | COMPOSITION |
| SL06 | slab ledge on a shaft | flat roof cap | 1-block overhang | heavy first stage | heavy/f_004 | heavy | COMPOSITION |
| SL07 | `oak_slab[type=top]` + planks | layered jetty fascia | 2 stacked edge rows, slab row above the bracket row | AR (M17) | AR/f_049 | AR | COMPOSITION |
| SL08 | 4 stone `wall` posts + slab | chimney pot cap | cap on the chimney shaft (INF) | tav chimney (M67) | tav/f_013, tav/f_020 | tav | COMPOSITION |
| SL09 | slab + `candle`; patterned carpet | low table; rug | low slab table with a candle; carpet on the floor (INF from shapes) | FM interior (M74) | FM/f_130, FM/f_131 | FM | COMPOSITION, low |

## Fence, wall, bars and chain

Plain fence railings and balustrades (alixxa, NS, AR, DB, dio) are near-original uses and are not catalogued here; see M70 in `mapping-draft.md`.

| ID | block + state | used as | how placed (facing / half / open / position) | context | frames | reels | label |
|---|---|---|---|---|---|---|---|
| FW01 | `stone_brick_wall` | window mullion | single post centred in each 1-wide slit | alixxa first-stage windows (M06) | alixxa/f_010 | alixxa | COMPOSITION |
| FW02 | `stone_brick_wall` / `?_wall` (+ `?_fence`, + slab base) + `lantern`; hib `lantern` + `spruce_fence` | lamp post; gate lamp post; stone lantern (tōrō) | wall post at the corners with a lantern on top; wall stub + fence post + lantern; wall post on a slab base with a lantern | alixxa foundation; DB gate and pond; hib door flanks (M64) | alixxa/f_005, DB/f_226, DB/f_164 | alixxa, DB, hib (f_011) | COMPOSITION |
| FW03 | `oak_fence ?` stacked (alt `lightning_rod ?`) | spire / finial pin | 1x1 post on a 1x1 column, about 3-5 blocks (alixxa 4-5, AR 3-4, FM 3 with a white pin) | alixxa crown, AR apex, FM cap (M22) | alixxa/f_017, AR/f_141, FM/f_071 | alixxa, AR, FM | PARAM (cap) / COMPOSITION, block unresolved |
| FW04 | `stone_brick_wall` posts in a row | belfry louvre colonnade | thin posts under a crenellated parapet | trixy bell tower | trixy/f_011, trixy/f_014, trixy/f_017 | trixy | COMPOSITION |
| FW05 | wall posts with stair / slab caps stacked | pinnacle / finial on buttress heads | 2-3 blocks tall at the top of piers | trixy exterior (M38) | trixy/f_008, trixy/f_009, trixy/f_013 | trixy | COMPOSITION |
| FW06 | `?_fence` grid (posts joined horizontally) | lattice window grille instead of glass | 1-wide, 3-high fence columns with horizontal connections | DB B6 interior windows (M09) | DB/f_405, DB/f_408, DB/f_417 | DB | COMPOSITION |
| FW07 | `?_wall` + `?_fence` + `?_wall` stack | gallows post | vertical stack, stone at both ends | DB B14 (M46) | DB/f_529, DB/f_533, DB/f_573 | DB | COMPOSITION |
| FW08 | `iron_bars` | sluice / portcullis grille | centred in the bay opening, about 1 block recessed | DB B1 arcade, 4 bays (M12) | DB/f_040, DB/f_044, DB/f_051 | DB | COMPOSITION |
| FW09 | `chain`; `iron_chain[axis=y]` | crane cable, pillory rope, bell hanger, hoist, bridge hangers, pinnacle finial | vertical chain from jib to pallet; from the crown with a fence bar; from a trapdoor / fence frame under the roof; hanging beside a hull; single chain on a 1x1 tip | dio cranes; DB B14, B11, B6; niitty crown and bridges (M45, M46, M41) | dio/q06, DB/f_533, niitty/f_021 | dio, DB, niitty | SHAPE (`line`) / COMPOSITION |
| FW10 | `?_fence` / stone wall + `warped_planks ?` (alt `cyan_wool`) | flag pole and flag | pole of wall + fence; flag about 6 blocks in a hooked shape | DB B4 tower (M44) | DB/f_251, DB/f_256, DB/f_257 | DB | COMPOSITION |
| FW11 | `lantern` + fence / trapdoor arms | wall bracket | lantern on a stub fence with a 2-bar bracket on the post face (arms INF) | hib upper-floor posts | hib/f_026 | hib | COMPOSITION |

## Log, stripped log and wood

| ID | block + state | used as | how placed (facing / half / open / position) | context | frames | reels | label |
|---|---|---|---|---|---|---|---|
| LG01 | `stripped_spruce_log[axis=z or x]` | end-grain "nail-head" square at each frame joint | log laid so its ring face points out of the wall, flush with the post / beam | hib upper floor and porch beams (M18) | hib/f_018, hib/f_026, hib/f_034 | hib | COMPOSITION |
| LG02 | `oak_log[axis=x or z]` (end grain showing) | projecting beam stub / outrigger | at corners and mid-side, 1 block out from the beam ring | GS ring beam (M17, M18) | GS/f_023, GS/f_024, GS/f_025 | GS | COMPOSITION |
| LG03 | `oak_log[axis=y]` end-grain | corner cap block | ring texture visible on top of posts and deck corners | GS, NS, AR, GV (M18) | GS/f_024, NS/f_078, AR/f_062 | GS, NS, AR, GV (f_035) | COMPOSITION |
| LG04 | doubled log columns | thick corner post | 2 logs side by side at each corner | AR (M11) | AR/f_039, AR/f_042, AR/f_062 | AR | COMPOSITION |
| LG05 | horizontal stripped logs stepping out | jetty bracket / knee brace | stacked 2-3 pieces, each 1 further out, end grain facing out | hib porch beam; tav jetty corners (M17) | hib/f_042, tav/f_013 | hib, tav | SHAPE (`line` with log `axis`) |
| LG06 | log posts on a rail | ridge cresting | a post about every 3rd cell on top of the ridge rail | tav ridge (M26) | tav/f_009, tav/f_013, tav/f_019 | tav | PARAM |
| LG07 | stripped logs 1 wide, vertical | wall support beam | free-standing post 1-2 blocks off the rock face, a top beam ties it to the rock | dio pit walls (M43) | dio/q04, dio/q02 | dio | COMPOSITION |
| LG08 | plank blocks with every second one missing | dentil / corbel row under the brim | one course, pitch 2 | alixxa skirt roof and hat (M21) | alixxa/f_015, alixxa/f_017 | alixxa | PARAM (dentil on skirt roof) |
| LG09 | `calcite ?` with a 1x1 gap | slit / oculus window | one block removed in the gable infill | GV gable (M24) | GV/f_035 | GV | COMPOSITION |

## Barrel, chest, cauldron and other containers

No composter was identified by any reader. The dark object hanging in the DB well has alternatives `hopper ?` / `cauldron ?` (see RM07).

| ID | block + state | used as | how placed (facing / half / open / position) | context | frames | reels | label |
|---|---|---|---|---|---|---|---|
| CT01 | `barrel[facing=up]` ? (alt `dark_oak_trapdoor` ring) | foot of a free-standing post | stripped log post sits on a barrel; hoops read as a dark ring at the foot | hib porch posts at wing terraces; tav (M66) | hib/f_042, hib/f_064, tav/f_013 | hib, tav | COMPOSITION |
| CT02 | `barrel[facing=up]` | porch corner block | banded block with lid circle and dot on top, at the front deck corners | NS (M66) | NS/f_055, NS/f_013 | NS | COMPOSITION |
| CT03 | `barrel` (sideways) | foundation course; temporary corner marker | row at ground level along the wall base (INF from banding, not provable); at each corner or turn of the outline before the real build | NS (M66, M48) | NS/f_047, NS/f_059, NS/f_011 | NS | COMPOSITION |
| CT04 | `barrel[facing=up]` / stripped-log stump + `?_trapdoor` lid, stacked with `chest` | bridge-end bollard, pier bollard, cargo crate | at the abutment end; on the deck edge | DB B1, B5 (M51) | DB/f_064, DB/f_068, DB/f_342 | DB | COMPOSITION |
| CT05 | `barrel[facing=up]` + `lantern` | side table with lamp | lantern placed on the barrel top | DB B4 alcove and adit | DB/f_267, DB/f_268, DB/f_298 | DB | COMPOSITION |
| CT06 | `barrel` (side-facing) | kitchen counter units | in a row under the basin and shelf | DB B6 (M75) | DB/f_406, DB/f_407, DB/f_408 | DB | COMPOSITION |
| CT07 | `barrel` + `amethyst_cluster` | ore bin | crystals on top of a barrel or crate | dio mine and yard; DB stall wares (f_519) | dio/q06, dio/q01, dio/q03 | dio, DB | COMPOSITION |
| CT08 | `cauldron[level=3]` (water) | kitchen sink basin | inset in a counter run next to barrels | DB B6 (M75) | DB/f_406, DB/f_408 | DB | COMPOSITION |
| CT09 | `furnace` / `blast_furnace` / `smoker` stack | kiln / smelter wall | 3 stacked in a stone alcove, chest and barrel beside | DB B4 mine hall (M72) | DB/f_267, DB/f_268 | DB | COMPOSITION |
| CT10 | `lectern` + `candle` | reading desk with a book, candle beside | on a counter block against the wall | DB B2 library and attic (M73) | DB/f_128, DB/f_117, DB/f_132 | DB | COMPOSITION (near-original) |
| CT11 | `crafting_table`, `smithing_table ?`, `grindstone`, `chest`, `blast_furnace ?` | workbench counter run | in a row along a wall | DB B6 (M75) | DB/f_409, DB/f_412 | DB | COMPOSITION (near-original) |
| CT12 | `anvil` + `lantern` | side table with lamp | lantern placed on top of the anvil | DB B6 (M75) | DB/f_408 | DB | COMPOSITION |

## Leaves, plants and flowers

| ID | block + state | used as | how placed (facing / half / open / position) | context | frames | reels | label |
|---|---|---|---|---|---|---|---|
| PL01 | `spruce_leaves`; FM `oak_leaves` | clipped hedge; hedge maze | 1-thick ring or double row, 1-3 high; FM solid leaf walls in a pattern | hib plots, terrace, court; FM gardens (M59) | hib/f_088, hib/f_092, FM/f_120 | hib, FM | SHAPE (`walls` with a leaf block) |
| PL02 | `spruce_leaves` | tiered Christmas tree | 3 stacked discs, candles on top, trunk visible between tiers | hib front court (M60) | hib/f_081, hib/f_083, hib/f_086 | hib | PARAM / COMPOSITION |
| PL03 | `oak_leaves[persistent=true]` / `azalea_leaves ?` | bush in a planter trough | fills the trough, bulges above | NS window box (M07) | NS/f_062, NS/f_066, NS/f_078 | NS | COMPOSITION |
| PL04 | leaves + `vine` | willow hair | leaf shell, vines hanging from the rim | DB B10 (M61) | DB/f_474, DB/f_481 | DB | NEW SHAPE (canopy), low priority |
| PL05 | `flower_pot` (white flowers; `potted_oxeye_daisy` / `azure_bluet` / `lily_of_the_valley ?`); `decorated_pot ?` / red pot | window-sill planter; door planter; counter mug | on a ledge, 3 pots per window with a lantern between (GS); pot on a 1-2 block stone stub (hib); on a stone-brick slab sill beside a `zombie_head` (GV); on the counter beside the basin (DB) | GS sills; hib porch; GV; DB B6 (M07) | GS/f_066, hib/f_042, GV/f_055 | GS, hib, GV, DB (f_406, f_408) | COMPOSITION |
| PL06 | `rose_bush` | foundation flower bed | row of 4-5 at the foot of the glass slits; pair at stair corners | hib front facade and terrace (M69) | hib/f_026, hib/f_042, hib/f_090 | hib | COMPOSITION |
| PL07 | `mossy_stone_bricks` + `vine`; `mossy_cobblestone`, `vine`, `moss_carpet ?`; speckled patches of different stone | aged pier base, ivy, rock ageing | patches on lower piers, vines hanging down the face; scattered patches on rock faces and ledges | DB B1 arcade; dio pit walls; trixy ruin; heavy shaft (f_004) (M56) | DB/f_043, dio/q04, trixy/f_031 | DB, dio, trixy, heavy | COMPOSITION (`patches()` material) |
| PL08 | leaf columns | cypress / topiary along the fence line | tall single columns (INF) | FM gardens (M62) | FM/f_105, FM/f_113 | FM | COMPOSITION |

## Campfire, candles, lanterns and light

| ID | block + state | used as | how placed (facing / half / open / position) | context | frames | reels | label |
|---|---|---|---|---|---|---|---|
| LT01 | `lantern[hanging=true]` | eave, beam-end and pendant light | hung under a brim at corners and over openings (alixxa); under a protruding log beam stub beside the post (GS); under a pergola beam (NS); under a small plank / slab hanger (DB); under knee-brace stairs (DB) | alixxa skirt roof; GS corners; NS pergola; DB ceilings (M63) | alixxa/f_016, GS/f_024, DB/f_071 | alixxa, GS, NS (f_137), DB | COMPOSITION |
| LT02 | `lantern` (standing) | table, sill and post lamp | on top of a barrel, anvil, counter, wall post, fence stub or a sill between pots | DB alcove and kitchen; GS sill; hib door flanks; tav upper window (M63, M64) | DB/f_267, GS/f_066, hib/f_011 | DB, GS, hib, tav (f_013) | COMPOSITION |
| LT03 | `campfire[lit=true]` | chimney smoke source | atop a stone / brick / calcite pillar on the roof or against a wall, optionally inside an open box of 3 `oak_trapdoor[open=true]` | GS, NS, AR, GV chimneys (M67) | GS/f_070, NS/f_117, AR/f_152 | GS, NS, AR, GV (f_057) | COMPOSITION |
| LT04 | `campfire[lit=true]` buried in the bank | mist / smoke column rising through bamboo | set into a pit at the pond rim, nothing above it (the mist intent is INF) | DB B3 pond (M67) | DB/f_176, DB/f_177 | DB | COMPOSITION |
| LT05 | `candle` (mixed colours), `white_candle[lit=true]` | fairy lights on leaves; wares; table candle | 1-3 per leaf block on top faces, white ones lit and tall (support method unresolved); on counters; FM table (INF) | hib hedges and tree; DB stalls and library (M59, M60, M71) | hib/f_081, hib/f_086, DB/f_519 | hib, DB, FM (INF) | COMPOSITION |
| LT06 | `iron_chain` + wood frame + `candle` / torch ? | chandelier | hung from the vault | trixy nave (M78) | trixy/f_022, trixy/f_023 | trixy | COMPOSITION, low |
| LT07 | small red / orange blocks (ID unknown) on a white railing | terrace lanterns | at intervals on the rail | jp terrace | jp/f_027, jp/f_035 | jp (sheet-level) | COMPOSITION, low |

## Banner, carpet, wool and bed

| ID | block + state | used as | how placed (facing / half / open / position) | context | frames | reels | label |
|---|---|---|---|---|---|---|---|
| BW01 | `red_banner` (straight-cross pattern) | window curtain / shutter | hung in an open window slot, 2 per gable | hib upper windows (M69) | hib/f_018, hib/f_048, hib/f_081 | hib | COMPOSITION |
| BW02 | `white_wool` + `moss_block ?` / `green_wool ?` stripes | stall awning cloth | alternating columns under a slanted stair canopy | DB B13 (M71) | DB/f_517, DB/f_519, DB/f_506 | DB | COMPOSITION |
| BW03 | `?_bed ?` or `blue_wool` / `white_wool` strip | counter cloth with wares | on top of the counter | DB B13 (M71) | DB/f_516, DB/f_519 | DB | COMPOSITION (bed vs wool unresolved) |
| BW04 | `red_carpet` | corridor runner with rounded ends | floor decoration in 3 corridor segments | hib interior (M78) | hib/f_065 | hib | COMPOSITION, near-original |

## Redstone and misc

No lever was reported by any reader. Item frame: only an unresolved candidate (RM12).

| ID | block + state | used as | how placed (facing / half / open / position) | context | frames | reels | label |
|---|---|---|---|---|---|---|---|
| RM01 | `tripwire_hook` on a wall block | faucet / tap | hook mounted over the basin | DB B6 kitchen (M75) | DB/f_406, DB/f_408 | DB | COMPOSITION |
| RM02 | `?_button` / dark recessed plate (`polished_blackstone_button ?`) | rivet / knot detail on the top beam | single small plate centred on the beam face | DB B3 torii (M68) | DB/f_156, DB/f_161 | DB | COMPOSITION, low (block unsure) |
| RM03 | `nether_portal` | glowing violet veil inside a gate | between the two pillars, frame hidden | DB B3 torii (M68) | DB/f_144, DB/f_153, DB/f_162 | DB | COMPOSITION |
| RM04 | `powered_rail` (gold, unpowered), `activator_rail` (red stripe) | decorative cart-track loop and sidings | flat loop in the courtyard, branches to the adit; ascending rail on the stair shaft | DB B4 yard and adit (M72) | DB/f_276, DB/f_262, DB/f_270 | DB | COMPOSITION; ascending rail BLOCKED (states not visible) |
| RM05 | `chest_minecart` / `minecart` (entities) | cargo props on the rails | on rail cells | DB B4 yard (M72) | DB/f_282, DB/f_290, DB/f_294 | DB | COMPOSITION |
| RM06 | `ladder` | library ladder; slit mullion; tower access | on the bookshelf face, full height; in a 1-wide slit as an alternative to a trapdoor stack (AR, uncertain); vertical in a 1-wide wall shaft behind a door | DB B2 library, B4 towers; AR slits (M73, M06, M72) | DB/f_104, DB/f_233, AR/f_049 | DB, AR | COMPOSITION |
| RM07 | `bell ?` (dark, hung); alt `hopper ?` / `cauldron ?` | bell under the well roof | chain from a trapdoor / fence frame under the ceiling | DB B11 (M46) | DB/f_490, DB/f_494, DB/f_499 | DB | COMPOSITION (colour is dark grey, not gold) |
| RM08 | `zombie_head` | sill decoration | next to a flower pot | GV sill | GV/f_055 | GV | COMPOSITION |
| RM09 | `coal_ore`, `iron_ore` | ore pile as mine dressing | single blocks stacked or scattered at the yard edge and the adit | DB B4 (M72) | DB/f_259, DB/f_285, DB/f_298 | DB | COMPOSITION |
| RM10 | `amethyst_cluster`, `candle`, `lantern`, `flower_pot` | stall wares | on the counter | DB B13 (M71) | DB/f_517, DB/f_519 | DB | COMPOSITION |
| RM11 | `cobweb` | neglect / decay dressing | in the corners and across the room | DB B2 attic (M77) | DB/f_131, DB/f_136, DB/f_140 | DB | COMPOSITION |
| RM12 | `?` green item in the tower window (item frame ? / `lectern ?`) | window dressing | 1x1 window above the porch | DB B15 | DB/f_550 | DB | BLOCKED (identity unresolved) |
| RM13 | `?_boat` (entity) | moored boats | on water cells beside the planks | DB B5, B6 (M51) | DB/f_328, DB/f_345, DB/f_390 | DB | COMPOSITION |
| RM14 | armour-stand / villager figure (entity) | the prisoner | standing under the chain | DB B14 (M46) | DB/f_531, DB/f_533 | DB | BLOCKED (not a block) |
| RM15 | `hay_block ?`, `raw_copper_block ?`, `calcite ?` / `diorite ?` / `smooth_quartz ?` | stock and spoil piles | stacked cubes at the rim and the yard | dio quarry rim | dio/q01, dio/q06 | dio | COMPOSITION, low |

## Other

| ID | block + state | used as | how placed (facing / half / open / position) | context | frames | reels | label |
|---|---|---|---|---|---|---|---|
| OT01 | `oxidized_cut_copper*` ? (alt `dark_prismarine*`, `warped_*`) | torii roof tile cap | stairs / slabs / block rows alternating with terracotta caps | DB B3 (M68) | DB/f_156, DB/f_157, DB/f_161 | DB | SHAPE / COMPOSITION |
| OT02 | `chiseled_tuff ?` / `chiseled_tuff_bricks ?`; `tuff ?` | frieze band, Greek-key motif; contrasting patches | one course, repeated key motif; irregular patches | niitty wall close-up | niitty/f_010 | niitty | COMPOSITION |
| OT03 | `chiseled_polished_blackstone` | bay keystone and footstone | top-centre and bottom-centre of each bay | pillar 115561 (M14) | pillar/115561_0_vzlr | pillar | COMPOSITION |
| OT04 | `sculk` / `moss_block` / `polished_blackstone_bricks` | backdrop wall fill | full wall behind the pillars | pillar 115561, 115562, 115564 (M14) | pillar/115561_0_vzlr, pillar/115562_1_l24q, pillar/115564_3_ck17 | pillar | COMPOSITION |
| OT05 | white blocks in lines on grass; marker blocks | footprint stake-out | nested outline loops (jp); marker blocks then a ring (hib); grey corner markers (NS) | jp plan; hib; NS (M48) | jp/f_009, hib/f_001, NS/f_011 | jp, hib, NS | COMPOSITION |
| OT06 | white wall with dark tile cap and a red stripe | courtyard enclosure | long run, tile cap overhanging | jp (sheet-level, M20) | jp/f_015, jp/f_016, jp/f_063 | jp | COMPOSITION, low |
| OT07 | purple `stained_glass` discs | energy beam | stacked discs shrinking downward | niitty (M40) | niitty/f_006, niitty/f_007, niitty/f_008 | niitty | SHAPE (`cylinder` stack) |
| OT08 | stone blocks stepped on a diagonal | stepped gable edge | 1 block per course | tall (sheet-level, M30) | tall/f_010, tall/f_011 | tall | BLOCKED |
| OT09 | timber posts + diagonal braces (red-brown wood) | half-timber facade | vertical posts, diagonals | tall tower (sheet-level, M11) | tall/f_006, tall/f_012 | tall | COMPOSITION, low |
| OT10 | white `glass` / `white_stained_glass` (+ panes) | tall lancet windows with a lead-line grid | full height inside stair-framed openings | trixy nave (M03) | trixy/f_008, trixy/f_010, trixy/f_019 | trixy | COMPOSITION |

## Top 15 repurposes an agent should know first

Ranked by the number of distinct reels in which any reader reported the pattern (union over the listed rows). Ties are ordered by how many builds or rows show it. "INF" counts are reels where the reader only inferred the block state; they are still counted but noted. A pattern here can span several table rows, which are listed.

| Rank | Repurpose (pattern) | Rows | Reels (count) | One-line placement rule from the evidence | Label |
|---|---|---|---|---|---|
| 1 | **Upside-down stairs** (`stairs[half=top]`) as corbel, bracket, arch haunch, chamfer, stage foot | ST01-ST06, ST11, ST13, ST16 | 7: trixy, FM, DB, dio, AR, hib, heavy (all `half` values INF except AR) | Under an overhang or at the two upper corners of an opening, one step per 1 across / 1 up; facing toward the opening or outward under a projecting block | NEW SHAPE (arch, parapet, jetty) / COMPOSITION |
| 2 | **Lantern** (hanging or standing) as the light for any non-light block | LT01, LT02, FW02, CT05, CT12 | 6: alixxa, GS, NS, DB, hib, tav | `lantern[hanging=true]` under brims, beams and beam stubs; standing on barrel, anvil, wall post, fence stub, sill | COMPOSITION |
| 3 | **End-grain log** as nail-head square, corner cap, beam stub, bracket | LG01, LG02, LG03, LG05 | 6: hib, GS, NS, AR, GV, tav | Choose the log `axis` so the ring face points out of the wall or up; stub 1 block out at corners and mid-side | COMPOSITION |
| 4 | **Slab** as lintel, sill, string course, arch crown, post cap, pergola rafter | SL01-SL08 | 6 firm: trixy, DB, GV, NS, heavy, AR [+ tav, FM INF] | `type=top` for lintel / sill / string course; `type=bottom` for an arch crown; gaps of 1 between pergola rafters | SHAPE / COMPOSITION |
| 5 | **Trapdoor trough** as planter / flower box | TD02 | 5: alixxa, NS, DB, hib, tav | 3 trapdoors as front board, 2 as ends, leaves or flowers inside; under a window sill or beside a door | COMPOSITION (sub T7 for window boxes) |
| 6 | **Campfire** as chimney smoke (or buried for mist) | LT03, LT04 | 5: GS, NS, AR, GV, DB | `campfire[lit=true]` on top of a pillar or shaft on the roof; DB buried one in a pit with nothing above | COMPOSITION |
| 7 | **Barrel** as post foot, porch corner, bollard, table, bin, counter | CT01-CT07 | 5: hib, tav, NS, DB, dio | `barrel[facing=up]` under a post or on a corner; side-facing barrels as a counter row | COMPOSITION |
| 8 | **Open trapdoor** as window furniture (awning, mullion, shutter, glassless fill) | TD01, TD03, TD04, TD10 | 5: alixxa, AR, GS, DB, tav (tav INF) | `open=true`; awning 1 block out above a slit; 2 stacked per side as shutters; slats in a stone niche | COMPOSITION |
| 9 | **Leaf blocks** as built structure (hedge ring, maze, tiered tree, planter bush, willow) | PL01-PL04, PL08 | 4: hib, FM, NS, DB | 1-thick ring or double row for hedges; stacked discs for a tree; `oak_leaves[persistent=true]` for a planter bush | SHAPE (`walls`) / PARAM / COMPOSITION |
| 10 | **Moss, vine and speckled stone** as ageing patches | PL07 | 4: DB, dio, trixy, heavy | Patches low on piers and rock faces, vines hanging down; use the `patches()` material | COMPOSITION |
| 11 | **`flower_pot`** as sill planter, door planter, counter mug | PL05 | 4: GS, hib, GV, DB | 3 pots per window with a lantern between; pot on a 1-2 block stub beside a door | COMPOSITION |
| 12 | **Open trapdoor** as a flush panel (beam-end plate, post-foot rib, wainscot, balustrade infill, cabinet front, pillar ornament) | TD05-TD08, TD11-TD13 | 3: DB (many builds), hib, pillar [+ trixy low] | `open=true` flat against the end or outer face of a beam, post foot or wall; one per post position | COMPOSITION |
| 13 | **Wall / fence post + lantern** as lamp post, gate lamp, tōrō | FW02 | 3: alixxa, DB, hib | Wall stub or slab base, fence post, lantern on top; at corners, gates and door flanks | COMPOSITION |
| 14 | **Fence-post stack** as finial / spire pin | FW03 | 3: alixxa, AR, FM (block unresolved) | 1x1 post on a 1x1 column, about 3-5 blocks | PARAM (cap) / COMPOSITION |
| 15 | **Chain** as cable, rope, hanger, hoist, finial | FW09 | 3: dio, DB, niitty [+ trixy chandelier, low] | Vertical `chain` / `iron_chain[axis=y]` from a beam or jib to the hanging object | SHAPE (`line`) / COMPOSITION |

Just below the cut, also at 3 reels: candles as fairy lights, wares or table candle (LT05: hib, DB, FM INF); deliberate gaps in a course as dentil or oculus (LG08, LG09, ST13: alixxa, GV, trixy).

## Unresolved block identities (carried from the readers)

- Wood species of nearly every trapdoor, stair and plank under shader tint (alixxa, trixy, niitty, FM, NS, all DB): all `?`.
- The pillar-frame "3-slot panel" and "2x2 window" blocks, and the wood of pillar 115563.
- The DB hanging 3-wide cabinet unit (TD20), the dark hanging object in the DB well (RM07), the green item in the B15 window (RM12), the torii tile cap and socket cubes (OT01), and the DB cloth strips (bed vs wool, BW03).
- The AR slit contents (trapdoor stack vs `ladder`), the finial pin (`oak_fence ?` vs `lightning_rod ?`), the dark and white bricks in AR and GV, and the cream FM block.
- Whether the NS foundation course is barrels or banded logs; how candles are held on hib leaf tops.
