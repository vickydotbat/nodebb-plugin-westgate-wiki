# Media Cell Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe, first-class styling controls for Tiptap wiki media cells, including selected-cell and multi-cell application.

**Architecture:** Extend the existing custom `mediaCell` node with bounded style attrs and commands, then add a media-cell-specific selection plugin for multi-selection. Toolbar wiring exposes the style commands; persistent render CSS lives in article/editor CSS and saved HTML remains sanitizer-safe.

**Tech Stack:** NodeBB plugin, Tiptap 3, ProseMirror plugin/decorations, vanilla DOM toolbar UI, JSDOM contract tests, Vite vendored editor build.

---

## File Structure

- Modify `tiptap/src/extensions/media-row.mjs`
  - Own supported media-cell style presets, attr parsing/rendering, color sanitation, and style commands.
- Create `tiptap/src/selection/media-cell-selection.mjs`
  - Own ProseMirror plugin state, media-cell decorations, selected position helpers, toggle/range/clear transactions, and command target resolution.
- Modify `tiptap/src/selection/media-selection.mjs`
  - Add click helpers that translate DOM media-cell clicks into selection plugin transactions.
- Modify `tiptap/src/wiki-editor-bundle.js`
  - Import selection plugin helpers, add style buttons/color pair controls to the media-row context toolbar, and clear media-cell selection on outside clicks.
- Modify `tiptap/src/wiki-editor.css`
  - Add editor presentation for persistent style classes, selected-cell decorations, and style toolbar controls.
- Modify `public/wiki-article-body.css`
  - Add rendered article presentation for persistent media-cell style classes.
- Modify `tests/wiki-editor-contract.test.mjs`
  - Add TDD coverage for parsing/rendering, commands, multi-cell selection behavior, toolbar wiring, CSS selectors, and vendored parity.
- Modify `public/vendor/tiptap/wiki-tiptap.bundle.js` and `public/vendor/tiptap/wiki-tiptap.css`
  - Regenerate with `npm run build:tiptap`.

## Task 1: Media Cell Schema And Commands

**Files:**
- Modify: `tests/wiki-editor-contract.test.mjs`
- Modify: `tiptap/src/extensions/media-row.mjs`

- [ ] **Step 1: Write failing media-cell style contract tests**

Add imports from `media-row.mjs`:

```js
const {
  MEDIA_CELL_STYLE_PRESETS,
  clearMediaCellStyleAttrs,
  getMediaCellStyleAttrs,
  mergeMediaCellColorStyle
} = MediaRowModule;
```

Add tests:

```js
await test("mediaCell parses and renders supported style presets", function () {
  const editor = createEditor(
    '<div class="wiki-media-row"><div class="wiki-media-cell wiki-media-cell--gilded" data-wiki-node="media-cell"><p>Portrait</p></div><div class="wiki-media-cell wiki-media-cell--well" data-wiki-node="media-cell"><p>Notes</p></div></div>'
  );
  const json = editor.getJSON();
  const rendered = editor.getHTML();

  assert.equal(MEDIA_CELL_STYLE_PRESETS.includes("gilded"), true);
  assert.equal(json.content[0].content[0].attrs.stylePreset, "gilded");
  assert.equal(json.content[0].content[1].attrs.stylePreset, "well");
  assert.match(rendered, /class="wiki-media-cell wiki-media-cell--gilded"/);
  assert.match(rendered, /class="wiki-media-cell wiki-media-cell--well"/);
  editor.destroy();
});

await test("mediaCell parses and renders custom background and border colors", function () {
  const editor = createEditor(
    '<div class="wiki-media-row"><div class="wiki-media-cell wiki-media-cell--custom" data-wiki-node="media-cell" style="background-color: #22172d; border-color: #7b617f; position: fixed"><p>Custom</p></div></div>'
  );
  const json = editor.getJSON();
  const rendered = editor.getHTML();

  assert.equal(json.content[0].content[0].attrs.stylePreset, "custom");
  assert.equal(json.content[0].content[0].attrs.backgroundColor, "rgb(34, 23, 45)");
  assert.equal(json.content[0].content[0].attrs.borderColor, "rgb(123, 97, 127)");
  assert.match(rendered, /class="wiki-media-cell wiki-media-cell--custom"/);
  assert.match(rendered, /style="background-color: rgb\(34, 23, 45\); border-color: rgb\(123, 97, 127\);?"/);
  assert.doesNotMatch(rendered, /position:/);
  editor.destroy();
});

await test("mediaCell style helpers clear presets and custom colors", function () {
  assert.deepEqual(getMediaCellStyleAttrs({ stylePreset: "shadow" }), {
    stylePreset: "shadow",
    backgroundColor: null,
    borderColor: null
  });
  assert.deepEqual(getMediaCellStyleAttrs({
    stylePreset: "custom",
    backgroundColor: "#22172d",
    borderColor: "#7b617f"
  }), {
    stylePreset: "custom",
    backgroundColor: "rgb(34, 23, 45)",
    borderColor: "rgb(123, 97, 127)"
  });
  assert.deepEqual(clearMediaCellStyleAttrs(), {
    stylePreset: null,
    backgroundColor: null,
    borderColor: null
  });
  assert.equal(mergeMediaCellColorStyle("position: fixed; background-color: #111827", "#22172d", "#7b617f"), "background-color: rgb(34, 23, 45); border-color: rgb(123, 97, 127)");
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
node tests/wiki-editor-contract.test.mjs
```

Expected: FAIL because the new media-cell exports/attrs do not exist yet.

- [ ] **Step 3: Implement media-cell attrs, parsing, rendering, and single-target commands**

In `tiptap/src/extensions/media-row.mjs`, import sanitizer helpers and add:

```js
import { sanitizeStyleAttribute } from "../shared/sanitizer-contract.mjs";

export const MEDIA_CELL_STYLE_PRESETS = ["shadow", "gilded", "custom", "well"];
const MEDIA_CELL_STYLE_CLASS_PREFIX = "wiki-media-cell--";
const MEDIA_CELL_STYLE_CLASS_MAP = new Map(MEDIA_CELL_STYLE_PRESETS.map(function (preset) {
  return [`${MEDIA_CELL_STYLE_CLASS_PREFIX}${preset}`, preset];
}));

function sanitizeMediaCellColor(value, propertyName) {
  const sanitized = sanitizeStyleAttribute(`${propertyName}: ${value}`, "div");
  const match = sanitized.match(new RegExp(`(?:^|;\\s*)${propertyName}:\\s*([^;]+)`, "i"));
  return match ? match[1].trim() : "";
}

function readMediaCellPreset(element) {
  const classList = element && element.classList ? Array.from(element.classList) : [];
  const token = classList.find(function (className) {
    return MEDIA_CELL_STYLE_CLASS_MAP.has(className);
  });
  return token ? MEDIA_CELL_STYLE_CLASS_MAP.get(token) : "";
}

function readMediaCellStyleColor(element, propertyName) {
  if (!element) {
    return "";
  }
  return sanitizeMediaCellColor(element.style.getPropertyValue(propertyName), propertyName);
}

export function mergeMediaCellColorStyle(styleValue, backgroundColor, borderColor) {
  const probe = document.createElement("span");
  probe.setAttribute("style", String(styleValue || ""));
  const next = new Map();
  const safeBackground = sanitizeMediaCellColor(backgroundColor, "background-color");
  const safeBorder = sanitizeMediaCellColor(borderColor, "border-color");

  if (safeBackground) {
    next.set("background-color", safeBackground);
  }
  if (safeBorder) {
    next.set("border-color", safeBorder);
  }

  return Array.from(next.entries()).map(function ([propertyName, value]) {
    return `${propertyName}: ${value}`;
  }).join("; ");
}

export function getMediaCellStyleAttrs(options) {
  const preset = MEDIA_CELL_STYLE_PRESETS.includes(options && options.stylePreset) ? options.stylePreset : "";
  if (preset === "custom") {
    return {
      stylePreset: "custom",
      backgroundColor: sanitizeMediaCellColor(options && options.backgroundColor, "background-color") || null,
      borderColor: sanitizeMediaCellColor(options && options.borderColor, "border-color") || null
    };
  }
  return {
    stylePreset: preset || null,
    backgroundColor: null,
    borderColor: null
  };
}

export function clearMediaCellStyleAttrs() {
  return {
    stylePreset: null,
    backgroundColor: null,
    borderColor: null
  };
}
```

Add `addAttributes()` to `MediaCell`:

```js
addAttributes() {
  return {
    stylePreset: {
      default: null,
      parseHTML: function (element) {
        return readMediaCellPreset(element) || null;
      }
    },
    backgroundColor: {
      default: null,
      parseHTML: function (element) {
        return readMediaCellPreset(element) === "custom" ? readMediaCellStyleColor(element, "background-color") || null : null;
      }
    },
    borderColor: {
      default: null,
      parseHTML: function (element) {
        return readMediaCellPreset(element) === "custom" ? readMediaCellStyleColor(element, "border-color") || null : null;
      }
    }
  };
}
```

Change `renderHTML({ HTMLAttributes })` to emit only supported class/style values:

```js
renderHTML({ HTMLAttributes }) {
  const attrs = getMediaCellStyleAttrs(HTMLAttributes || {});
  const classes = ["wiki-media-cell"];
  if (attrs.stylePreset) {
    classes.push(`${MEDIA_CELL_STYLE_CLASS_PREFIX}${attrs.stylePreset}`);
  }
  const outputAttrs = {
    class: classes.join(" "),
    "data-wiki-node": "media-cell"
  };
  if (attrs.stylePreset === "custom") {
    const style = mergeMediaCellColorStyle("", attrs.backgroundColor, attrs.borderColor);
    if (style) {
      outputAttrs.style = style;
    }
  }
  return ["div", outputAttrs, 0];
}
```

Add commands to `MediaRow.addCommands()`:

```js
setMediaCellStyle:
  (stylePreset) =>
  ({ state, dispatch }) => {
    const context = findActiveMediaContext(state);
    if (!context || context.cellPos == null || !context.cellNode) {
      return false;
    }
    const attrs = getMediaCellStyleAttrs({ stylePreset });
    if (dispatch) {
      dispatch(state.tr.setNodeMarkup(context.cellPos, undefined, {
        ...context.cellNode.attrs,
        ...attrs
      }, context.cellNode.marks).scrollIntoView());
    }
    return true;
  },
setMediaCellColors:
  (colors) =>
  ({ state, dispatch }) => {
    const context = findActiveMediaContext(state);
    if (!context || context.cellPos == null || !context.cellNode) {
      return false;
    }
    const attrs = getMediaCellStyleAttrs({
      stylePreset: "custom",
      backgroundColor: colors && colors.backgroundColor,
      borderColor: colors && colors.borderColor
    });
    if (dispatch) {
      dispatch(state.tr.setNodeMarkup(context.cellPos, undefined, {
        ...context.cellNode.attrs,
        ...attrs
      }, context.cellNode.marks).scrollIntoView());
    }
    return true;
  },
clearMediaCellStyle:
  () =>
  ({ state, dispatch }) => {
    const context = findActiveMediaContext(state);
    if (!context || context.cellPos == null || !context.cellNode) {
      return false;
    }
    if (dispatch) {
      dispatch(state.tr.setNodeMarkup(context.cellPos, undefined, {
        ...context.cellNode.attrs,
        ...clearMediaCellStyleAttrs()
      }, context.cellNode.marks).scrollIntoView());
    }
    return true;
  },
```

- [ ] **Step 4: Run tests and verify Task 1 passes**

Run:

```bash
node tests/wiki-editor-contract.test.mjs
```

Expected: PASS for the new schema/helper tests. Later tasks may still be absent.

- [ ] **Step 5: Commit Task 1**

```bash
git add tests/wiki-editor-contract.test.mjs tiptap/src/extensions/media-row.mjs
git commit -m "feat: add media cell style attrs"
```

## Task 2: Multi-Cell Selection State

**Files:**
- Create: `tiptap/src/selection/media-cell-selection.mjs`
- Modify: `tests/wiki-editor-contract.test.mjs`
- Modify: `tiptap/src/wiki-editor-bundle.js`

- [ ] **Step 1: Write failing selection plugin tests**

Import the new module in `tests/wiki-editor-contract.test.mjs`:

```js
import("../tiptap/src/selection/media-cell-selection.mjs"),
```

Destructure:

```js
const {
  MEDIA_CELL_SELECTION_PLUGIN_KEY,
  MediaCellSelection,
  getSelectedMediaCellPositions,
  getTargetMediaCellPositions,
  toggleMediaCellSelectionAt
} = mediaCellSelectionModule;
```

Add `MediaCellSelection` to `createEditor()` extensions immediately after `MediaRow`.

Add tests:

```js
await test("media cell selection toggles individual cell positions", function () {
  const editor = createEditor('<div class="wiki-media-row"><div class="wiki-media-cell"><p>A</p></div><div class="wiki-media-cell"><p>B</p></div></div>');
  const cells = findNodePositions(editor, "mediaCell");

  editor.view.dispatch(toggleMediaCellSelectionAt(editor.state.tr, cells[0]));
  assert.deepEqual(getSelectedMediaCellPositions(editor.state), [cells[0]]);

  editor.view.dispatch(toggleMediaCellSelectionAt(editor.state.tr, cells[1]));
  assert.deepEqual(getSelectedMediaCellPositions(editor.state), [cells[0], cells[1]]);

  editor.view.dispatch(toggleMediaCellSelectionAt(editor.state.tr, cells[0]));
  assert.deepEqual(getSelectedMediaCellPositions(editor.state), [cells[1]]);
  editor.destroy();
});

await test("media cell command targets selected cells before active cell", function () {
  const editor = createEditor('<div class="wiki-media-row"><div class="wiki-media-cell"><p>A</p></div><div class="wiki-media-cell"><p>B</p></div></div>');
  const cells = findNodePositions(editor, "mediaCell");

  editor.view.dispatch(toggleMediaCellSelectionAt(editor.state.tr, cells[0]));
  editor.view.dispatch(toggleMediaCellSelectionAt(editor.state.tr, cells[1]));
  assert.deepEqual(getTargetMediaCellPositions(editor.state), cells);

  assert.equal(editor.commands.setMediaCellStyle("shadow"), true);
  const rendered = editor.getHTML();
  assert.equal((rendered.match(/wiki-media-cell--shadow/g) || []).length, 2);
  editor.destroy();
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
node tests/wiki-editor-contract.test.mjs
```

Expected: FAIL because `media-cell-selection.mjs` does not exist.

- [ ] **Step 3: Implement selection plugin and multi-target helpers**

Create `tiptap/src/selection/media-cell-selection.mjs`:

```js
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const MEDIA_CELL_SELECTION_PLUGIN_KEY = new PluginKey("wikiMediaCellSelection");
const META_KEY = "wikiMediaCellSelection";

function normalizePositions(positions, doc) {
  const seen = new Set();
  return (positions || []).filter(function (pos) {
    if (typeof pos !== "number" || seen.has(pos)) {
      return false;
    }
    const node = doc.nodeAt(pos);
    if (!node || node.type.name !== "mediaCell") {
      return false;
    }
    seen.add(pos);
    return true;
  }).sort(function (a, b) {
    return a - b;
  });
}

function createSelectionState(positions, anchor, doc) {
  const normalized = normalizePositions(positions, doc);
  return {
    selected: normalized,
    anchor: normalized.includes(anchor) ? anchor : normalized[normalized.length - 1] ?? null
  };
}

function findActiveMediaCellPos(state) {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "mediaCell") {
      return $from.before(depth);
    }
  }
  const node = state.selection.node;
  if (node && node.type.name === "mediaCell") {
    return state.selection.from;
  }
  return null;
}

export function getSelectedMediaCellPositions(state) {
  const pluginState = MEDIA_CELL_SELECTION_PLUGIN_KEY.getState(state);
  return pluginState ? pluginState.selected.slice() : [];
}

export function getTargetMediaCellPositions(state) {
  const selected = getSelectedMediaCellPositions(state);
  if (selected.length) {
    return selected;
  }
  const active = findActiveMediaCellPos(state);
  return active == null ? [] : [active];
}

export function setMediaCellSelection(tr, positions, anchor) {
  return tr.setMeta(META_KEY, { type: "set", positions, anchor });
}

export function clearMediaCellSelection(tr) {
  return tr.setMeta(META_KEY, { type: "clear" });
}

export function toggleMediaCellSelectionAt(tr, pos) {
  return tr.setMeta(META_KEY, { type: "toggle", pos });
}

function buildDecorations(doc, positions) {
  const decorations = positions.map(function (pos) {
    const node = doc.nodeAt(pos);
    return Decoration.node(pos, pos + node.nodeSize, {
      class: "wiki-media-cell--multi-selected",
      "data-wiki-media-cell-selected": "true"
    });
  });
  return DecorationSet.create(doc, decorations);
}

export function createMediaCellSelectionPlugin() {
  return new Plugin({
    key: MEDIA_CELL_SELECTION_PLUGIN_KEY,
    state: {
      init: function (_, state) {
        return createSelectionState([], null, state.doc);
      },
      apply: function (tr, value, oldState, newState) {
        const mapped = value.selected.map(function (pos) {
          return tr.mapping.map(pos);
        });
        let next = createSelectionState(mapped, value.anchor == null ? null : tr.mapping.map(value.anchor), newState.doc);
        const meta = tr.getMeta(META_KEY);
        if (meta && meta.type === "clear") {
          next = createSelectionState([], null, newState.doc);
        } else if (meta && meta.type === "set") {
          next = createSelectionState(meta.positions, meta.anchor, newState.doc);
        } else if (meta && meta.type === "toggle") {
          const selected = new Set(next.selected);
          if (selected.has(meta.pos)) {
            selected.delete(meta.pos);
          } else {
            selected.add(meta.pos);
          }
          next = createSelectionState(Array.from(selected), meta.pos, newState.doc);
        } else if (tr.selectionSet && findActiveMediaCellPos(newState) == null) {
          next = createSelectionState([], null, newState.doc);
        }
        return next;
      }
    },
    props: {
      decorations: function (state) {
        const pluginState = MEDIA_CELL_SELECTION_PLUGIN_KEY.getState(state);
        return buildDecorations(state.doc, pluginState ? pluginState.selected : []);
      }
    }
  });
}

const MediaCellSelection = Extension.create({
  name: "mediaCellSelection",
  addProseMirrorPlugins() {
    return [createMediaCellSelectionPlugin()];
  }
});

export default MediaCellSelection;
```

Update media-cell commands in `media-row.mjs` to use `getTargetMediaCellPositions(state)` from the new module. Implement a helper:

```js
function updateTargetMediaCells(state, dispatch, attrs) {
  const positions = getTargetMediaCellPositions(state);
  if (!positions.length) {
    return false;
  }
  if (dispatch) {
    const tr = state.tr;
    positions.forEach(function (pos) {
      const node = tr.doc.nodeAt(pos);
      if (node && node.type.name === "mediaCell") {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs }, node.marks);
      }
    });
    dispatch(tr.scrollIntoView());
  }
  return true;
}
```

Use that helper in `setMediaCellStyle`, `setMediaCellColors`, and `clearMediaCellStyle`.

Import and register `MediaCellSelection` in `wiki-editor-bundle.js` editor extensions after `MediaRow`.

- [ ] **Step 4: Run tests and verify Task 2 passes**

Run:

```bash
node tests/wiki-editor-contract.test.mjs
```

Expected: PASS for schema and selection tests.

- [ ] **Step 5: Commit Task 2**

```bash
git add tests/wiki-editor-contract.test.mjs tiptap/src/extensions/media-row.mjs tiptap/src/selection/media-cell-selection.mjs tiptap/src/wiki-editor-bundle.js
git commit -m "feat: add media cell multi-selection"
```

## Task 3: Click Interactions And Toolbar Controls

**Files:**
- Modify: `tests/wiki-editor-contract.test.mjs`
- Modify: `tiptap/src/selection/media-selection.mjs`
- Modify: `tiptap/src/wiki-editor-bundle.js`

- [ ] **Step 1: Write failing interaction and toolbar wiring tests**

Add tests:

```js
await test("editor bundle wires media cell selection helpers and style controls", function () {
  assert.match(editorBundleSource, /import\s+MediaCellSelection/);
  assert.match(editorBundleSource, /handleMediaCellSelectionClick\(editor,\s*mediaCell,\s*event\)/);
  assert.match(editorBundleSource, /id:\s*"media-cell-style-shadow"/);
  assert.match(editorBundleSource, /id:\s*"media-cell-style-gilded"/);
  assert.match(editorBundleSource, /id:\s*"media-cell-style-well"/);
  assert.match(editorBundleSource, /id:\s*"media-cell-style-colors"/);
  assert.match(editorBundleSource, /id:\s*"media-cell-style-clear"/);
  assert.match(editorBundleSource, /setMediaCellStyle\("shadow"\)/);
  assert.match(editorBundleSource, /setMediaCellColors\(\{/);
  assert.match(editorBundleSource, /clearMediaCellStyle\(\)/);
});
```

Add an exported helper test:

```js
await test("media cell style click helper toggles multi-selection on modified click", function () {
  const editor = createEditor('<div class="wiki-media-row"><div class="wiki-media-cell"><p>A</p></div><div class="wiki-media-cell"><p>B</p></div></div>');
  const firstCell = editor.view.dom.querySelector('[data-wiki-node="media-cell"]');
  const handled = mediaSelectionModule.handleMediaCellSelectionClick(editor, firstCell, {
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    preventDefault: function () {},
    stopPropagation: function () {}
  });

  assert.equal(handled, true);
  assert.deepEqual(getSelectedMediaCellPositions(editor.state), [findNodePositions(editor, "mediaCell")[0]]);
  editor.destroy();
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
node tests/wiki-editor-contract.test.mjs
```

Expected: FAIL because style toolbar controls and click helper are missing.

- [ ] **Step 3: Implement DOM click helper**

In `tiptap/src/selection/media-selection.mjs`, import selection helpers and add:

```js
import {
  getSelectedMediaCellPositions,
  setMediaCellSelection,
  toggleMediaCellSelectionAt
} from "./media-cell-selection.mjs";

function getSiblingMediaCellPositions(editor, cellElement) {
  const row = cellElement && cellElement.closest('[data-wiki-node="media-row"]');
  return Array.from(row ? row.querySelectorAll('[data-wiki-node="media-cell"]') : [])
    .map(function (cell) {
      return findNodeSelectionPos(editor, cell, ["mediaCell"]);
    })
    .filter(function (pos) {
      return pos != null;
    });
}

export function handleMediaCellSelectionClick(editor, cellElement, event) {
  if (!editor || !cellElement || !event) {
    return false;
  }
  const pos = findNodeSelectionPos(editor, cellElement, ["mediaCell"]);
  if (pos == null) {
    return false;
  }

  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    event.stopPropagation();
    editor.view.dispatch(toggleMediaCellSelectionAt(editor.state.tr, pos));
    return true;
  }

  if (event.shiftKey) {
    event.preventDefault();
    event.stopPropagation();
    const rowPositions = getSiblingMediaCellPositions(editor, cellElement);
    const selected = getSelectedMediaCellPositions(editor.state);
    const anchor = selected.length ? selected[selected.length - 1] : rowPositions[0];
    const start = rowPositions.indexOf(anchor);
    const end = rowPositions.indexOf(pos);
    if (start === -1 || end === -1) {
      editor.view.dispatch(setMediaCellSelection(editor.state.tr, [pos], pos));
      return true;
    }
    const from = Math.min(start, end);
    const to = Math.max(start, end);
    editor.view.dispatch(setMediaCellSelection(editor.state.tr, rowPositions.slice(from, to + 1), anchor));
    return true;
  }

  return false;
}
```

- [ ] **Step 4: Implement toolbar style controls**

In `wiki-editor-bundle.js`, import selection helpers and add media style buttons to `createMediaRowContextToolbar()` after delete controls:

```js
const styleShadow = createButton({
  id: "media-cell-style-shadow",
  title: "Shadow media cell",
  action: function () {
    editor.chain().focus().setMediaCellStyle("shadow").run();
  }
});
const styleGilded = createButton({
  id: "media-cell-style-gilded",
  title: "Gilded media cell",
  action: function () {
    editor.chain().focus().setMediaCellStyle("gilded").run();
  }
});
const styleWell = createButton({
  id: "media-cell-style-well",
  title: "Well media cell",
  action: function () {
    editor.chain().focus().setMediaCellStyle("well").run();
  }
});
const styleColors = createButton({
  id: "media-cell-style-colors",
  title: "Media cell colors",
  action: function () {
    openMediaCellColorPanel({ button: styleColors, editor });
  }
});
const styleClear = createButton({
  id: "media-cell-style-clear",
  title: "Clear media cell style",
  action: function () {
    editor.chain().focus().clearMediaCellStyle().run();
  }
});
```

Implement `openMediaCellColorPanel()` near existing color menu helpers:

```js
function openMediaCellColorPanel({ button, editor }) {
  openColorPairMenu({
    button,
    title: "Media cell colors",
    backgroundLabel: "Background",
    borderLabel: "Border",
    onApply: function ({ backgroundColor, borderColor }) {
      editor.chain().focus().setMediaCellColors({ backgroundColor, borderColor }).run();
    },
    onClear: function () {
      editor.chain().focus().clearMediaCellStyle().run();
    }
  });
}
```

Add `openColorPairMenu()` near `openColorMenu()`:

```js
function openColorPairMenu({ button, title, backgroundLabel, borderLabel, onApply, onClear }) {
  closeColorMenu();
  const menu = document.createElement("div");
  menu.className = "wiki-editor-color-menu wiki-editor-media-cell-color-menu";
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-label", title);

  const heading = document.createElement("div");
  heading.className = "wiki-editor-color-menu__title";
  heading.textContent = title;
  menu.appendChild(heading);

  const backgroundWrap = document.createElement("label");
  backgroundWrap.className = "wiki-editor-color-custom";
  backgroundWrap.textContent = backgroundLabel;
  const backgroundInput = document.createElement("input");
  backgroundInput.type = "color";
  backgroundInput.value = "#22172d";
  backgroundWrap.appendChild(backgroundInput);
  menu.appendChild(backgroundWrap);

  const borderWrap = document.createElement("label");
  borderWrap.className = "wiki-editor-color-custom";
  borderWrap.textContent = borderLabel;
  const borderInput = document.createElement("input");
  borderInput.type = "color";
  borderInput.value = "#7b617f";
  borderWrap.appendChild(borderInput);
  menu.appendChild(borderWrap);

  const actions = document.createElement("div");
  actions.className = "wiki-editor-media-cell-color-menu__actions";
  const apply = document.createElement("button");
  apply.type = "button";
  apply.className = "btn btn-primary btn-sm";
  apply.textContent = "Apply";
  apply.addEventListener("click", function () {
    onApply({ backgroundColor: backgroundInput.value, borderColor: borderInput.value });
    closeColorMenu();
  });
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "btn btn-outline-secondary btn-sm";
  clear.textContent = "Clear";
  clear.addEventListener("click", function () {
    onClear();
    closeColorMenu();
  });
  actions.appendChild(apply);
  actions.appendChild(clear);
  menu.appendChild(actions);

  menu.addEventListener("mousedown", function (event) {
    event.stopPropagation();
  });
  const rect = button.getBoundingClientRect();
  menu.style.left = `${Math.round(rect.left)}px`;
  menu.style.top = `${Math.round(rect.bottom + 6)}px`;
  document.body.appendChild(menu);
  activeColorMenu = menu;
  setTimeout(function () {
    document.addEventListener("mousedown", closeColorMenu);
  }, 0);
}
```

In the editor `click` DOM handler, before `focusMediaCell()`:

```js
if (mediaCell && handleMediaCellSelectionClick(editor, mediaCell, event)) {
  return true;
}
```

- [ ] **Step 5: Run tests and verify Task 3 passes**

Run:

```bash
node tests/wiki-editor-contract.test.mjs
```

Expected: PASS for toolbar wiring and click helper tests.

- [ ] **Step 6: Commit Task 3**

```bash
git add tests/wiki-editor-contract.test.mjs tiptap/src/selection/media-selection.mjs tiptap/src/wiki-editor-bundle.js
git commit -m "feat: add media cell style controls"
```

## Task 4: Article And Editor CSS

**Files:**
- Modify: `tests/wiki-editor-contract.test.mjs`
- Modify: `public/wiki-article-body.css`
- Modify: `tiptap/src/wiki-editor.css`

- [ ] **Step 1: Write failing CSS contract tests**

Add:

```js
await test("media cell style css exists in article and editor prose", function () {
  [articleBodyCss, editorCss].forEach(function (css) {
    assert.match(css, /\.wiki-media-cell--shadow\s*\{/);
    assert.match(css, /\.wiki-media-cell--gilded\s*\{/);
    assert.match(css, /\.wiki-media-cell--custom\s*\{/);
    assert.match(css, /\.wiki-media-cell--well\s*\{/);
  });
  assert.match(editorCss, /\.wiki-media-cell--multi-selected\s*\{/);
  assert.match(editorCss, /\.wiki-editor-media-cell-color-menu\s*\{/);
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
node tests/wiki-editor-contract.test.mjs
```

Expected: FAIL because CSS selectors are missing.

- [ ] **Step 3: Add persistent article CSS**

In `public/wiki-article-body.css`, after current `.wiki-media-cell` rules, add:

```css
.wiki-article-prose .wiki-media-cell--shadow {
  background: linear-gradient(145deg, rgba(31, 18, 35, 0.82), rgba(8, 7, 10, 0.92));
  border-radius: var(--bs-border-radius, 0.5rem);
  box-shadow: inset 0 1px 0 rgba(255, 244, 214, 0.045), 0 0.85rem 2rem rgba(0, 0, 0, 0.34);
  padding: 0.9rem;
}

.wiki-article-prose .wiki-media-cell--gilded {
  background: linear-gradient(145deg, rgba(27, 16, 31, 0.92), rgba(9, 7, 10, 0.98));
  border: 1px solid rgba(194, 163, 90, 0.55);
  border-radius: var(--bs-border-radius, 0.5rem);
  box-shadow: inset 0 0 0 1px rgba(255, 244, 214, 0.05), inset 0 1px 0 rgba(255, 244, 214, 0.08), 0 0.85rem 1.85rem rgba(0, 0, 0, 0.28);
  padding: 0.9rem;
}

.wiki-article-prose .wiki-media-cell--custom {
  background-color: var(--wiki-media-cell-custom-bg, transparent);
  border: 1px solid currentColor;
  border-color: inherit;
  border-radius: var(--bs-border-radius, 0.45rem);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
  padding: 0.9rem;
}

.wiki-article-prose .wiki-media-cell--well {
  background: linear-gradient(180deg, rgba(255, 244, 214, 0.035), transparent 22%), #0b090d;
  border: 1px solid rgba(185, 178, 166, 0.18);
  border-radius: var(--bs-border-radius, 0.45rem);
  box-shadow: inset 0 0.25rem 0.8rem rgba(0, 0, 0, 0.62), inset 0 0 0 1px rgba(255, 255, 255, 0.018);
  padding: 0.9rem;
}
```

- [ ] **Step 4: Add editor CSS**

In `tiptap/src/wiki-editor.css`, add equivalent persistent styles scoped under `.westgate-wiki-compose .wiki-editor__content`, selected decoration styling, and color menu styling:

```css
.westgate-wiki-compose .wiki-editor__content .wiki-media-cell--shadow {
  background: linear-gradient(145deg, rgba(31, 18, 35, 0.82), rgba(8, 7, 10, 0.92));
  border-radius: var(--bs-border-radius, 0.5rem);
  box-shadow: inset 0 1px 0 rgba(255, 244, 214, 0.045), 0 0.85rem 2rem rgba(0, 0, 0, 0.34);
  padding: 1.6rem 0.9rem 0.9rem;
}

.westgate-wiki-compose .wiki-editor__content .wiki-media-cell--gilded {
  background: linear-gradient(145deg, rgba(27, 16, 31, 0.92), rgba(9, 7, 10, 0.98));
  border: 1px solid rgba(194, 163, 90, 0.55);
  border-radius: var(--bs-border-radius, 0.5rem);
  box-shadow: inset 0 0 0 1px rgba(255, 244, 214, 0.05), inset 0 1px 0 rgba(255, 244, 214, 0.08), 0 0.85rem 1.85rem rgba(0, 0, 0, 0.28);
  padding: 1.6rem 0.9rem 0.9rem;
}

.westgate-wiki-compose .wiki-editor__content .wiki-media-cell--custom {
  background-color: var(--wiki-media-cell-custom-bg, transparent);
  border: 1px solid currentColor;
  border-color: inherit;
  border-radius: var(--bs-border-radius, 0.45rem);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
  padding: 1.6rem 0.9rem 0.9rem;
}

.westgate-wiki-compose .wiki-editor__content .wiki-media-cell--well {
  background: linear-gradient(180deg, rgba(255, 244, 214, 0.035), transparent 22%), #0b090d;
  border: 1px solid rgba(185, 178, 166, 0.18);
  border-radius: var(--bs-border-radius, 0.45rem);
  box-shadow: inset 0 0.25rem 0.8rem rgba(0, 0, 0, 0.62), inset 0 0 0 1px rgba(255, 255, 255, 0.018);
  padding: 1.6rem 0.9rem 0.9rem;
}

.westgate-wiki-compose .wiki-editor__content .wiki-media-cell--multi-selected {
  outline: 2px solid var(--wiki-editor-focus-border, var(--bs-primary, #0d6efd));
  outline-offset: 3px;
}

.westgate-wiki-compose .wiki-editor-media-cell-color-menu {
  min-width: 16rem;
}

.westgate-wiki-compose .wiki-editor-media-cell-color-menu__actions {
  display: flex;
  gap: 0.4rem;
  justify-content: flex-end;
  margin-top: 0.45rem;
}
```

Use the full declarations from article CSS for the four persistent classes, preserving existing editor empty-cell labels and focus styling.

- [ ] **Step 5: Run tests and verify Task 4 passes**

Run:

```bash
node tests/wiki-editor-contract.test.mjs
```

Expected: PASS for CSS contract tests.

- [ ] **Step 6: Commit Task 4**

```bash
git add tests/wiki-editor-contract.test.mjs public/wiki-article-body.css tiptap/src/wiki-editor.css
git commit -m "style: add media cell style treatments"
```

## Task 5: Vendored Build And Full Verification

**Files:**
- Modify: `public/vendor/tiptap/wiki-tiptap.bundle.js`
- Modify: `public/vendor/tiptap/wiki-tiptap.css`

- [ ] **Step 1: Rebuild vendored Tiptap assets**

Run:

```bash
npm run build:tiptap
```

Expected: Vite build exits 0 and updates `public/vendor/tiptap/wiki-tiptap.bundle.js` and `public/vendor/tiptap/wiki-tiptap.css`.

- [ ] **Step 2: Run focused editor tests**

Run:

```bash
node tests/wiki-editor-contract.test.mjs
```

Expected: PASS, including vendored parity checks.

- [ ] **Step 3: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Review git diff**

Run:

```bash
git diff --stat
git diff -- tests/wiki-editor-contract.test.mjs tiptap/src/extensions/media-row.mjs tiptap/src/selection/media-cell-selection.mjs tiptap/src/selection/media-selection.mjs tiptap/src/wiki-editor-bundle.js tiptap/src/wiki-editor.css public/wiki-article-body.css
```

Expected: Diff is limited to media-cell styling and vendored build output.

- [ ] **Step 5: Commit final build output**

```bash
git add public/vendor/tiptap/wiki-tiptap.bundle.js public/vendor/tiptap/wiki-tiptap.css
git commit -m "build: update tiptap media cell assets"
```

## Final Verification

- [ ] Run `npm test`.
- [ ] Run `git status --short`.
- [ ] Confirm any remaining untracked `.superpowers/` files are generated companion artifacts and not part of the feature.
