import { ALLOWED_IMAGE_FIGURE_CLASSES, normalizeClassTokens, removeClassTokens } from "../shared/image-class-contract.mjs";
import { getMergedAttrsForElement, hasPreservedAttrs } from "../shared/preserved-attrs.mjs";
import { sanitizeStyleAttribute } from "../shared/sanitizer-contract.mjs";

export const SUPPORTED_TIPTAP_TAGS = new Set([
  "a",
  "article",
  "aside",
  "blockquote",
  "br",
  "col",
  "colgroup",
  "code",
  "div",
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
  "section",
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

export function unwrapElement(element) {
  const parent = element.parentNode;
  if (!parent) {
    return;
  }

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }

  parent.removeChild(element);
}

export function replaceElement(element, replacement) {
  const parent = element.parentNode;
  if (!parent) {
    return;
  }

  parent.replaceChild(replacement, element);
}

export function renameElement(document, element, tagName) {
  const replacement = document.createElement(tagName);
  Array.from(element.attributes || []).forEach(function (attr) {
    replacement.setAttribute(attr.name, attr.value);
  });

  while (element.firstChild) {
    replacement.appendChild(element.firstChild);
  }

  replaceElement(element, replacement);
}

export function wrapNodeWithElement(document, node, tagName, attrs) {
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

export function moveElementBefore(element, reference) {
  if (!element || !reference || !reference.parentNode) {
    return;
  }
  reference.parentNode.insertBefore(element, reference);
}

function createEntitySpan(document, entityType, text, attrs) {
  const span = document.createElement("span");
  span.className = `wiki-entity wiki-entity--${entityType}`;
  span.setAttribute("data-wiki-entity", entityType);
  Object.entries(attrs || {}).forEach(function ([key, value]) {
    if (value) {
      span.setAttribute(key, value);
    }
  });
  span.textContent = text;
  return span;
}

function isProtectedInlineSyntaxParent(node) {
  const parent = node && node.parentElement;
  return !!(parent && parent.closest("a, code, pre, script, style, textarea, template, [data-wiki-entity]"));
}

function appendTextAndEntityParts(document, parent, text, regex, buildEntity) {
  regex.lastIndex = 0;
  let cursor = 0;
  let match;
  let changed = false;
  while ((match = regex.exec(text)) !== null) {
    const before = text.slice(cursor, match.index);
    if (before) {
      parent.appendChild(document.createTextNode(before));
    }
    parent.appendChild(buildEntity(match));
    cursor = match.index + match[0].length;
    changed = true;
  }
  if (!changed) {
    return false;
  }
  const rest = text.slice(cursor);
  if (rest) {
    parent.appendChild(document.createTextNode(rest));
  }
  return true;
}

function normalizeLegacyWikiInlineSyntax(document, root) {
  const nodeFilter = document.defaultView && document.defaultView.NodeFilter;
  const walker = document.createTreeWalker(root, nodeFilter ? nodeFilter.SHOW_TEXT : 4);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (!isProtectedInlineSyntaxParent(node)) {
      nodes.push(node);
    }
  }

  nodes.forEach(function (textNode) {
    const text = textNode.nodeValue || "";
    if (!/(\[\[|@\w|\(\()/.test(text)) {
      return;
    }

    const footnotePass = document.createDocumentFragment();
    const footnoteChanged = appendTextAndEntityParts(
      document,
      footnotePass,
      text,
      /\(\(([^()[\]](?:[^()]|\([^)]*\))*?)\)\)/g,
      function (match) {
        return createEntitySpan(document, "footnote", "[note]", {
          "data-wiki-footnote": match[1].trim()
        });
      }
    );
    if (!footnoteChanged) {
      footnotePass.appendChild(document.createTextNode(text));
    }

    const wikiPass = document.createDocumentFragment();
    Array.from(footnotePass.childNodes).forEach(function (part) {
      if (part.nodeType !== 3) {
        wikiPass.appendChild(part);
        return;
      }
      const parts = document.createDocumentFragment();
      const changed = appendTextAndEntityParts(
        document,
        parts,
        part.nodeValue || "",
        /\[\[([^[\]|]+(?:\/[^[\]|]+)*|ns:[^[\]|]+)(?:\|([^[\]]+))?\]\]/g,
        function (match) {
          const rawTarget = match[1].trim();
          const isNamespace = /^ns:/i.test(rawTarget);
          const target = isNamespace ? rawTarget.replace(/^ns:/i, "").trim() : rawTarget;
          const label = (match[2] || target.split("/").pop() || target).trim();
          return createEntitySpan(document, isNamespace ? "namespace" : "page", label, {
            "data-wiki-target": target,
            "data-wiki-label": label
          });
        }
      );
      if (changed) {
        while (parts.firstChild) {
          wikiPass.appendChild(parts.firstChild);
        }
      } else {
        wikiPass.appendChild(part);
      }
    });

    const mentionPass = document.createDocumentFragment();
    Array.from(wikiPass.childNodes).forEach(function (part) {
      if (part.nodeType !== 3) {
        mentionPass.appendChild(part);
        return;
      }
      const parts = document.createDocumentFragment();
      const changed = appendTextAndEntityParts(
        document,
        parts,
        part.nodeValue || "",
        /(^|[^\w@./:+-])@([A-Za-z0-9][A-Za-z0-9_-]{0,38})(?=$|[^A-Za-z0-9_-])/g,
        function (match) {
          const fragment = document.createDocumentFragment();
          if (match[1]) {
            fragment.appendChild(document.createTextNode(match[1]));
          }
          fragment.appendChild(createEntitySpan(document, "user", `@${match[2]}`, {
            "data-wiki-username": match[2],
            "data-wiki-userslug": match[2].toLowerCase()
          }));
          return fragment;
        }
      );
      if (changed) {
        while (parts.firstChild) {
          mentionPass.appendChild(parts.firstChild);
        }
      } else {
        mentionPass.appendChild(part);
      }
    });

    textNode.parentNode.replaceChild(mentionPass, textNode);
  });
}

export function isPlainWrapperElement(element) {
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

export function hasBlockDescendantChildren(element) {
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

function isPoetryQuoteFigure(element) {
  return !!(
    element &&
    element.tagName &&
    element.tagName.toLowerCase() === "figure" &&
    (
      element.getAttribute("data-wiki-node") === "poetry-quote" ||
      (element.classList && element.classList.contains("wiki-poetry-quote"))
    )
  );
}

function isInsidePluginOwnedStructure(element) {
  return !!(element && element.closest && element.closest('[data-wiki-node="alignment-table"], figure.wiki-poetry-quote, [data-wiki-node="poetry-quote"]'));
}

export function normalizeLegacyPresentationalTags(document, root) {
  [
    ["abbr", "span"],
    ["acronym", "span"],
    ["address", "p"],
    ["b", "strong"],
    ["cite", "em"],
    ["center", "p"],
    ["del", "s"],
    ["dfn", "em"],
    ["font", "span"],
    ["i", "em"],
    ["ins", "u"],
    ["kbd", "code"],
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

export function normalizeLegacyTableStructures(document, root) {
  root.querySelectorAll("caption").forEach(function (caption) {
    const table = caption.closest("table");
    if (!table) {
      renameElement(document, caption, "p");
      return;
    }

    const paragraph = document.createElement("p");
    paragraph.className = "wiki-legacy-table-caption";
    while (caption.firstChild) {
      paragraph.appendChild(caption.firstChild);
    }
    moveElementBefore(paragraph, table);
    caption.remove();
  });

  root.querySelectorAll("figure.table").forEach(function (figure) {
    const table = figure.querySelector(":scope > table");
    if (!table) {
      unwrapElement(figure);
      return;
    }

    const figcaption = figure.querySelector(":scope > figcaption");
    if (figcaption) {
      const paragraph = document.createElement("p");
      paragraph.className = "wiki-legacy-table-caption";
      while (figcaption.firstChild) {
        paragraph.appendChild(figcaption.firstChild);
      }
      moveElementBefore(paragraph, figure);
      figcaption.remove();
    }

    const align = (figure.getAttribute("align") || "").trim().toLowerCase();
    if (align && !table.getAttribute("style")) {
      let alignStyle = "";
      if (align === "center") {
        alignStyle = "margin-left: auto; margin-right: auto";
      } else if (align === "left") {
        alignStyle = "margin-left: 0; margin-right: auto";
      } else if (align === "right") {
        alignStyle = "margin-left: auto; margin-right: 0";
      }
      const normalizedAlign = sanitizeStyleAttribute(alignStyle, "table");
      if (normalizedAlign) {
        table.setAttribute("style", normalizedAlign);
      }
    }

    replaceElement(figure, table);
  });
}

export function normalizeLegacyListTags(document, root) {
  [
    ["dir", "ul"],
    ["menu", "ul"]
  ].forEach(function ([sourceTag, targetTag]) {
    root.querySelectorAll(sourceTag).forEach(function (element) {
      renameElement(document, element, targetTag);
    });
  });
}

function elementContainsMedia(element) {
  if (!element || !element.tagName) {
    return false;
  }

  const tagName = element.tagName.toLowerCase();
  if (tagName === "img") {
    return true;
  }

  return !!element.querySelector("img, figure.image");
}

export function normalizeLegacyMediaLayouts(document, root) {
  root.querySelectorAll("article, section, div").forEach(function (element) {
    const display = (element.style.display || "").trim().toLowerCase();
    if (!["flex", "grid", "inline-flex", "inline-grid"].includes(display)) {
      return;
    }

    const directChildren = Array.from(element.children || []).filter(function (child) {
      const tag = child.tagName.toLowerCase();
      return tag !== "script" && tag !== "style";
    });

    if (directChildren.length < 2 || directChildren.length > 4) {
      return;
    }

    if (!directChildren.some(elementContainsMedia)) {
      return;
    }

    element.removeAttribute("style");
    element.setAttribute("class", "wiki-media-row");

    directChildren.forEach(function (child) {
      if (child.tagName.toLowerCase() === "img" || isSupportedImageFigure(child)) {
        const wrapper = document.createElement("div");
        wrapper.setAttribute("class", "wiki-media-cell");
        child.parentNode.replaceChild(wrapper, child);
        wrapper.appendChild(child);
        return;
      }

      const currentClass = removeClassTokens(child.getAttribute("class"), new Set(["wiki-media-cell"]));
      child.setAttribute("class", currentClass ? `${currentClass} wiki-media-cell` : "wiki-media-cell");
      child.removeAttribute("style");
    });
  });
}

export function normalizeFigureImageClasses(figure) {
  const normalized = normalizeClassTokens(figure.getAttribute("class"), ALLOWED_IMAGE_FIGURE_CLASSES, "image");
  if (normalized) {
    figure.setAttribute("class", normalized);
  } else {
    figure.removeAttribute("class");
  }
}

export function isSupportedImageFigure(figure) {
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

export function getFigureImageElement(figure) {
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

export function getFigureImageLinkElement(figure) {
  const image = getFigureImageElement(figure);
  if (!image || !image.parentElement) {
    return null;
  }
  return image.parentElement.tagName.toLowerCase() === "a" ? image.parentElement : null;
}

export function normalizeSupportedFigures(root) {
  root.querySelectorAll("figure").forEach(function (figure) {
    if (!isSupportedImageFigure(figure)) {
      return;
    }

    normalizeFigureImageClasses(figure);
  });
}

export function normalizeStyledSpans(document, root) {
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

export function normalizeLegacyHtmlForTiptap(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div data-root="1">${String(html || "")}</div>`, "text/html");
  const root = doc.body.firstElementChild;

  if (!root) {
    return "";
  }

  root.querySelectorAll("article, section, div").forEach(function (element) {
    if (isInsidePluginOwnedStructure(element)) {
      return;
    }

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
  normalizeLegacyWikiInlineSyntax(doc, root);
  normalizeLegacyListTags(doc, root);
  normalizeLegacyMediaLayouts(doc, root);
  normalizeLegacyTableStructures(doc, root);
  normalizeSupportedFigures(root);
  normalizeStyledSpans(doc, root);

  root.querySelectorAll("figcaption").forEach(function (element) {
    const parentTag = element.parentElement && element.parentElement.tagName ? element.parentElement.tagName.toLowerCase() : "";
    if (parentTag === "figure" && isPoetryQuoteFigure(element.parentElement)) {
      return;
    }
    if (parentTag === "figure" && isSupportedImageFigure(element.parentElement)) {
      return;
    }
    renameElement(doc, element, "p");
  });

  root.querySelectorAll("figure").forEach(function (element) {
    if (!isSupportedImageFigure(element) && !isPoetryQuoteFigure(element)) {
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

    if (tag === "figure" && !isSupportedImageFigure(element) && !isPoetryQuoteFigure(element)) {
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
