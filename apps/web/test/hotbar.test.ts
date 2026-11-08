// SPDX-License-Identifier: AGPL-3.0-only

// The hotbar's lists: recents (last 8 distinct, newest first), favourites (toggled, capped at 32)
// and the way both are read from and written to browser storage.

import { describe, expect, it } from "vitest";
import {
  type BlockStore,
  FAVORITE_KEY,
  FAVORITE_LIMIT,
  favoritesFull,
  hotbarBlocks,
  isFavorite,
  loadBlockList,
  parseBlockList,
  pushRecent,
  RECENT_KEY,
  RECENT_LIMIT,
  recordable,
  saveBlockList,
  serializeBlockList,
  shortName,
  toggleFavorite,
} from "../src/lib/hotbar.ts";

const block = (i: number): string => `minecraft:block_${i}`;
const memory = (
  initial: Record<string, string> = {},
): BlockStore & { data: Map<string, string> } => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
};

describe("storage keys", () => {
  it("are the ones the browser keeps", () => {
    expect(RECENT_KEY).toBe("voxwright.recentblocks");
    expect(FAVORITE_KEY).toBe("voxwright.favoriteblocks");
    expect(RECENT_LIMIT).toBe(8);
    expect(FAVORITE_LIMIT).toBe(32);
  });
});

describe("recordable", () => {
  it("keeps the name and properties as the session stores them", () => {
    expect(recordable("minecraft:oak_stairs[facing=north,half=bottom]")).toBe(
      "minecraft:oak_stairs[facing=north,half=bottom]",
    );
    expect(recordable("minecraft:stone")).toBe("minecraft:stone");
  });
  it("drops block-entity NBT", () => {
    expect(recordable('minecraft:chest[facing=north]{Items:[{id:"minecraft:stone"}]}')).toBe(
      "minecraft:chest[facing=north]",
    );
  });
  it("refuses nothing, air, whitespace, control characters and very long strings", () => {
    expect(recordable("")).toBeNull();
    expect(recordable("   ")).toBeNull();
    expect(recordable("minecraft:air")).toBeNull();
    expect(recordable("minecraft:air[x=1]")).toBeNull();
    expect(recordable("minecraft:oak planks")).toBeNull();
    expect(recordable("minecraft:stone\u0007")).toBeNull();
    expect(recordable(`minecraft:${"a".repeat(300)}`)).toBeNull();
  });
});

describe("pushRecent", () => {
  it("puts the newest first", () => {
    expect(pushRecent([block(1), block(2)], block(3))).toEqual([block(3), block(1), block(2)]);
  });
  it("moves a block that is already there to the front, without a repeat", () => {
    expect(pushRecent([block(1), block(2), block(3)], block(3))).toEqual([
      block(3),
      block(1),
      block(2),
    ]);
    expect(pushRecent([block(1)], block(1))).toEqual([block(1)]);
  });
  it("keeps the last 8 distinct blocks", () => {
    let list: string[] = [];
    for (let i = 1; i <= 12; i++) list = pushRecent(list, block(i));
    expect(list).toHaveLength(RECENT_LIMIT);
    expect(list[0]).toBe(block(12));
    expect(list[7]).toBe(block(5));
    // Choosing an old one again rescues it from the end of the list.
    list = pushRecent(list, block(5));
    expect(list[0]).toBe(block(5));
    expect(list).toHaveLength(RECENT_LIMIT);
    expect(new Set(list).size).toBe(RECENT_LIMIT);
  });
  it("treats the same block with other properties as another block", () => {
    const a = "minecraft:oak_stairs[facing=north]";
    const b = "minecraft:oak_stairs[facing=east]";
    expect(pushRecent([a], b)).toEqual([b, a]);
  });
  it("records without NBT and ignores what is not a block", () => {
    expect(pushRecent([], "minecraft:chest{Items:[]}")).toEqual(["minecraft:chest"]);
    expect(pushRecent([block(1)], "minecraft:air")).toEqual([block(1)]);
    expect(pushRecent([block(1)], "")).toEqual([block(1)]);
  });
  it("does not change the list it was given", () => {
    const list = [block(1)];
    pushRecent(list, block(2));
    expect(list).toEqual([block(1)]);
  });
});

describe("toggleFavorite", () => {
  it("stars a block at the end of the list and unstars it on the next toggle", () => {
    const one = toggleFavorite([], block(1));
    const two = toggleFavorite(one, block(2));
    expect(two).toEqual([block(1), block(2)]);
    expect(isFavorite(two, block(2))).toBe(true);
    expect(toggleFavorite(two, block(1))).toEqual([block(2)]);
    expect(isFavorite(toggleFavorite(two, block(1)), block(1))).toBe(false);
  });
  it("refuses a 33rd star but still lets one be removed", () => {
    let list: string[] = [];
    for (let i = 0; i < FAVORITE_LIMIT; i++) list = toggleFavorite(list, block(i));
    expect(list).toHaveLength(FAVORITE_LIMIT);
    expect(favoritesFull(list)).toBe(true);
    expect(toggleFavorite(list, block(99))).toEqual(list);
    const fewer = toggleFavorite(list, block(0));
    expect(fewer).toHaveLength(FAVORITE_LIMIT - 1);
    expect(favoritesFull(fewer)).toBe(false);
  });
  it("ignores what is not a block", () => {
    expect(toggleFavorite([block(1)], "minecraft:air")).toEqual([block(1)]);
  });
});

describe("hotbarBlocks", () => {
  it("lists the favourites first, then the recents that are not favourites", () => {
    expect(hotbarBlocks([block(1), block(2)], [block(3), block(2), block(4)])).toEqual([
      { block: block(1), favorite: true },
      { block: block(2), favorite: true },
      { block: block(3), favorite: false },
      { block: block(4), favorite: false },
    ]);
  });
  it("is empty with nothing", () => {
    expect(hotbarBlocks([], [])).toEqual([]);
  });
});

describe("shortName", () => {
  it("drops the namespace of minecraft only", () => {
    expect(shortName("minecraft:oak_planks")).toBe("oak_planks");
    expect(shortName("minecraft:oak_stairs[facing=north]")).toBe("oak_stairs[facing=north]");
    expect(shortName("mod:thing")).toBe("mod:thing");
  });
});

describe("reading a stored list", () => {
  it("round-trips what it wrote", () => {
    const list = [block(1), "minecraft:oak_stairs[facing=north,half=bottom]"];
    expect(parseBlockList(serializeBlockList(list), 8)).toEqual(list);
  });
  it("reads a missing value as empty", () => {
    expect(parseBlockList(null, 8)).toEqual([]);
    expect(parseBlockList(undefined, 8)).toEqual([]);
    expect(parseBlockList("", 8)).toEqual([]);
  });
  it("ignores damaged text and values of the wrong shape", () => {
    expect(parseBlockList("{not json", 8)).toEqual([]);
    expect(parseBlockList("null", 8)).toEqual([]);
    expect(parseBlockList("42", 8)).toEqual([]);
    expect(parseBlockList('{"a":1}', 8)).toEqual([]);
    expect(parseBlockList('"minecraft:stone"', 8)).toEqual([]);
  });
  it("drops entries that are not blocks, repeats, and ones that are not canonical", () => {
    const text = JSON.stringify([
      "minecraft:stone",
      42,
      null,
      "",
      "minecraft:air",
      "minecraft:stone",
      " minecraft:dirt",
      "minecraft:chest{Items:[]}",
      "minecraft:oak planks",
      { block: "minecraft:glass" },
      "minecraft:glass",
    ]);
    expect(parseBlockList(text, 8)).toEqual(["minecraft:stone", "minecraft:glass"]);
  });
  it("cuts a long list to the limit", () => {
    const text = JSON.stringify(Array.from({ length: 50 }, (_, i) => block(i)));
    expect(parseBlockList(text, RECENT_LIMIT)).toHaveLength(RECENT_LIMIT);
    expect(parseBlockList(text, FAVORITE_LIMIT)).toHaveLength(FAVORITE_LIMIT);
    expect(parseBlockList(text, RECENT_LIMIT)[0]).toBe(block(0));
  });
  it("ignores an oversized stored value", () => {
    const huge = JSON.stringify(Array.from({ length: 5000 }, (_, i) => block(i)));
    expect(huge.length).toBeGreaterThan(10000);
    expect(parseBlockList(huge, FAVORITE_LIMIT)).toEqual([]);
    expect(parseBlockList(JSON.stringify([`minecraft:${"a".repeat(5000)}`]), 8)).toEqual([]);
  });
});

describe("browser storage", () => {
  it("loads what save wrote", () => {
    const store = memory();
    expect(saveBlockList(store, RECENT_KEY, [block(1), block(2)])).toBe(true);
    expect(loadBlockList(store, RECENT_KEY, RECENT_LIMIT)).toEqual([block(1), block(2)]);
    expect(store.data.get(RECENT_KEY)).toBe(JSON.stringify([block(1), block(2)]));
  });
  it("reads a corrupt stored value as empty", () => {
    const store = memory({ [FAVORITE_KEY]: "][ definitely not json" });
    expect(loadBlockList(store, FAVORITE_KEY, FAVORITE_LIMIT)).toEqual([]);
  });
  it("works without a storage and with one that throws", () => {
    expect(loadBlockList(null, RECENT_KEY, 8)).toEqual([]);
    expect(saveBlockList(null, RECENT_KEY, [block(1)])).toBe(false);
    const broken: BlockStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(loadBlockList(broken, RECENT_KEY, 8)).toEqual([]);
    expect(saveBlockList(broken, RECENT_KEY, [block(1)])).toBe(false);
  });
});
