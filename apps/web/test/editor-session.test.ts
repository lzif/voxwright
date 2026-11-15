// SPDX-License-Identifier: AGPL-3.0-only

// Tests for keyboard coordinate inspection (`inspectAt`), `AIR` handling in `inspectedBlock`,
// and keeping `hover` synced across `applyHover`, `replace`, brush strokes, cancels and undo/redo.

import { AIR, type Vec3, Volume } from "@voxwright/core";
import type { WebglRenderer } from "@voxwright/render/webgl";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditSession, type Hover } from "../src/lib/editor-session.svelte.ts";

const STONE = "minecraft:stone";
const PLANKS = "minecraft:oak_planks";
const GOLD = "minecraft:gold_block";
const STAIRS_NORTH =
  "minecraft:oak_stairs[facing=north,half=bottom,shape=straight,waterlogged=false]";
const STAIRS_EAST =
  "minecraft:oak_stairs[facing=east,half=bottom,shape=straight,waterlogged=false]";

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

const runFrames = (): void => {
  for (const f of frames.splice(0)) f();
};

function makeVolume(): Volume {
  const volume = new Volume();
  for (let x = 0; x < 16; x++) {
    for (let z = 0; z < 16; z++) volume.set(x, 0, z, STONE);
  }
  volume.set(3, 0, 3, PLANKS);
  return volume;
}

function makeSession(options: { volume?: Volume } = {}) {
  const volume = options.volume ?? makeVolume();
  const highlights: Array<Array<{ min: Vec3; max: Vec3; style: string }>> = [];
  const renderer = {
    getPose: () => ({ distance: 40 }),
    focusOn: () => {},
    frameCamera: () => {},
    // Fake top-down raycast over cell (floor(x / 10), _, floor(y / 10)).
    rayFromClient: (x: number, y: number) => ({
      origin: [x / 10, 10, y / 10] as [number, number, number],
      direction: [0, -1, 0] as [number, number, number],
    }),
    markDirty: () => {},
    highlight: (boxes: Array<{ min: Vec3; max: Vec3; style: string }>) => {
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
    focus: () => {},
    setPointerCapture: () => {},
    hasPointerCapture: () => true,
    releasePointerCapture: () => {},
  } as unknown as HTMLCanvasElement;
  const session = new EditSession({
    renderer,
    canvas,
    volume,
    dataVersion: null,
    packBlocks: [],
    isOverCanvas: () => true,
  });
  return { session, volume, highlights, canvas };
}

type PointerHandlers = {
  onPointerDown(e: unknown): void;
  onPointerMove(e: unknown): void;
  onPointerUp(e: unknown): void;
  onPointerLeave(e: unknown): void;
  applyHover(hit: Hover | null): void;
};

const internal = (s: EditSession): PointerHandlers => s as unknown as PointerHandlers;

const mouseEvent = (canvas: HTMLCanvasElement, x: number, y: number, buttons = 0) => ({
  target: canvas,
  pointerType: "mouse",
  pointerId: 1,
  button: 0,
  buttons,
  clientX: x,
  clientY: y,
  shiftKey: false,
  altKey: false,
  stopPropagation: () => {},
  preventDefault: () => {},
});

/** Center of cell (cx, cz) in client pixels; touch cursor sits 64 px below at y + 64. */
const cellPx = (cx: number, cz: number): { x: number; y: number } => ({
  x: cx * 10 + 5,
  y: cz * 10 + 5,
});

const hoverBoxes = (highlights: Array<Array<{ min: Vec3; max: Vec3; style: string }>>) =>
  (highlights.at(-1) ?? []).filter((b) => b.style === "hover");

describe("inspectAt and air handling", () => {
  it("inspects a solid block without modifying the volume or history, stripping NBT from the message", () => {
    const { session, volume, highlights } = makeSession();
    const chestWithNbt = 'minecraft:chest[facing=north]{Items:[{Slot:0b,id:"minecraft:apple"}]}';
    volume.set(4, 1, 5, chestWithNbt);
    const input: [number, number, number] = [4, 1, 5];

    expect(session.inspectAt(input)).toBe(true);
    input[0] = 99;

    expect(session.inspected).toEqual([4, 1, 5]);
    expect(session.inspectedBlock).toBe(chestWithNbt);
    expect(session.message).toBe("minecraft:chest[facing=north] at 4, 1, 5");
    expect(session.error).toBe("");
    expect(session.undoCount).toBe(0);
    expect(hoverBoxes(highlights)).toEqual([{ min: [4, 1, 5], max: [4, 1, 5], style: "hover" }]);
  });

  it("clears inspected and highlight when inspecting an unset cell", () => {
    const { session, highlights } = makeSession();
    expect(session.inspectAt([3, 0, 3])).toBe(true);
    expect(hoverBoxes(highlights)).toHaveLength(1);

    session.error = "previous error";
    expect(session.inspectAt([8, 4, 8])).toBe(false);
    expect(session.inspected).toBeNull();
    expect(session.inspectedBlock).toBeNull();
    expect(session.message).toBe("No block at 8, 4, 8.");
    expect(session.error).toBe("");
    expect(hoverBoxes(highlights)).toEqual([]);
  });

  it("treats explicit minecraft:air as empty in inspectAt and inspectedBlock", () => {
    const { session, volume, highlights } = makeSession();
    volume.set(2, 0, 2, AIR);

    expect(session.inspectAt([3, 0, 3])).toBe(true);
    expect(session.inspectAt([2, 0, 2])).toBe(false);
    expect(session.inspected).toBeNull();
    expect(session.inspectedBlock).toBeNull();
    expect(session.message).toBe("No block at 2, 0, 2.");
    expect(hoverBoxes(highlights)).toEqual([]);

    // Erasing a cell writes minecraft:air; inspectedBlock must treat that cell as null too.
    expect(session.eraseAt([3, 0, 3])).toBe(true);
    expect(volume.get(3, 0, 3)).toBe(AIR);
    expect(session.inspectedBlock).toBeNull();
    expect(hoverBoxes(highlights)).toEqual([]);
  });

  it("rejects non-integer, non-finite, out-of-range, and cleared coordinate inputs", () => {
    const { session } = makeSession();
    expect(session.inspectAt([3, 0, 3])).toBe(true);

    const badCases: Vec3[] = [
      [1.5, 0, 0],
      [0, Number.NaN, 0],
      [0, 0, Number.POSITIVE_INFINITY],
      [0x80000000, 0, 0],
      [null as unknown as number, 0, 0],
    ];
    for (const pos of badCases) {
      session.message = "stale message";
      expect(session.inspectAt(pos)).toBe(false);
      expect(session.error).toBe("position must be integer coordinates");
      expect(session.message).toBe("");
      expect(session.inspected).toEqual([3, 0, 3]);
    }
  });
});

describe("hover syncing after edits, brush strokes, and undo/redo", () => {
  it("applyHover refreshes when the block or normal changes on the same cell", () => {
    const { session, volume, canvas } = makeSession();
    session.setTool("place");
    // Point at (3, 0, 3) by using z = 3.
    const pt = cellPx(3, 3);
    internal(session).onPointerMove(mouseEvent(canvas, pt.x, pt.y));
    runFrames();
    expect(session.hover).toEqual({
      position: [3, 0, 3],
      adjacent: [3, 1, 3],
      normal: [0, 1, 0],
      block: PLANKS,
    });

    // Mutate the block in place, then wiggle the pointer on the same cell: applyHover must update.
    volume.set(3, 0, 3, GOLD);
    internal(session).onPointerMove(mouseEvent(canvas, pt.x + 1, pt.y + 1));
    runFrames();
    expect(session.hover?.block).toBe(GOLD);

    // Changing only normal on the same position & adjacent must also replace hover.
    const prev = session.hover;
    internal(session).applyHover({
      position: [3, 0, 3],
      adjacent: [3, 1, 3],
      normal: [1, 0, 0],
      block: GOLD,
    });
    expect(session.hover).not.toBe(prev);
    expect(session.hover?.normal).toEqual([1, 0, 0]);
  });

  it("replaceSelection updates hover.block with a new object reference, or clears hover to null on air", () => {
    const { session, highlights, canvas } = makeSession();
    session.setTool("place");
    const pt = cellPx(3, 3);
    internal(session).onPointerMove(mouseEvent(canvas, pt.x, pt.y));
    runFrames();
    const before = session.hover;
    expect(before?.block).toBe(PLANKS);

    session.setSelection({ min: [2, 0, 2], max: [4, 0, 4] });
    session.block = GOLD;
    expect(session.replace(PLANKS)).toBe(true);

    expect(session.hover).not.toBeNull();
    expect(session.hover).not.toBe(before);
    expect(session.hover).toEqual({
      position: [3, 0, 3],
      adjacent: [3, 1, 3],
      normal: [0, 1, 0],
      block: GOLD,
    });

    // Replacing the hovered block with air drops hover and removes the hover/ghost highlights.
    session.block = AIR;
    expect(session.replace(GOLD)).toBe(true);
    expect(session.hover).toBeNull();
    const last = highlights.at(-1) ?? [];
    expect(last.some((b) => b.style === "hover" || b.style === "ghost")).toBe(false);
  });

  it("setProperty updates hover.block when the hovered block changes state", () => {
    const { session, volume, canvas } = makeSession();
    volume.set(3, 0, 3, STAIRS_NORTH);
    session.setTool("navigate");
    const pt = cellPx(3, 3);
    internal(session).onPointerMove(mouseEvent(canvas, pt.x, pt.y));
    runFrames();
    const before = session.hover;
    expect(before?.block).toBe(STAIRS_NORTH);

    expect(session.setProperty("facing", "east")).toBe(true);
    expect(session.hover).not.toBe(before);
    expect(session.hover?.block).toBe(STAIRS_EAST);
  });

  it("mouse paint click & drag keeps hover synced to the new block without stale overwrite", () => {
    const { session, canvas } = makeSession();
    session.setTool("paint");
    session.block = GOLD;

    const p1 = cellPx(3, 3);
    const p2 = cellPx(4, 3);
    internal(session).onPointerMove(mouseEvent(canvas, p1.x, p1.y));
    runFrames();
    expect(session.hover?.block).toBe(PLANKS);

    internal(session).onPointerDown(mouseEvent(canvas, p1.x, p1.y, 1));
    expect(session.hover).toMatchObject({ position: [3, 0, 3], block: GOLD });

    internal(session).onPointerMove(mouseEvent(canvas, p2.x, p2.y, 1));
    runFrames();
    expect(session.hover).toMatchObject({ position: [4, 0, 3], block: GOLD });

    internal(session).onPointerUp(mouseEvent(canvas, p2.x, p2.y, 0));
    expect(session.hover).toMatchObject({ position: [4, 0, 3], block: GOLD });
  });

  it("touch paint and erase strokes do not restore stale pre-edit hits over hover or reticle", () => {
    const paint = makeSession();
    paint.session.setTool("paint");
    paint.session.block = GOLD;
    const f1 = cellPx(3, 3);
    const f2 = cellPx(4, 3);
    paint.session.touchMove(f1.x, f1.y + 64);
    runFrames();
    expect(paint.session.hover?.block).toBe(PLANKS);
    paint.session.touchStrokeBegin(f1.x, f1.y + 64);
    expect(paint.session.hover).toMatchObject({ position: [3, 0, 3], block: GOLD });

    paint.session.touchMove(f2.x, f2.y + 64);
    runFrames();
    expect(paint.session.hover).toMatchObject({ position: [4, 0, 3], block: GOLD });
    expect(paint.session.reticle?.hit).toMatchObject({ position: [4, 0, 3], block: GOLD });

    const erase = makeSession();
    erase.session.setTool("erase");
    erase.session.touchMove(f1.x, f1.y + 64);
    runFrames();
    expect(erase.session.hover?.position).toEqual([3, 0, 3]);
    erase.session.touchStrokeBegin(f1.x, f1.y + 64);
    expect(erase.session.hover).toBeNull();

    erase.session.touchMove(f2.x, f2.y + 64);
    runFrames();
    expect(erase.volume.get(4, 0, 3)).toBe(AIR);
    expect(erase.session.hover).toBeNull();
    expect(erase.session.reticle?.hit).toBeNull();
  });

  it("cancelling an active mouse brush stroke syncs hover back to the reverted block", () => {
    const { session, canvas } = makeSession();
    session.setTool("paint");
    session.block = GOLD;
    const p1 = cellPx(3, 3);
    internal(session).onPointerMove(mouseEvent(canvas, p1.x, p1.y));
    runFrames();
    internal(session).onPointerDown(mouseEvent(canvas, p1.x, p1.y, 1));
    expect(session.hover?.block).toBe(GOLD);

    expect(session.perform({ type: "escape" })).toBe(true);
    expect(session.hover?.block).toBe(PLANKS);
  });

  it("undo and redo sync hover.block and clear hover when undone to empty or air", () => {
    const { session, canvas } = makeSession();
    session.setTool("place");
    const pt = cellPx(3, 3);
    internal(session).onPointerMove(mouseEvent(canvas, pt.x, pt.y));
    runFrames();

    session.setSelection({ min: [3, 0, 3], max: [3, 0, 3] });
    session.block = GOLD;
    expect(session.replace(PLANKS)).toBe(true);
    const afterReplace = session.hover;
    expect(afterReplace?.block).toBe(GOLD);

    session.undo();
    expect(session.hover).not.toBe(afterReplace);
    expect(session.hover?.block).toBe(PLANKS);

    const afterUndo = session.hover;
    session.redo();
    expect(session.hover).not.toBe(afterUndo);
    expect(session.hover?.block).toBe(GOLD);

    // Placing above (3, 0, 3), hovering the new block, and undoing clears hover and its highlight.
    const { session: s2, highlights: h2, canvas: c2 } = makeSession();
    expect(s2.placeAt([5, 1, 5], GOLD)).toBe(true);
    s2.setTool("place");
    const p5 = cellPx(5, 5);
    internal(s2).onPointerMove(mouseEvent(c2, p5.x, p5.y));
    runFrames();
    expect(s2.hover).toMatchObject({ position: [5, 1, 5], block: GOLD });

    s2.undo();
    expect(s2.hover).toBeNull();
    expect(s2.inspectedBlock).toBeNull();
    expect(hoverBoxes(h2)).toEqual([]);
  });

  it("undoing a block placed over explicit minecraft:air also clears hover and its highlight", () => {
    const { session, volume, highlights, canvas } = makeSession();
    volume.set(5, 1, 5, AIR);
    expect(session.placeAt([5, 1, 5], GOLD)).toBe(true);
    session.setTool("place");
    const p5 = cellPx(5, 5);
    internal(session).onPointerMove(mouseEvent(canvas, p5.x, p5.y));
    runFrames();
    expect(session.hover).toMatchObject({ position: [5, 1, 5], block: GOLD });

    session.undo();
    expect(volume.get(5, 1, 5)).toBe(AIR);
    expect(session.hover).toBeNull();
    expect(session.inspectedBlock).toBeNull();
    expect(hoverBoxes(highlights)).toEqual([]);
  });
});
