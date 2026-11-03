// SPDX-License-Identifier: AGPL-3.0-only
import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    sveltekit({
      // A static site: it can be served from any file host, which is what self-hosting needs.
      adapter: adapter({ fallback: "200.html" }),
      // The site may live under a sub-path when self-hosted; relative asset paths make that work.
      paths: { relative: true },
    }),
  ],
  worker: { format: "es" },
  test: { name: "web", include: ["test/**/*.test.ts"] },
});
