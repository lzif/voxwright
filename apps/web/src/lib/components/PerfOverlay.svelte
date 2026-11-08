<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import type { WebglRenderer } from "@voxwright/render/webgl";
import { onDestroy, onMount } from "svelte";

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
const frameTimes: number[] = [];
let lastSampleTime = 0;

function sampleMetrics(): void {
  // 1. Renderer stats
  if (renderer) {
    try {
      const s = renderer.stats();
      triangles = s.triangles;
      firstFullFrameMs = s.firstFullFrameMs;
    } catch {
      // Safe guard during renderer teardown
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
  while (frameTimes.length > 0 && now - (frameTimes[0] as number) > 1000) {
    frameTimes.shift();
  }

  // Update display values every 250ms (4 Hz)
  if (now - lastSampleTime >= 250) {
    lastSampleTime = now;
    if (frameTimes.length >= 2) {
      const span = (frameTimes[frameTimes.length - 1] as number) - (frameTimes[0] as number);
      fps = span > 0 ? Math.round(((frameTimes.length - 1) * 1000) / span) : 0;
      frameMs = span > 0 ? Math.round((span / (frameTimes.length - 1)) * 10) / 10 : 0;
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
