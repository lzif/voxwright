// SPDX-License-Identifier: AGPL-3.0-only

// Build the asset pack the viewer loads: the blockstates, block models and
// block textures it needs, in one JSON file, from vanilla client assets that
// `mcbuild assets fetch` has already extracted.
//
//   node scripts/build-pack.ts [--from <assets/minecraft>] [--out static/pack/pack.json]
//
// The assets are Mojang's. They are never committed: the pack is built on your
// machine, for your own deployment, and is git-ignored.

import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { parseArgs } from "node:util";
import { buildPack, isWanted } from "../src/lib/pack-extract.ts";

const { values } = parseArgs({ options: { from: { type: "string" }, out: { type: "string" } } });
const root = values.from ?? join(homedir(), ".cache/mcbuilder/26.2/client/assets/minecraft");
const out = values.out ?? new URL("../static/pack/pack.json", import.meta.url).pathname;

async function walk(dir: string): Promise<string[]> {
  const names = await readdir(dir).catch(() => []);
  const files: string[] = [];
  for (const n of names.sort()) {
    const p = join(dir, n);
    if ((await stat(p)).isDirectory()) files.push(...(await walk(p)));
    else files.push(p);
  }
  return files;
}

if (!(await stat(join(root, "blockstates")).catch(() => null))) {
  console.error(`no blockstates under ${root}: run \`mcbuild assets fetch --version 26.2\` first`);
  process.exit(1);
}

// The same extraction runs in the browser on a pack the user brings (src/lib/pack-extract.ts).
const files = new Map<string, Uint8Array>();
for (const sub of ["blockstates", "models/block", "textures/block", "textures/entity"]) {
  for (const f of await walk(join(root, sub))) {
    const path = relative(root, f).split(sep).join("/");
    if (isWanted(path)) files.set(path, await readFile(f));
  }
}
const { pack, skipped } = buildPack(files);
for (const p of skipped) console.warn(`skipped ${p}: not valid JSON`);

await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(pack));
const size = (await stat(out)).size;
console.log(
  `wrote ${out}: ${Object.keys(pack.json).length} json files, ${Object.keys(pack.textures).length} textures, ${(size / 1e6).toFixed(1)} MB`,
);
