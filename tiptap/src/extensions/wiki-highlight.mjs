import { Mark, markInputRule, markPasteRule, mergeAttributes } from "@tiptap/core";

import { getReadableTextColor } from "../shared/color-contrast.mjs";
import { sanitizeStyleAttribute } from "../shared/sanitizer-contract.mjs";

export const inputRegex = /(?:^|\s)(==(?!\s+==)((?:[^=]+))==(?!\s+==))$/;
export const pasteRegex = /(?:^|\s)(==(?!\s+==)((?:[^=]+))==(?!\s+==))/g;

function sanitizeColor(value, propertyName) {
  const sanitized = sanitizeStyleAttribute(`${propertyName}: ${value}`, "mark");
  const match = sanitized.match(new RegExp(`(?:^|;\\s*)${propertyName}:\\s*([^;]+)`, "i"));
  return match ? match[1].trim() : "";
}

const WikiHighlight = Mark.create({
  name: "highlight",
  addOptions() {
    return {
      multicolor: false,
      HTMLAttributes: {}
    };
  },
  addAttributes() {
    if (!this.options.multicolor) {
      return {};
    }

    return {
      color: {
        default: null,
        parseHTML: function (element) {
          return element.getAttribute("data-color") || element.style.backgroundColor || null;
        },
        renderHTML: function (attributes) {
          if (!attributes.color) {
            return {};
          }

          const backgroundColor = sanitizeColor(attributes.color, "background-color");
          if (!backgroundColor) {
            return {};
          }

          const textColor = sanitizeColor(attributes.textColor, "color") || sanitizeColor(getReadableTextColor(attributes.color), "color");
          return {
            "data-color": attributes.color,
            style: `background-color: ${backgroundColor}; color: ${textColor}`
          };
        }
      },
      textColor: {
        default: null,
        parseHTML: function (element) {
          return element.getAttribute("data-text-color") || element.style.color || null;
        },
        renderHTML: function (attributes) {
          return attributes.textColor ? { "data-text-color": attributes.textColor } : {};
        }
      }
    };
  },
  parseHTML() {
    return [
      {
        tag: "mark"
      }
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["mark", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
  addCommands() {
    return {
      setHighlight: attributes => ({ commands }) => commands.setMark(this.name, attributes),
      toggleHighlight: attributes => ({ commands }) => commands.toggleMark(this.name, attributes),
      unsetHighlight: () => ({ commands }) => commands.unsetMark(this.name)
    };
  },
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-h": () => this.editor.commands.toggleHighlight()
    };
  },
  addInputRules() {
    return [
      markInputRule({
        find: inputRegex,
        type: this.type
      })
    ];
  },
  addPasteRules() {
    return [
      markPasteRule({
        find: pasteRegex,
        type: this.type
      })
    ];
  }
});

export default WikiHighlight;
