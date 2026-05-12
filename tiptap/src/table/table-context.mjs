import { CellSelection } from "@tiptap/pm/tables";

import {
  getActiveTableElement,
  getActiveTableCellElement,
  getTableNodePosition
} from "./table-dom.mjs";

function createEmptyContext() {
  return {
    isActive: false,
    activeTableElement: null,
    activeTablePos: null,
    activeCellElement: null,
    activeCellPos: null,
    selectedCellPositions: [],
    selectedCellCount: 0,
    selectedRowIndexes: [],
    selectedColumnIndexes: [],
    tableAttrs: {},
    canFormatSelection: false,
    canUseStructuralCommands: false
  };
}

function getNodePosition(editor, element) {
  if (!editor || !editor.view || typeof editor.view.posAtDOM !== "function" || !element) {
    return null;
  }

  const pos = editor.view.posAtDOM(element, 0) - 1;
  return pos >= 0 && editor.state.doc.nodeAt(pos) ? pos : null;
}

function getElementForPosition(editor, pos) {
  if (!editor || !editor.view || typeof editor.view.nodeDOM !== "function" || !Number.isFinite(pos)) {
    return null;
  }

  const element = editor.view.nodeDOM(pos);
  return element && element.nodeType === 1 ? element : null;
}

function getCellIndexes(table, cell) {
  const row = cell && cell.closest ? cell.closest("tr") : null;
  if (!table || !row || !table.contains(row)) {
    return { rowIndex: null, columnIndex: null };
  }

  const rows = Array.from(table.querySelectorAll("tr"));
  const cells = Array.from(row.querySelectorAll("td, th"));
  return {
    rowIndex: rows.indexOf(row),
    columnIndex: cells.indexOf(cell)
  };
}

function addUniqueIndex(indexes, index) {
  if (Number.isInteger(index) && index >= 0 && !indexes.includes(index)) {
    indexes.push(index);
  }
}

function getFallbackStyle(node, element) {
  return String(node && node.attrs && node.attrs.style || element && element.getAttribute("style") || "");
}

function collectCellSelection(selection) {
  const cells = [];
  selection.forEachCell(function (node, pos) {
    cells.push({ node, pos });
  });
  return cells;
}

export function deriveTableContext(editor, surface) {
  const context = createEmptyContext();
  if (!editor || !editor.state || !editor.view) {
    return context;
  }

  const selection = editor.state.selection;
  const activeTableElement = getActiveTableElement(editor, surface);
  if (!activeTableElement) {
    return context;
  }

  const activeCellElement = getActiveTableCellElement(editor, activeTableElement);
  const activeTablePos = getTableNodePosition(editor, activeTableElement);
  const activeTableNode = Number.isFinite(activeTablePos) ? editor.state.doc.nodeAt(activeTablePos) : null;
  const activeCellPos = getNodePosition(editor, activeCellElement);
  const selectedCells = selection instanceof CellSelection
    ? collectCellSelection(selection)
    : [{
      pos: activeCellPos,
      node: Number.isFinite(activeCellPos) ? editor.state.doc.nodeAt(activeCellPos) : null
    }].filter(function (entry) {
      return Number.isFinite(entry.pos) && entry.node;
    });

  const selectedRowIndexes = [];
  const selectedColumnIndexes = [];
  const selectedCellPositions = selectedCells.map(function (entry) {
    const element = getElementForPosition(editor, entry.pos);
    const indexes = getCellIndexes(activeTableElement, element);
    addUniqueIndex(selectedRowIndexes, indexes.rowIndex);
    addUniqueIndex(selectedColumnIndexes, indexes.columnIndex);

    return {
      pos: entry.pos,
      node: entry.node,
      fallbackStyle: getFallbackStyle(entry.node, element)
    };
  });

  return {
    isActive: true,
    activeTableElement,
    activeTablePos,
    activeCellElement,
    activeCellPos,
    selectedCellPositions,
    selectedCellCount: selectedCellPositions.length,
    selectedRowIndexes,
    selectedColumnIndexes,
    tableAttrs: activeTableNode && activeTableNode.attrs ? { ...activeTableNode.attrs } : {},
    canFormatSelection: selectedCellPositions.length > 0,
    canUseStructuralCommands: selectedCellPositions.length > 0
  };
}
