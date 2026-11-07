// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  boxBetween,
  cellOnPlane,
  clipRayToBox,
  followLayerBounds,
  inSlice,
  isTypingTarget,
  type KeyLike,
  keyAction,
  normalAxis,
  normalizeBlockInput,
  packBlockIds,
  paletteEntries,
  searchPalette,
  shiftBox,
  TOOLS,
  toolTitle,
  withoutNbt,
} from "../src/lib/editing.ts";

const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("keyAction", () => {
  it("maps undo and redo, with Ctrl or Cmd", () => {
    expect(keyAction(key("z", { ctrlKey: true }))).toEqual({ type: "undo" });
    expect(keyAction(key("z", { metaKey: true }))).toEqual({ type: "undo" });
    expect(keyAction(key("Z", { ctrlKey: true, shiftKey: true }))).toEqual({ type: "redo" });
    expect(keyAction(key("y", { ctrlKey: true }))).toEqual({ type: "redo" });
    expect(keyAction(key("y", { ctrlKey: true, shiftKey: true }))).toBeNull();
  });

  it("maps the clipboard keys and leaves other Ctrl combinations to the browser", () => {
    expect(keyAction(key("c", { ctrlKey: true }))).toEqual({ type: "copy" });
    expect(keyAction(key("v", { ctrlKey: true }))).toEqual({ type: "paste" });
    expect(keyAction(key("s", { ctrlKey: true }))).toBeNull();
    expect(keyAction(key("a", { ctrlKey: true }))).toBeNull();
    expect(keyAction(key("z", { ctrlKey: true, altKey: true }))).toBeNull();
  });

  it("gives every tool its own key, and a plain key picks the tool", () => {
    const keys = TOOLS.map((t) => t.key).filter((k) => k !== null);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of TOOLS) {
      if (t.key !== null) expect(keyAction(key(t.key))).toEqual({ type: "tool", tool: t.id });
    }
  });

  it("keeps the fly camera's keys free", () => {
    for (const k of ["w", "a", "s", "d", "e", "q", "c", " ", "ArrowUp"]) {
      expect(keyAction(key(k))).toBeNull();
    }
  });

  it("ignores letters held with Shift or Alt, which belong to the camera", () => {
    expect(keyAction(key("p", { shiftKey: true }))).toBeNull();
    expect(keyAction(key("p", { altKey: true }))).toBeNull();
  });

  it("maps fill, rotate and escape", () => {
    expect(keyAction(key("f"))).toEqual({ type: "fill" });
    expect(keyAction(key("]"))).toEqual({ type: "rotate", direction: "cw" });
    expect(keyAction(key("["))).toEqual({ type: "rotate", direction: "ccw" });
    expect(keyAction(key("Escape"))).toEqual({ type: "escape" });
  });

  it("puts the shortcut in a tool's tooltip", () => {
    const place = TOOLS.find((t) => t.id === "place") as (typeof TOOLS)[number];
    expect(toolTitle(place)).toContain("(P)");
    const paste = TOOLS.find((t) => t.id === "paste") as (typeof TOOLS)[number];
    expect(toolTitle(paste)).toBe(paste.help);
  });
});

describe("isTypingTarget", () => {
  it("is true for text fields and false for sliders, buttons and the page", () => {
    expect(isTypingTarget({ tagName: "INPUT", type: "search" } as unknown as EventTarget)).toBe(
      true,
    );
    expect(isTypingTarget({ tagName: "INPUT", type: "text" } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: "INPUT", type: "number" } as unknown as EventTarget)).toBe(
      true,
    );
    expect(isTypingTarget({ tagName: "TEXTAREA" } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" } as unknown as EventTarget)).toBe(true);
    expect(
      isTypingTarget({ tagName: "DIV", isContentEditable: true } as unknown as EventTarget),
    ).toBe(true);
    expect(isTypingTarget({ tagName: "INPUT", type: "range" } as unknown as EventTarget)).toBe(
      false,
    );
    expect(isTypingTarget({ tagName: "INPUT", type: "checkbox" } as unknown as EventTarget)).toBe(
      false,
    );
    expect(isTypingTarget({ tagName: "BUTTON" } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget({ tagName: "BODY" } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("the block palette", () => {
  const pack = {
    "blockstates/oak_stairs.json": {},
    "blockstates/stone.json": {},
    "blockstates/glass_pane.json": {},
    "models/block/stone.json": {},
  };

  it("reads block ids from the pack's blockstates only", () => {
    expect(packBlockIds(pack)).toEqual([
      "minecraft:glass_pane",
      "minecraft:oak_stairs",
      "minecraft:stone",
    ]);
  });

  it("lists the build's block states first, then pack ids the build does not use", () => {
    const entries = paletteEntries(
      [
        "minecraft:air",
        "minecraft:stone",
        "minecraft:chest[facing=west]{Items:[{Slot:0b}]}",
        "minecraft:oak_stairs[facing=north,half=bottom]",
      ],
      packBlockIds(pack),
    );
    expect(entries).toEqual([
      { block: "minecraft:chest[facing=west]", source: "build" },
      { block: "minecraft:oak_stairs[facing=north,half=bottom]", source: "build" },
      { block: "minecraft:stone", source: "build" },
      { block: "minecraft:glass_pane", source: "pack" },
    ]);
  });

  it("falls back to the build's own blocks when there is no pack", () => {
    const entries = paletteEntries(["minecraft:dirt", "minecraft:dirt[snowy=false]"], []);
    expect(entries.map((e) => e.source)).toEqual(["build", "build"]);
  });

  it("searches by words, ignoring the namespace and underscores", () => {
    const entries = paletteEntries([], packBlockIds(pack));
    expect(searchPalette(entries, "oak stair").shown.map((e) => e.block)).toEqual([
      "minecraft:oak_stairs",
    ]);
    expect(searchPalette(entries, "minecraft:glass").total).toBe(1);
    expect(searchPalette(entries, "STONE").shown[0]?.block).toBe("minecraft:stone");
    expect(searchPalette(entries, "nothing like it").total).toBe(0);
    expect(searchPalette(entries, "").total).toBe(3);
  });

  it("puts names that start with the query first and caps the list", () => {
    const entries = paletteEntries(
      [],
      ["minecraft:red_stone", "minecraft:stone", "minecraft:stone_bricks"],
    );
    expect(searchPalette(entries, "stone").shown.map((e) => e.block)).toEqual([
      "minecraft:stone",
      "minecraft:stone_bricks",
      "minecraft:red_stone",
    ]);
    const capped = searchPalette(entries, "", 2);
    expect(capped.shown).toHaveLength(2);
    expect(capped.total).toBe(3);
  });

  it("adds the default namespace to typed names", () => {
    expect(normalizeBlockInput("  oak_planks ")).toBe("minecraft:oak_planks");
    expect(normalizeBlockInput("mymod:thing")).toBe("mymod:thing");
    expect(normalizeBlockInput("")).toBe("");
    expect(withoutNbt("minecraft:chest[facing=west]{Items:[]}")).toBe(
      "minecraft:chest[facing=west]",
    );
  });
});

describe("rays and boxes", () => {
  const box = boxBetween([0, 0, 0], [3, 3, 3]);

  it("clips a ray to the box the volume fills, one cell grown", () => {
    const hit = clipRayToBox({ origin: [-10.5, 1.5, 1.5], direction: [1, 0, 0] }, box);
    expect(hit?.origin[0]).toBeCloseTo(-1);
    expect(hit?.length).toBeCloseTo(6); // from x=-1 to x=5
    expect(clipRayToBox({ origin: [-10.5, 9.5, 1.5], direction: [1, 0, 0] }, box)).toBeNull();
    expect(clipRayToBox({ origin: [-10.5, 1.5, 1.5], direction: [-1, 0, 0] }, box)).toBeNull();
  });

  it("leaves a ray that starts inside where it is", () => {
    const hit = clipRayToBox({ origin: [1.5, 1.5, 1.5], direction: [0, 1, 0] }, box);
    expect(hit?.origin).toEqual([1.5, 1.5, 1.5]);
  });

  it("finds the cell where a ray crosses a layer of cells", () => {
    const ray = { origin: [0.5, 10.5, 0.5] as const, direction: [0.6, -0.8, 0] as const };
    // To reach y=2 (the plane through the centres, y=2.5) it travels 8 / 0.8 = 10 along the ray.
    expect(cellOnPlane(ray, 1, 2)).toEqual([6, 2, 0]);
    // The lower face of the layer (y=2) and its upper face (y=3) are crossed a little apart.
    const slanted = { origin: [0.9, 10.5, 0.5] as const, direction: [0.6, -0.8, 0] as const };
    expect(cellOnPlane(slanted, 1, 2, 0)).toEqual([7, 2, 0]);
    expect(cellOnPlane(slanted, 1, 2, 0.5)).toEqual([6, 2, 0]);
    expect(cellOnPlane(slanted, 1, 2, 1)).toEqual([6, 2, 0]);
    expect(cellOnPlane({ origin: [0, 10, 0], direction: [1, 0, 0] }, 1, 2)).toBeNull();
    expect(cellOnPlane({ origin: [0, 10, 0], direction: [0, 1, 0] }, 1, 2)).toBeNull();
    expect(cellOnPlane({ origin: [0, 10, 0], direction: [0.001, -0.00001, 0] }, 1, 2)).toBeNull();
  });

  it("names the axis of a face normal", () => {
    expect(normalAxis([0, 1, 0])).toBe(1);
    expect(normalAxis([-1, 0, 0])).toBe(0);
    expect(normalAxis([0, 0, -1])).toBe(2);
    expect(normalAxis([0, 0, 0])).toBeNull();
  });

  it("limits cells to the shown layers", () => {
    expect(inSlice(null, 99)).toBe(true);
    expect(inSlice({ y0: 2, y1: 4 }, 2)).toBe(true);
    expect(inSlice({ y0: 2, y1: 4 }, 4)).toBe(true);
    expect(inSlice({ y0: 2, y1: 4 }, 5)).toBe(false);
    expect(inSlice({ y0: 2, y1: 4 }, 1)).toBe(false);
  });

  it("builds and moves boxes", () => {
    expect(boxBetween([3, 1, 5], [1, 4, 2])).toEqual({ min: [1, 1, 2], max: [3, 4, 5] });
    expect(shiftBox(box, [1, -1, 2])).toEqual({ min: [1, -1, 2], max: [4, 2, 5] });
  });
});

describe("followLayerBounds", () => {
  it("keeps a full range full when the build grows upwards", () => {
    expect(followLayerBounds({ yMin: 0, yMax: 9 }, 10, 0, 14, 0)).toEqual({ yMin: 0, yMax: 13 });
  });

  it("keeps a full range full when the build grows downwards or shrinks", () => {
    expect(followLayerBounds({ yMin: 0, yMax: 9 }, 10, 0, 12, -2)).toEqual({ yMin: 0, yMax: 11 });
    expect(followLayerBounds({ yMin: 0, yMax: 9 }, 10, 0, 6, 0)).toEqual({ yMin: 0, yMax: 5 });
  });

  it("leaves a narrowed range alone when the height grows above it", () => {
    expect(followLayerBounds({ yMin: 2, yMax: 5 }, 10, 0, 14, 0)).toEqual({ yMin: 2, yMax: 5 });
  });

  it("keeps the same world layers when the lowest block moves down", () => {
    // world layers 2..5 become dense 4..7 once the build reaches two layers lower
    expect(followLayerBounds({ yMin: 2, yMax: 5 }, 10, 0, 12, -2)).toEqual({ yMin: 4, yMax: 7 });
  });

  it("clamps a narrowed range to a shorter build and never inverts it", () => {
    expect(followLayerBounds({ yMin: 2, yMax: 8 }, 10, 0, 5, 0)).toEqual({ yMin: 2, yMax: 4 });
    expect(followLayerBounds({ yMin: 6, yMax: 8 }, 10, 0, 5, 0)).toEqual({ yMin: 4, yMax: 4 });
    expect(followLayerBounds({ yMin: 2, yMax: 5 }, 10, 0, 6, 3)).toEqual({ yMin: 0, yMax: 2 });
  });
});
