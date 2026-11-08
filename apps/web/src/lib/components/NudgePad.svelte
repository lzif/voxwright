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
const arrows: readonly { id: Arrow; text: string; label: string }[] = [
  { id: "away", text: "↑", label: "Move away from the camera" },
  { id: "left", text: "←", label: "Move left" },
  { id: "right", text: "→", label: "Move right" },
  { id: "toward", text: "↓", label: "Move toward the camera" },
  { id: "up", text: "Up", label: "Move up" },
  { id: "down", text: "Down", label: "Move down" },
];

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

{#if pending}
  <div
    class="nudge-pad"
    class:left-handed={leftHanded}
    role="group"
    aria-label="Nudge pad: move the armed cell"
    data-testid="nudge-pad"
  >
    {#each arrows as a (a.id)}
      <button
        type="button"
        class="pad-btn {a.id}"
        aria-label={a.label}
        title={a.label}
        data-testid={`nudge-${a.id}`}
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

    {#if twoPoint}
      {@const other = twoPoint.active === "a" ? "b" : "a"}
      <button
        type="button"
        class="pad-btn corner"
        aria-label={`Corner ${twoPoint.active.toUpperCase()} is active. Switch to corner ${other.toUpperCase()}`}
        title="Switch corner"
        data-testid="nudge-corner"
        data-corner={twoPoint.active}
        onclick={() => session.setActiveCorner(other)}
      >
        <span class="letter" class:on={twoPoint.active === "a"}>A</span>
        <span class="letter" class:on={twoPoint.active === "b"}>B</span>
      </button>
    {/if}

    {#if pending.kind === "rectangle"}
      <button
        type="button"
        class="pad-btn hollow"
        class:on={session.hollow}
        aria-pressed={session.hollow}
        title="Draw only the frame of the rectangle"
        data-testid="nudge-hollow"
        onclick={() => (session.hollow = !session.hollow)}
      >Hollow</button>
    {/if}
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
      ". toward down";
    gap: 8px;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  .nudge-pad.left-handed {
    right: auto;
    left: calc(12px + 104px + 8px + env(safe-area-inset-left, 0px));
  }

  .pad-btn {
    width: 48px;
    height: 48px;
    min-width: 48px;
    min-height: 48px;
    padding: 0;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: #2b2925;
    color: #f4f1eb;
    font: inherit;
    font-size: 1.25rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
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
  .corner { grid-area: corner; gap: 2px; font-size: 1rem; font-weight: 700; }
  .hollow { grid-area: hollow; font-size: 0.7rem; font-weight: 600; }

  .up,
  .down {
    font-size: 0.8rem;
    font-weight: 600;
    background: #3d3a34;
  }

  .letter {
    padding: 2px 5px;
    border-radius: 6px;
    color: #a8a194;
  }

  .letter.on {
    background: #f4f1eb;
    color: #24221f;
  }

  .hollow.on {
    background: #f4f1eb;
    color: #24221f;
  }
</style>
