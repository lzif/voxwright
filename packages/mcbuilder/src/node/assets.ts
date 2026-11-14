// SPDX-License-Identifier: AGPL-3.0-only

// Asset pipeline: fetch a version-pinned block registry and the vanilla
// client assets.
//
// `fetchAssets(version, cacheDir)` downloads into `<cacheDir>/<version>/`:
//
// - `minecraft-data.json`: the block registry, normalized from PrismarineJS
//   minecraft-data's `blocks.json`.
// - `client/`: vanilla textures, block models and blockstates. By default they
//   come from InventivetalentDev/minecraft-assets on GitHub (the files behind
//   https://mcasset.cloud), which holds the client jar already extracted, one
//   branch per version. With the source `mojang` they are extracted from the
//   client jar itself (served by Mojang's Piston).
// - `version.json`: from the jar root, carrying the authoritative DataVersion.
//   Only the `mojang` source has it.
//
// `fetchRegistry(version, cacheDir)` downloads only `minecraft-data.json`.
//
// Nothing Mojang-owned is vendored in this repository: everything is
// downloaded at the user's request. Downloads are idempotent: files that
// already exist are skipped.

import { createHash } from "node:crypto";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { unzipSync } from "fflate";
import { McbuilderError } from "../errors.ts";
import { normalizeBlockData } from "../registry.ts";

export class AssetError extends McbuilderError {}

export const MC_DATA_RAW = "https://raw.githubusercontent.com/PrismarineJS/minecraft-data/master";
export const PISTON_MANIFEST = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
export const MCASSET_RAW = "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets";

/** Where the client assets come from. */
export type AssetSource = "mcasset" | "mojang";
export const ASSET_SOURCES: readonly AssetSource[] = ["mcasset", "mojang"];

/** Only these subtrees are extracted from the client jar. */
export const CLIENT_PREFIXES = [
  "assets/minecraft/textures/block/",
  "assets/minecraft/models/block/",
  "assets/minecraft/blockstates/",
  "assets/minecraft/textures/entity/",
] as const;

export type HttpGet = (url: string) => Promise<{ status: number; body: Uint8Array }>;

/** The one place that talks to the network. Tests replace it. */
export const defaultHttpGet: HttpGet = async (url) => {
  try {
    const res = await fetch(url, { headers: { "user-agent": "voxwright-mcbuilder" } });
    return { status: res.status, body: new Uint8Array(await res.arrayBuffer()) };
  } catch (e) {
    throw new AssetError(
      `network request failed for ${url}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
};

const text = (b: Uint8Array): string => new TextDecoder().decode(b);

function parseJson<T>(b: Uint8Array, what: string): T {
  try {
    return JSON.parse(text(b)) as T;
  } catch (e) {
    throw new AssetError(`could not parse ${what}: ${(e as Error).message}`);
  }
}

const exists = (p: string): Promise<boolean> =>
  stat(p).then(
    () => true,
    () => false,
  );

/** True iff every extracted subtree is present and non-empty. */
async function clientCacheComplete(clientDir: string): Promise<boolean> {
  for (const prefix of CLIENT_PREFIXES) {
    const d = join(clientDir, prefix);
    const entries = await readdir(d).catch(() => []);
    if (entries.length === 0) return false;
  }
  return true;
}

/** Sortable key for ids like `26.2` or `1.21.11`; snapshots sort below their release. */
export function versionKey(version: string): [number[], number] {
  const dash = version.indexOf("-");
  const base = dash === -1 ? version : version.slice(0, dash);
  const suffix = dash === -1 ? "" : version.slice(dash + 1);
  const nums = base.split(".").map((p) => (/^\d+$/.test(p) ? Number(p) : Number.NaN));
  if (nums.length === 0 || nums.some(Number.isNaN))
    throw new AssetError(`cannot parse MC version '${version}'`);
  return [nums, suffix ? 0 : 1];
}

/** Tuple order: numbers lexicographically (a prefix sorts first), then release over snapshot. */
function compareKeys(a: [number[], number], b: [number[], number]): number {
  const n = Math.min(a[0].length, b[0].length);
  for (let i = 0; i < n; i++) {
    if (a[0][i] !== b[0][i]) return (a[0][i] as number) < (b[0][i] as number) ? -1 : 1;
  }
  if (a[0].length !== b[0].length) return a[0].length < b[0].length ? -1 : 1;
  return a[1] - b[1];
}

/** Newest minecraft-data `blocks` layout not newer than `version`, or `null`. */
export function closestPcLayout(
  version: string,
  dataPaths: { pc?: Record<string, { blocks: string }> },
): string | null {
  const pc = dataPaths.pc ?? {};
  const want = versionKey(version);
  let best: string | null = null;
  for (const key of Object.keys(pc)) {
    let k: [number[], number];
    try {
      k = versionKey(key);
    } catch {
      continue;
    }
    if (compareKeys(k, want) <= 0 && (best === null || compareKeys(versionKey(best), k) < 0))
      best = key;
  }
  return best === null ? null : (pc[best] as { blocks: string }).blocks;
}

async function fallbackLayout(version: string, get: HttpGet): Promise<string> {
  const { status, body } = await get(`${MC_DATA_RAW}/data/dataPaths.json`);
  if (status !== 200) {
    throw new AssetError(
      `minecraft-data has no data/pc/${version}/blocks.json (HTTP 404) and dataPaths.json could not be fetched (HTTP ${status}); check the version string or your network connection.`,
    );
  }
  const dataPaths = parseJson<{ pc?: Record<string, { blocks: string }> }>(
    body,
    "minecraft-data dataPaths.json",
  );
  const layout = closestPcLayout(version, dataPaths);
  if (layout === null) {
    let newest: string | null = null;
    for (const key of Object.keys(dataPaths.pc ?? {})) {
      try {
        if (newest === null || compareKeys(versionKey(newest), versionKey(key)) < 0) newest = key;
      } catch {}
    }
    throw new AssetError(
      `version '${version}' is not in PrismarineJS/minecraft-data yet (newest pc layout available: ${newest}); minecraft-data lags new releases: either wait for it to update or fetch with an older \`--version\` and accept the older registry.`,
    );
  }
  return layout;
}

async function downloadRegistry(
  version: string,
  dest: string,
  force: boolean,
  get: HttpGet,
): Promise<void> {
  const target = join(dest, "minecraft-data.json");
  if (!force && (await exists(target))) return;
  let layout = `pc/${version}`;
  let res = await get(`${MC_DATA_RAW}/data/${layout}/blocks.json`);
  if (res.status === 404) {
    layout = await fallbackLayout(version, get);
    res = await get(`${MC_DATA_RAW}/data/${layout}/blocks.json`);
  }
  if (res.status !== 200) {
    throw new AssetError(
      `could not download the block registry for '${version}' (HTTP ${res.status}); check the version string or your network connection.`,
    );
  }
  const raw = parseJson<unknown>(res.body, `the registry payload for '${version}'`);
  let blocks: ReturnType<typeof normalizeBlockData>;
  try {
    blocks = normalizeBlockData(raw);
  } catch (e) {
    throw new AssetError(
      `registry payload for '${version}' had an unexpected shape: ${(e as Error).message}`,
    );
  }
  await writeFile(target, JSON.stringify({ version, layout, blocks }), "utf8");
}

async function safeWrite(root: string, name: string, data: Uint8Array): Promise<void> {
  const resolvedRoot = resolve(root);
  const target = resolve(root, name);
  if (target !== resolvedRoot && !target.startsWith(resolvedRoot + sep)) {
    throw new AssetError(`refusing to extract suspicious zip entry '${name}'`);
  }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, data);
}

async function fetchClient(
  version: string,
  dest: string,
  force: boolean,
  get: HttpGet,
): Promise<void> {
  const clientDir = join(dest, "client");
  if (!force && (await clientCacheComplete(clientDir))) return;

  let res = await get(PISTON_MANIFEST);
  if (res.status !== 200) {
    throw new AssetError(
      `could not reach the Mojang Piston version manifest (HTTP ${res.status}); check your network connection.`,
    );
  }
  const manifest = parseJson<{ versions?: { id: string; url: string }[] }>(
    res.body,
    "the Piston version manifest",
  );
  const entry = (manifest.versions ?? []).find((v) => v.id === version);
  if (entry === undefined) {
    throw new AssetError(
      `version '${version}' not found in Mojang's version manifest: check the version string (Piston uses plain release ids like '26.2' or '1.21.4').`,
    );
  }
  res = await get(entry.url);
  if (res.status !== 200) {
    throw new AssetError(
      `could not fetch the Piston version metadata for '${version}' (HTTP ${res.status}).`,
    );
  }
  let jarUrl: string;
  let sha1: string;
  try {
    const client = (
      JSON.parse(text(res.body)) as { downloads: { client: { url: string; sha1: string } } }
    ).downloads.client;
    jarUrl = client.url;
    sha1 = client.sha1;
    if (typeof jarUrl !== "string" || typeof sha1 !== "string")
      throw new Error("missing url or sha1");
  } catch (e) {
    throw new AssetError(
      `Piston metadata for '${version}' has no usable downloads.client entry: ${(e as Error).message}`,
    );
  }

  const jar = await get(jarUrl);
  if (jar.status !== 200)
    throw new AssetError(
      `could not download the client jar for '${version}' (HTTP ${jar.status}).`,
    );
  if (createHash("sha1").update(jar.body).digest("hex") !== sha1.toLowerCase()) {
    throw new AssetError(
      `client jar for '${version}' failed sha1 verification: the download may be corrupt; delete the cache dir and retry.`,
    );
  }

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(jar.body, {
      filter: (f) =>
        f.name === "version.json" ||
        (CLIENT_PREFIXES.some((p) => f.name.startsWith(p)) && !f.name.endsWith("/")),
    });
  } catch (e) {
    throw new AssetError(
      `downloaded client jar for '${version}' is not a valid zip: ${(e as Error).message}`,
    );
  }
  const members = Object.keys(files).filter((n) => n !== "version.json");
  if (members.length === 0) {
    throw new AssetError(
      `client jar for '${version}' contained none of the expected asset paths (textures/block, models/block, blockstates).`,
    );
  }
  for (const name of members) await safeWrite(clientDir, name, files[name] as Uint8Array);
  // The jar root's version.json carries the authoritative DataVersion
  // ("world_version"). Tolerate jars without it.
  if (files["version.json"]) await safeWrite(dest, "version.json", files["version.json"]);
}

/** GET with one retry: a download of a few thousand small files meets the odd dropped request. */
async function getTwice(get: HttpGet, url: string): Promise<{ status: number; body: Uint8Array }> {
  try {
    const res = await get(url);
    if (res.status < 500 && res.status !== 429) return res;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
  return get(url);
}

/** Run `job` over `items`, at most `limit` at a time. */
async function pool<T>(items: T[], limit: number, job: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) await job(items[next++] as T);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

const MCASSET_PARALLEL = 24;

/**
 * The client assets from InventivetalentDev/minecraft-assets. Every directory there has a
 * `_list.json` (its files and subdirectories), and the JSON directories an `_all.json` with the
 * content of every file, so block states and models are two requests and only the textures are
 * fetched one by one.
 */
async function fetchClientFromMcasset(
  version: string,
  dest: string,
  force: boolean,
  get: HttpGet,
): Promise<void> {
  const clientDir = join(dest, "client");
  if (!force && (await clientCacheComplete(clientDir))) return;
  const base = `${MCASSET_RAW}/${encodeURIComponent(version)}/assets/minecraft`;
  // Everything is collected first and written at the end: a download that stops half way must
  // not leave a cache that looks complete.
  const files = new Map<string, Uint8Array>();

  for (const sub of ["blockstates", "models/block"]) {
    const res = await getTwice(get, `${base}/${sub}/_all.json`);
    if (res.status === 404) {
      throw new AssetError(
        `version '${version}' is not in InventivetalentDev/minecraft-assets (no ${sub}/_all.json on a branch of that name): check the version string, or fetch from Mojang with \`--from mojang\`.`,
      );
    }
    if (res.status !== 200) {
      throw new AssetError(
        `could not download ${sub} for '${version}' from minecraft-assets (HTTP ${res.status}).`,
      );
    }
    const all = parseJson<Record<string, unknown>>(res.body, `${sub}/_all.json for '${version}'`);
    if (all === null || typeof all !== "object" || Array.isArray(all)) {
      throw new AssetError(`${sub}/_all.json for '${version}' had an unexpected shape`);
    }
    for (const [name, value] of Object.entries(all)) {
      files.set(`${sub}/${name}.json`, new TextEncoder().encode(JSON.stringify(value)));
    }
  }

  const textures: string[] = [];
  let dirs = ["textures/block", "textures/entity"];
  while (dirs.length > 0) {
    const found: string[] = [];
    await pool(dirs, MCASSET_PARALLEL, async (dir) => {
      const res = await getTwice(get, `${base}/${dir}/_list.json`);
      if (res.status !== 200) {
        throw new AssetError(
          `could not list ${dir} for '${version}' in minecraft-assets (HTTP ${res.status}).`,
        );
      }
      const list = parseJson<{ directories?: unknown; files?: unknown }>(
        res.body,
        `${dir}/_list.json for '${version}'`,
      );
      for (const d of Array.isArray(list.directories) ? list.directories : []) {
        if (typeof d === "string") found.push(`${dir}/${d}`);
      }
      for (const f of Array.isArray(list.files) ? list.files : []) {
        // The index files of the repository itself are not part of the game's assets.
        if (typeof f === "string" && f !== "_list.json" && f !== "_all.json") {
          textures.push(`${dir}/${f}`);
        }
      }
    });
    dirs = found;
  }
  await pool(textures, MCASSET_PARALLEL, async (path) => {
    const res = await getTwice(get, `${base}/${path.split("/").map(encodeURIComponent).join("/")}`);
    if (res.status !== 200) {
      throw new AssetError(
        `could not download ${path} for '${version}' from minecraft-assets (HTTP ${res.status}).`,
      );
    }
    files.set(path, res.body);
  });

  for (const [path, data] of files) {
    await safeWrite(clientDir, `assets/minecraft/${path}`, data);
  }
}

/**
 * Download only the client assets for `version` (no registry) into `<cacheDir>/<version>/client/`.
 * Skips the download when they are already there, unless `force`.
 */
export async function fetchClientAssets(
  version: string,
  cacheDir: string,
  options: { force?: boolean; get?: HttpGet; source?: AssetSource } = {},
): Promise<string> {
  const dest = join(cacheDir, version);
  await mkdir(dest, { recursive: true });
  const get = options.get ?? defaultHttpGet;
  if ((options.source ?? "mcasset") === "mojang") {
    await fetchClient(version, dest, options.force ?? false, get);
  } else {
    await fetchClientFromMcasset(version, dest, options.force ?? false, get);
  }
  return join(dest, "client");
}

/**
 * Download assets for `version` into `<cacheDir>/<version>/` and return that
 * directory. Skips anything already present unless `force`.
 */
export async function fetchAssets(
  version: string,
  cacheDir: string,
  options: { force?: boolean; get?: HttpGet; source?: AssetSource } = {},
): Promise<string> {
  const dest = join(cacheDir, version);
  await mkdir(dest, { recursive: true });
  const get = options.get ?? defaultHttpGet;
  await downloadRegistry(version, dest, options.force ?? false, get);
  await fetchClientAssets(version, cacheDir, options);
  return dest;
}

/**
 * Download only the block registry for `version` (no client jar) into
 * `<cacheDir>/<version>/minecraft-data.json` and return that file's path.
 * The cache layout is the one `fetchAssets` uses, so a later `fetchAssets`
 * keeps this registry and adds the client assets.
 */
export async function fetchRegistry(
  version: string,
  cacheDir: string,
  options: { force?: boolean; get?: HttpGet } = {},
): Promise<string> {
  const dest = join(cacheDir, version);
  await mkdir(dest, { recursive: true });
  await downloadRegistry(version, dest, options.force ?? false, options.get ?? defaultHttpGet);
  return join(dest, "minecraft-data.json");
}
