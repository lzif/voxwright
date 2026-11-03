// SPDX-License-Identifier: AGPL-3.0-only

// A small resource pack made up for the tests: a couple of blockstates, models and textures that we
// draw ourselves (plain colours). It stands in for a pack or client jar a user brings; no Mojang asset
// is involved. Node only (zlib for PNG, fflate for the zip).

import { deflateSync } from "node:zlib";
import { zipSync } from "fflate";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 255] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** A solid-colour PNG, `size` wide and `height` tall (a taller one is a strip of animation frames). */
export function solidPng(r: number, g: number, b: number, size = 16, height = size): Uint8Array {
  const rows = new Uint8Array(height * (1 + size * 4));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + size * 4);
    for (let x = 0; x < size; x++) rows.set([r, g, b, 255], row + 1 + x * 4);
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, size);
  view.setUint32(4, height);
  header.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA
  const parts = [
    Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const text = (v: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(v));

const FACES = ["down", "up", "north", "south", "west", "east"];
const cube = (texture: string): unknown => ({
  textures: { all: texture },
  elements: [
    {
      from: [0, 0, 0],
      to: [16, 16, 16],
      faces: Object.fromEntries(FACES.map((f) => [f, { texture: "#all", cullface: f }])),
    },
  ],
});

/** Colours of the made-up blocks, so tests can look for them in the picture. */
export const PACK_COLORS = { stone: [255, 0, 0], dirt: [0, 0, 255] } as const;

/** File names (as in a zip, under `assets/minecraft/`) to bytes. */
export function syntheticPackFiles(prefix = ""): Record<string, Uint8Array> {
  const root = `${prefix}assets/minecraft/`;
  const [sr, sg, sb] = PACK_COLORS.stone;
  const [dr, dg, db] = PACK_COLORS.dirt;
  return {
    [`${prefix}pack.mcmeta`]: text({
      pack: { pack_format: 1, description: "voxwright test pack" },
    }),
    [`${root}blockstates/stone.json`]: text({ variants: { "": { model: "block/stone" } } }),
    [`${root}blockstates/dirt.json`]: text({ variants: { "": { model: "block/dirt" } } }),
    [`${root}models/block/stone.json`]: text(cube("block/stone")),
    [`${root}models/block/dirt.json`]: text(cube("block/dirt")),
    [`${root}textures/block/stone.png`]: solidPng(sr, sg, sb),
    [`${root}textures/block/dirt.png`]: solidPng(dr, dg, db),
    // An animated texture: a strip of two frames and the .mcmeta that says so.
    [`${root}textures/block/shimmer.png`]: solidPng(0, 255, 0, 16, 32),
    [`${root}textures/block/shimmer.png.mcmeta`]: text({ animation: { frametime: 4 } }),
    // Files the viewer does not read.
    [`${root}lang/en_us.json`]: text({ "block.minecraft.stone": "Stone" }),
    [`${root}textures/gui/icons.png`]: solidPng(1, 2, 3),
    // A file named like a model but not JSON.
    [`${root}models/block/broken.json`]: new TextEncoder().encode("{ not json"),
  };
}

/** The pack as a zip. `prefix` (such as `"MyPack/"`) mimics zipping a folder instead of its contents. */
export function syntheticPackZip(prefix = ""): Uint8Array {
  return zipSync(syntheticPackFiles(prefix));
}
