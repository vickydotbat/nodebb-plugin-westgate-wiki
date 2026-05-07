import { Mark } from "@tiptap/core";

import { createPreservedAttribute, getMergedAttrsForElement, hasPreservedAttrs } from "../shared/preserved-attrs.mjs";

const StyledSpan = Mark.create({
  name: "styledSpan",
  inclusive: true,
  addAttributes() {
    return {
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
        tag: "span",
        getAttrs: function (element) {
          const attrs = getMergedAttrsForElement(element);
          return hasPreservedAttrs(attrs) ? attrs : false;
        }
      }
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0];
  }
});

export default StyledSpan;
