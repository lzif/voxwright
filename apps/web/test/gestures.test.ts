// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  GestureArbiter,
  type GestureIntent,
  pointerEventToSample,
  TWIST_MIN_SPREAD_PX,
  wrapDegrees,
} from "../src/lib/gestures.ts";

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
    it("lifting 1 finger during 2-finger pan hands the other finger to a one-finger orbit, never a tap", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 });
      arbiter.feed({ id: 1, type: "move", x: 150, y: 100, time: 30 });

      // Lift finger 1
      expect(arbiter.feed({ id: 1, type: "up", x: 150, y: 100, time: 50 })).toEqual([]);

      // Move finger 2 alone: it orbits from where it was when finger 1 lifted
      expect(arbiter.feed({ id: 2, type: "move", x: 250, y: 100, time: 70 })).toEqual([
        { type: "oneFingerDragStart", clientX: 200, clientY: 100 },
        { type: "oneFingerDragMove", clientX: 250, clientY: 100, dx: 50, dy: 0 },
      ]);

      // Lift finger 2: the drag ends, there is no tap
      expect(arbiter.feed({ id: 2, type: "up", x: 250, y: 100, time: 90 })).toEqual([
        { type: "oneFingerDragEnd", clientX: 250, clientY: 100 },
      ]);
    });
  });

  describe("A finger left over after a two-finger gesture", () => {
    /** Two fingers pan together, far enough that the gesture is no tap. Finger 2 ends at (250, 160). */
    function panThenLift(lifted: 1 | 2, liftTime = 400) {
      const h = createHarness();
      h.arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      h.arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 });
      h.arbiter.feed({ id: 1, type: "move", x: 150, y: 160, time: 100 });
      h.arbiter.feed({ id: 2, type: "move", x: 250, y: 160, time: 100 });
      const x = lifted === 1 ? 150 : 250;
      h.arbiter.feed({ id: lifted, type: "up", x, y: 160, time: liftTime });
      h.events.length = 0;
      return h;
    }

    it("orbits from where it was when the other finger lifted: the first delta is the movement since then", () => {
      const { arbiter } = panThenLift(1);
      // Finger 2 first touched at (200, 100); it is at (250, 160) when finger 1 lifts.
      expect(arbiter.feed({ id: 2, type: "move", x: 253, y: 164, time: 420 })).toEqual([
        { type: "oneFingerDragStart", clientX: 250, clientY: 160 },
        { type: "oneFingerDragMove", clientX: 253, clientY: 164, dx: 3, dy: 4 },
      ]);
      expect(arbiter.feed({ id: 2, type: "move", x: 260, y: 170, time: 440 })).toEqual([
        { type: "oneFingerDragMove", clientX: 260, clientY: 170, dx: 7, dy: 6 },
      ]);
      expect(arbiter.feed({ id: 2, type: "up", x: 260, y: 170, time: 460 })).toEqual([
        { type: "oneFingerDragEnd", clientX: 260, clientY: 170 },
      ]);
    });

    it("takes its baseline from the finger's last position even if its move was not yet evaluated", () => {
      const h = createHarness();
      h.arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      h.arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 });
      h.arbiter.feed({ id: 2, type: "move", x: 230, y: 130, time: 400 }); // half a packet: finger 1 did not move
      h.arbiter.feed({ id: 1, type: "up", x: 100, y: 100, time: 410 });
      h.events.length = 0;
      expect(h.arbiter.feed({ id: 2, type: "move", x: 232, y: 131, time: 420 })).toEqual([
        { type: "oneFingerDragStart", clientX: 230, clientY: 130 },
        { type: "oneFingerDragMove", clientX: 232, clientY: 131, dx: 2, dy: 1 },
      ]);
    });

    it("does nothing for a move that leaves it where it was", () => {
      const { arbiter } = panThenLift(1);
      expect(arbiter.feed({ id: 2, type: "move", x: 250, y: 160, time: 420 })).toEqual([]);
    });

    it("never taps or long-presses, held still or lifted without moving", () => {
      const held = panThenLift(2);
      expect(held.arbiter.stepTime(400 + 5000)).toEqual([]);
      expect(held.arbiter.feed({ id: 1, type: "up", x: 150, y: 160, time: 6000 })).toEqual([]);
      expect(held.events).toEqual([]);

      const quick = panThenLift(1);
      expect(quick.arbiter.feed({ id: 2, type: "up", x: 250, y: 160, time: 420 })).toEqual([]);
      expect(quick.events).toEqual([]);
    });

    it("a finger landing again makes it a two-finger gesture again, and dropping to one finger orbits again", () => {
      const { arbiter } = panThenLift(1);
      // Pending leftover (not moved yet): a new finger lands, pan works as before.
      arbiter.feed({ id: 3, type: "down", x: 150, y: 160, time: 450 });
      arbiter.feed({ id: 2, type: "move", x: 250, y: 200, time: 470 });
      const pan = arbiter.feed({ id: 3, type: "move", x: 150, y: 200, time: 470 });
      expect(pan.map((i) => i.type)).toEqual(["twoFingerPan"]);
      expect(pan[0]).toMatchObject({ dx: 0, dy: 40 });

      // The new finger lifts: finger 2 is the leftover again, baseline where it is now.
      expect(arbiter.feed({ id: 3, type: "up", x: 150, y: 200, time: 500 })).toEqual([]);
      expect(arbiter.feed({ id: 2, type: "move", x: 255, y: 205, time: 520 })).toEqual([
        { type: "oneFingerDragStart", clientX: 250, clientY: 200 },
        { type: "oneFingerDragMove", clientX: 255, clientY: 205, dx: 5, dy: 5 },
      ]);
    });

    it("a finger landing during the leftover orbit cancels it (pair stays balanced) and starts a pan", () => {
      const { arbiter, events } = panThenLift(1);
      arbiter.feed({ id: 2, type: "move", x: 260, y: 170, time: 420 });
      events.length = 0;
      expect(arbiter.feed({ id: 3, type: "down", x: 150, y: 160, time: 450 })).toEqual([
        { type: "cancel" },
      ]);
      arbiter.feed({ id: 2, type: "move", x: 260, y: 200, time: 470 });
      const pan = arbiter.feed({ id: 3, type: "move", x: 150, y: 190, time: 470 });
      expect(pan.map((i) => i.type)).toContain("twoFingerPan");

      // Back to one finger: orbit again, from the finger's position at the lift.
      arbiter.feed({ id: 3, type: "up", x: 150, y: 190, time: 500 });
      expect(arbiter.feed({ id: 2, type: "move", x: 262, y: 203, time: 520 })).toEqual([
        { type: "oneFingerDragStart", clientX: 260, clientY: 200 },
        { type: "oneFingerDragMove", clientX: 262, clientY: 203, dx: 2, dy: 3 },
      ]);
      expect(arbiter.feed({ id: 2, type: "up", x: 262, y: 203, time: 540 })).toEqual([
        { type: "oneFingerDragEnd", clientX: 262, clientY: 203 },
      ]);
    });

    it("every oneFingerDragStart is closed by an end or a cancel", () => {
      const { arbiter, events } = createHarness();
      const feed = (id: number, type: "down" | "move" | "up", x: number, y: number, time: number) =>
        arbiter.feed({ id, type, x, y, time });
      feed(1, "down", 100, 100, 0);
      feed(1, "move", 130, 100, 20); // one-finger drag
      feed(2, "down", 200, 100, 40); // cancel
      feed(2, "up", 200, 100, 60); // leftover
      feed(1, "move", 140, 110, 80); // drag again
      feed(1, "up", 140, 110, 100); // end
      feed(3, "down", 10, 10, 200);
      feed(4, "down", 90, 10, 210);
      feed(3, "move", 20, 40, 400);
      feed(4, "move", 100, 40, 400);
      feed(3, "up", 20, 40, 420);
      feed(4, "move", 110, 50, 440); // drag
      feed(4, "up", 110, 50, 460); // end
      const open = events.reduce((n, i) => {
        if (i.type === "oneFingerDragStart") return n + 1;
        if (i.type === "oneFingerDragEnd" || i.type === "cancel") return n - 1;
        return n;
      }, 0);
      expect(open).toBe(0);
      expect(events.filter((i) => i.type === "oneFingerDragStart")).toHaveLength(3);
      expect(events.some((i) => i.type === "tap" || i.type === "longPress")).toBe(false);
    });

    it("a quick two-finger tap is unchanged: small movement of the finger left over is no orbit, the lift is a multiFingerTap", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 });
      expect(arbiter.feed({ id: 1, type: "up", x: 101, y: 100, time: 80 })).toEqual([]);
      expect(arbiter.feed({ id: 2, type: "move", x: 203, y: 102, time: 85 })).toEqual([]);
      expect(arbiter.feed({ id: 2, type: "up", x: 203, y: 102, time: 90 })).toEqual([
        { type: "multiFingerTap", fingers: 2 },
      ]);
    });

    it("a quick two-finger touch whose leftover finger then travels past the slop is an orbit, not a tap", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 });
      arbiter.feed({ id: 1, type: "up", x: 100, y: 100, time: 80 });
      expect(arbiter.feed({ id: 2, type: "move", x: 205, y: 100, time: 90 })).toEqual([]);
      const crossing = arbiter.feed({ id: 2, type: "move", x: 216, y: 100, time: 100 });
      expect(crossing).toEqual([
        { type: "oneFingerDragStart", clientX: 200, clientY: 100 },
        { type: "oneFingerDragMove", clientX: 216, clientY: 100, dx: 16, dy: 0 },
      ]);
      expect(
        arbiter.feed({ id: 2, type: "up", x: 216, y: 100, time: 120 }).map((i) => i.type),
      ).toEqual(["oneFingerDragEnd"]);
    });

    it("a leftover finger held past the tap window starts to orbit on its first move, however small", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 });
      arbiter.feed({ id: 1, type: "up", x: 100, y: 100, time: 200 });
      expect(arbiter.feed({ id: 2, type: "move", x: 201, y: 100, time: 350 })).toEqual([
        { type: "oneFingerDragStart", clientX: 200, clientY: 100 },
        { type: "oneFingerDragMove", clientX: 201, clientY: 100, dx: 1, dy: 0 },
      ]);
    });
  });

  describe("Paths that still wait for every finger to lift", () => {
    it("three fingers: after one lifts, the other two are ignored until all are up", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 150, y: 100, time: 10 });
      arbiter.feed({ id: 3, type: "down", x: 200, y: 100, time: 20 });
      arbiter.feed({ id: 3, type: "up", x: 200, y: 100, time: 600 });
      expect(arbiter.feed({ id: 1, type: "move", x: 100, y: 200, time: 620 })).toEqual([]);
      arbiter.feed({ id: 2, type: "up", x: 150, y: 100, time: 640 });
      // The last of the three is no leftover orbit either.
      expect(arbiter.feed({ id: 1, type: "move", x: 100, y: 300, time: 660 })).toEqual([]);
      expect(arbiter.feed({ id: 1, type: "up", x: 100, y: 300, time: 680 })).toEqual([]);
    });

    it("a fourth finger: everything waits until all are up", () => {
      const { arbiter } = createHarness();
      for (let id = 1; id <= 4; id++)
        arbiter.feed({ id, type: "down", x: id * 50, y: 100, time: id });
      for (const id of [1, 2, 3]) arbiter.feed({ id, type: "up", x: id * 50, y: 100, time: 500 });
      expect(arbiter.feed({ id: 4, type: "move", x: 200, y: 300, time: 520 })).toEqual([]);
      expect(arbiter.feed({ id: 4, type: "up", x: 200, y: 300, time: 540 })).toEqual([]);
    });

    it("a pointercancel of one of two fingers: the other waits, as the system took the first away", () => {
      const { arbiter } = createHarness();
      arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
      arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 });
      arbiter.feed({ id: 1, type: "move", x: 150, y: 160, time: 100 });
      arbiter.feed({ id: 2, type: "move", x: 250, y: 160, time: 100 });
      expect(arbiter.feed({ id: 1, type: "cancel", x: 150, y: 160, time: 400 })).toEqual([]);
      expect(arbiter.feed({ id: 2, type: "move", x: 300, y: 200, time: 420 })).toEqual([]);
      expect(arbiter.feed({ id: 2, type: "up", x: 300, y: 200, time: 440 })).toEqual([]);
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

describe("wrapDegrees", () => {
  it("wraps an angle difference into (-180, 180]", () => {
    expect(wrapDegrees(0)).toBe(0);
    expect(wrapDegrees(10)).toBe(10);
    expect(wrapDegrees(-10)).toBe(-10);
    expect(wrapDegrees(180)).toBe(180);
    expect(wrapDegrees(-180)).toBe(180);
    expect(wrapDegrees(190)).toBeCloseTo(-170, 9);
    expect(wrapDegrees(-190)).toBeCloseTo(170, 9);
    expect(wrapDegrees(359)).toBeCloseTo(-1, 9);
    expect(wrapDegrees(360)).toBe(0);
    expect(wrapDegrees(540)).toBe(180);
    expect(wrapDegrees(-350)).toBeCloseTo(10, 9);
  });
});

describe("GestureArbiter two-finger twist", () => {
  const CENTER = { x: 200, y: 300 };
  const RADIUS = 60; // 120 px between the fingers
  const RAD = Math.PI / 180;

  /**
   * Two fingers on a circle round CENTER, at `deg` and `deg + 180` (y down: a larger angle is a
   * clockwise turn on the screen). Both are moved in one touch packet, so the arbiter evaluates them
   * at once. `radius` lets a test pinch while it turns.
   */
  function fingers(deg: number, radius = RADIUS) {
    const at = (a: number) => ({
      x: CENTER.x + Math.cos(a * RAD) * radius,
      y: CENTER.y + Math.sin(a * RAD) * radius,
    });
    return [at(deg), at(deg + 180)] as const;
  }

  function twoFingers(startDeg = 0, radius = RADIUS, config = {}) {
    const events: GestureIntent[] = [];
    const arbiter = new GestureArbiter({ onIntent: (i) => events.push(i), ...config });
    const [a, b] = fingers(startDeg, radius);
    let time = 0;
    arbiter.feed({ id: 1, type: "down", x: a.x, y: a.y, time });
    time += 10;
    arbiter.feed({ id: 2, type: "down", x: b.x, y: b.y, time });
    /** Turn to `deg` (and `radius`) in one packet; returns the intents of that packet. */
    const turnTo = (deg: number, r = radius): GestureIntent[] => {
      const [p, q] = fingers(deg, r);
      time += 16;
      const out = [...arbiter.feed({ id: 1, type: "move", x: p.x, y: p.y, time })];
      out.push(...arbiter.feed({ id: 2, type: "move", x: q.x, y: q.y, time }));
      return out;
    };
    return { arbiter, events, turnTo, getTime: () => time };
  }

  const twists = (intents: readonly GestureIntent[]): number[] =>
    intents.flatMap((i) => (i.type === "twist" ? [i.degrees] : []));

  it("emits nothing until the twist since landing passes 10 degrees", () => {
    const t = twoFingers();
    // 2 degrees at a time to 9.
    for (const deg of [2, 4, 6, 8, 9]) expect(twists(t.turnTo(deg)), `at ${deg}`).toEqual([]);
    expect(twists(t.events)).toEqual([]);
  });

  it("the dead zone is the same the other way", () => {
    const t = twoFingers();
    for (const deg of [-2, -4, -6, -8, -9.5])
      expect(twists(t.turnTo(deg)), `at ${deg}`).toEqual([]);
    const past = twists(t.turnTo(-11));
    expect(past).toHaveLength(1);
    expect(past[0]).toBeCloseTo(-1, 6); // only what lies beyond the zone
  });

  it("just inside 10 degrees is silent and just outside speaks", () => {
    expect(twists(twoFingers().turnTo(9.9))).toEqual([]);
    const past = twists(twoFingers().turnTo(10.1));
    expect(past).toHaveLength(1);
    expect(past[0]).toBeCloseTo(0.1, 6);
  });

  it("the frame that passes the dead zone says only what lies beyond it, never the total, so the view does not snap", () => {
    const t = twoFingers();
    for (const deg of [3, 6, 9]) t.turnTo(deg);
    const first = twists(t.turnTo(12));
    expect(first).toHaveLength(1);
    expect(first[0]).toBeCloseTo(2, 6); // 12 turned, 10 of them inside the zone
    expect(first[0]).not.toBeCloseTo(12, 1);
    // A single big frame is no different: 25 degrees at once is 15 beyond the zone.
    const jump = twists(twoFingers().turnTo(25));
    expect(jump).toHaveLength(1);
    expect(jump[0]).toBeCloseTo(15, 6);
  });

  it("after the dead zone it follows the fingers 1:1, frame by frame, always a zone behind them", () => {
    const t = twoFingers();
    const all: number[] = [];
    for (let deg = 3; deg <= 90; deg += 3) all.push(...twists(t.turnTo(deg)));
    // The frame that passed the zone (12) said 2; every frame after that said its own 3.
    expect(all[0]).toBeCloseTo(2, 6);
    for (const d of all.slice(1)) expect(d).toBeCloseTo(3, 6);
    expect(all.reduce((a, b) => a + b, 0)).toBeCloseTo(80, 6);
  });

  it("the view stays exactly the size of the dead zone behind the fingers, whatever the size of the frames", () => {
    for (const step of [1.3, 3, 4.7, 7, 11]) {
      const t = twoFingers();
      let sum = 0;
      let deg = 0;
      while (deg + step <= 70) {
        deg += step;
        sum += twists(t.turnTo(deg)).reduce((a, b) => a + b, 0);
      }
      expect(sum, `frames of ${step}`).toBeCloseTo(deg - 10, 6);
    }
  });

  it("clockwise on the screen is positive, counter-clockwise negative", () => {
    // With the fingers on a horizontal line, the second one moving down (y grows) is a clockwise turn.
    const cw = twoFingers();
    expect(twists(cw.turnTo(30))[0]).toBeGreaterThan(0);
    const [p, q] = fingers(30);
    expect(q.y).toBeLessThan(CENTER.y); // finger 2 started at 180 degrees: it went up while finger 1 went down
    expect(p.y).toBeGreaterThan(CENTER.y);
    const ccw = twoFingers();
    expect(twists(ccw.turnTo(-30))[0]).toBeLessThan(0);
  });

  it("stays active for the rest of the gesture, even back inside the dead zone", () => {
    const t = twoFingers();
    expect(twists(t.turnTo(20))).toHaveLength(1);
    const back = twists(t.turnTo(5));
    expect(back).toHaveLength(1);
    expect(back[0]).toBeCloseTo(-15, 6);
    const again = twists(t.turnTo(0));
    expect(again[0]).toBeCloseTo(-5, 6);
  });

  it("a frame in which the fingers did not turn says nothing", () => {
    const t = twoFingers();
    t.turnTo(25);
    expect(twists(t.turnTo(25))).toEqual([]);
  });

  describe("wrap-around at +-180 degrees", () => {
    it("a twist across the line has no jump: the deltas stay small and the total is right", () => {
      // Start with the line at 170 degrees; turn clockwise to 230 (= -130) in steps of 6.
      const t = twoFingers(170);
      const all: number[] = [];
      for (let deg = 176; deg <= 230; deg += 6) all.push(...twists(t.turnTo(deg)));
      expect(all[0]).toBeCloseTo(2, 6); // 6 is silent; 12 speaks with the 2 beyond the zone
      for (const d of all.slice(1)) expect(d).toBeCloseTo(6, 6);
      expect(all.reduce((a, b) => a + b, 0)).toBeCloseTo(50, 6); // 60 turned, the first 10 not made up
      expect(Math.max(...all.map(Math.abs))).toBeLessThan(20);
    });

    it("counter-clockwise across the line too", () => {
      const t = twoFingers(-170);
      const all: number[] = [];
      for (let deg = -176; deg >= -230; deg -= 6) all.push(...twists(t.turnTo(deg)));
      expect(all.reduce((a, b) => a + b, 0)).toBeCloseTo(-50, 6);
      expect(Math.max(...all.map(Math.abs))).toBeLessThan(20);
    });

    it("a full turn and more adds up to the whole angle less the zone", () => {
      const t = twoFingers();
      const all: number[] = [];
      for (let deg = 8; deg <= 400; deg += 8) all.push(...twists(t.turnTo(deg)));
      expect(all.reduce((a, b) => a + b, 0)).toBeCloseTo(390, 6);
    });

    it("the dead zone counts the sum, so 6 + 6 across the line is 12", () => {
      const t = twoFingers(177);
      expect(twists(t.turnTo(183))).toEqual([]); // 6 degrees, across 180
      const past = twists(t.turnTo(189));
      expect(past).toHaveLength(1);
      expect(past[0]).toBeCloseTo(2, 6); // 12 in all, 2 beyond the zone
    });
  });

  describe("with pan and pinch", () => {
    it("a pinch and a twist in the same frame: both are emitted, the pinch before the twist", () => {
      const t = twoFingers();
      const intents = t.turnTo(20, RADIUS * 1.5);
      const order = intents.map((i) => i.type);
      expect(order).toContain("pinch");
      expect(order).toContain("twist");
      expect(order.indexOf("pinch")).toBeLessThan(order.indexOf("twist"));
      const pinch = intents.find((i) => i.type === "pinch") as Extract<
        GestureIntent,
        { type: "pinch" }
      >;
      expect(pinch.factor).toBeCloseTo(1 / 1.5, 6);
      expect(twists(intents)[0]).toBeCloseTo(10, 6); // 20 turned, 10 beyond the zone
    });

    it("pinch keeps working during a twist: the spread changes while the line turns", () => {
      const t = twoFingers();
      t.turnTo(20); // past the dead zone
      const factors: number[] = [];
      let sum = 0;
      for (let i = 1; i <= 6; i++) {
        const intents = t.turnTo(20 + i * 5, RADIUS * (1 + i * 0.1));
        for (const it of intents) if (it.type === "pinch") factors.push(it.factor);
        sum += twists(intents).reduce((a, b) => a + b, 0);
      }
      expect(factors.length).toBeGreaterThan(0);
      for (const f of factors) expect(f).toBeLessThan(1); // fingers moving apart: zoom in
      expect(sum).toBeCloseTo(30, 6);
    });

    it("a pan keeps working during a twist: the centre moves while the line turns", () => {
      const t = twoFingers();
      t.turnTo(20);
      // Turn 10 degrees more and shift both fingers 20 px right.
      const [p, q] = fingers(30);
      const out = [
        ...t.arbiter.feed({ id: 1, type: "move", x: p.x + 20, y: p.y, time: 500 }),
        ...t.arbiter.feed({ id: 2, type: "move", x: q.x + 20, y: q.y, time: 500 }),
      ];
      const pan = out.find((i) => i.type === "twoFingerPan") as Extract<
        GestureIntent,
        { type: "twoFingerPan" }
      >;
      expect(pan).toBeDefined();
      expect(pan.dx).toBeCloseTo(20, 6);
      expect(twists(out)[0]).toBeCloseTo(10, 6);
    });

    it("a pure pan or pinch never twists", () => {
      const t = twoFingers();
      const events: GestureIntent[] = [];
      for (let i = 1; i <= 10; i++) events.push(...t.turnTo(0, RADIUS + i * 6)); // spread grows, line fixed
      expect(events.some((i) => i.type === "pinch")).toBe(true);
      expect(twists(events)).toEqual([]);
    });

    it("a twist does not produce the pan or pinch it cannot see: fingers on a fixed circle say only twist", () => {
      const t = twoFingers();
      const intents = t.turnTo(25);
      expect(intents.map((i) => i.type)).toEqual(["twist"]);
    });
  });

  describe("when the two fingers change", () => {
    it("the twist is counted from the moment the two fingers are down together", () => {
      const t = twoFingers();
      expect(twists(t.turnTo(8))).toEqual([]);
      // Lift finger 2 and put it down again at the same place: the 8 degrees are forgotten.
      const [, q] = fingers(8);
      t.arbiter.feed({ id: 2, type: "up", x: q.x, y: q.y, time: 300 });
      t.arbiter.feed({ id: 2, type: "down", x: q.x, y: q.y, time: 320 });
      const next = fingers(16);
      const out = [
        ...t.arbiter.feed({ id: 1, type: "move", x: next[0].x, y: next[0].y, time: 340 }),
        ...t.arbiter.feed({ id: 2, type: "move", x: next[1].x, y: next[1].y, time: 340 }),
      ];
      expect(twists(out)).toEqual([]); // only 8 degrees since this landing
    });

    it("an active twist stops when a finger lifts: the finger left over orbits and never twists", () => {
      const t = twoFingers();
      t.turnTo(30);
      const [p, q] = fingers(30);
      t.arbiter.feed({ id: 2, type: "up", x: q.x, y: q.y, time: 400 });
      const out = [
        ...t.arbiter.feed({ id: 1, type: "move", x: p.x + 30, y: p.y + 30, time: 420 }),
        ...t.arbiter.feed({ id: 1, type: "move", x: p.x + 60, y: p.y + 60, time: 440 }),
      ];
      expect(twists(out)).toEqual([]);
      expect(out.some((i) => i.type === "oneFingerDragMove")).toBe(true);
    });

    it("three or more fingers do not twist", () => {
      const t = twoFingers();
      t.arbiter.feed({ id: 3, type: "down", x: 20, y: 20, time: 100 });
      const [p, q] = fingers(40);
      const out = [
        ...t.arbiter.feed({ id: 1, type: "move", x: p.x, y: p.y, time: 120 }),
        ...t.arbiter.feed({ id: 2, type: "move", x: q.x, y: q.y, time: 120 }),
      ];
      expect(twists(out)).toEqual([]);
    });
  });

  describe("fingers almost on top of each other", () => {
    it(`below ${TWIST_MIN_SPREAD_PX} px apart the angle is noise: no twist, and it is measured again from there`, () => {
      const t = twoFingers(0, 8); // 16 px between the fingers
      expect(twists(t.turnTo(40, 8))).toEqual([]);
      expect(twists(t.turnTo(-80, 8))).toEqual([]);
      // Spreading to a real distance does not turn the build by the noise before it.
      const wide = twists(t.turnTo(-80, RADIUS));
      expect(wide).toEqual([]);
    });
  });

  describe("configuration", () => {
    it("the dead zone can be set", () => {
      const wide = twoFingers(0, RADIUS, { twistDeadZoneDeg: 20 });
      expect(twists(wide.turnTo(15))).toEqual([]);
      expect(twists(wide.turnTo(21))[0]).toBeCloseTo(1, 6);
      const none = twoFingers(0, RADIUS, { twistDeadZoneDeg: 0 });
      expect(twists(none.turnTo(1))[0]).toBeCloseTo(1, 6);
    });
  });

  it("does not disturb a quick two-finger tap", () => {
    const events: GestureIntent[] = [];
    const arbiter = new GestureArbiter({ onIntent: (i) => events.push(i) });
    arbiter.feed({ id: 1, type: "down", x: 100, y: 100, time: 0 });
    arbiter.feed({ id: 2, type: "down", x: 200, y: 100, time: 10 });
    arbiter.feed({ id: 1, type: "up", x: 100, y: 100, time: 80 });
    arbiter.feed({ id: 2, type: "up", x: 200, y: 100, time: 90 });
    expect(events).toEqual([{ type: "multiFingerTap", fingers: 2 }]);
  });
});
