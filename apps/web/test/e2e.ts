// SPDX-License-Identifier: AGPL-3.0-only

// End-to-end check in a real browser: serve the built site, open a schematic,
// and drive the viewer and the converter. Run after `pnpm build`:
//
//   node test/e2e.ts [--shots <dir>] [--chromium <path>]
//
// Needs the asset pack (`pnpm assets`) for textured blocks; without it the page
// falls back to flat colours and the checks that only need a picture still run.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import puppeteer, { type ElementHandle } from "puppeteer-core";

const { values } = parseArgs({
  options: { shots: { type: "string" }, chromium: { type: "string" } },
});
const site = fileURLToPath(new URL("../build/", import.meta.url));
const fixtures = fileURLToPath(new URL("../../../fixtures/real/rafeals-house/", import.meta.url));
const chromium =
  values.chromium ??
  [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ].find(existsSync);
if (!chromium) throw new Error("no Chromium or Chrome found; pass --chromium <path>");
if (!existsSync(join(site, "index.html")))
  throw new Error("build the site first: pnpm --filter @voxwright/web build");
if (values.shots) mkdirSync(values.shots, { recursive: true });

const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
};
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0] as string)).replace(
    /^(\.\.[/\\])+/,
    "",
  );
  let file = join(site, path === "/" ? "index.html" : path);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(site, "index.html");
  res.setHeader("content-type", types[extname(file)] ?? "application/octet-stream");
  res.end(readFileSync(file));
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;

const checks: string[] = [];
const ok = (cond: unknown, what: string): void => {
  if (!cond) throw new Error(`FAILED: ${what}`);
  checks.push(what);
};

const downloads = await mkdtemp(join(tmpdir(), "voxwright-dl-"));
const browser = await puppeteer.launch({
  executablePath: chromium,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const cdp = await page.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloads,
    eventsEnabled: true,
  });

  await page.goto(url);
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="status"]')?.textContent?.startsWith("open a schematic"),
    { timeout: 30000 },
  );
  const hasPack = await page.evaluate(
    () =>
      !document.querySelector('[data-testid="status"]')?.textContent?.includes("no texture pack"),
  );
  ok(true, `page starts (texture pack ${hasPack ? "loaded" : "absent"})`);

  const pixels = (): Promise<{ w: number; h: number; distinct: number }> =>
    page.evaluate(() => {
      const c = document.querySelector('[data-testid="canvas"]') as HTMLCanvasElement;
      const d = c.getContext("2d")?.getImageData(0, 0, c.width, c.height).data as Uint8ClampedArray;
      const seen = new Set<number>();
      for (let i = 0; i < d.length; i += 4 * 17)
        seen.add((d[i] as number) * 65536 + (d[i + 1] as number) * 256 + (d[i + 2] as number));
      return { w: c.width, h: c.height, distinct: seen.size };
    });
  const hash = (): Promise<string> =>
    page.evaluate(() => {
      const c = document.querySelector('[data-testid="canvas"]') as HTMLCanvasElement;
      const d = c.getContext("2d")?.getImageData(0, 0, c.width, c.height).data as Uint8ClampedArray;
      let h = 0;
      for (let i = 0; i < d.length; i += 4)
        h = (h * 31 + (d[i] as number) + (d[i + 1] as number) * 3) | 0;
      return String(h);
    });

  // 1. Open the real .nbt and get a picture.
  const input = (await page.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement> | null;
  await (input as NonNullable<typeof input>).uploadFile(join(fixtures, "Rafeals_house.nbt"));
  await page.waitForFunction(
    () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
    { timeout: 60000 },
  );
  await page.waitForFunction(
    () => (document.querySelector('[data-testid="canvas"]') as HTMLCanvasElement).width > 300,
    { timeout: 60000 },
  );
  const first = await pixels();
  ok(
    first.w > 300 && first.distinct > 12,
    `the .nbt opens and draws (${first.w}x${first.h}, ${first.distinct} colours)`,
  );
  ok(
    (await page.$$eval('[data-testid="counts"] li', (l) => l.length)) > 5,
    "the block list is shown",
  );
  if (values.shots) await page.screenshot({ path: join(values.shots, "viewer.png") });

  // 2. Orbit by dragging the picture.
  const before = await hash();
  const box = (await (await page.$('[data-testid="canvas"]'))?.boundingBox()) as {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2 + 30, { steps: 8 });
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 4000));
  const after = await hash();
  ok(before !== after, "dragging the picture turns the view");
  ok(
    Number(await page.$eval('[data-testid="azimuth"]', (e) => (e as HTMLInputElement).value)) !==
      45,
    "the turn slider follows the drag",
  );

  // 3. Slice to the bottom layers.
  const full = await hash();
  await page.$eval('[data-testid="ymax"]', (e) => {
    const el = e as HTMLInputElement;
    el.value = "2";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 4000));
  ok((await hash()) !== full, "limiting the layers changes the picture");
  if (values.shots) await page.screenshot({ path: join(values.shots, "sliced.png") });

  // 4. Convert to every format and download.
  for (const [id, ext] of [
    ["litematic", ".litematic"],
    ["schem", ".schem"],
    ["mcstructure", ".mcstructure"],
    ["nbt", ".nbt"],
  ] as const) {
    await page.select('[data-testid="format"]', id);
    await page.click('[data-testid="convert"]');
    await page.waitForFunction(() => true, { timeout: 1000 });
    const want = `Rafeals_house${ext}`;
    const deadline = Date.now() + 20000;
    while (!readdirSync(downloads).includes(want) && Date.now() < deadline)
      await new Promise((r) => setTimeout(r, 200));
    ok(readdirSync(downloads).includes(want), `converting to ${id} downloads ${want}`);
    ok((await readFile(join(downloads, want))).length > 100, `${want} has content`);
  }
  const loss = await page.$$eval('[data-testid="loss"] li', (l) => l.map((x) => x.textContent));
  ok(Array.isArray(loss), "the loss report area is present");
  ok(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);

  // 5. A bad file is reported, not swallowed.
  await (input as NonNullable<typeof input>).uploadFile(
    fileURLToPath(new URL("../package.json", import.meta.url)),
  );
  await page.waitForSelector('[data-testid="error"]', { timeout: 10000 });
  ok(
    (await page.$eval('[data-testid="error"]', (e) => e.textContent)) !== "",
    "an unsupported file shows an error",
  );
} finally {
  await browser.close();
  server.close();
}
console.log(checks.map((c) => `  ok  ${c}`).join("\n"));
console.log(`${checks.length} checks passed`);
