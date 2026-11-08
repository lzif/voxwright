// SPDX-License-Identifier: AGPL-3.0-only

// Who a touch gesture belongs to: the editing tool (through the offset cursor) or the camera.
//
// The decision is taken once per gesture, when the first finger lands with no other finger down:
// the tool owns the gesture if a touch tool is armed in the orbit camera, the camera owns it
// otherwise. It holds until every finger is up, with one exception: a second finger arriving while
// the tool owns the gesture cancels the tool's work (a stroke in progress is reverted) and hands
// the gesture to the camera, so two-finger pan and pinch work. A finger left down afterwards never
// paints; the arbiter turns it into a one-finger orbit from where it is, and the camera gets that.
//
// The router sits in front of a `GestureArbiter` and reads the raw pointer samples itself, because
// the arbiter's intents do not cover everything the router must see: a second finger before a drag
// has started, or a `pointercancel` before it, produce no intent. The arbiter's intents then drive
// the discrete steps of a tool gesture (tap, stroke start, stroke end, long press), while the raw
// samples move the cursor. No DOM here, so it runs under Vitest with synthetic sequences.
//
// A double tap is also found here, because only the router sees the sample times: two taps of a
// camera-owned gesture (the arbiter's `tap`, never the end of a drag) whose second finger lands at most
// `DOUBLE_TAP_MAX_MS` after the first lifted, and at most `DOUBLE_TAP_SLOP_PX` away, ask the target to
// focus the camera there (`touchFocusAt`). The first tap still inspects, as it always did. Any other
// intent of the camera, and any gesture the tool owns, forgets the first tap.

import {
  GestureArbiter,
  type GestureArbiterConfig,
  type GestureIntent,
  type PointerSample,
} from "./gestures.ts";

export type TouchOwner = "none" | "tool" | "camera";

/** The most time between the first tap's lift and the second finger landing for a double tap, ms. */
export const DOUBLE_TAP_MAX_MS = 300;
/** The most distance between the two taps for a double tap, CSS px. */
export const DOUBLE_TAP_SLOP_PX = 24;

/** What the router asks of the editing side (`EditSession` implements it). All points are client coordinates of the finger. */
export interface TouchTarget {
  /** Would a gesture that starts now belong to the tool: a touch tool armed, in the orbit camera? */
  readonly touchToolActive: boolean;
  /** A finger landed or moved. Returns false when the editor ended the gesture itself (it was dragged off the canvas). */
  touchMove(x: number, y: number): boolean;
  /** The finger lifted without moving past the slop: apply the tool once. */
  touchTap(x: number, y: number): void;
  /** The finger moved past the slop: begin a stroke at the point where it first touched. */
  touchStrokeBegin(x: number, y: number): void;
  /** The finger lifted after a drag: commit the stroke. */
  touchStrokeEnd(x: number, y: number): void;
  /** Throw the gesture away: revert a stroke in progress and hide the cursor. */
  touchCancel(): void;
  /** The finger was held still: pick the block under the cursor (the tool stays). */
  touchLongPress(x: number, y: number): void;
  /** A camera gesture was held still: pick the block under the finger itself. */
  touchPickAt(x: number, y: number): void;
  /**
   * A camera-owned gesture was a tap (a short, still touch, never the end of a pan, pinch or
   * orbit): inspect the block under the finger itself. The target decides whether its tool does
   * anything with it (only View does).
   */
  touchInspectAt(x: number, y: number): void;
  /**
   * A camera-owned double tap: bring the block under the finger into focus (the orbit target moves
   * onto it and the distance halves). The target decides whether its tool does anything with it
   * (only View does) and whether there is a block there at all.
   */
  touchFocusAt(x: number, y: number): void;
  /** Every finger is up: hide the cursor and the touch hover. */
  touchEnd(): void;
}

export interface TouchRouterOptions {
  /** The editing side right now, or `null` before a file is open. Read when a gesture starts. */
  target: () => TouchTarget | null;
  /** Everything a camera-owned gesture does with the arbiter's intents (orbit, pan, pinch). */
  camera: (intent: GestureIntent) => void;
  /**
   * A quick tap with two or three fingers (the arbiter's `multiFingerTap`) ended. The page maps it to
   * Undo or Redo when the user turned that shortcut on. Called once, after every finger is up, and
   * also when the gesture began on a touch tool: the second finger had cancelled the tool's work by
   * then, so the tap changes nothing but what this does. Never called for a tool-owned gesture.
   */
  multiTap?: (fingers: 2 | 3) => void;
  /** Thresholds and timers for the arbiter, for tests. */
  arbiter?: Omit<GestureArbiterConfig, "onIntent">;
  /** Longest gap between a tap's lift and the next finger down for a double tap, ms (default `DOUBLE_TAP_MAX_MS`). */
  doubleTapMaxMs?: number;
  /** Farthest the second tap may be from the first, px (default `DOUBLE_TAP_SLOP_PX`). */
  doubleTapSlopPx?: number;
}

export class TouchRouter {
  private readonly arbiter: GestureArbiter;
  private readonly getTarget: () => TouchTarget | null;
  private readonly camera: (intent: GestureIntent) => void;
  private readonly multiTap: ((fingers: 2 | 3) => void) | undefined;
  private readonly fingers = new Set<number>();
  private target: TouchTarget | null = null;
  private owner: TouchOwner = "none";
  /** The tool's gesture is over (cancelled, lifted or long-pressed): later samples change nothing until every finger is up. */
  private spent = false;
  private readonly doubleTapMaxMs: number;
  private readonly doubleTapSlopPx: number;
  /** The time of the sample being fed, and of the first finger of the gesture in progress going down. */
  private sampleTime = 0;
  private downTime = 0;
  /** The last camera-owned tap, for a double tap: where it lifted, when, and on which target. */
  private lastTap: { x: number; y: number; upTime: number; target: TouchTarget } | null = null;

  constructor(options: TouchRouterOptions) {
    this.getTarget = options.target;
    this.camera = options.camera;
    this.multiTap = options.multiTap;
    this.doubleTapMaxMs = options.doubleTapMaxMs ?? DOUBLE_TAP_MAX_MS;
    this.doubleTapSlopPx = options.doubleTapSlopPx ?? DOUBLE_TAP_SLOP_PX;
    this.arbiter = new GestureArbiter({
      ...options.arbiter,
      onIntent: (intent) => this.onIntent(intent),
    });
  }

  /** Who owns the gesture in progress (`none` while no finger is down). */
  get currentOwner(): TouchOwner {
    return this.owner;
  }

  /** Feed one raw pointer sample, in the order the browser delivers them. */
  feed(sample: PointerSample): void {
    this.sampleTime = sample.time;
    switch (sample.type) {
      case "down":
        this.onDown(sample);
        break;
      case "move":
        this.onMove(sample);
        break;
      case "cancel":
        // The arbiter says nothing about a cancel before a drag has started.
        this.abortTool();
        break;
      case "up":
        break;
    }
    this.arbiter.feed(sample);
    if (sample.type === "up" || sample.type === "cancel") this.lift(sample.id);
  }

  /** Let the arbiter's clock run (the long press), for tests; in the page its own timer does this. */
  stepTime(currentTime: number): void {
    this.arbiter.stepTime(currentTime);
  }

  /** Give up everything: the page is going away or the session was replaced. */
  reset(): void {
    this.abortTool();
    this.arbiter.reset();
    this.fingers.clear();
    this.owner = "none";
    this.spent = false;
    this.target = null;
    this.lastTap = null;
  }

  private onDown(sample: PointerSample): void {
    if (this.fingers.size === 0) {
      this.target = this.getTarget();
      this.owner = this.target?.touchToolActive === true ? "tool" : "camera";
      this.spent = false;
      this.downTime = sample.time;
      // A double tap is the camera's: a gesture the tool owns never pairs with a tap before it.
      if (this.owner === "tool") this.lastTap = null;
    }
    this.fingers.add(sample.id);
    if (this.fingers.size >= 2) {
      if (this.owner === "tool") {
        this.abortTool();
        this.owner = "camera";
        this.spent = false;
      }
    } else {
      this.moveTool(sample);
    }
  }

  private onMove(sample: PointerSample): void {
    if (this.fingers.has(sample.id) && this.fingers.size === 1) this.moveTool(sample);
  }

  private moveTool(sample: PointerSample): void {
    if (this.owner !== "tool" || this.spent || this.target === null) return;
    // False: the editor cancelled the gesture itself (the cursor or the finger left the canvas).
    if (!this.target.touchMove(sample.x, sample.y)) this.spent = true;
  }

  /** Cancel the tool's work, once, if the tool still has any. */
  private abortTool(): void {
    if (this.owner !== "tool" || this.spent) return;
    this.spent = true;
    this.target?.touchCancel();
  }

  private lift(id: number): void {
    this.fingers.delete(id);
    if (this.fingers.size > 0) return;
    if (this.owner === "tool") this.target?.touchEnd();
    this.owner = "none";
    this.spent = false;
    this.target = null;
  }

  /**
   * A camera-owned tap lifted at (x, y). If the previous one lifted at most `doubleTapMaxMs` before
   * this finger went down, and within `doubleTapSlopPx` of here, this is a double tap and the target
   * focuses; the pair is used up, so a third quick tap starts a new pair rather than focusing again.
   */
  private noteTap(x: number, y: number): void {
    const target = this.target;
    if (target === null) return;
    const prev = this.lastTap;
    const gap = prev === null ? 0 : this.downTime - prev.upTime;
    if (
      prev !== null &&
      prev.target === target &&
      gap >= 0 &&
      gap <= this.doubleTapMaxMs &&
      Math.hypot(x - prev.x, y - prev.y) <= this.doubleTapSlopPx
    ) {
      this.lastTap = null;
      target.touchFocusAt(x, y);
      return;
    }
    this.lastTap = { x, y, upTime: this.sampleTime, target };
  }

  private onIntent(intent: GestureIntent): void {
    if (this.owner !== "tool") {
      this.camera(intent);
      // Only a finger that landed alone and stayed still is a long press. The arbiter never says
      // so of a finger left over from a two-finger gesture, so that one never picks.
      if (intent.type === "longPress") this.target?.touchPickAt(intent.clientX, intent.clientY);
      // The arbiter says `tap` only for a finger that landed alone, stayed within the slop and lifted
      // before the long-press time: never for the end of a pan, a pinch, an orbit or a leftover finger.
      if (intent.type === "tap") {
        this.target?.touchInspectAt(intent.clientX, intent.clientY);
        this.noteTap(intent.clientX, intent.clientY);
      } else {
        this.lastTap = null; // a drag, pan, pinch, twist, long press or cancel in between
      }
      if (intent.type === "multiFingerTap") this.multiTap?.(intent.fingers);
      return;
    }
    const target = this.target;
    if (this.spent || target === null) return;
    switch (intent.type) {
      case "tap":
        this.spent = true;
        target.touchTap(intent.clientX, intent.clientY);
        break;
      case "oneFingerDragStart":
        target.touchStrokeBegin(intent.clientX, intent.clientY);
        break;
      case "oneFingerDragEnd":
        this.spent = true;
        target.touchStrokeEnd(intent.clientX, intent.clientY);
        break;
      case "longPress":
        this.spent = true;
        target.touchLongPress(intent.clientX, intent.clientY);
        break;
      case "cancel":
        this.abortTool();
        break;
      default:
        // oneFingerDragMove: the raw samples already moved the cursor. The rest is two or more fingers.
        break;
    }
  }
}
