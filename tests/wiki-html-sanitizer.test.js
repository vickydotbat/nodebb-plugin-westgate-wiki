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

test("sanitizeWikiHtml preserves safe inline styles and strips unsafe ones", function () {
  const html = '<p style="text-align: center; position: fixed; color: rgb(10, 20, 30)">Styled</p>';
  const sanitized = wikiHtmlSanitizer.sanitizeWikiHtml(html);

  assert.match(sanitized, /style="[^"]*text-align:center;?[^"]*"/);
  assert.match(sanitized, /style="[^"]*color:rgb\(10, 20, 30\);?[^"]*"/);
  assert.doesNotMatch(sanitized, /position:/);
});

test("sanitizeWikiHtml preserves semantic span markup for legacy inline formatting", function () {
  const html = '<p><span class="legacy-accent" style="font-size: 1.2rem; color: #caa55a">Accent</span></p>';
  const sanitized = wikiHtmlSanitizer.sanitizeWikiHtml(html);

  assert.match(sanitized, /<span class="legacy-accent" style="font-size:1\.2rem;color:#caa55a">Accent<\/span>/);
});

test("sanitizeWikiHtml preserves safe table alignment styles", function () {
  const html = '<table style="margin-left: auto; margin-right: 0; position: fixed"><tbody><tr><td>Right</td></tr></tbody></table>';
  const sanitized = wikiHtmlSanitizer.sanitizeWikiHtml(html);

  assert.match(sanitized, /style="[^"]*margin-left:auto;?[^"]*"/);
  assert.match(sanitized, /style="[^"]*margin-right:0;?[^"]*"/);
  assert.doesNotMatch(sanitized, /position:/);
});

test("sanitizeWikiHtml preserves wiki callout blocks and strips arbitrary styles", function () {
  const html = '<aside class="wiki-callout wiki-callout--danger bad-class" data-callout-type="danger" data-callout-title="Risk" style="position:fixed"><p><strong>Risk</strong></p><p>Check [[Page]].</p></aside>';
  const sanitized = wikiHtmlSanitizer.sanitizeWikiHtml(html);

  assert.match(sanitized, /<aside class="wiki-callout wiki-callout--danger bad-class" data-callout-type="danger" data-callout-title="Risk">/);
  assert.match(sanitized, /\[\[Page\]\]/);
  assert.doesNotMatch(sanitized, /position:/);
});

test("hasMeaningfulWikiHtml accepts image-only content", function () {
  const html = '<img src="https://example.com/example.png" alt="Example" />';
  assert.equal(wikiHtmlSanitizer.hasMeaningfulWikiHtml(html), true);
});

test("hasMeaningfulWikiHtml rejects empty content", function () {
  assert.equal(wikiHtmlSanitizer.hasMeaningfulWikiHtml("  "), false);
  assert.equal(wikiHtmlSanitizer.hasMeaningfulWikiHtml("<script>alert(1)</script>"), false);
});
