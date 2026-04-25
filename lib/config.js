"use strict";

const categories = require.main.require("./src/categories");
const meta = require.main.require("./src/meta");

const SETTINGS_KEY = "westgate-wiki";
const DEFAULT_SETTINGS = {
  categoryIds: "",
  topicsPerCategory: 10,
  includeChildCategories: "1"
};

function parseCategoryIds(rawValue) {
  if (!rawValue) {
    return [];
  }

  return [...new Set(String(rawValue)
    .split(/[\s,]+/)
    .map((value) => parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0))];
}

function normalizeTopicsPerCategory(rawValue) {
  const value = parseInt(rawValue, 10);

  if (!Number.isInteger(value)) {
    return DEFAULT_SETTINGS.topicsPerCategory;
  }

  return Math.min(Math.max(value, 1), 50);
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
  const topicsPerCategory = normalizeTopicsPerCategory(settings.topicsPerCategory);
  const includeChildCategories = normalizeBoolean(settings.includeChildCategories, true);

  return {
    categoryIds,
    categoryIdsText: settings.categoryIds || "",
    topicsPerCategory,
    includeChildCategories,
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

module.exports = {
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
  ensureDefaults,
  getSettings,
  normalizeSettings,
  resolveEffectiveCategoryIds
};
