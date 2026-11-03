// SPDX-License-Identifier: AGPL-3.0-only
import { defineConfig } from "vitest/config";

// Workspace config: each package or app under packages/* and apps/* is a
// Vitest project and may carry its own vitest.config.ts.
export default defineConfig({
  test: {
    projects: ["packages/*", "apps/*"],
  },
});
