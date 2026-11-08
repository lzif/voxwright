// SPDX-License-Identifier: AGPL-3.0-only

// The touch half of `EditSession` against a fake renderer. The fake camera looks straight down:
// a page point (x, y) is the ray from world (x / 10, 10, y / 10) pointing along -y, so the cell
// under the point is (floor(x / 10), ., floor(y / 10)). The floor is stone, 16 x 16 at y = 0, with a
// few other blocks to tell cells apart.

import { Volume } from "@voxwright/core";
import type { WebglRenderer } from "@voxwright/render/webgl";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ToolId } from "../src/lib/editing.ts";
import { EditSession } from "../src/lib/editor-session.svelte.ts";

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

function makeSession(options: { overCanvas?: () => boolean } = {}) {
  const volume = new Volume();
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) volume.set(x, 0, z, STONE);
  volume.set(3, 0, 3, PLANKS); // under the cursor
  volume.set(3, 0, 10, GOLD); // under the finger
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
  for (let x = 0; x < 16; x++)
    for (let y = 0; y < 3; y++)
      for (let z = 0; z < 16; z++) out.set(`${x},${y},${z}`, volume.get(x, y, z));
  return out;
};

const arm = (session: EditSession, tool: ToolId): void => {
  session.setTool(tool);
  session.block = STONE;
};

describe("EditSession touch path", () => {
  it("only a touch tool in the orbit camera takes a finger", () => {
    const { session } = makeSession();
    for (const tool of ["place", "paint", "erase", "eyedropper"] as const) {
      session.setTool(tool);
      expect(session.touchToolActive, tool).toBe(true);
    }
    for (const tool of ["navigate", "line", "rectangle", "select"] as const) {
      session.setTool(tool);
      expect(session.touchToolActive, tool).toBe(false);
    }
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
      session.setTool("line");
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
