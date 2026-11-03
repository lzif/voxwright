// SPDX-License-Identifier: AGPL-3.0-only

// The M4 end-to-end checks, run by e2e.ts: the footer and its source link, autosave and the restore
// prompt (timer, flush, quota failure, restore with block entities and entities, discard, clearing
// after an export), a resource pack the user brings (zip and jar, kept across reloads, removed, drag and
// drop, bad files, over the site's pack, on both renderers), keyboard access, focus, live regions,
// reduced motion, a phone-sized viewer, and axe-core on the main states.
//
// The pack is made up in synthetic-pack.ts: two blocks drawn in pure red and pure blue. No Mojang asset
// is used here.

import { readFileSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Volume, writeStructureNbt } from "@voxwright/core";
import puppeteer, { type Browser, type ElementHandle, type Page } from "puppeteer-core";
import { chromiumArgs } from "./site.ts";
import { PACK_COLORS, syntheticPackZip } from "./synthetic-pack.ts";
import type { Vox } from "./vox.ts";

export interface M4Context {
  url: string;
  chromium: string;
  shots: string | undefined;
  /** A `.litematic` to edit. */
  fixture: string;
  ok(cond: unknown, what: string): void;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const axeSource = readFileSync(
  createRequire(import.meta.url).resolve("axe-core/axe.min.js"),
  "utf8",
);

interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  targets: string[];
}
interface AxeSummary {
  violations: AxeViolation[];
  /** Checks axe could not decide by itself (listed so a person can look). */
  incomplete: string[];
  passes: number;
}

/**
 * Violations axe-core reports that we accept, each with the reason. Everything else fails the run.
 * Empty on purpose: add an entry only with a real justification, and say so in PLAN.md.
 */
const ACCEPTED: Record<string, string> = {};

async function runAxe(page: Page): Promise<AxeSummary> {
  await page.evaluate(axeSource);
  return page.evaluate(async () => {
    type Node = { target: unknown[] };
    type Result = { id: string; impact?: string | null; help: string; nodes: Node[] };
    const axe = (
      window as unknown as { axe: { run(ctx: Document): Promise<Record<string, Result[]>> } }
    ).axe;
    const r = await axe.run(document);
    return {
      violations: (r.violations ?? []).map((v) => ({
        id: v.id,
        impact: v.impact ?? null,
        help: v.help,
        targets: v.nodes.map((n) => n.target.join(" ")),
      })),
      incomplete: (r.incomplete ?? []).map((v) => `${v.id} (${v.nodes.length})`),
      passes: (r.passes ?? []).length,
    };
  });
}

/** Bytes of a `.nbt` with a row of stone and dirt: the blocks the synthetic pack draws red and blue. */
async function coloursNbt(): Promise<Uint8Array> {
  const v = new Volume();
  for (let x = 0; x < 6; x++)
    for (let z = 0; z < 6; z++) {
      v.set(x, 0, z, (x + z) % 2 === 0 ? "minecraft:stone" : "minecraft:dirt");
      if ((x + z) % 3 === 0) v.set(x, 1, z, "minecraft:stone");
    }
  const { bytes } = await writeStructureNbt(v, { dataVersion: 4903 });
  return bytes;
}

type Colours = { red: number; blue: number; total: number };

export async function m4Suite(ctx: M4Context): Promise<void> {
  const { ok } = ctx;
  const t = (what: string): string => `[m4] ${what}`;
  const work = await mkdtemp(join(tmpdir(), "voxwright-m4-"));
  const files = {
    colours: join(work, "colours.nbt"),
    zip: join(work, "my-pack.zip"),
    jar: join(work, "client.jar"),
    notZip: join(work, "notes.zip"),
    noAssets: join(work, "empty.zip"),
  };
  await writeFile(files.colours, await coloursNbt());
  await writeFile(files.zip, syntheticPackZip());
  await writeFile(files.jar, syntheticPackZip("")); // a jar is a zip; the code reads both the same way
  await writeFile(files.notZip, "this is not a zip file");
  const { zipSync } = await import("fflate");
  await writeFile(files.noAssets, zipSync({ "readme.txt": new TextEncoder().encode("hi") }));
  const downloads = await mkdtemp(join(tmpdir(), "voxwright-m4dl-"));

  const axeReport: string[] = [];
  const axeCheck = async (page: Page, state: string): Promise<void> => {
    const r = await runAxe(page);
    const real = r.violations.filter((v) => !(v.id in ACCEPTED));
    const line = `axe ${state}: ${r.violations.length} violation(s), ${r.passes} rules passed, ${r.incomplete.length} need a person${
      r.incomplete.length ? ` (${r.incomplete.join(", ")})` : ""
    }`;
    axeReport.push(line);
    console.log(`  ${line}`);
    for (const v of real)
      console.log(`    ! ${v.id} [${v.impact}] ${v.help}: ${v.targets.slice(0, 4).join(" | ")}`);
    ok(real.length === 0, t(`axe-core finds no violations: ${state}`));
  };

  const open = async (
    browser: Browser,
    opts: { width?: number; height?: number; noSitePack?: boolean } = {},
  ): Promise<{ page: Page; errors: string[] }> => {
    const page = await browser.newPage();
    await page.setViewport({ width: opts.width ?? 1440, height: opts.height ?? 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    // (When the test hides the site's pack on purpose, the browser logs that 404; it is not a fault.)
    page.on(
      "console",
      (m) =>
        m.type() === "error" &&
        !(opts.noSitePack && m.text().includes("404")) &&
        errors.push(m.text()),
    );
    page.on("dialog", (d) => void d.accept());
    const cdp = await page.createCDPSession();
    await cdp.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloads,
      eventsEnabled: true,
    });
    if (opts.noSitePack) {
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        if (req.url().endsWith("/pack/pack.json"))
          void req.respond({ status: 404, contentType: "text/plain", body: "not found" });
        else void req.continue();
      });
    }
    await page.goto(ctx.url);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="status"]')
          ?.textContent?.startsWith("open a schematic"),
      { timeout: 30000 },
    );
    return { page, errors };
  };

  const upload = async (page: Page, testid: string, path: string): Promise<void> => {
    const input = (await page.$(
      `[data-testid="${testid}"]`,
    )) as ElementHandle<HTMLInputElement> | null;
    await (input as NonNullable<typeof input>).uploadFile(path);
  };
  const statusHas = (page: Page, text: string): Promise<unknown> =>
    page.waitForFunction(
      (s) => document.querySelector('[data-testid="status"]')?.textContent?.includes(s),
      { timeout: 60000 },
      text,
    );
  const settle = (page: Page): Promise<void> =>
    page.evaluate(() => (window.__voxwright as Vox).renderer.whenIdle());
  const text = (page: Page, testid: string): Promise<string> =>
    page.$eval(`[data-testid="${testid}"]`, (e) => e.textContent ?? "");
  const session = (page: Page): Promise<Record<string, unknown>> =>
    page.evaluate(() => {
      const s = (window.__voxwright as Vox).session() as unknown as Record<string, unknown> | null;
      if (s === null) throw new Error("no editor session");
      return JSON.parse(
        JSON.stringify({
          tool: s.tool,
          block: s.block,
          undoCount: s.undoCount,
          editCount: s.editCount,
          unsaved: s.unsaved,
          message: s.message,
          error: s.error,
          selection: s.selection,
        }),
      );
    });
  /** All set cells as one sorted string, to compare volumes cell by cell. */
  const cells = (page: Page): Promise<string> =>
    page.evaluate(() => {
      const v = (window.__voxwright as Vox).volume() as unknown as {
        eachCell(f: (x: number, y: number, z: number, i: number) => void): void;
        palette: string[];
      };
      const out: string[] = [];
      v.eachCell((x, y, z, i) => out.push(`${x},${y},${z}=${v.palette[i]}`));
      return out.sort().join("|");
    });
  /** What is stored under `autosave/current` in IndexedDB, in the form the checks need (or null). */
  const stored = (page: Page, store = "autosave", key = "current") =>
    page.evaluate(
      (storeName, k) =>
        new Promise<null | {
          name: string;
          edits: number;
          savedAt: number;
          palette: number;
          sections: number;
          blockEntities: number;
          entities: number;
        }>((resolve, reject) => {
          const req = indexedDB.open("voxwright");
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const get = req.result.transaction(storeName).objectStore(storeName).get(k);
            get.onsuccess = () => {
              const v = get.result;
              req.result.close();
              if (v === undefined) return resolve(null);
              resolve({
                name: v.name,
                edits: v.edits,
                savedAt: v.savedAt,
                palette: v.palette?.length,
                sections: v.sections?.length,
                blockEntities: v.blockEntities?.length,
                entities: v.entities?.length,
              });
            };
            get.onerror = () => reject(get.error);
          };
        }),
      store,
      key,
    );
  const colours = (page: Page): Promise<Colours> =>
    page.evaluate(() => {
      const w = window as unknown as { __voxwright?: Vox };
      let d: Uint8ClampedArray;
      const shot = w.__voxwright?.renderer.capture();
      if (shot) d = shot.rgba;
      else {
        const c = document.querySelector('[data-testid="canvas"]') as HTMLCanvasElement;
        d = (c.getContext("2d") as CanvasRenderingContext2D).getImageData(
          0,
          0,
          c.width,
          c.height,
        ).data;
      }
      let red = 0;
      let blue = 0;
      for (let i = 0; i < d.length; i += 4) {
        const [r, g, b] = [d[i] as number, d[i + 1] as number, d[i + 2] as number];
        if (r >= 90 && g < r * 0.4 && b < r * 0.4) red++;
        if (b >= 90 && r < b * 0.4 && g < b * 0.4) blue++;
      }
      return { red, blue, total: d.length / 4 };
    });
  const waitColours = (page: Page, want: "pack" | "none"): Promise<unknown> =>
    page.waitForFunction(
      (mode) => {
        const w = window as unknown as { __voxwright?: Vox };
        let d: Uint8ClampedArray;
        const shot = w.__voxwright?.renderer.capture();
        if (shot) d = shot.rgba;
        else {
          const c = document.querySelector('[data-testid="canvas"]') as HTMLCanvasElement;
          if (c.width === 0) return false;
          d = (c.getContext("2d") as CanvasRenderingContext2D).getImageData(
            0,
            0,
            c.width,
            c.height,
          ).data;
        }
        let red = 0;
        let blue = 0;
        for (let i = 0; i < d.length; i += 4) {
          const [r, g, b] = [d[i] as number, d[i + 1] as number, d[i + 2] as number];
          if (r >= 90 && g < r * 0.4 && b < r * 0.4) red++;
          if (b >= 90 && r < b * 0.4 && g < b * 0.4) blue++;
        }
        // "none" must also see a drawn build, not a blank frame between two meshings.
        let drawn = 0;
        for (let i = 4; i < d.length; i += 4)
          if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) drawn++;
        return mode === "pack" ? red > 50 && blue > 50 : red === 0 && blue === 0 && drawn > 500;
      },
      { timeout: 30000, polling: 200 },
      want,
    );
  /** Click "Remove my pack" once the page has finished applying the pack (the button is off while it works). */
  const removePack = async (page: Page): Promise<void> => {
    await page.waitForFunction(
      () => {
        const b = document.querySelector<HTMLButtonElement>('[data-testid="pack-remove"]');
        return b !== null && !b.disabled;
      },
      { timeout: 30000 },
    );
    await page.click('[data-testid="pack-remove"]');
  };
  /** Press Tab until `selector` has the focus; false if it is not reached within `max` presses. */
  const tabTo = async (page: Page, selector: string, max = 120): Promise<boolean> => {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press("Tab");
      if (await page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector))
        return true;
    }
    return false;
  };

  const browser = await puppeteer.launch({
    executablePath: ctx.chromium,
    headless: true,
    args: chromiumArgs(true),
  });
  try {
    // ---- 1. The empty page: footer, notices, source link ------------------------------------
    {
      const { page, errors } = await open(browser);
      const footer = await text(page, "footer");
      ok(
        footer.includes("Not affiliated with Mojang or Microsoft"),
        t("the footer carries the not-affiliated notice"),
      );
      ok(footer.includes("GNU Affero General Public License"), t("the footer names the AGPL"));
      const href = await page.$eval(
        '[data-testid="source-link"]',
        (e) => (e as HTMLAnchorElement).href,
      );
      ok(
        /^https:\/\/github\.com\/lzif\/voxwright(\/tree\/[0-9a-f]{7,40})?$/.test(href) ||
          process.env.VOXWRIGHT_SOURCE_URL !== undefined,
        t(`the footer links to the source of this version (${href})`),
      );
      ok(
        (
          await page.$eval('[data-testid="license-link"]', (e) => (e as HTMLAnchorElement).href)
        ).includes("agpl-3.0"),
        t("the footer links to the licence text"),
      );
      ok(
        (await page.$('[data-testid="restore-dialog"][open]')) === null,
        t("no restore prompt when nothing is saved"),
      );
      const packState = await text(page, "pack-state");
      ok(
        packState.length > 10,
        t(`the pack panel says what is in use ("${packState.trim().slice(0, 60)}...")`),
      );
      await axeCheck(page, "empty page");
      if (ctx.shots) await page.screenshot({ path: join(ctx.shots, "footer.png"), fullPage: true });
      ok(
        errors.length === 0,
        t(`no console errors on the empty page${errors.length ? `: ${errors.join(" | ")}` : ""}`),
      );
      await page.close();
    }

    // ---- 2. A file open: text alternative, keyboard, focus, live regions ---------------------
    let editedCells = "";
    {
      const { page } = await open(browser);
      await upload(page, "file", ctx.fixture);
      await statusHas(page, "blocks");
      await settle(page);
      const label = await page.$eval('[data-testid="canvas"]', (e) => e.getAttribute("aria-label"));
      const summary = await text(page, "canvas-summary");
      ok(
        !!label && summary.includes("Rafeals_house.litematic") && /\d+ blocks in all/.test(summary),
        t(`the canvas has a name and a text alternative ("${summary.slice(0, 80)}...")`),
      );
      const live = await page.$$eval(
        '[role="status"], [role="alert"], [aria-live]',
        (l) => l.length,
      );
      ok(live >= 3, t(`status, autosave and loss report are live regions (${live} found)`));
      await axeCheck(page, "file open, editor idle");

      // Keyboard: the skip link comes first and lands on the picture.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      ok(
        await tabTo(page, '[data-testid="skip-link"]', 3),
        t("the first Tab stop is the skip link"),
      );
      await page.keyboard.press("Enter");
      await sleep(100);
      ok(
        await page.evaluate(() => document.activeElement?.getAttribute("data-testid") === "canvas"),
        t("the skip link moves the focus to the picture"),
      );
      // Reach the controls with Tab alone, in page order, and see a focus ring on them.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.evaluate(() => window.scrollTo(0, 0));
      for (const [sel, name] of [
        ['[data-testid="file"]', "the open-file input"],
        ['[data-testid="pack-file"]', "the pack input"],
        ['[data-testid="block-input"]', "the block field"],
        ['[data-testid="palette-search"]', "the palette search"],
        ['[data-testid="palette-list"] button[tabindex="0"]', "the block list (one stop)"],
        ['[data-testid="at-set"]', "the coordinate form"],
        ['[data-testid="tool-place"]', "the Place tool"],
        ['[data-testid="canvas"]', "the picture"],
        ['[data-testid="format"]', "the format list"],
        ['[data-testid="convert"]', "the export button"],
      ] as const) {
        const found = await tabTo(page, sel);
        ok(found, t(`Tab reaches ${name}`));
        const ring = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          const own = getComputedStyle(el);
          const label = el.closest("label.button");
          const lab = label ? getComputedStyle(label) : own;
          return [own, lab].some(
            (s) => s.outlineStyle !== "none" && Number.parseFloat(s.outlineWidth) >= 2,
          );
        });
        ok(ring, t(`${name} shows a focus ring`));
        if (sel === '[data-testid="canvas"]') {
          const before = Number(
            await page.$eval('[data-testid="azimuth"]', (e) => (e as HTMLInputElement).value),
          );
          await page.keyboard.press("ArrowRight");
          await page.keyboard.press("ArrowRight");
          const after = Number(
            await page.$eval('[data-testid="azimuth"]', (e) => (e as HTMLInputElement).value),
          );
          ok(
            after !== before,
            t(`arrow keys turn the view from the keyboard (${before} to ${after})`),
          );
          const d0 = await page.evaluate(() => (window.__voxwright as Vox).renderer.getPose() && 0);
          void d0;
        }
        if (sel === '[data-testid="tool-place"]') {
          await page.keyboard.press("Space");
          ok(((await session(page)).tool as string) === "place", t("Space presses a tool button"));
        }
      }

      // Keyboard-only edit: type a block and a cell, press the button.
      await page.focus('[data-testid="block-input"]');
      await page.keyboard.down("Control");
      await page.keyboard.press("a");
      await page.keyboard.up("Control");
      await page.keyboard.type("minecraft:glowstone");
      const bounds = await page.evaluate(() => {
        const bb = (window.__voxwright as Vox).volume().placedBounds() as [number[], number[]];
        return bb;
      });
      const spot = [bounds[0][0] as number, (bounds[1][1] as number) + 1, bounds[0][2] as number];
      for (const [i, axis] of ["x", "y", "z"].entries()) {
        await page.focus(`[data-testid="at-${axis}"]`);
        await page.keyboard.down("Control");
        await page.keyboard.press("a");
        await page.keyboard.up("Control");
        await page.keyboard.type(String(spot[i]));
      }
      await page.focus('[data-testid="at-set"]');
      await page.keyboard.press("Enter");
      await sleep(200);
      const placed = await page.evaluate(
        (p) =>
          (window.__voxwright as Vox).volume().get(p[0] as number, p[1] as number, p[2] as number),
        spot,
      );
      ok(
        placed === "minecraft:glowstone",
        t(`a block is placed from the keyboard alone at ${spot.join(",")}`),
      );
      ok(
        (await page.$eval('[data-testid="blockstate-name"]', (e) => e.textContent ?? "")).includes(
          "glowstone",
        ),
        t("the block state panel follows the cell that was set"),
      );
      await page.evaluate(() =>
        (window.__voxwright as unknown as { flushAutosave(): Promise<void> }).flushAutosave(),
      );
      ok((await stored(page))?.edits === 1, t("the keyboard edit is autosaved like any other"));
      await settle(page);
      await page.focus('[data-testid="canvas"]');
      await page.keyboard.press("m");
      await page.click('[data-testid="select-all"]');
      ok((await session(page)).selection !== null, t("Select everything works from a button"));
      await axeCheck(page, "editor with a selection");
      if (ctx.shots) await page.screenshot({ path: join(ctx.shots, "editor-a11y.png") });

      // Reduced motion: nothing animates or transitions.
      await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
      const moving = await page.evaluate(
        () =>
          [...document.querySelectorAll("*")].filter((el) => {
            const s = getComputedStyle(el);
            return (
              (s.animationName !== "none" && s.animationDuration !== "0s") ||
              Number.parseFloat(s.transitionDuration) > 0
            );
          }).length,
      );
      ok(moving === 0, t("with prefers-reduced-motion nothing animates or transitions"));
      await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
      await page.close();
      // The edit above is offered on the next visit; discard it so the next section starts clean.
      const next = (await open(browser)).page;
      await next.waitForSelector('[data-testid="restore-dialog"][open]', { timeout: 15000 });
      await next.click('[data-testid="discard"]');
      await next.waitForFunction(
        () => !document.querySelector('[data-testid="restore-dialog"][open]'),
      );
      await next.close();
    }

    // ---- 3. Autosave and restore --------------------------------------------------------------
    {
      const a = await open(browser);
      let page = a.page;
      ok((await stored(page)) === null, t("a fresh profile has no saved session"));
      await upload(page, "file", ctx.fixture);
      await statusHas(page, "blocks");
      await settle(page);
      ok(
        (await text(page, "autosave")).includes("Nothing to save yet"),
        t("autosave says there is nothing to save before the first edit"),
      );
      // A chest gets a block entity and an armor stand an entity, so the snapshot has something to keep.
      const extras = await page.evaluate(() => {
        const vox = window.__voxwright as Vox;
        const vol = vox.volume() as unknown as {
          eachCell(f: (x: number, y: number, z: number, i: number) => void): void;
          palette: string[];
          setBlockEntity(x: number, y: number, z: number, e: unknown): void;
          addEntity(e: unknown): void;
        };
        let at: number[] | null = null;
        vol.eachCell((x, y, z, i) => {
          if (at === null && (vol.palette[i] as string).startsWith("minecraft:chest"))
            at = [x, y, z];
        });
        if (at === null) return null;
        const s = (value: string) => ({ type: "string", value });
        const chest = {
          type: "compound",
          value: new Map<string, unknown>([
            ["id", s("minecraft:chest")],
            [
              "Items",
              {
                type: "list",
                elementType: 10,
                value: [
                  {
                    type: "compound",
                    value: new Map<string, unknown>([
                      ["Slot", { type: "byte", value: 3 }],
                      ["id", s("minecraft:apple")],
                    ]),
                  },
                ],
              },
            ],
          ]),
        };
        vol.setBlockEntity(at[0] as number, at[1] as number, at[2] as number, {
          edition: "java",
          nbt: chest,
        });
        vol.addEntity({
          edition: "java",
          nbt: {
            type: "compound",
            value: new Map<string, unknown>([
              ["id", s("minecraft:armor_stand")],
              [
                "Pos",
                {
                  type: "list",
                  elementType: 6,
                  value: [1.5, 2, 3.5].map((value) => ({ type: "double", value })),
                },
              ],
            ]),
          },
        });
        return at;
      });
      ok(extras !== null, t("the fixture has a chest to give a block entity"));
      const chestAt = extras as unknown as number[];
      const first = await page.evaluate(async () => {
        const v = window.__voxwright as Vox;
        const b = v.volume().placedBounds() as [number[], number[]];
        await v.edit(
          b[0][0] as number,
          (b[1][1] as number) + 1,
          b[0][2] as number,
          "minecraft:glowstone",
        );
        await v.edit(
          (b[0][0] as number) + 1,
          (b[1][1] as number) + 1,
          b[0][2] as number,
          "minecraft:lantern",
        );
        return true;
      });
      ok(first, t("two edits made through the editor"));
      // Not written at once: the timer waits for a quiet moment.
      await sleep(250);
      ok((await stored(page)) === null, t("autosave does not write on every change (debounced)"));
      const t0 = Date.now();
      let rec = await stored(page);
      while (rec === null && Date.now() - t0 < 14000) {
        await sleep(250);
        rec = await stored(page);
      }
      ok(
        rec !== null && rec.edits === 2,
        t(`the timer writes a snapshot by itself after ${Date.now() - t0} ms (2 edits)`),
      );
      ok(
        Date.now() - t0 >= 1500 && Date.now() - t0 <= 10500,
        t("...within the documented debounce window"),
      );
      ok(
        (await text(page, "autosave")).includes("Saved in this browser"),
        t("the page shows that the edits were saved"),
      );
      ok(
        rec !== null &&
          rec.blockEntities === 1 &&
          rec.entities === 1 &&
          rec.name === "Rafeals_house.litematic",
        t("the snapshot holds the block entity, the entity and the file name"),
      );

      // Another edit, flushed at once; remember what the volume looks like.
      await page.evaluate(async () => {
        const v = window.__voxwright as Vox;
        const b = v.volume().placedBounds() as [number[], number[]];
        await v.edit(
          (b[0][0] as number) + 2,
          (b[1][1] as number) + 1,
          b[0][2] as number,
          "minecraft:sea_lantern",
        );
        await (v as unknown as { flushAutosave(): Promise<void> }).flushAutosave();
      });
      rec = await stored(page);
      ok(rec?.edits === 3, t("a flush writes the third edit at once"));
      editedCells = await cells(page);
      const beforeBE = await page.evaluate((c) => {
        const v = (window.__voxwright as Vox).volume();
        const e = v.blockEntityAt(c[0] as number, c[1] as number, c[2] as number);
        return e
          ? JSON.stringify([e.edition, [...(e.nbt.value as Map<string, unknown>).keys()]])
          : null;
      }, chestAt);
      await page.close(); // leaves with unsaved edits, as a closed tab does

      // A new page: the prompt.
      page = (await open(browser, {})).page;
      await page.waitForSelector('[data-testid="restore-dialog"][open]', { timeout: 15000 });
      ok(true, t("a returning visit is offered the saved session in a dialog"));
      const shown = {
        name: await text(page, "restore-name"),
        edits: await text(page, "restore-edits"),
        time: await text(page, "restore-time"),
      };
      ok(
        shown.name === "Rafeals_house.litematic" && shown.edits === "3" && shown.time.length > 5,
        t(
          `the prompt names the file, the time and the edit count (${shown.name}, ${shown.time}, ${shown.edits} edits)`,
        ),
      );
      ok(
        (await page.$eval("dialog", (d) => d.textContent ?? "")).includes(
          "Undo history is not kept",
        ),
        t("the prompt says the undo history is not kept"),
      );
      const focusOn = await page.evaluate(() =>
        document.activeElement?.getAttribute("data-testid"),
      );
      ok(
        focusOn === "restore" || focusOn === "discard",
        t(`the dialog takes the focus (${focusOn})`),
      );
      await axeCheck(page, "restore prompt");
      if (ctx.shots) await page.screenshot({ path: join(ctx.shots, "restore-prompt.png") });
      // Escape does not dismiss it: the choice is explicit.
      await page.keyboard.press("Escape");
      ok(
        (await page.$('[data-testid="restore-dialog"][open]')) !== null,
        t("Escape does not close the prompt without a choice"),
      );
      // Restore with the keyboard.
      await page.focus('[data-testid="restore"]');
      await page.keyboard.press("Enter");
      await statusHas(page, "restored");
      await settle(page);
      ok(
        (await page.$('[data-testid="restore-dialog"][open]')) === null,
        t("restoring closes the prompt"),
      );
      ok(
        (await cells(page)) === editedCells,
        t("the restored volume equals the edited one cell for cell"),
      );
      const afterBE = await page.evaluate((c) => {
        const v = (window.__voxwright as Vox).volume();
        const e = v.blockEntityAt(c[0] as number, c[1] as number, c[2] as number);
        return {
          be: e
            ? JSON.stringify([e.edition, [...(e.nbt.value as Map<string, unknown>).keys()]])
            : null,
          entities: v.entities.length,
          items: e
            ? JSON.stringify(
                (
                  e.nbt.value.get("Items") as {
                    value: { value: Map<string, { value: unknown }> }[];
                  }
                ).value[0]?.value.get("id"),
              )
            : "",
        };
      }, chestAt);
      ok(
        afterBE.be === beforeBE && afterBE.entities === 1 && afterBE.items.includes("apple"),
        t("the block entity (with its items) and the entity survive the restore"),
      );
      const s = await session(page);
      ok(
        s.undoCount === 0 && s.editCount === 3 && s.unsaved === true,
        t(
          `restored edits count (${s.editCount}), have no undo history (${s.undoCount}) and are unsaved`,
        ),
      );
      ok(
        (s.message as string).includes("Undo history was not kept"),
        t("the page tells the user that undo is gone"),
      );
      ok(
        (await text(page, "export-note")).includes("3 edits"),
        t("the export note counts the restored edits"),
      );
      // Editing goes on; the next snapshot counts both.
      await page.evaluate(async () => {
        const v = window.__voxwright as Vox;
        const b = v.volume().placedBounds() as [number[], number[]];
        await v.edit(
          (b[0][0] as number) + 3,
          (b[1][1] as number) + 1,
          b[0][2] as number,
          "minecraft:glowstone",
        );
        await (v as unknown as { flushAutosave(): Promise<void> }).flushAutosave();
      });
      ok((await stored(page))?.edits === 4, t("editing after a restore keeps counting (4 edits)"));
      ok((await session(page)).undoCount === 1, t("only the new edit can be undone"));

      // Quota failure: told, and the work goes on.
      await page.evaluate(() => {
        const proto = IDBObjectStore.prototype as unknown as { put: unknown; __put?: unknown };
        proto.__put = proto.put;
        proto.put = () => {
          throw new DOMException("quota", "QuotaExceededError");
        };
      });
      await page.evaluate(async () => {
        const v = window.__voxwright as Vox;
        const b = v.volume().placedBounds() as [number[], number[]];
        await v.edit(
          (b[0][0] as number) + 4,
          (b[1][1] as number) + 1,
          b[0][2] as number,
          "minecraft:glowstone",
        );
        await (v as unknown as { flushAutosave(): Promise<void> }).flushAutosave();
      });
      const failText = await text(page, "autosave");
      ok(
        /storage is full/.test(failText) && /still here/.test(failText),
        t(`a full disk is reported and the edits are kept (${failText.trim().slice(0, 70)}...)`),
      );
      ok((await session(page)).undoCount === 2, t("editing continues after a failed autosave"));
      await axeCheck(page, "autosave failure shown");
      await page.evaluate(() => {
        const proto = IDBObjectStore.prototype as unknown as { put: unknown; __put?: unknown };
        proto.put = proto.__put;
      });
      await page.evaluate(() =>
        (window.__voxwright as unknown as { flushAutosave(): Promise<void> }).flushAutosave(),
      );
      ok(
        (await text(page, "autosave")).includes("Saved in this browser") &&
          (await stored(page))?.edits === 5,
        t("autosave recovers once storage works again"),
      );

      // An export clears the snapshot.
      await page.select('[data-testid="format"]', "litematic");
      await page.click('[data-testid="convert"]');
      const t1 = Date.now();
      while ((await stored(page)) !== null && Date.now() - t1 < 8000) await sleep(200);
      ok((await stored(page)) === null, t("a successful export clears the snapshot"));
      ok(
        (await session(page)).unsaved === false,
        t("...and the page no longer counts the edits as unsaved"),
      );
      await page.close();

      // Nothing offered after that.
      page = (await open(browser)).page;
      ok(
        (await page.$('[data-testid="restore-dialog"][open]')) === null,
        t("after an export nothing is offered on the next visit"),
      );
      // Discard: edit, flush, reload, discard.
      await upload(page, "file", ctx.fixture);
      await statusHas(page, "blocks");
      await page.evaluate(async () => {
        const v = window.__voxwright as Vox;
        const b = v.volume().placedBounds() as [number[], number[]];
        await v.edit(
          b[0][0] as number,
          (b[1][1] as number) + 1,
          b[0][2] as number,
          "minecraft:glowstone",
        );
        await (v as unknown as { flushAutosave(): Promise<void> }).flushAutosave();
      });
      ok((await stored(page))?.edits === 1, t("a new session writes its own snapshot"));
      await page.close();
      page = (await open(browser)).page;
      await page.waitForSelector('[data-testid="restore-dialog"][open]', { timeout: 15000 });
      await page.focus('[data-testid="discard"]');
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        () => !document.querySelector('[data-testid="restore-dialog"][open]'),
      );
      ok((await stored(page)) === null, t("Discard deletes the snapshot"));
      ok(
        ((await page.$eval('[data-testid="status"]', (e) => e.textContent)) ?? "").startsWith(
          "open a schematic",
        ),
        t("...and leaves the page ready for a file"),
      );
      await page.close();
      page = (await open(browser)).page;
      ok(
        (await page.$('[data-testid="restore-dialog"][open]')) === null,
        t("a discarded session is not offered again"),
      );
      await page.close();
    }

    // ---- 4. Bring your own pack (GPU renderer, no pack on the site) ---------------------------
    {
      let { page, errors } = await open(browser, { noSitePack: true });
      ok(
        (await text(page, "pack-state")).includes("No texture pack"),
        t("without a site pack the panel offers one"),
      );
      await upload(page, "file", files.colours);
      await statusHas(page, "blocks");
      await settle(page);
      await waitColours(page, "none");
      const flat = await colours(page);
      ok(
        flat.red === 0 && flat.blue === 0,
        t("before the pack, stone and dirt are flat placeholders"),
      );
      ok(
        (await text(page, "placeholders")).includes("stone"),
        t("...and the page lists them as missing models"),
      );

      await upload(page, "pack-file", files.zip);
      await page.waitForFunction(
        () => document.querySelector('[data-testid="pack-name"]')?.textContent === "my-pack.zip",
        { timeout: 30000 },
      );
      await waitColours(page, "pack");
      const dressed = await colours(page);
      ok(
        dressed.red > 50 && dressed.blue > 50,
        t(
          `a dropped-in resource pack textures the open build (red ${dressed.red}, blue ${dressed.blue} pixels)`,
        ),
      );
      ok(
        (await page.$('[data-testid="placeholders"]')) === null,
        t("...and no placeholder note is left"),
      );
      const state = await text(page, "pack-state");
      ok(
        /3 textures, 2 blockstates, 2 models/.test(state),
        t(`the panel counts what was found (${state.trim().replace(/\s+/g, " ").slice(0, 90)})`),
      );
      ok(
        (await text(page, "pack-note")).includes("1 file"),
        t("a broken JSON file in the pack is skipped and mentioned"),
      );
      const rec = await stored(page, "pack", "user");
      ok(rec !== null, t("the pack is stored in IndexedDB"));
      ok(
        (await page.$('[data-block="minecraft:stone"]')) !== null,
        t("the block palette lists the pack's blocks"),
      );
      await page.evaluate(async () => {
        // Cutting the layers still works after the pack swap (slice kept through setPack).
        const r = (window.__voxwright as Vox).renderer;
        r.setSlice({ y0: 0, y1: 0 });
        await r.whenIdle();
        r.setSlice(null);
        await r.whenIdle();
      });
      if (ctx.shots) await page.screenshot({ path: join(ctx.shots, "user-pack.png") });
      await axeCheck(page, "pack in use");

      // Later visit: still there, used without being added again.
      await page.close();
      ({ page, errors } = await open(browser, { noSitePack: true }));
      ok(
        (await text(page, "pack-name")) === "my-pack.zip",
        t("on the next visit the pack is still there"),
      );
      await upload(page, "file", files.colours);
      await statusHas(page, "blocks");
      await settle(page);
      await waitColours(page, "pack");
      ok(true, t("...and textures the build from the start"));

      // A jar is read the same way.
      await upload(page, "pack-file", files.jar);
      await page.waitForFunction(
        () => document.querySelector('[data-testid="pack-name"]')?.textContent === "client.jar",
        { timeout: 30000 },
      );
      await waitColours(page, "pack");
      ok(true, t("a client .jar is accepted too and replaces the pack"));

      // Bad files are explained and change nothing.
      await upload(page, "pack-file", files.notZip);
      await page.waitForSelector('[data-testid="pack-error"]', { timeout: 10000 });
      ok(
        (await text(page, "pack-error")).includes("not a zip"),
        t("a file that is not a zip is explained"),
      );
      await upload(page, "pack-file", files.noAssets);
      await page.waitForFunction(
        () =>
          document
            .querySelector('[data-testid="pack-error"]')
            ?.textContent?.includes("assets/minecraft"),
        { timeout: 10000 },
      );
      ok(true, t("a zip without assets/minecraft is explained"));
      ok((await text(page, "pack-name")) === "client.jar", t("...and the pack in use stays"));
      const picture = await colours(page);
      ok(picture.red > 50, t("...and the picture keeps its textures"));

      // Drop on the page.
      await page.evaluate(async (b64) => {
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const dt = new DataTransfer();
        dt.items.add(new File([bin], "dropped.zip", { type: "application/zip" }));
        document
          .querySelector("main")
          ?.dispatchEvent(
            new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }),
          );
      }, Buffer.from(syntheticPackZip()).toString("base64"));
      await page.waitForFunction(
        () => document.querySelector('[data-testid="pack-name"]')?.textContent === "dropped.zip",
        { timeout: 30000 },
      );
      ok(true, t("a pack dropped on the page is taken"));

      // Remove.
      await removePack(page);
      await waitColours(page, "none");
      const afterRemove = await text(page, "pack-state");
      ok(
        afterRemove.includes("No texture pack"),
        t(`removing the pack goes back to the site's (none here): ${afterRemove.trim()}`),
      );
      ok((await stored(page, "pack", "user")) === null, t("...and deletes it from IndexedDB"));
      await page.close();
      ({ page } = await open(browser, { noSitePack: true }));
      ok(
        (await page.$('[data-testid="pack-name"]')) === null,
        t("a removed pack does not come back"),
      );
      await page.close();
      ok(
        errors.length === 0,
        t(`no console errors while using packs${errors.length ? `: ${errors.join(" | ")}` : ""}`),
      );
    }

    // ---- 5. A user pack over the site's pack ------------------------------------------------
    {
      const { page } = await open(browser);
      const site = !(await text(page, "pack-state")).includes("No texture pack");
      if (site) {
        await upload(page, "file", files.colours);
        await statusHas(page, "blocks");
        await settle(page);
        await waitColours(page, "none");
        ok(true, t("with the site's pack, stone and dirt are its textures (no pure red or blue)"));
        const before = await page.evaluate(
          () => (window.__voxwright as Vox).renderer.stats().fallbackBlocks.length,
        );
        await upload(page, "pack-file", files.zip);
        await waitColours(page, "pack");
        ok(true, t("a user pack overrides the site's textures for the blocks it defines"));
        const state = await text(page, "pack-state");
        ok(
          state.includes("laid over this site's pack"),
          t("the panel says it is laid over the site's pack"),
        );
        const after = await page.evaluate(
          () => (window.__voxwright as Vox).renderer.stats().fallbackBlocks.length,
        );
        ok(
          after <= before,
          t(
            `...and the site's other blocks still have their models (${before} placeholders before, ${after} after)`,
          ),
        );
        await removePack(page);
        await waitColours(page, "none");
        ok(true, t("removing it brings the site's textures back"));
      } else {
        console.log("  (this build has no site pack: the override check is skipped)");
      }
      await page.close();
    }

    // ---- 6. A phone-sized viewer ------------------------------------------------------------
    {
      const page = await browser.newPage();
      await page.setViewport({
        width: 390,
        height: 844,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      });
      await page.goto(ctx.url);
      await page.waitForFunction(
        () =>
          document
            .querySelector('[data-testid="status"]')
            ?.textContent?.startsWith("open a schematic"),
        { timeout: 30000 },
      );
      await upload(page, "file", ctx.fixture);
      await statusHas(page, "blocks");
      await settle(page);
      const m = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        coarse: matchMedia("(any-pointer: coarse)").matches,
        fine: matchMedia("(any-pointer: fine)").matches,
        toolbar: document.querySelector('[data-testid="toolbar"]') !== null,
        canvasW: (document.querySelector('[data-testid="canvas"]') as HTMLCanvasElement)
          .clientWidth,
        footer: document.querySelector('[data-testid="footer"]') !== null,
      }));
      ok(
        m.overflow <= 1,
        t(`on a 390 px wide screen the page does not scroll sideways (overflow ${m.overflow} px)`),
      );
      ok(
        m.canvasW > 250 && m.footer,
        t(`the picture (${m.canvasW} px) and the footer fit the phone`),
      );
      console.log(
        `  phone: any-pointer coarse=${m.coarse} fine=${m.fine}; editor shown=${m.toolbar}`,
      );
      if (m.coarse && !m.fine)
        ok(!m.toolbar, t("a touch-only device gets the viewer without the editor"));
      if (ctx.shots) await page.screenshot({ path: join(ctx.shots, "phone.png"), fullPage: true });
      await page.close();
    }
  } finally {
    await browser.close();
  }

  // ---- 7. The software renderer: a pack works there too ------------------------------------
  const cpu = await puppeteer.launch({
    executablePath: ctx.chromium,
    headless: true,
    args: chromiumArgs(false),
  });
  try {
    const { page } = await open(cpu, { noSitePack: true });
    ok(
      (await page.$eval('[data-testid="renderer"]', (e) => e.getAttribute("data-kind"))) === "cpu",
      t("the second browser has no WebGL2"),
    );
    await upload(page, "file", files.colours);
    await statusHas(page, "blocks");
    await waitColours(page, "none");
    await upload(page, "pack-file", files.zip);
    await waitColours(page, "pack");
    ok(true, t("the software renderer draws a user pack too"));
    await page.reload();
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="status"]')
          ?.textContent?.startsWith("open a schematic"),
      { timeout: 30000 },
    );
    await upload(page, "file", files.colours);
    await statusHas(page, "blocks");
    await waitColours(page, "pack");
    ok(true, t("...and keeps it across a reload"));
    await removePack(page);
    await waitColours(page, "none");
    await axeCheck(page, "software renderer, file open");
    await page.close();
  } finally {
    await cpu.close();
  }
  console.log(`  ${PACK_COLORS.stone.join(",")} is stone red in the synthetic pack`);
  console.log(axeReport.map((l) => `  ${l}`).join("\n"));
}
