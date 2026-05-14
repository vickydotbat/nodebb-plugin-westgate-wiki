import { Node } from "@tiptap/core";
import { Selection } from "@tiptap/pm/state";

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

export const MediaCell = Node.create({
  name: "mediaCell",
  content: "block+",
  defining: true,
  parseHTML() {
    return [
      { tag: "div.wiki-media-cell" },
      { tag: "section.wiki-media-cell" },
      { tag: "article.wiki-media-cell" }
    ];
  },
  renderHTML() {
    return ["div", { class: "wiki-media-cell", "data-wiki-node": "media-cell" }, 0];
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
