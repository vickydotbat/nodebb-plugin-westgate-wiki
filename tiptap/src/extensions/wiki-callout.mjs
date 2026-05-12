import { mergeAttributes, Node } from "@tiptap/core";
import { DOMParser } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";

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

function appendCalloutContentWithoutNestedCallouts(target, node) {
  if (node.nodeType === 3) {
    target.appendChild(node.cloneNode(true));
    return;
  }

  if (node.nodeType !== 1) {
    return;
  }

  const element = node;
  if (element.matches("aside.wiki-callout")) {
    Array.from(element.childNodes).forEach(function (child) {
      appendCalloutContentWithoutNestedCallouts(target, child);
    });
    return;
  }

  const clone = element.cloneNode(false);
  Array.from(element.childNodes).forEach(function (child) {
    appendCalloutContentWithoutNestedCallouts(clone, child);
  });
  target.appendChild(clone);
}

function parseCalloutContentWithoutNestedCallouts(element, schema) {
  const container = element.ownerDocument.createElement("div");
  Array.from(element.childNodes).forEach(function (child) {
    appendCalloutContentWithoutNestedCallouts(container, child);
  });
  return DOMParser.fromSchema(schema).parseSlice(container).content;
}

function collectNestedCalloutRanges(doc, typeName) {
  const ranges = [];

  function visit(node, pos, insideCallout) {
    node.forEach(function (child, offset) {
      const childPos = pos + offset + 1;
      const isCallout = child.type.name === typeName;
      if (isCallout && insideCallout) {
        ranges.push({
          from: childPos,
          to: childPos + child.nodeSize,
          content: child.content
        });
      }
      visit(child, childPos, insideCallout || isCallout);
    });
  }

  visit(doc, -1, false);
  return ranges;
}

function unwrapNestedCallouts(state, dispatch, typeName) {
  const ranges = collectNestedCalloutRanges(state.doc, typeName);
  if (!ranges.length) {
    return false;
  }

  if (dispatch) {
    const tr = state.tr;
    ranges
      .sort(function (a, b) {
        return b.from - a.from;
      })
      .forEach(function (range) {
        tr.replaceWith(range.from, range.to, range.content);
      });
    dispatch(tr);
  }

  return true;
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
      {
        tag: "aside.wiki-callout",
        getContent: parseCalloutContentWithoutNestedCallouts
      }
    ];
  },
  onCreate() {
    unwrapNestedCallouts(this.editor.state, this.editor.view.dispatch, this.name);
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
        },
      unsetWikiCallout:
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
            return this.editor.commands.unsetWikiCallout();
          }
        }
        return false;
      }
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("wikiCalloutNoNestedCallouts"),
        appendTransaction: (transactions, oldState, newState) => {
          if (!transactions.some(function (transaction) { return transaction.docChanged; })) {
            return null;
          }

          const ranges = collectNestedCalloutRanges(newState.doc, this.name);
          if (!ranges.length) {
            return null;
          }

          const tr = newState.tr;
          ranges
            .sort(function (a, b) {
              return b.from - a.from;
            })
            .forEach(function (range) {
              tr.replaceWith(range.from, range.to, range.content);
            });
          return tr;
        }
      })
    ];
  }
});

export default WikiCallout;
