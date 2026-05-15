import { Node } from "@tiptap/core";
import { Selection } from "@tiptap/pm/state";

import { getTargetMediaCellPositions } from "../selection/media-cell-selection.mjs";
import { sanitizeStyleAttribute } from "../shared/sanitizer-contract.mjs";

export const MEDIA_CELL_STYLE_PRESETS = ["shadow", "gilded", "custom", "well"];

const MEDIA_CELL_STYLE_CLASS_PREFIX = "wiki-media-cell--";
const MEDIA_CELL_STYLE_CLASS_MAP = new Map(MEDIA_CELL_STYLE_PRESETS.map(function (preset) {
  return [`${MEDIA_CELL_STYLE_CLASS_PREFIX}${preset}`, preset];
}));

function selectionContainsNode(selection, pos, node) {
  return selection.from >= pos && selection.to <= pos + node.nodeSize;
}

function findActiveMediaContext(state) {
  const context = {
    rowNode: null,
    rowPos: null,
    cellNode: null,
    cellPos: null
  };

  state.doc.descendants(function (node, pos) {
    if (!selectionContainsNode(state.selection, pos, node)) {
      return true;
    }

    if (node.type.name === "mediaRow") {
      context.rowNode = node;
      context.rowPos = pos;
    } else if (node.type.name === "mediaCell") {
      context.cellNode = node;
      context.cellPos = pos;
    }
    return true;
  });

  return context.rowNode ? context : null;
}

function createEmptyMediaCell(state) {
  const mediaCellType = state.schema.nodes.mediaCell;
  const paragraphType = state.schema.nodes.paragraph;
  if (!mediaCellType || !paragraphType) {
    return null;
  }
  return mediaCellType.create(null, paragraphType.create());
}

function setSelectionNear(tr, pos, bias) {
  const selectionPos = Math.max(0, Math.min(pos, tr.doc.content.size));
  return tr.setSelection(Selection.near(tr.doc.resolve(selectionPos), bias || 1));
}

function deleteMediaRowFromContext(state, dispatch, context) {
  if (!context || context.rowPos == null || !context.rowNode) {
    return false;
  }

  if (dispatch) {
    const tr = state.tr.delete(context.rowPos, context.rowPos + context.rowNode.nodeSize);
    dispatch(setSelectionNear(tr, context.rowPos, -1).scrollIntoView());
  }
  return true;
}

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
  const safeStyleValue = sanitizeStyleAttribute(styleValue, "div");
  const safeBackground = sanitizeMediaCellColor(backgroundColor, "background-color") ||
    sanitizeMediaCellColor((safeStyleValue.match(/(?:^|;\s*)background-color:\s*([^;]+)/i) || [])[1], "background-color");
  const safeBorder = sanitizeMediaCellColor(borderColor, "border-color") ||
    sanitizeMediaCellColor((safeStyleValue.match(/(?:^|;\s*)border-color:\s*([^;]+)/i) || [])[1], "border-color");
  const entries = [];

  if (safeBackground) {
    entries.push(["--wiki-media-cell-custom-bg", safeBackground]);
    entries.push(["background-color", safeBackground]);
  }
  if (safeBorder) {
    entries.push(["--wiki-media-cell-custom-border", safeBorder]);
    entries.push(["border-color", safeBorder]);
  }

  return entries.map(function ([propertyName, value]) {
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
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          ...attrs
        }, node.marks);
      }
    });
    dispatch(tr.scrollIntoView());
  }
  return true;
}

export const MediaCell = Node.create({
  name: "mediaCell",
  content: "block+",
  defining: true,
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
  },
  parseHTML() {
    return [
      { tag: "div.wiki-media-cell" },
      { tag: "section.wiki-media-cell" },
      { tag: "article.wiki-media-cell" }
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const attrs = getMediaCellStyleAttrs(HTMLAttributes || {});
    const classes = ["wiki-media-cell"];
    const outputAttrs = {
      class: classes.join(" "),
      "data-wiki-node": "media-cell"
    };

    if (attrs.stylePreset) {
      classes.push(`${MEDIA_CELL_STYLE_CLASS_PREFIX}${attrs.stylePreset}`);
      outputAttrs.class = classes.join(" ");
    }
    if (attrs.stylePreset === "custom") {
      const style = mergeMediaCellColorStyle("", attrs.backgroundColor, attrs.borderColor);
      if (style) {
        outputAttrs.style = style;
      }
    }

    return ["div", outputAttrs, 0];
  }
});

export const MediaRow = Node.create({
  name: "mediaRow",
  group: "block",
  content: "mediaCell+",
  defining: true,
  addCommands() {
    return {
      insertMediaRow:
        (columns) =>
        ({ commands }) => {
          const count = Math.max(2, Math.min(3, parseInt(columns, 10) || 2));
          return commands.insertContent({
            type: this.name,
            content: Array.from({ length: count }).map(function () {
              return {
                type: "mediaCell",
                content: [{ type: "paragraph" }]
              };
            })
          });
        },
      setMediaCellStyle:
        (stylePreset) =>
        ({ state, dispatch }) => updateTargetMediaCells(state, dispatch, getMediaCellStyleAttrs({ stylePreset })),
      setMediaCellColors:
        (colors) =>
        ({ state, dispatch }) => updateTargetMediaCells(state, dispatch, getMediaCellStyleAttrs({
          stylePreset: "custom",
          backgroundColor: colors && colors.backgroundColor,
          borderColor: colors && colors.borderColor
        })),
      clearMediaCellStyle:
        () =>
        ({ state, dispatch }) => updateTargetMediaCells(state, dispatch, clearMediaCellStyleAttrs()),
      addMediaCellBefore:
        () =>
        ({ state, dispatch }) => {
          const context = findActiveMediaContext(state);
          if (!context || !context.cellNode || context.cellPos == null) {
            return false;
          }

          const mediaCell = createEmptyMediaCell(state);
          if (!mediaCell) {
            return false;
          }

          if (dispatch) {
            const tr = state.tr.insert(context.cellPos, mediaCell);
            dispatch(setSelectionNear(tr, context.cellPos + 2).scrollIntoView());
          }
          return true;
        },
      addMediaCellAfter:
        () =>
        ({ state, dispatch }) => {
          const context = findActiveMediaContext(state);
          if (!context || !context.cellNode || context.cellPos == null) {
            return false;
          }

          const mediaCell = createEmptyMediaCell(state);
          if (!mediaCell) {
            return false;
          }

          const insertPos = context.cellPos + context.cellNode.nodeSize;
          if (dispatch) {
            const tr = state.tr.insert(insertPos, mediaCell);
            dispatch(setSelectionNear(tr, insertPos + 2).scrollIntoView());
          }
          return true;
        },
      deleteMediaCell:
        () =>
        ({ state, dispatch }) => {
          const context = findActiveMediaContext(state);
          if (!context || !context.cellNode || context.cellPos == null) {
            return false;
          }

          if (context.rowNode.childCount <= 1) {
            return deleteMediaRowFromContext(state, dispatch, context);
          }

          if (dispatch) {
            const tr = state.tr.delete(context.cellPos, context.cellPos + context.cellNode.nodeSize);
            dispatch(setSelectionNear(tr, context.cellPos, -1).scrollIntoView());
          }
          return true;
        },
      deleteMediaRow:
        () =>
        ({ state, dispatch }) => deleteMediaRowFromContext(state, dispatch, findActiveMediaContext(state)),
      unwrapMediaRow:
        () =>
        ({ state, dispatch }) => {
          const context = findActiveMediaContext(state);
          if (!context || context.rowPos == null || !context.rowNode) {
            return false;
          }

          const blocks = [];
          context.rowNode.forEach(function (cell) {
            cell.content.forEach(function (child) {
              blocks.push(child);
            });
          });

          const paragraphType = state.schema.nodes.paragraph;
          if (!blocks.length && paragraphType) {
            blocks.push(paragraphType.create());
          }

          if (dispatch) {
            const tr = state.tr.replaceWith(context.rowPos, context.rowPos + context.rowNode.nodeSize, blocks);
            dispatch(setSelectionNear(tr, context.rowPos).scrollIntoView());
          }
          return true;
        }
    };
  },
  parseHTML() {
    return [
      { tag: "div.wiki-media-row" },
      { tag: "section.wiki-media-row" },
      { tag: "article.wiki-media-row" }
    ];
  },
  renderHTML() {
    return ["div", { class: "wiki-media-row", "data-wiki-node": "media-row" }, 0];
  }
});
