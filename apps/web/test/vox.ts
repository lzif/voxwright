// SPDX-License-Identifier: AGPL-3.0-only

// The page's test hook (`window.__voxwright`, set by the GPU renderer path) as the
// browser tests see it.

export interface Pose {
  position: [number, number, number];
  azimuth: number;
  elevation: number;
  mode: "orbit" | "fly";
}

export interface PickedBlock {
  position: [number, number, number];
  adjacent: [number, number, number];
  normal: [number, number, number];
  block: string;
}

/** The editor session as the browser tests read it (see `EditSession`). */
export interface SessionView {
  tool: string;
  block: string;
  hover: PickedBlock | null;
  inspected: [number, number, number] | null;
  selection: { min: [number, number, number]; max: [number, number, number] } | null;
  undoCount: number;
  canUndo: boolean;
  canRedo: boolean;
  unsaved: boolean;
  clipboardCells: number;
  message: string;
  error: string;
  /** The touch offset cursor while a finger drives a tool, else `null`. */
  reticle: {
    active: boolean;
    touchX: number;
    touchY: number;
    reticleX: number;
    reticleY: number;
    hit: PickedBlock | null;
  } | null;
  /** How far above the finger the cursor sits, in CSS pixels. */
  cursorOffsetPx: number;
  /** What touch has begun and not confirmed (corners, an armed cell, a paste origin), else `null`. */
  pending: {
    kind: "line" | "rectangle" | "select" | "cell" | "paste";
    a?: [number, number, number];
    b?: [number, number, number] | null;
    active?: "a" | "b";
    axis?: 0 | 1 | 2;
    tool?: string;
    cell?: [number, number, number];
    at?: [number, number, number];
  } | null;
  /** The line above the toolbar while something is pending. */
  pendingReadout: string;
  /** Do Place, Replace and Erase wait for a confirm on touch? */
  confirmPlacement: boolean;
  hollow: boolean;
  /** The block string at the inspected cell, or `null`. */
  inspectedBlock: string | null;
  /** The newest undo entry while it is still the newest (the undo toast's), else `null`. */
  lastChange: { id: number; label: string; count: number; text: string } | null;
  /** The most memory the undo history may hold, bytes. */
  historyBytes: number;
  pick(x: number, y: number): PickedBlock | null;
  setTool(tool: string): void;
  setSlice(range: { y0: number; y1: number } | null): void;
  // What the desktop panels call; the MB6 suite drives the desktop path of the same edits with them.
  chooseBlock(block: string): void;
  setSelection(box: { min: [number, number, number]; max: [number, number, number] } | null): void;
  fill(): boolean;
  copy(touch?: boolean): boolean;
  rotate(rotation: "CLOCKWISE_90" | "COUNTERCLOCKWISE_90"): boolean;
  placeAt(pos: [number, number, number], block: string): boolean;
  setProperty(key: string, value: string): boolean;
  undo(): void;
  redo(): void;
}

export interface Vox {
  session(): SessionView | null;
  renderer: {
    clientFromWorld(x: number, y: number, z: number): { x: number; y: number } | null;
    capture(): { width: number; height: number; rgba: Uint8ClampedArray } | null;
    getPose(): Pose;
    getMode(): "orbit" | "fly";
    /** Drawing-buffer pixels per CSS pixel in use now, and the mesher workers running. */
    getPixelRatio(): number;
    getWorkerCount(): number;
    setPixelRatio(ratio: number): void;
    whenIdle(): Promise<void>;
    whenMeshed(): Promise<void>;
    highlight(boxes: { min: number[]; max: number[]; style?: string }[]): void;
    setSlice(range: { y0: number; y1: number } | null): void;
    setOrbit(p: {
      azimuth?: number;
      elevation?: number;
      distance?: number;
      target?: [number, number, number];
    }): void;
    runOrbitBenchmark(seconds: number): Promise<{
      frames: number;
      fps: number;
      medianMs: number;
      p95Ms: number;
      worstMs: number;
      cpuMedianMs: number;
      cpuP95Ms: number;
    }>;
    stats(): {
      sections: number;
      meshes: number;
      drawCalls: number;
      triangles: number;
      meshMs: number[];
      meshingMs: number | null;
      firstFullFrameMs: number | null;
      gpu: string;
      fallbackBlocks: string[];
    };
  };
  timings(): { parseMs: number; describeMs: number; firstFrameMs: number };
  volume(): {
    bounds(): [number[], number[]] | null;
    placedBounds(): [number[], number[]] | null;
    get(x: number, y: number, z: number): string | undefined;
    readonly blockEntityCount: number;
    readonly entities: readonly unknown[];
    blockEntityAt(
      x: number,
      y: number,
      z: number,
    ): { edition: string; nbt: { value: Map<string, unknown> } } | undefined;
    eachBlockEntity(fn: (x: number, y: number, z: number) => void): void;
  };
  edit(
    x: number,
    y: number,
    z: number,
    block: string,
  ): Promise<{ appliedMs: number; visibleMs: number }>;
}

declare global {
  interface Window {
    __voxwright?: Vox;
  }
}
