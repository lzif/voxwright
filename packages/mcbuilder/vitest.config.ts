// SPDX-License-Identifier: AGPL-3.0-only
import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "mcbuilder",
    include: ["test/**/*.test.ts"],
  },
});
