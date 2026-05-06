"use strict";

const sanitizeHtml = require("sanitize-html");

const SANITIZER_CONFIG = require("../shared/wiki-html-sanitizer-config.json");

const SANITIZE_OPTIONS = {
  allowedTags: SANITIZER_CONFIG.allowedTags,
  allowedAttributes: SANITIZER_CONFIG.allowedAttributes,
  allowedSchemes: SANITIZER_CONFIG.allowedSchemes,
  allowedSchemesByTag: SANITIZER_CONFIG.allowedSchemesByTag,
  disallowedTagsMode: "discard",
  parseStyleAttributes: false,
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

function sanitizeWikiHtml(html) {
  return sanitizeHtml(String(html || ""), SANITIZE_OPTIONS).trim();
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
  hasMeaningfulWikiHtml
};
