import { TableView } from "@tiptap/extension-table";

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
  const minWidth = table.style.minWidth;
  table.setAttribute("style", style);
  if (minWidth && !table.style.minWidth) {
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
