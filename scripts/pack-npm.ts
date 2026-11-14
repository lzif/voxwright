// SPDX-License-Identifier: AGPL-3.0-only

// Assemble the npm package `mcbuild` in dist/npm/mcbuild/: the committed skill
// CLI bundle under the command name `mcbuild`, with the licence files.
//
//   node scripts/pack-npm.ts            fails while the version is still 0.0.0
//   node scripts/pack-npm.ts --dry-run  assembles any version, for CI
//
// The package is the bundle and nothing else: no dependencies, no install
// scripts. Its version is the version of the root package.json, which the
// bundle also prints for `--version`, so the two cannot differ.

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const BUNDLE = "skills/voxwright/scripts/voxwright-cli.mjs";
const OUT = "dist/npm/mcbuild";
const dryRun = process.argv.includes("--dry-run");

const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
  version: string;
  description: string;
  license: string;
};
if (pkg.version === "0.0.0" && !dryRun) {
  console.error("the version in package.json is 0.0.0: set a release version first");
  process.exit(1);
}
const bundle = await readFile(join(root, BUNDLE), "utf8");
if (!bundle.includes(`"${pkg.version}"`)) {
  console.error(`${BUNDLE} was not built for version ${pkg.version}: run \`pnpm build:skill\``);
  process.exit(1);
}

const out = join(root, OUT);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await writeFile(join(out, "mcbuild.mjs"), bundle, { mode: 0o755 });
for (const file of ["LICENSE", "NOTICE"]) await cp(join(root, file), join(out, file));
await cp(join(root, "scripts/npm/README.md"), join(out, "README.md"));
const manifest = {
  name: "mcbuild",
  version: pkg.version,
  description:
    "Build Minecraft structures from a TypeScript recipe and export .schem, .litematic, .nbt or .mcstructure. The command line of Voxwright.",
  keywords: ["minecraft", "schematic", "litematica", "worldedit", "structure", "voxel", "cli"],
  license: pkg.license,
  homepage: "https://github.com/lzif/voxwright#readme",
  repository: { type: "git", url: "git+https://github.com/lzif/voxwright.git" },
  bugs: "https://github.com/lzif/voxwright/issues",
  type: "module",
  bin: { mcbuild: "mcbuild.mjs" },
  exports: "./mcbuild.mjs",
  files: ["mcbuild.mjs", "README.md", "LICENSE", "NOTICE"],
  engines: { node: ">=22.18" },
};
await writeFile(join(out, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${OUT}: mcbuild ${pkg.version}, ${(bundle.length / 1000).toFixed(0)} kB`);
