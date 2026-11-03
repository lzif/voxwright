// SPDX-License-Identifier: AGPL-3.0-only

// Draw a scene to pixels: orthographic camera, painter's algorithm, textured
// quads warped by an affine map, ambient-occlusion brightness, a soft contact
// shadow, supersampling and a Lanczos downscale. The look follows the Python
// "faithful" tier's presentation mode (light background, no debug chrome); the
// title, view label and compass, which need fonts, are not drawn.

import type { DenseVolume } from "@voxwright/core";
import type { AssetSource } from "./assets.ts";
import type { Rgb3 } from "./draw.ts";
import { drawLineAlpha, drawRingAlpha, fillRectAlpha } from "./draw.ts";
import { drawText, textMask, textWidth } from "./font.ts";
import type { Canvas, RasterImage } from "./image.ts";
import { type Quad, snapNormal, splitBlockstate, type Vec3 } from "./models.ts";
import { pyRound } from "./pymath.ts";
import {
  cellQuads,
  prepareScene,
  quadAoLevels,
  quadCulledByNeighbour,
  type Scene,
} from "./scene.ts";
import type { View } from "./views.ts";

const BG_PRESENTATION: readonly [number, number, number] = [244, 241, 235];
/** Output longest side in pixels for presentation renders. */
export const PRESENTATION_LONGEST_PX = 2048;
/** Supersample factor: rendered at this multiple, then downscaled. */
export const SUPERSAMPLE = 2;
/** Framing margin for presentation. */
export const PRESENTATION_MARGIN = 0.35;
/** Per-AO-level brightness for levels 0 to 3 (a vanilla-derived approximation). */
const AO_BRIGHTNESS = [0.4, 0.6, 0.8, 1.0] as const;

// -- camera ---------------------------------------------------------------------------------

/** View direction, screen-right and screen-up (all unit vectors). */
export function camera(view: View): { d: Vec3; r: Vec3; u: Vec3 } {
  const th = (view.azimuth * Math.PI) / 180;
  const ph = (view.elevation * Math.PI) / 180;
  const d: Vec3 = [-Math.sin(th) * Math.cos(ph), -Math.sin(ph), Math.cos(th) * Math.cos(ph)];
  let r: Vec3;
  if (Math.abs(d[1]) > 0.999) {
    r = [1, 0, 0]; // looking straight up or down: screen-right = +X, screen-up = north
  } else {
    // r = d x (0, 1, 0), normalised
    const c: Vec3 = [d[1] * 0 - d[2] * 1, d[2] * 0 - d[0] * 0, d[0] * 1 - d[1] * 0];
    const n = Math.hypot(c[0], c[1], c[2]);
    r = [c[0] / n, c[1] / n, c[2] / n];
  }
  const u: Vec3 = [r[1] * d[2] - r[2] * d[1], r[2] * d[0] - r[0] * d[2], r[0] * d[1] - r[1] * d[0]];
  return { d, r, u };
}

const dot = (a: readonly number[], b: readonly number[]): number =>
  (a[0] as number) * (b[0] as number) +
  (a[1] as number) * (b[1] as number) +
  (a[2] as number) * (b[2] as number);
export const project = (p: readonly number[], r: Vec3, u: Vec3): [number, number] => [
  dot(p, r),
  dot(p, u),
];

// -- small linear algebra -----------------------------------------------------------------

/** Least squares `A x = b` for 4 rows of `[c1, c2, 1]`, via the normal equations. */
function lstsq3(
  rows: readonly (readonly [number, number])[],
  b: readonly number[],
): [number, number, number] | null {
  const ata = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const atb = [0, 0, 0];
  rows.forEach(([c1, c2], i) => {
    const a = [c1, c2, 1];
    for (let j = 0; j < 3; j++) {
      (atb[j] as number) += (a[j] as number) * (b[i] as number);
      for (let k = 0; k < 3; k++)
        ((ata[j] as number[])[k] as number) += (a[j] as number) * (a[k] as number);
    }
  });
  // Gaussian elimination with partial pivoting.
  const m = ata.map((row, i) => [...row, atb[i] as number]);
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++)
      if (
        Math.abs((m[r] as number[])[col] as number) > Math.abs((m[piv] as number[])[col] as number)
      )
        piv = r;
    if (Math.abs((m[piv] as number[])[col] as number) < 1e-12) return null;
    [m[col], m[piv]] = [m[piv] as number[], m[col] as number[]];
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = ((m[r] as number[])[col] as number) / ((m[col] as number[])[col] as number);
      for (let k = col; k < 4; k++)
        (m[r] as number[])[k] =
          ((m[r] as number[])[k] as number) - f * ((m[col] as number[])[k] as number);
    }
  }
  return [0, 1, 2].map(
    (i) => ((m[i] as number[])[3] as number) / ((m[i] as number[])[i] as number),
  ) as [number, number, number];
}

// -- canvas -----------------------------------------------------------------------------------

function newCanvas(width: number, height: number, rgb: readonly [number, number, number]): Canvas {
  const data = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) data.set(rgb, i * 3);
  return { width, height, data };
}

/** Blend `src` over `dst` with an 8-bit coverage, rounding like an integer compositor. */
const blend = (src: number, dst: number, m: number): number =>
  Math.floor((src * m + dst * (255 - m) + 127) / 255);

/** Polygon coverage mask over a `bw` by `bh` box: pixels whose centre lies inside, plus the edge pixels. */
function polygonMask(
  pts: readonly (readonly [number, number])[],
  bw: number,
  bh: number,
): Uint8Array {
  const mask = new Uint8Array(bw * bh);
  const n = pts.length;
  for (let y = 0; y < bh; y++) {
    const yc = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const [x1, y1] = pts[i] as [number, number];
      const [x2, y2] = pts[(i + 1) % n] as [number, number];
      if ((y1 <= yc && y2 > yc) || (y2 <= yc && y1 > yc))
        xs.push(x1 + ((yc - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(
        0,
        Math.floor((xs[k] as number) - 0.5 + 1e-9) +
          1 -
          (Number.isInteger((xs[k] as number) - 0.5) ? 1 : 0),
      );
      const to = Math.min(bw - 1, Math.floor((xs[k + 1] as number) + 0.5 - 1e-9));
      for (let x = Math.max(0, from); x <= to; x++) mask[y * bw + x] = 255;
    }
  }
  return mask;
}

interface ScreenVertex {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

/**
 * Warp a texture across a quad. `pts` are in UV order, which matches the
 * texture's corners `[(0,0), (0,h), (w,h), (w,0)]`. The map from texture to
 * screen is affine, so it is solved from the 4 correspondences and inverted
 * for nearest-texel sampling. `ao` is an optional per-vertex brightness (fit
 * with one affine function and applied to RGB only). Degenerate quads
 * (edge-on to the camera) draw nothing.
 */
export function drawTexturedQuad(
  canvas: Canvas,
  pts: readonly ScreenVertex[],
  tex: RasterImage,
  ao: readonly number[] | null,
): void {
  const allOne = ao?.every((a) => a === 1.0);
  const aoFactors = ao === null || allOne ? null : ao;
  let area2 = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i] as ScreenVertex;
    const b = pts[(i + 1) % 4] as ScreenVertex;
    area2 += a.sx * b.sy - b.sx * a.sy;
  }
  if (Math.abs(area2) < 2.0) return;

  const src = pts.map((p) => [p.tx, p.ty] as const);
  const fx = lstsq3(
    src,
    pts.map((p) => p.sx),
  );
  const fy = lstsq3(
    src,
    pts.map((p) => p.sy),
  );
  if (fx === null || fy === null) return;
  const [m11, m12, t1] = fx;
  const [m21, m22, t2] = fy;
  const det = m11 * m22 - m12 * m21;
  if (Math.abs(det) < 1e-12) return;
  const inv = [m22 / det, -m12 / det, -m21 / det, m11 / det];

  const xs = pts.map((p) => p.sx);
  const ys = pts.map((p) => p.sy);
  const x0 = Math.floor(Math.min(...xs));
  const x1 = Math.ceil(Math.max(...xs));
  const y0 = Math.floor(Math.min(...ys));
  const y1 = Math.ceil(Math.max(...ys));
  const bw = x1 - x0;
  const bh = y1 - y0;
  if (bw < 1 || bh < 1) return;

  const a = inv[0] as number;
  const b = inv[1] as number;
  const c = a * (x0 - t1) + b * (y0 - t2);
  const d = inv[2] as number;
  const e = inv[3] as number;
  const f = d * (x0 - t1) + e * (y0 - t2);

  const mask = polygonMask(
    pts.map((p) => [p.sx - x0, p.sy - y0] as const),
    bw,
    bh,
  );
  let brightFit: [number, number, number] | null = null;
  if (aoFactors !== null) {
    brightFit = lstsq3(
      pts.map((p) => [p.sx - x0, p.sy - y0] as const),
      aoFactors,
    );
  }
  const ch = tex.channels;
  for (let oy = 0; oy < bh; oy++) {
    const cy = y0 + oy;
    if (cy < 0 || cy >= canvas.height) continue;
    for (let ox = 0; ox < bw; ox++) {
      const cx = x0 + ox;
      if (cx < 0 || cx >= canvas.width) continue;
      let cover = mask[oy * bw + ox] as number;
      if (cover === 0) continue;
      const tx = Math.min(tex.width - 1, Math.max(0, Math.trunc(a * ox + b * oy + c)));
      const ty = Math.min(tex.height - 1, Math.max(0, Math.trunc(d * ox + e * oy + f)));
      const ti = (ty * tex.width + tx) * ch;
      let r = tex.data[ti] as number;
      let g = tex.data[ti + 1] as number;
      let bl = tex.data[ti + 2] as number;
      if (brightFit !== null) {
        const k = Math.min(1, Math.max(0, brightFit[0] * ox + brightFit[1] * oy + brightFit[2]));
        r = Math.trunc(Math.fround(r) * Math.fround(k));
        g = Math.trunc(Math.fround(g) * Math.fround(k));
        bl = Math.trunc(Math.fround(bl) * Math.fround(k));
      }
      if (ch === 4) cover = Math.trunc((cover / 255) * ((tex.data[ti + 3] as number) / 255) * 255);
      if (cover === 0) continue;
      const di = (cy * canvas.width + cx) * 3;
      canvas.data[di] = blend(r, canvas.data[di] as number, cover);
      canvas.data[di + 1] = blend(g, canvas.data[di + 1] as number, cover);
      canvas.data[di + 2] = blend(bl, canvas.data[di + 2] as number, cover);
    }
  }
}

// -- shadow ---------------------------------------------------------------------------------------

/** Gaussian-blurred contact ellipse under the structure's projected footprint, composited onto the canvas. */
function softShadow(canvas: Canvas, foot: readonly (readonly [number, number])[]): void {
  const { width: W, height: H } = canvas;
  const xs = foot.map((p) => p[0]);
  const ys = foot.map((p) => p[1]);
  let cx = xs.reduce((a, b) => a + b, 0) / xs.length;
  let cy = ys.reduce((a, b) => a + b, 0) / ys.length;
  const rx = (Math.max(...xs) - Math.min(...xs)) * 0.52;
  const ry = (Math.max(...ys) - Math.min(...ys)) * 0.42 + rx * 0.12;
  // Slight offset away from the light (light from upper-left).
  cx += rx * 0.08;
  cy += ry * 0.18;
  // Pillow approximates a Gaussian with three box blurs. The blur is local, so work in a
  // window around the ellipse; beyond it the shadow is zero either way.
  const sigma = Math.max(8, Math.trunc(0.035 * Math.max(W, H)));
  const widths = boxWidths(sigma);
  const pad = widths.reduce((sum, w) => sum + (w - 1) / 2, 0) + 2;
  const wx0 = Math.max(0, Math.floor(cx - rx - pad));
  const wy0 = Math.max(0, Math.floor(cy - ry - pad));
  const wx1 = Math.min(W, Math.ceil(cx + rx + pad));
  const wy1 = Math.min(H, Math.ceil(cy + ry + pad));
  const [ww, wh] = [wx1 - wx0, wy1 - wy0];
  if (ww <= 0 || wh <= 0) return;
  const alpha = new Float32Array(ww * wh);
  for (
    let y = Math.max(wy0, Math.floor(cy - ry));
    y <= Math.min(wy1 - 1, Math.ceil(cy + ry));
    y++
  ) {
    for (
      let x = Math.max(wx0, Math.floor(cx - rx));
      x <= Math.min(wx1 - 1, Math.ceil(cx + rx));
      x++
    ) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) alpha[(y - wy0) * ww + (x - wx0)] = 95 / 255;
    }
  }
  let blurred: Float32Array = alpha;
  for (const width of widths)
    blurred = boxBlurAxis(boxBlurAxis(blurred, ww, wh, width, true), ww, wh, width, false);
  const shadowRgb = [40, 35, 30] as const;
  for (let y = 0; y < wh; y++) {
    for (let x = 0; x < ww; x++) {
      const a = Math.round((blurred[y * ww + x] as number) * 255);
      if (a === 0) continue;
      const i = ((y + wy0) * W + (x + wx0)) * 3;
      for (let c = 0; c < 3; c++)
        canvas.data[i + c] = blend(shadowRgb[c] as number, canvas.data[i + c] as number, a);
    }
  }
}

/** Box widths whose three successive passes approximate a Gaussian of the given sigma. */
function boxWidths(sigma: number, n = 3): number[] {
  const ideal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(ideal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  return Array.from({ length: n }, (_, i) => (i < m ? wl : wu));
}

/** One running-sum box blur along an axis; samples beyond the edge count as zero. */
function boxBlurAxis(
  src: Float32Array,
  W: number,
  H: number,
  width: number,
  horizontal: boolean,
): Float32Array {
  const out = new Float32Array(W * H);
  const r = (width - 1) / 2;
  const len = horizontal ? W : H;
  const lines = horizontal ? H : W;
  const step = horizontal ? 1 : W; // distance between samples along the axis
  const lineStep = horizontal ? W : 1; // distance between lines
  const inv = 1 / width;
  for (let l = 0; l < lines; l++) {
    const base = l * lineStep;
    let sum = 0;
    for (let i = 0; i <= Math.min(r, len - 1); i++) sum += src[base + i * step] as number;
    for (let i = 0; i < len; i++) {
      out[base + i * step] = sum * inv;
      const add = i + r + 1;
      const drop = i - r;
      if (add < len) sum += src[base + add * step] as number;
      if (drop >= 0) sum -= src[base + drop * step] as number;
    }
  }
  return out;
}

// -- downscale ----------------------------------------------------------------------------------------

const lanczos = (x: number): number => {
  if (x === 0) return 1;
  if (Math.abs(x) >= 3) return 0;
  const px = Math.PI * x;
  return (3 * Math.sin(px) * Math.sin(px / 3)) / (px * px);
};

/** Resample one axis with a Lanczos filter, with an 8-bit result like Pillow's. */
function resampleAxis(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstLen: number,
  horizontal: boolean,
): Uint8Array {
  const inLen = horizontal ? srcW : srcH;
  const scale = inLen / dstLen;
  const filterScale = Math.max(1, scale);
  const support = 3 * filterScale;
  const dstW = horizontal ? dstLen : srcW;
  const dstH = horizontal ? srcH : dstLen;
  const out = new Uint8Array(dstW * dstH * 3);
  const others = horizontal ? srcH : srcW;
  const inStep = horizontal ? 3 : srcW * 3; // distance between samples along the axis
  const inLine = horizontal ? srcW * 3 : 3; // distance between lines
  const outStep = horizontal ? 3 : dstW * 3;
  const outLine = horizontal ? dstW * 3 : 3;
  for (let i = 0; i < dstLen; i++) {
    const center = (i + 0.5) * scale;
    const lo = Math.max(0, Math.trunc(center - support + 0.5));
    const hi = Math.min(inLen, Math.trunc(center + support + 0.5));
    const w = new Float64Array(hi - lo);
    let total = 0;
    for (let x = lo; x < hi; x++) {
      const k = lanczos((x + 0.5 - center) / filterScale);
      w[x - lo] = k;
      total += k;
    }
    for (let j = 0; j < w.length; j++) (w as Float64Array)[j] = (w[j] as number) / total;
    for (let o = 0; o < others; o++) {
      const inBase = o * inLine;
      const outBase = o * outLine + i * outStep;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let x = lo; x < hi; x++)
          sum += (src[inBase + x * inStep + c] as number) * (w[x - lo] as number);
        out[outBase + c] = Math.min(255, Math.max(0, Math.round(sum)));
      }
    }
  }
  return out;
}

export function downscaleLanczos(c: Canvas, width: number, height: number): Canvas {
  const h = resampleAxis(c.data, c.width, c.height, width, true);
  return { width, height, data: resampleAxis(h, width, c.height, height, false) };
}

// -- scene rendering ----------------------------------------------------------------------------------------

export interface RenderOptions {
  /** Longest output side in pixels. Default 2048. */
  longestPx?: number;
  /** Supersample factor. Default 2. */
  supersample?: number;
  /** Framing margin. Default 0.35. */
  margin?: number;
  /** Soft contact shadow under the structure. Default true. */
  shadow?: boolean;
  /** A title drawn top-centre, which also adds headroom above the structure. */
  title?: string;
  /** The view label and north compass. Default true. */
  overlay?: boolean;
}

const TITLE_COLOR: Rgb3 = [110, 105, 95];

/** Pixel-style title, top-centre: drawn small, then scaled up by whole pixels. */
export function drawTitle(canvas: Canvas, title: string): void {
  const m = textMask(title);
  const pad = 2;
  const scale = Math.max(2, Math.trunc(canvas.width / 260));
  const [w, h] = [m.width + pad * 2, m.height + pad * 2];
  const left = Math.trunc((canvas.width - w * scale) / 2);
  const top = Math.trunc(canvas.height * 0.045);
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      if (!m.on[y * m.width + x]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = left + (x + pad) * scale + dx;
          const py = top + (y + pad) * scale + dy;
          if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
          canvas.data.set(TITLE_COLOR, (py * canvas.width + px) * 3);
        }
      }
    }
  }
  void h;
}

/** The view label (bottom-left) and a north compass (bottom-right). */
export function drawOverlay(canvas: Canvas, view: View, r: Vec3, u: Vec3): void {
  const { width: W, height: H } = canvas;
  const pad = 5;
  const [tw, th] = [textWidth(view.label, 11), 7];
  const [lx, ly] = [10, H - 10 - th - 2 * pad];
  fillRectAlpha(canvas, lx - pad, ly - pad, lx + tw + pad, ly + th + pad, [0, 0, 0], 160);
  drawText(canvas, lx, ly, view.label, { size: 11, color: [255, 255, 255] });

  // Compass: project north (-Z) onto the screen.
  const [sx, sy] = [-r[2], -u[2]];
  const [cx, cy, rad] = [W - 42, H - 42, 24];
  drawRingAlpha(canvas, cx, cy, rad, [255, 255, 255], 220, 2);
  const length = Math.hypot(sx, sy);
  const [nw, nh] = [textWidth("N", 11), 7];
  if (length > 1e-6) {
    const [dx, dy] = [sx / length, -sy / length]; // screen y points down
    const [ex, ey] = [cx + dx * (rad - 6), cy + dy * (rad - 6)];
    drawLineAlpha(canvas, cx, cy, ex, ey, [255, 255, 255], 230, 2);
    drawText(canvas, Math.round(ex + dx * 10 - nw / 2), Math.round(ey + dy * 10 - nh / 2), "N", {
      size: 11,
      color: [255, 255, 255],
    });
  } else {
    drawText(canvas, Math.round(cx - nw / 2), Math.round(cy - nh / 2), "N", {
      size: 11,
      color: [255, 255, 255],
    });
  }
}

interface Drawn {
  depth: number;
  x: number;
  y: number;
  z: number;
  seq: number;
  world: Vec3[];
  normal: Vec3;
  tex: RasterImage;
  flat: boolean;
}

/** Which dense cells are drawn: placed and not air. */
function renderableBounds(
  dense: DenseVolume,
):
  | readonly [readonly [number, number], readonly [number, number], readonly [number, number]]
  | null {
  const air = dense.palette.indexOf("minecraft:air");
  const [sx, sy, sz] = dense.size;
  let lo: [number, number, number] | null = null;
  let hi: [number, number, number] = [0, 0, 0];
  for (let x = 0; x < sx; x++) {
    for (let y = 0; y < sy; y++) {
      for (let z = 0; z < sz; z++) {
        const v = dense.data[(x * sy + y) * sz + z] as number;
        if (v < 0 || v === air) continue;
        if (lo === null) {
          lo = [x, y, z];
          hi = [x + 1, y + 1, z + 1];
        } else {
          lo = [Math.min(lo[0], x), Math.min(lo[1], y), Math.min(lo[2], z)];
          hi = [Math.max(hi[0], x + 1), Math.max(hi[1], y + 1), Math.max(hi[2], z + 1)];
        }
      }
    }
  }
  return lo === null
    ? null
    : [
        [lo[0], hi[0]],
        [lo[1], hi[1]],
        [lo[2], hi[2]],
      ];
}

/** Render one view of a dense volume to an RGB canvas. */
export function renderView(
  dense: DenseVolume,
  assets: AssetSource | null,
  view: View,
  options: RenderOptions = {},
): Canvas {
  const ss = options.supersample ?? SUPERSAMPLE;
  const longest = options.longestPx ?? PRESENTATION_LONGEST_PX;
  const margin = options.margin ?? PRESENTATION_MARGIN;
  const crop = renderableBounds(dense);
  if (crop === null) {
    const empty = newCanvas(512, 512, BG_PRESENTATION);
    if (options.title) drawTitle(empty, options.title);
    return empty;
  }
  const scene = prepareScene(dense, assets);
  const { d, r, u } = camera(view);
  const [[x0, x1], [y0, y1], [z0, z1]] = crop;

  const corners: Vec3[] = [];
  for (const x of [x0, x1])
    for (const y of [y0, y1]) for (const z of [z0, z1]) corners.push([x, y, z]);
  const proj = corners.map((p) => project(p, r, u));
  let minx = Math.min(...proj.map((p) => p[0]));
  let maxx = Math.max(...proj.map((p) => p[0]));
  let miny = Math.min(...proj.map((p) => p[1]));
  let maxy = Math.max(...proj.map((p) => p[1]));
  const mx = (margin / 2) * (maxx - minx);
  const my = (margin / 2) * (maxy - miny);
  minx -= mx;
  maxx += mx;
  miny -= my;
  maxy += my;
  // Headroom for the title.
  if (options.title) miny -= (maxy - miny) * 0.16;
  const w2d = Math.max(maxx - minx, 1e-9);
  const h2d = Math.max(maxy - miny, 1e-9);
  const scale = (longest / Math.max(w2d, h2d)) * ss;
  const W = pyRound(w2d * scale);
  const H = pyRound(h2d * scale);
  const toPx = (sx: number, sy: number): [number, number] => [
    pyRound((sx - minx) * scale),
    pyRound((maxy - sy) * scale),
  ];

  const canvas = newCanvas(W, H, BG_PRESENTATION);
  if (options.shadow ?? true) {
    const foot: [number, number][] = [];
    for (const x of [x0, x1])
      for (const z of [z0, z1]) foot.push(toPx(...project([x, y0, z], r, u)));
    softShadow(canvas, foot);
  }

  const cache = new Map<string, { quads: Quad[]; isFallback: boolean }>();
  const drawn: Drawn[] = [];
  const [, sy, sz] = dense.size;
  let seq = 0;
  for (let x = x0; x < x1; x++) {
    for (let y = y0; y < y1; y++) {
      for (let z = z0; z < z1; z++) {
        const idx = dense.data[(x * sy + y) * sz + z] as number;
        if (idx < 0 || idx >= dense.palette.length || dense.palette[idx] === "minecraft:air")
          continue;
        const cell = cellQuads(scene, x, y, z, cache);
        if (cell === null) continue;
        const name = splitBlockstate(dense.palette[idx] as string)[0];
        for (const q of cell.quads) {
          // Back-face culling uses the true float normal.
          if (dot(q.normal, d) >= -1e-9) continue;
          if (quadCulledByNeighbour(scene, q.cull, x, y, z, name)) continue;
          const world = q.points.map((p) => [p[0] + x, p[1] + y, p[2] + z] as Vec3);
          let depth = 0;
          for (const p of world)
            for (let i = 0; i < 3; i++) depth += (p[i] as number) * (d[i] as number);
          drawn.push({
            depth: depth / 4.0,
            x,
            y,
            z,
            seq: seq++,
            world,
            normal: q.normal,
            tex: q.image,
            flat: q.flat,
          });
        }
      }
    }
  }
  drawn.sort((a, b) => -a.depth - -b.depth || a.x - b.x || a.y - b.y || a.z - b.z || a.seq - b.seq);

  for (const q of drawn) {
    const th = q.tex.height;
    const tw = q.tex.width;
    const texCorners = [
      [0, 0],
      [0, th],
      [tw, th],
      [tw, 0],
    ] as const;
    const verts = q.world.map((p, i) => {
      const [sx, sy2] = toPx(...project(p, r, u));
      return { sx, sy: sy2, tx: texCorners[i]?.[0] as number, ty: texCorners[i]?.[1] as number };
    });
    let ao: number[] | null = null;
    if (!q.flat) {
      const local = q.world.map((p) => [p[0] - q.x, p[1] - q.y, p[2] - q.z] as Vec3);
      const levels = quadAoLevels(local, snapNormal(q.normal), [q.x, q.y, q.z], scene.occ);
      ao = levels.every((l) => l === 3) ? null : levels.map((l) => AO_BRIGHTNESS[l] as number);
    }
    drawTexturedQuad(canvas, verts, q.tex, ao);
  }

  const finished =
    ss > 1 ? downscaleLanczos(canvas, Math.trunc(W / ss), Math.trunc(H / ss)) : canvas;
  if (options.title) drawTitle(finished, options.title);
  // The view label and compass go on even in presentation mode: a PNG seen alone must say which view it is.
  if (options.overlay ?? true) drawOverlay(finished, view, r, u);
  return finished;
}

export type { Canvas, Scene };
