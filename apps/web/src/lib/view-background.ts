// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The colour behind the 3D picture, as 0xRRGGBB: the `surface-page` token of the Ore UI Study design
 * system (`lib/ore-ui/tokens.css`), so the picture sits on the same dark as the page around it. Both
 * renderers take it: the GPU renderer as its `background` option and the software rasterizer as the
 * `background` option of `renderView`. `test/contrast.test.ts` checks that it is still the token.
 */
export const VIEW_BACKGROUND = 0x313233;
