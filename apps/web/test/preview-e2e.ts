// SPDX-License-Identifier: AGPL-3.0-only

// End-to-end test of `voxwright-cli preview`: start the committed skill CLI on a real schematic,
// open the address it prints in Chrome, and check that the page opened the file from the
// `?open=` link, with WebGL2 and with the software renderer.
//
//   node test/preview-e2e.ts [--chromium <path>]
//
// Build the site first (`pnpm --filter @voxwright/web build`): the CLI serves that build.

import { type ChildProcess, spawn } from "node:child_process";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import puppeteer from "puppeteer-core";
import { chromiumArgs, findChromium } from "./site.ts";

const { values } = parseArgs({ options: { chromium: { type: "string" } } });
const chromium = findChromium(values.chromium);
const repo = fileURLToPath(new URL("../../../", import.meta.url));
const CLI = join(repo, "skills/voxwright/scripts/voxwright-cli.mjs");
const FIXTURE = join(repo, "fixtures/real/rafeals-house/Rafeals_house.litematic");

const checks: string[] = [];
const ok = (cond: unknown, what: string): void => {
  if (!cond) throw new Error(`FAILED: ${what}`);
  checks.push(what);
};

/** Start `preview` and wait for the address it prints. */
async function startPreview(file: string): Promise<{ url: string; child: ChildProcess }> {
  const child = spawn(process.execPath, [CLI, "preview", file, "--no-open", "--port", "0"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  let err = "";
  child.stderr?.on("data", (d: Buffer) => {
    err += d;
  });
  const url = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`preview printed no URL:\n${out}${err}`)),
      30_000,
    );
    child.stdout?.on("data", (d: Buffer) => {
      out += d;
      const m = /^Preview URL: (\S+)$/m.exec(out);
      if (m && /^Web app: .+$/m.test(out)) {
        clearTimeout(timer);
        resolve(m[1] as string);
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`preview exited with code ${code}:\n${out}${err}`));
    });
  });
  ok(/^Web app: local build at /m.test(out), "preview serves the local build of this checkout");
  return { url, child };
}

async function suite(url: string, name: string, webgl: boolean): Promise<void> {
  const label = webgl ? "webgl" : "cpu";
  const t = (what: string): string => `[${label}] ${what}`;
  const browser = await puppeteer.launch({
    executablePath: chromium,
    headless: true,
    args: chromiumArgs(webgl),
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const bad: string[] = [];
    page.on("response", (r) => {
      // The site has no favicon; the browser asks for one anyway.
      if (r.status() >= 400 && !r.url().endsWith("/favicon.ico"))
        bad.push(`${r.status()} ${r.url()}`);
    });

    await page.goto(url, { waitUntil: "load" });
    const status = (): Promise<string> =>
      page.$eval('[data-testid="status"]', (e) => e.textContent ?? "");
    await page.waitForFunction(
      (n: string) =>
        (document.querySelector('[data-testid="status"]')?.textContent ?? "").startsWith(`${n}: `),
      { timeout: 60_000 },
      name,
    );
    const opened = await status();
    ok(/: 32 × 16 × 32, \d+ blocks/.test(opened), t(`the linked file is open (${opened})`));
    ok((await page.$('[data-testid="error"]')) === null, t("no error is shown"));
    ok(new URL(page.url()).searchParams.get("open") !== null, t("?open= stays in the address"));

    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(
      (n: string) =>
        (document.querySelector('[data-testid="status"]')?.textContent ?? "").startsWith(`${n}: `),
      { timeout: 60_000 },
      name,
    );
    ok(true, t("a refresh opens the file again"));

    // A link to another site is refused, and nothing is fetched from it.
    const foreign = new URL(url);
    foreign.searchParams.set("open", "https://example.com/x.schem");
    const requested: string[] = [];
    page.on("request", (r) => requested.push(r.url()));
    await page.goto(foreign.href, { waitUntil: "load" });
    await page.waitForSelector('[data-testid="error"]', { timeout: 30_000 });
    const message = await page.$eval('[data-testid="error"]', (e) => e.textContent ?? "");
    ok(
      message.includes("Only files from this site"),
      t("a link to another origin is refused with an explanation"),
    );
    ok(!requested.some((u) => u.startsWith("https://example.com")), t("and is never requested"));

    ok(bad.length === 0, t(`no request failed (${bad.join(", ") || "none"})`));
    ok(errors.length === 0, t(`no page errors (${errors.join("; ") || "none"})`));
  } finally {
    await browser.close();
  }
}

const dir = await mkdtemp(join(tmpdir(), "voxwright-preview-e2e-"));
// A name with a space and a `#`: the link has to escape it and the page has to undo that.
const name = "my house #1.litematic";
const file = join(dir, name);
await copyFile(FIXTURE, file);
const { url, child } = await startPreview(file);
try {
  ok(url.includes("?open=__preview/"), `preview prints a link with ?open= (${url})`);
  await suite(url, name, true);
  await suite(url, name, false);
} finally {
  child.kill("SIGINT");
  await rm(dir, { recursive: true, force: true });
}
for (const c of checks) console.log(`ok  ${c}`);
console.log(`\n${checks.length} checks passed`);
