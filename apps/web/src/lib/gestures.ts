// SPDX-License-Identifier: AGPL-3.0-only

export type GestureIntent =
  | { type: "tap"; clientX: number; clientY: number }
  | { type: "longPress"; clientX: number; clientY: number }
  | { type: "oneFingerDragStart"; clientX: number; clientY: number }
  | { type: "oneFingerDragMove"; clientX: number; clientY: number; dx: number; dy: number }
  | { type: "oneFingerDragEnd"; clientX: number; clientY: number }
  | { type: "twoFingerPan"; dx: number; dy: number }
  | { type: "pinch"; factor: number; center: { x: number; y: number } }
  /**
   * The line between two fingers turned by `degrees` (positive: clockwise on the screen) since the
   * previous two-finger frame. Nothing is emitted until the twist since the fingers landed passes the
   * dead zone. The turn up to the zone is never made up: the frame that passes it says only what it
   * turned beyond the zone, and every later frame its own change, 1:1, so the view never jumps and
   * stays the size of the zone (10 degrees) behind the fingers.
   */
  | { type: "twist"; degrees: number }
  | { type: "multiFingerTap"; fingers: 2 | 3 }
  | { type: "cancel" };

export type PointerPhase = "down" | "move" | "up" | "cancel";

export interface PointerSample {
  readonly id: number;
  readonly type: PointerPhase;
  readonly x: number;
  readonly y: number;
  readonly time: number;
  readonly pointerType?: string;
}

export type TimerHandle = ReturnType<typeof setTimeout>;

export interface GestureArbiterConfig {
  readonly tapSlopPx?: number; // default: 8
  readonly longPressMs?: number; // default: 450
  readonly multiTapMaxMs?: number; // default: 300
  readonly multiTapSlopPx?: number; // default: 12
  readonly twistDeadZoneDeg?: number; // default: 10
  readonly onIntent?: (intent: GestureIntent) => void;
  readonly setTimeout?: (fn: () => void, ms: number) => TimerHandle;
  readonly clearTimeout?: (handle: TimerHandle) => void;
  readonly now?: () => number;
}

export const DEFAULT_GESTURE_CONFIG = {
  tapSlopPx: 8,
  longPressMs: 450,
  multiTapMaxMs: 300,
  multiTapSlopPx: 12,
  twistDeadZoneDeg: 10,
} as const;

/**
 * Below this distance between the fingers their angle is noise (a pinch that nearly closes), so the
 * twist neither accumulates nor fires there; the angle is measured again from where they are.
 */
export const TWIST_MIN_SPREAD_PX = 20;

/** An angle difference in degrees wrapped into (-180, 180]: 179 to -179 is a turn of 2, not -358. */
export function wrapDegrees(deg: number): number {
  const r = ((((deg + 180) % 360) + 360) % 360) - 180;
  return r === -180 ? 180 : r;
}

/** The angle of the line from the first finger to the second, in degrees, y down: clockwise on screen is positive. */
const lineAngle = (a: { curX: number; curY: number }, b: { curX: number; curY: number }): number =>
  (Math.atan2(b.curY - a.curY, b.curX - a.curX) * 180) / Math.PI;

interface ActivePointer {
  readonly id: number;
  readonly startX: number;
  readonly startY: number;
  readonly startTime: number;
  curX: number;
  curY: number;
  lastX: number;
  lastY: number;
  maxDist: number;
}

// `one_pointer_leftover` is the finger still down after one finger of a two-finger gesture lifted.
// It is never a tap or a long press. It turns into `one_pointer_dragging` (an orbit drag whose
// baseline is where the finger was when the other one lifted) on its first move, unless the gesture
// could still be a quick two-finger tap, which a small movement must not spoil.
type ArbiterState =
  | "idle"
  | "one_pointer_down"
  | "one_pointer_dragging"
  | "one_pointer_long_press"
  | "one_pointer_leftover"
  | "two_pointer_gesture"
  | "three_pointer_gesture"
  | "waiting_for_all_up";

export class GestureArbiter {
  private readonly config: Required<Omit<GestureArbiterConfig, "onIntent">> & {
    onIntent?: (intent: GestureIntent) => void;
  };
  private readonly pointers = new Map<number, ActivePointer>();
  private state: ArbiterState = "idle";
  private longPressTimer: TimerHandle | null = null;
  private longPressCandidateId: number | null = null;
  private dragActive = false;
  private abortedDrag = false;
  private maxConcurrentPointers = 0;
  private multiTapStartTime = 0;
  private multiTapEligible = false;
  private twoFingerPrevCenter: { x: number; y: number } | null = null;
  private twoFingerPrevSpread: number | null = null;
  private twoFingerPrevAngle: number | null = null;
  /** The twist since the two fingers landed, unwrapped, in degrees (positive: clockwise). */
  private twistTotal = 0;
  /** The dead zone was passed: twist now follows the fingers' changes, until they lift or one is left. */
  private twistActive = false;
  private readonly pendingMovePointers = new Set<number>();
  private pendingMoveTime: number | null = null;
  private pendingTimer: TimerHandle | null = null;

  constructor(config: GestureArbiterConfig = {}) {
    this.config = {
      tapSlopPx: config.tapSlopPx ?? DEFAULT_GESTURE_CONFIG.tapSlopPx,
      longPressMs: config.longPressMs ?? DEFAULT_GESTURE_CONFIG.longPressMs,
      multiTapMaxMs: config.multiTapMaxMs ?? DEFAULT_GESTURE_CONFIG.multiTapMaxMs,
      multiTapSlopPx: config.multiTapSlopPx ?? DEFAULT_GESTURE_CONFIG.multiTapSlopPx,
      twistDeadZoneDeg: config.twistDeadZoneDeg ?? DEFAULT_GESTURE_CONFIG.twistDeadZoneDeg,
      onIntent: config.onIntent,
      setTimeout: config.setTimeout ?? ((fn, ms) => setTimeout(fn, ms)),
      clearTimeout: config.clearTimeout ?? ((handle) => clearTimeout(handle)),
      now:
        config.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now())),
    };
  }

  public feed(sample: PointerSample): readonly GestureIntent[] {
    const intents: GestureIntent[] = [];

    // If a new move event arrives with a different timestamp while a move packet is pending,
    // evaluate the previous packet first. On non-move events (up, cancel, down), discard incomplete moves.
    if (this.pendingMovePointers.size > 0 && this.state === "two_pointer_gesture") {
      if (
        sample.type === "move" &&
        this.pendingMoveTime !== null &&
        sample.time !== this.pendingMoveTime
      ) {
        intents.push(...this.evaluateTwoFingerMove());
      } else if (sample.type !== "move") {
        this.cancelPendingFlush();
        this.pendingMovePointers.clear();
        this.pendingMoveTime = null;
      }
    }

    switch (sample.type) {
      case "down": {
        this.cancelPendingFlush();
        const pointer: ActivePointer = {
          id: sample.id,
          startX: sample.x,
          startY: sample.y,
          startTime: sample.time,
          curX: sample.x,
          curY: sample.y,
          lastX: sample.x,
          lastY: sample.y,
          maxDist: 0,
        };
        this.pointers.set(sample.id, pointer);
        this.maxConcurrentPointers = Math.max(this.maxConcurrentPointers, this.pointers.size);

        if (this.state === "waiting_for_all_up") {
          // Waiting for all fingers to lift; do not start new gestures
          break;
        }

        if (this.pointers.size === 1) {
          this.state = "one_pointer_down";
          this.dragActive = false;
          this.abortedDrag = false;
          this.longPressCandidateId = sample.id;
          this.scheduleLongPress(sample.id, sample.time);
        } else if (this.pointers.size === 2) {
          this.cancelLongPress();
          // A finger landing next to the one left over from an earlier two-finger gesture continues
          // that gesture: it keeps the tap timing and the "moved too far for a tap" verdict so far.
          const resumed = this.state === "one_pointer_leftover";

          // FEAT-MB2-04: Second-finger stroke abort
          if (this.dragActive) {
            this.dragActive = false;
            this.abortedDrag = true;
            intents.push({ type: "cancel" });
          }

          this.state = "two_pointer_gesture";
          this.pendingMovePointers.clear();
          this.pendingMoveTime = null;
          const [p1, p2] = [...this.pointers.values()];
          if (p1 && p2) {
            this.twoFingerPrevCenter = { x: (p1.curX + p2.curX) / 2, y: (p1.curY + p2.curY) / 2 };
            this.twoFingerPrevSpread = Math.max(
              Math.hypot(p1.curX - p2.curX, p1.curY - p2.curY),
              1,
            );
            // The twist is counted from the moment these two fingers are down together.
            this.twoFingerPrevAngle = lineAngle(p1, p2);
            this.twistTotal = 0;
            this.twistActive = false;
          }
          if (this.abortedDrag) {
            this.multiTapEligible = false;
          } else if (!resumed) {
            this.multiTapStartTime = sample.time;
            this.multiTapEligible = true;
          }
        } else if (this.pointers.size === 3) {
          this.cancelLongPress();
          this.state = "three_pointer_gesture";
          this.twoFingerPrevCenter = null;
          this.twoFingerPrevSpread = null;
          this.twoFingerPrevAngle = null;
          this.pendingMovePointers.clear();
          this.pendingMoveTime = null;
          if (!this.abortedDrag && this.multiTapEligible) {
            this.multiTapStartTime = sample.time;
          }
        } else {
          this.cancelLongPress();
          this.cancelPendingFlush();
          this.state = "waiting_for_all_up";
          this.multiTapEligible = false;
          this.twoFingerPrevCenter = null;
          this.twoFingerPrevSpread = null;
          this.twoFingerPrevAngle = null;
          this.pendingMovePointers.clear();
          this.pendingMoveTime = null;
        }
        break;
      }

      case "move": {
        const p = this.pointers.get(sample.id);
        if (!p) break;

        p.curX = sample.x;
        p.curY = sample.y;
        const dist = Math.hypot(sample.x - p.startX, sample.y - p.startY);
        p.maxDist = Math.max(p.maxDist, dist);

        if (dist > this.config.multiTapSlopPx) {
          this.multiTapEligible = false;
        }

        if (this.state === "one_pointer_down") {
          if (dist > this.config.tapSlopPx) {
            this.cancelLongPress();
            this.state = "one_pointer_dragging";
            this.dragActive = true;
            intents.push({ type: "oneFingerDragStart", clientX: p.startX, clientY: p.startY });
            intents.push({
              type: "oneFingerDragMove",
              clientX: sample.x,
              clientY: sample.y,
              dx: sample.x - p.lastX,
              dy: sample.y - p.lastY,
            });
            p.lastX = sample.x;
            p.lastY = sample.y;
          }
        } else if (this.state === "one_pointer_dragging") {
          const dx = sample.x - p.lastX;
          const dy = sample.y - p.lastY;
          p.lastX = sample.x;
          p.lastY = sample.y;
          intents.push({
            type: "oneFingerDragMove",
            clientX: sample.x,
            clientY: sample.y,
            dx,
            dy,
          });
        } else if (this.state === "one_pointer_leftover") {
          // A quick two-finger tap can still happen: a small movement before the lift is not an orbit.
          if (sample.time - this.multiTapStartTime > this.config.multiTapMaxMs) {
            this.multiTapEligible = false;
          }
          if (!this.multiTapEligible && (sample.x !== p.lastX || sample.y !== p.lastY)) {
            // The baseline is where the finger was when the other one lifted, so the first delta
            // is the movement since then and the view does not jump.
            this.state = "one_pointer_dragging";
            this.dragActive = true;
            intents.push({ type: "oneFingerDragStart", clientX: p.lastX, clientY: p.lastY });
            intents.push({
              type: "oneFingerDragMove",
              clientX: sample.x,
              clientY: sample.y,
              dx: sample.x - p.lastX,
              dy: sample.y - p.lastY,
            });
            p.lastX = sample.x;
            p.lastY = sample.y;
          }
        } else if (this.state === "two_pointer_gesture") {
          this.pendingMovePointers.add(sample.id);
          this.pendingMoveTime = sample.time;

          // If all active pointers have updated in this touch packet, evaluate immediately
          if (this.pendingMovePointers.size >= this.pointers.size) {
            this.cancelPendingFlush();
            intents.push(...this.evaluateTwoFingerMove());
          } else {
            // Otherwise buffer and schedule a fallback flush in case partner pointer is stationary
            this.schedulePendingFlush();
          }
        }
        break;
      }

      case "up": {
        this.cancelPendingFlush();
        const p = this.pointers.get(sample.id);
        if (!p) break;

        this.pointers.delete(sample.id);

        if (this.state === "one_pointer_down") {
          this.cancelLongPress();
          if (
            sample.time - p.startTime < this.config.longPressMs &&
            p.maxDist <= this.config.tapSlopPx
          ) {
            intents.push({ type: "tap", clientX: sample.x, clientY: sample.y });
          }
          this.state = "idle";
          this.maxConcurrentPointers = 0;
        } else if (this.state === "one_pointer_dragging") {
          this.dragActive = false;
          intents.push({ type: "oneFingerDragEnd", clientX: sample.x, clientY: sample.y });
          this.state = "idle";
          this.maxConcurrentPointers = 0;
        } else if (this.state === "one_pointer_long_press") {
          this.state = "idle";
          this.maxConcurrentPointers = 0;
        } else if (this.state === "two_pointer_gesture" || this.state === "three_pointer_gesture") {
          if (
            p.maxDist > this.config.multiTapSlopPx ||
            sample.time - this.multiTapStartTime > this.config.multiTapMaxMs
          ) {
            this.multiTapEligible = false;
          }

          if (this.pointers.size === 0) {
            if (
              this.multiTapEligible &&
              !this.abortedDrag &&
              (this.maxConcurrentPointers === 2 || this.maxConcurrentPointers === 3)
            ) {
              intents.push({
                type: "multiFingerTap",
                fingers: this.maxConcurrentPointers as 2 | 3,
              });
            }
            this.reset();
          } else {
            const leftover = this.state === "two_pointer_gesture" && this.pointers.size === 1;
            // A two-finger gesture drops to one finger: that finger keeps turning the view from
            // where it is now. After three fingers the remaining ones wait until all are up, so
            // an accidental palm or extra touch does not start a drag or a tap.
            this.state = leftover ? "one_pointer_leftover" : "waiting_for_all_up";
            if (leftover) {
              const [rest] = [...this.pointers.values()];
              if (rest) {
                rest.lastX = rest.curX;
                rest.lastY = rest.curY;
              }
            }
            this.twoFingerPrevCenter = null;
            this.twoFingerPrevSpread = null;
            this.twoFingerPrevAngle = null;
            this.pendingMovePointers.clear();
            this.pendingMoveTime = null;
            this.cancelPendingFlush();
          }
        } else if (this.state === "one_pointer_leftover" || this.state === "waiting_for_all_up") {
          if (
            p.maxDist > this.config.multiTapSlopPx ||
            sample.time - this.multiTapStartTime > this.config.multiTapMaxMs
          ) {
            this.multiTapEligible = false;
          }

          if (this.pointers.size === 0) {
            if (
              this.multiTapEligible &&
              !this.abortedDrag &&
              (this.maxConcurrentPointers === 2 || this.maxConcurrentPointers === 3)
            ) {
              intents.push({
                type: "multiFingerTap",
                fingers: this.maxConcurrentPointers as 2 | 3,
              });
            }
            this.reset();
          }
        }
        break;
      }

      case "cancel": {
        this.cancelLongPress();
        this.cancelPendingFlush();
        this.pointers.delete(sample.id);
        this.multiTapEligible = false;
        if (this.dragActive) {
          this.dragActive = false;
          intents.push({ type: "cancel" });
        }
        if (this.pointers.size === 0) {
          this.reset();
        } else {
          this.state = "waiting_for_all_up";
          this.twoFingerPrevCenter = null;
          this.twoFingerPrevSpread = null;
          this.twoFingerPrevAngle = null;
          this.pendingMovePointers.clear();
          this.pendingMoveTime = null;
          this.cancelPendingFlush();
        }
        break;
      }
    }

    if (this.config.onIntent) {
      for (const intent of intents) {
        this.config.onIntent(intent);
      }
    }

    return intents;
  }

  public flush(): readonly GestureIntent[] {
    if (this.pendingMovePointers.size > 0 && this.state === "two_pointer_gesture") {
      const intents = this.evaluateTwoFingerMove();
      if (this.config.onIntent) {
        for (const intent of intents) {
          this.config.onIntent(intent);
        }
      }
      return intents;
    }
    return [];
  }

  public stepTime(currentTime: number): readonly GestureIntent[] {
    const intents: GestureIntent[] = [];
    if (this.pendingMovePointers.size > 0 && this.state === "two_pointer_gesture") {
      intents.push(...this.evaluateTwoFingerMove());
    }
    if (this.state === "one_pointer_down" && this.longPressCandidateId !== null) {
      const p = this.pointers.get(this.longPressCandidateId);
      if (p && currentTime >= p.startTime + this.config.longPressMs) {
        if (p.maxDist <= this.config.tapSlopPx) {
          this.state = "one_pointer_long_press";
          this.cancelLongPress();
          intents.push({ type: "longPress", clientX: p.curX, clientY: p.curY });
          if (this.config.onIntent) {
            for (const intent of intents) {
              this.config.onIntent(intent);
            }
          }
        }
      }
    }
    return intents;
  }

  public reset(): void {
    this.cancelLongPress();
    this.cancelPendingFlush();
    this.pointers.clear();
    this.state = "idle";
    this.dragActive = false;
    this.abortedDrag = false;
    this.maxConcurrentPointers = 0;
    this.multiTapEligible = false;
    this.twoFingerPrevCenter = null;
    this.twoFingerPrevSpread = null;
    this.twoFingerPrevAngle = null;
    this.twistTotal = 0;
    this.twistActive = false;
    this.pendingMovePointers.clear();
    this.pendingMoveTime = null;
  }

  private schedulePendingFlush(): void {
    if (this.pendingTimer === null) {
      this.pendingTimer = this.config.setTimeout(() => {
        this.pendingTimer = null;
        this.flush();
      }, 0);
    }
  }

  private cancelPendingFlush(): void {
    if (this.pendingTimer !== null) {
      this.config.clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
  }

  private evaluateTwoFingerMove(): GestureIntent[] {
    if (this.state !== "two_pointer_gesture") {
      this.pendingMovePointers.clear();
      this.pendingMoveTime = null;
      return [];
    }
    const [p1, p2] = [...this.pointers.values()];
    if (!p1 || !p2) {
      this.pendingMovePointers.clear();
      this.pendingMoveTime = null;
      return [];
    }

    const center = { x: (p1.curX + p2.curX) / 2, y: (p1.curY + p2.curY) / 2 };
    const spread = Math.max(Math.hypot(p1.curX - p2.curX, p1.curY - p2.curY), 1);
    const intents: GestureIntent[] = [];

    if (this.twoFingerPrevCenter && this.twoFingerPrevSpread) {
      const dx = center.x - this.twoFingerPrevCenter.x;
      const dy = center.y - this.twoFingerPrevCenter.y;
      const panDist = Math.hypot(dx, dy);
      const spreadDiff = Math.abs(spread - this.twoFingerPrevSpread);
      const relSpreadChange = spreadDiff / this.twoFingerPrevSpread;

      // Disambiguation / Deadbanding:
      // Parallel pan dominance: when spread change is minimal (< 1.0px or < 1.5% relative change),
      // suppress spurious pinch intent.
      const isPinchSignificant = spreadDiff >= 1.0 && (panDist < 1.0 || relSpreadChange >= 0.015);

      // Pinch zoom dominance: when center movement is sub-slop (< 0.1px) or negligible relative to pinch,
      // suppress spurious pan intent.
      const isPanSignificant =
        panDist >= 0.1 && (spreadDiff < 1.0 || (panDist >= 0.5 && panDist >= 0.08 * spreadDiff));

      if (isPanSignificant) {
        intents.push({ type: "twoFingerPan", dx, dy });
        this.twoFingerPrevCenter = center;
      } else {
        this.twoFingerPrevCenter = center;
      }

      if (isPinchSignificant) {
        const factor = this.twoFingerPrevSpread / spread;
        intents.push({ type: "pinch", factor, center });
        this.twoFingerPrevSpread = spread;
      } else {
        this.twoFingerPrevSpread = spread;
      }

      this.evaluateTwist(p1, p2, spread, intents);
    } else {
      this.twoFingerPrevCenter = center;
      this.twoFingerPrevSpread = spread;
      this.twoFingerPrevAngle = lineAngle(p1, p2);
    }

    this.pendingMovePointers.clear();
    this.pendingMoveTime = null;
    return intents;
  }

  /**
   * The twist of this frame: how far the line between the fingers turned since the last one. Nothing
   * is said until the total since the fingers landed is past the dead zone; from then on every frame
   * says its own change, whatever the pan and pinch do. The turn inside the zone is not made up, so
   * the view never snaps: the frame that crosses the zone says the part of the total beyond it
   * (its own change when the previous frame ended at the edge of the zone), and the view then stays
   * the size of the zone behind the fingers. The total is of angle differences wrapped to
   * (-180, 180], so a twist across the +-180 line has no jump.
   */
  private evaluateTwist(
    p1: ActivePointer,
    p2: ActivePointer,
    spread: number,
    intents: GestureIntent[],
  ): void {
    const angle = lineAngle(p1, p2);
    const before = this.twoFingerPrevAngle;
    this.twoFingerPrevAngle = angle;
    // Fingers almost on top of each other have no angle worth following.
    if (before === null || spread < TWIST_MIN_SPREAD_PX) return;
    const delta = wrapDegrees(angle - before);
    if (this.twistActive) {
      if (delta !== 0) intents.push({ type: "twist", degrees: delta });
      return;
    }
    this.twistTotal += delta;
    if (Math.abs(this.twistTotal) > this.config.twistDeadZoneDeg) {
      this.twistActive = true;
      // The turn up to the edge of the zone stays unmade: only what lies beyond it is said.
      const beyond = this.twistTotal - Math.sign(this.twistTotal) * this.config.twistDeadZoneDeg;
      intents.push({ type: "twist", degrees: beyond });
    }
  }

  private scheduleLongPress(id: number, _startTime: number): void {
    this.cancelLongPress();
    this.longPressCandidateId = id;
    this.longPressTimer = this.config.setTimeout(() => {
      this.stepTime(this.config.now());
    }, this.config.longPressMs);
  }

  private cancelLongPress(): void {
    if (this.longPressTimer !== null) {
      this.config.clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.longPressCandidateId = null;
  }
}

export function pointerEventToSample(e: {
  readonly pointerId: number;
  readonly type: string;
  readonly clientX: number;
  readonly clientY: number;
  readonly timeStamp?: number;
  readonly pointerType?: string;
}): PointerSample {
  const phaseMap: Record<string, PointerPhase> = {
    pointerdown: "down",
    pointermove: "move",
    pointerup: "up",
    pointercancel: "cancel",
  };
  return {
    id: e.pointerId,
    type: phaseMap[e.type] ?? "move",
    x: e.clientX,
    y: e.clientY,
    time:
      typeof e.timeStamp === "number" && e.timeStamp > 0
        ? e.timeStamp
        : typeof performance !== "undefined"
          ? performance.now()
          : Date.now(),
    pointerType: e.pointerType,
  };
}
