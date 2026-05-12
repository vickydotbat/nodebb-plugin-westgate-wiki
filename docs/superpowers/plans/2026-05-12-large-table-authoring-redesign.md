# Large Table Authoring Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Westgate-owned table authoring subsystem for large wiki tables, with sticky structural controls, selected-cell formatting, and a cell-local formatting popover.

**Architecture:** Keep Tiptap's table nodes as the persisted document model, but move table authoring behavior out of `wiki-editor-bundle.js` into focused modules under `tiptap/src/table/`. The bundle wires the subsystem into editor lifecycle events; table context, command registry, formatting helpers, sticky toolbar, popover, table view attributes, properties dialog, and resize handles live behind clear module interfaces.

**Tech Stack:** NodeBB plugin, Tiptap 3, ProseMirror tables via `@tiptap/pm/tables`, vanilla DOM UI, CSS in `tiptap/src/wiki-editor.css`, vendored editor bundle built with Vite, Node test scripts.

---

## File Structure

- Create `tiptap/src/table/table-dom.mjs`
  - Shared DOM and ProseMirror position helpers for tables, cells, rows, style/class updates, and context panel positioning.
- Create `tiptap/src/table/table-context.mjs`
  - Derives normalized table context from the editor selection, including active table/cell and selected cell positions.
- Create `tiptap/src/table/table-commands.mjs`
  - Owns command metadata, command registry, selected-cell formatting helpers, and command execution.
- Create `tiptap/src/table/table-properties-dialog.mjs`
  - Moves the existing table properties dialog and property application logic out of the bundle.
- Create `tiptap/src/table/table-view.mjs`
  - Moves `WestgateTableView` and table attribute application out of the bundle.
- Create `tiptap/src/table/table-authoring-ui.mjs`
  - Installs sticky table context row, cell formatting popover, and existing resize handles as one destroyable authoring subsystem.
- Create `tests/wiki-table-authoring.test.mjs`
  - Focused table subsystem tests that do not further bloat `tests/wiki-editor-contract.test.mjs`.
- Modify `tiptap/src/wiki-editor-bundle.js`
  - Import table subsystem modules, remove inline table helpers/UI, and call `createTableAuthoring(editorMount, editor)`.
- Modify `tiptap/src/toolbar/toolbar-schema.mjs`
  - Replace the old contextual table button list with placement-aware table command constants.
- Modify `tiptap/src/wiki-editor.css`
  - Replace floating table toolbar styles with sticky table row and cell popover styles. Keep resize handle styles.
- Modify `tests/wiki-editor-contract.test.mjs`
  - Update contract assertions to point at the new modules and new table authoring UI names.
- Modify `public/vendor/tiptap/wiki-tiptap.bundle.js` and `public/vendor/tiptap/wiki-tiptap.css`
  - Regenerate via `npm run build:tiptap`.

## Task 1: Table DOM Helpers And Table View

**Files:**
- Create: `tiptap/src/table/table-dom.mjs`
- Create: `tiptap/src/table/table-view.mjs`
- Modify: `tests/wiki-table-authoring.test.mjs`

- [ ] **Step 1: Write the failing tests for DOM helpers and table view exports**

Create `tests/wiki-table-authoring.test.mjs` with:

```js
import assert from "node:assert/strict";

import { installJsdomGlobals } from "./helpers/jsdom-setup.mjs";

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === "function") {
      return result.then(function () {
        process.stdout.write(`ok - ${name}\n`);
      });
    }
    process.stdout.write(`ok - ${name}\n`);
  } catch (err) {
    process.stderr.write(`not ok - ${name}\n`);
    throw err;
  }
  return Promise.resolve();
}

installJsdomGlobals();

const [
  tableDomModule,
  tableViewModule
] = await Promise.all([
  import("../tiptap/src/table/table-dom.mjs"),
  import("../tiptap/src/table/table-view.mjs")
]);

const {
  getSelectionElement,
  setClassToken,
  setStyleValue,
  getStyleValue,
  positionContextPanel
} = tableDomModule;
const { WestgateTableView, applyTableNodeAttributesToView } = tableViewModule;

await test("table DOM helpers preserve class tokens and style values", function () {
  assert.equal(setClassToken("one two", "three", true), "one two three");
  assert.equal(setClassToken("one two", "two", false), "one");
  assert.equal(setStyleValue("width: 50%; color: red", "width", "75%"), "width: 75%; color: red");
  assert.equal(setStyleValue("width: 50%; color: red", "color", ""), "width: 50%");
  assert.equal(getStyleValue("width: 50%; color: red", "width"), "50%");
  assert.equal(getStyleValue("width: 50%; color: red", "height"), "");
});

await test("positionContextPanel clamps panel within the editor surface", function () {
  const surface = document.createElement("div");
  const target = document.createElement("div");
  const panel = document.createElement("div");
  Object.defineProperty(surface, "offsetWidth", { value: 600 });
  Object.defineProperty(panel, "offsetWidth", { value: 180 });
  Object.defineProperty(panel, "offsetHeight", { value: 32 });
  surface.getBoundingClientRect = function () {
    return { left: 10, top: 20, width: 600, height: 300, right: 610, bottom: 320 };
  };
  target.getBoundingClientRect = function () {
    return { left: 580, top: 90, width: 80, height: 32, right: 660, bottom: 122 };
  };

  positionContextPanel(panel, target, surface, { avoidTop: 48 });

  assert.equal(panel.style.left, "412px");
  assert.equal(panel.style.top, "40px");
});

await test("table view exports preserve table class and style attributes", function () {
  const table = document.createElement("table");
  applyTableNodeAttributesToView(table, {
    class: "wiki-table-layout-auto",
    style: "width: 50%;"
  });
  assert.equal(table.getAttribute("class"), "wiki-table-layout-auto");
  assert.equal(table.getAttribute("style"), "width: 50%;");
  assert.equal(typeof WestgateTableView, "function");
});

await test("getSelectionElement tolerates missing editor selection DOM", function () {
  assert.equal(getSelectionElement({ view: { domAtPos: function () { return {}; } }, state: { selection: { from: 1 } } }), null);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node tests/wiki-table-authoring.test.mjs
```

Expected: FAIL with `Cannot find module '../tiptap/src/table/table-dom.mjs'`.

- [ ] **Step 3: Create `table-dom.mjs` with shared helpers**

Create `tiptap/src/table/table-dom.mjs`:

```js
export function getSelectionElement(editor) {
  if (!editor || !editor.view || !editor.state || !editor.state.selection) {
    return null;
  }
  const domAtPos = editor.view.domAtPos(editor.state.selection.from);
  const node = domAtPos && domAtPos.node;
  if (!node) {
    return null;
  }
  return node.nodeType === 1 ? node : node.parentElement;
}

export function getActiveTableElement(editor, surface) {
  const selectionElement = getSelectionElement(editor);
  const table = selectionElement && typeof selectionElement.closest === "function" ? selectionElement.closest("table") : null;
  return table && (!surface || surface.contains(table)) ? table : null;
}

export function getActiveTableRowElement(editor, table) {
  const selectionElement = getSelectionElement(editor);
  const row = selectionElement && typeof selectionElement.closest === "function" ? selectionElement.closest("tr") : null;
  return row && table && table.contains(row) ? row : null;
}

export function getActiveTableCellElement(editor, table) {
  const selectionElement = getSelectionElement(editor);
  const cell = selectionElement && typeof selectionElement.closest === "function" ? selectionElement.closest("td, th") : null;
  return cell && table && table.contains(cell) ? cell : null;
}

export function getTableNodePosition(editor, element) {
  if (!editor || !element || !editor.view || typeof editor.view.posAtDOM !== "function") {
    return null;
  }
  const pos = editor.view.posAtDOM(element, 0) - 1;
  return pos >= 0 && editor.state.doc.nodeAt(pos) ? pos : null;
}

export function setStyleValue(styleText, propertyName, value) {
  const probe = document.createElement("div");
  probe.setAttribute("style", String(styleText || ""));
  if (value) {
    probe.style.setProperty(propertyName, value);
  } else {
    probe.style.removeProperty(propertyName);
  }
  return probe.getAttribute("style") || "";
}

export function getStyleValue(styleText, propertyName) {
  const probe = document.createElement("div");
  probe.setAttribute("style", String(styleText || ""));
  return probe.style.getPropertyValue(propertyName).trim();
}

export function setClassToken(className, token, enabled) {
  const tokens = new Set(String(className || "").split(/\s+/).filter(Boolean));
  if (enabled) {
    tokens.add(token);
  } else {
    tokens.delete(token);
  }
  return Array.from(tokens).join(" ");
}

export function updateNodeAttributesAtPos(editor, pos, attrs, options) {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) {
    return false;
  }
  const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
    ...node.attrs,
    ...attrs
  }, node.marks);
  editor.view.dispatch(options && options.scroll === false ? tr : tr.scrollIntoView());
  return true;
}

export function updateNodeStyleAtPos(editor, pos, fallbackStyle, updateStyle, options) {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) {
    return false;
  }
  const style = updateStyle(node.attrs.style || fallbackStyle || "");
  return updateNodeAttributesAtPos(editor, pos, { style: style || null }, options);
}

export function positionContextPanel(panel, targetEl, surface, options) {
  const surfaceRect = surface.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  const panelWidth = panel.offsetWidth || 320;
  const panelHeight = panel.offsetHeight || 40;
  const avoidTop = options && Number.isFinite(options.avoidTop) ? options.avoidTop : 8;
  const left = Math.max(8, Math.min(targetRect.left - surfaceRect.left, surfaceRect.width - panelWidth - 8));
  const preferredTop = targetRect.top - surfaceRect.top - panelHeight - 8;
  const top = Math.max(avoidTop, preferredTop);
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}
```

- [ ] **Step 4: Create `table-view.mjs`**

Create `tiptap/src/table/table-view.mjs`:

```js
import { TableView } from "@tiptap/extension-table";

export function applyTableNodeAttributesToView(table, attrs) {
  if (!table) {
    return;
  }

  const className = String(attrs && attrs.class || "").trim();
  if (className) {
    table.setAttribute("class", className);
  } else {
    table.removeAttribute("class");
  }

  const style = String(attrs && attrs.style || "").trim();
  const minWidth = table.style.minWidth;
  table.setAttribute("style", style);
  if (minWidth && !table.style.minWidth) {
    table.style.minWidth = minWidth;
  }
}

export class WestgateTableView extends TableView {
  constructor(node, cellMinWidth, view) {
    super(node, cellMinWidth, view);
    applyTableNodeAttributesToView(this.table, node.attrs);
  }

  update(node) {
    const updated = super.update(node);
    if (updated) {
      applyTableNodeAttributesToView(this.table, node.attrs);
    }
    return updated;
  }
}
```

- [ ] **Step 5: Run the focused test and verify it passes**

Run:

```bash
node tests/wiki-table-authoring.test.mjs
```

Expected: PASS for the four tests created in this task.

- [ ] **Step 6: Commit**

Run:

```bash
git add tests/wiki-table-authoring.test.mjs tiptap/src/table/table-dom.mjs tiptap/src/table/table-view.mjs
git commit -m "test: add table authoring helper coverage"
```

## Task 2: Table Context Derivation

**Files:**
- Create: `tiptap/src/table/table-context.mjs`
- Modify: `tests/wiki-table-authoring.test.mjs`

- [ ] **Step 1: Add failing context tests**

Append these imports near the top of `tests/wiki-table-authoring.test.mjs`:

```js
const [{ Editor }, StarterKitModule, TableModule, TableCellModule, TableHeaderModule, TableRowModule, tableContextModule, tablesModule] = await Promise.all([
  import("@tiptap/core"),
  import("@tiptap/starter-kit"),
  import("@tiptap/extension-table"),
  import("@tiptap/extension-table-cell"),
  import("@tiptap/extension-table-header"),
  import("@tiptap/extension-table-row"),
  import("../tiptap/src/table/table-context.mjs"),
  import("@tiptap/pm/tables")
]);

const StarterKit = StarterKitModule.default;
const { Table } = TableModule;
const { TableCell } = TableCellModule;
const { TableHeader } = TableHeaderModule;
const { TableRow } = TableRowModule;
const { deriveTableContext } = tableContextModule;
const { CellSelection } = tablesModule;

function createTableEditor(content) {
  const mount = document.createElement("div");
  document.body.appendChild(mount);
  return new Editor({
    element: mount,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: false
      }),
      Table,
      TableRow,
      TableHeader,
      TableCell
    ],
    content
  });
}

function findCellPositions(editor) {
  const positions = [];
  editor.state.doc.descendants(function (node, pos) {
    if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
      positions.push(pos);
    }
  });
  return positions;
}
```

Append these tests:

```js
await test("deriveTableContext reports active table and active cell for a cursor in a table", function () {
  const editor = createTableEditor("<table><tbody><tr><td><p>Alpha</p></td><td><p>Beta</p></td></tr></tbody></table>");
  editor.commands.setTextSelection(5);

  const context = deriveTableContext(editor, editor.view.dom);

  assert.equal(context.isActive, true);
  assert.equal(context.selectedCellCount, 1);
  assert.equal(context.selectedCellPositions.length, 1);
  assert.equal(context.activeTableElement.tagName, "TABLE");
  assert.equal(context.activeCellElement.tagName, "TD");
  editor.destroy();
});

await test("deriveTableContext reports every selected cell in a CellSelection", function () {
  const editor = createTableEditor("<table><tbody><tr><td><p>A1</p></td><td><p>B1</p></td></tr><tr><td><p>A2</p></td><td><p>B2</p></td></tr></tbody></table>");
  const positions = findCellPositions(editor);
  const selection = CellSelection.create(editor.state.doc, positions[0], positions[3]);
  editor.view.dispatch(editor.state.tr.setSelection(selection));

  const context = deriveTableContext(editor, editor.view.dom);

  assert.equal(context.isActive, true);
  assert.equal(context.selectedCellCount, 4);
  assert.deepEqual(context.selectedCellPositions.map(function (entry) { return entry.pos; }), positions);
  editor.destroy();
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node tests/wiki-table-authoring.test.mjs
```

Expected: FAIL with `Cannot find module '../tiptap/src/table/table-context.mjs'`.

- [ ] **Step 3: Create `table-context.mjs`**

Create `tiptap/src/table/table-context.mjs`:

```js
import { CellSelection } from "@tiptap/pm/tables";

import {
  getActiveTableCellElement,
  getActiveTableElement,
  getTableNodePosition
} from "./table-dom.mjs";

function tableNodeRange(editor, tablePos) {
  if (tablePos == null) {
    return null;
  }
  const tableNode = editor.state.doc.nodeAt(tablePos);
  if (!tableNode) {
    return null;
  }
  return {
    from: tablePos,
    to: tablePos + tableNode.nodeSize
  };
}

function collectSelectedCells(editor, activeCellElement, activeTableElement, activeTablePos) {
  const selection = editor.state.selection;
  if (selection instanceof CellSelection) {
    const range = tableNodeRange(editor, activeTablePos);
    const cells = [];
    selection.forEachCell(function (node, pos) {
      if (!range || (pos > range.from && pos < range.to)) {
        cells.push({
          pos,
          node,
          fallbackStyle: node.attrs.style || ""
        });
      }
    });
    return cells;
  }

  const activeCellPos = getTableNodePosition(editor, activeCellElement);
  const activeCellNode = activeCellPos == null ? null : editor.state.doc.nodeAt(activeCellPos);
  if (!activeCellNode || !activeTableElement || !activeCellElement) {
    return [];
  }
  return [{
    pos: activeCellPos,
    node: activeCellNode,
    fallbackStyle: activeCellElement.getAttribute("style") || ""
  }];
}

function deriveSelectedIndexes(activeTableElement, selectedCellPositions, editor) {
  const rowIndexes = new Set();
  const columnIndexes = new Set();
  if (!activeTableElement) {
    return { rowIndexes: [], columnIndexes: [] };
  }

  const selectedPositions = new Set(selectedCellPositions.map(function (entry) {
    return entry.pos;
  }));
  Array.from(activeTableElement.rows || []).forEach(function (row, rowIndex) {
    Array.from(row.cells || []).forEach(function (cell, columnIndex) {
      const pos = getTableNodePosition(editor, cell);
      if (selectedPositions.has(pos)) {
        rowIndexes.add(rowIndex);
        columnIndexes.add(columnIndex);
      }
    });
  });

  return {
    rowIndexes: Array.from(rowIndexes),
    columnIndexes: Array.from(columnIndexes)
  };
}

export function deriveTableContext(editor, surface) {
  const activeTableElement = editor && editor.isActive && editor.isActive("table") ? getActiveTableElement(editor, surface) : null;
  const activeTablePos = activeTableElement ? getTableNodePosition(editor, activeTableElement) : null;
  const activeCellElement = activeTableElement ? getActiveTableCellElement(editor, activeTableElement) : null;
  const activeCellPos = activeCellElement ? getTableNodePosition(editor, activeCellElement) : null;
  const selectedCellPositions = activeTableElement ? collectSelectedCells(editor, activeCellElement, activeTableElement, activeTablePos) : [];
  const indexes = deriveSelectedIndexes(activeTableElement, selectedCellPositions, editor);

  return {
    isActive: !!activeTableElement,
    activeTableElement,
    activeTablePos,
    activeCellElement,
    activeCellPos,
    selectedCellPositions,
    selectedCellCount: selectedCellPositions.length,
    selectedRowIndexes: indexes.rowIndexes,
    selectedColumnIndexes: indexes.columnIndexes,
    tableAttrs: activeTablePos == null ? {} : { ...(editor.state.doc.nodeAt(activeTablePos).attrs || {}) },
    canFormatSelection: selectedCellPositions.length > 0,
    canUseStructuralCommands: !!activeTableElement
  };
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node tests/wiki-table-authoring.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add tests/wiki-table-authoring.test.mjs tiptap/src/table/table-context.mjs
git commit -m "feat: derive wiki table authoring context"
```

## Task 3: Table Command Registry And Selected-Cell Formatting

**Files:**
- Create: `tiptap/src/table/table-commands.mjs`
- Modify: `tiptap/src/toolbar/toolbar-schema.mjs`
- Modify: `tests/wiki-table-authoring.test.mjs`

- [ ] **Step 1: Add failing command registry and formatting tests**

Append this import near the existing dynamic imports:

```js
const tableCommandsModule = await import("../tiptap/src/table/table-commands.mjs");
const {
  TABLE_COMMANDS,
  TABLE_COMMAND_IDS,
  TABLE_STICKY_COMMAND_IDS,
  TABLE_CELL_POPOVER_COMMAND_IDS,
  executeTableCommand
} = tableCommandsModule;
```

Append these tests:

```js
await test("table command registry exposes structural and cell formatting placements", function () {
  assert.deepEqual(TABLE_STICKY_COMMAND_IDS, [
    "table-properties",
    "table-add-row-before",
    "table-add-row-after",
    "table-delete-row",
    "table-add-column-before",
    "table-add-column-after",
    "table-delete-column",
    "table-merge-cells",
    "table-split-cell",
    "table-toggle-header-row",
    "table-toggle-header-column",
    "table-delete"
  ]);
  assert.deepEqual(TABLE_CELL_POPOVER_COMMAND_IDS, [
    "table-cell-background",
    "table-cell-text-color",
    "table-cell-align-left",
    "table-cell-align-center",
    "table-cell-align-right",
    "table-cell-clear-formatting"
  ]);
  assert.equal(TABLE_COMMANDS.every(function (command) {
    return TABLE_COMMAND_IDS.includes(command.id) && command.label && command.scope && command.placement;
  }), true);
});

await test("selected-cell background command applies to every selected cell", function () {
  const editor = createTableEditor("<table><tbody><tr><td><p>A1</p></td><td><p>B1</p></td></tr><tr><td><p>A2</p></td><td><p>B2</p></td></tr></tbody></table>");
  const positions = findCellPositions(editor);
  editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, positions[0], positions[3])));
  const context = deriveTableContext(editor, editor.view.dom);

  assert.equal(executeTableCommand(editor, context, "table-cell-background", { value: "#dbeafe" }), true);
  const html = editor.getHTML();
  assert.equal((html.match(/background-color: rgb\(219, 234, 254\)/g) || []).length, 4);
  editor.destroy();
});

await test("selected-cell clear formatting removes supported cell styles", function () {
  const editor = createTableEditor('<table><tbody><tr><td style="background-color:#dbeafe;color:#111827;text-align:center"><p>A1</p></td><td style="background-color:#dbeafe;color:#111827;text-align:center"><p>B1</p></td></tr></tbody></table>');
  const positions = findCellPositions(editor);
  editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, positions[0], positions[1])));
  const context = deriveTableContext(editor, editor.view.dom);

  assert.equal(executeTableCommand(editor, context, "table-cell-clear-formatting"), true);
  const html = editor.getHTML();
  assert.doesNotMatch(html, /background-color/);
  assert.doesNotMatch(html, /text-align/);
  assert.doesNotMatch(html, /color:/);
  editor.destroy();
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
node tests/wiki-table-authoring.test.mjs
```

Expected: FAIL with `Cannot find module '../tiptap/src/table/table-commands.mjs'`.

- [ ] **Step 3: Create `table-commands.mjs`**

Create `tiptap/src/table/table-commands.mjs`:

```js
import { getReadableTextColor } from "../shared/color-contrast.mjs";
import { setStyleValue } from "./table-dom.mjs";

export const TABLE_COMMANDS = [
  { id: "table-properties", label: "Table properties", icon: "fa-sliders", group: "table", placement: "sticky", scope: "table" },
  { id: "table-add-row-before", label: "Insert row before", icon: "fa-plus", badge: "R+", group: "rows", placement: "sticky", scope: "row" },
  { id: "table-add-row-after", label: "Insert row after", icon: "fa-plus", badge: "+R", group: "rows", placement: "sticky", scope: "row" },
  { id: "table-delete-row", label: "Delete current row", icon: "fa-minus", badge: "R", group: "rows", placement: "sticky", scope: "row" },
  { id: "table-add-column-before", label: "Insert column before", icon: "fa-plus", badge: "C+", group: "columns", placement: "sticky", scope: "column" },
  { id: "table-add-column-after", label: "Insert column after", icon: "fa-plus", badge: "+C", group: "columns", placement: "sticky", scope: "column" },
  { id: "table-delete-column", label: "Delete current column", icon: "fa-minus", badge: "C", group: "columns", placement: "sticky", scope: "column" },
  { id: "table-merge-cells", label: "Merge selected cells", icon: "fa-compress", group: "cells", placement: "sticky", scope: "selected-cells" },
  { id: "table-split-cell", label: "Split selected cell", icon: "fa-expand", group: "cells", placement: "sticky", scope: "cell" },
  { id: "table-toggle-header-row", label: "Toggle header row", icon: "fa-header", badge: "R", group: "headers", placement: "sticky", scope: "row" },
  { id: "table-toggle-header-column", label: "Toggle header column", icon: "fa-header", badge: "C", group: "headers", placement: "sticky", scope: "column" },
  { id: "table-delete", label: "Delete table", icon: "fa-trash", group: "danger", placement: "sticky", scope: "table" },
  { id: "table-cell-background", label: "Cell background", icon: "fa-square", group: "format", placement: "cell-popover", scope: "selected-cells" },
  { id: "table-cell-text-color", label: "Cell text color", icon: "fa-font", group: "format", placement: "cell-popover", scope: "selected-cells" },
  { id: "table-cell-align-left", label: "Align cell left", icon: "fa-align-left", group: "alignment", placement: "cell-popover", scope: "selected-cells" },
  { id: "table-cell-align-center", label: "Align cell center", icon: "fa-align-center", group: "alignment", placement: "cell-popover", scope: "selected-cells" },
  { id: "table-cell-align-right", label: "Align cell right", icon: "fa-align-right", group: "alignment", placement: "cell-popover", scope: "selected-cells" },
  { id: "table-cell-clear-formatting", label: "Clear cell formatting", icon: "fa-eraser", group: "format", placement: "cell-popover", scope: "selected-cells" }
];

export const TABLE_COMMAND_IDS = TABLE_COMMANDS.map(function (command) {
  return command.id;
});

export const TABLE_STICKY_COMMAND_IDS = TABLE_COMMANDS.filter(function (command) {
  return command.placement === "sticky";
}).map(function (command) {
  return command.id;
});

export const TABLE_CELL_POPOVER_COMMAND_IDS = TABLE_COMMANDS.filter(function (command) {
  return command.placement === "cell-popover";
}).map(function (command) {
  return command.id;
});

export function getTableCommand(id) {
  return TABLE_COMMANDS.find(function (command) {
    return command.id === id;
  }) || null;
}

export function isTableCommandEnabled(editor, context, id) {
  if (!context || !context.isActive) {
    return false;
  }
  if (/^table-cell-/.test(id)) {
    return context.canFormatSelection;
  }
  const chain = editor.can && editor.can().chain().focus();
  if (!chain) {
    return true;
  }
  const commandChecks = {
    "table-add-row-before": "addRowBefore",
    "table-add-row-after": "addRowAfter",
    "table-delete-row": "deleteRow",
    "table-add-column-before": "addColumnBefore",
    "table-add-column-after": "addColumnAfter",
    "table-delete-column": "deleteColumn",
    "table-merge-cells": "mergeCells",
    "table-split-cell": "splitCell",
    "table-toggle-header-row": "toggleHeaderRow",
    "table-toggle-header-column": "toggleHeaderColumn",
    "table-delete": "deleteTable"
  };
  const method = commandChecks[id];
  return !method || (typeof chain[method] === "function" && chain[method]().run());
}

function applyStyleToSelectedCells(editor, context, updateStyle) {
  if (!context || !context.selectedCellPositions.length) {
    return false;
  }
  let tr = editor.state.tr;
  let changed = false;
  context.selectedCellPositions.forEach(function ({ pos, fallbackStyle }) {
    const node = editor.state.doc.nodeAt(pos);
    if (!node) {
      return;
    }
    const style = updateStyle(node.attrs.style || fallbackStyle || "");
    tr = tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      style: style || null
    }, node.marks);
    changed = true;
  });
  if (changed) {
    editor.view.dispatch(tr.scrollIntoView());
  }
  return changed;
}

export function executeTableCommand(editor, context, id, payload) {
  if (!isTableCommandEnabled(editor, context, id)) {
    return false;
  }

  const value = payload && payload.value ? String(payload.value).trim() : "";
  if (id === "table-cell-background") {
    const textColor = getReadableTextColor(value);
    return applyStyleToSelectedCells(editor, context, function (style) {
      return setStyleValue(setStyleValue(style, "background-color", value), "color", textColor);
    });
  }
  if (id === "table-cell-text-color") {
    return applyStyleToSelectedCells(editor, context, function (style) {
      return setStyleValue(style, "color", value);
    });
  }
  if (id === "table-cell-align-left" || id === "table-cell-align-center" || id === "table-cell-align-right") {
    const align = id.replace("table-cell-align-", "");
    return applyStyleToSelectedCells(editor, context, function (style) {
      return setStyleValue(style, "text-align", align);
    });
  }
  if (id === "table-cell-clear-formatting") {
    return applyStyleToSelectedCells(editor, context, function (style) {
      return ["background-color", "color", "text-align"].reduce(function (nextStyle, propertyName) {
        return setStyleValue(nextStyle, propertyName, "");
      }, style);
    });
  }

  const chain = editor.chain().focus();
  const commandExecutors = {
    "table-add-row-before": function () { return chain.addRowBefore().run(); },
    "table-add-row-after": function () { return chain.addRowAfter().run(); },
    "table-delete-row": function () { return chain.deleteRow().run(); },
    "table-add-column-before": function () { return chain.addColumnBefore().run(); },
    "table-add-column-after": function () { return chain.addColumnAfter().run(); },
    "table-delete-column": function () { return chain.deleteColumn().run(); },
    "table-merge-cells": function () { return chain.mergeCells().run(); },
    "table-split-cell": function () { return chain.splitCell().run(); },
    "table-toggle-header-row": function () { return chain.toggleHeaderRow().run(); },
    "table-toggle-header-column": function () { return chain.toggleHeaderColumn().run(); },
    "table-delete": function () { return chain.deleteTable().run(); }
  };
  return commandExecutors[id] ? commandExecutors[id]() : false;
}
```

- [ ] **Step 4: Update toolbar schema exports**

Modify `tiptap/src/toolbar/toolbar-schema.mjs`:

```js
import {
  TABLE_CELL_POPOVER_COMMAND_IDS,
  TABLE_COMMAND_IDS,
  TABLE_STICKY_COMMAND_IDS
} from "../table/table-commands.mjs";

export const TOP_TOOLBAR_GROUPS = [
  // keep existing group array unchanged
];

export const TOP_TOOLBAR_BUTTON_IDS = TOP_TOOLBAR_GROUPS.flatMap(function (group) {
  return group.buttonIds;
});

export const IMAGE_CONTEXT_BUTTON_IDS = [
  "image-align-center",
  "image-align-left",
  "image-align-right",
  "image-align-side",
  "image-size-sm",
  "image-size-md",
  "image-size-lg",
  "image-size-full",
  "image-convert-figure"
];

export {
  TABLE_CELL_POPOVER_COMMAND_IDS,
  TABLE_COMMAND_IDS,
  TABLE_STICKY_COMMAND_IDS
};

export const TABLE_CONTEXT_BUTTON_IDS = TABLE_STICKY_COMMAND_IDS;

export function isImageContextButton(id) {
  return IMAGE_CONTEXT_BUTTON_IDS.includes(id);
}
```

Keep the existing `TOP_TOOLBAR_GROUPS` content exactly as it is today.

- [ ] **Step 5: Run focused tests**

Run:

```bash
node tests/wiki-table-authoring.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add tests/wiki-table-authoring.test.mjs tiptap/src/table/table-commands.mjs tiptap/src/toolbar/toolbar-schema.mjs
git commit -m "feat: add wiki table command registry"
```

## Task 4: Table Properties Dialog Module

**Files:**
- Create: `tiptap/src/table/table-properties-dialog.mjs`
- Modify: `tiptap/src/table/table-commands.mjs`
- Modify: `tests/wiki-table-authoring.test.mjs`

- [ ] **Step 1: Add failing table properties preservation test**

Append this import:

```js
const tablePropertiesModule = await import("../tiptap/src/table/table-properties-dialog.mjs");
const { applyActiveTableProperties } = tablePropertiesModule;
```

Append this test:

```js
await test("applyActiveTableProperties preserves table width, layout, borders, column width, and row height", function () {
  const editor = createTableEditor("<table><tbody><tr><td><p>A1</p></td><td><p>B1</p></td></tr></tbody></table>");
  editor.commands.setTextSelection(5);
  const context = deriveTableContext(editor, editor.view.dom);

  assert.equal(applyActiveTableProperties(editor, context, {
    tableWidth: "50%",
    columnWidth: "12rem",
    rowHeight: "3rem",
    borderColor: "#caa55a",
    layout: "auto",
    borderMode: "hidden"
  }), true);

  const html = editor.getHTML();
  assert.match(html, /<table[^>]*class="wiki-table-borderless wiki-table-layout-auto"/);
  assert.match(html, /width: 50%/);
  assert.match(html, /border-color: rgb\(202, 165, 90\)/);
  assert.match(html, /<tr style="height: 3rem;?">/);
  assert.match(html, /<td[^>]*style="width: 12rem;?"/);
  editor.destroy();
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
node tests/wiki-table-authoring.test.mjs
```

Expected: FAIL with `Cannot find module '../tiptap/src/table/table-properties-dialog.mjs'`.

- [ ] **Step 3: Create `table-properties-dialog.mjs`**

Move the existing dialog and property application logic from `wiki-editor-bundle.js` into `tiptap/src/table/table-properties-dialog.mjs`:

```js
import {
  getActiveTableRowElement,
  getStyleValue,
  getTableNodePosition,
  setClassToken,
  setStyleValue,
  updateNodeAttributesAtPos,
  updateNodeStyleAtPos
} from "./table-dom.mjs";

function createDialogField(labelText, input) {
  const label = document.createElement("label");
  label.className = "wiki-editor-dialog__field";
  const text = document.createElement("span");
  text.textContent = labelText;
  label.appendChild(text);
  label.appendChild(input);
  return label;
}

function getTableColumnCellPositions(editor, table, columnIndex) {
  if (!table || columnIndex < 0) {
    return [];
  }
  return Array.from(table.rows || []).map(function (row) {
    const cell = row.cells && row.cells[columnIndex] ? row.cells[columnIndex] : null;
    if (!cell) {
      return null;
    }
    const pos = getTableNodePosition(editor, cell);
    return pos == null ? null : { pos, fallbackStyle: cell.getAttribute("style") || "" };
  }).filter(Boolean);
}

function applyStyleToTableColumnCells(editor, cellPositions, propertyName, value) {
  if (!cellPositions.length) {
    return false;
  }
  let tr = editor.state.tr;
  let changed = false;
  cellPositions.forEach(function ({ pos, fallbackStyle }) {
    const node = editor.state.doc.nodeAt(pos);
    if (!node) {
      return;
    }
    const style = setStyleValue(node.attrs.style || fallbackStyle || "", propertyName, value);
    tr = tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      style: style || null
    }, node.marks);
    changed = true;
  });
  if (changed) {
    editor.view.dispatch(tr.scrollIntoView());
  }
  return changed;
}

export function applyActiveTableProperties(editor, context, values) {
  if (!editor || !context || !context.activeTableElement || context.activeTablePos == null) {
    return false;
  }

  const table = context.activeTableElement;
  const activeCell = context.activeCellElement;
  const columnCellPositions = activeCell ? getTableColumnCellPositions(editor, table, activeCell.cellIndex) : [];
  const activeRow = getActiveTableRowElement(editor, table);
  const rowPos = activeRow ? getTableNodePosition(editor, activeRow) : null;
  const rowFallbackStyle = activeRow ? activeRow.getAttribute("style") || "" : "";
  let style = table.getAttribute("style") || "";
  style = setStyleValue(style, "width", values.tableWidth);
  style = setStyleValue(style, "border-color", values.borderColor);
  let className = setClassToken(table.getAttribute("class") || "", "wiki-table-borderless", values.borderMode === "hidden");
  className = setClassToken(className, "wiki-table-layout-auto", values.layout === "auto");
  className = setClassToken(className, "wiki-table-layout-fixed", values.layout !== "auto");

  updateNodeAttributesAtPos(editor, context.activeTablePos, {
    class: className || null,
    style: style || null
  });

  if (values.columnWidth) {
    applyStyleToTableColumnCells(editor, columnCellPositions, "width", values.columnWidth);
  }

  if (values.rowHeight && rowPos != null) {
    updateNodeStyleAtPos(editor, rowPos, rowFallbackStyle, function (rowStyle) {
      return setStyleValue(rowStyle, "height", values.rowHeight);
    });
  }

  return true;
}

export function openTablePropertiesDialog({ editor, context }) {
  const existing = document.querySelector(".wiki-editor-entity-dialog-shell");
  if (existing) {
    existing.remove();
  }

  const shell = document.createElement("div");
  shell.className = "wiki-editor-entity-dialog-shell";
  const dialog = document.createElement("div");
  dialog.className = "wiki-editor-entity-dialog wiki-editor-table-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "Table properties");
  shell.appendChild(dialog);

  const title = document.createElement("h2");
  title.className = "wiki-editor-entity-dialog__title";
  title.textContent = "Table properties";
  dialog.appendChild(title);

  const form = document.createElement("form");
  form.className = "wiki-editor-entity-dialog__form";
  dialog.appendChild(form);

  const attrs = context.tableAttrs || {};
  const tableWidth = document.createElement("input");
  tableWidth.className = "form-control form-control-sm";
  tableWidth.placeholder = "100%, 32rem, auto";
  tableWidth.value = getStyleValue(attrs.style, "width") || "100%";
  form.appendChild(createDialogField("Table width", tableWidth));

  const columnWidth = document.createElement("input");
  columnWidth.className = "form-control form-control-sm";
  columnWidth.placeholder = "12rem, 160px, 25%";
  form.appendChild(createDialogField("Current column width", columnWidth));

  const rowHeight = document.createElement("input");
  rowHeight.className = "form-control form-control-sm";
  rowHeight.placeholder = "3rem, 48px";
  form.appendChild(createDialogField("Current row height", rowHeight));

  const borderColor = document.createElement("input");
  borderColor.type = "color";
  borderColor.className = "form-control form-control-color";
  borderColor.value = "#caa55a";
  form.appendChild(createDialogField("Border color", borderColor));

  const layout = document.createElement("select");
  layout.className = "form-select form-select-sm";
  [["fixed", "Fixed layout"], ["auto", "Auto layout"]].forEach(function ([value, label]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    layout.appendChild(option);
  });
  layout.value = String(attrs.class || "").includes("wiki-table-layout-auto") ? "auto" : "fixed";
  form.appendChild(createDialogField("Layout", layout));

  const borderMode = document.createElement("select");
  borderMode.className = "form-select form-select-sm";
  [["visible", "Visible borders"], ["hidden", "No visible borders"]].forEach(function ([value, label]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    borderMode.appendChild(option);
  });
  borderMode.value = String(attrs.class || "").includes("wiki-table-borderless") ? "hidden" : "visible";
  form.appendChild(createDialogField("Borders", borderMode));

  const actions = document.createElement("div");
  actions.className = "wiki-editor-entity-dialog__actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn btn-link btn-sm";
  cancel.textContent = "Cancel";
  const apply = document.createElement("button");
  apply.type = "submit";
  apply.className = "btn btn-primary btn-sm";
  apply.textContent = "Apply";
  actions.appendChild(cancel);
  actions.appendChild(apply);
  form.appendChild(actions);

  function close() {
    shell.remove();
    editor.commands.focus();
  }

  cancel.addEventListener("click", close);
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    applyActiveTableProperties(editor, context, {
      tableWidth: tableWidth.value.trim(),
      columnWidth: columnWidth.value.trim(),
      rowHeight: rowHeight.value.trim(),
      borderColor: borderColor.value,
      layout: layout.value,
      borderMode: borderMode.value
    });
    close();
  });

  document.body.appendChild(shell);
  tableWidth.focus();
}
```

- [ ] **Step 4: Wire table properties command to the module**

In `tiptap/src/table/table-commands.mjs`, add:

```js
import { openTablePropertiesDialog } from "./table-properties-dialog.mjs";
```

At the start of `executeTableCommand`, after the enabled check, add:

```js
if (id === "table-properties") {
  openTablePropertiesDialog({ editor, context });
  return true;
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
node tests/wiki-table-authoring.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add tests/wiki-table-authoring.test.mjs tiptap/src/table/table-properties-dialog.mjs tiptap/src/table/table-commands.mjs
git commit -m "feat: move table properties into authoring module"
```

## Task 5: Sticky Toolbar, Cell Popover, And Resize UI Module

**Files:**
- Create: `tiptap/src/table/table-authoring-ui.mjs`
- Modify: `tiptap/src/wiki-editor.css`
- Modify: `tests/wiki-table-authoring.test.mjs`

- [ ] **Step 1: Add failing UI tests**

Append this import:

```js
const tableAuthoringUiModule = await import("../tiptap/src/table/table-authoring-ui.mjs");
const { createTableAuthoring } = tableAuthoringUiModule;
```

Append this test:

```js
await test("createTableAuthoring installs sticky table row and cell popover surfaces", function () {
  const editor = createTableEditor("<table><tbody><tr><td><p>A1</p></td><td><p>B1</p></td></tr></tbody></table>");
  const surface = editor.view.dom;
  const authoring = createTableAuthoring(surface, editor);

  editor.commands.setTextSelection(5);
  editor.view.dispatch(editor.state.tr.scrollIntoView());

  const sticky = surface.querySelector(".wiki-editor-table-sticky-row");
  const popover = surface.querySelector(".wiki-editor-table-cell-popover");
  assert(sticky, "sticky table row should be installed");
  assert(popover, "cell popover should be installed");
  assert.equal(sticky.hidden, false);
  assert.equal(popover.hidden, false);
  assert.match(sticky.textContent, /Table properties/);
  assert.match(popover.textContent, /Cell background/);

  authoring.destroy();
  assert.equal(surface.querySelector(".wiki-editor-table-sticky-row"), null);
  assert.equal(surface.querySelector(".wiki-editor-table-cell-popover"), null);
  editor.destroy();
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
node tests/wiki-table-authoring.test.mjs
```

Expected: FAIL with `Cannot find module '../tiptap/src/table/table-authoring-ui.mjs'`.

- [ ] **Step 3: Create `table-authoring-ui.mjs`**

Create `tiptap/src/table/table-authoring-ui.mjs`:

```js
import { TABLE_CELL_POPOVER_COMMAND_IDS, TABLE_STICKY_COMMAND_IDS, executeTableCommand, getTableCommand, isTableCommandEnabled } from "./table-commands.mjs";
import { deriveTableContext } from "./table-context.mjs";
import { getTableNodePosition, positionContextPanel, setStyleValue, updateNodeStyleAtPos } from "./table-dom.mjs";

function createCommandButton(command, editor, getContext) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-outline-secondary btn-sm wiki-editor-toolbar__button";
  button.setAttribute("title", command.label);
  button.setAttribute("aria-label", command.label);
  button.setAttribute("data-table-command-id", command.id);

  const icon = document.createElement("i");
  icon.className = `fa ${command.icon || "fa-circle"} wiki-editor-toolbar__icon`;
  icon.setAttribute("aria-hidden", "true");
  button.appendChild(icon);

  if (command.badge) {
    const badge = document.createElement("span");
    badge.className = "wiki-editor-toolbar__icon-badge";
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = command.badge;
    button.appendChild(badge);
  }

  button.addEventListener("click", function (event) {
    event.preventDefault();
    const context = getContext();
    executeTableCommand(editor, context, command.id, { value: button.getAttribute("data-command-value") || "" });
  });
  return button;
}

function appendGroupedButtons(container, ids, editor, getContext) {
  const groups = new Map();
  ids.forEach(function (id) {
    const command = getTableCommand(id);
    if (!command) {
      return;
    }
    if (!groups.has(command.group)) {
      const group = document.createElement("div");
      group.className = "wiki-editor-context-tools__group";
      groups.set(command.group, group);
      container.appendChild(group);
    }
    groups.get(command.group).appendChild(createCommandButton(command, editor, getContext));
  });
}

function createColorInput(commandId, label, editor, getContext) {
  const wrap = document.createElement("label");
  wrap.className = "wiki-editor-table-cell-popover__color";
  wrap.setAttribute("title", label);

  const text = document.createElement("span");
  text.className = "visually-hidden";
  text.textContent = label;
  wrap.appendChild(text);

  const input = document.createElement("input");
  input.type = "color";
  input.value = commandId === "table-cell-background" ? "#dbeafe" : "#111827";
  input.setAttribute("aria-label", label);
  input.addEventListener("change", function () {
    executeTableCommand(editor, getContext(), commandId, { value: input.value });
  });
  wrap.appendChild(input);
  return wrap;
}

function createStickyRow(editor, getContext) {
  const row = document.createElement("div");
  row.className = "wiki-editor-table-sticky-row";
  row.setAttribute("role", "toolbar");
  row.setAttribute("aria-label", "Table tools");
  row.hidden = true;
  appendGroupedButtons(row, TABLE_STICKY_COMMAND_IDS, editor, getContext);
  return row;
}

function createCellPopover(editor, getContext) {
  const popover = document.createElement("div");
  popover.className = "wiki-editor-context-tools wiki-editor-table-cell-popover";
  popover.setAttribute("role", "toolbar");
  popover.setAttribute("aria-label", "Selected cell formatting");
  popover.hidden = true;
  popover.appendChild(createColorInput("table-cell-background", "Cell background", editor, getContext));
  popover.appendChild(createColorInput("table-cell-text-color", "Cell text color", editor, getContext));
  appendGroupedButtons(popover, TABLE_CELL_POPOVER_COMMAND_IDS.filter(function (id) {
    return id !== "table-cell-background" && id !== "table-cell-text-color";
  }), editor, getContext);
  return popover;
}

function createTableResizeHandle(className, label) {
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = className;
  handle.setAttribute("aria-label", label);
  handle.setAttribute("title", label);
  handle.hidden = true;
  return handle;
}

function setResizeHandleRect(handle, surfaceRect, targetRect, mode) {
  if (mode === "table-width") {
    handle.style.left = `${Math.max(0, targetRect.right - surfaceRect.left - 5)}px`;
    handle.style.top = `${Math.max(0, targetRect.top - surfaceRect.top)}px`;
    handle.style.height = `${Math.max(12, targetRect.height)}px`;
    handle.style.width = "10px";
    return;
  }
  handle.style.left = `${Math.max(0, targetRect.left - surfaceRect.left)}px`;
  handle.style.top = `${Math.max(0, targetRect.bottom - surfaceRect.top - 5)}px`;
  handle.style.width = `${Math.max(12, targetRect.width)}px`;
  handle.style.height = "10px";
}

export function createTableAuthoring(surface, editor) {
  let context = deriveTableContext(editor, surface);
  const stickyRow = createStickyRow(editor, function () { return context; });
  const cellPopover = createCellPopover(editor, function () { return context; });
  const tableWidthHandle = createTableResizeHandle("wiki-editor-table-resize-handle wiki-editor-table-resize-handle--width", "Resize table width");
  const rowHandleLayer = document.createElement("div");
  rowHandleLayer.className = "wiki-editor-table-row-resize-layer";
  rowHandleLayer.hidden = true;
  let dragging = null;

  surface.prepend(stickyRow);
  surface.appendChild(cellPopover);
  surface.appendChild(tableWidthHandle);
  surface.appendChild(rowHandleLayer);

  function clearRowHandles() {
    rowHandleLayer.innerHTML = "";
  }

  function finishDrag() {
    if (!dragging) {
      return;
    }
    window.removeEventListener("mousemove", dragMove);
    window.removeEventListener("mouseup", finishDrag);
    document.body.classList.remove("wiki-editor-table-resizing");
    dragging = null;
    sync();
  }

  function dragMove(event) {
    if (!dragging) {
      return;
    }
    event.preventDefault();
    if (dragging.type === "table-width") {
      const width = Math.max(96, Math.round(dragging.startWidth + event.clientX - dragging.startX));
      updateNodeStyleAtPos(editor, dragging.pos, dragging.fallbackStyle, function (style) {
        return setStyleValue(style, "width", `${width}px`);
      }, { scroll: false });
      return;
    }
    const height = Math.max(24, Math.round(dragging.startHeight + event.clientY - dragging.startY));
    updateNodeStyleAtPos(editor, dragging.pos, dragging.fallbackStyle, function (style) {
      return setStyleValue(style, "height", `${height}px`);
    }, { scroll: false });
  }

  function startDrag(event, target, type) {
    const pos = getTableNodePosition(editor, target);
    if (pos == null) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const rect = target.getBoundingClientRect();
    dragging = {
      type,
      pos,
      fallbackStyle: target.getAttribute("style") || "",
      startX: event.clientX,
      startY: event.clientY,
      startWidth: rect.width,
      startHeight: rect.height
    };
    document.body.classList.add("wiki-editor-table-resizing");
    window.addEventListener("mousemove", dragMove);
    window.addEventListener("mouseup", finishDrag);
  }

  tableWidthHandle.addEventListener("mousedown", function (event) {
    if (context.activeTableElement) {
      startDrag(event, context.activeTableElement, "table-width");
    }
  });

  function updateButtons(root) {
    root.querySelectorAll("[data-table-command-id]").forEach(function (button) {
      button.disabled = !isTableCommandEnabled(editor, context, button.getAttribute("data-table-command-id"));
    });
  }

  function syncResizeHandles() {
    tableWidthHandle.hidden = !context.isActive;
    rowHandleLayer.hidden = !context.isActive;
    clearRowHandles();
    if (!context.isActive || !context.activeTableElement) {
      return;
    }
    const surfaceRect = surface.getBoundingClientRect();
    const tableRect = context.activeTableElement.getBoundingClientRect();
    setResizeHandleRect(tableWidthHandle, surfaceRect, tableRect, "table-width");
    Array.from(context.activeTableElement.rows || []).forEach(function (row, index) {
      const rowHandle = createTableResizeHandle("wiki-editor-table-resize-handle wiki-editor-table-resize-handle--row", `Resize row ${index + 1} height`);
      setResizeHandleRect(rowHandle, surfaceRect, row.getBoundingClientRect(), "row-height");
      rowHandle.addEventListener("mousedown", function (event) {
        startDrag(event, row, "row-height");
      });
      rowHandle.hidden = false;
      rowHandleLayer.appendChild(rowHandle);
    });
  }

  function sync() {
    context = deriveTableContext(editor, surface);
    stickyRow.hidden = !context.isActive;
    cellPopover.hidden = !context.canFormatSelection;
    updateButtons(stickyRow);
    updateButtons(cellPopover);
    if (context.canFormatSelection && context.activeCellElement) {
      positionContextPanel(cellPopover, context.activeCellElement, surface, { avoidTop: stickyRow.offsetHeight || 48 });
    }
    syncResizeHandles();
  }

  editor.on("create", sync);
  editor.on("selectionUpdate", sync);
  editor.on("transaction", sync);
  editor.on("focus", sync);
  editor.on("blur", sync);
  window.addEventListener("resize", sync);
  surface.addEventListener("scroll", sync);
  sync();

  return {
    destroy: function () {
      finishDrag();
      editor.off("create", sync);
      editor.off("selectionUpdate", sync);
      editor.off("transaction", sync);
      editor.off("focus", sync);
      editor.off("blur", sync);
      window.removeEventListener("resize", sync);
      surface.removeEventListener("scroll", sync);
      [stickyRow, cellPopover, tableWidthHandle, rowHandleLayer].forEach(function (element) {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      });
    }
  };
}
```

- [ ] **Step 4: Add CSS for the new surfaces**

Modify `tiptap/src/wiki-editor.css` by adding these rules near the existing context tool styles:

```css
.westgate-wiki-compose .wiki-editor-table-sticky-row {
  position: sticky;
  top: calc(var(--wiki-compose-toolbar-sticky-top, 0.75rem) + var(--wiki-editor-main-toolbar-height, 0px));
  z-index: 8;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
  border: 1px solid var(--wiki-editor-toolbar-border, var(--bs-border-color, #dee2e6));
  border-radius: var(--bs-border-radius, 0.5rem);
  background: var(--wiki-editor-toolbar-background, var(--bs-tertiary-bg, #f8f9fa));
  margin: 0.45rem 0.75rem;
  padding: 0.45rem;
  box-shadow: 0 0.35rem 0.9rem rgba(0, 0, 0, 0.12);
}

.westgate-wiki-compose .wiki-editor-table-sticky-row[hidden] {
  display: none;
}

.westgate-wiki-compose .wiki-editor-table-cell-popover {
  z-index: 10;
}

.westgate-wiki-compose .wiki-editor-table-cell-popover__color {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  border: 1px solid var(--wiki-editor-toolbar-border, var(--bs-border-color, #dee2e6));
  border-radius: var(--bs-border-radius-sm, 0.25rem);
  background: var(--bs-body-bg, #fff);
}

.westgate-wiki-compose .wiki-editor-table-cell-popover__color input {
  width: 1.35rem;
  height: 1.35rem;
  border: 0;
  padding: 0;
  background: transparent;
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
node tests/wiki-table-authoring.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add tests/wiki-table-authoring.test.mjs tiptap/src/table/table-authoring-ui.mjs tiptap/src/wiki-editor.css
git commit -m "feat: add large-table authoring UI"
```

## Task 6: Bundle Integration And Inline Table Code Removal

**Files:**
- Modify: `tiptap/src/wiki-editor-bundle.js`
- Modify: `tests/wiki-editor-contract.test.mjs`
- Modify: `tests/wiki-table-authoring.test.mjs`

- [ ] **Step 1: Add failing integration assertions**

In `tests/wiki-editor-contract.test.mjs`, update the table styles test so the source assertions become:

```js
assert.match(editorBundleSource, /import\s+\{\s*WestgateTableView\s*\}\s+from\s+"\.\/table\/table-view\.mjs"/);
assert.match(editorBundleSource, /import\s+\{\s*createTableAuthoring\s*\}\s+from\s+"\.\/table\/table-authoring-ui\.mjs"/);
assert.match(editorBundleSource, /View:\s*WestgateTableView/);
assert.match(editorBundleSource, /createTableAuthoring\(editorMount,\s*editor\)/);
assert.doesNotMatch(editorBundleSource, /function\s+getTableToolDefs\s*\(/);
assert.doesNotMatch(editorBundleSource, /function\s+createTableContextToolbar\s*\(/);
assert.doesNotMatch(editorBundleSource, /function\s+createTableDimensionHandles\s*\(/);
```

In the contextual table schema test, replace the expected list with:

```js
assert.deepEqual(TABLE_CONTEXT_BUTTON_IDS, TABLE_STICKY_COMMAND_IDS);
assert.equal(TABLE_CELL_POPOVER_COMMAND_IDS.includes("table-cell-background"), true);
assert.match(editorCss, /\.wiki-editor-table-sticky-row\s*\{/);
assert.match(editorCss, /\.wiki-editor-table-cell-popover__color\s*\{/);
```

Add `TABLE_CELL_POPOVER_COMMAND_IDS` and `TABLE_STICKY_COMMAND_IDS` to the toolbar schema destructuring near the top of the file:

```js
const { IMAGE_CONTEXT_BUTTON_IDS, TABLE_CELL_POPOVER_COMMAND_IDS, TABLE_CONTEXT_BUTTON_IDS, TABLE_STICKY_COMMAND_IDS, TOP_TOOLBAR_BUTTON_IDS, TOP_TOOLBAR_GROUPS } = toolbarSchemaModule;
```

- [ ] **Step 2: Run contract tests and verify failure**

Run:

```bash
node tests/wiki-editor-contract.test.mjs
```

Expected: FAIL because `wiki-editor-bundle.js` still owns inline table helpers and calls the old toolbar/resize installers.

- [ ] **Step 3: Import table modules in `wiki-editor-bundle.js`**

Add imports near the other local imports:

```js
import { createTableAuthoring } from "./table/table-authoring-ui.mjs";
import { WestgateTableView } from "./table/table-view.mjs";
```

- [ ] **Step 4: Remove inline table helpers from `wiki-editor-bundle.js`**

Delete the complete function/class blocks with these exact names from `wiki-editor-bundle.js`, because Tasks 1-5 moved their behavior into `tiptap/src/table/`:

- `applyTableNodeAttributesToView`
- `WestgateTableView`
- `getActiveTableRowElement`
- `getActiveTableCellElement`
- `getTableNodePosition`
- `updateTableElementAttributes`
- `updateNodeAttributesAtPos`
- `updateTableElementStyle`
- `updateNodeStyleAtPos`
- `getTableColumnCellPositions`
- `applyStyleToTableColumnCells`
- `applyActiveTableProperties`
- `openTablePropertiesDialog`
- `getTableToolDefs`
- `getActiveTableElement`
- `createTableContextToolbar`
- `createTableResizeHandle`
- `setResizeHandleRect`
- `createTableDimensionHandles`

After deletion, run this command:

```bash
rg -n "applyTableNodeAttributesToView|class WestgateTableView|getActiveTableRowElement|getActiveTableCellElement|getTableNodePosition|updateTableElementAttributes|updateNodeAttributesAtPos|updateTableElementStyle|updateNodeStyleAtPos|getTableColumnCellPositions|applyStyleToTableColumnCells|applyActiveTableProperties|openTablePropertiesDialog|getTableToolDefs|getActiveTableElement|createTableContextToolbar|createTableResizeHandle|setResizeHandleRect|createTableDimensionHandles" tiptap/src/wiki-editor-bundle.js
```

Expected: no matches in `tiptap/src/wiki-editor-bundle.js`.

Keep these shared helpers only if `rg` shows non-table callers still use them in `wiki-editor-bundle.js`:

- `createButton`
- `createDialogField`
- `getSelectionElement`
- `positionContextPanel`
- `setStyleValue`
- `getStyleValue`
- `setClassToken`

For each kept helper, verify at least one non-table call remains:

```bash
rg -n "createButton|createDialogField|getSelectionElement|positionContextPanel|setStyleValue|getStyleValue|setClassToken" tiptap/src/wiki-editor-bundle.js
```

Expected: every kept helper appears at its definition and at least one call site. Delete a helper if it appears only at its definition.

- [ ] **Step 5: Replace old installers with the table authoring subsystem**

Replace:

```js
const tableContextToolbar = createTableContextToolbar(editorMount, editor);
const tableDimensionHandles = createTableDimensionHandles(editorMount, editor);
```

with:

```js
const tableAuthoring = createTableAuthoring(editorMount, editor);
```

Replace destroy calls:

```js
tableContextToolbar.destroy();
tableDimensionHandles.destroy();
```

with:

```js
tableAuthoring.destroy();
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
node tests/wiki-table-authoring.test.mjs
node tests/wiki-editor-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add tiptap/src/wiki-editor-bundle.js tests/wiki-editor-contract.test.mjs tests/wiki-table-authoring.test.mjs
git commit -m "refactor: wire wiki table authoring subsystem"
```

## Task 7: Build Vendored Editor Assets And Full Test Pass

**Files:**
- Modify: `public/vendor/tiptap/wiki-tiptap.bundle.js`
- Modify: `public/vendor/tiptap/wiki-tiptap.css`

- [ ] **Step 1: Build vendored Tiptap assets**

Run:

```bash
npm run build:tiptap
```

Expected: Vite build completes and updates `public/vendor/tiptap/wiki-tiptap.bundle.js` and `public/vendor/tiptap/wiki-tiptap.css`.

- [ ] **Step 2: Run focused authoring and contract tests**

Run:

```bash
node tests/wiki-table-authoring.test.mjs
node tests/wiki-editor-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Run full plugin test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Commit built assets**

Run:

```bash
git add public/vendor/tiptap/wiki-tiptap.bundle.js public/vendor/tiptap/wiki-tiptap.css
git commit -m "build: update vendored wiki editor assets"
```

## Task 8: Browser Validation

**Files:**
- No source changes expected.
- Use the running NodeBB forum at `http://localhost:4567`.

- [ ] **Step 1: Rebuild forum assets if the local NodeBB workflow requires it**

From the local NodeBB install, run the existing hot-reload or build workflow used for the project. If no forum server is running, start the normal local NodeBB development server before browser checks.

Expected: the compose page serves the updated vendored editor bundle.

- [ ] **Step 2: Validate a large table in compose**

Open a wiki compose/edit route containing a table with at least 20 rows and 8 columns. Verify:

- the main editor toolbar remains sticky
- the table context row appears under the main toolbar when the cursor is inside the table
- the table context row remains reachable when scrolled deep into the table
- the cell-local popover appears for an active cell
- selecting a range and applying a background color changes every selected cell
- clearing cell formatting removes background/text/alignment styles from the selected range
- row and column insert/delete controls remain reachable
- table resize handles still work
- no table focus glow or resize handle paints over the sticky toolbar

- [ ] **Step 3: Validate save/edit round trip**

Save the page, reopen it for editing, and verify:

- the large table remains a table
- selected-cell formatting persisted
- table properties persisted
- legacy table captions and layout classes still appear correctly when present

- [ ] **Step 4: Record validation outcome**

If browser validation passes, commit any small test/doc adjustment needed to record it:

```bash
git status --short
```

Expected: no unexpected source changes. If a doc note is added, commit it with:

```bash
git add docs/superpowers/plans/2026-05-12-large-table-authoring-redesign.md
git commit -m "docs: record large table authoring validation"
```

If browser validation finds issues, fix them in a new focused task with failing test coverage before repeating Task 7.
