<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script lang="ts">
import { buildInfo } from "../build-info.ts";

const short = buildInfo.commit.length > 12 ? buildInfo.commit.slice(0, 9) : buildInfo.commit;
</script>

<footer data-testid="footer">
  <p>
    <strong>voxwright</strong>{buildInfo.version === "0.0.0" ? "" : ` ${buildInfo.version}`}
    is free software under the
    <a href="https://www.gnu.org/licenses/agpl-3.0.html" rel="noopener" data-testid="license-link">GNU Affero General Public License, version 3 only</a>.
    <a href={buildInfo.sourceLink} rel="noopener" data-testid="source-link">Source code of this version{short ? ` (${short}${buildInfo.modified ? ", with local changes" : ""})` : ""}</a>.
  </p>
  <p data-testid="notice">Not affiliated with Mojang or Microsoft.</p>
</footer>

<style>
  footer { max-width: 1500px; margin: 0 auto; padding: 1rem 1.2rem 1.6rem; border-top: 1px solid #e2dccf; font-size: 0.85rem; color: #4d483f; }
  p { margin: 0.2rem 0; }
  a { color: #1d3f9a; }
</style>
