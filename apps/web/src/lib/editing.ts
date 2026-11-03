// SPDX-License-Identifier: AGPL-3.0-only

// The editor's pure parts: the tool list and its shortcuts, which key presses belong to the
// page, ray helpers, and the block palette's contents and search. Nothing here touches the DOM
// beyond reading an event's target, so it runs under Vitest in Node.

import { AIR, type Box, type Vec3 } from "@voxwright/core";

export type ToolId =
  | "navigate"
  | "place"
  | "paint"
  | "erase"
  | "eyedropper"
  | "line"
  | "rectangle"
  | "select"
  | "paste";

export interface ToolInfo {
  id: ToolId;
  label: string;
  /** The key (lower case) that picks the tool, or `null` when it has none of its own. */
  key: string | null;
  /** One line for the tooltip and the help text. */
  help: string;
}

export const TOOLS: readonly ToolInfo[] = [
  {
    id: "navigate",
    label: "View",
    key: "v",
    help: "Look around only; clicks do not change anything",
  },
  {
    id: "place",
    label: "Place",
    key: "p",
    help: "Click a face to put the chosen block next to it; drag to paint along that surface",
  },
  {
    id: "paint",
    label: "Replace",
    key: "b",
    help: "Click a block to turn it into the chosen block; drag to paint along that surface",
  },
  {
    id: "erase",
    label: "Erase",
    key: "x",
    help: "Click a block to remove it; drag to clear along that surface",
  },
  {
    id: "eyedropper",
    label: "Pick",
    key: "i",
    help: "Click a block to choose its type, then switch to Place",
  },
  {
    id: "line",
    label: "Line",
    key: "l",
    help: "Drag from one face to another to draw a straight line of the chosen block",
  },
  {
    id: "rectangle",
    label: "Rectangle",
    key: "r",
    help: "Drag across a surface to draw a flat rectangle, filled or hollow",
  },
  {
    id: "select",
    label: "Select",
    key: "m",
    help: "Drag from one block to another to select the box between them",
  },
  {
    id: "paste",
    label: "Paste",
    key: null,
    help: "Click where the copied blocks should go (Ctrl+V starts it)",
  },
];

export const toolInfo = (id: ToolId): ToolInfo => TOOLS.find((t) => t.id === id) as ToolInfo;

/** The tooltip for a tool: its help line and its shortcut. */
export function toolTitle(tool: ToolInfo): string {
  return tool.key === null ? tool.help : `${tool.help} (${tool.key.toUpperCase()})`;
}

/** What a key press means to the editor, or `null` when it is not ours. */
export type KeyAction =
  | { type: "undo" }
  | { type: "redo" }
  | { type: "tool"; tool: ToolId }
  | { type: "copy" }
  | { type: "paste" }
  | { type: "fill" }
  | { type: "rotate"; direction: "cw" | "ccw" }
  | { type: "escape" };

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export const ROTATE_KEYS = { cw: "]", ccw: "[" } as const;
export const FILL_KEY = "f";

/** Map a key press to an action. Ctrl (or Cmd) plus Z, Shift+Z or Y for history, C and V for the clipboard. */
export function keyAction(e: KeyLike): KeyAction | null {
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (mod) {
    if (e.altKey) return null;
    if (k === "z") return e.shiftKey ? { type: "redo" } : { type: "undo" };
    if (k === "y" && !e.shiftKey) return { type: "redo" };
    if (k === "c" && !e.shiftKey) return { type: "copy" };
    if (k === "v" && !e.shiftKey) return { type: "paste" };
    return null;
  }
  if (e.altKey) return null;
  if (e.key === "Escape") return { type: "escape" };
  if (e.shiftKey) return null;
  if (k === FILL_KEY) return { type: "fill" };
  if (e.key === ROTATE_KEYS.cw) return { type: "rotate", direction: "cw" };
  if (e.key === ROTATE_KEYS.ccw) return { type: "rotate", direction: "ccw" };
  const tool = TOOLS.find((t) => t.key === k);
  return tool === undefined ? null : { type: "tool", tool: tool.id };
}

const TEXT_INPUT_TYPES = new Set([
  "text",
  "search",
  "number",
  "email",
  "url",
  "tel",
  "password",
  "date",
  "time",
]);

/** Is this a place where typing goes (so shortcuts must stay out of the way)? */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as {
    tagName?: string;
    type?: string;
    isContentEditable?: boolean;
  } | null;
  if (el === null || el.tagName === undefined) return false;
  if (el.isContentEditable === true) return true;
  if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  if (el.tagName === "INPUT") return TEXT_INPUT_TYPES.has((el.type ?? "text").toLowerCase());
  return false;
}

/** The part of a block string before any block-entity NBT. */
export const withoutNbt = (block: string): string => {
  const i = block.indexOf("{");
  return i === -1 ? block : block.slice(0, i);
};

/** Block ids from the blockstates of a texture pack (`blockstates/oak_stairs.json` is `minecraft:oak_stairs`). */
export function packBlockIds(json: Readonly<Record<string, unknown>>): string[] {
  const ids: string[] = [];
  for (const path of Object.keys(json)) {
    const m = /^blockstates\/(.+)\.json$/.exec(path);
    if (m) ids.push(`minecraft:${m[1]}`);
  }
  return ids.sort();
}

/** One row of the palette list. */
export interface PaletteEntry {
  block: string;
  /** "build" for blocks the open volume already uses, "pack" for ones only the texture pack knows. */
  source: "build" | "pack";
}

/** The volume's own block states (without NBT, air left out) and the pack's ids not already used by it. */
export function paletteEntries(
  volumePalette: readonly string[],
  packIds: readonly string[],
): PaletteEntry[] {
  const seen = new Set<string>();
  const out: PaletteEntry[] = [];
  const own = volumePalette
    .map(withoutNbt)
    .filter((b) => b !== AIR)
    .sort();
  for (const block of own) {
    if (seen.has(block)) continue;
    seen.add(block);
    out.push({ block, source: "build" });
  }
  const names = new Set([...seen].map((b) => b.split("[", 1)[0] as string));
  for (const id of packIds) {
    if (id === AIR || names.has(id)) continue;
    out.push({ block: id, source: "pack" });
  }
  return out;
}

/**
 * Entries whose name contains every word of the query (the namespace and punctuation do not
 * matter, so `oak stair` finds `minecraft:oak_stairs`). Names that start with the query come first.
 */
export function searchPalette(
  entries: readonly PaletteEntry[],
  query: string,
  limit = 200,
): { shown: PaletteEntry[]; total: number } {
  const words = query
    .toLowerCase()
    .replace(/^\s*minecraft:/, "")
    .split(/[\s_:]+/)
    .filter((w) => w !== "");
  if (words.length === 0) return { shown: entries.slice(0, limit), total: entries.length };
  const hits: { entry: PaletteEntry; rank: number }[] = [];
  for (const entry of entries) {
    const hay = entry.block.replace(/^minecraft:/, "").toLowerCase();
    const plain = hay.replace(/_/g, " ");
    if (!words.every((w) => hay.includes(w) || plain.includes(w))) continue;
    hits.push({ entry, rank: plain.startsWith(words.join(" ")) ? 0 : 1 });
  }
  hits.sort((a, b) => a.rank - b.rank);
  return { shown: hits.slice(0, limit).map((h) => h.entry), total: hits.length };
}

/** Does this block id or state look usable as typed? (Structure only; the core checks it again.) */
export function normalizeBlockInput(text: string): string {
  const t = text.trim();
  if (t === "") return t;
  return /^[a-z0-9_.-]+:/.test(t) || t.startsWith("[") ? t : `minecraft:${t}`;
}

export interface Ray {
  origin: Vec3;
  direction: Vec3;
}

/**
 * Move a ray's start up to the box the volume fills, grown by one cell. Returns `null` when the ray
 * misses it, and otherwise the new origin with the length the ray still has to travel inside the box.
 * A ray that starts inside is left alone.
 */
export function clipRayToBox(ray: Ray, box: Box): { origin: Vec3; length: number } | null {
  let t0 = 0;
  let t1 = Number.POSITIVE_INFINITY;
  for (let a = 0; a < 3; a++) {
    const o = ray.origin[a] as number;
    const d = ray.direction[a] as number;
    const lo = (box.min[a] as number) - 1;
    const hi = (box.max[a] as number) + 2;
    if (d === 0) {
      if (o < lo || o > hi) return null;
      continue;
    }
    let ta = (lo - o) / d;
    let tb = (hi - o) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return {
    origin: [
      ray.origin[0] + ray.direction[0] * t0,
      ray.origin[1] + ray.direction[1] * t0,
      ray.origin[2] + ray.direction[2] * t0,
    ],
    length: t1 - t0,
  };
}

/**
 * The cell where a ray crosses a plane of constant `axis` coordinate, `layer + at` (default the
 * middle of the layer of cells numbered `layer`; use 0 or 1 for the face a block was clicked on).
 * The cell's other coordinates are the ones the crossing point falls in and its own `axis`
 * coordinate is `layer`. `null` when the ray runs parallel to the plane, points away or lands
 * absurdly far off.
 */
export function cellOnPlane(
  ray: Ray,
  axis: 0 | 1 | 2,
  layer: number,
  at = 0.5,
  reach = 4096,
): Vec3 | null {
  const d = ray.direction[axis] as number;
  if (Math.abs(d) < 1e-6) return null;
  const t = (layer + at - (ray.origin[axis] as number)) / d;
  if (!(t > 0) || t > reach) return null;
  const cell = [0, 1, 2].map((i) =>
    Math.floor((ray.origin[i] as number) + (ray.direction[i] as number) * t),
  );
  cell[axis] = layer;
  return cell as unknown as Vec3;
}

/** Which axis a face normal points along (`null` for the zero normal of a ray that began inside a block). */
export function normalAxis(normal: Vec3): 0 | 1 | 2 | null {
  for (const a of [0, 1, 2] as const) if (normal[a] !== 0) return a;
  return null;
}

/** May the editor touch this cell, given the layers the view is limited to (`null`: all of them)? */
export const inSlice = (slice: { y0: number; y1: number } | null, y: number): boolean =>
  slice === null || (y >= slice.y0 && y <= slice.y1);

/** Corners as a box, in any order. */
export const boxBetween = (a: Vec3, b: Vec3): Box => ({
  min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
  max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
});

/** `box` moved by `delta`. */
export const shiftBox = (box: Box, delta: Vec3): Box => ({
  min: [box.min[0] + delta[0], box.min[1] + delta[1], box.min[2] + delta[2]],
  max: [box.max[0] + delta[0], box.max[1] + delta[1], box.max[2] + delta[2]],
});
