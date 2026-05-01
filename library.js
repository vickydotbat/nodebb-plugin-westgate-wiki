"use strict";

const routeHelpers = require.main.require("./src/routes/helpers");
const cacheService = require("./lib/cache-service");
const config = require("./lib/config");
const adminControllers = require("./lib/controllers/admin");
const serializer = require("./lib/serializer");
const topicService = require("./lib/topic-service");
const wikiLinkAutocomplete = require("./lib/wiki-link-autocomplete");
const wikiLinks = require("./lib/wiki-links");
const wikiFootnotes = require("./lib/wiki-footnotes");
const wikiHtmlParse = require("./lib/wiki-html-parse");
const wikiDiscussionPlaceholder = require("./lib/wiki-discussion-placeholder");
const wikiDiscussionSettings = require("./lib/wiki-discussion-settings");
const wikiNamespaceMainPages = require("./lib/wiki-namespace-main-pages");
const wikiUserMentions = require("./lib/wiki-user-mentions");
const wikiMentionNotifications = require("./lib/wiki-mention-notifications");
const wikiArticleWatch = require("./lib/wiki-article-watch");
const wikiService = require("./lib/wiki-service");
const wikiPaths = require("./lib/wiki-paths");
const wikiPageValidation = require("./lib/wiki-page-validation");
const wikiTopicPurge = require("./lib/wiki-topic-purge");
const wikiRoutes = require("./routes/wiki");
const filterCategoriesForum = require("./lib/filter-categories-forum");
const filterForumFeeds = require("./lib/filter-forum-feeds");
const filterForumSearch = require("./lib/filter-forum-search");
const forumExclusionService = require("./lib/forum-exclusion-service");
const wikiDirectoryController = require("./lib/controllers/wiki-directory");

const plugin = module.exports;

plugin.init = async function (params) {
  const { router } = params;

  await config.ensureDefaults();
  await forumExclusionService.removeWikiTopicsFromRecentSet();

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
    "/westgate-wiki/page-title/check",
    [middleware.ensureLoggedIn],
    wikiPageValidation.checkPageTitle
  );
  routeHelpers.setupApiRoute(
    router,
    "get",
    "/westgate-wiki/link-autocomplete",
    [],
    wikiLinkAutocomplete.apiSearch
  );
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
    "/westgate-wiki/article-watch",
    [middleware.ensureLoggedIn, middleware.checkRequired.bind(null, ["tid"])],
    wikiArticleWatch.putArticleWatch
  );
  routeHelpers.setupApiRoute(
    router,
    "delete",
    "/westgate-wiki/article-watch",
    [middleware.ensureLoggedIn, middleware.checkRequired.bind(null, ["tid"])],
    wikiArticleWatch.deleteArticleWatch
  );
  routeHelpers.setupApiRoute(
    router,
    "put",
    "/westgate-wiki/discussion",
    [middleware.ensureLoggedIn, middleware.checkRequired.bind(null, ["tid"])],
    wikiDiscussionSettings.putDiscussionSettings
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
    "put",
    "/westgate-wiki/namespace-main-page",
    [middleware.ensureLoggedIn, middleware.checkRequired.bind(null, ["tid"])],
    wikiNamespaceMainPages.putNamespaceMainPage
  );
  routeHelpers.setupApiRoute(
    router,
    "post",
    "/westgate-wiki/namespace",
    [middleware.ensureLoggedIn],
    wikiNamespaceCreateController.postNamespace
  );
  routeHelpers.setupApiRoute(
    router,
    "get",
    "/westgate-wiki/namespace/:cid/pages",
    [],
    wikiDirectoryController.getNamespacePages
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

plugin.addComposerFormatting = async function (payload) {
  if (!payload || !Array.isArray(payload.options)) {
    return payload;
  }

  payload.options.push({
    name: "wiki-link",
    title: "Insert wiki link",
    className: "fa fa-book",
    visibility: {
      desktop: true,
      mobile: true,
      main: true,
      reply: true
    }
  });

  return payload;
};

plugin.transformWikiPostContent = wikiLinks.transformWikiPostContent;
plugin.transformWikiUserMentions = wikiUserMentions.transformWikiUserMentions;
plugin.transformWikiFootnotes = wikiFootnotes.transformWikiFootnotes;
plugin.filterWikiMentionNotificationsCreate = wikiMentionNotifications.filterNotificationsCreate;
plugin.handleWikiMentionPostSave = wikiMentionNotifications.handlePostSaveOrEdit;
plugin.handleWikiMentionPostEdit = wikiMentionNotifications.handlePostSaveOrEdit;
plugin.handleWikiArticleWatchPostEdit = wikiArticleWatch.handlePostEdit;
plugin.addWikiArticleWatchNotificationType = wikiArticleWatch.addUserNotificationTypes;
plugin.wikiMarkdownBeforeParse = wikiHtmlParse.markdownBeforeParse;
plugin.filterWikiDiscussionTopicBuild = wikiDiscussionPlaceholder.filterTopicBuild;
plugin.filterWikiDiscussionTopicReply = wikiDiscussionSettings.filterTopicReply;
plugin.clearWikiPostParseCache = cacheService.clearWikiPostParseCache;
plugin.clearWikiPostEditCache = cacheService.clearWikiPostEditCache;
plugin.onWikiTopicDelete = wikiTopicPurge.onTopicDelete;
plugin.wikiFilterTopicPost = wikiPageValidation.validateTopicPost;
plugin.wikiFilterTopicEdit = wikiPageValidation.validateTopicEdit;
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
plugin.filterCategoryBuild = filterCategoriesForum.filterCategoryBuild;
plugin.filterTopicsUpdateRecent = filterForumFeeds.filterTopicsUpdateRecent;
plugin.filterTopicsFilterSortedTids = filterForumFeeds.filterTopicsFilterSortedTids;
plugin.filterTopicsGetUnreadTids = filterForumFeeds.filterTopicsGetUnreadTids;
plugin.filterSearchInContent = filterForumSearch.filterSearchInContent;
plugin.filterSearchIndexTopics = filterForumSearch.filterSearchIndexTopics;
plugin.filterSearchIndexPosts = filterForumSearch.filterSearchIndexPosts;
plugin.onWikiTopicMoved = async function (data) {
  const wikiDirectory = require("./lib/wiki-directory-service");
  const fromCid = parseInt(data && data.fromCid, 10);
  const toCid = parseInt(data && data.toCid, 10);
  if (Number.isInteger(fromCid) && fromCid > 0) {
    wikiDirectory.invalidateNamespace(fromCid);
  }
  if (Number.isInteger(toCid) && toCid > 0) {
    wikiDirectory.invalidateNamespace(toCid);
  }
};
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
  forumExclusionService,
  serializer,
  topicService,
  wikiLinkAutocomplete,
  wikiDiscussionPlaceholder,
  wikiDiscussionSettings,
  wikiFootnotes,
  wikiLinks,
  wikiMentionNotifications,
  wikiArticleWatch,
  wikiUserMentions,
  wikiNamespaceMainPages,
  wikiPageValidation,
  wikiPaths,
  wikiService,
  wikiDirectory: require("./lib/wiki-directory-service")
};
