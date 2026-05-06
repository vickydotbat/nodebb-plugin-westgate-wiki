import "./wiki-editor.css";

import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

import { Editor, Extension, Mark, mergeAttributes, Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import CharacterCount from "@tiptap/extension-character-count";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";

import sanitizerConfig from "../../shared/wiki-html-sanitizer-config.json";

const markdownIt = new MarkdownIt({ html: true, linkify: true, typographer: true });

const SUPPORTED_TIPTAP_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "hr",
  "img",
  "input",
  "label",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul"
]);

const ALLOWED_IMAGE_FIGURE_CLASSES = new Set([
  "image",
  "image-style-side",
  "image-style-align-left",
  "image-style-align-right",
  "image-style-block"
]);

const PRESERVED_GLOBAL_ATTRIBUTE_TYPES = [
  "blockquote",
  "bulletList",
  "codeBlock",
  "heading",
  "image",
  "imageFigure",
  "link",
  "listItem",
  "orderedList",
  "paragraph",
  "table",
  "tableCell",
  "tableHeader",
  "tableRow",
  "taskItem",
  "taskList"
];

const COMPILED_ALLOWED_STYLES = compileAllowedStylesMap(sanitizerConfig.allowedStyles);

function createTurndown() {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    emDelimiter: "*"
  });
  td.use(gfm);
  return td;
}

function getAllowedAttributesList() {
  const attrs = new Set(["href", "target", "rel", "src", "alt", "title", "width", "height", "type", "checked", "disabled"]);
  Object.values(sanitizerConfig.allowedAttributes || {}).forEach(function (list) {
    (list || []).forEach(function (name) {
      if (!name.endsWith("*")) {
        attrs.add(name);
      }
    });
  });
  return Array.from(attrs);
}

function compileAllowedStylesMap(configMap) {
  return Object.fromEntries(
    Object.entries(configMap || {}).map(function ([tagName, properties]) {
      return [
        tagName,
        Object.fromEntries(
          Object.entries(properties || {}).map(function ([propertyName, patterns]) {
            return [propertyName, (patterns || []).map(function (pattern) { return new RegExp(pattern, "i"); })];
          })
        )
      ];
    })
  );
}

const DOMPURIFY_OPTIONS = {
  ALLOWED_TAGS: sanitizerConfig.allowedTags,
  ALLOWED_ATTR: getAllowedAttributesList(),
  ALLOW_DATA_ATTR: true
};

function unwrapElement(element) {
  const parent = element.parentNode;
  if (!parent) {
    return;
  }

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }

  parent.removeChild(element);
}

function replaceElement(element, replacement) {
  const parent = element.parentNode;
  if (!parent) {
    return;
  }

  parent.replaceChild(replacement, element);
}

function renameElement(document, element, tagName) {
  const replacement = document.createElement(tagName);
  Array.from(element.attributes || []).forEach(function (attr) {
    replacement.setAttribute(attr.name, attr.value);
  });

  while (element.firstChild) {
    replacement.appendChild(element.firstChild);
  }

  replaceElement(element, replacement);
}

function sanitizeAnchorTargets(root) {
  root.querySelectorAll("a[href]").forEach(function (link) {
    if (link.getAttribute("target") === "_blank" && !link.getAttribute("rel")) {
      link.setAttribute("rel", "noopener noreferrer");
    }
  });
}

function sanitizeStyleAttribute(styleValue, tagName) {
  const probe = document.createElement("span");
  probe.setAttribute("style", String(styleValue || ""));

  const allowedForAnyTag = COMPILED_ALLOWED_STYLES["*"] || {};
  const allowedForTag = COMPILED_ALLOWED_STYLES[String(tagName || "").toLowerCase()] || {};
  const entries = [];

  for (let i = 0; i < probe.style.length; i += 1) {
    const propertyName = String(probe.style[i] || "").trim().toLowerCase();
    if (!propertyName) {
      continue;
    }

    const rawValue = probe.style.getPropertyValue(propertyName).trim();
    const propertyAllowlist = allowedForTag[propertyName] || allowedForAnyTag[propertyName];
    if (!propertyAllowlist || !rawValue) {
      continue;
    }

    const normalizedValue = rawValue.replace(/\s+/g, " ").trim();
    const allowed = propertyAllowlist.some(function (pattern) {
      return pattern.test(normalizedValue);
    });
    if (allowed) {
      entries.push(`${propertyName}: ${normalizedValue}`);
    }
  }

  return entries.join("; ");
}

function sanitizeInlineStyles(root) {
  root.querySelectorAll("[style]").forEach(function (element) {
    const sanitizedStyle = sanitizeStyleAttribute(element.getAttribute("style"), element.tagName.toLowerCase());
    if (sanitizedStyle) {
      element.setAttribute("style", sanitizedStyle);
    } else {
      element.removeAttribute("style");
    }
  });
}

function getPreservedCommonAttrs(element) {
  return {
    class: element.getAttribute("class") || null,
    dir: element.getAttribute("dir") || null,
    id: element.getAttribute("id") || null,
    lang: element.getAttribute("lang") || null,
    style: sanitizeStyleAttribute(element.getAttribute("style"), element.tagName.toLowerCase()) || null,
    title: element.getAttribute("title") || null
  };
}

function getMergedAttrsForElement(element) {
  const attrs = getPreservedCommonAttrs(element);
  Object.keys(attrs).forEach(function (key) {
    if (!attrs[key]) {
      delete attrs[key];
    }
  });
  return attrs;
}

function hasPreservedAttrs(attrs) {
  return Object.values(attrs || {}).some(Boolean);
}

function createPreservedAttribute(attributeName) {
  return {
    default: null,
    parseHTML: function (element) {
      const attrs = getMergedAttrsForElement(element);
      return attrs[attributeName] || null;
    },
    renderHTML: function (attributes) {
      return attributes[attributeName] ? { [attributeName]: attributes[attributeName] } : {};
    }
  };
}

function normalizeClassTokens(value, allowedSet, requiredToken) {
  const tokens = String(value || "")
    .split(/\s+/)
    .map(function (token) { return token.trim(); })
    .filter(Boolean)
    .filter(function (token) { return allowedSet.has(token); });

  if (requiredToken && !tokens.includes(requiredToken)) {
    tokens.unshift(requiredToken);
  }

  return Array.from(new Set(tokens)).join(" ").trim();
}

function wrapNodeWithElement(document, node, tagName, attrs) {
  const wrapper = document.createElement(tagName);
  Object.entries(attrs || {}).forEach(function ([key, value]) {
    if (value != null && value !== "") {
      wrapper.setAttribute(key, value);
    }
  });
  if (node.parentNode) {
    node.parentNode.replaceChild(wrapper, node);
  }
  wrapper.appendChild(node);
  return wrapper;
}

function normalizeLegacyPresentationalTags(document, root) {
  [
    ["b", "strong"],
    ["center", "p"],
    ["font", "span"],
    ["i", "em"],
    ["small", "span"],
    ["big", "span"],
    ["strike", "s"],
    ["tt", "code"]
  ].forEach(function ([sourceTag, targetTag]) {
    root.querySelectorAll(sourceTag).forEach(function (element) {
      if (sourceTag === "center") {
        const style = sanitizeStyleAttribute(`text-align: center; ${element.getAttribute("style") || ""}`, targetTag);
        if (style) {
          element.setAttribute("style", style);
        }
      }

      if (sourceTag === "font") {
        const styleParts = [];
        const color = (element.getAttribute("color") || "").trim();
        const face = (element.getAttribute("face") || "").trim();
        const size = (element.getAttribute("size") || "").trim();

        if (color) {
          styleParts.push(`color: ${color}`);
        }
        if (face) {
          styleParts.push(`font-family: ${face}`);
        }
        if (size) {
          const numericSize = parseInt(size, 10);
          const fontSizeMap = {
            1: "0.75rem",
            2: "0.875rem",
            3: "1rem",
            4: "1.125rem",
            5: "1.5rem",
            6: "1.875rem",
            7: "2.25rem"
          };
          if (Number.isInteger(numericSize) && fontSizeMap[numericSize]) {
            styleParts.push(`font-size: ${fontSizeMap[numericSize]}`);
          }
        }

        if (styleParts.length > 0) {
          const mergedStyle = sanitizeStyleAttribute(
            `${element.getAttribute("style") || ""}; ${styleParts.join("; ")}`,
            "span"
          );
          if (mergedStyle) {
            element.setAttribute("style", mergedStyle);
          }
        }
      }

      if (sourceTag === "small" || sourceTag === "big") {
        const sizeKeyword = sourceTag === "small" ? "smaller" : "larger";
        const mergedStyle = sanitizeStyleAttribute(
          `${element.getAttribute("style") || ""}; font-size: ${sizeKeyword}`,
          "span"
        );
        if (mergedStyle) {
          element.setAttribute("style", mergedStyle);
        }
      }

      renameElement(document, element, targetTag);
    });
  });
}

function isPlainWrapperElement(element) {
  if (!element || !element.tagName) {
    return false;
  }

  if (element.getAttribute("data-root") === "1") {
    return false;
  }

  const attrs = element.getAttributeNames().filter(function (name) {
    return !name.startsWith("data-");
  });

  if (attrs.length > 0) {
    return false;
  }

  return !element.classList || element.classList.length === 0;
}

function hasBlockDescendantChildren(element) {
  return Array.from(element.children || []).some(function (child) {
    const tag = child.tagName.toLowerCase();
    return [
      "article",
      "blockquote",
      "div",
      "dl",
      "figure",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "ol",
      "p",
      "pre",
      "section",
      "table",
      "ul"
    ].includes(tag);
  });
}

function normalizeFigureImageClasses(figure) {
  const normalized = normalizeClassTokens(figure.getAttribute("class"), ALLOWED_IMAGE_FIGURE_CLASSES, "image");
  if (normalized) {
    figure.setAttribute("class", normalized);
  } else {
    figure.removeAttribute("class");
  }
}

function isSupportedImageFigure(figure) {
  if (!figure || figure.tagName.toLowerCase() !== "figure") {
    return false;
  }

  const figureClasses = normalizeClassTokens(figure.getAttribute("class"), ALLOWED_IMAGE_FIGURE_CLASSES, "image");
  if (!figureClasses.split(/\s+/).includes("image")) {
    return false;
  }

  const directChildren = Array.from(figure.children);
  if (directChildren.length === 0) {
    return false;
  }

  const mediaChild = directChildren.find(function (child) {
    const tag = child.tagName.toLowerCase();
    if (tag === "img") {
      return true;
    }
    if (tag === "a") {
      const anchorChildren = Array.from(child.children);
      return anchorChildren.length === 1 && anchorChildren[0].tagName.toLowerCase() === "img";
    }
    return false;
  });

  if (!mediaChild) {
    return false;
  }

  return directChildren.every(function (child) {
    if (child === mediaChild) {
      return true;
    }
    return child.tagName.toLowerCase() === "figcaption";
  });
}

function getFigureImageElement(figure) {
  if (!figure) {
    return null;
  }

  const directImage = Array.from(figure.children).find(function (child) {
    return child.tagName.toLowerCase() === "img";
  });
  if (directImage) {
    return directImage;
  }

  const linkedImage = Array.from(figure.children).find(function (child) {
    if (child.tagName.toLowerCase() !== "a") {
      return false;
    }
    const anchorChildren = Array.from(child.children);
    return anchorChildren.length === 1 && anchorChildren[0].tagName.toLowerCase() === "img";
  });

  return linkedImage ? linkedImage.querySelector("img") : null;
}

function getFigureImageLinkElement(figure) {
  const image = getFigureImageElement(figure);
  if (!image || !image.parentElement) {
    return null;
  }
  return image.parentElement.tagName.toLowerCase() === "a" ? image.parentElement : null;
}

function normalizeSupportedFigures(root) {
  root.querySelectorAll("figure").forEach(function (figure) {
    if (!isSupportedImageFigure(figure)) {
      return;
    }

    normalizeFigureImageClasses(figure);
  });
}

function normalizeStyledSpans(document, root) {
  root.querySelectorAll("span").forEach(function (element) {
    const style = element.style || {};
    const classes = element.getAttribute("class") || "";
    const attrs = getMergedAttrsForElement(element);
    const textDecoration = (style.textDecoration || "").trim().toLowerCase();
    const fontWeight = (style.fontWeight || "").trim().toLowerCase();
    const fontStyle = (style.fontStyle || "").trim().toLowerCase();
    const verticalAlign = (style.verticalAlign || "").trim().toLowerCase();

    if (fontWeight === "bold" || /^[5-9]00$/.test(fontWeight)) {
      wrapNodeWithElement(document, element, "strong", attrs);
      return;
    }

    if (fontStyle === "italic") {
      wrapNodeWithElement(document, element, "em", attrs);
      return;
    }

    if (textDecoration.includes("underline")) {
      wrapNodeWithElement(document, element, "u", attrs);
      return;
    }

    if (textDecoration.includes("line-through")) {
      wrapNodeWithElement(document, element, "s", attrs);
      return;
    }

    if (verticalAlign === "super") {
      wrapNodeWithElement(document, element, "sup", attrs);
      return;
    }

    if (verticalAlign === "sub") {
      wrapNodeWithElement(document, element, "sub", attrs);
      return;
    }

    if (!hasPreservedAttrs(attrs) && !classes.trim()) {
      unwrapElement(element);
    }
  });
}

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

function getFigureImageAttrs(element) {
  const image = getFigureImageElement(element);
  const link = getFigureImageLinkElement(element);

  return {
    src: image ? image.getAttribute("src") || null : null,
    alt: image ? image.getAttribute("alt") || null : null,
    title: image ? image.getAttribute("title") || null : null,
    width: image ? image.getAttribute("width") || null : null,
    height: image ? image.getAttribute("height") || null : null,
    href: link ? link.getAttribute("href") || null : null,
    target: link ? link.getAttribute("target") || null : null,
    rel: link ? link.getAttribute("rel") || null : null,
    class: normalizeClassTokens(element.getAttribute("class"), ALLOWED_IMAGE_FIGURE_CLASSES, "image") || "image",
    id: element.getAttribute("id") || null
  };
}

const ImageFigure = Node.create({
  name: "imageFigure",
  group: "block",
  content: "block*",
  draggable: true,
  isolating: true,
  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: function (element) {
          return getFigureImageAttrs(element).src;
        }
      },
      alt: {
        default: null,
        parseHTML: function (element) {
          return getFigureImageAttrs(element).alt;
        }
      },
      title: {
        default: null,
        parseHTML: function (element) {
          return getFigureImageAttrs(element).title;
        }
      },
      width: {
        default: null,
        parseHTML: function (element) {
          return getFigureImageAttrs(element).width;
        }
      },
      height: {
        default: null,
        parseHTML: function (element) {
          return getFigureImageAttrs(element).height;
        }
      },
      href: {
        default: null,
        parseHTML: function (element) {
          return getFigureImageAttrs(element).href;
        }
      },
      target: {
        default: null,
        parseHTML: function (element) {
          return getFigureImageAttrs(element).target;
        }
      },
      rel: {
        default: null,
        parseHTML: function (element) {
          return getFigureImageAttrs(element).rel;
        }
      },
      class: {
        default: "image",
        parseHTML: function (element) {
          return getFigureImageAttrs(element).class;
        }
      },
      id: {
        default: null,
        parseHTML: function (element) {
          return getFigureImageAttrs(element).id;
        }
      }
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure.image",
        contentElement: "figcaption"
      }
    ];
  },
  renderHTML({ HTMLAttributes, node }) {
    const {
      src,
      alt,
      title,
      width,
      height,
      href,
      target,
      rel,
      class: figureClass,
      id
    } = HTMLAttributes;

    const figureAttrs = mergeAttributes(
      this.options.HTMLAttributes || {},
      {
        class: figureClass || "image"
      },
      id ? { id } : {}
    );
    const imageAttrs = { src };
    if (alt) {
      imageAttrs.alt = alt;
    }
    if (title) {
      imageAttrs.title = title;
    }
    if (width) {
      imageAttrs.width = width;
    }
    if (height) {
      imageAttrs.height = height;
    }

    const imageSpec = href
      ? ["a", mergeAttributes({ href }, target ? { target } : {}, rel ? { rel } : {}), ["img", imageAttrs]]
      : ["img", imageAttrs];

    if (node.childCount > 0) {
      return ["figure", figureAttrs, imageSpec, ["figcaption", 0]];
    }

    return ["figure", figureAttrs, imageSpec];
  }
});

export function normalizeLegacyHtmlForTiptap(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div data-root="1">${String(html || "")}</div>`, "text/html");
  const root = doc.body.firstElementChild;

  if (!root) {
    return "";
  }

  root.querySelectorAll("article, section, div").forEach(function (element) {
    if (isPlainWrapperElement(element)) {
      unwrapElement(element);
      return;
    }

    if (!hasBlockDescendantChildren(element)) {
      renameElement(doc, element, "p");
    }
  });

  root.querySelectorAll("h5, h6").forEach(function (element) {
    renameElement(doc, element, "h4");
  });

  normalizeLegacyPresentationalTags(doc, root);
  normalizeSupportedFigures(root);
  normalizeStyledSpans(doc, root);

  root.querySelectorAll("figcaption").forEach(function (element) {
    const parentTag = element.parentElement && element.parentElement.tagName ? element.parentElement.tagName.toLowerCase() : "";
    if (parentTag === "figure" && isSupportedImageFigure(element.parentElement)) {
      return;
    }
    renameElement(doc, element, "p");
  });

  root.querySelectorAll("figure").forEach(function (element) {
    if (!isSupportedImageFigure(element)) {
      unwrapElement(element);
    }
  });

  root.querySelectorAll("dt").forEach(function (element) {
    const paragraph = doc.createElement("p");
    const strong = doc.createElement("strong");
    while (element.firstChild) {
      strong.appendChild(element.firstChild);
    }
    paragraph.appendChild(strong);
    replaceElement(element, paragraph);
  });

  root.querySelectorAll("dd").forEach(function (element) {
    renameElement(doc, element, "p");
  });

  root.querySelectorAll("dl").forEach(function (element) {
    unwrapElement(element);
  });

  return root.innerHTML.trim();
}

export function getNormalizationNotice(html) {
  const raw = String(html || "").trim();
  if (!raw) {
    return "";
  }

  const normalized = normalizeLegacyHtmlForTiptap(raw);
  if (!normalized || normalized === raw) {
    return "";
  }

  return "Legacy HTML was normalized to the supported Tiptap schema. Review formatting before saving.";
}

export function sanitizeHtml(html) {
  const clean = DOMPurify.sanitize(String(html || ""), DOMPURIFY_OPTIONS);
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${clean}</div>`, "text/html");
  sanitizeAnchorTargets(doc.body);
  sanitizeInlineStyles(doc.body);
  return doc.body.innerHTML.trim();
}

export function htmlToMarkdown(html) {
  return createTurndown().turndown(html || "");
}

export function markdownToHtml(markdown) {
  return sanitizeHtml(markdownIt.render(markdown || ""));
}

export function detectUnsupportedContent(html) {
  const trimmed = normalizeLegacyHtmlForTiptap(String(html || "")).trim();
  if (!trimmed) {
    return "";
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div data-root="1">${trimmed}</div>`, "text/html");
  const elements = doc.body.querySelectorAll("*");

  for (const element of elements) {
    if (element.getAttribute("data-root") === "1") {
      continue;
    }

    const tag = element.tagName.toLowerCase();
    if (!SUPPORTED_TIPTAP_TAGS.has(tag)) {
      return `Legacy HTML uses <${tag}>, which this Tiptap surface does not preserve safely yet.`;
    }

    if (tag === "figure" && !isSupportedImageFigure(element)) {
      return "Legacy HTML uses a figure layout that this Tiptap surface does not preserve safely yet.";
    }

    if (tag === "figcaption") {
      const parent = element.parentElement;
      if (!parent || !isSupportedImageFigure(parent)) {
        return "Legacy HTML uses a figcaption layout that this Tiptap surface does not preserve safely yet.";
      }
    }

    if (tag === "input" && element.getAttribute("type") !== "checkbox") {
      return "Legacy HTML uses form controls that are outside the supported wiki editor schema.";
    }
  }

  return "";
}

function createButton(label, title, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-outline-secondary btn-sm wiki-editor-toolbar__button";
  button.textContent = label;
  button.setAttribute("title", title);
  button.addEventListener("click", function (event) {
    event.preventDefault();
    action();
  });
  return button;
}

function createToolbar(root, editor, uploadImage) {
  const toolbar = document.createElement("div");
  toolbar.className = "wiki-editor-toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Wiki editor tools");

  const groups = [];

  function addGroup(defs) {
    const group = document.createElement("div");
    group.className = "wiki-editor-toolbar__group";
    defs.forEach(function (def) {
      const button = createButton(def.label, def.title, def.action);
      def.applyState = def.applyState || function () {};
      def.button = button;
      group.appendChild(button);
    });
    toolbar.appendChild(group);
    groups.push(defs);
  }

  addGroup([
    {
      label: "Undo",
      title: "Undo",
      action: function () {
        editor.chain().focus().undo().run();
      },
      applyState: function (button) {
        button.disabled = !editor.can().chain().focus().undo().run();
      }
    },
    {
      label: "Redo",
      title: "Redo",
      action: function () {
        editor.chain().focus().redo().run();
      },
      applyState: function (button) {
        button.disabled = !editor.can().chain().focus().redo().run();
      }
    }
  ]);

  addGroup([
    {
      label: "P",
      title: "Paragraph",
      action: function () {
        editor.chain().focus().setParagraph().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("paragraph"));
      }
    },
    {
      label: "H1",
      title: "Heading 1",
      action: function () {
        editor.chain().focus().toggleHeading({ level: 1 }).run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("heading", { level: 1 }));
      }
    },
    {
      label: "H2",
      title: "Heading 2",
      action: function () {
        editor.chain().focus().toggleHeading({ level: 2 }).run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("heading", { level: 2 }));
      }
    },
    {
      label: "H3",
      title: "Heading 3",
      action: function () {
        editor.chain().focus().toggleHeading({ level: 3 }).run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("heading", { level: 3 }));
      }
    },
    {
      label: "H4",
      title: "Heading 4",
      action: function () {
        editor.chain().focus().toggleHeading({ level: 4 }).run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("heading", { level: 4 }));
      }
    }
  ]);

  addGroup([
    {
      label: "B",
      title: "Bold",
      action: function () {
        editor.chain().focus().toggleBold().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("bold"));
      }
    },
    {
      label: "I",
      title: "Italic",
      action: function () {
        editor.chain().focus().toggleItalic().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("italic"));
      }
    },
    {
      label: "U",
      title: "Underline",
      action: function () {
        editor.chain().focus().toggleUnderline().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("underline"));
      }
    },
    {
      label: "S",
      title: "Strike",
      action: function () {
        editor.chain().focus().toggleStrike().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("strike"));
      }
    },
    {
      label: "Code",
      title: "Inline code",
      action: function () {
        editor.chain().focus().toggleCode().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("code"));
      }
    },
    {
      label: "Mark",
      title: "Highlight",
      action: function () {
        editor.chain().focus().toggleHighlight().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("highlight"));
      }
    },
    {
      label: "Sub",
      title: "Subscript",
      action: function () {
        editor.chain().focus().toggleSubscript().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("subscript"));
      }
    },
    {
      label: "Sup",
      title: "Superscript",
      action: function () {
        editor.chain().focus().toggleSuperscript().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("superscript"));
      }
    }
  ]);

  addGroup([
    {
      label: "Link",
      title: "Set link",
      action: function () {
        const currentHref = editor.getAttributes("link").href || "";
        const href = window.prompt("Link URL", currentHref || "https://");
        if (!href) {
          return;
        }
        editor.chain().focus().extendMarkRange("link").setLink({
          href: href.trim(),
          target: "_blank",
          rel: "noopener noreferrer"
        }).run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("link"));
      }
    },
    {
      label: "Unlink",
      title: "Remove link",
      action: function () {
        editor.chain().focus().unsetLink().run();
      },
      applyState: function (button) {
        button.disabled = !editor.isActive("link");
      }
    },
    {
      label: "Image",
      title: "Upload image",
      action: function () {
        uploadImage();
      }
    }
  ]);

  addGroup([
    {
      label: "Bullets",
      title: "Bullet list",
      action: function () {
        editor.chain().focus().toggleBulletList().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("bulletList"));
      }
    },
    {
      label: "Numbers",
      title: "Ordered list",
      action: function () {
        editor.chain().focus().toggleOrderedList().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("orderedList"));
      }
    },
    {
      label: "Tasks",
      title: "Task list",
      action: function () {
        editor.chain().focus().toggleTaskList().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("taskList"));
      }
    },
    {
      label: "Quote",
      title: "Blockquote",
      action: function () {
        editor.chain().focus().toggleBlockquote().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("blockquote"));
      }
    },
    {
      label: "Code Block",
      title: "Code block",
      action: function () {
        editor.chain().focus().toggleCodeBlock().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("codeBlock"));
      }
    },
    {
      label: "Rule",
      title: "Horizontal rule",
      action: function () {
        editor.chain().focus().setHorizontalRule().run();
      }
    }
  ]);

  addGroup([
    {
      label: "Left",
      title: "Align left",
      action: function () {
        editor.chain().focus().setTextAlign("left").run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive({ textAlign: "left" }));
      }
    },
    {
      label: "Center",
      title: "Align center",
      action: function () {
        editor.chain().focus().setTextAlign("center").run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive({ textAlign: "center" }));
      }
    },
    {
      label: "Right",
      title: "Align right",
      action: function () {
        editor.chain().focus().setTextAlign("right").run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive({ textAlign: "right" }));
      }
    },
    {
      label: "Justify",
      title: "Justify",
      action: function () {
        editor.chain().focus().setTextAlign("justify").run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive({ textAlign: "justify" }));
      }
    }
  ]);

  addGroup([
    {
      label: "Table",
      title: "Insert table",
      action: function () {
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      }
    },
    {
      label: "+Row",
      title: "Add row after",
      action: function () {
        editor.chain().focus().addRowAfter().run();
      },
      applyState: function (button) {
        button.disabled = !editor.can().chain().focus().addRowAfter().run();
      }
    },
    {
      label: "+Col",
      title: "Add column after",
      action: function () {
        editor.chain().focus().addColumnAfter().run();
      },
      applyState: function (button) {
        button.disabled = !editor.can().chain().focus().addColumnAfter().run();
      }
    },
    {
      label: "Del Table",
      title: "Delete table",
      action: function () {
        editor.chain().focus().deleteTable().run();
      },
      applyState: function (button) {
        button.disabled = !editor.can().chain().focus().deleteTable().run();
      }
    }
  ]);

  function syncToolbar() {
    groups.forEach(function (defs) {
      defs.forEach(function (def) {
        def.button.disabled = false;
        def.button.classList.remove("active");
        def.applyState(def.button);
      });
    });
  }

  editor.on("create", syncToolbar);
  editor.on("selectionUpdate", syncToolbar);
  editor.on("transaction", syncToolbar);
  editor.on("focus", syncToolbar);
  editor.on("blur", syncToolbar);
  syncToolbar();

  root.appendChild(toolbar);

  return toolbar;
}

async function uploadImageFile(relativePath, csrfToken, file) {
  const uploadUrl = `${relativePath || ""}/api/post/upload`;
  const formData = new FormData();
  formData.append("files[]", file);

  const response = await fetch(uploadUrl, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "x-csrf-token": csrfToken || ""
    },
    body: formData
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error((body && body.status && body.status.message) || response.statusText);
  }

  const image = (body.response && body.response.images && body.response.images[0]) || (body.images && body.images[0]);
  if (!image || !image.url) {
    throw new Error("Unexpected upload response");
  }

  return image.url;
}

export async function createWikiEditor(element, options) {
  const { relativePath, csrfToken, initialData = "" } = options || {};
  const normalizedInitialData = normalizeLegacyHtmlForTiptap(initialData);

  const root = document.createElement("div");
  root.className = "wiki-editor";

  const toolbarMount = document.createElement("div");
  toolbarMount.className = "wiki-editor__toolbar-mount";
  root.appendChild(toolbarMount);

  const editorMount = document.createElement("div");
  editorMount.className = "wiki-editor__surface wiki-article-prose";
  root.appendChild(editorMount);

  const metaRow = document.createElement("div");
  metaRow.className = "wiki-editor__meta small text-muted";
  root.appendChild(metaRow);

  const uploadInput = document.createElement("input");
  uploadInput.type = "file";
  uploadInput.accept = "image/*";
  uploadInput.className = "wiki-editor__upload-input";
  uploadInput.hidden = true;
  root.appendChild(uploadInput);

  element.innerHTML = "";
  element.appendChild(root);

  const editor = new Editor({
    element: editorMount,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4]
        }
      }),
      PreservedNodeAttributes,
      StyledSpan,
      ImageFigure,
      Underline,
      Highlight,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https"
      }),
      Image.configure({
        allowBase64: true
      }),
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({
        nested: true
      }),
      Placeholder.configure({
        placeholder: "Write the article body…"
      }),
      CharacterCount,
      Typography,
      Subscript,
      Superscript,
      TextAlign.configure({
        types: ["heading", "paragraph"]
      })
    ],
    content: sanitizeHtml(normalizedInitialData),
    autofocus: false,
    editable: true,
    editorProps: {
      attributes: {
        class: "wiki-editor__content wiki-article-prose"
      },
      handleDOMEvents: {
        click: function (_view, event) {
          const target = event.target;
          const link = target && typeof target.closest === "function" ? target.closest("a[href]") : null;
          if (link && editorMount.contains(link)) {
            event.preventDefault();
            event.stopPropagation();
            return true;
          }
          return false;
        }
      }
    },
    onUpdate: function ({ editor: activeEditor }) {
      const plainTextLength = activeEditor.getText().trim().length;
      metaRow.textContent = `${plainTextLength.toLocaleString()} characters`;
    }
  });

  metaRow.textContent = `${editor.getText().trim().length.toLocaleString()} characters`;

  async function pickAndUploadImage() {
    uploadInput.value = "";
    uploadInput.click();
  }

  uploadInput.addEventListener("change", async function () {
    const file = uploadInput.files && uploadInput.files[0];
    if (!file) {
      return;
    }

    const url = await uploadImageFile(relativePath, csrfToken, file);
    editor.chain().focus().setImage({
      src: url,
      alt: file.name || ""
    }).run();
  });

  createToolbar(toolbarMount, editor, pickAndUploadImage);

  return {
    getHTML: function () {
      return sanitizeHtml(editor.getHTML());
    },
    getJSON: function () {
      return editor.getJSON();
    },
    getMarkdown: function () {
      return htmlToMarkdown(editor.getHTML());
    },
    setHTML: function (html) {
      editor.commands.setContent(sanitizeHtml(normalizeLegacyHtmlForTiptap(html)), false);
    },
    setMarkdown: function (markdown) {
      editor.commands.setContent(markdownToHtml(markdown), false);
    },
    insertWikiLink: function (insertText) {
      editor.chain().focus().insertContent(String(insertText || "")).run();
    },
    focus: function () {
      editor.commands.focus();
    },
    destroy: function () {
      return editor.destroy();
    }
  };
}

window.WestgateWikiEditor = {
  createWikiEditor,
  markdownToHtml,
  htmlToMarkdown,
  sanitizeHtml,
  detectUnsupportedContent,
  normalizeLegacyHtmlForTiptap,
  getNormalizationNotice
};
