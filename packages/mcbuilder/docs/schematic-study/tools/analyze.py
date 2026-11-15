# SPDX-License-Identifier: AGPL-3.0-only
"""Measure build techniques in .litematic schematics (stdlib only).

usage: python3 -I analyze.py <out.json> <file.litematic>...

Convert .schem and .nbt first: node scripts/convert.ts in.schem out.litematic
"""
import collections
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import litematic  # noqa: E402

GROUND = {"grass_block", "dirt", "coarse_dirt", "podzol", "dirt_path", "mud", "rooted_dirt",
          "gravel", "sand", "red_sand", "moss_block", "farmland", "snow_block", "clay", "mycelium",
          "water", "lava", "bedrock", "snow"}
LIGHT = {"lantern", "soul_lantern", "torch", "wall_torch", "soul_torch", "soul_wall_torch",
         "glowstone", "sea_lantern", "shroomlight", "campfire", "soul_campfire", "end_rod",
         "redstone_lamp", "jack_o_lantern", "ochre_froglight", "verdant_froglight",
         "pearlescent_froglight", "glow_lichen", "light", "copper_lantern"}
PLANT_WORDS = ("flower", "tulip", "poppy", "dandelion", "orchid", "allium", "azure_bluet",
               "oxeye", "cornflower", "lily", "rose_bush", "lilac", "peony", "sunflower", "fern",
               "short_grass", "tall_grass", "grass", "vine", "roots", "sapling", "bush", "dead_bush",
               "sugar_cane", "bamboo", "kelp", "seagrass", "moss_carpet", "pink_petals", "wildflowers",
               "leaf_litter", "dripleaf", "spore_blossom", "hanging_roots", "azalea", "mushroom",
               "sweet_berry", "cactus", "torchflower", "pitcher", "wheat", "carrots", "potatoes",
               "beetroots", "pumpkin_stem", "melon_stem", "cocoa", "lily_pad", "firefly_bush",
               "bush", "cattail", "eyeblossom", "pale_hanging_moss")
PROP_WORDS = ("barrel", "chest", "crafting_table", "furnace", "smoker", "blast_furnace",
              "bookshelf", "lectern", "flower_pot", "potted_", "_bed", "cauldron", "anvil",
              "banner", "sign", "grindstone", "loom", "stonecutter", "cartography_table",
              "fletching_table", "smithing_table", "brewing_stand", "enchanting_table", "bell",
              "composter", "beehive", "bee_nest", "hay_block", "candle", "skull", "head",
              "decorated_pot", "jukebox", "note_block", "scaffolding", "target", "dispenser",
              "dropper", "hopper", "observer", "piston", "lever", "tripwire", "rail", "ender_chest",
              "shulker_box", "respawn_anchor", "lodestone", "sea_pickle", "frame", "cake",
              "chiseled_bookshelf", "crafter", "vault", "conduit", "pot", "shelf")
WOODS = ("oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "bamboo",
         "crimson", "warped", "pale_oak")


def base(state):
    return state.split("[", 1)[0].replace("minecraft:", "")


def props(state):
    if "[" not in state:
        return {}
    return dict(kv.split("=", 1) for kv in state[state.index("[") + 1:-1].split(","))


def family(b):
    if b in GROUND:
        return "ground"
    if b in LIGHT or b.endswith("candle") or b.endswith("_candle") or b.endswith("lantern"):
        return "light"
    if b.endswith("_stairs"):
        return "stairs"
    if b.endswith("_slab"):
        return "slab"
    if b.endswith("_trapdoor"):
        return "trapdoor"
    if b.endswith("_fence_gate"):
        return "fence_gate"
    if b.endswith("_fence"):
        return "fence"
    if b.endswith("_door"):
        return "door"
    if b.endswith("_wall") and not b.endswith(("_wall_sign", "_wall_banner", "_wall_hanging_sign")):
        return "wall"
    if b.endswith("_button"):
        return "button"
    if b.endswith("_pressure_plate"):
        return "pressure_plate"
    if b.endswith("_carpet") and b != "moss_carpet":
        return "carpet"
    if b.endswith("_leaves"):
        return "leaves"
    if b.endswith("glass_pane") or b == "iron_bars":
        return "pane_bars"
    if "glass" in b:
        return "glass"
    if b in ("chain", "iron_chain", "ladder", "lightning_rod") or b.endswith("_chain"):
        return "chain_ladder"
    if b.endswith(("_log", "_wood", "_stem", "_hyphae")) or b in ("bamboo_block", "stripped_bamboo_block"):
        return "log"
    if b.endswith("_planks"):
        return "planks"
    if any(w in b for w in PROP_WORDS):
        return "prop"
    if any(w in b for w in PLANT_WORDS):
        return "plant"
    if b in ("water", "bubble_column"):
        return "ground"
    return "full"


SHAPE_FAMS = {"stairs", "slab", "trapdoor", "fence", "fence_gate", "wall", "button", "pane_bars",
              "chain_ladder", "pressure_plate", "carpet"}
DETAIL_FAMS = SHAPE_FAMS | {"light", "prop", "plant", "leaves", "door"}
NONSOLID = {"plant", "light", "button", "carpet", "pressure_plate", "chain_ladder", "prop"}


def material(b):
    """Material family of a block: oak_stairs -> oak, stone_brick_wall -> stone_brick."""
    m = b
    m = re.sub(r"^stripped_", "", m)
    for suf in ("_stairs", "_slab", "_wall", "_fence_gate", "_fence", "_trapdoor", "_door",
                "_button", "_pressure_plate", "_planks", "_log", "_wood", "_stem", "_hyphae",
                "_bricks", "_brick", "_tiles", "_tile"):
        if m.endswith(suf):
            m = m[: -len(suf)]
            if suf in ("_bricks", "_brick"):
                m += "_brick"
            if suf in ("_tiles", "_tile"):
                m += "_tile"
            break
    if m.startswith("polished_"):
        m = m[len("polished_"):] + "(polished)"
    return m


def analyze(path, meta):
    d = litematic.load(path)
    pal = d["palette"]
    vox = d["voxels"]
    sx, sy, sz = d["size"]
    B = [base(s) for s in pal]
    P = [props(s) for s in pal]
    F = [family(b) for b in B]
    get = vox.get

    fam = collections.Counter()
    basec = collections.Counter()
    matc = collections.Counter()
    for k, v in vox.items():
        fam[F[v]] += 1
        basec[B[v]] += 1
        if F[v] not in ("ground", "plant", "prop", "light"):
            matc[material(B[v])] += 1
    total = len(vox)
    nonground = total - fam["ground"]

    # ground plane height: lowest y where ground is not dominant
    ground_top = -1
    for y in range(sy):
        layer = [F[v] for (x, yy, z), v in vox.items() if yy == y]
        if layer and sum(1 for f in layer if f == "ground") / len(layer) > 0.5:
            ground_top = y
        else:
            break

    # exterior air flood fill in padded bbox
    solidish = set()
    for k, v in vox.items():
        if F[v] not in NONSOLID and F[v] != "plant":
            solidish.add(k)
    outside = set()
    stack = [(-1, -1, -1)]
    outside.add((-1, -1, -1))
    nb6 = ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))
    while stack:
        x, y, z = stack.pop()
        for dx, dy, dz in nb6:
            n = (x + dx, y + dy, z + dz)
            if n in outside or n in solidish:
                continue
            if not (-1 <= n[0] <= sx and -1 <= n[1] <= sy and -1 <= n[2] <= sz):
                continue
            outside.add(n)
            stack.append(n)
    exterior = set()
    for k in vox:
        x, y, z = k
        if any((x + dx, y + dy, z + dz) in outside for dx, dy, dz in nb6):
            exterior.add(k)
    enclosed_air = (sx + 2) * (sy + 2) * (sz + 2) - len(outside) - len(solidish)
    ext_fam = collections.Counter(F[vox[k]] for k in exterior)
    int_fam = collections.Counter(F[v] for k, v in vox.items() if k not in exterior)
    ext_mat = collections.Counter(material(B[vox[k]]) for k in exterior
                                  if F[vox[k]] not in ("ground", "plant", "prop", "light"))

    # states
    def share(pred, fams):
        idx = [v for v in vox.values() if F[v] in fams]
        if not idx:
            return None
        return round(sum(1 for v in idx if pred(P[v])) / len(idx), 3)

    stairs_top = share(lambda p: p.get("half") == "top", {"stairs"})
    stairs_corner = share(lambda p: p.get("shape", "straight") != "straight", {"stairs"})
    slab_top = share(lambda p: p.get("type") == "top", {"slab"})
    slab_double = share(lambda p: p.get("type") == "double", {"slab"})
    trap_open = share(lambda p: p.get("open") == "true", {"trapdoor"})
    trap_tophalf = share(lambda p: p.get("half") == "top" and p.get("open") != "true", {"trapdoor"})
    log_horiz = share(lambda p: p.get("axis") in ("x", "z"), {"log"})
    lantern_hang = None
    lan = [v for v in vox.values() if B[v] in ("lantern", "soul_lantern")]
    if lan:
        lantern_hang = round(sum(1 for v in lan if P[v].get("hanging") == "true") / len(lan), 3)
    leaves_persist = share(lambda p: p.get("persistent") == "true", {"leaves"})

    # repurposing heuristics
    rep = collections.Counter()
    examples = collections.defaultdict(collections.Counter)
    dir_vec = {"north": (0, 0, -1), "south": (0, 0, 1), "east": (1, 0, 0), "west": (-1, 0, 0)}

    def solid_at(k):
        v = get(k)
        return v is not None and F[v] not in NONSOLID and F[v] != "plant"

    for (x, y, z), v in vox.items():
        f, b, p = F[v], B[v], P[v]
        below = get((x, y - 1, z))
        above = get((x, y + 1, z))
        if f == "stairs" and p.get("half") == "top":
            if below is None:
                rep["upside-down stair over air (corbel/eave underside/arch)"] += 1
            else:
                rep["upside-down stair on support (inverted trim / ledge)"] += 1
        if f == "trapdoor":
            if p.get("open") == "true":
                fx, fy, fz = dir_vec.get(p.get("facing"), (0, 0, 0))
                # an open trapdoor hugs the block on the side opposite its facing
                back = (x - fx, y, z - fz)
                if solid_at(back):
                    rep["open trapdoor flat on a block face (panel/shutter/plate)"] += 1
                    examples["open trapdoor on"][B[get(back)]] += 1
                else:
                    rep["open trapdoor free-standing (rail/screen/shutter)"] += 1
            else:
                if below is not None and F[below] in ("full", "planks", "log", "prop") and p.get("half") == "bottom":
                    rep["closed trapdoor lying on a block (tabletop/floor trim)"] += 1
                elif below is None:
                    rep["closed trapdoor over air (ceiling/eave trim)"] += 1
        if f in ("fence", "wall"):
            if above is not None and F[above] in ("slab", "stairs", "full", "planks", "log", "trapdoor", "pressure_plate", "carpet"):
                rep[f"{f} as post under {F[above]}"] += 1
                examples[f"{f} under"][B[above]] += 1
            if above is not None and F[above] == "light":
                rep[f"{f} as lamp post (light on top)"] += 1
        if f == "light" and b in ("lantern", "soul_lantern"):
            if p.get("hanging") == "true" and above is not None:
                examples["hanging lantern under"][B[above]] += 1
            elif below is not None:
                examples["standing lantern on"][B[below]] += 1
        if f == "button":
            rep["button as stud/detail"] += 1
            examples["button on"][b] += 1
        if f == "leaves":
            # leaves touching structural non-log non-leaf blocks = ivy / bush on building
            touching = 0
            for dx, dy, dz in nb6:
                n = get((x + dx, y + dy, z + dz))
                if n is not None and F[n] in ("full", "planks", "stairs", "slab", "wall", "fence", "trapdoor"):
                    touching += 1
            if touching:
                rep["leaves against masonry/wood (ivy, bush, planter)"] += 1
        if f == "log" and p.get("axis") in ("x", "z"):
            rep["horizontal log (beam)"] += 1
        if f in ("chain_ladder",) and b in ("chain", "iron_chain"):
            rep["chain"] += 1
        if b in ("barrel", "hay_block", "composter") and above is not None and F[above] in ("slab", "stairs", "light", "plant", "prop"):
            rep[f"{b} as pedestal/planter"] += 1
        if b.startswith("potted_") or b == "flower_pot":
            if below is not None:
                examples["flower pot on"][B[below]] += 1
        if b.endswith("_wall") and f == "wall":
            if below is not None and F[below] in ("glass", "pane_bars"):
                rep["wall above glass (mullion)"] += 1

    # vertical adjacency of different blocks (detail combos)
    vert = collections.Counter()
    for (x, y, z), v in vox.items():
        a = get((x, y + 1, z))
        if a is not None and B[a] != B[v] and (F[a] in DETAIL_FAMS or F[v] in DETAIL_FAMS):
            if F[a] == "ground" or F[v] == "ground":
                continue
            vert[f"{B[a]} / {B[v]}"] += 1

    # mixed-texture: horizontal neighbours of different full blocks, by pair
    mix = collections.Counter()
    for (x, y, z), v in vox.items():
        if F[v] not in ("full", "planks", "log"):
            continue
        for dx, dz in ((1, 0), (0, 1)):
            n = get((x + dx, y, z + dz))
            if n is not None and F[n] in ("full", "planks", "log") and B[n] != B[v]:
                pair = " + ".join(sorted((B[v], B[n])))
                mix[pair] += 1
    for (x, y, z), v in vox.items():
        if F[v] not in ("full", "planks", "log"):
            continue
        n = get((x, y + 1, z))
        if n is not None and F[n] in ("full", "planks", "log") and B[n] != B[v]:
            mix[" + ".join(sorted((B[v], B[n])))] += 1

    # vertical bands of the building (above ground)
    y0 = ground_top + 1
    h = sy - y0
    bands = {}
    if h > 0:
        cuts = [("base (bottom 20%)", y0, y0 + max(1, round(h * 0.2))),
                ("body (20-70%)", y0 + max(1, round(h * 0.2)), y0 + max(2, round(h * 0.7))),
                ("crown (top 30%)", y0 + max(2, round(h * 0.7)), sy)]
        for name, a, bnd in cuts:
            c = collections.Counter(B[v] for (x, y, z), v in vox.items() if a <= y < bnd and F[v] not in ("ground",))
            bands[name] = [f"{k} {n}" for k, n in c.most_common(6)]

    # roof caps: topmost structural block per column
    tops = {}
    for (x, y, z), v in vox.items():
        if F[v] in ("ground", "plant", "light", "prop", "button", "carpet", "pressure_plate"):
            continue
        if y > tops.get((x, z), (-1, None))[0]:
            tops[(x, z)] = (y, v)
    roof = collections.Counter()
    for (x, z), (y, v) in tops.items():
        if y > ground_top + 2:
            roof[F[v]] += 1
    roofmat = collections.Counter()
    for (x, z), (y, v) in tops.items():
        if y > ground_top + 2:
            roofmat[B[v]] += 1

    # facade relief: per side, first structural hit depth along rows; off-plane share
    struct = {k for k, v in vox.items() if F[v] not in ("ground", "plant", "light", "prop", "carpet", "button", "pressure_plate", "leaves")}
    relief = {}
    for side in ("north", "south", "west", "east"):
        depths = []
        for y in range(y0, sy):
            if side in ("north", "south"):
                for x in range(sx):
                    rng = range(sz) if side == "north" else range(sz - 1, -1, -1)
                    for i, z in enumerate(rng):
                        if (x, y, z) in struct:
                            depths.append(i)
                            break
            else:
                for z in range(sz):
                    rng = range(sx) if side == "west" else range(sx - 1, -1, -1)
                    for i, x in enumerate(rng):
                        if (x, y, z) in struct:
                            depths.append(i)
                            break
        if depths:
            c = collections.Counter(depths)
            modal, n = c.most_common(1)[0]
            relief[side] = dict(layers=len(c), off_plane=round(1 - n / len(depths), 3),
                                layers_within_3=sum(1 for dd in c if abs(dd - modal) <= 3))
    # symmetry about centre planes, comparing base block ignoring orientation
    def sym(axis):
        same = 0
        tot = 0
        for (x, y, z), v in vox.items():
            if F[v] == "ground":
                continue
            mx = (sx - 1 - x, y, z) if axis == "x" else (x, y, sz - 1 - z)
            m = get(mx)
            tot += 1
            if m is not None and B[m] == B[v]:
                same += 1
        return round(same / tot, 3) if tot else None

    # roof support: what sits under the topmost bottom-half stair of each column
    under = collections.Counter()
    for (x, z), (y, v) in tops.items():
        if F[v] != "stairs" or P[v].get("half") != "bottom":
            continue
        bl = get((x, y - 1, z))
        if bl is None:
            under["air"] += 1
        elif F[bl] == "stairs" and P[bl].get("half") == "top":
            under["upside-down stair"] += 1
        elif F[bl] in ("full", "planks", "log"):
            same = material(B[bl]) == material(B[v])
            under["solid, same material" if same else "solid, other material"] += 1
        else:
            under[F[bl]] += 1
    # vertical posts: columns of 3+ stacked upright logs; spacing to the nearest post in line
    upright = lambda k: (get(k) is not None and F[get(k)] == "log"
                         and P[get(k)].get("axis", "y") == "y")
    posts = {(x, z) for (x, y, z) in vox if upright((x, y, z)) and upright((x, y + 1, z))
             and upright((x, y + 2, z))}
    gaps = collections.Counter()
    for (x, z) in posts:
        best = None
        for (x2, z2) in posts:
            if (x2 == x) != (z2 == z):
                dd = abs(x2 - x) + abs(z2 - z)
                if dd > 1 and (best is None or dd < best):
                    best = dd
        if best:
            gaps[best] += 1
    # wall signs: what they hang on
    sign_on = collections.Counter()
    for (x, y, z), v in vox.items():
        if B[v].endswith("_wall_sign"):
            fx, fy, fz = dir_vec[P[v]["facing"]]
            back = get((x - fx, y, z - fz))
            sign_on[B[back] if back is not None else "air"] += 1

    lights = fam["light"]
    return dict(
        roof_support={k: n for k, n in under.most_common()},
        post_columns=len(posts), post_gap={k: n for k, n in gaps.most_common(4)},
        wall_signs=sum(sign_on.values()), wall_sign_on=dict(sign_on.most_common(6)),
        id=meta.get("id"), name=meta.get("name"), author=meta.get("author"), url=meta.get("url"),
        file_author=d["author"], data_version=d["data_version"], size=d["size"], blocks=total,
        nonground=nonground, ground_top=ground_top,
        density=round(total / (sx * sy * sz), 3), distinct_blocks=len(basec), states=len(pal),
        families={k: round(n / total, 3) for k, n in fam.most_common()},
        shape_ratio=round(sum(fam[f] for f in SHAPE_FAMS) / max(1, nonground), 3),
        detail_ratio=round(sum(fam[f] for f in DETAIL_FAMS) / max(1, nonground), 3),
        exterior_blocks=len(exterior), interior_blocks=total - len(exterior),
        enclosed_air=enclosed_air,
        ext_families={k: round(n / max(1, len(exterior)), 3) for k, n in ext_fam.most_common(10)},
        int_families={k: round(n / max(1, total - len(exterior)), 3) for k, n in int_fam.most_common(10)},
        ext_materials=[f"{k} {n}" for k, n in ext_mat.most_common(10)],
        materials_top=[f"{k} {n}" for k, n in matc.most_common(12)],
        materials_for_80pct=next((i + 1 for i, s in enumerate(
            __import__("itertools").accumulate(n for _, n in matc.most_common())) if s >= 0.8 * sum(matc.values())), None),
        top_blocks=[f"{k} {n}" for k, n in basec.most_common(25)],
        stairs_top=stairs_top, stairs_corner=stairs_corner, slab_top=slab_top, slab_double=slab_double,
        trapdoor_open=trap_open, trapdoor_closed_tophalf=trap_tophalf, log_horizontal=log_horiz,
        lantern_hanging=lantern_hang, leaves_persistent=leaves_persist,
        lights=lights, lights_per_100=round(100 * lights / max(1, nonground), 2),
        light_kinds=dict(collections.Counter(B[v] for v in vox.values() if F[v] == "light").most_common(6)),
        repurpose=dict(rep.most_common()),
        examples={k: dict(c.most_common(6)) for k, c in examples.items()},
        vertical_combos=[f"{k} {n}" for k, n in vert.most_common(30)],
        texture_mix=[f"{k} {n}" for k, n in mix.most_common(15)],
        bands=bands, roof_caps={k: n for k, n in roof.most_common(8)},
        roof_blocks=[f"{k} {n}" for k, n in roofmat.most_common(8)],
        relief=relief, symmetry_x=sym("x"), symmetry_z=sym("z"),
    )


def main():
    out = sys.argv[1]
    res = []
    for p in sys.argv[2:]:
        mp = os.path.join(os.path.dirname(p), "meta.json")
        meta = json.load(open(mp)) if os.path.exists(mp) else {}
        r = analyze(p, meta)
        r["slug"] = os.path.basename(os.path.dirname(p))
        res.append(r)
        print("analyzed", r["slug"], file=sys.stderr)
    json.dump(res, open(out, "w"), indent=1)


if __name__ == "__main__":
    main()
