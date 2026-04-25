"use strict";

const categories = require.main.require("./src/categories");
const posts = require.main.require("./src/posts");
const privileges = require.main.require("./src/privileges");
const topics = require.main.require("./src/topics");
const utils = require.main.require("./src/utils");

const config = require("./config");
const wikiService = require("./wiki-service");

async function getWikiPage(topicId, uid) {
  if (!utils.isNumber(topicId)) {
    return { status: "invalid" };
  }

  const [settings, topicData] = await Promise.all([
    config.getSettings(),
    topics.getTopicData(topicId)
  ]);

  if (!topicData) {
    return { status: "not-found" };
  }

  if (!settings.effectiveCategoryIds.includes(parseInt(topicData.cid, 10))) {
    return { status: "not-wiki" };
  }

  const topicPrivileges = await privileges.topics.get(topicData.tid, uid);

  if (
    !topicPrivileges["topics:read"] ||
    (topicData.deleted && !topicPrivileges.view_deleted) ||
    (topicData.scheduled && !topicPrivileges.view_scheduled)
  ) {
    return { status: "forbidden" };
  }

  const [category, mainPost, categoryPrivileges] = await Promise.all([
    categories.getCategoryData(topicData.cid),
    posts.getPostSummaryByPids([topicData.mainPid], uid, { stripTags: false }),
    privileges.categories.get(topicData.cid, uid)
  ]);
  const ancestorSections = await wikiService.getConfiguredAncestorSections(category, settings);
  const namespaceData = await wikiService.getSection(topicData.cid, uid);

  return {
    status: "ok",
    settings,
    topic: topicData,
    category,
    categoryPrivileges,
    ancestorSections,
    sectionNavigation: namespaceData.status === "ok" ? namespaceData.section : null,
    mainPost: mainPost[0] || null
  };
}

module.exports = {
  getWikiPage
};
