// SPDX-License-Identifier: AGPL-3.0-only
import { Volume } from "@voxwright/core";
import { describe, expect, it } from "vitest";
import {
  buildAtlas,
  type MeshReply,
  type MeshRequest,
  MeshScheduler,
  MeshService,
  type MeshUpdate,
  sectionKeysAround,
  type WorkerLike,
} from "../src/index.ts";
import { fakeAssets } from "./mesh-helpers.ts";

/** A worker that runs the real service in this thread and answers on a later tick. */
class FakeWorker implements WorkerLike {
  onmessage: ((event: { data: MeshReply }) => void) | null = null;
  readonly service = new MeshService();
  readonly jobs: { key: string; sliced: boolean }[] = [];
  held: (() => void)[] | null = null;
  postMessage(message: MeshRequest, transfer?: ArrayBuffer[]): void {
    void transfer;
    if (message.type === "mesh")
      this.jobs.push({ key: message.key, sliced: message.slice !== null });
    const msg = structuredClone(message);
    const run = () => {
      const reply = this.service.handle(msg);
      if (reply) this.onmessage?.({ data: reply });
    };
    if (this.held !== null && message.type === "mesh") this.held.push(run);
    else queueMicrotask(run);
  }
  terminate(): void {}
}

const assets = fakeAssets();
const atlas = buildAtlas(assets.textureIds(), assets);
const pack = {
  json: Object.fromEntries(
    ["stone", "glass"].flatMap((n) =>
      [`blockstates/${n}.json`, `models/block/${n}.json`].map((p) => [p, assets.readJson(p)]),
    ),
  ),
  textures: {
    "block/stone": assets.texture("block/stone") as never,
    "block/glass": assets.texture("block/glass") as never,
  },
};

function setup(n = 2) {
  const workers = Array.from({ length: n }, () => new FakeWorker());
  const sched = new MeshScheduler({ workers, pack, atlas });
  return { workers, sched };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
async function settle(sched: MeshScheduler): Promise<MeshUpdate[]> {
  const out: MeshUpdate[] = [];
  for (let i = 0; i < 200; i++) {
    sched.pump();
    await tick();
    out.push(...sched.drain(1000));
    if (sched.idle()) break;
  }
  return out;
}

function sample(): Volume {
  const v = new Volume();
  for (let x = 0; x < 40; x += 3) for (let z = 0; z < 20; z += 3) v.set(x, 0, z, "minecraft:stone");
  v.set(5, 20, 5, "minecraft:glass");
  return v;
}

describe("mesh scheduler", () => {
  it("meshes every section of a new volume across the workers", async () => {
    const { sched, workers } = setup(3);
    await sched.whenReady();
    sched.setVolume(sample());
    const updates = await settle(sched);
    const keys = sched.sectionKeys().sort();
    expect(updates.map((u) => u.key).sort()).toEqual(keys);
    expect(updates.every((u) => u.mesh !== null && u.sliceTag === null)).toBe(true);
    expect(workers.filter((w) => w.jobs.length > 0).length).toBeGreaterThan(1);
    expect(sched.stats().meshMs.length).toBe(keys.length);
    expect(sched.idle()).toBe(true);
  });

  it("re-meshes only the sections it is told about, and reports a section that emptied", async () => {
    const { sched, workers } = setup();
    await sched.whenReady();
    const v = sample();
    sched.setVolume(v);
    await settle(sched);
    for (const w of workers) w.jobs.length = 0;

    v.set(3, 5, 3, "minecraft:glass");
    sched.markDirty(sectionKeysAround(3, 5, 3));
    const again = await settle(sched);
    expect(again.map((u) => u.key)).toEqual(["0,0,0"]);
    expect(workers.flatMap((w) => w.jobs)).toEqual([{ key: "0,0,0", sliced: false }]);

    v.unset(5, 20, 5);
    sched.markDirty(["0,1,0"]);
    const gone = await settle(sched);
    expect(gone.find((u) => u.key === "0,1,0")?.mesh).toBeNull();
  });

  it("meshes the open volume again with another pack", async () => {
    const { sched } = setup(2);
    await sched.whenReady();
    sched.setVolume(sample());
    await settle(sched);
    expect(sched.stats().fallback).toEqual([]);
    sched.setPack(null, buildAtlas([], { readJson: () => null, texture: () => null }));
    const again = await settle(sched);
    expect(again.map((u) => u.key).sort()).toEqual(sched.sectionKeys().sort());
    expect(again.every((u) => u.mesh !== null)).toBe(true);
    expect(sched.stats().fallback).toContain("minecraft:stone");
  });

  it("meshes dirty sections ahead of the initial build", async () => {
    const { sched, workers } = setup(1);
    await sched.whenReady();
    const v = sample();
    sched.setVolume(v);
    v.set(30, 0, 12, "minecraft:glass");
    sched.markDirty(["1,0,0"]);
    sched.pump();
    expect(workers[0]?.jobs[0]?.key).toBe("1,0,0");
    await settle(sched);
  });

  it("drops a result that a newer edit has outdated", async () => {
    const { sched, workers } = setup(1);
    await sched.whenReady();
    const v = sample();
    sched.setVolume(v);
    await settle(sched);
    const w = workers[0] as FakeWorker;
    w.held = [];
    v.set(1, 1, 1, "minecraft:stone");
    sched.markDirty(["0,0,0"]);
    sched.pump(); // in flight at the worker, held back
    v.set(2, 1, 1, "minecraft:stone");
    sched.markDirty(["0,0,0"]);
    const held = w.held;
    w.held = null;
    for (const run of held) run(); // the outdated answer arrives
    const rest = await settle(sched);
    expect(sched.stats().stale).toBe(1);
    // Only the newer mesh was delivered, and it has both new blocks' faces.
    expect(rest.filter((u) => u.key === "0,0,0")).toHaveLength(1);
  });

  it("cuts only the sections the slice planes pass through, and obsoletes old cuts", async () => {
    const { sched } = setup();
    await sched.whenReady();
    const v = new Volume();
    for (let y = 0; y < 48; y++) v.set(0, y, 0, "minecraft:stone");
    sched.setVolume(v);
    await settle(sched);
    sched.setSlice({ y0: 5, y1: 20 });
    const first = await settle(sched);
    expect(first.map((u) => `${u.key}@${u.sliceTag}`).sort()).toEqual(["0,0,0@5:20", "0,1,0@5:20"]);
    expect(sched.isBoundary("0,2,0")).toBe(false);
    sched.setSlice({ y0: 0, y1: 47 });
    expect(await settle(sched)).toEqual([]); // nothing straddles a range that holds everything
    sched.setSlice(null);
    expect(await settle(sched)).toEqual([]);
  });

  it("meshes with no assets as the fallback cube and says so", async () => {
    const workers = [new FakeWorker()];
    const sched = new MeshScheduler({ workers, pack: null, atlas });
    await sched.whenReady();
    const v = new Volume();
    v.set(0, 0, 0, "minecraft:stone");
    sched.setVolume(v);
    const [u] = await settle(sched);
    expect(u?.mesh?.quads).toBe(6);
    expect(sched.stats().fallback).toEqual(["minecraft:stone"]);
  });
});
