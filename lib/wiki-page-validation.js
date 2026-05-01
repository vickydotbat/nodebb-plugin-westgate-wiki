"use strict";

const helpers = require.main.require("./src/controllers/helpers");

const wikiPaths = require("./wiki-paths");
const wikiService = require("./wiki-service");

const BLOCKING_STATUSES = new Set([
  "namespace-collision",
  "namespace-page-collision",
  "page-collision",
  "reserved-path-segment"
]);

function getValidationMessage(result) {
  if (!result || result.status === "ok") {
    return "";
  }

  if (result.status === "page-collision") {
    return "A wiki page with this URL already exists in this namespace. Rename the page before publishing.";
  }
  if (result.status === "namespace-page-collision") {
    return "This page URL is already used by a child namespace. Rename the page before publishing.";
  }
  if (result.status === "namespace-collision") {
    return "The configured wiki namespace paths are ambiguous. Resolve the namespace collision in the ACP before publishing.";
  }
  if (result.status === "reserved-path-segment") {
    return "This title would use a reserved wiki route. Rename the page before publishing.";
  }

  return "This wiki page title cannot be published at a clean wiki URL.";
}

function isBlockingResult(result) {
  return !!(result && BLOCKING_STATUSES.has(result.status));
}

function throwIfBlockingResult(result) {
  if (isBlockingResult(result)) {
    throw new Error(getValidationMessage(result));
  }
}

async function validateTopicPost(data) {
  const cid = data && data.cid;
  const title = data && data.title;
  if (!title) {
    return data;
  }

  const result = await wikiPaths.validatePageTitlePath(cid, title);
  throwIfBlockingResult(result);
  return data;
}

async function validateTopicEdit(data) {
  if (!data || !data.topic || !data.topic.title) {
    return data;
  }

  const result = await wikiPaths.validatePageTitlePath(data.topic.cid, data.topic.title, {
    omitTid: data.topic.tid
  });
  throwIfBlockingResult(result);
  return data;
}

async function checkPageTitle(req, res) {
  const cid = parseInt((req.query && req.query.cid) || (req.body && req.body.cid), 10);
  const title = String((req.query && req.query.title) || (req.body && req.body.title) || "").trim();
  const omitTid = parseInt((req.query && req.query.tid) || (req.body && req.body.tid), 10);

  if (!cid || !title) {
    return helpers.formatApiResponse(400, res, new Error("[[error:invalid-data]]"));
  }

  const sectionResult = await wikiService.getSection(cid, req.uid);
  if (sectionResult.status === "forbidden") {
    return helpers.formatApiResponse(403, res, new Error("[[error:no-privileges]]"));
  }
  if (sectionResult.status !== "ok") {
    return helpers.formatApiResponse(404, res, new Error("[[error:not-found]]"));
  }

  const result = await wikiPaths.validatePageTitlePath(cid, title, {
    omitTid: Number.isInteger(omitTid) && omitTid > 0 ? omitTid : null
  });
  const blocking = isBlockingResult(result);

  return helpers.formatApiResponse(200, res, {
    ok: !blocking && result.status === "ok",
    status: result.status,
    message: blocking ? getValidationMessage(result) : "",
    pageSlug: result.pageSlug || "",
    wikiPath: result.path || ""
  });
}

module.exports = {
  checkPageTitle,
  getValidationMessage,
  isBlockingResult,
  throwIfBlockingResult,
  validateTopicEdit,
  validateTopicPost
};
