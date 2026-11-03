// SPDX-License-Identifier: AGPL-3.0-only
import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "render",
    include: ["test/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
