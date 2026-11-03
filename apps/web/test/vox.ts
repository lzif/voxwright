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
  pick(x: number, y: number): PickedBlock | null;
}

export interface Vox {
  session(): SessionView | null;
  renderer: {
    clientFromWorld(x: number, y: number, z: number): { x: number; y: number } | null;
    capture(): { width: number; height: number; rgba: Uint8ClampedArray } | null;
    getPose(): Pose;
    getMode(): "orbit" | "fly";
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
