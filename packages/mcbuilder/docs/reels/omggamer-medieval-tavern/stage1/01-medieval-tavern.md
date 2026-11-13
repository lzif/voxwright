# Stage 1 — Pattern identification: OMGGamer "Medieval Tavern" (frames received 2026-11-10; notes drafted 2026-11-12)

Stage-1 NOT yet roasted. Nothing here is a guide entry yet; the fold proposal goes to Luki for lock. Candidates carry a status line (proposed NEW / proposed sub-entry / already covered) and a scale band.

Video: the zip's MANIFEST lists `/home/hatch/workspace/tavern-race/omggamer-medieval-tavern.mp4`, 20.8 s (not on this machine; the source post URL is not recorded in the repo). Frames: 21 at 1 fps (f_001–f_021) in the Drive zip under `frames/omggamer-medieval-tavern/`. A short build-up reel with a fade-out and an "OMGGamer" footer overlay, which is read as data only. Exterior only: no interior shots, no plan view, no dimension labels, no player in frame, so footprint and wall heights in blocks are unresolved.

Evidence base: reader D's notes (`/data/workspace/minecraft-reels/work/evidence/D-hibouk-tavern-diorods.md`, §5.2 and §3), who viewed all 21 frames and opened f_004, f_013, f_019, f_020 at full resolution. This pass re-checked every claim promoted to a candidate against f_002, f_004, f_007, f_009, f_013, f_020 (half-res), plus full-res crops of the ridge in f_013 and f_020. Claims cited from other frames are marked "(D, sheet-level)".

Guide read: `../../../build-patterns.md` (41 techniques, commit b0b2462).

**Numbers convention:** every dimension is relative or marked ~ (approximate). With no scale object in any frame, proportions are eyeballed (±10% for perspective) and counts are only given where a repeated element can be counted. Nothing is invented to fill a gap.

---

## Measured dimensions (from frames)

| Element | Measurement |
|---|---|
| Footprint | UNRESOLVED (no labels, no player, no plan view) |
| Elevation proportion (f_004, eyeballed ±10%) | stone ground floor ~1/3, timber upper floor ~1/3, roof ~1/3 of the height |
| Ridge cresting posts | 1 wide, rising ~1 block above the rail; pitch ≈ 4 cells (≈ 3 clear between posts) from pixel spacing in f_013 and f_020 crops, ±1 (perspective) |
| Cresting rail | reads as ~2 courses tall (a lighter upper band over a darker lower band); whether it is one 2-high member or two stacked members is unresolved |
| Ridge beam overhang | overshoots both gable ends by ~1 (f_002, f_004) |
| Jetty overhang depth | UNRESOLVED (the upper floor sits proud of the stone on free posts at the right front, f_004, f_007) |

## Build observed

A two-storey half-timber tavern: rough stone ground floor with pilasters and a stepped corner buttress, jettied timber upper floor with white plaster infill, a large grey stair roof with a front cross-gable and small hoods over the upper windows, a chimney off the ridge, a market cart at the door (f_004, f_013, f_020). Arc across the 21 frames, D's order spot-checked: f_001–f_002 stone box with window holes and a timber ring beam and corner posts, roof stair slopes and a plain log ridge beam; f_004–f_006 white infill between the upper timbers, the front cross-gable, roof hoods; f_007–f_012 facade detail: window frames, planters, stepped log brackets, base pilasters; f_009–f_013 the ridge cresting posts added to the plain ridge beam, the roof broken into dark and light patches; f_013–f_020 the chimney recoloured from grey to brick red (f_013 grey with a log band and 4-post cap; f_020 brick red), path, grass tufts and the cart.

Palette per role (INFERRED block IDs from texture and shape; shader tint shifts colours):
- Frame (posts, beams, cresting): orange-brown log or stripped log (`oak_log` / `stripped_oak_log` ?, alternative spruce), ~25% of the wall area.
- Infill: white (`white_concrete` ? / `quartz_bricks` ? / `calcite` ?; faint horizontal lines in f_004), ~35% of the upper wall.
- Roof: grey stair mix, uniform in f_002 and patchy dark-and-light by f_013 (`stone_brick_stairs` ? with `cobbled_deepslate_stairs` ? / `deepslate_brick_stairs` ?); the biggest area of the elevation.
- Foundation: `stone_bricks` roughened to a stone mix with pilasters (f_013). Accent: brick chimney (`bricks`), golden lit windows, leafy planters. Ground: orange-brown `dirt_path` ? / `coarse_dirt` ? / `packed_mud` ? with grass tufts.

## Process note

Shell first, detail second, and a late accent pass: the ridge posts are added to an already-finished plain ridge beam (f_007 plain, f_009 posts), and the chimney is recoloured after the roof detail (f_013 to f_015). One volume, so the per-volume amendment is not tested. Nothing here contradicts the staged process; no amendment proposed.

## Terminology (one term per element)

- **Ridge cresting:** the horizontal timber rail along the ridge with 1-wide vertical posts rising above it, on the main and the cross-gable ridge.
- **Ridge beam:** the plain log beam on the ridge that overshoots both gable ends by ~1 (before the posts are added).
- **Roof hood:** a small stair roof with a log beam across its front over an upper window.
- **Jetty bracket:** a stack of horizontal logs stepping outward under a jetty corner, end-grain facing out.

---

## Candidates

### 1. Ridge cresting — timber post-and-rail along the ridge — PROPOSED NEW

**Status: proposed NEW (stage 1, unroasted). Confidence MED** (frames are clear at full resolution in 4 views of one reel; post pitch and rail height carry ±1 and a stated ambiguity). **Band: mini** (a 1-block-high element; the minimum ridge length it needs is not resolvable from one reel).

- **Principle:** technique 4's silhouette tools break the roofline with chimneys, towers, dormers, spires and cross-gables, and its flat-roof entry finishes a flat edge with alternating slab heights or rafter tails. Nothing in the guide finishes the ridge of a plain pitched roof. The tavern puts a continuous rail along the ridge with 1-wide posts rising above it: an alternating high-and-low pattern at the very top line of the building, in the same timber as the frame, so the roof outline reads as designed instead of a bare stair edge.
- **Recipe (OBSERVED; two-step build, f_002 → f_007 → f_009):** first a plain log ridge beam along the ridge that overshoots both gable ends by ~1 (f_002, f_004, f_007). Then raise a rail along it (~2 courses tall as read) and set a 1-wide log post every ~4th cell (≈3 clear between posts), each rising ~1 block above the rail top, with the end posts capped (f_009, f_013, f_019, f_020). Repeat on the cross-gable ridge at a smaller scale (f_009, f_013, f_020). Same timber species as the wall frame.
- **Apply when:** timber-frame or half-timber builds with a long gable ridge where the roof is the largest plane and the ridge line is bare. **NOT when (INFERRED guards, for the roast):** hip-roofed or pyramid-roofed builds (no ridge run); builds that already carry a crown grammar on the ridge, such as a belvedere (technique 4) or ridge ticks (technique 36), because one ridge language per roof; masonry or fortress roofs (a timber rail on a stone keep is a different grammar; technique 7's stone parapet applies there); a ridge too short for ≥ 2 posts between the end caps.
- **Prevents:** the bare-ridge read, a long unbroken stair edge on the top line, the part of a large grey roof the eye reads first.
- **Unresolved:** post pitch (≈4, ±1, perspective), rail height (one 2-high member vs two stacked members), whether the posts rest on the rail or on slabs, the exact block (log vs stripped log).
- **Cross-ref:** this is NOT crenellation (timber, on a ridge, not a parapet); `mapping-draft.md` row M26 keeps it out of the parapet shape and rates it low at the shape level (single reel). The guide-level rating here is MED because the recipe is frame-clear; the orchestrator should reconcile.
- (Tavern ref: f_002 and f_007 plain ridge beam; f_009 posts newly added; f_013 and f_020 crops of the finished cresting on both ridges.)

---

## Observations (not candidates)

- **Roof hoods with a log beam (f_004, f_007, f_009, D for f_005):** small stair roofs over upper windows, each with a log beam across the front, breaking the eave. A similar element appears over the upper windows of the Arashy12 reel (dark stair hoods, `B-houses.md` 1.1-C, ogee profile BLOCKED). Technique 7's stair-hood awning covers the door scale only. Two reels, geometry unresolved, so candidate LOW, not drafted.
- **Chimney with a log band and a 4-post cap, recoloured from grey stone to brick red (f_003, f_013, f_015–f_020):** technique 4 (chimney as the vertical accent). The warm recolour is an accent-echo move (technique 1's rule), done late; no new content.
- **Market cart on trapdoor wheels at the door (f_019, f_020):** technique 7 (props) and technique 23's market theme; no new content. The wheel block is INFERRED (`oak_trapdoor` ?), not confirmed.

## Duplicates / confirmations (not new)

- **Timber ring beam and corner posts on the stone box (f_001–f_002):** technique 2 (skeleton-first, plate every floor line). Confirms.
- **Jetty on free posts with stepped log brackets at the corners (f_004, f_005, f_013, f_019):** technique 2 (jetty the upper floors, knee brackets, visible joist course). Confirms. The jetty overhang here is the reason this facade does not carry the stacked pier-and-post bay of `hibouk-winter-mansion` candidate 1.
- **Big gable roof, log ridge beam overshoot, cross-gable, white plaster gable fill (f_002–f_005):** technique 4 (cross-gable, dark stair roofs, step gable ends). Confirms.
- **Roof texture break-up, second grey stair type scattered (f_002 uniform vs f_013 patchy):** technique 4 (two-tone the roof) and technique 1. Confirms.
- **Stone base roughened with pilasters and a stepped corner buttress (f_007, f_013):** technique 1 (mottled base) and technique 3 (pilaster strips, same-material variant). Confirms.
- **Windows: timber frame, lit lattice panes, plank sill, leafy planter box with a lantern (f_013, f_019, f_020):** technique 7 (greenery box, full window recipe). Confirms. The lattice-as-trapdoor read is INFERRED.
- **Porch posts with barrel-style feet and banded tops (f_013, f_020):** technique 5 (wood never touches earth: footing block) as a barrel-foot variant, and technique 40 for the porch. Confirms.
- **Path, grass tufts (f_018–f_020):** technique 5 (sit it in the terrain). Confirms.

## Not covered / out of scope

- No interior, no plan view: footprint, door count, wall heights in blocks, jetty overhang depth are unresolved.
- Real material of the infill (white concrete vs quartz vs calcite), the roof stairs and the chimney band, and whether the corner brackets are logs or stairs, are not resolvable from the frames.
- Ground block under the path has several candidates (`dirt_path`, `coarse_dirt`, `packed_mud`).

## Candidate classification (against T1–T41)

| # | Candidate | Class | Confidence |
|---|---|---|---|
| 1 | Ridge cresting (timber post-and-rail along the ridge) | PROPOSED NEW | MED |
| – | Roof hoods over upper windows | no technique fits; shared with Arashy12 hoods | LOW (not drafted) |
| – | Timber ring beam, corner posts | already covered: T2 | – |
| – | Jetty on free posts, stepped log brackets | already covered: T2 | – |
| – | Cross-gable, ridge beam overshoot, plaster gable fill | already covered: T4 | – |
| – | Roof texture break-up | already covered: T4 (two-tone the roof), T1 | – |
| – | Stone base with pilasters and buttress | already covered: T1, T3 | – |
| – | Lattice windows with planter and lantern | already covered: T7 | – |
| – | Chimney with band and cap, recoloured | already covered: T4 (chimney), T1 (accent) | – |
| – | Porch posts with banded feet | already covered: T5 (footing), T40 | – |
| – | Market cart | already covered: T7 (props), T23 | – |
