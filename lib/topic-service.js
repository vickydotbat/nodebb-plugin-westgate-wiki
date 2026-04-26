"use strict";

const categories = require.main.require("./src/categories");
const posts = require.main.require("./src/posts");
const privileges = require.main.require("./src/privileges");
const topics = require.main.require("./src/topics");
const utils = require.main.require("./src/utils");

const config = require("./config");
const serializer = require("./serializer");
const wikiService = require("./wiki-service");

function normalizeTitlePath(titlePath) {
  return titlePath.join("/").toLowerCase();
}

async function getParentPageBreadcrumbs(topicData, uid) {
  const titlePath = serializer.getTitlePath(topicData.titleRaw || topicData.title);

  if (titlePath.length <= 1) {
    return {
      titlePath,
      parentPages: []
    };
  }

  const namespaceData = await wikiService.getSection(topicData.cid, uid);
  const pageTopics = namespaceData.status === "ok" ? namespaceData.section.topics : [];
  const parentPages = titlePath.slice(0, -1).map((segment, index) => {
    const parentTitle = titlePath.slice(0, index + 1).join("/");
    const matchingTopic = pageTopics.find((topic) => (
      normalizeTitlePath(topic.titlePath || serializer.getTitlePath(topic.titleRaw || topic.title)) === normalizeTitlePath([parentTitle])
    ));

    return {
      text: segment,
      url: matchingTopic ? matchingTopic.wikiPath : ""
    };
  });

  return {
    titlePath,
    parentPages
  };
}

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

  const [category, mainPostRows, categoryPrivileges, canEditMainPost] = await Promise.all([
    categories.getCategoryData(topicData.cid),
    posts.getPostSummaryByPids([topicData.mainPid], uid, {
      stripTags: false,
      extraFields: ['edited', 'editor']
    }),
    privileges.categories.get(topicData.cid, uid),
    privileges.posts.canEdit(topicData.mainPid, uid)
  ]);
  const mainPost = mainPostRows[0] || null;
  if (mainPost) {
    await applyWikiPageBylineFromMainPost(mainPost, uid);
  }
  const [ancestorSections, namespaceData, pagePathData] = await Promise.all([
    wikiService.getConfiguredAncestorSections(category, settings),
    wikiService.getSection(topicData.cid, uid),
    getParentPageBreadcrumbs(topicData, uid)
  ]);

  const homeTid = settings.homeTopicId;
  const isWikiHome = Number.isInteger(homeTid) && homeTid > 0 && parseInt(topicId, 10) === homeTid;
  const canDeleteWikiPage = isWikiHome ? false : !!topicPrivileges["topics:delete"];

  return {
    status: "ok",
    settings,
    topic: topicData,
    category,
    categoryPrivileges,
    topicPrivileges,
    canEditWikiPage: !!canEditMainPost.flag,
    canDeleteWikiPage,
    ancestorSections,
    pageTitlePath: pagePathData.titlePath,
    parentPages: pagePathData.parentPages,
    sectionNavigation: namespaceData.status === "ok" ? namespaceData.section : null,
    mainPost
  };
}

/**
 * "Last edited" byline: last editor when the post was edited, otherwise the author
 * and creation time (treats the initial post as the only revision so far).
 */
async function applyWikiPageBylineFromMainPost(mainPost, viewerUid) {
  const edited = parseInt(mainPost.edited, 10) || 0;
  const editorUid = parseInt(mainPost.editor, 10) || 0;
  const authorUid = parseInt(mainPost.uid, 10) || 0;
  const lastRevTime = edited > 0 ? edited : parseInt(mainPost.timestamp, 10) || 0;
  const lastRevUid = edited > 0 && editorUid > 0 ? editorUid : authorUid;

  const uids = lastRevUid === authorUid ? [authorUid] : [lastRevUid, authorUid];
  const userList = await posts.getUserInfoForPosts(uids, viewerUid);
  if (lastRevUid === authorUid) {
    const u = userList[0] || mainPost.user;
    mainPost.wikiLastRevisionUser = u;
    mainPost.wikiCreatedByUser = u;
  } else {
    mainPost.wikiLastRevisionUser = userList[0] || mainPost.user;
    mainPost.wikiCreatedByUser = userList[1] || mainPost.user;
  }
  mainPost.wikiLastRevisionTimeISO = lastRevTime ? utils.toISOString(lastRevTime) : mainPost.timestampISO;
}

module.exports = {
  getWikiPage
};
