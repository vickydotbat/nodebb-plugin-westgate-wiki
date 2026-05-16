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
