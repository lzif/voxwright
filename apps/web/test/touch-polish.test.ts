// SPDX-License-Identifier: AGPL-3.0-only

// MB8 on the session: what the undo toast is told about each edit (`lastChange`), the events behind
// the vibration, the Undo of the toast, the button forms of the double tap and the pan, and the
// multi-finger shortcuts through the router. The fake camera looks straight down: a page point
// (x, y) is the ray from world (x / 10, 10, y / 10) pointing along -y, so the cell under the point
// is (floor(x / 10), ., floor(y / 10)). The floor is stone, 16 x 16 at y = 0.

import { cloneVolume, type Vec3, Volume } from "@voxwright/core";
import type { WebglRenderer } from "@voxwright/render/webgl";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SessionEvent } from "../src/lib/changes.ts";
import type { ToolId } from "../src/lib/editing.ts";
import { EditSession } from "../src/lib/editor-session.svelte.ts";
import { multiTapAction } from "../src/lib/mobile-settings.ts";
import { TouchRouter } from "../src/lib/touch-router.ts";

const STONE = "minecraft:stone";
const GOLD = "minecraft:gold_block";
const OFFSET = 64;
/** The finger that puts the cursor over cell (3, 3): 64 px below it. */
const FINGER = { x: 35, y: 100 };

const frames: Array<() => void> = [];
const saved = { raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame };

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
  globalThis.requestAnimationFrame = saved.raf;
  globalThis.cancelAnimationFrame = saved.caf;
});

const runFrames = (): void => {
  for (const f of frames.splice(0)) f();
};

function makeVolume(): Volume {
  const v = new Volume();
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) v.set(x, 0, z, STONE);
  return v;
}

function makeSession(options: { confirmPlacement?: boolean; volume?: Volume } = {}) {
  const volume = options.volume ?? makeVolume();
  const focuses: Array<{ target: Vec3; distance: number | undefined }> = [];
  const log = { framed: 0 };
  const renderer = {
    getPose: () => ({ distance: 40 }),
    focusOn: (target: Vec3, distance?: number) => {
      focuses.push({ target: [...target], distance });
    },
    frameCamera: () => {
      log.framed++;
    },
    rayFromClient: (x: number, y: number) => ({
      origin: [x / 10, 10, y / 10] as [number, number, number],
      direction: [0, -1, 0] as [number, number, number],
    }),
    markDirty: () => {},
    highlight: () => {},
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
    isOverCanvas: () => true,
    confirmPlacement: options.confirmPlacement,
  });
  const events: SessionEvent[] = [];
  session.onEvent = (e) => events.push(e);
  return { session, volume, focuses, events, log };
}

const arm = (session: EditSession, tool: ToolId, block = STONE): void => {
  session.setTool(tool);
  session.block = block;
};

const kinds = (events: readonly SessionEvent[]): string[] => events.map((e) => e.kind);

describe("lastChange: the toast's entry", () => {
  it("is empty before any edit", () => {
    expect(makeSession().session.lastChange).toBeNull();
  });

  it("a tap with Place: one block", () => {
    const { session } = makeSession();
    arm(session, "place", GOLD);
    session.touchTap(FINGER.x, FINGER.y);
    expect(session.lastChange).toMatchObject({ label: "place", count: 1, text: "Placed 1 block" });
  });

  it("a tap with Erase: Erased 1 block", () => {
    const { session } = makeSession();
    arm(session, "erase");
    session.touchTap(FINGER.x, FINGER.y);
    expect(session.lastChange?.text).toBe("Erased 1 block");
  });

  it("a tap with Replace: Replaced 1 block", () => {
    const { session } = makeSession();
    arm(session, "paint", GOLD);
    session.touchTap(FINGER.x, FINGER.y);
    expect(session.lastChange?.text).toBe("Replaced 1 block");
  });

  it("a stroke: the number of blocks it changed, as one entry", () => {
    const { session } = makeSession();
    arm(session, "place", GOLD);
    session.touchMove(FINGER.x, FINGER.y);
    runFrames();
    session.touchStrokeBegin(FINGER.x, FINGER.y);
    for (const x of [45, 55, 65, 75]) {
      session.touchMove(x, FINGER.y);
      runFrames();
    }
    session.touchStrokeEnd(75, FINGER.y);
    session.touchEnd();
    expect(session.undoCount).toBe(1);
    expect(session.lastChange).toMatchObject({ label: "place", count: 5, text: "Placed 5 blocks" });
  });

  it("an armed cell confirmed: Placed 1 block", () => {
    const { session } = makeSession({ confirmPlacement: true });
    arm(session, "place", GOLD);
    session.touchTap(FINGER.x, FINGER.y);
    expect(session.lastChange).toBeNull(); // armed, not applied
    session.confirmPending();
    expect(session.lastChange?.text).toBe("Placed 1 block");
  });

  it("a line confirmed: Drew a line of N blocks", () => {
    const { session } = makeSession();
    arm(session, "line", GOLD);
    session.touchTap(35, 100); // A at (3, 1, 3) after the offset
    session.touchTap(75, 100); // B at (7, 1, 3)
    expect(session.lastChange).toBeNull();
    session.confirmPending();
    expect(session.lastChange).toMatchObject({ label: "line", count: 5 });
    expect(session.lastChange?.text).toBe("Drew a line of 5 blocks");
  });

  it("a rectangle confirmed", () => {
    const { session } = makeSession();
    arm(session, "rectangle", GOLD);
    session.touchTap(35, 100);
    session.touchTap(65, 120);
    session.confirmPending();
    expect(session.lastChange?.label).toBe("rectangle");
    expect(session.lastChange?.count).toBeGreaterThan(1);
  });

  it("fill, replace, rotate, mirror, move and paste each report their count", () => {
    const { session, volume } = makeSession();
    session.block = GOLD;
    session.setSelection({ min: [0, 0, 0], max: [2, 0, 2] });
    session.fill();
    expect(session.lastChange?.text).toBe("Filled 9 blocks");

    session.block = STONE;
    session.replace(GOLD);
    expect(session.lastChange?.text).toBe("Replaced 9 blocks");

    volume.set(0, 0, 0, GOLD); // a block that tells the turn and the flip apart from the rest
    session.rotate("CLOCKWISE_90");
    expect(session.lastChange?.label).toBe("rotate CLOCKWISE_90");
    expect(session.lastChange?.text).toMatch(/^Rotated \d+ blocks?$/);

    session.mirror("x");
    expect(session.lastChange?.text).toMatch(/^Mirrored \d+ blocks?$/);

    session.move([4, 0, 0]);
    expect(session.lastChange?.text).toMatch(/^Moved \d+ blocks?$/);

    session.setSelection({ min: [8, 0, 8], max: [9, 0, 9] }); // stone
    session.copy();
    arm(session, "paste");
    session.touchTap(105, 100); // origin (10, 1, 3)
    session.confirmPending();
    expect(session.lastChange?.text).toMatch(/^Pasted \d+ blocks?$/);
  });

  it("a block-state change", () => {
    const { session } = makeSession();
    session.placeAt([4, 1, 4], "minecraft:oak_stairs[facing=north,half=bottom]");
    session.inspected = [4, 1, 4];
    session.setProperty("facing", "east");
    expect(session.lastChange).toMatchObject({ label: "set facing=east", count: 1 });
    expect(session.lastChange?.text).toBe("Set facing=east on 1 block");
  });

  it("Select and a refused confirm add no entry and no toast", () => {
    const { session } = makeSession();
    arm(session, "select");
    session.touchTap(35, 100);
    session.touchTap(65, 100);
    session.confirmPending();
    expect(session.selection).not.toBeNull();
    expect(session.lastChange).toBeNull();
  });

  it("every edit gets a new id, so a new edit replaces the old toast", () => {
    const { session } = makeSession();
    arm(session, "place", GOLD);
    session.touchTap(FINGER.x, FINGER.y);
    const first = session.lastChange;
    session.touchTap(75, 100);
    const second = session.lastChange;
    expect(second?.id).toBeGreaterThan(first?.id ?? 0);
    expect(session.undoCount).toBe(2);
  });

  it("an erase that changes nothing makes no entry", () => {
    const { session } = makeSession();
    arm(session, "erase");
    session.touchTap(FINGER.x, FINGER.y);
    const id = session.lastChange?.id;
    session.eraseAt([3, 0, 3]); // already gone
    expect(session.lastChange?.id).toBe(id);
  });
});

describe("undoChange: the toast's Undo", () => {
  it("undoes exactly the entry it was shown for, and only that one", () => {
    const { session, volume } = makeSession();
    arm(session, "place", GOLD);
    session.touchTap(FINGER.x, FINGER.y); // (3, 1, 3)
    session.touchTap(75, 100); // (7, 1, 3)
    const second = session.lastChange;
    expect(second).not.toBeNull();
    expect(session.undoChange(second?.id ?? -1)).toBe(true);
    expect(volume.get(7, 1, 3)).not.toBe(GOLD); // the second is gone
    expect(volume.get(3, 1, 3)).toBe(GOLD); // the first stays
    expect(session.undoCount).toBe(1);
    expect(session.lastChange).toBeNull();
  });

  it("is refused for an entry that is no longer the latest", () => {
    const { session, volume } = makeSession();
    arm(session, "place", GOLD);
    session.touchTap(FINGER.x, FINGER.y);
    const first = session.lastChange;
    session.touchTap(75, 100);
    expect(session.undoChange(first?.id ?? -1)).toBe(false); // the toast moved on to the second
    expect(session.undoCount).toBe(2);
    expect(volume.get(3, 1, 3)).toBe(GOLD);
  });

  it("is refused after the entry was undone another way, and does not undo the one before it", () => {
    const { session } = makeSession();
    arm(session, "place", GOLD);
    session.touchTap(FINGER.x, FINGER.y);
    session.touchTap(75, 100);
    const second = session.lastChange;
    session.undo(); // the thumb cluster's Undo
    expect(session.lastChange).toBeNull();
    expect(session.undoChange(second?.id ?? -1)).toBe(false);
    expect(session.undoCount).toBe(1); // the first is still there
  });

  it("is refused after a redo too: the toast is gone", () => {
    const { session } = makeSession();
    arm(session, "place", GOLD);
    session.touchTap(FINGER.x, FINGER.y);
    const first = session.lastChange;
    session.undo();
    session.redo();
    expect(session.lastChange).toBeNull();
    expect(session.undoChange(first?.id ?? -1)).toBe(false);
    expect(session.undoCount).toBe(1);
  });

  it("an unknown id changes nothing", () => {
    const { session } = makeSession();
    arm(session, "place", GOLD);
    session.touchTap(FINGER.x, FINGER.y);
    expect(session.undoChange(9999)).toBe(false);
    expect(session.undoCount).toBe(1);
  });

  it("works for a block-state change", () => {
    const { session, volume } = makeSession();
    session.placeAt([4, 1, 4], "minecraft:oak_stairs[facing=north,half=bottom]");
    session.inspected = [4, 1, 4];
    session.setProperty("facing", "east");
    const c = session.lastChange;
    expect(session.undoChange(c?.id ?? -1)).toBe(true);
    expect(volume.get(4, 1, 4)).toContain("facing=north");
  });
});

describe("session events (the vibration and the walkthrough)", () => {
  it("an edit is a commit, with the change", () => {
    const { session, events } = makeSession();
    arm(session, "place", GOLD);
    session.touchTap(FINGER.x, FINGER.y);
    expect(kinds(events)).toEqual(["commit"]);
    expect(events[0]).toMatchObject({ kind: "commit", change: { text: "Placed 1 block" } });
  });

  it("a stroke is one commit, at its end", () => {
    const { session, events } = makeSession();
    arm(session, "place", GOLD);
    session.touchMove(FINGER.x, FINGER.y);
    runFrames();
    session.touchStrokeBegin(FINGER.x, FINGER.y);
    session.touchMove(55, FINGER.y);
    runFrames();
    expect(kinds(events)).toEqual([]);
    session.touchStrokeEnd(55, FINGER.y);
    session.touchEnd();
    expect(kinds(events)).toEqual(["commit"]);
  });

  it("undo and redo are events of their own", () => {
    const { session, events } = makeSession();
    arm(session, "place", GOLD);
    session.touchTap(FINGER.x, FINGER.y);
    session.undo();
    session.redo();
    expect(kinds(events)).toEqual(["commit", "undo", "redo"]);
  });

  it("an undo with nothing to undo is no event", () => {
    const { session, events } = makeSession();
    session.undo();
    session.redo();
    expect(events).toEqual([]);
  });

  it("cancelling a pending action is a cancel", () => {
    const { session, events } = makeSession();
    arm(session, "line");
    session.touchTap(35, 100);
    session.cancelPending();
    expect(kinds(events)).toEqual(["cancel"]);
  });

  it("a stroke taken back by a second finger is a cancel; a plain preview is not", () => {
    const { session, events } = makeSession();
    arm(session, "place", GOLD);
    session.touchMove(FINGER.x, FINGER.y);
    runFrames();
    session.touchCancel(); // nothing in progress yet: a preview only
    expect(events).toEqual([]);

    session.touchMove(FINGER.x, FINGER.y);
    runFrames();
    session.touchStrokeBegin(FINGER.x, FINGER.y);
    session.touchMove(55, FINGER.y);
    runFrames();
    session.touchCancel();
    expect(kinds(events)).toEqual(["cancel"]);
    expect(session.undoCount).toBe(0);
  });

  it("a refused nudge is a refuse and nothing moves", () => {
    const { session, events } = makeSession();
    arm(session, "line");
    session.touchTap(35, 100);
    session.setSlice({ y0: 1, y1: 1 }); // only layer 1 is visible
    const before = session.pending;
    expect(session.nudge(1, -1)).toBe(false); // down to layer 0, hidden
    expect(session.pending).toBe(before);
    expect(kinds(events)).toEqual(["refuse"]);
  });

  it("a session with no listener is fine", () => {
    const { session } = makeSession();
    session.onEvent = null;
    arm(session, "place", GOLD);
    expect(() => session.touchTap(FINGER.x, FINGER.y)).not.toThrow();
  });
});

describe("the camera buttons", () => {
  it("Zoom to this block: the double tap's focus on the inspected block, with any tool", () => {
    const { session, focuses } = makeSession();
    arm(session, "place");
    session.touchTap(FINGER.x, FINGER.y); // inspected (3, 0, 3) after the tap
    focuses.length = 0;
    expect(session.focusInspected()).toBe(true);
    expect(focuses).toEqual([{ target: [3.5, 0.5, 3.5], distance: 20 }]);
    expect(session.message).toBe("Zoomed in on 3, 0, 3");
    expect(session.undoCount).toBe(1); // the tap's edit; the zoom adds nothing
  });

  it("does nothing without an inspected block", () => {
    const { session, focuses } = makeSession();
    expect(session.focusInspected()).toBe(false);
    expect(focuses).toEqual([]);
  });

  it("does nothing in the fly camera", () => {
    const { session, focuses } = makeSession();
    session.inspected = [3, 0, 3];
    session.setCameraMode("fly");
    expect(session.focusInspected()).toBe(false);
    expect(focuses).toEqual([]);
  });

  it("Centre on the build asks the renderer to frame the build, and changes nothing else", () => {
    const { session, log } = makeSession();
    expect(session.centreOnBuild()).toBe(true);
    expect(log.framed).toBe(1);
    expect(session.message).toBe("Centred on the build");
    expect(session.undoCount).toBe(0);
  });

  it("Centre on the build does nothing in the fly camera", () => {
    const { session, log } = makeSession();
    session.setCameraMode("fly");
    expect(session.centreOnBuild()).toBe(false);
    expect(log.framed).toBe(0);
  });
});

describe("messages that name keys say taps in the touch layout", () => {
  it("Paste with nothing copied", () => {
    const desktop = makeSession().session;
    desktop.setTool("paste");
    expect(desktop.message).toContain("Ctrl+C");

    const touch = makeSession().session;
    touch.touchUi = true;
    touch.setTool("paste");
    expect(touch.message).not.toContain("Ctrl");
    expect(touch.message).toContain("Copy");
  });

  it("a selection action with no selection", () => {
    const desktop = makeSession().session;
    desktop.fill();
    expect(desktop.message).toContain("drag between two blocks");

    const touch = makeSession().session;
    touch.touchUi = true;
    touch.fill();
    expect(touch.message).not.toContain("drag");
    expect(touch.message).toContain("tap two corners");
  });
});

describe("multi-finger taps through the router and the session", () => {
  /** The router wired as the page does it, with the shortcuts set by `settings`. */
  function wire(settings: { twoFingerUndo: boolean; threeFingerRedo: boolean }) {
    const made = makeSession();
    const camera: string[] = [];
    const taps: Array<2 | 3> = [];
    const router = new TouchRouter({
      target: () => made.session,
      camera: (i) => camera.push(i.type),
      multiTap: (fingers) => {
        taps.push(fingers);
        const action = multiTapAction(fingers, settings);
        if (action === "undo") made.session.undo();
        else if (action === "redo") made.session.redo();
      },
      arbiter: {
        setTimeout: () => 0 as unknown as ReturnType<typeof setTimeout>,
        clearTimeout() {},
      },
    });
    const feed = (id: number, type: "down" | "move" | "up", x: number, y: number, time: number) =>
      router.feed({ id, type, x, y, time });
    return { ...made, router, camera, taps, feed };
  }

  /** Two fingers go down and up together, quickly and without moving. */
  const twoFingerTap = (h: ReturnType<typeof wire>, t0: number): void => {
    h.feed(1, "down", 100, 300, t0);
    h.feed(2, "down", 160, 300, t0 + 10);
    h.feed(1, "up", 100, 300, t0 + 80);
    h.feed(2, "up", 160, 300, t0 + 90);
  };

  const threeFingerTap = (h: ReturnType<typeof wire>, t0: number): void => {
    h.feed(1, "down", 100, 300, t0);
    h.feed(2, "down", 160, 300, t0 + 10);
    h.feed(3, "down", 220, 300, t0 + 20);
    h.feed(1, "up", 100, 300, t0 + 90);
    h.feed(2, "up", 160, 300, t0 + 95);
    h.feed(3, "up", 220, 300, t0 + 100);
  };

  /** One block placed, so there is something to undo. */
  const place = (h: ReturnType<typeof wire>): void => {
    arm(h.session, "place", GOLD);
    h.session.touchTap(FINGER.x, FINGER.y);
  };

  it("a two-finger tap undoes when the shortcut is on", () => {
    const h = wire({ twoFingerUndo: true, threeFingerRedo: false });
    place(h);
    expect(h.session.undoCount).toBe(1);
    twoFingerTap(h, 0);
    expect(h.taps).toEqual([2]);
    expect(h.session.undoCount).toBe(0);
    expect(h.session.canRedo).toBe(true);
  });

  it("a three-finger tap redoes when the shortcut is on", () => {
    const h = wire({ twoFingerUndo: false, threeFingerRedo: true });
    place(h);
    h.session.undo();
    expect(h.session.canRedo).toBe(true);
    threeFingerTap(h, 0);
    expect(h.taps).toEqual([3]);
    expect(h.session.undoCount).toBe(1);
    expect(h.session.canRedo).toBe(false);
  });

  it("with the shortcuts off (the default) the taps reach the router and do nothing", () => {
    const h = wire({ twoFingerUndo: false, threeFingerRedo: false });
    place(h);
    twoFingerTap(h, 0);
    h.session.undo();
    threeFingerTap(h, 1000);
    expect(h.taps).toEqual([2, 3]);
    expect(h.session.undoCount).toBe(0); // only the explicit undo above
    expect(h.session.canRedo).toBe(true);
  });

  it("the two-finger setting does not make three fingers redo, nor the other way round", () => {
    const h = wire({ twoFingerUndo: true, threeFingerRedo: false });
    place(h);
    h.session.undo();
    threeFingerTap(h, 0);
    expect(h.session.canRedo).toBe(true);
    expect(h.session.undoCount).toBe(0);
  });

  it("a two-finger tap during a tool gesture undoes and never also places a block", () => {
    const h = wire({ twoFingerUndo: true, threeFingerRedo: false });
    place(h); // block one at (3, 1, 3)
    expect(h.session.undoCount).toBe(1);
    const before = h.volume.get(7, 1, 3);
    // Place is armed. The first finger lands over a cell (the tool's gesture begins), the second
    // lands and both lift quickly.
    h.feed(1, "down", 75, 100, 0);
    runFrames();
    expect(h.session.reticle).not.toBeNull();
    h.feed(2, "down", 135, 100, 20);
    expect(h.session.reticle).toBeNull(); // the tool's work was cancelled by the second finger
    h.feed(1, "up", 75, 100, 90);
    h.feed(2, "up", 135, 100, 100);
    runFrames();
    expect(h.taps).toEqual([2]);
    expect(h.volume.get(7, 1, 3)).toBe(before); // nothing was placed at the cursor
    expect(h.session.undoCount).toBe(0); // and the earlier block was undone
  });

  it("the same tap with the shortcut off places nothing either", () => {
    const h = wire({ twoFingerUndo: false, threeFingerRedo: false });
    arm(h.session, "place", GOLD);
    h.feed(1, "down", 75, 100, 0);
    runFrames();
    h.feed(2, "down", 135, 100, 20);
    h.feed(1, "up", 75, 100, 90);
    h.feed(2, "up", 135, 100, 100);
    runFrames();
    expect(h.session.undoCount).toBe(0);
    expect(h.volume.get(7, 1, 3)).toBeUndefined();
  });

  it("a two-finger tap during a stroke does not undo: the stroke was dragged, so it is no tap", () => {
    const h = wire({ twoFingerUndo: true, threeFingerRedo: false });
    place(h);
    arm(h.session, "place", GOLD);
    h.feed(1, "down", FINGER.x + 40, FINGER.y, 0);
    h.feed(1, "move", FINGER.x + 60, FINGER.y, 30);
    h.feed(1, "move", FINGER.x + 80, FINGER.y, 60);
    runFrames();
    h.feed(2, "down", 250, 100, 100);
    h.feed(1, "up", FINGER.x + 80, FINGER.y, 160);
    h.feed(2, "up", 250, 100, 170);
    runFrames();
    expect(h.taps).toEqual([]);
    expect(h.session.undoCount).toBe(1); // the earlier block only; the stroke was reverted, not undone
  });

  it("two fingers that move are a pan or a pinch, not a tap", () => {
    const h = wire({ twoFingerUndo: true, threeFingerRedo: false });
    place(h);
    h.feed(1, "down", 100, 300, 0);
    h.feed(2, "down", 160, 300, 10);
    h.feed(1, "move", 100, 340, 60);
    h.feed(2, "move", 160, 340, 60);
    h.feed(1, "up", 100, 340, 120);
    h.feed(2, "up", 160, 340, 130);
    expect(h.taps).toEqual([]);
    expect(h.session.undoCount).toBe(1);
  });

  it("two fingers held longer than a tap are not a tap", () => {
    const h = wire({ twoFingerUndo: true, threeFingerRedo: false });
    place(h);
    h.feed(1, "down", 100, 300, 0);
    h.feed(2, "down", 160, 300, 10);
    h.feed(1, "up", 100, 300, 500);
    h.feed(2, "up", 160, 300, 510);
    expect(h.taps).toEqual([]);
    expect(h.session.undoCount).toBe(1);
  });

  it("a single tap in View is not a multi-finger tap", () => {
    const h = wire({ twoFingerUndo: true, threeFingerRedo: true });
    place(h);
    h.session.setTool("navigate");
    h.feed(1, "down", 100, 300, 0);
    h.feed(1, "up", 100, 300, 60);
    expect(h.taps).toEqual([]);
    expect(h.session.undoCount).toBe(1);
  });

  it("works in View too, with no tool armed", () => {
    const h = wire({ twoFingerUndo: true, threeFingerRedo: false });
    place(h);
    h.session.setTool("navigate");
    twoFingerTap(h, 0);
    expect(h.taps).toEqual([2]);
    expect(h.session.undoCount).toBe(0);
  });

  it("undoing from the tap also drops a pending action, as the Undo button does", () => {
    const h = wire({ twoFingerUndo: true, threeFingerRedo: false });
    place(h);
    arm(h.session, "line", GOLD);
    h.session.touchTap(35, 100);
    expect(h.session.pending).not.toBeNull();
    twoFingerTap(h, 0);
    expect(h.session.pending).toBeNull();
    expect(h.session.undoCount).toBe(0);
  });
});

describe("the volume is the one the session was given", () => {
  it("lastChange does not copy or touch the volume", () => {
    const volume = makeVolume();
    const copy = cloneVolume(volume);
    const { session } = makeSession({ volume });
    expect(session.lastChange).toBeNull();
    expect(volume.get(0, 0, 0)).toBe(copy.get(0, 0, 0));
    void OFFSET;
  });
});
