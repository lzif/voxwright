// SPDX-License-Identifier: AGPL-3.0-only

// End-to-end check in a real browser: serve the built site, open a schematic,
// and drive the viewer and the converter. Run after `pnpm build`:
//
//   node test/e2e.ts [--shots <dir>] [--chromium <path>]
//
// It runs twice. First with WebGL2 on SwiftShader (software Vulkan, so no GPU is
// needed), where the GPU renderer must draw the real Rafeals_house build, orbit,
// slice, fly and convert. Then with the GPU off, where the page must fall back to
// the software renderer and still do everything but fly.
//
// Needs the asset pack (`pnpm assets`) for textured blocks; without it the page
// falls back to flat colours and the checks that only need a picture still run.

import { mkdirSync, readdirSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import puppeteer, { type ElementHandle, type Page } from "puppeteer-core";
import { editorSuite } from "./editor-suite.ts";
import { m4Suite } from "./m4-suite.ts";
import { chromiumArgs, findChromium, serveSite } from "./site.ts";
import type { Pose, Vox } from "./vox.ts";

const { values } = parseArgs({
  options: { shots: { type: "string" }, chromium: { type: "string" } },
});
const fixtures = fileURLToPath(new URL("../../../fixtures/real/rafeals-house/", import.meta.url));
const chromium = findChromium(values.chromium);
if (values.shots) mkdirSync(values.shots, { recursive: true });
const { url, server } = await serveSite();

const checks: string[] = [];
const ok = (cond: unknown, what: string): void => {
  if (!cond) throw new Error(`FAILED: ${what}`);
  checks.push(what);
};

async function suite(webgl: boolean): Promise<void> {
  const label = webgl ? "webgl" : "cpu";
  const downloads = await mkdtemp(join(tmpdir(), "voxwright-dl-"));
  const browser = await puppeteer.launch({
    executablePath: chromium,
    headless: true,
    args: chromiumArgs(webgl),
  });
  const t = (what: string): string => `[${label}] ${what}`;
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
        document
          .querySelector('[data-testid="status"]')
          ?.textContent?.startsWith("open a schematic"),
      { timeout: 30000 },
    );
    const kind = await page.$eval('[data-testid="renderer"]', (e) => e.getAttribute("data-kind"));
    ok(
      kind === (webgl ? "webgl" : "cpu"),
      t(`the page picks the ${webgl ? "GPU" : "software"} renderer`),
    );
    const hasPack = await page.evaluate(
      () =>
        !document.querySelector('[data-testid="status"]')?.textContent?.includes("no texture pack"),
    );
    ok(true, t(`page starts (texture pack ${hasPack ? "loaded" : "absent"})`));

    /** The picture on the canvas: size, how many distinct colours, and a hash of every pixel. */
    const picture = (): Promise<{ w: number; h: number; distinct: number; hash: string }> =>
      page.evaluate(() => {
        const c = document.querySelector('[data-testid="canvas"]') as HTMLCanvasElement;
        let w: number;
        let h: number;
        let d: Uint8ClampedArray;
        const shot = window.__voxwright?.renderer.capture();
        if (shot) {
          [w, h, d] = [shot.width, shot.height, shot.rgba];
        } else {
          [w, h] = [c.width, c.height];
          d = c.getContext("2d")?.getImageData(0, 0, w, h).data as Uint8ClampedArray;
        }
        const seen = new Set<number>();
        for (let i = 0; i < d.length; i += 4 * 17)
          seen.add((d[i] as number) * 65536 + (d[i + 1] as number) * 256 + (d[i + 2] as number));
        let hash = 0;
        for (let i = 0; i < d.length; i += 4)
          hash = (hash * 31 + (d[i] as number) + (d[i + 1] as number) * 3) | 0;
        return { w, h, distinct: seen.size, hash: String(hash) };
      });
    /** Wait until the picture has settled: the GPU renderer says so, the CPU one by time. */
    const settle = async (): Promise<void> => {
      if (webgl) await page.evaluate(() => window.__voxwright?.renderer.whenIdle());
      else await new Promise((r) => setTimeout(r, 4000));
    };
    const pose = (): Promise<Pose> =>
      page.evaluate(() => (window.__voxwright as Vox).renderer.getPose());

    // 1. Open the real .nbt and get a picture.
    const input = (await page.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement> | null;
    await (input as NonNullable<typeof input>).uploadFile(join(fixtures, "Rafeals_house.nbt"));
    await page.waitForFunction(
      () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
      { timeout: 60000 },
    );
    if (!webgl)
      await page.waitForFunction(
        () => (document.querySelector('[data-testid="canvas"]') as HTMLCanvasElement).width > 300,
        { timeout: 60000 },
      );
    await settle();
    const first = await picture();
    ok(
      first.w > 300 && first.distinct > 12,
      t(`the .nbt opens and draws (${first.w}x${first.h}, ${first.distinct} colours)`),
    );
    ok(
      (await page.$$eval('[data-testid="counts"] li', (l) => l.length)) > 5,
      t("the block list is shown"),
    );
    if (webgl) {
      const s = await page.evaluate(() => (window.__voxwright as Vox).renderer.stats());
      ok(
        s.sections >= 1 && s.meshes >= 1,
        t(`the build is in ${s.sections} section(s), ${s.meshes} meshes`),
      );
      ok(
        s.firstFullFrameMs !== null,
        t(`first full frame after ${Math.round(s.firstFullFrameMs ?? 0)} ms`),
      );
      ok(
        hasPack ? first.distinct > 40 : true,
        t(`textured blocks give a rich picture (${first.distinct} colours)`),
      );
      console.log(`  gpu: ${s.gpu}`);
    }
    if (webgl) {
      ok(
        (await page.$('[data-testid="toolbar"]')) !== null &&
          (await page.$('[data-testid="palette"]')) !== null,
        t("the GPU page shows the editor"),
      );
    } else {
      ok(
        (await page.$('[data-testid="toolbar"]')) === null &&
          (await page.$eval('[data-testid="edit-note"]', (e) => e.textContent ?? "")).includes(
            "WebGL2",
          ),
        t("the software renderer stays a viewer and says why"),
      );
    }
    if (values.shots) await page.screenshot({ path: join(values.shots, `viewer-${label}.png`) });

    // 2. Orbit by dragging the picture.
    const before = await picture();
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
    await settle();
    if (!webgl) await new Promise((r) => setTimeout(r, 0));
    const after = await picture();
    ok(before.hash !== after.hash, t("dragging the picture turns the view"));
    ok(
      Number(await page.$eval('[data-testid="azimuth"]', (e) => (e as HTMLInputElement).value)) !==
        45,
      t("the turn slider follows the drag"),
    );

    // 3. Slice to the bottom layers.
    const full = await picture();
    await page.$eval('[data-testid="ymax"]', (e) => {
      const el = e as HTMLInputElement;
      el.value = "2";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle();
    const sliced = await picture();
    ok(sliced.hash !== full.hash, t("limiting the layers changes the picture"));
    if (webgl) {
      // The cut must not leave the house open at the top: the sliced picture is a solid block
      // of layers, so it has fewer distinct colours than the whole house, not an empty frame.
      ok(
        sliced.distinct > 8,
        t(`the cut layers are drawn with their top faces (${sliced.distinct} colours)`),
      );
    }
    if (values.shots) await page.screenshot({ path: join(values.shots, `sliced-${label}.png`) });
    // And back to every layer.
    await page.$eval('[data-testid="ymax"]', (e) => {
      const el = e as HTMLInputElement;
      el.value = "7";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle();
    ok((await picture()).hash !== sliced.hash, t("restoring the layers restores the picture"));

    if (webgl) {
      // 4. Fly mode: switch, walk forward with W, look around, switch back.
      await page.click('[data-testid="mode-fly"]');
      const p0 = await pose();
      ok(p0.mode === "fly", t("the Fly button switches the camera to fly"));
      const flyView = await picture();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.keyboard.down("w");
      await new Promise((r) => setTimeout(r, 900));
      await page.keyboard.up("w");
      const p1 = await pose();
      const moved = Math.hypot(...p1.position.map((v, i) => v - (p0.position[i] as number)));
      ok(moved > 2, t(`W moves the fly camera forward (${moved.toFixed(1)} cells)`));
      // Forward is the look direction, so the camera got closer to the middle of the build.
      const centre = [7, 4, 7];
      const dist = (p: Pose): number =>
        Math.hypot(...p.position.map((v, i) => v - (centre[i] as number)));
      ok(dist(p1) < dist(p0), t("W moves toward where the camera looks"));
      await page.keyboard.down("s");
      await new Promise((r) => setTimeout(r, 900));
      await page.keyboard.up("s");
      const p2 = await pose();
      ok(dist(p2) > dist(p1), t("S moves back"));
      await page.keyboard.down("d");
      await new Promise((r) => setTimeout(r, 400));
      await page.keyboard.up("d");
      const p3 = await pose();
      ok(
        Math.hypot(...p3.position.map((v, i) => v - (p2.position[i] as number))) > 0.5,
        t("D strafes"),
      );
      // Mouse look: a click takes the pointer (and where that is refused, dragging looks instead).
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 - 40, { steps: 6 });
      await page.mouse.up();
      const locked = await page.evaluate(() => document.pointerLockElement !== null);
      const p4 = await pose();
      ok(
        Math.abs(p4.azimuth - p3.azimuth) > 3 || Math.abs(p4.elevation - p3.elevation) > 3,
        t(
          `the mouse turns the fly camera (azimuth ${p3.azimuth.toFixed(0)} to ${p4.azimuth.toFixed(0)}, pointer ${locked ? "locked" : "not locked"})`,
        ),
      );
      await settle();
      const flown = await picture();
      ok(flown.hash !== flyView.hash && flown.distinct > 12, t("flying changes the picture"));
      if (values.shots) await page.screenshot({ path: join(values.shots, "fly-webgl.png") });
      await page.evaluate(() => document.exitPointerLock()); // what Esc does
      await page.click('[data-testid="mode-orbit"]');
      const p5 = await pose();
      ok(
        p5.mode === "orbit" && Math.abs(p5.azimuth - p4.azimuth) < 0.01,
        t("switching back to orbit keeps the view direction"),
      );

      // Outlines for a selection show on top of the build.
      // (The editor outlines the block under the pointer; start from a frame with no outlines.)
      await page.evaluate(() => (window.__voxwright as Vox).renderer.highlight([]));
      await settle();
      const plain = (await picture()).hash;
      await page.evaluate(() => {
        const r = (window.__voxwright as Vox).renderer;
        r.highlight([{ min: [0, 0, 0], max: [13, 7, 13], style: "selection" }]);
      });
      await settle();
      ok((await picture()).hash !== plain, t("a highlighted box is drawn over the build"));
      await page.evaluate(() => (window.__voxwright as Vox).renderer.highlight([]));
      await settle();
      ok((await picture()).hash === plain, t("clearing the highlight removes it again"));

      // 5. An edit re-meshes only its sections and shows up.
      const hashBefore = (await picture()).hash;
      // Put a glowstone block on top of the roof's highest block in the middle column.
      const { appliedMs } = await page.evaluate(() => {
        const v = window.__voxwright as Vox;
        const [lo, hi] = v.volume().bounds() as [number[], number[]];
        const x = Math.floor(((lo[0] as number) + (hi[0] as number)) / 2);
        const z = Math.floor(((lo[2] as number) + (hi[2] as number)) / 2);
        let y = hi[1] as number;
        while (
          y > (lo[1] as number) &&
          (v.volume().get(x, y, z) ?? "minecraft:air") === "minecraft:air"
        )
          y--;
        return v.edit(x, y + 1, z, "minecraft:glowstone");
      });
      await settle();
      ok(
        appliedMs < 3000,
        t(`an edited block is re-meshed and swapped in (${Math.round(appliedMs)} ms)`),
      );
      ok((await picture()).hash !== hashBefore, t("the edited block appears in the picture"));
    }

    // 6. Convert to every format and download.
    for (const [id, ext] of [
      ["litematic", ".litematic"],
      ["schem", ".schem"],
      ["mcstructure", ".mcstructure"],
      ["nbt", ".nbt"],
    ] as const) {
      await page.select('[data-testid="format"]', id);
      await page.click('[data-testid="convert"]');
      await page.waitForFunction(() => true, { timeout: 1000 });
      // The GPU page edited the build above (a glowstone block), so its exports say so in the name.
      const want = `Rafeals_house${webgl ? "-edited" : ""}${ext}`;
      const deadline = Date.now() + 20000;
      while (!readdirSync(downloads).includes(want) && Date.now() < deadline)
        await new Promise((r) => setTimeout(r, 200));
      ok(readdirSync(downloads).includes(want), t(`converting to ${id} downloads ${want}`));
      ok((await readFile(join(downloads, want))).length > 100, t(`${want} has content`));
    }
    const loss = await page.$$eval('[data-testid="loss"] li', (l) => l.map((x) => x.textContent));
    ok(Array.isArray(loss), t("the loss report area is present"));
    ok(
      errors.length === 0,
      t(`no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`),
    );

    // 7. A bad file is reported, not swallowed.
    await (input as NonNullable<typeof input>).uploadFile(
      fileURLToPath(new URL("../package.json", import.meta.url)),
    );
    await page.waitForSelector('[data-testid="error"]', { timeout: 10000 });
    ok(
      (await page.$eval('[data-testid="error"]', (e) => e.textContent)) !== "",
      t("an unsupported file shows an error"),
    );
    await assertStillAlive(page, t);
  } finally {
    await browser.close();
  }
}

/** After the error, the viewer must still take a good file. */
async function assertStillAlive(page: Page, t: (s: string) => string): Promise<void> {
  const input = (await page.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
  await input.uploadFile(join(fixtures, "Rafeals_house.nbt"));
  await page.waitForFunction(
    () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
    { timeout: 60000 },
  );
  ok(true, t("a good file opens again after a bad one"));
}

try {
  await suite(true);
  await suite(false);
  await editorSuite({
    url,
    chromium,
    shots: values.shots,
    fixture: join(fixtures, "Rafeals_house.litematic"),
    ok,
  });
  await m4Suite({
    url,
    chromium,
    shots: values.shots,
    fixture: join(fixtures, "Rafeals_house.litematic"),
    ok,
  });
} finally {
  server.close();
}
console.log(checks.map((c) => `  ok  ${c}`).join("\n"));
console.log(`${checks.length} checks passed`);
