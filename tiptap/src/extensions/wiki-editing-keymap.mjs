import { Extension } from "@tiptap/core";
import { Selection } from "@tiptap/pm/state";

function isListNode(node) {
  return node && (node.type.name === "bulletList" || node.type.name === "orderedList");
}

function deleteEmptyParagraphAfterList(editor) {
  const { state, view } = editor;
  const { selection } = state;
  if (!selection.empty) {
    return false;
  }

  const { $from } = selection;
  if (
    $from.parent.type.name !== "paragraph" ||
    $from.parent.content.size !== 0 ||
    $from.parentOffset !== 0 ||
    $from.depth < 1
  ) {
    return false;
  }

  const paragraphStart = $from.before($from.depth);
  const paragraphEnd = $from.after($from.depth);
  const previousNode = state.doc.resolve(paragraphStart).nodeBefore;
  if (!isListNode(previousNode) || state.doc.childCount < 2) {
    return false;
  }

  const tr = state.tr.delete(paragraphStart, paragraphEnd);
  const selectionPos = Math.max(0, Math.min(paragraphStart - 1, tr.doc.content.size));
  tr.setSelection(Selection.near(tr.doc.resolve(selectionPos), -1)).scrollIntoView();
  view.dispatch(tr);
  return true;
}

const WikiEditingKeymap = Extension.create({
  name: "wikiEditingKeymap",
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      Backspace: () => deleteEmptyParagraphAfterList(this.editor)
    };
  }
});

export { deleteEmptyParagraphAfterList };
export default WikiEditingKeymap;
