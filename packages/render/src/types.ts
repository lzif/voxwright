// SPDX-License-Identifier: AGPL-3.0-only

import type { DecodedPack } from "./mesh/pack.ts";
import type { WorkerLike } from "./mesh/scheduler.ts";

export interface WebglRendererOptions {
  /** Models and textures; `null` draws every block as the magenta fallback cube. */
  pack: DecodedPack | null;
  /**
   * Input handling mode: "builtin" attaches canvas pointer/wheel/key listeners;
   * "external" skips them so an external gesture arbiter has full ownership of input.
   * Default: "builtin".
   */
  input?: "builtin" | "external";
  /** Mesher workers (default: cores minus one, between 1 and 4). */
  workers?: number;
  /** How to start a worker; the default starts this package's own `mesh.worker.ts`. */
  createWorker?: () => WorkerLike;
  /** At most this many finished meshes are swapped in per frame, and never more than 8 ms of them (default 128). */
  maxUpdatesPerFrame?: number;
  /** Background colour as 0xRRGGBB. */
  background?: number;
  /** Multisample antialiasing. Default: on, unless WebGL is software-rendered, where it is far too slow. */
  antialias?: boolean;
}
