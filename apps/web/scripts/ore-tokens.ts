// SPDX-License-Identifier: AGPL-3.0-only

// Generate src/lib/ore-ui/tokens.css from src/lib/ore-ui/tokens.json, the token file of Luki's
// "Ore UI Study" design system. tokens.json is the source: edit it, then run
//
//   node scripts/ore-tokens.ts           (from apps/web)
//   node apps/web/scripts/ore-tokens.ts  (from the repository root)
//   node scripts/ore-tokens.ts --check   (exit 1 if tokens.css is not what tokens.json gives)
//
// The output has the @font-face rules, one :root block with a custom property per token, named as
// ore-ui.css reads them, and a class per type style. `test/ore-tokens.test.ts` regenerates it and
// compares, so the two files cannot drift.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface ColorToken {
  name: string;
  value: Record<string, string>;
  usage: string;
}
export interface FontFile {
  family: string;
  file: string;
  weight: string;
  style: string;
}
export interface TypeStyle {
  name: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  usage: string;
}
export interface PlainToken {
  name: string;
  value: string;
  usage: string;
}
export interface OreTokens {
  name: string;
  version: number;
  color: { themes: { id: string; name: string }[]; tokens: ColorToken[] };
  type: {
    fonts: FontFile[];
    families: Record<string, string>;
    groups: { name: string; family: string; styles: TypeStyle[] }[];
  };
  spacing: { tokens: PlainToken[] };
  radius: { tokens: PlainToken[] };
  shadow: { tokens: PlainToken[] };
}

/**
 * Where the fonts are served from, relative to the stylesheet. `fonts/` lives in `static/`, which
 * SvelteKit publishes at the root of the site. Vite sees the root-relative form, finds the file in
 * `static/` and rewrites it for the build, so it follows `VOXWRIGHT_BASE_PATH`; see
 * docs/design-system.md.
 */
export const FONT_URL_PREFIX = "/";

export const TOKENS_JSON = new URL("../src/lib/ore-ui/tokens.json", import.meta.url);
export const TOKENS_CSS = new URL("../src/lib/ore-ui/tokens.css", import.meta.url);

const NAME = /^[a-z][a-z0-9-]*$/;
const REFERENCE = /\{([^{}]*)\}/g;

function assertName(name: string, what: string): void {
  if (!NAME.test(name)) throw new Error(`${what} '${name}' is not a lower-case CSS name`);
}

/** The one theme the stylesheet is generated for. */
function themeId(tokens: OreTokens): string {
  const [theme, ...more] = tokens.color.themes;
  if (!theme || more.length > 0) {
    throw new Error(
      "tokens.json must have exactly one colour theme: the generator writes one :root",
    );
  }
  return theme.id;
}

/** `#rrggbb` for every colour token, with `{reference}` values followed to the colour they name. */
export function resolveColors(tokens: OreTokens): Map<string, string> {
  const theme = themeId(tokens);
  const raw = new Map<string, string>();
  for (const t of tokens.color.tokens) {
    assertName(t.name, "colour token");
    if (raw.has(t.name)) throw new Error(`colour token '${t.name}' is defined twice`);
    const value = t.value[theme];
    if (value === undefined) throw new Error(`colour token '${t.name}' has no '${theme}' value`);
    raw.set(t.name, value);
  }
  const resolved = new Map<string, string>();
  for (const name of raw.keys()) {
    let value = raw.get(name) as string;
    const seen = new Set([name]);
    for (let ref = /^\{([^{}]*)\}$/.exec(value); ref; ref = /^\{([^{}]*)\}$/.exec(value)) {
      const target = ref[1] as string;
      if (seen.has(target)) throw new Error(`colour token '${name}' refers to itself`);
      seen.add(target);
      const next = raw.get(target);
      if (next === undefined)
        throw new Error(`colour token '${name}' refers to unknown '${target}'`);
      value = next;
    }
    if (!/^#[0-9a-f]{6}$/i.test(value))
      throw new Error(`colour token '${name}' is '${value}', not #rrggbb`);
    resolved.set(name, value.toLowerCase());
  }
  return resolved;
}

/** `{outline}` becomes `var(--outline)`, so a token that names another one keeps following it. */
function cssValue(value: string, known: Set<string>, owner: string): string {
  return value.replace(REFERENCE, (_, name: string) => {
    if (!known.has(name)) throw new Error(`token '${owner}' refers to unknown '${name}'`);
    return `var(--${name})`;
  });
}

function fontFaces(tokens: OreTokens): string[] {
  return tokens.type.fonts.map((f) => {
    if (!/^fonts\/[A-Za-z0-9-]+\.woff2$/.test(f.file)) {
      throw new Error(`font file '${f.file}' must be fonts/<name>.woff2`);
    }
    return [
      "@font-face {",
      `  font-family: "${f.family}";`,
      `  font-style: ${f.style};`,
      `  font-weight: ${f.weight};`,
      "  font-display: swap;",
      `  src: url("${FONT_URL_PREFIX}${f.file}") format("woff2");`,
      "}",
    ].join("\n");
  });
}

/** The stylesheet for `tokens`, as text. */
export function generateTokensCss(tokens: OreTokens): string {
  resolveColors(tokens); // checks every colour and reference before anything is written
  const known = new Set<string>([
    ...tokens.color.tokens.map((t) => t.name),
    ...tokens.spacing.tokens.map((t) => t.name),
    ...tokens.radius.tokens.map((t) => t.name),
    ...tokens.shadow.tokens.map((t) => t.name),
  ]);
  const theme = themeId(tokens);
  const decls: string[] = [];
  const section = (title: string): void => {
    if (decls.length > 0) decls.push("");
    decls.push(`  /* ${title} */`);
  };

  section(`Colour, theme '${theme}'`);
  for (const t of tokens.color.tokens) {
    decls.push(`  --${t.name}: ${cssValue(t.value[theme] as string, known, t.name)};`);
  }

  section("Font families");
  for (const [key, stack] of Object.entries(tokens.type.families)) {
    assertName(key, "font family");
    decls.push(`  --font-${key}: ${stack};`);
  }

  section("Type styles");
  for (const group of tokens.type.groups) {
    if (!(group.family in tokens.type.families)) {
      throw new Error(`type group '${group.name}' uses unknown family '${group.family}'`);
    }
    for (const s of group.styles) {
      assertName(s.name, "type style");
      decls.push(
        `  --type-${s.name}-family: var(--font-${group.family});`,
        `  --type-${s.name}-size: ${s.fontSize};`,
        `  --type-${s.name}-line: ${s.lineHeight};`,
        `  --type-${s.name}-weight: ${s.fontWeight};`,
      );
    }
  }

  section("Spacing, one design unit is 2px");
  for (const t of tokens.spacing.tokens) {
    assertName(t.name, "spacing token");
    decls.push(`  --${t.name}: ${t.value};`);
  }

  section("Radius");
  for (const t of tokens.radius.tokens) {
    assertName(t.name, "radius token");
    decls.push(`  --${t.name}: ${t.value};`);
  }

  section("Shadow");
  for (const t of tokens.shadow.tokens) {
    assertName(t.name, "shadow token");
    decls.push(`  --${t.name}: ${cssValue(t.value, known, t.name)};`);
  }

  const typeClasses = tokens.type.groups.flatMap((g) =>
    g.styles.map((s) =>
      [
        `.ore-type-${s.name} {`,
        `  font-family: var(--type-${s.name}-family);`,
        `  font-size: var(--type-${s.name}-size);`,
        `  line-height: var(--type-${s.name}-line);`,
        `  font-weight: var(--type-${s.name}-weight);`,
        "}",
      ].join("\n"),
    ),
  );

  const header = [
    `/* ${tokens.name}, version ${tokens.version}: tokens for ore-ui.css.`,
    " *",
    " * GENERATED from tokens.json by `node apps/web/scripts/ore-tokens.ts`. Do not edit by hand:",
    " * change tokens.json (or the script) and run the command again. test/ore-tokens.test.ts fails",
    " * if this file is not what the script writes.",
    " *",
    " * Load this file before ore-ui.css. The custom properties are named as ore-ui.css reads them.",
    " * `.ore-type-<style>` sets the family, size, line height and weight of a type style; the React",
    " * bundle of the design system used the bare names (`label`, `caption`) for these.",
    " */",
  ].join("\n");

  return `${[header, ...fontFaces(tokens), `:root {\n${decls.join("\n")}\n}`, ...typeClasses].join(
    "\n\n",
  )}\n`;
}

function main(): void {
  const tokens = JSON.parse(readFileSync(TOKENS_JSON, "utf8")) as OreTokens;
  const css = generateTokensCss(tokens);
  const path = fileURLToPath(TOKENS_CSS);
  if (process.argv.includes("--check")) {
    if (readFileSync(path, "utf8") !== css) {
      console.error("tokens.css is out of date: run `node apps/web/scripts/ore-tokens.ts`");
      process.exit(1);
    }
    console.log("tokens.css is up to date");
    return;
  }
  writeFileSync(path, css);
  console.log(`wrote ${path}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
