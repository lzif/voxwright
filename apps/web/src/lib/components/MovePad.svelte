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
const arrows: readonly { id: Arrow; text: string; label: string }[] = [
  { id: "away", text: "↑", label: "Move the selection away from the camera" },
  { id: "left", text: "←", label: "Move the selection left" },
  { id: "right", text: "→", label: "Move the selection right" },
  { id: "toward", text: "↓", label: "Move the selection toward the camera" },
  { id: "up", text: "Up", label: "Move the selection up" },
  { id: "down", text: "Down", label: "Move the selection down" },
];

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

<div class="move-pad" role="group" aria-label="Move the selection" data-testid="move-pad">
  {#each arrows as a (a.id)}
    <button
      type="button"
      class="pad-btn {a.id}"
      aria-label={a.label}
      title={a.label}
      data-testid={`move-${a.id}`}
      data-axis={dirs[a.id].axis}
      data-step={dirs[a.id].step}
      onpointerdown={(e) => hold(e, dirs[a.id])}
      onpointerup={release}
      onpointercancel={release}
      onpointerleave={release}
      onclick={(e) => clicked(e, dirs[a.id])}
      oncontextmenu={(e) => e.preventDefault()}
    >{a.text}</button>
  {/each}
  <button
    type="button"
    class="pad-btn big"
    class:on={big}
    aria-pressed={big}
    aria-label="×8: move 8 blocks per step"
    title="Move by 8 blocks per step"
    data-testid="move-big"
    onclick={() => (big = !big)}
  >×8</button>
  <output class="step-size" data-testid="move-step">{size === 1 ? "1 block" : `${size} blocks`} a step</output>
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
    gap: 8px;
    justify-content: center;
    margin: 0.5rem 0 0;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  .pad-btn {
    width: 48px;
    height: 48px;
    min-width: 48px;
    min-height: 48px;
    padding: 0;
    border-radius: 10px;
    border: 0;
    background: #2b2925;
    color: #f4f1eb;
    font: inherit;
    font-size: 1.25rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    /* A press must reach the button whole: no scroll, zoom or long-press menu takes it away. */
    touch-action: none;
  }

  .pad-btn:active {
    background: #504c45;
  }

  .away { grid-area: away; }
  .left { grid-area: left; }
  .right { grid-area: right; }
  .toward { grid-area: toward; }
  .up { grid-area: up; }
  .down { grid-area: down; }
  .big { grid-area: big; font-size: 0.95rem; font-weight: 700; background: #e2dccf; color: #2b2925; }
  .big.on { background: #2b2925; color: #f4f1eb; }

  .up,
  .down {
    font-size: 0.8rem;
    font-weight: 600;
    background: #3d3a34;
  }

  .step-size {
    grid-area: size;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 0.7rem;
    line-height: 1.15;
    color: #5f594f;
  }
</style>
