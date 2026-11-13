<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import type { Snippet } from "svelte";
import { onMount } from "svelte";

export type SnapPoint = "closed" | "peek" | "half" | "full";

let {
  snap = $bindable<SnapPoint>("closed"),
  title = "",
  editor = false,
  onsnapchange,
  onclose,
  peek = 160,
  children,
}: {
  snap?: SnapPoint;
  title?: string;
  /** The sheet holds an editor panel (palette, block state, selection): drawn in the Bedrock Editor style, a sunken header band and the editor's flat 16px type. */
  editor?: boolean;
  onsnapchange?: (snap: SnapPoint) => void;
  onclose?: () => void;
  /** Height in px of the peek snap: a sheet that only holds a few controls can ask for more than the default. */
  peek?: number;
  children?: Snippet;
} = $props();

let isDragging = $state(false);
/** The dialog itself: focus goes here when the sheet opens, so a keyboard or screen reader starts inside it. */
let dialogEl = $state<HTMLElement | null>(null);
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

const peekHeight = $derived(peek);
/** A touch on the handle that moves less than this and lets go within this time is a tap. */
const TAP_SLOP_PX = 6;
const TAP_MAX_MS = 500;
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
  // Move focus into the sheet (its dialog, which is not itself a control) and give it back to the
  // button that opened the sheet when it closes, so Tab continues from where the user was.
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  queueMicrotask(() => dialogEl?.focus({ preventScroll: true }));
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
    if (opener !== null && opener.isConnected) opener.focus({ preventScroll: true });
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

  if (e.type === "pointerup" && Math.abs(delta) < TAP_SLOP_PX && elapsed < TAP_MAX_MS) {
    // A tap, not a drag: the button for what a drag up or down does.
    nextSnap = toggledSnap();
  } else if (velocity > 0.45) {
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

/** The other height a tap on the handle (or Enter on it) asks for: full from anything lower, half from full. */
function toggledSnap(): SnapPoint {
  return snap === "full" ? "half" : "full";
}

function handleClick(e: MouseEvent): void {
  // A touch or a mouse press was already acted on by the pointer handlers; a click with no press
  // before it (the keyboard, a screen reader) has detail 0.
  if (e.detail === 0) setSnap(toggledSnap());
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
    class:ore-editor={editor}
    role="dialog"
    tabindex="-1"
    aria-label={title || "Panel sheet"}
    aria-modal={snap === "full"}
    bind:this={dialogEl}
    style="
      height: {fullHeight}px;
      bottom: {keyboardOffset}px;
      transform: translateY({currentTranslateY}px);
    "
    data-testid="bottom-sheet"
  >
    <!-- Drag handle: a drag moves the sheet between its heights, a tap (or Enter) switches between half and full. -->
    <button
      type="button"
      class="sheet-handle-zone"
      aria-label={snap === "full" ? "Make the sheet half height" : "Make the sheet full height"}
      aria-expanded={snap === "full"}
      onclick={handleClick}
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      onpointercancel={handlePointerUp}
      data-testid="bottom-sheet-handle"
    >
      <span class="handle-bar"></span>
    </button>

    <!-- Sheet header: a plain block, not a <header>, which would count as a second banner landmark next to the top bar's. -->
    <div class="sheet-header ore-dialog__header">
      <h2 class="sheet-title ore-dialog__title {editor ? 'ore-type-ui' : 'ore-type-heading'}">{title}</h2>
      <button
        type="button"
        class="sheet-close-btn ore-dialog__icon ore-dialog__icon--close"
        onclick={close}
        aria-label="Close sheet"
        data-testid="bottom-sheet-close"
      >
        ✕
      </button>
    </div>

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
  /* The design's dialog, docked to the bottom: an outlined frame, a surface-panel header (drag handle and
     title), a surface-page body. Colours are tokens from tokens.css; the page loads it. */
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    background: var(--outline);
    z-index: 40;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease;
  }
  .sheet-backdrop.active {
    opacity: 0.7;
    pointer-events: auto;
  }

  .bottom-sheet {
    position: fixed;
    left: 0;
    right: 0;
    z-index: 45;
    box-sizing: border-box;
    background: var(--surface-page);
    color: var(--ink);
    border: 2px solid var(--outline);
    border-bottom: 0;
    border-radius: var(--radius-none);
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

  /* Focus lands on the dialog itself when it opens; it is not a control, so it draws no ring. */
  .bottom-sheet:focus {
    outline: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .sheet-backdrop,
    .bottom-sheet {
      transition: none !important;
    }
  }

  /* The handle sits in the header band: the same surface-panel as the title row beneath it. */
  .sheet-handle-zone {
    width: 100%;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-panel);
    border: 0;
    border-radius: var(--radius-none);
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
  .sheet-handle-zone:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }

  .handle-bar {
    width: 44px;
    height: 4px;
    background: var(--light-400);
    border-radius: var(--radius-none);
  }

  /* .ore-dialog__header gives the centred title and the panel band; the handle above it already
     draws the top edge, so only the divider beneath is kept. */
  .sheet-header {
    flex-shrink: 0;
    box-shadow: inset 0 -2px 0 var(--panel-hi);
  }

  /* An editor sheet: the handle and the title row are the editor's sunken header band, set off from the
     body by the outline line. */
  .bottom-sheet.ore-editor .sheet-handle-zone,
  .bottom-sheet.ore-editor .sheet-header {
    background: var(--surface-sunken);
  }
  .bottom-sheet.ore-editor .sheet-header {
    box-shadow: inset 0 -2px 0 var(--outline);
  }

  /* The dialog's close icon, at the 44 px a finger needs (the design's is 32 px). */
  .sheet-close-btn {
    right: 0;
    width: 44px;
    height: 44px;
    margin-top: -22px;
    font-size: var(--type-heading-size);
    line-height: 1;
    touch-action: manipulation;
  }
  .sheet-close-btn:active {
    background: var(--panel-hi);
  }

  .sheet-content {
    flex: 1 1 auto;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    touch-action: pan-y;
    padding: var(--space-3) var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
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
  :global(.sheet-content [data-testid="palette"] > .ore-pane__header),
  :global(.sheet-content [data-testid="blockstate"] > .ore-pane__header),
  :global(.sheet-content [data-testid="palette"] > h2),
  :global(.sheet-content .palette .current),
  :global(.sheet-content [data-testid="palette"] .current),
  :global(.sheet-content .palette .body > p.hint),
  :global(.sheet-content [data-testid="palette"] .body > p.hint) {
    display: none !important;
  }

  :global(.sheet-content .palette .ore-search) {
    margin-bottom: var(--space-2) !important;
  }

  :global(.sheet-content .palette input[type="search"]),
  :global(.sheet-content [data-testid="palette"] input[type="search"]) {
    min-height: 44px !important;
    margin: 0 !important;
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
    padding: 0 var(--space-3) !important;
    box-sizing: border-box !important;
  }
</style>
