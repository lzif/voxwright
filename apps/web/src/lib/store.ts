// SPDX-License-Identifier: AGPL-3.0-only

// A tiny key-value layer over IndexedDB. Two stores: `autosave` (the one snapshot of the volume being
// edited) and `pack` (the resource pack the user brought). Values are stored with the structured
// clone algorithm, so typed arrays, Maps and bigints go in as they are.

const DB_NAME = "voxwright";
const DB_VERSION = 1;
export type StoreName = "autosave" | "pack";
const STORES: readonly StoreName[] = ["autosave", "pack"];

/** Storage failed in a way worth telling the user about. `quota` is the disk-full case. */
export class StorageError extends Error {
  readonly quota: boolean;
  constructor(message: string, quota: boolean) {
    super(message);
    this.name = "StorageError";
    this.quota = quota;
  }
}

let opened: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined")
    return Promise.reject(new StorageError("this browser has no IndexedDB", false));
  opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(toError(err));
      return;
    }
    req.onupgradeneeded = () => {
      for (const name of STORES)
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(toError(req.error));
    req.onblocked = () => reject(new StorageError("the database is locked by another tab", false));
  });
  // A failed open may succeed later (private mode ends, a blocking tab closes): do not cache it.
  opened.catch(() => {
    opened = null;
  });
  return opened;
}

function toError(err: unknown): StorageError {
  const name = err instanceof DOMException || err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : String(err);
  if (name === "QuotaExceededError") return new StorageError("the browser's storage is full", true);
  return new StorageError(message || "storage failed", false);
}

async function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  work: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    try {
      const tx = db.transaction(store, mode);
      const req = work(tx.objectStore(store));
      let value: T;
      req.onsuccess = () => {
        value = req.result;
      };
      // Resolve when the transaction has committed, not when the request finished: a quota error
      // can still abort the transaction after the request succeeded.
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(toError(tx.error ?? req.error));
      tx.onerror = () => reject(toError(tx.error ?? req.error));
    } catch (err) {
      reject(toError(err));
    }
  });
}

export const getRecord = <T>(store: StoreName, key: string): Promise<T | undefined> =>
  run<T | undefined>(store, "readonly", (s) => s.get(key));

export const putRecord = (store: StoreName, key: string, value: unknown): Promise<unknown> =>
  run(store, "readwrite", (s) => s.put(value, key));

export const deleteRecord = (store: StoreName, key: string): Promise<unknown> =>
  run(store, "readwrite", (s) => s.delete(key));
