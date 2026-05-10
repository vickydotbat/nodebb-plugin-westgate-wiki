"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const missingPageCreate = require("../lib/wiki-missing-page-create");

const routesSource = fs.readFileSync(path.join(__dirname, "..", "routes/wiki.js"), "utf8");
const sectionTemplate = fs.readFileSync(path.join(__dirname, "..", "templates/wiki-section.tpl"), "utf8");

assert.equal(missingPageCreate.titleFromPageSlug("my-cool-page"), "My Cool Page");
assert.equal(missingPageCreate.titleFromPageSlug("My%20Cool%20Page"), "My Cool Page");
assert.equal(missingPageCreate.titleFromPageSlug("NWScript_Guide"), "NWScript Guide");

assert.match(
  routesSource,
  /article\.status === "page-not-found"[\s\S]*wikiService\.getSection\(article\.cid, req\.uid\)[\s\S]*section\.privileges\.canCreatePage[\s\S]*renderSection\(req, res, next, wikiSection, \{ createIntentTitle \}\)/,
  "missing wiki article routes should render the namespace create prompt when the viewer can create pages"
);
assert.match(
  sectionTemplate,
  /<!-- IF createIntentAutoload -->[\s\S]*data-wiki-create-autoload="1"[\s\S]*<!-- ENDIF createIntentAutoload -->/,
  "direct missing-page prompts should not always auto-open the editor like redlinks do"
);

console.log("wiki missing page create tests passed");
