import { getReadableTextColor } from "../shared/color-contrast.mjs";
import { setClassToken, setStyleValue } from "./table-dom.mjs";
import { openTablePropertiesDialog } from "./table-properties-dialog.mjs";

const CELL_VALIGN_CLASS_BY_VALUE = {
  top: "wiki-table-cell-valign-top",
  middle: "wiki-table-cell-valign-middle",
  bottom: "wiki-table-cell-valign-bottom"
};

const CELL_VALIGN_CLASSES = Object.values(CELL_VALIGN_CLASS_BY_VALUE);

const STRUCTURAL_COMMANDS = {
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

export const TABLE_STICKY_COMMAND_IDS = [
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
];

export const TABLE_CELL_POPOVER_COMMAND_IDS = [
  "table-cell-background",
  "table-cell-text-color",
  "table-cell-align-left",
  "table-cell-align-center",
  "table-cell-align-right",
  "table-cell-valign-top",
  "table-cell-valign-middle",
  "table-cell-valign-bottom",
  "table-cell-clear-formatting"
];

export const TABLE_COMMANDS = [
  { id: "table-properties", label: "Table properties", scope: "table", placement: "sticky", icon: "fa-sliders", group: "table" },
  { id: "table-add-row-before", label: "Insert row before", scope: "structure", placement: "sticky", icon: "fa-plus", group: "rows", badge: "R+" },
  { id: "table-add-row-after", label: "Insert row after", scope: "structure", placement: "sticky", icon: "fa-plus", group: "rows", badge: "+R" },
  { id: "table-delete-row", label: "Delete row", scope: "structure", placement: "sticky", icon: "fa-minus", group: "rows", badge: "R" },
  { id: "table-add-column-before", label: "Insert column before", scope: "structure", placement: "sticky", icon: "fa-plus", group: "columns", badge: "C+" },
  { id: "table-add-column-after", label: "Insert column after", scope: "structure", placement: "sticky", icon: "fa-plus", group: "columns", badge: "+C" },
  { id: "table-delete-column", label: "Delete column", scope: "structure", placement: "sticky", icon: "fa-minus", group: "columns", badge: "C" },
  { id: "table-merge-cells", label: "Merge cells", scope: "structure", placement: "sticky", icon: "fa-compress", group: "cells" },
  { id: "table-split-cell", label: "Split cell", scope: "structure", placement: "sticky", icon: "fa-expand", group: "cells" },
  { id: "table-toggle-header-row", label: "Toggle header row", scope: "structure", placement: "sticky", icon: "fa-header", group: "headers", badge: "R" },
  { id: "table-toggle-header-column", label: "Toggle header column", scope: "structure", placement: "sticky", icon: "fa-header", group: "headers", badge: "C" },
  { id: "table-delete", label: "Delete table", scope: "structure", placement: "sticky", icon: "fa-trash", group: "table" },
  { id: "table-cell-background", label: "Cell background", scope: "cell-formatting", placement: "cell-popover", icon: "fa-tint", group: "cell-formatting" },
  { id: "table-cell-text-color", label: "Cell text color", scope: "cell-formatting", placement: "cell-popover", icon: "fa-font", group: "cell-formatting" },
  { id: "table-cell-align-left", label: "Align cell left", scope: "cell-formatting", placement: "cell-popover", icon: "fa-align-left", group: "cell-alignment" },
  { id: "table-cell-align-center", label: "Align cell center", scope: "cell-formatting", placement: "cell-popover", icon: "fa-align-center", group: "cell-alignment" },
  { id: "table-cell-align-right", label: "Align cell right", scope: "cell-formatting", placement: "cell-popover", icon: "fa-align-right", group: "cell-alignment" },
  { id: "table-cell-valign-top", label: "Align cell top", scope: "cell-formatting", placement: "cell-popover", icon: "fa-long-arrow-up", group: "cell-vertical-alignment" },
  { id: "table-cell-valign-middle", label: "Align cell middle", scope: "cell-formatting", placement: "cell-popover", icon: "fa-arrows-v", group: "cell-vertical-alignment" },
  { id: "table-cell-valign-bottom", label: "Align cell bottom", scope: "cell-formatting", placement: "cell-popover", icon: "fa-long-arrow-down", group: "cell-vertical-alignment" },
  { id: "table-cell-clear-formatting", label: "Clear cell formatting", scope: "cell-formatting", placement: "cell-popover", icon: "fa-eraser", group: "cell-formatting" }
];

export const TABLE_COMMAND_IDS = TABLE_COMMANDS.map(function (command) {
  return command.id;
});

function isCellFormattingCommand(id) {
  return TABLE_CELL_POPOVER_COMMAND_IDS.includes(id);
}

function getPayloadColor(payload) {
  return String(payload && (payload.value || payload.color || payload.backgroundColor || payload.textColor) || "").trim();
}

function runChainCommand(editor, commandName) {
  if (!editor || !commandName || typeof editor.chain !== "function") {
    return false;
  }

  const chain = editor.chain().focus();
  return chain && typeof chain[commandName] === "function" ? chain[commandName]().run() : false;
}

function canRunChainCommand(editor, commandName) {
  if (!editor || !commandName || typeof editor.can !== "function") {
    return false;
  }

  const chain = editor.can().chain().focus();
  return chain && typeof chain[commandName] === "function" ? chain[commandName]().run() : false;
}

function updateCellStyle(style, id, payload) {
  if (id === "table-cell-background") {
    const backgroundColor = getPayloadColor(payload);
    if (!backgroundColor) {
      return style;
    }
    return setStyleValue(
      setStyleValue(style, "background-color", backgroundColor),
      "color",
      getReadableTextColor(backgroundColor)
    );
  }

  if (id === "table-cell-text-color") {
    return setStyleValue(style, "color", getPayloadColor(payload));
  }

  if (id === "table-cell-align-left") {
    return setStyleValue(style, "text-align", "left");
  }

  if (id === "table-cell-align-center") {
    return setStyleValue(style, "text-align", "center");
  }

  if (id === "table-cell-align-right") {
    return setStyleValue(style, "text-align", "right");
  }

  if (id === "table-cell-valign-top") {
    return setStyleValue(style, "vertical-align", "top");
  }

  if (id === "table-cell-valign-middle") {
    return setStyleValue(style, "vertical-align", "middle");
  }

  if (id === "table-cell-valign-bottom") {
    return setStyleValue(style, "vertical-align", "bottom");
  }

  if (id === "table-cell-clear-formatting") {
    return setStyleValue(
      setStyleValue(
        setStyleValue(
          setStyleValue(style, "background-color", ""),
          "color",
          ""
        ),
        "text-align",
        ""
      ),
      "vertical-align",
      ""
    );
  }

  return style;
}

function getCellAlignValue(id) {
  if (id === "table-cell-align-left") {
    return "left";
  }
  if (id === "table-cell-align-center") {
    return "center";
  }
  if (id === "table-cell-align-right") {
    return "right";
  }
  return null;
}

function getCellVerticalAlignValue(id) {
  if (id === "table-cell-valign-top") {
    return "top";
  }
  if (id === "table-cell-valign-middle") {
    return "middle";
  }
  if (id === "table-cell-valign-bottom") {
    return "bottom";
  }
  return null;
}

function setCellVerticalAlignClass(className, value) {
  let nextClassName = String(className || "");
  CELL_VALIGN_CLASSES.forEach(function (token) {
    nextClassName = setClassToken(nextClassName, token, false);
  });
  if (value && CELL_VALIGN_CLASS_BY_VALUE[value]) {
    nextClassName = setClassToken(nextClassName, CELL_VALIGN_CLASS_BY_VALUE[value], true);
  }
  return nextClassName || null;
}

function updateCellAttrs(attrs, id, nextStyle) {
  const nextAttrs = {
    ...attrs,
    style: nextStyle || null
  };
  const align = getCellAlignValue(id);
  const verticalAlign = getCellVerticalAlignValue(id);
  if (align) {
    nextAttrs.align = align;
  }
  if (verticalAlign) {
    nextAttrs.class = setCellVerticalAlignClass(nextAttrs.class, verticalAlign);
  } else if (id === "table-cell-clear-formatting") {
    nextAttrs.align = null;
    nextAttrs.class = setCellVerticalAlignClass(nextAttrs.class, null);
  }
  return nextAttrs;
}

function applySelectedCellStyles(editor, context, id, payload) {
  const selectedCells = context && Array.isArray(context.selectedCellPositions) ? context.selectedCellPositions : [];
  if (!editor || !editor.state || !editor.view || selectedCells.length === 0) {
    return false;
  }

  const tr = editor.state.tr;
  let changed = false;
  selectedCells.forEach(function (entry) {
    const pos = entry && entry.pos;
    const node = Number.isFinite(pos) ? editor.state.doc.nodeAt(pos) : null;
    if (!node) {
      return;
    }

    const currentStyle = node.attrs.style || entry.fallbackStyle || "";
    const nextStyle = updateCellStyle(currentStyle, id, payload);
    tr.setNodeMarkup(pos, undefined, updateCellAttrs(node.attrs, id, nextStyle), node.marks);
    changed = true;
  });

  if (changed) {
    editor.view.dispatch(tr.scrollIntoView());
  }
  return changed;
}

export function getTableCommand(id) {
  return TABLE_COMMANDS.find(function (command) {
    return command.id === id;
  }) || null;
}

export function isTableCommandEnabled(editor, context, id) {
  if (!getTableCommand(id)) {
    return false;
  }

  if (id === "table-properties") {
    return Boolean(context && context.isActive);
  }

  if (isCellFormattingCommand(id)) {
    return Boolean(context && context.canFormatSelection);
  }

  return Boolean(context && context.canUseStructuralCommands && canRunChainCommand(editor, STRUCTURAL_COMMANDS[id]));
}

export function executeTableCommand(editor, context, id, payload) {
  if (!getTableCommand(id)) {
    return false;
  }

  if (id === "table-properties") {
    return openTablePropertiesDialog({ editor, context });
  }

  if (isCellFormattingCommand(id)) {
    return applySelectedCellStyles(editor, context, id, payload);
  }

  if (!context || !context.canUseStructuralCommands) {
    return false;
  }

  return runChainCommand(editor, STRUCTURAL_COMMANDS[id]);
}
