<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import type { Snippet } from "svelte";
import { onMount } from "svelte";

export type SnapPoint = "closed" | "peek" | "half" | "full";

let {
  snap = $bindable<SnapPoint>("closed"),
  title = "",
  onsnapchange,
  onclose,
  children,
}: {
  snap?: SnapPoint;
  title?: string;
  onsnapchange?: (snap: SnapPoint) => void;
  onclose?: () => void;
  children?: Snippet;
} = $props();

let isDragging = $state(false);
let dragTranslateY = $state<number | null>(null);
let startY = 0;
let startTime = 0;
let currentY = 0;
let initialTranslateY = 0;

let windowHeight = $state(800);
let vvHeight = $state<number | null>(null);
let keyboardOffset = $state(0);

const effectiveHeight = $derived(vvHeight ?? windowHeight);
const isKeyboardOpen = $derived(
  keyboardOffset > 100 || (effectiveHeight > 0 && effectiveHeight < 600),
);
const displaySnap = $derived(isKeyboardOpen && snap !== "closed" ? "full" : snap);

const peekHeight = 160;
const halfHeight = $derived(Math.round(effectiveHeight * 0.52));
const fullHeight = $derived(
  isKeyboardOpen
    ? Math.max(peekHeight, effectiveHeight - 8)
    : Math.max(peekHeight, Math.round(effectiveHeight * 0.88)),
);

function getSnapOffset(point: SnapPoint): number {
  switch (point) {
    case "full":
      return 0;
    case "half":
      return fullHeight - halfHeight;
    case "peek":
      return fullHeight - peekHeight;
    case "closed":
      return fullHeight + 20;
  }
}

const targetOffset = $derived(getSnapOffset(displaySnap));
const currentTranslateY = $derived(dragTranslateY !== null ? dragTranslateY : targetOffset);

function updateViewport(): void {
  if (typeof window === "undefined") return;
  windowHeight = window.innerHeight;
  if (window.visualViewport) {
    const vv = window.visualViewport;
    vvHeight = vv.height;
    keyboardOffset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
  } else {
    vvHeight = window.innerHeight;
    keyboardOffset = 0;
  }
}

onMount(() => {
  updateViewport();
  window.addEventListener("resize", updateViewport);
  window.visualViewport?.addEventListener("resize", updateViewport);
  window.visualViewport?.addEventListener("scroll", updateViewport);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && snap !== "closed") {
      close();
    }
  };
  window.addEventListener("keydown", onKeyDown);

  return () => {
    window.removeEventListener("resize", updateViewport);
    window.visualViewport?.removeEventListener("resize", updateViewport);
    window.visualViewport?.removeEventListener("scroll", updateViewport);
    window.removeEventListener("keydown", onKeyDown);
  };
});

function handlePointerDown(e: PointerEvent): void {
  const target = e.currentTarget as HTMLElement | null;
  target?.setPointerCapture(e.pointerId);
  isDragging = true;
  startY = e.clientY;
  currentY = e.clientY;
  startTime = performance.now();
  initialTranslateY = getSnapOffset(snap);
  dragTranslateY = initialTranslateY;
}

function handlePointerMove(e: PointerEvent): void {
  if (!isDragging) return;
  currentY = e.clientY;
  const delta = currentY - startY;
  const next = initialTranslateY + delta;
  // Clamp between 0 (full) and fullHeight + 20 (closed)
  dragTranslateY = Math.max(0, Math.min(fullHeight + 20, next));
}

function handlePointerUp(e: PointerEvent): void {
  if (!isDragging) return;
  const target = e.currentTarget as HTMLElement | null;
  try {
    target?.releasePointerCapture(e.pointerId);
  } catch {}
  isDragging = false;

  const delta = currentY - startY;
  const elapsed = Math.max(1, performance.now() - startTime);
  const velocity = delta / elapsed; // px/ms (+ = downward, - = upward)

  let nextSnap: SnapPoint = snap;

  if (velocity > 0.45) {
    // Fling down
    if (snap === "full") nextSnap = "half";
    else if (snap === "half") nextSnap = "peek";
    else nextSnap = "closed";
  } else if (velocity < -0.45) {
    // Fling up
    if (snap === "closed") nextSnap = "peek";
    else if (snap === "peek") nextSnap = "half";
    else nextSnap = "full";
  } else if (dragTranslateY !== null) {
    // Nearest snap point
    const cur = dragTranslateY;
    const offFull = getSnapOffset("full");
    const offHalf = getSnapOffset("half");
    const offPeek = getSnapOffset("peek");
    const offClosed = getSnapOffset("closed");

    const snaps: Array<{ snap: SnapPoint; dist: number }> = [
      { snap: "full", dist: Math.abs(cur - offFull) },
      { snap: "half", dist: Math.abs(cur - offHalf) },
      { snap: "peek", dist: Math.abs(cur - offPeek) },
      { snap: "closed", dist: Math.abs(cur - offClosed) },
    ];
    snaps.sort((a, b) => a.dist - b.dist);
    nextSnap = snaps[0]!.snap;
  }

  dragTranslateY = null;
  setSnap(nextSnap);
}

function setSnap(next: SnapPoint): void {
  if (snap !== next) {
    snap = next;
    onsnapchange?.(next);
    if (next === "closed") {
      onclose?.();
    }
  }
}

function close(): void {
  setSnap("closed");
}

function handleBackdropClick(): void {
  if (snap === "half" || snap === "full") {
    close();
  }
}
</script>

{#if snap !== "closed" || dragTranslateY !== null}
  <!-- Backdrop for half and full states -->
  <div
    class="sheet-backdrop"
    class:active={snap === "half" || snap === "full"}
    onclick={handleBackdropClick}
    role="presentation"
    data-testid="bottom-sheet-backdrop"
  ></div>

  <!-- Sheet Container -->
  <div
    class="bottom-sheet"
    class:dragging={isDragging}
    role="dialog"
    aria-label={title || "Panel sheet"}
    aria-modal={snap === "full"}
    style="
      height: {fullHeight}px;
      bottom: {keyboardOffset}px;
      transform: translateY({currentTranslateY}px);
    "
    data-testid="bottom-sheet"
  >
    <!-- Drag Handle Bar -->
    <button
      type="button"
      class="sheet-handle-zone"
      aria-label="Drag sheet handle"
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      onpointercancel={handlePointerUp}
      data-testid="bottom-sheet-handle"
    >
      <span class="handle-bar"></span>
    </button>

    <!-- Sheet Header -->
    <header class="sheet-header">
      <h2 class="sheet-title">{title}</h2>
      <button
        type="button"
        class="sheet-close-btn"
        onclick={close}
        aria-label="Close sheet"
        data-testid="bottom-sheet-close"
      >
        ✕
      </button>
    </header>

    <!-- Sheet Scrollable Content Area -->
    <!-- The sheet is as tall as its full snap and moved down for the lower ones, so the part below the
         screen is padding too: the last controls can then be scrolled up into sight. -->
    <div
      class="sheet-content"
      style="padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px) + {targetOffset}px)"
      data-testid="bottom-sheet-content"
    >
      {#if children}
        {@render children()}
      {/if}
    </div>
  </div>
{/if}

<style>
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 40;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease;
  }
  .sheet-backdrop.active {
    opacity: 1;
    pointer-events: auto;
  }

  .bottom-sheet {
    position: fixed;
    left: 0;
    right: 0;
    z-index: 45;
    background: #fffdf8;
    color: #2b2925;
    border-top: 1px solid #c9c3b6;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.22);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    touch-action: none;
    transition: transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1);
    will-change: transform;
  }

  .bottom-sheet.dragging {
    transition: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .sheet-backdrop,
    .bottom-sheet {
      transition: none !important;
    }
  }

  .sheet-handle-zone {
    width: 100%;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 0;
    padding: 0;
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    flex-shrink: 0;
  }
  .sheet-handle-zone:active {
    cursor: grabbing;
  }

  .handle-bar {
    width: 44px;
    height: 5px;
    background: #a8a194;
    border-radius: 3px;
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px 8px;
    border-bottom: 1px solid #e2dccf;
    flex-shrink: 0;
  }

  .sheet-title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: #2b2925;
  }

  .sheet-close-btn {
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 0;
    border-radius: 50%;
    color: #2b2925;
    font-size: 1.15rem;
    cursor: pointer;
    touch-action: manipulation;
  }
  .sheet-close-btn:active {
    background: #e2dccf;
  }

  .sheet-content {
    flex: 1 1 auto;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    touch-action: pan-y;
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  }

  /* Host styling for embedded panels */
  :global(.sheet-content .palette),
  :global(.sheet-content [data-testid="palette"]),
  :global(.sheet-content .blockstate),
  :global(.sheet-content [data-testid="blockstate"]),
  :global(.sheet-content .coords-panel),
  :global(.sheet-content [data-testid="coords-panel"]) {
    border: 0 !important;
    padding: 0 !important;
    background: transparent !important;
  }

  :global(.sheet-content .palette > h2),
  :global(.sheet-content [data-testid="palette"] > h2),
  :global(.sheet-content .palette .current),
  :global(.sheet-content [data-testid="palette"] .current),
  :global(.sheet-content .palette > p.hint),
  :global(.sheet-content [data-testid="palette"] > p.hint) {
    display: none !important;
  }

  :global(.sheet-content .palette input[type="search"]),
  :global(.sheet-content [data-testid="palette"] input[type="search"]) {
    min-height: 44px !important;
    margin-bottom: 8px !important;
    font-size: 1rem !important;
  }

  :global(.sheet-content .palette .list),
  :global(.sheet-content [data-testid="palette"] .list) {
    max-height: 220px !important;
  }

  :global(.sheet-content .palette .entry),
  :global(.sheet-content [data-testid="palette"] .entry) {
    min-height: 48px !important;
    display: flex !important;
    align-items: center !important;
    padding: 0 12px !important;
    font-size: 0.95rem !important;
    box-sizing: border-box !important;
  }
</style>
