"use strict";

const sanitizeHtml = require("sanitize-html");

const SANITIZER_CONFIG = require("../shared/wiki-html-sanitizer-config.json");

function compileAllowedStylesMap(configMap) {
  return Object.fromEntries(
    Object.entries(configMap || {}).map(([tagName, properties]) => [
      tagName,
      Object.fromEntries(
        Object.entries(properties || {}).map(([propertyName, patterns]) => [
          propertyName,
          (patterns || []).map((pattern) => new RegExp(pattern))
        ])
      )
    ])
  );
}

function decodeHtmlAttribute(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function stripUnsafeInlineHtml(value) {
  return decodeHtmlAttribute(value)
    .replace(/<\s*(script|style|iframe|object|embed)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(["']).*?\1/gi, "")
    .trim();
}

function sanitizeWikiEntitySpan(tagName, attribs) {
  const entityType = attribs["data-wiki-entity"];
  if (!entityType) {
    return { tagName, attribs };
  }

  const allowed = new Set(["page", "namespace", "user", "footnote"]);
  if (!allowed.has(entityType)) {
    const next = { ...attribs };
    delete next["data-wiki-entity"];
    return { tagName, attribs: next };
  }

  const next = { ...attribs };
  if (entityType === "footnote" && next["data-wiki-footnote"]) {
    next["data-wiki-footnote"] = stripUnsafeInlineHtml(next["data-wiki-footnote"]);
  }
  return { tagName, attribs: next };
}

const SANITIZE_OPTIONS = {
  allowedTags: SANITIZER_CONFIG.allowedTags,
  allowedAttributes: SANITIZER_CONFIG.allowedAttributes,
  allowedStyles: compileAllowedStylesMap(SANITIZER_CONFIG.allowedStyles),
  allowedSchemes: SANITIZER_CONFIG.allowedSchemes,
  allowedSchemesByTag: SANITIZER_CONFIG.allowedSchemesByTag,
  disallowedTagsMode: "discard",
  parseStyleAttributes: true,
  transformTags: {
    a: function transformAnchor(tagName, attribs) {
      const next = { ...attribs };
      if (next.href && !next.rel) {
        next.rel = "noopener noreferrer";
      }
      return {
        tagName,
        attribs: next
      };
    },
    span: sanitizeWikiEntitySpan
  }
};

function isSafeLinkHref(href) {
  const value = String(href || "").trim();
  if (!value) {
    return false;
  }
  const schemeMatch = value.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!schemeMatch) {
    return !/^[\u0000-\u001f\s]*javascript:/i.test(value);
  }
  return ["http", "https", "mailto"].includes(schemeMatch[1].toLowerCase());
}

function isExternalLinkHref(href) {
  const value = String(href || "").trim();
  return /^(?:https?:)?\/\//i.test(value);
}

function mergeClassName(existingClassName, className) {
  const classes = String(existingClassName || "")
    .split(/\s+/)
    .filter(Boolean);
  if (!classes.includes(className)) {
    classes.push(className);
  }
  return classes.join(" ");
}

function withReadOnlyLinkAttributes(attribs) {
  const next = { ...attribs };
  if (next.href && !next.rel) {
    next.rel = "noopener noreferrer";
  }
  if (isExternalLinkHref(next.href)) {
    next.class = mergeClassName(next.class, "wiki-external-link");
  }
  return next;
}

function transformReadOnlyInertLink(tagName, attribs) {
  if (attribs["data-wiki-entity"]) {
    return sanitizeWikiEntitySpan(tagName, attribs);
  }

  const href = attribs["data-wiki-link-href"];
  if (!href) {
    return {
      tagName,
      attribs
    };
  }

  if (!isSafeLinkHref(href)) {
    const next = { ...attribs };
    delete next["data-wiki-link-href"];
    delete next["data-wiki-link-target"];
    delete next["data-wiki-link-rel"];
    return {
      tagName,
      attribs: next
    };
  }

  const next = {
    href
  };
  if (attribs["data-wiki-link-target"]) {
    next.target = attribs["data-wiki-link-target"];
  }
  next.rel = attribs["data-wiki-link-rel"] || "noopener noreferrer";
  if (attribs.title) {
    next.title = attribs.title;
  }

  return {
    tagName: "a",
    attribs: withReadOnlyLinkAttributes(next)
  };
}

const READ_ONLY_RENDER_OPTIONS = {
  ...SANITIZE_OPTIONS,
  exclusiveFilter: function removeEmptySpans(frame) {
    return frame.tag === "span" && !String(frame.text || "").trim();
  },
  transformTags: {
    ...SANITIZE_OPTIONS.transformTags,
    a: function transformReadOnlyAnchor(tagName, attribs) {
      return {
        tagName,
        attribs: withReadOnlyLinkAttributes(attribs)
      };
    },
    span: transformReadOnlyInertLink,
    input: function transformReadOnlyInput(tagName, attribs) {
      const next = { ...attribs };
      if (String(next.type || "").toLowerCase() === "checkbox") {
        next.disabled = "disabled";
      }
      return {
        tagName,
        attribs: next
      };
    }
  }
};

function sanitizeWikiHtml(html) {
  return sanitizeHtml(String(html || ""), SANITIZE_OPTIONS).trim();
}

function renderReadOnlyWikiHtml(html) {
  return sanitizeHtml(String(html || ""), READ_ONLY_RENDER_OPTIONS).trim();
}

function hasMeaningfulWikiHtml(html) {
  const normalized = String(html || "").trim();
  if (!normalized) {
    return false;
  }

  const textOnly = sanitizeHtml(normalized, {
    allowedTags: [],
    allowedAttributes: {}
  }).replace(/\u00a0/g, " ").trim();

  if (textOnly) {
    return true;
  }

  return /<(?:img|hr|table|ul|ol|blockquote|pre|input)\b/i.test(normalized);
}

module.exports = {
  SANITIZE_OPTIONS,
  sanitizeWikiHtml,
  renderReadOnlyWikiHtml,
  hasMeaningfulWikiHtml
};
