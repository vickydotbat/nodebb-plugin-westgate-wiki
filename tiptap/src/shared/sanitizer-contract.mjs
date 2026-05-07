import DOMPurify from "dompurify";

import sanitizerConfig from "../../../shared/wiki-html-sanitizer-config.json" with { type: "json" };

export function compileAllowedStylesMap(configMap) {
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

export const COMPILED_ALLOWED_STYLES = compileAllowedStylesMap(sanitizerConfig.allowedStyles);

export const DOMPURIFY_OPTIONS = {
  ALLOWED_TAGS: sanitizerConfig.allowedTags,
  ALLOWED_ATTR: getAllowedAttributesList(),
  ALLOW_DATA_ATTR: true
};

export function sanitizeAnchorTargets(root) {
  root.querySelectorAll("a[href]").forEach(function (link) {
    if (link.getAttribute("target") === "_blank" && !link.getAttribute("rel")) {
      link.setAttribute("rel", "noopener noreferrer");
    }
  });
}

export function sanitizeStyleAttribute(styleValue, tagName) {
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

export function sanitizeInlineStyles(root) {
  root.querySelectorAll("[style]").forEach(function (element) {
    const sanitizedStyle = sanitizeStyleAttribute(element.getAttribute("style"), element.tagName.toLowerCase());
    if (sanitizedStyle) {
      element.setAttribute("style", sanitizedStyle);
    } else {
      element.removeAttribute("style");
    }
  });
}

export function sanitizeHtml(html) {
  const clean = DOMPurify.sanitize(String(html || ""), DOMPURIFY_OPTIONS);
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${clean}</div>`, "text/html");
  sanitizeAnchorTargets(doc.body);
  sanitizeInlineStyles(doc.body);
  return doc.body.innerHTML.trim();
}
