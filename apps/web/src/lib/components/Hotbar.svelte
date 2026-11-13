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
        class="hot ore-btn ore-btn--secondary {compact ? 'ore-type-label' : 'ore-type-ui'}"
        class:fav={b.favorite}
        aria-pressed={session.block === b.block}
        aria-label={b.block}
        title={b.block}
        onclick={() => session.chooseBlock(b.block)}
        data-testid={compact ? "hotbar-compact-chip" : "hotbar-chip"}
        data-block={b.block}
        data-favorite={b.favorite}
      >{#if b.favorite}<span class="star ore-tag ore-tag--primary {compact ? 'ore-type-caption' : 'ore-type-ui-small'}" aria-hidden="true">★</span>{/if}<span class="hot-name">{shortName(b.block)}</span></button>
    {:else}
      <p class="empty {compact ? 'ore-type-caption' : 'ore-type-ui-small'}" data-testid="hotbar-empty">Blocks you choose or star show up here.</p>
    {/each}
  </div>
{/if}

<style>
  .hotbar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin: 0 0 var(--space-2);
    max-height: 160px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  /* A chip is a secondary button (.ore-btn--secondary); the block in use is the design's selected
     state: green, the band closed, an underline. */
  .hot {
    flex: 0 0 auto;
    min-width: 44px;
    max-width: 100%;
    min-height: 44px;
    padding-left: var(--space-3);
    padding-right: var(--space-3);
    gap: 6px;
    touch-action: manipulation;
  }

  .hotbar .hot.ore-btn[aria-pressed="true"] {
    --bf: var(--green);
    --bh: var(--green-hi);
    --bl: var(--green-lo);
    --bt: var(--ink);
    min-height: 44px;
    padding-bottom: 0;
    box-shadow: inset 2px 2px 0 var(--bh), inset -2px -2px 0 var(--bl);
  }
  .hotbar .hot.ore-btn[aria-pressed="true"]:active {
    margin-top: 0;
  }
  .hot[aria-pressed="true"]::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 0;
    width: 24px;
    height: 2px;
    margin-left: -12px;
    background: var(--ink);
  }

  /* A starred block: the design's primary tag beside the name. The star is the word's stand-in, so
     the marker never carries meaning by its colour alone. */
  .star {
    flex: none;
  }

  .hot-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .empty {
    margin: 0;
    color: var(--ink-muted);
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
    box-sizing: border-box;
    flex-wrap: nowrap;
    margin: 0;
    max-height: none;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    touch-action: pan-x;
    /* Room for the 2 px focus ring, which the scroll box would otherwise cut off. */
    padding: 2px;
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
  }
</style>
