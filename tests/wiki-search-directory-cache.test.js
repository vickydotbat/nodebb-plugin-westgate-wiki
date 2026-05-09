"use strict";

const assert = require("node:assert/strict");

const state = {
  settings: {
    categoryIds: "1, 2",
    includeChildCategories: "0"
  },
  categories: new Map(),
  topics: new Map(),
  tidsByCid: new Map(),
  readableCategories: new Set([1, 2]),
  readableTopics: new Set([10, 11]),
  dbRevRangeCalls: 0,
  topicFieldCalls: 0
};

const originalMainRequire = require.main.require.bind(require.main);

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function setCategories(rows) {
  state.categories = new Map(rows.map((row) => [parseInt(row.cid, 10), row]));
}

function setTopics(rows) {
  state.topics = new Map(rows.map((row) => [parseInt(row.tid, 10), row]));
  state.tidsByCid = new Map();
  rows.forEach((row) => {
    const cid = parseInt(row.cid, 10);
    const list = state.tidsByCid.get(cid) || [];
    list.push(parseInt(row.tid, 10));
    state.tidsByCid.set(cid, list);
  });
}

setCategories([
  { cid: 1, name: "Wiki", slug: "1/wiki", parentCid: 0, topic_count: 0 },
  { cid: 2, name: "Development", slug: "2/development", parentCid: 1, topic_count: 2 }
]);
setTopics([
  { tid: 10, cid: 2, title: "Map Creation Guide", titleRaw: "Map Creation Guide", slug: "10/map-creation-guide", deleted: 0, scheduled: 0, lastposttime: 5000 },
  { tid: 11, cid: 2, title: "Map Creation Tools", titleRaw: "Map Creation Tools", slug: "11/map-creation-tools", deleted: 0, scheduled: 0, lastposttime: 7000 }
]);

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
      getSortedSetRevRange: async (key, start, stop) => {
        state.dbRevRangeCalls += 1;
        const cid = parseInt(key.match(/^cid:(\d+):tids$/)[1], 10);
        return (state.tidsByCid.get(cid) || []).slice(start, stop + 1);
      },
      getSortedSetRange: async (key) => {
        const cid = parseInt(key.match(/^cid:(\d+):tids$/)[1], 10);
        return state.tidsByCid.get(cid) || [];
      },
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
          .filter((tid) => state.readableTopics.has(parseInt(tid, 10)))
      }
    },
    "./src/slugify": slugify,
    "./src/topics": {
      getTopicData: async (tid) => state.topics.get(parseInt(tid, 10)) || null,
      getTopicsFields: async (tids) => {
        state.topicFieldCalls += 1;
        return (Array.isArray(tids) ? tids : [])
          .map((tid) => state.topics.get(parseInt(tid, 10)))
          .filter(Boolean);
      }
    },
    "./src/user": {
      isAdministrator: async () => false,
      isGlobalModerator: async () => false
    },
    "./src/utils": {
      isNumber: (value) => String(value || "").trim() !== "" && !Number.isNaN(parseFloat(value))
    }
  };

  return stubs[id] || originalMainRequire(id);
};

const wikiDirectory = require("../lib/wiki-directory-service");
const wikiSearch = require("../lib/wiki-search-service");
const wikiLinkAutocomplete = require("../lib/wiki-link-autocomplete");

(async () => {
  wikiDirectory.invalidateAllWikiCaches();
  await wikiDirectory.getOrderedSummaries(2, 1, false);
  assert.strictEqual(state.dbRevRangeCalls, 1, "warmup should build the directory cache once");

  const searchResult = await wikiSearch.search({ q: "Map Creation", uid: 1, mode: "full", limit: 10 });
  assert.deepStrictEqual(searchResult.results.filter((row) => row.type === "page").map((row) => row.tid), [11, 10]);

  const autocompleteResult = await wikiLinkAutocomplete.search({
    q: "Map",
    cid: 2,
    scope: "current-namespace",
    context: "wiki",
    limit: 10,
    uid: 1
  });
  assert.deepStrictEqual(autocompleteResult.filter((row) => row.type === "page").map((row) => row.tid), [10, 11]);

  assert.strictEqual(state.dbRevRangeCalls, 1, "search and autocomplete should reuse warm directory summaries");
  assert.strictEqual(state.topicFieldCalls, 1, "search and autocomplete should not perform extra topic field scans");

  console.log("wiki search directory cache tests passed");
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
