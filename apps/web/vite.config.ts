// SPDX-License-Identifier: AGPL-3.0-only
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";
import { resolveBuildInfo } from "./build-info-config.ts";

const git = (...args: string[]): string | null => {
  try {
    return execFileSync("git", args, {
      cwd: fileURLToPath(new URL(".", import.meta.url)),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
};

// The footer links to the source of the version that is running. Set VOXWRIGHT_SOURCE_URL (and, if
// the commit cannot be read from git, VOXWRIGHT_COMMIT) when you build a modified copy.
const info = resolveBuildInfo({
  env: process.env,
  gitCommit: () => git("rev-parse", "HEAD") || null,
  gitModified: () => (git("status", "--porcelain") ?? "") !== "",
  version: (
    JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
      version: string;
    }
  ).version,
});

export default defineConfig({
  plugins: [
    sveltekit({
      // A static site: it can be served from any file host, which is what self-hosting needs.
      adapter: adapter({ fallback: "200.html" }),
      // The site may live under a sub-path when self-hosted; relative asset paths make that work.
      paths: { relative: true },
    }),
  ],
  define: {
    __VOXWRIGHT_SOURCE_URL__: JSON.stringify(info.sourceUrl),
    __VOXWRIGHT_SOURCE_LINK__: JSON.stringify(info.sourceLink),
    __VOXWRIGHT_COMMIT__: JSON.stringify(info.commit),
    __VOXWRIGHT_MODIFIED__: JSON.stringify(info.modified),
    __VOXWRIGHT_VERSION__: JSON.stringify(info.version),
  },
  worker: { format: "es" },
  test: { name: "web", include: ["test/**/*.test.ts"] },
});
