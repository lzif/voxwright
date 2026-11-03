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
// A colon may follow "az", "orbit" or "el" ("orbit:8_el:25"); both styles
// normalize to the same labels. Malformed tokens throw {@link ViewError}
// naming the offending token.

import { pyStrip } from "@voxwright/core";

/** Hard cap on the number of views in one render set. */
export const MAX_VIEWS = 36;

export class ViewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ViewError";
  }
}

export interface View {
  /** Clockwise from north (-Z), degrees. */
  azimuth: number;
  /** Above horizontal, degrees. */
  elevation: number;
  /** `az045_el025`, `top` or `iso`. */
  label: string;
}

const GRAMMAR_HELP =
  "expected one of 'az<ddd>_el<dd>' (e.g. 'az045_el025'), 'orbit<n>_el<dd>' (e.g. 'orbit8_el25'), 'top', or 'iso'; multiple views are separated by semicolons";

const AZ_EL_RE = /^az:?(\d+)_el:?(\d+)$/;
const ORBIT_RE = /^orbit:?(\d+)_el:?(\d+)$/;

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

function parseToken(token: string): View[] {
  if (token === "top") return [{ azimuth: 0, elevation: 90, label: "top" }];
  if (token === "iso") return [{ azimuth: 45, elevation: 35, label: "iso" }];

  let m = AZ_EL_RE.exec(token);
  if (m) {
    const az = Number(m[1]);
    const el = Number(m[2]);
    if (!(az >= 0 && az < 360)) {
      throw new ViewError(
        `malformed view token ${q(token)}: azimuth ${pyFloat(az)} out of range [0, 360); ${GRAMMAR_HELP}`,
      );
    }
    if (!(el >= 0 && el <= 90)) {
      throw new ViewError(
        `malformed view token ${q(token)}: elevation ${pyFloat(el)} out of range [0, 90]; ${GRAMMAR_HELP}`,
      );
    }
    return [{ azimuth: az, elevation: el, label: azElLabel(az, el) }];
  }

  m = ORBIT_RE.exec(token);
  if (m) {
    const n = Number(m[1]);
    const el = Number(m[2]);
    if (n < 1)
      throw new ViewError(
        `malformed view token ${q(token)}: orbit count must be >= 1; ${GRAMMAR_HELP}`,
      );
    if (!(el >= 0 && el <= 90)) {
      throw new ViewError(
        `malformed view token ${q(token)}: elevation ${pyFloat(el)} out of range [0, 90]; ${GRAMMAR_HELP}`,
      );
    }
    return orbitViews(n, el);
  }
  throw new ViewError(`malformed view token ${q(token)}: ${GRAMMAR_HELP}`);
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
  const items = [...spec];
  if (items.length > 0 && items.every((v): v is string => typeof v === "string"))
    return parseViews(items.join(";"));
  return checkCap(items as View[]);
}
