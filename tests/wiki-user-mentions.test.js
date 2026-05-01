"use strict";

const assert = require("assert");

const state = {
  settings: {
    categoryIds: "1",
    includeChildCategories: "0"
  },
  topics: new Map([[10, { tid: 10, cid: 1 }]]),
  usersBySlug: new Map()
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

function setUsers(rows) {
  state.usersBySlug = new Map(rows.map((row) => [row.userslug, row]));
}

require.main.require = function requireNodebbStub(id) {
  const stubs = {
    nconf: {
      get: (key) => (key === "relative_path" ? "/forum" : "")
    },
    "./src/categories": {
      getCategoryData: async () => null,
      getChildrenCids: async () => []
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
        get: async () => ({ read: true, "topics:read": true })
      },
      topics: {
        filterTids: async (priv, tids) => (Array.isArray(tids) ? tids : [])
      }
    },
    "./src/slugify": slugify,
    "./src/topics": {
      getTopicData: async (tid) => state.topics.get(parseInt(tid, 10)) || null,
      getTopicsFields: async () => [],
      getTopicsFromSet: async () => [],
      getTopicField: async () => null
    },
    "./src/user": {
      getUidByUserslug: async (userslug) => {
        const row = state.usersBySlug.get(userslug);
        return row ? row.uid : null;
      },
      getUserFields: async (uid) => {
        for (const row of state.usersBySlug.values()) {
          if (parseInt(row.uid, 10) === parseInt(uid, 10)) {
            return row;
          }
        }
        return null;
      },
      isAdministrator: async () => false
    },
    "./src/utils": {
      isNumber: (value) => !Number.isNaN(parseFloat(value))
    }
  };

  if (!stubs[id]) {
    return originalMainRequire(id);
  }
  return stubs[id];
};

const wikiUserMentions = require("../lib/wiki-user-mentions");

(async () => {
  setUsers([
    { uid: 1, username: "xtul", userslug: "xtul", displayname: "xtul" },
    { uid: 2, username: "Vicky", userslug: "vicky", displayname: "Vicky" }
  ]);

  assert.deepStrictEqual(
    wikiUserMentions.collectMentionNames("<p>Hello @xtul, @missing, and email me@example.com.</p>"),
    ["xtul", "missing"]
  );

  {
    const html = await wikiUserMentions.transformUserMentionsInHtml("<p>Hello @xtul.</p>");
    assert(html.includes('<a class="wiki-user-mention" href="/forum/user/xtul">@xtul</a>'), "known user should link");
    assert(html.includes(".</p>"), "trailing punctuation should remain outside the link");
  }

  {
    const html = await wikiUserMentions.transformUserMentionsInHtml("<p>Hello @missing and @Vicky.</p>");
    assert(html.includes("Hello @missing and "), "unknown user should remain plain text");
    assert(html.includes('href="/forum/user/vicky">@Vicky</a>'), "display casing from the article should be preserved");
  }

  {
    const html = await wikiUserMentions.transformUserMentionsInHtml(
      '<p><a href="/user/xtul">@xtul</a> <code>@xtul</code> <pre>@xtul</pre> outside @xtul</p>'
    );
    assert.strictEqual((html.match(/wiki-user-mention/g) || []).length, 1, "only unprotected text should link");
    assert(html.includes('<a href="/user/xtul">@xtul</a>'), "existing anchors should be left alone");
    assert(html.includes("<code>@xtul</code>"), "inline code should be left alone");
    assert(html.includes("<pre>@xtul</pre>"), "pre blocks should be left alone");
  }

  {
    const data = {
      postData: {
        content: "<p>Article mention @xtul</p>",
        tid: 10
      }
    };
    const transformed = await wikiUserMentions.transformWikiUserMentions(data);
    assert(transformed.postData.content.includes('href="/forum/user/xtul"'), "wiki-category post should transform");
  }

  {
    const data = {
      postData: {
        content: "<p>Forum mention @xtul</p>",
        tid: 99
      }
    };
    const transformed = await wikiUserMentions.transformWikiUserMentions(data);
    assert.strictEqual(transformed.postData.content, "<p>Forum mention @xtul</p>", "non-wiki post should not transform");
  }

  console.log("wiki-user-mentions tests passed");
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
