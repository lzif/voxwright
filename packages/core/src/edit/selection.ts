// SPDX-License-Identifier: AGPL-3.0-only

// Selection tools: copy, paste, move, rotate and mirror. Blocks carry their
// block-entity NBT in the block string, so it travels with them.
//
// Rotation and mirroring use the same position and block-state transforms as
// mcbuilder's structure paste (`rotatePosition`, `rotateBlockstate`,
// `mirrorBlockstate`), so they match its golden vectors.

import { AIR_BLOCKS } from "../codecs/common.ts";
import {
  mirrorBlockstate,
  type Rotation,
  rotateBlockstate,
  rotatePosition,
} from "../rotation/index.ts";
import { UNSET, type Vec3, type Volume } from "../volume/index.ts";
import { type Box, boxSize, eachCellInBox } from "./box.ts";
import { baseState, type Command, CommandBuilder, EditError } from "./command.ts";

/**
 * Blocks copied out of a volume, independent of it. Cell offsets are
 * relative to the minimum corner of the copied box. Cells that were unset
 * are simply absent.
 */
export interface Clipboard {
  readonly size: Vec3;
  /** Block strings, with their block-entity NBT. */
  readonly palette: readonly string[];
  /** `dx, dy, dz` per cell. */
  readonly offsets: Int32Array;
  /** Index into `palette` per cell. */
  readonly indices: Int32Array;
}

export function clipboardCellCount(clip: Clipboard): number {
  return clip.indices.length;
}

/** Copy the set cells of a selection into a clipboard. */
export function copySelection(volume: Volume, box: Box): Clipboard {
  const palette: string[] = [];
  const remap = new Map<number, number>();
  const offsets: number[] = [];
  const indices: number[] = [];
  eachCellInBox(volume, box, (x, y, z, idx) => {
    let local = remap.get(idx);
    if (local === undefined) {
      local = palette.length;
      palette.push(volume.palette[idx] as string);
      remap.set(idx, local);
    }
    offsets.push(x - box.min[0], y - box.min[1], z - box.min[2]);
    indices.push(local);
  });
  return {
    size: boxSize(box),
    palette,
    offsets: Int32Array.from(offsets),
    indices: Int32Array.from(indices),
  };
}

export interface PasteOptions {
  /** Leave the target alone where the clipboard holds air. Default `false`. */
  skipAir?: boolean;
}

/** Paste a clipboard so its minimum corner lands on `at`. */
export function pasteClipboard(
  volume: Volume,
  clip: Clipboard,
  at: Vec3,
  options: PasteOptions = {},
): Command {
  if (!at.every(Number.isInteger))
    throw new EditError("paste position must be integer coordinates");
  const b = new CommandBuilder(volume, "paste");
  const mapped = clip.palette.map((p) =>
    options.skipAir === true && AIR_BLOCKS.has(baseState(p)) ? UNSET : volume.intern(p),
  );
  for (let i = 0; i < clip.indices.length; i++) {
    const idx = mapped[clip.indices[i] as number] as number;
    if (idx === UNSET) continue;
    b.place(
      at[0] + (clip.offsets[3 * i] as number),
      at[1] + (clip.offsets[3 * i + 1] as number),
      at[2] + (clip.offsets[3 * i + 2] as number),
      idx,
    );
  }
  return b.finish();
}

/**
 * Move the set cells of a selection by `delta`: a cut and a paste in one
 * command. Cells of the selection that were unset stay out of it, so
 * whatever is at the destination around the moved blocks is kept.
 */
export function moveSelection(
  volume: Volume,
  box: Box,
  delta: Vec3,
  options: PasteOptions = {},
): Command {
  if (!delta.every(Number.isInteger))
    throw new EditError("move offset must be integer coordinates");
  const b = new CommandBuilder(volume, "move");
  if (delta[0] === 0 && delta[1] === 0 && delta[2] === 0) return b.finish();
  const moved: number[] = [];
  eachCellInBox(volume, box, (x, y, z, idx) => {
    moved.push(x, y, z, idx);
  });
  for (let i = 0; i < moved.length; i += 4) {
    b.unset(moved[i] as number, moved[i + 1] as number, moved[i + 2] as number);
  }
  for (let i = 0; i < moved.length; i += 4) {
    const idx = moved[i + 3] as number;
    if (options.skipAir === true && AIR_BLOCKS.has(baseState(volume.palette[idx] as string)))
      continue;
    b.setIndex(
      (moved[i] as number) + delta[0],
      (moved[i + 1] as number) + delta[1],
      (moved[i + 2] as number) + delta[2],
      idx,
    );
  }
  return b.finish();
}

/** The footprint after rotating a box: same minimum corner, x and z swapped for quarter turns. */
export function rotatedBox(box: Box, rotation: Rotation): Box {
  const [w, h, l] = boxSize(box);
  const quarter = rotation === "CLOCKWISE_90" || rotation === "COUNTERCLOCKWISE_90";
  return {
    min: box.min,
    max: [
      box.min[0] + (quarter ? l : w) - 1,
      box.min[1] + h - 1,
      box.min[2] + (quarter ? w : l) - 1,
    ],
  };
}

/**
 * Rotate the selection about the vertical axis. The result keeps the box's
 * minimum corner (see {@link rotatedBox}). Facing, axis, connection and
 * rotation properties turn with the blocks.
 */
export function rotateSelection(volume: Volume, box: Box, rotation: Rotation): Command {
  const b = new CommandBuilder(volume, `rotate ${rotation}`);
  const [w, , l] = boxSize(box);
  // rotatePosition turns a square footprint; use the square that holds the
  // box, then slide the result back so it starts at the box's corner.
  const s = Math.max(w, l);
  const corners = [
    rotatePosition(0, 0, s, rotation),
    rotatePosition(w - 1, 0, s, rotation),
    rotatePosition(0, l - 1, s, rotation),
    rotatePosition(w - 1, l - 1, s, rotation),
  ];
  const shiftX = Math.min(...corners.map((c) => c[0]));
  const shiftZ = Math.min(...corners.map((c) => c[1]));
  return transformSelection(
    volume,
    box,
    b,
    (lx, lz) => {
      const [rx, rz] = rotatePosition(lx, lz, s, rotation);
      return [rx - shiftX, rz - shiftZ];
    },
    (block) => rotateBlockstate(block, rotation),
  );
}

/** Mirror the selection across its own centre plane, flipping x (east/west) or z (north/south). */
export function mirrorSelection(volume: Volume, box: Box, axis: "x" | "z"): Command {
  if (axis !== "x" && axis !== "z") throw new EditError(`invalid mirror axis '${String(axis)}'`);
  const [w, , l] = boxSize(box);
  const b = new CommandBuilder(volume, `mirror ${axis}`);
  return transformSelection(
    volume,
    box,
    b,
    (lx, lz) => [axis === "x" ? w - 1 - lx : lx, axis === "z" ? l - 1 - lz : lz],
    (block) => mirrorBlockstate(block, axis),
  );
}

/** Clear the box, then write each cell at its transformed place. Y is unchanged. */
function transformSelection(
  volume: Volume,
  box: Box,
  b: CommandBuilder,
  movePos: (lx: number, lz: number) => [number, number],
  mapBlock: (block: string) => string,
): Command {
  const cells: number[] = [];
  eachCellInBox(volume, box, (x, y, z, idx) => {
    cells.push(x, y, z, idx);
  });
  for (let i = 0; i < cells.length; i += 4) {
    b.unset(cells[i] as number, cells[i + 1] as number, cells[i + 2] as number);
  }
  const mapped = new Map<number, number>();
  for (let i = 0; i < cells.length; i += 4) {
    const idx = cells[i + 3] as number;
    let next = mapped.get(idx);
    if (next === undefined) {
      next = volume.intern(mapBlock(volume.palette[idx] as string));
      mapped.set(idx, next);
    }
    const [nx, nz] = movePos(
      (cells[i] as number) - box.min[0],
      (cells[i + 2] as number) - box.min[2],
    );
    b.setIndex(box.min[0] + nx, cells[i + 1] as number, box.min[2] + nz, next);
  }
  return b.finish();
}
