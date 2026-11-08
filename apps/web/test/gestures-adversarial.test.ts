// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  GestureArbiter,
  type GestureIntent,
  type PointerSample,
  pointerEventToSample,
} from "../src/lib/gestures.ts";

function createHarness() {
  const events: GestureIntent[] = [];
  const arbiter = new GestureArbiter({
    onIntent: (i) => events.push(i),
  });
  return { arbiter, events };
}

describe("GestureArbiter Adversarial Stress Testing", () => {
  describe("1. Out-of-order, non-contiguous, and strange pointer IDs", () => {
    it("handles negative and non-sequential pointer IDs gracefully", () => {
      const { arbiter } = createHarness();
      // ID -10 down
      expect(arbiter.feed({ id: -10, type: "down", x: 100, y: 100, time: 100 })).toEqual([]);
      // ID 999999 down
      expect(arbiter.feed({ id: 999999, type: "down", x: 200, y: 100, time: 110 })).toEqual([]);
      // ID 0 down (3 pointers)
      expect(arbiter.feed({ id: 0, type: "down", x: 300, y: 100, time: 120 })).toEqual([]);

      // Lifting in reverse order: 0 up, -10 up, 999999 up
      expect(arbiter.feed({ id: 0, type: "up", x: 300, y: 100, time: 150 })).toEqual([]);
      expect(arbiter.feed({ id: -10, type: "up", x: 100, y: 100, time: 160 })).toEqual([]);
      const lastUp = arbiter.feed({ id: 999999, type: "up", x: 200, y: 100, time: 170 });
      expect(lastUp).toEqual([{ type: "multiFingerTap", fingers: 3 }]);

      // Verify arbiter is cleanly idle now
      expect(arbiter.feed({ id: 42, type: "down", x: 50, y: 50, time: 200 })).toEqual([]);
      expect(arbiter.feed({ id: 42, type: "up", x: 50, y: 50, time: 250 })).toEqual([
        { type: "tap", clientX: 50, clientY: 50 },
      ]);
    });

    it("handles interleaved arrivals where secondary pointer arrives before primary finishes", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 10, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 20, type: "down", x: 200, y: 100, time: 10 });
      // Pointer 10 moves
      arbiter.feed({ id: 10, type: "move", x: 120, y: 100, time: 20 });
      // Pointer 30 arrives
      arbiter.feed({ id: 30, type: "down", x: 300, y: 100, time: 30 });
      // Pointer 20 drops (up)
      arbiter.feed({ id: 20, type: "up", x: 200, y: 100, time: 40 });
      // Pointer 10 moves while in degraded state (must be ignored, no crash)
      const move2 = arbiter.feed({ id: 10, type: "move", x: 140, y: 100, time: 50 });
      expect(move2).toEqual([]);
      // All remaining lift
      arbiter.feed({ id: 10, type: "up", x: 140, y: 100, time: 60 });
      arbiter.feed({ id: 30, type: "up", x: 300, y: 100, time: 70 });

      // Clean recovery check
      const postRecovery = arbiter.feed({ id: 1, type: "down", x: 10, y: 10, time: 100 });
      expect(postRecovery).toEqual([]);
      const tap = arbiter.feed({ id: 1, type: "up", x: 10, y: 10, time: 150 });
      expect(tap).toEqual([{ type: "tap", clientX: 10, clientY: 10 }]);
    });
  });

  describe("2. Sudden pointer drops, missing events, and spurious events", () => {
    it("handles spurious pointerup for an unknown pointer without throwing or desyncing", () => {
      const { arbiter } = createHarness();
      // Up before any down
      expect(arbiter.feed({ id: 404, type: "up", x: 100, y: 100, time: 10 })).toEqual([]);

      // Down 1, spurious up for 2
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 20 });
      expect(arbiter.feed({ id: 2, type: "up", x: 200, y: 200, time: 30 })).toEqual([]);

      // Real up for 1 still yields tap
      expect(arbiter.feed({ id: 1, type: "up", x: 100, y: 100, time: 50 })).toEqual([
        { type: "tap", clientX: 100, clientY: 100 },
      ]);
    });

    it("handles spurious pointermove for an unknown pointer safely", () => {
      const { arbiter } = createHarness();
      expect(arbiter.feed({ id: 999, type: "move", x: 500, y: 500, time: 10 })).toEqual([]);
    });

    it("handles sudden pointercancel when dragging single pointer", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 1, type: "move", x: 120, y: 100, time: 50 }); // drag started

      const cancelIntents = arbiter.feed({ id: 1, type: "cancel", x: 120, y: 100, time: 60 });
      expect(cancelIntents).toEqual([{ type: "cancel" }]);

      // Following up event should be ignored
      expect(arbiter.feed({ id: 1, type: "up", x: 120, y: 100, time: 70 })).toEqual([]);

      // Next gesture behaves normally
      arbiter.feed({ id: 2, type: "down", x: 50, y: 50, time: 100 });
      expect(arbiter.feed({ id: 2, type: "up", x: 50, y: 50, time: 150 })).toEqual([
        { type: "tap", clientX: 50, clientY: 50 },
      ]);
    });

    it("handles pointercancel on unknown ID while another pointer is down", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });

      // Spurious cancel for ID 888
      arbiter.feed({ id: 888, type: "cancel", x: 0, y: 0, time: 20 });

      // ID 1 lifts; the spurious cancel placed the state into waiting_for_all_up (it was never a
      // multi-finger gesture, so no leftover orbit), and it resets on lift
      arbiter.feed({ id: 1, type: "up", x: 100, y: 100, time: 50 });

      // Arbiter is fully recovered
      arbiter.feed({ id: 2, type: "down", x: 10, y: 10, time: 100 });
      expect(arbiter.feed({ id: 2, type: "up", x: 10, y: 10, time: 150 })).toEqual([
        { type: "tap", clientX: 10, clientY: 10 },
      ]);
    });

    it("handles double-down for the same pointer ID without crashing", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      // Duplicate down without up (e.g. dropped up event from OS)
      expect(() => {
        arbiter.feed({ id: 1, type: "down", x: 150, y: 150, time: 50 });
      }).not.toThrow();

      // Lifting clears state cleanly
      arbiter.feed({ id: 1, type: "up", x: 150, y: 150, time: 80 });
      expect(arbiter.feed({ id: 1, type: "down", x: 10, y: 10, time: 100 })).toEqual([]);
      expect(arbiter.feed({ id: 1, type: "up", x: 10, y: 10, time: 120 })).toEqual([
        { type: "tap", clientX: 10, clientY: 10 },
      ]);
    });
  });

  describe("3. Negative timestamps, non-monotonic time, and extreme clock jumps", () => {
    it("handles negative timestamps without throwing or getting stuck", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: -500 });
      arbiter.feed({ id: 1, type: "move", x: 102, y: 102, time: -450 });
      const up = arbiter.feed({ id: 1, type: "up", x: 102, y: 102, time: -400 });
      // (-400 - (-500)) = 100ms < 450ms, dist < 8px -> tap
      expect(up).toEqual([{ type: "tap", clientX: 102, clientY: 102 }]);
    });

    it("handles backwards-running timestamps without throwing or emitting invalid gestures", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 1000 });
      arbiter.feed({ id: 1, type: "move", x: 120, y: 100, time: 900 }); // time moved backwards
      const up = arbiter.feed({ id: 1, type: "up", x: 120, y: 100, time: 800 });
      expect(up).toEqual([{ type: "oneFingerDragEnd", clientX: 120, clientY: 100 }]);
    });

    it("handles gigantic timestamp jumps (e.g. waking up from hibernation)", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 100 });
      // 24 hours later
      const up = arbiter.feed({ id: 1, type: "up", x: 100, y: 100, time: 100 + 86400000 });
      // Held > 450ms, so tap is suppressed
      expect(up).toEqual([]);
    });

    it("pointerEventToSample sanitizes non-positive, zero, and missing timeStamps", () => {
      const sample1 = pointerEventToSample({
        pointerId: 1,
        type: "pointerdown",
        clientX: 10,
        clientY: 20,
        timeStamp: 0,
      });
      expect(sample1.time).toBeGreaterThan(0);

      const sample2 = pointerEventToSample({
        pointerId: 1,
        type: "pointerdown",
        clientX: 10,
        clientY: 20,
        timeStamp: -100,
      });
      expect(sample2.time).toBeGreaterThan(0);
    });
  });

  describe("4. Second-finger arrival during tool drag (FEAT-MB2-04 Stress Matrix)", () => {
    it("cancels tool drag and immediately transitions to 2-finger pan", () => {
      const { arbiter } = createHarness();
      // Pointer 1 starts dragging
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 1, type: "move", x: 120, y: 100, time: 50 });

      // Pointer 2 touches down
      const secondDown = arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 80 });
      expect(secondDown).toEqual([{ type: "cancel" }]);

      // Pointer 1 and 2 move together
      arbiter.feed({ id: 1, type: "move", x: 140, y: 100, time: 100 });
      const move2 = arbiter.feed({ id: 2, type: "move", x: 220, y: 100, time: 100 });
      expect(move2.some((i) => i.type === "twoFingerPan")).toBe(true);
      expect(move2.some((i) => i.type === "oneFingerDragMove")).toBe(false);

      // Release pointer 1 first, then pointer 2
      expect(arbiter.feed({ id: 1, type: "up", x: 140, y: 100, time: 120 })).toEqual([]);
      // Pointer 2 continues to move alone: it orbits, from where it was when pointer 1 lifted
      expect(arbiter.feed({ id: 2, type: "move", x: 250, y: 100, time: 130 })).toEqual([
        { type: "oneFingerDragStart", clientX: 220, clientY: 100 },
        { type: "oneFingerDragMove", clientX: 250, clientY: 100, dx: 30, dy: 0 },
      ]);
      // Pointer 2 lifts: the drag ends, no tap
      expect(arbiter.feed({ id: 2, type: "up", x: 250, y: 100, time: 140 })).toEqual([
        { type: "oneFingerDragEnd", clientX: 250, clientY: 100 },
      ]);

      // Next gesture works cleanly
      arbiter.feed({ id: 3, type: "down", x: 50, y: 50, time: 200 });
      expect(arbiter.feed({ id: 3, type: "up", x: 50, y: 50, time: 220 })).toEqual([
        { type: "tap", clientX: 50, clientY: 50 },
      ]);
    });

    it("second finger touches down and immediately lifts without move — does NOT emit multiFingerTap", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 1, type: "move", x: 125, y: 100, time: 50 }); // drag active

      // Second finger touches down -> cancel emitted
      expect(arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 60 })).toEqual([
        { type: "cancel" },
      ]);

      // Second finger lifts quickly (< 100ms)
      expect(arbiter.feed({ id: 2, type: "up", x: 200, y: 100, time: 80 })).toEqual([]);
      // First finger lifts quickly
      expect(arbiter.feed({ id: 1, type: "up", x: 125, y: 100, time: 90 })).toEqual([]);
      // Invariant: abortedDrag must suppress multiFingerTap!
    });

    it("handles third finger touching down during active 2-finger pan", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 });
      arbiter.feed({ id: 1, type: "move", x: 110, y: 100, time: 30 });
      arbiter.feed({ id: 2, type: "move", x: 210, y: 100, time: 30 });

      // 3rd finger arrives
      arbiter.feed({ id: 3, type: "down", x: 300, y: 100, time: 50 });
      // Moves during 3-finger mode
      expect(arbiter.feed({ id: 1, type: "move", x: 120, y: 100, time: 70 })).toEqual([]);

      // 4th finger arrives (overflow)
      arbiter.feed({ id: 4, type: "down", x: 400, y: 100, time: 90 });

      // All 4 fingers lift in arbitrary order
      arbiter.feed({ id: 3, type: "up", x: 300, y: 100, time: 110 });
      arbiter.feed({ id: 1, type: "up", x: 120, y: 100, time: 120 });
      arbiter.feed({ id: 4, type: "up", x: 400, y: 100, time: 130 });
      expect(arbiter.feed({ id: 2, type: "up", x: 210, y: 100, time: 140 })).toEqual([]);

      // Check clean recovery
      arbiter.feed({ id: 5, type: "down", x: 100, y: 100, time: 200 });
      expect(arbiter.feed({ id: 5, type: "up", x: 100, y: 100, time: 250 })).toEqual([
        { type: "tap", clientX: 100, clientY: 100 },
      ]);
    });
  });

  describe("5. Chaotic multi-touch thrashing (Fuzz stress test)", () => {
    it("survives 5,000 chaotic randomized pointer events without crashes, leaks, or stuck states", () => {
      const arbiter = new GestureArbiter();
      // Pseudo-random number generator with deterministic seed
      let seed = 42;
      function rand() {
        seed = (seed * 16807 + 0) % 2147483647;
        return (seed - 1) / 2147483646;
      }

      const activePointers = new Set<number>();
      let clock = 1000;

      for (let cycle = 0; cycle < 500; cycle++) {
        const batchSize = Math.floor(rand() * 10) + 1;
        for (let b = 0; b < batchSize; b++) {
          clock += Math.floor(rand() * 40) - 5; // allow occasional time jitters
          const r = rand();

          if (r < 0.35 || activePointers.size === 0) {
            // Pointer Down
            const id = Math.floor(rand() * 8); // IDs 0..7
            activePointers.add(id);
            const sample: PointerSample = {
              id,
              type: "down",
              x: Math.round(rand() * 800 - 100),
              y: Math.round(rand() * 1200 - 100),
              time: clock,
            };
            expect(() => arbiter.feed(sample)).not.toThrow();
          } else if (r < 0.7) {
            // Pointer Move
            const ids = [...activePointers];
            const id = ids[Math.floor(rand() * ids.length)] ?? 0;
            const sample: PointerSample = {
              id,
              type: "move",
              x: Math.round(rand() * 800),
              y: Math.round(rand() * 1200),
              time: clock,
            };
            expect(() => arbiter.feed(sample)).not.toThrow();
          } else if (r < 0.9) {
            // Pointer Up
            const ids = [...activePointers];
            const id = ids[Math.floor(rand() * ids.length)] ?? 0;
            activePointers.delete(id);
            const sample: PointerSample = {
              id,
              type: "up",
              x: Math.round(rand() * 800),
              y: Math.round(rand() * 1200),
              time: clock,
            };
            expect(() => arbiter.feed(sample)).not.toThrow();
          } else {
            // Pointer Cancel
            const ids = [...activePointers];
            const id = ids[Math.floor(rand() * ids.length)] ?? 0;
            activePointers.delete(id);
            const sample: PointerSample = {
              id,
              type: "cancel",
              x: Math.round(rand() * 800),
              y: Math.round(rand() * 1200),
              time: clock,
            };
            expect(() => arbiter.feed(sample)).not.toThrow();
          }

          if (rand() < 0.1) {
            expect(() => arbiter.stepTime(clock)).not.toThrow();
          }
        }

        // Periodically flush all remaining active pointers to test recovery
        if (cycle % 25 === 0) {
          for (const id of activePointers) {
            arbiter.feed({ id, type: "up", x: 100, y: 100, time: clock });
          }
          activePointers.clear();

          // Verify clean recovery
          clock += 100;
          arbiter.feed({ id: 99, type: "down", x: 200, y: 200, time: clock });
          clock += 50;
          const recoveryTap = arbiter.feed({ id: 99, type: "up", x: 200, y: 200, time: clock });
          expect(recoveryTap).toEqual([{ type: "tap", clientX: 200, clientY: 200 }]);
        }
      }

      // Final flush
      for (const id of activePointers) {
        arbiter.feed({ id, type: "up", x: 100, y: 100, time: clock });
      }
      activePointers.clear();
      arbiter.reset();

      // Final assertion: fresh tap works
      arbiter.feed({ id: 1, type: "down", x: 300, y: 300, time: clock });
      const finalTap = arbiter.feed({ id: 1, type: "up", x: 300, y: 300, time: clock + 50 });
      expect(finalTap).toEqual([{ type: "tap", clientX: 300, clientY: 300 }]);
    });
  });

  describe("6. Edge math and zero-spread pinch", () => {
    it("handles two pointers at identical coordinates without divide-by-zero or NaN pinch factors", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 100, y: 100, time: 10 }); // spread = 0

      // Move both still at identical coordinates
      const intents = arbiter.feed({ id: 2, type: "move", x: 100, y: 100, time: 30 });
      for (const i of intents) {
        if (i.type === "pinch") {
          expect(Number.isFinite(i.factor)).toBe(true);
          expect(Number.isNaN(i.factor)).toBe(false);
        }
      }

      // Now separate them: spread expands from 0 to 100
      arbiter.feed({ id: 1, type: "move", x: 50, y: 100, time: 50 });
      const expandIntents = arbiter.feed({ id: 2, type: "move", x: 150, y: 100, time: 50 });
      const pinch = expandIntents.find((i) => i.type === "pinch") as Extract<
        GestureIntent,
        { type: "pinch" }
      >;
      expect(pinch).toBeDefined();
      expect(Number.isFinite(pinch.factor)).toBe(true);
      expect(pinch.factor).toBeLessThan(1.0);
    });

    it("handles subpixel floating-point jitter safely", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100.12345, y: 200.6789, time: 0 });
      arbiter.feed({ id: 1, type: "move", x: 100.22345, y: 200.7789, time: 50 });
      const up = arbiter.feed({ id: 1, type: "up", x: 100.22345, y: 200.7789, time: 80 });
      expect(up).toEqual([{ type: "tap", clientX: 100.22345, clientY: 200.7789 }]);
    });
  });

  describe("7. Rapid contact fluttering and alternating touch thrashing", () => {
    it("handles rapid finger lift and re-touch while other finger is still held down", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 });

      // Finger 1 lifts -> finger 2 is the leftover finger
      arbiter.feed({ id: 1, type: "up", x: 100, y: 100, time: 30 });

      // Finger 1 touches down AGAIN while finger 2 is still held down!
      arbiter.feed({ id: 1, type: "down", x: 105, y: 105, time: 40 });

      // Finger 2 lifts -> finger 1 (landed again) is the leftover finger
      arbiter.feed({ id: 2, type: "up", x: 200, y: 100, time: 50 });

      // Finger 1 moves -> it orbits from where it was when finger 2 lifted
      expect(arbiter.feed({ id: 1, type: "move", x: 150, y: 105, time: 60 })).toEqual([
        { type: "oneFingerDragStart", clientX: 105, clientY: 105 },
        { type: "oneFingerDragMove", clientX: 150, clientY: 105, dx: 45, dy: 0 },
      ]);

      // Finger 1 lifts -> the drag ends and all pointers are lifted, back to idle
      expect(arbiter.feed({ id: 1, type: "up", x: 150, y: 105, time: 70 })).toEqual([
        { type: "oneFingerDragEnd", clientX: 150, clientY: 105 },
      ]);

      // Subsequent tap succeeds cleanly
      arbiter.feed({ id: 3, type: "down", x: 50, y: 50, time: 100 });
      expect(arbiter.feed({ id: 3, type: "up", x: 50, y: 50, time: 150 })).toEqual([
        { type: "tap", clientX: 50, clientY: 50 },
      ]);
    });

    it("handles consecutive duplicate cancel events safely", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 1, type: "cancel", x: 100, y: 100, time: 20 });
      // Second cancel for same pointer
      expect(() => {
        arbiter.feed({ id: 1, type: "cancel", x: 100, y: 100, time: 30 });
      }).not.toThrow();
      expect(arbiter.feed({ id: 2, type: "down", x: 50, y: 50, time: 50 })).toEqual([]);
      expect(arbiter.feed({ id: 2, type: "up", x: 50, y: 50, time: 80 })).toEqual([
        { type: "tap", clientX: 50, clientY: 50 },
      ]);
    });
  });

  describe("8. Long-press timer race conditions", () => {
    it("does not emit longPress if pointer lifts before stepTime fires", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 1, type: "up", x: 100, y: 100, time: 200 }); // lifted at 200ms

      // Timer fires late at 450ms
      expect(arbiter.stepTime(450)).toEqual([]);
    });

    it("does not emit longPress if second pointer arrives before 450ms", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 200 });

      // Timer fires at 450ms
      expect(arbiter.stepTime(450)).toEqual([]);
    });

    it("does not emit multiple longPress intents on repeated stepTime calls", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      expect(arbiter.stepTime(450)).toEqual([{ type: "longPress", clientX: 100, clientY: 100 }]);

      // Repeated stepTime calls must not re-emit
      expect(arbiter.stepTime(460)).toEqual([]);
      expect(arbiter.stepTime(1000)).toEqual([]);
    });
  });

  describe("9. Explicit reset() lifecycle safety", () => {
    it("clears active drag immediately on reset() without residual events", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 1, type: "move", x: 120, y: 100, time: 50 }); // drag started

      arbiter.reset();

      // Subsequent move for old pointer is ignored
      expect(arbiter.feed({ id: 1, type: "move", x: 150, y: 100, time: 70 })).toEqual([]);
      // Subsequent up for old pointer is ignored
      expect(arbiter.feed({ id: 1, type: "up", x: 150, y: 100, time: 80 })).toEqual([]);

      // Fresh pointer works immediately
      arbiter.feed({ id: 2, type: "down", x: 10, y: 10, time: 100 });
      expect(arbiter.feed({ id: 2, type: "up", x: 10, y: 10, time: 130 })).toEqual([
        { type: "tap", clientX: 10, clientY: 10 },
      ]);
    });
  });

  describe("10. Parallel pan and pinch decoupling", () => {
    it("prevents spurious pinch intents when pointers in parallel pan update sequentially", () => {
      const { arbiter, events } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 180, y: 100, time: 0 }); // spread = 80

      // Step 1: Pointer 1 moves by +10px along X
      const p1Intents = arbiter.feed({ id: 1, type: "move", x: 110, y: 100, time: 16 });
      const p1Pinch = p1Intents.find((i) => i.type === "pinch");
      expect(p1Pinch).toBeUndefined();

      // Step 1 cont: Pointer 2 moves by +10px along X
      const p2Intents = arbiter.feed({ id: 2, type: "move", x: 190, y: 100, time: 16 });
      const p2Pinch = p2Intents.find((i) => i.type === "pinch");
      expect(p2Pinch).toBeUndefined();

      // Verified no spurious pinches were emitted across the entire parallel pan
      const allPinches = events.filter((i) => i.type === "pinch");
      expect(allPinches).toHaveLength(0);

      // Verified pure parallel pan intent was emitted with exact delta (+10, 0)
      const pans = p2Intents.filter((i) => i.type === "twoFingerPan");
      expect(pans).toHaveLength(1);
      expect(pans[0]).toEqual({ type: "twoFingerPan", dx: 10, dy: 0 });
    });
  });
});
