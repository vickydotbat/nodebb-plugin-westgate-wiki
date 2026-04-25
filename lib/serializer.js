"use strict";

function getSlugPath(slug) {
  return String(slug || "").split("/").slice(1).join("/");
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
  return {
    tid: topic.tid,
    title: topic.title,
    slug: topic.slug,
    teaserPid: topic.teaserPid,
    postcount: topic.postcount,
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
  serializeCategoryPrivileges,
  serializeSection,
  serializeSectionLink,
  serializeTopicSummary
};
