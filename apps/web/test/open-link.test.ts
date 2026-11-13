// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { fetchOpenLink, resolveOpenLink } from "../src/lib/open-link.ts";

const page = "http://127.0.0.1:4173/voxwright/";

describe("resolveOpenLink", () => {
  it("returns null without ?open=", () => {
    expect(resolveOpenLink(page)).toBeNull();
    expect(resolveOpenLink(`${page}?open=`)).toBeNull();
    expect(resolveOpenLink(`${page}?e2e`)).toBeNull();
  });

  it("resolves a relative value against the page", () => {
    const link = resolveOpenLink(`${page}?open=__preview/house.schem&e2e`);
    expect(link).toEqual({
      url: new URL("http://127.0.0.1:4173/voxwright/__preview/house.schem"),
      name: "house.schem",
    });
  });

  it("decodes the file name as the CLI encodes it", () => {
    const link = resolveOpenLink(`${page}?open=__preview/my%2520house%2523.litematic`);
    expect(link).toMatchObject({ name: "my house#.litematic" });
    expect((link as { url: URL }).url.pathname).toBe(
      "/voxwright/__preview/my%20house%23.litematic",
    );
  });

  it("accepts an absolute same-origin URL", () => {
    expect(
      resolveOpenLink(`${page}?open=${encodeURIComponent("http://127.0.0.1:4173/x.nbt")}`),
    ).toMatchObject({
      name: "x.nbt",
    });
  });

  it("refuses other origins and schemes", () => {
    for (const v of [
      "https://evil.example/x.schem",
      "//evil.example/x.schem",
      "http://127.0.0.1:9999/x.schem",
      "https://127.0.0.1:4173/x.schem",
      "data:application/octet-stream;base64,AAAA",
      "javascript:alert(1)",
    ]) {
      const link = resolveOpenLink(`${page}?open=${encodeURIComponent(v)}`);
      expect(link, v).toHaveProperty("error");
      expect((link as { error: string }).error, v).toContain(
        "Only files from this site (http://127.0.0.1:4173) can be opened from a link",
      );
    }
  });
});

describe("fetchOpenLink", () => {
  const link = { url: new URL("http://127.0.0.1:4173/__preview/a.schem"), name: "a.schem" };

  it("downloads the bytes into a File, bypassing the HTTP cache", async () => {
    let init: RequestInit | undefined;
    const fake = (async (_u: unknown, i?: RequestInit) => {
      init = i;
      return new Response(new Uint8Array([1, 2, 3]));
    }) as typeof fetch;
    const f = await fetchOpenLink(link, fake);
    expect(f.name).toBe("a.schem");
    expect(new Uint8Array(await f.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(init?.cache).toBe("no-store");
  });

  it("reports HTTP errors and network failures by file name", async () => {
    const notFound = (async () => new Response("no", { status: 404 })) as typeof fetch;
    await expect(fetchOpenLink(link, notFound)).rejects.toThrow(
      "a.schem could not be downloaded from the link (HTTP 404",
    );
    const down = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    await expect(fetchOpenLink(link, down)).rejects.toThrow("Failed to fetch");
  });
});
