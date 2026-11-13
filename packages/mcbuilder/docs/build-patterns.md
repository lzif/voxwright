# Minecraft Build Techniques — reference for mcbuilder designs

Techniques, not templates. The examples below come from house builds, but
every technique transfers to any archetype — underwater, fantasy, modern,
whatever. Take the *technique*, not the house shape. (This doc exists because
the tavern race verdict was "too flat, ugly walls" vs "weird dirt +
glowstone walls" — both failures of technique, not of archetype.)

## Sources

- **Gorillo — "Spruce House"** (facebook.com/reel/934228385908675). Video:
  `~/workspace/gorillo-spruce-house.mp4`, frames in
  `~/workspace/gorillo-spruce-frames/`.
- **Gorillo — "Survival House"** (facebook.com/reel/29099377519750505).
  Video: `~/workspace/gorillo-survival-house.mp4`, frames in
  `~/workspace/gorillo-frames/`.
- **Noes Crafts** — "Easy starter house" reel
  (facebook.com/reel/973091725433026). Video:
  `~/workspace/noes-starter-house.mp4`, frames in `~/workspace/noes-frames/`.
- **Dio Rods** (facebook.com/61581945221503, patreon.com/diorods) —
  "Waterfall Quarry Survival Base" diorama: waterfall quarry pit + windmill,
  stone workshop, lodgings, bridge, minecart rails, flooded quarry, big
  crane, ore crushing building, amethyst mine, storage attic, warehouse.
  Labeled-zone diorama style. Photo post — material-level pattern
  extraction pending screenshots (post description was read; the photo set
  itself is not downloadable — all routes checked 2026-10-11: Patreon
  paywalled, no YouTube/PlanetMinecraft version, mbasic photos tab
  login-walled, image search only returned mismatches).
- **Hibouk — "Winter Mansion"** (facebook.com/reel/1350579046560990).
  Video: `~/workspace/hibouk-winter-mansion.mp4`, frames in
  `~/workspace/hibouk-frames/`, technique notes in
  `~/workspace/hibouk-patterns.md`. Confirmed palette: spruce leaves/planks,
  stripped spruce logs, deepslate tile stairs, stone bricks, andesite, dirt
  path, glass panes.
- **Arashy12 — "Best Medieval House"** (facebook.com/reel/2585730168544976).
  Video: `~/workspace/arashy12-medieval-house.mp4`.
  Compact two-story Tudor: dark oak timber frame with white infill,
  jettied upper floor over crenellated stone base, cross-gabled deepslate
  roof, X-braced gable ends, trapdoor window shutters + flower boxes,
  brick chimney with lantern, hanging lanterns at corners. Mostly confirms
  techniques 2/4/5/6/7; new details folded in below.
- **Medieval manor NBT** (`~/workspace/user/files/medieval-house_0_dpg1.nbt`,
  analyzed 2026-10-16: 46×29×38, ~10k blocks). Large timber-framed manor/inn:
  calcite walls + stripped spruce/dark oak frame, stone ground floor,
  cross-gabled two-tone roof, 8 chimneys in symmetric pairs, 102 hanging
  lanterns, inn-scale lived-in interior (36 beds, red carpet runners,
  bookshelves, barrels). Confirms techniques 1/2/4/5/6/7/10; new details
  folded in below (tagged "Manor NBT").
- **Pinterest interior board** (nwcain42 "Minecraft interior design ideas",
  88 pins; 22 sampled 2026-10-16 — login wall blocked the rest). Interior
  technique reference: pendant lamps, ceiling beams, trapdoor cabinet doors,
  stair shelves, carpet rug zoning, recessed niches, fireplace anchors,
  modular stair sofas, hidden storage, monochrome palettes. Folded into
  techniques 6/7 (tagged "Interior board").
- **Four small-house renders** (sent by Luki 2026-10-21: desert house, wheat
  farmhouse, hillside cottage, stone tower — stylized renders, not
  block-for-block schematics). Block reads are flagged interpretive where
  uncertain; only constructions validated against real-builder practice
  were kept. Folded into the techniques below (tagged "provisional —
  stylized render").
- **Tudor townhouse render** (sent by Luki 2026-10-21:
  `~/workspace/user/files/112301_0_1h6o.jpg` — tall narrow timber-framed
  townhouse: stacked jetties, red tile roof with a ridge belvedere, open
  undercroft ground story, projecting balconies; stylized render, not a
  block-for-block schematic). Block reads are flagged interpretive where
  uncertain; only constructions validated against real-builder practice
  were kept. Folded into the techniques below (tagged "provisional —
  stylized render").
- **disruptive builds — "14+ Build Projects for Survival Minecraft 1.19"**
  (facebook.com/reel/1417564603818403, 2026-10-17). Video:
  `~/workspace/disruptive-reel/disruptive-builds-14-projects.mp4`, frames in
  `~/workspace/disruptive-reel/frames/`, build ideas in
  `~/workspace/disruptive-reel/ideas.md`. 14 builds: medieval dam, grand
  library, torii gate portal, mining outpost, fishing dock, ultimate fishing
  dock, town pond, town fountain, gazebo, custom tree, well, statue+garden
  (idea-only, no patterns extracted), town market, bell tower. All frames
  are real build footage — no "provisional" tags needed.
- **Life Laps — "Minecraft French Mansion"** (facebook.com/reel/1870205401068613,
  2026-10-24). Video: `~/workspace/french-mansion-reel/french-mansion.mp4`,
  dense frames in `~/workspace/french-mansion-reel/frames-1fps/` (136 frames,
  1fps; the original 8-frame set in `frames/` kept as audit trail). Large
  3-story formal mansion — pale cream walls, stone base, dark mansard roof —
  with formal grounds (parterre, fountain court, hedge maze, balustrade
  forecourt) and an indoor orangery.
- **OMGGamer — "Minecraft Heavy Tower Build"** (facebook.com/reel/3608328832656402,
  2026-09-09). Video: `~/workspace/heavy-tower-reel/heavy-tower.mp4`, dense
  frames in `~/workspace/heavy-tower-reel/frames-1fps/` (19 frames, 1fps).
  Massive square stone-brick fortress tower: 3 stepped stages + a very tall
  dark spire, ornament concentrated at stage transitions and the crown.
- **Life Laps — "Minecraft Tall Fantasy Mansion"**
  (facebook.com/reel/2611890512570661, 2026-11-06). Video:
  `~/workspace/tall-mansion-reel/tall-mansion.mp4`, 12 frames at 1fps in
  `~/workspace/tall-mansion-reel/frames-1fps/`, pattern draft in
  `~/workspace/tall-mansion-reel/stage1/01-tall-mansion.md`, build-step
  reconstruction in `~/workspace/tall-mansion-reel/stage1/02-build-steps.md`,
  roast synthesis in `~/workspace/tall-mansion-reel/roast/SYNTHESIS.md`
  (9 KEEP / 31 PIVOT / 2 KILL, 4 fresh-context review rounds, final
  round CLEAN). Tall narrow tower (~20–21, 4 stories) beside a lower
  steep-roofed wing on flat grass: stone-brick walls + dark-oak timber
  framing, terracotta trim, dark-slate roofs. A 12-second construction
  timelapse — no interior shots, no dusk showcase, so interior and
  lighting claims are out of scope. Folded 2026-11-07 (Luki lock tap):
  technique 40 (porch as mini stepped-gable pavilion), technique 41
  (stepped east-face profile), sub-entries under techniques 1/2/4/7.
- **Blockical Blockical — "Minecraft Japanese House"**
  (facebook.com/reel/2056393101686528, 2026-09-27). Video:
  `~/workspace/japanese-house-reel/japanese-house.mp4`, dense frames in
  `~/workspace/japanese-house-reel/frames-1fps/` (68 frames, 1fps). Walled
  Japanese estate compound — perimeter wall + gatehouse, two-story main
  hall, twin vermillion side halls, tile-and-sand courtyard, front garden.

## Scale-band gating — read this before applying any technique

A technique distilled from a mega-scale reel does not survive contact with a
mini-scale grid. Voxel quantization eats it: two 1-block tier setbacks and a
pair of 1-wide slits on a 9-wide shaft are not "the same recipe, smaller" —
they are a wedding cake with googly eyes. So every technique below carries a
minimum footprint span, and mini-scale builds obey the substitutions and bans
in this section. The bands:

- **mini (≤9)** — single small buildings and narrow towers. Only mini-band
  techniques apply as written.
- **mid (10–19)** — houses and compounds with grounds. Mini techniques apply;
  mid techniques apply as written.
- **mega (20+)** — estates, fortresses, formal grounds. All techniques apply.

Span is the width of the element the technique applies to: face width for
face techniques (slit pairs, galleries), footprint span for whole-build
techniques. A rectangular footprint is banded per face — a 30×8 longhouse
is mega on its 30-wide long faces and mini on its 8-wide gable ends, so
the same technique can apply as written on one face and need its mini
substitute on the other. Height counts for vertical techniques (staging,
spire taper, crown): a build much taller than its footprint is banded by
height, not footprint — a 9×9×40 spire stages like a tall build, while a
9×9×4 hut is mini. The audit lints judge the same way: wedding-cake
rhythm runs on the main mass, pareidolia per face width, dark-lump on
the spire (see the GUIDE lint reference).

Band table (minimum footprint span per technique):

| # | Technique | Band | Mini-scale note |
|---|-----------|------|-----------------|
| 1 | Material variation | mini | Surface rule; applies at all scales. |
| 2 | Skeleton-first framing | mini | Method, not a feature; applies at all scales. |
| 3 | Horizontal breaks | mini | Applies at all scales. |
| 4 | Silhouette discipline | mini | Applies at all scales. |
| 5 | Ground connection | mini | Applies at all scales. |
| 6 | Lighting rhythm | mini | Applies at all scales. |
| 7 | Detail & props | mini | Applies at all scales. |
| 8 | Siting | mid | Needs grounds to lay out; on a mini plot, use only the spot-pick, not the axis/plot geometry. |
| 9 | Diorama composition | mega | Anchors on a terrain feature, not a footprint. |
| 10 | Theme anchors | mid | Needs a build big enough for one anchor + simple rest. |
| 11 | Stage the arrival | mid | Needs path length for the 4-placement sequence. |
| 12 | Pergola shade structures | mini | Small structure; applies as written. |
| 13 | Tall-narrow stacking discipline | mini | Narrow specialist (≤6×6, ≥3 stories). |
| 14 | Working openings | mini | A 2–3-wide slot fits any wall ≥5 wide. |
| 15 | Stair-block masonry arches | mini | A 3-wide opening fits a mini wall. |
| 16 | Bamboo screens | mid | Needs room to enclose an outdoor room. |
| 17 | Bridge anatomy | mid | Needs span length + both landings. |
| 18 | Custom trees | mini | Single tree; applies as written. |
| 19 | Hoist grammar | mini | Single well; applies as written. |
| 20 | Boat mooring | mini | Pier feature; applies as written. |
| 21 | Activity ledges | mini | Pier feature; applies as written. |
| 22 | Under-deck dressing | mini | Pier feature; applies as written. |
| 23 | Market stall module | mini | 3×3 footprint by definition. |
| 24 | Repeat-with-variation expansion | mini | Meta-technique; applies at all scales. |
| 25 | Open belfry crown | mini | Tower-top specialist; works on narrow shafts. |
| 26 | Mansard roof with dormers | mid | Needs a box wide enough for dormers + flat top deck; mini houses use a plain dark stair slope, not the full mansard + dormer set. |
| 27 | Central pedimented pavilion + grand stair | mega | Needs a wide facade for the projecting middle bay + grand stair. |
| 28 | Hedge maze garden | mega | Needs a large flat garden area. |
| 29 | White balustrade boundary + gate piers | mid | Needs a grounds perimeter to bound. |
| 30 | Indoor orangery | mid | Needs a full room to invert. |
| 31 | Outline-first layout | mid | Whole-plan drawing; on a mini hut it collapses to technique 2's footprint marking. |
| 32 | Machicolation gallery band | mid | Needs face width for projection + openings; mini substitute: recessed band / corbelled trim, no projecting gallery. |
| 33 | Stepped tower staging | mega | Needs width for multiple discrete stages; mini substitute below. |
| 34 | Stepped dark spire with accent + finial | mid | Needs spire width >7 for the dark stepped taper to read; mini substitute below. |
| 35 | Paired slit window grid | mid | Needs face width ≥11 for slit pairs + spacing; mini substitute below. |
| 36 | East-Asian tiled roof grammar | mid | Needs roof span for the eave stack + swept corners; mini pavilions use a simplified sweep (single stair step up at corners, not the full stack). |
| 37 | Roofed compound wall + gatehouse pavilion | mega | Perimeter architecture; needs a compound to bound. |
| 38 | Vermillion pavilion pair | mega | Needs a compound + two flanking halls. |
| 39 | Tile-and-sand courtyard grid | mid | Needs a courtyard large enough for a grid of sand rectangles. |
| 40 | Porch as mini stepped-gable pavilion | mini | Porch ~6 wide; a mass, not a shade plane — needs columns + canopy + stair platform as one unit. |
| 41 | Stepped east-face profile | mini | Volume transition on a tall face; needs a tall volume stepping down to a lower roof. |

Mini-scale substitutions (mandatory below span 11 — do not scale the mega
recipe down, replace it):

- **Tier setbacks → silhouette tapers.** Below span 11, never narrow a tower
  in discrete 1-block stages (technique 33). Taper the silhouette with
  wall/stair/trapdoor elements instead: a stair-block cornice step, a
  trapdoor frieze, or a wall-height change that reads as a taper without
  shrinking the footprint.
- **Slit pairs → single/asymmetric lancets.** Below span 11, never place a
  symmetric pair of 1-wide slits (technique 35). Use one slit, off-center,
  or a single centered slit — asymmetry reads as intentional, symmetry at
  1-block resolution reads as a face.
- **Mono-dark stepped spires → high-contrast spire ribs.** On spires ≤7
  wide, never build a mono-dark stepped taper (technique 34). Run
  alternating pale/dark vertical ribs up the spire instead, so the spire
  reads by contrast, not by bulk.

Flagged by the `mcbuild` audit lints (warnings in `report.json`, never
errors — a flagged build still exports; see the GUIDE lint reference for
every code, its fix hint, and its exit-code semantics):

- **Flagged at mini:** twin symmetric 1-wide slits on any face ≤10 wide
  (pareidolia flag). The lint fires at ≤10 to match "below span 11";
  trimmed pairs (structured frame around both slits), door pairs
  (floor-sitting 2-high openings, 1–2 wide, at any height), top-course
  notches (merlon gaps: no solid anywhere above in the face plane),
  and faces wider than 10 do not flag.
- **Flagged at mini:** mono-dark spires ≤7 wide (dark-lump flag: mean
  luminance of the spire below 0.35, not variance — a bright uniform
  spire does not read as a dark lump and does not flag).
- **Flagged at mini:** repeated 1-block tier setbacks below span 11
  (wedding-cake flag: RHYTHM — three or more consecutive box-like
  setbacks on the main mass). Single setbacks, pointy pyramids
  (apex ≤3), taper-like stepped spires, ziggurats, two-story towers,
  corbelled trim, finials, and mega staging do NOT flag; the lint
  measures rhythm, not any setback. Documented overlap: a uniform
  stepped pyramid with a flat top ≥4 wide is silhouette-identical to
  a wedding-cake shaft and MAY flag as a minor warning — ignore it
  when the shape is intentionally a pyramid or ziggurat.
- **Flagged anywhere:** unbacked apertures (see-through parapet gaps,
  corner gaps, and unfloored pairs) and see-through pairs over a
  floored interior (THROUGH_HOLE). A parapet gap is clean when a solid
  deck or plate sits under it, or when it is a top-course notch over a
  floored interior (a castle top over a room — notches are exempt from
  the pair check); a parapet gap over a hollow shaft still flags
  UNBACKED; a window pair over a floored room is a see-through pair
  by construction.

What the lints do NOT do: they flag defect patterns, they do not enforce
every substitution above — a mini build that ignores a substitution
without tripping a lint pattern is still a design defect, just not a
linted one. And the lints never block export: a mega/mid technique
applied at mini scale without its listed substitution is a defect, not
a compromise — the audit lints will say so, and the build still ships.

## Staged build process — scope (locked 2026-11-07)

The locked staged process (2026-11-01) is: footprint/grid → signature
element alone → skeleton → shell (plain walls, windows, roof) → exterior
detail → interior (only after the shell is closed) → transformation/ruin
as a separate pass → landscape last, each stage with its own preview and
checkpoint, next stage only after the previous passes. It was generalized
from ONE reel (TrixyBlox Ruined Temple — a single-volume build whose
entire identity IS the signature). The Tall Fantasy Mansion reel
(2026-11-06) is the second data point on macro-order, and it contradicts
the locked macro-order at every joint — so the process is scoped, not
rewritten:

- **Stage discipline applies per volume; signature-first applies when
  the build's identity is a single volume.** Inside each volume the
  discipline holds (walls → deck → upper walls → roof frame → slate;
  tower bottom-up in stages). Across volumes the builder's own order
  governs: in the reel the ordinary wing is shelled first and the tower
  only starts at step 5, the porch is built during the shell, hedges go
  in as columns rise, and the tower is crowned last.
- **Wing-first is the efficient order on multi-volume builds.** Building
  the ordinary volume first gives a standing work platform (the deck)
  and a visible proportion reference for the tall volume; signature-first
  on a ~20-block tower means working at height with no adjacent
  structure and choosing the tower's height before the wing exists to
  judge it against.
- **Floor + stairs early is access, not interior.** Lay the floor and
  the staircase while the front is still open, so the builder walks in
  and builds up from inside instead of pillaring on dirt outside — and
  leave the stairwell slot (~3–4 × 1, above the stair top) open in the
  deck, or the upper floors become unreachable from inside.
- **Lead wall:** raise ONE wall to full height first as a height and
  proportion reference — you set the tall volume's height with a
  reference wall, you do not need to build the whole signature first.
- **Porch classification:** a porch built during the shell counts as
  wing shell, not detail exterior — the deviation evaporates on
  classification, not on observation.
- **Landscape interleaved:** hedge blocks at column bases are column
  dressing as much as landscape, and go in as each column rises; they
  are not a "landscape last" violation.
- **Raise the roof-accent shaft with the roof frame** (before the slate
  fill), so its base is integrated — the reel builds it last, which
  means cutting into a finished roof if the base needs seating. (Tall
  Mansion ref: `stage1/02-build-steps.md`, steps 0–12, deviations
  D1–D5, verdict.)

## The techniques

### 1. Material variation — never flat
Every surface gets noise. A single material over a large area reads as
"polosan" (plain) no matter the shape.
- Noise the base: ~30% secondary mottled variant mixed in. (House example:
  white concrete + light gray concrete/calcite.) (Manor NBT example:
  stone ground floor measured at 247 stone bricks + 62 mossy + 46 cracked
  ≈ 30% — the rule holds empirically.)
- Band by section: different material per story or zone. (House example:
  stone ground floor + wood upper floor.) (Manor NBT example: stone ground
  floor + calcite+timber middle + dark roof, with a deepslate stair skirt
  as the transition course.)
- Two-tone edges: a light trim against a dark base, or vice versa. (House
  example: light stone trim along dark stair roofs.) (Manor NBT example:
  deepslate brick stairs intermixed with dark oak stairs across the whole
  roof — two-tone as deliberate striping, not a patch job.)
  - Terracotta trim system (accent-echo rule): one warm accent material
    used as trim in ≥3 places — roof edges, crown edges, porch canopy —
    never as a field. If the accent appears only once, it reads as a
    mistake; if it appears as a field (a whole slope or wall), it stops
    being trim. The full trim recipe (bargeboard stair course along each
    gable edge, eave fascia course under the lowest roof course) lives
    under technique 4's "Two-tone the roof" entry. (Tall Mansion ref:
    f_009/f_010 bargeboard + fascia; f_012 crown edges + porch canopy.)
- The deliberate patch: on small quiet walls too small for 30% mottling or
  story banding, one confident patch of strongly contrasting patterned
  block can stand in for variation — but it needs a *story*: a sign backing,
  a painted panel, or a visible repair. Recipe: ONE patch per facade, 2–4
  wide × 1–3 tall, aligned to an opening (below or beside a window is the
  canonical spot), placed asymmetrically, covering ≤15% of the wall face.
  A patch floating mid-wall with no story reads as a repair job — the same
  failure class as random dirt patches. Never on walls already using
  banding, framing, or heavy mottling: one variation language per wall.
  (Farmhouse ref: cyan glazed-terracotta patch — provisional — stylized
  render.)
- Weather by environment: where a structure touches water, stack 2–4 bands
  by wetness — wettest at the bottom (moss at/below the waterline, mossy
  stone brick mid-zone, cracked mix at the splash line, clean base above) —
  monotonic, with irregular 1-block-toothed edges, never a ruler-straight
  line. Keep the splash band tight: 2 blocks tall max on piles, fading to
  clean above. Guards: dry inland builds get none of this — weathering
  with no cause reads as random noise and breaks the rule above; and not
  on builds meant to read as newly built. (Disruptive builds ref: dam
  face, transcript-confirmed; fishing-dock waterline.)
- Two-tone canopy for depth: on leaf canopies wider than ~7 blocks, build
  each blob's inner ~60% from the darker leaf and skin the outer 1-block
  shell with the lighter leaf (on blobs <5 wide, noise ~30% darker leaves
  throughout instead). Never invert — light inside, dark outside reads as
  mold. (Disruptive builds ref: custom tree.)
- Material semantics by exposure: on exposed monumental builds, the
  exterior is 100% masonry — zero wood on the outside face, including trim,
  sills, and crowns (use stone stairs/slabs for all of them) — while timber
  is reserved for the sheltered interior structure, where its warmth is
  visible only at close range. Exposure decides the material, not taste.
  (Disruptive builds ref: bell tower — timber support frame inside the
  stone shaft.)
- Texture the path, not just the walls: any path ≥5 blocks long gets the
  same mottled mix on the ground plane (~30% secondary). (Disruptive
  builds ref: torii approach — narrated, not frame-visible.)

### 2. Skeleton-first framing
Pillars and beams define the silhouette; walls fill between them — never the
other way around.
- Mark the footprint before placing anything (house example: barrels at
  corners + path lines on the ground).
- An exposed frame IS decoration: beam/pillar joints are free detail —
  don't hide them. (House example: log-end spirals at every joint.)
  (Mansion example: chiseled spruce logs capping every post/beam joint like
  rivets — the frame reads as structure before any infill exists.)
- Jetty the upper floors (stacked corbels): let each story jut 1 block past
  the one below — the classic Tudor overhang, repeated per story so the wall
  steps outward as it rises. Construction: at every jetty line run a
  full-perimeter plate; under it a visible joist course — log ends or
  upside-down stairs every 1–2 blocks — so the overhang reads as structure,
  not magic; add knee brackets (diagonal stair blocks) at corners and
  mid-span to carry the eye from post to plate. Each overhang casts a real
  shadow line between stories and breaks the box silhouette with zero extra
  footprint. Guards: cap cumulative overhang at ~2 blocks per side — more
  and the wall looks drunk; beyond ~3 stacked jetties the silhouette
  inverts and the top reads heavier than the base. Pick one vertical rhythm
  per face: jetty lines XOR pilaster strips (technique 3) — pilasters get
  chopped into segments by jetty lines. (Mansion example: timber upper
  story over stone-brick ground floor — depth beats decoration. Tudor ref —
  provisional — stylized render.)
- X-brace the frame: on gable ends and wide wall sections, run diagonal
  beams forming X patterns between the posts. It turns structural framing
  into ornament — the classic Tudor read — for the cost of a few logs.
  (Arashy12 example: X-bracing on every gable end.)
- Frame-as-cladding (application note, not a new technique): the frame
  can be applied AFTER the walls are up, as cladding on a finished stone
  wall — which inverts this technique's core rule ("pillars and beams
  define the silhouette; walls fill between them"). Use it only on the
  hero face, on tall narrow volumes (≥4 stories) whose face would
  otherwise be a flat slab. Recipe: front face only (other faces plain
  stone, corner columns only), 3 vertical dark-oak log columns 1 block
  wide, full tower height, bays ~2–3 wide (face ~8 wide, applies ~7–11
  wide; below ~7 use corners-only, on ≥15-wide faces use pilasters,
  technique 3, instead), a 1-block-tall horizontal beam course at each
  floor line, a 1-block protruding joint block at each column/beam
  crossing (log end or chiseled log — stairs vs log ends not resolvable
  at this resolution; trapdoors read as shutters, not joints), infill
  stone brick, frame proud of the infill by exactly 1 block (flush reads
  as paint). One timber species only. Survival access: place the frame
  from a dirt-pillar or scaffold tower at each floor line; the wing deck
  is the work platform for the lower courses — build the wing first (see
  the staged-process scope note). Whether the columns rose with the walls
  or were applied after is UNRESOLVABLE at 1 fps — what is certain is
  that no frame-first skeleton pass is visible. (Tall Mansion ref:
  f_007 columns + floor beams + joint blocks mid-tower; f_012
  full-height frame on the finished tower.)
- Plate every floor line: run a full-perimeter horizontal beam course at
  each story division, posts standing on it above and below. The plates
  are the shadow lines that read as "floors" from outside. (Manor NBT
  example: full-perimeter stripped-log plates at two floor lines, ~40
  posts per level standing between them.)
- Run an attachment plate where things mount: set a beam course at exactly
  the height where porches, awnings, signs, and balconies attach — awning
  roofs butt against it, window lintels align to its underside — instead
  of floating add-ons at unrelated heights on bare wall. A plate with
  nothing mounted is just a stripe: mount something or skip it. (Stone
  tower ref.)
- Corners-only restraint on small builds: four proud corner posts + one
  plate under the eaves give the "structure" read on small pale-walled
  builds without full Tudor busywork. Hard guard: corners-only ONLY on
  walls ≤5 wide and single story — wider or taller walls graduate to full
  plates and X-bracing, or the frame reads as forgotten beams. (Hillside
  cottage ref — provisional — stylized render.)
  - Open-pavilion variant: on a roofless-sided pavilion the same four posts
    + full-perimeter eave plate is the *minimum* frame — the plate is the
    shadow line that says "roof sits on frame" (without it the roof
    floats). Posts 3–4 tall standing ON the platform, never on dirt; keep
    joints exposed. 3×3 to 5×5 post grids only — beyond that add interior
    posts or a center king post, or the plate sags visually. (Disruptive
    builds ref: gazebo.)

### 3. Horizontal breaks
Long vertical surfaces need interruption. Run trim bands — slab strips, a
material change, a ledge — between sections or at floor lines. They cast
shadow lines and kill monotony. (House example: stone-brick slab strip
between wall sections.)
- Zone materials by story: give each floor its own material family —
  stone-brick ground, timber upper, dark-tile roof — with no exceptions.
  The eye accepts large simple areas when they're clearly separated;
  flatness only looks bad when one material runs unbroken. (Mansion
  example: three strict horizontal bands.)
- Flare the eaves: between the top wall plate and the steep roof, run a
  course of bottom-half stairs as a skirt overhanging the walls by ~1
  block. It makes the roof feel heavy and seated instead of perched, and
  the stair texture doubles as a transition band. (Manor NBT example:
  deepslate stair skirt wider than the wall footprint on all sides.)
- Pilaster strips on plaster/stone boxes: where real timber framing would
  fight the archetype, fake the columnar rhythm with 1-wide vertical
  strips of contrasting material running floor-to-roof, spaced 3–4 blocks
  apart with strips always on the corners; window and door bays sit
  *between* the strips. Guards: walls ≥6 wide (narrower walls crowd the
  openings); keep strips flush with the wall — protruding columns become
  technique 2 posts instead; and one strong vertical per wall section —
  pilasters XOR a full-height ladder (technique 7), never both. (Stone
  tower ref: corner pilasters. Desert house ref — weak read, generic
  construction only — provisional — stylized render.)
  - Same-material variant: ribs in the same stone family as the wall,
    working as shadow lines rather than contrasting material — the rhythm
    still reads, the contrast comes from shadow, not color. (Heavy Tower
    ref: f0006, f0007.)

### 4. Silhouette discipline
Whatever the "top" of the archetype is, break its outline. Flat tops look
unfinished.
- Vary the roofline/skyline: dormers, chimneys, towers, spires.
  Cross-gable it: instead of one gable, intersect two or three gables at
  different orientations — each intersection is free silhouette complexity.
  (Arashy12 example: cross-gabled steep roof.) On flat roofs, a low open
  frame — log curb 1 block tall with trapdoors laid flat-open across it —
  reads as a roof hatch/skylight and gives a second silhouette line; it
  also terminates a full-height wall ladder (technique 7) so the ladder
  lands somewhere instead of nowhere. (Desert house ref — provisional —
  stylized render.)
- Overhang: the top extends past the walls (1+ block for houses).
- Flat roofs are allowed on small builds — but never bare: footprint ≤9×9,
  ≤2 stories, 1–2 block overhang, and a finished edge is MANDATORY (pick
  one): alternating slab heights around the rim, a darker fascia course, or
  rafter tails — dark log ends protruding exactly 1 block under the slab
  edge every 2 blocks. The 1-block cap is load-bearing: longer tails read
  as teeth, not trim. Skip tails entirely on builds <5 wide. (Farmhouse
  ref: rafter tails + fascia — provisional — stylized render. Hillside
  cottage ref: slab overhang roof with a deep shadow line — provisional —
  stylized render.)
- A chimney with campfire smoke, a crane, a spire — one vertical accent
  changes the whole read. Pair them: two chimneys flanking the ridge read
  as "manor", one reads as "house". Vary their heights — a short pair and
  a tall pair beats four identical stacks. (Manor NBT example: 8 brick
  chimney columns in symmetric pairs — short pair + tall pair flanking
  the ridge.)
  - Crane recipe (~30 blocks): tower of 5–7-high log pillars (2×2 or
    1×1 with cross-bracing fences), a 4–6-long jib stepped upward via
    stairs at ~30° from the top, a counter-jib with a crate (barrel/chest)
    as counterweight, and a chain or fence-link cable with a tripwire hook
    hanging from the jib tip. Set it back so the jib overhangs water, not
    the walkway. Permission: a non-functional machine is legitimate as
    pure sculpture IF it is themed and solitary — theme answers the "why
    is there a crane" objection, function doesn't need to. Two cranes read
    as a construction site. (Disruptive builds ref: ultimate fishing dock —
    transcript.) Small-build variant: on a low roof with no room for pairs,
  one 1×1 stack set 1–2 blocks off the roof centerline and behind the
  ridge, rising ≤4 blocks above the roof, capped with a slab and one pot;
  taller than that and it becomes an antenna. Guard: ONE chimney strategy
  per build — the oversized anchor (technique 10) XOR the restrained
  off-center stack — never both. (Hillside cottage ref — provisional —
  stylized render.)
  - Roof-accent shaft (sub-entry, not a standalone technique): a 2×2
    stone-brick shaft on a steep roof, ~5 blocks visible above the slope,
    with a white-barred opening on its front face (iron bars, 1 wide ×
    ~3 tall, centered) — NOT a chimney: no fireplace is visible anywhere,
    and chimneys do not have windows; it could be a stair turret, vent
    shaft, or dovecote. Terracotta cap course 2 tall, slightly wider than
    the shaft; dark stepped pyramid cap ~2–3 blocks (the cap IS technique
    34 at small scale); finial rod ~3 tall (iron bars — lightning rod
    untested, do not assert it). Keep it clearly shorter and thinner than
    the main tower — it is an echo, not a rival: the finial tip tops out
    at approximately the tower's eave level (~20–21 blocks above grade,
    ~3/4 of the tower's total height including the crown). Position: on
    the front slope just below the ridge, ~1/3 of the wing length from
    the tower (approximate); whether the base sits on the ridge or
    pierces the slope is UNRESOLVED — the base is hidden by the slope in
    every frame. Raise it with the roof frame, before the slate fill, so
    the base is integrated. One accent per roof plane besides the tower;
    the reel's own roof carries an UNFINISHED dormer hole alongside the
    shaft, which is not a finished accent and does not count against the
    rule — and there is no dormer recipe from this reel: fill the hole
    with slate (technique 26 already covers dormers). (Tall Mansion ref:
    f_012 only — shaft + spire on the wing roof; first certainly built
    f_011→f_012.)
- Bookend towers terminate spans: at each end of a horizontal span
  (dam, bridge, curtain wall, gate passage), build an identical pair of
  3×3–5×5 towers rising 1.5–2× the span's height above its deck, in the
  span's base material, each capped distinctly from the span —
  crenellation, a cap course, or a lantern. Guards: spans ≥10 blocks only
  (shorter and the towers dwarf it into three towers); not when the span
  already terminates into terrain on both ends. Scoping C1: identical
  pairs terminate a *span*; hierarchies compose a *compound* (see next
  bullet). (Disruptive builds ref: medieval dam.)
- Compound tower hierarchy: in a walled compound, gate/flanking towers at
  2–3 stories plus exactly ONE dominant tower at 4–5 stories — placed at
  the rear or a corner, never center-front — with the dominant tower
  ≤ ~1.6× the flankers' height and one extra silhouette move the others
  lack (taller crown, hoarding). Uniform-height towers read as a fence,
  however crenellated. (Disruptive builds ref: mining outpost.)
- Pyramid roofs at pavilion scale: the stepped stair roof shrinks —
  courses stepping 1 block inward per 1 block of rise, overhanging the
  post line by ~1 block on all sides, apex capped with a slab + finial
  (or a lantern for a lit cap), stair soffits left exposed underneath.
  Square plans only — beyond ~2:1 use a gable ridge, a stretched pyramid
  reads as a mistake. (Disruptive builds ref: gazebo.)
- Finished beam ends: every exposed beam end gets an upside-down-stair
  step or half-slab cap — exactly 1 block, longer reads as antlers (same
  cap logic as the rafter-tail rule). (Disruptive builds ref: well
  crossbeam.)
- Water-plaza variant of the one-vertical-accent rule: on a flat water
  plaza ≥9 wide with no other vertical element, a small 4-post timber
  canopy (3×3, ~5–6 high, hip roof overhanging 1 block, open on all four
  sides) at the walkway cross center breaks the outline — canopy XOR a
  central fountain column, never both. (Disruptive builds ref: fountain.)
- Roof belvedere (cupola): on a steep roof, a small tower growing out of
  the ridge line reads as "lookout" and breaks the roof's mass from the
  inside. Construction: a 2×2 or 3×3 shaft rising from INSIDE the roof plane
  (not perched on top), 3–5 blocks above the ridge; small openings (panes or
  open trapdoors) on each face; its own steep stair-block mini-roof
  overhanging the shaft by 1 block; a finial (fence + ball, or a lantern) on
  top; a 1-block slab flashing ring where the shaft meets the slope to seal
  the joint visually. Guards: center the shaft on the ridge line — off-ridge
  it reads as a mistake; shaft width ≤ ~1/3 of the roof width or it stops
  being an accent. Chimney coexistence is a dominance hierarchy, not an
  XOR: if the build also carries chimneys, the belvedere stays dominant —
  at most one shorter chimney pair alongside it, never a chimney that
  rivals its height. (Tudor ref — provisional — stylized render.)
- Dark stair-block roofs: build roofs from stairs, not full blocks — every
  step catches light, so the roof has built-in texture. Step gable ends
  down in a staircase profile instead of a straight triangle, and let the
  dark roof contrast pale walls. (Mansion example: deepslate tile stairs
  against spruce + snow.)
- Two-tone the roof: break a dark stair roof with sections of a lighter
  material (wood planks) in a deliberate pattern — it reads as
  intentional design, not a material shortage. (Arashy12 example:
  deepslate tile stairs with stripped-wood sections.)
  - Terracotta trim recipe (bargeboard + fascia): along each gable edge
    of the wing roof, run a terracotta stair course — stair blocks facing
    outward, stepping down from the ridge to the eave (1 block in per 1
    block down), following the gable edge; at the ridge the two courses
    meet, capped with a terracotta stair or slab (exact meeting block
    unresolvable at this resolution). The bargeboard is what makes the
    gable edge read as a designed line instead of a cut slate edge.
    Along the eave, run one terracotta course (blocks or slabs) directly
    above the wall plate, under the lowest slate course — the fascia is
    the horizontal line that ties the bargeboard's two ends together.
    Echo rule (the only standalone-worthy content here, carried as a
    technique 1 sub-bullet too): the same warm accent appears in ≥3
    places — roof edges, crown edges, porch canopy — and that repetition
    is what ties a multi-volume build together. One accent material,
    used as trim everywhere, never as a field. Note: the terracotta plane
    in f_004 is the INTER-FLOOR DECK, not a finished flat roof — by step
    8 it is built over and by step 10 it sits under the gable roof, so
    no "~1/3 of roof area" rule exists for it. Accent slope (split from
    the trim system): the tower's west face is a FULL terracotta stair
    slope, not trim — pitch ~45° (1:1), run ~8 blocks, width = tower
    depth (~8), from the tower top down to the second-floor balcony
    level; whether it is a roof slope or a separate sloped volume is
    UNRESOLVED (its base sits at balcony level, not at an eave) — see
    the blocked crown note in the draft (candidate 2), do not fold a
    crown recipe from this reel. (Tall Mansion ref: f_004 terracotta
    deck; f_006 full terracotta slope on the tower's west face; f_009/
    f_010 bargeboard + fascia; f_012 terracotta crown edges + porch
    canopy.)

### 5. Ground connection
The build must connect to the ground, never float.
- Foundation wider than the footprint, with steps up; or visible supports
  (stilts, barrels) for raised structures.
- Open undercroft (pilotis): on tall narrow builds, leave the ground story
  OPEN — posts carrying the enclosed stories above — so the street level
  stays airy and the mass starts one story up. Three-way distinction, do not
  mix them up: undercroft = an open ground story carrying ≥2 enclosed
  stories above it; pergola (technique 12) = a freestanding open frame with
  nothing above it; stilts = a raised box on supports (one enclosed story
  held off wet or uneven ground). Guards: keep ≥1 solid ground-floor wall
  (a rear or side wall) — an all-open ground story reads as a floating box
  and breaks the ground connection; post spacing ≤3 blocks or the open story
  sags visually. (Tudor ref — provisional — stylized render.)
- Crenellate the base: notch the top edge of a stone base (alternating
  high/low blocks) before the wooden structure sits on it — reads as
  fortified, costs almost nothing. (Arashy12 example: crenellated
  cobblestone base under the timber upper floor.)
- Sit it *in* the terrain: patchy paths to the entrance, plants and grass
  around the base — not a clean cutout on flat grass. (Manor NBT example:
  a dirt path wrapping the entire plot — the building sits inside a path
  network, and vines weathering the stone base sell the age for free.)
- Hedge the base: run leaf-block hedges along wall bases and around garden
  plots. They hide the wall-meets-terrain seam — the ugliest line in most
  builds — and frame the grounds into rooms. (Mansion example: hedges along
  every wall base and plot border.)
- On a 2+ block slope, walk the foundation *down the hill* as stair runs
  instead of growing a tall stem wall: extend the foundation past the walls
  and continue the downhill edge outward as 2–3-wide stone-brick stairs,
  one step down per ~1 block of terrain drop, each step landing on terrain,
  the run facing the approach; flank with slab curbs. Walls sit only on the
  uppermost tier. Guards: slope-only — on flat ground this produces a
  pointless staircase; use the standard raised foundation instead. See
  technique 8 for treating the slope around it. (Hillside cottage ref —
  provisional — stylized render.)
- Defer to the terrain (walls that wrap it, not fight it): lay towers or
  anchors first at terrain-appropriate spots, then connect them with wall
  modules — each module's foundation sits at ITS segment's grade, never
  one global Y level; join 1–2-block steps with stair-toothed joints
  (merlons following the step), and cap every module with the same parapet
  so the stepping reads as deliberate. Where a span meets a hillside, step
  the structure *down* as the bank rises to meet it and cap the joint with
  grass + tufts — the vegetation is what sells "grown over" vs "butted
  against". (Disruptive builds ref: mining outpost — modular walls;
  medieval dam — terrain-stitched abutments.)
- Hang vegetation on tall old faces: drape vines or leaf strands 2–5
  blocks long from the top edge, densest near corners, openings, and the
  wettest zone — ~60% of the face stays clear. Vegetation reads as age;
  never on new or formal builds, never full coverage. (Disruptive builds
  ref: dam face.)
- Armor engineered water exits: in front of each outflow (sluice,
  spillway, mill outflow), lay a 3–5-block apron of stone *slabs* (thin
  reads as paving, not a second wall), slightly darker than the wall, with
  mossy variants feathered at the far edge. (Disruptive builds ref: dam
  outflow apron.)
- Pile rhythm under piers: drive log piles under both deck edges every
  3 blocks, deck underside to waterbed — no floating — with diagonal fence
  X-bracing between consecutive piles on the outer faces (bracing FLUSH
  with pile faces on boat-slip sides), and a beam course at deck line
  capping the pile tops. In ≤2-deep water piles barely show — use a stone
  footing instead. (Disruptive builds ref: ultimate fishing dock.)
- Shared pad for clusters: one continuous stone-brick slab pad under the
  whole cluster (markets, farmyards, workshop courts), ~2 blocks of margin
  past the outermost units — the pad edge IS the cluster boundary. Size it
  to the cluster: a mostly-empty pad reads as a parking lot. (Disruptive
  builds ref: market.)
- Wood never touches earth: every freestanding wooden post starts on a
  1×1×1 stone footing block; on a plinth the footing sits on the plinth
  (stone-on-stone is fine — the rule is wood-never-on-earth). (Disruptive
  builds ref: well.)
- Stepped civic plinth: for narrow towers and freestanding civic
  structures, build 2 courses each 1 block wider per side than the one
  above (bottom course ≥ footprint + 2 per side), the top course
  transitioning to stair blocks up to the threshold on the approach
  face(s) — stone-on-stone, ~1–1.5 blocks above grade, extending 1–2
  blocks past the frame on all sides. Never stack one on an existing
  terrace or deck — one ground plane per structure. (Disruptive builds
  ref: gazebo — 2–3 stair risers, slab lip elsewhere; bell tower — 2
  courses; well.)
- Stepping-stone crossings: offset bottom-half slabs with 1-block gaps,
  mixed materials in ~even thirds, each stone offset half a block
  left/right of the last, set 1 block *into* the ground bed so they read
  as set in, not laid on. Crossing beds, shallow water, garden grounds —
  never high-traffic main streets (reads fussy). (Disruptive builds ref:
  torii garden.)
- Worn path recipe: 2 blocks wide, alternating dirt_path / coarse_dirt /
  grass_block in irregular 2–4-block runs (~60/25/15), tufts dotting the
  edges, meandering ±1 block off-axis, the top grass layer replaced so the
  path sits IN the terrain. Reads as traveled, not laid. (Disruptive
  builds ref: mining outpost.)
- Curb ring + underplanting for specimen trees: ring the root zone (root
  reach + 1) with a 1-high stone-stair curb; inside: grass, 2–4 single-blob
  leaf bushes, tufts, 3–5 flowers. Break the ring or step it where a path
  meets it — a fully closed ring with no entry reads as an abandoned
  planter. Wild forest trees skip this entirely (they should look
  unplanted). (Disruptive builds ref: custom tree.)
- Ruined-mound terrain base (sub-entry): Alixxa tower
  (stage-1 candidate 3, MED). This differs from the stepped civic plinth above
  (clean courses) and from the clean-cutout warning: the tower sits on an
  irregular low mound, ~2 high, a stepped patchwork of dirt, coarse dirt, mossy
  stone and grass with no straight edges, ringed by a stone-brick slab patio
  ~15×15 (visual estimate) whose edge is ragged and bleeds into the flower
  meadow. The mound is the first thing built, and the tower's walls sit on
  it, not on the patio. It makes the tower read as grown out of a ruin mound
  and not placed on grass. Apply when: a standalone tower or keep on flat
  meadow where a clean plinth would read as a parking lot. NOT when: the build
  already has a formal plinth or terrace (one ground treatment per build);
  slopes (use the walk-the-foundation-down-the-hill bullet); builds meant to
  read as new. Unresolved: whether the mound is built terrain work or dressed
  natural terrain. It is present from the first frame with no shaping visible,
  so this cannot be settled from the frames; the instruction "shape a low
  mound under the footprint" holds either way. Exact tier count (~2–3) and
  heights are estimates. (Alixxa ref: f_001 mound and patio before any wall;
  f_005 mound with the first floor on it; f_017 finished tower on the same
  mound.)
- Ragged-edged plaza paving (sub-entry, draft — not roasted): Disruptive
  builds wave 2. The shared-pad bullet above says the pad edge IS the
  boundary; this tour draws that boundary as a blobby, notched outline in a
  mix of pale stones, never a clean rectangle. Seen on seven builds: the
  willow tree plaza (f_474, f_478), the pond and cross-bridge plaza (f_447),
  the market pad (f_506), the pillory plaza (f_573), the gazebo path wrap
  (f_469), and, from the frame evidence's list and not re-checked here, the
  library path (f_097) and the torii garden path. Recipe, as seen: lay the
  pad as a blob, with edge cells stepping in and out by a block or two and
  tongues and bays along the rim; mix two or three pale stones (stone,
  andesite, stone brick) through the field per technique 1; let grass and
  tufts reach into the notches. Apply when: freestanding civic props and
  clusters on open meadow (a well, tree, stalls, a stage) that need a ground
  plane without a hard plot line. NOT when: formal or symmetric grounds
  (technique 8: crisp edges and axes); under a stepped civic plinth (that is
  a clean-edged mass; one ground treatment per structure); where the pad must
  meet an existing path network cleanly. Prevents: the stencil-rectangle pad
  under a hand-built prop. Unresolved: the edge algorithm (no frame shows the
  placing order), pad sizes, the exact stone mix, and the length of the
  straight runs. (Disruptive builds ref: tree, pond, market, pillory,
  gazebo; f_474, f_447, f_506, f_573, f_469.)

### 6. Lighting rhythm
Warm point lights placed on the structure's rhythm — not random, not a
glowing wall.
- (House examples: a lantern on every pillar; rows of candles along porch
  edges; lanterns flanking doors.) (Manor NBT example: a hanging lantern
  above every window — 102 lanterns clustered under eaves, at gable ends,
  and on chimney tops. The rhythm follows the window columns, so light
  and structure share one grid.)
- Lanterns belong on fence posts, never torches slapped on walls: repeat
  identical fixtures at regular intervals — flanking doors, on parapet
  corners, along steps. Scattered torches read as mob-proofing; repeated
  fixtures read as design. (Mansion example: the night shots hold together
  purely on this rhythm.)
- Underwater equivalent: sea lanterns worked into the frame rhythm.
- Pendant rows: a lantern or glowstone core wrapped in trapdoors as a
  lampshade, hung on fence/chain — run them in rows of 3–5 over tables.
  Cheapest high-impact light there is; works in any style. (Interior
  board: the single most repeated technique, across kitchens, dining
  rooms, libraries.)
- Hide the source: glow lichen under shelves, light panels set flush into
  dark ceilings, light strips behind perforated walls. The glow is
  visible, the source isn't. (Interior board.)
- Never use a light-emitting block *as* a wall/window material (no glowstone
  walls).
- Wall-mount lanterns where posts can't go: at an entrance, one block above
  head height, project a short arm (1–2 fences or slabs) out of the wall
  and hang the lantern from its underside — or set it atop the arm. Keep
  fixtures identical at every entrance. Guards: at ground level prefer
  freestanding posts; an arm on every wall reads as cactus growth; never
  double up with eave-hung lanterns on the same rhythm — one system.
  (Hillside cottage ref — provisional — stylized render.)
- One focal per garden: instead of rhythm, a single lantern elevated on a
  stepped stone pedestal (3×3 base, 2×2 second course, cap — 3 high
  total), placed off-center in the bed, every other light ≥8 blocks away.
  Focal XOR rhythm per view — never both on the same sightline.
  (Disruptive builds ref: torii garden.)
- One room, one light: a roofed pavilion gets ONE lantern hung from the
  roof's center beam — two pendants in a 5×5 space read as clutter, not
  rhythm. (Disruptive builds ref: gazebo.)
- Light the water rim: identical lantern-on-fence-post fixtures just
  outside the rim, every 4–6 blocks around the full perimeter, kept clear
  of bridge landings. (Disruptive builds ref: pond.)
- Plaza-corner pillars: 2–3-high identical stone pillars with lanterns on
  top at the walkway cross's inner corners — light and circulation share
  one geometry. (Disruptive builds ref: fountain.)
- Stall-grid rhythm: one identical lantern per stall, hung from the same
  point on each awning frame — the light grid and the stall grid become
  one read. (Disruptive builds ref: market.)
- Pier nodes: one identical fixture per station (shore root, hut door,
  platform end) — a lantern on every pile is a runway, not a rhythm.
  (Disruptive builds ref: fishing dock.)
- Lamp-post forms (sub-entry, draft — not roasted): Disruptive builds wave 2.
  The pier-node and water-rim bullets above use one fixture, a fence post
  with a lantern on top. The tour shows two more freestanding forms, each
  reading as a different job. (a) Gate post: a stripped-log post on a 1×1
  stone footing block with the lantern on top, one on each side of a gate
  passage (castle gate f_226, f_227). (b) Arm post: a dark log post on a stone
  footing block with a short horizontal arm at the top and the lantern hanging
  from the arm's end, at a pier head (harbour pier f_343, f_359). The frame
  evidence also lists pier piles capped in a pale slab with a lantern or
  fence beside them (riverside pier house f_372–f_386); not re-checked at
  full resolution. Guard, inferred from the one-system rule above: one
  fixture form per sightline. Unresolved: post heights, arm length, the cap
  block. (Disruptive builds ref: mining outpost gate, fishing dock.)

### 7. Detail & props
Small functional-looking bits sell the scale:
- Openings: panes + shutters (trapdoors) + a box of trailing greenery below.
  The full window recipe: 2-high glass panes in a stair-block sill/frame,
  open trapdoors flanking as shutters, a hanging lantern above. Repeat it
  in vertical columns across every story — one recipe, whole facade done.
  (Manor NBT example: ~150 trapdoor shutters + stair sills across three
  window bands.)
  - Flower-box trim: the retail version of the greenery box — 2–3 flower
    pots in one color family along a stall's front counter edge. Cheapest
    "alive and trading" signal there is. (Disruptive builds ref: market —
    bonus frame.)
  - Mullion variant: on quiet walls where one window must carry more weight,
    put a dark-fence cross over the glass panes (3×3 with the cross in the
    center row/column and panes in the corners; 1-wide windows get a single
    horizontal bar), glass recessed 1 block behind the cross. Needs a
    contrasting frame to register; never mullions + shutters + flower box
    on one 2-wide window — pick one window language per facade. (Farmhouse
    ref — provisional — stylized render.)
  - Shoji panel variant: a timber frame grid with a pale opaque infill
    panel — no glass, no shutters, no flower box. Frame the opening in
    timber (posts + lintel, same wood as the building's frame); fill it
    with a pale panel (white concrete/quartz or light wood planks) — flat,
    no glass panes. Repeat the panel in a vertical column per bay,
    aligned to the pillar grid. At night the panels read as lit screens
    IF a warm light sits one block behind them — conditional, flagged as
    inferred: all 68 dense frames are day, no night frame exists. The one
    window language per facade rule still applies. (Japanese House ref:
    f0046/f0048 main hall upper story, f0050 red hall.)
  - Shutter states: open shutters + glass on feature and approach faces,
    closed trapdoors flat across the opening on secondary faces (stone
    sill below, plank lintel above, button latch). Never all-closed on the
    approach face — that reads as abandoned. (Stone tower ref.)
    - Unentered-build variant: on landmark shafts and monuments, the
      doorway is a dark void — and the void IS the detail: 2×3 opening
      recessed 1 block with no door installed, the dark interior left
      unlit, no trim, no shutters, no lantern above. Scope C6: entered
      builds get the full door recipe; unentered builds get the void —
      an untrimmed glowing hole reads as a mistake, keep it dark.
      (Disruptive builds ref: bell tower — bonus frame.)
  - Recess + trim frame: on smooth walls, set the glass or door 1 block
    back AND ring the opening with a dark trim border — both or nothing
    (trim without recess reads pasted-on); trim contrast needs pale walls,
    invert on dark ones. (Desert house ref — provisional — stylized
    render.)
  - Tall unglazed slot in a plain stone face (observation, not a
    technique): a ~2-wide × ~4-tall (±1) unglazed opening in a tower's
    plain stone face, terracotta lintel above, terracotta deck below,
    open straight through to the sky — no back wall, no floor protrusion,
    no railing, no balcony, no lantern inside. It is a SLOT, not a room:
    use it where a tower face needs one vertical break that is not a
    window — a vent, a stairwell glimpse, a deliberate void. NOT as a
    room, NOT as a balcony, NOT lit from inside. Backing caveat: the
    slot has no back wall and no floor behind it, so a follower MUST back
    it (solid wall or dark lining one block in) or accept the lint flag
    for unbacked apertures (THROUGH_HOLE) — sky is visible through it in
    the source. The lantern belongs elsewhere: a lantern SITS (not hangs)
    on the sill at the base of the separate tall shaft opening on the
    tower's front face (1 wide × ~4–5 tall, dark above the lantern,
    mid-tower at ~story 3); whether the shaft opening and the slot share
    one room is UNRESOLVABLE. The real second-floor balcony (wooden
    railing + 2 lanterns on the corners) is a different element from the
    slot — do not merge them. Technique 25 scoping: its "never glaze or
    light the openings" rule is scoped to CROWN openings; the mid-shaft
    lantern is not a crown and does not violate it. Why it survives as
    an observation and not a technique: at f_006 the void reads as the
    remnant of an entirely open upper front face (unfinished window bay
    was a live null hypothesis), but by f_007 the surrounding walls ARE
    finished while the void remains open with a finished terracotta
    lintel above it — so it reads as a deliberate opening, not an
    unfinished wall — yet it has no room-markers, so the "loggia room"
    reading dies. (Tall Mansion ref: f_006 void first visible, sky
    through it; f_007 void with finished lintel, terracotta deck below,
    lantern in the separate front-face shaft opening; f_012 slot still
    open in the finished build.)
- Lean-to awnings, two scales: over an opening, a shade plane hinged from
  the wall beats flat decoration. Micro (windows): width = opening + 1,
  wooden trapdoors top-hinged and left open, jutting ~1 block and tilting
  down, wood tone matched to the frame. Porch (doors): plank slope 2
  blocks out from the wall, 4–5 wide, outer edge carried on fence posts
  standing on 1×1 stone foundation blocks, 3 blocks of clear headroom
  underneath. Guards: awnings go OVER OPENINGS only — angled trapdoors
  floating on blank wall read as debris; one awning per facade; porch
  scale needs the outer posts or it floats. (Desert house ref: micro
  trapdoor awnings — provisional — stylized render. Stone tower ref:
  plank porch on posts.)
  - Stair-hood awning (the missing middle scale): 3 courses of wooden
    stairs over a door, each course 1 block further out and 1 block lower
    than the last, spanning door width + 2, flanked by stair "wings"
    stepping down-and-out at 45° for 2–3 blocks on each side. No posts —
    the hood is shallow enough to read as mounted; align its top course to
    a trim band or attachment plate (technique 2) if one exists. More than
    3 courses deep becomes a porch roof (needs posts); on wide facades a
    deep hood reads as a random brow. (Disruptive builds ref: bell tower.)
  - Fabric awnings: canopy of wool or concrete in alternating 1-wide
    stripes, 2 colors, HIGH contrast (white + one saturated color —
    striping vanishes at distance if the colors are close), stripes
    running front-to-back (perpendicular to the counter), overhanging the
    posts by 1 block on all sides; the canopy sits ON the posts, never
    floating. The stripes are what make wool read as canvas instead of a
    flat painted lid. (Disruptive builds ref: market.)
- Projecting balconies are one indivisible unit: floor + MANDATORY support
  (diagonal brackets under it, or posts down to the ground) + railing + deck
  border — skip any one and it reads as glued-on. Guard: no second
  ornamental projection (awning, bay window) on the same story AND the same
  face — one ornament per story per face. Jetties (technique 2) MAY coexist
  with a balcony: jetties are stacking rhythm, not ornament (see technique
  13). (Tudor ref — provisional — stylized render.)
- Ground props: barrels, flower bushes, lanterns, crop patches. One lit
  campfire near the entrance = occupancy signal — lit-only (unlit is a log
  pile), one per build, kept clear of timber. Scale the
  interior to the building: a manor needs rooms, not one bed and a
  crafting table. (Manor NBT example: 36 beds, red carpet runners, 72
  bookshelves, 72 barrels — reads as an inn, and that's the "lived-in"
  feel.)
- Service-counter hut front: turn trapdoor cabinet doors outward — the
  hut's storage wall faces the work area as a *counter*: chests/barrels
  at counter height fronted with closed vertical trapdoors, a bottom-half
  slab counter top overhanging the trapdoor face by 1 block, a serving-hatch
  window with open trapdoor shutters above. Counter on the working face
  only — never all four faces. (Disruptive builds ref: fishing dock.)
- Bits: ladders on pillars, crates, rails, chains — anything that suggests
  the place is used. A full-height wall ladder (6–10 tall) can serve as a
  facade's vertical spine — but it MUST terminate at something (terrace
  railing, roof hatch, overhang); a ladder to nowhere reads as a builder
  error. One strong vertical per wall section: ladder XOR pilasters
  (technique 3), never both. Banners on gable ends (2–3, restrained) mark
  the facade without spamming it. (Manor NBT example: red/white wall banners
  on the gable ends only. Desert house ref: full-height ladder —
  provisional — stylized render.)
- Parapet the terraces: outdoor floors get a low alternating high/low
  parapet instead of a plain edge, with a contrasting deck border. Turns
  "flat area outside the door" into a defined outdoor room — and doubles
  as a perch for the lighting rhythm. (Mansion example: stone terrace +
  wood deck.) Fortified variant for towers: alternating timber merlons
  (fence posts) on a slab drip lip at the crown — rustic builds only; on a
  formal stone keep it reads as a mistake, use stone merlons there. Same
  verb as technique 5's base crenellation, opposite end of the building.
  (Stone tower ref.)
  - Railing recipe: 2-high posts spaced 3–4 blocks apart with iron-bar
    panels spanning the upper band (bars in the upper band only, not full
    height), every post capped with a top-half slab. Land every run on a
    full 2-high post — never terminate mid-bar or mid-spacing; at a bridge
    end the terminal post doubles as the landing marker paired with the
    continuing path. (Disruptive builds ref: town platform — bonus frame.)
  - Frieze band (parapet applied vertically): between open pavilion posts,
    just under the eave plate, run a 1-block-tall band of fences spanning
    the full post-to-post gap — the side reads as designed openness, not
    walls that were never built. Keep it in the upper third of the opening
    so the pavilion stays walk-through at ground level; on viewpoint
    pavilions leave the view side clean. (Disruptive builds ref: gazebo.)
  - Crown deck on infrastructure: on linear structures (dam, city wall,
    aqueduct), finish the top as a walkable deck — planks or slabs for the
    surface, full-length fence-post railing with a cap rail on every
    exposed edge, stair access at minimum one end, deck width ≥3. On spans
    <3 wide use a simple parapet instead. (Disruptive builds ref: dam —
    transcript.)
  - Working-pier casting edges: rail the walkway sides, but DROP the
    railing on the casting side(s) of the terminal platform — finish with
    a contrasting slab edge instead. (Disruptive builds ref: fishing
    dock.)
- Interiors (the "lived-in" feel): (Interior board.)
  - Exposed ceiling beams: parallel logs across the ceiling, pendants hung
    between them — rhythm and warmth for free.
  - Zone with carpet rugs: white/blue/grey carpet layered over the floor
    to mark sofa, bed, and table areas. Cheapest zoning trick there is.
  - Checkered floor inlay: a black/white checkerboard rug panel in a room
    — a floor-pattern prop. Use it as a single rug panel, not a
    whole-floor checker (a whole floor reads as a game board). (French
    Mansion ref: f0025.)
  - Sunken conversation pit: drop a seating area one block lower and
    carpet it — a "room within a room", instantly dramatic.
  - Recess, don't paste: sink bookshelves and racks *into* the wall as
    niches instead of mounting them on it.
  - Trapdoor cabinet doors: trapdoors as cupboard doors over
    bookshelves/barrels, trapdoor + glass pane for glass doors, buttons
    as handles.
  - Floating stair shelves: stair blocks as stepped shelves, fences as
    brackets, sometimes wrapping corners; load with pots, candles, books,
    item frames.
  - Modular sofa formula: stairs for backrest/arms, slabs for the seat,
    wool/carpet as cushions — scales to dining chairs and daybeds.
  - Fireplace as the room's anchor: chimney with fire behind glass,
    mantel shelf above, seating facing it. This rule generalizes — every
    themed room needs ONE functional block as its visual anchor: library →
    lectern with an open book, enchanting room → enchanting table, smithy
    → anvil, kitchen → smoker/cauldron. Place the anchor on the feature
    wall or the room's middle, arrange seating facing it, put task light
    AT it (candle cluster or lantern beside/above — not across the room).
    One anchor per room — two anchors split the focus. (Disruptive builds
    ref: library — transcript.)
  - Ladder nook: a 1×1 wall-ladder shaft (4–8 tall) climbing to a small
    enclosed loft ≤5×5 reads as a *retreat*, not a second floor — the climb
    itself is the threshold. Furnish it as a single-purpose room (one
    table, 2 chairs, shelves on 2–3 walls, one deliberate detail) with a
    2–3-block ceiling. Ladders punish routine traffic: nooks get ladders,
    daily rooms get stairs; a loft >5×5 is a second floor — give it
    stairs and call it one. (Disruptive builds ref: library — transcript.)
  - Storage walls: in a single-theme room, build the walls out of the
    storage block — floor-to-ceiling bookshelves (3–4 high), barrels,
    chests behind trapdoor fronts — instead of scattering freestanding
    furniture. Cap the run with a plate/trim course so it reads as
    intentional millwork; reserve one wall for the door + ONE feature.
    (Disruptive builds ref: library.)
  - Lit display-niche wall: on a main-hall interior wall, lay a regular
    wall-sized grid of small niches (1-block cubbies, timber-framed) with
    a warm light in each — it reads as a lit display wall, not windows
    (no glass, no exterior). Display, not storage guard: the cubbies hold
    light + small props, not books/barrels — if the cubbies hold books it
    is the storage wall above, not this. Single-interior evidence (main
    hall only); technique 7 bullets are routinely single-ref. (Japanese
    House ref: f0031, f0033, f0040.)
  - Trapdoor wall paneling: clad a feature-wall section (2–4 wide × 2–3
    tall) behind the room's feature in closed vertical trapdoors — cheap
    wainscoting; frame the panel with a 1-wide contrasting trim. One
    paneled section per room — two competing panels chop the room up.
    (Disruptive builds ref: library — interpretive read.)
  - Live/work split: in a ≤2-story waterside hut, noisy work (furnaces,
    anvil, storage) stays at deck level while quiet living (bed, window or
    balcony door on the water side) goes above, ladder between — never
    make the player climb stairs carrying cargo. (Disruptive builds ref:
    ultimate fishing dock — transcript.)
  - Hide the function: chests under the bed frame, crafting table
    disguised inside a stair-block desk. Function without clutter.
  - Flower pots everywhere: the default "alive" signal — shelves, tables,
    niches, windowsills.
  - Potted topiary columns: tall leaf columns in pots lining walls and
    passages — a technique 7 prop variant. The column height (taller than
    a flower pot's plant) is what makes it read as architecture rather
    than decoration. (French Mansion ref: f0025.)
  - Banners as curtains: hung vertically over windows or as chair-back
    upholstery.
  - Discipline the palette: monochrome base (white quartz/concrete vs
    black concrete or dark oak) plus one accent color.
- Triplet slit windows with trapdoor awning + flower box (sub-entry): Alixxa tower
  (stage-1 candidate 2, HIGH observation). The
  domestic window recipe above is glazed; technique 35's slits are undressed
  fortress pairs. This tower does neither: three 1-wide × ~3-tall unglazed
  slits per face and story, with 1-wide stone piers between and at the edges
  (`P S P S P S P` on the 7-wide face, slits at columns 1, 3, 5), each slit
  with a stone-brick wall post as a mullion, one open trapdoor awning above
  each slit jutting ~1 block, and on the upper level one flower box under the
  whole triplet (a trapdoor-fronted trough projecting ~1, ~5–6 wide, flowers
  and trailing vines). Lower level: two slits with awnings and no box in f_010,
  where the stage-1 note read closed shutters on the ground floor; which of the
  two is right is unresolved. The dressing is the technique: the same slit
  that reads as an arrow loop reads as a cosy window with an awning and a box.
  Apply when: small towers and keeps that must read fortified and lived-in at
  once. NOT when: pure fortress builds (technique 35's undressed grid); pure
  domestic builds (the glazed recipe); the face already carries a balcony or
  bay on the same story. OPEN question, not resolved here: does the pareidolia
  flag fire on dressed triplets on a 7-wide face? Do not claim the source is
  lint-clean. The repetition of box + awning on adjacent stories of one face
  also falls in the gap between technique 13's ≤6×6 guard and its ≥8×8 release.
  Only the two front-facing faces are ever visible; symmetry on the others is
  assumed. (Alixxa ref: f_007 slits first visible; f_009 ground-floor window and
  door awning; f_010 upper awnings, boxes and mullions; f_013 upper-shaft
  slits; f_016 upper-shaft awnings.)
- Fence-lattice window (sub-entry, draft — not roasted): Disruptive builds
  wave 2. The window recipe above is glazed; this is the glassless
  alternative. In the riverside pier house the windows are filled with a
  grid of fence posts joined by horizontal fence connections, columns 1
  wide and 3 high, with the view and the leaves showing through (interior
  f_405–f_408, f_417, f_418; seen at f_406). No glass, no shutters in the
  interior views. Apply when: ventilated working rooms in timber riverside
  or dock huts, where the interior is a workshop or kitchen. NOT when: the
  room must read warm and sealed (use the glazed recipe). The audit lints
  have not been run on a lattice window. Prevents: a glassless window that
  reads as a plain hole. Unresolved: column count per window,
  wood type, whether the exterior carries shutters (only interiors are shown).
  (Disruptive builds ref: ultimate fishing dock / riverside pier house;
  f_405–f_408.)
- Covered gallery crown with end pavilions (sub-entry, draft — not roasted):
  Disruptive builds wave 2. The "crown deck on infrastructure" bullet above
  builds an OPEN railed walk. The dam in this reel instead carries a ROOFED
  timber gallery over its stone arcade, with a pavilion at each end. As seen:
  7 posts across the front (counted at full resolution, f_067) standing on a
  stone-brick course; a beam course with an open-trapdoor plate on each beam
  end (technique 50); a knee-wall balustrade, a stone-brick course carrying a
  fence between the posts (f_067, f_070, f_071); upside-down stair brackets
  beside each post under the beam with a lantern hung beneath (f_071, f_073);
  a plank ceiling and floor with a lighter path strip (f_071); a low roof over
  the gallery; and at each end a pavilion one storey above the gallery with a
  stepped overhanging roof (f_064, f_065, f_067). Apply when: a span that
  carries foot traffic and wants shelter and a destination (dams, bridges,
  aqueduct crowns). NOT when: the span is <3 wide (no room for a gallery;
  the simple parapet applies) or when the open deck above suits. Prevents:
  a bare plank strip on top of a large stone mass. Open question, not
  resolved here: the bookend-towers bullet in technique 4 sizes the end
  structures at 1.5–2× the span's height above its deck, but these pavilions
  rise about one storey; which guard governs a covered gallery is for the
  roast. Unresolved: gallery length and width, the roof profile between the
  pavilions, pavilion roof tiers, wood types. Rhythm note: the posts do not
  land on the arcade piers, see technique 45's sub-entry. (Disruptive builds
  ref: dam; f_064, f_065, f_067, f_070, f_071, f_073.)
- Posted stair-hood (sub-entry, draft — not roasted): Disruptive builds wave
  2. The stair-hood bullet above says "No posts — the hood is shallow enough
  to read as mounted". The bell tower's own hood is carried: slim wood posts
  stand under the outer ends of the wings and land on stone piers that flank
  the door and rise from the plinth with stair-chamfered tops (f_549, f_550,
  f_551, f_557, f_564). The hood itself is the 3-course stepped plank/stair
  form with stair wings. Which of the two readings the guide keeps is for the
  roast; this entry records only what the frames show. Unresolved: the post
  count per side (f_549 shows two, f_550 one per side), the post block, hood
  dimensions. (Disruptive builds ref: bell tower; f_549, f_550.)
- Furniture and counters from repurposed blocks (sub-entry, draft — not roasted):
  Disruptive builds wave 2. The modular sofa formula above uses
  stairs and slabs. The tour's interiors add a wider set, all from blocks
  used against their original function; block ids marked `?` are inferred.
  Library: an armchair is a stair facing the table with an open trapdoor
  behind it as the back; a reading table is a closed top-half trapdoor on a
  1-block pedestal (stripped log or barrel); a window seat is one stair on
  each side of a niche facing in (f_128, f_106, f_122, f_141). Kitchen: side-
  facing barrels as counter units, a water-filled cauldron inset as the sink,
  a tripwire hook above it as the tap, a pot on the counter, an anvil with a
  lantern on top as a lamp table (f_406, f_408). Smelter wall: three stacked
  furnaces in a stone alcove with a chest and a barrel carrying a lantern
  (f_267, f_268). Workbench run: crafting table, grindstone and chests in a
  row along a wall (f_409–f_412, frame evidence, not re-checked). Apply
  when: lived-in interiors of small timber or stone builds where the story is
  a working trade. NOT when: the room needs one anchor already (the anchor
  bullet above governs focus; these pieces are furniture, not the anchor).
  Unresolved: block ids under the shader tint, the hanging 3-wide cabinet unit
  in the kitchen (block unidentified, BLOCKED), which wood the trapdoors are.
  (Disruptive builds ref: library, ultimate fishing dock, mining outpost.)
- Attic neglect dressing (sub-entry, draft — not roasted): Disruptive builds
  wave 2. The tour's attic is dressed as disused: cobwebs in the corners and
  across the room, with window seats and lecterns still in place so it reads
  as unused rather than empty (f_131–f_141; cobweb close-up f_136). Apply
  when: attics, cellars and back rooms of a building whose story is "old".
  NOT when: the room is the occupied core, or the exterior says "new" (the
  weathering rule's cause test applies indoors too, inferred). Unresolved: how
  many cobwebs and where, what is on the lecterns. (Disruptive builds ref:
  library attic.)

### 8. Siting
A build belongs *somewhere*. Pick the spot as part of the design: by water
with terraced banks, on a cliff edge, sunk into a hillside. The terrain is
half the composition.
- Lay out grounds like architecture: axis, symmetry, hedge-enclosed plots —
  a cross of paths dividing four plots, two of them working farms. Functional
  blocks (crops) inside a formal frame read as a designed estate, not a
  survival farm. (Mansion example: symmetrical courtyard garden.)
- Cross + circle node variant: take the cross-of-paths garden above and put
  a rimmed circular lawn node (5–7 diameter, light rim ring) at the
  crossing; keep the quadrants as LAWN with a dirt/path outer border — the
  dirt forms the outer border, not quadrant-bed borders. Keep the circle as
  lawn, not a fountain — the fountain court is a separate garden room.
  (French Mansion ref: f0117.)
- Forecourt garden: in front of the main hall, lay a dirt court (coarse
  dirt / dirt path family) spanning the hall's width. Center a round pond:
  blue water, white stone rim, one small central ornament — the pond is
  this technique's formal water (basin-first, raised stone rim), not new
  construction. Frame the court with tall bamboo clusters (technique 16
  language) and 2–4 cherry trees (technique 10 backdrop) at the edges,
  plus flower beds and dark lantern posts at intervals. Keep the center
  open — the pond owns it; all planting sits at the edges. (Japanese
  House ref: f0056–f0058, f0064, f0066–f0068.)
- Work the slope: on sloped grounds, cut the terrain into 1–2-block
  terraces with grass-lipped caps (grass blocks capping each riser so it
  never reads as a raw dirt scar) and run paths *along* the contours, not
  straight up; plant the terrace lips with tufts, ferns, and flower
  bushes. Working fields follow the same rule: tilled rows at mixed growth
  stages, divided by 1-block dirt-path strips, each plot stepping down with
  the terrain — never flatten the slope into one big rectangle (that reads
  as a texture stamp). Keep fields 2–3 blocks from the walls and total
  field area ≤ ~4× the footprint. (Hillside cottage ref: grass-lipped
  terraces — provisional — stylized render. Farmhouse ref:
  contour-following wheat fields — provisional — stylized render.)
- Terrace-lip topiary row: topiary cones planted in rhythm along terrace
  lips — a rhythm application of this technique's topiary, not a new
  technique. (French Mansion ref: f0090, f0095.)
- Zen beds: the restraint variant of enclosed plots — a 5–9-wide
  sand/gravel bed with exactly 3–5 placed elements (one vertical anchor,
  one focal, 1–3 half-buried stones) and nothing else. Negative space is
  the material; one zen bed per ~15-block radius. Scope C5: shrine/temple
  story gets restraint; estates get formal planted plots. (Disruptive
  builds ref: torii garden.)
- Vertical grounds enclosure: grow 2–4 large custom trees so their
  canopies meet 6–9 blocks overhead, with vines hanging from the canopy
  edge as the dripping edge — it turns an open garden into a *room*
  (ceiling, walls, floor). Keep a skylight open directly above the focal
  and prune leaves below head-height +2 on the approach side. (Disruptive
  builds ref: torii garden.)
- Path-hub plaza: where ≥3 paths meet, lay the pad FIRST as a 7–11-diameter
  circle — draw it with a 1-wide contrasting slab rim, then fill — and set
  exactly one anchor (technique 10) dead center. Run each path INTO the
  rim: spokes stop at the rim, paths never cross the anchor. Size the hub
  to the path count (~5–7 wide for a 4-path town center). (Disruptive
  builds ref: town platform — bonus frame, rim-first construction.)
- Traversable centerpiece: a water feature at a path convergence must be
  crossed, not skirted — 2-wide plank walkways at rim level along both
  midlines, deck surface flush with the rim and the surrounding paths (no
  step up or down), exiting the basin on all four sides and continuing as
  paths. <7-wide basins get a single bridge or none — the cross eats the
  water. (Disruptive builds ref: fountain.)
- Water features: decide the language FIRST, never mix it. FORMAL (town
  plaza, courtyard, manor grounds): basin-first construction — build the
  container, not the hole — raised stone rim with water set 1–2 blocks
  below the rim top, corners chamfered with 2–3 stair blocks at 45°,
  rim material contrasting the water; one 2–3-wide stepped stair entry
  turns the edge into an invitation. WILD (village edge, park, shrine):
  ragged edge nibbling ±1 (dirt, gravel, stone mix), lily pads clustered
  near the shore and never covering >30% of the surface, spare planting
  (a few tufts) — lush rim, clear water; never reeds/sugar cane in a
  tended pond. Steaming water (campfires 1 block under the surface —
  narrated in the reel, not frame-verified) is a wild-water detail only.
  A chamfered stone rim on a muddy pond, or reeds in a geometric basin,
  reads as indecision. (Disruptive builds ref: fountain — formal; pond —
  formal rim; torii garden — wild edge.)
- Fountain garland ring + tiered abstract centerpiece: basin-first
  construction is this technique's formal-water verb; two details are new
  to it — a leaf + white-flower garland ring on the basin rim, and a
  tiered abstract white-stone centerpiece (not a statue) with a small red
  apex accent. (French Mansion ref: f0101 aerial, f0128 ground level.)
- Plan-level symmetry: for institutional builds (library, hall, temple),
  design one wing completely — room footprint, furniture, lighting — then
  mirror it across the entry axis; change 1–2 small details so it doesn't
  read as a clone stamp, keep both doorways equidistant from the entry.
  (Disruptive builds ref: library — transcript.)
- Landmark siting — orbit, don't enter: run 2–4 simple paths to the
  landmark's base from different directions (the radial *geometry* matters
  more than the path material); keep a 3–5-block clear radius at the base
  — paths may cross it, but no vertical props may stand in it; doors or
  openings on multiple faces are fine even if they lead nowhere. Design
  for the 50-block view: skip technique 11's staging entirely — landmark
  orbit XOR building arrival, never both (scope C2). (Disruptive builds
  ref: bell tower.)
- Frontless civic siting: wells, fountains, statues, bell towers, notice
  boards sit at path intersections or plaza centers with 360° access and
  identical detailing on all faces — there is no "back of a well". Scope
  C3: fronted buildings get technique 11's staged arrival; frontless
  civic structures get center-siting. (Disruptive builds ref: well.)

### 9. Diorama composition — orbit a terrain feature
(Provisional — derived from the Dio Rods "Waterfall Quarry Survival Base"
post description only; material-level detail still pending his screenshots.)
- Anchor on a terrain feature, not a footprint: quarry pit, waterfall,
  flooded basin. Structures orbit the feature instead of standing alone.
- Label every zone by purpose (workshop, lodgings, ore crushing, storage
  attic, warehouse, amethyst mine) — named zones make a large build read
  instantly at a glance.
- Connect zones with transport lines: a bridge spanning the pit, minecart
  rails threading between zones — they do the wayfinding for free.
- Break the skyline with industrial verticals: a big crane, a windmill —
  one tall machine changes the whole read (pairs with technique 4).
- Invert the orbit verb: identify the site's feature FIRST (hill, cliff,
  shore); the compound wraps it at a 3–5-block standoff, and the primary
  functional entrance is CUT INTO the feature itself — 2-wide × 3-high
  dark opening, framed in a contrasting material (timber against
  dirt/grass), one lantern on each side of the frame; the feature keeps
  its natural top, never capped with architecture. (Disruptive builds
  ref: mining outpost.)
- Legible rail junctions: at every divergence, keep both outgoing branches
  visible for ≥5 blocks past the split (never bury a junction inside a
  wall or under a floor), put the control (lever or button) on a post or
  wall block immediately adjacent to the split, on the operator's side —
  and power both branches so either choice works. A track split with no
  visible control reads as decoration. (Disruptive builds ref: mining
  outpost — transcript.)
- Let water unify: the waterfall feeding the flooded pit ties all the
  zones together visually.
- Accessible verticals, working alcove (sub-entry, draft — not roasted):
  Disruptive builds wave 2. Stage-1 of the mining outpost proposed
  "if it looks climbable, make it climbable" from one aerial frame and the
  transcript; the frame sweep now shows the interior. Towers carry a ladder in
  a 1-wide shaft inside the wall, entered through a closed door at the foot
  (f_233–f_235, f_241, f_244–f_246; ladder seen at f_233), and the yard has a
  small storeroom with a chest and a workbench-like block (f_245; block
  identity unresolved) and a smelter alcove
  (stacked furnaces, chest, a barrel carrying a lantern; f_267, f_268). Stage-1's
  version runs the ladder up the tower's inner face to the parapet; the two
  are not reconciled here. Rule: a tower whose silhouette promises occupation
  gets working circulation, and the ladder lands at the crown walk, never at
  nothing (technique 7's ladder rule). Apply when: defensive, industrial or
  lookout towers in an ENTERED build. NOT when: finials, spires, belvederes
  under 3×3 (too small to read as occupiable); exterior-only builds, where
  technique 10's budget gate says the interior is structural minimum.
  Unresolved: tower heights, shaft routes, where the ladders land. (Disruptive
  builds ref: mining outpost; f_233, f_241, f_245, f_267.)

### 10. Theme anchors — one focal point, restrained biome
A single oversized themed prop justifies the whole build's theme and lets
everything else stay simple without looking empty. (Mansion example: a
courtyard spruce decorated with candle "ornaments" as a Christmas tree.)
(Manor NBT example: the paired chimney stacks ARE the anchor — the
symmetric pairs flanking the ridge do the "manor" reading, everything else
stays plain timber-and-plaster.)
- Sell the biome with cheap restraint, not rebuilt terrain: snow layers
  capping leaves, snow patches breaking up paths, a snowman or two. Partial
  cover reads as natural; full cover reads as unfinished.
- Small-build anchor discipline: on footprints ≤8×8 the walls can't carry
  technique-7 layering — spend the budget on silhouette and ground
  instead. Countable rule: ONE oversized anchor (a chimney ≥1.5× wall
  height set off-center with a corbelled cap and twin pots; a silo; a
  small tower) + max 2 supporting details (one window, one threshold),
  everything else plain. Oversize non-functional verticals only — never
  doors, windows, or paths, which breaks function and read. Guard: one
  chimney strategy per build — the oversized anchor here XOR technique 4's
  restrained off-center stack, never both. (Farmhouse ref — provisional —
  stylized render.)
- Landmark-scale anchors: for bell towers, lighthouses, monuments — one
  legible object (bell, statue, beacon) sized ~1/3 of its opening and
  visible from the primary approach (open belfry, niche, open frame —
  never enclosed); the shaft stays QUIET (at most one slit opening per
  face) so 100% of the read lands on base + crown. Never banding up a
  landmark shaft — it visually shrinks it. (Disruptive builds ref: bell
  tower.)
- Anchor clear radius: keep a prop-free ring around every anchor ≈ 1× the
  anchor's own width — ground texture allowed, but no vertical props, no
  secondary structures. Emptiness around the anchor is part of the anchor.
  (Disruptive builds ref: town platform — bonus frame.)
- Budget gate for exterior-only builds: interiors get structural minimum
  only (support frame, access stair) — no finishes, no lighting design,
  no furniture. Every block spent on an unseen interior is stolen from the
  exterior, which is the only thing anyone ever sees. (Disruptive builds
  ref: bell tower — transcript.)

### 11. Stage the arrival (provisional — stylized render)
The last few blocks before the door are a sequence, not a backdrop: stage
them so a visitor *arrives*. Four placements in order, from far to near:
- (a) Outer marker: where the path meets the grounds, one gate threshold —
  fence post + gate + fence post on the path axis, on-axis with the door.
  It must sit at a real boundary; a gate mid-path is a fence that lost its
  way.
- (b) Theme-matched prop cluster at the door: 3–6 units stacked (never
  scattered), one prop family matching the build's story (hay bales for a
  farm, barrels and crates for a dock), set tight against the wall base or
  path edge on ONE side of the door, path side left clear.
- (c) Exactly ONE hero prop: a market cart XOR a crate stack XOR the
  cluster itself — never two heroes competing. (Hillside cottage ref: a
  dark-oak market cart — trapdoor crate-grid sides, fence-spoke wheels,
  hay bale + barrel + lantern load.)
- (d) Props flank the path, never block it: keep ≥1 usable block of path
  clear through every stage.
- (e) Inside the door, function before display: put the functional core
  (enchanting, smelting, storage) within 3–5 blocks of the entrance —
  compact and workmanlike; decorative rooms branch beyond it. Never a
  display room between the door and the function. (Disruptive builds ref:
  library — transcript.)
- Raw-product props beat crates: display the build's product RAW near the
  work entrance — 2–4 heaps of 1–2-high ore blocks, hay bales, or log
  piles, one product family, mixed with stone at the base so they read as
  dumped; flanking the work door, never in the path. (Disruptive builds
  ref: mining outpost — transcript.)
- Goods read as color: 1–2 saturated blocks per stall counter, each on its
  own slab riser so it sits proud of the surface — vary the color per
  stall. Placement grammar: goods ON the counter = for sale; stock behind
  or below = storage; never more than 2–3 goods per counter.
  (Disruptive builds ref: market.)
- Face-the-walk: every counter faces the SAME shared circulation spine —
  backs outward, counters to the path. Lay the spine FIRST (2–3 wide),
  flank it with stalls, and extend the spine before expanding.
  (Disruptive builds ref: market.)
- Doorless arrival: a pavilion has no door — the steps ARE the threshold.
  The sequence compresses to path → steps → platform: run a 2–3-wide path
  straight to the platform steps, on axis with the pavilion's center,
  steps landing ON the path — no grass gap. (Disruptive builds ref:
  gazebo.)
- Linear procession: on piers, causeways, bridge-towns, order stations
  along one axis from shore — (a) land entrance, (b) the walk with beats
  (technique 21's activity ledges), (c) the work zone (slip, crane,
  crates), (d) the door at the FAR end. Mark each transition (widened
  section, lantern posts, material change); keep the walk ≤2 wide so it
  reads as a path with destinations. Guard C4: if the hut sits at the
  LAND end, the pier is a dead appendage — move the door or accept a
  fishing-only pier. (Disruptive builds ref: ultimate fishing dock —
  transcript.)
- When NOT to apply: isolated wilderness builds (props with no path or
  neighbor read as random clutter); formal symmetric grounds (use
  technique 8's enclosed plots instead). (Desert house ref: doorstep
  commerce cluster. Farmhouse ref: gate threshold + hay-bale clusters.
  Stone tower ref: barrel-and-chest arrival vignette. All provisional —
  stylized render.)

### 12. Pergola shade structures (provisional — stylized render)
The guide's shade vocabulary is all solid overhangs (technique 4 eaves,
technique 7 awnings). A pergola is the open alternative: alternating open
slats + solid infill at ~50% so the roof casts *striped* shade — shelter
that reads as light, not a lid.
- Recipe: corner posts (stripped logs or fences) 3 tall at the balcony
  edges, 3–5 parallel beams (logs or bottom-half slabs) across the top
  spaced 1 apart; over every alternate gap lay a solid strip (carpet, moss,
  or leaves — the green strips in the reference are render styling, the
  striping construction is the technique), leaving the rest open. Sit it 1
  block above the door head, projecting 2–3 blocks from the wall.
- Guard: below ~40% open area the striped read dies and it becomes a dark
  solid roof — the terrace underneath dies with it. When NOT to apply: wet
  or nordic archetypes (an open roof in rain reads as broken); walls that
  already carry a solid overhang (two shade layers fight). (Desert house
  ref.)
- Gazebo-vs-pergola choice rule: the pergola shades a *route or seat* —
  open slat roof, no raised floor needed, sun comes through. A gazebo is a
  *destination* — it needs a solid stair-block roof (weather, real
  shelter) and a raised platform floor (people stand IN it, not under it).
  Build a gazebo when the spot is a node (town center, garden focal point,
  viewpoint); build a pergola when it's a route or lean-to seat. Guard:
  never both shade systems on the same spot — a solid roof over striped
  slats is two shade systems fighting. Placement: one shelter per plaza
  max at path nodes. (Disruptive builds ref: gazebo.)

### 13. Tall-narrow stacking discipline (provisional — stylized render)
Tall narrow builds (≥3 stories on a ≤6×6 footprint) fail differently from
small builds: not from emptiness but from extrusion — every story getting
the same ornament until the tower reads as a stamped column. Story zoning
and floor plates still apply (techniques 3 and 2); this technique is the
ornamental discipline on top of them.
- At most one ornamental projection (balcony, awning, bay window) per story
  per face — and no two adjacent stories repeating the same ornament on the
  same face. Alternate: balcony on story 2's front, awning on story 3's
  front — never balcony-balcony. Jetties are EXEMPT from this count: jetties
  (technique 2) are stacking rhythm, not ornament — they may run on every
  story, including on faces that carry a balcony.
- Terminate the top: the highest story needs a deliberate finish — a
  belvedere (technique 4), a parapet, a stepped-back cap — never a flat
  stop. A flat stop on a tall narrow tower reads as a chimney that forgot
  its fireplace.
- Scope vs technique 10, stated plainly: ≤2 stories → technique 10's anchor
  discipline (low builds die of clutter — one oversized anchor + max 2
  supporting details); ≥3 stories → THIS stacking discipline (tall builds
  die of extrusion). Never apply both to the same build.
- Guards: footprints ≤6×6 only. On ≥8×8 footprints the stories have room for
  full per-face composition and this discipline reads as starvation —
  compose freely instead. (Tudor ref.)
- Quiet-shaft corollary: when the crown already carries the whole read
  (belfry, belvedere, statue), the shaft gets NO ornament — at most one
  narrow slit per face, vertically centered; technique 1's noise does the
  only surface work. Complement of the stacking discipline: "every story
  earns its ornament" vs "no story gets ornament" — never both on one
  tower. (Disruptive builds ref: bell tower.)
- Wall-hugging stair runs: in a ≤5×5 shaft, run one straight 1-wide stair
  flight per story along each interior wall with a 1×1 slab landing at
  each corner turn — tight to the wall, the walls are the railing. ≥7×7
  shafts get a proper stairwell instead. (Disruptive builds ref: bell
  tower — bonus frame.)

### 14. Working openings — show the structure doing its job
A machine build that reads as a solid wall is a failed machine. Vertical
slots through the wall with water (or smoke) visibly moving through them
turn a decorative barrier into working infrastructure — the opening is the
proof of function.
- Recipe: cut 2–3-wide vertical slots through the wall at water level,
  spaced 3–5 blocks apart; set iron bars (or fence gates for a chunkier
  read) as a grate across each slot mouth; let the water visibly flow
  through — the flow, not the hole, sells it. Flank each slot with
  slightly darker jamb blocks (mossy variants) so the openings read as
  intentional, not damaged.
- Apply when: dams, millraces, waterwheel channels, sewer outflows, forge
  chimneys (smoke instead of water), any "machine" build. When NOT to
  apply: ruins/abandoned builds (working openings imply maintenance);
  purely decorative walls — a slot with nothing flowing reads as a hole.
  (Disruptive builds ref: medieval dam.)

### 15. Stair-block masonry arches
Nothing in the guide gave arches a construction — lintels and plates cover
timber (technique 2), but masonry openings need the arch to read as
engineered. A stair-built arch instantly says "fortification" where a flat
lintel says "doorway".
- Recipe: for a 3-wide opening, place upside-down stone-brick stairs at
  both spring points (one block above the opening's top corners, protruding
  half-block), then bridge the span with upside-down stairs across the top
  row, all facing inward/down-slope toward the center; for 2-wide, two
  facing upside-down stairs meeting at center. Flank with 1×1 pillar
  columns (2–3 tall) that the arch sits on — never start an arch mid-wall
  with no support below. Keep the arch ring 1 block proud of the wall
  face.
- Apply when: gates, mine entrances, bridge spans, any masonry opening
  ≥2 wide. When NOT to apply: timber-framed builds (use technique 2's
  lintel/plate language); 1-wide openings (no span to arch). (Disruptive
  builds ref: mining outpost.)
- Arch profiles (sub-entry): the recipe above is one
  profile; the frames show three families, all built from stairs and slabs,
  none a smooth curve. Trixyblox has no stage-1 note yet, so its frames are
  cited directly (frame reader A's reading, with half-res frames re-checked).
  - Stepped / chamfer: technique 15's recipe above (upside-down stairs at the
    spring points, bridged across the top row). Also seen cut straight into a
    facade wall with no keystone or contrast ring: two 1-block steps at each
    upper corner, then a flat top, rise 2, span unresolved (french-mansion
    f_044, top-down; frame reader B's crop, not re-checked at full resolution).
  - Segmental: trixyblox f_001 (same head reused on windows f_008–f_010): two
    1-block jambs with a 4-block clear opening, per side one top-half stair at
    the spring line facing the opening (reads as a "Γ"), and a 2-wide
    half-block slab crown one cell above, a 3-step underside chamfer, rise 1
    over span 4. Smooth pale stone. The stair `half`/`facing` is inferred from
    the silhouette.
  - Pointed / lancet: trixyblox f_019 (also f_018, f_020, f_021), an end
    window 4 wide whose glass outline narrows by half a block per side per
    half-block row (4, 3, 2, 1) to a 1-wide flat apex, about 45°; the stair
    ownership per row is hidden behind the glass and unresolved. Arashy12 f_139
    (f_140): a free-standing decorative rib of dark brick above a belvedere
    roof, legs near-vertical then leaning ~1 block per course to a flat apex 2
    wide, rise clearly more than half the span, not an opening; span and rise
    unresolved. Heavy-tower f_005 shows small pointed openings (a stair step
    per side narrowing to a point) under a corbelled crown; sizes unresolved.
  - Ogee (arashy12 dormer hoods, f_075–f_090): BLOCKED. Profile not pinned,
    step counts unresolved; no recipe is written.
  - Spans and rises are unresolved for every profile except the two measured
    above (trixyblox f_001, f_019). The nave rib vault is out of scope here.
  - Shape: voxwright mcbuilder `shapes.arch` (draft, in progress).
- Corbelled stepped forms (sub-entry, draft — not roasted): Disruptive builds
  wave 2. The profiles above are heads over an opening. This reel adds stepped
  forms that are not openings. (A) Relieving frieze over an arcade: above the
  flat lintel course of each of the dam's 4 sluice bays, a sawtooth band, dark
  notches alternating with stone-brick blocks and upside-down stairs, in two
  rows, the second offset by half a bay, so each bay reads as a stepped
  pediment (f_040, f_043, f_044, f_051; seen at f_040). Block roles are
  inferred from shadow. (B) Chamfered niche head: a stone-brick wall niche
  with an open-trapdoor panel as its window and a log lintel, its two upper
  corners cut by upside-down dark stairs, one per corner, facing in (library
  and attic f_105, f_107, f_109, f_136, f_141; seen at f_105, f_136); this is
  the degenerate segmental head, rise 1. (C) Stepped timber arch over the
  pillory: see technique 51. Apply when: (A) arcades and sluice runs whose
  bays should not end in a plain slab; (B) wall niches too small for an arch.
  NOT when: the bays carry real arch heads (one head language per arcade).
  Source check, for the roast: no arch of any profile appears in this reel's
  gates. The castle gate head is a flat pale lintel course with a raised
  centre block (f_226, f_227, f_317). Technique 15's base entry cites the
  mining outpost for a stair-built arch; this sweep does not corroborate it,
  and one possible explanation, not verified, is that the aerial frame
  stage-1 used showed the half-height pieces at the passage's inner top
  corners as an arch. Unresolved: bay and pier widths of the
  arcade (the pier reads 1 wide, the bay about twice that, oblique), frieze
  rise, block ids. (Disruptive builds ref: dam, library, mining outpost.)

### 16. Bamboo screens — planting as walls
Technique 5's hedges are low edging; bamboo does the opposite job —
planted at varied heights it forms a translucent green WALL that encloses
a space vertically without blocking light: an outdoor room with living
walls.
- Recipe: plant bamboo in clusters of 5–9 stalks, 1 block apart in an
  irregular line (stagger ±1, never a straight row); break the tops at
  mixed heights — 6, 8, 10, 12 — uniform height reads as a fence. Use the
  screen to back ONE side of a garden bed or path. Contain it with a
  stone-slab border — bamboo spreads on grass/dirt and will escape the
  composition.
- Apply when: enclosing shrine/garden/teahouse spaces; screening an ugly
  boundary (cliff face, neighbor's wall). When NOT to apply: arid/desert
  palettes (bamboo reads wrong); small builds where a 10-tall screen
  dwarfs the architecture — screen height ≤ ~1.5× the adjacent wall
  height. (Disruptive builds ref: torii garden.)

### 17. Bridge anatomy — deck, rails, landings
A bridge is three parts, and all three are mandatory: deck alone is a
gangplank; deck + rails without landings is a pier to nowhere. The
landings are what make it a *bridge* (a crossing) rather than a *dock* (a
destination).
- Recipe: deck of planks 2–3 wide, spanning the water 1 block above the
  surface; rails of fence posts with a top-half-slab handrail along both
  edges, full span, no gaps; landings — extend the deck 2 blocks past the
  water's edge on BOTH sides and run the arriving path material *under*
  the landing (the path doesn't stop at the water — it continues beneath
  the bridge).
- Apply when: any water crossing on a path network. When NOT to apply:
  when the far side has no path — then it's a pier/dock (techniques 20–22),
  a different build. A bridge must connect path to path. (Disruptive
  builds ref: pond.)
- Hump footbridge (sub-entry, draft — not roasted): Disruptive builds wave 2.
  The recipe above is a flat deck 1 block above the water. The torii garden's
  bridge over a narrow pond arm is a hump: 3 plank-stair treads up on the
  approach (counted at f_186, f_196), a short flat top, and treads stepping
  down the far side (f_172). No fence rails are visible on it, and lantern
  stands mark the foot (f_196). The rail rule above is therefore not
  observed here; for the roast. Apply when: a narrow garden channel or pond
  arm where a flat deck would sit awkwardly on the path. NOT when: wide water
  (use the flat anatomy with both landings). Unresolved: span, whether the
  far-side treads match the near, the tread block (plank stairs read).
  (Disruptive builds ref: torii garden; f_172, f_186, f_196, f_205.)

### 18. Custom trees — branch-tip canopy cluster
The beginner mistake is building the leaf ball first and sticking a trunk
under it (lollipop). The easy professional method inverts it: place
branches first, then hang exactly one leaf blob on each branch tip — the
canopy becomes the union of blobs, automatically irregular, no sculpting
skill required.
- Canopy recipe: from the top third of the trunk, run 5–8 log branches
  (2–4 blocks long, angled up-and-out, staggered heights — never two
  branches at the same height on opposite sides); at each tip build one
  leaf blob 3–5 in diameter (rough sphere with corners knocked off, or a
  flattened ellipsoid); let adjacent blobs overlap by 1 block OR leave
  1-block gaps — uniform spacing reads as stamped. Cap with one blob
  centered on the trunk top. Small sky-holes are fine, even desirable.
- Trunk sections: flare the base — splay the bottom 2–3 courses outward
  2–4 blocks (root reach ≈ 1/3 canopy radius), roots landing ON terrain;
  taper the shaft — drop the outer ring every 4–6 blocks of height and
  shift the center by 1 block once for a subtle lean.
- Proportions (~approximate, frame-measured): canopy width ≈ trunk height
  H (±20%); lowest branch junction ≥ H/2; trunk base width ≈ H/8. Wider
  than ~1.2H reads as mushroom; narrower than ~0.7H reads as lollipop.
- Apply when: any broadleaf custom tree (the single-blob version works
  for bushes and topiary). When NOT to apply: conifers/pines — those want
  stacked cone layers, one technique per archetype; deliberately stylized
  trees break the proportions on purpose, never by accident. (Disruptive
  builds ref: custom tree.)

### 19. Hoist grammar — frame, line, load
A well reads as *working* when three parts form one vertical story: the
frame (posts + beam), the drop line (chain), and the load (bucket) hanging
over the shaft. Remove any one and it degrades: no chain = a pergola; no
load = an unfinished frame; no shaft below = a gallows. The composition
transfers to any hoist grammar — cranes, gallows, mine headframes.
- Recipe: two 1×1 posts 4–5 blocks apart (on stone footings — technique 5)
  with a crossbeam spanning post-to-post at the top, sitting ON the posts,
  ends finished with 1-block stair caps (technique 4's rule, downscaled);
  from the beam's load point hang 2–4 iron chain blocks perfectly
  vertical; suspend the working implement at the end — barrel for wells,
  hook for cranes, rope for gallows — positioned over the work point.
  Exactly ONE suspended implement per structure.
- The generalization: hang the structure's trade tool from its frame — a
  bucket on a chain says "this well draws water" the way a hook says "this
  crane lifts." One chain + one block is the cheapest storytelling in the
  game.
- Guards: the bucket must hang over a real shaft mouth — the dark shaft
  below was NOT frame-visible, so treat it as inferred well grammar, not
  observed construction. Never on decorative frames (a chain with no job
  is a lie — that's a pergola, technique 12). (Disruptive builds ref:
  well.)
- Roofed hoist (sub-entry, draft — not roasted): Disruptive builds wave 2.
  The recipe above is two posts and a crossbeam with no roof. The reel's well
  (f_486–f_500) is a roofed version: 4 thick dark log posts, a plank gable
  roof with open-trapdoor plates at the roof corners and lanterns, post feet
  ribbed with vertical-slat trapdoors (technique 50), a hanger of fences and
  trapdoors under the ridge, a chain from it to a dark grey bucket-like object
  hanging over a stone-brick shaft with a stepped rim, a 3-step stone plinth at
  the front and a path to it (f_487–f_499; seen at f_490). The grammar of the
  entry above holds: frame, line, load, one implement. Apply when: a well that
  wants real shelter, in a civic plaza. NOT when: the two-post frame already
  carries the hoist (one hoist grammar per structure). Open question: stage-1
  describes a two-post well with a barrel on the chain; whether that and this
  roofed well are the same build is unresolved. Unresolved: the hanging
  object (stage-1 read a barrel, the frame evidence read a bell, which it
  does not look like at f_490), shaft depth and width, roof profile beyond the
  front gable. (Disruptive builds ref: well; f_487–f_499.)

### 20. Boat mooring — two recipes by width
A boat tied alongside a straight pier swings into the walkway and blocks
it. Two recipes, chosen by available width:
- Slip-notch (pier ≥3 wide): carve a 2-wide × 3–4-long notch mid-pier, line
  it with deck material down to 1 block above water — deck on both sides,
  step-across boarding.
- Finger-slip (water ≥7 wide): split the pier end into two parallel
  2-wide × ≥5-long fingers with a 3-wide water gap between them; fender
  posts (2-high fences) at the slip mouth's inner corners; no roof and no
  cross-beam above the slip — boats need the vertical clearance.
- When NOT to apply either: water <7 wide total — use a side tie-up (boat
  parallel to one pier edge with fender posts). (Disruptive builds ref:
  fishing dock — slip-notch; ultimate fishing dock — finger-slip,
  transcript.)

### 21. Activity ledges
A straight pier is a corridor — everyone walks the same line and every
activity (fishing, mooring, looking) fights for the edge. Small bumps
protruding off the walkway edge, each dedicated to ONE verb, turn the
corridor into a sequence of places.
- Recipe: 2-out × 2-wide plank bump off the pier edge; cut a gap in the
  pier railing exactly at the bump (the bump IS the opening), railing
  continuing past on both sides. One verb per ledge, named by its
  furnishing: fishing ledge (bare), mooring ledge (cleat/fence post),
  lookout bump (nothing, just the view). Space ledges 4–6 blocks apart.
- When NOT to apply: on the boat-slip side of a finger (fishing lines vs
  hulls); more than one furnishing per ledge (clutter, not a place);
  ledges wider than 3 are platforms — use technique 7's terrace rules.
  (Disruptive builds ref: ultimate fishing dock — transcript.)

### 22. Under-deck dressing
A pier on bare posts has a visible black under-volume — from any low angle
the build reads as a floating lid. One deliberate vignette tucked under
the deck (visible from the approach) converts dead space into story.
- Recipe: with ≥2 blocks of under-deck clearance, dress ONE bay (between
  two pile pairs): 1 beached rowboat (boat entity pulled half onto a
  dirt/gravel patch, or a block-built hull of stairs), 2–4 barrels/crates
  tight against the piles, one rope coil (fence post + tripwire hook), and
  one lantern hung from a deck beam so it reads at dusk.
- When NOT to apply: never block the boat lane; more than one vignette
  per structure reads as junk, not story; piers <6 long have no "under"
  to speak of. (Disruptive builds ref: ultimate fishing dock — transcript.)

### 23. Market stall module
A market stall is a tiny building, not furniture — it needs all four
subsystems, and dropping any one reads as failure: no awning =
scaffolding; no posts/awning = a bare table; no counter/goods = a bus stop.
- Recipe (3×3 footprint): 4 corner posts of stripped logs, 3 tall (4 for a
  "grand" stall); striped fabric awning at the top (technique 7); counter
  of planks/bottom-half slab, 2–3 wide × 1 deep across the front at 1 block
  height, goods on top (technique 11); 1 lantern hung centered under the
  awning's front beam (technique 6). Back and sides stay OPEN — a stall is
  entered from the front; walling it in turns it into a hut.
- Apply when: markets, fairgrounds, dockside traders, village shops. When
  NOT to apply: if the "shop" needs lockable storage or interiors — then
  it's a shop *building* (techniques 2/7), not a stall. (Disruptive
  builds ref: market.)

### 24. Repeat-with-variation expansion
The strongest meta-technique in this wave: design ONE good module, stamp it
repeatedly, and vary a small set of accent parameters per instance —
identical repetition reads as copy-paste (a barracks, not a market);
controlled variation on a fixed grammar reads as organic growth.
- Recipe: fix the module grammar (footprint, post positions, awning pitch,
  counter position — identical on every instance). Vary per instance ONLY:
  (a) awning stripe colors — pick 2 from a fixed palette (white + one
  saturated color: green, red, blue, yellow); (b) counter goods colors;
  (c) small roof decorations — flower pot or banner on the awning ridge;
  (d) lantern style (hanging vs post-mounted — pick one per row). Vary
  2–3 parameters per stall, never the module shape itself. Conservative
  variant: vary exactly one variable per instance.
- Apply when: any multi-instance composition — market squares, village
  house rows, dock warehouses, festival grounds. When NOT to apply:
  formal/symmetric architecture (use technique 8's enclosed plots); a
  single standalone instance (no repetition to vary). (Disruptive builds
  ref: market — the video's explicit method, transcript.)

### 25. Open belfry crown
A landmark tower's crown should *show its program*. The bell visible inside
an open belfry is the tower's "face" — a solid cap would demote the whole
thing to a chimney; the dark openings against pale stone are what read at
distance.
- Recipe: leave the top 2–3 blocks of the shaft open — 1–2-wide × 2-tall
  unglazed openings on all 4 faces, interior left dark (line with dark
  blocks if it would catch light); hang the bell (real bell block —
  "you can ring this" per the reel transcript) centered in the visible
  band, 1 block below the opening tops; cap with a small stair-block roof
  overhanging the shaft by 1 block. Interior construction: a chunky
  dark-timber yoke — 2–4 full-height posts spanned by a horizontal beam,
  the bell hung from the beam's center on a fence post or chain. The yoke
  must read as load-bearing: darkest timber in the build.
- When NOT to apply: occupiable tops (use technique 4's belvedere) or
  fortified tops (use technique 7's crenellated parapet) — one crown
  grammar per tower. Never glaze or light the openings: glass reads as
  windows, light reads as an occupied room — both kill the "hollow crown"
  read. (Disruptive builds ref: bell tower.)
- Crenellated corbel crown over a belfry (sub-entry, draft — not roasted):
  Disruptive builds wave 2. The bell tower itself is on the frame
  evidence as a small tower (f_538–f_569): the shaft is 3 wide on the front
  face (pier, opening, pier), with a 1-wide, 2-tall dark belfry opening on the
  front face and a bell at its foot (f_549, f_550, f_567), a timber beam
  visible in the crenel above the opening (f_549, f_550), and, over the
  opening, a crown that corbels out about 1 block on each side to 5 wide in two
  stepped stages with a merlon–gap–merlon front and the corner merlons raised
  (f_550, f_567). The recipe above caps the shaft with a small stair-block roof
  and says fortified tops use the crenellated parapet instead, one crown
  grammar per tower; this tower carries a belfry opening and a crenellated
  corbel crown together. Whether that is a counter-example to the XOR guard
  or the guard is too strict is for the roast, not settled here. Only the front
  opening is visible in every frame, so the 4-face recipe above is not
  corroborated. Unresolved: shaft height, the other faces, crown-course
  block types, the exact count of crown stages. (Disruptive builds ref: bell
  tower; f_549, f_550, f_567.)

### 26. Mansard roof with dormers
Technique 4 names dormers in one line but gives no construction — and the
mansard itself, a steep dark stair slope that IS the top story's wall plus
a flat top deck, is absent from technique 4 entirely. The mansard is what
makes a big pale box read as "French" instead of "generic mansion": the
roof is a full story tall, so it carries silhouette, windows, and identity
at once.
- Recipe: lower slope of dark stair blocks at ~60–70° for 4–6 blocks of
  rise on all four sides, overhanging the wall plate by 1 block. Upper
  deck: flat or near-flat top set back from the slope's top edge — the
  flat area is the roof's "attic" and must read as a deliberate cap, not
  an unfinished hole (finish its rim with a fascia course or a low
  parapet). Dormers: at 2–4 regular intervals along each long slope,
  punch a small gabled projection through the slope — 2-wide × 2–3-tall
  pale-wall cheeks + a 1–2-wide window + a mini stair-block gable cap
  that ties back into the slope. Dormer cheeks in the WALL material
  (pale), not the roof material — the contrast is what makes them pop
  against the dark slope. Keep dormer width ≤ ~1/3 of the bay spacing or
  the slope reads as Swiss cheese.
- Apply when: formal mansions, chateaux, grand houses, any large
  pale-walled build that needs a roof with identity. NOT when: small
  builds (a mansard on a ≤9-wide house eats the whole facade — use
  technique 4's plain steep roof); timber/Tudor archetypes (the mansard
  is a masonry-formal grammar, it fights half-timbering); when the roof
  already carries a belvedere (one roof-crown grammar per roof — mansard
  dormers XOR belvedere, never both competing).
- Prevents: the "big pale box" read — a large formal house with a plain
  gable roof looks like a warehouse; the mansard slope + dormers give it
  a face. (French Mansion ref: construction sequence f0061–f0072;
  front-slope dormers f0090/f0095; side-slope dormers lit at dusk f0123;
  cross-gabled wings f0077.)

### 27. Central pedimented pavilion + grand stair
Technique 11 stages the *approach* (gate, props, hero prop) but says
nothing about the facade's own centerpiece. A formal mansion needs its
entrance to be a mass, not a door: the middle bay projects past the
facade, rises through the eaves, and caps in a triangular pediment — the
projection is what the eye lands on from 50 blocks, and the wide stair is
what makes the door feel ceremonial rather than functional.
- Recipe: project the central bay 1–2 blocks past the main facade, 3–5
  bays wide (odd count so the door sits on-axis). Carry the pavilion's
  walls 1 story above the main eaves line (or through the mansard slope)
  and cap with a triangular pediment: stepped stair-block gable in the
  wall material, 3–5 blocks tall, with a small round or slit window
  centered in the gable. Entrance: arched or tall rectangular door,
  recessed 1 block, reached by a wide ceremonial stair — full pavilion
  width, 4–7 steps, flanked by low stone cheeks or balustrade stubs,
  landing on a small terrace at door level. Keep the pavilion's window
  recipe identical to the main facade's (same tall windows, same
  pilasters) — the projection + pediment do the differentiating, not new
  ornament.
- Optional under-stair arch sub-detail: the terrace may be hollow — a
  dark arched opening under the stair landing reads as a cellar/passage
  entrance, making the terrace a mass with a use, not a solid block. No
  function claim: whether it is a cellar or a passage is not resolvable
  from outside.
- Apply when: formal mansions, civic buildings, any facade ≥15 wide with
  a single main entrance. NOT when: small or asymmetric builds (a
  pediment on a 9-wide cottage reads as a temple graft); two main
  entrances (a pavilion crowns ONE axis — twin entrances get twin
  bookend towers per technique 4 instead); when the facade already has a
  dominant tower (pavilion + tower fight for the center).
- Prevents: the "door in a wall" failure — a grand house whose entrance
  is just a darker rectangle among identical windows. (French Mansion
  ref: f0065, f0090, f0095, f0101; under-stair arch f0065.)

### 28. Hedge maze garden
Technique 8's enclosed plots are *planted* rooms (beds, crops, flowers).
A maze is a *walked* room: the hedges are walls you move through, not
beds you look at. It gives formal grounds a second garden verb — the
parterre is for viewing, the maze is for entering — and it fills a large
flat garden area with almost no block variety (leaves + dirt paths).
- Recipe: lay a rectangular maze ~15–25 blocks per side in 1-block-wide
  leaf hedges (oak/dark-oak leaves), 1 block tall as the default — the
  pattern stays fully readable from above, with white statues poking
  above the hedge line; 2 tall only as a flagged view-blocking variant.
  Run 1-block dirt/gravel paths between hedge lines. Design one entrance
  and one exit on different sides (a loop with no exit reads as a trap,
  not a garden); keep 2–3 small clearings inside (3×3, one with a white
  statue or fountain as a waypoint reward). Edge the whole maze with a
  low stone or pale curb so it reads as a designed object, not escaped
  hedges. Plant a few topiary cones at the outer corners to tie it to
  the parterre's language.
- Apply when: large formal grounds (estate, palace, manor gardens) with
  ≥15×15 of flat garden to spare. NOT when: small gardens (a 9×9 maze is
  a puzzle, not a garden — it reads as a hedge blob); wild/natural
  grounds (a maze is formal by definition — it fights technique 8's
  wild-water and ragged-edge language); when the grounds already have a
  second focal garden (maze XOR a second fountain court — one
  "destination garden" per estate, the parterre is the first).
- Prevents: the empty-lawn problem — big formal grounds with nothing
  between the parterre and the boundary read as a mowed field; the maze
  is the cheapest large-area garden fill that still rewards a visit.
  (French Mansion ref: f0114–f0126, f0123 closest aerial.)

### 29. White balustrade boundary + gate piers
Technique 11's gate threshold is a single gate on the path axis;
technique 7's parapet rules cover terrace edges. Neither gives the
*grounds boundary*: a low, continuous, pale balustrade that says "this
estate ends here" without hiding the garden behind it. The balustrade's
job is enclosure with transparency — a solid wall would hide the
parterre, a fence would read as farm, a hedge would read as wild.
- Recipe: a white top rail over regularly spaced small posts, running
  along the garden boundary, ~1 block + rail tall so the mansion stays
  visible over it from the approach. At path crossings, break it with
  square gate piers: 2×2 pale pillars, 2 tall, capped with a slab or
  small pyramid, with the path passing between them (no gate leaf
  required — the piers ARE the threshold). Baluster block is builder's
  choice (fence vs wall vs iron-bar posts not distinguishable at this
  distance).
- Scope: the balustrade encloses the front forecourt lawn (which is
  otherwise empty green), not the garden rooms — its job is forecourt
  edge, with the mansion visible over it.
- Apply when: formal estate boundaries, garden edges facing a public
  approach, any grounds that need a "designed edge" rather than a wall
  or hedge. NOT when: defensive builds (a 1-block balustrade on a castle
  reads as a mistake — use technique 4/5 fortification language); small
  plots (a balustrade around a cottage garden reads as a dollhouse
  fence — use technique 5 hedges).
- Prevents: the "garden bleeds into wilderness" read — formal grounds
  with no edge look unfinished at the boundary, however good the beds
  are. (French Mansion ref: f0085–f0096, f0090, f0095.)

### 30. Indoor orangery
Technique 7's interiors cover room anchors, storage walls, and flower
pots as the "alive" signal — but no entry gives a *garden room*: a room
whose entire furnishing is planting. The orangery works because it
inverts the normal interior rule (furniture first, plants as accents):
here the planters ARE the furniture, stepped in height so the room reads
as a terraced greenhouse rather than a storage room with pots.
- Recipe: floor in dark planks. Along both side walls run stepped
  moss-block planters: 2–3 tiers stepping up toward the wall (each tier
  1 block higher and 1 block deeper than the last), planted with leaf
  topiary (tall columns + blobs), roses (red flowers), and occasional
  white flowers as accents. Keep a 2–3-wide clear plank path down the
  room's center — the path is what makes it a room you walk through,
  not a greenhouse you look into. Warm light only (lanterns or hidden
  glow, never bright white) so the green reads lush, not clinical.
- Apply when: mansion/palace interiors with a room to spare,
  conservatory/orangery/garden-room programs, any interior that needs a
  "wow" room without furniture cost. NOT when: small houses (an orangery
  in a 2-room cottage eats the whole interior budget — use technique 7's
  flower pots instead); survival-functional rooms (the orangery is pure
  display — never put the enchanting/smelting/storage core in it).
- Prevents: the "every room is a bedroom" interior — a large furnished
  house where every room has the same bed-table-shelf kit reads as a
  hotel; one garden room breaks the pattern for the cost of leaves and
  moss. (French Mansion ref: f0132 only — sharp, complete close-up.
  f0131 is the living room/library, NOT the orangery; do not cite it
  for this technique.)

### 31. Outline-first layout
Technique 2 says "mark the footprint before placing anything" — for one
house. This scales that marking to the whole plan: draw the plan on the
ground in 1-wide contrasting lines before building vertically. The
ground drawing is the contract — the composition is decided in plan
view, not discovered wall by wall. Two recipes, one grammar; small
builds use technique 2's corner-marking, large single builds use the
full outline, compounds use the zone plan.
- Recipe A — sacrificial footprint outline (single complex builds): lay
  the full footprint outline 1 block wide in a high-contrast sacrificial
  block (gold blocks on green grass in the reference — any block that
  reads against the terrain works), exactly on the foundation line,
  following wing projections. Build the stone foundation over it
  section by section, replacing the outline as you go; the last outline
  segments vanish when the floor slab fills. Keep the outline 1 wide
  and exactly on the foundation line — a 2-wide or offset outline
  confuses the wall line. Prevents wing drift: without a drawn outline,
  long builds accumulate 1-block alignment errors between wings that
  only show up at roof height.
- Recipe B — compound zone plan (compounds): on flat grass, lay the
  site plan as 1-wide outline lines in contrasting materials (tan/orange
  guide lines first, inked dark for the perimeter; white lines for
  building/courtyard zones). Each rectangle is one future zone: main
  hall, wings, gatehouse, courtyard, garden. Build zones in sequence
  against the plan. Keep the plan legible: outlines only, no fill — a
  filled zone reads as a floor, not a plan. Work from a dimensioned plan
  (note the key spans before building); the reel's on-screen dimension
  numbers are video-overlay typography, not blocks in the world — never
  write them as a build step.
- Persistence distinction — do not flatten it, or the merged technique
  is wrong about both reels: the compound's zone lines PERSIST until
  their zone is built, then get absorbed into floors/paths; the single
  build's sacrificial outline is progressively REPLACED by foundation.
- Apply when: large builds where the footprint shape is non-trivial
  (wings, projections, courtyards) / compounds, estates, villages, any
  multi-building site. NOT when: a single standalone building (technique
  2's corner-marking is enough); on sloped terrain (the plan lines break
  across terraces — flatten the site first or plan per terrace).
  (French Mansion ref: f0001–f0012, f0002 gold outline with stone
  replacement underway; Japanese House ref: f0001–f0008 plan sequence,
  f0024/f0053–f0055 persistent lines, f0066–f0068 finished compound on
  planned lines.)

### 32. Machicolation gallery band
Technique 7's parapet is just an alternating high/low rim, and technique
5's base crenellation is the same verb at the bottom. Neither gives the
*projecting gallery*: a full course that juts past the wall face, topped
by a parapet, with a row of openings hanging below it. The projection +
the opening row + the shadow gap underneath are what sell "fortified" —
a flat parapet on a flush wall reads as trim; the gallery reads as a
fighting platform.
- Recipe: at each stage transition, run a 1-block-proud course around
  the full perimeter, top it with a crenellated parapet (alternating
  merlons), and cut a row of openings directly below the projecting
  course — dark/inset so they read as murder holes, not windows. The
  band must project: flush openings under a flush parapet are just a
  window row (technique 7), not a gallery.
- Vary the opening shape by level — do NOT copy-paste one row at every
  transition: lower band (stage 1 → 2): pointed arches, 2–4 tall, spaced
  2–3 apart; upper band (stage 2 → 3): small square murder-holes under
  the parapet. Both shapes are visible in a single frame in the
  reference — this is not a resolution artifact. Cross-ref technique 15
  for arch construction instead of re-specifying it.
- Apply when: fortress/keep/castle towers, defensive walls, any build
  whose theme is "can withstand attack". NOT when: domestic builds (a
  machicolation band on a cottage reads as cosplay); more than one band
  language per build (gallery XOR technique 7's plain parapet on the
  same tower — the gallery already contains a parapet); on shafts <5
  wide (the projection eats the wall).
- Prevents: the "flat parapet" read — a crenellated rim with nothing
  under it looks pasted on; the gallery gives the parapet a reason to
  exist. (Heavy Tower ref: f0004 close-up lower arches; f0006 both bands
  in one frame; f0007, f0013.)
- Merlon / crenel rhythm with a corbel-flare option (sub-entry). Fit: this entry is the only one with a
  crenellated-parapet recipe,
  but it says only "alternating merlons" and gives no rhythm; technique 7's
  terrace parapet and technique 5's base crenellation name the verb without
  one either. This bullet supplies the rhythm as a parameter. The XOR guard
  above stands: a flare under the parapet is what makes it a gallery (this
  technique); the same rhythm with no projection is technique 7's plain
  parapet.
  - Rhythm: the merlon:crenel ratio varies and is a parameter, not a single
    rule. Heavy-tower f_007: the small upper ring alternates merlons and
    crenels at about 1:1 (blurry; not counted). Heavy-tower f_005: the
    parapet on the corbelled arcade has merlons visibly wider than the crenels
    (frame reader A: 3–4 "bricks" against 1; the unit is not resolved).
    French-mansion f_048: four merlons ~2 wide with ~1-block gaps, about 2:1,
    from one perspective view; the same notched parapet repeats around the
    terrace edges (f_049, f_055–f_063), in the facade's own block, one cap
    course above the cornice. Default ratio is open.
  - Corners: the corner cell is always a merlon; in heavy-tower f_005 the
    front-corner merlon steps up ~2 above the rest. Merlon height over the
    crenel floor ~1.
  - Corbel flare (option): the crown overhangs the wall by ~1–2 on stair corbels
    under the parapet (heavy-tower f_004, f_005; f_007 shows a stair/slab dentil
    course under the upper ring). French-mansion has none (flush parapet), so
    it is a plain terrace parapet. Overhang depth is unresolved.
  - Unresolved: merlon and crenel counts per face; overhang depth; the default
    ratio. A 1:1 ratio is also reported by the evidence reader for another reel
    that is not cited here.
  - Shape: voxwright mcbuilder `shapes.parapet` (draft, in progress).
- More merlon / crenel data points (sub-entry, draft — not roasted):
  Disruptive builds wave 2. The rhythm bullet above leaves the default ratio
  open. Two more readings: the castle curtain wall runs about 1:1 with a
  merlon cube above each pilaster and the crenel above each recessed bay (f_226,
  f_307, f_317; see technique 48), the cube standing about 1 block proud of the
  wall face on a stair corbel; and the bell tower's 5-wide crown reads as a
  merlon about 2 wide on each side of a 1-wide gap, corners raised 2 courses
  (f_550, f_567; counted by eye, not recounted block by block). Small corner
  turrets with notched tops and a lit lantern stand on the wall corners (f_307,
  f_308, f_309). Unresolved: per-face merlon counts, the corbel block half and
  facing, turret size. (Disruptive builds ref: mining outpost, bell tower.)

### 33. Stepped tower staging
Technique 4's compound hierarchy composes *multiple* towers (flankers +
one dominant); technique 13's stacking discipline governs ornament on
*narrow* (≤6×6) towers. Neither covers a single WIDE tower that narrows
in discrete stages: wide base shaft → narrower second stage → narrower
third stage → spire, each stage capped with its own gallery/parapet.
The staging is the silhouette: without the steps the tower is an
extruded box; with them it reads as engineered mass.
- Recipe: build the tower in 3 stages (2 minimum): each stage 1–2 blocks
  narrower per side than the one below, each stage transition marked by
  a full-perimeter gallery band (technique 32) or at minimum a proud cap
  course + parapet. Stage heights: base stage tallest (~40–50% of shaft
  height), upper stages progressively shorter. The top stage is the
  narrowest and carries the crown grammar (spire) — never another full
  stage. Keep the total footprint wide (≥8×8 base) — on ≤6×6 footprints
  this collapses into technique 13's territory and the steps read as
  stacking, not staging.
- Massing guard (folded in): on a staged wide tower, the shaft gets
  noise + slit grid only — no balconies, awnings, bays, or trim bands —
  and the entire ornament budget goes to the transitions (galleries)
  and the crown. If a face starts accumulating detail beyond noise +
  slits, the massing has broken — strip it back.
- Apply when: fortress towers, keeps, lighthouse-style monuments, any
  single tower meant to read "heavy". NOT when: narrow wizard/fantasy
  towers (use technique 13 + a loggia/belfry crown); when the build
  needs a flat roof (staging forces a stepped silhouette — pick one);
  more than 4 stages (reads as a wedding cake).
- Prevents: the extruded-box tower — one unbroken shaft from ground to
  spire, however tall, reads as a stretched cube; the stages are what
  give it designed mass. (Heavy Tower ref: f0014, f0016, f0017, f0018,
  f0019 — three clear stages + spire from every angle.)

### 34. Stepped dark spire with accent + finial
Technique 4 covers spires only as a generic "one vertical accent" and
pyramid roofs at *pavilion* scale (stepped stair roof, slab + finial
cap). The heavy tower's spire is a different animal: a tall (roughly as
tall as the stages below it) dark-stone stepped taper that contrasts
the pale shaft, carrying exactly one accent block near the tip and a
thin finial spike — plus one subordinate spire at ~60% height on a side
turret. The dark-vs-pale contrast + the single accent are what make it
a crown rather than a roof.
- Recipe: spire material: a dark stone family contrasting the shaft
  (dark deepslate/stone against pale stone brick). Profile: stepped
  taper — inset roughly 1 block per 2–3 blocks of rise (steeper than a
  pyramid roof's 1:1, so the spire reads tall, not squat; ratio estimated
  from the stepped profile, not block-counted). Near the tip (2–4 blocks
  below the finial), place exactly ONE accent block in a saturated color
  (red in the reel — red family only; concrete vs wool vs redstone block
  indistinguishable at this resolution, do not assert a specific block)
  — one block, never a band. Finish with a thin finial: 1×1 dark spike
  2–4 tall. Subordinate spire (optional, at most one): same construction
  at ~60% height on a corner/side turret, no accent block — the accent
  belongs to the main spire only. The subordinate turret may carry a
  small arched window.
- Spire-base arcade (named sub-section, NOT a separate technique): in
  the spire's lower third, punch 2–4 small arched openings (1–2 wide,
  2–3 tall) with pale-stone surrounds, spaced around the taper. Keep
  them small and few — the spire must read as mass first, arcade
  second. The pale frames contrast the dark spire stone, so the openings
  read as a deliberate arcade, not damage — and they tie the dark crown
  back to the pale tower. Exclusions: short spires (no room — the arcade
  crowds the taper); pale spires (no frame contrast — the openings
  vanish). Exact opening count per face not resolvable at distance.
- Apply when: fortress/keep towers, dark-fantasy crowns, any tower whose
  shaft is pale and needs a dark crown to terminate. NOT when: the shaft
  is already dark (no contrast — the spire vanishes into the shaft);
  pale/light spires (that's technique 4's pyramid roof, not this); more
  than one accent block (two red blocks read as a mistake, not a
  detail).
- Prevents: the flat-stop failure (technique 13's named enemy) on wide
  towers — and the "spire as afterthought" (a 3-block pyramid cap on a
  30-block tower reads as a hat, not a crown). (Heavy Tower ref: f0009,
  f0010, f0011, f0016, f0017; arcade f0012, f0016.)

### 35. Paired slit window grid
Technique 7's window recipe is domestic (glass panes + shutters +
flower box, repeated in vertical columns). Technique 13's quiet-shaft
corollary allows at most one narrow slit per face on landmark shafts.
The heavy tower does neither: its windows are *pairs* of 1-wide ×
2-tall dark slits (no glass, no shutters, no trim), repeated in a strict
grid — several pairs per face, aligned in rows and columns across the
whole shaft. The pairing + the grid are the grammar: single slits read
as arrow loops; paired slits in a grid read as a fortress's window
system.
- Recipe: windows as pairs: two 1-wide × 2-tall dark openings (air or
  dark blocks, never glass) spaced 1 block apart, pairs spaced 3–4 blocks
  apart horizontally and 4–6 vertically, aligned to a strict grid on
  every face. No sills, no shutters, no lintels — the grid alignment IS
  the detail. On the upper stages the pairs sit between pilaster ribs;
  on the main shaft they sit on the flat wall.
- Standalone, NOT a technique 7 extension: it inverts every detail of
  technique 7's domestic recipe. The technique 13 override is scoped to
  wide fortress towers only: technique 13's quiet-shaft corollary
  governs landmark shafts and ≤6×6 footprints, and technique 13's own
  guard explicitly releases ≥8×8 footprints to free composition — this
  technique gives that free composition its discipline.
- Pairs-dominant, not pairs-exclusive: one lone single slit (stairwell,
  door) does not break the grid — do not over-police this into "pairs
  ONLY".
- Apply when: fortress/keep/castle shafts, defensive walls, any wide
  tower where windows must read as fortification, not domesticity. NOT
  when: domestic builds (use technique 7's full window recipe); narrow
  landmark shafts (technique 13's quiet-shaft corollary still governs
  there); when the wall already carries heavy ornament (grid + ornament
  = noise).
- Prevents: the "house windows on a castle" failure — glass + shutters
  on a fortress shaft kill the fortified read instantly. (Heavy Tower
  ref: f0007, f0013, f0014, f0016; lone slit f0013.)

### 36. East-Asian tiled roof grammar
Technique 4 covers dark stair-block roofs and two-tone striping, but no
East-Asian roof construction. This roof's read comes from three things
working together: the dark tile field, a stacked eave band, and corners
that sweep upward instead of stopping flat.
- Recipe: roof field of dark stair blocks (deepslate tile family), hip
  or gable profile, overhanging the walls by 1–2 blocks. At the eave,
  stack 2–3 visible bands: dark tile overhang on top, a saturated red
  trim band beneath it, and a timber fascia band beneath that — the
  bands are what make the eave read as layered joinery rather than a
  slab edge. White rafter-tail blocks under the eave sharpen the stack.
  At each corner, step the eave courses upward 1 block over the last
  2–3 blocks of run so the corner lifts — subtle (1 block of rise),
  never a horn. Finish the ridge with short red accent blocks at
  intervals (red ridge ticks) or a continuous red ridge band on accent
  buildings. On two-story halls, stack TWO roof tiers — a lower eave
  roof over the ground-floor veranda plus an upper roof over the second
  story.
- Apply when: Japanese/Chinese/Korean-inspired builds, temple compounds,
  any build where the roof is the primary silhouette. NOT when:
  European medieval (use technique 4's gables + technique 15's arches);
  on small roofs <5 wide (the band stack eats the whole roof — use a
  single trim band instead).
- Prevents: the "dark lid" roof — a flat dark slab that caps the
  building without detailing; and the straight-triangle gable on an
  East-Asian build, which reads as the wrong continent. (Japanese House
  ref: gatehouse eave stack f0010–f0012; wall wing f0019; two-tier main
  hall f0046/f0048; red ridge ticks/band f0049–f0052; corner lift f0019.)

### 37. Roofed compound wall + gatehouse pavilion
The compound's edge is not a fence or a bare wall — it's architecture:
a roofed corridor wall with a gatehouse pavilion breaking it. The wall
carries the compound's palette (white plaster, red trim, dark tile roof)
so the boundary reads as part of the build, not as a property line.
- Recipe: perimeter wall: white plaster face, 1 red trim band at the
  base and 1 under the eave, dark tiled roof capping the full run,
  sitting on a white stone footing course. Height ~3–4 blocks plus roof.
  At the entrance, break the wall with a gatehouse pavilion: 4 timber
  pillars on a white stone platform, open on all sides, carrying its own
  tiled roof with the layered eave (technique 36) — the pavilion is the
  door, not a hole in the wall. Keep the wall's roofline continuous
  except at the gatehouse, where the pavilion roof steps up above it.
- Apply when: walled compounds, temple grounds, estates, palace sites.
  NOT when: villages (open edges read as lived-in — a roofed wall
  around a village reads as a fortress); single houses (the wall dwarfs
  the house — use a garden fence or hedge instead, technique 5).
- Prevents: the fence-line compound — a bare wall that makes the estate
  read as a prison yard; and the hole-in-the-wall gate, which reads as
  damage rather than arrival. (Japanese House ref: wall wing f0013–f0020;
  corner + gatehouse complete f0021–f0023; wall close-up f0063; gatehouse
  from inside f0064–f0065; full perimeter f0066–f0068.)

### 38. Vermillion pavilion pair
Technique 10 says one oversized anchor justifies the theme — size-based.
This is the color version: in a monochrome compound (white + dark +
timber), paint the flanking side halls in a saturated accent —
vermillion red on columns, beams, and trim — and they become the
compound's focal pair without any size advantage. Technique 10 family:
technique 10's own Manor example (paired chimney stacks as anchor)
already endorses symmetric pairs as anchors.
- Recipe: pick the secondary halls flanking the main hall (never the
  main hall — the main hall owns the size hierarchy). Paint their full
  structural systems in the accent: columns, beams, eave trim,
  door/window frames — structure, not decoration. Keep their walls white
  and their roofs dark like the rest of the compound, so the accent
  reads as "the same buildings, in red" rather than a different style.
  One accent color only, applied symmetrically — prefer the pair; a
  lone accent hall needs its own justification (e.g., it is the only
  secondary hall). The reel shows no single-red failure case, so the
  pair preference is stated as preference, not as an observed failure.
- Apply when: compounds with 2+ halls, temple complexes, palace sites.
  NOT when: single buildings (a lone red house is just a red house —
  the anchor needs a monochrome context to contrast against); palettes
  that already run 3+ saturated colors (the accent drowns).
- Prevents: the flat compound — three white halls in a row read as a
  barracks; red flanking halls give the eye destinations on both sides
  of the main hall. (Japanese House ref: f0049–f0052 red hall on stepped
  plinth; f0053–f0055 BOTH red halls flanking the main hall; f0066–f0068
  twin pair in the finished showcase.)

### 39. Tile-and-sand courtyard grid
Technique 8's zen bed is restraint (one sand bed, 3–5 elements, negative
space). This courtyard is the formal counterpart: a white tile field
with MULTIPLE sand rectangles inset in dark borders, composed as a grid
— the sand is a paving material here, not a meditation object.
- Recipe: pave the courtyard in white tiles (quartz/white concrete
  family). Inset 2–4 sand rectangles (yellow sand/gravel), each bordered
  by a 1-wide dark stone course, aligned to the courtyard's geometry
  (parallel to the main hall, never diagonal). The center stays EMPTY —
  no central pillar: the tall dark pillar in the reference stands on the
  main-hall terrace, not in the courtyard. All verticals live at the
  edges (curb lanterns, rails). Edge the courtyard with a low stone curb
  + bamboo rail caps (yellow bamboo rails on white stone posts), red
  lanterns on curb posts at intervals. Enter it by a wide ceremonial
  stair (5–6 wide, stone, bamboo-railed curbs).
- Apply when: formal courtyards, temple forecourts, palace grounds. NOT
  when: the garden story is wild/restrained (use technique 8's zen bed
  — one bed, negative space); small courtyards <7 wide (the grid chops
  the space into postage stamps — use a single sand bed instead).
- Prevents: the empty-tile plaza (a big white floor with nothing in it
  reads as unfinished) and the sand-pit courtyard (unbordered sand reads
  as a beach, not a garden). (Japanese House ref: f0027 — white tile
  field, two dark-bordered sand rectangles, bamboo-railed curb, red curb
  lanterns, wide stair; f0031/f0033 same courtyard from other angles.)

### 40. Porch as mini stepped-gable pavilion
Technique 11 stages the approach (gate, path, hero prop) and technique
27 gives the grand pavilion + stair — but no entry gives the small
version: the entrance porch as a miniature of the main gable, a
stepped-gable canopy over the door on timber columns, with its own
stone stair platform. The crown later repeats the porch — the echo
arrow runs porch → crown, NOT crown → porch.
- Recipe: door 1 wide, centered, FLUSH with the wall (not recessed);
  the porch is built in front of a flush door. Two dark-oak log columns
  flanking the door, 4 tall (measured from the platform deck), ~4 apart
  (inner faces). Canopy: stepped terracotta stair-block gable, ALL
  terracotta (no dark fill), 3 steps per side, front edge flush with the
  column faces (measured from the column line, not the facade).
  Platform: stone-brick, ~6 wide, projecting ~2 blocks past the facade,
  4 slab steps down to grade (platform ~2 above grade — the steps are
  slabs, or the top tread is the deck itself). Low stone cheek posts at
  the platform's front corners (~2 tall, cap blocks).
- Novelty (vs technique 7): technique 7's two porch entries are SHADE
  PLANES — the plank-slope awning (2 blocks out, on fence posts) and the
  stair-hood awning (3 courses, no posts, mounted). This is a MASS, not
  a plane: a solid stepped-gable canopy on timber columns with its own
  stair platform. Technique 27's pavilion is the same idea at mega scale
  (≥15-wide facade, projecting middle bay + grand stair). This is the
  mini-scale mass version techniques 7 and 27 both leave open.
- Build it in one pass: columns + canopy + platform + 4 steps together.
  The reel builds the steps a frame later (two visits to one small
  element) — do not copy that.
- Apply when: any mansion/tower build with a front door that needs
  ceremony at small scale. NOT when: the facade already has a grand
  pavilion (mini porch + grand pavilion fight — pick one entrance
  grammar); side/back doors (a mini gable on every door reads as a
  dollhouse).
- Prevents: the "door in a wall" failure at small scale — same failure
  as the French pavilion entry, for builds too small for a pavilion.
  (Tall Mansion ref: f_004 canopy + columns + platform; f_005 steps
  down to grade; f_012 finished porch.)

### 41. Stepped east-face profile
The tower's east wall steps down in pale stone toward the wing roof
(~5–6 steps, 1 block in per 1 block down) — a staircase-profile wall
that transitions a tall volume down to a lower roof without presenting
a sheer flat wall above it. Promoted from the 7th observation in the
Tall Mansion draft at lock time (Luki tap 2026-11-07).
- Recipe: where a tall volume meets a lower roof on one face, step the
  tall wall down toward the roof line in 1-block-in per 1-block-down
  steps (~5–6 steps, approximate — the profile's exact start height is
  the tower top, its end is the wing roof line), in the wall's own pale
  material, so the transition reads as a staircase profile, not a cut.
- Apply when: a tall tower or volume stands beside a lower roofed wing
  and the tall face would otherwise hang as a sheer wall above the lower
  roof. NOT when: the tall face already carries a slope, a stepped gable
  crown, or a belvedere on that side (one transition grammar per face);
  on faces where the tall volume meets open sky, not a lower roof (there
  is nothing to step down to).
- Prevents: the "sheer wall over a roof" read — a tall flat wall hanging
  above a lower roofline looks like the build was cut in half. (Tall
  Mansion ref: f_010 first clearly visible — may have been built with
  the tower walls and only become visible from this angle now, so the
  build step carries an angle-reveal risk; the profile itself is
  frame-confirmed.)

### 43. Mid-tower skirt roof as stage separator
Source: Alixxa cozy medieval tower (stage-1
candidate 1, confidence HIGH; `reels/alixxa-tower/stage1/01-alixxa-tower.md`).
Not folded, not in the band table; band proposed: mini (7×7 base, ~5×5 upper).
Technique 33 stages a wide tower at mega scale, and the mini-scale
substitution above says never to narrow a tower in discrete 1-block stages.
This tower narrows once, 7×7 to ~5×5, and still does not read as a wedding
cake, because the setback is not a tier: it is a roof. A wide flat spruce
skirt at the junction turns the stage change into an eave, so the eye reads
"lower tower with a roof, upper tower growing through it" and not "box on
a box".
- Recipe: lower shaft 7×7, 15 tall (the reel's label). At its top the upper
  shaft (~5×5) rises from the centre, leaving a ~1-block terrace ring
  around it. Over the ring lay a wide flat spruce roof ~11×11 (±1),
  overhanging the lower shaft by ~2 per side and the upper shaft by ~3,
  with the upper shaft poking through its centre. Railing: spruce trapdoors
  around the ring's outer edge, installed BEFORE the skirt; the skirt roofs
  over the railing.
- Profile, as read in 4× crops (frame reader A; the stage-1 note did not
  record the dentil row): (1) a continuous rim ring of full plank blocks,
  ~1 block high on its front face, flush at the corners, no diagonal hip
  rib, no corner post; (2) directly under the rim a dentil row, every second
  block of the ring missing (pitch 2, "block, hole, block, hole"), 1 block
  high; (3) on top, a low stepped hip rising toward the shaft in ~2
  terraces of half-height pieces laid in a staggered checker; total
  thickness at the shaft ~2–3, rise ~2 over a run of ~3, so it reads as a
  flat brim and not as a normal hip. Underneath: oak trapdoor corbel
  brackets and hanging lanterns at the four corners and over openings.
- The terrace doorway: the upper shaft carries a dark doorway (~2 wide ×
  ~3 tall) on the front face at ring level, visible from the frame where
  the upper shaft rises and persisting to the final frame. The ring is
  reachable from inside, so it is circulation, not decoration. No door is
  installed.
- Apply when: any two-stage tower at mini scale (≤9×9 base) where the stages
  need a legible break. NOT when: the stage change is already marked by a
  gallery band (technique 32; one transition grammar per tower); single-stage
  towers; an upper stage ≤3×3 (the ring becomes a gutter, with no room to
  stand).
- Prevents: the "box on a box" read, a narrower shaft sitting directly on a
  wider one with no transition. The skirt must stay mandatory: the
  wedding-cake lint reasoning for this tower (one setback, then a pointed
  crown) depends on the skirt doing the work.
- Unresolved (name them, do not settle them): course count of the skirt
  (rim, dentil, terraces: "about 3" is a relative-height guess); stair vs
  slab for the terrace pieces and the rim; the `facing` and `half` of any
  stairs; whether the dentil row is blocks, stairs or trapdoors; the width
  to ±1.
- Shape: voxwright mcbuilder `shapes.skirtRoof` (draft, in progress).
- (Alixxa ref: f_011 rim railing; f_012–f_014 upper shaft rising and the
  doorway; f_015 skirt from above; f_016 underside lanterns; f_017 finished
  two-stage tower, where a second skirt-type "hat" also sits under the crown.)

### 44. Steep stepped pyramid crown with spire finial (provisional — course count, eave, apex unresolved)
Source: Alixxa cozy medieval tower (stage-1
candidate 4, MED, PROVISIONAL). Smoke test required before folding. Band
proposed: mini. The crown appears in ONE frame (f_017), from one oblique
view, so everything below is what is visible, not a tested build.
Technique 4's pyramid entry is pavilion-scale (squat, slab + finial cap),
and technique 34's spire is dark stone with one accent block. This crown is
neither: a steep warm spruce pyramid on a pale stone shaft, capped with a
thin post. It reads by silhouette and warmth, not by dark-on-pale
contrast; no accent block is visible and none is needed.
- Visible: the pyramid stands on a wide skirt-type "hat" roof (~12 wide,
  11–13, with the same rim and dentil row as technique 43) that sits on the
  flared head of the upper shaft. Above the hat's rim, four stepped tiers are
  visible, each inset from the one below, with dark recess cells alternating
  with plank blocks in a staggered checker on the lower tiers. The top tier
  is a 1×1 column, and a thin post (fence-post thickness, ~4–5 tall) rises
  from it.
- Two readings of the size, not reconciled: the stage-1 note reads ~7 tall,
  stepped 1-in-1 from a ~7×7 eave to an apex ≤2, spire ~3; frame reader A
  reads four tiers of ~2.5–3 each, about 12–13 tall plus ~4–5 of post, at
  roughly 1 block of inset per tier. The crown is steeper than a pavilion
  pyramid in both readings.
- Apply when (provisional): small towers (shaft ≤7×7) that need a finished
  top and already carry a warm accent elsewhere (skirt roof, awnings, door)
  for the pyramid to echo. NOT when: the shaft is already dark; the tower
  already carries a belvedere, belfry or gable crown (one crown grammar per
  tower); wide shafts (≥8×8; use technique 4's roof grammar).
- Open questions (smoke test required before folding): exact course count
  and the inset sequence per tier (1 or 0.5 per ring); full blocks, stairs
  or slabs per tier, and the `facing`/`half` of any stairs; whether the
  recess cells are missing blocks or half-blocks; the 3D plan (only one
  oblique view exists); the eave (slab vs stair edge) and its overhang; the
  apex block and the post length (fence stack vs lightning rod: not
  resolvable).
- Crenellated rim: a stone merlon rim is clearly visible on the upper shaft
  in f_016, and in f_017 the eave sits on that line. Whether it was kept,
  removed or buried is unresolvable. This reel gives NO crenellation
  recipe; do not fold one from it.
- (Alixxa ref: f_016 rim before the crown; f_017 hat, pyramid and post,
  final frame.)

### 45. Stacked pier-and-post bay
Source: Hibouk "Winter Mansion" (stage-1
candidate 1, confidence MED; `reels/hibouk-winter-mansion/stage1/01-hibouk-winter-mansion.md`).
Band proposed: mid (an 8-wide bay on a ~34-long front). Not in the band table.
A two-material facade reads as one structure when the upper floor's posts land
on the ground floor's piers and the openings on both floors follow the same
bay grid, instead of a timber box floating on a stone box. Techniques 1 and 3
give the material change per story; this gives the load path between the
stories.
- Recipe: ground floor: 1-wide stone-brick piers ~5 tall, 1-wide glazed slits
  between them (glass panes, ~3 clear), the central double-width gap becomes
  the double door with stone cheek piers. Pattern for an 8-wide bay:
  `P S P SS P S P`. Upper floor: a stripped-log post directly above each
  pier, a log sill beam and head beam, a log-end (end-grain) square at every
  post/beam junction, glazed openings between the posts, stepped plank fill
  under the gable (with a 1×1 open square near the top). Openings stay
  unshuttered; dressing is red banners hung in two openings and wall lanterns
  on short fence-arm brackets on the posts. Ground-level planting replaces
  window boxes: rose bushes at the foot of the slits and 2-high shrub-on-planter
  pairs flanking the door.
- Apply when: a facade ≥ ~8 wide on a two-material, two-story building (stone
  ground floor, timber upper) where the windows should read as part of the
  structure. NOT when: the upper floor is jettied (the overhang pulls the posts
  off the pier line: jetty XOR stacked bay, one rhythm per face as in
  technique 2; inferred from the tavern reel, which jetties and does not
  align); fortress faces (technique 35 grid); ≤6×6 towers (technique 13).
- Prevents: the "two boxes stacked" read and windows punched at unrelated
  spacing.
- Unresolved: exact pier height (±1, avatar-scaled); whether upper post width
  equals pier width (read as 1, not counted); the stair `half`/`shape` states
  of the roof above. Lint question, open and not settled here: an 8-wide
  ground bay with two symmetric 1-wide slits flanking a double door on a face
  ≤10 wide; whether the pareidolia lint fires is for the roast.
- (Hibouk ref: f_008 ground bay under construction; f_018 upper frame over it;
  f_026 and f_034 neighbouring bays; f_107 finished facade in the viewer.)
- Independent upper rhythm over an arcade (sub-entry, draft — not roasted):
  Disruptive builds wave 2. The recipe above lands each post on a pier. The dam
  is the counter-case: 4 arcade bays below and 7 gallery posts above (6 post
  bays), counted at full resolution (f_067), so the posts do not land on the
  piers, and the two rhythms are independent. It still reads as one structure,
  and the likely reason, inferred from f_040 and f_067, is the continuous
  stone course and the relieving frieze (technique 15 sub-entry) that sit
  between the two rhythms and act as a transfer plate. Apply when: an arcade
  carrying a timber structure over a span (infrastructure). NOT when: a
  two-story facade of ≥~8 wide, where this entry's own stacked-bay rule
  governs. Unresolved: the pier and bay spans. (Disruptive builds ref: dam;
  f_040, f_067.)

### 46. Ridge cresting — timber post-and-rail along the ridge
Source: OMGGamer "Medieval Tavern" (stage-1
candidate 1, confidence MED; `reels/omggamer-medieval-tavern/stage1/01-medieval-tavern.md`).
Single reel. Band proposed: mini (a 1-block-high element; the minimum ridge
length it needs is not resolvable). Not in the band table.
Technique 4's silhouette tools break the roofline with chimneys, towers,
dormers, spires and cross-gables, and its flat-roof entry finishes a flat
edge. Nothing in the guide finishes the ridge of a plain pitched roof. The
tavern puts a continuous rail along the ridge with 1-wide posts rising above
it: an alternating high-and-low pattern at the top line of the building, in
the same timber as the frame, so the roof outline reads as designed and not
as a bare stair edge.
- Recipe (two-step build): first a plain log ridge beam along the ridge that
  overshoots both gable ends by ~1. Then raise a rail along it (~2 courses
  tall as read) and set a 1-wide log post every ~4th cell (≈3 clear between
  posts), each rising ~1 block above the rail top, end posts capped. Repeat on
  the cross-gable ridge at a smaller scale. Same timber species as the wall
  frame.
- Apply when: timber-frame or half-timber builds with a long gable ridge where
  the roof is the largest plane and the ridge line is bare. NOT when
  (inferred guards): hip-roofed or pyramid-roofed builds (no ridge run);
  builds that already carry a crown grammar on the ridge (a belvedere,
  technique 4; ridge ticks, technique 36), because one ridge language per
  roof; masonry or fortress roofs; a ridge too short for ≥2 posts between the
  end caps.
- Prevents: the bare-ridge read, a long unbroken stair edge on the top line.
- Unresolved: post pitch (≈4, ±1, perspective); rail height (one 2-high
  member vs two stacked members); whether posts rest on the rail or on slabs;
  log vs stripped log. This is timber on a ridge, not crenellation, and is not
  a parapet.
- (Tavern ref: f_002 and f_007 plain ridge beam; f_009 posts newly added; f_013
  and f_020 finished cresting on both ridges.)

### 47. Benched excavation pit
Source: Dio Rods "Waterfall Quarry Survival Base"
(stage-1 candidate 1, confidence MED; stills q01–q07, not video;
`reels/dio-rods-waterfall-quarry/stage1/01-waterfall-quarry.md`). Band
proposed: mega (technique 9's band). Not in the band table.
Technique 9 says to anchor a build on a terrain feature ("quarry pit,
waterfall, flooded basin") but gives no construction for the feature itself. A
pit that is just a rectangular hole reads as a missing chunk of the world; this
one reads as worked ground because the walls are benched, jittered and
layered, the rim blends outward, and timber and stairs give the hole its
scale. The construction is the cut.
- Recipe (as seen in the stills): (1) cut a rectangular pit with an irregular
  rim, roughly a lodge-plus-yard in plan; (2) step every wall down as benches,
  ledges of 1–3 blocks (a reader's estimate, not counted), not a funnel, with a
  straight stone staircase cut into the wall along them; (3) jitter the wall
  faces and the rim in and out by ~1–3 blocks so no face is planar; (4) show
  strata at the outer cut face: grass, a brown dirt band, then stone; (5) blend
  the rim outward in three interleaving bands, light-grey stone, orange-brown
  dirt patches, grass, with noisy boundaries; (6) mix the rock from four or
  five stones with moss and vine patches on lower walls and ledges; (7) tie
  timber to the rock: 1-wide wall support beams 1–2 off the face with a top
  beam back to the rock, a timber-framed tunnel mouth cut into a wall, bridge
  portal posts resting on ledges; (8) give the floor a function: flooded with
  lily pads, or stock and ore at the rim.
- Apply when: a survival base, quarry or mine diorama whose anchor is an
  extraction pit. NOT when: the feature is a hill the compound wraps
  (technique 9's inverted orbit verb); a pit with no stairs, bridge, stock or
  water on it, which reads as a hole; flat featureless sites where the cut has
  no hill to show strata against (inferred guard).
- Prevents: the "rectangular hole" read, the "funnel" read (one slope from rim
  to floor), and a clean-rimmed hole that sits on the terrain like a stencil.
- Unresolved: ALL dimensions (pit size and depth, bench count, height and
  depth, waterfall drop, bridge spans); the exact rock mix; whether the pink
  cast on the stone is the shader or the blocks.
- (Dio ref: q07 overview and rim; q01, q02 pit from two sides; q04 benches,
  jitter, support beams, stairs; q06 stair, tunnel mouth and rim stock.)

### 48. Curtain wall in phase — pilaster, recess, hoarding slat and merlon on one period
Status: draft — not roasted. Source: Disruptive builds reel, the castle
gatehouse (the mining outpost; frame evidence B4, stage-1
`reels/disruptive-builds/stage1/04-mining.md`). Band proposed: mid (a guess:
wall length, bay and tower widths are unmeasured). Not in the band table.
Technique 32 gives a projecting gallery band at a stage transition, its
sub-entry gives the merlon rhythm as a parameter, and technique 35 gives a slit
grid for a fortress face. None says how the wall FACE below a parapet is built.
This curtain wall puts the face, the hoarding and the parapet on one period, so
the wall reads as engineered and not as a flat slab with a crenellated rim.
- Recipe (as seen): the wall face alternates 1-block-thick protruding
  pilasters with recessed dark bays. Directly above each pilaster a merlon
  cube stands about 1 block proud of the face on an upside-down stair corbel;
  above each recessed bay the crenel opens. At the head of each bay, under the
  crenel, a vertical-slat panel (an open spruce trapdoor, inferred from the
  slat texture) hangs as a hoarding shutter. A timber band course runs along
  the wall head between the cubes. At each pilaster foot a stone-brick stair
  faces outward as a flared footing (f_313–f_316). Break the wall at ONE bay
  for the gate: a pale lintel course spans the passage with the centre block
  one course higher, pale cheek piers, iron bars set back inside the passage,
  and a lamp post on a stone footing on each side (technique 6 sub-entry). The
  wall follows the terrain in stepped runs (technique 5's defer-to-the-terrain
  bullet), so run this rhythm per segment.
- Apply when: a fortified curtain wall long enough to show several bays on each
  side of the gate, in stone with a timber accent. NOT when: timber or domestic
  builds; tower stage transitions (the gallery band, technique 32, owns those;
  inferred guard: one band language per face); a short wall of one or two bays,
  which reads as a single notch. The gate head here is a flat lintel; for an
  arch head use technique 15, but see its source-check note in the sub-entry.
- Prevents: the flat-slab-plus-rim wall, and hoarding slats or merlons placed
  at unrelated spacing, which read as damage.
- Unresolved: wall length and height, pilaster depth, bay width, the corbel
  block's half and facing (a stair under the centre cube is inferred at f_226),
  the trapdoor wood, the pale lintel block.
- (Disruptive builds ref: castle gatehouse; f_226 and f_227 gate and wall at
  close range, f_304 and f_307 wall head, f_313–f_316 tight view of the bays and
  stair feet, f_317 and f_208 whole front.)

### 49. Torii gate with portal veil
Status: draft — not roasted. Source: Disruptive builds reel, the torii shrine
garden (frame evidence B3). Stage-1 (`stage1/03-torii.md`) studied the zen
garden frame and not the gate, so this entry rests on the frame sweep. Band
proposed: none (gate height, width and pillar size are unmeasured). Not in the
band table.
Technique 36 gives East-Asian roofs and technique 37 a roofed compound wall
and gatehouse pavilion; the guide builds no free-standing gate. This one is a
frame, a cap and a filled opening, and the filled opening is what makes it a
gate to somewhere.
- Recipe (as seen): two terracotta pillars thicker than 1 block at the shaft
  (width not counted), the foot of each ringed with open vertical-slat
  trapdoors (technique 50); two crossbeams, the beam ends projecting past the
  pillars, each end carrying a dark socket cube (block unresolved), and
  trapdoor-ribbed panels along the beam faces (f_156, f_158, f_161); a cap of
  dark teal tile blocks with a wide overhang and terracotta accents at its ends
  (f_153, f_156); a lantern hung on a front pillar. In the opening a
  nether-portal veil with its frame hidden, glowing violet (f_144, f_153, f_162,
  f_163). The gate stands on a small paved pad, approached by a path; the
  garden around it uses technique 8's zen bed, technique 16's bamboo and
  technique 6's lantern focal. Stone lanterns along the path edges and on the
  pond island are a wall post on a slab base with a lantern on top (frame
  evidence f_164, f_169, f_186, f_190); f_153 shows two stepped stone
  pedestals with lanterns flanking the approach.
- Apply when: shrine, temple or garden grounds where one threshold should
  read as a destination. NOT when: the compound already has a gatehouse
  pavilion (technique 37; one gate grammar per entrance); non-East-Asian
  palettes; small plots where the gate dwarfs the garden.
- Prevents: a torii that reads as two red posts over a path, with nothing in
  the opening.
- Open question, not settled here: the veil emits light and fills the opening,
  and the guide's anti-patterns ban light-emitting blocks as wall or window
  material. Whether a portal fill counts is for the roast.
- Unresolved: gate height, width and pillar thickness; beam count and spacing;
  the exact tile-cap block; the identity of the dark socket cubes (a
  dispenser-like block); whether the veil frame is obsidian (hidden).
- (Disruptive builds ref: torii garden; f_153 whole gate, f_156 close, f_161
  beam and cap, f_162 veil, f_186 from the approach.)

### 50. Trapdoor hardware on timber — beam-end plates and post-foot ribbing
Status: draft — not roasted. Source: Disruptive builds reel, recurring on the
dam gallery, the gazebo, the well and the torii gate (frame evidence rows
TD05 and TD06 of `block-repurposing.md`). Band proposed: mini (a per-post
detail). Not in the band table.
Technique 2 gives joints as log ends and chiseled logs, and says trapdoors read
as shutters and not joints; technique 7 uses trapdoors as shutters, awnings and
cabinet doors. Nothing covers the other recurring use: a trapdoor laid flat
against the END or the FOOT of a timber member as hardware. Four builds do it
with one grammar.
- Recipe (as seen): (a) beam-end plate: one open trapdoor, latch visible, flat
  against the end face of each projecting beam or roof corner, one per post
  position: the dam gallery beams over every post (f_064, f_067), the gazebo
  roof corners (f_469), the well roof corners (f_490). On the gazebo and the
  well the plate sits inside a square ring of other blocks (ring block
  unresolved). (b) Post-foot ribbing: vertical-slat open trapdoors on the
  outward faces at the foot of each post, forming a collar (gallery post feet
  f_067; gazebo and well post feet f_469, f_470, f_490, f_491); the torii
  pillars carry the same ribbing on the base and on the beam faces (f_156,
  f_158). `open=true` is inferred from the latch and slat texture and not
  observed as a block state.
- Apply when: timber frames of pavilions, wells, gallery bridges and gates in
  the reel's own style, where a log end or foot would otherwise read as raw cut
  timber. NOT when: the frame already uses log-end or chiseled-log joints
  (technique 2; one joint language per frame); masonry builds; where the
  trapdoor would read as a shutter on a wall opening. One hardware type per
  member, repeated the same at every post.
- Prevents: bare beam ends and post feet reading as unfinished lumber. It is an
  alternative to technique 7's finished-beam-end stair cap, not a stack on it.
- Unresolved: all trapdoor states (inferred), wood species (hidden by the
  shader), the ring block around the plate.
- (Disruptive builds ref: dam; gazebo; well; torii gate.)

### 51. Raised stage with a stepped timber arch (pillory)
Status: draft — not roasted. Source: Disruptive builds reel, the pillory (frame
evidence B14; no stage-1, and not among the 14 builds the guide's source list
names). Band proposed: mini. Not in the band table.
Technique 19 names a gallows as a hoist grammar and gives no construction;
technique 15's sub-entry gives stepped heads over openings. The pillory is a
free-standing civic stage under a stepped timber arch with one hanging line,
and it fills a town square with a destination.
- Recipe (as seen, f_573 at full resolution, f_533): a plank stage one block
  above the plaza with a notched underside: the middle of the underside open,
  an inverted-stair step at each end so it reads as a table and not a block. Two
  posts stand on the stage ends, each a stack of three: a stone wall block, a
  wood post, a stone cap block. Over each post a plank piece overhangs outward
  by about 1 block, and from there the arch rises inward in stepped courses
  (stairs and planks, 2–3 steps per side as seen) to a flat crown. A chain with
  a 1-block bar hangs from the crown centre over the stage centre; the figure
  under it is an entity (an armor-stand or villager figure), not blocks. The
  stage sits on a paved plaza with a ragged edge (technique 5 sub-entry).
- Apply when: a village square or town platform whose story is medieval
  justice or civic notice. NOT when: the build has no plaza; pastoral or
  festive palettes (a hanging figure is a theme statement, inferred guard);
  one hanging implement per structure, as in technique 19.
- Prevents: the gallows as one beam on two fences. The stepped arch and the
  corbelled ends are what make it read as joinery.
- Unresolved: stage and post sizes, arch span and rise (the frame evidence
  counted a span of ~4–5 and a rise of ~3 rows on oblique frames), the stair
  facings and halves, the wood species. The mcbuilder `arch` shape's stepped
  profile already cites f_533 as evidence for the stepped head.
- (Disruptive builds ref: pillory; f_527–f_537, f_571–f_575; f_533 and f_573
  are the clearest.)

### 52. Abstract figure statue on a planter base
Status: draft — not roasted. Source: Disruptive builds reel, the statue and
garden (frame evidence B12; the guide's source list marks it "idea-only, no
patterns extracted" and there is no stage-1). Five frames only (f_501–f_505),
all frontal or oblique. Band proposed: mini. Not in the band table.
Technique 10 lets one legible object anchor a landmark and technique 8 sites
frontless civic structures at path centres; neither says how a statue is built.
This one is a silhouette: a block figure whose shape is the statue, standing in
a small planted box.
- Recipe (as seen, f_503–f_505): a low planter box, one block high, with
  vertical-grain wood sides, holding grass or dirt and a few small flowers at
  the figure's feet (colors only: pink, blue, cyan). The figure is stone brick
  with cracked and mossy variants mixed through: a narrow column rising from
  the planter, a wider block torso above it, and a narrower head block set
  above a dark seam. It reads in silhouette; no face or arms are resolved.
- Apply when: a village green, plaza centre or garden focal point that needs
  one civic anchor (technique 10, landmark-scale anchors). NOT when: the
  build already has an anchor (one per view); a statue that must read as a
  specific person (the frames show no such detail).
- Prevents: a statue standing bare on grass; the planter is its ground plane
  and its scale reference.
- Unresolved: ALL dimensions (planter footprint, column, torso and head
  widths and heights), the depth and the back of the figure, the planter wood,
  the flower species. The upper-left platform in f_503 and f_504 is another
  test build in the background and is not part of the statue.
- (Disruptive builds ref: statue and garden; f_501–f_505.)

## Anti-patterns (do not do)

- Large flat single-material surfaces ("tembok jelek").
- Flat tops with no silhouette variation. (Exception: a small flat roof
  (≤9×9, ≤2 stories) is allowed ONLY with a mandatory finished edge —
  alternating slab heights, fascia trim, or rafter tails (technique 4's
  flat-roof entry). A bare flat lid is still unfinished.)
- Light-emitting blocks used as wall/window material.
- Random dirt patches with no path logic ("ada tanah? wtf").
- Floating builds with no foundation or ground connection.
- Copying the *shape* of a reference (e.g. a gable roof on an underwater
  build) instead of its *techniques*.
- AI-generated "Minecraft-style" art as reference — image models hallucinate
  textures; use real build reels/screenshots only. (Exception: stylized
  renders are acceptable only when block reads are flagged interpretive and
  the construction is validated against real-build practice — see the "Four
  small-house renders" source.)
