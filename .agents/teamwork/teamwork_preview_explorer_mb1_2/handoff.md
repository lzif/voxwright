# Handoff Report: FEAT-MB1-02 Performance Debug Overlay (?perf=1)

**Task**: Investigation and Design of FEAT-MB1-02 (Performance Debug Overlay `?perf=1`)  
**Investigator**: teamwork_preview_explorer_mb1_2  
**Target Milestone**: MB1

---

## 1. Observation

1. **`WebglRenderer` Declaration and Access in `apps/web/src/routes/+page.svelte`**:
   - At line 46:

     ```typescript
     let renderer: WebglRenderer | null = null;
     ```

     `renderer` is declared as a plain mutable variable without Svelte 5 reactivity (`$state`).
   - At line 596 in `startGpu()`:

     ```typescript
     r.mount(canvas);
     renderer = r;
     ```
   - At line 602 in catch block:

     ```typescript
     renderer = null;
     ```
   - At line 692 in `onMount` cleanup:

     ```typescript
     renderer?.dispose();
     ```
   - Currently, `renderer` is not passed to any child component; `+page.svelte` calls `renderer.stats()` inside `refreshStats()` at line 401:

     ```typescript
     function refreshStats(): void {
       if (renderer) stats = renderer.stats();
     }
     ```

     where `stats` is a reactive rune (`let stats = $state<RendererStats | null>(null);` at line 60), refreshed on an interval (`statsTimer = window.setInterval(refreshStats, 500);` at line 664).

2. **`RendererStats` Interface in `packages/render/src/webgl/renderer.ts`**:
   - Lines 67–89 define `RendererStats`:

     ```typescript
     export interface RendererStats {
       sections: number;
       meshes: number;
       drawCalls: number;
       triangles: number;
       fps: number;
       frameMs: number;
       queued: number;
       inFlight: number;
       meshMs: number[];
       meshingMs: number | null;
       firstFullFrameMs: number | null;
       fallbackBlocks: string[];
       gpu: string;
       atlas: { width: number; height: number; textures: number };
     }
     ```
   - `triangles` (line 71) is a `number` representing total triangles currently submitted to WebGL (`this.gl?.info.render.triangles`).
   - `firstFullFrameMs` (line 83) is a `number | null`, recorded when the first complete frame with all initial section meshes in place has rendered.

3. **Rendering Lifecycle and FPS Model**:
   - In `packages/render/src/webgl/renderer.ts`, the renderer draws on demand via `requestFrame()` (line 647), not in an unconditional continuous game loop.
   - When idle, `renderer.stats().fps` drops toward 0 because no WebGL frames are requested.
   - Requirement for FEAT-MB1-02 specifies calculating rolling FPS via `requestAnimationFrame` on the window. An internal `requestAnimationFrame` loop in `PerfOverlay` accurately measures the browser's display refresh rate (e.g. 60Hz or 120Hz) and captures main-thread frame drops or jank independent of whether WebGL is actively repainting.

4. **Heap Memory Access and Browser Differences**:
   - In Chromium (Desktop and Chrome for Android), `performance.memory` is available and exposes:

     ```typescript
     interface MemoryInfo {
       totalJSHeapSize: number;
       usedJSHeapSize: number;
       jsHeapSizeLimit: number;
     }
     ```
   - In non-Chromium browsers (Firefox, Safari) or restricted contexts, `(performance as any).memory` is `undefined`.
   - In TypeScript, standard DOM lib does not include `performance.memory` on `Performance` without casting or extension.

5. **Screen Density**:
   - `window.devicePixelRatio` is a standard browser global (e.g. `1` on desktop, `2` to `3` on mobile phones).

6. **Component Architecture in `apps/web`**:
   - Built with Svelte 5 (`"svelte": "^5.57.3"` in `apps/web/package.json`).
   - Svelte 5 runes (`$props()`, `$state`, `$derived`, `$effect`) are used across components (e.g. `EditToolbar.svelte`, `BlockPalette.svelte`).
   - Typecheck is verified with `pnpm --filter @voxwright/web typecheck` (0 errors, 0 warnings).

---

## 2. Logic Chain

1. **Reactivity of `renderer`**:
   - Observation 1 shows `renderer` is initialized to `null` synchronously, and set asynchronously after `startGpu()` resolves (line 596).
   - In Svelte 5, if a variable is not declared as a rune (`$state` or `$state.raw`), mutating it (`renderer = r`) does not trigger updates in components that consume it as a prop.
   - `WebglRenderer` is an external Three.js-based class instance containing WebGL state, worker pools, and scenes. It must NOT be wrapped in a reactive proxy.
   - Therefore, line 46 of `apps/web/src/routes/+page.svelte` should be changed to:

     ```typescript
     let renderer = $state.raw<WebglRenderer | null>(null);
     ```
   - When passed to `<PerfOverlay {renderer} />`, any assignment to `renderer` will reactively propagate to `PerfOverlay`.

2. **Zero-Cost Inactivation**:
   - Requirement specifies: "Completely invisible / zero-cost when ?perf=1 is absent."
   - In `PerfOverlay.svelte`:

     ```typescript
     let active = $state(false);
     onMount(() => {
       const params = new URLSearchParams(window.location.search);
       if (params.get("perf") !== "1") return;
       active = true;
       startLoop();
     });
     ```
   - When `?perf=1` is absent:
     - `active` stays `false`.
     - `{#if active}` evaluates to nothing (no DOM nodes).
     - No `requestAnimationFrame` loop is created.
     - No timers or event listeners are registered.
     - The component cost is exactly one query parameter check on mount.

3. **Accurate Rolling FPS without DOM Churn**:
   - An internal `requestAnimationFrame` loop executes every frame when active.
   - Each frame records the current timestamp `now` into a timestamp queue. Timestamps older than 1000 ms (`now - 1000`) are discarded (`frameTimes.shift()`).
   - Rolling FPS is calculated from the time span between the oldest and newest frame in the window:

     ```typescript
     const span = frameTimes[frameTimes.length - 1] - frameTimes[0];
     const fps = Math.round(((frameTimes.length - 1) * 1000) / span);
     ```
   - To prevent rapid DOM updates (60–120 times/sec) which cause layout/reflow churn and unreadable text flickering, displayed reactive metrics (`fps`, `triangles`, `heap`, `dpr`) should update at a throttled interval of 250 ms (4 Hz).

4. **Safe Querying of Metrics**:
   - `triangles` and `firstFullFrameMs`:
     If `renderer` is provided, call `renderer.stats()`. Extract `stats.triangles` (default `0`) and `stats.firstFullFrameMs` (default `null`).
   - `performance.memory`:
     Safely cast `(performance as unknown as { memory?: ... }).memory`. If present and `usedJSHeapSize` is a number, convert bytes to MiB (`bytes / (1024 * 1024)`). If undefined, set to `null` and display `"n/a"`.
   - `devicePixelRatio`:
     Read `window.devicePixelRatio || 1`. Format to 2 decimal places.

5. **Non-Interactive CSS Overlay**:
   - `pointer-events: none` ensures taps, clicks, and multi-touch gestures pass through unobstructed to the canvas and toolbar beneath.
   - `position: fixed` placed at top-right (`top: calc(0.5rem + env(safe-area-inset-top, 0px)); right: calc(0.5rem + env(safe-area-inset-right, 0px));`) avoids colliding with the `voxwright` header on the left and respects mobile camera notches.
   - `z-index: 9999` keeps it above all sheets, panels, and canvases.
   - Styling: Dark translucent background (`rgba(18, 18, 18, 0.88)`), border (`1px solid rgba(255, 255, 255, 0.18)`), monospace font (`ui-monospace, monospace`), high-contrast colors (`#f4f1eb` text with `#4ade80` accent values).

---

## 3. Caveats

1. **`performance.memory` Scope**:
   `performance.memory` only reports the memory of the main JavaScript heap for the page thread. It does not measure GPU VRAM or the memory allocated within Web Workers (e.g. meshing workers). This is a known browser platform boundary and is standard across all web performance tooling.
2. **On-Demand vs Continuous Frames**:
   Because Voxwright renders on demand, `renderer.stats().fps` reflects frames rendered by Three.js in the last second, whereas the overlay's rolling FPS reflects the browser's display refresh / rAF frame rate. Displaying rolling rAF FPS directly measures whether the browser is stuttering or dropping display frames.
3. **No Caveats on Compatibility**:
   The implementation is 100% additive, strictly guarded by `?perf=1`, and has zero impact on desktop or existing mobile functionality.

---

## 4. Conclusion & Implementation Blueprint

### A. New File: `apps/web/src/lib/components/PerfOverlay.svelte`

```svelte
<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import { onDestroy, onMount } from "svelte";
import type { WebglRenderer } from "@voxwright/render/webgl";

interface Props {
  renderer: WebglRenderer | null;
}

let { renderer }: Props = $props();

let active = $state(false);

// Telemetry display state (refreshed at 4 Hz)
let fps = $state(0);
let frameMs = $state(0);
let triangles = $state(0);
let firstFullFrameMs = $state<number | null>(null);
let heapUsedMb = $state<number | null>(null);
let heapTotalMb = $state<number | null>(null);
let dpr = $state(1);

interface ChromeMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

let animId = 0;
let frameTimes: number[] = [];
let lastSampleTime = 0;

function sampleMetrics(): void {
  // 1. Renderer stats
  if (renderer) {
    try {
      const s = renderer.stats();
      triangles = s.triangles;
      firstFullFrameMs = s.firstFullFrameMs;
    } catch {
      // Safe guard during disposal
    }
  } else {
    triangles = 0;
    firstFullFrameMs = null;
  }

  // 2. JS Heap from performance.memory (Chromium-only)
  const mem = (performance as unknown as { memory?: ChromeMemory }).memory;
  if (mem && typeof mem.usedJSHeapSize === "number") {
    heapUsedMb = Math.round((mem.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
    heapTotalMb = Math.round((mem.totalJSHeapSize / (1024 * 1024)) * 10) / 10;
  } else {
    heapUsedMb = null;
    heapTotalMb = null;
  }

  // 3. DPR
  dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
}

function tick(now: number): void {
  frameTimes.push(now);
  while (frameTimes.length > 0 && now - frameTimes[0]! > 1000) {
    frameTimes.shift();
  }

  // Update display values every 250ms
  if (now - lastSampleTime >= 250) {
    lastSampleTime = now;
    if (frameTimes.length >= 2) {
      const span = frameTimes[frameTimes.length - 1]! - frameTimes[0]!;
      fps = Math.round(((frameTimes.length - 1) * 1000) / span);
      frameMs = Math.round((span / (frameTimes.length - 1)) * 10) / 10;
    } else {
      fps = 0;
      frameMs = 0;
    }
    sampleMetrics();
  }

  animId = requestAnimationFrame(tick);
}

onMount(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("perf") !== "1") return;

  active = true;
  sampleMetrics();
  animId = requestAnimationFrame(tick);
});

onDestroy(() => {
  if (animId) cancelAnimationFrame(animId);
});
</script>

{#if active}
  <aside class="perf-overlay" data-testid="perf-overlay" aria-label="Performance telemetry overlay">
    <div class="row">
      <span class="label">FPS:</span>
      <span class="val" data-testid="perf-fps">{fps} <span class="dim">({frameMs}ms)</span></span>
    </div>
    <div class="row">
      <span class="label">Triangles:</span>
      <span class="val" data-testid="perf-triangles">{triangles.toLocaleString()}</span>
    </div>
    <div class="row">
      <span class="label">1st Frame:</span>
      <span class="val" data-testid="perf-first-frame">{firstFullFrameMs !== null ? `${Math.round(firstFullFrameMs)} ms` : "—"}</span>
    </div>
    <div class="row">
      <span class="label">JS Heap:</span>
      <span class="val" data-testid="perf-heap">
        {#if heapUsedMb !== null}
          {heapUsedMb} <span class="dim">/ {heapTotalMb} MB</span>
        {:else}
          <span class="dim">n/a</span>
        {/if}
      </span>
    </div>
    <div class="row">
      <span class="label">DPR:</span>
      <span class="val" data-testid="perf-dpr">{dpr.toFixed(2)}</span>
    </div>
  </aside>
{/if}

<style>
  .perf-overlay {
    position: fixed;
    top: calc(0.5rem + env(safe-area-inset-top, 0px));
    right: calc(0.5rem + env(safe-area-inset-right, 0px));
    z-index: 9999;
    pointer-events: none;
    user-select: none;
    background: rgba(18, 18, 18, 0.88);
    color: #f4f1eb;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 6px;
    padding: 0.45rem 0.65rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    line-height: 1.45;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
    min-width: 140px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 0.8rem;
  }
  .label {
    color: #a8a29e;
  }
  .val {
    color: #4ade80;
    font-weight: 600;
    text-align: right;
  }
  .dim {
    color: #a8a29e;
    font-weight: 400;
  }
</style>
```

---

### B. Integration into `apps/web/src/routes/+page.svelte`

1. **Import `PerfOverlay`**:
   Add to imports in `<script lang="ts">`:

   ```typescript
   import PerfOverlay from "../lib/components/PerfOverlay.svelte";
   ```
2. **Make `renderer` reactive**:
   Change line 46:

   ```typescript
   // Before:
   let renderer: WebglRenderer | null = null;

   // After:
   let renderer = $state.raw<WebglRenderer | null>(null);
   ```
3. **Mount at the root level**:
   Mount right after `<RestoreDialog>` (near line 849):

   ```svelte
   <SiteFooter />

   <RestoreDialog
     {offer}
     busy={offerBusy}
     error={offerError}
     onrestore={() => void restoreSaved()}
     ondiscard={() => void discardSaved()}
   />

   <PerfOverlay {renderer} />
   ```

---

## 5. Verification Method

1. **Type Checking**:

   ```bash
   pnpm --filter @voxwright/web typecheck
   ```

   Must pass with 0 errors and 0 warnings.

2. **Automated Unit / Inactivation Test**:
   Run Vitest test suite:

   ```bash
   pnpm test
   ```

   All existing tests pass without regressions.

3. **Browser E2E / Invalidation Test**:
   - In headless Chromium or via Playwright / Puppeteer:
     - Visit `http://localhost:5173/`:
       Assert `document.querySelector('[data-testid="perf-overlay"]') === null`.
     - Visit `http://localhost:5173/?perf=1`:
       Assert `document.querySelector('[data-testid="perf-overlay"]') !== null`.
       Assert `data-testid="perf-fps"` contains a valid number > 0.
       Assert `data-testid="perf-dpr"` matches `window.devicePixelRatio.toFixed(2)`.
       Assert clicks and touches pass through overlay (`pointer-events: none`).
     - Load fixture `Rafeals_house`:
       Assert `data-testid="perf-triangles"` updates with the triangle count.
       Assert `data-testid="perf-first-frame"` displays non-null ms.
       Assert `data-testid="perf-heap"` displays `X MB / Y MB` in Chromium.

4. **Invalidation Conditions**:
   - Overlay visible without `?perf=1`.
   - `requestAnimationFrame` running when `?perf=1` is absent.
   - Component throwing errors when `performance.memory` is undefined.
   - Pointer events intercepting canvas interactions.
