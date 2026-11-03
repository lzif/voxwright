// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { DEFAULT_SOURCE_URL, resolveBuildInfo } from "../build-info-config.ts";

const git = (commit: string | null, modified = false) => ({
  gitCommit: () => commit,
  gitModified: () => modified,
  version: "0.0.0",
});

describe("resolveBuildInfo", () => {
  it("defaults to the upstream repository and the git commit", () => {
    const i = resolveBuildInfo({ env: {}, ...git("abc1234def") });
    expect(i.sourceUrl).toBe(DEFAULT_SOURCE_URL);
    expect(DEFAULT_SOURCE_URL).toBe("https://github.com/lzif/voxwright");
    expect(i.commit).toBe("abc1234def");
    expect(i.sourceLink).toBe(`${DEFAULT_SOURCE_URL}/tree/abc1234def`);
    expect(i.modified).toBe(false);
  });

  it("links to the repository when there is no commit", () => {
    const i = resolveBuildInfo({ env: {}, ...git(null) });
    expect(i.commit).toBe("");
    expect(i.sourceLink).toBe(DEFAULT_SOURCE_URL);
    expect(i.modified).toBe(false);
  });

  it("lets a self-hoster point at their own source", () => {
    const i = resolveBuildInfo({
      env: {
        VOXWRIGHT_SOURCE_URL: "https://git.example.org/me/voxwright/",
        VOXWRIGHT_COMMIT: "1234abcd",
      },
      ...git("ffffffff", true),
    });
    expect(i.sourceUrl).toBe("https://git.example.org/me/voxwright");
    expect(i.sourceLink).toBe("https://git.example.org/me/voxwright/tree/1234abcd");
    expect(i.commit).toBe("1234abcd");
    expect(i.modified).toBe(false); // the builder named the commit
  });

  it("takes a full link for forges with other commit URLs", () => {
    const i = resolveBuildInfo({
      env: { VOXWRIGHT_SOURCE_LINK: "https://git.example.org/me/voxwright/-/commit/1234abcd" },
      ...git("1234abcd"),
    });
    expect(i.sourceLink).toBe("https://git.example.org/me/voxwright/-/commit/1234abcd");
  });

  it("notes a commit read from git whose tree has uncommitted changes", () => {
    expect(resolveBuildInfo({ env: {}, ...git("abc1234def", true) }).modified).toBe(true);
  });

  it("refuses links that are not http(s) and commits that are not ids", () => {
    expect(() =>
      resolveBuildInfo({ env: { VOXWRIGHT_SOURCE_URL: "javascript:alert(1)" }, ...git(null) }),
    ).toThrow(/http/);
    expect(() =>
      resolveBuildInfo({ env: { VOXWRIGHT_SOURCE_URL: "not a url" }, ...git(null) }),
    ).toThrow(/URL/);
    expect(() => resolveBuildInfo({ env: { VOXWRIGHT_COMMIT: "a b; rm" }, ...git(null) })).toThrow(
      /commit/,
    );
  });
});
