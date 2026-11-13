I've read the full guide (13 techniques + anti-patterns) and studied the mining-outpost aerial frame closely. This is a real Minecraft build from the video (not an AI render) — block reads are trustworthy; I've flagged the two spots where I'm interpreting. Here are my stage-1 findings — 8 techniques, 1 genuinely new, 7 framed as extensions.

---

## Stage 1 — Pattern identification: Mining outpost ref (`~/workspace/disruptive-reel/frames/04-mining.jpg`)

**Build observed:** a medieval mining outpost built INTO a hillside — stone-brick walls wrapping the terrain with a grass/dirt hill left inside the compound, a mine entrance cut into that hill (wooden-framed dark opening, lanterns), two small crenellated front towers flanking a stone-arched gate, one taller rear tower, wall sections stepping down with the grade, a worn dirt/stone path to the gate, lanterns on tower crowns (tower-top glows read as lanterns — exact fixture inferred). Transcript confirms: modular walls, ladder-accessible towers, storage/smelting levels, minecart station with lever-switched destinations, ore/coal piles as exterior decoration.

### 1. Terrain-wrapping modular walls *(extends technique 8: siting)*
- **Principle:** Technique 8 says pick the spot as part of the design — the outpost goes further: the walls *defer* to the terrain instead of demanding a flat pad. Breaking the wall into tower-to-tower modules, each seated at its own local grade, keeps the landscape's shape (the whole point of a hillside site) while the compound still reads as fortified.
- **Recipe:** Lay towers first at terrain-appropriate spots (gate pair + corners + one dominant). Connect them with straight wall modules; each module's foundation sits at ITS segment's grade — never one global Y level. Where adjacent modules differ by 1–2 blocks, join them with a stair-toothed step (stone-brick stairs descending in the wall face, merlons following the step). Cap every module with the crenellated parapet so the stepping reads as deliberate, not broken.
- **Apply when:** walls on any grade change ≥2 blocks; hillside/compound builds. **NOT when:** formal symmetric grounds (use technique 8's enclosed plots); flat sites (a stepped wall on flat ground reads as a mistake).
- **Prevents:** the two classic failures — flattening an interesting hill into a boring pad, or a rigid straight wall floating off a slope. (Mining outpost ref: walls visibly step down the grade left of the gate; the hill stays inside the compound.)

### 2. Leave the feature inside — cut functions into it *(extends technique 9: diorama composition)*
- **Principle:** Technique 9 orbits structures around a terrain feature; the outpost inverts it: the hill IS the compound's core, and the mine entrance is cut INTO it. A functional opening in a natural feature beats any built facade for "this place exists for a reason."
- **Recipe:** Identify the site's feature (hill, cliff face, rock outcrop) FIRST, before placing walls. Ring it with the compound at 3–5 blocks standoff. Cut the primary functional entrance into the feature itself: 2-wide × 3-high dark opening, framed with a contrasting material (here: wooden planks/logs against dirt/grass), one lantern on each side of the frame. Let the feature keep its natural top (grass, tufts) — don't cap it with architecture.
- **Apply when:** the site has a usable feature and the build has a matching function (mine→hill, dock→shore, observatory→peak). **NOT when:** flat featureless sites (don't invent a hill — that's rebuilt terrain, technique 10's warning); when the feature is the view rather than the function.
- **Prevents:** "clean pad with a box on it" syndrome; a mine entrance as a freestanding doorway with no hill behind it. (Mining outpost ref: the mine mouth cut into the interior hill with a timber frame.)

### 3. Stair-block masonry arches over openings *(NEW)*
- **Principle:** Nothing in the guide gives arches a construction — lintels and plates cover timber, but masonry openings need the arch to read as engineered. A stair-built arch distributes visual weight across the span and instantly says "fortification" where a flat lintel says "doorway."
- **Recipe:** For a 3-wide opening: place upside-down stone-brick stairs at both spring points (one block above the opening's top corners, protruding half-block), then bridge the span with upside-down stairs across the top row, all facing inward/down-slope toward the center. For 2-wide: two facing upside-down stairs meeting at center. Flank with pillar columns (1×1 stone brick, 2–3 tall) that the arch sits on — never let an arch start mid-wall with no support below. Keep the arch ring 1 block proud of the wall face.
- **Apply when:** gates, mine entrances, bridge spans, any masonry opening ≥2 wide. **NOT when:** timber-framed builds (use technique 2's lintel/plate language — a stone arch on a Tudor cottage fights the archetype); 1-wide openings (no span to arch).
- **Prevents:** flat-topped stone gateways that read as plain holes in a wall. (Mining outpost ref: the arched main gate with stair voussoirs over a 3-wide passage.)

### 4. Accessible verticals — if it looks climbable, make it climbable *(extends technique 7: ladders)*
- **Principle:** Technique 7's ladder is a facade spine (decoration). This is the functional twin: a tower that reads as a watchtower creates the promise of a view — an unclimbable one breaks technique 7's own "suggests the place is used" contract. Every occupiable-looking tower gets working circulation.
- **Recipe:** On each tower's INNER face (never the approach face — keep the Ladder-XOR-pilasters guard from technique 3/7), run a ladder from ground level to the parapet, terminating AT the crown walk (technique 7's termination rule still applies: a ladder to nowhere is a builder error). Leave a 1-block gap in the parapet where the ladder lands, or end the ladder one block below the walk with a trapdoor hatch. One ladder per tower; gate towers share the wall-walk stair if one exists.
- **Apply when:** defensive, industrial, or lookout towers — anything whose silhouette promises occupation. **NOT when:** pure finials, spires, belvederes under 3×3 (too small to read as occupiable); the approach face (defense story: the climbable side faces inward).
- **Prevents:** "display towers" — structures that look functional but are solid, which reads as a stage set on close inspection. (Mining outpost ref: transcript confirms all three towers ladder-accessible; frame shows the taller rear tower's height demanding it.)

### 5. Legible rail junctions *(extends technique 9: transport lines)*
- **Principle:** Technique 9 says rails do wayfinding for free — but only if the junction is legible. A track split buried in a wall or with no visible control reads as decoration; the outpost puts the lever AT the split with both branches visible, so the mechanism is part of the design.
- **Recipe:** At every rail divergence: keep both outgoing branches visible for ≥5 blocks past the split (no burying junctions inside walls or under floors). Place the control (lever or button) on a post or wall block immediately adjacent to the split, on the side the operator stands. If space allows, give each destination a tiny sign: an item frame or a distinct block marker per branch. Power the split with powered rails on both branches so either choice actually works.
- **Apply when:** any multi-destination rail (mine stations, inter-zone transit, rollercoasters with branches). **NOT when:** single-line decorative rails (then it's a "bit" per technique 7 — keep it short and honest, not a fake network).
- **Prevents:** the "rails to nowhere" anti-pattern — decorative track that implies a system which doesn't exist. (Mining outpost ref: minecart station with lever-toggled destinations, both tracks visible leaving the station.)

### 6. Raw-product prop piles *(extends technique 11: theme-matched prop clusters)*
- **Principle:** Technique 11 says theme-match props to the build's story — the outpost's sharpest move is displaying the product RAW: heaps of coal/iron ore outside the mine mouth. Raw material is a louder theme signal than any crate, because it's the thing the whole build exists to produce.
- **Recipe:** Near the production entrance (not the main gate — the work door), heap 2–4 piles: each 2–3 blocks wide, 1–2 high, of the raw product block (coal ore, iron ore, raw copper/iron blocks, or for farms: hay bales; for lumber: log piles). Mix in stone/cobblestone at the pile bases so they read as dumped, not placed. Keep piles OUT of the path (technique 11's rule (d)) — flank the work entrance, one side only.
- **Apply when:** any production build (mine, quarry, farm, lumber camp, smeltery). **NOT when:** residential, formal, or sacred builds (raw piles read as mess, not theme); more than one product family per site (pick the primary product).
- **Prevents:** generic barrel-and-crate dressing on a build whose actual product would tell the story in one glance. (Mining outpost ref: ore/coal piles outside as decoration, per transcript.)

### 7. Tower height hierarchy *(extends technique 4: silhouette discipline)*
- **Principle:** Technique 4's chimney rule ("a short pair and a tall pair beats four identical stacks") generalizes: uniform-height towers read as a fence, however crenellated. The outpost runs two low gate towers + one taller rear tower, and the height difference is what makes the composition read as "fortress" instead of "walled yard."
- **Recipe:** In any walled compound: gate/flanking towers at 2–3 stories; exactly ONE dominant tower at 4–5 stories, placed at the rear or a corner (never center-front — it would block the gate's read). Keep the dominant tower ≤ ~1.6× the flankers' height or it detaches from the composition. Give the dominant tower one extra silhouette move the others lack (here: a taller crown + wooden hoarding/awning at the top); the flankers stay plain-crenellated.
- **Apply when:** walled compounds, forts, outposts, castles. **NOT when:** strict symmetry is the design goal (formal palaces — then vary another axis instead); single-tower builds (nothing to hierarchize).
- **Prevents:** the "crenellated fence" look — a perimeter where every vertical has equal weight and the eye finds no anchor. (Mining outpost ref: two small front towers vs. the taller back-right tower.)

### 8. Worn path recipe *(extends technique 5: ground connection)*
- **Principle:** Technique 5 says "patchy paths to the entrance" but gives no construction — and a fresh 2-wide dirt_path stripe reads as freshly laid, not traveled. The outpost's approach earns its age: mixed materials, soft edges, a slight meander.
- **Recipe:** 2 blocks wide, from the outer marker (technique 11a) to the gate: alternate dirt_path, coarse_dirt, and grass_block in irregular 2–4-block runs (never a repeating pattern — randomness is the point, ~60/25/15 split); dot the edges with short_grass tufts every 2–3 blocks; let the path meander ±1 block off-axis over its length (a dead-straight path reads as planned, a gentle wander reads as worn). Sink it half a block: replace the top grass layer so the path sits IN the terrain, not on it.
- **Apply when:** any approach path on grass/dirt terrain. **NOT when:** formal builds (use technique 8's crisp edged paths); stone/paved contexts (a worn dirt path to a marble palace fights the register).
- **Prevents:** the "freshly laid sidewalk" look — paths that read as placed yesterday on a build that's supposed to feel established. (Mining outpost ref: the mottled dirt/stone approach with tufts leading to the gate.)

---

**Deliberately not proposed (already in the guide — confirmed by this ref):**
- Stone-merlon crenellation on towers/walls → technique 7's fortified parapet variant ("formal stone keep → stone merlons") confirmed verbatim; the outpost is a textbook instance.
- ~30% wall noise (stone/mossy/cracked mix visible on walls and towers) → technique 1 confirmed.
- Minecart rails between zones → technique 9's "transport lines do wayfinding" confirmed.
- Lanterns on tower crowns at intervals → technique 6's fixture rhythm confirmed (fixture exact type inferred from glow — construction is the point, not the block).
- Hedge/vegetation softening the wall-terrain seam → technique 5's "hedge the base" confirmed.

Nothing was written to the guide — identification only, ready for the roast stage.