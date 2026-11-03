// SPDX-License-Identifier: AGPL-3.0-only
import { type ReadOptions, readNbt } from "./reader.ts";
import type { NbtRoot } from "./types.ts";
import { type WriteOptions, writeNbt } from "./writer.ts";

async function pipe(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  // Cast: the DOM and Node typings disagree about the stream's chunk type; both are bytes.
  const out = source.pipeThrough(stream as unknown as TransformStream<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

export function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  return pipe(bytes, new CompressionStream("gzip"));
}

export function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  return pipe(bytes, new DecompressionStream("gzip"));
}

/** Read NBT that may or may not be gzipped; gzip is detected by its magic bytes. */
export async function readNbtFile(bytes: Uint8Array, options: ReadOptions = {}): Promise<NbtRoot> {
  return readNbt(isGzip(bytes) ? await gunzip(bytes) : bytes, options);
}

/** Encode a named compound as gzipped NBT. */
export async function writeNbtGzip(root: NbtRoot, options: WriteOptions = {}): Promise<Uint8Array> {
  return gzip(writeNbt(root, options));
}
