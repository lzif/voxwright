// SPDX-License-Identifier: AGPL-3.0-only

// The phone performance settings (MB7), as pure parts that run under Vitest in Node: the Quality
// setting (Auto / High / Low) and the pixel ratio each mode asks for, dynamic resolution (a lower
// ratio while a touch gesture is moving the view, back to the idle one a moment after it stops), and
// the limits that a touch-only device runs with (two mesher workers, a smaller undo history).

/** Where the Quality setting is kept in the browser. */
export const QUALITY_KEY = "voxwright.quality";

export type QualityMode = "auto" | "high" | "low";

export const QUALITY_MODES: readonly QualityMode[] = ["auto", "high", "low"];

export const DEFAULT_QUALITY: QualityMode = "auto";

/** The setting a browser kept from an earlier visit: one of the three words, else Auto. */
export function parseQuality(stored: string | null | undefined): QualityMode {
  return stored === "auto" || stored === "high" || stored === "low" ? stored : DEFAULT_QUALITY;
}

/** The highest pixel ratio the editor draws with, as the renderer's own default is. */
export const MAX_PIXEL_RATIO = 2;

/** The ratio used while a gesture is moving the view in Auto, and always in Low. */
export const MOVING_PIXEL_RATIO = 1;

/** How long after the last camera movement Auto goes back to the idle ratio, ms. */
export const SETTLE_MS = 200;

/** The ratio when nothing moves: High and Auto draw with the device's (at most 2), Low with 1. */
export function idlePixelRatio(mode: QualityMode, dpr: number): number {
  if (mode === "low") return MOVING_PIXEL_RATIO;
  const d = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  return Math.min(d, MAX_PIXEL_RATIO);
}

/** The ratio for a mode: while the view is moving only Auto drops, to 1 or the idle ratio if that is lower. */
export function pixelRatioFor(mode: QualityMode, dpr: number, moving: boolean): number {
  const idle = idlePixelRatio(mode, dpr);
  return mode === "auto" && moving ? Math.min(idle, MOVING_PIXEL_RATIO) : idle;
}

/**
 * What a mode changes about the renderer when the page creates it. Antialiasing is a WebGL context
 * attribute, fixed when the context is made: Low turns it off, the other modes leave it at the
 * renderer's default (on, except on a software renderer). A change of mode that needs a different
 * antialias value therefore applies at the next page load (`antialiasChangesOnReload`).
 */
export function rendererOptionsFor(
  mode: QualityMode,
  dpr: number,
): { antialias?: false; pixelRatio: number } {
  const pixelRatio = idlePixelRatio(mode, dpr);
  return mode === "low" ? { antialias: false, pixelRatio } : { pixelRatio };
}

/** Would going from the mode the renderer was created with to `chosen` need antialiasing set differently? */
export function antialiasChangesOnReload(created: QualityMode, chosen: QualityMode): boolean {
  return (created === "low") !== (chosen === "low");
}

/** A touch-only device runs at most this many mesher workers (big.LITTLE phones heat up and throttle with more). */
export const TOUCH_MAX_WORKERS = 2;

export const touchWorkerCount = (defaultCount: number): number =>
  Math.max(1, Math.min(TOUCH_MAX_WORKERS, defaultCount));

/** The undo history cap on a touch-only device, bytes. Core's default is 64 MB. */
export const TOUCH_HISTORY_BYTES = 16 * 1024 * 1024;

type Timer = ReturnType<typeof setTimeout>;

export interface DynamicResolutionOptions {
  /** Draw with this pixel ratio now. Called only when the ratio changes. */
  apply: (ratio: number) => void;
  /** The device's pixel ratio, read whenever a ratio is worked out (it changes with browser zoom). */
  dpr: () => number;
  mode?: QualityMode;
  settleMs?: number;
  setTimeout?: (fn: () => void, ms: number) => Timer;
  clearTimeout?: (handle: Timer) => void;
}

/**
 * Dynamic resolution. `moving()` is called for every camera movement of a touch gesture. In Auto the
 * first call drops the pixel ratio to 1 (one `apply`, none if the idle ratio is already 1), further
 * calls only push the settle timer back, and `settleMs` after the last call the idle ratio comes
 * back (one `apply`). In High and Low `moving()` does nothing: they never change with movement.
 * Changing the mode applies the new mode's ratio at once.
 */
export class DynamicResolution {
  private mode: QualityMode;
  private reduced = false;
  private timer: Timer | null = null;
  private applied: number | null = null;
  private readonly apply: (ratio: number) => void;
  private readonly dpr: () => number;
  private readonly settleMs: number;
  private readonly setTimer: (fn: () => void, ms: number) => Timer;
  private readonly clearTimer: (handle: Timer) => void;

  constructor(options: DynamicResolutionOptions) {
    this.apply = options.apply;
    this.dpr = options.dpr;
    this.mode = options.mode ?? DEFAULT_QUALITY;
    this.settleMs = options.settleMs ?? SETTLE_MS;
    this.setTimer = options.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimeout ?? ((h) => clearTimeout(h));
  }

  /** The mode in use. */
  get current(): QualityMode {
    return this.mode;
  }

  /** The ratio last applied, or `null` before anything was. */
  get ratio(): number | null {
    return this.applied;
  }

  /** Is the ratio lowered for a gesture right now? */
  get isReduced(): boolean {
    return this.reduced;
  }

  /** The ratio for the current state; call once at the start to set the first one. */
  refresh(): void {
    this.update();
  }

  setMode(mode: QualityMode): void {
    this.mode = mode;
    this.stopTimer();
    this.reduced = false;
    this.update();
  }

  /** The view moved because of a touch gesture. */
  moving(): void {
    if (this.mode !== "auto") return;
    if (!this.reduced) {
      this.reduced = true;
      this.update();
    }
    this.stopTimer();
    this.timer = this.setTimer(() => {
      this.timer = null;
      this.reduced = false;
      this.update();
    }, this.settleMs);
  }

  /** Forget the timer: the page is going away. */
  dispose(): void {
    this.stopTimer();
  }

  private update(): void {
    const ratio = pixelRatioFor(this.mode, this.dpr(), this.reduced);
    if (ratio === this.applied) return;
    this.applied = ratio;
    this.apply(ratio);
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
  }
}
