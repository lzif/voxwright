# Handoff Report: Phone Test Checklist & Documentation (FEAT-MB1-03 & FEAT-MB1-04)

**Agent:** `teamwork_preview_explorer_mb1_3`  
**Milestone:** MB1  
**Target File for Worker:** `docs/phone-test-checklist.md` (draft prepared in `proposed_phone-test-checklist.md`)

---

## 1. Observation

1. **`PROJECT.md` Lines 31-32, 91:**
   - Line 31: `FEAT-MB1-03` | Real-Phone Test Checklist | Markdown guide in `docs/phone-test-checklist.md` for Termux dev-server verification | MB1
   - Line 32: `FEAT-MB1-04` | Baseline Phone Performance Log | Benchmark documentation for Rafeals_house fixture on real hardware | MB1
   - Line 91: MB1 Scope: "Mobile touch E2E test harness (`apps/web/test/touch-e2e.ts`), `?perf=1` telemetry overlay HUD, Termux checklist `docs/phone-test-checklist.md`"

2. **`docs/mobile-editor-plan.md` Lines 179, 181-189, 246-252, 272-274:**
   - Line 179: "On a real phone: Luki runs `vite dev` in Termux and opens it in the phone's browser; each milestone lists a short checklist he can run."
   - Line 187: "Exit criterion: on the phone the existing viewer opens the Rafeals_house fixture and the overlay shows fps and heap; the numbers are written into this plan or a `docs/` note (first real-phone measurement)."
   - Line 250: "Decision 3: Chrome on Android, recent devices, with WebGL2. No iOS. No RAM floor unless MB1's numbers call for one."
   - Line 251: "Decision 4: Largest smooth build on a phone: Open by design: set from MB1's real-phone measurement, then written into MB7."
   - Line 274: "Dependency, not a task: `vite dev` currently fails to load the mesh worker (`server.fs.allow` is missing in `apps/web/vite.config.ts`). Until that is fixed, dev-mode testing on the phone through Termux is blocked..."

3. **`apps/web/vite.config.ts` Lines 66-68:**

   ```typescript
   // Dev server only: the workspace packages (packages/render holds the mesh worker) live outside
   // the app root, so Vite must be allowed to serve them. The build ignores `server`.
   server: { fs: { allow: [searchForWorkspaceRoot(process.cwd())] } },
   ```

   _Direct Observation:_ The `server.fs.allow` dependency noted in `mobile-editor-plan.md` line 274 has already been resolved at line 68.

4. **`apps/web/package.json` Line 9:**

   ```json
   "dev": "vite dev",
   ```

   Running `pnpm --filter @voxwright/web dev --host` executes `vite dev --host`, binding to `0.0.0.0:5173`.

5. **`apps/web/src/routes/+page.svelte` Lines 561-568, 638-646, 703, 709:**
   - Line 562-567: `hasWebgl2()` probes a throwaway canvas context `webgl2`.
   - Line 639-644: `canEdit = fine.matches || !coarse.matches;` (Touch devices operate as viewers in MB1).
   - Line 703: `<p class="engine" data-testid="renderer" data-kind={kind}>{kind === "webgl" ? "GPU renderer" : kind === "cpu" ? "software renderer (no WebGL2)" : ""}</p>`
   - Line 709: `<input type="file" class="sr-only" accept=".nbt,.schem,.litematic,.mcstructure" data-testid="file" ... />`

6. **`packages/core/test/real-fixtures.test.ts` Lines 12-20 & `apps/web/test/e2e.ts` Lines 117-118:**
   - For `Rafeals_house.nbt`: `volume.size` is 762 blocks, bounds `[0, 0, 0]` to `[13, 7, 13]` (14 by 8 by 14 blocks).
   - Line 118: Page status indicator resolves to `"762 blocks"`.

7. **`packages/render/src/webgl/renderer.ts` Lines 511-536:**
   `renderer.stats()` exposes `fps`, `frameMs`, `drawCalls`, `triangles`, `firstFullFrameMs`, and `gpu`.
   In Android Chrome, `performance.memory` provides `usedJSHeapSize` and `totalJSHeapSize`. `window.devicePixelRatio` provides DPR.

8. **Android Termux Sandbox Boundary:**
   On Android, apps running under standard permissions (like Chrome) cannot directly navigate into Termux private directories (`/data/data/com.termux/files/home/`) from the system file picker. Running `termux-setup-storage` and copying test files to `~/storage/shared/Download/` allows Chrome's file picker to open `Rafeals_house.nbt`. Furthermore, Android process management will throttle or suspend Termux when Chrome takes the foreground unless `termux-wake-lock` is engaged.

---

## 2. Logic Chain

1. From **Observation 1 & 2**, the goal of FEAT-MB1-03 & FEAT-MB1-04 is to establish an exact, reproducible manual testing procedure on a real physical Android phone (Chrome + WebGL2) and record baseline performance data for `Rafeals_house` and synthetic builds to resolve Decision 4 for MB7.
2. From **Observation 3 & 4**, running `pnpm --filter @voxwright/web dev --host` serves the application across all network interfaces on port 5173, and `server.fs.allow` is already configured in Vite to allow the mesh worker from `packages/render` without 403 errors.
3. From **Observation 8**, on a physical Android phone running Termux, two distinct friction points exist:
   - Termux process suspension when switching to Chrome (resolved by running `termux-wake-lock`).
   - File picker isolation preventing Chrome from picking `Rafeals_house.nbt` inside Termux home (resolved by running `termux-setup-storage` and `cp fixtures/real/rafeals-house/Rafeals_house.nbt ~/storage/shared/Download/`).
4. Additionally, testers may prefer running the dev server on a local dev workstation (LAN host) over Wi-Fi, so providing both Method A (Termux on-device) and Method B (LAN Wi-Fi host) guarantees frictionless setup regardless of the tester's environment.
5. From **Observation 5 & 6**, opening `Rafeals_house.nbt` in the viewer validates the file loading pipeline, resulting in the expected 14 x 8 x 14 build with 762 blocks, rendering the 3D structure on canvas.
6. From **Observation 5 & 7**, `?perf=1` telemetry overlay HUD (investigated in FEAT-MB1-02) reads rolling FPS, `renderer.stats().triangles`, `renderer.stats().drawCalls`, `performance.memory.usedJSHeapSize`, and `window.devicePixelRatio`.
7. From **Observation 2**, Decision 4 requires establishing whether a phone can sustain 30–60 FPS on builds up to 256x64x256, directly determining if MB7 must clamp DPR dynamically during gestures or adjust history memory caps. Therefore, a structured baseline recording template with hardware specs and build size tiers is required.

---

## 3. Caveats

1. **`?perf=1` Overlay Implementation:** The checklist assumes FEAT-MB1-02 (`PerfOverlay.svelte`) is implemented by its respective worker before or alongside this documentation. If opened before FEAT-MB1-02 is merged, the viewer still works, but telemetry numbers would need to be read via console or Chrome remote debugging.
2. **Device Hardware Variations:** Different Android devices feature varying DPR (e.g. 2.625 vs 3.0), refresh rates (60Hz, 90Hz, 120Hz), and GPU drivers (Adreno vs Mali). The template explicitly captures these variables to ensure apples-to-apples baseline comparisons.
3. **Texture Pack:** Game assets (`pack.json`) are git-ignored. The checklist notes that the viewer functions completely with flat-color fallback if no pack is installed, which is standard for running unit and baseline tests.

---

## 4. Conclusion

The specification and complete markdown draft for `docs/phone-test-checklist.md` have been designed and written to:
`/home/antigravity/lzif/voxwright/.agents/teamwork/teamwork_preview_explorer_mb1_3/proposed_phone-test-checklist.md`

### Action for Worker:

Copy or write the draft to:
`/home/antigravity/lzif/voxwright/docs/phone-test-checklist.md`

### Summary of Document Content:

1. **Dual Environment Setup Instructions:**
   - **Method A (Termux On-Device):** Package installation (`nodejs`, `git`, `pnpm`), wake lock prevention (`termux-wake-lock`), shared storage fixture copy (`termux-setup-storage`), and dev server command (`pnpm --filter @voxwright/web dev --host`).
   - **Method B (LAN Wi-Fi Host):** Host dev server, IP discovery commands across Linux/macOS/Windows, firewall settings, and phone browser connection.
2. **WebGL2 & Browser Verification:** Clear steps to verify Chrome on Android WebGL2 status via `chrome://gpu` and the on-page `p.engine[data-testid="renderer"]` badge (`GPU renderer`).
3. **Sequential 11-Point Verification Checklist:** Complete pass/fail manual test flow covering pre-flight, `?perf=1` HUD display, `Rafeals_house.nbt` loading, 1-finger orbit, 2-finger pinch zoom, multi-touch release, edge gesture handling, and metrics observation.
4. **Baseline Telemetry Log & Decision 4 Template (FEAT-MB1-04):**
   - Detailed hardware & environment profile form (SoC, RAM, OS, GPU string, DPR, refresh rate).
   - Multi-tier measurement matrix (`Rafeals_house.nbt`, Synthetic 64x64, Synthetic 128x128, Synthetic 256x256).
   - Decision 4 evaluation guide to provide concrete tuning inputs for MB7 (Dynamic resolution scaling threshold, coarse pointer history cap `DEFAULT_HISTORY_BYTES`, and worker pool concurrency clamp).

---

## 5. Verification Method

To independently verify this work:
1. **Document Verification:**
   Inspect `/home/antigravity/lzif/voxwright/.agents/teamwork/teamwork_preview_explorer_mb1_3/proposed_phone-test-checklist.md` to ensure all 5 required elements from the dispatch are fully addressed.
2. **Shell Command Verification:**
   Verify that `pnpm --filter @voxwright/web dev --help` or `pnpm --filter @voxwright/web dev --host` executes cleanly in the repository.

   ```sh
   pnpm --filter @voxwright/web dev --help
   ```
3. **Fixture Path Verification:**
   Confirm that fixture files referenced in the checklist exist at their exact paths:

   ```sh
   ls -la fixtures/real/rafeals-house/Rafeals_house.nbt
   ls -la fixtures/real/rafeals-house/Rafeals_house.litematic
   ```
4. **Invalidation Conditions:**
   - If `apps/web/vite.config.ts` drops or alters `server.fs.allow`, Termux dev server would fail with 403 on worker imports.
   - If `apps/web/src/routes/+page.svelte` alters the file input selector or status message formatting.
