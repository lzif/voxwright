// SPDX-License-Identifier: AGPL-3.0-only

// View grammar for previews.
//
// A view is a camera: azimuth (clockwise from north = -Z, degrees) and
// elevation (above horizontal, degrees). Parsing views has no side effects;
// the renderers consume them.
//
// Shorthand grammar (one separator style, semicolons only):
//
//   "az<ddd>_el<dd>"   e.g. "az045_el025"  (digits in, floats out)
//   "orbit<n>_el<dd>"  e.g. "orbit8_el25"  -> n views starting at az000,
//                                             stepping +360/n clockwise
//   "top"              -> elevation 90 (azimuth degenerate, stored as 0)
//   "iso"              -> az045_el035 (pinned)
//
// Any view token may carry a focus suffix:
//   - `@<x1>,<y1>,<z1>:<x2>,<y2>,<z2>` (e.g. "iso@10,4,18:22,10,28") to frame
//     the inclusive world-space box between two corners (order-independent,
//     normalized to min/max per axis).
//   - `@<x>,<y>,<z>r<radius>` (e.g. "iso@15,6,22r5") as shorthand for a
//     world-space cube centered at (x, y, z) with inclusive half-extent
//     `radius` (>= 1).
//
// A colon may follow "az", "orbit" or "el" ("orbit:8_el:25"); both styles
// normalize to the same labels. Malformed tokens throw {@link ViewError}
// naming the offending token.

import { pyStrip } from "voxmc-core";

/** Hard cap on the number of views in one render set. */
export const MAX_VIEWS = 36;

export class ViewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ViewError";
  }
}

export type ViewFocus =
  | {
      /** World-space focus centre `[x, y, z]` (integer coordinates). */
      center: readonly [number, number, number];
      /** Inclusive half-extent in blocks (`>= 1`, framing a `2r + 1` cube). */
      radius: number;
    }
  | {
      /** Inclusive minimum world-space corner `[x, y, z]` (integer coordinates). */
      min: readonly [number, number, number];
      /** Inclusive maximum world-space corner `[x, y, z]` (integer coordinates). */
      max: readonly [number, number, number];
    };

export interface View {
  /** Clockwise from north (-Z), degrees. */
  azimuth: number;
  /** Above horizontal, degrees. */
  elevation: number;
  /** `az045_el025`, `top` or `iso`, with optional `@x1,y1,z1:x2,y2,z2` or `@x,y,zr<radius>` focus suffix. */
  label: string;
  /** Optional world-space focus region for close-up framing. */
  focus?: ViewFocus;
}

const GRAMMAR_HELP =
  "expected one of 'az<ddd>_el<dd>' (e.g. 'az045_el025'), 'orbit<n>_el<dd>' (e.g. 'orbit8_el25'), 'top', or 'iso' with optional '@<x1>,<y1>,<z1>:<x2>,<y2>,<z2>' or '@<x>,<y>,<z>r<radius>' focus (e.g. 'iso@10,4,18:22,10,28' or 'iso@15,6,22r5'); multiple views are separated by semicolons";

const AZ_EL_RE = /^az:?(\d+)_el:?(\d+)$/;
const ORBIT_RE = /^orbit:?(\d+)_el:?(\d+)$/;
const FOCUS_BOX_RE = /^(-?\d+),(-?\d+),(-?\d+):(-?\d+),(-?\d+),(-?\d+)$/;
const FOCUS_RADIUS_RE = /^(-?\d+),(-?\d+),(-?\d+)r(-?\d+)$/;

/** Python's `repr` of a string token, for messages. */
const q = (s: string): string =>
  s.includes("'") && !s.includes('"')
    ? `"${s}"`
    : `'${s.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;

/** Python's `str(float)` for the values used in messages. */
const pyFloat = (v: number): string => (Number.isInteger(v) ? v.toFixed(1) : String(v));

/** Format a degree value for a label: integral values zero-padded to 3. */
function fmtNum(value: number): string {
  const rounded = Number(value.toFixed(3));
  if (Number.isInteger(rounded)) return String(rounded).padStart(3, "0");
  const [intPart, fracPart] = rounded.toFixed(3).replace(/0+$/, "").split(".") as [string, string];
  return `${intPart.padStart(3, "0")}.${fracPart}`;
}

const azElLabel = (azimuth: number, elevation: number): string =>
  `az${fmtNum(azimuth)}_el${fmtNum(elevation)}`;

/** n views starting at az000, stepping +360/n clockwise. */
function orbitViews(n: number, elevation: number): View[] {
  const views: View[] = [];
  for (let i = 0; i < n; i++) {
    // Normalize e.g. 359.9999999 -> 0 for float cleanliness.
    const az = Number(((i * 360) / n).toFixed(9)) % 360;
    views.push({ azimuth: az, elevation, label: azElLabel(az, elevation) });
  }
  return views;
}

export function checkCap(views: View[]): View[] {
  if (views.length > MAX_VIEWS) {
    throw new ViewError(
      `too many views (${views.length} > ${MAX_VIEWS}): an agent will request 360 someday; keep it at ${MAX_VIEWS} or fewer`,
    );
  }
  return views;
}

function parseIntCoord(raw: string, fullToken: string): number {
  const n = Number(raw) || 0;
  if (!Number.isSafeInteger(n)) {
    throw new ViewError(
      `malformed view token ${q(fullToken)}: focus coordinates out of range; ${GRAMMAR_HELP}`,
    );
  }
  return n;
}

function parseFocusSuffix(focusSpec: string, fullToken: string): ViewFocus {
  const box = FOCUS_BOX_RE.exec(focusSpec);
  if (box) {
    const x1 = parseIntCoord(box[1] as string, fullToken);
    const y1 = parseIntCoord(box[2] as string, fullToken);
    const z1 = parseIntCoord(box[3] as string, fullToken);
    const x2 = parseIntCoord(box[4] as string, fullToken);
    const y2 = parseIntCoord(box[5] as string, fullToken);
    const z2 = parseIntCoord(box[6] as string, fullToken);
    return {
      min: [Math.min(x1, x2), Math.min(y1, y2), Math.min(z1, z2)],
      max: [Math.max(x1, x2), Math.max(y1, y2), Math.max(z1, z2)],
    };
  }
  const m = FOCUS_RADIUS_RE.exec(focusSpec);
  if (!m) {
    throw new ViewError(
      `malformed view token ${q(fullToken)}: focus must be '@<x1>,<y1>,<z1>:<x2>,<y2>,<z2>' or '@<x>,<y>,<z>r<radius>' (e.g. '@10,4,18:22,10,28' or '@15,6,22r5'); ${GRAMMAR_HELP}`,
    );
  }
  const cx = parseIntCoord(m[1] as string, fullToken);
  const cy = parseIntCoord(m[2] as string, fullToken);
  const cz = parseIntCoord(m[3] as string, fullToken);
  const radius = Number(m[4]);
  if (!Number.isSafeInteger(radius) || radius < 1) {
    throw new ViewError(
      `malformed view token ${q(fullToken)}: focus radius must be >= 1; ${GRAMMAR_HELP}`,
    );
  }
  return { center: [cx, cy, cz], radius };
}

function cloneFocus(focus: ViewFocus): ViewFocus {
  return "center" in focus
    ? { center: [...focus.center] as [number, number, number], radius: focus.radius }
    : {
        min: [...focus.min] as [number, number, number],
        max: [...focus.max] as [number, number, number],
      };
}

function formatFocusSuffix(focus: ViewFocus): string {
  return "center" in focus
    ? `@${focus.center[0]},${focus.center[1]},${focus.center[2]}r${focus.radius}`
    : `@${focus.min[0]},${focus.min[1]},${focus.min[2]}:${focus.max[0]},${focus.max[1]},${focus.max[2]}`;
}

function parseBaseToken(baseSpec: string, fullToken: string): View[] {
  if (baseSpec === "top") return [{ azimuth: 0, elevation: 90, label: "top" }];
  if (baseSpec === "iso") return [{ azimuth: 45, elevation: 35, label: "iso" }];

  let m = AZ_EL_RE.exec(baseSpec);
  if (m) {
    const az = Number(m[1]);
    const el = Number(m[2]);
    if (!(az >= 0 && az < 360)) {
      throw new ViewError(
        `malformed view token ${q(fullToken)}: azimuth ${pyFloat(az)} out of range [0, 360); ${GRAMMAR_HELP}`,
      );
    }
    if (!(el >= 0 && el <= 90)) {
      throw new ViewError(
        `malformed view token ${q(fullToken)}: elevation ${pyFloat(el)} out of range [0, 90]; ${GRAMMAR_HELP}`,
      );
    }
    return [{ azimuth: az, elevation: el, label: azElLabel(az, el) }];
  }

  m = ORBIT_RE.exec(baseSpec);
  if (m) {
    const n = Number(m[1]);
    const el = Number(m[2]);
    if (n < 1)
      throw new ViewError(
        `malformed view token ${q(fullToken)}: orbit count must be >= 1; ${GRAMMAR_HELP}`,
      );
    if (!(el >= 0 && el <= 90)) {
      throw new ViewError(
        `malformed view token ${q(fullToken)}: elevation ${pyFloat(el)} out of range [0, 90]; ${GRAMMAR_HELP}`,
      );
    }
    return orbitViews(n, el);
  }
  throw new ViewError(`malformed view token ${q(fullToken)}: ${GRAMMAR_HELP}`);
}

function parseToken(token: string): View[] {
  const at = token.indexOf("@");
  if (at === -1) return parseBaseToken(token, token);
  const baseSpec = token.slice(0, at);
  if (baseSpec === "") {
    throw new ViewError(
      `malformed view token ${q(token)}: missing view before '@'; ${GRAMMAR_HELP}`,
    );
  }
  const focus = parseFocusSuffix(token.slice(at + 1), token);
  const suffix = formatFocusSuffix(focus);
  return parseBaseToken(baseSpec, token).map((v) => ({
    ...v,
    label: `${v.label}${suffix}`,
    focus: cloneFocus(focus),
  }));
}

/** Inclusive world-space `[min, max]` box for a {@link ViewFocus}. */
export function focusBounds(
  focus: ViewFocus,
): readonly [readonly [number, number, number], readonly [number, number, number]] {
  if ("center" in focus) {
    const [cx, cy, cz] = focus.center;
    const r = focus.radius;
    return [
      [cx - r, cy - r, cz - r],
      [cx + r, cy + r, cz + r],
    ];
  }
  return [
    [
      Math.min(focus.min[0], focus.max[0]),
      Math.min(focus.min[1], focus.max[1]),
      Math.min(focus.min[2], focus.max[2]),
    ],
    [
      Math.max(focus.min[0], focus.max[0]),
      Math.max(focus.min[1], focus.max[1]),
      Math.max(focus.min[2], focus.max[2]),
    ],
  ];
}

/** Parse a semicolon-separated view spec. `parseViews("az045_el025;top")` gives two views. */
export function parseViews(spec: string): View[] {
  const views: View[] = [];
  for (const raw of spec.split(";")) {
    const token = pyStrip(raw);
    if (token === "")
      throw new ViewError(`malformed view token ${q(token)} (empty): ${GRAMMAR_HELP}`);
    views.push(...parseToken(token));
  }
  return checkCap(views);
}

/** The default 9-view set: an 8-view orbit at 25 degrees plus top-down. */
export const defaultViews = (): View[] => parseViews("orbit8_el25;top");

/** Append an orbit of `n` views at 25 degrees to an existing view list. */
export function withCount(views: readonly View[], n: number): View[] {
  if (n <= 0) throw new RangeError(`count must be positive, got ${n}`);
  return checkCap([...views, ...orbitViews(n, 25)]);
}

/**
 * Normalize any view spec to a list of views. `null`/`undefined` gives the
 * defaults; a string is parsed; a list may hold view strings or views.
 */
export function resolveViews(spec: string | readonly (string | View)[] | null | undefined): View[] {
  if (spec === null || spec === undefined) return defaultViews();
  if (typeof spec === "string") return parseViews(spec);
  const out: View[] = [];
  for (const item of spec) {
    if (typeof item === "string") out.push(...parseViews(item));
    else out.push(item);
  }
  return checkCap(out);
}
