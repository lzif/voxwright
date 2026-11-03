// SPDX-License-Identifier: AGPL-3.0-only

// The M3 end-to-end check, run by e2e.ts: open a real .litematic in the browser, edit it with real
// mouse and keyboard events, export, and read the exported file back in Node to see that exactly the
// intended cells changed. It cannot load the result in Litematica (not available here); that is
// still to be done by a person.
//
// How cells are judged: `snapshot` reads the page's volume cell by cell into a Map of coordinate to
// block string (air and unset cells left out), and every step compares snapshots, so the page's
// editor is checked against plain arithmetic on cells, not against itself. Where a step has to
// know what rotating or mirroring a region does to block states, core's own tools are applied to a
// copy of the snapshot (core's tests check them against the Python golden vectors).

import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyCommand,
  type Box,
  byte as byteTag,
  type CompoundTag,
  compound,
  copySelection,
  double,
  int,
  linePoints,
  list,
  makeBox,
  mirrorSelection,
  moveSelection,
  nbtEqual,
  pasteClipboard,
  readLitematic,
  readMcstructure,
  readSchem,
  readStructureNbt,
  rotateSelection,
  string,
  TagId,
  Volume,
  writeLitematic,
} from "@voxwright/core";
import puppeteer, { type ElementHandle, type KeyInput } from "puppeteer-core";
import { chromiumArgs } from "./site.ts";
import type { SessionView, Vox } from "./vox.ts";

type Cells = Map<string, string>;
type Vec = [number, number, number];

export interface SuiteContext {
  url: string;
  chromium: string;
  shots: string | undefined;
  fixture: string;
  ok(cond: unknown, what: string): void;
}

const AIR = "minecraft:air";
const key = (p: readonly unknown[]): string => p.join(",");
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const sha = async (path: string): Promise<string> =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");

/** Block strings of every cell that holds something other than air. */
function cellsOf(volume: Volume): Cells {
  const out: Cells = new Map();
  volume.eachCell((x, y, z, idx) => {
    const block = volume.palette[idx] as string;
    if (block !== AIR) out.set(key([x, y, z]), block);
  });
  return out;
}

/** The coordinates whose block differs between two snapshots. */
function diff(a: Cells, b: Cells): string[] {
  const keys = new Set([...a.keys(), ...b.keys()]);
  return [...keys].filter((k) => a.get(k) !== b.get(k)).sort();
}

function toVolume(cells: Cells): Volume {
  const v = new Volume();
  for (const [k, block] of cells) {
    const [x, y, z] = k.split(",").map(Number) as Vec;
    v.set(x, y, z, block);
  }
  return v;
}

export async function editorSuite(ctx: SuiteContext): Promise<void> {
  const { ok } = ctx;
  const t = (what: string): string => `[editor] ${what}`;
  const downloads = await mkdtemp(join(tmpdir(), "voxwright-edit-"));
  const sourceHash = await sha(ctx.fixture);
  const original = await readLitematic(new Uint8Array(await readFile(ctx.fixture)), {
    keepAir: true,
  });
  const originalCells = cellsOf(original.volume);

  const browser = await puppeteer.launch({
    executablePath: ctx.chromium,
    headless: true,
    args: chromiumArgs(true),
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    const dialogs: { type: string; message: string }[] = [];
    let answer: "accept" | "dismiss" = "accept";
    page.on("dialog", (d) => {
      dialogs.push({ type: d.type(), message: d.message() });
      void (answer === "accept" ? d.accept() : d.dismiss());
    });
    const cdp = await page.createCDPSession();
    await cdp.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloads,
      eventsEnabled: true,
    });

    // -- helpers that talk to the page --------------------------------------------------------
    const session = (): Promise<SessionView> =>
      page.evaluate(() => {
        const s = (window.__voxwright as Vox).session();
        if (s === null) throw new Error("no editor session");
        const { tool, block, hover, inspected, selection, undoCount, canUndo, canRedo, unsaved } =
          s;
        const { clipboardCells, message, error } = s;
        return JSON.parse(
          JSON.stringify({
            tool,
            block,
            hover,
            inspected,
            selection,
            undoCount,
            canUndo,
            canRedo,
            unsaved,
            clipboardCells,
            message,
            error,
          }),
        ) as SessionView;
      });
    const snapshot = (): Promise<Cells> =>
      page
        .evaluate(() => {
          const v = (window.__voxwright as Vox).volume();
          const [lo, hi] = v.placedBounds() as [number[], number[]];
          const out: [string, string][] = [];
          for (let x = lo[0] as number; x <= (hi[0] as number); x++)
            for (let y = lo[1] as number; y <= (hi[1] as number); y++)
              for (let z = lo[2] as number; z <= (hi[2] as number); z++) {
                const b = v.get(x, y, z);
                if (b !== undefined && b !== "minecraft:air") out.push([`${x},${y},${z}`, b]);
              }
          return out;
        })
        .then((e) => new Map(e));
    const picture = (): Promise<string> =>
      page.evaluate(() => {
        const r = (window.__voxwright as Vox).renderer;
        r.highlight([]); // outlines are not part of the question
        const shot = r.capture();
        if (shot === null) throw new Error("no frame");
        let h = 0;
        for (let i = 0; i < shot.rgba.length; i += 4)
          h = (h * 31 + (shot.rgba[i] as number) + (shot.rgba[i + 1] as number) * 3) | 0;
        return String(h);
      });
    const settle = (): Promise<void> =>
      page.evaluate(() => (window.__voxwright as Vox).renderer.whenIdle());
    /** Blocks whose top face the pointer reaches: where to click so that exactly that block is hit. */
    const tops = (): Promise<{ pos: Vec; pt: { x: number; y: number }; block: string }[]> =>
      page.evaluate(() => {
        const v = window.__voxwright as Vox;
        const vol = v.volume();
        const s = v.session() as NonNullable<ReturnType<Vox["session"]>>;
        const [lo, hi] = vol.bounds() as [number[], number[]];
        const out: { pos: Vec; pt: { x: number; y: number }; block: string }[] = [];
        for (let x = lo[0] as number; x <= (hi[0] as number); x++)
          for (let z = lo[2] as number; z <= (hi[2] as number); z++) {
            for (let y = hi[1] as number; y >= (lo[1] as number); y--) {
              const b = vol.get(x, y, z);
              if (b === undefined || b === "minecraft:air") continue;
              const pt = v.renderer.clientFromWorld(x + 0.5, y + 1, z + 0.5);
              const hit = pt === null ? null : s.pick(pt.x, pt.y);
              if (
                pt !== null &&
                hit !== null &&
                hit.position[0] === x &&
                hit.position[1] === y &&
                hit.position[2] === z &&
                hit.normal[1] === 1
              )
                out.push({ pos: [x, y, z], pt, block: b });
              break;
            }
          }
        return out;
      });
    const hoverAt = async (pt: { x: number; y: number }): Promise<SessionView> => {
      await page.mouse.move(pt.x, pt.y, { steps: 3 });
      await sleep(120);
      return session();
    };
    const press = async (k: string, mods: string[] = []): Promise<void> => {
      for (const m of mods) await page.keyboard.down(m as KeyInput);
      await page.keyboard.press(k as KeyInput);
      for (const m of mods.reverse()) await page.keyboard.up(m as KeyInput);
      await sleep(150);
    };
    const chooseBlock = async (name: string): Promise<void> => {
      await page.$eval('[data-testid="palette-search"]', (e) => {
        (e as HTMLInputElement).value = "";
      });
      await page.click('[data-testid="palette-search"]');
      await page.keyboard.type(name.replace("minecraft:", ""));
      await sleep(80);
      const entry = await page.$(`[data-block="${name}"]`);
      if (entry !== null) await entry.click();
      else await page.click('[data-testid="palette-use-typed"]');
      await page.$eval('[data-testid="palette-search"]', (e) => (e as HTMLElement).blur());
      const chosen = await page.$eval(
        '[data-testid="block-input"]',
        (e) => (e as HTMLInputElement).value,
      );
      ok(chosen === name, t(`the palette chooses ${name}`));
    };
    const tool = async (id: string): Promise<void> => {
      await page.click(`[data-testid="tool-${id}"]`);
      ok((await session()).tool === id, t(`the ${id} tool is selected`));
    };

    /** Export as .litematic through the page, and read the downloaded file back with core. */
    const exportLitematic = async (): Promise<{
      cells: Cells;
      bounds: string;
      dataVersion: number | null;
      name: string;
    }> => {
      const name = "Rafeals_house-edited.litematic";
      await rm(join(downloads, name), { force: true });
      await page.select('[data-testid="format"]', "litematic");
      await page.click('[data-testid="convert"]');
      const deadline = Date.now() + 30000;
      while (!readdirSync(downloads).includes(name) && Date.now() < deadline) await sleep(200);
      ok(readdirSync(downloads).includes(name), t(`export downloads a new file, ${name}`));
      const read = await readLitematic(new Uint8Array(await readFile(join(downloads, name))), {
        keepAir: true,
      });
      return {
        cells: cellsOf(read.volume),
        bounds: key(read.volume.placedBounds() ?? []),
        dataVersion: read.meta.dataVersion,
        name,
      };
    };

    // -- open ------------------------------------------------------------------------------------
    await page.goto(ctx.url);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="status"]')
          ?.textContent?.startsWith("open a schematic"),
      { timeout: 30000 },
    );
    const hasPack = await page.evaluate(
      () =>
        !document.querySelector('[data-testid="status"]')?.textContent?.includes("no texture pack"),
    );
    const input = (await page.$('[data-testid="file"]')) as ElementHandle<HTMLInputElement>;
    await input.uploadFile(ctx.fixture);
    await page.waitForFunction(
      () => document.querySelector('[data-testid="status"]')?.textContent?.includes("762 blocks"),
      { timeout: 60000 },
    );
    await settle();
    ok(
      (await page.$('[data-testid="toolbar"]')) !== null &&
        (await page.$('[data-testid="palette"]')) !== null &&
        (await page.$('[data-testid="blockstate"]')) !== null,
      t("the editor toolbar, block palette and block-state panel are shown"),
    );
    ok(
      (await page.$eval('[data-testid="edit-help"]', (e) => e.textContent ?? "")).includes("Alt"),
      t("the help text explains how to turn the view while a tool is active"),
    );
    ok((await session()).tool === "navigate", t("the page starts in the view-only tool"));
    const start = await snapshot();
    ok(
      diff(start, originalCells).length === 0,
      t("the page's volume equals the file as read in Node"),
    );
    const entries = await page.$$eval('[data-testid="palette-list"] button', (b) => b.length);
    ok(
      hasPack ? entries >= 200 : entries >= 10,
      t(`the palette lists ${entries} blocks (texture pack ${hasPack ? "present" : "absent"})`),
    );
    const pictureBefore = await picture();

    // -- View tool: clicks do not edit; the camera still turns ------------------------------------
    let all = await tops();
    ok(all.length > 20, t(`${all.length} blocks have a top face the pointer can reach`));
    const first = all[Math.floor(all.length / 2)] as (typeof all)[number];
    await page.mouse.click(first.pt.x, first.pt.y);
    ok((await session()).undoCount === 0, t("clicking with the View tool changes nothing"));
    const hovered = await hoverAt(first.pt);
    ok(
      key(hovered.hover?.position ?? []) === key(first.pos),
      t("hovering names the block under the pointer (the core raycast along the camera ray)"),
    );
    const pose0 = await page.evaluate(() => (window.__voxwright as Vox).renderer.getPose());
    await page.mouse.down();
    await page.mouse.move(first.pt.x + 80, first.pt.y, { steps: 5 });
    await page.mouse.up();
    const pose1 = await page.evaluate(() => (window.__voxwright as Vox).renderer.getPose());
    ok(pose1.azimuth !== pose0.azimuth, t("dragging with the View tool turns the camera"));
    ok((await session()).undoCount === 0, t("...and still changes nothing"));
    await page.evaluate(() =>
      (window.__voxwright as Vox).renderer.setOrbit({ azimuth: 45, elevation: 35 }),
    );
    await settle();

    // -- Shortcuts stay out of the palette search ------------------------------------------------
    await tool("erase");
    await page.click('[data-testid="palette-search"]');
    await page.keyboard.type("lantern rpmbxiv");
    ok(
      (await session()).tool === "erase",
      t("typing in the palette search does not trigger tool shortcuts"),
    );
    await page.$eval('[data-testid="palette-search"]', (e) => {
      (e as HTMLInputElement).value = "";
      (e as HTMLElement).blur();
    });
    await page.mouse.move(5, 5);
    await press("l");
    ok(
      (await session()).tool === "line",
      t("with the search not focused, L selects the Line tool"),
    );
    await press("p");
    ok((await session()).tool === "place", t("P selects the Place tool"));

    // -- Place one block with a real click -----------------------------------------------------
    await chooseBlock("minecraft:sea_lantern");
    all = await tops();
    const placeAt = all[Math.floor(all.length * 0.3)] as (typeof all)[number];
    await hoverAt(placeAt.pt);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(150);
    const adj: Vec = [placeAt.pos[0], placeAt.pos[1] + 1, placeAt.pos[2]];
    let now = await snapshot();
    ok(
      key(diff(start, now)) === key([key(adj)]) && now.get(key(adj)) === "minecraft:sea_lantern",
      t(`Place with one click adds exactly one block, ${key(adj)}`),
    );
    ok((await session()).undoCount === 1, t("one click is one undo step"));
    await settle();
    const pictureEdited = await picture();
    ok(pictureEdited !== pictureBefore, t("the WebGL picture changes after the edit"));

    // -- Undo and redo ---------------------------------------------------------------------------
    await press("z", ["Control"]);
    ok(diff(start, await snapshot()).length === 0, t("Ctrl+Z undoes the placed block"));
    await settle();
    ok((await picture()) === pictureBefore, t("...and the picture is the original again"));
    await press("Z", ["Control", "Shift"]);
    ok(diff(start, await snapshot()).length === 1, t("Ctrl+Shift+Z redoes it"));
    await press("z", ["Control"]);
    await press("y", ["Control"]);
    ok(diff(start, await snapshot()).length === 1, t("Ctrl+Y redoes it too"));
    await page.click('[data-testid="undo"]');
    ok(diff(start, await snapshot()).length === 0, t("the Undo button undoes it"));
    await page.click('[data-testid="redo"]');
    ok(diff(start, await snapshot()).length === 1, t("the Redo button redoes it"));
    await settle();
    ok((await picture()) === pictureEdited, t("the redone picture equals the edited one"));

    // -- Replace one block (paint) ---------------------------------------------------------------
    await chooseBlock("minecraft:gold_block");
    await press("b");
    ok((await session()).tool === "paint", t("B selects the Replace tool"));
    all = await tops();
    const paintAt = all[Math.floor(all.length * 0.6)] as (typeof all)[number];
    await hoverAt(paintAt.pt);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(150);
    const afterPaint = await snapshot();
    ok(
      key(diff(now, afterPaint)) === key([key(paintAt.pos)]) &&
        afterPaint.get(key(paintAt.pos)) === "minecraft:gold_block",
      t(`Replace turns exactly ${key(paintAt.pos)} into gold`),
    );
    now = afterPaint;

    // -- Block state: facing and waterlogged -----------------------------------------------------
    all = await tops();
    const stair = all.find(
      (c) => c.block.startsWith("minecraft:stone_brick_stairs[") && now.get(key(c.pos)) === c.block,
    ) as (typeof all)[number];
    await hoverAt(stair.pt);
    await page.mouse.move(1000, 600, { steps: 4 }); // off the canvas, into the panels
    await sleep(100);
    ok(
      key((await session()).inspected ?? []) === key(stair.pos),
      t("the block-state panel keeps the block that was last pointed at"),
    );
    const facing = /facing=(\w+)/.exec(stair.block)?.[1] as string;
    const newFacing = facing === "east" ? "south" : "east";
    await page.click('[data-testid="prop-facing"]', { count: 3 });
    await page.keyboard.type(newFacing);
    await page.keyboard.press("Enter");
    await sleep(150);
    let cell = (await snapshot()).get(key(stair.pos)) as string;
    ok(
      cell.includes(`facing=${newFacing}`) && cell.startsWith("minecraft:stone_brick_stairs["),
      t(`typing a facing in the panel changes ${key(stair.pos)} to facing=${newFacing}`),
    );
    await page.select('[data-testid="prop-waterlogged"]', "true");
    await sleep(150);
    cell = (await snapshot()).get(key(stair.pos)) as string;
    ok(cell.includes("waterlogged=true"), t("the waterlogged drop-down sets waterlogged=true"));
    const afterState = await snapshot();
    const stateDiff = diff(now, afterState);
    ok(
      key(stateDiff) === key([key(stair.pos)]),
      t("only the pointed-at block changed (two properties, two undo steps)"),
    );
    ok((await session()).undoCount === 4, t("the edits so far are four undo steps"));
    await press("z", ["Control"]);
    ok(
      ((await snapshot()).get(key(stair.pos)) as string).includes("waterlogged=false"),
      t("Ctrl+Z takes the last property change back"),
    );
    await press("z", ["Control"]);
    ok(
      (await snapshot()).get(key(stair.pos)) === stair.block,
      t("a second Ctrl+Z restores the original block state"),
    );
    await press("y", ["Control"]);
    await press("y", ["Control"]);
    ok(
      diff(afterState, await snapshot()).length === 0,
      t("Ctrl+Y twice brings both property changes back"),
    );
    now = afterState;

    // -- Erase -----------------------------------------------------------------------------------
    await press("x");
    all = await tops();
    const eraseAt = all.find(
      (c) => now.get(key(c.pos)) === c.block && key(c.pos) !== key(stair.pos),
    ) as (typeof all)[number];
    await hoverAt(eraseAt.pt);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(150);
    const afterErase = await snapshot();
    ok(
      key(diff(now, afterErase)) === key([key(eraseAt.pos)]) && !afterErase.has(key(eraseAt.pos)),
      t(`Erase clears exactly ${key(eraseAt.pos)}`),
    );
    now = afterErase;

    // -- A drag is one undo step ------------------------------------------------------------------
    await chooseBlock("minecraft:sea_lantern");
    await press("p");
    all = await tops();
    const byRow = new Map<string, typeof all>();
    for (const c of all) {
      if (now.get(key([c.pos[0], c.pos[1] + 1, c.pos[2]])) !== undefined) continue;
      const rowKey = `${c.pos[1]},${c.pos[2]}`;
      byRow.set(rowKey, [...(byRow.get(rowKey) ?? []), c]);
    }
    let run: typeof all = [];
    for (const row of byRow.values()) {
      const sorted = row.sort((a, b) => a.pos[0] - b.pos[0]);
      let cur: typeof all = [];
      for (const c of sorted) {
        const prev = cur[cur.length - 1];
        if (prev !== undefined && c.pos[0] === prev.pos[0] + 1) cur.push(c);
        else cur = [c];
        if (cur.length > run.length) run = [...cur];
      }
    }
    ok(run.length >= 3, t(`found a flat run of ${run.length} visible blocks to drag along`));
    const undoBefore = (await session()).undoCount;
    const runStart = run[0] as (typeof all)[number];
    const runEnd = run[run.length - 1] as (typeof all)[number];
    await hoverAt(runStart.pt);
    await page.mouse.down();
    for (let i = 1; i < 8; i++) {
      await page.mouse.move(
        runStart.pt.x + ((runEnd.pt.x - runStart.pt.x) * i) / 7,
        runStart.pt.y + ((runEnd.pt.y - runStart.pt.y) * i) / 7,
      );
      await sleep(40);
    }
    await page.mouse.up();
    await sleep(150);
    const afterDrag = await snapshot();
    const dragged = diff(now, afterDrag);
    const wantRun = run.map((c) => key([c.pos[0], c.pos[1] + 1, c.pos[2]])).sort();
    ok(
      key(dragged) === key(wantRun) &&
        dragged.every((k) => afterDrag.get(k) === "minecraft:sea_lantern"),
      t(`dragging with Place paints the ${run.length} cells along the surface`),
    );
    ok((await session()).undoCount === undoBefore + 1, t("the whole drag is one undo step"));
    await press("z", ["Control"]);
    ok(diff(now, await snapshot()).length === 0, t("one Ctrl+Z takes the whole drag back"));
    await press("y", ["Control"]);
    ok(diff(afterDrag, await snapshot()).length === 0, t("and Ctrl+Y puts it back"));
    now = afterDrag;

    // -- Checkpoint export: only the blocks edited so far differ from the file that was opened -----
    {
      const cp = await exportLitematic();
      ok(
        cp.bounds === key(original.volume.placedBounds() ?? []),
        t("the exported region has the original's size and position"),
      );
      ok(
        diff(cp.cells, now).length === 0,
        t(
          `every cell of the exported .litematic equals the edited volume (${cp.cells.size} blocks)`,
        ),
      );
      const changedCells = diff(originalCells, cp.cells);
      const intended = [
        key(adj),
        key(paintAt.pos),
        key(stair.pos),
        key(eraseAt.pos),
        ...wantRun,
      ].sort();
      ok(
        key(changedCells) === key([...new Set(intended)].sort()),
        t(
          `exactly the ${new Set(intended).size} edited cells differ from the original file: the placed block, the replaced block, the changed state, the erased block and the dragged line`,
        ),
      );
      ok(
        cp.cells.get(key(adj)) === "minecraft:sea_lantern",
        t("the placed block is in the exported file"),
      );
      ok(
        cp.cells.get(key(paintAt.pos)) === "minecraft:gold_block",
        t("the replaced block is in the exported file"),
      );
      ok(!cp.cells.has(key(eraseAt.pos)), t("the erased block is gone from the exported file"));
      ok(
        (cp.cells.get(key(stair.pos)) ?? "").includes(`facing=${newFacing}`) &&
          (cp.cells.get(key(stair.pos)) ?? "").includes("waterlogged=true"),
        t("the changed block state is in the exported file"),
      );
      ok(
        cp.dataVersion === original.meta.dataVersion,
        t(`the data version is kept (${cp.dataVersion})`),
      );
      ok(
        (await sha(ctx.fixture)) === sourceHash,
        t("the source .litematic is byte for byte unchanged"),
      );
    }

    // -- Eyedropper, line and rectangle (filled and hollow) --------------------------------------------
    await press("i");
    all = await tops();
    const dropAt = all.find((c) =>
      c.block.startsWith("minecraft:stone_brick_stairs["),
    ) as (typeof all)[number];
    await hoverAt(dropAt.pt);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(150);
    const dropped = await session();
    ok(
      dropped.block === dropAt.block &&
        dropped.tool === "place" &&
        dropped.undoCount === (await session()).undoCount,
      t("the eyedropper takes the clicked block's state, then switches to Place"),
    );
    ok(
      (await page.$eval('[data-testid="block-input"]', (e) => (e as HTMLInputElement).value)) ===
        dropAt.block,
      t("...and the palette shows it"),
    );
    await chooseBlock("minecraft:amethyst_block");
    const empty = (c: { pos: Vec }, snap: Cells): boolean =>
      !snap.has(key([c.pos[0], c.pos[1] + 1, c.pos[2]]));
    const above = (c: { pos: Vec }): Vec => [c.pos[0], c.pos[1] + 1, c.pos[2]];

    await press("l");
    all = await tops();
    const free = all.filter((c) => empty(c, now));
    const lineA = free.reduce((a, c) => (c.pt.x < a.pt.x ? c : a));
    const lineB = free.reduce((a, c) => (c.pt.x > a.pt.x ? c : a));
    const preLine = await snapshot();
    const undoLine = (await session()).undoCount;
    await hoverAt(lineA.pt);
    await page.mouse.down();
    await page.mouse.move((lineA.pt.x + lineB.pt.x) / 2, (lineA.pt.y + lineB.pt.y) / 2, {
      steps: 3,
    });
    await page.mouse.move(lineB.pt.x, lineB.pt.y, { steps: 3 });
    await sleep(80);
    await page.mouse.up();
    await sleep(150);
    const postLine = await snapshot();
    const wantLine = linePoints(above(lineA), above(lineB));
    ok(
      wantLine.length > 5 &&
        wantLine.every((p) => postLine.get(key(p)) === "minecraft:amethyst_block") &&
        diff(preLine, postLine).every((k) => wantLine.some((p) => key(p) === k)),
      t(`Line draws the ${wantLine.length} cells between the two faces, and nothing else`),
    );
    ok((await session()).undoCount === undoLine + 1, t("a line is one undo step"));
    now = postLine;

    await press("r");
    const flat = async (): Promise<[(typeof all)[number], (typeof all)[number]]> => {
      const cur = (await tops()).filter((c) => empty(c, now));
      for (const a of cur)
        for (const b of cur)
          if (
            a.pos[1] === b.pos[1] &&
            b.pos[0] - a.pos[0] >= 3 &&
            Math.abs(b.pos[2] - a.pos[2]) >= 3 &&
            b.pos[0] - a.pos[0] <= 8
          )
            return [a, b];
      throw new Error("no flat area to draw a rectangle on");
    };
    const rectangle = async (a: (typeof all)[number], b: (typeof all)[number]): Promise<Cells> => {
      await hoverAt(a.pt);
      await page.mouse.down();
      await page.mouse.move((a.pt.x + b.pt.x) / 2, (a.pt.y + b.pt.y) / 2, { steps: 3 });
      await page.mouse.move(b.pt.x, b.pt.y, { steps: 3 });
      await sleep(80);
      await page.mouse.up();
      await sleep(150);
      return snapshot();
    };
    const [ra, rb] = await flat();
    const rectBox = makeBox(above(ra), above(rb));
    const preRect = now;
    const undoRect = (await session()).undoCount;
    const postRect = await rectangle(ra, rb);
    const rectCells = diff(preRect, postRect);
    const area = (rectBox.max[0] - rectBox.min[0] + 1) * (rectBox.max[2] - rectBox.min[2] + 1);
    const wantRect: string[] = [];
    for (let x = rectBox.min[0]; x <= rectBox.max[0]; x++)
      for (let z = rectBox.min[2]; z <= rectBox.max[2]; z++)
        wantRect.push(key([x, rectBox.min[1], z]));
    ok(
      wantRect.length === area &&
        wantRect.every((k) => postRect.get(k) === "minecraft:amethyst_block") &&
        rectCells.every((k) => wantRect.includes(k)),
      t(`Rectangle fills the ${area} cells between the two points on one layer, and nothing else`),
    );
    ok((await session()).undoCount === undoRect + 1, t("a rectangle is one undo step"));
    now = postRect;

    await page.click('[data-testid="hollow"]');
    const [ha, hb] = await flat();
    const hollowBox = makeBox(above(ha), above(hb));
    const hw = hollowBox.max[0] - hollowBox.min[0] + 1;
    const hl = hollowBox.max[2] - hollowBox.min[2] + 1;
    const postHollow = await rectangle(ha, hb);
    const hollowCells = diff(now, postHollow);
    const frame: string[] = [];
    for (let x = hollowBox.min[0]; x <= hollowBox.max[0]; x++)
      for (let z = hollowBox.min[2]; z <= hollowBox.max[2]; z++)
        if (
          x === hollowBox.min[0] ||
          x === hollowBox.max[0] ||
          z === hollowBox.min[2] ||
          z === hollowBox.max[2]
        )
          frame.push(key([x, hollowBox.min[1], z]));
    ok(
      frame.length === 2 * (hw + hl) - 4 &&
        frame.every((k) => postHollow.get(k) === "minecraft:amethyst_block") &&
        hollowCells.every((k) => {
          const p = k.split(",").map(Number) as Vec;
          const edge =
            p[0] === hollowBox.min[0] ||
            p[0] === hollowBox.max[0] ||
            p[2] === hollowBox.min[2] ||
            p[2] === hollowBox.max[2];
          return (
            edge && p[1] === hollowBox.min[1] && postHollow.get(k) === "minecraft:amethyst_block"
          );
        }),
      t(
        `a hollow Rectangle draws only the ${frame.length}-cell frame, not the other ${hw * hl - frame.length}`,
      ),
    );
    await page.click('[data-testid="hollow"]');
    now = postHollow;

    // -- Alt-drag turns and right-drag pans while a tool is active ---------------------------------
    const undoNow = (await session()).undoCount;
    const poseA = await page.evaluate(() => (window.__voxwright as Vox).renderer.getPose());
    await page.keyboard.down("Alt");
    await page.mouse.move(first.pt.x, first.pt.y);
    await page.mouse.down();
    await page.mouse.move(first.pt.x + 70, first.pt.y + 10, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up("Alt");
    const poseB = await page.evaluate(() => (window.__voxwright as Vox).renderer.getPose());
    ok(poseB.azimuth !== poseA.azimuth, t("Alt+drag turns the camera while Place is active"));
    await page.mouse.move(first.pt.x, first.pt.y);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(first.pt.x + 40, first.pt.y + 20, { steps: 4 });
    await page.mouse.up({ button: "right" });
    ok(
      (await session()).undoCount === undoNow,
      t("camera drags with a tool active change nothing"),
    );
    await page.evaluate(() =>
      (window.__voxwright as Vox).renderer.setOrbit({ azimuth: 45, elevation: 35 }),
    );
    await settle();

    // -- The layer slice limits picking ---------------------------------------------------------
    const grid = (): Promise<{ x: number; y: number }[]> =>
      page.evaluate(() => {
        const r = document.querySelector('[data-testid="canvas"]') as HTMLCanvasElement;
        const b = r.getBoundingClientRect();
        const pts: { x: number; y: number }[] = [];
        for (let i = 1; i < 30; i++)
          for (let k = 1; k < 20; k++)
            pts.push({ x: b.left + (b.width * i) / 30, y: b.top + (b.height * k) / 20 });
        return pts;
      });
    const probe = (
      pts: { x: number; y: number }[],
    ): Promise<({ position: Vec; normal: Vec; adjacent: Vec } | null)[]> =>
      page.evaluate(
        (points) =>
          points.map((p) => {
            const h = (window.__voxwright as Vox).session()?.pick(p.x, p.y) ?? null;
            return h && { position: h.position, normal: h.normal, adjacent: h.adjacent };
          }),
        pts,
      );
    const setLayer = async (id: "ymin" | "ymax", value: number): Promise<void> => {
      await page.$eval(
        `[data-testid="${id}"]`,
        (e, v) => {
          const el = e as HTMLInputElement;
          el.value = String(v);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        },
        value,
      );
      await settle();
    };
    const points = await grid();
    const unsliced = await probe(points);
    await setLayer("ymax", 3);
    const sliced = await probe(points);
    ok(
      sliced.every((h) => h === null || h.position[1] <= 3),
      t("with layers 0 to 3 shown, the pointer never picks a block above them"),
    );
    ok(
      unsliced.some((h, i) => h !== null && h.position[1] >= 5 && sliced[i] !== null),
      t("where a hidden roof block was picked, the block seen through the cut is picked instead"),
    );
    const topCut = points.findIndex((_, i) => {
      const h = sliced[i];
      return h !== null && h !== undefined && h.position[1] === 3 && h.normal[1] === 1;
    });
    ok(topCut >= 0, t("the cut layer's top faces can be pointed at"));
    const cutPoint = points[topCut] as { x: number; y: number };
    const beforeCut = await snapshot();
    const undoCut = (await session()).undoCount;
    const hoverCut = await hoverAt(cutPoint);
    ok(
      key(hoverCut.hover?.adjacent ?? []) === key((sliced[topCut] as { adjacent: Vec }).adjacent),
      t("hovering inside the slice gives the same pick"),
    );
    await page.mouse.down();
    await page.mouse.up();
    await sleep(150);
    ok(
      (await session()).undoCount === undoCut && diff(beforeCut, await snapshot()).length === 0,
      t("Place never puts a block outside the layers that are shown"),
    );
    await setLayer("ymax", 15);

    // -- Box select, fill, replace ----------------------------------------------------------------
    await press("m");
    ok((await session()).tool === "select", t("M selects the Select tool"));
    all = await tops();
    const roof = all.filter((c) => c.pos[1] >= 4 && now.get(key(c.pos)) === c.block);
    const cornerA = roof.reduce((a, c) => (c.pt.x + c.pt.y < a.pt.x + a.pt.y ? c : a));
    const cornerB = roof.reduce((a, c) => (c.pt.x - c.pt.y > a.pt.x - a.pt.y ? c : a));
    await hoverAt(cornerA.pt);
    await page.mouse.down();
    await page.mouse.move((cornerA.pt.x + cornerB.pt.x) / 2, (cornerA.pt.y + cornerB.pt.y) / 2, {
      steps: 3,
    });
    await page.mouse.move(cornerB.pt.x, cornerB.pt.y, { steps: 3 });
    await sleep(80);
    await page.mouse.up();
    await sleep(150);
    const picked = (await session()).selection as NonNullable<SessionView["selection"]>;
    const wantBox = makeBox(cornerA.pos, cornerB.pos);
    ok(
      key(picked.min) === key(wantBox.min) && key(picked.max) === key(wantBox.max),
      t(`dragging with Select selects the box ${key(wantBox.min)} to ${key(wantBox.max)}`),
    );
    ok((await session()).undoCount === undoNow, t("selecting is not an edit"));
    await page.mouse.move(5, 5);
    await sleep(200);
    if (ctx.shots) await page.screenshot({ path: join(ctx.shots, "editor-selection-webgl.png") });

    await chooseBlock("minecraft:glass");
    const preFill = await snapshot();
    await page.click('[data-testid="fill"]');
    await sleep(200);
    const postFill = await snapshot();
    const wantFill: Cells = new Map(preFill);
    for (let x = wantBox.min[0]; x <= wantBox.max[0]; x++)
      for (let y = wantBox.min[1]; y <= wantBox.max[1]; y++)
        for (let z = wantBox.min[2]; z <= wantBox.max[2]; z++)
          wantFill.set(key([x, y, z]), "minecraft:glass");
    ok(
      diff(postFill, wantFill).length === 0,
      t("Fill sets every cell of the selection to glass and nothing else"),
    );
    await press("z", ["Control"]);
    ok(diff(preFill, await snapshot()).length === 0, t("one Ctrl+Z undoes the whole fill"));
    await press("Z", ["Control", "Shift"]);
    ok(diff(postFill, await snapshot()).length === 0, t("and Ctrl+Shift+Z redoes it"));

    // Replace, over everything: select all, then turn the most common block into oak planks.
    await page.click('[data-testid="select-all"]').catch(async () => {
      await page.keyboard.press("Escape");
      await page.click('[data-testid="select-all"]');
    });
    await sleep(100);
    const preReplace = await snapshot();
    const tally = new Map<string, number>();
    for (const b of preReplace.values()) tally.set(b, (tally.get(b) ?? 0) + 1);
    const [from, planks] = [...tally]
      .filter(([b]) => !["minecraft:glass", "minecraft:oak_planks"].includes(b))
      .sort((a, b) => b[1] - a[1])[0] as [string, number];
    await page.click('[data-testid="replace-from"]');
    await page.keyboard.type(from);
    await chooseBlock("minecraft:oak_planks");
    await page.click('[data-testid="replace"]');
    await sleep(250);
    const postReplace = await snapshot();
    const wantReplace: Cells = new Map(
      [...preReplace].map(([k, b]) => [k, b === from ? "minecraft:oak_planks" : b]),
    );
    ok(planks > 5, t(`the build has ${planks} of ${from} to replace`));
    ok(
      diff(postReplace, wantReplace).length === 0 &&
        diff(preReplace, postReplace).length === planks,
      t(`Replace turns exactly those ${planks} blocks into oak planks`),
    );
    now = postReplace;
    await settle();
    const pictureMid = await picture();
    ok(pictureMid !== pictureEdited, t("the picture shows the fill and the replace"));

    // -- Rotate (key), mirror and move (buttons) on a numeric selection ---------------------------
    const setSel = async (box: Box): Promise<void> => {
      for (const [which, v] of [
        ["min", box.min],
        ["max", box.max],
      ] as const) {
        for (const [i, a] of ["x", "y", "z"].entries()) {
          const sel = `[data-testid="sel-${which}-${a}"]`;
          await page.click(sel, { count: 3 });
          await page.keyboard.type(String(v[i]));
          await page.keyboard.press("Tab");
        }
      }
      await sleep(100);
    };
    const house = makeBox([9, 0, 9], [22, 7, 22]);
    await setSel(house);
    const sel2 = (await session()).selection as NonNullable<SessionView["selection"]>;
    ok(
      key(sel2.min) === key(house.min) && key(sel2.max) === key(house.max),
      t("the selection corners can be typed in"),
    );
    const preRotate = await snapshot();
    await page.mouse.move(5, 5);
    await press("]");
    await sleep(200);
    const postRotate = await snapshot();
    const rotateModel = toVolume(preRotate);
    applyCommand(rotateModel, rotateSelection(rotateModel, house, "CLOCKWISE_90"));
    ok(
      diff(postRotate, cellsOf(rotateModel)).length === 0 &&
        diff(preRotate, postRotate).length > 200,
      t(
        `] rotates the selection 90 degrees clockwise (${diff(preRotate, postRotate).length} cells changed)`,
      ),
    );
    now = postRotate;

    await page.click('[data-testid="mirror-x"]');
    await sleep(200);
    const postMirror = await snapshot();
    const mirrorModel = toVolume(postRotate);
    applyCommand(mirrorModel, mirrorSelection(mirrorModel, house, "x"));
    ok(
      diff(postMirror, cellsOf(mirrorModel)).length === 0 &&
        diff(postRotate, postMirror).length > 100,
      t("Mirror E-W flips the selection"),
    );

    await page.click('[data-testid="move-x"]', { count: 3 });
    await page.keyboard.type("1");
    await page.click('[data-testid="move"]');
    await sleep(200);
    const postMove = await snapshot();
    const moveModel = toVolume(postMirror);
    applyCommand(moveModel, moveSelection(moveModel, house, [1, 0, 0], { skipAir: true }));
    ok(
      diff(postMove, cellsOf(moveModel)).length === 0,
      t("Move shifts the selection one block east"),
    );
    const movedSel = (await session()).selection as NonNullable<SessionView["selection"]>;
    ok(movedSel.min[0] === 10 && movedSel.max[0] === 23, t("the selection moves with its blocks"));

    // -- Copy and paste with real keys and a real click ----------------------------------------------
    await setSel(makeBox([14, 0, 14], [17, 3, 17]));
    const copyBox = makeBox([14, 0, 14], [17, 3, 17]);
    await page.mouse.move(5, 5);
    await press("c", ["Control"]);
    ok((await session()).clipboardCells > 10, t("Ctrl+C copies the selection"));
    await press("v", ["Control"]);
    ok((await session()).tool === "paste", t("Ctrl+V starts a paste"));
    all = await tops();
    const target =
      all.find((c) => c.pos[0] <= 12 && c.pos[1] >= 1) ?? (all[0] as (typeof all)[number]);
    const hoverPaste = await hoverAt(target.pt);
    const anchor = (hoverPaste.hover as NonNullable<SessionView["hover"]>).adjacent;
    const prePaste = await snapshot();
    await page.mouse.down();
    await page.mouse.up();
    await sleep(250);
    const postPaste = await snapshot();
    const pasteModel = toVolume(prePaste);
    applyCommand(
      pasteModel,
      pasteClipboard(pasteModel, copySelection(pasteModel, copyBox), anchor, { skipAir: true }),
    );
    ok(
      diff(postPaste, cellsOf(pasteModel)).length === 0 && diff(prePaste, postPaste).length > 0,
      t(
        `clicking pastes the copied blocks at ${key(anchor)} (${diff(prePaste, postPaste).length} cells)`,
      ),
    );
    now = postPaste;

    // -- Unsaved edits warn on leaving; export writes a new file -----------------------------------------
    const warns = (): Promise<boolean> =>
      page.evaluate(() => {
        const e = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(e);
        return e.defaultPrevented;
      });
    ok(await warns(), t("leaving the page with unexported edits asks first (beforeunload)"));
    await settle();
    const pictureFinal = await picture();
    ok(pictureFinal !== pictureBefore, t("the final picture differs from the one that was opened"));

    const fin = await exportLitematic();
    ok(
      !readdirSync(downloads).includes("Rafeals_house.litematic"),
      t("export never reuses the source file's name"),
    );
    ok(
      (await sha(ctx.fixture)) === sourceHash,
      t("the source .litematic is still byte for byte unchanged"),
    );
    ok(!(await warns()), t("after exporting there is nothing left to warn about"));
    await press("z", ["Control"]);
    ok(await warns(), t("an edit after the export warns again"));
    await press("y", ["Control"]);
    ok(
      fin.bounds === key(original.volume.placedBounds() ?? []),
      t("the final export has the original's size and position"),
    );
    ok(
      diff(fin.cells, now).length === 0 && diff(originalCells, fin.cells).length > 300,
      t(
        `after rotate, mirror, move and paste every cell of the exported file equals the edited volume (${diff(originalCells, fin.cells).length} cells differ from the original)`,
      ),
    );

    // The loss report: a conversion to another format still lists what it cannot carry.
    await page.select('[data-testid="format"]', "mcstructure");
    await page.click('[data-testid="convert"]');
    await sleep(1500);
    const loss = await page.$$eval('[data-testid="loss"] li', (l) => l.map((x) => x.textContent));
    console.log(`  loss report for .mcstructure: ${loss.length ? loss.join(" | ") : "(empty)"}`);
    ok(
      readdirSync(downloads).includes("Rafeals_house-edited.mcstructure"),
      t("exporting to .mcstructure works from the edited volume too"),
    );

    // -- Opening another file with unsaved edits asks first ----------------------------------------------
    answer = "dismiss";
    await press("z", ["Control"]);
    const undoKept = (await session()).undoCount;
    await input.uploadFile(ctx.fixture);
    await sleep(800);
    ok(
      dialogs.some((d) => d.type === "confirm") && (await session()).undoCount === undoKept,
      t("cancelling the question keeps the edited volume"),
    );
    answer = "accept";
    await input.uploadFile(ctx.fixture);
    await page.waitForFunction(() => (window.__voxwright as Vox).session()?.undoCount === 0, {
      timeout: 30000,
    });
    await settle();
    ok(
      diff(await snapshot(), originalCells).length === 0,
      t("accepting opens the file afresh, with an empty history"),
    );
    ok(!(await warns()), t("a freshly opened file has nothing to warn about"));

    // -- Block entities ride along ---------------------------------------------------------------
    // bloxelizer.com saved the 18 chests of the house without contents, so the file is made here: the
    // same build, with every chest filled and an armor stand standing in it. It is opened in the page,
    // one unrelated block is edited with the mouse, and the export must still hold every chest as it was.
    const chestFile = join(downloads, "chests.litematic");
    const filled = (
      await readLitematic(new Uint8Array(await readFile(ctx.fixture)), { keepAir: true })
    ).volume;
    const chestCells: Vec[] = [];
    filled.eachCell((x, y, z, idx) => {
      if ((filled.palette[idx] as string).startsWith("minecraft:chest")) chestCells.push([x, y, z]);
    });
    chestCells.sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0]);
    const contentsOf = (n: number): CompoundTag =>
      compound([
        ["id", string("minecraft:chest")],
        [
          "Items",
          list(TagId.Compound, [
            compound([
              ["Slot", byteTag(n % 27)],
              ["id", string("minecraft:diamond")],
              ["count", int(n + 1)],
            ]),
          ]),
        ],
        ["CustomName", string(`{"text":"chest ${n}"}`)],
      ]);
    chestCells.forEach(([x, y, z], n) => {
      filled.setBlockEntity(x, y, z, { edition: "java", nbt: contentsOf(n) });
    });
    filled.addEntity({
      edition: "java",
      nbt: compound([
        ["id", string("minecraft:armor_stand")],
        ["Pos", list(TagId.Double, [double(3.5), double(1), double(3.5)])],
      ]),
    });
    ok(chestCells.length === 18, t("the house has 18 chests"));
    await writeFile(chestFile, (await writeLitematic(filled, { dataVersion: 5023 })).bytes);

    const blockEntityCount = (): Promise<number> =>
      page.evaluate(() => (window.__voxwright as Vox).volume().blockEntityCount);
    const exportAs = async (format: string, ext: string): Promise<Uint8Array> => {
      const name = `chests-edited${ext}`;
      await rm(join(downloads, name), { force: true });
      await page.select('[data-testid="format"]', format);
      await page.click('[data-testid="convert"]');
      const deadline = Date.now() + 30000;
      while (!readdirSync(downloads).includes(name) && Date.now() < deadline) await sleep(200);
      ok(readdirSync(downloads).includes(name), t(`exporting as ${ext} writes ${name}`));
      return new Uint8Array(await readFile(join(downloads, name)));
    };
    /** Do all 18 chests of an exported volume hold exactly what was put in them, at the same cells? */
    const sameChests = (v: Volume, origin: Vec): boolean => {
      let good = v.blockEntityCount === 18;
      chestCells.forEach(([x, y, z], n) => {
        const e = v.blockEntityAt(x - origin[0], y - origin[1], z - origin[2]);
        good &&= e !== undefined && e.edition === "java" && nbtEqual(e.nbt, contentsOf(n));
      });
      return good;
    };

    answer = "accept";
    await input.uploadFile(chestFile);
    await page.waitForFunction(() => (window.__voxwright as Vox).volume().blockEntityCount > 0, {
      timeout: 60000,
    });
    await settle();
    ok((await blockEntityCount()) === 18, t("the page holds the 18 chests' contents"));
    ok(
      (await page.evaluate(() => (window.__voxwright as Vox).volume().entities.length)) === 1,
      t("...and the entity"),
    );
    ok(
      (await page.$$eval('[data-testid="loss"] li', (l) => l.length)) === 0,
      t("opening it reports nothing lost"),
    );
    const chestStart = await snapshot();

    // Edit an unrelated block with a real click: turn a block that is not a chest into gold.
    await chooseBlock("minecraft:gold_block");
    await press("b");
    all = await tops();
    const plain = all.find((c) => !c.block.startsWith("minecraft:chest")) as (typeof all)[number];
    await hoverAt(plain.pt);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(150);
    const chestEdited = await snapshot();
    ok(
      key(diff(chestStart, chestEdited)) === key([key(plain.pos)]),
      t(`Replace changed exactly ${key(plain.pos)}, which is not a chest`),
    );
    ok((await blockEntityCount()) === 18, t("the edit left all 18 chests' contents in the page"));

    for (const [format, ext] of [
      ["litematic", ".litematic"],
      ["nbt", ".nbt"],
      ["schem", ".schem"],
      ["schem2", ".schem"],
    ] as const) {
      const bytes = await exportAs(format, ext);
      const r =
        format === "litematic"
          ? await readLitematic(bytes, { keepAir: true })
          : format === "nbt"
            ? await readStructureNbt(bytes, { keepAir: true })
            : await readSchem(bytes, { keepAir: true });
      // .nbt leaves air out, so its corner is that of the non-air blocks; the others write the whole box.
      const lo = (format === "nbt" ? filled.bounds() : filled.placedBounds())?.[0] ?? [0, 0, 0];
      ok(
        sameChests(r.volume, [lo[0], lo[1], lo[2]]),
        t(`the exported ${format} holds all 18 chests with the contents they were opened with`),
      );
      ok(
        r.volume.entities.length === 1 && r.warnings.length === 0,
        t(`...and the entity, and the ${format} reader reports nothing lost`),
      );
      ok(
        r.volume.get(plain.pos[0] - lo[0], plain.pos[1] - lo[1], plain.pos[2] - lo[2]) ===
          "minecraft:gold_block",
        t(`...and the edit itself`),
      );
    }

    // Replacing a chest drops its contents; undo brings them back. (The chests are indoors, so the
    // replacement goes through the page's edit hook, which is the editor's place command.)
    const [cx, cy, cz] = chestCells[0] as Vec;
    await page.evaluate(
      (x, y, z) => (window.__voxwright as Vox).edit(x, y, z, "minecraft:barrel[facing=up]"),
      cx,
      cy,
      cz,
    );
    ok((await blockEntityCount()) === 17, t("replacing a chest drops its contents"));
    await press("z", ["Control"]);
    ok((await blockEntityCount()) === 18, t("undo brings the contents back"));
    {
      const bytes = await exportAs("litematic", ".litematic");
      const lo = filled.placedBounds()?.[0] ?? [0, 0, 0];
      ok(
        sameChests((await readLitematic(bytes, { keepAir: true })).volume, [lo[0], lo[1], lo[2]]),
        t("an export after the undo holds all 18 chests again"),
      );
    }

    // Java contents cannot be written to Bedrock: the page says so.
    await page.select('[data-testid="format"]', "mcstructure");
    await page.click('[data-testid="convert"]');
    await sleep(1500);
    const bedrockLoss = await page.$$eval('[data-testid="loss"] li', (l) =>
      l.map((x) => x.textContent ?? ""),
    );
    ok(
      bedrockLoss.some((l) => /^18 block entities not carried over .*chest x18/.test(l)) &&
        bedrockLoss.some((l) => /^1 entity not carried over .*armor_stand x1/.test(l)),
      t(
        `.mcstructure export lists the 18 chests and the entity as lost (${bedrockLoss.join(" | ")})`,
      ),
    );
    const bedrock = await readMcstructure(await exportAs("mcstructure", ".mcstructure"));
    ok(bedrock.volume.blockEntityCount === 0, t("...and writes none of them"));

    ok(
      errors.length === 0,
      t(`no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`),
    );
  } finally {
    await browser.close();
  }
}
