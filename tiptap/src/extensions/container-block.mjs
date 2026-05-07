import { Node } from "@tiptap/core";

import { hasBlockDescendantChildren } from "../normalization/legacy-html.mjs";
import { createPreservedAttribute } from "../shared/preserved-attrs.mjs";

const ContainerBlock = Node.create({
  name: "containerBlock",
  group: "block",
  content: "block+",
  addAttributes() {
    return {
      tagName: {
        default: "div",
        parseHTML: function (element) {
          const tagName = String(element.tagName || "").toLowerCase();
          return ["article", "div", "section"].includes(tagName) ? tagName : "div";
        }
      },
      class: createPreservedAttribute("class"),
      dir: createPreservedAttribute("dir"),
      id: createPreservedAttribute("id"),
      lang: createPreservedAttribute("lang"),
      style: createPreservedAttribute("style"),
      title: createPreservedAttribute("title")
    };
  },
  parseHTML() {
    return [
      {
        tag: "article",
        getAttrs: function (element) {
          return hasBlockDescendantChildren(element) ? null : false;
        }
      },
      {
        tag: "div",
        getAttrs: function (element) {
          return hasBlockDescendantChildren(element) ? null : false;
        }
      },
      {
        tag: "section",
        getAttrs: function (element) {
          return hasBlockDescendantChildren(element) ? null : false;
        }
      }
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const {
      tagName,
      ...rest
    } = HTMLAttributes;
    const normalizedTag = ["article", "div", "section"].includes(tagName) ? tagName : "div";
    return [normalizedTag, rest, 0];
  }
});

export default ContainerBlock;
