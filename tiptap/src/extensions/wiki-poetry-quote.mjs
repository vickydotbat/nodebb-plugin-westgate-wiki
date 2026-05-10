import { mergeAttributes, Node } from "@tiptap/core";

function normalizeQuoteText(value, fallback) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function normalizeAttribution(value) {
  const text = normalizeQuoteText(value, "Author").replace(/^[\s-]+/, "").trim();
  return `— ${text || "Author"}`;
}

const WikiPoetryQuote = Node.create({
  name: "wikiPoetryQuote",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      container: {
        default: true,
        parseHTML: function (element) {
          return element.getAttribute("data-wiki-quote-container") !== "false";
        }
      }
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure.wiki-poetry-quote",
        contentElement: "blockquote"
      }
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const hasContainer = HTMLAttributes.container !== false;
    const className = hasContainer ? "wiki-poetry-quote" : "wiki-poetry-quote wiki-poetry-quote--plain";
    const attrs = mergeAttributes(
      HTMLAttributes,
      {
        class: className,
        "data-wiki-node": "poetry-quote"
      },
      hasContainer ? {} : { "data-wiki-quote-container": "false" }
    );
    delete attrs.container;

    return [
      "figure",
      attrs,
      ["blockquote", { class: "wiki-poetry-quote__body" }, 0]
    ];
  },
  addCommands() {
    return {
      insertWikiPoetryQuote:
        (attrs) =>
        ({ commands, state }) => {
          const { from, to, empty } = state.selection;
          const selectedText = empty ? "" : state.doc.textBetween(from, to, " ", " ");
          const quote = normalizeQuoteText(attrs && attrs.quote, selectedText || "Spoken words.");
          const attribution = normalizeAttribution(attrs && attrs.attribution);

          return commands.insertContent({
            type: this.name,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: quote }]
              },
              {
                type: "paragraph",
                attrs: { class: "wiki-poetry-quote__attribution" },
                content: [{ type: "text", text: attribution }]
              }
            ]
          });
        },
      toggleWikiPoetryQuoteContainer:
        () =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection;
          for (let depth = $from.depth; depth > 0; depth -= 1) {
            const node = $from.node(depth);
            if (node.type.name === this.name) {
              if (dispatch) {
                const pos = $from.before(depth);
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  container: node.attrs.container === false
                });
              }
              return true;
            }
          }
          return false;
        },
      unsetWikiPoetryQuote:
        () =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection;
          for (let depth = $from.depth; depth > 0; depth -= 1) {
            const node = $from.node(depth);
            if (node.type.name === this.name) {
              if (dispatch) {
                tr.replaceWith($from.before(depth), $from.after(depth), node.content).scrollIntoView();
              }
              return true;
            }
          }
          return false;
        }
    };
  },
  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { state } = this.editor;
        const { $from } = state.selection;
        if ($from.parent.type.name !== "paragraph" || $from.parent.content.size !== 0) {
          return false;
        }
        for (let depth = $from.depth; depth > 0; depth -= 1) {
          if ($from.node(depth).type.name === this.name) {
            return this.editor.commands.unsetWikiPoetryQuote();
          }
        }
        return false;
      }
    };
  }
});

export default WikiPoetryQuote;
