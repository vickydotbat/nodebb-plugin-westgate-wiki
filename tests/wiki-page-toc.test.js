"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const wikiPageToc = require("../lib/wiki-page-toc");
const root = path.join(__dirname, "..");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    throw err;
  }
}

test("extractHeadingToc matches article ToC ids for plain and duplicate headings", function () {
  const headings = wikiPageToc.extractHeadingToc(`
    <h2>Advanced Setup</h2>
    <p>Ignored</p>
    <h3>Advanced Setup</h3>
    <h4>Élite &amp; Noble Houses</h4>
  `);

  assert.deepStrictEqual(headings, [
    { id: "advanced-setup", text: "Advanced Setup", level: 2 },
    { id: "advanced-setup-2", text: "Advanced Setup", level: 3 },
    { id: "elite-noble-houses", text: "Élite & Noble Houses", level: 4 }
  ]);
});

test("extractHeadingToc preserves explicit heading ids and strips nested markup", function () {
  const headings = wikiPageToc.extractHeadingToc(`
    <h2 id="already-there">Named <em>Section</em></h2>
    <h3><a href="/wiki/example">Linked</a> Heading</h3>
  `);

  assert.deepStrictEqual(headings, [
    { id: "already-there", text: "Named Section", level: 2 },
    { id: "linked-heading", text: "Linked Heading", level: 3 }
  ]);
});

test("page ToC API is registered and passed to the editor payload", function () {
  const libraryJs = fs.readFileSync(path.join(root, "library.js"), "utf8");
  const composeController = fs.readFileSync(path.join(root, "lib/controllers/compose.js"), "utf8");

  assert.match(libraryJs, /const wikiPageToc = require\("\.\/lib\/wiki-page-toc"\)/);
  assert.match(libraryJs, /"\/westgate-wiki\/page-toc"/);
  assert.match(libraryJs, /wikiPageToc\.apiGetPageToc/);
  assert.match(composeController, /pageTocUrl: `\$\{relativePath\}\/api\/v3\/plugins\/westgate-wiki\/page-toc`/);
});
