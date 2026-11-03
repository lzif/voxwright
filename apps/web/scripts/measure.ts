// SPDX-License-Identifier: AGPL-3.0-only

// Node-side measurements for the viewer, on a generated 256-wide build:
// generating, writing and parsing it, and meshing every section in one thread.
// The browser-side numbers (first frame, frame rate, re-mesh after an edit)
// come from `test/perf.ts`.
//
//   node scripts/measure.ts [--size 256] [--height 64] [--assets <assets/minecraft>] [--out file.schem]
//
// Without --assets it looks where `mcbuild assets fetch` puts them, as the render tests do.

import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { readSchem, writeSchem } from "@voxwright/core";
import {
  buildAtlas,
  parseSectionKey,
  SectionMesher,
  SectionStore,
  sectionKeysAround,
} from "@voxwright/render";
import { directoryAssets } from "@voxwright/render/node";
import { generateTerrain } from "./synthetic.ts";

const { values } = parseArgs({
  options: {
    size: { type: "string" },
    height: { type: "string" },
    assets: { type: "string" },
    out: { type: "string" },
  },
});
const size = Number(values.size ?? 256);
const height = Number(values.height ?? 64);
const root =
  values.assets ??
  process.env.VOXWRIGHT_ASSETS ??
  join(homedir(), ".cache/mcbuilder/26.2/client/assets/minecraft");

const ms = (t: number): string => `${(performance.now() - t).toFixed(1)} ms`;
const quantile = (sorted: number[], p: number): number =>
  sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] as number;

let t = performance.now();
const volume = generateTerrain({ size, height });
console.log(
  `generate ${size}x${height}x${size}: ${ms(t)} (${volume.size} cells, ${volume.palette.length} palette entries)`,
);

t = performance.now();
const { bytes } = await writeSchem(volume, { dataVersion: 4903, version: 3 });
console.log(`write .schem: ${ms(t)} (${(bytes.length / 1e6).toFixed(2)} MB gzipped)`);
if (values.out) writeFileSync(values.out, bytes);

t = performance.now();
const parsed = await readSchem(bytes, { keepAir: true });
console.log(`parse .schem: ${ms(t)}`);

if (!existsSync(join(root, "blockstates"))) {
  console.log(`no assets under ${root}: skipping the meshing measurement`);
  process.exit(0);
}
const assets = directoryAssets(root);
const ids: string[] = [];
const walk = (rel: string): void => {
  const dir = join(root, "textures", rel);
  if (!existsSync(dir)) return;
  for (const n of readdirSync(dir).sort()) {
    if (statSync(join(dir, n)).isDirectory()) walk(`${rel}/${n}`);
    else if (n.endsWith(".png")) ids.push(`${rel}/${n.slice(0, -4)}`);
  }
};
for (const d of ["block", "entity/chest", "entity/banner"]) walk(d);
t = performance.now();
const atlas = buildAtlas(ids, assets);
console.log(
  `atlas: ${ms(t)} (${Object.keys(atlas.entries).length} textures, ${atlas.width}x${atlas.height})`,
);

t = performance.now();
const store = new SectionStore(parsed.volume);
const keys = store.keys();
console.log(`snapshot into the section store: ${ms(t)} (${keys.length} sections with blocks)`);

const mesher = new SectionMesher({ assets, atlas });
mesher.extendPalette(parsed.volume.palette);
const run = (): { times: number[]; quads: number } => {
  const times: number[] = [];
  let quads = 0;
  for (const key of keys) {
    const [sx, sy, sz] = parseSectionKey(key);
    const padded = store.padded(sx, sy, sz);
    const t0 = performance.now();
    quads += mesher.mesh(padded).quads;
    times.push(performance.now() - t0);
  }
  return { times, quads };
};
const cold = run(); // fills the per-block caches
const warm = run();
for (const [label, r] of [
  ["cold (first pass, caches filling)", cold],
  ["warm (second pass)", warm],
] as const) {
  const s = [...r.times].sort((a, b) => a - b);
  const total = r.times.reduce((a, b) => a + b, 0);
  console.log(
    `mesh per section, ${label}: median ${quantile(s, 0.5).toFixed(2)} ms, p95 ${quantile(s, 0.95).toFixed(2)} ms, max ${(s[s.length - 1] as number).toFixed(1)} ms; total ${total.toFixed(0)} ms for ${keys.length} sections, ${r.quads} quads`,
  );
}

// One edited block: the store re-reads the sections it touches, and each is meshed again.
const edits: number[] = [];
const counts: number[] = [];
const spots: [number, number, number][] = [
  [100, 40, 100],
  [130, 40, 70],
  [15, 40, 15], // on a section corner, so eight sections depend on it
  [16, 40, 16],
  [200, 40, 200],
  [31, 40, 160],
];
for (const [x, , z] of spots) {
  let y = height - 1;
  while (y > 0 && (parsed.volume.get(x, y, z) ?? "minecraft:air") === "minecraft:air") y--;
  const t0 = performance.now();
  parsed.volume.set(x, y, z, "minecraft:glowstone");
  const touched = sectionKeysAround(x, y, z);
  mesher.extendPalette(parsed.volume.palette.slice(mesher.palette.length)); // a new block kind
  for (const key of touched) {
    store.refresh(key);
    const [sx, sy, sz] = parseSectionKey(key);
    mesher.mesh(store.padded(sx, sy, sz));
  }
  edits.push(performance.now() - t0);
  counts.push(touched.length);
}
console.log(
  `re-mesh after editing one block (refresh + extract + mesh, one thread): ${edits.map((e, i) => `${e.toFixed(2)} ms (${counts[i]} section${counts[i] === 1 ? "" : "s"})`).join(", ")}`,
);
