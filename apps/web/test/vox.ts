// SPDX-License-Identifier: AGPL-3.0-only

// The page's test hook (`window.__voxwright`, set by the GPU renderer path) as the
// browser tests see it.

export interface Pose {
  position: [number, number, number];
  azimuth: number;
  elevation: number;
  mode: "orbit" | "fly";
}

export interface Vox {
  renderer: {
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
