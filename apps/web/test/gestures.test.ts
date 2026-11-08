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
