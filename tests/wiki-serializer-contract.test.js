"use strict";

const assert = require("node:assert/strict");
const serializer = require("../lib/serializer");

const summary = serializer.serializeTopicSummary({
  tid: 10,
  cid: 2,
  title: "Guide",
  titleRaw: "Guides/Guide",
  slug: "10/guide",
  postcount: 1,
  deleted: 0,
  scheduled: 0,
  lastposttime: 1000,
  timestamp: 900,
  updatetime: 950
});

assert.strictEqual(summary.tid, 10);
assert.strictEqual(summary.titleLeaf, "Guide");
assert.strictEqual(summary.wikiPath, "/wiki/10/guide");
assert.strictEqual(Object.prototype.hasOwnProperty.call(summary, "cid"), false, "public topic summaries should not expose internal cid");
assert.strictEqual(Object.prototype.hasOwnProperty.call(summary, "deleted"), false, "public topic summaries should not expose deletion state");
assert.strictEqual(Object.prototype.hasOwnProperty.call(summary, "scheduled"), false, "public topic summaries should not expose scheduling state");
assert.strictEqual(Object.prototype.hasOwnProperty.call(summary, "lastposttime"), false, "public topic summaries should not expose search timestamps");
assert.strictEqual(Object.prototype.hasOwnProperty.call(summary, "timestamp"), false, "public topic summaries should not expose search timestamps");
assert.strictEqual(Object.prototype.hasOwnProperty.call(summary, "updatetime"), false, "public topic summaries should not expose search timestamps");

console.log("wiki serializer contract tests passed");
