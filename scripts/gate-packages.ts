// SPDX-License-Identifier: AGPL-3.0-only

// Workspace package names: no duplicates, and none (apart from the root, which is private) named
// `voxmc`, the name of the npm package built by scripts/pack-npm.ts.
//
//   node scripts/gate-packages.ts

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const NPM_NAME = "voxmc";

const manifests = execFileSync("git", ["ls-files", "-z", "--", "package.json", "**/package.json"], {
  cwd: root,
})
  .toString()
  .split("\0")
  .filter((f) => f !== "");

const seen = new Map<string, string>();
const problems: string[] = [];
for (const file of manifests) {
  const { name } = JSON.parse(readFileSync(join(root, file), "utf8")) as { name?: string };
  if (name === undefined) continue;
  const earlier = seen.get(name);
  if (earlier !== undefined)
    problems.push(`${file}: the name '${name}' is already used by ${earlier}`);
  seen.set(name, file);
  if (name === NPM_NAME && file !== "package.json") {
    problems.push(`${file}: a workspace package must not be named '${NPM_NAME}'`);
  }
}

if (problems.length > 0) {
  console.error("package name gate:");
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(
  `package name gate: ${seen.size} package names, all distinct: ${[...seen.keys()].join(", ")}`,
);
