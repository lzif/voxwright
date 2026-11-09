<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import { buildInfo } from "../build-info.ts";

// `embedded`: the copy inside the mobile menu sheet. It is a plain block there, because a second
// <footer> inside another landmark is not a top-level contentinfo landmark any more.
let { embedded = false }: { embedded?: boolean } = $props();

const short = buildInfo.commit.length > 12 ? buildInfo.commit.slice(0, 9) : buildInfo.commit;
</script>

{#snippet body()}
  <p>
    <strong>voxwright</strong>{buildInfo.version === "0.0.0" ? "" : ` ${buildInfo.version}`}
    is free software under the
    <a href="https://www.gnu.org/licenses/agpl-3.0.html" rel="noopener" data-testid="license-link">GNU Affero General Public License, version 3 only</a>.
    <a href={buildInfo.sourceLink} rel="noopener" data-testid="source-link">Source code of this version{short ? ` (${short}${buildInfo.modified ? ", with local changes" : ""})` : ""}</a>.
  </p>
  <p data-testid="notice">Not affiliated with Mojang or Microsoft.</p>
{/snippet}

{#if embedded}
  <div class="site-footer ore-type-prose" data-testid="footer">{@render body()}</div>
{:else}
  <footer class="site-footer ore-type-prose" data-testid="footer">{@render body()}</footer>
{/if}

<style>
  /* Long copy in the design's prose face. A link is white with an underline (the colour of the text
     around it is the muted one), so it is told apart by more than colour. */
  .site-footer { max-width: 1500px; margin: 0 auto; padding: var(--space-4) var(--space-8) var(--space-6); border-top: 2px solid var(--panel-hi); color: var(--ink-muted); }
  @media (max-width: 1000px) { .site-footer { padding-inline: var(--space-4); } }
  p { margin: var(--space-1) 0; }
  strong { color: var(--ink); }
  a { color: var(--ink); text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 2px; }
</style>
