// SPDX-License-Identifier: AGPL-3.0-only
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, request, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { SkillCliError, type SkillIo } from "../src/node/skill/io.ts";
import {
  cmdPreview,
  DEFAULT_PORT,
  findLocalWebBuild,
  startPreview,
} from "../src/node/skill/preview.ts";

const dirs: string[] = [];
const tmp = async (): Promise<string> => {
  const d = await mkdtemp(join(tmpdir(), "voxwright-preview-"));
  dirs.push(d);
  return d;
};
afterAll(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));

const running: { close(): Promise<void> }[] = [];
afterEach(async () => {
  await Promise.all(running.splice(0).map((s) => s.close()));
});
const track = <T extends { close(): Promise<void> }>(s: T): T => {
  running.push(s);
  return s;
};

/** A raw request: `fetch` would normalise `..` in the path before sending it. */
function raw(
  port: number,
  path: string,
  method = "GET",
): Promise<{
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}> {
  return new Promise((ok, fail) => {
    const req = request({ host: "127.0.0.1", port, path, method }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () =>
        ok({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }),
      );
    });
    req.on("error", fail);
    req.end();
  });
}

/** A built web app in a temp directory, plus a schematic next to it. */
async function site(): Promise<{ root: string; web: string; schem: string }> {
  const root = await tmp();
  const web = join(root, "build");
  await mkdir(join(web, "_app", "immutable"), { recursive: true });
  await mkdir(join(web, "fonts"), { recursive: true });
  await writeFile(join(web, "index.html"), "<!doctype html><title>index</title>");
  await writeFile(join(web, "200.html"), "<!doctype html><title>fallback</title>");
  await writeFile(join(web, "_app", "immutable", "start.js"), "export {}");
  await writeFile(join(web, "_app", "a.mjs"), "export {}");
  await writeFile(join(web, "_app", "app.css"), "body{}");
  await writeFile(join(web, "_app", "m.wasm"), new Uint8Array([0, 97, 115, 109]));
  await writeFile(join(web, "_app", "v.json"), "{}");
  await writeFile(join(web, "fonts", "f.woff2"), "w");
  await writeFile(join(web, "robots.txt"), "ok");
  await writeFile(join(web, "icon.svg"), "<svg/>");
  await writeFile(join(web, "pack.png"), "p");
  await writeFile(join(root, "secret.txt"), "SECRET");
  const schem = join(root, "my house.schem");
  await writeFile(schem, "first");
  return { root, web, schem };
}

const quietOptions = (home: string) => ({ cwd: home, home, port: 0 });

describe("preview: static directory", () => {
  it("serves the app with the right content types", async () => {
    const { root, web, schem } = await site();
    const p = track(await startPreview({ ...quietOptions(root), schematic: schem, web }));
    expect(p.source).toEqual({ kind: "dir", dir: web, why: "explicit" });
    const types: Record<string, string> = {
      "/": "text/html; charset=utf-8",
      "/index.html": "text/html; charset=utf-8",
      "/_app/immutable/start.js": "text/javascript; charset=utf-8",
      "/_app/a.mjs": "text/javascript; charset=utf-8",
      "/_app/app.css": "text/css; charset=utf-8",
      "/_app/m.wasm": "application/wasm",
      "/_app/v.json": "application/json; charset=utf-8",
      "/fonts/f.woff2": "font/woff2",
      "/robots.txt": "text/plain; charset=utf-8",
      "/icon.svg": "image/svg+xml",
      "/pack.png": "image/png",
    };
    for (const [path, type] of Object.entries(types)) {
      const r = await raw(p.port, path);
      expect([path, r.status, r.headers["content-type"]]).toEqual([path, 200, type]);
    }
    expect((await raw(p.port, "/")).body.toString()).toContain("<title>index</title>");
    expect((await raw(p.port, "/_app/immutable/start.js")).headers["cache-control"]).toContain(
      "immutable",
    );
    // A page address that is not a file gets the SPA fallback; a missing asset does not.
    expect((await raw(p.port, "/some/page")).body.toString()).toContain("fallback");
    expect((await raw(p.port, "/_app/missing.js")).status).toBe(404);
    expect((await raw(p.port, "/_app")).status).toBe(301);
  });

  it("refuses path traversal and other methods", async () => {
    const { root, web, schem } = await site();
    const p = track(await startPreview({ ...quietOptions(root), schematic: schem, web }));
    for (const path of [
      "/../secret.txt",
      "/%2e%2e/secret.txt",
      "/..%2fsecret.txt",
      "/_app/..%2f..%2fsecret.txt",
      "/..%5csecret.txt",
      `/${encodeURIComponent(join(root, "secret.txt"))}`,
      "/__preview/../../secret.txt",
    ]) {
      const r = await raw(p.port, path);
      expect(r.body.toString(), path).not.toContain("SECRET");
    }
    for (const method of ["POST", "PUT", "DELETE"]) {
      const r = await raw(p.port, "/", method);
      expect(r.status).toBe(405);
      expect(r.headers.allow).toBe("GET, HEAD");
    }
    const head = await raw(p.port, "/_app/app.css", "HEAD");
    expect(head.status).toBe(200);
    expect(head.headers["content-length"]).toBe("6");
    expect(head.body.length).toBe(0);
  });
});

describe("preview: the schematic route", () => {
  it("reads the file again on every request and exposes nothing else", async () => {
    const { root, web, schem } = await site();
    const p = track(await startPreview({ ...quietOptions(root), schematic: schem, web }));
    expect(p.url).toBe(`http://127.0.0.1:${p.port}/?open=__preview/my%2520house.schem`);
    const path = "/__preview/my%20house.schem";
    const first = await raw(p.port, path);
    expect(first.status).toBe(200);
    expect(first.body.toString()).toBe("first");
    expect(first.headers["cache-control"]).toBe("no-store");
    await writeFile(schem, "second, rebuilt");
    expect((await raw(p.port, path)).body.toString()).toBe("second, rebuilt");
    // Through the page's own resolution: the query value decoded once, then resolved as a URL.
    const open = new URL(p.url).searchParams.get("open") as string;
    const resolved = new URL(open, p.url);
    expect((await fetch(resolved)).status).toBe(200);
    // Only that one file.
    await writeFile(join(root, "other.schem"), "other");
    expect((await raw(p.port, "/__preview/other.schem")).status).toBe(404);
    expect((await raw(p.port, "/__preview/secret.txt")).status).toBe(404);
    expect((await raw(p.port, path, "POST")).status).toBe(405);
    // Gone from disk: 404, not a crash.
    await rm(schem);
    expect((await raw(p.port, path)).status).toBe(404);
  });

  it("refuses unsupported or missing files", async () => {
    const { root, web } = await site();
    await writeFile(join(root, "a.txt"), "x");
    await writeFile(join(root, "old.schematic"), "x");
    const err = (schematic: string) =>
      startPreview({ ...quietOptions(root), schematic, web }).then(
        () => null,
        (e: unknown) => e,
      );
    const txt = await err("a.txt");
    expect(txt).toBeInstanceOf(SkillCliError);
    expect((txt as SkillCliError).exitCode).toBe(2);
    expect(((await err("old.schematic")) as SkillCliError).exitCode).toBe(2);
    const missing = await err("nope.litematic");
    expect(missing).toBeInstanceOf(SkillCliError);
    expect((missing as SkillCliError).exitCode).toBe(1);
    expect((missing as Error).message).toContain("no such file");
  });
});

describe("preview: ports", () => {
  it("takes the next free port when the default is busy, and fails on a busy explicit port", async () => {
    const { root, web, schem } = await site();
    // Hold the default port (or find it already held by something else).
    const blocker = createServer();
    await new Promise<void>((ok) => {
      blocker.once("error", () => ok());
      blocker.listen(DEFAULT_PORT, "127.0.0.1", () => ok());
    });
    try {
      const p = track(await startPreview({ cwd: root, home: root, schematic: schem, web }));
      expect(p.port).toBeGreaterThan(DEFAULT_PORT);
      expect(p.notes.join("\n")).toContain(`port ${DEFAULT_PORT} is in use, using ${p.port}`);
      const busy = await startPreview({
        cwd: root,
        home: root,
        schematic: schem,
        web,
        port: p.port,
      }).then(
        () => null,
        (e: unknown) => e,
      );
      expect(busy).toBeInstanceOf(SkillCliError);
      expect((busy as Error).message).toContain(`port ${p.port} on 127.0.0.1 is already in use`);
    } finally {
      await new Promise((ok) => blocker.close(ok));
    }
  });
});

describe("preview: finding the web app", () => {
  it("finds apps/web/build from the bundle and from the source tree", async () => {
    const root = await tmp();
    const build = join(root, "apps", "web", "build");
    await mkdir(build, { recursive: true });
    await mkdir(join(root, "scripts"), { recursive: true });
    const src = join(root, "packages", "mcbuilder", "src", "node", "skill");
    await mkdir(src, { recursive: true });
    expect(findLocalWebBuild(join(root, "scripts"))).toBeNull(); // no index.html yet
    await writeFile(join(build, "index.html"), "x");
    expect(findLocalWebBuild(join(root, "scripts"))).toBe(build);
    expect(findLocalWebBuild(src)).toBe(build);
    const elsewhere = await tmp();
    expect(findLocalWebBuild(elsewhere)).toBeNull();
  });

  it("checks a --web directory and $VOXWRIGHT_WEB-style values", async () => {
    const { root, schem } = await site();
    const empty = join(root, "empty");
    await mkdir(empty);
    for (const web of [empty, "ftp://example.com/"]) {
      const e = await startPreview({ ...quietOptions(root), schematic: schem, web }).then(
        () => null,
        (x: unknown) => x,
      );
      expect(e).toBeInstanceOf(SkillCliError);
      expect((e as SkillCliError).exitCode).toBe(2);
    }
    // A relative directory resolves against cwd.
    const p = track(await startPreview({ ...quietOptions(root), schematic: schem, web: "build" }));
    expect(p.source.kind).toBe("dir");
  });
});

/** The published site, faked: `/voxwright/` with assets, one gzip-encoded, and a 5xx page. */
async function fakeUpstream(): Promise<{
  server: Server;
  origin: string;
  hits: string[];
}> {
  const hits: string[] = [];
  const server = createServer((req, res) => {
    const path = req.url ?? "/";
    hits.push(path);
    if (path === "/voxwright") {
      res.writeHead(301, { location: "/voxwright/" });
      res.end();
    } else if (path === "/voxwright/") {
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        connection: "keep-alive",
        "set-cookie": "a=b",
      });
      res.end("<!doctype html><title>published</title>");
    } else if (path === "/voxwright/_app/immutable/entry.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      res.end("export const v = 1;");
    } else if (path === "/voxwright/_app/app.css") {
      const body = gzipSync(Buffer.from("body{color:red}"));
      res.writeHead(200, {
        "content-type": "text/css",
        "content-encoding": "gzip",
        "content-length": String(body.length),
      });
      res.end(body);
    } else if (path === "/voxwright/broken") {
      res.writeHead(503);
      res.end("down");
    } else {
      res.writeHead(404);
      res.end("nope");
    }
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return { server, origin, hits };
}

/** The old address: redirects every path to the same path on `target`. */
async function fakeRedirector(target: string): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    res.writeHead(301, { location: `${target}${req.url}` });
    res.end();
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  return { server, origin: `http://127.0.0.1:${(server.address() as { port: number }).port}` };
}

const closeServer = (s: Server): Promise<void> =>
  new Promise((ok) => {
    s.close(() => ok());
    s.closeAllConnections();
  });

describe("preview: proxy of the published site", () => {
  it("proxies under the upstream path, caches, and works offline afterwards", async () => {
    const { root, schem } = await site();
    const home = await tmp();
    const up = await fakeUpstream();
    const old = await fakeRedirector(up.origin);
    let upOpen = true;
    try {
      // The old address redirects to the new one; the proxy follows it once at start.
      const p = track(
        await startPreview({
          cwd: root,
          home,
          port: 0,
          schematic: schem,
          web: `${old.origin}/voxwright/`,
          upstreamTimeoutMs: 2000,
        }),
      );
      expect(p.source).toMatchObject({
        kind: "proxy",
        upstream: `${up.origin}/voxwright/`,
        cacheDir: join(home, ".cache", "voxwright", "web"),
      });
      expect(p.url).toBe(`http://127.0.0.1:${p.port}/voxwright/?open=__preview/my%2520house.schem`);

      // The root and the base without its slash go to the app.
      const top = await raw(p.port, "/");
      expect([top.status, top.headers.location]).toEqual([302, "/voxwright/"]);
      expect((await raw(p.port, "/voxwright")).headers.location).toBe("/voxwright/");
      expect((await raw(p.port, "/elsewhere.js")).status).toBe(404);

      const page = await raw(p.port, "/voxwright/");
      expect(page.status).toBe(200);
      expect(page.body.toString()).toContain("published");
      expect(page.headers["set-cookie"]).toBeUndefined();
      expect(page.headers["content-type"]).toBe("text/html; charset=utf-8");

      // A gzip-encoded upstream body is sent decoded, without content-encoding.
      const css = await raw(p.port, "/voxwright/_app/app.css");
      expect(css.body.toString()).toBe("body{color:red}");
      expect(css.headers["content-encoding"]).toBeUndefined();
      expect(css.headers["content-length"]).toBe(String(css.body.length));

      // Upstream errors pass through when nothing is cached.
      expect((await raw(p.port, "/voxwright/missing.js")).status).toBe(404);
      expect((await raw(p.port, "/voxwright/broken")).status).toBe(503);
      expect((await raw(p.port, "/voxwright/%2e%2e/secret")).status).toBe(404);

      // The schematic lives under the app's base.
      const s = await raw(p.port, "/voxwright/__preview/my%20house.schem");
      expect([s.status, s.body.toString()]).toEqual([200, "first"]);
      expect(up.hits).not.toContain("/voxwright/__preview/my%20house.schem");

      // Immutable assets: cache first.
      await raw(p.port, "/voxwright/_app/immutable/entry.js");
      const before = up.hits.filter((h) => h.endsWith("entry.js")).length;
      const again = await raw(p.port, "/voxwright/_app/immutable/entry.js");
      expect(again.headers["x-voxwright-cache"]).toBe("hit");
      expect(up.hits.filter((h) => h.endsWith("entry.js")).length).toBe(before);

      // Written to disk under the home cache, keyed by upstream origin + path.
      const cacheDir = join(home, ".cache", "voxwright", "web");
      const hostDir = (await readdir(cacheDir)).find((d) => d !== "aliases.json") as string;
      expect(hostDir).toBe(new URL(up.origin).host.replace(/[^a-z0-9.-]/gi, "_"));
      const metas = (await readdir(join(cacheDir, hostDir))).filter((f) => f.endsWith(".json"));
      const urls = await Promise.all(
        metas.map(
          async (m) =>
            (JSON.parse(await readFile(join(cacheDir, hostDir, m), "utf8")) as { url: string }).url,
        ),
      );
      expect(urls.sort()).toEqual(
        [
          `${up.origin}/voxwright/`,
          `${up.origin}/voxwright/_app/app.css`,
          `${up.origin}/voxwright/_app/immutable/entry.js`,
        ].sort(),
      );
      const aliases = JSON.parse(await readFile(join(cacheDir, "aliases.json"), "utf8"));
      expect(aliases).toEqual({ [`${old.origin}/voxwright/`]: `${up.origin}/voxwright/` });

      // Upstream goes away: the running proxy falls back to the cache.
      await closeServer(up.server);
      upOpen = false;
      const offline = await raw(p.port, "/voxwright/");
      expect([offline.status, offline.headers["x-voxwright-cache"]]).toEqual([200, "hit"]);
      expect(offline.body.toString()).toContain("published");
      expect((await raw(p.port, "/voxwright/never-fetched.js")).status).toBe(502);
      await p.close();

      // A fresh start while offline (both addresses down) still finds the cached copy.
      await closeServer(old.server);
      const q = track(
        await startPreview({
          cwd: root,
          home,
          port: 0,
          schematic: schem,
          web: `${old.origin}/voxwright/`,
          upstreamTimeoutMs: 2000,
        }),
      );
      expect(q.source).toMatchObject({ kind: "proxy", upstream: `${up.origin}/voxwright/` });
      expect(q.notes.join("\n")).toContain("could not be reached");
      const css2 = await raw(q.port, "/voxwright/_app/app.css");
      expect([css2.status, css2.body.toString()]).toEqual([200, "body{color:red}"]);
    } finally {
      if (upOpen) await closeServer(up.server);
      if (old.server.listening) await closeServer(old.server);
    }
  });

  it("falls back to the published site when no local build is found", async () => {
    const { root, schem } = await site();
    const home = await tmp();
    const up = await fakeUpstream();
    try {
      const p = track(
        await startPreview({
          cwd: root,
          home,
          port: 0,
          schematic: schem,
          searchFrom: await tmp(),
          published: `${up.origin}/voxwright/`,
        }),
      );
      expect(p.source).toMatchObject({ kind: "proxy", why: "published" });
      expect((await raw(p.port, "/voxwright/")).status).toBe(200);
      expect(existsSync(join(home, ".cache", "voxwright", "web"))).toBe(true);
    } finally {
      await closeServer(up.server);
    }
  });
});

describe("preview: command line", () => {
  const io = (cwd: string): SkillIo & { lines: string[]; errs: string[] } => {
    const lines: string[] = [];
    const errs: string[] = [];
    return {
      lines,
      errs,
      out: (l) => lines.push(l),
      err: (l) => errs.push(l),
      cwd,
      home: cwd,
      env: {},
    };
  };

  it("prints help and rejects bad usage with exit code 2", async () => {
    const { root } = await site();
    const h = io(root);
    expect(await cmdPreview(["--help"], h)).toBe(0);
    expect(h.lines.join("\n")).toContain("Usage: voxwright-cli preview <schematic|run>");
    for (const args of [
      [],
      ["a.schem", "b.schem"],
      ["a.schem", "--bogus"],
      ["a.schem", "--port", "x"],
    ]) {
      const e = await cmdPreview(args, io(root)).then(
        () => null,
        (x: unknown) => x,
      );
      expect(e, args.join(" ")).toBeInstanceOf(SkillCliError);
      expect((e as SkillCliError).exitCode).toBe(2);
    }
  });
});
