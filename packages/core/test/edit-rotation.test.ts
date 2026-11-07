// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  applyCommand,
  boxSize,
  Editor,
  makeBox,
  mirrorSelection,
  type Rotation,
  rotatedBox,
  rotateSelection,
  Volume,
} from "../src/index.ts";
import { CHEST, chestEntity, loadVector } from "./helpers.ts";

// The editor's rotate and mirror must reproduce mcbuilder's golden vectors.
// These are the same vectors rotation.test.ts uses for the bare functions.
interface Vectors {
  positions: { x: number; z: number; size: number; rotation: Rotation; result: [number, number] }[];
  blockstates: { input: string; rotation: Rotation; result: string }[];
  mirrors: { input: string; axis: "x" | "z"; result: string }[];
}
const v = loadVector<Vectors>("rotation.json");

function run(volume: Volume, cmd: Parameters<typeof applyCommand>[1]): Volume {
  applyCommand(volume, cmd);
  return volume;
}

describe("selection rotate against the golden vectors", () => {
  it("moves each cell to the vectors' position", () => {
    expect(v.positions.length).toBeGreaterThan(300);
    for (const c of v.positions) {
      const vol = new Volume();
      vol.set(c.x, 2, c.z, "minecraft:stone");
      // The selection is the size x size footprint the vector is defined on.
      const box = makeBox([0, 2, 0], [c.size - 1, 2, c.size - 1]);
      run(vol, rotateSelection(vol, box, c.rotation));
      expect(vol.size, JSON.stringify(c)).toBe(1);
      expect(vol.get(c.result[0], 2, c.result[1]), JSON.stringify(c)).toBe("minecraft:stone");
    }
  });

  it("rotates block states to the vectors' result", () => {
    expect(v.blockstates.length).toBeGreaterThan(90);
    for (const c of v.blockstates) {
      const vol = new Volume();
      vol.set(0, 0, 0, c.input);
      run(vol, rotateSelection(vol, makeBox([0, 0, 0], [0, 0, 0]), c.rotation));
      expect(vol.get(0, 0, 0), `${c.input} ${c.rotation}`).toBe(c.result);
    }
  });

  it("mirrors block states to the vectors' result", () => {
    expect(v.mirrors.length).toBeGreaterThan(40);
    for (const c of v.mirrors) {
      const vol = new Volume();
      vol.set(0, 0, 0, c.input);
      run(vol, mirrorSelection(vol, makeBox([0, 0, 0], [0, 0, 0]), c.axis));
      expect(vol.get(0, 0, 0), `${c.input} ${c.axis}`).toBe(c.result);
    }
  });

  it("rotates a whole square build the way the vectors place each cell", () => {
    const size = 5;
    for (const rotation of ["CLOCKWISE_90", "CLOCKWISE_180", "COUNTERCLOCKWISE_90"] as const) {
      const vol = new Volume();
      for (let x = 0; x < size; x++) {
        for (let z = 0; z < size; z++) vol.set(x, 0, z, `minecraft:stone[x=${x},z=${z}]`);
      }
      const box = makeBox([0, 0, 0], [size - 1, 0, size - 1]);
      run(vol, rotateSelection(vol, box, rotation));
      expect(vol.size).toBe(size * size);
      for (const c of v.positions.filter((p) => p.size === size && p.rotation === rotation)) {
        expect(vol.get(c.result[0], 0, c.result[1])).toBe(`minecraft:stone[x=${c.x},z=${c.z}]`);
      }
    }
  });
});

describe("selection rotate and mirror, general behaviour", () => {
  function pattern(): { vol: Volume; box: ReturnType<typeof makeBox> } {
    // A 3 (x) by 2 (y) by 2 (z) box with a distinct stair in every cell.
    const vol = new Volume();
    const stair = ["north", "east", "south", "west"];
    let n = 0;
    for (let x = 4; x < 7; x++) {
      for (let y = 1; y < 3; y++) {
        for (let z = -2; z < 0; z++)
          vol.set(x, y, z, `minecraft:oak_stairs[facing=${stair[n++ % 4]}]`);
      }
    }
    return { vol, box: makeBox([4, 1, -2], [6, 2, -1]) };
  }

  it("turns a non-square box and keeps its minimum corner", () => {
    const { vol, box } = pattern();
    const after = rotatedBox(box, "CLOCKWISE_90");
    expect(boxSize(after)).toEqual([2, 2, 3]);
    expect(after.min).toEqual(box.min);
    run(vol, rotateSelection(vol, box, "CLOCKWISE_90"));
    expect(vol.size).toBe(12);
    const b = vol.bounds();
    expect(b).toEqual([after.min, after.max]);
    expect(boxSize(rotatedBox(box, "CLOCKWISE_180"))).toEqual([3, 2, 2]);
  });

  it("four quarter turns and two flips are the identity", () => {
    const { vol, box } = pattern();
    const orig = new Map<string, string>();
    vol.eachCell((x, y, z, i) => orig.set(`${x},${y},${z}`, vol.palette[i] as string));
    let b = box;
    for (let i = 0; i < 4; i++) {
      run(vol, rotateSelection(vol, b, "CLOCKWISE_90"));
      b = rotatedBox(b, "CLOCKWISE_90");
    }
    run(vol, mirrorSelection(vol, b, "x"));
    run(vol, mirrorSelection(vol, b, "x"));
    run(vol, mirrorSelection(vol, b, "z"));
    run(vol, mirrorSelection(vol, b, "z"));
    expect(vol.size).toBe(orig.size);
    for (const [k, block] of orig) {
      const [x, y, z] = k.split(",").map(Number) as [number, number, number];
      expect(vol.get(x, y, z)).toBe(block);
    }
  });

  it("clockwise then counterclockwise cancel, and a half turn equals two quarter turns", () => {
    const a = pattern();
    run(a.vol, rotateSelection(a.vol, a.box, "CLOCKWISE_90"));
    run(a.vol, rotateSelection(a.vol, rotatedBox(a.box, "CLOCKWISE_90"), "COUNTERCLOCKWISE_90"));
    const b = pattern();
    expect([...snap(a.vol)]).toEqual([...snap(b.vol)]);

    const c = pattern();
    run(c.vol, rotateSelection(c.vol, c.box, "CLOCKWISE_180"));
    const d = pattern();
    run(d.vol, rotateSelection(d.vol, d.box, "CLOCKWISE_90"));
    run(d.vol, rotateSelection(d.vol, rotatedBox(d.box, "CLOCKWISE_90"), "CLOCKWISE_90"));
    expect([...snap(c.vol)]).toEqual([...snap(d.vol)]);
  });

  it("mirrors x positions inside the box and leaves y alone", () => {
    const vol = new Volume();
    vol.set(10, 5, 3, "minecraft:stone");
    vol.set(12, 6, 3, "minecraft:dirt");
    const box = makeBox([10, 5, 3], [12, 6, 3]);
    run(vol, mirrorSelection(vol, box, "x"));
    expect(vol.get(12, 5, 3)).toBe("minecraft:stone");
    expect(vol.get(10, 6, 3)).toBe("minecraft:dirt");
    expect(vol.size).toBe(2);
  });

  it("keeps block-entity NBT on rotated blocks and does nothing for NONE", () => {
    const vol = new Volume();
    const chest = 'minecraft:chest[facing=north]{Items:[{Slot:0b,id:"minecraft:stone"}]}';
    vol.set(0, 0, 0, chest);
    const box = makeBox([0, 0, 0], [0, 0, 0]);
    run(vol, rotateSelection(vol, box, "CLOCKWISE_90"));
    expect(vol.get(0, 0, 0)).toBe(chest.replace("north", "east"));
    const none = rotateSelection(vol, box, "NONE");
    expect(none.before).toHaveLength(0);
    expect(none.sections).toHaveLength(0);
  });
});

describe("rotate with skipAir", () => {
  const STONE = "minecraft:stone";
  const AIR = "minecraft:air";
  const OAK = "minecraft:oak_planks";

  /**
   * The audited case: a 6x1x2 selection (x 0..5, z 0..1) whose cells from
   * x=2 on are air, with a stone wall where the turned footprint reaches
   * past the box (x 0..1, z 2..5), and a bystander block beyond it.
   */
  function audited(): { vol: Volume; box: ReturnType<typeof makeBox> } {
    const vol = new Volume();
    for (let x = 0; x < 6; x++) {
      for (let z = 0; z < 2; z++) vol.set(x, 0, z, x < 2 ? OAK : AIR);
    }
    for (let x = 0; x < 2; x++) {
      for (let z = 2; z < 6; z++) vol.set(x, 0, z, STONE);
    }
    vol.set(0, 0, 6, STONE);
    return { vol, box: makeBox([0, 0, 0], [5, 0, 1]) };
  }

  it("keeps the wall beside a non-square box when air is skipped", () => {
    const { vol, box } = audited();
    run(vol, rotateSelection(vol, box, "CLOCKWISE_90", { skipAir: true }));
    for (let x = 0; x < 2; x++) {
      for (let z = 2; z < 6; z++) expect(vol.get(x, 0, z)).toBe(STONE);
    }
    expect(vol.get(0, 0, 6)).toBe(STONE);
    // The two oak columns land on (1-z, x) for x 0..1: x 1 and 0 at z 0..1.
    for (let x = 0; x < 2; x++) {
      for (let z = 0; z < 2; z++) expect(vol.get(x, 0, z)).toBe(OAK);
    }
    // Vacated source cells are cleared, as for a move: no cell past the box holds air.
    expect(vol.get(2, 0, 0)).toBeUndefined();
    expect(vol.get(5, 0, 1)).toBeUndefined();
    let air = 0;
    vol.eachCell((_x, _y, _z, i) => {
      if (vol.palette[i] === AIR) air++;
    });
    expect(air).toBe(0);
    expect(vol.size).toBe(4 + 8 + 1);
  });

  it("without skipAir the air overwrites the wall, as before", () => {
    for (const options of [undefined, {}, { skipAir: false }]) {
      const { vol, box } = audited();
      run(vol, rotateSelection(vol, box, "CLOCKWISE_90", options));
      for (let x = 0; x < 2; x++) {
        for (let z = 2; z < 6; z++) expect(vol.get(x, 0, z)).toBe(AIR);
      }
      expect(vol.get(0, 0, 6)).toBe(STONE);
    }
  });

  it("skipAir only changes the air cells: the rest matches the plain rotation", () => {
    const a = audited();
    run(a.vol, rotateSelection(a.vol, a.box, "COUNTERCLOCKWISE_90", { skipAir: true }));
    const b = audited();
    run(b.vol, rotateSelection(b.vol, b.box, "COUNTERCLOCKWISE_90"));
    const nonAir = (v: Volume): string[] => snap(v).filter((s) => !s.endsWith(`=${AIR}`));
    // Wherever the plain rotation put air over stone the skip run keeps the stone; elsewhere equal.
    const kept = new Set(nonAir(b.vol));
    for (const s of nonAir(a.vol)) {
      if (!kept.has(s)) expect(s.endsWith(`=${STONE}`)).toBe(true);
    }
    for (const s of kept) expect(nonAir(a.vol)).toContain(s);
  });

  it("undo restores the original exactly, redo repeats the rotation", () => {
    const { vol, box } = audited();
    const before = snap(vol);
    const ed = new Editor(vol);
    ed.run(rotateSelection(vol, box, "CLOCKWISE_90", { skipAir: true }));
    const after = snap(vol);
    expect(after).not.toEqual(before);
    expect(ed.undo()).toBe(true);
    expect(snap(vol)).toEqual(before);
    expect(vol.size).toBe(before.length);
    expect(ed.redo()).toBe(true);
    expect(snap(vol)).toEqual(after);
    expect(ed.undo()).toBe(true);
    expect(snap(vol)).toEqual(before);
  });

  it("carries block entities and leaves a block entity under skipped air alone", () => {
    const vol = new Volume();
    // 4x1x2 box: a chest at (0,0,0), air elsewhere; a second chest sits where an air cell turns to.
    for (let x = 0; x < 4; x++) for (let z = 0; z < 2; z++) vol.set(x, 0, z, AIR);
    vol.set(0, 0, 0, CHEST);
    vol.setBlockEntity(0, 0, 0, chestEntity());
    // (x, z) -> (1 - z, x): the air cell (1,0,1) turns to (0,0,1), and (3,0,0) to (1,0,3).
    vol.set(1, 0, 3, CHEST);
    vol.setBlockEntity(1, 0, 3, chestEntity(7));
    const box = makeBox([0, 0, 0], [3, 0, 1]);
    const ed = new Editor(vol);
    ed.run(rotateSelection(vol, box, "CLOCKWISE_90", { skipAir: true }));
    // The carried chest: (0,0,0) -> (1,0,0) with its contents.
    expect(vol.get(1, 0, 0)?.startsWith("minecraft:chest[facing=east")).toBe(true);
    expect(vol.blockEntityAt(1, 0, 0)).toEqual(chestEntity());
    // The neighbour under a skipped air cell keeps block and contents.
    expect(vol.get(1, 0, 3)).toBe(CHEST);
    expect(vol.blockEntityAt(1, 0, 3)).toEqual(chestEntity(7));
    expect(vol.blockEntityCount).toBe(2);
    ed.undo();
    expect(vol.get(0, 0, 0)).toBe(CHEST);
    expect(vol.blockEntityAt(0, 0, 0)).toEqual(chestEntity());
    expect(vol.get(1, 0, 3)).toBe(CHEST);
    expect(vol.blockEntityAt(1, 0, 3)).toEqual(chestEntity(7));
    expect(vol.blockEntityCount).toBe(2);
  });

  it("mirror stays inside its box, so it takes no skipAir", () => {
    const vol = new Volume();
    for (let x = 0; x < 4; x++) vol.set(x, 0, 0, x === 0 ? STONE : AIR);
    vol.set(4, 0, 0, OAK);
    vol.set(-1, 0, 0, OAK);
    const box = makeBox([0, 0, 0], [3, 0, 0]);
    const cmd = mirrorSelection(vol, box, "x");
    run(vol, cmd);
    expect(vol.get(4, 0, 0)).toBe(OAK);
    expect(vol.get(-1, 0, 0)).toBe(OAK);
    expect(vol.get(3, 0, 0)).toBe(STONE);
  });
});

function snap(v: Volume): string[] {
  const out: string[] = [];
  v.eachCell((x, y, z, i) => out.push(`${x},${y},${z}=${v.palette[i]}`));
  return out.sort();
}
