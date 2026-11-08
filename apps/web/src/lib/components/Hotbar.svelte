<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import type { EditSession } from "../editor-session.svelte.ts";
import { hotbarBlocks, shortName } from "../hotbar.ts";

// The blocks the user starred, then the ones chosen last: a chip each, ready to tap. Text only
// (decision 9: block icons come later). A tap makes the block the chosen one and closes nothing.
let {
  session,
  favorites,
  recents,
  compact = false,
  leftHanded = false,
}: {
  session: EditSession;
  favorites: readonly string[];
  recents: readonly string[];
  /** The one-row version over the picture, above the readout line. */
  compact?: boolean;
  leftHanded?: boolean;
} = $props();

const blocks = $derived(hotbarBlocks(favorites, recents));
</script>

{#if blocks.length > 0 || !compact}
  <div
    class="hotbar"
    class:compact
    class:left-handed={leftHanded}
    role="group"
    aria-label={compact ? "Quick blocks: favourites and recent" : "Favourite and recent blocks"}
    data-testid={compact ? "hotbar-compact" : "hotbar"}
  >
    {#each blocks as b (b.block)}
      <button
        type="button"
        class="hot"
        class:fav={b.favorite}
        aria-pressed={session.block === b.block}
        aria-label={b.block}
        title={b.block}
        onclick={() => session.chooseBlock(b.block)}
        data-testid={compact ? "hotbar-compact-chip" : "hotbar-chip"}
        data-block={b.block}
        data-favorite={b.favorite}
      >{#if b.favorite}<span class="star" aria-hidden="true">★</span>{/if}<span class="hot-name">{shortName(b.block)}</span></button>
    {:else}
      <p class="empty" data-testid="hotbar-empty">Blocks you choose or star show up here.</p>
    {/each}
  </div>
{/if}

<style>
  .hotbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 0 8px;
    max-height: 160px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .hot {
    flex: 0 0 auto;
    min-width: 44px;
    max-width: 100%;
    min-height: 44px;
    padding: 0 12px;
    border: 0;
    border-radius: 8px;
    background: #e2dccf;
    color: #2b2925;
    font: inherit;
    font-size: 0.9rem;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    touch-action: manipulation;
  }

  .hot[aria-pressed="true"] {
    background: #2b2925;
    color: #f4f1eb;
    font-weight: 600;
  }

  .star {
    color: #7a4f00;
  }

  .hot[aria-pressed="true"] .star {
    color: #ffd666;
  }

  .hot-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .empty {
    margin: 0;
    color: #5f594f;
    font-size: 0.8rem;
  }

  /* Over the picture: one row, left of the thumb cluster, scrolling sideways inside itself. */
  .compact {
    position: fixed;
    z-index: 33;
    left: calc(12px + env(safe-area-inset-left, 0px));
    /* Above the readout line when it grows to hold the "Edit state" chip (44 px) and the toolbar (56 px). */
    bottom: calc(108px + env(safe-area-inset-bottom, 0px));
    /* The thumb cluster is 104 px wide with 12 px beside it and 8 px between. */
    max-width: calc(100vw - 12px - 12px - 104px - 8px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px));
    flex-wrap: nowrap;
    margin: 0;
    max-height: none;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    touch-action: pan-x;
    padding: 0;
    user-select: none;
    -webkit-user-select: none;
  }

  .compact::-webkit-scrollbar {
    display: none;
  }

  .compact.left-handed {
    left: auto;
    right: calc(12px + env(safe-area-inset-right, 0px));
  }

  .compact .hot {
    max-width: 11rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
    background: #2b2925;
    color: #f4f1eb;
    border: 1px solid rgba(255, 255, 255, 0.16);
  }

  .compact .hot[aria-pressed="true"] {
    background: #f4f1eb;
    color: #24221f;
  }

  .compact .star {
    color: #ffd666;
  }

  .compact .hot[aria-pressed="true"] .star {
    color: #7a4f00;
  }
</style>
