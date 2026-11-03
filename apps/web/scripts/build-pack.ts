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
import { dirname, join, relative } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { from: { type: "string" }, out: { type: "string" } } });
const root = values.from ?? join(homedir(), ".cache/mcbuilder/26.2/client/assets/minecraft");
const out = values.out ?? new URL("../static/pack/pack.json", import.meta.url).pathname;

async function walk(dir: string, ext: string): Promise<string[]> {
  const names = await readdir(dir).catch(() => []);
  const files: string[] = [];
  for (const n of names.sort()) {
    const p = join(dir, n);
    if ((await stat(p)).isDirectory()) files.push(...(await walk(p, ext)));
    else if (n.endsWith(ext)) files.push(p);
  }
  return files;
}

if (!(await stat(join(root, "blockstates")).catch(() => null))) {
  console.error(`no blockstates under ${root}: run \`mcbuild assets fetch --version 26.2\` first`);
  process.exit(1);
}

const json: Record<string, unknown> = {};
for (const sub of ["blockstates", "models/block"]) {
  for (const f of await walk(join(root, sub), ".json"))
    json[relative(root, f)] = JSON.parse(await readFile(f, "utf8"));
}
const textures: Record<string, string> = {};
const animated: string[] = [];
const wanted = [
  join(root, "textures/block"),
  join(root, "textures/entity/chest"),
  join(root, "textures/entity/banner"),
];
for (const dir of wanted) {
  for (const f of await walk(dir, ".png")) {
    const id = relative(join(root, "textures"), f).replace(/\.png$/, "");
    textures[id] = (await readFile(f)).toString("base64");
    const meta = await readFile(`${f}.mcmeta`, "utf8").catch(() => null);
    if (meta && typeof JSON.parse(meta).animation === "object") animated.push(id);
  }
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify({ json, textures, animated }));
const size = (await stat(out)).size;
console.log(
  `wrote ${out}: ${Object.keys(json).length} json files, ${Object.keys(textures).length} textures, ${(size / 1e6).toFixed(1)} MB`,
);
