// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  applyCommand,
  blockProperties,
  type Command,
  CommandBuilder,
  cloneVolume,
  commandBytes,
  commandCellCount,
  copySelection,
  DirtyTracker,
  dirtySectionKeys,
  drawBox,
  drawLine,
  drawRectangle,
  EditError,
  Editor,
  eraseBlock,
  eraseCells,
  fillSelection,
  History,
  isEmptyCommand,
  linePoints,
  MAX_EXTENT,
  makeBox,
  mergeCommands,
  moveSelection,
  parseSectionKey,
  pasteClipboard,
  placeBlock,
  placeCells,
  replaceInSelection,
  revertCommand,
  setBlockProperty,
  UNSET,
  type Vec3,
  Volume,
  withBlockProperty,
} from "../src/index.ts";

const STONE = "minecraft:stone";
const DIRT = "minecraft:dirt";
const GLASS = "minecraft:glass";
const CHEST = "minecraft:chest[facing=north]";
const CHEST_NBT = 'minecraft:chest[facing=north]{Items:[{Slot:0b,id:"minecraft:stone"}]}';

/** Every set cell as a sorted list, for exact comparisons. */
export function snapshot(v: Volume): string[] {
  const out: string[] = [];
  v.eachCell((x, y, z, i) => out.push(`${x},${y},${z}=${v.palette[i]}`));
  return out.sort();
}

function sampleVolume(): Volume {
  const v = new Volume();
  for (let x = 0; x < 6; x++) {
    for (let z = 0; z < 6; z++) v.set(x, 0, z, (x + z) % 2 === 0 ? STONE : DIRT);
  }
  v.set(2, 1, 2, CHEST_NBT);
  v.set(3, 1, 3, "minecraft:air");
  return v;
}

describe("Command apply and revert", () => {
  it("round-trips place, erase and overwrite exactly", () => {
    const v = sampleVolume();
    const before = snapshot(v);
    const cmds = [
      placeBlock(v, [10, 4, -3], GLASS),
      eraseBlock(v, [0, 0, 0]),
      placeBlock(v, [1, 0, 0], GLASS),
    ];
    for (const c of cmds) applyCommand(v, c);
    expect(v.get(10, 4, -3)).toBe(GLASS);
    expect(v.get(0, 0, 0)).toBeUndefined();
    for (const c of [...cmds].reverse()) revertCommand(v, c);
    expect(snapshot(v)).toEqual(before);
    expect(v.size).toBe(before.length);
  });

  it("does not touch the volume while building", () => {
    const v = sampleVolume();
    const before = snapshot(v);
    fillSelection(v, makeBox([0, 0, 0], [5, 3, 5]), GLASS);
    expect(snapshot(v)).toEqual(before);
  });

  it("drops no-op cells and reports an empty command", () => {
    const v = sampleVolume();
    expect(isEmptyCommand(placeBlock(v, [0, 0, 0], STONE))).toBe(true);
    expect(isEmptyCommand(eraseBlock(v, [99, 99, 99]))).toBe(true);
    expect(isEmptyCommand(eraseCells(v, [[99, 99, 99]], { toAir: true }))).toBe(true);
    expect(commandCellCount(placeBlock(v, [0, 0, 0], DIRT))).toBe(1);
  });

  it("erases to air on request", () => {
    const v = sampleVolume();
    applyCommand(v, eraseBlock(v, [0, 0, 0], { toAir: true }));
    expect(v.get(0, 0, 0)).toBe("minecraft:air");
  });

  it("stores big edits as whole-section diffs and still reverts them", () => {
    const v = new Volume();
    v.set(1, 1, 1, DIRT);
    v.set(40, 40, 40, DIRT);
    const before = snapshot(v);
    const cmd = fillSelection(v, makeBox([0, 0, 0], [15, 15, 15]), STONE);
    expect(cmd.sections).toHaveLength(1);
    expect(cmd.before).toHaveLength(0);
    expect(commandCellCount(cmd)).toBe(4096);
    applyCommand(v, cmd);
    expect(v.size).toBe(4097);
    expect(v.get(1, 1, 1)).toBe(STONE);
    revertCommand(v, cmd);
    expect(snapshot(v)).toEqual(before);
    // A small edit stays sparse.
    expect(placeBlock(v, [0, 0, 0], STONE).sections).toHaveLength(0);
  });

  it("merges a stroke into one command with first-before and last-after", () => {
    const v = sampleVolume();
    const before = snapshot(v);
    const a = placeBlock(v, [0, 0, 0], GLASS);
    applyCommand(v, a);
    const b = placeBlock(v, [0, 0, 0], "minecraft:sand");
    applyCommand(v, b);
    const c = placeBlock(v, [50, 0, 0], GLASS);
    applyCommand(v, c);
    const merged = mergeCommands("drag", [a, b, c]);
    expect(commandCellCount(merged)).toBe(2);
    revertCommand(v, merged);
    expect(snapshot(v)).toEqual(before);
    applyCommand(v, merged);
    expect(v.get(0, 0, 0)).toBe("minecraft:sand");
  });

  it("rejects non-integer positions", () => {
    const v = new Volume();
    expect(() => placeBlock(v, [0.5, 0, 0], STONE)).toThrow(EditError);
    expect(() => new CommandBuilder(v, "x").setIndex(0, 0, 0, 7)).toThrow(EditError);
  });
});

describe("block entities", () => {
  it("drops the block entity when the block is replaced, and undo restores it", () => {
    const v = sampleVolume();
    expect(v.get(2, 1, 2)).toBe(CHEST_NBT);
    const cmd = placeBlock(v, [2, 1, 2], "minecraft:barrel[facing=up]");
    applyCommand(v, cmd);
    expect(v.get(2, 1, 2)).toBe("minecraft:barrel[facing=up]");
    revertCommand(v, cmd);
    expect(v.get(2, 1, 2)).toBe(CHEST_NBT);
  });

  it("drops it on erase and restores it on undo", () => {
    const v = sampleVolume();
    const cmd = eraseBlock(v, [2, 1, 2]);
    applyCommand(v, cmd);
    expect(v.get(2, 1, 2)).toBeUndefined();
    revertCommand(v, cmd);
    expect(v.get(2, 1, 2)).toBe(CHEST_NBT);
  });

  it("keeps it when the state is unchanged", () => {
    const v = sampleVolume();
    expect(isEmptyCommand(placeBlock(v, [2, 1, 2], CHEST))).toBe(true);
    expect(isEmptyCommand(fillSelection(v, makeBox([2, 1, 2], [2, 1, 2]), CHEST))).toBe(true);
    // Different properties are a different state: the block entity goes.
    applyCommand(v, placeBlock(v, [2, 1, 2], "minecraft:chest[facing=south]"));
    expect(v.get(2, 1, 2)).toBe("minecraft:chest[facing=south]");
  });

  it("keeps it when only a property is edited", () => {
    const v = sampleVolume();
    applyCommand(v, setBlockProperty(v, [2, 1, 2], "facing", "east"));
    expect(v.get(2, 1, 2)).toBe(CHEST_NBT.replace("north", "east"));
  });

  it("travels with a copy, a paste and a move", () => {
    const v = sampleVolume();
    const box = makeBox([2, 1, 2], [2, 1, 2]);
    const clip = copySelection(v, box);
    expect(clip.palette).toEqual([CHEST_NBT]);
    applyCommand(v, pasteClipboard(v, clip, [20, 0, 0]));
    expect(v.get(20, 0, 0)).toBe(CHEST_NBT);
    applyCommand(v, moveSelection(v, box, [0, 5, 0]));
    expect(v.get(2, 1, 2)).toBeUndefined();
    expect(v.get(2, 6, 2)).toBe(CHEST_NBT);
  });
});

describe("size limit", () => {
  it("grows past the current bounds in any direction", () => {
    const v = new Volume();
    v.set(0, 0, 0, STONE);
    applyCommand(v, placeBlock(v, [-100, 200, 300], STONE));
    expect(v.size).toBe(2);
  });

  it("refuses to grow past 512 per axis with a clear message", () => {
    const v = new Volume();
    v.set(0, 0, 0, STONE);
    expect(MAX_EXTENT).toBe(512);
    applyCommand(v, placeBlock(v, [511, 0, 0], STONE));
    expect(() => placeBlock(v, [512, 0, 0], STONE)).toThrow(
      /513 blocks long along x.*limit is 512/,
    );
    expect(() => placeBlock(v, [-1, 0, 0], STONE)).toThrow(EditError);
    expect(() => drawLine(v, [0, 0, 0], [0, 0, 600], STONE)).toThrow(/along z/);
    // Inside the limit it still works.
    expect(isEmptyCommand(placeBlock(v, [300, 0, 0], STONE))).toBe(false);
  });

  it("lets an already oversized volume be edited in place but not grow", () => {
    const v = new Volume();
    v.set(0, 0, 0, STONE);
    v.set(599, 0, 0, STONE);
    expect(isEmptyCommand(placeBlock(v, [300, 0, 0], DIRT))).toBe(false);
    expect(() => placeBlock(v, [600, 0, 0], DIRT)).toThrow(EditError);
  });

  it("checks the limit when moving or pasting out of range", () => {
    const v = new Volume();
    v.set(0, 0, 0, STONE);
    expect(() => moveSelection(v, makeBox([0, 0, 0], [0, 0, 0]), [0, 600, 0])).not.toThrow();
    v.set(0, 0, 5, STONE);
    expect(() => moveSelection(v, makeBox([0, 0, 5], [0, 0, 5]), [0, 600, 0])).toThrow(EditError);
    const clip = copySelection(v, makeBox([0, 0, 0], [0, 0, 5]));
    expect(() => pasteClipboard(v, clip, [0, 0, 600])).toThrow(EditError);
  });
});

describe("History", () => {
  function runEdits(v: Volume, h: History, n: number): Command[] {
    const out: Command[] = [];
    for (let i = 0; i < n; i++) {
      const c = placeBlock(v, [i, 0, 0], i % 2 ? STONE : DIRT);
      applyCommand(v, c);
      h.push(c);
      out.push(c);
    }
    return out;
  }

  it("restores the exact volume through a long undo and redo chain", () => {
    const v = sampleVolume();
    const h = new History();
    const states = [snapshot(v)];
    const steps: ((v: Volume) => Command)[] = [
      (x) => drawLine(x, [0, 2, 0], [9, 5, 7], GLASS),
      (x) => drawBox(x, [0, 0, 0], [4, 4, 4], DIRT, { hollow: true }),
      (x) => eraseBlock(x, [1, 0, 1]),
      (x) => fillSelection(x, makeBox([0, 0, 0], [20, 20, 20]), STONE),
      (x) => replaceInSelection(x, makeBox([0, 0, 0], [20, 20, 20]), STONE, "minecraft:gold_block"),
      (x) => moveSelection(x, makeBox([0, 0, 0], [6, 6, 6]), [10, 0, 3]),
    ];
    for (const step of steps) {
      const c = step(v);
      applyCommand(v, c);
      h.push(c);
      states.push(snapshot(v));
    }
    for (let i = steps.length - 1; i >= 0; i--) {
      expect(h.undo(v)).not.toBeNull();
      expect(snapshot(v)).toEqual(states[i]);
    }
    expect(h.undo(v)).toBeNull();
    for (let i = 1; i <= steps.length; i++) {
      expect(h.redo(v)).not.toBeNull();
      expect(snapshot(v)).toEqual(states[i]);
    }
    expect(h.redo(v)).toBeNull();
  });

  it("clears the redo stack on a new push", () => {
    const v = new Volume();
    const h = new History();
    runEdits(v, h, 3);
    h.undo(v);
    expect(h.canRedo).toBe(true);
    const bytesBefore = h.bytes;
    runEdits(v, h, 1);
    expect(h.canRedo).toBe(false);
    expect(h.redoCount).toBe(0);
    expect(h.bytes).toBeLessThanOrEqual(bytesBefore + 1000);
  });

  it("drops the oldest entries first when over the byte budget", () => {
    const v = new Volume();
    const one = placeBlock(v, [0, 0, 0], STONE);
    const per = commandBytes(one);
    const h = new History({ maxBytes: per * 3 + 10 });
    const labels: string[] = [];
    for (let i = 0; i < 6; i++) {
      const c = placeBlock(v, [i, 0, 0], STONE);
      applyCommand(v, { ...c, label: `e${i}` });
      h.push({ ...c, label: `e${i}` });
      labels.push(`e${i}`);
    }
    expect(h.undoCount).toBe(3);
    expect(h.undoLabels).toEqual(["e3", "e4", "e5"]);
    expect(h.bytes).toBeLessThanOrEqual(h.maxBytes);
    // The three newest undo; the dropped ones are gone for good.
    while (h.undo(v) !== null) {}
    expect(v.get(0, 0, 0)).toBe(STONE);
    expect(v.get(3, 0, 0)).toBeUndefined();
    expect(h.canUndo).toBe(false);
  });

  it("always keeps the newest command even if it alone exceeds the budget", () => {
    const v = new Volume();
    const h = new History({ maxBytes: 100 });
    const c = fillSelection(v, makeBox([0, 0, 0], [9, 9, 9]), STONE);
    expect(commandBytes(c)).toBeGreaterThan(100);
    applyCommand(v, c);
    expect(h.push(c)).toBe(0);
    expect(h.undoCount).toBe(1);
    h.undo(v);
    expect(v.size).toBe(0);
  });
});

describe("dirty sections", () => {
  it("marks only the section for an interior block", () => {
    const v = new Volume();
    const keys = dirtySectionKeys(placeBlock(v, [5, 5, 5], STONE));
    expect([...keys]).toEqual(["0,0,0"]);
  });

  it("adds face neighbours on a border", () => {
    const v = new Volume();
    expect([...dirtySectionKeys(placeBlock(v, [0, 5, 5], STONE))].sort()).toEqual([
      "-1,0,0",
      "0,0,0",
    ]);
    expect([...dirtySectionKeys(placeBlock(v, [15, 5, 5], STONE))].sort()).toEqual([
      "0,0,0",
      "1,0,0",
    ]);
    expect([...dirtySectionKeys(placeBlock(v, [5, 15, 5], STONE))].sort()).toEqual([
      "0,0,0",
      "0,1,0",
    ]);
  });

  it("adds edge and corner neighbours where borders meet", () => {
    const v = new Volume();
    expect(dirtySectionKeys(placeBlock(v, [0, 5, 0], STONE)).size).toBe(4);
    const corner = dirtySectionKeys(placeBlock(v, [15, 15, 15], STONE));
    expect(corner.size).toBe(8);
    expect(corner.has("1,1,1")).toBe(true);
    expect(corner.has("0,0,0")).toBe(true);
  });

  it("handles negative coordinates", () => {
    const v = new Volume();
    const keys = dirtySectionKeys(placeBlock(v, [-1, 5, 3], STONE));
    expect([...keys].sort()).toEqual(["-1,0,0", "0,0,0"]);
    expect([...dirtySectionKeys(placeBlock(v, [-16, -17, 3], STONE))].sort()).toEqual([
      "-1,-1,0",
      "-1,-2,0",
      "-2,-1,0",
      "-2,-2,0",
    ]);
    expect(parseSectionKey("-2,0,7")).toEqual([-2, 0, 7]);
    expect(() => parseSectionKey("1,2")).toThrow();
  });

  it("covers whole-section diffs", () => {
    const v = new Volume();
    const cmd = fillSelection(v, makeBox([0, 0, 0], [15, 15, 15]), STONE);
    expect(cmd.sections).toHaveLength(1);
    const keys = dirtySectionKeys(cmd);
    expect(keys.size).toBe(27);
  });

  it("is fed by the editor on run, undo and redo, and drained by take()", () => {
    const ed = new Editor(new Volume());
    ed.run(placeBlock(ed.volume, [0, 0, 0], STONE));
    expect(ed.dirty.take().sort()).toEqual([
      "-1,-1,-1",
      "-1,-1,0",
      "-1,0,-1",
      "-1,0,0",
      "0,-1,-1",
      "0,-1,0",
      "0,0,-1",
      "0,0,0",
    ]);
    expect(ed.dirty.size).toBe(0);
    ed.undo();
    expect(ed.dirty.has("0,0,0")).toBe(true);
    ed.dirty.take();
    ed.redo();
    expect(ed.dirty.has("0,0,0")).toBe(true);
    const t = new DirtyTracker();
    t.markSection(1, 2, 3);
    expect(t.take()).toEqual(["1,2,3"]);
  });
});

describe("Editor", () => {
  it("makes a drag one undo step and can cancel it", () => {
    const ed = new Editor(sampleVolume());
    const before = snapshot(ed.volume);
    const stroke = ed.beginStroke("brush");
    for (let i = 0; i < 10; i++) stroke.apply(placeBlock(ed.volume, [i, 3, 0], GLASS));
    expect(ed.volume.get(9, 3, 0)).toBe(GLASS);
    expect(stroke.commit()).toBe(true);
    expect(ed.history.undoCount).toBe(1);
    ed.undo();
    expect(snapshot(ed.volume)).toEqual(before);
    ed.redo();
    expect(ed.volume.get(9, 3, 0)).toBe(GLASS);

    const s2 = ed.beginStroke("oops");
    s2.apply(placeBlock(ed.volume, [0, 9, 0], DIRT));
    s2.apply(eraseBlock(ed.volume, [0, 3, 0]));
    s2.cancel();
    expect(ed.volume.get(0, 9, 0)).toBeUndefined();
    expect(ed.volume.get(0, 3, 0)).toBe(GLASS);
    expect(ed.history.undoCount).toBe(1);
    expect(() => s2.apply(placeBlock(ed.volume, [0, 0, 0], DIRT))).toThrow();
  });

  it("does not record empty runs or strokes", () => {
    const ed = new Editor(sampleVolume());
    expect(ed.run(placeBlock(ed.volume, [0, 0, 0], STONE))).toBe(false);
    const s = ed.beginStroke("nothing");
    s.apply(placeBlock(ed.volume, [0, 0, 0], STONE));
    expect(s.commit()).toBe(false);
    expect(ed.history.canUndo).toBe(false);
    expect(ed.undo()).toBe(false);
    expect(ed.redo()).toBe(false);
  });

  it("works on a clone so the source volume is untouched", () => {
    const source = sampleVolume();
    const before = snapshot(source);
    const ed = new Editor(cloneVolume(source));
    ed.run(fillSelection(ed.volume, makeBox([0, 0, 0], [5, 0, 5]), GLASS));
    expect(snapshot(source)).toEqual(before);
    expect(snapshot(cloneVolume(source))).toEqual(before);
  });
});

describe("tools", () => {
  const cells = (v: Volume, cmd: Command): string[] => {
    const w = cloneVolume(v);
    applyCommand(w, cmd);
    return snapshot(w);
  };

  it("places and erases", () => {
    const v = new Volume();
    expect(
      cells(v, placeBlock(v, [1, 2, 3], "minecraft:oak_stairs[half=bottom,facing=east]")),
    ).toEqual(["1,2,3=minecraft:oak_stairs[facing=east,half=bottom]"]);
    expect(
      cells(
        v,
        placeCells(
          v,
          [
            [0, 0, 0],
            [0, 0, 1],
          ],
          STONE,
        ),
      ),
    ).toHaveLength(2);
    expect(() => placeBlock(v, [0, 0, 0], "")).toThrow();
  });

  it("draws 3D Bresenham lines including both ends", () => {
    expect(linePoints([0, 0, 0], [0, 0, 0])).toEqual([[0, 0, 0]]);
    expect(linePoints([0, 0, 0], [4, 0, 0])).toEqual([
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [3, 0, 0],
      [4, 0, 0],
    ]);
    expect(linePoints([0, 0, 0], [4, 2, 0])).toEqual([
      [0, 0, 0],
      [1, 0, 0],
      [2, 1, 0],
      [3, 1, 0],
      [4, 2, 0],
    ]);
    const diag = linePoints([0, 0, 0], [3, 3, 3]);
    expect(diag).toHaveLength(4);
    expect(diag[3]).toEqual([3, 3, 3]);
    // Reversed line covers the same number of cells and ends where it should.
    const rev = linePoints([7, -2, 5], [-3, 4, 1]);
    expect(rev).toHaveLength(11);
    expect(rev[0]).toEqual([7, -2, 5]);
    expect(rev[10]).toEqual([-3, 4, 1]);
    // Consecutive cells are neighbours (Chebyshev distance 1).
    for (let i = 1; i < rev.length; i++) {
      const [a, b] = [rev[i - 1], rev[i]] as [Vec3, Vec3];
      expect(Math.max(...a.map((c, k) => Math.abs(c - (b[k] as number))))).toBe(1);
    }
    const v = new Volume();
    expect(cells(v, drawLine(v, [0, 0, 0], [4, 0, 0], STONE))).toHaveLength(5);
  });

  it("draws filled and hollow rectangles", () => {
    const v = new Volume();
    expect(cells(v, drawRectangle(v, [0, 5, 0], [3, 5, 2], STONE))).toHaveLength(12);
    const hollow = cells(v, drawRectangle(v, [0, 5, 0], [3, 5, 2], STONE, { hollow: true }));
    expect(hollow).toHaveLength(10);
    expect(hollow).not.toContain("1,5,1=minecraft:stone");
    expect(hollow).not.toContain("2,5,1=minecraft:stone");
    // A wall: the shared axis is detected, or given explicitly.
    expect(cells(v, drawRectangle(v, [0, 0, 4], [2, 3, 4], STONE))).toHaveLength(12);
    const wall = cells(v, drawRectangle(v, [0, 0, 4], [2, 3, 9], STONE, { normal: "z" }));
    expect(wall).toHaveLength(12);
    expect(wall.every((s) => s.split(",")[2]?.startsWith("4="))).toBe(true);
  });

  it("draws filled and hollow boxes", () => {
    const v = new Volume();
    expect(cells(v, drawBox(v, [3, 3, 3], [0, 0, 0], STONE))).toHaveLength(64);
    const shell = cells(v, drawBox(v, [0, 0, 0], [3, 3, 3], STONE, { hollow: true }));
    expect(shell).toHaveLength(64 - 8);
    expect(shell).not.toContain("1,1,1=minecraft:stone");
    expect(cells(v, drawBox(v, [0, 0, 0], [4, 4, 4], STONE, { hollow: true }))).toHaveLength(
      125 - 27,
    );
  });

  it("fills a selection, optionally only the empty cells", () => {
    const v = sampleVolume();
    const box = makeBox([0, 0, 0], [5, 1, 5]);
    const all = fillSelection(v, box, GLASS);
    expect(commandCellCount(all)).toBe(6 * 2 * 6 - 0);
    const empty = fillSelection(v, box, GLASS, { onlyEmpty: true });
    // 36 floor cells are occupied; the chest is occupied, the air cell counts as empty.
    expect(commandCellCount(empty)).toBe(6 * 6 - 2 + 1);
    const w = cloneVolume(v);
    applyCommand(w, empty);
    expect(w.get(0, 0, 0)).toBe(STONE);
    expect(w.get(3, 1, 3)).toBe(GLASS);
    expect(w.get(2, 1, 2)).toBe(CHEST_NBT);
  });

  it("replaces A with B inside a selection only", () => {
    const v = sampleVolume();
    const cmd = replaceInSelection(v, makeBox([0, 0, 0], [2, 0, 5]), STONE, GLASS);
    const w = cloneVolume(v);
    applyCommand(w, cmd);
    for (let x = 0; x < 6; x++) {
      for (let z = 0; z < 6; z++) {
        const was = v.get(x, 0, z);
        const expected = x <= 2 && was === STONE ? GLASS : was;
        expect(w.get(x, 0, z)).toBe(expected);
      }
    }
    expect(
      isEmptyCommand(replaceInSelection(v, makeBox([0, 0, 0], [5, 0, 5]), "minecraft:sand", GLASS)),
    ).toBe(true);
    // A pattern without NBT matches the block whatever its block entity.
    const chest = replaceInSelection(v, makeBox([0, 0, 0], [5, 1, 5]), CHEST, "minecraft:barrel");
    expect(commandCellCount(chest)).toBe(1);
    // Non-matching NBT does not.
    expect(
      isEmptyCommand(
        replaceInSelection(v, makeBox([0, 0, 0], [5, 1, 5]), `${CHEST}{Items:[]}`, GLASS),
      ),
    ).toBe(true);
  });

  it("copies, pastes at an offset and can skip air", () => {
    const v = sampleVolume();
    const clip = copySelection(v, makeBox([2, 0, 2], [3, 1, 3]));
    expect(clip.size).toEqual([2, 2, 2]);
    expect(clip.indices).toHaveLength(2 * 2 + 2); // 4 floor + chest + air
    const w = new Volume();
    applyCommand(w, pasteClipboard(w, clip, [10, 20, 30]));
    expect(w.get(10, 20, 30)).toBe(v.get(2, 0, 2));
    expect(w.get(11, 21, 31)).toBe("minecraft:air");
    expect(w.get(10, 21, 30)).toBe(CHEST_NBT);
    expect(w.size).toBe(6);
    const x = new Volume();
    applyCommand(x, pasteClipboard(x, clip, [0, 0, 0], { skipAir: true }));
    expect(x.size).toBe(5);
    // The clipboard is independent of the source volume.
    applyCommand(v, eraseBlock(v, [2, 0, 2]));
    expect(clip.palette).toContain(STONE);
  });

  it("moves a selection as one command, including overlapping moves", () => {
    const v = sampleVolume();
    const box = makeBox([0, 0, 0], [2, 0, 2]);
    const expected = new Map<string, string>();
    for (let x = 0; x <= 2; x++) {
      for (let z = 0; z <= 2; z++) expected.set(`${x + 1},0,${z}`, v.get(x, 0, z) as string);
    }
    const cmd = moveSelection(v, box, [1, 0, 0]);
    const w = cloneVolume(v);
    applyCommand(w, cmd);
    for (const [k, b] of expected) {
      const [x, y, z] = k.split(",").map(Number) as [number, number, number];
      expect(w.get(x, y, z)).toBe(b);
    }
    expect(w.get(0, 0, 0)).toBeUndefined();
    expect(w.size).toBe(v.size - 3); // three bystander cells were overwritten
    revertCommand(w, cmd);
    expect(snapshot(w)).toEqual(snapshot(v));
    expect(isEmptyCommand(moveSelection(v, box, [0, 0, 0]))).toBe(true);
  });
});

describe("block-state helpers", () => {
  it("lists properties with the values the state shows", () => {
    const props = blockProperties(
      "minecraft:oak_stairs[facing=north,half=bottom,shape=straight,waterlogged=false]",
    );
    const by = Object.fromEntries(props.map((p) => [p.key, p]));
    expect(props.map((p) => p.key)).toEqual(["facing", "half", "shape", "waterlogged"]);
    expect(by.waterlogged).toEqual({
      key: "waterlogged",
      value: "false",
      options: ["true", "false"],
      exact: true,
    });
    expect(by.facing?.options).toEqual(["north", "east", "south", "west"]);
    expect(by.facing?.exact).toBe(false);
    expect(by.half?.options).toEqual(["top", "bottom"]);
    expect(
      blockProperties("minecraft:oak_door[half=lower,hinge=left]").map((p) => p.options),
    ).toEqual([
      ["upper", "lower"],
      ["left", "right"],
    ]);
    expect(blockProperties("minecraft:dispenser[facing=up]")[0]?.options).toHaveLength(6);
    expect(blockProperties("minecraft:wheat[age=3]")[0]?.options).toBeNull();
    expect(blockProperties("minecraft:stone")).toEqual([]);
  });

  it("sets a property and keeps the name, NBT and canonical order", () => {
    expect(withBlockProperty("minecraft:oak_stairs[facing=north,half=bottom]", "half", "top")).toBe(
      "minecraft:oak_stairs[facing=north,half=top]",
    );
    expect(withBlockProperty("minecraft:stone", "waterlogged", "true")).toBe(
      "minecraft:stone[waterlogged=true]",
    );
    expect(() => withBlockProperty("minecraft:stone", "Bad Key", "x")).toThrow(EditError);
    expect(() => withBlockProperty("minecraft:stone", "a", "x,y")).toThrow(EditError);
  });

  it("edits one block through a command and rejects empty cells", () => {
    const v = sampleVolume();
    const cmd = setBlockProperty(v, [2, 1, 2], "waterlogged", "true");
    applyCommand(v, cmd);
    expect(v.get(2, 1, 2)).toBe(
      'minecraft:chest[facing=north,waterlogged=true]{Items:[{Slot:0b,id:"minecraft:stone"}]}',
    );
    revertCommand(v, cmd);
    expect(v.get(2, 1, 2)).toBe(CHEST_NBT);
    expect(() => setBlockProperty(v, [90, 0, 0], "a", "b")).toThrow(EditError);
    expect(isEmptyCommand(setBlockProperty(v, [2, 1, 2], "facing", "north"))).toBe(true);
  });
});

describe("Volume.setIndex", () => {
  it("sets by palette index, unsets with UNSET and rejects bad indices", () => {
    const v = new Volume();
    const i = v.intern(STONE);
    v.setIndex(1, 2, 3, i);
    expect(v.get(1, 2, 3)).toBe(STONE);
    expect(v.size).toBe(1);
    v.setIndex(1, 2, 3, UNSET);
    expect(v.size).toBe(0);
    expect(() => v.setIndex(0, 0, 0, 5)).toThrow();
  });
});
