"use strict";

const config = require("./config");

function toWikiCidSet(effectiveCategoryIds) {
  const s = new Set();
  (effectiveCategoryIds || []).forEach((id) => {
    const n = parseInt(id, 10);
    if (Number.isInteger(n) && n > 0) {
      s.add(n);
    }
  });
  return s;
}

function isPositiveCid(cat) {
  if (!cat || cat.cid === undefined || cat.cid === null) {
    return false;
  }
  const cid = parseInt(cat.cid, 10);
  return Number.isInteger(cid) && cid > 0;
}

/**
 * Strip only nested wiki namespace rows. Top-level categories stay (including
 * the configured wiki parent); child namespaces under the wiki are removed
 * from the index tree. /wiki and /category/... are unchanged.
 */
function stripChildrenArray(children, wikiCidSet) {
  if (!Array.isArray(children) || !children.length) {
    return children;
  }
  return children
    .filter((cat) => isPositiveCid(cat) && !wikiCidSet.has(parseInt(cat.cid, 10)))
    .map((cat) => {
      if (!Array.isArray(cat.children) || !cat.children.length) {
        return cat;
      }
      return { ...cat, children: stripChildrenArray(cat.children, wikiCidSet) };
    });
}

/**
 * Recursively strip `children` only, never the root `categories` array.
 */
function stripWikiChildrenFromRoots(categories, wikiCidSet) {
  if (!Array.isArray(categories) || !categories.length) {
    return categories;
  }
  return categories.map((cat) => {
    if (!cat) {
      return cat;
    }
    if (!Array.isArray(cat.children) || !cat.children.length) {
      return cat;
    }
    return { ...cat, children: stripChildrenArray(cat.children, wikiCidSet) };
  });
}

async function filterCategoriesBuild(data) {
  const { templateData } = data || {};
  if (!templateData || !Array.isArray(templateData.categories)) {
    return data;
  }

  const settings = await config.getSettings();
  if (!settings.effectiveCategoryIds || !settings.effectiveCategoryIds.length) {
    return data;
  }

  const wikiCidSet = toWikiCidSet(settings.effectiveCategoryIds);
  templateData.categories = stripWikiChildrenFromRoots(templateData.categories, wikiCidSet);
  return data;
}

module.exports = {
  filterCategoriesBuild
};
