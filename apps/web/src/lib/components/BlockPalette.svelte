<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import { canonicalize } from "@voxwright/core";
import { normalizeBlockInput, searchPalette } from "../editing.ts";
import type { EditSession } from "../editor-session.svelte.ts";
import { FAVORITE_LIMIT, favoritesFull, isFavorite, shortName } from "../hotbar.ts";
import Hotbar from "./Hotbar.svelte";

// `touch` adds the hotbar row above the search and a star on every row of the list.
let {
  session,
  touch = false,
  favorites = [],
  recents = [],
  ontogglefavorite,
}: {
  session: EditSession;
  touch?: boolean;
  /** The starred blocks (touch). */
  favorites?: readonly string[];
  /** The blocks chosen last (touch). */
  recents?: readonly string[];
  /** A tap on a row's star (touch). */
  ontogglefavorite?: (block: string) => void;
} = $props();

let query = $state("");
const found = $derived(searchPalette(session.paletteBlocks, query));
const typed = $derived(normalizeBlockInput(query));
const offerTyped = $derived(typed !== "" && !session.paletteBlocks.some((e) => e.block === typed));
const invalid = $derived.by(() => {
  try {
    canonicalize(session.block);
    return "";
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
});

function choose(block: string): void {
  session.chooseBlock(block);
}

// The list is one stop in the Tab order: the chosen entry (or the one last focused) takes the Tab key,
// and the arrow keys, Home and End move between entries.
let roving = $state<string | null>(null);
let listEl: HTMLUListElement;
const keys = $derived([...(offerTyped ? ["\u0000typed"] : []), ...found.shown.map((e) => e.block)]);
const tabbable = $derived(
  roving !== null && keys.includes(roving)
    ? roving
    : keys.includes(session.block)
      ? session.block
      : (keys[0] ?? null),
);

function onListKey(e: KeyboardEvent): void {
  const items = [...listEl.querySelectorAll<HTMLButtonElement>("button.entry")];
  const at = items.indexOf(document.activeElement as HTMLButtonElement);
  if (at < 0) return;
  const next =
    e.key === "ArrowDown"
      ? at + 1
      : e.key === "ArrowUp"
        ? at - 1
        : e.key === "Home"
          ? 0
          : e.key === "End"
            ? items.length - 1
            : -1;
  if (next < 0) return;
  e.preventDefault();
  items[Math.max(0, Math.min(items.length - 1, next))]?.focus();
}

function onSearchKey(e: KeyboardEvent): void {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const first = found.shown[0];
  if (first !== undefined) choose(first.block);
  else if (offerTyped) choose(typed);
}
</script>

<section class="palette" class:ore-panel={!touch} data-testid="palette">
  <h2 class="ore-panel__header ore-type-heading">Block</h2>
  <label class="current ore-field">
    <span class="ore-field__label ore-type-label">Chosen block</span>
    <input
      type="text"
      class="ore-input ore-type-body"
      spellcheck="false"
      autocomplete="off"
      bind:value={session.block}
      class:is-error={invalid !== ""}
      aria-invalid={invalid !== ""}
      data-testid="block-input"
    />
  </label>
  {#if invalid}<p class="hint bad ore-notice ore-notice--important ore-type-caption" class:above-hotbar={touch}>{invalid}</p>{:else}<p class="hint ore-type-caption" class:above-hotbar={touch}>Used by Place, Replace, Line, Rectangle, Fill and Replace-in-selection. Type any block, with properties if you like.</p>{/if}

  {#if touch}
    <Hotbar {session} {favorites} {recents} />
  {/if}

  <!-- Named by its aria-label; on touch the label stays out of sight, because the sheet is short and the placeholder says the same. -->
  <label class="search-label ore-field__label ore-type-label" class:sr={touch} for="palette-search-input">Search blocks</label>
  <input
    id="palette-search-input"
    type="search"
    class="search ore-input ore-type-body"
    placeholder="Search blocks…"
    autocomplete="off"
    spellcheck="false"
    bind:value={query}
    onkeydown={onSearchKey}
    aria-label="Search blocks"
    data-testid="palette-search"
  />
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions: the keys come from the buttons inside this list -->
  <ul class="list" data-testid="palette-list" aria-label="Blocks (arrow keys move, Enter chooses)" bind:this={listEl} onkeydown={onListKey}>
    {#if offerTyped}
      <li class="ore-row"><button class="entry typed ore-type-label" tabindex={tabbable === "\u0000typed" ? 0 : -1} onfocus={() => (roving = "\u0000typed")} onclick={() => choose(typed)} data-testid="palette-use-typed">Use “{typed}”</button></li>
    {/if}
    {#each found.shown as entry (entry.block)}
      <li class="ore-row" class:row={touch}>
        <button
          class="entry ore-type-label"
          class:on={session.block === entry.block}
          class:build={entry.source === "build"}
          aria-pressed={session.block === entry.block}
          tabindex={tabbable === entry.block ? 0 : -1}
          onfocus={() => (roving = entry.block)}
          title={`${entry.block} (${entry.source === "build" ? "used in this build" : "from the texture pack"})`}
          onclick={() => choose(entry.block)}
          data-block={entry.block}
        >{entry.block.replace("minecraft:", "")}</button>
        {#if touch}
          {@const fav = isFavorite(favorites, entry.block)}
          {@const full = !fav && favoritesFull(favorites)}
          <button
            type="button"
            class="star ore-seg ore-type-label"
            aria-pressed={fav}
            aria-label={`Favourite ${shortName(entry.block)}`}
            title={full ? `Favourites are full (${FAVORITE_LIMIT}): unstar one first` : `Star ${entry.block}`}
            disabled={full}
            onclick={() => ontogglefavorite?.(entry.block)}
            data-testid="palette-star"
            data-block={entry.block}
          ><span aria-hidden="true">{fav ? "★" : "☆"}</span></button>
        {/if}
      </li>
    {/each}
  </ul>
  <p class="hint ore-type-caption">
    {found.total} match{found.total === 1 ? "" : "es"}{found.total > found.shown.length ? `, first ${found.shown.length} shown` : ""}.
    {session.packBlocks.length === 0 ? "No texture pack: only this build's blocks are listed; type any other block above." : ""}
  </p>
</section>

<style>
  /* The design's classes (ore-panel, ore-field, ore-input, ore-row, ore-seg, ore-notice) come from the page's
     stylesheet; what is below only places them and states what the design has no class for. On touch the
     sheet is the panel, so the root is not a tile there. */
  .palette { min-width: 0; }
  .current { margin: 0; }
  .sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
  .search-label { margin: var(--space-4) 0 0; }
  .search-label.sr { margin: -1px; }
  .search { margin: var(--space-1) 0 0; -webkit-appearance: none; appearance: none; }

  /* The list is a well in surface-page; each entry is a row tile on it. */
  .list { list-style: none; margin: var(--space-2) 0 0; padding: var(--space-1) var(--space-1) var(--space-2); max-height: 17rem; overflow: auto; background: var(--surface-page); border: 2px solid var(--outline); border-radius: var(--radius-none); box-shadow: var(--field-well); }
  .entry { display: block; flex: 1 1 auto; min-width: 0; width: 100%; box-sizing: border-box; min-height: 32px; margin: 0; padding: var(--space-1) var(--space-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; background: transparent; color: var(--ink); border: 0; border-radius: var(--radius-none); cursor: pointer; }
  .entry:hover { background: var(--surface-raised); }
  /* The chosen entry: a green face with a white underline, and aria-pressed for everything else. */
  .entry.on, .entry.on:hover { background: var(--green); color: var(--ink); box-shadow: inset 0 -2px 0 var(--ink); }
  .entry:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
  .entry.build { font-weight: 700; }
  .entry.typed { font-style: italic; }

  .hint { margin: var(--space-2) 0 0; color: var(--ink-muted); }
  .hint.above-hotbar { margin-bottom: var(--space-3); }
  /* An error is the design's important notice: the yellow bar, dark text, and the message itself. */
  .hint.bad { justify-content: flex-start; min-height: 0; text-align: left; color: var(--ink-dark); }

  /* Touch: a row is the block and its star cell side by side; a finger gets 48 px rows and a 44 px star. */
  li.row { align-items: center; }
  li.row .entry { align-self: stretch; min-height: 48px; }
  .star { flex: 0 0 auto; width: 44px; min-width: 44px; min-height: 44px; margin: var(--space-1) var(--space-1) var(--space-1) var(--space-2); padding: 0 0 4px; font-size: var(--type-title-size); line-height: 1; touch-action: manipulation; }
  /* ore-seg draws its pressed state from aria-checked; this is a toggle button, so it reads aria-pressed.
     The box stays 44 px tall: the band closes, the face does not drop. */
  .star.ore-seg[aria-pressed="true"] { --bf: var(--green); --bh: var(--green-hi); --bl: var(--green-lo); --bt: var(--ink); padding-bottom: 0; box-shadow: inset 2px 2px 0 var(--bh), inset -2px -2px 0 var(--bl); }
  .star.ore-seg[aria-pressed="true"]:hover:not(:disabled) { --bf: var(--green-hover); --bh: var(--green-hover-hi); --bl: var(--green-hover-lo); }
  .star.ore-seg[aria-pressed="true"]::after { content: ""; position: absolute; left: 50%; bottom: 0; width: 44px; height: 2px; margin-left: -22px; background: var(--ink); }

  @media (pointer: coarse) {
    .entry {
      min-height: 48px;
      display: flex;
      align-items: center;
      padding: 0 var(--space-3);
    }
  }
</style>
