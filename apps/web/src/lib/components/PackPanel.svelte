<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import type { StoredPack } from "../user-pack.ts";

let {
  hasSitePack,
  user,
  busy,
  note,
  error,
  onadd,
  onremove,
  touch = false,
}: {
  hasSitePack: boolean;
  user: StoredPack | null;
  busy: boolean;
  note: string;
  error: string;
  onadd: (file: File) => void;
  onremove: () => void;
  /** The mobile menu: no mention of dropping a file on the page. */
  touch?: boolean;
} = $props();

const mb = (bytes: number): string => `${(bytes / 1e6).toFixed(1)} MB`;
</script>

<!-- A design panel. In the mobile menu the menu's own section is the panel, so this one draws no frame. -->
<section class="packs ore-panel" class:touch aria-labelledby="packs-title" data-testid="pack-panel">
  <h2 id="packs-title" class={["ore-panel__header", touch ? "ore-type-label" : "ore-type-heading"]}>Textures</h2>
  <p class="ore-type-prose" data-testid="pack-state">
    {#if user}
      Using your pack <strong data-testid="pack-name">{user.name}</strong>
      ({user.counts.textures} textures, {user.counts.blockstates} blockstates, {user.counts.models} models; {mb(user.fileSize)} file){hasSitePack ? ", laid over this site's pack" : ""}.
      It is kept in this browser.
    {:else if hasSitePack}
      Using the texture pack this site provides.
    {:else}
      No texture pack: blocks are drawn as flat colours.
    {/if}
  </p>
  <div class="row">
    <label class="button ore-btn ore-btn--secondary ore-type-label">
      {user ? "Replace my pack" : "Use my own pack"}
      <input type="file" class="sr-only" accept=".zip,.jar" disabled={busy} data-testid="pack-file" onchange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (f) onadd(f); }} />
    </label>
    {#if user}<button type="button" class="ore-btn ore-btn--secondary ore-type-label" onclick={onremove} disabled={busy} data-testid="pack-remove">Remove my pack</button>{/if}
    <span class="hint ore-type-prose ore-muted">A resource pack (.zip) or a Minecraft client .jar, chosen here{touch ? "" : " or dropped on the page"}. It is read in your browser and never uploaded.</span>
  </div>
  <div aria-live="polite" data-testid="pack-status">
    {#if busy}<p class="hint ore-type-prose ore-muted">Reading the pack…</p>{/if}
    {#if note}<p class="hint ore-type-prose ore-muted" data-testid="pack-note">{note}</p>{/if}
  </div>
  {#if error}<p class="ore-notice ore-notice--important ore-type-label" role="alert" data-testid="pack-error">{error}</p>{/if}
</section>

<style>
  .packs { margin: 0 0 var(--space-6); }
  .packs.touch { margin: 0; padding: 0; background: none; box-shadow: none; }
  p { margin: 0; }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-3); align-items: center; }
  .hint { flex: 1 1 14rem; }
  /* The live region has nothing in it most of the time, so it adds no gap of its own; its paragraphs do. */
  [data-testid="pack-status"] { margin-top: 0; }
  [data-testid="pack-status"] > p { margin-top: var(--space-2); }
</style>
