// SPDX-License-Identifier: AGPL-3.0-only

// A portable seeded PRNG (sfc32).
//
// Python's `random.Random` is a Mersenne Twister with SHA-512 string
// seeding and cannot be reproduced bit for bit, so seeded builds that use the
// RNG differ from the Python implementation. The same seed always gives the
// same sequence here, on every platform.

import { sha256 } from "./sha256.ts";

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  /** Seed from any string. Equal strings give equal sequences. */
  constructor(seed: string) {
    const h = new DataView(sha256(new TextEncoder().encode(seed)).buffer);
    this.a = h.getUint32(0);
    this.b = h.getUint32(4);
    this.c = h.getUint32(8);
    this.d = h.getUint32(12);
    for (let i = 0; i < 12; i++) this.nextUint32(); // warm up
  }

  /** A generator seeded from the system's entropy source. */
  static unseeded(): Rng {
    const words = globalThis.crypto.getRandomValues(new Uint32Array(4));
    return new Rng(Array.from(words).join(","));
  }

  nextUint32(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** A float in [0, 1). */
  random(): number {
    return this.nextUint32() / 0x100000000;
  }

  /** A float in [a, b). */
  uniform(a: number, b: number): number {
    return a + (b - a) * this.random();
  }

  /** An integer in [lo, hi], both inclusive. */
  int(lo: number, hi: number): number {
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || hi < lo) {
      throw new RangeError(`int: need integers with hi >= lo, got ${lo}, ${hi}`);
    }
    return lo + Math.floor(this.random() * (hi - lo + 1));
  }

  choice<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError("choice: empty sequence");
    return items[Math.floor(this.random() * items.length)] as T;
  }

  /** Fisher-Yates shuffle, in place. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [items[i], items[j]] = [items[j] as T, items[i] as T];
    }
    return items;
  }
}
