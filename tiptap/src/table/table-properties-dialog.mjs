import {
  getActiveTableRowElement,
  getStyleValue,
  getTableNodePosition,
  setClassToken,
  setStyleValue,
  updateNodeAttributesAtPos,
  updateNodeStyleAtPos
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

function getTableColumnCellPositions(editor, table, columnIndex) {
  if (!table || columnIndex < 0) {
    return [];
  }

  return Array.from(table.rows || []).map(function (row) {
    const cell = row.cells && row.cells[columnIndex] ? row.cells[columnIndex] : null;
    if (!cell) {
      return null;
    }

    const pos = getTableNodePosition(editor, cell);
    return pos == null ? null : {
      pos,
      fallbackStyle: cell.getAttribute("style") || ""
    };
  }).filter(Boolean);
}

function applyStyleToTableColumnCells(editor, cellPositions, propertyName, value) {
  if (!editor || !editor.state || !editor.view || !cellPositions.length) {
    return false;
  }

  let tr = editor.state.tr;
  let changed = false;
  cellPositions.forEach(function ({ pos, fallbackStyle }) {
    const node = editor.state.doc.nodeAt(pos);
    if (!node) {
      return;
    }

    const style = setStyleValue(node.attrs.style || fallbackStyle || "", propertyName, value);
    tr = tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      style: style || null
    }, node.marks);
    changed = true;
  });

  if (changed) {
    editor.view.dispatch(tr.scrollIntoView());
  }
  return changed;
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

  const activeCell = context.activeCellElement;
  const columnCellPositions = activeCell ? getTableColumnCellPositions(editor, table, activeCell.cellIndex) : [];
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

  updateNodeAttributesAtPos(editor, tablePos, {
    class: className || null,
    style: style || null
  });

  if (values.columnWidth) {
    applyStyleToTableColumnCells(editor, columnCellPositions, "width", values.columnWidth);
  }

  if (values.rowHeight && rowPos != null) {
    updateNodeStyleAtPos(editor, rowPos, rowFallbackStyle, function (rowStyle) {
      return setStyleValue(rowStyle, "height", values.rowHeight);
    });
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
  form.appendChild(createDialogField("Current column width", columnWidth));

  const rowHeight = document.createElement("input");
  rowHeight.className = "form-control form-control-sm";
  rowHeight.placeholder = "3rem, 48px";
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
