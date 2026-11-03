// SPDX-License-Identifier: AGPL-3.0-only

// Shared by the browser tests: serve the built site on a free local port and
// find a Chromium to drive it.

import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const site = fileURLToPath(new URL("../build/", import.meta.url));

const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
};

export function findChromium(explicit?: string): string {
  const found =
    explicit ??
    [
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
    ].find(existsSync);
  if (!found) throw new Error("no Chromium or Chrome found; pass --chromium <path>");
  return found;
}

/** Serve `apps/web/build` (falling back to index.html, as a static host would). */
export async function serveSite(): Promise<{ url: string; server: Server }> {
  if (!existsSync(join(site, "index.html")))
    throw new Error("build the site first: pnpm --filter @voxwright/web build");
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0] as string)).replace(
      /^(\.\.[/\\])+/,
      "",
    );
    let file = join(site, path === "/" ? "index.html" : path);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(site, "index.html");
    res.setHeader("content-type", types[extname(file)] ?? "application/octet-stream");
    res.end(readFileSync(file));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${(server.address() as { port: number }).port}/`, server };
}

/**
 * Chromium flags. `webgl` runs WebGL2 on SwiftShader (software Vulkan, no GPU needed), the way a
 * headless machine can; otherwise the GPU is off entirely, so the page has no WebGL2 and uses its
 * software renderer.
 */
export const chromiumArgs = (webgl: boolean): string[] =>
  webgl
    ? [
        "--no-sandbox",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
      ]
    : ["--no-sandbox", "--disable-gpu", "--disable-3d-apis"];
