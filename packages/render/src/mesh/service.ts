// SPDX-License-Identifier: AGPL-3.0-only

// The message protocol between a renderer and its mesher workers, and the
// handler that sits behind it. The handler is plain code with no worker API in
// it, so it is tested in Node; the worker file is only a few lines of glue.
//
// A worker is told once about the assets and the atlas (`init`), is kept up to
// date on the palette as it grows (`palette`), and is then sent padded blocks
// of cells to mesh (`mesh`). Messages are handled in order, so a palette
// message always lands before the mesh jobs that use its entries.

import type { AtlasLayout } from "./atlas.ts";
import { type DecodedPack, sourceFromDecoded } from "./pack.ts";
import { type MeshBuffers, parseSectionKey, type SectionMesh, SectionMesher } from "./section.ts";

export type MeshRequest =
  | {
      type: "init";
      /** `null` meshes every block as the fallback cube. */
      pack: DecodedPack | null;
      atlas: AtlasLayout;
    }
  | {
      type: "palette";
      /** Drop the old palette first (a different volume). */
      reset: boolean;
      /** Entries to append, continuing where the last message stopped. */
      entries: string[];
    }
  | {
      type: "mesh";
      job: number;
      key: string;
      /** The padded block (18^3 palette indices, -1 unset). Transfer it. */
      cells: Int32Array;
      /** Inclusive world row range to keep, or `null` for the whole section. */
      slice: { y0: number; y1: number } | null;
    };

export type MeshReply =
  | { type: "ready" }
  | {
      type: "meshed";
      job: number;
      key: string;
      mesh: SectionMesh;
      /** Milliseconds spent meshing, inside the worker. */
      ms: number;
      /** Block names that were drawn as the magenta fallback cube so far. */
      fallback: string[];
    }
  | { type: "failed"; job: number; key: string; message: string };

export class MeshService {
  private mesher: SectionMesher | null = null;

  /** Handle one message; the reply, if any, is what to post back. */
  handle(msg: MeshRequest, now: () => number = () => performance.now()): MeshReply | null {
    switch (msg.type) {
      case "init":
        this.mesher = new SectionMesher({
          assets: msg.pack === null ? null : sourceFromDecoded(msg.pack),
          atlas: msg.atlas,
        });
        return { type: "ready" };
      case "palette":
        if (this.mesher === null) return null;
        if (msg.reset) this.mesher.resetPalette();
        this.mesher.extendPalette(msg.entries);
        return null;
      case "mesh": {
        if (this.mesher === null)
          return { type: "failed", job: msg.job, key: msg.key, message: "mesher not initialised" };
        try {
          const t = now();
          const [, sy] = parseSectionKey(msg.key);
          const mesh = this.mesher.mesh(
            msg.cells,
            msg.slice === null ? null : { ...msg.slice, originY: sy * 16 },
          );
          return {
            type: "meshed",
            job: msg.job,
            key: msg.key,
            mesh,
            ms: now() - t,
            fallback: [...this.mesher.fallbackBlocks],
          };
        } catch (err) {
          return {
            type: "failed",
            job: msg.job,
            key: msg.key,
            message: err instanceof Error ? err.message : String(err),
          };
        }
      }
    }
  }
}

/** The buffers of a mesh, to hand to `postMessage` as its transfer list. */
export function meshTransferList(mesh: SectionMesh): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];
  for (const b of [mesh.opaque, mesh.cutout, mesh.translucent] as (MeshBuffers | null)[]) {
    if (b === null) continue;
    out.push(b.positions.buffer as ArrayBuffer, b.uvs.buffer as ArrayBuffer);
    out.push(b.colors.buffer as ArrayBuffer, b.indices.buffer as ArrayBuffer);
  }
  return out;
}
