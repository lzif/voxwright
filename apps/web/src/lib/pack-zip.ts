// SPDX-License-Identifier: AGPL-3.0-only

// Read a resource pack (.zip) or a Minecraft client jar in the browser. Both keep their files under
// `assets/minecraft/`. Only the entries the viewer uses are inflated, so a 30 MB jar costs a few
// megabytes of memory, and fflate does the work in a worker so the page stays responsive.

import { unzip } from "fflate";
import { buildPack, type Pack, packPath, summarize } from "./pack-extract.ts";

export interface ReadPack {
  pack: Pack;
  /** Files that were JSON by name but not by content. */
  skipped: string[];
}

export class PackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackError";
  }
}

/** Extract the blockstates, models and block textures of a pack or jar. Throws a `PackError` with a plain reason. */
export async function readPackZip(bytes: Uint8Array): Promise<ReadPack> {
  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(
      bytes,
      { filter: (f) => packPath(f.name) !== null || /(^|\/)pack\.mcmeta$/.test(f.name) },
      (err, data) => (err ? reject(err) : resolve(data)),
    );
  }).catch(() => {
    throw new PackError("that is not a zip or jar file, or it is damaged");
  });
  const files = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(entries)) {
    const path = packPath(name);
    if (path !== null) files.set(path, data);
  }
  const { pack, skipped } = buildPack(files);
  const n = summarize(pack);
  if (n.blockstates + n.models + n.textures === 0)
    throw new PackError(
      "no block assets found: a resource pack or client jar keeps them under assets/minecraft/ (blockstates, models/block, textures/block)",
    );
  return { pack, skipped };
}
