import { CellSelection, TableMap } from "@tiptap/pm/tables";

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

function addUniqueIndex(indexes, index) {
  if (Number.isInteger(index) && index >= 0 && !indexes.includes(index)) {
    indexes.push(index);
  }
}

function addIndexRange(indexes, start, end) {
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return;
  }

  for (let index = start; index < end; index += 1) {
    addUniqueIndex(indexes, index);
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

function getCellRect(tableNode, tablePos, cellPos) {
  if (!tableNode || !Number.isFinite(tablePos) || !Number.isFinite(cellPos)) {
    return null;
  }

  try {
    return TableMap.get(tableNode).findCell(cellPos - tablePos - 1);
  } catch (err) {
    return null;
  }
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
    const rect = getCellRect(activeTableNode, activeTablePos, entry.pos);
    if (rect) {
      addIndexRange(selectedRowIndexes, rect.top, rect.bottom);
      addIndexRange(selectedColumnIndexes, rect.left, rect.right);
    }

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
