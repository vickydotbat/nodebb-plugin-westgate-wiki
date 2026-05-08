"use strict";

const assert = require("node:assert/strict");

const state = {
  settings: {
    categoryIds: "1",
    includeChildCategories: "0"
  },
  now: 100000,
  objects: new Map(),
  topics: new Map([[10, { tid: 10, cid: 1, mainPid: 100, title: "Locked Page", slug: "10/locked-page" }]])
};

const originalMainRequire = require.main.require.bind(require.main);

function slugify(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

require.main.require = function requireNodebbStub(id) {
  const stubs = {
    "./src/categories": {
      getCategoryData: async (cid) => ({ cid: parseInt(cid, 10), name: "Wiki", slug: `${cid}/wiki`, parentCid: 0 }),
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
      delete: async (key) => {
        state.objects.delete(key);
      },
      deleteObject: async (key) => {
        state.objects.delete(key);
      },
      getObject: async (key) => state.objects.get(key) || null,
      getObjectField: async () => null,
      getSetMembers: async () => [],
      getSortedSetRange: async () => [],
      getSortedSetRevRange: async () => [],
      setObject: async (key, value) => {
        state.objects.set(key, { ...value });
      }
    },
    "./src/meta": {
      settings: {
        get: async () => state.settings,
        setOnEmpty: async () => {}
      }
    },
    "./src/privileges": {
      categories: {
        get: async () => ({
          "topics:read": true,
          "topics:create": true,
          find: true
        })
      }
    },
    "./src/slugify": slugify,
    "./src/topics": {
      getTopicField: async (tid, field) => {
        const topic = state.topics.get(parseInt(tid, 10));
        return topic ? topic[field] : null;
      },
      getTopicFields: async (tid) => state.topics.get(parseInt(tid, 10)) || null
    },
    "./src/utils": {
      generateUUID: () => `token-${state.now}`
    },
    "./src/user": {
      getUserFields: async (uid) => ({
        uid,
        username: uid === 2 ? "Editor" : "Other",
        displayname: uid === 2 ? "Editor" : "Other"
      })
    }
  };

  return stubs[id] || originalMainRequire(id);
};

const wikiEditLocks = require("../lib/wiki-edit-locks");
const wikiPageValidation = require("../lib/wiki-page-validation");

wikiEditLocks.setNowProvider(() => state.now);
wikiEditLocks.setTokenProvider(() => `token-${state.now}`);

function resetRuntime() {
  state.now = 100000;
  state.objects = new Map();
}

(async () => {
  resetRuntime();
  {
    const lock = await wikiEditLocks.acquireLock(10, 2);
    const data = await wikiPageValidation.validateTopicEdit({
      uid: 2,
      wikiEditLockToken: lock.token,
      topic: { tid: 10, cid: 1, title: "Locked Page" },
      post: { pid: 100, content: "<p>Updated</p>" }
    });
    assert.equal(data.post.content, "<p>Updated</p>");
  }

  resetRuntime();
  {
    const lock = await wikiEditLocks.acquireLock(10, 2);
    const data = await wikiPageValidation.validateTopicEdit({
      uid: 2,
      req: { query: { wikiEditLockToken: lock.token } },
      topic: { tid: 10, cid: 1, title: "Locked Page" },
      post: { pid: 100, content: "<p>Updated</p>" }
    });
    assert.equal(data.post.content, "<p>Updated</p>");
  }

  resetRuntime();
  {
    const lock = await wikiEditLocks.acquireLock(10, 2);
    await assert.rejects(
      () => wikiPageValidation.validateTopicEdit({
        uid: 3,
        wikiEditLockToken: lock.token,
        topic: { tid: 10, cid: 1, title: "Locked Page" },
        post: { pid: 100, content: "<p>Updated</p>" }
      }),
      /currently being edited by Editor/
    );
  }

  resetRuntime();
  {
    await assert.rejects(
      () => wikiPageValidation.validateTopicEdit({
        uid: 2,
        topic: { tid: 10, cid: 1, title: "Locked Page" },
        post: { pid: 100, content: "<p>Updated</p>" }
      }),
      /Open the wiki editor again/
    );
  }

  console.log("wiki-edit-lock validation tests passed");
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
