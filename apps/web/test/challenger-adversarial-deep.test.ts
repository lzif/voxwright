// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { GestureArbiter, type GestureIntent } from "../src/lib/gestures.ts";

describe("Milestone MB2 Challenger Adversarial Deep Stress", () => {
  function createHarness(config = {}) {
    const intents: GestureIntent[] = [];
    const arbiter = new GestureArbiter({
      onIntent: (i) => intents.push(i),
      ...config,
    });
    return { arbiter, intents };
  }

  describe("1. Pointer Cancellation & Aborted Interaction Invariants", () => {
    it("cancellation of pointer 1 during two-finger touch prevents spurious multiFingerTap", () => {
      const { arbiter } = createHarness();
      // Pointer 1 & 2 touch down
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 });

      // Pointer 1 cancelled by OS (e.g. palm contact rejection)
      const cancelIntents = arbiter.feed({ id: 1, type: "cancel", x: 100, y: 100, time: 20 });
      expect(cancelIntents).toEqual([]);

      // Pointer 2 lifts cleanly within tap timeout
      const upIntents = arbiter.feed({ id: 2, type: "up", x: 200, y: 100, time: 40 });

      // Invariant: cancellation rejects multiFingerTap when companion finger lifts
      const emittedMultiTap = upIntents.some((i) => i.type === "multiFingerTap");
      expect(emittedMultiTap).toBe(false);
    });

    it("cancellation of pointer 1 during three-finger touch prevents spurious 3-finger multiFingerTap", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 });
      arbiter.feed({ id: 3, type: "down", x: 300, y: 100, time: 20 });

      // Pointer 1 cancelled
      arbiter.feed({ id: 1, type: "cancel", x: 100, y: 100, time: 30 });

      // Pointers 2 and 3 lift
      arbiter.feed({ id: 2, type: "up", x: 200, y: 100, time: 40 });
      const lastUp = arbiter.feed({ id: 3, type: "up", x: 300, y: 100, time: 50 });

      // Invariant: no spurious 3-finger tap on cancel
      expect(lastUp).toEqual([]);
    });

    it("mid-pinch cancellation of pointer 1 transitions cleanly to waiting state without leftover drags", () => {
      const { arbiter, intents } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 300, y: 100, time: 0 });

      // Active pinch (>12px spread change)
      arbiter.feed({ id: 1, type: "move", x: 80, y: 100, time: 20 });
      arbiter.feed({ id: 2, type: "move", x: 320, y: 100, time: 20 });
      expect(intents.some((i) => i.type === "pinch")).toBe(true);

      // Pointer 1 cancelled
      const cancelRes = arbiter.feed({ id: 1, type: "cancel", x: 80, y: 100, time: 30 });
      expect(cancelRes).toEqual([]);

      // Pointer 2 continues moving significantly
      const p2Moves = arbiter.feed({ id: 2, type: "move", x: 400, y: 200, time: 40 });
      expect(p2Moves).toEqual([]);
      expect(intents.some((i) => i.type === "oneFingerDragMove")).toBe(false);

      // Pointer 2 lifts
      arbiter.feed({ id: 2, type: "up", x: 400, y: 200, time: 50 });

      // State is completely reset; subsequent single tap works
      arbiter.feed({ id: 10, type: "down", x: 50, y: 50, time: 100 });
      const tapRes = arbiter.feed({ id: 10, type: "up", x: 50, y: 50, time: 150 });
      expect(tapRes).toEqual([{ type: "tap", clientX: 50, clientY: 50 }]);
    });

    it("mid-pinch cancellation of pointer 2 (secondary) transitions cleanly without leftover drags", () => {
      const { arbiter, intents } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 300, y: 100, time: 0 });

      // Active pinch
      arbiter.feed({ id: 1, type: "move", x: 80, y: 100, time: 20 });
      arbiter.feed({ id: 2, type: "move", x: 320, y: 100, time: 20 });

      // Pointer 2 cancelled
      arbiter.feed({ id: 2, type: "cancel", x: 320, y: 100, time: 30 });

      // Pointer 1 continues moving significantly
      const p1Moves = arbiter.feed({ id: 1, type: "move", x: 50, y: 150, time: 40 });
      expect(p1Moves).toEqual([]);
      expect(intents.some((i) => i.type === "oneFingerDragMove")).toBe(false);

      // Pointer 1 lifts
      arbiter.feed({ id: 1, type: "up", x: 50, y: 150, time: 50 });

      // Clean recovery
      arbiter.feed({ id: 5, type: "down", x: 20, y: 20, time: 100 });
      expect(arbiter.feed({ id: 5, type: "up", x: 20, y: 20, time: 120 })).toEqual([
        { type: "tap", clientX: 20, clientY: 20 },
      ]);
    });
  });

  describe("2. Rapid Interleaved Pointer Events & Timestamp Coalescing", () => {
    it("coalesces synchronized pointermove events with identical timestamps into pure parallel pan", () => {
      const { arbiter, intents } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 0 });

      // Both fingers move +20px in parallel with matching timestamps (standard browser touch packet)
      arbiter.feed({ id: 1, type: "move", x: 120, y: 100, time: 16 });
      arbiter.feed({ id: 2, type: "move", x: 220, y: 100, time: 16 });

      arbiter.feed({ id: 1, type: "move", x: 140, y: 100, time: 32 });
      arbiter.feed({ id: 2, type: "move", x: 240, y: 100, time: 32 });

      expect(intents.filter((i) => i.type === "twoFingerPan").length).toBe(2);
      expect(intents.filter((i) => i.type === "pinch").length).toBe(0);
    });

    it("evaluates single-finger movements across distinct frames with mathematical reversibility", () => {
      const { arbiter, intents } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 0 });

      // Step 1: Pointer 1 moves 10px closer in frame 1 (t=10)
      arbiter.feed({ id: 1, type: "move", x: 110, y: 100, time: 10 });
      // Step 2: Pointer 2 moves 10px further in frame 2 (t=20)
      arbiter.feed({ id: 2, type: "move", x: 210, y: 100, time: 20 });

      arbiter.flush();

      const pinchIntents = intents.filter((i) => i.type === "pinch") as {
        type: "pinch";
        factor: number;
      }[];
      expect(pinchIntents.length).toBe(2);

      const p0 = pinchIntents[0];
      const p1 = pinchIntents[1];
      if (p0 && p1) {
        // Cumulative zoom product across the two serialized steps must equal 1.0 (zero net zoom)
        const netZoomFactor = p0.factor * p1.factor;
        expect(Math.abs(netZoomFactor - 1.0)).toBeLessThan(1e-5);
      }
    });

    it("handles rapid single-finger jitter in two-finger state without crashing or leaking timers", () => {
      let activeTimers = 0;
      const fakeSetTimeout = (_fn: () => void, _ms: number) => {
        activeTimers++;
        return activeTimers;
      };
      const fakeClearTimeout = () => {
        if (activeTimers > 0) activeTimers--;
      };

      const { arbiter } = createHarness({
        setTimeout: fakeSetTimeout,
        clearTimeout: fakeClearTimeout,
      });

      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 0 });

      // 100 rapid micro-moves for pointer 1 with stationary pointer 2
      for (let i = 0; i < 100; i++) {
        arbiter.feed({
          id: 1,
          type: "move",
          x: 100 + (i % 2 === 0 ? 0.05 : -0.05),
          y: 100,
          time: i * 5,
        });
      }

      // Lift both pointers
      arbiter.feed({ id: 1, type: "up", x: 100, y: 100, time: 600 });
      arbiter.feed({ id: 2, type: "up", x: 200, y: 100, time: 610 });

      // Active timers should be cleared after all pointers lift
      expect(activeTimers).toBe(0);
    });
  });

  describe("3. Pointer ID Recycling, Out-of-Order Releases, and Collisions", () => {
    it("handles fast pointer ID recycling (ID reused across successive gestures)", () => {
      const { arbiter, intents } = createHarness();

      for (let cycle = 0; cycle < 50; cycle++) {
        intents.length = 0;
        const baseTime = cycle * 1000;
        // Pointer 1 down and up (tap)
        arbiter.feed({ id: 1, type: "down", x: 50, y: 50, time: baseTime });
        arbiter.feed({ id: 1, type: "up", x: 50, y: 50, time: baseTime + 50 });
        expect(intents).toEqual([{ type: "tap", clientX: 50, clientY: 50 }]);

        // Re-use ID 1 immediately for 2-finger gesture with ID 2
        intents.length = 0;
        arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: baseTime + 100 });
        arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: baseTime + 110 });
        arbiter.feed({ id: 1, type: "move", x: 120, y: 100, time: baseTime + 150 });
        arbiter.feed({ id: 2, type: "move", x: 220, y: 100, time: baseTime + 150 });

        arbiter.feed({ id: 2, type: "up", x: 220, y: 100, time: baseTime + 200 });
        arbiter.feed({ id: 1, type: "up", x: 120, y: 100, time: baseTime + 210 });
      }
    });

    it("handles identical coordinates for two fingers without division by zero or NaN factor", () => {
      const { arbiter, intents } = createHarness();
      // Fingers placed at the exact same pixel
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 100, y: 100, time: 0 });

      // Move one finger away
      arbiter.feed({ id: 1, type: "move", x: 100, y: 100, time: 16 });
      arbiter.feed({ id: 2, type: "move", x: 200, y: 100, time: 16 });

      const pinch = intents.find((i) => i.type === "pinch");
      if (pinch && pinch.type === "pinch") {
        expect(Number.isFinite(pinch.factor)).toBe(true);
        expect(Number.isNaN(pinch.factor)).toBe(false);
      }
    });
  });

  describe("4. High-Entropy Fuzzing & Invariant Preservation", () => {
    it("preserves state invariants under 5,000 randomized state transitions", () => {
      const { arbiter } = createHarness();
      const pointerPool = [-1, 0, 1, 2, 3, 50, 9999];
      const activePointers = new Set<number>();
      let clock = 100;

      for (let i = 0; i < 5000; i++) {
        clock += Math.floor(Math.random() * 15);
        const randId = pointerPool[Math.floor(Math.random() * pointerPool.length)];
        const id = randId !== undefined ? randId : 1;
        const x = 100 + Math.random() * 300;
        const y = 100 + Math.random() * 300;

        if (!activePointers.has(id)) {
          activePointers.add(id);
          arbiter.feed({ id, type: "down", x, y, time: clock });
        } else {
          const action = Math.random();
          if (action < 0.6) {
            arbiter.feed({ id, type: "move", x, y, time: clock });
          } else if (action < 0.85) {
            activePointers.delete(id);
            arbiter.feed({ id, type: "up", x, y, time: clock });
          } else {
            activePointers.delete(id);
            arbiter.feed({ id, type: "cancel", x, y, time: clock });
          }
        }

        if (i % 25 === 0) {
          arbiter.stepTime(clock);
          arbiter.flush();
        }
      }

      // Cleanup
      for (const id of activePointers) {
        clock += 5;
        arbiter.feed({ id, type: "up", x: 200, y: 200, time: clock });
      }

      // Guarantee clean recovery
      const res1 = arbiter.feed({ id: 77, type: "down", x: 50, y: 50, time: clock + 100 });
      expect(res1).toEqual([]);
      const res2 = arbiter.feed({ id: 77, type: "up", x: 50, y: 50, time: clock + 150 });
      expect(res2).toEqual([{ type: "tap", clientX: 50, clientY: 50 }]);
    });
  });
});
