// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import type { GestureIntent, PointerPhase } from "../src/lib/gestures.ts";
import { TouchRouter, type TouchTarget } from "../src/lib/touch-router.ts";

interface Options {
  /** Does a gesture that starts now belong to the tool? */
  toolActive?: boolean;
  /** Called for every cursor move; false ends the gesture, as when the finger leaves the canvas. */
  move?: (x: number, y: number) => boolean;
  /** No editing side at all, as before a file is open. */
  noTarget?: boolean;
}

function createHarness(options: Options = {}) {
  const log: string[] = [];
  const camera: GestureIntent[] = [];
  const state = { toolActive: options.toolActive ?? true };
  const target: TouchTarget = {
    get touchToolActive() {
      return state.toolActive;
    },
    touchMove(x, y) {
      log.push(`move ${x},${y}`);
      return options.move?.(x, y) ?? true;
    },
    touchTap: (x, y) => log.push(`tap ${x},${y}`),
    touchStrokeBegin: (x, y) => log.push(`strokeBegin ${x},${y}`),
    touchStrokeEnd: (x, y) => log.push(`strokeEnd ${x},${y}`),
    touchCancel: () => log.push("cancel"),
    touchLongPress: (x, y) => log.push(`longPress ${x},${y}`),
    touchPickAt: (x, y) => log.push(`pickAt ${x},${y}`),
    touchEnd: () => log.push("end"),
  };
  const router = new TouchRouter({
    target: () => (options.noTarget ? null : target),
    camera: (intent) => camera.push(intent),
    // The arbiter's own timers never run; tests advance its clock with `stepTime`.
    arbiter: { setTimeout: () => 0 as unknown as ReturnType<typeof setTimeout>, clearTimeout() {} },
  });
  const feed = (id: number, type: PointerPhase, x: number, y: number, time: number): void =>
    router.feed({ id, type, x, y, time });
  const stepTime = (time: number): void => router.stepTime(time);
  return { router, log, camera, state, feed, stepTime };
}

const types = (intents: readonly GestureIntent[]): string[] => intents.map((i) => i.type);

describe("TouchRouter", () => {
  describe("a gesture that starts on a touch tool", () => {
    it("tap: shows the cursor on landing, applies the tool once on lift, then ends", () => {
      const h = createHarness();
      h.feed(1, "down", 100, 200, 0);
      expect(h.router.currentOwner).toBe("tool");
      h.feed(1, "up", 100, 200, 80);
      expect(h.log).toEqual(["move 100,200", "tap 100,200", "end"]);
      expect(h.camera).toEqual([]);
      expect(h.router.currentOwner).toBe("none");
    });

    it("tap: the cursor follows the finger inside the slop and the tap uses the lift point", () => {
      const h = createHarness();
      h.feed(1, "down", 100, 200, 0);
      h.feed(1, "move", 103, 202, 30);
      h.feed(1, "up", 104, 203, 60);
      expect(h.log).toEqual(["move 100,200", "move 103,202", "tap 104,203", "end"]);
    });

    it("drag: begins the stroke at the finger-down point, follows the finger, commits on lift", () => {
      const h = createHarness();
      h.feed(1, "down", 100, 200, 0);
      h.feed(1, "move", 120, 200, 30);
      h.feed(1, "move", 150, 210, 60);
      h.feed(1, "up", 150, 210, 90);
      expect(h.log).toEqual([
        "move 100,200",
        "move 120,200", // the raw move that crossed the slop
        "strokeBegin 100,200", // where the finger first touched, not where it is now
        "move 150,210",
        "strokeEnd 150,210",
        "end",
      ]);
      // The view must not turn while the tool owns the gesture.
      expect(h.camera).toEqual([]);
    });

    it("never starts a stroke or a tap for a gesture that ended by a long press", () => {
      const h = createHarness();
      h.feed(1, "down", 100, 200, 0);
      h.stepTime(450);
      expect(h.log).toEqual(["move 100,200", "longPress 100,200"]);
      // Later moves do nothing, not even in the arbiter (it ignores them after a long press).
      h.feed(1, "move", 160, 260, 600);
      h.feed(1, "move", 220, 300, 700);
      h.feed(1, "up", 220, 300, 800);
      expect(h.log).toEqual(["move 100,200", "longPress 100,200", "end"]);
      expect(h.camera).toEqual([]);
    });

    it("a gesture dragged off the canvas is spent: nothing more reaches the tool until every finger is up", () => {
      let alive = true;
      const h = createHarness({ move: () => alive });
      h.feed(1, "down", 100, 200, 0);
      h.feed(1, "move", 130, 200, 30); // stroke begins
      alive = false;
      h.feed(1, "move", 160, 200, 60); // the editor cancels itself and answers false
      alive = true;
      h.feed(1, "move", 170, 200, 90);
      h.feed(1, "up", 170, 200, 120);
      expect(h.log).toEqual([
        "move 100,200",
        "move 130,200",
        "strokeBegin 100,200",
        "move 160,200",
        "end",
      ]);
      expect(h.log).not.toContain("strokeEnd 170,200");
    });

    it("a gesture that lands where the editor refuses it is spent at once", () => {
      const h = createHarness({ move: () => false });
      h.feed(1, "down", 100, 5, 0);
      h.feed(1, "up", 100, 5, 60);
      expect(h.log).toEqual(["move 100,5", "end"]);
    });

    it("a pointer cancel mid-stroke cancels once", () => {
      const h = createHarness();
      h.feed(1, "down", 100, 200, 0);
      h.feed(1, "move", 130, 200, 30);
      h.feed(1, "cancel", 130, 200, 60);
      expect(h.log.filter((l) => l === "cancel")).toHaveLength(1);
      expect(h.log).not.toContain("strokeEnd 130,200");
      expect(h.router.currentOwner).toBe("none");
    });

    it("a pointer cancel before the drag started cancels too, though the arbiter says nothing", () => {
      const h = createHarness();
      h.feed(1, "down", 100, 200, 0);
      h.feed(1, "cancel", 100, 200, 30);
      expect(h.log).toEqual(["move 100,200", "cancel", "end"]);
    });

    it("the next gesture is decided afresh", () => {
      const h = createHarness();
      h.feed(1, "down", 100, 200, 0);
      h.feed(1, "up", 100, 200, 50);
      h.state.toolActive = false;
      h.feed(1, "down", 100, 200, 1000);
      expect(h.router.currentOwner).toBe("camera");
      h.feed(1, "up", 100, 200, 1050);
      h.state.toolActive = true;
      h.feed(1, "down", 100, 200, 2000);
      expect(h.router.currentOwner).toBe("tool");
    });
  });

  describe("a second finger", () => {
    it("mid-stroke: reverts the stroke, hands the gesture to the camera, and the leftover finger orbits without reaching the tool", () => {
      const h = createHarness();
      h.feed(1, "down", 100, 200, 0);
      h.feed(1, "move", 130, 200, 30); // stroke in progress
      h.feed(2, "down", 220, 200, 60);
      expect(h.router.currentOwner).toBe("camera");
      expect(h.log.filter((l) => l === "cancel")).toHaveLength(1);

      // Two fingers move the camera.
      h.feed(1, "move", 140, 210, 100);
      h.feed(2, "move", 230, 210, 100);
      expect(types(h.camera)).toContain("twoFingerPan");

      // One finger lifts; the other stays down and moves a long way.
      h.feed(2, "up", 230, 210, 200);
      const seen = h.log.length;
      const cameraSeen = h.camera.length;
      h.feed(1, "move", 200, 300, 250);
      h.feed(1, "move", 260, 400, 300);
      h.feed(1, "up", 260, 400, 350);

      // The tool heard nothing after the cancel: no move, no stroke end, no tap, no end.
      expect(h.log.slice(seen)).toEqual([]);
      expect(h.log).not.toContain("strokeEnd 260,400");
      expect(h.log.some((l) => l.startsWith("tap") || l.startsWith("pickAt"))).toBe(false);
      // The camera gets the leftover finger as an orbit that starts where the finger was at the lift.
      expect(h.camera.slice(cameraSeen)).toEqual([
        { type: "oneFingerDragStart", clientX: 140, clientY: 210 },
        { type: "oneFingerDragMove", clientX: 200, clientY: 300, dx: 60, dy: 90 },
        { type: "oneFingerDragMove", clientX: 260, clientY: 400, dx: 60, dy: 100 },
        { type: "oneFingerDragEnd", clientX: 260, clientY: 400 },
      ]);
      expect(h.router.currentOwner).toBe("none");
    });

    it("before the drag started: cancels once and the camera takes over, though the arbiter emits no cancel", () => {
      const h = createHarness();
      h.feed(1, "down", 100, 200, 0);
      h.feed(1, "move", 103, 201, 20); // inside the slop
      h.feed(2, "down", 220, 200, 40);
      expect(h.log).toEqual(["move 100,200", "move 103,201", "cancel"]);
      expect(h.router.currentOwner).toBe("camera");
      h.feed(1, "up", 103, 201, 100);
      h.feed(2, "up", 220, 200, 110);
      expect(h.log).toEqual(["move 100,200", "move 103,201", "cancel"]);
      expect(h.router.currentOwner).toBe("none");
    });

    it("pinch zoom reaches the camera, and a finger left down after it orbits but does not paint", () => {
      const h = createHarness();
      h.feed(1, "down", 100, 300, 0);
      h.feed(2, "down", 200, 300, 5);
      h.feed(1, "move", 80, 300, 40);
      h.feed(2, "move", 220, 300, 40);
      expect(types(h.camera)).toContain("pinch");
      h.feed(2, "up", 220, 300, 80);
      const cameraSeen = h.camera.length;
      h.feed(1, "move", 140, 360, 120);
      h.feed(1, "move", 200, 420, 160);
      h.feed(1, "up", 200, 420, 200);
      expect(h.camera.slice(cameraSeen)).toEqual([
        { type: "oneFingerDragStart", clientX: 80, clientY: 300 },
        { type: "oneFingerDragMove", clientX: 140, clientY: 360, dx: 60, dy: 60 },
        { type: "oneFingerDragMove", clientX: 200, clientY: 420, dx: 60, dy: 60 },
        { type: "oneFingerDragEnd", clientX: 200, clientY: 420 },
      ]);
      expect(h.log.some((l) => l.startsWith("strokeBegin") || l.startsWith("tap"))).toBe(false);
    });

    it("before the drag started: after the second finger lifts, the leftover finger orbits and never paints or picks", () => {
      const h = createHarness();
      h.feed(1, "down", 100, 200, 0);
      h.feed(2, "down", 220, 200, 40); // tool cancels, camera owns the gesture
      expect(h.router.currentOwner).toBe("camera");
      h.feed(2, "up", 220, 200, 500);
      const logSeen = h.log.length;
      const cameraSeen = h.camera.length;

      // Held still for a long time: no long press, so no pick.
      h.stepTime(2000);
      expect(h.camera.slice(cameraSeen)).toEqual([]);

      h.feed(1, "move", 104, 203, 2100);
      h.feed(1, "move", 150, 260, 2150);
      h.feed(1, "up", 150, 260, 2200);
      expect(h.camera.slice(cameraSeen)).toEqual([
        { type: "oneFingerDragStart", clientX: 100, clientY: 200 },
        { type: "oneFingerDragMove", clientX: 104, clientY: 203, dx: 4, dy: 3 },
        { type: "oneFingerDragMove", clientX: 150, clientY: 260, dx: 46, dy: 57 },
        { type: "oneFingerDragEnd", clientX: 150, clientY: 260 },
      ]);
      expect(h.log.slice(logSeen)).toEqual([]);
      expect(h.log.some((l) => l.startsWith("pickAt") || l.startsWith("tap"))).toBe(false);
    });

    it("a quick two-finger tap that began as a tool gesture is no orbit and no paint", () => {
      const h = createHarness();
      h.feed(1, "down", 100, 200, 0);
      h.feed(2, "down", 220, 200, 20);
      h.feed(1, "up", 100, 200, 70);
      h.feed(2, "move", 222, 201, 75);
      h.feed(2, "up", 222, 201, 90);
      expect(h.camera).toEqual([{ type: "multiFingerTap", fingers: 2 }]);
      expect(h.log).toEqual(["move 100,200", "cancel"]);
    });

    it("a finger landing again next to the leftover finger is a two-finger gesture again", () => {
      const h = createHarness();
      h.feed(1, "down", 100, 300, 0);
      h.feed(2, "down", 200, 300, 5);
      h.feed(1, "move", 80, 300, 400);
      h.feed(2, "move", 220, 300, 400);
      h.feed(2, "up", 220, 300, 500);
      h.feed(1, "move", 90, 310, 520); // orbit
      const cameraSeen = h.camera.length;
      h.feed(3, "down", 220, 300, 600);
      h.feed(1, "move", 90, 340, 650);
      h.feed(3, "move", 220, 340, 650);
      expect(types(h.camera.slice(cameraSeen))).toEqual(["cancel", "twoFingerPan"]);
      h.feed(3, "up", 220, 340, 700);
      h.feed(1, "move", 95, 345, 720);
      h.feed(1, "up", 95, 345, 760);
      expect(types(h.camera.slice(cameraSeen + 2))).toEqual([
        "oneFingerDragStart",
        "oneFingerDragMove",
        "oneFingerDragEnd",
      ]);
      expect(h.log.some((l) => l.startsWith("strokeBegin") || l.startsWith("tap"))).toBe(false);
    });

    it("a second finger after a long press also hands the gesture to the camera", () => {
      const h = createHarness();
      h.feed(1, "down", 100, 200, 0);
      h.stepTime(450);
      h.feed(2, "down", 220, 200, 500);
      expect(h.router.currentOwner).toBe("camera");
      // The tool's gesture was spent, so there is nothing left to cancel.
      expect(h.log).toEqual(["move 100,200", "longPress 100,200"]);
    });
  });

  describe("a gesture the camera owns (View, Line, Rectangle, Select, Paste)", () => {
    it("one finger orbits as before and the tool hears nothing", () => {
      const h = createHarness({ toolActive: false });
      h.feed(1, "down", 100, 200, 0);
      expect(h.router.currentOwner).toBe("camera");
      h.feed(1, "move", 120, 210, 30);
      h.feed(1, "move", 140, 220, 60);
      h.feed(1, "up", 140, 220, 90);
      expect(types(h.camera)).toEqual([
        "oneFingerDragStart",
        "oneFingerDragMove",
        "oneFingerDragMove",
        "oneFingerDragEnd",
      ]);
      expect(h.log).toEqual([]);
    });

    it("a finger left down after a two-finger gesture keeps turning the view, and picks nothing", () => {
      const h = createHarness({ toolActive: false });
      h.feed(1, "down", 100, 300, 0);
      h.feed(2, "down", 200, 300, 5);
      h.feed(1, "move", 80, 300, 400);
      h.feed(2, "move", 220, 300, 400);
      h.feed(2, "up", 220, 300, 500);
      const cameraSeen = h.camera.length;
      h.stepTime(5000); // held still: not a long press
      h.feed(1, "move", 85, 310, 5100);
      h.feed(1, "up", 85, 310, 5200);
      expect(h.camera.slice(cameraSeen)).toEqual([
        { type: "oneFingerDragStart", clientX: 80, clientY: 300 },
        { type: "oneFingerDragMove", clientX: 85, clientY: 310, dx: 5, dy: 10 },
        { type: "oneFingerDragEnd", clientX: 85, clientY: 310 },
      ]);
      expect(h.log).toEqual([]);
    });

    it("the owner holds for the whole gesture even if the tool changes under the finger", () => {
      const h = createHarness({ toolActive: false });
      h.feed(1, "down", 100, 200, 0);
      h.state.toolActive = true;
      h.feed(1, "move", 130, 200, 30);
      h.feed(1, "up", 130, 200, 60);
      expect(h.log).toEqual([]);
      expect(types(h.camera)).toContain("oneFingerDragMove");
    });

    it("a tap goes to the camera's handler and picks nothing", () => {
      const h = createHarness({ toolActive: false });
      h.feed(1, "down", 100, 200, 0);
      h.feed(1, "up", 100, 200, 50);
      expect(types(h.camera)).toEqual(["tap"]);
      expect(h.log).toEqual([]);
    });

    it("long press picks the block under the finger itself, then lift commits nothing", () => {
      const h = createHarness({ toolActive: false });
      h.feed(1, "down", 100, 200, 0);
      h.stepTime(450);
      expect(types(h.camera)).toEqual(["longPress"]);
      expect(h.log).toEqual(["pickAt 100,200"]);
      h.feed(1, "move", 180, 260, 600);
      h.feed(1, "up", 180, 260, 700);
      expect(h.log).toEqual(["pickAt 100,200"]);
      expect(types(h.camera)).toEqual(["longPress"]);
    });
  });

  it("without an editing side every gesture belongs to the camera and a long press does nothing else", () => {
    const h = createHarness({ noTarget: true });
    h.feed(1, "down", 100, 200, 0);
    expect(h.router.currentOwner).toBe("camera");
    h.stepTime(450);
    h.feed(1, "up", 100, 200, 500);
    expect(types(h.camera)).toEqual(["longPress"]);
    expect(h.log).toEqual([]);
  });

  it("reset cancels a stroke in progress and forgets every finger", () => {
    const h = createHarness();
    h.feed(1, "down", 100, 200, 0);
    h.feed(1, "move", 130, 200, 30);
    h.router.reset();
    expect(h.log.filter((l) => l === "cancel")).toHaveLength(1);
    expect(h.router.currentOwner).toBe("none");
    h.feed(1, "down", 100, 200, 100);
    expect(h.router.currentOwner).toBe("tool");
  });
});
