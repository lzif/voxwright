// SPDX-License-Identifier: AGPL-3.0-only
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readStructureNbt, UNSET, Volume } from "@voxwright/core";
import { describe, expect, it } from "vitest";
import {
  blockQuads,
  buildAtlas,
  cellQuads,
  effectiveBlock,
  type MeshRequest,
  MeshService,
  paddedFromVolume,
  parseSectionKey,
  prepareScene,
  quadAoLevels,
  quadCulledByNeighbour,
  SectionMesher,
  SectionStore,
  sectionKeysAround,
  splitBlockstate,
  untrustedBlocks,
} from "../src/index.ts";
import { snapNormal } from "../src/models.ts";
import {
  fakeAssets,
  haveVanilla,
  meshVolume,
  quadCount,
  quadSignatures,
  vanillaAssets,
  vanillaTextureIds,
} from "./mesh-helpers.ts";

const AIR = "minecraft:air";

function box(
  v: Volume,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  b: string,
) {
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) v.set(x, y, z, b);
}

describe("mesher with in-memory assets", () => {
  const assets = fakeAssets();
  const atlas = buildAtlas(assets.textureIds(), assets);
  const mesher = () => new SectionMesher({ assets, atlas });

  it("draws one block as 6 quads in the opaque bucket, in section-local coordinates", () => {
    const v = new Volume();
    v.set(3, 4, 5, "minecraft:stone");
    const [m] = [...meshVolume(v, mesher()).values()];
    expect(m?.quads).toBe(6);
    expect(m?.cutout).toBeNull();
    expect(m?.translucent).toBeNull();
    const b = m?.opaque;
    expect(b?.positions.length).toBe(24 * 3);
    expect(b?.uvs.length).toBe(24 * 2);
    expect(b?.colors.length).toBe(24 * 4);
    expect(b?.indices.length).toBe(36);
    expect(b?.indices).toBeInstanceOf(Uint16Array);
    const xs = [...(b?.positions ?? [])].filter((_, i) => i % 3 === 0);
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([3, 4]);
  });

  it("hides the faces between neighbours, also across a section border", () => {
    const v = new Volume();
    v.set(15, 0, 0, "minecraft:stone");
    v.set(16, 0, 0, "minecraft:stone"); // the next section along x
    const meshes = meshVolume(v, mesher());
    expect([...meshes.keys()].sort()).toEqual(["0,0,0", "1,0,0"]);
    expect(quadCount(meshes)).toBe(10); // two cubes, minus the shared pair
  });

  it("sends translucent glass to its own bucket and unknown blocks to the fallback cube", () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:glass");
    v.set(2, 0, 0, "minecraft:mystery_block");
    const m = mesher();
    const [mesh] = [...meshVolume(v, m).values()];
    expect(mesh?.cutout).toBeNull();
    expect(mesh?.translucent?.positions.length).toBe(24 * 3);
    expect(mesh?.opaque?.positions.length).toBe(24 * 3);
    expect([...m.fallbackBlocks]).toEqual(["minecraft:mystery_block"]);
    // The fallback cube is flat magenta, shaded per face: the top face keeps it as it is.
    const reds = new Set<string>();
    for (let k = 0; k < (mesh?.opaque?.colors.length ?? 0); k += 4)
      reds.add([...(mesh?.opaque?.colors.subarray(k, k + 3) ?? [])].join(","));
    expect(reds.has("205,70,205")).toBe(true);
    expect(reds.has("102,35,102")).toBe(true); // the bottom face, shaded to 0.5
  });

  it("tints leaves and draws them in the cutout bucket", () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:oak_leaves");
    const [mesh] = [...meshVolume(v, mesher()).values()];
    expect(mesh?.opaque).toBeNull();
    const c = mesh?.cutout?.colors;
    // Faces are shaded by direction, and the plains foliage tint (119, 171, 47) is in the colour.
    const up = [...(c ?? [])].slice(0, 4);
    expect(up.length).toBe(4);
    const top = Array.from({ length: 6 }, (_, f) => [
      ...(c?.subarray(f * 16, f * 16 + 3) ?? []),
    ]).find((rgb) => rgb[0] === 119 && rgb[1] === 171 && rgb[2] === 47);
    expect(top).toBeDefined();
  });

  it("darkens the vertices that touch a solid corner (ambient occlusion), as the CPU renderer does", () => {
    // A 4x4 stone floor with one block on it. The block's footprint has 4 corners; each floor
    // cell with a corner there loses brightness at that corner (one solid cell: level 2, 0.8).
    const v = new Volume();
    box(v, 0, 0, 0, 3, 0, 3, "minecraft:stone");
    v.set(1, 1, 1, "minecraft:stone");
    const [mesh] = [...meshVolume(v, mesher()).values()];
    const b = mesh?.opaque;
    const reds: number[] = [];
    for (let q = 0; q < (b?.positions.length ?? 0) / 12; q++) {
      const ys = [0, 1, 2, 3].map((k) => b?.positions[(q * 4 + k) * 3 + 1]);
      if (!ys.every((y) => y === 1)) continue; // the floor's top faces only
      for (let k = 0; k < 4; k++) reds.push(b?.colors[(q * 4 + k) * 4] as number);
    }
    expect(reds.length).toBe(15 * 4);
    expect(new Set(reds)).toEqual(new Set([255, 204]));
    expect(reds.filter((r) => r === 204).length).toBe(12);
  });

  it("keeps UVs inside the atlas tile of the texture", () => {
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    const [mesh] = [...meshVolume(v, mesher()).values()];
    const e = atlas.entries["block/stone"];
    const u0 = (e?.x ?? 0) / atlas.width;
    const u1 = ((e?.x ?? 0) + (e?.w ?? 0)) / atlas.width;
    for (const u of mesh?.opaque?.uvs.filter((_, i) => i % 2 === 0) ?? []) {
      expect(u).toBeGreaterThanOrEqual(u0);
      expect(u).toBeLessThanOrEqual(u1);
    }
  });

  it("maps mirrored, cropped and rotated faces onto exactly the texels the quad image holds", () => {
    // Rebuild each face from the atlas through its UVs and compare with the pipeline's own image.
    for (const block of ["minecraft:lopsided", "minecraft:slab", "minecraft:stone"]) {
      const v = new Volume();
      v.set(0, 0, 0, block);
      const [mesh] = [...meshVolume(v, mesher()).values()];
      const want = blockQuads(block, assets).quads;
      const b = mesh?.opaque;
      expect(b?.positions.length).toBe(want.length * 12);
      want.forEach((q, qi) => {
        const uv = (k: number) => [
          b?.uvs[(qi * 4 + k) * 2] as number,
          b?.uvs[(qi * 4 + k) * 2 + 1] as number,
        ];
        const [p0, p1, , p3] = [uv(0), uv(1), uv(2), uv(3)] as [
          number[],
          number[],
          number[],
          number[],
        ];
        const { width: w, height: h, channels: c, data } = q.image;
        for (let j = 0; j < h; j++)
          for (let i = 0; i < w; i++) {
            const a = (i + 0.5) / w;
            const bb = (j + 0.5) / h;
            const u =
              (p0[0] as number) +
              a * ((p3[0] as number) - (p0[0] as number)) +
              bb * ((p1[0] as number) - (p0[0] as number));
            const vv =
              (p0[1] as number) +
              a * ((p3[1] as number) - (p0[1] as number)) +
              bb * ((p1[1] as number) - (p0[1] as number));
            const ax = Math.floor(u * atlas.width);
            const ay = Math.floor(vv * atlas.height);
            for (let k = 0; k < 3; k++) {
              const texel = atlas.data[(ay * atlas.width + ax) * 4 + k] as number;
              const shadeFactor = q.tex?.shade ?? 1;
              expect(
                Math.min(255, Math.trunc(texel * shadeFactor)),
                `${block} quad ${qi} (${i},${j})`,
              ).toBe(data[(j * w + i) * c + k] as number);
            }
          }
      });
    }
  });

  it("winds every triangle to face along its quad's normal", () => {
    const v = new Volume();
    for (const [i, b] of ["minecraft:lopsided", "minecraft:slab", "minecraft:stone"].entries())
      v.set(i * 2, 0, 0, b);
    const [mesh] = [...meshVolume(v, mesher()).values()];
    const b = mesh?.opaque;
    expect(b).toBeTruthy();
    for (let t = 0; t < (b?.indices.length ?? 0); t += 3) {
      const [i0, i1, i2] = [0, 1, 2].map((k) => b?.indices[t + k] as number) as [
        number,
        number,
        number,
      ];
      const P = (i: number) =>
        [0, 1, 2].map((a) => b?.positions[i * 3 + a] as number) as [number, number, number];
      const [a, bb, c] = [P(i0), P(i1), P(i2)];
      const e1 = [bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]];
      const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [
        (e1[1] as number) * (e2[2] as number) - (e1[2] as number) * (e2[1] as number),
        (e1[2] as number) * (e2[0] as number) - (e1[0] as number) * (e2[2] as number),
        (e1[0] as number) * (e2[1] as number) - (e1[1] as number) * (e2[0] as number),
      ];
      // Outward: the centroid is on the outside of the cube's centre along the normal (cubes only).
      const cx = [(a[0] + bb[0] + c[0]) / 3, (a[1] + bb[1] + c[1]) / 3, (a[2] + bb[2] + c[2]) / 3];
      const owner = Math.floor((cx[0] as number) / 2);
      const centre = [owner * 2 + 0.5, 0.5, 0.5];
      if (owner === 1) {
        // The slab only reaches y = 0.5.
        centre[1] = 0.25;
      }
      const out = (cx[0] as number) - (centre[0] as number);
      const outY = (cx[1] as number) - (centre[1] as number);
      const outZ = (cx[2] as number) - (centre[2] as number);
      expect(
        (n[0] as number) * out + (n[1] as number) * outY + (n[2] as number) * outZ,
      ).toBeGreaterThan(0);
    }
  });
});

describe("section addressing", () => {
  it("finds the sections an edit reaches", () => {
    expect(sectionKeysAround(5, 5, 5)).toEqual(["0,0,0"]);
    expect(sectionKeysAround(0, 5, 5).sort()).toEqual(["-1,0,0", "0,0,0"]);
    expect(sectionKeysAround(15, 15, 15)).toHaveLength(8);
    // x = -1 is the last column of section -1, so it reaches section 0 as well.
    expect(sectionKeysAround(-1, 5, 5).sort()).toEqual(["-1,0,0", "0,0,0"]);
    expect(parseSectionKey("-2,3,0")).toEqual([-2, 3, 0]);
    expect(() => parseSectionKey("1,2")).toThrow();
  });
});

describe("section store", () => {
  function randomVolume(seed: number): Volume {
    let s = seed;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 2 ** 32;
    };
    const v = new Volume();
    const blocks = ["minecraft:stone", "minecraft:glass", AIR, "minecraft:dirt"];
    for (let i = 0; i < 700; i++)
      v.set(
        Math.floor(rnd() * 40) - 12,
        Math.floor(rnd() * 24) - 4,
        Math.floor(rnd() * 40) - 12,
        blocks[Math.floor(rnd() * blocks.length)] as string,
      );
    return v;
  }

  it("pads exactly as reading the volume cell by cell does, negative coordinates included", () => {
    const v = randomVolume(7);
    const store = new SectionStore(v);
    for (const key of store.keys()) {
      const [sx, sy, sz] = parseSectionKey(key);
      expect(Array.from(store.padded(sx, sy, sz))).toEqual(
        Array.from(paddedFromVolume(v, sx, sy, sz)),
      );
    }
    // And a section with no blocks of its own still sees its neighbours.
    const stray = Array.from(store.padded(5, 5, 5));
    expect(stray.every((n) => n === UNSET)).toBe(true);
  });

  it("follows edits: refresh re-reads a section, dropping it when it empties", () => {
    const v = new Volume();
    v.set(1, 1, 1, "minecraft:stone");
    const store = new SectionStore(v);
    expect(store.keys()).toEqual(["0,0,0"]);
    v.set(20, 1, 1, "minecraft:stone");
    expect(store.has("1,0,0")).toBe(false);
    expect(store.refresh("1,0,0")).toBe(true);
    expect(store.keys().sort()).toEqual(["0,0,0", "1,0,0"]);
    v.unset(20, 1, 1);
    expect(store.refresh("1,0,0")).toBe(false);
    expect(store.keys()).toEqual(["0,0,0"]);
  });

  it("does not offer sections that hold only air", () => {
    const v = new Volume();
    v.set(1, 1, 1, AIR);
    expect(new SectionStore(v).keys()).toEqual([]);
  });
});

describe("worker protocol", () => {
  it("answers init, palette and mesh messages in order, and survives structured cloning", () => {
    const assets = fakeAssets();
    const atlas = buildAtlas(assets.textureIds(), assets);
    const pack = {
      json: Object.fromEntries(
        ["blockstates/stone.json", "models/block/stone.json"].map((p) => [p, assets.readJson(p)]),
      ),
      textures: {
        "block/stone": assets.texture("block/stone") as NonNullable<
          ReturnType<typeof assets.texture>
        >,
      },
    };
    const svc = new MeshService();
    const clone = <T>(x: T): T => structuredClone(x);
    expect(svc.handle(clone({ type: "init", pack, atlas } satisfies MeshRequest))).toEqual({
      type: "ready",
    });
    expect(svc.handle({ type: "palette", reset: true, entries: ["minecraft:stone"] })).toBeNull();
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    const cells = paddedFromVolume(v, 0, 0, 0);
    const reply = svc.handle(
      clone({ type: "mesh", job: 9, key: "0,0,0", cells, slice: null } satisfies MeshRequest),
    );
    expect(reply?.type).toBe("meshed");
    if (reply?.type !== "meshed") return;
    expect(reply.job).toBe(9);
    expect(reply.mesh.quads).toBe(6);
    expect(() => structuredClone(reply)).not.toThrow();

    // A palette index the worker was never told about is reported, not thrown.
    const bad = svc.handle({
      type: "mesh",
      job: 10,
      key: "0,0,0",
      cells: Int32Array.from(cells).fill(5),
      slice: null,
    });
    expect(bad?.type).toBe("failed");
    // Before init there is nothing to mesh with.
    expect(
      new MeshService().handle({ type: "mesh", job: 1, key: "0,0,0", cells, slice: null })?.type,
    ).toBe("failed");
  });
});

describe.skipIf(!haveVanilla)("mesher against the CPU renderer's pipeline (vanilla assets)", () => {
  const assets = vanillaAssets();

  it("reproduces every texel of every reference block through the atlas", async () => {
    const atlas = buildAtlas(await vanillaTextureIds(), assets);
    const vectors = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../../vectors/quads.json", import.meta.url)), "utf8"),
    ) as { blocks: Record<string, unknown> };
    // Animated textures are one frame in the atlas, not the whole strip.
    for (const id of ["block/water_still", "block/lava_still", "block/fire_0"]) {
      const e = atlas.entries[id];
      if (e !== undefined) expect([e.w, e.h], id).toEqual([e.w, e.w]);
    }
    expect(atlas.entries["block/water_still"]?.h).toBe(16);
    let checked = 0;
    for (const canonical of Object.keys(vectors.blocks)) {
      const [name] = splitBlockstate(canonical);
      if (name === "minecraft:water" || name === "minecraft:lava") continue;
      const v = new Volume();
      v.set(0, 0, 0, canonical);
      // Walls, fences and panes take their connections from the neighbours: here, none.
      const alone = v.toDense();
      const quads = blockQuads(
        effectiveBlock(prepareScene(alone, assets), 0, 0, 0) ?? canonical,
        assets,
      ).quads;
      const mesher = new SectionMesher({ assets, atlas });
      const [mesh] = [...meshVolume(v, mesher).values()];
      // Only quads without a cullface survive on every face of an isolated block, so all do.
      const total = quads.length;
      const emitted = mesh?.quads ?? 0;
      expect(emitted, `${canonical} quad count`).toBe(total);
      // Gather each bucket's quads back in emission order and match them to the pipeline's quads.
      const order: ("opaque" | "cutout" | "translucent")[] = [];
      for (const q of quads) {
        const e = q.tex === undefined ? undefined : atlas.entries[q.tex.id];
        order.push(
          q.solid !== undefined || e === undefined
            ? (q.solid?.[3] ?? 255) < 255
              ? "translucent"
              : "opaque"
            : e.kind === 2
              ? "translucent"
              : e.kind === 1
                ? "cutout"
                : "opaque",
        );
      }
      const seen = { opaque: 0, cutout: 0, translucent: 0 };
      quads.forEach((q, qi) => {
        const bucket = order[qi] as "opaque" | "cutout" | "translucent";
        const b = mesh?.[bucket];
        const at = seen[bucket]++;
        expect(b, `${canonical} bucket ${bucket}`).toBeTruthy();
        if (q.tex === undefined) return; // flat colours carry no UV transform
        const uv = (k: number) => [
          b?.uvs[(at * 4 + k) * 2] as number,
          b?.uvs[(at * 4 + k) * 2 + 1] as number,
        ];
        const [p0, p1, , p3] = [uv(0), uv(1), uv(2), uv(3)] as [
          number[],
          number[],
          number[],
          number[],
        ];
        const { width: w, height: h, channels: c, data } = q.image;
        for (let j = 0; j < h; j++)
          for (let i = 0; i < w; i++) {
            const a = (i + 0.5) / w;
            const bb = (j + 0.5) / h;
            const u =
              (p0[0] as number) +
              a * ((p3[0] as number) - (p0[0] as number)) +
              bb * ((p1[0] as number) - (p0[0] as number));
            const vv =
              (p0[1] as number) +
              a * ((p3[1] as number) - (p0[1] as number)) +
              bb * ((p1[1] as number) - (p0[1] as number));
            const base =
              (Math.floor(vv * atlas.height) * atlas.width + Math.floor(u * atlas.width)) * 4;
            const f = q.tex.shade;
            const tint = q.tex.tint;
            // The pipeline fills the two transparent corner texels of the banner cloth with their
            // neighbour's colour; the atlas keeps the texture as it is, so those texels are cut out.
            if (atlas.data[base + 3] === 0 && (c === 3 || data[(j * w + i) * c + 3] !== 0))
              continue;
            for (let k = 0; k < 3; k++) {
              let t = atlas.data[base + k] as number;
              if (tint !== null) t = Math.min(255, Math.trunc(t * ((tint[k] as number) / 255)));
              expect(
                Math.min(255, Math.trunc(t * f)),
                `${canonical} quad ${qi} texel (${i},${j}) ch ${k}`,
              ).toBe(data[(j * w + i) * c + k] as number);
            }
          }
      });
      checked++;
    }
    expect(checked).toBeGreaterThan(70);
  });

  it("emits exactly the quads the CPU renderer's culling keeps, on a real build", async () => {
    const atlas = buildAtlas(await vanillaTextureIds(), assets);
    const bytes = readFileSync(
      fileURLToPath(
        new URL("../../../fixtures/real/rafeals-house/Rafeals_house.nbt", import.meta.url),
      ),
    );
    const { volume } = await readStructureNbt(new Uint8Array(bytes), { keepAir: true });
    // Legacy path: every cell, every quad, the CPU renderer's neighbour test.
    const dense = volume.toDense();
    const scene = prepareScene(dense, assets);
    const cache = new Map<
      string,
      { quads: ReturnType<typeof blockQuads>["quads"]; isFallback: boolean }
    >();
    let expected = 0;
    let darkened = 0;
    const [sx, sy, sz] = dense.size;
    for (let x = 0; x < sx; x++)
      for (let y = 0; y < sy; y++)
        for (let z = 0; z < sz; z++) {
          const idx = dense.data[(x * sy + y) * sz + z] as number;
          if (idx < 0 || dense.palette[idx] === AIR) continue;
          const cell = cellQuads(scene, x, y, z, cache);
          if (cell === null) continue;
          const name = splitBlockstate(dense.palette[idx] as string)[0];
          for (const q of cell.quads) {
            if (quadCulledByNeighbour(scene, q.cull, x, y, z, name)) continue;
            expected++;
            if (!q.flat) {
              const local = q.points;
              const lv = quadAoLevels(local, snapNormal(q.normal), [x, y, z], scene.occ);
              if (lv.some((l) => l !== 3)) darkened++;
            }
          }
        }
    expect(expected).toBeGreaterThan(1000);
    const mesher = new SectionMesher({ assets, atlas });
    const meshes = meshVolume(volume, mesher);
    expect(quadCount(meshes)).toBe(expected);
    expect(darkened).toBeGreaterThan(100);
    // The blocks it could not model are the ones the CPU renderer reports as untrusted.
    const untrusted = untrustedBlocks(dense, assets);
    for (const name of mesher.fallbackBlocks) expect([...untrusted.keys()]).toContain(name);
  });

  it("gives the same quads however the build is placed against section borders", () => {
    // Walls, fences, panes, stairs, leaves, glass and water straddling every border, then moved.
    let s = 99;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 2 ** 32;
    };
    const palette = [
      "minecraft:cobblestone_wall",
      "minecraft:oak_fence",
      "minecraft:glass_pane",
      "minecraft:oak_stairs[facing=north,half=bottom,shape=straight]",
      "minecraft:oak_leaves",
      "minecraft:glass",
      "minecraft:water",
      "minecraft:stone",
      "minecraft:oak_slab[type=bottom]",
      "minecraft:iron_bars",
      "minecraft:oak_fence_gate[facing=east,open=false]",
    ];
    const cells: [number, number, number, string][] = [];
    for (let x = 0; x < 22; x++)
      for (let y = 0; y < 22; y++)
        for (let z = 0; z < 22; z++)
          if (rnd() < 0.45)
            cells.push([x, y, z, palette[Math.floor(rnd() * palette.length)] as string]);
    const atlas = buildAtlas(
      ["block/stone", "block/glass", "block/oak_leaves", "block/water_still"],
      assets,
    );
    const build = (d: [number, number, number]): Map<string, ReturnType<SectionMesher["mesh"]>> => {
      const v = new Volume();
      for (const [x, y, z, b] of cells) v.set(x + d[0], y + d[1], z + d[2], b);
      return meshVolume(v, new SectionMesher({ assets, atlas }));
    };
    for (const d of [
      [8, 8, 8],
      [-5, 3, -11],
      [16, 0, 0],
    ] as const) {
      const a = quadSignatures(build([0, 0, 0]));
      const b = quadSignatures(build([...d]), [-d[0], -d[1], -d[2]]);
      expect(a.length).toBeGreaterThan(500);
      expect(b).toEqual(a);
    }
  });

  it("slices without remeshing the rest: rows outside the range read as unset, so cut faces show", () => {
    const atlas = buildAtlas(["block/stone"], assets);
    const v = new Volume();
    box(v, 0, 0, 0, 5, 9, 5, "minecraft:stone");
    const full = quadCount(meshVolume(v, new SectionMesher({ assets, atlas })));
    const cut = meshVolume(v, new SectionMesher({ assets, atlas }), { y0: 2, y1: 6 });
    // Same as a 6x5x6 box built on its own: 2 * (36 + 30 + 30) faces.
    expect(quadCount(cut)).toBe(2 * (36 + 30 + 30));
    expect(full).toBe(2 * (36 + 60 + 60));
    // An empty range gives nothing.
    expect(quadCount(meshVolume(v, new SectionMesher({ assets, atlas }), { y0: 40, y1: 50 }))).toBe(
      0,
    );
  });

  it("keeps wall and fence connections across a section border", () => {
    const atlas = buildAtlas(["block/stone"], assets);
    const mk = (x: number): number => {
      const v = new Volume();
      v.set(x, 0, 0, "minecraft:oak_fence");
      v.set(x + 1, 0, 0, "minecraft:oak_fence");
      return quadCount(meshVolume(v, new SectionMesher({ assets, atlas })));
    };
    // The fences join (arms between them) wherever the border falls.
    expect(mk(15)).toBe(mk(4));
    expect(mk(-1)).toBe(mk(4));
  });
});
