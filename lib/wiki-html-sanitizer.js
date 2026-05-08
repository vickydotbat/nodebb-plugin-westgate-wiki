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
    }
  }
};

const READ_ONLY_RENDER_OPTIONS = {
  ...SANITIZE_OPTIONS,
  exclusiveFilter: function removeEmptySpans(frame) {
    return frame.tag === "span" && !String(frame.text || "").trim();
  },
  transformTags: {
    ...SANITIZE_OPTIONS.transformTags,
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
