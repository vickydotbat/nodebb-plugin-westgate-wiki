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

test("package scripts and dependencies are Tiptap-only", function () {
  const pkg = require("../package.json");

  assert.equal(pkg.scripts["build:tiptap"], "vite build --config tiptap/vite.config.mjs");
  assert.equal(pkg.scripts["build:ckeditor"], undefined);
  assert.equal(pkg.scripts["build:editors"], "npm run build:tiptap");
  assert.equal(pkg.devDependencies.ckeditor5, undefined);
});

test("compose page no longer loads a CKEditor fallback path", function () {
  const composePage = fs.readFileSync(path.join(rootDir, "public/wiki-compose-page.js"), "utf8");
  const composeAssets = fs.readFileSync(path.join(rootDir, "lib/compose-assets.js"), "utf8");
  const composeTemplate = fs.readFileSync(path.join(rootDir, "templates/wiki-compose.tpl"), "utf8");

  assert.doesNotMatch(composePage, /WikiEditorBundle|FALLBACK_EDITOR_KIND|fallback-editor|CKEditor|ckeditor/i);
  assert.doesNotMatch(composeAssets, /fallback-editor|ckeditor/i);
  assert.doesNotMatch(composeTemplate, /westgate-wiki-ck-body-sink|ckeditor/i);
});

test("compose editor assets use a plugin asset version instead of only NodeBB cache-buster", function () {
  const composeAssets = require("../lib/compose-assets");
  const composeController = fs.readFileSync(path.join(rootDir, "lib/controllers/compose.js"), "utf8");
  const composeTemplate = fs.readFileSync(path.join(rootDir, "templates/wiki-compose.tpl"), "utf8");

  assert.equal(typeof composeAssets.getAssetVersion, "function");
  assert.match(composeAssets.getAssetVersion(), /^[a-f0-9]{12}$/);
  assert.match(composeController, /composeAssetVersion:\s*composeAssets\.getAssetVersion\(\)/);
  assert.match(composeTemplate, /editor\.js\?v=\{composeAssetVersion\}/);
  assert.match(composeTemplate, /page\.js\?v=\{composeAssetVersion\}/);
  assert.doesNotMatch(composeTemplate, /compose\/editor\.js\?\{config\.cache-buster\}/);
});
