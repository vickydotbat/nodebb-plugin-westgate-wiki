"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function test(name, fn) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (err) {
    process.stderr.write(`not ok - ${name}\n`);
    throw err;
  }
}

const rootDir = path.join(__dirname, "..");
const pageTemplate = fs.readFileSync(path.join(rootDir, "templates/wiki-page.tpl"), "utf8");
const wikiCss = fs.readFileSync(path.join(rootDir, "public/wiki.css"), "utf8");
const tocClient = fs.readFileSync(path.join(rootDir, "public/wiki-article-toc.js"), "utf8");

test("article template uses overlay drawers instead of a sidebar grid column", function () {
  assert.doesNotMatch(pageTemplate, /wiki-content-layout--sidebar/);
  assert.match(pageTemplate, /data-wiki-article-drawers/);
  assert.match(pageTemplate, /id="wiki-article-drawer-nav"/);
  assert.match(pageTemplate, /class="wiki-article-drawer wiki-article-drawer--nav/);
  assert.match(pageTemplate, /id="wiki-article-drawer-toc"/);
  assert.match(pageTemplate, /class="wiki-article-drawer wiki-article-drawer--toc/);
  assert.match(pageTemplate, /data-wiki-drawer-backdrop/);
});

test("drawer triggers expose stable accessible controls", function () {
  assert.match(pageTemplate, /id="wiki-article-drawer-nav-toggle"/);
  assert.match(pageTemplate, /data-wiki-drawer-target="nav"/);
  assert.match(pageTemplate, /aria-controls="wiki-article-drawer-nav"/);
  assert.match(pageTemplate, /aria-expanded="false"/);
  assert.match(pageTemplate, /<span class="wiki-article-drawer__tab-label">Pages<\/span>/);

  assert.match(pageTemplate, /id="wiki-article-drawer-toc-toggle"/);
  assert.match(pageTemplate, /data-wiki-drawer-target="toc"/);
  assert.match(pageTemplate, /aria-controls="wiki-article-drawer-toc"/);
  assert.match(pageTemplate, /<span class="wiki-article-drawer__tab-label">Contents<\/span>/);
});

test("existing directory and ToC mounts remain compatible", function () {
  assert.match(pageTemplate, /data-wiki-directory-mount="1"/);
  assert.match(pageTemplate, /data-wiki-directory-mode="nav"/);
  assert.match(pageTemplate, /data-around-tid="\{topic\.tid\}"/);
  assert.match(pageTemplate, /data-wiki-article-toc-root/);
  assert.match(pageTemplate, /data-wiki-article-toc/);
});

test("drawer CSS defines desktop hover drawers and mobile off-canvas drawers", function () {
  assert.match(wikiCss, /\.wiki-article-drawer\s*{/);
  assert.match(wikiCss, /\.wiki-article-drawer__tab\s*{/);
  assert.match(wikiCss, /\.wiki-article-drawer\s*{[^}]*position:\s*fixed/s);
  assert.doesNotMatch(wikiCss, /\.wiki-article-drawers\s*{[^}]*position:\s*fixed/s);
  assert.doesNotMatch(wikiCss, /\.wiki-article-drawers\s*{[^}]*overflow:\s*clip/s);
  assert.match(wikiCss, /\.wiki-article-drawer__tab-label\s*{/);
  assert.match(wikiCss, /--wiki-article-drawer-side-gutter:\s*3\.28rem/);
  assert.match(wikiCss, /--wiki-article-drawer-peek:\s*2\.75rem/);
  assert.match(wikiCss, /\.wiki-article-drawer--nav\s*{[^}]*transform:\s*translateX\(-100%\)/s);
  assert.match(wikiCss, /\.wiki-article-drawer--toc\s*{[^}]*transform:\s*translateX\(100%\)/s);
  assert.match(wikiCss, /\.wiki-article-drawer--nav\s+\.wiki-article-drawer__tab\s*{[^}]*right:\s*calc\(var\(--wiki-article-drawer-peek\)\s*\*\s*-1\)/s);
  assert.match(wikiCss, /\.wiki-article-drawer--toc\s+\.wiki-article-drawer__tab\s*{[^}]*left:\s*calc\(var\(--wiki-article-drawer-peek\)\s*\*\s*-1\)/s);
  assert.match(wikiCss, /z-index:\s*var\(--wiki-article-drawer-layer,\s*8\)/);
  assert.doesNotMatch(wikiCss, /wiki-article-drawer--open\s+\.wiki-article-drawer__tab\s*{[^}]*visibility:\s*hidden/s);
  assert.doesNotMatch(wikiCss, /wiki-article-drawer:hover\s+\.wiki-article-drawer__tab\s*{[^}]*visibility:\s*hidden/s);
  assert.match(wikiCss, /writing-mode:\s*vertical-rl/);
  assert.match(wikiCss, /@media\s*\(min-width:\s*1200px\)/);
  assert.match(wikiCss, /\.wiki-article-drawer--nav:hover/);
  assert.match(wikiCss, /\.wiki-article-drawer--toc:hover/);
  assert.match(wikiCss, /@media\s*\(min-width:\s*1200px\)[\s\S]*?\.wiki-article-drawer__close\s*{[^}]*display:\s*none/);
  assert.match(wikiCss, /@media\s*\(max-width:\s*1199\.98px\)/);
  assert.match(wikiCss, /@media\s*\(max-width:\s*1199\.98px\)[\s\S]*?\.wiki-article-drawer__close\s*{[^}]*display:\s*inline-flex/);
  assert.match(wikiCss, /\.wiki-article-drawer-backdrop/);
  assert.match(wikiCss, /env\(safe-area-inset-left,\s*0px\)/);
  assert.match(wikiCss, /env\(safe-area-inset-right,\s*0px\)/);
});

test("mobile drawer tabs sit above floating page tools", function () {
  assert.match(wikiCss, /@media\s*\(max-width:\s*767\.98px\)[\s\S]*?\.wiki-article-drawer__tab\s*{[^}]*top:\s*clamp\(/);
  assert.match(wikiCss, /@media\s*\(max-width:\s*767\.98px\)[\s\S]*?\.wiki-article-drawer__tab\s*{[^}]*bottom:\s*auto/);
  assert.doesNotMatch(wikiCss, /@media\s*\(max-width:\s*767\.98px\)[\s\S]*?\.wiki-article-drawer__tab\s*{[^}]*bottom:\s*0\.75rem/);
});

test("ToC client owns drawer state and accessibility updates", function () {
  assert.match(tocClient, /function\s+initArticleDrawers\s*\(/);
  assert.match(tocClient, /data-wiki-drawer-toggle/);
  assert.match(tocClient, /aria-expanded/);
  assert.match(tocClient, /wiki-article-drawer--open/);
  assert.doesNotMatch(tocClient, /updateArticleDrawerBounds/);
  assert.doesNotMatch(tocClient, /appendChild\(root\)/);
  assert.match(tocClient, /keydown/);
  assert.match(tocClient, /Escape/);
});
