// SPDX-License-Identifier: AGPL-3.0-only

// A Command is the unit of undo: the cells an edit changed, with the palette
// index each held before and after. Palette indices stay valid because a
// Volume's palette only ever grows. Sparse edits store one entry per cell;
// an edit that changes a large part of a section stores that whole section
// as a before/after pair instead, which is smaller past about 1,600 cells.
//
// Block entities (chest contents, sign text...) live in the volume's own
// per-cell map, not in the palette. A command therefore also records, for
// each cell whose block entity changed, the block entity before and after
// (`blockEntities`), and apply and undo set exactly those. The rule the
// builder applies by default is the game's: a cell keeps its block entity
// while its block keeps its name (so changing `facing` keeps the contents),
// and loses it when the cell is erased or given a block of another name.
// Moves, rotations, mirrors and pastes carry block entities explicitly.
//
// A block string can also carry SNBT after the properties
// (`name[props]{nbt}`), which core parses structurally and keeps verbatim.
// No codec produces such strings; they are for callers that build a Volume
// by hand, such as mcbuilder, and edits treat them as a separate state.

import { type BlockEntity, blockIdOf, UNSET, type Volume } from "../volume/index.ts";

/** Per-axis size limit for a volume grown by editing. */
export const MAX_EXTENT = 512;

export class EditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditError";
  }
}

const SECTION_BITS = 4;
const SECTION_CELLS = 1 << (SECTION_BITS * 3);
const SECTION_MASK = (1 << SECTION_BITS) - 1;
/** Bytes per cell in sparse form: three coordinates, before and after. */
const SPARSE_BYTES = 20;
/** Bytes per section in diff form: 4096 cells, before and after. */
const DIFF_BYTES = SECTION_CELLS * 8;
/** Marks a cell the staging area has not seen. */
const PENDING = -2;

/** Section-local cell index, the same layout the Volume uses. */
export const localIndex = (x: number, y: number, z: number): number =>
  ((y & SECTION_MASK) << 8) | ((z & SECTION_MASK) << 4) | (x & SECTION_MASK);

/** Before and after values for one whole section; equal values mean "unchanged". */
export interface SectionDiff {
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly before: Int32Array;
  readonly after: Int32Array;
}

/** A cell whose block entity the command changes. `undefined` means "none". */
export interface BlockEntityChange {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly before: BlockEntity | undefined;
  readonly after: BlockEntity | undefined;
}

export interface Command {
  readonly label: string;
  /** Sparse changes: `x, y, z` per cell. */
  readonly positions: Int32Array;
  readonly before: Int32Array;
  readonly after: Int32Array;
  readonly sections: readonly SectionDiff[];
  /** Block entities set or removed by the command, applied after the cells. */
  readonly blockEntities: readonly BlockEntityChange[];
}

export function isEmptyCommand(command: Command): boolean {
  return (
    command.before.length === 0 &&
    command.sections.length === 0 &&
    command.blockEntities.length === 0
  );
}

/** Number of cells the command changes. */
export function commandCellCount(command: Command): number {
  let n = command.before.length;
  for (const d of command.sections) {
    for (let i = 0; i < SECTION_CELLS; i++) if (d.before[i] !== d.after[i]) n++;
  }
  return n;
}

/** Approximate memory held by a command, for the undo budget. */
export function commandBytes(command: Command): number {
  let n = 64 + command.label.length * 2;
  n += command.positions.byteLength + command.before.byteLength + command.after.byteLength;
  for (const d of command.sections) n += d.before.byteLength + d.after.byteLength + 48;
  // The NBT itself is shared with the volume or the clipboard; count the entry and a typical chest.
  n += command.blockEntities.length * 512;
  return n;
}

/** Visit every changed cell with its old and new palette index. */
export function forEachChange(
  command: Command,
  fn: (x: number, y: number, z: number, before: number, after: number) => void,
): void {
  const { positions, before, after } = command;
  for (let i = 0; i < before.length; i++) {
    fn(
      positions[3 * i] as number,
      positions[3 * i + 1] as number,
      positions[3 * i + 2] as number,
      before[i] as number,
      after[i] as number,
    );
  }
  for (const d of command.sections) {
    for (let i = 0; i < SECTION_CELLS; i++) {
      const b = d.before[i] as number;
      const a = d.after[i] as number;
      if (b === a) continue;
      fn(
        (d.sx << SECTION_BITS) | (i & SECTION_MASK),
        (d.sy << SECTION_BITS) | (i >> 8),
        (d.sz << SECTION_BITS) | ((i >> 4) & SECTION_MASK),
        b,
        a,
      );
    }
  }
}

function putBlockEntity(
  volume: Volume,
  x: number,
  y: number,
  z: number,
  entity: BlockEntity | undefined,
): void {
  if (entity === undefined) volume.deleteBlockEntity(x, y, z);
  else volume.setBlockEntity(x, y, z, entity);
}

/** Do the command's changes to the volume. */
export function applyCommand(volume: Volume, command: Command): void {
  forEachChange(command, (x, y, z, _before, after) => volume.setIndex(x, y, z, after));
  for (const c of command.blockEntities) putBlockEntity(volume, c.x, c.y, c.z, c.after);
}

/** Undo the command's changes. The volume must be in the state just after the apply. */
export function revertCommand(volume: Volume, command: Command): void {
  forEachChange(command, (x, y, z, before) => volume.setIndex(x, y, z, before));
  for (const c of command.blockEntities) putBlockEntity(volume, c.x, c.y, c.z, c.before);
}

class SectionStage {
  readonly before = new Int32Array(SECTION_CELLS).fill(PENDING);
  readonly after = new Int32Array(SECTION_CELLS);
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;

  constructor(sx: number, sy: number, sz: number) {
    this.sx = sx;
    this.sy = sy;
    this.sz = sz;
  }
}

/** Collects changes per section; the first `before` and the last `after` of a cell win. */
class Staging {
  private readonly stages = new Map<string, SectionStage>();
  private readonly beStages = new Map<
    string,
    {
      before: BlockEntity | undefined;
      after: BlockEntity | undefined;
      x: number;
      y: number;
      z: number;
    }
  >();
  private last: SectionStage | undefined;

  /** The staged block entity change at a cell, if any. */
  blockEntityStage(
    x: number,
    y: number,
    z: number,
  ): { before: BlockEntity | undefined; after: BlockEntity | undefined } | undefined {
    if (this.beStages.size === 0) return undefined;
    return this.beStages.get(`${x},${y},${z}`);
  }

  /** The first `before` and the last `after` of a cell win. */
  recordBlockEntity(
    x: number,
    y: number,
    z: number,
    before: BlockEntity | undefined,
    after: BlockEntity | undefined,
  ): void {
    const key = `${x},${y},${z}`;
    const have = this.beStages.get(key);
    if (have === undefined) this.beStages.set(key, { before, after, x, y, z });
    else have.after = after;
  }

  /** Does the staged value of this cell differ from what it was before? */
  isChanged(x: number, y: number, z: number): boolean {
    const stage = this.stages.get(`${x >> SECTION_BITS},${y >> SECTION_BITS},${z >> SECTION_BITS}`);
    if (stage === undefined) return false;
    const i = localIndex(x, y, z);
    return stage.before[i] !== PENDING && stage.before[i] !== stage.after[i];
  }

  private stageFor(x: number, y: number, z: number): SectionStage {
    const sx = x >> SECTION_BITS;
    const sy = y >> SECTION_BITS;
    const sz = z >> SECTION_BITS;
    const last = this.last;
    if (last !== undefined && last.sx === sx && last.sy === sy && last.sz === sz) return last;
    const key = `${sx},${sy},${sz}`;
    let stage = this.stages.get(key);
    if (stage === undefined) {
      stage = new SectionStage(sx, sy, sz);
      this.stages.set(key, stage);
    }
    this.last = stage;
    return stage;
  }

  /** The staged value at a cell, or `undefined` if it has not been touched. */
  peek(x: number, y: number, z: number): number | undefined {
    const sx = x >> SECTION_BITS;
    const sy = y >> SECTION_BITS;
    const sz = z >> SECTION_BITS;
    let stage = this.last;
    if (stage === undefined || stage.sx !== sx || stage.sy !== sy || stage.sz !== sz) {
      stage = this.stages.get(`${sx},${sy},${sz}`);
      if (stage === undefined) return undefined;
      this.last = stage;
    }
    const i = localIndex(x, y, z);
    return stage.before[i] === PENDING ? undefined : stage.after[i];
  }

  /** Visit every staged cell whose value changes, with its new value. */
  eachChanged(fn: (x: number, y: number, z: number, after: number) => void): void {
    for (const st of this.stages.values()) {
      for (let i = 0; i < SECTION_CELLS; i++) {
        const b = st.before[i] as number;
        if (b === PENDING) continue;
        fn(
          (st.sx << SECTION_BITS) | (i & SECTION_MASK),
          (st.sy << SECTION_BITS) | (i >> 8),
          (st.sz << SECTION_BITS) | ((i >> 4) & SECTION_MASK),
          st.after[i] as number,
        );
      }
    }
  }

  record(x: number, y: number, z: number, before: number, after: number): void {
    const stage = this.stageFor(x, y, z);
    const i = localIndex(x, y, z);
    if (stage.before[i] === PENDING) stage.before[i] = before;
    stage.after[i] = after;
  }

  /** Freeze into a command, leaving out cells that end up unchanged. */
  toCommand(label: string): Command {
    const sparse: { sx: number; sy: number; sz: number; cells: number[] }[] = [];
    const diffs: SectionDiff[] = [];
    let sparseCount = 0;
    for (const st of this.stages.values()) {
      const cells: number[] = [];
      for (let i = 0; i < SECTION_CELLS; i++) {
        const b = st.before[i] as number;
        if (b === PENDING) continue;
        const a = st.after[i] as number;
        if (b === a) continue;
        cells.push(i);
      }
      if (cells.length === 0) continue;
      if (cells.length * SPARSE_BYTES > DIFF_BYTES) {
        const before = new Int32Array(SECTION_CELLS).fill(UNSET);
        const after = new Int32Array(SECTION_CELLS).fill(UNSET);
        for (const i of cells) {
          before[i] = st.before[i] as number;
          after[i] = st.after[i] as number;
        }
        diffs.push({ sx: st.sx, sy: st.sy, sz: st.sz, before, after });
      } else {
        sparse.push({ sx: st.sx, sy: st.sy, sz: st.sz, cells });
        sparseCount += cells.length;
      }
    }
    const positions = new Int32Array(sparseCount * 3);
    const before = new Int32Array(sparseCount);
    const after = new Int32Array(sparseCount);
    let n = 0;
    for (const { sx, sy, sz, cells } of sparse) {
      const st = this.stages.get(`${sx},${sy},${sz}`) as SectionStage;
      for (const i of cells) {
        positions[3 * n] = (sx << SECTION_BITS) | (i & SECTION_MASK);
        positions[3 * n + 1] = (sy << SECTION_BITS) | (i >> 8);
        positions[3 * n + 2] = (sz << SECTION_BITS) | ((i >> 4) & SECTION_MASK);
        before[n] = st.before[i] as number;
        after[n] = st.after[i] as number;
        n++;
      }
    }
    const blockEntities: BlockEntityChange[] = [];
    for (const e of this.beStages.values()) {
      if (e.before === undefined && e.after === undefined) continue;
      // Equal values still matter when the cell's block changed: the volume
      // may have dropped the block entity along with the old block.
      if (e.before === e.after && !this.isChanged(e.x, e.y, e.z)) continue;
      blockEntities.push({ x: e.x, y: e.y, z: e.z, before: e.before, after: e.after });
    }
    return { label, positions, before, after, sections: diffs, blockEntities };
  }
}

/**
 * Merge commands applied one after another into a single command, so a
 * mouse drag becomes one undo step. Pass them in the order they were applied.
 */
export function mergeCommands(label: string, commands: readonly Command[]): Command {
  const staging = new Staging();
  for (const c of commands) {
    forEachChange(c, (x, y, z, before, after) => staging.record(x, y, z, before, after));
    for (const e of c.blockEntities) staging.recordBlockEntity(e.x, e.y, e.z, e.before, e.after);
  }
  return staging.toCommand(label);
}

function checkCoordinate(axis: string, v: number): void {
  if (!Number.isSafeInteger(v) || Math.abs(v) > 0x7fffffff) {
    throw new EditError(`axis ${axis}: coordinate ${v} is not a 32-bit integer`);
  }
}

const hasNbt = (block: string): boolean => block.includes("{");
/** A block string without its block-entity NBT. */
export const baseState = (block: string): string => {
  const brace = block.indexOf("{");
  return brace === -1 ? block : block.slice(0, brace);
};

export interface BuilderOptions {
  /** Per-axis size limit for growth. Default {@link MAX_EXTENT}. */
  maxExtent?: number;
}

/**
 * Records edits against a volume without touching it, then freezes them into
 * a {@link Command}. Writes see earlier writes of the same builder.
 */
export class CommandBuilder {
  private readonly staging = new Staging();
  private readonly maxExtent: number;

  readonly volume: Volume;
  readonly label: string;

  constructor(volume: Volume, label: string, options: BuilderOptions = {}) {
    this.volume = volume;
    this.label = label;
    this.maxExtent = options.maxExtent ?? MAX_EXTENT;
  }

  /** Palette index at a cell as it will be once the builder's writes are applied. */
  indexAt(x: number, y: number, z: number): number {
    return this.staging.peek(x, y, z) ?? this.volume.indexAt(x, y, z);
  }

  /** The block entity at a cell as it will be once the builder's writes are applied. */
  blockEntityAt(x: number, y: number, z: number): BlockEntity | undefined {
    const staged = this.staging.blockEntityStage(x, y, z);
    return staged === undefined ? this.volume.blockEntityAt(x, y, z) : staged.after;
  }

  /** Set a cell's block entity (or remove it with `undefined`). The cell must end up holding a block. */
  setBlockEntity(x: number, y: number, z: number, entity: BlockEntity | undefined): void {
    checkCoordinate("x", x);
    checkCoordinate("y", y);
    checkCoordinate("z", z);
    if (entity !== undefined && this.indexAt(x, y, z) === UNSET) {
      throw new EditError(`no block at ${x}, ${y}, ${z} to attach a block entity to`);
    }
    this.staging.recordBlockEntity(x, y, z, this.volume.blockEntityAt(x, y, z), entity);
  }

  /**
   * Write a palette index (or {@link UNSET}) unconditionally. The cell keeps
   * its block entity if it holds a block of the same name afterwards, and
   * loses it otherwise.
   */
  setIndex(x: number, y: number, z: number, index: number): void {
    checkCoordinate("x", x);
    checkCoordinate("y", y);
    checkCoordinate("z", z);
    if (index !== UNSET && this.volume.palette[index] === undefined) {
      throw new EditError(`palette index ${index} is not in the volume's palette`);
    }
    const prev = this.indexAt(x, y, z);
    if (prev !== index && this.blockEntityAt(x, y, z) !== undefined) {
      const keeps =
        index !== UNSET &&
        prev !== UNSET &&
        blockIdOf(this.volume.palette[prev] as string) ===
          blockIdOf(this.volume.palette[index] as string);
      if (!keeps) this.setBlockEntity(x, y, z, undefined);
    }
    this.staging.record(x, y, z, this.volume.indexAt(x, y, z), index);
  }

  /** Write a palette index together with exactly this block entity (or none). */
  setCell(x: number, y: number, z: number, index: number, entity: BlockEntity | undefined): void {
    this.setIndex(x, y, z, index);
    if (entity !== undefined || this.blockEntityAt(x, y, z) !== undefined) {
      this.setBlockEntity(x, y, z, index === UNSET ? undefined : entity);
    }
  }

  /** Write a block string, adding it to the palette. */
  setBlock(x: number, y: number, z: number, block: string): void {
    this.setIndex(x, y, z, this.volume.intern(block));
  }

  /**
   * Place a block, keeping the block entity of a block that is already in
   * the same state: if the target has no NBT of its own and the cell holds
   * the same name and properties, nothing changes.
   */
  place(x: number, y: number, z: number, index: number): void {
    const current = this.indexAt(x, y, z);
    if (current !== UNSET && current !== index) {
      const next = this.volume.palette[index] as string;
      const old = this.volume.palette[current] as string;
      if (!hasNbt(next) && baseState(old) === next) return;
    }
    this.setIndex(x, y, z, index);
  }

  /** Make a cell unset. */
  unset(x: number, y: number, z: number): void {
    this.setIndex(x, y, z, UNSET);
  }

  /**
   * Freeze the recorded edits. Throws {@link EditError} if they would grow
   * the volume past the size limit on an axis (a volume that is already
   * larger may keep its size but not grow further).
   */
  finish(): Command {
    const command = this.staging.toCommand(this.label);
    if (!isEmptyCommand(command)) this.checkGrowth(command);
    return command;
  }

  private checkGrowth(command: Command): void {
    // Cheap exit: nothing is newly set, so the volume cannot grow.
    let grows = false;
    forEachChange(command, (_x, _y, _z, before, after) => {
      if (before === UNSET && after !== UNSET) grows = true;
    });
    if (!grows) return;
    // Bounds of the volume as it will be: untouched cells plus staged ones.
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    const note = (x: number, y: number, z: number): void => {
      if (x < (lo[0] as number)) lo[0] = x;
      if (y < (lo[1] as number)) lo[1] = y;
      if (z < (lo[2] as number)) lo[2] = z;
      if (x > (hi[0] as number)) hi[0] = x;
      if (y > (hi[1] as number)) hi[1] = y;
      if (z > (hi[2] as number)) hi[2] = z;
    };
    this.staging.eachChanged((x, y, z, after) => {
      if (after !== UNSET) note(x, y, z);
    });
    this.volume.eachCell((x, y, z) => {
      if (this.staging.peek(x, y, z) === undefined) note(x, y, z);
    });
    const now = this.volume.placedBounds();
    const names = ["x", "y", "z"] as const;
    for (let a = 0; a < 3; a++) {
      const next = (hi[a] as number) - (lo[a] as number) + 1;
      if (next <= this.maxExtent) continue;
      const before = now === null ? 0 : (now[1][a] as number) - (now[0][a] as number) + 1;
      if (next > before) {
        throw new EditError(
          `this edit would make the volume ${next} blocks long along ${names[a]}; the limit is ${this.maxExtent}`,
        );
      }
    }
  }
}
