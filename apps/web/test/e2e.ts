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
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Volume, writeLitematic, writeSchem } from "@voxwright/core";
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
const { url, plainUrl, server } = await serveSite();

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
    // Camera-only moves after the mesh scheduler is idle (no hover outline change, no re-mesh).
    await page.$eval('[data-testid="azimuth"]', (e) => {
      const el = e as HTMLInputElement;
      el.value = "210";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle();
    const turned = await picture();
    ok(turned.hash !== after.hash, t("the turn slider redraws the picture while idle"));
    await page.$eval('[data-testid="elevation"]', (e) => {
      const el = e as HTMLInputElement;
      el.value = "35";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle();
    const tilted = await picture();
    ok(tilted.hash !== turned.hash, t("the tilt slider redraws the picture while idle"));
    if (webgl) {
      await page.mouse.wheel({ deltaY: -120 });
      await settle();
      const zoomed = await picture();
      ok(zoomed.hash !== tilted.hash, t("wheel zoom redraws the picture while idle"));
      const [cx, cy] = [Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2)];
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: cx - 30, y: cy, id: 1 },
          { x: cx + 90, y: cy, id: 2 },
        ],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: cx - 30, y: cy, id: 1 },
          { x: cx + 30, y: cy, id: 2 },
        ],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await settle();
      const pinched = await picture();
      ok(pinched.hash !== zoomed.hash, t("pinch zoom redraws the picture while idle"));
    }

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
      await settle();
      const beforeLook = await picture();
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
      ok(
        flown.hash !== flyView.hash && flown.hash !== beforeLook.hash && flown.distinct > 12,
        t("flying and looking around change the picture"),
      );
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

    // Opening a file with nothing to report says so, instead of showing no report at all.
    ok(
      (await page.$('[data-testid="loss"]')) === null &&
        (await page.$eval('[data-testid="loss-none"]', (e) => e.textContent)) ===
          "Nothing was lost reading this file.",
      t("a file that opens without warnings says nothing was lost reading it"),
    );

    if (webgl) {
      // 5b. The layer sliders follow the height of the edited build and keep the layers shown.
      const sliderMax = (id: string): Promise<number> =>
        page.$eval(`[data-testid="${id}"]`, (e) => Number((e as HTMLInputElement).max));
      const setSlider = (id: string, value: number): Promise<void> =>
        page.$eval(
          `[data-testid="${id}"]`,
          (e, v) => {
            const el = e as HTMLInputElement;
            el.value = String(v);
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          },
          value,
        );
      const sliderValue = (id: string): Promise<number> =>
        page.$eval(`[data-testid="${id}"]`, (e) => Number((e as HTMLInputElement).value));
      const waitMax = async (want: number): Promise<void> => {
        try {
          await page.waitForFunction(
            (w) =>
              Number((document.querySelector('[data-testid="ymax"]') as HTMLInputElement).max) ===
              w,
            { timeout: 10000 },
            want,
          );
        } catch {
          throw new Error(
            `FAILED: the layer sliders did not reach ${want} (they stand at ${await sliderMax("ymax")}; placed bounds ${JSON.stringify(await page.evaluate(() => (window.__voxwright as Vox).volume().placedBounds()))})`,
          );
        }
      };
      // (The sliders follow an edit a moment after it, so wait for them to catch up with step 5.)
      const top0 = await page.evaluate(() => {
        const [lo, hi] = (window.__voxwright as Vox).volume().placedBounds() as [
          number[],
          number[],
        ];
        return (hi[1] as number) - (lo[1] as number);
      });
      await waitMax(top0);
      ok(
        top0 === (await sliderMax("ymin")) && top0 > 3,
        t(`the layer sliders cover the build (0 to ${top0})`),
      );
      // Full range: building above the top extends the range, and "every layer" stays every layer.
      const rise = async (up: number): Promise<void> => {
        await page.evaluate((n) => {
          const v = window.__voxwright as Vox;
          const [lo, hi] = v.volume().placedBounds() as [number[], number[]];
          const x = Math.floor(((lo[0] as number) + (hi[0] as number)) / 2);
          const z = Math.floor(((lo[2] as number) + (hi[2] as number)) / 2);
          return v.edit(x, (hi[1] as number) + n, z, "minecraft:glowstone");
        }, up);
      };
      await rise(3);
      await waitMax(top0 + 3);
      ok(
        (await sliderMax("ymin")) === top0 + 3 && (await sliderValue("ymax")) === top0 + 3,
        t(
          `building 3 layers higher extends the sliders to ${top0 + 3} and keeps every layer shown`,
        ),
      );
      // Narrowed range: it stays where it was, the top of the range still moves with the build.
      await setSlider("ymin", 1);
      await setSlider("ymax", 3);
      await settle();
      await rise(2);
      await waitMax(top0 + 5);
      ok(
        (await sliderValue("ymin")) === 1 && (await sliderValue("ymax")) === 3,
        t("a narrowed layer range keeps its layers when the build grows"),
      );
      // Undo takes the two blocks away again and the range follows it back down.
      await page.focus('[data-testid="canvas"]');
      await page.keyboard.down("Control");
      await page.keyboard.press("z");
      await page.keyboard.press("z");
      await page.keyboard.up("Control");
      await waitMax(top0);
      ok(
        (await sliderMax("ymin")) === top0 && (await sliderValue("ymax")) === 3,
        t("undo shrinks the layer sliders back and clamps nothing it does not have to"),
      );
      await setSlider("ymin", 0);
      await setSlider("ymax", top0);
      await settle();
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
    // This fixture converts to every format without losing anything.
    ok(
      (await page.$('[data-testid="loss"]')) === null,
      t("a conversion that loses nothing shows no loss list"),
    );
    ok(
      (await page.$eval('[data-testid="loss-none"]', (e) => e.textContent)) === "Nothing was lost.",
      t("...and says that nothing was lost"),
    );
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

    // 8. Read errors come out as a readable sentence, not a stack, and the page keeps working.
    const dir = await mkdtemp(join(tmpdir(), "voxwright-bad-"));
    const bad = async (name: string, bytes: Uint8Array): Promise<string> => {
      await writeFile(join(dir, name), bytes);
      await (input as NonNullable<typeof input>).uploadFile(join(dir, name));
      await page.waitForFunction(() => document.querySelector('[data-testid="error"]') !== null, {
        timeout: 10000,
      });
      return (await page.$eval('[data-testid="error"]', (e) => e.textContent)) ?? "";
    };
    const readable = (m: string): boolean => m.length > 10 && m.length < 600 && !/\n\s+at /.test(m);
    const legacy = await bad("old.schematic", new Uint8Array([0x1f, 0x8b, 8, 0]));
    ok(
      /legacy/.test(legacy) && /not supported/.test(legacy) && /\.schem\b/.test(legacy),
      t("a .schematic file is refused with the legacy-format message"),
    );
    await assertStillAlive(page, t);
    for (const ext of [".schem", ".litematic", ".nbt", ".mcstructure"]) {
      const message = await bad(`broken${ext}`, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
      ok(
        readable(message),
        t(`a corrupt ${ext} file shows a readable error ("${message.slice(0, 60)}")`),
      );
      await assertStillAlive(page, t);
    }

    // A build over 512 blocks on an axis is refused by core with its limit message, shown as is.
    const wide = new Volume();
    for (let x = 0; x < 600; x++) wide.set(x, 0, 0, "minecraft:stone");
    for (const [ext, write] of [
      [".schem", () => writeSchem(wide, { dataVersion: 4903, version: 3 })],
      [".litematic", () => writeLitematic(wide, { dataVersion: 4903 })],
    ] as const) {
      const message = await bad(`wide${ext}`, (await write()).bytes);
      ok(
        /600 x 1 x 1/.test(message) &&
          /limit is 512 blocks per axis/.test(message) &&
          readable(message),
        t(`a ${ext} build 600 blocks wide shows core's limit message ("${message.slice(0, 70)}")`),
      );
      await assertStillAlive(page, t);
    }

    // 9. A normal visit installs no test hook; only ?e2e does.
    const plain = await browser.newPage();
    try {
      await plain.goto(plainUrl);
      await plain.waitForFunction(
        () =>
          document
            .querySelector('[data-testid="status"]')
            ?.textContent?.startsWith("open a schematic"),
        { timeout: 30000 },
      );
      ok(
        (await plain.evaluate(() => window.__voxwright)) === undefined,
        t("a visit without ?e2e installs no window.__voxwright"),
      );
    } finally {
      await plain.close();
    }
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
