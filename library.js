"use strict";

const routeHelpers = require.main.require("./src/routes/helpers");
const cacheService = require("./lib/cache-service");
const config = require("./lib/config");
const adminControllers = require("./lib/controllers/admin");
const serializer = require("./lib/serializer");
const topicService = require("./lib/topic-service");
const wikiLinks = require("./lib/wiki-links");
const wikiService = require("./lib/wiki-service");
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

plugin.addAdminNavigation = async function (header) {
  header.plugins.push({
    route: "/plugins/westgate-wiki",
    icon: "fa-book",
    name: "Westgate Wiki"
  });

  return header;
};

plugin.transformWikiPostContent = wikiLinks.transformWikiPostContent;
plugin.clearWikiPostParseCache = cacheService.clearWikiPostParseCache;
plugin.services = {
  cacheService,
  config,
  serializer,
  topicService,
  wikiLinks,
  wikiService
};
