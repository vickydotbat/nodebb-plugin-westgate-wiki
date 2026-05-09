"use strict";

const assert = require("node:assert/strict");

const state = {
  settings: {
    categoryIds: "1, 2",
    includeChildCategories: "0"
  },
  categories: new Map([
    [1, { cid: 1, name: "Wiki", slug: "1/wiki", parentCid: 0, topic_count: 0 }],
    [2, { cid: 2, name: "Development", slug: "2/development", parentCid: 1, topic_count: 2 }]
  ]),
  topics: new Map([
    [10, { tid: 10, cid: 2, title: "Map Creation Guide", titleRaw: "Map Creation Guide", slug: "10/map-creation-guide", deleted: 0, scheduled: 0 }],
    [11, { tid: 11, cid: 2, title: "Missing Helpers", titleRaw: "Missing Helpers", slug: "11/missing-helpers", deleted: 0, scheduled: 0 }]
  ]),
  tidsByCid: new Map([[2, [10, 11]]]),
  categoryDataCalls: 0,
  sortedSetRangeCalls: 0,
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

require.main.require = function requireNodebbStub(id) {
  const stubs = {
    "nconf": {
      get: (key) => (key === "relative_path" ? "" : undefined)
    },
    "./src/categories": {
      getCategoryData: async (cid) => {
        state.categoryDataCalls += 1;
        return state.categories.get(parseInt(cid, 10)) || null;
      },
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
      getSortedSetRange: async (key) => {
        state.sortedSetRangeCalls += 1;
        const cid = parseInt(key.match(/^cid:(\d+):tids$/)[1], 10);
        return state.tidsByCid.get(cid) || [];
      },
      getSortedSetRevRange: async (key, start, stop) => {
        const cid = parseInt(key.match(/^cid:(\d+):tids$/)[1], 10);
        return (state.tidsByCid.get(cid) || []).slice(start, stop + 1);
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
    "./src/slugify": slugify,
    "./src/privileges": {
      categories: {
        get: async () => ({ read: true, "topics:read": true }),
        can: async () => true,
        isAdminOrMod: async () => false
      },
      topics: {
        filterTids: async (privilege, tids) => tids,
        get: async () => ({ "topics:read": true, view_deleted: false, view_scheduled: false })
      }
    },
    "./src/topics": {
      getTopicData: async () => null,
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
const wikiLinks = require("../lib/wiki-links");
const config = require("../lib/config");

(async () => {
  wikiDirectory.invalidateAllWikiCaches();
  const settings = await config.getSettings({ bustCache: true });
  const html = await wikiLinks.replaceWikiLinks(
    [
      "[[development:Map Creation Guide]]",
      "[[development:Map Creation Guide|Map guide]]",
      "[[ns:development]]",
      "[[Development]]",
      '<span class="wiki-entity wiki-entity--page" data-wiki-entity="page" data-wiki-target="development/Map Creation Guide" data-wiki-label="Guide entity">Guide entity</span>',
      "[[New Redlink]]"
    ].join(" "),
    2,
    settings
  );

  assert.match(html, /href="\/wiki\/development\/map-creation-guide"/);
  assert.match(html, />Map guide<\/a>/);
  assert.match(html, /class="wiki-internal-link wiki-namespace-link" href="\/wiki\/development"/);
  assert.strictEqual(
    (html.match(/class="wiki-internal-link wiki-namespace-link" href="\/wiki\/development"/g) || []).length,
    2,
    "bare links that uniquely match a namespace should resolve like ns: links when no page exists"
  );
  assert.match(html, /Guide entity<\/a>/);
  assert.match(html, /class="wiki-redlink" href="\/wiki\/development\?create=New%20Redlink&amp;redlink=1&amp;cid=2"/);
  assert.strictEqual(state.sortedSetRangeCalls, 1, "per-post resolver should scan each target namespace once");
  assert.strictEqual(state.topicFieldCalls, 1, "per-post resolver should hydrate each target namespace once");
  assert(state.categoryDataCalls <= 2, "per-post resolver should reuse effective category rows and namespace paths");

  state.topics.set(12, {
    tid: 12,
    cid: 2,
    title: "Asdf :: A sub page :: Baby page",
    titleRaw: "Asdf :: A sub page :: Baby page",
    slug: "12/asdf-a-sub-page-baby-page",
    deleted: 0,
    scheduled: 0
  });
  state.tidsByCid.set(2, [10, 11, 12]);
  require("../lib/wiki-directory-service").invalidateAllWikiCaches();
  const subpageHtml = await wikiLinks.replaceWikiLinks(
    "[[Asdf :: A sub page :: Baby page|Baby page]]",
    2,
    settings
  );
  assert.match(subpageHtml, /<a class="wiki-internal-link wiki-subpage-link" href="\/wiki\/development\/asdf-a-sub-page-baby-page">Baby page<\/a>/);

  const bareLeafSubpageHtml = await wikiLinks.replaceWikiLinks(
    "[[Baby page]]",
    2,
    settings
  );
  assert.match(
    bareLeafSubpageHtml,
    /<a class="wiki-internal-link wiki-subpage-link" href="\/wiki\/development\/asdf-a-sub-page-baby-page"><span class="wiki-topic-parent-path"><span class="wiki-topic-title-parent">Asdf<\/span><span class="wiki-topic-title-separator" aria-hidden="true">\/<\/span><span class="wiki-topic-title-parent">A sub page<\/span><span class="wiki-topic-title-separator" aria-hidden="true">\/<\/span><\/span><span class="wiki-topic-title-leaf">Baby page<\/span><\/a>/,
    "bare leaf links should resolve to a unique subpage leaf and render with segmented title-path markup"
  );

  console.log("wiki-link resolver cache tests passed");
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
