// SPDX-License-Identifier: AGPL-3.0-only

// Helpers that reproduce Python string semantics, so block strings behave
// exactly as they do in the reference implementation.

const PY_SPACE = new Set<number>([
  0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x85, 0xa0, 0x1680, 0x2000, 0x2001,
  0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f,
  0x205f, 0x3000,
]);

/** `str.isspace()` for one character. */
export function isPySpace(ch: string): boolean {
  const cp = ch.codePointAt(0);
  return cp !== undefined && PY_SPACE.has(cp);
}

/** `str.strip()` with no argument. */
export function pyStrip(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && PY_SPACE.has(s.charCodeAt(start))) start++;
  while (end > start && PY_SPACE.has(s.charCodeAt(end - 1))) end--;
  return s.slice(start, end);
}

/** Compare strings by code point, as Python's `sorted` does. */
export function compareCodePoints(a: string, b: string): number {
  const ia = a[Symbol.iterator]();
  const ib = b[Symbol.iterator]();
  for (;;) {
    const ra = ia.next();
    const rb = ib.next();
    if (ra.done && rb.done) return 0;
    if (ra.done) return -1;
    if (rb.done) return 1;
    const ca = (ra.value as string).codePointAt(0) as number;
    const cb = (rb.value as string).codePointAt(0) as number;
    if (ca !== cb) return ca < cb ? -1 : 1;
  }
}
