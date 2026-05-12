# Large Table Authoring Redesign

## Context

GitHub issue 52 reports that the current table editing experience breaks down on large wiki tables. The contextual table toolbar is positioned relative to the table and does not remain reachable while authors scroll deep into a table. It can also overlap the main sticky editor toolbar, and the current visual focus/glow treatment can bleed into the toolbar area.

The issue is a symptom of a broader problem: table authoring has been patched incrementally inside `tiptap/src/wiki-editor-bundle.js`. The plugin now needs table editing to become a first-class Westgate wiki subsystem rather than a small wrapper around Tiptap defaults.

This iteration focuses on authoring only. Rendered article reading improvements are intentionally out of scope for this spec.

## Goals

- Make large table editing practical in the wiki compose editor.
- Keep table editing WYSIWYG: authoring-only controls must not make the table look structurally different from saved output.
- Keep Tiptap table schema compatibility for saved content and import/export behavior.
- Move table UI and command behavior into focused Westgate-owned modules.
- Support selected-cell operations across single cells, cell ranges, rows, and columns where Tiptap can represent the selection.
- Make future table operations easy to add through a command registry instead of one-off toolbar code.

## Non-Goals

- Do not redesign rendered wiki article table reading behavior in this iteration.
- Do not replace the persisted table schema with a fully custom non-table node.
- Do not introduce spreadsheet-like row or column header chrome into the table surface.
- Do not expose arbitrary unsafe style editing outside the existing sanitizer and editor contract.

## Architecture

Tiptap remains the document foundation for tables: `Table`, `TableRow`, `TableHeader`, and `TableCell` continue to represent persisted table content. Westgate owns the authoring layer above those primitives.

Add a focused table authoring module under the Tiptap source tree. The exact file split can be refined during planning, but the subsystem should separate these responsibilities:

- table context derivation from editor selection
- table command registry and command execution
- selected-cell style application helpers
- sticky table context row UI
- cell-local popover UI
- table resize and table properties integration

Existing ad hoc helpers in `wiki-editor-bundle.js` should be moved into this subsystem as part of the rewrite. The bundle should wire the subsystem into editor lifecycle events rather than owning table behavior inline.

## Table Context

On editor creation, selection changes, transactions, focus changes, scroll, and resize, derive a normalized table context object:

- active table element and table node position
- active cell element and cell node position
- selected cell node positions
- current selected-cell count
- selected row indexes when derivable
- selected column indexes when derivable
- current table attributes, class names, and styles
- whether structural commands are valid in the current state
- whether formatting commands have an active target

The UI reads this context. Commands receive this context and modify the ProseMirror document through controlled helpers. Direct DOM mutation should be reserved for overlays, positioning, and transient view state.

## Command Model

Create a data-driven table command registry. Each command declares:

- `id`
- `label`
- `icon`
- `group`
- placement: sticky row, cell popover, menu, or future surface
- scope: table, row, column, cell, or selected cells
- enabled-state function
- execute function

The initial command set is:

- table properties
- delete table
- add row before
- add row after
- delete selected or current row
- add column before
- add column after
- delete selected or current column
- merge selected cells
- split cell
- toggle header row
- toggle header column
- background color
- text color
- text alignment
- clear cell formatting

Selected cells should be treated as a normal command target. Formatting commands apply to every selected cell when a range exists and fall back to the active cell otherwise.

## Authoring UX

The main editor toolbar remains sticky.

When the selection is inside a table, a sticky table context row appears directly under the main toolbar. It contains persistent structural table operations and remains reachable while authors edit deep inside large tables. It must account for the main toolbar's height and z-index so the two surfaces do not overlap.

A smaller cell-local popover appears near the active cell or selected range for focused formatting operations such as background color, text color, alignment, and clear formatting. It should avoid covering the active editing area when practical and must reposition on selection, transaction, scroll, and resize.

Multi-cell behavior uses native Tiptap/ProseMirror table selection. This keeps the table surface visually close to the final saved table and avoids adding spreadsheet-like authoring chrome that could mislead authors about output.

## Styling And Sanitization

The rewrite must preserve existing table attributes, layout classes, and supported inline styles where they are already part of the editor and sanitizer contract.

Selected-cell formatting should use the same safe style pathways already supported by the shared sanitizer and server-side validation. New style operations must be added to the sanitizer contract before they are exposed in the UI.

Visual table focus treatment should be revised so glow, outlines, resize handles, and contextual surfaces do not visually bleed over the sticky toolbar area.

## Migration And Compatibility

Existing saved table HTML must continue to load, edit, and save through the supported schema. Legacy normalization for `figure.table`, table captions, table classes, and table styles must not regress.

The current table properties behavior should be preserved as a command in the new registry, not removed. Existing table layout options such as fixed/auto layout and borderless styling should continue to work.

## Testing

Add focused tests for the table authoring subsystem:

- command registry exposes expected commands, scopes, and placements
- table context identifies active table, active cell, and selected cells
- selected-cell background color applies to every selected cell
- selected-cell text color applies to every selected cell
- selected-cell alignment applies to every selected cell
- formatting commands fall back to the active cell when no range is selected
- clear formatting removes supported cell formatting from all selected cells
- row and column structural commands are enabled only when valid
- sticky table context row appears only while selection is inside a table
- cell-local popover appears only when formatting has a valid table target
- popover and sticky row positioning avoid overlap with the main sticky toolbar
- legacy table HTML still imports and saves through the supported schema
- existing table properties, layout classes, and sanitizer behavior continue to pass

Browser validation should include at least one large table deep enough to require vertical scrolling and wide enough to require horizontal scrolling.

## Open Decisions

Implementation planning should decide the exact file split for the table subsystem and whether selected row/column detection should be implemented in the first pass or deferred behind the selected-cell range behavior.
