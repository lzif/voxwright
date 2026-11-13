Frame confirmed: bell tower **exterior**, correct — tall narrow stone tower, open belfry with a visible golden bell near the top, layered wooden stair awning over the door, stepped stone plinth base, dirt paths fanning out. Real Minecraft build video (not AI render), so block reads are trustworthy. Two things I'm taking from the video transcript rather than the pixels: the bell is ringable (so a real bell block, consistent with the gold read) and the tower has 4 doors / 4 approach paths (transcript); the very top cap is out of frame, so I claim nothing about it.

Guide read in full (13 techniques + anti-patterns). Here are the findings — 6 techniques: 2 new, 4 extensions.

---

## Stage 1 (re-run) — Pattern identification: Bell tower ref (`~/workspace/disruptive-reel/frames/14-belltower.jpg`)

**Build observed:** tall narrow standalone bell tower (~5–7 wide) in stone bricks: stepped stone plinth base with stairs up to a dark wooden door, plain quiet shaft, open belfry near the top with a golden bell visible in the dark opening, layered wooden stair awning hooding the door with flanking stair "wings," dirt paths approaching from multiple directions, plain grass field around it.

### 1. Open belfry crown (NEW)
- **Principle:** A landmark tower's crown should *show its purpose*. The bell visible inside an open belfry is the tower's "face" — a solid cap would demote the whole thing to a chimney. The dark openings against pale stone are what make the crown read at distance.
- **Recipe:** Top 2–3 blocks of the shaft: leave unglazed openings on all 4 faces (1–2 wide × 2 tall), interior left dark (no glass, no light — line with dark blocks if the interior would otherwise catch light). Hang the bell (bell block) centered in the chamber, 1 block below the opening tops so it sits in the visible band. Cap with a small stair-block roof overhanging the shaft by 1 block.
- **Apply when:** standalone landmark towers whose program is a single object (bell, beacon, statue). **NOT when:** the top is occupiable (use technique 4's belvedere) or fortified (use technique 7's crenellated parapet) — one crown grammar per tower. **NOT when** the openings would be glazed or lit: glass at height reads as windows, light reads as an occupied room — both kill the "hollow crown" read.
- **Prevents:** the tall-narrow-chimney failure (technique 13's named enemy) — a plain shaft with a solid cap is a smokestack; the open belfry is what makes it a *bell tower*. (Bell tower ref: golden bell clearly visible in the dark belfry opening.)

### 2. The anchor IS the program (extends technique 10)
- **Principle:** Technique 10's anchor discipline ("one oversized themed prop justifies the theme, everything else plain") is written for small builds — this tower proves it scales to landmarks. The bell isn't decoration on a tower; the tower exists to display the bell. The shaft between plinth and belfry is deliberately QUIET (no windows, no banding) so 100% of the read lands on base + crown.
- **Recipe:** For a landmark: one legible object (bell, statue, beacon), visible from the primary approach (open belfry, niche, or open frame — never enclosed). Size the object ~1/3 of its opening so it registers at render distance. Keep the shaft plain — at most one slit opening per face; spend zero ornament mid-shaft. Everything else (base, crown) serves the object.
- **Apply when:** the build's entire reason is one object or one idea (bell towers, lighthouses, monuments, statues). **NOT when:** the build has its own functional program (a house with a bell on top is a house — the anchor must BE the program, not a hat on it).
- **Prevents:** landmark builds that are just tall decorated boxes with no readable purpose; and the "barber pole" — banding/trim every few blocks up a landmark shaft, which visually shrinks it. (Bell tower ref: plain stone shaft, all interest at plinth + belfry.)

### 3. Landmark siting: orbit, don't enter (NEW)
- **Principle:** Technique 11 stages arrival *toward one door*. A landmark inverts this: it is meant to be looked at and walked around, not entered. Giving it a single privileged "front door + porch" domesticates it into a house. The video's own verdict: 4 paths, 4 doors, "the whole purpose of it is not obviously to be entered. It's just to look cool."
- **Recipe:** Run 2–4 simple paths to the landmark's base from different directions — they may touch the base and continue past it. Doors/openings on multiple faces are fine even if they lead nowhere; they punctuate the base rhythm. Keep the base clear of prop clutter (no technique-11 clusters here) so the silhouette reads clean from far. Path dressing can stay simple dirt — at a landmark, the path *geometry* (radial, multi-direction) matters more than the path *material*.
- **Apply when:** monuments, bell towers, statues, waypoints — anything whose job is being seen. **NOT when:** the build is meant to be entered and used (then stage one arrival per technique 11 — pick one grammar, never both).
- **Prevents:** the "house-ified landmark" — a monument with a single front porch that reads as a weird tall house. (Bell tower ref: dirt paths fanning to multiple faces; 4 doors per video transcript.)

### 4. Layered stair-hood awning (extends technique 7's lean-to awnings)
- **Principle:** Technique 7's awning scales are micro (trapdoor, windows) and porch (planks on posts, doors). This is the missing middle: a self-supporting multi-course stair hood that gives a door *presence* on a narrow tower face where a post porch won't fit and a trapdoor flap is too thin.
- **Recipe:** Over the door: 3 courses of wooden stairs, each course 1 block further out and 1 block lower than the last, spanning door width + 2 blocks. Flank with stair "wings": single stairs stepping down-and-out at 45° for 2–3 blocks on each side. No posts — the hood is shallow enough to read as mounted (technique 7's attachment-plate logic still applies: align its top course to a trim band or plate if one exists).
- **Apply when:** doors on narrow tower/pillar faces (≤7 wide) needing more presence than a trapdoor flap. **NOT when:** more than 3 courses deep (it becomes a porch roof — then it needs posts per technique 7's porch scale); **NOT on** wide facades (a deep hood on a wide wall reads as a random brow).
- **Prevents:** a door punched into a narrow tower face reading as an afterthought; the "stuck-on visor" of a single flat stair course. (Bell tower ref: deep layered wooden hood over the dark door, stair wings sweeping out on both sides.)

### 5. Stepped plinth recipe (extends technique 5's foundation bullet)
- **Principle:** Technique 5 says "foundation wider than the footprint, with steps up" in one line — this is the executable version for narrow towers, which need the base to do extra visual work: a tall thin mass meeting the ground with no transition reads as a toothpick.
- **Recipe:** 2 full courses of the wall stone: each course 1 block wider per side than the one above (bottom course ≥ footprint + 2 per side). Top course transitions to stair blocks forming 2–3 steps up to the door threshold on each approach face. Keep the plinth in the wall material family (stone on stone) — a contrasting plinth becomes technique 1 banding and fights the quiet shaft.
- **Apply when:** any tower with footprint ≤7×7. **NOT when:** the base already carries crenellation (technique 5's base crenellation — pick one base treatment, never both).
- **Prevents:** the toothpick read — and the flat "tower starts at y=0" look. (Bell tower ref: two-step stone plinth, stairs rising to the door.)

### 6. Quiet-shaft corollary (extends technique 13)
- **Principle:** Technique 13 governs towers that *want* per-story ornament. The bell tower demonstrates the complementary case: when the crown already carries the whole read (technique 2's anchor), the shaft must stay quiet or it competes with the crown. Restraint in the middle is what makes the top loud.
- **Recipe:** If the crown is the anchor (belfry + bell, belvedere, statue): no banding, no pilasters, no window strips on the shaft — at most one narrow slit per face, vertically centered. Let technique 1's noise rule do the only surface work (~30% mottling is enough).
- **Apply when:** landmark towers with a strong crown. **NOT when:** the tower is meant to be read as architecture up close (townhouse towers, keeps) — then use technique 13's per-story discipline instead. The two are complements: technique 13 = "every story earns its ornament"; this = "no story gets ornament." Never both on one tower.
- **Prevents:** spending the detail budget twice — a loud crown AND a busy shaft cancel each other into noise. (Bell tower ref: unbroken stone shaft between plinth and belfry.)

---

**Deliberately not proposed (already in the guide — confirmed by this ref):**
- Stone noise ~30% on the shaft → technique 1, confirmed.
- Dirt paths to the entrance → technique 5/11, confirmed (radial multi-path layout is technique 3's new contribution, not the paths themselves).
- Dark wooden door with stone surround → generic; no new technique.
- Grass-tuft ground plane, no clean cutout → technique 5/8, confirmed.

**Inference flags (frame is real-build video; these are the only non-pixel claims):** bell = real bell block (gold read + "you can ring this" per video transcript); 4 doors / 4 approach paths per transcript (one door + fanning paths visible in frame); tower cap above the belfry is out of frame — no crown-roof claim made.