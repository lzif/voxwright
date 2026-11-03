// SPDX-License-Identifier: AGPL-3.0-only
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { NbtTag } from "../src/index.ts";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

export function loadVector<T>(name: string): T {
  return JSON.parse(readFileSync(`${repoRoot}vectors/${name}`, "utf8")) as T;
}

export function loadFixture(path: string): Uint8Array {
  return new Uint8Array(readFileSync(`${repoRoot}fixtures/${path}`));
}

/** Plain-JSON view of a tag, the same shape the vector exporter writes. */
export function tagToJson(tag: NbtTag): unknown {
  switch (tag.type) {
    case "compound":
      return Object.fromEntries([...tag.value].map(([k, v]) => [k, tagToJson(v)]));
    case "list":
      return tag.value.map(tagToJson);
    case "long":
      return Number(tag.value);
    case "byteArray":
    case "intArray":
    case "longArray":
      return Array.from(tag.value as ArrayLike<number | bigint>).map(Number);
    default:
      return tag.value;
  }
}

export function fromBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}
