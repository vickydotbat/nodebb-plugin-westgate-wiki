import assert from "node:assert/strict";

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { CellSelection } from "@tiptap/pm/tables";

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
  tableContextModule,
  tableDomModule,
  tableViewModule
] = await Promise.all([
  import("../tiptap/src/table/table-context.mjs"),
  import("../tiptap/src/table/table-dom.mjs"),
  import("../tiptap/src/table/table-view.mjs")
]);

const { deriveTableContext } = tableContextModule;
const {
  getSelectionElement,
  getActiveTableElement,
  getActiveTableRowElement,
  getActiveTableCellElement,
  getTableNodePosition,
  setClassToken,
  setStyleValue,
  getStyleValue,
  updateNodeAttributesAtPos,
  updateNodeStyleAtPos,
  positionContextPanel
} = tableDomModule;
const { WestgateTableView, applyTableNodeAttributesToView } = tableViewModule;

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

function createSelectionEditorStub(selectionNode) {
  return {
    view: {
      domAtPos: function () {
        return { node: selectionNode };
      }
    },
    state: {
      selection: { from: 1 }
    }
  };
}

function createPositionEditorStub(nodeAtResult) {
  return {
    view: {
      posAtDOM: function () {
        return 9;
      }
    },
    state: {
      doc: {
        nodeAt: function (pos) {
          return pos === 8 ? nodeAtResult : null;
        }
      }
    }
  };
}

function createAttributeEditorStub(nodeAtResult) {
  const calls = [];
  const tr = {
    scrolled: false,
    setNodeMarkup: function (pos, type, attrs, marks) {
      calls.push({ pos, type, attrs, marks });
      return tr;
    },
    scrollIntoView: function () {
      tr.scrolled = true;
      return tr;
    }
  };
  const editor = {
    dispatched: null,
    state: {
      doc: {
        nodeAt: function (pos) {
          return pos === 4 ? nodeAtResult : null;
        }
      },
      tr
    },
    view: {
      dispatch: function (transaction) {
        editor.dispatched = transaction;
      }
    }
  };
  editor.calls = calls;
  return editor;
}

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

await test("active table DOM helpers locate table, row, and cell inside the editor surface", function () {
  const surface = document.createElement("div");
  const table = document.createElement("table");
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  const paragraph = document.createElement("p");
  const text = document.createTextNode("Cell text");
  paragraph.appendChild(text);
  cell.appendChild(paragraph);
  row.appendChild(cell);
  table.appendChild(row);
  surface.appendChild(table);

  const editor = createSelectionEditorStub(text);

  assert.equal(getActiveTableElement(editor, surface), table);
  assert.equal(getActiveTableRowElement(editor, table), row);
  assert.equal(getActiveTableCellElement(editor, table), cell);
  assert.equal(getActiveTableElement(editor, document.createElement("div")), null);
  assert.equal(getActiveTableRowElement(editor, document.createElement("table")), null);
  assert.equal(getActiveTableCellElement(editor, document.createElement("table")), null);
});

await test("getTableNodePosition maps a table DOM element to a valid document position", function () {
  const tableNode = { type: { name: "table" } };
  const editor = createPositionEditorStub(tableNode);

  assert.equal(getTableNodePosition(editor, document.createElement("table")), 8);
  assert.equal(getTableNodePosition(createPositionEditorStub(null), document.createElement("table")), null);
  assert.equal(getTableNodePosition({ view: {}, state: { doc: {} } }, document.createElement("table")), null);
});

await test("updateNodeAttributesAtPos merges node attrs and dispatches the transaction", function () {
  const node = {
    attrs: { class: "old", style: "width: 50%" },
    marks: ["strong"]
  };
  const editor = createAttributeEditorStub(node);

  assert.equal(updateNodeAttributesAtPos(editor, 4, { class: "new" }), true);
  assert.deepEqual(editor.calls, [{
    pos: 4,
    type: undefined,
    attrs: { class: "new", style: "width: 50%" },
    marks: ["strong"]
  }]);
  assert.equal(editor.dispatched, editor.state.tr);
  assert.equal(editor.state.tr.scrolled, true);
  assert.equal(updateNodeAttributesAtPos(editor, 5, { class: "missing" }), false);
});

await test("updateNodeStyleAtPos updates styles from node attrs or fallback style", function () {
  const node = {
    attrs: { class: "wiki-table-layout-auto", style: "" },
    marks: []
  };
  const editor = createAttributeEditorStub(node);

  assert.equal(updateNodeStyleAtPos(editor, 4, "width: 50%", function (style) {
    assert.equal(style, "width: 50%");
    return setStyleValue(style, "width", "75%");
  }, { scroll: false }), true);

  assert.deepEqual(editor.calls, [{
    pos: 4,
    type: undefined,
    attrs: { class: "wiki-table-layout-auto", style: "width: 75%" },
    marks: []
  }]);
  assert.equal(editor.dispatched, editor.state.tr);
  assert.equal(editor.state.tr.scrolled, false);

  const removeStyleEditor = createAttributeEditorStub(node);
  assert.equal(updateNodeStyleAtPos(removeStyleEditor, 4, "height: 30px", function () {
    return "";
  }), true);
  assert.equal(removeStyleEditor.calls[0].attrs.style, null);
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
