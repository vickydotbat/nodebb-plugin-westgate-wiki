"use strict";

const assert = require("node:assert/strict");

const state = {
  settings: {
    categoryIds: "1, 2",
    includeChildCategories: "0"
  },
  categories: new Map([
    [1, { cid: 1, name: "Wiki", slug: "1/wiki", parentCid: 0 }],
    [2, { cid: 2, name: "Guides", slug: "2/guides", parentCid: 1 }]
  ]),
  topics: new Map([
    [10, { tid: 10, cid: 2, title: "Map Creation Guide", slug: "10/map-creation-guide" }]
  ]),
  categoryDataCalls: 0,
  topicDataCalls: 0
};

const originalMainRequire = require.main.require.bind(require.main);

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

require.main.require = function requireNodebbStub(id) {
  const stubs = {
    "./src/categories": {
      getCategoryData: async (cid) => {
        state.categoryDataCalls += 1;
        return state.categories.get(parseInt(cid, 10)) || null;
      },
      getChildrenCids: async () => []
    },
    "./src/meta": {
      settings: {
        get: async () => state.settings,
        setOnEmpty: async () => {},
        set: async () => {}
      }
    },
    "./src/slugify": slugify,
    "./src/topics": {
      getTopicData: async (tid) => {
        state.topicDataCalls += 1;
        return state.topics.get(parseInt(tid, 10)) || null;
      }
    }
  };

  return stubs[id] || originalMainRequire(id);
};

const config = require("../lib/config");
const wikiPaths = require("../lib/wiki-paths");

(async () => {
  assert.equal(typeof wikiPaths.invalidateNamespaceIndexCache, "function");
  assert.equal(typeof wikiPaths.getCacheMetrics, "function");
  assert.equal(typeof wikiPaths.resetCacheMetrics, "function");

  await config.getSettings({ bustCache: true });
  wikiPaths.invalidateNamespaceIndexCache();
  wikiPaths.resetCacheMetrics();

  assert.strictEqual(await wikiPaths.getNamespacePath(2), "/wiki/guides");
  assert.strictEqual((await wikiPaths.resolveNamespacePath("guides")).cid, 2);
  assert.strictEqual(await wikiPaths.getArticlePath(10), "/wiki/guides/map-creation-guide");

  assert.strictEqual(state.categoryDataCalls, 2, "namespace index should load each effective category once");
  assert.strictEqual(state.topicDataCalls, 1, "article path by tid should still load topic data once");

  wikiPaths.invalidateNamespaceIndexCache();
  assert.strictEqual(await wikiPaths.getNamespacePath(2), "/wiki/guides");
  assert.strictEqual(state.categoryDataCalls, 4, "namespace invalidation should force a rebuild");

  const metrics = wikiPaths.getCacheMetrics();
  assert(metrics.namespaceIndex.hits >= 1, "namespace index metrics should record hits");
  assert(metrics.namespaceIndex.rebuilds >= 2, "namespace index metrics should record rebuilds");

  console.log("wiki-paths cache tests passed");
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
