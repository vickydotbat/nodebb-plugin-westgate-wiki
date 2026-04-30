"use strict";

const forumExclusion = require("./forum-exclusion-service");

async function filterSearchInContent(data) {
  if (!data || !Array.isArray(data.pids) || !data.pids.length) {
    return data;
  }

  data.pids = await forumExclusion.filterNonWikiPids(data.pids);
  return data;
}

async function filterSearchIndexTopics(data) {
  if (!data || !Array.isArray(data.data) || !Array.isArray(data.tids)) {
    return data;
  }

  const wikiCidSet = await forumExclusion.getWikiCidSet();
  return forumExclusion.filterParallelArraysByTopics(data, wikiCidSet);
}

async function filterSearchIndexPosts(data) {
  if (!data || !Array.isArray(data.data) || !Array.isArray(data.pids)) {
    return data;
  }

  const wikiCidSet = await forumExclusion.getWikiCidSet();
  return forumExclusion.filterParallelArraysByPosts(data, wikiCidSet);
}

module.exports = {
  filterSearchInContent,
  filterSearchIndexPosts,
  filterSearchIndexTopics
};
