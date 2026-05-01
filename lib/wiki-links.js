"use strict";

const nconf = require.main.require("nconf");
const categories = require.main.require("./src/categories");
const topics = require.main.require("./src/topics");

const config = require("./config");
const serializer = require("./serializer");
const wikiPaths = require("./wiki-paths");

const WIKI_LINK_REGEX = /\[\[([^[\]|]+(?:\/[^[\]|]+)*)(?:\|([^[\]]+))?\]\]/g;

function normalizeSegment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeTitle(value) {
  return normalizeSegment(value);
}

function splitTargetPath(rawTarget) {
  const target = String(rawTarget || "").trim();
  const colonMatch = target.match(/^([^:/[\]|]+)\s*:\s*(.+)$/);
  const pathValue = colonMatch && !/^ns:/i.test(target) ?
    `${colonMatch[1].trim()}/${colonMatch[2].trim()}` :
    target;

  return pathValue.split("/").map((segment) => segment.trim()).filter(Boolean);
}

/**
 * Turn a wiki path leaf like "a-page" or "My_Topic" into readable link text
 * (e.g. "A page"). Does not run when an explicit [[target|label]] or resolved
 * topic title is used.
 */
function humanizeWikiPageSegment(segment) {
  const normalized = normalizeSegment(segment);
  if (!normalized.length) {
    return String(segment || "").trim();
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/**
 * Visible anchor text: explicit pipe label wins, else real topic title, else
 * humanized path leaf.
 */
function resolveWikiLinkDisplayLabel(explicitPipeLabel, pageTitleSegment, resolvedTopic) {
  const pipe = String(explicitPipeLabel || "").trim();
  if (pipe.length) {
    return pipe;
  }
  if (resolvedTopic && resolvedTopic.title) {
    return resolvedTopic.title;
  }
  return humanizeWikiPageSegment(pageTitleSegment);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getCategoryMatchKeys(category) {
  const keys = new Set();
  keys.add(normalizeSegment(category.name));

  if (category.slug) {
    const slugLeaf = String(category.slug).split("/").pop();
    keys.add(normalizeSegment(slugLeaf));
  }

  return keys;
}

function isInWikiCategory(cid, settings) {
  return Number.isInteger(cid) && settings.effectiveCategoryIds.includes(cid);
}

async function getPostCategoryId(postData, settings) {
  const directCid = parseInt(
    postData && (
      postData.cid ||
      (postData.category && postData.category.cid) ||
      (postData.topic && postData.topic.cid)
    ),
    10
  );

  if (isInWikiCategory(directCid, settings)) {
    return directCid;
  }

  const tid = parseInt(
    postData && (
      postData.tid ||
      (postData.topic && postData.topic.tid)
    ),
    10
  );

  if (!Number.isInteger(tid) || tid <= 0) {
    return null;
  }

  const topicData = await topics.getTopicData(tid);
  const topicCid = parseInt(topicData && topicData.cid, 10);
  return isInWikiCategory(topicCid, settings) ? topicCid : null;
}

async function getEffectiveCategories(settings) {
  const categoryList = await Promise.all(
    settings.effectiveCategoryIds.map((cid) => categories.getCategoryData(cid))
  );

  return categoryList.filter(Boolean);
}

function findRootCategories(categoryList, settings) {
  return categoryList.filter((category) => {
    const parentCid = parseInt(category.parentCid, 10);
    return !Number.isInteger(parentCid) || !settings.effectiveCategoryIds.includes(parentCid);
  });
}

function findMatchingCategory(categoriesToSearch, segment) {
  const normalizedSegment = normalizeSegment(segment);

  return categoriesToSearch.find((category) => (
    getCategoryMatchKeys(category).has(normalizedSegment)
  )) || null;
}

function getChildCategories(categoryList, parentCid) {
  return categoryList.filter((category) => parseInt(category.parentCid, 10) === parseInt(parentCid, 10));
}

function buildCategoryChain(categoryList, category) {
  const chain = [];
  let currentCategory = category;

  while (currentCategory) {
    chain.unshift(currentCategory);

    const parentCid = parseInt(currentCategory.parentCid, 10);
    currentCategory = Number.isInteger(parentCid) ?
      categoryList.find((entry) => parseInt(entry.cid, 10) === parentCid) :
      null;
  }

  return chain;
}

function matchesCategoryChain(chain, namespaceSegments) {
  if (namespaceSegments.length > chain.length) {
    return false;
  }

  const candidateSegments = chain.slice(chain.length - namespaceSegments.length);

  return namespaceSegments.every((segment, index) => (
    getCategoryMatchKeys(candidateSegments[index]).has(normalizeSegment(segment))
  ));
}

function resolveRelativeNamespace(categoryList, currentCategoryId, namespaceSegments) {
  let currentCategory = categoryList.find((category) => parseInt(category.cid, 10) === parseInt(currentCategoryId, 10));

  if (!currentCategory) {
    return null;
  }

  for (const segment of namespaceSegments) {
    currentCategory = findMatchingCategory(getChildCategories(categoryList, currentCategory.cid), segment);

    if (!currentCategory) {
      return null;
    }
  }

  return currentCategory;
}

function resolveAbsoluteNamespace(categoryList, settings, namespaceSegments) {
  if (!namespaceSegments.length) {
    return null;
  }

  let currentCategory = findMatchingCategory(findRootCategories(categoryList, settings), namespaceSegments[0]);

  if (!currentCategory) {
    return null;
  }

  for (const segment of namespaceSegments.slice(1)) {
    currentCategory = findMatchingCategory(getChildCategories(categoryList, currentCategory.cid), segment);

    if (!currentCategory) {
      return null;
    }
  }

  return currentCategory;
}

function resolveNamespaceBySuffix(categoryList, namespaceSegments) {
  const matches = categoryList.filter((category) => (
    matchesCategoryChain(buildCategoryChain(categoryList, category), namespaceSegments)
  ));

  return matches.length === 1 ? matches[0] : null;
}

function wrapForumWikiLinkInner(forumBookIcon, escapedLabelHtml) {
  if (!forumBookIcon) {
    return escapedLabelHtml;
  }
  return `<i class="fa-solid fa-fw fa-book wiki-forum-link-icon" aria-hidden="true"></i><span class="wiki-forum-link-text">${escapedLabelHtml}</span>`;
}

async function buildRedlinkMarkdown(label, category, pageTitle, forumBookIcon) {
  const namespacePath = await wikiPaths.getNamespacePath(category) || serializer.buildWikiSectionPath(category);
  const createPath = `${namespacePath}?create=${encodeURIComponent(pageTitle)}&redlink=1&cid=${encodeURIComponent(category.cid)}`;
  const rel = nconf.get("relative_path") || "";
  const href = `${rel}${createPath}`;
  const cls = forumBookIcon ? "wiki-redlink wiki-link-from-forum" : "wiki-redlink";
  const inner = wrapForumWikiLinkInner(forumBookIcon, escapeHtml(label));
  return `<a class="${cls}" href="${escapeHtml(href)}">${inner}</a>`;
}

function buildWikiArticleLink(label, wikiPath, forumBookIcon) {
  const rel = nconf.get("relative_path") || "";
  const href = `${rel}${wikiPath}`;
  const cls = forumBookIcon ? "wiki-internal-link wiki-link-from-forum" : "wiki-internal-link";
  const inner = wrapForumWikiLinkInner(forumBookIcon, escapeHtml(label));
  return `<a class="${cls}" href="${escapeHtml(href)}">${inner}</a>`;
}

async function buildWikiNamespaceLink(label, category, forumBookIcon) {
  const rel = nconf.get("relative_path") || "";
  const namespacePath = await wikiPaths.getNamespacePath(category) || serializer.buildWikiSectionPath(category);
  const href = `${rel}${namespacePath}`;
  const cls = forumBookIcon ?
    "wiki-internal-link wiki-namespace-link wiki-link-from-forum" :
    "wiki-internal-link wiki-namespace-link";
  const inner = wrapForumWikiLinkInner(forumBookIcon, escapeHtml(label));
  return `<a class="${cls}" href="${escapeHtml(href)}">${inner}</a>`;
}

function resolveNamespaceLinkDisplayLabel(explicitPipeLabel, namespaceSegments, resolvedCategory) {
  const pipe = String(explicitPipeLabel || "").trim();
  if (pipe.length) {
    return pipe;
  }
  if (resolvedCategory && resolvedCategory.name) {
    return resolvedCategory.name;
  }
  const leaf = namespaceSegments[namespaceSegments.length - 1];
  return humanizeWikiPageSegment(leaf);
}

async function resolveTargetCategory(categoryId, namespaceSegments, settings) {
  const categoryList = await getEffectiveCategories(settings);

  if (!namespaceSegments.length) {
    return categoryList.find((category) => parseInt(category.cid, 10) === parseInt(categoryId, 10)) || null;
  }

  return (
    resolveRelativeNamespace(categoryList, categoryId, namespaceSegments) ||
    resolveAbsoluteNamespace(categoryList, settings, namespaceSegments) ||
    resolveNamespaceBySuffix(categoryList, namespaceSegments)
  );
}

async function resolveExistingTopicByTitleOrSlug(cid, pageTitleOrSlug) {
  const wikiDirectory = require("./wiki-directory-service");
  const parsedCid = parseInt(cid, 10);
  if (!Number.isInteger(parsedCid) || parsedCid <= 0) {
    return null;
  }

  const pageSlug = wikiPaths.normalizeTitleToSlugLeaf(pageTitleOrSlug);
  const normalizedTitle = wikiDirectory.normalizeWikiLinkTitle(pageTitleOrSlug);
  const rows = await wikiDirectory.getAllTopicSlugRows(parsedCid);
  const matches = rows.filter((topic) => (
    topic &&
    !parseInt(topic.deleted, 10) &&
    !parseInt(topic.scheduled, 10) &&
    (
      wikiPaths.getTopicSlugLeaf(topic) === pageSlug ||
      wikiDirectory.normalizeWikiLinkTitle(topic.titleRaw || topic.title || "") === normalizedTitle
    )
  ));

  if (matches.length !== 1) {
    return null;
  }

  return matches[0].cid == null ? { ...matches[0], cid: parsedCid } : matches[0];
}

async function getArticlePathForTopic(topic, fallbackCategory) {
  const topicWithCid = topic && topic.cid == null && fallbackCategory ?
    { ...topic, cid: fallbackCategory.cid } :
    topic;
  return await wikiPaths.getArticlePath(topicWithCid) || wikiPaths.getLegacyArticlePath(topicWithCid);
}

/**
 * For posts outside wiki categories: resolve [[PageTitle]] by title across
 * all configured wiki namespaces (deterministic lowest cid first).
 */
async function findTopicByTitleInAnyWikiCategory(pageTitle, settings) {
  const cids = [...settings.effectiveCategoryIds].sort((a, b) => a - b);

  for (const cid of cids) {
    const topic = await resolveExistingTopicByTitleOrSlug(cid, pageTitle);
    if (topic && topic.slug) {
      return topic;
    }
  }

  return null;
}

async function getDefaultRedlinkCategory(settings) {
  const list = await getEffectiveCategories(settings);
  if (!list.length) {
    return null;
  }
  return list.slice().sort((a, b) => parseInt(a.cid, 10) - parseInt(b.cid, 10))[0];
}

async function replaceWikiLinks(content, currentCategoryId, settings) {
  // Global regex: never call .test() on WIKI_LINK_REGEX without resetting lastIndex
  // before matchAll, or matchAll returns nothing (lastIndex left past the first match).
  WIKI_LINK_REGEX.lastIndex = 0;
  const matches = [...String(content || "").matchAll(WIKI_LINK_REGEX)];

  if (!matches.length) {
    return content;
  }

  const forumBookIcon = !Number.isInteger(currentCategoryId);

  const replacements = await Promise.all(matches.map(async (match) => {
    const rawTarget = String(match[1] || "").trim();
    const explicitPipeLabel = String(match[2] || "").trim();
    const pathSegments = splitTargetPath(rawTarget);
    const labelFallback = rawTarget.split("/").pop().trim();

    if (!pathSegments.length) {
      const plain = explicitPipeLabel || labelFallback;
      return { source: match[0], replacement: escapeHtml(plain) };
    }

    if (/^ns:/i.test(rawTarget)) {
      const nsBody = rawTarget.replace(/^ns:/i, "").trim();
      const namespaceSegments = splitTargetPath(nsBody);
      if (!namespaceSegments.length) {
        const plain = explicitPipeLabel || rawTarget;
        return { source: match[0], replacement: escapeHtml(plain) };
      }
      const targetNsCategory = await resolveTargetCategory(currentCategoryId, namespaceSegments, settings);
      const nsDisplayLabel = resolveNamespaceLinkDisplayLabel(
        explicitPipeLabel,
        namespaceSegments,
        targetNsCategory
      );
      if (!targetNsCategory) {
        return { source: match[0], replacement: escapeHtml(nsDisplayLabel) };
      }
      return {
        source: match[0],
        replacement: await buildWikiNamespaceLink(nsDisplayLabel, targetNsCategory, forumBookIcon)
      };
    }

    const pageTitle = pathSegments[pathSegments.length - 1];
    const namespaceSegments = pathSegments.slice(0, -1);

    if (namespaceSegments.length) {
      const namespaceResult = await wikiPaths.resolveNamespacePath(namespaceSegments);
      const canonicalTopic = namespaceResult.status === "ok" ?
        await resolveExistingTopicByTitleOrSlug(namespaceResult.cid, pageTitle) :
        null;
      if (canonicalTopic && canonicalTopic.slug) {
        const displayLabel = resolveWikiLinkDisplayLabel(explicitPipeLabel, pageTitle, canonicalTopic);
        const pageSlug = wikiPaths.getTopicSlugLeaf(canonicalTopic);
        return {
          source: match[0],
          replacement: buildWikiArticleLink(displayLabel, `${namespaceResult.path}/${pageSlug}`, forumBookIcon)
        };
      }
    }

    const targetCategory = await resolveTargetCategory(currentCategoryId, namespaceSegments, settings);

    if (!targetCategory) {
      const currentCategory = await resolveTargetCategory(currentCategoryId, [], settings);
      const fallbackTitle = namespaceSegments.length ? rawTarget : pageTitle;
      let fallbackTopic = currentCategory ? await resolveExistingTopicByTitleOrSlug(currentCategory.cid, fallbackTitle) : null;

      const isBarePageLink = !namespaceSegments.length && !/^ns:/i.test(rawTarget);
      if (!fallbackTopic && isBarePageLink) {
        fallbackTopic = await findTopicByTitleInAnyWikiCategory(pageTitle, settings);
      }

      const displayLabel = resolveWikiLinkDisplayLabel(explicitPipeLabel, pageTitle, fallbackTopic);

      if (fallbackTopic && fallbackTopic.slug) {
        const fallbackWikiPath = await getArticlePathForTopic(fallbackTopic, currentCategory);
        return {
          source: match[0],
          replacement: buildWikiArticleLink(displayLabel, fallbackWikiPath, forumBookIcon)
        };
      }

      const redlinkCategory = currentCategory || await getDefaultRedlinkCategory(settings);
      return {
        source: match[0],
        replacement: redlinkCategory ?
          await buildRedlinkMarkdown(displayLabel, redlinkCategory, fallbackTitle, forumBookIcon) :
          escapeHtml(displayLabel)
      };
    }

    const topic = await resolveExistingTopicByTitleOrSlug(targetCategory.cid, pageTitle);
    const displayLabel = resolveWikiLinkDisplayLabel(explicitPipeLabel, pageTitle, topic);

    if (!topic || !topic.slug) {
      return {
        source: match[0],
        replacement: await buildRedlinkMarkdown(displayLabel, targetCategory, pageTitle, forumBookIcon)
      };
    }

    const wikiPath = await getArticlePathForTopic(topic, targetCategory);
    return {
      source: match[0],
      replacement: buildWikiArticleLink(displayLabel, wikiPath, forumBookIcon)
    };
  }));

  let nextContent = String(content || "");

  replacements.forEach(({ source, replacement }) => {
    nextContent = nextContent.split(source).join(replacement);
  });

  return nextContent;
}

function contentHasWikiLinkMarkers(content) {
  // Do not use WIKI_LINK_REGEX.test() here: it advances lastIndex on the global regex
  // and breaks the subsequent matchAll in replaceWikiLinks.
  return String(content || "").includes("[[");
}

async function transformWikiPostContent(data) {
  if (!data || !data.postData || !data.postData.content) {
    return data;
  }

  const settings = await config.getSettings();

  if (!settings.isConfigured) {
    return data;
  }

  if (!contentHasWikiLinkMarkers(data.postData.content)) {
    return data;
  }

  const categoryId = await getPostCategoryId(data.postData, settings);
  data.postData.content = await replaceWikiLinks(data.postData.content, categoryId, settings);
  return data;
}

module.exports = {
  transformWikiPostContent,
  getPostCategoryId,
  replaceWikiLinks,
  contentHasWikiLinkMarkers
};
