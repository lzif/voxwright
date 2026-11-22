// SPDX-License-Identifier: AGPL-3.0-only

// Python semantics the example scripts rely on.

/** Python's `round(x)`: ties go to the even integer. */
export function pyRound(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** Python's `a // b` for numbers. */
export const floorDiv = (a: number, b: number): number => Math.floor(a / b);

/** `range(start, stop)` */
export function range(start: number, stop?: number, step = 1): number[] {
  const [lo, hi] = stop === undefined ? [0, start] : [start, stop];
  const out: number[] = [];
  if (step > 0) for (let i = lo; i < hi; i += step) out.push(i);
  else for (let i = lo; i > hi; i += step) out.push(i);
  return out;
}

/** Pairs of neighbours: Python's `zip(xs, xs[1:])`. */
export const pairs = <T>(xs: readonly T[]): [T, T][] => xs.slice(1).map((b, i) => [xs[i] as T, b]);
