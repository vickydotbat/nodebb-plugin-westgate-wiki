"use strict";

const routeHelpers = require.main.require("./src/routes/helpers");
const cacheService = require("./lib/cache-service");
const config = require("./lib/config");
const adminControllers = require("./lib/controllers/admin");
const serializer = require("./lib/serializer");
const topicService = require("./lib/topic-service");
const wikiLinks = require("./lib/wiki-links");
const wikiHtmlParse = require("./lib/wiki-html-parse");
const wikiService = require("./lib/wiki-service");
const wikiTopicPurge = require("./lib/wiki-topic-purge");
const wikiRoutes = require("./routes/wiki");
const filterCategoriesForum = require("./lib/filter-categories-forum");

const plugin = module.exports;

plugin.init = async function (params) {
  const { router } = params;

  await config.ensureDefaults();

  routeHelpers.setupAdminPageRoute(
    router,
    "/admin/plugins/westgate-wiki",
    adminControllers.renderAdminPage
  );

  wikiRoutes.register(params);
};

plugin.registerApiRoutes = async function ({ router, middleware }) {
  const wikiNamespaceSearch = require("./lib/wiki-namespace-search");
  const wikiHomepage = require("./lib/wiki-homepage");
  const wikiNamespaceCreateController = require("./lib/controllers/wiki-namespace-create");
  routeHelpers.setupApiRoute(
    router,
    "get",
    "/westgate-wiki/namespace/:cid/search",
    [],
    wikiNamespaceSearch.searchNamespaceTopics
  );
  routeHelpers.setupApiRoute(
    router,
    "put",
    "/westgate-wiki/homepage",
    [middleware.ensureLoggedIn, middleware.checkRequired.bind(null, ["tid"])],
    wikiHomepage.putWikiHomepage
  );
  routeHelpers.setupApiRoute(
    router,
    "post",
    "/westgate-wiki/namespace",
    [middleware.ensureLoggedIn],
    wikiNamespaceCreateController.postNamespace
  );
};

plugin.addAdminNavigation = async function (header) {
  header.plugins.push({
    route: "/plugins/westgate-wiki",
    icon: "fa-book",
    name: "Westgate Wiki"
  });

  return header;
};

plugin.transformWikiPostContent = wikiLinks.transformWikiPostContent;
plugin.wikiMarkdownBeforeParse = wikiHtmlParse.markdownBeforeParse;
plugin.clearWikiPostParseCache = cacheService.clearWikiPostParseCache;
plugin.clearWikiPostEditCache = cacheService.clearWikiPostEditCache;
plugin.onWikiTopicDelete = wikiTopicPurge.onTopicDelete;
plugin.wikiFilterTopicDelete = async function (data) {
  if (!data || !data.topicData) {
    return data;
  }
  const settings = await config.getSettings();
  if (settings.homeTopicId && parseInt(data.topicData.tid, 10) === settings.homeTopicId) {
    data.canDelete = false;
  }
  return data;
};
plugin.filterCategoriesBuild = filterCategoriesForum.filterCategoriesBuild;
plugin.wikiFilterPrivilegesTopicsGet = async function (data) {
  if (!data || data.tid === undefined || data.tid === null) {
    return data;
  }
  const settings = await config.getSettings();
  if (settings.homeTopicId && parseInt(data.tid, 10) === settings.homeTopicId) {
    data["topics:delete"] = false;
    data.purge = false;
    data.deletable = false;
  }
  return data;
};
plugin.services = {
  cacheService,
  config,
  serializer,
  topicService,
  wikiLinks,
  wikiService
};
