// SPDX-License-Identifier: AGPL-3.0-only
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync } from "fflate";
import { afterAll, describe, expect, it } from "vitest";
import {
  AssetError,
  closestPcLayout,
  fetchAssets,
  type HttpGet,
  versionKey,
} from "../src/node/index.ts";

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const dirs: string[] = [];
const tmp = async (): Promise<string> => {
  const d = await mkdtemp(join(tmpdir(), "voxwright-assets-"));
  dirs.push(d);
  return d;
};
afterAll(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));

const BLOCKS = [
  { name: "stone", states: [] },
  { name: "lever", states: [{ name: "powered", type: "bool" }] },
];
const jar = zipSync({
  "version.json": enc(JSON.stringify({ world_version: 1234 })),
  "assets/minecraft/blockstates/stone.json": enc("{}"),
  "assets/minecraft/models/block/cube.json": enc("{}"),
  "assets/minecraft/textures/block/stone.png": Uint8Array.from([1, 2, 3]),
  "assets/minecraft/textures/entity/chest.png": Uint8Array.from([4]),
  "assets/minecraft/lang/en_us.json": enc("{}"), // not extracted
});
const sha1 = (b: Uint8Array): string => createHash("sha1").update(b).digest("hex");

function fakeNetwork(overrides: Record<string, { status: number; body: Uint8Array }> = {}) {
  const calls: string[] = [];
  const routes: Record<string, { status: number; body: Uint8Array }> = {
    "https://raw.githubusercontent.com/PrismarineJS/minecraft-data/master/data/pc/26.2/blocks.json":
      {
        status: 200,
        body: enc(JSON.stringify(BLOCKS)),
      },
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json": {
      status: 200,
      body: enc(JSON.stringify({ versions: [{ id: "26.2", url: "https://piston/26.2.json" }] })),
    },
    "https://piston/26.2.json": {
      status: 200,
      body: enc(
        JSON.stringify({
          downloads: { client: { url: "https://piston/client.jar", sha1: sha1(jar) } },
        }),
      ),
    },
    "https://piston/client.jar": { status: 200, body: jar },
    ...overrides,
  };
  const get: HttpGet = async (url) => {
    calls.push(url);
    const r = routes[url];
    return r ?? { status: 404, body: enc("not found") };
  };
  return { get, calls };
}

describe("assets fetch", () => {
  it("writes the registry, the client assets and version.json, extracting only wanted paths", async () => {
    const dir = await tmp();
    const net = fakeNetwork();
    const dest = await fetchAssets("26.2", dir, { get: net.get });
    expect(dest).toBe(join(dir, "26.2"));
    const reg = JSON.parse(await readFile(join(dest, "minecraft-data.json"), "utf8"));
    expect(reg.version).toBe("26.2");
    expect(reg.blocks["minecraft:lever"]).toEqual({ properties: { powered: ["true", "false"] } });
    expect(JSON.parse(await readFile(join(dest, "version.json"), "utf8"))).toEqual({
      world_version: 1234,
    });
    expect(
      (await readFile(join(dest, "client/assets/minecraft/textures/block/stone.png"))).length,
    ).toBe(3);
    await expect(stat(join(dest, "client/assets/minecraft/lang/en_us.json"))).rejects.toThrow();
  });

  it("is idempotent, and force downloads again", async () => {
    const dir = await tmp();
    const first = fakeNetwork();
    await fetchAssets("26.2", dir, { get: first.get });
    const again = fakeNetwork();
    await fetchAssets("26.2", dir, { get: again.get });
    expect(again.calls).toEqual([]);
    const forced = fakeNetwork();
    await fetchAssets("26.2", dir, { get: forced.get, force: true });
    expect(forced.calls.length).toBe(4); // registry, manifest, metadata, jar
  });

  it("rejects a corrupt jar, an unknown version and a bad status", async () => {
    const bad = fakeNetwork({
      "https://piston/client.jar": { status: 200, body: Uint8Array.from([...jar].reverse()) },
    });
    await expect(fetchAssets("26.2", await tmp(), { get: bad.get })).rejects.toThrow(/sha1/);
    await expect(fetchAssets("9.9", await tmp(), { get: fakeNetwork().get })).rejects.toThrow(
      AssetError,
    );
    const down = fakeNetwork({
      "https://piston/client.jar": { status: 503, body: new Uint8Array() },
    });
    await expect(fetchAssets("26.2", await tmp(), { get: down.get })).rejects.toThrow(/HTTP 503/);
  });

  it("falls back to the closest older minecraft-data layout", async () => {
    const base = "https://raw.githubusercontent.com/PrismarineJS/minecraft-data/master/data";
    const net = fakeNetwork({
      [`${base}/pc/26.2/blocks.json`]: { status: 404, body: new Uint8Array() },
      [`${base}/dataPaths.json`]: {
        status: 200,
        body: enc(
          JSON.stringify({
            pc: { "26.1": { blocks: "pc/26.1" }, "1.21.4": { blocks: "pc/1.21.4" } },
          }),
        ),
      },
      [`${base}/pc/26.1/blocks.json`]: { status: 200, body: enc(JSON.stringify(BLOCKS)) },
    });
    const dest = await fetchAssets("26.2", await tmp(), { get: net.get });
    expect(JSON.parse(await readFile(join(dest, "minecraft-data.json"), "utf8")).layout).toBe(
      "pc/26.1",
    );
  });

  it("explains when minecraft-data has nothing old enough", async () => {
    const base = "https://raw.githubusercontent.com/PrismarineJS/minecraft-data/master/data";
    const net = fakeNetwork({
      [`${base}/pc/26.2/blocks.json`]: { status: 404, body: new Uint8Array() },
      [`${base}/dataPaths.json`]: {
        status: 200,
        body: enc(JSON.stringify({ pc: { "27.0": { blocks: "pc/27.0" } } })),
      },
    });
    await expect(fetchAssets("26.2", await tmp(), { get: net.get })).rejects.toThrow(
      /newest pc layout available: 27.0/,
    );
  });

  it("orders versions the way Python does", () => {
    expect(versionKey("26.2")).toEqual([[26, 2], 1]);
    expect(versionKey("26.4-snapshot-3")).toEqual([[26, 4], 0]);
    expect(() => versionKey("abc")).toThrow(AssetError);
    const paths = {
      pc: {
        "1.21.4": { blocks: "a" },
        "26.1": { blocks: "b" },
        "26.4-snapshot-1": { blocks: "c" },
        "26.4": { blocks: "d" },
      },
    };
    expect(closestPcLayout("26.3", paths)).toBe("b");
    expect(closestPcLayout("26.4-snapshot-3", paths)).toBe("c");
    expect(closestPcLayout("26.4", paths)).toBe("d");
    expect(closestPcLayout("1.20", paths)).toBeNull();
  });
});
