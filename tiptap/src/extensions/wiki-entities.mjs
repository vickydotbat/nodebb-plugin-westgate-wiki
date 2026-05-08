import { Mark, mergeAttributes } from "@tiptap/core";

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripUnsafeInlineHtml(value) {
  const doc = new DOMParser().parseFromString(`<div>${String(value || "")}</div>`, "text/html");
  doc.body.querySelectorAll("script, style, iframe, object, embed").forEach(function (element) {
    element.remove();
  });
  return (doc.body.firstElementChild && doc.body.firstElementChild.innerHTML || "")
    .replace(/\s+on[a-z]+\s*=\s*(["']).*?\1/gi, "")
    .trim();
}

function encodeBase64Utf8(value) {
  const text = String(value || "");
  if (typeof window !== "undefined" && window.btoa && window.TextEncoder) {
    const bytes = new window.TextEncoder().encode(text);
    let binary = "";
    bytes.forEach(function (byte) {
      binary += String.fromCharCode(byte);
    });
    return window.btoa(binary);
  }
  return btoa(unescape(encodeURIComponent(text)));
}

function decodeBase64Utf8(value) {
  const source = String(value || "").trim();
  if (!source) {
    return "";
  }
  try {
    if (typeof window !== "undefined" && window.atob && window.TextDecoder) {
      const binary = window.atob(source);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new window.TextDecoder("utf-8").decode(bytes);
    }
    return decodeURIComponent(escape(atob(source)));
  } catch (err) {
    return "";
  }
}

function entityClass(type) {
  return `wiki-entity wiki-entity--${type}`;
}

function normalizeResolvedState(value) {
  if (value === true || value === "true" || value === "1" || value === 1) {
    return "1";
  }
  if (value === false || value === "false" || value === "0" || value === 0) {
    return "0";
  }
  return "";
}

function readAttr(element, name) {
  return element.getAttribute(name) || "";
}

function createEntityMark({ name, type, targetAttr, commandName, defaultPrefix }) {
  return Mark.create({
    name,
    priority: 1100,
    inclusive: false,
    addAttributes() {
      return {
        target: {
          default: "",
          parseHTML: function (element) {
            return cleanText(readAttr(element, targetAttr));
          }
        },
        label: {
          default: "",
          parseHTML: function (element) {
            return cleanText(readAttr(element, "data-wiki-label") || element.textContent);
          }
        }
      };
    },
    parseHTML() {
      return [{ tag: `span[data-wiki-entity="${type}"]` }];
    },
    renderHTML({ HTMLAttributes }) {
      const target = cleanText(HTMLAttributes.target);
      const label = cleanText(HTMLAttributes.label);
      return [
        "span",
        mergeAttributes({
          class: entityClass(type),
          "data-wiki-entity": type,
          [targetAttr]: target,
          "data-wiki-label": label
        }),
        0
      ];
    },
    addCommands() {
      return {
        [commandName]:
          (attrs) =>
          ({ commands }) => {
            const target = cleanText(attrs && attrs.target);
            const label = cleanText(attrs && attrs.label) || target.replace(/^ns:/i, "") || defaultPrefix;
            if (!target) {
              return false;
            }
            return commands.insertContent({
              type: "text",
              text: label,
              marks: [{
                type: name,
                attrs: { target, label }
              }]
            });
          }
      };
    }
  });
}

export const WikiPageLink = createEntityMark({
  name: "wikiPageLink",
  type: "page",
  targetAttr: "data-wiki-target",
  commandName: "insertWikiPageLink",
  defaultPrefix: "Page"
});

export const WikiNamespaceLink = createEntityMark({
  name: "wikiNamespaceLink",
  type: "namespace",
  targetAttr: "data-wiki-target",
  commandName: "insertWikiNamespaceLink",
  defaultPrefix: "Namespace"
});

export const WikiUserMention = Mark.create({
  name: "wikiUserMention",
  priority: 1100,
  inclusive: false,
  addAttributes() {
    return {
      username: {
        default: "",
        parseHTML: function (element) {
          return cleanText(readAttr(element, "data-wiki-username") || element.textContent.replace(/^@/, ""));
        }
      },
      userslug: {
        default: "",
        parseHTML: function (element) {
          return cleanText(readAttr(element, "data-wiki-userslug"));
        }
      },
      uid: {
        default: "",
        parseHTML: function (element) {
          return cleanText(readAttr(element, "data-wiki-uid"));
        }
      },
      resolved: {
        default: "",
        parseHTML: function (element) {
          return normalizeResolvedState(readAttr(element, "data-wiki-resolved"));
        }
      }
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-wiki-entity="user"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    const username = cleanText(HTMLAttributes.username).replace(/^@/, "");
    const resolved = normalizeResolvedState(HTMLAttributes.resolved);
    const stateClass = resolved === "1" ? " wiki-entity--user-good" : (resolved === "0" ? " wiki-entity--user-bad" : " wiki-entity--user-pending");
    const attrs = {
      class: `${entityClass("user")}${stateClass}`,
      "data-wiki-entity": "user",
      "data-wiki-username": username,
      "data-wiki-resolved": resolved,
      spellcheck: "false"
    };
    if (HTMLAttributes.userslug) {
      attrs["data-wiki-userslug"] = cleanText(HTMLAttributes.userslug);
    }
    if (HTMLAttributes.uid) {
      attrs["data-wiki-uid"] = cleanText(HTMLAttributes.uid);
    }
    return ["span", mergeAttributes(attrs), 0];
  },
  addCommands() {
    return {
      insertWikiUserMention:
        (attrs) =>
        ({ commands }) => {
          const username = cleanText(attrs && attrs.username).replace(/^@/, "");
          if (!username) {
            return false;
          }
          return commands.insertContent({
            type: "text",
            text: `@${username}`,
            marks: [{
              type: this.name,
              attrs: {
                username,
                userslug: cleanText(attrs && attrs.userslug),
                uid: cleanText(attrs && attrs.uid),
                resolved: normalizeResolvedState(
                  attrs && Object.prototype.hasOwnProperty.call(attrs, "resolved")
                    ? attrs.resolved
                    : !!(attrs && (attrs.uid || attrs.userslug))
                )
              }
            }]
          });
        }
    };
  }
});

export const WikiFootnote = Mark.create({
  name: "wikiFootnote",
  priority: 1100,
  inclusive: false,
  addAttributes() {
    return {
      body: {
        default: "",
        parseHTML: function (element) {
          return stripUnsafeInlineHtml(
            decodeBase64Utf8(readAttr(element, "data-wiki-footnote-b64")) ||
              readAttr(element, "data-wiki-footnote")
          );
        }
      }
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-wiki-entity="footnote"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes({
        class: entityClass("footnote"),
        "data-wiki-entity": "footnote",
        "data-wiki-footnote-b64": encodeBase64Utf8(stripUnsafeInlineHtml(HTMLAttributes.body))
      }),
      0
    ];
  },
  addCommands() {
    return {
      insertWikiFootnote:
        (attrs) =>
        ({ commands }) => {
          const body = stripUnsafeInlineHtml(attrs && attrs.body);
          if (!body) {
            return false;
          }
          return commands.insertContent({
            type: "text",
            text: "[note]",
            marks: [{
              type: this.name,
              attrs: { body }
            }]
          });
        }
    };
  }
});
