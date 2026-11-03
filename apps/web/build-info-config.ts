// SPDX-License-Identifier: AGPL-3.0-only

// Resolve the footer's source link at build time. Read by vite.config.ts; runs in Node.
//
//   VOXWRIGHT_SOURCE_URL   the repository of the source this site runs (default: the upstream one)
//   VOXWRIGHT_COMMIT       the commit the site is built from (default: `git rev-parse HEAD`, if any)
//   VOXWRIGHT_SOURCE_LINK  the full link to put in the footer, for forges whose commit pages do not
//                          look like GitHub's `<repository>/tree/<commit>`

export const DEFAULT_SOURCE_URL = "https://github.com/lzif/voxwright";

export interface BuildInfo {
  sourceUrl: string;
  sourceLink: string;
  commit: string;
  modified: boolean;
  version: string;
}

export interface BuildInfoInputs {
  env: Record<string, string | undefined>;
  /** `git rev-parse HEAD`, or `null` when this is not a git checkout. */
  gitCommit: () => string | null;
  /** Does `git status --porcelain` list anything? */
  gitModified: () => boolean;
  version: string;
}

function httpUrl(name: string, value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} is not a URL: ${value}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new Error(`${name} must be an http or https URL: ${value}`);
  return url.href.replace(/\/+$/, "");
}

export function resolveBuildInfo({
  env,
  gitCommit,
  gitModified,
  version,
}: BuildInfoInputs): BuildInfo {
  const sourceUrl = httpUrl("VOXWRIGHT_SOURCE_URL", env.VOXWRIGHT_SOURCE_URL || DEFAULT_SOURCE_URL);
  const given = env.VOXWRIGHT_COMMIT?.trim();
  const commit = given || gitCommit() || "";
  if (commit && !/^[0-9a-zA-Z._-]{4,64}$/.test(commit))
    throw new Error(`VOXWRIGHT_COMMIT is not a commit id: ${commit}`);
  const sourceLink = env.VOXWRIGHT_SOURCE_LINK
    ? httpUrl("VOXWRIGHT_SOURCE_LINK", env.VOXWRIGHT_SOURCE_LINK)
    : commit
      ? `${sourceUrl}/tree/${commit}`
      : sourceUrl;
  // A commit named by the builder is taken as accurate; a commit read from git may not describe
  // the files if the tree has uncommitted changes.
  const modified = !given && commit !== "" && gitModified();
  return { sourceUrl, sourceLink, commit, modified, version };
}
