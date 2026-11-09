<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import { INTRO_STEPS, type IntroProgress, introDoneCount } from "../walkthrough.ts";

// The first-run walkthrough: three steps that tick themselves as the user does them. A small card
// under the top bar with no backdrop, so the picture stays usable, and clear of the controls it
// points at (the tool buttons and Undo are at the bottom, the Menu button is in the top bar).

let {
  progress,
  onclose,
}: {
  progress: IntroProgress;
  onclose: () => void;
} = $props();

const done = $derived(introDoneCount(progress));
</script>

<section class="intro ore-panel" aria-labelledby="intro-title" data-testid="touch-intro">
  <div class="intro-head">
    <h2 id="intro-title" class="intro-title ore-panel__header ore-type-heading">Quick start</h2>
    <button
      type="button"
      class="intro-close ore-dialog__icon ore-dialog__icon--close"
      aria-label="Close the quick start"
      onclick={onclose}
      data-testid="touch-intro-close"
    >✕</button>
  </div>
  <ol class="steps">
    {#each INTRO_STEPS as step (step.id)}
      <li class:done={progress[step.id]} data-step={step.id} data-done={progress[step.id]}>
        <span class="tick ore-box" aria-hidden="true">{progress[step.id] ? "✓" : ""}</span>
        <span class="step-text ore-type-label"><span class="sr-only">{progress[step.id] ? "Done: " : "To do: "}</span>{step.text}</span>
      </li>
    {/each}
  </ol>
  <p class="count ore-type-caption" role="status" data-testid="touch-intro-count">{done} of {INTRO_STEPS.length} done</p>
</section>

<style>
  /* The design's panel (.ore-panel: surface-panel tile, no outline). It floats over the picture with no
     backdrop, so the picture stays usable. The close button is the dialog's close icon at 44 px. */
  .intro {
    align-self: stretch;
    pointer-events: auto;
    padding: var(--space-1) var(--space-1) var(--space-3) var(--space-4);
    user-select: none;
    -webkit-user-select: none;
  }

  .intro-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .intro-title {
    margin: 0;
    color: var(--ink);
  }

  .intro-close {
    position: static;
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    margin: 0;
    font-size: var(--type-heading-size);
    line-height: 1;
    touch-action: manipulation;
  }

  .intro-close:active {
    background: var(--panel-hi);
  }

  .steps {
    margin: 0;
    padding: 0 var(--space-3) 0 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .steps li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  /* A checkbox's look (.ore-box), not a control: the tick is a text glyph that shows once the step is
     done, in the checked box's green. The words say Done or To do too (the .sr-only prefix). */
  .tick {
    font-size: var(--type-label-size);
    font-weight: 700;
    line-height: 1;
  }

  .steps li.done .tick {
    background: var(--green);
    color: var(--ink);
    box-shadow: inset 2px 2px 0 var(--green-hi), inset -2px -2px 0 var(--green-lo);
  }

  .steps li.done .step-text {
    color: var(--ink-muted);
    text-decoration: line-through;
  }

  .count {
    margin: var(--space-2) 0 0;
    color: var(--ink-muted);
  }
</style>
