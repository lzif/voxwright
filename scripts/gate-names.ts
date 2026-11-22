// SPDX-License-Identifier: AGPL-3.0-only

// The name gate: no tracked path and no tracked file content at HEAD may carry an old project name.
// Exceptions are listed by path below and nowhere else.
//
//   node scripts/gate-names.ts
//
// The pattern is built from fragments so that this file does not match itself.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
// Case-insensitive; the second alternative also covers the longer old name with an `er` suffix.
const OLD_NAMES = new RegExp([["vox", "wright"].join(""), ["mc", "build"].join("")].join("|"), "i");

/** Where an old name is allowed. Every other tracked file and path must be clean. */
const EXCEPTIONS: { path: string; lines?: (all: string[]) => Set<number> }[] = [
  // The migration table names what changed, so only the 0.0.4 section (to the next `## `) may.
  { path: "CHANGELOG.md", lines: section("## 0.0.4") },
  // The time-boxed tombstones (removed at 0.1.0) have to spell the names they reject.
  { path: "packages/voxmc/src/node/skill/tombstones.ts" },
];

/** The 1-based line numbers from the heading that starts with `heading` to the next `## ` heading. */
function section(heading: string): (all: string[]) => Set<number> {
  return (all) => {
    const lines = new Set<number>();
    let inside = false;
    all.forEach((line, i) => {
      if (line.startsWith("## ")) inside = line.startsWith(heading);
      if (inside) lines.add(i + 1);
    });
    return lines;
  };
}

const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, maxBuffer: 1 << 28 })
  .toString("latin1")
  .split("\0")
  .filter((f) => f !== "");

const hits: string[] = [];
for (const file of files) {
  const exception = EXCEPTIONS.find((e) => e.path === file);
  if (OLD_NAMES.test(file)) hits.push(`${file}: the path itself`);
  if (exception !== undefined && exception.lines === undefined) continue;
  // latin1 keeps every byte, so binary files are scanned too and nothing is skipped as unreadable.
  let text: string;
  try {
    text = readFileSync(join(root, file)).toString("latin1");
  } catch {
    continue; // listed in the index but deleted in the working tree
  }
  const all = text.split("\n");
  const allowed = exception?.lines?.(all) ?? new Set<number>();
  all.forEach((line, i) => {
    if (OLD_NAMES.test(line) && !allowed.has(i + 1)) {
      hits.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
    }
  });
}

if (hits.length > 0) {
  console.error(`name gate: ${hits.length} hit(s) of an old project name:`);
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.log(
  `name gate: ${files.length} tracked paths and their contents are clean (exceptions: ${EXCEPTIONS.map((e) => e.path).join(", ")})`,
);
