// SPDX-License-Identifier: AGPL-3.0-only

/** Python's `round(x)`: ties go to the even integer. */
export function pyRound(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** Python's `a // b` followed by `% m`, always non-negative. */
export const floorDivMod = (a: number, b: number, m: number): number =>
  ((Math.floor(a / b) % m) + m) % m;
