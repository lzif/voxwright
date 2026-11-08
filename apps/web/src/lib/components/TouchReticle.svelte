<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import type { EditSession } from "../editor-session.svelte.ts";

let { session }: { session: EditSession } = $props();
const reticle = $derived(session.reticle);
</script>

{#if reticle && reticle.active}
  <div class="reticle-container" data-testid="reticle-overlay" aria-hidden="true">
    <svg
      class="touch-reticle"
      data-testid="reticle-indicator"
    >
      <!-- Connecting stem line from finger contact to reticle target -->
      <line
        x1={reticle.touchX}
        y1={reticle.touchY - 14}
        x2={reticle.reticleX}
        y2={reticle.reticleY + 12}
        class="reticle-stem"
      />
      <!-- Touch contact circle at finger -->
      <circle
        cx={reticle.touchX}
        cy={reticle.touchY}
        r="14"
        class="reticle-contact"
      />
      <!-- Target reticle ring at clientY - 64 -->
      <circle
        cx={reticle.reticleX}
        cy={reticle.reticleY}
        r="12"
        class="reticle-target"
        class:has-hit={reticle.hit !== null}
      />
      <!-- Cardinal ticks on target reticle -->
      <line
        x1={reticle.reticleX - 16}
        y1={reticle.reticleY}
        x2={reticle.reticleX - 8}
        y2={reticle.reticleY}
        class="reticle-tick"
      />
      <line
        x1={reticle.reticleX + 8}
        y1={reticle.reticleY}
        x2={reticle.reticleX + 16}
        y2={reticle.reticleY}
        class="reticle-tick"
      />
      <line
        x1={reticle.reticleX}
        y1={reticle.reticleY - 16}
        x2={reticle.reticleX}
        y2={reticle.reticleY - 8}
        class="reticle-tick"
      />
      <line
        x1={reticle.reticleX}
        y1={reticle.reticleY + 8}
        x2={reticle.reticleX}
        y2={reticle.reticleY + 16}
        class="reticle-tick"
      />
      <!-- Center dot -->
      <circle
        cx={reticle.reticleX}
        cy={reticle.reticleY}
        r="2"
        class="reticle-dot"
      />
    </svg>
  </div>
{/if}

<style>
  .reticle-container {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 45;
  }
  .touch-reticle {
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .reticle-stem {
    stroke: #f4f1eb;
    stroke-width: 1.5;
    stroke-dasharray: 3 3;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.7));
  }
  .reticle-contact {
    fill: rgba(244, 241, 235, 0.25);
    stroke: rgba(244, 241, 235, 0.6);
    stroke-width: 1.5;
  }
  .reticle-target {
    fill: none;
    stroke: #f4f1eb;
    stroke-width: 2;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.8));
    transition: stroke 0.1s ease;
  }
  .reticle-target.has-hit {
    stroke: #4dedd5;
  }
  .reticle-tick {
    stroke: #f4f1eb;
    stroke-width: 1.5;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.7));
  }
  .reticle-dot {
    fill: #f4f1eb;
  }
</style>
