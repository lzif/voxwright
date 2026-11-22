// SPDX-License-Identifier: AGPL-3.0-only

// The dependency rules cannot pass vacuously: every rule with a `from.path` must match at least one
// module that dependency-cruiser actually cruised. A rule whose path no longer matches anything
// (after a directory move, say) would otherwise allow every violation it was written to stop.
//
//   node scripts/gate-depcruise.ts

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const configFile = join(root, ".dependency-cruiser.cjs");

interface Rule {
  name: string;
  from?: { path?: string | string[] };
}
const config = require(configFile) as { forbidden?: Rule[] };

const cruiser = join(root, "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs");
const json = execFileSync(
  process.execPath,
  [cruiser, "--config", configFile, "--output-type", "json", "."],
  { cwd: root, maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "inherit"] },
).toString();
const sources = (JSON.parse(json) as { modules: { source: string }[] }).modules.map(
  (m) => m.source,
);

const problems: string[] = [];
const lines: string[] = [];
for (const rule of config.forbidden ?? []) {
  const patterns = [rule.from?.path ?? []].flat();
  if (patterns.length === 0) {
    lines.push(`${rule.name}: no from.path (applies to every module)`);
    continue;
  }
  for (const pattern of patterns) {
    const re = new RegExp(pattern);
    const n = sources.filter((s) => re.test(s)).length;
    lines.push(`${rule.name}: from.path ${pattern} matches ${n} modules`);
    if (n === 0) problems.push(`${rule.name}: from.path ${pattern} matches no module`);
  }
}

if (problems.length > 0) {
  console.error("dependency rule gate (vacuous rules):");
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`dependency rule gate: ${sources.length} modules cruised`);
for (const l of lines) console.log(`  ${l}`);
