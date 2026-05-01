"use strict";

const assert = require("assert");

const state = {
  settings: {
    categoryIds: "",
    includeChildCategories: "0"
  },
  categories: new Map(),
  topics: new Map(),
  tidsByCid: new Map()
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

require.main.require = function requireNodebbStub(id) {
  const stubs = {
    "./src/categories": {
      getCategoryData: async (cid) => state.categories.get(parseInt(cid, 10)) || null,
      getChildrenCids: async () => []
    },
    "./src/database": {
      getSortedSetRange: async (key) => state.tidsByCid.get(parseInt(key.match(/^cid:(\d+):tids$/)[1], 10)) || [],
      getSortedSetRevRange: async (key) => state.tidsByCid.get(parseInt(key.match(/^cid:(\d+):tids$/)[1], 10)) || [],
      getObjectField: async () => null,
      getObject: async () => ({})
    },
    "./src/controllers/helpers": {},
    "./src/user": {
      isAdministrator: async () => false
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
        filterTids: async (priv, tids) => (Array.isArray(tids) ? tids : [])
      }
    },
    "./src/meta": {
      settings: {
        get: async () => state.settings,
        setOnEmpty: async () => {},
        set: async () => {}
      }
    },
    "./src/slugify": slugify,
    "./src/utils": {
      isNumber: function isNumberStub(val) {
        if (typeof val === "number") {
          return Number.isFinite(val);
        }
        if (typeof val === "string" && val.trim() !== "") {
          return !Number.isNaN(parseFloat(val));
        }
        return false;
      }
    },
    "./src/topics": {
      getTopicData: async (tid) => state.topics.get(parseInt(tid, 10)) || null,
      getTopicsFields: async (tids) => tids.map((tid) => state.topics.get(parseInt(tid, 10))).filter(Boolean),
      getTopicsFromSet: async (setKey, uid, start, stop) => {
        const m = setKey.match(/^cid:(\d+):tids$/);
        const cid = m ? parseInt(m[1], 10) : 0;
        const tids = (state.tidsByCid.get(cid) || []).slice(start, stop + 1);
        return tids.map((tid) => state.topics.get(tid)).filter(Boolean);
      },
      getTopicField: async (tid, field) => {
        const t = state.topics.get(parseInt(tid, 10));
        return t && Object.prototype.hasOwnProperty.call(t, field) ? t[field] : null;
      }
    },
    "nconf": {
      get: (key) => (key === "relative_path" ? "" : undefined)
    }
  };

  if (!stubs[id]) {
    return originalMainRequire(id);
  }
  return stubs[id];
};

const wikiPaths = require("../lib/wiki-paths");
const wikiLinks = require("../lib/wiki-links");

function reset(settings, categories, topics) {
  state.settings = {
    includeChildCategories: "0",
    ...settings
  };
  setCategories(categories);
  setTopics(topics || []);
}

(async () => {
  reset(
    { categoryIds: "1, 2, 3" },
    [
      { cid: 1, name: "Wiki", slug: "1/wiki", parentCid: 0 },
      { cid: 2, name: "Mechanics", slug: "2/mechanics", parentCid: 1 },
      { cid: 3, name: "Classes", slug: "3/classes", parentCid: 2 }
    ]
  );
  assert.strictEqual(await wikiPaths.getNamespacePath(3), "/wiki/mechanics/classes");

  reset(
    { categoryIds: "1, 2, 3" },
    [
      { cid: 1, name: "Wiki", slug: "1/wiki", parentCid: 0 },
      { cid: 2, name: "Classes A", slug: "2/classes", parentCid: 1 },
      { cid: 3, name: "Classes B", slug: "3/classes", parentCid: 1 }
    ]
  );
  assert.strictEqual((await wikiPaths.resolveNamespacePath("classes")).status, "namespace-collision");
  assert.strictEqual((await wikiPaths.getNamespaceSetupDiagnostics()).namespaceCollisions.length, 1);

  reset(
    { categoryIds: "4" },
    [
      { cid: 4, name: "Search", slug: "4/search", parentCid: 0 }
    ]
  );
  assert.strictEqual((await wikiPaths.resolveNamespacePath("search")).status, "reserved-path-segment");
  assert.deepStrictEqual(
    (await wikiPaths.getNamespaceSetupDiagnostics()).reservedNamespacePaths.map((row) => row.path),
    ["/wiki/search"]
  );

  reset(
    { categoryIds: "1" },
    [
      { cid: 1, name: "Wiki", slug: "1/wiki", parentCid: 0, topic_count: 2 }
    ],
    [
      { tid: 10, cid: 1, title: "Acolyte", slug: "10/acolyte", deleted: 0, scheduled: 0, postcount: 1 },
      { tid: 11, cid: 1, title: "Acolyte", slug: "11/acolyte", deleted: 0, scheduled: 0, postcount: 1 }
    ]
  );
  assert.strictEqual((await wikiPaths.resolveArticlePath("acolyte")).status, "page-collision");
  assert.strictEqual((await wikiPaths.validatePageTitlePath(1, "Acolyte")).status, "page-collision");
  assert.strictEqual((await wikiPaths.validatePageTitlePath(1, "Acolyte", { omitTid: 10 })).status, "page-collision");
  assert.strictEqual((await wikiPaths.validatePageTitlePath(1, "New Page")).path, "/wiki/new-page");

  reset(
    { categoryIds: "1, 2" },
    [
      { cid: 1, name: "Wiki", slug: "1/wiki", parentCid: 0 },
      { cid: 2, name: "Guides", slug: "2/guides", parentCid: 1 }
    ]
  );
  assert.strictEqual((await wikiPaths.validatePageTitlePath(1, "Guides")).status, "namespace-page-collision");
  assert.strictEqual((await wikiPaths.validatePageTitlePath(1, "Search")).status, "reserved-path-segment");

  reset(
    { categoryIds: "1, 2" },
    [
      { cid: 1, name: "Wiki", slug: "1/wiki", parentCid: 0 },
      { cid: 2, name: "Development", slug: "2/development", parentCid: 1, topic_count: 1 }
    ],
    [
      { tid: 20, cid: 2, title: "Map Creation Guide", slug: "20/map-creation-guide" }
    ]
  );
  assert.match(
    await wikiLinks.replaceWikiLinks("[[development:Map Creation Guide]]", 1, await require("../lib/config").getSettings()),
    /href="\/wiki\/development\/map-creation-guide"/
  );

  reset(
    { categoryIds: "1, 2, 3" },
    [
      { cid: 1, name: "Wiki", slug: "1/wiki", parentCid: 0 },
      { cid: 2, name: "Development", slug: "2/development", parentCid: 1 },
      { cid: 3, name: "Guides", slug: "3/guides", parentCid: 2, topic_count: 2 }
    ],
    [
      { tid: 30, cid: 3, title: "Module Development: Setup on Windows", slug: "30/module-development-setup-on-windows", deleted: 0, scheduled: 0, postcount: 1 },
      { tid: 31, cid: 3, title: "Module Development: Linux Setup", slug: "31/module-development-linux-setup", deleted: 0, scheduled: 0, postcount: 1 }
    ]
  );
  assert.match(
    await wikiLinks.replaceWikiLinks("[[development/guides/module-development-setup-on-windows]]", 3, await require("../lib/config").getSettings()),
    /href="\/wiki\/development\/guides\/module-development-setup-on-windows"/
  );
  assert.match(
    await wikiLinks.replaceWikiLinks("[[module-development-setup-on-windows]]", 3, await require("../lib/config").getSettings()),
    /href="\/wiki\/development\/guides\/module-development-setup-on-windows"/
  );
  assert.strictEqual(wikiLinks.getViewerUid({ uid: 42 }), 42);
  assert.strictEqual(wikiLinks.getViewerUid({ userData: { uid: 43 } }), 43);

  console.log("wiki-paths tests passed");
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
