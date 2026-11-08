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
import {
  boxBetween,
  cellOnPlane,
  clipRayToBox,
  inSlice,
  isTouchTool,
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

export interface SessionOptions {
  renderer: WebglRenderer;
  canvas: HTMLCanvasElement;
  volume: Volume;
  dataVersion: number | null;
  /** Block ids the texture pack knows, for the palette; empty without a pack. */
  packBlocks: readonly string[];
  /** Edits the volume already holds that cannot be undone (a restored autosave); default 0. */
  baseEdits?: number;
  /**
   * Is a page point over the canvas itself and not over a toolbar or sheet drawn on top of it? A
   * touch stroke is cancelled when the finger leaves the canvas. Default: `elementFromPoint`.
   */
  isOverCanvas?: (clientX: number, clientY: number) => boolean;
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

export const DEFAULT_CURSOR_OFFSET_PX = 64;
export const RETICLE_OFFSET_Y = DEFAULT_CURSOR_OFFSET_PX;

type Drag =
  | {
      kind: "brush";
      tool: "place" | "paint" | "erase";
      stroke: Stroke;
      axis: 0 | 1 | 2 | null;
      layer: number;
      last: Vec3 | null;
      touched: Set<string>;
    }
  | { kind: "line"; a: Vec3; b: Vec3 }
  | { kind: "rectangle"; a: Vec3; b: Vec3; axis: 0 | 1 | 2; at: number }
  | { kind: "select"; a: Vec3; b: Vec3; before: Box | null };

const AXIS_NAMES = ["x", "y", "z"] as const;
const keyOf = (c: Vec3): string => `${c[0]},${c[1]},${c[2]}`;
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
  cursorOffsetPx = DEFAULT_CURSOR_OFFSET_PX;
  reticle = $state.raw<ReticleState | null>(null);

  private readonly renderer: WebglRenderer;
  private readonly canvas: HTMLCanvasElement;
  private drag: Drag | null = null;
  private slice: { y0: number; y1: number } | null = null;
  private bounds: Box | null;
  /** The revision at the last export; a restored session starts at -1, unsaved. */
  private savedRevision = 0;
  private pointer: { x: number; y: number } | null = null;
  /** Where the finger of a touch gesture is, while the tool owns the gesture. */
  private touchFinger: { x: number; y: number } | null = null;
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
    this.overCanvas =
      options.isOverCanvas ??
      ((x, y) => options.canvas.ownerDocument.elementFromPoint(x, y) === options.canvas);
    this.editor = new Editor(options.volume);
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
    if (mode === "fly") this.cancelDrag();
    this.hover = null;
    this.refreshHighlight();
  }

  setTool(tool: ToolId): void {
    if (tool === "paste" && this.editor.clipboard === null) {
      this.message = "Nothing copied yet: select blocks and press Ctrl+C.";
      return;
    }
    this.cancelDrag();
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
    const hit = this.pick(x, y);
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
    this.refreshHighlight();
  }

  /** The finger moved past the tap slop: begin a stroke at the cell the finger-down point previewed. */
  touchStrokeBegin(x: number, y: number): void {
    // Pick only moves the cursor. As with a mouse press on empty space, no hit means no stroke.
    if (!this.touchToolActive || this.tool === "eyedropper" || this.drag !== null) return;
    const ry = y - this.cursorOffsetPx;
    const hit = this.pick(x, ry);
    if (hit === null) return;
    this.error = "";
    this.begin(hit, x, ry);
    this.schedule();
  }

  /** The finger lifted after a drag: apply the last position and commit the stroke as one undo step. */
  touchStrokeEnd(x: number, y: number): void {
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
    this.pickBlock(hit);
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
    this.touchIdle();
    if (this.drag !== null) this.cancelDrag();
    else this.refreshHighlight();
  }

  /** The once-per-frame work of a touch gesture: pick under the cursor, move the outline and the cursor drawing. */
  private touchTick(finger: { x: number; y: number }): void {
    if (!this.touchToolActive) return;
    const rx = finger.x;
    const ry = finger.y - this.cursorOffsetPx;
    if (this.drag !== null) this.updateDrag(rx, ry);
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

  private cancelDrag(): void {
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
        else if (this.selection !== null) this.clearSelection();
        else if (this.tool !== "navigate") this.setTool("navigate");
        else return false;
        return true;
    }
  }

  // -- Edits ------------------------------------------------------------------------------------

  undo(): void {
    this.cancelDrag();
    if (this.editor.undo()) {
      this.message = "Undone";
      this.afterHistory();
    }
  }

  redo(): void {
    this.cancelDrag();
    if (this.editor.redo()) {
      this.message = "Redone";
      this.afterHistory();
    }
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
    return true;
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
    if (done) this.selection = rotatedBox(box, rotation);
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
    if (done) this.selection = shiftBox(box, delta);
    this.refreshHighlight();
    return true;
  }

  copy(): boolean {
    const box = this.selection;
    if (box === null) return this.needSelection();
    const clip: Clipboard = copySelection(this.volume, box);
    this.editor.clipboard = clip;
    this.clipboardCells = clipboardCellCount(clip);
    this.message = `Copied ${blocksText(this.clipboardCells)}. Ctrl+V pastes.`;
    return true;
  }

  private pasteAt(at: Vec3): void {
    const clip = this.editor.clipboard;
    if (clip === null) return;
    const done = this.attempt(() =>
      pasteClipboard(this.volume, clip, at, { skipAir: this.skipAir }),
    );
    if (!done) return;
    this.selection = {
      min: at,
      max: [at[0] + clip.size[0] - 1, at[1] + clip.size[1] - 1, at[2] + clip.size[2] - 1],
    };
    this.tool = "select";
    this.refreshHighlight();
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
    this.selection = { min: bb[0], max: bb[1] };
    this.refreshHighlight();
  }

  setSelection(box: Box | null): void {
    this.selection = box;
    this.refreshHighlight();
  }

  clearSelection(): void {
    this.setSelection(null);
  }

  private needSelection(): false {
    this.message = "Select blocks first (Select tool, drag between two blocks).";
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

  /** The help line for the active tool. */
  get toolHelp(): string {
    return toolInfo(this.tool).help;
  }
}
