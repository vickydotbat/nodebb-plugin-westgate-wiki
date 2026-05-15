# Media Cell Styling Design

Date: 2026-05-15

## Summary

Add first-class styling controls for Tiptap wiki media cells. Media cells remain plain by default, but authors can apply one of four supported treatments to selected cells:

- Shadow
- Gilded border
- Custom color pair
- Well mode

The editor also provides Clear Style. Style commands apply to the active media cell by default and to all selected media cells when the author has multi-selected cells.

## Goals

- Let authors style media cells without exposing arbitrary layout or CSS authoring.
- Keep saved HTML explicit, sanitizer-safe, and easy to reopen in Tiptap.
- Support single-cell styling and multi-cell styling in one media row.
- Preserve existing media-row layout behavior, image handling, and add/delete/unwrap commands.
- Match the Westgate visual direction: dark velvet, muted gold accents, restrained depth, and code-block-like wells where requested.

## Non-Goals

- Do not add arbitrary Flexbox/Grid controls.
- Do not make media cell styling row-wide only.
- Do not add bulk structural commands for selected cells in this phase.
- Do not change image layout, captioning, or resize behavior beyond making it coexist with styled cells.
- Do not weaken the client or server sanitizer to preserve unsupported CSS.

## Architecture

Media-cell styling belongs to the custom `mediaRow` and `mediaCell` extension contract, not to generic container blocks.

The `mediaCell` node gains bounded attributes:

- `stylePreset`: empty, `shadow`, `gilded`, `custom`, or `well`
- `backgroundColor`: sanitized color used only by the custom preset
- `borderColor`: sanitized color used only by the custom preset

Saved HTML emits supported classes and custom color styles:

```html
<div class="wiki-media-cell wiki-media-cell--gilded" data-wiki-node="media-cell">
  ...
</div>
```

```html
<div
  class="wiki-media-cell wiki-media-cell--custom"
  data-wiki-node="media-cell"
  style="background-color: #22172d; border-color: #7b617f"
>
  ...
</div>
```

The parser reads existing `wiki-media-cell` wrappers, supported preset classes, and supported custom color styles back into `mediaCell` attrs. Unsupported classes and styles are ignored for this feature.

## Selection Model

Implement a media-cell-specific ProseMirror plugin that tracks selected media-cell positions separately from the document text selection.

Interaction rules:

- Normal click/focus keeps the active media cell as the style target.
- Ctrl-click on Windows/Linux and Cmd-click on macOS toggles a media cell in the style selection.
- Shift-click selects a same-row range of media cells.
- Clicking normal content outside the selected media cells clears multi-selection.
- Decorations mark selected media cells visually in the editor.
- Style commands target all selected cells when the selection set is non-empty; otherwise they target the active cell.

Cell structure commands stay active-cell-based in this phase:

- Add media cell before
- Add media cell after
- Delete media cell
- Unwrap media row
- Delete media row

## Editor Controls

The existing media-row context toolbar gains media-cell style controls when a media cell is active:

- Shadow
- Gilded
- Well
- Color Pair
- Clear Style

Color Pair opens a small color control with:

- Background color
- Border color
- Apply
- Clear Style

For mixed selected cells, preset buttons are active only when every targeted cell shares that preset. Color Pair does not need to show a mixed-state value in this phase; it can show default swatches until the author applies a new pair.

## Styling

Both article CSS and editor CSS style the same persistent classes:

- `wiki-media-cell--shadow`
- `wiki-media-cell--gilded`
- `wiki-media-cell--custom`
- `wiki-media-cell--well`

Editor-only CSS handles:

- Hover and focus affordances
- Multi-selected cell decorations
- Existing empty-cell placeholder labels

Article CSS handles only saved presentation. Plain cells keep the current barebones behavior.

## Sanitizer And Normalization

The existing sanitizer already allows bounded `background-color` and `border-color` style values. This feature should reuse that allowlist and avoid adding layout styles.

Normalization must preserve saved plugin-owned media row and media cell wrappers so styled cells do not reopen as generic container blocks. Legacy media layout normalization may continue to generate plain `wiki-media-cell` wrappers with no style preset.

## Testing

Use test-driven development.

Required automated coverage:

- `mediaCell` parses and renders each preset class.
- `mediaCell` parses and renders custom `background-color` and `border-color`.
- Clear Style removes preset and custom colors.
- Style commands apply to the active cell when no media-cell multi-selection exists.
- Style commands apply to every selected media cell when multi-selection exists.
- Ctrl/Cmd toggle and Shift range selection update media-cell selection state where practical in JSDOM.
- Multi-selection clears when the author clicks outside selected media cells.
- Sanitizer preserves supported custom colors and strips unsupported styles.
- Article and editor CSS contain the persistent preset selectors.
- Vendored Tiptap bundle and CSS match source after rebuild.

Manual/browser validation:

- Two-cell and three-cell media rows.
- Single-cell styling.
- Multi-cell styling.
- Mixed styles in one row.
- Custom background and border colors.
- Clear Style.
- Save, edit, and reopen round trip.
- Desktop and mobile composer checks.

## Implementation Notes

Keep the implementation split across focused files:

- `tiptap/src/extensions/media-row.mjs` for schema attrs and commands.
- A new selection helper/plugin module if the selection state becomes large enough to make `media-row.mjs` hard to read.
- `tiptap/src/selection/media-selection.mjs` for DOM interaction helpers.
- `tiptap/src/wiki-editor-bundle.js` for toolbar wiring only.
- `tiptap/src/wiki-editor.css` for editor styles.
- `public/wiki-article-body.css` for rendered article styles.
- `shared/wiki-html-sanitizer-config.json` only if the current style allowlist proves insufficient.

The core design rule is that toolbar code may expose commands, but it should not become the owner of media-cell schema or sanitizer policy.
