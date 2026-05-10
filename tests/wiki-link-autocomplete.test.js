"use strict";

const assert = require("node:assert/strict");

const state = {
  settings: {
    categoryIds: "1, 2, 3",
    includeChildCategories: "0"
  },
  categories: new Map([
    [1, { cid: 1, name: "Wiki", slug: "1/wiki", parentCid: 0, topic_count: 0 }],
    [2, { cid: 2, name: "Feats", slug: "2/feats", parentCid: 1, topic_count: 0 }],
    [3, { cid: 3, name: "Item Types", slug: "3/item-types", parentCid: 1, topic_count: 0 }]
  ])
};

const originalMainRequire = require.main.require.bind(require.main);

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
      getSortedSetRange: async () => [],
      getSortedSetRevRange: async () => [],
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
        can: async () => true,
        get: async () => ({ read: true, "topics:read": true })
      },
      topics: {
        filterTids: async (privilege, tids) => tids,
        get: async () => ({ "topics:read": true, view_deleted: false, view_scheduled: false })
      }
    },
    "./src/slugify": (value) => String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
    "./src/topics": {
      getTopicData: async () => null,
      getTopicsFields: async () => []
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

const config = require("../lib/config");
const wikiLinkAutocomplete = require("../lib/wiki-link-autocomplete");

(async () => {
  await config.getSettings({ bustCache: true });

  const compactAliasResults = await wikiLinkAutocomplete.search({
    q: "itemtypes",
    scope: "all-wiki",
    type: "namespace",
    uid: 1,
    limit: 10
  });

  assert.deepStrictEqual(
    compactAliasResults.map((row) => row.wikiPath),
    ["/wiki/item-types"],
    "namespace autocomplete should match compact typed aliases against spaced or hyphenated namespace names"
  );
  assert.strictEqual(compactAliasResults[0].insertText, "[[ns:item-types]]");

  const directSlugResults = await wikiLinkAutocomplete.search({
    q: "feats",
    scope: "all-wiki",
    type: "namespace",
    uid: 1,
    limit: 10
  });

  assert.deepStrictEqual(
    directSlugResults.map((row) => row.wikiPath),
    ["/wiki/feats"],
    "namespace autocomplete should still match direct namespace route leaves"
  );

  console.log("wiki-link autocomplete tests passed");
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
