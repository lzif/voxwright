# Design system: Ore UI Study

The app's look comes from Luki's design system "Ore UI Study" (version 3): a square, bevelled,
pixel-font interface measured from the Ore UI state sheets. This page says where its files live, how
the generated one is made, how the fonts are served and licensed, and how to use it in Svelte. The
design system's own rules are copied in [the last section](#the-design-systems-own-rules).

The design system ships a React implementation (`window.OreUIStudy`). The app does not use it: it
is Svelte, and it uses the stylesheet and the tokens only.

Status: the app uses them. `apps/web/src/routes/+layout.svelte` loads `tokens.css`, then `ore-ui.css`, then
the app's own `app.css`, once for every page; [How the app uses it](#how-the-app-uses-it) says which
control is which class.

## Files

| File                                  | What it is                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/ore-ui/tokens.json` | The design system's tokens, as Luki supplied them (colour, type, spacing, radius, shadow). The source of the next file.                                                                                                                                                                                                                      |
| `apps/web/scripts/ore-tokens.ts`      | Writes `tokens.css` from `tokens.json`.                                                                                                                                                                                                                                                                                                      |
| `apps/web/src/lib/ore-ui/tokens.css`  | Generated. The `@font-face` rules, one `:root` block with a custom property per token, and a `.ore-type-*` class per type style. Do not edit by hand.                                                                                                                                                                                        |
| `apps/web/src/lib/ore-ui/ore-ui.css`  | The design system's component stylesheet (`bundle.css`, Study v3 with the Editor group), unchanged apart from a header comment. Every colour, space and radius in it is a `var(--token)` from `tokens.css`.                                                                                                                                  |
| `apps/web/src/lib/app.css`            | The app's own rules on top of the two files above: the page base (dark `color-scheme`, `surface-page`, the body font, the 2px focus ring, `.sr-only`), and the few places where the app's native elements need more than the design's markup gives (listed [below](#where-the-app-differs-from-the-design)). Colours only as `var(--token)`. |
| `apps/web/src/routes/+layout.svelte`  | Imports the three stylesheets, in that order.                                                                                                                                                                                                                                                                                                |
| `apps/web/src/lib/view-background.ts` | `VIEW_BACKGROUND`, `0x313233`: the `surface-page` colour as a number, for the two 3D renderers. `test/contrast.test.ts` checks that it is still the token.                                                                                                                                                                                   |
| `apps/web/static/fonts/`              | `PixelifySans-Regular.woff2`, `PixelifySans-Bold.woff2`, `NotoSans-Regular.woff2`, `NotoSans-Bold.woff2` and the licence of each family.                                                                                                                                                                                                     |
| `apps/web/test/ore-tokens.test.ts`    | Checks that `tokens.css` is what the script writes, that `ore-ui.css` reads only properties that exist, and the text contrast.                                                                                                                                                                                                               |
| `apps/web/test/contrast.test.ts`      | The text and focus-ring pairs the app's pages use, read from `tokens.json`, each at least 4.5:1 (3:1 for the ring), and that `VIEW_BACKGROUND` and the `theme-color` are the `surface-page` token.                                                                                                                                           |

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
| Noto Sans, version 2.015     | `NotoSans-Regular.woff2`, `NotoSans-Bold.woff2`         | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic) | `NotoSans-OFL.txt`     |

The licence files are the upstream `OFL.txt` of each family from the Google Fonts repository
(`ofl/pixelifysans` and `ofl/notosans`), kept as they are. Neither names a Reserved Font Name. The
woff2 files are Latin subsets from the design system; their name tables still carry the family name,
version, copyright string and licence URL. If you subset or convert them again, keep the name table.

## Using it in Svelte

Import the stylesheets once, `tokens.css` first (a layout is the natural place; the app does it in
`+layout.svelte`, and adds `app.css` as the third):

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

## How the app uses it

The whole app is in the dark theme, the only one the design defines: desktop and mobile layout alike.
Layout, behaviour, the order of the DOM, roles, accessible names, `data-testid`s and native form
elements are as they were before the design was applied; only the look changed. Every colour in the
app's styles is a `var(--token)`. The colour values outside the token files are these, and each is
either the `surface-page` token or data rather than interface:

- `#313233` as the `theme-color` of `app.html` and `0x313233` as `VIEW_BACKGROUND`: the `surface-page`
  token, which `test/contrast.test.ts` checks.
- `blockColor()` in `BottomToolbar.svelte`: a handful of colours, one per kind of block (stone, planks,
  dirt, grass and so on), set inline on the small swatch beside the current block's name. They are the
  colour of the block being shown, like a texture, not interface colours, so they are not tokens.

| App control                                                                                                                                              | Design class and markup                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page title                                                                                                                                               | `ore-type-display`, set in capitals with `text-transform` (the screen's one title)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Open a schematic, with no file open (desktop page, mobile welcome card)                                                                                  | `ore-btn ore-btn--hero` on the `<label>` around the hidden file input, `ore-type-heading`. The only hero of a screen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Open a schematic, with a file open, and in the mobile menu; Export and download; Convert and download; Restore                                           | `ore-btn ore-btn--primary`, `ore-type-label`; `ore-btn--touch` (48px) in the mobile layout                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Use my own pack, Replace my pack, Remove my pack, Undo, Redo, Zoom in, Zoom out, Centre on the build, Show tips, the Menu button, the skip link, Discard | `ore-btn ore-btn--secondary`; the Menu button and the menu's buttons also `ore-btn--touch`. Discard is `ore-btn--primary` when the saved session is damaged and Discard is all there is.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Editing tools (View, Place, ...), Orbit and Fly, Auto, High and Low (Quality), Auto, Mobile and Desktop (Layout mode)                                    | `ore-seg` buttons, in an `ore-toggle__group` (the tools in a wrapping row, kept apart). The chosen one is `aria-pressed="true"` (the layout buttons: the `on` class).                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Hollow, and the settings checkboxes of the mobile menu                                                                                                   | `ore-choice__row` label around the native `<input type="checkbox" class="ore-choice__input">`, then `ore-box` with the check, then `ore-choice__text`; help below in `ore-field__help ore-choice__help`                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Turn, Tilt, From, To, Cursor distance                                                                                                                    | `ore-slider-field` around the native `<input type="range" class="ore-slider__input">` with `ore-slider__control` (`--p` set from the value) and `ore-slider__rail`. Turn, Tilt, From and To are `<label>`s wrapping the text, the control and the value in that DOM order, laid out as the design's head by a grid in `app.css` (an `<output>` before the input would take the label); Cursor distance keeps the design's `ore-slider__head`                                                                                                                                                                                     |
| File format list                                                                                                                                         | the native `<select>` with `ore-btn ore-btn--secondary ore-dd__btn ore-dd__select ore-type-body`, in an `ore-dd` with an `ore-dd__chev` beside it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Textures, View, Layers, Export, Autosave, Renderer, Blocks; the sections of the mobile menu; the welcome card                                            | `ore-panel` with an `ore-panel__header` (`ore-type-heading`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Error bars (an error of the page, of the texture pack)                                                                                                   | `ore-notice ore-notice--important`; the page's error is under the header on the desktop and in the top overlays, above the picture, in the mobile layout                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| "working…", the note that the software renderer is a viewer (mobile)                                                                                     | `ore-notice ore-notice--info`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Inline errors (the edit line, the autosave problem, the restore dialog's error)                                                                          | `ore-field__error`: the words in `ink` with the design's red square before them                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| The renderer's name in the mobile top bar                                                                                                                | `ore-tag` (neutral) with `ore-type-caption`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| The restore dialog                                                                                                                                       | the native `<dialog class="ore-dialog">` (kept for its focus handling) with `ore-dialog__header`, `ore-dialog__body` in `ore-type-prose` and `ore-dialog__footer` with the buttons stacked, main action first                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Help paragraphs, hints, the footer, the restore dialog's text                                                                                            | `ore-type-prose` (Noto Sans), `ore-muted` for the secondary colour; short data (file info, the renderer's numbers) in `ore-type-caption`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| The picture                                                                                                                                              | a well: `surface-page` inside a 2px `outline`. The GPU renderer's `background` option and the software rasterizer's `background` option are `VIEW_BACKGROUND`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| The mobile sheets (menu, block palette, block state, selection)                                                                                          | the design's dialog docked to the bottom: an outlined `surface-page` frame, a `surface-panel` handle zone and `ore-dialog__header` with the title in `ore-dialog__title ore-type-heading`, the close button as `ore-dialog__icon ore-dialog__icon--close` at 44px, a `--outline` scrim at 70%                                                                                                                                                                                                                                                                                                                                    |
| The mobile bottom toolbar: the current block, the tools, State and Select                                                                                | `.ore-editor` region: the swatch is `ore-btn ore-btn--secondary ore-btn--touch` (pressed face while the palette is open); the tools and the two panel buttons are `ore-seg ore-btn--touch` buttons kept apart in a strip, the chosen one `aria-pressed`; the readout line is a `surface-panel` tile in `ore-type-ui-small`, with the Edit state chip as `ore-btn--secondary`; the separators are 4px grooves                                                                                                                                                                                                                     |
| The thumb cluster: Undo, Redo, Cancel, Confirm                                                                                                           | `ore-btn ore-btn--secondary` (Confirm: `ore-btn--primary`), 48px                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| The nudge pad and the move pad                                                                                                                           | the arrows are `ore-btn--secondary`, A and B, Hollow and ×8 are `ore-seg` toggles (the chosen one `aria-pressed`, the corner letter in the face of the chosen corner)                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| The hotbar (the sheet's and the quick row)                                                                                                               | each block is an `ore-btn--secondary` chip (`aria-pressed` for the current one); a favourite has an `ore-tag ore-tag--primary` star                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| The undo toast                                                                                                                                           | `ore-notice ore-notice--info` with an `ore-btn--secondary` Undo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| The quick-start card                                                                                                                                     | `ore-panel` with an `ore-panel__header` title, an `ore-dialog__icon` close button, and `ore-box` ticks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| The touch reticle                                                                                                                                        | graphics in `--tag-primary` and the other tokens, no text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| The `?perf=1` overlay                                                                                                                                    | `ore-type-code` on `surface-page`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Block palette: the chosen block, the search, the list                                                                                                    | `.ore-editor`; desktop `ore-pane ore-pane--floating` with an `ore-pane__header` and an `ore-pane__body`; `ore-field` with `ore-field__label`, `ore-input` text fields (`is-error` for a bad block name), the search as `ore-search` with `ore-search__input` and an `ore-search__clear` button (out of the tab order), the list a `surface-sunken` well of `ore-row` rows holding the entry buttons, the chosen entry on `green` with an underline; stars are `ore-seg` toggles; a bad name is an `ore-notice--important`                                                                                                        |
| Block state: properties                                                                                                                                  | `.ore-editor`; desktop `ore-pane ore-pane--floating`; each property is an `ore-panel` (touch): chips are `ore-seg` toggles, a true or false property is an `ore-switch`, a stepper is two `ore-btn--secondary` buttons around the value, a property that has a list of values is a native `<select>` in `ore-dd` drawn as the editor dropdown (`ore-btn--secondary ore-dd__btn ore-dd__select`, 36px, 44px on touch) with an `ore-dd__chev`; free values are `ore-input`; Add and Rotate block are `ore-btn--dark` (`ore-btn--touch` on touch)                                                                                   |
| Selection: the coordinates, the box, Fill, Replace, Move                                                                                                 | `.ore-editor`; desktop two `ore-pane ore-pane--floating` panes (Block at coordinates, Selection); `ore-num` number fields with an `ore-num__axis` badge (X, Y and Z in `--axis-x`, `--axis-y` and `--axis-z` on `surface-sunken`) and `ore-input` text fields; `ore-btn--dark` for the actions that change the build (Set to chosen block, Fill, Replace, Rotate, Mirror, Move, Copy, Paste), `ore-btn--secondary` for the small steppers and the exits (Erase, Clear, Select all, Pointed-at); an `ore-choice` check box; on touch the sheet is the pane, groups are `ore-panel` tiles, the actions are `ore-btn--touch` (48px) |

### The Editor group (`.ore-editor`)

The Study's v3 export adds the Editor group: 19 more colour tokens (`--editor-light-hi`, `--editor-light-lo`,
`--ink-faint`, `--editor-accent`, `--axis-x`, `--axis-y`, `--axis-z` and others), the `ore-type-ui`,
`ore-type-ui-small` and `ore-type-ui-strong` styles (Noto Sans 16px/14px) and the `ore-pane`, `ore-section`,
`ore-vec`, `ore-num`, `ore-search`, `ore-statusbar`, `ore-rail`, `ore-hotbar` and `ore-btn--dark` classes.
`.ore-editor` marks a region that is drawn flat: `--band` is 0 there, so raised controls are a 44px face
without the 4px band, at 16px Noto Sans. The app puts it on the editing panels (palette, block state,
selection and block-at-coordinates), the tool row and the edit line, the mobile bottom toolbar, and the
mobile sheets that hold those panels (`BottomSheet` with `editor`). The game's own chrome (the landing page,
the top bar, the right-hand column, the floating HUD and the menu and view sheets) stays in the game style.

- Actions that change the build are `ore-btn--dark`; `ore-btn--primary` stays for Open a schematic, Export
  and download, Restore and the touch Confirm.
- The desktop picture is framed in `--editor-accent` while a file is open (`canvas.editable`).
- The axis letters are `--axis-x`, `--axis-y` and `--axis-z` on `surface-sunken` (the red letter fails 4.5:1 on
  `surface-panel`; `test/contrast.test.ts` asserts the sunken pairs). `--ink-faint` is for disabled text
  and the search placeholder on `surface-sunken` only.
- The shader and viewport pieces of the Editor group (the compass, selection box and gizmo overlays) are not
  used: the picture is drawn by `packages/render`.

### Where the app differs from the design

- **A chosen toggle segment keeps its 44px height.** The design lowers its face by 4px, which would make
  the touch target 40px tall. `app.css` closes the band and lets the face fill it; the underline is still
  there. The segments also read `aria-pressed` (or the `on` class) where the design reads `aria-checked`
  of a radio group, and each is a tab stop; arrow keys do not move between them.
- **A slider is 44px tall,** with the 28px rail and thumb centred in it.
- **A checkbox row is 44px tall,** though its box is 24px.
- **The format list is the browser's own `<select>`,** drawn as the dropdown's closed control. The list
  that opens is the browser's, with the panel colours on its options, not the design's `ore-dd__menu`.
- **A button can be a `<label>`** around a hidden file input: `app.css` gives it the focus ring (when the
  input has focus) and the disabled face (when the input is disabled).
- **Inside `.ore-editor`, `app.css` keeps the app's controls in step with the flat style:** the toggle
  segment is 44px at rest and pressed, the native `<select>` is the 36px editor dropdown (44px on touch) and
  does not grow when pressed, the touch size stays 48px when pressed, and a pane is as wide as its column.
- **The mobile layout's main actions are 48px** (`ore-btn--touch`); everything else is the design's 44px.
- **Segment, button and dialog colours are the design's in every state;** the known contrast misses
  listed in the design's own rules below (white on `green-hover`, white on `red-hover`) apply to the app too.

## The design system's own rules

These four sections are copied from the design system's `README.md` without changes, except that
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

### Bedrock Editor

The Editor is a dense desktop tool for building worlds. It keeps the Ore palette and square corners but trades the pixel font for Noto Sans, flattens the bevel, and lays out as a menu bar, toolbar, tool rail, side panes, a viewport and a status bar. Use the game components for game screens and the Editor components for the creator tool; do not mix a pixel-font Button into an Editor pane.

- **Flat bevel.** Inside `.ore-editor` (EditorScope, EditorShell and every Editor component) the 4px band is gone: a Button is outline 2, highlight 2, face 36, lowline 2, outline 2 = 44px, and pressing does not drop it. The Dropdown is 36px. The default action is the dark Button (`surface-panel` face, `panel-hi-strong` highlight, `panel-hi` lowline); the safe exit is the light secondary Button with `editor-light-hi` and `editor-light-lo` lines. Slider, checkbox and thumb keep their Ore shapes.
- **Surfaces.** Window and pane bodies `surface-page`; menu bar, status bar and number-field fill `surface-panel`; pane header bar, section header bars, the selected rail tile and the search well `surface-sunken`. Panels are cut by 2px `outline` lines, and groups inside a pane by a 4px groove (2px `groove`, 2px `tab-lo`). Idle icons and disabled labels are `ink-faint`; toolbar labels `light-200`.
- **Layout.** Menu bar 25px under a 2px `outline` line; toolbar 60px; tool rail 48px with a 4px `outline` edge; pane header 33px, section header 36px, number field 42px, search field 44px; status bar 24px under a 4px `outline` line; panes 252px wide by default. The active viewport has a 2px `editor-accent` (orange) frame.
- **Axis colors.** X is `axis-x` (red), Y `axis-y` (green), Z `axis-z` (blue), always as a letter beside the value, never alone.
- **Type.** Noto Sans: `ui` 16 for labels, values and pane titles, `ui-small` 14 for menu items, toolbar labels, status text and help text, `ui-strong` 14 bold for help titles.
- **Help.** A HelpTooltip is a blue card (`blue`, 1px `blue-edge` inside, 1px `outline` outside) with a bold title, one or two sentences and an optional picture slot on top.
- **Viewport.** The hotbar, compass, gizmo and selection box are drawn as original SVG, not the game's art. The hotbar is nine 40px `surface-sunken` tiles over `surface-panel` number strips, the selected one outlined `hotbar-active`. The compass is a ring with +X red, -X dark, +Z blue and -Z white badges in the pure `viewport-x` and `viewport-z` colours. The gizmo is red, green and blue arrows (`viewport-x`, `viewport-y`, `viewport-z`) from a pink `selection-handle-active` origin. The selection box has thick `selection-edge` yellow dashes in front, thin `selection-edge-hidden` orange dashes behind, a `selection-fill` tint inside and `selection-handle` grey corner squares. These components are flat 2D drawings for overlays, docs and tool panels; in a 3D scene reuse the same tokens and dash lengths.
- **Not included.** Block textures and the red boxes in the Editor's own screenshots, which are annotations, not UI. Dark Button hover and pressed faces, toolbar hover, and the exact `selection-fill` tint are inferred or approximate, not measured.
