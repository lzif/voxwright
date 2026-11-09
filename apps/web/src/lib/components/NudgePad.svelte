<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import { onDestroy } from "svelte";
import type { EditSession } from "../editor-session.svelte.ts";
import { type AxisStep, HoldRepeater, padDirections } from "../nudge.ts";
import { isTwoPoint } from "../pending.ts";

let {
  session,
  leftHanded = false,
  azimuth,
}: {
  session: EditSession;
  leftHanded?: boolean;
  /** The camera's azimuth in degrees: it decides which world axis each arrow moves along. */
  azimuth: number;
} = $props();

const pending = $derived(session.pending);
const twoPoint = $derived(pending !== null && isTwoPoint(pending) ? pending : null);
const dirs = $derived(padDirections(azimuth));

type Arrow = "away" | "left" | "right" | "toward" | "up" | "down";
const arrow: Record<Arrow, { text: string; label: string }> = {
  away: { text: "↑", label: "Move away from the camera" },
  left: { text: "←", label: "Move left" },
  right: { text: "→", label: "Move right" },
  toward: { text: "↓", label: "Move toward the camera" },
  up: { text: "Up", label: "Move up" },
  down: { text: "Down", label: "Move down" },
};

// A held button acts at once, again after a moment, then steadily; a refused step ends the repeat.
const repeater = new HoldRepeater();
const step = (to: AxisStep): boolean => session.nudge(to.axis, to.step);
const hold = (e: PointerEvent, to: AxisStep): void => {
  e.preventDefault();
  repeater.start(() => step(to));
};
const release = (): void => repeater.stop();
// A click from the keyboard or a screen reader has no pointer press before it (detail 0); a click that
// follows a press was already acted on.
const clicked = (e: MouseEvent, to: AxisStep): void => {
  if (e.detail === 0) step(to);
};

$effect(() => {
  if (pending === null) repeater.stop();
});
onDestroy(() => repeater.stop());
</script>

{#snippet arrowButton(id: Arrow)}
  {@const a = arrow[id]}
  <button
    type="button"
    class="pad-btn ore-btn ore-btn--secondary {id} {id === 'up' || id === 'down' ? 'ore-type-caption' : 'ore-type-title'}"
    aria-label={a.label}
    title={a.label}
    data-testid={`nudge-${id}`}
    data-axis={dirs[id].axis}
    data-step={dirs[id].step}
    onpointerdown={(e) => hold(e, dirs[id])}
    onpointerup={release}
    onpointercancel={release}
    onpointerleave={release}
    onclick={(e) => clicked(e, dirs[id])}
    oncontextmenu={(e) => e.preventDefault()}
  >{a.text}</button>
{/snippet}

{#if pending}
  <!-- The buttons are in reading order (row by row, as the grid shows them), so Tab goes the way the eye does. -->
  <div
    class="nudge-pad"
    class:left-handed={leftHanded}
    role="group"
    aria-label="Nudge pad: move the armed cell"
    data-testid="nudge-pad"
  >
    {#if pending.kind === "rectangle"}
      <button
        type="button"
        class="pad-btn hollow ore-seg ore-type-caption"
        class:on={session.hollow}
        aria-pressed={session.hollow}
        title="Draw only the frame of the rectangle"
        data-testid="nudge-hollow"
        onclick={() => (session.hollow = !session.hollow)}
      >Hollow</button>
    {/if}

    {@render arrowButton("away")}
    {@render arrowButton("up")}
    {@render arrowButton("left")}

    {#if twoPoint}
      {@const other = twoPoint.active === "a" ? "b" : "a"}
      <!-- The name starts with the visible letters "A B" (WCAG 2.5.3, label in name). -->
      <button
        type="button"
        class="pad-btn corner ore-seg ore-type-label"
        aria-label={`A B: corner ${twoPoint.active.toUpperCase()} is active. Switch to corner ${other.toUpperCase()}`}
        title="Switch corner"
        data-testid="nudge-corner"
        data-corner={twoPoint.active}
        onclick={() => session.setActiveCorner(other)}
      >
        <span class="letter" class:on={twoPoint.active === "a"}>A</span>
        <span class="letter" class:on={twoPoint.active === "b"}>B</span>
      </button>
    {/if}

    {@render arrowButton("right")}

    <button
      type="button"
      class="pad-btn zoom ore-btn ore-btn--secondary ore-type-caption"
      aria-label="Zoom to the armed cell"
      title="Zoom in here: bring the camera closer to the armed cell"
      data-testid="nudge-zoom"
      onclick={() => session.focusPending()}
    >Zoom</button>

    {@render arrowButton("toward")}
    {@render arrowButton("down")}
  </div>
{/if}

<style>
  /* Three columns of 48 px buttons, left of the thumb cluster (which is 104 px wide), same height. */
  .nudge-pad {
    position: fixed;
    z-index: 35;
    bottom: calc(108px + env(safe-area-inset-bottom, 0px));
    right: calc(12px + 104px + 8px + env(safe-area-inset-right, 0px));
    display: grid;
    grid-template-columns: repeat(3, 48px);
    grid-template-rows: repeat(3, 48px);
    grid-template-areas:
      "hollow away up"
      "left corner right"
      "zoom toward down";
    gap: var(--space-2);
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  .nudge-pad.left-handed {
    right: auto;
    left: calc(12px + 104px + 8px + env(safe-area-inset-left, 0px));
  }

  /* Secondary buttons (.ore-btn--secondary); Hollow and the A/B switch are toggle segments (.ore-seg).
     The grid cell is 48 px and the button fills it, so the pressed face lowers inside the cell. */
  .pad-btn {
    min-width: 48px;
    min-height: 48px;
    padding-left: 0;
    padding-right: 0;
    /* A press must reach the button whole: no scroll, zoom or long-press menu takes it away. */
    touch-action: none;
  }

  .away { grid-area: away; }
  .left { grid-area: left; }
  .right { grid-area: right; }
  .toward { grid-area: toward; }
  .up { grid-area: up; }
  .down { grid-area: down; }
  .corner { grid-area: corner; gap: 2px; }
  .hollow { grid-area: hollow; }
  .zoom { grid-area: zoom; }

  /* Hollow on (aria-pressed) is the design's selected segment: green, the band closed, an underline.
     .ore-seg reads aria-checked, which this button does not carry, so the variables are set here. */
  .nudge-pad .pad-btn.ore-seg[aria-pressed="true"] {
    --bf: var(--green);
    --bh: var(--green-hi);
    --bl: var(--green-lo);
    --bt: var(--ink);
    min-height: 48px;
    padding-bottom: 0;
    box-shadow: inset 2px 2px 0 var(--bh), inset -2px -2px 0 var(--bl);
  }
  .hollow[aria-pressed="true"]::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 0;
    width: 32px;
    height: 2px;
    margin-left: -16px;
    background: var(--ink);
  }

  /* A and B: two small tiles in one segment; the active corner is the green one. */
  .letter {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 22px;
    padding: 0 var(--space-1);
    border: 2px solid transparent;
    color: var(--ink-dark);
  }

  .letter.on {
    border-color: var(--outline);
    background: var(--green);
    color: var(--ink);
    box-shadow: inset 2px 2px 0 var(--green-hi), inset -2px -2px 0 var(--green-lo);
  }
</style>
