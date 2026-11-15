# SPDX-License-Identifier: AGPL-3.0-only
"""Minimal stdlib reader for .litematic files: returns size, palette and voxels."""
import gzip, struct, io

def _read_nbt(buf):
    f = io.BytesIO(buf)
    def rd(n):
        b = f.read(n)
        if len(b) != n: raise EOFError
        return b
    def name():
        (n,) = struct.unpack(">H", rd(2)); return rd(n).decode("utf-8", "replace")
    def payload(t):
        if t == 1: return struct.unpack(">b", rd(1))[0]
        if t == 2: return struct.unpack(">h", rd(2))[0]
        if t == 3: return struct.unpack(">i", rd(4))[0]
        if t == 4: return struct.unpack(">q", rd(8))[0]
        if t == 5: return struct.unpack(">f", rd(4))[0]
        if t == 6: return struct.unpack(">d", rd(8))[0]
        if t == 7: (n,) = struct.unpack(">i", rd(4)); return rd(n)
        if t == 8: return name()
        if t == 9:
            et, n = struct.unpack(">bi", rd(5)); return [payload(et) for _ in range(n)]
        if t == 10:
            out = {}
            while True:
                (ct,) = struct.unpack(">b", rd(1))
                if ct == 0: return out
                k = name(); out[k] = payload(ct)
        if t == 11: (n,) = struct.unpack(">i", rd(4)); return list(struct.unpack(f">{n}i", rd(4*n)))
        if t == 12: (n,) = struct.unpack(">i", rd(4)); return list(struct.unpack(f">{n}q", rd(8*n)))
        raise ValueError(f"bad tag {t}")
    (t,) = struct.unpack(">b", rd(1)); name(); return payload(t)

def state_str(entry):
    n = entry["Name"]; p = entry.get("Properties") or {}
    if p: n += "[" + ",".join(f"{k}={v}" for k, v in sorted(p.items())) + "]"
    return n

def load(path):
    root = _read_nbt(gzip.decompress(open(path, "rb").read()))
    regions = root["Regions"]
    palette, pidx = [], {}
    voxels = {}  # (x,y,z) -> palette index (air dropped)
    for rname, r in regions.items():
        pos = r["Position"]; size = r["Size"]
        sx, sy, sz = size["x"], size["y"], size["z"]
        ox = pos["x"] + (sx + 1 if sx < 0 else 0)
        oy = pos["y"] + (sy + 1 if sy < 0 else 0)
        oz = pos["z"] + (sz + 1 if sz < 0 else 0)
        ax, ay, az = abs(sx), abs(sy), abs(sz)
        pal = [state_str(e) for e in r["BlockStatePalette"]]
        bits = max(2, (len(pal) - 1).bit_length())
        longs = [v & 0xFFFFFFFFFFFFFFFF for v in r["BlockStates"]]
        mask = (1 << bits) - 1
        vol = ax * ay * az
        local = []
        for p in pal:
            if p not in pidx: pidx[p] = len(palette); palette.append(p)
            local.append(pidx[p])
        for i in range(vol):
            start = i * bits; li = start >> 6; off = start & 63
            v = longs[li] >> off
            if off + bits > 64: v |= longs[li + 1] << (64 - off)
            v &= mask
            st = pal[v]
            if st in ("minecraft:air", "minecraft:cave_air", "minecraft:void_air"): continue
            x = i % ax; z = (i // ax) % az; y = i // (ax * az)
            voxels[(ox + x, oy + y, oz + z)] = local[v]
    if voxels:
        mn = [min(k[i] for k in voxels) for i in range(3)]
        voxels = {(x - mn[0], y - mn[1], z - mn[2]): v for (x, y, z), v in voxels.items()}
    size = [max(k[i] for k in voxels) + 1 for i in range(3)] if voxels else [0, 0, 0]
    meta = root.get("Metadata", {})
    return dict(size=size, palette=palette, voxels=voxels, data_version=root.get("MinecraftDataVersion"),
                name=meta.get("Name"), author=meta.get("Author"), regions=len(regions))
