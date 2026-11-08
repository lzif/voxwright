# Design system: Ore UI Study

The app's look comes from Luki's design system "Ore UI Study" (version 3): a square, bevelled,
pixel-font interface measured from the Ore UI state sheets. This page says where its files live, how
the generated one is made, how the fonts are served and licensed, and how to use it in Svelte. The
design system's own rules are copied in [the last section](#the-design-systems-own-rules).

The design system ships a React implementation (`window.OreUIStudy`). The app does not use it: it
is Svelte, and it uses the stylesheet and the tokens only.

Status: the files below are in the repository. No page imports them yet.

## Files

| File                                  | What it is                                                                                                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/ore-ui/tokens.json` | The design system's tokens, as Luki supplied them (colour, type, spacing, radius, shadow). The source of the next file.                                                     |
| `apps/web/scripts/ore-tokens.ts`      | Writes `tokens.css` from `tokens.json`.                                                                                                                                     |
| `apps/web/src/lib/ore-ui/tokens.css`  | Generated. The `@font-face` rules, one `:root` block with a custom property per token, and a `.ore-type-*` class per type style. Do not edit by hand.                       |
| `apps/web/src/lib/ore-ui/ore-ui.css`  | The design system's component stylesheet (`bundle.css`), unchanged apart from a header comment. Every colour, space and radius in it is a `var(--token)` from `tokens.css`. |
| `apps/web/static/fonts/`              | `PixelifySans-Regular.woff2`, `PixelifySans-Bold.woff2`, `NotoSans-Regular.woff2` and the licence of each family.                                                           |
| `apps/web/test/ore-tokens.test.ts`    | Checks that `tokens.css` is what the script writes, that `ore-ui.css` reads only properties that exist, and the text contrast.                                              |

Load `tokens.css` before `ore-ui.css`.

## Generating tokens.css

`tokens.json` is the source. After changing it (or the script), regenerate the stylesheet:

```sh
node apps/web/scripts/ore-tokens.ts          # from the repository root; or `node scripts/ore-tokens.ts` in apps/web
node apps/web/scripts/ore-tokens.ts --check  # exit 1 if tokens.css is not what tokens.json gives
```

Each token becomes a custom property of the same name (`surface-page` is `--surface-page`), because
that is how `ore-ui.css` reads them. A value written `{outline}` in `tokens.json` becomes
`var(--outline)`, so `--ink-dark`, `--ink-muted` and the tag fills keep following the token they
name. The type styles become `--type-<style>-family`, `-size`, `-line` and `-weight`, the families
`--font-sans` (Pixelify Sans), `--font-text` (Noto Sans) and `--font-mono`. The script stops with an
error on an unknown reference, a reference loop or a colour that is not `#rrggbb`.

`ore-tokens.test.ts` regenerates the file in memory and compares it with the committed one, so the
two cannot drift.

The design system's React bundle sets text with bare class names (`label`, `caption`, `heading`,
`prose`). Those names are too common for a global stylesheet (the app already has a `.label`), so
`tokens.css` defines the same styles as `.ore-type-display`, `.ore-type-title`, `.ore-type-heading`,
`.ore-type-body`, `.ore-type-label`, `.ore-type-caption`, `.ore-type-prose` and `.ore-type-code`.

## Fonts

### Where the font URLs point

`tokens.css` loads the fonts with `url("/fonts/<file>")`, `font-display: swap`. The files are in
`apps/web/static/`, which SvelteKit publishes at the root of the site. Vite recognises a root-relative
URL that names a file in `static/` and rewrites it when it builds the stylesheet. Because
`vite.config.ts` sets `paths.relative`, the built stylesheet (`_app/immutable/assets/<hash>.css`)
points at `../../../fonts/<file>`, which is the `fonts/` folder at the root of the site, whether the
site is served from the root of its host or from the sub-path in `VOXWRIGHT_BASE_PATH`. The dev
server serves `/fonts/<file>` in both cases.

So do not write a base path into the URL, and do not use `asset()` (a script helper that does not
apply in a stylesheet). If the stylesheet is ever used outside Vite, `/fonts/` has to be the root of
the site.

### Licences

Both families are under the SIL Open Font License 1.1, which requires every copy of the fonts to
carry the copyright notice and the licence. The licence text sits next to the fonts, so it is
published with them:

| Font                         | Files                                                   | Copyright line (from the font and its `OFL.txt`)                                            | Licence file           |
| ---------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------- |
| Pixelify Sans, version 1.000 | `PixelifySans-Regular.woff2`, `PixelifySans-Bold.woff2` | Copyright 2021 The Pixelify Sans Project Authors (https://github.com/eifetx/Pixelify-Sans)  | `PixelifySans-OFL.txt` |
| Noto Sans, version 2.015     | `NotoSans-Regular.woff2`                                | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic) | `NotoSans-OFL.txt`     |

The licence files are the upstream `OFL.txt` of each family from the Google Fonts repository
(`ofl/pixelifysans` and `ofl/notosans`), kept as they are. Neither names a Reserved Font Name. The
woff2 files are Latin subsets from the design system; their name tables still carry the family name,
version, copyright string and licence URL. If you subset or convert them again, keep the name table.

## Using it in Svelte

Import the two stylesheets once, `tokens.css` first (a layout is the natural place):

```svelte
<script>
  import "$lib/ore-ui/tokens.css";
  import "$lib/ore-ui/ore-ui.css";
</script>
```

The `ore-*` classes are global, so a component's own `<style>` block does not need to know about
them. Use native elements and give them the classes; there is no component library to import.

- A text field is `<input type="text" class="ore-input ore-type-body">`, a checkbox or radio is a
  native `<input class="ore-choice__input">` (visually hidden) followed by the `.ore-box` that is
  drawn, and a slider is a native `<input type="range" class="ore-slider__input">` over an
  `.ore-slider__rail` span. Buttons, tabs, toggle segments, the switch and the dropdown are
  `<button>` elements; their state is `aria-checked`, `aria-selected` and `aria-expanded`, which the
  stylesheet reads, so keep them up to date.
- Put the type class on the element that holds the words: `ore-type-label` on buttons, tabs, toggle
  segments, field labels and the text next to a check or switch; `ore-type-caption` on help and
  error text, tags, tooltips and row descriptions; `ore-type-body` on a text field and a dropdown;
  `ore-type-heading` on a dialog title or panel header; `ore-type-prose` on a dialog body.
- The slider's filled part follows `--p` (0 to 1), which the markup sets on `.ore-slider__control`:
  `style="--p: {(value - min) / (max - min)}"`.

A button and a checked checkbox, with the check drawn as the design system draws it:

```svelte
<button type="button" class="ore-btn ore-btn--primary ore-type-label">Create world</button>

<div class="ore-choice">
  <label class="ore-choice__row" for="grid">
    <input id="grid" type="checkbox" class="ore-choice__input" bind:checked={showGrid} />
    <span class="ore-box" aria-hidden="true">
      <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true" focusable="false" shape-rendering="crispEdges">
        <path d="M2 6.5l3 3 5-6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter" />
      </svg>
    </span>
    <span class="ore-choice__text ore-type-label">Show grid</span>
  </label>
</div>
```

Do not add React or the design system's JavaScript bundle. The sections of `bundle.js` and each
component's `README.md` in the design system describe the intended markup if a component needs to be
reproduced.

## The design system's own rules

These three sections are copied from the design system's `README.md` without changes, except that
their headings are one level lower. They are Luki's rules for the interface.

### Content fundamentals

- Plain text only. Ore UI renders no `§` color codes and no emoji, so never put either in a label, tag, tab or dialog. Carry emphasis with a tag variant or a token color, always next to a word.
- Labels are sentence case and verb first: "Create world", "Delete world". Only hero buttons and the screen's `display` title are set in capitals ("PLAY"). A destructive button repeats the verb of its dialog title ("Delete world?" → "Delete world").
- Dialog titles are a question or a short noun phrase in `heading`; the copy under them is one or two sentences in `prose`.
- Descriptions and data columns are short fragments in `caption`: "Survival, last played today". Tags are one or two words, no punctuation.

### Visual foundations

- **Everything is square**, with `radius-none`. `radius-pixel` belongs to the tooltip bubble alone.
- **One bevel.** Raised controls (buttons, toggle segments, tabs, thumbs) are a 2px `outline`, a 2px top and left highlight, a 2px bottom and right line, and a 4px dark band underneath; the colors are the `-hi`, `-lo` and `-edge` tokens of each face. Pressed closes the band and drops the face 4px. Checkboxes, radios, switch tracks and slider segments use the same highlight and line without a band. Wells (text field, progress track) are `surface-page` with a `field-shade` band under the top outline. Panels and rows are tiles with a `panel-hi` top edge and a `panel-lo` line beneath, and no outline. No gradients, glow or blur, except the slider rail's hard color split.
- **Surfaces.** Screen background and dialog body `surface-page`; panels, rows, dialog header and footer `surface-panel`; hover face of tabs and the band under light controls `surface-raised`. Text is `ink` (white) on all of them; descriptions and help are `ink-muted`; placeholders `ink-placeholder`; text on light faces `ink-dark`; text on disabled light faces `ink-disabled`.
- **Action colors.** Hero, primary and every checked or selected state use `green`, with `green-hover` on hover and `green-pressed` pressed. Secondary controls, thumbs and dropdowns use the light ramp `light-200`, `light-100` on hover, `light-300` pressed. Unchecked boxes and empty slider segments use `light-400`. Destructive is `red` (`red-hover` on hover). Disabled controls become `light-200` faces with a `light-400` outline. `blue` is for info notices, tooltips and progress; `yellow` for the important notice (both from the in-game screenshots).
- **Type.** Pixelify Sans throughout the controls. `display` for one screen title in capitals, `title` for sections, `heading` for dialog titles, panel headers and hero button text, `body` for field values, `label` for button, tab and control text, `caption` for descriptions, data, tags and tooltips, `prose` (Noto Sans) for long copy in dialogs, `code` for seeds and IDs.
- **Spacing.** Controls are 44px tall (switch 28px, checkbox 24px, slider thumb 28px). Panel padding `space-4`, gap between form rows `space-4`, gap between controls in a row `space-2`, between panels `space-6`, screen margins `space-8`, dialog width up to 428px.
- **Focus.** Every focusable element shows a 2px `focus` (white) ring drawn directly outside its outline; a text field leaves a 2px gap. Keyboard and gamepad alike.
- **Known contrast misses.** All are the source's own pairs and stay as sampled. White text on `green-hover` is 3.1:1 and on `red-hover` 2.4:1. The `outline` is 1.85:1 on `surface-panel` and 1.30:1 on `surface-page`, an unchecked box (`light-400`) is 2.7:1 and a green face 2.0:1 on a panel, so control edges alone never carry meaning: every control has a label, and state also shows as a tick, an I or O, a diamond centre or an underline. The source shows disabled tabs looking like enabled ones.

### Components

- **Buttons.** Hero: green bold capitals with a dark-green label shadow, the screen's single main action. Primary: green, the standard action. Secondary: light, for quieter actions. Destructive: red, inside a confirmation dialog only. Each has normal, hover, focus, pressed and disabled states.
- **Dialogs.** An outlined frame: `surface-panel` header with centred title and optional back and close buttons, `surface-page` body in `prose`, sections behind `panel-hi` dividers, and a `surface-panel` footer with the buttons stacked full width, main action first. Never a hero.
- **Form controls.** Checkbox (24px square, green with a white tick when checked), radio (the same square turned into a diamond, white centre when selected), switch (a 54px track with an I or O glyph and a 28px thumb), toggle (segments of which one is pressed green with an underline), slider (ten-segment rail, green fill, 28px thumb), dropdown (a secondary button with a chevron) and text field (a dark well). Label above in `label`, help text below in `caption`; panels hold them.
- **Navigation and labels.** Tabs are raised segments with the selected one pressed in and underlined; tags are flat colored labels in neutral, primary, info, notice, warning and realms.
- **Layout and feedback.** Panel groups controls under a header; ListItem is a row with label, description, data columns and action cells; Notice is a full-width bar (important or info); Tooltip is a blue bubble with a tail; Progress is a thin blue bar.
