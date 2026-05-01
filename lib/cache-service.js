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

  const wikiDirectory = require("./wiki-directory-service");
  wikiDirectory.invalidateNamespace(cid);

  const pids = await getWikiMainPostIds(settings);
  pids.forEach((pid) => posts.clearCachedPost(pid));

  return payload;
}

async function clearWikiPostEditCache(data) {
  const post = data && data.post;
  if (!post || !post.pid) {
    return;
  }

  const settings = await config.getSettings();
  const tid = parseInt(post.tid, 10);
  if (!Number.isInteger(tid) || tid <= 0) {
    return;
  }

  const topicData = await topics.getTopicFields(tid, ["cid", "mainPid"]);
  const cid = parseInt(topicData.cid, 10);
  if (!settings.effectiveCategoryIds.includes(cid)) {
    return;
  }

  const wikiDirectory = require("./wiki-directory-service");
  wikiDirectory.invalidateNamespace(cid);

  const mainPid = parseInt(topicData.mainPid, 10);
  if (Number.isInteger(mainPid) && mainPid > 0 && mainPid === parseInt(post.pid, 10)) {
    posts.clearCachedPost(mainPid);
  }
}

module.exports = {
  clearWikiPostParseCache,
  clearWikiPostEditCache,
  getWikiMainPostIds
};
