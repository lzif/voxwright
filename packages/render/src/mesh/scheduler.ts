// SPDX-License-Identifier: AGPL-3.0-only

// Decides which sections get meshed, when, and on which worker. It owns the
// snapshot of the volume (a `SectionStore`), a queue ordered by importance, and
// the book-keeping that keeps a slow worker from overwriting a newer mesh. It
// knows nothing about three.js or the DOM: it talks to anything shaped like a
// worker, so the same code is tested in Node with in-process fakes.
//
// Importance, most urgent first: sections the caller marked dirty (an edit the
// user is waiting to see), then sections that straddle the slice planes (their
// cut faces), then the initial build, nearest to the camera first.

import type { Volume } from "@voxwright/core";
import type { AtlasLayout } from "./atlas.ts";
import type { DecodedPack } from "./pack.ts";
import { PADDED_VOLUME, parseSectionKey, type SectionMesh } from "./section.ts";
import type { MeshReply, MeshRequest } from "./service.ts";
import { SectionStore } from "./store.ts";

/** What the scheduler needs from a worker. A DOM `Worker` fits. */
export interface WorkerLike {
  postMessage(message: MeshRequest, transfer?: ArrayBuffer[]): void;
  onmessage: ((event: { data: MeshReply }) => void) | null;
  terminate(): void;
}

/** A finished mesh, or the news that a section no longer has one. */
export interface MeshUpdate {
  key: string;
  /** `null`: the section is empty now, drop whatever was drawn for it. */
  mesh: SectionMesh | null;
  /** For a sliced mesh, the tag of the slice it was cut for; `null` for the whole section. */
  sliceTag: string | null;
}

export interface SliceWindow {
  /** Inclusive range of world cell rows to show. */
  y0: number;
  y1: number;
}

export interface SchedulerStats {
  /** Worker time per finished job, milliseconds. */
  meshMs: number[];
  /** Jobs finished and used. */
  done: number;
  /** Jobs finished but dropped because a newer one superseded them. */
  stale: number;
  queued: number;
  inFlight: number;
  /** Block names drawn as the magenta cube so far, union over workers. */
  fallback: string[];
}

interface Job {
  key: string;
  sliced: boolean;
  /** 0 edit, 1 slice boundary, 2 initial build. */
  priority: number;
}

interface Flight {
  job: number;
  key: string;
  sliced: boolean;
  version: number;
  epoch: number;
  sliceTag: string | null;
}

const LANES_PER_WORKER = 2;
export const sliceTagOf = (s: SliceWindow | null): string | null =>
  s === null ? null : `${s.y0}:${s.y1}`;

export interface SchedulerOptions {
  workers: WorkerLike[];
  /** `null` meshes everything as the fallback cube. */
  pack: DecodedPack | null;
  atlas: AtlasLayout;
  /** Called whenever there is something to take or to dispatch, to wake a render loop. */
  onActivity?: () => void;
}

export class MeshScheduler {
  private readonly workers: WorkerLike[];
  private readonly load: number[];
  private readonly paletteSent: number[];
  private readonly resetPending: boolean[];
  private readonly onActivity: () => void;

  private volume: Volume | null = null;
  private store: SectionStore | null = null;
  private epoch = 0;
  private nextJob = 1;
  private readonly versions = new Map<string, number>();
  private queue = new Map<string, Job>();
  private readonly flights = new Map<number, Flight>();
  private ready: MeshUpdate[] = [];
  private slice: SliceWindow | null = null;
  private focus: readonly [number, number, number] = [0, 0, 0];
  private readonly meshMs: number[] = [];
  private done = 0;
  private stale = 0;
  private readonly fallback = new Set<string>();
  private inited = 0;
  private readonly initWaiters: (() => void)[] = [];

  constructor(options: SchedulerOptions) {
    this.workers = options.workers;
    this.onActivity = options.onActivity ?? (() => {});
    this.load = this.workers.map(() => 0);
    this.paletteSent = this.workers.map(() => 0);
    this.resetPending = this.workers.map(() => true);
    this.workers.forEach((w) => {
      w.onmessage = (e) => this.onReply(w, e.data);
      w.postMessage({ type: "init", pack: options.pack, atlas: options.atlas });
    });
  }

  /** Resolves once every worker has loaded the assets. */
  whenReady(): Promise<void> {
    if (this.inited >= this.workers.length) return Promise.resolve();
    return new Promise((r) => this.initWaiters.push(r));
  }

  /**
   * Give every worker another pack and atlas, and mesh the open volume again from scratch (the old
   * meshes use the old atlas). Messages reach a worker in order, so the new pack lands first.
   */
  setPack(pack: DecodedPack | null, atlas: AtlasLayout): void {
    for (const w of this.workers) w.postMessage({ type: "init", pack, atlas });
    this.setVolume(this.volume);
  }

  /** Replace the volume: everything queued or in flight for the old one is dropped. */
  setVolume(volume: Volume | null): void {
    this.epoch++;
    this.queue.clear();
    this.versions.clear();
    this.ready = [];
    this.fallback.clear();
    this.volume = volume;
    this.resetPending.fill(true);
    this.paletteSent.fill(0);
    if (volume === null) {
      this.store = null;
      return;
    }
    this.store = new SectionStore(volume);
    for (const key of this.store.keys()) this.enqueue({ key, sliced: false, priority: 2 });
    this.enqueueBoundary();
    this.onActivity();
  }

  /** The volume changed in these sections: read them again and mesh them first. */
  markDirty(keys: readonly string[]): void {
    const store = this.store;
    if (store === null) return;
    for (const key of keys) {
      this.versions.set(key, (this.versions.get(key) ?? 0) + 1);
      const exists = store.refresh(key);
      if (exists && store.hasBlocks(key)) {
        this.enqueue({ key, sliced: false, priority: 0 });
        if (this.isBoundary(key)) this.enqueue({ key, sliced: true, priority: 0 });
      } else {
        this.queue.delete(`f:${key}`);
        this.queue.delete(`s:${key}`);
        this.ready.push({ key, mesh: null, sliceTag: null });
        this.ready.push({ key, mesh: null, sliceTag: sliceTagOf(this.slice) });
      }
    }
    this.onActivity();
  }

  /** Cut the view to a range of rows. Sections the cut passes through get their own meshes. */
  setSlice(slice: SliceWindow | null): void {
    this.slice = slice;
    // Sliced jobs for an older range are obsolete.
    for (const [k, j] of this.queue) if (j.sliced) this.queue.delete(k);
    this.enqueueBoundary();
    this.onActivity();
  }

  /** Where the viewer is, in world cells: nearer sections are meshed first. */
  setFocus(x: number, y: number, z: number): void {
    this.focus = [x, y, z];
  }

  /** Is the cut plane inside this section (so that it is neither wholly shown nor wholly hidden)? */
  isBoundary(key: string): boolean {
    const s = this.slice;
    if (s === null) return false;
    const y = parseSectionKey(key)[1] * 16;
    const inside = y >= s.y0 && y + 15 <= s.y1;
    const outside = y + 15 < s.y0 || y > s.y1;
    return !inside && !outside;
  }

  private enqueueBoundary(): void {
    if (this.store === null || this.slice === null) return;
    for (const key of this.store.keys())
      if (this.isBoundary(key)) this.enqueue({ key, sliced: true, priority: 1 });
  }

  private enqueue(job: Job): void {
    this.queue.set(`${job.sliced ? "s" : "f"}:${job.key}`, job);
  }

  /** Send queued work to idle workers. Cheap when there is nothing to do; call it every frame. */
  pump(): void {
    const store = this.store;
    const volume = this.volume;
    if (store === null || volume === null) return;
    while (this.queue.size > 0) {
      const w = this.freeWorker();
      if (w < 0) return;
      const next = this.pickNext();
      if (next === null) return;
      this.queue.delete(`${next.sliced ? "s" : "f"}:${next.key}`);
      this.dispatch(w, next, store, volume);
    }
  }

  private freeWorker(): number {
    let best = -1;
    for (let i = 0; i < this.workers.length; i++)
      if (
        (this.load[i] as number) < LANES_PER_WORKER &&
        (best < 0 || (this.load[i] as number) < (this.load[best] as number))
      )
        best = i;
    return best;
  }

  private pickNext(): Job | null {
    let best: Job | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    const [fx, fy, fz] = this.focus;
    for (const job of this.queue.values()) {
      const [sx, sy, sz] = parseSectionKey(job.key);
      const d = (sx * 16 + 8 - fx) ** 2 + (sy * 16 + 8 - fy) ** 2 + (sz * 16 + 8 - fz) ** 2;
      if (
        best === null ||
        job.priority < best.priority ||
        (job.priority === best.priority && d < bestD)
      ) {
        best = job;
        bestD = d;
      }
    }
    return best;
  }

  private dispatch(w: number, job: Job, store: SectionStore, volume: Volume): void {
    const worker = this.workers[w] as WorkerLike;
    const pal = volume.palette;
    const sent = this.paletteSent[w] as number;
    const reset = this.resetPending[w] as boolean;
    if (reset || sent < pal.length) {
      worker.postMessage({
        type: "palette",
        reset,
        entries: pal.slice(reset ? 0 : sent) as string[],
      });
      this.paletteSent[w] = pal.length;
      this.resetPending[w] = false;
    }
    const [sx, sy, sz] = parseSectionKey(job.key);
    const cells = store.padded(sx, sy, sz, new Int32Array(PADDED_VOLUME));
    const id = this.nextJob++;
    const slice = job.sliced ? this.slice : null;
    this.flights.set(id, {
      job: id,
      key: job.key,
      sliced: job.sliced,
      version: this.versions.get(job.key) ?? 0,
      epoch: this.epoch,
      sliceTag: sliceTagOf(slice),
    });
    this.load[w] = (this.load[w] as number) + 1;
    worker.postMessage({ type: "mesh", job: id, key: job.key, cells, slice }, [
      cells.buffer as ArrayBuffer,
    ]);
  }

  private onReply(worker: WorkerLike, msg: MeshReply): void {
    if (msg.type === "ready") {
      this.inited++;
      if (this.inited >= this.workers.length) for (const r of this.initWaiters.splice(0)) r();
      this.onActivity();
      return;
    }
    const w = this.workers.indexOf(worker);
    const f = this.flights.get(msg.job);
    this.flights.delete(msg.job);
    if (w >= 0) this.load[w] = Math.max(0, (this.load[w] as number) - 1);
    if (f === undefined) return;
    if (msg.type === "failed") {
      console.error(`meshing section ${msg.key} failed: ${msg.message}`);
      this.onActivity();
      return;
    }
    const current =
      f.epoch === this.epoch &&
      f.version === (this.versions.get(f.key) ?? 0) &&
      (!f.sliced || f.sliceTag === sliceTagOf(this.slice));
    if (!current) {
      this.stale++;
    } else {
      this.done++;
      this.meshMs.push(msg.ms);
      for (const n of msg.fallback) this.fallback.add(n);
      this.ready.push({ key: f.key, mesh: msg.mesh, sliceTag: f.sliced ? f.sliceTag : null });
    }
    this.pump(); // keep the workers fed between frames: a slow frame must not starve them
    this.onActivity();
  }

  /** Take up to `max` finished meshes, oldest first. */
  drain(max: number): MeshUpdate[] {
    return this.ready.splice(0, max);
  }

  /** Nothing queued, nothing out at a worker, nothing waiting to be taken. */
  idle(): boolean {
    return this.queue.size === 0 && this.flights.size === 0 && this.ready.length === 0;
  }

  /** Corners of the non-air blocks, as read when the volume was set. */
  bounds(): { min: [number, number, number]; max: [number, number, number] } | null {
    return this.store?.bounds() ?? null;
  }

  /** Sections that currently have blocks, as keys. */
  sectionKeys(): string[] {
    return this.store?.keys() ?? [];
  }

  stats(): SchedulerStats {
    return {
      meshMs: this.meshMs,
      done: this.done,
      stale: this.stale,
      queued: this.queue.size,
      inFlight: this.flights.size,
      fallback: [...this.fallback].sort(),
    };
  }

  dispose(): void {
    this.epoch++;
    this.queue.clear();
    this.ready = [];
    this.flights.clear();
    for (const w of this.workers) {
      w.onmessage = null;
      w.terminate();
    }
  }
}
