// SPDX-License-Identifier: AGPL-3.0-only

// The Ore UI Study design system (src/lib/ore-ui): tokens.css must be what scripts/ore-tokens.ts
// writes from tokens.json, ore-ui.css must only read custom properties that exist, and the text
// colours the system sets at rest must meet WCAG AA against the faces they sit on.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateTokensCss, type OreTokens, resolveColors } from "../scripts/ore-tokens.ts";

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");
const tokens = JSON.parse(read("../src/lib/ore-ui/tokens.json")) as OreTokens;
const tokensCss = read("../src/lib/ore-ui/tokens.css");
const oreCss = read("../src/lib/ore-ui/ore-ui.css");

describe("tokens.css", () => {
  it("is exactly what `node scripts/ore-tokens.ts` writes from tokens.json", () => {
    expect(tokensCss).toBe(generateTokensCss(tokens));
  });

  it("defines a custom property for every token, named as the token", () => {
    const defined = new Set([...tokensCss.matchAll(/^ {2}(--[a-z0-9-]+):/gm)].map((m) => m[1]));
    for (const t of [
      ...tokens.color.tokens,
      ...tokens.spacing.tokens,
      ...tokens.radius.tokens,
      ...tokens.shadow.tokens,
    ]) {
      expect(defined.has(`--${t.name}`), `--${t.name}`).toBe(true);
    }
    for (const key of Object.keys(tokens.type.families))
      expect(defined.has(`--font-${key}`)).toBe(true);
    for (const style of tokens.type.groups.flatMap((g) => g.styles)) {
      for (const part of ["family", "size", "line", "weight"]) {
        expect(defined.has(`--type-${style.name}-${part}`), `--type-${style.name}-${part}`).toBe(
          true,
        );
      }
    }
  });

  it("makes a token that names another one follow it", () => {
    expect(tokensCss).toMatch(/^ {2}--ink-dark: var\(--outline\);$/m);
    expect(tokensCss).toMatch(/^ {2}--tag-notice: var\(--yellow\);$/m);
    expect(resolveColors(tokens).get("ink-dark")).toBe(resolveColors(tokens).get("outline"));
  });

  it("loads each font with font-display: swap from a file that ships with its licence", () => {
    const faces = tokensCss.match(/@font-face \{[^}]*\}/g) ?? [];
    expect(faces).toHaveLength(tokens.type.fonts.length);
    for (const face of faces) expect(face).toContain("font-display: swap;");
    for (const font of tokens.type.fonts) {
      expect(existsSync(new URL(`../static/${font.file}`, import.meta.url)), font.file).toBe(true);
      expect(tokensCss).toContain(`url("/${font.file}")`);
    }
    for (const licence of ["PixelifySans-OFL.txt", "NotoSans-OFL.txt"]) {
      expect(existsSync(new URL(`../static/fonts/${licence}`, import.meta.url)), licence).toBe(
        true,
      );
    }
  });
});

describe("ore-ui.css", () => {
  const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");
  const css = stripComments(oreCss);
  const readVars = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1] as string));
  const tokenCssNames = new Set(
    [...stripComments(tokensCss).matchAll(/^ {2}(--[a-z0-9-]+):/gm)].map((m) => m[1] as string),
  );
  // Custom properties the stylesheet sets for itself, per component state (--bf, --bh, ...).
  const local = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1] as string));
  // --p is set inline by the slider's markup (style="--p: 0.4") and read with a fallback of 0.
  const inline = new Set(["--p"]);

  it("reads many properties, so the next test is not vacuous", () => {
    expect(readVars.size).toBeGreaterThan(40);
    expect(readVars.has("--surface-page")).toBe(true);
  });

  it("only reads custom properties that tokens.css defines, that it sets itself or that the markup sets inline", () => {
    const missing = [...readVars].filter(
      (n) => !tokenCssNames.has(n) && !local.has(n) && !inline.has(n),
    );
    expect(missing).toEqual([]);
  });

  it("does not shadow a token with a property of its own", () => {
    expect([...local].filter((n) => tokenCssNames.has(n))).toEqual([]);
  });

  it("reads every colour it needs from the tokens, never a literal hex colour", () => {
    expect(css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });
});

// Same formula as contrast.test.ts (WCAG 2.x relative luminance), copied so that file stays as is.
function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// [text token, background token, where the design system sets it]. Text needs 4.5:1; the focus ring
// is a graphic and needs 3:1.
//
// Not asserted, because they are the source's own pairs and the design system's README lists them
// as known misses (they stay as sampled; the controls also carry a word and a glyph or shape):
//   ink on green-hover        3.1:1  hover face of green controls, white text
//   ink on red-hover          2.4:1  hover face of the destructive button, white text
//   outline on surface-panel  1.85:1, outline on surface-page 1.30:1  control edges
//   light-400 on surface-panel 2.7:1 (an unchecked box), green on surface-panel 2.0:1 (a green face)
const TEXT_PAIRS: [string, string, string][] = [
  ["ink", "surface-page", "screen background, dialog body, text-field face"],
  ["ink", "surface-panel", "panels, rows, dialog header and footer"],
  ["ink-muted", "surface-page", "descriptions and help on the page"],
  ["ink-muted", "surface-panel", "descriptions and help in panels and rows"],
  ["ink", "green", "hero, primary, checked and selected faces"],
  ["ink", "red", "destructive button"],
  ["ink", "blue", "info notice, tooltip"],
  ["ink-dark", "light-200", "secondary button, thumbs"],
  ["ink-dark", "light-100", "hover face of secondary buttons"],
  ["ink-dark", "yellow", "important notice"],
  // Further pairs the token usage notes name; they meet AA too.
  ["ink", "surface-raised", "hover face of an unselected tab"],
  ["ink", "green-pressed", "pressed face of green controls"],
  ["ink", "red-pressed", "pressed destructive button"],
  ["ink-dark", "light-300", "pressed face of secondary buttons"],
  ["ink-disabled", "light-200", "text on disabled light faces"],
  ["ink-placeholder", "surface-page", "placeholder in a text field"],
  ["ink", "tag-neutral", "neutral tag"],
  ["ink-dark", "tag-primary", "primary tag"],
  ["ink-dark", "tag-info", "informative tag"],
  ["ink-dark", "tag-notice", "notice tag"],
  ["ink-dark", "tag-warning", "warning tag"],
  ["ink-dark", "tag-realms", "Realms tag"],
  // The Editor group. `ink-faint` is for disabled and decorative text, so only its use on the sunken
  // well (the search placeholder) is asserted; its 3.87:1 on the page and 2.72:1 on a panel are not.
  ["ink", "surface-sunken", "sunken wells, number fields, the dark button's face"],
  ["ink-muted", "surface-sunken", "hints inside sunken wells"],
  ["ink-faint", "surface-sunken", "placeholder of the editor search field"],
  ["axis-x", "surface-sunken", "X axis badge"],
  ["axis-y", "surface-sunken", "Y axis badge"],
  ["axis-z", "surface-sunken", "Z axis badge"],
];

describe("Ore UI Study colour contrast", () => {
  const colors = resolveColors(tokens);
  const color = (name: string): string => {
    const hex = colors.get(name);
    if (hex === undefined) throw new Error(`no colour token '${name}'`);
    return hex;
  };

  for (const [fg, bg, where] of TEXT_PAIRS) {
    it(`${fg} on ${bg} (${where}) is at least 4.5:1`, () => {
      expect(contrast(color(fg), color(bg))).toBeGreaterThanOrEqual(4.5);
    });
  }

  for (const bg of ["surface-page", "surface-panel", "surface-sunken"]) {
    it(`the focus ring against ${bg} is at least 3:1`, () => {
      expect(contrast(color("focus"), color(bg))).toBeGreaterThanOrEqual(3);
    });
  }
});
