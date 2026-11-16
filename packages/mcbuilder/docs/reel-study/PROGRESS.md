# Reel study: progress and handoff

Status as of 2026-11-15. This is the entry point for picking the work up again.

Related, 2026-11-16: `../schematic-study/README.md` measures 17 real schematics block by block
(15 abfielder.com downloads and 2 of Luki's files). The shape gaps its engine-mapping table
listed are now implemented: `underlay` and `sandwich` on `roofGable`, `roofHip` and `roofUnion`,
`cladding`, `corbels`, and the props `paperLantern`, `lampPost` and `windowBox` (tests in
`test/shapes-house.test.ts`). Still open from that table: a shape-share and a light-density line
in the build summary, wall and fence connections, more props.

## Goal

AI agents that build Minecraft structures with `mcbuilder` fell back to `set()` per block whenever a
shape was missing, and the builds came out flat. The reel study turns Luki's build reels into two
things:

- **Guide entries:** `docs/build-patterns.md` (guide + pattern + taste), including how builders use
  blocks against their original function.
- **New shapes:** in `src/shapes.ts`, mapped technique by technique in `../../SHAPE-MAPPING.md`.

## Source material

- **Frames.** Drive zip `minecraft-reels-frames-2026-11-10.zip` (Drive file ID
  `1Ys2NfTtoalVy5v8UpaYwGicXExdhG2yD`, 240,622,980 bytes): 1,513 frames at 1 fps from 15 reels, 7 Dio
  Rods photos and 4 pillar-wall designs. They are not in the repo. On the instabox machine they
  are unpacked in `/data/workspace/minecraft-reels/`:
  - `extracted/`: the originals;
  - `work/keyframes/`: half-res keyframes;
  - `work/sheets/`: 88 numbered contact sheets;
  - `tools/run_all.sh`: rebuilds the keyframes and sheets.

  See `frames-prep-README.md`.
- **Frame-reader evidence**, in `evidence/`. `READER-BRIEF.md` is the brief each reader got.

  | File | Reels |
  |---|---|
  | `A-towers.md` | alixxa, trixyblox, gothic castle, heavy tower, niitty, tall mansion, japanese house, pillar designs |
  | `B-houses.md` | french mansion, arashy12, both gorillo reels, noes |
  | `C-disruptive.md` | disruptive builds, all 15 builds, with stage-1 |
  | `D-hibouk-tavern-diorods.md` | hibouk, medieval tavern, dio rods, with stage-1 |

- **Merged notes:**
  - `mapping-draft.md`: technique rows M01…, hypothesis verdicts, shape priority, conflicts.
  - `block-repurposing.md`: block-against-function catalogue, with a top-15 list.
  - `guide-draft-index.md`: where each 2026-11-13 guide addition landed.
- **Working rules:**
  - `SHAPE-WORKER-RULES.md`: the conventions, checks and visual preview loop every shape worker
    follows.
  - `PLAN-session-notes.md`: the running session plan, partly in Indonesian.

## Done

Shapes in `src/shapes.ts`, with tests:

- `arch`: stepped, segmental and pointed profiles; ogee is blocked;
- `parapet`: merlon/crenel rhythm, optional corbel flare;
- `skirtRoof`: flared skirt around a tower stage, with dentil and hole options.

Example: `examples/reel_keep/` uses all three of these and passes `mcbuild check` and `run`.

Second shape wave (2026-11-15), items 1 to 4 of "Next step" below, one commit each, all on main and
pushed:

- `bayWall` (c2be3bf): post, bay, beam and sill rhythm with `inset`, `pilaster` and an array
  `period`. It covers M11, M12, M13 and M15; M14 (the pillar module) is not covered. `postWidth`
  followed in bcff5ec.
- `roofGable` `endFill` and `ridgeCap` (cfb0a5b, reworked in 9f23e06 and bc2033f). `ridgeCap` is
  `{ post, rail?, every = 3, height = 1 }`: posts rooted in the ridge row, replacing the roof cell,
  and the rail in the top post row. A top-slab rail is recommended.
- `polygon` (de12bdf): rectilinear footprint with mode walls, solid or floor.
- `jetty` (9c208d4): overhanging deck with upside-down stair brackets.

Added on top of the wave:

- `roofGable` `profile` (b0ebf9e) with `slab` and `full`: `"straight"` (default, output unchanged),
  `"steep"`, `"concave"`, `"gambrel"`, `"low"`, or an array of `"slab" | "stair" | "steep"` per column
  from the eave.
- `gradient(stops, { from, to, axis, blend, salt })` material, and the `mcbuild palette` command with
  `near`, `ramp` and `show` (6d5a02b). `palette ramp` suggests the stops for `gradient()`.

`SHAPE-MAPPING.md` (the shapes) and the skill's `builder-api.md`, `SKILL.md` and the READMEs (shapes, `gradient()` and `palette`) are updated for these.

Guide (`docs/build-patterns.md`): T1–T52, all locked.

- **T42** is reserved for the failed rose window and never used.
- **C2 stepped gable** stays blocked.
- **T43–T47** come from alixxa, hibouk, tavern and dio rods. T44, the pyramid crown, is locked as
  provisional.
- **T48–T52** and 14 sub-entries come from the disruptive builds. Luki locked them without a roast
  on 2026-11-13.
- **Eight frame-vs-guide contradictions** were fixed with scoped Exception/Variant lines; they are
  listed in `docs/candidates.md`.

Mapping: `SHAPE-MAPPING.md` labels every technique and sub-entry as SHAPE, NEW SHAPE, PARAM,
COMPOSITION or BLOCKED.

Issue #21 is closed.

## Hypotheses checked against the frames

| Hypothesis | Verdict |
|---|---|
| arch | present, implemented |
| crenellation | present, implemented as `parapet` |
| skirt roof | present, implemented |
| dome | absent from every reel; `sphere` already has `dome` |
| spiral stairs | absent from every reel |
| "pointed arch trixyblox" | its portal heads are segmental; only the lancet window is pointed |

## Next step

Decided with Luki on 2026-11-15: rebuild the omggamer tavern (tav/f_009, tav/f_020) as
`examples/reel_house/`, iterating side by side with the frame. Build what is missing on the way, in
this order:

1. roof intersection: cross-gable and valley;
2. dormer;
3. chimney;
4. door and window helpers.

Done 2026-11-16 (3a07876): `roofUnion` (gable and hip parts over overlapping rectangles, valleys and
hips with the game's stair-corner rule; one gable part equals `roofGable`), `dormer` with
`dormerRoof`, `chimney`, `door` and `window`, tests in `test/shapes-house.test.ts`, documented in
the skill's `builder-api.md`. `examples/reel_house/reel-house.ts` is the tavern built with them
(1,961 blocks, `mcbuild check` clean). It was built from the frame notes in
`evidence/D-hibouk-tavern-diorods.md` section 5.2 only: the frames were not on the machine that
did this work (only the private Drive zip, too large to fetch through the Drive connector), so
there is no side-by-side PNG yet. Compare it with tav/f_004, f_013 and f_020 when the frames are
at hand.

Working rule (Luki, 2026-11-15): image-derived shape and build work is done by the orchestrating
model itself, not delegated, and every result ships with a side-by-side PNG (reference left, render
right).

- Side-by-sides: `/data/workspace/minecraft-reels/work/side-by-side/`.
- Preview scripts: `/data/workspace/minecraft-reels/work/shape-previews/`; `review/` holds the tavern
  and frame-matching scenes.
- Pinterest roof references: `/data/workspace/minecraft-reels/work/roof-refs/`.

None of these are in the repo.

Findings from the side-by-sides:

- The Japanese roof in the reference has a deep multi-layer eave overhang that `roofGable` does not
  do yet.
- The tavern roof reads best as `profile: "straight"` with a `gradient()` of deepslate tile, deepslate
  brick, cobbled deepslate, then stone brick stairs.
- `patches()` on a roof reads as blotches; use `gradient()` there.

The second shape wave, in the priority order of `mapping-draft.md` → "Shape priority". One commit
per item, each following `SHAPE-WORKER-RULES.md`.

Rule for every option added to an existing shape: it must be opt-in, and the default output must
stay byte-identical, with the oracle tests and vectors green and unedited.

1. **`bayWall`.** Done (c2be3bf, `postWidth` in bcff5ec).
2. **`roofGable` options `endFill` and `ridgeCap`.** Done (cfb0a5b, 9f23e06, bc2033f).
3. **`polygon(vertices, y1, y2, block, {mode})`.** Done (de12bdf).
4. **`jetty(c1, c2, block, {overhang, sides, bracket, every, beam})`.** Done (9c208d4).
5. **`stairs` option `half: "bottom" | "top"`.** Default `"bottom"`, unchanged. Done 2026-11-16 after
   Luki's go-ahead: `"top"` gives upside-down steps facing back down the run (corbels, stair
   sandwiches).
6. **Example.** `examples/reel_house/` uses the shapes above. Done 2026-11-16 (see "Next step").

Later, below the priority line:

- pit / terraced excavation (T47);
- concave `cone` profile (T34);
- half-hip `roofHip`;
- `cone` tiers;
- trestle, canopy, prism.

(`roofGable` valleys and cross-gables, and the dormer, moved up to the next step above.)

## Open questions

- **Pyramid crown (T44).** The geometry is unresolved: two readings disagree, about 7 versus 12–13
  tall. A smoke build is needed before it can become a shape.
- **Ogee hoods (arashy12 dormers).** Blocked; the geometry isn't pinned down.
- **Shape defaults.** `skirtRoof` and `parapet` defaults the frames could not settle are design
  choices. Each shape's doc comment says which ones.
- **TrixyBlox.** There is still no stage-1 file. The ribbed vault, bay rhythm and subtractive ruin
  pass stay map-only.
- **lzif/mcbuilder.** To be archived. The guide now lives here, and its last local draft in
  `/data/workspace/mcbuilder` was never committed there.
