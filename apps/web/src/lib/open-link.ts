// SPDX-License-Identifier: AGPL-3.0-only

// `?open=<url>`: open a schematic from this site when the page starts. `voxwright-cli preview` links
// here with `?open=__preview/<file name>`. Only files from the page's own origin are fetched, so a
// link from elsewhere cannot make the page download anything from a third party.

/** What the address asks for: nothing, a file to fetch, or a refusal to show the user. */
export type OpenLink = null | { url: URL; name: string } | { error: string };

/** Read `?open=` from the page address and resolve it against that address. */
export function resolveOpenLink(pageUrl: string | URL): OpenLink {
  const page = new URL(pageUrl);
  const value = page.searchParams.get("open");
  if (value === null || value.trim() === "") return null;
  let url: URL;
  try {
    url = new URL(value, page);
  } catch {
    return { error: `The link asks to open "${value}", which is not a valid address.` };
  }
  if (url.origin !== page.origin || (url.protocol !== "http:" && url.protocol !== "https:")) {
    return {
      error: `The link asks to open a file from ${url.origin === "null" ? url.protocol : url.origin}. Only files from this site (${page.origin}) can be opened from a link; download the file and open it here instead.`,
    };
  }
  return { url, name: fileName(url) };
}

/** The last path segment, decoded: the name the file is shown and exported under. */
function fileName(url: URL): string {
  const last = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
  try {
    return decodeURIComponent(last) || "structure";
  } catch {
    return last || "structure";
  }
}

/** Download the linked file. Never cached: `preview` serves the newest build on every load. */
export async function fetchOpenLink(
  link: { url: URL; name: string },
  fetchFn: typeof fetch = fetch,
): Promise<File> {
  let res: Response;
  try {
    res = await fetchFn(link.url, { cache: "no-store" });
  } catch (err) {
    throw new Error(
      `${link.name} could not be downloaded from the link: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok)
    throw new Error(
      `${link.name} could not be downloaded from the link (HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}).`,
    );
  return new File([await res.arrayBuffer()], link.name);
}
