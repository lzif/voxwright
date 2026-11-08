// SPDX-License-Identifier: AGPL-3.0-only

// The hotbar of the mobile editor: the last blocks the user chose (recents) and the ones they
// starred (favourites), kept as plain lists and saved in the browser. No DOM and no session, so all
// of it runs under Vitest; the storage is passed in, because a browser may have none, or may refuse
// it (a private window, blocked site data), and the editor must work without it.

import { AIR } from "@voxwright/core";
import { withoutNbt } from "./editing.ts";

/** Where the recent blocks are kept in the browser. */
export const RECENT_KEY = "voxwright.recentblocks";
/** Where the favourite blocks are kept in the browser. */
export const FAVORITE_KEY = "voxwright.favoriteblocks";

/** The hotbar remembers the last 8 distinct blocks that were chosen. */
export const RECENT_LIMIT = 8;
/** At most this many blocks can be starred. */
export const FAVORITE_LIMIT = 32;

/** One block with its properties is far shorter than this; a longer entry is not a block. */
const MAX_BLOCK_CHARS = 256;
/** 32 entries of the longest length, with the JSON around them: a stored value past this is not ours. */
const MAX_STORED_CHARS = FAVORITE_LIMIT * (MAX_BLOCK_CHARS + 4) + 16;

/** The minimal storage the hotbar needs (`localStorage` fits). */
export interface BlockStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * The block as the hotbar records it: the name and properties the session stores, without
 * block-entity NBT. `null` for anything that is not worth a chip: nothing, air, or a string that
 * cannot be a block (whitespace or control characters, or longer than a block can be).
 */
export function recordable(block: string): string | null {
  const name = withoutNbt(block).trim();
  if (name === "" || name.length > MAX_BLOCK_CHARS) return null;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are exactly what is refused
  if (/[\s\u0000-\u001f\u007f]/.test(name)) return null;
  if (name === AIR || name.split("[", 1)[0] === AIR) return null;
  return name;
}

/** `block` moved to the front of the recents; the list keeps the newest `RECENT_LIMIT` distinct blocks. */
export function pushRecent(recents: readonly string[], block: string): string[] {
  const name = recordable(block);
  if (name === null) return [...recents];
  return [name, ...recents.filter((b) => b !== name)].slice(0, RECENT_LIMIT);
}

/** Is the block starred? */
export const isFavorite = (favorites: readonly string[], block: string): boolean => {
  const name = recordable(block);
  return name !== null && favorites.includes(name);
};

/**
 * The favourites with the block starred or, when it already is, unstarred. A new star goes to the
 * end of the list (the order the user starred them in); a full list refuses it and stays as it is.
 */
export function toggleFavorite(favorites: readonly string[], block: string): string[] {
  const name = recordable(block);
  if (name === null) return [...favorites];
  if (favorites.includes(name)) return favorites.filter((b) => b !== name);
  if (favorites.length >= FAVORITE_LIMIT) return [...favorites];
  return [...favorites, name];
}

/** Would a new star be refused because the list is full? */
export const favoritesFull = (favorites: readonly string[]): boolean =>
  favorites.length >= FAVORITE_LIMIT;

/**
 * What the hotbar row shows: the favourites, then the recents that are not favourites (a starred
 * block is not shown twice).
 */
export function hotbarBlocks(
  favorites: readonly string[],
  recents: readonly string[],
): { block: string; favorite: boolean }[] {
  const starred = new Set(favorites);
  return [
    ...favorites.map((block) => ({ block, favorite: true })),
    ...recents.filter((b) => !starred.has(b)).map((block) => ({ block, favorite: false })),
  ];
}

/** The chip's text: the block without `minecraft:`; the full name stays in the accessible name and the title. */
export const shortName = (block: string): string => block.replace(/^minecraft:/, "");

/**
 * A list read back from the browser. Anything that is not a JSON array of block names (a missing
 * value, a damaged one, one that is too big to be ours) reads as empty; single bad entries are
 * dropped, repeats are kept once, and the list is cut to `limit`.
 */
export function parseBlockList(text: string | null | undefined, limit: number): string[] {
  if (typeof text !== "string" || text.length > MAX_STORED_CHARS) return [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: string[] = [];
  for (const item of data) {
    if (typeof item !== "string") continue;
    const name = recordable(item);
    // A stored entry is already canonical: one that still has NBT or stray spaces is not ours.
    if (name === null || name !== item || out.includes(name)) continue;
    out.push(name);
    if (out.length >= limit) break;
  }
  return out;
}

/** The text a list is stored as. */
export const serializeBlockList = (list: readonly string[]): string => JSON.stringify(list);

/** Read a list from storage. A storage that is missing or throws reads as an empty list. */
export function loadBlockList(store: BlockStore | null, key: string, limit: number): string[] {
  try {
    return parseBlockList(store?.getItem(key), limit);
  } catch {
    return [];
  }
}

/** Write a list to storage; a storage that is missing, full or refuses is ignored (returns false). */
export function saveBlockList(
  store: BlockStore | null,
  key: string,
  list: readonly string[],
): boolean {
  try {
    if (store === null) return false;
    store.setItem(key, serializeBlockList(list));
    return true;
  } catch {
    return false;
  }
}
