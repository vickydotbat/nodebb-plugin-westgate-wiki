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

plugin.registerApiRoutes = async function ({ router }) {
  const wikiNamespaceSearch = require("./lib/wiki-namespace-search");
  routeHelpers.setupApiRoute(
    router,
    "get",
    "/westgate-wiki/namespace/:cid/search",
    [],
    wikiNamespaceSearch.searchNamespaceTopics
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
plugin.services = {
  cacheService,
  config,
  serializer,
  topicService,
  wikiLinks,
  wikiService
};
