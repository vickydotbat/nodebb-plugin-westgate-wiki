"use strict";

const WIKI_ROOT = {
  text: "Westgate Wiki",
  url: "/wiki"
};

function mapAncestors(ancestorSections) {
  if (!Array.isArray(ancestorSections)) {
    return [];
  }
  return ancestorSections.map((a) => ({
    text: a.name,
    url: a.wikiPath
  }));
}

function finalize(locationItems, actionText) {
  const action = actionText && String(actionText).trim();
  const hasAction = !!action;
  const wikiBreadcrumbs = locationItems.map((c, i) => {
    const isLast = i === locationItems.length - 1;
    const isAriaCurrent = !hasAction && isLast && !c.url;
    const crumb = { text: c.text, isAriaCurrent };
    if (c.url) {
      crumb.url = c.url;
    }
    return crumb;
  });
  return {
    wikiBreadcrumbs,
    wikiBreadcrumbAction: action || "",
    hasWikiBreadcrumbAction: hasAction,
    breadcrumbs: []
  };
}

function forWikiHub() {
  return finalize([{ text: WIKI_ROOT.text }], "");
}

function forWikiSearch() {
  return finalize([WIKI_ROOT], "Search");
}

function forSectionView(section) {
  const trail = [
    WIKI_ROOT,
    ...mapAncestors(section.ancestorSections),
    { text: section.name }
  ];
  return finalize(trail, "");
}

function forArticleView(wikiPage) {
  const cat = wikiPage.category;
  const parentCrumbs = (wikiPage.parentPages || []).map((p) => ({
    text: p.text,
    url: p.url || undefined
  }));
  const leafTitle = wikiPage.pageTitlePath && wikiPage.pageTitlePath.length
    ? wikiPage.pageTitlePath[wikiPage.pageTitlePath.length - 1]
    : wikiPage.topic.title;

  const trail = [
    WIKI_ROOT,
    ...mapAncestors(wikiPage.ancestorSections),
    { text: cat.name, url: wikiPage.sectionNavigation ? wikiPage.sectionNavigation.wikiPath : cat.wikiPath },
    ...parentCrumbs,
    { text: leafTitle }
  ];
  return finalize(trail, "");
}

function forComposeCreate(section, actionLabel) {
  const trail = [
    WIKI_ROOT,
    ...mapAncestors(section.ancestorSections),
    { text: section.name, url: section.wikiPath }
  ];
  return finalize(trail, actionLabel || "Create page");
}

function forComposeEdit(section, topic) {
  const title = topic.titleRaw || topic.title;
  const trail = [
    WIKI_ROOT,
    ...mapAncestors(section.ancestorSections),
    { text: section.name, url: section.wikiPath },
    { text: title, url: topic.wikiPath || "" }
  ];
  return finalize(trail, "Edit");
}

function forNamespaceCreate(section) {
  const trail = [
    WIKI_ROOT,
    ...mapAncestors(section.ancestorSections),
    { text: section.name, url: section.wikiPath }
  ];
  return finalize(trail, "Create namespace");
}

module.exports = {
  forWikiHub,
  forWikiSearch,
  forSectionView,
  forArticleView,
  forComposeCreate,
  forComposeEdit,
  forNamespaceCreate
};
