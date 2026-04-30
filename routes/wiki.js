"use strict";

const helpers = require.main.require("./src/controllers/helpers");
const middleware = require.main.require("./src/middleware");
const routeHelpers = require.main.require("./src/routes/helpers");
const composeAssets = require("../lib/compose-assets");
const composeController = require("../lib/controllers/compose");
const wikiNamespaceCreateController = require("../lib/controllers/wiki-namespace-create");
const config = require("../lib/config");
const wikiNamespaceCreators = require("../lib/wiki-namespace-creators");
const wikiAlphabeticalIndex = require("../lib/wiki-alphabetical-index");
const wikiService = require("../lib/wiki-service");
const topicService = require("../lib/topic-service");
const wikiBreadcrumbTrail = require("../lib/wiki-breadcrumb-trail");
const wikiPaths = require("../lib/wiki-paths");

function getCreateIntentTitle(req) {
  return String((req.query && req.query.create) || "").trim();
}

function appendQueryString(path, req) {
  const queryString = new URLSearchParams(req.query || {}).toString();
  return queryString ? `${path}?${queryString}` : path;
}

/**
 * Flat rows for article sidebar: each configured ancestor namespace, then the
 * current namespace, then pages in that namespace only (no pages from parents).
 */
function buildWikiArticleSidebarNavRows(sectionNavigation, topic) {
  if (!sectionNavigation) {
    return [];
  }
  const rows = [];
  const ancestors = Array.isArray(sectionNavigation.ancestorSections)
    ? sectionNavigation.ancestorSections
    : [];
  const currentTid = String(topic && topic.tid != null ? topic.tid : "");

  ancestors.forEach((ancestor, index) => {
    rows.push({
      depth: index,
      isNamespace: true,
      isPage: false,
      name: ancestor.name,
      wikiPath: ancestor.wikiPath
    });
  });

  const nsDepth = ancestors.length;
  rows.push({
    depth: nsDepth,
    isNamespace: true,
    isPage: false,
    isCurrentNamespace: true,
    name: sectionNavigation.name,
    wikiPath: sectionNavigation.wikiPath
  });

  const topics = Array.isArray(sectionNavigation.topics) ? sectionNavigation.topics : [];
  topics.forEach((t) => {
    rows.push({
      depth: nsDepth + 1,
      isNamespace: false,
      isPage: true,
      tid: t.tid,
      titleLeaf: t.titleLeaf,
      hasParentPath: t.hasParentPath,
      parentTitlePathText: t.parentTitlePathText,
      wikiPath: t.wikiPath,
      isActive: String(t.tid) === currentTid
    });
  });

  return rows;
}

function buildWikiPageRenderData(wikiPage, { isWikiHome }) {
  const trail = wikiBreadcrumbTrail.forArticleView(wikiPage);

  const wikiSidebarNavRows = buildWikiArticleSidebarNavRows(
    wikiPage.sectionNavigation,
    wikiPage.topic
  );

  return {
    title: wikiPage.topic.title,
    ...trail,
    topic: wikiPage.topic,
    isWikiHome: !!isWikiHome,
    showWikiDiscussionLink: !isWikiHome,
    pageTitle: wikiPage.pageTitlePath.length ? wikiPage.pageTitlePath[wikiPage.pageTitlePath.length - 1] : wikiPage.topic.title,
    pageTitlePath: wikiPage.pageTitlePath,
    hasPageParents: wikiPage.parentPages.length > 0,
    parentPages: wikiPage.parentPages,
    category: wikiPage.category,
    canCreateSiblingPage: !!wikiPage.categoryPrivileges["topics:create"],
    canEditWikiPage: !!wikiPage.canEditWikiPage,
    canDeleteWikiPage: !!wikiPage.canDeleteWikiPage,
    sectionNavigation: wikiPage.sectionNavigation,
    hasSectionNavigation: !!wikiPage.sectionNavigation,
    /* Inline ToC mount: avoids Benchpress empty IF/ELSE in wiki-page.tpl */
    showWikiTocInline: !wikiPage.sectionNavigation,
    hasSectionChildNamespaces: !!(wikiPage.sectionNavigation && wikiPage.sectionNavigation.childSections.length),
    hasSectionPages: !!(wikiPage.sectionNavigation && wikiPage.sectionNavigation.topics.length),
    wikiSidebarNavRows,
    mainPost: wikiPage.mainPost
  };
}

async function getWikiFallbackContext(uid) {
  const wikiData = await wikiService.getSections(uid);
  const canCreateWikiNamespaces = await wikiNamespaceCreators.getCanCreateWikiNamespaces(uid);
  return {
    sections: wikiData.sections,
    hasSections: wikiData.sections.length > 0,
    configuredCategoryCount: wikiData.settings.categoryIds.length,
    effectiveCategoryCount: wikiData.settings.effectiveCategoryIds.length,
    includeChildCategories: wikiData.settings.includeChildCategories,
    hasInvalidCategoryIds: wikiData.invalidCategoryIds.length > 0,
    invalidCategoryIdsText: wikiData.invalidCategoryIds.join(", "),
    canCreateWikiNamespaces
  };
}

function register(params) {
  const { router, middleware } = params;

  composeAssets.register(router);

  routeHelpers.setupPageRoute(router, "/wiki/namespace/create/:parent_cid", [middleware.ensureLoggedIn], wikiNamespaceCreateController.renderChild);

  routeHelpers.setupPageRoute(router, "/wiki", async (req, res, next) => {
    try {
      const settings = await config.getSettings();
      const hubTrail = wikiBreadcrumbTrail.forWikiHub();

      if (!settings.isConfigured) {
        const ctx = await getWikiFallbackContext(req.uid);
        return res.render("wiki", {
          title: "Westgate Wiki",
          ...hubTrail,
          setupRequired: true,
          homePageSetupRequired: false,
          homePageLoadError: false,
          homePageErrorForbidden: false,
          homePageErrorNotFound: false,
          showNamespaceIndex: ctx.hasSections,
          ...ctx
        });
      }

      if (!settings.homeTopicId) {
        const ctx = await getWikiFallbackContext(req.uid);
        let bootstrapHomeCid = null;
        for (const s of ctx.sections) {
          if (s.privileges && s.privileges.canCreatePage) {
            bootstrapHomeCid = s.cid;
            break;
          }
        }
        const canBootstrapHome = Number.isInteger(parseInt(bootstrapHomeCid, 10)) && parseInt(bootstrapHomeCid, 10) > 0;
        return res.render("wiki", {
          title: "Westgate Wiki",
          ...hubTrail,
          setupRequired: false,
          homePageSetupRequired: true,
          homePageLoadError: false,
          homePageErrorForbidden: false,
          homePageErrorNotFound: false,
          showNamespaceIndex: ctx.hasSections,
          canBootstrapHome,
          bootstrapHomeCid: canBootstrapHome ? String(bootstrapHomeCid) : "",
          ...ctx
        });
      }

      const wikiPage = await topicService.getWikiPage(String(settings.homeTopicId), req.uid);

      if (wikiPage.status === "ok") {
        const canCreateWikiNamespaces = await wikiNamespaceCreators.getCanCreateWikiNamespaces(req.uid);
        const homePageData = {
          ...buildWikiPageRenderData(wikiPage, { isWikiHome: true }),
          canCreateWikiNamespaces
        };
        return res.render("wiki-page", homePageData);
      }

      const status = wikiPage.status;
      const ctx = await getWikiFallbackContext(req.uid);
      return res.render("wiki", {
        title: "Westgate Wiki",
        ...hubTrail,
        setupRequired: false,
        homePageSetupRequired: false,
        homePageLoadError: true,
        homePageErrorForbidden: status === "forbidden",
        homePageErrorNotFound: status === "not-found",
        homePageErrorStatus: String(status),
        showNamespaceIndex: ctx.hasSections,
        ...ctx
      });
    } catch (err) {
      next(err);
    }
  });

  async function renderSection(req, res, next, wikiSection) {
    const createIntentTitle = getCreateIntentTitle(req);
    const hasCreateIntent = !!(createIntentTitle && wikiSection.section.privileges.canCreatePage);

    const sectionTrail = wikiBreadcrumbTrail.forSectionView(wikiSection.section);

    const canCreateWikiNamespaces = await wikiNamespaceCreators.getCanCreateWikiNamespaces(req.uid);

    const canCreatePage = wikiSection.section.privileges.canCreatePage;
    const sectionContentsIndex = wikiAlphabeticalIndex.buildSectionContentsIndex(
      wikiSection.section.childSections,
      wikiSection.section.topics
    );
    const namespaceIndexEntryCount = wikiSection.section.childSections.length
      + wikiSection.section.topics.length;

    res.render("wiki-section", {
      title: `${wikiSection.section.name} | Westgate Wiki`,
      ...sectionTrail,
      section: wikiSection.section,
      hasChildSections: wikiSection.section.childSections.length > 0,
      hasTopics: wikiSection.section.topics.length > 0,
      wikiIndexNamespaces: sectionContentsIndex.namespaces,
      wikiIndexPageLetters: sectionContentsIndex.pageLetterGroups,
      hasWikiIndexNamespaces: sectionContentsIndex.namespaces.length > 0,
      hasWikiIndexPageLetters: sectionContentsIndex.pageLetterGroups.length > 0,
      hasNamespaceIndexContent: namespaceIndexEntryCount > 0,
      hasMultipleWikiIndexLetterGroups: sectionContentsIndex.pageLetterGroups.length > 1,
      canCreatePage,
      hasCreateIntent,
      createIntentTitle,
      canCreateWikiNamespaces
    });
  }

  async function renderArticle(req, res, next, tid) {
    const wikiPage = await topicService.getWikiPage(tid, req.uid);

    if (wikiPage.status === "invalid" || wikiPage.status === "not-found" || wikiPage.status === "not-wiki") {
      return next();
    }

    if (wikiPage.status === "forbidden") {
      return helpers.notAllowed(req, res);
    }

    const settings = await config.getSettings();
    if (settings.homeTopicId && parseInt(wikiPage.topic.tid, 10) === settings.homeTopicId && !res.locals.isAPI) {
      return helpers.redirect(res, appendQueryString("/wiki", req), true);
    }

    const canCreateWikiNamespaces = await wikiNamespaceCreators.getCanCreateWikiNamespaces(req.uid);
    const pageData = {
      ...buildWikiPageRenderData(wikiPage, { isWikiHome: false }),
      canCreateWikiNamespaces
    };
    res.render("wiki-page", pageData);
  }

  routeHelpers.setupPageRoute(router, "/wiki/category/:category_id/:slug?", async (req, res, next) => {
    const wikiSection = await wikiService.getSection(req.params.category_id, req.uid);

    if (wikiSection.status === "invalid" || wikiSection.status === "not-found" || wikiSection.status === "not-wiki") {
      return next();
    }

    if (wikiSection.status === "forbidden") {
      return helpers.notAllowed(req, res);
    }

    if (!res.locals.isAPI) {
      return helpers.redirect(res, appendQueryString(wikiSection.section.wikiPath, req), true);
    }

    return renderSection(req, res, next, wikiSection);
  });

  routeHelpers.setupPageRoute(router, "/wiki/compose/:cid", [middleware.ensureLoggedIn], composeController.renderCompose);

  routeHelpers.setupPageRoute(router, "/wiki/edit/:tid", [middleware.ensureLoggedIn], composeController.renderEdit);

  routeHelpers.setupPageRoute(router, "/wiki/:topic_id(\\d+)/:slug?", async (req, res, next) => {
    const wikiPage = await topicService.getWikiPage(req.params.topic_id, req.uid);

    if (wikiPage.status === "invalid" || wikiPage.status === "not-found" || wikiPage.status === "not-wiki") {
      return next();
    }

    if (wikiPage.status === "forbidden") {
      return helpers.notAllowed(req, res);
    }

    if (!res.locals.isAPI) {
      const canonicalPath = wikiPage.topic.wikiPath || await wikiPaths.getArticlePath(wikiPage.topic);
      if (canonicalPath) {
        return helpers.redirect(res, appendQueryString(canonicalPath, req), true);
      }
    }

    return renderArticle(req, res, next, req.params.topic_id);
  });

  routeHelpers.setupPageRoute(router, "/wiki/:path(*)", async (req, res, next) => {
    const pathSegments = wikiPaths.splitPath(req.params.path);
    if (!pathSegments.length) {
      return next();
    }

    const namespace = await wikiPaths.resolveNamespacePath(pathSegments);
    if (namespace.status === "ok") {
      const wikiSection = await wikiService.getSection(namespace.cid, req.uid);
      if (wikiSection.status === "forbidden") {
        return helpers.notAllowed(req, res);
      }
      if (wikiSection.status !== "ok") {
        return next();
      }
      return renderSection(req, res, next, wikiSection);
    }

    const article = await wikiPaths.resolveArticlePath(pathSegments);
    if (article.status !== "ok") {
      return next();
    }

    return renderArticle(req, res, next, article.tid);
  });
}

module.exports = {
  register,
  buildWikiPageRenderData
};
