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
  ["#f4f1eb", "#3d3a34", "the nudge pad's Up, Down and Zoom buttons"],
  ["#a8a194", "#2b2925", "the corner letter A or B that is not active on the nudge pad"],
  ["#24221f", "#f4f1eb", "the active corner letter, and the Hollow toggle when on"],
  ["#f4f1eb", "#3d3a34", "the Edit state chip in the readout line"],
  ["#5f594f", "#fffdf8", "the status line and the move pad's step size in the sheets"],
  ["#2b2925", "#e2dccf", "unpressed chips, the x8 toggle and the switch when off"],
  ["#ffffff", "#2e6930", "a switch that is on"],
  ["#7a4f00", "#ffffff", "a starred row in the palette list"],
  ["#7a4f00", "#e2dccf", "the star on a favourite chip in the hotbar"],
  ["#ffd666", "#2b2925", "the star on a pressed hotbar chip and on the quick row over the picture"],
  ["#7a4f00", "#f4f1eb", "the star on a pressed chip of the quick row over the picture"],
  ["#f4f1eb", "#2b2925", "the undo toast's words and the white-on-dark pill"],
  ["#24221f", "#f4f1eb", "the Undo button in the toast"],
  ["#2b2925", "#fffdf8", "the quick start card's title and steps; the help text in the menu"],
  ["#5f594f", "#fffdf8", "a done step and the count in the quick start card"],
  ["#ffffff", "#2e6930", "the tick of a done step in the quick start card"],
  ["#2b2925", "#e2dccf", "Centre on the build and Show tips in the menu"],
  ["#a8a194", "#24221f", "the file status in the top bar"],
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
