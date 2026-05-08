"use strict";

const categories = require.main.require("./src/categories");
const meta = require.main.require("./src/meta");

const SETTINGS_KEY = "westgate-wiki";
const DEFAULT_SETTINGS = {
  categoryIds: "",
  includeChildCategories: "1",
  homeTopicId: "",
  wikiNamespaceCreateGroups: ""
};

function normalizeHomeTopicId(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return null;
  }

  const n = parseInt(String(rawValue), 10);
  if (!Number.isInteger(n) || n <= 0) {
    return null;
  }

  return n;
}

function parseCategoryIds(rawValue) {
  if (!rawValue) {
    return [];
  }

  return [...new Set(String(rawValue)
    .split(/[\s,]+/)
    .map((value) => parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0))];
}

function parseWikiNamespaceCreateGroupNames(rawValue) {
  if (!rawValue) {
    return [];
  }

  return [...new Set(String(rawValue)
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean))];
}

function normalizeBoolean(rawValue, defaultValue) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return defaultValue;
  }

  if (rawValue === true || rawValue === "true" || rawValue === "on" || rawValue === "1" || rawValue === 1) {
    return true;
  }

  if (rawValue === false || rawValue === "false" || rawValue === "off" || rawValue === "0" || rawValue === 0) {
    return false;
  }

  return defaultValue;
}

function normalizeSettings(settings = {}) {
  const categoryIds = parseCategoryIds(settings.categoryIds);
  const includeChildCategories = normalizeBoolean(settings.includeChildCategories, true);
  const homeTopicId = normalizeHomeTopicId(settings.homeTopicId);
  const homeTopicIdText = settings.homeTopicId === undefined || settings.homeTopicId === null || settings.homeTopicId === ""
    ? ""
    : String(settings.homeTopicId).trim();
  const wikiNamespaceCreateGroups = parseWikiNamespaceCreateGroupNames(settings.wikiNamespaceCreateGroups);
  const wikiNamespaceCreateGroupsText = settings.wikiNamespaceCreateGroups === undefined || settings.wikiNamespaceCreateGroups === null
    ? ""
    : String(settings.wikiNamespaceCreateGroups).trim();

  return {
    categoryIds,
    categoryIdsText: settings.categoryIds || "",
    includeChildCategories,
    homeTopicId,
    homeTopicIdText,
    wikiNamespaceCreateGroups,
    wikiNamespaceCreateGroupsText,
    isConfigured: categoryIds.length > 0
  };
}

async function resolveEffectiveCategoryIds(settings) {
  const explicitCategoryIds = Array.isArray(settings.categoryIds) ? settings.categoryIds : [];

  if (!explicitCategoryIds.length || !settings.includeChildCategories) {
    return explicitCategoryIds;
  }

  const descendantIds = await Promise.all(
    explicitCategoryIds.map(async (cid) => {
      const children = await categories.getChildrenCids(cid);
      return children
        .map((value) => parseInt(value, 10))
        .filter((value) => Number.isInteger(value) && value > 0);
    })
  );

  return [...new Set(explicitCategoryIds.concat(descendantIds.flat()))];
}

async function ensureDefaults() {
  await meta.settings.setOnEmpty(SETTINGS_KEY, DEFAULT_SETTINGS);
}

async function getSettings() {
  const settings = await meta.settings.get(SETTINGS_KEY);
  const normalizedSettings = normalizeSettings(settings);
  const effectiveCategoryIds = await resolveEffectiveCategoryIds(normalizedSettings);

  return {
    ...normalizedSettings,
    effectiveCategoryIds
  };
}

async function setHomeTopicIdInSettings(tid) {
  const n = normalizeHomeTopicId(tid);
  if (!n) {
    throw new Error("invalid-tid");
  }
  const current = await meta.settings.get(SETTINGS_KEY) || {};
  await meta.settings.set(SETTINGS_KEY, {
    ...current,
    homeTopicId: String(n)
  });
}

/**
 * Appends a category id to stored wiki namespace roots when the new category
 * would not already appear in effectiveCategoryIds (new root, or child when
 * descendant inheritance is off).
 */
async function mergeWikiCategoryIdIntoSettings(cid) {
  const n = parseInt(cid, 10);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("invalid-cid");
  }

  const current = await meta.settings.get(SETTINGS_KEY) || {};
  const parsed = parseCategoryIds(current.categoryIds);
  if (parsed.includes(n)) {
    return;
  }

  const next = parsed.concat(n);
  await meta.settings.set(SETTINGS_KEY, {
    ...current,
    categoryIds: next.join(", ")
  });
}

module.exports = {
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
  ensureDefaults,
  getSettings,
  setHomeTopicIdInSettings,
  mergeWikiCategoryIdIntoSettings,
  normalizeSettings,
  normalizeHomeTopicId,
  parseWikiNamespaceCreateGroupNames,
  resolveEffectiveCategoryIds
};
