<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import type { Snippet } from "svelte";
// The Ore UI Study design system, loaded once for the whole app: the tokens first (ore-ui.css reads
// them), then the component classes, then the app's own rules (docs/design-system.md).
import "../lib/ore-ui/tokens.css";
import "../lib/ore-ui/ore-ui.css";
import "../lib/app.css";

let { children }: { children: Snippet } = $props();
</script>

{@render children()}
