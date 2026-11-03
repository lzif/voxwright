// SPDX-License-Identifier: AGPL-3.0-only

// Text colours against their backgrounds, as the stylesheets use them, checked against WCAG AA
// (4.5:1 for normal text). axe-core measures these in the browser but cannot decide for the entries
// of the scrolling block list that are out of view, so the pairs are also listed here and computed.
import { describe, expect, it } from "vitest";

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** WCAG contrast ratio of two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** [text, background, where it is used] */
const PAIRS: [string, string, string][] = [
  ["#2b2925", "#f4f1eb", "body text on the page"],
  ["#2b2925", "#fffdf8", "text in the side panels"],
  ["#2b2925", "#ffffff", "block list entries, inputs"],
  ["#5f594f", "#f4f1eb", "hints, headings, status on the page"],
  ["#5f594f", "#fffdf8", "hints and headings in the panels"],
  ["#5f594f", "#ffffff", "hints under inputs"],
  ["#4d483f", "#f4f1eb", "footer text"],
  ["#1d3f9a", "#f4f1eb", "footer links"],
  ["#f4f1eb", "#2b2925", "primary buttons, the chosen tool, the chosen block"],
  ["#2b2925", "#e2dccf", "secondary buttons"],
  ["#7a1f16", "#fbe3e0", "error messages"],
  ["#7a1f16", "#f4f1eb", "inline errors"],
  ["#7a1f16", "#fffdf8", "inline errors in the panels"],
  ["#4d483f", "#fffdf8", "restore dialog labels"],
  ["#f4f1eb", "#2b2925", "the skip link"],
  ["#1d4ed8", "#f4f1eb", "focus ring against the page (3:1 needed)"],
  ["#1d4ed8", "#fffdf8", "focus ring against the panels (3:1 needed)"],
];

describe("colour contrast", () => {
  for (const [fg, bg, where] of PAIRS) {
    const need = where.includes("focus ring") ? 3 : 4.5;
    it(`${fg} on ${bg} (${where}) is at least ${need}:1`, () => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(need);
    });
  }
});
