"use strict";

const categories = require.main.require("./src/categories");
const privileges = require.main.require("./src/privileges");
const topics = require.main.require("./src/topics");
const utils = require.main.require("./src/utils");

const config = require("./config");
const serializer = require("./serializer");
const wikiPaths = require("./wiki-paths");

async function getAllWikiTopicsForCategory(cid, uid, category) {
  const topicCount = Math.max(0, parseInt(category && category.topic_count, 10) || 0);
  if (topicCount === 0) {
    return [];
  }
  const topicResult = await topics.getTopicsFromSet(`cid:${cid}:tids`, uid, 0, topicCount - 1);
  return Array.isArray(topicResult) ? topicResult : topicResult.topics || [];
}

async function applyCanonicalTopicPaths(topicSummaries, namespacePath) {
  return topicSummaries.map((topic) => {
    const slugLeaf = wikiPaths.getTopicSlugLeaf(topic);
    return {
      ...topic,
      wikiPath: namespacePath && slugLeaf ? `${namespacePath}/${slugLeaf}` : wikiPaths.getLegacyArticlePath(topic)
    };
  });
}

async function serializeSectionWithPaths(category, pageTopics, categoryPrivileges) {
  const section = serializer.serializeSection(category, pageTopics, categoryPrivileges);
  const namespacePath = await wikiPaths.getNamespacePath(category);
  section.wikiPath = namespacePath || wikiPaths.getLegacyNamespacePath(category);
  section.topics = await applyCanonicalTopicPaths(section.topics, section.wikiPath);
  return section;
}

async function getSections(uid) {
  const settings = await config.getSettings();
  const invalidCategoryIds = [];

  if (!settings.isConfigured) {
    return {
      settings,
      sections: [],
      invalidCategoryIds
    };
  }

  const sections = await Promise.all(
    settings.categoryIds.map(async (cid) => {
      const [category, categoryPrivileges] = await Promise.all([
        categories.getCategoryData(cid),
        privileges.categories.get(cid, uid)
      ]);

      if (!category) {
        invalidCategoryIds.push(cid);
        return null;
      }

      const pageTopics = await getAllWikiTopicsForCategory(cid, uid, category);
      return serializeSectionWithPaths(category, pageTopics, categoryPrivileges);
    })
  );

  const validSections = sections.filter(Boolean);
  const rootSections = validSections.filter((section) => (
    !section.parentCid || !settings.effectiveCategoryIds.includes(parseInt(section.parentCid, 10))
  ));

  return {
    settings,
    sections: rootSections,
    invalidCategoryIds
  };
}

async function getConfiguredAncestorSections(category, settings) {
  const ancestors = [];
  let parentCid = parseInt(category.parentCid, 10);

  while (Number.isInteger(parentCid) && parentCid > 0) {
    if (!settings.effectiveCategoryIds.includes(parentCid)) {
      break;
    }

    const parentCategory = await categories.getCategoryData(parentCid);
    if (!parentCategory) {
      break;
    }

    const ancestor = serializer.serializeSectionLink(parentCategory);
    ancestor.wikiPath = await wikiPaths.getNamespacePath(parentCategory) || wikiPaths.getLegacyNamespacePath(parentCategory);
    ancestors.unshift(ancestor);
    parentCid = parseInt(parentCategory.parentCid, 10);
  }

  return ancestors;
}

async function getSection(cid, uid) {
  if (!utils.isNumber(cid)) {
    return { status: "invalid" };
  }

  const parsedCid = parseInt(cid, 10);
  const settings = await config.getSettings();

  if (!settings.isConfigured || !settings.effectiveCategoryIds.includes(parsedCid)) {
    return { status: "not-wiki" };
  }

  const [category, categoryPrivileges] = await Promise.all([
    categories.getCategoryData(parsedCid),
    privileges.categories.get(parsedCid, uid)
  ]);

  if (!category) {
    return { status: "not-found" };
  }

  if (!categoryPrivileges.read || !categoryPrivileges["topics:read"]) {
    return { status: "forbidden" };
  }

  const [pageTopics, childCategoryGroups] = await Promise.all([
    getAllWikiTopicsForCategory(parsedCid, uid, category),
    categories.getChildren([parsedCid], uid)
  ]);
  const ancestorSections = await getConfiguredAncestorSections(category, settings);

  const wikiChildCandidates = (childCategoryGroups[0] || [])
    .filter(Boolean)
    .filter((child) => settings.effectiveCategoryIds.includes(parseInt(child.cid, 10)));

  const childCategoryRows = await Promise.all(
    wikiChildCandidates.map((child) => categories.getCategoryData(child.cid))
  );

  const childSections = wikiChildCandidates
    .map((child, index) => {
      const full = childCategoryRows[index];
      if (!full) {
        return null;
      }
      return {
        ...serializer.serializeSectionLink(full),
        articleCount: Math.max(0, parseInt(full.topic_count, 10) || 0)
      };
    })
    .filter(Boolean);

  for (const childSection of childSections) {
    childSection.wikiPath = await wikiPaths.getNamespacePath(childSection.cid) || childSection.wikiPath;
  }

  return {
    status: "ok",
    settings,
    section: {
      ...(await serializeSectionWithPaths(category, pageTopics, categoryPrivileges)),
      ancestorSections,
      childSections
    }
  };
}

module.exports = {
  getConfiguredAncestorSections,
  getSection,
  getSections,
  serializeSectionWithPaths
};
