// SPDX-License-Identifier: AGPL-3.0-only

// The skill is markdown only: no tracked file under skills/ has an executable bit, and none is a
// script (.js, .mjs, .cjs, .ts, .sh or .py).
//
//   node scripts/gate-skills.ts

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const SCRIPT = /\.(?:js|mjs|cjs|ts|sh|py)$/i;

// `git ls-files -s` prints "<mode> <object> <stage>\t<path>" for each tracked file.
const entries = execFileSync("git", ["ls-files", "-s", "-z", "--", "skills"], { cwd: root })
  .toString()
  .split("\0")
  .filter((e) => e !== "");

const problems: string[] = [];
for (const entry of entries) {
  const tab = entry.indexOf("\t");
  const mode = entry.slice(0, entry.indexOf(" "));
  const path = entry.slice(tab + 1);
  if (mode === "100755") problems.push(`${path}: has the executable bit`);
  if (SCRIPT.test(path)) problems.push(`${path}: is a script file`);
}

if (problems.length > 0) {
  console.error("skills gate:");
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`skills gate: ${entries.length} files under skills/, none executable or a script`);
