// SPDX-License-Identifier: AGPL-3.0-only

// The editor as the page uses it: one open volume, its undo history, the chosen tool, block and
// selection, and the mouse and keyboard handling that turns input into core's commands. Core does
// the editing (`Editor`, the tools, `raycast`); this class only decides which tool runs on which
// cells. After every change the sections core marked dirty go to the renderer to be re-meshed.

import {
  type Box,
  type Clipboard,
  type Command,
  canonicalize,
  clipboardCellCount,
  commandCellCount,
  copySelection,
  DEFAULT_HISTORY_BYTES,
  drawLine,
  drawRectangle,
  Editor,
  eraseCells,
  fillSelection,
  forEachChange,
  linePoints,
  makeBox,
  mirrorSelection,
  moveSelection,
  pasteClipboard,
  placeCells,
  type RayHit,
  raycast,
  replaceInSelection,
  rotatedBox,
  rotateSelection,
  type Stroke,
  setBlockProperty,
  UNSET,
  type Vec3,
  type Volume,
} from "@voxwright/core";
import type { Box as MarkBox, WebglRenderer } from "@voxwright/render/webgl";
import { type LastChange, makeChange, type SessionEvent } from "./changes.ts";
import {
  boxBetween,
  cellOnPlane,
  clipRayToBox,
  DEFAULT_CURSOR_OFFSET_PX,
  focusDistance,
  inSlice,
  isTouchTool,
  isTwoPointTool,
  isTypingTarget,
  type KeyAction,
  keyAction,
  normalAxis,
  paletteEntries,
  shiftBox,
  type ToolId,
  toolInfo,
  withoutNbt,
} from "./editing.ts";
import { checkNudge, type FaceSide, stepFace } from "./nudge.ts";
import {
  type CellPending,
  cornerB,
  cornersBox,
  describePending,
  isTwoPoint,
  nudgeCells,
  type Pending,
  type PendingCorner,
  pendingFocusCell,
  pendingSize,
  shiftPending,
  type TwoPointPending,
  type TwoPointTool,
  withCorner,
} from "./pending.ts";

export interface SessionOptions {
  renderer: WebglRenderer;
  canvas: HTMLCanvasElement;
  volume: Volume;
  dataVersion: number | null;
  /** Block ids the texture pack knows, for the palette; empty without a pack. */
  packBlocks: readonly string[];
  /** Edits the volume already holds that cannot be undone (a restored autosave); default 0. */
  baseEdits?: number;
  /** How far above the fingertip the touch cursor sits, in px; default `DEFAULT_CURSOR_OFFSET_PX`. */
  cursorOffsetPx?: number;
  /** Do Place, Replace and Erase wait for a confirm on touch instead of applying at once? Default false. */
  confirmPlacement?: boolean;
  /**
   * Is a page point over the canvas itself and not over a toolbar or sheet drawn on top of it? A
   * touch stroke is cancelled when the finger leaves the canvas. Default: `elementFromPoint`.
   */
  isOverCanvas?: (clientX: number, clientY: number) => boolean;
  /** The most memory the undo history may hold, bytes; default core's `DEFAULT_HISTORY_BYTES` (64 MB). */
  historyBytes?: number;
}

/** What the pointer is over. */
export interface Hover {
  position: Vec3;
  adjacent: Vec3;
  normal: Vec3;
  block: string;
}

export interface ReticleState {
  active: boolean;
  touchX: number;
  touchY: number;
  reticleX: number;
  reticleY: number;
  hit: Hover | null;
}

type Drag =
  | {
      kind: "brush";
      tool: "place" | "paint" | "erase";
      stroke: Stroke;
      axis: 0 | 1 | 2 | null;
      layer: number;
      last: Vec3 | null;
      touched: Set<string>;
      /** Blocks the stroke has changed so far, for the undo toast. */
      changed: number;
    }
  | { kind: "line"; a: Vec3; b: Vec3 }
  | { kind: "rectangle"; a: Vec3; b: Vec3; axis: 0 | 1 | 2; at: number }
  | { kind: "select"; a: Vec3; b: Vec3; before: Box | null };

const AXIS_NAMES = ["x", "y", "z"] as const;
const keyOf = (c: Vec3): string => `${c[0]},${c[1]},${c[2]}`;
const cellText = (c: Vec3): string => c.join(", ");
const boxSizeOf = (b: Box): Vec3 => [
  b.max[0] - b.min[0] + 1,
  b.max[1] - b.min[1] + 1,
  b.max[2] - b.min[2] + 1,
];
const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const blocksText = (n: number): string => `${n} block${n === 1 ? "" : "s"}`;

export class EditSession {
  readonly editor: Editor;
  readonly volume: Volume;
  readonly dataVersion: number | null;
  /** Block ids the texture pack knows; replaced when the user adds or removes a pack. */
  packBlocks = $state.raw<readonly string[]>([]);
  /** Edits already in the volume when the session began: a restored autosave carries some, with no undo history. */
  readonly baseEdits: number;
  /** The most memory the undo history may hold, bytes. */
  readonly historyBytes: number;

  tool = $state<ToolId>("navigate");
  /** The block the drawing tools use: a block id, optionally with `[properties]`. */
  block = $state("minecraft:stone");
  hollow = $state(false);
  onlyEmpty = $state(false);
  skipAir = $state(true);
  selection = $state.raw<Box | null>(null);
  hover = $state.raw<Hover | null>(null);
  /** The block whose state the panel shows: what the pointer was last over. */
  inspected = $state.raw<Vec3 | null>(null);
  message = $state("");
  error = $state("");
  clipboardCells = $state(0);
  /** Bumped by every change to the volume or its history; reads of derived values depend on it. */
  revision = $state(0);
  cameraMode = $state<"orbit" | "fly">("orbit");
  /** How far above the fingertip the touch cursor sits, in px. Read on every touch event, so a change applies at once. */
  cursorOffsetPx = DEFAULT_CURSOR_OFFSET_PX;
  reticle = $state.raw<ReticleState | null>(null);
  /**
   * Told which block the user chose through the palette, the hotbar, Pick or a long press (never a
   * block typed into the field, which is chosen one character at a time). The page keeps the recent
   * blocks with it.
   */
  onBlockChosen: ((block: string) => void) | null = null;
  /**
   * On touch: do Place, Replace and Erase only arm a cell on a tap or the end of a drag, and wait
   * for `confirmPending` (the Confirm setting)? Change it with `setConfirmPlacement`.
   */
  confirmPlacement = $state(false);
  /**
   * The edit touch has begun and the user has not confirmed: the corners of a line, rectangle or
   * selection, an armed cell, or a paste origin. `null` when nothing waits. Replaced, never changed.
   */
  pending = $state.raw<Pending | null>(null);
  /**
   * The newest entry in the undo history, while it is still the newest: set by every edit that adds
   * one (a tap, a stroke, a confirmed pending action, a fill, replace, paste, move, rotate, mirror,
   * a block-state change), `null` once anything undoes or redoes. The undo toast shows it.
   */
  lastChange = $state.raw<LastChange | null>(null);
  /**
   * Told about what happens in the session that the page may want to feel or show: a commit, a
   * cancel, a refusal, an undo, a redo (the vibration and the walkthrough use it). Never required.
   */
  onEvent: ((event: SessionEvent) => void) | null = null;
  /** Is the page in the touch layout? Words messages for taps instead of keys. Set by the page. */
  touchUi = false;

  private readonly renderer: WebglRenderer;
  private changeSeq = 0;
  private readonly canvas: HTMLCanvasElement;
  private drag: Drag | null = null;
  private slice: { y0: number; y1: number } | null = null;
  private bounds: Box | null;
  /** The revision at the last export; a restored session starts at -1, unsaved. */
  private savedRevision = 0;
  private pointer: { x: number; y: number } | null = null;
  /** Where the finger of a touch gesture is, while the tool owns the gesture. */
  private touchFinger: { x: number; y: number } | null = null;
  /** A corner drag in progress: the pending value to go back to if the drag is cancelled. */
  private cornerDrag: { before: TwoPointPending } | null = null;
  /** A drag of an arming tool began and has not ended: its lift arms a cell, unless the drag was cancelled. */
  private touchDragging = false;
  private readonly overCanvas: (clientX: number, clientY: number) => boolean;
  private frame = 0;
  private detach: (() => void) | null = null;

  constructor(options: SessionOptions) {
    this.renderer = options.renderer;
    this.canvas = options.canvas;
    this.volume = options.volume;
    this.dataVersion = options.dataVersion;
    this.packBlocks = options.packBlocks;
    this.baseEdits = options.baseEdits ?? 0;
    this.cursorOffsetPx = options.cursorOffsetPx ?? DEFAULT_CURSOR_OFFSET_PX;
    this.confirmPlacement = options.confirmPlacement ?? false;
    this.overCanvas =
      options.isOverCanvas ??
      ((x, y) => options.canvas.ownerDocument.elementFromPoint(x, y) === options.canvas);
    this.historyBytes = options.historyBytes ?? DEFAULT_HISTORY_BYTES;
    this.editor = new Editor(options.volume, { maxBytes: this.historyBytes });
    if (this.baseEdits > 0) this.savedRevision = -1;
    const bb = options.volume.placedBounds();
    this.bounds = bb === null ? null : { min: bb[0], max: bb[1] };
  }

  // -- State the panels read --------------------------------------------------------------------

  get canUndo(): boolean {
    void this.revision;
    return this.editor.history.canUndo;
  }

  get canRedo(): boolean {
    void this.revision;
    return this.editor.history.canRedo;
  }

  get undoCount(): number {
    void this.revision;
    return this.editor.history.undoCount;
  }

  /** Edits made in this session plus the ones a restore carried over (those cannot be undone). */
  get editCount(): number {
    return this.baseEdits + this.undoCount;
  }

  /** Edits the user has not exported (nor undone): what the leave-the-page warning and autosave are about. */
  get unsaved(): boolean {
    return (
      (this.editor.history.canUndo || this.baseEdits > 0) && this.revision !== this.savedRevision
    );
  }

  markSaved(): void {
    this.savedRevision = this.revision;
  }

  /** The block string at the inspected cell, or `null` when there is none (or it is air). */
  get inspectedBlock(): string | null {
    void this.revision;
    const p = this.inspected;
    if (p === null) return null;
    const b = this.volume.get(p[0], p[1], p[2]);
    return b === undefined ? null : b;
  }

  get paletteBlocks(): ReturnType<typeof paletteEntries> {
    void this.revision;
    return paletteEntries(this.volume.palette, this.packBlocks);
  }

  /** Is the camera one the tools can be used with (they need the pointer free: orbit)? */
  get interactive(): boolean {
    return this.tool !== "navigate" && this.cameraMode === "orbit";
  }

  /** Would a finger that lands now drive the tool through the offset cursor (a touch tool, in Orbit)? */
  get touchToolActive(): boolean {
    return this.cameraMode === "orbit" && isTouchTool(this.tool);
  }

  /**
   * Does a tap with the current tool arm something to confirm, rather than apply at once? True for
   * the two-corner tools and Paste always, and for Place, Replace and Erase with `confirmPlacement`.
   */
  private get touchArms(): boolean {
    const tool = this.tool;
    if (isTwoPointTool(tool) || tool === "paste") return true;
    return this.confirmPlacement && (tool === "place" || tool === "paint" || tool === "erase");
  }

  /** The size of the copied box, or `null` when nothing was copied. */
  private get clipSize(): Vec3 | null {
    return this.editor.clipboard?.size ?? null;
  }

  /** The line above the toolbar while something is pending: the armed cell and its block, or the corners and the size. */
  get pendingReadout(): string {
    void this.revision;
    const p = this.pending;
    if (p === null) return "";
    return describePending(p, {
      block: this.block,
      blockAt: (c) => this.volume.get(c[0], c[1], c[2]),
      clipSize: this.clipSize,
    });
  }

  // -- Wiring -----------------------------------------------------------------------------------

  /** Listen for the mouse on the canvas and the keyboard on the page. Returns the way to stop. */
  attach(): () => void {
    const host = this.canvas.parentElement ?? this.canvas;
    const down = (e: PointerEvent): void => this.onPointerDown(e);
    const move = (e: PointerEvent): void => this.onPointerMove(e);
    const up = (e: PointerEvent): void => this.onPointerUp(e);
    const leave = (e: PointerEvent): void => this.onPointerLeave(e);
    const wheel = (): void => this.schedule(); // zooming moves the scene under a still pointer
    const key = (e: KeyboardEvent): void => this.onKey(e);
    // Capture phase on the canvas's parent: runs before the renderer's own listeners, which an
    // editing click must not reach (they would start turning the view).
    host.addEventListener("pointerdown", down, true);
    this.canvas.addEventListener("pointermove", move);
    this.canvas.addEventListener("pointerup", up);
    this.canvas.addEventListener("pointercancel", up);
    this.canvas.addEventListener("pointerleave", leave);
    this.canvas.addEventListener("wheel", wheel, { passive: true });
    window.addEventListener("keydown", key);
    this.detach = () => {
      host.removeEventListener("pointerdown", down, true);
      this.canvas.removeEventListener("pointermove", move);
      this.canvas.removeEventListener("pointerup", up);
      this.canvas.removeEventListener("pointercancel", up);
      this.canvas.removeEventListener("pointerleave", leave);
      this.canvas.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", key);
    };
    return this.detach;
  }

  dispose(): void {
    this.touchIdle();
    this.cancelDrag();
    this.pending = null;
    this.lastChange = null;
    this.onEvent = null;
    this.detach?.();
    this.detach = null;
    cancelAnimationFrame(this.frame);
    this.renderer.highlight([]);
  }

  /** Say that this session began from a restored autosave. */
  noteRestored(edits: number, saved: string): void {
    this.message = `Restored ${edits} edit${edits === 1 ? "" : "s"} saved ${saved}. Undo history was not kept, so these edits cannot be undone.`;
  }

  /** The layers the view is limited to; picking ignores everything outside them. */
  setSlice(range: { y0: number; y1: number } | null): void {
    this.slice = range === null ? null : { ...range };
    this.hover = null;
    this.refreshHighlight();
  }

  setCameraMode(mode: "orbit" | "fly"): void {
    this.cameraMode = mode;
    if (mode === "fly") {
      this.cancelDrag();
      this.clearPending(true);
    }
    this.hover = null;
    this.refreshHighlight();
  }

  setTool(tool: ToolId): void {
    if (tool === "paste" && this.editor.clipboard === null) {
      this.message = this.touchUi
        ? "Nothing copied yet: select blocks, then tap Copy in the Selection sheet."
        : "Nothing copied yet: select blocks and press Ctrl+C.";
      return;
    }
    this.cancelDrag();
    // Choosing the tool that is already armed keeps what it has begun; any other tool drops it.
    if (tool !== this.tool) this.clearPending(true);
    this.tool = tool;
    this.error = "";
    this.message = "";
    this.refreshHighlight();
  }

  // -- Picking ----------------------------------------------------------------------------------

  /** The block under a page point: core's `raycast` along the renderer's camera ray. */
  pick(
    clientX: number,
    clientY: number,
    skip?: (x: number, y: number, z: number) => boolean,
  ): Hover | null {
    const ray = this.renderer.rayFromClient(clientX, clientY);
    if (ray === null || this.bounds === null) return null;
    const clipped = clipRayToBox(ray, this.bounds);
    if (clipped === null) return null;
    const hit: RayHit | null = raycast(this.volume, clipped.origin, ray.direction, {
      maxDistance: clipped.length + 1,
      accept: (x, y, z) => inSlice(this.slice, y) && (skip === undefined || !skip(x, y, z)),
    });
    return hit === null
      ? null
      : { position: hit.position, adjacent: hit.adjacent, normal: hit.normal, block: hit.block };
  }

  // -- Pointer ----------------------------------------------------------------------------------

  private onPointerDown(e: PointerEvent): void {
    if (e.target !== this.canvas || !this.interactive) return;
    // Touch stays a viewer; a modifier or another button hands the drag to the camera
    // (Alt turns, Shift or the right button moves sideways).
    if (e.pointerType === "touch" || e.button !== 0 || e.shiftKey || e.altKey) return;
    e.stopPropagation();
    e.preventDefault();
    this.canvas.focus({ preventScroll: true });
    this.canvas.setPointerCapture(e.pointerId);
    this.error = "";
    this.begin(this.pick(e.clientX, e.clientY), e.clientX, e.clientY);
  }

  private begin(hit: Hover | null, x: number, y: number): void {
    const tool = this.tool;
    try {
      switch (tool) {
        case "place":
        case "paint":
        case "erase":
          if (hit === null) return;
          if (tool !== "erase") canonicalize(this.block); // fail before touching anything
          this.beginBrush(tool, hit);
          return;
        case "eyedropper":
          if (hit === null) return;
          this.pickBlock(hit);
          this.tool = "place";
          this.refreshHighlight();
          return;
        case "line": {
          if (hit === null || !inSlice(this.slice, hit.adjacent[1])) return;
          canonicalize(this.block);
          this.drag = { kind: "line", a: hit.adjacent, b: hit.adjacent };
          break;
        }
        case "rectangle": {
          if (hit === null || !inSlice(this.slice, hit.adjacent[1])) return;
          canonicalize(this.block);
          const axis = normalAxis(hit.normal) ?? 1;
          // The plane of the face that was clicked, so the cell under the pointer is the one the pointer shows.
          const at = axis !== null && (hit.normal[axis] as number) < 0 ? 1 : 0;
          this.drag = { kind: "rectangle", a: hit.adjacent, b: hit.adjacent, axis, at };
          break;
        }
        case "select":
          if (hit === null) return;
          this.drag = { kind: "select", a: hit.position, b: hit.position, before: this.selection };
          this.selection = makeBox(hit.position, hit.position);
          break;
        case "paste":
          if (hit === null) return;
          this.pasteAt(hit.adjacent);
          return;
        case "navigate":
          return;
      }
    } catch (err) {
      this.error = errorText(err);
      return;
    }
    this.pointer = { x, y };
    this.refreshHighlight();
  }

  /** Make the block a hit names the one the tools use, and say so. */
  private pickBlock(hit: Hover): void {
    this.block = withoutNbt(hit.block);
    this.message = `Picked ${this.block}`;
    this.onBlockChosen?.(this.block);
  }

  /** Make a block the one the tools use, from the palette or the hotbar, and tell `onBlockChosen`. */
  chooseBlock(block: string): void {
    this.block = block;
    this.error = "";
    this.onBlockChosen?.(block);
  }

  private beginBrush(tool: "place" | "paint" | "erase", hit: Hover): void {
    const axis = normalAxis(hit.normal);
    const cell = tool === "place" ? hit.adjacent : hit.position;
    const label = tool === "place" ? "place" : tool === "paint" ? "replace block" : "erase";
    const drag: Drag = {
      kind: "brush",
      tool,
      stroke: this.editor.beginStroke(label),
      axis,
      layer: axis === null ? 0 : (cell[axis] as number),
      last: null,
      touched: new Set(),
      changed: 0,
    };
    this.drag = drag;
    this.brushTo(drag, hit);
  }

  /** Apply the brush at the cell a hit names, filling the gap from the last cell. */
  private brushTo(drag: Extract<Drag, { kind: "brush" }>, hit: Hover): void {
    // Stay on the surface the stroke began on, so dragging over what it just built or cleared does not
    // wander into the layer behind.
    if (drag.axis !== null && normalAxis(hit.normal) !== drag.axis) return;
    const cell = drag.tool === "place" ? hit.adjacent : hit.position;
    if (drag.axis !== null && cell[drag.axis] !== drag.layer) return;
    if (!inSlice(this.slice, cell[1])) return;
    const from = drag.last;
    const cells =
      from !== null && Math.max(...cell.map((v, i) => Math.abs(v - (from[i] as number)))) <= 64
        ? linePoints(from, cell).slice(1)
        : [cell];
    if (cells.length === 0) return;
    drag.last = cell;
    try {
      const v = this.volume;
      const command =
        drag.tool === "erase"
          ? eraseCells(v, cells, { toAir: true }, "erase")
          : placeCells(v, cells, this.block, drag.tool === "place" ? "place" : "replace block");
      for (const c of cells) drag.touched.add(keyOf(c));
      drag.stroke.apply(command);
      drag.changed += commandCellCount(command);
      this.afterChange(command);
    } catch (err) {
      this.error = errorText(err);
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (e.pointerType === "touch") return; // fingers reach the tool through the touch methods below
    this.pointer = { x: e.clientX, y: e.clientY };
    if (e.buttons !== 0 && this.drag === null) {
      // A camera drag (Alt, Shift or the right button, or any drag with the View tool): no outline follows it.
      if (this.hover !== null) {
        this.hover = null;
        this.refreshHighlight();
      }
      return;
    }
    this.schedule();
  }

  private schedule(): void {
    if (this.frame === 0) this.frame = requestAnimationFrame(() => this.tick());
  }

  private tick(): void {
    this.frame = 0;
    if (this.touchFinger !== null) {
      this.touchTick(this.touchFinger);
      return;
    }
    const p = this.pointer;
    if (p === null || this.cameraMode === "fly") return;
    if (this.drag !== null) {
      this.updateDrag(p.x, p.y);
      return;
    }
    this.updateHover(p.x, p.y);
  }

  private updateHover(x: number, y: number): void {
    this.applyHover(this.pick(x, y));
  }

  /** Make a pick the hover, redrawing only if it names another cell. */
  private applyHover(hit: Hover | null): void {
    const same =
      hit === null
        ? this.hover === null
        : this.hover !== null &&
          keyOf(hit.position) === keyOf(this.hover.position) &&
          keyOf(hit.adjacent) === keyOf(this.hover.adjacent);
    if (same) return;
    this.hover = hit;
    if (hit !== null) this.inspected = hit.position;
    this.refreshHighlight();
  }

  private updateDrag(x: number, y: number): void {
    const drag = this.drag;
    if (drag === null) return;
    switch (drag.kind) {
      case "brush": {
        const hit = this.pick(
          x,
          y,
          drag.tool === "erase" ? undefined : (cx, cy, cz) => drag.touched.has(`${cx},${cy},${cz}`),
        );
        if (hit !== null) this.brushTo(drag, hit);
        this.hover = hit;
        break;
      }
      case "line": {
        const hit = this.pick(x, y);
        if (hit !== null && inSlice(this.slice, hit.adjacent[1])) drag.b = hit.adjacent;
        break;
      }
      case "rectangle": {
        const ray = this.renderer.rayFromClient(x, y);
        const cell =
          ray === null ? null : cellOnPlane(ray, drag.axis, drag.a[drag.axis] as number, drag.at);
        if (cell !== null) {
          const b = cell.map((v, i) => Math.max(-256, Math.min(256, v - (drag.a[i] as number))));
          const next = [0, 1, 2].map(
            (i) => (drag.a[i] as number) + (b[i] as number),
          ) as unknown as Vec3;
          if (inSlice(this.slice, next[1])) drag.b = next;
        }
        break;
      }
      case "select": {
        const hit = this.pick(x, y);
        if (hit !== null) drag.b = hit.position;
        this.selection = boxBetween(drag.a, drag.b);
        break;
      }
    }
    this.refreshHighlight();
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.pointerType === "touch") return;
    const drag = this.drag;
    if (drag === null) return;
    this.settleDrag(e.clientX, e.clientY);
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    this.commitDrag(drag, false);
  }

  /** Apply the last position to the drag in progress and detach it from the pointer. */
  private settleDrag(x: number, y: number): void {
    this.dropFrame();
    this.updateDrag(x, y);
    this.drag = null;
  }

  /** Finish a drag that `settleDrag` detached: run the command it built, or record the stroke as one undo step. */
  private commitDrag(drag: Drag, touch: boolean): void {
    try {
      switch (drag.kind) {
        case "brush":
          if (drag.stroke.commit()) {
            this.revision++;
            this.message = touch
              ? `${drag.stroke.label} done`
              : `${drag.stroke.label} done (Ctrl+Z undoes it)`;
            this.noteChange(drag.stroke.label, drag.changed);
          }
          break;
        case "line":
          this.runCommand(drawLine(this.volume, drag.a, drag.b, this.block));
          break;
        case "rectangle":
          this.runCommand(
            drawRectangle(this.volume, drag.a, drag.b, this.block, {
              normal: AXIS_NAMES[drag.axis],
              hollow: this.hollow,
            }),
          );
          break;
        case "select": {
          const box = boxBetween(drag.a, drag.b);
          this.selection = box;
          const [w, h, l] = [0, 1, 2].map(
            (i) => (box.max[i] as number) - (box.min[i] as number) + 1,
          );
          this.message = `Selected ${w} × ${h} × ${l}`;
          break;
        }
      }
    } catch (err) {
      this.error = errorText(err);
    }
    this.refreshHighlight();
  }

  private dropFrame(): void {
    if (this.frame !== 0) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }

  private onPointerLeave(e: PointerEvent): void {
    if (e.pointerType === "touch") return; // a finger leaves the canvas as it lifts
    this.pointer = null;
    if (this.drag !== null) return;
    this.hover = null;
    this.refreshHighlight();
  }

  // -- Touch ------------------------------------------------------------------------------------
  //
  // A finger drives Place, Replace, Erase and Pick through an offset cursor: the target is the
  // point `cursorOffsetPx` above the finger, so the finger does not hide the cell that will change.
  // `TouchRouter` decides when a gesture belongs to the tool and calls these; the session's own
  // DOM listeners ignore touch pointers. All points are client coordinates of the finger.

  /** A finger landed or moved: show the cell under the cursor. False: the gesture was cancelled (off the canvas). */
  touchMove(x: number, y: number): boolean {
    if (!this.touchToolActive || !this.touchInBounds(x, y)) {
      this.touchStop();
      return false;
    }
    this.touchFinger = { x, y };
    this.schedule(); // one pick per animation frame
    return true;
  }

  /** A tap: apply the tool once at the cell under the cursor, as one undo step. Pick chooses the block. */
  touchTap(x: number, y: number): void {
    const live = this.touchToolActive && this.touchInBounds(x, y);
    this.touchIdle();
    if (live) {
      const ry = y - this.cursorOffsetPx;
      if (this.touchArms) {
        this.touchArm(x, ry);
      } else {
        const hit = this.pick(x, ry);
        if (hit !== null) {
          this.error = "";
          this.inspected = hit.position;
          this.begin(hit, x, ry);
          const drag = this.drag;
          if (drag !== null && drag.kind === "brush") {
            this.drag = null;
            this.commitDrag(drag, true);
          }
        }
      }
    }
    this.refreshHighlight();
  }

  /** The finger moved past the tap slop: begin a stroke at the cell the finger-down point previewed. */
  touchStrokeBegin(x: number, y: number): void {
    // Pick only moves the cursor. As with a mouse press on empty space, no hit means no stroke.
    if (!this.touchToolActive || this.tool === "eyedropper" || this.drag !== null) return;
    if (this.touchArms) {
      // Nothing is painted. The drag moves the cursor, or the active corner of a two-corner tool
      // that already has one; where the finger lifts, the cursor arms a cell (see `touchStrokeEnd`).
      this.touchDragging = true;
      const p = this.pending;
      if (p !== null && isTwoPoint(p) && p.kind === this.tool && this.cornerDrag === null) {
        this.cornerDrag = { before: p };
      }
      this.error = "";
      this.schedule();
      return;
    }
    const ry = y - this.cursorOffsetPx;
    const hit = this.pick(x, ry);
    if (hit === null) return;
    this.error = "";
    this.begin(hit, x, ry);
    this.schedule();
  }

  /** The finger lifted after a drag: apply the last position and commit the stroke as one undo step. */
  touchStrokeEnd(x: number, y: number): void {
    if (this.touchArms) {
      this.touchArmedDragEnd(x, y);
      return;
    }
    const drag = this.drag;
    if (drag === null || drag.kind !== "brush") {
      this.touchStop(); // Pick's drag, or the stroke is already gone (undo from the thumb cluster)
      return;
    }
    if (!this.touchToolActive || !this.touchInBounds(x, y)) {
      this.touchStop();
      return;
    }
    this.touchIdle();
    this.settleDrag(x, y - this.cursorOffsetPx);
    this.commitDrag(drag, true);
  }

  /** Throw the gesture away: revert a stroke in progress, hide the cursor and the hover. */
  touchCancel(): void {
    this.touchStop();
  }

  /** A long press: pick the block under the cursor. The tool stays, except that Pick does what its tap does. */
  touchLongPress(x: number, y: number): void {
    const live = this.touchToolActive && this.touchInBounds(x, y);
    this.touchIdle();
    if (live) {
      const ry = y - this.cursorOffsetPx;
      const hit = this.pick(x, ry);
      if (hit !== null) {
        this.error = "";
        this.inspected = hit.position;
        if (this.tool === "eyedropper") this.begin(hit, x, ry);
        else this.pickBlock(hit);
      }
    }
    this.refreshHighlight();
  }

  /** A long press while the camera owns the gesture (View, Line, Rectangle, Select, Paste): pick the block under the finger itself. */
  touchPickAt(x: number, y: number): void {
    if (this.cameraMode !== "orbit") return;
    const hit = this.pick(x, y);
    if (hit === null) return;
    this.error = "";
    this.inspected = hit.position;
    this.pickBlock(hit);
    this.refreshHighlight();
  }

  /**
   * A tap while the camera owns the gesture, with the View tool: the block under the finger itself
   * (there is no offset cursor in View) becomes the inspected one, is outlined, and the readout line
   * offers its state sheet. A tap on empty space clears `inspected` again, so the outline and the
   * chip go and the state sheet has nothing to edit; the selection is left alone. Returns whether a
   * block was found. Any other tool, and the fly camera, do nothing with the tap.
   */
  touchInspectAt(x: number, y: number): boolean {
    if (this.cameraMode !== "orbit" || this.tool !== "navigate") return false;
    const hit = this.pick(x, y);
    this.error = "";
    this.message = "";
    this.inspected = hit === null ? null : hit.position;
    this.refreshHighlight();
    return hit !== null;
  }

  /**
   * A double tap while the camera owns the gesture, with the View tool: the orbit target moves to
   * the centre of the block under the finger and the distance halves (not below 4 blocks, see
   * `focusDistance`). A double tap on empty space does nothing. Returns whether the camera moved.
   * Any other tool, and the fly camera, do nothing with it.
   */
  touchFocusAt(x: number, y: number): boolean {
    if (this.cameraMode !== "orbit" || this.tool !== "navigate") return false;
    const hit = this.pick(x, y);
    if (hit === null) return false;
    this.focusCell(hit.position);
    return true;
  }

  /**
   * "Zoom in here": focus the camera on the pending cell, the paste origin or the active corner (A
   * while B is not set), the same way a double tap does. Returns false with nothing pending.
   */
  focusPending(): boolean {
    const p = this.pending;
    if (p === null) return false;
    const cell = pendingFocusCell(p);
    this.focusCell(cell);
    this.say(`Zoomed in on ${cellText(cell)}`);
    return true;
  }

  /**
   * "Zoom to this block": the double tap's focus from a button, on the inspected block, with any
   * tool. Returns false with no inspected block (or in the fly camera).
   */
  focusInspected(): boolean {
    const p = this.inspected;
    if (this.cameraMode !== "orbit" || p === null || this.inspectedBlock === null) return false;
    this.focusCell(p);
    this.say(`Zoomed in on ${cellText(p)}`);
    return true;
  }

  /**
   * "Centre on the build": the orbit target back on the middle of the whole build, at the distance
   * that fits it (the renderer's own framing, as when the file opened; the turn and tilt stay). The
   * button that stands in for the two-finger pan.
   */
  centreOnBuild(): boolean {
    if (this.cameraMode !== "orbit") return false;
    this.renderer.frameCamera();
    this.say("Centred on the build");
    return true;
  }

  /** Put the orbit target at the centre of a cell and bring the camera half as close (see `focusDistance`). */
  private focusCell(cell: Vec3): void {
    this.renderer.focusOn(
      [cell[0] + 0.5, cell[1] + 0.5, cell[2] + 0.5],
      focusDistance(this.renderer.getPose().distance),
    );
  }

  /** Every finger is up: nothing of the gesture stays on screen, and a stroke still open is reverted. */
  touchEnd(): void {
    this.touchStop();
  }

  /** The cursor point is on the canvas, and the finger is over the canvas and not over a toolbar or sheet. */
  private touchInBounds(x: number, y: number): boolean {
    const ry = y - this.cursorOffsetPx;
    const r = this.canvas.getBoundingClientRect();
    if (x < r.left || x > r.right || ry < r.top || ry > r.bottom) return false;
    return this.overCanvas(x, y);
  }

  /** Forget the finger and hide the cursor and the hover. */
  private touchIdle(): void {
    this.dropFrame();
    this.touchFinger = null;
    this.reticle = null;
    this.hover = null;
  }

  private touchStop(): void {
    // A stroke or a corner drag that is taken back is a cancel the finger should feel; a gesture
    // that ends with nothing in progress (a plain preview) is not.
    const reverted = this.drag !== null || this.cornerDrag !== null;
    this.touchIdle();
    this.touchDragging = false;
    this.revertCornerDrag();
    if (this.drag !== null) this.cancelDrag();
    else this.refreshHighlight();
    if (reverted) this.emit({ kind: "cancel" });
  }

  /** The once-per-frame work of a touch gesture: pick under the cursor, move the outline and the cursor drawing. */
  private touchTick(finger: { x: number; y: number }): void {
    if (!this.touchToolActive) return;
    const rx = finger.x;
    const ry = finger.y - this.cursorOffsetPx;
    if (this.cornerDrag !== null) this.dragCorner(rx, ry);
    else if (this.drag !== null) this.updateDrag(rx, ry);
    else this.updateHover(rx, ry);
    this.reticle = {
      active: true,
      touchX: finger.x,
      touchY: finger.y,
      reticleX: rx,
      reticleY: ry,
      hit: this.hover,
    };
  }

  // -- Pending edits (touch) ---------------------------------------------------------------------
  //
  // Line, Rectangle and Select take two taps on touch, Paste one, and Place, Replace and Erase one
  // when `confirmPlacement` is on. A tap does not change the volume: it sets `pending`, which the
  // nudge pad moves and the thumb cluster's confirm or cancel finishes. `confirmPending` runs the
  // same command the mouse builds for those cells.

  /** A tap, or the lift at the end of a drag, with an arming tool: set the pending value from the cursor. */
  private touchArm(x: number, ry: number): void {
    this.error = "";
    const tool = this.tool;
    if (isTwoPointTool(tool)) {
      this.tapCorner(tool as TwoPointTool, x, ry);
      return;
    }
    const hit = this.pick(x, ry);
    if (hit === null) return;
    this.inspected = hit.position;
    if (tool === "paste") {
      if (!inSlice(this.slice, hit.adjacent[1])) return;
      this.setPending({ kind: "paste", at: hit.adjacent });
      this.say(`Paste origin set at ${cellText(hit.adjacent)}`);
    } else if (tool === "place" || tool === "paint" || tool === "erase") {
      this.armCell(tool, hit);
    }
  }

  private armCell(tool: CellPending["tool"], hit: Hover): void {
    const cell = tool === "place" ? hit.adjacent : hit.position;
    if (!inSlice(this.slice, cell[1])) return;
    if (tool !== "erase") {
      try {
        canonicalize(this.block); // fail before anything is armed
      } catch (err) {
        this.refuse(errorText(err));
        return;
      }
    }
    this.inspected = hit.position;
    this.setPending({ kind: "cell", tool, cell });
    this.say(`Armed ${cellText(cell)}`);
  }

  /** A tap with a two-corner tool: the first sets A, the second sets B, later ones move the active corner. */
  private tapCorner(tool: TwoPointTool, x: number, ry: number): void {
    const p = this.pending;
    const current = p !== null && p.kind === tool ? (p as TwoPointPending) : null;
    const hit = this.pick(x, ry);
    if (hit !== null) this.inspected = hit.position; // the block tapped, whether or not the corner moves
    if (current === null) {
      const first = this.firstCorner(tool, hit, null);
      if (first === null) return;
      this.setPending(first);
      this.say(`Corner A set at ${cellText(first.a)}`);
      return;
    }
    const which: PendingCorner = current.b === null ? "b" : current.active;
    const next = this.moveCorner(current, which, x, ry, hit);
    if (next === null) return;
    this.setPending(next);
    const cell = which === "a" ? next.a : cornerB(next);
    const verb = current.b === null ? "set at" : "moved to";
    this.say(`Corner ${which.toUpperCase()} ${verb} ${cellText(cell)}`);
  }

  /** The first corner of a tool from what the cursor is over, as the mouse's press starts the drag; `null` for a miss. */
  private firstCorner(
    tool: TwoPointTool,
    hit: Hover | null,
    prev: TwoPointPending | null,
  ): TwoPointPending | null {
    if (hit === null) return null;
    if (tool === "select") {
      const before = prev !== null && prev.kind === "select" ? prev.before : this.selection;
      return { kind: "select", a: hit.position, b: null, active: "a", before };
    }
    if (!inSlice(this.slice, hit.adjacent[1])) return null;
    try {
      canonicalize(this.block); // fail before anything is armed
    } catch (err) {
      this.refuse(errorText(err));
      return null;
    }
    if (tool === "line") return { kind: "line", a: hit.adjacent, b: null, active: "a" };
    const axis = normalAxis(hit.normal) ?? 1;
    // The plane of the face that was tapped, so the cell under the cursor is the one the cursor shows.
    const at = (hit.normal[axis] as number) < 0 ? 1 : 0;
    return { kind: "rectangle", a: hit.adjacent, b: null, active: "a", axis, at };
  }

  /**
   * `p` with corner `which` moved to what the cursor at (x, y) is over, by the rules of the mouse's
   * drag of the second corner for that tool; `null` when the cursor is over nothing usable (the
   * corner stays). Moving A while B is not set yet places A again, as a first tap would.
   */
  private moveCorner(
    p: TwoPointPending,
    which: PendingCorner,
    x: number,
    y: number,
    hit: Hover | null,
  ): TwoPointPending | null {
    if (which === "a" && p.b === null) return this.firstCorner(p.kind, hit, p);
    switch (p.kind) {
      case "line":
        if (hit === null || !inSlice(this.slice, hit.adjacent[1])) return null;
        return withCorner(p, which, hit.adjacent);
      case "rectangle": {
        const ray = this.renderer.rayFromClient(x, y);
        if (ray === null) return null;
        // The plane the rectangle lies in, so the corner can be over empty space as long as the ray meets it.
        const cell = cellOnPlane(ray, p.axis, p.a[p.axis] as number, p.at);
        if (cell === null) return null;
        const anchor = which === "a" ? cornerB(p) : p.a;
        const next = [0, 1, 2].map(
          (i) =>
            (anchor[i] as number) +
            Math.max(-256, Math.min(256, (cell[i] as number) - (anchor[i] as number))),
        ) as unknown as Vec3;
        if (!inSlice(this.slice, next[1])) return null;
        return withCorner(p, which, next);
      }
      case "select":
        return hit === null ? null : withCorner(p, which, hit.position);
    }
  }

  /** The once-per-frame work of a corner drag: the active corner follows the cursor. */
  private dragCorner(rx: number, ry: number): void {
    const hit = this.pick(rx, ry);
    this.hover = hit; // the cursor ring shows whether it is over a block; no outline is drawn for it
    if (hit !== null) this.inspected = hit.position;
    const p = this.pending;
    if (p === null || !isTwoPoint(p)) {
      this.refreshHighlight();
      return;
    }
    const next = this.moveCorner(p, p.active, rx, ry, hit);
    if (next === null) {
      this.refreshHighlight();
      return;
    }
    const was = p.active === "a" ? p.a : cornerB(p);
    const now = next.active === "a" ? next.a : cornerB(next);
    if (keyOf(was) !== keyOf(now)) this.setPending(next);
    else this.refreshHighlight();
  }

  /** The lift at the end of a drag of an arming tool: the corner stays where the cursor is, or the cursor arms a cell. */
  private touchArmedDragEnd(x: number, y: number): void {
    // The drag is already gone if it was cancelled under the finger (undo, or the second finger).
    if (!this.touchDragging || !this.touchToolActive || !this.touchInBounds(x, y)) {
      this.touchStop();
      return;
    }
    const ry = y - this.cursorOffsetPx;
    this.touchIdle();
    this.touchDragging = false;
    const drag = this.cornerDrag;
    this.cornerDrag = null;
    const p = this.pending;
    if (drag !== null && p !== null && isTwoPoint(p)) {
      const next = this.moveCorner(p, p.active, x, ry, this.pick(x, ry));
      if (next !== null) {
        this.setPending(next);
        const cell = next.active === "a" ? next.a : cornerB(next);
        this.say(`Corner ${next.active.toUpperCase()} moved to ${cellText(cell)}`);
      }
    } else if (drag === null) {
      this.touchArm(x, ry);
    }
    this.refreshHighlight();
  }

  /** Put a corner drag back to where it began (the second finger, or the cursor left the canvas). */
  private revertCornerDrag(): void {
    const drag = this.cornerDrag;
    if (drag === null) return;
    this.cornerDrag = null;
    this.setPending(drag.before);
  }

  /** Let a corner drag in progress end where it is: a nudge, a confirm or a corner switch happened under the finger. */
  private endCornerDrag(): void {
    this.cornerDrag = null;
    this.touchDragging = false;
  }

  /** Replace the pending value, keeping the live selection of a Select in step, and redraw. */
  private setPending(next: Pending | null): void {
    this.pending = next;
    if (next !== null && next.kind === "select") this.selection = cornersBox(next);
    this.refreshHighlight();
  }

  /** Drop the pending value. Select puts back the selection it replaced when `restore` is true. */
  private clearPending(restore: boolean): void {
    this.endCornerDrag();
    const p = this.pending;
    if (p === null) return;
    this.pending = null;
    if (restore && p.kind === "select") this.selection = p.before;
    this.refreshHighlight();
  }

  private say(text: string): void {
    this.message = text;
    this.error = "";
  }

  private refuse(text: string): void {
    this.error = text;
    this.message = "";
    this.emit({ kind: "refuse" });
  }

  /** Turn the Confirm each placement setting on or off. Turning it off drops an armed cell. */
  setConfirmPlacement(on: boolean): void {
    this.confirmPlacement = on;
    if (!on && this.pending !== null && this.pending.kind === "cell") this.clearPending(true);
  }

  /** Choose which corner of a two-corner tool the pad and the next tap move. Switching to B before B exists copies A. */
  setActiveCorner(corner: PendingCorner): void {
    const p = this.pending;
    if (p === null || !isTwoPoint(p)) return;
    this.endCornerDrag();
    const next: TwoPointPending =
      corner === "b" && p.b === null ? { ...p, b: p.a, active: "b" } : { ...p, active: corner };
    this.setPending(next);
    this.say(`Corner ${corner.toUpperCase()} is active`);
  }

  /**
   * Move the pending cell, paste origin or active corner one step along a world axis (0 = x, 1 = y,
   * 2 = z). A rectangle moved along its normal moves whole, one layer. A step the commands would
   * not allow (outside the visible layers, or making the build longer than 512) is refused with a
   * message and nothing moves. Returns whether it moved.
   */
  nudge(axis: 0 | 1 | 2, step: number): boolean {
    const p = this.pending;
    if (p === null) return false;
    this.endCornerDrag();
    const bounds = this.volume.placedBounds();
    const verdict = checkNudge(nudgeCells(p, axis, this.clipSize), axis, step, {
      slice: this.slice,
      // A selection edits nothing, so only its own size is limited.
      build: p.kind === "select" || bounds === null ? null : { min: bounds[0], max: bounds[1] },
    });
    if (!verdict.ok) {
      this.refuse(verdict.reason);
      return false;
    }
    const next = shiftPending(p, axis, step);
    this.setPending(next);
    this.say(this.nudgeText(next, axis));
    return true;
  }

  private nudgeText(p: Pending, axis: 0 | 1 | 2): string {
    if (p.kind === "cell") return `Moved to ${cellText(p.cell)}`;
    if (p.kind === "paste") return `Paste origin moved to ${cellText(p.at)}`;
    if (p.kind === "rectangle" && axis === p.axis) {
      return `Rectangle moved to ${AXIS_NAMES[axis]} ${p.a[axis]}`;
    }
    const cell = p.active === "a" ? p.a : cornerB(p);
    return `Corner ${p.active.toUpperCase()} moved to ${cellText(cell)}`;
  }

  /** Run what is pending: the same command the mouse builds for those cells, as one undo step. */
  confirmPending(): boolean {
    const p = this.pending;
    if (p === null) return false;
    this.endCornerDrag();
    this.error = "";
    let finished: boolean;
    switch (p.kind) {
      case "line":
        finished = this.finishCommand(() => drawLine(this.volume, p.a, cornerB(p), this.block));
        break;
      case "rectangle":
        finished = this.finishCommand(() =>
          drawRectangle(this.volume, p.a, cornerB(p), this.block, {
            normal: AXIS_NAMES[p.axis],
            hollow: this.hollow,
          }),
        );
        break;
      case "select": {
        const box = cornersBox(p);
        this.selection = box;
        const [w, h, l] = pendingSize(p, null) as Vec3;
        this.say(`Selected ${w} × ${h} × ${l}`);
        finished = true;
        break;
      }
      case "cell":
        finished = this.applyCell(p);
        break;
      case "paste":
        finished = this.pasteAt(p.at);
        break;
    }
    // A command that failed (a bad block, the size limit) leaves the pending value for a nudge to fix,
    // and its error is the one thing the message line shows.
    if (finished) this.pending = null;
    else if (this.error !== "") this.message = "";
    this.refreshHighlight();
    return finished;
  }

  /** Throw away what is pending and change nothing. A Select goes back to the selection it had before corner A. */
  cancelPending(): void {
    if (this.pending === null) return;
    this.clearPending(true);
    this.say("Cancelled");
    this.emit({ kind: "cancel" });
  }

  /** Run a freshly built command as one undo step. False only when it failed; "nothing to change" counts as finished. */
  private finishCommand(make: () => Command): boolean {
    this.attempt(make);
    return this.error === "";
  }

  /** Place, replace or erase the one pending cell as one undo step, with the message of a tap. */
  private applyCell(p: CellPending): boolean {
    const label = p.tool === "place" ? "place" : p.tool === "paint" ? "replace block" : "erase";
    const stroke = this.editor.beginStroke(label);
    let changed = 0;
    try {
      const command =
        p.tool === "erase"
          ? eraseCells(this.volume, [p.cell], { toAir: true }, "erase")
          : placeCells(this.volume, [p.cell], this.block, label);
      stroke.apply(command);
      changed = commandCellCount(command);
      this.afterChange(command);
    } catch (err) {
      stroke.cancel();
      this.flush();
      this.refuse(errorText(err));
      return false;
    }
    if (stroke.commit()) {
      this.revision++;
      this.say(`${label} done`);
      this.noteChange(label, changed);
    } else {
      this.say("That would not change anything.");
    }
    return true;
  }

  /**
   * Move one face of the selection box by one block: `grow` adds a layer on that side, otherwise a
   * layer is taken away. Not an edit, so no undo step. A refused step (past the opposite face,
   * outside the visible layers, longer than 512) says why and changes nothing. A selection still
   * waiting for its confirm is taken as it is first.
   */
  stepSelectionFace(axis: 0 | 1 | 2, side: FaceSide, grow: boolean): boolean {
    const box = this.selection;
    if (box === null) return this.needSelection();
    const result = stepFace(box, axis, side, grow, { slice: this.slice });
    if (!result.ok) {
      this.refuse(result.reason);
      return false;
    }
    this.adoptSelection(result.box);
    this.refreshHighlight();
    const [w, h, l] = boxSizeOf(result.box);
    this.say(`Selected ${w} × ${h} × ${l}`);
    return true;
  }

  /** Write the selection from something other than the pending Select, which then no longer applies. */
  private adoptSelection(box: Box | null): void {
    if (this.pending !== null && this.pending.kind === "select") {
      this.endCornerDrag();
      this.pending = null;
    }
    this.selection = box;
  }

  private cancelDrag(): void {
    this.touchDragging = false;
    this.revertCornerDrag();
    const drag = this.drag;
    if (drag === null) return;
    this.drag = null;
    if (drag.kind === "brush") {
      drag.stroke.cancel();
      this.flush();
    } else if (drag.kind === "select") this.selection = drag.before;
    this.refreshHighlight();
  }

  // -- Keyboard ---------------------------------------------------------------------------------

  private onKey(e: KeyboardEvent): void {
    if (isTypingTarget(e.target)) return; // the palette search and the other fields keep their keys
    const action = keyAction(e);
    if (action === null) return;
    if (this.perform(action)) e.preventDefault();
  }

  /** Do what a shortcut says. Returns whether the key was used. */
  perform(action: KeyAction): boolean {
    switch (action.type) {
      case "undo":
        this.undo();
        return true;
      case "redo":
        this.redo();
        return true;
      case "tool":
        this.setTool(action.tool);
        return true;
      case "copy":
        return this.copy();
      case "paste":
        this.setTool("paste");
        return true;
      case "fill":
        return this.fill();
      case "rotate":
        return this.rotate(action.direction === "cw" ? "CLOCKWISE_90" : "COUNTERCLOCKWISE_90");
      case "escape":
        if (this.drag !== null) this.cancelDrag();
        else if (this.pending !== null) this.cancelPending();
        else if (this.selection !== null) this.clearSelection();
        else if (this.tool !== "navigate") this.setTool("navigate");
        else return false;
        return true;
    }
  }

  // -- Edits ------------------------------------------------------------------------------------

  undo(): void {
    this.cancelDrag();
    this.clearPending(true);
    if (this.editor.undo()) {
      this.lastChange = null; // the toast's entry is gone, and so is its Undo
      this.message = "Undone";
      this.afterHistory();
      this.emit({ kind: "undo" });
    }
  }

  redo(): void {
    this.cancelDrag();
    this.clearPending(true);
    if (this.editor.redo()) {
      this.lastChange = null;
      this.message = "Redone";
      this.afterHistory();
      this.emit({ kind: "redo" });
    }
  }

  /**
   * The Undo of the toast: take back exactly the entry the toast describes, and only if it is still
   * the newest. Anything undone, redone or edited since has replaced or cleared `lastChange`, and
   * then this does nothing and returns false.
   */
  undoChange(id: number): boolean {
    const change = this.lastChange;
    if (change === null || change.id !== id || !this.editor.history.canUndo) return false;
    this.undo();
    return true;
  }

  private afterHistory(): void {
    this.error = "";
    this.flush();
    this.revision++;
    this.refreshHighlight();
  }

  /** Apply a freshly built command as one undo step. Returns whether it changed anything. */
  private runCommand(command: Command): boolean {
    if (!this.editor.run(command)) {
      this.message = "That would not change anything.";
      return false;
    }
    this.afterChange(command);
    this.message = `${command.label}: ${blocksText(commandCellCount(command))} changed`;
    this.noteChange(command.label, commandCellCount(command));
    return true;
  }

  /** An entry was added to the undo history: remember it for the toast and tell the page. */
  private noteChange(label: string, count: number): void {
    const change = makeChange(++this.changeSeq, label, count);
    this.lastChange = change;
    this.onEvent?.({ kind: "commit", change });
  }

  private emit(event: SessionEvent): void {
    this.onEvent?.(event);
  }

  /** Tell the renderer which sections to rebuild, keep the pick bounds covering the volume, and refresh the panels. */
  private afterChange(command: Command): void {
    forEachChange(command, (x, y, z, _before, after) => {
      if (after === UNSET) return;
      this.bounds =
        this.bounds === null
          ? { min: [x, y, z], max: [x, y, z] }
          : {
              min: [
                Math.min(this.bounds.min[0], x),
                Math.min(this.bounds.min[1], y),
                Math.min(this.bounds.min[2], z),
              ],
              max: [
                Math.max(this.bounds.max[0], x),
                Math.max(this.bounds.max[1], y),
                Math.max(this.bounds.max[2], z),
              ],
            };
    });
    this.flush();
    this.revision++;
  }

  private flush(): void {
    const keys = this.editor.dirty.take();
    if (keys.length > 0) this.renderer.markDirty(keys);
  }

  /** Run one selection or property edit, reporting failure instead of throwing. */
  private attempt(make: () => Command): boolean {
    this.error = "";
    try {
      return this.runCommand(make());
    } catch (err) {
      this.error = errorText(err);
      return false;
    }
  }

  fill(): boolean {
    const box = this.selection;
    if (box === null) return this.needSelection();
    return this.attempt(() =>
      fillSelection(this.volume, box, this.block, { onlyEmpty: this.onlyEmpty }),
    );
  }

  replace(from: string): boolean {
    const box = this.selection;
    if (box === null) return this.needSelection();
    if (from.trim() === "") {
      this.error = "Say which block to replace.";
      return false;
    }
    return this.attempt(() => replaceInSelection(this.volume, box, from.trim(), this.block));
  }

  rotate(rotation: "CLOCKWISE_90" | "COUNTERCLOCKWISE_90"): boolean {
    const box = this.selection;
    if (box === null) return this.needSelection();
    const done = this.attempt(() =>
      rotateSelection(this.volume, box, rotation, { skipAir: this.skipAir }),
    );
    if (done) this.adoptSelection(rotatedBox(box, rotation));
    this.refreshHighlight();
    return true;
  }

  mirror(axis: "x" | "z"): boolean {
    const box = this.selection;
    if (box === null) return this.needSelection();
    this.attempt(() => mirrorSelection(this.volume, box, axis));
    return true;
  }

  move(delta: Vec3): boolean {
    const box = this.selection;
    if (box === null) return this.needSelection();
    const done = this.attempt(() =>
      moveSelection(this.volume, box, delta, { skipAir: this.skipAir }),
    );
    if (done) this.adoptSelection(shiftBox(box, delta));
    this.refreshHighlight();
    return true;
  }

  /** Copy the selection. `touch` words the message for taps (no Ctrl+V). */
  copy(touch = false): boolean {
    const box = this.selection;
    if (box === null) return this.needSelection();
    const clip: Clipboard = copySelection(this.volume, box);
    this.editor.clipboard = clip;
    this.clipboardCells = clipboardCellCount(clip);
    this.message = touch
      ? `Copied ${blocksText(this.clipboardCells)}`
      : `Copied ${blocksText(this.clipboardCells)}. Ctrl+V pastes.`;
    return true;
  }

  /** Paste the clipboard with its corner at `at`. False only when the paste failed; a paste that changes nothing counts as done. */
  private pasteAt(at: Vec3): boolean {
    const clip = this.editor.clipboard;
    if (clip === null) return true;
    const done = this.attempt(() =>
      pasteClipboard(this.volume, clip, at, { skipAir: this.skipAir }),
    );
    if (!done) return this.error === "";
    this.selection = {
      min: at,
      max: [at[0] + clip.size[0] - 1, at[1] + clip.size[1] - 1, at[2] + clip.size[2] - 1],
    };
    this.tool = "select";
    this.refreshHighlight();
    return true;
  }

  /** Put a block at a cell, as one undo step. */
  placeAt(pos: Vec3, block: string): boolean {
    const done = this.attempt(() => placeCells(this.volume, [pos], block, "place"));
    if (done) this.pointAt(pos);
    return done;
  }

  /** Remove the block at a cell (write air), as one undo step. */
  eraseAt(pos: Vec3): boolean {
    const done = this.attempt(() => eraseCells(this.volume, [pos], { toAir: true }, "erase"));
    if (done) this.pointAt(pos);
    return done;
  }

  /** Make a cell the one the block-state panel shows, as if the pointer were over it. */
  private pointAt(pos: Vec3): void {
    this.inspected = pos;
    this.refreshHighlight();
  }

  /** Change one property of the inspected block (a typed value is as good as a suggested one). */
  setProperty(key: string, value: string): boolean {
    const p = this.inspected;
    if (p === null || this.inspectedBlock === null) {
      this.error = "Point at a block first.";
      return false;
    }
    return this.attempt(() => setBlockProperty(this.volume, p, key, value));
  }

  selectAll(): void {
    const bb = this.volume.placedBounds();
    if (bb === null) return;
    this.adoptSelection({ min: bb[0], max: bb[1] });
    this.refreshHighlight();
  }

  setSelection(box: Box | null): void {
    this.adoptSelection(box);
    this.refreshHighlight();
  }

  clearSelection(): void {
    this.setSelection(null);
  }

  private needSelection(): false {
    this.message = this.touchUi
      ? "Select blocks first (Select tool, tap two corners, then the check mark)."
      : "Select blocks first (Select tool, drag between two blocks).";
    return false;
  }

  // -- Outlines ---------------------------------------------------------------------------------

  /** Draw the selection, the block under the pointer and what the next click would add. */
  refreshHighlight(): void {
    const boxes: MarkBox[] = [];
    const sel = this.selection;
    if (sel !== null) boxes.push({ ...sel, style: "selection" });
    const drag = this.drag;
    const hover = this.hover;
    const pending = this.pending;
    if (pending !== null) {
      // What touch has armed: the corners and the box between them, the cell, or the pasted box.
      this.pendingBoxes(pending, boxes);
      // Where the cursor is while a finger is down; a corner drag shows the corner itself instead.
      if (hover !== null && this.cornerDrag === null) {
        boxes.push({ min: hover.position, max: hover.position, style: "hover" });
      }
      this.renderer.highlight(boxes);
      return;
    }
    if (drag === null || drag.kind === "brush") {
      const at = hover?.position ?? (this.inspectedBlock === null ? null : this.inspected);
      if (at !== null) boxes.push({ min: at, max: at, style: "hover" });
    }
    const ghost = (box: Box): void => {
      boxes.push({ ...box, style: "ghost" });
    };
    if (drag !== null) {
      if (drag.kind === "line" || drag.kind === "rectangle") ghost(boxBetween(drag.a, drag.b));
    } else if (hover !== null && inSlice(this.slice, hover.adjacent[1])) {
      const a = hover.adjacent;
      if (this.tool === "place" || this.tool === "line" || this.tool === "rectangle")
        ghost({ min: a, max: a });
      else if (this.tool === "paste") {
        const clip = this.editor.clipboard;
        if (clip !== null)
          ghost({
            min: a,
            max: [a[0] + clip.size[0] - 1, a[1] + clip.size[1] - 1, a[2] + clip.size[2] - 1],
          });
      }
    }
    this.renderer.highlight(boxes);
  }

  /** The outlines of a pending value: the active corner or armed cell in the hover colour, the preview in the ghost colour. */
  private pendingBoxes(p: Pending, boxes: MarkBox[]): void {
    const cell = (c: Vec3, style: MarkBox["style"]): void => {
      boxes.push({ min: c, max: c, style });
    };
    switch (p.kind) {
      case "cell":
        if (p.tool === "place") cell(p.cell, "ghost");
        cell(p.cell, "hover");
        return;
      case "paste": {
        const size = this.clipSize;
        if (size !== null) {
          boxes.push({
            min: p.at,
            max: [p.at[0] + size[0] - 1, p.at[1] + size[1] - 1, p.at[2] + size[2] - 1],
            style: "ghost",
          });
        }
        return;
      }
      case "select":
        // The box itself is the selection, drawn with the rest above.
        cell(p.active === "a" ? p.a : cornerB(p), "hover");
        return;
      default: {
        boxes.push({ ...cornersBox(p), style: "ghost" });
        const other = p.active === "a" ? p.b : p.a;
        if (other !== null) cell(other, "selection");
        cell(p.active === "a" ? p.a : cornerB(p), "hover");
      }
    }
  }

  /** The help line for the active tool. */
  get toolHelp(): string {
    return toolInfo(this.tool).help;
  }
}
