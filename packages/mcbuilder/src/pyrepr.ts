// SPDX-License-Identifier: AGPL-3.0-only

// Python's `repr` for strings and lists of strings, so error messages read
// the same as the original's.

export function pyRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number;
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += `\\${ch}`;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (cp < 0x20 || cp === 0x7f) out += `\\x${cp.toString(16).padStart(2, "0")}`;
    else out += ch;
  }
  return quote + out + quote;
}

export const pyReprList = (items: readonly string[]): string => `[${items.map(pyRepr).join(", ")}]`;
