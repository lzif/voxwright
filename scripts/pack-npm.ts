// SPDX-License-Identifier: AGPL-3.0-only

// Assemble the npm package `voxmc` in dist/npm/voxmc/: the command line, bundled from the package
// sources into one file `voxmc.mjs`, with the licence files. Nothing generated is committed; CI
// runs this on every push (dry run) and `npm.yml` runs it for a release.
//
//   node scripts/pack-npm.ts                  fails while the version is still 0.0.0
//   node scripts/pack-npm.ts --dry-run        assembles any version, for CI
//   node scripts/pack-npm.ts --out <dir>      assemble into <dir> instead of dist/npm/voxmc
//
// The package is that one file and nothing else: no dependencies, no install scripts. Its version
// is the version of the root package.json, which the file also prints for `--version`.

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const ENTRY = "packages/voxmc/src/node/skill/main.ts";
const OUT_FILE = "voxmc.mjs";
/** Browser-only code that the command line must never carry. */
const FORBIDDEN = [/(^|\/)node_modules\/three\//, /^packages\/render\/src\/webgl\//];
const dryRun = process.argv.includes("--dry-run");
const outArg = process.argv.indexOf("--out");
const out =
  outArg === -1 ? join(root, "dist/npm/voxmc") : resolve(process.argv[outArg + 1] ?? "voxmc-pack");

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

/** Bundle the command line from the package sources, third-party licences in the header. */
async function bundle(version: string): Promise<string> {
  const result = await build({
    absWorkingDir: root,
    entryPoints: [ENTRY],
    outfile: OUT_FILE,
    bundle: true,
    write: false,
    metafile: true,
    platform: "node",
    format: "esm",
    target: "node22",
    charset: "utf8",
    legalComments: "none",
    // pngjs is CommonJS and requires Node's built-in modules, which an ES module cannot do
    // without a `require` of its own.
    banner: {
      js: 'import { createRequire as __createRequire } from "node:module";\nconst require = __createRequire(import.meta.url);',
    },
    treeShaking: true,
    define: { __VOXMC_BUNDLED__: "true", __VOXMC_VERSION__: JSON.stringify(version) },
    logLevel: "warning",
  });
  // Only what survived tree shaking: a module that contributes no bytes is not in the file.
  const inputs = Object.entries(result.metafile.outputs[OUT_FILE]?.inputs ?? {})
    .filter(([, use]) => use.bytesInOutput > 0)
    .map(([p]) => p.split(sep).join("/"));
  if (inputs.length === 0) throw new Error("esbuild reported no inputs for the bundle");
  for (const input of inputs) {
    if (FORBIDDEN.some((re) => re.test(input))) {
      throw new Error(`${input} ended up in the command line bundle; it must stay out`);
    }
  }
  const dirs = [...new Set(inputs.map(packageDirOf).filter((d): d is string => d !== null))].sort();
  const thirdParty = await Promise.all(dirs.map(describe));

  const header = [
    "#!/usr/bin/env node",
    "// SPDX-License-Identifier: AGPL-3.0-only",
    "//",
    `// The voxmc command line, bundled from ${ENTRY}`,
    "// (packages/voxmc, packages/core and the software renderer of packages/render).",
    "// It needs Node 22.18 or later and nothing else.",
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

const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
  version: string;
  description: string;
  license: string;
};
if (pkg.version === "0.0.0" && !dryRun) {
  console.error("the version in package.json is 0.0.0: set a release version first");
  process.exit(1);
}
const code = await bundle(pkg.version);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await writeFile(join(out, OUT_FILE), code, { mode: 0o755 });
for (const file of ["LICENSE", "NOTICE"]) await cp(join(root, file), join(out, file));
await cp(join(root, "scripts/npm/README.md"), join(out, "README.md"));
const manifest = {
  name: "voxmc",
  version: pkg.version,
  description:
    "Build Minecraft structures from a TypeScript recipe and export .schem, .litematic, .nbt or .mcstructure. The command line of Voxmc.",
  keywords: ["minecraft", "schematic", "litematica", "worldedit", "structure", "voxel", "cli"],
  license: pkg.license,
  homepage: "https://github.com/lzif/voxmc#readme",
  repository: { type: "git", url: "git+https://github.com/lzif/voxmc.git" },
  bugs: "https://github.com/lzif/voxmc/issues",
  type: "module",
  bin: { voxmc: OUT_FILE },
  exports: `./${OUT_FILE}`,
  files: [OUT_FILE, "README.md", "LICENSE", "NOTICE"],
  engines: { node: ">=22.18" },
  publishConfig: { access: "public" },
};
await writeFile(join(out, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${out}: voxmc ${pkg.version}, ${(code.length / 1000).toFixed(0)} kB`);
