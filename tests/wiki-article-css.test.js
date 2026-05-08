"use strict";

const assert = require("node:assert/strict");

const state = {
  settings: {
    categoryIds: "1",
    includeChildCategories: "0"
  },
  topics: new Map([[10, { tid: 10, cid: 1, mainPid: 100, title: "Styled Page", slug: "10/styled-page" }]])
};

const originalMainRequire = require.main.require.bind(require.main);

require.main.require = function requireNodebbStub(id) {
  const stubs = {
    nconf: {
      get: () => ""
    },
    "./src/categories": {
      getCategoryData: async (cid) => ({ cid: parseInt(cid, 10), name: "Wiki", slug: `${cid}/wiki`, parentCid: 0 }),
      getChildren: async () => [[]],
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
      getObjectField: async () => null,
      incrObjectField: async () => 1,
      isSetMember: async () => false,
      getSetMembers: async () => [],
      getSortedSetRange: async () => [],
      getSortedSetRevRange: async () => [],
      setAdd: async () => {},
      setRemove: async () => {}
    },
    "./src/meta": {
      settings: {
        get: async () => state.settings,
        setOnEmpty: async () => {}
      }
    },
    "./src/topics": {
      getTopicData: async (tid) => state.topics.get(parseInt(tid, 10)) || null,
      getTopicField: async (tid, field) => {
        const topic = state.topics.get(parseInt(tid, 10));
        return topic && Object.prototype.hasOwnProperty.call(topic, field) ? topic[field] : null;
      },
      setTopicField: async (tid, field, value) => {
        const parsedTid = parseInt(tid, 10);
        const topic = state.topics.get(parsedTid) || { tid: parsedTid };
        topic[field] = value;
        state.topics.set(parsedTid, topic);
      }
    },
    "./src/posts": {
      getPostFields: async (pid) => ({ pid, tid: 10, uid: 2, content: "<p>Article</p>" }),
      getPostSummaryByPids: async (pids) => pids.map((pid) => ({
        pid,
        uid: 2,
        content: "<p>Article</p>",
        timestamp: 1000,
        timestampISO: "1970-01-01T00:00:01.000Z"
      })),
      getUserInfoForPosts: async (uids) => uids.map((uid) => ({ uid, username: "editor", displayname: "Editor" }))
    },
    "./src/notifications": {
      create: async () => {},
      push: async () => {}
    },
    "./src/privileges": {
      categories: {
        get: async () => ({ read: true, "topics:read": true, "topics:create": true })
      },
      posts: {
        canEdit: async () => ({ flag: true })
      },
      topics: {
        get: async () => ({ "topics:read": true, "topics:delete": true })
      }
    },
    "./src/slugify": (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    "./src/user": {
      getUserFields: async (uid) => ({ uid, username: "editor", displayname: "Editor" }),
      getUsersFields: async (uids) => uids.map((uid) => ({ uid, username: "editor", userslug: "editor", displayname: "Editor" })),
      search: async () => ({ users: [] })
    },
    "./src/utils": {
      isNumber: (value) => !Number.isNaN(parseFloat(value)),
      toISOString: (value) => new Date(value).toISOString()
    }
  };

  return stubs[id] || originalMainRequire(id);
};

const wikiArticleCss = require("../lib/wiki-article-css");

(async () => {
  {
    const sanitized = wikiArticleCss.sanitizeArticleCss(`
      @import url("https://evil.test/x.css");
      body { display: none; }
      .hero, h2 { color: #caa55a; background-image: url("javascript:alert(1)"); position: fixed; margin-top: 1rem; }
      a[href^="https://"] { text-decoration: underline; }
      @media (max-width: 700px) { .hero { font-size: 1.2rem; } }
    `);

    assert.doesNotMatch(sanitized, /@import/i);
    assert.doesNotMatch(sanitized, /\bbody\b/i);
    assert.doesNotMatch(sanitized, /javascript/i);
    assert.doesNotMatch(sanitized, /position/i);
    assert.match(sanitized, /\.hero,\s*h2\s*\{/);
    assert.match(sanitized, /color:\s*#caa55a/);
    assert.match(sanitized, /margin-top:\s*1rem/);
    assert.match(sanitized, /@media\s*\(max-width:\s*700px\)/);
  }

  {
    const scoped = wikiArticleCss.scopeArticleCss(".hero, h2 { color: red; }\n@media (max-width: 700px) { .hero { color: blue; } }", 10);

    assert.match(scoped, /\.wiki-article-custom-css-scope-10\s+\.hero,\s*\.wiki-article-custom-css-scope-10\s+h2\s*\{/);
    assert.match(scoped, /@media\s*\(max-width:\s*700px\)\s*\{\s*\.wiki-article-custom-css-scope-10\s+\.hero\s*\{/);
  }

  {
    await wikiArticleCss.setArticleCss(10, ".hero { color: red; }");
    assert.equal(await wikiArticleCss.getArticleCss(10), ".hero { color: red; }");

    const res = {};
    await wikiArticleCss.putArticleCss({
      uid: 2,
      body: {
        tid: 10,
        css: "body { display:none; } .hero { color: red; }"
      }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.articleCss, ".hero { color: red; }");
    assert.equal(await wikiArticleCss.getArticleCss(10), ".hero { color: red; }");
  }

  console.log("wiki-article-css tests passed");
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
