import { mergeAttributes, Node } from "@tiptap/core";

export const DND_ALIGNMENT_OPTIONS = [
  { id: "lg", label: "Lawful Good", abbreviation: "LG" },
  { id: "ng", label: "Neutral Good", abbreviation: "NG" },
  { id: "cg", label: "Chaotic Good", abbreviation: "CG" },
  { id: "ln", label: "Lawful Neutral", abbreviation: "LN" },
  { id: "tn", label: "True Neutral", abbreviation: "TN" },
  { id: "cn", label: "Chaotic Neutral", abbreviation: "CN" },
  { id: "le", label: "Lawful Evil", abbreviation: "LE" },
  { id: "ne", label: "Neutral Evil", abbreviation: "NE" },
  { id: "ce", label: "Chaotic Evil", abbreviation: "CE" }
];

const ALIGNMENT_IDS = new Set(DND_ALIGNMENT_OPTIONS.map(function (option) {
  return option.id;
}));

export function normalizeAlignments(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(/\s+/);
  return Array.from(new Set(values.map(function (item) {
    return String(item || "").trim().toLowerCase();
  }).filter(function (item) {
    return ALIGNMENT_IDS.has(item);
  })));
}

export function normalizeAlignmentTableMode(value) {
  return String(value || "").trim().toLowerCase() === "full" ? "full" : "compact";
}

const WikiAlignmentTable = Node.create({
  name: "wikiAlignmentTable",
  priority: 1000,
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      highlighted: {
        default: "",
        parseHTML: function (element) {
          return normalizeAlignments(element.getAttribute("data-alignments")).join(" ");
        },
        renderHTML: function (attributes) {
          const highlighted = normalizeAlignments(attributes.highlighted).join(" ");
          return highlighted ? { "data-alignments": highlighted } : {};
        }
      },
      mode: {
        default: "compact",
        parseHTML: function (element) {
          return normalizeAlignmentTableMode(element.getAttribute("data-mode"));
        },
        renderHTML: function (attributes) {
          return { "data-mode": normalizeAlignmentTableMode(attributes.mode) };
        }
      }
    };
  },
  parseHTML() {
    return [
      {
        tag: '[data-wiki-node="alignment-table"]'
      }
    ];
  },
  renderHTML({ HTMLAttributes, node }) {
    const active = new Set(normalizeAlignments(node.attrs.highlighted));
    const mode = normalizeAlignmentTableMode(node.attrs.mode);
    const cells = DND_ALIGNMENT_OPTIONS.map(function (option) {
      const classes = ["wiki-alignment-table__cell"];
      if (active.has(option.id)) {
        classes.push("wiki-alignment-table__cell--active");
      }
      return ["div", {
        class: classes.join(" "),
        "data-alignment": option.id
      }, mode === "full" ? option.label : option.abbreviation];
    });

    return ["div", mergeAttributes({
      class: `wiki-alignment-table wiki-alignment-table--${mode}`,
      "data-wiki-node": "alignment-table",
      contenteditable: "false"
    }, HTMLAttributes), ...cells];
  },
  addCommands() {
    return {
      insertWikiAlignmentTable: attributes => ({ commands }) => commands.insertContent({
        type: this.name,
        attrs: {
          highlighted: normalizeAlignments(attributes && attributes.highlighted).join(" "),
          mode: normalizeAlignmentTableMode(attributes && attributes.mode)
        }
      }),
      updateWikiAlignmentTable: attributes => ({ commands }) => commands.updateAttributes(this.name, {
        highlighted: normalizeAlignments(attributes && attributes.highlighted).join(" "),
        mode: normalizeAlignmentTableMode(attributes && attributes.mode)
      })
    };
  }
});

export default WikiAlignmentTable;
