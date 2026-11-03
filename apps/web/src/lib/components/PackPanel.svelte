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
}: {
  hasSitePack: boolean;
  user: StoredPack | null;
  busy: boolean;
  note: string;
  error: string;
  onadd: (file: File) => void;
  onremove: () => void;
} = $props();

const mb = (bytes: number): string => `${(bytes / 1e6).toFixed(1)} MB`;
</script>

<section class="packs" aria-labelledby="packs-title" data-testid="pack-panel">
  <h2 id="packs-title">Textures</h2>
  <p data-testid="pack-state">
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
    <label class="button">
      {user ? "Replace my pack" : "Use my own pack"}
      <input type="file" class="sr-only" accept=".zip,.jar" disabled={busy} data-testid="pack-file" onchange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (f) onadd(f); }} />
    </label>
    {#if user}<button class="ghost" onclick={onremove} disabled={busy} data-testid="pack-remove">Remove my pack</button>{/if}
    <span class="hint">A resource pack (.zip) or a Minecraft client .jar, chosen here or dropped on the page. It is read in your browser and never uploaded.</span>
  </div>
  <div aria-live="polite" data-testid="pack-status">
    {#if busy}<p class="hint">Reading the pack…</p>{/if}
    {#if note}<p class="hint" data-testid="pack-note">{note}</p>{/if}
  </div>
  {#if error}<p class="error" role="alert" data-testid="pack-error">{error}</p>{/if}
</section>

<style>
  .packs { margin: 0 0 1rem; }
  h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 0.3rem; color: #5f594f; }
  p { margin: 0.2rem 0; }
  .row { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; margin-top: 0.3rem; }
  .button, button { position: relative; background: #2b2925; color: #f4f1eb; border: 0; border-radius: 6px; padding: 0.4rem 0.8rem; cursor: pointer; font: inherit; }
  .button:focus-within { outline: 3px solid #1d4ed8; outline-offset: 2px; }
  button.ghost { background: #e2dccf; color: #2b2925; }
  button:disabled { opacity: 0.6; cursor: default; }
  .hint { color: #5f594f; font-size: 0.85rem; }
  .error { background: #fbe3e0; color: #7a1f16; padding: 0.5rem 0.8rem; border-radius: 6px; }
</style>
