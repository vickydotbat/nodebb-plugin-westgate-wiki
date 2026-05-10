import Link from "@tiptap/extension-link";
import { mergeAttributes } from "@tiptap/core";

const INERT_LINK_CLASS = "wiki-editor-link";
const EXTERNAL_LINK_CLASS = "wiki-external-link";

function appendClass(existingClass, nextClass) {
  const tokens = String(`${existingClass || ""} ${nextClass || ""}`)
    .split(/\s+/)
    .map(function (token) {
      return token.trim();
    })
    .filter(Boolean);
  return Array.from(new Set(tokens)).join(" ");
}

function readLinkAttribute(element, attrName) {
  return element.getAttribute(attrName) || element.getAttribute(`data-wiki-link-${attrName}`) || null;
}

function isExternalHref(href) {
  return /^(?:https?:)?\/\//i.test(String(href || "").trim());
}

const WikiLink = Link.extend({
  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: function (element) {
          return readLinkAttribute(element, "href");
        }
      },
      target: {
        default: this.options.HTMLAttributes.target,
        parseHTML: function (element) {
          return readLinkAttribute(element, "target");
        }
      },
      rel: {
        default: this.options.HTMLAttributes.rel,
        parseHTML: function (element) {
          return readLinkAttribute(element, "rel");
        }
      },
      class: {
        default: this.options.HTMLAttributes.class,
        parseHTML: function (element) {
          return element.getAttribute("class");
        }
      },
      title: {
        default: null,
        parseHTML: function (element) {
          return element.getAttribute("title");
        }
      }
    };
  },
  parseHTML() {
    return [
      {
        tag: "a[href]"
      },
      {
        tag: "span[data-wiki-link-href]"
      }
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const { href, target, rel, class: className, title } = HTMLAttributes;
    const attrs = {
      class: appendClass(
        appendClass(className, INERT_LINK_CLASS),
        isExternalHref(href) ? EXTERNAL_LINK_CLASS : ""
      )
    };

    if (href) {
      attrs["data-wiki-link-href"] = href;
    }
    if (target) {
      attrs["data-wiki-link-target"] = target;
    }
    if (rel) {
      attrs["data-wiki-link-rel"] = rel;
    }
    if (title) {
      attrs.title = title;
    }

    return ["span", mergeAttributes(attrs), 0];
  }
});

export default WikiLink;
