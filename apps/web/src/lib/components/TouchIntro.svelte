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

<section class="intro" aria-labelledby="intro-title" data-testid="touch-intro">
  <div class="intro-head">
    <h2 id="intro-title" class="intro-title">Quick start</h2>
    <button
      type="button"
      class="intro-close"
      aria-label="Close the quick start"
      onclick={onclose}
      data-testid="touch-intro-close"
    >✕</button>
  </div>
  <ol class="steps">
    {#each INTRO_STEPS as step (step.id)}
      <li class:done={progress[step.id]} data-step={step.id} data-done={progress[step.id]}>
        <span class="tick" aria-hidden="true">{progress[step.id] ? "✓" : ""}</span>
        <span class="step-text"><span class="sr-only">{progress[step.id] ? "Done: " : "To do: "}</span>{step.text}</span>
      </li>
    {/each}
  </ol>
  <p class="count" role="status" data-testid="touch-intro-count">{done} of {INTRO_STEPS.length} done</p>
</section>

<style>
  .intro {
    box-sizing: border-box;
    align-self: stretch;
    pointer-events: auto;
    padding: 2px 4px 8px 14px;
    border-radius: 14px;
    border: 1px solid #c9c3b6;
    background: #fffdf8;
    color: #2b2925;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
    user-select: none;
    -webkit-user-select: none;
  }

  .intro-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .intro-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    text-transform: none;
    letter-spacing: normal;
    color: #2b2925;
  }

  .intro-close {
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: #2b2925;
    font: inherit;
    font-size: 1.1rem;
    cursor: pointer;
    touch-action: manipulation;
  }

  .intro-close:active {
    background: #e2dccf;
  }

  .steps {
    margin: 0;
    padding: 0 10px 0 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .steps li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.9rem;
    line-height: 1.25;
  }

  .tick {
    flex: 0 0 auto;
    box-sizing: border-box;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid #5f594f;
    background: transparent;
    color: #ffffff;
    font-size: 0.85rem;
    font-weight: 700;
    line-height: 18px;
    text-align: center;
  }

  .steps li.done .tick {
    border-color: #2e6930;
    background: #2e6930;
  }

  .steps li.done .step-text {
    color: #5f594f;
    text-decoration: line-through;
  }

  .count {
    margin: 6px 0 0;
    font-size: 0.8rem;
    color: #5f594f;
  }
</style>
