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

import {
  GestureArbiter,
  type GestureArbiterConfig,
  type GestureIntent,
  type PointerSample,
} from "./gestures.ts";

export type TouchOwner = "none" | "tool" | "camera";

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
  /** Every finger is up: hide the cursor and the touch hover. */
  touchEnd(): void;
}

export interface TouchRouterOptions {
  /** The editing side right now, or `null` before a file is open. Read when a gesture starts. */
  target: () => TouchTarget | null;
  /** Everything a camera-owned gesture does with the arbiter's intents (orbit, pan, pinch). */
  camera: (intent: GestureIntent) => void;
  /** Thresholds and timers for the arbiter, for tests. */
  arbiter?: Omit<GestureArbiterConfig, "onIntent">;
}

export class TouchRouter {
  private readonly arbiter: GestureArbiter;
  private readonly getTarget: () => TouchTarget | null;
  private readonly camera: (intent: GestureIntent) => void;
  private readonly fingers = new Set<number>();
  private target: TouchTarget | null = null;
  private owner: TouchOwner = "none";
  /** The tool's gesture is over (cancelled, lifted or long-pressed): later samples change nothing until every finger is up. */
  private spent = false;

  constructor(options: TouchRouterOptions) {
    this.getTarget = options.target;
    this.camera = options.camera;
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
  }

  private onDown(sample: PointerSample): void {
    if (this.fingers.size === 0) {
      this.target = this.getTarget();
      this.owner = this.target?.touchToolActive === true ? "tool" : "camera";
      this.spent = false;
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

  private onIntent(intent: GestureIntent): void {
    if (this.owner !== "tool") {
      this.camera(intent);
      // Only a finger that landed alone and stayed still is a long press. The arbiter never says
      // so of a finger left over from a two-finger gesture, so that one never picks.
      if (intent.type === "longPress") this.target?.touchPickAt(intent.clientX, intent.clientY);
      // The arbiter says `tap` only for a finger that landed alone, stayed within the slop and lifted
      // before the long-press time: never for the end of a pan, a pinch, an orbit or a leftover finger.
      if (intent.type === "tap") this.target?.touchInspectAt(intent.clientX, intent.clientY);
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
