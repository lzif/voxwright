<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import { onDestroy } from "svelte";
import type { EditSession } from "../editor-session.svelte.ts";
import { type AxisStep, HoldRepeater, padDirections } from "../nudge.ts";

// The touch replacement for the typed offsets of "Move": the four screen-relative arrows plus Up and
// Down, as on the nudge pad, but they move the selected blocks themselves. Every step is one
// `session.move`, so one undo step; holding a button repeats it (and every repeat is a step too).

let {
  session,
  azimuth = 45,
}: {
  session: EditSession;
  /** The camera's azimuth in degrees: it decides which world axis each arrow moves along. */
  azimuth?: number;
} = $props();

/** The length of one step with "×8" on. */
const BIG_STEP = 8;

let big = $state(false);
const size = $derived(big ? BIG_STEP : 1);
const dirs = $derived(padDirections(azimuth));

type Arrow = "away" | "left" | "right" | "toward" | "up" | "down";
const arrow: Record<Arrow, { text: string; label: string }> = {
  away: { text: "↑", label: "Move the selection away from the camera" },
  left: { text: "←", label: "Move the selection left" },
  right: { text: "→", label: "Move the selection right" },
  toward: { text: "↓", label: "Move the selection toward the camera" },
  up: { text: "Up", label: "Move the selection up" },
  down: { text: "Down", label: "Move the selection down" },
};

// A press acts at once, again after a moment, then steadily. A step that changed nothing (no
// selection, a move that failed) ends the repeat.
const repeater = new HoldRepeater();
const step = (to: AxisStep): boolean => {
  const delta: [number, number, number] = [0, 0, 0];
  delta[to.axis] = to.step * size;
  const before = session.revision;
  session.move(delta);
  return session.revision !== before;
};
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

onDestroy(() => repeater.stop());
</script>

{#snippet arrowButton(id: Arrow)}
  {@const a = arrow[id]}
  <button
    type="button"
    class="pad-btn ore-btn ore-btn--secondary ore-btn--touch {id} {id === 'up' || id === 'down' ? 'ore-type-ui-small' : 'ore-type-title'}"
    aria-label={a.label}
    title={a.label}
    data-testid={`move-${id}`}
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

<!-- The buttons are in reading order (row by row, as the grid shows them), so Tab goes the way the eye does. -->
<div class="move-pad" role="group" aria-label="Move the selection" data-testid="move-pad">
  <button
    type="button"
    class="pad-btn big ore-seg ore-btn--touch ore-type-ui"
    class:on={big}
    aria-pressed={big}
    aria-label="×8: move 8 blocks per step"
    title="Move by 8 blocks per step"
    data-testid="move-big"
    onclick={() => (big = !big)}
  >×8</button>
  {@render arrowButton("away")}
  {@render arrowButton("up")}
  {@render arrowButton("left")}
  <output class="step-size ore-type-ui-small" data-testid="move-step">{size === 1 ? "1 block" : `${size} blocks`} a step</output>
  {@render arrowButton("right")}
  {@render arrowButton("toward")}
  {@render arrowButton("down")}
</div>

<style>
  .move-pad {
    display: grid;
    grid-template-columns: repeat(3, 48px);
    grid-template-rows: repeat(3, 48px);
    grid-template-areas:
      "big away up"
      "left size right"
      ". toward down";
    gap: var(--space-2);
    justify-content: center;
    margin: var(--space-2) 0 0;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  /* Secondary buttons (.ore-btn--secondary); ×8 is a toggle segment (.ore-seg). The grid cell is
     48 px and the button fills it, so the pressed face lowers inside the cell. */
  .move-pad .pad-btn {
    min-width: 48px;
    min-height: 48px;
    padding: 0;
    /* A press must reach the button whole: no scroll, zoom or long-press menu takes it away. */
    touch-action: none;
  }

  /* An arrow is a glyph at the title size (the editor's own 16px type would shrink it); Up and Down are words. */
  .move-pad .pad-btn.away,
  .move-pad .pad-btn.left,
  .move-pad .pad-btn.right,
  .move-pad .pad-btn.toward {
    font-size: var(--type-title-size);
    line-height: 1;
  }
  .move-pad .pad-btn.up,
  .move-pad .pad-btn.down {
    font-size: var(--type-ui-small-size);
    line-height: var(--type-ui-small-line);
  }
  .move-pad .pad-btn:active:not(:disabled) {
    min-height: 48px;
    margin-top: 0;
  }

  .away { grid-area: away; }
  .left { grid-area: left; }
  .right { grid-area: right; }
  .toward { grid-area: toward; }
  .up { grid-area: up; }
  .down { grid-area: down; }
  .big { grid-area: big; }

  /* ×8 on (aria-pressed) is the design's selected segment: green, the band closed, an underline.
     .ore-seg reads aria-checked, which this button does not carry, so the variables are set here. */
  .move-pad .pad-btn.ore-seg[aria-pressed="true"] {
    --bf: var(--green);
    --bh: var(--green-hi);
    --bl: var(--green-lo);
    --bt: var(--ink);
    min-height: 48px;
    padding-bottom: 0;
    box-shadow: inset 2px 2px 0 var(--bh), inset -2px -2px 0 var(--bl);
  }
  .big[aria-pressed="true"]::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 0;
    width: 32px;
    height: 2px;
    margin-left: -16px;
    background: var(--ink);
  }

  .step-size {
    grid-area: size;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--ink-muted);
  }
</style>
