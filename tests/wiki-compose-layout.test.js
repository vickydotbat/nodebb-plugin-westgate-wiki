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

const wikiCss = fs.readFileSync(path.join(__dirname, "..", "public/wiki.css"), "utf8");
const composePageJs = fs.readFileSync(path.join(__dirname, "..", "public/wiki-compose-page.js"), "utf8");

test("floating compose actions use equal fixed gutters instead of transform centering", function () {
  assert.match(wikiCss, /\.westgate-wiki-compose\s+\.wiki-compose-actions--floating\s*{[^}]*left:\s*max\(1rem,\s*env\(safe-area-inset-left,\s*0px\)\)/);
  assert.match(wikiCss, /\.westgate-wiki-compose\s+\.wiki-compose-actions--floating\s*{[^}]*right:\s*max\(1rem,\s*env\(safe-area-inset-right,\s*0px\)\)/);
  assert.match(wikiCss, /\.westgate-wiki-compose\s+\.wiki-compose-actions--floating\s*{[^}]*margin:\s*0\s+auto/);
  assert.match(wikiCss, /\.westgate-wiki-compose\s+\.wiki-compose-actions--floating\s*{[^}]*align-items:\s*center/);
  assert.match(wikiCss, /\.westgate-wiki-compose\s+\.wiki-compose-actions--floating\s*{[^}]*justify-content:\s*center/);
  assert.match(wikiCss, /\.westgate-wiki-compose\s+\.wiki-compose-actions--floating\s*{[^}]*transform:\s*none/);
  assert.doesNotMatch(wikiCss, /\.westgate-wiki-compose\s+\.wiki-compose-actions--floating\s*{[^}]*left:\s*50%/);
  assert.doesNotMatch(wikiCss, /\.westgate-wiki-compose\s+\.wiki-compose-actions--floating\s*{[^}]*left:\s*50vw/);
});

test("return cancellation blocks default and delegated NodeBB navigation", function () {
  assert.match(composePageJs, /returnLink\.addEventListener\("click",\s*async function \(event\) \{/);
  assert.match(composePageJs, /event\.preventDefault\(\)/);
  assert.match(composePageJs, /event\.stopPropagation\(\)/);
  assert.match(composePageJs, /event\.stopImmediatePropagation\(\)/);
  assert.match(composePageJs, /hasUnsavedChanges && !window\.confirm/);
  assert.match(composePageJs, /return;\s*\}\s*await destroyWikiEditor\(\)/);
});
