// SPDX-License-Identifier: AGPL-3.0-only

// Build the skill CLI: bundle packages/mcbuilder/src/node/skill/main.ts and
// everything it imports into the single file skills/voxwright/scripts/voxwright-cli.mjs.
//
//   node scripts/build-skill.ts          write the bundle
//   node scripts/build-skill.ts --check  fail when the committed bundle is stale
//
// The bundle is committed: `npx skills install` copies skills/voxwright/ without
// installing or building anything, so the CLI has to run with Node alone.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const ENTRY = "packages/mcbuilder/src/node/skill/main.ts";
const OUT = "skills/voxwright/scripts/voxwright-cli.mjs";
/** Browser-only or image code that the CLI must never carry. */
const FORBIDDEN = [/(^|\/)node_modules\/(three|pngjs)\//, /^packages\/render\/src\/webgl\//];

interface ThirdParty {
  name: string;
  version: string;
  license: string;
  text: string;
}

/** The npm package an input file belongs to, or `null` for the repository's own code. */
function packageDirOf(input: string): string | null {
  const parts = input.split("/");
  const at = parts.lastIndexOf("node_modules");
  if (at === -1) return null;
  const scoped = parts[at + 1]?.startsWith("@") ?? false;
  return parts.slice(0, at + (scoped ? 3 : 2)).join("/");
}

async function describe(dir: string): Promise<ThirdParty> {
  const pkg = JSON.parse(await readFile(join(root, dir, "package.json"), "utf8")) as {
    name: string;
    version: string;
    license?: string;
  };
  let text = "";
  for (const file of ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "license"]) {
    try {
      text = (await readFile(join(root, dir, file), "utf8")).trim();
      break;
    } catch {}
  }
  if (text === "") throw new Error(`${pkg.name} is bundled but has no licence file in ${dir}`);
  return { name: pkg.name, version: pkg.version, license: pkg.license ?? "see text", text };
}

async function bundle(): Promise<string> {
  const version = (
    JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { version: string }
  ).version;
  const result = await build({
    absWorkingDir: root,
    entryPoints: [ENTRY],
    outfile: OUT,
    bundle: true,
    write: false,
    metafile: true,
    platform: "node",
    format: "esm",
    target: "node22",
    charset: "utf8",
    legalComments: "none",
    treeShaking: true,
    define: { __VOXWRIGHT_BUNDLED__: "true", __VOXWRIGHT_VERSION__: JSON.stringify(version) },
    logLevel: "warning",
  });
  // Only what survived tree shaking: a module that contributes no bytes is not in the file.
  const inputs = Object.entries(result.metafile.outputs[OUT]?.inputs ?? {})
    .filter(([, use]) => use.bytesInOutput > 0)
    .map(([p]) => p.split(sep).join("/"));
  if (inputs.length === 0) throw new Error("esbuild reported no inputs for the bundle");
  for (const input of inputs) {
    if (FORBIDDEN.some((re) => re.test(input))) {
      throw new Error(`${input} ended up in the skill bundle; it must stay out`);
    }
  }
  const dirs = [...new Set(inputs.map(packageDirOf).filter((d): d is string => d !== null))].sort();
  const thirdParty = await Promise.all(dirs.map(describe));

  const header = [
    "#!/usr/bin/env node",
    "// SPDX-License-Identifier: AGPL-3.0-only",
    "//",
    "// GENERATED FILE. Do not edit: change the sources and run `pnpm build:skill`.",
    `// The Voxwright skill CLI, bundled from ${ENTRY}`,
    "// (packages/mcbuilder and packages/core). It needs Node 22.18 or later and nothing else.",
    "//",
    thirdParty.length === 0
      ? "// No third-party code is bundled."
      : "// Third-party code bundled in this file, with its licence:",
  ];
  for (const p of thirdParty) {
    header.push("//", `// ${p.name} ${p.version} (${p.license})`, "//");
    for (const line of p.text.split(/\r?\n/)) header.push(line === "" ? "//" : `//   ${line}`);
  }
  const code = result.outputFiles[0]?.text;
  if (code === undefined) throw new Error("esbuild produced no output");
  return `${header.join("\n")}\n\n${code}`;
}

const check = process.argv.includes("--check");
const text = await bundle();
const outPath = join(root, OUT);
const shown = relative(process.cwd(), outPath) || OUT;
if (check) {
  const current = await readFile(outPath, "utf8").catch(() => null);
  if (current !== text) {
    console.error(
      `${shown} is ${current === null ? "missing" : "stale"}: run \`pnpm build:skill\` and commit the result`,
    );
    process.exit(1);
  }
  console.log(`${shown} is up to date`);
} else {
  await writeFile(outPath, text);
  console.log(
    `wrote ${shown} (${(Buffer.byteLength(text) / 1024).toFixed(0)} kB) to ${dirname(shown)}/`,
  );
}
