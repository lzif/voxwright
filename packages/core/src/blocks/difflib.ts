// SPDX-License-Identifier: AGPL-3.0-only
import { compareCodePoints } from "./pystr.ts";

// A port of the parts of Python's difflib used by `get_close_matches`:
// SequenceMatcher without junk handling (autojunk only applies to
// sequences of 200 or more items, far beyond block names).

type Match = readonly [i: number, j: number, size: number];

function longestMatch(
  a: readonly string[],
  b2j: Map<string, number[]>,
  alo: number,
  ahi: number,
  blo: number,
  bhi: number,
): Match {
  let besti = alo;
  let bestj = blo;
  let bestsize = 0;
  let j2len = new Map<number, number>();
  for (let i = alo; i < ahi; i++) {
    const newj2len = new Map<number, number>();
    for (const j of b2j.get(a[i] as string) ?? []) {
      if (j < blo) continue;
      if (j >= bhi) break;
      const k = (j2len.get(j - 1) ?? 0) + 1;
      newj2len.set(j, k);
      if (k > bestsize) {
        besti = i - k + 1;
        bestj = j - k + 1;
        bestsize = k;
      }
    }
    j2len = newj2len;
  }
  return [besti, bestj, bestsize];
}

function matchingBlocks(a: readonly string[], b: readonly string[]): Match[] {
  const b2j = new Map<string, number[]>();
  b.forEach((ch, j) => {
    const arr = b2j.get(ch);
    if (arr) arr.push(j);
    else b2j.set(ch, [j]);
  });
  const found: Match[] = [];
  const queue: [number, number, number, number][] = [[0, a.length, 0, b.length]];
  while (queue.length > 0) {
    const [alo, ahi, blo, bhi] = queue.pop() as [number, number, number, number];
    const m = longestMatch(a, b2j, alo, ahi, blo, bhi);
    const [i, j, k] = m;
    if (k > 0) {
      found.push(m);
      if (alo < i && blo < j) queue.push([alo, i, blo, j]);
      if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
    }
  }
  return found;
}

/** `SequenceMatcher(None, a, b).ratio()` over code points. */
export function ratio(a: string, b: string): number {
  const aa = Array.from(a);
  const bb = Array.from(b);
  const total = aa.length + bb.length;
  if (total === 0) return 1;
  let matches = 0;
  for (const [, , size] of matchingBlocks(aa, bb)) matches += size;
  return (2 * matches) / total;
}

/**
 * `difflib.get_close_matches(word, possibilities, n, cutoff)`: the best
 * `n` possibilities scoring at least `cutoff`, best first. Ties go to the
 * larger string, as in Python's `heapq.nlargest` over `(score, string)`.
 */
export function getCloseMatches(
  word: string,
  possibilities: readonly string[],
  n = 3,
  cutoff = 0.6,
): string[] {
  const scored: { score: number; value: string }[] = [];
  for (const x of possibilities) {
    const score = ratio(x, word);
    if (score >= cutoff) scored.push({ score, value: x });
  }
  scored.sort((p, q) => q.score - p.score || compareCodePoints(q.value, p.value));
  return scored.slice(0, n).map((s) => s.value);
}
