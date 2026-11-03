// SPDX-License-Identifier: AGPL-3.0-only

// Autosave: keep the open build in the browser's IndexedDB so a closed tab or a
// crash loses nothing. The data never leaves the machine.

import { Volume } from "@voxwright/core";

const DB = "voxwright";
const STORE = "session";
const KEY = "current";

export interface Session {
  name: string;
  dataVersion: number | null;
  volume: Volume;
}

interface Stored {
  name: string;
  dataVersion: number | null;
  palette: string[];
  /** Flat `[x, y, z, paletteIndex, ...]`. */
  cells: number[];
  savedAt: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSession(s: Session): Promise<void> {
  const cells: number[] = [];
  s.volume.eachCell((x, y, z, idx) => {
    cells.push(x, y, z, idx);
  });
  const stored: Stored = {
    name: s.name,
    dataVersion: s.dataVersion,
    palette: [...s.volume.palette],
    cells,
    savedAt: Date.now(),
  };
  const db = await open();
  try {
    await run(db, "readwrite", (st) => st.put(stored, KEY));
  } finally {
    db.close();
  }
}

export async function loadSession(): Promise<Session | null> {
  const db = await open();
  try {
    const s = (await run(db, "readonly", (st) => st.get(KEY))) as Stored | undefined;
    if (!s) return null;
    const v = new Volume();
    for (let i = 0; i < s.cells.length; i += 4)
      v.set(
        s.cells[i] as number,
        s.cells[i + 1] as number,
        s.cells[i + 2] as number,
        s.palette[s.cells[i + 3] as number] as string,
      );
    return { name: s.name, dataVersion: s.dataVersion, volume: v };
  } finally {
    db.close();
  }
}

export async function clearSession(): Promise<void> {
  const db = await open();
  try {
    await run(db, "readwrite", (st) => st.delete(KEY));
  } finally {
    db.close();
  }
}
