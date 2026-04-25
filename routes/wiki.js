"use strict";

const helpers = require.main.require("./src/controllers/helpers");
const routeHelpers = require.main.require("./src/routes/helpers");
const serializer = require("../lib/serializer");
const wikiService = require("../lib/wiki-service");
const topicService = require("../lib/topic-service");

function getCreateIntentTitle(req) {
  return String((req.query && req.query.create) || "").trim();
}

function appendQueryString(path, req) {
  const queryString = new URLSearchParams(req.query || {}).toString();
  return queryString ? `${path}?${queryString}` : path;
}

function register(params) {
  const { router } = params;

  routeHelpers.setupPageRoute(router, "/wiki", async (req, res, next) => {
    try {
      const wikiData = await wikiService.getSections(req.uid);

      res.render("wiki", {
        title: "Westgate Wiki",
        breadcrumbs: [
          {
            text: "Westgate Wiki",
            url: "/wiki"
          }
        ],
        sections: wikiData.sections,
        hasSections: wikiData.sections.length > 0,
        setupRequired: !wikiData.settings.isConfigured,
        configuredCategoryCount: wikiData.settings.categoryIds.length,
        effectiveCategoryCount: wikiData.settings.effectiveCategoryIds.length,
        topicsPerCategory: wikiData.settings.topicsPerCategory,
        includeChildCategories: wikiData.settings.includeChildCategories,
        hasInvalidCategoryIds: wikiData.invalidCategoryIds.length > 0,
        invalidCategoryIdsText: wikiData.invalidCategoryIds.join(", ")
      });
    } catch (err) {
      next(err);
    }
  });

  routeHelpers.setupPageRoute(router, "/wiki/category/:category_id/:slug?", async (req, res, next) => {
    const wikiSection = await wikiService.getSection(req.params.category_id, req.uid);

    if (wikiSection.status === "invalid" || wikiSection.status === "not-found" || wikiSection.status === "not-wiki") {
      return next();
    }

    if (wikiSection.status === "forbidden") {
      return helpers.notAllowed(req, res);
    }

    if (!res.locals.isAPI && req.params.slug !== wikiSection.section.slugPath) {
      return helpers.redirect(res, appendQueryString(wikiSection.section.wikiPath, req), true);
    }

    const createIntentTitle = getCreateIntentTitle(req);
    const hasCreateIntent = !!(createIntentTitle && wikiSection.section.privileges.canCreatePage);

    const sectionBreadcrumbs = [
      {
        text: "Westgate Wiki",
        url: "/wiki"
      },
      ...wikiSection.section.ancestorSections.map((ancestor) => ({
        text: ancestor.name,
        url: ancestor.wikiPath
      })),
      {
        text: wikiSection.section.name
      }
    ];

    res.render("wiki-section", {
      title: `${wikiSection.section.name} | Westgate Wiki`,
      breadcrumbs: sectionBreadcrumbs,
      section: wikiSection.section,
      hasChildSections: wikiSection.section.childSections.length > 0,
      hasTopics: wikiSection.section.topics.length > 0,
      canCreatePage: wikiSection.section.privileges.canCreatePage,
      topicsPerCategory: wikiSection.settings.topicsPerCategory,
      hasCreateIntent,
      createIntentTitle
    });
  });

  routeHelpers.setupPageRoute(router, "/wiki/:topic_id/:slug?", async (req, res, next) => {
    const wikiPage = await topicService.getWikiPage(req.params.topic_id, req.uid);

    if (wikiPage.status === "invalid" || wikiPage.status === "not-found" || wikiPage.status === "not-wiki") {
      return next();
    }

    if (wikiPage.status === "forbidden") {
      return helpers.notAllowed(req, res);
    }

    if (!res.locals.isAPI && req.params.slug !== wikiPage.topic.slug.split("/").slice(1).join("/")) {
      return helpers.redirect(res, appendQueryString(`/wiki/${wikiPage.topic.slug}`, req), true);
    }

    const pageBreadcrumbs = [
      {
        text: "Westgate Wiki",
        url: "/wiki"
      },
      ...wikiPage.ancestorSections.map((ancestor) => ({
        text: ancestor.name,
        url: ancestor.wikiPath
      })),
      {
        text: wikiPage.category.name,
        url: serializer.buildWikiSectionPath(wikiPage.category)
      },
      {
        text: wikiPage.topic.title
      }
    ];

    res.render("wiki-page", {
      title: wikiPage.topic.title,
      breadcrumbs: pageBreadcrumbs,
      topic: wikiPage.topic,
      category: wikiPage.category,
      canCreateSiblingPage: !!wikiPage.categoryPrivileges["topics:create"],
      sectionNavigation: wikiPage.sectionNavigation,
      hasSectionNavigation: !!wikiPage.sectionNavigation,
      hasSectionChildNamespaces: !!(wikiPage.sectionNavigation && wikiPage.sectionNavigation.childSections.length),
      hasSectionPages: !!(wikiPage.sectionNavigation && wikiPage.sectionNavigation.topics.length),
      mainPost: wikiPage.mainPost
    });
  });
}

module.exports = {
  register
};
