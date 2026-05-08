import { Extension } from "@tiptap/core";

import { createPreservedAttribute, PRESERVED_GLOBAL_ATTRIBUTE_TYPES } from "../shared/preserved-attrs.mjs";

const PreservedNodeAttributes = Extension.create({
  name: "preservedNodeAttributes",
  addGlobalAttributes() {
    return [
      {
        types: PRESERVED_GLOBAL_ATTRIBUTE_TYPES,
        attributes: {
          class: createPreservedAttribute("class"),
          dir: createPreservedAttribute("dir"),
          id: createPreservedAttribute("id"),
          lang: createPreservedAttribute("lang"),
          style: createPreservedAttribute("style"),
          title: createPreservedAttribute("title")
        }
      }
    ];
  }
});

export default PreservedNodeAttributes;
