import { mergeAttributes, Node } from "@tiptap/core";

const CALLOUT_TYPES = new Set(["info", "warning", "danger", "success", "note"]);

export function normalizeCalloutType(type) {
  const value = String(type || "").trim().toLowerCase();
  return CALLOUT_TYPES.has(value) ? value : "note";
}

function getCalloutTitle(element) {
  const attrTitle = element.getAttribute("data-callout-title");
  if (attrTitle) {
    return attrTitle;
  }

  const firstStrong = element.querySelector(":scope > p:first-child > strong:first-child");
  return firstStrong ? firstStrong.textContent.trim() : "";
}

const WikiCallout = Node.create({
  name: "wikiCallout",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      type: {
        default: "note",
        parseHTML: function (element) {
          return normalizeCalloutType(element.getAttribute("data-callout-type"));
        }
      },
      title: {
        default: null,
        parseHTML: function (element) {
          return getCalloutTitle(element) || null;
        }
      }
    };
  },
  parseHTML() {
    return [
      { tag: "aside.wiki-callout" }
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const type = normalizeCalloutType(HTMLAttributes.type);
    const title = String(HTMLAttributes.title || "").trim();
    const attrs = mergeAttributes(
      {
        class: `wiki-callout wiki-callout--${type}`,
        "data-callout-type": type
      },
      title ? { "data-callout-title": title } : {}
    );

    return ["aside", attrs, 0];
  },
  addCommands() {
    return {
      insertWikiCallout:
        (attrs) =>
        ({ commands }) => {
          const type = normalizeCalloutType(attrs && attrs.type);
          const title = attrs && attrs.title ? String(attrs.title).trim() : "";
          const content = [];
          if (title) {
            content.push({
              type: "paragraph",
              content: [
                {
                  type: "text",
                  marks: [{ type: "bold" }],
                  text: title
                }
              ]
            });
          }
          content.push({
            type: "paragraph",
            content: []
          });

          return commands.insertContent({
            type: this.name,
            attrs: {
              type,
              title: title || null
            },
            content
          });
        }
    };
  },
  addKeyboardShortcuts() {
    return {
      Backspace: function () {
        const { state } = this.editor;
        const { $from } = state.selection;
        if ($from.parent.type.name !== "paragraph" || $from.parent.content.size !== 0) {
          return false;
        }
        for (let depth = $from.depth; depth > 0; depth -= 1) {
          if ($from.node(depth).type.name === this.name) {
            return this.editor.commands.lift(this.name);
          }
        }
        return false;
      }
    };
  }
});

export default WikiCallout;
