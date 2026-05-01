"use strict";

const assert = require("assert");

const footnotes = require("../lib/wiki-footnotes");

function countMatches(value, pattern) {
  return (String(value || "").match(pattern) || []).length;
}

{
  const html = footnotes.transformDokuWikiFootnotes("<p>You can add footnotes ((This is a footnote)) by using double parentheses.</p>");
  assert(html.includes('class="wiki-footnote-ref"'), "basic footnote should render an inline reference");
  assert(html.includes('href="#fn__1"'), "inline reference should point to the bottom footnote");
  assert(html.includes('id="fn__1"'), "bottom footnote should have a stable DokuWiki-like id");
  assert(html.includes('data-wiki-footnote-preview-source hidden'), "preview source should be hidden normal HTML, not visible raw text");
  assert(!html.includes("<template"), "preview source should not use template tags that may be stripped by sanitizers");
  assert(html.includes("This is a footnote"), "bottom footnote should include the note body");
}

{
  const html = footnotes.transformDokuWikiFootnotes("<p>A ((Same note)) B ((Same note)) C ((Different note))</p>");
  assert.strictEqual(countMatches(html, /class="wiki-footnote-item"/g), 2, "identical notes should share one bottom entry");
  assert(html.includes(">1)</a>"), "first repeated note should use number 1");
  assert(html.includes(">2)</a>"), "different note should use number 2");
  assert(html.includes('href="#fnt__1"'), "shared note should link back to first occurrence");
  assert(html.includes('href="#fnt__1-2"'), "shared note should link back to second occurrence");
}

{
  const html = footnotes.transformDokuWikiFootnotes(
    '<p>Rich ((See [[Page]] output <a href="/raw">raw link</a> and [Markdown](https://example.com).))</p>'
  );
  assert(html.includes("[[Page]] output"), "already-rendered wiki-link text should be preserved");
  assert(html.includes('<a href="/raw">raw link</a>'), "raw HTML anchors should be preserved");
  assert(html.includes('<a href="https://example.com">Markdown</a>'), "Markdown links inside footnotes should render as anchors");
}

{
  const wikiLink = '<a class="wiki-internal-link" href="/wiki/about/player-guide">Player Guide</a>';
  const html = footnotes.transformDokuWikiFootnotes(`<p>See ((${wikiLink} and [outside](/wiki/about))).</p>`);
  assert(html.includes(wikiLink), "server-rendered wiki links should remain rich links inside notes");
  assert(html.includes('<a href="/wiki/about">outside</a>'), "relative Markdown links should render inside notes");
}

{
  const html = footnotes.transformDokuWikiFootnotes("<p>Open ((not closed</p><p>Empty (()) marker</p>");
  assert(html.includes("((not closed"), "unclosed markers should remain literal");
  assert(html.includes("(())"), "empty markers should remain literal");
  assert(!html.includes("wiki-footnotes"), "malformed/empty-only content should not append a footnote list");
}

{
  const html = footnotes.transformDokuWikiFootnotes('<pre>((code))</pre><code>((inline code))</code><p>((real note))</p>');
  assert(html.includes("<pre>((code))</pre>"), "pre blocks should be protected");
  assert(html.includes("<code>((inline code))</code>"), "code blocks should be protected");
  assert.strictEqual(countMatches(html, /class="wiki-footnote-item"/g), 1, "only the real note should render");
}

{
  const html = footnotes.transformDokuWikiFootnotes('<p><a href="/x">link ((not a note))</a> outside ((real note))</p>');
  assert(html.includes('link ((not a note))'), "markers inside existing links should be left alone");
  assert.strictEqual(countMatches(html, /class="wiki-footnote-item"/g), 1, "outside marker should still render");
}

{
  const html = footnotes.transformDokuWikiFootnotes('<p id="fn__1">Existing</p><p>((Note))</p>');
  assert(html.includes('id="fn__1-2"'), "generated ids should avoid existing id collisions");
}

console.log("wiki-footnotes tests passed");
