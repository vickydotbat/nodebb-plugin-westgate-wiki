"use strict";

const db = require.main.require("./src/database");
const topics = require.main.require("./src/topics");
const utils = require.main.require("./src/utils");
const helpers = require.main.require("./src/controllers/helpers");
const privileges = require.main.require("./src/privileges");

const config = require("./config");
const serializer = require("./serializer");
const wikiPaths = require("./wiki-paths");

function normalizeQuery(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

async function searchNamespaceTopics(req, res) {
  const cid = parseInt(req.params.cid, 10);
  const q = normalizeQuery(req.query && req.query.q);

  if (!utils.isNumber(cid) || cid <= 0) {
    return helpers.formatApiResponse(400, res, new Error("[[error:invalid-data]]"));
  }

  const settings = await config.getSettings();

  if (!settings.isConfigured || !settings.effectiveCategoryIds.includes(cid)) {
    return helpers.formatApiResponse(404, res, new Error("[[error:not-found]]"));
  }

  const canRead = await privileges.categories.can("topics:read", cid, req.uid);

  if (!canRead) {
    return helpers.formatApiResponse(403, res, new Error("[[error:no-privileges]]"));
  }

  const tids = await db.getSortedSetRevRange(`cid:${cid}:tids`, 0, 200);
  const topicList = await topics.getTopicsFields(tids, ["tid", "title", "titleRaw", "slug", "deleted", "scheduled"]);

  const sectionPath = await wikiPaths.getNamespacePath(cid);

  const matches = topicList.filter((topic) => {
    if (!topic || topic.deleted || topic.scheduled || !topic.slug) {
      return false;
    }
    if (!q) {
      return true;
    }
    const title = String(topic.titleRaw || topic.title || "").toLowerCase();
    return title.includes(q);
  }).slice(0, 25).map((topic) => {
    const titlePath = serializer.getTitlePath(topic.titleRaw || topic.title);
    const titleLeaf = titlePath.length ? titlePath[titlePath.length - 1] : topic.title;
    const slugLeaf = wikiPaths.getTopicSlugLeaf(topic);

    return {
      tid: topic.tid,
      title: topic.title,
      titleLeaf,
      wikiPath: sectionPath && slugLeaf ? `${sectionPath}/${slugLeaf}` : wikiPaths.getLegacyArticlePath(topic),
      slug: topic.slug
    };
  });

  return helpers.formatApiResponse(200, res, { topics: matches });
}

module.exports = {
  searchNamespaceTopics
};
