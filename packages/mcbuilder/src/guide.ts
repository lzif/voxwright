// SPDX-License-Identifier: AGPL-3.0-only

// Layer-by-layer build guide: what to place, layer by layer, for building by hand.
//
// `buildGuide` turns a dense volume into one top-down plan per Y layer (bottom
// first) and a `guide.md`. Blocks of the current layer are drawn with their top
// texture, the layer below is shown faded so things line up, and markers show
// orientation: an arrow for `facing`, a bar for `axis=x/z`, a `T` for top-half
// stairs, slabs and trapdoors.
//
// Coordinates are relative to the structure's north-west bottom corner, the
// same origin a structure block or Litematica placement uses: x grows east
// (right), z grows south (down), layer 1 is the bottom.

import type { DenseVolume } from "@voxwright/core";
import {
  type AssetSource,
  blendToward,
  buildFaceTextures,
  type Canvas,
  createCanvas,
  drawEllipse,
  drawLine,
  drawPolygon,
  drawRect,
  drawText,
  pasteRgb,
  type RasterImage,
  type Rgb3,
  resizeNearest,
  splitBlockstate,
} from "@voxwright/render";

const AIR = "minecraft:air";
const BG: Rgb3 = [246, 243, 236];
const GRID: Rgb3 = [200, 194, 182];
const GRID_MAJOR: Rgb3 = [150, 144, 132];
const INK: Rgb3 = [40, 38, 34];
const MAX_GRID_PX = 1400;
const LEGEND_W = 330;

/** Second halves of two-cell blocks are not a separate item. */
const SECOND_HALF: readonly [string, string][] = [
  ["half", "upper"],
  ["part", "head"],
];

/** `[item, count]` needed for one cell, or `null` (air, second halves). */
function itemOf(block: string): [string, number] | null {
  const [name, props] = splitBlockstate(block);
  if (name === AIR) return null;
  if (SECOND_HALF.some(([k, v]) => props[k] === v)) return null;
  if (props.type === "double" && name.endsWith("_slab")) return [name, 2];
  return [name, 1];
}

/** Items needed to place `blocks`, in first-seen order. */
export function itemCounts(blocks: Iterable<string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const b of blocks) {
    const item = itemOf(b);
    if (item) out.set(item[0], (out.get(item[0]) ?? 0) + item[1]);
  }
  return out;
}

/** Python's `Counter.most_common()`: by count descending, ties in first-seen order. */
export function mostCommon(counts: ReadonlyMap<string, number>): [string, number][] {
  return [...counts].sort((a, b) => b[1] - a[1]);
}

/** `130` is `2×64 + 2`. */
export function stacks(n: number): string {
  const s = Math.floor(n / 64);
  const r = n % 64;
  if (!s) return String(n);
  return `${s}×64${r ? ` + ${r}` : ""}`;
}

export const shortName = (name: string): string =>
  name.startsWith("minecraft:") ? name.slice("minecraft:".length) : name;

/** Python's `str.title()` for the characters that occur in file stems. */
export const titleCase = (s: string): string =>
  s.replace(/[A-Za-z]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const ARROW: Record<string, readonly [number, number]> = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0],
};

/** Orientation marker for one cell (image coords, cell size `c`). */
function marker(
  canvas: Canvas,
  x0: number,
  y0: number,
  c: number,
  props: Record<string, string>,
): void {
  const [cx, cy] = [x0 + c / 2, y0 + c / 2];
  const facing = props.facing;
  if (facing !== undefined && Object.hasOwn(ARROW, facing)) {
    const [dx, dy] = ARROW[facing] as readonly [number, number];
    const tip: [number, number] = [cx + dx * c * 0.36, cy + dy * c * 0.36];
    const back: [number, number] = [cx - dx * c * 0.18, cy - dy * c * 0.18];
    const [px, py] = [-dy * c * 0.2, dx * c * 0.2];
    drawPolygon(
      canvas,
      [tip, [back[0] + px, back[1] + py], [back[0] - px, back[1] - py]],
      [255, 255, 255],
      [0, 0, 0],
    );
  } else if (facing === "up" || facing === "down") {
    const r = c * 0.14;
    drawEllipse(
      canvas,
      cx - r,
      cy - r,
      cx + r,
      cy + r,
      facing === "up" ? [255, 255, 255] : [0, 0, 0],
      facing === "up" ? [0, 0, 0] : [255, 255, 255],
    );
  }
  const axis = props.axis;
  if (axis === "x" || axis === "z") {
    const w = c * 0.36;
    if (axis === "x")
      drawRect(canvas, cx - w, cy - 1.5, cx + w, cy + 1.5, [255, 255, 255], [0, 0, 0]);
    else drawRect(canvas, cx - 1.5, cy - w, cx + 1.5, cy + w, [255, 255, 255], [0, 0, 0]);
  }
  if (props.half === "top" || props.type === "top") {
    drawText(canvas, x0 + 2, y0 + 1, "T", {
      size: Math.max(8, Math.trunc(c * 0.38)),
      color: [255, 255, 255],
      stroke: 2,
      strokeColor: [0, 0, 0],
    });
  }
}

/** Top-face texture for each non-air palette entry, as an RGB image. */
function topTextures(
  palette: readonly string[],
  assets: AssetSource | null,
): Map<number, RasterImage> {
  const out = new Map<number, RasterImage>();
  palette.forEach((block, idx) => {
    if (block !== AIR) out.set(idx, buildFaceTextures(block, assets, new Set()).up);
  });
  return out;
}

export interface GuideLayer {
  /** `layer-01.png`. */
  name: string;
  image: Canvas;
  /** Items in this layer, most used first. */
  counts: [string, number][];
}

export interface Guide {
  markdown: string;
  layers: GuideLayer[];
}

function layerImage(
  dense: DenseVolume,
  y: number,
  textures: Map<number, RasterImage>,
  title: string,
): { image: Canvas; counts: Map<string, number> } {
  const [sx, sy, sz] = dense.size;
  const cell = (x: number, yy: number, z: number): number =>
    dense.data[(x * sy + yy) * sz + z] as number;
  const c = Math.max(10, Math.min(28, Math.floor(MAX_GRID_PX / Math.max(sx, sz))));
  const [top, left] = [96, 44];
  const [gw, gh] = [sx * c, sz * c];
  const layerBlocks: string[] = [];
  for (let x = 0; x < sx; x++)
    for (let z = 0; z < sz; z++) {
      const i = cell(x, y, z);
      if (i >= 0) layerBlocks.push(dense.palette[i] as string);
    }
  const counts = itemCounts(layerBlocks);
  const width = Math.max(left + gw + 20 + LEGEND_W, 720);
  let height = Math.max(top + gh + 30, top + 40);
  height = Math.max(height, top + 30 + counts.size * 24 + 20);
  const img = createCanvas(width, height, BG);

  drawText(img, left, 16, title, { size: 22, color: INK });
  drawText(
    img,
    left,
    46,
    "north is up  |  x: east (right)  |  z: south (down)  |  arrow: facing  |  T: top half  |  faded: layer below",
    {
      size: 13,
      color: [110, 104, 96],
    },
  );

  const tiles = new Map<number, RasterImage>();
  for (const [i, t] of textures) tiles.set(i, resizeNearest(t, c, c));
  const ghosts = new Map<number, RasterImage>();
  for (const [i, t] of tiles) ghosts.set(i, blendToward(t, BG, 0.75));

  for (let x = 0; x < sx; x++) {
    for (let z = 0; z < sz; z++) {
      const [px, pz] = [left + x * c, top + z * c];
      const idx = cell(x, y, z);
      if (idx >= 0 && dense.palette[idx] !== AIR) {
        pasteRgb(img, tiles.get(idx) as RasterImage, px, pz);
      } else if (y > 0) {
        const b = cell(x, y - 1, z);
        if (b >= 0 && dense.palette[b] !== AIR) pasteRgb(img, ghosts.get(b) as RasterImage, px, pz);
      }
    }
  }
  for (let x = 0; x < sx; x++) {
    for (let z = 0; z < sz; z++) {
      const idx = cell(x, y, z);
      if (idx >= 0 && dense.palette[idx] !== AIR)
        marker(img, left + x * c, top + z * c, c, splitBlockstate(dense.palette[idx] as string)[1]);
    }
  }
  for (let i = 0; i <= sx; i++)
    drawLine(img, left + i * c, top, left + i * c, top + gh, i % 5 === 0 ? GRID_MAJOR : GRID);
  for (let k = 0; k <= sz; k++)
    drawLine(img, left, top + k * c, left + gw, top + k * c, k % 5 === 0 ? GRID_MAJOR : GRID);
  for (let i = 0; i < sx; i += 5)
    drawText(img, left + i * c + 2, top - 14, String(i), { size: 11, color: INK });
  for (let k = 0; k < sz; k += 5)
    drawText(img, 6, top + k * c + 2, String(k), { size: 11, color: INK });

  const lx = left + gw + 20;
  let ly = top;
  drawText(img, lx, ly - 24, "this layer", { size: 14, color: INK });
  const nameToIdx = new Map<string, number>();
  dense.palette.forEach((b, idx) => {
    const n = splitBlockstate(b)[0];
    if (!nameToIdx.has(n)) nameToIdx.set(n, idx);
  });
  for (const [name, n] of mostCommon(counts)) {
    const idx = nameToIdx.get(name);
    const tile = idx === undefined ? undefined : tiles.get(idx);
    if (tile) pasteRgb(img, resizeNearest(tile, 18, 18), lx, ly);
    drawText(img, lx + 26, ly + 2, `${String(n).padStart(4)}  ${shortName(name)}`, {
      size: 13,
      color: INK,
    });
    ly += 24;
  }
  return { image: img, counts };
}

/**
 * Build the layer images and `guide.md` text. `cover` is an optional image
 * path (relative to the guide folder) shown at the top, e.g. an iso preview.
 */
export function buildGuide(
  dense: DenseVolume,
  assets: AssetSource | null,
  options: { title?: string; cover?: string | null } = {},
): Guide {
  const title = options.title ?? "Build guide";
  const [sx, sy, sz] = dense.size;
  const textures = topTextures(dense.palette, assets);
  const filled = (y: number): boolean => {
    for (let x = 0; x < sx; x++) {
      for (let z = 0; z < sz; z++) {
        const i = dense.data[(x * sy + y) * sz + z] as number;
        if (i >= 0 && dense.palette[i] !== AIR) return true;
      }
    }
    return false;
  };
  const layers: number[] = [];
  for (let y = 0; y < sy; y++) if (filled(y)) layers.push(y);

  const everything: string[] = [];
  for (const i of dense.data) if (i >= 0) everything.push(dense.palette[i] as string);
  const total = itemCounts(everything);
  const sum = [...total.values()].reduce((a, b) => a + b, 0);

  const md = [`# ${title}`, ""];
  if (options.cover) md.push(`![${title}](${options.cover})`, "");
  md.push(
    `Size: **${sx} × ${sy} × ${sz}** (x × y × z), ${layers.length} layers, ${sum} items.`,
    "",
    "Coordinates count from the north-west bottom corner: x to the east, z to the south, layer 1 at the bottom. In each plan the faded blocks are the layer below.",
    "",
    "## Materials",
    "",
    "| Item | Count | Stacks |",
    "|---|---:|---:|",
  );
  for (const [n, k] of mostCommon(total)) md.push(`| ${shortName(n)} | ${k} | ${stacks(k)} |`);
  md.push("");

  const out: GuideLayer[] = [];
  layers.forEach((y, i) => {
    const step = i + 1;
    const name = `layer-${String(step).padStart(2, "0")}.png`;
    const { image, counts } = layerImage(
      dense,
      y,
      textures,
      `Layer ${step} of ${layers.length}   (y = ${y})`,
    );
    const common = mostCommon(counts);
    out.push({ name, image, counts: common });
    md.push(
      `## Layer ${step} (y = ${y})`,
      "",
      `![Layer ${step}](${name})`,
      "",
      common.map(([n, k]) => `${k} ${shortName(n)}`).join(", "),
      "",
    );
  });
  return { markdown: md.join("\n"), layers: out };
}
