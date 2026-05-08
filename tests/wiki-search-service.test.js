"use strict";

const assert = require("assert");

const state = {
  settings: {
    categoryIds: "1, 2, 3",
    includeChildCategories: "0"
  },
  categories: new Map(),
  topics: new Map(),
  tidsByCid: new Map(),
  readableCategories: new Set([1, 2, 3]),
  readableTopics: new Set()
};

const originalMainRequire = require.main.require.bind(require.main);

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function setCategories(rows, readableCids) {
  state.categories = new Map(rows.map((row) => [parseInt(row.cid, 10), row]));
  state.readableCategories = new Set((readableCids || rows.map((row) => row.cid)).map((cid) => parseInt(cid, 10)));
}

function setTopics(rows, readableTids) {
  state.topics = new Map(rows.map((row) => [parseInt(row.tid, 10), row]));
  state.tidsByCid = new Map();
  rows.forEach((row) => {
    const cid = parseInt(row.cid, 10);
    const list = state.tidsByCid.get(cid) || [];
    list.push(parseInt(row.tid, 10));
    state.tidsByCid.set(cid, list);
  });
  state.readableTopics = new Set((readableTids || rows.map((row) => row.tid)).map((tid) => parseInt(tid, 10)));
}

function reset({ settings, categories, topics, readableCids, readableTids }) {
  state.settings = {
    includeChildCategories: "0",
    ...settings
  };
  setCategories(categories || [], readableCids);
  setTopics(topics || [], readableTids);
  try {
    require("../lib/config").invalidateSettingsCache();
    require("../lib/wiki-paths").invalidateNamespaceIndexCache({ skipSettingsInvalidation: true });
    require("../lib/wiki-directory-service").invalidateAllWikiCaches();
  } catch (e) {
    // Modules may not be loaded yet during test bootstrap.
  }
}

require.main.require = function requireNodebbStub(id) {
  const stubs = {
    "./src/categories": {
      getCategoryData: async (cid) => state.categories.get(parseInt(cid, 10)) || null,
      getChildrenCids: async () => []
    },
    "./src/controllers/helpers": {
      formatApiResponse: (status, res, payload) => {
        res.statusCode = status;
        res.payload = payload;
        return payload;
      }
    },
    "./src/database": {
      getSortedSetRange: async (key) => state.tidsByCid.get(parseInt(key.match(/^cid:(\d+):tids$/)[1], 10)) || [],
      getSortedSetRevRange: async (key) => state.tidsByCid.get(parseInt(key.match(/^cid:(\d+):tids$/)[1], 10)) || [],
      getObjectField: async () => null,
      getObject: async () => ({})
    },
    "./src/meta": {
      settings: {
        get: async () => state.settings,
        setOnEmpty: async () => {},
        set: async () => {}
      }
    },
    "./src/privileges": {
      categories: {
        get: async (cid) => ({
          read: state.readableCategories.has(parseInt(cid, 10)),
          "topics:read": state.readableCategories.has(parseInt(cid, 10)),
          "topics:create": true
        }),
        can: async (privilege, cid) => privilege === "topics:read" && state.readableCategories.has(parseInt(cid, 10))
      },
      topics: {
        filterTids: async (privilege, tids) => (Array.isArray(tids) ? tids : [])
          .filter((tid) => state.readableTopics.has(parseInt(tid, 10))),
        get: async (tid) => ({
          "topics:read": state.readableTopics.has(parseInt(tid, 10)),
          view_deleted: false,
          view_scheduled: false
        })
      }
    },
    "./src/slugify": slugify,
    "./src/topics": {
      getTopicData: async (tid) => state.topics.get(parseInt(tid, 10)) || null,
      getTopicsFields: async (tids) => (Array.isArray(tids) ? tids : [])
        .map((tid) => state.topics.get(parseInt(tid, 10)))
        .filter(Boolean)
    },
    "./src/user": {
      isAdministrator: async () => false,
      isGlobalModerator: async () => false
    },
    "./src/utils": {
      isNumber: (value) => {
        if (typeof value === "number") {
          return Number.isFinite(value);
        }
        return typeof value === "string" && value.trim() !== "" && !Number.isNaN(parseFloat(value));
      }
    }
  };

  return stubs[id] || originalMainRequire(id);
};

const wikiSearch = require("../lib/wiki-search-service");

(async () => {
  reset({
    settings: { categoryIds: "1, 2, 3" },
    categories: [
      { cid: 1, name: "Wiki", slug: "1/wiki", parentCid: 0, topic_count: 2 },
      { cid: 2, name: "Development", slug: "2/development", parentCid: 1, topic_count: 4 },
      { cid: 3, name: "Secret Maps", slug: "3/secret-maps", parentCid: 1, topic_count: 1 }
    ],
    topics: [
      { tid: 10, cid: 2, title: "Map Creation Guide", titleRaw: "Map Creation Guide", slug: "10/map-creation-guide", deleted: "0", scheduled: "0", lastposttime: 5000 },
      { tid: 11, cid: 2, title: "Map Creation Tools", titleRaw: "Map Creation Tools", slug: "11/map-creation-tools", deleted: "0", scheduled: "0", lastposttime: 7000 },
      { tid: 12, cid: 2, title: "Overland Map Creation", titleRaw: "Guides/Overland Map Creation", slug: "12/overland-map-creation", deleted: "0", scheduled: "0", lastposttime: 9000 },
      { tid: 13, cid: 2, title: "Deleted Map Page", titleRaw: "Deleted Map Page", slug: "13/deleted-map-page", deleted: 1, scheduled: 0, lastposttime: 9500 },
      { tid: 20, cid: 3, title: "Secret Map", titleRaw: "Secret Map", slug: "20/secret-map", deleted: "0", scheduled: "0", lastposttime: 8000 }
    ],
    readableCids: [1, 2],
    readableTids: [10, 11, 12]
  });

  {
    const result = await wikiSearch.search({ q: "Map Creation Guide", uid: 1, mode: "full", limit: 10 });
    assert.strictEqual(result.query, "Map Creation Guide");
    assert.strictEqual(result.hasQuery, true);
    assert.strictEqual(result.queryTooShort, false);
    assert(result.groups.exact.length >= 1, "exact title matches should be grouped separately");
    assert.strictEqual(result.groups.exact[0].tid, 10);
    assert.strictEqual(result.groups.exact[0].wikiPath, "/wiki/development/map-creation-guide");
  }

  {
    const result = await wikiSearch.search({ q: "Map Creation", uid: 1, mode: "full", limit: 10 });
    assert.deepStrictEqual(
      result.groups.pages.slice(0, 2).map((row) => row.tid).sort(),
      [10, 11],
      "prefix matches should rank before contains matches"
    );
    assert.strictEqual(result.groups.pages[2].tid, 12);
    assert(result.results.every((row) => row.cid !== 3), "unreadable namespaces and pages must not leak");
    assert(result.results.every((row) => row.tid !== 13), "deleted topics must not be returned");
  }

  {
    const result = await wikiSearch.search({ q: "development", uid: 1, mode: "full", limit: 10 });
    assert.strictEqual(result.groups.namespaces.length, 1);
    assert.strictEqual(result.groups.namespaces[0].type, "namespace");
    assert.strictEqual(result.groups.namespaces[0].wikiPath, "/wiki/development");
  }

  reset({
    settings: { categoryIds: "1, 2, 3" },
    categories: [
      { cid: 1, name: "Wiki", slug: "1/wiki", parentCid: 0, topic_count: 0 },
      { cid: 2, name: "Development", slug: "2/development", parentCid: 1, topic_count: 1 },
      { cid: 3, name: "Lore", slug: "3/lore", parentCid: 1, topic_count: 1 }
    ],
    topics: [
      { tid: 30, cid: 2, title: "Setup", titleRaw: "Setup", slug: "30/setup", deleted: 0, scheduled: 0, lastposttime: 1000 },
      { tid: 31, cid: 3, title: "Setup", titleRaw: "Setup", slug: "31/setup", deleted: 0, scheduled: 0, lastposttime: 2000 }
    ],
    readableCids: [1, 2, 3],
    readableTids: [30, 31]
  });

  {
    const result = await wikiSearch.search({ q: "s", uid: 1, mode: "full", limit: 10 });
    assert.strictEqual(result.queryTooShort, true);
    assert.deepStrictEqual(result.results, []);
  }

  {
    const result = await wikiSearch.search({ q: "Setup", uid: 1, mode: "full", limit: 10 });
    const pageResults = result.results.filter((row) => row.type === "page");
    assert.strictEqual(pageResults.length, 2);
    assert(pageResults.every((row) => row.namespaceTitle && row.namespacePath), "duplicate leaves need namespace context");
    assert.deepStrictEqual(
      pageResults.map((row) => row.wikiPath).sort(),
      ["/wiki/development/setup", "/wiki/lore/setup"]
    );
  }

  reset({
    settings: { categoryIds: "" },
    categories: [],
    topics: []
  });

  {
    const result = await wikiSearch.search({ q: "Map", uid: 1, mode: "full", limit: 10 });
    assert.strictEqual(result.isConfigured, false);
    assert.deepStrictEqual(result.results, []);
  }

  console.log("wiki-search-service tests passed");
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
