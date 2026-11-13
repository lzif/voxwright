// SPDX-License-Identifier: AGPL-3.0-only

// `voxwright-cli preview <schematic>`: a local server for the web viewer and editor.
//
// It serves the web app (a local build, or the published site through a caching reverse proxy, so
// the page and the schematic share one origin) and the one schematic at `<app base>/__preview/<name>`,
// read from disk on every request. The page opens it from `?open=__preview/<name>`.
// Node built-ins only: this module ends up in the single-file skill bundle.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { SkillCliError, type SkillIo } from "./io.ts";

export const DEFAULT_PORT = 4173;
export const DEFAULT_HOST = "127.0.0.1";
/** The published web app. `https://lzif.github.io/voxwright/` redirects here. */
export const PUBLISHED_WEB = "https://luki.is-a.dev/voxwright/";
/** How many ports after the default are tried when it is busy. */
const PORT_TRIES = 50;
const SCHEMATIC_EXTENSIONS = [".schem", ".litematic", ".nbt", ".mcstructure"];

export const PREVIEW_USAGE = `Usage: voxwright-cli preview <schematic> [options]

Serve the web viewer and editor on this machine with <schematic> opened in it
(.schem, .litematic, .nbt or .mcstructure). The file is read again on every page
load, so rebuild and refresh the page to see the new build. Runs until Ctrl+C.

Options:
  --port <n>          port to listen on (default ${DEFAULT_PORT}; when it is busy the next free
                      one is used; an explicit --port that is busy is an error)
  --host <h>          address to listen on (default ${DEFAULT_HOST})
  --no-open           do not open the page in the default browser
  --web <dir|url>     web app to serve: a built apps/web directory or an http(s) URL
                      (default: $VOXWRIGHT_WEB, else apps/web/build of this checkout,
                      else ${PUBLISHED_WEB} through a local caching proxy)
  -h, --help          show this help`;

/** Where the web app comes from. */
export type WebSource =
  | { kind: "dir"; dir: string; why: "explicit" | "local-build" }
  | { kind: "proxy"; upstream: string; cacheDir: string; why: "explicit" | "published" };

export interface PreviewOptions {
  /** The schematic to serve; relative to `cwd`. */
  schematic: string;
  cwd: string;
  /** Home directory: the proxy cache lives in `<home>/.cache/voxwright/web/`. */
  home: string;
  /** `--web` (or `$VOXWRIGHT_WEB`): a directory or an http(s) URL. Relative directories resolve against `cwd`. */
  web?: string;
  /** Explicit port (busy is an error; 0 picks any free port). Without it the default is used, or the next free one. */
  port?: number;
  host?: string;
  /** Where the lookup of a local `apps/web/build` starts. Defaults to the directory of the running file. */
  searchFrom?: string;
  /** The site proxied when nothing else is found. Defaults to {@link PUBLISHED_WEB}. */
  published?: string;
  /** Timeout of one upstream request in the proxy, in ms. */
  upstreamTimeoutMs?: number;
}

export interface PreviewServer {
  /** The address to open: the app with `?open=__preview/<name>`. */
  url: string;
  host: string;
  port: number;
  source: WebSource;
  /** Things worth telling the user (a busy default port, an unreachable upstream...). */
  notes: string[];
  close(): Promise<void>;
}

/** Run `preview` with the arguments after the subcommand. Resolves with the exit code when the server stops. */
export async function cmdPreview(args: string[], io: SkillIo): Promise<number> {
  let parsed: ReturnType<typeof parsePreviewArgs>;
  try {
    parsed = parsePreviewArgs(args);
  } catch (err) {
    if (err instanceof SkillCliError) throw err;
    throw new SkillCliError(
      `${err instanceof Error ? err.message : String(err)}\n${PREVIEW_USAGE}`,
      2,
    );
  }
  if (parsed.help) {
    for (const line of PREVIEW_USAGE.split("\n")) io.out(line);
    return 0;
  }
  const preview = await startPreview({
    schematic: parsed.schematic,
    cwd: io.cwd,
    home: io.home,
    web: parsed.web ?? (io.env.VOXWRIGHT_WEB?.trim() || undefined),
    port: parsed.port,
    host: parsed.host,
  });
  for (const note of preview.notes) io.err(`warning: ${note}`);
  io.out(`Preview URL: ${preview.url}`);
  io.out(`Web app: ${describeSource(preview.source)}. Press Ctrl+C to stop.`);
  if (parsed.open) openBrowser(preview.url, (msg) => io.err(`warning: ${msg}`));

  await new Promise<void>((done) => {
    const stop = (): void => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      done();
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });
  await preview.close();
  return 0;
}

function parsePreviewArgs(args: string[]): {
  help: boolean;
  schematic: string;
  port: number | undefined;
  host: string | undefined;
  web: string | undefined;
  open: boolean;
} {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      port: { type: "string" },
      host: { type: "string" },
      "no-open": { type: "boolean" },
      web: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help)
    return {
      help: true,
      schematic: "",
      port: undefined,
      host: undefined,
      web: undefined,
      open: false,
    };
  if (positionals.length !== 1)
    throw new SkillCliError(
      `preview takes exactly one schematic, got ${positionals.length}\n${PREVIEW_USAGE}`,
      2,
    );
  let port: number | undefined;
  if (values.port !== undefined) {
    port = Number(values.port);
    if (!/^\d+$/.test(values.port) || port > 65535)
      throw new SkillCliError(
        `--port must be a whole number from 0 to 65535, got '${values.port}'`,
        2,
      );
  }
  if (values.host !== undefined && values.host.trim() === "")
    throw new SkillCliError("--host must not be empty", 2);
  return {
    help: false,
    schematic: positionals[0] as string,
    port,
    host: values.host,
    web: values.web,
    open: !values["no-open"],
  };
}

export function describeSource(source: WebSource): string {
  if (source.kind === "dir")
    return source.why === "local-build"
      ? `local build at ${source.dir}`
      : `directory ${source.dir}`;
  return `${source.upstream} through a local proxy (cached in ${source.cacheDir})`;
}

/** Start the server. Resolves once it listens. */
export async function startPreview(options: PreviewOptions): Promise<PreviewServer> {
  const file = resolve(options.cwd, options.schematic);
  const ext = extname(file).toLowerCase();
  if (ext === ".schematic")
    throw new SkillCliError(
      "'.schematic' is the legacy format from before Minecraft 1.13 and is not supported; re-save the build as .schem",
      2,
    );
  if (!SCHEMATIC_EXTENSIONS.includes(ext))
    throw new SkillCliError(
      `cannot preview '${basename(file)}': expected a .schem, .litematic, .nbt or .mcstructure file`,
      2,
    );
  let st: ReturnType<typeof statSync> | undefined;
  try {
    st = statSync(file);
  } catch {
    throw new SkillCliError(`no such file: ${file}`);
  }
  if (!st.isFile()) throw new SkillCliError(`not a file: ${file}`);

  const notes: string[] = [];
  const timeoutMs = options.upstreamTimeoutMs ?? 15_000;
  const source = await chooseSource(options, notes, timeoutMs);
  const base = source.kind === "dir" ? "/" : new URL(source.upstream).pathname;
  const name = basename(file);
  const schematicPath = `${base}__preview/${name}`;

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" });
      res.end("Only GET and HEAD are supported.\n");
      return;
    }
    const raw = (req.url ?? "/").split("?")[0] as string;
    let path: string;
    try {
      path = decodeURIComponent(raw);
    } catch {
      return send(req, res, 400, "text/plain; charset=utf-8", "Bad request.\n");
    }
    if (path === schematicPath) return serveSchematic(req, res, file);
    if (source.kind === "dir") return serveStatic(req, res, source.dir, path, raw);
    return serveProxy(req, res, source, raw, timeoutMs);
  };
  const server = createServer((req, res) => {
    handler(req, res).catch((err: unknown) => {
      if (!res.headersSent)
        send(req, res, 500, "text/plain; charset=utf-8", `Internal error: ${String(err)}\n`);
      else res.destroy();
    });
  });

  const host = options.host ?? DEFAULT_HOST;
  let port: number;
  if (options.port !== undefined) {
    try {
      port = await listen(server, options.port, host);
    } catch (err) {
      throw listenError(err, options.port, host, true);
    }
  } else {
    port = -1;
    for (let p = DEFAULT_PORT; p < DEFAULT_PORT + PORT_TRIES && p <= 65535; p++) {
      try {
        port = await listen(server, p, host);
        break;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EADDRINUSE")
          throw listenError(err, p, host, false);
      }
    }
    if (port === -1)
      throw new SkillCliError(
        `ports ${DEFAULT_PORT} to ${DEFAULT_PORT + PORT_TRIES - 1} on ${host} are all in use; pass a free --port`,
      );
    if (port !== DEFAULT_PORT) notes.push(`port ${DEFAULT_PORT} is in use, using ${port}`);
  }

  const shownHost =
    host === "0.0.0.0"
      ? "127.0.0.1"
      : host === "::"
        ? "[::1]"
        : host.includes(":")
          ? `[${host}]`
          : host;
  const url = `http://${shownHost}:${port}${base}?open=${openParam(name)}`;
  return {
    url,
    host,
    port,
    source,
    notes,
    close: () =>
      new Promise<void>((done) => {
        server.close(() => done());
        server.closeAllConnections();
      }),
  };
}

/**
 * The value of `?open=`: `__preview/<name>` with the name escaped twice where needed, because the
 * page decodes the query once and resolves the rest as a URL path.
 */
function openParam(name: string): string {
  return encodeURIComponent(`__preview/${encodeURIComponent(name)}`).replaceAll("%2F", "/");
}

function listen(server: Server, port: number, host: string): Promise<number> {
  return new Promise((ok, fail) => {
    const onError = (err: Error): void => {
      server.off("listening", onListening);
      fail(err);
    };
    const onListening = (): void => {
      server.off("error", onError);
      ok((server.address() as { port: number }).port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

function listenError(err: unknown, port: number, host: string, explicit: boolean): SkillCliError {
  const code = (err as NodeJS.ErrnoException).code;
  if (code === "EADDRINUSE" && explicit)
    return new SkillCliError(
      `port ${port} on ${host} is already in use; pass another --port or leave it out to pick a free one`,
    );
  if (code === "EADDRNOTAVAIL" || code === "ENOTFOUND")
    return new SkillCliError(`cannot listen on host '${host}': ${code}`, 2);
  return new SkillCliError(
    `cannot listen on ${host}:${port}: ${err instanceof Error ? err.message : String(err)}`,
  );
}

// -- Choosing the web app ------------------------------------------------------------------------

async function chooseSource(
  options: PreviewOptions,
  notes: string[],
  timeoutMs: number,
): Promise<WebSource> {
  const cacheRoot = join(options.home, ".cache", "voxwright", "web");
  if (options.web !== undefined) {
    if (/^https?:\/\//i.test(options.web)) {
      const upstream = await resolveUpstream(options.web, cacheRoot, notes, timeoutMs);
      return { kind: "proxy", upstream, cacheDir: cacheRoot, why: "explicit" };
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(options.web))
      throw new SkillCliError(
        `--web must be a directory or an http(s) URL, got '${options.web}'`,
        2,
      );
    const dir = resolve(options.cwd, options.web);
    if (!existsSync(join(dir, "index.html")))
      throw new SkillCliError(
        `--web ${dir} has no index.html; build the web app first (pnpm --filter @voxwright/web build)`,
        2,
      );
    return { kind: "dir", dir, why: "explicit" };
  }
  const local = findLocalWebBuild(options.searchFrom ?? dirname(fileURLToPath(import.meta.url)));
  if (local !== null) return { kind: "dir", dir: local, why: "local-build" };
  const upstream = await resolveUpstream(
    options.published ?? PUBLISHED_WEB,
    cacheRoot,
    notes,
    timeoutMs,
  );
  return { kind: "proxy", upstream, cacheDir: cacheRoot, why: "published" };
}

/**
 * The built web app of the repository checkout this file runs from: walk up from `from` to the
 * first directory that holds `apps/web`, and use its `build/` when it has an `index.html`. Works for
 * the bundle (`scripts/voxwright-cli.mjs`) and for the source (`packages/mcbuilder/src/node/skill/`).
 */
export function findLocalWebBuild(from: string): string | null {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, "apps", "web"))) {
      const build = join(dir, "apps", "web", "build");
      return existsSync(join(build, "index.html")) ? build : null;
    }
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/** Ends with a slash: the directory the app lives in. */
function asDirectoryUrl(u: URL): string {
  const copy = new URL(u.href);
  copy.search = "";
  copy.hash = "";
  if (!copy.pathname.endsWith("/")) copy.pathname = copy.pathname.replace(/[^/]*$/, "");
  return copy.href;
}

/**
 * The upstream base after redirects (`https://lzif.github.io/voxwright/` becomes
 * `https://luki.is-a.dev/voxwright/`). The answer is remembered in the cache so an offline start
 * still finds the cached copy.
 */
async function resolveUpstream(
  given: string,
  cacheRoot: string,
  notes: string[],
  timeoutMs: number,
): Promise<string> {
  let start: URL;
  try {
    start = new URL(given);
  } catch {
    throw new SkillCliError(`--web: not a valid URL: '${given}'`, 2);
  }
  if (!start.pathname.endsWith("/")) start.pathname = `${start.pathname}/`;
  start.search = "";
  start.hash = "";
  const aliasesFile = join(cacheRoot, "aliases.json");
  let aliases: Record<string, string> = {};
  try {
    aliases = JSON.parse(await readFile(aliasesFile, "utf8")) as Record<string, string>;
  } catch {}
  try {
    const res = await fetch(start, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "voxwright-cli preview" },
    });
    await res.body?.cancel();
    const final = asDirectoryUrl(new URL(res.url || start.href));
    if (final !== start.href && aliases[start.href] !== final) {
      aliases[start.href] = final;
      await writeAtomic(aliasesFile, JSON.stringify(aliases, null, 2));
    }
    if (!res.ok) notes.push(`${final} answered HTTP ${res.status}`);
    return final;
  } catch (err) {
    const known = aliases[start.href] ?? start.href;
    notes.push(
      `${start.href} could not be reached (${errText(err)}); serving the cached copy of ${known} where there is one`,
    );
    return known;
  }
}

// -- Serving -------------------------------------------------------------------------------------

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".zip": "application/zip",
};

export const contentTypeFor = (path: string): string =>
  CONTENT_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";

function send(
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  type: string,
  body: string | Uint8Array,
  headers: Record<string, string> = {},
): void {
  const bytes = typeof body === "string" ? Buffer.from(body) : body;
  res.writeHead(status, {
    "content-type": type,
    "content-length": String(bytes.byteLength),
    "x-content-type-options": "nosniff",
    ...headers,
  });
  res.end(req.method === "HEAD" ? undefined : bytes);
}

const notFound = (req: IncomingMessage, res: ServerResponse): void =>
  send(req, res, 404, "text/plain; charset=utf-8", "Not found.\n", { "cache-control": "no-store" });

async function serveSchematic(
  req: IncomingMessage,
  res: ServerResponse,
  file: string,
): Promise<void> {
  let bytes: Uint8Array;
  try {
    bytes = await readFile(file);
  } catch {
    return notFound(req, res);
  }
  send(req, res, 200, "application/octet-stream", bytes, { "cache-control": "no-store" });
}

async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
  path: string,
  rawPath: string,
): Promise<void> {
  if (path.includes("\0") || path.includes("\\")) return notFound(req, res);
  const segments = path.split("/").filter((s) => s !== "");
  if (segments.some((s) => s === "." || s === "..")) return notFound(req, res);
  let file = join(root, ...segments);
  if (file !== root && !file.startsWith(root + sep)) return notFound(req, res);
  let st = await stat(file).catch(() => null);
  if (st?.isDirectory()) {
    if (!path.endsWith("/"))
      return send(req, res, 301, "text/plain; charset=utf-8", "", { location: `${rawPath}/` });
    file = join(file, "index.html");
    st = await stat(file).catch(() => null);
  }
  if (!st?.isFile()) {
    // A page address the static app does not have as a file: the SPA fallback, as a static host would.
    if (extname(path) !== "") return notFound(req, res);
    file = join(root, "200.html");
    st = await stat(file).catch(() => null);
    if (!st?.isFile()) return notFound(req, res);
  }
  const bytes = await readFile(file);
  const immutable = path.includes("/_app/immutable/");
  send(req, res, 200, contentTypeFor(file), bytes, {
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
  });
}

// -- The caching reverse proxy -------------------------------------------------------------------

interface CachedMeta {
  url: string;
  status: number;
  contentType: string;
  savedAt: number;
}

/** Cache files for one upstream URL (origin + path): `<hash>.body` and `<hash>.json`. */
function cachePaths(cacheDir: string, upstreamUrl: string): { body: string; meta: string } {
  const u = new URL(upstreamUrl);
  const key = createHash("sha256").update(`${u.origin}${u.pathname}`).digest("hex");
  const host = u.host.replace(/[^a-z0-9.-]/gi, "_");
  return {
    body: join(cacheDir, host, `${key}.body`),
    meta: join(cacheDir, host, `${key}.json`),
  };
}

async function readCache(
  cacheDir: string,
  upstreamUrl: string,
): Promise<{ meta: CachedMeta; body: Uint8Array } | null> {
  const p = cachePaths(cacheDir, upstreamUrl);
  try {
    const meta = JSON.parse(await readFile(p.meta, "utf8")) as CachedMeta;
    const body = await readFile(p.body);
    return { meta, body };
  } catch {
    return null;
  }
}

async function writeCache(
  cacheDir: string,
  upstreamUrl: string,
  contentType: string,
  body: Uint8Array,
): Promise<void> {
  const p = cachePaths(cacheDir, upstreamUrl);
  const meta: CachedMeta = { url: upstreamUrl, status: 200, contentType, savedAt: Date.now() };
  // Body first: a meta file only ever points at a complete body.
  await writeAtomic(p.body, body);
  await writeAtomic(p.meta, JSON.stringify(meta));
}

async function writeAtomic(path: string, data: string | Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, path);
}

async function serveProxy(
  req: IncomingMessage,
  res: ServerResponse,
  source: Extract<WebSource, { kind: "proxy" }>,
  rawPath: string,
  timeoutMs: number,
): Promise<void> {
  const upstream = new URL(source.upstream);
  const base = upstream.pathname;
  if (rawPath === "/" && base !== "/")
    return send(req, res, 302, "text/plain; charset=utf-8", "", { location: base });
  if (rawPath === base.slice(0, -1))
    return send(req, res, 301, "text/plain; charset=utf-8", "", { location: base });
  if (!rawPath.startsWith(base) || rawPath.split("/").some((s) => s === ".." || s === "."))
    return notFound(req, res);
  const targetUrl = new URL(rawPath, upstream.origin);
  // The URL parser folds `%2e%2e` segments; whatever it makes must still be inside the app.
  if (!targetUrl.pathname.startsWith(base)) return notFound(req, res);
  const target = targetUrl.href;
  const immutable = rawPath.includes("/_app/immutable/");

  const fromCache = async (): Promise<boolean> => {
    const hit = await readCache(source.cacheDir, target);
    if (hit === null) return false;
    send(req, res, 200, hit.meta.contentType, hit.body, {
      "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
      "x-voxwright-cache": "hit",
    });
    return true;
  };
  if (immutable && (await fromCache())) return;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "voxwright-cli preview", accept: req.headers.accept ?? "*/*" },
    });
  } catch (err) {
    if (await fromCache()) return;
    return send(
      req,
      res,
      502,
      "text/plain; charset=utf-8",
      `The web app at ${target} could not be reached (${errText(err)}) and no cached copy exists.\n`,
      { "cache-control": "no-store" },
    );
  }

  // Redirected inside the app (`/voxwright` to `/voxwright/`, say): send the browser there, so
  // relative links in the page resolve against the right directory.
  const finalUrl = upstreamRes.url ? new URL(upstreamRes.url) : new URL(target);
  if (finalUrl.href !== target) {
    if (finalUrl.origin === upstream.origin && finalUrl.pathname.startsWith(base)) {
      await upstreamRes.body?.cancel();
      return send(req, res, 302, "text/plain; charset=utf-8", "", {
        location: `${finalUrl.pathname}${finalUrl.search}`,
      });
    }
  }

  // `fetch` has already undone any content-encoding, so the body is sent as plain bytes with its
  // own length; hop-by-hop and encoding headers from upstream are not passed on.
  let body: Uint8Array;
  try {
    body = new Uint8Array(await upstreamRes.arrayBuffer());
  } catch (err) {
    if (await fromCache()) return;
    return send(
      req,
      res,
      502,
      "text/plain; charset=utf-8",
      `Reading ${target} failed (${errText(err)}).\n`,
      {
        "cache-control": "no-store",
      },
    );
  }
  if (upstreamRes.status >= 500 && (await fromCache())) return;
  const contentType = upstreamRes.headers.get("content-type") ?? contentTypeFor(finalUrl.pathname);
  if (upstreamRes.status === 200) {
    await writeCache(source.cacheDir, target, contentType, body).catch(() => {});
  }
  const headers: Record<string, string> = {
    "cache-control":
      upstreamRes.status === 200 && immutable ? "public, max-age=31536000, immutable" : "no-cache",
  };
  const lastModified = upstreamRes.headers.get("last-modified");
  if (lastModified) headers["last-modified"] = lastModified;
  send(req, res, upstreamRes.status, contentType, body, headers);
}

const errText = (err: unknown): string => {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause;
    if (cause instanceof Error) return cause.message;
    return err.message;
  }
  return String(err);
};

// -- Opening the browser -------------------------------------------------------------------------

/** Open `url` in the default browser. A failure is reported through `warn`, never thrown. */
export function openBrowser(url: string, warn: (message: string) => void): void {
  const [cmd, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", '""', `"${url}"`]]
        : ["xdg-open", [url]];
  const failed = (why: string): void =>
    warn(`could not open a browser (${why}); open the Preview URL above yourself`);
  try {
    const child = spawn(cmd, args as string[], {
      stdio: "ignore",
      detached: true,
      // `start "" "<url>"`: the quotes must reach cmd as written, or `&` in the URL splits the command.
      windowsVerbatimArguments: process.platform === "win32",
    });
    child.on("error", (err) => failed(`${cmd}: ${err.message}`));
    child.on("exit", (code) => {
      if (code !== 0 && code !== null) failed(`${cmd} exited with code ${code}`);
    });
    child.unref();
  } catch (err) {
    failed(errText(err));
  }
}
