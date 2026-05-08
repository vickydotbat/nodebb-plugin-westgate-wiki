"use strict";

function getSlugPath(slug) {
  return String(slug || "").split("/").slice(1).join("/");
}

function decodeTitle(value) {
  return String(value || "")
    .replace(/&#x2F;/gi, "/")
    .replace(/&amp;/g, "&");
}

function getTitlePath(value) {
  return decodeTitle(value)
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function buildWikiSectionPath(category) {
  return `/wiki/category/${category.slug}`;
}

function serializeSectionLink(category) {
  return {
    cid: category.cid,
    name: category.name,
    description: category.description,
    slug: category.slug,
    slugPath: getSlugPath(category.slug),
    wikiPath: buildWikiSectionPath(category),
    categoryPath: `/category/${category.slug}`,
    icon: category.icon
  };
}

function serializeCategoryPrivileges(categoryPrivileges = {}) {
  return {
    canCreatePage: !!categoryPrivileges["topics:create"],
    canReadTopics: !!categoryPrivileges["topics:read"],
    canReadCategory: !!categoryPrivileges.read
  };
}

function serializeTopicSummary(topic) {
  const titlePath = getTitlePath(topic.titleRaw || topic.title);
  const titleLeaf = titlePath.length ? titlePath[titlePath.length - 1] : topic.title;

  return {
    tid: topic.tid,
    title: topic.title,
    titleLeaf,
    titlePath,
    titleDepth: Math.max(0, titlePath.length - 1),
    hasParentPath: titlePath.length > 1,
    parentTitlePathText: titlePath.slice(0, -1).join(" / "),
    slug: topic.slug,
    teaserPid: topic.teaserPid,
    postcount: topic.postcount,
    cid: topic.cid,
    deleted: topic.deleted,
    scheduled: topic.scheduled,
    lastposttime: topic.lastposttime,
    timestamp: topic.timestamp,
    updatetime: topic.updatetime,
    replyCount: Math.max(0, parseInt(topic.postcount, 10) - 1),
    wikiPath: `/wiki/${topic.slug}`,
    topicPath: `/topic/${topic.slug}`
  };
}

function serializeSection(category, topics, categoryPrivileges) {
  return {
    ...serializeSectionLink(category),
    parentCid: category.parentCid,
    privileges: serializeCategoryPrivileges(categoryPrivileges),
    topicCount: topics.length,
    topics: topics.map(serializeTopicSummary)
  };
}

module.exports = {
  buildWikiSectionPath,
  getSlugPath,
  getTitlePath,
  serializeCategoryPrivileges,
  serializeSection,
  serializeSectionLink,
  serializeTopicSummary
};
