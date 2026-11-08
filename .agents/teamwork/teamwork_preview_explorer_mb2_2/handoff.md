# Handoff Report: Pure Gesture Arbiter (FEAT-MB2-03) & Second-Finger Abort (FEAT-MB2-04)

## 1. Observation

### 1.1 Specification & Interface Contracts

- **`PROJECT.md` lines 128–141**:

  ```typescript
  export type GestureIntent =
    | { type: "tap"; clientX: number; clientY: number }
    | { type: "longPress"; clientX: number; clientY: number }
    | { type: "oneFingerDragStart"; clientX: number; clientY: number }
    | { type: "oneFingerDragMove"; clientX: number; clientY: number; dx: number; dy: number }
    | { type: "oneFingerDragEnd"; clientX: number; clientY: number }
    | { type: "twoFingerPan"; dx: number; dy: number }
    | { type: "pinch"; factor: number; center: { x: number; y: number } }
    | { type: "multiFingerTap"; fingers: 2 | 3 }
    | { type: "cancel" };
  ```
- **`docs/mobile-editor-plan.md` §2.2**:
  > "Whichever fingers are down decide the mode for the whole gesture. A second finger arriving during a one-finger tool drag cancels that stroke (`Stroke.cancel()` already reverts and marks dirty), then the gesture becomes a camera gesture; this avoids half-painted strokes. A gesture arbiter (pure module, section 3) holds this state and is tested in Node with synthetic pointer sequences."
- **`docs/mobile-editor-plan.md` §3**:
  > "New pure module `lib/gestures.ts`: a state machine from pointer events (id, type, position, time) to intents (`tap`, `longPress`, `drag-start/move/end`, `twoFingerPan`, `pinch`, `twist`, `multiTap`, `cancel`), with thresholds as constants. No DOM, so it runs under Vitest with synthetic sequences, like `editing.ts`."
- **Threshold constants specified across plan**:
  - `TAP_DISTANCE_THRESHOLD_PX = 8` (<8 px movement)
  - `LONG_PRESS_MS = 450` (~450 ms hold)
  - `MULTI_FINGER_TAP_MAX_DURATION_MS = 300` (<300 ms duration for multi-finger taps)

### 1.2 Existing Camera & Stroke Handlers

- **`packages/render/src/webgl/renderer.ts` lines 845–851**:

  ```typescript
  if (this.pointers.size === 2) {
    const spread = this.pointerSpread();
    if (this.pinch > 0 && spread > 0) this.orbit.zoom(this.pinch / spread);
    this.pinch = spread;
    this.requestFrame();
    return;
  }
  ```

  The zoom factor in `OrbitController.zoom(factor)` multiplies camera distance by `factor`:
  - When fingers spread apart (`spread > pinch`), `pinch / spread < 1.0`, decreasing camera distance (zooming in).
  - When fingers move together (`spread < pinch`), `pinch / spread > 1.0`, increasing camera distance (zooming out).
- **`apps/web/src/lib/editor-session.svelte.ts` lines 539–548**:

  ```typescript
  private cancelDrag(): void {
    const drag = this.drag;
    if (drag === null) return;
    this.drag = null;
    if (drag.kind === "brush") {
      drag.stroke.cancel();
      this.flush();
    } else if (drag.kind === "select") this.selection = drag.before;
    this.refreshHighlight();
  }
  ```

  Receiving `{ type: "cancel" }` from the arbiter allows `EditSession` to cleanly call `cancelDrag()`, invoking `Stroke.cancel()` to revert dirty chunks.

### 1.3 Vitest Suite Configuration

- **`apps/web/vite.config.ts` line 70**:

  ```typescript
  test: { name: "web", include: ["test/**/*.test.ts"] },
  ```

  Currently only matches files in `test/`. When implementing `apps/web/src/lib/gestures.test.ts`, the config must either be updated to `include: ["test/**/*.test.ts", "src/**/*.test.ts"]`, or a test file in `apps/web/test/gestures.test.ts` should import and test the module.

---

## 2. Logic Chain

1. **Zero-DOM Requirement & Input Decoupling**:
   - As observed in §1.1 and §1.3, `gestures.ts` must execute in Node under Vitest without DOM globals (`window`, `document`, or browser `PointerEvent`).
   - Defining a plain data interface `PointerSample` (`{ id: number, type: "down" | "move" | "up" | "cancel", x: number, y: number, time: number }`) decouples the state machine from browser events.
   - A helper `pointerEventToSample` can accept any object matching this shape without referencing the global `PointerEvent` class.

2. **Time Handling & Test Determinism**:
   - A `longPress` requires detecting that 450 ms has passed without pointer movement exceeding 8 px.
   - In synthetic tests, real-time `setTimeout` causes flakiness and slow execution.
   - Therefore, the state machine must support an explicit `stepTime(time: number): readonly GestureIntent[]` method alongside an optional timer injection interface (`setTimeout`, `clearTimeout`, `now`) for browser event loops.

3. **State Transition Architecture**:
   - **`idle`**: 0 pointers down.
   - **`one_pointer_down`**: 1 pointer down, distance <= 8 px, elapsed time < 450 ms.
     - Moving > 8 px triggers transition to `one_pointer_dragging`, cancels long-press timer, and emits `oneFingerDragStart` + `oneFingerDragMove`.
     - 450 ms elapsed without moving > 8 px transitions to `one_pointer_long_press` and emits `longPress`.
     - Pointer release before 450 ms and <= 8 px transitions to `idle` and emits `tap`.
   - **`one_pointer_dragging`**: 1 pointer active and moving > 8 px.
     - Move events emit `oneFingerDragMove` with incremental `dx, dy`.
     - Pointer release emits `oneFingerDragEnd`.
     - Second pointer touch down (FEAT-MB2-04) immediately cancels the drag, emits `{ type: "cancel" }`, and transitions to `two_pointer_gesture` without emitting `oneFingerDragEnd`.
   - **`one_pointer_long_press`**: Long-press already triggered. Pointer release emits nothing (suppresses tap) and returns to `idle`.
   - **`two_pointer_gesture`**: 2 pointers down.
     - Tracks midpoint center `(x1+x2)/2, (y1+y2)/2` and spread distance `hypot(x1-x2, y1-y2)`.
     - Center translation emits `twoFingerPan { dx, dy }`.
     - Spread change emits `pinch { factor: prevSpread / curSpread, center }`.
     - Both pointers released within 300 ms with <= 8 px movement emit `multiFingerTap { fingers: 2 }`.
   - **`waiting_for_all_up` (Exhausted / Degraded State)**:
     - When lifting 1 finger from a 2-finger gesture, the remaining finger must NOT suddenly emit `tap` or start a 1-finger brush drag.
     - Entering `waiting_for_all_up` ignores movements and releases until all pointers are lifted (`pointers.size === 0`), safely returning to `idle`.

4. **FEAT-MB2-04 Second-Finger Stroke Abort**:
   - Observed in §1.2: `EditSession.cancelDrag()` invokes `Stroke.cancel()` which rolls back block changes and marks meshes dirty.
   - When a second pointer arrives while `dragActive === true`:
     1. Emit `{ type: "cancel" }`.
     2. Re-anchor `prevCenter` and `prevSpread` to the current positions of pointer 1 and pointer 2.
     3. Mark `abortedDrag = true` (preventing accidental 2-finger tap undo trigger).
     4. Subsequent movements immediately drive `twoFingerPan` and `pinch`, achieving a zero-latency, zero-jump switch to camera navigation.

---

## 3. Caveats

1. **Vite Test Include Glob**:
   - `apps/web/vite.config.ts` currently has `test: { name: "web", include: ["test/**/*.test.ts"] }`.
   - If the test file is placed strictly at `apps/web/src/lib/gestures.test.ts`, the worker must add `src/**/*.test.ts` to `include`, or provide a runner at `apps/web/test/gestures.test.ts`. Placing the unit tests in `apps/web/test/gestures.test.ts` or updating `vite.config.ts` ensures tests are executed by `pnpm test`.
2. **Pinch Factor Convention**:
   - In `OrbitController.zoom(factor)`, `factor < 1.0` zooms in (reduces distance to target).
   - The arbiter computes `factor = prevSpread / curSpread`. If a consumer prefers `curSpread / prevSpread` (scale factor), this is documented in §4.1.
3. **Simultaneous Pan & Pinch**:
   - When two fingers move on a mobile screen, human hands naturally both spread and translate slightly. The arbiter emits both `twoFingerPan` and `pinch` when both deltas occur. Consumers can execute both (e.g. pan camera and zoom camera in one frame).

---

## 4. Conclusion & Worker Implementation Blueprint

### 4.1 Exact Code Specification: `apps/web/src/lib/gestures.ts`

```typescript
// SPDX-License-Identifier: AGPL-3.0-only

export type GestureIntent =
  | { type: "tap"; clientX: number; clientY: number }
  | { type: "longPress"; clientX: number; clientY: number }
  | { type: "oneFingerDragStart"; clientX: number; clientY: number }
  | { type: "oneFingerDragMove"; clientX: number; clientY: number; dx: number; dy: number }
  | { type: "oneFingerDragEnd"; clientX: number; clientY: number }
  | { type: "twoFingerPan"; dx: number; dy: number }
  | { type: "pinch"; factor: number; center: { x: number; y: number } }
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

export interface GestureArbiterConfig {
  readonly tapSlopPx?: number; // default: 8
  readonly longPressMs?: number; // default: 450
  readonly multiTapMaxMs?: number; // default: 300
  readonly multiTapSlopPx?: number; // default: 12
  readonly onIntent?: (intent: GestureIntent) => void;
  readonly setTimeout?: (fn: () => void, ms: number) => any;
  readonly clearTimeout?: (id: any) => void;
  readonly now?: () => number;
}

export const DEFAULT_GESTURE_CONFIG = {
  tapSlopPx: 8,
  longPressMs: 450,
  multiTapMaxMs: 300,
  multiTapSlopPx: 12,
} as const;

interface ActivePointer {
  readonly startX: number;
  readonly startY: number;
  readonly startTime: number;
  curX: number;
  curY: number;
  lastX: number;
  lastY: number;
  maxDist: number;
}

type ArbiterState =
  | "idle"
  | "one_pointer_down"
  | "one_pointer_dragging"
  | "one_pointer_long_press"
  | "two_pointer_gesture"
  | "three_pointer_gesture"
  | "waiting_for_all_up";

export class GestureArbiter {
  private readonly config: Required<Omit<GestureArbiterConfig, "onIntent">> & {
    onIntent?: (intent: GestureIntent) => void;
  };
  private readonly pointers = new Map<number, ActivePointer>();
  private state: ArbiterState = "idle";
  private longPressTimer: any = null;
  private longPressCandidateId: number | null = null;
  private dragActive = false;
  private abortedDrag = false;
  private maxConcurrentPointers = 0;
  private multiTapStartTime = 0;
  private twoFingerPrevCenter: { x: number; y: number } | null = null;
  private twoFingerPrevSpread: number | null = null;

  constructor(config: GestureArbiterConfig = {}) {
    this.config = {
      tapSlopPx: config.tapSlopPx ?? DEFAULT_GESTURE_CONFIG.tapSlopPx,
      longPressMs: config.longPressMs ?? DEFAULT_GESTURE_CONFIG.longPressMs,
      multiTapMaxMs: config.multiTapMaxMs ?? DEFAULT_GESTURE_CONFIG.multiTapMaxMs,
      multiTapSlopPx: config.multiTapSlopPx ?? DEFAULT_GESTURE_CONFIG.multiTapSlopPx,
      onIntent: config.onIntent,
      setTimeout:
        config.setTimeout ??
        ((fn, ms) => (typeof setTimeout !== "undefined" ? setTimeout(fn, ms) : null)),
      clearTimeout:
        config.clearTimeout ??
        ((id) => (typeof clearTimeout !== "undefined" ? clearTimeout(id) : undefined)),
      now:
        config.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now())),
    };
  }

  public feed(sample: PointerSample): readonly GestureIntent[] {
    const intents: GestureIntent[] = [];

    switch (sample.type) {
      case "down": {
        this.pointers.set(sample.id, {
          startX: sample.x,
          startY: sample.y,
          startTime: sample.time,
          curX: sample.x,
          curY: sample.y,
          lastX: sample.x,
          lastY: sample.y,
          maxDist: 0,
        });
        this.maxConcurrentPointers = Math.max(this.maxConcurrentPointers, this.pointers.size);

        if (this.pointers.size === 1) {
          this.state = "one_pointer_down";
          this.dragActive = false;
          this.abortedDrag = false;
          this.longPressCandidateId = sample.id;
          this.scheduleLongPress(sample.id, sample.time);
        } else if (this.pointers.size === 2) {
          this.cancelLongPress();

          // FEAT-MB2-04: Second-finger stroke abort
          if (this.dragActive) {
            this.dragActive = false;
            this.abortedDrag = true;
            intents.push({ type: "cancel" });
          }

          this.state = "two_pointer_gesture";
          const [p1, p2] = [...this.pointers.values()];
          if (p1 && p2) {
            this.twoFingerPrevCenter = { x: (p1.curX + p2.curX) / 2, y: (p1.curY + p2.curY) / 2 };
            this.twoFingerPrevSpread = Math.max(
              Math.hypot(p1.curX - p2.curX, p1.curY - p2.curY),
              1,
            );
          }
          if (!this.abortedDrag) {
            this.multiTapStartTime = sample.time;
          }
        } else if (this.pointers.size === 3) {
          this.cancelLongPress();
          this.state = "three_pointer_gesture";
          this.twoFingerPrevCenter = null;
          this.twoFingerPrevSpread = null;
        } else {
          this.cancelLongPress();
          this.state = "waiting_for_all_up";
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
        } else if (this.state === "two_pointer_gesture") {
          const [p1, p2] = [...this.pointers.values()];
          if (p1 && p2) {
            const center = { x: (p1.curX + p2.curX) / 2, y: (p1.curY + p2.curY) / 2 };
            const spread = Math.max(Math.hypot(p1.curX - p2.curX, p1.curY - p2.curY), 1);

            if (this.twoFingerPrevCenter) {
              const dx = center.x - this.twoFingerPrevCenter.x;
              const dy = center.y - this.twoFingerPrevCenter.y;
              if (Math.abs(dx) >= 0.25 || Math.abs(dy) >= 0.25) {
                intents.push({ type: "twoFingerPan", dx, dy });
              }
            }

            if (this.twoFingerPrevSpread && this.twoFingerPrevSpread > 0) {
              const spreadDiff = Math.abs(spread - this.twoFingerPrevSpread);
              if (spreadDiff >= 0.5) {
                const factor = this.twoFingerPrevSpread / spread;
                intents.push({ type: "pinch", factor, center });
              }
            }

            this.twoFingerPrevCenter = center;
            this.twoFingerPrevSpread = spread;
          }
        }
        break;
      }

      case "up": {
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
          const isMultiTapEligible =
            !this.abortedDrag &&
            p.maxDist <= this.config.multiTapSlopPx &&
            sample.time - this.multiTapStartTime <= this.config.multiTapMaxMs;

          if (this.pointers.size === 0) {
            if (
              isMultiTapEligible &&
              (this.maxConcurrentPointers === 2 || this.maxConcurrentPointers === 3)
            ) {
              intents.push({
                type: "multiFingerTap",
                fingers: this.maxConcurrentPointers as 2 | 3,
              });
            }
            this.reset();
          } else {
            // One finger lifted: degrade to waiting state to avoid accidental drags/taps
            this.state = "waiting_for_all_up";
            this.twoFingerPrevCenter = null;
            this.twoFingerPrevSpread = null;
          }
        } else if (this.state === "waiting_for_all_up") {
          if (this.pointers.size === 0) {
            this.reset();
          }
        }
        break;
      }

      case "cancel": {
        this.cancelLongPress();
        this.pointers.delete(sample.id);
        if (this.dragActive) {
          this.dragActive = false;
          intents.push({ type: "cancel" });
        }
        if (this.pointers.size === 0) {
          this.reset();
        } else {
          this.state = "waiting_for_all_up";
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

  public stepTime(currentTime: number): readonly GestureIntent[] {
    const intents: GestureIntent[] = [];
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
    this.pointers.clear();
    this.state = "idle";
    this.dragActive = false;
    this.abortedDrag = false;
    this.maxConcurrentPointers = 0;
    this.twoFingerPrevCenter = null;
    this.twoFingerPrevSpread = null;
  }

  private scheduleLongPress(id: number, startTime: number): void {
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
  readonly timeStamp: number;
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
    time: e.timeStamp,
    pointerType: e.pointerType,
  };
}
```

### 4.2 Comprehensive Vitest Test Suite Blueprint: `apps/web/src/lib/gestures.test.ts` (or `apps/web/test/gestures.test.ts`)

The test suite must test synthetic event sequences synchronously using `stepTime`:

```typescript
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { GestureArbiter, type GestureIntent, type PointerSample } from "../src/lib/gestures.ts";

function createHarness() {
  const events: GestureIntent[] = [];
  const arbiter = new GestureArbiter({
    onIntent: (i) => events.push(i),
  });
  return { arbiter, events };
}

describe("GestureArbiter synthetic event tests", () => {
  describe("Tap gesture", () => {
    it("emits tap on clean short press and release", () => {
      const { arbiter } = createHarness();
      expect(arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 })).toEqual([]);
      expect(arbiter.feed({ id: 1, type: "up", x: 100, y: 100, time: 80 })).toEqual([
        { type: "tap", clientX: 100, clientY: 100 },
      ]);
    });

    it("emits tap with sub-threshold jitter (<8px)", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 1, type: "move", x: 104, y: 103, time: 50 }); // dist = 5px <= 8px
      expect(arbiter.feed({ id: 1, type: "up", x: 104, y: 103, time: 100 })).toEqual([
        { type: "tap", clientX: 104, clientY: 103 },
      ]);
    });

    it("does not emit tap if held longer than 450ms", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.stepTime(451);
      expect(arbiter.feed({ id: 1, type: "up", x: 100, y: 100, time: 500 })).toEqual([]);
    });
  });

  describe("Long-press gesture", () => {
    it("emits longPress after 450ms within 8px slop", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 200, y: 200, time: 0 });
      arbiter.feed({ id: 1, type: "move", x: 203, y: 202, time: 200 }); // dist ~3.6px
      expect(arbiter.stepTime(450)).toEqual([{ type: "longPress", clientX: 203, clientY: 202 }]);
      expect(arbiter.feed({ id: 1, type: "up", x: 203, y: 202, time: 600 })).toEqual([]);
    });

    it("cancels long-press timer if movement exceeds 8px before 450ms", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 1, type: "move", x: 110, y: 100, time: 100 }); // dist = 10px > 8px
      expect(arbiter.stepTime(450)).toEqual([]);
    });
  });

  describe("One-finger drag", () => {
    it("transitions from down to dragStart and dragMove when slop exceeded", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 50, y: 50, time: 0 });
      const moveIntents = arbiter.feed({ id: 1, type: "move", x: 65, y: 50, time: 50 });
      expect(moveIntents).toEqual([
        { type: "oneFingerDragStart", clientX: 50, clientY: 50 },
        { type: "oneFingerDragMove", clientX: 65, clientY: 50, dx: 15, dy: 0 },
      ]);
      const nextMove = arbiter.feed({ id: 1, type: "move", x: 75, y: 55, time: 80 });
      expect(nextMove).toEqual([
        { type: "oneFingerDragMove", clientX: 75, clientY: 55, dx: 10, dy: 5 },
      ]);
      const endIntents = arbiter.feed({ id: 1, type: "up", x: 75, y: 55, time: 120 });
      expect(endIntents).toEqual([{ type: "oneFingerDragEnd", clientX: 75, clientY: 55 }]);
    });
  });

  describe("FEAT-MB2-04: Second-finger stroke abort", () => {
    it("aborts active 1-finger drag immediately when 2nd finger touches down", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 1, type: "move", x: 120, y: 100, time: 50 }); // drag started

      // 2nd finger arrives
      const secondDown = arbiter.feed({ id: 2, type: "down", x: 220, y: 100, time: 80 });
      expect(secondDown).toEqual([{ type: "cancel" }]);

      // Pointers move in parallel -> pans camera, does NOT emit brush moves
      const panMove = arbiter.feed({ id: 1, type: "move", x: 130, y: 100, time: 100 });
      expect(panMove.some((i) => i.type === "twoFingerPan")).toBe(true);

      // Release does not emit oneFingerDragEnd
      const up1 = arbiter.feed({ id: 1, type: "up", x: 130, y: 100, time: 150 });
      expect(up1).toEqual([]);
      const up2 = arbiter.feed({ id: 2, type: "up", x: 220, y: 100, time: 160 });
      expect(up2).toEqual([]);
    });
  });

  describe("Two-finger pan and pinch", () => {
    it("pure parallel translation emits twoFingerPan without significant pinch", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 });

      // Move both by +20px in X
      arbiter.feed({ id: 1, type: "move", x: 120, y: 100, time: 30 });
      const intents = arbiter.feed({ id: 2, type: "move", x: 220, y: 100, time: 30 });

      const pans = intents.filter((i) => i.type === "twoFingerPan");
      expect(pans.length).toBeGreaterThan(0);
    });

    it("expanding fingers emits pinch with factor < 1.0 (zoom in)", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 }); // spread = 100

      // Spread to 200
      arbiter.feed({ id: 1, type: "move", x: 50, y: 100, time: 30 });
      const intents = arbiter.feed({ id: 2, type: "move", x: 250, y: 100, time: 30 });

      const pinch = intents.find((i) => i.type === "pinch") as Extract<
        GestureIntent,
        { type: "pinch" }
      >;
      expect(pinch).toBeDefined();
      expect(pinch.factor).toBeLessThan(1.0);
    });
  });

  describe("Degraded / multi-finger lift safety", () => {
    it("lifting 1 finger during 2-finger pan does not trigger 1-finger drag or tap", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 });
      arbiter.feed({ id: 1, type: "move", x: 150, y: 100, time: 30 });

      // Lift finger 1
      expect(arbiter.feed({ id: 1, type: "up", x: 150, y: 100, time: 50 })).toEqual([]);

      // Move finger 2 alone -> ignored
      expect(arbiter.feed({ id: 2, type: "move", x: 250, y: 100, time: 70 })).toEqual([]);

      // Lift finger 2 -> ignored
      expect(arbiter.feed({ id: 2, type: "up", x: 250, y: 100, time: 90 })).toEqual([]);
    });
  });

  describe("System cancellation", () => {
    it("emits cancel if pointercancel fires during active drag", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 1, type: "move", x: 150, y: 100, time: 30 }); // dragging
      expect(arbiter.feed({ id: 1, type: "cancel", x: 150, y: 100, time: 40 })).toEqual([
        { type: "cancel" },
      ]);
    });
  });
});
```

---

## 5. Verification Method

1. **Unit Test Execution**:
   - Run Vitest suite:

     ```bash
     pnpm test
     ```
   - Target the web project specifically:

     ```bash
     pnpm --filter @voxwright/web test
     ```
   - Target the new gesture suite:

     ```bash
     pnpm vitest run apps/web/src/lib/gestures.test.ts
     ```
   - Invalidation conditions: Any test failure in `gestures.test.ts` or regressions across existing 49 test suites (786 passing tests).
2. **Typecheck**:
   - Run workspace typecheck:

     ```bash
     pnpm typecheck
     ```
   - Invalidation condition: Any TypeScript compiler error or missing property on `GestureIntent`.
3. **Module Layout Inspection**:
   - Verify `apps/web/src/lib/gestures.ts` has zero DOM imports (`window`, `document`, `HTMLElement`).
   - Verify all exports match `PROJECT.md` interface specifications.
