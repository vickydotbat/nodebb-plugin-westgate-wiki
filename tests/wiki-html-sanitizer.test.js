"use strict";

const assert = require("node:assert/strict");

const wikiHtmlSanitizer = require("../lib/wiki-html-sanitizer");

function test(name, fn) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (err) {
    process.stderr.write(`not ok - ${name}\n`);
    throw err;
  }
}

test("sanitizeWikiHtml removes script tags and keeps safe markup", function () {
  const html = '<p>Hello <strong>world</strong><script>alert(1)</script></p>';
  const sanitized = wikiHtmlSanitizer.sanitizeWikiHtml(html);

  assert.equal(sanitized, "<p>Hello <strong>world</strong></p>");
});

test("sanitizeWikiHtml normalizes blank target links with rel", function () {
  const html = '<p><a href="https://example.com" target="_blank">Example</a></p>';
  const sanitized = wikiHtmlSanitizer.sanitizeWikiHtml(html);

  assert.match(sanitized, /rel="noopener noreferrer"/);
});

test("hasMeaningfulWikiHtml accepts image-only content", function () {
  const html = '<img src="https://example.com/example.png" alt="Example" />';
  assert.equal(wikiHtmlSanitizer.hasMeaningfulWikiHtml(html), true);
});

test("hasMeaningfulWikiHtml rejects empty content", function () {
  assert.equal(wikiHtmlSanitizer.hasMeaningfulWikiHtml("  "), false);
  assert.equal(wikiHtmlSanitizer.hasMeaningfulWikiHtml("<script>alert(1)</script>"), false);
});
