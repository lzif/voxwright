// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { GestureArbiter, type GestureIntent, pointerEventToSample } from "../src/lib/gestures.ts";

function createHarness() {
  const events: GestureIntent[] = [];
  const arbiter = new GestureArbiter({
    onIntent: (i) => events.push(i),
  });
  return { arbiter, events };
}

describe("GestureArbiter", () => {
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

    it("does not emit tap if moved more than 8px", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 1, type: "move", x: 110, y: 100, time: 50 }); // dist = 10px > 8px
      const upEvents = arbiter.feed({ id: 1, type: "up", x: 110, y: 100, time: 80 });
      expect(upEvents.some((e) => e.type === "tap")).toBe(false);
      expect(upEvents).toEqual([{ type: "oneFingerDragEnd", clientX: 110, clientY: 100 }]);
    });
  });

  describe("Long-press gesture", () => {
    it("emits longPress after 450ms within 8px slop", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 200, y: 200, time: 0 });
      arbiter.feed({ id: 1, type: "move", x: 203, y: 202, time: 200 }); // dist ~3.6px
      expect(arbiter.stepTime(450)).toEqual([{ type: "longPress", clientX: 203, clientY: 202 }]);
      // Subsequent up suppresses tap
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

  describe("Second-finger stroke abort (FEAT-MB2-04)", () => {
    it("aborts active 1-finger drag immediately when 2nd finger touches down", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 1, type: "move", x: 120, y: 100, time: 50 }); // drag started

      // 2nd finger arrives
      const secondDown = arbiter.feed({ id: 2, type: "down", x: 220, y: 100, time: 80 });
      expect(secondDown).toEqual([{ type: "cancel" }]);

      // Pointers move in parallel -> pans camera, does not emit brush moves
      arbiter.feed({ id: 1, type: "move", x: 130, y: 100, time: 100 });
      const panMove = arbiter.feed({ id: 2, type: "move", x: 230, y: 100, time: 100 });
      expect(panMove.some((i) => i.type === "twoFingerPan")).toBe(true);
      expect(panMove.some((i) => i.type === "oneFingerDragMove")).toBe(false);

      // Release does not emit oneFingerDragEnd
      const up1 = arbiter.feed({ id: 1, type: "up", x: 130, y: 100, time: 150 });
      expect(up1).toEqual([]);
      const up2 = arbiter.feed({ id: 2, type: "up", x: 230, y: 100, time: 160 });
      expect(up2).toEqual([]);
    });

    it("handles single-pointer move in two-finger state when flushed", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 });

      // Only pointer 1 moves, pointer 2 remains stationary
      arbiter.feed({ id: 1, type: "move", x: 120, y: 100, time: 30 });
      const intents = arbiter.flush();
      expect(intents.some((i) => i.type === "twoFingerPan")).toBe(true);
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
      const pinches = intents.filter((i) => i.type === "pinch");
      expect(pinches.length).toBe(0);
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

    it("contracting fingers emits pinch with factor > 1.0 (zoom out)", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 50, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 250, y: 100, time: 10 }); // spread = 200

      // Contract to 100
      arbiter.feed({ id: 1, type: "move", x: 100, y: 100, time: 30 });
      const intents = arbiter.feed({ id: 2, type: "move", x: 200, y: 100, time: 30 });

      const pinch = intents.find((i) => i.type === "pinch") as Extract<
        GestureIntent,
        { type: "pinch" }
      >;
      expect(pinch).toBeDefined();
      expect(pinch.factor).toBeGreaterThan(1.0);
    });
  });

  describe("Multi-finger tap", () => {
    it("emits 2-finger tap when both fingers touch and release quickly with <= 12px movement", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 });

      expect(arbiter.feed({ id: 1, type: "up", x: 102, y: 101, time: 80 })).toEqual([]);
      expect(arbiter.feed({ id: 2, type: "up", x: 202, y: 101, time: 90 })).toEqual([
        { type: "multiFingerTap", fingers: 2 },
      ]);
    });

    it("emits 3-finger tap when three fingers touch and release quickly", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 150, y: 100, time: 10 });
      arbiter.feed({ id: 3, type: "down", x: 200, y: 100, time: 20 });

      arbiter.feed({ id: 1, type: "up", x: 100, y: 100, time: 100 });
      arbiter.feed({ id: 2, type: "up", x: 150, y: 100, time: 110 });
      expect(arbiter.feed({ id: 3, type: "up", x: 200, y: 100, time: 120 })).toEqual([
        { type: "multiFingerTap", fingers: 3 },
      ]);
    });

    it("does not emit multiFingerTap if held > 300ms", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 });

      arbiter.feed({ id: 1, type: "up", x: 100, y: 100, time: 350 });
      expect(arbiter.feed({ id: 2, type: "up", x: 200, y: 100, time: 360 })).toEqual([]);
    });

    it("does not emit multiFingerTap if movement exceeds 12px", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 });
      arbiter.feed({ id: 1, type: "move", x: 125, y: 100, time: 50 }); // 25px move > 12px

      arbiter.feed({ id: 1, type: "up", x: 125, y: 100, time: 80 });
      expect(arbiter.feed({ id: 2, type: "up", x: 200, y: 100, time: 90 })).toEqual([]);
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

  describe("pointerEventToSample helper", () => {
    it("maps PointerEvent-like object to PointerSample", () => {
      const sample = pointerEventToSample({
        pointerId: 42,
        type: "pointerdown",
        clientX: 123,
        clientY: 456,
        timeStamp: 1000,
        pointerType: "touch",
      });
      expect(sample).toEqual({
        id: 42,
        type: "down",
        x: 123,
        y: 456,
        time: 1000,
        pointerType: "touch",
      });
    });
  });
});
