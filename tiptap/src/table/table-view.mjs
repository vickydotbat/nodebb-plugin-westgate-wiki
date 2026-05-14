import { TableView } from "@tiptap/extension-table";

function hasStyleProperty(style, propertyName) {
  const probe = document.createElement("div");
  probe.setAttribute("style", String(style || ""));
  return !!probe.style.getPropertyValue(propertyName).trim();
}

export function applyTableNodeAttributesToView(table, attrs) {
  if (!table) {
    return;
  }

  const className = String(attrs && attrs.class || "").trim();
  if (className) {
    table.setAttribute("class", className);
  } else {
    table.removeAttribute("class");
  }

  const style = String(attrs && attrs.style || "").trim();
  const managedWidth = table.style.width;
  const minWidth = table.style.minWidth;
  if (style) {
    table.setAttribute("style", style);
  } else {
    table.removeAttribute("style");
  }
  if (managedWidth && !table.style.width && !hasStyleProperty(style, "width")) {
    table.style.width = managedWidth;
  }
  if (minWidth && !table.style.minWidth && !hasStyleProperty(style, "min-width")) {
    table.style.minWidth = minWidth;
  }
}

export class WestgateTableView extends TableView {
  constructor(node, cellMinWidth, view) {
    super(node, cellMinWidth, view);
    applyTableNodeAttributesToView(this.table, node.attrs);
  }

  update(node) {
    const updated = super.update(node);
    if (updated) {
      applyTableNodeAttributesToView(this.table, node.attrs);
    }
    return updated;
  }
}
