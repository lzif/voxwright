// SPDX-License-Identifier: AGPL-3.0-only

// Text colours against the faces they sit on, as the restyled page uses them (the Ore UI Study design
// system, `src/lib/ore-ui/tokens.json`), checked against WCAG AA: 4.5:1 for text, 3:1 for the focus ring.
// axe-core measures these in the browser but cannot decide for the entries of the scrolling block list
// that are out of view, so the pairs are also listed here and computed. The colours come from the tokens,
// so a change to a token is checked here too.
//
// Not asserted, because they are the design system's own pairs and its README lists them as known misses
// (`ore-tokens.test.ts` leaves them out too; the controls also carry a word and a glyph or shape):
//   ink on green-hover        3.1:1  hover face of green controls: the primary and hero buttons and the
//                                    chosen toggle segment, white text
//   ink on red-hover          2.4:1  hover face of the destructive button
//   outline on surface-panel  1.85:1, outline on surface-page 1.30:1  control edges
//   light-400 on surface-panel 2.7:1 (an unchecked box), green on surface-panel 2.0:1 (a green face)
// `ink-faint` (disabled and decorative text only, 3.87:1 on the page and 2.72:1 on a panel) is asserted
// only on `surface-sunken`, where the editor search placeholder sits.
// The red square before an inline error (`.ore-field__error`) is a marker beside the words, which are
// ink on the page or a panel; it is not text and is not measured.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type OreTokens, resolveColors } from "../scripts/ore-tokens.ts";
import { VIEW_BACKGROUND } from "../src/lib/view-background.ts";

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

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");
const colors = resolveColors(JSON.parse(read("../src/lib/ore-ui/tokens.json")) as OreTokens);
const color = (name: string): string => {
  const hex = colors.get(name);
  if (hex === undefined) throw new Error(`no colour token '${name}'`);
  return hex;
};

/** [text token, background token, where it is used] */
const PAIRS: [string, string, string][] = [
  [
    "ink",
    "surface-page",
    "body text, the page title, field labels and slider values, the footer's name and links, the restore dialog's text, the sheet's body, dark buttons while pressed",
  ],
  [
    "ink-muted",
    "surface-page",
    "the status line, the hints under the picture, the open-a-file text, the footer text, the restore dialog's File, Saved and Edits labels",
  ],
  [
    "ink",
    "surface-panel",
    "panel headers, rows and labels, the text of a check box, the top bar's title, the welcome card, the restore dialog's header and footer, the format list's open menu, dark editor buttons at rest",
  ],
  [
    "ink-muted",
    "surface-panel",
    "hints in the panels (camera, export, autosave, pack), the block counts' numbers, the top bar's status line, the welcome card's line",
  ],
  ["ink", "surface-panel", "the edit line's message (Editor status bar)"],
  ["ink-muted", "surface-panel", "the edit line's tool help"],
  [
    "ink",
    "green",
    "primary and hero buttons (Open a schematic, Export and download, Restore), the chosen toggle segment, the tick of a checked box",
  ],
  ["ink", "green-pressed", "the pressed face of those"],
  ["ink", "blue", "the info notice: the working note and the software renderer's note"],
  ["ink-dark", "yellow", "the important notice: errors"],
  [
    "ink-dark",
    "light-200",
    "secondary buttons (Use my own pack, Zoom in, Undo, Redo, Show tips), unchosen toggle segments and tools, the file format list, the skip link",
  ],
  ["ink-dark", "light-100", "the hover face of those"],
  ["ink-dark", "light-300", "the pressed face of those"],
  [
    "ink-disabled",
    "light-200",
    "disabled buttons: Undo with nothing to undo, Show tips with no file, the pack buttons while a pack is read",
  ],
  ["ink", "tag-neutral", "the renderer tag in the mobile top bar"],
  ["ink", "panel-hi", "the close icon of a sheet and of the quick-start card while it is pressed"],
  ["ink", "surface-raised", "a block list entry under the pointer or the focus, in the palette"],
  ["ink-dark", "tag-primary", "the star of a favourite on a chip of the hotbar"],
  ["field-shade", "light-400", "the O of a switch that is off (Block state, mobile)"],
  [
    "ink-placeholder",
    "surface-page",
    "the placeholder of a text field (block, property, value, coordinates)",
  ],
  // The Editor group (the `.ore-editor` scope): sunken wells, dark buttons, the axis badges.
  ["ink", "surface-sunken", "the palette list and the number fields of the editor panels"],
  ["ink-muted", "surface-sunken", "the block counts and hints inside the sunken wells"],
  ["ink-faint", "surface-sunken", "the placeholder of the palette search (editor search field)"],
  [
    "ink",
    "surface-raised",
    "the hovered entry of the palette list, the raised faces of the editor",
  ],
  ["axis-x", "surface-sunken", "the X letter of a coordinate field's axis badge"],
  ["axis-y", "surface-sunken", "the Y letter of a coordinate field's axis badge"],
  ["axis-z", "surface-sunken", "the Z letter of a coordinate field's axis badge"],
];

describe("colour contrast", () => {
  for (const [fg, bg, where] of PAIRS) {
    it(`${fg} on ${bg} (${where}) is at least 4.5:1`, () => {
      expect(contrast(color(fg), color(bg))).toBeGreaterThanOrEqual(4.5);
    });
  }

  // The ring around a focused control is drawn on the page or on a panel.
  for (const bg of ["surface-page", "surface-panel", "surface-sunken"]) {
    it(`the focus ring against ${bg} (the picture, links, the skip link, every ore-* control) is at least 3:1`, () => {
      expect(contrast(color("focus"), color(bg))).toBeGreaterThanOrEqual(3);
    });
  }

  for (const bg of ["surface-page", "surface-sunken"]) {
    it(`the editor accent border against ${bg} (desktop editable picture frame) is at least 3:1`, () => {
      expect(contrast(color("editor-accent"), color(bg))).toBeGreaterThanOrEqual(3);
    });
  }
});

describe("the page colour outside the stylesheets", () => {
  it("the 3D view's background is the surface-page token, for both renderers", () => {
    expect(`#${VIEW_BACKGROUND.toString(16).padStart(6, "0")}`).toBe(color("surface-page"));
  });

  it("the theme-color of app.html is the surface-page token", () => {
    const meta = read("../src/app.html").match(/<meta name="theme-color" content="([^"]+)"/);
    expect(meta?.[1]).toBe(color("surface-page"));
  });
});
