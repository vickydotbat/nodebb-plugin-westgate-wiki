"use strict";

const topics = require.main.require("./src/topics");

const forumExclusion = require("./forum-exclusion-service");

function listWithoutWikiTids(list, wikiTidSet) {
  if (!Array.isArray(list) || !list.length || !wikiTidSet.size) {
    return Array.isArray(list) ? list : [];
  }

  return list.filter((tid) => !wikiTidSet.has(String(tid)));
}

function recomputeUnreadCounts(tidsByFilter) {
  const source = tidsByFilter || {};
  return {
    "": Array.isArray(source[""]) ? source[""].length : 0,
    new: Array.isArray(source.new) ? source.new.length : 0,
    watched: Array.isArray(source.watched) ? source.watched.length : 0,
    unreplied: Array.isArray(source.unreplied) ? source.unreplied.length : 0
  };
}

async function filterTopicsUpdateRecent(data) {
  if (!data || data.tid === undefined || data.tid === null) {
    return data;
  }

  const cid = await topics.getTopicField(data.tid, "cid");
  if (await forumExclusion.isWikiCid(cid)) {
    await forumExclusion.removeTidsFromRecentSet([data.tid]);
    return {};
  }

  return data;
}

async function filterTopicsFilterSortedTids(data) {
  if (!data || !Array.isArray(data.tids) || !data.tids.length) {
    return data;
  }

  data.tids = await forumExclusion.filterNonWikiTids(data.tids);
  return data;
}

async function filterTopicsGetUnreadTids(data) {
  if (!data) {
    return data;
  }

  const candidateTids = new Set(Array.isArray(data.tids) ? data.tids.map(String) : []);
  if (data.tidsByFilter && typeof data.tidsByFilter === "object") {
    Object.keys(data.tidsByFilter).forEach((filterName) => {
      if (!Array.isArray(data.tidsByFilter[filterName])) {
        return;
      }
      data.tidsByFilter[filterName].forEach((tid) => candidateTids.add(String(tid)));
    });
  }

  if (!candidateTids.size) {
    return data;
  }

  const candidateTidList = [...candidateTids];
  const nonWikiCandidateTids = await forumExclusion.filterNonWikiTids(candidateTidList);
  const allowedTidSet = new Set(nonWikiCandidateTids.map(String));
  const originalTidSet = new Set(candidateTidList.map(String));
  const wikiTidSet = new Set(
    [...originalTidSet].filter((tid) => !allowedTidSet.has(tid))
  );

  if (!wikiTidSet.size) {
    return data;
  }

  data.tids = listWithoutWikiTids(data.tids, wikiTidSet);

  if (data.tidsByFilter && typeof data.tidsByFilter === "object") {
    Object.keys(data.tidsByFilter).forEach((filterName) => {
      data.tidsByFilter[filterName] = listWithoutWikiTids(data.tidsByFilter[filterName], wikiTidSet);
    });
    data.counts = recomputeUnreadCounts(data.tidsByFilter);
  } else if (data.counts && typeof data.counts === "object") {
    data.counts = {
      "": data.tids.length,
      new: data.counts.new || 0,
      watched: data.counts.watched || 0,
      unreplied: data.counts.unreplied || 0
    };
  }

  if (Array.isArray(data.unreadCids) && data.unreadCids.length) {
    const wikiCidSet = await forumExclusion.getWikiCidSet();
    data.unreadCids = data.unreadCids.filter((cid) => {
      const n = parseInt(cid, 10);
      return !(Number.isInteger(n) && wikiCidSet.has(n));
    });
  }

  return data;
}

module.exports = {
  filterTopicsFilterSortedTids,
  filterTopicsGetUnreadTids,
  filterTopicsUpdateRecent
};
