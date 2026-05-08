export const TOP_TOOLBAR_GROUPS = [
  {
    id: "history",
    label: "History",
    buttonIds: ["undo", "redo"]
  },
  {
    id: "structure",
    label: "Text structure",
    buttonIds: ["paragraph", "heading-1", "heading-2", "heading-3", "heading-4"]
  },
  {
    id: "inline-formatting",
    label: "Inline formatting",
    buttonIds: ["bold", "italic", "underline", "strike", "inline-code", "highlight", "subscript", "superscript"]
  },
  {
    id: "links-media",
    label: "Links and media",
    buttonIds: ["link", "unlink", "image-upload", "media-row-2", "media-row-3"]
  },
  {
    id: "blocks",
    label: "Blocks",
    buttonIds: ["bullet-list", "ordered-list", "task-list", "blockquote", "code-block", "horizontal-rule"]
  },
  {
    id: "callouts",
    label: "Callouts",
    buttonIds: ["callout-info", "callout-warning", "callout-danger"]
  },
  {
    id: "alignment",
    label: "Text alignment",
    buttonIds: ["align-left", "align-center", "align-right", "align-justify"]
  },
  {
    id: "tables",
    label: "Tables",
    buttonIds: ["table-insert", "table-add-row", "table-add-column", "table-delete"]
  }
];

export const TOP_TOOLBAR_BUTTON_IDS = TOP_TOOLBAR_GROUPS.flatMap(function (group) {
  return group.buttonIds;
});

export const IMAGE_CONTEXT_BUTTON_IDS = [
  "image-align-center",
  "image-align-left",
  "image-align-right",
  "image-align-side",
  "image-size-sm",
  "image-size-md",
  "image-size-lg",
  "image-size-full"
];

export function isImageContextButton(id) {
  return IMAGE_CONTEXT_BUTTON_IDS.includes(id);
}
