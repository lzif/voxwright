// SPDX-License-Identifier: AGPL-3.0-only

// List every production dependency of apps/web, with the licence its package.json declares, and fail
// if one is not on the AGPL-compatible allowlist. Reads node_modules only; no network.
//
//   node scripts/licenses.ts [--json]
//
// "Production" means what ships in the site: the app's `dependencies`, theirs in turn (and their
// optional dependencies), plus the runtime code of the build tools that is bundled into the page
// (see BUNDLED). Test tools, the bundler and the linters are not shipped and are not checked.

import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

/**
 * Licences whose code may be combined into an AGPL-3.0-only work (one way: the combination is
 * AGPL-3.0). SPDX identifiers. The list follows the FSF's compatibility notes for GPLv3.
 */
export const ALLOWED = new Set([
  "AGPL-3.0-only",
  "AGPL-3.0-or-later",
  "GPL-3.0-only",
  "GPL-3.0-or-later",
  "LGPL-3.0-only",
  "LGPL-3.0-or-later",
  "LGPL-2.1-or-later",
  "Apache-2.0",
  "MPL-2.0",
  "MIT",
  "MIT-0",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "Zlib",
  "Unlicense",
  "CC0-1.0",
  "BlueOak-1.0.0",
  "Python-2.0",
]);

/**
 * Build tools that are devDependencies of apps/web but whose runtime code is bundled into the
 * page, so they ship with it.
 */
const BUNDLED = ["svelte", "@sveltejs/kit"];

interface Pkg {
  name: string;
  version: string;
  license?: unknown;
  licenses?: unknown;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const readJson = (path: string): Pkg => JSON.parse(readFileSync(path, "utf8")) as Pkg;

/** Find `name` the way Node would from `from`: the nearest enclosing node_modules that has it. */
function resolvePackage(name: string, from: string): string | null {
  let dir = from;
  for (;;) {
    const candidate = join(dir, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return realpathSync(candidate);
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** The declared licence as one SPDX expression, or `null` when package.json has none. */
export function declaredLicense(pkg: Pkg): string | null {
  const one = (v: unknown): string | null =>
    typeof v === "string"
      ? v
      : v && typeof (v as { type?: unknown }).type === "string"
        ? (v as { type: string }).type
        : null;
  const direct = one(pkg.license);
  if (direct) return direct;
  if (Array.isArray(pkg.licenses)) {
    const all = pkg.licenses.map(one).filter((x): x is string => x !== null);
    if (all.length) return all.join(" OR ");
  }
  return null;
}

/** Guess an SPDX id from a LICENSE file when package.json names none. Returns null if unsure. */
function sniffLicenseFile(dir: string): string | null {
  const file = readdirSync(dir).find((f) => /^(licen[sc]e|copying)(\.|$)/i.test(f));
  if (!file) return null;
  const text = readFileSync(join(dir, file), "utf8");
  if (/Permission is hereby granted, free of charge/i.test(text)) return "MIT";
  if (/Apache License\s+Version 2\.0/i.test(text)) return "Apache-2.0";
  if (/Permission to use, copy, modify, and\/or distribute this software/i.test(text)) return "ISC";
  return null;
}

/**
 * Is every part of an SPDX expression allowed? `A OR B` needs one side, `A AND B` both, `X WITH
 * exception` is judged by X, and `X+` by X's "or later" form.
 */
export function allowed(expression: string): boolean {
  const tokens = expression.match(/\(|\)|[^\s()]+/g) ?? [];
  let i = 0;
  const atom = (): boolean => {
    const tok = tokens[i++];
    if (tok === undefined) return false;
    if (tok === "(") {
      const v = or();
      i++; // ")"
      return v;
    }
    let id = tok.replace(/\+$/, "");
    if (/^(GPL|LGPL|AGPL)-[\d.]+$/.test(id)) id += tok.endsWith("+") ? "-or-later" : "-only";
    if (tokens[i]?.toUpperCase() === "WITH") i += 2;
    return ALLOWED.has(id);
  };
  const and = (): boolean => {
    let v = atom();
    while (tokens[i]?.toUpperCase() === "AND") {
      i++;
      const r = atom();
      v = v && r;
    }
    return v;
  };
  const or = (): boolean => {
    let v = and();
    while (tokens[i]?.toUpperCase() === "OR") {
      i++;
      const r = and();
      v = v || r;
    }
    return v;
  };
  return or();
}

export interface Row {
  name: string;
  version: string;
  license: string;
  source: "package.json" | "LICENSE file" | "none";
  ok: boolean;
  /** Why this package is here: the chain from apps/web. */
  via: string;
}

/** Walk the production dependency tree of the app at `appDir`. */
export function collect(appDir: string): Row[] {
  const rows = new Map<string, Row>();
  const visit = (name: string, dir: string, via: string): void => {
    const real = resolvePackage(name, dir);
    if (real === null) throw new Error(`cannot find ${name} (needed by ${via}); run pnpm install`);
    const pkg = readJson(join(real, "package.json"));
    const key = `${pkg.name}@${pkg.version}`;
    if (rows.has(key)) return;
    let license = declaredLicense(pkg);
    let source: Row["source"] = "package.json";
    if (license === null) {
      license = sniffLicenseFile(real);
      source = license === null ? "none" : "LICENSE file";
    }
    rows.set(key, {
      name: pkg.name,
      version: pkg.version,
      license: license ?? "UNKNOWN",
      source,
      ok: license !== null && allowed(license),
      via,
    });
    const deps = { ...pkg.dependencies, ...pkg.optionalDependencies };
    for (const dep of Object.keys(deps)) {
      const found = resolvePackage(dep, real);
      if (found === null && pkg.optionalDependencies && dep in pkg.optionalDependencies) continue;
      visit(dep, real, `${via} > ${pkg.name}`);
    }
  };
  const app = readJson(join(appDir, "package.json"));
  for (const dep of Object.keys(app.dependencies ?? {})) visit(dep, appDir, "apps/web");
  for (const dep of BUNDLED)
    if (app.devDependencies?.[dep]) visit(dep, appDir, "apps/web (bundled)");
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function main(): void {
  const { values } = parseArgs({ options: { json: { type: "boolean" } } });
  const appDir = new URL("../apps/web/", import.meta.url).pathname;
  const rows = collect(appDir);
  if (values.json) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    const w = Math.max(...rows.map((r) => `${r.name}@${r.version}`.length));
    for (const r of rows)
      console.log(
        `${r.ok ? "ok  " : "FAIL"}  ${`${r.name}@${r.version}`.padEnd(w)}  ${r.license}${
          r.source === "package.json" ? "" : ` (${r.source})`
        }`,
      );
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.license, (counts.get(r.license) ?? 0) + 1);
    console.log(
      `\n${rows.length} production dependencies of apps/web: ${[...counts]
        .sort((a, b) => b[1] - a[1])
        .map(([l, n]) => `${n} ${l}`)
        .join(", ")}`,
    );
  }
  const bad = rows.filter((r) => !r.ok);
  if (bad.length > 0) {
    console.error(
      `\n${bad.length} not on the AGPL-compatible allowlist:\n${bad
        .map((r) => `  ${r.name}@${r.version}: ${r.license} (via ${r.via})`)
        .join("\n")}`,
    );
    process.exit(1);
  }
  if (!values.json) console.log("all licences are on the AGPL-compatible allowlist");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
