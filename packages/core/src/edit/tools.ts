// SPDX-License-Identifier: AGPL-3.0-only

// Drawing tools. Each is a pure function from a Volume (read only) and some
// arguments to a {@link Command}; nothing is applied until the command is.
// A command that changes nothing comes back empty (see `isEmptyCommand`).

import { canonicalize } from "../blocks/index.ts";
import { AIR_BLOCKS } from "../codecs/common.ts";
import { UNSET, type Vec3, type Volume } from "../volume/index.ts";
import { type Box, eachCellInBox, eachPosInBox, makeBox } from "./box.ts";
import { baseState, type Command, CommandBuilder, EditError } from "./command.ts";

function checkInt(what: string, p: Vec3): void {
  if (!p.every(Number.isInteger)) throw new EditError(`${what} must be integer coordinates`);
}

/** Is this block string (or unset) an empty cell for the purposes of "only fill empty"? */
export function isEmptyBlock(block: string | undefined): boolean {
  return block === undefined || AIR_BLOCKS.has(baseState(block));
}

/** Place one block. */
export function placeBlock(volume: Volume, pos: Vec3, block: string): Command {
  return placeCells(volume, [pos], block, "place");
}

/** Place the same block at every position, as one command. */
export function placeCells(
  volume: Volume,
  cells: Iterable<Vec3>,
  block: string,
  label = "place",
): Command {
  const b = new CommandBuilder(volume, label);
  const idx = volume.intern(canonicalize(block));
  for (const p of cells) {
    checkInt("position", p);
    b.place(p[0], p[1], p[2], idx);
  }
  return b.finish();
}

export interface EraseOptions {
  /** Write explicit `minecraft:air` instead of making the cell unset. Default `false`. */
  toAir?: boolean;
}

/** Erase one block: the cell becomes unset (or air, see {@link EraseOptions}). */
export function eraseBlock(volume: Volume, pos: Vec3, options: EraseOptions = {}): Command {
  return eraseCells(volume, [pos], options, "erase");
}

export function eraseCells(
  volume: Volume,
  cells: Iterable<Vec3>,
  options: EraseOptions = {},
  label = "erase",
): Command {
  const b = new CommandBuilder(volume, label);
  const air = options.toAir === true ? volume.intern("minecraft:air") : UNSET;
  for (const p of cells) {
    checkInt("position", p);
    // Erasing nothing is not a change, even when erasing to air.
    if (b.indexAt(p[0], p[1], p[2]) === UNSET && air !== UNSET) continue;
    b.setIndex(p[0], p[1], p[2], air);
  }
  return b.finish();
}

/**
 * The cells of a 3D Bresenham line from `a` to `b`, both ends included.
 * The axis with the longest span is stepped one cell at a time.
 */
export function linePoints(a: Vec3, b: Vec3): Vec3[] {
  checkInt("line end", a);
  checkInt("line end", b);
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
  const n = Math.max(Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2]));
  if (n === 0) return [[a[0], a[1], a[2]]];
  const step = [Math.sign(d[0]), Math.sign(d[1]), Math.sign(d[2])] as const;
  const abs = [Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2])] as const;
  const err = [Math.floor(n / 2), Math.floor(n / 2), Math.floor(n / 2)];
  const cur = [a[0], a[1], a[2]];
  const out: Vec3[] = [[cur[0] as number, cur[1] as number, cur[2] as number]];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      err[k] = (err[k] as number) - (abs[k] as number);
      if ((err[k] as number) < 0) {
        cur[k] = (cur[k] as number) + (step[k] as number);
        err[k] = (err[k] as number) + n;
      }
    }
    out.push([cur[0] as number, cur[1] as number, cur[2] as number]);
  }
  return out;
}

/** Draw a line of `block` from `a` to `b`. */
export function drawLine(volume: Volume, a: Vec3, b: Vec3, block: string): Command {
  return placeCells(volume, linePoints(a, b), block, "line");
}

export interface ShapeOptions {
  /** Draw only the outline (rectangle) or the shell (box). Default `false`. */
  hollow?: boolean;
}

export type Axis = "x" | "y" | "z";
const AXES: readonly Axis[] = ["x", "y", "z"];

export interface RectangleOptions extends ShapeOptions {
  /** The axis the rectangle is flat along. Defaults to the first axis on which `a` and `b` agree, else `y`. */
  normal?: Axis;
}

/**
 * A flat rectangle between corners `a` and `b`. It lies in the plane
 * through `a` perpendicular to `normal`; the other corner's coordinate on
 * that axis is ignored. Hollow draws only the one-block-wide frame.
 */
export function drawRectangle(
  volume: Volume,
  a: Vec3,
  b: Vec3,
  block: string,
  options: RectangleOptions = {},
): Command {
  checkInt("rectangle corner", a);
  checkInt("rectangle corner", b);
  const normal: Axis = options.normal ?? AXES.find((_, i) => a[i] === b[i]) ?? "y";
  const n = AXES.indexOf(normal);
  const lo = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])];
  const hi = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];
  lo[n] = a[n] as number;
  hi[n] = a[n] as number;
  const box: Box = makeBox(lo as unknown as Vec3, hi as unknown as Vec3);
  const [u, v] = [0, 1, 2].filter((i) => i !== n) as [number, number];
  const cells: Vec3[] = [];
  eachPosInBox(box, (x, y, z) => {
    const p = [x, y, z];
    if (
      options.hollow === true &&
      p[u] !== lo[u] &&
      p[u] !== hi[u] &&
      p[v] !== lo[v] &&
      p[v] !== hi[v]
    ) {
      return;
    }
    cells.push([x, y, z]);
  });
  return placeCells(
    volume,
    cells,
    block,
    options.hollow === true ? "hollow rectangle" : "rectangle",
  );
}

/** A cuboid between corners `a` and `b`. Hollow draws only the six faces. */
export function drawBox(
  volume: Volume,
  a: Vec3,
  b: Vec3,
  block: string,
  options: ShapeOptions = {},
): Command {
  checkInt("box corner", a);
  checkInt("box corner", b);
  const box = makeBox(a, b);
  const label = options.hollow === true ? "hollow box" : "box";
  const b2 = new CommandBuilder(volume, label);
  const idx = volume.intern(canonicalize(block));
  eachPosInBox(box, (x, y, z) => {
    if (
      options.hollow === true &&
      x !== box.min[0] &&
      x !== box.max[0] &&
      y !== box.min[1] &&
      y !== box.max[1] &&
      z !== box.min[2] &&
      z !== box.max[2]
    ) {
      return;
    }
    b2.place(x, y, z, idx);
  });
  return b2.finish();
}

export interface FillOptions {
  /** Only fill unset and air cells. Default `false`. */
  onlyEmpty?: boolean;
}

/** Fill every cell of the selection with `block`. */
export function fillSelection(
  volume: Volume,
  box: Box,
  block: string,
  options: FillOptions = {},
): Command {
  const b = new CommandBuilder(volume, "fill");
  const idx = volume.intern(canonicalize(block));
  eachPosInBox(box, (x, y, z) => {
    if (options.onlyEmpty === true) {
      const cur = b.indexAt(x, y, z);
      if (!isEmptyBlock(cur === UNSET ? undefined : volume.palette[cur])) return;
    }
    b.place(x, y, z, idx);
  });
  return b.finish();
}

/**
 * Replace `from` with `to` inside the selection. A `from` without NBT
 * matches that block state whatever block-entity data it carries; with NBT
 * it must match exactly. Cells that are unset never match.
 */
export function replaceInSelection(volume: Volume, box: Box, from: string, to: string): Command {
  const wanted = canonicalize(from);
  const wantsExact = wanted.includes("{");
  const b = new CommandBuilder(volume, "replace");
  const idx = volume.intern(canonicalize(to));
  eachCellInBox(volume, box, (x, y, z, cur) => {
    const block = volume.palette[cur] as string;
    if (wantsExact ? block === wanted : baseState(block) === wanted) b.place(x, y, z, idx);
  });
  return b.finish();
}
