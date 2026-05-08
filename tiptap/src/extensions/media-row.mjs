import { Node } from "@tiptap/core";

export const MediaCell = Node.create({
  name: "mediaCell",
  content: "block+",
  defining: true,
  parseHTML() {
    return [
      { tag: "div.wiki-media-cell" },
      { tag: "section.wiki-media-cell" },
      { tag: "article.wiki-media-cell" }
    ];
  },
  renderHTML() {
    return ["div", { class: "wiki-media-cell", "data-wiki-node": "media-cell" }, 0];
  }
});

export const MediaRow = Node.create({
  name: "mediaRow",
  group: "block",
  content: "mediaCell+",
  defining: true,
  addCommands() {
    return {
      insertMediaRow:
        (columns) =>
        ({ commands }) => {
          const count = Math.max(2, Math.min(3, parseInt(columns, 10) || 2));
          return commands.insertContent({
            type: this.name,
            content: Array.from({ length: count }).map(function () {
              return {
                type: "mediaCell",
                content: [{ type: "paragraph" }]
              };
            })
          });
        }
    };
  },
  parseHTML() {
    return [
      { tag: "div.wiki-media-row" },
      { tag: "section.wiki-media-row" },
      { tag: "article.wiki-media-row" }
    ];
  },
  renderHTML() {
    return ["div", { class: "wiki-media-row", "data-wiki-node": "media-row" }, 0];
  }
});
