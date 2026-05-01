"use strict";

const categories = require.main.require("./src/categories");
const slugify = require.main.require("./src/slugify");
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

function normalizeTitleToSlugLeaf(title) {
  return slugify(String(title || "").trim()) || "topic";
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

function shouldOmitRouteRootSegment(category, index) {
  return index === 0 && getCategorySlugSegment(category).toLowerCase() === "wiki";
}

function buildWikiPath(pathKey) {
  return pathKey ? `/wiki/${pathKey}` : "/wiki";
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
    .filter((entry, index) => !shouldOmitRouteRootSegment(entry, index))
    .map(getCategorySlugSegment)
    .filter(Boolean);
}

function buildNamespaceIndex(categoryList, settings) {
  const categoryByCid = indexCategories(categoryList);
  const entries = [];
  const reservedEntries = [];
  const pathCounts = new Map();

  categoryList.forEach((category) => {
    const cid = asPositiveInt(category.cid);
    const segments = buildNamespaceSegments(category, categoryByCid, settings);
    const pathKey = segments.join("/");
    if (!cid) {
      return;
    }
    if (hasReservedFirstSegment(segments)) {
      reservedEntries.push({ cid, category, segments, pathKey });
      return;
    }
    entries.push({ cid, category, segments, pathKey });
    pathCounts.set(pathKey, (pathCounts.get(pathKey) || 0) + 1);
  });

  return { entries, reservedEntries, pathCounts };
}

function groupEntriesByPath(entries) {
  const byPath = new Map();
  entries.forEach((entry) => {
    const rows = byPath.get(entry.pathKey) || [];
    rows.push(entry);
    byPath.set(entry.pathKey, rows);
  });
  return byPath;
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
    return { status: "namespace-collision", path: buildWikiPath(entry.pathKey) };
  }

  return { status: "ok", ...entry, path: buildWikiPath(entry.pathKey) };
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
    return { status: "namespace-collision", path: buildWikiPath(pathKey) };
  }

  return {
    status: "ok",
    cid: matches[0].cid,
    category: matches[0].category,
    path: buildWikiPath(pathKey),
    segments: matches[0].segments
  };
}

async function resolveRouteRootNamespace() {
  const settings = await config.getSettings();
  if (!settings.isConfigured) {
    return { status: "not-wiki" };
  }

  const categoryList = await loadEffectiveCategories(settings);
  const { entries, pathCounts } = buildNamespaceIndex(categoryList, settings);
  const matches = entries.filter((entry) => entry.pathKey === "");

  if (!matches.length) {
    return { status: "namespace-not-found" };
  }

  if (matches.length > 1 || pathCounts.get("") > 1) {
    return { status: "namespace-collision", path: "/wiki" };
  }

  return {
    status: "ok",
    cid: matches[0].cid,
    category: matches[0].category,
    path: "/wiki",
    segments: []
  };
}

async function resolveTopicBySlugLeaf(cid, pageSlug, viewerUid) {
  const wikiDirectory = require("./wiki-directory-service");
  const parsedCid = asPositiveInt(cid);
  if (!parsedCid || !pageSlug) {
    return { status: "page-not-found" };
  }
  return wikiDirectory.resolveTopicBySlugLeafForViewer(parsedCid, viewerUid || 0, pageSlug);
}

async function findPageSlugMatches(cid, pageSlug, omitTid) {
  const wikiDirectory = require("./wiki-directory-service");
  const parsedCid = asPositiveInt(cid);
  if (!parsedCid) {
    return [];
  }
  return wikiDirectory.findPageSlugMatchesForValidation(parsedCid, pageSlug, omitTid);
}

async function getPageSlugCollision(cid, pageSlug, omitTid) {
  const matches = await findPageSlugMatches(cid, pageSlug, omitTid);
  if (!matches.length) {
    return { status: "ok", topics: [] };
  }

  return { status: "page-collision", cid, pageSlug, topics: matches };
}

async function validatePageTitlePath(cid, title, options = {}) {
  const parsedCid = asPositiveInt(cid);
  const pageSlug = normalizeTitleToSlugLeaf(title);
  if (!parsedCid || !String(title || "").trim()) {
    return { status: "invalid" };
  }

  const namespace = await getNamespaceEntry(parsedCid);
  if (namespace.status !== "ok") {
    return namespace;
  }

  if (!namespace.segments.length && RESERVED_FIRST_SEGMENTS.has(pageSlug.toLowerCase())) {
    return { status: "reserved-path-segment", pageSlug, path: buildWikiPath(pageSlug) };
  }

  const namespacePageSegments = namespace.segments.concat(pageSlug);
  const namespaceCollision = namespacePageSegments.length ? await resolveNamespacePath(namespacePageSegments) : { status: "namespace-not-found" };
  if (namespaceCollision.status === "ok") {
    return {
      status: "namespace-page-collision",
      cid: parsedCid,
      pageSlug,
      path: namespaceCollision.path,
      category: namespaceCollision.category
    };
  }
  if (namespaceCollision.status === "namespace-collision") {
    return {
      status: "namespace-collision",
      cid: parsedCid,
      pageSlug,
      path: namespaceCollision.path
    };
  }

  const pageCollision = await getPageSlugCollision(parsedCid, pageSlug, options.omitTid);
  if (pageCollision.status !== "ok") {
    return {
      ...pageCollision,
      path: `${namespace.path}/${pageSlug}`
    };
  }

  return {
    status: "ok",
    cid: parsedCid,
    pageSlug,
    namespacePath: namespace.path,
    path: `${namespace.path}/${pageSlug}`
  };
}

async function resolveArticlePath(pathOrSegments, viewerUid) {
  const pathSegments = Array.isArray(pathOrSegments) ? pathOrSegments : splitPath(pathOrSegments);
  const uid = viewerUid == null ? 0 : viewerUid;
  if (!pathSegments.length) {
    return { status: "namespace-not-found" };
  }
  if (hasReservedFirstSegment(pathSegments)) {
    return { status: "reserved-path-segment" };
  }

  const namespaceSegments = pathSegments.length === 1 ? [] : pathSegments.slice(0, -1);
  const pageSlug = pathSegments[pathSegments.length - 1];
  const namespace = namespaceSegments.length ?
    await resolveNamespacePath(namespaceSegments) :
    await resolveRouteRootNamespace();

  if (namespace.status !== "ok") {
    return namespace;
  }

  const topicResult = await resolveTopicBySlugLeaf(namespace.cid, pageSlug, uid);
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

async function getNamespaceSetupDiagnostics() {
  const settings = await config.getSettings();
  if (!settings.isConfigured) {
    return {
      namespaceCollisions: [],
      reservedNamespacePaths: [],
      hasSetupErrors: false
    };
  }

  const categoryList = await loadEffectiveCategories(settings);
  const { entries, reservedEntries } = buildNamespaceIndex(categoryList, settings);
  const byPath = groupEntriesByPath(entries);
  const namespaceCollisions = [];

  byPath.forEach((rows, pathKey) => {
    if (rows.length > 1) {
      namespaceCollisions.push({
        path: buildWikiPath(pathKey),
        categories: rows.map((row) => ({
          cid: row.cid,
          name: row.category.name,
          slug: row.category.slug
        }))
      });
    }
  });

  const reservedNamespacePaths = reservedEntries.map((entry) => ({
    path: buildWikiPath(entry.pathKey),
    reservedSegment: entry.segments[0],
    category: {
      cid: entry.cid,
      name: entry.category.name,
      slug: entry.category.slug
    }
  }));

  return {
    namespaceCollisions,
    reservedNamespacePaths,
    hasSetupErrors: namespaceCollisions.length > 0 || reservedNamespacePaths.length > 0
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
  getNamespaceSetupDiagnostics,
  getPageSlugCollision,
  getTopicSlugLeaf,
  normalizeTitleToSlugLeaf,
  resolveArticlePath,
  resolveNamespacePath,
  resolveRouteRootNamespace,
  validatePageTitlePath,
  splitPath
};
