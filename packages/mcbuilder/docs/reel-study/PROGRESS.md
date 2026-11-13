# Reel study: progress and handoff

Status as of 2026-11-13. This is the entry point for picking the work up again.

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

Example: `examples/reel_keep/` uses all three and passes `mcbuild check` and `run`.

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

## Next step (planned, not started)

The second shape wave, in the priority order of `mapping-draft.md` → "Shape priority". One commit
per item, each following `SHAPE-WORKER-RULES.md`.

Rule for every option added to an existing shape: it must be opt-in, and the default output must
stay byte-identical, with the oracle tests and vectors green and unedited.

1. **`bayWall(c1, c2, block, {period, post, infill, beam, inset, pilaster})`.** A rhythmic wall of
   post or pier, bay infill and beam. This one family covers timber frame, arcade, pier-and-slit and
   pilaster rhythm (M11–M15; T2, T45). It has the strongest evidence: 9 sources.
2. **`roofGable` options `endFill` and `ridgeCap`.** Gable-end triangle fill (M24, 6 reels) and
   ridge cresting (M26, T46).
3. **`polygon(vertices, y1, y2, block, {mode})`.** A rectilinear footprint from `[x, z]` vertices,
   with mode walls, solid or floor (M47, 6 reels).
4. **`jetty(c1, c2, block, {overhang, sides, beam})`.** An overhanging upper floor on an
   upside-down stair bracket row (M17).
5. **`stairs` option `half: "bottom" | "top"`.** Default `"bottom"`, unchanged.
6. **Example.** `examples/reel_house/` uses all of them. Then update `SHAPE-MAPPING.md` and add a
   `Shape:` line to each technique served.

Later, below the priority line:

- `roofGable` valleys and cross-gables;
- pit / terraced excavation (T47);
- dormer;
- concave `cone` profile (T34);
- half-hip `roofHip`;
- `cone` tiers;
- trestle, canopy, prism.

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
