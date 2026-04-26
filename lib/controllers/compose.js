"use strict";

const nconf = require.main.require("nconf");
const api = require.main.require("./src/controllers/api");
const helpers = require.main.require("./src/controllers/helpers");
const posts = require.main.require("./src/posts");
const utils = require.main.require("./src/utils");
const topicService = require("../topic-service");
const wikiService = require("../wiki-service");

function encodePayloadB64(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

async function renderCompose(req, res, next) {
  const cidParam = req.params.cid;
  const wikiResult = await wikiService.getSection(cidParam, req.uid);

  if (wikiResult.status === "invalid" || wikiResult.status === "not-found" || wikiResult.status === "not-wiki") {
    return next();
  }

  if (wikiResult.status === "forbidden") {
    return helpers.notAllowed(req, res);
  }

  if (!wikiResult.section.privileges.canCreatePage) {
    return helpers.notAllowed(req, res);
  }

  const defaultTitle = String((req.query && req.query.title) || "").trim();
  const section = wikiResult.section;
  const breadcrumbs = [
    {
      text: "Westgate Wiki",
      url: "/wiki"
    },
    ...section.ancestorSections.map((ancestor) => ({
      text: ancestor.name,
      url: ancestor.wikiPath
    })),
    {
      text: section.name,
      url: section.wikiPath
    },
    {
      text: "Create page"
    }
  ];

  // `/api/wiki/compose/...` is registered without buildHeader, so `res.locals.config` may be missing.
  const forumConfig = res.locals.config || await api.loadConfig(req);
  const relativePath = forumConfig.relative_path != null ? forumConfig.relative_path : (nconf.get("relative_path") || "");
  const csrfToken = forumConfig.csrf_token ? String(forumConfig.csrf_token) : "";

  const composePayload = {
    mode: "create",
    cid: section.cid,
    defaultTitle,
    sectionName: section.name,
    sectionWikiPath: section.wikiPath,
    relativePath,
    csrfToken,
    topicsApiUrl: `${relativePath}/api/v3/topics`,
    namespaceSearchUrl: `${relativePath}/api/v3/plugins/westgate-wiki/namespace/${section.cid}/search`
  };

  res.render("wiki-compose", {
    title: `Create page | ${section.name} | Westgate Wiki`,
    breadcrumbs,
    section,
    defaultTitle,
    composeMode: "create",
    pageHeading: "Create wiki page",
    submitLabel: "Publish page",
    composeCancelHref: section.wikiPath,
    composePayloadB64: encodePayloadB64(composePayload)
  });
}

async function renderEdit(req, res, next) {
  const tidParam = req.params.tid;

  if (!utils.isNumber(tidParam)) {
    return next();
  }

  const wikiPage = await topicService.getWikiPage(tidParam, req.uid);

  if (wikiPage.status === "invalid" || wikiPage.status === "not-found" || wikiPage.status === "not-wiki") {
    return next();
  }

  if (wikiPage.status === "forbidden") {
    return helpers.notAllowed(req, res);
  }

  if (!wikiPage.canEditWikiPage) {
    return helpers.notAllowed(req, res);
  }

  const topic = wikiPage.topic;
  const sectionResult = await wikiService.getSection(topic.cid, req.uid);

  if (sectionResult.status !== "ok") {
    return next();
  }

  const section = sectionResult.section;
  const initialContent = await posts.getPostField(topic.mainPid, "content");
  const defaultTitle = topic.titleRaw || topic.title;

  const forumConfig = res.locals.config || await api.loadConfig(req);
  const relativePath = forumConfig.relative_path != null ? forumConfig.relative_path : (nconf.get("relative_path") || "");
  const csrfToken = forumConfig.csrf_token ? String(forumConfig.csrf_token) : "";

  const composePayload = {
    mode: "edit",
    cid: section.cid,
    tid: parseInt(topic.tid, 10),
    mainPid: parseInt(topic.mainPid, 10),
    defaultTitle,
    initialContent: initialContent || "",
    sectionName: section.name,
    sectionWikiPath: section.wikiPath,
    relativePath,
    csrfToken,
    topicsApiUrl: `${relativePath}/api/v3/topics`,
    postEditUrl: `${relativePath}/api/v3/posts/${parseInt(topic.mainPid, 10)}`,
    namespaceSearchUrl: `${relativePath}/api/v3/plugins/westgate-wiki/namespace/${section.cid}/search`
  };

  const breadcrumbs = [
    {
      text: "Westgate Wiki",
      url: "/wiki"
    },
    ...section.ancestorSections.map((ancestor) => ({
      text: ancestor.name,
      url: ancestor.wikiPath
    })),
    {
      text: section.name,
      url: section.wikiPath
    },
    {
      text: topic.titleRaw || topic.title,
      url: `/wiki/${topic.slug}`
    },
    {
      text: "Edit"
    }
  ];

  res.render("wiki-compose", {
    title: `Edit | ${defaultTitle} | Westgate Wiki`,
    breadcrumbs,
    section,
    defaultTitle,
    composeMode: "edit",
    pageHeading: "Edit wiki page",
    submitLabel: "Save changes",
    composeCancelHref: `/wiki/${topic.slug}`,
    composePayloadB64: encodePayloadB64(composePayload)
  });
}

module.exports = {
  renderCompose,
  renderEdit
};
