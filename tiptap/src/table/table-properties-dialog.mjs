import { TableMap } from "@tiptap/pm/tables";

import {
  getActiveTableRowElement,
  getStyleValue,
  getTableNodePosition,
  setClassToken,
  setStyleValue
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

function getTableColumnCellPositions(editor, context) {
  const tablePos = context && context.activeTablePos;
  const tableNode = Number.isFinite(tablePos) && editor && editor.state ? editor.state.doc.nodeAt(tablePos) : null;
  const columnIndex = context && context.selectedColumnIndexes && context.selectedColumnIndexes.length
    ? context.selectedColumnIndexes[0]
    : -1;
  if (!tableNode || !Number.isInteger(columnIndex) || columnIndex < 0) {
    return [];
  }

  const tableMap = TableMap.get(tableNode);
  if (columnIndex >= tableMap.width) {
    return [];
  }

  const seen = new Set();
  const positions = [];
  for (let rowIndex = 0; rowIndex < tableMap.height; rowIndex += 1) {
    const relativeCellPos = tableMap.map[(rowIndex * tableMap.width) + columnIndex];
    const pos = tablePos + 1 + relativeCellPos;
    if (seen.has(pos)) {
      continue;
    }
    seen.add(pos);
    const rect = tableMap.findCell(relativeCellPos);
    positions.push({
      pos,
      colwidthIndex: rect ? columnIndex - rect.left : 0
    });
  }
  return positions;
}

function getPixelWidth(value) {
  const match = String(value || "").trim().match(/^(\d+(?:\.\d+)?)px$/i);
  return match ? Math.round(parseFloat(match[1])) : null;
}

function getCellColumnWidthValue(node, fallbackStyle, colwidthIndex) {
  const colwidth = node && node.attrs && Array.isArray(node.attrs.colwidth)
    ? node.attrs.colwidth[colwidthIndex || 0]
    : null;
  if (Number.isFinite(colwidth) && colwidth > 0) {
    return `${colwidth}px`;
  }

  return getStyleValue(node && node.attrs && node.attrs.style || fallbackStyle || "", "width");
}

function getActiveColumnWidthValue(editor, context) {
  const columnCellPositions = getTableColumnCellPositions(editor, context);
  for (const { pos, colwidthIndex } of columnCellPositions) {
    const node = editor.state.doc.nodeAt(pos);
    const value = getCellColumnWidthValue(node, "", colwidthIndex);
    if (value) {
      return value;
    }
  }
  return "";
}

function getActiveRowHeightValue(editor, table) {
  const activeRow = getActiveTableRowElement(editor, table);
  const rowPos = activeRow ? getTableNodePosition(editor, activeRow) : null;
  const rowNode = rowPos != null ? editor.state.doc.nodeAt(rowPos) : null;
  return getStyleValue(rowNode && rowNode.attrs && rowNode.attrs.style || activeRow && activeRow.getAttribute("style") || "", "height");
}

function setNodeAttrsOnTransaction(tr, editor, pos, attrs) {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) {
    return false;
  }

  tr.setNodeMarkup(pos, undefined, {
    ...node.attrs,
    ...attrs
  }, node.marks);
  return true;
}

export function applyActiveTableProperties(editor, context, values) {
  const table = context && context.activeTableElement;
  if (!editor || !table) {
    return false;
  }

  const tablePos = Number.isFinite(context.activeTablePos)
    ? context.activeTablePos
    : getTableNodePosition(editor, table);
  if (tablePos == null) {
    return false;
  }

  let tr = editor.state.tr;
  let changed = false;
  const columnCellPositions = getTableColumnCellPositions(editor, context);
  const activeRow = getActiveTableRowElement(editor, table);
  const rowPos = activeRow ? getTableNodePosition(editor, activeRow) : null;
  const rowFallbackStyle = activeRow ? activeRow.getAttribute("style") || "" : "";
  const tableAttrs = context.tableAttrs || {};
  let style = tableAttrs.style || table.getAttribute("style") || "";
  style = setStyleValue(style, "width", values.tableWidth);
  style = setStyleValue(style, "border-color", values.borderColor);

  let className = setClassToken(
    tableAttrs.class || table.getAttribute("class") || "",
    "wiki-table-borderless",
    values.borderMode === "hidden"
  );
  className = setClassToken(className, "wiki-table-layout-auto", values.layout === "auto");
  className = setClassToken(className, "wiki-table-layout-fixed", values.layout !== "auto");

  changed = setNodeAttrsOnTransaction(tr, editor, tablePos, {
    class: className || null,
    style: style || null
  }) || changed;

  if (Object.prototype.hasOwnProperty.call(values, "columnWidth")) {
    const pixelWidth = getPixelWidth(values.columnWidth);
    columnCellPositions.forEach(function ({ pos, colwidthIndex }) {
      const node = editor.state.doc.nodeAt(pos);
      if (!node) {
        return;
      }

      const cellStyle = setStyleValue(node.attrs.style || "", "width", values.columnWidth);
      let colwidth = node.attrs.colwidth;
      if (pixelWidth) {
        colwidth = Array.isArray(colwidth) ? colwidth.slice() : new Array(node.attrs.colspan || 1).fill(0);
        colwidth[colwidthIndex || 0] = pixelWidth;
      } else if (Array.isArray(colwidth)) {
        colwidth = colwidth.slice();
        colwidth[colwidthIndex || 0] = 0;
        if (!colwidth.some(function (width) {
          return Number.isFinite(width) && width > 0;
        })) {
          colwidth = null;
        }
      }
      changed = setNodeAttrsOnTransaction(tr, editor, pos, {
        style: cellStyle || null,
        colwidth
      }) || changed;
    });
  }

  if (values.rowHeight && rowPos != null) {
    const rowNode = editor.state.doc.nodeAt(rowPos);
    const rowStyle = setStyleValue(rowNode && rowNode.attrs.style || rowFallbackStyle, "height", values.rowHeight);
    changed = setNodeAttrsOnTransaction(tr, editor, rowPos, { style: rowStyle || null }) || changed;
  }

  if (changed) {
    editor.view.dispatch(tr.scrollIntoView());
  }

  return true;
}

export function openTablePropertiesDialog({ editor, context }) {
  const table = context && context.activeTableElement;
  if (!editor || !table) {
    return false;
  }

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

  const attrs = context.tableAttrs || editor.getAttributes("table") || {};
  const tableWidth = document.createElement("input");
  tableWidth.className = "form-control form-control-sm";
  tableWidth.placeholder = "100%, 32rem, auto";
  tableWidth.value = getStyleValue(attrs.style, "width") || "100%";
  form.appendChild(createDialogField("Table width", tableWidth));

  const columnWidth = document.createElement("input");
  columnWidth.className = "form-control form-control-sm";
  columnWidth.placeholder = "12rem, 160px, 25%";
  columnWidth.value = getActiveColumnWidthValue(editor, context);
  form.appendChild(createDialogField("Current column width", columnWidth));

  const rowHeight = document.createElement("input");
  rowHeight.className = "form-control form-control-sm";
  rowHeight.placeholder = "3rem, 48px";
  rowHeight.value = getActiveRowHeightValue(editor, table);
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
  return true;
}
