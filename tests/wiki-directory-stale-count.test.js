"use strict";

const assert = require("node:assert/strict");

const state = {
  settings: {
    categoryIds: "1",
    includeChildCategories: "0"
  },
  categories: new Map([
    [1, { cid: 1, name: "Wiki", slug: "1/wiki", parentCid: 0, topic_count: 1 }]
  ]),
  topics: new Map([
    [10, { tid: 10, cid: 1, title: "Server Rules", slug: "10/server-rules", deleted: 0, scheduled: 0, postcount: 1 }],
    [11, { tid: 11, cid: 1, title: "Third-Party Content Credits", slug: "11/third-party-content-credits", deleted: 0, scheduled: 0, postcount: 1 }]
  ]),
  tidsByCid: new Map([[1, [10, 11]]])
};

const originalMainRequire = require.main.require.bind(require.main);

function rangeForCid(key) {
  const m = String(key || "").match(/^cid:(\d+):tids$/);
  return m ? (state.tidsByCid.get(parseInt(m[1], 10)) || []) : [];
}

function sortedSetSlice(key, start, stop) {
  const rows = rangeForCid(key);
  const from = Math.max(0, parseInt(start, 10) || 0);
  const parsedStop = parseInt(stop, 10);
  const to = parsedStop === -1 ? rows.length : parsedStop + 1;
  return rows.slice(from, to);
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

require.main.require = function requireNodebbStub(id) {
  const stubs = {
    "./src/categories": {
      getCategoryData: async (cid) => state.categories.get(parseInt(cid, 10)) || null,
      getChildrenCids: async () => []
    },
    "./src/controllers/helpers": {
      formatApiResponse: () => {}
    },
    "./src/database": {
      getSortedSetRange: async (key, start, stop) => sortedSetSlice(key, start, stop),
      getSortedSetRevRange: async (key, start, stop) => sortedSetSlice(key, start, stop),
      sortedSetCard: async (key) => rangeForCid(key).length,
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
        get: async () => ({
          read: true,
          "topics:read": true,
          "topics:create": true
        })
      },
      topics: {
        filterTids: async (privilege, tids) => (Array.isArray(tids) ? tids : [])
      }
    },
    "./src/slugify": slugify,
    "./src/topics": {
      getTopicData: async (tid) => state.topics.get(parseInt(tid, 10)) || null,
      getTopicsFields: async (tids) => tids.map((tid) => state.topics.get(parseInt(tid, 10))).filter(Boolean)
    },
    "./src/user": {
      isAdministrator: async () => false,
      isGlobalModerator: async () => false
    },
    "./src/utils": {
      isNumber: (value) => value !== "" && !Number.isNaN(parseFloat(value))
    },
    "nconf": {
      get: (key) => (key === "relative_path" ? "" : undefined)
    }
  };

  return stubs[id] || originalMainRequire(id);
};

const config = require("../lib/config");
const wikiDirectory = require("../lib/wiki-directory-service");
const wikiPaths = require("../lib/wiki-paths");

(async () => {
  config.invalidateSettingsCache();
  wikiDirectory.invalidateAllWikiCaches();
  wikiPaths.invalidateNamespaceIndexCache({ skipSettingsInvalidation: true });

  assert.equal((await wikiPaths.resolveArticlePath("server-rules", 1)).status, "ok");
  assert.equal(
    (await wikiPaths.resolveArticlePath("third-party-content-credits", 1)).status,
    "ok",
    "article resolution should not disappear when category.topic_count is lower than the cid tids set"
  );

  console.log("wiki directory stale count tests passed");
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
