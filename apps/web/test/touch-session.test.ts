// SPDX-License-Identifier: AGPL-3.0-only

// The touch half of `EditSession` against a fake renderer. The fake camera looks straight down:
// a page point (x, y) is the ray from world (x / 10, 10, y / 10) pointing along -y, so the cell
// under the point is (floor(x / 10), ., floor(y / 10)). The floor is stone, 16 x 16 at y = 0, with a
// few other blocks to tell cells apart.

import {
  applyCommand,
  type Box,
  cloneVolume,
  copySelection,
  drawLine,
  drawRectangle,
  pasteClipboard,
  type Vec3,
  Volume,
} from "@voxwright/core";
import type { WebglRenderer } from "@voxwright/render/webgl";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { boxBetween, type ToolId } from "../src/lib/editing.ts";
import { EditSession } from "../src/lib/editor-session.svelte.ts";
import type { GestureIntent } from "../src/lib/gestures.ts";
import { TouchRouter } from "../src/lib/touch-router.ts";

const STONE = "minecraft:stone";
const PLANKS = "minecraft:oak_planks";
const GOLD = "minecraft:gold_block";
/** Where the finger is for a cursor over cell (3, 3): 64 px below, which is cell (3, 10). */
const FINGER = { x: 35, y: 100 };
const OFFSET = 64;

const frames: Array<() => void> = [];
const savedRaf = { raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame };

beforeEach(() => {
  frames.length = 0;
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    frames.push(() => cb(0));
    return frames.length;
  };
  globalThis.cancelAnimationFrame = (id: number): void => {
    frames[id - 1] = () => {};
  };
});

afterEach(() => {
  globalThis.requestAnimationFrame = savedRaf.raf;
  globalThis.cancelAnimationFrame = savedRaf.caf;
});

/** Run the animation frames that are waiting (the once-per-frame pick). */
const runFrames = (): void => {
  const due = frames.splice(0);
  for (const f of due) f();
};

function makeVolume(): Volume {
  const volume = new Volume();
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) volume.set(x, 0, z, STONE);
  volume.set(3, 0, 3, PLANKS); // under the cursor
  volume.set(3, 0, 10, GOLD); // under the finger
  return volume;
}

function makeSession(
  options: {
    overCanvas?: () => boolean;
    cursorOffsetPx?: number;
    confirmPlacement?: boolean;
    volume?: Volume;
  } = {},
) {
  const volume = options.volume ?? makeVolume();
  const highlights: unknown[][] = [];
  const renderer = {
    rayFromClient: (x: number, y: number) => ({
      origin: [x / 10, 10, y / 10] as [number, number, number],
      direction: [0, -1, 0] as [number, number, number],
    }),
    markDirty: () => {},
    highlight: (boxes: unknown[]) => {
      highlights.push(boxes);
    },
  } as unknown as WebglRenderer;
  const canvas = {
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
    }),
  } as unknown as HTMLCanvasElement;
  const session = new EditSession({
    renderer,
    canvas,
    volume,
    dataVersion: null,
    packBlocks: [],
    isOverCanvas: options.overCanvas ?? (() => true),
    cursorOffsetPx: options.cursorOffsetPx,
    confirmPlacement: options.confirmPlacement,
  });
  return { session, volume, highlights };
}

const cellsChanged = (volume: Volume, before: Map<string, string | undefined>): string[] => {
  const out: string[] = [];
  for (const [k, was] of before) {
    const [x, y, z] = k.split(",").map(Number) as [number, number, number];
    const now = volume.get(x, y, z);
    if ((now === "minecraft:air" ? undefined : now) !== (was === "minecraft:air" ? undefined : was))
      out.push(k);
  }
  return out;
};

/** The state of the cells in a box, to compare before and after. */
const snapshot = (volume: Volume): Map<string, string | undefined> => {
  const out = new Map<string, string | undefined>();
  for (let x = 0; x < 24; x++)
    for (let y = 0; y < 4; y++)
      for (let z = 0; z < 24; z++) out.set(`${x},${y},${z}`, volume.get(x, y, z));
  return out;
};

const arm = (session: EditSession, tool: ToolId): void => {
  session.setTool(tool);
  session.block = STONE;
};

describe("EditSession touch path", () => {
  it("only a touch tool in the orbit camera takes a finger", () => {
    const { session } = makeSession();
    // Paste needs something copied first.
    session.setSelection({ min: [0, 0, 0], max: [1, 0, 1] });
    session.copy();
    for (const tool of [
      "place",
      "paint",
      "erase",
      "eyedropper",
      "line",
      "rectangle",
      "select",
      "paste",
    ] as const) {
      session.setTool(tool);
      expect(session.tool, tool).toBe(tool);
      expect(session.touchToolActive, tool).toBe(true);
    }
    session.setTool("navigate");
    expect(session.touchToolActive, "navigate").toBe(false);
    session.setTool("place");
    session.setCameraMode("fly");
    expect(session.touchToolActive).toBe(false);
  });

  describe("the cursor", () => {
    it("is drawn OFFSET px above the finger, with the cell under it as the hover", () => {
      const { session } = makeSession();
      arm(session, "place");
      expect(session.touchMove(FINGER.x, FINGER.y)).toBe(true);
      runFrames();
      expect(session.reticle).not.toBeNull();
      expect(session.reticle).toMatchObject({
        active: true,
        touchX: FINGER.x,
        touchY: FINGER.y,
        reticleX: FINGER.x,
        reticleY: FINGER.y - OFFSET,
      });
      expect(session.reticle?.hit?.position).toEqual([3, 0, 3]);
      expect(session.hover?.position).toEqual([3, 0, 3]);
      expect(session.hover?.adjacent).toEqual([3, 1, 3]);
      expect(session.inspected).toEqual([3, 0, 3]);
    });

    it("picks once per animation frame, however many moves arrive", () => {
      const { session } = makeSession();
      arm(session, "place");
      session.touchMove(35, 100);
      session.touchMove(45, 100);
      session.touchMove(55, 100);
      expect(frames).toHaveLength(1);
      runFrames();
      expect(session.reticle?.reticleX).toBe(55);
    });

    it("is gone, with the hover, when the gesture ends", () => {
      const { session, highlights } = makeSession();
      arm(session, "place");
      session.touchMove(FINGER.x, FINGER.y);
      runFrames();
      expect(session.hover).not.toBeNull();
      session.touchEnd();
      expect(session.reticle).toBeNull();
      expect(session.hover).toBeNull();
      // No ghost block or hover outline is left in the picture.
      const last = highlights.at(-1) as Array<{ style: string }>;
      expect(last.some((b) => b.style === "ghost")).toBe(false);
    });
  });

  describe("tap", () => {
    it("Place puts the block at the cell under the cursor, not under the finger, as one undo step", () => {
      const { session, volume } = makeSession();
      arm(session, "place");
      const before = snapshot(volume);
      session.touchMove(FINGER.x, FINGER.y);
      session.touchTap(FINGER.x, FINGER.y);
      expect(cellsChanged(volume, before)).toEqual(["3,1,3"]);
      expect(volume.get(3, 1, 3)).toBe(STONE);
      expect(volume.get(3, 1, 10)).not.toBe(STONE);
      expect(session.undoCount).toBe(1);
      expect(session.canUndo).toBe(true);
      expect(session.message).toBe("place done");
      expect(session.message).not.toMatch(/ctrl/i);
      expect(session.reticle).toBeNull();
      session.undo();
      expect(cellsChanged(volume, before)).toEqual([]);
    });

    it("Replace turns the block under the cursor into the chosen one", () => {
      const { session, volume } = makeSession();
      arm(session, "paint");
      session.block = GOLD;
      const before = snapshot(volume);
      session.touchMove(FINGER.x, FINGER.y);
      session.touchTap(FINGER.x, FINGER.y);
      expect(cellsChanged(volume, before)).toEqual(["3,0,3"]);
      expect(volume.get(3, 0, 3)).toBe(GOLD);
      expect(session.undoCount).toBe(1);
      expect(session.message).toBe("replace block done");
    });

    it("Erase removes the block under the cursor", () => {
      const { session, volume } = makeSession();
      arm(session, "erase");
      const before = snapshot(volume);
      session.touchMove(FINGER.x, FINGER.y);
      session.touchTap(FINGER.x, FINGER.y);
      expect(cellsChanged(volume, before)).toEqual(["3,0,3"]);
      expect(session.undoCount).toBe(1);
      expect(session.message).toBe("erase done");
    });

    it("Pick chooses the block under the cursor and switches to Place, as a click does", () => {
      const { session, volume } = makeSession();
      arm(session, "eyedropper");
      session.touchMove(FINGER.x, FINGER.y);
      session.touchTap(FINGER.x, FINGER.y);
      expect(session.block).toBe(PLANKS);
      expect(session.tool).toBe("place");
      expect(session.message).toBe(`Picked ${PLANKS}`);
      expect(session.undoCount).toBe(0);
      expect(volume.get(3, 0, 3)).toBe(PLANKS);
    });

    it("with nothing under the cursor changes nothing", () => {
      const { session, volume } = makeSession();
      arm(session, "place");
      const before = snapshot(volume);
      // Cursor over cell (3, 3) of an empty column far above: aim at x = 18, past the floor.
      session.touchMove(185, 100);
      session.touchTap(185, 100);
      expect(cellsChanged(volume, before)).toEqual([]);
      expect(session.undoCount).toBe(0);
    });
  });

  describe("stroke", () => {
    it("begins at the finger-down cell, extends along the surface, and is one undo step", () => {
      const { session, volume } = makeSession();
      arm(session, "place");
      const before = snapshot(volume);

      session.touchMove(FINGER.x, FINGER.y);
      session.touchStrokeBegin(FINGER.x, FINGER.y);
      // The stroke has its first cell at once, from the finger-down point.
      expect(cellsChanged(volume, before)).toEqual(["3,1,3"]);

      for (const x of [45, 55, 65, 75]) {
        session.touchMove(x, FINGER.y);
        runFrames();
      }
      session.touchStrokeEnd(75, FINGER.y);
      session.touchEnd();

      expect(cellsChanged(volume, before).sort()).toEqual([
        "3,1,3",
        "4,1,3",
        "5,1,3",
        "6,1,3",
        "7,1,3",
      ]);
      // Nothing under the finger was touched.
      expect(volume.get(3, 1, 10)).not.toBe(STONE);
      expect(session.undoCount).toBe(1);
      expect(session.message).toBe("place done");
      expect(session.reticle).toBeNull();

      session.undo();
      expect(cellsChanged(volume, before)).toEqual([]);
      expect(session.canUndo).toBe(false);
    });

    it("fills the gap when the finger jumps between frames", () => {
      const { session, volume } = makeSession();
      arm(session, "place");
      const before = snapshot(volume);
      session.touchMove(FINGER.x, FINGER.y);
      session.touchStrokeBegin(FINGER.x, FINGER.y);
      session.touchMove(95, FINGER.y);
      session.touchStrokeEnd(95, FINGER.y); // lifts before any frame ran: the end flushes the last position
      expect(cellsChanged(volume, before)).toHaveLength(7); // x = 3..9
      expect(session.undoCount).toBe(1);
    });

    it("Erase drags clear cells along the surface", () => {
      const { session, volume } = makeSession();
      arm(session, "erase");
      const before = snapshot(volume);
      session.touchMove(FINGER.x, FINGER.y);
      session.touchStrokeBegin(FINGER.x, FINGER.y);
      session.touchMove(65, FINGER.y);
      runFrames();
      session.touchStrokeEnd(65, FINGER.y);
      session.touchEnd();
      expect(cellsChanged(volume, before)).toHaveLength(4); // x = 3..6 on z = 3
      expect(session.undoCount).toBe(1);
    });

    it("the Pick tool's drag only moves the cursor: no edit, and lifting does nothing", () => {
      const { session, volume } = makeSession();
      arm(session, "eyedropper");
      const before = snapshot(volume);
      session.touchMove(FINGER.x, FINGER.y);
      session.touchStrokeBegin(FINGER.x, FINGER.y);
      session.touchMove(75, FINGER.y);
      runFrames();
      expect(session.reticle?.reticleX).toBe(75);
      session.touchStrokeEnd(75, FINGER.y);
      session.touchEnd();
      expect(cellsChanged(volume, before)).toEqual([]);
      expect(session.undoCount).toBe(0);
      expect(session.tool).toBe("eyedropper");
      expect(session.block).toBe(STONE);
    });

    it("cancelling mid-stroke leaves the volume and the history as they were", () => {
      const { session, volume } = makeSession();
      arm(session, "place");
      const before = snapshot(volume);
      session.touchMove(FINGER.x, FINGER.y);
      session.touchStrokeBegin(FINGER.x, FINGER.y);
      session.touchMove(75, FINGER.y);
      runFrames();
      expect(cellsChanged(volume, before).length).toBeGreaterThan(1);

      session.touchCancel();

      expect(cellsChanged(volume, before)).toEqual([]);
      expect(session.undoCount).toBe(0);
      expect(session.canUndo).toBe(false);
      expect(session.reticle).toBeNull();
      expect(session.hover).toBeNull();
      // A lift that follows (the router would not send it) cannot commit anything.
      session.touchStrokeEnd(75, FINGER.y);
      expect(cellsChanged(volume, before)).toEqual([]);
      expect(session.undoCount).toBe(0);
    });

    it("an Undo from the thumb cluster during a stroke reverts it, and the lift adds nothing", () => {
      const { session, volume } = makeSession();
      arm(session, "place");
      const before = snapshot(volume);
      session.touchMove(FINGER.x, FINGER.y);
      session.touchStrokeBegin(FINGER.x, FINGER.y);
      session.undo();
      session.touchStrokeEnd(FINGER.x, FINGER.y);
      expect(cellsChanged(volume, before)).toEqual([]);
      expect(session.undoCount).toBe(0);
    });
  });

  describe("leaving the canvas", () => {
    it("the cursor leaving the canvas rectangle cancels the stroke", () => {
      const { session, volume } = makeSession();
      arm(session, "place");
      const before = snapshot(volume);
      session.touchMove(FINGER.x, FINGER.y);
      session.touchStrokeBegin(FINGER.x, FINGER.y);
      // The cursor is OFFSET above the finger: a finger at y = 30 puts it at y = -34, off the top.
      expect(session.touchMove(75, 30)).toBe(false);
      expect(cellsChanged(volume, before)).toEqual([]);
      expect(session.undoCount).toBe(0);
      expect(session.reticle).toBeNull();
    });

    it("the finger no longer over the canvas (a toolbar on top of it) cancels the stroke", () => {
      let over = true;
      const { session, volume } = makeSession({ overCanvas: () => over });
      arm(session, "place");
      const before = snapshot(volume);
      session.touchMove(FINGER.x, FINGER.y);
      session.touchStrokeBegin(FINGER.x, FINGER.y);
      session.touchMove(55, FINGER.y);
      runFrames();
      over = false;
      expect(session.touchMove(65, FINGER.y)).toBe(false);
      expect(cellsChanged(volume, before)).toEqual([]);
      expect(session.undoCount).toBe(0);
    });

    it("lifting off the canvas does not commit", () => {
      let over = true;
      const { session, volume } = makeSession({ overCanvas: () => over });
      arm(session, "place");
      const before = snapshot(volume);
      session.touchMove(FINGER.x, FINGER.y);
      session.touchStrokeBegin(FINGER.x, FINGER.y);
      over = false;
      session.touchStrokeEnd(65, FINGER.y);
      expect(cellsChanged(volume, before)).toEqual([]);
      expect(session.undoCount).toBe(0);
    });
  });

  describe("long press", () => {
    it("with a touch tool picks the block under the cursor and keeps the tool", () => {
      const { session, volume } = makeSession();
      arm(session, "place");
      const before = snapshot(volume);
      session.touchMove(FINGER.x, FINGER.y);
      session.touchLongPress(FINGER.x, FINGER.y);
      expect(session.block).toBe(PLANKS); // the cell under the cursor, not the gold under the finger
      expect(session.tool).toBe("place");
      expect(session.message).toBe(`Picked ${PLANKS}`);
      expect(session.reticle).toBeNull();
      expect(session.hover).toBeNull();
      expect(cellsChanged(volume, before)).toEqual([]);
      expect(session.undoCount).toBe(0);
    });

    it("with Replace and Erase also keeps the tool", () => {
      for (const tool of ["paint", "erase"] as const) {
        const { session } = makeSession();
        arm(session, tool);
        session.touchMove(FINGER.x, FINGER.y);
        session.touchLongPress(FINGER.x, FINGER.y);
        expect(session.block, tool).toBe(PLANKS);
        expect(session.tool, tool).toBe(tool);
      }
    });

    it("with the Pick tool does what its tap does", () => {
      const { session } = makeSession();
      arm(session, "eyedropper");
      session.touchMove(FINGER.x, FINGER.y);
      session.touchLongPress(FINGER.x, FINGER.y);
      expect(session.block).toBe(PLANKS);
      expect(session.tool).toBe("place");
    });

    it("while the camera owns the gesture picks the block under the finger itself", () => {
      const { session } = makeSession();
      session.setTool("navigate");
      session.touchPickAt(35, 100); // the gold, under the finger
      expect(session.block).toBe(GOLD);
      expect(session.tool).toBe("navigate");
      expect(session.message).toBe(`Picked ${GOLD}`);
      session.setTool("line");
      session.touchPickAt(35, 36);
      expect(session.block).toBe(PLANKS);
      expect(session.tool).toBe("line");
    });

    it("does not pick in the fly camera", () => {
      const { session } = makeSession();
      session.setCameraMode("fly");
      session.touchPickAt(35, 100);
      expect(session.block).toBe(STONE);
    });
  });

  describe("tool or camera changed under a finger", () => {
    it("a move after the tool was changed to a camera tool ends the gesture", () => {
      const { session } = makeSession();
      arm(session, "place");
      session.touchMove(FINGER.x, FINGER.y);
      runFrames();
      session.setTool("navigate");
      expect(session.touchMove(45, FINGER.y)).toBe(false);
      expect(session.reticle).toBeNull();
    });
  });

  describe("the session's own listeners ignore touch pointers", () => {
    // The page's listeners call these with real events; here, a finger's events by hand.
    const handlers = (s: EditSession) =>
      s as unknown as {
        onPointerMove(e: unknown): void;
        onPointerUp(e: unknown): void;
        onPointerLeave(e: unknown): void;
      };
    const finger = (x: number, y: number) => ({
      pointerType: "touch",
      pointerId: 1,
      clientX: x,
      clientY: y,
      buttons: 1,
    });

    it("a finger's move does not set the hover pointer", () => {
      const { session } = makeSession();
      arm(session, "place");
      handlers(session).onPointerMove(finger(35, 36));
      expect(frames).toHaveLength(0); // nothing was scheduled
      runFrames();
      expect(session.hover).toBeNull();
    });

    it("a finger's lift, cancel or leave does not end a stroke, clear the hover, or drop the cursor", () => {
      const { session, volume } = makeSession();
      arm(session, "place");
      const before = snapshot(volume);
      session.touchMove(FINGER.x, FINGER.y);
      session.touchStrokeBegin(FINGER.x, FINGER.y);
      runFrames();
      const hover = session.hover;
      handlers(session).onPointerUp(finger(35, 36));
      handlers(session).onPointerLeave(finger(35, 36));
      expect(session.undoCount).toBe(0); // the stroke is still open
      expect(session.hover).toBe(hover);
      expect(cellsChanged(volume, before)).toEqual(["3,1,3"]);
      session.touchCancel();
      expect(cellsChanged(volume, before)).toEqual([]);
    });
  });
});

describe("the cursor distance", () => {
  it("is 64 px unless the session is made with another", () => {
    expect(makeSession().session.cursorOffsetPx).toBe(64);
    expect(makeSession({ cursorOffsetPx: 24 }).session.cursorOffsetPx).toBe(24);
  });

  it("0: a tap places on the cell under the finger", () => {
    const { session, volume } = makeSession();
    arm(session, "place");
    session.cursorOffsetPx = 0;
    const before = snapshot(volume);
    session.touchMove(FINGER.x, FINGER.y);
    session.touchTap(FINGER.x, FINGER.y);
    // The finger is over cell (3, 10), which holds the gold block; the block goes on top of it.
    expect(cellsChanged(volume, before)).toEqual(["3,1,10"]);
    expect(volume.get(3, 1, 3)).not.toBe(STONE);
  });

  it("128: a tap places on the cell 128 px above the finger", () => {
    const { session, volume } = makeSession();
    arm(session, "place");
    session.cursorOffsetPx = 128;
    const before = snapshot(volume);
    session.touchMove(35, 150);
    session.touchTap(35, 150);
    // 150 - 128 = 22 px: cell row 2.
    expect(cellsChanged(volume, before)).toEqual(["3,1,2"]);
  });

  it("applies to the next touch at once, in the picks and in the drawn cursor", () => {
    const { session } = makeSession();
    arm(session, "place");
    session.touchMove(FINGER.x, FINGER.y);
    runFrames();
    expect(session.reticle).toMatchObject({ reticleY: FINGER.y - 64 });
    expect(session.hover?.position).toEqual([3, 0, 3]);

    session.cursorOffsetPx = 32;
    session.touchMove(FINGER.x, FINGER.y);
    runFrames();
    expect(session.reticle).toMatchObject({ touchY: FINGER.y, reticleY: FINGER.y - 32 });
    expect(session.hover?.position).toEqual([3, 0, 6]);

    session.cursorOffsetPx = 0;
    session.touchMove(FINGER.x, FINGER.y);
    runFrames();
    expect(session.reticle).toMatchObject({ touchY: FINGER.y, reticleY: FINGER.y });
    expect(session.hover?.position).toEqual([3, 0, 10]);
  });

  it("a long press and a stroke use it too", () => {
    const { session, volume } = makeSession();
    arm(session, "place");
    session.cursorOffsetPx = 0;
    session.touchMove(FINGER.x, FINGER.y);
    session.touchLongPress(FINGER.x, FINGER.y);
    expect(session.block).toBe(GOLD); // the block under the finger itself

    session.block = STONE;
    const before = snapshot(volume);
    session.touchMove(FINGER.x, FINGER.y);
    session.touchStrokeBegin(FINGER.x, FINGER.y);
    session.touchMove(55, FINGER.y);
    runFrames();
    session.touchStrokeEnd(55, FINGER.y);
    session.touchEnd();
    expect(cellsChanged(volume, before).sort()).toEqual(["3,1,10", "4,1,10", "5,1,10"]);
  });

  it("is checked against the canvas edge: 0 lets the finger reach the top row, 128 does not", () => {
    const { session } = makeSession();
    arm(session, "place");
    session.cursorOffsetPx = 0;
    expect(session.touchMove(35, 5)).toBe(true);
    session.touchEnd();
    session.cursorOffsetPx = 128;
    expect(session.touchMove(35, 100)).toBe(false); // the cursor would be at y = -28
  });
});

describe("a finger left down after a second finger lifts (router and session together)", () => {
  /** The router wired to the session as the page does it, with the camera's share collected. */
  function wire() {
    const made = makeSession();
    const camera: GestureIntent[] = [];
    const router = new TouchRouter({
      target: () => made.session,
      camera: (i) => camera.push(i),
      arbiter: {
        setTimeout: () => 0 as unknown as ReturnType<typeof setTimeout>,
        clearTimeout() {},
      },
    });
    const feed = (id: number, type: "down" | "move" | "up", x: number, y: number, time: number) =>
      router.feed({ id, type, x, y, time });
    return { ...made, camera, router, feed };
  }

  it("Place armed: the leftover finger orbits, nothing is painted, and no cursor or hover is left", () => {
    const h = wire();
    arm(h.session, "place");
    const before = snapshot(h.volume);

    h.feed(1, "down", FINGER.x, FINGER.y, 0);
    runFrames();
    expect(h.session.reticle).not.toBeNull(); // the tool owns the gesture so far
    h.feed(2, "down", 135, 100, 20); // a second finger: the camera takes over
    expect(h.session.reticle).toBeNull();
    h.feed(1, "move", 35, 110, 100);
    h.feed(2, "move", 135, 110, 100);
    h.feed(2, "up", 135, 110, 200);

    const cameraSeen = h.camera.length;
    h.router.stepTime(5000); // held still: no long press, so no pick
    h.feed(1, "move", 40, 120, 5100);
    runFrames();
    h.feed(1, "move", 55, 140, 5150);
    h.feed(1, "up", 55, 140, 5200);
    runFrames();

    expect(h.camera.slice(cameraSeen)).toEqual([
      { type: "oneFingerDragStart", clientX: 35, clientY: 110 },
      { type: "oneFingerDragMove", clientX: 40, clientY: 120, dx: 5, dy: 10 },
      { type: "oneFingerDragMove", clientX: 55, clientY: 140, dx: 15, dy: 20 },
      { type: "oneFingerDragEnd", clientX: 55, clientY: 140 },
    ]);
    expect(cellsChanged(h.volume, before)).toEqual([]);
    expect(h.session.undoCount).toBe(0);
    expect(h.session.canUndo).toBe(false);
    expect(h.session.reticle).toBeNull();
    expect(h.session.hover).toBeNull();
    expect(h.session.block).toBe(STONE); // no pick changed the block
  });

  it("mid-stroke: the stroke is reverted, then the leftover finger orbits and the volume stays as it was", () => {
    const h = wire();
    arm(h.session, "place");
    const before = snapshot(h.volume);

    h.feed(1, "down", FINGER.x, FINGER.y, 0);
    h.feed(1, "move", 55, FINGER.y, 30);
    h.feed(1, "move", 75, FINGER.y, 60);
    runFrames();
    expect(cellsChanged(h.volume, before).length).toBeGreaterThan(0); // the stroke is on screen
    h.feed(2, "down", 135, 100, 80);
    expect(cellsChanged(h.volume, before)).toEqual([]); // reverted

    h.feed(1, "move", 75, 110, 150);
    h.feed(2, "move", 135, 110, 150);
    h.feed(2, "up", 135, 110, 250);
    const cameraSeen = h.camera.length;
    h.feed(1, "move", 80, 112, 300);
    h.feed(1, "move", 90, 120, 330);
    h.feed(1, "up", 90, 120, 360);
    runFrames();

    expect(h.camera.slice(cameraSeen).map((i) => i.type)).toEqual([
      "oneFingerDragStart",
      "oneFingerDragMove",
      "oneFingerDragMove",
      "oneFingerDragEnd",
    ]);
    expect(cellsChanged(h.volume, before)).toEqual([]);
    expect(h.session.undoCount).toBe(0);
    expect(h.session.reticle).toBeNull();
  });

  it("a finger landing again while the leftover finger is down is a two-finger gesture again, still without painting", () => {
    const h = wire();
    arm(h.session, "place");
    const before = snapshot(h.volume);
    h.feed(1, "down", FINGER.x, FINGER.y, 0);
    h.feed(2, "down", 135, 100, 20);
    h.feed(1, "move", 35, 120, 400);
    h.feed(2, "move", 135, 120, 400);
    h.feed(2, "up", 135, 120, 450);
    h.feed(1, "move", 40, 125, 500); // orbit
    const cameraSeen = h.camera.length;
    h.feed(3, "down", 135, 125, 550);
    h.feed(1, "move", 40, 150, 600);
    h.feed(3, "move", 135, 150, 600);
    expect(h.camera.slice(cameraSeen).map((i) => i.type)).toEqual(["cancel", "twoFingerPan"]);
    h.feed(3, "up", 135, 150, 650);
    h.feed(1, "up", 40, 150, 700);
    runFrames();
    expect(cellsChanged(h.volume, before)).toEqual([]);
    expect(h.session.undoCount).toBe(0);
  });
});

// -- MB5: pending edits -----------------------------------------------------------------------------

/** Where a finger goes so that the cursor is over the middle of cell (cx, cz) of the floor. */
const fingerFor = (cx: number, cz: number): { x: number; y: number } => ({
  x: cx * 10 + 5,
  y: cz * 10 + 5 + OFFSET,
});

/** A tap with the finger placed for cell (cx, cz): the cursor shows, the finger lifts. */
function tapCell(session: EditSession, cx: number, cz: number): void {
  const f = fingerFor(cx, cz);
  session.touchMove(f.x, f.y);
  runFrames();
  session.touchTap(f.x, f.y);
  session.touchEnd();
}

/** A drag of the finger, one cursor move per frame, lifted over the last cell. */
function dragCells(session: EditSession, path: Array<[number, number]>): void {
  const [first, ...rest] = path as [[number, number], ...Array<[number, number]>];
  const start = fingerFor(first[0], first[1]);
  session.touchMove(start.x, start.y);
  session.touchStrokeBegin(start.x, start.y);
  let last = start;
  for (const [cx, cz] of rest) {
    last = fingerFor(cx, cz);
    session.touchMove(last.x, last.y);
    runFrames();
  }
  session.touchStrokeEnd(last.x, last.y);
  session.touchEnd();
}

/** The reference: the same edit made by core's builder on a copy of the volume. */
function reference(volume: Volume, build: (copy: Volume) => ReturnType<typeof drawLine>): Volume {
  const copy = cloneVolume(volume);
  applyCommand(copy, build(copy));
  return copy;
}

describe("two-corner tools: Line, Rectangle, Select", () => {
  describe("Line", () => {
    it("two taps and confirm equal drawLine for those corners, as one undo step", () => {
      const { session, volume } = makeSession();
      arm(session, "line");
      const before = snapshot(volume);
      const expected = reference(volume, (v) => drawLine(v, [2, 1, 2], [2, 1, 8], STONE));

      tapCell(session, 2, 2);
      expect(session.pending).toMatchObject({ kind: "line", a: [2, 1, 2], b: null, active: "a" });
      expect(cellsChanged(volume, before)).toEqual([]); // a tap changes nothing
      tapCell(session, 2, 8);
      expect(session.pending).toMatchObject({ a: [2, 1, 2], b: [2, 1, 8], active: "b" });
      expect(cellsChanged(volume, before)).toEqual([]);
      expect(session.undoCount).toBe(0);

      expect(session.confirmPending()).toBe(true);
      expect(snapshot(volume)).toEqual(snapshot(expected));
      expect(cellsChanged(volume, before)).toHaveLength(7);
      expect(session.pending).toBeNull();
      expect(session.undoCount).toBe(1);
      expect(session.message).toBe("line: 7 blocks changed");

      session.undo();
      expect(cellsChanged(volume, before)).toEqual([]);
      expect(session.canUndo).toBe(false);
    });

    it("the first tap uses the cell next to the face, as the mouse's press does", () => {
      const { session } = makeSession();
      arm(session, "line");
      tapCell(session, 3, 3); // the planks: the corner is the cell on top of them
      expect(session.pending).toMatchObject({ a: [3, 1, 3] });
    });

    it("confirm with only A set draws one block (B = A)", () => {
      const { session, volume } = makeSession();
      arm(session, "line");
      const before = snapshot(volume);
      tapCell(session, 5, 5);
      expect(session.confirmPending()).toBe(true);
      expect(cellsChanged(volume, before)).toEqual(["5,1,5"]);
      expect(session.undoCount).toBe(1);
    });

    it("nudging B by one along the line makes it exactly one cell longer, as the builder says", () => {
      const { session, volume } = makeSession();
      arm(session, "line");
      const before = snapshot(volume);
      tapCell(session, 2, 2);
      tapCell(session, 2, 8);
      expect(session.nudge(2, 1)).toBe(true);
      expect(session.pending).toMatchObject({ a: [2, 1, 2], b: [2, 1, 9], active: "b" });
      expect(session.message).toBe("Corner B moved to 2, 1, 9");
      const expected = reference(volume, (v) => drawLine(v, [2, 1, 2], [2, 1, 9], STONE));
      session.confirmPending();
      expect(snapshot(volume)).toEqual(snapshot(expected));
      expect(cellsChanged(volume, before)).toHaveLength(8); // 7 + 1
      expect(session.undoCount).toBe(1);
    });

    it("nudging the other corner moves A only; the A/B choice sticks", () => {
      const { session } = makeSession();
      arm(session, "line");
      tapCell(session, 2, 2);
      tapCell(session, 2, 8);
      session.setActiveCorner("a");
      expect(session.pending).toMatchObject({ active: "a" });
      session.nudge(0, 1);
      expect(session.pending).toMatchObject({ a: [3, 1, 2], b: [2, 1, 8], active: "a" });
      session.setActiveCorner("b");
      session.nudge(1, 1);
      expect(session.pending).toMatchObject({ a: [3, 1, 2], b: [2, 2, 8], active: "b" });
    });

    it("switching to B before B exists copies A", () => {
      const { session } = makeSession();
      arm(session, "line");
      tapCell(session, 2, 2);
      session.setActiveCorner("b");
      expect(session.pending).toMatchObject({ a: [2, 1, 2], b: [2, 1, 2], active: "b" });
      session.nudge(2, 1);
      session.nudge(2, 1);
      expect(session.pending).toMatchObject({ a: [2, 1, 2], b: [2, 1, 4], active: "b" });
    });

    it("later taps move the active corner", () => {
      const { session } = makeSession();
      arm(session, "line");
      tapCell(session, 2, 2);
      tapCell(session, 2, 8);
      tapCell(session, 6, 8); // B moves
      expect(session.pending).toMatchObject({ a: [2, 1, 2], b: [6, 1, 8], active: "b" });
      session.setActiveCorner("a");
      tapCell(session, 1, 1);
      expect(session.pending).toMatchObject({ a: [1, 1, 1], b: [6, 1, 8], active: "a" });
    });

    it("a tap over nothing leaves the pending value alone", () => {
      const { session } = makeSession();
      arm(session, "line");
      tapCell(session, 2, 2);
      tapCell(session, 19, 19); // off the floor
      expect(session.pending).toMatchObject({ a: [2, 1, 2], b: null });
    });

    it("cancel changes nothing", () => {
      const { session, volume } = makeSession();
      arm(session, "line");
      const before = snapshot(volume);
      tapCell(session, 2, 2);
      tapCell(session, 2, 8);
      session.cancelPending();
      expect(session.pending).toBeNull();
      expect(cellsChanged(volume, before)).toEqual([]);
      expect(session.undoCount).toBe(0);
      expect(session.message).toBe("Cancelled");
      expect(session.confirmPending()).toBe(false); // nothing left to confirm
    });

    it("an invalid block fails at the first tap, before anything is armed", () => {
      const { session } = makeSession();
      arm(session, "line");
      session.block = "not a block[";
      tapCell(session, 2, 2);
      expect(session.pending).toBeNull();
      expect(session.error).not.toBe("");
    });

    it("the outline: the box between the corners as a ghost, the active corner in the hover colour", () => {
      const { session, highlights } = makeSession();
      arm(session, "line");
      tapCell(session, 2, 2);
      tapCell(session, 2, 8);
      const last = highlights.at(-1) as Array<{ min: Vec3; max: Vec3; style: string }>;
      expect(last).toContainEqual({ min: [2, 1, 2], max: [2, 1, 8], style: "ghost" });
      expect(last).toContainEqual({ min: [2, 1, 8], max: [2, 1, 8], style: "hover" });
      expect(last).toContainEqual({ min: [2, 1, 2], max: [2, 1, 2], style: "selection" });
    });
  });

  describe("Rectangle", () => {
    for (const hollow of [false, true]) {
      it(`${hollow ? "hollow" : "filled"}: two taps and confirm equal drawRectangle, B over empty space`, () => {
        const { session, volume } = makeSession();
        arm(session, "rectangle");
        session.hollow = hollow;
        const before = snapshot(volume);
        // B at cell (17, 9) is off the floor: the ray meets the corner's plane over nothing.
        const expected = reference(volume, (v) =>
          drawRectangle(v, [2, 1, 2], [17, 1, 9], STONE, { normal: "y", hollow }),
        );
        tapCell(session, 2, 2);
        expect(session.pending).toMatchObject({ kind: "rectangle", a: [2, 1, 2], axis: 1, at: 0 });
        tapCell(session, 17, 9);
        expect(session.pending).toMatchObject({ a: [2, 1, 2], b: [17, 1, 9], active: "b" });
        expect(cellsChanged(volume, before)).toEqual([]);
        session.confirmPending();
        expect(snapshot(volume)).toEqual(snapshot(expected));
        expect(cellsChanged(volume, before)).toHaveLength(hollow ? 2 * 16 + 2 * 6 : 16 * 8);
        expect(session.undoCount).toBe(1);
        expect(session.message).toBe(
          `${hollow ? "hollow rectangle" : "rectangle"}: ${hollow ? 2 * 16 + 2 * 6 : 16 * 8} blocks changed`,
        );
        session.undo();
        expect(cellsChanged(volume, before)).toEqual([]);
      });
    }

    it("a hollow 4 x 3 rectangle is its outline: 10 blocks", () => {
      const { session, volume } = makeSession();
      arm(session, "rectangle");
      session.hollow = true;
      const before = snapshot(volume);
      tapCell(session, 4, 4);
      tapCell(session, 7, 6);
      session.confirmPending();
      expect(cellsChanged(volume, before).sort()).toEqual(
        [
          "4,1,4",
          "5,1,4",
          "6,1,4",
          "7,1,4",
          "4,1,5",
          "7,1,5",
          "4,1,6",
          "5,1,6",
          "6,1,6",
          "7,1,6",
        ].sort(),
      );
    });

    it("nudging along the normal moves the whole rectangle one layer; the other axes move one corner", () => {
      const { session, volume } = makeSession();
      arm(session, "rectangle");
      const before = snapshot(volume);
      tapCell(session, 4, 4);
      tapCell(session, 7, 6);
      expect(session.nudge(1, 1)).toBe(true);
      expect(session.pending).toMatchObject({ a: [4, 2, 4], b: [7, 2, 6], active: "b" });
      expect(session.message).toBe("Rectangle moved to y 2");
      expect(session.nudge(0, 1)).toBe(true);
      expect(session.pending).toMatchObject({ a: [4, 2, 4], b: [8, 2, 6] });
      const expected = reference(volume, (v) =>
        drawRectangle(v, [4, 2, 4], [8, 2, 6], STONE, { normal: "y" }),
      );
      session.confirmPending();
      expect(snapshot(volume)).toEqual(snapshot(expected));
      expect(cellsChanged(volume, before)).toHaveLength(15);
      // Every drawn block is on layer 2, none on layer 1.
      expect(cellsChanged(volume, before).every((k) => k.split(",")[1] === "2")).toBe(true);
    });

    it("nudging a corner by one along the sheet changes the result by exactly one row of cells", () => {
      const { session, volume } = makeSession();
      arm(session, "rectangle");
      const before = snapshot(volume);
      tapCell(session, 4, 4);
      tapCell(session, 7, 6);
      session.nudge(0, 1); // 4 wide becomes 5
      session.confirmPending();
      expect(cellsChanged(volume, before)).toHaveLength(15); // 5 x 3 instead of 4 x 3
    });

    it("confirm with only A set draws one block", () => {
      const { session, volume } = makeSession();
      arm(session, "rectangle");
      const before = snapshot(volume);
      tapCell(session, 4, 4);
      session.confirmPending();
      expect(cellsChanged(volume, before)).toEqual(["4,1,4"]);
    });

    it("a rectangle keeps its plane: later taps and the drag move a corner inside it", () => {
      const { session } = makeSession();
      arm(session, "rectangle");
      tapCell(session, 4, 4);
      tapCell(session, 7, 6);
      tapCell(session, 3, 3); // over the planks' top face, but the plane stays y = 1
      expect(session.pending).toMatchObject({ a: [4, 1, 4], b: [3, 1, 3] });
      session.setActiveCorner("a");
      tapCell(session, 9, 9);
      expect(session.pending).toMatchObject({ a: [9, 1, 9], b: [3, 1, 3], active: "a" });
    });

    it("refuses a layer outside the visible layers", () => {
      const { session } = makeSession();
      arm(session, "rectangle");
      session.setSlice({ y0: 0, y1: 1 });
      tapCell(session, 4, 4);
      tapCell(session, 7, 6);
      expect(session.nudge(1, 1)).toBe(false);
      expect(session.error).toMatch(/Layer 2 is outside the visible layers 0 to 1/);
      expect(session.pending).toMatchObject({ a: [4, 1, 4], b: [7, 1, 6] });
    });
  });

  describe("Select", () => {
    it("two taps and confirm equal boxBetween, announce the size, and are no undo step", () => {
      const { session, volume } = makeSession();
      arm(session, "select");
      const before = snapshot(volume);
      tapCell(session, 2, 2);
      expect(session.pending).toMatchObject({ kind: "select", a: [2, 0, 2], b: null });
      tapCell(session, 6, 8);
      expect(session.pending).toMatchObject({ a: [2, 0, 2], b: [6, 0, 8], active: "b" });
      // The selection is drawn while the corners are being set.
      expect(session.selection).toEqual(boxBetween([2, 0, 2], [6, 0, 8]));
      session.confirmPending();
      expect(session.selection).toEqual(boxBetween([2, 0, 2], [6, 0, 8]));
      expect(session.message).toBe("Selected 5 × 1 × 7");
      expect(session.pending).toBeNull();
      expect(session.undoCount).toBe(0);
      expect(cellsChanged(volume, before)).toEqual([]);
    });

    it("uses the block under the cursor, not the cell next to it", () => {
      const { session } = makeSession();
      arm(session, "select");
      tapCell(session, 3, 3);
      expect(session.pending).toMatchObject({ a: [3, 0, 3] });
    });

    it("nudging a corner changes the selection by exactly one row of cells", () => {
      const { session } = makeSession();
      arm(session, "select");
      tapCell(session, 2, 2);
      tapCell(session, 6, 8);
      session.nudge(0, 1);
      expect(session.selection).toEqual(boxBetween([2, 0, 2], [7, 0, 8]));
      session.nudge(1, 1); // up: a 6 x 2 x 7 box now
      expect(session.selection).toEqual(boxBetween([2, 0, 2], [7, 1, 8]));
      session.confirmPending();
      expect(session.message).toBe("Selected 6 × 2 × 7");
    });

    it("confirm with only A set selects one block", () => {
      const { session } = makeSession();
      arm(session, "select");
      tapCell(session, 5, 5);
      session.confirmPending();
      expect(session.selection).toEqual(boxBetween([5, 0, 5], [5, 0, 5]));
      expect(session.message).toBe("Selected 1 × 1 × 1");
    });

    it("cancel puts back the selection that existed before corner A", () => {
      const { session } = makeSession();
      const earlier = boxBetween([0, 0, 0], [1, 0, 1]);
      session.setSelection(earlier);
      arm(session, "select");
      tapCell(session, 2, 2);
      tapCell(session, 6, 8);
      expect(session.selection).not.toEqual(earlier);
      session.cancelPending();
      expect(session.selection).toEqual(earlier);
      expect(session.pending).toBeNull();
    });

    it("cancel with no earlier selection leaves none", () => {
      const { session } = makeSession();
      arm(session, "select");
      tapCell(session, 2, 2);
      session.cancelPending();
      expect(session.selection).toBeNull();
    });

    it("a confirmed selection is the one a later cancel restores", () => {
      const { session } = makeSession();
      arm(session, "select");
      tapCell(session, 2, 2);
      tapCell(session, 4, 4);
      session.confirmPending();
      const first = session.selection;
      tapCell(session, 8, 8);
      tapCell(session, 10, 10);
      session.cancelPending();
      expect(session.selection).toEqual(first);
    });
  });

  describe("what clears the pending value", () => {
    function withLine() {
      const made = makeSession();
      arm(made.session, "line");
      tapCell(made.session, 2, 2);
      tapCell(made.session, 2, 8);
      expect(made.session.pending).not.toBeNull();
      return made;
    }

    it("switching to another tool", () => {
      const { session } = withLine();
      session.setTool("rectangle");
      expect(session.pending).toBeNull();
    });

    it("choosing the tool that is already armed keeps it", () => {
      const { session } = withLine();
      session.setTool("line");
      expect(session.pending).not.toBeNull();
    });

    it("undo and redo, even with nothing to undo", () => {
      const a = withLine();
      a.session.undo();
      expect(a.session.pending).toBeNull();
      const b = withLine();
      b.session.redo();
      expect(b.session.pending).toBeNull();
    });

    it("leaving the orbit camera", () => {
      const { session } = withLine();
      session.setCameraMode("fly");
      expect(session.pending).toBeNull();
    });

    it("the session being disposed (another file opened)", () => {
      const { session, highlights } = withLine();
      session.dispose();
      expect(session.pending).toBeNull();
      expect(highlights.at(-1)).toEqual([]);
    });

    it("Escape cancels it before anything else", () => {
      const { session } = withLine();
      session.setSelection(boxBetween([0, 0, 0], [1, 0, 1]));
      session.perform({ type: "escape" });
      expect(session.pending).toBeNull();
      expect(session.selection).not.toBeNull();
    });

    it("clearing or replacing the selection drops a pending Select without restoring the old one", () => {
      const { session } = makeSession();
      arm(session, "select");
      tapCell(session, 2, 2);
      tapCell(session, 4, 4);
      session.clearSelection();
      expect(session.pending).toBeNull();
      expect(session.selection).toBeNull();
    });
  });

  describe("a drag", () => {
    it("before A exists: the cursor moves, nothing is armed until the lift, and A is set where the finger lifts", () => {
      const { session, volume } = makeSession();
      arm(session, "line");
      const before = snapshot(volume);
      const start = fingerFor(2, 2);
      session.touchMove(start.x, start.y);
      session.touchStrokeBegin(start.x, start.y);
      const mid = fingerFor(5, 2);
      session.touchMove(mid.x, mid.y);
      runFrames();
      expect(session.pending).toBeNull();
      expect(session.reticle?.reticleX).toBe(mid.x);
      const end = fingerFor(8, 4);
      session.touchMove(end.x, end.y);
      runFrames();
      session.touchStrokeEnd(end.x, end.y);
      session.touchEnd();
      expect(session.pending).toMatchObject({ kind: "line", a: [8, 1, 4], b: null, active: "a" });
      expect(cellsChanged(volume, before)).toEqual([]);
      expect(session.reticle).toBeNull();
    });

    it("moves the active corner live; lifting leaves it there", () => {
      const { session } = makeSession();
      arm(session, "line");
      tapCell(session, 2, 2);
      tapCell(session, 2, 8);
      const start = fingerFor(2, 8);
      session.touchMove(start.x, start.y);
      session.touchStrokeBegin(start.x, start.y);
      for (const cx of [4, 6, 9]) {
        const f = fingerFor(cx, 8);
        session.touchMove(f.x, f.y);
        runFrames();
        // The corner follows the cursor while the finger is still down.
        expect(session.pending).toMatchObject({ a: [2, 1, 2], b: [cx, 1, 8] });
      }
      const last = fingerFor(9, 8);
      session.touchStrokeEnd(last.x, last.y);
      session.touchEnd();
      expect(session.pending).toMatchObject({ a: [2, 1, 2], b: [9, 1, 8], active: "b" });
      expect(session.message).toBe("Corner B moved to 9, 1, 8");
    });

    it("moves the other corner when that one is active", () => {
      const { session } = makeSession();
      arm(session, "select");
      tapCell(session, 2, 2);
      tapCell(session, 6, 6);
      session.setActiveCorner("a");
      dragCells(session, [
        [2, 2],
        [1, 2],
        [0, 1],
      ]);
      expect(session.pending).toMatchObject({ a: [0, 0, 1], b: [6, 0, 6], active: "a" });
      expect(session.selection).toEqual(boxBetween([0, 0, 1], [6, 0, 6]));
    });

    it("moving A while B is not set places A again, with the plane a new tap would give", () => {
      const { session } = makeSession();
      arm(session, "rectangle");
      tapCell(session, 2, 2);
      dragCells(session, [
        [2, 2],
        [5, 5],
        [7, 7],
      ]);
      expect(session.pending).toMatchObject({ a: [7, 1, 7], b: null, active: "a", axis: 1 });
    });

    it("a rectangle's corner follows the cursor over empty space too", () => {
      const { session } = makeSession();
      arm(session, "rectangle");
      tapCell(session, 2, 2);
      tapCell(session, 5, 5);
      dragCells(session, [
        [5, 5],
        [10, 10],
        [18, 12],
      ]);
      expect(session.pending).toMatchObject({ a: [2, 1, 2], b: [18, 1, 12] });
    });

    it("the corner follows no further when the drag is cancelled: it goes back to where it was", () => {
      const { session } = makeSession();
      arm(session, "line");
      tapCell(session, 2, 2);
      tapCell(session, 2, 8);
      const start = fingerFor(2, 8);
      session.touchMove(start.x, start.y);
      session.touchStrokeBegin(start.x, start.y);
      const moved = fingerFor(9, 8);
      session.touchMove(moved.x, moved.y);
      runFrames();
      expect(session.pending).toMatchObject({ b: [9, 1, 8] });
      session.touchCancel();
      expect(session.pending).toMatchObject({ a: [2, 1, 2], b: [2, 1, 8], active: "b" });
      // The lift that follows adds nothing.
      session.touchStrokeEnd(moved.x, moved.y);
      expect(session.pending).toMatchObject({ a: [2, 1, 2], b: [2, 1, 8] });
    });

    it("a Select drag cancelled gives the earlier corner and its selection back", () => {
      const { session } = makeSession();
      arm(session, "select");
      tapCell(session, 2, 2);
      tapCell(session, 4, 4);
      const start = fingerFor(4, 4);
      session.touchMove(start.x, start.y);
      session.touchStrokeBegin(start.x, start.y);
      const moved = fingerFor(9, 9);
      session.touchMove(moved.x, moved.y);
      runFrames();
      expect(session.selection).toEqual(boxBetween([2, 0, 2], [9, 0, 9]));
      session.touchCancel();
      expect(session.selection).toEqual(boxBetween([2, 0, 2], [4, 0, 4]));
    });

    it("dragging off the canvas cancels the corner drag too, keeping the pending value", () => {
      const { session } = makeSession();
      arm(session, "line");
      tapCell(session, 2, 2);
      tapCell(session, 2, 8);
      const start = fingerFor(2, 8);
      session.touchMove(start.x, start.y);
      session.touchStrokeBegin(start.x, start.y);
      const moved = fingerFor(9, 8);
      session.touchMove(moved.x, moved.y);
      runFrames();
      expect(session.touchMove(moved.x, 30)).toBe(false); // the cursor leaves the top
      expect(session.pending).toMatchObject({ a: [2, 1, 2], b: [2, 1, 8] });
    });

    it("an Undo or a nudge under the finger ends the drag: the lift arms and moves nothing", () => {
      const { session } = makeSession();
      arm(session, "line");
      tapCell(session, 2, 2);
      tapCell(session, 2, 8);
      const start = fingerFor(2, 8);
      session.touchMove(start.x, start.y);
      session.touchStrokeBegin(start.x, start.y);
      session.undo();
      expect(session.pending).toBeNull();
      const f = fingerFor(9, 8);
      session.touchMove(f.x, f.y);
      session.touchStrokeEnd(f.x, f.y);
      expect(session.pending).toBeNull();

      tapCell(session, 2, 2);
      tapCell(session, 2, 8);
      session.touchMove(start.x, start.y);
      session.touchStrokeBegin(start.x, start.y);
      session.nudge(0, 1);
      session.touchMove(f.x, f.y);
      runFrames();
      session.touchStrokeEnd(f.x, f.y);
      expect(session.pending).toMatchObject({ a: [2, 1, 2], b: [3, 1, 8] });
    });

    it("a confirm under the finger runs the corners as they are and the lift adds nothing", () => {
      const { session, volume } = makeSession();
      arm(session, "line");
      const before = snapshot(volume);
      tapCell(session, 2, 2);
      tapCell(session, 2, 8);
      const start = fingerFor(2, 8);
      session.touchMove(start.x, start.y);
      session.touchStrokeBegin(start.x, start.y);
      const f = fingerFor(2, 10);
      session.touchMove(f.x, f.y);
      runFrames();
      session.confirmPending();
      expect(cellsChanged(volume, before)).toHaveLength(9); // to z = 10
      session.touchStrokeEnd(f.x, f.y);
      expect(session.pending).toBeNull();
      expect(cellsChanged(volume, before)).toHaveLength(9);
    });
  });

  describe("nudge limits", () => {
    it("a step outside the visible layers is refused with a message and moves nothing", () => {
      const { session } = makeSession();
      arm(session, "line");
      tapCell(session, 2, 2);
      tapCell(session, 2, 8);
      session.setSlice({ y0: 0, y1: 1 });
      const before = session.pending;
      expect(session.nudge(1, 1)).toBe(false);
      expect(session.pending).toBe(before);
      expect(session.error).toMatch(/Layer 2 is outside the visible layers 0 to 1/);
      expect(session.nudge(1, -1)).toBe(true); // down to layer 0 is fine
    });

    it("a step that would make the build longer than 512 is refused, and a step back is not", () => {
      const volume = makeVolume();
      volume.set(511, 0, 0, STONE); // the build is 512 long along x
      const { session } = makeSession({ volume });
      arm(session, "place");
      session.pending = { kind: "cell", tool: "place", cell: [511, 1, 0] };
      expect(session.nudge(0, 1)).toBe(false);
      expect(session.error).toMatch(/would be 513 long along x/);
      expect(session.pending).toMatchObject({ cell: [511, 1, 0] });
      expect(session.nudge(0, -1)).toBe(true);
      expect(session.pending).toMatchObject({ cell: [510, 1, 0] });
    });

    it("the same limit stops the confirm, which keeps the pending value for a nudge to fix", () => {
      const volume = makeVolume();
      volume.set(511, 0, 0, STONE);
      const { session } = makeSession({ volume });
      arm(session, "line");
      session.pending = { kind: "line", a: [2, 1, 2], b: [520, 1, 2], active: "b" };
      const before = snapshot(volume);
      expect(session.confirmPending()).toBe(false);
      expect(session.error).toMatch(/limit is 512/);
      expect(session.message).toBe(""); // the message line shows the error, not the last nudge
      expect(session.pending).not.toBeNull();
      expect(cellsChanged(volume, before)).toEqual([]);
      expect(session.undoCount).toBe(0);
      expect(session.nudge(0, -1)).toBe(true); // bringing the corner back is allowed
    });
  });

  describe("long press and the pending value", () => {
    it("still picks the block under the cursor and leaves the pending value alone", () => {
      const { session } = makeSession();
      arm(session, "line");
      tapCell(session, 2, 2);
      tapCell(session, 2, 8);
      const pending = session.pending;
      const f = fingerFor(3, 3); // the planks
      session.touchMove(f.x, f.y);
      session.touchLongPress(f.x, f.y);
      session.touchEnd();
      expect(session.block).toBe(PLANKS);
      expect(session.tool).toBe("line");
      expect(session.pending).toBe(pending);
    });
  });
});

describe("Confirm each placement", () => {
  it("is off by default and the session can be made with it on", () => {
    expect(makeSession().session.confirmPlacement).toBe(false);
    expect(makeSession({ confirmPlacement: true }).session.confirmPlacement).toBe(true);
  });

  it("Place: a tap arms the cell and changes nothing; confirm places one block as one undo step", () => {
    const { session, volume } = makeSession({ confirmPlacement: true });
    arm(session, "place");
    const before = snapshot(volume);
    tapCell(session, 5, 5);
    expect(session.pending).toEqual({ kind: "cell", tool: "place", cell: [5, 1, 5] });
    expect(cellsChanged(volume, before)).toEqual([]);
    expect(session.undoCount).toBe(0);
    expect(session.confirmPending()).toBe(true);
    expect(cellsChanged(volume, before)).toEqual(["5,1,5"]);
    expect(volume.get(5, 1, 5)).toBe(STONE);
    expect(session.undoCount).toBe(1);
    expect(session.pending).toBeNull();
    expect(session.message).toBe("place done");
    session.undo();
    expect(cellsChanged(volume, before)).toEqual([]);
  });

  it("Place: cancel places none", () => {
    const { session, volume } = makeSession({ confirmPlacement: true });
    arm(session, "place");
    const before = snapshot(volume);
    tapCell(session, 5, 5);
    session.cancelPending();
    expect(cellsChanged(volume, before)).toEqual([]);
    expect(session.undoCount).toBe(0);
    expect(session.pending).toBeNull();
  });

  it("a later tap moves the armed cell", () => {
    const { session } = makeSession({ confirmPlacement: true });
    arm(session, "place");
    tapCell(session, 5, 5);
    tapCell(session, 6, 7);
    expect(session.pending).toMatchObject({ cell: [6, 1, 7] });
  });

  it("a drag paints nothing: it only moves the cursor, and the lift arms the cell under it", () => {
    const { session, volume } = makeSession({ confirmPlacement: true });
    arm(session, "place");
    const before = snapshot(volume);
    const start = fingerFor(2, 2);
    session.touchMove(start.x, start.y);
    session.touchStrokeBegin(start.x, start.y);
    for (const cx of [3, 4, 5, 6]) {
      const f = fingerFor(cx, 2);
      session.touchMove(f.x, f.y);
      runFrames();
      expect(cellsChanged(volume, before)).toEqual([]);
    }
    const end = fingerFor(6, 2);
    session.touchStrokeEnd(end.x, end.y);
    session.touchEnd();
    expect(cellsChanged(volume, before)).toEqual([]);
    expect(session.undoCount).toBe(0);
    expect(session.pending).toEqual({ kind: "cell", tool: "place", cell: [6, 1, 2] });
  });

  it("the nudge pad moves the armed cell before the confirm", () => {
    const { session, volume } = makeSession({ confirmPlacement: true });
    arm(session, "place");
    const before = snapshot(volume);
    tapCell(session, 5, 5);
    session.nudge(0, 1);
    session.nudge(1, 1);
    session.nudge(2, -1);
    expect(session.pending).toMatchObject({ cell: [6, 2, 4] });
    session.confirmPending();
    expect(cellsChanged(volume, before)).toEqual(["6,2,4"]);
  });

  it("Replace turns the one block into the chosen one; Erase removes it", () => {
    const a = makeSession({ confirmPlacement: true });
    arm(a.session, "paint");
    a.session.block = GOLD;
    tapCell(a.session, 3, 3);
    expect(a.session.pending).toEqual({ kind: "cell", tool: "paint", cell: [3, 0, 3] });
    expect(a.volume.get(3, 0, 3)).toBe(PLANKS);
    a.session.confirmPending();
    expect(a.volume.get(3, 0, 3)).toBe(GOLD);
    expect(a.session.undoCount).toBe(1);
    expect(a.session.message).toBe("replace block done");

    const b = makeSession({ confirmPlacement: true });
    arm(b.session, "erase");
    tapCell(b.session, 3, 3);
    expect(b.volume.get(3, 0, 3)).toBe(PLANKS);
    b.session.confirmPending();
    expect(b.volume.get(3, 0, 3)).not.toBe(PLANKS);
    expect(b.session.undoCount).toBe(1);
    expect(b.session.message).toBe("erase done");
  });

  it("an erase of an empty cell changes nothing, says so, and still finishes", () => {
    const { session } = makeSession({ confirmPlacement: true });
    arm(session, "erase");
    tapCell(session, 3, 3);
    session.nudge(1, 3); // three layers up: nothing there
    session.confirmPending();
    expect(session.message).toBe("That would not change anything.");
    expect(session.undoCount).toBe(0);
    expect(session.pending).toBeNull();
  });

  it("Pick is not affected: it still picks at once", () => {
    const { session } = makeSession({ confirmPlacement: true });
    arm(session, "eyedropper");
    tapCell(session, 3, 3);
    expect(session.block).toBe(PLANKS);
    expect(session.pending).toBeNull();
  });

  it("off again: a tap applies at once, as before", () => {
    const { session, volume } = makeSession({ confirmPlacement: true });
    arm(session, "place");
    tapCell(session, 5, 5);
    expect(session.pending).not.toBeNull();
    session.setConfirmPlacement(false);
    expect(session.pending).toBeNull(); // an armed cell goes with the setting
    expect(session.confirmPlacement).toBe(false);
    const before = snapshot(volume);
    tapCell(session, 6, 6);
    expect(cellsChanged(volume, before)).toEqual(["6,1,6"]);
    expect(session.undoCount).toBe(1);
    expect(session.pending).toBeNull();
  });

  it("turning it off keeps a pending line", () => {
    const { session } = makeSession({ confirmPlacement: true });
    arm(session, "line");
    tapCell(session, 2, 2);
    session.setConfirmPlacement(false);
    expect(session.pending).not.toBeNull();
  });

  it("a long press still picks and leaves the armed cell", () => {
    const { session } = makeSession({ confirmPlacement: true });
    arm(session, "place");
    tapCell(session, 5, 5);
    const pending = session.pending;
    const f = fingerFor(3, 3);
    session.touchMove(f.x, f.y);
    session.touchLongPress(f.x, f.y);
    session.touchEnd();
    expect(session.block).toBe(PLANKS);
    expect(session.pending).toBe(pending);
  });

  it("an invalid block is refused when the cell is armed", () => {
    const { session } = makeSession({ confirmPlacement: true });
    arm(session, "place");
    session.block = "not a block[";
    tapCell(session, 5, 5);
    expect(session.pending).toBeNull();
    expect(session.error).not.toBe("");
  });

  it("the armed cell is outlined, with a ghost for Place", () => {
    const { session, highlights } = makeSession({ confirmPlacement: true });
    arm(session, "place");
    tapCell(session, 5, 5);
    const last = highlights.at(-1) as Array<{ min: Vec3; max: Vec3; style: string }>;
    expect(last).toContainEqual({ min: [5, 1, 5], max: [5, 1, 5], style: "hover" });
    expect(last).toContainEqual({ min: [5, 1, 5], max: [5, 1, 5], style: "ghost" });
  });
});

describe("Paste ghost", () => {
  /** Two cells of stone copied from the floor, tool Paste. */
  function withClipboard(skipAir = true) {
    const made = makeSession();
    made.session.skipAir = skipAir;
    made.session.setSelection(boxBetween([0, 0, 0], [2, 0, 1])); // 3 x 1 x 2 of stone
    made.session.copy();
    made.session.clearSelection();
    made.session.setTool("paste");
    return made;
  }

  it("a tap arms the origin next to the face and draws the clipboard's box as a ghost there", () => {
    const { session, volume, highlights } = withClipboard();
    const before = snapshot(volume);
    tapCell(session, 6, 6);
    expect(session.pending).toEqual({ kind: "paste", at: [6, 1, 6] });
    expect(cellsChanged(volume, before)).toEqual([]);
    const last = highlights.at(-1) as Array<{ min: Vec3; max: Vec3; style: string }>;
    expect(last).toContainEqual({ min: [6, 1, 6], max: [8, 1, 7], style: "ghost" });
    expect(session.pendingReadout).toBe("Paste at 6,1,6 · 3×1×2");
  });

  it("confirm equals pasteClipboard at that origin, as one undo step", () => {
    const { session, volume } = withClipboard();
    const clip = session.editor.clipboard as NonNullable<typeof session.editor.clipboard>;
    const before = snapshot(volume);
    const expected = reference(volume, (v) =>
      pasteClipboard(v, clip, [6, 1, 6], { skipAir: true }),
    );
    tapCell(session, 6, 6);
    expect(session.confirmPending()).toBe(true);
    expect(snapshot(volume)).toEqual(snapshot(expected));
    expect(cellsChanged(volume, before)).toHaveLength(6);
    expect(session.undoCount).toBe(1);
    expect(session.pending).toBeNull();
    // As the mouse's paste does: the pasted box becomes the selection and the tool is Select.
    expect(session.selection).toEqual(boxBetween([6, 1, 6], [8, 1, 7]));
    expect(session.tool).toBe("select");
    session.undo();
    expect(cellsChanged(volume, before)).toEqual([]);
  });

  it("the nudge pad moves the origin; the paste lands there", () => {
    const { session, volume } = withClipboard();
    const clip = session.editor.clipboard as NonNullable<typeof session.editor.clipboard>;
    const before = snapshot(volume);
    tapCell(session, 6, 6);
    session.nudge(0, 2);
    session.nudge(1, 1);
    session.nudge(2, -1);
    expect(session.pending).toEqual({ kind: "paste", at: [8, 2, 5] });
    const expected = reference(volume, (v) =>
      pasteClipboard(v, clip, [8, 2, 5], { skipAir: true }),
    );
    session.confirmPending();
    expect(snapshot(volume)).toEqual(snapshot(expected));
    expect(cellsChanged(volume, before)).toHaveLength(6);
  });

  it("the skip-air setting is respected", () => {
    const volume = makeVolume();
    volume.set(0, 1, 0, "minecraft:air");
    const made = makeSession({ volume });
    made.session.skipAir = false;
    made.session.setSelection(boxBetween([0, 0, 0], [1, 1, 0])); // stone, stone, air, unset
    made.session.copy();
    made.session.clearSelection();
    made.session.setTool("paste");
    const clip = made.session.editor.clipboard as NonNullable<typeof made.session.editor.clipboard>;
    for (const skipAir of [false, true]) {
      const s = makeSession({ volume: makeVolume() });
      s.session.editor.clipboard = clip;
      s.session.skipAir = skipAir;
      s.session.setTool("paste");
      const expected = reference(s.volume, (v) => pasteClipboard(v, clip, [8, 2, 8], { skipAir }));
      tapCell(s.session, 8, 8);
      s.session.nudge(1, 1);
      s.session.confirmPending();
      expect(snapshot(s.volume), `skipAir ${skipAir}`).toEqual(snapshot(expected));
    }
  });

  it("cancel pastes nothing", () => {
    const { session, volume } = withClipboard();
    const before = snapshot(volume);
    tapCell(session, 6, 6);
    session.cancelPending();
    expect(cellsChanged(volume, before)).toEqual([]);
    expect(session.undoCount).toBe(0);
    expect(session.pending).toBeNull();
    expect(session.tool).toBe("paste");
  });

  it("a drag only moves the cursor and the lift arms the origin", () => {
    const { session, volume } = withClipboard();
    const before = snapshot(volume);
    dragCells(session, [
      [2, 2],
      [4, 4],
      [7, 7],
    ]);
    expect(session.pending).toEqual({ kind: "paste", at: [7, 1, 7] });
    expect(cellsChanged(volume, before)).toEqual([]);
  });

  it("a paste that would pass 512 is refused by the nudge and by the confirm", () => {
    const volume = makeVolume();
    volume.set(500, 0, 0, STONE);
    const made = makeSession({ volume });
    made.session.setSelection(boxBetween([0, 0, 0], [2, 0, 1]));
    made.session.copy();
    made.session.clearSelection();
    made.session.setTool("paste");
    // Build x = 0..500; the 3-wide clip at x = 509 reaches 511: 512 long, fine; one more is 513.
    made.session.pending = { kind: "paste", at: [509, 1, 0] };
    expect(made.session.nudge(0, 1)).toBe(false);
    expect(made.session.error).toMatch(/would be 513 long along x/);
    expect(made.session.nudge(0, -1)).toBe(true);
    made.session.pending = { kind: "paste", at: [510, 1, 0] };
    expect(made.session.confirmPending()).toBe(false);
    expect(made.session.error).toMatch(/limit is 512/);
    expect(made.session.pending).not.toBeNull();
  });
});

describe("selection face steppers", () => {
  it("grow and shrink each face by one, with no undo step", () => {
    const { session, volume } = makeSession();
    session.setSelection(boxBetween([4, 0, 4], [6, 1, 6])); // 3 x 2 x 3
    const before = snapshot(volume);
    expect(session.stepSelectionFace(1, "max", true)).toBe(true);
    expect(session.selection).toEqual(boxBetween([4, 0, 4], [6, 2, 6]));
    expect(session.message).toBe("Selected 3 × 3 × 3");
    expect(session.stepSelectionFace(0, "min", true)).toBe(true);
    expect(session.selection).toEqual(boxBetween([3, 0, 4], [6, 2, 6]));
    expect(session.stepSelectionFace(2, "max", false)).toBe(true);
    expect(session.selection).toEqual(boxBetween([3, 0, 4], [6, 2, 5]));
    expect(cellsChanged(volume, before)).toEqual([]);
    expect(session.undoCount).toBe(0);
  });

  it("a face cannot pass the opposite one", () => {
    const { session } = makeSession();
    session.setSelection(boxBetween([4, 0, 4], [4, 0, 4]));
    const before = session.selection;
    for (const [axis, side] of [
      [0, "min"],
      [0, "max"],
      [1, "min"],
      [1, "max"],
      [2, "min"],
      [2, "max"],
    ] as const) {
      expect(session.stepSelectionFace(axis, side, false)).toBe(false);
    }
    expect(session.error).toMatch(/at least one block/);
    expect(session.selection).toBe(before);
  });

  it("growing along y stays inside the visible layers", () => {
    const { session } = makeSession();
    session.setSelection(boxBetween([4, 0, 4], [6, 1, 6]));
    session.setSlice({ y0: 0, y1: 1 });
    expect(session.stepSelectionFace(1, "max", true)).toBe(false);
    expect(session.error).toMatch(/layers 0 to 1/);
    expect(session.stepSelectionFace(1, "max", false)).toBe(true);
  });

  it("with no selection it says so and does nothing", () => {
    const { session } = makeSession();
    expect(session.stepSelectionFace(0, "min", true)).toBe(false);
    expect(session.selection).toBeNull();
  });

  it("a Select still waiting for its confirm is taken as it is, and the pad is gone", () => {
    const { session } = makeSession();
    arm(session, "select");
    tapCell(session, 2, 2);
    tapCell(session, 6, 6);
    session.stepSelectionFace(1, "max", true);
    expect(session.pending).toBeNull();
    expect(session.selection).toEqual(boxBetween([2, 0, 2], [6, 1, 6]));
  });

  it("two taps on a surface and two steps reach 3 x 3 x 3", () => {
    const { session } = makeSession();
    arm(session, "select");
    tapCell(session, 4, 4);
    tapCell(session, 6, 6);
    expect(session.stepSelectionFace(1, "max", true)).toBe(true);
    expect(session.stepSelectionFace(1, "max", true)).toBe(true);
    const sel = session.selection as Box;
    expect([0, 1, 2].map((i) => sel.max[i]! - sel.min[i]! + 1)).toEqual([3, 3, 3]);
  });
});

describe("the readout", () => {
  it("follows the nudges: corners, the active one, and the size", () => {
    const { session } = makeSession();
    arm(session, "line");
    expect(session.pendingReadout).toBe("");
    tapCell(session, 2, 2);
    expect(session.pendingReadout).toBe("▸A 2,1,2 B — · 1×1×1");
    tapCell(session, 2, 8);
    expect(session.pendingReadout).toBe("A 2,1,2 ▸B 2,1,8 · 1×1×7");
    session.nudge(2, 1);
    expect(session.pendingReadout).toBe("A 2,1,2 ▸B 2,1,9 · 1×1×8");
  });

  it("an armed cell shows its position and block", () => {
    const { session } = makeSession({ confirmPlacement: true });
    arm(session, "paint");
    session.block = GOLD;
    tapCell(session, 3, 3);
    expect(session.pendingReadout).toBe("Replace 3,0,3 oak_planks → gold_block");
    session.nudge(0, 1);
    expect(session.pendingReadout).toBe("Replace 4,0,3 stone → gold_block");
  });
});

describe("two-corner tools with the router and the session together", () => {
  function wireTools(options: Parameters<typeof makeSession>[0] = {}) {
    const made = makeSession(options);
    const camera: GestureIntent[] = [];
    const router = new TouchRouter({
      target: () => made.session,
      camera: (i) => camera.push(i),
      arbiter: {
        setTimeout: () => 0 as unknown as ReturnType<typeof setTimeout>,
        clearTimeout() {},
      },
    });
    let clock = 0;
    const feed = (id: number, type: "down" | "move" | "up", x: number, y: number) => {
      clock += 30;
      router.feed({ id, type, x, y, time: clock });
    };
    /** A tap with the finger placed for cell (cx, cz). */
    const tap = (cx: number, cz: number): void => {
      const f = fingerFor(cx, cz);
      feed(1, "down", f.x, f.y);
      feed(1, "up", f.x, f.y);
      runFrames();
    };
    return { ...made, camera, router, feed, tap };
  }

  it("taps through the router set A, B and move B", () => {
    const h = wireTools();
    arm(h.session, "line");
    h.tap(2, 2);
    expect(h.session.pending).toMatchObject({ a: [2, 1, 2], b: null });
    h.tap(2, 8);
    expect(h.session.pending).toMatchObject({ a: [2, 1, 2], b: [2, 1, 8] });
    h.tap(5, 8);
    expect(h.session.pending).toMatchObject({ b: [5, 1, 8] });
    expect(h.camera).toEqual([]); // the camera heard nothing
  });

  it("a one-finger drag through the router moves the active corner and does not orbit", () => {
    const h = wireTools();
    arm(h.session, "line");
    h.tap(2, 2);
    h.tap(2, 8);
    const from = fingerFor(2, 8);
    h.feed(1, "down", from.x, from.y);
    for (const cx of [3, 4, 5, 6, 7]) {
      const f = fingerFor(cx, 8);
      h.feed(1, "move", f.x, f.y);
      runFrames();
    }
    expect(h.session.pending).toMatchObject({ a: [2, 1, 2], b: [7, 1, 8] });
    const end = fingerFor(7, 8);
    h.feed(1, "up", end.x, end.y);
    runFrames();
    expect(h.session.pending).toMatchObject({ a: [2, 1, 2], b: [7, 1, 8], active: "b" });
    expect(h.session.reticle).toBeNull();
    expect(h.camera).toEqual([]);
  });

  it("a second finger during a corner drag puts the corner back and keeps the pending action", () => {
    const h = wireTools();
    arm(h.session, "line");
    h.tap(2, 2);
    h.tap(2, 8);
    const before = h.session.pending;
    const from = fingerFor(2, 8);
    h.feed(1, "down", from.x, from.y);
    for (const cx of [3, 4, 5, 6]) {
      const f = fingerFor(cx, 8);
      h.feed(1, "move", f.x, f.y);
      runFrames();
    }
    expect(h.session.pending).toMatchObject({ b: [6, 1, 8] }); // the drag is under way
    h.feed(2, "down", 150, 100);
    expect(h.session.pending).toMatchObject({ a: [2, 1, 2], b: [2, 1, 8], active: "b" });
    expect(h.session.pending).not.toBeNull();
    expect(h.session.reticle).toBeNull();

    // The two fingers pan; the corner stays where it was put back.
    h.feed(1, "move", 65, 150);
    h.feed(2, "move", 150, 150);
    h.feed(2, "up", 150, 150);
    h.feed(1, "move", 70, 160); // the leftover finger orbits
    h.feed(1, "up", 70, 160);
    runFrames();
    expect(h.camera.some((i) => i.type === "twoFingerPan" || i.type === "oneFingerDragMove")).toBe(
      true,
    );
    expect(h.session.pending).toEqual(before);
    expect(h.session.undoCount).toBe(0);
  });

  it("a pinch and a two-finger pan leave the pending action alone", () => {
    const h = wireTools();
    arm(h.session, "rectangle");
    h.tap(2, 2);
    h.tap(6, 6);
    const before = h.session.pending;
    h.feed(1, "down", 60, 100);
    h.feed(2, "down", 140, 100);
    for (let i = 1; i <= 4; i++) {
      h.feed(1, "move", 60 - i * 8, 100);
      h.feed(2, "move", 140 + i * 8, 100);
    }
    h.feed(2, "up", 172, 100);
    h.feed(1, "up", 28, 100);
    runFrames();
    expect(h.camera.some((i) => i.type === "pinch")).toBe(true);
    expect(h.session.pending).toBe(before);

    h.feed(1, "down", 60, 100);
    h.feed(2, "down", 140, 100);
    for (let i = 1; i <= 4; i++) {
      h.feed(1, "move", 60, 100 + i * 10);
      h.feed(2, "move", 140, 100 + i * 10);
    }
    h.feed(2, "up", 140, 140);
    h.feed(1, "up", 60, 140);
    runFrames();
    expect(h.camera.some((i) => i.type === "twoFingerPan")).toBe(true);
    expect(h.session.pending).toBe(before);
    // And the next tap still moves B.
    h.tap(8, 8);
    expect(h.session.pending).toMatchObject({ a: [2, 1, 2], b: [8, 1, 8] });
  });

  it("a finger that lands, then a second one before any drag, does not arm anything", () => {
    const h = wireTools();
    arm(h.session, "line");
    const f = fingerFor(2, 2);
    h.feed(1, "down", f.x, f.y);
    h.feed(2, "down", 150, 100);
    h.feed(2, "up", 150, 100);
    h.feed(1, "up", f.x, f.y);
    runFrames();
    expect(h.session.pending).toBeNull();
  });

  it("a long press through the router picks and keeps the pending action", () => {
    const h = wireTools();
    arm(h.session, "line");
    h.tap(2, 2);
    const before = h.session.pending;
    const f = fingerFor(3, 3);
    h.feed(1, "down", f.x, f.y);
    h.router.stepTime(10_000);
    h.feed(1, "up", f.x, f.y);
    runFrames();
    expect(h.session.block).toBe(PLANKS);
    expect(h.session.pending).toBe(before);
  });

  it("View still orbits with one finger and never arms anything", () => {
    const h = wireTools();
    h.session.setTool("navigate");
    const f = fingerFor(2, 2);
    h.feed(1, "down", f.x, f.y);
    h.feed(1, "move", f.x + 30, f.y);
    h.feed(1, "up", f.x + 30, f.y);
    runFrames();
    expect(h.camera.some((i) => i.type === "oneFingerDragMove")).toBe(true);
    expect(h.session.pending).toBeNull();
  });

  it("Place in confirm mode: tap arms through the router, the confirm applies", () => {
    const h = wireTools({ confirmPlacement: true });
    arm(h.session, "place");
    const before = snapshot(h.volume);
    h.tap(5, 5);
    expect(h.session.pending).toMatchObject({ kind: "cell", cell: [5, 1, 5] });
    expect(cellsChanged(h.volume, before)).toEqual([]);
    h.session.confirmPending();
    expect(cellsChanged(h.volume, before)).toEqual(["5,1,5"]);
  });
});

describe("tap to inspect in View (touchInspectAt)", () => {
  /** The finger itself, with no offset: the point over cell (cx, cz). */
  const over = (cx: number, cz: number): { x: number; y: number } => ({
    x: cx * 10 + 5,
    y: cz * 10 + 5,
  });
  const hoverBoxes = (highlights: unknown[][]) =>
    (highlights.at(-1) as Array<{ min: Vec3; max: Vec3; style: string }>).filter(
      (b) => b.style === "hover",
    );

  it("makes the block under the finger itself the inspected one, with no offset", () => {
    const { session } = makeSession();
    expect(session.tool).toBe("navigate");
    const p = over(3, 10); // the gold block
    expect(session.touchInspectAt(p.x, p.y)).toBe(true);
    expect(session.inspected).toEqual([3, 0, 10]);
    expect(session.inspectedBlock).toBe(GOLD);
    // Not the cell 64 px above, which is the planks at (3, 0, 3).
    expect(session.inspected).not.toEqual([3, 0, 3]);
  });

  it("outlines it with the inspected (hover) style", () => {
    const { session, highlights } = makeSession();
    const p = over(4, 4);
    session.touchInspectAt(p.x, p.y);
    expect(hoverBoxes(highlights)).toEqual([{ min: [4, 0, 4], max: [4, 0, 4], style: "hover" }]);
  });

  it("changes nothing in the volume or the history", () => {
    const { session, volume } = makeSession();
    const before = snapshot(volume);
    const p = over(3, 3);
    session.touchInspectAt(p.x, p.y);
    expect(cellsChanged(volume, before)).toEqual([]);
    expect(session.undoCount).toBe(0);
    expect(session.block).toBe(STONE);
    expect(session.pending).toBeNull();
  });

  it("a later tap moves it", () => {
    const { session } = makeSession();
    session.touchInspectAt(over(3, 3).x, over(3, 3).y);
    session.touchInspectAt(over(6, 6).x, over(6, 6).y);
    expect(session.inspected).toEqual([6, 0, 6]);
  });

  it("a tap on empty space clears it, and with it the outline; the selection stays", () => {
    const { session, highlights } = makeSession();
    session.setSelection({ min: [0, 0, 0], max: [1, 0, 1] });
    session.touchInspectAt(over(4, 4).x, over(4, 4).y);
    expect(session.inspectedBlock).not.toBeNull();
    expect(session.touchInspectAt(500, 500)).toBe(false); // far outside the 16 x 16 floor
    expect(session.inspected).toBeNull();
    expect(session.inspectedBlock).toBeNull();
    expect(hoverBoxes(highlights)).toEqual([]);
    expect(session.selection).not.toBeNull();
  });

  it("clears an old message and error", () => {
    const { session } = makeSession();
    session.message = "Picked something";
    session.error = "something failed";
    session.touchInspectAt(over(4, 4).x, over(4, 4).y);
    expect(session.message).toBe("");
    expect(session.error).toBe("");
  });

  it("respects the visible layers: a block outside them is not found", () => {
    const { session } = makeSession();
    session.setSlice({ y0: 5, y1: 9 });
    expect(session.touchInspectAt(over(4, 4).x, over(4, 4).y)).toBe(false);
    expect(session.inspected).toBeNull();
  });

  it("does nothing with a tool armed, or in the fly camera", () => {
    for (const tool of [
      "place",
      "paint",
      "erase",
      "eyedropper",
      "line",
      "rectangle",
      "select",
    ] as const) {
      const { session } = makeSession();
      session.setTool(tool);
      expect(session.touchInspectAt(over(4, 4).x, over(4, 4).y), tool).toBe(false);
      expect(session.inspected, tool).toBeNull();
    }
    const { session } = makeSession();
    session.setCameraMode("fly");
    session.setTool("navigate");
    expect(session.touchInspectAt(over(4, 4).x, over(4, 4).y)).toBe(false);
    expect(session.inspected).toBeNull();
  });

  describe("with the router and the session together", () => {
    function wireView() {
      const made = makeSession();
      const camera: GestureIntent[] = [];
      const router = new TouchRouter({
        target: () => made.session,
        camera: (i) => camera.push(i),
        arbiter: {
          setTimeout: () => 0 as unknown as ReturnType<typeof setTimeout>,
          clearTimeout() {},
        },
      });
      let clock = 0;
      const feed = (id: number, type: "down" | "move" | "up", x: number, y: number) => {
        clock += 30;
        router.feed({ id, type, x, y, time: clock });
      };
      return { ...made, camera, router, feed };
    }

    it("a tap inspects the block under the finger", () => {
      const h = wireView();
      const p = over(5, 5);
      h.feed(1, "down", p.x, p.y);
      h.feed(1, "up", p.x, p.y);
      expect(h.session.inspected).toEqual([5, 0, 5]);
      expect(h.camera.map((i) => i.type)).toEqual(["tap"]);
    });

    it("an orbit that ends over a block does not", () => {
      const h = wireView();
      const a = over(5, 5);
      h.feed(1, "down", a.x, a.y);
      h.feed(1, "move", a.x + 20, a.y);
      h.feed(1, "move", a.x + 40, a.y);
      h.feed(1, "up", a.x + 40, a.y);
      expect(h.session.inspected).toBeNull();
    });

    it("the end of a pinch or a pan, and the finger left down after them, do not", () => {
      for (const dy of [0, 40]) {
        const h = wireView();
        h.feed(1, "down", 50, 60);
        h.feed(2, "down", 120, 60);
        h.feed(1, "move", dy === 0 ? 30 : 50, 60 + dy);
        h.feed(2, "move", dy === 0 ? 140 : 120, 60 + dy);
        h.feed(2, "up", dy === 0 ? 140 : 120, 60 + dy);
        h.feed(1, "up", dy === 0 ? 30 : 50, 60 + dy);
        expect(h.session.inspected).toBeNull();
      }
    });

    it("a long press picks and inspects the block, but a tap-length touch before it does not matter", () => {
      const h = wireView();
      const p = over(3, 10);
      h.router.feed({ id: 1, type: "down", x: p.x, y: p.y, time: 0 });
      h.router.stepTime(450);
      h.router.feed({ id: 1, type: "up", x: p.x, y: p.y, time: 700 });
      expect(h.session.block).toBe(GOLD);
      expect(h.session.inspected).toEqual([3, 0, 10]);
    });

    it("with a touch tool armed a tap goes to the tool, not to inspect", () => {
      const h = wireView();
      arm(h.session, "line");
      const f = fingerFor(2, 2);
      h.feed(1, "down", f.x, f.y);
      h.feed(1, "up", f.x, f.y);
      runFrames();
      expect(h.session.pending).toMatchObject({ kind: "line", a: [2, 1, 2] });
    });
  });
});

describe("inspected follows taps for every touch tool", () => {
  it("Place and Replace and Erase set it on a tap (the block under the cursor, not the one the tool changes)", () => {
    for (const tool of ["place", "paint", "erase"] as const) {
      const { session } = makeSession();
      arm(session, tool);
      tapCell(session, 5, 5);
      expect(session.inspected, tool).toEqual([5, 0, 5]);
    }
  });

  it("an armed cell (Confirm each placement) sets it", () => {
    const { session } = makeSession({ confirmPlacement: true });
    arm(session, "place");
    tapCell(session, 5, 5);
    expect(session.pending).toMatchObject({ kind: "cell" });
    expect(session.inspected).toEqual([5, 0, 5]);
    expect(session.inspectedBlock).toBe(STONE);
  });

  it("the corners of Line, Rectangle and Select set it, and so does the second tap", () => {
    for (const tool of ["line", "rectangle", "select"] as const) {
      const { session } = makeSession();
      arm(session, tool);
      tapCell(session, 2, 2);
      expect(session.inspected, `${tool} A`).toEqual([2, 0, 2]);
      tapCell(session, 6, 8);
      expect(session.inspected, `${tool} B`).toEqual([6, 0, 8]);
    }
  });

  it("a corner dragged to another block sets it where the finger lifts", () => {
    const { session } = makeSession();
    arm(session, "line");
    tapCell(session, 2, 2);
    tapCell(session, 2, 8);
    dragCells(session, [
      [2, 8],
      [4, 8],
      [7, 8],
    ]);
    expect(session.inspected).toEqual([7, 0, 8]);
  });

  it("the Paste origin sets it", () => {
    const { session } = makeSession();
    session.setSelection(boxBetween([0, 0, 0], [1, 0, 1]));
    session.copy();
    session.clearSelection();
    session.setTool("paste");
    tapCell(session, 6, 6);
    expect(session.pending).toMatchObject({ kind: "paste" });
    expect(session.inspected).toEqual([6, 0, 6]);
  });

  it("a long press in View picks the block and inspects it", () => {
    const { session } = makeSession();
    session.touchPickAt(35, 100);
    expect(session.inspected).toEqual([3, 0, 10]);
  });
});

describe("choosing a block tells onBlockChosen", () => {
  it("chooseBlock sets the block, clears the error and reports it once", () => {
    const { session } = makeSession();
    const seen: string[] = [];
    session.onBlockChosen = (b) => seen.push(b);
    session.error = "old";
    session.chooseBlock("minecraft:oak_planks");
    expect(session.block).toBe("minecraft:oak_planks");
    expect(session.error).toBe("");
    expect(seen).toEqual(["minecraft:oak_planks"]);
  });

  it("Pick (tap and long press) and a long press in View report the block they picked", () => {
    const seen: string[] = [];
    const a = makeSession();
    a.session.onBlockChosen = (b) => seen.push(b);
    arm(a.session, "eyedropper");
    a.session.touchMove(FINGER.x, FINGER.y);
    runFrames();
    a.session.touchTap(FINGER.x, FINGER.y);
    a.session.touchEnd();
    expect(seen).toEqual([PLANKS]);

    const b = makeSession();
    b.session.onBlockChosen = (blk) => seen.push(blk);
    arm(b.session, "place");
    b.session.touchMove(FINGER.x, FINGER.y);
    b.session.touchLongPress(FINGER.x, FINGER.y);
    expect(seen).toEqual([PLANKS, PLANKS]);

    const c = makeSession();
    c.session.onBlockChosen = (blk) => seen.push(blk);
    c.session.touchPickAt(35, 100);
    expect(seen).toEqual([PLANKS, PLANKS, GOLD]);
  });

  it("assigning session.block directly (the typed field) is not a choice", () => {
    const { session } = makeSession();
    const seen: string[] = [];
    session.onBlockChosen = (b) => seen.push(b);
    session.block = "minecraft:ston";
    session.block = "minecraft:stone";
    expect(seen).toEqual([]);
  });

  it("a pick records the block without block-entity NBT", () => {
    const volume = makeVolume();
    volume.set(9, 0, 9, "minecraft:chest[facing=north]{Items:[]}");
    const { session } = makeSession({ volume });
    const seen: string[] = [];
    session.onBlockChosen = (b) => seen.push(b);
    session.touchPickAt(95, 95);
    expect(seen).toHaveLength(1);
    expect(seen[0]).not.toContain("{");
    expect(seen[0]).toContain("minecraft:chest");
  });

  it("works with no listener", () => {
    const { session } = makeSession();
    expect(() => session.chooseBlock("minecraft:glass")).not.toThrow();
    expect(session.block).toBe("minecraft:glass");
  });
});

describe("Copy on touch", () => {
  it("says how many blocks were copied, without the keyboard hint", () => {
    const { session } = makeSession();
    session.setSelection(boxBetween([0, 0, 0], [2, 0, 1]));
    expect(session.copy(true)).toBe(true);
    expect(session.message).toBe("Copied 6 blocks");
    expect(session.clipboardCells).toBe(6);
  });

  it("the desktop message still names Ctrl+V", () => {
    const { session } = makeSession();
    session.setSelection(boxBetween([0, 0, 0], [0, 0, 0]));
    session.copy();
    expect(session.message).toBe("Copied 1 block. Ctrl+V pastes.");
  });
});
