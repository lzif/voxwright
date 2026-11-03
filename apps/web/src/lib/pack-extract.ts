// SPDX-License-Identifier: AGPL-3.0-only

// Turn the files of a resource pack or a Minecraft client jar into the one JSON object the viewer
// loads: the blockstates, block models and block textures it needs. This module has no DOM and no
// Node dependency, so `scripts/build-pack.ts` (files on disk) and the browser (a zip the user
// chose) share it. Getting the bytes out of a zip is `pack-zip.ts`.

/** The viewer's pack: JSON by path, textures as base64 PNG by id, and which textures are strips of frames. */
export interface Pack {
  /** Blockstate and model JSON, keyed by the path under `assets/minecraft` (`blockstates/stone.json`). */
  json: Record<string, unknown>;
  /** PNG files in base64, keyed by texture id (`block/stone`). */
  textures: Record<string, string>;
  /** Ids of textures whose `.mcmeta` declares an animation (a vertical strip of frames). */
  animated: string[];
}

const PREFIX = "assets/minecraft/";
const TEXTURE_DIRS = ["textures/block/", "textures/entity/chest/", "textures/entity/banner/"];

/**
 * The path under `assets/minecraft/` of a file in a pack or jar, if the viewer uses that kind of
 * file; otherwise `null`. A zip made by zipping a folder keeps the folder as a prefix, so
 * `MyPack/assets/minecraft/...` counts too.
 */
export function packPath(name: string): string | null {
  const path = name.replaceAll("\\", "/");
  if (path.startsWith("__MACOSX/")) return null; // resource forks Finder adds to a zip
  let start = 0;
  if (!path.startsWith(PREFIX)) {
    const i = path.indexOf(`/${PREFIX}`);
    if (i < 0) return null;
    start = i + 1;
  }
  const rest = path.slice(start + PREFIX.length);
  return isWanted(rest) ? rest : null;
}

/** Does the viewer read this path (relative to `assets/minecraft/`)? */
export function isWanted(rest: string): boolean {
  if (rest.endsWith(".json"))
    return rest.startsWith("blockstates/") || rest.startsWith("models/block/");
  const png = rest.endsWith(".png")
    ? rest
    : rest.endsWith(".png.mcmeta")
      ? rest.slice(0, -7)
      : null;
  return png !== null && TEXTURE_DIRS.some((d) => png.startsWith(d));
}

const CHUNK = 0x8000;

/** Standard base64, without `Buffer`, so it also runs in a browser. */
export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += CHUNK)
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(s);
}

/**
 * Build a pack from files already read. The keys are paths under `assets/minecraft/`
 * (`blockstates/stone.json`, `textures/block/stone.png`, `textures/block/water_still.png.mcmeta`);
 * keys the viewer does not use are ignored. A broken JSON file is skipped and named in `skipped`.
 */
export function buildPack(files: ReadonlyMap<string, Uint8Array>): {
  pack: Pack;
  skipped: string[];
} {
  const text = new TextDecoder();
  const json: Record<string, unknown> = {};
  const textures: Record<string, string> = {};
  const animated: string[] = [];
  const skipped: string[] = [];
  for (const path of [...files.keys()].sort()) {
    if (!isWanted(path)) continue;
    const bytes = files.get(path) as Uint8Array;
    if (path.endsWith(".json")) {
      try {
        json[path] = JSON.parse(text.decode(bytes).replace(/^﻿/, ""));
      } catch {
        skipped.push(path);
      }
    } else if (path.endsWith(".png")) {
      textures[path.slice("textures/".length, -".png".length)] = toBase64(bytes);
    }
  }
  for (const [path, bytes] of files) {
    if (!path.endsWith(".png.mcmeta") || !isWanted(path)) continue;
    const id = path.slice("textures/".length, -".png.mcmeta".length);
    if (!(id in textures)) continue;
    try {
      const meta = JSON.parse(text.decode(bytes).replace(/^﻿/, "")) as { animation?: unknown };
      if (typeof meta.animation === "object" && meta.animation !== null) animated.push(id);
    } catch {
      skipped.push(path);
    }
  }
  animated.sort();
  return { pack: { json, textures, animated }, skipped };
}

/** Counts for a status line. */
export function summarize(pack: Pack): { blockstates: number; models: number; textures: number } {
  let blockstates = 0;
  let models = 0;
  for (const p of Object.keys(pack.json)) {
    if (p.startsWith("blockstates/")) blockstates++;
    else models++;
  }
  return { blockstates, models, textures: Object.keys(pack.textures).length };
}

/**
 * `over` laid on top of `base`, file by file, the way Minecraft stacks resource packs: a pack with
 * only textures keeps the base pack's models, and a texture it supplies replaces the base one.
 */
export function mergePacks(base: Pack | null, over: Pack | null): Pack | null {
  if (base === null) return over;
  if (over === null) return base;
  const overridden = new Set(Object.keys(over.textures));
  return {
    json: { ...base.json, ...over.json },
    textures: { ...base.textures, ...over.textures },
    animated: [
      ...new Set([...base.animated.filter((id) => !overridden.has(id)), ...over.animated]),
    ].sort(),
  };
}
