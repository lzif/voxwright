// SPDX-License-Identifier: AGPL-3.0-only

// Autosave: while an edited volume is open, copy it to IndexedDB a few seconds after the last change
// (and at the latest every `MAX_WAIT_MS` while changes keep coming), and when the tab is hidden.
// One slot: the snapshot of the volume being edited. It is cleared after a successful export and when
// the user discards it. The copy is taken when the browser is idle; the write is asynchronous.

import type { EditSession } from "./editor-session.svelte.ts";
import { isSnapshot, type Snapshot, type SnapshotMeta, takeSnapshot } from "./snapshot.ts";
import { deleteRecord, getRecord, putRecord, StorageError } from "./store.ts";

const KEY = "current";
/** Quiet time after the last change before a snapshot is written. */
export const DEBOUNCE_MS = 2000;
/** The longest a change waits for a snapshot while edits keep coming. */
export const MAX_WAIT_MS = 8000;

export interface AutosaveSource {
  session: EditSession;
  /** What the snapshot should say about the opened file. */
  meta(): Omit<SnapshotMeta, "edits">;
}

export type AutosaveState = "idle" | "saved" | "failed" | "unavailable";

export class Autosave {
  state = $state<AutosaveState>("idle");
  /** What went wrong, in words for the user; empty unless `state` is `failed` or `unavailable`. */
  problem = $state("");
  savedAt = $state<number | null>(null);

  private source: AutosaveSource | null = null;
  private timer = 0;
  private firstChange = 0;
  private written = false;
  /** Writes and deletes run one after another, so a clear is never overtaken by an older write. */
  private chain: Promise<void> = Promise.resolve();

  /** Follow this session (or none). */
  watch(source: AutosaveSource | null): void {
    this.cancelTimer();
    this.source = source;
    this.written = false;
    this.savedAt = null;
    if (this.state === "saved") this.state = "idle";
  }

  /** The session changed: write a snapshot soon, or drop the old one if nothing is left to save. */
  changed(): void {
    const src = this.source;
    if (src === null) return;
    if (!src.session.unsaved) {
      this.cancelTimer();
      if (this.written) void this.clear();
      return;
    }
    const now = Date.now();
    if (this.timer === 0) this.firstChange = now;
    else window.clearTimeout(this.timer);
    const wait = Math.max(0, Math.min(DEBOUNCE_MS, MAX_WAIT_MS - (now - this.firstChange)));
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      if (typeof requestIdleCallback === "function")
        requestIdleCallback(() => void this.write(), { timeout: 1000 });
      else void this.write();
    }, wait);
  }

  private cancelTimer(): void {
    if (this.timer !== 0) window.clearTimeout(this.timer);
    this.timer = 0;
  }

  /** Write a snapshot now if there is anything unsaved. Resolves when it is stored (or has failed). */
  flush(): Promise<void> {
    this.cancelTimer();
    return this.write();
  }

  private write(): Promise<void> {
    const run = async (): Promise<void> => {
      const src = this.source;
      if (src === null || !src.session.unsaved) return;
      const snapshot = takeSnapshot(src.session.volume, {
        ...src.meta(),
        edits: src.session.editCount,
      });
      try {
        await putRecord("autosave", KEY, snapshot);
        // The session may have been replaced or exported while the write was in flight.
        if (this.source !== src) {
          await deleteRecord("autosave", KEY).catch(() => {});
          return;
        }
        this.written = true;
        this.savedAt = snapshot.savedAt;
        this.state = "saved";
        this.problem = "";
      } catch (err) {
        this.fail(err);
      }
    };
    this.chain = this.chain.then(run, run);
    return this.chain;
  }

  private fail(err: unknown): void {
    const quota = err instanceof StorageError && err.quota;
    this.state = "failed";
    this.problem = quota
      ? "Autosave stopped because the browser's storage is full. Your edits are still here; export to keep them."
      : `Autosave could not write (${err instanceof Error ? err.message : String(err)}). Your edits are still here; export to keep them.`;
  }

  /** Delete the stored snapshot (after an export, or when the user discards it). */
  clear(): Promise<void> {
    this.cancelTimer();
    this.written = false;
    const run = async (): Promise<void> => {
      try {
        await deleteRecord("autosave", KEY);
        this.savedAt = null;
        if (this.state === "saved") this.state = "idle";
      } catch (err) {
        this.fail(err);
      }
    };
    this.chain = this.chain.then(run, run);
    return this.chain;
  }

  /**
   * The stored snapshot, `null` when there is none, or `"damaged"` when something is stored that
   * cannot be used. Storage that cannot be opened at all turns autosave off.
   */
  async peek(): Promise<Snapshot | "damaged" | null> {
    try {
      const value = await getRecord<unknown>("autosave", KEY);
      if (value === undefined) return null;
      return isSnapshot(value) ? value : "damaged";
    } catch (err) {
      this.state = "unavailable";
      this.problem = `Autosave is off: this browser does not allow storage here (${err instanceof Error ? err.message : String(err)}). Export to keep your edits.`;
      return null;
    }
  }
}
