"use strict";

const categories = require.main.require("./src/categories");
const privileges = require.main.require("./src/privileges");
const topics = require.main.require("./src/topics");
const utils = require.main.require("./src/utils");

const config = require("./config");
const serializer = require("./serializer");

async function getCategoryTopics(cid, uid, limit) {
  const topicResult = await topics.getTopicsFromSet(`cid:${cid}:tids`, uid, 0, limit - 1);
  return Array.isArray(topicResult) ? topicResult : topicResult.topics || [];
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

      const pageTopics = await getCategoryTopics(cid, uid, settings.topicsPerCategory);
      return serializer.serializeSection(category, pageTopics, categoryPrivileges);
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

    ancestors.unshift(serializer.serializeSectionLink(parentCategory));
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
    getCategoryTopics(parsedCid, uid, settings.topicsPerCategory),
    categories.getChildren([parsedCid], uid)
  ]);
  const ancestorSections = await getConfiguredAncestorSections(category, settings);

  const childSections = (childCategoryGroups[0] || [])
    .filter(Boolean)
    .filter((child) => settings.effectiveCategoryIds.includes(parseInt(child.cid, 10)))
    .map(serializer.serializeSectionLink);

  return {
    status: "ok",
    settings,
    section: {
      ...serializer.serializeSection(category, pageTopics, categoryPrivileges),
      ancestorSections,
      childSections
    }
  };
}

module.exports = {
  getConfiguredAncestorSections,
  getSection,
  getSections
};
