// SPDX-License-Identifier: AGPL-3.0-only

// What the session tells the page about the edit it just made: the words and the block count of
// the undo toast, and the small events behind the vibration. Pure, so it runs under Vitest.

/** How long the undo toast stays after an edit, ms. */
export const TOAST_MS = 4000;

/** The newest entry in the undo history, as the toast describes it. */
export interface LastChange {
  /** Grows with every entry: the toast's Undo acts only while this is still the latest. */
  readonly id: number;
  /** The core command's label (`place`, `fill`, `set facing=north`, ...). */
  readonly label: string;
  /** Blocks the command changed (at least 1). */
  readonly count: number;
  /** What the toast says: `Placed 12 blocks`. */
  readonly text: string;
}

/** What the session reports through `onEvent`. */
export type SessionEvent =
  /** An edit was added to the undo history. */
  | { readonly kind: "commit"; readonly change: LastChange }
  /** Something was taken back or dropped: a stroke or corner drag reverted, a pending action cancelled. */
  | { readonly kind: "cancel" }
  /** A step or a confirm was refused and nothing changed. */
  | { readonly kind: "refuse" }
  /** An entry was undone or redone. */
  | { readonly kind: "undo" }
  | { readonly kind: "redo" };

const blocksText = (n: number): string => `${n} block${n === 1 ? "" : "s"}`;

/** The past-tense verb for a core command label, and whether a count follows it (`Drew 5 blocks`). */
const VERBS: Record<string, string> = {
  place: "Placed",
  "replace block": "Replaced",
  erase: "Erased",
  line: "Drew a line of",
  rectangle: "Drew a rectangle of",
  "hollow rectangle": "Drew a hollow rectangle of",
  box: "Filled",
  "hollow box": "Filled",
  fill: "Filled",
  replace: "Replaced",
  paste: "Pasted",
  move: "Moved",
};

/**
 * The toast's sentence for a command: `Placed 12 blocks`, `Erased 1 block`, `Filled 27 blocks`,
 * `Rotated 27 blocks`, `Set facing=north on 1 block`. An unknown label reads `Changed 3 blocks`.
 */
export function describeChange(label: string, count: number): string {
  const n = blocksText(Math.max(0, Math.round(count)));
  const verb = VERBS[label];
  if (verb !== undefined) return `${verb} ${n}`;
  if (label.startsWith("rotate ")) return `Rotated ${n}`;
  if (label.startsWith("mirror ")) return `Mirrored ${n}`;
  if (label.startsWith("set ")) return `Set ${label.slice(4)} on ${n}`;
  return `Changed ${n}`;
}

/** A new `LastChange` for the entry the session just added. */
export function makeChange(id: number, label: string, count: number): LastChange {
  const blocks = Math.max(1, Math.round(count));
  return { id, label, count: blocks, text: describeChange(label, blocks) };
}
