"use strict";

const categories = require.main.require("./src/categories");
const db = require.main.require("./src/database");
const topics = require.main.require("./src/topics");

const config = require("./config");

const RESERVED_FIRST_SEGMENTS = new Set([
  "category",
  "compose",
  "edit",
  "namespace",
  "search",
  "admin",
  "api"
]);

function asPositiveInt(value) {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function splitPath(value) {
  return String(value || "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function getSlugLeaf(slug) {
  const parts = splitPath(slug);
  return parts.length ? parts[parts.length - 1] : "";
}

function getTopicSlugLeaf(topic) {
  return getSlugLeaf(topic && topic.slug);
}

function getCategorySlugSegment(category) {
  return getSlugLeaf(category && category.slug);
}

function getLegacyNamespacePath(category) {
  return category && category.slug ? `/wiki/category/${category.slug}` : "";
}

function getLegacyArticlePath(topic) {
  return topic && topic.slug ? `/wiki/${topic.slug}` : "";
}

function hasReservedFirstSegment(pathSegments) {
  return !!(pathSegments.length && RESERVED_FIRST_SEGMENTS.has(String(pathSegments[0]).toLowerCase()));
}

async function loadEffectiveCategories(settings) {
  const rows = await Promise.all(
    (settings.effectiveCategoryIds || []).map((cid) => categories.getCategoryData(cid))
  );
  return rows.filter(Boolean);
}

function indexCategories(categoryList) {
  const byCid = new Map();
  categoryList.forEach((category) => {
    const cid = asPositiveInt(category && category.cid);
    if (cid) {
      byCid.set(cid, category);
    }
  });
  return byCid;
}

function buildCategoryChain(category, categoryByCid, settings) {
  const chain = [];
  let current = category;

  while (current) {
    const cid = asPositiveInt(current.cid);
    if (!cid || !(settings.effectiveCategoryIds || []).includes(cid)) {
      break;
    }

    chain.unshift(current);
    const parentCid = asPositiveInt(current.parentCid);
    current = parentCid ? categoryByCid.get(parentCid) : null;
  }

  return chain;
}

function buildNamespaceSegments(category, categoryByCid, settings) {
  return buildCategoryChain(category, categoryByCid, settings)
    .map(getCategorySlugSegment)
    .filter(Boolean);
}

function buildNamespaceIndex(categoryList, settings) {
  const categoryByCid = indexCategories(categoryList);
  const entries = [];
  const pathCounts = new Map();

  categoryList.forEach((category) => {
    const cid = asPositiveInt(category.cid);
    const segments = buildNamespaceSegments(category, categoryByCid, settings);
    const pathKey = segments.join("/");
    if (!cid || !segments.length || hasReservedFirstSegment(segments)) {
      return;
    }
    entries.push({ cid, category, segments, pathKey });
    pathCounts.set(pathKey, (pathCounts.get(pathKey) || 0) + 1);
  });

  return { entries, pathCounts };
}

async function getNamespaceEntry(categoryOrCid) {
  const settings = await config.getSettings();
  const cid = asPositiveInt(categoryOrCid && categoryOrCid.cid != null ? categoryOrCid.cid : categoryOrCid);

  if (!settings.isConfigured || !cid || !(settings.effectiveCategoryIds || []).includes(cid)) {
    return { status: "not-wiki" };
  }

  const categoryList = await loadEffectiveCategories(settings);
  const { entries, pathCounts } = buildNamespaceIndex(categoryList, settings);
  const entry = entries.find((candidate) => candidate.cid === cid);

  if (!entry) {
    return { status: "not-found" };
  }

  if (pathCounts.get(entry.pathKey) > 1) {
    return { status: "namespace-collision", path: `/wiki/${entry.pathKey}` };
  }

  return { status: "ok", ...entry, path: `/wiki/${entry.pathKey}` };
}

async function getNamespacePath(categoryOrCid) {
  const result = await getNamespaceEntry(categoryOrCid);
  return result.status === "ok" ? result.path : "";
}

async function getArticlePath(topicOrTid) {
  const tid = asPositiveInt(topicOrTid && topicOrTid.tid != null ? topicOrTid.tid : topicOrTid);
  const topic = topicOrTid && topicOrTid.tid != null && topicOrTid.slug ? topicOrTid : (tid ? await topics.getTopicData(tid) : null);

  if (!topic || !topic.slug) {
    return "";
  }

  const namespacePath = await getNamespacePath(topic.cid);
  const leaf = getTopicSlugLeaf(topic);
  return namespacePath && leaf ? `${namespacePath}/${leaf}` : "";
}

async function resolveNamespacePath(pathOrSegments) {
  const pathSegments = Array.isArray(pathOrSegments) ? pathOrSegments : splitPath(pathOrSegments);
  if (!pathSegments.length) {
    return { status: "invalid" };
  }
  if (hasReservedFirstSegment(pathSegments)) {
    return { status: "reserved-path-segment" };
  }

  const settings = await config.getSettings();
  if (!settings.isConfigured) {
    return { status: "not-wiki" };
  }

  const categoryList = await loadEffectiveCategories(settings);
  const { entries, pathCounts } = buildNamespaceIndex(categoryList, settings);
  const pathKey = pathSegments.join("/");
  const matches = entries.filter((entry) => entry.pathKey === pathKey);

  if (!matches.length) {
    return { status: "namespace-not-found" };
  }

  if (matches.length > 1 || pathCounts.get(pathKey) > 1) {
    return { status: "namespace-collision", path: `/wiki/${pathKey}` };
  }

  return {
    status: "ok",
    cid: matches[0].cid,
    category: matches[0].category,
    path: `/wiki/${pathKey}`,
    segments: matches[0].segments
  };
}

async function resolveTopicBySlugLeaf(cid, pageSlug) {
  const tids = await db.getSortedSetRange(`cid:${cid}:tids`, 0, -1);
  if (!Array.isArray(tids) || !tids.length) {
    return { status: "page-not-found" };
  }

  const topicList = await topics.getTopicsFields(tids, ["tid", "cid", "title", "titleRaw", "slug", "deleted", "scheduled"]);
  const matches = topicList.filter((topic) => (
    topic &&
    !topic.deleted &&
    !topic.scheduled &&
    getTopicSlugLeaf(topic) === pageSlug
  ));

  if (!matches.length) {
    return { status: "page-not-found" };
  }

  if (matches.length > 1) {
    return { status: "page-collision", cid, pageSlug, topics: matches };
  }

  return { status: "ok", topic: matches[0], tid: matches[0].tid };
}

async function resolveArticlePath(pathOrSegments) {
  const pathSegments = Array.isArray(pathOrSegments) ? pathOrSegments : splitPath(pathOrSegments);
  if (pathSegments.length < 2) {
    return { status: "namespace-not-found" };
  }
  if (hasReservedFirstSegment(pathSegments)) {
    return { status: "reserved-path-segment" };
  }

  const namespaceSegments = pathSegments.slice(0, -1);
  const pageSlug = pathSegments[pathSegments.length - 1];
  const namespace = await resolveNamespacePath(namespaceSegments);

  if (namespace.status !== "ok") {
    return namespace;
  }

  const topicResult = await resolveTopicBySlugLeaf(namespace.cid, pageSlug);
  if (topicResult.status !== "ok") {
    return {
      ...topicResult,
      cid: namespace.cid,
      category: namespace.category,
      namespacePath: namespace.path,
      pageSlug
    };
  }

  return {
    status: "ok",
    cid: namespace.cid,
    category: namespace.category,
    namespacePath: namespace.path,
    pageSlug,
    tid: topicResult.tid,
    topic: topicResult.topic,
    path: `${namespace.path}/${pageSlug}`
  };
}

module.exports = {
  RESERVED_FIRST_SEGMENTS,
  getArticlePath,
  getCategorySlugSegment,
  getLegacyArticlePath,
  getLegacyNamespacePath,
  getNamespaceEntry,
  getNamespacePath,
  getTopicSlugLeaf,
  resolveArticlePath,
  resolveNamespacePath,
  splitPath
};
