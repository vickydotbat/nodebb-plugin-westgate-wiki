"use strict";

const db = require.main.require("./src/database");
const posts = require.main.require("./src/posts");
const topics = require.main.require("./src/topics");

const config = require("./config");

async function getWikiMainPostIds(settings) {
  const tidsByCategory = await Promise.all(
    settings.effectiveCategoryIds.map((cid) => db.getSortedSetRange(`cid:${cid}:tids`, 0, -1))
  );
  const tids = [...new Set(tidsByCategory.flat().filter(Boolean))];

  if (!tids.length) {
    return [];
  }

  const topicData = await topics.getTopicsFields(tids, ["mainPid"]);
  return topicData
    .map((topic) => parseInt(topic && topic.mainPid, 10))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

async function clearWikiPostParseCache(payload) {
  const settings = await config.getSettings();
  const cid = parseInt(payload && payload.topic && payload.topic.cid, 10);

  if (!settings.effectiveCategoryIds.includes(cid)) {
    return payload;
  }

  const pids = await getWikiMainPostIds(settings);
  pids.forEach((pid) => posts.clearCachedPost(pid));

  return payload;
}

module.exports = {
  clearWikiPostParseCache,
  getWikiMainPostIds
};
