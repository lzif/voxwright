// SPDX-License-Identifier: AGPL-3.0-only

// The resource pack the user brought, kept in IndexedDB so it is used on later visits. Only the
// extracted blockstates, models and block textures are stored, not the zip they came from.

import type { Pack } from "./pack-extract.ts";
import { summarize } from "./pack-extract.ts";
import { readPackZip } from "./pack-zip.ts";
import { deleteRecord, getRecord, putRecord } from "./store.ts";

const KEY = "user";

export interface StoredPack {
  /** The file's name, shown to the user. */
  name: string;
  /** Size of the file that was chosen, in bytes. */
  fileSize: number;
  addedAt: number;
  counts: { blockstates: number; models: number; textures: number };
  pack: Pack;
}

function isStoredPack(v: unknown): v is StoredPack {
  const s = v as Partial<StoredPack> | null | undefined;
  return (
    typeof s === "object" &&
    s !== null &&
    typeof s.name === "string" &&
    typeof s.pack === "object" &&
    s.pack !== null &&
    typeof s.pack.json === "object" &&
    typeof s.pack.textures === "object" &&
    Array.isArray(s.pack.animated)
  );
}

/** The stored pack, or `null` (none stored, or storage is unavailable). */
export async function loadUserPack(): Promise<StoredPack | null> {
  try {
    const v = await getRecord<unknown>("pack", KEY);
    return isStoredPack(v) ? v : null;
  } catch {
    return null;
  }
}

/** Read a pack or jar the user chose. Throws `PackError` with a reason fit to show. */
export async function readUserPack(file: File): Promise<{ stored: StoredPack; skipped: string[] }> {
  const { pack, skipped } = await readPackZip(new Uint8Array(await file.arrayBuffer()));
  return {
    stored: {
      name: file.name,
      fileSize: file.size,
      addedAt: Date.now(),
      counts: summarize(pack),
      pack,
    },
    skipped,
  };
}

/** Keep the pack for later visits. Throws a `StorageError` if the browser refuses. */
export const saveUserPack = (stored: StoredPack): Promise<unknown> =>
  putRecord("pack", KEY, stored);

export const removeUserPack = (): Promise<unknown> => deleteRecord("pack", KEY).catch(() => {});
